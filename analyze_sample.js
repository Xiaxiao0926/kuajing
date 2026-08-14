const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve('E:\\Desktop\\坪优报价分析\\分析结果\\价格优势分析结果_v2.xlsx');
const workbook = XLSX.readFile(filePath);
const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

// 小样产品 = 价格口径为"小样报价"的产品
const sampleProducts = data.filter(row => String(row['价格口径'] || '').includes('小样'));
const volumePattern = /(\d+(?:\.\d+)?)\s*(ml|毫升|ML|Ml|g|克|G)/i;

console.log('========================================');
console.log('  小样产品匹配结果深度分析报告');
console.log('========================================');
console.log(`总记录数: ${data.length}`);
console.log(`小样产品数: ${sampleProducts.length} (${(sampleProducts.length/data.length*100).toFixed(1)}%)`);

// ===== 1. 匹配状态分布 =====
console.log('\n===== 1. 小样产品匹配状态分布 =====');
const statusDist = {};
sampleProducts.forEach(row => {
  const status = String(row['状态'] || '未知');
  statusDist[status] = (statusDist[status] || 0) + 1;
});
Object.entries(statusDist).forEach(([status, count]) => {
  console.log(`  ${status}: ${count} (${(count/sampleProducts.length*100).toFixed(1)}%)`);
});

// ===== 2. 未匹配小样产品分析 =====
const unmatched = sampleProducts.filter(row => String(row['状态']) === '未匹配');
console.log('\n===== 2. 未匹配小样产品 =====');
console.log(`数量: ${unmatched.length}`);
unmatched.forEach((row, i) => {
  const name = row['查询名称'];
  const volMatch = name.match(volumePattern);
  console.log(`  ${i+1}. ${name} | 容量:${volMatch ? volMatch[0] : '无'} | 供应商价格:${row['供应商价格']} | 市场报价数:${row['市场抓取报价数量']}`);
});

// ===== 3. 已匹配小样产品匹配质量分析 =====
const matched = sampleProducts.filter(row => String(row['状态']) === '已匹配');
console.log('\n===== 3. 已匹配小样产品匹配质量分析 =====');
console.log(`数量: ${matched.length}`);

// 3a. 匹配度分布
const matchScores = matched.map(row => parseFloat(String(row['候选1匹配度'] || '0').replace('%', ''))).filter(v => v > 0);
if (matchScores.length > 0) {
  matchScores.sort((a, b) => a - b);
  console.log('\n  候选1匹配度统计:');
  console.log(`    最小: ${Math.min(...matchScores).toFixed(0)}%`);
  console.log(`    最大: ${Math.max(...matchScores).toFixed(0)}%`);
  console.log(`    平均: ${(matchScores.reduce((a,b)=>a+b,0)/matchScores.length).toFixed(1)}%`);
  console.log(`    中位数: ${matchScores[Math.floor(matchScores.length/2)].toFixed(0)}%`);
  
  const lowMatch = matchScores.filter(s => s < 60).length;
  const midMatch = matchScores.filter(s => s >= 60 && s < 80).length;
  const highMatch = matchScores.filter(s => s >= 80).length;
  console.log(`    <60%: ${lowMatch} | 60-80%: ${midMatch} | >=80%: ${highMatch}`);
}

// 3b. 最低价标题是否包含小样标识
console.log('\n  最低价标题小样标识检查:');
let lowestHasSample = 0, lowestNoSample = 0;
const noSampleLowest = [];
matched.forEach(row => {
  const title = String(row['最低价标题'] || '');
  if (/小样|试用|体验|旅行|迷你|mini|sample|trial|中小样/i.test(title)) {
    lowestHasSample++;
  } else {
    lowestNoSample++;
    noSampleLowest.push(row);
  }
});
console.log(`    最低价标题含小样标识: ${lowestHasSample}`);
console.log(`    最低价标题不含小样标识: ${lowestNoSample}`);

// 3c. 容量匹配检查
console.log('\n  容量匹配检查（查询 vs 最低价标题）:');
let volMatchCount = 0, volMismatchCount = 0, volNotFoundCount = 0;
const volMismatches = [];
matched.forEach(row => {
  const queryName = String(row['查询名称'] || '');
  const queryVol = queryName.match(volumePattern);
  const lowestTitle = String(row['最低价标题'] || '');
  const lowestVol = lowestTitle.match(volumePattern);
  
  if (!queryVol) return;
  
  if (!lowestVol) {
    volNotFoundCount++;
  } else {
    const qVol = parseFloat(queryVol[1]);
    const lVol = parseFloat(lowestVol[1]);
    if (Math.abs(qVol - lVol) < 0.5) {
      volMatchCount++;
    } else {
      volMismatchCount++;
      volMismatches.push({
        queryName,
        queryVol: queryVol[0],
        lowestTitle,
        lowestVol: lowestVol[0],
        supplierPrice: row['供应商价格'],
        lowestPrice: row['最低价'],
        priceAdvantage: row['价格优势'],
        matchScore: row['候选1匹配度']
      });
    }
  }
});
console.log(`    容量匹配: ${volMatchCount}`);
console.log(`    容量不匹配: ${volMismatchCount}`);
console.log(`    最低价标题无容量信息: ${volNotFoundCount}`);

if (volMismatches.length > 0) {
  console.log('\n  容量不匹配详情:');
  volMismatches.forEach((m, i) => {
    console.log(`    ${i+1}. 查询: ${m.queryName} [${m.queryVol}] -> 最低价: ${m.lowestTitle} [${m.lowestVol}]`);
    console.log(`       供应商价:${m.supplierPrice} | 最低价:${m.lowestPrice} | 优势:${m.priceAdvantage} | 匹配度:${m.matchScore}`);
  });
}

// ===== 4. 小样匹配到正装的严重问题 =====
console.log('\n===== 4. 小样匹配到正装的严重问题 =====');
const sampleToRegularIssues = [];
matched.forEach(row => {
  const queryName = String(row['查询名称'] || '');
  const queryVol = queryName.match(volumePattern);
  const lowestTitle = String(row['最低价标题'] || '');
  const lowestVol = lowestTitle.match(volumePattern);
  
  if (!queryVol || !lowestVol) return;
  
  const qVol = parseFloat(queryVol[1]);
  const lVol = parseFloat(lowestVol[1]);
  
  // 判断是否小样匹配到了正装：最低价容量是查询容量的3倍以上
  // 或者最低价标题不含小样标识且容量差异大
  const lowestIsSample = /小样|试用|体验|旅行|迷你|mini|sample|trial|中小样/i.test(lowestTitle);
  
  if (!lowestIsSample && lVol >= qVol * 3) {
    sampleToRegularIssues.push({
      queryName,
      queryVol: queryVol[0],
      lowestTitle,
      lowestVol: lowestVol[0],
      ratio: (lVol / qVol).toFixed(1),
      supplierPrice: row['供应商价格'],
      lowestPrice: row['最低价'],
      priceAdvantage: row['价格优势'],
      matchScore: row['候选1匹配度']
    });
  }
});

console.log(`小样匹配到正装（容量>=3倍且无小样标识）: ${sampleToRegularIssues.length}条`);
sampleToRegularIssues.forEach((m, i) => {
  console.log(`  ${i+1}. [容量比${m.ratio}倍] 查询: ${m.queryName} [${m.queryVol}] -> 最低价: ${m.lowestTitle} [${m.lowestVol}]`);
  console.log(`     供应商价:${m.supplierPrice} | 最低价:${m.lowestPrice} | 优势:${m.priceAdvantage} | 匹配度:${m.matchScore}`);
});

// ===== 5. 价格优势合理性分析 =====
console.log('\n===== 5. 价格优势合理性分析 =====');

// 解析价格优势
function parsePriceAdvantage(str) {
  if (!str) return null;
  str = String(str);
  // 尝试提取数字
  const numMatch = str.match(/([\d.]+)/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1]);
  if (str.includes('高于')) return num; // 供应商价格更高 = 不利
  if (str.includes('低于')) return -num; // 供应商价格更低 = 有利
  return num;
}

const priceAdvData = matched.map(row => ({
  name: row['查询名称'],
  supplierPrice: parseFloat(row['供应商价格']) || 0,
  lowestPrice: parseFloat(row['最低价']) || 0,
  advantage: parsePriceAdvantage(row['价格优势']),
  advantageStr: row['价格优势'],
  matchScore: row['候选1匹配度'],
  lowestTitle: row['最低价标题']
})).filter(d => d.advantage !== null && d.supplierPrice > 0 && d.lowestPrice > 0);

// 计算价格优势百分比
priceAdvData.forEach(d => {
  d.advPct = (d.advantage / d.lowestPrice * 100);
});

// 供应商价格远高于市场价（>50%）
const overpriced = priceAdvData.filter(d => d.advPct > 50).sort((a,b) => b.advPct - a.advPct);
console.log(`\n供应商价格远高于市场最低价(>50%)的小样产品: ${overpriced.length}条`);
overpriced.forEach((d, i) => {
  console.log(`  ${i+1}. ${d.name} | 供应商价:${d.supplierPrice} | 最低价:${d.lowestPrice} | 高出${d.advPct.toFixed(0)}% | ${d.advantageStr}`);
  console.log(`     最低价标题: ${d.lowestTitle}`);
});

// 供应商价格远低于市场价（<-50%）- 可能是匹配到了正装
const underpriced = priceAdvData.filter(d => d.advPct < -50).sort((a,b) => a.advPct - b.advPct);
console.log(`\n供应商价格远低于市场最低价(<-50%)的小样产品: ${underpriced.length}条`);
underpriced.forEach((d, i) => {
  console.log(`  ${i+1}. ${d.name} | 供应商价:${d.supplierPrice} | 最低价:${d.lowestPrice} | 低${Math.abs(d.advPct).toFixed(0)}% | ${d.advantageStr}`);
  console.log(`     最低价标题: ${d.lowestTitle}`);
});

// ===== 6. 供应商名称格式分析 =====
console.log('\n===== 6. 供应商名称（查询名称）格式分析 =====');

let hasVolume = 0, noVolume = 0;
let hasSampleKeyword = 0, noSampleKeyword = 0;
let hasBrand = 0;
const noVolumeList = [];
const noSampleKeywordList = [];

sampleProducts.forEach(row => {
  const name = String(row['查询名称'] || '');
  const volMatch = name.match(volumePattern);
  const sampleMatch = /小样|试用|体验|旅行|迷你|mini|sample|trial|中样/i.test(name);
  const brandMatch = /[A-Za-z]{2,}/.test(name);
  
  if (volMatch) hasVolume++; else { noVolume++; noVolumeList.push(name); }
  if (sampleMatch) hasSampleKeyword++; else { noSampleKeyword++; noSampleKeywordList.push(name); }
  if (brandMatch) hasBrand++;
});

console.log(`  含容量信息: ${hasVolume} (${(hasVolume/sampleProducts.length*100).toFixed(1)}%)`);
console.log(`  不含容量信息: ${noVolume} (${(noVolume/sampleProducts.length*100).toFixed(1)}%)`);
console.log(`  含小样标识: ${hasSampleKeyword} (${(hasSampleKeyword/sampleProducts.length*100).toFixed(1)}%)`);
console.log(`  不含小样标识: ${noSampleKeyword} (${(noSampleKeyword/sampleProducts.length*100).toFixed(1)}%)`);
console.log(`  含品牌英文: ${hasBrand} (${(hasBrand/sampleProducts.length*100).toFixed(1)}%)`);

if (noVolumeList.length > 0) {
  console.log('\n  不含容量信息的查询名称:');
  noVolumeList.forEach((name, i) => console.log(`    ${i+1}. ${name}`));
}

if (noSampleKeywordList.length > 0) {
  console.log('\n  不含小样标识的查询名称（前20条）:');
  noSampleKeywordList.slice(0, 20).forEach((name, i) => console.log(`    ${i+1}. ${name}`));
}

// ===== 7. 需要人工复核的小样产品 =====
const reviewNeeded = sampleProducts.filter(row => String(row['状态']) === '需要人工复核');
console.log('\n===== 7. 需要人工复核的小样产品 =====');
console.log(`数量: ${reviewNeeded.length}`);
reviewNeeded.forEach((row, i) => {
  const name = row['查询名称'];
  const volMatch = name.match(volumePattern);
  console.log(`  ${i+1}. ${name} | 容量:${volMatch ? volMatch[0] : '无'} | 供应商价:${row['供应商价格']} | 最低价:${row['最低价']} | 复核原因:${row['复核原因']}`);
  console.log(`     最低价标题: ${row['最低价标题']}`);
});

// ===== 8. 关键问题汇总 =====
console.log('\n===== 8. 关键问题汇总 =====');

// 问题1: 小样匹配到正装价格
console.log('\n  问题1: 小样产品匹配到正装价格（价格不可比）');
const suspectPrice = matched.filter(row => {
  const supplierPrice = parseFloat(row['供应商价格']) || 0;
  const lowestPrice = parseFloat(row['最低价']) || 0;
  const lowestTitle = String(row['最低价标题'] || '');
  const lowestIsSample = /小样|试用|体验|旅行|迷你|mini|sample|trial|中小样/i.test(lowestTitle);
  // 供应商价格远低于最低价，且最低价不是小样
  return supplierPrice > 0 && lowestPrice > 0 && supplierPrice < lowestPrice * 0.3 && !lowestIsSample;
});
console.log(`    数量: ${suspectPrice.length}`);
suspectPrice.forEach((row, i) => {
  console.log(`    ${i+1}. ${row['查询名称']} | 供应商价:${row['供应商价格']} | 最低价:${row['最低价']} | 最低价标题:${row['最低价标题']}`);
});

// 问题2: 最低价标题含小样但容量不同
console.log('\n  问题2: 最低价标题含小样但容量与查询不同');
const diffVolSample = matched.filter(row => {
  const queryName = String(row['查询名称'] || '');
  const queryVol = queryName.match(volumePattern);
  const lowestTitle = String(row['最低价标题'] || '');
  const lowestVol = lowestTitle.match(volumePattern);
  const lowestIsSample = /小样|试用|体验|旅行|迷你|mini|sample|trial|中小样/i.test(lowestTitle);
  
  if (!queryVol || !lowestVol || !lowestIsSample) return false;
  return Math.abs(parseFloat(queryVol[1]) - parseFloat(lowestVol[1])) > 0.5;
});
console.log(`    数量: ${diffVolSample.length}`);
diffVolSample.forEach((row, i) => {
  const queryVol = row['查询名称'].match(volumePattern);
  const lowestVol = String(row['最低价标题'] || '').match(volumePattern);
  console.log(`    ${i+1}. ${row['查询名称']} [${queryVol[0]}] -> ${row['最低价标题']} [${lowestVol[0]}]`);
});

// 问题3: 候选1匹配度低但标记为已匹配
console.log('\n  问题3: 候选1匹配度低(<60%)但标记为已匹配');
const lowMatchButMatched = matched.filter(row => {
  const score = parseFloat(String(row['候选1匹配度'] || '0').replace('%', ''));
  return score > 0 && score < 60;
});
console.log(`    数量: ${lowMatchButMatched.length}`);
lowMatchButMatched.forEach((row, i) => {
  console.log(`    ${i+1}. 匹配度:${row['候选1匹配度']} | ${row['查询名称']} -> ${row['候选1标题']}`);
});

// 问题4: 价格优势描述为"同规格"但实际容量不同
console.log('\n  问题4: 价格优势标注"同规格"但容量实际不同');
const fakeSameSpec = matched.filter(row => {
  const adv = String(row['价格优势'] || '');
  if (!adv.includes('同规格')) return false;
  const queryName = String(row['查询名称'] || '');
  const queryVol = queryName.match(volumePattern);
  const lowestTitle = String(row['最低价标题'] || '');
  const lowestVol = lowestTitle.match(volumePattern);
  if (!queryVol || !lowestVol) return false;
  return Math.abs(parseFloat(queryVol[1]) - parseFloat(lowestVol[1])) > 0.5;
});
console.log(`    数量: ${fakeSameSpec.length}`);
fakeSameSpec.forEach((row, i) => {
  const queryVol = row['查询名称'].match(volumePattern);
  const lowestVol = String(row['最低价标题'] || '').match(volumePattern);
  console.log(`    ${i+1}. ${row['查询名称']} [${queryVol[0]}] -> ${row['最低价标题']} [${lowestVol[0]}] | 优势:${row['价格优势']}`);
});

// ===== 9. 小样产品完整清单（按价格优势排序） =====
console.log('\n===== 9. 小样产品完整清单（按供应商价格/最低价比率排序） =====');
const allWithRatio = sampleProducts.filter(row => {
  const sp = parseFloat(row['供应商价格']) || 0;
  const lp = parseFloat(row['最低价']) || 0;
  return sp > 0 && lp > 0;
}).map(row => {
  const sp = parseFloat(row['供应商价格']);
  const lp = parseFloat(row['最低价']);
  return { ...row, ratio: sp / lp };
}).sort((a, b) => b.ratio - a.ratio);

console.log(`有价格对比的小样产品: ${allWithRatio.length}条`);
console.log('\n  供应商价格/最低价 比率最高的（供应商价远高于市场价）:');
allWithRatio.slice(0, 15).forEach((row, i) => {
  console.log(`    ${i+1}. 比率:${row.ratio.toFixed(2)} | ${row['查询名称']} | 供应商价:${row['供应商价格']} | 最低价:${row['最低价']} | ${row['价格优势']}`);
  console.log(`       最低价标题: ${row['最低价标题']}`);
});

console.log('\n  供应商价格/最低价 比率最低的（可能匹配到了正装）:');
allWithRatio.slice(-15).forEach((row, i) => {
  console.log(`    ${i+1}. 比率:${row.ratio.toFixed(2)} | ${row['查询名称']} | 供应商价:${row['供应商价格']} | 最低价:${row['最低价']} | ${row['价格优势']}`);
  console.log(`       最低价标题: ${row['最低价标题']}`);
});

console.log('\n========================================');
console.log('  分析完成');
console.log('========================================');
