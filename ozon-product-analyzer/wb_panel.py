"""
WB跨境利润与物流费用核算面板
独立核算单元，基于《WB跨境利润与物流费用核算面板-需求规格说明书》开发。
"""
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from decimal import Decimal
from datetime import datetime, date
import os
import io

import wb_calc
import wb_data

# ----------------------
# 页面配置
# ----------------------
st.set_page_config(
    page_title="WB跨境利润与物流费用核算面板",
    page_icon="🚚",
    layout="wide",
    initial_sidebar_state="expanded"
)

# WB佣金文件路径
COMMISSION_FILE = r"d:\ozon\运费计算\wb佣金.xlsx"


# ----------------------
# 会话状态初始化
# ----------------------
def init_state():
    if 'settings' not in st.session_state:
        st.session_state.settings = wb_data.load_settings()
    if 'tariffs' not in st.session_state:
        st.session_state.tariffs = wb_data.load_tariffs()
    if 'skus' not in st.session_state:
        st.session_state.skus = wb_data.load_skus()
    if 'orders' not in st.session_state:
        st.session_state.orders = wb_data.load_orders()


init_state()


# ----------------------
# 工具函数
# ----------------------
def fmt_cny(val):
    if val is None:
        return '—'
    try:
        return f"¥{float(val):,.2f}"
    except (ValueError, TypeError):
        return '—'


def fmt_rub(val):
    if val is None:
        return '—'
    try:
        return f"₽{float(val):,.2f}"
    except (ValueError, TypeError):
        return '—'


def fmt_pct(val):
    if val is None:
        return '—'
    try:
        return f"{float(val):.1f}%"
    except (ValueError, TypeError):
        return '—'


def to_float(val):
    if val is None or val == '':
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


@st.cache_data(ttl=3600, show_spinner=False)
def load_commission_data():
    """加载WB佣金表"""
    if not os.path.exists(COMMISSION_FILE):
        return None
    try:
        df = pd.read_excel(COMMISSION_FILE)
        df.columns = ['品类', '商品', '佣金率']
        return df
    except Exception:
        return None


def search_commission(keyword):
    """搜索品类佣金率"""
    df = load_commission_data()
    if df is None:
        return None
    if not keyword:
        return df.head(20)
    mask = df['品类'].astype(str).str.contains(keyword, case=False, na=False) | \
           df['商品'].astype(str).str.contains(keyword, case=False, na=False)
    return df[mask].head(30)


# ----------------------
# 侧边栏
# ----------------------
with st.sidebar:
    st.title("🚚 WB跨境核算")
    st.caption("独立核算单元 V1.0")

    page = st.radio(
        "功能模块",
        ["📊 总览", "🧮 单订单核算器", "📦 SKU利润表", "🔀 线路对比", "⚙️ 费率管理", "📋 订单与对账", "💸 佣金查询"],
        index=0
    )

    st.divider()
    st.subheader("全局设置")

    s = st.session_state.settings
    rub_per_cny = st.number_input(
        "汇率 (1¥ = ?₽)",
        min_value=0.0, value=float(s.get('rub_per_cny', 12)), step=0.1, format="%.4f"
    )
    tax_method = st.selectbox(
        "税费方式",
        ['none', 'manual', 'revenue', 'settlement'],
        index=['none', 'manual', 'revenue', 'settlement'].index(s.get('tax_method', 'none')),
        format_func=lambda x: {'none': '不计税', 'manual': '手工录入', 'revenue': '按销售收入%', 'settlement': '按平台净结算%'}[x]
    )
    tax_rate = st.number_input(
        "税率 %",
        min_value=0.0, max_value=100.0, value=float(s.get('tax_rate', 0)), step=0.5
    )
    profit_threshold = st.number_input(
        "利润率预警阈值 %",
        min_value=-100.0, max_value=100.0, value=float(s.get('profit_margin_threshold', 10)), step=1.0
    )
    logistics_threshold = st.number_input(
        "物流费率预警阈值 %",
        min_value=0.0, max_value=100.0, value=float(s.get('logistics_ratio_threshold', 30)), step=1.0
    )

    if st.button("💾 保存设置", use_container_width=True):
        st.session_state.settings.update({
            'rub_per_cny': rub_per_cny,
            'tax_method': tax_method,
            'tax_rate': tax_rate,
            'profit_margin_threshold': profit_threshold,
            'logistics_ratio_threshold': logistics_threshold,
        })
        wb_data.save_settings(st.session_state.settings)
        st.success("设置已保存")
        st.rerun()

    st.caption(f"费率生效: {s.get('exchange_rate_effective_from', '—')}")
    if tax_method != 'none':
        st.caption("⚠️ 税费仅按所选测算口径计算，不构成税务或合规结论。")

    st.divider()
    if st.button("🔄 重置为默认费率", use_container_width=True):
        wb_data.reset_to_default()
        st.session_state.tariffs = wb_data.load_tariffs()
        st.session_state.settings = wb_data.load_settings()
        st.success("已重置")
        st.rerun()


# ----------------------
# 页面：总览
# ----------------------
def page_overview():
    st.header("📊 经营总览")
    orders = st.session_state.orders
    tariffs = st.session_state.tariffs
    settings = st.session_state.settings

    if not orders:
        st.info("暂无订单数据，请前往「订单与对账」导入或添加订单。")
        return

    # 筛选
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        date_range = st.date_input("日期范围", value=(datetime(2020, 1, 1), datetime.now()), key="ov_date")
    with col2:
        sku_filter = st.selectbox("SKU", ['全部'] + list({o.get('sku_id', '') for o in orders}))
    with col3:
        route_filter = st.selectbox("线路", ['全部'] + list({o.get('route_id', '') for o in orders}))
    with col4:
        status_filter = st.selectbox("状态", ['全部'] + list({o.get('status', '') for o in orders}))

    # 过滤订单
    filtered = orders
    if sku_filter != '全部':
        filtered = [o for o in filtered if o.get('sku_id') == sku_filter]
    if route_filter != '全部':
        filtered = [o for o in filtered if o.get('route_id') == route_filter]
    if status_filter != '全部':
        filtered = [o for o in filtered if o.get('status') == status_filter]

    if not filtered:
        st.warning("无匹配订单")
        return

    # 计算指标
    total_orders = len(filtered)
    total_revenue_rub = sum(float(o.get('seller_revenue_base_rub', 0) or 0) for o in filtered)
    total_revenue_cny = total_revenue_rub / float(settings.get('rub_per_cny', 12)) if settings.get('rub_per_cny') else 0
    total_logistics = sum(float(o.get('actual_logistics_cny', 0) or o.get('estimated_logistics_cny', 0) or 0) for o in filtered)
    avg_logistics = total_logistics / total_orders if total_orders else 0
    logistics_ratio = total_logistics / total_revenue_cny * 100 if total_revenue_cny else 0

    # 指标卡
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("订单数", total_orders)
    c2.metric("销售收入", fmt_cny(total_revenue_cny), f"{fmt_rub(total_revenue_rub)}")
    c3.metric("总物流费", fmt_cny(total_logistics))
    c4.metric("平均每单物流", fmt_cny(avg_logistics))
    c5.metric("物流费率", fmt_pct(logistics_ratio))

    st.divider()

    # 订单状态分布
    status_counts = pd.Series([o.get('status', '未知') for o in filtered]).value_counts().reset_index()
    status_counts.columns = ['状态', '数量']

    c1, c2 = st.columns(2)
    with c1:
        st.subheader("订单状态分布")
        fig = px.bar(status_counts, x='状态', y='数量', text='数量', color='数量', color_continuous_scale='Blues')
        fig.update_layout(height=320, margin=dict(l=10, r=10, t=10, b=10))
        st.plotly_chart(fig, use_container_width=True)

    with c2:
        st.subheader("线路订单分布")
        route_counts = pd.Series([o.get('route_id', '未知') for o in filtered]).value_counts().reset_index()
        route_counts.columns = ['线路', '数量']
        fig = px.pie(route_counts, values='数量', names='线路', hole=0.4)
        fig.update_layout(height=320, margin=dict(l=10, r=10, t=10, b=10))
        st.plotly_chart(fig, use_container_width=True)

    # 异常订单预警
    abnormal = [o for o in filtered if o.get('status') in ['买家拒收', '超期未领取', '签收后退货', '丢失/破损']]
    neg_margin = [o for o in filtered if to_float(o.get('operating_profit_cny')) is not None and to_float(o.get('operating_profit_cny')) < 0]
    if abnormal or neg_margin:
        st.subheader("⚠️ 预警")
        if abnormal:
            st.warning(f"异常订单 {len(abnormal)} 单")
        if neg_margin:
            st.error(f"负毛利订单 {len(neg_margin)} 单")

    # 订单明细表
    st.subheader("订单明细")
    df = pd.DataFrame(filtered)
    show_cols = [c for c in ['order_id', 'order_date', 'status', 'sku_id', 'route_id', 'seller_revenue_base_rub', 'estimated_logistics_cny', 'actual_logistics_cny', 'operating_profit_cny'] if c in df.columns]
    st.dataframe(df[show_cols], use_container_width=True, height=300)


# ----------------------
# 页面：单订单核算器
# ----------------------
def page_calculator():
    st.header("🧮 单订单快速核算器")

    tariffs = wb_data.get_active_routes(st.session_state.tariffs)
    settings = st.session_state.settings
    skus = st.session_state.skus

    col1, col2 = st.columns([1, 1])

    with col1:
        st.subheader("输入参数")

        # 选择SKU或手工
        use_sku = st.checkbox("从SKU库选择", value=False)
        selected_sku = None
        if use_sku and skus:
            sku_options = [f"{s.get('sku_id', '')} - {s.get('product_name_cn', '')}" for s in skus]
            sku_idx = st.selectbox("选择SKU", range(len(sku_options)), format_func=lambda i: sku_options[i])
            selected_sku = skus[sku_idx]

        # 商品信息
        col_a, col_b = st.columns(2)
        with col_a:
            if selected_sku:
                product_name = st.text_input("商品名称", value=selected_sku.get('product_name_cn', ''))
                actual_weight_g = st.number_input("含包装重量 (g)", min_value=0.0, value=float(selected_sku.get('actual_unit_weight_g', 100)), step=10.0)
            else:
                product_name = st.text_input("商品名称", value="")
                actual_weight_g = st.number_input("含包装重量 (g)", min_value=0.0, value=100.0, step=10.0)
        with col_b:
            purchase_cost = st.number_input("采购成本 (¥)", min_value=0.0, value=float(selected_sku.get('purchase_cost_cny', 0)) if selected_sku else 0.0, step=1.0)
            packaging_cost = st.number_input("包装成本 (¥)", min_value=0.0, value=float(selected_sku.get('packaging_cost_cny', 0)) if selected_sku else 0.0, step=0.5)

        col_c, col_d, col_e = st.columns(3)
        with col_c:
            length_cm = st.number_input("长 (cm)", min_value=0.0, value=float(selected_sku.get('product_length_cm', 20)) if selected_sku else 20.0, step=1.0)
        with col_d:
            width_cm = st.number_input("宽 (cm)", min_value=0.0, value=float(selected_sku.get('product_width_cm', 15)) if selected_sku else 15.0, step=1.0)
        with col_e:
            height_cm = st.number_input("高 (cm)", min_value=0.0, value=float(selected_sku.get('product_height_cm', 10)) if selected_sku else 10.0, step=1.0)

        # 线路
        route_options = {t['route_id']: f"{t['route_name']} ({t.get('eta_min_days', 0)}-{t.get('eta_max_days', 0)}天)" for t in tariffs}
        route_id = st.selectbox("物流线路", list(route_options.keys()), format_func=lambda x: route_options[x])
        selected_tariff = next((t for t in tariffs if t['route_id'] == route_id), None)

        col_f, col_g = st.columns(2)
        with col_f:
            quantity = st.number_input("数量", min_value=1, value=1, step=1)
        with col_g:
            parcel_count = st.number_input("包裹数 (物流标签数)", min_value=1, value=1, step=1)

        # 售价与佣金
        col_h, col_i = st.columns(2)
        with col_h:
            seller_revenue_rub = st.number_input("卖家收入基数 (₽)", min_value=0.0, value=1000.0, step=100.0)
        with col_i:
            commission_rate = st.number_input("佣金率 %", min_value=0.0, max_value=100.0, value=float(selected_sku.get('commission_rate', 25)) if selected_sku else 25.0, step=0.5)

        col_j, col_k = st.columns(2)
        with col_j:
            china_inbound = st.number_input("国内送仓费 (¥)", min_value=0.0, value=float(selected_sku.get('china_inbound_cost_cny', 0)) if selected_sku else 0.0, step=0.5)
        with col_k:
            promotion_cost_rub = st.number_input("促销费 (₽)", min_value=0.0, value=0.0, step=50.0)

        # 订单状态
        order_status = st.selectbox("订单状态", ['待发货', '已交DPX', '运输中', '已签收', '买家拒收', '超期未领取', '签收后退货', '发货前取消', '丢失/破损', '已赔付', '其他异常'])

    # 计算
    if selected_tariff and actual_weight_g > 0:
        # 按包裹数分配重量
        per_parcel_weight = actual_weight_g * quantity / parcel_count if parcel_count else actual_weight_g * quantity
        parcels = [{'actual_weight_g': per_parcel_weight, 'length_cm': length_cm, 'width_cm': width_cm, 'height_cm': height_cm}] * parcel_count

        logistics_calc = wb_calc.calculate_order_logistics(parcels, selected_tariff)
        logistics_cny = float(logistics_calc['total_fee_cny'])

        order_data = {
            'seller_revenue_base_rub': seller_revenue_rub,
            'commission_base_rub': seller_revenue_rub,
            'commission_rate': commission_rate,
            'acquiring_fee_rub': 0,
            'promotion_cost_rub': promotion_cost_rub,
            'platform_other_deduction_rub': 0,
            'other_operating_cost_cny': 0,
            'tax_cost_cny': 0,
        }
        sku_data = {
            'purchase_cost_cny': purchase_cost * quantity,
            'packaging_cost_cny': packaging_cost * quantity,
            'china_inbound_cost_cny': china_inbound * quantity,
            'certification_allocation_cny': 0,
        }

        settings_dict = {
            'rub_per_cny': settings.get('rub_per_cny', 12),
            'tax_method': settings.get('tax_method', 'none'),
            'tax_rate': settings.get('tax_rate', 0),
        }

        profit_calc = wb_calc.calculate_operating_profit(order_data, sku_data, settings_dict, logistics_cny)

        with col2:
            st.subheader("核算结果")

            # 物流
            mc1, mc2, mc3 = st.columns(3)
            mc1.metric("计费重量", f"{logistics_calc['parcels'][0]['billable_weight_kg'] if logistics_calc['parcels'] else '—'}kg")
            mc2.metric("包裹数", parcel_count)
            mc3.metric("物流费", fmt_cny(logistics_cny))

            # 利润
            mc4, mc5, mc6 = st.columns(3)
            mc4.metric("销售收入", fmt_cny(profit_calc.get('sales_revenue_cny')))
            mc5.metric("平台净结算", fmt_cny(profit_calc.get('platform_net_settlement_cny')))
            mc6.metric("经营利润", fmt_cny(profit_calc.get('operating_profit_cny')))

            mc7, mc8, mc9 = st.columns(3)
            mc7.metric("利润率", fmt_pct(profit_calc.get('profit_margin')))
            mc8.metric("物流费率", fmt_pct(profit_calc.get('logistics_ratio')))
            mc9.metric("成本ROI", fmt_pct(profit_calc.get('cost_roi')))

            # 预警
            if profit_calc.get('profit_margin') is not None:
                if float(profit_calc['profit_margin']) < float(settings.get('profit_margin_threshold', 10)):
                    st.warning(f"⚠️ 利润率 {fmt_pct(profit_calc['profit_margin'])} 低于阈值 {settings.get('profit_margin_threshold', 10)}%")
            if profit_calc.get('operating_profit_cny') is not None and float(profit_calc['operating_profit_cny']) < 0:
                st.error("🚫 负毛利！")

            # 校验信息
            for p in logistics_calc.get('parcels', []):
                if p.get('validation', {}).get('messages'):
                    for msg in p['validation']['messages']:
                        if '291-300' in msg or '91-100' in msg or '191-200' in msg:
                            st.info(f"💡 {msg}")

            # 计算明细
            with st.expander("📋 查看计算明细", expanded=False):
                st.write("**物流计算**")
                for p in logistics_calc.get('parcels', []):
                    st.write(f"包裹 #{p.get('parcel_index', 1)}")
                    for step in p.get('steps', []):
                        st.write(f"  - {step}")
                st.write("**利润计算**")
                for step in profit_calc.get('steps', []):
                    st.write(f"  - {step}")

            # 盈亏平衡售价
            st.subheader("💡 盈亏平衡分析")
            if profit_calc.get('operating_profit_cny') is not None:
                # 简单估算：固定其他成本，求利润=0时的售价
                # 利润 = (售价_rub/rate) - 物流 - 平台扣费 - 采购成本
                # 设售价为X，平台扣费率约为 (佣金率+0+0)%
                rate = float(settings.get('rub_per_cny', 12))
                commission_pct = commission_rate / 100
                # 固定成本（不随售价变化）
                fixed_cost = purchase_cost * quantity + packaging_cost * quantity + china_inbound * quantity + logistics_cny
                # 盈亏平衡: X/rate * (1 - commission_pct) = fixed_cost
                # X = fixed_cost * rate / (1 - commission_pct)
                if commission_pct < 1:
                    be_price_rub = fixed_cost * rate / (1 - commission_pct)
                    st.info(f"盈亏平衡售价（含物流固定成本）: {fmt_rub(be_price_rub)}")
                    if seller_revenue_rub < be_price_rub:
                        st.error(f"当前售价低于盈亏平衡点，差额: {fmt_rub(be_price_rub - seller_revenue_rub)}")
                    else:
                        st.success(f"当前售价高于盈亏平衡点，安全边际: {fmt_rub(seller_revenue_rub - be_price_rub)}")

            # 保存为订单
            st.divider()
            order_id_input = st.text_input("订单号（保存用）", value=f"WB-{datetime.now().strftime('%Y%m%d%H%M%S')}")
            if st.button("💾 保存为订单", type="primary"):
                new_order = {
                    'order_id': order_id_input,
                    'order_date': datetime.now().strftime('%Y-%m-%d'),
                    'status': order_status,
                    'sku_id': selected_sku.get('sku_id', product_name) if selected_sku else product_name,
                    'quantity': quantity,
                    'seller_revenue_base_rub': seller_revenue_rub,
                    'commission_rate': commission_rate,
                    'route_id': route_id,
                    'tariff_id': selected_tariff['tariff_id'],
                    'parcel_count': parcel_count,
                    'estimated_logistics_cny': logistics_cny,
                    'actual_logistics_cny': None,
                    'operating_profit_cny': float(profit_calc.get('operating_profit_cny', 0)) if profit_calc.get('operating_profit_cny') else None,
                    'profit_margin': float(profit_calc.get('profit_margin', 0)) if profit_calc.get('profit_margin') else None,
                    'purchase_cost_cny': purchase_cost * quantity,
                    'packaging_cost_cny': packaging_cost * quantity,
                    'china_inbound_cost_cny': china_inbound * quantity,
                    'promotion_cost_rub': promotion_cost_rub,
                    'created_at': datetime.now().isoformat(),
                }
                wb_data.add_order(new_order)
                st.session_state.orders = wb_data.load_orders()
                st.success(f"订单 {order_id_input} 已保存")
    else:
        with col2:
            if not selected_tariff:
                st.warning("请选择物流线路")
            if actual_weight_g <= 0:
                st.warning("请输入大于0的重量")


# ----------------------
# 页面：SKU利润表
# ----------------------
def page_sku_profit():
    st.header("📦 SKU利润表")
    skus = st.session_state.skus
    tariffs = wb_data.get_active_routes(st.session_state.tariffs)
    settings = st.session_state.settings

    if not skus:
        st.info("暂无SKU数据。请在下方添加SKU。")
    else:
        # 计算每个SKU的利润
        rows = []
        for sku in skus:
            weight = to_float(sku.get('actual_unit_weight_g'))
            route_id = sku.get('default_route_id', settings.get('default_route_id'))
            tariff = next((t for t in tariffs if t['route_id'] == route_id), None)
            if tariff and weight:
                calc = wb_calc.calculate_parcel_logistics(weight, tariff)
                logistics_cny = float(calc['fee_cny']) if calc['fee_cny'] else 0
            else:
                logistics_cny = 0
                calc = None

            price_rub = to_float(sku.get('target_sale_price_rub')) or 0
            purchase = to_float(sku.get('purchase_cost_cny')) or 0
            packaging = to_float(sku.get('packaging_cost_cny')) or 0
            china_in = to_float(sku.get('china_inbound_cost_cny')) or 0
            commission = to_float(sku.get('commission_rate')) or 0

            price_cny = price_rub / float(settings.get('rub_per_cny', 12)) if settings.get('rub_per_cny') else 0
            commission_cny = price_cny * commission / 100
            profit = price_cny - logistics_cny - commission_cny - purchase - packaging - china_in
            profit_margin = profit / price_cny * 100 if price_cny else None
            logistics_ratio = logistics_cny / price_cny * 100 if price_cny else None

            rows.append({
                'SKU': sku.get('sku_id', ''),
                '商品': sku.get('product_name_cn', ''),
                '类目': sku.get('category', ''),
                '重量(g)': weight,
                '计费重量(kg)': float(calc['billable_weight_kg']) if calc and calc.get('billable_weight_kg') else None,
                '线路': route_id,
                '售价(₽)': price_rub,
                '售价(¥)': round(price_cny, 2),
                '运费(¥)': round(logistics_cny, 2),
                '佣金(¥)': round(commission_cny, 2),
                '采购(¥)': purchase,
                '利润(¥)': round(profit, 2),
                '利润率(%)': round(profit_margin, 1) if profit_margin is not None else None,
                '物流费率(%)': round(logistics_ratio, 1) if logistics_ratio is not None else None,
            })

        df = pd.DataFrame(rows)
        # 标记负毛利和预警
        def highlight_row(row):
            styles = [''] * len(row)
            if row['利润(¥)'] < 0:
                styles = ['color: red'] * len(row)
            elif row['利润率(%)'] is not None and row['利润率(%)'] < float(settings.get('profit_margin_threshold', 10)):
                styles = ['color: orange'] * len(row)
            return styles

        st.dataframe(df.style.apply(highlight_row, axis=1), use_container_width=True, height=400)

        # 导出
        csv = df.to_csv(index=False).encode('utf-8-sig')
        st.download_button("📥 导出CSV", csv, "wb_sku_profit.csv", "text/csv")

    # 添加/编辑SKU
    st.divider()
    st.subheader("➕ 添加 / 编辑 SKU")
    with st.form("sku_form"):
        col1, col2, col3 = st.columns(3)
        with col1:
            sku_id = st.text_input("SKU ID *")
            product_name = st.text_input("商品名称 *")
            category = st.text_input("WB类目")
        with col2:
            weight = st.number_input("含包装重量 (g) *", min_value=0.0, step=10.0)
            purchase = st.number_input("采购成本 (¥)", min_value=0.0, step=1.0)
            packaging = st.number_input("包装成本 (¥)", min_value=0.0, step=0.5)
        with col3:
            price_rub = st.number_input("目标售价 (₽)", min_value=0.0, step=100.0)
            commission_rate = st.number_input("佣金率 %", min_value=0.0, max_value=100.0, value=25.0, step=0.5)
            china_inbound = st.number_input("国内送仓费 (¥)", min_value=0.0, step=0.5)

        col4, col5, col6 = st.columns(3)
        with col4:
            length = st.number_input("长 (cm)", min_value=0.0, step=1.0)
        with col5:
            width = st.number_input("宽 (cm)", min_value=0.0, step=1.0)
        with col6:
            height = st.number_input("高 (cm)", min_value=0.0, step=1.0)

        route_options = {t['route_id']: t['route_name'] for t in tariffs}
        default_route = st.selectbox("默认线路", list(route_options.keys()), format_func=lambda x: route_options[x])

        submit = st.form_submit_button("保存SKU")
        if submit and sku_id and product_name:
            new_sku = {
                'sku_id': sku_id,
                'product_name_cn': product_name,
                'category': category,
                'actual_unit_weight_g': weight,
                'purchase_cost_cny': purchase,
                'packaging_cost_cny': packaging,
                'china_inbound_cost_cny': china_inbound,
                'target_sale_price_rub': price_rub,
                'commission_rate': commission_rate,
                'product_length_cm': length,
                'product_width_cm': width,
                'product_height_cm': height,
                'default_route_id': default_route,
                'active': True,
                'created_at': datetime.now().isoformat(),
            }
            wb_data.add_sku(new_sku)
            st.session_state.skus = wb_data.load_skus()
            st.success(f"SKU {sku_id} 已保存")
            st.rerun()


# ----------------------
# 页面：线路对比
# ----------------------
def page_route_compare():
    st.header("🔀 线路对比器")
    tariffs = wb_data.get_active_routes(st.session_state.tariffs)

    col1, col2 = st.columns([1, 2])
    with col1:
        st.subheader("输入")
        weight = st.number_input("包裹重量 (g)", min_value=1.0, value=500.0, step=10.0)
        col_a, col_b, col_c = st.columns(3)
        with col_a:
            length = st.number_input("长 (cm)", min_value=0.0, value=20.0, step=1.0, key="rc_l")
        with col_b:
            width = st.number_input("宽 (cm)", min_value=0.0, value=15.0, step=1.0, key="rc_w")
        with col_c:
            height = st.number_input("高 (cm)", min_value=0.0, value=10.0, step=1.0, key="rc_h")

    parcel = {'actual_weight_g': weight, 'length_cm': length, 'width_cm': width, 'height_cm': height}
    results = wb_calc.compare_routes(parcel, tariffs)

    with col2:
        st.subheader("对比结果")
        rows = []
        for r in results:
            t = r['tariff']
            rows.append({
                '线路': t.get('route_name', ''),
                '时效(天)': f"{t.get('eta_min_days', 0)}-{t.get('eta_max_days', 0)}",
                '运费(¥)': float(r['fee_cny']) if r['fee_cny'] is not None else None,
                '与最低差价(¥)': float(r['diff_to_min']) if r.get('diff_to_min') is not None else None,
                '尺寸合规': '✅' if r['valid'] else '❌',
                '提示': '; '.join(r.get('messages', [])) if r.get('messages') else '',
            })
        df = pd.DataFrame(rows)
        st.dataframe(df, use_container_width=True, hide_index=True)

        # 推荐线路
        valid_results = [r for r in results if r['valid'] and r['fee_cny'] is not None]
        if valid_results:
            cheapest = min(valid_results, key=lambda x: x['fee_cny'])
            fastest = min(valid_results, key=lambda x: x['tariff'].get('eta_max_days', 999))
            st.info(f"💡 最便宜: **{cheapest['tariff']['route_name']}** {fmt_cny(cheapest['fee_cny'])} ({cheapest['tariff'].get('eta_min_days',0)}-{cheapest['tariff'].get('eta_max_days',0)}天)")
            st.info(f"⚡ 最快速: **{fastest['tariff']['route_name']}** {fmt_cny(fastest['fee_cny'])} ({fastest['tariff'].get('eta_min_days',0)}-{fastest['tariff'].get('eta_max_days',0)}天)")
            if cheapest != fastest:
                diff = float(fastest['fee_cny']) - float(cheapest['fee_cny'])
                days_saved = cheapest['tariff'].get('eta_max_days', 0) - fastest['tariff'].get('eta_max_days', 0)
                if days_saved > 0 and diff > 0:
                    st.info(f"📈 选择 {fastest['tariff']['route_name']} 可省 {days_saved} 天，但每单增加 {fmt_cny(diff)}（每缩短1天约 {fmt_cny(diff/days_saved)}）")


# ----------------------
# 页面：费率管理
# ----------------------
def page_tariff_manage():
    st.header("⚙️ 费率管理")
    tariffs = st.session_state.tariffs

    # 费率列表
    st.subheader("当前费率")
    rows = []
    for t in tariffs:
        tiers_str = ' | '.join([f"{tier['min_weight_kg']}-{tier['max_weight_kg']}kg: {tier['kg_rate_cny']}元/kg+{tier['fixed_fee_cny']}元" for tier in t.get('tiers', [])])
        rows.append({
            '线路ID': t.get('route_id', ''),
            '名称': t.get('route_name', ''),
            '仓库': t.get('warehouse_code', ''),
            '时效': f"{t.get('eta_min_days',0)}-{t.get('eta_max_days',0)}天",
            '最大重量(kg)': t.get('max_weight_kg', ''),
            '三边和(cm)': t.get('max_sum_dimensions_cm', ''),
            '单边(cm)': t.get('max_single_side_cm', ''),
            '生效日期': t.get('effective_from', ''),
            '失效日期': t.get('effective_to', '—'),
            '启用': '✅' if t.get('active') else '❌',
            '费率区间': tiers_str,
        })
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    # 导入导出
    col1, col2 = st.columns(2)
    with col1:
        json_str = json.dumps(tariffs, ensure_ascii=False, indent=2)
        st.download_button("📥 导出JSON", json_str.encode('utf-8'), "wb_tariffs.json", "application/json")
    with col2:
        uploaded = st.file_uploader("📤 导入JSON", type=['json'])
        if uploaded:
            try:
                imported = json.loads(uploaded.read().decode('utf-8'))
                st.session_state.tariffs = imported
                wb_data.save_tariffs(imported)
                st.success("导入成功")
                st.rerun()
            except Exception as e:
                st.error(f"导入失败: {e}")

    # 新增/编辑费率
    st.divider()
    st.subheader("➕ 新增费率")
    with st.form("tariff_form"):
        col1, col2, col3 = st.columns(3)
        with col1:
            t_route_id = st.text_input("线路ID *")
            t_route_name = st.text_input("线路名称 *")
            t_warehouse = st.text_input("仓库代码")
        with col2:
            t_eta_min = st.number_input("最小时效(天)", min_value=0, value=15)
            t_eta_max = st.number_input("最大时效(天)", min_value=0, value=30)
            t_max_weight = st.number_input("最大重量(kg)", min_value=0.0, value=20.0, step=1.0)
        with col3:
            t_max_sum = st.number_input("三边和(cm)", min_value=0.0, value=200.0, step=10.0)
            t_max_side = st.number_input("单边(cm)", min_value=0.0, value=120.0, step=10.0)
            t_effective = st.date_input("生效日期", value=date(2026, 2, 9))

        st.write("**费率区间**（至少一个）")
        tier_count = st.number_input("区间数", min_value=1, max_value=5, value=2, step=1)
        tiers = []
        for i in range(tier_count):
            tc1, tc2, tc3, tc4 = st.columns(4)
            with tc1:
                min_w = st.number_input(f"区间{i+1} 最小(kg)", min_value=0.0, value=0.1*(i+1)-0.1 if i == 0 else 0.4, step=0.1, key=f"min_{i}")
            with tc2:
                max_w = st.number_input(f"区间{i+1} 最大(kg)", min_value=0.0, value=0.3 if i == 0 else 20.0, step=0.1, key=f"max_{i}")
            with tc3:
                kg_rate = st.number_input(f"区间{i+1} 费率(元/kg)", min_value=0.0, value=58.0 if i == 0 else 43.0, step=1.0, key=f"rate_{i}")
            with tc4:
                fixed = st.number_input(f"区间{i+1} 固定费(元)", min_value=0.0, value=2.0 if i == 0 else 8.0, step=1.0, key=f"fixed_{i}")
            tiers.append({'min_weight_kg': min_w, 'max_weight_kg': max_w, 'kg_rate_cny': kg_rate, 'fixed_fee_cny': fixed})

        submit = st.form_submit_button("保存费率")
        if submit and t_route_id and t_route_name:
            new_tariff = {
                'tariff_id': f"{t_route_id}-{t_effective.strftime('%Y%m%d')}",
                'route_id': t_route_id,
                'route_name': t_route_name,
                'warehouse_code': t_warehouse,
                'origin_city': '',
                'destination_country': 'RU',
                'service_level': 'custom',
                'eta_min_days': t_eta_min,
                'eta_max_days': t_eta_max,
                'weight_rounding_g': 100,
                'charge_basis': 'actual_weight',
                'max_weight_kg': t_max_weight,
                'max_sum_dimensions_cm': t_max_sum,
                'max_single_side_cm': t_max_side,
                'battery_limit_wh': 100,
                'reverse_to_ru_warehouse_included': True,
                'effective_from': t_effective.strftime('%Y-%m-%d'),
                'effective_to': None,
                'active': True,
                'source_name': '手工录入',
                'notes': '',
                'tiers': tiers,
            }
            st.session_state.tariffs.append(new_tariff)
            wb_data.save_tariffs(st.session_state.tariffs)
            st.success(f"费率 {t_route_name} 已保存")
            st.rerun()


# ----------------------
# 页面：订单与对账
# ----------------------
def page_orders():
    st.header("📋 订单明细与对账")
    orders = st.session_state.orders

    # 导入CSV
    col1, col2, col3 = st.columns(3)
    with col1:
        template = wb_data.get_csv_template()
        st.download_button("📥 下载CSV模板", template.encode('utf-8-sig'), "wb_orders_template.csv", "text/csv")
    with col2:
        uploaded = st.file_uploader("📤 导入订单CSV", type=['csv'])
        if uploaded:
            csv_text = uploaded.read().decode('utf-8-sig')
            imported, errors = wb_data.csv_to_orders(csv_text)
            if errors:
                st.warning(f"导入完成，{len(errors)} 行有错误")
                with st.expander("查看错误"):
                    for e in errors:
                        st.write(f"行{e['row']}: {e['message']}")
            if imported:
                for o in imported:
                    wb_data.add_order(o)
                st.session_state.orders = wb_data.load_orders()
                st.success(f"成功导入 {len(imported)} 条订单")
                st.rerun()
    with col3:
        if orders:
            csv = wb_data.orders_to_csv(orders)
            st.download_button("📥 导出全部订单", csv.encode('utf-8-sig'), "wb_orders.csv", "text/csv")

    st.divider()

    if not orders:
        st.info("暂无订单")
        return

    # 订单表
    df = pd.DataFrame(orders)
    show_cols = [c for c in ['order_id', 'order_date', 'status', 'sku_id', 'quantity', 'seller_revenue_base_rub', 'route_id', 'estimated_logistics_cny', 'actual_logistics_cny', 'operating_profit_cny', 'profit_margin'] if c in df.columns]
    st.dataframe(df[show_cols], use_container_width=True, height=400, hide_index=True)

    # 对账
    st.divider()
    st.subheader("💰 物流费对账（预计 vs 实际）")
    has_actual = [o for o in orders if o.get('actual_logistics_cny') is not None]
    if has_actual:
        recon_rows = []
        for o in has_actual:
            est = to_float(o.get('estimated_logistics_cny')) or 0
            act = to_float(o.get('actual_logistics_cny')) or 0
            diff = act - est
            recon_rows.append({
                '订单号': o.get('order_id', ''),
                '预计(¥)': round(est, 2),
                '实际(¥)': round(act, 2),
                '差异(¥)': round(diff, 2),
                '差异率(%)': round(diff/est*100, 1) if est else None,
                '状态': o.get('status', ''),
            })
        recon_df = pd.DataFrame(recon_rows)
        st.dataframe(recon_df, use_container_width=True, hide_index=True)
    else:
        st.info("暂无实际物流费数据。在订单表中可手动填入 actual_logistics_cny 字段。")

    # 单订单详情
    st.divider()
    st.subheader("🔍 订单详情")
    order_ids = [o.get('order_id', '') for o in orders]
    selected = st.selectbox("选择订单", order_ids)
    if selected:
        order = next((o for o in orders if o.get('order_id') == selected), None)
        if order:
            st.json(order, expanded=False)
            if st.button("🗑️ 删除此订单"):
                wb_data.delete_order(selected)
                st.session_state.orders = wb_data.load_orders()
                st.success("已删除")
                st.rerun()


# ----------------------
# 页面：佣金查询
# ----------------------
def page_commission():
    st.header("💸 WB佣金查询")

    df = load_commission_data()
    if df is None:
        st.warning(f"未找到佣金文件: {COMMISSION_FILE}")
        return

    st.caption(f"数据来源: {COMMISSION_FILE}，共 {len(df)} 条记录")

    keyword = st.text_input("搜索品类或商品名称", placeholder="如：玩具、化妆品、电器")
    result = search_commission(keyword)
    if result is not None and not result.empty:
        st.dataframe(result, use_container_width=True, height=500, hide_index=True)
        # 佣金率分布
        fig = px.histogram(result, x='佣金率', nbins=20, title="佣金率分布")
        fig.update_layout(height=300, margin=dict(l=10, r=10, t=40, b=10))
        st.plotly_chart(fig, use_container_width=True)
    elif result is not None:
        st.info("无匹配结果")


# ----------------------
# 路由
# ----------------------
import json

if page == "📊 总览":
    page_overview()
elif page == "🧮 单订单核算器":
    page_calculator()
elif page == "📦 SKU利润表":
    page_sku_profit()
elif page == "🔀 线路对比":
    page_route_compare()
elif page == "⚙️ 费率管理":
    page_tariff_manage()
elif page == "📋 订单与对账":
    page_orders()
elif page == "💸 佣金查询":
    page_commission()
