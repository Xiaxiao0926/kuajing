# KJ-GEMINI-20260921-006 Revision 001: 真实父页面交互、真实 WB 控件与异常观测补验报告

> **任务标识**：KJ-GEMINI-20260921-006 (Revision 001)  
> **执行角色**：Gemini（复核与审计由 Codex / 人工独立进行）  
> **基线 Commit**：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`  
> **测试套件**：`docs/ai-handoff/KJ-GEMINI-20260921-006/run-revision-costing-tests.mjs`  
> **测试状态**：
> - **正常模式 (revision-normal)**：`execution_status: completed`, `assertions_status: passed`, `business_verdict: issues_found`，退出码 `0`
> - **故障模式 (revision-fault)**：`execution_status: completed`, `assertions_status: failed`, `business_verdict: fault_injection_caught`，退出码 `1`
> - **基线哈希校验**：28 个关键基线文件 SHA256 校验 0 差异 (`verified_clean_0_mismatches`)
> **生产变更**：**0 生产代码修改，0 生产配置变更，0 部署**

---

## 1. 补验核心结论 (Executive Summary)

依据 `REVISION-001.md` 与 `REVIEW.md` 提出的复核缺口，本轮补验全面摈弃了首轮中的“合成回调与手写数据伪造”，完全基于**真实的 React 父页面容器 (`ProjectDetailPage.jsx`)**、**真实的用户 UI 控件操作**与**浏览器底层异常监听**，对独立核算与项目核算的读写隔离、异常处理及展示边界进行了深度闭环验证。

### 核心结论要点：
1. **真实父页面保存与生命周期闭环完全成立**：
   - 挂载真实 `ProjectDetailPage`，进入 `costing` Tab 打开 Ozon/WB 核算器并点击保存，执行的是真实组件内的 `saveOzonScenario` / `saveWbScenario`，完整触发了 `createCostScenario` 写入、`setOzonContext(null)` / `setWbContext(null)` 自动关闭核算器、场景列表实时刷新与基线展示。
   - 数据持久化严格限定于目标项目实体（Project A 生成实体 `t6.costScenario.<id>` 并关联 `t6.project.A`），Project B 在 Store 中保持 0 场景；全局单品预设 `shipping-calc-rfbs-v2` 保持原值未被项目编辑污染。
2. **明确区分了同实例 Props 切换与路由卸载重挂两条路径**：
   - **同实例 Props 切换（不变 key）**：保持组件实例不销毁仅更新 `projectId`，父页面局部 state（如当前激活的 `tab: 'costing'`）保持不变，直接刷新呈现新项目的成本场景列表；
   - **路由跳转（变 key 卸载重挂）**：真实路由切换触发组件卸载重建，局部 state 全部重置，默认回到概览 Tab (`tab: 'overview'`)。
3. **真实 WB UI 操作全量落地，澄清无控件动作**：
   - 真实点击 CalculatorTab 的“保存为SKU模板”按钮，断言写入 `wb-skus-v1`；
   - 真实点击 TariffTab 的“重置默认”按钮并确认，断言写入 `wb-tariffs-v1`；
   - 真实通过 Playwright 文件选择器导入纯合成订单 CSV 并点击删除按钮，断言写入与清空 `wb-orders-v1`；
   - **对 `wb-settings-v1` 主动修改澄清**：经源码核验，`WBCalc.jsx:68` 虽然声明了 `saveSettings` 但未传给任何子 Tab，界面上**根本没有提供用户主动编辑 settings 的任何表单控件**，所有 settings 写入均由挂载迁移或汇率 Hook 自动触发。本测试如实将其标记为 `not_applicable`，彻底废除了首轮中手写 `Map.set` 伪造用户写入的不实证据。
4. **真实异常捕获与错误提示可见性缺陷定位**：
   - 独立模式 `persistSet` 抛出 `QuotaExceededError` 时，底层错误被 `pageerror` 准确捕获，组件内存状态未丢失；
   - 真实父页面场景保存抛出 `T6_BACKEND_LOCKED` 异常时，`saveOzonScenario` 的 `catch` 成功捕获异常，未调用 `setOzonContext(null)`，核算器保持打开，输入框内容 (115) 完好保留，未产生虚假成功；
   - **确诊真实 UI 缺陷**：`ProjectDetailPage.jsx:417` 的错误信息提示（`notice`）被硬编码包裹在 `{tab === 'overview' && ...}` 条件下，导致当用户在 `costing` Tab 下保存失败时，页面上**完全看不到任何错误提示**！只有手动切换回“概览” Tab 时错误提示才展现。
5. **跨项目比较断言敏感度真实有效**：
   - 在开启故障注入（环境变量激活跨项目串写）时，测试未人为调用 `assert.fail`，而是完全由业务比较断言 `assert.equal(r4ScenariosB.length, 0)` 敏锐捕获 Project B 中多出的 1 个场景并抛出 `1 !== 0` AssertionError 导致进程退出码 1，证明断言对跨项目污染具备真实验收敏感度。

---

## 2. 补验场景与证据矩阵 (Revision Matrix)

| 场景编号 | 补验要求项 | 执行路径与真实交互 | 读写键与归属 | 判定状态 | 核心证据 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R1.1** | 真实父页面 Ozon 核算与保存闭环 | 真实 `ProjectDetailPage` 挂载，点击成本 Tab，点击「使用 Ozon 核算」，修改采购成本 95，勾选人工确认，点击「保存此方案到项目」 | 读：`shipping-calc-rfbs-v2` (回退 base)<br>写：`t6.costScenario.<id>`, `t6.project.A` | `issues_found` (空白继承历史预设) | 核算器自动关闭，场景列表刷新呈现 `RU-2026-001 Ozon rFBS 场景 #1`；Project A 场景数=1，B=0；全局键 65 未变；截图 `r1-1-ozon-calc-embedded.png`, `r1-1-ozon-scenario-saved.png` |
| **R1.2** | 真实父页面 WB 核算与保存闭环 | 真实 `ProjectDetailPage` 挂载，点击成本 Tab，点击「使用 WB 核算」，进入单订单核算，填入采购成本 42，勾选人工确认，点击保存方案 | 写：`t6.costScenario.<id>`, `t6.project.A` | `verified_shared_behavior` | 核算器自动关闭，列表呈现 WB 订单场景（带仅测算参考标识）；Project A 场景数=2，B=0；截图 `r1-2-wb-calc-embedded.png`, `r1-2-wb-scenario-saved.png` |
| **R1.3** | 同实例 Props 切换 vs 卸载重挂对比 | 1. 固定 key 仅改 `projectId: A -> B`；<br>2. 变 key 模拟真实路由卸载重挂 | 内存 state 与组件生命周期 | `verified_shared_behavior` | 同实例切换保留父页 `costing` Tab 并刷新 B 的空列表；卸载重挂则重置回 `overview` 概览 Tab；截图 `r1-3-same-instance-props-switch-B.png` |
| **R2.1** | 真实 WB SKU 模板保存 | CalculatorTab 点击「保存为SKU模板」按钮 | 写：`wb-skus-v1` (全局共享) | `verified_shared_behavior` | 真实触发 UI 点击，trace 捕获 `set wb-skus-v1`；弹窗提示已保存为 SKU 模板 |
| **R2.2** | 真实 WB 费率重置 | TariffTab 点击「重置默认」按钮并确认 | 写：`wb-tariffs-v1` (全局共享) | `verified_shared_behavior` | 真实触发 UI 点击与 confirm 接受，trace 捕获 `set wb-tariffs-v1` |
| **R2.3** | 真实 WB 订单 CSV 导入与删除 | OrdersTab 真实上传合成 CSV，并在表格中点击删除按钮 | 写：`wb-orders-v1` (全局共享) | `verified_shared_behavior` | 文件选择器导入触发写入 1 单，点击垃圾桶删除写回空列表；截图 `r2-wb-orders-real-import.png` |
| **R2.4** | WB 设置主动编辑动作评估 | 审查设置表单控件 | (无控件) | `not_applicable` | 源码 `WBCalc.jsx:68` 未向任何子组件传递 `saveSettings`，界面无输入控件，如实标 `not_applicable`，不伪造写入 |
| **R3.1** | 独立 persistSet 失败观测 | 模拟存储配额超限，修改输入框参数 | 写入抛错被捕获 | `issues_found` (依赖底层抛错) | 输入框内容 88 完整保留，`pageerror` 捕获到 `QuotaExceededError` |
| **R3.2** | 真实父页面场景保存失败与提示可见性 | 模拟 T6 锁失败，点击保存方案 | 真实父页 `saveOzonScenario` 抛错 | `issues_found` (错误提示不可见缺陷) | 核算器未被意外关闭，输入 115 完整保留；但 `costing` Tab 下看不到 notice，切换回 `overview` 才能看到 `T6_BACKEND_LOCKED` 提示；截图 `r3-save-error-notice-in-overview.png` |
| **R4** | 跨项目隔离与故障注入敏感度 | 1. 正常模式 Project A 保存场景；<br>2. 故障注入模式模拟跨项目串写 | 写：`t6.costScenario.*` | `verified_shared_behavior` / `fault_injection_caught` | 正常模式断言 `r4ScenariosB.length === 0` 达成 (退出码 0)；故障注入模式比较断言敏锐抛出 `1 !== 0` (退出码 1) |

---

## 3. 确诊缺陷与产品建议 (Confirmed Bugs & Proposals)

### 缺陷 1：空白预填回退继承历史商品采购成本（`confirmed_unexpected_fallback`）
- **现象**：新立项商品在立项时没有核定采购成本（`prefill.purchaseCost === ''`），`OzonCalc.jsx:105` 调用 `mergeTrustedPrefill(base, prefill)` 时，由于 `base` 读取自全局 `shipping-calc-rfbs-v2`，导致新商品自动填充了上一个独立核算商品的采购成本（如 65 元）。
- **已有缓解措施**：`ProjectDetailPage` 与 `OzonCalc` 包含前置人工确认复选框（`costConfirmed`），未勾选前保存按钮严格禁用（`disabled`）。
- **建议**：**严禁建议将缺失成本字段直接置空或清零**（因为引擎内部 `Number(value) || 0` 会将 0 当作零成本并算出虚假超高利润率）。应由产品裁决在项目模式下将 `base` 的采购成本明确标记为 `null` / `UNKNOWN`，并在界面上要求必须显式录入后方可试算。

### 缺陷 2：`costing` Tab 下保存失败错误提示不可见（`confirmed_ui_visibility_defect`）
- **现象**：`ProjectDetailPage.jsx:417` 将 `{notice && <div ...>{notice}</div>}` 仅放在了 `{tab === 'overview' && (...)}` 代码块中。当用户在 `tab === 'costing'` 打开核算器保存失败时，虽然父页面的 `catch (e)` 执行了 `refresh(e.message)`，但由于当前不在概览 Tab，用户在界面上**完全看不到任何错误文字**。
- **建议**：将 `notice` 提示提升到 `ProjectDetailPage` 顶层公共容器或在核算抽屉标题栏下方统一渲染，确保在任何 Tab 下发生异常时用户均能得到清晰可见的反馈。

### 缺陷 3：Tab 切换与组件卸载导致未保存输入丢失（`data_loss`）
- **现象**：在项目模式下单品测算无草稿机制。用户在测算器中输入的数据，一旦误点击概览 Tab 或多规格对比 Tab，组件即被卸载，未保存输入立即丢失。
- **建议**：在组件卸载或 Tab 切换时增加轻量未保存脏检查确认弹窗。

---

## 4. 交付文件清单与哈希校验

| 文件路径 | 说明 | 校验状态 |
| :--- | :--- | :--- |
| `docs/ai-handoff/KJ-GEMINI-20260921-006/run-revision-costing-tests.mjs` | 修订版自动化测试套件（修复定位器与真实 UI 操作） | 已执行，正常退出 0，故障退出 1 |
| `docs/ai-handoff/KJ-GEMINI-20260921-006/evidence/revision-normal/` | 正常模式完整证据（含结果 json、pageerror、trace 与 7 张全流程截图） | 完整留存，无覆盖 Codex 证据 |
| `docs/ai-handoff/KJ-GEMINI-20260921-006/evidence/revision-fault/` | 故障注入模式独立证据（含断言捕获结果与 trace） | 完整留存，退出码 1 命中比较断言 |
| `docs/ai-handoff/KJ-GEMINI-20260921-006/FINDINGS.md` | 更新后的发现与风险清单（修正行号与归属，补充缓解措施与新缺陷） | 已校正 |
| `docs/ai-handoff/KJ-GEMINI-20260921-006/WRITE_MATRIX.md` | 更新后的读写隔离矩阵（修正逐实体键名与 not_applicable 动作） | 已校正 |
| `docs/ai-handoff/KJ-GEMINI-20260921-006/tests.json` | 完整测试证据记录（清晰区分 execution_status, assertions_status, business_verdict） | 已更新 |
| `BASELINE.json` (28 个关键生产与测试文件) | SHA256 完整性核验 | **0 差异 ( verified_clean_0_mismatches )** |

---

## 5. 声明与后续

本轮补验所有测试均在本地内存存储与隔离无头浏览器中进行，未修改任何生产源码、配置文件或生产数据库，未连接外部生产服务，未执行上线部署。所有补验缺口已完全闭合，任务状态已就绪供独立复核。
