const fs = require('fs');
const script = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');

// 二分法找到错误行
const lines = script.split('\n');
let lo = 1, hi = lines.length;
while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const partial = lines.slice(0, mid).join('\n');
    try {
        new Function(partial);
        lo = mid + 1;
    } catch(e) {
        hi = mid;
    }
}
console.log('Error around line:', lo);
for (let i = Math.max(0, lo-5); i < Math.min(lines.length, lo+2); i++) {
    console.log((i+1) + ': ' + lines[i]);
}
