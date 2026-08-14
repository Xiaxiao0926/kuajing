const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// 查看报价表
const quoteFolder = 'E:\\Desktop\\坪优报价分析\\报价表';
const quoteFiles = fs.readdirSync(quoteFolder).filter(f => f.endsWith('.xlsx'));

console.log('=== 报价表文件 ===');
for (const file of quoteFiles) {
    const filePath = path.join(quoteFolder, file);
    console.log(`\n${file}:`);
    
    try {
        const workbook = xlsx.readFile(filePath);
        for (const sheetName of workbook.SheetNames) {
            console.log(`  - Sheet: ${sheetName}`);
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            console.log(`    数据行数: ${data.length}`);
            console.log(`    前5行数据:`);
            for (let i = 0; i < Math.min(5, data.length); i++) {
                console.log(`      ${JSON.stringify(data[i])}`);
            }
        }
    } catch (e) {
        console.error(`    Error:`, e.message);
    }
}

// 查看一个市场价CSV文件
console.log('\n\n=== 市场价CSV文件示例 ===');
const marketFolder = 'E:\\Desktop\\坪优报价分析\\市场价';
const csvFiles = fs.readdirSync(marketFolder).filter(f => f.endsWith('.csv'));

if (csvFiles.length > 0) {
    const csv = require('csv-parser');
    const filePath = path.join(marketFolder, csvFiles[0]);
    console.log(`\n${csvFiles[0]}:`);
    
    const rows = [];
    fs.createReadStream(filePath, 'utf8')
        .pipe(csv())
        .on('data', (row) => {
            if (rows.length < 3) rows.push(row);
        })
        .on('end', () => {
            console.log(`  列名: ${Object.keys(rows[0] || {})}`);
            console.log(`  前3行数据:`);
            rows.forEach((row, i) => console.log(`    ${i + 1}: ${JSON.stringify(row)}`));
        });
}
