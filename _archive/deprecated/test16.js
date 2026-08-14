const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');

// 用vm模块在上下文中运行
const vm = require('vm');
const context = vm.createContext({
    window: {},
    document: {
        getElementById: () => ({ textContent: '', innerHTML: '', classList: { add:()=>{}, remove:()=>{}, contains:()=>false }, appendChild:()=>{}, querySelector:()=>null, querySelectorAll:()=>[] }),
        querySelectorAll: () => [],
        querySelector: () => null,
        createElement: () => ({ className:'', innerHTML:'', appendChild:()=>{}, classList:{add:()=>{},remove:()=>{}} }),
        addEventListener: () => {}
    },
    fetch: () => Promise.resolve({ json:()=>Promise.resolve({total:0,matchedCount:0,unmatchedCount:0,reviewCount:0,marketDataCount:0,updateTime:'',brandCount:{},typeCount:{},seriesCount:{},data:[]}), blob:()=>Promise.resolve(new Blob()) }),
    console,
    URL: { createObjectURL:()=>'', revokeObjectURL:()=>{} },
    Blob: class Blob {},
    setTimeout: (fn) => fn(),
    alert: () => {}
});

try {
    vm.compileScript(d, { filename: 'index.html' });
    console.log('VM compile: OK');
} catch(e) {
    console.log('VM compile error:', e.message);
}
