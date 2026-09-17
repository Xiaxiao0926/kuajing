"""
scripts/market_intelligence/pipeline.py
KUAIJING-WB-MARKET-INTELLIGENCE-V1.1
Master Pipeline Orchestrator & Atomic Transaction Controller
"""
import os
import sys
import argparse
import datetime
import json
import traceback
from pathlib import Path

# Ensure UTF-8 output
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add parent directory to path so imports work
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(SCRIPT_DIR.parent))

from market_intelligence.field_audit import (
    audit_input_files, SchemaChangeReviewRequired
)
from market_intelligence.niche_scoring import (
    load_and_gate_niches, score_niches
)
from market_intelligence.keyword_analysis import (
    process_search_queries
)
from market_intelligence.mapping import (
    bridge_niches_and_searches
)
from market_intelligence.risk_engine import (
    calc_feasibility, assign_risk_tags
)
from market_intelligence.phase4_validation import (
    classify_niche_verdict
)
from market_intelligence.asset_compiler import (
    compile_run_assets
)
from market_intelligence.run_verifier import (
    verify_staged_run, generate_diff_report, atomic_publish_run
)

def update_status(status_file, state, progress, message, error=None):
    """Writes progress state to status.json for live polling."""
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [{state}] ({progress}%) {message}")
    if not status_file:
        return
    try:
        data = {
            "status": state,
            "progress": progress,
            "step": message,
            "updated_at": datetime.datetime.now().isoformat(),
            "error": error
        }
        status_path = Path(status_file)
        status_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = status_path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, status_path)
    except Exception as err:
        print(f"Status file write error: {err}")

def get_default_run_id(runs_dir):
    today_str = datetime.date.today().strftime("%Y%m%d")
    idx = 1
    while True:
        candidate = f"RUN-{today_str}-{idx:03d}"
        if not (Path(runs_dir) / candidate).exists():
            return candidate
        idx += 1

def run_pipeline(
    niche_file,
    search_file,
    run_id=None,
    run_title=None,
    runs_dir=None,
    active_run_file=None,
    status_file=None,
    dry_run=False
):
    if not runs_dir:
        runs_dir = REPO_ROOT / "ozon-react" / "public" / "data" / "market_intelligence" / "runs"
    if not active_run_file:
        active_run_file = REPO_ROOT / "ozon-react" / "public" / "data" / "market_intelligence" / "active_run.json"
    if not run_id:
        run_id = get_default_run_id(runs_dir)
    if not run_title:
        run_title = f"{datetime.date.today().year} 俄罗斯市场选品决策分析 ({run_id})"

    staging_dir = Path(runs_dir) / "_staging" / run_id
    staging_dir.mkdir(parents=True, exist_ok=True)

    # Determine previous active run directory for diffing and state inheritance
    previous_run_dir = None
    if Path(active_run_file).exists():
        try:
            with open(active_run_file, "r", encoding="utf-8") as f:
                active_meta = json.load(f)
                prev_id = active_meta.get("active_run_id")
                if prev_id and (Path(runs_dir) / prev_id).exists():
                    previous_run_dir = str(Path(runs_dir) / prev_id)
        except Exception:
            pass

    try:
        # [1] UPLOADED
        update_status(status_file, "UPLOADED", 5, f"文件已接收: {os.path.basename(niche_file)} 与 {os.path.basename(search_file)}")

        # [2] VALIDATING & [3] FIELD_AUDIT
        update_status(status_file, "VALIDATING", 10, "正在执行文件格式与工作表校验...")
        audit_res = audit_input_files(niche_file, search_file)
        data_period = audit_res["data_period"]

        update_status(status_file, "FIELD_AUDIT", 18, f"字段语义与空值率审计完成，覆盖期: {data_period}")

        # [4] ANALYZING_NICHES
        update_status(status_file, "ANALYZING_NICHES", 30, "执行 Hard Gate 门禁过滤与利基数据清洗...")
        gated_niches, elim_reasons, total_raw_niches = load_and_gate_niches(niche_file)
        print(f"[Pipeline] Hard Gate: {len(gated_niches)} / {total_raw_niches} passed.")

        # [5] ANALYZING_KEYWORDS
        update_status(status_file, "ANALYZING_KEYWORDS", 45, "处理全量搜索词需求漏斗、意图聚类与 DSI 计算...")
        kw_res = process_search_queries(
            search_file,
            progress_cb=lambda count: update_status(status_file, "ANALYZING_KEYWORDS", min(60, 45 + count // 20000), f"已索引 {count:,} 条搜索词...")
        )
        niche_search_agg = kw_res["niche_search_agg"]

        # [6] CROSS_MAPPING
        update_status(status_file, "CROSS_MAPPING", 65, "执行双表项目↔类目冠军锚点穿透与重量检测...")
        bridge_stats = bridge_niches_and_searches(gated_niches, niche_search_agg)

        # Score niches using WB-MARKET-MODEL-V1
        scored_niches = score_niches(gated_niches, niche_search_agg)

        # [7] RISK_CLASSIFICATION
        update_status(status_file, "RISK_CLASSIFICATION", 75, "判定 10 项硬核跨境风险标签与 Preliminary Feasibility Score...")
        for n in scored_niches:
            cfs = calc_feasibility(n)
            n["feasibility_score"] = cfs
            risks = assign_risk_tags(n)
            n["risk_tags"] = risks
            n["verdict"] = classify_niche_verdict(n, risks, cfs)

        # Sort and assign ranks
        scored_niches.sort(key=lambda x: round(x["market_opportunity_score"] * 0.55 + x["feasibility_score"] * 0.45, 1), reverse=True)
        for i, n in enumerate(scored_niches):
            n["rank"] = i + 1

        # [8] COMPILING_ASSETS
        update_status(status_file, "COMPILING_ASSETS", 85, "编译前端 JSON 资产包并执行人工状态无损继承...")
        compile_run_assets(
            output_dir=str(staging_dir),
            run_id=run_id,
            run_title=run_title,
            data_period=data_period,
            scored_niches=scored_niches,
            keyword_results=kw_res,
            bridge_stats=bridge_stats,
            elimination_stats=elim_reasons,
            total_raw_niches=total_raw_niches,
            previous_run_dir=previous_run_dir,
            manifest=audit_res.get("manifest")
        )

        # [9] VERIFYING
        update_status(status_file, "VERIFYING", 92, "校验 Staging 产物完整性并生成周期差异报告...")
        verify_staged_run(str(staging_dir))
        diff_report = generate_diff_report(str(staging_dir), previous_run_dir, run_id)
        print(f"[Pipeline] Diff report: {diff_report['summary']}")

        if dry_run:
            update_status(status_file, "COMPLETED", 100, f"[DRY_RUN] 预审完成，产物保留在 staging: {staging_dir}")
            return {"run_id": run_id, "dry_run": True, "staging_dir": str(staging_dir)}

        # [10] COMPLETED: Atomic Release
        update_status(status_file, "VERIFYING", 98, "执行原子发布并更新 active_run.json...")
        with open(staging_dir / "run_meta.json", "r", encoding="utf-8") as f:
            meta_info = json.load(f)

        atomic_publish_run(
            staging_dir=str(staging_dir),
            runs_dir=str(runs_dir),
            run_id=run_id,
            active_run_file=str(active_run_file),
            meta_info=meta_info
        )

        update_status(status_file, "COMPLETED", 100, f"新批次 {run_id} 已成功发布并激活！")
        return {"run_id": run_id, "status": "COMPLETED", "diff": diff_report["summary"]}

    except SchemaChangeReviewRequired as err:
        err_msg = str(err)
        print(f"[Pipeline] Schema error: {err_msg}")
        update_status(status_file, "SCHEMA_CHANGE_REVIEW_REQUIRED", 15, err_msg, error=err_msg)
        with open(staging_dir / "error.log", "w", encoding="utf-8") as f:
            f.write(err_msg + "\n" + traceback.format_exc())
        return {"run_id": run_id, "status": "SCHEMA_CHANGE_REVIEW_REQUIRED", "error": err_msg}

    except Exception as err:
        err_msg = str(err)
        print(f"[Pipeline] Fatal error: {err_msg}")
        traceback.print_exc()
        update_status(status_file, "FAILED", 0, f"分析管道执行失败: {err_msg}", error=err_msg)
        with open(staging_dir / "error.log", "w", encoding="utf-8") as f:
            f.write(err_msg + "\n" + traceback.format_exc())
        return {"run_id": run_id, "status": "FAILED", "error": err_msg}

def main():
    parser = argparse.ArgumentParser(description="WB Market Intelligence Data Pipeline V1.1")
    parser.add_argument("--niche-file", required=True, help="Path to WB niche analysis (.xlsx)")
    parser.add_argument("--search-file", required=True, help="Path to WB Jam search queries (.xlsx)")
    parser.add_argument("--run-id", default=None, help="Optional Run ID, e.g. RUN-20261217-001")
    parser.add_argument("--run-title", default=None, help="Optional Run Title")
    parser.add_argument("--runs-dir", default=None, help="Directory containing published runs")
    parser.add_argument("--active-run-file", default=None, help="Path to active_run.json")
    parser.add_argument("--status-file", default=None, help="Path to status.json for live progress reporting")
    parser.add_argument("--dry-run", action="store_true", help="Stage assets without atomic production publish")

    args = parser.parse_args()
    res = run_pipeline(
        niche_file=args.niche_file,
        search_file=args.search_file,
        run_id=args.run_id,
        run_title=args.run_title,
        runs_dir=args.runs_dir,
        active_run_file=args.active_run_file,
        status_file=args.status_file,
        dry_run=args.dry_run
    )
    if res.get("status") in ["FAILED", "SCHEMA_CHANGE_REVIEW_REQUIRED"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
