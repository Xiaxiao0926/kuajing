const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const config = require('./config');

const BASE_PATH = config.BASE_PATH;
const MARKET_FOLDER = config.MARKET_FOLDER;
const CLEANED_FILE = config.CLEANED_FILE;

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
    '拉图嘉利', '贝玛格雷', '腾塔堡', '侯伯王', '力士金', '宝嘉龙', '雄狮', '玫瑰酒庄',
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

const PRODUCT_TYPES = ['卸妆油', '洁面', '洗面奶', '洁颜油', '面霜', '乳液', '精华', '次抛精华',
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
                       '礼盒装', '罐装', '瓶装', '箱装', '注心', '夹心',
                       '发酵饼干', '苏打脆', '心心圈', '软曲奇', '摩天轮'];

const SERIES_KEYWORDS = ['金盏花', '菁纯', '小黑瓶', '红腰子', '神仙水', '黑绷带', '绿宝瓶', '蓝胖子',
                         '小白管', '小蜜罐', '小金瓶', '小金条', '双萃', '红宝石', '双抗', '色修',
                         '持妆', '权力', '金钻', '经典', '精萃水', '琥珀', '臻萃', '高保湿', '胶原',
                         '玻色因', '视黄醇', '烟酰胺', '虾青素', '水杨酸', '果酸', '氨基酸', '神经酰胺',
                         '角鲨烷', '透明质酸', '植物精萃', '植物精粹', '祛痘控油', '修护', '焕肤',
                         '紧致', '美白', '控油', '抗皱', '淡斑', '祛痘', '舒缓', '滋养', '提亮', '补水',
                         '玻尿酸', '维他命', '重蛋白', '次抛'];

const PROMO_PATTERNS = [
    /直播专属/i, /限时/i, /特惠/i, /生日礼物/i, /【[^】]*】/g,
    /赠品/i, /买\d+送\d+/i, /满\d+减\d+/i, /秒杀/i, /爆款/i,
    /特价/i, /优惠/i, /折扣/i, /立减/i, /直降/i, /补贴/i
];

const UNIT_WORDS = new Set(['支', '片', '瓶', '盒', '组', '件', '罐', '袋', '包', '条', '块', '套', '册', '排', '张', '贴']);

const CAPACITY_UNIT_SET = new Set(['ml', 'mL', 'ML', 'g', 'G', 'oz', 'OZ', 'fl.oz', 'FL.OZ']);

function classifyFieldContent(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return { type: 'empty', value: '' };
    }

    const str = String(value).trim();

    for (const brand of BRANDS) {
        if (str.toLowerCase() === brand.toLowerCase()) {
            return { type: 'brand', value: brand };
        }
    }

    for (const type of PRODUCT_TYPES) {
        if (str === type) {
            return { type: 'product_type', value: type };
        }
    }

    if (/^\d+(\.\d+)?\s*(ml|mL|ML|g|G|oz|OZ|fl\.oz|FL\.OZ)$/i.test(str)) {
        return { type: 'capacity', value: str };
    }

    if (/^\d+(\.\d+)?\s*(支|片|瓶|盒|组|件|罐|袋|包|条|块|套|册|双|对|排|张|贴)$/.test(str)) {
        return { type: 'quantity', value: str };
    }

    if (/^\d+(\.\d+)?$/.test(str)) {
        return { type: 'number', value: str };
    }

    if (UNIT_WORDS.has(str)) {
        return { type: 'unit', value: str };
    }

    const series = extractSeries(str);
    if (series && str === series) {
        return { type: 'series', value: series };
    }

    for (const pattern of PROMO_PATTERNS) {
        const testPattern = new RegExp(pattern.source, pattern.flags);
        if (testPattern.test(str)) {
            return { type: 'promo', value: str };
        }
    }

    if (str.length > 8) {
        return { type: 'mixed', value: str };
    }

    return { type: 'descriptor', value: str };
}

function extractSeries(text) {
    if (!text) return '';
    const str = String(text);
    for (const keyword of SERIES_KEYWORDS) {
        if (str.includes(keyword)) {
            return keyword;
        }
    }
    return '';
}

function removePromoContent(text) {
    if (!text) return '';
    let cleaned = String(text);
    for (const pattern of PROMO_PATTERNS) {
        cleaned = cleaned.replace(new RegExp(pattern.source, pattern.flags), '');
    }
    return cleaned.replace(/\s+/g, ' ').trim();
}

function extractBrand(title) {
    const lowerTitle = String(title).toLowerCase();
    const compactTitle = lowerTitle.replace(/\s+/g, '');
    let bestMatch = '';
    let bestLength = 0;
    for (const brand of BRANDS) {
        const lowerBrand = brand.toLowerCase();
        if ((lowerTitle.includes(lowerBrand) || compactTitle.includes(lowerBrand)) && lowerBrand.length > bestLength) {
            bestMatch = brand;
            bestLength = lowerBrand.length;
        }
    }
    return bestMatch;
}

function extractProductType(title) {
    const lowerTitle = String(title).toLowerCase();
    const compactTitle = lowerTitle.replace(/\s+/g, '');
    const types = [];
    for (const type of PRODUCT_TYPES) {
        if (lowerTitle.includes(type) || compactTitle.includes(type)) {
            types.push(type);
        }
    }
    return types.join('|') || '';
}

function extractCapacity(title) {
    const s = String(title);
    const compactS = s.replace(/\s+/g, '');
    // 优先匹配带斜杠的容量（如 72g/盒、330ml/瓶）
    const matchWithSlash = compactS.match(/(\d+(?:\.\d+)?)\s*(ml|mL|ML|g|G|oz|OZ)\s*[\/\\]\s*(盒|瓶|罐|袋|包|支|件)/i);
    if (matchWithSlash) return matchWithSlash[0];
    // 匹配紧密连接的容量+包装（如 72g盒、330ml瓶）
    const matchWithPack = compactS.match(/(\d+(?:\.\d+)?)\s*(ml|mL|ML|g|G|oz|OZ)\s*(盒|瓶|罐|袋|包|支|件)/i);
    if (matchWithPack) return matchWithPack[1] + matchWithPack[2] + '/' + matchWithPack[3];
    // 只匹配重量/体积单位
    const match = compactS.match(/(\d+(?:\.\d+)?)\s*(ml|mL|ML|g|G|oz|OZ)(?![\/\\0-9])/i);
    return match ? match[0] : '';
}

function detectCsvType(headers) {
    if (headers.some(h => h.includes('title--ASSt27UY'))) return 'taobao';
    if (headers.some(h => h.includes('_newStyle_1k2fi')) || headers.some(h => h.includes('skcolor_ljg'))) return 'jd';
    if (headers.some(h => h.includes('goods-title')) && headers.some(h => h.includes('pricenum'))) return 'youzan';
    return 'unknown';
}

function smartCombineTaobaoFields(row) {
    // 动态发现所有title子字段，兼容两种命名格式：
    // 旧格式: title--ASSt27UY 2, title--ASSt27UY 3 (空格+数字)
    // 新格式: title--ASSt27UY (2), title--ASSt27UY (3) (空格+括号+数字)
    let subFields = [];
    const titleBase = 'title--ASSt27UY';
    const titleKeys = Object.keys(row)
        .filter(k => k === titleBase || k.startsWith(titleBase + ' '))
        .sort((a, b) => {
            if (a === titleBase) return -1;
            if (b === titleBase) return 1;
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
        });

    for (const key of titleKeys) {
        const val = row[key];
        if (val && String(val).trim()) {
            subFields.push(String(val).trim());
        }
    }

    // 保留原始完整标题（所有子字段直接拼接，不拆分不去重）
    let rawFullTitle = subFields.join('');

    let classified = subFields.map(v => classifyFieldContent(v));

    let merged = [];
    for (let i = 0; i < classified.length; i++) {
        // 数字+单位 → 数量（如 "6" + "瓶" → "6瓶"）
        if (classified[i].type === 'number' && i + 1 < classified.length && classified[i + 1].type === 'unit') {
            merged.push({ type: 'quantity', value: classified[i].value + classified[i + 1].value });
            i++;
        }
        // 容量+单位 → 容量带包装（如 "72g" + "盒" → "72g/盒"）
        else if (classified[i].type === 'capacity' && i + 1 < classified.length && classified[i + 1].type === 'unit') {
            merged.push({ type: 'capacity', value: classified[i].value + '/' + classified[i + 1].value });
            i++;
        }
        else {
            merged.push(classified[i]);
        }
    }

    let brand = '';
    let productType = '';
    let capacity = '';
    let series = '';
    let quantity = '';
    let descriptors = [];
    let promoParts = [];
    let allParts = [];

    for (const item of merged) {
        switch (item.type) {
            case 'brand':
                if (!brand) brand = item.value;
                allParts.push(item.value);
                break;
            case 'product_type':
                if (!productType) productType = item.value;
                else productType += '|' + item.value;
                allParts.push(item.value);
                break;
            case 'capacity':
                if (!capacity) capacity = item.value;
                allParts.push(item.value);
                break;
            case 'quantity':
                if (!quantity) quantity = item.value;
                allParts.push(item.value);
                break;
            case 'series':
                if (!series) series = item.value;
                allParts.push(item.value);
                break;
            case 'promo':
                promoParts.push(item.value);
                break;
            case 'mixed':
                if (!brand) {
                    const b = extractBrand(item.value);
                    if (b) brand = b;
                }
                if (!productType) {
                    const pt = extractProductType(item.value);
                    if (pt) productType = pt;
                }
                if (!capacity) {
                    const cap = extractCapacity(item.value);
                    if (cap) capacity = cap;
                }
                if (!series) {
                    const s = extractSeries(item.value);
                    if (s) series = s;
                }
                allParts.push(item.value);
                break;
            case 'descriptor':
                descriptors.push(item.value);
                allParts.push(item.value);
                break;
            case 'number':
            case 'unit':
                allParts.push(item.value);
                break;
            default:
                break;
        }
    }

    let originalTitle = allParts.join(' ');

    if (!rawFullTitle) {
        rawFullTitle = row['title'] || row['productName'] || '';
    }
    if (!originalTitle) {
        originalTitle = row['title'] || row['productName'] || '';
    }

    const spec = row['spec--34i83J61'] || row['spec'] || row['规格'] || '';
    const shop = row['shopNameText--DmtlsDKm'] || row['shop--1DcK3rXn'] || row['shopName'] || row['shop'] || '';
    const link = row['doubleCardWrapperAdapt--mEcC7olq href'] || row['link--2k6K5l6D'] || row['detailUrl'] || row['url'] || '';
    const productName = row['productName'] || row['name'] || row['product_name'] || '';
    const description = row['description'] || row['desc'] || row['detail'] || '';

    // 将 productName 也拼入 rawFullTitle，保持完整信息
    if (productName && String(productName).trim() && !rawFullTitle.includes(String(productName).trim())) {
        rawFullTitle = String(productName).trim() + rawFullTitle;
    }

    let priceInt = parseFloat(row['priceInt--yqqZMJ5a']) || 0;
    let priceFloat = parseFloat(row['priceFloat--XpixvyQ1']) || 0;
    let price = priceInt + priceFloat;

    if (!brand) brand = extractBrand(productName);
    if (!productType) productType = extractProductType(productName);
    if (!capacity) capacity = extractCapacity(productName) || extractCapacity(spec);
    if (!series) series = extractSeries(productName);

    let cleanTitleParts = [];
    if (brand) cleanTitleParts.push(brand);
    if (series) cleanTitleParts.push(series);
    if (productType) cleanTitleParts.push(productType);
    if (capacity) cleanTitleParts.push(capacity);
    if (quantity) cleanTitleParts.push(quantity);
    for (const d of descriptors) {
        if (!cleanTitleParts.includes(d)) cleanTitleParts.push(d);
    }

    let cleanTitle = cleanTitleParts.join(' ');
    if (spec && !cleanTitle.includes(spec)) {
        cleanTitle += ' ' + spec;
    }
    if (productName && !cleanTitle.includes(productName)) {
        cleanTitle = productName + ' ' + cleanTitle;
    }

    return {
        title: rawFullTitle || cleanTitle.trim(),
        price: price > 0 ? price : null,
        spec: String(spec).trim(),
        shop: String(shop).trim(),
        link: String(link).trim(),
        productName: String(productName).trim(),
        description: String(description).trim(),
        source: 'taobao',
        brand: brand,
        product_type: productType,
        capacity: capacity,
        series: series,
        quantity: quantity,
        original_title: rawFullTitle || originalTitle
    };
}

function smartCombineYouzanFields(row) {
    const title = row['goods-title'] || '';
    const priceStr = row['pricenum'] || '';
    const priceMatch = String(priceStr).match(/[\d.]+/);
    const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
    const link = row['image-area href'] || '';

    const brand = extractBrand(title);
    const productType = extractProductType(title);
    const capacity = extractCapacity(title);
    const series = extractSeries(title);

    return {
        title: title,
        price: price > 0 ? price : null,
        spec: capacity || '',
        shop: '有赞',
        link: String(link).trim(),
        productName: '',
        description: '',
        source: 'youzan',
        brand: brand,
        product_type: productType,
        capacity: capacity,
        series: series,
        quantity: '',
        original_title: title
    };
}

function smartCombineJdFields(row) {
    let mainTitle = row['_newStyle_1k2fi_39'] || '';

    // 动态发现所有skcolor子字段，兼容两种命名格式
    let skcolorParts = [];
    const skcolorBase = 'skcolor_ljg';
    const skcolorKeys = Object.keys(row)
        .filter(k => k === skcolorBase || k.startsWith(skcolorBase + ' '))
        .sort((a, b) => {
            if (a === skcolorBase) return -1;
            if (b === skcolorBase) return 1;
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
        });

    for (const key of skcolorKeys) {
        const val = row[key];
        if (val && String(val).trim()) {
            skcolorParts.push(String(val).trim());
        }
    }

    // 保留原始完整标题（主标题+所有子字段直接拼接，不拆分不去重）
    let rawFullTitle = String(mainTitle).trim();
    if (skcolorParts.length > 0) {
        rawFullTitle = rawFullTitle + skcolorParts.join('');
    }

    let classified = skcolorParts.map(v => classifyFieldContent(v));

    let merged = [];
    for (let i = 0; i < classified.length; i++) {
        // 数字+单位 → 数量（如 "6" + "瓶" → "6瓶"）
        if (classified[i].type === 'number' && i + 1 < classified.length && classified[i + 1].type === 'unit') {
            merged.push({ type: 'quantity', value: classified[i].value + classified[i + 1].value });
            i++;
        }
        // 容量+单位 → 容量带包装（如 "72g" + "盒" → "72g/盒"）
        else if (classified[i].type === 'capacity' && i + 1 < classified.length && classified[i + 1].type === 'unit') {
            merged.push({ type: 'capacity', value: classified[i].value + '/' + classified[i + 1].value });
            i++;
        }
        else {
            merged.push(classified[i]);
        }
    }

    let brand = '';
    let productType = '';
    let capacity = '';
    let series = '';
    let quantity = '';
    let descriptors = [];
    let promoParts = [];
    let allParts = [];

    for (const item of merged) {
        switch (item.type) {
            case 'brand':
                if (!brand) brand = item.value;
                allParts.push(item.value);
                break;
            case 'product_type':
                if (!productType) productType = item.value;
                else productType += '|' + item.value;
                allParts.push(item.value);
                break;
            case 'capacity':
                if (!capacity) capacity = item.value;
                allParts.push(item.value);
                break;
            case 'quantity':
                if (!quantity) quantity = item.value;
                allParts.push(item.value);
                break;
            case 'series':
                if (!series) series = item.value;
                allParts.push(item.value);
                break;
            case 'promo':
                promoParts.push(item.value);
                break;
            case 'mixed':
                if (!brand) {
                    const b = extractBrand(item.value);
                    if (b) brand = b;
                }
                if (!productType) {
                    const pt = extractProductType(item.value);
                    if (pt) productType = pt;
                }
                if (!capacity) {
                    const cap = extractCapacity(item.value);
                    if (cap) capacity = cap;
                }
                if (!series) {
                    const s = extractSeries(item.value);
                    if (s) series = s;
                }
                allParts.push(item.value);
                break;
            case 'descriptor':
                descriptors.push(item.value);
                allParts.push(item.value);
                break;
            case 'number':
            case 'unit':
                allParts.push(item.value);
                break;
            default:
                break;
        }
    }

    if (mainTitle) {
        const mainStr = String(mainTitle).trim();
        if (!brand) {
            const b = extractBrand(mainStr);
            if (b) brand = b;
        }
        if (!productType) {
            const pt = extractProductType(mainStr);
            if (pt) productType = pt;
        }
        if (!capacity) {
            const cap = extractCapacity(mainStr);
            if (cap) capacity = cap;
        }
        if (!series) {
            const s = extractSeries(mainStr);
            if (s) series = s;
        }
    }

    let originalTitle = allParts.join(' ');
    if (mainTitle && !originalTitle.includes(String(mainTitle).trim())) {
        originalTitle = String(mainTitle).trim() + ' ' + originalTitle;
    }

    // rawFullTitle 优先使用原始拼接标题
    if (!rawFullTitle) {
        rawFullTitle = originalTitle;
    }

    let priceMain = parseFloat(row['_price_65r2s_22']) || 0;
    let priceDecimal = parseFloat(row['_decimal_65r2s_36']) || 0;
    let price = priceMain + priceDecimal / 100;

    if (price <= 0 && priceMain > 0) {
        price = priceMain;
    }

    const shop = row['_limit_zclqt_23'] || '';
    const link = row['_newIcon_zclqt_32 href'] || '';
    const subsidy = row['_subsidy_65r2s_58'] || '';
    const grayPrice = row['_gray_65r2s_69'] || '';
    const isAd = row['_ad_o085i_81'] === '广告';

    let cleanTitleParts = [];
    if (brand) cleanTitleParts.push(brand);
    if (series) cleanTitleParts.push(series);
    if (productType) cleanTitleParts.push(productType);
    if (capacity) cleanTitleParts.push(capacity);
    if (quantity) cleanTitleParts.push(quantity);
    for (const d of descriptors) {
        if (!cleanTitleParts.includes(d)) cleanTitleParts.push(d);
    }

    let cleanTitle = cleanTitleParts.join(' ');
    if (mainTitle && !cleanTitle.includes(String(mainTitle).trim())) {
        cleanTitle = String(mainTitle).trim() + ' ' + cleanTitle;
    }

    return {
        title: rawFullTitle || cleanTitle.trim(),
        price: price > 0 ? price : null,
        spec: '',
        shop: String(shop).trim(),
        link: String(link).trim(),
        productName: '',
        description: subsidy ? '补贴:' + subsidy : '',
        source: 'jd',
        brand: brand,
        product_type: productType,
        capacity: capacity,
        series: series,
        quantity: quantity,
        original_title: rawFullTitle || originalTitle.trim(),
        isAd: isAd,
        grayPrice: grayPrice ? parseFloat(grayPrice.replace(/[^\d.]/g, '')) || 0 : 0
    };
}

function cleanTitle(title) {
    if (!title) return '';
    let cleaned = String(title);
    // 去除特殊字符但保留中文、英文、数字、空格、括号、斜杠、点
    cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s()（）\-\.\/\\mlgMLozOZ]/g, ' ');
    // 合并多余空格
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

async function processCsvFile(filePath) {
    const records = [];
    const fileName = path.basename(filePath);

    return new Promise((resolve, reject) => {
        let csvType = null;
        let headers = [];

        fs.createReadStream(filePath, 'utf8')
            .pipe(csv())
            .on('headers', (h) => {
                headers = h;
                csvType = detectCsvType(h);
            })
            .on('data', (row) => {
                let combined;

                if (csvType === 'taobao') {
                    combined = smartCombineTaobaoFields(row);
                } else if (csvType === 'jd') {
                    combined = smartCombineJdFields(row);
                } else if (csvType === 'youzan') {
                    combined = smartCombineYouzanFields(row);
                } else {
                    return;
                }

                let title = cleanTitle(combined.title);
                if (title.length < 3) return;
                if (!combined.price) return;

                let brand = combined.brand;
                if (!brand) brand = extractBrand(title) || extractBrand(combined.productName);

                let productType = combined.product_type;
                if (!productType) productType = extractProductType(title) || extractProductType(combined.productName);

                let spec = combined.spec;
                if (!spec) {
                    spec = extractCapacity(title);
                }

                let capacity = combined.capacity;
                if (!capacity) {
                    capacity = extractCapacity(title) || extractCapacity(combined.productName);
                }

                records.push({
                    source_file: fileName,
                    title: title,
                    price: combined.price,
                    spec: spec,
                    shop: combined.shop,
                    link: combined.link,
                    brand: brand,
                    product_type: productType,
                    capacity: capacity,
                    series: combined.series || '',
                    quantity: combined.quantity || '',
                    original_title: combined.original_title,
                    product_name: combined.productName,
                    description: combined.description,
                    source_platform: combined.source,
                    is_ad: combined.isAd || false,
                    gray_price: combined.grayPrice || 0
                });
            })
            .on('end', () => resolve(records))
            .on('error', reject);
    });
}

async function cleanAllMarketData(incremental = false) {
    console.log(`开始清洗市场价数据（支持淘宝+京东+有赞格式）${incremental ? ' [增量模式]' : ''}...`);

    // 收集市场价文件夹中的CSV文件（报价表CSV已作为供应商报价处理，不再作为市场价）
    let csvFiles = fs.readdirSync(MARKET_FOLDER).filter(f => f.endsWith('.csv')).map(f => ({ name: f, folder: MARKET_FOLDER }));
    console.log(`发现 ${csvFiles.length} 个市场价CSV文件`);

    // 增量模式：读取已有清洗数据，找出已处理的文件
    let existingRecords = [];
    const processedFiles = new Set();
    if (incremental && fs.existsSync(CLEANED_FILE)) {
        try {
            const wb = xlsx.readFile(CLEANED_FILE);
            const ws = wb.Sheets[wb.SheetNames[0]];
            existingRecords = xlsx.utils.sheet_to_json(ws).map(row => ({
                source_file: row['来源文件'] || '',
                title: row['标题'] || '',
                price: row['价格'],
                spec: row['规格'] || '',
                shop: row['店铺'] || '',
                link: row['链接'] || '',
                brand: row['品牌'] || '',
                product_type: row['产品类型'] || '',
                capacity: row['容量'] || '',
                series: row['系列'] || '',
                quantity: row['数量'] || '',
                original_title: row['原始标题'] || '',
                product_name: row['产品名'] || '',
                description: row['描述'] || '',
                source_platform: row['数据来源'] || '',
                is_ad: row['是否广告'] === '是',
                gray_price: row['划线价'] || 0
            }));
            existingRecords.forEach(r => { if (r.source_file) processedFiles.add(r.source_file); });
            console.log(`已有 ${existingRecords.length} 条清洗数据，来自 ${processedFiles.size} 个文件`);
        } catch (e) {
            console.log('读取已有清洗数据失败，将全量重新清洗');
            existingRecords = [];
        }
    }

    // 筛选需要处理的新文件
    const filesToProcess = incremental
        ? csvFiles.filter(f => !processedFiles.has(f.name))
        : csvFiles;

    if (incremental && filesToProcess.length === 0) {
        console.log('没有新增文件需要清洗');
        return existingRecords;
    }

    if (incremental) {
        console.log(`新增 ${filesToProcess.length} 个文件需要清洗`);
    }

    const newRecords = [];
    let taobaoCount = 0, jdCount = 0, youzanCount = 0, failedCount = 0;

    for (const fileInfo of filesToProcess) {
        const filePath = path.join(fileInfo.folder, fileInfo.name);
        try {
            const records = await processCsvFile(filePath);
            if (records.length > 0) {
                const platform = records[0].source_platform;
                if (platform === 'taobao') taobaoCount++;
                else if (platform === 'jd') jdCount++;
                else if (platform === 'youzan') youzanCount++;
                console.log(`  ${fileInfo.name}: ${records.length}条 (${platform})`);
            } else {
                failedCount++;
            }
            newRecords.push(...records);
        } catch (error) {
            console.error(`  ${fileInfo.name} 处理失败: ${error.message}`);
            failedCount++;
        }
    }

    // 合并已有数据和新数据
    const allRecords = incremental ? [...existingRecords, ...newRecords] : newRecords;

    console.log(`\n清洗完成！新增 ${newRecords.length} 条，总计 ${allRecords.length} 条有效记录`);
    if (incremental) {
        console.log(`  新增淘宝数据文件: ${taobaoCount}个`);
        console.log(`  新增京东数据文件: ${jdCount}个`);
        console.log(`  新增有赞数据文件: ${youzanCount}个`);
    } else {
        console.log(`  淘宝数据文件: ${taobaoCount}个`);
        console.log(`  京东数据文件: ${jdCount}个`);
        console.log(`  有赞数据文件: ${youzanCount}个`);
    }
    console.log(`  失败/空文件: ${failedCount}个`);

    const uniqueRecords = [];
    const seen = new Set();
    for (const record of allRecords) {
        const key = `${record.title}||${record.price}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueRecords.push(record);
        }
    }

    console.log(`去重后剩余 ${uniqueRecords.length} 条记录`);

    saveToExcel(uniqueRecords);
    return uniqueRecords;
}

function saveToExcel(records) {
    const wsData = [
        ['来源文件', '标题', '价格', '规格', '店铺', '链接', '品牌', '产品类型', '容量', '系列', '数量', '原始标题', '产品名', '描述', '数据来源', '是否广告', '划线价']
    ];

    for (const record of records) {
        wsData.push([
            record.source_file,
            record.title,
            record.price,
            record.spec,
            record.shop,
            record.link,
            record.brand,
            record.product_type,
            record.capacity,
            record.series,
            record.quantity,
            record.original_title,
            record.product_name,
            record.description,
            record.source_platform,
            record.is_ad ? '是' : '',
            record.gray_price || ''
        ]);
    }

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, '清洗数据');
    xlsx.writeFile(wb, CLEANED_FILE);
    console.log(`数据已保存到: ${CLEANED_FILE}`);
}

if (require.main === module) {
    const incremental = process.argv.includes('--incremental');
    cleanAllMarketData(incremental)
        .then(records => {
            console.log(`\n最终统计:`);
            console.log(`- 总记录数: ${records.length}`);

            const platformCount = {};
            const brandCount = {};
            records.forEach(r => {
                platformCount[r.source_platform] = (platformCount[r.source_platform] || 0) + 1;
                if (r.brand) brandCount[r.brand] = (brandCount[r.brand] || 0) + 1;
            });
            console.log(`\n平台分布:`);
            Object.entries(platformCount).forEach(([p, c]) => console.log(`  ${p}: ${c}条`));
            console.log(`\n品牌分布 (前15):`);
            Object.entries(brandCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .forEach(([brand, count]) => console.log(`  ${brand}: ${count}条`));
        })
        .catch(console.error);
}

module.exports = { cleanAllMarketData, processCsvFile };
