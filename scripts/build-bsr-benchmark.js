// T4-1A build-bsr-benchmark.js
// 职责（只做市场基准层，不写评分逻辑）：
//   1. 19 份 BSR 表 → canonical schema（字段别名 + 百分比单位归一）
//   2. 按产品链接去重（跨"汽车大类/子类"文件 515 重复）
//   3. domain → 产品类型 两级层次
//   4. 每个产品类型 P10/P25/P50/P75/P90 基准
//   5. 品牌/卖家集中度、促销/广告依赖、库存缺口、物流形态等结构指标
//   6. 输出 bsr_market_benchmarks.json（只存聚合，不落明细）
//
// 单位规则（T4-1A 审计结论）：
//   - 格式 A 文件（表头带"（%）"等后缀）：百分比字段为小数编码，×100 转百分数值（0.0032→0.32）
//   - 格式 B 文件（表头无后缀）：百分比字段已是百分数值（0.38→0.38%），不乘
//   - 判定依据：表头签名。以 "下单转化率(%)"（带括号）为格式 A 标志。
const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(process.cwd(), 'node_modules', 'xlsx'));

const ROOT = process.cwd();
const BSR_DIR = path.join(ROOT, '市场分析', '市场bsr');
const OUT_FILE = path.join(ROOT, 'ozon-react', 'public', 'data', 'bsr_market_benchmarks.json');

// ============ canonical 字段映射 ============
const ALIAS = {
  '销售额(₽)': 'sales_rub', '销售额₽': 'sales_rub',
  '销量(件)': 'units', '销量': 'units',
  '日均销量(件)': 'daily_units', '平均每日销量': 'daily_units',
  '日均销售额(₽)': 'daily_sales_rub', '平均每日销售额₽': 'daily_sales_rub',
  '平均售价(₽)': 'avg_price_rub', '平均销售价格₽': 'avg_price_rub',
  '最低价(₽)': 'min_price_rub', '最低价格₽': 'min_price_rub',
  '签收率(%)': 'sign_rate', '签收率': 'sign_rate',
  '错失销售额(₽)': 'missed_sales_rub', '错过的销售额₽': 'missed_sales_rub',
  '无库存天数(近28天)': 'oos_days', '无库存天数': 'oos_days',
  '下单转化率(%)': 'conv_rate', '下单转化率': 'conv_rate',
  '购物车转化率(%)': 'cart_conv', '购物车转化率': 'cart_conv',
  '购物车加购率(%)': 'cart_add', '购物车加购率': 'cart_add',
  '产品折扣(%)': 'discount', '产品折扣': 'discount',
  '促销份额(%)': 'promo_share', '促销份额': 'promo_share',
  '促销天数(近28天)': 'promo_days', '促销天数': 'promo_days',
  '推广天数(近28天)': 'ad_days', '推广天数': 'ad_days',
  '广告收入率ROI(%)': 'ad_roi', '广告收入率ROI': 'ad_roi',
  '营收增长(%)': 'revenue_growth', '增长趋势': 'revenue_growth',
  '产品类型': 'product_type', '产品类型(英文)': 'product_type_en',
  '产品链接': 'url', '品牌': 'brand', '品牌名': 'brand_name',
  '卖家': 'seller', '卖家名称': 'seller_name', 'SKU': 'sku',
  'BSR标签': 'bsr_label', '派送模式': 'ship_mode', '商品体积(升)': 'volume_l',
  '总曝光量': 'exposure', '广告搜索展示次数': 'ad_search_impressions',
  '商品卡片访问量': 'card_visits', '预估库存': 'est_stock', '上架时间': 'listed_at',
};

// 百分比字段：格式 A 需要 ×100
const PCT_FIELDS = ['sign_rate', 'conv_rate', 'cart_conv', 'cart_add', 'discount', 'promo_share', 'ad_roi', 'revenue_growth'];
const PCT_CAP = { sign_rate: 100, conv_rate: 100, cart_conv: 100, cart_add: 100, discount: 100, promo_share: 100, ad_roi: null, revenue_growth: null };

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function winsorize(arr) {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const lo = s[Math.floor(s.length * 0.01)];
  const hi = s[Math.floor(s.length * 0.99)];
  return s.map((v) => Math.min(Math.max(v, lo), hi));
}

function pct(arr, p) {
  if (!arr || arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor(s.length * p));
  return +s[idx].toFixed(2);
}

// HHI（0-10000）按销售额加权
function hhi(entries) {
  const total = entries.reduce((s, e) => s + e.sales, 0);
  if (total <= 0) return null;
  return +(entries.reduce((s, e) => s + (e.sales / total) ** 2, 0) * 10000).toFixed(0);
}

// ============ 1. 读取并 canonical 化 ============
const files = fs.readdirSync(BSR_DIR).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~'));
const canonical = [];
const formatStats = { A: 0, B: 0 };

for (const f of files) {
  const wb = xlsx.readFile(path.join(BSR_DIR, f));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const headers = rows[0].map((h) => String(h == null ? '' : h).trim());
  const col = {};
  headers.forEach((h, i) => { if (ALIAS[h]) col[ALIAS[h]] = i; });
  // 格式判定：带"(%)"后缀的表头 → 格式 A（小数编码×100）
  const fmtA = headers.includes('下单转化率(%)');
  formatStats[fmtA ? 'A' : 'B']++;

  // domain = 文件名主体（去掉日期与清洗版后缀）
  const domain = f.replace(/^ozon-\d{4}-\d{2}-\d{2}/, '').replace(/_清洗版\.xlsx$/, '').replace(/\.xlsx$/, '');

  for (const r of rows.slice(1)) {
    if (!r.some((c) => c !== null && c !== undefined && c !== '')) continue;
    const row = { domain, _fmtA: fmtA };
    for (const [key, idx] of Object.entries(col)) row[key] = r[idx];

    // 数值转换
    for (const k of ['sales_rub', 'units', 'daily_units', 'daily_sales_rub', 'avg_price_rub', 'min_price_rub', 'missed_sales_rub', 'oos_days', 'volume_l', 'exposure', 'ad_search_impressions', 'card_visits', 'est_stock', 'promo_days', 'ad_days']) {
      row[k] = toNum(row[k]);
    }
    // 百分比归一（winsorize 前先×100）
    for (const k of PCT_FIELDS) {
      let v = toNum(row[k]);
      if (v === null) { row[k] = null; continue; }
      if (fmtA) v = v * 100;
      const cap = PCT_CAP[k];
      if (cap !== null && cap !== undefined && v > cap * 5) v = null; // 明显越界（如 4745%）判脏
      row[k] = v;
    }
    row.product_type = String(row.product_type || '').trim() || null;
    row.product_type_en = String(row.product_type_en || '').trim() || null;
    row.url = String(row.url || '').trim() || null;
    row.brand = String(row.brand || '').trim() || null;
    row.seller = String(row.seller || '').trim() || null;
    row.bsr_label = String(row.bsr_label || '').trim() || null;
    row.ship_mode = String(row.ship_mode || '').trim() || null;
    canonical.push(row);
  }
}

// ============ 2. 按产品链接去重（子类文件优先于大类） ============
const byUrl = new Map();
for (const r of canonical) {
  if (!r.url) continue;
  const prev = byUrl.get(r.url);
  if (!prev) { byUrl.set(r.url, r); continue; }
  // 去重规则：保留后出现的（07-23 子类文件排序在 07-22 大类之后，粒度更细）
  byUrl.set(r.url, r);
}
const dedup = canonical.filter((r) => !r.url || byUrl.get(r.url) === r);
const dupDropped = canonical.length - dedup.length;

// ============ 3. 两级层次 + 聚合 ============
function aggregate(rows) {
  const win = {};
  for (const k of ['sales_rub', 'units', 'avg_price_rub', 'min_price_rub', 'sign_rate', 'conv_rate', 'cart_add', 'discount', 'promo_share', 'promo_days', 'ad_days', 'ad_roi', 'oos_days', 'missed_sales_rub', 'volume_l']) {
    const vals = rows.map((r) => r[k]).filter((v) => v !== null && v !== undefined);
    win[k] = winsorize(vals);
  }
  const brandAgg = {};
  const sellerAgg = {};
  let salesTotal = 0, fbo = 0, fbs = 0, shipN = 0, leader = 0, labelN = 0;
  for (const r of rows) {
    const s = r.sales_rub || 0;
    salesTotal += s;
    if (r.brand) { brandAgg[r.brand] = (brandAgg[r.brand] || 0) + s; }
    if (r.seller) { sellerAgg[r.seller] = (sellerAgg[r.seller] || 0) + s; }
    const sm = (r.ship_mode || '').toUpperCase();
    if (sm.includes('FBO')) fbo++;
    if (sm.includes('FBS')) fbs++;
    if (r.ship_mode) shipN++;
    if (r.bsr_label) { labelN++; if (r.bsr_label === '销售领导者') leader++; }
  }
  const brandEntries = Object.entries(brandAgg).map(([k, sales]) => ({ k, sales })).sort((a, b) => b.sales - a.sales);
  const sellerEntries = Object.entries(sellerAgg).map(([k, sales]) => ({ k, sales })).sort((a, b) => b.sales - a.sales);
  const topNShare = (entries, n) => {
    const top = entries.slice(0, n).reduce((s, e) => s + e.sales, 0);
    return salesTotal > 0 ? +(top / salesTotal * 100).toFixed(1) : null;
  };
  return {
    n: rows.length,
    sales_28d: { p10: pct(win.sales_rub, 0.10), p25: pct(win.sales_rub, 0.25), p50: pct(win.sales_rub, 0.5), p75: pct(win.sales_rub, 0.75), p90: pct(win.sales_rub, 0.90) },
    units_28d: { p10: pct(win.units, 0.10), p25: pct(win.units, 0.25), p50: pct(win.units, 0.5), p75: pct(win.units, 0.75), p90: pct(win.units, 0.90) },
    avg_price_rub: { p10: pct(win.avg_price_rub, 0.10), p25: pct(win.avg_price_rub, 0.25), p50: pct(win.avg_price_rub, 0.5), p75: pct(win.avg_price_rub, 0.75), p90: pct(win.avg_price_rub, 0.90) },
    min_price_rub: { p10: pct(win.min_price_rub, 0.10), p25: pct(win.min_price_rub, 0.25), p50: pct(win.min_price_rub, 0.5), p75: pct(win.min_price_rub, 0.75), p90: pct(win.min_price_rub, 0.90) },
    sign_rate: { p10: pct(win.sign_rate, 0.10), p25: pct(win.sign_rate, 0.25), p50: pct(win.sign_rate, 0.5), p75: pct(win.sign_rate, 0.75), p90: pct(win.sign_rate, 0.90) },
    conv_rate: { p10: pct(win.conv_rate, 0.10), p25: pct(win.conv_rate, 0.25), p50: pct(win.conv_rate, 0.5), p75: pct(win.conv_rate, 0.75), p90: pct(win.conv_rate, 0.90) },
    cart_add: { p10: pct(win.cart_add, 0.10), p25: pct(win.cart_add, 0.25), p50: pct(win.cart_add, 0.5), p75: pct(win.cart_add, 0.75), p90: pct(win.cart_add, 0.90) },
    discount: { p10: pct(win.discount, 0.10), p25: pct(win.discount, 0.25), p50: pct(win.discount, 0.5), p75: pct(win.discount, 0.75), p90: pct(win.discount, 0.90) },
    promo_share: { p10: pct(win.promo_share, 0.10), p25: pct(win.promo_share, 0.25), p50: pct(win.promo_share, 0.5), p75: pct(win.promo_share, 0.75), p90: pct(win.promo_share, 0.90) },
    promo_days: { p10: pct(win.promo_days, 0.10), p25: pct(win.promo_days, 0.25), p50: pct(win.promo_days, 0.5), p75: pct(win.promo_days, 0.75), p90: pct(win.promo_days, 0.90) },
    ad_days: { p10: pct(win.ad_days, 0.10), p25: pct(win.ad_days, 0.25), p50: pct(win.ad_days, 0.5), p75: pct(win.ad_days, 0.75), p90: pct(win.ad_days, 0.90) },
    ad_roi: { p10: pct(win.ad_roi, 0.10), p25: pct(win.ad_roi, 0.25), p50: pct(win.ad_roi, 0.5), p75: pct(win.ad_roi, 0.75), p90: pct(win.ad_roi, 0.90) },
    oos_days: { p10: pct(win.oos_days, 0.10), p25: pct(win.oos_days, 0.25), p50: pct(win.oos_days, 0.5), p75: pct(win.oos_days, 0.75), p90: pct(win.oos_days, 0.90) },
    missed_sales_rub: { p10: pct(win.missed_sales_rub, 0.10), p25: pct(win.missed_sales_rub, 0.25), p50: pct(win.missed_sales_rub, 0.5), p75: pct(win.missed_sales_rub, 0.75), p90: pct(win.missed_sales_rub, 0.90) },
    volume_l: { p10: pct(win.volume_l, 0.10), p25: pct(win.volume_l, 0.25), p50: pct(win.volume_l, 0.5), p75: pct(win.volume_l, 0.75), p90: pct(win.volume_l, 0.90) },
    brand_hhi: hhi(brandEntries),
    seller_hhi: hhi(sellerEntries),
    top1_brand_share: topNShare(brandEntries, 1),
    top5_brand_share: topNShare(brandEntries, 5),
    top10_seller_share: topNShare(sellerEntries, 10),
    fbo_share: shipN > 0 ? +(fbo / shipN * 100).toFixed(1) : null,
    fbs_share: shipN > 0 ? +(fbs / shipN * 100).toFixed(1) : null,
    bsr_leader_share: labelN > 0 ? +(leader / labelN * 100).toFixed(1) : null,
    supply_gap: {
      sales_p50: pct(win.sales_rub, 0.5),
      oos_days_p50: pct(win.oos_days, 0.5),
      missed_sales_p50: pct(win.missed_sales_rub, 0.5),
      seller_hhi: hhi(sellerEntries),
    },
  };
}

// domain 层
const domains = {};
for (const r of dedup) { (domains[r.domain] = domains[r.domain] || []).push(r); }
const domainBench = {};
for (const [d, rows] of Object.entries(domains)) domainBench[d] = aggregate(rows);

// 产品类型层
const types = {};
for (const r of dedup) {
  const t = r.product_type || '(未分类)';
  (types[t] = types[t] || []).push(r);
}
const typeBench = {};
for (const [t, rows] of Object.entries(types)) {
  typeBench[t] = { domain: rows[0].domain, ...aggregate(rows) };
}

// 样本量分级
const tiers = { n_ge_10: 0, n_5_9: 0, n_lt_5: 0 };
for (const b of Object.values(typeBench)) {
  if (b.n >= 10) tiers.n_ge_10++;
  else if (b.n >= 5) tiers.n_5_9++;
  else tiers.n_lt_5++;
}

const out = {
  meta: {
    version: '1.0',
    generated_at: new Date().toISOString(),
    source: '市场分析/市场bsr/*.xlsx (19 files, 2026-07-22 ~ 2026-07-23)',
    unit_notes: [
      '百分比字段已统一为百分数值(0.32 表示 0.32%)；格式A文件(表头带(%)后缀)原始为小数编码, 已×100',
      '销量=近28天累计(销量/日均销量中位=28.54)；日均销量仅展示用',
      '所有百分位均为 1%-99% winsorize 后的分位数',
    ],
    total_rows_raw: canonical.length,
    unique_products: dedup.length,
    duplicate_dropped: dupDropped,
    domain_count: Object.keys(domainBench).length,
    product_type_count: Object.keys(typeBench).length,
    sample_size_tiers: tiers,
    field_aliases: ALIAS,
  },
  domains: domainBench,
  product_types: typeBench,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf-8');
const sizeKB = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
console.log(`[bsr-benchmark] 输出: ${OUT_FILE} (${sizeKB} KB)`);
console.log(`[bsr-benchmark] raw=${canonical.length} dedup=${dedup.length} dropped=${dupDropped}`);
console.log(`[bsr-benchmark] domains=${Object.keys(domainBench).length} types=${Object.keys(typeBench).length}`);
console.log(`[bsr-benchmark] 样本分级: >=10: ${tiers.n_ge_10}, 5-9: ${tiers.n_5_9}, <5: ${tiers.n_lt_5}`);
console.log(`[bsr-benchmark] 格式A文件: ${formatStats.A}, 格式B文件: ${formatStats.B}`);
