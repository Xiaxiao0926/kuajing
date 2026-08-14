const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');
// 检查前12行
const lines = d.split('\n');
for (let i = 0; i < 15; i++) {
    console.log((i+1) + ': ' + JSON.stringify(lines[i]).substring(0, 150));
}
