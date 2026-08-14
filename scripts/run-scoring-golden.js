// scripts/run-scoring-golden.js — T4-3 黄金评分案例跑器
// 读取 tests/scoring-golden/*.json（纯数据固件），逐 case 跑 scoreProduct/buildExplanations 并断言。
// 断言 op：eq/neq/gt/gte/lt/lte/oneOf/includes/notIncludes/isNull/notNull/finite
//        explanationContains/explanationNotContains（合并 strengths+risks+missingMetrics 检查文案口径）
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const GOLDEN_DIR = path.join(ROOT, 'tests', 'scoring-golden');

function resolvePath(obj, p) {
  return p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function check(op, actual, expected, result, candidate, marketContext, explanations) {
  switch (op) {
    case 'eq': return Object.is(actual, expected);
    case 'neq': return !Object.is(actual, expected);
    case 'gt': return typeof actual === 'number' && actual > expected;
    case 'gte': return typeof actual === 'number' && actual >= expected;
    case 'lt': return typeof actual === 'number' && actual < expected;
    case 'lte': return typeof actual === 'number' && actual <= expected;
    case 'oneOf': return Array.isArray(expected) && expected.some((v) => Object.is(actual, v));
    case 'includes': return Array.isArray(actual) && actual.includes(expected);
    case 'notIncludes': return !Array.isArray(actual) || !actual.includes(expected);
    case 'isNull': return actual === null || actual === undefined;
    case 'notNull': return actual !== null && actual !== undefined;
    case 'finite': return typeof actual === 'number' && Number.isFinite(actual);
    case 'explanationContains': return explanations.some((s) => s.includes(expected));
    case 'explanationNotContains': return !explanations.some((s) => s.includes(expected));
    default: throw new Error(`unknown op: ${op}`);
  }
}

async function main() {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'scoring_rules.json'), 'utf-8'));
  const { scoreProduct } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'scoring', 'scoringEngine.js')).href);
  const { buildExplanations } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'scoring', 'explanations.js')).href);
  const { calcShipping, ALL_CHANNELS } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'ozonEngine.js')).href);

  const effPriceOf = (c) => (c.price_rub > 0 ? c.price_rub : (c.avg_price_rub && c.avg_price_rub > 0 ? c.avg_price_rub : null));
  const dimsValid = (c) => Array.isArray(c.dims) && c.dims.length === 3 && c.dims.every((v) => v !== null && v !== undefined && v > 0);
  const celChannels = (c) => {
    if (!(c.weight_kg > 0) || !dimsValid(c)) return [];
    const p = effPriceOf(c) ?? 1;
    const out = [];
    for (const ch of ALL_CHANNELS) {
      const res = calcShipping(ch, p, c.weight_kg, c.dims[0], c.dims[1], c.dims[2]);
      if (res) out.push(res);
    }
    return out;
  };

  const files = fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) { console.error('未找到黄金固件 tests/scoring-golden/*.json'); process.exit(1); }

  let pass = 0, fail = 0;
  console.log('\n===== T4-3 黄金评分案例 =====\n');
  for (const f of files) {
    const fx = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, f), 'utf-8'));
    const deps = { candidatePool: fx.pool, rubPerCny: fx.rubPerCny ?? 12, calcCelShipping: celChannels };
    for (const cs of fx.cases) {
      const r = scoreProduct(cs.candidate, cs.marketContext, deps, rules);
      const ex = buildExplanations(cs.candidate, r, cs.marketContext);
      const exAll = [...ex.strengths, ...ex.risks, ...ex.missingMetrics];
      for (const a of cs.expect) {
        const actual = a.path ? resolvePath(r, a.path) : undefined;
        const ok = check(a.op, actual, a.value, r, cs.candidate, cs.marketContext, exAll);
        if (ok) {
          pass++;
          console.log(`  ✅ ${f} / ${cs.name}: ${a.path || a.op} ${a.op} ${a.value === undefined ? '' : JSON.stringify(a.value)}`);
        } else {
          fail++;
          console.log(`  ❌ ${f} / ${cs.name}: ${a.path || a.op} ${a.op} ${JSON.stringify(a.value)} → 实际 ${JSON.stringify(actual)} (totalScore=${r.totalScore}, grade=${r.grade})`);
        }
      }
    }
  }
  console.log(`\n===== 黄金案例结果: ${pass} 通过 / ${fail} 失败 =====\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
