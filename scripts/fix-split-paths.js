// 一次性修复：三个 split 脚本的 D:/ozon 绝对路径 → repo-relative（T3 cleanup）
// 注意：原写法是 const SRC = 'D:/ozon/...'; 单引号字符串。
// 正确替换：'D:/ozon/ozon-react/xxx' → `\${REPO_ROOT}/ozon-react/xxx`（模板字符串）
const fs = require('fs');
const path = require('path');

const FILES = ['split-newdashboard.js', 'split-wbcalc.js', 'split-fragrance.js'];

for (const f of FILES) {
  const p = path.join(__dirname, f);
  let s = fs.readFileSync(p, 'utf-8');

  // 1) 插入 REPO_ROOT
  if (!s.includes('const REPO_ROOT')) {
    s = s.replace("const path = require('path');", "const path = require('path');\n\nconst REPO_ROOT = path.resolve(__dirname, '..');");
  }

  // 2) 字符串内绝对路径 → 模板字符串
  //    'D:/ozon/ozon-react/src/...'  →  `${REPO_ROOT}/ozon-react/src/...`
  s = s.replace(/'D:\/ozon\/ozon-react([^']*)'/g, '`${REPO_ROOT}/ozon-react$1`');
  //    'D:/ozon/scripts/...'         →  `${REPO_ROOT}/scripts/...`
  s = s.replace(/'D:\/ozon\/scripts([^']*)'/g, '`${REPO_ROOT}/scripts$1`');
  //    兜底：其它 D:/ozon 出现（应无）
  s = s.replace(/'D:\/ozon([^']*)'/g, '`${REPO_ROOT}$1`');

  fs.writeFileSync(p, s, 'utf-8');
  console.log(`[cleanup] ${f} 已转换`);
}

// 校验：语法 + 无绝对路径残留
for (const f of FILES) {
  const p = path.join(__dirname, f);
  const s = fs.readFileSync(p, 'utf-8');
  if (/D:\/ozon/.test(s)) {
    console.error(`[cleanup] ${f} 仍残留绝对路径`);
    process.exitCode = 1;
  } else {
    console.log(`[cleanup] ${f} ✓ 无绝对路径`);
  }
}
