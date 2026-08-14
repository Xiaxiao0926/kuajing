const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');
const idx = d.indexOf('container.innerHTML = pageData.map');
// 从map开始提取到join结束
const mapStart = idx;
const joinEnd = d.indexOf("').join('');", mapStart) + "').join('');".length;
const mapBlock = d.substring(mapStart, joinEnd);
fs.writeFileSync('d:\\ozon\\public\\mapblock.js', mapBlock);
console.log('Map block length:', mapBlock.length);
console.log('First 200:', mapBlock.substring(0, 200));
console.log('Last 200:', mapBlock.substring(mapBlock.length - 200));
