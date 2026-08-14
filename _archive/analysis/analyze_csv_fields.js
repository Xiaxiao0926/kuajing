const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const DATA_DIR = 'E:\\Desktop\\坪优报价分析\\市场价';

function parseCSV(filePath, maxRows = 10) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv({ skipLines: 0 }))
      .on('data', (row) => {
        if (results.length < maxRows) results.push(row);
      })
      .on('end', () => resolve(results))
      .on('error', (err) => {
        console.log(`  UTF8失败，尝试GBK...`);
        const iconv = require('iconv-lite');
        const results2 = [];
        fs.createReadStream(filePath)
          .pipe(iconv.decodeStream('gbk'))
          .pipe(csv({ skipLines: 0 }))
          .on('data', (row) => {
            if (results2.length < maxRows) results2.push(row);
          })
          .on('end', () => resolve(results2))
          .on('error', reject);
      });
  });
}

function findTitleFields(headers) {
  return headers
    .filter(h => h.startsWith('title--ASSt27UY'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+$/)?.[0] || '1');
      const numB = parseInt(b.match(/\d+$/)?.[0] || '1');
      return numA - numB;
    });
}

function findSkcolorFields(headers) {
  return headers
    .filter(h => h.startsWith('skcolor_ljg'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+$/)?.[0] || '1');
      const numB = parseInt(b.match(/\d+$/)?.[0] || '1');
      return numA - numB;
    });
}

async function analyzeTaobao() {
  console.log('\n' + '='.repeat(80));
  console.log('淘宝 CSV 文件分析 (title--ASSt27UY 系列字段)');
  console.log('='.repeat(80));

  const taobaoFiles = ['s (1).csv', 's (50).csv', 's (5).csv'];

  for (const file of taobaoFiles) {
    const filePath = path.join(DATA_DIR, file);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`文件: ${file}`);
    console.log(`${'─'.repeat(60)}`);

    try {
      const rows = await parseCSV(filePath, 10);
      if (rows.length === 0) {
        console.log('  (无数据)');
        continue;
      }

      const headers = Object.keys(rows[0]);
      const titleFields = findTitleFields(headers);
      const textFields = headers.filter(h => h.startsWith('text--eAiSCa_r')).sort();

      console.log(`\n表头中 title--ASSt27UY 系列字段 (共${titleFields.length}个):`);
      titleFields.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));

      console.log(`\n表头中 text--eAiSCa_r 系列字段 (共${textFields.length}个):`);
      textFields.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));

      console.log(`\n前${rows.length}行数据 (仅 title 和 text 系列字段):`);
      console.log('─'.repeat(60));

      rows.forEach((row, rowIdx) => {
        console.log(`\n  第${rowIdx + 1}行:`);
        titleFields.forEach((field, i) => {
          const val = row[field] || '';
          if (val) console.log(`    title--ASSt27UY ${i + 1}: [${val}]`);
        });
        textFields.forEach((field, i) => {
          const val = row[field] || '';
          if (val) console.log(`    text--eAiSCa_r ${i + 1}: [${val}]`);
        });
      });
    } catch (err) {
      console.log(`  读取失败: ${err.message}`);
    }
  }
}

async function analyzeJD() {
  console.log('\n' + '='.repeat(80));
  console.log('京东 CSV 文件分析 (_newStyle_1k2fi_39 和 skcolor_ljg 系列字段)');
  console.log('='.repeat(80));

  const jdFiles = ['search (1).csv', 'search (5).csv', 'search (50).csv'];

  for (const file of jdFiles) {
    const filePath = path.join(DATA_DIR, file);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`文件: ${file}`);
    console.log(`${'─'.repeat(60)}`);

    try {
      const rows = await parseCSV(filePath, 10);
      if (rows.length === 0) {
        console.log('  (无数据)');
        continue;
      }

      const headers = Object.keys(rows[0]);
      const skcolorFields = findSkcolorFields(headers);
      const hasNewStyle = headers.includes('_newStyle_1k2fi_39');

      console.log(`\n表头中 skcolor_ljg 系列字段 (共${skcolorFields.length}个):`);
      skcolorFields.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));
      console.log(`_newStyle_1k2fi_39 字段: ${hasNewStyle ? '存在' : '不存在'}`);

      console.log(`\n前${rows.length}行数据:`);
      console.log('─'.repeat(60));

      rows.forEach((row, rowIdx) => {
        console.log(`\n  第${rowIdx + 1}行:`);
        if (hasNewStyle) {
          const val = row['_newStyle_1k2fi_39'] || '';
          console.log(`    _newStyle_1k2fi_39: [${val}]`);
        }
        skcolorFields.forEach((field, i) => {
          const val = row[field] || '';
          if (val) console.log(`    skcolor_ljg ${i + 1}: [${val}]`);
        });
      });
    } catch (err) {
      console.log(`  读取失败: ${err.message}`);
    }
  }
}

async function main() {
  await analyzeTaobao();
  await analyzeJD();

  console.log('\n' + '='.repeat(80));
  console.log('字段内容模式总结');
  console.log('='.repeat(80));

  console.log(`
【淘宝 title--ASSt27UY 系列字段分析】

这些字段是淘宝搜索结果页中商品标题区域的各个span元素，按顺序排列。
字段数量不固定（6~9个），内容模式如下：

  title--ASSt27UY 1: 产品名称/描述（核心关键词，如"2.0紧急灭火队棒次抛精华"）
  title--ASSt27UY 2: 品牌（如"可复美"、"DW"、"皇冠"）
  title--ASSt27UY 3: 产品类型/成分（如"胶原"、"粉底"、"黄油"）
  title--ASSt27UY 4: 数量/容量/规格（如"30"、"液"、"可可"）→ 不固定
  title--ASSt27UY 5: 单位/其他属性（如"支"、"组"、"抱抱"）→ 不固定
  title--ASSt27UY 6+: 可能是更多属性标签（如"否"、"修护"、"印尼"等）
  末尾的 title--ASSt27UY 7~9: 通常是补充信息（如容量规格"1.5ml*30支"、单位"支"等）

  注意：这些字段是网页DOM元素的直接映射，位置不固定！
  同一位置在不同商品中可能是不同类型的内容。

【京东 _newStyle_1k2fi_39 和 skcolor_ljg 系列字段分析】

  _newStyle_1k2fi_39: 商品完整标题（如"科颜氏（Kiehl's）金盏花植物精萃爽肤水250ml"）
  skcolor_ljg 1: 品牌/子品牌（如"科颜氏"、"润百颜"）或规格（如"维他命水"）
  skcolor_ljg 2: 产品系列/口味（如"金盏花"、"柑橘风味"）或规格（如"次抛精华30支"）
  skcolor_ljg 3: 具体规格（如"爽肤水250ml"、"250ml"）
  skcolor_ljg 4+: 更多规格信息（如"12瓶"、"瓶"）

  注意：skcolor_ljg 字段在很多商品中为空，只有部分商品有值。
  不同文件的 skcolor_ljg 字段数量不同（3~6个）。
`);
}

main().catch(console.error);
