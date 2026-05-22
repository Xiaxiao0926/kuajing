import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import matplotlib.pyplot as plt
from wordcloud import WordCloud
import numpy as np
import pandas as pd
from config import MORANDI_PALETTE, CHART_CONFIG, get_chart_color


def create_kpi_metrics(kpis):
    cols = []
    for i, (key, value) in enumerate(kpis.items()):
        label = {
            'avg_price': '平均价格 (₽)',
            'min_price': '最低价格 (₽)',
            'max_price': '最高价格 (₽)',
            'total_sales': '总销售额 (₽)',
            'total_quantity': '总销量',
            'avg_growth': '平均增长率 (%)',
            'total_products': '商品总数'
        }.get(key, key)
        
        if isinstance(value, (int, np.integer)):
            formatted_value = f"{value:,}"
        elif isinstance(value, float):
            formatted_value = f"{value:,.2f}"
        else:
            formatted_value = str(value)
        
        cols.append((label, formatted_value))
    
    return cols


def create_brand_pie_chart(brand_df):
    if brand_df.empty:
        return None
    
    fig = px.pie(
        brand_df,
        values='Count',
        names='Brand',
        title='品牌市场份额',
        color_discrete_sequence=MORANDI_PALETTE['chart_colors'],
        hole=0.4
    )
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        title_font_size=18,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.2,
            xanchor="center",
            x=0.5
        )
    )
    
    fig.update_traces(
        textposition='inside',
        textinfo='percent+label',
        hovertemplate='<b>%{label}</b><br>数量: %{value}<br>占比: %{percent}<extra></extra>'
    )
    
    return fig


def create_brand_bar_chart(brand_df):
    if brand_df.empty:
        return None
    
    fig = px.bar(
        brand_df.head(15),
        x='Brand',
        y='Count',
        title='品牌商品数量 TOP 15',
        color='Count',
        color_continuous_scale=[MORANDI_PALETTE['primary'], MORANDI_PALETTE['secondary']]
    )
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='品牌',
        yaxis_title='商品数量',
        title_font_size=18
    )
    
    return fig


def create_price_distribution_chart(price_df):
    if price_df.empty:
        return None
    
    fig = px.bar(
        price_df,
        x='Price_Range',
        y='Count',
        title='价格区间分布',
        text='Percentage',
        color='Count',
        color_continuous_scale=[MORANDI_PALETTE['accent'], MORANDI_PALETTE['primary']]
    )
    
    fig.update_traces(texttemplate='%{text}%', textposition='outside')
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='价格区间 (₽)',
        yaxis_title='商品数量',
        title_font_size=18
    )
    
    return fig


def create_price_histogram(df, price_col):
    prices = df[price_col].dropna()
    
    fig = px.histogram(
        prices,
        nbins=30,
        title='价格分布直方图',
        color_discrete_sequence=[MORANDI_PALETTE['primary']]
    )
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='价格 (₽)',
        yaxis_title='商品数量',
        title_font_size=18,
        showlegend=False
    )
    
    return fig


def create_growth_prediction_chart(prediction_data):
    if prediction_data is None:
        return None
    
    historical = prediction_data['historical']
    predictions = prediction_data['predictions']
    
    all_values = historical + predictions
    x_historical = list(range(len(historical)))
    x_predictions = list(range(len(historical), len(historical) + len(predictions)))
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=x_historical,
        y=historical,
        mode='lines+markers',
        name='历史数据',
        line=dict(color=MORANDI_PALETTE['primary'], width=3),
        marker=dict(size=8)
    ))
    
    fig.add_trace(go.Scatter(
        x=x_predictions,
        y=predictions,
        mode='lines+markers',
        name='预测数据',
        line=dict(color=MORANDI_PALETTE['accent'], width=3, dash='dash'),
        marker=dict(size=8, symbol='diamond')
    ))
    
    trend_text = '📈 上升' if prediction_data['trend'] == 'up' else '📉 下降'
    trend_value = prediction_data['trend_value']
    
    fig.update_layout(
        title=f'增长率趋势预测 {trend_text} (斜率: {trend_value})',
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='周期',
        yaxis_title='增长率 (%)',
        title_font_size=18,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.2,
            xanchor="center",
            x=0.5
        )
    )
    
    return fig


def create_wordcloud(keywords_dict):
    if not keywords_dict:
        return None
    
    plt.figure(figsize=(12, 6))
    
    wordcloud = WordCloud(
        width=1200,
        height=600,
        background_color=MORANDI_PALETTE['background'],
        colormap='RdYlBu',
        max_words=80,
        relative_scaling=0.5,
        min_font_size=10,
        max_font_size=120,
        random_state=42
    ).generate_from_frequencies(keywords_dict)
    
    plt.imshow(wordcloud, interpolation='bilinear')
    plt.axis('off')
    plt.tight_layout(pad=0)
    
    return plt


def create_scatter_price_vs_sales(df):
    price_col = None
    sales_col = None
    qty_col = None
    
    for col in ['price', 'Price', '价格', 'Price_RUB']:
        if col in df.columns:
            price_col = col
            break
    
    for col in ['sales', 'Sales', '销售额', 'Revenue']:
        if col in df.columns:
            sales_col = col
            break
    
    for col in ['quantity', 'Quantity', '销量', '数量', 'Sales_Quantity']:
        if col in df.columns:
            qty_col = col
            break
    
    if price_col is None or (sales_col is None and qty_col is None):
        return None
    
    plot_df = df[[price_col]].copy()
    
    if sales_col:
        plot_df['y_value'] = df[sales_col]
        y_label = '销售额 (₽)'
    elif qty_col:
        plot_df['y_value'] = df[qty_col]
        y_label = '销量'
    
    plot_df = plot_df.dropna()
    
    if len(plot_df) < 5:
        return None
    
    fig = px.scatter(
        plot_df,
        x=price_col,
        y='y_value',
        title='价格 vs 销量/销售额',
        color_discrete_sequence=[MORANDI_PALETTE['primary']],
        opacity=0.6
    )
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='价格 (₽)',
        yaxis_title=y_label,
        title_font_size=18
    )
    
    return fig


def calculate_brand_concentration(df):
    brand_col = None
    for col in ['品牌', 'Brand', 'brand', 'manufacturer']:
        if col in df.columns:
            brand_col = col
            break
    
    if brand_col is None:
        return None
    
    brand_stats = df[brand_col].value_counts().reset_index()
    brand_stats.columns = ['Brand', 'Count']
    total = brand_stats['Count'].sum()
    brand_stats['Share'] = (brand_stats['Count'] / total * 100).round(2)
    
    cr3 = brand_stats.head(3)['Share'].sum()
    cr5 = brand_stats.head(5)['Share'].sum()
    
    return {
        'brand_stats': brand_stats,
        'cr3': round(cr3, 2),
        'cr5': round(cr5, 2)
    }


def create_brand_concentration_chart(concentration_data):
    if concentration_data is None:
        return None
    
    brand_stats = concentration_data['brand_stats'].head(10)
    
    fig = go.Figure()
    
    fig.add_trace(go.Pie(
        labels=brand_stats['Brand'],
        values=brand_stats['Count'],
        hole=0.5,
        marker=dict(colors=MORANDI_PALETTE['chart_colors']),
        textinfo='label+percent',
        hovertemplate='<b>%{label}</b><br>数量: %{value}<br>占比: %{percent}<extra></extra>'
    ))
    
    fig.update_layout(
        title=f'品牌集中度分析 (CR3: {concentration_data["cr3"]}% | CR5: {concentration_data["cr5"]}%)',
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        title_font_size=16,
        annotations=[dict(
            text=f'CR3: {concentration_data["cr3"]}%<br>CR5: {concentration_data["cr5"]}%',
            x=0.5, y=0.5,
            font_size=14,
            showarrow=False
        )]
    )
    
    return fig


def create_price_elasticity_bubble(df):
    price_col = None
    qty_col = None
    sales_col = None
    name_col = None
    
    for col in ['价格(₽)', '价格', 'Price', 'price']:
        if col in df.columns:
            price_col = col
            break
    
    for col in ['月销量', '销量', 'Quantity', 'quantity']:
        if col in df.columns:
            qty_col = col
            break
    
    for col in ['月销售额(₽)', '销售额(₽)', 'Sales', 'sales']:
        if col in df.columns:
            sales_col = col
            break
    
    for col in ['商品名称', '产品名称', 'name', 'Name', 'product_name', '标题']:
        if col in df.columns:
            name_col = col
            break
    
    if price_col is None or qty_col is None:
        return None
    
    plot_df = df[[price_col, qty_col]].copy()
    
    if sales_col:
        plot_df['Sales'] = df[sales_col]
    else:
        plot_df['Sales'] = df[price_col] * df[qty_col]
    
    if name_col:
        plot_df['Name'] = df[name_col]
        plot_df['Name'] = plot_df['Name'].str[:30]
    else:
        plot_df['Name'] = [f'商品 {i+1}' for i in range(len(plot_df))]
    
    plot_df = plot_df.dropna()
    plot_df = plot_df[plot_df['Sales'] > 0]
    
    if len(plot_df) < 5:
        return None
    
    fig = px.scatter(
        plot_df,
        x=price_col,
        y=qty_col,
        size='Sales',
        color='Sales',
        hover_name='Name',
        title='价格弹性象标图 (气泡大小 = 销售额)',
        color_continuous_scale=[MORANDI_PALETTE['primary'], MORANDI_PALETTE['accent']],
        size_max=50
    )
    
    fig.add_shape(
        type='rect',
        x0=3000, x1=15000,
        y0=plot_df[qty_col].quantile(0.5), y1=plot_df[qty_col].max(),
        line=dict(color=MORANDI_PALETTE['success'], width=2, dash='dash'),
        fillcolor='rgba(168, 197, 168, 0.1)'
    )
    
    fig.add_annotation(
        x=plot_df[price_col].median(),
        y=plot_df[qty_col].max() * 0.85,
        text='🎯 真空地带',
        showarrow=True,
        arrowhead=2,
        font=dict(size=12, color=MORANDI_PALETTE['success'])
    )
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='价格 (₽)',
        yaxis_title='月销量',
        title_font_size=16
    )
    
    return fig


def extract_product_features(df):
    name_col = None
    qty_col = None
    
    for col in ['商品名称', '产品名称', 'name', 'Name', 'product_name', '标题', 'title']:
        if col in df.columns:
            name_col = col
            break
    
    for col in ['月销量', '销量', 'Quantity', 'quantity']:
        if col in df.columns:
            qty_col = col
            break
    
    if name_col is None:
        return None
    
    russian_features = [
        '5 в 1', '5 в 1', 'в 1', 'prof', 'professional', 'ионизация', 'ionic',
        'инвертор', 'inverter', 'турмалин', 'tourmaline', 'керамика', 'ceramic',
        'интеллект', 'smart', 'авто', 'auto', 'мощный', 'powerful', 'тихий', 'quiet',
        'быстрый', 'fast', 'нагрев', 'heat', 'холодный', 'cold', 'air', 'airflow',
        'сушка', 'drying', 'укладка', 'styling', 'расческа', 'comb', 'щетка', 'brush',
        'диффузор', 'diffuser', 'концентратор', 'concentrator', 'насадка', 'attachment',
        'portable', 'travel', 'дорожный', 'fold', 'складной', ' compact', 'мини',
        '2000w', '2200w', '1800w', '1600w', '2100w', 'мощность', 'watt'
    ]
    
    feature_stats = {feat: {'count': 0, 'total_qty': 0, 'avg_price': 0} for feat in russian_features}
    
    for _, row in df.iterrows():
        name = str(row[name_col]).lower()
        qty = row[qty_col] if qty_col and pd.notna(row[qty_col]) else 0
        
        for feat in russian_features:
            if feat.lower() in name:
                price = 0
                for col in ['价格(₽)', '价格', 'Price']:
                    if col in df.columns and pd.notna(row.get(col)):
                        price = row[col]
                        break
                
                feature_stats[feat]['count'] += 1
                feature_stats[feat]['total_qty'] += qty
                feature_stats[feat]['avg_price'] += price
    
    result = []
    for feat, stats in feature_stats.items():
        if stats['count'] > 0:
            result.append({
                'Feature': feat,
                'Product_Count': stats['count'],
                'Total_Quantity': int(stats['total_qty']),
                'Avg_Quantity': round(stats['total_qty'] / stats['count'], 1),
                'Avg_Price': round(stats['avg_price'] / stats['count'], 2) if stats['count'] > 0 else 0
            })
    
    result = sorted(result, key=lambda x: x['Total_Quantity'], reverse=True)
    return pd.DataFrame(result) if result else None


def create_feature_contribution_chart(feature_df):
    if feature_df is None or feature_df.empty:
        return None
    
    top_features = feature_df.head(15)
    
    fig = px.bar(
        top_features,
        x='Feature',
        y='Total_Quantity',
        title='爆款特征贡献度 (按销量)',
        color='Avg_Quantity',
        color_continuous_scale=[MORANDI_PALETTE['primary'], MORANDI_PALETTE['accent']],
        text='Product_Count'
    )
    
    fig.update_traces(texttemplate='%{text}', textposition='outside')
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='特征关键词',
        yaxis_title='总销量',
        title_font_size=16,
        xaxis_tickangle=-45
    )
    
    return fig


def analyze_fbo_competition(df):
    fbo_col = None
    qty_col = None
    rating_col = None
    
    for col in ['FBO', 'fbo', '发货模式', '模式', 'type']:
        if col in df.columns:
            fbo_col = col
            break
    
    if fbo_col is None:
        for col in df.columns:
            if df[col].astype(str).str.lower().isin(['fbo', 'fbp', '平台发货', '自发货']).any():
                fbo_col = col
                break
    
    for col in ['月销量', '销量', 'Quantity', 'quantity']:
        if col in df.columns:
            qty_col = col
            break
    
    for col in ['评分', 'rating', 'Rating', '平均评分', 'оценка']:
        if col in df.columns:
            rating_col = col
            break
    
    if fbo_col is None:
        return None
    
    df_copy = df.copy()
    df_copy['FBO_Type'] = df_copy[fbo_col].astype(str).str.lower().str.strip()
    df_copy['Is_FBO'] = df_copy['FBO_Type'].apply(
        lambda x: 'FBO (平台发货)' if 'fbo' in x or '平台' in x else ('FBP (非FBO)' if 'fbp' in x or '非' in x or '自发货' in x else 'Other')
    )
    
    if qty_col:
        qty_data = df_copy.groupby('Is_FBO')[qty_col].agg(['sum', 'mean', 'count']).reset_index()
        qty_data.columns = ['Type', 'Total_Quantity', 'Avg_Quantity', 'Product_Count']
    else:
        qty_data = pd.DataFrame()
    
    if rating_col:
        rating_data = df_copy.groupby('Is_FBO')[rating_col].mean().reset_index()
        rating_data.columns = ['Type', 'Avg_Rating']
    else:
        rating_data = pd.DataFrame()
    
    if not qty_data.empty and not rating_data.empty:
        result = qty_data.merge(rating_data, on='Type', how='outer')
    elif not qty_data.empty:
        result = qty_data
    elif not rating_data.empty:
        result = rating_data
    else:
        return None
    
    return result if not result.empty else None


def create_fbo_competition_chart(competition_data):
    if competition_data is None or competition_data.empty:
        return None
    
    fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=['FBO vs 非FBO 销量对比', 'FBO vs 非FBO 平均评分'],
        specs=[[{'type': 'bar'}, {'type': 'bar'}]]
    )
    
    colors = [MORANDI_PALETTE['primary'], MORANDI_PALETTE['accent'], MORANDI_PALETTE['secondary']]
    
    if 'Total_Quantity' in competition_data.columns:
        fig.add_trace(
            go.Bar(
                x=competition_data['Type'],
                y=competition_data['Total_Quantity'],
                name='总销量',
                marker_color=colors[0],
                text=competition_data['Total_Quantity'],
                textposition='outside'
            ),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Bar(
                x=competition_data['Type'],
                y=competition_data['Avg_Quantity'],
                name='平均销量',
                marker_color=colors[1],
                text=competition_data['Avg_Quantity'].round(1),
                textposition='outside'
            ),
            row=1, col=1
        )
    
    if 'Avg_Rating' in competition_data.columns:
        fig.add_trace(
            go.Bar(
                x=competition_data['Type'],
                y=competition_data['Avg_Rating'],
                name='平均评分',
                marker_color=colors[2],
                text=competition_data['Avg_Rating'].round(2),
                textposition='outside'
            ),
            row=1, col=2
        )
    
    fig.update_layout(
        title='竞争格局分析: FBO vs 非FBO',
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        title_font_size=16,
        showlegend=True,
        height=400
    )
    
    fig.update_xaxes(title_text='模式', row=1, col=1)
    fig.update_yaxes(title_text='销量', row=1, col=1)
    fig.update_xaxes(title_text='模式', row=1, col=2)
    fig.update_yaxes(title_text='评分', row=1, col=2)
    
    return fig


def create_seo_score_distribution(seo_df):
    if seo_df is None or seo_df.empty:
        return None
    
    fig = px.histogram(
        seo_df,
        x='SEO评分',
        nbins=10,
        title='SEO 评分分布',
        color_discrete_sequence=[MORANDI_PALETTE['primary']],
        opacity=0.7
    )
    
    fig.add_vline(x=70, line_dash="dash", line_color=MORANDI_PALETTE['success'], 
                  annotation_text="良好阈值", annotation_position="top right")
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='SEO 评分',
        yaxis_title='商品数量',
        title_font_size=16,
        showlegend=False
    )
    
    return fig


def create_seo_length_scatter(seo_df):
    if seo_df is None or seo_df.empty:
        return None
    
    fig = px.scatter(
        seo_df,
        x='标题长度',
        y='SEO评分',
        title='标题长度 vs SEO 评分',
        color='SEO评分',
        color_continuous_scale=[MORANDI_PALETTE['accent'], MORANDI_PALETTE['primary'], MORANDI_PALETTE['success']],
        size_max=12,
        hover_data={'原标题': True}
    )
    
    fig.add_vline(x=200, line_dash="dash", line_color="red", annotation_text="最大长度")
    fig.add_vline(x=80, line_dash="dot", line_color="green", annotation_text="最佳起始")
    
    fig.update_layout(
        template=CHART_CONFIG['template'],
        font_family=CHART_CONFIG['font_family'],
        font_size=CHART_CONFIG['font_size'],
        plot_bgcolor=CHART_CONFIG['plot_bgcolor'],
        paper_bgcolor=CHART_CONFIG['paper_bgcolor'],
        xaxis_title='标题长度 (字符)',
        yaxis_title='SEO 评分',
        title_font_size=16
    )
    
    return fig
