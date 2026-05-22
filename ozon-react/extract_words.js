const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
  'D:/ozon/市场分析/发膜热销品2026-05-08.xlsx',
  'D:/ozon/市场分析/手套热销产品2026-05-12.xlsx',
  'D:/ozon/市场分析/护发喷雾热销产品2026-05-08.xlsx',
  'D:/ozon/市场分析/枕头热销产品2026-05-08.xlsx',
  'D:/ozon/市场分析/矫形枕热销产品2026-05-07.xlsx'
];

const STOP = new Set(['и','в','на','с','для','от','по','к','у','о','а','но','не','из','за','то','со','до','без','как','что','это','все','он','она','они','мы','вы','его','ее','их','этот','тот','мой','ваш','под','над','при','про','через','между','the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','can','shall','to','of','in','for','on','with','at','by','from','as','into','through','and','but','or','not','so','yet','it','its','this','that','i','me','my','we','our','you','your','he','him','his','she','her','they','them','their','which','who','what','where','when','how','шт','штука','комплект','набор','упаковка','размер','цвет','тип','модель','арт','pc','pcs','set','kit','pack','size','color','type','model','item','new','1','2','3','4','5','10','20','30','50','100','200','500','1000','fbo','fbs','ozon','ро','руб','rub']);

const wordStats = {};

files.forEach(f => {
  if (!fs.existsSync(f)) { console.log('SKIP:', f); return; }
  const wb = XLSX.readFile(f);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  if (!data || data.length === 0) return;
  
  const keys = Object.keys(data[0]);
  const nameCol = keys.find(k => /назван|name|商品|产品|наименован/i.test(k)) || keys[1];
  
  data.forEach(row => {
    const name = String(row[nameCol] || '');
    const words = name.toLowerCase()
      .replace(/[^\wа-яёА-ЯЁ-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
    
    const unique = [...new Set(words)];
    unique.forEach(w => {
      if (!wordStats[w]) wordStats[w] = { count: 0, files: [] };
      wordStats[w].count++;
      if (!wordStats[w].files.includes(path.basename(f))) wordStats[w].files.push(path.basename(f));
    });
  });
});

const sorted = Object.entries(wordStats)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 200);

sorted.forEach(([word, info]) => {
  const isRu = /[а-яё]/i.test(word);
  console.log(JSON.stringify({ word, count: info.count, isRu, files: info.files.join(',') }));
});
