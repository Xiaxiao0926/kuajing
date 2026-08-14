const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const MARKET_FOLDER = 'E:\\Desktop\\坪优报价分析\\市场价';
const files = fs.readdirSync(MARKET_FOLDER).filter(f => f.startsWith('s') && f.endsWith('.csv') && !f.startsWith('search'));

async function findCrown() {
    let found = 0;
    for (const fname of files) {
        const file = path.join(MARKET_FOLDER, fname);
        const results = [];
        await new Promise((resolve) => {
            fs.createReadStream(file).pipe(csv()).on('data', row => results.push(row)).on('end', resolve);
        });
        for (const r of results) {
            const vals = Object.values(r).map(v => String(v));
            if (vals.some(v => v.includes('皇冠') || v.includes('DANISA'))) {
                console.log('=== ' + fname + ' ===');
                Object.entries(r).forEach(([k, v]) => {
                    if (v && String(v).trim()) console.log('  ' + k.substring(0, 35) + ': ' + v);
                });
                console.log('');
                found++;
                if (found >= 3) return;
            }
        }
    }
    console.log('Found', found, 'records');
}

findCrown();
