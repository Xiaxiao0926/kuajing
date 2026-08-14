"""
WB跨境核算 - 数据存储管理
本地JSON持久化、CSV导入导出、备份恢复。

配置唯一事实源：config/wb_tariffs.json 与 config/settings.json（fail-fast）
- 经环境变量 CONFIG_DIR 指定；默认相对路径 ../config（仓库根/config）
- 模块导入时严格加载：文件缺失/JSON损坏/结构非法 → 抛出 RuntimeError，
  不静默回退到任何内嵌数值（避免第二套费率数字）。
- wb_data/ 目录仅保留运行时数据（skus.json / orders.json，宽容加载）。
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
# 配置严格加载（fail-fast，唯一事实源）
# ----------------------
class ConfigError(RuntimeError):
    """配置文件缺失/损坏/结构非法。"""


def _load_config_strict(filepath, label):
    if not os.path.exists(filepath):
        raise ConfigError(
            f'[config] {label} 不存在: {filepath}。'
            f'唯一事实源 config/ 目录不得缺失；请检查仓库完整性或 CONFIG_DIR 环境变量。'
        )
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise ConfigError(f'[config] {label} JSON 损坏: {filepath} (行{e.lineno}列{e.colno}: {e.msg})') from e
    except OSError as e:
        raise ConfigError(f'[config] {label} 读取失败: {filepath}: {e}') from e


def _validate_settings_structure(data):
    required = ['base_currency', 'rub_per_cny', 'exchange_rate_effective_from',
                'tax_method', 'tax_rate', 'default_route_id', 'timezone',
                'profit_margin_threshold', 'logistics_ratio_threshold']
    missing = [k for k in required if k not in data]
    if missing:
        raise ConfigError(f'[config] settings.json 缺少必填字段: {missing}')
    for k in ['rub_per_cny', 'tax_rate', 'profit_margin_threshold', 'logistics_ratio_threshold']:
        if not isinstance(data[k], (int, float)):
            raise ConfigError(f'[config] settings.json 字段 {k} 必须为数字, 实际 {data[k]!r}')
    if data['rub_per_cny'] <= 0:
        raise ConfigError(f'[config] settings.json rub_per_cny 必须为正数')


def _validate_tariffs_structure(data):
    if not isinstance(data, list) or len(data) == 0:
        raise ConfigError('[config] wb_tariffs.json 必须为非空数组')
    for t in data:
        for k in ['tariff_id', 'route_id', 'effective_from', 'tiers']:
            if not t.get(k):
                raise ConfigError(f'[config] wb_tariffs.json 费率 {t.get("tariff_id") or "?"} 缺少字段 {k}')
        for tier in t['tiers']:
            for k in ['min_weight_kg', 'max_weight_kg', 'kg_rate_cny', 'fixed_fee_cny']:
                if not isinstance(tier.get(k), (int, float)):
                    raise ConfigError(f'[config] wb_tariffs.json {t["tariff_id"]} 区间字段 {k} 非数字')


# 模块导入即严格加载（唯一事实源；失败即抛错，绝无第二套数字）
DEFAULT_SETTINGS = _load_config_strict(SETTINGS_FILE, 'settings.json')
_validate_settings_structure(DEFAULT_SETTINGS)
DEFAULT_TARIFFS = _load_config_strict(TARIFFS_FILE, 'wb_tariffs.json')
_validate_tariffs_structure(DEFAULT_TARIFFS)

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
# 运行数据（skus/orders）宽容加载；配置数据一律经 _load_config_strict fail-fast
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
# 设置（唯一事实源 config/settings.json，fail-fast）
# ----------------------
def load_settings():
    data = _load_config_strict(SETTINGS_FILE, 'settings.json')
    _validate_settings_structure(data)
    return data


def save_settings(settings):
    """面板编辑设置 → 写回唯一事实源 config/settings.json（用户显式操作）"""
    settings['updated_at'] = datetime.now().isoformat()
    return _save_json(SETTINGS_FILE, settings)


# ----------------------
# 费率（唯一事实源 config/wb_tariffs.json，fail-fast）
# ----------------------
def load_tariffs():
    data = _load_config_strict(TARIFFS_FILE, 'wb_tariffs.json')
    _validate_tariffs_structure(data)
    return data


def save_tariffs(tariffs):
    """面板编辑费率 → 写回唯一事实源 config/wb_tariffs.json（用户显式操作）"""
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
    """重置为仓库基线配置（重新从唯一事实源 config 文件读取并写回，清除运行期编辑）"""
    settings = _load_config_strict(SETTINGS_FILE, 'settings.json')
    _validate_settings_structure(settings)
    tariffs = _load_config_strict(TARIFFS_FILE, 'wb_tariffs.json')
    _validate_tariffs_structure(tariffs)
    ok1 = _save_json(SETTINGS_FILE, settings)
    ok2 = _save_json(TARIFFS_FILE, tariffs)
    return ok1 and ok2
