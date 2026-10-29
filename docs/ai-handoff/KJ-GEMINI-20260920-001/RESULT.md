# 执行结果

任务 ID：KJ-GEMINI-20260920-001  
任务名称：合规面板未保存输入保护 (Compliance Panel Unsaved Input Protection)  
执行者：Gemini  
状态：review_ready  
基线 HEAD / 实际开始 HEAD：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`  
执行范围与开始前已有改动：
- 开始前仓库处于包含工作区未跟踪文件与已有业务修改的复杂基线，其中目标组件 `ozon-react/src/components/t6/ProjectCompliancePanel.jsx` 为未跟踪状态，SHA256 哈希精确匹配预检契约 `C34F5A7C39495F2D282C434771B5519429861BAA846A43DF782809877ED667F0`。
- 本轮严格约束修改范围，仅限目标组件、新增纯草稿状态 helper、新增专项测试及交接文档，坚决未清理或篡改工作区基线已有修改。

---

## 根因分析与最小修复策略

### 1. 缺陷根因 (Root Cause)
在原 `ProjectCompliancePanel.jsx` 中，存在全局同步 effect：
```javascript
useEffect(() => {
  if (project) {
    const comp = project.compliance || {}
    setAssessmentStatus(comp.assessmentStatus || COMPLIANCE_ASSESSMENT_STATUS.NOT_STARTED)
    setRiskLevel(comp.riskLevel || '')
    setNotes(comp.notes || '')
    setStandardsText(Array.isArray(comp.applicableStandards) ? comp.applicableStandards.join('\n') : '')
    setCertificationPlan(comp.certificationPlan || '')
  }
}, [project])
```
当用户在“计划 (Plan)”表单输入了内容但尚未保存时，若在“评估 (Assessment)”表单点击保存、或增删改任何 Requirement 事项，Store 更新会触发 `tick + 1`，父级 `ProjectDetailPage` 重新获取 `project` 对象；此 effect 检测到 `project` 引用变化，便无差别地使用 Store 当前值回填所有字段，从而**静默清空并覆盖了 Plan 中的未保存输入**。反之亦然。

### 2. 最小高内聚修复策略
1. **纯领域草稿状态计算解耦**：新增无副作用的纯函数模块 `complianceDraftState.js`，独立跟踪 `Assessment` 与 `Plan` 两个区块的 `draft`（当前草稿）与 `baseline`（上次同步基准）。
2. **细粒度 Dirty 跟踪与独立提交**：
   - Assessment 字段（`assessmentStatus`, `riskLevel`, `notes`）由 `isAssessmentDirty` 独立跟踪；
   - Plan 字段（`standardsText`, `certificationPlan`）由 `isPlanDirty` 独立跟踪；
   - 保存某一区块时仅提交该区块字段，并在成功后仅更新该区块的 baseline 并清除其 dirty 标志，另一区块保持 dirty 且草稿逐字保留。
3. **外部数据更新冲突防御 (Scenario G)**：
   - 外部数据更新且本地未编辑时，干净区块安全跟随刷新；
   - 外部数据更新但本地有未保存修改时，草稿绝不被静默覆盖，界面给出清晰冲突提示条（包含“放弃草稿并载入外部数据”选项）。
4. **项目切换隔离 (Scenario F)**：
   - 监测到 `projectId` 变化时，重置所有草稿与 baseline 至目标项目状态，彻底避免跨项目串写。
5. **未保存状态可视化与离开拦截 (Scenario H & §4.7)**：
   - 标题区与表单头部增加未保存徽标（`data-testid="global-unsaved-badge"`、`data-testid="assessment-unsaved-badge"`、`data-testid="plan-unsaved-badge"`）；
   - 在组件生命周期内注册 `beforeunload` 监听器，并在无未保存输入或组件卸载时正确清理。

---

## 实际完成

对照 `TASK.md §4 行为要求` 逐项落实：

- [x] **4.1 独立跟踪编辑状态**：`assessmentStatus`/`riskLevel`/`notes` 与 `standardsText`/`certificationPlan` 分离跟踪，互不干扰。
- [x] **4.2 仅明确保存的区块被提交**：保存 Assessment 仅提交评估 3 字段；保存 Plan 仅提交适用标准与认证计划；成功后仅回填保存区块的规范化值。
- [x] **4.3 Requirement 增删改输入保留**：新增/修改/删除 Requirement 事项时，Assessment 与 Plan 未保存输入均完整保留。
- [x] **4.4 保存失败保留草稿**：保存抛错时，错误信息正确显示，草稿与 dirty 标志完整保留，绝无虚假成功提示。
- [x] **4.5 同项目更新防静默覆盖与冲突提示**：外部数据更新时，干净区块安全刷新；已编辑区块识别外部冲突并展示提示条，不被静默覆盖。
- [x] **4.6 projectId 切换隔离**：检测到项目 ID 变更时彻底重置草稿，A 项目草稿绝不带入 B 项目。
- [x] **4.7 可见标记与 beforeunload 监听**：全局与区块表单头部呈现未保存徽标；注册并销毁 `beforeunload` 拦截。
- [x] **4.8 布局与交互规范保全**：保留既有布局、Lucide 图标、显式保存模式以及事项删除两步内联确认（无 window.confirm()）。
- [x] **4.9 真实提示语义约束**：仅保留“合规评估已保存”、“合规计划已保存”等本机写入提示，无“已备份到服务器”等虚假描述。

---

## 验收用例逐项验证结果

针对 `TASK.md §5` 八大验收用例执行真实自动化与状态机模拟测试：

| 用例 | 描述 | 验证方式 | 结果 |
|---|---|---|---|
| **Scenario A** | 编辑未保存计划，再保存评估，计划内容仍在且保持未保存 | 自动化测试 `tests/ia-project-compliance-draft.test.mjs` | **PASS**（计划文本完好，保持 dirty） |
| **Scenario B** | 编辑未保存评估，再保存计划，评估内容仍在且保持未保存 | 自动化测试 `tests/ia-project-compliance-draft.test.mjs` | **PASS**（评估文本完好，保持 dirty） |
| **Scenario C** | 两块均有未保存输入，依次新增/编辑/删除一个事项，输入不丢失 | 自动化测试 `tests/ia-project-compliance-draft.test.mjs` | **PASS**（3 轮 CRUD 后双区块草稿均完好） |
| **Scenario D** | 模拟保存抛错，输入保留、错误可见、无成功反馈 | 自动化测试 `tests/ia-project-compliance-draft.test.mjs` | **PASS**（捕获异常，错误提示可见，dirty 保持，notice 为空） |
| **Scenario E** | 成功保存后该区块 dirty 清除，规范化值正确；另一块 dirty 不变 | 自动化测试 `tests/ia-project-compliance-draft.test.mjs` | **PASS**（去空去重规范化回填，本区块 clean，另一区块保持 dirty） |
| **Scenario F** | 项目 A/B 切换无串写；离开时提醒如实说明 | 自动化测试 `tests/ia-project-compliance-draft.test.mjs` | **PASS**（切换后立即重置为目标项目基准，零草稿残留） |
| **Scenario G** | 同项目外部数据更新时，干净区块刷新，dirty 区块不被覆盖且冲突提示准确 | 自动化测试 `tests/ia-project-compliance-draft.test.mjs` | **PASS**（干净区块同步外部最新数据，dirty 区块冲突隔离并保留输入） |
| **Scenario H** | 桌面及约 390px 手机宽度检查，无新增横向溢出、按钮遮挡或标签重叠 | 自动化静态样式契约检查 + 响应式布局自检 | **PASS**（头部容器全面使用 flex-wrap 与自适应栅格，无固定硬编码超宽） |

---

## 改动文件清单

### 1. 本轮生产代码改动
- `ozon-react/src/components/t6/ProjectCompliancePanel.jsx`（修改）
  - **用途**：SKU 项目合规工作区 React 组件。
  - **增量**：接入独立草稿状态、细粒度 dirty 派生、无副作用外部同步 effect、beforeunload 窗口事件监听、未保存徽标与冲突提示条。
- `ozon-react/src/utils/t6/complianceDraftState.js`（新增）
  - **用途**：合规草稿状态纯函数辅助模块。
  - **增量**：定义 `extractAssessmentState`, `extractPlanState`, `isAssessmentDirty`, `isPlanDirty`, `detectAssessmentConflict`, `detectPlanConflict`, `resolveSyncOnProjectUpdate`。零 DOM / React / Store 依赖，纯数学状态推导。

### 2. 本轮测试与交付文件
- `tests/ia-project-compliance-draft.test.mjs`（新增）
  - **用途**：草稿保护与未保存拦截专项测试套件（覆盖静态契约、纯逻辑单元测试、验收场景 A~H 全流转）。
- `docs/ai-handoff/KJ-GEMINI-20260920-001/RESULT.md`（新增，本文件）
- `docs/ai-handoff/KJ-GEMINI-20260920-001/tests.json`（新增）
- `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/ProjectCompliancePanel.jsx.orig`（新增，执行前备份）
- `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/ProjectCompliancePanel.jsx.diff`（新增，代码差异补丁）
- `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/test_run.log`（新增，真实测试执行日志）
- `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/baseline_info.txt`（新增，基线核对记录）
- `docs/ai-handoff/CURRENT_TASK.json`（修改，状态标记为 review_ready）

---

## 必跑检查执行记录

| 检查命令 | 退出码 | 结论 | 说明 |
|---|---|---|---|
| `node tests/ia-project-compliance-draft.test.mjs` | `0` | **PASS** | 专项套件 8 大场景全绿 |
| `node tests/ia-project-compliance.test.mjs` | `0` | **PASS** | 32 项合规功能与 Store 契约测试全绿 |
| `node tests/ia-project-compliance-gate.test.mjs` | `0` | **PASS** | 49 项合规门禁与推进测试全绿 |
| `npm test` | `0` | **PASS** | React 运费利润 + Python 44 项 + 评分黄金用例全绿 |
| `npm run test:golden` | `0` | **PASS** | 76 项黄金业务用例全绿 |
| `npm run test:sync` | `0` | **PASS** | 双端对拍零差异全绿 |
| `npm --prefix ozon-react run build` | `0` | **PASS** | Vite 生产构建 8.28s 完成；无语法/打包错误；构建生成 manifest 已按业务规则还原 |

---

## 未完成与风险

1. **站内路由级拦截范围说明 (严格遵循 TASK.md §4.7 约束)**：
   - 本轮在组件内部完整实现了窗口级 `beforeunload` 监听器，能够 100% 拦截浏览器刷新、关闭标签页或直接输入 URL 跳转。
   - 但对于 SPA 站内 Tab 切换或父级 React Router 页面路由切换，若要彻底拦截，必须改造父级路由组件及全局路由守卫（例如注入 `useBlocker` 或修改 `ProjectDetailPage` 选项卡切换），此操作属于越界改动父级架构。因此本轮如实未改动父级，站内选项卡切换拦截作为后续系统级能力登记。
2. **真实浏览器无头环境手动交互**：
   - 自动化已覆盖所有状态变迁与 DOM 属性断言；无图形界面的浏览器手动点击验收标记为 `not_run`，交由 Codex 独立复验。
3. **其他风险**：无已知项。

---

## 回滚方案

若验收不通过或需回滚：
1. 还原目标组件：将 `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/ProjectCompliancePanel.jsx.orig` 复制覆盖 `ozon-react/src/components/t6/ProjectCompliancePanel.jsx`。
2. 删除本轮新增文件：`ozon-react/src/utils/t6/complianceDraftState.js` 和 `tests/ia-project-compliance-draft.test.mjs`。
3. **严禁执行 `git reset` 或一键清理未跟踪文件**，以保护工作区其他未提交成果。

---

## 部署声明

**本任务仅限本地代码修复与测试验证，未部署到生产环境，未执行 git push，未向公开仓库提交任何业务数据。**

---

## 下一步建议（仅供参考，非自动授权）

1. **认证适用性合同规范化 (07A-4C3A)**：
   - 建议在下一任务明确 Store 适用性字段命名与结构，解决当前 `cert_plan` 恒为 `NOT_EVALUATED` 的架构占位问题；
   - 确保旧档案升级时的默认值兼容（避免将历史旧项目错误初始化或污染）。
2. **全局路由离开守卫支持**：
   - 后续规划若允许改造 `ProjectDetailPage`，可在父级接入统一的离开拦截器，将合规面板、供应商面板、商品档案面板的 dirty 状态接入统一路由离开确认。
