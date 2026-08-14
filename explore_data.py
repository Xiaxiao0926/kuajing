import pandas as pd
from pathlib import Path

# 查看报价表
quote_folder = Path(r"E:\Desktop\坪优报价分析\报价表")
quote_files = list(quote_folder.glob("*.xlsx"))

print("=== 报价表文件 ===")
for file in quote_files:
    print(f"\n{file.name}:")
    xl = pd.ExcelFile(file)
    for sheet_name in xl.sheet_names:
        print(f"  - Sheet: {sheet_name}")
        df = pd.read_excel(file, sheet_name=sheet_name)
        print(f"    列名: {list(df.columns)}")
        print(f"    数据行数: {len(df)}")
        print(f"    前3行数据:")
        print(df.head(3).to_string())

# 查看一个市场价CSV文件
market_folder = Path(r"E:\Desktop\坪优报价分析\市场价")
csv_files = list(market_folder.glob("*.csv"))[:1]
print("\n\n=== 市场价CSV文件示例 ===")
for file in csv_files:
    print(f"\n{file.name}:")
    df = pd.read_csv(file)
    print(f"  列名: {list(df.columns)}")
    print(f"  数据行数: {len(df)}")
    print(f"  前3行数据:")
    print(df.head(3).to_string())
