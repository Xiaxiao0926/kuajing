// T4-1A BSR 字段结构探针（只读）：输出每份表的表头与字段格式差异
const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(process.cwd(), 'node_modules', 'xlsx'));

const DIR = path.join(process.cwd(), '市场分析', '市场bsr');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~'));

const headerSets = new Map(); // 表头签名 → 文件列表
const allHeaders = new Set();

for (const f of files) {
  const wb = xlsx.readFile(path.join(DIR, f));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const headers = rows[0].map((h) => String(h == null ? '' : h).trim());
  const sig = headers.join(' ␟ ');
  if (!headerSets.has(sig)) headerSets.set(sig, []);
  headerSets.get(sig).push(f);
  headers.filter(Boolean).forEach((h) => allHeaders.add(h));
  console.log(`${f}: ${rows.length - 1} 数据行, ${headers.filter(Boolean).length} 字段`);
}

console.log(`\n=== 共 ${headerSets.size} 套字段格式 ===`);
let i = 1;
for (const [sig, fsList] of headerSets) {
  console.log(`\n格式${i} (${fsList.length} 文件):`);
  console.log('  文件:', fsList.slice(0, 6).join(', ') + (fsList.length > 6 ? '...' : ''));
  console.log('  字段:', sig.split(' ␟ ').filter(Boolean).join(' | '));
  i++;
}
console.log('\n=== 全部字段并集 ===');
console.log([...allHeaders].join(' | '));
