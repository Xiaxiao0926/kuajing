/**
 * docs/ai-handoff/KJ-GEMINI-20260922-001/run-notice-visibility-tests.mjs
 * 
 * 任务：KJ-GEMINI-20260922-001 (Project Detail Save Feedback Visibility & Ownership Repair)
 * 合成浏览器真实组件实测套件
 * 
 * 严格覆盖 TASK.md §验收 1 ~ 6 全部要求：
 * 1. Ozon/WB 成本输入 115 注入保存失败：costing 页即刻可见错误、输入 115 保留、确认状态保留、核算器不关闭、T6 实体不变；
 * 2. 原位重试闭环：不切页重试成功、实际载荷成本 115、B 项目 0 场景、核算器关闭且 costing 页可见成功消息；
 * 3. 概览和其他 Tab 消息仍可见且全页严格只渲染一份；无 notice 不渲染空元素；最新消息覆盖旧条目；
 * 4. A 切 B 项目（同实例 Props 切换与经列表卸载两种边界）均不显示 A 的旧消息；
 * 5. 390 / 768 / 1440 视口截图验证长错误自动换行、不溢出、不遮挡控件；键盘可达与辅助技术（role=status, aria-live=polite）；
 * 6. 未勾选确认前保存按钮 disabled；
 * 7. 控制台与页面异常严格监控：分类统计既有 WB 重复 key 警告，绝不全局忽略；任何未预期错误直接导致测试失败。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

console.log('===== KJ-GEMINI-20260922-001 Notice Visibility & Ownership Real Component Test Suite =====\n');

const ROOT = path.resolve('.');
const TASK_DIR = path.join(ROOT, 'docs/ai-handoff/KJ-GEMINI-20260922-001');
const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence/codex-review');
await fs.mkdir(EVIDENCE_DIR, { recursive: true });

// 运行环境检测（优先 CODEX_NODE_MODULES，回退 USERPROFILE 动态路径）
const codexModulesPath = process.env.CODEX_NODE_MODULES || (
  process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
    : null
);

if (!codexModulesPath || !fsSync.existsSync(codexModulesPath)) {
  console.error('  ⚠️ 未找到可用的 Playwright node_modules 运行环境 (CODEX_NODE_MODULES)');
  process.exit(1);
}

const appDir = path.join(ROOT, 'ozon-react');
const reqApp = createRequire(path.join(appDir, 'package.json'));

let chromium, esbuild, postcss, tailwind, autoprefixer, twConfig;

try {
  const reqCodex = createRequire(path.join(codexModulesPath, '_review.cjs'));
  chromium = reqCodex('playwright').chromium;
  esbuild = reqApp('esbuild');
  postcss = reqApp('postcss');
  tailwind = reqApp('tailwindcss');
  autoprefixer = reqApp('autoprefixer');
  twConfig = (await import(pathToFileURL(path.join(appDir, 'tailwind.config.js')).href)).default;
  console.log('  ✅ 依赖环境预检通过 (esbuild, playwright, tailwindcss 就绪)');
} catch (err) {
  console.error('  ⚠️ 环境依赖加载失败:', err.message);
  process.exit(1);
}

// 编译真实 Tailwind CSS
console.log('\n--- STEP 1: 编译真实 Tailwind CSS ---');
const cssRaw = await fs.readFile(path.join(appDir, 'src/index.css'), 'utf8');
const compiledCss = (await postcss([
  tailwind({
    ...twConfig,
    content: [path.join(appDir, 'src/**/*.{js,jsx}').replaceAll('\\', '/')]
  }),
  autoprefixer
]).process(cssRaw, { from: path.join(appDir, 'src/index.css') })).css;
console.log(`  ✅ CSS 编译成功 (${(compiledCss.length / 1024).toFixed(1)} KB)`);

// 替身插件：持久化与汇率
const persistSpyPlugin = {
  name: 'persist-spy',
  setup(build) {
    build.onResolve({ filter: /persist(\.js)?$/ }, () => ({
      path: 'virtual-persist',
      namespace: 'spy-ns'
    }));
    build.onLoad({ filter: /.*/, namespace: 'spy-ns' }, () => ({
      resolveDir: appDir,
      loader: 'jsx',
      contents: `
        export const PersistenceState = Object.freeze({
          IDLE: 'idle', SAVING: 'saving', SAVED: 'saved', CONFLICT: 'conflict', ERROR: 'error',
        });
        export class PersistenceConflictError extends Error {
          constructor(details = {}) {
            super('State changed on the server. Reload before saving again.');
            this.name = 'PersistenceConflictError';
            this.status = 409;
            this.details = details;
          }
        }

        if (!window.__inMemoryPersistStore) window.__inMemoryPersistStore = new Map();
        if (!window.__persistCallTrace) window.__persistCallTrace = [];
        if (!window.__simulatePersistSetError) window.__simulatePersistSetError = null;

        export function getDeviceId() { return 'test-synthetic-device'; }
        export function getPersistenceStatus() { return { state: 'idle', key: null, details: null, updatedAt: Date.now() }; }
        export function subscribePersistenceStatus(cb) { return () => {}; }

        export function persistGet(key) {
          const val = window.__inMemoryPersistStore.has(key)
            ? JSON.parse(JSON.stringify(window.__inMemoryPersistStore.get(key)))
            : null;
          window.__persistCallTrace.push({
            seq: window.__persistCallTrace.length + 1,
            time: Date.now(),
            action: 'get',
            key,
            value: val
          });
          return val;
        }

        export function persistSet(key, value) {
          if (window.__simulatePersistSetError) {
            if (!window.__simulatePersistSetError.key || window.__simulatePersistSetError.key === key) {
              const err = window.__simulatePersistSetError.error || new Error('Simulated persist error for ' + key);
              window.__persistCallTrace.push({
                seq: window.__persistCallTrace.length + 1,
                time: Date.now(),
                action: 'set_error',
                key,
                error: err.message,
                attemptedValue: JSON.parse(JSON.stringify(value))
              });
              throw err;
            }
          }
          const prev = window.__inMemoryPersistStore.has(key)
            ? JSON.parse(JSON.stringify(window.__inMemoryPersistStore.get(key)))
            : null;
          const cloned = JSON.parse(JSON.stringify(value));
          window.__inMemoryPersistStore.set(key, cloned);
          window.__persistCallTrace.push({
            seq: window.__persistCallTrace.length + 1,
            time: Date.now(),
            action: 'set',
            key,
            prev,
            value: cloned
          });
        }

        export function persistRemove(key) {
          const prev = window.__inMemoryPersistStore.has(key)
            ? JSON.parse(JSON.stringify(window.__inMemoryPersistStore.get(key)))
            : null;
          window.__inMemoryPersistStore.delete(key);
          window.__persistCallTrace.push({
            seq: window.__persistCallTrace.length + 1,
            time: Date.now(),
            action: 'remove',
            key,
            prev
          });
        }
      `
    }));
  }
};

const exchangeRateSpyPlugin = {
  name: 'exchange-rate-spy',
  setup(build) {
    build.onResolve({ filter: /(useExchangeRate|exchangeRate)(\.js)?$/ }, () => ({
      path: 'virtual-exchange-rate',
      namespace: 'rate-spy-ns'
    }));
    build.onLoad({ filter: /.*/, namespace: 'rate-spy-ns' }, () => ({
      resolveDir: appDir,
      loader: 'jsx',
      contents: `
        import React from 'react';
        if (!window.__syntheticRateInfo) {
          window.__syntheticRateInfo = {
            rubPerCny: 12.5,
            cnyPerRub: 0.08,
            source: 'SYNTHETIC_FIXED',
            date: '2026-09-22',
            auto: false
          };
        }
        export function getRateInfo() { return { ...window.__syntheticRateInfo }; }
        export function formatRubPerCny(val) {
          const n = Number(val);
          return Number.isFinite(n) ? n.toFixed(2) : '12.50';
        }
        export function formatCnyPerRub(val) {
          const n = Number(val);
          return Number.isFinite(n) ? (1 / n).toFixed(4) : '0.0800';
        }
        export function calcCommission(price, rate) { return (price || 0) * (rate || 0) / 100; }
        export function calcAgencyFee() { return 0; }
        export function useExchangeRate() { return window.__syntheticRateInfo; }
      `
    }));
  }
};

console.log('\n--- STEP 2: 打包真实组件 Bundle (包含修改后的 ProjectDetailPage) ---');

const bundle = await esbuild.build({
  stdin: {
    resolveDir: appDir,
    loader: 'jsx',
    sourcefile: 'notice-harness-bundle.jsx',
    contents: `
      import React, { useState, useEffect } from 'react';
      import { createRoot } from 'react-dom/client';
      import ProjectDetailPage from './src/components/t6/ProjectDetailPage.jsx';
      import * as store from './src/utils/t6/t6Store.js';

      // 注册 T6 Store 适配器
      store._setAdapterForTests({
        get: (k) => {
          const val = window.__inMemoryPersistStore.has(k)
            ? JSON.parse(JSON.stringify(window.__inMemoryPersistStore.get(k)))
            : null;
          window.__persistCallTrace.push({
            seq: window.__persistCallTrace.length + 1,
            time: Date.now(),
            action: 't6_get',
            key: k,
            value: val
          });
          return val;
        },
        set: (k, v) => {
          if (window.__simulateScenarioSaveError && k.startsWith('t6.costScenario.')) {
            window.__persistCallTrace.push({
              seq: window.__persistCallTrace.length + 1,
              time: Date.now(),
              action: 't6_set_error',
              key: k,
              error: window.__simulateScenarioSaveError.message,
              attemptedValue: JSON.parse(JSON.stringify(v))
            });
            throw window.__simulateScenarioSaveError;
          }
          const prev = window.__inMemoryPersistStore.has(k)
            ? JSON.parse(JSON.stringify(window.__inMemoryPersistStore.get(k)))
            : null;
          const cloned = JSON.parse(JSON.stringify(v));
          window.__inMemoryPersistStore.set(k, cloned);
          window.__persistCallTrace.push({
            seq: window.__persistCallTrace.length + 1,
            time: Date.now(),
            action: 't6_set',
            key: k,
            prev,
            value: cloned
          });
        },
        keys: () => {
          return [...window.__inMemoryPersistStore.keys()].filter(k => /^t6\\./.test(k));
        }
      });

      window.__t6Store = store;

      function HarnessRoot() {
        const [renderState, setRenderState] = useState({
          mode: 'idle',
          projectId: null,
          useExplicitKey: true,
          keyIndex: 0
        });

        useEffect(() => {
          window.__setHarnessRenderState = (next) => {
            setRenderState((prev) => ({
              ...prev,
              ...next,
              keyIndex: next.useExplicitKey === false ? prev.keyIndex : prev.keyIndex + 1
            }));
          };
        }, []);

        const { mode, projectId, useExplicitKey, keyIndex } = renderState;

        if (mode === 'project-detail') {
          const keyProp = useExplicitKey ? ('pdetail-' + projectId + '-' + keyIndex) : 'pdetail-fixed-instance';
          return (
            <ProjectDetailPage
              key={keyProp}
              projectId={projectId}
              onBack={() => {
                if (window.__onBackCalled) window.__onBackCalled();
                setRenderState((prev) => ({ ...prev, mode: 'idle', projectId: null, keyIndex: prev.keyIndex + 1 }));
              }}
            />
          );
        }
        return <div id="harness-idle" className="p-4 text-xs text-gray-400">Harness Idle (List view placeholder)</div>;
      }

      const root = createRoot(document.getElementById('root'));
      root.render(<HarnessRoot />);

      window.__harnessMethods = {
        setupSyntheticProjects: () => {
          const cA = store.ensureCandidate({
            sourceProductId: 'cand-synth-A',
            name: '项目A (猫咪去油慕斯)',
            categoryLeaf: '宠物清洁'
          }).candidate;

          const sA = store.createSnapshot({
            candidateId: cA.id,
            sourceProductId: cA.sourceProductId,
            sourceInputs: {
              name: '项目A (猫咪去油慕斯)',
              price_rub: 2800,
              weight_kg: 0.35,
              dims: [15, 10, 5],
              commission_rfbs: 11
            },
            scoreResult: { totalScore: 85, grade: 'A', decision: { status: 'RECOMMENDED', action: 'LAUNCH' } },
            marketContext: { matchMethod: 'exact' },
            marketEvidence: { eacStatus: 'Not Required' }
          });

          const pA = store.createProject({
            candidateId: cA.id,
            creationSnapshotId: sA.id,
            name: '项目A (猫咪去油慕斯)'
          });

          const cB = store.ensureCandidate({
            sourceProductId: 'cand-synth-B',
            name: '项目B (自动烘干箱)',
            categoryLeaf: '宠物电器'
          }).candidate;

          const sB = store.createSnapshot({
            candidateId: cB.id,
            sourceProductId: cB.sourceProductId,
            sourceInputs: {
              name: '项目B (自动烘干箱)',
              price_rub: 9800,
              weight_kg: 4.8,
              dims: [45, 40, 35],
              commission_rfbs: 15
            },
            scoreResult: { totalScore: 78, grade: 'B', decision: { status: 'RECOMMENDED', action: 'REVIEW' } },
            marketContext: { matchMethod: 'exact' },
            marketEvidence: { eacStatus: 'EAC Certificate' }
          });

          const pB = store.createProject({
            candidateId: cB.id,
            creationSnapshotId: sB.id,
            name: '项目B (自动烘干箱)'
          });

          window.__syntheticProjectIds = { A: pA.id, B: pB.id };
          return { pA, pB, sA, sB };
        }
      };
    `
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  plugins: [persistSpyPlugin, exchangeRateSpyPlugin],
  define: {
    'process.env.NODE_ENV': '"test"',
    'import.meta.env.BASE_URL': '"/"'
  }
});

const bundleJs = bundle.outputFiles[0].text;
console.log(`  ✅ Bundle 打包成功 (${(bundleJs.length / 1024).toFixed(1)} KB)`);

// 启动 Headless Chrome 并执行测试
console.log('\n--- STEP 3: 启动无头 Chrome 执行 notice 可见性与归属测试 ---');

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const observedPageErrors = [];
const observedConsoleMessages = [];
let wbDuplicateKeyWarningsCount = 0;

page.on('pageerror', (err) => {
  console.error('  ❌ 发生未处理的 PageError:', err.message);
  observedPageErrors.push({ message: err.message, stack: err.stack, time: Date.now() });
});

page.on('console', (msg) => {
  const text = msg.text();
  const type = msg.type();
  observedConsoleMessages.push({ type, text, time: Date.now() });

  if (text.includes('Warning: Encountered two children with the same key')) {
    wbDuplicateKeyWarningsCount++;
    return;
  }

  if (type === 'error') {
    console.error('  ❌ 页面 Console.error 捕获:', text);
  }
});

page.on('dialog', async (dialog) => {
  console.log(`  [BROWSER_DIALOG] ${dialog.type()}: ${dialog.message()}`);
  await dialog.accept();
});

// 拦截外部网络请求，提供静态佣金数据
const wbCommissionJson = await fs.readFile(path.join(appDir, 'public/data/wb_commission.json'), 'utf8');
await page.route('**/*', (route) => route.abort());

const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KJ-GEMINI-20260922-001 Notice Visibility Test Harness</title>
  <style>${compiledCss}</style>
  <script id="wb-commission-data" type="application/json">${wbCommissionJson}</script>
  <script>
    window.KUAJING_CONFIG = {
      dataBase: 'http://synthetic.local/data/',
      assetBase: 'http://synthetic.local/'
    };
    const origFetch = window.fetch;
    window.fetch = async function(url, init) {
      const u = String(url);
      if (u.includes('wb_commission.json')) {
        const raw = document.getElementById('wb-commission-data').textContent;
        return new Response(raw, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return origFetch ? origFetch.apply(this, arguments) : Promise.reject(new Error('Network aborted'));
    };
  </script>
</head>
<body class="fyzsxnb-kuajing-root bg-workspace-bg text-workspace-text p-4">
  <div id="root" class="max-w-7xl mx-auto"></div>
</body>
</html>
`;

await page.setContent(htmlContent);
await page.addScriptTag({ content: bundleJs, type: 'module' });
await page.waitForFunction(() => typeof window.__harnessMethods !== 'undefined');
console.log('  ✅ 测试基座 HTML 与 Bundle 载入完成');

// 初始化合成项目 A & B
const initRes = await page.evaluate(() => {
  return window.__harnessMethods.setupSyntheticProjects();
});
const projAId = initRes.pA.id;
const projBId = initRes.pB.id;
const readB = () => page.evaluate(pid => {
  const project = window.__t6Store.getProject(pid);
  return { project, snapshot: window.__t6Store.getSnapshot(project.source.creationSnapshotId), scenarios: window.__t6Store.getProjectScenarios(pid) };
}, projBId);
const untouchedB = await readB();
console.log(`  ✅ 初始化合成项目完成: Project A (${projAId}), Project B (${projBId})`);

const results = {
  task_id: 'KJ-GEMINI-20260922-001',
  timestamp: new Date().toISOString(),
  scenarios: {}
};

// =========================================================================
// SCENARIO 1: Ozon 保存失败可见性与原位重试闭环 (TASK.md §验收 1 & 2 & 6)
// =========================================================================
console.log('\n--- SCENARIO 1: Ozon 保存失败可见性与原位重试闭环 ---');

// 1. 挂载 Project A 的 ProjectDetailPage
await page.evaluate((pid) => {
  window.__setHarnessRenderState({ mode: 'project-detail', projectId: pid, useExplicitKey: true });
}, projAId);

await page.waitForSelector('button:has-text("成本与物流")');

// 2. 切换到 costing Tab
await page.click('button:has-text("成本与物流")');
await page.waitForSelector('button:has-text("使用 Ozon 核算")');

// 3. 打开 Ozon 核算器
await page.click('button:has-text("使用 Ozon 核算")');
await page.waitForSelector('text=Ozon 核算面板 · 项目');

// 4. 验证验收点 6: 未确认保存按钮禁用
const saveBtn = page.getByRole('button', { name: '保存此方案到项目' });
const isSaveBtnDisabledInitially = await saveBtn.isDisabled();
assert.equal(isSaveBtnDisabledInitially, true, 'S1.1 (验收 6): 未勾选人工确认前，保存为成本场景按钮必须处于 disabled 状态');
console.log('  ✅ S1.1: 未勾选人工确认前，保存按钮正确处于 disabled 状态');

// 5. 填写采购成本 115 元
const costInput = page.locator('label:has-text("采购成本") + div input').first();
await costInput.fill('115');
assert.equal(await costInput.inputValue(), '115', 'S1.2: 采购成本应成功填入 115 元');

// 6. 勾选人工确认复选框
const confirmCheckbox = page.locator('label:has-text("已确认采购成本及平台费用假设") input');
await confirmCheckbox.check();
assert.equal(await confirmCheckbox.isChecked(), true, 'S1.3: 人工确认复选框已勾选');
assert.equal(await saveBtn.isEnabled(), true, 'S1.3b: 勾选确认后保存按钮已启用');

// 记录保存前 Project A/B 的完整存储快照
const storeBeforeFailure = await page.evaluate(() => {
  return [...window.__inMemoryPersistStore.entries()];
});

// 7. 注入保存失败异常 (模拟 T6 并发锁占用)
await page.evaluate(() => {
  window.__simulateScenarioSaveError = new Error('T6_BACKEND_LOCKED: 并发场景保存锁已被占用，写入被阻止');
});

// 8. 点击保存方案
await saveBtn.click();

// 9. 断言验收点 1: 当前 costing 页可见错误、输入 115 保留、确认状态保留、核算器不关闭、T6 实体不变
const noticeLocator = page.locator('[role="status"]');
await noticeLocator.waitFor({ state: 'visible', timeout: 3000 });
const errorNoticeText = await noticeLocator.innerText();

assert.ok(errorNoticeText.includes('T6_BACKEND_LOCKED'), `S1.4 (验收 1): costing 页必须即刻直接可见错误信息！实测可见: "${errorNoticeText}"`);
assert.equal(await costInput.inputValue(), '115', 'S1.5 (验收 1): 保存失败时成本输入 115 必须完好保留');
assert.equal(await confirmCheckbox.isChecked(), true, 'S1.6 (验收 1): 保存失败时人工确认状态不得偷偷取消');
assert.equal(await page.isVisible('text=Ozon 核算面板 · 项目'), true, 'S1.7 (验收 1): 保存失败时核算器面板绝不能关闭');

// 截取成本页直接展示失败提示的截图
await page.screenshot({ path: path.join(EVIDENCE_DIR, 's1-ozon-save-failure-in-costing.png') });

// 验证 T6 实体前后完全相同
const storeAfterFailure = await page.evaluate(() => {
  return [...window.__inMemoryPersistStore.entries()];
});
assert.deepEqual(storeBeforeFailure, storeAfterFailure, 'S1.8 (验收 1): 保存失败前后全部 T6 实体与持久化状态必须完全相同');
console.log('  ✅ S1 (验收 1): Ozon 保存失败时 costing 页直接可见错误提示，输入 115 与确认状态保留，核算器未关闭，实体 0 变动');

// 10. 执行验收点 2: 移除故障，不切页直接原位重试
await page.evaluate(() => {
  window.__simulateScenarioSaveError = null;
});

// 直接再次点击保存（原位重试）
await saveBtn.click();

// 断言验收点 2: 核算器关闭、新增 1 个场景载荷为 115、B 项目不变、costing 页展示成功提示
await page.waitForSelector('text=Ozon 核算面板 · 项目', { state: 'detached', timeout: 3000 });
await noticeLocator.waitFor({ state: 'visible', timeout: 3000 });
const successNoticeText = await noticeLocator.innerText();

assert.ok(successNoticeText.includes('已保存成本场景'), `S1.9 (验收 2): 原位重试成功后 costing 页必须可见成功通知！实测可见: "${successNoticeText}"`);

// 截取成本页展示成功提示与场景列表的截图
await page.screenshot({ path: path.join(EVIDENCE_DIR, 's1-ozon-save-success-in-costing.png') });

// 检查落库载荷
const projectScenarios = await page.evaluate((pid) => {
  return window.__t6Store.getProjectScenarios(pid);
}, projAId);
assert.equal(projectScenarios.length, 1, 'S1.10 (验收 2): Project A 必须恰好新增 1 个场景');
const savedOzonScenario = projectScenarios[0];
assert.equal(savedOzonScenario.inputPayload.purchaseCost, 115, 'S1.11 (验收 2): 原位重试落库场景的实际采购成本载荷必须严格为 115 元！');

// 检查 Project B
const projectBScenarios = await page.evaluate((pid) => {
  return window.__t6Store.getProjectScenarios(pid);
}, projBId);
assert.equal(projectBScenarios.length, 0, 'S1.12 (验收 2): Project B 的场景数必须保持为 0，绝对无串改');

console.log('  ✅ S1 (验收 2): 移除故障原位重试成功闭环！落库成本严格为 115 元，核算器关闭，成功通知在 costing 页可见，B 项目保持 0 场景');

results.scenarios.s1_ozon_flow = {
  status: 'passed',
  error_notice_visible_in_costing: errorNoticeText,
  input_retained_on_failure: 115,
  saved_cost_on_retry: savedOzonScenario.inputPayload.purchaseCost,
  project_b_scenarios_count: 0
};

// =========================================================================
// SCENARIO 2: WB 保存失败可见性与原位重试闭环 (TASK.md §验收 1 & 2)
// =========================================================================
console.log('\n--- SCENARIO 2: WB 保存失败可见性与原位重试闭环 ---');

// 1. 打开 WB 核算器
await page.click('button:has-text("使用 WB 核算")');
await page.waitForSelector('text=WB 核算面板 · 项目');
await page.getByRole('button', { name: '单订单核算器' }).click();
await page.locator('text=输入参数').waitFor();

// 2. 填写采购成本 115 元并确认
const wbSaveBtn = page.getByRole('button', { name: '保存此方案到项目（不可变成本场景）' });
assert.equal(await wbSaveBtn.isDisabled(), true, 'S2.0: 未勾选人工确认前 WB 保存按钮处于禁用状态');

const wbCostInput = page.locator('label:has-text("采购成本") + div input').first();
await wbCostInput.fill('115');
const wbConfirmCheckbox = page.locator('label:has-text("已确认采购成本、佣金率与费用假设") input');
await wbConfirmCheckbox.check();
assert.equal(await wbConfirmCheckbox.isChecked(), true, 'S2.1: WB 人工确认复选框已勾选');
assert.equal(await wbSaveBtn.isEnabled(), true, 'S2.1b: 勾选后启用');

// 3. 注入 WB 保存失败
await page.evaluate(() => {
  window.__simulateScenarioSaveError = new Error('T6_BACKEND_LOCKED: WB 订单场景并发锁冲突');
});

// 4. 点击保存方案
const wbStoreBeforeFailure = await page.evaluate(() => [...window.__inMemoryPersistStore.entries()]);
await wbSaveBtn.click();

// 5. 断言 costing 页即刻可见 WB 错误
await noticeLocator.waitFor({ state: 'visible', timeout: 3000 });
const wbErrorNoticeText = await noticeLocator.innerText();
assert.ok(wbErrorNoticeText.includes('WB 订单场景并发锁冲突'), `S2.2 (验收 1): costing 页必须即刻可见 WB 错误！实测: "${wbErrorNoticeText}"`);
assert.equal(await wbCostInput.inputValue(), '115', 'S2.3: WB 成本输入 115 保留');
assert.equal(await wbConfirmCheckbox.isChecked(), true, 'S2.4: WB 人工确认状态保留');
assert.equal(await page.isVisible('text=WB 核算面板 · 项目'), true, 'S2.5: WB 核算器面板保持展开');

await page.screenshot({ path: path.join(EVIDENCE_DIR, 's2-wb-save-failure-in-costing.png') });

assert.deepEqual(await page.evaluate(() => [...window.__inMemoryPersistStore.entries()]), wbStoreBeforeFailure, 'Reviewer: WB failed save preserves full persisted state');
// 6. 移除故障，原位重试
await page.evaluate(() => {
  window.__simulateScenarioSaveError = null;
});
await wbSaveBtn.click();

// 7. 断言成功闭环
await page.waitForSelector('text=WB 核算面板 · 项目', { state: 'detached', timeout: 3000 });
await noticeLocator.waitFor({ state: 'visible', timeout: 3000 });
const wbSuccessNoticeText = await noticeLocator.innerText();
assert.ok(wbSuccessNoticeText.includes('已保存 WB 成本场景'), `S2.6: costing 页可见 WB 成功提示: "${wbSuccessNoticeText}"`);

const projectAScenariosAfterWB = await page.evaluate((pid) => {
  return window.__t6Store.getProjectScenarios(pid);
}, projAId);
assert.equal(projectAScenariosAfterWB.length, 2, 'S2.7: Project A 现应有 2 个场景 (1 Ozon + 1 WB)');
const savedWbScenario = projectAScenariosAfterWB.find(s => s.platform === 'WB');
assert.ok(savedWbScenario, 'S2.8: 必须存在 WB 场景');
assert.equal(savedWbScenario.inputPayload.purchaseCost, 115, 'S2.9: WB 场景载荷成本严格为 115 元');
assert.equal(await page.evaluate(pid => window.__t6Store.getProjectScenarios(pid).length, projBId), 0, 'Reviewer: B has no scenarios after both retries');

await page.screenshot({ path: path.join(EVIDENCE_DIR, 's2-wb-save-success-in-costing.png') });
assert.deepEqual(await readB(), untouchedB, 'Reviewer: B project, snapshot and scenarios unchanged after both retries');
console.log('  Reviewer: B project, snapshot and scenarios unchanged');

results.scenarios.s2_wb_flow = {
  status: 'passed',
  error_notice_visible_in_costing: wbErrorNoticeText,
  saved_cost_on_retry: savedWbScenario.inputPayload.purchaseCost
};

// =========================================================================
// SCENARIO 3: 全 Tab 消息可见且不重复、无空通知、最新覆盖 (TASK.md §验收 3)
// =========================================================================
console.log('\n--- SCENARIO 3: 全 Tab 覆盖与无冗余渲染断言 ---');

// 1. 验证在当前有 notice 状态下，切换到所有 Tab 均能看到 notice，且全页面严格仅有 1 个 [role="status"]
const tabsToCheck = ['overview', 'product', 'suppliers', 'costing', 'compliance', 'operations'];
const tabLabels = {
  overview: '概览',
  product: '产品',
  suppliers: '供应链',
  costing: '成本与物流',
  compliance: '合规',
  operations: '运营'
};

for (const tabId of tabsToCheck) {
  await page.click(`button:has-text("${tabLabels[tabId]}")`);
  const count = await page.locator('[role="status"]').count();
  assert.equal(count, 1, `S3.1: 在 Tab "${tabLabels[tabId]}" 下，[role="status"] 节点数量必须严格为 1（不多不少）`);
  const text = await page.locator('[role="status"]').innerText();
  assert.ok(text.length > 0, `S3.2: 在 Tab "${tabLabels[tabId]}" 下通知内容非空`);
}
console.log('  ✅ S3.1: 所有 6 个 Tab (overview, product, suppliers, costing, compliance, operations) 均能看到 notice 且全页严格仅有 1 份');

// 2. 验证无 notice 时不渲染空通知
await page.evaluate(() => {
  // 重新渲染一个没有设置 notice 的干净实例
  window.__setHarnessRenderState({ mode: 'project-detail', projectId: window.__syntheticProjectIds.B, useExplicitKey: true });
});
await page.locator('text=项目B (自动烘干箱)').waitFor();
const emptyNoticeCount = await page.locator('[role="status"]').count();
assert.equal(emptyNoticeCount, 0, 'S3.3 (验收 3): 无 notice 时严禁渲染任何空通知 DOM 节点！');
console.log('  ✅ S3.3: 无 notice 时严格不渲染空通知节点 (count === 0)');

async function triggerLifecycleAction() {
  const btn = page.locator('button:has-text("启动"), button:has-text("暂停"), button:has-text("恢复")').first();
  await btn.click();
  await page.waitForSelector('[role="status"]');
  return await page.locator('[role="status"]').innerText();
}

// 3. 验证连续消息更新：最新消息覆盖旧条目，不累加
await page.evaluate(() => {
  window.__setHarnessRenderState({ mode: 'project-detail', projectId: window.__syntheticProjectIds.A, useExplicitKey: true });
});
await page.locator('text=项目A (猫咪去油慕斯)').waitFor();
await page.click('button:has-text("概览")');

// 连续触发两次生命周期动作产生不同的 notice
const msg1 = await triggerLifecycleAction();
console.log(`  S3.4: 第一次操作通知: ${msg1}`);

const msg2 = await triggerLifecycleAction();
console.log(`  S3.5: 第二次操作通知: ${msg2}`);
assert.notEqual(msg1, msg2, '两次操作通知文案应不同');
assert.equal(msg2.includes(msg1), false, 'S3.6 (验收 3): 新通知必须完全替换旧通知，严禁累加拼接旧条目');
console.log('  ✅ S3.6: 连续产生通知时最新消息完全覆盖，无旧条目拼接累加');

results.scenarios.s3_all_tabs_and_single_notice = {
  status: 'passed',
  all_tabs_checked: tabsToCheck,
  empty_notice_renders_zero_nodes: true,
  latest_replaces_old: true
};

// =========================================================================
// SCENARIO 4: A 切 B 两种边界下的通知项目归属隔离 (TASK.md §验收 4)
// =========================================================================
console.log('\n--- SCENARIO 4: A 切 B 两种边界下的通知项目归属隔离 ---');

// 4.1 边界 1: 同实例 Props 切换（useExplicitKey: false，组件实例不卸载）
console.log('  * 测试边界 1: 同实例 Props 切换 (不变 key)');
// 先在 Project A 中确保存在 notice
await page.evaluate((pidA) => {
  window.__setHarnessRenderState({ mode: 'project-detail', projectId: pidA, useExplicitKey: false });
}, projAId);
await page.locator('text=项目A (猫咪去油慕斯)').waitFor();
if ((await page.locator('[role="status"]').count()) === 0) {
  await triggerLifecycleAction();
}
const aNoticeCount = await page.locator('[role="status"]').count();
assert.equal(aNoticeCount, 1, 'S4.1: Project A 具有当前 notice');

// 同实例切换到 Project B
await page.evaluate((pidB) => {
  window.__setHarnessRenderState({ mode: 'project-detail', projectId: pidB, useExplicitKey: false });
}, projBId);
await page.locator('text=项目B (自动烘干箱)').waitFor();

// 验证 Project B 中绝对不显示 Project A 的 notice
const bNoticeCountSameInstance = await page.locator('[role="status"]').count();
assert.equal(bNoticeCountSameInstance, 0, 'S4.2 (验收 4 - 边界 1): 同实例切换至 Project B 时，Project A 的旧 notice 必须立即隐匿，严禁跨项目展示！');
console.log('  ✅ S4.2: 同实例切换至 Project B，A 的通知完全隐匿 (count === 0)');

// 在 Project B 设置一个新 notice
const bNoticeText = await triggerLifecycleAction();
assert.ok(bNoticeText.length > 0, 'S4.3: Project B 能够正常展示自身新生成的通知');

// 同实例再切回 Project A：此时 B 的 notice 也不得显示给 A
await page.evaluate((pidA) => {
  window.__setHarnessRenderState({ mode: 'project-detail', projectId: pidA, useExplicitKey: false });
}, projAId);
await page.locator('text=项目A (猫咪去油慕斯)').waitFor();
const aNoticeCountAfterBack = await page.locator('[role="status"]').count();
assert.equal(aNoticeCountAfterBack, 0, 'S4.4 (验收 4): 切回 Project A 时，B 的通知同样不得污染 A！');
console.log('  ✅ S4.4: 切回 Project A，B 的通知亦不污染 A');

// 4.2 边界 2: 真实导航经列表卸载重挂 (onBack -> List -> Detail B)
console.log('  * 测试边界 2: 真实导航经列表卸载重挂 (onBack -> Detail B)');
// 在 Project A 中产生 notice
await triggerLifecycleAction();

// 点击“返回列表”触发 onBack 卸载
await page.click('button:has-text("返回列表")');
await page.waitForSelector('#harness-idle');
console.log('    已触发 onBack 卸载 ProjectDetailPage，回到列表占位');

// 重新进入 Project B
await page.evaluate((pidB) => {
  window.__setHarnessRenderState({ mode: 'project-detail', projectId: pidB, useExplicitKey: true });
}, projBId);
await page.locator('text=项目B (自动烘干箱)').waitFor();
await page.waitForSelector('button:has-text("概览")');

const bNoticeCountAfterListNav = await page.locator('[role="status"]').count();
assert.equal(bNoticeCountAfterListNav, 0, 'S4.5 (验收 4 - 边界 2): 经列表卸载重新进入 Project B 时，A 的通知绝不复现！');
console.log('  ✅ S4.5: 经列表卸载重进 Project B，A 的通知 0 残留');

results.scenarios.s4_ownership_isolation = {
  status: 'passed',
  boundary_1_same_instance_clean: true,
  boundary_2_list_navigation_clean: true
};

// =========================================================================
// SCENARIO 5: 390 / 768 / 1440 视口长错误换行、无溢出、无遮挡与无障碍 (TASK.md §验收 5)
// =========================================================================
console.log('\n--- SCENARIO 5: 390 / 768 / 1440 响应式视口、长错误换行与可访问性 ---');

// 注入超长极端错误文案
const longErrorMessage = 'T6_ERROR_LONG_PAYLOAD_VERIFICATION_TRANSACTION_LOCK_FAILED_CODE_9876543210_PATH_OZON_RFBS_CALCULATOR_SUBMISSION_DEADLOCK_DETECTED_AT_ISOLATION_BOUNDARY_PLEASE_CHECK_INTEGRITY';

await page.evaluate((msg) => {
  window.__simulateScenarioSaveError = new Error(msg);
}, longErrorMessage);

await page.evaluate((pidA) => {
  window.__setHarnessRenderState({ mode: 'project-detail', projectId: pidA, useExplicitKey: true });
}, projAId);
await page.waitForSelector('button:has-text("成本与物流")');
await page.click('button:has-text("成本与物流")');
await page.click('button:has-text("使用 Ozon 核算")');
await page.locator('label:has-text("采购成本") + div input').first().fill('120');
await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
await page.getByRole('button', { name: '保存此方案到项目' }).click();

await noticeLocator.waitFor({ state: 'visible', timeout: 3000 });
const renderedLongNotice = await noticeLocator.innerText();
assert.ok(renderedLongNotice.includes(longErrorMessage), 'S5.1: 超长错误文案已成功显示');

const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 }
];

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(200);

  // 1. 检查 notice 元素盒模型
  const noticeBox = await noticeLocator.boundingBox();
  assert.ok(noticeBox, `S5.2 (${vp.name}): notice 必须有盒模型`);
  assert.ok(
    noticeBox.width <= vp.width,
    `S5.3 (${vp.name}): notice 宽度 (${noticeBox.width}) 严禁超过视口宽度 (${vp.width})！`
  );

  // 2. 检查页面是否产生意外的横向滚动条
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  assert.ok(
    scrollWidth <= clientWidth + 2,
    `S5.4 (${vp.name}): 页面不得出现横向溢出滚动 (scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth})`
  );

  // 3. 检查 notice 不遮挡 Tab 按钮
  const costingTabBtn = page.locator('button:has-text("成本与物流")');
  const tabBox = await costingTabBtn.boundingBox();
  assert.ok(
    noticeBox.y >= (tabBox.y + tabBox.height - 2),
    `S5.5 (${vp.name}): notice 必须位于 Tab 栏下方，严禁遮挡 Tab 栏 (noticeBox.y: ${noticeBox.y}, tabBottom: ${tabBox.y + tabBox.height})`
  );

  // 4. 截图保存
  const screenshotPath = path.join(EVIDENCE_DIR, `s5-viewport-${vp.name}-long-error.png`);
  await page.screenshot({ path: screenshotPath });
  console.log(`  ✅ S5 (${vp.name}): 视口核验通过，notice 宽 ${noticeBox.width.toFixed(1)}px 无横向溢出，截图已保存`);
}

// 5. 辅助技术与键盘可达性验证
console.log('  * 辅助技术与键盘聚焦验证');
const roleAttr = await noticeLocator.getAttribute('role');
const ariaLiveAttr = await noticeLocator.getAttribute('aria-live');
assert.equal(roleAttr, 'status', 'S5.6 (验收 5): notice 容器必须拥有 role="status"');
assert.equal(ariaLiveAttr, 'polite', 'S5.7 (验收 5): notice 容器必须拥有 aria-live="polite"');

// 键盘聚焦测试：使用 Tab 键聚焦并验证焦点能够正常移动到页面控件
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await page.getByRole('button', { name: '成本与物流', exact: true }).focus();
let saveReached = false;
for (let i = 0; i < 150; i++) {
  await page.keyboard.press('Tab');
  saveReached = await page.getByRole('button', { name: '保存此方案到项目', exact: true }).evaluate(el => el === document.activeElement);
  if (saveReached) break;
}
assert.ok(saveReached, 'Reviewer: keyboard reaches enabled Ozon save button');
results.reviewer_additions = { wb_failed_save_full_store_unchanged: true, b_project_snapshot_scenarios_unchanged: true, b_scenarios_after_both_retries: 0, keyboard_save_reachable: true };
const activeTagName = await page.evaluate(() => document.activeElement?.tagName);
assert.ok(['BUTTON', 'INPUT', 'A'].includes(activeTagName), `S5.8 (验收 5): 键盘 Tab 键必须可达页面交互控件，当前焦点元素: <${activeTagName}>`);
console.log(`  ✅ S5.8: 辅助技术属性 (role=status, aria-live=polite) 齐全，键盘聚焦无障碍`);

results.scenarios.s5_responsive_and_a11y = {
  status: 'passed',
  viewports_tested: viewports.map(v => v.name),
  no_horizontal_overflow: true,
  role_status: roleAttr,
  aria_live: ariaLiveAttr
};

// =========================================================================
// STEP 4: 严格日志与异常分析总结
// =========================================================================
console.log('\n--- STEP 4: 控制台与页面异常分类审计 ---');

console.log(`  - 页面 unhandled pageerror 数量: ${observedPageErrors.length}`);
console.log(`  - WB 线路下拉框 duplicate key 警告数量: ${wbDuplicateKeyWarningsCount}`);

// 过滤非 WB duplicate key 的控制台错误
const unexpectedErrors = observedConsoleMessages.filter(m => {
  if (m.type !== 'error') return false;
  if (m.text.includes('Warning: Encountered two children with the same key')) return false;
  return true;
});

console.log(`  - 非预期 console.error 数量: ${unexpectedErrors.length}`);

// 严格断言：意外错误直接导致失败！
assert.equal(observedPageErrors.length, 0, '验收要求：意外 pageerror 必须为 0！');
assert.equal(unexpectedErrors.length, 0, '验收要求：非预期 console.error 必须为 0！');

// 保存 trace 与观察日志
const traceData = await page.evaluate(() => window.__persistCallTrace);
await fs.writeFile(path.join(EVIDENCE_DIR, 'persist-call-trace.json'), JSON.stringify(traceData, null, 2));
await fs.writeFile(path.join(EVIDENCE_DIR, 'observed-console.json'), JSON.stringify(observedConsoleMessages, null, 2));
await fs.writeFile(path.join(EVIDENCE_DIR, 'observed-page-errors.json'), JSON.stringify(observedPageErrors, null, 2));
await fs.writeFile(path.join(EVIDENCE_DIR, 'test-results.json'), JSON.stringify(results, null, 2));

await browser.close();

console.log('\n===== 全部真实浏览器端到端组件验收用例 100% 通过！ =====\n');
