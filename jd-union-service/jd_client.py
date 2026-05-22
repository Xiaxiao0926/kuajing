import hashlib
import time
import requests

from config import JD_APP_KEY, JD_APP_SECRET, JD_API_GATEWAY, JD_TOKEN_URL


class JDUnionClient:
    def __init__(self):
        self.app_key = JD_APP_KEY
        self.app_secret = JD_APP_SECRET
        self.gateway = JD_API_GATEWAY
        self.token_url = JD_TOKEN_URL
        self.access_token = ""
        self.token_expires_at = 0

    def _sign(self, params: dict) -> str:
        sorted_keys = sorted(params.keys())
        raw = self.app_secret
        for k in sorted_keys:
            raw += str(k) + str(params[k])
        raw += self.app_secret
        return hashlib.md5(raw.encode("utf-8")).hexdigest().upper()

    def _is_configured(self) -> bool:
        return bool(self.app_key and self.app_secret)

    def _ensure_token(self) -> bool:
        if not self._is_configured():
            return False
        now = time.time()
        if self.access_token and now < self.token_expires_at:
            return True
        try:
            resp = requests.post(self.token_url, data={
                "grant_type": "client_credentials",
                "app_key": self.app_key,
                "app_secret": self.app_secret,
            }, timeout=10)
            data = resp.json()
            token_info = data.get("access_token") or data.get("jd_union_open_access_token_get_response", {}).get("result", {}).get("access_token")
            if token_info:
                self.access_token = token_info
                expires_in = data.get("expires_in", 86400)
                self.token_expires_at = now + int(expires_in) - 300
                return True
            return False
        except Exception as e:
            print(f"[JD] 获取 Token 失败: {e}")
            return False

    def _call(self, method: str, biz_params: dict) -> dict:
        if not self._is_configured():
            return {"error": "JD_APP_KEY 或 JD_APP_SECRET 未配置，请在环境变量中设置"}
        if not self._ensure_token():
            return {"error": "获取 Access Token 失败，请检查 AppKey/AppSecret 配置"}

        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        system_params = {
            "method": method,
            "app_key": self.app_key,
            "access_token": self.access_token,
            "timestamp": timestamp,
            "format": "json",
            "v": "1.0",
            "sign_method": "md5",
        }
        all_params = {**system_params, "param_json": str(biz_params)}
        sign = self._sign(all_params)
        all_params["sign"] = sign

        try:
            resp = requests.post(self.gateway, data=all_params, timeout=15)
            return resp.json()
        except Exception as e:
            return {"error": f"API 请求失败: {e}"}

    def get_goods_detail(self, sku_id: str) -> dict:
        biz = {"skuIds": [sku_id]}
        result = self._call("jingdong.union.open.goods.query", biz)
        if "error" in result:
            return result
        try:
            resp_key = "jd_union_open_goods_query_response"
            goods_list = result[resp_key]["result"]["data"]
            if goods_list:
                item = goods_list[0]
                return {
                    "sku_id": str(sku_id),
                    "title": item.get("goodsName", ""),
                    "img_url": item.get("imgUrl", ""),
                    "price": item.get("price", ""),
                    "original_price": item.get("originalPrice", ""),
                    "material_url": item.get("materialUrl", ""),
                    "category_info": item.get("categoryInfo", {}),
                    "specs": item.get("specs", ""),
                    "comment_num": item.get("commentNum", 0),
                    "good_comments_share": item.get("goodCommentsShare", ""),
                    "shop_name": item.get("shopName", ""),
                }
            return {"error": f"未找到 sku_id={sku_id} 的商品信息"}
        except (KeyError, IndexError, TypeError) as e:
            return {"error": f"解析商品详情失败: {e}", "raw": result}

    def get_goods_promotion(self, sku_id: str) -> dict:
        biz = {"skuIds": [sku_id]}
        result = self._call("jd.union.open.goods.promotion.get", biz)
        if "error" in result:
            return result
        try:
            resp_key = "jd_union_open_goods_promotion_get_response"
            promo_data = result[resp_key]["result"]
            return {
                "sku_id": str(sku_id),
                "promotion_data": promo_data,
            }
        except (KeyError, TypeError) as e:
            return {"error": f"解析促销信息失败: {e}", "raw": result}

    def search_goods(self, keyword: str, page: int = 1, page_size: int = 20) -> dict:
        biz = {
            "keyword": keyword,
            "pageIndex": page,
            "pageSize": page_size,
        }
        result = self._call("jingdong.union.open.goods.query", biz)
        if "error" in result:
            return result
        try:
            resp_key = "jd_union_open_goods_query_response"
            goods_list = result[resp_key]["result"]["data"]
            total = result[resp_key]["result"].get("totalCount", 0)
            items = []
            for item in (goods_list or []):
                items.append({
                    "sku_id": str(item.get("skuId", "")),
                    "title": item.get("goodsName", ""),
                    "img_url": item.get("imgUrl", ""),
                    "price": item.get("price", ""),
                    "original_price": item.get("originalPrice", ""),
                    "material_url": item.get("materialUrl", ""),
                    "shop_name": item.get("shopName", ""),
                    "comment_num": item.get("commentNum", 0),
                })
            return {
                "keyword": keyword,
                "page": page,
                "page_size": page_size,
                "total": total,
                "items": items,
            }
        except (KeyError, TypeError) as e:
            return {"error": f"解析搜索结果失败: {e}", "raw": result}


jd_client = JDUnionClient()
