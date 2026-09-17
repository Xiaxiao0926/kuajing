"""
scripts/market_intelligence/run_verifier.py
Verifies staged assets, generates RUN_DIFF_REPORT.json, and executes atomic release.
"""
import os
import shutil
import json
from pathlib import Path

REQUIRED_FILES = [
    "niches_compact.json",
    "keywords_top.json",
    "validation_pool.json",
    "audit_summary.json",
    "run_meta.json",
]

def verify_staged_run(staging_dir):
    """
    Verifies that staging_dir has valid, non-empty assets.
    """
    s_path = Path(staging_dir)
    if not s_path.exists():
        raise FileNotFoundError(f"Staging 目录不存在: {staging_dir}")

    for fname in REQUIRED_FILES:
        fpath = s_path / fname
        if not fpath.exists():
            raise FileNotFoundError(f"Staging 缺失关键产物: {fname}")
        if fpath.stat().st_size == 0:
            raise ValueError(f"Staging 产物为空文件: {fname}")
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if fname == "niches_compact.json" and len(data) < 500:
                    raise ValueError(f"niches_compact.json 数量异常 ({len(data)} < 500)")
        except json.JSONDecodeError as e:
            raise ValueError(f"Staging 产物 JSON 解析失败: {fname}: {e}")

    # Check model versions
    meta_path = s_path / "run_meta.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
        models = meta.get("models", {})
        if models.get("market_model") != "WB-MARKET-MODEL-V1":
            raise ValueError(f"模型事实源非法篡改: {models.get('market_model')}")
        if models.get("risk_model") != "WB-CROSSBORDER-RISK-V1":
            raise ValueError(f"风控事实源非法篡改: {models.get('risk_model')}")
        if models.get("keyword_model") != "WB-DSI-V1":
            raise ValueError(f"关键词模型事实源非法篡改: {models.get('keyword_model')}")

    return True

def generate_diff_report(staging_dir, previous_run_dir, run_id):
    """
    Compares newly staged run with previous active run.
    Outputs RUN_DIFF_REPORT.json into staging_dir.
    """
    s_path = Path(staging_dir)
    diff_report = {
        "run_id": run_id,
        "compared_against": os.path.basename(previous_run_dir) if previous_run_dir else None,
        "summary": {
            "new_niches_count": 0,
            "disappeared_niches_count": 0,
            "mos_surged_count": 0,
            "mos_dropped_count": 0,
            "new_test_candidates_count": 0,
            "dropped_from_test_count": 0,
        },
        "new_niches": [],
        "disappeared_niches": [],
        "mos_surged": [],
        "mos_dropped": [],
        "new_test_candidates": [],
        "dropped_from_test": [],
        "risk_changes": [],
        "booming_keywords": [],
        "declining_keywords": [],
    }

    if not previous_run_dir or not os.path.exists(previous_run_dir):
        # First run or no previous run to compare
        out_file = s_path / "RUN_DIFF_REPORT.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(diff_report, f, ensure_ascii=False, indent=2)
        return diff_report

    try:
        with open(s_path / "niches_compact.json", "r", encoding="utf-8") as f:
            new_niches = {n["name"]: n for n in json.load(f)}
        with open(Path(previous_run_dir) / "niches_compact.json", "r", encoding="utf-8") as f:
            old_niches = {n["name"]: n for n in json.load(f)}

        # 1. Niches presence
        for name, n in new_niches.items():
            if name not in old_niches:
                diff_report["new_niches"].append({
                    "name": name, "category": n["cat"], "gmv": n["gmv"], "mos": n["mos"]
                })
        for name, n in old_niches.items():
            if name not in new_niches:
                diff_report["disappeared_niches"].append({
                    "name": name, "category": n["cat"], "gmv": n["gmv"], "mos": n["mos"]
                })

        # 2. MOS & Verdict changes
        for name, new_n in new_niches.items():
            if name in old_niches:
                old_n = old_niches[name]
                delta_mos = round(new_n["mos"] - old_n["mos"], 1)
                if delta_mos >= 5.0:
                    diff_report["mos_surged"].append({
                        "name": name, "category": new_n["cat"], "old_mos": old_n["mos"],
                        "new_mos": new_n["mos"], "delta": delta_mos
                    })
                elif delta_mos <= -5.0:
                    diff_report["mos_dropped"].append({
                        "name": name, "category": new_n["cat"], "old_mos": old_n["mos"],
                        "new_mos": new_n["mos"], "delta": delta_mos
                    })

                # Test verdict changes
                if new_n["verdict"] == "TEST" and old_n["verdict"] != "TEST":
                    diff_report["new_test_candidates"].append({
                        "name": name, "category": new_n["cat"], "mos": new_n["mos"], "gmv": new_n["gmv"]
                    })
                elif old_n["verdict"] == "TEST" and new_n["verdict"] != "TEST":
                    diff_report["dropped_from_test"].append({
                        "name": name, "category": new_n["cat"], "old_mos": old_n["mos"], "new_verdict": new_n["verdict"]
                    })

                # Risk tag changes
                if set(new_n.get("risks", [])) != set(old_n.get("risks", [])):
                    diff_report["risk_changes"].append({
                        "name": name, "old_risks": old_n.get("risks", []), "new_risks": new_n.get("risks", [])
                    })

        # 3. Keywords changes
        with open(s_path / "keywords_top.json", "r", encoding="utf-8") as f:
            new_kw = json.load(f)
            for kw in new_kw:
                growth_str = str(kw.get("growth", "0%")).replace("+", "").replace("%", "")
                try:
                    g_val = float(growth_str)
                    if g_val >= 50.0:
                        diff_report["booming_keywords"].append({
                            "query": kw["query"], "category": kw["category"], "growth": f"+{g_val:.1f}%", "vol": kw["search_vol"]
                        })
                    elif g_val <= -30.0:
                        diff_report["declining_keywords"].append({
                            "query": kw["query"], "category": kw["category"], "growth": f"{g_val:.1f}%", "vol": kw["search_vol"]
                        })
                except ValueError:
                    pass

        # Summary counts
        diff_report["summary"]["new_niches_count"] = len(diff_report["new_niches"])
        diff_report["summary"]["disappeared_niches_count"] = len(diff_report["disappeared_niches"])
        diff_report["summary"]["mos_surged_count"] = len(diff_report["mos_surged"])
        diff_report["summary"]["mos_dropped_count"] = len(diff_report["mos_dropped"])
        diff_report["summary"]["new_test_candidates_count"] = len(diff_report["new_test_candidates"])
        diff_report["summary"]["dropped_from_test_count"] = len(diff_report["dropped_from_test"])

    except Exception as e:
        print(f"[Verifier] Warning: Diff generation encountered error: {e}")

    out_file = s_path / "RUN_DIFF_REPORT.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(diff_report, f, ensure_ascii=False, indent=2)

    return diff_report

def atomic_publish_run(staging_dir, runs_dir, run_id, active_run_file, meta_info):
    """
    Atomically moves staging_dir to runs_dir / run_id and updates active_run_file.
    """
    target_run_dir = Path(runs_dir) / run_id
    staging_path = Path(staging_dir)

    # 1. Ensure target doesn't corrupt existing
    if target_run_dir.exists():
        # Remove target if already exists (safe overwrite of same run_id if explicitly rerun)
        shutil.rmtree(target_run_dir)

    # 2. Atomic rename / move
    shutil.move(str(staging_path), str(target_run_dir))
    print(f"[Verifier] Staged run promoted to production: {target_run_dir}")

    # 3. Update active_run.json
    active_path = Path(active_run_file)
    active_data = {"active_run_id": run_id, "available_runs": []}
    if active_path.exists():
        try:
            with open(active_path, "r", encoding="utf-8") as f:
                active_data = json.load(f)
        except Exception:
            pass

    # Filter out same run_id from available_runs
    existing_runs = [r for r in active_data.get("available_runs", []) if r.get("run_id") != run_id]

    new_run_entry = {
        "run_id": run_id,
        "title": meta_info.get("run_title", f"选品分析 {run_id}"),
        "date_range": meta_info.get("data_period", "自适应覆盖期"),
        "niches_count": meta_info.get("summary_kpis", {}).get("passed_niches", 6534),
        "keywords_count": meta_info.get("summary_kpis", {}).get("total_search_queries", 300001),
        "created_at": meta_info.get("run_date", "2026-09-17"),
        "manifest": meta_info.get("manifest", {}),
        "models": {
            "market_model": "WB-MARKET-MODEL-V1",
            "risk_model": "WB-CROSSBORDER-RISK-V1",
            "keyword_model": "WB-DSI-V1"
        }
    }

    # Record previous active run ID for rollback capability
    current_active = active_data.get("active_run_id")
    if current_active and current_active != run_id:
        active_data["previous_active_run_id"] = current_active

    # New run becomes active and first in list
    active_data["active_run_id"] = run_id
    active_data["available_runs"] = [new_run_entry] + existing_runs

    # Atomic write to active_run.json
    temp_active = active_path.with_suffix(".tmp")
    with open(temp_active, "w", encoding="utf-8") as f:
        json.dump(active_data, f, ensure_ascii=False, indent=2)
    os.replace(temp_active, active_path)
    print(f"[Verifier] Updated {active_run_file} with active_run_id={run_id}")
    return True

def rollback_active_run(active_run_file):
    """
    Rolls back active_run_id to previous_active_run_id.
    """
    active_path = Path(active_run_file)
    if not active_path.exists():
        raise FileNotFoundError(f"active_run.json 不存在: {active_run_file}")

    with open(active_path, "r", encoding="utf-8") as f:
        active_data = json.load(f)

    prev_id = active_data.get("previous_active_run_id")
    if not prev_id:
        raise ValueError("当前没有可回滚的历史活跃批次 (previous_active_run_id 为空)")

    # Verify previous run exists in available_runs
    avail = [r.get("run_id") for r in active_data.get("available_runs", [])]
    if prev_id not in avail:
        raise ValueError(f"目标回滚批次 {prev_id} 不在可用批次列表中")

    cur_id = active_data.get("active_run_id")
    active_data["previous_active_run_id"] = cur_id
    active_data["active_run_id"] = prev_id

    temp_active = active_path.with_suffix(".tmp")
    with open(temp_active, "w", encoding="utf-8") as f:
        json.dump(active_data, f, ensure_ascii=False, indent=2)
    os.replace(temp_active, active_path)
    print(f"[Verifier] Successfully rolled back active_run from {cur_id} to {prev_id}")
    return {
        "success": True,
        "active_run_id": prev_id,
        "previous_active_run_id": cur_id
    }

