import pandas as pd
import numpy as np
from io import BytesIO

def load_excel_file(uploaded_file):
    df = None
    file_name = uploaded_file.name.lower()
    
    try:
        if file_name.endswith('.xlsx') or file_name.endswith('.xls'):
            df = pd.read_excel(uploaded_file, engine='openpyxl' if file_name.endswith('.xlsx') else 'xlrd')
    except Exception as e:
        pass
    
    if df is None:
        try:
            uploaded_file.seek(0)
            tables = pd.read_html(uploaded_file)
            if tables and len(tables) > 0:
                df = tables[0]
        except Exception as e:
            pass
    
    if df is None:
        raise ValueError("无法解析文件格式，请确保文件为有效的 Excel 或 HTML 表格格式")
    
    df = clean_dataframe(df)
    return df

def clean_dataframe(df):
    df = df.copy()
    
    df.columns = df.columns.str.strip()
    
    numeric_columns = ['price', 'Price', '价格', '销售额', 'Sales', '销量', 'Quantity', '数量', '增长率', 'Growth']
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df

def calculate_kpis(df):
    kpis = {}
    
    price_col = None
    for col in ['price', 'Price', '价格', 'Price_RUB']:
        if col in df.columns:
            price_col = col
            break
    
    sales_col = None
    for col in ['sales', 'Sales', '销售额', 'Revenue']:
        if col in df.columns:
            sales_col = col
            break
    
    qty_col = None
    for col in ['quantity', 'Quantity', '销量', '数量', 'Sales_Quantity']:
        if col in df.columns:
            qty_col = col
            break
    
    growth_col = None
    for col in ['growth', 'Growth', '增长率', 'Growth_Rate']:
        if col in df.columns:
            growth_col = col
            break
    
    if price_col:
        kpis['avg_price'] = df[price_col].mean()
        kpis['min_price'] = df[price_col].min()
        kpis['max_price'] = df[price_col].max()
    
    if sales_col:
        kpis['total_sales'] = df[sales_col].sum()
    
    if qty_col:
        kpis['total_quantity'] = df[qty_col].sum()
    
    if growth_col:
        kpis['avg_growth'] = df[growth_col].mean()
    
    kpis['total_products'] = len(df)
    
    return kpis

def get_brand_distribution(df):
    brand_col = None
    for col in ['brand', 'Brand', '品牌', 'manufacturer', 'Manufacturer']:
        if col in df.columns:
            brand_col = col
            break
    
    if brand_col is None:
        return pd.DataFrame()
    
    brand_counts = df[brand_col].value_counts().reset_index()
    brand_counts.columns = ['Brand', 'Count']
    
    sales_col = None
    for col in ['sales', 'Sales', '销售额', 'Revenue']:
        if col in df.columns:
            sales_col = col
            break
    
    if sales_col:
        brand_sales = df.groupby(brand_col)[sales_col].sum().reset_index()
        brand_sales.columns = ['Brand', 'Sales']
        brand_counts = brand_counts.merge(brand_sales, on='Brand', how='left')
    
    total = brand_counts['Count'].sum()
    brand_counts['Market_Share'] = (brand_counts['Count'] / total * 100).round(2)
    
    return brand_counts.head(20)

def get_price_distribution(df):
    price_col = None
    for col in ['price', 'Price', '价格', 'Price_RUB']:
        if col in df.columns:
            price_col = col
            break
    
    if price_col is None:
        return pd.DataFrame()
    
    prices = df[price_col].dropna()
    
    bins = [0, 2000, 5000, 10000, 20000, 50000, float('inf')]
    labels = ['0-2K', '2K-5K', '5K-10K', '10K-20K', '20K-50K', '50K+']
    
    price_dist = pd.cut(prices, bins=bins, labels=labels).value_counts().sort_index()
    price_df = pd.DataFrame({
        'Price_Range': price_dist.index.astype(str),
        'Count': price_dist.values,
        'Percentage': (price_dist.values / price_dist.values.sum() * 100).round(2)
    })
    
    return price_df

def predict_growth(df, periods=6):
    growth_col = None
    for col in ['growth', 'Growth', '增长率', 'Growth_Rate']:
        if col is not None and col in df.columns:
            growth_col = col
            break
    
    if growth_col is None:
        return None
    
    growth_data = df[growth_col].dropna()
    
    if len(growth_data) < 3:
        return None
    
    growth_mean = growth_data.mean()
    growth_std = growth_data.std()
    
    historical = growth_data.values
    x = np.arange(len(historical))
    
    coeffs = np.polyfit(x, historical, 1)
    slope = coeffs[0]
    
    future_x = np.arange(len(historical), len(historical) + periods)
    future_trend = np.polyval(coeffs, future_x)
    
    np.random.seed(42)
    predictions = []
    last_value = historical[-1]
    
    for i in range(periods):
        trend_component = slope * (len(historical) + i)
        seasonal = 0.1 * np.sin(2 * np.pi * i / 12)
        noise = np.random.normal(0, growth_std * 0.3)
        
        predicted = last_value + trend_component + seasonal + noise
        predictions.append(round(predicted, 2))
    
    return {
        'historical': historical.tolist(),
        'predictions': predictions,
        'avg_growth': round(growth_mean, 2),
        'trend': 'up' if slope > 0 else 'down',
        'trend_value': round(slope, 4)
    }

def extract_keywords(df):
    text_columns = ['name', 'Name', '产品名称', 'title', 'Title', 'description', 'Description']
    
    text_data = ''
    for col in text_columns:
        if col in df.columns:
            text_data += ' ' + df[col].astype(str).str.cat(sep=' ')
            break
    
    if not text_data.strip():
        return {}
    
    russian_stopwords = {
        'и', 'в', 'не', 'на', 'я', 'быть', 'он', 'с', 'это', 'а', 'то', 'все', 'она',
        'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'по', 'из',
        'от', 'до', 'при', 'или', 'что', 'как', 'только', 'для', 'их', 'ещё', 'нет',
        'если', 'быть', 'был', 'была', 'было', 'были', 'быть', 'бы', 'же', 'ли',
        'ведь', 'вот', 'где', 'когда', 'куда', 'почему', 'чтобы', 'кто', 'мой',
        'твой', 'его', 'её', 'наш', 'ваш', 'их', 'свой', 'какой', 'который', 'этот',
        'тот', 'каждый', 'любой', 'другой', 'весь', 'один', 'два', 'три', 'первый'
    }
    
    words = text_data.lower().split()
    words = [w.strip('.,!?;:"()[]{}') for w in words]
    words = [w for w in words if len(w) > 3 and w not in russian_stopwords]
    
    word_freq = {}
    for word in words:
        word_freq[word] = word_freq.get(word, 0) + 1
    
    return dict(sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:100])
