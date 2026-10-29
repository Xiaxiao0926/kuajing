# KJ-GEMINI-20260920-001：合规面板未保存输入保护

执行者：Gemini。验收者：Codex。状态以 CURRENT_TASK.json 为准。
本轮仅本地修复，不部署、不 push、不操作线上数据、不进入 07A-4C3B。

## 1. 目标与已发现问题

`ProjectCompliancePanel.jsx` 通过 project 变化触发 effect，重新填入评估和计划的全部字段。保存评估、保存计划及增删改事项都会增加 tick 并刷新 project。因此，保存一部分内容可能覆盖另一部分尚未保存的输入。

修复目标：同一项目中，各表单草稿相互独立；保存/刷新某一部分不覆盖其他未保存输入。不得通过自动保存所有区块来掩盖问题。

## 2. 输入冻结与预检

- 仓库 HEAD（策划时）：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`。
- 目标组件 SHA256（策划时）：`C34F5A7C39495F2D282C434771B5519429861BAA846A43DF782809877ED667F0`。
- 本组件策划时是未跟踪文件；仓库其他文件已有大量改动。HEAD 不是完整的工作区基线。
- 必须先读 AGENTS.md、ARCHITECTURE.md 相关部分、目标组件、ProjectDetailPage.jsx、complianceProfile.js、t6Store.js、persist.js 和现有两组合规测试。
- 若目标哈希变化或发现并行执行，先记录差异并报告 blocked，等待范围重新冻结。只有无关文件变化不需要阻塞。
- 修改前在任务 evidence/ 内保存目标原文件和相关基线说明；不得备份密钥、账号数据、整个业务目录。

## 3. 允许修改

- `ozon-react/src/components/t6/ProjectCompliancePanel.jsx`
- 如确有必要，可新增一个纯草稿状态 helper：`ozon-react/src/utils/t6/complianceDraftState.js`
- 新增针对性测试：`tests/ia-project-compliance-draft.test.mjs`
- 本任务目录下的 RESULT.md、tests.json、evidence/。
- CURRENT_TASK.json 的状态及领取信息。

不修改 App、路由、Store、persist、Gate、数据模型、公式、现有业务数据、部署配置及依赖。不要重写旧测试以绕过失败。若修复确实需要越界，写明原因并等待裁决。

## 4. 行为要求

1. 评估字段（assessmentStatus/riskLevel/notes）和计划字段（standardsText/certificationPlan）独立跟踪编辑状态。
2. 只有用户明确保存的区块被提交。保存后可回填该区块规范化后的值，不得覆盖其他 dirty 区块。
3. Requirement 新增/修改/删除后，两块未保存输入都必须保留；新增/编辑事项自身的未保存输入也不能被无关保存重置。
4. 保存失败时保留草稿并显示错误；失败不得显示成功或清除 dirty 标志。
5. 同项目更新仅刷新未编辑的区块。检测到已编辑区块的源数据变化时，提示需要核对，不得静默覆盖或默默宣称自动合并成功。
6. projectId 切换时禁止把 A 的草稿带入 B。不得为此新建复杂全局草稿仓库。
7. 有未保存输入时给出可见标记；在组件范围内可处理浏览器关闭/刷新提醒并正确清理监听。站内卸载/切换项目的完整拦截若必须改父级路由，本轮只记录后续项，不伪称已覆盖。
8. 保留显式保存、现有布局、Lucide 图标和事项删除二次确认。不要扩展成大型 UI 重构。
9. 本组件的保存是本机写入并排队同步，不是服务器备份确认。不得新增“已备份到服务器”或“服务器保存成功”等未经确认的提示。

## 5. 验收用例

使用临时合成项目，不修改线上真实业务记录。

- A：编辑未保存计划，再保存评估，计划内容仍在且保持未保存。
- B：编辑未保存评估，再保存计划，评估内容仍在且保持未保存。
- C：两块均有未保存输入，依次新增/编辑/删除一个事项，输入不丢失。
- D：模拟保存抛错，输入保留、错误可见、无成功反馈。
- E：成功保存后该区块 dirty 清除，规范化值正确；另一块 dirty 不变。
- F：项目 A/B 切换无串写；对离开时提醒的覆盖范围如实说明。
- G：同项目外部数据更新时，干净区块刷新，dirty 区块不被覆盖且冲突提示准确。
- H：桌面及约 390px 手机宽度检查，无新增横向溢出、按钮遮挡或标签重叠。

自动测试优先断言真实行为；禁止只用字符串存在断言证明交互正确。helper 测试不能替代浏览器中的 A/B/C 实测。浏览器不可用时记为 not_run，由 Codex 补验，不能宣称最终验收通过。

## 6. 必跑检查

从仓库根目录运行并记录实际输出与退出码：

```text
node tests/ia-project-compliance-draft.test.mjs
node tests/ia-project-compliance.test.mjs
node tests/ia-project-compliance-gate.test.mjs
npm test
npm run test:golden
npm run test:sync
npm --prefix ozon-react run build
```

测试/构建可能产生其他文件变化，需区分基线已有变化及本轮生成变化，不得一键清理工作区。没有执行的检查写 not_run 和具体原因。

## 7. 交付与回滚

- RESULT.md 列出根因、最小修复、每个验收场景结果、文件路径、未覆盖项和后续建议。
- tests.json 按交接 README 格式记录。
- evidence/ 保存合成数据截图、必要日志、原文件副本及本轮增量 diff。因原组件未跟踪，不能仅用 git diff 证明变更范围。
- 回滚仅恢复本轮文件到执行前副本；若此后他人又改过同一文件，停止并人工合并。禁止 git reset/清理未跟踪文件。
- 不自动提交或推送；下一轮 Codex 验收后再确定提交范围，防止把之前的重构混成一次补丁。
- 完成后把 CURRENT_TASK.json 状态置为 review_ready；这只代表提交验收，不代表 accepted 或 deployed。

## 8. 仅供后续规划

07A-4C3A 合同仍有 Store 变化字段遗漏、默认值污染旧档案、合规术语与放行语义问题。不要在本任务顺手实施；可在 RESULT.md 的“下一步建议”中列出，但须等新任务书。
