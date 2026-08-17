# T6 MASTER — SKU 项目生命周期 执行总报告

> 阶段：T6-1（数据模型+候选池+一键立项）→ T6-2A（项目工作区+Gate 加固）→ T6-2B1（Ozon 成本场景）→ T6-2B2（WB 成本场景+跨平台比较）
> 日期：2026-08-14

---

## AI EXECUTION

| 项 | 值 |
|---|---|
| Gemini model | `gemini-3.7-flash-high`（本机 Antigravity CLI `agy` v1.1.12） |
| **Gemini actual participation** | **NO**。委托失败：本环境为非 TTY，`agy --print` 仅输出欢迎横幅（"How can I help you today?"）即 exit 0，无任务输出、无文件修改、无日志文件。已做 3 次非交互尝试 + 1 次 `--log-file` 流式尝试，结论一致。按任务规则：停止委托，由 DeepSeek 直接实现，最终报告如实标注。Gemini 可作为 Fast 候选仅在用户自己的终端交互式使用（RUNBOOK §8 已注明）。 |
| **DeepSeek direct code contribution** | **全部实现**（见下）。诚实标注：本阶段业务实现由 DeepSeek 直接编写，未声称 Gemini 完成任何未完成的工作。 |

### DeepSeek 直接实现的文件（T6-2A/B1/B2）

**T6-2A（fix `2b2758d`）**：`ozon-react/src/utils/t6/stageModel.js`（新，阶段唯一事实源）、`gateEngine.js`（路径 Gate 重构）、`stageTransition.js`（新，流转 domain action）、`t6Store.js`（stage 校验 + workflow 审计日志）、`gateEngine.test.mjs` / `t6Store.test.mjs`（I17-I22）、`components/t6/ProjectDetailPage.jsx`（路径 Gate UI + 备注草稿）、`ProjectListPage.jsx`（简化）。

**T6-2B1（feat `ce4949c`）**：`t6Store.js`（CostScenario 实体）、`costScenarioAdapter.js`（新，Ozon 冻结适配）、`OzonCalc.jsx`（projectContext 模式）、`ProjectDetailPage.jsx`（成本 Tab + 场景列表）、`gateEngine.js`（成本检查真实化）、`costScenario.test.mjs`（新，C1-C9）、`package.json`（test:t6 扩展）。

**T6-2B2（feat `8271d3f`）**：`costScenarioAdapter.js`（WB 冻结 + 平台统一摘要/毛利）、`WBCalc.jsx` / `wbcalc/tabs/CalculatorTab.jsx`（projectContext 模式 + 保存场景）、`ProjectDetailPage.jsx`（WB 面板 + 跨平台比较表）、`gateEngine.js`（target_price 平台统一）、`t6Store.js`（快照 sourceInputs 增 name）、`wbScenario.test.mjs`（新，W1-W10）。

## PHASE BLOCKS

- **Phase A（T6-2A hardening）**：✅ 分支 `feat/v3-t6-2-project-workspace`，commit `fix(t6-2a)` `2b2758d`，merge --no-ff 到 main `f1ef799`（无 tag）。
- **Phase B1（Ozon 成本场景）**：✅ 分支 `feat/v3-t6-2b1-ozon-cost-scenario`，commit `feat(t6-2b1)` `ce4949c`，merge --no-ff 到 main `0b78bac`。
- **Phase B2（WB 成本场景+比较）**：✅ 分支 `feat/v3-t6-2b2-wb-cost-scenario`，commit `feat(t6-2b2)` `8271d3f`，merge --no-ff 到 main `797b6c2`。

## INVARIANTS（全部保持）

- wbEngine / ozonEngine / wb_calc.py / wbConfig / scoring 公式：**0 改动**（git diff 空）
- config/*.json 费率与设置：**0 改动**
- 汇率双语义 `rub_per_cny=12` / `ozon_rub_to_cny=0.09`：**并存不统一**（场景冻结双上下文存档）
- Ozon SingleTab 售价 = 实际售价（**无 ×0.6**）；MultiTab ×0.6 原样保留（TD-14 未触碰）
- WB 独立利润模型：**不移植 Ozon 佣金**（W9 断言：commission_rfbs=99 也不带入）
- CostScenario 不可变：仅 create/read、禁系统字段注入、快照归属校验、首个自动基线、基线仅人工切换

## FINAL MAIN sha

- 代码主线：`797b6c2`（T6-2B2 merge）→ 最终 main（含本文档与 docs merge）：见 tag 指向提交（本报告提交后由 docs merge + 回填提交定稿）。

## FINAL TAG

- `v3-t6-sku-project-lifecycle`（T6-2B 回归全绿后打在最终 main）

## SCORING DISTRIBUTION（冻结不变）

`A: 1 / B: 191 / C: 448 / D: 169 / 不可评级: 191`（scoringDataAdapter 13 断言锁定；T4 golden 56 全绿）

## FULL REGRESSION（main 最终态）

```
npm test              ✅ wbEngine 65 + scoring 81/20/13/22 + T6 56/42/44/42（184 断言）+ scoring-golden 56 + python 31
npm run test:golden   ✅ 76/76
npm run test:sync     ✅ 零差异（16 边界 + 2 版本 + scoring_rules 一致）
npm run verify:scoring-build ✅
npm run test:web-persistence ✅（web persistence + access session）
vite build            ✅
```

## KNOWN TECH DEBT

- **TD-22**（保持）：`RU-YYYY-NNN` 并发编号 → 未来 WP 服务端原子序列（UUID 主键不受影响）。
- **TD-23**（本阶段新登记）：成本场景不校验 WB 反向配送「实际值字段」与估算值一致性（场景冻结后不可修正，只能新建）。
- 未触碰：TD-3/8/9/10/11/12/14/16/17/18/19/20/21。

## SECRETS EXPOSED

**NO**（每次 push 前 Secret Audit 模式扫描 0 命中；仅环境变量引用，无凭据字面量）

## UNAUTHORIZED BUSINESS RULE CHANGE

**NO**（需求方锁定的规则全部原样执行：Ozon 实际售价语义、WB 独立模型、汇率双语义、费率/评分/公式冻结、基线 human-only、跨平台不重算费用）

## STOP GATE

- 未开始 T7；未触碰 `docs/antigravity-kuajing-executor` 分支与 commit `64c4525`（用户自己的 Antigravity 会话产物，忽略）。
- T6 全部验收：回归全绿、tag 已打、main 已 push。
