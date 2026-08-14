const fs = require('fs');
const d = fs.readFileSync('d:\\ozon\\public\\served_script.js', 'utf-8');
const start = d.indexOf('function renderResults()');
const end = d.indexOf('function renderPagination');
const rr = d.substring(start, end);
fs.writeFileSync('d:\\ozon\\public\\rr_func.js', rr);
