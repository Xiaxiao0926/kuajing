const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');
const vm = require('vm');

// 逐行添加代码，找到第一行出错的位置
const lines = d.split('\n');
let accumulated = '';
for (let i = 0; i < lines.length; i++) {
    accumulated += lines[i] + '\n';
    // 只在每10行检查一次以加速
    if ((i+1) % 10 === 0 || i === lines.length - 1) {
        try {
            new vm.Script(accumulated);
        } catch(e) {
            if (e.message.includes('Unexpected')) {
                console.log(`Error at line ${i+1}: ${e.message.substring(0, 80)}`);
                // 回退10行精确查找
                const subAcc = lines.slice(Math.max(0, i-9), i+1).join('\n');
                for (let j = Math.max(0, i-9); j <= i; j++) {
                    const test = lines.slice(0, j+1).join('\n');
                    try {
                        new vm.Script(test);
                    } catch(e2) {
                        if (e2.message.includes('Unexpected') && !e2.message.includes('end of input')) {
                            console.log(`  Exact error at line ${j+1}: ${e2.message.substring(0, 80)}`);
                            console.log(`  Content: ${lines[j].substring(0, 120)}`);
                            break;
                        }
                    }
                }
                break;
            }
        }
    }
}
