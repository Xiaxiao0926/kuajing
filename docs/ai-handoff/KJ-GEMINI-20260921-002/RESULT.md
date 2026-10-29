# 执行结果 (KJ-GEMINI-20260921-002)

- **任务 ID**：KJ-GEMINI-20260921-002
- **任务名称**：合规面板手机布局收尾
- **状态**：`review_ready`
- **基线 HEAD**：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`
- **生产授权**：false
- **部署状态**：`not_deployed`（严格为否）
- **公开验证状态**：`not_performed`

---

## 1. 范围与约束遵守说明

1. **严格限定修改范围**：
   - 仅修改 `ozon-react/src/components/t6/ProjectCompliancePanel.jsx` 中 Section 7 (Requirements) 标题与按钮所在的局部布局容器与必要 className（总变更仅 7 行）。
   - 新增独立几何与视觉测量测试 `tests/ia-project-compliance-layout.test.mjs`。
   - 创建交付文件 `tests.json`、`RESULT.md`、`evidence/` 及更新 `CURRENT_TASK.json` 状态。
2. **输入冻结资产零改动**：
   - 草稿状态核心逻辑 `ozon-react/src/utils/t6/complianceDraftState.js` 哈希保持 `55D4D405516384B5A712EC8A961DBC751E7B5DEE8711FCA312C30EBF0F919053`，100% 保持未改动。
   - 草稿专项测试 `tests/ia-project-compliance-draft.test.mjs` 哈希保持 `CB16BB5149693A938811C130C2920EC362491535577D1D9EDC854BF70DEB3335`，100% 保持未改动。
3. **架构与全局资产零破坏**：
   - 未修改全局 `Button`、`Surface`、全局 CSS、Store、gateEngine、公式、业务数据（xlsx/pdf）或 CI 配置。
   - 未执行 git commit / push，未向公开仓库推送任何内容。
   - **绝对未部署**（`not_deployed`）。

---

## 2. 缺陷根因与修复详情

### 2.1 390px 移动端按钮被挤成逐字竖排根因
在 Section 7 中，原标题行容器为：
```jsx
<div className="mb-3 flex items-center justify-between border-b border-workspace-border pb-2">
  <div>
    <span className="font-semibold text-workspace-text">具体合规核验事项 (Requirements)</span>
    <span className="ml-2 text-xs text-workspace-text-tertiary">
      包含法规、成分、标签、检测与准入要项等核查清单
    </span>
  </div>
  <Button variant="outline" size="sm" onClick={() => setIsAddingReq(true)}>
    <Plus className="mr-1 h-3.5 w-3.5" />
    新增事项
  </Button>
</div>
```
- **挤压机理**：左侧 `<div>` 内标题加副标题说明文字较长，在单行需要占约 510px 宽度。而在 390px 移动视口下（卡片可用宽度仅约 334px），外层容器未设置 `flex-wrap` 与 `gap`，左侧元素强占宽度；右侧 `<Button>` 未声明 `shrink-0` 与 `whitespace-nowrap`，被 flexbox 强行挤压至约 24px 宽，导致汉字“新”、“增”、“事”、“项”发生字符级折行，变成一列四行的逐字竖排。

### 2.2 修复方案 (精准 7 行局部调整)
在 `ozon-react/src/components/t6/ProjectCompliancePanel.jsx` 中应用以下优化：
1. **容器响应式包裹与间距**：将容器 className 改为 `mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-workspace-border pb-2`，确保在极端窄屏下允许整行安全折行，子容器增加 `min-w-0` 防溢出。
2. **副标题说明移动端下沉**：副标题改为 `block text-xs text-workspace-text-tertiary sm:inline sm:ml-2`。在移动端（`< sm`）副标题自然折入标题正下方，使标题区域宽度大幅精简，主行无需过度换行；在桌面端（`>= sm`）依然保持单行内联排列。
3. **按钮防压缩与禁止文字折行**：为 `<Button>` 赋予 `className="shrink-0 whitespace-nowrap"`，确保按钮在任何视口下保持完整的自然内边距与固定单行横排，彻底杜绝文字竖排。

---

## 3. 多视口几何测量与视觉核验

通过基于真实项目 CSS（Tailwind + Autoprefixer）与无头 Chrome 的专项测量套件 `tests/ia-project-compliance-layout.test.mjs`，在 4 种目标视口及 4 种典型业务状态下完成几何量化测量与全页截图。

### 3.1 4 视口几何量化测量数据 (初始状态)

| 视口宽度 | 视口滚动溢出 (scrollWidth vs clientWidth) | “新增事项”按钮尺寸 | 字符排列坐标 (top / left) | 越界交互控件数 | 结论 | 全页截图 |
|---|---|---|---|---|---|---|
| **360px** | 360px / 360px (无溢出) | **92 × 28 px** | 新(1723, 63), 增(1723, 75), 事(1723, 87), 项(1723, 99) | 0 | 纯横向排列，无挤压竖排 | `evidence/layout-360.png` |
| **390px** | 390px / 390px (无溢出) | **92 × 28 px** | 新(1676, 63), 增(1676, 75), 事(1676, 87), 项(1676, 99) | 0 | 纯横向排列，无挤压竖排 | `evidence/layout-390.png` |
| **768px** | 768px / 768px (无溢出) | **92 × 28 px** | 新(1191, 681), 增(1191, 693), 事(1191, 705), 项(1191, 717) | 0 | 纯横向排列，平板端协调 | `evidence/layout-768.png` |
| **1440px** | 1440px / 1440px (无溢出) | **92 × 28 px** | 新(893, 1353), 增(893, 1365), 事(893, 1377), 项(893, 1389) | 0 | 桌面端单行对齐无退化 | `evidence/layout-1440.png` |

> **几何数学证明 (严禁逐字折行)**：
> 在 360px 与 390px 移动端下，“新”、“增”、“事”、“项”4 个汉字的 `top` 坐标完全相同（差值均为 0px），`left` 坐标以 12px 严格递增；按钮高度稳定为 28px（<= 36px 阈值），宽度稳定为 92px（>= 70px 阈值）。字符级几何测量证明未发生任何竖排或异常挤压。

### 3.2 4 种典型业务状态核验 (390px 移动端)

1. **初始状态**：无横向滚动条，各卡片圆角内边距完整，标题与按钮主次分明（截图：`evidence/layout-390.png`）。
2. **双区块 dirty + 外部冲突状态**：Assessment 与 Plan 双冲突横幅文字正常折行，警告图标与操作链接无越界遮挡，无横向溢出（截图：`evidence/layout-390-conflict.png`）。
3. **新增事项表单展开状态**：表单栅格在移动端自适应单列/两列，输入框与选择器宽度占满，确认添加与取消按钮间距适中无挤压（截图：`evidence/layout-390-add-form.png`）。
4. **长事项名与编辑状态**：表格在小屏具备规范的 `overflow-x-auto` 滚动保护，不撑开父级视口，操作栏按钮在视口内平稳交互（截图：`evidence/layout-390-editing.png`）。

---

## 4. 改动代码与输入冻结 SHA256 核验

### 4.1 输入冻结哈希一致性核验

| 文件 | 冻结要求 SHA256 | 本轮实测 SHA256 | 状态 |
|---|---|---|---|
| `ozon-react/src/utils/t6/complianceDraftState.js` | `55D4D405516384B5A712EC8A961DBC751E7B5DEE8711FCA312C30EBF0F919053` | `55D4D405516384B5A712EC8A961DBC751E7B5DEE8711FCA312C30EBF0F919053` | **100% 一致（只读未改）** |
| `tests/ia-project-compliance-draft.test.mjs` | `CB16BB5149693A938811C130C2920EC362491535577D1D9EDC854BF70DEB3335` | `CB16BB5149693A938811C130C2920EC362491535577D1D9EDC854BF70DEB3335` | **100% 一致（只读未改）** |
| `ProjectCompliancePanel.jsx.pre-002` (备份) | `90FF06F35D38D2074609A9D61F3966B2868CF336F52D1193CF0C8C0BF234EE0F` | `90FF06F35D38D2074609A9D61F3966B2868CF336F52D1193CF0C8C0BF234EE0F` | **100% 一致（基线无漂移）** |
| `ozon-react/src/components/t6/ProjectCompliancePanel.jsx` | - | `8D1A4772569CF59050A6C20C2CE59A2AABC7BC0E564F3DD5BCB390982BFCEC41` | 本轮交付哈希 |

### 4.2 本轮改动代码差异 (`git diff --no-index`)
```diff
--- a/ozon-react/src/components/t6/ProjectCompliancePanel.jsx
+++ b/ozon-react/src/components/t6/ProjectCompliancePanel.jsx
@@ -876,8 +876,8 @@
-        <div className="mb-3 flex items-center justify-between border-b border-workspace-border pb-2">
-          <div>
+        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-workspace-border pb-2">
+          <div className="min-w-0">
             <span className="font-semibold text-workspace-text">具体合规核验事项 (Requirements)</span>
-            <span className="ml-2 text-xs text-workspace-text-tertiary">
+            <span className="block text-xs text-workspace-text-tertiary sm:inline sm:ml-2">
               包含法规、成分、标签、检测与准入要项等核查清单
             </span>
           </div>
@@ -887,2 +887,3 @@
               size="sm"
+              className="shrink-0 whitespace-nowrap"
               onClick={() => setIsAddingReq(true)}
```

---

## 5. 必跑验证命令清单与执行结果

所有必跑命令均真实执行，退出码均为 0，独立日志与产物均保存在 `evidence/` 目录：

| 序号 | 检查项 | 命令 | 退出码 | 结果 | 独立日志文件 |
|---|---|---|---|---|---|
| 1 | 合规草稿保护专项测试 (含真实组件端到端) | `$env:CODEX_NODE_MODULES=...; node tests/ia-project-compliance-draft.test.mjs` | 0 | PASSED | `evidence/check1-draft-test.log` |
| 2 | 合规工作区与核心 Store 既有测试 (TASK 07A-4B) | `node tests/ia-project-compliance.test.mjs` | 0 | PASSED (32 组全绿) | `evidence/check2-compliance-test.log` |
| 3 | 合规阶段门禁集成测试 (TASK 07A-4C2) | `node tests/ia-project-compliance-gate.test.mjs` | 0 | PASSED (49 项全绿) | `evidence/check3-gate-test.log` |
| 4 | 全局多端引擎自动化测试 | `npm test` | 0 | PASSED (44 项 Python + 29 项 React + 56 项黄金全绿) | `evidence/check4-npm-test.log` |
| 5 | 黄金业务案例回归测试 | `npm run test:golden` | 0 | PASSED (76 项全绿) | `evidence/check5-golden-test.log` |
| 6 | 双端对拍校验 | `npm run test:sync` | 0 | PASSED (双端零差异) | `evidence/check6-sync-test.log` |
| 7 | React 前端生产构建 | `npm --prefix ozon-react run build` | 0 | PASSED (构建耗时 7.67s，manifest.json 预备份无损还原，dist 留存) | `evidence/check7-build.log` |
| 8 | 真实项目 CSS 响应式多视口几何测量测试 | `$env:CODEX_NODE_MODULES=...; node tests/ia-project-compliance-layout.test.mjs` | 0 | PASSED (360/390/768/1440 几何+字符排列零异常) | `evidence/check8-layout-test.log` |

---

## 6. 未完成项与后续说明

- **未完成项**：无。本任务承诺的 390px 按钮挤压竖排修复、4 视口几何与视觉核验、构建与回归测试均 100% 完成。
- **是否部署**：**否**。
- **下一阶段工作**：通过后下一计划是认证适用性合同修订，当前严格不授权进入该工作。

交付状态已置为 `review_ready`，请验收者 Codex 进行独立复核。
