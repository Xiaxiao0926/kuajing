# 执行结果 (Revision 001)

任务 ID：KJ-GEMINI-20260920-001 (Revision 001)  
状态：review_ready  
基线 HEAD / 实际开始 HEAD：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`  
执行范围与开始前已有改动：  
- 仓库存在历史未提交/未跟踪的业务数据与其它功能代码，本轮未予清理、还原或篡改。
- 本轮严格局限于 REVISION-001 允许的生产代码范围：`ProjectCompliancePanel.jsx`、`complianceDraftState.js`、`tests/ia-project-compliance-draft.test.mjs`。
- 本轮执行前已对目标文件进行了 SHA256 核对并备份至 `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/`，首次 Codex 验收证据完好保留未被覆盖。

---

## 实际完成

### 1. R1 修复：项目身份切换草稿彻底隔离与重置 (Project Identity Protection)
- **根本原因排查**：上一版组件内部在 render 阶段执行了 `latestRef.current = { projectId, ... }`，使得 effect 触发时 `prevPid` 已经被预先覆盖为 `nextPid`，导致项目切换分支无法被识别，项目 A 的未保存草稿泄漏进项目 B。
- **状态机制重构**：
  - 在组件中引入独立的状态字段 `const [draftProjectId, setDraftProjectId] = useState(projectId)`，代表当前草稿严格归属的项目 ID。
  - 采用 React 官方“Adjusting state when props change”模式：在 render 阶段判断 `if (draftProjectId !== projectId)`。一旦检测到项目 ID 变更，立即重置全部草稿（`assessmentStatus`、`riskLevel`、`notes`、`standardsText`、`certificationPlan`）、基准（`assessmentBaseline`、`planBaseline`）、冲突标记（`assessmentConflict = false`、`planConflict = false`）、事项编辑状态（`isAddingReq`、`editingReqId`、`editingDraft`、`deletingReqId`）以及通知与错误提示，并将 `draftProjectId` 同步为 `projectId`。
  - 解决 TDZ（Temporal Dead Zone）问题：将所有 `useState` 声明均提升至 render 检查前，避免在项目重置时因变量未声明而触发 `ReferenceError`。
  - 保存事务双重守门：在 `handleSaveAssessment`、`handleSavePlan`、`handleCreateRequirement`、`handleStartEdit`、`handleSaveEdit` 等所有写操作入口前增加 `if (draftProjectId !== projectId)` 防御，一旦发生不匹配立即拦截并设置明确错误信息，杜绝跨项目串写污染 Store。

### 2. R2 修复：同项目外部数据更新在父级重新 render 时可见 (External Update Visibility)
- **消除陈旧缓存**：移除原先带有 `[projectId, tick]` 的 `useMemo` 缓存，在每次 render 阶段直接通过 `const project = projectId ? getProject(projectId) : null` 获取 Store 最新数据。
- **镜像基准与防死循环追踪**：
  - 针对 `getProject()` 每次反序列化返回全新对象引用的特点，引入 `lastExternalRef` 追踪外部传入数据的基准原始字段（`assessmentStatus`、`riskLevel`、`notes`、`standardsText`、`certificationPlan`）。
  - 当父级同 ID 触发重新 render 时，`useEffect` 仅在检测到外部字段确实发生变动时才触发同步更新，有效防止了组件陷入无休止的 re-render 死循环。
  - 区块级同步行为分流：
    - **未编辑区块（Clean）**：自动跟随外部最新数据安全刷新，并同步更新 baseline。
    - **已编辑区块（Dirty）**：严禁静默覆盖用户输入，完好保留用户未保存草稿，准确激活黄色警示横幅提示冲突。
- **边界如实界定**：本轮严格遵守不改造全局 Store 事件总线、不引入后台定时轮询的边界；外部数据变更只有在父级触发重新 render（如页面刷新、父级状态变更、路由重挂载等）时被读取并展示，单纯外部静默变动在无通知/render 的情况下不伪称具备自动感知能力。

### 3. R3 修复：冲突状态动态解除、证据真实性与报告纠偏
- **冲突提示动态消除**：
  - 当外部产生冲突后，若用户在表单中继续编辑草稿，使其内容与外部最新数据一致时，`detectAssessmentConflict` / `detectPlanConflict` 重新求值并自动将冲突状态复位为 `false`，横幅自动消失。
  - 横幅内置「放弃草稿并载入外部数据」按钮：点击时直接从 Store 获取最新外部数据，重置本地草稿与 baseline，同时将 `lastExternalRef` 与冲突标记重置，提供一键解除冲突能力。
- **证据与表述纠偏**：
  - **场景 H**：静态 flex-wrap 与自适应栅格检查全绿，但在本轮报告与 `tests-revision-001.json` 中明确标记为 `not_run`，交由 Codex 独立验收环节在加载完整 CSS 样式的真实浏览器中测量复核，坚决不使用静态字符串伪称通过 390px 布局验收。
  - **场景 D**：在真实测试套件中增加了组件 DOM 级错误容器 `{errorMsg && (...)}` 与 `text-workspace-danger` 类名及跨项目阻断提示验证。
  - **beforeunload 拦截**：如实说明组件已在 dirty 状态下正确注册 `beforeunload` 监听器并在 clean/卸载时注销；如实说明现代浏览器出于防恶意骚扰策略，仅在用户有页面交互后弹出通用确认框，不承诺 100% 拦截且不允许自定义文案；单页应用站内客户端路由跳转拦截属于后续待办，不虚假宣称 100% 绝对拦截。
  - **独立测试日志**：对每条必跑测试命令单独生成独立的 log 文件（`check1 ~ check8`），彻底纠正之前多个命令指向单一日志的缺陷。

---

## 改动文件

| 文件 | 变更用途 | 本轮增量与执行前已有改动的区别 |
|---|---|---|
| `ozon-react/src/components/t6/ProjectCompliancePanel.jsx` | 修复 R1 项目身份切换隔离、R2 外部更新可见性、R3 冲突复位与放弃重置 | 增量修复 `draftProjectId` 状态守门、移除旧 memo 缓存、增加 `lastExternalRef` 防死循环、完善放弃草稿按钮；未改动已有 UI 栅格与合规档案结构 |
| `ozon-react/src/utils/t6/complianceDraftState.js` | 纯草稿与冲突判断引擎 | 本轮完全保持 pre-rev1 冻结状态，SHA256 零差异 |
| `tests/ia-project-compliance-draft.test.mjs` | 专项测试套件 | 补全场景 D 的 DOM 级错误容器断言；补全场景 F 的 A->B、B->A 及快速切换断言；补全场景 G 的冲突自动复位断言；将场景 H 如实标记为 `not_run`；新增 PART 4 真实 React 组件 Headless Chrome 自动化测试 |
| `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/codex-runtime-review.mjs` | 真实组件隔离复测驱动 | 复制自 Codex 验收脚本，仅适配执行目录相对路径与独立输出路径，断言与测试用例 100% 保持一致 |
| `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/test-scenarios.mjs` | 本地真实组件场景驱动脚本 | 用于在 Headless Chrome 环境验证真实组件 A/B/C/F/G 的交互 |
| `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/*.log` | 单独命令执行原始日志 | 8 个命令的独立执行日志，退出码均为 0 |
| `docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/manifest.json.pre-build` | 构建前业务清单副本备份 | 用于构建后安全还原，避免使用 git restore 破坏工作区历史改动 |

---

## 验证

### 1. 真实组件 Headless Chrome 自动化验收复测
运行 `node docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/codex-runtime-review.mjs`，执行结果已独立记录在 `evidence/revision-001/codex-runtime-review.json` 中：
```json
{
  "scope": "Isolated real React integration, no CSS/layout acceptance and no production writes",
  "cases": [
    {
      "name": "A: saving assessment preserves plan",
      "passed": true
    },
    {
      "name": "B: saving plan preserves assessment",
      "passed": true
    },
    {
      "name": "F: same component switching A to B",
      "passed": true,
      "notesAfterSwitch": "B ORIGINAL",
      "savedB": "B ORIGINAL",
      "expected": "B ORIGINAL"
    },
    {
      "name": "G: external Store change plus parent rerender",
      "passed": true,
      "externalPlan": "EXTERNAL PLAN",
      "conflictCount": 1
    }
  ]
}
```
- **F 项（A -> B 切换）**：从首次 Codex 验收的 `passed: false`（读取到 A 的草稿）彻底变为 `passed: true`，B 准确显示自身的值 `B ORIGINAL`，且保存 B 后未对 A 造成任何串写污染。
- **G 项（外部 Store 更新 + 父级重新 render）**：从首次 Codex 验收的 `passed: false`（`conflictCount: 0`）彻底变为 `passed: true`，干净的 Plan 自动刷新为 `EXTERNAL PLAN`，脏的 Assessment 准确提示冲突（`conflictCount: 1`）。
- 脚本退出码：`0`。

### 2. 全部必跑命令执行记录

| 检查项 | 命令 | 退出码 | 结论 | 独立证据日志 |
|---|---|---|---|---|
| 专项草稿保护测试（含真实组件） | `node tests/ia-project-compliance-draft.test.mjs` | 0 | PASSED | `evidence/revision-001/check1-draft-test.log` |
| 07A-4B 合规档案与事项测试 | `node tests/ia-project-compliance.test.mjs` | 0 | PASSED (32/32) | `evidence/revision-001/check2-compliance-test.log` |
| 07A-4C2 合规门禁求值器测试 | `node tests/ia-project-compliance-gate.test.mjs` | 0 | PASSED (49/49) | `evidence/revision-001/check3-gate-test.log` |
| 全量工程自动化测试 | `npm test` | 0 | PASSED | `evidence/revision-001/check4-npm-test.log` |
| 黄金业务案例测试 | `npm run test:golden` | 0 | PASSED | `evidence/revision-001/check5-golden-test.log` |
| 双端对拍基准测试 | `npm run test:sync` | 0 | PASSED | `evidence/revision-001/check6-sync-test.log` |
| 前端生产构建测试 | `npm --prefix ozon-react run build` | 0 | PASSED | `evidence/revision-001/check7-build.log` |
| Codex 真实组件独立验收复验 | `node docs/ai-handoff/.../codex-runtime-review.mjs` | 0 | PASSED (4/4) | `evidence/revision-001/check8-codex-review.log` |
| 场景 H 移动端真实 CSS 排版 | 手动 / 带样式浏览器测量 | null | **not_run** | 记录于 `check1-draft-test.log`，待 Codex 补验 |

### 3. 工作区安全与 manifest.json 还原
- 构建前执行记录：通过 `Get-FileHash ozon-react/public/data/manifest.json` 测得 SHA256 为 `FCBCF0F24FD9ABFD6E91718FF58BB059E3EA9B023EEE6F1314B3AFC2BEF88998`，备份至 `evidence/revision-001/manifest.json.pre-build`。
- 构建后执行记录：构建完成后使用预备份副本精准覆盖还原，避免调用 `git restore` 清理他人可能存在的脏工作区内容；还原后重新计算哈希完全一致，工作区零多余修改。

---

## 未完成与风险

1. **场景 H 移动端实际像素排版未在全站 CSS 下运行**：
   - 静态 flex-wrap 与自适应栅格契约已全绿，但在本无样式隔离环境中未执行桌面及 390px 视口无溢出视觉测量，按规范明确标记为 `not_run`，留待 Codex 在带样式环境下补验。
2. **SPA 站内路由级导航未保存提示仍属后续待办**：
   - 当前已完成浏览器原生 `beforeunload` 刷新/关闭窗口提示；单页应用内部切换 Tab 或跳转项目详情的软导航拦截，按原任务契约需在顶层路由体系升级中统一支持，当前未越界修改路由。
3. **外部 Store 静默变动无法主动推送**：
   - 当前在父级同 ID 触发重新 render 时能够 100% 安全识别外部变动并隔离冲突；但若外部系统在后台静默修改了 Store 且完全没有触发父级 render，前端目前不会无故轮询检测。

---

## 回滚

若本轮修订需要回滚，可依次执行以下操作恢复至 Revision 001 起点（绝不影响历史已有改动）：

```bash
# 1. 恢复 ProjectCompliancePanel.jsx 至 pre-rev1
Copy-Item docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/ProjectCompliancePanel.jsx.pre-rev1 ozon-react/src/components/t6/ProjectCompliancePanel.jsx

# 2. 恢复 ia-project-compliance-draft.test.mjs 至 pre-rev1
Copy-Item docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/ia-project-compliance-draft.test.mjs.pre-rev1 tests/ia-project-compliance-draft.test.mjs

# 3. 移除 revision-001 生成的临时日志与测试驱动
Remove-Item docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/*.log
Remove-Item docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/test-scenarios.mjs
Remove-Item docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/codex-runtime-review.mjs
Remove-Item docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/codex-runtime-review.json
Remove-Item docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/manifest.json.pre-build
Remove-Item docs/ai-handoff/KJ-GEMINI-20260920-001/evidence/revision-001/ProjectCompliancePanel.jsx.diff
Remove-Item docs/ai-handoff/KJ-GEMINI-20260920-001/RESULT-REVISION-001.md
Remove-Item docs/ai-handoff/KJ-GEMINI-20260920-001/tests-revision-001.json
```

---

## 部署

本任务未部署，未操作生产。

---

## 下一步建议（非授权）

建议等待 Codex 独立验收 Revision 001 结果：
1. 若验收通过，建议按 `docs/ai-handoff/README.md` 的后续候选顺序进入“认证适用性合同修订”：
   - 明确 Store 变化字段（如 `applicability` / `certificationPlan` 结构）；
   - 兼容老项目的默认值处理；
   - 梳理合规评估依据与上架门禁放行条件；
   - 待合同与测试用例冻结并获得授权后再推进编码。
2. 保持对利润计算公式、业务数据及跨端对拍核心的绝对只读保护。
