const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');

// 找到renderResults函数
const start = d.indexOf('function renderResults()');
const end = d.indexOf('function renderPagination');
const rr = d.substring(start, end);

// 检查是否有非ASCII非中文的特殊字符
for (let i = 0; i < rr.length; i++) {
    const code = rr.charCodeAt(i);
    if (code > 127 && code < 0x4e00) {
        // 非ASCII且非中文字符范围
        console.log(`Suspicious char at offset ${i}: code=${code.toString(16)} char='${rr[i]}' context='${rr.substring(Math.max(0,i-5), i+5)}'`);
    }
}

// 检查反引号周围
let backtickPositions = [];
for (let i = 0; i < rr.length; i++) {
    if (rr[i] === '`') backtickPositions.push(i);
}
console.log('Backtick positions:', backtickPositions.length, 'backticks');
console.log('Backtick count is', backtickPositions.length % 2 === 0 ? 'EVEN (balanced)' : 'ODD (unbalanced!)');
