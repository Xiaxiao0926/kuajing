// T4-0 选品数据审计脚本（只读，不写评分逻辑）
// 审计对象：
//   A. 选品/跨境项目产品线扩展计划.xlsx（1201 行，主选品数据）
//   B. 市场分析/*.xlsx 五个品类文件（对比字段结构差异）
const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(process.cwd(), 'node_modules', 'xlsx'));

const ROOT = process.cwd();

function auditSheet(file, sheetName) {
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  if (rows.length === 0) return { error: '空表' };
  const headers = rows[0].map((h, i) => ({ name: String(h == null ? '' : h).trim(), idx: i })).filter((h) => h.name !== '');
  const headerIndex = new Map(headers.map((h) => [h.name, h.idx]));
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c !== null && c !== undefined && c !== ''));

  // 字段类型与缺失统计
  const colStats = {};
  for (const h of headers) {
    const values = dataRows.map((r) => r[h.idx]);
    let nonNull = 0, numeric = 0, stringCount = 0, boolCount = 0, dateCount = 0;
    const numValues = [];
    const distinct = new Set();
    for (const v of values) {
      if (v === null || v === undefined || v === '') continue;
      nonNull++;
      distinct.add(String(v).slice(0, 80));
      if (typeof v === 'number') { numeric++; numValues.push(v); }
      else if (typeof v === 'string') {
        stringCount++;
        const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
        if (!isNaN(n) && /^-?\d+([.,]\d+)?%?$/.test(String(v).trim())) { numeric++; numValues.push(n); }
      }
      else if (typeof v === 'boolean') boolCount++;
      else if (v instanceof Date) dateCount++;
    }
    numValues.sort((a, b) => a - b);
    colStats[h.name] = {
      total: dataRows.length,
      nonNull,
      missingRate: +( (1 - nonNull / dataRows.length) * 100 ).toFixed(1),
      numericRate: +( (numeric / dataRows.length) * 100 ).toFixed(1),
      stringRate: +( (stringCount / dataRows.length) * 100 ).toFixed(1),
      boolRate: +( (boolCount / dataRows.length) * 100 ).toFixed(1),
      dateRate: +( (dateCount / dataRows.length) * 100 ).toFixed(1),
      distinctCount: distinct.size,
      min: numValues.length ? numValues[0] : null,
      p5: numValues.length ? numValues[Math.floor(numValues.length * 0.05)] : null,
      median: numValues.length ? numValues[Math.floor(numValues.length * 0.5)] : null,
      p95: numValues.length ? numValues[Math.floor(numValues.length * 0.95)] : null,
      max: numValues.length ? numValues[numValues.length - 1] : null,
      sample: values.find((v) => v !== null && v !== undefined && v !== ''),
    };
  }
  return { headers: headers.map((h) => h.name), dataRowCount: dataRows.length, totalRows: rows.length, colStats };
}

function main() {
  const report = {};

  // ============ A. 主选品数据 ============
  const mainFile = path.join(ROOT, '选品', '跨境项目产品线扩展计划.xlsx');
  const wbMain = xlsx.readFile(mainFile);
  report.mainFile = {
    path: mainFile,
    sheets: wbMain.SheetNames,
  };
  for (const sheet of wbMain.SheetNames) {
    report.mainFile[sheet] = auditSheet(mainFile, sheet);
  }

  // SKU 重复检查（商品ID）
  const mainSheet = wbMain.SheetNames[0];
  const ws = wbMain.Sheets[mainSheet];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const idIdx = rows[0].findIndex((h) => String(h).trim() === '商品ID');
  if (idIdx >= 0) {
    const ids = rows.slice(1).map((r) => r[idIdx]).filter((v) => v !== null && v !== undefined && v !== '');
    const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
    report.mainFile.duplicateCheck = {
      idColumn: '商品ID',
      totalIds: ids.length,
      uniqueIds: new Set(ids.map(String)).size,
      duplicateCount: dup.length,
      duplicateSamples: [...new Set(dup.map(String))].slice(0, 5),
    };
  }

  // ============ B. 市场分析品类文件 ============
  report.categoryFiles = {};
  const marketDir = path.join(ROOT, '市场分析');
  for (const f of fs.readdirSync(marketDir).filter((n) => n.endsWith('.xlsx') && !n.startsWith('~$'))) {
    const file = path.join(marketDir, f);
    const wb = xlsx.readFile(file);
    const sheet0 = wb.SheetNames[0];
    const a = auditSheet(file, sheet0);
    report.categoryFiles[f] = {
      sheets: wb.SheetNames,
      sheetUsed: sheet0,
      dataRowCount: a.dataRowCount,
      headers: a.headers,
      colStats: a.colStats,
    };
  }

  fs.writeFileSync(path.join(ROOT, '_audit', 'tmp', 't4-audit-raw.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log('[t4-audit] 原始审计结果 → _audit/tmp/t4-audit-raw.json');

  // 摘要输出
  console.log('\n=== A. 主选品数据 ===');
  for (const sheet of report.mainFile.sheets) {
    const s = report.mainFile[sheet];
    console.log(`Sheet[${sheet}]: ${s.dataRowCount} 数据行 / ${s.totalRows} 总行 / ${s.headers.length} 字段`);
    console.log('  字段 | 缺失% | 数值% | 字符串% | 去重数 | min/中位/max');
    for (const [name, st] of Object.entries(s.colStats)) {
      console.log(`  ${name} | ${st.missingRate} | ${st.numericRate} | ${st.stringRate} | ${st.distinctCount} | ${st.min ?? '-'}/${st.median ?? '-'}/${st.max ?? '-'}`);
    }
  }
  if (report.mainFile.duplicateCheck) {
    const d = report.mainFile.duplicateCheck;
    console.log(`\nSKU 重复: 总${d.totalIds} 唯一${d.uniqueIds} 重复${d.duplicateCount}`);
  }
  console.log('\n=== B. 市场分析品类文件 ===');
  for (const [f, c] of Object.entries(report.categoryFiles)) {
    console.log(`${f}: ${c.dataRowCount} 行 / ${c.headers.length} 字段`);
  }
}

main();
