"""
WB跨境核算 - 数据存储管理
本地JSON持久化、CSV导入导出、备份恢复。

配置唯一事实源：D:/ozon/config/*.json（wb_tariffs.json / settings.json）
- 经环境变量 CONFIG_DIR 指定；默认相对路径 ../../config（仓库根/config）
- wb_data/ 目录仅保留运行时数据（skus.json / orders.json / 备份）
"""
import json
import os
import csv
import io
from datetime import datetime, date
from decimal import Decimal


# 数据目录（运行时数据）
WB_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wb_data')
os.makedirs(WB_DATA_DIR, exist_ok=True)

# 配置目录（唯一事实源）
CONFIG_DIR = os.environ.get('CONFIG_DIR') or os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config')
)

# 各类数据文件路径
SETTINGS_FILE = os.path.join(CONFIG_DIR, 'settings.json')
TARIFFS_FILE = os.path.join(CONFIG_DIR, 'wb_tariffs.json')
SKUS_FILE = os.path.join(WB_DATA_DIR, 'skus.json')
ORDERS_FILE = os.path.join(WB_DATA_DIR, 'orders.json')


# ----------------------
# 默认数据（兜底：config 文件缺失/损坏时使用；内容必须与 config 一致）
# 注意：唯一事实源是 config/wb_tariffs.json 与 config/settings.json；
#       下方常量仅为加载失败时的最后防线，改费率请改 config 文件。
# ----------------------
DEFAULT_SETTINGS = {
    'base_currency': 'CNY',
    'rub_per_cny': 12,
    'exchange_rate_effective_from': '2026-08-11',
    'tax_method': 'none',
    'tax_rate': 0,
    'default_route_id': 'DPX-SZ-382822',
    'default_commission_rate': None,
    'default_reverse_included': True,
    'timezone': 'Asia/Shanghai',
    'profit_margin_threshold': 10,
    'logistics_ratio_threshold': 30,
}

DEFAULT_TARIFFS = [
    {
        'tariff_id': 'DPX-SZ-382822-20260209',
        'route_id': 'DPX-SZ-382822',
        'route_name': 'DPX深圳标准',
        'warehouse_code': '382822',
        'origin_city': '深圳',
        'destination_country': 'RU',
        'service_level': 'standard',
        'eta_min_days': 15,
        'eta_max_days': 30,
        'weight_rounding_g': 100,
        'charge_basis': 'actual_weight',
        'max_weight_kg': 20,
        'max_sum_dimensions_cm': 200,
        'max_single_side_cm': 120,
        'battery_limit_wh': 100,
        'reverse_to_ru_warehouse_included': True,
        'effective_from': '2026-02-09',
        'effective_to': None,
        'active': True,
        'source_name': 'DPX运费(1).pdf',
        'notes': 'DPX深圳标准线路',
        'tiers': [
            {'min_weight_kg': 0.1, 'max_weight_kg': 0.3, 'kg_rate_cny': 58, 'fixed_fee_cny': 2},
            {'min_weight_kg': 0.4, 'max_weight_kg': 20, 'kg_rate_cny': 43, 'fixed_fee_cny': 8},
        ]
    },
    {
        'tariff_id': 'WB-SE-20260209',
        'route_id': 'WB-SE',
        'route_name': 'WB超级经济',
        'warehouse_code': '',
        'origin_city': '深圳',
        'destination_country': 'RU',
        'service_level': 'economy',
        'eta_min_days': 15,
        'eta_max_days': 30,
        'weight_rounding_g': 100,
        'charge_basis': 'actual_weight',
        'max_weight_kg': 20,
        'max_sum_dimensions_cm': 200,
        'max_single_side_cm': 115,
        'battery_limit_wh': 100,
        'reverse_to_ru_warehouse_included': True,
        'effective_from': '2026-02-09',
        'effective_to': None,
        'active': True,
        'source_name': 'DPX运费(1).pdf',
        'notes': 'WB超级经济线路',
        'tiers': [
            {'min_weight_kg': 0.1, 'max_weight_kg': 0.3, 'kg_rate_cny': 58, 'fixed_fee_cny': 2},
            {'min_weight_kg': 0.4, 'max_weight_kg': 20, 'kg_rate_cny': 43, 'fixed_fee_cny': 8},
        ]
    },
    {
        'tariff_id': 'WB-PLUS-20260209',
        'route_id': 'WB-PLUS',
        'route_name': 'WB Plus东莞/珲春',
        'warehouse_code': '',
        'origin_city': '东莞',
        'destination_country': 'RU',
        'service_level': 'plus',
        'eta_min_days': 7,
        'eta_max_days': 7,
        'weight_rounding_g': 100,
        'charge_basis': 'actual_weight',
        'max_weight_kg': 20,
        'max_sum_dimensions_cm': 200,
        'max_single_side_cm': 120,
        'battery_limit_wh': 100,
        'reverse_to_ru_warehouse_included': True,
        'effective_from': '2026-02-09',
        'effective_to': None,
        'active': True,
        'source_name': 'DPX运费(1).pdf',
        'notes': 'WB Plus 快速线路',
        'tiers': [
            {'min_weight_kg': 0.1, 'max_weight_kg': 0.3, 'kg_rate_cny': 48, 'fixed_fee_cny': 9},
            {'min_weight_kg': 0.4, 'max_weight_kg': 20, 'kg_rate_cny': 48, 'fixed_fee_cny': 9},
        ]
    },
    {
        'tariff_id': 'HK-EXP-20260209',
        'route_id': 'HK-EXP',
        'route_name': '香港快线',
        'warehouse_code': '',
        'origin_city': '香港',
        'destination_country': 'RU',
        'service_level': 'express',
        'eta_min_days': 10,
        'eta_max_days': 10,
        'weight_rounding_g': 100,
        'charge_basis': 'actual_weight',
        'max_weight_kg': 20,
        'max_sum_dimensions_cm': 200,
        'max_single_side_cm': 60,
        'battery_limit_wh': 100,
        'reverse_to_ru_warehouse_included': True,
        'effective_from': '2026-02-09',
        'effective_to': None,
        'active': True,
        'source_name': 'DPX运费(1).pdf',
        'notes': '香港快线，单边≤60cm',
        'tiers': [
            {'min_weight_kg': 0.1, 'max_weight_kg': 0.3, 'kg_rate_cny': 89, 'fixed_fee_cny': 17},
            {'min_weight_kg': 0.4, 'max_weight_kg': 20, 'kg_rate_cny': 89, 'fixed_fee_cny': 17},
        ]
    },
    {
        'tariff_id': 'DG-EXP-20260209',
        'route_id': 'DG-EXP',
        'route_name': '东莞快线',
        'warehouse_code': '',
        'origin_city': '东莞',
        'destination_country': 'RU',
        'service_level': 'express',
        'eta_min_days': 10,
        'eta_max_days': 10,
        'weight_rounding_g': 100,
        'charge_basis': 'actual_weight',
        'max_weight_kg': 20,
        'max_sum_dimensions_cm': 200,
        'max_single_side_cm': 100,
        'battery_limit_wh': 100,
        'reverse_to_ru_warehouse_included': True,
        'effective_from': '2026-02-09',
        'effective_to': None,
        'active': True,
        'source_name': 'DPX运费(1).pdf',
        'notes': '东莞快线，单边≤100cm',
        'tiers': [
            {'min_weight_kg': 0.1, 'max_weight_kg': 0.3, 'kg_rate_cny': 122, 'fixed_fee_cny': 19},
            {'min_weight_kg': 0.4, 'max_weight_kg': 20, 'kg_rate_cny': 122, 'fixed_fee_cny': 19},
        ]
    },
]

CSV_TEMPLATE_COLUMNS = [
    'order_id', 'order_date', 'status', 'sku_id', 'quantity',
    'buyer_paid_rub', 'seller_revenue_base_rub', 'commission_rate', 'route_id',
    'parcel_id', 'actual_weight_g', 'length_cm', 'width_cm', 'height_cm',
    'purchase_cost_cny', 'packaging_cost_cny', 'china_inbound_cost_cny',
    'promotion_cost_rub', 'tax_cost_cny', 'actual_logistics_cny', 'notes'
]


# ----------------------
# JSON 序列化辅助
# ----------------------
class WBJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super().default(obj)


# ----------------------
# 通用加载/保存
# ----------------------
def _load_json(filepath, default):
    if not os.path.exists(filepath):
        return default
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def _save_json(filepath, data):
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=WBJSONEncoder)
        return True
    except Exception as e:
        print(f'保存失败: {e}')
        return False


# ----------------------
# 设置
# ----------------------
def load_settings():
    data = _load_json(SETTINGS_FILE, None)
    if data is None:
        # 首次：写入默认
        _save_json(SETTINGS_FILE, DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS.copy()
    # 合并默认键（向后兼容）
    merged = DEFAULT_SETTINGS.copy()
    merged.update(data)
    return merged


def save_settings(settings):
    settings['updated_at'] = datetime.now().isoformat()
    return _save_json(SETTINGS_FILE, settings)


# ----------------------
# 费率
# ----------------------
def load_tariffs():
    data = _load_json(TARIFFS_FILE, None)
    if data is None:
        _save_json(TARIFFS_FILE, DEFAULT_TARIFFS)
        return [t.copy() for t in DEFAULT_TARIFFS]
    return data


def save_tariffs(tariffs):
    return _save_json(TARIFFS_FILE, tariffs)


def get_active_routes(tariffs=None):
    """获取启用的线路列表"""
    if tariffs is None:
        tariffs = load_tariffs()
    return [t for t in tariffs if t.get('active', True)]


# ----------------------
# SKU
# ----------------------
def load_skus():
    return _load_json(SKUS_FILE, [])


def save_skus(skus):
    return _save_json(SKUS_FILE, skus)


def add_sku(sku):
    skus = load_skus()
    # 去重
    existing = [s for s in skus if s.get('sku_id') == sku.get('sku_id')]
    if existing:
        skus = [sku if s.get('sku_id') == sku.get('sku_id') else s for s in skus]
    else:
        skus.append(sku)
    return save_skus(skus)


def delete_sku(sku_id):
    skus = load_skus()
    skus = [s for s in skus if s.get('sku_id') != sku_id]
    return save_skus(skus)


# ----------------------
# 订单
# ----------------------
def load_orders():
    return _load_json(ORDERS_FILE, [])


def save_orders(orders):
    return _save_json(ORDERS_FILE, orders)


def add_order(order):
    orders = load_orders()
    existing = [o for o in orders if o.get('order_id') == order.get('order_id')]
    if existing:
        orders = [order if o.get('order_id') == order.get('order_id') else o for o in orders]
    else:
        orders.append(order)
    return save_orders(orders)


def delete_order(order_id):
    orders = load_orders()
    orders = [o for o in orders if o.get('order_id') != order_id]
    return save_orders(orders)


# ----------------------
# CSV 导入导出
# ----------------------
def orders_to_csv(orders):
    """订单列表导出为CSV字符串"""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_TEMPLATE_COLUMNS, extrasaction='ignore')
    writer.writeheader()
    for o in orders:
        row = {}
        for col in CSV_TEMPLATE_COLUMNS:
            row[col] = o.get(col, '')
        writer.writerow(row)
    return output.getvalue()


def csv_to_orders(csv_text):
    """
    CSV文本导入为订单列表。
    返回 (orders, errors)
    orders: 解析成功的订单列表
    errors: [{row: int, message: str}]
    """
    orders = []
    errors = []
    reader = csv.DictReader(io.StringIO(csv_text))
    for i, row in enumerate(reader, start=2):  # 行号从2开始（1是表头）
        try:
            order = {}
            for col in CSV_TEMPLATE_COLUMNS:
                val = row.get(col, '').strip()
                if val == '':
                    order[col] = None
                else:
                    order[col] = val
            # 基础校验
            if not order.get('order_id'):
                errors.append({'row': i, 'message': 'order_id为空'})
                continue
            if not order.get('sku_id'):
                errors.append({'row': i, 'message': 'sku_id为空'})
                continue
            # 数值字段转换
            for k in ['quantity', 'actual_weight_g', 'length_cm', 'width_cm', 'height_cm']:
                if order.get(k):
                    try:
                        order[k] = float(order[k])
                    except ValueError:
                        errors.append({'row': i, 'message': f'{k}格式错误: {order[k]}'})
                        order[k] = None
            for k in ['buyer_paid_rub', 'seller_revenue_base_rub', 'commission_rate',
                      'purchase_cost_cny', 'packaging_cost_cny', 'china_inbound_cost_cny',
                      'promotion_cost_rub', 'tax_cost_cny', 'actual_logistics_cny']:
                if order.get(k):
                    try:
                        order[k] = float(order[k])
                    except ValueError:
                        errors.append({'row': i, 'message': f'{k}格式错误: {order[k]}'})
                        order[k] = None
            orders.append(order)
        except Exception as e:
            errors.append({'row': i, 'message': str(e)})
    return orders, errors


def get_csv_template():
    """生成CSV导入模板"""
    return ','.join(CSV_TEMPLATE_COLUMNS) + '\n'


# ----------------------
# 备份与恢复
# ----------------------
def backup_all():
    """备份所有数据到一个JSON"""
    backup = {
        'backup_time': datetime.now().isoformat(),
        'settings': load_settings(),
        'tariffs': load_tariffs(),
        'skus': load_skus(),
        'orders': load_orders(),
    }
    return backup


def restore_all(backup):
    """从备份恢复"""
    if 'settings' in backup:
        _save_json(SETTINGS_FILE, backup['settings'])
    if 'tariffs' in backup:
        _save_json(TARIFFS_FILE, backup['tariffs'])
    if 'skus' in backup:
        _save_json(SKUS_FILE, backup['skus'])
    if 'orders' in backup:
        _save_json(ORDERS_FILE, backup['orders'])
    return True


def reset_to_default():
    """重置为默认配置（仅费率和设置，不清空SKU和订单）"""
    _save_json(SETTINGS_FILE, DEFAULT_SETTINGS.copy())
    _save_json(TARIFFS_FILE, [t.copy() for t in DEFAULT_TARIFFS])
    return True


# ----------------------
# 唯一事实源装载（模块导入时执行）
# config/*.json 为唯一事实源；上方内嵌常量仅作 config 缺失/损坏时的兜底。
# ----------------------
def _apply_config_source():
    global DEFAULT_SETTINGS, DEFAULT_TARIFFS
    cfg_settings = _load_json(SETTINGS_FILE, None)
    if cfg_settings is not None:
        merged = DEFAULT_SETTINGS.copy()
        merged.update(cfg_settings)
        DEFAULT_SETTINGS = merged
    cfg_tariffs = _load_json(TARIFFS_FILE, None)
    if cfg_tariffs is not None and isinstance(cfg_tariffs, list) and len(cfg_tariffs) > 0:
        DEFAULT_TARIFFS = cfg_tariffs


_apply_config_source()
