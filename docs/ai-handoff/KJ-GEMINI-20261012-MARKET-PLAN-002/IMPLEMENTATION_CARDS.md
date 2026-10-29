# IMPLEMENTATION_CARDS.md — 市场报告至工厂选品后续实施任务卡

> **任务编号**：KJ-GEMINI-20261012-MARKET-PLAN-002  
> **任务类型**：只读调查与下一阶段优化策划  
> **规划说明**：本文件提供 3 个独立实施切片的工程任务卡规范。每个切片必须具备明确的目标、文件范围、合成反例、验收门禁与回滚方案。**未经 Codex 独立评审与用户明确授权，任何切片不得置为 `ready` 或开始执行。**

---

## 实施任务卡 1 (Slice 1 - P0)：报告数据留存、内容强哈希与快照日可信度修正

### 1. 任务基本信息
- **建议任务代号**：`KJ-GEMINI-20261013-MARKET-RETENTION-001`
- **优先级类别**：**P0（底层数据保护与可信度）**
- **任务目标**：
  1. 重构报告 ID 规则：以内容指纹、采集日期、原始文件名组合生成唯一键，彻底杜绝同名文件再次上传时覆盖在线历史报告；
  2. 显式化快照日期录入：去除无日期文件名隐式回退到导入当天的伪造机制，改为在解析时要求用户确认或显式标记为“未定日期”，修正 180 天新品存续期计算基准；
  3. 提供基于 SKU 的准确去重统计口径，避免重复计入导致品类总规模与单品销售额虚高。

### 2. 涉及文件与实体变更范围
- **修改生产文件**：
  - `ozon-react/src/utils/marketReportAnalysis.js`
  - `ozon-react/src/components/reports/MarketReportCenter.jsx`
  - `ozon-react/src/components/reports/UploadedMarketReport.jsx`
- **新增/修改测试文件**：
  - `tests/market-report-retention.test.mjs`（新增专项测试）
  - `ozon-react/src/utils/marketReportAnalysis.test.mjs`
- **禁止触碰范围**：
  - 严禁修改 `t6Store.js`、`gateEngine.js` 及任何计算引擎（`wbEngine.js`、`ozonEngine.js`、`wb_calc.py`）。

### 3. 数据保留与向后兼容边界
- **存量报告兼容**：旧版以 `uploaded-xxxxxxxx` 为 ID 的历史 JSON 报告必须保持 100% 正常读取与解析（通过 `schemaVersion: 1` 兼容分支）；
- **服务端持久化兼容**：不破坏现有的 `kuajing-persistence.php` 接口，新报告以具有内容唯一性的新文件名保存到 `market-report-json`，使历史版本与新批次天然共存；
- **回滚边界**：如需回滚，仅恢复修改的 JS/JSX 文件即可，服务器上新增的内容隔离 JSON 文件无需物理删除，不影响旧版前端读取。

### 4. 合成反例与测试设计（Fail-before-fix, Pass-after-fix）
- **反例 1 (同名覆盖反例)**：
  - 构造数据 A：文件名 `gloves.xlsx`，内容为 1 月手套 10 条（总额 10,000₽）；
  - 构造数据 B：文件名 `gloves.xlsx`，内容为 10 月手套 10 条（总额 50,000₽）；
  - 断言：两者生成的 `report.id` 必须严格不相等；上传 B 后，`uploadedReports` 列表中同时存在 A 和 B，且 A 的内容 100% 字节级不变。
- **反例 2 (快照日隐式伪造反例)**：
  - 构造数据：文件名 `undated_mask.xlsx`（不含日期），上架时间为 2026-03-01；
  - 断言：系统绝不能静默赋予当前系统时间（如 2026-10-12）；必须标记 `snapshot: null` 或 `snapshot: 'undated'`；180 天新品不能以当前时间推算为老品，而应给出明确提示。
- **反例 3 (重复 SKU 累加反例)**：
  - 构造数据：同一 SKU 出现 2 次（单价 100₽，销量各 10 件，销售额各 1000₽）；
  - 断言：去重后该 SKU 销售额为 1000₽，类目总销售额不被虚构为 2000₽。

### 5. 验收标准
- 专项测试 `tests/market-report-retention.test.mjs` exit 0（含上述 3 个反例）；
- 既有 `npm run test:market`、`npm test`、`npm run test:golden` 全绿；
- Vite 构建成功无 JSX 错误。

### 6. 用户授权要求
- **本地实施授权**：需 Codex 审核通过任务书；
- **生产发布授权**：需用户明确授权，本任务保持 `production_authorized: false`。

---

## 实施任务卡 2 (Slice 2 - P1)：报告至工厂选品标准化卡片与人工安全推流桥接

### 1. 任务基本信息
- **建议任务代号**：`KJ-GEMINI-20261014-MARKET-FACTORY-CARD-002`
- **优先级类别**：**P1（业务决策价值与立项闭环）**
- **任务目标**：
  1. 建立面向国内合作工厂的“标准化选品卡（Factory Selection Card）”，形成选品判断最小事实集合；
  2. 建立 `OZON_MARKET_REPORT` 候选实体规范，支持在报告中心对优质新品或头部机会一键人工推流至 T6 候选池；
  3. 规范结构门禁商业放行流程，确保放行理由有明确的经办人与决策凭证，严禁无依据放行。

### 2. 涉及文件与实体变更范围
- **新增组件与适配器**：
  - `ozon-react/src/components/reports/FactorySelectionCard.jsx`（选品卡视图）
  - `ozon-react/src/utils/marketReport/reportCandidateBridge.js`（推流桥接器）
- **修改文件**：
  - `ozon-react/src/components/reports/UploadedMarketReport.jsx`（增加选品卡抽屉与推流触发器）
  - `ozon-react/src/components/reports/MarketDecisionBrief.jsx`
  - `ozon-react/src/utils/t6/candidateProjectEvidence.js`（增加 `OZON_MARKET_REPORT` 证据结构评估）
- **实体新增**：
  - `T6 Candidate` 新增 `source_system: 'OZON_MARKET_REPORT'`
  - 稳定物理主键：`ozon-sku-${sku}` 或 `ozon-url-${urlId}`（严禁以名称合并！）

### 3. 工厂选品卡最小事实字段契约

选品卡严禁使用伪造默认值，字段缺失时严格显示“待补证据”：
1. **工厂 SKU 与规格**：合作工厂内部货号、包装形式（盒装/袋装/双数）、单件容量或数量；
2. **Ozon 对标竞品 URL**：经过 `safeUrl` 校验的有效竞品链接；
3. **真实快照采集日**：源文件的真实采集日期（非系统导入日）；
4. **180 天新品标记**：布尔值及该类目的上架日期覆盖率百分比；
5. **样本量与集中度**：样本总 SKU 数、头部前十品牌集中度份额；
6. **纯度与可比性分级**：A（标准同品）/ B（套装或临近品）/ C（无关品）/ UNKNOWN；
7. **价格与销售额口径**：标价、实际件均销售额、28 天销售额（卢布）；
8. **跨境物流实测参数**：单件实测重量（克）、外包装三边尺寸（长x宽x高 cm）、适用跨境渠道（如 CEL/DPX/WB Plus）及对应费率版本号；
9. **预期利润区间**：出厂价（人民币） -> 头程运费 -> 平台佣金 -> 税费/汇率 -> 预估毛利率区间；
10. **待补证据项清单**：合规资质核验（EAC 等）、工厂打样排期、MOQ 起订量；
11. **人工决策结论与理由**：经办人签名、推进建议（优先小批测试 / 暂缓 / 淘汰）、决策论据。

### 4. 合成反例与测试设计
- **反例 1 (同名不同来源隔离反例)**：
  - 报告中有一款名为“防滑手套”的 Ozon 商品（SKU 123456），候选池中已有一款同名但来源为 WB 的历史候选；
  - 断言：系统严禁将两者自动合并，必须依靠稳定 `ozon-sku-123456` 独立建档，保持旧候选 100% 字节级不变。
- **反例 2 (缺失关键工厂参数时立项阻断反例)**：
  - 选品卡缺少出厂价或外包装尺寸；
  - 断言：`evaluateMarketValidationEligibility` 判定 `eligible: false`，阻断直接立项，界面明确指出“出厂价缺失”和“包装尺寸缺失”，绝不填补假数据。
- **反例 3 (商业放行结构化审计反例)**：
  - 基线毛利率 < 15% 触发 `YELLOW` 门禁；
  - 断言：必须填写结构化商业放行凭证，生成带经办人 `by` 和理由 `reason` 的不可变 `gate_override` 决策日志。

### 5. 验收标准
- 专项测试 `tests/market-factory-bridge.test.mjs` exit 0；
- 全量回归测试 `npm test`、`npm run test:t6`、`npm run test:golden` 全绿；
- Vite 构建成功。

### 6. 用户授权要求
- 涉及工作流桥接，必须由用户审核字段契约并确认后再启动实施。

---

## 实施任务卡 3 (Slice 3 - P2)：孤儿源文件恢复、按需元数据索引与移动端体验

### 1. 任务基本信息
- **建议任务代号**：`KJ-GEMINI-20261015-MARKET-PERF-UX-003`
- **优先级类别**：**P2（可用性、扩展性与多端操作体验）**
- **任务目标**：
  1. 根除 `O(N)` 全量并行下载风暴：将报告中心改造为“元数据摘要（Summary）”与“完整报告（Detail）”两级按需加载；
  2. 实现孤儿源文件（Orphaned Sources）检测与一键恢复机制；
  3. 移动端/窄屏大表格增加卡片折叠视图（Card View），消除大范围横向滑动。

### 2. 涉及文件与实体变更范围
- **修改文件**：
  - `ozon-react/src/components/reports/MarketReportCenter.jsx`
  - `ozon-react/src/components/reports/UploadedMarketReport.jsx`
  - `ozon-react/src/components/reports/MarketDecisionBrief.jsx`
  - `ozon-react/src/utils/serverFiles.js`
- **新增测试文件**：
  - `tests/market-report-perf-ux.test.mjs`

### 3. 数据保留与向后兼容边界
- **索引机制兼容**：对于尚未生成元数据摘要的历史报告，前端首屏采用渐进式探测，确保新旧报告在同一列表中平滑展示；
- **回滚边界**：纯前端组件优化与加载调度，不影响底层已保存的报告 JSON 与原始文件。

### 4. 合成反例与测试设计
- **反例 1 (孤儿源文件检测与恢复反例)**：
  - 服务端 `market-report-sources` 存在文件 `lost_report.xlsx`，但 `market-report-json` 中缺失对应的报告；
  - 断言：报告中心能准确检测到该孤儿源文件，并在“未发布文件”面板提供“解析并发布”按钮，点击后成功生成并发布报告。
- **反例 2 (请求并发数约束反例)**：
  - 模拟服务端存在 30 份已发布报告；
  - 断言：初次加载报告中心时，网络请求数严格保持为 `O(1)`（仅拉取目录或索引），全量报告详情请求数为 0；仅当选中某份报告时才发出 1 次详情请求。

### 5. 验收标准
- 专项测试 `tests/market-report-perf-ux.test.mjs` exit 0；
- 全套回归套件通过；
- Vite 构建成功。

### 6. 用户授权要求
- 本地实施由 Codex 验收，不涉及生产部署。
