// T3-3 FragrancePricing 拆分脚本（一次性，执行后保留供审计）
// 逐字搬移：只改 import/export，不改任何逻辑。
const fs = require('fs');
const path = require('path');

const SRC = 'D:/ozon/ozon-react/src/components/FragrancePricing.jsx';
const ROOT = 'D:/ozon/ozon-react/src/components/fragrancePricing';
fs.mkdirSync(ROOT, { recursive: true });

const ori = fs.readFileSync(SRC, 'utf-8').split(/\r?\n/);
if (ori.length !== 657) { console.error(`[split-fp] 行数异常: ${ori.length}`); process.exit(1); }

const anchors = [
  [14, 'const CHANNEL_PRESETS = {'],
  [22, 'const COMPETITORS = ['],
  [73, 'function calcProfit(p) {'],
  [86, 'function getProfitLevel(netRate) {'],
  [93, 'function generateReport(planA, planB, resultA, resultB) {'],
  [189, 'function InputField({ label, value, onChange, suffix, step, min, max }) {'],
  [209, 'function PlanPanel({ title, plan, onChange, color }) {'],
  [233, 'export default function FragrancePricing({ nodeId = \'n36\', status = \'pending\', onStatusChange }) {'],
];
for (const [n, text] of anchors) {
  if (ori[n - 1].trim() !== text.trim()) {
    console.error(`[split-fp] 锚点不符 L${n}: 期望 "${text.trim()}" 实际 "${ori[n - 1].trim()}"`);
    process.exit(1);
  }
}
console.log('[split-fp] 锚点校验通过');

// ---- data.js: L14-187 常量+计算函数 ----
let data = ori.slice(13, 187).join('\n');
for (const s of ['const CHANNEL_PRESETS', 'const COMPETITORS', 'const TIER_LABELS', 'const TIER_COLORS', 'const PRICE_BANDS', 'const AD_COST_BY_PRICE']) {
  data = data.replace(s, 'export ' + s);
}
data = data.replace('function calcProfit', 'export function calcProfit')
  .replace('function getProfitLevel', 'export function getProfitLevel')
  .replace('function generateReport', 'export function generateReport');
fs.writeFileSync(path.join(ROOT, 'data.js'), data + '\n', 'utf-8');
console.log('[split-fp] data.js (常量+利润计算+报告生成)');

// ---- InputField.jsx (L189-207) ----
const inputSrc = ori.slice(188, 207).join('\n').replace('function InputField', 'export function InputField') + '\n';
fs.writeFileSync(path.join(ROOT, 'InputField.jsx'), inputSrc, 'utf-8');
console.log('[split-fp] InputField.jsx');

// ---- PlanPanel.jsx (L209-231) ----
const planBody = ori.slice(208, 231).join('\n').replace('function PlanPanel', 'export function PlanPanel');
const planSrc = [
  "import { CHANNEL_PRESETS } from './data'",
  "import { InputField } from './InputField'",
  '',
  planBody,
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'PlanPanel.jsx'), planSrc, 'utf-8');
console.log('[split-fp] PlanPanel.jsx');

// ---- 主文件：imports(L1-12) + 主组件(L233-657) ----
const mainBody = ori.slice(232, 657).join('\n');
const main = ori.slice(0, 12).join('\n') + '\n' +
  "import { CHANNEL_PRESETS, COMPETITORS, TIER_LABELS, TIER_COLORS, PRICE_BANDS, AD_COST_BY_PRICE, calcProfit, getProfitLevel, generateReport } from './fragrancePricing/data'\n" +
  "import { PlanPanel } from './fragrancePricing/PlanPanel'\n\n" +
  mainBody + '\n';
fs.writeFileSync(SRC, main, 'utf-8');
console.log('[split-fp] FragrancePricing.jsx 保留主组件编排');
