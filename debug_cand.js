const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const BASE_PATH = 'E:\\Desktop\\坪优报价分析';
const QUOTE_FOLDER = path.join(BASE_PATH, '报价表');
const CLEANED_FILE = path.join(BASE_PATH, '分析结果', '清洗后的市场价数据.xlsx');
const OUTPUT_FOLDER = path.join(BASE_PATH, '分析结果');

const CATEGORY_THRESHOLDS = {
    beauty: { name: '美妆', threshold: 50, strict: true, allowConversion: false },
    luxury_wine: { name: '名庄酒', threshold: 50, strict: true, allowConversion: false },
    beverage: { name: '饮料', threshold: 40, strict: false, allowConversion: true },
    snack: { name: '零食', threshold: 40, strict: false, allowConversion: true },
    wine: { name: '普通酒水', threshold: 45, strict: false, allowConversion: true },
    default: { name: '其他', threshold: 45, strict: false, allowConversion: false }
};

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
    '红酒': ['葡萄酒', '干红', '红葡萄酒'],
    '葡萄酒': ['红酒', '干红', '干白', '红葡萄酒', '白葡萄酒'],
    '红葡萄酒': ['红酒', '干红', '葡萄酒'],
    '干红': ['红酒', '红葡萄酒', '葡萄酒'],
    '干白': ['白葡萄酒', '葡萄酒'],
    '白葡萄酒': ['干白', '葡萄酒'],
    '起泡酒': ['香槟', '起泡葡萄酒'],
    '香槟': ['起泡酒', '起泡葡萄酒'],
};

const MODEL_PATTERNS = [
    { brand: 'DW', regex: /DW\s*(\d{1,2})/i, name: 'DW' },
    { brand: 'YSL', regex: /(?:YSL|圣罗兰)\s*(\d{1,3})/i, name: 'YSL' },
    { brand: '纪梵希', regex: /纪梵希\s*[nN]\s*(\d{1,3})/i, name: 'GivenchyN' },
    { brand: '阿玛尼', regex: /(?:阿玛尼|Armani)\s*[lLlFf]\s*(\d{1,3})/i, name: 'ArmaniLF' },
    { brand: 'MAC', regex: /MAC\s+(\w+)/i, name: 'MAC' },
    { regex: /[1-9]\d*[wW]\d*/i, name: 'shade_w' },
    { regex: /[nNcC]\d{1,2}/i, name: 'shade_nc' },
];

const SERIES_KEYWORDS = {
    '雅诗兰黛': ['小棕瓶', '小棕瓶', '特润', '肌透修', '抗老', '多效', '智妍', '白金', '持妆'],
    '兰蔻': ['小黑瓶', '菁纯', '粉水', '清滢', '塑颜', '焕白', '水份缘', '双头'],
    '资生堂': ['红腰子', '悦薇', '百优', '新透白', '时光琉璃', '红蜜', '蓝胖子', '安耐晒', '安热沙'],
    '欧莱雅': ['复颜', '金致', '青春密码', '紫熨斗', '小金管', '黑精华', '逆时'],
    '赫莲娜': ['黑绷带', '绿宝瓶', '白绷带'],
    '海蓝之谜': ['经典面霜', '精华面霜', '浓缩精华', '精华乳霜', '乳霜'],
    'SK-II': ['神仙水', '大红瓶', '小灯泡', '护肤精华露'],
    '迪奥': ['花蜜', '梦幻美肌', '蓝色魅惑', '烈艳蓝金', '迪奥小姐', '真我'],
    '香奈儿': ['山茶花', '奢华精萃', '金色亮采', '邂逅', '可可小姐'],
    '娇韵诗': ['双萃', '弹簧霜', '焕采', '花样', '橙水'],
    '科颜氏': ['高保湿', '白泥', '金盏花', '牛油果', '维C', '紫玻A'],
    '修丽可': ['色修', 'CE', '紫米', 'B5', 'A.G.E.', '果酸'],
    'YSL': ['自由之水', '反转巴黎', '黑鸦片', '恒久', '小金条', '水光唇'],
    '纪梵希': ['高定', '小黑裙', '禁忌之吻', '柔雾', '高定香榭'],
    '阿玛尼': ['权力', '红管', '黑钥匙', '寄情', '自我无界'],
    '植村秀': ['琥珀', '小方瓶', '砍刀眉笔', '洁颜油'],
    '薇诺娜': ['特护霜', '舒敏', '清痘', '极润'],
    '珀莱雅': ['双抗', '红宝石', '源力', '云朵'],
    '润百颜': ['次抛', '玻尿酸'],
    '可复美': ['类人胶原蛋白', '次抛', '贴'],
    '芙丽芳丝': ['氨基酸', '深润'],
    '娇兰': ['御廷兰花', '复原蜜', '黄金', '双效'],
    '雪花秀': ['润燥精华', '人参', '与润'],
    'Whoo': ['后', '天气丹', '拱辰享', '秘贴'],
    '欧舒丹': ['蜡菊', '乳木果', '杏仁', '草本'],
    'CPB': ['肌肤之钥', '钻光', '夜乳', '光润'],
    '黛珂': ['紫苏水', '牛油果', '白檀', 'AQ'],
    'POLA': ['黑B.A.', '白B.A.', '极光'],
    '倩碧': ['黄油', '焕妍', '匀净', '水磁场'],
    '玉兰油': ['小白瓶', '大红瓶', '超红瓶', '抗老小白瓶'],
};

const EXCLUDE_KEYWORDS = ['二手', '临期', '清仓', '瑕疵', '过期', '破损', '退货', '微瑕',
                           '9成新', '准新品', '翻新', '拆封', '开箱', '仅拆封', '仅试用',
                           '拍拍', '闲鱼', '回收'];
const SET_KEYWORDS = ['套装', '礼盒', '多件装', '组合装', '礼盒装', '套盒'];
const SAMPLE_KEYWORDS = ['小样', '试用装', '样品', '体验装', '旅行装', '中样', '中小样'];

const BRAND_STANDARD_SIZES = {
    '植村秀': { minSize: 50, minPrice: 80 },
    '欧莱雅': { minSize: 30, minPrice: 50 },
    '雅诗兰黛': { minSize: 30, minPrice: 300 },
    '兰蔻': { minSize: 30, minPrice: 300 },
    '资生堂': { minSize: 30, minPrice: 250 },
    '迪奥': { minSize: 3, minPrice: 250 },
    'YSL': { minSize: 3, minPrice: 250 },
    '纪梵希': { minSize: 3, minPrice: 250 },
    '赫莲娜': { minSize: 30, minPrice: 500 },
    '海蓝之谜': { minSize: 30, minPrice: 800 },
    '科颜氏': { minSize: 50, minPrice: 120 },
    '润百颜': { minSize: 1, minPrice: 50 },
    '芙丽芳丝': { minSize: 100, minPrice: 50 },
    'SK-II': { minSize: 30, minPrice: 500 },
    '娇兰': { minSize: 30, minPrice: 300 },
    '娇韵诗': { minSize: 30, minPrice: 100 },
    '修丽可': { minSize: 30, minPrice: 300 },
    '阿玛尼': { minSize: 30, minPrice: 250 },
    '香奈儿': { minSize: 30, minPrice: 250 },
    '珀莱雅': { minSize: 30, minPrice: 50 },
    '可复美': { minSize: 1, minPrice: 30 },
    '黛珂': { minSize: 30, minPrice: 150 },
    'HBN': { minSize: 30, minPrice: 50 },
    'NARS': { minSize: 10, minPrice: 150 },
    '柏瑞美': { minSize: 50, minPrice: 30 },
    '3CE': { minSize: 3, minPrice: 50 },
    '花西子': { minSize: 3, minPrice: 50 },
    '完美日记': { minSize: 3, minPrice: 30 },
    'CPB': { minSize: 10, minPrice: 300 },
    '肌肤之钥': { minSize: 10, minPrice: 300 },
    '悦木之源': { minSize: 30, minPrice: 100 },
    '彩棠': { minSize: 5, minPrice: 50 },
    '毛戈平': { minSize: 5, minPrice: 80 },
    '溪木源': { minSize: 30, minPrice: 30 },
    '逐本': { minSize: 50, minPrice: 30 },
    '橘朵': { minSize: 3, minPrice: 20 },
    '尔木萄': { minSize: 3, minPrice: 20 },
    '安热沙': { minSize: 30, minPrice: 80 },
    '安耐晒': { minSize: 30, minPrice: 80 },
    '兰芝': { minSize: 30, minPrice: 50 },
    '欧舒丹': { minSize: 30, minPrice: 80 },
    '娇韵诗': { minSize: 30, minPrice: 100 },
    '拉菲': { minPrice: 2000 },
    '拉图': { minPrice: 2000 },
    '木桐': { minPrice: 2000 },
    '玛歌': { minPrice: 2000 },
    '侯伯王': { minPrice: 1500 },
    '宝嘉龙': { minPrice: 800 },
    '雄狮': { minPrice: 800 },
    '龙船': { minPrice: 250 },
    '靓次伯': { minPrice: 250 },
    '大宝酒庄': { minPrice: 150 },
    '力士金': { minPrice: 150 },
    '美人鱼': { minPrice: 100 },
    '西施佳雅': { minPrice: 800 },
    '活灵魂': { minPrice: 500 },
    '作品一号': { minPrice: 1500 },
    '柏菲': { minPrice: 1500 },
    '啸鹰': { minPrice: 5000 },
    '碧尚女爵': { minPrice: 800 },
    '碧尚男爵': { minPrice: 800 },
    '奥比昂': { minPrice: 1500 },
    '宝马酒庄': { minPrice: 200 },
    '凯隆世家': { minPrice: 200 },
    '贝玛格雷': { minPrice: 100 },
    '奥纳亚': { minPrice: 800 },
    '嘉雅': { minPrice: 600 },
};

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

const BEAUTY_KEYWORDS = ['卸妆油', '洁面', '洗面奶', '洁颜油', '面霜', '乳液', '精华', '次抛精华',
                         '爽肤水', '化妆水', '面膜', '眼霜', '粉底', '粉底液', '口红', '唇膏', '防晒',
                         '护手霜', '身体乳', '香水', '气垫', '粉饼', '散粉', '睫毛膏', '眼影', '腮红',
                         '眉笔', '遮瑕', '卸妆水', '卸妆乳', '洁颜蜜', '防晒霜', '防晒乳', '精华液',
                         '肌底液', '精华露', '护肤精华露'];

const WINE_KEYWORDS = ['红酒', '葡萄酒', '干红', '干白', '香槟', '起泡酒', '白酒', '茅台', '五粮液', '洋酒',
                        '红葡萄酒', '白葡萄酒', '桃红葡萄酒', '起泡葡萄酒', '波特酒'];
const BEVERAGE_KEYWORDS = ['饮料', '果汁', '汽水', '可乐', '雪碧', '矿泉水', '咖啡', '奶茶', '茶饮'];
const SNACK_KEYWORDS = ['零食', '饼干', '薯片', '糖果', '巧克力', '坚果', '方便面'];

const SUSPICIOUS_SHOP_KEYWORDS = ['二手', '回收', '拍拍', '闲鱼', '微瑕', '清仓', '临期',
                                   '保税', '直邮', '代购', '工作室', '买手店', '个人护理',
                                   '小店', '专营店', '拼购', '海淘'];

const TRUSTED_SHOP_KEYWORDS = ['自营', '旗舰店', '官方', '会员店', '沃尔玛'];

const LUXURY_WINE_NAMES = ['拉菲', '拉图', '玛歌', '木桐', '奥比昂', '罗曼尼康帝', '柏图斯', '啸鹰',
    '柏菲', '西施佳雅', '奥纳亚', '嘉雅', '作品一号', '活灵魂', '宝嘉龙', '雄狮',
    '碧尚女爵', '碧尚男爵', '侯伯王'];

function classifyCategory(title) {
    const lowerTitle = String(title).toLowerCase();
    const compactTitle = lowerTitle.replace(/\s+/g, '');
    for (const name of LUXURY_WINE_NAMES) {
        if (lowerTitle.includes(name) || compactTitle.includes(name)) return 'luxury_wine';
    }
    for (const kw of BEAUTY_KEYWORDS) { if (lowerTitle.includes(kw) || compactTitle.includes(kw)) return 'beauty'; }
    for (const kw of WINE_KEYWORDS) {
        if (lowerTitle.includes(kw) || compactTitle.includes(kw)) return 'wine';
    }
    for (const kw of BEVERAGE_KEYWORDS) { if (lowerTitle.includes(kw) || compactTitle.includes(kw)) return 'beverage'; }
    for (const kw of SNACK_KEYWORDS) { if (lowerTitle.includes(kw) || compactTitle.includes(kw)) return 'snack'; }
    return 'default';
}

function extractBrand(str) {
    const lowerStr = String(str).toLowerCase();
    const compactStr = lowerStr.replace(/\s+/g, '');
    let bestMatch = null;
    let bestLength = 0;
    for (const brand of BRANDS) {
        const lowerBrand = brand.toLowerCase();
        if ((lowerStr.includes(lowerBrand) || compactStr.includes(lowerBrand)) && lowerBrand.length > bestLength) {
            bestMatch = brand;
            bestLength = lowerBrand.length;
        }
    }
    return bestMatch;
}

const ALL_PRODUCT_TYPES = [
    ...BEAUTY_KEYWORDS,
    ...WINE_KEYWORDS, ...BEVERAGE_KEYWORDS, ...SNACK_KEYWORDS,
    '曲奇', '饼干', '巧克力', '果汁', '汽水', '矿泉水', '咖啡', '茶', '椰子水',
    '苏打水', '纯净水', '电解质饮料', '功能饮料', '红茶', '绿茶', '乌龙茶',
    '茉莉花茶', '奶茶', '起泡酒', '干红', '干白', '桃红', '波特酒',
    '红葡萄酒', '白葡萄酒', '桃红葡萄酒', '起泡葡萄酒',
    '柠檬味', '柑橘味', '蜜桃味', '荔枝味', '橙子味', '凤梨味',
    '白桃味', '芭乐味', '黑加仑', '蔓越莓', '青提', '卡曼橘',
    '礼盒装', '罐装', '瓶装', '箱装'
];

function extractProductType(str) {
    const lowerStr = String(str).toLowerCase();
    const compactStr = lowerStr.replace(/\s+/g, '');
    return ALL_PRODUCT_TYPES.filter(kw => lowerStr.includes(kw) || compactStr.includes(kw));
}

function extractCapacity(str) {
    const s = String(str);
    const compactS = s.replace(/\s+/g, '');
    // 优先匹配多瓶装（如 330ml*24瓶）
    const multiMatch = compactS.match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ)\s*\*\s*(\d+)\s*(?:瓶|支|罐|盒|包|箱)/i);
    if (multiMatch) return multiMatch[0];
    // 匹配带斜杠的容量（如 72g/盒、330ml/瓶）
    const matchWithSlash = compactS.match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ)\s*[\/\\]\s*(?:盒|瓶|罐|袋|包|支|件)/i);
    if (matchWithSlash) return matchWithSlash[0];
    // 匹配紧密连接的容量+包装（如 72g盒、330ml瓶）
    const matchWithPack = compactS.match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ)\s*(?:盒|瓶|罐|袋|包|支|件)/i);
    if (matchWithPack) return matchWithPack[0].replace(/(ml|mL|ML|g|G|oz|OZ)(盒|瓶|罐|袋|包|支|件)/i, '$1/$2');
    // 只匹配重量/体积单位
    const match = compactS.match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ)(?![\/\\0-9])/i);
    return match ? match[0] : null;
}

function normalizeCapacity(capacity) {
    if (!capacity) return '';
    return String(capacity).toLowerCase().replace(/\s+/g, '').replace(/[^0-9.]/g, '');
}

function getCapacityNumber(capacity) {
    if (!capacity) return null;
    const match = String(capacity).match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
}

function extractSeries(text) {
    if (!text) return '';
    const str = String(text);
    const brand = extractBrand(str);
    if (brand && SERIES_KEYWORDS[brand]) {
        for (const series of SERIES_KEYWORDS[brand]) {
            if (str.includes(series)) return series;
        }
    }
    const allSeries = Object.values(SERIES_KEYWORDS).flat();
    for (const series of allSeries) {
        if (str.includes(series)) return series;
    }
    return '';
}

function extractModelInfo(text) {
    if (!text) return [];
    const str = String(text);
    const models = [];
    for (const pattern of MODEL_PATTERNS) {
        const match = str.match(pattern.regex);
        if (match) {
            models.push({ name: pattern.name, value: match[0], group: match[1] || '' });
        }
    }
    return models;
}

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

function isExcluded(title) {
    const lowerTitle = String(title).toLowerCase();
    return EXCLUDE_KEYWORDS.some(kw => lowerTitle.includes(kw));
}

function isSetProduct(title) {
    const lowerTitle = String(title).toLowerCase();
    return SET_KEYWORDS.some(kw => lowerTitle.includes(kw));
}

function isSampleProduct(title, price, brand, series) {
    const lowerTitle = String(title).toLowerCase();
    if (SAMPLE_KEYWORDS.some(kw => lowerTitle.includes(kw))) return true;

    const sampleSeriesKeywords = ['旅行', '体验', '中小样', '试用'];
    if (series && sampleSeriesKeywords.some(kw => series.includes(kw))) return true;

    const capacity = extractCapacity(title);
    if (capacity) {
        const capNum = getCapacityNumber(capacity);
        if (capNum !== null && brand && BRAND_STANDARD_SIZES[brand]) {
            const standard = BRAND_STANDARD_SIZES[brand];
            if (capNum < standard.minSize && price < standard.minPrice) return true;
        } else if (capNum !== null) {
            if (capNum <= 10) return true;
            if (capNum <= 30 && price < 30) return true;
        }
    }
    return false;
}

function extractPackQuantity(str) {
    if (!str) return 1;
    const s = String(str);
    // 匹配 *36盒/箱、*15瓶 等格式
    const match1 = s.match(/\*\s*(\d+)\s*(?:瓶|支|罐|盒|包|箱|个|件|入|装)/i);
    if (match1) return parseInt(match1[1]);
    // 匹配 36盒/箱、6瓶/箱 等格式
    const match2 = s.match(/(\d+)\s*(?:瓶|支|罐|盒|包|箱|个|件|入|装)\s*[\/\\]/i);
    if (match2) return parseInt(match2[1]);
    // 匹配 *36/箱、*24/箱 等格式（数字后直接/单位）
    const match3 = s.match(/\*\s*(\d+)\s*[\/\\]/i);
    if (match3) return parseInt(match3[1]);
    return 1;
}

const LUXURY_BRANDS = new Set(['雅诗兰黛', 'SK-II', '兰蔻', '海蓝之谜', '赫莲娜', '娇兰', '迪奥', '香奈儿', 'CPB', '肌肤之钥', 'YSL', '圣罗兰', '纪梵希', '资生堂', '修丽可']);

const WINE_LUXURY_BRANDS = new Set(['拉菲', '拉图', '玛歌', '木桐', '奥比昂', '罗曼尼康帝', '柏图斯', '啸鹰',
    '柏菲', '西施佳雅', '奥纳亚', '嘉雅', '作品一号', '活灵魂', '宝嘉龙', '雄狮',
    '碧尚女爵', '碧尚男爵', '侯伯王', '龙船', '靓次伯', '力士金', '美人鱼',
    '大宝酒庄', '宝马酒庄', '凯隆世家', '贝玛格雷', '杜霍', '鲁臣世家',
    '拉芳罗谢', '佳得美', '庞特卡奈', '杜哈米隆', '杜卡斯', '荔仙']);

function isSuspiciousPrice(supplierPrice, marketPrice, brand) {
    if (!supplierPrice || !marketPrice) return false;

    if (brand && BRAND_STANDARD_SIZES[brand] && marketPrice < BRAND_STANDARD_SIZES[brand].minPrice) {
        return true;
    }

    if (WINE_LUXURY_BRANDS.has(brand)) {
        if (marketPrice < supplierPrice * 0.35) return true;
        return false;
    }

    const isLuxury = LUXURY_BRANDS.has(brand);
    const threshold = isLuxury ? 0.5 : 0.35;
    if (marketPrice < supplierPrice * threshold) return true;

    return false;
}

function isSuspiciousShop(shopName) {
    if (!shopName) return false;
    const lowerShop = String(shopName).toLowerCase();
    if (TRUSTED_SHOP_KEYWORDS.some(kw => lowerShop.includes(kw))) return false;
    return SUSPICIOUS_SHOP_KEYWORDS.some(kw => lowerShop.includes(kw));
}

function isAdProduct(row) {
    return row['是否广告'] === '是' || row['is_ad'] === true;
}

function readSupplierQuotes() {
    const quoteFiles = fs.readdirSync(QUOTE_FOLDER).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    const productMap = new Map();

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
                    if (row && row.some(cell => String(cell).includes('品名') || String(cell).includes('产品名称') || String(cell).includes('规格') || String(cell).includes('价格'))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) continue;

                const headers = data[headerRowIndex];
                let nameIndex = headers.findIndex(h => String(h).includes('品名') || String(h).includes('产品名称') || String(h).includes('产品'));
                let specIndex = headers.findIndex(h => String(h).includes('规格') || String(h).includes('容量'));
                let daifaIndex = headers.findIndex(h => String(h).includes('代发价') || String(h).includes('代发'));
                let jiCaiIndex = headers.findIndex(h => String(h).includes('集采价') || String(h).includes('集采'));
                let retailPriceIndex = headers.findIndex(h => String(h).includes('零售价') || (String(h).includes('价格') && !String(h).includes('代发') && !String(h).includes('集采')));

                // 从列名提取价格单位（元/瓶、元/箱、元/盒、元/罐等）
                const daifaHeader = daifaIndex !== -1 ? String(headers[daifaIndex] || '') : '';
                const jiCaiHeader = jiCaiIndex !== -1 ? String(headers[jiCaiIndex] || '') : '';
                const retailHeader = retailPriceIndex !== -1 ? String(headers[retailPriceIndex] || '') : '';

                function extractPriceUnit(headerStr) {
                    // 匹配"元/瓶"、"元/箱"等格式
                    let m = headerStr.match(/元\s*[\/\\]\s*(瓶|箱|盒|罐|支|袋|件)/);
                    if (m) return m[1] === '支' ? '瓶' : m[1];
                    // 匹配"代发价/瓶"、"集采价/箱"、"零售价/盒"等格式
                    m = headerStr.match(/[\/\\]\s*(瓶|箱|盒|罐|支|袋|件)/);
                    if (m) return m[1] === '支' ? '瓶' : m[1];
                    return '';
                }
                const daifaUnit = extractPriceUnit(daifaHeader);
                const jiCaiUnit = extractPriceUnit(jiCaiHeader);
                const retailUnit = extractPriceUnit(retailHeader);

                if (nameIndex === -1) continue;

                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row) continue;

                    const name = row[nameIndex];
                    if (!name || String(name).trim() === '') continue;

                    const headerKeywords = ['品名', '产品名称', '产品', '规格', '合计', '小计', '编号', '序号'];
                    if (headerKeywords.some(kw => String(name).trim() === kw)) continue;

                    const trimmedName = String(name).trim();
                    let spec = specIndex !== -1 ? String(row[specIndex] || '').trim() : '';
                    if (!spec) {
                        const capacityMatch = String(name).match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ|支|片|瓶)/i);
                        if (capacityMatch) spec = capacityMatch[0];
                    }

                    // 解析代发价：可能是数字，也可能是"26元/6盒"格式
                    let daifaPrice = null;
                    let daifaParsedUnit = daifaUnit;
                    if (daifaIndex !== -1) {
                        const daifaRaw = String(row[daifaIndex] || '').trim();
                        // 先尝试解析"26元/6盒"格式
                        const specialMatch = daifaRaw.match(/(\d+(?:\.\d+)?)\s*元\s*[\/\\]\s*(\d+)\s*(瓶|箱|盒|罐|支|袋|件)/);
                        if (specialMatch) {
                            const totalPrice = parseFloat(specialMatch[1]);
                            const qty = parseInt(specialMatch[2]);
                            const unit = specialMatch[3];
                            if (totalPrice > 0 && qty > 0) {
                                daifaPrice = totalPrice / qty; // 折算为单价
                                daifaParsedUnit = unit;
                            }
                        } else {
                            // 普通数字格式
                            const daifaVal = parseFloat(daifaRaw);
                            if (daifaVal && !isNaN(daifaVal) && daifaVal > 0) {
                                daifaPrice = daifaVal;
                            }
                        }
                    }

                    const jiCaiVal = jiCaiIndex !== -1 ? parseFloat(String(row[jiCaiIndex] || '')) : null;
                    const jiCaiPrice = jiCaiVal && !isNaN(jiCaiVal) && jiCaiVal > 0 ? jiCaiVal : null;

                    const retailVal = retailPriceIndex !== -1 ? parseFloat(String(row[retailPriceIndex] || '')) : null;
                    const retailPrice = retailVal && !isNaN(retailVal) && retailVal > 0 ? retailVal : null;

                    // 取最低价：在代发价、集采价、零售价中取最低的
                    let validPrice = null;
                    let priceType = '';
                    let priceUnit = '';

                    // 收集所有有效价格（同单位下比较）
                    const priceOptions = [];
                    if (daifaPrice !== null) {
                        priceOptions.push({ price: daifaPrice, type: daifaParsedUnit ? `代发价（元/${daifaParsedUnit}）` : '含税顺丰代发价', unit: daifaParsedUnit || daifaUnit });
                    }
                    if (jiCaiPrice !== null) {
                        const unit = jiCaiUnit || daifaUnit;
                        priceOptions.push({ price: jiCaiPrice, type: unit ? `集采价（元/${unit}）` : '集采价（非一件代发）', unit });
                    }
                    if (retailPrice !== null) {
                        const unit = retailUnit || jiCaiUnit || daifaUnit;
                        priceOptions.push({ price: retailPrice, type: unit ? `零售价（元/${unit}）` : '零售价（非一件代发）', unit });
                    }

                    if (priceOptions.length > 0) {
                        // 按价格从低到高排序，取最低价
                        priceOptions.sort((a, b) => a.price - b.price);
                        validPrice = priceOptions[0].price;
                        priceType = priceOptions[0].type;
                        priceUnit = priceOptions[0].unit;
                    }

                    if (productMap.has(trimmedName)) {
                        const existing = productMap.get(trimmedName);
                        if (validPrice !== null) {
                            if (existing.price === null || validPrice < existing.price) {
                                existing.price = validPrice;
                                existing.priceType = priceType;
                                existing.priceUnit = priceUnit;
                            }
                        }
                        if (!existing.spec && spec) {
                            existing.spec = spec;
                        }
                        existing.sourceFiles.push(file);
                    } else {
                        productMap.set(trimmedName, {
                            name: trimmedName,
                            spec: spec,
                            price: validPrice,
                            priceType: priceType,
                            priceUnit: priceUnit,
                            sourceFile: file,
                            sourceFiles: [file],
                            sourceSheet: sheetName,
                            category: classifyCategory(trimmedName),
                            brand: extractBrand(trimmedName)
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }

    return Array.from(productMap.values());
}

function loadCleanedMarketData() {
    if (!fs.existsSync(CLEANED_FILE)) {
        console.error(`清洗数据文件不存在: ${CLEANED_FILE}`);
        return [];
    }

    const workbook = xlsx.readFile(CLEANED_FILE);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    return data.map(row => ({
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
        source_file: row['来源文件'] || '',
        source_platform: row['数据来源'] || '',
        is_ad: row['是否广告'] === '是',
        gray_price: row['划线价'] || 0,
        category: classifyCategory(row['标题'] || '')
    }));
}

function calculateSimilarity(supplierProduct, marketItem) {
    const supplierName = supplierProduct.name;
    const supplierSpec = supplierProduct.spec;
    const supplierFull = supplierSpec ? supplierName + ' ' + supplierSpec : supplierName;

    const supplierBrand = supplierProduct.brand || extractBrand(supplierFull);
    const marketBrand = marketItem.brand || extractBrand(marketItem.title);

    const supplierTypes = extractProductType(supplierFull);
    const marketTypes = extractProductType(marketItem.title);

    if (supplierTypes.length === 0 && supplierProduct.category) {
        const cat = supplierProduct.category;
        if (cat === 'luxury_wine' || cat === 'wine') {
            supplierTypes.push('红葡萄酒', '葡萄酒');
        } else if (cat === 'beauty') {
            supplierTypes.push('护肤品');
        } else if (cat === 'beverage') {
            supplierTypes.push('饮料');
        } else if (cat === 'snack') {
            supplierTypes.push('零食');
        }
    }

    const supplierCapacity = supplierSpec || extractCapacity(supplierFull);
    const marketCapacity = marketItem.capacity || marketItem.spec || extractCapacity(marketItem.title);

    const supplierSeries = supplierProduct.series || extractSeries(supplierFull);
    const marketSeries = marketItem.series || extractSeries(marketItem.title);

    const supplierModels = extractModelInfo(supplierFull);
    const marketModels = extractModelInfo(marketItem.title);

    let score = 0;
    let reasons = [];

    if (supplierBrand && marketBrand) {
        if (supplierBrand.toLowerCase() === marketBrand.toLowerCase()) {
            score += 35;
        } else {
            reasons.push('品牌不一致');
            return { score: 0, reasons };
        }
    } else if (supplierBrand && !marketBrand) {
        const cat = supplierProduct.category || classifyCategory(supplierFull);
        // 检查市场标题中是否包含品牌关键词（去除空格后匹配）
        const marketCompact = String(marketItem.title).replace(/\s+/g, '');
        if (marketCompact.includes(supplierBrand)) {
            score += 30;
            reasons.push('标题含品牌关键词');
        } else if (cat === 'luxury_wine' || cat === 'wine') {
            // 酒类品牌不匹配，大幅降分
            score += 0;
            reasons.push('酒类市场数据缺少品牌且标题不含品牌');
        } else {
            score += 5;
            reasons.push('市场数据缺少品牌');
        }
    } else if (!supplierBrand && !marketBrand) {
        score += 5;
    }

    const supplierIsSecondLabel = /副牌|小拉菲|小木桐|小奥比昂|小雄狮|小拉图|二军/.test(supplierFull);
    const marketIsSecondLabel = /副牌|小拉菲|小木桐|小奥比昂|小雄狮|小拉图|二军/.test(marketItem.title);
    const supplierIsMainLabel = !supplierIsSecondLabel && (supplierBrand && WINE_LUXURY_BRANDS.has(supplierBrand));
    const marketIsMainLabel = !marketIsSecondLabel && (marketBrand && WINE_LUXURY_BRANDS.has(marketBrand));

    if (supplierIsSecondLabel && !marketIsSecondLabel && marketIsMainLabel) {
        reasons.push('副牌与正牌不匹配');
        return { score: Math.min(score, 30), reasons };
    }
    if (supplierIsMainLabel && marketIsSecondLabel && !supplierIsSecondLabel) {
        reasons.push('正牌与副牌不匹配');
        return { score: Math.min(score, 30), reasons };
    }

    const typeMatchResult = isSynonymMatch(supplierTypes, marketTypes);
    if (typeMatchResult === 'exact') {
        score += 25;
    } else if (typeMatchResult === 'synonym') {
        score += 15;
        reasons.push('近义词匹配');
    } else {
        if (supplierTypes.length > 0 && marketTypes.length > 0) {
            reasons.push('产品类型不匹配');
            return { score: Math.min(score, 40), reasons };
        }
        if (supplierBrand && marketBrand && supplierBrand.toLowerCase() === marketBrand.toLowerCase()) {
            const cat = supplierProduct.category || classifyCategory(supplierFull);
            if (cat === 'luxury_wine' || cat === 'wine' || WINE_LUXURY_BRANDS.has(supplierBrand)) {
                score += 10;
                reasons.push('同品牌酒类推断');
            }
        }
    }

    if (supplierSeries && marketSeries) {
        if (supplierSeries === marketSeries) {
            score += 10;
        }
    }

    if (supplierCapacity && marketCapacity) {
        const supplierNum = getCapacityNumber(supplierCapacity);
        const marketNum = getCapacityNumber(marketCapacity);

        if (supplierNum && marketNum) {
            if (Math.abs(supplierNum - marketNum) / Math.max(supplierNum, marketNum) < 0.1) {
                score += 15;
            } else {
                score += 3;
                reasons.push('容量不一致');
            }
        } else {
            score += 5;
        }
    } else if (!supplierCapacity) {
        score += 5;
    }

    if (supplierModels.length > 0 && marketModels.length > 0) {
        for (const sModel of supplierModels) {
            for (const mModel of marketModels) {
                if (sModel.name === mModel.name && sModel.group && mModel.group && sModel.group === mModel.group) {
                    score += 10;
                    break;
                }
            }
        }
    }

    const supplierLower = supplierFull.toLowerCase();
    const marketLower = marketItem.title.toLowerCase();

    const importantKeywords = ['琥珀', '臻萃', '蓝胖子', '小白管', '菁纯', '绿宝瓶', '金盏花',
                               '高保湿', '小蜜罐', '小黑瓶', '红腰子', '神仙水', '黑绷带',
                               '小金瓶', '小金条', '双萃', '红宝石', '双抗', '色修',
                               '持妆', '权力', '金钻', '经典面霜', '精萃水'];
    let wordScore = 0;
    const supplierWords = supplierLower.split(/\s+/).filter(w => w.length > 1);

    for (const word of supplierWords) {
        if (marketLower.includes(word)) {
            wordScore += importantKeywords.includes(word) ? 2 : 1;
        }
    }
    score += Math.min(15, wordScore);

    if (isSuspiciousShop(marketItem.shop)) {
        score -= 5;
        reasons.push('非官方店铺');
    }

    return { score: Math.max(0, Math.min(110, Math.round(score))), reasons };
}

function isSameSpec(supplierProduct, marketItem) {
    // 品牌必须一致才可能是同规格
    const supplierBrand = supplierProduct.brand || extractBrand(supplierProduct.spec ? supplierProduct.name + ' ' + supplierProduct.spec : supplierProduct.name);
    const marketBrand = marketItem.brand || extractBrand(marketItem.title);
    let brandMatch = false;
    if (supplierBrand && marketBrand) {
        if (supplierBrand.toLowerCase() !== marketBrand.toLowerCase()) return false;
        brandMatch = true;
    } else if (supplierBrand && !marketBrand) {
        const marketCompact = String(marketItem.title).replace(/\s+/g, '');
        if (!marketCompact.includes(supplierBrand)) return false;
        brandMatch = true;
    }

    const supplierFull = supplierProduct.spec ? supplierProduct.name + ' ' + supplierProduct.spec : supplierProduct.name;
    const supplierCapacity = supplierProduct.spec || extractCapacity(supplierFull);
    const marketCapacity = marketItem.capacity || marketItem.spec || extractCapacity(marketItem.title);

    if (!supplierCapacity || !marketCapacity) {
        // 容量信息缺失时，品牌一致即视为同规格
        return brandMatch;
    }

    const supplierNum = getCapacityNumber(supplierCapacity);
    const marketNum = getCapacityNumber(marketCapacity);

    if (!supplierNum || !marketNum) {
        return brandMatch;
    }

    // 容量差异超过5%视为不同规格
    if (Math.abs(supplierNum - marketNum) / Math.max(supplierNum, marketNum) >= 0.05) return false;

    return true;
}

function analyzePrices(supplierProducts, marketProducts) {
    const results = [];

    for (const supplierProduct of supplierProducts) {
        const fullName = supplierProduct.spec ? supplierProduct.name + ' ' + supplierProduct.spec : supplierProduct.name;
        const categoryConfig = CATEGORY_THRESHOLDS[supplierProduct.category] || CATEGORY_THRESHOLDS.default;
        const threshold = categoryConfig.threshold;

        const matches = [];

        for (const marketItem of marketProducts) {
            if (!marketItem.price || marketItem.price < 5) continue;
            if (isExcluded(marketItem.title)) continue;
            if (isAdProduct(marketItem)) continue;
            if (isSampleProduct(marketItem.title, marketItem.price, marketItem.brand, marketItem.series)) continue;

            const mktQty = extractPackQuantity(marketItem.title + ' ' + (marketItem.spec || marketItem.capacity || ''));
            const mktUnitPrice = marketItem.price / mktQty;
            const supQty = extractPackQuantity(supplierProduct.name + ' ' + (supplierProduct.spec || ''));
            // 根据价格单位计算供应商单件价
            let supUnitPrice;
            const priceUnit = supplierProduct.priceUnit || '';
            if (priceUnit === '箱' && supQty > 1) {
                // 按箱报价，除以箱规得到单瓶价
                supUnitPrice = supplierProduct.price ? supplierProduct.price / supQty : null;
            } else {
                // 按盒/瓶/罐报价，价格已经是单件价
                supUnitPrice = supplierProduct.price;
            }
            if (isSuspiciousPrice(supUnitPrice, mktUnitPrice, marketItem.brand)) continue;

            const isSet = isSetProduct(marketItem.title);
            if (isSet && categoryConfig.strict) continue;

            const similarity = calculateSimilarity(supplierProduct, marketItem);

            if (similarity.score >= threshold) {
                matches.push({ ...marketItem, similarity: similarity.score, reasons: similarity.reasons, isSet });
            } else if (similarity.score >= threshold - 10 && !categoryConfig.strict) {
                matches.push({ ...marketItem, similarity: similarity.score, reasons: similarity.reasons, isSet, needsReview: true });
            }
        }

        matches.sort((a, b) => {
            // 优先同规格：容量一致的排前面
            const aSpecMatch = isSameSpec(supplierProduct, a) ? 1 : 0;
            const bSpecMatch = isSameSpec(supplierProduct, b) ? 1 : 0;
            if (bSpecMatch !== aSpecMatch) return bSpecMatch - aSpecMatch;
            if (b.similarity !== a.similarity) return b.similarity - a.similarity;
            if (a.needsReview !== b.needsReview) return a.needsReview ? 1 : -1;
            if (a.isSet !== b.isSet) return a.isSet ? 1 : -1;
            return a.price - b.price;
        });

        const topCandidates = matches.slice(0, 5);

        if (topCandidates.length > 0) {
            // 分离同规格和不同规格的候选
            const sameSpecCandidates = topCandidates.filter(m => isSameSpec(supplierProduct, m) && !m.needsReview);
            const diffSpecCandidates = topCandidates.filter(m => !isSameSpec(supplierProduct, m) && !m.needsReview);
            const sameSpecAll = topCandidates.filter(m => isSameSpec(supplierProduct, m));

            // 最低价：优先同规格中最低的，没有同规格再取所有候选中最低的
            let effectiveMinPriceItem;
            if (sameSpecCandidates.length > 0) {
                effectiveMinPriceItem = sameSpecCandidates.sort((a, b) => a.price - b.price)[0];
            } else if (sameSpecAll.length > 0) {
                effectiveMinPriceItem = sameSpecAll.sort((a, b) => a.price - b.price)[0];
            } else {
                const validCandidates = topCandidates.filter(m => !m.needsReview);
                effectiveMinPriceItem = validCandidates.sort((a, b) => a.price - b.price)[0]
                    || topCandidates.sort((a, b) => (a.price || Infinity) - (b.price || Infinity))[0];
            }

            const minPriceItem = topCandidates.filter(m => !m.needsReview).sort((a, b) => a.price - b.price)[0];
            const fallbackMinPriceItem = topCandidates.sort((a, b) => (a.price || Infinity) - (b.price || Infinity))[0];
            if (!effectiveMinPriceItem) effectiveMinPriceItem = minPriceItem || fallbackMinPriceItem;

            let priceAdvantage = '';
            let reviewReasons = [];

            if (!minPriceItem && fallbackMinPriceItem) {
                reviewReasons.push('所有候选均需复核');
            }

            if (supplierProduct.price !== null && effectiveMinPriceItem && effectiveMinPriceItem.price) {
                const supplierQty = extractPackQuantity(fullName);
                const marketQty = extractPackQuantity(effectiveMinPriceItem.title + ' ' + (effectiveMinPriceItem.spec || effectiveMinPriceItem.capacity || ''));
                const isSameSpecMatch = isSameSpec(supplierProduct, effectiveMinPriceItem);
                const priceUnit = supplierProduct.priceUnit || '';

                // 计算供应商单件价：如果按箱报价则除以箱规
                let supplierUnitPrice = supplierProduct.price;
                let supplierUnitLabel = '';
                if (priceUnit === '箱' && supplierQty > 1) {
                    supplierUnitPrice = supplierProduct.price / supplierQty;
                    supplierUnitLabel = `（${supplierProduct.price}元/箱÷${supplierQty}=${supplierUnitPrice.toFixed(1)}元/瓶）`;
                }

                if (isSameSpecMatch) {
                    // 同规格直接比价（供应商单件价 vs 市场单件价）
                    const priceDiff = supplierUnitPrice - effectiveMinPriceItem.price;
                    if (priceUnit === '箱' && supplierQty > 1) {
                        priceAdvantage = priceDiff < 0
                            ? `低于市场低价 ${Math.abs(priceDiff).toFixed(1)} 元/瓶 ${supplierUnitLabel}`
                            : `高于市场低价 ${priceDiff.toFixed(1)} 元/瓶 ${supplierUnitLabel}`;
                    } else {
                        priceAdvantage = priceDiff < 0
                            ? `低于市场低价 ${Math.abs(priceDiff).toFixed(1)} 元 (同规格)`
                            : `高于市场低价 ${priceDiff.toFixed(1)} 元 (同规格)`;
                    }
                } else {
                    // 不同规格换算比价
                    const marketUnitPrice = effectiveMinPriceItem.price / marketQty;
                    const priceDiff = supplierUnitPrice - marketUnitPrice;
                    if (supplierQty > 1 || marketQty > 1) {
                        priceAdvantage = supplierUnitPrice < marketUnitPrice
                            ? `低于市场低价 ${Math.abs(priceDiff).toFixed(1)} 元/件 (供应${supplierQty}件装 vs 市场${marketQty}件装)`
                            : `高于市场低价 ${priceDiff.toFixed(1)} 元/件 (供应${supplierQty}件装 vs 市场${marketQty}件装)`;
                    } else {
                        priceAdvantage = supplierUnitPrice < marketUnitPrice
                            ? `低于市场低价 ${Math.abs(priceDiff).toFixed(0)} 元 (换算对比)`
                            : `高于市场低价 ${priceDiff.toFixed(0)} 元 (换算对比)`;
                    }
                }
            }

            if (supplierProduct.name.includes('腾塔堡巴罗萨赤霞珠')) {
                console.log('CANDIDATES from topCandidates:');
                topCandidates.forEach((tc, i) => {
                    console.log('  tc' + i + ': sim=' + tc.similarity + ' price=' + tc.price + ' review=' + (tc.needsReview||false) + ' ' + tc.title.substring(0, 30));
                });
            }
            const candidates = [];
            for (let i = 0; i < 4; i++) {
                if (topCandidates[i]) {
                    candidates.push({
                        title: topCandidates[i].title,
                        price: topCandidates[i].price,
                        spec: topCandidates[i].spec || topCandidates[i].capacity || '',
                        shop: topCandidates[i].shop || '',
                        similarity: topCandidates[i].similarity,
                        link: topCandidates[i].link || '',
                        isSet: topCandidates[i].isSet,
                        needsReview: topCandidates[i].needsReview,
                        reasons: topCandidates[i].reasons || []
                    });
                } else {
                    candidates.push(null);
                }
            }

            results.push({
                status: (!minPriceItem && fallbackMinPriceItem) ? '需要人工复核' : '已匹配',
                queryName: fullName,
                supplierPrice: supplierProduct.price,
                priceType: supplierProduct.priceType,
                priceUnit: supplierProduct.priceUnit || '',
                priceAdvantage,
                marketCount: matches.length,
                minPrice: effectiveMinPriceItem ? effectiveMinPriceItem.price : null,
                minPriceItem: effectiveMinPriceItem ? { title: effectiveMinPriceItem.title, price: effectiveMinPriceItem.price, shop: effectiveMinPriceItem.shop || '', link: effectiveMinPriceItem.link || '' } : null,
                candidates,
                sourceFile: supplierProduct.sourceFile,
                category: categoryConfig.name,
                reviewReasons
            });
        } else {
            let unmatchedReason = '未找到符合阈值的市场报价';
            const brandMarketData = marketProducts.filter(m => {
                const mBrand = m.brand || extractBrand(m.title);
                return mBrand && supplierProduct.brand && mBrand.toLowerCase() === supplierProduct.brand.toLowerCase();
            });

            if (brandMarketData.length === 0) {
                unmatchedReason = '该品牌无任何市场数据';
            } else {
                const filteredByPrice = brandMarketData.filter(m => {
                    if (!m.price || m.price < 5) return true;
                    if (isExcluded(m.title)) return true;
                    if (isAdProduct(m)) return true;
                    if (isSampleProduct(m.title, m.price, m.brand, m.series)) return true;
                    const mktQty = extractPackQuantity(m.title + ' ' + (m.spec || m.capacity || ''));
                    const mktUnitPrice = m.price / mktQty;
                    const supQty = extractPackQuantity(supplierProduct.name + ' ' + (supplierProduct.spec || ''));
                    const pu = supplierProduct.priceUnit || '';
                    let supUnitPrice;
                    if (pu === '箱' && supQty > 1) {
                        supUnitPrice = supplierProduct.price ? supplierProduct.price / supQty : null;
                    } else {
                        supUnitPrice = supplierProduct.price;
                    }
                    if (isSuspiciousPrice(supUnitPrice, mktUnitPrice, m.brand)) return true;
                    return false;
                });
                const remainingData = brandMarketData.length - filteredByPrice.length;
                if (remainingData === 0) {
                    unmatchedReason = '市场数据全为异常低价/假货，无有效报价（共' + brandMarketData.length + '条被过滤）';
                } else {
                    unmatchedReason = '有' + remainingData + '条有效市场数据但相似度不足（阈值' + threshold + '）';
                }
            }

            results.push({
                status: '未匹配',
                queryName: fullName,
                supplierPrice: supplierProduct.price,
                priceType: supplierProduct.priceType,
                priceUnit: supplierProduct.priceUnit || '',
                priceAdvantage: '无匹配数据',
                marketCount: 0,
                minPrice: null,
                minPriceItem: null,
                candidates: [null, null, null, null],
                sourceFile: supplierProduct.sourceFile,
                category: categoryConfig.name,
                reviewReasons: [unmatchedReason]
            });
        }
    }

    results.sort((a, b) => {
        // 品类排序：美妆优先
        const categoryOrder = { '美妆': 0, '名庄酒': 1, '普通酒水': 2, '饮料': 3, '零食': 4, '其他': 5 };
        const aCat = categoryOrder[a.category] !== undefined ? categoryOrder[a.category] : 5;
        const bCat = categoryOrder[b.category] !== undefined ? categoryOrder[b.category] : 5;
        if (aCat !== bCat) return aCat - bCat;

        const statusOrder = { '已匹配': 0, '需要人工复核': 1, '未匹配': 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        if (a.minPrice && b.minPrice) return a.minPrice - b.minPrice;
        return 0;
    });

    return results;
}

function saveResults(results) {
    const outputFile = path.join(OUTPUT_FOLDER, '价格优势分析结果_v2.xlsx');

    const wsData = [['状态', '品类', '查询名称', '供应商价格', '价格口径', '价格优势', '市场抓取报价数量', '最低价', '最低价标题', '最低价店铺', '最低价链接']];

    for (let i = 1; i <= 4; i++) {
        wsData[0].push(`候选${i}标题`, `候选${i}价格`, `候选${i}规格`, `候选${i}店铺`, `候选${i}匹配度`, `候选${i}是否套装`, `候选${i}需复核`);
    }
    wsData[0].push('复核原因', '来源文件');

    for (const result of results) {
        const row = [result.status, result.category, result.queryName, result.supplierPrice, result.priceType, result.priceAdvantage, result.marketCount, result.minPrice, result.minPriceItem ? result.minPriceItem.title : '', result.minPriceItem ? result.minPriceItem.shop : '', result.minPriceItem ? result.minPriceItem.link : ''];

        for (let i = 0; i < 4; i++) {
            const candidate = result.candidates[i];
            if (candidate) {
                row.push(candidate.title, candidate.price, candidate.spec, candidate.shop, candidate.similarity + '%', candidate.isSet ? '是' : '', candidate.needsReview ? '是' : '');
            } else {
                row.push('', '', '', '', '', '', '');
            }
        }
        row.push(result.reviewReasons.join('; ') || '', result.sourceFile);
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
    console.log(`读取了 ${supplierProducts.length} 个供应商产品（已去重取最低价）`);

    console.log('\n正在加载清洗后的市场价数据...');
    const marketProducts = loadCleanedMarketData();
    console.log(`读取了 ${marketProducts.length} 条市场价记录`);

    console.log('\n正在分析价格...');
    const results = analyzePrices(supplierProducts, marketProducts);

    console.log('\n正在保存结果...');
    const outputFile = saveResults(results);
    console.log(`分析完成！结果已保存到: ${outputFile}`);

    console.log('\n=== 分析摘要 ===');
    console.log(`总分析产品数: ${results.length}`);
    console.log(`已匹配产品数: ${results.filter(r => r.status === '已匹配').length}`);
    console.log(`需要复核产品数: ${results.filter(r => r.status === '需要人工复核').length}`);
    console.log(`未匹配产品数: ${results.filter(r => r.status === '未匹配').length}`);

    return results;
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { analyzePrices, readSupplierQuotes, loadCleanedMarketData };
