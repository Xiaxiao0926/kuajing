# DOCUMENTATION_CORRECTIONS.md — 交接书事实勘误与业务口径校正

> **任务标识**：KJ-GEMINI-20261009-MARKET-001 (Work Package D)  
> **关联原始文档**：`MARKET-ANALYSIS-PANEL-UPGRADE-HANDOVER-20261009.md` (2026-10-09 V2.0-RELEASE)  
> **编写角色**：Gemini  
> **审查对象**：Codex (独立验收) / GPT-4o / o1  

---

## 概述

在对历史交接书 `MARKET-ANALYSIS-PANEL-UPGRADE-HANDOVER-20261009.md` 与实际生产代码（`ozon-react/src/`、`tests/`、`config/`）进行严密逐行比对后，发现交接书中存在多处与实际代码实现不符的陈述、口径误导以及未实现能力的超前宣称。

本文件逐条列出勘误对照、代码事实依据、工程影响分析，并对“REJECT/HOLD 但证据齐全”候选的商业门禁放行方案提出架构建议供 Codex 裁决。

---

## 一、核心勘误逐条对照表 (Corrections Dossier)

### 勘误项 1：`OpportunityPurityGateway` 的真实定位（导航 CTA 入口 vs 算法清洗网关）

- **交接书主张** (§4.2.2)：
  > “嵌入式网关 (`OpportunityPurityGateway`) 在抽屉内部加载时，若当前利基无匹配的已清洗数据，提供显式的数据缺失保护，并展示一键触发本地快速清洗的操作入口。”
- **代码事实依据**：
  - 查阅 `ozon-react/src/components/marketIntelligence/components/OpportunityPurityGateway.jsx`：
    该组件仅渲染一个空状态卡片和“前往选品分析页面清洗”的页面跳转/Tab 切换按钮（导航 CTA），内部**不包含**任何 Excel 解析、品类探测、正则规格清洗或分箱计算逻辑。
- **纠偏结论**：
  - `OpportunityPurityGateway` 当前只是一个轻量级的导航路由入口组件（Navigation CTA），而非抽屉内原生执行清洗的算法网关；
  - 严禁向评审方宣称抽屉内具备本地流式清洗能力，实际数据清洗必须在独立路由 `__purity_analysis__`（`PurityPipelinePage.jsx`）中执行。

---

### 勘误项 2：市场快照持久化键名与不可变哈希声明（`t6.snapshot.*` vs `t6.marketSnapshot.*` / SHA-256）

- **交接书主张** (§4.4 Mermaid 序列图、§5.1 存储矩阵)：
  > “返回不可变快照 (含 SHA256 哈希及快照 ID)；保存快照至 `t6.marketSnapshot.*`，以 `snapshot_` 为主键，不可变只读。”
- **代码事实依据**：
  - 查阅 `ozon-react/src/utils/t6/t6Store.js`：
    - 快照前缀常量为 `T6_PREFIX.snapshot = 't6.snapshot.'`，系统内**根本不存在** `t6.marketSnapshot.*` 命名空间；
    - 快照生成函数 `createSnapshot(payload)` 仅通过 `uuid()` 生成唯一 ID，并写入 `schemaVersion: 1`、`createdAt` 与 `payload`；
    - 快照结构中**没有计算或存储任何 SHA-256 哈希**，也没有在读取时进行哈希校验。
- **纠偏结论**：
  - 市场快照实际存储于 `t6.snapshot.${uuid}` 中；
  - 当前版本快照不可变性依赖应用层的 Append-Only 协议（无更新接口），未引入密码学 SHA-256 签名机制；交接书中关于 SHA-256 的描述属于概念超前宣称，已在文档中彻底划除。

---

### 勘误项 3：立项交互链路（一步合并原子操作 vs 两步分离操作）

- **交接书主张** (§4.4 Mermaid 序列图)：
  > “两步流程：用户先点击 [生成市场验证快照] -> 保存快照 -> 用户再点击 [申请正式立项] -> Gate 门禁校验 -> 创建 Project。”
- **代码事实依据**：
  - 查阅 `ozon-react/src/components/t6/CandidateDetailDrawer.jsx` 与 `CandidateProcurementPanel.jsx`：
    用户在界面上触发的是“一键创建市场快照并立项”的单次原子操作。该操作在内部顺序执行 `createSnapshot` 挂载证据，并立即调用 `createProject` 绑定 `creationSnapshotId`。
- **纠偏结论**：
  - 真实前端交互为一步操作（Single-Step Unified Launch），而非用户分步点击；交接书序列图描绘的分步交互脱离真实 UI 实现。

---

### 勘误项 4：Gate 门禁校验属性（数据结构完整性门禁 vs 商业盈利推荐门禁）

- **交接书主张** (§4.4 门禁描述)：
  > “门禁校验: 检查是否存在有效的 Market Snapshot...快照齐备且合格 -> 创建 Project -> 进入项目工作区开展精准利润核算。”
  > 且在上下文语境中将 Gate 描述为“商业上推荐立项”的放行机制。
- **代码事实依据**：
  - 查阅 `ozon-react/src/utils/t6/gateEngine.js` 与 `candidateProjectEvidence.js`：
    门禁的核心职责是**结构完整性与可信度核验**（Schema & Provenance Gate）：检查字段是否缺失、数值是否有效、价格与重量是否具备事实来源、是否具备前置市场证据。
  - 门禁通过（PASS/GREEN）表示“数据完整齐备，具备进入下一阶段核算的必要输入条件”，**并不等同于“该商品在商业上保证盈利或强烈推荐立项”**。
- **纠偏结论**：
  - 必须严格区分“结构/数据门禁”（Gate）与“商业决策准入”（Business Decision）；
  - 结构齐备是立项的必要条件，但非充分条件。

---

### 勘误项 5：自动化测试数量与覆盖统计真实性

- **交接书主张** (§7 质量矩阵)：
  > “npm test --> 94/94 PASS (React wbEngine 65项 + FBP 29项 + Python 44项全绿)”
- **代码事实依据**：
  - 查阅 `package.json` 中的 `npm test` 实际指令链：
    ```json
    "test": "node scripts/sync-config.js && node --experimental-vm-modules ozon-react/src/utils/wbEngine.test.mjs && node ozon-react/src/utils/exchangeRate.test.mjs && npm run test:scoring && npm run test:t6 && npm run test:market && npm run test:fbp && npm run test:scoring-golden && npm run test:python"
    ```
  - 实际执行覆盖：
    - `wbEngine.test.mjs`: 65 项
    - `exchangeRate.test.mjs`: 18 项
    - `test:scoring`: 4 个测试套件（单调性、适配器、导出）
    - `test:t6`: 7 个测试套件（含 Gate、成本场景、WB场景、UI契约、供应商等共计 170+ 项）
    - `test:market`: 4 个测试套件（规格解析 36 + 纯度过滤 45 + E2E 49 等共计 130 项）
    - `test:fbp`: 29 项
    - `test:scoring-golden`: 56 项
    - `test:python`: 44 项
  - 真实断言总数超过 500+ 项，并非历史局部汇总的“94 项”。
- **纠偏结论**：
  - 废止过时、碎片化的“94/94”计数表述，在所有交付物中以实际执行脚本的退出码（Exit Code 0）及各子套件具体通过项为准，杜绝口头拼凑测试数据。

---

## 二、针对“REJECT/HOLD 但证据齐全”候选的商业放行方案建议（供 Codex 裁决）

### 1. 业务冲突背景
在市场情报流水线中，部分利基由于宏观指标（如品类近一季年增长率为负、竞争卖家数偏多、或 EAC 法规暂定为 UNKNOWN）被算法初步判定为 `verdict: 'HOLD'` 或 `verdict: 'REJECT'`。
然而，在进入人工采购深度核实后（Phase 5 采购工作台），选品团队可能获取到了独家极低出厂价或厂家特氟龙定制版，其运费利润核算极其优秀，证据链（厂家实询报价、实测重量、准确合规文书）100% 完整齐备。

此时产生冲突：
- 结构性数据门禁（Gate）：数据结构完整、证据完备，应允许推进；
- 商业决策标记：宏观仍标注为 `HOLD`/`REJECT`，直接立项易造成混淆。

### 2. 建议方案：显式人工商业放行（Human-in-the-Loop Commercial Override）
为了不破坏系统的自动风控基线，同时保证业务灵活性，建议方案如下：
1. **结构门禁保持 fail-close**：
   - 任何字段缺失、负价格、非法重量等脏数据，Gate 保持绝对硬阻断；
2. **商业结论不搞隐式静默放行**：
   - 当 `verdict === 'HOLD'` 或 `'REJECT'` 时，立项按钮默认展示警告标识；
   - 允许用户勾选“**人工商业特批放行**”（`commercial_override: true`），且必须强制输入不少于 10 个字符的放行理由（`override_reason`）；
3. **审计追溯与快照固化**：
   - 将人工放行决策、理由、操作人及时间戳作为核心凭据写入快照与决策日志（`DecisionLog`），确保事后可追溯、不可抵赖；
4. **决策权归属**：
   - 本任务（MARKET-001）不擅自更改 `candidateProjectEvidence.js` 的 Gate 判定规则，保持现有逻辑不变，将上述特批放行方案完整提交 Codex 进行架构裁决。

---

## 三、结论与合规承诺

1. 本纠错文档真实反映了仓库当前生产代码架构与数据模型现状；
2. 本次任务在代码层面纠正了 Work Package A（嵌入隔离）、Work Package B（价格带加权口径与分位）、Work Package C（UID 主键与类目查重）；
3. 任何未落地的设想（如 SHA-256 快照签名、抽屉内微型清洗引擎）均已明确标识为未实现特性，不列入交付范围。
