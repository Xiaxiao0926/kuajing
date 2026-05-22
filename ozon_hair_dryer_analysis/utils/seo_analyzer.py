import pandas as pd
import re
from collections import Counter


OZON_SEO_GUIDELINES = {
    'max_title_length': 200,
    'optimal_title_length': (80, 150),
    'required_keywords': [
        'фен', 'hair dryer', '吹风机',
        'профессиональный', 'professional', '专业',
        'ионизация', 'ionic', '负离子',
    ],
    'power_keywords': [
        'мощный', '2000w', '2200w', '2100w', '1800w', 'мощность',
        'быстрый', 'fast', '快速',
        'профессиональный', 'professional', '专业',
    ],
    'feature_keywords': [
        'ионизация', 'ionic', '负离子',
        'турмалин', 'tourmaline', '电气石',
        'керамика', 'ceramic', '陶瓷',
        'инверторный', 'inverter', '变频',
        '智能', 'smart', 'интеллект',
        'тихий', 'quiet', '静音',
        'портативный', 'portable', '便携',
    ],
    'style_keywords': [
        'укладка', 'styling', '造型',
        'сушка', 'drying', '吹干',
        'выпрямление', 'straightening', '直发',
        'локоны', 'curling', '卷发',
    ],
}


def analyze_title_seo(product_name):
    if not product_name or not isinstance(product_name, str):
        return None
    
    analysis = {
        'title': product_name,
        'length': len(product_name),
        'word_count': len(product_name.split()),
        'score': 0,
        'issues': [],
        'suggestions': [],
        'keywords_found': [],
        'missing_keywords': [],
    }
    
    if analysis['length'] < 30:
        analysis['issues'].append('标题过短')
        analysis['suggestions'].append('标题长度建议至少 30 个字符')
    elif analysis['length'] > OZON_SEO_GUIDELINES['max_title_length']:
        analysis['issues'].append('标题过长，可能被截断')
        analysis['suggestions'].append(f'标题长度控制在 {OZON_SEO_GUIDELINES["max_title_length"]} 字符以内')
    elif analysis['length'] < OZON_SEO_GUIDELINES['optimal_title_length'][0]:
        analysis['issues'].append('标题偏短')
        analysis['suggestions'].append(f'建议长度 {OZON_SEO_GUIDELINES["optimal_title_length"][0]}-{OZON_SEO_GUIDELINES["optimal_title_length"][1]} 字符')
    
    title_lower = product_name.lower()
    
    for keyword in OZON_SEO_GUIDELINES['power_keywords']:
        if keyword.lower() in title_lower:
            analysis['keywords_found'].append(keyword)
            analysis['score'] += 10
    
    for keyword in OZON_SEO_GUIDELINES['feature_keywords']:
        if keyword.lower() in title_lower:
            analysis['keywords_found'].append(keyword)
            analysis['score'] += 15
    
    for keyword in OZON_SEO_GUIDELINES['style_keywords']:
        if keyword.lower() in title_lower:
            analysis['keywords_found'].append(keyword)
            analysis['score'] += 10
    
    for keyword in OZON_SEO_GUIDELINES['required_keywords']:
        if keyword.lower() in title_lower:
            analysis['score'] += 20
    
    required_count = sum(1 for k in OZON_SEO_GUIDELINES['required_keywords'] if k.lower() in title_lower)
    if required_count == 0:
        analysis['missing_keywords'].append('产品类型关键词 (фен/hair dryer)')
        analysis['suggestions'].append('建议添加产品类型关键词，如 "фен" 或 "hair dryer"')
    
    if 'w' not in title_lower and 'вт' not in title_lower:
        analysis['missing_keywords'].append('功率信息')
        analysis['suggestions'].append('建议添加功率信息，如 "2000W" 或 "2000Вт"')
    
    if required(analysis['keywords_found']) < 2:
        analysis['missing_keywords'].append('功能特征关键词')
        analysis['suggestions'].append('建议添加功能特征词，如 ионизация, турмалин, керамика 等')
    
    if analysis['score'] > 100:
        analysis['score'] = 100
    
    if not analysis['issues'] and analysis['score'] >= 70:
        analysis['suggestions'].append('✅ 标题优化良好')
    
    return analysis


def required(keywords):
    return len(set(keywords))


def generate_optimized_title(product_name, brand=None, price_range=None):
    if not product_name or not isinstance(product_name, str):
        return None
    
    title_parts = []
    
    if brand:
        title_parts.append(brand.strip().title())
    
    title_parts.append('Фен')
    
    power_match = re.search(r'(\d{3,4})\s*[wWВв]', product_name)
    if power_match:
        title_parts.append(f'{power_match.group(1)}Вт')
    
    features = []
    title_lower = product_name.lower()
    
    feature_map = {
        'ионизация': 'с ионизацией',
        'ionic': 'с ионизацией',
        'турмалин': 'с турмалином',
        'tourmaline': 'с турмалином',
        'керамика': 'керамический',
        'ceramic': 'керамический',
        'инвертор': 'инверторный',
        'inverter': 'инверторный',
        'smart': 'умный',
        'тихий': 'тихий',
        'quiet': 'тихий',
    }
    
    for eng, rus in feature_map.items():
        if eng in title_lower and rus not in features:
            features.append(rus)
    
    if features:
        title_parts.append(', '.join(features[:2]))
    
    style_map = {
        'профессиональный': 'профессиональный',
        'professional': 'профессиональный',
        'бытовой': 'бытовой',
    }
    
    for eng, rus in style_map.items():
        if eng in title_lower:
            title_parts.insert(1, rus)
            break
    
    optimized = ' | '.join(title_parts) if len(title_parts) > 2 else ' '.join(title_parts)
    
    if len(optimized) < 50:
        if price_range:
            price_label = 'премиум' if price_range > 10000 else 'бюджетный' if price_range < 3000 else 'средний класс'
            optimized += f' ({price_label})'
    
    return optimized[:200]


def batch_analyze_seo(df):
    name_col = None
    for col in ['商品名称', '产品名称', 'name', 'Name', 'product_name', 'title', '标题']:
        if col in df.columns:
            name_col = col
            break
    
    if name_col is None:
        return None
    
    results = []
    for _, row in df.iterrows():
        product_name = row[name_col]
        if pd.isna(product_name):
            continue
        
        analysis = analyze_title_seo(str(product_name))
        if analysis:
            brand = None
            for col in ['品牌', 'Brand', 'brand']:
                if col in df.columns:
                    brand = row.get(col)
                    break
            
            price = None
            for col in ['价格(₽)', '价格', 'Price']:
                if col in df.columns:
                    price = row.get(col)
                    break
            
            optimized = generate_optimized_title(str(product_name), brand, price)
            
            results.append({
                '原标题': str(product_name)[:80],
                '标题长度': analysis['length'],
                'SEO评分': analysis['score'],
                '发现关键词': ', '.join(analysis['keywords_found'][:5]),
                '问题': '; '.join(analysis['issues'][:2]) if analysis['issues'] else '无',
                '优化建议': '; '.join(analysis['suggestions'][:2]) if analysis['suggestions'] else '良好',
                '优化后标题': optimized[:100] if optimized else '',
            })
    
    return pd.DataFrame(results) if results else None


def get_seo_summary_stats(seo_df):
    if seo_df is None or seo_df.empty:
        return None
    
    stats = {
        'avg_score': seo_df['SEO评分'].mean(),
        'good_titles': len(seo_df[seo_df['SEO评分'] >= 70]),
        'needs_optimization': len(seo_df[seo_df['SEO评分'] < 70]),
        'avg_length': seo_df['标题长度'].mean(),
        'long_titles': len(seo_df[seo_df['标题长度'] > 200]),
    }
    
    return stats
