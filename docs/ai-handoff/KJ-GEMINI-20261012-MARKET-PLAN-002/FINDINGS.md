# FINDINGS.md — 市场报告至工厂选品调查发现与缺陷矩阵 (P0 / P1 / P2)

> **任务编号**：KJ-GEMINI-20261012-MARKET-PLAN-002  
> **任务类型**：只读调查与下一阶段优化策划  
> **调查执行者**：Gemini  
> **审计结论**：共发现 8 项具备确凿代码证据与可复现验证的事实缺陷，分为 P0（3项）、P1（3项）、P2（2项）。本任务不直接实施修改，全部作为后续实施切片的输入。

---

## 一、问题矩阵总览

| 编号 | 严重度 | 领域 | 核心问题摘要 | 涉及核心文件与行号 | 验证状态 |
|---|---|---|---|---|---|
| **P0-1** | P0 | 报告身份与数据保留 | `stableMarketReportId` 仅哈希文件名，导致同名新批次静默覆盖历史在线报告，旧版本在 UI 完全蒸发 | `marketReportAnalysis.js:504-511`<br>`MarketReportCenter.jsx:137-144, 188`<br>`kuajing-persistence.php:1176-1184` | ✅ 独立脚本与代码核验复现 |
| **P0-2** | P0 | 时间戳与可信度 | 文件名无日期时快照日默认回退为导入当天当前时间，伪造数据快照日并严重扭曲 180 天新品存续期计算 | `marketReportAnalysis.js:524-531`<br>`UploadedMarketReport.jsx:53` | ✅ 独立脚本实测验证 |
| **P0-3** | P0 | 数据口径与计算 | 重复 SKU 与重复 URL 仅统计未去重，导致样本销售额与销量被双重累加虚高计算 | `marketReportAnalysis.js:534, 538, 861-864`<br>`UploadedMarketReport.jsx:74-77` | ✅ 独立脚本实测验证 |
| **P1-1** | P1 | 选品转化与身份链 | 报告中心与 T6 候选池完全割裂，缺乏面向工厂的选品卡结构与安全身份桥接入口 | `MarketReportCenter.jsx`<br>`UploadedMarketReport.jsx`<br>`t6Store.js:261`<br>`candidateProjectEvidence.js:83-195` | ✅ 架构与代码比对确认 |
| **P1-2** | P1 | 上传可靠性与备份 | 原始文件备份与报告发布两阶段非原子，网络延后排队导致源文件孤儿化且报告不可见不可恢复 | `MarketReportCenter.jsx:132-152`<br>`serverFiles.js:172-194` | ✅ 源码执行链路核验 |
| **P1-3** | P1 | 决策评估与门禁 | 样本内探索分易与全域优势混淆；结构门禁对商业风险放行缺乏专门的人工审计载荷字段 | `marketReportAnalysis.js:345-357, 831-836`<br>`stageTransition.js:24-30` | ✅ 规则与状态机核验 |
| **P2-1** | P2 | 网络与性能体验 | 报告中心加载发起 `O(N)` 完整 JSON 并行请求且强制禁用缓存（`no-store`），存在并发瓶颈 | `MarketReportCenter.jsx:87-100` | ✅ 源码行为核验 |
| **P2-2** | P2 | 界面与移动端体验 | 长列表大表格未做虚拟化；移动端窄屏查阅宽表格依赖大范围横向滑动，缺少自适应卡片 | `UploadedMarketReport.jsx:132-150`<br>`MarketDecisionBrief.jsx:95-114` | ✅ DOM 结构核验 |

---

## 二、P0 级严重问题（数据损坏 / 覆盖 / 决策误导风险）

### 1. P0-1：`stableMarketReportId` 弱哈希导致同名文件覆写历史报告，旧版本在 UI 完全蒸发

- **问题描述**：
  报告身份 ID 使用 `stableMarketReportId(fileName)` 生成，其算法仅对文件名的小写字符串进行 32-bit FNV-1a 计算。只要文件名相同（如 `data.xlsx` 或两期相同的 `hair_mask.xlsx`），生成的 ID 完全相同。
- **代码行号证据**：
  - `ozon-react/src/utils/marketReportAnalysis.js:504-511`：
    ```javascript
    export function stableMarketReportId(fileName) {
      let hash = 2166136261
      for (const char of String(fileName || '').toLocaleLowerCase()) {
        hash ^= char.codePointAt(0)
        hash = Math.imul(hash, 16777619)
      }
      return `uploaded-${(hash >>> 0).toString(16).padStart(8, '0')}`
    }
    ```
  - `ozon-react/src/components/reports/MarketReportCenter.jsx:137-140`：
    ```javascript
    const reportFileName = `${stableMarketReportId(file.name)}.json`
    const reportFile = new File([JSON.stringify(publishedReport)], reportFileName, { type: 'application/json' })
    const reportResult = await uploadServerFile(REPORT_NAMESPACE, reportFile)
    ```
  - `wordpress/kuajing-persistence/kuajing-persistence.php:1176-1184`：
    后端收到同名上传时，将旧文件转存到隐藏的 `file-backups/` 目录，然后用新文件覆盖活动文件。
  - `ozon-react/src/components/reports/MarketReportCenter.jsx:188`：
    文案向用户承诺：“*支持 Excel、CSV 和 JSON；浏览器本地解析，原始文件与聚合报告保存到服务器私有备份，同名文件再次导入会保留旧版本。*”
- **实测复现**：
  运行测试证实：无论文件内容是一行还是千行，是 1 月数据还是 10 月数据，`stableMarketReportId('data.xlsx')` 恒等于 `uploaded-997badee`。
- **用户可见后果**：
  操作员再次导入同名文件时，在线报告列表中原有的历史报告被立刻替换，历史版本在 UI 上彻底消失，没有任何入口可以查阅或恢复；承诺的“保留旧版本”对用户不可见，造成隐蔽的数据覆盖事故。

---

### 2. P0-2：文件名不带日期时默认回退为当前系统时间，伪造快照日并扭曲 180 天新品存续期

- **问题描述**：
  当用户上传的源文件没有在文件名中包含 `YYYY-MM-DD` 格式的日期时，系统隐式使用 `new Date().toISOString().slice(0, 10)`（即用户导入当天的当前日期）作为 `snapshot`（数据快照日）。
- **代码行号证据**：
  - `ozon-react/src/utils/marketReportAnalysis.js:524-531`：
    ```javascript
    const snapshot = options.snapshot || sourceFile.match(/\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().slice(0, 10)
    const id = options.id || stableMarketReportId(sourceFile)
    const snapshotDate = parseListingDate(snapshot)
    const rows = normalizedRows.map(rowModel).map((row) => ({
      ...row,
      ageDays: row.listingDate && snapshotDate
        ? Math.floor((snapshotDate.getTime() - row.listingDate.getTime()) / DAY_MS)
        : null,
    }))
    ```
  - `ozon-react/src/components/reports/UploadedMarketReport.jsx:53`：
    ```jsx
    <span>数据快照 {report.snapshot}</span>
    ```
- **实测复现**：
  测试证实：传入未带日期的文件名 `items.xlsx`，`report.snapshot` 返回当前机器日期 `2026-10-12`。
- **用户可见后果**：
  1. **伪造数据快照**：若一份 2026 年 3 月采集的历史数据在 2026 年 10 月导入，页面赫然标注“数据快照 2026-10-12”，将 7 个月前的旧数据伪称为最新数据；
  2. **180 天新品全盘漏判**：因 `ageDays` 计算以当前日期为终点，3 月当时上架仅 10 天的真实爆款新品，到 10 月被算成 `ageDays = 220 天`，被 180 天新品过滤器无情剔除，导致增长机会被彻底误杀。

---

### 3. P0-3：重复 SKU 与重复 URL 未做行级去重，导致样本销售额与销量被虚高累加

- **问题描述**：
  在清洗与建模过程中，系统对重复 SKU 和重复产品链接只进行了计数提示，并未在聚合层进行去重。
- **代码行号证据**：
  - `ozon-react/src/utils/marketReportAnalysis.js:534, 538, 861-862`：
    ```javascript
    const totalRevenue = rows.reduce((sum, row) => sum + (row.revenue || 0), 0)
    const totalSales = salesRows.reduce((sum, row) => sum + row.sales, 0)
    // 仅在 quality 中进行简单统计：
    duplicateSku: skuValues.length - new Set(skuValues).size,
    duplicateUrl: urlValues.length - new Set(urlValues).size,
    ```
- **实测复现**：
  传入两条完全相同 SKU（销售额 1000₽ 与 1500₽）的重复记录，`totalRevenue` 返回 `2500₽`，`rowCount` 返回 `2`，`duplicateSku` 计数为 `1`。
- **用户可见后果**：
  很多 Ozon 卖家中心多类目导出或榜单重叠数据中存在同一 SKU 的多行表现。未去重直接将所有行的销售额加总，导致品类总规模和头部单品份额被严重重复计算，直接诱导错误的选品规模判断。

---

## 三、P1 级关键缺陷（决策价值缺失 / 身份链断裂 / 孤儿恢复缺失）

### 4. P1-1：报告中心与 T6 候选池断裂，缺乏面向工厂的标准化选品卡与安全身份桥接

- **问题描述**：
  报告中心当前是纯展示性的孤岛，没有与 T6 候选池（`t6Store.js`）打通。报告中识别的 180 天优质新品或头部机会，无法一键或人工转为候选对象。
- **代码行号证据**：
  - `ozon-react/src/components/reports/MarketReportCenter.jsx` 与 `UploadedMarketReport.jsx` 全文无任何 `ensureCandidate` 或 `promoteToT6Candidate` 调用；
  - `ozon-react/src/utils/t6/candidateProjectEvidence.js:83-195`：目前仅定义了 `WB_MARKET_INTELLIGENCE` 的立项证据快照规范，缺乏 Ozon 市场报告来源的证据模型与身份规范。
- **用户可见后果**：
  分析人员在报告中心看完了建议与图表，却无法在系统内推进给国内工厂立项核算；必须线下人工抄录，极易丢失数据来源、URL 和原始快照依据。

---

### 5. P1-2：双阶段上传缺乏原子性保护，源文件孤儿化且报告发布失败后不可恢复

- **问题描述**：
  导入发布分为两个串行网络调用：先备份原始文件（`market-report-sources`），再发布报告 JSON（`market-report-json`）。若阶段 1 成功但阶段 2 失败，服务器上留下孤儿源文件，前端没有任何感知与恢复入口。
- **代码行号证据**：
  - `ozon-react/src/components/reports/MarketReportCenter.jsx:132-150`：
    ```javascript
    const sourceResult = await uploadServerFile(SOURCE_NAMESPACE, file)
    // 若此处网络中断或抛错，或者 reportResult 上传失败：
    const reportResult = await uploadServerFile(REPORT_NAMESPACE, reportFile)
    ```
  - `ozon-react/src/utils/serverFiles.js:192-194`：
    弱网下加入 IndexedDB 排队后直接抛出异常，导致阶段 2 的 JSON 完全未被构建与排队。
- **用户可见后果**：
  上传失败后没有中间状态提醒；源文件占用了服务端空间，但报告中心永远显示为空，操作员无法一键“重新从已上传源文件生成报告”。

---

### 6. P1-3：样本内探索分易与全域优势混淆；结构门禁商业放行缺乏规范审计载荷

- **问题描述**：
  1. `buildTypeOpportunities` 中的决策标签（“优先小批测试 / 补证据后测试 / 观察”）是样本内 5 个维度的百分位相对排序，方法说明仅在底端小字展示，容易被新手误读为“绝对高成功率”推荐；
  2. 在 T6 项目阶段流转中，若因利润或数据不达标触发 `RED` / `YELLOW` 门禁，当前代码（`stageTransition.js:24-30`）仅要求输入一段任意非空文本即可 `gate_override` 强行推进，缺乏结构化的“商业放行评审表”和经办人角色审计。
- **代码行号证据**：
  - `ozon-react/src/utils/marketReportAnalysis.js:345-357`
  - `ozon-react/src/utils/t6/stageTransition.js:24-30`
- **用户可见后果**：
  放行理由随意填写（如“领导同意”），缺乏严谨的商业风险知情确认（如明确已知毛利不达标但因战略拓品放行），难以厘清后续亏损责任。

---

## 四、P2 级体验与性能隐患（批量加载风暴 / 长列表响应）

### 7. P2-1：报告中心初次加载引发 `O(N)` 完整 JSON 并行请求且强制禁用缓存

- **问题描述**：
  每次挂载 `MarketReportCenter`，前端通过 `Promise.all` 对服务器上的所有 JSON 发起全量 GET 请求，且显式附带 `cache: 'no-store'`。
- **代码行号证据**：
  - `ozon-react/src/components/reports/MarketReportCenter.jsx:87-100`：
    ```javascript
    const files = await listServerFiles(REPORT_NAMESPACE)
    const loaded = await Promise.all(files
      .filter((file) => file.name.toLowerCase().endsWith('.json') && file.downloadUrl)
      .map(async (file) => {
        const response = await fetch(file.downloadUrl, { credentials: 'same-origin', cache: 'no-store' })
        const report = await response.json()
        return isUploadedMarketReport(report) ? { ...report, serverDownloadUrl: file.downloadUrl } : null
      }))
    ```
- **用户可见后果**：
  当团队长期使用、服务器积攒了数十份历史报告时，进入该页面将瞬间迸发数十个全量 HTTP 下载请求，造成网络拥堵和界面白屏加载卡顿。

---

### 8. P2-2：大报告表格未做虚拟化，移动端查阅宽表格依赖大范围横向滑动

- **问题描述**：
  `UploadedMarketReport.jsx` 和 `MarketDecisionBrief.jsx` 中的头部商品表格与 180 天新品表格，使用固定宽度的传统 HTML 表格（`min-w-[860px]` / `min-w-[900px]`）。
- **代码行号证据**：
  - `ozon-react/src/components/reports/UploadedMarketReport.jsx:133`
  - `ozon-react/src/components/reports/MarketDecisionBrief.jsx:96`
- **用户可见后果**：
  在手机端或平板窄屏查看时，用户必须反复左右横滑才能核对价格、销量与链接，缺少适合移动场景的折叠卡片（Card List）适配。
