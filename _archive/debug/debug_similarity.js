const { readSupplierQuotes, loadCleanedMarketData } = require('./analyze_with_cleaned_data');

const suppliers = readSupplierQuotes();
const market = loadCleanedMarketData();

const BRANDS = ['植村秀', 'Shu-uemura', 'shu uemura', '芙丽芳丝', 'Freeplus', '润百颜',
    '欧莱雅', 'Loreal', '雅诗兰黛', 'Estee Lauder', 'SK-II', 'SK2', '兰蔻', 'Lancome',
    '资生堂', 'Shiseido', '娇兰', 'Guerlain', '迪奥', 'Dior', '香奈儿', 'Chanel',
    '海蓝之谜', 'La Mer', '赫莲娜', 'HR', 'YSL', '圣罗兰', '纪梵希', 'Givenchy',
    '娇韵诗', 'Clarins', '雪花秀', 'Sulwhasoo', 'Whoo', '欧舒丹', 'Loccitane',
    '科颜氏', 'Kiehls', '兰芝', 'Innisfree', '城野医生', '可复美', '百雀羚',
    '自然堂', '珀莱雅', '薇诺娜', '修丽可', '理肤泉', '雅漾', '薇姿',
    '阿玛尼', 'Armani', '安热沙', 'ANESSA', '安耐晒',
    '黛珂', 'Decorte', 'HBN', 'NARS', '柏瑞美', 'Primera', '3CE', 'Stylenanda',
    'MAC', '花西子', '完美日记', '卡姿兰', '韩束', '丸美', '相宜本草',
    '溪木源', '逐本', '瑷尔博士', '至本', '谷雨', '且初', 'KATO',
    '稀物集', '橘朵', '悦木之源', 'Origins', '汤姆福特', 'TomFord',
    '宝格丽', 'Bvlgari', '蒂佳婷', 'Dr.Jart', 'CPB', '肌肤之钥',
    '彩棠', 'Timage', '毛戈平', '尔木萄', 'AMORTALS',
    '拉菲', '拉图', '玛歌', '木桐', '奥比昂', '罗曼尼康帝', '柏图斯', '奔富', 'Penfolds',
    '贝玛格雷', '腾塔堡', '侯伯王', '力士金', '宝嘉龙', '雄狮', '玫瑰酒庄',
    '碧尚女爵', '碧尚男爵', '杜霍', '鲁臣世家', '露仙歌', '爱诗图尔', '爱士图尔',
    '美人鱼', '宝马酒庄', '凯隆世家', '迪仙', '费里埃', '力关', '肯德布朗',
    '大宝酒庄', '周伯通', '杜哈米隆', '龙船', '荔仙', '杜卡斯', '杜萨克',
    '拉芳罗谢', '佳得美', '杜扎克', '达玛雅克', '庞特卡奈', '歌碧',
    '靓次伯', '克拉米伦', '百德诗歌', '柏菲', '西施佳雅', '索拉雅',
    '奥纳亚', '嘉雅', '啸鹰', '作品一号', 'Opus', '活灵魂',
    '伊拉苏', '普拉纳', '维瓦尔第', '卡塞洛', '阔穆拉特', '雅斯彼特',
    '希梵', '红蔓', '力关轩', '芳宝', '克莱蒙', '史密斯', '碧加侯爵',
    '贝卡塔纳', '拉拉贡', '卡门萨', '格调人生',
    '张裕', '长城', '五粮液', '茅台', '洋河', '泸州老窖',
    '皇冠', '罗玛', '尖派', '泰象', '依云', '巴黎水', 'Perrier',
    '东方树叶', '水溶C100', '茶π', '维他命水', '华洋', '东鹏',
    '果之茶', '喜茶', '可口可乐', '雪碧', '星巴克', 'Starbucks',
    '景田', '百岁山', '昆仑山', '农夫山泉', '脉动', '怡宝'];

const ALL_PRODUCT_TYPES = [
    '卸妆油', '洁面', '洗面奶', '洁颜油', '面霜', '乳液', '精华', '次抛精华',
    '爽肤水', '化妆水', '面膜', '眼霜', '粉底', '粉底液', '口红', '唇膏', '防晒',
    '护手霜', '身体乳', '香水', '精华液', '肌底液', '气垫', '粉饼', '散粉',
    '睫毛膏', '眼影', '腮红', '眉笔', '遮瑕', '卸妆水', '卸妆乳', '洁颜蜜',
    '红酒', '葡萄酒', '干红', '干白', '香槟', '起泡酒', '白酒', '洋酒',
    '饮料', '果汁', '汽水', '可乐', '雪碧', '矿泉水', '咖啡', '奶茶', '茶饮',
    '零食', '饼干', '薯片', '糖果', '巧克力', '坚果', '方便面',
    '防晒霜', '防晒乳', '精华露', '护肤精华露', '洁面乳', '洁面慕斯',
    '红葡萄酒', '白葡萄酒', '桃红葡萄酒', '起泡葡萄酒', '波特酒',
    '曲奇', '苏打水', '纯净水', '电解质饮料', '功能饮料',
    '红茶', '绿茶', '乌龙茶', '茉莉花茶', '椰子水',
    '柠檬味', '柑橘味', '蜜桃味', '荔枝味', '橙子味', '凤梨味',
    '白桃味', '芭乐味', '黑加仑', '蔓越莓', '青提', '卡曼橘',
    '礼盒装', '罐装', '瓶装', '箱装'
];

function extractBrand(str) {
    const lowerStr = String(str).toLowerCase();
    for (const brand of BRANDS) {
        if (lowerStr.includes(brand.toLowerCase())) return brand;
    }
    return null;
}

function extractProductType(str) {
    const lowerStr = String(str).toLowerCase();
    return ALL_PRODUCT_TYPES.filter(kw => lowerStr.includes(kw));
}

function extractCapacity(str) {
    const match = String(str).match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ|支|片|瓶|件|盒)/i);
    return match ? match[0] : null;
}

function getCapacityNumber(capacity) {
    if (!capacity) return null;
    const match = String(capacity).match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
}

const PRODUCT_SYNONYMS = {
    '持妆粉底液': ['粉底液', '持妆', '粉底'],
    '粉底液': ['持妆粉底液', '粉底', '底妆'],
    '洁面': ['洗面奶', '洁面乳', '洁面慕斯', '洁颜油', '洁颜蜜'],
    '洗面奶': ['洁面', '洁面乳', '洁面慕斯'],
    '爽肤水': ['化妆水', '精萃水', '湿敷水'],
    '化妆水': ['爽肤水', '精萃水'],
    '精华液': ['精华', '肌底液', '次抛精华', '精华露'],
    '精华': ['精华液', '肌底液', '次抛精华'],
    '面霜': ['乳霜', '面霜乳', '经典面霜'],
    '防晒': ['防晒霜', '防晒乳', '防晒液'],
    '口红': ['唇膏', '唇釉'],
    '唇膏': ['口红', '唇釉'],
    '卸妆油': ['洁颜油', '卸妆'],
    '卸妆水': ['卸妆乳', '卸妆'],
    '身体乳': ['身体霜', '润肤乳'],
    '红酒': ['葡萄酒', '干红'],
    '葡萄酒': ['红酒', '干红', '干白'],
};

function isSynonymMatch(supplierTypes, marketTypes) {
    for (const sType of supplierTypes) {
        if (marketTypes.includes(sType)) return 'exact';
        const synonyms = PRODUCT_SYNONYMS[sType];
        if (synonyms) {
            for (const synonym of synonyms) {
                if (marketTypes.includes(synonym)) return 'synonym';
            }
        }
    }
    for (const mType of marketTypes) {
        const synonyms = PRODUCT_SYNONYMS[mType];
        if (synonyms) {
            for (const synonym of synonyms) {
                if (supplierTypes.includes(synonym)) return 'synonym';
            }
        }
    }
    return 'none';
}

const SUSPICIOUS_SHOP_KEYWORDS = ['二手', '回收', '拍拍', '闲鱼', '微瑕', '清仓', '临期',
                                   '保税', '直邮', '代购', '工作室', '买手店', '个人护理',
                                   '小店', '专营店', '拼购', '海淘'];
const TRUSTED_SHOP_KEYWORDS = ['自营', '旗舰店', '官方', '会员店', '沃尔玛'];

function isSuspiciousShop(shopName) {
    if (!shopName) return false;
    const lowerShop = String(shopName).toLowerCase();
    if (TRUSTED_SHOP_KEYWORDS.some(kw => lowerShop.includes(kw))) return false;
    return SUSPICIOUS_SHOP_KEYWORDS.some(kw => lowerShop.includes(kw));
}

function calculateSimilarityDebug(supplierProduct, marketItem) {
    const supplierName = supplierProduct.name;
    const supplierSpec = supplierProduct.spec;
    const supplierFull = supplierSpec ? supplierName + ' ' + supplierSpec : supplierName;

    const supplierBrand = supplierProduct.brand || extractBrand(supplierFull);
    const marketBrand = marketItem.brand || extractBrand(marketItem.title);

    const supplierTypes = extractProductType(supplierFull);
    const marketTypes = extractProductType(marketItem.title);

    const supplierCapacity = supplierSpec || extractCapacity(supplierFull);
    const marketCapacity = marketItem.capacity || marketItem.spec || extractCapacity(marketItem.title);

    let score = 0;
    let details = [];

    // Brand
    if (supplierBrand && marketBrand) {
        if (supplierBrand.toLowerCase() === marketBrand.toLowerCase()) {
            score += 35;
            details.push('品牌+35');
        } else {
            details.push('品牌不一致(' + supplierBrand + ' vs ' + marketBrand + ')');
            return { score: 0, details };
        }
    } else if (supplierBrand && !marketBrand) {
        score += 15;
        details.push('市场缺品牌+15');
    } else if (!supplierBrand && !marketBrand) {
        score += 10;
        details.push('都无品牌+10');
    }

    // Type
    const typeMatchResult = isSynonymMatch(supplierTypes, marketTypes);
    if (typeMatchResult === 'exact') {
        score += 25;
        details.push('类型精确+25(' + supplierTypes.join(',') + ' vs ' + marketTypes.join(',') + ')');
    } else if (typeMatchResult === 'synonym') {
        score += 15;
        details.push('类型近义+15');
    } else {
        if (supplierTypes.length > 0 && marketTypes.length > 0) {
            details.push('类型不匹配(' + supplierTypes.join(',') + ' vs ' + marketTypes.join(',') + ')');
            return { score: Math.min(score, 40), details };
        }
        details.push('类型缺失(s=' + supplierTypes.join(',') + ' m=' + marketTypes.join(',') + ')');
    }

    // Capacity
    if (supplierCapacity && marketCapacity) {
        const supplierNum = getCapacityNumber(supplierCapacity);
        const marketNum = getCapacityNumber(marketCapacity);
        if (supplierNum && marketNum) {
            if (Math.abs(supplierNum - marketNum) / Math.max(supplierNum, marketNum) < 0.1) {
                score += 15;
                details.push('容量匹配+15(' + supplierNum + ' vs ' + marketNum + ')');
            } else {
                score += 3;
                details.push('容量不一致+3(' + supplierNum + ' vs ' + marketNum + ')');
            }
        }
    } else if (!supplierCapacity) {
        score += 5;
        details.push('无容量+5');
    } else {
        details.push('一方有容量一方无');
    }

    // Shop
    if (isSuspiciousShop(marketItem.shop)) {
        score -= 5;
        details.push('可疑店铺-5');
    }

    details.push('总分=' + score);
    return { score: Math.max(0, Math.min(110, Math.round(score))), details };
}

// Test specific products
const testProducts = ['西施佳雅', '活灵魂', '龙船', '力士金', '拉图', '美人鱼', '作品一号'];

for (const brand of testProducts) {
    const supplier = suppliers.find(s => s.name.includes(brand));
    if (!supplier) continue;

    console.log('\n========== ' + brand + ' ==========');
    console.log('供应商:', supplier.name, '规格:', supplier.spec, '价格:', supplier.price, '品类:', supplier.category);

    const relevantMarket = market.filter(m => m.title && m.title.includes(brand) && m.price >= 5);

    for (const m of relevantMarket.slice(0, 5)) {
        const result = calculateSimilarityDebug(supplier, m);
        console.log('  价格:' + m.price + ' 分数:' + result.score + '/60 | ' + result.details.join(' | '));
        console.log('    标题: ' + m.title.substring(0, 60));
    }
}
