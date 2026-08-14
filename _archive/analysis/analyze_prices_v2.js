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
                for (let i = 0; i < Math.min(10, data.length); i++) {
                    const row = data[i];
                    if (row && row.some(cell => 
                        String(cell).includes('品名') || 
                        String(cell).includes('产品名称') ||
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
                let nameIndex = headers.findIndex(h => String(h).includes('品名'));
                if (nameIndex === -1) nameIndex = headers.findIndex(h => String(h).includes('产品名称'));
                if (nameIndex === -1) nameIndex = headers.findIndex(h => String(h).includes('产品'));
                
                let specIndex = headers.findIndex(h => String(h).includes('规格'));
                if (specIndex === -1) specIndex = headers.findIndex(h => String(h).includes('容量'));
                
                let priceIndex = headers.findIndex(h => String(h).includes('代发价'));
                if (priceIndex === -1) priceIndex = headers.findIndex(h => String(h).includes('价格'));
                if (priceIndex === -1) priceIndex = headers.findIndex(h => String(h).includes('报价'));
                
                let priceTypeIndex = headers.findIndex(h => String(h).includes('含税') || String(h).includes('含运') || String(h).includes('报价类型'));
                
                if (nameIndex === -1) continue;
                
                // 读取产品数据
                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row) continue;
                    
                    const name = row[nameIndex];
                    if (!name || String(name).trim() === '') continue;
                    
                    // 获取规格，如果没有则从名称中提取
                    let spec = specIndex !== -1 ? String(row[specIndex] || '').trim() : '';
                    if (!spec) {
                        const capacityMatch = String(name).match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ)/i);
                        if (capacityMatch) {
                            spec = capacityMatch[0];
                        }
                    }
                    
                    // 获取价格类型
                    const priceType = priceTypeIndex !== -1 ? String(row[priceTypeIndex] || '').trim() : '';
                    const finalPriceType = priceType || '含税顺丰代发价';
                    
                    const product = {
                        name: String(name).trim(),
                        spec: spec,
                        price: priceIndex !== -1 ? parseFloat(String(row[priceIndex] || '')) : null,
                        priceType: finalPriceType,
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
                    const titleParts = [];
                    for (let i = 1; i <= 8; i++) {
                        const title = row[`title--ASSt27UY${i > 1 ? ' ' + i : ''}`];
                        if (title) titleParts.push(title);
                    }
                    
                    const title = titleParts.join(' ');
                    
                    // 提取价格
                    let price = null;
                    const priceInt = row['priceInt--yqqZMJ5a'];
                    const priceFloat = row['priceFloat--XpixvyQ1'];
                    
                    if (priceInt) {
                        price = parseFloat(priceInt);
                        if (priceFloat && !isNaN(parseFloat(priceFloat))) {
                            price += parseFloat(priceFloat);
                        }
                    }
                    
                    // 提取规格
                    const spec = row['spec--34i83J61'] || '';
                    
                    // 提取店铺
                    const shop = row['shop--1DcK3rXn'] || row['shopName'] || '';
                    
                    // 提取链接
                    const link = row['link--2k6K5l6D'] || row['detailUrl'] || '';
                    
                    if (title && price) {
                        allProducts.push({
                            title: title,
                            price: price,
                            spec: String(spec).trim(),
                            shop: String(shop).trim(),
                            link: String(link).trim(),
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
 * 计算两个字符串的相似度（基于关键词匹配）
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = String(str1).toLowerCase();
    const s2 = String(str2).toLowerCase();
    
    // 提取关键词：品牌名、产品名、容量
    const keywords1 = extractKeywords(s1);
    const keywords2 = extractKeywords(s2);
    
    if (keywords1.length === 0) return 0;
    
    let matches = 0;
    for (const kw1 of keywords1) {
        for (const kw2 of keywords2) {
            if (kw1.includes(kw2) || kw2.includes(kw1)) {
                matches++;
                break;
            }
        }
    }
    
    return Math.round((matches / keywords1.length) * 100);
}

/**
 * 提取关键词
 */
function extractKeywords(str) {
    const keywords = [];
    
    // 品牌名
    const brands = ['植村秀', 'Shu-uemura', 'shu uemura', '芙丽芳丝', 'Freeplus', '欧莱雅', 'Loreal', '雅诗兰黛', 'Estee Lauder'];
    for (const brand of brands) {
        if (str.includes(brand.toLowerCase())) {
            keywords.push(brand.toLowerCase());
        }
    }
    
    // 产品类型
    const productTypes = ['卸妆油', '洁面', '洗面奶', '洁颜油', '面霜', '乳液', '精华', '爽肤水', '面膜'];
    for (const type of productTypes) {
        if (str.includes(type)) {
            keywords.push(type);
        }
    }
    
    // 产品名称关键词
    const productNames = ['琥珀', '臻萃', '绿茶', '柚子', '樱花', '黄金', '净润'];
    for (const name of productNames) {
        if (str.includes(name)) {
            keywords.push(name);
        }
    }
    
    // 容量
    const capacityMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:ml|g|oz)/i);
    if (capacityMatch) {
        keywords.push(capacityMatch[0].toLowerCase());
    }
    
    return keywords.length > 0 ? keywords : str.split(/\s+/).filter(w => w.length > 2);
}

/**
 * 分析价格优势
 */
function analyzePrices(supplierProducts, marketProducts) {
    const results = [];
    
    for (const supplierProduct of supplierProducts) {
        const fullName = supplierProduct.spec ? supplierProduct.name + ' ' + supplierProduct.spec : supplierProduct.name;
        
        // 找到匹配的市场价产品
        const matches = [];
        
        for (const marketProduct of marketProducts) {
            const similarity = calculateSimilarity(fullName, marketProduct.title);
            
            // 只有当相似度足够高时才考虑
            if (similarity >= 60) {
                matches.push({
                    ...marketProduct,
                    similarity: similarity
                });
            }
        }
        
        // 按相似度和价格排序
        matches.sort((a, b) => {
            // 优先按相似度排序，相似度相同按价格排序
            if (b.similarity !== a.similarity) {
                return b.similarity - a.similarity;
            }
            return a.price - b.price;
        });
        
        // 取前5个候选
        const topCandidates = matches.slice(0, 5);
        
        if (topCandidates.length > 0) {
            const prices = topCandidates.map(m => m.price).filter(p => p !== null);
            const minPrice = Math.min(...prices);
            
            let status = '已匹配';
            let priceAdvantage = '';
            let priceDiff = null;
            
            if (supplierProduct.price !== null && minPrice > 0) {
                priceDiff = supplierProduct.price - minPrice;
                if (supplierProduct.price < minPrice) {
                    priceAdvantage = `低于市场低价 ${Math.abs(priceDiff).toFixed(0)} 元`;
                } else {
                    priceAdvantage = `高于市场低价 ${priceDiff.toFixed(0)} 元`;
                }
            }
            
            // 构建候选列表
            const candidates = [];
            for (let i = 0; i < 4; i++) {
                if (topCandidates[i]) {
                    candidates.push({
                        title: topCandidates[i].title,
                        price: topCandidates[i].price,
                        spec: topCandidates[i].spec || '',
                        shop: topCandidates[i].shop || '',
                        similarity: topCandidates[i].similarity,
                        link: topCandidates[i].link || ''
                    });
                } else {
                    candidates.push(null);
                }
            }
            
            results.push({
                status: status,
                queryName: fullName,
                supplierPrice: supplierProduct.price,
                priceType: supplierProduct.priceType,
                priceAdvantage: priceAdvantage,
                marketCount: matches.length,
                minPrice: minPrice,
                candidates: candidates,
                sourceFile: supplierProduct.sourceFile,
                sourceSheet: supplierProduct.sourceSheet
            });
        } else {
            // 没有匹配到的产品
            results.push({
                status: '未匹配',
                queryName: fullName,
                supplierPrice: supplierProduct.price,
                priceType: supplierProduct.priceType,
                priceAdvantage: '无匹配数据',
                marketCount: 0,
                minPrice: null,
                candidates: [null, null, null, null],
                sourceFile: supplierProduct.sourceFile,
                sourceSheet: supplierProduct.sourceSheet
            });
        }
    }
    
    // 按匹配状态和价格优势排序
    results.sort((a, b) => {
        // 已匹配的排在前面
        if (a.status !== b.status) {
            return a.status === '已匹配' ? -1 : 1;
        }
        // 按价格差异排序（低价优先）
        if (a.minPrice && b.minPrice) {
            return a.minPrice - b.minPrice;
        }
        return 0;
    });
    
    return results;
}

/**
 * 保存结果到Excel
 */
function saveResults(results) {
    const outputFile = path.join(OUTPUT_FOLDER, '价格优势分析结果_v2.xlsx');
    
    // 准备数据
    const wsData = [
        ['状态', '查询名称', '供应商价格', '价格口径', '价格优势', '市场抓取报价数量', '最低价', 
         '候选1标题', '候选1价格', '候选1规格', '候选1店铺', '候选1匹配度',
         '候选2标题', '候选2价格', '候选2规格', '候选2店铺', '候选2匹配度',
         '候选3标题', '候选3价格', '候选3规格', '候选3店铺', '候选3匹配度',
         '候选4标题', '候选4价格', '候选4规格', '候选4店铺', '候选4匹配度',
         '来源文件']
    ];
    
    for (const result of results) {
        const row = [
            result.status,
            result.queryName,
            result.supplierPrice,
            result.priceType,
            result.priceAdvantage,
            result.marketCount,
            result.minPrice
        ];
        
        // 添加候选数据
        for (let i = 0; i < 4; i++) {
            const candidate = result.candidates[i];
            if (candidate) {
                row.push(
                    candidate.title,
                    candidate.price,
                    candidate.spec,
                    candidate.shop,
                    candidate.similarity + '%'
                );
            } else {
                row.push('', '', '', '', '');
            }
        }
        
        row.push(result.sourceFile);
        wsData.push(row);
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
    const matchedCount = results.filter(r => r.status === '已匹配').length;
    console.log(`已匹配产品数: ${matchedCount}`);
    const unmatchedCount = results.filter(r => r.status === '未匹配').length;
    console.log(`未匹配产品数: ${unmatchedCount}`);
    
    return results;
}

main().catch(console.error);

module.exports = { analyzePrices, readSupplierQuotes, readMarketPrices };
