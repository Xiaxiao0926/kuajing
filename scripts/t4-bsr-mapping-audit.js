// T4-1A 候选类目 → BSR 产品类型 映射覆盖率（只读审计）
const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(process.cwd(), 'node_modules', 'xlsx'));

// 1) 候选叶子类目（中文）及频次
const wb = xlsx.readFile(path.join(process.cwd(), '选品', '跨境项目产品线扩展计划.xlsx'));
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
const data = rows.slice(1).filter((r) => r.some((c) => c !== null && c !== undefined && c !== ''));
const catFreq = {};
for (const r of data) {
  const full = String(r[4] || '').trim();
  const leaf = full.split('>').pop().trim();
  if (!leaf) continue;
  catFreq[leaf] = (catFreq[leaf] || 0) + 1;
}
const candidateLeaves = Object.entries(catFreq).sort((a, b) => b[1] - a[1]);
const candidateTotal = candidateLeaves.reduce((s, [, c]) => s + c, 0);

// 2) BSR 产品类型集合
const bench = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'ozon-react', 'public', 'data', 'bsr_market_benchmarks.json'), 'utf-8'));
const bsrTypes = Object.keys(bench.product_types).filter((t) => t !== '(未分类)');

// 3) 匹配三档
const exact = [], partial = [], unmatched = [];
for (const [leaf, freq] of candidateLeaves) {
  if (bsrTypes.includes(leaf)) { exact.push([leaf, freq]); continue; }
  // 包含匹配（双向，避免误配太泛：要求较短一方 ≥2 字）
  const hit = bsrTypes.find((t) => (t.includes(leaf) || leaf.includes(t)) && Math.min(t.length, leaf.length) >= 2);
  if (hit) { partial.push([leaf, freq, hit]); continue; }
  unmatched.push([leaf, freq]);
}

const exactRows = exact.reduce((s, [, c]) => s + c, 0);
const partialRows = partial.reduce((s, [, c]) => s + c, 0);
const unmatchedRows = unmatched.reduce((s, [, c]) => s + c, 0);

console.log(`候选叶子类目: ${candidateLeaves.length} 个 (共 ${candidateTotal} 行)`);
console.log(`BSR 产品类型: ${bsrTypes.length} 个`);
console.log(`\n精确匹配: ${exact.length} 类目 / ${exactRows} 行 (${(exactRows / candidateTotal * 100).toFixed(1)}%)`);
console.log(`包含匹配: ${partial.length} 类目 / ${partialRows} 行 (${(partialRows / candidateTotal * 100).toFixed(1)}%)`);
console.log(`未匹配:   ${unmatched.length} 类目 / ${unmatchedRows} 行 (${(unmatchedRows / candidateTotal * 100).toFixed(1)}%)`);

console.log('\n=== 精确匹配样本 ===');
exact.slice(0, 20).forEach(([l, c]) => console.log(`  ${l} (${c})`));
console.log('\n=== 包含匹配样本 ===');
partial.slice(0, 20).forEach(([l, c, hit]) => console.log(`  ${l} (${c}) → ${hit}`));
console.log('\n=== 未匹配清单(全部) ===');
unmatched.forEach(([l, c]) => console.log(`  ${l} (${c})`));

fs.writeFileSync(path.join(process.cwd(), '_audit', 'tmp', 't4-mapping-raw.json'), JSON.stringify({ exact, partial, unmatched }, null, 2), 'utf-8');
