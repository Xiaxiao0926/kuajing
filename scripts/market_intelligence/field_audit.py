"""
scripts/market_intelligence/field_audit.py
Phase 0: Field Dictionary, Schema & Data Quality Audit
Validates incoming WB export files before running calculations.
Detects schema drift and triggers SCHEMA_CHANGE_REVIEW_REQUIRED.
"""
import os
import re
import math
import hashlib
import openpyxl

class SchemaChangeReviewRequired(Exception):
    """Raised when WB modifies export column structure, requiring manual review."""
    pass

def compute_file_sha256(filepath):
    """Calculates SHA256 hex digest of a file in chunks."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()

REQUIRED_NICHE_FIELDS = [
    "类目",
    "项目",
    "实际成交率",
    "卖家",
    "有订单的卖家",
    "有订单的卖家占比",
    "订单集中度（%）",
    "收入, ¥（季度）",
    "均价, ¥",
    "商品",
    "有订单的商品",
    "周转率（天）",
]

REQUIRED_SEARCH_FIELDS = [
    "搜索词",
    "搜索量",
    "类目订单冠军",
    "商品点击",
    "加入购物车",
    "加购转化率",
    "下单商品数量",
    "下单转化率",
    "商品数量",
]

def extract_period_from_filename(filename):
    """Extract 'YYYY-MM-DD 到 YYYY-MM-DD' or 'DD-MM-YYYY 到 DD-MM-YYYY' from filename."""
    m = re.search(r"从\s*([\d\.-]+)\s*到\s*([\d\.-]+)", filename)
    if m:
        start_raw, end_raw = m.group(1), m.group(2)
        def norm(d_str):
            d_clean = d_str.strip().rstrip('.')
            parts = re.split(r"[-.]", d_clean)
            if len(parts) == 3 and len(parts[0]) == 2 and len(parts[2]) == 4:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
            return d_clean
        return f"{norm(start_raw)} ~ {norm(end_raw)}"
    return "未知覆盖期 (请手动指定)"

def audit_input_files(niche_path, search_path):
    """
    Performs Phase 0 structure audit on both files.
    Returns:
        dict with audit summary, row counts, data period, and extracted raw rows.
    Raises:
        SchemaChangeReviewRequired if critical schema drift is detected.
        FileNotFoundError if file does not exist.
        ValueError for invalid file formats.
    """
    if not os.path.exists(niche_path):
        raise FileNotFoundError(f"利基总表文件未找到: {niche_path}")
    if not os.path.exists(search_path):
        raise FileNotFoundError(f"搜索词需求总表文件未找到: {search_path}")

    if not niche_path.lower().endswith((".xlsx", ".xlsm")):
        raise ValueError(f"利基总表格式必须为 .xlsx，当前: {niche_path}")
    if not search_path.lower().endswith((".xlsx", ".xlsm")):
        raise ValueError(f"搜索词需求总表格式必须为 .xlsx，当前: {search_path}")

    # 1. Audit File A: Niches
    wb_a = openpyxl.load_workbook(niche_path, read_only=True, data_only=True)
    sheet_names_a = wb_a.sheetnames
    if "详细信息" not in sheet_names_a:
        wb_a.close()
        raise SchemaChangeReviewRequired(
            f"SCHEMA_CHANGE_REVIEW_REQUIRED: 利基分析文件缺少 '详细信息' 工作表 (现有: {sheet_names_a})"
        )

    ws_a = wb_a["详细信息"]
    header_a = None
    row_count_a = 0
    for i, row in enumerate(ws_a.iter_rows(max_row=2, values_only=True)):
        if i == 0:
            header_a = [str(c or "").strip() for c in row]
            break

    if not header_a or len(header_a) < len(REQUIRED_NICHE_FIELDS):
        wb_a.close()
        raise SchemaChangeReviewRequired(
            f"SCHEMA_CHANGE_REVIEW_REQUIRED: 利基表字段数量异常 (实际: {len(header_a) if header_a else 0} 列)"
        )

    # Check required fields
    missing_a = [f for f in REQUIRED_NICHE_FIELDS if not any(f in h for h in header_a)]
    if missing_a:
        wb_a.close()
        raise SchemaChangeReviewRequired(
            f"SCHEMA_CHANGE_REVIEW_REQUIRED: 利基表缺少必要字段 {missing_a} (表头: {header_a[:10]}...)"
        )

    # 2. Audit File B: Searches
    wb_b = openpyxl.load_workbook(search_path, read_only=True, data_only=True)
    sheet_names_b = wb_b.sheetnames
    if "详细信息" not in sheet_names_b:
        wb_a.close()
        wb_b.close()
        raise SchemaChangeReviewRequired(
            f"SCHEMA_CHANGE_REVIEW_REQUIRED: 搜索请求文件缺少 '详细信息' 工作表 (现有: {sheet_names_b})"
        )

    ws_b = wb_b["详细信息"]
    header_b = None
    for i, row in enumerate(ws_b.iter_rows(max_row=2, values_only=True)):
        if i == 0:
            header_b = [str(c or "").strip() for c in row]
            break

    missing_b = [f for f in REQUIRED_SEARCH_FIELDS if not any(f in h for h in header_b)]
    if missing_b:
        wb_a.close()
        wb_b.close()
        raise SchemaChangeReviewRequired(
            f"SCHEMA_CHANGE_REVIEW_REQUIRED: 搜索请求表缺少必要字段 {missing_b} (表头: {header_b[:10]}...)"
        )

    period_a = extract_period_from_filename(os.path.basename(niche_path))
    period_b = extract_period_from_filename(os.path.basename(search_path))
    data_period = period_a if "未知" not in period_a else period_b

    wb_a.close()
    wb_b.close()

    manifest = {
        "niche_file": {
            "name": os.path.basename(niche_path),
            "sha256": compute_file_sha256(niche_path),
            "size_bytes": os.path.getsize(niche_path),
            "schema_version": "WB-NICHE-SCHEMA-V1",
        },
        "keyword_file": {
            "name": os.path.basename(search_path),
            "sha256": compute_file_sha256(search_path),
            "size_bytes": os.path.getsize(search_path),
            "schema_version": "WB-JAM-SCHEMA-V1",
        },
    }

    return {
        "status": "PASS",
        "header_a": header_a,
        "header_b": header_b,
        "data_period": data_period,
        "niche_fields_count": len(header_a),
        "search_fields_count": len(header_b),
        "manifest": manifest,
    }
