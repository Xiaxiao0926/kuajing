#!/usr/bin/env node
/**
 * 双端对拍脚本（T2-4 起正式启用）
 *
 * 读 config/*.json → 分别喂 React 引擎（wbEngine.js）与 Python wb_calc.py
 * → 对同一组边界用例输出 diff，零差异才通过（退出码 0）。
 *
 * 运行：npm run test:sync（前置自动 sync-config）
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'config');

// 与 T2-1-行为冻结快照.md §3 一致的边界重量组
const WEIGHTS = [1, 80, 100, 101, 270, 300, 301, 400, 401, 500, 800, 1000, 1050, 2000, 20000, 20001];

// Python 启动器探测（与 run-wb-py-test.js 相同策略）
function pythonCmd() {
  for (const c of [
    { cmd: 'py', args: ['-3'] },
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
  ]) {
    const probe = spawnSync(c.cmd, [...c.args, '--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
    if (probe.status === 0) return c;
  }
  return null;
}

async function main() {
  if (!fs.existsSync(CONFIG_DIR)) {
    console.log('[test:sync] SKIP — config/ 不存在');
    process.exit(0);
  }

  // ---- React 端 ----
  const { calculateParcelLogistics } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'wbEngine.js')).href);
  const { DEFAULT_TARIFFS } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'wbConfig.js')).href);
  const dpx0722 = DEFAULT_TARIFFS.find((t) => t.tariffId === 'DPX-SZ-382822-20260722');

  const reactResults = {};
  for (const w of WEIGHTS) {
    const r = calculateParcelLogistics(w, dpx0722);
    reactResults[w] = { billableWeightKg: r.billableWeightKg, feeCny: r.feeCny };
  }

  // ---- Python 端 ----
  const py = pythonCmd();
  if (!py) {
    console.error('[test:sync] 未找到 Python 解释器，无法对拍');
    process.exit(1);
  }
  const pyScript = `
import sys, json, os
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'ozon-product-analyzer'))})
import wb_calc, wb_data
tariff = next((t for t in wb_data.DEFAULT_TARIFFS if t['tariff_id'] == 'DPX-SZ-382822-20260722'), None)
if tariff is None:
    print(json.dumps({'error': 'tariff not found'}), file=sys.stderr); sys.exit(1)
out = {}
for w in [${WEIGHTS.join(',')}]:
    r = wb_calc.calculate_parcel_logistics(w, tariff)
    out[str(w)] = {'billable_weight_kg': float(r['billable_weight_kg']) if r['billable_weight_kg'] is not None else None,
                   'fee_cny': float(r['fee_cny']) if r['fee_cny'] is not None else None}
print(json.dumps(out))
`;
  const tmpPy = path.join(ROOT, '_audit', 'tmp', 'verify_sync_cases.py');
  fs.mkdirSync(path.dirname(tmpPy), { recursive: true });
  fs.writeFileSync(tmpPy, pyScript, 'utf-8');
  const pyRun = spawnSync(py.cmd, [...py.args, tmpPy], { stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });
  if (pyRun.status !== 0) {
    console.error('[test:sync] Python 执行失败');
    process.exit(1);
  }
  let pyResults;
  try {
    pyResults = JSON.parse(pyRun.stdout.toString());
  } catch (e) {
    console.error('[test:sync] Python 输出解析失败:', e.message);
    console.error(pyRun.stdout.toString().slice(0, 500));
    process.exit(1);
  }

  // ---- Diff ----
  let diffCount = 0;
  for (const w of WEIGHTS) {
    const js = reactResults[w];
    const pyv = pyResults[String(w)];
    const jsBillable = js.billableWeightKg === null ? null : Math.round(js.billableWeightKg * 1000) / 1000;
    const jsFee = js.feeCny === null ? null : Math.round(js.feeCny * 100) / 100;
    const pyBillable = pyv.billable_weight_kg === null ? null : Math.round(pyv.billable_weight_kg * 1000) / 1000;
    const pyFee = pyv.fee_cny === null ? null : Math.round(pyv.fee_cny * 100) / 100;
    const billableOk = jsBillable === pyBillable;
    const feeOk = jsFee === pyFee;
    if (!billableOk || !feeOk) {
      diffCount++;
      console.log(`  ❌ ${w}g: React(计费 ${jsBillable}kg, 费 ${jsFee}¥) vs Python(计费 ${pyBillable}kg, 费 ${pyFee}¥)`);
    }
  }

  // 版本选择对拍
  const verPy = `
import sys, json, os
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'ozon-product-analyzer'))})
import wb_calc, wb_data
out = {}
for d in ['2026-07-21', '2026-07-22']:
    t = wb_calc.select_tariff_version('DPX-SZ-382822', d, wb_data.DEFAULT_TARIFFS)
    out[d] = t['effective_from'] if t else None
print(json.dumps(out))
`;
  fs.writeFileSync(tmpPy, verPy, 'utf-8');
  const verRun = spawnSync(py.cmd, [...py.args, tmpPy], { stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });
  const verPyOut = JSON.parse(verRun.stdout.toString());
  const { selectTariffVersion } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'wbEngine.js')).href);
  for (const d of ['2026-07-21', '2026-07-22']) {
    const jsV = selectTariffVersion('DPX-SZ-382822', d, DEFAULT_TARIFFS);
    const jsEff = jsV ? jsV.effectiveFrom : null;
    if (jsEff !== verPyOut[d]) {
      diffCount++;
      console.log(`  ❌ 版本选择 ${d}: React(${jsEff}) vs Python(${verPyOut[d]})`);
    }
  }

  if (diffCount > 0) {
    console.log(`\n[test:sync] 对拍失败: ${diffCount} 处差异`);
    process.exit(1);
  }
  console.log(`\n[test:sync] 双端对拍零差异 (${WEIGHTS.length} 个重量边界 + 2 个版本边界)`);
  process.exit(0);
}

main();
