const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\check.js', 'utf-8');
const lines = d.split('\n');
// 提取第95-150行
const subset = lines.slice(94, 150).join('\n');
fs.writeFileSync('d:\\ozon\\public\\subset.js', subset);
