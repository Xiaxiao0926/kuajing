import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const task = 'docs/ai-handoff/KJ-GEMINI-20260921-006'
let source = await fs.readFile(`${task}/run-revision-002-costing-tests.mjs`, 'utf8')
const submittedHash = crypto.createHash('sha256').update(source).digest('hex')
function replaceOnce(from, to) {
  if (source.split(from).length !== 2) throw new Error(`Review anchor changed: ${from}`)
  source = source.replace(from, to)
}
replaceOnce("const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence', modeName);", "const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence', 'codex-' + modeName);")
replaceOnce("  results.scenarios['R2'] = {", `
  const onlyT6 = obj => Object.fromEntries(Object.entries(obj).filter(([k]) => k.startsWith('t6.')));
  assert.deepEqual(onlyT6(results.snapshots.R2_project_wb_after.store), onlyT6(results.snapshots.R2_project_wb_before.store), 'Codex: shared WB operations must leave all T6 entities unchanged');
  results.codex_t6_unchanged_after_wb = true;
  results.scenarios['R2'] = {
`)
replaceOnce("  results.snapshots['R3_before_failure'] =", `
  results.snapshots.Codex_full_before_failure = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  results.snapshots['R3_before_failure'] =
`)
replaceOnce('  // 3.2.1 断言失败期间无意外实体写入', `
  results.snapshots.Codex_full_after_failure = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  assert.deepEqual(results.snapshots.Codex_full_after_failure, results.snapshots.Codex_full_before_failure, 'Codex: failed save leaves complete store unchanged');
  results.codex_failed_save_store_unchanged = true;
  // 3.2.1 断言失败期间无意外实体写入
`)
replaceOnce("  await setContext('r5_cross_project_isolation');", `
  await setContext('codex_wb_open_context_probe');
  const wbProbeIds = await page.evaluate(() => window.__harnessMethods.setupSyntheticProjects());
  await page.evaluate(id => window.__setHarnessRenderState({mode:'project-detail',projectId:id,useExplicitKey:true}), wbProbeIds.projectAId);
  await page.getByRole('button', {name:'成本与物流'}).click();
  await page.getByRole('button', {name:'使用 WB 核算'}).click();
  await page.getByRole('button', {name:'单订单核算器'}).click();
  // Establish one stable parent instance before testing a prop-only update.
  await page.evaluate(id => window.__setHarnessRenderState({mode:'project-detail',projectId:id,useExplicitKey:false}), wbProbeIds.projectAId);
  await page.getByRole('button', {name:'成本与物流'}).click();
  await page.getByRole('button', {name:'使用 WB 核算'}).click();
  await page.getByRole('button', {name:'单订单核算器'}).click();
  await page.locator('label:has-text("采购成本") + div input').fill('137');
  await page.locator('label:has-text("已确认采购成本、佣金率与费用假设") input').check();
  results.snapshots.Codex_wb_props_before = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  await page.evaluate(id => window.__setHarnessRenderState({mode:'project-detail',projectId:id,useExplicitKey:false}), wbProbeIds.projectBId);
  await page.locator('text=项目B合成商品 (自动烘干箱)').waitFor();
  const wbObservedPrice = await page.locator('label:has-text("卖家收入基数") + div input').inputValue();
  const wbObservedWeight = await page.locator('label:has-text("含包装重量") + div input').inputValue();
  const wbSave = page.getByRole('button', {name:'保存此方案到项目（不可变成本场景）'});
  const confirmationReset = await wbSave.isDisabled();
  await page.locator('label:has-text("采购成本") + div input').fill('52');
  await page.locator('label:has-text("已确认采购成本、佣金率与费用假设") input').check();
  await wbSave.click();
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();
  const wbSaved = await page.evaluate(id => window.__t6Store.getProjectScenarios(id), wbProbeIds.projectBId);
  const wbProjectB = await page.evaluate(id => window.__t6Store.getProject(id), wbProbeIds.projectBId);
  assert.equal(wbObservedPrice, '2800', 'Codex WB probe reproduces stale A price');
  assert.equal(wbObservedWeight, '350', 'Codex WB probe reproduces stale A weight');
  assert.equal(wbSaved.length, 1);
  assert.equal(wbSaved[0].sourceSnapshotId, wbProjectB.source.creationSnapshotId);
  results.codex_wb_probe = {wbObservedPrice,wbObservedWeight,expectedBPrice:'9800',expectedBWeight:'4800',confirmationReset,saved:wbSaved[0],kind:'synthetic_component_probe',business_verdict:'issues_found'};
  results.snapshots.Codex_wb_props_after = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  await setContext('r5_cross_project_isolation');
`)
replaceOnce('  // 写入运行结果', `
  const consoleErrors = observedConsoleMessages.filter(m => m.type === 'error');
  const unclassifiedErrors = consoleErrors.filter(m => !(m.text.includes('Encountered two children with the same key') && m.text.includes('CalculatorTab')));
  results.codex_review = {submittedHarnessSha256:'${submittedHash}',unclassifiedConsoleErrors:unclassifiedErrors,consoleErrorsCount:consoleErrors.length};
  await fs.writeFile(path.join(EVIDENCE_DIR,'console-messages.json'),JSON.stringify(observedConsoleMessages,null,2));
  if (unexpectedPageErrors.length || unclassifiedErrors.length) {
    results.passed = false;
    results.business_verdict = 'unexpected_error';
    results.assertions_status = 'failed';
  }
  // 写入运行结果
`)
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
