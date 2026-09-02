#!/usr/bin/env node
/**
 * FBP 边境仓资费提取器
 * 运费计算/FBP_list_of_services_CN_HK1092026_*.xlsx (中国 FBP / 中国 FBP WHS sheets)
 *   → config/ozon_fbp_channels.json
 *
 * 口径（2026-09-02 策划方案冻结）：
 *   - 以中文 sheet「中国 FBP」为唯一费率事实源；WHS 表仅解析仓库→物流商映射
 *   - DEX（USD 计费）一期排除；Smart 服务（费率与纯等级重复）跳过
 *   - per100g 线路线性折算为 per_g（Ural HK：¥10.50/100g → 0.105¥/g）
 *   - 俄式小数逗号（¥0,0371）与全角空格全部清洗
 *
 * 运行：node scripts/extract_fbp_tariffs.js
 * 输出：config JSON + 控制台统计摘要 + 异常清单（人工核验 3-5 行后定稿）
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, '运费计算', 'FBP_list_of_services_CN_HK1092026_1788173088.xlsx');
const OUT = path.join(ROOT, 'config', 'ozon_fbp_channels.json');

const DEST_MAP = { 俄罗斯: 'RU', 白俄罗斯: 'BY', 哈萨克斯坦: 'KZ' };
const BAT_MAP = { 禁止: 'forbidden', 允许: 'allowed', 需要MSDS: 'msds' };
const LEVEL_ORDER = ['Super Express', 'Express', 'Standard', 'Economy'];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// "¥3.37 + ¥0.0393/1克" | "¥25.83  + ¥ 0.0281/1克" | "¥18.00 + ¥10.50/100克" | "¥5.4+0.068/1克"（第二段可无¥）| 俄式小数逗号
function parseRate(str) {
  const s = String(str).replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  const m = s.match(/¥\s*(\d+(?:\.\d+)?)\s*\+\s*(?:¥|￥)?\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*克/i);
  if (!m) return null;
  return { fixed: num(m[1]), rate: num(m[2]), denom: num(m[3]) };
}

// "边长总和 ≤ 90 cm, 长边 ≤ 60 cm" | "...150 cm."
function parseDims(str) {
  const s = String(str).replace(/\s+/g, ' ');
  const sum = s.match(/总和\s*≤\s*(\d+)/);
  const side = s.match(/长边\s*≤\s*(\d+)/);
  return { sum: sum ? num(sum[1]) : null, side: side ? num(side[1]) : null };
}

// "1 - 1500" | "135.01 - 13 515" | "7001 - 250 000"（空格千分位）
function parseRange(str) {
  const s = String(str).replace(/\s/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { min: num(m[1]), max: num(m[2]) };
}

// 计费类型 + 体积重公式 → charge_weight / vol_divisor / vol_threshold_sum_cm
// conditional（如 Ural Super Express）：三边和 ≤ 阈值用实重，> 阈值用体积重
function parseChargeType(billType, volFormula) {
  const t = String(billType || '').replace(/\s+/g, '');
  if (t.includes('实际重量') && !t.includes('较大值') && !t.includes('边长总和')) {
    return { chargeWeight: 'actual', volDivisor: null, volThreshold: null };
  }
  if (t.includes('较大值')) {
    const f = String(volFormula || '').replace(/\s/g, '');
    if (/÷6000/i.test(f)) return { chargeWeight: 'vol_6000', volDivisor: 6000, volThreshold: null };
    if (/÷12000/i.test(f)) return { chargeWeight: 'vol_12000', volDivisor: 12000, volThreshold: null };
    return { chargeWeight: 'unparsed', volDivisor: null, volThreshold: null };
  }
  if (t.includes('边长总和')) {
    const f = String(volFormula || '').replace(/\s/g, '');
    const th = t.match(/边长总和≤(\d+)cm/);
    const divisor = /÷6000/i.test(f) ? 6000 : /÷12000/i.test(f) ? 12000 : null;
    if (th && divisor) {
      return { chargeWeight: 'conditional', volDivisor: divisor, volThreshold: Number(th[1]) };
    }
    return { chargeWeight: 'unparsed', volDivisor: null, volThreshold: null };
  }
  return { chargeWeight: 'unparsed', volDivisor: null, volThreshold: null };
}

function cleanText(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function extractChannels() {
  const wb = XLSX.readFile(SRC);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['中国 FBP'], { header: 1 });
  const channels = [];
  const anomalies = [];
  let skippedDex = 0;
  let skippedSmart = 0;
  let seq = 0;

  for (let i = 5; i < rows.length; i++) {
    const r = rows[i];
    const carrier = cleanText(r[0]);
    if (!carrier || carrier === 'переход') continue;

    const serviceName = cleanText(r[1]);
    const serviceLevel = cleanText(r[2]);
    const destZh = cleanText(r[3]);
    const scoring = cleanText(r[4]);
    const method = cleanText(r[5]);
    const speed = cleanText(r[6]);
    const rateStr = String(r[7] || '');

    if (carrier === 'DEX') { skippedDex++; continue; }          // 一期排除（USD）
    if (/Smart/i.test(serviceName)) { skippedSmart++; continue; } // 费率与纯等级重复

    const dest = DEST_MAP[destZh];
    if (!dest) { anomalies.push({ row: i + 1, reason: `未知目的国 "${destZh}"`, carrier }); continue; }

    const rate = parseRate(rateStr);
    if (!rate || !rate.fixed || !rate.rate || !rate.denom) {
      anomalies.push({ row: i + 1, reason: `费率解析失败 "${rateStr}"`, carrier }); continue;
    }

    const dims = parseDims(r[10]);
    if (!dims.sum || !dims.side) { anomalies.push({ row: i + 1, reason: `尺寸解析失败 "${r[10]}"`, carrier }); continue; }

    const weightMin = num(r[11]);
    const weightMax = num(r[12]);
    if (weightMin === null || weightMax === null) { anomalies.push({ row: i + 1, reason: `重量区间缺失`, carrier }); continue; }

    const priceRange = parseRange(r[13]);
    if (!priceRange) { anomalies.push({ row: i + 1, reason: `申报价值解析失败 "${r[13]}"`, carrier }); continue; }

    const batteries = BAT_MAP[cleanText(r[8])];
    const liquids = BAT_MAP[cleanText(r[9])];
    if (!batteries || !liquids) { anomalies.push({ row: i + 1, reason: `电池/液体标识 "${r[8]}"/"${r[9]}"`, carrier }); continue; }

    const { chargeWeight, volDivisor, volThreshold } = parseChargeType(r[17], r[18]);
    if (chargeWeight === 'unparsed') {
      anomalies.push({ row: i + 1, reason: `计费类型异常 "${r[17]}" / "${r[18]}"`, carrier }); continue;
    }
    if ((chargeWeight === 'vol_6000' || chargeWeight === 'vol_12000') && !volDivisor) {
      anomalies.push({ row: i + 1, reason: `体积重缺 divisor`, carrier }); continue;
    }
    if (chargeWeight === 'conditional' && (!volDivisor || !volThreshold)) {
      anomalies.push({ row: i + 1, reason: `条件体积重缺 divisor/threshold`, carrier }); continue;
    }

    const reverse = [r[20], r[21], r[22]].map(cleanText).filter(Boolean).join('；');

    seq++;
    const ch = {
      id: `${carrier.toLowerCase().replace(/\s+/g, '_')}_${dest.toLowerCase()}_${serviceLevel.toLowerCase().replace(/\s+/g, '_')}_${scoring.toLowerCase().replace(/\s+/g, '_')}_${seq}`,
      carrier,
      destination: dest,
      destination_zh: destZh,
      service_name: serviceName,
      service_level: serviceLevel,
      scoring_group: scoring,
      method,
      speed_days: speed,
      fixed_cny: rate.fixed,
      rate_per_g_cny: Math.round((rate.rate / rate.denom) * 1e6) / 1e6,
      weight_min_g: weightMin,
      weight_max_g: weightMax,
      sum_max_cm: dims.sum,
      side_max_cm: dims.side,
      price_min_rub: priceRange.min,
      price_max_rub: priceRange.max,
      batteries,
      liquids,
      charge_weight: chargeWeight,
      vol_divisor: volDivisor,
      loss_compensation_rub: num(r[19]),
      reverse_policy: reverse,
    };
    if (volThreshold !== null) ch.vol_threshold_sum_cm = volThreshold;
    channels.push(ch);
  }

  return { channels, anomalies, skippedDex, skippedSmart };
}

// WHS 表 → 仓库→物流商映射（所有区块合并；Ural Hong Kong 特例 → Ural HK；DEX 排除）
function extractWarehouses() {
  const wb = XLSX.readFile(SRC);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['中国 FBP WHS'], { header: 1 });
  const map = new Map();
  for (const r of rows) {
    const wh = cleanText(r[0]);
    const service = cleanText(r[2]);
    if (!wh || wh === '仓库' || service.includes('FBP') === false) continue;
    if (service.includes('DEX')) continue;
    const whNames = wh.split(',').map((s) => cleanText(s)).filter(Boolean);
    for (const name of whNames) {
      if (!map.has(name)) map.set(name, new Set());
      let carrier = service.split(' ')[0];
      if (name === 'Ural Hong Kong') carrier = 'Ural HK';
      map.get(name).add(carrier);
    }
  }
  return [...map.entries()].map(([name, carriers], i) => ({
    id: `wh_${i + 1}`,
    name,
    carriers: [...carriers].sort(),
  }));
}

function main() {
  const { channels, anomalies, skippedDex, skippedSmart } = extractChannels();
  const warehouses = extractWarehouses();

  // 分组：destination → carrier → service_level
  const groupMap = new Map();
  for (const ch of channels) {
    const key = `${ch.destination}|${ch.carrier}|${ch.service_level}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        destination: ch.destination,
        destination_zh: ch.destination_zh,
        carrier: ch.carrier,
        service_level: ch.service_level,
        service_name: ch.service_name,
        channels: [],
      });
    }
    groupMap.get(key).channels.push(ch);
  }
  const groups = [...groupMap.values()].sort((a, b) => {
    const d = a.destination.localeCompare(b.destination);
    if (d !== 0) return d;
    const c = a.carrier.localeCompare(b.carrier);
    if (c !== 0) return c;
    return LEVEL_ORDER.indexOf(a.service_level) - LEVEL_ORDER.indexOf(b.service_level);
  });
  // 组内按评分组固定顺序
  const SG = ['Extra Small', 'Other', 'Budget', 'Small', 'Big', 'Premium Small', 'Premium Big'];
  for (const g of groups) g.channels.sort((a, b) => SG.indexOf(a.scoring_group) - SG.indexOf(b.scoring_group));

  const config = {
    source: 'FBP_list_of_services_CN_HK1092026_1788173088.xlsx (中国FBP sheet)',
    source_date: '2026-09-02',
    version: 'FBP-2026.09',
    scope_note: 'FBP 3PL 段：中国揽收点→Ozon 目的国分拣中心；不含 Ozon 尾程配送费；DEX(USD) 与 Smart 服务一期排除',
    storage: { free_days: 90, rate_cny_per_m3_per_day: 4 },
    last_mile: { source: null, note: 'Ozon 尾程配送费（分拣中心→买家）待用户提供费率表，一期 UI 手动输入', billing: null, rows: [] },
    warehouses,
    groups,
  };

  fs.writeFileSync(OUT, JSON.stringify(config, null, 2) + '\n', 'utf8');

  // 统计摘要
  const byDest = {};
  const byCarrier = {};
  const byCw = {};
  for (const c of channels) {
    byDest[c.destination] = (byDest[c.destination] || 0) + 1;
    byCarrier[c.carrier] = (byCarrier[c.carrier] || 0) + 1;
    byCw[c.charge_weight] = (byCw[c.charge_weight] || 0) + 1;
  }
  console.log('===== FBP 资费提取摘要 =====');
  console.log(`提取线路: ${channels.length} 条 | 分组: ${groups.length} 组 | 仓库: ${warehouses.length} 个`);
  console.log(`排除: DEX ${skippedDex} 行（USD）, Smart ${skippedSmart} 行（重复费率）`);
  console.log('\n按目的国:', JSON.stringify(byDest));
  console.log('按物流商:', JSON.stringify(byCarrier));
  console.log('按计费类型:', JSON.stringify(byCw));
  console.log('\n仓库映射:');
  warehouses.forEach((w) => console.log(`  ${w.name} → ${w.carriers.join('/')}`));
  if (anomalies.length) {
    console.log(`\n⚠️ 异常 ${anomalies.length} 行（已跳过，需人工核验）:`);
    anomalies.forEach((a) => console.log(`  行${a.row} [${a.carrier}] ${a.reason}`));
  } else {
    console.log('\n✅ 无异常行');
  }
  console.log(`\n已写入: ${path.relative(ROOT, OUT)}`);
}

main();
