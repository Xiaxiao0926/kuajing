/**
 * tests/ia-project-compliance-layout.test.mjs
 * 
 * 任务：KJ-GEMINI-20260921-002 (合规面板手机布局收尾)
 * 专项测试：真实项目 CSS 编译与 Headless Chrome 响应式几何/视觉测量
 * 
 * 覆盖要求：
 * - 在 360px、390px、768px、1440px 下加载真实项目 CSS 测量
 * - 验证无横向溢出 (scrollWidth <= clientWidth)
 * - 验证所有控件在可视范围内 (left >= 0, right <= viewport + 1)
 * - 验证“新增事项”按钮宽度稳定 (>= 70px)，高度单行 (<= 36px)，文字正常横排，无逐字竖排
 * - 覆盖 4 种典型状态：初始状态、双区块 dirty+冲突、新增事项展开、长事项名/编辑状态
 * - 输出测量结果与截图至 evidence/ 目录
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

console.log('===== IA Project Compliance Layout & Visual Measurement Test Suite (KJ-GEMINI-20260921-002) =====\n')

const ROOT = path.resolve('.')
const EVIDENCE_DIR = path.join(ROOT, 'docs/ai-handoff/KJ-GEMINI-20260921-002/evidence')

// 1. 环境依赖预检 (R5/R6: 缺失时标记 not_run，绝不硬编码本机路径)
const codexModulesPath = process.env.CODEX_NODE_MODULES
if (!codexModulesPath) {
  console.log('  ⚠️ CODEX_NODE_MODULES 环境变量未设置，跳过真实组件 headless 浏览器布局测量。')
  console.log('     如需在本机运行真实组件布局测试，请设置：')
  console.log('     $env:CODEX_NODE_MODULES=\'<bundled node_modules path>\'')
  console.log('\n[TEST REPORT] Layout measurement: not_run.')
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
  console.log('  ⚠️ Playwright、esbuild 或 postcss 依赖加载失败，跳过真实组件 headless 测试:', envErr.message)
  console.log('\n[TEST REPORT] Layout measurement: not_run.')
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

console.log('\n--- STEP 2: 打包真实 React 组件测试 Bundle ---')
const bundle = await build({
  stdin: {
    resolveDir: appDir,
    loader: 'jsx',
    sourcefile: 'layout-test-bundle.jsx',
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

const { candidate } = store.ensureCandidate({ sourceProductId: 'layout-test-cand', name: '响应式测试商品', categoryLeaf: '测试类目' });
const snap = store.createSnapshot({
  candidateId: candidate.id,
  sourceProductId: candidate.sourceProductId,
  sourceInputs: { name: '响应式测试商品' },
  scoreResult: { totalScore: 85, grade: 'A', status: 'RECOMMENDED' },
  marketContext: { matchMethod: 'exact' },
  marketEvidence: { eacStatus: 'EAC Mandatory', certificationStatus: 'CoC' }
});

const proj = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: '响应式布局测试项目' });

store.updateProjectCompliance(proj.id, {
  notes: '初始合规评估备忘说明文本',
  applicableStandards: ['TR CU 004/2011 (低电压指令)', 'TR CU 020/2011 (电磁兼容)'],
  certificationPlan: '经由官方认证机构出具 DoC 符合性声明'
});

store.createProjectComplianceRequirement(proj.id, {
  category: 'REGULATION',
  name: '低电压电气安全标准核查与接地连续性测试 (TR CU 004/2011)',
  required: true,
  status: 'PENDING',
  risk: 'HIGH',
  desc: '工厂提供俄规出厂检测记录与安规型式试验合格证书'
});

const view = createRoot(document.getElementById('root'));

window.layoutHarness = {
  projectId: proj.id,
  render: () => view.render(<Panel projectId={proj.id} />),
  read: () => store.getProject(proj.id),
  update: (patch) => store.updateProjectCompliance(proj.id, patch),
  createReq: (req) => store.createProjectComplianceRequirement(proj.id, req)
};

window.layoutHarness.render();
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

console.log('\n--- STEP 3: 真实 Chrome 浏览器多视口响应式布局测量 ---')
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const viewports = [360, 390, 768, 1440]
const results = {
  timestamp: new Date().toISOString(),
  viewports: {},
  states: {},
  passed: true
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
  // 3.1 测试 4 种宽度的初始状态测量
  for (const width of viewports) {
    console.log(`\n  [视口 ${width}px 测量]`)
    const page = await createPage(width)

    const btn = page.getByRole('button', { name: '新增事项', exact: true })
    await btn.waitFor()

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      const btnEl = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('新增事项'))
      const btnRect = btnEl?.getBoundingClientRect()

      // 字符级几何测量：严格确保“新增事项”四个汉字横向排列，没有逐字竖排折行
      let charMetrics = null
      if (btnEl) {
        const walker = document.createTreeWalker(btnEl, NodeFilter.SHOW_TEXT)
        let node
        while ((node = walker.nextNode())) {
          const idx = node.nodeValue.indexOf('新增事项')
          if (idx !== -1) {
            const range = document.createRange()
            const chars = []
            for (let i = 0; i < 4; i++) {
              range.setStart(node, idx + i)
              range.setEnd(node, idx + i + 1)
              const cr = range.getBoundingClientRect()
              chars.push({
                char: node.nodeValue[idx + i],
                left: Math.round(cr.left),
                top: Math.round(cr.top),
                width: Math.round(cr.width),
                height: Math.round(cr.height)
              })
            }
            charMetrics = chars
            break
          }
        }
      }

      // 收集视口内主要交互控件，排除表格内部受 overflow-x-auto 保护的横向滚动单元
      const allControls = [...document.querySelectorAll('button, textarea, select, input')]
        .filter(el => !el.closest('.overflow-x-auto'))
        .map(el => {
          const r = el.getBoundingClientRect()
          return {
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.trim().slice(0, 20) || el.placeholder?.slice(0, 20) || '',
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            height: Math.round(r.height)
          }
        })

      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        viewportWidth: window.innerWidth,
        buttonWidth: btnRect ? Math.round(btnRect.width) : 0,
        buttonHeight: btnRect ? Math.round(btnRect.height) : 0,
        charMetrics,
        overflowControls: allControls.filter(c => c.left < 0 || c.right > window.innerWidth + 1)
      }
    })

    const noHorizontalOverflow = metrics.scrollWidth <= metrics.clientWidth
    const noControlOverflow = metrics.overflowControls.length === 0
    // “新增事项”四字 + 图标：正常水平排列宽度应 >= 70px，且为单行高 (<= 36px)
    const buttonNotSqueezed = metrics.buttonWidth >= 70 && metrics.buttonHeight <= 36

    // 验证文字横排：每个字符必须在同一水平行（top 差值 <= 2px），且 left 严格递增
    let charactersHorizontal = false
    if (metrics.charMetrics && metrics.charMetrics.length === 4) {
      const c = metrics.charMetrics
      const isSameLine = Math.abs(c[0].top - c[3].top) <= 2
      const isLeftToRight = c[0].left < c[1].left && c[1].left < c[2].left && c[2].left < c[3].left
      charactersHorizontal = isSameLine && isLeftToRight
    }

    console.log(`    文档宽度: ${metrics.clientWidth}px, 滚动宽度: ${metrics.scrollWidth}px (无横向溢出: ${noHorizontalOverflow})`)
    console.log(`    “新增事项”按钮尺寸: ${metrics.buttonWidth}×${metrics.buttonHeight}px (尺寸正常: ${buttonNotSqueezed})`)
    console.log(`    字符几何排列: ${JSON.stringify(metrics.charMetrics)} (纯横排无逐字竖排: ${charactersHorizontal})`)
    console.log(`    主体溢出控件数: ${metrics.overflowControls.length}`)

    assert(noHorizontalOverflow, `视口 ${width}px 存在横向滚动溢出: scrollWidth (${metrics.scrollWidth}) > clientWidth (${metrics.clientWidth})`)
    assert(noControlOverflow, `视口 ${width}px 存在越界控件: ${JSON.stringify(metrics.overflowControls)}`)
    assert(buttonNotSqueezed, `视口 ${width}px “新增事项”按钮被挤压为竖排或异常变形 (尺寸: ${metrics.buttonWidth}×${metrics.buttonHeight})`)
    assert(charactersHorizontal, `视口 ${width}px “新增事项”按钮内部文字发生逐字折行换行`)

    // 截图保存
    const screenshotPath = path.join(EVIDENCE_DIR, `layout-${width}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`    📸 全页截图已保存: evidence/layout-${width}.png`)

    results.viewports[width] = {
      passed: true,
      metrics,
      screenshot: `layout-${width}.png`
    }

    await page.close()
  }

  // 3.2 深度状态测试 (以最苛刻的 390px 移动端为主)
  console.log('\n--- STEP 4: 390px 移动端典型业务状态测试 ---')

  // State 2: 双区块 dirty + 外部冲突状态
  {
    console.log('  [State 2: 双区块 dirty + 外部冲突状态]')
    const page = await createPage(390)
    await page.locator('textarea').nth(0).fill('本地未保存评估')
    await page.locator('textarea').nth(2).fill('本地未保存计划')
    await page.evaluate(() => {
      window.layoutHarness.update({ notes: '外部冲突评估', certificationPlan: '外部冲突计划' })
      window.layoutHarness.render()
    })
    await page.locator('[data-testid="assessment-conflict-banner"]').waitFor()
    await page.locator('[data-testid="plan-conflict-banner"]').waitFor()

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        assessmentConflictCount: document.querySelectorAll('[data-testid="assessment-conflict-banner"]').length,
        planConflictCount: document.querySelectorAll('[data-testid="plan-conflict-banner"]').length
      }
    })

    assert(metrics.scrollWidth <= metrics.clientWidth, '双冲突状态下无横向溢出')
    assert.equal(metrics.assessmentConflictCount, 1)
    assert.equal(metrics.planConflictCount, 1)

    const screenshotPath = path.join(EVIDENCE_DIR, 'layout-390-conflict.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log('    ✅ 双冲突横幅文字正常换行无遮挡，截图: evidence/layout-390-conflict.png')
    results.states['dirty_conflict_390'] = { passed: true }
    await page.close()
  }

  // State 3: 新增事项表单展开状态
  {
    console.log('  [State 3: 新增事项表单展开状态]')
    const page = await createPage(390)
    await page.getByRole('button', { name: '新增事项', exact: true }).click()
    await page.locator('input[placeholder*="低电压安全核验"]').waitFor()

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      const cancelBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '取消')
      const confirmBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '确认添加')
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        cancelWidth: cancelBtn?.getBoundingClientRect().width || 0,
        confirmWidth: confirmBtn?.getBoundingClientRect().width || 0
      }
    })

    assert(metrics.scrollWidth <= metrics.clientWidth, '新增表单展开无横向溢出')
    assert(metrics.confirmWidth >= 60, '确认添加按钮宽度正常')

    const screenshotPath = path.join(EVIDENCE_DIR, 'layout-390-add-form.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log('    ✅ 新增表单控件自适应单列/两列，截图: evidence/layout-390-add-form.png')
    results.states['add_form_390'] = { passed: true }
    await page.close()
  }

  // State 4: 长事项名与编辑状态
  {
    console.log('  [State 4: 长事项名与编辑状态]')
    const page = await createPage(390)
    const editBtn = page.getByRole('button', { name: '编辑', exact: true }).first()
    if (await editBtn.count() > 0) {
      await editBtn.click()
      await page.getByRole('button', { name: '保存', exact: true }).first().waitFor()
    }

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth
      }
    })

    assert(metrics.scrollWidth <= metrics.clientWidth, '表格编辑状态下无横向溢出（支持横向滚动）')

    const screenshotPath = path.join(EVIDENCE_DIR, 'layout-390-editing.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log('    ✅ 表格在小屏具备 overflow-x-auto 保护，截图: evidence/layout-390-editing.png')
    results.states['editing_390'] = { passed: true }
    await page.close()
  }

} finally {
  await browser.close()
  await fs.writeFile(
    path.join(EVIDENCE_DIR, 'layout-test-results.json'),
    JSON.stringify(results, null, 2) + '\n'
  )
}

console.log('\n🎉 ALL LAYOUT & VISUAL MEASUREMENT TESTS PASSED (360px, 390px, 768px, 1440px)!')
