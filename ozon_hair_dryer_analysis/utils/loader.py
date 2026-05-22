import pandas as pd
import numpy as np
import os


def load_data(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    file_name = os.path.basename(file_path).lower()
    df = None
    error_msg = None
    
    if file_name.endswith('.xls') or file_name.endswith('.xlsx'):
        try:
            if file_name.endswith('.xlsx'):
                df = pd.read_excel(file_path, engine='openpyxl')
            else:
                try:
                    df = pd.read_excel(file_path, engine='xlrd')
                except Exception as e:
                    df = pd.read_html(file_path)[0] if hasattr(pd.read_html(file_path), '__len__') else None
        except Exception as e:
            error_msg = str(e)
    
    if df is None:
        try:
            tables = pd.read_html(file_path)
            if tables and len(tables) > 0:
                df = tables[0]
        except Exception as e:
            if not error_msg:
                error_msg = str(e)
    
    if df is None:
        raise ValueError(f"无法解析文件格式: {error_msg or '未知错误'}")
    
    df = clean_data(df)
    df = add_price_category(df)
    df = process_brand(df)
    
    return df


def clean_data(df):
    df = df.copy()
    
    df.columns = df.columns.str.strip()
    
    price_cols = ['价格(₽)', '价格(卢布)', 'Price', 'price', '价格']
    for col in price_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(
                df[col].astype(str).str.replace(r'[^\d.]', '', regex=True),
                errors='coerce'
            )
    
    sales_qty_cols = ['月销量', '销量', '月销售额(₽)', '销售额(₽)', 'Sales', 'sales', 'Quantity', 'quantity']
    for col in sales_qty_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(
                df[col].astype(str).str.replace(r'[^\d.]', '', regex=True),
                errors='coerce'
            )
    
    growth_cols = ['月销量环比(%)', '增长率', '环比', 'Growth', 'growth']
    for col in growth_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace('%', '').str.strip()
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df


def add_price_category(df):
    df = df.copy()
    
    price_col = None
    for col in ['价格(₽)', '价格(卢布)', 'Price', 'price', '价格']:
        if col in df.columns:
            price_col = col
            break
    
    if price_col:
        conditions = [
            df[price_col] < 2000,
            (df[price_col] >= 2000) & (df[price_col] <= 10000),
            df[price_col] > 10000
        ]
        choices = ['性价比', '中端', '高端']
        df['价格区间'] = np.select(conditions, choices, default='未知')
    else:
        df['价格区间'] = '未知'
    
    return df


def process_brand(df):
    df = df.copy()
    
    brand_cols = ['品牌', 'Brand', 'brand', 'manufacturer', 'Manufacturer']
    brand_col = None
    for col in brand_cols:
        if col in df.columns:
            brand_col = col
            break
    
    if brand_col:
        df[brand_col] = df[brand_col].replace(r'^\s*/\s*$', 'Unbranded/Generic', regex=True)
        df[brand_col] = df[brand_col].fillna('Unbranded/Generic')
        df[brand_col] = df[brand_col].replace('', 'Unbranded/Generic')
    else:
        df['品牌'] = 'Unbranded/Generic'
    
    return df


if __name__ == "__main__":
    try:
        test_file = "热销产品2026-05-06.xls"
        df = load_data(test_file)
        print(f"✅ 成功加载数据: {len(df)} 行, {len(df.columns)} 列")
        print(f"\n列名: {df.columns.tolist()}")
        print(f"\n数据类型:\n{df.dtypes}")
        print(f"\n前5行:\n{df.head()}")
    except Exception as e:
        print(f"❌ 加载失败: {str(e)}")
