import pandas as pd
import numpy as np
import os
import re
from pathlib import Path

def read_supplier_quotes(folder_path):
    """读取供应商报价表"""
    quote_files = list(Path(folder_path).glob("*.xlsx"))
    quote_data = []
    
    for file in quote_files:
        try:
            # 读取Excel文件的所有sheet
            xl = pd.ExcelFile(file)
            for sheet_name in xl.sheet_names:
                df = pd.read_excel(file, sheet_name=sheet_name)
                if not df.empty:
                    df['source_file'] = file.name
                    df['source_sheet'] = sheet_name
                    quote_data.append(df)
        except Exception as e:
            print(f"Error reading {file}: {e}")
    
    if quote_data:
        return pd.concat(quote_data, ignore_index=True)
    return pd.DataFrame()

def read_market_prices(folder_path):
    """读取市场价CSV文件"""
    csv_files = list(Path(folder_path).glob("*.csv"))
    market_data = []
    
    for file in csv_files:
        try:
            df = pd.read_csv(file)
            if not df.empty:
                df['source_file'] = file.name
                market_data.append(df)
        except Exception as e:
            print(f"Error reading {file}: {e}")
    
    if market_data:
        return pd.concat(market_data, ignore_index=True)
    return pd.DataFrame()

def extract_product_name(title):
    """从标题中提取产品名称"""
    if pd.isna(title):
        return ""
    title = str(title)
    # 简单的产品名称提取逻辑
    keywords = ['植村秀', 'Shu-uemura', '卸妆油', '琥珀', '臻萃', '洁颜油', '黄金', '柚子', '樱花', '绿茶', '水晶']
    name_parts = []
    for keyword in keywords:
        if keyword in title:
            name_parts.append(keyword)
    # 提取容量信息
    capacity_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ)', title)
    if capacity_match:
        name_parts.append(capacity_match.group(0))
    return ' '.join(name_parts) if name_parts else title[:50]

def extract_price(row):
    """从市场价数据中提取价格"""
    # 尝试多个可能的价格列
    price_cols = ['priceInt', 'priceFloat', '价格', 'Price', 'price']
    for col in price_cols:
        if col in row:
            val = row[col]
            if pd.notna(val) and val != '':
                try:
                    return float(val)
                except:
                    pass
    return np.nan

def analyze_prices(supplier_df, market_df):
    """分析价格优势"""
    results = []
    
    # 预处理市场价数据
    if 'title--ASSt27UY' in market_df.columns:
        market_df['product_name'] = market_df['title--ASSt27UY'].apply(extract_product_name)
    elif 'title' in market_df.columns:
        market_df['product_name'] = market_df['title'].apply(extract_product_name)
    else:
        # 如果没有标题列，尝试使用第一列
        market_df['product_name'] = market_df.iloc[:, 0].apply(extract_product_name)
    
    market_df['market_price'] = market_df.apply(extract_price, axis=1)
    
    # 遍历供应商报价
    for idx, supplier_row in supplier_df.iterrows():
        # 尝试找到产品名称
        supplier_name = ""
        supplier_price = np.nan
        
        # 遍历供应商数据的所有列
        for col in supplier_df.columns:
            val = supplier_row[col]
            if pd.notna(val):
                str_val = str(val)
                # 尝试提取价格
                if any(keyword in col.lower() for keyword in ['price', '价格', '报价', 'cost']):
                    try:
                        supplier_price = float(str_val.replace(',', ''))
                    except:
                        pass
                # 尝试提取产品名称
                if not supplier_name and len(str_val) > 2:
                    supplier_name = extract_product_name(str_val)
        
        if not supplier_name:
            supplier_name = f"Product_{idx}"
        
        # 在市场价中匹配
        matched_market = market_df[market_df['product_name'].str.contains('|'.join(supplier_name.split()), na=False)]
        
        if len(matched_market) > 0:
            avg_market_price = matched_market['market_price'].mean()
            min_market_price = matched_market['market_price'].min()
            max_market_price = matched_market['market_price'].max()
            
            # 计算优势
            if pd.notna(supplier_price) and pd.notna(avg_market_price) and avg_market_price > 0:
                price_diff = avg_market_price - supplier_price
                price_ratio = supplier_price / avg_market_price
                is_advantage = supplier_price < avg_market_price
                advantage_percent = ((avg_market_price - supplier_price) / avg_market_price) * 100 if avg_market_price > 0 else 0
            else:
                price_diff = np.nan
                price_ratio = np.nan
                is_advantage = np.nan
                advantage_percent = np.nan
            
            results.append({
                'supplier_product': supplier_name,
                'supplier_price': supplier_price,
                'matched_market_count': len(matched_market),
                'avg_market_price': avg_market_price,
                'min_market_price': min_market_price,
                'max_market_price': max_market_price,
                'price_diff': price_diff,
                'price_ratio': price_ratio,
                'is_advantage': is_advantage,
                'advantage_percent': advantage_percent,
                'source_supplier_file': supplier_row.get('source_file', ''),
                'source_supplier_sheet': supplier_row.get('source_sheet', '')
            })
    
    return pd.DataFrame(results)

def main():
    base_path = Path(r"E:\Desktop\坪优报价分析")
    quote_folder = base_path / "报价表"
    market_folder = base_path / "市场价"
    output_folder = base_path / "分析结果"
    
    output_folder.mkdir(exist_ok=True)
    
    print("正在读取供应商报价表...")
    supplier_df = read_supplier_quotes(quote_folder)
    print(f"供应商数据形状: {supplier_df.shape}")
    
    print("\n正在读取市场价数据...")
    market_df = read_market_prices(market_folder)
    print(f"市场价数据形状: {market_df.shape}")
    
    print("\n正在分析价格...")
    result_df = analyze_prices(supplier_df, market_df)
    
    # 保存结果
    output_file = output_folder / "价格优势分析结果.xlsx"
    result_df.to_excel(output_file, index=False)
    print(f"\n分析完成！结果已保存到: {output_file}")
    
    # 打印摘要
    print("\n=== 分析摘要 ===")
    if not result_df.empty:
        print(f"总分析产品数: {len(result_df)}")
        advantage_count = result_df['is_advantage'].sum()
        print(f"有价格优势的产品数: {advantage_count}")
        print(f"无价格优势的产品数: {len(result_df) - advantage_count}")
        
        if 'advantage_percent' in result_df.columns:
            avg_advantage = result_df[result_df['is_advantage'] == True]['advantage_percent'].mean()
            print(f"平均价格优势百分比: {avg_advantage:.2f}%")
    
    return result_df

if __name__ == "__main__":
    result = main()
