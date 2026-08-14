const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');

// 配置路径
const BASE_PATH = 'E:\\Desktop\\坪优报价分析';
const QUOTE_FOLDER = path.join(BASE_PATH, '报价表');
const MARKET_FOLDER = path.join(BASE_PATH, '市场价');
const OUTPUT_FOLDER = path.join(BASE_PATH, '分析结果');

// 创建输出文件夹
if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

/**
 * 读取供应商报价表
 */
function readSupplierQuotes() {
    const quoteFiles = fs.readdirSync(QUOTE_FOLDER).filter(f => f.endsWith('.xlsx'));
    const allData = [];
    
    for (const file of quoteFiles) {
        const filePath = path.join(QUOTE_FOLDER, file);
        try {
            const workbook = xlsx.readFile(filePath);
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                if (data.length > 0) {
                    allData.push({
                        file: file,
                        sheet: sheetName,
                        data: data
                    });
                }
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e);
        }
    }
    
    return allData;
}

/**
 * 读取市场价CSV文件
 */
async function readMarketPrices() {
    const csvFiles = fs.readdirSync(MARKET_FOLDER).filter(f => f.endsWith('.csv'));
    const allData = [];
    
    for (const file of csvFiles) {
        const filePath = path.join(MARKET_FOLDER, file);
        const data = [];
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath, 'utf8')
                .pipe(csv())
                .on('data', (row) => {
                    row.sourceFile = file;
                    data.push(row);
                })
                .on('end', resolve)
                .on('error', reject);
        });
        
        if (data.length > 0) {
            allData.push(...data);
        }
    }
    
    return allData;
}

/**
 * 提取产品名称
 */
function extractProductName(title) {
    if (!title) return '';
    title = String(title);
    
    const keywords = ['植村秀', 'Shu-uemura', '卸妆油', '琥珀', '臻萃', '洁颜油', '黄金', '柚子', '樱花', '绿茶', '水晶'];
    const nameParts = [];
    
    for (const keyword of keywords) {
        if (title.includes(keyword)) {
            nameParts.push(keyword);
        }
    }
    
    // 提取容量
    const capacityMatch = title.match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ)/i);
    if (capacityMatch) {
        nameParts.push(capacityMatch[0]);
    }
    
    return nameParts.length > 0 ? nameParts.join(' ') : title.substring(0, 50);
}

/**
 * 提取价格
 */
function extractPrice(row) {
    const priceCols = ['priceInt', 'priceFloat', '价格', 'Price', 'price'];
    for (const col of priceCols) {
        if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
            const val = parseFloat(String(row[col]).replace(',', ''));
            if (!isNaN(val)) {
                return val;
            }
        }
    }
    return null;
}

/**
 * 分析价格优势
 */
function analyzePrices(supplierData, marketData) {
    const results = [];
    
    // 预处理市场价数据
    const processedMarket = marketData.map(row => {
        const titleCol = row['title--ASSt27UY'] || row['title'] || Object.values(row)[0];
        return {
            ...row,
            productName: extractProductName(titleCol),
            price: extractPrice(row)
        };
    }).filter(row => row.price !== null);
    
    // 遍历供应商报价
    for (const supplierFile of supplierData) {
        const { file, sheet, data } = supplierFile;
        
        // 假设第一行是表头
        if (data.length < 2) continue;
        
        const headers = data[0];
        
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            let supplierName = '';
            let supplierPrice = null;
            
            // 遍历行的每个单元格
            for (let j = 0; j < row.length; j++) {
                const cell = row[j];
                if (cell === undefined || cell === null) continue;
                
                const cellStr = String(cell);
                const header = headers[j] ? String(headers[j]).toLowerCase() : '';
                
                // 尝试提取价格
                if (header.includes('price') || header.includes('价格') || header.includes('报价') || header.includes('cost')) {
                    const priceVal = parseFloat(cellStr.replace(',', ''));
                    if (!isNaN(priceVal)) {
                        supplierPrice = priceVal;
                    }
                }
                
                // 尝试提取产品名称
                if (!supplierName && cellStr.length > 2) {
                    supplierName = extractProductName(cellStr);
                }
            }
            
            if (!supplierName) {
                supplierName = `Product_${i}`;
            }
            
            // 在市场价中匹配
            const supplierKeywords = supplierName.split(/\s+/).filter(k => k.length > 0);
            const matchedMarket = processedMarket.filter(mRow => {
                return supplierKeywords.some(keyword => 
                    mRow.productName.includes(keyword)
                );
            });
            
            if (matchedMarket.length > 0) {
                const prices = matchedMarket.map(m => m.price).filter(p => p !== null);
                const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                
                let priceDiff = null;
                let priceRatio = null;
                let isAdvantage = null;
                let advantagePercent = null;
                
                if (supplierPrice !== null && avgPrice > 0) {
                    priceDiff = avgPrice - supplierPrice;
                    priceRatio = supplierPrice / avgPrice;
                    isAdvantage = supplierPrice < avgPrice;
                    advantagePercent = isAdvantage ? ((avgPrice - supplierPrice) / avgPrice) * 100 : 0;
                }
                
                results.push({
                    supplierProduct: supplierName,
                    supplierPrice: supplierPrice,
                    matchedMarketCount: matchedMarket.length,
                    avgMarketPrice: avgPrice,
                    minMarketPrice: minPrice,
                    maxMarketPrice: maxPrice,
                    priceDiff: priceDiff,
                    priceRatio: priceRatio,
                    isAdvantage: isAdvantage,
                    advantagePercent: advantagePercent,
                    sourceSupplierFile: file,
                    sourceSupplierSheet: sheet
                });
            }
        }
    }
    
    return results;
}

/**
 * 保存结果到Excel
 */
function saveResults(results) {
    const outputFile = path.join(OUTPUT_FOLDER, '价格优势分析结果.xlsx');
    
    // 准备数据
    const wsData = [
        ['供应商产品', '供应商价格', '匹配市场价数量', '平均市场价', '最低市场价', '最高市场价',
         '价格差异', '价格比例', '是否有优势', '优势百分比', '来源文件', '来源Sheet']
    ];
    
    for (const result of results) {
        wsData.push([
            result.supplierProduct,
            result.supplierPrice,
            result.matchedMarketCount,
            result.avgMarketPrice,
            result.minMarketPrice,
            result.maxMarketPrice,
            result.priceDiff,
            result.priceRatio,
            result.isAdvantage ? '是' : '否',
            result.advantagePercent,
            result.sourceSupplierFile,
            result.sourceSupplierSheet
        ]);
    }
    
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, '价格分析');
    xlsx.writeFile(wb, outputFile);
    
    return outputFile;
}

/**
 * 主函数
 */
async function main() {
    console.log('正在读取供应商报价表...');
    const supplierData = readSupplierQuotes();
    console.log(`读取了 ${supplierData.length} 个供应商数据文件`);
    
    console.log('\n正在读取市场价数据...');
    const marketData = await readMarketPrices();
    console.log(`读取了 ${marketData.length} 条市场价记录`);
    
    console.log('\n正在分析价格...');
    const results = analyzePrices(supplierData, marketData);
    
    console.log('\n正在保存结果...');
    const outputFile = saveResults(results);
    console.log(`分析完成！结果已保存到: ${outputFile}`);
    
    // 打印摘要
    console.log('\n=== 分析摘要 ===');
    console.log(`总分析产品数: ${results.length}`);
    const advantageCount = results.filter(r => r.isAdvantage).length;
    console.log(`有价格优势的产品数: ${advantageCount}`);
    console.log(`无价格优势的产品数: ${results.length - advantageCount}`);
    
    const advantageProducts = results.filter(r => r.isAdvantage);
    if (advantageProducts.length > 0) {
        const avgAdvantage = advantageProducts.reduce((a, b) => a + b.advantagePercent, 0) / advantageProducts.length;
        console.log(`平均价格优势百分比: ${avgAdvantage.toFixed(2)}%`);
    }
    
    return results;
}

// 检查是否有必要的依赖
try {
    require.resolve('xlsx');
    require.resolve('csv-parser');
} catch (e) {
    console.log('正在安装依赖...');
    const { execSync } = require('child_process');
    execSync('npm install xlsx csv-parser', { stdio: 'inherit' });
}

main().catch(console.error);
