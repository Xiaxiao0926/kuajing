/**
 * docs/ai-handoff/KJ-GEMINI-20260921-006/run-revision-costing-tests.mjs
 * 
 * KJ-GEMINI-20260921-006 Revision 001: 真实父页面链路、真实 WB 操作与异常观测补验套件
 * 
 * 补验目标（依据 REVISION-001.md 与 REVIEW.md）：
 * 1. R1 实际父页面与同实例路径：
 *    - 用真实 ProjectDetailPage 挂载，进入 costing Tab，点击使用 Ozon/WB 核算；
 *    - 实际点击保存，执行真实的 saveOzonScenario / saveWbScenario；
 *    - 核对场景目标、当前项目、核算器关闭 (setOzonContext(null))、场景列表刷新与通知行为；
 *    - 对比不变 key 的 A/B props 切换与真实路由卸载重挂的差异。
 * 2. R2 真实 WB 操作：
 *    - 删除手动 Map.set 与手写 trace；
 *    - 通过真实控件执行：CalculatorTab 保存 SKU 模板、TariffTab 默认费率重置、OrdersTab 合成 CSV 导入与删除；
 *    - 针对无 UI 编辑控件的 wb-settings-v1 主动保存，如实标记 not_applicable 并引用源码证据；
 *    - 种子数据标明 seed，观测数据来自实际拦截调用。
 * 3. R3 保存失败与错误提示：
 *    - 注册 pageerror 与 console.error 监听，记录来源；
 *    - 独立 persist 失败与真实父页场景保存失败分别验证输入保留与提示可见性；
 *    - 保留采购假设人工确认（确认前按钮禁用，确认后启用）。
 * 4. R4 数据证据与判定校正：
 *    - 每个关键场景保存完整合成存储 before/after 快照与实体键 (t6.project.<id>, t6.costScenario.<id>)；
 *    - 结果区分 execution_status, assertions_status, business_verdict (issues_found)；
 *    - 正常运行与故障运行输出独立至 revision-normal 与 revision-fault，不覆盖 Codex 目录。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const isFaultInjection = process.env.TEST_INJECT_CROSS_PROJECT_CORRUPTION === '1';
const modeName = isFaultInjection ? 'revision-fault' : 'revision-normal';

console.log(`===== KJ-GEMINI-20260921-006 Revision 001 Test Suite [Mode: ${modeName}] =====\n`);

const ROOT = path.resolve('.');
const TASK_DIR = path.join(ROOT, 'docs/ai-handoff/KJ-GEMINI-20260921-006');
const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence', modeName);
await fs.mkdir(EVIDENCE_DIR, { recursive: true });

const codexModulesPath = process.env.CODEX_NODE_MODULES || (
  process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
    : 'C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules'
);
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

// 2. 编译真实项目 CSS
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

// 3. 构建 Esbuild 隔离替身插件
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
            context: window.__currentContext || 'unknown',
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
                context: window.__currentContext || 'unknown',
                error: err.message
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
            context: window.__currentContext || 'unknown',
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
            context: window.__currentContext || 'unknown',
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
    build.onResolve({ filter: /(useExchangeRate|exchangeRate)(\.js)?$/ }, (args) => ({
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
            date: '2026-09-21',
            auto: false
          };
        }
        if (!window.__rateListeners) window.__rateListeners = new Set();

        export function getRateInfo() {
          return { ...window.__syntheticRateInfo };
        }
        export function formatRubPerCny(val) {
          const n = Number(val);
          return Number.isFinite(n) ? n.toFixed(2) : '12.50';
        }
        export function formatCnyPerRub(val) {
          const n = Number(val);
          return Number.isFinite(n) ? (1 / n).toFixed(4) : '0.0800';
        }
        export function calcCommission(price, rate) {
          return (price || 0) * (rate || 0) / 100;
        }
        export function calcAgencyFee(cny, agencyFeeConfig) {
          return 0;
        }

        export function useExchangeRate() {
          const [rate, setRate] = React.useState(window.__syntheticRateInfo);
          React.useEffect(() => {
            const listener = (newRate) => setRate({ ...newRate });
            window.__rateListeners.add(listener);
            return () => window.__rateListeners.delete(listener);
          }, []);
          return rate;
        }

        window.__setSyntheticRate = function(update) {
          window.__syntheticRateInfo = { ...window.__syntheticRateInfo, ...update };
          window.__rateListeners.forEach((fn) => fn(window.__syntheticRateInfo));
        };
      `
    }));
  }
};

console.log('\n--- STEP 2: 打包真实组件与测试调度器 Bundle ---');

const bundle = await esbuild.build({
  stdin: {
    resolveDir: appDir,
    loader: 'jsx',
    sourcefile: 'costing-revision-bundle.jsx',
    contents: `
      import React, { useState, useEffect } from 'react';
      import { createRoot } from 'react-dom/client';
      import OzonCalc from './src/components/OzonCalc.jsx';
      import WBCalc from './src/components/WBCalc.jsx';
      import ProjectDetailPage from './src/components/t6/ProjectDetailPage.jsx';
      import * as store from './src/utils/t6/t6Store.js';
      import { buildOzonPrefill, buildWbPrefill } from './src/utils/t6/costScenarioAdapter.js';

      // 注册 T6 Store 适配器，使得 T6 实体读写均经由统一的 inMemoryPersistStore 且完整记录 trace
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
            context: window.__currentContext || 'unknown',
            value: val
          });
          return val;
        },
        set: (k, v) => {
          if (window.__simulateScenarioSaveError && k.startsWith('t6.costScenario.')) {
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
            context: window.__currentContext || 'unknown',
            prev,
            value: cloned
          });

          // 故障注入拦截钩子：当保存 Project A 的场景时，若故障注入开启，故意向 Project B 注入一个污染场景
          if (window.__injectCrossProjectCorruption && k.startsWith('t6.costScenario.')) {
            const scObj = cloned;
            const projAId = window.__syntheticProjectIds?.A;
            const projBId = window.__syntheticProjectIds?.B;
            if (scObj.projectId === projAId && projBId) {
              const corruptedKey = 't6.costScenario.corrupted_b_' + Date.now();
              const corruptedVal = {
                ...scObj,
                id: 'corrupted_b_' + Date.now(),
                projectId: projBId,
                name: 'CORRUPTED_SCENARIO_INJECTED_FROM_A',
                createdAt: new Date().toISOString()
              };
              window.__inMemoryPersistStore.set(corruptedKey, corruptedVal);
              window.__persistCallTrace.push({
                seq: window.__persistCallTrace.length + 1,
                time: Date.now(),
                action: 't6_set',
                key: corruptedKey,
                context: 'fault_injection',
                prev: null,
                value: corruptedVal
              });
            }
          }
        },
        keys: () => {
          return [...window.__inMemoryPersistStore.keys()].filter(k => /^t6\\./.test(k));
        }
      });

      window.__t6Store = store;

      function HarnessRoot() {
        const [renderState, setRenderState] = useState({
          mode: 'idle', // 'project-detail' | 'ozon-standalone' | 'wb-standalone' | 'idle'
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
          // useExplicitKey=false 时不改变 key，用于测试同实例 props 切换；否则按 keyIndex 卸载重挂
          const keyProp = useExplicitKey ? ('pdetail-' + projectId + '-' + keyIndex) : 'pdetail-fixed-instance';
          return <ProjectDetailPage key={keyProp} projectId={projectId} onBack={() => {}} />;
        }
        if (mode === 'ozon-standalone') {
          return <OzonCalc key={'ozon-standalone-' + keyIndex} projectContext={null} />;
        }
        if (mode === 'wb-standalone') {
          return <WBCalc key={'wb-standalone-' + keyIndex} projectContext={null} />;
        }
        return <div id="harness-idle" className="p-4 text-xs text-gray-400">Harness Idle</div>;
      }

      const root = createRoot(document.getElementById('root'));
      root.render(<HarnessRoot />);

      window.__harnessMethods = {
        setupSyntheticProjects: () => {
          // 种子数据预填（明确保留 seed 属性）
          const cA = store.ensureCandidate({
            sourceProductId: 'cand-synth-A',
            name: '项目A合成商品 (猫咪去油慕斯)',
            categoryLeaf: '宠物清洁'
          }).candidate;

          const sA = store.createSnapshot({
            candidateId: cA.id,
            sourceProductId: cA.sourceProductId,
            sourceInputs: {
              name: '项目A合成商品 (猫咪去油慕斯)',
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
            name: '项目A合成商品 (猫咪去油慕斯)'
          });

          const cB = store.ensureCandidate({
            sourceProductId: 'cand-synth-B',
            name: '项目B合成商品 (自动烘干箱)',
            categoryLeaf: '宠物电器'
          }).candidate;

          const sB = store.createSnapshot({
            candidateId: cB.id,
            sourceProductId: cB.sourceProductId,
            sourceInputs: {
              name: '项目B合成商品 (自动烘干箱)',
              price_rub: 9800,
              weight_kg: 4.80,
              dims: [60, 45, 35],
              commission_rfbs: 18
            },
            scoreResult: { totalScore: 92, grade: 'S', decision: { status: 'RECOMMENDED', action: 'LAUNCH' } },
            marketContext: { matchMethod: 'exact' },
            marketEvidence: { eacStatus: 'EAC Mandatory' }
          });

          const pB = store.createProject({
            candidateId: cB.id,
            creationSnapshotId: sB.id,
            name: '项目B合成商品 (自动烘干箱)'
          });

          window.__syntheticProjectIds = { A: pA.id, B: pB.id };
          return { projectAId: pA.id, projectBId: pB.id };
        },

        getStoreSnapshot: () => {
          return Object.fromEntries(window.__inMemoryPersistStore.entries());
        }
      };
    `
  },
  plugins: [persistSpyPlugin, exchangeRateSpyPlugin],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env.BASE_URL': '"/"' }
});

console.log(`  ✅ Bundle 打包成功 (${(bundle.outputFiles[0].text.length / 1024).toFixed(1)} KB)`);

// 4. 启动 Headless Chrome 并执行全场景测试
console.log('\n--- STEP 3: 真实 Headless Chrome 运行补验套件 ---');

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const observedPageErrors = [];
const observedConsoleMessages = [];

page.on('pageerror', (err) => {
  observedPageErrors.push({
    name: err.name,
    message: err.message,
    context: windowCurrentContext
  });
  console.log(`  [PAGE_ERROR] [${windowCurrentContext}] ${err.name}: ${err.message}`);
});

page.on('console', (msg) => {
  const text = msg.text();
  observedConsoleMessages.push({ type: msg.type(), text });
  if (msg.type() === 'error') {
    console.log(`  [BROWSER_ERR] ${text}`);
  }
});

page.on('dialog', async (dialog) => {
  console.log(`  [BROWSER_DIALOG] ${dialog.type()}: ${dialog.message()}`);
  await dialog.accept();
});

let windowCurrentContext = 'init';
async function setContext(ctxName) {
  windowCurrentContext = ctxName;
  await page.evaluate((c) => { window.__currentContext = c; }, ctxName);
}

// 拦截所有外部网络请求，仅放行本地静态佣金表
const wbCommissionJson = await fs.readFile(path.join(appDir, 'public/data/wb_commission.json'), 'utf8');

// 拦截所有外部网络请求
await page.route('**/*', (route) => route.abort());

await page.setContent(`
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Costing Revision 001 Test Harness</title>
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
    <body class="fyzsxnb-kuajing-root bg-gray-50 text-gray-900">
      <div id="root" class="max-w-7xl mx-auto p-4"></div>
    </body>
  </html>
`);

await page.addScriptTag({ content: bundle.outputFiles[0].text, type: 'module' });
await page.waitForFunction(() => typeof window.__harnessMethods !== 'undefined');

// 初始化合成项目
await setContext('seed_initialization');
const { projectAId, projectBId } = await page.evaluate(() => window.__harnessMethods.setupSyntheticProjects());
console.log(`  ✅ 合成项目初始化就绪 (Project A: ${projectAId}, Project B: ${projectBId})`);

const results = {
  task_id: 'KJ-GEMINI-20260921-006',
  revision: 1,
  mode: modeName,
  timestamp: new Date().toISOString(),
  execution_status: 'running',
  assertions_status: 'pending',
  business_verdict: 'pending',
  scenarios: {},
  snapshots: {},
  passed: false,
  error: null
};

try {
  // =========================================================================
  // R1.1: 真实 ProjectDetailPage 打开成本 Tab 与 Ozon 单品保存闭环
  // =========================================================================
  console.log('\n--- [R1.1] 真实 ProjectDetailPage 挂载与 Ozon 单品保存闭环 ---');
  await setContext('r1_1_parent_ozon_save');

  // 1.1 先写入一个独立单品历史预设 (purchaseCost: 65)，用于后续检验回退继承
  await page.evaluate(() => {
    window.__inMemoryPersistStore.set('shipping-calc-rfbs-v2', {
      price: 5200, weight: 1.55, length: 52, width: 45, height: 28,
      purchaseCost: '65', domesticShipping: 3, labelingFee: 2,
      commission: 12, adRate: 10, paymentFee: 1, agencyFee: 2, returnLoss: 4
    });
  });

  results.snapshots['R1_1_before'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());

  // 挂载真实 ProjectDetailPage
  await page.evaluate((id) => {
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id });
  }, projectAId);

  // 等待页面渲染 ProjectDetailPage
  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();

  // 点击“成本与物流” Tab
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();

  // 点击真实的“使用 Ozon 核算”按钮
  await page.getByRole('button', { name: '使用 Ozon 核算' }).click();

  // 验证 OzonCalc 成功内嵌挂载于 ProjectDetailPage，并显示真实项目编号
  await page.locator('text=Ozon 核算面板 · 项目 RU-2026-001').waitFor();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-1-ozon-calc-embedded.png') });

  // 验证输入框展示：来自候选真实数据
  const r1Price = await page.locator('label:has-text("售价") + div input').inputValue();
  const r1Weight = await page.locator('label:has-text("实重") + div input').inputValue();
  assert.equal(r1Price, '2800', 'R1.1: 售价应来自候选快照 2800');
  assert.equal(r1Weight, '0.35', 'R1.1: 重量应来自候选快照 0.35');

  // 关键事实验证：空白预填项回退继承了独立预设 65
  const r1Cost = await page.locator('label:has-text("采购成本") + div input').inputValue();
  assert.equal(r1Cost, '65', 'R1.1: 空白采购成本沿用了历史独立预设 65');

  // 修改采购成本为 95
  await page.locator('label:has-text("采购成本") + div input').fill('95');

  // 检查保存按钮初始为 DISABLED（人工确认未勾选）
  const saveBtn = page.getByRole('button', { name: '保存此方案到项目' });
  const isInitiallyDisabled = await saveBtn.isDisabled();
  assert.equal(isInitiallyDisabled, true, 'R1.1: 未勾选人工确认前保存按钮严格处于禁用状态');

  // 勾选人工确认复选框
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
  const isEnabledAfterCheck = await saveBtn.isEnabled();
  assert.equal(isEnabledAfterCheck, true, 'R1.1: 勾选人工确认后保存按钮变为可用状态');

  // 点击保存方案
  await saveBtn.click();
  await page.waitForTimeout(500);

  // 验证核心行为：
  // 1. setOzonContext(null) 生效，核算器自动关闭，返回成本列表！
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();
  const isOzonCalcClosed = (await page.locator('text=Ozon 核算面板 · 项目 RU-2026-001').count()) === 0;
  assert.equal(isOzonCalcClosed, true, 'R1.1: 保存成功后真实父页调用 setOzonContext(null) 关闭核算器');

  // 2. 场景列表展示出刚刚保存的不可变场景
  const scenarioCard = page.locator('text=RU-2026-001 Ozon rFBS 场景 #1').first();
  await scenarioCard.waitFor();
  assert.ok((await scenarioCard.count()) >= 1, 'R1.1: 场景列表成功刷新并显示新建的 Ozon 场景');

  // 3. 验证 T6 Store 中实体状态：Project A 有 1 个场景，Project B 场景数为 0
  const r1ScenariosA = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectAId);
  const r1ScenariosB = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectBId);
  assert.equal(r1ScenariosA.length, 1, 'R1.1: Project A 在 Store 中有且仅有 1 个场景');
  assert.equal(r1ScenariosB.length, 0, 'R1.1: Project B 在 Store 中严格为 0 个场景');
  assert.equal(r1ScenariosA[0].inputPayload.purchaseCost, 95, 'R1.1: Project A 场景内采购成本为 95');

  // 4. 全局 shipping-calc-rfbs-v2 依然是 65，未被项目 A 修改
  const globalShipping = await page.evaluate(() => window.__inMemoryPersistStore.get('shipping-calc-rfbs-v2'));
  assert.equal(Number(globalShipping.purchaseCost), 65, 'R1.1: 项目内编辑 95 未污染全局 shipping-calc-rfbs-v2');

  results.snapshots['R1_1_after'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-1-ozon-scenario-saved.png') });

  results.scenarios['R1_1'] = {
    name: '真实 ProjectDetailPage 挂载与 Ozon 单品保存闭环',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'issues_found', // 继承历史采购成本问题仍然存在
    notes: '真实父页面保存闭环生效：自动关闭核算器、场景列表刷新、项目A隔离写入；确认了空白预填继承历史预设65的问题。'
  };
  console.log('  ✅ R1.1 通过: 真实父页面 Ozon 核算器挂载与不可变场景保存闭环验证完成');

  // =========================================================================
  // R1.2: 真实 ProjectDetailPage 挂载与 WB 单订单保存闭环
  // =========================================================================
  console.log('\n--- [R1.2] 真实 ProjectDetailPage 挂载与 WB 单订单保存闭环 ---');
  await setContext('r1_2_parent_wb_save');
  results.snapshots['R1_2_before'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());

  // 点击“使用 WB 核算”
  await page.getByRole('button', { name: '使用 WB 核算' }).click();
  await page.locator('text=WB 核算面板 · 项目 RU-2026-001').waitFor();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-2-wb-calc-embedded.png') });

  // 切换至“单订单核算器” Tab
  await page.getByRole('button', { name: '单订单核算器' }).click();
  await page.locator('text=输入参数').waitFor();

  // 验证未勾选确认前保存按钮为 disabled
  const wbSaveBtn = page.getByRole('button', { name: '保存此方案到项目（不可变成本场景）' });
  assert.equal(await wbSaveBtn.isDisabled(), true, 'R1.2: 未勾选确认前 WB 保存按钮为禁用状态');

  // 填写采购成本并勾选确认
  await page.locator('label:has-text("采购成本") + div input').fill('42');
  await page.locator('label:has-text("已确认采购成本、佣金率与费用假设") input').check();
  assert.equal(await wbSaveBtn.isEnabled(), true, 'R1.2: 勾选确认后 WB 保存按钮为可用状态');

  // 点击保存方案
  await wbSaveBtn.click();
  await page.waitForTimeout(500);

  // 验证核心行为：
  // 1. setWbContext(null) 生效，核算器关闭，返回场景列表
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();
  const isWbCalcClosed = (await page.locator('text=WB 核算面板 · 项目 RU-2026-001').count()) === 0;
  assert.equal(isWbCalcClosed, true, 'R1.2: 保存成功后真实父页调用 setWbContext(null) 关闭核算器');

  // 2. 场景列表中出现 WB 场景（带“仅测算参考”标识）
  const wbCard = page.locator('text=RU-2026-001 WB 订单场景 #2').first();
  await wbCard.waitFor();
  assert.ok((await wbCard.count()) >= 1, 'R1.2: 场景列表成功刷新并显示新建的 WB 场景');

  // 3. 检查 Store：Project A 拥有 2 个场景 (1 Ozon + 1 WB)；Project B 严格为 0
  const r12ScenariosA = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectAId);
  const r12ScenariosB = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectBId);
  assert.equal(r12ScenariosA.length, 2, 'R1.2: Project A 拥有 2 个成本场景');
  assert.equal(r12ScenariosB.length, 0, 'R1.2: Project B 严格为 0 个场景');

  results.snapshots['R1_2_after'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-2-wb-scenario-saved.png') });

  results.scenarios['R1_2'] = {
    name: '真实 ProjectDetailPage 挂载与 WB 单订单保存闭环',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'verified_shared_behavior',
    notes: '真实父页面 WB 核算闭环生效：自动关闭核算器、场景列表正确展示 WB 标识与参考说明、项目 A 隔离写入。'
  };
  console.log('  ✅ R1.2 通过: 真实父页面 WB 核算器挂载与不可变场景保存闭环验证完成');

  // =========================================================================
  // R1.3: 同实例 Props 切换（不变 key） vs 卸载重挂（变 key 路由切换）
  // =========================================================================
  console.log('\n--- [R1.3] 同实例 Props 切换 vs 卸载重挂对比 ---');
  await setContext('r1_3_props_vs_remount');

  // 1.3.1 同实例 props 切换 (useExplicitKey = false):
  // 先将当前实例挂载在固定 key 上，进入 costing Tab
  await page.evaluate((aId) => {
    window.__setHarnessRenderState({
      mode: 'project-detail',
      projectId: aId,
      useExplicitKey: false
    });
  }, projectAId);
  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();

  // 保持相同 key，仅更新 props: projectId 从 A 变为 B
  await page.evaluate((bId) => {
    window.__setHarnessRenderState({
      mode: 'project-detail',
      projectId: bId,
      useExplicitKey: false
    });
  }, projectBId);

  // 验证页面重新读取 Project B 数据
  await page.locator('text=项目B合成商品 (自动烘干箱)').waitFor();
  // 关键观测：由于同一组件实例未卸载，本地 tab state 依然停留在 'costing'！
  const isCostingActiveSameInstance = await page.locator('text=成本场景（不可变快照，只读列表）').isVisible();
  assert.equal(isCostingActiveSameInstance, true, 'R1.3: 同实例 props 切换下，父页面局部 state (tab) 保持在 costing');
  // 场景列表显示 Project B 的空场景状态
  const bEmptyNotice = await page.locator('text=尚无成本场景——点击「使用 Ozon 核算」或「使用 WB 核算」').isVisible();
  assert.equal(bEmptyNotice, true, 'R1.3: Project B 场景列表正确展示为空');

  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-3-same-instance-props-switch-B.png') });

  // 1.3.2 路由导航/卸载重挂 (useExplicitKey = true):
  // 切回 Project A，并改变 key 模拟真实路由切换
  await page.evaluate((aId) => {
    window.__setHarnessRenderState({
      mode: 'project-detail',
      projectId: aId,
      useExplicitKey: true
    });
  }, projectAId);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  // 关键观测：卸载重挂后，ProjectDetailPage 局部 state 完全重置，默认回到 'overview' (概览) Tab！
  const isOverviewActiveRemount = await page.locator('text=阶段推进（Gate 仅建议）').isVisible();
  assert.equal(isOverviewActiveRemount, true, 'R1.3: 路由卸载重挂下，组件状态完全初始化，默认显示概览 Tab');

  results.scenarios['R1_3'] = {
    name: '同实例 Props 切换 vs 卸载重挂对比',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'verified_shared_behavior',
    notes: '明确区分了两种路径：同实例 props 切换保留局部 tab/context 状态，而真实路由跳转因 key 改变重置为概览 tab。'
  };
  console.log('  ✅ R1.3 通过: 同实例 props 切换与卸载重挂路径行为差异记录明确');

  // =========================================================================
  // R2: 真实 WB 控件操作与缺失动作评估 (Real WB UI Interactions)
  // =========================================================================
  console.log('\n--- [R2] 真实 WB 控件操作与缺失动作评估 ---');
  await setContext('r2_real_wb_controls');

  // 挂载独立 WBCalc
  await page.evaluate(() => {
    window.__setHarnessRenderState({ mode: 'wb-standalone' });
  });
  await page.getByRole('heading', { name: 'WB跨境利润与物流费用核算' }).waitFor();

  // 2.1 真实控件：CalculatorTab "保存为SKU模板" (真实 UI 按钮)
  await page.getByRole('button', { name: '单订单核算器' }).click();
  await page.locator('text=输入参数').waitFor();
  await page.locator('input[list="wb-product-list"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('input[list="wb-product-list"]').fill('合成WB测算商品A');
  await page.locator('label:has-text("含包装重量") + div input').fill('380');

  const r2BeforeSkuWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-skus-v1').length);
  await page.getByRole('button', { name: '保存为SKU模板' }).click();
  await page.waitForTimeout(300);
  const r2AfterSkuWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-skus-v1').length);
  assert.ok(r2AfterSkuWrites > r2BeforeSkuWrites, 'R2.1: 真实点击「保存为SKU模板」按钮触发写入 wb-skus-v1');

  // 2.2 真实控件：TariffTab "重置默认" (真实 UI 按钮)
  await page.getByRole('button', { name: '费率管理' }).click();
  await page.getByRole('heading', { name: /当前费率/ }).waitFor();
  const r2BeforeTariffWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-tariffs-v1').length);
  await page.getByRole('button', { name: '重置默认' }).click();
  await page.waitForTimeout(300);
  const r2AfterTariffWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-tariffs-v1').length);
  assert.ok(r2AfterTariffWrites > r2BeforeTariffWrites, 'R2.2: 真实点击「重置默认」按钮触发写入 wb-tariffs-v1');

  // 2.3 真实控件：OrdersTab 真实 CSV 文件导入与订单删除 (真实 UI 操作)
  await page.getByRole('button', { name: '订单与对账' }).click();
  await page.locator('text=暂无订单').waitFor();

  // 构造纯合成 CSV 字符串并通过 fileChooser 真实导入
  const syntheticCsv = [
    'order_id,sku_id,route_id,seller_revenue_base_rub,estimated_logistics_cny,status',
    'SYNTH-ORD-1001,SKU-TEST-A,DPX-SZ-382822,1850,28.5,已签收'
  ].join('\n');

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('label:has-text("导入订单CSV")').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'synthetic_orders.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(syntheticCsv, 'utf8')
  });
  await page.waitForTimeout(500);

  // 验证订单已展示在列表中
  await page.locator('text=SYNTH-ORD-1001').waitFor();
  const r2OrdersWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-orders-v1'));
  assert.ok(r2OrdersWrites.length >= 1, 'R2.3: 真实 CSV 导入动作触发写入 wb-orders-v1');

  // 测试订单删除按钮
  const trashBtn = page.locator('table tbody tr button').first();
  await trashBtn.click();
  await page.waitForTimeout(300);
  const r2PostDeleteOrders = await page.evaluate(() => window.__inMemoryPersistStore.get('wb-orders-v1') || []);
  assert.equal(r2PostDeleteOrders.length, 0, 'R2.3: 真实删除订单动作更新 wb-orders-v1 为空');

  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r2-wb-orders-real-import.png') });

  // 2.4 缺失动作评估：wb-settings-v1 主动修改
  // 经源码核验：WBCalc.jsx:68 声明了 saveSettings，但未传递给任何子 Tab，界面上无任何 settings 编辑表单。
  // 按照 REVISION-001 要求，如实标记 not_applicable，绝不伪造用户写入！
  results.scenarios['R2'] = {
    name: '真实 WB 控件操作与缺失动作评估',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'verified_shared_behavior',
    sub_items: {
      sku_template_button: 'verified_real_ui_click',
      tariff_reset_button: 'verified_real_ui_click',
      orders_csv_import_and_delete: 'verified_real_file_import',
      settings_user_active_edit: {
        status: 'not_applicable',
        reason: 'WBCalc.jsx:68 声明了 saveSettings 但未传给任何 Tab；界面无输入表单；所有 settings 写入均由挂载迁移或汇率 Hook 自动触发。'
      }
    }
  };
  console.log('  ✅ R2 通过: 真实 WB SKU/费率/订单控件交互验证完成；确认设置表单 not_applicable');

  // =========================================================================
  // R3: 保存失败与错误提示深度验证 (Error Handling & Visibility)
  // =========================================================================
  console.log('\n--- [R3] 保存失败与错误提示可见性验证 ---');
  await setContext('r3_error_handling_and_visibility');

  // 3.1 独立核算 persistSet 抛错
  await page.evaluate(() => {
    window.__simulatePersistSetError = {
      key: 'shipping-calc-rfbs-v2',
      error: new Error('QuotaExceededError: Synthetic storage quota exceeded')
    };
    window.__setHarnessRenderState({ mode: 'ozon-standalone' });
  });
  await page.getByRole('heading', { name: 'Ozon 跨境核算面板' }).waitFor();
  await page.locator('label:has-text("采购成本") + div input').fill('88');

  // 验证输入保持在 React 本地状态中
  const r3RetainedCost = await page.locator('label:has-text("采购成本") + div input').inputValue();
  assert.equal(r3RetainedCost, '88', 'R3.1: persistSet 抛错时输入框内容 88 完整保留');

  // 验证错误被 pageerror 捕获
  const hasQuotaError = observedPageErrors.some(e => e.message.includes('QuotaExceededError'));
  assert.equal(hasQuotaError, true, 'R3.1: pageerror 捕获到底层 QuotaExceededError');

  // 清除模拟错误
  await page.evaluate(() => { window.__simulatePersistSetError = null; });

  // 3.2 真实父页面场景保存抛错 (T6_BACKEND_LOCKED)
  await page.evaluate((id) => {
    window.__simulateScenarioSaveError = new Error('T6_BACKEND_LOCKED: Synthetic backend lock failure');
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id });
  }, projectAId);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.getByRole('button', { name: '使用 Ozon 核算' }).click();
  await page.locator('text=Ozon 核算面板 · 项目 RU-2026-001').waitFor();

  await page.locator('label:has-text("采购成本") + div input').fill('115');
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();

  // 点击保存时，父页面 saveOzonScenario 的 catch (e) 捕获错误并调用 refresh(e.message)
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);

  // 验证关键业务现象：
  // 1. setOzonContext(null) 未被调用，核算器保持打开！
  const isCalcStillOpen = (await page.locator('text=Ozon 核算面板 · 项目 RU-2026-001').count()) > 0;
  assert.equal(isCalcStillOpen, true, 'R3.2: 场景保存失败后核算器未被意外关闭');

  // 2. 输入框值 115 完整保留！
  const r3CostAfterError = await page.locator('label:has-text("采购成本") + div input').inputValue();
  assert.equal(r3CostAfterError, '115', 'R3.2: 场景保存失败后采购成本输入 115 完整保留');

  // 3. 关键 UI 可见性缺陷发现：
  // ProjectDetailPage.jsx:417 中 notice 仅在 tab === 'overview' 下渲染；
  // 当前处于 tab === 'costing'，因此页面上没有显示错误提示！
  const isErrorNoticeVisibleInCosting = await page.locator('text=T6_BACKEND_LOCKED').isVisible();
  assert.equal(isErrorNoticeVisibleInCosting, false, 'R3.2 确认真实缺陷：costing Tab 下未渲染 notice，错误信息对用户不可见！');

  // 切到概览 Tab，notice 赫然出现
  await page.getByRole('button', { name: '概览' }).click();
  const isErrorNoticeVisibleInOverview = await page.locator('text=T6_BACKEND_LOCKED: Synthetic backend lock failure').isVisible();
  assert.equal(isErrorNoticeVisibleInOverview, true, 'R3.2: 错误信息被 refresh() 存入 notice，仅在概览 Tab 显示');

  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r3-save-error-notice-in-overview.png') });

  // 清除模拟错误，切回 costing，重新确认并点击保存应成功恢复
  await page.evaluate(() => { window.__simulateScenarioSaveError = null; });
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.locator('text=Ozon 核算面板 · 项目 RU-2026-001').waitFor();
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();

  results.scenarios['R3'] = {
    name: '保存失败与错误提示深度验证',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'issues_found',
    notes: '确认关键缺陷：保存失败时输入完好保留且未虚假关闭，但 ProjectDetailPage:417 的 notice 仅在 overview Tab 渲染，costing Tab 下用户无法直接看到失败原因。'
  };
  console.log('  ✅ R3 通过: 异常捕获、输入保留与错误提示不可见性缺陷精确记录完成');

  // =========================================================================
  // R4: 跨项目隔离与故障注入敏感度验证 (Cross-Project Isolation & Fault Injection)
  // =========================================================================
  console.log('\n--- [R4] 跨项目隔离与故障注入敏感度验证 ---');
  await setContext('r4_cross_project_isolation');

  // 重新初始化纯净的合成项目 A 与 B
  const { projectAId: r4ProjA, projectBId: r4ProjB } = await page.evaluate(() => window.__harnessMethods.setupSyntheticProjects());

  // 设置故障注入标志（由外部环境变量控制）
  await page.evaluate((inject) => {
    window.__injectCrossProjectCorruption = inject;
  }, isFaultInjection);

  // 挂载 Project A 详情页
  await page.evaluate((id) => {
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id });
  }, r4ProjA);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.getByRole('button', { name: '使用 Ozon 核算' }).click();
  await page.locator('text=/Ozon 核算面板 · 项目/').first().waitFor();

  await page.locator('label:has-text("采购成本") + div input').fill('55');
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);

  // 验证 Project A 成功生成 1 个场景
  const r4ScenariosA = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), r4ProjA);
  assert.equal(r4ScenariosA.length, 1, 'R4: Project A 应成功保存 1 个场景');

  // 核心比较断言：Project B 场景数必须为 0！
  // 正常模式下 scenariosB.length === 0，断言通过；
  // 故障注入模式下 scenariosB.length === 1，此真实比较断言捕获串写并引发 AssertionError (1 !== 0)！
  const r4ScenariosB = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), r4ProjB);
  assert.equal(
    r4ScenariosB.length,
    0,
    `R4: Project B 场景数严格为 0，严禁跨项目串写污染 (实测检测到 ${r4ScenariosB.length} 个污染场景: ${r4ScenariosB.map(s => s.name).join(', ')})`
  );

  results.scenarios['R4'] = {
    name: '跨项目隔离与故障注入敏感度验证',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'verified_shared_behavior',
    notes: '正常模式下 Project A 保存场景严格不污染 Project B (场景数=0)；比较断言对跨项目串写具备真实验收敏感度。'
  };
  console.log('  ✅ R4 通过: 跨项目隔离比较断言验证通过');

  results.execution_status = 'completed';
  results.assertions_status = 'passed';
  results.business_verdict = 'issues_found'; // 准确反映存在历史采购价回退与草稿丢失、错误提示不可见等真实业务问题
  results.passed = true;

} catch (err) {
  console.error('\n❌ 测试执行或断言失败:', err.message);
  const isExpectedFaultCaught = isFaultInjection && (
    err.message.includes('Project B 场景数严格为 0') ||
    err.message.includes('1 !== 0')
  );
  results.execution_status = isExpectedFaultCaught ? 'completed' : 'failed';
  results.assertions_status = 'failed';
  results.business_verdict = isExpectedFaultCaught ? 'fault_injection_caught' : 'error_caught';
  results.error = err.message;
  results.passed = false;
} finally {
  let persistCallTrace = [];
  try {
    if (browser && browser.isConnected() && !page.isClosed()) {
      persistCallTrace = await page.evaluate(() => window.__persistCallTrace || []);
    }
  } catch (e) {
    // ignore
  }
  await browser.close();

  // 写入运行结果与快照
  await fs.writeFile(
    path.join(EVIDENCE_DIR, 'costing-isolation-results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  // 导出 observed-page-errors.json
  await fs.writeFile(
    path.join(EVIDENCE_DIR, 'observed-page-errors.json'),
    JSON.stringify(observedPageErrors, null, 2),
    'utf8'
  );

  // 导出完整读写轨迹日志 (含 T6 实体键与全局持久化键)
  await fs.writeFile(
    path.join(EVIDENCE_DIR, 'persist-call-trace.json'),
    JSON.stringify(persistCallTrace, null, 2),
    'utf8'
  );
}
console.log('\n--- 测试执行完毕 ---');
console.log(`  结果输出目录: ${EVIDENCE_DIR}`);
console.log(`  执行状态: ${results.execution_status}`);
console.log(`  断言状态: ${results.assertions_status}`);
console.log(`  业务结论: ${results.business_verdict}`);
console.log(`  总体通过: ${results.passed ? 'YES (0)' : 'NO (1)'}`);

if (!results.passed) {
  process.exit(1);
} else {
  process.exit(0);
}
