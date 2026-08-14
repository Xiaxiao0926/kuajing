const XLSX = require('xlsx');
const wb = XLSX.readFile('各供应商起订量及价格清单表.xlsx');
console.log('Sheet names:', wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log('Total rows:', data.length);
for (let i = 0; i < Math.min(data.length, 20); i++) {
  console.log('\n=== Row', i + 1, '===');
  const row = data[i];
  for (let j = 0; j < (row ? row.length : 0); j++) {
    const v = String(row[j] || '');
    if (v) console.log('  col' + j + ': ' + v.substring(0, 120));
  }
}
