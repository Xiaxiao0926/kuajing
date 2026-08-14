const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');

// 用更精确的二分法：从中间切，检查前后两半
const mid = Math.floor(d.length / 2);
const firstHalf = d.substring(0, mid);
const secondHalf = d.substring(mid);

try { new Function(firstHalf); console.log('First half OK'); }
catch(e) { console.log('First half error:', e.message.substring(0, 100)); }

try { new Function(secondHalf); console.log('Second half OK'); }
catch(e) { console.log('Second half error:', e.message.substring(0, 100)); }

// 计算前半部分的反引号数
let count1 = 0;
for (const ch of firstHalf) if (ch === '`') count1++;
console.log('First half backtick count:', count1, '(should be even if balanced)');
