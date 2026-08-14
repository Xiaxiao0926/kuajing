const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');
const idx = d.indexOf('function renderResults()');
const fromRR = d.substring(idx);
const endRR = fromRR.indexOf('function renderPagination');
const rrFunc = fromRR.substring(0, endRR);

// 二分法在renderResults内
const mid = Math.floor(rrFunc.length / 2);
const first = rrFunc.substring(0, mid);
const second = rrFunc.substring(mid);

try { new Function(first); console.log('RR first half: OK'); }
catch(e) { console.log('RR first half error:', e.message.substring(0, 100)); }

try { new Function(second); console.log('RR second half: OK'); }
catch(e) { console.log('RR second half error:', e.message.substring(0, 100)); }

// 看看第一个错误在哪里
const lines = rrFunc.split('\n');
for (let i = 0; i < Math.min(10, lines.length); i++) {
    console.log(i+1 + ':', lines[i].substring(0, 100));
}
