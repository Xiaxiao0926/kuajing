import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import io
import os
import glob

from utils.ai_service import AIService

ai_service = AIService()

# ----------------------
# 配置
# ----------------------
st.set_page_config(
    page_title="Ozon跨境选品分析面板",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 选品数据目录：环境变量 OZON_DATA_DIR 优先，回退到仓库内 选品/ 目录
import os
DATA_DIR = os.environ.get('OZON_DATA_DIR') or os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '选品')
)

# 高风险关键词（合规风险分用）
HIGH_RISK_KEYWORDS = {
    '化妆品': ['маска', 'шампунь', 'масло для волос', 'крем', 'косметика', 'масло', 'бальзам для губ', 'тоник', 'скраб', 'пенка'],
    '电器': ['фен', 'электрический', 'аккумулятор', 'battery', 'зарядное', 'утюг', 'бритва'],
    '儿童用品': ['детский', 'ребенок', 'baby', 'для детей', 'детские', 'игрушка'],
    '食品': ['food', 'чай', 'кофе', 'напиток', 'конфета', 'шоколад'],
    '医疗': ['медицинский', 'ортопедический', 'лечебный', 'терапевтический'],
    '电池': ['battery', 'аккумулятор', 'батарейка'],
    '液体/喷雾': ['liquid', 'spray', 'oil', 'аэрозоль', 'спрей', 'жидкость'],
}

LOW_RISK_KEYWORDS = [
    'органайзер', 'крючок', 'вешалка', 'щетка', 'ершик', 'уборка',
    'хранение', 'коврик', 'подставка', 'держатель', 'сумка', 'рюкзак',
    'подарок', 'декор', 'аксессуары', 'текстиль', 'одеяло', 'подушка',
    'вантуз', 'трос', 'чистк', 'полка', 'рейл', 'карман', 'коробка',
    'контейнер', 'ящик', 'стеллаж', 'полочка', 'зеркало', 'часы',
    'рамка', 'фоторамка', 'свеча', 'ароматизатор', 'освежитель',
]

# 液体/膏体/电器关键词（物流适配分用）
LIQUID_KEYWORDS = ['масло', 'спрей', 'spray', 'жидкость', 'liquid', 'лак', 'крем', 'шампунь', 'гель', 'аэрозоль', 'тоник', 'лосьон']
FRAGILE_KEYWORDS = ['стекло', 'glass', 'керамика', 'ceramic', 'хрусталь', 'зеркало', 'фарфор']
ELECTRIC_KEYWORDS = ['фен', 'электрический', 'аккумулятор', 'battery', 'зарядное', 'утюг', 'бритва', 'мотор', 'насос']

# 综合评分权重
SCORE_WEIGHTS = {
    'market_demand': 0.25,
    'profit_space': 0.25,
    'logistics_fit': 0.20,
    'compliance': 0.15,
    'differentiation': 0.10,
    'inventory': 0.05,
}

# ----------------------
# 数据加载与清洗
# ----------------------
def find_data_files():
    xlsx_files = glob.glob(os.path.join(DATA_DIR, "*.xlsx"))
    xls_files = glob.glob(os.path.join(DATA_DIR, "*.xls"))
    csv_files = glob.glob(os.path.join(DATA_DIR, "*.csv"))
    all_files = xlsx_files + xls_files + csv_files
    all_files = [f for f in all_files if not os.path.basename(f).startswith('~$')]
    return all_files

def parse_percent(val):
    if pd.isna(val):
        return np.nan
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if s.endswith('%'):
        try:
            return float(s[:-1])
        except:
            return np.nan
    try:
        return float(s)
    except:
        return np.nan

def load_data(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.csv':
        df = pd.read_csv(filepath, encoding='utf-8-sig')
    elif ext == '.xlsx':
        df = pd.read_excel(filepath, engine='openpyxl')
    elif ext == '.xls':
        df = pd.read_excel(filepath, engine='xlrd')
    else:
        return None

    df = df.dropna(axis=1, how='all')
    df = df.dropna(axis=0, how='all')

    percent_cols = [
        '周转动态', '无库存天占比', '促销活动折扣', '促销活动天数占比', '推广天数占比',
        '商品卡加入购物车率', '订单转化率', '点击率', '签收率', '预估毛利率',
        '广告占比', '从搜索加入购物车率', '可用性'
    ]
    for col in percent_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_percent)

    numeric_cols = [
        '商品ID', '商品评分', '评论数', '价格', '平均单价', '平均单价￥',
        'FBS佣金（%）', 'FBO佣金（%）', 'RFBS佣金（%）', 'FBP佣金（%）',
        '最低价格', '最低价格￥', '每日平均订单金额', '每日平均订单金额￥',
        '销售额', '销售额（￥）', '销量', '销售额排名', '转化指数',
        '平均销量', '平均销售额', '平均销售额￥', '期末库存数',
        '促销前的价格', '促销前的价格￥', '潜力价值', '潜力指数',
        '曝光量', '浏览次数', '签收金额', '签收金额￥',
        '广告费用', '广告占比￥', '体积/公升', '收入损失', '收入损失￥',
        '上榜天数', '尺寸-长度（cm）', '尺寸-宽度（cm）', '尺寸-高度（cm）', '重量 g'
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    df['商品评分'] = df['商品评分'].fillna(df['商品评分'].mean())
    df['评论数'] = df['评论数'].fillna(0)
    df['价格'] = df['价格'].fillna(df['价格'].median())
    df['重量 g'] = df['重量 g'].fillna(df['重量 g'].median())

    if '体积/公升' not in df.columns and all(c in df.columns for c in ['尺寸-长度（cm）', '尺寸-宽度（cm）', '尺寸-高度（cm）']):
        df['体积/公升'] = (df['尺寸-长度（cm）'].fillna(10) * df['尺寸-宽度（cm）'].fillna(10) * df['尺寸-高度（cm）'].fillna(10)) / 1000

    return df

# ----------------------
# 1. 市场需求分（0-100）
# ----------------------
def calc_market_demand(df):
    score = pd.Series(0.0, index=df.index)

    # 销量高 +2 → 按分位数映射到 0-20
    if '销量' in df.columns:
        q = df['销量'].quantile([0.25, 0.5, 0.75])
        score += np.where(df['销量'] >= q[0.75], 20,
                 np.where(df['销量'] >= q[0.5], 14,
                 np.where(df['销量'] >= q[0.25], 8, 2)))

    # 销售额高 +2 → 0-20
    if '销售额' in df.columns:
        q = df['销售额'].quantile([0.25, 0.5, 0.75])
        score += np.where(df['销售额'] >= q[0.75], 20,
                 np.where(df['销售额'] >= q[0.5], 14,
                 np.where(df['销售额'] >= q[0.25], 8, 2)))

    # 评分 ≥ 4.5 +1 → 0-10
    if '商品评分' in df.columns:
        score += np.where(df['商品评分'] >= 4.5, 10,
                 np.where(df['商品评分'] >= 4.0, 6,
                 np.where(df['商品评分'] >= 3.5, 3, 0)))

    # 评论数 ≥ 500 +1 → 0-10
    if '评论数' in df.columns:
        score += np.where(df['评论数'] >= 500, 10,
                 np.where(df['评论数'] >= 100, 5,
                 np.where(df['评论数'] >= 20, 2, 0)))

    # 加购率 ≥ 5% +1 → 0-10
    if '商品卡加入购物车率' in df.columns:
        score += np.where(df['商品卡加入购物车率'] >= 5, 10,
                 np.where(df['商品卡加入购物车率'] >= 3, 6,
                 np.where(df['商品卡加入购物车率'] >= 1, 3, 0)))

    # 上榜天数长 +1 → 0-10
    if '上榜天数' in df.columns:
        q = df['上榜天数'].quantile([0.25, 0.5, 0.75])
        score += np.where(df['上榜天数'] >= q[0.75], 10,
                 np.where(df['上榜天数'] >= q[0.5], 6,
                 np.where(df['上榜天数'] >= q[0.25], 3, 0)))

    # 浏览次数 → 0-10
    if '浏览次数' in df.columns:
        q = df['浏览次数'].quantile([0.25, 0.5, 0.75])
        score += np.where(df['浏览次数'] >= q[0.75], 10,
                 np.where(df['浏览次数'] >= q[0.5], 6,
                 np.where(df['浏览次数'] >= q[0.25], 3, 0)))

    # 搜索加购率 → 0-10
    if '从搜索加入购物车率' in df.columns:
        q = df['从搜索加入购物车率'].quantile([0.25, 0.5, 0.75])
        score += np.where(df['从搜索加入购物车率'] >= q[0.75], 10,
                 np.where(df['从搜索加入购物车率'] >= q[0.5], 6,
                 np.where(df['从搜索加入购物车率'] >= q[0.25], 3, 0)))

    return score.clip(0, 100)

# ----------------------
# 2. 竞争难度分（0-100，分越高竞争越难）
# ----------------------
def calc_competition(df):
    score = pd.Series(0.0, index=df.index)

    # 评论数 > 50000 且价格 < 150 → 强惩罚
    if '评论数' in df.columns and '价格' in df.columns:
        score += np.where((df['评论数'] > 50000) & (df['价格'] < 150), 30,
                 np.where(df['评论数'] > 50000, 20,
                 np.where(df['评论数'] > 20000, 15,
                 np.where(df['评论数'] > 10000, 8,
                 np.where(df['评论数'] > 5000, 4, 0)))))

    # 推广天数占比 = 100% → 惩罚
    if '推广天数占比' in df.columns:
        score += np.where(df['推广天数占比'] >= 100, 20,
                 np.where(df['推广天数占比'] >= 80, 12,
                 np.where(df['推广天数占比'] >= 50, 6, 0)))

    # 广告占比 > 15% → 惩罚
    if '广告占比' in df.columns:
        score += np.where(df['广告占比'] > 15, 20,
                 np.where(df['广告占比'] > 10, 12,
                 np.where(df['广告占比'] > 5, 5, 0)))

    # 促销活动天数占比 > 80% → 惩罚
    if '促销活动天数占比' in df.columns:
        score += np.where(df['促销活动天数占比'] > 80, 15,
                 np.where(df['促销活动天数占比'] > 50, 8,
                 np.where(df['促销活动天数占比'] > 30, 4, 0)))

    # 期末库存特别高 → 惩罚
    if '期末库存数' in df.columns:
        q = df['期末库存数'].quantile([0.75, 0.9])
        score += np.where(df['期末库存数'] > q[0.9], 10,
                 np.where(df['期末库存数'] > q[0.75], 5, 0))

    # 头部价格极低 → 惩罚
    if '最低价格' in df.columns and '价格' in df.columns:
        price_ratio = df['最低价格'] / df['价格'].replace(0, np.nan)
        score += np.where(price_ratio < 0.5, 10,
                 np.where(price_ratio < 0.7, 5, 0))

    # 销售额排名越靠前竞争越激烈
    if '销售额排名' in df.columns:
        score += np.where(df['销售额排名'] <= 100, 5,
                 np.where(df['销售额排名'] <= 500, 3, 0))

    return score.clip(0, 100)

# ----------------------
# 3. 利润空间分（0-100）+ 利润测算字段
# ----------------------
def calc_profit(df, params):
    rate = params.get('exchange_rate', 0.09)
    procurement = params.get('procurement_cost', 15.0)
    domestic_ship = params.get('domestic_shipping', 2.0)
    label_pack = params.get('label_packing', 1.0)
    cross_border = params.get('cross_border_rate', 40.0)
    return_rate = params.get('return_rate', 0.05)
    target_margin = params.get('target_margin', 0.20)

    if '价格' not in df.columns:
        df['售价(¥)'] = 0
        df['平台佣金(¥)'] = 0
        df['广告费(¥)'] = 0
        df['跨境物流(¥)'] = 0
        df['退货损失(¥)'] = 0
        df['总成本(¥)'] = 0
        df['预估利润(¥)'] = 0
        df['利润率'] = 0
        df['保本售价(¥)'] = 0
        df['建议售价(¥)'] = 0
        df['是否值得测品'] = '否'
        return pd.Series(0.0, index=df.index)

    df['售价(¥)'] = df['价格'] * rate

    fee_rate = df['RFBS佣金（%）'].fillna(df['FBS佣金（%）']).fillna(15) / 100
    df['平台佣金(¥)'] = df['售价(¥)'] * fee_rate
    df['广告费(¥)'] = df['售价(¥)'] * df['广告占比'].fillna(0) / 100
    df['跨境物流(¥)'] = (df['重量 g'].fillna(200) / 1000) * cross_border
    df['退货损失(¥)'] = df['售价(¥)'] * return_rate

    df['总成本(¥)'] = (procurement + domestic_ship + label_pack +
                       df['跨境物流(¥)'] + df['平台佣金(¥)'] +
                       df['广告费(¥)'] + df['退货损失(¥)'])

    df['预估利润(¥)'] = df['售价(¥)'] - df['总成本(¥)']
    df['利润率'] = (df['预估利润(¥)'] / df['售价(¥)'].replace(0, np.nan)).fillna(0)

    # 保本售价 = 总成本 / (1 - 佣金率 - 广告占比/100 - 退货率)
    denom = 1 - fee_rate - df['广告占比'].fillna(0) / 100 - return_rate
    denom = denom.replace(0, 0.01).clip(lower=0.01)
    fixed_cost = procurement + domestic_ship + label_pack + df['跨境物流(¥)']
    df['保本售价(¥)'] = (fixed_cost / denom).round(2)

    # 建议售价 = 保本售价 / (1 - 目标利润率)
    df['建议售价(¥)'] = (df['保本售价(¥)'] / (1 - target_margin)).round(2)

    # 是否值得测品
    df['是否值得测品'] = np.where(
        (df['利润率'] >= target_margin) & (df['售价(¥)'] > df['总成本(¥)']),
        '是', np.where(df['利润率'] >= 0.10, '可考虑', '否')
    )

    # 利润空间评分
    margin = df['利润率']
    score = np.where(margin >= 0.30, 100,
            np.where(margin >= 0.25, 85,
            np.where(margin >= 0.20, 70,
            np.where(margin >= 0.15, 50,
            np.where(margin >= 0.10, 30,
            np.where(margin >= 0.05, 15, 0))))))

    return pd.Series(score, index=df.index).clip(0, 100)

# ----------------------
# 4. 物流适配分（0-100）
# ----------------------
def calc_logistics(df):
    score = pd.Series(60.0, index=df.index)

    # 重量 50-500g 优先
    if '重量 g' in df.columns:
        w = df['重量 g'].fillna(200)
        score += np.where((w >= 50) & (w <= 500), 20,
                 np.where((w >= 30) & (w <= 800), 10,
                 np.where(w > 1000, -15, 0)))

    # 体积 < 2L 优先
    if '体积/公升' in df.columns:
        v = df['体积/公升'].fillna(0.5)
        score += np.where(v < 2, 15,
                 np.where(v < 5, 5,
                 np.where(v > 10, -15, -5)))

    # 长边 < 45cm 优先
    if '尺寸-长度（cm）' in df.columns:
        l = df['尺寸-长度（cm）'].fillna(20)
        score += np.where(l < 45, 10,
                 np.where(l < 60, 3,
                 np.where(l > 80, -10, -5)))

    # 体积重计算与提示
    if all(c in df.columns for c in ['尺寸-长度（cm）', '尺寸-宽度（cm）', '尺寸-高度（cm）']):
        vol_weight = (df['尺寸-长度（cm）'].fillna(20) * df['尺寸-宽度（cm）'].fillna(20) * df['尺寸-高度（cm）'].fillna(20)) / 6000
        actual_weight = df['重量 g'].fillna(200) / 1000
        df['体积重(kg)'] = vol_weight
        df['计费重(kg)'] = np.maximum(vol_weight, actual_weight)

    # 是否超长
    if '尺寸-长度（cm）' in df.columns:
        df['是否超长'] = np.where(df['尺寸-长度（cm）'].fillna(20) > 60, '是', '否')

    # 是否易碎/液体/电器（基于关键词识别）
    if '商品名称' in df.columns:
        names = df['商品名称'].fillna('').str.lower()
        df['是否易碎'] = '否'
        df['是否液体'] = '否'
        df['是否电器'] = '否'
        for kw in FRAGILE_KEYWORDS:
            mask = names.str.contains(kw, na=False)
            df.loc[mask, '是否易碎'] = '是'
            score = score.where(~mask, score - 5)
        for kw in LIQUID_KEYWORDS:
            mask = names.str.contains(kw, na=False)
            df.loc[mask, '是否液体'] = '是'
            score = score.where(~mask, score - 8)
        for kw in ELECTRIC_KEYWORDS:
            mask = names.str.contains(kw, na=False)
            df.loc[mask, '是否电器'] = '是'
            score = score.where(~mask, score - 8)

    # 签收率
    if '签收率' in df.columns:
        d = df['签收率'].fillna(80)
        score += np.where(d >= 95, 5,
                 np.where(d >= 90, 3,
                 np.where(d < 80, -5, 0)))

    return score.clip(0, 100)

# ----------------------
# 5. 合规风险分（0-100，分越低风险越高）
# ----------------------
def calc_compliance(df):
    score = pd.Series(85.0, index=df.index)
    df['合规风险类型'] = '低风险'

    if '商品名称' in df.columns:
        names = df['商品名称'].fillna('').str.lower()
        risk_tags = pd.Series([''], index=df.index)

        for category, keywords in HIGH_RISK_KEYWORDS.items():
            for kw in keywords:
                mask = names.str.contains(kw.lower(), na=False)
                score = score.where(~mask, score - 25)
                risk_tags = risk_tags.where(~mask, risk_tags + category + '; ')

        for kw in LOW_RISK_KEYWORDS:
            mask = names.str.contains(kw.lower(), na=False)
            score = score.where(~mask, score + 5)

        df['合规风险类型'] = risk_tags.str.strip('; ').replace('', '低风险')

    if '商品评分' in df.columns:
        score = np.where(df['商品评分'] < 3.5, score - 15, score)

    return score.clip(0, 100)

# ----------------------
# 6. 差异化机会分（0-100）
# ----------------------
def calc_differentiation(df):
    score = pd.Series(50.0, index=df.index)

    # 评论数适中（有市场但竞争不极端）
    if '评论数' in df.columns:
        r = df['评论数'].fillna(0)
        score += np.where((r >= 100) & (r <= 5000), 25,
                 np.where((r >= 50) & (r <= 10000), 12,
                 np.where(r > 20000, -10, 0)))

    # 广告占比低（自然流量机会大）
    if '广告占比' in df.columns:
        a = df['广告占比'].fillna(0)
        score += np.where(a < 3, 20,
                 np.where(a < 5, 15,
                 np.where(a < 10, 8,
                 np.where(a > 15, -10, 0))))

    # 评分偏低但有市场 → 差异化机会
    if '商品评分' in df.columns and '评论数' in df.columns:
        score += np.where((df['商品评分'] < 4.0) & (df['评论数'] > 100), 10, 0)

    return score.clip(0, 100)

# ----------------------
# 7. 库存机会分（0-100）
# ----------------------
def calc_inventory(df):
    score = pd.Series(30.0, index=df.index)

    if '无库存天占比' in df.columns:
        o = df['无库存天占比'].fillna(0)
        score += np.where(o > 30, 40,
                 np.where(o > 10, 20,
                 np.where(o > 5, 10, 0)))

    if '期末库存数' in df.columns:
        score += np.where(df['期末库存数'].fillna(999) < 50, 20,
                 np.where(df['期末库存数'].fillna(999) < 100, 10, 0))

    if '周转动态' in df.columns:
        t = df['周转动态'].fillna(0)
        score += np.where(t > 50, 10,
                 np.where(t > 20, 5, 0))

    return score.clip(0, 100)

# ----------------------
# 综合评分与分类
# ----------------------
def classify(row):
    if (row['综合评分'] >= 70 and row['合规安全分'] >= 70 and
        row['利润空间分'] >= 60 and row['物流适配分'] >= 60):
        return 'A'
    if (row['市场需求分'] >= 60 and row['物流适配分'] >= 50 and
        row['合规安全分'] >= 70 and row['综合评分'] >= 50):
        return 'B'
    if (row['市场需求分'] >= 40 and row['合规安全分'] >= 60 and
        row['综合评分'] >= 30):
        return 'C'
    return 'D'

def strategy(row):
    return {'A': '✅ 立即测品 - 可直接采购小批量测试',
            'B': '🔄 套装改造 - 通过组合/升级提高竞争力',
            'C': '🔍 供应链调研 - 需进一步分析成本和竞争',
            'D': '❌ 暂不建议 - 风险较高或竞争力弱'}[row['推荐等级']]

def risk_reason(row):
    reasons = []
    if row['合规安全分'] < 70: reasons.append(f"合规风险({row.get('合规风险类型', '')})")
    if row['利润空间分'] < 40: reasons.append('利润空间不足')
    if row['物流适配分'] < 40: reasons.append('物流适配性差')
    if row['竞争难度分'] > 60: reasons.append('竞争壁垒高')
    if row['市场需求分'] < 30: reasons.append('市场需求低')
    if row.get('是否超长') == '是': reasons.append('超长件')
    if row.get('是否液体') == '是': reasons.append('液体/膏体')
    if row.get('是否电器') == '是': reasons.append('电器产品')
    return '; '.join(reasons) if reasons else '无明显风险'

def action_suggestion(row):
    if row['推荐等级'] == 'A':
        return '建议立即采购50-100件进行RFBS直发测试，观察首月销量和利润表现'
    elif row['推荐等级'] == 'B':
        tips = []
        if row['利润空间分'] < 60: tips.append('考虑组合套装提高客单价')
        if row['竞争难度分'] > 50: tips.append('做差异化设计/升级款')
        if row.get('是否液体') == '是' or row.get('是否电器') == '是': tips.append('注意合规认证')
        return '；'.join(tips) if tips else '建议考虑组合销售、多件装或升级款'
    elif row['推荐等级'] == 'C':
        return '建议先联系供应商获取准确报价，同时分析竞品评论找差异化机会'
    else:
        return '建议暂时放弃，或寻找同类目中竞争较小的细分产品'

def score_all(df, params):
    df['市场需求分'] = calc_market_demand(df)
    df['利润空间分'] = calc_profit(df, params)
    df['物流适配分'] = calc_logistics(df)
    df['合规安全分'] = calc_compliance(df)
    df['差异化机会分'] = calc_differentiation(df)
    df['库存机会分'] = calc_inventory(df)
    df['竞争难度分'] = calc_competition(df)

    df['综合评分'] = (
        df['市场需求分'] * SCORE_WEIGHTS['market_demand'] +
        df['利润空间分'] * SCORE_WEIGHTS['profit_space'] +
        df['物流适配分'] * SCORE_WEIGHTS['logistics_fit'] +
        df['合规安全分'] * SCORE_WEIGHTS['compliance'] +
        df['差异化机会分'] * SCORE_WEIGHTS['differentiation'] +
        df['库存机会分'] * SCORE_WEIGHTS['inventory'] -
        df['竞争难度分']
    ).clip(0, 100)

    df['推荐等级'] = df.apply(classify, axis=1)
    df['推荐策略'] = df.apply(strategy, axis=1)
    df['风险原因'] = df.apply(risk_reason, axis=1)
    df['操作建议'] = df.apply(action_suggestion, axis=1)
    return df

# ----------------------
# 页面渲染
# ----------------------
def render_overview(df):
    st.subheader("📊 数据概览")
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("总商品数", df.shape[0])
    c2.metric("A类·直接可测", int((df['推荐等级'] == 'A').sum()))
    c3.metric("B类·套装改造", int((df['推荐等级'] == 'B').sum()))
    c4.metric("C类·供应链观察", int((df['推荐等级'] == 'C').sum()))
    c5.metric("D类·暂不建议", int((df['推荐等级'] == 'D').sum()))

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("平均价格(₽)", f"{df['价格'].mean():.0f}")
    c2.metric("平均销量", f"{df['销量'].mean():.0f}")
    c3.metric("平均评分", f"{df['商品评分'].mean():.2f}")
    c4.metric("平均广告占比", f"{df['广告占比'].mean():.1f}%")
    c5.metric("平均重量(g)", f"{df['重量 g'].mean():.0f}")

    st.subheader("📈 数据分布")
    r1c1, r1c2 = st.columns(2)
    with r1c1:
        cat = df['所属类目'].value_counts().head(10)
        fig = px.bar(x=cat.index, y=cat.values, title='TOP10类目分布', labels={'y': '商品数', 'x': '类目'})
        fig.update_layout(height=320, xaxis_tickangle=-30)
        st.plotly_chart(fig, use_container_width=True)
    with r1c2:
        cc = df['推荐等级'].value_counts()
        fig = px.pie(values=cc.values, names=cc.index, title='推荐等级分布',
                     color_discrete_map={'A': '#10B981', 'B': '#3B82F6', 'C': '#F59E0B', 'D': '#EF4444'})
        fig.update_layout(height=320)
        st.plotly_chart(fig, use_container_width=True)

    r2c1, r2c2 = st.columns(2)
    with r2c1:
        bins = [0, 200, 400, 600, 800, 1000, 2000, 50000]
        labels = ['<200', '200-400', '400-600', '600-800', '800-1k', '1k-2k', '>2k']
        pc = pd.cut(df['价格'], bins=bins, labels=labels).value_counts().sort_index()
        fig = px.bar(x=pc.index, y=pc.values, title='价格带分布(₽)', labels={'y': '商品数', 'x': '价格区间'})
        fig.update_layout(height=320)
        st.plotly_chart(fig, use_container_width=True)
    with r2c2:
        bins = [0, 100, 300, 500, 1000, 2000, 100000]
        labels = ['<100g', '100-300g', '300-500g', '500-1kg', '1-2kg', '>2kg']
        wc = pd.cut(df['重量 g'], bins=bins, labels=labels).value_counts().sort_index()
        fig = px.bar(x=wc.index, y=wc.values, title='重量段分布', labels={'y': '商品数', 'x': '重量区间'})
        fig.update_layout(height=320)
        st.plotly_chart(fig, use_container_width=True)

def render_filter(df):
    st.subheader("🔍 产品筛选表")

    min_score = st.sidebar.slider("最低综合评分", 0, 100, 0)
    rec_class = st.sidebar.multiselect("推荐等级", ['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D'])
    min_price = st.sidebar.number_input("最低价格(₽)", 0, 100000, 0, 100)
    max_price = st.sidebar.number_input("最高价格(₽)", 0, 100000, 100000, 100)
    min_weight = st.sidebar.number_input("最小重量(g)", 0, 100000, 0, 100)
    max_weight = st.sidebar.number_input("最大重量(g)", 0, 100000, 100000, 100)

    filtered = df[
        (df['综合评分'] >= min_score) &
        (df['推荐等级'].isin(rec_class)) &
        (df['价格'] >= min_price) &
        (df['价格'] <= max_price) &
        (df['重量 g'] >= min_weight) &
        (df['重量 g'] <= max_weight)
    ].copy()

    sort_map = {'综合评分': '综合评分', '利润空间分': '利润空间分', '市场需求分': '市场需求分',
                '物流适配分': '物流适配分', '竞争难度分': '竞争难度分',
                '价格': '价格', '销量': '销量', '广告占比': '广告占比', '重量': '重量 g'}
    sort_by = st.selectbox("排序方式", list(sort_map.keys()))
    sort_asc = st.checkbox("升序排列", False)
    filtered = filtered.sort_values(by=sort_map[sort_by], ascending=sort_asc)

    show_cols = ['商品ID', '商品名称', '所属类目', '价格', '重量 g', '商品评分', '评论数', '销量',
                 '广告占比', '市场需求分', '利润空间分', '物流适配分', '合规安全分',
                 '竞争难度分', '综合评分', '推荐等级', '推荐策略']
    st.dataframe(filtered[show_cols], use_container_width=True, height=600)
    st.caption(f"共 {len(filtered)} 条结果")

    if not filtered.empty:
        selected = st.selectbox("选择商品查看详情", filtered['商品名称'].head(50))
        if st.button("📋 查看单品详情"):
            st.session_state['selected_product'] = selected
            st.session_state['active_tab'] = '单品详情'

def render_category(df):
    st.subheader("📦 类目分析")
    cat_stats = df.groupby('所属类目').agg(
        商品数=('商品ID', 'count'),
        平均销量=('销量', 'mean'),
        平均价格=('价格', 'mean'),
        平均评分=('商品评分', 'mean'),
        平均综合评分=('综合评分', 'mean'),
        A类占比=('推荐等级', lambda x: (x == 'A').mean() * 100)
    ).sort_values('平均综合评分', ascending=False)

    st.dataframe(cat_stats.round(2), use_container_width=True)

    top10 = cat_stats.head(10)
    fig = make_subplots(rows=2, cols=2, subplot_titles=('平均销量', '平均价格', '平均评分', 'A类占比(%)'))
    fig.add_trace(go.Bar(x=top10.index, y=top10['平均销量'], name='平均销量'), row=1, col=1)
    fig.add_trace(go.Bar(x=top10.index, y=top10['平均价格'], name='平均价格'), row=1, col=2)
    fig.add_trace(go.Bar(x=top10.index, y=top10['平均评分'], name='平均评分'), row=2, col=1)
    fig.add_trace(go.Bar(x=top10.index, y=top10['A类占比'], name='A类占比'), row=2, col=2)
    fig.update_layout(height=600, showlegend=False, xaxis_tickangle=-30)
    st.plotly_chart(fig, use_container_width=True)

def render_profit(df, params):
    st.subheader("💰 利润测算")
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    c1.metric("汇率", params['exchange_rate'])
    c2.metric("采购成本(¥)", f"{params['procurement_cost']:.0f}")
    c3.metric("国内物流(¥)", f"{params['domestic_shipping']:.1f}")
    c4.metric("贴标包装(¥)", f"{params['label_packing']:.1f}")
    c5.metric("跨境物流(¥/kg)", f"{params['cross_border_rate']:.0f}")
    c6.metric("退货损失率", f"{params['return_rate']*100:.0f}%")

    show = ['商品名称', '价格', '售价(¥)', '重量 g', '平台佣金(¥)', '广告费(¥)',
            '跨境物流(¥)', '总成本(¥)', '预估利润(¥)', '利润率',
            '保本售价(¥)', '建议售价(¥)', '是否值得测品']
    show = [c for c in show if c in df.columns]
    p = df.sort_values('利润率', ascending=False)
    st.dataframe(p[show].round(2), use_container_width=True, height=600)

def render_detail(df, params):
    st.subheader("🎯 单品详情分析")
    if 'selected_product' not in st.session_state:
        st.info("请在「产品筛选」页选择一个商品")
        return

    name = st.session_state['selected_product']
    row = df[df['商品名称'] == name].iloc[0]

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("商品ID", row['商品ID'])
    c2.metric("品牌", row.get('品牌', '未知'))
    c3.metric("类目", row['所属类目'])
    c4.metric("推荐等级", row['推荐等级'])

    if pd.notna(row.get('图片链接')):
        st.image(row['图片链接'], width=250)

    st.subheader("📊 评分详情")
    scores = {'市场需求分': row['市场需求分'], '利润空间分': row['利润空间分'],
              '物流适配分': row['物流适配分'], '合规安全分': row['合规安全分'],
              '差异化机会分': row['差异化机会分'], '库存机会分': row['库存机会分'],
              '竞争难度分': row['竞争难度分']}
    c1, c2, c3 = st.columns(3)
    for i, (k, v) in enumerate(scores.items()):
        with [c1, c2, c3][i % 3]:
            st.progress(int(v) / 100)
            st.write(f"**{k}**: {v:.1f}")
    st.metric("综合评分", f"{row['综合评分']:.1f}")

    # 物流标签
    st.subheader("📦 物流标签")
    tags = []
    if row.get('是否超长') == '是': tags.append('📏 超长件')
    if row.get('是否易碎') == '是': tags.append('💔 易碎品')
    if row.get('是否液体') == '是': tags.append('💧 液体/膏体')
    if row.get('是否电器') == '是': tags.append('⚡ 电器产品')
    if tags:
        st.warning('  '.join(tags))
    else:
        st.success('无特殊物流标签')

    # 合规风险类型
    st.subheader("⚖️ 合规风险")
    risk_type = row.get('合规风险类型', '低风险')
    if risk_type != '低风险':
        st.error(f"⚠️ {risk_type}")
    else:
        st.success("✅ 低风险品类")

    # 利润测算
    st.subheader("💰 利润测算")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("售价(¥)", f"{row.get('售价(¥)', 0):.2f}")
    c2.metric("总成本(¥)", f"{row.get('总成本(¥)', 0):.2f}")
    c3.metric("预估利润(¥)", f"{row.get('预估利润(¥)', 0):.2f}")
    c4.metric("利润率", f"{row.get('利润率', 0)*100:.1f}%")

    c1, c2, c3 = st.columns(3)
    c1.metric("保本售价(¥)", f"{row.get('保本售价(¥)', 0):.2f}")
    c2.metric("建议售价(¥)", f"{row.get('建议售价(¥)', 0):.2f}")
    c3.metric("是否值得测品", row.get('是否值得测品', '否'))

    st.subheader("⚠️ 风险提示")
    st.warning(row['风险原因'])
    st.subheader("💡 操作建议")
    st.success(row['操作建议'])

def render_export(df):
    st.subheader("📥 数据导出")
    all_cols = df.columns.tolist()
    default_cols = ['商品ID', '商品名称', '所属类目', '价格', '重量 g', '商品评分', '评论数', '销量',
                    '广告占比', '市场需求分', '利润空间分', '物流适配分', '合规安全分',
                    '竞争难度分', '综合评分', '推荐等级', '推荐策略', '风险原因', '操作建议',
                    '售价(¥)', '总成本(¥)', '预估利润(¥)', '利润率', '保本售价(¥)', '建议售价(¥)', '是否值得测品']
    default_cols = [c for c in default_cols if c in all_cols]
    selected = st.multiselect("选择导出字段", all_cols, default=default_cols)

    buf = io.BytesIO()
    df[selected].to_excel(buf, index=False, engine='openpyxl')
    buf.seek(0)
    st.download_button("⬇️ 下载分析结果 Excel", buf, "ozon_product_analysis.xlsx",
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    c1, c2, c3 = st.columns(3)
    c1.metric("导出商品数", len(df))
    c2.metric("导出字段数", len(selected))
    c3.metric("A类商品数", int((df['推荐等级'] == 'A').sum()))

# ----------------------
# 主程序
# ----------------------
def render_ai_config():
    st.sidebar.subheader("🤖 AI模型配置")
    
    models = ai_service.get_models()
    model_options = {m['name']: m['id'] for m in models}
    
    selected_model_name = next((m['name'] for m in models if m['id'] == ai_service.config.get('default_model')), 'GPT-4o')
    selected_model = st.sidebar.selectbox("选择模型", list(model_options.keys()), index=list(model_options.keys()).index(selected_model_name))
    
    if st.sidebar.button("应用模型"):
        ai_service.save_config({'default_model': model_options[selected_model]})
        st.sidebar.success(f"已切换到 {selected_model}")
    
    current_model_info = next((m for m in models if m['id'] == ai_service.config.get('default_model')), None)
    if current_model_info:
        st.sidebar.info(f"当前模型: {current_model_info['name']}\n\n{current_model_info['description']}")
    
    provider = current_model_info['provider'] if current_model_info else 'openai'
    
    if provider == 'openai':
        st.sidebar.subheader("OpenAI 配置")
        api_key = st.sidebar.text_input("OpenAI API Key", ai_service.config.get('openai_api_key', ''), type='password')
        base_url = st.sidebar.text_input("API Base URL", ai_service.config.get('openai_base_url', 'https://api.openai.com/v1'))
        if st.sidebar.button("保存OpenAI配置"):
            ai_service.save_config({'openai_api_key': api_key, 'openai_base_url': base_url})
            st.sidebar.success("配置已保存")
    elif provider == 'baidu':
        st.sidebar.subheader("百度文心一言配置")
        api_key = st.sidebar.text_input("API Key", ai_service.config.get('baidu_api_key', ''), type='password')
        secret_key = st.sidebar.text_input("Secret Key", ai_service.config.get('baidu_secret_key', ''), type='password')
        if st.sidebar.button("保存百度配置"):
            ai_service.save_config({'baidu_api_key': api_key, 'baidu_secret_key': secret_key})
            st.sidebar.success("配置已保存")
    
    if ai_service.is_configured():
        st.sidebar.success("✅ API已配置")
    else:
        st.sidebar.warning("⚠️ 请配置API Key")
    
    return model_options[selected_model]

def main():
    st.title("🇷🇺 Ozon跨境选品分析面板")
    st.markdown("---")

    if 'params' not in st.session_state:
        st.session_state['params'] = {
            'exchange_rate': 0.09,
            'procurement_cost': 15.0,
            'domestic_shipping': 2.0,
            'label_packing': 1.0,
            'cross_border_rate': 40.0,
            'return_rate': 0.05,
            'target_margin': 0.20,
        }

    st.sidebar.title("⚙️ 参数设置")
    
    selected_model = render_ai_config()
    
    st.sidebar.markdown("---")
    
    st.sidebar.subheader("汇率与成本")
    p = st.session_state['params']
    p['exchange_rate'] = st.sidebar.number_input("汇率 (₽→¥)", 0.01, 0.20, 0.09, 0.01)
    p['procurement_cost'] = st.sidebar.number_input("采购成本(¥)", 0.0, 500.0, 15.0, 1.0)
    p['domestic_shipping'] = st.sidebar.number_input("国内物流费(¥)", 0.0, 50.0, 2.0, 0.5)
    p['label_packing'] = st.sidebar.number_input("贴标包装费(¥)", 0.0, 50.0, 1.0, 0.5)
    p['cross_border_rate'] = st.sidebar.number_input("跨境物流单价(¥/kg)", 20.0, 200.0, 40.0, 5.0)
    p['return_rate'] = st.sidebar.number_input("退货损失率", 0.00, 0.50, 0.05, 0.01)
    p['target_margin'] = st.sidebar.number_input("目标利润率", 0.05, 0.50, 0.20, 0.05)

    data_files = find_data_files()
    if not data_files:
        st.error(f"未在 `{DATA_DIR}` 目录下找到数据文件（.xlsx/.xls/.csv）")
        st.stop()

    file_options = {os.path.basename(f): f for f in data_files}
    selected_file = st.sidebar.selectbox("📁 选择数据文件", list(file_options.keys()), index=0)

    @st.cache_data
    def load_cached(path):
        return load_data(path)

    df = load_cached(file_options[selected_file])
    if df is None:
        st.error("数据加载失败")
        st.stop()

    df = score_all(df, p)

    st.sidebar.subheader("筛选条件")
    tab_names = ["总览", "产品筛选", "类目分析", "利润测算", "单品详情", "导出", "AI分析"]
    tabs = st.tabs(tab_names)

    with tabs[0]:
        render_overview(df)
    with tabs[1]:
        render_filter(df)
    with tabs[2]:
        render_category(df)
    with tabs[3]:
        render_profit(df, p)
    with tabs[4]:
        render_detail(df, p)
    with tabs[5]:
        render_export(df)

if __name__ == "__main__":
    main()
