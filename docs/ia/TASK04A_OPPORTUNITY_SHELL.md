# KUAIJING-IA-REFACTOR-V1 · TASK 04A 实施记录

## 1. Context 标准字段

在 `ozon-react/src/utils/marketIntelligence/opportunityContext.js` 中定义纯函数适配器 `buildOpportunityContext(niche, runContext = {})`，输出标准只读上下文：

```js
{
  nicheUid,    // 真实稳定标识 (niche.uid ?? niche.niche_uid ?? null)，缺失严格为 null，禁止假造
  name,        // 商品/利基名称 (niche.name ?? niche.niche_name ?? '')
  category,    // 品类名称 (niche.cat ?? niche.category ?? '')
  runId,       // 数据批次号 (runContext.runId ?? niche.run_id ?? niche.runId ?? '')
  mos,         // 市场机会评分 (niche.mos ?? null)
  pfs,         // 选品可行性评分 (niche.pfs ?? niche.cfs ?? null)，前台统一显示 PFS
  gmv,         // 季度大盘 GMV (niche.gmv ?? null)
  growth,      // 环比增速 (niche.growth ?? '')
  buyout,      // 签收率 (niche.buyout ?? null)
  sellers,     // 活跃卖家数 (niche.sellers ?? null)
  verdict,     // 验证状态 ('TEST' | 'VERIFY' | 'WATCH' | 'DROP' | 'UNASSIGNED')
  risks,       // 风险标签数组 (Array.isArray(niche.risks) ? niche.risks : [])
  source,      // 固定标示 'WB_MARKET_INTELLIGENCE'
  raw          // 原始数据引用（仅用于兼容未迁移字段）
}
```

---

## 2. NicheDetailDrawer 修改

- **文件定位**：保留现有路径 `ozon-react/src/components/marketIntelligence/components/NicheDetailDrawer.jsx`，增加明确业务注释 `Business role: Opportunity Detail shell`。
- **上下文接线**：顶部通过 `useMemo` 调用 `buildOpportunityContext(niche, { runId })` 获取统一 `opportunity` 对象；所有子 Tab 统一消费 `opportunity`。
- **状态重置**：增加 `useEffect` 监听 `niche` 变化，点击不同商品时自动重置 `activeTab` 为 `'overview'` 并清空临时备注，杜绝上一商品的状态残留。
- **Header 结构标准化**：
  - 第一行：机会名称 + 所属类目 + MOS / PFS 评分 + 验证状态 Badge；
  - 第二行（次级信息）：批次编号 `RUN-XXXX` + 稳定全局唯一标识 `niche_uid`；若缺失则醒目提示「机会标识缺失」；
- **硬门禁实施**：当 `opportunity.nicheUid == null` 时，决策 Tab 中的「一键推送到 T6 候选池」按钮自动禁用，并显示「机会标识缺失，禁止执行候选流转动作。」警告，严禁伪造或生成临时随机 ID。

---

## 3. 5 Tab 映射关系

前台展示且仅展示 5 个标准业务 Tab：

| Tab Key | 前台标签 | 图标 | 数据来源与核心字段 |
|---|---|---|---|
| `overview` | **概览** | `TrendingUp` | GMV、环比增长率、买家签收率、平均客单价、活跃动销卖家、供需缺口比 (DSI)、GMV 绝对增量 |
| `demand` | **搜索需求** | `Search` | 关联总搜索量、DSI、加购转化率、下单转化率、核心俄语搜索词 TOP 词云 |
| `competition` | **竞品与价格** | `Users` | 动销卖家总数、市场机会等级 (Tier)、平均客单价、签收率、竞争切入难度研判 |
| `risk` | **风险** | `ShieldAlert` | 风控标签 (Risk Tags)、单件预估净重、EAC 认证合规要求（事实值）、包装尺寸规格、车型机型适配风险、工程验证理由 |
| `decision` | **决策** | `CheckCircle2` | 快速调整验证结论 (`TEST`/`VERIFY`/`WATCH`/`DROP`)、调整备注、一键推送到 T6 候选池（门禁拦截）、录入 1688 采购报价与包装参数 |

---

## 4. 未接入功能（严格按计划隔离）

- **MarketResearch.jsx**：本轮禁止引入，竞品与价格 Tab 仅呈现现有大盘统计，留待 TASK 04B 接入双模式 Wrapper。
- **PurityPipelinePage.jsx**：本轮未接入，留待 TASK 04C 处理纯度清洗流。
- **Opportunity -> Candidate 字段断点**：未修改 `promoteToT6Candidate` 实现，留待 TASK 05 统一治理。
- **未安装新路由依赖**：未引入 `react-router`，保持现有 Drawer 架构。

---

## 5. 测试结果

1. `tests/ia-opportunity-shell.test.mjs`：**9 项全部通过**
   - 验证 `opportunityContext.js` 存在；
   - 验证基础字段映射正确；
   - 验证 `cfs -> pfs` 平滑兼容；
   - 验证缺失 UID 严格返回 `null`（禁止假造）；
   - 验证 `NicheDetailDrawer` 源码调用 `buildOpportunityContext`；
   - 验证 5 个业务 Tab 结构精准匹配；
   - 验证物理隔离（未引入 `MarketResearch` 与 `PurityPipelinePage`）；
   - 验证 T6 推流与采购验证接线完好；
   - 真实活跃批次数据烟雾测试（发泡胶枪、热缩管、拖车支轮）全部通过。
2. `tests/ia-navigation-acceptance.test.mjs`：**全部通过**
3. `npm test`：**953 项单元测试全绿**
4. `npm run test:golden`：**76 项黄金用例全绿**
5. `npm run test:sync`：**双端对拍零差异**
6. `npm --prefix ozon-react run build`：**Vite 构建成功**
