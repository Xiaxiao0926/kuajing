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
                '娇韵诗', 'Clarins', '雪花秀', 'Sulwhasoo', 'Whoo', '后', '欧舒丹', 'Loccitane',
                'POLA', '宝丽', '黛珂', 'Decorte', 'CPB', '肌肤之钥', '茵芙莎', 'IPSA',
                '悦木之源', 'Origins', '科颜氏', 'Kiehls', '倩碧', 'Clinique', '雅顿', 'Elizabeth Arden',
                '玉兰油', 'OLAY', '薇诺娜', '玉泽', '百雀羚', '自然堂', '珀莱雅'];

const PRODUCT_TYPES = ['卸妆油', '洁面', '洗面奶', '洁颜油', '面霜', '乳液', '精华', '次抛精华',
                       '爽肤水', '化妆水', '面膜', '眼霜', '粉底', '口红', '唇膏', '防晒',
                       '护手霜', '身体乳', '香水', '精华液', '肌底液', '气垫', '散粉', '睫毛膏'];

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
                    
                    const priceStr = String(row[priceIndex] || '').replace(',', '');
                    const price = parseFloat(priceStr);
                    
                    const product = {
                        name: String(name).trim(),
                        spec: spec,
                        price: price,
                        priceType: '含税顺丰代发价',
                        sourceFile: file,
                        sourceSheet: sheetName
                    };
                    
                    if (product.name && product.price > 0) {
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
                    
                    // 过滤价格过低的商品（可能是配件、小样或假货）
                    if (price && price < 50) return;
                    
                    // 过滤价格过高的异常商品
                    if (price && price > 10000) return;
                    
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
    
    // 品牌匹配（权重最高）
    if (supplierBrand && marketBrand) {
        if (supplierBrand.toLowerCase() === marketBrand.toLowerCase()) {
            score += 60;
        }
    }
    
    // 产品类型匹配
    const typeMatches = supplierTypes.filter(t => marketTypes.includes(t)).length;
    if (supplierTypes.length > 0) {
        score += Math.min(25, (typeMatches / supplierTypes.length) * 25);
    }
    
    // 容量匹配
    if (supplierCapacity && marketCapacity) {
        if (supplierCapacity.toLowerCase() === marketCapacity.toLowerCase()) {
            score += 15;
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
            
            if (similarity >= 60) {
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
            const prices = topCandidates.map(m => m.price).filter(p => p !== null && p >