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
  if (typeof data.rub_per_cny !== 'number' || data.rub_per_cny <= 0) fail('settings.json rub_per_cny 必须为正数');
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

function main() {
  if (!fs.existsSync(CONFIG_DIR)) fail(`config 目录不存在: ${CONFIG_DIR}`);
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  for (const { file, out } of SOURCES) {
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

    const header = `// 自动生成 - 勿手改。来源: config/${file}（唯一事实源）。\n// 重新生成: node scripts/sync-config.js\n`;
    const body = `export default ${JSON.stringify(data, null, 2)}\n`;
    fs.writeFileSync(path.join(GENERATED_DIR, out), header + body, 'utf-8');
    console.log(`[sync-config] config/${file} → src/generated/${out}`);
  }
  console.log('[sync-config] 完成');
}

main();
