/**
 * docs/ai-handoff/KJ-GEMINI-20260921-006/run-revision-002-costing-tests.mjs
 * 
 * KJ-GEMINI-20260921-006 Revision 002: 证据缺口最终闭合套件
 * 
 * 依据 REVISION-002.md 与 REVIEW-REVISION-001.md 闭合以下 4 个边界：
 * 1. 保存失败后重试载荷对比（原地未切页重试 115 成功保存 vs 切概览再返回重试回退 65 保存实测）；
 * 2. 开放核算器状态下的同实例 Props 切换探针（实测 B 继承 A 售价与重量的组件缺陷，并澄清生产 App 导航路径）；
 * 3. 真实 ProjectDetailPage 项目模式下的 WB 控件交互（SKU/费率重置/订单CSV导入与删除，断言 B 实体不变，T6 失败写 trace 记录）；
 * 4. 严谨异常上报与分类（控制台 duplicate-key 警告分类统计，精准故障注入断言捕获）。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const isFaultInjection = process.env.TEST_INJECT_CROSS_PROJECT_CORRUPTION === '1';
const modeName = isFaultInjection ? 'revision-002-fault' : 'revision-002-normal';

console.log(`===== KJ-GEMINI-20260921-006 Revision 002 Test Suite [Mode: ${modeName}] =====\n`);

const ROOT = path.resolve('.');
const TASK_DIR = path.join(ROOT, 'docs/ai-handoff/KJ-GEMINI-20260921-006');
const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence', modeName);
await fs.mkdir(EVIDENCE_DIR, { recursive: true });

// 路径与依赖检测（优先从 CODEX_NODE_MODULES，回退从 USERPROFILE 解析，绝不写死机器用户名）
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

// 构建 Esbuild 隔离替身插件
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
    sourcefile: 'costing-revision-002-bundle.jsx',
    contents: `
      import React, { useState, useEffect } from 'react';
      import { createRoot } from 'react-dom/client';
      import OzonCalc from './src/components/OzonCalc.jsx';
      import WBCalc from './src/components/WBCalc.jsx';
      import ProjectDetailPage from './src/components/t6/ProjectDetailPage.jsx';
      import * as store from './src/utils/t6/t6Store.js';
      import { buildOzonPrefill, buildWbPrefill } from './src/utils/t6/costScenarioAdapter.js';

      // 注册 T6 Store 适配器，将实体读写重定向到 inMemoryPersistStore 并记录完整 trace
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
            // 完整记录保存失败尝试与载荷
            window.__persistCallTrace.push({
              seq: window.__persistCallTrace.length + 1,
              time: Date.now(),
              action: 't6_set_error',
              key: k,
              context: window.__currentContext || 'unknown',
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
            context: window.__currentContext || 'unknown',
            prev,
            value: cloned
          });

          // 故障注入钩子：保存 Project A 的场景时，若开启故障注入，向 Project B 注入一个污染场景
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
        },

        getScopedEntitySnapshot: (entityPrefix) => {
          const out = {};
          for (const [k, v] of window.__inMemoryPersistStore.entries()) {
            if (k.startsWith(entityPrefix)) {
              out[k] = JSON.parse(JSON.stringify(v));
            }
          }
          return out;
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

// 启动 Headless Chrome 并执行测试
console.log('\n--- STEP 3: 启动无头 Chrome 执行 Revision 002 补验套件 ---');

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const observedPageErrors = [];
const observedConsoleMessages = [];
const classifiedWarnings = {
  wbRouteSelectDuplicateKeys: 0,
  otherWarnings: []
};

page.on('pageerror', (err) => {
  observedPageErrors.push({
    name: err.name,
    message: err.message,
    context: windowCurrentContext,
    time: Date.now()
  });
  console.log(`  [PAGE_ERROR] [${windowCurrentContext}] ${err.name}: ${err.message}`);
});

page.on('console', (msg) => {
  const text = msg.text();
  const type = msg.type();
  observedConsoleMessages.push({ type, text, context: windowCurrentContext, time: Date.now() });

  if (type === 'warning' || (type === 'error' && text.includes('Warning: Encountered two children with the same key'))) {
    if (text.includes('Encountered two children with the same key')) {
      classifiedWarnings.wbRouteSelectDuplicateKeys++;
    } else {
      classifiedWarnings.otherWarnings.push({ text, context: windowCurrentContext });
    }
  } else if (type === 'error') {
    console.log(`  [BROWSER_CONSOLE_ERR] [${windowCurrentContext}] ${text}`);
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

// 拦截外部网络请求
const wbCommissionJson = await fs.readFile(path.join(appDir, 'public/data/wb_commission.json'), 'utf8');
await page.route('**/*', (route) => route.abort());

await page.setContent(`
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Costing Revision 002 Test Harness</title>
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
  revision: 2,
  mode: modeName,
  timestamp: new Date().toISOString(),
  execution_status: 'running',
  assertions_status: 'pending',
  business_verdict: 'pending',
  scenarios: {},
  snapshots: {},
  classified_warnings: classifiedWarnings,
  passed: false,
  error: null
};

try {
  // =========================================================================
  // R1.1: 真实 ProjectDetailPage 挂载与 Ozon 单品保存闭环
  // =========================================================================
  console.log('\n--- [R1.1] 真实 ProjectDetailPage 挂载与 Ozon 单品保存闭环 ---');
  await setContext('r1_1_parent_ozon_save');

  // 写入独立单品历史预设 (purchaseCost: 65)
  await page.evaluate(() => {
    window.__inMemoryPersistStore.set('shipping-calc-rfbs-v2', {
      price: 5200, weight: 1.55, length: 52, width: 45, height: 28,
      purchaseCost: '65', domesticShipping: 3, labelingFee: 2,
      commission: 12, adRate: 10, paymentFee: 1, agencyFee: 2, returnLoss: 4
    });
  });

  results.snapshots['R1_1_before'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());

  await page.evaluate((id) => {
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id });
  }, projectAId);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();
  await page.getByRole('button', { name: '使用 Ozon 核算' }).click();

  await page.locator('text=/Ozon 核算面板 · 项目/').first().waitFor();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-1-ozon-calc-embedded.png') });

  const r1Price = await page.locator('label:has-text("售价") + div input').inputValue();
  const r1Weight = await page.locator('label:has-text("实重") + div input').inputValue();
  assert.equal(r1Price, '2800', 'R1.1: 售价应来自候选快照 2800');
  assert.equal(r1Weight, '0.35', 'R1.1: 重量应来自候选快照 0.35');

  const r1Cost = await page.locator('label:has-text("采购成本") + div input').inputValue();
  assert.equal(r1Cost, '65', 'R1.1: 空白采购成本回退继承了历史独立预设 65');

  await page.locator('label:has-text("采购成本") + div input').fill('95');

  const saveBtn = page.getByRole('button', { name: '保存此方案到项目' });
  assert.equal(await saveBtn.isDisabled(), true, 'R1.1: 未勾选人工确认前保存按钮处于禁用状态');

  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
  assert.equal(await saveBtn.isEnabled(), true, 'R1.1: 勾选人工确认后保存按钮变为可用状态');

  await saveBtn.click();
  await page.waitForTimeout(500);

  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();
  const isOzonCalcClosed = (await page.locator('text=/Ozon 核算面板 · 项目/').count()) === 0;
  assert.equal(isOzonCalcClosed, true, 'R1.1: 保存成功后真实父页调用 setOzonContext(null) 关闭核算器');

  const scenarioCard = page.locator('text=/Ozon rFBS 场景 #1/').first();
  await scenarioCard.waitFor();

  const r1ScenariosA = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectAId);
  const r1ScenariosB = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectBId);
  assert.equal(r1ScenariosA.length, 1, 'R1.1: Project A 在 Store 中有且仅有 1 个场景');
  assert.equal(r1ScenariosB.length, 0, 'R1.1: Project B 在 Store 中严格为 0 个场景');
  assert.equal(r1ScenariosA[0].inputPayload.purchaseCost, 95, 'R1.1: Project A 场景内采购成本为 95');

  const globalShipping = await page.evaluate(() => window.__inMemoryPersistStore.get('shipping-calc-rfbs-v2'));
  assert.equal(Number(globalShipping.purchaseCost), 65, 'R1.1: 项目内编辑 95 未污染全局 shipping-calc-rfbs-v2');

  results.snapshots['R1_1_after'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-1-ozon-scenario-saved.png') });

  results.scenarios['R1_1'] = {
    name: '真实 ProjectDetailPage 挂载与 Ozon 单品保存闭环',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'issues_found',
    notes: '真实父页面保存闭环生效：核算器自动关闭、场景列表刷新、目标项目A隔离写入；确认了空白预填继承历史预设65的问题。'
  };
  console.log('  ✅ R1.1 通过: 真实父页面 Ozon 核算器挂载与不可变场景保存闭环验证完成');

  // =========================================================================
  // R1.2: 真实 ProjectDetailPage 挂载与 WB 单订单保存闭环
  // =========================================================================
  console.log('\n--- [R1.2] 真实 ProjectDetailPage 挂载与 WB 单订单保存闭环 ---');
  await setContext('r1_2_parent_wb_save');
  results.snapshots['R1_2_before'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());

  await page.getByRole('button', { name: '使用 WB 核算' }).click();
  await page.locator('text=/WB 核算面板 · 项目/').first().waitFor();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-2-wb-calc-embedded.png') });

  await page.getByRole('button', { name: '单订单核算器' }).click();
  await page.locator('text=输入参数').waitFor();

  const wbSaveBtn = page.getByRole('button', { name: '保存此方案到项目（不可变成本场景）' });
  assert.equal(await wbSaveBtn.isDisabled(), true, 'R1.2: 未勾选确认前 WB 保存按钮为禁用状态');

  await page.locator('label:has-text("采购成本") + div input').fill('42');
  await page.locator('label:has-text("已确认采购成本、佣金率与费用假设") input').check();
  assert.equal(await wbSaveBtn.isEnabled(), true, 'R1.2: 勾选确认后 WB 保存按钮为可用状态');

  await wbSaveBtn.click();
  await page.waitForTimeout(500);

  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();
  const isWbCalcClosed = (await page.locator('text=/WB 核算面板 · 项目/').count()) === 0;
  assert.equal(isWbCalcClosed, true, 'R1.2: 保存成功后真实父页调用 setWbContext(null) 关闭核算器');

  const wbCard = page.locator('text=/WB 订单场景 #2/').first();
  await wbCard.waitFor();

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
    notes: '真实父页面 WB 核算闭环生效：核算器自动关闭、场景列表展示 WB 标识与参考说明、项目 A 隔离写入。'
  };
  console.log('  ✅ R1.2 通过: 真实父页面 WB 核算器挂载与不可变场景保存闭环验证完成');

  // =========================================================================
  // R1.3: 真实导航（列表重挂）与合成同实例 Props 切换（关核算器时）
  // =========================================================================
  console.log('\n--- [R1.3] 真实导航卸载重挂 vs 闭合状态同实例 Props 切换 ---');
  await setContext('r1_3_props_vs_remount');

  // 1.3.1 合成同实例 props 切换（useExplicitKey = false）在无核算器打开状态下
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

  await page.evaluate((bId) => {
    window.__setHarnessRenderState({
      mode: 'project-detail',
      projectId: bId,
      useExplicitKey: false
    });
  }, projectBId);

  await page.locator('text=项目B合成商品 (自动烘干箱)').waitFor();
  const isCostingActiveSameInstance = await page.locator('text=成本场景（不可变快照，只读列表）').isVisible();
  assert.equal(isCostingActiveSameInstance, true, 'R1.3: 同实例 props 切换下，父页面局部 tab state 保持在 costing');
  const bEmptyNotice = await page.locator('text=尚无成本场景——点击「使用 Ozon 核算」或「使用 WB 核算」').isVisible();
  assert.equal(bEmptyNotice, true, 'R1.3: Project B 场景列表正确展示为空');

  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r1-3-same-instance-props-switch-B.png') });

  // 1.3.2 真实路由导航（卸载重挂）：App.jsx:306 不带 key，经由 ProjectListPage 发生 unmount/remount
  await page.evaluate((aId) => {
    window.__setHarnessRenderState({
      mode: 'project-detail',
      projectId: aId,
      useExplicitKey: true
    });
  }, projectAId);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  const isOverviewActiveRemount = await page.locator('text=阶段推进（Gate 仅建议）').isVisible();
  assert.equal(isOverviewActiveRemount, true, 'R1.3: 真实路由卸载重挂下，组件状态完全初始化，默认显示概览 Tab');

  results.scenarios['R1_3'] = {
    name: '真实导航卸载重挂 vs 闭合状态同实例 Props 切换',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'verified_shared_behavior',
    notes: '确认：真实生产导航（App.jsx）通过列表卸载重挂，默认回到概览 Tab；同实例 props 切换属于合成探针，其保持 costing Tab。'
  };
  console.log('  ✅ R1.3 通过: 导航生命周期与 props 切换路径行为记录明确');

  // =========================================================================
  // R2: 真实 WB 控件操作（独立模式 + 真实 ProjectDetailPage 项目模式双覆盖）
  // =========================================================================
  console.log('\n--- [R2] 真实 WB 控件操作（独立模式 + 真实项目模式双覆盖） ---');
  await setContext('r2_real_wb_controls');

  // 2.1 独立模式 WB 操作
  await page.evaluate(() => {
    window.__setHarnessRenderState({ mode: 'wb-standalone' });
  });
  await page.getByRole('heading', { name: 'WB跨境利润与物流费用核算' }).waitFor();

  // 2.1.1 独立模式保存 SKU 模板
  await page.getByRole('button', { name: '单订单核算器' }).click();
  await page.locator('text=输入参数').waitFor();
  await page.locator('input[list="wb-product-list"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('input[list="wb-product-list"]').fill('合成WB测算商品_独立');
  await page.locator('label:has-text("含包装重量") + div input').fill('380');

  const r2BeforeSkuWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-skus-v1').length);
  await page.getByRole('button', { name: '保存为SKU模板' }).click();
  await page.waitForTimeout(300);
  const r2AfterSkuWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-skus-v1').length);
  assert.ok(r2AfterSkuWrites > r2BeforeSkuWrites, 'R2.1: 独立模式点击「保存为SKU模板」触发写入 wb-skus-v1');

  // 2.1.2 独立模式重置费率
  await page.getByRole('button', { name: '费率管理' }).click();
  await page.getByRole('heading', { name: /当前费率/ }).waitFor();
  const r2BeforeTariffWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-tariffs-v1').length);
  await page.getByRole('button', { name: '重置默认' }).click();
  await page.waitForTimeout(300);
  const r2AfterTariffWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-tariffs-v1').length);
  assert.ok(r2AfterTariffWrites > r2BeforeTariffWrites, 'R2.1: 独立模式点击「重置默认」触发写入 wb-tariffs-v1');

  // 2.1.3 独立模式 CSV 导入与删除
  await page.getByRole('button', { name: '订单与对账' }).click();
  await page.locator('text=暂无订单').waitFor();

  const syntheticCsv = [
    'order_id,sku_id,route_id,seller_revenue_base_rub,estimated_logistics_cny,status',
    'SYNTH-ORD-STANDALONE-101,SKU-TEST-A,DPX-SZ-382822,1850,28.5,已签收'
  ].join('\n');

  const fileChooserPromise1 = page.waitForEvent('filechooser');
  await page.locator('label:has-text("导入订单CSV")').click();
  const fileChooser1 = await fileChooserPromise1;
  await fileChooser1.setFiles({
    name: 'synthetic_orders.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(syntheticCsv, 'utf8')
  });
  await page.waitForTimeout(500);

  await page.locator('text=SYNTH-ORD-STANDALONE-101').waitFor();
  const trashBtn1 = page.locator('table tbody tr button').first();
  await trashBtn1.click();
  await page.waitForTimeout(300);
  const postDeleteOrders1 = await page.evaluate(() => window.__inMemoryPersistStore.get('wb-orders-v1') || []);
  assert.equal(postDeleteOrders1.length, 0, 'R2.1: 独立模式删除订单更新 wb-orders-v1 为空');

  // 2.2 真实 ProjectDetailPage 项目模式下的 WB 控件操作 (Deliverable 3)
  console.log('  -> 正在执行真实 ProjectDetailPage 项目模式下的 WB 控件操作...');
  await setContext('r2_project_mode_wb_controls');
  results.snapshots['R2_project_wb_before'] = await page.evaluate(() => ({
    store: window.__harnessMethods.getStoreSnapshot(),
    scenariosA: window.__t6Store.getProjectScenarios(window.__syntheticProjectIds.A),
    scenariosB: window.__t6Store.getProjectScenarios(window.__syntheticProjectIds.B)
  }));

  await page.evaluate((id) => {
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id, useExplicitKey: true });
  }, projectAId);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.getByRole('button', { name: '使用 WB 核算' }).click();
  await page.locator('text=/WB 核算面板 · 项目/').first().waitFor();

  // 2.2.1 项目模式下点击“保存为SKU模板”
  await page.getByRole('button', { name: '单订单核算器' }).click();
  await page.locator('text=输入参数').waitFor();
  await page.locator('input[list="wb-product-list"]').fill('合成WB测算商品_项目模式');
  await page.locator('label:has-text("含包装重量") + div input').fill('520');

  const r2ProjBeforeSkuWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-skus-v1').length);
  await page.getByRole('button', { name: '保存为SKU模板' }).click();
  await page.waitForTimeout(300);
  const r2ProjAfterSkuWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-skus-v1').length);
  assert.ok(r2ProjAfterSkuWrites > r2ProjBeforeSkuWrites, 'R2.2: 项目模式内点击「保存为SKU模板」写入全局 wb-skus-v1');

  // 2.2.2 项目模式下导入订单 CSV 并删除
  await page.getByRole('button', { name: '订单与对账' }).click();
  await page.locator('text=暂无订单').waitFor();

  const syntheticProjCsv = [
    'order_id,sku_id,route_id,seller_revenue_base_rub,estimated_logistics_cny,status',
    'SYNTH-ORD-PROJECT-202,SKU-PROJ-A,DPX-SZ-382822,2600,35.0,已签收'
  ].join('\n');

  const fileChooserPromise2 = page.waitForEvent('filechooser');
  await page.locator('label:has-text("导入订单CSV")').click();
  const fileChooser2 = await fileChooserPromise2;
  await fileChooser2.setFiles({
    name: 'synthetic_project_orders.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(syntheticProjCsv, 'utf8')
  });
  await page.waitForTimeout(500);

  await page.locator('text=SYNTH-ORD-PROJECT-202').waitFor();
  const r2ProjOrdersWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-orders-v1'));
  assert.ok(r2ProjOrdersWrites.length >= 1, 'R2.2: 项目模式内导入订单 CSV 触发写入全局 wb-orders-v1');

  const trashBtn2 = page.locator('table tbody tr button').first();
  await trashBtn2.click();
  await page.waitForTimeout(300);
  const postDeleteOrders2 = await page.evaluate(() => window.__inMemoryPersistStore.get('wb-orders-v1') || []);
  assert.equal(postDeleteOrders2.length, 0, 'R2.2: 项目模式内删除订单更新全局 wb-orders-v1 为空');

  // 2.2.3 项目模式下重置费率
  await page.getByRole('button', { name: '费率管理' }).click();
  await page.getByRole('heading', { name: /当前费率/ }).waitFor();
  const r2ProjBeforeTariffWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-tariffs-v1').length);
  await page.getByRole('button', { name: '重置默认' }).click();
  await page.waitForTimeout(300);
  const r2ProjAfterTariffWrites = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 'set' && t.key === 'wb-tariffs-v1').length);
  assert.ok(r2ProjAfterTariffWrites > r2ProjBeforeTariffWrites, 'R2.2: 项目模式内点击「重置默认」写入全局 wb-tariffs-v1');

  // 2.2.4 关键断言：Project B 的实体与场景数量保持严格不变 (0 个场景)
  const r2PostScenariosB = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectBId);
  assert.equal(r2PostScenariosB.length, 0, 'R2.2: 项目模式下操作 WB 共享控件，Project B 场景严格保持为 0，零数据污染');

  results.snapshots['R2_project_wb_after'] = await page.evaluate(() => ({
    store: window.__harnessMethods.getStoreSnapshot(),
    scenariosA: window.__t6Store.getProjectScenarios(window.__syntheticProjectIds.A),
    scenariosB: window.__t6Store.getProjectScenarios(window.__syntheticProjectIds.B)
  }));

  // 2.3 缺失动作评估：wb-settings-v1 主动修改表单控件
  // 经源码核验：WBCalc.jsx:68 声明了 saveSettings，但未传递给任何子 Tab，界面上无任何 settings 编辑表单。
  results.scenarios['R2'] = {
    name: '真实 WB 控件操作（独立模式 + 真实项目模式双覆盖）',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'verified_shared_behavior',
    sub_items: {
      standalone_sku_save: 'verified_real_ui_click',
      standalone_tariff_reset: 'verified_real_ui_click',
      standalone_orders_csv_and_delete: 'verified_real_file_import',
      project_mode_sku_save: 'verified_real_ui_click',
      project_mode_tariff_reset: 'verified_real_ui_click',
      project_mode_orders_csv_and_delete: 'verified_real_file_import',
      project_b_unaffected: 'verified_0_scenarios_in_b',
      settings_user_active_edit: {
        status: 'not_applicable',
        reason: 'WBCalc.jsx:68 声明了 saveSettings 但未传给任何 Tab；界面无输入表单；所有 settings 写入均由挂载迁移或汇率 Hook 自动触发。'
      }
    }
  };
  console.log('  ✅ R2 通过: 独立模式与真实项目模式下 WB 控件操作全量通过；Project B 零污染');

  // =========================================================================
  // R3: 异常捕获与双重试路径载荷对比 (Deliverable 1)
  // =========================================================================
  console.log('\n--- [R3] 异常捕获与双重试路径载荷对比 (原地重试 vs 切页重试) ---');
  await setContext('r3_error_handling_and_retry_comparison');

  // 3.1 独立核算 persistSet 抛错与恢复
  await page.evaluate(() => {
    window.__simulatePersistSetError = {
      key: 'shipping-calc-rfbs-v2',
      error: new Error('QuotaExceededError: Synthetic storage quota exceeded')
    };
    window.__setHarnessRenderState({ mode: 'ozon-standalone' });
  });
  await page.getByRole('heading', { name: 'Ozon 跨境核算面板' }).waitFor();
  await page.locator('label:has-text("采购成本") + div input').fill('88');

  const r3RetainedCost = await page.locator('label:has-text("采购成本") + div input').inputValue();
  assert.equal(r3RetainedCost, '88', 'R3.1: persistSet 抛错时输入框内容 88 完整保留');

  const hasQuotaError = observedPageErrors.some(e => e.message.includes('QuotaExceededError'));
  assert.equal(hasQuotaError, true, 'R3.1: 底层抛错被 pageerror 捕获，未在界面提供降级提示（确认非平滑提示缺陷）');

  // 清除模拟错误，验证恢复后写正常
  await page.evaluate(() => { window.__simulatePersistSetError = null; });
  await page.locator('label:has-text("采购成本") + div input').fill('89');
  await page.waitForTimeout(300);
  const recoveredPersistVal = await page.evaluate(() => window.__inMemoryPersistStore.get('shipping-calc-rfbs-v2'));
  assert.equal(recoveredPersistVal.purchaseCost, '89', 'R3.1: 解除错误后后续写入顺利持久化');

  // 将 shipping-calc-rfbs-v2 的采购成本恢复为初始历史预设 65，确保 R3.2 切页回退测试不受 R3.1 恢复写数值干扰
  await page.evaluate(() => {
    const prev = window.__inMemoryPersistStore.get('shipping-calc-rfbs-v2') || {};
    prev.purchaseCost = '65';
    window.__inMemoryPersistStore.set('shipping-calc-rfbs-v2', prev);
  });

  // 3.2 真实父页面场景保存抛错与双重试对比
  console.log('  -> 正在执行真实父页面场景保存失败与双重试对比...');

  // 挂载 Project A 详情页
  await page.evaluate((id) => {
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id, useExplicitKey: true });
  }, projectAId);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.getByRole('button', { name: '使用 Ozon 核算' }).click();
  await page.locator('text=/Ozon 核算面板 · 项目/').first().waitFor();

  // 填入自定义采购成本 115 并勾选确认
  await page.locator('label:has-text("采购成本") + div input').fill('115');
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();

  // 注入 T6 保存失败异常
  await page.evaluate(() => {
    window.__simulateScenarioSaveError = new Error('T6_BACKEND_LOCKED: Synthetic backend lock failure');
  });

  results.snapshots['R3_before_failure'] = await page.evaluate((id) => ({
    scenariosA: window.__t6Store.getProjectScenarios(id),
    scenariosB: window.__t6Store.getProjectScenarios(window.__syntheticProjectIds.B),
    logs: window.__t6Store.getProject(id).decisionLog || []
  }), projectAId);

  // 点击保存方案（预期抛错）
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);

  results.snapshots['R3_after_failure'] = await page.evaluate((id) => ({
    scenariosA: window.__t6Store.getProjectScenarios(id),
    scenariosB: window.__t6Store.getProjectScenarios(window.__syntheticProjectIds.B),
    logs: window.__t6Store.getProject(id).decisionLog || []
  }), projectAId);

  // 3.2.1 断言失败期间无意外实体写入
  assert.equal(
    results.snapshots.R3_after_failure.scenariosA.length,
    results.snapshots.R3_before_failure.scenariosA.length,
    'R3.2: 保存失败期间未产生新的未决成本场景实体'
  );
  assert.equal(
    results.snapshots.R3_after_failure.scenariosB.length,
    0,
    'R3.2: 保存失败期间未对 Project B 造成任何污染'
  );

  // 3.2.2 验证 T6 失败写尝试已由 trace 完整捕获 (Deliverable 3)
  const failedT6Writes = await page.evaluate(() => window.__persistCallTrace.filter(t => t.action === 't6_set_error'));
  assert.ok(failedT6Writes.length >= 1, 'R3.2: 失败写尝试已被 __persistCallTrace 记录并捕获 attemptedValue');
  assert.equal(failedT6Writes[0].attemptedValue.inputPayload.purchaseCost, 115, 'R3.2: 失败写尝试记录了当时用户输入的 115 成本');

  // 3.2.3 验证核算器未关闭，输入框 115 完好保留
  const isCalcStillOpen = (await page.locator('text=/Ozon 核算面板 · 项目/').count()) > 0;
  assert.equal(isCalcStillOpen, true, 'R3.2: 保存失败后核算器未被意外关闭');
  const r3CostAfterError = await page.locator('label:has-text("采购成本") + div input').inputValue();
  assert.equal(r3CostAfterError, '115', 'R3.2: 保存失败后采购成本输入 115 完整保留');

  // 3.2.4 验证 UI 缺陷：当前处于 costing Tab，错误 notice 不可见！
  const isErrorNoticeVisibleInCosting = await page.locator('text=T6_BACKEND_LOCKED').isVisible();
  assert.equal(isErrorNoticeVisibleInCosting, false, 'R3.2 确诊真实 UI 缺陷：costing Tab 下未渲染 notice，错误信息对用户不可见！');

  // 3.2.5 路径 A: 原地未切页重试 (No-navigation retry)
  console.log('  -> 正在执行重试路径 A: 原地未切页重试...');
  // 解除模拟错误
  await page.evaluate(() => { window.__simulateScenarioSaveError = null; });

  // 原地直接点击“保存此方案到项目”
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);

  // 验证保存成功并关闭核算器
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();
  const scenariosAfterNoNavRetry = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectAId);
  const scenarioNoNav = scenariosAfterNoNavRetry.at(-1);

  // 核心断言：未切页原地重试，真实保存了用户填写的 115 元！
  assert.equal(scenarioNoNav.inputPayload.purchaseCost, 115, 'R3.2 路径 A: 原地重试成功将失败时的输入 115 完整保存入库！');
  results.snapshots['R3_after_no_nav_retry'] = {
    scenarioId: scenarioNoNav.id,
    savedPurchaseCost: scenarioNoNav.inputPayload.purchaseCost
  };

  // 3.2.6 路径 B: 切概览再返回重试 (Overview-return retry)
  console.log('  -> 正在执行重试路径 B: 切概览再返回重试...');
  // 重新打开 Ozon 核算器
  await page.getByRole('button', { name: '使用 Ozon 核算' }).click();
  await page.locator('text=/Ozon 核算面板 · 项目/').first().waitFor();

  // 填入 115 并勾选确认
  await page.locator('label:has-text("采购成本") + div input').fill('115');
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();

  // 再次注入错误并保存失败
  await page.evaluate(() => {
    window.__simulateScenarioSaveError = new Error('T6_BACKEND_LOCKED: Synthetic backend lock failure');
  });
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);

  // 切到概览 Tab 查看错误提示
  await page.getByRole('button', { name: '概览' }).click();
  const isErrorNoticeVisibleInOverview = await page.locator('text=T6_BACKEND_LOCKED: Synthetic backend lock failure').isVisible();
  assert.equal(isErrorNoticeVisibleInOverview, true, 'R3.2: 错误提示仅在概览 Tab 中成功渲染可见');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r3-save-error-notice-in-overview.png') });

  // 切回“成本与物流” Tab（发生 unmount/remount）
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.locator('text=/Ozon 核算面板 · 项目/').first().waitFor();

  // 关键事实断言：由于发生组件重挂，成本输入框被草稿丢失缺陷重置为 65，而非 115！
  const costAfterOverviewReturn = await page.locator('label:has-text("采购成本") + div input').inputValue();
  assert.equal(costAfterOverviewReturn, '65', 'R3.2 确诊真实草稿丢失缺陷：切页查看错误返回后，输入的 115 静默重置为全局默认 65！');

  // 解除错误，重新勾选确认并保存
  await page.evaluate(() => { window.__simulateScenarioSaveError = null; });
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);
  await page.locator('text=成本场景（不可变快照，只读列表）').waitFor();

  const scenariosAfterNavRetry = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), projectAId);
  const scenarioNav = scenariosAfterNavRetry.at(-1);

  // 核心断言：切页后重试，实际保存的是回退后的 65 元，确认草稿丢失与虚假回退缺陷！
  assert.equal(scenarioNav.inputPayload.purchaseCost, 65, 'R3.2 路径 B: 切页重试实测保存了回退值 65，证实了草稿丢失');
  results.snapshots['R3_after_nav_retry'] = {
    scenarioId: scenarioNav.id,
    savedPurchaseCost: scenarioNav.inputPayload.purchaseCost
  };

  results.scenarios['R3'] = {
    name: '保存失败与双重试路径载荷对比',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'issues_found',
    findings: {
      no_navigation_retry: {
        savedCost: 115,
        status: 'preserved_input'
      },
      overview_return_retry: {
        savedCost: 65,
        status: 'fallback_to_historical_preset',
        defect: 'draft_loss_on_tab_switch'
      },
      notice_visibility_defect: 'notice_rendered_only_under_overview_tab'
    }
  };
  console.log('  ✅ R3 通过: 双重试路径载荷对比完成（原地保存115 vs 切页回退保存65），精确印证草稿丢失与提示不可见缺陷');

  // =========================================================================
  // R4: 开放核算器状态下的同实例 Props 切换探针 (Deliverable 2)
  // =========================================================================
  console.log('\n--- [R4] 开放核算器状态下的同实例 Props 切换探针 ---');
  await setContext('r4_open_calculator_props_switch');

  // 重新初始化纯净的 A/B 项目
  const { projectAId: r4A, projectBId: r4B } = await page.evaluate(() => window.__harnessMethods.setupSyntheticProjects());

  // 在固定 key 下挂载 Project A
  await page.evaluate((id) => {
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id, useExplicitKey: false });
  }, r4A);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.getByRole('button', { name: '使用 Ozon 核算' }).click();
  await page.locator('text=/Ozon 核算面板 · 项目/').first().waitFor();

  // 填入自定义成本 137
  await page.locator('label:has-text("采购成本") + div input').fill('137');
  const aPrice = await page.locator('label:has-text("售价") + div input').inputValue();
  assert.equal(aPrice, '2800', 'R4: Project A 售价为 2800');

  results.snapshots['R4_open_probe_before'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());

  // 核心探针操作：保持父组件实例不销毁，直接通过 props 将 projectId 从 A 切换为 B
  await page.evaluate((id) => {
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id, useExplicitKey: false });
  }, r4B);

  await page.locator('text=项目B合成商品 (自动烘干箱)').waitFor();

  // 检查在核算器保持打开时，B 呈现的数据
  const bObservedPrice = await page.locator('label:has-text("售价") + div input').inputValue();
  const bObservedWeight = await page.locator('label:has-text("实重") + div input').inputValue();
  const bObservedCost = await page.locator('label:has-text("采购成本") + div input').inputValue();

  // 关键事实断言：B 继承了 A 的售价 (2800) 和重量 (0.35)，而非 B 的 9800 和 4.8！成本回退为 65！
  assert.equal(bObservedPrice, '2800', 'R4 确诊探针缺陷：同实例切入 B 时，核算器界面残留了 A 的售价 2800');
  assert.equal(bObservedWeight, '0.35', 'R4 确诊探针缺陷：同实例切入 B 时，核算器界面残留了 A 的重量 0.35');
  assert.equal(bObservedCost, '65', 'R4 确诊探针缺陷：同实例切入 B 时，采购成本回退为全局 65');

  // 用户显式勾选并保存该方案
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);

  // 检查 Project B 中落库的场景
  const bScenarios = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), r4B);
  assert.equal(bScenarios.length, 1, 'R4: Project B 生成了 1 个场景');
  assert.equal(bScenarios[0].inputPayload.price, 2800, 'R4: Project B 场景中持久化了来自 A 的陈旧售价 2800');
  assert.equal(bScenarios[0].inputPayload.weight, 0.35, 'R4: Project B 场景中持久化了来自 A 的陈旧重量 0.35');

  results.snapshots['R4_open_probe_after'] = await page.evaluate(() => window.__harnessMethods.getStoreSnapshot());
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'r4-open-calculator-props-switch-saved-B.png') });

  results.scenarios['R4'] = {
    name: '开放核算器状态下的同实例 Props 切换探针',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'issues_found',
    probe_type: 'synthetic_component_probe',
    findings: {
      observed_leak: 'B_inherited_A_price_and_weight',
      aPrice,
      bObservedPrice,
      bObservedWeight,
      bExpectedPrice: '9800',
      bExpectedWeight: '4.8',
      savedScenarioInB: bScenarios[0]
    },
    navigation_reachability: {
      status: 'unreachable_in_production_navigation',
      reason: 'App.jsx:306 未向 ProjectDetailPage 提供 key；但在真实 UI 导航中，切换项目必须点击 onBack 返回 ProjectListPage，该动作会导致 ProjectDetailPage 完整 unmount 卸载，再次进入新项目时执行全新挂载，因此同实例直接 props 切换在当前生产导航流下不可达。'
    }
  };
  console.log('  ✅ R4 通过: 开放核算器同实例 props 切换探针完成；确认为合成探针缺陷，生产导航无直接路径');

  // =========================================================================
  // R5: 跨项目隔离与故障注入敏感度验证 (Deliverable 4)
  // =========================================================================
  console.log('\n--- [R5] 跨项目隔离与故障注入敏感度验证 ---');
  await setContext('r5_cross_project_isolation');

  const { projectAId: r5A, projectBId: r5B } = await page.evaluate(() => window.__harnessMethods.setupSyntheticProjects());

  // 设置故障注入标志（由外部环境变量控制）
  await page.evaluate((inject) => {
    window.__injectCrossProjectCorruption = inject;
  }, isFaultInjection);

  await page.evaluate((id) => {
    window.__setHarnessRenderState({ mode: 'project-detail', projectId: id, useExplicitKey: true });
  }, r5A);

  await page.locator('text=项目A合成商品 (猫咪去油慕斯)').waitFor();
  await page.getByRole('button', { name: '成本与物流' }).click();
  await page.getByRole('button', { name: '使用 Ozon 核算' }).click();
  await page.locator('text=/Ozon 核算面板 · 项目/').first().waitFor();

  await page.locator('label:has-text("采购成本") + div input').fill('55');
  await page.locator('label:has-text("已确认采购成本及平台费用假设") input').check();
  await page.getByRole('button', { name: '保存此方案到项目' }).click();
  await page.waitForTimeout(500);

  const r5ScenariosA = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), r5A);
  assert.equal(r5ScenariosA.length, 1, 'R5: Project A 应成功保存 1 个场景');

  // 严格比较断言：Project B 场景数必须为 0！
  const r5ScenariosB = await page.evaluate((id) => window.__t6Store.getProjectScenarios(id), r5B);
  assert.equal(
    r5ScenariosB.length,
    0,
    `R5: Project B 场景数严格为 0，严禁跨项目串写污染 (实测检测到 ${r5ScenariosB.length} 个污染场景: ${r5ScenariosB.map(s => s.name).join(', ')})`
  );

  results.scenarios['R5'] = {
    name: '跨项目隔离与故障注入敏感度验证',
    execution_status: 'completed',
    assertions_status: 'passed',
    business_verdict: 'verified_shared_behavior',
    notes: '正常模式下 Project A 保存场景严格不污染 Project B (场景数=0)；比较断言对跨项目串写具备真实验收敏感度。'
  };
  console.log('  ✅ R5 通过: 跨项目隔离比较断言验证通过');

  results.execution_status = 'completed';
  results.assertions_status = 'passed';
  results.business_verdict = 'issues_found';
  results.passed = true;

} catch (err) {
  console.error('\n❌ 测试执行或断言失败:', err.message);

  // 精准故障注入判断（Deliverable 4）：必须命中特定的 Project B 隔离断言且命中注入的标记
  const isExpectedFaultCaught = isFaultInjection && (
    err.message.includes('Project B 场景数严格为 0') &&
    err.message.includes('CORRUPTED_SCENARIO_INJECTED_FROM_A')
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

  // 过滤出未预期的 Page Errors（除 QuotaExceededError 以外的错误均属非预期）
  const unexpectedPageErrors = observedPageErrors.filter(
    (e) => !(e.context === 'r3_error_handling_and_retry_comparison' && e.message.includes('QuotaExceededError'))
  );

  results.error_summary = {
    observedPageErrorsCount: observedPageErrors.length,
    unexpectedPageErrorsCount: unexpectedPageErrors.length,
    unexpectedPageErrors,
    classifiedWarnings
  };

  // 若出现非预期的 Page Error，且非故障注入模式，则断言状态失败
  if (unexpectedPageErrors.length > 0 && !isFaultInjection) {
    results.assertions_status = 'failed';
    results.business_verdict = 'error_caught';
    results.passed = false;
  }

  // 写入运行结果
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
