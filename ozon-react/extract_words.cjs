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

const STOP = new Set(['и','в','на','с','для','от','по','к','у','о','а','но','не','из','за','то','со','до','без','как','что','это','все','он','она','они','мы','вы','его','ее','их','этот','тот','мой','ваш','под','над','при','про','через','между','шт','штука','комплект','набор','упаковка','размер','цвет','тип','модель','арт','pc','pcs','set','kit','pack','fbo','fbs','ozon','ро','руб','rub','the','and','for','with','from','not','new','all','can','has','its','you','are','was','her','him','she','they','them','his','our','your','will','would','could','should','may','might','shall','into','than','that','this','these','those','which','where','when','what','how','who','whom','очень','ещё','уже','тоже','также','там','тут','здесь','вот','даже','лишь','почти','только','сейчас','потом','всегда','иногда','часто','редко','быстро','медленно','хорошо','плохо','много','мало','больше','меньше','первый','последний','другой','каждый','любой','самый','такой','следующий','простой','сложный','большой','маленький','высокий','низкий','длинный','короткий','широкий','узкий','толстый','тонкий','тяжёлый','лёгкий','крепкий','слабый','мягкий','твёрдый','горячий','холодный','мокрый','сухой','чистый','грязный','новый','старый','красивый','некрасивый','быстрый','медленный','сильный','слабый','белый','чёрный','красный','синий','зелёный','жёлтый','розовый','голубой','серый','коричневый','оранжевый','фиолетовый']);

const wordStats = {};

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const wb = XLSX.readFile(f);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  if (!data || data.length === 0) return;
  
  const nameCol = '商品名称';
  const catCol = '所属类目';
  
  data.forEach(row => {
    const name = String(row[nameCol] || '');
    const cat = String(row[catCol] || '');
    const combined = (name + ' ' + cat).toLowerCase();
    const words = combined
      .replace(/[^\wа-яёА-ЯЁ-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
    
    const unique = [...new Set(words)];
    unique.forEach(w => {
      if (!wordStats[w]) wordStats[w] = { count: 0, files: new Set(), examples: [] };
      wordStats[w].count++;
      wordStats[w].files.add(path.basename(f));
      if (wordStats[w].examples.length < 2) {
        wordStats[w].examples.push(name.substring(0, 80));
      }
    });
  });
});

const sorted = Object.entries(wordStats)
  .filter(([w]) => /[а-яё]/i.test(w))
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 250);

const result = sorted.map(([word, info]) => ({
  word,
  count: info.count,
  files: [...info.files].join(','),
  example: info.examples[0] || ''
}));

fs.writeFileSync('d:/ozon/ozon-react/extracted_words.json', JSON.stringify(result, null, 2), 'utf-8');
console.log('Written ' + result.length + ' words to extracted_words.json');
