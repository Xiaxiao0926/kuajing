const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const config = require('./config');

const BASE_PATH = config.BASE_PATH;
const QUOTE_FOLDER = config.QUOTE_FOLDER;
const CLEANED_FILE = config.CLEANED_FILE;
const OUTPUT_FOLDER = config.OUTPUT_FOLDER;

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
    '香水': ['香氛', '淡香氛', '浓香', '淡香', '古龙', '淡香精', '浓香精'],
    '香氛': ['香水', '淡香氛', '浓香', '淡香', '古龙'],
    '淡香氛': ['香水', '香氛', '淡香'],
    '浓香': ['香水', '香氛', '浓香精'],
    '淡香': ['香水', '香氛', '淡香氛'],
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

// 化妆品品牌中英文别名映射（同一品牌的不同叫法视为匹配）
const BEAUTY_BRAND_ALIAS_GROUPS = [
    ['YSL', '圣罗兰'],
    ['赫莲娜', 'HR'],
    ['迪奥', 'Dior'],
    ['海蓝之谜', 'La Mer'],
    ['雅诗兰黛', 'Estee Lauder'],
    ['兰蔻', 'Lancome'],
    ['资生堂', 'Shiseido'],
    ['娇兰', 'Guerlain'],
    ['香奈儿', 'Chanel'],
    ['娇韵诗', 'Clarins'],
    ['雪花秀', 'Sulwhasoo'],
    ['欧舒丹', 'Loccitane'],
    ['科颜氏', 'Kiehls'],
    ['植村秀', 'Shu-uemura', 'shu uemura'],
    ['阿玛尼', 'Armani'],
    ['纪梵希', 'Givenchy'],
    ['悦木之源', 'Origins'],
    ['汤姆福特', 'TomFord'],
    ['宝格丽', 'Bvlgari'],
    ['蒂佳婷', 'Dr.Jart'],
    ['CPB', '肌肤之钥'],
    ['黛珂', 'Decorte'],
    ['安热沙', 'ANESSA', '安耐晒'],
    ['兰芝', 'Innisfree'],
    ['芙丽芳丝', 'Freeplus'],
    ['彩棠', 'Timage'],
    ['SK-II', 'SK2'],
    ['伊菲丹', 'Evidens', 'EviDenS'],
    // 食品饮料品牌别名
    ['东鹏饮料', '东鹏', '东鹏特饮'],
    ['Danisa', '皇冠', '皇冠丹麦'],
    ['Danisa/印尼', 'Danisa', '皇冠'],
];

// 构建品牌别名查找表
const BEAUTY_BRAND_ALIAS_MAP = {};
for (const group of BEAUTY_BRAND_ALIAS_GROUPS) {
    for (const name of group) {
        BEAUTY_BRAND_ALIAS_MAP[name.toLowerCase()] = group;
    }
}

function isBeautyBrandAlias(brand1, brand2) {
    if (!brand1 || !brand2) return false;
    const b1 = brand1.toLowerCase();
    const b2 = brand2.toLowerCase();
    if (b1 === b2) return true;
    const group1 = BEAUTY_BRAND_ALIAS_MAP[b1];
    const group2 = BEAUTY_BRAND_ALIAS_MAP[b2];
    if (group1 && group2 && group1 === group2) return true;
    return false;
}

const EXCLUDE_KEYWORDS = ['二手', '临期', '清仓', '瑕疵', '过期', '破损', '退货', '微瑕',
                           '9成新', '准新品', '翻新', '拆封', '开箱', '仅拆封', '仅试用',
                           '拍拍', '闲鱼', '回收', '赠品', '买赠', '赠饮'];
const SET_KEYWORDS = ['套装', '礼盒', '多件装', '组合装', '礼盒装', '套盒', '两件套', '三件套'];
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
    'LUMENE', '伊菲丹', 'Evidens', 'EviDenS',
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
                         '护手霜', '身体乳', '香水', '香氛', '淡香氛', '浓香', '淡香', '古龙',
                         '气垫', '粉饼', '散粉', '睫毛膏', '眼影', '腮红',
                         '眉笔', '遮瑕', '卸妆水', '卸妆乳', '洁颜蜜', '防晒霜', '防晒乳', '精华液',
                         '肌底液', '精华露', '护肤精华露',
                         '粉水', '精萃水', '微凝珠', '精华水', '柔肤水', '收敛水', '保湿水',
                         '喷雾', '安瓶', '原液', '冻干粉', '粉霜', '隔离', '妆前乳', '定妆喷雾',
                         '修容', '高光', '阴影', '唇釉', '唇蜜', '唇膜', '润唇膏',
                         '眼膜', '颈霜', '护发精油', '洗发水', '护发素', '发膜',
                         '磨砂膏', '沐浴露', '沐浴油', '止汗露', '脱毛膏',
                         '指甲油', '美甲', '假睫毛', '双眼皮贴'];

const WINE_KEYWORDS = ['红酒', '葡萄酒', '干红', '干白', '香槟', '起泡酒', '白酒', '茅台', '五粮液', '洋酒',
                        '红葡萄酒', '白葡萄酒', '桃红葡萄酒', '起泡葡萄酒', '波特酒'];
const BEVERAGE_KEYWORDS = ['饮料', '果汁', '汽水', '可乐', '雪碧', '矿泉水', '咖啡', '奶茶', '茶饮', '水溶', '维他命水', '电解质', '功能饮料', '纯净水', '苏打水', '椰子水', '气泡水', '巴黎水', '依云', '百岁山', '东鹏', '红牛', '脉动', '芬达', '美汁源', '果粒橙', '加多宝', '王老吉', '和其正', '旺仔', '养乐多', '乳酸菌', '乌龙茶', '绿茶', '红茶', '茉莉花茶', '普洱茶', '龙井', '碧螺春', '铁观音'];
const SNACK_KEYWORDS = ['零食', '饼干', '薯片', '糖果', '巧克力', '坚果', '方便面'];

const SUSPICIOUS_SHOP_KEYWORDS = ['二手', '回收', '拍拍', '闲鱼', '微瑕', '清仓', '临期',
                                   '保税', '直邮', '代购', '工作室', '买手店', '个人护理',
                                   '小店', '专营店', '拼购', '海淘'];

const TRUSTED_SHOP_KEYWORDS = ['自营', '旗舰店', '官方', '会员店', '沃尔玛', '天猫超市', '海外购旗舰店', '海外旗舰店'];

// 店铺可信度评分：品牌官方旗舰店/官方店优先，第三方旗舰店降级
// brandName: 产品的品牌名，用于判断是否为品牌官方店
function getShopTrustScore(shopName, brandName) {
    if (!shopName) return 0;
    const s = String(shopName);
    const brand = brandName ? String(brandName).trim() : '';

    // 判断店铺名是否包含品牌名（品牌官方店）
    const isBrandShop = brand && (
        s.includes(brand) ||
        // 英文品牌名匹配（不区分大小写）
        (brand && new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(s))
    );

    if (isBrandShop) {
        // 品牌官方店：品牌名+旗舰店/官方
        if (/旗舰店/.test(s)) return 4;      // 品牌旗舰店（最高优先级）
        if (/官方店|官方直营|品牌直销/.test(s)) return 4;  // 品牌官方店
        if (/自营/.test(s)) return 3;          // 品牌自营店
    }

    // 非品牌官方的旗舰店/官方店（第三方旗舰店，降级处理）
    if (/旗舰店/.test(s)) return 1;           // 第三方旗舰店
    if (/官方店|官方直营/.test(s)) return 1;   // 第三方官方店

    // 平台自营（京东自营、天猫超市等，虽非品牌官方但可信度高）
    if (/自营|京东超市/.test(s)) return 2;
    if (/天猫超市|天猫国际/.test(s)) return 2;
    if (/会员店|沃尔玛|山姆/.test(s)) return 2;

    // 专营/专卖
    if (/专卖店|专营店|授权店/.test(s)) return 1;

    return 0;
}

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

function classifyCategoryBySheet(sheetName) {
    const s = String(sheetName || '');
    if (/饮料|饮品|矿泉水|果汁/.test(s)) return 'beverage';
    if (/零食|饼干|食品/.test(s)) return 'snack';
    if (/葡萄酒|红酒|名庄/.test(s)) return 'luxury_wine';
    if (/酒|白酒|洋酒/.test(s)) return 'wine';
    if (/护肤|美妆|化妆品|面霜/.test(s)) return 'beauty';
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
    const unitPattern = '(?:ml|mL|ML|l|L|g|G|kg|KG|oz|OZ)';
    // 优先匹配多瓶装（如 330ml*24瓶、4.5L*2瓶）
    const multiMatch = compactS.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + unitPattern + '\\s*\\*\\s*(\\d+)\\s*(?:瓶|支|罐|盒|包|箱)', 'i'));
    if (multiMatch) return multiMatch[0];
    // 匹配带斜杠的容量（如 72g/盒、330ml/瓶）
    const matchWithSlash = compactS.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + unitPattern + '\\s*[\\/\\\\]\\s*(?:盒|瓶|罐|袋|包|支|件)', 'i'));
    if (matchWithSlash) return matchWithSlash[0];
    // 匹配紧密连接的容量+包装（如 72g盒、330ml瓶、4.5L瓶）
    const matchWithPack = compactS.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + unitPattern + '\\s*(?:盒|瓶|罐|袋|包|支|件)', 'i'));
    if (matchWithPack) return matchWithPack[0].replace(new RegExp('(' + unitPattern + ')(盒|瓶|罐|袋|包|支|件)', 'i'), '$1/$2');
    // 只匹配重量/体积单位
    const match = compactS.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + unitPattern + '(?![\\/\\\\0-9])', 'i'));
    return match ? match[0] : null;
}

function normalizeCapacity(capacity) {
    if (!capacity) return '';
    return String(capacity).toLowerCase().replace(/\s+/g, '').replace(/[^0-9.]/g, '');
}

function getCapacityNumber(capacity) {
    if (!capacity) return null;
    const str = String(capacity);
    const match = str.match(/(\d+(?:\.\d+)?)\s*(ml|mL|ML|l|L|g|G|kg|KG|oz|OZ)/i);
    if (!match) {
        const numMatch = str.match(/(\d+(?:\.\d+)?)/);
        return numMatch ? parseFloat(numMatch[1]) : null;
    }
    let num = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    // 统一转换为ml：L→*1000, kg→*1000g
    if (unit === 'l') num *= 1000;
    if (unit === 'kg') num *= 1000;
    return num;
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
    if (SET_KEYWORDS.some(kw => lowerTitle.includes(kw))) return true;
    // 识别"N罐装"、"N瓶装"、"N支装"等多件装格式（N>=2）
    const multiPackMatch = lowerTitle.match(/(\d+)\s*(?:罐|瓶|支|盒|件|个)\s*装/);
    if (multiPackMatch && parseInt(multiPackMatch[1]) >= 2) return true;
    // 识别括号内的多件格式，如"5ml（4罐装）"、"5ml 3瓶"
    const bracketMatch = lowerTitle.match(/[（(]\s*(\d+)\s*(?:罐|瓶|支|盒|件|个)\s*(?:装)?\s*[）)]/);
    if (bracketMatch && parseInt(bracketMatch[1]) >= 2) return true;
    // 识别容量后*N格式，如"50ml*2"、"30g*3"
    const starNumMatch = lowerTitle.match(/(?:ml|mL|ML|g|G|oz|OZ)\s*\*\s*(\d+)/);
    if (starNumMatch && parseInt(starNumMatch[1]) >= 2) return true;
    return false;
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
    // 优先匹配数量字段开头的 "24瓶"、"6盒" 等格式（quantity字段拼接在最前面）
    const qtyFieldMatch = s.match(/^(\d+)\s*(?:瓶|支|罐|盒|包|箱|个|件|入|装)/);
    if (qtyFieldMatch && parseInt(qtyFieldMatch[1]) >= 2) return parseInt(qtyFieldMatch[1]);
    // 匹配括号内的多件格式，如"5ml（4罐装）"、"5ml(3瓶)" — 优先匹配
    const bracketMatch = s.match(/[（(]\s*(\d+)\s*(?:罐|瓶|支|盒|包|箱|个|件|入)\s*(?:装)?\s*[）)]/);
    if (bracketMatch && parseInt(bracketMatch[1]) >= 2) return parseInt(bracketMatch[1]);
    // 匹配"5ml 3瓶"、"5ml 3瓶（新版）"等格式：容量后面跟数字+量词（非容量单位）
    const afterCapacityMatch = s.match(/(?:ml|mL|ML|g|G|oz|OZ)\s*(\d+)\s*(?:罐|瓶|支|盒|包|箱|个|件|入)/i);
    if (afterCapacityMatch && parseInt(afterCapacityMatch[1]) >= 2) return parseInt(afterCapacityMatch[1]);
    // 匹配容量后紧跟的数字（无量词），如 "330ml 24瓶" 中的 "24" 或 "330ml 24 " 中的 "24"
    // 仅匹配2-3位数字（6-999），避免误匹配容量本身
    const afterCapacityNumMatch = s.match(/(?:ml|mL|ML|g|G|oz|OZ)\s+(\d{2,3})(?:\s|$|[^0-9mlg])/i);
    if (afterCapacityNumMatch && parseInt(afterCapacityNumMatch[1]) >= 6) return parseInt(afterCapacityNumMatch[1]);
    // 匹配 *36盒/箱、*15瓶 等格式
    const match1 = s.match(/\*\s*(\d+)\s*(?:瓶|支|罐|盒|包|箱|个|件|入|装)/i);
    if (match1) return parseInt(match1[1]);
    // 匹配容量后 *N 格式（无量词），如 50ml*2、30g*3
    const starNumMatch = s.match(/(?:ml|mL|ML|g|G|oz|OZ)\s*\*\s*(\d+)/i);
    if (starNumMatch && parseInt(starNumMatch[1]) >= 2) return parseInt(starNumMatch[1]);
    // 匹配 36盒/箱、6瓶/箱 等格式
    const match2 = s.match(/(\d+)\s*(?:瓶|支|罐|盒|包|箱|个|件|入|装)\s*[\/\\]/i);
    if (match2) return parseInt(match2[1]);
    // 匹配 *36/箱、*24/箱 等格式（数字后直接/单位）
    const match3 = s.match(/\*\s*(\d+)\s*[\/\\]/i);
    if (match3) return parseInt(match3[1]);
    // 匹配标题中任意位置的 "20瓶"、"6瓶"、"12瓶" 等格式
    // 要求前面是空格或行首，避免误匹配容量数字如"330ml"中的30
    const anyPosMatch = s.match(/(?:^|\s)(\d+)\s*(?:瓶|支|罐|盒|包|箱|个|件|入|装)/);
    if (anyPosMatch && parseInt(anyPosMatch[1]) >= 2) return parseInt(anyPosMatch[1]);
    return 1;
}

const LUXURY_BRANDS = new Set(['雅诗兰黛', 'SK-II', '兰蔻', '海蓝之谜', '赫莲娜', '娇兰', '迪奥', '香奈儿', 'CPB', '肌肤之钥', 'YSL', '圣罗兰', '纪梵希', '资生堂', '修丽可']);

const WINE_LUXURY_BRANDS = new Set(['拉菲', '拉图', '玛歌', '木桐', '奥比昂', '罗曼尼康帝', '柏图斯', '啸鹰',
    '柏菲', '西施佳雅', '奥纳亚', '嘉雅', '作品一号', '活灵魂', '宝嘉龙', '雄狮',
    '碧尚女爵', '碧尚男爵', '侯伯王', '龙船', '靓次伯', '力士金', '美人鱼',
    '大宝酒庄', '宝马酒庄', '凯隆世家', '贝玛格雷', '杜霍', '鲁臣世家',
    '拉芳罗谢', '佳得美', '庞特卡奈', '杜哈米隆', '杜卡斯', '荔仙',
    '迪仙', '碧加侯爵', '歌碧', '克拉米伦', '费里埃', '达玛雅克', '百德诗歌',
    '贝卡塔纳', '拉拉贡', '露仙歌', '肯德布朗', '杜萨克',
    '迪诗美乐', '史密斯拉菲特', '拉图嘉利', '爱士图尔', '芳宝']);

function isSuspiciousPrice(supplierPrice, marketPrice, brand) {
    if (!supplierPrice || !marketPrice) return false;

    // 异常高价过滤：市场价超过供应商价10倍， likely wrong match or fake listing
    if (marketPrice > supplierPrice * 10) return true;

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

async function readSupplierQuotes() {
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

                if (headerRowIndex === -1) {
                    // 支持2列无表头格式（如小样报价.xlsx）：A列产品名称，B列报价
                    // 特征：没有含"品名/产品名称/规格/价格"的行，且前几行有A列有值B列也有数字的行
                    let isSimpleTwoCol = false;
                    let dataRowCount = 0;
                    for (let i = 0; i < Math.min(15, data.length); i++) {
                        const row = data[i];
                        if (!row) continue;
                        const colA = row[0] ? String(row[0]).trim() : '';
                        const colB = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
                        // 有产品名且有数字报价的行
                        if (colA && colB && !isNaN(parseFloat(colB)) && parseFloat(colB) > 0) {
                            dataRowCount++;
                        }
                    }
                    if (dataRowCount >= 2) {
                        isSimpleTwoCol = true;
                    }

                    if (isSimpleTwoCol) {
                        // 解析2列无表头格式
                        for (let i = 0; i < data.length; i++) {
                            const row = data[i];
                            if (!row) continue;

                            const colA = row[0] ? String(row[0]).trim() : '';
                            const colB = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';

                            // 跳过空行
                            if (!colA && !colB) continue;
                            // 跳过分类标题行（A列有值但B列为空或非数字）
                            if (colA && (!colB || isNaN(parseFloat(colB)) || parseFloat(colB) <= 0)) continue;

                            const priceVal = parseFloat(colB);
                            if (!colA || isNaN(priceVal) || priceVal <= 0) continue;

                            let trimmedName = colA;
                            // 跳过赠品
                            if (/赠品|买赠|赠饮/.test(trimmedName)) continue;
                            // 修复缩写：7m→7ml、10m→10ml、2.5g→2.5g（已正确）
                            trimmedName = trimmedName.replace(/(\d+(?:\.\d+)?)m(?![lLgG])/g, '$1ml');
                            // 去除贸易术语：中标一般贸易、一般贸易、中标、跨境等（不影响产品匹配）
                            trimmedName = trimmedName.replace(/中标一般贸易|一般贸易|中标|跨境|行货|免税/g, '').replace(/\s+/g, ' ').trim();
                            // 从名称中提取规格
                            let spec = '';
                            const capacityMatch = String(trimmedName).match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ|支|片|瓶)/i);
                            if (capacityMatch) spec = capacityMatch[0];

                            // 小样产品的价格类型标记
                            const priceType = '小样报价';

                            if (productMap.has(trimmedName)) {
                                const existing = productMap.get(trimmedName);
                                if (existing.price === null || priceVal < existing.price) {
                                    existing.price = priceVal;
                                    existing.priceType = priceType;
                                    existing.priceUnit = '';
                                }
                                if (!existing.spec && spec) {
                                    existing.spec = spec;
                                }
                                existing.sourceFiles.push(file);
                            } else {
                                productMap.set(trimmedName, {
                                    name: trimmedName,
                                    spec: spec,
                                    price: priceVal,
                                    priceType: priceType,
                                    priceUnit: '',
                                    sourceFile: file,
                                    sourceFiles: [file],
                                    sourceSheet: sheetName,
                                    category: classifyCategory(trimmedName),
                                    brand: extractBrand(trimmedName)
                                });
                            }
                        }
                    }
                    continue;
                }

                const headers = data[headerRowIndex];
                let nameIndex = headers.findIndex(h => String(h).includes('品名') || String(h).includes('产品名称') || String(h).includes('产品'));
                let specIndex = headers.findIndex(h => String(h).includes('规格') || String(h).includes('容量'));
                let yearIndex = headers.findIndex(h => String(h).includes('年份'));
                let modelIndex = headers.findIndex(h => String(h).includes('型号') || String(h).includes('色号'));
                let brandColIndex = headers.findIndex(h => String(h) === '品牌' || String(h).includes('品牌'));
                let daifaIndex = headers.findIndex(h => String(h).includes('代发价') || String(h).includes('代发'));
                let jiCaiIndex = headers.findIndex(h => String(h).includes('集采价') || String(h).includes('集采'));
                let retailPriceIndex = headers.findIndex(h => String(h).includes('零售价') || (String(h).includes('价格') && !String(h).includes('代发') && !String(h).includes('集采')));
                let gonghuoIndex = headers.findIndex(h => String(h).includes('供货价') || String(h).includes('供货'));
                let tuangouIndex = headers.findIndex(h => String(h).includes('团购价') || String(h).includes('开团价'));

                // 检查子表头行（headerRowIndex+1）中的价格列（如"团购价"可能在子表头行）
                if (tuangouIndex === -1 && headerRowIndex + 1 < data.length) {
                    const subHeaders = data[headerRowIndex + 1];
                    if (subHeaders) {
                        const subTuangou = subHeaders.findIndex(h => String(h).includes('团购价') || String(h).includes('开团价'));
                        if (subTuangou !== -1) tuangouIndex = subTuangou;
                    }
                }

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

                    // 跳过子表头行和赠品行（如"团购价"、"赠品"、"赠品价值"等）
                    const nameStr = String(name).trim();
                    const subHeaderKeywords = ['团购价', '赠品价值', '佣金', '产品效期'];
                    if (subHeaderKeywords.some(kw => nameStr === kw)) continue;
                    if (/赠品|买赠|赠饮/.test(nameStr)) continue;

                    const headerKeywords = ['品名', '产品名称', '产品', '规格', '合计', '小计', '编号', '序号'];
                    if (headerKeywords.some(kw => String(name).trim() === kw)) continue;

                    let trimmedName = String(name).trim();
                    // 去除贸易术语
                    trimmedName = trimmedName.replace(/中标一般贸易|一般贸易|中标|跨境|行货|免税|大贸/g, '').replace(/\s+/g, ' ').trim();
                    if (yearIndex !== -1 && row[yearIndex]) {
                        const year = String(row[yearIndex]).trim();
                        if (year && /^\d{4}$/.test(year)) {
                            trimmedName = trimmedName + ' ' + year;
                        }
                    }
                    // 化妆品型号/色号拼接到品名
                    if (modelIndex !== -1 && row[modelIndex]) {
                        const model = String(row[modelIndex]).trim();
                        if (model) {
                            trimmedName = trimmedName + ' ' + model;
                        }
                    }
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

                    const gonghuoVal = gonghuoIndex !== -1 ? parseFloat(String(row[gonghuoIndex] || '')) : null;
                    const gonghuoPrice = gonghuoVal && !isNaN(gonghuoVal) && gonghuoVal > 0 ? gonghuoVal : null;

                    const tuangouVal = tuangouIndex !== -1 ? parseFloat(String(row[tuangouIndex] || '')) : null;
                    const tuangouPrice = tuangouVal && !isNaN(tuangouVal) && tuangouVal > 0 ? tuangouVal : null;

                    // 取最低价：在代发价、集采价、零售价、供货价、团购价中取最低的
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
                    if (gonghuoPrice !== null) {
                        priceOptions.push({ price: gonghuoPrice, type: '供货价', unit: '' });
                    }
                    if (tuangouPrice !== null) {
                        priceOptions.push({ price: tuangouPrice, type: '团购价', unit: '' });
                    }

                    if (priceOptions.length > 0) {
                        // 按优先级选择：代发价 > 集采价 > 零售价 > 供货价 > 团购价
                        const priorityOrder = ['代发价', '集采价', '零售价', '供货价', '团购价'];
                        priceOptions.sort((a, b) => {
                            const aIdx = priorityOrder.findIndex(p => a.type.includes(p));
                            const bIdx = priorityOrder.findIndex(p => b.type.includes(p));
                            return aIdx - bIdx;
                        });
                        validPrice = priceOptions[0].price;
                        priceType = priceOptions[0].type;
                        priceUnit = priceOptions[0].unit;
                    }

                    // 品牌提取：优先使用品牌列，没有时从名称提取
                    const brandFromCol = brandColIndex !== -1 && row[brandColIndex] ? String(row[brandColIndex]).trim() : '';
                    const finalBrand = brandFromCol || extractBrand(trimmedName);

                    if (productMap.has(trimmedName)) {
                        const existing = productMap.get(trimmedName);
                        if (validPrice !== null) {
                            if (existing.price === null || validPrice < existing.price) {
                                existing.price = validPrice;
                                existing.priceType = priceType;
                                existing.priceUnit = priceUnit;
                            }
                        }
                        // 如果原分类是default，尝试用sheet名更新分类
                        if (existing.category === 'default') {
                            const sheetCategory = classifyCategoryBySheet(sheetName);
                            if (sheetCategory !== 'default') existing.category = sheetCategory;
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
                            category: classifyCategory(trimmedName) === 'default' ? classifyCategoryBySheet(sheetName) : classifyCategory(trimmedName),
                            brand: finalBrand
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }

    // 读取报价表文件夹中的CSV文件（如有赞分销CSV）
    const csvFiles = fs.readdirSync(QUOTE_FOLDER).filter(f => f.endsWith('.csv'));
    for (const file of csvFiles) {
        const filePath = path.join(QUOTE_FOLDER, file);
        try {
            const rows = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath, 'utf8')
                    .pipe(csv())
                    .on('headers', (headers) => {
                        // 检查是否为有赞格式
                        if (!headers.some(h => h.includes('goods-title')) || !headers.some(h => h.includes('pricenum'))) {
                            resolve(); // 非有赞格式，跳过
                        }
                    })
                    .on('data', (row) => {
                        const title = row['goods-title'] || '';
                        const priceStr = row['pricenum'] || '';
                        const priceMatch = String(priceStr).match(/[\d.]+/);
                        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
                        if (title && price > 0 && !/赠品|买赠|赠饮/.test(title)) {
                            rows.push({ title, price });
                        }
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            for (const { title, price } of rows) {
                let trimmedName = String(title).trim();
                // 从名称中提取规格
                let spec = '';
                const capacityMatch = String(trimmedName).match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|g|G|oz|OZ|支|片|瓶)/i);
                if (capacityMatch) spec = capacityMatch[0];

                const brand = extractBrand(trimmedName);

                if (productMap.has(trimmedName)) {
                    const existing = productMap.get(trimmedName);
                    if (existing.price === null || price < existing.price) {
                        existing.price = price;
                        existing.priceType = '有赞分销价';
                        existing.priceUnit = '';
                    }
                    if (!existing.spec && spec) existing.spec = spec;
                    existing.sourceFiles.push(file);
                } else {
                    productMap.set(trimmedName, {
                        name: trimmedName,
                        spec: spec,
                        price: price,
                        priceType: '有赞分销价',
                        priceUnit: '',
                        sourceFile: file,
                        sourceFiles: [file],
                        sourceSheet: '',
                        category: classifyCategory(trimmedName),
                        brand: brand
                    });
                }
            }
            console.log(`  读取有赞分销CSV: ${file} (${rows.length} 个产品)`);
        } catch (e) {
            console.error(`Error reading CSV ${file}:`, e.message);
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
        original_title: row['原始标题'] || '',
        product_name: row['产品名'] || '',
        description: row['描述'] || '',
        category: classifyCategory(row['标题'] || '')
    }));
}

// 酒庄名智能提取：优先匹配已知酒庄品牌，避免"红葡萄酒酒庄"等错误匹配
function extractWineChateauBrand(title) {
    if (!title) return null;
    const str = String(title);

    // 策略1：查找所有"XX酒庄/庄园/城堡/酒厂/酒堡"模式，优先选择已知酒庄品牌
    const chateauPatterns = str.matchAll(/([\u4e00-\u9fa5]+)(?:酒庄|庄园|城堡|酒厂|酒堡)/g);
    const candidates = [];
    for (const match of chateauPatterns) {
        const name = match[1];
        // 排除通用词（红葡萄酒、白葡萄酒等不是酒庄名）
        if (/^(红葡萄酒|白葡萄酒|葡萄酒|干红|干白|红酒|白酒|起泡酒|香槟|甜酒|桃红|冰酒)$/.test(name)) continue;
        candidates.push(name);
    }

    // 从候选中优先选择已知酒庄品牌
    for (const name of candidates) {
        if (wineAliasLookup[name]) return name;
    }

    // 没有已知品牌，取第一个有效候选
    if (candidates.length > 0) return candidates[0];

    // 策略2：标题中直接包含已知酒庄品牌名（不带酒庄后缀）
    for (const brand of Object.keys(wineAliasLookup)) {
        if (str.includes(brand) && brand.length >= 2) {
            // 排除太短的通用词
            if (/^(红|白|干|甜|冰)$/.test(brand)) continue;
            return brand;
        }
    }

    return null;
}

function calculateSimilarity(supplierProduct, marketItem) {
    const supplierName = supplierProduct.name;
    const supplierSpec = supplierProduct.spec;
    const supplierFull = supplierSpec ? supplierName + ' ' + supplierSpec : supplierName;

    let supplierBrand = supplierProduct.brand || extractBrand(supplierFull);
    let marketBrand = (marketItem.brand && String(marketItem.brand).trim()) || extractBrand(marketItem.title);

    const cat = supplierProduct.category || classifyCategory(supplierFull);
    const isWine = cat === 'luxury_wine' || cat === 'wine';
    // 判断供应商产品是否为小样
    const isSupplierSample = supplierProduct.priceType === '小样报价';

    // 酒类品牌提取增强：始终优先从标题提取"XX酒庄/庄园/城堡"作为品牌
    // 原因：extractBrand可能返回产区名（如"玛歌"），而非酒庄名（如"迪仙"）
    if (isWine) {
        supplierBrand = extractWineChateauBrand(supplierFull) || supplierBrand;
        marketBrand = extractWineChateauBrand(String(marketItem.title)) || marketBrand;
        // 如果没有酒庄名模式，再尝试extractBrand
        if (!supplierBrand) {
            supplierBrand = extractBrand(supplierFull);
        }
        if (!marketBrand) {
            marketBrand = extractBrand(marketItem.title);
        }
    }

    // ===== 酒类专用匹配逻辑 =====
    if (isWine) {
        return calculateWineSimilarity(supplierProduct, marketItem, supplierFull, supplierBrand, marketBrand, cat);
    }

    const supplierTypes = extractProductType(supplierFull);
    const marketTypes = extractProductType(marketItem.title);

    if (supplierTypes.length === 0 && supplierProduct.category) {
        if (cat === 'beauty') {
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

    // ===== 品类冲突检查（在品牌匹配之前） =====
    // 护肤品类关键词（出现在产品名中说明是护肤品）
    const SKINCARE_INDICATORS = ['面霜', '乳液', '精华', '爽肤水', '粉水', '精萃水', '精华水', '面膜', '眼霜',
        '防晒', '防晒霜', '洁面', '洗面奶', '卸妆', '肌底液', '次抛', '安瓶', '原液', '冻干粉',
        '柔肤水', '收敛水', '保湿水', '护肤', '润肤', '补水', '保湿', '抗老', '淡纹', '紧致',
        '修护', '维稳', '提亮', '美白', '祛斑', '抗皱', '滋养', '修光', '水润', '水光'];
    // 香水/彩妆品类关键词（出现在产品名中说明是香水/彩妆）
    const FRAGRANCE_INDICATORS = ['香水', '香氛', '淡香氛', '浓香', '淡香', '古龙', '旷野', '花漾',
        '口红', '唇膏', '唇釉', '指甲油', '眼影', '腮红', '眉笔', '睫毛膏', '假睫毛',
        '粉底', '粉饼', '散粉', '气垫', '遮瑕', '修容', '高光', '定妆', '妆前'];

    const supplierNameLower = (supplierProduct.name || '').toLowerCase();
    const marketTitleLower = (marketItem.title || '').toLowerCase();

    // 检查供应商产品属于哪个品类
    const supplierIsSkincare = SKINCARE_INDICATORS.some(kw => supplierNameLower.includes(kw));
    const supplierIsFragrance = FRAGRANCE_INDICATORS.some(kw => supplierNameLower.includes(kw));
    // 检查市场产品属于哪个品类
    const marketIsSkincare = SKINCARE_INDICATORS.some(kw => marketTitleLower.includes(kw));
    const marketIsFragrance = FRAGRANCE_INDICATORS.some(kw => marketTitleLower.includes(kw));

    // 品类冲突：护肤品匹配到香水/彩妆，或反之
    // 但如果双方标题都同时包含护肤和彩妆/香水关键词（标题堆砌），则不拒绝
    if ((supplierIsSkincare && marketIsFragrance) || (supplierIsFragrance && marketIsSkincare)) {
        // 双方都有重叠品类关键词时，说明是标题堆砌，不拒绝
        const bothOverlap = (supplierIsSkincare && supplierIsFragrance) || (marketIsSkincare && marketIsFragrance);
        if (!bothOverlap) {
            reasons.push('品类冲突(护肤vs香水/彩妆)');
            return { score: 0, reasons };
        }
    }

    if (supplierBrand && marketBrand) {
        if (supplierBrand.toLowerCase() === marketBrand.toLowerCase()) {
            score += 35;
        } else if (isBeautyBrandAlias(supplierBrand, marketBrand)) {
            score += 35;
            reasons.push('品牌别名匹配(' + supplierBrand + '=' + marketBrand + ')');
        } else {
            reasons.push('品牌不一致');
            return { score: 0, reasons };
        }
    } else if (supplierBrand && !marketBrand) {
        const marketCompact = String(marketItem.title).replace(/\s+/g, '');
        if (marketCompact.includes(supplierBrand)) {
            score += 30;
            reasons.push('标题含品牌关键词');
        } else {
            // 检查市场标题是否包含供应商品牌的别名
            const aliasGroup = BEAUTY_BRAND_ALIAS_MAP[supplierBrand.toLowerCase()];
            if (aliasGroup) {
                let foundAlias = false;
                for (const alias of aliasGroup) {
                    if (alias.toLowerCase() !== supplierBrand.toLowerCase() && marketCompact.toLowerCase().includes(alias.toLowerCase())) {
                        foundAlias = true;
                        score += 30;
                        reasons.push('标题含品牌别名(' + alias + ')');
                        break;
                    }
                }
                if (!foundAlias) {
                    // 供应商有品牌但市场数据无品牌且标题不含该品牌/别名，直接拒绝
                    reasons.push('品牌不匹配(供应商:' + supplierBrand + ', 市场无品牌且标题不含该品牌)');
                    return { score: 0, reasons };
                }
            } else {
                // 供应商有品牌但市场数据无品牌且标题不含该品牌，直接拒绝
                reasons.push('品牌不匹配(供应商:' + supplierBrand + ', 市场无品牌且标题不含该品牌)');
                return { score: 0, reasons };
            }
        }
    } else if (!supplierBrand && marketBrand) {
        // 供应商无品牌但市场有品牌：检查供应商名称是否包含市场品牌或其别名
        const supplierCompact = (supplierProduct.name || '').replace(/\s+/g, '');
        if (supplierCompact.includes(marketBrand)) {
            score += 30;
            reasons.push('供应商名称含品牌关键词');
        } else {
            const aliasGroup = BEAUTY_BRAND_ALIAS_MAP[marketBrand.toLowerCase()];
            if (aliasGroup) {
                let foundAlias = false;
                for (const alias of aliasGroup) {
                    if (alias.toLowerCase() !== marketBrand.toLowerCase() && supplierCompact.toLowerCase().includes(alias.toLowerCase())) {
                        foundAlias = true;
                        score += 30;
                        reasons.push('供应商名称含品牌别名(' + alias + ')');
                        break;
                    }
                }
                if (!foundAlias) {
                    reasons.push('品牌不匹配(市场:' + marketBrand + ', 供应商无品牌且名称不含该品牌)');
                    return { score: 0, reasons };
                }
            } else {
                reasons.push('品牌不匹配(市场:' + marketBrand + ', 供应商无品牌且名称不含该品牌)');
                return { score: 0, reasons };
            }
        }
    } else if (!supplierBrand && !marketBrand) {
        score += 5;
    }

    const typeMatchResult = isSynonymMatch(supplierTypes, marketTypes);
    if (typeMatchResult === 'exact') {
        score += 25;
    } else if (typeMatchResult === 'synonym') {
        score += 15;
        reasons.push('近义词匹配');
    } else {
        if (supplierTypes.length > 0 && marketTypes.length > 0) {
            reasons.push('产品类型不匹配(' + supplierTypes.join('/') + ' vs ' + marketTypes.join('/') + ')');
            return { score: 0, reasons };
        }
        // 一方有明确产品类型、另一方没有时，检查名称中是否包含对方类型
        // 防止"粉水"匹配到"香水"等同品牌不同品类
        if (marketTypes.length > 0 && supplierTypes.length === 0) {
            const supplierName = (supplierProduct.name || '').toLowerCase();
            const hasMarketTypeInName = marketTypes.some(t => supplierName.includes(t));
            if (!hasMarketTypeInName) {
                // 供应商名称中不包含市场数据的任何产品类型关键词
                // 进一步检查：市场数据类型是否属于完全不同的品类
                const BEAUTY_ONLY = ['香水', '口红', '唇膏', '唇釉', '指甲油', '眼影', '腮红', '眉笔', '睫毛膏', '假睫毛'];
                const SKINCARE_ONLY = ['面霜', '乳液', '精华', '爽肤水', '粉水', '精萃水', '精华水', '面膜', '眼霜', '防晒', '防晒霜'];
                const marketIsBeautyOnly = marketTypes.some(t => BEAUTY_ONLY.includes(t));
                const marketIsSkincareOnly = marketTypes.some(t => SKINCARE_ONLY.includes(t));
                // 从供应商名称中提取产品类型
                const supplierNameTypes = extractProductType(supplierProduct.name);
                const supplierIsBeautyOnly = supplierNameTypes.some(t => BEAUTY_ONLY.includes(t));
                const supplierIsSkincareOnly = supplierNameTypes.some(t => SKINCARE_ONLY.includes(t));
                // 跨品类拒绝：护肤品 vs 彩妆/香水
                if ((marketIsBeautyOnly && supplierIsSkincareOnly) || (marketIsSkincareOnly && supplierIsBeautyOnly)) {
                    reasons.push('品类不匹配(护肤vs彩妆/香水)');
                    return { score: 0, reasons };
                }
            }
        }
        if (supplierTypes.length > 0 && marketTypes.length === 0) {
            const marketTitle = (marketItem.title || '').toLowerCase();
            const hasSupplierTypeInTitle = supplierTypes.some(t => marketTitle.includes(t));
            if (!hasSupplierTypeInTitle) {
                const BEAUTY_ONLY = ['香水', '口红', '唇膏', '唇釉', '指甲油', '眼影', '腮红', '眉笔', '睫毛膏', '假睫毛'];
                const SKINCARE_ONLY = ['面霜', '乳液', '精华', '爽肤水', '粉水', '精萃水', '精华水', '面膜', '眼霜', '防晒', '防晒霜'];
                const supplierIsBeautyOnly = supplierTypes.some(t => BEAUTY_ONLY.includes(t));
                const supplierIsSkincareOnly = supplierTypes.some(t => SKINCARE_ONLY.includes(t));
                const marketNameTypes = extractProductType(marketItem.title);
                const marketIsBeautyOnly = marketNameTypes.some(t => BEAUTY_ONLY.includes(t));
                const marketIsSkincareOnly = marketNameTypes.some(t => SKINCARE_ONLY.includes(t));
                if ((supplierIsBeautyOnly && marketIsSkincareOnly) || (supplierIsSkincareOnly && marketIsBeautyOnly)) {
                    reasons.push('品类不匹配(护肤vs彩妆/香水)');
                    return { score: 0, reasons };
                }
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
            } else if (isSupplierSample && (marketNum / supplierNum > 2 || supplierNum / marketNum > 2)) {
                // 小样产品：容量差异超过2倍视为不同规格（小样vs正装），直接拒绝
                reasons.push('容量差异过大(小样vs正装)');
                return { score: 0, reasons };
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

    // ===== 小样专用：价格比率校验 =====
    // 如果供应商是小样产品，市场价产品没有容量信息且价格远高于供应商，很可能是正装vs小样
    if (isSupplierSample && supplierProduct.price && marketItem.price) {
        const priceRatio = marketItem.price / supplierProduct.price;
        // 检查市场价标题是否含小样关键词
        const marketTitleStr = (marketItem.title || '') + ' ' + (marketItem.original_title || '');
        const marketHasSampleKw = /小样|试用装|旅行装|体验装|中样|中小样|mini|travel|sample|片装|试管/i.test(marketTitleStr);
        // 绝对价格判断：供应商价<200但市场价>500，即使标题含小样关键词也很可能是正装
        const supplierPriceLow = supplierProduct.price < 200;
        const marketPriceHigh = marketItem.price > 500;
        if (supplierPriceLow && marketPriceHigh && priceRatio > 3) {
            // 即使标题含小样关键词，绝对价格差异太大，很可能是正装
            if (!marketCapacity || (supplierCapacity && marketCapacity && getCapacityNumber(marketCapacity) / getCapacityNumber(supplierCapacity) > 2)) {
                reasons.push('绝对价格差异过大(供价<' + supplierProduct.price + '元,市价>' + marketItem.price + '元,疑似正装)');
                return { score: 0, reasons };
            }
        }
        // 含小样关键词时放宽到5倍，不含时3倍拒绝
        const priceRatioThreshold = marketHasSampleKw ? 5 : 3;
        if (priceRatio > priceRatioThreshold) {
            if (!marketCapacity) {
                reasons.push('价格差异过大(疑似正装,市价/供价>' + priceRatio.toFixed(1) + '倍)');
                return { score: 0, reasons };
            }
            // 有容量信息但容量差异在2倍以内，价格不应该差priceRatioThreshold倍以上
            if (supplierCapacity && marketCapacity) {
                const sNum = getCapacityNumber(supplierCapacity);
                const mNum = getCapacityNumber(marketCapacity);
                if (sNum && mNum && mNum / sNum <= 2 && priceRatio > priceRatioThreshold) {
                    reasons.push('价格差异与容量比例不符(疑似正装)');
                    return { score: 0, reasons };
                }
            }
        }
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
    const marketOriginalLower = (marketItem.original_title || '').toLowerCase();

    const importantKeywords = ['琥珀', '臻萃', '蓝胖子', '小白管', '菁纯', '绿宝瓶', '金盏花',
                               '高保湿', '小蜜罐', '小黑瓶', '红腰子', '神仙水', '黑绷带',
                               '小金瓶', '小金条', '双萃', '红宝石', '双抗', '色修',
                               '持妆', '权力', '金钻', '经典面霜', '精萃水'];
    // 过滤贸易术语，不参与关键词匹配
    const tradeTerms = ['中标一般贸易', '一般贸易', '中标', '跨境', '行货', '免税'];
    let wordScore = 0;
    const supplierWords = supplierLower.split(/\s+/).filter(w => w.length > 1 && !tradeTerms.some(t => w === t.toLowerCase()));

    for (const word of supplierWords) {
        if (marketLower.includes(word)) {
            wordScore += importantKeywords.includes(word) ? 2 : 1;
        } else if (marketOriginalLower && marketOriginalLower.includes(word)) {
            wordScore += importantKeywords.includes(word) ? 1 : 0.5;
        }
    }
    score += Math.min(15, wordScore);

    // ===== 小样专用匹配规则 =====
    if (isSupplierSample) {
        const marketTitleStr = (marketItem.title || '') + ' ' + (marketItem.original_title || '');
        const marketTitleLower = marketTitleStr.toLowerCase();
        // 小样关键词加分：市场价标题含小样/试用装/旅行装/体验装等
        const sampleKeywords = ['小样', '试用装', '旅行装', '体验装', '中样', '中小样', 'mini', 'travel', 'sample', '体验', '片装', '试管'];
        let sampleBonus = 0;
        for (const kw of sampleKeywords) {
            if (marketTitleLower.includes(kw)) {
                sampleBonus += 10;
                break; // 只加一次
            }
        }
        if (sampleBonus > 0) {
            score += sampleBonus;
            reasons.push('市场价含小样关键词');
        }
        // 正装关键词减分：市场价标题含明显正装标识
        const fullSizeKeywords = ['正装', '大瓶', '专柜', '官方正品', '大容量'];
        for (const kw of fullSizeKeywords) {
            if (marketTitleLower.includes(kw)) {
                score -= 15;
                reasons.push('市场价含正装关键词');
                break;
            }
        }
        // 容量判断：市场价容量明显大于供应商容量（>1.5倍）且无小样标识时减分
        if (supplierCapacity && marketCapacity) {
            const sNum = getCapacityNumber(supplierCapacity);
            const mNum = getCapacityNumber(marketCapacity);
            if (sNum && mNum && mNum / sNum > 1.5 && sampleBonus === 0) {
                score -= 10;
                reasons.push('市场价容量偏大(疑似正装)');
            }
        }
    }

    if (isSuspiciousShop(marketItem.shop)) {
        score -= 5;
        reasons.push('非官方店铺');
    }

    return { score: Math.max(0, Math.min(110, Math.round(score))), reasons };
}

// ===== 酒类专用匹配算法 =====
// 酒类匹配核心原则：品牌/酒庄名是唯一标识，品牌不匹配=0分
function calculateWineSimilarity(supplierProduct, marketItem, supplierFull, supplierBrand, marketBrand, cat) {
    let score = 0;
    let reasons = [];
    const marketTitle = String(marketItem.title);
    const marketOriginal = String(marketItem.original_title || marketTitle);
    const marketCompact = marketTitle.replace(/\s+/g, '');
    const marketOriginalCompact = marketOriginal.replace(/\s+/g, '');

    // 1. 品牌/酒庄名匹配（酒类最核心的判断）
    let brandMatched = false;
    if (supplierBrand && marketBrand) {
        if (isWineBrandAlias(supplierBrand, marketBrand)) {
            score += 50;
            brandMatched = true;
            reasons.push(supplierBrand === marketBrand ? '品牌完全匹配' : '品牌别名匹配');
        } else {
            // 市场数据品牌不一致，但可能品牌提取错误，检查标题中是否包含供应商品牌别名
            const brandAliases = getWineBrandAliases(supplierBrand);
            let foundInTitle = false;
            for (const alias of brandAliases) {
                if (marketCompact.includes(alias) || marketOriginalCompact.includes(alias)) {
                    foundInTitle = true;
                    score += 45;
                    brandMatched = true;
                    reasons.push('标题含品牌别名(' + alias + ')，市场品牌提取可能有误');
                    break;
                }
            }
            if (!foundInTitle) {
                reasons.push('酒类品牌不一致');
                return { score: 0, reasons };
            }
        }
    } else if (supplierBrand && !marketBrand) {
        // 市场数据无品牌提取结果，检查标题中是否包含品牌/酒庄名（含所有别名）
        const brandAliases = getWineBrandAliases(supplierBrand);
        let foundInTitle = false;
        for (const alias of brandAliases) {
            if (marketCompact.includes(alias) || marketOriginalCompact.includes(alias)) {
                foundInTitle = true;
                score += 45;
                brandMatched = true;
                reasons.push(alias === supplierBrand ? '标题含品牌关键词' : '标题含品牌别名(' + alias + ')');
                break;
            }
        }
        if (!foundInTitle) {
            // 检查英文名
            const engName = getWineEnglishName(supplierBrand);
            if (engName && (marketCompact.toLowerCase().includes(engName.toLowerCase()) || marketOriginalCompact.toLowerCase().includes(engName.toLowerCase()))) {
                score += 45;
                brandMatched = true;
                reasons.push('标题含英文名关键词');
            } else {
                // 酒类品牌不在市场标题中=0分
                reasons.push('酒类品牌不在市场标题中');
                return { score: 0, reasons };
            }
        }
    } else if (!supplierBrand && !marketBrand) {
        // 双方都无品牌，靠酒庄名/关键词匹配
        score += 5;
        reasons.push('双方均无品牌');
    }

    // 2. 副牌/正牌区分
    const supplierIsSecondLabel = /副牌|小拉菲|小木桐|小奥比昂|小雄狮|小拉图|二军|百安|克拉门斯|红亭|达玛雅克|上梅多克/.test(supplierFull);
    const marketIsSecondLabel = /副牌|小拉菲|小木桐|小奥比昂|小雄狮|小拉图|二军|百安|克拉门斯|红亭|达玛雅克|上梅多克/.test(marketTitle);
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

    // 3. 酒庄名精确匹配（从品名中提取"XX酒庄/庄园/城堡"模式，近义词互通）
    const supplierChateau = supplierFull.match(/([\u4e00-\u9fa5]+(?:酒庄|庄园|城堡|酒厂|酒堡))/);
    if (supplierChateau) {
        const normalizedChateau = normalizeChateauName(supplierChateau[1]);
        // 在市场标题中搜索近义词替换后的酒庄名
        const marketChateauMatches = (marketTitle + marketOriginal).match(/([\u4e00-\u9fa5]+(?:酒庄|庄园|城堡|酒厂|酒堡))/g);
        if (marketChateauMatches) {
            for (const mChateau of marketChateauMatches) {
                if (normalizeChateauName(mChateau) === normalizedChateau) {
                    score += 15;
                    reasons.push('酒庄名匹配');
                    break;
                }
            }
        }
    }

    // 4. 产品类型匹配（酒类降权：红葡萄酒/干红等是通用描述，不是区分因素）
    const supplierTypes = extractProductType(supplierFull);
    const marketTypes = extractProductType(marketTitle);
    if (supplierTypes.length === 0) {
        supplierTypes.push('红葡萄酒', '葡萄酒');
    }
    // 检查市场数据是否为酒类产品（防止品牌名相同但品类不同，如"美人鱼"饼干）
    const wineTypeKeywords = ['葡萄酒', '红酒', '干红', '干白', '白葡萄酒', '香槟', '洋酒', '威士忌',
                               '白兰地', '起泡酒', '甜酒', '桃红', '冰酒', '清酒', '烈酒'];
    const isMarketWine = wineTypeKeywords.some(kw => marketTitle.includes(kw) || marketOriginal.includes(kw));
    if (!isMarketWine) {
        // 市场数据不是酒类，即使品牌名相同也不匹配
        reasons.push('市场数据非酒类产品');
        return { score: 0, reasons };
    }
    const typeMatchResult = isSynonymMatch(supplierTypes, marketTypes);
    if (typeMatchResult === 'exact') {
        score += 5;  // 酒类产品类型降权（从25降到5）
    } else if (typeMatchResult === 'synonym') {
        score += 3;
    }

    // 5. 年份匹配（酒类年份是重要区分因素）
    const supplierYearMatch = supplierFull.match(/(20\d{2})/);
    const marketYearMatch = marketTitle.match(/(20\d{2})/);
    if (supplierYearMatch && marketYearMatch) {
        if (supplierYearMatch[1] === marketYearMatch[1]) {
            score += 10;
            reasons.push('年份匹配');
        } else {
            // 年份不一致：名庄酒重罚，普通酒水中度扣分
            const yearPenalty = cat === 'luxury_wine' ? 20 : 10;
            score -= yearPenalty;
            reasons.push(`年份不一致(${supplierYearMatch[1]}vs${marketYearMatch[1]}) -${yearPenalty}`);
        }
    } else if (supplierYearMatch && !marketYearMatch) {
        score -= 5;
        reasons.push('市场数据无年份 -5');
    }

    // 6. 容量匹配（酒类降权：750ml是标准容量）
    const supplierCapacity = supplierProduct.spec || extractCapacity(supplierFull);
    const marketCapacity = marketItem.capacity || marketItem.spec || extractCapacity(marketTitle);
    if (supplierCapacity && marketCapacity) {
        const supplierNum = getCapacityNumber(supplierCapacity);
        const marketNum = getCapacityNumber(marketCapacity);
        if (supplierNum && marketNum && Math.abs(supplierNum - marketNum) / Math.max(supplierNum, marketNum) < 0.1) {
            score += 3;  // 酒类容量降权（从15降到3）
        }
    }

    // 7. 关键词匹配（酒类特有关键词）
    const wineKeywords = ['副牌', '正牌', '珍藏', '特酿', '老藤', '列级庄', '一级庄', '二级庄',
                          '三级庄', '四级庄', '五级庄', 'AOC', 'AOP', '列级', '名庄',
                          '单公', '双公', '单支', '木箱'];
    let wineWordScore = 0;
    for (const kw of wineKeywords) {
        if (supplierFull.includes(kw) && (marketTitle.includes(kw) || marketOriginal.includes(kw))) {
            wineWordScore += 3;
        }
    }
    score += Math.min(10, wineWordScore);

    // 8. 型号/BIN编号匹配（如奔富BIN2/BIN8/BIN28/BIN389/BIN407等）
    const supplierBinMatch = supplierFull.match(/BIN\s*(\d+)/i);
    const marketBinMatch = marketTitle.match(/BIN\s*(\d+)/i);
    if (supplierBinMatch && marketBinMatch) {
        if (supplierBinMatch[1] === marketBinMatch[1]) {
            score += 15;
            reasons.push('BIN型号匹配');
        } else {
            score -= 20;
            reasons.push(`BIN型号不一致(BIN${supplierBinMatch[1]}vs BIN${marketBinMatch[1]}) -20`);
        }
    } else if (supplierBinMatch && !marketBinMatch) {
        score -= 15;
        reasons.push('供应商有BIN型号但市场无 -15');
    }

    if (isSuspiciousShop(marketItem.shop)) {
        score -= 5;
        reasons.push('非官方店铺');
    }

    return { score: Math.max(0, Math.min(110, Math.round(score))), reasons };
}

// 酒类品牌中英文对照表
const WINE_ENGLISH_NAMES = {
    '拉菲': 'Lafite', '拉图': 'Latour', '玛歌': 'Margaux', '木桐': 'Mouton',
    '奥比昂': 'Haut-Brion', '罗曼尼康帝': 'Romanee-Conti', '柏图斯': 'Petrus',
    '啸鹰': 'Screaming Eagle', '柏菲': 'Pavie', '西施佳雅': 'Sassicaia',
    '奥纳亚': 'Ornellaia', '嘉雅': 'Gaja', '作品一号': 'Opus One',
    '活灵魂': 'Almaviva', '宝嘉龙': 'Ducru-Beaucaillou', '雄狮': 'Leoville Las Cases',
    '碧尚女爵': 'Pichon Lalande', '碧尚男爵': 'Pichon Baron', '侯伯王': 'Haut-Brion',
    '龙船': 'Beychevelle', '靓次伯': 'Lynch-Bages', '力士金': 'Lascombes',
    '美人鱼': 'Giscours', '大宝酒庄': 'Talbot', '宝马酒庄': 'Palmer',
    '凯隆世家': 'Calon Segur', '贝玛格雷': 'Bernard Magrez', '杜霍': 'Durfort-Vivens',
    '鲁臣世家': 'Rauzan-Segla', '拉芳罗谢': 'Lafon-Rochet', '佳得美': 'Cantemerle',
    '庞特卡奈': 'Pontet-Canet', '杜哈米隆': 'Duhart-Milon', '杜卡斯': 'Ducasse',
    '荔仙': 'Prieure-Lichine', '拉图嘉利': 'La Tour Carnet', '腾塔堡': 'Thorn-Clarke',
    '奔富': 'Penfolds', '玫瑰酒庄': 'Montrose', '碧加侯爵': 'Marquis de Terme',
    '爱士图尔': 'Cos d Estournel', '费里埃': 'Ferriere',
    '迪仙': 'Chateau d Issan', '肯德布朗': 'Cantenac-Brown', '克拉米伦': 'Clerc Milon',
    '杜萨克': 'Dauzac', '歌碧': 'Croizet-Bages', '达玛雅克': "d Armailhac",
    '百德诗歌': 'Pouget', '贝卡塔纳': 'Boyd-Cantenac', '拉拉贡': 'Lagrange',
    '周伯通': 'Lynch-Bages', '芳宝': 'Fombrauge', '露仙歌': 'Rauzan-Gassies',
    '爱诗图尔': 'Cos d Estournel', '伊拉苏': 'Errazuriz',
    '卡塞洛': 'Casillero del Diablo', '维瓦尔第': 'Vivaldi',
    // 新增英文名映射
    '迪诗美乐': 'Desmirail', '史密斯拉菲特': 'Smith Haut Lafite',
    '杜扎克': 'Dauzac', '卡门萨': 'Carmensac', '克莱蒙': 'Pape Clement',
    '力关': 'Lagrange', '普拉纳': 'Pranoto', '阔穆拉特': 'Khvanchkara',
    '瓦尔波利切拉': 'Valpolicella'
};

// 酒类品牌音译别名对照表（同一酒庄的不同中文译名）
const WINE_ALIAS_GROUPS = [
    ['爱士图尔', '爱诗图尔', '爱士图'],
    ['靓次伯', '林卓贝斯', '靓茨伯', '靓次伯'],
    ['拉图', '拉图城堡'],
    ['拉菲', '拉菲古堡', '拉菲城堡'],
    ['木桐', '木桐城堡', '慕桐'],
    ['玛歌', '玛歌城堡'],
    ['奥比昂', '侯伯王', '红颜容'],
    ['龙船', '龙船庄园', '龙船城堡'],
    ['碧尚女爵', '碧尚女爵庄园'],
    ['碧尚男爵', '碧尚男爵庄园'],
    ['雄狮', '雄狮庄园', '莱奥维尔拉斯卡斯'],
    ['宝嘉龙', '宝嘉龙庄园', '杜克鲁-宝嘉龙'],
    ['力士金', '力士金庄园', '拉斯科姆'],
    ['美人鱼', '美人鱼庄园', '吉斯库尔'],
    ['大宝酒庄', '大宝', '塔堡'],
    ['宝马酒庄', '宝马', '帕尔默', '宝马庄园'],
    ['玫瑰酒庄', '玫瑰庄园', '梦露斯'],
    ['碧加侯爵', '碧加侯爵庄园', '玛奇侯爵'],
    ['肯德布朗', '肯德布朗庄园', '康特纳克-布朗'],
    ['拉芳罗谢', '拉芳罗榭', '拉芳罗谢庄园'],
    ['佳得美', '佳得美庄园', '康特梅尔'],
    ['庞特卡奈', '庞特卡奈庄园', '庞特卡内'],
    ['杜哈米隆', '杜哈米隆庄园'],
    ['杜卡斯', '杜卡斯庄园'],
    ['荔仙', '荔仙庄园', '普里厄-利奇纳'],
    ['拉图嘉利', '拉图嘉利城堡', '拉图卡尔内'],
    ['鲁臣世家', '鲁臣世家庄园', '鲁臣赛格'],
    ['费里埃', '费里埃庄园'],
    ['迪仙', '迪仙庄园', '迪仙城堡'],
    ['克拉米伦', '克拉米伦庄园', '克莱尔米隆'],
    ['杜萨克', '杜萨克庄园'],
    ['歌碧', '歌碧庄园', '克鲁瓦-巴日'],
    ['达玛雅克', '达玛雅克庄园', '达玛雅克城堡'],
    ['百德诗歌', '百德诗歌庄园', '普热'],
    ['贝卡塔纳', '贝卡塔纳庄园', '博伊德-康特纳克'],
    ['拉拉贡', '拉拉贡庄园', '拉格朗日'],
    ['周伯通', '林卓贝斯'],
    ['芳宝', '芳宝庄园', '丰布罗日'],
    ['露仙歌', '露仙歌庄园', '鲁桑-加西'],
    ['凯隆世家', '凯隆世家庄园', '卡隆-塞居尔'],
    ['贝玛格雷', '贝尔纳马格雷'],
    ['杜霍', '杜霍庄园', '迪福尔-维旺'],
    ['柏菲', '柏菲庄园', '帕维'],
    ['西施佳雅', '西施佳雅庄园', '萨西卡亚'],
    ['奥纳亚', '奥纳亚庄园', '奥内拉亚'],
    ['嘉雅', '嘉雅酒庄'],
    ['活灵魂', '阿尔玛维瓦'],
    ['作品一号', '作品一号酒庄', '欧普斯一号'],
    ['奔富', '奔富酒庄', '潘福'],
    ['腾塔堡', '索恩克拉克'],
    ['伊拉苏', '伊拉苏酒庄', '埃雷苏里斯'],
    // 新增别名组
    ['迪诗美乐', '迪诗美乐庄园', '德斯米赖', '德丝米耶', '狄诗美', '迪士美', '狄士美'],
    ['史密斯拉菲特', '史密斯拉菲特庄园', '史密斯奥拉菲特', '奥拉菲特'],
    ['杜扎克', '杜扎克庄园', '杜扎克城堡'],
    ['卡门萨', '卡门萨庄园', '卡门萨克'],
    ['克莱蒙', '克莱蒙庄园', '克莱蒙教皇'],
    ['力关', '力关庄园', '拉格朗日'],
];

// 构建别名查找表：任何别名 → 该组的所有别名
const wineAliasLookup = {};
for (const group of WINE_ALIAS_GROUPS) {
    for (const alias of group) {
        if (!wineAliasLookup[alias]) wineAliasLookup[alias] = new Set();
        for (const a of group) {
            wineAliasLookup[alias].add(a);
        }
    }
}

// 判断两个品牌名是否为同一酒庄的别名
function isWineBrandAlias(brand1, brand2) {
    if (!brand1 || !brand2) return false;
    if (brand1.toLowerCase() === brand2.toLowerCase()) return true;
    const aliases1 = wineAliasLookup[brand1];
    const aliases2 = wineAliasLookup[brand2];
    if (aliases1 && aliases1.has(brand2)) return true;
    if (aliases2 && aliases2.has(brand1)) return true;
    return false;
}

// 获取品牌的所有别名（用于在市场标题中搜索）
function getWineBrandAliases(brand) {
    const aliases = new Set();
    aliases.add(brand);
    if (wineAliasLookup[brand]) {
        for (const a of wineAliasLookup[brand]) aliases.add(a);
    }
    // 自动生成"品牌+酒庄近义词"组合（如"迪仙"+"酒庄"→"迪仙酒庄"）
    const brandBase = brand.replace(/(?:酒庄|庄园|城堡|酒厂|酒堡)$/, '');
    if (brandBase !== brand) {
        aliases.add(brandBase);
    }
    for (const syn of CHATEAU_SYNONYMS) {
        aliases.add(brandBase + syn);
    }
    // 同时加入英文名
    const engName = WINE_ENGLISH_NAMES[brand] || WINE_ENGLISH_NAMES[brandBase];
    if (engName) aliases.add(engName);
    return aliases;
}

// 酒庄名近义词替换（酒庄/庄园/城堡/酒厂 互换）
const CHATEAU_SYNONYMS = ['酒庄', '庄园', '城堡', '酒厂', '酒堡'];
function normalizeChateauName(name) {
    if (!name) return name;
    let result = name;
    for (const syn of CHATEAU_SYNONYMS) {
        result = result.replace(syn, '酒庄');
    }
    return result;
}

function getWineEnglishName(chineseName) {
    return WINE_ENGLISH_NAMES[chineseName] || '';
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
        // 饮料/零食：容量信息缺失时不视为同规格，避免不同规格误匹配
        const isStrictCategory = supplierProduct.category === 'beverage' || supplierProduct.category === 'snack';
        if (isStrictCategory) return false;
        return brandMatch;
    }

    const supplierNum = getCapacityNumber(supplierCapacity);
    const marketNum = getCapacityNumber(marketCapacity);

    if (!supplierNum || !marketNum) {
        return brandMatch;
    }

    // 容量差异超过5%视为不同规格
    if (Math.abs(supplierNum - marketNum) / Math.max(supplierNum, marketNum) >= 0.05) return false;

    // 饮料/零食：还需比对件数（如24瓶 vs 单瓶）
    const isStrictCategory = supplierProduct.category === 'beverage' || supplierProduct.category === 'snack';
    if (isStrictCategory) {
        const supQty = extractPackQuantity(supplierFull);
        const mktQty = extractPackQuantity(marketItem.title + ' ' + (marketItem.quantity || ''));
        if (supQty > 1 || mktQty > 1) {
            if (supQty !== mktQty) return false;
        }
    }

    return true;
}

function analyzePrices(supplierProducts, marketProducts) {
    const results = [];

    for (const supplierProduct of supplierProducts) {
        const fullName = supplierProduct.spec ? supplierProduct.name + ' ' + supplierProduct.spec : supplierProduct.name;
        const categoryConfig = CATEGORY_THRESHOLDS[supplierProduct.category] || CATEGORY_THRESHOLDS.default;
        const threshold = categoryConfig.threshold;

        let matches = [];
        const isWineProduct = supplierProduct.category === 'luxury_wine' || supplierProduct.category === 'wine';
        // 供应商产品本身是小样时，保留市场价中的小样产品进行匹配
        const isSupplierSample = supplierProduct.priceType === '小样报价' || isSampleProduct(supplierProduct.name, supplierProduct.price, supplierProduct.brand, '');
        const priceUnit = supplierProduct.priceUnit || '';
        // 有赞分销价本身就是单件零售价，不需要折算件数
        let supQty = supplierProduct.priceType === '有赞分销价' ? 1 : extractPackQuantity(supplierProduct.name + ' ' + (supplierProduct.spec || ''));
        const isStrictCategory = supplierProduct.category === 'beverage' || supplierProduct.category === 'snack';
        // 按箱报价时不折算件数（价格就是整箱价，不需要除以瓶数）
        if (priceUnit === '箱' && supQty > 1) {
            supQty = 1;
        }

        for (const marketItem of marketProducts) {
            if (!marketItem.price || marketItem.price < 5) continue;
            if (isExcluded(marketItem.title)) continue;
            if (isAdProduct(marketItem)) continue;
            // 酒类：使用酒庄名判断小样，避免产区名导致误判
            let sampleCheckBrand = marketItem.brand;
            if (isWineProduct) {
                const chateauBrand = extractWineChateauBrand(String(marketItem.title));
                if (chateauBrand) sampleCheckBrand = chateauBrand;
            }
            if (!isSupplierSample && isSampleProduct(marketItem.title, marketItem.price, sampleCheckBrand, marketItem.series)) continue;

            let mktQty = extractPackQuantity((marketItem.quantity || '') + ' ' + marketItem.title + ' ' + (marketItem.spec || marketItem.capacity || ''));
            // 按箱匹配时不折算市场价件数（同规格直接比整箱价）
            if (priceUnit === '箱') {
                mktQty = 1;
            }
            // 当市场价无法提取件数(mktQty=1)但标题含"整箱/整件"关键词时，
            // 如果供应商按箱报价，则该市场价很可能也是整箱价，使用供应商箱规作为参考
            if (mktQty === 1 && supQty > 1 && priceUnit === '箱') {
                const mktTitle = String(marketItem.title);
                if (/整箱|整件|全箱|一箱|一件/.test(mktTitle)) {
                    mktQty = supQty;
                }
            }
            const mktUnitPrice = marketItem.price / mktQty;
            // 根据价格单位计算供应商单件价
            let supUnitPrice;
            if (priceUnit === '箱' && supQty > 1) {
                // 按箱报价，除以箱规得到单瓶价
                supUnitPrice = supplierProduct.price ? supplierProduct.price / supQty : null;
            } else if (priceUnit === '瓶' || priceUnit === '盒' || priceUnit === '罐' || priceUnit === '袋' || priceUnit === '件') {
                // 列名已明确单位（如"集采价/瓶"），价格已是单件价，无需再除
                supUnitPrice = supplierProduct.price;
            } else if (supQty > 1) {
                // 无明确单位但规格为多件装，除以件数得到单件价
                supUnitPrice = supplierProduct.price ? supplierProduct.price / supQty : null;
            } else {
                // 单件报价
                supUnitPrice = supplierProduct.price;
            }
            // 酒类：使用酒庄名而非市场数据的brand字段（避免产区名如"玛歌"导致误判）
            let effectiveMarketBrand = marketItem.brand;
            if (isWineProduct) {
                const chateauBrand = extractWineChateauBrand(String(marketItem.title));
                if (chateauBrand) effectiveMarketBrand = chateauBrand;
            }
            if (isSuspiciousPrice(supUnitPrice, mktUnitPrice, effectiveMarketBrand)) continue;

            const isSet = isSetProduct(marketItem.title);
            if (isSet && categoryConfig.strict) continue;

            const similarity = calculateSimilarity(supplierProduct, marketItem);

            if (similarity.score >= threshold) {
                matches.push({ ...marketItem, similarity: similarity.score, reasons: similarity.reasons, isSet });
            } else if (similarity.score >= threshold - 10 && !categoryConfig.strict) {
                matches.push({ ...marketItem, similarity: similarity.score, reasons: similarity.reasons, isSet, needsReview: true });
            }
        }

        // 去重：相同店铺+相同价格视为同一商品，只保留一条（标题常有微小文字差异但实为同一链接）
        const seenKeys = new Set();
        matches = matches.filter(m => {
            const key = `${m.shop}|${m.price}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });

        matches.sort((a, b) => {
            // 优先同规格：容量一致的排前面
            const aSpecMatch = isSameSpec(supplierProduct, a) ? 1 : 0;
            const bSpecMatch = isSameSpec(supplierProduct, b) ? 1 : 0;
            if (bSpecMatch !== aSpecMatch) return bSpecMatch - aSpecMatch;
            // 优先可信渠道：品牌官方旗舰店/官方店优先
            const aTrust = getShopTrustScore(a.shop, supplierProduct.brand);
            const bTrust = getShopTrustScore(b.shop, supplierProduct.brand);
            if (bTrust !== aTrust) return bTrust - aTrust;
            if (b.similarity !== a.similarity) return b.similarity - a.similarity;
            if (a.needsReview !== b.needsReview) return a.needsReview ? 1 : -1;
            if (a.isSet !== b.isSet) return a.isSet ? 1 : -1;
            return a.price - b.price;
        });

        // 饮料/零食：只保留同规格候选，不同规格不展示
        if (isStrictCategory) {
            matches = matches.filter(m => isSameSpec(supplierProduct, m));
        }

        const topCandidates = matches.slice(0, 10);

        if (topCandidates.length > 0) {
            // 分离同规格和不同规格的候选
            const sameSpecCandidates = topCandidates.filter(m => isSameSpec(supplierProduct, m) && !m.needsReview);
            const diffSpecCandidates = topCandidates.filter(m => !isSameSpec(supplierProduct, m) && !m.needsReview);
            const sameSpecAll = topCandidates.filter(m => isSameSpec(supplierProduct, m));

            // 计算候选的单价（套装需要除以件数）
            const getUnitPrice = (item) => {
                // 按箱匹配时不折算件数（同规格直接比整箱价）
                if (priceUnit === '箱') {
                    return item.price;
                }
                let qty = extractPackQuantity((item.quantity || '') + ' ' + item.title + ' ' + (item.spec || item.capacity || ''));
                // 整箱/整件关键词启发式：无法提取件数时使用供应商箱规
                if (qty === 1 && supQty > 1 && priceUnit === '箱' && /整箱|整件|全箱|一箱|一件/.test(String(item.title))) {
                    qty = supQty;
                }
                return item.price / Math.max(1, qty);
            };

            // 选择参考价格：优先可信渠道（旗舰店/官方店/自营），而非市场最低价
            // 策略：在同规格候选中，优先选可信渠道中价格最低的；无可信渠道时再选普通渠道最低价
            const selectBestPriceItem = (candidates) => {
                if (!candidates || candidates.length === 0) return null;
                // 优先可信渠道
                const trustedCandidates = candidates.filter(m => getShopTrustScore(m.shop, supplierProduct.brand) > 0);
                if (trustedCandidates.length > 0) {
                    // 可信渠道中选价格最低的
                    return trustedCandidates.sort((a, b) => getUnitPrice(a) - getUnitPrice(b))[0];
                }
                // 无可信渠道，选价格最低的
                return candidates.sort((a, b) => getUnitPrice(a) - getUnitPrice(b))[0];
            };

            let effectiveMinPriceItem;
            if (sameSpecCandidates.length > 0) {
                effectiveMinPriceItem = selectBestPriceItem(sameSpecCandidates);
            } else if (sameSpecAll.length > 0) {
                effectiveMinPriceItem = selectBestPriceItem(sameSpecAll);
            } else if (isStrictCategory) {
                // 饮料/零食：没有同规格候选时不选参考价，避免不同规格误导
                effectiveMinPriceItem = null;
            } else {
                const validCandidates = topCandidates.filter(m => !m.needsReview);
                effectiveMinPriceItem = selectBestPriceItem(validCandidates)
                    || selectBestPriceItem(topCandidates);
            }

            const minPriceItem = topCandidates.filter(m => !m.needsReview).sort((a, b) => getUnitPrice(a) - getUnitPrice(b))[0];
            const fallbackMinPriceItem = [...topCandidates].sort((a, b) => getUnitPrice(a) - getUnitPrice(b))[0];
            if (!effectiveMinPriceItem && !isStrictCategory) effectiveMinPriceItem = minPriceItem || fallbackMinPriceItem;

            // 小样产品：如果最低价单价/供应商价>3，可能最低价是套装但未识别件数
            // 此时从候选中找单价更合理的（单价/供应商价<=3的最低价）
            if (isSupplierSample && effectiveMinPriceItem && supplierProduct.price) {
                const effectiveUnitPrice = getUnitPrice(effectiveMinPriceItem);
                if (effectiveUnitPrice / supplierProduct.price > 3) {
                    const reasonableCandidates = topCandidates.filter(m => {
                        const unitP = getUnitPrice(m);
                        return unitP / supplierProduct.price <= 3;
                    });
                    if (reasonableCandidates.length > 0) {
                        effectiveMinPriceItem = reasonableCandidates.sort((a, b) => getUnitPrice(a) - getUnitPrice(b))[0];
                    }
                }
            }

            let priceAdvantage = '';
            let reviewReasons = [];
            // 计算供应商单件价默认值（用于推荐价计算）
            let supplierUnitPrice;
            if (priceUnit === '箱' && supQty > 1) {
                supplierUnitPrice = supplierProduct.price ? supplierProduct.price / supQty : supplierProduct.price;
            } else if (priceUnit === '瓶' || priceUnit === '盒' || priceUnit === '罐' || priceUnit === '袋' || priceUnit === '件') {
                supplierUnitPrice = supplierProduct.price;
            } else if (supQty > 1) {
                supplierUnitPrice = supplierProduct.price ? supplierProduct.price / supQty : supplierProduct.price;
            } else {
                supplierUnitPrice = supplierProduct.price;
            }

            if (!minPriceItem && fallbackMinPriceItem) {
                reviewReasons.push('所有候选均需复核');
            }

            if (supplierProduct.price !== null && effectiveMinPriceItem && effectiveMinPriceItem.price) {
                let supplierQty = supplierProduct.priceType === '有赞分销价' ? 1 : extractPackQuantity(fullName);
                // 按箱匹配时不折算件数
                if (priceUnit === '箱' && supplierQty > 1) {
                    supplierQty = 1;
                }
                let marketQty = extractPackQuantity((effectiveMinPriceItem.quantity || '') + ' ' + effectiveMinPriceItem.title + ' ' + (effectiveMinPriceItem.spec || effectiveMinPriceItem.capacity || ''));
                // 按箱匹配时市场价也不折算件数
                if (priceUnit === '箱') {
                    marketQty = 1;
                }
                const isSameSpecMatch = isSameSpec(supplierProduct, effectiveMinPriceItem);
                // 整箱/整件关键词启发式
                if (marketQty === 1 && supplierQty > 1 && priceUnit === '箱' && /整箱|整件|全箱|一箱|一件/.test(String(effectiveMinPriceItem.title))) {
                    marketQty = supplierQty;
                }

                // 计算供应商单件价：多件装需除以件数
                let supplierUnitLabel = '';
                if (priceUnit === '箱' && supplierQty > 1) {
                    supplierUnitPrice = supplierProduct.price / supplierQty;
                    supplierUnitLabel = `（${supplierProduct.price}元/箱÷${supplierQty}=${supplierUnitPrice.toFixed(1)}元/瓶）`;
                } else if (priceUnit === '瓶' || priceUnit === '盒' || priceUnit === '罐' || priceUnit === '袋' || priceUnit === '件') {
                    // 列名已明确单位，价格已是单件价
                    supplierUnitPrice = supplierProduct.price;
                    supplierUnitLabel = `（${supplierProduct.price}元/${priceUnit}）`;
                } else if (supplierQty > 1) {
                    supplierUnitPrice = supplierProduct.price / supplierQty;
                    supplierUnitLabel = `（${supplierProduct.price}元÷${supplierQty}件=${supplierUnitPrice.toFixed(1)}元/件）`;
                }

                if (isSameSpecMatch) {
                    // 同规格直接比价（供应商单件价 vs 市场单件价）
                    // 套装需要除以件数得到单价
                    const marketUnitPrice = effectiveMinPriceItem.price / Math.max(1, marketQty);
                    const priceDiff = supplierUnitPrice - marketUnitPrice;
                    if (priceUnit === '箱' && supplierQty > 1) {
                        priceAdvantage = priceDiff < 0
                            ? `低于市场参考价 ${Math.abs(priceDiff).toFixed(1)} 元/瓶 ${supplierUnitLabel}`
                            : `高于市场参考价 ${priceDiff.toFixed(1)} 元/瓶 ${supplierUnitLabel}`;
                    } else if (marketQty > 1) {
                        priceAdvantage = priceDiff < 0
                            ? `低于市场参考价 ${Math.abs(priceDiff).toFixed(1)} 元 (市场${marketQty}件装折算${marketUnitPrice.toFixed(1)}元/件)`
                            : `高于市场参考价 ${priceDiff.toFixed(1)} 元 (市场${marketQty}件装折算${marketUnitPrice.toFixed(1)}元/件)`;
                    } else {
                        priceAdvantage = priceDiff < 0
                            ? `低于市场参考价 ${Math.abs(priceDiff).toFixed(1)} 元 (同规格)`
                            : `高于市场参考价 ${priceDiff.toFixed(1)} 元 (同规格)`;
                    }
                } else {
                    // 不同规格换算比价
                    // 小样产品：优先按容量比例换算（元/ml 或 元/g）
                    if (isSupplierSample) {
                        const supCap = extractCapacity(fullName);
                        const mktCap = extractCapacity(effectiveMinPriceItem.title + ' ' + (effectiveMinPriceItem.spec || effectiveMinPriceItem.capacity || ''));
                        const supCapNum = supCap ? getCapacityNumber(supCap) : null;
                        const mktCapNum = mktCap ? getCapacityNumber(mktCap) : null;
                        if (supCapNum && mktCapNum && supCapNum > 0 && mktCapNum > 0) {
                            // 按容量换算：供应商小样单价 vs 市场正装折算到同容量的价格
                            const supplierPerUnit = supplierUnitPrice / supCapNum;
                            const marketPerUnit = effectiveMinPriceItem.price / mktCapNum;
                            const marketEquivPrice = marketPerUnit * supCapNum; // 市场正装折算到小样容量的价格
                            const priceDiff = supplierUnitPrice - marketEquivPrice;
                            priceAdvantage = priceDiff < 0
                                ? `低于市场参考价 ${Math.abs(priceDiff).toFixed(1)} 元 (小样${supCap} vs 正装${mktCap}, 正装折算${marketEquivPrice.toFixed(1)}元)`
                                : `高于市场参考价 ${priceDiff.toFixed(1)} 元 (小样${supCap} vs 正装${mktCap}, 正装折算${marketEquivPrice.toFixed(1)}元)`;
                        } else {
                            // 无法提取容量，按件数换算
                            const marketUnitPrice = effectiveMinPriceItem.price / marketQty;
                            const priceDiff = supplierUnitPrice - marketUnitPrice;
                            priceAdvantage = supplierUnitPrice < marketUnitPrice
                                ? `低于市场参考价 ${Math.abs(priceDiff).toFixed(0)} 元 (换算对比)`
                                : `高于市场参考价 ${priceDiff.toFixed(0)} 元 (换算对比)`;
                        }
                    } else {
                        const marketUnitPrice = effectiveMinPriceItem.price / marketQty;
                        const priceDiff = supplierUnitPrice - marketUnitPrice;
                        if (supplierQty > 1 || marketQty > 1) {
                            priceAdvantage = supplierUnitPrice < marketUnitPrice
                                ? `低于市场参考价 ${Math.abs(priceDiff).toFixed(1)} 元/件 (供应${supplierQty}件装 vs 市场${marketQty}件装)`
                                : `高于市场参考价 ${priceDiff.toFixed(1)} 元/件 (供应${supplierQty}件装 vs 市场${marketQty}件装)`;
                        } else {
                            priceAdvantage = supplierUnitPrice < marketUnitPrice
                                ? `低于市场参考价 ${Math.abs(priceDiff).toFixed(0)} 元 (换算对比)`
                                : `高于市场参考价 ${priceDiff.toFixed(0)} 元 (换算对比)`;
                        }
                    }
                }
            }

            const candidates = [];
            for (let i = 0; i < 10; i++) {
                if (topCandidates[i]) {
                    candidates.push({
                        title: topCandidates[i].title,
                        original_title: topCandidates[i].original_title || '',
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

            // 参考价：套装显示单价
            let effectiveMinQty = effectiveMinPriceItem ? extractPackQuantity((effectiveMinPriceItem.quantity || '') + ' ' + effectiveMinPriceItem.title + ' ' + (effectiveMinPriceItem.spec || effectiveMinPriceItem.capacity || '')) : 1;
            // 按箱匹配时不折算件数
            if (priceUnit === '箱') {
                effectiveMinQty = 1;
            }
            // 整箱/整件关键词启发式
            if (effectiveMinQty === 1 && effectiveMinPriceItem) {
                const sQty = extractPackQuantity(fullName);
                const pUnit = supplierProduct.priceUnit || '';
                if (sQty > 1 && pUnit === '箱' && /整箱|整件|全箱|一箱|一件/.test(String(effectiveMinPriceItem.title))) {
                    effectiveMinQty = sQty;
                }
            }
            const effectiveMinUnitPrice = effectiveMinPriceItem ? effectiveMinPriceItem.price / Math.max(1, effectiveMinQty) : null;

            // 有赞成本价 = 拿货价(单件) / (1 - 1% - 0.6%) = 拿货价 / 0.984
            // 即：拿货价 + 积分钱(售价1%) + 千分之6(售价) = 有赞成本价
            // 多件装时基于单件拿货价计算
            const recommendedBasePrice = supplierUnitPrice || supplierProduct.price;
            const youzanCostPrice = recommendedBasePrice ? Math.round(recommendedBasePrice / 0.984 * 100) / 100 : null;

            // 推荐售价 = 基于供货价和市场参考价差价，最高不高于市场参考价，最低不低于有赞成本价
            // 有价格优势（成本价<市场参考价）：30%加价，min(供货价×1.3, 市场参考价)
            // 无价格优势（成本价>=市场参考价）：10%加价，供货价×1.1
            let suggestedRetailPrice = null;
            if (recommendedBasePrice) {
                if (effectiveMinUnitPrice && youzanCostPrice < effectiveMinUnitPrice) {
                    // 有价格优势：30%加价，不超过市场价，不低于成本价
                    const markedUpPrice = Math.round(recommendedBasePrice * 1.3 * 100) / 100;
                    const marketCap = Math.round(effectiveMinUnitPrice * 100) / 100;
                    suggestedRetailPrice = Math.max(youzanCostPrice, Math.min(markedUpPrice, marketCap));
                } else if (effectiveMinUnitPrice) {
                    // 无价格优势（成本价>=市场价）：10%加价
                    suggestedRetailPrice = Math.round(recommendedBasePrice * 1.1 * 100) / 100;
                } else {
                    // 无市场价：30%加价
                    suggestedRetailPrice = Math.round(recommendedBasePrice * 1.3 * 100) / 100;
                }
                suggestedRetailPrice = Math.round(suggestedRetailPrice * 100) / 100;
            }

            let recommendedPriceAdvantage = '';
            let hasAdvantage = false;
            if (youzanCostPrice && effectiveMinUnitPrice) {
                const recDiff = youzanCostPrice - effectiveMinUnitPrice;
                recommendedPriceAdvantage = recDiff < 0
                    ? `成本价低于市场参考价 ${Math.abs(recDiff).toFixed(1)} 元`
                    : `成本价高于市场参考价 ${recDiff.toFixed(1)} 元`;
                hasAdvantage = recDiff < 0;
            }

            results.push({
                status: (!minPriceItem && fallbackMinPriceItem) ? '需要人工复核' : '已匹配',
                queryName: fullName,
                supplierPrice: supplierProduct.price,
                youzanCostPrice: youzanCostPrice,
                suggestedRetailPrice: suggestedRetailPrice,
                priceType: supplierProduct.priceType,
                priceUnit: supplierProduct.priceUnit || '',
                priceAdvantage,
                recommendedPriceAdvantage,
                hasAdvantage,
                marketCount: matches.length,
                minPrice: effectiveMinUnitPrice,
                minPriceItem: effectiveMinPriceItem ? { title: effectiveMinPriceItem.title, original_title: effectiveMinPriceItem.original_title || '', price: effectiveMinPriceItem.price, shop: effectiveMinPriceItem.shop || '', link: effectiveMinPriceItem.link || '' } : null,
                candidates,
                sourceFile: supplierProduct.sourceFile,
                category: categoryConfig.name,
                brand: supplierProduct.brand || '',
                reviewReasons
            });
        } else {
            let unmatchedReason = '未找到符合阈值的市场报价';
            const unmatchedIsWine = categoryConfig.name === '名庄酒' || categoryConfig.name === '普通酒水';
            const brandMarketData = marketProducts.filter(m => {
                const mBrand = (m.brand && String(m.brand).trim()) || extractBrand(m.title);
                // 酒类使用别名匹配
                if (unmatchedIsWine) {
                    const chateauBrand = extractWineChateauBrand(String(m.title));
                    const effectiveBrand = chateauBrand || mBrand;
                    return effectiveBrand && supplierProduct.brand && isWineBrandAlias(effectiveBrand, supplierProduct.brand);
                }
                // 化妆品使用品牌别名匹配
                if (mBrand && supplierProduct.brand) {
                    if (mBrand.toLowerCase() === supplierProduct.brand.toLowerCase()) return true;
                    return isBeautyBrandAlias(mBrand, supplierProduct.brand);
                }
                return false;
            });

            if (brandMarketData.length === 0) {
                unmatchedReason = '该品牌无任何市场数据';
            } else {
                const filteredByPrice = brandMarketData.filter(m => {
                    if (!m.price || m.price < 5) return true;
                    if (isExcluded(m.title)) return true;
                    if (isAdProduct(m)) return true;
                    if (!isSupplierSample && isSampleProduct(m.title, m.price, m.brand, m.series)) return true;
                    const mktQty = extractPackQuantity((m.quantity || '') + ' ' + m.title + ' ' + (m.spec || m.capacity || ''));
                    const mktUnitPrice = m.price / mktQty;
                    let supQty = supplierProduct.priceType === '有赞分销价' ? 1 : extractPackQuantity(supplierProduct.name + ' ' + (supplierProduct.spec || ''));
                    const pu = supplierProduct.priceUnit || '';
                    // 按箱匹配时不折算件数
                    if (pu === '箱' && supQty > 1) {
                        supQty = 1;
                    }
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
                // 小样产品专用未匹配原因
                if (isSupplierSample) {
                    const sampleMarketData = brandMarketData.filter(m => {
                        const titleStr = (m.title || '') + ' ' + (m.original_title || '');
                        return /小样|试用|旅行装|体验装|试用装|中样|中小样|mini|travel|sample/i.test(titleStr);
                    });
                    const sameSpecData = brandMarketData.filter(m => {
                        const mCap = m.capacity || m.spec || extractCapacity(m.title);
                        const sCap = supplierProduct.spec || extractCapacity(fullName);
                        if (!mCap || !sCap) return false;
                        const mNum = getCapacityNumber(mCap);
                        const sNum = getCapacityNumber(sCap);
                        return mNum && sNum && Math.abs(mNum - sNum) / Math.max(mNum, sNum) < 0.2;
                    });
                    if (sampleMarketData.length === 0 && sameSpecData.length === 0) {
                        unmatchedReason = '市场无同规格小样报价（有' + brandMarketData.length + '条正装数据，但价格差异过大）';
                    } else if (sameSpecData.length === 0) {
                        unmatchedReason = '市场有' + sampleMarketData.length + '条小样数据但规格不匹配';
                    }
                }
            }

            // 未匹配产品：推荐价基于单件价计算
            let unmatchedUnitPrice = supplierProduct.price;
            const unmatchedSupQty = extractPackQuantity(fullName);
            const unmatchedPriceUnit = supplierProduct.priceUnit || '';
            // 按箱报价时价格就是整箱价，不需要除以件数
            if (unmatchedPriceUnit === '瓶' || unmatchedPriceUnit === '盒' || unmatchedPriceUnit === '罐' || unmatchedPriceUnit === '袋' || unmatchedPriceUnit === '件') {
                unmatchedUnitPrice = supplierProduct.price;
            } else if (unmatchedPriceUnit === '箱') {
                unmatchedUnitPrice = supplierProduct.price;
            } else if (unmatchedSupQty > 1) {
                unmatchedUnitPrice = supplierProduct.price / unmatchedSupQty;
            }
            const youzanCostPrice = unmatchedUnitPrice ? Math.round(unmatchedUnitPrice / 0.984 * 100) / 100 : null;
            const suggestedRetailPrice = unmatchedUnitPrice ? Math.round(unmatchedUnitPrice * 1.3 * 100) / 100 : null;
            results.push({
                status: '未匹配',
                queryName: fullName,
                supplierPrice: supplierProduct.price,
                youzanCostPrice: youzanCostPrice,
                suggestedRetailPrice: suggestedRetailPrice,
                priceType: supplierProduct.priceType,
                priceUnit: supplierProduct.priceUnit || '',
                priceAdvantage: '无匹配数据',
                marketCount: 0,
                minPrice: null,
                minPriceItem: null,
                candidates: [null, null, null, null],
                sourceFile: supplierProduct.sourceFile,
                category: categoryConfig.name,
                brand: supplierProduct.brand || '',
                reviewReasons: [unmatchedReason]
            });
        }
    }

    results.sort((a, b) => {
        // 可信渠道优先：参考价来自官方/旗舰店的产品排最前
        const aTrust = a.minPriceItem ? getShopTrustScore(a.minPriceItem.shop, a.brand) : -1;
        const bTrust = b.minPriceItem ? getShopTrustScore(b.minPriceItem.shop, b.brand) : -1;
        if (bTrust !== aTrust) return bTrust - aTrust;

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

    const wsData = [['状态', '品类', '品牌', '查询名称', '供应商价格', '有赞成本价', '推荐售价', '价格口径', '价格优势(推荐价vs市场价)', '市场抓取报价数量', '参考价', '参考价标题', '参考价店铺', '参考价链接']];

    for (let i = 1; i <= 10; i++) {
        wsData[0].push(`候选${i}标题`, `候选${i}原始标题`, `候选${i}价格`, `候选${i}规格`, `候选${i}店铺`, `候选${i}链接`, `候选${i}匹配度`, `候选${i}是否套装`, `候选${i}需复核`);
    }
    wsData[0].push('复核原因', '来源文件');

    for (const result of results) {
        const row = [result.status, result.category, result.brand || '', result.queryName, result.supplierPrice, result.youzanCostPrice || '', result.suggestedRetailPrice || '', result.priceType, result.recommendedPriceAdvantage || result.priceAdvantage, result.marketCount, result.minPrice ? Math.round(result.minPrice * 100) / 100 : '', result.minPriceItem ? result.minPriceItem.title : '', result.minPriceItem ? result.minPriceItem.shop : '', result.minPriceItem ? result.minPriceItem.link : ''];

        for (let i = 0; i < 10; i++) {
            const candidate = result.candidates[i];
            if (candidate) {
                row.push(candidate.title, candidate.original_title || '', candidate.price ? Math.round(candidate.price * 100) / 100 : '', candidate.spec, candidate.shop, candidate.link || '', candidate.similarity + '%', candidate.isSet ? '是' : '', candidate.needsReview ? '是' : '');
            } else {
                row.push('', '', '', '', '', '', '', '', '');
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
    const supplierProducts = await readSupplierQuotes();
    console.log(`读取了 ${supplierProducts.length} 个供应商产品（已去重取最低价）`);

    console.log('\n正在加载清洗后的市场价数据...');
    let marketProducts = loadCleanedMarketData();
    console.log(`读取了 ${marketProducts.length} 条市场价记录`);

    // 去重：相同链接只保留一条（取价格最低的）
    const linkMap = new Map();
    const noLinkItems = [];
    for (const item of marketProducts) {
        if (item.link && String(item.link).trim()) {
            const link = String(item.link).trim();
            if (linkMap.has(link)) {
                const existing = linkMap.get(link);
                if (item.price < existing.price) {
                    linkMap.set(link, item);
                }
            } else {
                linkMap.set(link, item);
            }
        } else {
            noLinkItems.push(item);
        }
    }
    const originalCount = marketProducts.length;
    const dedupedCount = linkMap.size + noLinkItems.length;
    marketProducts = [...linkMap.values(), ...noLinkItems];
    console.log(`去重后剩余 ${dedupedCount} 条市场价记录（移除 ${originalCount - dedupedCount} 条重复链接）`);

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

module.exports = { analyzePrices, readSupplierQuotes, loadCleanedMarketData, calculateSimilarity, extractProductType };
