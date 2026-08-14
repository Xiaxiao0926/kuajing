const fs = require('fs');
let code = fs.readFileSync('d:\\ozon\\analyze_with_cleaned_data.js', 'utf8');

// 在candidates生成后加调试
const oldCandidates = `            const candidates = [];`;
const newCandidates = `            if (supplierProduct.name.includes('腾塔堡巴罗萨赤霞珠')) {
                console.log('CANDIDATES from topCandidates:');
                topCandidates.forEach((tc, i) => {
                    console.log('  tc' + i + ': sim=' + tc.similarity + ' price=' + tc.price + ' review=' + (tc.needsReview||false) + ' ' + tc.title.substring(0, 30));
                });
            }
            const candidates = [];`;

code = code.replace(oldCandidates, newCandidates);
fs.writeFileSync('d:\\ozon\\debug_cand.js', code);
