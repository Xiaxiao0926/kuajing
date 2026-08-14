// T4-1A 深审计：转化率编码验证 + 跨文件重复 + 产品类型样本分布（只读）
const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(process.cwd(), 'node_modules', 'xlsx'));

const DIR = path.join(process.cwd(), '市场分析', '市场bsr');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~'));

// 字段别名：把 6 套格式映射到 probe key
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

function parsePct(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

const all = []; // canonical rows
for (const f of files) {
  const wb = xlsx.readFile(path.join(DIR, f));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const headers = rows[0].map((h) => String(h == null ? '' : h).trim());
  const col = {};
  headers.forEach((h, i) => { if (ALIAS[h]) col[ALIAS[h]] = i; });
  for (const r of rows.slice(1)) {
    if (!r.some((c) => c !== null && c !== undefined && c !== '')) continue;
    const row = { _file: f };
    for (const [key, idx] of Object.entries(col)) row[key] = r[idx];
    all.push(row);
  }
}
console.log('总行数(合并):', all.length);

// === 1. 转化率编码验证 ===
// 法一：conv_rate 与 units/exposure 交叉验证。conv_rate 应 ≈ units_28d / (exposure×ctr) 量级不可直接算;
// 用"销量(件)/日均销量(件)"先验证 28 天口径，再检查 conv_rate 分布形状
const withAll = all.filter((r) => parsePct(r.units) !== null && parsePct(r.daily_units) !== null && parsePct(r.daily_units) > 0);
const ratio = withAll.map((r) => parsePct(r.units) / parsePct(r.daily_units)).sort((a, b) => a - b);
console.log('\n销量/日均销量 中位:', ratio[Math.floor(ratio.length * 0.5)].toFixed(2), '样本:', ratio.length);

const conv = all.map((r) => parsePct(r.conv_rate)).filter((v) => v !== null).sort((a, b) => a - b);
console.log('下单转化率: min', conv[0], 'p25', conv[Math.floor(conv.length * 0.25)], 'p50', conv[Math.floor(conv.length * 0.5)], 'p75', conv[Math.floor(conv.length * 0.75)], 'max', conv[conv.length - 1], '样本', conv.length);
// 分布形态: 有多少比例 <1（小数编码），多少 >=1（整数/百分数编码）
const lt1 = conv.filter((v) => v < 1).length;
console.log('conv <1 占比:', (lt1 / conv.length * 100).toFixed(1) + '%');
// 按文件拆
const byFileConv = {};
for (const r of all) {
  const v = parsePct(r.conv_rate);
  if (v === null) continue;
  if (!byFileConv[r._file]) byFileConv[r._file] = [];
  byFileConv[r._file].push(v);
}
console.log('各文件 conv_rate p50:');
for (const [f, arr] of Object.entries(byFileConv)) {
  arr.sort((a, b) => a - b);
  const m = arr[Math.floor(arr.length * 0.5)];
  const lt = arr.filter((v) => v < 1).length;
  console.log(`  ${f.replace('ozon-2026-', '').replace('_清洗版.xlsx', '')}: p50=${m} (<1占 ${(lt / arr.length * 100).toFixed(0)}%)`);
}

// === 2. 跨文件重复（产品链接） ===
const urlCount = {};
for (const r of all) { if (r.url) urlCount[r.url] = (urlCount[r.url] || 0) + 1; }
const dupUrls = Object.entries(urlCount).filter(([, c]) => c > 1);
console.log('\n产品链接: 总', Object.keys(urlCount).length, '唯一; 跨文件重复链接数:', dupUrls.length);
// 重复样本
for (const [u, c] of dupUrls.slice(0, 5)) {
  const files = all.filter((r) => r.url === u).map((r) => r._file.replace('_清洗版.xlsx', '').replace('ozon-2026-', ''));
  console.log('  重复', c, '次:', files.join(' + '));
}

// === 3. 产品类型分布 ===
const typeCount = {};
for (const r of all) { const t = String(r.product_type || r.product_type_en || '').trim() || '(空)'; typeCount[t] = (typeCount[t] || 0) + 1; }
const counts = Object.values(typeCount).sort((a, b) => a - b);
console.log('\n产品类型: 总数', Object.keys(typeCount).length);
console.log('  样本>=10:', counts.filter((c) => c >= 10).length, '| >=5:', counts.filter((c) => c >= 5).length, '| <5:', counts.filter((c) => c < 5).length, '| 中位:', counts[Math.floor(counts.length * 0.5)]);

// === 4. BSR 标签分布 ===
const labelCount = {};
for (const r of all) { const l = String(r.bsr_label || '(空)').trim(); labelCount[l] = (labelCount[l] || 0) + 1; }
console.log('\nBSR标签分布:');
for (const [l, c] of Object.entries(labelCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${l}: ${c} (${(c / all.length * 100).toFixed(1)}%)`);
}
