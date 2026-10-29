import fs from 'node:fs/promises'
import crypto from 'node:crypto'

// Instrument only the submitted isolated harness, preserving executor evidence.
const task = 'docs/ai-handoff/KJ-GEMINI-20260921-006'
let source = await fs.readFile(`${task}/run-revision-costing-tests.mjs`, 'utf8')
const sourceHash = crypto.createHash('sha256').update(source).digest('hex')
function replaceOnce(from, to) {
  if (source.split(from).length !== 2) throw new Error(`Ambiguous review anchor: ${from}`)
  source = source.replace(from, to)
}
replaceOnce("const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence', modeName);",
  "const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence', 'codex-revision-001-' + (process.env.CODEX_EXTRA_PROBE === '1' ? 'probe' : modeName));")
replaceOnce("  await setContext('r3_error_handling_and_visibility');", `
  await setContext('r3_error_handling_and_visibility');
  results.snapshots.Codex_R3_before = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
`)
replaceOnce('  // 清除模拟错误，切回 costing，重新确认并点击保存应成功恢复', `
  results.snapshots.Codex_R3_after_failed_save = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  // 清除模拟错误，切回 costing，重新确认并点击保存应成功恢复
`)
replaceOnce("  results.scenarios['R3'] = {", `
  results.snapshots.Codex_R3_after_retry = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  results.codex_retry = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id).map(s => ({id:s.id, cost:s.inputPayload.purchaseCost})), projectAId);
  assert.equal(results.codex_retry.at(-1).cost, 65, 'Codex repro: retry saved fallback 65 instead of the failed input 115');
  results.scenarios['R3'] = {
`)
replaceOnce("  await setContext('r2_real_wb_controls');", `
  if (process.env.CODEX_EXTRA_PROBE === '1') {
    await setContext('codex_open_calculator_props_switch');
    await page.evaluate(id => window.__setHarnessRenderState({mode:'project-detail',projectId:id,useExplicitKey:false}), projectAId);
    await page.getByRole('button', {name:'成本与物流'}).click();
    await page.getByRole('button', {name:'使用 Ozon 核算'}).click();
    await page.locator('label:has-text("采购成本") + div input').fill('137');
    const aPrice = await page.locator('label:has-text("售价") + div input').inputValue();
    results.snapshots.Codex_props_before = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
    await page.evaluate(id => window.__setHarnessRenderState({mode:'project-detail',projectId:id,useExplicitKey:false}), projectBId);
    await page.locator('text=项目B合成商品 (自动烘干箱)').waitFor();
    const bPrice = await page.locator('label:has-text("售价") + div input').inputValue();
    const bWeight = await page.locator('label:has-text("实重") + div input').inputValue();
    const bCost = await page.locator('label:has-text("采购成本") + div input').inputValue();
    await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
    await page.getByRole('button', {name:'保存此方案到项目'}).click();
    await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();
    const bScenarios = await page.evaluate(id => window.__t6Store.getProjectScenarios(id), projectBId);
    results.codex_props_probe = {aPrice,bPrice,bWeight,bCost,bExpectedPrice:'9800',bExpectedWeight:'4.8',bScenarios};
    assert.equal(bPrice, '2800', 'Codex repro: B inherited A price');
    assert.equal(bWeight, '0.35', 'Codex repro: B inherited A weight');
    assert.equal(bScenarios.length, 1, 'Codex repro: B accepted the stale scenario');
    assert.equal(bScenarios[0].inputPayload.price, 2800, 'Codex repro: stale A input persisted under B');
    results.snapshots.Codex_props_after = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
    await page.screenshot({path:path.join(EVIDENCE_DIR,'codex-props-switch-saved-B.png')});
  }
  await setContext('r2_real_wb_controls');
  results.snapshots.Codex_R2_before = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
`)
replaceOnce("  results.scenarios['R2'] = {", `
  results.snapshots.Codex_R2_after = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  results.scenarios['R2'] = {
`)
replaceOnce('  // 写入运行结果与快照', `
  results.codex_review = { submittedHarnessSha256: '${sourceHash}', unexpectedPageErrors: observedPageErrors.filter(e => !(e.context === 'r3_error_handling_and_visibility' && e.message.includes('QuotaExceededError: Synthetic storage quota exceeded'))), consoleErrors: observedConsoleMessages.filter(e => e.type === 'error') };
  // 写入运行结果与快照
`)
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
