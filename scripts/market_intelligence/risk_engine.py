"""
scripts/market_intelligence/risk_engine.py
WB-CROSSBORDER-RISK-V1 (FROZEN)
10-Dimension Risk Tagging, Reverse Weight Penetration & Preliminary Feasibility Score (PFS).
"""

CAT_BASE_SCORE = {
    # P1 categories (Base 85-95)
    "手动工具及配件": 95, "电工电气": 92, "工作服及防护用品": 94, "汽车配件": 88,
    "汽车配件及改装件": 88, "装修材料": 90, "家居清洁用品": 85,
    # P2 categories (Base 75-84)
    "收纳": 84, "餐具器具": 82, "家居用品": 82, "小型家具": 78, "园艺工具及灌溉用品": 80,
    "园艺用品": 78, "露营及休闲用品": 80, "宠物用品": 78, "运动配件": 82, "配饰": 84,
    # P3 categories (Base 20-72)
    "服装": 55, "鞋类": 55, "内衣": 60, "运动服装": 58, "美妆": 50, "健康用品": 52,
    "食品": 40, "即食食品": 35, "婴儿食品": 30, "婴儿服装": 60, "婴儿用品": 65,
    "大家电": 35, "家用电器": 60, "厨房电器": 58, "电动工具及设备": 72, "车载电子": 70,
    "电脑及笔记本": 45, "智能手机及数码产品": 40, "珠宝首饰": 45, "药品": 20, "兽药": 30,
}

BULKY_KEYWORDS = ["保险杠", "车门", "消音器", "排气管", "行李架", "踏板", "大灯", "轮毂", "梯", "床垫", "沙发", "衣柜"]

def calc_feasibility(n):
    cat = n["category"]
    name = n["niche_name"]
    price = n["avg_price"]
    buyout = n["buyout_rate"]
    heavy = n.get("heavy_weight", False)

    base = CAT_BASE_SCORE.get(cat, 70)
    adj = 0

    # 1. Reverse Weight penetration penalty
    if heavy:
        adj -= 30

    # Bulky item keyword checks
    if any(w in name for w in BULKY_KEYWORDS):
        adj -= 25
    elif any(w in name for w in ["手套", "螺丝", "螺母", "卡扣", "垫片", "开关", "接头", "端子", "砂纸", "滤芯", "刷", "贴纸", "支架"]):
        adj += 10 # ultra compact bonus

    # Chemical / Liquid compliance penalty
    if any(w in name for w in ["液", "油", "剂", "水", "蜡", "漆", "酸", "乳"]):
        adj -= 18

    # Electrical EAC risk
    if any(w in name for w in ["电", "充", "机", "仪", "泵", "吸尘"]):
        adj -= 8

    # Buyout rate (Выкуп)履约奖励
    if buyout >= 90:
        adj += 10
    elif buyout >= 82:
        adj += 5
    elif buyout < 70:
        adj -= 15

    # Price margin space
    if 70 <= price <= 450:
        adj += 6
    elif price < 35:
        adj -= 10
    elif price > 1500:
        adj -= 10

    final_score = max(min(base + adj, 100), 10)
    return float(final_score)

def assign_risk_tags(n):
    name = n["niche_name"]
    cat = n["category"]
    growth = n.get("growth_rate_pct", n.get("revenue_growth", 0))
    top_kws = n.get("top_keywords", [])
    kw_text = " ".join([k[0].lower() for k in top_kws if isinstance(k, (list, tuple))])

    tags = []

    # 1. ELECTRICAL
    is_manual_tool = any(w in name for w in ["手动", "手压", "黄油枪", "发泡胶枪", "拉铆枪", "压线钳", "绝缘子", "热缩管", "锯链", "螺丝刀"])
    if not is_manual_tool:
        if any(w in name for w in ["稳压器", "变频器", "电缆", "开关", "插头", "电容", "电动机", "电池", "车载电子", "电工", "继电器", "熔断器"]):
            tags.append("ELECTRICAL")
        elif any(w in kw_text for w in ["220в", "220 вольт", "380в", "стабилизатор", "инвертор", "преобразователь"]):
            tags.append("ELECTRICAL")

    # 2. HEATING
    if any(w in name for w in ["加热器", "伴热", "发热", "暖风", "加热", "烤箱", "电热", "壁挂炉"]):
        tags.append("HEATING")
    elif any(w in kw_text for w in ["вебасто", "подогреватель", "обогреватель", "греющий", "автономка"]):
        tags.append("HEATING")

    # 3. FUEL
    if any(w in name for w in ["燃气", "汽油", "柴油", "减压阀", "燃油", "喷油", "节气门", "油箱", "瓦斯"]):
        tags.append("FUEL")
    elif any(w in kw_text for w in ["гбо", "бензин", "дизель", "топливо", "газовое"]):
        tags.append("FUEL")

    # 4. FRAGILE
    if any(w in name for w in ["陶瓷", "玻璃", "绝缘子", "灯泡", "透镜", "折射计", "镜", "仪表盘"]):
        tags.append("FRAGILE")
    elif any(w in kw_text for w in ["стекло", "керамика", "зеркало", "фарфор"]):
        tags.append("FRAGILE")

    # 5. HEAVY
    if n.get("heavy_weight") in ["YES ⚠️", "YES", True] or any(w in name for w in ["传动轴", "发电机", "铸铁", "减速箱", "变矩器", "卷帘门", "保险杠", "水泥", "砂浆"]):
        tags.append("HEAVY")
    elif any(w in kw_text for w in ["25 кг", "20 кг", "15 кг", "10 кг", "50 кг"]):
        tags.append("HEAVY")

    # 6. BULKY
    if any(w in name for w in ["纸箱", "地板", "隔音板", "止震板", "车顶行李架", "防撞梁", "脚踏板", "车门", "床垫", "衣柜", "梯"]):
        tags.append("BULKY")
    elif any(w in kw_text for w in ["линолеум", "коробка для переезда", "шумка", "виброизоляция"]):
        tags.append("BULKY")

    # 7. MODEL_FITMENT
    if any(w in name for w in ["传动轴", "进气翻板", "变矩器", "传感器", "曲轴", "中网", "制动盘", "前桥", "后桥", "排气管", "减震器", "悬挂"]):
        tags.append("MODEL_FITMENT")
    elif any(w in kw_text for w in ["ваз", "лада", "гранта", "приора", "веста", "нива", "шевроле", "renault", "toyota", "bmw", "hyundai"]):
        tags.append("MODEL_FITMENT")

    # 8. CERTIFICATION
    if any(w in name for w in ["灭火器", "安全气囊", "安全带", "刹车", "高压", "气瓶", "防爆", "燃气", "特种劳保"]):
        tags.append("CERTIFICATION")
    elif "ELECTRICAL" in tags and any(w in name for w in ["稳压器", "变频器"]):
        tags.append("CERTIFICATION")

    # 9. HIGH_AFTERSALES
    if any(w in name for w in ["变频器", "稳压器", "驻车加热器", "燃气设备", "变矩器", "自动变速箱", "空调压缩机"]):
        tags.append("HIGH_AFTERSALES")

    # 10. SEASONAL
    if growth >= 80 or any(w in name for w in ["驻车加热器", "加热电缆", "封口器", "扫雪", "除冰", "电热毯"]):
        tags.append("SEASONAL")
    elif any(w in kw_text for w in ["закаточная", "вебасто", "греющий кабель", "зимний", "зима"]):
        tags.append("SEASONAL")

    return tags if tags else ["NONE (通用标品)"]
