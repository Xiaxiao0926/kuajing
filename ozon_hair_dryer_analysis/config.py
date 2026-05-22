import streamlit as st

MORANDI_PALETTE = {
    'background': '#F6F6F6',
    'card_bg': '#FFFFFF',
    'primary': '#8B9DC3',
    'secondary': '#B8A9C9',
    'accent': '#D4B8A0',
    'text': '#4A4A4A',
    'text_light': '#7A7A7A',
    'success': '#A8C5A8',
    'warning': '#E3C9A8',
    'chart_colors': [
        '#8B9DC3',
        '#B8A9C9',
        '#D4B8A0',
        '#A8C5A8',
        '#E3C9A8',
        '#C9B8D4',
        '#C5D4C9',
        '#D4C9B8',
    ]
}

CHART_CONFIG = {
    'template': 'plotly_white',
    'font_family': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    'font_size': 13,
    'plot_bgcolor': 'rgba(0,0,0,0)',
    'paper_bgcolor': 'rgba(0,0,0,0)',
}

def apply_global_styles():
    st.set_page_config(
        page_title="俄罗斯电商吹风机市场分析",
        page_icon="💨",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    st.markdown(f"""
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }}
        
        .stApp {{
            background-color: {MORANDI_PALETTE['background']};
        }}
        
        .main .block-container {{
            padding-top: 2.5rem;
            padding-bottom: 3rem;
            padding-left: 2rem;
            padding-right: 2rem;
            max-width: 1400px;
        }}
        
        .stSidebar {{
            background-color: #FAFAFA;
            border-right: 1px solid #E8E8E8;
        }}
        
        .stSidebar > div {{
            padding: 1rem;
        }}
        
        .section-header {{
            font-size: 1.6rem;
            font-weight: 600;
            color: {MORANDI_PALETTE['text']};
            margin-top: 2rem;
            margin-bottom: 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 2px solid {MORANDI_PALETTE['accent']};
            letter-spacing: -0.02em;
        }}
        
        .kpi-container {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1.5rem;
            margin-bottom: 2rem;
        }}
        
        .kpi-card {{
            background-color: {MORANDI_PALETTE['card_bg']};
            border-radius: 16px;
            padding: 1.75rem 1.5rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            text-align: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            border: 1px solid rgba(0,0,0,0.03);
        }}
        
        .kpi-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(0,0,0,0.1);
        }}
        
        .kpi-icon {{
            font-size: 2rem;
            margin-bottom: 0.75rem;
        }}
        
        .kpi-value {{
            font-size: 1.85rem;
            font-weight: 700;
            color: {MORANDI_PALETTE['primary']};
            margin-bottom: 0.5rem;
            letter-spacing: -0.03em;
            line-height: 1.2;
        }}
        
        .kpi-label {{
            font-size: 0.85rem;
            color: {MORANDI_PALETTE['text_light']};
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        
        .kpi-trend {{
            font-size: 0.75rem;
            margin-top: 0.5rem;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            display: inline-block;
        }}
        
        .kpi-trend.positive {{
            background-color: rgba(168, 197, 168, 0.2);
            color: #5a8a5a;
        }}
        
        .kpi-trend.negative {{
            background-color: rgba(227, 201, 168, 0.3);
            color: #9a7a4a;
        }}
        
        div[data-testid="stMetric"] {{
            background-color: {MORANDI_PALETTE['card_bg']};
            padding: 1.25rem;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
            border: 1px solid rgba(0,0,0,0.02);
        }}
        
        div[data-testid="stMetricLabel"] {{
            font-size: 0.75rem !important;
            color: {MORANDI_PALETTE['text_light']} !important;
            font-weight: 500 !important;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }}
        
        div[data-testid="stMetricValue"] {{
            font-size: 1.5rem !important;
            font-weight: 600 !important;
            color: {MORANDI_PALETTE['primary']} !important;
        }}
        
        .stPlotlyChart {{
            border-radius: 12px;
            overflow: hidden;
        }}
        
        .dataframe-view {{
            background-color: {MORANDI_PALETTE['card_bg']};
            border-radius: 12px;
            padding: 1rem;
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }}
        
        .download-section {{
            display: flex;
            justify-content: flex-end;
            margin-bottom: 1rem;
        }}
        
        .stDataFrame {{
            border-radius: 12px;
            overflow: hidden;
        }}
        
        div.stButton > button {{
            border-radius: 8px;
            font-weight: 500;
        }}
        
        div.stButton > button:first-of-type {{
            background: linear-gradient(135deg, {MORANDI_PALETTE['primary']}, {MORANDI_PALETTE['secondary']});
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            transition: all 0.3s ease;
        }}
        
        div.stButton > button:first-of-type:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(139, 157, 195, 0.4);
        }}
        
        .stExpander {{
            background-color: {MORANDI_PALETTE['card_bg']};
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }}
        
        .stTabs [data-baseweb="tab-list"] {{
            gap: 0.5rem;
        }}
        
        .stTabs [data-baseweb="tab"] {{
            border-radius: 8px 8px 0 0;
            padding: 0.75rem 1.25rem;
            font-weight: 500;
        }}
        
        .stCaption {{
            font-size: 0.8rem;
            color: {MORANDI_PALETTE['text_light']};
        }}
        
        .insight-card {{
            background-color: {MORANDI_PALETTE['card_bg']};
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            border-left: 4px solid {MORANDI_PALETTE['primary']};
        }}
        
        hr {{
            margin: 2rem 0;
            border: none;
            border-top: 1px solid rgba(0,0,0,0.06);
        }}
        
        div[data-testid="stHorizontalBlock"] {{
            gap: 1.5rem;
        }}
        
        .block-container > div {{
            gap: 1.5rem;
        }}
        
        @media (max-width: 1200px) {{
            .kpi-container {{
                grid-template-columns: repeat(2, 1fr);
            }}
        }}
        
        @media (max-width: 768px) {{
            .kpi-container {{
                grid-template-columns: 1fr;
            }}
            .main .block-container {{
                padding-left: 1rem;
                padding-right: 1rem;
            }}
        }}
        </style>
    """, unsafe_allow_html=True)


def get_chart_color(index):
    return MORANDI_PALETTE['chart_colors'][index % len(MORANDI_PALETTE['chart_colors'])]
