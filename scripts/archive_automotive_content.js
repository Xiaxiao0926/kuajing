const fs = require('fs');
const path = require('path');

const brain = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\a42cab7e-4b01-4329-a9cf-81e7795cffa4';
const destRoot = 'd:\\ozon\\content_production\\automotive';

const mapping = [
  { dir: 'standards', patterns: ['FYZSXNB-VISUAL-SYSTEM-3.0', 'FYZSXNB-FRONTEND-PUBLIC-COPY', 'VISUAL_RELEASE_CHECKLIST', 'VISUAL-FACT-MATRIX', 'FYZSXNB-AUTOMOTIVE-VISUAL-UPGRADE-ACCEPTANCE-REPORT'] },
  { dir: 'phase1_cases/case_001_tayron', patterns: ['FYZSXNB-AUTOMOTIVE-CASE-001', 'tayron'] },
  { dir: 'phase1_cases/case_002_monjaro', patterns: ['FYZSXNB-AUTOMOTIVE-CASE-002', 'monjaro'] },
  { dir: 'phase1_cases/case_003_tiggo8', patterns: ['FYZSXNB-AUTOMOTIVE-CASE-003', 'tiggo'] },
  { dir: 'phase2_matrix/00_matrix_research', patterns: ['FYZSXNB-AUTOMOTIVE-PHASE2-CONTENT-MATRIX', 'FYZSXNB-AUTOMOTIVE-INTELLIGENCE-PHASE2-ROADMAP'] },
  { dir: 'phase2_matrix/article_004_macro_whitepaper', patterns: ['FYZSXNB-AUTOMOTIVE-ARTICLE-004', 'aftermarket_infrastructure', 'three_stage_globalization', 'crossborder_parts_supply'] },
  { dir: 'phase2_matrix/article_001_nev_high_voltage', patterns: ['FYZSXNB-AUTOMOTIVE-ARTICLE-001', 'ev_diagnostics', 'ev_protocol', 'hv_isolation', 'hv_supply'] },
  { dir: 'phase2_matrix/article_002_adas_calibration', patterns: ['FYZSXNB-AUTOMOTIVE-ARTICLE-002', 'adas_calibration', 'adas_sensor_fov', 'adas_5step_workflow'] },
  { dir: 'phase2_matrix/article_003_software_localization', patterns: ['FYZSXNB-AUTOMOTIVE-ARTICLE-003', 'software_localization'] }
];

const allFiles = fs.readdirSync(brain);
let copiedCount = 0;

for (const item of mapping) {
  const targetDir = path.join(destRoot, item.dir);
  fs.mkdirSync(targetDir, { recursive: true });
  for (const f of allFiles) {
    if (f.endsWith('.metadata.json') || f.startsWith('.')) continue;
    if (item.patterns.some(p => f.includes(p))) {
      const src = path.join(brain, f);
      const dest = path.join(targetDir, f);
      fs.copyFileSync(src, dest);
      copiedCount++;
      console.log('Copied ' + f + ' -> ' + item.dir);
    }
  }
}
console.log('Total archived files: ' + copiedCount);
