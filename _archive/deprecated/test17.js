const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');

// 用vm.Script编译
const vm = require('vm');
try {
    new vm.Script(d, { filename: 'index.html' });
    console.log('VM Script compile: OK');
} catch(e) {
    console.log('VM Script error:', e.message);
}
