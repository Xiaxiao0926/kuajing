"""
京东联盟 API 对接服务
=====================
启动方式：
    1. 设置环境变量：
       set JD_APP_KEY=你的AppKey
       set JD_APP_SECRET=你的AppSecret
    2. 安装依赖：
       pip install -r requirements.txt
    3. 启动服务：
       uvicorn app:app --host 0.0.0.0 --port 8000 --reload
    4. 访问文档：
       http://localhost:8000/docs

API 端点：
    GET  /api/jd/goods/{sku_id}          获取商品详情
    GET  /api/jd/search?keyword=xxx      搜索商品
    GET  /api/jd/images/{sku_id}         获取已下载的商品图片列表
    POST /api/jd/fetch-images/{sku_id}   下载商品图片到本地
    GET  /api/jd/products                获取已缓存的所有商品列表
"""

import os
import json
import uuid
import requests as http_requests
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import DATA_DIR, IMAGES_DIR
from jd_client import jd_client

app = FastAPI(title="京东联盟 API 服务", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)


_ensure_dirs()


def _products_file() -> str:
    return os.path.join(DATA_DIR, "products.json")


def _load_products() -> dict:
    path = _products_file()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_products(products: dict):
    path = _products_file()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)


def _save_product_detail(sku_id: str, detail: dict):
    products = _load_products()
    products[sku_id] = detail
    _save_products(products)


def _ok(data=None) -> dict:
    return {"success": True, "data": data or {}, "error": ""}


def _fail(error: str) -> dict:
    return {"success": False, "data": None, "error": error}


@app.get("/api/jd/goods/{sku_id}")
async def get_goods(sku_id: str):
    detail = jd_client.get_goods_detail(sku_id)
    if "error" in detail:
        return JSONResponse(_fail(detail["error"]), status_code=400)
    _save_product_detail(sku_id, detail)
    return _ok(detail)


@app.get("/api/jd/search")
async def search_goods(keyword: str = Query(..., min_length=1), page: int = Query(1, ge=1)):
    result = jd_client.search_goods(keyword, page=page)
    if "error" in result:
        return JSONResponse(_fail(result["error"]), status_code=400)
    return _ok(result)


@app.get("/api/jd/images/{sku_id}")
async def get_images(sku_id: str):
    sku_dir = os.path.join(IMAGES_DIR, sku_id)
    if not os.path.isdir(sku_dir):
        return _ok({"sku_id": sku_id, "images": []})
    images = sorted([
        f for f in os.listdir(sku_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp"))
    ])
    return _ok({"sku_id": sku_id, "images": images})


@app.post("/api/jd/fetch-images/{sku_id}")
async def fetch_images(sku_id: str):
    detail = jd_client.get_goods_detail(sku_id)
    if "error" in detail:
        return JSONResponse(_fail(detail["error"]), status_code=400)

    img_url = detail.get("img_url", "")
    if not img_url:
        return JSONResponse(_fail("该商品无图片URL"), status_code=400)

    sku_dir = os.path.join(IMAGES_DIR, sku_id)
    os.makedirs(sku_dir, exist_ok=True)

    urls = [img_url]
    image_names = []

    headers = {
        "Referer": "https://item.jd.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    for url in urls:
        try:
            resp = http_requests.get(url, headers=headers, timeout=15, stream=True)
            if resp.status_code != 200:
                continue
            content_type = resp.headers.get("Content-Type", "")
            ext = ".jpg"
            if "png" in content_type:
                ext = ".png"
            elif "gif" in content_type:
                ext = ".gif"
            elif "webp" in content_type:
                ext = ".webp"
            filename = f"{uuid.uuid4().hex[:8]}{ext}"
            filepath = os.path.join(sku_dir, filename)
            with open(filepath, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            image_names.append(filename)
        except Exception as e:
            print(f"[JD] 下载图片失败 {url}: {e}")
            continue

    if not image_names:
        return JSONResponse(_fail("图片下载失败"), status_code=500)

    return _ok({"sku_id": sku_id, "downloaded": image_names})


@app.get("/api/jd/products")
async def get_products():
    products = _load_products()
    return _ok({"total": len(products), "products": products})
