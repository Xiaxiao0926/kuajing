import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const task = path.join(root, 'docs/ai-handoff/KJ-GEMINI-20260922-001');
const out = path.join(task, 'evidence/codex-review');
fs.mkdirSync(out, { recursive: true });
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const generated = () => Object.fromEntries(fs.readdirSync('ozon-react/src/generated').filter(f => fs.statSync(path.join('ozon-react/src/generated', f)).isFile()).map(f => [f, hash(path.join('ozon-react/src/generated', f))]));
const before = generated();
const source = fs.readFileSync(path.join(task, 'run-notice-visibility-tests.mjs'), 'utf8').replace(/\r\n/g, '\n');
let harness = source.replace("path.join(TASK_DIR, 'evidence')", "path.join(TASK_DIR, 'evidence/codex-review')");
function inject(anchor, replacement) {
  if (harness.split(anchor).length !== 2) throw new Error(`Non-unique anchor: ${anchor}`);
  harness = harness.replace(anchor, replacement);
}
inject('const projBId = initRes.pB.id;', `const projBId = initRes.pB.id;
const readB = () => page.evaluate(pid => {
  const project = window.__t6Store.getProject(pid);
  return { project, snapshot: window.__t6Store.getSnapshot(project.source.creationSnapshotId), scenarios: window.__t6Store.getProjectScenarios(pid) };
}, projBId);
const untouchedB = await readB();`);
inject("console.log('  ✅ S2: WB 保存失败可见性与原位重试 115 元闭环验证通过');", "assert.deepEqual(await readB(), untouchedB, 'Reviewer: B project, snapshot and scenarios unchanged after both retries');\nconsole.log('  Reviewer: B project, snapshot and scenarios unchanged');");
inject('// 4. 点击保存方案\nawait wbSaveBtn.click();', '// 4. 点击保存方案\nconst wbStoreBeforeFailure = await page.evaluate(() => [...window.__inMemoryPersistStore.entries()]);\nawait wbSaveBtn.click();');
inject('// 6. 移除故障，原位重试', "assert.deepEqual(await page.evaluate(() => [...window.__inMemoryPersistStore.entries()]), wbStoreBeforeFailure, 'Reviewer: WB failed save preserves full persisted state');\n// 6. 移除故障，原位重试");
inject("assert.equal(savedWbScenario.inputPayload.purchaseCost, 115, 'S2.9: WB 场景载荷成本严格为 115 元');", "assert.equal(savedWbScenario.inputPayload.purchaseCost, 115, 'S2.9: WB 场景载荷成本严格为 115 元');\nassert.equal(await page.evaluate(pid => window.__t6Store.getProjectScenarios(pid).length, projBId), 0, 'Reviewer: B has no scenarios after both retries');");
inject('const activeTagName = await page.evaluate(() => document.activeElement?.tagName);', `await page.getByRole('button', { name: '成本与物流', exact: true }).focus();
let saveReached = false;
for (let i = 0; i < 150; i++) {
  await page.keyboard.press('Tab');
  saveReached = await page.getByRole('button', { name: '保存此方案到项目', exact: true }).evaluate(el => el === document.activeElement);
  if (saveReached) break;
}
assert.ok(saveReached, 'Reviewer: keyboard reaches enabled Ozon save button');
results.reviewer_additions = { wb_failed_save_full_store_unchanged: true, b_project_snapshot_scenarios_unchanged: true, b_scenarios_after_both_retries: 0, keyboard_save_reachable: true };
const activeTagName = await page.evaluate(() => document.activeElement?.tagName);`);
// Keep the submitted harness intact; execute the extended copy as reviewer evidence.
const harnessPath = path.join(out, 'extended-harness.mjs');
fs.writeFileSync(harnessPath, harness);
const runs = [];
function run(name, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 24 * 1024 * 1024 });
  fs.writeFileSync(path.join(out, `${name}.log`), `${result.stdout || ''}\n${result.stderr || ''}\n${result.error || ''}`);
  const record = { name, exit_code: result.status, signal: result.signal, error: result.error?.message || null };
  runs.push(record);
  console.log(JSON.stringify(record));
}
run('static', process.execPath, ['tests/ia-project-notice.test.mjs']);
run('browser', process.execPath, [harnessPath]);
for (const [name, cmd] of [['regression', 'npm.cmd test'], ['golden', 'npm.cmd run test:golden'], ['sync', 'npm.cmd run test:sync']]) {
  run(name, process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', cmd]);
}
const baseline = JSON.parse(fs.readFileSync('docs/ai-handoff/KJ-GEMINI-20260921-006/BASELINE.json', 'utf8'));
const comparison = Object.entries(baseline.key_file_hashes).map(([file, expected]) => ({ file, expected, actual: hash(file), unchanged: expected === hash(file) }));
const after = generated();
const summary = { timestamp: new Date().toISOString(), runs, generated_before: before, generated_after: after, generated_unchanged: JSON.stringify(before) === JSON.stringify(after), baseline: comparison };
fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ generated_unchanged: summary.generated_unchanged, baseline_unchanged: comparison.filter(x => x.unchanged).length, baseline_changed: comparison.filter(x => !x.unchanged) }));
process.exitCode = runs.every(r => r.exit_code === 0) && summary.generated_unchanged ? 0 : 1;
