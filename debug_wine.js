const { readSupplierQuotes, loadCleanedMarketData } = require('./analyze_with_cleaned_data');

const suppliers = readSupplierQuotes();
const market = loadCleanedMarketData();

const LUXURY_BRANDS = new Set(['雅诗兰黛', 'SK-II', '兰蔻', '海蓝之谜', '赫莲娜', '娇兰', '迪奥', '香奈儿', 'CPB', '肌肤之钥', 'YSL', '圣罗兰', '纪梵希', '资生堂', '修丽可']);

function isSuspiciousPrice(supplierPrice, marketPrice, brand) {
    if (!supplierPrice || !marketPrice) return false;
    const isLuxury = LUXURY_BRANDS.has(brand);
    const threshold = isLuxury ? 0.5 : 0.35;
    if (marketPrice < supplierPrice * threshold) return true;
    return false;
}

function extractPackQuantity(str) {
    if (!str) return 1;
    const s = String(str);
    const match1 = s.match(/\*\s*(\d+)\s*(?:瓶|支|罐|盒|包|箱|个|件|入|装)/i);
    if (match1) return parseInt(match1[1]);
    const match2 = s.match(/(\d+)\s*(?:瓶|支|罐|盒|包|箱|个|件|入|装)\s*[\/\\]/i);
    if (match2) return parseInt(match2[1]);
    return 1;
}

const testProducts = ['西施佳雅', '活灵魂', '龙船', '雄狮', '拉菲', '拉图', '力士金', '作品一号', '美人鱼', '木桐'];

for (const brand of testProducts) {
    const supplier = suppliers.find(s => s.name.includes(brand));
    if (!supplier) {
        console.log(brand + ': no supplier');
        continue;
    }

    console.log('\n=== ' + brand + ' === supPrice:' + supplier.price + ' cat:' + supplier.category);
    const relevantMarket = market.filter(m => m.title && m.title.includes(brand) && m.price >= 5);
    console.log('market items:', relevantMarket.length);

    let suspiciousCount = 0;
    let passCount = 0;
    let lowScoreCount = 0;

    for (const m of relevantMarket) {
        const mktQty = extractPackQuantity(m.title + ' ' + (m.spec || m.capacity || ''));
        const mktUnitPrice = m.price / mktQty;
        const supQty = extractPackQuantity(supplier.name + ' ' + (supplier.spec || ''));
        const supUnitPrice = supplier.price / supQty;

        if (isSuspiciousPrice(supUnitPrice, mktUnitPrice, m.brand)) {
            suspiciousCount++;
            console.log('  SUSPICIOUS p:' + m.price + ' mktU:' + mktUnitPrice.toFixed(0) + ' supU:' + supUnitPrice.toFixed(0) + ' threshold:' + (supUnitPrice * 0.35).toFixed(0) + ' | ' + m.title.substring(0, 50));
        } else {
            console.log('  PASS p:' + m.price + ' mktU:' + mktUnitPrice.toFixed(0) + ' supU:' + supUnitPrice.toFixed(0) + ' | ' + m.title.substring(0, 50));
            passCount++;
        }
    }
    console.log('suspicious:', suspiciousCount, 'pass:', passCount);
}
