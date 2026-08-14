const http = require('http');
const fs = require('fs');

// 创建一个简单的HTML测试页面，内嵌JS并检查是否有错误
const html = fs.readFileSync('d:\\ozon\\public\\index.html', 'utf-8');

// 检查script标签中的代码是否能在浏览器中运行
// 用JSDOM模拟
try {
    const { JSDOM } = require('jsdom');
    console.log('JSDOM available');
} catch(e) {
    console.log('JSDOM not available, trying different approach');
}

// 直接用Node的vm运行完整脚本
const vm = require('vm');
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (scriptMatch) {
    const context = vm.createContext({
        window: { addEventListener:()=>{}, location:{href:''} },
        document: {
            getElementById: (id) => ({
                textContent: '', innerHTML: '', classList: { add:()=>{}, remove:()=>{}, contains:()=>false },
                appendChild:()=>{}, querySelector:()=>null, querySelectorAll:()=>[],
                style: {}
            }),
            querySelectorAll: () => [],
            querySelector: () => null,
            createElement: (tag) => ({
                tagName: tag.toUpperCase(), className:'', innerHTML:'', appendChild:()=>{},
                classList:{add:()=>{},remove:()=>{}}, style:{}, setAttribute:()=>{},
                addEventListener:()=>{}
            }),
            addEventListener: () => {},
            body: { appendChild:()=>{} }
        },
        fetch: (url) => Promise.resolve({
            json: () => Promise.resolve({
                total:233, matchedCount:219, unmatchedCount:14, reviewCount:0,
                marketDataCount:8888, updateTime:'test',
                brandCount:{}, typeCount:{}, seriesCount:{}, data:[]
            }),
            blob: () => Promise.resolve({})
        }),
        console,
        URL: { createObjectURL:()=>'', revokeObjectURL:()=>{} },
        setTimeout: (fn,ms) => {},
        alert: () => {},
        Blob: class Blob {}
    });

    try {
        vm.runInContext(scriptMatch[1], context, { filename: 'index.html', timeout: 5000 });
        console.log('Script executed successfully!');
    } catch(e) {
        console.log('Runtime error:', e.message);
        console.log('Stack:', e.stack?.substring(0, 500));
    }
}
