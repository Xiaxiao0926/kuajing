# BUSINESS_RULES.md — 业务规则（唯一权威描述）

> ⚠️ 本文档是业务公式的**唯一权威描述**，由「需求规格说明书 + 已验证代码」提炼而成，**不含任何 AI 自行补充的公式**。
> 任何 AI 修改计算引擎前必须核对本文档；修改公式必须**同时**更新本文档与黄金案例（AGENTS.md §3.1）。
> 来源标注：`[规格§x.y]` = 《WB跨境利润与物流费用核算面板-需求规格说明书》（`运费计算/WB跨境利润与物流费用核算面板-需求规格说明书.md`）；`[代码]` = 引擎实现。

---

## 1. WB 计费重量（DPX 标准线路）

- 按**实际重量**计费，不使用体积重。[规格§3.2]
- 实际重量每 **100g 向上取整**：

```text
billable_weight_g = ceil(actual_weight_g / 100) × 100
billable_weight_kg = billable_weight_g / 1000
```

| 实际重量 | 计费重量 |
|---:|---:|
| 1g / 80g / 100g | 0.1kg |
| 101g | 0.2kg |
| 270g / 300g | 0.3kg |
| 301g / 400g | 0.4kg |
| 1050g | 1.1kg |

- 单件重量上限 20kg；超重**禁止计算并提示**。[规格§4.5]

## 2. WB 运费公式（单包裹）

```text
parcel_logistics_cny = billable_weight_kg × kg_rate_cny + fixed_fee_cny
```

DPX 深圳（线路 ID `DPX-SZ-382822`）：

| 计费重量区间 | 公式 | 示例 |
|---|---|---|
| 0.1–0.3kg | `重量 × 58 + 2` | 300g → 0.3×58+2 = **¥19.40** |
| 0.4–20kg | `重量 × 43 + 8` | 301g → 0.4×43+8 = **¥25.20** |

**300g→301g 跳档价差 ¥5.80**，291–300g 区间必须预警。[规格§4.5/4.6]

## 3. WB 线路费率表（2026-02-09 生效；0726 版数值不变仅换版本）

| 线路 | 时效 | 0.1–0.3kg | 0.4–20kg | 限制 |
|---|---:|---:|---:|---|
| DPX标准 / WB超级经济 | 15–30天 | 58元/kg＋2元/单 | 43元/kg＋8元/单 | 三边和≤200cm；单边≤120cm（超级经济≤115cm） |
| WB Plus东莞/珲春 | 7天 | 48元/kg＋9元/单 | 48元/kg＋9元/单 | 三边和≤200cm；单边≤120cm |
| 香港快线 | 10天 | 89元/kg＋17元/单 | 89元/kg＋17元/单 | 三边和≤200cm；单边≤60cm |
| 东莞快线 | 10天 | 122元/kg＋19元/单 | 122元/kg＋19元/单 | 三边和≤200cm；单边≤100cm |

[规格§4.4]

## 4. WB 多包裹规则

- **每个物流标签独立取整、独立判断区间、独立收固定费**；总费用 = 各包裹之和。[规格§5]
- 两个 270g 包裹分别发：`2 × (0.3×58+2) = ¥38.80`。
- 禁止先把多包裹重量相加再取整一次，除非平台确实只生成一个标签。
- 不得擅自把同一买家的多个物流标签合并计算。

## 5. WB 费率版本选择

- 按**订单日期**选择当日有效的费率版本（`effective_from` ≤ 订单日期 ≤ `effective_to`，取生效日期最新者）。[规格§3.3]
- 版本历史：`2026-02-09` 版（effectiveTo 2026-07-21）、`2026-07-22` 0726 版（数值一致）。[代码 wbConfig.js/wb_data.py]
- 历史订单保留原计算结果；重算必须明确提示并保留重算前结果。

## 6. WB 平台结算口径

```text
sales_revenue_cny = seller_revenue_base_rub / rub_per_cny
commission_cny   = commission_base_rub × commission_rate% / rub_per_cny
platform_net_settlement_cny = sales_revenue_cny − commission_cny
                              − order_logistics_cny − acquiring_fee_cny
                              − seller_promotion_cost_cny − platform_other_deduction_cny
```

- 收入默认用 `seller_revenue_base_rub`（平台报表确认）；无报表时才可用买家实付，且**必须标注"估算口径"**。[规格§6.2]
- 汇率 `rub_per_cny` = 1 人民币可兑换的卢布数，由用户手工维护，支持生效日期；**不得自动填入实时汇率**。[规格§6.1]
- 佣金率按 SKU 类目或订单实际值配置，**不得预设统一佣金率**。

## 7. WB 经营利润口径

```text
operating_profit_cny = platform_net_settlement_cny
  − product_purchase_cost_cny − packaging_cost_cny
  − china_inbound_to_dpx_cost_cny − tax_cost_cny
  − certification_allocation_cny − other_operating_cost_cny

profit_margin   = operating_profit_cny / sales_revenue_cny
logistics_ratio = order_logistics_cny / sales_revenue_cny
cost_roi = operating_profit_cny /
  (purchase + packaging + china_inbound + order_logistics + seller_promotion)
```

- 分母为 0 时**不得报错或显示 Infinity**，显示"不可计算"。[规格§6.4]
- 税费方式（`tax_method`）：`none`（不计税，仅敏感性分析）/ `revenue`（按销售收入%）/ `settlement`（按净结算%）/ `manual`（手工每单）。[规格§6.5]
- 系统**不得自行判断**俄罗斯税制/进口税/增值税/中国出口税务处理；税费界面必须显示"不构成税务或合规结论"。

## 8. WB 反向配送赔偿（WB 服务条款 13.1.14）

### 8.1 事件类型与默认赔偿倍数

| 事件类型 | 中文标签 | 默认倍数 | 待账单确认 |
|---|---|---:|:---:|
| `none` | 正常签收 | 0×CSG | 否 |
| `cancelled_before_handover` | 交仓前取消 | 0×CSG | 否 |
| `not_exported_from_china_after_handover` | 未出中国即退回 | 1×CSG | 否 |
| `buyer_returned` | 买家退货 | 1×CSG | 否 |
| `refused_or_unclaimed` | 拒收/未领取 | 1×CSG（暂按1测算） | **是** |
| `customs_failed_returned_to_china` | 清关失败退回中国 | 2×CSG | 否 |
| `manual` | 手工填写 | 用户填写 | 否 |

[规格§7.6.1]

### 8.2 赔偿计算

```text
csg_total_cny = Σ(parcel_csg_cny)              # 多包裹独立计算后汇总
estimated_reverse_compensation_cny = csg_total_cny × multiplier
reverse_compensation_used_cny = actual_reverse_compensation_cny ?? estimated
```

- **CSG** = 正向跨境物流费基数（按 §2 公式计算的单包裹/订单正向物流费）。
- 清关失败默认按 **2×CSG**，**不得自动叠加为 3×CSG**（不得在 2× 之外再加一笔正向费）。
- 拒收/未领取必须标记"待账单确认"。
- 交仓前取消视为商品仍在卖家手中，正向费和赔偿均为 0。

### 8.3 物流总成本

```text
forward_logistics_used_cny = actual_forward_logistics_cny
                             ?? (forward_fee_applied ? csg_total_cny : 0)
total_logistics_cost_cny = forward_logistics_used_cny
  + reverse_compensation_used_cny + other_reverse_cost_cny
```

- `forward_fee_applied` 默认值：交仓前取消/清关失败/未出中国 = `false`；买家退货/拒收未领取 = `true`。[规格§7.6.3]
- **任何场景都不得对 DPX 跨境订单叠加俄罗斯境内"8元首升+2元续升"体积运费。**[规格§1 禁止事项]

### 8.4 预计 vs 实际

- 实际账单值存在时**优先使用实际值**，预计值与差异（`variance = actual − estimated`）必须保留展示。[规格§7.5]

## 9. Ozon CEL 渠道运费（rFBS 自发货）

来源：`运费计算/CEL产品资费表 V5.23.xlsx`；汇率 `R = 0.09`（1₽ = ¥0.09）。[代码 ozonEngine.js]

| 渠道组 | 时效 | 费率结构 | 限制 |
|---|---|---|---|
| Extra Small 超级轻小件 | Express 5-10天 / Standard 10-15天 / Economy 15-25天 | 46.8 / 36.4 / 26 元/kg + 3.12 元 | ≤0.5kg；三边和≤90cm；单边≤60cm；价≤1500₽ |
| Budget 低客单价 | 同上三档 | 34.32 / 26 / 17.68 元/kg + 23.92 元 | 0.5–30kg；三边和≤150cm；价≤1500₽ |
| Small 小件 | 同上三档 | 46.8 / 36.4 / 26 元/kg + 16.64 元 | ≤2kg；三边和≤150cm；价1501–7000₽ |
| Big 大件 | Standard / Economy | 26 / 17.68 元/kg + 37.44 元 | 2–30kg；三边和≤310cm；单边≤150cm；体积重÷12000 |
| Premium Small | 三档 | 46.8 / 36.4 / 26 元/kg + 22.88 元 | ≤5kg；三边和≤250cm；价7001–250000₽ |
| Premium Big | Standard / Economy | 29.12 / 23.92 元/kg + 64.48 元 | 5–30kg；体积重÷12000 |
| HK 香港空运 | 7-12天 | **96 元/kg（=9.6元/100克）+ 19元/票；百克进位**（已按 CEL 原表核验，见 `T2-Gate0-CEL-HK核验报告.md`） | ≤25kg；三边和>60cm 时体积重÷6000 与实重取最大值；三边和≤310cm、单边≤150cm；价1–500000₽ |

- 体积重渠道（Big/Premium Big/HK）：`charge_weight = max(实际重量, 体积重)`。

### 9.1 单规格测算口径（`SingleTab` → `calcChannelProfit`）

- 用户输入字段名为**售价（₽）**，**直接作为计算价**，不乘 0.6。
- `calcChannelProfit(ch, price, ...)`：`priceRMB = price × R`，无任何 0.6 系数。
- 利润 = 折后价（即输入价）×R − 国内成本(采购+国内运费+贴标) − 跨境运费(含代理费) − 平台成本(佣金+广告+支付) − 退货损失。

### 9.2 多规格定价口径（`MultiTab` → `calcRow`）

- 用户输入字段名为**上架价**；`price = round2(listPrice × 0.6)` 得折后价。
- UI 明示「上架价 × 0.6 = 折后价」。
- 其余成本结构与 9.1 相同。

### 9.3 两者当前差异（如实记录，未统一）

```text
单规格 SingleTab：输入"售价" → 不乘 0.6 → 直接计算
多规格 MultiTab ：输入"上架价" → ×0.6 → 以折后价计算
```

两者价格语义不同（一个输入成交价、一个输入挂牌价）。是否应统一口径，由需求方后续确认（TECH_DEBT TD-14），**T1 只记录不修改代码**。

## 10. 汇率状态（仓库事实）

**仓库基线（三处一致，均为 12）**：

| 位置 | 值 |
|---|---|
| React `DEFAULT_SETTINGS`（`wbConfig.js`） | `rubPerCny = 12`（1¥=12₽），生效 2026-08-11 |
| Python `DEFAULT_SETTINGS`（`wb_data.py`） | `rub_per_cny = 12`，生效 2026-08-11 |
| Python tracked `wb_data/settings.json`（仓库内） | `rub_per_cny = 12`，生效 2026-08-11 |

**历史运行态观察（非仓库事实）**：
- 2026-08-14 整改过程中，曾在本机 Python 运行态观察到 `settings.json` 值为 11.5（生效 2026-02-09）；当前 Git 仓库各分支均无法复现该状态。
- 因此**不得将 11.5 视为仓库事实**。

**T2 已解决（2026-08-14）**：配置单源化后，Python 读写均指向 `config/settings.json`（原 `wb_data/settings.json` 运行态副本已删除），React 经 generated 读同一文件——运行时副本覆盖风险在结构上消除（TECH_DEBT TD-1 关闭）。

## 11. 修改公式的流程（强制）

1. 需求方书面确认变更（附来源：平台官方费率/条款截图或公告）。
2. 更新本文档对应章节 + `CHANGELOG.md`。
3. 更新引擎（React + Python 双端，若涉及 WB）。
4. `npm test` 全绿；新增/更新测试用例覆盖新值；黄金案例（T2 后）全绿。
5. 记录费率版本（`effective_from`/`source_name`），旧版本保留用于历史订单。

## 12. 选品评分决策模型（T4 V1，冻结；λ=0.5 经 T4-4A 校准）

**六维权重（%）**：需求 25 / 竞争 15 / 价格空间 10 / 利润可行性 20 / 物流适配 15 / 运营稳健 15（和=100，sync-config 校验）。

**Demand（T4-4A 两层）**：`DemandScore = 0.5×MarketScale + 0.5×CandidateStrength`
- MarketScale = 60%×市场 sales_28d.p50 全局类型百分位 + 40%×units_28d.p50（仅 HIGH/MEDIUM；LOW/LMC → N/A，回退候选强度，771 个 LMC SKU 路径不变）
- CandidateStrength = 候选对自身市场分位（sales 35 / units 25 / conv 15 / cart_add 10 / exposure 5 / visits 5 / reviews 5）
- 全局类型池只做市场规模排名，**禁止冒充对应市场基准**；`bsr_leader_share` 不入公式（仅观察标签）。

**评级**：A≥80 / B≥65 / C≥50 / D<50；可用维度权重<50% → NEEDS_DATA → **不可评级**（totalScore 仅诊断值保留）。

**Gate/Flag**：BLOCKED_LOGISTICS（无 CEL 渠道，logistics=0）、MARGIN_RISK（毛利<0，利润维度封顶 20）、REVIEW_REQUIRED（合规词表）、LOW_MARKET_CONTEXT（无 BSR 匹配，评级暂定）、NEEDS_DATA（证据<50%）。

**Decision 层（与 grade 分离）**：BLOCKED→DO_NOT_SAMPLE → HOLD→VERIFY_COST → REVIEW→COMPLIANCE_REVIEW → RESEARCH→COLLECT_MARKET_DATA → ELIGIBLE（A→SAMPLE_VALIDATION、B→PILOT_TEST、C→WATCH、D→DEPRIORITIZE）。

**Supply Gap（独立解释信号，不进总分）**：Gap = (0.45×需求秩 + 0.55×缺货秩) × (0.80 + 0.20×开放度/100)；HIGH_GAP ≥70/≥60/≥65，MEDIUM_GAP ≥55/≥50/≥55；无市场基准或可比类型<5 → N/A。

**证据感知**：子指标覆盖<50% → 维度 N/A；维度层按可用权重重归一；缺失子项按剩余权重重归一，禁止用 0/50 补值。

**修改纪律**：任何权重/公式变更 = 需求方书面确认 + 更新本节与 `T4-1B-评分模型设计冻结.md` + 重跑 scoring golden/monotonicity/审计三件套 + 重跑 λ 校准验证（若涉及 demand）。
