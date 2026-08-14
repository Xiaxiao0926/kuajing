const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');

// 逐字符查找反引号配对问题
let depth = 0;
let inTemplate = false;
let templateStartLine = 0;
const lines = d.split('\n');
let charIndex = 0;

for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const prev = i > 0 ? line[i-1] : '';

        if (ch === '`' && prev !== '\\') {
            if (!inTemplate) {
                inTemplate = true;
                templateStartLine = lineIdx + 1;
                depth++;
            } else {
                inTemplate = false;
                depth--;
            }
        }
    }
}

// 更精确：用Node的parser
// 直接把脚本包装成函数并检查
try {
    // 包装成async IIFE
    new Function('async function _() {' + d + '}');
    console.log('OK with wrapper');
} catch(e2) {
    console.log('Wrapped error:', e2.message);
}

// 尝试直接eval
try {
    eval('(function(){' + d + '})');
    console.log('OK with eval');
} catch(e3) {
    console.log('Eval error:', e3.message);
}
