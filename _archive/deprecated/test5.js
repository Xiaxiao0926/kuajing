const http = require('http');
const fs = require('fs');

http.get('http://localhost:8888/', res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        fs.writeFileSync('d:\\ozon\\public\\served.html', d);
        console.log('Saved, length:', d.length);

        // 检查是否包含 updateMinPrice
        console.log('Has updateMinPrice:', d.includes('updateMinPrice'));
        console.log('Has data-result-idx:', d.includes('data-result-idx'));

        // 检查script标签
        const scriptMatch = d.match(/<script>([\s\S]*)<\/script>/);
        if (scriptMatch) {
            fs.writeFileSync('d:\\ozon\\public\\served_script.js', scriptMatch[1]);
            console.log('Script length:', scriptMatch[1].length);
        }
    });
}).on('error', e => console.log('Error:', e.message));
