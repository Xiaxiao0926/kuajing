# -*- coding: utf-8 -*-
"""数据侦察：解剖 Ozon 热销 Excel 的列名、标题样本、单位模式分布"""
import re, sys, io
import pandas as pd
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DATA = Path(r"D:\ozon\ozon-react\public\data")
FILES = [
    "热销产品2026-05-06.xlsx", "热销产品2026-05-07.xlsx",
    "手套热销产品2026-05-12.xlsx", "发膜热销品2026-05-08.xlsx",
    "护发喷雾热销产品2026-05-08.xlsx", "枕头热销产品2026-05-08.xlsx",
    "矫形枕热销产品2026-05-07.xlsx",
]

# 单位模式统计（俄文+中文常见）
UNIT_PATTERNS = {
    'шт': r'\d\s*шт|\bшт\b', 'пар': r'\d\s*пар|\bпар\b', 'мл': r'\d\s*мл|\bмл\b',
    'л(升)': r'\d\s*л\b|\bл\b', 'кг': r'\d\s*кг|\bкг\b', 'г(克)': r'\d\s*г\b|\bг\b',
    'см': r'\d\s*см|\bсм\b', 'м(米)': r'\d\s*м\b|\bм\b',
    '只/个': r'\d\s*只|\d\s*个|\d\s*支|\d\s*双', 'set/набор': r'набор|\bset\b',
    'двух/双层': r'двух|2-?х\s*слой', '3D': r'\b3\s*D\b|\b3D\b',
}

for fname in FILES:
    p = DATA / fname
    if not p.exists():
        print(f"== {fname}: 不存在"); continue
    try:
        df = pd.read_excel(p)
    except Exception as e:
        print(f"== {fname}: 读取失败 {e}"); continue
    print(f"\n{'='*80}\n== {fname}  行数={len(df)}")
    print("列名:", list(df.columns))
    # 找标题列（名称/название/name/产品）
    title_col = next((c for c in df.columns if re.search(r'名称|назван|name|产品名|标题', str(c), re.I)), None)
    # 找价格/销量/销售额列
    cols_str = ' | '.join(str(c) for c in df.columns)
    if title_col is not None:
        titles = df[title_col].dropna().astype(str)
        print(f"\n标题列[{title_col}] 样本(前12):")
        for t in titles.head(12):
            print(f"   {t[:110]}")
        # 单位模式分布
        print("\n单位模式分布:")
        for unit, pat in UNIT_PATTERNS.items():
            n = titles.str.contains(pat, regex=True).sum()
            if n:
                print(f"   {unit:12s} {n:5d}  ({n/len(titles)*100:.1f}%)")
        # 无任何数量+单位模式的标题数
        has_any = titles.str.contains(r'\d', regex=True)
        print(f"   含数字标题: {has_any.sum()}/{len(titles)} ({has_any.mean()*100:.0f}%)")
    # 关键数值列存在性
    for key in ['价格', '销量', '销售额', 'GMV', 'price', 'sales']:
        hits = [c for c in df.columns if key.lower() in str(c).lower()]
        if hits:
            print(f"含'{key}'的列: {hits}")
