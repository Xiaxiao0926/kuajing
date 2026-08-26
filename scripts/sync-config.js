#!/usr/bin/env node
/**
 * config/*.json → ozon-react/src/generated/*.js 同步器
 *
 * 单一事实源：D:/ozon/config/*.json（snake_case）
 * 生成物：ozon-react/src/generated/*.js（export default <json>），
 *         供 React ESM 导入（vite 与 node 测试均可直接使用）。
 *
 * 用途：
 *   1. 手动执行：node scripts/sync-config.js
 *   2. npm test 前置自动执行（保证测试永远使用最新配置）
 *   3. vite buildStart 时执行（保证构建产物使用最新配置）
 *
 * 校验：轻量结构校验（无第三方依赖），失败即退出码 1。
 */
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const GENERATED_DIR = path.join(__dirname, '..', 'ozon-react', 'src', 'generated');

const SOURCES = [
  { file: 'wb_tariffs.json', out: 'wb_tariffs.js' },
  { file: 'settings.json', out: 'settings.js' },
  { file: 'ozon_channels.json', out: 'ozon_channels.js' },
  { file: 'scoring_rules.json', out: 'scoring_rules.js', frozen: true },
];

function fail(msg) {
  console.error(`[sync-config] 校验失败: ${msg}`);
  process.exit(1);
}

function validateTariffs(data) {
  if (!Array.isArray(data) || data.length === 0) fail('wb_tariffs.json 必须为非空数组');
  for (const t of data) {
    for (const k of ['tariff_id', 'route_id', 'effective_from', 'tiers']) {
      if (t[k] === undefined || t[k] === null || t[k] === '') fail(`费率 ${t.tariff_id || '?'} 缺少字段 ${k}`);
    }
    for (const tier of t.tiers) {
      for (const k of ['min_weight_kg', 'max_weight_kg', 'kg_rate_cny', 'fixed_fee_cny']) {
        if (typeof tier[k] !== 'number') fail(`费率 ${t.tariff_id} 区间字段 ${k} 非数字`);
      }
    }
  }
}

function validateSettings(data) {
  const required = [
    'base_currency', 'rub_per_cny', 'exchange_rate_effective_from',
    'tax_method', 'tax_rate', 'default_route_id',
    'buyer_to_ru_warehouse_reverse_included', 'timezone',
    'profit_margin_threshold', 'logistics_ratio_threshold',
    'calculation_version', 'agency_fee',
  ];
  const missing = required.filter((k) => data[k] === undefined || data[k] === null);
  if (missing.length > 0) fail(`settings.json 缺少必填字段: ${missing.join(', ')}`);
  for (const k of ['rub_per_cny', 'tax_rate', 'profit_margin_threshold', 'logistics_ratio_threshold']) {
    if (typeof data[k] !== 'number') fail(`settings.json 字段 ${k} 必须为数字, 实际 ${JSON.stringify(data[k])}`);
  }
  if (data.rub_per_cny <= 0) fail('settings.json rub_per_cny 必须为正数');
  if (typeof data.calculation_version !== 'string' || !data.calculation_version.trim()) {
    fail('settings.json calculation_version 必须为非空字符串');
  }
  if (typeof data.agency_fee.rate !== 'number' || typeof data.agency_fee.min_rub !== 'number' || typeof data.agency_fee.max_rub !== 'number') {
    fail('settings.json agency_fee 格式必须包含 rate, min_rub, max_rub 数字');
  }
  if (data.agency_fee.rate < 0 || data.agency_fee.min_rub < 0 || data.agency_fee.max_rub < data.agency_fee.min_rub) {
    fail('settings.json agency_fee 数值无效（rate/min 不得为负，max 必须 >= min）');
  }
}

function validateChannels(data) {
  if (!Array.isArray(data.groups) || data.groups.length === 0) fail('ozon_channels.json groups 必须为非空数组');
  for (const g of data.groups) {
    for (const ch of g.channels) {
      if (typeof ch.kg_rate_cny !== 'number' || typeof ch.fixed_fee_cny !== 'number') {
        fail(`渠道 ${ch.id} 费率字段非数字`);
      }
      if (ch.weight_rounding_g !== undefined && ch.weight_rounding_g !== null && ch.weight_rounding_g <= 0) {
        fail(`渠道 ${ch.id} weight_rounding_g 非法`);
      }
    }
  }
}

// T4-4B Gate 0 / T4-5 final hardening：评分规则必须自洽（缺 λ/子权重/权重越界直接 fail-close，禁止静默回退）
function validateScoringRules(data) {
  const d = data.dimensions?.demand;
  if (!d) fail('scoring_rules.json 缺少 dimensions.demand');
  for (const k of ['scale_weight', 'scale_sales_weight', 'scale_units_weight']) {
    if (typeof d[k] !== 'number' || d[k] <= 0) fail(`scoring_rules.json demand.${k} 必须为正数`);
  }
  if (d.scale_weight > 1) fail('scoring_rules.json demand.scale_weight 必须 <= 1（λ∈(0,1]，禁止 >1）');
  if (Math.abs(d.scale_sales_weight + d.scale_units_weight - 1) > 1e-9) {
    fail('scoring_rules.json demand.scale_sales_weight + scale_units_weight 必须等于 1');
  }
  if (!Array.isArray(data.grades) || data.grades.length === 0) fail('scoring_rules.json grades 必须为非空数组');
  let weightSum = 0;
  for (const key of ['demand', 'competition', 'price_opportunity', 'profitability', 'logistics', 'operations']) {
    const dim = data.dimensions?.[key];
    if (!dim || typeof dim.weight !== 'number') fail(`scoring_rules.json 维度 ${key} 缺少权重`);
    weightSum += dim.weight;
  }
  if (Math.abs(weightSum - 100) > 1e-9) fail(`scoring_rules.json 六维权重之和必须 = 100（实际 ${weightSum}）`);
}

function main() {
  if (!fs.existsSync(CONFIG_DIR)) fail(`config 目录不存在: ${CONFIG_DIR}`);
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  // 先全部加载+校验，任一失败即退出（不产生部分写入）
  const payloads = [];
  for (const { file, out, frozen } of SOURCES) {
    const src = path.join(CONFIG_DIR, file);
    if (!fs.existsSync(src)) fail(`缺少配置文件 ${file}`);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(src, 'utf-8'));
    } catch (e) {
      fail(`${file} JSON 解析失败: ${e.message}`);
    }
    if (file === 'wb_tariffs.json') validateTariffs(data);
    if (file === 'settings.json') validateSettings(data);
    if (file === 'ozon_channels.json') validateChannels(data);
    if (file === 'scoring_rules.json') validateScoringRules(data);
    payloads.push({ out, data, frozen });
  }

  // 校验全过后统一写入
  for (const { out, data, frozen } of payloads) {
    const header = `// 自动生成 - 勿手改。来源: config/${out.replace('.js', '.json')}（唯一事实源）。\n// 重新生成: node scripts/sync-config.js\n`;
    const body = frozen
      ? `const scoringRules = ${JSON.stringify(data, null, 2)};\nconst deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };\nexport default deepFreeze(scoringRules);\n`
      : `export default ${JSON.stringify(data, null, 2)}\n`;
    fs.writeFileSync(path.join(GENERATED_DIR, out), header + body, 'utf-8');
    console.log(`[sync-config] config/${out.replace('.js', '.json')} → src/generated/${out}`);
  }
  console.log('[sync-config] 完成');
}

main();
