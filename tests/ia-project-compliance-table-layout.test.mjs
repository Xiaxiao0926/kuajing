/**
 * tests/ia-project-compliance-table-layout.test.mjs
 * 
 * 任务：KJ-GEMINI-20260921-005 (合规事项表格窄屏可读性样板)
 * 专项测试：真实项目 CSS 编译与 Headless Chrome 响应式几何/视觉测量与交互回归
 * 
 * 覆盖要求：
 * - 在 360px、390px、768px、1440px 下加载真实项目 CSS 测量
 * - 普通与长文本事项多视口截图 (360, 390, 768, 1440)
 * - 390px 与 1440px 追加编辑态、删除确认态、新增展开态、空态截图
 * - DOM 几何断言：整页无意外横向溢出；仅表格容器可横向滚动；类别/性质/风险/状态无逐字竖排；右滑后操作完全可见
 * - 交互行为回归：编辑取消不存、编辑保存仅更新目标事项、删除取消不删、删除确认仅删目标事项、新增保留
 * - 视口切换草稿保留：390px 编辑中切 1440px 再回 390px，输入内容不丢失
 * - 与其他区块互不干扰：表格操作不清除 Layer A / Layer B 的未保存草稿
 * - 故障注入验证支持 (TABLE_LAYOUT_TEST_INJECT_FAILURE=1)
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

console.log('===== IA Project Compliance Table Layout & Readability Test Suite (KJ-GEMINI-20260921-005) =====\n')

const ROOT = path.resolve('.')
const EVIDENCE_DIR = path.resolve(process.env.TABLE_LAYOUT_EVIDENCE_DIR || path.join(ROOT, 'docs/ai-handoff/KJ-GEMINI-20260921-005/evidence'))
await fs.mkdir(EVIDENCE_DIR, { recursive: true })

// 1. 环境依赖预检 (缺失时标记 not_run，绝不伪造通过)
const codexModulesPath = process.env.CODEX_NODE_MODULES
if (!codexModulesPath) {
  console.log('  ⚠️ CODEX_NODE_MODULES 环境变量未设置，跳过真实组件 headless 浏览器测量。')
  console.log('     如需在本机运行真实组件布局测试，请设置：')
  console.log('     $env:CODEX_NODE_MODULES=\'<bundled node_modules path>\'')
  console.log('\n[TEST REPORT] Compliance Table Layout measurement: not_run.')
  process.exit(0)
}

let chromium, build, postcss, tailwind, autoprefixer, twConfig
const appDir = path.join(ROOT, 'ozon-react')
const reqApp = createRequire(path.join(appDir, 'package.json'))

try {
  const runtimeReq = createRequire(path.join(codexModulesPath, '_review.cjs'))
  const pw = runtimeReq('playwright')
  chromium = pw.chromium
  build = reqApp('esbuild').build
  postcss = reqApp('postcss')
  tailwind = reqApp('tailwindcss')
  autoprefixer = reqApp('autoprefixer')
  twConfig = (await import(pathToFileURL(path.join(appDir, 'tailwind.config.js')).href)).default
} catch (envErr) {
  console.log('  ⚠️ Playwright、esbuild 或 postcss 依赖加载失败，跳过真实组件测试:', envErr.message)
  console.log('\n[TEST REPORT] Compliance Table Layout measurement: not_run.')
  process.exit(0)
}

console.log('--- STEP 1: 编译项目真实 CSS (Tailwind + Autoprefixer) ---')
const cssContent = await fs.readFile(path.join(appDir, 'src/index.css'), 'utf8')
const compiledCss = (await postcss([
  tailwind({
    ...twConfig,
    content: [path.join(appDir, 'src/**/*.{js,jsx}').replaceAll('\\', '/')]
  }),
  autoprefixer
]).process(cssContent, { from: path.join(appDir, 'src/index.css') })).css
console.log(`  ✅ 真实项目 CSS 编译成功 (${(compiledCss.length / 1024).toFixed(1)} KB)`)

console.log('\n--- STEP 2: 打包真实 React 组件测试 Bundle (含普通与长文本事项 Fixture) ---')
const bundle = await build({
  stdin: {
    resolveDir: appDir,
    loader: 'jsx',
    sourcefile: 'table-layout-bundle.jsx',
    contents: `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Panel from './src/components/t6/ProjectCompliancePanel.jsx';
import * as store from './src/utils/t6/t6Store.js';

const memory = new Map();
store._setAdapterForTests({
  get: k => memory.has(k) ? JSON.parse(memory.get(k)) : null,
  set: (k, v) => memory.set(k, JSON.stringify(v)),
  keys: () => [...memory.keys()]
});

const { candidate } = store.ensureCandidate({ sourceProductId: 'table-test-cand', name: '窄屏表格测试商品', categoryLeaf: '个护家电' });
const snap = store.createSnapshot({
  candidateId: candidate.id,
  sourceProductId: candidate.sourceProductId,
  sourceInputs: { name: '窄屏表格测试商品' },
  scoreResult: { totalScore: 88, grade: 'A', status: 'RECOMMENDED' },
  marketContext: { matchMethod: 'exact' },
  marketEvidence: { eacStatus: 'EAC Mandatory', certificationStatus: 'CoC' }
});

const proj = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: '合规事项窄屏样板测试项目' });

store.updateProjectCompliance(proj.id, {
  notes: '初始合规评估备忘说明文本',
  applicableStandards: ['TR CU 004/2011 (低电压指令)', 'TR CU 020/2011 (电磁兼容)'],
  certificationPlan: '经由官方认证机构出具 DoC 符合性声明'
});

// Fixture 1: 普通事项
store.createProjectComplianceRequirement(proj.id, {
  category: 'REGULATION',
  name: '低电压电气安全标准核查 (TR CU 004/2011)',
  required: true,
  status: 'PENDING',
  risk: 'HIGH',
  desc: '工厂提供俄规出厂检测记录与安规合格证'
});

// Fixture 2: 极长文本事项（检验自然换行与窄屏可读性）
store.createProjectComplianceRequirement(proj.id, {
  category: 'LABELING',
  name: '俄语警示标识、EAC合格标志与海关联盟原产地标签印刷核验规范',
  required: false,
  status: 'IN_PROGRESS',
  risk: 'MEDIUM',
  desc: '外包装及俄语说明书须包含欧亚经济联盟海关技术法规统一认证标志，字体高度不得小于5mm，且须耐刮擦防水、注明俄境内授权代表。'
});

// Fixture 3: 已完成事项
store.createProjectComplianceRequirement(proj.id, {
  category: 'INGREDIENT',
  name: 'RoHS 禁用化学物质排查',
  required: true,
  status: 'DONE',
  risk: 'LOW',
  desc: '铅、汞、镉、六价铬等有害物质检测报告核实合格'
});

const view = createRoot(document.getElementById('root'));

window.tableHarness = {
  projectId: proj.id,
  render: () => view.render(<Panel projectId={proj.id} />),
  read: () => store.getProject(proj.id),
  updateCompliance: (patch) => store.updateProjectCompliance(proj.id, patch),
  createReq: (req) => store.createProjectComplianceRequirement(proj.id, req),
  updateReq: (reqId, patch) => store.updateProjectComplianceRequirement(proj.id, reqId, patch),
  removeReq: (reqId) => store.removeProjectComplianceRequirement(proj.id, reqId),
  clearAllReqs: () => {
    const p = store.getProject(proj.id);
    const reqs = p?.compliance?.requirements || [];
    for (const r of reqs) {
      store.removeProjectComplianceRequirement(proj.id, r.id);
    }
  }
};

window.tableHarness.render();
`
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' }
})
console.log('  ✅ 组件 Bundle 打包成功')

console.log('\n--- STEP 3: 真实 Chrome 浏览器多视口几何与可读性测量 ---')
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const viewports = [360, 390, 768, 1440]
const results = {
  timestamp: new Date().toISOString(),
  viewports: {},
  states: {},
  interactions: {},
  passed: false
}

async function createPage(width) {
  const page = await browser.newPage()
  await page.route('**/*', route => route.abort())
  await page.setViewportSize({ width, height: 1000 })
  await page.setContent('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><main class="fyzsxnb-kuajing-root" style="padding:12px"><div id="root"></div></main></body></html>')
  await page.addStyleTag({ content: compiledCss })
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.getByRole('button', { name: '保存评估状态', exact: true }).waitFor()
  return page
}

try {
  if (process.env.TABLE_LAYOUT_TEST_INJECT_FAILURE === '1') {
    assert.fail('FAULT INJECTION: Intentional test failure verification')
  }

  // 3.1 四大视口普通与长文本事项几何断言与截图
  for (const width of viewports) {
    console.log(`\n  [视口 ${width}px 测量]`)
    const page = await createPage(width)

    const tableRegion = page.locator('[role="region"][aria-label="合规核验事项列表"]')
    await tableRegion.waitFor()

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
      const table = container?.querySelector('table')
      const btnEl = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('新增事项'))
      const btnRect = btnEl?.getBoundingClientRect()

      // 1. 检查各列内容，测量是否有逐字竖排（单字折行）
      const rows = [...(table?.querySelectorAll('tbody tr') || [])]
      const rowDetails = rows.map(r => {
        const cells = [...r.querySelectorAll('td')]
        return {
          categoryText: cells[0]?.textContent?.trim(),
          categoryHeight: cells[0]?.getBoundingClientRect().height,
          nameText: cells[1]?.textContent?.trim(),
          nameWidth: cells[1]?.getBoundingClientRect().width,
          nameHeight: cells[1]?.getBoundingClientRect().height,
          requiredText: cells[2]?.textContent?.trim(),
          riskText: cells[3]?.textContent?.trim(),
          statusText: cells[4]?.textContent?.trim(),
          descText: cells[5]?.textContent?.trim(),
          descHeight: cells[5]?.getBoundingClientRect().height,
          actionWidth: cells[6]?.getBoundingClientRect().width
        }
      })

      // 2. 字符级测量：检查状态和风险 Badge 字符是否纯横向
      const badges = [...(table?.querySelectorAll('span') || [])].filter(s =>
        ['待处理', '处理中', '已完成', '高风险', '中风险', '低风险', '技术法规', '标签标识', '成分准入'].some(txt => s.textContent?.trim() === txt)
      )
      const badgeAlignments = badges.map(b => {
        const r = b.getBoundingClientRect()
        return {
          text: b.textContent?.trim(),
          width: Math.round(r.width),
          height: Math.round(r.height),
          isSingleLine: r.height <= 28
        }
      })

      return {
        docClientWidth: doc.clientWidth,
        docScrollWidth: doc.scrollWidth,
        containerClientWidth: container?.clientWidth || 0,
        containerScrollWidth: container?.scrollWidth || 0,
        tableWidth: table?.getBoundingClientRect().width || 0,
        btnWidth: btnRect ? Math.round(btnRect.width) : 0,
        btnHeight: btnRect ? Math.round(btnRect.height) : 0,
        rowDetails,
        badgeAlignments
      }
    })

    // 断言 1: 整页文档绝无横向溢出
    assert(metrics.docScrollWidth <= metrics.docClientWidth, `视口 ${width}px 存在全页横向溢出: scrollWidth (${metrics.docScrollWidth}) > clientWidth (${metrics.docClientWidth})`)

    // 断言 2: 窄屏 (360/390px) 下表格容器具有独立内部横滚保护
    if (width <= 390) {
      assert(metrics.containerScrollWidth > metrics.containerClientWidth, `视口 ${width}px 表格容器未按预期激活内部横向滚动: scrollWidth (${metrics.containerScrollWidth}) <= clientWidth (${metrics.containerClientWidth})`)
    }

    // 断言 3: 类别、性质、风险、状态 Badge 均为单行横排，绝不逐字竖排折行
    for (const b of metrics.badgeAlignments) {
      assert(b.isSingleLine, `视口 ${width}px 徽章 [${b.text}] 发生竖排折行 (height: ${b.height}px)`)
    }

    // 断言 4: 新增事项按钮保持稳定单行尺寸
    assert(metrics.btnWidth >= 70 && metrics.btnHeight <= 36, `视口 ${width}px “新增事项”按钮变形: ${metrics.btnWidth}×${metrics.btnHeight}`)

    // 断言 5: 右滑后操作按钮完全可见可点击
    await page.evaluate(() => {
      const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
      if (container) container.scrollLeft = container.scrollWidth
    })
    const actionVisible = await page.evaluate(() => {
      const firstEditBtn = document.querySelector('button[title="编辑事项"]')
      if (!firstEditBtn) return false
      const r = firstEditBtn.getBoundingClientRect()
      return r.left >= 0 && r.right <= window.innerWidth + 1
    })
    assert(actionVisible, `视口 ${width}px 滚动至最右后编辑操作按钮不可见或越界`)

    // 截图保存
    const screenshotName = `table-layout-${width}-normal.png`
    await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshotName), fullPage: true })
    console.log(`    📸 普通与长文本事项截图已保存: evidence/${screenshotName}`)

    results.viewports[width] = {
      passed: true,
      metrics: {
        docClientWidth: metrics.docClientWidth,
        docScrollWidth: metrics.docScrollWidth,
        containerClientWidth: metrics.containerClientWidth,
        containerScrollWidth: metrics.containerScrollWidth,
        tableWidth: metrics.tableWidth,
        badgeAlignments: metrics.badgeAlignments
      },
      screenshot: screenshotName
    }

    await page.close()
  }

  // 3.2 390px 与 1440px 典型业务状态对比截图 (编辑态、删除确认态、新增展开态、空态)
  console.log('\n--- STEP 4: 390px 与 1440px 典型业务状态测试与截图 ---')
  const detailWidths = [390, 1440]

  for (const width of detailWidths) {
    console.log(`\n  [深度状态: ${width}px]`)

    // State 1: 编辑态
    {
      const page = await createPage(width)
      // 滑动至操作区并点击编辑
      await page.evaluate(() => {
        const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
        if (container) container.scrollLeft = container.scrollWidth
      })
      const editBtn = page.getByRole('button', { name: '编辑事项', exact: true }).first()
      await editBtn.waitFor()
      await editBtn.click()

      const saveBtn = page.getByRole('button', { name: '保存', exact: true }).first()
      await saveBtn.waitFor()

      const overflowCheck = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
      assert(overflowCheck, `视口 ${width}px 编辑态下存在全页横向溢出`)

      const screenshotName = `table-layout-${width}-editing.png`
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshotName), fullPage: true })
      console.log(`    📸 编辑态截图: evidence/${screenshotName}`)
      results.states[`editing_${width}`] = { passed: true, screenshot: screenshotName }
      await page.close()
    }

    // State 2: 删除确认态
    {
      const page = await createPage(width)
      await page.evaluate(() => {
        const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
        if (container) container.scrollLeft = container.scrollWidth
      })
      const delBtn = page.getByRole('button', { name: '删除事项', exact: true }).first()
      await delBtn.waitFor()
      await delBtn.click()

      await page.locator('text=确认删除?').waitFor()
      const confirmDelBtn = page.getByRole('button', { name: '删除', exact: true }).first()
      await confirmDelBtn.waitFor()

      const overflowCheck = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
      assert(overflowCheck, `视口 ${width}px 删除确认态下存在全页横向溢出`)

      const screenshotName = `table-layout-${width}-deleting.png`
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshotName), fullPage: true })
      console.log(`    📸 删除确认态截图: evidence/${screenshotName}`)
      results.states[`deleting_${width}`] = { passed: true, screenshot: screenshotName }
      await page.close()
    }

    // State 3: 新增展开态
    {
      const page = await createPage(width)
      const addBtn = page.getByRole('button', { name: '新增事项', exact: true })
      await addBtn.waitFor()
      await addBtn.click()

      await page.locator('input[placeholder*="低电压安全核验"]').waitFor()
      const overflowCheck = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
      assert(overflowCheck, `视口 ${width}px 新增展开态下存在全页横向溢出`)

      const screenshotName = `table-layout-${width}-add-expanded.png`
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshotName), fullPage: true })
      console.log(`    📸 新增展开态截图: evidence/${screenshotName}`)
      results.states[`add_expanded_${width}`] = { passed: true, screenshot: screenshotName }
      await page.close()
    }

    // State 4: 空态
    {
      const page = await createPage(width)
      await page.evaluate(() => {
        window.tableHarness.clearAllReqs()
        window.tableHarness.render()
      })
      await page.locator('text=暂无合规核验事项').waitFor()

      const overflowCheck = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
      assert(overflowCheck, `视口 ${width}px 空态下存在全页横向溢出`)

      const screenshotName = `table-layout-${width}-empty.png`
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshotName), fullPage: true })
      console.log(`    📸 空态截图: evidence/${screenshotName}`)
      results.states[`empty_${width}`] = { passed: true, screenshot: screenshotName }
      await page.close()
    }
  }

  // 3.3 交互行为验证：输入、保存、取消、删除、新增与草稿保护
  console.log('\n--- STEP 5: 真实输入与点击行为全闭环回归测试 ---')
  {
    const page = await createPage(390)

    // 1. 编辑再取消 -> 不写数据
    console.log('  [Action 1: 编辑后点击取消]')
    await page.evaluate(() => {
      const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
      if (container) container.scrollLeft = container.scrollWidth
    })
    const editBtn = page.getByRole('button', { name: '编辑事项', exact: true }).first()
    await editBtn.click()

    const nameInput = page.locator('tbody input').first()
    await nameInput.fill('已被修改的事项名称_取消测试')
    const cancelBtn = page.getByRole('button', { name: '取消', exact: true }).first()
    await cancelBtn.click()

    const storeAfterCancel = await page.evaluate(() => window.tableHarness.read())
    const firstReqName = storeAfterCancel.compliance.requirements[0].name
    assert.equal(firstReqName, '低电压电气安全标准核查 (TR CU 004/2011)', '点击取消不得修改 Store 中的事项名称')
    console.log('    ✅ 编辑取消验证通过：Store 数据未被改动')

    // 2. 编辑并保存 -> 仅修改目标事项
    console.log('  [Action 2: 编辑后点击保存]')
    await page.evaluate(() => {
      const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
      if (container) container.scrollLeft = container.scrollWidth
    })
    await page.getByRole('button', { name: '编辑事项', exact: true }).first().click()
    const nameInputSave = page.locator('tbody input').first()
    await nameInputSave.fill('低电压电气安全标准核查 (已更新)')
    await page.getByRole('button', { name: '保存', exact: true }).first().click()

    const storeAfterSave = await page.evaluate(() => window.tableHarness.read())
    const updatedReq = storeAfterSave.compliance.requirements[0]
    const secondReq = storeAfterSave.compliance.requirements[1]
    assert.equal(updatedReq.name, '低电压电气安全标准核查 (已更新)', '保存后目标事项名称必须更新')
    assert.equal(secondReq.name, '俄语警示标识、EAC合格标志与海关联盟原产地标签印刷核验规范', '其他事项数据不得受影响')
    console.log('    ✅ 编辑保存验证通过：目标事项正确更新，非目标事项无污染')

    // 3. 删除取消 -> 不删除数据
    console.log('  [Action 3: 删除后点击取消]')
    await page.evaluate(() => {
      const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
      if (container) container.scrollLeft = container.scrollWidth
    })
    await page.getByRole('button', { name: '删除事项', exact: true }).first().click()
    await page.locator('text=确认删除?').waitFor()
    await page.getByRole('button', { name: '取消', exact: true }).first().click()

    const storeAfterDelCancel = await page.evaluate(() => window.tableHarness.read())
    assert.equal(storeAfterDelCancel.compliance.requirements.length, 3, '点击取消后事项数量不得减少')
    console.log('    ✅ 删除取消验证通过：事项数量未变化')

    // 4. 删除确认 -> 仅删除目标事项
    console.log('  [Action 4: 删除确认执行]')
    await page.evaluate(() => {
      const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
      if (container) container.scrollLeft = container.scrollWidth
    })
    await page.getByRole('button', { name: '删除事项', exact: true }).first().click()
    await page.getByRole('button', { name: '删除', exact: true }).first().click()

    const storeAfterDel = await page.evaluate(() => window.tableHarness.read())
    assert.equal(storeAfterDel.compliance.requirements.length, 2, '确认删除后事项数量减少 1')
    assert.equal(storeAfterDel.compliance.requirements[0].name, '俄语警示标识、EAC合格标志与海关联盟原产地标签印刷核验规范')
    console.log('    ✅ 删除确认验证通过：指定事项被正确移除')

    // 5. 新增事项 -> 功能完整保留
    console.log('  [Action 5: 新增事项]')
    await page.getByRole('button', { name: '新增事项', exact: true }).click()
    await page.locator('input[placeholder*="低电压安全核验"]').fill('全新添加的质检报告项')
    await page.getByRole('button', { name: '确认添加', exact: true }).click()

    const storeAfterAdd = await page.evaluate(() => window.tableHarness.read())
    assert.equal(storeAfterAdd.compliance.requirements.length, 3, '新增成功后数量增加 1')
    assert.equal(storeAfterAdd.compliance.requirements[2].name, '全新添加的质检报告项')
    console.log('    ✅ 新增事项验证通过：新事项成功写入 Store')

    // 6. 视口切换草稿保留：390px 编辑中切换到 1440px 再切回 390px，输入内容不丢失
    console.log('  [Action 6: 跨视口切换草稿保留]')
    await page.evaluate(() => {
      const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
      if (container) container.scrollLeft = container.scrollWidth
    })
    await page.getByRole('button', { name: '编辑事项', exact: true }).first().click()
    const draftInput = page.locator('tbody input').first()
    await draftInput.fill('跨视口草稿测试文本_TEST')

    // 切换视口至 1440px
    await page.setViewportSize({ width: 1440, height: 1000 })
    const valAt1440 = await page.locator('tbody input').first().inputValue()
    assert.equal(valAt1440, '跨视口草稿测试文本_TEST', '切至 1440px 视口草稿输入必须保留')

    // 切回 390px
    await page.setViewportSize({ width: 390, height: 1000 })
    const valBackAt390 = await page.locator('tbody input').first().inputValue()
    assert.equal(valBackAt390, '跨视口草稿测试文本_TEST', '切回 390px 视口草稿输入必须保留')
    console.log('    ✅ 跨视口切换草稿保留通过：390px -> 1440px -> 390px 期间输入完好')

    // 7. 与其它合规草稿区块互不干扰
    console.log('  [Action 7: 与其它草稿区块互不干扰]')
    await page.locator('textarea').nth(0).fill('正在录入的评估备忘未保存文本')
    await page.locator('textarea').nth(2).fill('正在录入的认证方案未保存文本')

    // 表格点击取消
    await page.evaluate(() => {
      const container = document.querySelector('[role="region"][aria-label="合规核验事项列表"]')
      if (container) container.scrollLeft = container.scrollWidth
    })
    await page.getByRole('button', { name: '取消', exact: true }).first().click()

    const notesVal = await page.locator('textarea').nth(0).inputValue()
    const certPlanVal = await page.locator('textarea').nth(2).inputValue()
    assert.equal(notesVal, '正在录入的评估备忘未保存文本', '表格操作不得清除评估草稿')
    assert.equal(certPlanVal, '正在录入的认证方案未保存文本', '表格操作不得清除认证计划草稿')
    console.log('    ✅ 区域隔离测试通过：表格交互不影响 Layer A / Layer B 草稿')

    results.interactions = {
      editCancelPassed: true,
      editSavePassed: true,
      delCancelPassed: true,
      delConfirmPassed: true,
      addRequirementPassed: true,
      viewportSwitchDraftRetained: true,
      otherDraftsPreserved: true
    }

    await page.close()
  }

  results.passed = true
  await fs.writeFile(path.join(EVIDENCE_DIR, 'table-layout-results.json'), JSON.stringify(results, null, 2))
  console.log('\n🎉 ALL COMPLIANCE TABLE LAYOUT, GEOMETRY & INTERACTION TESTS PASSED!')
} catch (err) {
  results.passed = false
  results.error = err.message
  await fs.writeFile(path.join(EVIDENCE_DIR, 'table-layout-results.json'), JSON.stringify(results, null, 2)).catch(() => {})
  console.error('\n❌ TEST FAILED:', err.message)
  await browser.close()
  process.exit(1)
}

await browser.close()
process.exit(0)
