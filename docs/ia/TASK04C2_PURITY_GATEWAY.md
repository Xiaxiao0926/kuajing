# TASK 04C-2: Opportunity「纯度分析」业务入口与 Standalone Gateway 实施文档

## 1. 为什么采用 Gateway 而不是 Embedded

在 TASK 04C-1 契约审计中，明确了纯度流水线（`PurityPipelinePage`）的底层业务本质：
1. **分析对象是整份热销大盘 Excel 数据集**：它依赖全量商品标题投票判定品类，并对整份数据进行规格归一与 A/B/C 分层。
2. **禁止关键词预过滤**：流水线内无搜索机制，若强行在挂载前按 `Opportunity.name`（如“发泡胶枪”）预过滤行，会导致品类检测得票率不足 30%，直接触发 `NEEDS_DATA` 崩溃。
3. **多实例持久化冲突**：抽检模块使用全局固定的 `localStorage` 键（`purity-checks-v1`, `purity-sample-history-v1`），抽屉内若再挂载一个实例，会发生读写状态覆盖风险。
4. **界面尺寸与体验开销**：原页面纵向高度超过 2000px，且包含 5 列网格和 7 列宽表格，直接挤进 680px 宽的抽屉会产生极差的视觉体验。

因此，本轮严格采用 **Contextual Gateway（业务上下文网关）➔ Standalone Purity Tool（独立纯度工具）** 的架构方案，在 Opportunity Detail 内提供合理的业务衔接位置与跳转通道，不伪造“当前机会已纯度分析”的假象。

---

## 2. Opportunity Detail 6 大业务 Tab

抽屉 Tab 结构由 5 个扩展为严格顺序的 6 个：
1. `overview`（概览）
2. `demand`（搜索需求）
3. `competition`（竞品与价格，嵌入式 MarketResearch 工具）
4. `purity`（纯度分析，Contextual Gateway 网关）
5. `risk`（风险）
6. `decision`（决策与流转）

---

## 3. Node Navigation Callback 链

为了从抽屉内唤起独立纯度页面，建立了唯一的最小无破坏回调链：

```text
[App.jsx]
  ├── 定义: onOpenNode={(nodeId) => setActiveNode(nodeId)}
  └── 传递至: <MarketIntelligenceApp onOpenNode={...} />
        │
        ▼
[MarketIntelligenceApp.jsx]
  ├── 接收: onOpenNode = null
  └── 透传至: <NicheDetailDrawer onOpenNode={onOpenNode} />
        │
        ▼
[NicheDetailDrawer.jsx]
  ├── 定义: handleOpenPurity = () => { onClose?.(); onOpenNode?.('__purity_analysis__') }
  └── 传递至: <OpportunityPurityGateway onOpenPurity={handleOpenPurity} />
        │
        ▼
[OpportunityPurityGateway.jsx]
  └── 点击 CTA 按钮「打开纯度分析工具」
        ├── 1. 自动关闭 Drawer
        └── 2. 切换 activeNode 为 '__purity_analysis__' 打开全屏纯度工具
```

---

## 4. Standalone Purity 保持情况

- **独立路由保持**: `App.jsx` 中 `activeNode === '__purity_analysis__'` 时原样挂载 `<PurityPipelinePage data={data} />`；
- **零参数篡改**: 跳转到独立页面后，不注入任何 `opportunity` 参数，不伪造筛选；
- **核心算法零改动**: `PurityPipelinePage.jsx`, `purityFilter.js`, `specParser.js`, `priceBands.js`, `credibility.js` 保持 100% 原始代码未修改；
- **多实例安全**: 由于抽屉内未挂载第二套流水线组件，`purity-checks-v1` 和 `purity-sample-history-v1` 零冲突风险。

---

## 5. 业务语义边界与规范

1. **当前机会上下文**:
   - 仅用于在 Gateway 顶部展示 `Opportunity 名称`、`市场类目`、`数据批次`、`Niche UID`；
   - 适用性固定显示：`适用性：需人工确认`，不做无依据的 AI 猜测。
2. **规则库支持品类展示**:
   - 固定展示当前规则库事实源（`config/market_analysis.json`）中已配置的 5 个品类：`发膜 / 护发喷雾 / 手套 / 枕头 / 吹风机`。
3. **显式业务边界提示**:
   - Gateway 常驻显著警告：
     > **当前市场机会不会自动映射为纯度分析品类。**
     > 纯度分析需要使用对应细分品类的完整热销 Excel 数据集。系统不会使用当前 Opportunity 名称或类目预过滤数据，以避免破坏品类识别与 A/B/C 分类结果。

---

## 6. 测试结果

| 测试套件 | 验证要点 | 结果 |
|---|---|---|
| `tests/ia-purity-gateway.test.mjs` | Gateway 文件存在、物理隔离未引入页面、展示 5 大品类、警告文案、Tab 配置与透传、核心算法零修改 | ✅ 10/10 通过 |
| `tests/ia-opportunity-shell.test.mjs` | 验证 6 个固定业务 Tab、Opportunity 字段构建与真实数据烟雾测试 | ✅ 9/9 通过 |
| `tests/ia-market-research-embedded.test.mjs` | 嵌入式市场调研隔离性与透传 | ✅ 10/10 通过 |
| `tests/ia-navigation-acceptance.test.mjs` | 8 大业务域与 12 导航项完好 | ✅ 通过 |
| `npm test` | FBP & Ozon 引擎 29 项 + 黄金评分案例 56 项 + Python WB 测试 44 项 | ✅ 129/129 通过 |
| `npm run test:golden` | 核心黄金案例 | ✅ 76/76 通过 |
| `npm run test:sync` | 双端对拍与配置生成一致性 | ✅ 零差异通过 |
| `npm run test:web-persistence` | 持久化与安全性测试 | ✅ 全部通过 |
| `npm --prefix ozon-react run build` | Vite 生产编译与打包 | ✅ 编译成功 (0 报错) |
