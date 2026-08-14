const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');

const BASE_PATH = 'E:\\Desktop\\坪优报价分析';
const QUOTE_FOLDER = path.join(BASE_PATH, '报价表');
const MARKET_FOLDER = path.join(BASE_PATH, '市场价');
const OUTPUT_FOLDER = path.join(BASE_PATH, '分析结果');

if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

const BRANDS = ['植村秀', 'Shu-uemura', 'shu uemura', '芙丽芳丝', 'Freeplus', '润百颜', '润百颜次抛', 
                '欧莱雅', 'Loreal', '雅诗兰黛', 'Estee Lauder', 'SK-II', 'SK2', '兰蔻', 'Lancome',
                '资生堂', 'Shiseido', '娇兰', 'Guerlain', '迪奥', 'Dior', '香奈儿', 'Chanel',
                '海蓝之谜', 'La Mer', '赫莲娜', 'HR', 'YSL', '圣罗兰', '纪梵希', 'Givenchy',
                '娇韵诗', 'Clarins', '雪花秀', 'Sulwhasoo', 'Whoo', '后', '欧舒丹', 'Loccitane'];

const PRODUCT_TYPES = ['卸妆油', '洁面', '洗面奶', '洁颜油', '面霜', '乳液', '精华', '次抛精华',
                       '爽肤水', '化妆水', '面膜', '眼霜', '粉底', '口红', '唇膏', '防晒',
                       '护手霜', '身体乳', '香水', '精华液', '肌底液'];

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
                
                let nameIndex = headers.findIndex(h => String(h).includes('品名'));
                if (nameIndex === -1) nameIndex = headers.findIndex(h => String(h).includes('产品名称'));
                if (nameIndex === -1) nameIndex = headers.findIndex(h => String(h).includes('产品'));
                
                let specIndex = headers.findIndex(h => String(h).includes('规格'));
                if (specIndex === -1) specIndex = headers.findIndex(h => String(h).includes('容量'));
                
                let priceIndex = headers.findIndex(h => String(h).includes('代发价'));
                if (priceIndex === -1) priceIndex = headers.findIndex(h => String(h).includes('价格'));
                if (priceIndex === -1) priceIndex = headers.findIndex(h => String(h).includes('报价'));
                
                if (nameIndex === -1) continue;
                
                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row) continue;
                    
                    const name = row[nameIndex];
                    if (!name || String(name).trim() === '') continue;
                    
                    let spec = specIndex !== -1 ? String(row[specIndex] || '').trim() : '';
                    if (!spec) {
                        const capacityMatch = String(name).match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ|支|片|瓶)/i);
                        if (capacityMatch) {
                            spec = capacityMatch[0];
                        }
                    }
                    
                    const product = {
                        name: String(name).trim(),
                        spec: spec,
                        price: priceIndex !== -1 ? parseFloat(String(row[priceIndex] || '')) : null,
                        priceType: '含税顺丰代发价',
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

async function readMarketPrices() {
    const csvFiles = fs.readdirSync(MARKET_FOLDER).filter(f => f.endsWith('.csv'));
    const allProducts = [];
    
    for (const file of csvFiles) {
        const filePath = path.join(MARKET_FOLDER, file);
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath, 'utf8')
                .pipe(csv())
                .on('data', (row) => {
                    const titleParts = [];
                    for (let i = 1; i <= 8; i++) {
                        const title = row[`title--ASSt27UY${i > 1 ? ' ' + i : ''}`];
                        if (title) titleParts.push(title);
                    }
                    
                    const title = titleParts.join(' ');
                    
                    let price = null;
                    const priceInt = row['priceInt--yqqZMJ5a'];
                    const priceFloat = row['priceFloat--XpixvyQ1'];
                    
                    if (priceInt) {
                        price = parseFloat(priceInt);
                        if (priceFloat && !isNaN(parseFloat(priceFloat))) {
                            price += parseFloat(priceFloat);
                        }
                    }
                    
                    // 过滤价格过低的商品（可能是配件或小样）
                    if (price && price < 10) return;
                    
                    const spec = row['spec--34i83J61'] || '';
                    const shop = row['shop--1DcK3rXn'] || row['shopName'] || '';
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

function extractBrand(str) {
    const lowerStr = String(str).toLowerCase();
    for (const brand of BRANDS) {
        if (lowerStr.includes(brand.toLowerCase())) {
            return brand;
        }
    }
    return null;
}

function extractProductType(str) {
    const lowerStr = String(str).toLowerCase();
    const types = [];
    for (const type of PRODUCT_TYPES) {
        if (lowerStr.includes(type)) {
            types.push(type);
        }
    }
    return types;
}

function extractCapacity(str) {
    const match = String(str).match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ|支|片|瓶)/i);
    return match ? match[0] : null;
}

function calculateSimilarity(supplierName, marketTitle) {
    const supplierBrand = extractBrand(supplierName);
    const marketBrand = extractBrand(marketTitle);
    
    const supplierTypes = extractProductType(supplierName);
    const marketTypes = extractProductType(marketTitle);
    
    const supplierCapacity = extractCapacity(supplierName);
    const marketCapacity = extractCapacity(marketTitle);
    
    let score = 0;
    let maxScore = 0;
    
    // 品牌匹配（权重最高）
    maxScore += 50;
    if (supplierBrand && marketBrand) {
        if (supplierBrand.toLowerCase() === marketBrand.toLowerCase()) {
            score += 50;
        }
    }
    
    // 产品类型匹配
    maxScore += 30;
    const typeMatches = supplierTypes.filter(t => marketTypes.includes(t)).length;
    if (supplierTypes.length > 0) {
        score += Math.min(30, (typeMatches / supplierTypes.length) * 30);
    }
    
    // 容量匹配
    maxScore += 20;
    if (supplierCapacity && marketCapacity) {
        if (supplierCapacity.toLowerCase() === marketCapacity.toLowerCase()) {
            score += 20;
        } else if (marketTitle.toLowerCase().includes(supplierCapacity.toLowerCase())) {
            score += 10;
        }
    }
    
    // 额外检查：产品名称关键词匹配
    const supplierLower = supplierName.toLowerCase();
    const marketLower = marketTitle.toLowerCase();
    
    const supplierWords = supplierLower.split(/\s+/).filter(w => w.length > 2);
    let wordMatches = 0;
    for (const word of supplierWords) {
        if (marketLower.includes(word)) {
            wordMatches++;
        }
    }
    
    if (supplierWords.length > 0) {
        const wordScore = (wordMatches / supplierWords.length) * 20;
        score = Math.min(100, score + wordScore);
    }
    
    return Math.round(score);
}

function analyzePrices(supplierProducts, marketProducts) {
    const results = [];
    
    for (const supplierProduct of supplierProducts) {
        const fullName = supplierProduct.spec ? supplierProduct.name + ' ' + supplierProduct.spec : supplierProduct.name;
        
        const matches = [];
        
        for (const marketProduct of marketProducts) {
            const similarity = calculateSimilarity(fullName, marketProduct.title);
            
            if (similarity >= 70) {
                matches.push({
                    ...marketProduct,
                    similarity: similarity
                });
            }
        }
        
        matches.sort((a, b) => {
            if (b.similarity !== a.similarity) {
                return b.similarity - a.similarity;
            }
            return a.price - b.price;
        });
        
        const topCandidates = matches.slice(0, 5);
        
        if (topCandidates.length > 0) {
            const prices = topCandidates.map(m => m.price).filter(p => p !== null);
            const minPrice = Math.min(...prices);
            
            let status = '已匹配';
            let priceAdvantage = '';
            
            if (supplierProduct.price !== null && minPrice > 0) {
                const priceDiff = supplierProduct.price - minPrice;
                if (supplierProduct.price < minPrice) {
                    priceAdvantage = `低于市场低价 ${Math.abs(priceDiff).toFixed(0)} 元`;
                } else {
                    priceAdvantage = `高于市场低价 ${priceDiff.toFixed(0)} 元`;
                }
            }
            
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
    
    results.sort((a, b) => {
        if (a.status !== b.status) {
            return a.status === '已匹配' ? -1 : 1;
        }
        if (a.minPrice && b.minPrice) {
            return a.minPrice - b.minPrice;
        }
        return 0;
    });
    
    return results;
}

function saveResults(results) {
    const outputFile = path.join(OUTPUT_FOLDER, '价格优势分析结果_v2.xlsx');
    
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
