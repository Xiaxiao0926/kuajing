"""
scripts/compile_market_intelligence_assets.py
Compiles WB market analysis CSV deliverables into lightweight, pre-indexed JSON bundles
for the /kuajing React Market Intelligence dashboard.
Target directory: ozon-react/public/data/market_intelligence/runs/RUN-20260917-001/
"""
import os
import sys
import json
import csv
from pathlib import Path

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = Path(os.environ.get("WB_ANALYSIS_OUTPUT_DIR", r"D:\FYZSXNB\市场分析wb\analysis_output"))
TARGET_DIR = REPO_ROOT / "ozon-react" / "public" / "data" / "market_intelligence"
RUN_ID = "RUN-20260917-001"
RUN_DIR = TARGET_DIR / "runs" / RUN_ID

RUN_DIR.mkdir(parents=True, exist_ok=True)
print(f"[Compiler] Target run directory: {RUN_DIR}")

# 1. Load Enhanced Risks Map
enhanced_risks = {}
enhanced_csv = SRC_DIR / "FULL_TOP100_enhanced_with_risks.csv"
if enhanced_csv.exists():
    with open(enhanced_csv, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            enhanced_risks[row["niche_name"]] = row

# 2. Load Phase 4 Product Validation (Top 15)
validation_db = {}
phase4_csv = SRC_DIR / "PHASE4_PRODUCT_VALIDATION_TOP15.csv"
if phase4_csv.exists():
    with open(phase4_csv, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            validation_db[row["niche_name_cn"]] = row

# 3. Load Immediate Test Top 30
immediate_30 = set()
immediate_csv = SRC_DIR / "IMMEDIATE_CROSS_BORDER_TEST_TOP30.csv"
if immediate_csv.exists():
    with open(immediate_csv, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            immediate_30.add(row["niche_name"])

# 4. Load Watchlist
watchlist_items = set()
watchlist_csv = SRC_DIR / "WATCHLIST_HIGH_OPPORTUNITY.csv"
if watchlist_csv.exists():
    with open(watchlist_csv, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            watchlist_items.add(row.get("niche_name", ""))

# 5. Process and compile all 6,534 Niches into compact JSON
niches_compact = []
all_niches_csv = SRC_DIR / "FULL_all_niches_scored.csv"
total_gmv_sum = 0
category_stats = {}

with open(all_niches_csv, "r", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        name = row["niche_name"]
        cat = row["category"]
        
        # Clean values
        try:
            rev = int(float(row["revenue"]))
        except (ValueError, TypeError):
            rev = 0
        total_gmv_sum += rev
        
        try:
            mos = round(float(row["market_opportunity_score"]), 1)
        except (ValueError, TypeError):
            mos = 0.0
            
        try:
            cfs = round(float(row["feasibility_score"]), 1)
        except (ValueError, TypeError):
            cfs = 0.0
            
        try:
            comp = round(float(row["composite_index"]), 1)
        except (ValueError, TypeError):
            comp = 0.0
            
        try:
            price = round(float(row["avg_price"]), 1)
        except (ValueError, TypeError):
            price = 0.0
            
        buyout_str = row["buyout_rate"].replace("%", "").strip()
        try:
            buyout = round(float(buyout_str), 1)
        except (ValueError, TypeError):
            buyout = 0.0
            
        growth_str = row["revenue_growth"].replace("%", "").strip()
        try:
            growth_num = round(float(growth_str), 1)
        except (ValueError, TypeError):
            growth_num = 0.0
            
        try:
            sellers = int(float(row["sellers_active"]))
        except (ValueError, TypeError):
            sellers = 0
            
        try:
            search_vol = int(float(row["search_vol"]))
        except (ValueError, TypeError):
            search_vol = 0
            
        try:
            dsi = round(float(row["demand_supply_ratio"]), 1)
        except (ValueError, TypeError):
            dsi = 0.0

        # Tier
        tier_raw = row.get("tier", "C")
        if "S" in tier_raw:
            tier = "S"
        elif "A" in tier_raw:
            tier = "A"
        elif "B" in tier_raw:
            tier = "B"
        else:
            tier = "C"

        # Verdict
        if name in validation_db:
            verdict = validation_db[name]["status_verdict"]
        elif name in immediate_30:
            verdict = "TEST"
        elif name in watchlist_items:
            verdict = "WATCH"
        else:
            verdict = "UNASSIGNED"

        # Risk tags
        if name in enhanced_risks:
            r_tags = [t.strip() for t in enhanced_risks[name]["risk_tags"].split(",") if t.strip()]
        elif row.get("heavy_weight") == "YES":
            r_tags = ["HEAVY"]
        else:
            r_tags = ["NO_KNOWN_RISK"]

        # Category aggregates
        if cat not in category_stats:
            category_stats[cat] = {"count": 0, "gmv": 0, "sellers": 0}
        category_stats[cat]["count"] += 1
        category_stats[cat]["gmv"] += rev
        category_stats[cat]["sellers"] += sellers

        # Details if present in validation or enhanced
        enh = enhanced_risks.get(name, {})
        val = validation_db.get(name, {})

        niches_compact.append({
            "id": int(row["rank"]),
            "name": name,
            "cat": cat,
            "tier": tier,
            "mos": mos,
            "cfs": cfs,
            "comp": comp,
            "gmv": rev,
            "gmv_prev": int(float(str(enh.get("revenue_prev_gmv", 0)).replace(",", ""))) if enh else 0,
            "delta": enh.get("gmv_delta", "0") if enh else "0",
            "growth": row["revenue_growth"],
            "growth_num": growth_num,
            "sellers": sellers,
            "price": price,
            "buyout": buyout,
            "search": search_vol,
            "dsi": dsi,
            "heavy": row.get("heavy_weight", "NO"),
            "top_kw": row.get("top_keywords", ""),
            "risks": r_tags,
            "verdict": verdict,
            "specs": {
                "def": val.get("precise_product_def", ""),
                "specs": val.get("core_specs_variants", ""),
                "weight_g": int(val.get("typical_weight_g", 0)) if val else 0,
                "dims": val.get("typical_dimensions_cm", ""),
                "is_fragile": val.get("is_fragile", "NO"),
                "is_elec": val.get("is_electrical", "NO"),
                "is_liquid": val.get("is_liquid", "NO"),
                "eac": val.get("eac_certification_status", "UNKNOWN"),
                "fitment": val.get("model_fitment_risk", "UNIVERSAL"),
                "aftersales": val.get("aftersales_complexity", "LOW"),
                "rationale": val.get("verdict_rationale", ""),
            } if val else None
        })

print(f"[Compiler] Processed {len(niches_compact)} niches.")

# 6. Save niches_compact.json
niches_file = RUN_DIR / "niches_compact.json"
with open(niches_file, "w", encoding="utf-8") as f:
    json.dump(niches_compact, f, ensure_ascii=False, separators=(',', ':'))
print(f"[Compiler] Saved {niches_file} ({niches_file.stat().st_size / 1024:.1f} KB)")

# 7. Compile Category Executive Summary
cat_summary = []
cat_csv = SRC_DIR / "FULL_category_executive_summary.csv"
if cat_csv.exists():
    with open(cat_csv, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            cat_summary.append(row)
else:
    for cat, s in sorted(category_stats.items(), key=lambda x: x[1]["gmv"], reverse=True):
        cat_summary.append({
            "category": cat,
            "niche_count": s["count"],
            "total_gmv": s["gmv"],
            "avg_sellers": round(s["sellers"] / s["count"], 1) if s["count"] else 0
        })

# 8. Compile Keywords Top Opportunity List
keywords_top = []
kw_blue_csv = SRC_DIR / "FULL_blue_ocean_keywords_top100.csv"
if kw_blue_csv.exists():
    with open(kw_blue_csv, "r", encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.DictReader(f)):
            keywords_top.append({
                "rank": i + 1,
                "type": "BLUE_OCEAN",
                "query": row.get("query", row.get("keyword", "")),
                "category": row.get("category", row.get("top_category", "")),
                "search_vol": int(float(row.get("search_vol", row.get("searches", 0)))),
                "goods_count": int(float(row.get("goods_count", row.get("goods", 0)))),
                "dsi": round(float(row.get("demand_supply_ratio", row.get("dsi", 0))), 1),
                "order_cvr": row.get("order_cvr", row.get("order_rate", "0%")),
                "cart_cvr": row.get("cart_cvr", row.get("cart_rate", "0%")),
                "intent": "规格词" if any(w in row.get("query", "") for w in ["мм", "v", "в", "180", "12v"]) else "场景词"
            })

kw_growth_csv = SRC_DIR / "FULL_growth_keywords_top50.csv"
if kw_growth_csv.exists():
    with open(kw_growth_csv, "r", encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.DictReader(f)):
            keywords_top.append({
                "rank": i + 1,
                "type": "HIGH_GROWTH",
                "query": row.get("query", row.get("keyword", "")),
                "category": row.get("category", row.get("top_category", "")),
                "search_vol": int(float(row.get("search_vol", row.get("searches", 0)))),
                "goods_count": int(float(row.get("goods_count", row.get("goods", 0)))),
                "dsi": round(float(row.get("demand_supply_ratio", row.get("dsi", 0))), 1),
                "growth": row.get("growth_rate_pct", row.get("growth", "0%")),
                "intent": "爆发词"
            })

kw_file = RUN_DIR / "keywords_top.json"
with open(kw_file, "w", encoding="utf-8") as f:
    json.dump(keywords_top, f, ensure_ascii=False, indent=2)
print(f"[Compiler] Saved {kw_file} ({len(keywords_top)} keywords, {kw_file.stat().st_size / 1024:.1f} KB)")

# 9. Validation Pool default items (categorized by status)
validation_pool = {
    "TEST": [],
    "VERIFY": [],
    "WATCH": [],
    "DROP": []
}

for name, val in validation_db.items():
    verdict = val["status_verdict"]
    item = {
        "rank": int(val["rank"]),
        "name": name,
        "category": val["category"],
        "mos": float(val["market_opportunity_score"]),
        "cfs": float(val["preliminary_feasibility_score"]),
        "comp": float(val["composite_index"]),
        "gmv": int(float(val["revenue_current_gmv"])),
        "growth": val["growth_rate_pct"],
        "sellers": int(val["sellers_active"]),
        "buyout": val["buyout_rate"],
        "price": val["avg_price_wb"],
        "search": int(float(val["search_vol"])),
        "weight_g": int(val["typical_weight_g"]),
        "dims": val["typical_dimensions_cm"],
        "specs": val["core_specs_variants"],
        "eac": val["eac_certification_status"],
        "is_fragile": val["is_fragile"],
        "is_elec": val["is_electrical"],
        "is_liquid": val["is_liquid"],
        "fitment": val["model_fitment_risk"],
        "aftersales": val["aftersales_complexity"],
        "rationale": val["verdict_rationale"],
        "top_russian_queries": val["top3_russian_queries"],
        "checklist": []
    }
    if verdict in validation_pool:
        validation_pool[verdict].append(item)

# Sort each column by rank
for col in validation_pool:
    validation_pool[col].sort(key=lambda x: x["rank"])

val_file = RUN_DIR / "validation_pool.json"
with open(val_file, "w", encoding="utf-8") as f:
    json.dump(validation_pool, f, ensure_ascii=False, indent=2)
print(f"[Compiler] Saved {val_file}")

# 10. Audit Summary JSON
audit_summary = {
    "total_fields": 43,
    "total_niches_raw": 7630,
    "passed_gate_count": 6534,
    "eliminated_count": 1096,
    "elimination_reasons": {
        "dead_niche_zero_revenue": 574,
        "micro_niche_gmv_under_50k": 382,
        "single_seller_monopoly": 140
    },
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
    "bridge_stats": {
        "exact_matches": 5209,
        "niche_coverage_pct": "68.4%",
        "search_volume_coverage_pct": "99.6%"
    }
}

audit_file = RUN_DIR / "audit_summary.json"
with open(audit_file, "w", encoding="utf-8") as f:
    json.dump(audit_summary, f, ensure_ascii=False, indent=2)
print(f"[Compiler] Saved {audit_file}")

# 11. Run Metadata
sa_count = sum(1 for n in niches_compact if n["tier"] in ["S", "A"])

run_meta = {
    "run_id": RUN_ID,
    "run_title": "2026 Q3 俄罗斯市场全量选品决策基线",
    "run_date": "2026-09-17",
    "data_period": "2026-06-18 ~ 2026-09-15",
    "models": {
        "market_model": "WB-MARKET-MODEL-V1",
        "risk_model": "WB-CROSSBORDER-RISK-V1",
        "keyword_model": "WB-DSI-V1"
    },
    "summary_kpis": {
        "total_niches_audited": 7630,
        "passed_niches": len(niches_compact),
        "gated_eliminated": 1096,
        "high_opportunity_sa": sa_count,
        "immediate_test_candidates": len(validation_pool["TEST"]),
        "verify_candidates": len(validation_pool["VERIFY"]),
        "watchlist_count": len(validation_pool["WATCH"]) + len(watchlist_items),
        "drop_count": len(validation_pool["DROP"]),
        "total_search_queries": 300001,
        "blue_ocean_keywords": len(keywords_top),
        "total_quarterly_gmv_rub": total_gmv_sum,
        "avg_buyout_rate": 78.4
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

meta_file = RUN_DIR / "run_meta.json"
with open(meta_file, "w", encoding="utf-8") as f:
    json.dump(run_meta, f, ensure_ascii=False, indent=2)
print(f"[Compiler] Saved {meta_file}")

# 12. Active Run and Index
active_run_doc = {
    "active_run_id": RUN_ID,
    "available_runs": [
        {
            "run_id": RUN_ID,
            "title": "2026 Q3 俄罗斯市场全量选品决策基线",
            "date_range": "2026-06-18 ~ 2026-09-15",
            "niches_count": len(niches_compact),
            "keywords_count": 300001,
            "created_at": "2026-09-17"
        }
    ]
}

active_run_file = TARGET_DIR / "active_run.json"
with open(active_run_file, "w", encoding="utf-8") as f:
    json.dump(active_run_doc, f, ensure_ascii=False, indent=2)
print(f"[Compiler] Saved {active_run_file}")

print("\n[Compiler] All production JSON assets compiled successfully!")
