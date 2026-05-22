import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from io import BytesIO

from config import apply_global_styles, MORANDI_PALETTE
from utils.data_processor import (
    load_excel_file, calculate_kpis, get_brand_distribution,
    get_price_distribution, predict_growth, extract_keywords
)
from utils.charts import (
    create_kpi_metrics, create_brand_pie_chart, create_brand_bar_chart,
    create_price_distribution_chart, create_price_histogram,
    create_growth_prediction_chart, create_wordcloud, create_scatter_price_vs_sales,
    calculate_brand_concentration, create_brand_concentration_chart,
    create_price_elasticity_bubble, extract_product_features, create_feature_contribution_chart,
    analyze_fbo_competition, create_fbo_competition_chart,
    create_seo_score_distribution, create_seo_length_scatter
)
from utils.pdf_generator import generate_market_report
from utils.seo_analyzer import batch_analyze_seo, get_seo_summary_stats

st.session_state.setdefault('df', None)
st.session_state.setdefault('kpis', None)


def calculate_enhanced_kpis(df):
    kpis = {}
    
    price_col = None
    for col in ['价格(₽)', '价格', 'Price', 'price', 'Price_RUB']:
        if col in df.columns:
            price_col = col
            break
    
    sales_col = None
    for col in ['月销售额(₽)', '销售额(₽)', '销售额', 'Sales', 'sales', 'Revenue']:
        if col in df.columns:
            sales_col = col
            break
    
    qty_col = None
    for col in ['月销量', '销量', 'Quantity', 'quantity']:
        if col in df.columns:
            qty_col = col
            break
    
    brand_col = None
    for col in ['品牌', 'Brand', 'brand']:
        if col in df.columns:
            brand_col = col
            break
    
    growth_col = None
    for col in ['月销量环比(%)', '增长率', 'Growth', 'growth']:
        if col in df.columns:
            growth_col = col
            break
    
    if sales_col:
        kpis['total_market_size'] = df[sales_col].sum()
    
    if price_col and qty_col:
        df_temp = df.dropna(subset=[price_col, qty_col])
        if len(df_temp) > 0:
            total_revenue = (df_temp[price_col] * df_temp[qty_col]).sum()
            total_qty = df_temp[qty_col].sum()
            kpis['avg_unit_price'] = round(total_revenue / total_qty, 2) if total_qty > 0 else 0
        else:
            kpis['avg_unit_price'] = df[price_col].mean()
    elif price_col:
        kpis['avg_unit_price'] = df[price_col].mean()
    
    if brand_col and qty_col:
        brand_sales = df.groupby(brand_col)[qty_col].sum()
        if len(brand_sales) > 0:
            top_brand = brand_sales.idxmax()
            kpis['top_brand'] = top_brand
        else:
            kpis['top_brand'] = 'N/A'
    else:
        kpis['top_brand'] = 'N/A'
    
    if growth_col:
        kpis['avg_growth'] = df[growth_col].mean()
    
    kpis['total_products'] = len(df)
    
    return kpis


def render_kpi_cards(kpis):
    icons = {
        'total_market_size': '💰',
        'avg_unit_price': '🏷️',
        'top_brand': '👑',
        'avg_growth': '📈'
    }
    
    labels = {
        'total_market_size': '总市场规模',
        'avg_unit_price': '平均客单价',
        'top_brand': '最畅销品牌',
        'avg_growth': '平均增长率'
    }
    
    st.markdown('<div class="kpi-container">', unsafe_allow_html=True)
    
    for key, icon in icons.items():
        if key in kpis:
            value = kpis[key]
            label = labels[key]
            
            if key == 'total_market_size':
                if isinstance(value, (int, float)):
                    formatted_value = f"₽{value:,.0f}"
                else:
                    formatted_value = str(value)
            elif key == 'avg_unit_price':
                if isinstance(value, (int, float)):
                    formatted_value = f"₽{value:,.0f}"
                else:
                    formatted_value = str(value)
            elif key == 'top_brand':
                formatted_value = str(value)[:15]
            elif key == 'avg_growth':
                if isinstance(value, (int, float)):
                    trend_class = 'positive' if value > 0 else 'negative'
                    formatted_value = f"{value:+.1f}%"
                    trend_html = f'<span class="kpi-trend {trend_class}">{"↑" if value > 0 else "↓"}</span>'
                else:
                    formatted_value = str(value)
                    trend_html = ''
            else:
                formatted_value = str(value) if not isinstance(value, (int, float)) else f"{value:,.0f}"
                trend_html = ''
            
            st.markdown(f"""
            <div class="kpi-card">
                <div class="kpi-icon">{icon}</div>
                <div class="kpi-value">{formatted_value}</div>
                <div class="kpi-label">{label}</div>
                {trend_html if 'trend_html' in locals() else ''}
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)


def render_searchable_dataframe(df):
    st.markdown("### 🔍 数据透视表")
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        search_term = st.text_input("🔎 搜索数据...", placeholder="输入关键词搜索...", key="data_search")
    
    with col2:
        columns_to_show = st.multiselect(
            "选择显示列",
            options=df.columns.tolist(),
            default=df.columns.tolist()[:8]
        )
    
    if search_term:
        mask = df.astype(str).apply(lambda x: x.str.contains(search_term, case=False)).any(axis=1)
        filtered_df = df[mask]
    else:
        filtered_df = df
    
    if columns_to_show:
        display_df = filtered_df[columns_to_show]
    else:
        display_df = filtered_df
    
    st.dataframe(
        display_df,
        use_container_width=True,
        height=400,
        hide_index=True
    )
    
    st.caption(f"显示 {len(display_df)} / {len(df)} 条记录")
    
    return filtered_df


def convert_df_to_csv(df):
    return df.to_csv(index=False, encoding='utf-8-sig').encode('utf-8-sig')


def convert_df_to_excel(df):
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='清洗后数据')
    return output.getvalue()


def main():
    apply_global_styles()
    
    with st.sidebar:
        st.title("💨 吹风机市场分析")
        st.markdown("---")
        
        uploaded_file = st.file_uploader(
            "📁 上传数据文件",
            type=['xlsx', 'xls', 'html'],
            help="支持 .xlsx, .xls, .html 格式"
        )
        
        if uploaded_file is not None:
            try:
                df = load_excel_file(uploaded_file)
                st.session_state['df'] = df
                st.session_state['kpis'] = calculate_enhanced_kpis(df)
                st.success(f"✅ 成功加载 {len(df)} 条数据")
            except Exception as e:
                st.error(f"❌ 加载失败: {str(e)}")
                st.session_state['df'] = None
                st.session_state['kpis'] = None
        
        st.markdown("---")
        st.markdown("### 📊 数据概览")
        
        if st.session_state['df'] is not None:
            df = st.session_state['df']
            st.write(f"**总记录数:** {len(df)}")
            st.write(f"**数据列:** {len(df.columns)}")
            
            with st.expander("查看原始数据"):
                st.dataframe(df.head(20), use_container_width=True)
        else:
            st.info("请上传数据文件开始分析")
    
    st.title("🇷🇺 俄罗斯电商吹风机市场深度分析")
    
    if st.session_state['df'] is None:
        st.markdown(f"""
        <div style="
            background-color: {MORANDI_PALETTE['card_bg']};
            padding: 4rem 3rem;
            border-radius: 16px;
            text-align: center;
            margin: 3rem 0;
            box-shadow: 0 8px 40px rgba(0,0,0,0.08);
        ">
            <div style="font-size: 4rem; margin-bottom: 1.5rem;">💨</div>
            <h2 style="color: {MORANDI_PALETTE['text']}; margin-bottom: 1rem; font-weight: 600;">
                欢迎使用吹风机市场分析平台
            </h2>
            <p style="color: {MORANDI_PALETTE['text_light']}; font-size: 1.1rem; line-height: 1.6;">
                请在左侧上传您的 Excel 或 HTML 数据文件开始分析<br>
                支持 .xlsx, .xls, .html 格式
            </p>
        </div>
        """, unsafe_allow_html=True)
        return
    
    df = st.session_state['df']
    kpis = st.session_state['kpis']
    
    st.markdown('<p class="section-header">📈 全局 KPI 看板</p>', unsafe_allow_html=True)
    
    render_kpi_cards(kpis)
    
    col_report_1, col_report_2 = st.columns([1, 5])
    
    with col_report_1:
        brand_df = get_brand_distribution(df)
        price_df = get_price_distribution(df)
        concentration_data = calculate_brand_concentration(df)
        
        pdf_report = generate_market_report(
            df=df,
            kpis=kpis,
            brand_df=brand_df,
            price_df=price_df,
            concentration_data=concentration_data
        )
        
        st.download_button(
            label="📄 生成 PDF 市场分析简报",
            data=pdf_report,
            file_name=f'ozon_market_report_{pd.Timestamp.now().strftime("%Y%m%d")}.pdf',
            mime='application/pdf',
            use_container_width=True
        )
    
    st.markdown("---")
    
    with st.expander("📋 查看完整数据透视表"):
        filtered_df = render_searchable_dataframe(df)
        
        st.markdown('<div class="download-section">', unsafe_allow_html=True)
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            csv = convert_df_to_csv(filtered_df)
            st.download_button(
                label="📥 下载 CSV",
                data=csv,
                file_name='ozon_hair_dryer_data.csv',
                mime='text/csv',
                use_container_width=True
            )
        
        with col2:
            excel = convert_df_to_excel(filtered_df)
            st.download_button(
                label="📥 下载 Excel",
                data=excel,
                file_name='ozon_hair_dryer_data.xlsx',
                mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                use_container_width=True
            )
        
        st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">🏷️ 品牌市占率分析</p>', unsafe_allow_html=True)
    
    brand_df = get_brand_distribution(df)
    
    if brand_df.empty:
        st.warning("数据中未找到品牌信息")
    else:
        col1, col2 = st.columns(2)
        
        with col1:
            pie_chart = create_brand_pie_chart(brand_df)
            if pie_chart:
                st.plotly_chart(pie_chart, use_container_width=True)
        
        with col2:
            bar_chart = create_brand_bar_chart(brand_df)
            if bar_chart:
                st.plotly_chart(bar_chart, use_container_width=True)
        
        with st.expander("查看品牌详细数据"):
            st.dataframe(brand_df, use_container_width=True)
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">💰 价格区间分布</p>', unsafe_allow_html=True)
    
    price_df = get_price_distribution(df)
    
    if price_df.empty:
        st.warning("数据中未找到价格信息")
    else:
        col1, col2 = st.columns(2)
        
        with col1:
            price_bar = create_price_distribution_chart(price_df)
            if price_bar:
                st.plotly_chart(price_bar, use_container_width=True)
        
        price_col = None
        for col in ['价格(₽)', '价格', 'Price', 'price', 'Price_RUB']:
            if col in df.columns:
                price_col = col
                break
        
        with col2:
            if price_col:
                hist_chart = create_price_histogram(df, price_col)
                if hist_chart:
                    st.plotly_chart(hist_chart, use_container_width=True)
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">📊 增长率预测</p>', unsafe_allow_html=True)
    
    prediction_data = predict_growth(df)
    
    if prediction_data:
        col1, col2 = st.columns([2, 1])
        
        with col1:
            growth_chart = create_growth_prediction_chart(prediction_data)
            if growth_chart:
                st.plotly_chart(growth_chart, use_container_width=True)
        
        with col2:
            st.markdown(f"""
            <div class="insight-card">
                <h4 style="margin-bottom: 1rem;">📈 预测摘要</h4>
                <p><strong>平均增长率:</strong> {prediction_data['avg_growth']}%</p>
                <p><strong>趋势方向:</strong> {'📈 上升' if prediction_data['trend'] == 'up' else '📉 下降'}</p>
                <p><strong>趋势斜率:</strong> {prediction_data['trend_value']}</p>
                <p><strong>预测周期:</strong> 6 期</p>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("数据中未找到增长率信息，无法进行预测分析")
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">☁️ 商品特征词云</p>', unsafe_allow_html=True)
    
    keywords = extract_keywords(df)
    
    if keywords:
        col1, col2 = st.columns([2, 1])
        
        with col1:
            fig = create_wordcloud(keywords)
            if fig:
                st.pyplot(fig)
        
        with col2:
            st.markdown("### 🔑 高频特征词 TOP 20")
            top_keywords = list(keywords.items())[:20]
            for idx, (word, freq) in enumerate(top_keywords, 1):
                st.markdown(f"**{idx}.** {word} ({freq})")
    else:
        st.info("数据中未找到可用于词云分析的文字信息")
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">🔍 价格与销售关系分析</p>', unsafe_allow_html=True)
    
    scatter_chart = create_scatter_price_vs_sales(df)
    if scatter_chart:
        st.plotly_chart(scatter_chart, use_container_width=True)
    else:
        st.info("数据中未找到足够的价格和销售数据进行关联分析")
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">📊 品牌集中度分析 (CR3/CR5)</p>', unsafe_allow_html=True)
    
    concentration_data = calculate_brand_concentration(df)
    
    if concentration_data:
        col1, col2 = st.columns([2, 1])
        
        with col1:
            concentration_chart = create_brand_concentration_chart(concentration_data)
            if concentration_chart:
                st.plotly_chart(concentration_chart, use_container_width=True)
        
        with col2:
            st.markdown(f"""
            <div class="insight-card">
                <h4 style="margin-bottom: 1rem;">📈 集中度指标</h4>
                <p><strong>CR3 (前3品牌):</strong> {concentration_data['cr3']}%</p>
                <p><strong>CR5 (前5品牌):</strong> {concentration_data['cr5']}%</p>
                <hr style="margin: 1rem 0; border-color: rgba(0,0,0,0.1);">
                <p style="font-size: 0.85rem; color: {MORANDI_PALETTE['text_light']};">
                    {"⚠️ 市场集中度较高，头部品牌占据主导地位" if concentration_data['cr3'] > 50 else "✅ 市场竞争相对分散"}
                </p>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("数据中未找到品牌信息")
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">💎 价格弹性象标图</p>', unsafe_allow_html=True)
    
    elasticity_chart = create_price_elasticity_bubble(df)
    if elasticity_chart:
        st.plotly_chart(elasticity_chart, use_container_width=True)
        st.caption("💡 气泡越大表示销售额越高。红色虚线框区域为「高销量-中高价位」真空地带，可能存在市场机会。")
    else:
        st.info("数据中未找到足够的价格和销量数据")
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">🔥 爆款特征提取</p>', unsafe_allow_html=True)
    
    feature_df = extract_product_features(df)
    
    if feature_df is not None and not feature_df.empty:
        col1, col2 = st.columns([2, 1])
        
        with col1:
            feature_chart = create_feature_contribution_chart(feature_df)
            if feature_chart:
                st.plotly_chart(feature_chart, use_container_width=True)
        
        with col2:
            st.markdown("### 🏷️ 特征词频 TOP 10")
            top_features = feature_df.head(10)
            for idx, row in top_features.iterrows():
                st.markdown(f"**{row['Feature']}** | 销量: {row['Total_Quantity']:,} | 均价: {row['Avg_Price']:,.0f}₽")
        
        with st.expander("查看完整特征数据"):
            st.dataframe(feature_df, use_container_width=True)
    else:
        st.info("数据中未找到商品名称信息，无法提取特征")
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">🏭 竞争格局分析 (FBO vs 非FBO)</p>', unsafe_allow_html=True)
    
    competition_data = analyze_fbo_competition(df)
    
    if competition_data is not None and not competition_data.empty:
        fbo_chart = create_fbo_competition_chart(competition_data)
        if fbo_chart:
            st.plotly_chart(fbo_chart, use_container_width=True)
        
        with st.expander("查看详细数据"):
            st.dataframe(competition_data, use_container_width=True)
    else:
        st.info("数据中未找到 FBO/发货模式 信息")
    
    st.markdown("---")
    
    st.markdown('<p class="section-header">🔤 Ozon 标题 SEO 优化建议</p>', unsafe_allow_html=True)
    
    seo_df = batch_analyze_seo(df)
    
    if seo_df is not None and not seo_df.empty:
        seo_stats = get_seo_summary_stats(seo_df)
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("平均 SEO 评分", f"{seo_stats['avg_score']:.1f}")
        with col2:
            st.metric("优秀标题", f"{seo_stats['good_titles']}")
        with col3:
            st.metric("待优化", f"{seo_stats['needs_optimization']}")
        with col4:
            st.metric("平均长度", f"{seo_stats['avg_length']:.0f} 字符")
        
        st.markdown("---")
        
        col_chart1, col_chart2 = st.columns(2)
        
        with col_chart1:
            seo_dist_chart = create_seo_score_distribution(seo_df)
            if seo_dist_chart:
                st.plotly_chart(seo_dist_chart, use_container_width=True)
        
        with col_chart2:
            seo_scatter = create_seo_length_scatter(seo_df)
            if seo_scatter:
                st.plotly_chart(seo_scatter, use_container_width=True)
        
        st.markdown("### 📋 标题优化详情")
        
        with st.expander("查看完整 SEO 分析数据"):
            st.dataframe(
                seo_df,
                use_container_width=True,
                height=400,
                hide_index=True
            )
            
            csv_seo = convert_df_to_csv(seo_df)
            st.download_button(
                label="📥 下载 SEO 优化报告",
                data=csv_seo,
                file_name='ozon_title_seo_optimization.csv',
                mime='text/csv',
                use_container_width=True
            )
        
        st.markdown("### 💡 SEO 优化建议")
        
        low_score_df = seo_df[seo_df['SEO评分'] < 70].head(5)
        
        if not low_score_df.empty:
            for idx, row in low_score_df.iterrows():
                with st.container():
                    st.markdown(f"""
                    <div class="insight-card" style="margin-bottom: 1rem;">
                        <h5 style="margin-bottom: 0.5rem;">📝 原标题: {row['原标题'][:60]}...</h5>
                        <p style="color: #E57373;">⚠️ 问题: {row['问题']}</p>
                        <p style="color: #4A4A4A;">💡 建议: {row['优化建议']}</p>
                        <p style="color: #81C784; font-weight: 600;">✨ 优化后: {row['优化后标题']}</p>
                    </div>
                    """, unsafe_allow_html=True)
    else:
        st.info("数据中未找到商品名称信息，无法进行 SEO 分析")
    
    st.markdown("---")
    
    st.markdown(f"""
    <div style="
        text-align: center;
        color: {MORANDI_PALETTE['text_light']};
        padding: 3rem;
    ">
        <p style="font-size: 0.9rem; letter-spacing: 0.05em;">
            🇷🇺 俄罗斯电商吹风机市场分析平台 | Powered by Streamlit
        </p>
    </div>
    """, unsafe_allow_html=True)


if __name__ == "__main__":
    main()
