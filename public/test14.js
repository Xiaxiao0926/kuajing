const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');
const idx = d.indexOf('pageData.map((result, resultIndex)');
console.log('Start at:', idx);
// 找到对应的 .join
const slice = d.substring(idx);
// 找到join
const joinIdx = slice.indexOf("join('')");
console.log('join at offset:', joinIdx);
const block = slice.substring(0, joinIdx + "join('')".length);
fs.writeFileSync('d:\\ozon\\public\\mapblock.js', block);
console.log('Block length:', block.length);
