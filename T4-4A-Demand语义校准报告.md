# T4-4A Demand 语义校准报告

> 授权：T4-3 正式通过，需求方选择 **B（口径变更）**。
> 任务：只修正 demand 内部语义（市场规模 + 候选相对强度），六维总权重不动、`bsr_leader_share` 不入公式、不接 UI。
> 结论：**λ = 0.5 冻结**（30/40/50 三组校准取最小可行值，规则不再上探）。

---

## 1. 变更内容（已冻结）

```text
DemandScore = λ × MarketScaleScore + (1 − λ) × CandidateStrengthScore

MarketScaleScore = 60% × pct(市场 sales_28d.p50 于全局产品类型池)
                 + 40% × pct(市场 units_28d.p50 于全局产品类型池)

CandidateStrengthScore = 原 demand 算法（sales/units/conv/cart_add 对市场分位 +
                         exposure/visits/reviews 对候选池分位，证据感知重归一）
```

- **适用范围**：MarketScale 仅 HIGH/MEDIUM（可靠产品类型基准）计算；LOW（domain/包含匹配）与 LOW_MARKET_CONTEXT → MarketScale=N/A，DemandScore=候选强度，路径与 T4-2/3 **逐位一致**（771 个 LMC SKU 分数完全不变，见 §4）。
- 全局产品类型池只做"市场规模排名"，**不冒充对应市场基准**（T4-1A 禁令不变）；`bsr_leader_share` 禁止入公式，仅观察标签。
- 配置：`config/scoring_rules.json` → `dimensions.demand.{scale_weight=0.5, scale_sales_weight=0.6, scale_units_weight=0.4}`；T4-1B §2.2 已同步冻结。
- 输出契约：demand 维度新增 `marketScaleScore` / `candidateStrengthScore` 两个分量（UI 可分开展示"市场规模/候选相对表现"）。

---

## 2. λ 校准实验（三组）

| 指标 | λ=30% | λ=40% | λ=50% |
|---|---|---|---|
| Demand Top20% → market sales P50 | 1,346,279 ❌ (baseline 1,593,201) | 1,563,343 ❌ (仍低 1.9%) | **1,665,527 ✅ (+4.5%)** |
| Demand Top20% → market units P50 | 3,554 ❌ (baseline 3,840) | 3,888 ✅ (+1.2%) | **4,005 ✅ (+4.3%)** |
| Demand Top20% → leader-share（仅记录） | 36.5% | 38.2% | 40.3% (baseline 38.7%) |
| A / B / C / D / 不可评级 | 1 / 190 / 448 / 170 / 191 | 1 / 183 / 458 / 167 / 191 | 1 / 191 / 448 / 169 / 191 |
| mapped 均分 | 60.2 | 60.6 | **61.0** |
| LMC 均分（n=771） | **54.7** | **54.7** | **54.7**（三组逐位一致） |

**决策**：30% 双 REVERSED；40% 只有 units 转正、sales 仍不达标；50% 两行同时转正。按规程取最小可行值 **λ=50%**，不上探 60/70（防过拟合）。

---

## 3. 验收要求逐项

| 验证 | 要求 | 结果 |
|---|---|---|
| Demand Top20% → market sales P50 | > baseline | ✅ 1,665,527 > 1,593,201 |
| Demand Top20% → market units P50 | > baseline | ✅ 4,005 > 3,840 |
| candidate sales ↑ → demand 不降 | 单调性 | ✅ M1（strength 单调 + scale 常量） |
| 删除 benchmark | 不得切全局 fake | ✅ M7 + 单测：competition/price/supplyGap N/A，demand 走候选池 |
| LMC 771 SKU | 分数路径不变 | ✅ 三组 λ 下均分恒为 54.7（MarketScale 仅 HIGH/MEDIUM，LMC 逐位不变） |
| leader-share | 只记录 | ✅ 记录：demand Top20% 40.3%（λ=0.5）；total Top20% 36.9% vs 38.7%（0.95×，方向性结论维持"总分主动规避高度头部化市场"） |

维度验证矩阵（λ=0.5，n=229）：demand 三行（leader-share 记录 / sales P50 ✅ / units P50 ✅）+ competition 2 ✅ + price ✅ + profitability ✅ + logistics ✅ + operations ✅ + total 2 观察。**T4-3 的 demand-relative ✅ / demand-market-size ❌ 双缺口已闭合。**

---

## 4. Golden 更新（严格最小化，未重录）

规则："先改模型 → 看哪些失败 → 判断是否为授权变更必然结果 → 只更新这些"。

| 固件 | 变化 | 理由 |
|---|---|---|
| `high-sales-loss.json` | `dimensions.demand.score≥70` → `dimensions.demand.candidateStrengthScore≥70` | demand 定义变更后总分混入市场规模（λ=0.5），原断言意图是"高销量=候选需求强"，改验分量保持原意图 |
| `grade-boundaries.json` | 边界对 gross 21/20 → **49/48** | demand 下降后 A/B 临界点移动，固件必须重新落在临界两侧（断言语义不变：上方≥80 且 A，下方<80 且非 A） |
| 全部 10 固件 | 新增 `marketScalePool` 输入块 | 引擎新输入契约的加法式补充，无任何断言削弱 |

未动的合同全部原样通过：Gate（BLOCKED/MARGIN_RISK/REVIEW）、coverage（0.75/0.9）、物流 block、margin cap、LOW_MARKET_CONTEXT 暂定评级与文案三级口径。**56/56 全绿。**

---

## 5. 测试与回归（全绿）

| 套件 | 结果 |
|---|---|
| scoring unit | **71/71**（新增 T4-4A 组 9 断言：混合公式、MEDIUM 可用、LOW/LMC 路径与旧路径逐位一致、池缺失回退、scale 缺一侧重归一） |
| golden | **56/56** |
| monotonicity | **20/20**（7 组不变） |
| `npm test` | wbEngine 65 + scoring 71 + monotonicity 20 + golden 56 + python 31 |
| `test:golden` / `test:sync` / `test:web-persistence` / `vite build` | 76/76 / 零差异 / 通过 / 通过 |

1000 SKU 终态分布（λ=0.5）：**A 1 / B 191 / C 448 / D 169 / 不可评级 191**；mapped 均分 61.0，LMC 均分 54.7（与 T4-2 基线 54.7 完全一致，无虚高）。

---

## 6. 语义结论

- 旧问题：demand 名不副实——只量"候选在赛道里有多强"，小市场强者压过大市场中上者（Top20% 对应市场 sales P50 66.3 万 vs 159.3 万）。
- 修复后：demand = 市场规模（λ=0.5）+ 候选相对强度（0.5），两个分量独立输出，Top20% 对应市场 sales/units 双双转正。
- 六维总权重、评级线、Gate、decision 层、supply gap 全部未动；`bsr_leader_share` 仍为观察标签。
