const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\check.js', 'utf-8');
const lines = d.split('\n');
let backtickCount = 0;
for (let i = 100; i < 150; i++) {
    const line = lines[i];
    if (!line) continue;
    let count = 0;
    for (const ch of line) {
        if (ch === '`') count++;
    }
    if (count > 0) {
        backtickCount += count;
        console.log(`Line ${i+1}: backticks=${count} total=${backtickCount} | ${line.trim().substring(0, 80)}`);
    }
}
