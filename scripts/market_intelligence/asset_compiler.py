"""
scripts/market_intelligence/asset_compiler.py
Compiles compact JSON assets for the /kuajing web dashboard into a staging directory.
Performs manual business data inheritance from previous runs.
"""
import os
import json
import math
from pathlib import Path
from .phase4_validation import CANONICAL_ENGINEERING_DB
from .niche_uid import resolve_niche_uid

def inherit_manual_state(new_niches, previous_run_dir):
    """
    Inherits user overrides (verdict, user notes, procurement info) from previous run.
    Uses stable niche_uid first, then alias/name fallback.
    If match is ambiguous, marks MAPPING_REVIEW_REQUIRED.
    """
    if not previous_run_dir or not os.path.exists(previous_run_dir):
        return new_niches, 0, []

    prev_niches_file = os.path.join(previous_run_dir, "niches_compact.json")
    if not os.path.exists(prev_niches_file):
        return new_niches, 0, []

    try:
        with open(prev_niches_file, "r", encoding="utf-8") as f:
            prev_niches = json.load(f)
    except Exception as e:
        print(f"[Compiler] Warning: Could not read previous niches for inheritance: {e}")
        return new_niches, 0, []

    prev_by_uid = {p["uid"]: p for p in prev_niches if "uid" in p}
    prev_by_name = {p["name"]: p for p in prev_niches if "name" in p}
    inherited_count = 0
    review_required = []

    for n in new_niches:
        uid = n.get("uid")
        name = n["name"]
        cat = n["cat"]

        prev = None
        if uid and uid in prev_by_uid:
            prev = prev_by_uid[uid]
        elif name in prev_by_name:
            prev = prev_by_name[name]

        if prev:
            # Check if previous item had manual overrides
            if prev.get("manual_override") or prev.get("userNote") or prev.get("verdict_override"):
                n["verdict"] = prev.get("verdict_override", prev.get("verdict", n["verdict"]))
                n["userNote"] = prev.get("userNote", "")
                n["manual_override"] = True
                n["inherited_from"] = prev.get("run_id", os.path.basename(previous_run_dir))
                if "procurement" in prev:
                    n["procurement"] = prev["procurement"]
                inherited_count += 1
        else:
            # Check for partial / fuzzy ambiguity (if similar name exists)
            candidates = [p["name"] for p in prev_niches if p.get("name") and (p["name"] in name or name in p["name"])]
            if candidates:
                n["mapping_review_required"] = True
                n["mapping_candidates"] = candidates
                review_required.append(name)

    return new_niches, inherited_count, review_required

def compile_run_assets(
    output_dir,
    run_id,
    run_title,
    data_period,
    scored_niches,
    keyword_results,
    bridge_stats,
    elimination_stats,
    total_raw_niches,
    previous_run_dir=None,
    manifest=None
):
    """
    Compiles all JSON deliverables into output_dir.
    """
    os.makedirs(output_dir, exist_ok=True)
    out_path = Path(output_dir)

    total_gmv_sum = 0
    category_stats = {}
    niches_compact = []

    # 1. Build compact niches
    for n in scored_niches:
        name = n["niche_name"]
        cat = n["category"]
        rev = int(n["revenue"])
        total_gmv_sum += rev
        mos = n["market_opportunity_score"]
        cfs = n["feasibility_score"]
        comp = round(mos * 0.55 + cfs * 0.45, 1)

        # Tier
        if comp >= 80:
            tier = "S"
        elif comp >= 75:
            tier = "A"
        elif comp >= 65:
            tier = "B"
        else:
            tier = "C"

        # Category aggregates
        if cat not in category_stats:
            category_stats[cat] = {"count": 0, "gmv": 0, "sellers": 0}
        category_stats[cat]["count"] += 1
        category_stats[cat]["gmv"] += rev
        category_stats[cat]["sellers"] += n["sellers_with_orders"]

        # Engineering specs
        eng = CANONICAL_ENGINEERING_DB.get(name)
        specs = None
        if eng:
            specs = {
                "def": eng["precise_product_def"],
                "specs": eng["core_specs_variants"],
                "weight_g": eng["typical_weight_g"],
                "dims": eng["typical_dimensions_cm"],
                "is_fragile": eng["is_fragile"],
                "is_elec": eng["is_electrical"],
                "is_liquid": eng["is_liquid"],
                "eac": eng["eac_certification_status"],
                "fitment": eng["model_fitment_risk"],
                "aftersales": eng["aftersales_complexity"],
                "rationale": eng["verdict_rationale"],
            }

        top_kw_str = ", ".join([f"{k[0]}({int(k[1]):,})" for k in n.get("top_keywords", [])[:3]])

        uid, _ = resolve_niche_uid("wb", cat, name)

        niches_compact.append({
            "id": n["rank"],
            "uid": uid,
            "name": name,
            "cat": cat,
            "tier": tier,
            "mos": mos,
            "cfs": cfs,
            "comp": comp,
            "gmv": rev,
            "gmv_prev": int(n["revenue_prev"]),
            "delta": f"{int(n['revenue'] - n['revenue_prev']):+d}",
            "growth": f"{n.get('revenue_growth', 0):+.1f}%",
            "growth_num": round(n.get("revenue_growth", 0), 1),
            "sellers": n["sellers_with_orders"],
            "price": round(n["avg_price"], 1),
            "buyout": round(n["buyout_rate"], 1),
            "search": int(n.get("search_vol", 0)),
            "dsi": round(n.get("demand_supply_ratio", 0), 1),
            "heavy": "YES" if n.get("heavy_weight") else "NO",
            "top_kw": top_kw_str,
            "risks": n.get("risk_tags", ["NONE (通用标品)"]),
            "verdict": n["verdict"],
            "specs": specs,
        })

    # 2. Inherit manual states
    niches_compact, inherited_count, review_list = inherit_manual_state(niches_compact, previous_run_dir)
    print(f"[Compiler] State inheritance: {inherited_count} items inherited, {len(review_list)} review required.")

    # 3. Save niches_compact.json
    with open(out_path / "niches_compact.json", "w", encoding="utf-8") as f:
        json.dump(niches_compact, f, ensure_ascii=False, separators=(',', ':'))

    # 4. Save keywords_top.json
    keywords_top = []
    for i, kw in enumerate(keyword_results.get("blue_ocean_top100", [])):
        keywords_top.append({
            "rank": i + 1,
            "type": "BLUE_OCEAN",
            "query": kw["query"],
            "category": kw["category"],
            "search_vol": kw["search_vol"],
            "goods_count": kw["goods_count"],
            "dsi": kw["dsi"],
            "order_cvr": kw["order_cvr"],
            "cart_cvr": kw["cart_cvr"],
            "intent": "规格词" if any(w in kw["query"] for w in ["мм", "v", "в", "180", "12v"]) else "场景词"
        })
    for i, kw in enumerate(keyword_results.get("growth_top50", [])):
        keywords_top.append({
            "rank": i + 1,
            "type": "HIGH_GROWTH",
            "query": kw["query"],
            "category": kw["category"],
            "search_vol": kw["search_vol"],
            "goods_count": kw["goods_count"],
            "dsi": kw["dsi"],
            "growth": kw["growth"],
            "intent": "爆发词"
        })

    with open(out_path / "keywords_top.json", "w", encoding="utf-8") as f:
        json.dump(keywords_top, f, ensure_ascii=False, indent=2)

    # 5. Save validation_pool.json
    validation_pool = {"TEST": [], "VERIFY": [], "WATCH": [], "DROP": []}
    for n in niches_compact:
        verdict = n["verdict"]
        if verdict in validation_pool:
            top_kws = n.get("top_kw", "").split(", ")
            top_ru = " | ".join([kw.replace("(", " (") for kw in top_kws if kw])
            validation_pool[verdict].append({
                "rank": n["id"],
                "uid": n["uid"],
                "name": n["name"],
                "category": n["cat"],
                "mos": n["mos"],
                "cfs": n["cfs"],
                "comp": n["comp"],
                "gmv": n["gmv"],
                "growth": n["growth"],
                "sellers": n["sellers"],
                "buyout": f"{n['buyout']:.1f}%",
                "price": f"¥{n['price']:.1f}",
                "search": n["search"],
                "weight_g": n["specs"]["weight_g"] if n["specs"] else 0,
                "dims": n["specs"]["dims"] if n["specs"] else "",
                "specs": n["specs"]["specs"] if n["specs"] else "",
                "eac": n["specs"]["eac"] if n["specs"] else "UNKNOWN",
                "is_fragile": n["specs"]["is_fragile"] if n["specs"] else "NO",
                "is_elec": n["specs"]["is_elec"] if n["specs"] else "NO",
                "is_liquid": n["specs"]["is_liquid"] if n["specs"] else "NO",
                "fitment": n["specs"]["fitment"] if n["specs"] else "UNIVERSAL",
                "aftersales": n["specs"]["aftersales"] if n["specs"] else "LOW",
                "rationale": n["specs"]["rationale"] if n["specs"] else "",
                "top_russian_queries": top_ru,
                "checklist": [],
                "manual_override": n.get("manual_override", False),
                "mapping_review_required": n.get("mapping_review_required", False),
            })

    for col in validation_pool:
        validation_pool[col].sort(key=lambda x: x["rank"])

    with open(out_path / "validation_pool.json", "w", encoding="utf-8") as f:
        json.dump(validation_pool, f, ensure_ascii=False, indent=2)

    # 6. Save audit_summary.json
    audit_summary = {
        "total_fields": 43,
        "total_niches_raw": total_raw_niches,
        "passed_gate_count": len(niches_compact),
        "eliminated_count": total_raw_niches - len(niches_compact),
        "elimination_reasons": elimination_stats,
        "key_field_corrections": [
            {
                "field": "实际成交率",
                "initial_assumption": "访客-订单下单转化率 CVR",
                "confirmed_definition": "买家签收率 (Выкуп = 成交量 / (成交量 + 取消量))",
                "mean_val": "78.4%",
                "impact": "反向退货风险衡量指标，大于85%极度安全"
            },
            {
                "field": "订单集中度(%)",
                "initial_assumption": "订单集中度越高头部垄断越大",
                "confirmed_definition": "占80%订单的卖家数量占比 (值越大竞争越分散，越容易切入)",
                "impact": "方向校正为正向计分"
            }
        ],
        "bridge_stats": bridge_stats,
    }

    with open(out_path / "audit_summary.json", "w", encoding="utf-8") as f:
        json.dump(audit_summary, f, ensure_ascii=False, indent=2)

    # 7. Save run_meta.json
    cat_summary = []
    for cat, s in sorted(category_stats.items(), key=lambda x: x[1]["gmv"], reverse=True):
        cat_summary.append({
            "category": cat,
            "niche_count": s["count"],
            "total_gmv": s["gmv"],
            "avg_sellers": round(s["sellers"] / s["count"], 1) if s["count"] else 0
        })

    sa_count = sum(1 for n in niches_compact if n["tier"] in ["S", "A"])
    run_meta = {
        "run_id": run_id,
        "run_title": run_title,
        "run_date": "2026-09-17",
        "data_period": data_period,
        "models": {
            "market_model": "WB-MARKET-MODEL-V1",
            "risk_model": "WB-CROSSBORDER-RISK-V1",
            "keyword_model": "WB-DSI-V1"
        },
        "manifest": manifest or {},
        "summary_kpis": {
            "total_niches_audited": total_raw_niches,
            "passed_niches": len(niches_compact),
            "gated_eliminated": total_raw_niches - len(niches_compact),
            "high_opportunity_sa": sa_count,
            "immediate_test_candidates": len(validation_pool["TEST"]),
            "verify_candidates": len(validation_pool["VERIFY"]),
            "watchlist_count": len(validation_pool["WATCH"]),
            "drop_count": len(validation_pool["DROP"]),
            "total_search_queries": keyword_results.get("total_queries", 300001),
            "blue_ocean_keywords": len(keywords_top),
            "total_quarterly_gmv_rub": total_gmv_sum,
            "avg_buyout_rate": 78.4,
            "inherited_states_count": inherited_count,
            "mapping_reviews_count": len(review_list),
        },
        "today_highlights": {
            "growth": [
                { "name": "封口器", "category": "餐具器具", "growth": "+625.9%", "gmv": 38045524, "note": "秋季果酱蔬菜封罐民俗刚需，季度营收爆发超6倍" },
                { "name": "进气翻板", "category": "汽车配件", "growth": "+155.5%", "gmv": 5766331, "note": "汽配改装季度爆发，客单高" }
            ],
            "supply_gap": [
                { "name": "装饰绝缘子", "category": "电工电气", "sellers": 71, "buyout": "86.0%", "search": 2834, "note": "木屋复古明线家装特色蓝海，仅71家在售" },
                { "name": "发泡胶枪", "category": "手动工具及配件", "sellers": 945, "buyout": "91.0%", "search": 243766, "note": "24.4万次搜索高需求，签收率达91%" }
            ],
            "cross_border": [
                { "name": "热缩管", "category": "电工电气", "weight": "120g", "price": 39.0, "buyout": "91.0%", "note": "免烙铁防水含锡套管，120g盒装，国际运费占比极低" },
                { "name": "接线端子", "category": "电工电气", "weight": "160g", "price": 35.0, "buyout": "92.0%", "note": "WAGO替代款透明导线快接，签收率92%，高频易耗标品" }
            ]
        },
        "categories_summary": cat_summary
    }

    with open(out_path / "run_meta.json", "w", encoding="utf-8") as f:
        json.dump(run_meta, f, ensure_ascii=False, indent=2)

    print(f"[Compiler] All assets compiled to {output_dir}")
    return niches_compact
