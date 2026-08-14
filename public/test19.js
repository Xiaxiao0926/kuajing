const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');
const vm = require('vm');

const lines = d.split('\n');
// 逐行精确查找 - 从第10行到第30行
for (let j = 10; j < 30; j++) {
    const test = lines.slice(0, j+1).join('\n');
    try {
        new vm.Script(test);
    } catch(e2) {
        if (!e2.message.includes('end of input')) {
            console.log(`Line ${j+1}: ${e2.message.substring(0, 100)}`);
            console.log(`  ${lines[j].substring(0, 150)}`);
        }
    }
}
