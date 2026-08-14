// 最小复现
const pageData = [{status:'已匹配', queryName:'test', supplierPrice:100, priceType:'代发',
    priceAdvantage:'低10%', hasAdvantage:true, marketCount:5, minPrice:90, category:'美妆',
    minPriceItem:{title:'t',original_title:'t',shop:'s',link:'http://t.com'},
    candidates:[{title:'c1',price:90,similarity:80,original_title:'c1',shop:'s',link:'http://t.com'}]
}];
const currentPage = 1;
const pageSize = 15;

const container = {innerHTML: ''};
container.innerHTML = pageData.map((result, resultIndex) => {
    const globalIdx = (currentPage - 1) * pageSize + resultIndex;
    return `
    <div class="result-card" data-result-idx="${globalIdx}">
        <div class="result-header">
            <div>
                <span class="status-badge ${
                    result.status === '已匹配' ? 'status-matched' :
                    result.status === '需要人工复核' ? 'status-review' : 'status-unmatched'
                }">${result.status}</span>
            </div>
            <div class="query-name">${result.queryName}</div>
        </div>
        ${result.minPriceItem && result.minPriceItem.title ? `
            <div class="min-price-detail">
                <div style="font-weight: 500;">${result.minPriceItem.original_title || result.minPriceItem.title}</div>
                ${result.minPriceItem.link ? `<div>链接: <a href="${result.minPriceItem.link}" target="_blank">查看</a></div>` : ''}
            </div>
        ` : ''}
        ${result.candidates && result.candidates.filter(c=>c).length > 0 ? `
            <div class="candidates-section" id="candidates-section-${globalIdx}">
                <div class="candidates-grid" id="candidates-grid-${globalIdx}">
                </div>
            </div>
        ` : ''}
    </div>
    `}).join('');

console.log('OK! HTML length:', container.innerHTML.length);
