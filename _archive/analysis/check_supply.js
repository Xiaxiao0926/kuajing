const XLSX = require('xlsx');
const wb = XLSX.readFile('2026年Ozon平台供应链工厂目录0406.xlsx');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
console.log('总行数:', data.length);
console.log('\n列名:');
Object.keys(data[0]).forEach(k => console.log('  - ' + k));
console.log('\n前5行样例:');
for (let i = 0; i < Math.min(5, data.length); i++) {
  console.log('\n--- 行' + (i+1) + ' ---');
  const row = data[i];
  const keys = Object.keys(row);
  for (let j = 0; j < keys.length; j++) {
    const k = keys[j];
    const v = String(row[k]).substring(0, 100);
    console.log('  ' + k + ': ' + v);
  }
}
