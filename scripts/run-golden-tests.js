#!/usr/bin/env node
/**
 * 黄金业务案例护栏测试（T2-3 起正式启用）
 *
 * 读取 tests/golden/*.json，逐案例对 React 引擎验证
 * {provenance, input, expected} 结构，任一数字不一致即退出码 1。
 *
 * provenance 约定：
 *   spec_derived / verified_by_human: false  → 推导种子
 *   real_order   / verified_by_human: true   → 最高等级护栏（人工核算）
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const GOLDEN_DIR = path.join(__dirname, '..', 'tests', 'golden');

// 核心护栏基线：以下案例 ID 必须全部存在（防止误删个别文件后仍全绿）。
// 新增案例不受此表限制（不使用固定断言总数，避免加案例误报）。
const REQUIRED_GOLDEN_IDS = [
  'wb-parcel-weight-boundaries',
  'wb-multi-parcel',
  'wb-profit-normal-order',
  'wb-reverse-six-scenarios',
  'ozon-cel-channels',
];

const importModule = (p) => import(pathToFileURL(p).href);

async function main() {
  // fail-close：黄金案例是强制护栏，目录缺失/为空 = 失败，不允许 SKIP 通过
  if (!fs.existsSync(GOLDEN_DIR)) {
    console.error('[test:golden] FAIL — tests/golden/ 目录缺失。黄金案例是强制护栏，删除目录即视为护栏失效。');
    process.exit(1);
  }
  const files = fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.error('[test:golden] FAIL — tests/golden/ 为空。黄金案例是强制护栏，零案例即视为护栏失效。');
    process.exit(1);
  }

  const { calculateParcelLogistics, calculateOrderLogistics, calculateTotalLogisticsCost, calculateOperatingProfitV2 } = await importModule(
    path.join(__dirname, '..', 'ozon-react', 'src', 'utils', 'wbEngine.js')
  );
  const { DEFAULT_TARIFFS } = await importModule(
    path.join(__dirname, '..', 'ozon-react', 'src', 'utils', 'wbConfig.js')
  );
  const { ALL_CHANNELS, calcShipping } = await importModule(
    path.join(__dirname, '..', 'ozon-react', 'src', 'utils', 'ozonEngine.js')
  );

  // 校验核心案例完整性
  const loadedIds = [];
  for (const file of files) {
    try {
      const spec = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, file), 'utf-8'));
      if (spec && spec.id) loadedIds.push(spec.id);
    } catch (e) {
      /* 解析错误稍后在逐文件阶段报告 */
    }
  }
  const missingIds = REQUIRED_GOLDEN_IDS.filter((id) => !loadedIds.includes(id));
  if (missingIds.length > 0) {
    console.error(`[test:golden] FAIL — 缺少核心案例: ${missingIds.join(', ')}。核心护栏不允许缺失。`);
    process.exit(1);
  }

  let pass = 0;
  let fail = 0;
  const failures = [];

  const close = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;
  const check = (label, actual, expected, tolerant = true) => {
    if (expected === null || expected === undefined) {
      if (actual === null || actual === undefined) { pass++; return; }
      failures.push(`${label}: 期望 null/undefined, 实际 ${actual}`);
      fail++;
      return;
    }
    if (tolerant && typeof expected === 'number') {
      if (close(actual, expected)) { pass++; return; }
      failures.push(`${label}: 期望 ${expected}, 实际 ${actual}`);
      fail++;
      return;
    }
    if (actual === expected) { pass++; return; }
    failures.push(`${label}: 期望 ${expected}, 实际 ${actual}`);
    fail++;
  };

  for (const file of files) {
    let spec;
    try {
      spec = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, file), 'utf-8'));
    } catch (e) {
      fail++;
      failures.push(`${file}: JSON 解析失败 ${e.message}`);
      continue;
    }
    if (!spec.provenance || !spec.provenance.source_type) {
      fail++;
      failures.push(`${file}: 缺少 provenance 字段`);
      continue;
    }
    const human = spec.provenance.verified_by_human === true;
    const tag = human ? '人工确认' : '推导种子';

    for (const c of spec.cases) {
      try {
        if (spec.case_type === 'parcel_logistics') {
          const tariff = DEFAULT_TARIFFS.find((t) => t.tariffId === spec.tariff_id);
          const r = calculateParcelLogistics(c.input.actualWeightG, tariff);
          check(`${spec.id}(${tag}) ${c.input.actualWeightG}g 计费重量`, r.billableWeightKg, c.expected.billableWeightKg);
          check(`${spec.id}(${tag}) ${c.input.actualWeightG}g 运费`, r.feeCny, c.expected.feeCny);
        } else if (spec.case_type === 'total_logistics') {
          const tariff = DEFAULT_TARIFFS.find((t) => t.tariffId === spec.tariff_id);
          const r = calculateTotalLogisticsCost(c.input, tariff);
          for (const [k, v] of Object.entries(c.expected)) {
            check(`${spec.id}(${tag}) ${k}`, r[k], v);
          }
        } else if (spec.case_type === 'operating_profit') {
          const tariff = DEFAULT_TARIFFS.find((t) => t.tariffId === spec.tariff_id);
          const r = calculateOperatingProfitV2(c.input.order, c.input.sku, c.input.settings, tariff);
          for (const [k, v] of Object.entries(c.expected)) {
            check(`${spec.id}(${tag}) ${k}`, r[k], v);
          }
        } else if (spec.case_type === 'order_logistics') {
          const tariff = DEFAULT_TARIFFS.find((t) => t.tariffId === spec.tariff_id);
          const r = calculateOrderLogistics(c.input.parcels, tariff);
          check(`${spec.id}(${tag}) 包裹数`, r.parcelCount, c.expected.parcelCount);
          if (c.expected.perParcelFeeCny) {
            r.parcels.forEach((p, i) => check(`${spec.id}(${tag}) 包裹${i + 1}运费`, p.feeCny, c.expected.perParcelFeeCny[i]));
          }
          check(`${spec.id}(${tag}) 合计`, r.totalFeeCny, c.expected.totalFeeCny);
        } else if (spec.case_type === 'channel_shipping') {
          const ch = ALL_CHANNELS.find((x) => x.id === c.input.channelId);
          const r = calcShipping(ch, c.input.price, c.input.weight, c.input.length, c.input.width, c.input.height);
          for (const [k, v] of Object.entries(c.expected)) {
            check(`${spec.id}(${tag}) ${c.input.channelId} ${k}`, r ? r[k] : null, v);
          }
        } else {
          fail++;
          failures.push(`${file}: 未知 case_type ${spec.case_type}`);
        }
      } catch (e) {
        fail++;
        failures.push(`${file}: 执行异常 ${e.message}`);
      }
    }
  }

  if (failures.length > 0) {
    console.log('\n失败明细:');
    failures.forEach((f) => console.log(`  ❌ ${f}`));
  }
  console.log(`\n===== 黄金案例: ${pass} 通过 / ${fail} 失败 =====`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
