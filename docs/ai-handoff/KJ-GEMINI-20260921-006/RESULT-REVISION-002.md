# KJ-GEMINI-20260921-006 Revision 002: 最终证据缺口闭合报告

> **任务标识**：KJ-GEMINI-20260921-006 (Revision 002)  
> **执行角色**：Gemini（复核与审计由 Codex / 人工独立进行）  
> **基线 Commit**：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`  
> **测试套件**：`docs/ai-handoff/KJ-GEMINI-20260921-006/run-revision-002-costing-tests.mjs`  
> **测试状态**：
> - **正常模式 (revision-002-normal)**：`execution_status: completed`, `assertions_status: passed`, `business_verdict: issues_found`，退出码 `0`
> - **故障模式 (revision-002-fault)**：`execution_status: completed`, `assertions_status: failed`, `business_verdict: fault_injection_caught`，退出码 `1`
> - **基线哈希校验**：28 个关键基线文件 SHA256 校验 0 差异 (`verified_clean_0_mismatches`)
> **生产变更**：**0 生产代码修改，0 生产配置变更，0 部署**

---

## 1. 核心改进与证据缺口闭合总结 (Executive Summary)

依据 `REVISION-002.md` 与 `REVIEW-REVISION-001.md` 的审阅意见，本轮补验针对首轮遗留的 4 个关键证据缺口进行了精确的实测闭合：

### 1.1 保存失败后的重试载荷对比实测闭合（Deliverable 1）
- **原地未切页重试（Path A）**：在发生保存失败（抛出 `T6_BACKEND_LOCKED`）后，核算器未被关闭，输入框内的 `115` 完好保留。若用户在当前页面直接解除错误并再次点击保存，新增场景实际保存的采购成本**确为 115 元** (`scenarioNoNav.inputPayload.purchaseCost === 115`)。
- **切概览再返回重试（Path B）**：在发生保存失败后，若用户切换到“概览” Tab 查看错误提示，再切回“成本与物流” Tab，由于触发了 `SingleTab` 的卸载与重挂，草稿丢失缺陷生效，采购成本输入框被静默重置为全局历史回退值 `65` 元。用户重新勾选确认并重试保存后，新增场景实际保存的采购成本**回退为了 65 元** (`scenarioNav.inputPayload.purchaseCost === 65`)。
- **实测结论**：证实了保存失败本身未丢弃输入，但**跨 Tab 查看错误必然导致草稿丢失并静默回退历史数值**。实测如实记录为 `issues_found`，未掩盖真实缺陷。

### 1.2 开放核算器状态下的同实例 Props 切换探针（Deliverable 2）
- **组件级合成探针实测**：在固定组件 key（`useExplicitKey: false`）的条件下，当 Project A 的 Ozon 核算器处于打开状态时，直接通过 props 将 `projectId` 切换为 Project B：
  - 界面上 Project B 继承了 Project A 的售价（`2800`，预期为 `9800`）和重量（`0.35`，预期为 `4.80`），采购成本回退为 `65`；
  - 用户勾选确认并保存后，Project B 落库的场景**错误持久化了来自 Project A 的陈旧售价 (2800) 和重量 (0.35)**，而 `sourceSnapshotId` 却指向了 Project B 的快照；
  - 证实了目标实体 ID 正确不代表输入数据来源正确。
- **真实生产导航可达性澄清**：审查 `App.jsx:306` 发现，虽然 `<ProjectDetailPage projectId={activeProjectId} onBack={() => setActiveNode('__t6_projects__')} />` 未显式传递 `key`，但在真实的生产 UI 导航中，用户无法在不退出详情页的情况下直接跳转另一个项目——每次切换项目必须先点击 `onBack` 返回 `ProjectListPage`（导致 `ProjectDetailPage` 完整 unmount 卸载），再点击进入新项目（执行全新挂载）。因此，**该问题属于组件边界上的合成探针缺陷，在当前生产导航流下不可直接触发**。本报告如实定性，未将其夸大为已观察到的生产事故。

### 1.3 真实 ProjectDetailPage 项目模式下的 WB 控件交互与失败写记录（Deliverable 3）
- 补齐了在真实 `ProjectDetailPage` 项目模式下打开 WB 控件的操作：
  - SKU 模板保存：真实点击“保存为SKU模板”，写入全局 `wb-skus-v1`；
  - 订单 CSV 导入与删除：真实上传合成 CSV 并点击删除按钮，写入并清空全局 `wb-orders-v1`；
  - 费率重置：真实点击“重置默认”并确认弹窗，写入全局 `wb-tariffs-v1`；
  - **隔离断言**：在操作 WB 全局控件期间，Project B 的项目档案与场景数量保持严格不变（0 个场景，0 数据污染）；
  - **失败写追踪**：T6 存储适配器在发生保存异常时，在抛出错误前向 `__persistCallTrace` 压入 `t6_set_error` 动作，完整捕获了当时的失败原因及 `attemptedValue`（采购成本 115 元）。

### 1.4 严谨的异常分类与精准故障检测（Deliverable 4）
- **控制台警告分类统计**：在测试过程中，WB 线路下拉框由于数据源重复产生了 55 次 React 警告（`Warning: Encountered two children with the same key`），测试套件进行了精确过滤与分类统计，未全局吞没；
- **异常捕获准确性**：除受控的 2 次 `QuotaExceededError` 外，无任何非预期 `pageerror`；
- **故障注入判定严密化**：R5 故障注入断言不仅比对 `Project B 场景数严格为 0`，还精确核验了注入的特定污染标记 `CORRUPTED_SCENARIO_INJECTED_FROM_A`，彻底排除了通用异常误判为断言成功的可能性。

---

## 2. 实测场景与证据索引矩阵

| 场景编号 | 测试目标与交互路径 | 读写键与归属 | 实测表现与数据事实 | 业务判定 | 截图与日志证据 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R1.1** | 真实 `ProjectDetailPage` 挂载 Ozon 单品保存 | 读：`shipping-calc-rfbs-v2` (base)<br>写：`t6.costScenario.*`, `t6.project.A` | 售价 2800、重量 0.35 来自候选快照；成本回退 65；修改为 95 保存后自动关闭核算器；Project A 生成场景 #1，B 保持 0 场景；全局 65 未篡改 | `issues_found` (空白继承历史预设) | `r1-1-ozon-calc-embedded.png`<br>`r1-1-ozon-scenario-saved.png` |
| **R1.2** | 真实 `ProjectDetailPage` 挂载 WB 单订单保存 | 写：`t6.costScenario.*`, `t6.project.A` | 填入成本 42，勾选确认后保存；自动关闭核算器；生成 WB 场景 #2（带仅测算参考标识）；Project A 场景数=2，B=0 | `verified_shared_behavior` | `r1-2-wb-calc-embedded.png`<br>`r1-2-wb-scenario-saved.png` |
| **R1.3** | 导航生命周期：真实卸载重挂 vs 闭合状态同实例 Props 切换 | 内存 state | 真实路由跳转通过列表导致 unmount/remount，重置回 `overview` Tab；同实例 props 切换保持在 `costing` Tab 并呈现 B 的空场景列表 | `verified_shared_behavior` | `r1-3-same-instance-props-switch-B.png` |
| **R2.1** | WB 独立模式控件操作 | 写：`wb-skus-v1`, `wb-tariffs-v1`, `wb-orders-v1` | 独立模式下点击 SKU 模板保存、费率重置、订单 CSV 导入与删除均真实触发全局写 | `verified_shared_behavior` | 交互 trace 序列记录 |
| **R2.2** | 真实 ProjectDetailPage 项目模式下的 WB 控件操作 | 读写：`wb-skus-v1`, `wb-tariffs-v1`, `wb-orders-v1`<br>断言：`t6.project.B` | 在项目详情页内打开 WB，执行 SKU 模板保存、订单 CSV 导入删除、费率重置；断言 Project B 场景数严格保持为 0，零数据穿透 | `verified_shared_behavior` | trace 捕获真实写，Project B 保持 0 场景 |
| **R2.3** | WB 设置主动编辑动作评估 | (无控件) | 源码 `WBCalc.jsx:68` 未传递 `saveSettings`，界面无 settings 输入表单，如实标记 `not_applicable` | `not_applicable` | 源码核验证据 |
| **R3.1** | 独立模式配额超限与恢复写 | 写：`shipping-calc-rfbs-v2` | 抛出 `QuotaExceededError` 时输入框 88 完好保留，底层抛错被 `pageerror` 捕获；解除错误后恢复写 89 成功持久化 | `issues_found` (非平滑 UI 提示) | `observed-page-errors.json` |
| **R3.2 (Path A)** | 真实父页保存失败后**原地未切页重试** | 写入尝试：`t6.costScenario.*` | 失败期间无未决实体写入，trace 记录 `t6_set_error` 及输入 115；解除错误后在当前页直接点击保存，**成功保存用户填写的 115 元** (`cost === 115`) | `verified_shared_behavior` | `costing-isolation-results.json` |
| **R3.2 (Path B)** | 真实父页保存失败后**切概览再返回重试** | 写入尝试：`t6.costScenario.*` | 切概览 Tab 查看到 `T6_BACKEND_LOCKED` 提示（确认 costing Tab 错误不可见缺陷）；切回 costing 后组件重挂，输入被草稿丢失重置为 65，**重试实际保存为 65 元** (`cost === 65`) | `issues_found` (草稿丢失与虚假回退缺陷) | `r3-save-error-notice-in-overview.png` |
| **R4** | 开放核算器状态下的同实例 Props 切换探针 | 组件局部 prefill state | 保持核算器打开从 A 切到 B，B 错误呈现 A 的售价 2800 和重量 0.35，保存落库为 B 的快照配 A 的数据；确认生产导航经列表退出因此此路径不可达 | `issues_found` (合成探针缺陷) | `r4-open-calculator-props-switch-saved-B.png` |
| **R5** | 跨项目隔离与故障注入精准捕获 | 断言比较：`r5ScenariosB.length === 0` | 正常模式下断言 Project B 场景数为 0 通过 (退出码 0)；故障注入模式精准捕获带有 `CORRUPTED_SCENARIO_INJECTED_FROM_A` 的串写场景并触发 `1 !== 0` (退出码 1) | `fault_injection_caught` | `evidence/revision-002-fault/` 退出码 1 |

---

## 3. 运行记录与环境边界

```bash
# 正常模式运行 (退出码 0，包含 R1~R5 全量实测)
node docs/ai-handoff/KJ-GEMINI-20260921-006/run-revision-002-costing-tests.mjs

# 故障注入模式运行 (退出码 1，精准捕获跨项目串写)
$env:TEST_INJECT_CROSS_PROJECT_CORRUPTION="1"; node docs/ai-handoff/KJ-GEMINI-20260921-006/run-revision-002-costing-tests.mjs

# 28 个关键文件基线完整性校验 (退出码 0，0 差异)
node --input-type=module -e "..."
```

### 环境边界声明：
1. **纯内存替身**：持久化采用 `__inMemoryPersistStore` 与虚拟模块，完全阻断外部网络 (`page.route('**/*', abort)`) 与本地真实 localStorage。
2. **合成汇率**：采用固定合成汇率 12.5 RUB/CNY，未向央行或商业银行接口发起真实 HTTP 请求。
3. **未执行项目**：未连接 WordPress/MySQL 远端持久化数据库，未测试多客户端 409 冲突回退网络拓扑。

---

## 4. 交付文件清单

1. `docs/ai-handoff/KJ-GEMINI-20260921-006/run-revision-002-costing-tests.mjs` — 本轮自动化实测套件
2. `docs/ai-handoff/KJ-GEMINI-20260921-006/evidence/revision-002-normal/` — 正常模式完整产物（10 个文件，含结果、trace、错误日志与 7 张实测截图）
3. `docs/ai-handoff/KJ-GEMINI-20260921-006/evidence/revision-002-fault/` — 故障注入独立产物（10 个文件，断言捕获退出码 1）
4. `docs/ai-handoff/KJ-GEMINI-20260921-006/_backup_revision_001/` — Revision 001 历史文件归档备份
5. `docs/ai-handoff/KJ-GEMINI-20260921-006/tests-revision-002.json` — 结构化测试证据
6. `docs/ai-handoff/KJ-GEMINI-20260921-006/FINDINGS.md` — 发现清单
7. `docs/ai-handoff/KJ-GEMINI-20260921-006/WRITE_MATRIX.md` — 读写隔离矩阵
8. `docs/ai-handoff/CURRENT_TASK.json` & `STATUS.json` — 任务状态指针

本轮测试在完全隔离的无头浏览器环境中执行，所有 28 个基线文件保持 0 差异，无任何生产代码或业务数据修改，未执行部署。
