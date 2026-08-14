const XLSX = require('xlsx');
const wb = XLSX.readFile('2026年Ozon平台供应链工厂目录0406.xlsx');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
console.log('总行数:', data.length);
console.log('\n所有行数据:');
for (let i = 0; i < data.length; i++) {
  console.log('\n=== 行' + (i+1) + ' ===');
  const row = data[i];
  for (let j = 0; j < row.length; j++) {
    const v = String(row[j] || '').substring(0, 120);
    if (v) console.log('  col' + j + ': ' + v);
  }
}
