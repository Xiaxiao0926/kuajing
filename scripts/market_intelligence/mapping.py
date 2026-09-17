"""
scripts/market_intelligence/mapping.py
Phase 0 & 1: Dual-Table Bridging & Search Demand Penetration
Bridges Niche Name (项目) with Category Champion (类目订单冠军).
"""

def bridge_niches_and_searches(niches, niche_search_agg):
    """
    Evaluates bridging quality between niches and aggregated search data.
    Returns:
      bridge_stats: dict with exact_matches, niche_coverage_pct, search_volume_coverage_pct
    """
    total_niches = len(niches)
    matched_niches = 0
    total_search_vol_in_searches = sum(s["total_search_vol"] for s in niche_search_agg.values())
    covered_search_vol = 0

    for n in niches:
        name = n["niche_name"]
        if name in niche_search_agg:
            matched_niches += 1
            covered_search_vol += niche_search_agg[name]["total_search_vol"]

    niche_cov = (matched_niches / total_niches * 100) if total_niches > 0 else 0
    search_cov = (covered_search_vol / total_search_vol_in_searches * 100) if total_search_vol_in_searches > 0 else 0

    return {
        "exact_matches": matched_niches,
        "niche_coverage_pct": f"{niche_cov:.1f}%",
        "search_volume_coverage_pct": f"{search_cov:.1f}%",
        "total_search_volume": int(covered_search_vol)
    }
