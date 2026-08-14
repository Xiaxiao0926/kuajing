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
    const quoteFiles = fs.readdirSync(QUOTE_FOLDER).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    const allProducts = [];
    
    for (const file of quoteFiles) {
        const filePath = path.join(QUOTE_FOLDER, file);
        try {
            const workbook = xlsx.readFile(filePath);
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                
                // 找到表头行
                let headerRowIndex = -1;
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    if (row && row.some(cell => 
                        String(cell).includes('品名') || 
                        String(cell).includes('规格') ||
                        String(cell).includes('价格')
                    )) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                if (headerRowIndex === -1) continue;
                
                const headers = data[headerRowIndex];
                
                // 找到关键列的索引
                const nameIndex = headers.findIndex(h => String(h).includes('品名'));
                const specIndex = headers.findIndex(h => String(h).includes('规格'));
                const priceIndex = headers.findIndex(h => String(h).includes('代发价') || String(h).includes('价格'));
                
                if (nameIndex === -1) continue;
                
                // 读取产品数据
                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row) continue;
                    
                    const name = row[nameIndex];
                    if (!name || String(name).trim() === '') continue;
                    
                    const product = {
                        name: String(name).trim(),
                        spec: specIndex !== -1 ? String(row[specIndex] || '').trim() : '',
                        price: priceIndex !== -1 ? parseFloat(String(row[priceIndex] || '')) : null,
                        sourceFile: file,
                        sourceSheet: sheetName
                    };
                    
                    if (product.name) {
                        allProducts.push(product);
                    }
                }
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }
    
    return allProducts;
}

/**
 * 读取市场价CSV文件
 */
async function readMarketPrices() {
    const csvFiles = fs.readdirSync(MARKET_FOLDER).filter(f => f.endsWith('.csv'));
    const allProducts = [];
    
    for (const file of csvFiles) {
        const filePath = path.join(MARKET_FOLDER, file);
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath, 'utf8')
                .pipe(csv())
                .on('data', (row) => {
                    // 提取产品信息
                    const titleParts = [
                        row['title--ASSt27UY'],
                        row['title--ASSt27UY 2'],
                        row['title--ASSt27UY 3'],
                        row['title--ASSt27UY 4'],
                        row['title--ASSt27UY 5'],
                        row['title--ASSt27UY 6'],
                        row['title--ASSt27UY 7'],
                        row['title--ASSt27UY 8']
                    ].filter(p => p).join(' ');
                    
                    let price = null;
                    const priceInt = row['priceInt--yqqZMJ5a'];
                    const priceFloat = row['priceFloat--XpixvyQ1'];
                    
                    if (priceInt) {
                        price = parseFloat(priceInt);
                        if (priceFloat && !isNaN(parseFloat(priceFloat))) {
                            price += parseFloat(priceFloat);
                        }
                    }
                    
                    if (titleParts && price) {
                        allProducts.push({
                            title: titleParts,
                            price: price,
                            sourceFile: file
                        });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });
    }
    
    return allProducts;
}

/**
 * 计算两个字符串的相似度（简单的词匹配）
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = String(str1).toLowerCase();
    const s2 = String(str2).toLowerCase();
    
    const words1 = s1.split(/\s+/).filter(w => w.length > 1);
    const words2 = s2.split(/\s+/).filter(w => w.length > 1);
    
    let matches = 0;
    for (const word1 of words1) {
        for (const word2 of words2) {
            if (word1.includes(word2) || word2.includes(word1)) {
                matches++;
                break;
            }
        }
    }
    
    return matches / Math.max(words1.length, words2.length);
}

/**
 * 分析价格优势
 */
function analyzePrices(supplierProducts, marketProducts) {
    const results = [];
    
    for (const supplierProduct of supplierProducts) {
        // 找到匹配的市场价产品
        const matches = [];
        
        for (const marketProduct of marketProducts) {
            const similarity = calculateSimilarity(supplierProduct.name, marketProduct.title);
            
            // 只有当相似度足够高时才考虑
            if (similarity > 0.2) {
                matches.push({
                    ...marketProduct,
                    similarity: similarity
                });
            }
        }
        
        // 按相似度排序
        matches.sort((a, b) => b.similarity - a.similarity);
        
        if (matches.length > 0) {
            const prices = matches.map(m => m.price);
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            let priceDiff = null;
            let priceRatio = null;
            let isAdvantage = null;
            let advantagePercent = null;
            
            if (supplierProduct.price !== null && avgPrice > 0) {
                priceDiff = avgPrice - supplierProduct.price;
                priceRatio = supplierProduct.price / avgPrice;
                isAdvantage = supplierProduct.price < avgPrice;
                advantagePercent = isAdvantage ? ((avgPrice - supplierProduct.price) / avgPrice) * 100 : 0;
            }
            
            results.push({
                supplierProduct: supplierProduct.name,
                supplierSpec: supplierProduct.spec,
                supplierPrice: supplierProduct.price,
                matchedMarketCount: matches.length,
                topMatch: matches[0].title,
                avgMarketPrice: avgPrice,
                minMarketPrice: minPrice,
                maxMarketPrice: maxPrice,
                priceDiff: priceDiff,
                priceRatio: priceRatio,
                isAdvantage: isAdvantage,
                advantagePercent: advantagePercent,
                sourceFile: supplierProduct.sourceFile,
                sourceSheet: supplierProduct.sourceSheet
            });
        }
    }
    
    // 按是否有优势和优势百分比排序
    results.sort((a, b) => {
        if (a.isAdvantage !== b.isAdvantage) {
            return a.isAdvantage ? -1 : 1;
        }
        return (b.advantagePercent || 0) - (a.advantagePercent || 0);
    });
    
    return results;
}

/**
 * 保存结果到Excel
 */
function saveResults(results) {
    const outputFile = path.join(OUTPUT_FOLDER, '价格优势分析结果.xlsx');
    
    // 准备数据
    const wsData = [
        ['供应商产品', '规格', '供应商价格', '匹配市场价数量', '最佳匹配产品', 
         '平均市场价', '最低市场价', '最高市场价', '价格差异', '价格比例', 
         '是否有优势', '优势百分比', '来源文件', '来源Sheet']
    ];
    
    for (const result of results) {
        wsData.push([
            result.supplierProduct,
            result.supplierSpec,
            result.supplierPrice,
            result.matchedMarketCount,
            result.topMatch,
            result.avgMarketPrice,
            result.minMarketPrice,
            result.maxMarketPrice,
            result.priceDiff,
            result.priceRatio ? (result.priceRatio * 100).toFixed(1) + '%' : '',
            result.isAdvantage ? '是' : '否',
            result.advantagePercent !== null ? result.advantagePercent.toFixed(1) + '%' : '',
            result.sourceFile,
            result.sourceSheet
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
    const supplierProducts = readSupplierQuotes();
    console.log(`读取了 ${supplierProducts.length} 个供应商产品`);
    
    console.log('\n正在读取市场价数据...');
    const marketProducts = await readMarketPrices();
    console.log(`读取了 ${marketProducts.length} 条市场价记录`);
    
    console.log('\n正在分析价格...');
    const results = analyzePrices(supplierProducts, marketProducts);
    
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
        
        console.log('\n=== 价格优势最高的10个产品 ===');
        advantageProducts.slice(0, 10).forEach((p, i) => {
            console.log(`${i + 1}. ${p.supplierProduct} - 优势: ${p.advantagePercent.toFixed(1)}%`);
        });
    }
    
    return results;
}

main().catch(console.error);
