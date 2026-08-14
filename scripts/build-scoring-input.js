// scripts/build-scoring-input.js — 选品 xlsx → ozon-react/public/data/scoring_candidates.json
// 一次性数据构建（数据变更后重跑）。浏览器端只消费该 JSON，不直接读 xlsx。
const fs = require('fs');
const path = require('path');
const { loadCanonicalCandidates } = require('./scoring-xlsx.js');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '选品', '跨境项目产品线扩展计划.xlsx');
const OUT = path.join(ROOT, 'ozon-react', 'public', 'data', 'scoring_candidates.json');

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[build-scoring-input] 缺少源文件: ${SRC}`);
    process.exit(1);
  }
  const candidates = loadCanonicalCandidates(SRC);
  if (candidates.length === 0) {
    console.error('[build-scoring-input] 解析结果为 0 行，拒绝写出');
    process.exit(1);
  }
  const doc = {
    source: path.basename(SRC),
    generatedAt: new Date().toISOString(),
    count: candidates.length,
    candidates,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc), 'utf-8');
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`[build-scoring-input] ${candidates.length} 行 canonical candidates → public/data/scoring_candidates.json (${kb} KB)`);
}

main();
