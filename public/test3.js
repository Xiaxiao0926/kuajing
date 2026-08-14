const result = {
    minPriceItem: { title: 'test', link: 'http://test.com' },
    candidates: [{title: 'c1'}]
};

const html = result.minPriceItem && result.minPriceItem.title ? `
    <div class="min-price-detail">
        ${result.minPriceItem.link ? `<div>链接: <a href="${result.minPriceItem.link}" target="_blank">查看</a></div>` : ''}
    </div>
` : '';

console.log('OK', html.substring(0, 50));
