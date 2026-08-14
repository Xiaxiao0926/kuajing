const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');

// 找到第一个 renderResults 函数
const idx = d.indexOf('function renderResults()');
console.log('renderResults starts at char:', idx);

// 提取到renderResults之前
const before = d.substring(0, idx);
try { new Function(before); console.log('Before renderResults: OK'); }
catch(e) { console.log('Before renderResults error:', e.message.substring(0, 150)); }

// 提取renderResults函数
const fromRR = d.substring(idx);
const endRR = fromRR.indexOf('function renderPagination');
const rrFunc = fromRR.substring(0, endRR);
try { new Function(rrFunc); console.log('renderResults: OK'); }
catch(e) { console.log('renderResults error:', e.message.substring(0, 150)); }
