// scripts/verify-scoring-build.js — 生产冒烟守卫（P0 防护，轻量，无浏览器依赖）
// 在 vite build 之后运行：验证评分生产资产的完整性与路由契约。
// 1) manifest 存在且入口存在
// 2) manifest 中每个 chunk（含 imports/dynamicImports 引用）的产物文件都真实存在于 dist
// 3) 两个评分数据 JSON 存在且候选行数 = 1000（BSR 结构校验）
// 4) App 路由契约：__scoring__ 分支 + ProductScoringSection 静态 import
// 任一失败 → exit 1（deploy workflow 在 build 后调用，失败即阻断部署）
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'ozon-react', 'dist');
const PUBLIC_DATA = path.join(ROOT, 'ozon-react', 'public', 'data');

function fail(msg) {
  console.error(`[verify-scoring-build] ❌ ${msg}`);
  process.exit(1);
}

function main() {
  const manifestPath = path.join(DIST, '.vite', 'manifest.json');
  if (!fs.existsSync(manifestPath)) fail(`缺少 ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const entries = Object.values(manifest).filter((v) => v.isEntry);
  if (entries.length === 0) fail('manifest 无入口');

  // 收集所有引用的产物文件并逐一检查存在性
  const referenced = new Set();
  for (const v of Object.values(manifest)) {
    referenced.add(v.file);
    for (const key of ['imports', 'dynamicImports']) {
      for (const ref of v[key] || []) {
        const target = manifest[ref];
        if (!target) fail(`chunk ${v.file} 引用了 manifest 中不存在的 ${ref}`);
        referenced.add(target.file);
        (target.css || []).forEach((c) => referenced.add(c));
      }
    }
    (v.css || []).forEach((c) => referenced.add(c));
  }
  let missing = 0;
  for (const f of referenced) {
    if (!fs.existsSync(path.join(DIST, f))) { missing++; console.error(`  ❌ 缺产物: ${f}`); }
  }
  if (missing > 0) fail(`${missing} 个引用的产物文件缺失（FTP mirror --delete 部署将直接 404）`);
  console.log(`[verify-scoring-build] ✅ manifest 引用完整（${referenced.size} 个产物文件）`);

  // 评分数据资产（生产 dataBase 指向 GitHub raw main/public/data/）
  const candidatesPath = path.join(PUBLIC_DATA, 'scoring_candidates.json');
  if (!fs.existsSync(candidatesPath)) fail('缺少 public/data/scoring_candidates.json');
  const cDoc = JSON.parse(fs.readFileSync(candidatesPath, 'utf-8'));
  if (!Array.isArray(cDoc.candidates) || cDoc.candidates.length !== 1000) {
    fail(`scoring_candidates.json 候选行数 = ${Array.isArray(cDoc.candidates) ? cDoc.candidates.length : 'N/A'}（期望 1000）`);
  }
  const bsrPath = path.join(PUBLIC_DATA, 'bsr_market_benchmarks.json');
  if (!fs.existsSync(bsrPath)) fail('缺少 public/data/bsr_market_benchmarks.json');
  const bsr = JSON.parse(fs.readFileSync(bsrPath, 'utf-8'));
  if (!bsr.product_types || !bsr.domains) fail('bsr_market_benchmarks.json 缺少 product_types/domains');
  console.log('[verify-scoring-build] ✅ 评分数据资产完整（候选 1000 行 + BSR 基准结构）');

  // App 路由契约（源码级）
  const appSrc = fs.readFileSync(path.join(ROOT, 'ozon-react', 'src', 'App.jsx'), 'utf-8');
  if (!appSrc.includes("activeNode === '__scoring__'")) fail('App.jsx 缺少 __scoring__ 路由分支');
  if (!/import\s+ProductScoringSection\s+from\s+'\.\/components\/dashboard\/sections\/ProductScoringSection'/.test(appSrc)) {
    fail('App.jsx 缺少 ProductScoringSection 静态 import（P0 hotfix 契约）');
  }
  if (!appSrc.includes('WorkspacePageErrorBoundary')) fail('App.jsx 缺少 WorkspacePageErrorBoundary 包裹（永不白屏契约）');
  console.log('[verify-scoring-build] ✅ App 路由契约（__scoring__ 静态 import + ErrorBoundary）');

  // T5-4 UI 契约（源码级，轻量，不做 brittle snapshot）
  const scoringDir = path.join(ROOT, 'ozon-react', 'src', 'components', 'scoring');
  const readScoring = (f) => (fs.existsSync(path.join(scoringDir, f)) ? fs.readFileSync(path.join(scoringDir, f), 'utf-8') : '');
  const pageSrc = fs.readFileSync(path.join(ROOT, 'ozon-react', 'src', 'components', 'dashboard', 'sections', 'ProductScoringSection.jsx'), 'utf-8');
  if (!pageSrc.includes('SearchInput') && !readScoring('ScoringToolbar.jsx').includes('SearchInput')) fail('评分工作台缺少 SearchInput（搜索为第一筛选入口）');
  const tableSrc = readScoring('ScoringTable.jsx');
  if (!tableSrc.includes('DecisionBadge')) fail('评分表格缺少 DecisionBadge（Decision 列）');
  const drawerSrc = readScoring('ScoringDetailDrawer.jsx');
  if (!drawerSrc.includes('row.strengths') || !drawerSrc.includes('row.risks')) fail('Drawer 未消费 buildExplanations 的 strengths/risks 输出');
  // 子组件禁止手工计算：scoring/* 不得 import scoringEngine 或 scoring_rules；
  // 编排层 ProductScoringSection 允许 import scoringRules，但只能作为参数传给 scoreAllCandidates（唯一合法路径）。
  const subSources = [tableSrc, drawerSrc, readScoring('ScoringOverview.jsx'), readScoring('ScoringToolbar.jsx'), readScoring('ScoringPageHeader.jsx'), readScoring('ScoreCell.jsx'), readScoring('DecisionBadge.jsx'), readScoring('ContextBadge.jsx'), readScoring('RiskIndicators.jsx')].join('\n');
  if (/from\s+['"].*scoringEngine/.test(subSources) || /generated\/scoring_rules/.test(subSources)) fail('评分展示子组件禁止直接 import scoringEngine 或 scoring_rules（业务计算只允许在 Adapter）');
  if (!pageSrc.includes('scoreAllCandidates')) fail('编排层必须经由 scoringDataAdapter.scoreAllCandidates 计算（禁止绕过）');
  console.log('[verify-scoring-build] ✅ T5-4 UI 契约（SearchInput/DecisionBadge/Drawer 解释输出/无手工计算）');

  console.log('[verify-scoring-build] ✅ 全部通过');
}

main();
