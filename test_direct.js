delete require.cache[require.resolve('./analyze_with_cleaned_data.js')];
const {analyzePrices, readSupplierQuotes, loadCleanedMarketData} = require('./analyze_with_cleaned_data.js');
const products = readSupplierQuotes();
const market = loadCleanedMarketData();
const results = analyzePrices(products, market);
const r = results.find(r => r.queryName.includes('腾塔堡巴罗萨赤霞珠'));
console.log('candidates:');
r.candidates.forEach((c, i) => {
    if (c) console.log(`  ${i+1}: ${c.title.substring(0,50)} price=${c.price} sim=${c.similarity}% needsReview=${c.needsReview}`);
});
