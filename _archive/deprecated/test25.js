const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\rr_func.js', 'utf-8');

// 逐字符检查反引号
let inTemplate = false;
let templateDepth = 0;
let templateStack = [];

for (let i = 0; i < d.length; i++) {
    const ch = d[i];
    if (ch === '`') {
        if (!inTemplate) {
            inTemplate = true;
            templateDepth++;
            templateStack.push({start: i, line: d.substring(0,i).split('\n').length});
        } else {
            // 关闭当前模板
            const opened = templateStack.pop();
            console.log(`Template: opened at line ${opened.line}, closed at line ${d.substring(0,i).split('\n').length}, depth=${templateDepth}`);
            templateDepth--;
            inTemplate = templateDepth > 0;
        }
    }
}

if (templateStack.length > 0) {
    console.log('UNCLOSED templates:', templateStack);
}
