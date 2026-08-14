const fs = require('fs');
const script = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');

// 模拟浏览器环境
const mockWindow = {
    document: {
        getElementById: () => ({ textContent: '', innerHTML: '', classList: { add: ()=>{}, remove: ()=>{} } }),
        querySelectorAll: () => [],
        querySelector: () => null,
        createElement: () => ({ className: '', innerHTML: '', appendChild: () => {} })
    },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}), blob: () => Promise.resolve({}) }),
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    addEventListener: () => {}
};

try {
    const fn = new Function('window', 'document', 'fetch', script);
    console.log('Script compiled successfully');
} catch(e) {
    console.log('Compilation error:', e.message);
    // 找到错误行
    const lines = script.split('\n');
    const lineMatch = e.message.match(/line (\d+)/i);
    if (lineMatch) {
        const lineNum = parseInt(lineMatch[1]);
        console.log('Around line', lineNum);
        for (let i = Math.max(0, lineNum-3); i < Math.min(lines.length, lineNum+3); i++) {
            console.log((i+1) + ': ' + lines[i]);
        }
    }
}
