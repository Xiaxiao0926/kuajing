"""
WB跨境核算 - 自动化测试
验证运费计算、尺寸校验、线路对比、利润计算等。
运行: python wb_test.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from decimal import Decimal
from datetime import date
import wb_calc
import wb_data


def assert_eq(actual, expected, msg):
    if isinstance(actual, Decimal):
        actual = float(actual)
    if isinstance(expected, Decimal):
        expected = float(expected)
    if abs(float(actual) - float(expected)) > 0.01:
        print(f"  ✗ FAIL: {msg}")
        print(f"    期望: {expected}, 实际: {actual}")
        return False
    print(f"  ✓ PASS: {msg}")
    return True


def test_freight():
    """15.1 运费单元测试"""
    print("\n=== 15.1 运费单元测试 ===")
    tariff = wb_data.DEFAULT_TARIFFS[0]  # DPX深圳
    passed = 0
    total = 0

    cases = [
        (1, 7.80, "1g -> 0.1kg"),
        (80, 7.80, "80g -> 0.1kg"),
        (100, 7.80, "100g -> 0.1kg"),
        (101, 13.60, "101g -> 0.2kg"),
        (270, 19.40, "270g -> 0.3kg"),
        (300, 19.40, "300g -> 0.3kg"),
        (301, 25.20, "301g -> 0.4kg (跳档)"),
        (400, 25.20, "400g -> 0.4kg"),
        (401, 29.50, "401g -> 0.5kg"),
        (500, 29.50, "500g -> 0.5kg"),
        (800, 42.40, "800g -> 0.8kg"),
        (1000, 51.00, "1000g -> 1.0kg"),
        (1050, 55.30, "1050g -> 1.1kg"),
        (2000, 94.00, "2000g -> 2.0kg"),
        (20000, 868.00, "20000g -> 20kg"),
    ]
    for weight, expected, desc in cases:
        total += 1
        calc = wb_calc.calculate_parcel_logistics(weight, tariff)
        if assert_eq(calc['fee_cny'], expected, f"{desc} = ¥{expected}"):
            passed += 1

    # 超重阻断
    total += 1
    calc = wb_calc.calculate_parcel_logistics(20001, tariff)
    if calc['fee_cny'] is None:
        print(f"  ✓ PASS: 20001g 超重阻断")
        passed += 1
    else:
        print(f"  ✗ FAIL: 20001g 应阻断, 实际={calc['fee_cny']}")

    # 多包裹分别取整
    total += 1
    parcels = [{'actual_weight_g': 270}, {'actual_weight_g': 270}]
    order_calc = wb_calc.calculate_order_logistics(parcels, tariff)
    expected_total = 19.40 * 2  # 38.80
    if assert_eq(order_calc['total_fee_cny'], expected_total, "2×270g 独立取整 = ¥38.80"):
        passed += 1

    print(f"\n运费测试: {passed}/{total} 通过")
    return passed, total


def test_dimensions():
    """15.2 尺寸测试"""
    print("\n=== 15.2 尺寸测试 ===")
    tariff = wb_data.DEFAULT_TARIFFS[0]
    passed = 0
    total = 0

    cases = [
        (52, 18, 18, True, "52×18×18 通过"),
        (120, 40, 40, True, "120×40×40 通过 (三边和200, 单边120)"),
        (121, 39, 39, False, "121×39×39 不通过 (单边>120)"),
        (100, 60, 41, False, "100×60×41 不通过 (三边和201)"),
    ]
    for l, w, h, expect_valid, desc in cases:
        total += 1
        parcel = {'actual_weight_g': 500, 'length_cm': l, 'width_cm': w, 'height_cm': h}
        result = wb_calc.validate_parcel(parcel, tariff)
        if result['valid'] == expect_valid:
            print(f"  ✓ PASS: {desc}")
            passed += 1
        else:
            print(f"  ✗ FAIL: {desc}, 期望valid={expect_valid}, 实际={result['valid']}, msgs={result['messages']}")

    print(f"\n尺寸测试: {passed}/{total} 通过")
    return passed, total


def test_route_compare():
    """15.3 线路对比测试"""
    print("\n=== 15.3 线路对比测试 ===")
    tariffs = wb_data.DEFAULT_TARIFFS
    dpx = next(t for t in tariffs if t['route_id'] == 'DPX-SZ-382822')
    wb_plus = next(t for t in tariffs if t['route_id'] == 'WB-PLUS')
    passed = 0
    total = 0

    parcel = {'actual_weight_g': 500, 'length_cm': 20, 'width_cm': 15, 'height_cm': 10}
    results = wb_calc.compare_routes(parcel, [dpx, wb_plus])
    dpx_r = next(r for r in results if r['tariff']['route_id'] == 'DPX-SZ-382822')
    plus_r = next(r for r in results if r['tariff']['route_id'] == 'WB-PLUS')

    total += 1
    if assert_eq(dpx_r['fee_cny'], 29.50, "DPX 500g = ¥29.50"):
        passed += 1
    total += 1
    if assert_eq(plus_r['fee_cny'], 33.00, "WB Plus 500g = ¥33.00"):
        passed += 1
    total += 1
    diff = float(plus_r['fee_cny']) - float(dpx_r['fee_cny'])
    if assert_eq(diff, 3.50, "差价 = ¥3.50"):
        passed += 1

    print(f"\n线路对比测试: {passed}/{total} 通过")
    return passed, total


def test_profit():
    """15.4 利润测试"""
    print("\n=== 15.4 利润测试 ===")
    tariff = wb_data.DEFAULT_TARIFFS[0]
    passed = 0
    total = 0

    # 正常签收盈利
    total += 1
    calc = wb_calc.calculate_parcel_logistics(500, tariff)
    order = {
        'seller_revenue_base_rub': 2000,
        'commission_base_rub': 2000,
        'commission_rate': 25,
        'acquiring_fee_rub': 0,
        'promotion_cost_rub': 0,
        'platform_other_deduction_rub': 0,
    }
    sku = {'purchase_cost_cny': 30, 'packaging_cost_cny': 2, 'china_inbound_cost_cny': 3, 'certification_allocation_cny': 0}
    settings = {'rub_per_cny': 12, 'tax_method': 'none', 'tax_rate': 0}
    profit = wb_calc.calculate_operating_profit(order, sku, settings, float(calc['fee_cny']))
    # 2000/12 = 166.67, commission = 166.67*0.25 = 41.67, net = 166.67 - 41.67 - 29.50 = 95.50
    # profit = 95.50 - 30 - 2 - 3 = 60.50
    if assert_eq(profit['operating_profit_cny'], 60.50, "正常签收盈利"):
        passed += 1

    # 正常签收负毛利
    total += 1
    order2 = {**order, 'seller_revenue_base_rub': 500, 'commission_base_rub': 500}
    profit2 = wb_calc.calculate_operating_profit(order2, sku, settings, float(calc['fee_cny']))
    if float(profit2['operating_profit_cny']) < 0:
        print(f"  ✓ PASS: 正常签收负毛利 (profit={profit2['operating_profit_cny']})")
        passed += 1
    else:
        print(f"  ✗ FAIL: 期望负毛利, 实际={profit2['operating_profit_cny']}")

    # 301g跳档
    total += 1
    calc301 = wb_calc.calculate_parcel_logistics(301, tariff)
    calc300 = wb_calc.calculate_parcel_logistics(300, tariff)
    diff = float(calc301['fee_cny']) - float(calc300['fee_cny'])
    if assert_eq(diff, 5.80, "301g vs 300g 跳档差价 = ¥5.80"):
        passed += 1

    # 买家拒收 - 正向物流保留
    total += 1
    return_calc = wb_calc.calculate_return_loss(
        {'inventory_recovery_rate': 50, 'return_to_china_or_disposal_cost_cny': 0,
         'non_refunded_commission_cny': 0, 'other_failure_cost_cny': 0},
        sku, float(calc['fee_cny']), settings
    )
    # inventory_loss = 30 * (100-50)/100 = 15
    # total = 29.50 + 2 + 3 + 0 + 0 + 15 + 0 = 49.50
    if assert_eq(return_calc['failed_order_loss_cny'], 49.50, "买家拒收损失"):
        passed += 1

    # 分母为0安全显示
    total += 1
    order_zero = {**order, 'seller_revenue_base_rub': 0}
    profit_zero = wb_calc.calculate_operating_profit(order_zero, sku, settings, 0)
    if profit_zero['profit_margin'] is None:
        print(f"  ✓ PASS: 分母为0利润率安全显示为None")
        passed += 1
    else:
        print(f"  ✗ FAIL: 期望None, 实际={profit_zero['profit_margin']}")

    print(f"\n利润测试: {passed}/{total} 通过")
    return passed, total


def test_tariff_version():
    """历史费率版本测试"""
    print("\n=== 历史费率版本测试 ===")
    tariffs = [
        {**wb_data.DEFAULT_TARIFFS[0], 'tariff_id': 'OLD', 'effective_from': '2025-01-01', 'effective_to': '2026-02-08',
         'tiers': [{'min_weight_kg': 0.1, 'max_weight_kg': 0.3, 'kg_rate_cny': 60, 'fixed_fee_cny': 3},
                   {'min_weight_kg': 0.4, 'max_weight_kg': 20, 'kg_rate_cny': 45, 'fixed_fee_cny': 9}]},
        wb_data.DEFAULT_TARIFFS[0],  # 新费率
    ]
    passed = 0
    total = 0

    # 2025年订单用旧费率
    total += 1
    old_t = wb_calc.select_tariff_version('DPX-SZ-382822', date(2025, 6, 1), tariffs)
    if old_t and old_t['tariff_id'] == 'OLD':
        print(f"  ✓ PASS: 2025年订单使用旧费率")
        passed += 1
    else:
        print(f"  ✗ FAIL: 期望旧费率, 实际={old_t['tariff_id'] if old_t else None}")

    # 2026年订单用新费率
    total += 1
    new_t = wb_calc.select_tariff_version('DPX-SZ-382822', date(2026, 3, 1), tariffs)
    if new_t and new_t['tariff_id'] != 'OLD':
        print(f"  ✓ PASS: 2026年订单使用新费率")
        passed += 1
    else:
        print(f"  ✗ FAIL: 期望新费率, 实际={new_t['tariff_id'] if new_t else None}")

    print(f"\n费率版本测试: {passed}/{total} 通过")
    return passed, total


if __name__ == '__main__':
    print("WB跨境核算 - 自动化测试")
    print("=" * 50)

    p1, t1 = test_freight()
    p2, t2 = test_dimensions()
    p3, t3 = test_route_compare()
    p4, t4 = test_profit()
    p5, t5 = test_tariff_version()

    total_passed = p1 + p2 + p3 + p4 + p5
    total_tests = t1 + t2 + t3 + t4 + t5

    print("\n" + "=" * 50)
    print(f"总计: {total_passed}/{total_tests} 通过")
    if total_passed == total_tests:
        print("🎉 全部通过！")
    else:
        print(f"⚠️ {total_tests - total_passed} 项未通过")
    sys.exit(0 if total_passed == total_tests else 1)
