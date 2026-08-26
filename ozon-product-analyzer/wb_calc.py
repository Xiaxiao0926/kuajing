"""
WB跨境利润与物流费用核算 - 计算引擎
所有函数为独立纯函数，便于测试和前后端复用。
使用Decimal避免浮点误差。
"""
from decimal import Decimal, ROUND_UP, ROUND_HALF_UP, ROUND_DOWN, InvalidOperation
from datetime import date


# ----------------------
# 工具函数
# ----------------------
def to_decimal(val):
    """安全转换为Decimal，空值返回0"""
    if val is None or val == '':
        return Decimal('0')
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError):
        return Decimal('0')


def round_up_weight(actual_weight_g, step_g):
    """
    实际重量按step_g向上取整。
    例: actual=101g, step=100 -> 200g
    """
    aw = to_decimal(actual_weight_g)
    step = to_decimal(step_g)
    if step <= 0:
        return aw
    # 向上取整到step的倍数
    rounded = (aw / step).quantize(Decimal('1'), rounding=ROUND_UP) * step
    return rounded


def round2(val):
    """保留2位小数（四舍五入）"""
    return to_decimal(val).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def round4(val):
    """保留4位小数"""
    return to_decimal(val).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)


def calculate_agency_fee_rub(order_amount_rub, custom_config=None):
    """
    统一代理费计算（卢布口径）
    agencyFeeRub = clamp(orderAmountRub * rate, min_rub, max_rub)
    """
    amt = to_decimal(order_amount_rub)
    if amt <= Decimal('0'):
        return Decimal('0')
    cfg = custom_config or {'rate': Decimal('0.02'), 'min_rub': Decimal('15'), 'max_rub': Decimal('200')}
    rate = to_decimal(cfg.get('rate', Decimal('0.02')))
    min_rub = to_decimal(cfg.get('min_rub', Decimal('15')))
    max_rub = to_decimal(cfg.get('max_rub', Decimal('200')))
    raw = amt * rate
    return max(min_rub, min(raw, max_rub))


# ----------------------
# 费率选择
# ----------------------
def select_tariff_version(route_id, order_date, tariffs):
    """
    根据线路ID和订单日期选择当日有效的费率版本。
    tariffs: list of tariff dict, 每个含 route_id, effective_from, effective_to, active
    返回匹配的tariff dict，未找到返回None。
    """
    if not order_date:
        return None
    if isinstance(order_date, str):
        try:
            order_date = date.fromisoformat(order_date)
        except ValueError:
            return None
    elif hasattr(order_date, 'date'):
        order_date = order_date.date()

    candidates = []
    for t in tariffs:
        if t.get('route_id') != route_id:
            continue
        if not t.get('active', True):
            continue
        eff_from = t.get('effective_from')
        eff_to = t.get('effective_to')
        if eff_from:
            if isinstance(eff_from, str):
                eff_from = date.fromisoformat(eff_from)
            elif hasattr(eff_from, 'date'):
                eff_from = eff_from.date()
            if order_date < eff_from:
                continue
        if eff_to:
            if isinstance(eff_to, str):
                eff_to = date.fromisoformat(eff_to)
            elif hasattr(eff_to, 'date'):
                eff_to = eff_to.date()
            if order_date > eff_to:
                continue
        candidates.append(t)

    if not candidates:
        return None
    # 取生效日期最新的
    candidates.sort(key=lambda x: x.get('effective_from', date.min) if isinstance(x.get('effective_from'), str) else date.fromisoformat('1900-01-01'), reverse=True)
    return candidates[0]


def select_tariff_tier(tariff, billable_weight_kg):
    """
    选择命中的费率区间。
    billable_weight_kg: Decimal
    返回匹配的tier dict，未找到返回None。
    """
    bw = to_decimal(billable_weight_kg)
    tiers = tariff.get('tiers', [])
    for tier in tiers:
        min_w = to_decimal(tier.get('min_weight_kg', 0))
        max_w = to_decimal(tier.get('max_weight_kg', 0))
        if min_w <= bw <= max_w:
            return tier
    return None


# ----------------------
# 尺寸校验
# ----------------------
def validate_parcel(parcel, tariff):
    """
    校验包裹尺寸和重量是否符合线路限制。
    返回 dict: {valid: bool, messages: [str], status: 'pass'/'warning'/'error'}
    """
    messages = []
    status = 'pass'

    actual_weight_g = to_decimal(parcel.get('actual_weight_g', 0))
    length = to_decimal(parcel.get('length_cm', 0))
    width = to_decimal(parcel.get('width_cm', 0))
    height = to_decimal(parcel.get('height_cm', 0))

    # 重量校验
    if actual_weight_g <= 0:
        messages.append('实际重量为空或≤0')
        status = 'error'
    else:
        max_weight_g = to_decimal(tariff.get('max_weight_kg', 0)) * 1000
        if max_weight_g > 0 and actual_weight_g > max_weight_g:
            messages.append(f'实际重量{actual_weight_g}g超过线路最大重量{max_weight_g}g')
            status = 'error'

    # 尺寸校验
    sum_dim = length + width + height
    max_sum = to_decimal(tariff.get('max_sum_dimensions_cm', 0))
    if max_sum > 0 and sum_dim > max_sum:
        messages.append(f'三边之和{sum_dim}cm超过线路限制{max_sum}cm')
        status = 'error'

    max_side = to_decimal(tariff.get('max_single_side_cm', 0))
    if max_side > 0:
        for dim_name, dim_val in [('长', length), ('宽', width), ('高', height)]:
            if dim_val > max_side:
                messages.append(f'{dim_name}{dim_val}cm超过单边限制{max_side}cm')
                status = 'error'

    # 重量跳档预警
    bw_g = round_up_weight(actual_weight_g, tariff.get('weight_rounding_g', 100))
    bw_kg = bw_g / 1000
    # 300g跳档重点预警
    if to_decimal('291') <= actual_weight_g <= to_decimal('300'):
        messages.append('当前重量处于291-300g区间，再增加1g将进入0.4kg档，运费跳跃¥5.80')
        if status == 'pass':
            status = 'warning'
    elif to_decimal('91') <= actual_weight_g <= to_decimal('100'):
        messages.append('当前重量处于91-100g区间，再增加1g将进入下一档')
        if status == 'pass':
            status = 'warning'
    elif to_decimal('191') <= actual_weight_g <= to_decimal('200'):
        messages.append('当前重量处于191-200g区间，再增加1g将进入下一档')
        if status == 'pass':
            status = 'warning'

    return {
        'valid': status != 'error',
        'messages': messages,
        'status': status
    }


# ----------------------
# 物流费用计算
# ----------------------
def calculate_parcel_logistics(actual_weight_g, tariff):
    """
    单包裹物流费用计算。
    返回 dict:
      actual_weight_g, billable_weight_g, billable_weight_kg,
      tier, fee_cny, steps[], validation
    """
    validation = validate_parcel({'actual_weight_g': actual_weight_g}, tariff)
    if not validation['valid']:
        return {
            'actual_weight_g': actual_weight_g,
            'billable_weight_g': None,
            'billable_weight_kg': None,
            'tier': None,
            'fee_cny': None,
            'steps': ['校验失败: ' + '; '.join(validation['messages'])],
            'validation': validation
        }

    aw = to_decimal(actual_weight_g)
    step_g = to_decimal(tariff.get('weight_rounding_g', 100))
    billable_weight_g = round_up_weight(aw, step_g)
    billable_weight_kg = billable_weight_g / Decimal('1000')

    max_weight_kg = to_decimal(tariff.get('max_weight_kg', 20))
    if billable_weight_kg > max_weight_kg:
        return {
            'actual_weight_g': actual_weight_g,
            'billable_weight_g': billable_weight_g,
            'billable_weight_kg': billable_weight_kg,
            'tier': None,
            'fee_cny': None,
            'steps': [f'计费重量{billable_weight_kg}kg超过最大重量{max_weight_kg}kg'],
            'validation': {'valid': False, 'messages': ['超过最大重量'], 'status': 'error'}
        }

    tier = select_tariff_tier(tariff, billable_weight_kg)
    if not tier:
        return {
            'actual_weight_g': actual_weight_g,
            'billable_weight_g': billable_weight_g,
            'billable_weight_kg': billable_weight_kg,
            'tier': None,
            'fee_cny': None,
            'steps': [f'计费重量{billable_weight_kg}kg找不到适用费率区间'],
            'validation': {'valid': False, 'messages': ['无适用费率区间'], 'status': 'error'}
        }

    kg_rate = to_decimal(tier.get('kg_rate_cny', 0))
    fixed_fee = to_decimal(tier.get('fixed_fee_cny', 0))
    fee = billable_weight_kg * kg_rate + fixed_fee
    fee = round2(fee)

    steps = [
        f'实际重量{aw}g',
        f'按{step_g}g向上取整为{billable_weight_g}g',
        f'计费重量 = {billable_weight_g}g / 1000 = {billable_weight_kg}kg',
        f'命中区间: {tier.get("min_weight_kg", "")}-{tier.get("max_weight_kg", "")}kg, 费率{kg_rate}元/kg + 固定费{fixed_fee}元',
        f'物流费 = {billable_weight_kg} × {kg_rate} + {fixed_fee} = {fee}元'
    ]

    return {
        'actual_weight_g': aw,
        'billable_weight_g': billable_weight_g,
        'billable_weight_kg': billable_weight_kg,
        'tier': tier,
        'fee_cny': fee,
        'steps': steps,
        'validation': validation
    }


def calculate_order_logistics(parcels, tariff):
    """
    多包裹订单物流费。
    parcels: list of {actual_weight_g, length_cm, width_cm, height_cm}
    每个包裹独立取整、独立计费。
    """
    if not parcels:
        return {
            'parcel_count': 0,
            'total_fee_cny': Decimal('0'),
            'parcels': [],
            'steps': ['无包裹']
        }
    results = []
    total = Decimal('0')
    for i, p in enumerate(parcels, 1):
        calc = calculate_parcel_logistics(p.get('actual_weight_g', 0), tariff)
        calc['parcel_index'] = i
        if calc['fee_cny'] is not None:
            total += calc['fee_cny']
        results.append(calc)
    return {
        'parcel_count': len(parcels),
        'total_fee_cny': round2(total),
        'parcels': results,
        'steps': [f'共{len(parcels)}个包裹，每个独立取整计费，合计{round2(total)}元']
    }


# ----------------------
# 平台结算与利润
# ----------------------
def _calculate_platform_settlement_raw(order, settings):
    rub_per_cny = to_decimal(settings.get('rub_per_cny', 0))
    if rub_per_cny <= 0:
        return {'error': '汇率为0或空，无法转换'}

    seller_revenue_base_rub = to_decimal(order.get('seller_revenue_base_rub', 0))
    commission_base_rub = to_decimal(order.get('commission_base_rub', seller_revenue_base_rub))
    commission_rate = to_decimal(order.get('commission_rate', 0))
    acquiring_fee_rub = to_decimal(order.get('acquiring_fee_rub', 0))
    promotion_cost_rub = to_decimal(order.get('promotion_cost_rub', 0))
    platform_other_rub = to_decimal(order.get('platform_other_deduction_rub', 0))
    order_logistics_cny = to_decimal(order.get('order_logistics_cny', 0))

    sales_revenue_cny = seller_revenue_base_rub / rub_per_cny
    commission_cny = commission_base_rub * commission_rate / 100 / rub_per_cny
    acquiring_fee_cny = acquiring_fee_rub / rub_per_cny
    promotion_cost_cny = promotion_cost_rub / rub_per_cny
    platform_other_cny = platform_other_rub / rub_per_cny
    net = sales_revenue_cny - commission_cny - order_logistics_cny - acquiring_fee_cny - promotion_cost_cny - platform_other_cny

    return {
        'rub_per_cny': rub_per_cny,
        'seller_revenue_base_rub': seller_revenue_base_rub,
        'commission_base_rub': commission_base_rub,
        'commission_rate': commission_rate,
        'acquiring_fee_rub': acquiring_fee_rub,
        'promotion_cost_rub': promotion_cost_rub,
        'platform_other_rub': platform_other_rub,
        'order_logistics_cny': order_logistics_cny,
        'sales_revenue_cny': sales_revenue_cny,
        'commission_cny': commission_cny,
        'acquiring_fee_cny': acquiring_fee_cny,
        'promotion_cost_cny': promotion_cost_cny,
        'platform_other_cny': platform_other_cny,
        'platform_net_settlement_cny': net,
    }


def _format_platform_settlement(raw):
    if raw.get('error'):
        return {
            'error': raw['error'],
            'sales_revenue_cny': None,
            'commission_cny': None,
            'platform_net_settlement_cny': None,
            'steps': [raw['error']],
        }
    sales_revenue_cny = round2(raw['sales_revenue_cny'])
    commission_cny = round2(raw['commission_cny'])
    acquiring_fee_cny = round2(raw['acquiring_fee_cny'])
    promotion_cost_cny = round2(raw['promotion_cost_cny'])
    platform_other_cny = round2(raw['platform_other_cny'])
    net = round2(raw['platform_net_settlement_cny'])

    steps = [
        f"卖家收入基数: {raw['seller_revenue_base_rub']}₽ / {raw['rub_per_cny']} = {sales_revenue_cny}¥",
        f"佣金: {raw['commission_base_rub']}₽ × {raw['commission_rate']}% / {raw['rub_per_cny']} = {commission_cny}¥",
        f"物流费: {raw['order_logistics_cny']}¥",
        f"支付费: {raw['acquiring_fee_rub']}₽ / {raw['rub_per_cny']} = {acquiring_fee_cny}¥",
        f"促销费: {raw['promotion_cost_rub']}₽ / {raw['rub_per_cny']} = {promotion_cost_cny}¥",
        f"其他扣款: {raw['platform_other_rub']}₽ / {raw['rub_per_cny']} = {platform_other_cny}¥",
        f'平台净结算（内部全精度计算）= {net}¥'
    ]

    return {
        'sales_revenue_cny': sales_revenue_cny,
        'commission_cny': commission_cny,
        'acquiring_fee_cny': acquiring_fee_cny,
        'promotion_cost_cny': promotion_cost_cny,
        'platform_other_cny': platform_other_cny,
        'platform_net_settlement_cny': net,
        'steps': steps
    }


def calculate_platform_settlement(order, settings):
    """平台结算预估；内部保持 Decimal 全精度，对外金额保留两位。"""
    return _format_platform_settlement(_calculate_platform_settlement_raw(order, settings))


def calculate_operating_profit(order, sku, settings, logistics_cny):
    """
    单订单经营利润。
    order: {seller_revenue_base_rub, commission_rate, ...}
    sku: {purchase_cost_cny, packaging_cost_cny, china_inbound_cost_cny, certification_allocation_cny}
    settings: {rub_per_cny, tax_method, tax_rate}
    logistics_cny: 已计算的物流费
    """
    settlement_raw = _calculate_platform_settlement_raw({
        **order,
        'order_logistics_cny': logistics_cny
    }, settings)
    settlement = _format_platform_settlement(settlement_raw)

    if settlement.get('platform_net_settlement_cny') is None:
        return {**settlement, 'operating_profit_cny': None, 'steps': settlement.get('steps', [])}

    net_raw = settlement_raw['platform_net_settlement_cny']
    sales_revenue_raw = settlement_raw['sales_revenue_cny']

    purchase_cost = to_decimal(sku.get('purchase_cost_cny', 0))
    packaging_cost = to_decimal(sku.get('packaging_cost_cny', 0))
    china_inbound = to_decimal(sku.get('china_inbound_cost_cny', 0))
    certification = to_decimal(sku.get('certification_allocation_cny', 0))
    other_operating = to_decimal(order.get('other_operating_cost_cny', 0))

    # 税费
    tax_cost_raw = Decimal('0')
    tax_method = settings.get('tax_method', 'none')
    tax_rate = to_decimal(settings.get('tax_rate', 0))
    if tax_method == 'revenue' and sales_revenue_raw is not None:
        tax_cost_raw = sales_revenue_raw * tax_rate / 100
    elif tax_method == 'settlement':
        tax_cost_raw = net_raw * tax_rate / 100
    elif tax_method == 'manual':
        tax_cost_raw = to_decimal(order.get('tax_cost_cny', 0))

    profit_raw = net_raw - purchase_cost - packaging_cost - china_inbound - certification - tax_cost_raw - other_operating
    tax_cost = round2(tax_cost_raw)
    profit = round2(profit_raw)

    profit_margin = round2(profit_raw / sales_revenue_raw * 100) if sales_revenue_raw and sales_revenue_raw > 0 else None
    logistics_ratio = round2(to_decimal(logistics_cny) / sales_revenue_raw * 100) if sales_revenue_raw and sales_revenue_raw > 0 else None

    cost_total = purchase_cost + packaging_cost + china_inbound + to_decimal(logistics_cny) + settlement_raw['promotion_cost_cny']
    cost_roi = round2(profit_raw / cost_total * 100) if cost_total and cost_total > 0 else None

    steps = settlement['steps'] + [
        f'采购成本: {purchase_cost}¥',
        f'包装成本: {packaging_cost}¥',
        f'国内送仓: {china_inbound}¥',
        f'认证分摊: {certification}¥',
        f'税费({tax_method}): {tax_cost}¥',
        f'其他成本: {other_operating}¥',
        f'经营利润（内部全精度计算）= {profit}¥',
        f"利润率 = {profit} / {settlement['sales_revenue_cny']} = {profit_margin}%" if profit_margin is not None else '利润率: 不可计算',
        f"物流费率 = {logistics_cny} / {settlement['sales_revenue_cny']} = {logistics_ratio}%" if logistics_ratio is not None else '物流费率: 不可计算',
    ]

    return {
        **settlement,
        'purchase_cost_cny': purchase_cost,
        'packaging_cost_cny': packaging_cost,
        'china_inbound_cost_cny': china_inbound,
        'certification_allocation_cny': certification,
        'tax_cost_cny': tax_cost,
        'other_operating_cost_cny': other_operating,
        'operating_profit_cny': profit,
        'profit_margin': profit_margin,
        'logistics_ratio': logistics_ratio,
        'cost_roi': cost_roi,
        'steps': steps
    }


# ----------------------
# 线路对比
# ----------------------
def compare_routes(parcel, routes):
    """
    对比多个线路的运费。
    parcel: {actual_weight_g, length_cm, width_cm, height_cm}
    routes: list of tariff dict
    返回 list of {
        tariff, fee_cny, eta_min, eta_max, valid, messages, diff_to_min, valid
    }
    """
    results = []
    valid_fees = []
    for tariff in routes:
        validation = validate_parcel(parcel, tariff)
        if not validation['valid']:
            results.append({
                'tariff': tariff,
                'fee_cny': None,
                'eta_min_days': tariff.get('eta_min_days'),
                'eta_max_days': tariff.get('eta_max_days'),
                'valid': False,
                'messages': validation['messages']
            })
            continue
        calc = calculate_parcel_logistics(parcel.get('actual_weight_g', 0), tariff)
        results.append({
            'tariff': tariff,
            'fee_cny': calc['fee_cny'],
            'billable_weight_kg': calc['billable_weight_kg'],
            'eta_min_days': tariff.get('eta_min_days'),
            'eta_max_days': tariff.get('eta_max_days'),
            'valid': True,
            'messages': validation['messages']
        })
        if calc['fee_cny'] is not None:
            valid_fees.append(calc['fee_cny'])

    min_fee = min(valid_fees) if valid_fees else None
    for r in results:
        if r['fee_cny'] is not None and min_fee is not None:
            r['diff_to_min'] = round2(r['fee_cny'] - min_fee)
        else:
            r['diff_to_min'] = None

    return results


# ----------------------
# 退货损益
# ----------------------
def calculate_return_loss(order, sku, forward_logistics_cny, settings):
    """
    签收后退货损益。
    inventory_recovery_rate: 0-100
    """
    purchase_cost = to_decimal(sku.get('purchase_cost_cny', 0))
    packaging_cost = to_decimal(sku.get('packaging_cost_cny', 0))
    china_inbound = to_decimal(sku.get('china_inbound_cost_cny', 0))
    recovery_rate = to_decimal(order.get('inventory_recovery_rate', 0))  # 百分比
    return_to_china = to_decimal(order.get('return_to_china_or_disposal_cost_cny', 0))
    non_refunded_commission = to_decimal(order.get('non_refunded_commission_cny', 0))
    other_failure = to_decimal(order.get('other_failure_cost_cny', 0))
    forward_logistics = to_decimal(forward_logistics_cny)

    inventory_loss = purchase_cost * (Decimal('100') - recovery_rate) / 100
    inventory_loss = round2(inventory_loss)

    total_loss = forward_logistics + packaging_cost + china_inbound + non_refunded_commission + return_to_china + inventory_loss + other_failure
    total_loss = round2(total_loss)

    steps = [
        f'正向物流费: {forward_logistics_cny}¥',
        f'包装成本: {packaging_cost}¥',
        f'国内送仓: {china_inbound}¥',
        f'不可退佣金: {non_refunded_commission}¥',
        f'退回/销毁成本: {return_to_china}¥',
        f'库存损失 = 采购成本{purchase_cost} × (100% - 回收率{recovery_rate}%) = {inventory_loss}¥',
        f'其他失败成本: {other_failure}¥',
        f'退货总损失 = {total_loss}¥'
    ]

    return {
        'inventory_loss_cny': inventory_loss,
        'failed_order_loss_cny': total_loss,
        'steps': steps
    }
