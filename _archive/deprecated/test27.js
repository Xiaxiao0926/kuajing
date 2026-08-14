const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\rr_func.js', 'utf-8');

// 检查第17行到第60行之间是否有异常字符
const lines = d.split('\n');
for (let i = 16; i < 60; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const code = line.charCodeAt(j);
        // 检查零宽字符、BOM、特殊空格等
        if (code === 0xFEFF || code === 0x200B || code === 0x200C || code === 0x200D ||
            code === 0x00A0 || code === 0x2028 || code === 0x2029) {
            console.log(`Line ${i+1}, col ${j}: suspicious char U+${code.toString(16).toUpperCase()}`);
        }
    }
}
console.log('No suspicious chars found (or see above)');

// 另一种方法：把第15-60行提取出来，包装成完整函数
const block = lines.slice(14, 60).join('\n');
const wrapped = `function test() {\nconst pageData = [{}];\nconst currentPage = 1;\nconst pageSize = 15;\nconst result = {status:'x',queryName:'x',supplierPrice:0,priceType:'',priceAdvantage:'',hasAdvantage:false,marketCount:0,minPrice:0,category:'',minPriceItem:null,candidates:[]};\nconst globalIdx = 0;\nconst container = {innerHTML:''};\n` + block + '\n}';
fs.writeFileSync('d:\\ozon\\public\\wrapped.js', wrapped);
