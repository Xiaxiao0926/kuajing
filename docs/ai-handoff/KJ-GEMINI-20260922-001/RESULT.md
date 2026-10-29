# KJ-GEMINI-20260922-001 验收与交付报告

- **任务编号**：`KJ-GEMINI-20260922-001`
- **任务目标**：项目详情保存反馈可见性与通知归属最小本地修复（`ProjectDetailPage.jsx`）
- **执行模型**：Gemini
- **验收模型**：Codex
- **提交时间**：2026-09-22
- **任务状态**：`review_ready`
- **部署状态**：`not_deployed`（生产访问、部署、数据迁移均未授权）
- **Git HEAD**：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`

---

## 一、修改范围与基线审计

### 1. 唯一生产修改文件
- **目标文件**：[`ozon-react/src/components/t6/ProjectDetailPage.jsx`](file:///D:/ozon/ozon-react/src/components/t6/ProjectDetailPage.jsx)
- **初始 SHA256**：`83adf484de082dba76b053bb3840fbc62cef8985154499473dde34aa99d7ede7`
- **最终 SHA256**：`d2721e6adb795076af9c46e182a7753cadb547b93da033218a31369fa7288daf`
- **增量 diff 副本**：[`docs/ai-handoff/KJ-GEMINI-20260922-001/evidence/ProjectDetailPage.task-incremental.diff`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260922-001/evidence/ProjectDetailPage.task-incremental.diff)

### 2. 28 个基线冻结文件完整性核验
严格核对 `docs/ai-handoff/KJ-GEMINI-20260921-006/BASELINE.json` 中列举的 28 个关键生产与测试文件：
- **目标修改文件**：`ozon-react/src/components/t6/ProjectDetailPage.jsx`（仅包含任务书明确要求的最小可见性与归属修复，无其他逻辑变更）；
- **其余 27 个文件**：SHA256 哈希 100% 严格吻合，**0 意外漂移，0 业务计算修改，0 数据结构变更**。

---

## 二、修改细节说明

按照任务书限制，在 `ProjectDetailPage.jsx` 中实施了如下最小变更：
1. **通知状态绑定项目归属（Notice Ownership）**：
   - 将原未绑定项目 ID 的 `const [notice, setNotice] = useState('')` 调整为：
     ```javascript
     const [noticeState, setNoticeState] = useState({ projectId: null, text: '' })
     const notice = noticeState.projectId === projectId ? noticeState.text : ''
     const setNotice = (msg) => setNoticeState({ projectId, text: msg || '' })
     ```
   - 当组件实例保持挂载、直接切换 `projectId` 时，由于 `noticeState.projectId !== projectId`，旧项目的 notice 会立即自动隐匿，杜绝跨项目继承脏通知。
2. **通知节点提升至全 Tab 共享顶层（Single Shared Location）**：
   - 将原位于第 417 行、深嵌在 `{tab === 'overview' && (...)}` 内部的 `{notice && <div ...>{notice}</div>}` 彻底移除；
   - 移至 `<div className="p-5">` 容器顶部（所有 Tab 内容渲染之前），使 `overview`、`costing`、`product`、`suppliers`、`compliance`、`operations` 均能直接看到 notice，且全页面任何时刻严格仅渲染一份通知；
   - 当 `notice` 为空时，表达式评估为 falsy，不渲染任何 DOM 空节点。
3. **样式、可访问性与响应式断词（Accessibility & Responsive）**：
   - 沿用设计系统既有标准字号与色值：`text-xs text-workspace-text-secondary mb-4`；
   - 添加无障碍语义属性：`role="status"` 与 `aria-live="polite"`，便于辅助技术感知通知；
   - 添加 `break-words break-all`，确保超长极端错误标识符（如长 trace ID、异常类名）在 390px 移动端窄屏下正常折行，不撑大容器、不产生横向滚动；
   - 在主 Surface 添加 `min-w-0`，杜绝 CSS Grid 1fr 轨道在窄屏下的最小宽度溢出。

---

## 三、TASK.md §验收 6 项用例逐项验证

| # | 验收项 | 测试执行动作 | 判定结果 | 证据产物 |
|---|---|---|:---:|---|
| **1** | **Ozon/WB 保存失败可见性与状态保护** | 打开 Ozon/WB 核算器，采购成本填入 115，勾选人工确认，注入并发保存失败 (`T6_BACKEND_LOCKED`)，点击保存方案 | **PASSED** | 错误信息在当前 `costing` 页即刻直接展示；输入 115 完好保留；确认复选框保持勾选；核算器未虚假关闭；T6 实体前后 0 变动；截图 `s1-ozon-save-failure-in-costing.png`、`s2-wb-save-failure-in-costing.png` |
| **2** | **原位重试成功闭环与落库载荷核实** | 移除错误注入，不切页直接再次点击「保存此方案到项目」 | **PASSED** | 核算器正常自动关闭；costing 页展示成功提示；当前项目 A 场景数恰好 +1，落库 scenario payload 中实际采购成本严格为 `115`；Project B 场景数保持为 0；截图 `s1-ozon-save-success-in-costing.png`、`s2-wb-save-success-in-costing.png` |
| **3** | **全 Tab 覆盖、无空通知、最新覆盖旧条目** | 遍历切换至 6 个 Tab；切换至无通知项目；连续触发两次生命周期动作 | **PASSED** | 6 个 Tab 均可见 notice 且全页 `[role="status"]` 数量严格为 1；无 notice 时 `[role="status"]` 数量为 0；连续触发时最新消息完全覆盖旧消息，无拼接累加 |
| **4** | **跨项目切换通知归属隔离 (A $\to$ B)** | A 项目存在 notice 时，分别测试同实例 Props 切换（不变 key）与真实导航经列表卸载重挂（`onBack`） | **PASSED** | 两种边界下 Project B 均不展示 Project A 的旧 notice (`count === 0`)；B 项目设置通知不污染 A |
| **5** | **响应式视口、长错误换行与无障碍** | 注入 170 字符无空格极端长错误，在 390px、768px、1440px 视口测试盒模型与辅助技术 | **PASSED** | 390px 下 notice 宽度 332px，自动换行无横向滚动条；未遮挡 Tab 栏与按钮；`role="status"`、`aria-live="polite"` 齐全；键盘 Tab 键可聚焦页面控件；截图 `s5-viewport-mobile-390-long-error.png` 等 |
| **6** | **未确认前保存按钮 disabled** | 打开 Ozon/WB 核算器，未勾选人工确认前检查按钮状态 | **PASSED** | 按钮属性 `disabled === true`，勾选后变为 `enabled` |

---

## 四、测试执行与回归数据汇总

```text
========================================================================================
测试项                                  命令                                  退出码  结果
----------------------------------------------------------------------------------------
1. 专项单测与静态契约                   node tests/ia-project-notice.test.mjs    0    PASSED (6 项断言全部通过)
2. 真实浏览器端到端组件验收             node run-notice-visibility-tests.mjs     0    PASSED (S1 ~ S5 全闭环)
3. 既有全量回归套件                     npm test                                 0    PASSED (React 65 + Py 44 全绿)
4. 黄金业务案例集                       npm run test:golden                      0    PASSED (76 黄金用例全绿)
5. React vs Python 双端对拍             npm run test:sync                        0    PASSED (16 重量 + 2 版本零差异)
6. 28 个基线文件完整性核验              node --input-type=module -e ...          0    PASSED (27 纯净，1 预期变更)
========================================================================================
```

### 异常与控制台日志分类审计
- **页面未处理异常 (`pageerror`)**：`0`
- **非预期控制台报错 (`console.error`)**：`0`
- **WB 线路下拉框既有 duplicate key 警告**：`20`（源自既有线路数据源内部重复 key，已精确分类并记录，未全局压制）

---

## 五、交付凭据索引

所有测试凭据、trace 与截图已完整归档于 [`docs/ai-handoff/KJ-GEMINI-20260922-001/evidence/`](file:///D:/ozon/docs/ai-handoff/KJ-GEMINI-20260922-001/evidence/)：
1. **截图**：
   - `s1-ozon-save-failure-in-costing.png`（Ozon 保存失败在成本页直接展示错误，输入 115 与确认状态保留）
   - `s1-ozon-save-success-in-costing.png`（Ozon 原位重试保存成功，核算器关闭，场景列表与成功提示同屏呈现）
   - `s2-wb-save-failure-in-costing.png`（WB 保存失败在成本页直接展示错误）
   - `s2-wb-save-success-in-costing.png`（WB 原位重试保存成功）
   - `s5-viewport-mobile-390-long-error.png`（390px 移动端视口超长错误文本折行，无横向溢出，无按钮遮挡）
   - `s5-viewport-tablet-768-long-error.png`（768px 平板视口）
   - `s5-viewport-desktop-1440-long-error.png`（1440px 桌面视口）
2. **数据日志**：
   - `test-results.json`（结构化场景执行结果）
   - `persist-call-trace.json`（测试期间全部存储读写追踪，共 839 KB）
   - `observed-console.json`（全部控制台消息）
   - `observed-page-errors.json`（页面异常，为空数组 `[]`）
   - `target-metadata.json` 与 `ProjectDetailPage.task-incremental.diff`（源码增量对比凭据）

---

## 六、已知遗留问题与边界说明

本任务仅严格限定修复通知可见性与项目归属，以下问题按任务书要求保留为已知限制，未顺带修改：
- **P1 采购成本历史预设继承**：候选商品无出厂价时回退继承独立模式历史预设（65 元）；
- **P1 切页草稿丢失**：在核算器未保存状态下切换 Tab 或退出详情页，局部输入未持久化并丢失；
- **P1 同实例 Props 切换预填残留**：核算器展开状态下同实例切换 `projectId` 会沿用旧项目的售价与重量（生产导航经列表卸载重挂已避免此路径）。
