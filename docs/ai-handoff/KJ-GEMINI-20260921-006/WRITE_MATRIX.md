# 独立核算与项目核算读写隔离验证矩阵 (WRITE MATRIX)

> **任务标识**：KJ-GEMINI-20260921-006 (Revision 002)  
> **基线 Commit**：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`  
> **测试环境**：Headless Chrome + Playwright + Esbuild 专用隔离插件 + 纯内存 Persist 替身 + 合成稳定汇率 (12.5 RUB/CNY)  
> **状态分类定义**：
> - `verified_shared_behavior`：已验证的系统预期共享行为或隔离防护（符合设计或正常运行）。
> - `confirmed_unexpected_write` / `confirmed_data_loss`：经测试确认的意外写入或数据丢失缺陷。
> - `confirmed_ui_visibility_defect`：经测试确认的界面错误提示或关键状态不可见缺陷。
> - `potential_risk`：技术实现上存在隐患，但暂未破坏主业务逻辑。
> - `needs_decision`：属于业务预期未明的共享行为，需产品/业务方裁决是否保留或隔离。
> - `not_applicable`：经源码核验当前界面不存在对应控件或操作，如实记录，绝不伪造。

---

## 读写矩阵明细表

| 序号 | 入口 / 组件 | 运行模式 | 触发操作 / 场景 | 读取键名 (Read Keys) | 写入键名 (Write Keys) | 数据归属 | 判定状态 | 关键证据与断言 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | `OzonCalc` (SingleTab) | 独立核算 | 初次挂载加载界面 | `shipping-calc-rfbs-v2` | (无写入) | 全局共享 | `verified_shared_behavior` | 读取到默认预设，UI 正确渲染；截图 `scenario-1-standalone-ozon-initial.png` |
| **02** | `OzonCalc` (SingleTab) | 独立核算 | 用户主动编辑采购成本/售价等参数 | (无) | `shipping-calc-rfbs-v2` | 全局共享 | `verified_shared_behavior` | 触发 `persistSet('shipping-calc-rfbs-v2', ...)`，采购成本更新为 65，售价更新为 6200；`write-trace.log` 序列 1-2 |
| **03** | `OzonCalc` (SingleTab) | 独立核算 | 组件卸载（退出）并重新挂载（重开） | `shipping-calc-rfbs-v2` | (无写入) | 全局共享 | `verified_shared_behavior` | 采购成本成功从持久化存储恢复为 65 (`recoveredCost === '65'`)；截图 `scenario-1-standalone-ozon-modified.png` |
| **04** | `ProjectDetailPage` + `OzonCalc` | 项目核算 (Project A) | 从真实项目详情页打开 Ozon 单品核算 | `shipping-calc-rfbs-v2` (作为 base 回退) | (无写入) | 混合：快照预填 + 全局回退 | `needs_decision` | `mergeTrustedPrefill` 将候选快照价格 (2800)、重量 (0.35) 载入；但空白采购成本回退到了全局历史值 65！截图 `r1-1-ozon-calc-embedded.png` |
| **05** | `OzonCalc` (SingleTab) | 项目核算 (Project A) | 用户在项目内编辑采购成本 (65 -> 95) | (无) | **严格无写入** (防穿透生效) | React 内部临时 State | `verified_shared_behavior` | `isProjectMode` 守卫生效，`persistCallTrace` 中零 `shipping-calc-rfbs-v2` 写入；`s2ProjectEditWrites.length === 0` |
| **06** | `ProjectDetailPage` + `OzonCalc` | 项目核算 (Project A) | 勾选人工确认并点击“保存此方案到项目” | React 内部 state | `t6.costScenario.<id>`, `t6.project.<A.id>`, `t6.log.<id>` | **严格限定项目 A** | `verified_shared_behavior` | 执行真实 `saveOzonScenario`：核算器自动关闭 (`setOzonContext(null)`)，成本列表刷新出现新场景；Project A 场景数=1，B=0；全局键 65 未变；截图 `r1-1-ozon-scenario-saved.png` |
| **07** | `OzonCalc` (SingleTab) | 项目核算 (Project B) | 快速切换至项目 B 核算 | `shipping-calc-rfbs-v2` (base) | (无写入) | 严格限定项目 B | `verified_shared_behavior` | 价格载入 B 的 9800，重量载入 4.8；采购成本回退全局 65，完全未受项目 A 的 95 污染；截图 `scenario-2-project-B-ozon.png` |
| **08** | `ProjectDetailPage` | 项目核算 (真实路由卸载重挂 vs 闭合状态同实例切) | 1. 真实路由导航经由列表卸载重挂<br>2. 闭合状态同实例仅切换 `projectId: A -> B` | 内存 state 与组件生命周期 | (无写入) | 渲染与生命周期 | `verified_shared_behavior` | 真实路由导航因 unmount/remount 默认重置回概览 Tab；闭合状态同实例 props 切换保持在 `costing` Tab 并刷新呈现 B 的空列表；截图 `r1-3-same-instance-props-switch-B.png` |
| **09** | `OzonCalc` (MultiTab) | 项目核算 (Project A) | 在项目内点击顶部“多规格对比” Tab | `product-pricing-v2` | (无写入) | 全局共享 (无项目归属) | `needs_decision` | `MultiTab` 顶层无项目上下文标识 (RU-2026-001 未渲染)；读取全局多规格预设；截图 `scenario-3-project-A-multi-tab.png` |
| **10** | `OzonCalc` (MultiTab) | 项目核算 (Project A) | 在多品中修改公共费率或添加 SKU | (无) | `product-pricing-v2` | 全局共享 | `needs_decision` | 实时触发 `persistSet('product-pricing-v2', ...)`；切换至独立核算多品查看数据完全一致；`write-trace.log` 序列 3 |
| **11** | `WBCalc` | 独立核算 | 初次挂载 WBCalc | `wb-settings-v1` (如果空) | `wb-settings-v1` | 全局共享 | `verified_shared_behavior` | `useState` 初始化及模式迁移，写入默认设置与固定汇率 12.5；`write-trace.log` 序列 4 |
| **12** | `WBCalc` | 独立核算 | 汇率服务推送汇率变动 (12.5 -> 13.15) | (无) | `wb-settings-v1` | 全局共享 | `verified_shared_behavior` | `useEffect` 监听汇率变化自动同步更新 `wb-settings-v1` 中的 `rubPerCny` 与时间戳；`write-trace.log` 序列 5 |
| **13** | `WBCalc` | 独立/项目 | 用户主动编辑 settings 中的阈值或费率设置 | (无控件) | (无写入) | (不适用) | `not_applicable` | 源码 `WBCalc.jsx:68` 声明了 `saveSettings` 但未传给任何子 Tab，界面无任何 settings 编辑表单；所有写入均为自动触发，如实记录不适用 |
| **14** | `WBCalc` | 项目核算 (Project A) | 在项目模式下挂载 WBCalc | `wb-settings-v1` | `wb-settings-v1` | 全局共享 | `potential_risk` | 挂载即触发 settings 写入（重复写入已存在设置）；在项目模式下依然无差别执行；`write-trace.log` 序列 6 |
| **15** | `CalculatorTab` (WB) | 项目核算 (Project A) | 编辑单订单计算输入 (重量/售价等) | (无) | **严格无写入** (防穿透生效) | React 内部临时 State | `verified_shared_behavior` | `persistCallTrace` 零写入，输入仅存于组件局部 state |
| **16** | `ProjectDetailPage` + `WBCalc` | 项目核算 (Project A) | 勾选人工确认并点击“保存此方案到项目（不可变成本场景）” | React 内部 state | `t6.costScenario.<id>`, `t6.project.<A.id>`, `t6.log.<id>` | **严格限定项目 A** | `verified_shared_behavior` | 执行真实 `saveWbScenario`：核算器自动关闭 (`setWbContext(null)`)，成本列表显示 WB 订单场景（带仅测算参考标识）；Project A 场景数=2，B=0；截图 `r1-2-wb-scenario-saved.png` |
| **17** | `CalculatorTab` (WB) | 真实项目模式 (ProjectDetailPage) | 在真实项目详情页中点击“保存为SKU模板” | React 内部 state | `wb-skus-v1` | 全局共享 SKU 主库 | `verified_shared_behavior` | 项目模式内真实触发 UI 点击，写入全局 `wb-skus-v1`，Project B 场景数严格保持为 0，零数据污染 |
| **18** | `OrdersTab` (WB) | 真实项目模式 (ProjectDetailPage) | 在真实项目详情页导入订单 CSV 并删除 | 上传的 CSV 文件 | `wb-orders-v1` | 全局共享业务中心 | `verified_shared_behavior` | 项目模式内文件选择器上传合成 CSV 触发写入 1 单，点击垃圾桶删除写回空列表；Project B 保持 0 场景 |
| **19** | `TariffTab` (WB) | 真实项目模式 (ProjectDetailPage) | 在真实项目详情页点击“重置默认”费率 | 内置常量 `DEFAULT_TARIFFS` | `wb-tariffs-v1` | 全局共享费率 | `verified_shared_behavior` | 项目模式内真实点击“重置默认”并确认弹窗，触发 `persistSet('wb-tariffs-v1', DEFAULT_TARIFFS)`；Project B 保持 0 场景 |
| **20** | `ProjectDetailPage` + `OzonCalc` | 项目核算 (保存失败重试 - 路径 A) | 保存失败 (115) 后**原地未切页直接重试** | React 内部 state | `t6.costScenario.<id>`, `t6.project.<A.id>` | **严格限定项目 A** | `verified_shared_behavior` | 失败期间输入框 115 完好保留且无未决实体写入，解除错误后原地直接重试保存，**成功将用户填写的 115 持久化入库** (`savedCost === 115`) |
| **21** | `ProjectDetailPage` + `OzonCalc` | 项目核算 (保存失败重试 - 路径 B) | 保存失败 (115) 后**切概览查错再切回重试** | `shipping-calc-rfbs-v2` (回退 base) | `t6.costScenario.<id>`, `t6.project.<A.id>` | **严格限定项目 A** | `confirmed_unexpected_write` / `confirmed_data_loss` | 切概览查看错误 notice 后切回 costing，触发组件卸载重挂，输入框 115 静默丢失变回 65；用户重新确认后保存，**实际持久化落库为回退值 65** (`savedCost === 65`) |
| **22** | `ProjectDetailPage` + `OzonCalc` | 项目核算 (合成探针) | **开放核算器状态下的同实例 Props 切换** | Project A prefill (stale) | `t6.costScenario.<id>`, `t6.project.<B.id>` | 跨项目状态泄漏 | `confirmed_unexpected_write` (合成探针) | 保持核算器打开从 A 切换 props 到 B，B 界面错误呈现 A 的售价 2800 与重量 0.35；保存落库为 B 的快照配 A 的数据；审查 `App.jsx` 证实生产导航经列表退出因此此路径不可达；截图 `r4-open-calculator-props-switch-saved-B.png` |
| **23** | `OzonCalc` (SingleTab) | 独立核算 | 首次启动（本地存储完全为空） | (存储为 null) | (无写入) | 安全内置默认值 | `verified_shared_behavior` | 安全加载常量 `SINGLE_DEFAULTS`，采购成本为 35，售价为 5200，无崩溃或 `undefined`；`s7DefaultCost === '35'` |
| **24** | `OzonCalc` (SingleTab) | 独立核算 | 加载缺字段、含自定义未知扩展字段的旧预设 | `shipping-calc-rfbs-v2` | `shipping-calc-rfbs-v2` | 全局共享预设 | `verified_shared_behavior` | 保存时对象展开操作符保留了 `customLegacyTag: "RETAIN_THIS_UNKNOWN_TAG"`；`write-trace.log` 序列 8 |
| **25** | `OzonCalc` | 独立核算 | 模拟 `persistSet` 抛出配额超限异常 | (无) | 写入失败 (抛错) | 异常保护 | `verified_shared_behavior` | `pageerror` 准确捕获底层的 `QuotaExceededError`，输入框内容 (88) 完整保留在 React state 中；解除错误后恢复写入 89 成功持久化 |
| **26** | `ProjectDetailPage` + `OzonCalc` | 项目核算 (Project A) | 模拟 `onSaveScenario` 后端并发锁失败 (`T6_BACKEND_LOCKED`) | (无) | 写入失败 (抛错) | 异常保护与提示缺陷 | `confirmed_ui_visibility_defect` | 真实父页 `saveOzonScenario` 成功捕获异常，核算器未关闭，输入 (115) 完好保留；trace 记录 `t6_set_error` 与尝试值；但由于 `notice` 仅在 `overview` Tab 渲染，`costing` Tab 下无任何可见错误提示！截图 `r3-save-error-notice-in-overview.png` |
| **27** | `ProjectDetailPage` + `OzonCalc` | 故障注入模式 | 模拟跨项目串写漏洞 (`window.__injectCrossProjectCorruption`) | React 内部 state | 跨项目篡改 Project B | 跨项目数据污染 | `fault_injection_caught` (比较断言敏感) | 真实业务比较断言 `assert.equal(r5ScenariosB.length, 0)` 敏锐捕获 Project B 中多出的带有 `CORRUPTED_SCENARIO_INJECTED_FROM_A` 标记的场景并触发 `1 !== 0` 失败退出 (退出码 1) |

---

## 读写键性质分类汇总

1. **严格隔离键（项目专属逐实体键）**：
   - `t6.project.<projectId>`：存储单个项目的主档案，仅关联自己的场景 ID 数组。
   - `t6.costScenario.<scenarioId>`：存储不可变成本场景，严格绑定 `projectId`。在所有正常测试中，Project A 保存绝不污染 Project B。
   - `t6.log.<logId>`：存储项目的审计决策日志。
   - `t6.candidate.<candidateId>` / `t6.snapshot.<snapshotId>`：候选池与评分快照实体。

2. **全局共享业务主数据键（跨项目有意共享）**：
   - `wb-skus-v1`：WB 商品 SKU 主库，设计为全局可复用资产。
   - `wb-tariffs-v1`：WB 跨境物流报价与阶梯费率表。
   - `wb-settings-v1`：系统全局汇率设置、安全阈值与税费策略。
   - `wb-orders-v1`：WB 订单流水与对账总账。

3. **存在范围混淆与待裁决的共享键**：
   - `shipping-calc-rfbs-v2`：本为 Ozon 独立核算单品草稿，但在项目模式下被作为 fallback 继承，导致历史采购价穿透污染新商品核算。
   - `product-pricing-v2`：本为 Ozon 独立核算多规格对比草稿，但在项目模式下直接挂载并全局写入，缺乏项目隔离与作用域说明。

4. **分类监控与已知警告**：
   - 控制台分类捕获到 55 次 WB 线路下拉框产生的 React key 重复警告（`Warning: Encountered two children with the same key`），已单独结构化分类记录，未全局吞没。
