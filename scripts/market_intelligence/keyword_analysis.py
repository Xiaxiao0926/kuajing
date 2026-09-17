"""
scripts/market_intelligence/keyword_analysis.py
Phase 1 & 2: Search Query Demand Funnel, Intent Classification & WB-DSI-V1 Engine
Processes all 300,000+ Jam search queries, classifies intent, and computes DSI.
"""
import math
import re
from collections import defaultdict
import openpyxl

BRAND_PATTERNS = [
    "bosch", "makita", "dewalt", "karcher", "intertool", "matrix", "зубр", "интерскол",
    "ваз", "лада", "лада гранта", "приора", "веста", "toyota", "ford", "bmw", "hyundai",
    "kia", "renault", "skoda", "nissan", "volkswagen", "audi", "honda", "synergetic",
    "finish", "faberlic", "amway", "fairy", "biomio", "grass", "somat", "ariel", "tide",
    "samsung", "apple", "xiaomi", "redmi", "iphone", "honor", "huawei", "poco", "lenovo",
    "nike", "adidas", "puma", "reebok", "zara", "shein", "geox", "crocs"
]

SPEC_PATTERNS = [
    r"\d+\s*мм", r"\d+\s*см", r"\d+\s*м\b", r"\d+\s*в\b", r"\d+\s*v\b", r"\d+\s*вт\b",
    r"\d+\s*w\b", r"\d+\s*ампер", r"\d+\s*а\b", r"m\d+", r"м\d+", r"\d+\s*шт", r"\d+\s*пар"
]

HEAVY_WEIGHT_PATTERNS = [
    r"\b(25|20|30|40|50)\s*кг\b", r"\b(10|15)\s*кг\b", r"\b(5|10|20)\s*л\b", r"\b(5|10|20)\s*литр"
]

PROBLEM_PATTERNS = [
    "для ремонта", "ремонт", "замена", "восстановление", "очиститель", "съемник",
    "герметик", "устранение", "для снятия", "прочистка", "от ржавчины", "течи", "заклеить"
]

def classify_intent(kw):
    kw_l = kw.lower()
    for b in BRAND_PATTERNS:
        if b in kw_l:
            return "品牌/车型词 (Brand/Model)"
    for pat in PROBLEM_PATTERNS:
        if pat in kw_l:
            return "问题/维修词 (Problem/Repair)"
    for pat in SPEC_PATTERNS:
        if re.search(pat, kw_l):
            return "规格词 (Specification)"
    if any(w in kw_l for w in ["для", "в авто", "в машину", "для дома", "набор", "комплект"]):
        return "场景/套装词 (Scenario/Set)"
    return "通用词 (Generic)"

def safe_float(v, default=0.0):
    if v is None or v == "":
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default

def process_search_queries(search_path, progress_cb=None):
    """
    Reads Jam search queries from File B, returns:
      - niche_search_agg: { champion_name: { total_search_vol, ... } }
      - blue_ocean_top100: list
      - growth_top50: list
      - total_queries: int
    """
    wb = openpyxl.load_workbook(search_path, read_only=True, data_only=True)
    ws = wb["详细信息"]

    niche_search_agg = defaultdict(lambda: {
        "total_search_vol": 0, "total_search_prev": 0, "total_clicks": 0,
        "total_cart": 0, "total_orders": 0, "total_products_found": 0,
        "cart_rates": [], "order_rates": [], "keywords": [],
        "heavy_weight_detected": False, "heavy_weight_terms": [],
    })

    blue_ocean_candidates = []
    growth_candidates = []
    total_queries = 0

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
        if i == 0 and row[0] == '搜索词':
            continue
        kw = str(row[0] or "").strip()
        if not kw:
            continue
        total_queries += 1

        sv = safe_float(row[1])
        svp = safe_float(row[2])
        champ = str(row[5] or "").strip()
        clicks = safe_float(row[6])
        cart = safe_float(row[8])
        cart_rate = safe_float(row[10])
        orders = safe_float(row[12])
        order_rate = safe_float(row[14])
        prods = safe_float(row[18])

        if champ:
            agg = niche_search_agg[champ]
            agg["total_search_vol"] += sv
            agg["total_search_prev"] += svp
            agg["total_clicks"] += clicks
            agg["total_cart"] += cart
            agg["total_orders"] += orders
            agg["total_products_found"] += prods
            if cart_rate > 0:
                agg["cart_rates"].append(cart_rate)
            if order_rate > 0:
                agg["order_rates"].append(order_rate)
            if sv >= 2000:
                agg["keywords"].append((kw, sv, order_rate, prods, cart_rate))

            # Detect heavy weight penalty
            for hw in HEAVY_WEIGHT_PATTERNS:
                if re.search(hw, kw.lower()) and sv >= 1000:
                    agg["heavy_weight_detected"] = True
                    agg["heavy_weight_terms"].append(f"{kw} ({int(sv):,})")
                    break

        # Candidate selection for web showcases
        if sv >= 3000:
            dsi = (math.log1p(sv) * (order_rate / 100.0) * (cart_rate / 100.0)) / math.log1p(prods + 10) * 100
            blue_ocean_candidates.append({
                "query": kw,
                "category": champ,
                "search_vol": int(sv),
                "goods_count": int(prods),
                "dsi": round(dsi, 2),
                "order_cvr": f"{int(order_rate)}%",
                "cart_cvr": f"{int(cart_rate)}%",
            })

            growth_rate = ((sv - svp) / svp * 100) if svp > 0 else 0
            if svp >= 500 and growth_rate >= 30:
                growth_candidates.append({
                    "query": kw,
                    "category": champ,
                    "search_vol": int(sv),
                    "goods_count": int(prods),
                    "dsi": round(dsi, 2),
                    "growth": f"+{growth_rate:.1f}%",
                    "growth_num": growth_rate,
                })

        if progress_cb and (i + 1) % 50000 == 0:
            progress_cb(i + 1)

    wb.close()

    blue_ocean_top100 = sorted(blue_ocean_candidates, key=lambda x: x["dsi"], reverse=True)[:100]
    growth_top50 = sorted(growth_candidates, key=lambda x: x["growth_num"], reverse=True)[:50]

    return {
        "niche_search_agg": dict(niche_search_agg),
        "blue_ocean_top100": blue_ocean_top100,
        "growth_top50": growth_top50,
        "total_queries": total_queries,
    }
