import fs from 'node:fs/promises'

// Reuse the submitted isolated fixture; add independent assertions without editing it.
const filename = 'tests/ia-project-compliance-table-layout.test.mjs'
let source = await fs.readFile(filename, 'utf8')
const marker = '  results.passed = true'
if (source.split(marker).length !== 2) throw new Error('Unexpected test layout; review adapter needs inspection')
source = source.replace(marker, `
  results.codexSupplement = []
  for (const width of [360, 390, 768, 1440]) {
    const page = await createPage(width)
    const region = page.getByRole('region', { name: '合规核验事项列表' })
    await region.scrollIntoViewIfNeeded()
    await region.focus()
    assert(await region.evaluate(el => document.activeElement === el), 'Region must be focusable')
    if (width <= 390) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(300)
      assert(await region.evaluate(el => el.scrollLeft > 0), 'Keyboard must scroll the table')
    }
    const before = await page.evaluate(() => window.tableHarness.read())
    await page.getByRole('button', { name: '编辑事项', exact: true }).first().click()
    await page.locator('tbody input').first().fill('CANCEL-SNAPSHOT-CHECK')
    await region.evaluate(el => { el.scrollLeft = el.scrollWidth })
    for (const name of ['保存', '取消']) {
      const button = page.getByRole('button', { name, exact: true }).first()
      const box = await button.boundingBox()
      const outer = await region.boundingBox()
      assert(box && outer && box.width > 0 && box.x >= outer.x - 1 && box.x + box.width <= outer.x + outer.width + 1, 'Edit action clipped: ' + name)
    }
    await region.screenshot({ path: path.join(EVIDENCE_DIR, 'codex-' + width + '-editing-actions.png') })
    await page.getByRole('button', { name: '取消', exact: true }).first().click()
    assert.deepEqual(await page.evaluate(() => window.tableHarness.read()), before, 'Cancel must preserve whole project')
    await page.getByRole('button', { name: '删除事项', exact: true }).first().click()
    await region.evaluate(el => { el.scrollLeft = el.scrollWidth })
    for (const name of ['删除', '取消']) {
      const box = await page.getByRole('button', { name, exact: true }).first().boundingBox()
      const outer = await region.boundingBox()
      assert(box && outer && box.x >= outer.x - 1 && box.x + box.width <= outer.x + outer.width + 1, 'Delete action clipped: ' + name)
    }
    await page.getByRole('button', { name: '取消', exact: true }).first().click()
    assert.deepEqual(await page.evaluate(() => window.tableHarness.read()), before, 'Delete cancellation changed project')
    const badge = region.locator('tbody tr').first().locator('td').first().locator('span')
    assert.equal(await badge.count(), 1, 'Non-vacuous badge assertion')
    assert((await badge.boundingBox()).height <= 28, 'Initial badge wraps')
    await badge.evaluate(el => { el.style.cssText = 'display:block;width:12px;white-space:normal;word-break:break-all' })
    let caught = false
    try { assert((await badge.boundingBox()).height <= 28, 'Injected real wrapping regression') } catch { caught = true }
    assert(caught, 'Real wrapping mutation must fail the same geometry predicate')
    results.codexSupplement.push({ width, keyboard: width <= 390 ? 'passed' : 'focus_only', editingAndDeleteActions: 'passed', cancellationSnapshot: 'passed', realWrappingMutationDetected: true })
    await page.close()
  }
` + marker)
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
