# KUAIJING-IA-REFACTOR-V1 · TASK 07A-2B

## Project Supply Chain → Stage Gate Context Integration 实施与契约交付文档

> 本文档记录 TASK 07A-2B 的实施细节：将 SKU Project Workspace (`ProjectDetailPage.jsx`) 中的真实供应链事实（供应商报价数量与样品记录数量）安全注入 Stage Gate 上下文 (`gateDeps.availableModules`)，并升级 `gateEngine.js` 的 `supplier_quote` 与 `samples_record` 检查，同时保持 `gateEngine.js` 纯领域评估器架构纯度。

---

### 1. 架构目标与核心原则

在 TASK 07A-2A 完成 Project-scoped 供应链面板实施后，底层与 UI 已具备真实的 Supplier、SupplierQuote 与 SampleRecord 数据。本任务的核心目标是将这些事实接入 Stage Gate：

- **纯领域评估器原则（Pure Domain Evaluator）**：
  `gateEngine.js` 严禁导入 `t6Store.js`，绝不直接调用 `getProjectSuppliers()`、`getSupplierQuotes()` 或 `getProjectSamples()`。评估器只依赖入参 `(project, targetStage, deps)`。
- **调用层装配事实（Calling Layer Fact Assembly）**：
  由调用层 `ProjectDetailPage.jsx` 负责从 `t6Store.js` 提取项目作用域的供应链事实，构造成结构化契约对象并通过 `deps.availableModules` 注入。
- **非侵入与向后兼容（Fail-safe Fallback）**：
  若外部未注入 `availableModules`，或模块事实标有 `evaluated !== true`，检查项自动回退为 `NOT_EVALUATED`，绝不破坏历史调用或遗留测试。
- **严格 Fail-close 边界安全**：
  当模块已评估（`evaluated: true`）但指标缺失、为 0、为负数或为 NaN 时，坚决裁定为 `FAIL` 并输出清晰中文阻断原因，杜绝虚假放行。

---

### 2. Available Modules 契约规范

调用层向 `evaluateProjectGate` 和 `transitionProjectStage` 传递的 `deps.availableModules` 结构定义如下：

```javascript
deps.availableModules = {
  // 供应商与报价事实
  supplier: {
    evaluated: true,        // boolean: 是否由调用方完成评估与注入
    supplierCount: Number,  // number: 该项目的供应商总数
    quoteCount: Number,     // number: 该项目下全部供应商的报价版本累计总数
  },
  // 样品打样事实
  samples: {
    evaluated: true,        // boolean: 是否由调用方完成评估与注入
    sampleCount: Number,    // number: 该项目的样品记录总数
  },
}
```

---

### 3. gateEngine.js 纯评估器实现

在 `ozon-react/src/utils/t6/gateEngine.js` 中：

1. **上下文透传**：
   在 `evaluateProjectGate` 中解构 `deps` 时，将 `availableModules` 纳入 `ctx`：
   ```javascript
   const { availableModules = {}, snapshot = null, scenarios = [] } = deps
   const snapshotSpecified = 'snapshot' in deps
   const ctx = { scenarios, snapshot, snapshotSpecified, availableModules }
   ```

2. **CHECKS.SAMPLING.supplier_quote 实现**：
   ```javascript
   {
     id: 'supplier_quote',
     label: '至少 1 个供应商报价',
     kind: 'module',
     module: 'supplier',
     evaluate: (p, ctx) => {
       const fact = ctx.availableModules?.supplier
       if (!fact || fact.evaluated !== true) {
         return { result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH.supplier || '供应商管理尚未接入' }
       }
       return Number(fact.quoteCount) > 0
         ? { result: GATE_RESULTS.PASS }
         : { result: GATE_RESULTS.FAIL, message: '尚无供应商报价' }
     },
   }
   ```

3. **CHECKS.COMPLIANCE.samples_record 实现**：
   ```javascript
   {
     id: 'samples_record',
     label: '样品记录存在',
     kind: 'module',
     module: 'samples',
     evaluate: (p, ctx) => {
       const fact = ctx.availableModules?.samples
       if (!fact || fact.evaluated !== true) {
         return { result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH.samples || '样品记录尚未接入' }
       }
       return Number(fact.sampleCount) > 0
         ? { result: GATE_RESULTS.PASS }
         : { result: GATE_RESULTS.FAIL, message: '尚无打样记录' }
     },
   }
   ```

4. **模块检查分流执行**：
   ```javascript
   for (const stage of path) {
     for (const def of CHECKS[stage] || []) {
       if (def.kind === 'module') {
         if (typeof def.evaluate === 'function') {
           checks.push({ stage, id: def.id, label: def.label, ...def.evaluate(project, ctx) })
         } else {
           checks.push({ stage, id: def.id, label: def.label, result: GATE_RESULTS.NOT_EVALUATED, message: MODULE_ZH[def.module] || '该依赖模块尚未实现' })
         }
       } else {
         checks.push({ stage, id: def.id, label: def.label, ...def.evaluate(project, ctx) })
       }
     }
   }
   ```

---

### 4. 调用层事实解析与注入（ProjectDetailPage.jsx）

在 `ozon-react/src/components/t6/ProjectDetailPage.jsx` 中：

1. **导入 Store API**：
   ```javascript
   import {
     // ...
     getProjectSuppliers, getSupplierQuotes, getProjectSamples,
   } from '../../utils/t6/t6Store'
   ```

2. **响应式计算**：
   绑定 `project.id` 与 `tick`（确保在供应链面板发生任何增改动作后自动触发刷新）：
   ```javascript
   const projectSuppliers = useMemo(() => (project?.id ? getProjectSuppliers(project.id) : []), [project?.id, tick])
   const quoteCount = useMemo(() => {
     return projectSuppliers.reduce((sum, sup) => sum + getSupplierQuotes(sup.id).length, 0)
   }, [projectSuppliers, tick])
   const sampleCount = useMemo(() => (project?.id ? getProjectSamples(project.id).length : 0), [project?.id, tick])
   ```

3. **构造统一 gateDeps**：
   ```javascript
   const gateDeps = {
     availableModules: {
       supplier: {
         evaluated: true,
         supplierCount: projectSuppliers.length,
         quoteCount,
       },
       samples: {
         evaluated: true,
         sampleCount,
       },
     },
     snapshot,
     scenarios,
   }
   ```

---

### 5. Gate 预览与执行完全一致性

- **预览评估**：
  ```javascript
  const gate = direction === 'FORWARD'
    ? evaluateProjectGate(project, targetStage, gateDeps)
    : null
  ```
- **推进执行**：
  ```javascript
  const advanceStage = () => {
    try {
      const res = transitionProjectStage({
        projectId: project.id,
        targetStage,
        deps: gateDeps,
        reason,
      })
      // ...
    }
  }
  ```
两者消费同一个 `gateDeps` 引用，确保用户在界面上看到的 Gate 结论（GREEN / YELLOW / RED）与点击推进时的判定逻辑逐位一致，没有任何分支漂移。

---

### 6. 阶段推进流转行为矩阵

| 流转路径 | 前提数据条件 | 检查项判定 | 总裁决 Verdict | 行为与结果 |
| :--- | :--- | :--- | :--- | :--- |
| `COSTING → SAMPLING` | `quoteCount === 0` | `supplier_quote: FAIL`<br>（尚无供应商报价） | **RED** | 阻断流转；必须在 UI 输入推进理由并记录 `gate_override` 决策日志方可强制推进。 |
| `COSTING → SAMPLING` | `quoteCount >= 1`<br>`基线毛利 >= 15%` | `supplier_quote: PASS`<br>`margin_warning: PASS` | **GREEN** | 畅通流转；点击按钮直接推进至 SAMPLING，无需填写理由。 |
| `COSTING → SAMPLING` | `quoteCount >= 1`<br>`基线毛利 < 15%` | `supplier_quote: PASS`<br>`margin_warning: WARN` | **YELLOW** | 风险流转；UI 呈现黄色警示，要求填写理由后推进。 |
| `SAMPLING → COMPLIANCE` | `sampleCount === 0` | `samples_record: FAIL`<br>（尚无打样记录） | **RED** | 阻断流转；提示“尚无打样记录”。 |
| `SAMPLING → COMPLIANCE` | `sampleCount >= 1` | `samples_record: PASS`<br>`compliance_pending: NOT_EVALUATED` | **NOT_EVALUATED** | 样品通过但下游合规模块未开发；按设计保持 NOT_EVALUATED，允许推进但给出中性提示。 |

---

### 7. Fail-close 边界安全与防御设计

针对可能出现的边界畸变数据，评估函数通过 `Number(fact.quoteCount) > 0` 实行 Fail-close 判定：

- `quoteCount: 0` → `FAIL`
- `quoteCount: undefined` → `FAIL`
- `quoteCount: null` → `FAIL`
- `quoteCount: NaN` → `FAIL`
- `quoteCount: -1` → `FAIL`
- 只有严格的正数值（`>= 1`）才判定为 `PASS`。
- 对 `sampleCount` 实行完全相同的数学判定，杜绝由于前端未初始化或数据空缺导致的误通过。

---

### 8. 未实现模块严格隔离

虽然在 `availableModules` 中注入了 `supplier` 与 `samples`，但以下模块检查在 `gateEngine.js` 中仍无 `evaluate` 函数，恒定返回 `NOT_EVALUATED`：
- `compliance_pending`（合规）
- `compliance_done`（合规）
- `cert_plan`（合规/认证）
- `listing_draft`（Listing）
- `stock_plan`（运营/库存）
- `cold_start`（运营/冷启动）

因此即使推进到 `OPERATIONS` 阶段，Gate 也绝不会由于部分模块未完成而误判为 GREEN 或 RED。

---

### 9. 自动化测试与全链路回归

#### 新建专项测试：`tests/ia-project-supply-gate.test.mjs`
涵盖 **24 项测试**：
1. `gateEngine.js` 纯领域评估器纯度检查（零 Store 导入，零 API 读取）
2. `supplier_quote` 未注入返回 `NOT_EVALUATED`
3. `supplier_quote` 非法标志位返回 `NOT_EVALUATED`
4. `supplier_quote` 0 报价返回 `FAIL` 并附阻断理由
5. `supplier_quote` 畸变输入安全防御（Fail-close）
6. `supplier_quote` 单一报价返回 `PASS`
7. `supplier_quote` 多个报价返回 `PASS`
8. `samples_record` 未注入返回 `NOT_EVALUATED`
9. `samples_record` 非法标志位返回 `NOT_EVALUATED`
10. `samples_record` 0 样品返回 `FAIL` 并附阻断理由
11. `samples_record` 畸变输入安全防御（Fail-close）
12. `samples_record` 单一样品返回 `PASS`
13. `samples_record` 多个样品返回 `PASS`
14. 保护未实现依赖域严格返回 `NOT_EVALUATED`
15. 综合推进：`COSTING → SAMPLING` 无报价阻断为 `RED`
16. 综合推进：`COSTING → SAMPLING` 报价就绪直通 `GREEN`
17. 综合推进：`COSTING → SAMPLING` 毛利不足警示为 `YELLOW`
18. 综合推进：`SAMPLING → COMPLIANCE` 无打样记录阻断为 `RED`
19. 综合推进：`SAMPLING → COMPLIANCE` 打样完成稳健处于 `NOT_EVALUATED`
20. 综合推进：`PIPELINE → SAMPLING` 跨阶段聚合路径安全校验
21. 静态检查：`ProjectDetailPage.jsx` 正确导入 Store 供应链查询 API
22. 静态检查：`ProjectDetailPage.jsx` 正确装配 `gateDeps.availableModules`
23. 静态检查：`advanceStage` 与 `evaluateProjectGate` 消费一致的 `gateDeps`
24. 运行时全链路闭环模拟：无报价拦截 (RED) → 录入供应商与报价 → 顺利推进 SAMPLING (GREEN)

#### 全套回归验证结果
- `node tests/ia-project-supply-gate.test.mjs`：**24/24 PASS**
- `node tests/ia-project-supply-chain-ui.test.mjs`：**26/26 PASS**
- `node tests/ia-candidate-project-launch.test.mjs`：**20/20 PASS + E2E PASS**
- `node tests/ia-dual-snapshot-project-gate.test.mjs`：**19/19 PASS**
- `npm run test:t6`：**130/130 PASS**
- `npm test`：React 65 项 + Python 44 项全绿
- `npm run test:golden`：56 项评分 + 76 项核算黄金案例全绿
- `npm run test:sync`：双端对拍零差异全绿
- `npm run test:web-persistence`：持久化与安全审计全绿
- `npm --prefix ozon-react run build`：生产构建一次性成功通过

---

### 10. 交付物与修改文件清单

1. `ozon-react/src/utils/t6/gateEngine.js`：
   - CHECKS.SAMPLING 中增加 `supplier_quote` 纯评估器逻辑。
   - CHECKS.COMPLIANCE 中增加 `samples_record` 纯评估器逻辑。
   - `evaluateProjectGate` 中透传 `availableModules`，并支持模块纯求值。
   - 绝不引入任何 Store 依赖。
2. `ozon-react/src/components/t6/ProjectDetailPage.jsx`：
   - 导入 `getProjectSuppliers`, `getSupplierQuotes`, `getProjectSamples`。
   - 响应式汇总 `supplierCount`, `quoteCount`, `sampleCount`。
   - 装配 `gateDeps.availableModules`，统一传给预览与推进函数。
3. `tests/ia-project-supply-gate.test.mjs`：
   - 24 项测试全覆盖。
4. `docs/ia/TASK07A2B_PROJECT_SUPPLY_GATE.md`：
   - 本实施与契约文档。
