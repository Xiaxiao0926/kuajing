const fs = require('fs');
const wrapped = fs.readFileSync('d:\\ozon\\public\\wrapped.js', 'utf-8');
const test22 = fs.readFileSync('d:\\ozon\\public\\test22.js', 'utf-8');

// 找到两个文件中模板字符串的部分
// wrapped.js 第9行开始是 container.innerHTML = pageData.map...
const wStart = wrapped.indexOf('container.innerHTML = pageData.map');
const wEnd = wrapped.indexOf("join('');", wStart) + "join('');".length;
const wBlock = wrapped.substring(wStart, wEnd);

// test22.js
const tStart = test22.indexOf('container.innerHTML = pageData.map');
const tEnd = test22.indexOf("join('');", tStart) + "join('');".length;
const tBlock = test22.substring(tStart, tEnd);

console.log('Wrapped block length:', wBlock.length);
console.log('Test22 block length:', tBlock.length);

// 写出来对比
fs.writeFileSync('d:\\ozon\\public\\wblock.js', wBlock);
fs.writeFileSync('d:\\ozon\\public\\tblock.js', tBlock);

// 逐字符对比
let diffCount = 0;
for (let i = 0; i < Math.max(wBlock.length, tBlock.length); i++) {
    if (wBlock[i] !== tBlock[i]) {
        diffCount++;
        if (diffCount <= 5) {
            console.log(`Diff at ${i}: wrapped='${wBlock[i]}' (${wBlock.charCodeAt(i)}) vs test='${tBlock[i]}' (${tBlock.charCodeAt(i)})`);
            console.log(`  wrapped context: ${JSON.stringify(wBlock.substring(Math.max(0,i-10), i+10))}`);
            console.log(`  test context: ${JSON.stringify(tBlock.substring(Math.max(0,i-10), i+10))}`);
        }
    }
}
console.log('Total diffs:', diffCount);
