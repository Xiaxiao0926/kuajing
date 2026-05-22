const XLSX = require('xlsx');
const fs = require('fs');

const f = 'D:/ozon/市场分析/手套热销产品2026-05-12.xlsx';
const wb = XLSX.readFile(f);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

// 筛选丁腈手套
const nitrile = data.filter(row => {
  const name = String(row['商品名称'] || '').toLowerCase();
  return name.includes('нитрил') || name.includes('nitrile');
});

// 分析颜色分布
const colors = {};
const sizes = {};
const uses = {};
const brands = {};
const priceRanges = { '0-100': 0, '100-200': 0, '200-300': 0, '300-500': 0, '500+': 0 };
const packSizes = {};

nitrile.forEach(row => {
  const name = String(row['商品名称'] || '').toLowerCase();
  const price = parseFloat(row['平均单价']) || 0;
  const brand = row['品牌'] || '未知';
  
  // 颜色分析
  if (name.includes('черн') || name.includes('black')) colors['黑色'] = (colors['黑色'] || 0) + 1;
  else if (name.includes('голуб') || name.includes('син') || name.includes('blue')) colors['蓝色'] = (colors['蓝色'] || 0) + 1;
  else if (name.includes('бел') || name.includes('white')) colors['白色'] = (colors['白色'] || 0) + 1;
  else if (name.includes('сер') || name.includes('gray')) colors['灰色'] = (colors['灰色'] || 0) + 1;
  else if (name.includes('бежев') || name.includes('beige')) colors['米色'] = (colors['米色'] || 0) + 1;
  else if (name.includes('зелен') || name.includes('green')) colors['绿色'] = (colors['绿色'] || 0) + 1;
  else if (name.includes('фиолет') || name.includes('purple')) colors['紫色'] = (colors['紫色'] || 0) + 1;
  else if (name.includes('розов') || name.includes('pink')) colors['粉色'] = (colors['粉色'] || 0) + 1;
  else colors['其他/未标注'] = (colors['其他/未标注'] || 0) + 1;
  
  // 尺码分析
  if (name.includes(' xs') || name.includes('размер xs')) sizes['XS'] = (sizes['XS'] || 0) + 1;
  else if (name.includes(' s') || name.includes('размер s') || name.includes('размером s')) sizes['S'] = (sizes['S'] || 0) + 1;
  else if (name.includes(' m') || name.includes('размер m') || name.includes('размером m')) sizes['M'] = (sizes['M'] || 0) + 1;
  else if (name.includes(' l') || name.includes('размер l') || name.includes('размером l')) sizes['L'] = (sizes['L'] || 0) + 1;
  else if (name.includes(' xl') || name.includes('размер xl')) sizes['XL'] = (sizes['XL'] || 0) + 1;
  else if (name.includes('xxl') || name.includes('xxl')) sizes['XXL'] = (sizes['XXL'] || 0) + 1;
  else if (name.includes('универсальн')) sizes['均码'] = (sizes['均码'] || 0) + 1;
  else sizes['未标注'] = (sizes['未标注'] || 0) + 1;
  
  // 用途分析
  if (name.includes('медицинск') || name.includes('медицин')) uses['医疗'] = (uses['医疗'] || 0) + 1;
  if (name.includes('хозяйственн') || name.includes('хозяйств')) uses['家务'] = (uses['家务'] || 0) + 1;
  if (name.includes('смотров')) uses['检查'] = (uses['检查'] || 0) + 1;
  if (name.includes('хирургическ')) uses['外科'] = (uses['外科'] || 0) + 1;
  if (name.includes('парикмахерск') || name.includes('парикмах')) uses['美发'] = (uses['美发'] || 0) + 1;
  if (name.includes('косметическ') || name.includes('космет')) uses['美容'] = (uses['美容'] || 0) + 1;
  if (name.includes('садов') || name.includes('сад')) uses['园艺'] = (uses['园艺'] || 0) + 1;
  if (name.includes('уборк')) uses['清洁'] = (uses['清洁'] || 0) + 1;
  if (name.includes('одноразов')) uses['一次性'] = (uses['一次性'] || 0) + 1;
  if (name.includes('многоразов')) uses['可重复使用'] = (uses['可重复使用'] || 0) + 1;
  
  // 品牌
  brands[brand] = (brands[brand] || 0) + 1;
  
  // 价格区间
  if (price > 0 && price <= 100) priceRanges['0-100']++;
  else if (price > 100 && price <= 200) priceRanges['100-200']++;
  else if (price > 200 && price <= 300) priceRanges['200-300']++;
  else if (price > 300 && price <= 500) priceRanges['300-500']++;
  else if (price > 500) priceRanges['500+']++;
  
  // 包装数量
  const packMatch = name.match(/(\d+)\s*(шт|пар)/);
  if (packMatch) {
    const qty = parseInt(packMatch[1]);
    if (qty <= 10) packSizes['1-10只'] = (packSizes['1-10只'] || 0) + 1;
    else if (qty <= 50) packSizes['11-50只'] = (packSizes['11-50只'] || 0) + 1;
    else if (qty <= 100) packSizes['51-100只'] = (packSizes['51-100只'] || 0) + 1;
    else if (qty <= 200) packSizes['101-200只'] = (packSizes['101-200只'] || 0) + 1;
    else packSizes['200只+'] = (packSizes['200只+'] || 0) + 1;
  }
});

// 计算总销量和销售额
const totalSales = nitrile.reduce((sum, row) => sum + (parseInt(row['销量']) || 0), 0);
const totalRevenue = nitrile.reduce((sum, row) => sum + (parseFloat(row['销售额']) || 0), 0);
const avgPrice = nitrile.filter(r => r['平均单价']).reduce((sum, r, _, arr) => sum + parseFloat(r['平均单价']) / arr.length, 0);

console.log('=== 丁腈手套市场分析 ===\n');
console.log('商品数量:', nitrile.length);
console.log('总销量:', totalSales.toLocaleString());
console.log('总销售额:', Math.round(totalRevenue).toLocaleString(), '₽');
console.log('平均单价:', avgPrice.toFixed(1), '₽');

console.log('\n--- 颜色分布 ---');
Object.entries(colors).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`${k}: ${v} (${(v/nitrile.length*100).toFixed(1)}%)`));

console.log('\n--- 尺码分布 ---');
Object.entries(sizes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`${k}: ${v} (${(v/nitrile.length*100).toFixed(1)}%)`));

console.log('\n--- 用途分布 ---');
Object.entries(uses).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`${k}: ${v}`));

console.log('\n--- TOP 10 品牌 ---');
Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`${k}: ${v}款商品`));

console.log('\n--- 价格区间 ---');
Object.entries(priceRanges).forEach(([k, v]) => console.log(`${k}₽: ${v}款`));

console.log('\n--- 包装数量 ---');
Object.entries(packSizes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`${k}: ${v}款`));

// 保存分析结果
const analysis = {
  total: nitrile.length,
  totalSales,
  totalRevenue: Math.round(totalRevenue),
  avgPrice: Math.round(avgPrice * 100) / 100,
  colors,
  sizes,
  uses,
  brands,
  priceRanges,
  packSizes,
  topProducts: nitrile.slice(0, 20).map(r => ({
    name: r['商品名称'],
    brand: r['品牌'],
    sales: r['销量'],
    revenue: r['销售额'],
    price: r['平均单价']
  }))
};

fs.writeFileSync('d:/ozon/ozon-react/nitrile_analysis.json', JSON.stringify(analysis, null, 2), 'utf-8');
console.log('\n分析结果已保存到 nitrile_analysis.json');
