// 模拟浏览器环境测试
const result = {
    status: '已匹配',
    queryName: 'test',
    supplierPrice: 100,
    priceType: '代发',
    priceAdvantage: '低于市场10%',
    hasAdvantage: true,
    marketCount: 5,
    minPrice: 90,
    category: '美妆',
    minPriceItem: { title: 'test', original_title: 'test', shop: 'shop', link: 'http://test.com' },
    candidates: [{title: 'c1', price: 90, similarity: 80}]
};
const globalIdx = 0;

const html = `
<div class="result-card" data-result-idx="${globalIdx}">
    ${result.minPriceItem && result.minPriceItem.title ? `
        <div class="min-price-detail">
            ${result.minPriceItem.link ? `<div>链接: <a href="${result.minPriceItem.link}" target="_blank">查看</a></div>` : ''}
        </div>
    ` : ''}
    ${result.candidates && result.candidates.filter(c=>c).length > 0 ? `
        <div class="candidates-section" id="candidates-section-${globalIdx}">
        </div>
    ` : ''}
</div>
`;

console.log('OK, length:', html.length);
