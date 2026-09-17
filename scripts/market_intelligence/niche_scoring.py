"""
scripts/market_intelligence/niche_scoring.py
WB-MARKET-MODEL-V1 (FROZEN)
Hard Gate filtering & category-relative 6-dimension percentile scoring.
"""
import math
from collections import defaultdict
import openpyxl

def safe_num(v, default=0.0):
    if v is None or v == "":
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default

def percentile_rank(val, sorted_list):
    if not sorted_list:
        return 0.5
    count_below = sum(1 for x in sorted_list if x < val)
    count_equal = sum(1 for x in sorted_list if x == val)
    return (count_below + 0.5 * count_equal) / len(sorted_list)

def load_and_gate_niches(niche_path):
    """
    Loads raw niches from File A, applies Hard Gate.
    Returns:
      gated_niches: list of dicts that passed the gate
      eliminated_stats: dict of reasons & counts
      total_raw: int
    """
    wb = openpyxl.load_workbook(niche_path, read_only=True, data_only=True)
    ws = wb["详细信息"]

    all_raw_niches = []
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
        if i == 0 and row[0] == '类目':
            continue
        cat = str(row[0] or "").strip()
        niche_name = str(row[1] or "").strip()
        if not cat or not niche_name:
            continue

        buyout_rate = safe_num(row[2])          # 实际成交率 (Выкуп, %)
        buyout_rate_prev = safe_num(row[21])     # 实际成交率 (上期, %)
        sellers = safe_num(row[3])
        s_orders = safe_num(row[4])
        oc = safe_num(row[7])                   # 订单集中度 (%)
        oc_prev = safe_num(row[8])
        rev = safe_num(row[9])
        rev_prev = safe_num(row[10])
        price = safe_num(row[11])
        price_prev = safe_num(row[12])
        products = safe_num(row[13])
        p_orders = safe_num(row[14])
        sku_active_pct = safe_num(row[17])      # 有订单商品 %
        turnover = safe_num(row[18])
        avail = str(row[19] or "未计算").strip()
        rating = safe_num(row[22])

        all_raw_niches.append({
            "category": cat,
            "niche_name": niche_name,
            "buyout_rate": buyout_rate,
            "buyout_rate_prev": buyout_rate_prev,
            "sellers": int(sellers),
            "sellers_with_orders": int(s_orders),
            "order_concentration": oc,
            "order_concentration_prev": oc_prev,
            "revenue": rev,
            "revenue_prev": rev_prev,
            "avg_price": price,
            "avg_price_prev": price_prev,
            "products": int(products),
            "products_with_orders": int(p_orders),
            "sku_active_pct": sku_active_pct,
            "turnover_days": turnover,
            "availability": avail,
            "avg_rating": rating,
        })
    wb.close()

    gated_niches = []
    elimination_reasons = {
        "dead_niche_zero_revenue": 0,
        "micro_niche_gmv_under_50k": 0,
        "single_seller_monopoly": 0,
        "other": 0,
    }

    for n in all_raw_niches:
        reasons = []
        if n["revenue"] < 30000:
            reasons.append("营收过低 (<¥30K)")
            if n["revenue"] <= 0:
                elimination_reasons["dead_niche_zero_revenue"] += 1
            else:
                elimination_reasons["micro_niche_gmv_under_50k"] += 1
        elif n["sellers"] < 2:
            reasons.append("卖家数极少 (<2)")
            elimination_reasons["single_seller_monopoly"] += 1
        elif n["sellers_with_orders"] < 1:
            reasons.append("零出单卖家")
            elimination_reasons["single_seller_monopoly"] += 1
        elif n["products"] < 5:
            reasons.append("商品卡极少 (<5)")
            elimination_reasons["other"] += 1
        elif n["revenue_prev"] > 1000000 and n["revenue"] < n["revenue_prev"] * 0.15:
            reasons.append("市场崩盘 (降幅>85%)")
            elimination_reasons["other"] += 1

        if not reasons:
            gated_niches.append(n)

    return gated_niches, elimination_reasons, len(all_raw_niches)

def score_niches(gated_niches, niche_search_agg):
    """
    Computes WB-MARKET-MODEL-V1 6-dimension Market Opportunity Score.
    """
    cat_groups = defaultdict(list)
    for n in gated_niches:
        name = n["niche_name"]
        s_agg = niche_search_agg.get(name)
        if s_agg and s_agg["total_search_vol"] > 0:
            n["has_search_data"] = True
            n["search_vol"] = s_agg["total_search_vol"]
            n["search_vol_prev"] = s_agg["total_search_prev"]
            n["search_growth"] = ((s_agg["total_search_vol"] - s_agg["total_search_prev"]) / s_agg["total_search_prev"] * 100) \
                if s_agg["total_search_prev"] > 0 else 0
            n["search_orders"] = s_agg["total_orders"]
            n["search_clicks"] = s_agg["total_clicks"]
            n["click_eff"] = (s_agg["total_clicks"] / s_agg["total_search_vol"] * 100) if s_agg["total_search_vol"] > 0 else 0
            n["avg_cart_rate"] = sum(s_agg["cart_rates"]) / len(s_agg["cart_rates"]) if s_agg["cart_rates"] else 0
            n["avg_order_rate"] = sum(s_agg["order_rates"]) / len(s_agg["order_rates"]) if s_agg["order_rates"] else 0
            n["demand_supply_ratio"] = s_agg["total_search_vol"] / max(n["products"], 1)
            n["top_keywords"] = sorted(s_agg["keywords"], key=lambda x: x[1], reverse=True)[:5]
            n["heavy_weight"] = s_agg["heavy_weight_detected"]
            n["heavy_terms"] = s_agg["heavy_weight_terms"]
        else:
            n["has_search_data"] = False
            n["search_vol"] = 0
            n["search_vol_prev"] = 0
            n["search_growth"] = 0
            n["search_orders"] = 0
            n["search_clicks"] = 0
            n["click_eff"] = 0
            n["avg_cart_rate"] = 0
            n["avg_order_rate"] = 0
            n["demand_supply_ratio"] = 0
            n["top_keywords"] = []
            n["heavy_weight"] = False
            n["heavy_terms"] = []

        rg = ((n["revenue"] - n["revenue_prev"]) / n["revenue_prev"] * 100) if n["revenue_prev"] > 0 else 0
        n["revenue_growth"] = min(rg, 500)

        cat_groups[n["category"]].append(n)

    for cat, n_list in cat_groups.items():
        rev_logs = sorted([math.log1p(n["revenue"]) for n in n_list])
        sv_logs = sorted([math.log1p(n["search_vol"]) for n in n_list])
        so_logs = sorted([math.log1p(n["search_orders"]) for n in n_list])
        rg_list = sorted([n["revenue_growth"] for n in n_list])
        sg_list = sorted([n["search_growth"] for n in n_list])
        sellers_list = sorted([n["sellers_with_orders"] for n in n_list])
        prods_list = sorted([n["products"] for n in n_list])
        oc_list = sorted([n["order_concentration"] for n in n_list])
        click_list = sorted([n["click_eff"] for n in n_list])
        cart_list = sorted([n["avg_cart_rate"] for n in n_list])
        order_list = sorted([n["avg_order_rate"] for n in n_list])
        dsr_list = sorted([math.log1p(n["demand_supply_ratio"]) for n in n_list])
        buyout_list = sorted([n["buyout_rate"] for n in n_list])

        for n in n_list:
            # Dim 1: 真实需求 (25%)
            p_rev = percentile_rank(math.log1p(n["revenue"]), rev_logs)
            p_sv = percentile_rank(math.log1p(n["search_vol"]), sv_logs)
            p_so = percentile_rank(math.log1p(n["search_orders"]), so_logs)
            dim_demand = (p_rev * 12 + p_sv * 8 + p_so * 5)

            # Dim 2: 增长动能 (15%)
            p_rg = percentile_rank(n["revenue_growth"], rg_list)
            p_sg = percentile_rank(n["search_growth"], sg_list)
            dim_growth = (p_rg * 8 + p_sg * 7)

            # Dim 3: 竞争难度 (20% - 反向计分)
            p_sellers = 1.0 - percentile_rank(n["sellers_with_orders"], sellers_list)
            p_prods = 1.0 - percentile_rank(n["products"], prods_list)
            p_oc = percentile_rank(n["order_concentration"], oc_list)
            dim_comp = (p_sellers * 8 + p_prods * 6 + p_oc * 6)

            # Dim 4: 需求质量 (15%)
            p_click = percentile_rank(n["click_eff"], click_list)
            p_cart = percentile_rank(n["avg_cart_rate"], cart_list)
            p_order = percentile_rank(n["avg_order_rate"], order_list)
            dim_quality = (p_click * 4 + p_cart * 4 + p_order * 7)

            # Dim 5: 供需缺口 (10%)
            p_dsr = percentile_rank(math.log1p(n["demand_supply_ratio"]), dsr_list)
            p_buyout = percentile_rank(n["buyout_rate"], buyout_list)
            dim_gap = (p_dsr * 6 + p_buyout * 4)

            # Dim 6: 商业可行性 (15%)
            price = n["avg_price"]
            if 60 <= price <= 500:
                p_price = 1.0
            elif 35 <= price < 60 or 500 < price <= 900:
                p_price = 0.7
            else:
                p_price = 0.3

            p_margin = 1.0 if n["buyout_rate"] >= 85 else (0.7 if n["buyout_rate"] >= 72 else 0.3)
            t_days = n["turnover_days"] if isinstance(n["turnover_days"], (int, float)) else 0
            p_turn = 1.0 if (0 < t_days <= 120) else (0.6 if t_days <= 240 else 0.3)
            dim_biz = (p_price * 6 + p_margin * 6 + p_turn * 3)

            mos = dim_demand + dim_growth + dim_comp + dim_quality + dim_gap + dim_biz
            n["market_opportunity_score"] = round(mos, 1)

    return gated_niches
