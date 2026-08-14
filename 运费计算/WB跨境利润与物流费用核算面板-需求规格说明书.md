# WB跨境利润与物流费用核算面板需求规格说明书（Trae执行版）

## 0. 文档信息

- 项目名称：WB跨境利润与物流费用核算面板
- 适用业务：中国卖家通过Wildberries跨境物流向俄罗斯买家销售商品
- 当前重点线路：DPX深圳（仓库代码：382822）
- 文档版本：V1.1（新增7.6反向配送事件类型与赔偿倍数章节，扩展订单数据结构和CSV模板）
- 运价基准：用户提供的《DPX运费(1).pdf》及《warehouse_and_tarrifs/0726.pdf》
- 费率版本：
  - 历史版本：2026年2月9日生效（已被取代，保留用于历史订单）
  - 当前版本：2026年7月22日生效（0726版本，费率数值与历史版本一致）
- 实施目标：由Trae在现有项目中直接开发可用面板，不仅输出策划、原型或伪代码

## 1. 给Trae的直接执行要求

请先检查现有项目目录、技术栈、数据结构和已有页面，再在现有架构内实施本需求。不要无必要地重建项目、替换技术栈或覆盖用户已有代码。

必须完成：

1. 可编辑的SKU成本资料库。
2. 单订单利润与物流费用计算器。
3. 批量订单核算及CSV导入、导出。
4. 按SKU、线路、订单状态和日期汇总的经营看板。
5. 可维护、可设置生效日期的物流费率管理。
6. DPX边界重量、异常订单和负毛利预警。
7. 自动化公式测试及可复核的计算明细。

禁止事项：

- 不得给DPX跨境订单额外叠加俄罗斯境内“8元首升＋2元续升”的体积物流费。
- 不得把PDF中的演示费率“125元/kg＋28元/件”或“109元/kg＋48元/件”当成DPX费率。
- 不得默认填写未经用户确认的类目佣金、税率、广告费率或汇率。
- 不得按体积重计算DPX运费；当前费率文件明确按实际重量计费。
- 不得把同一买家的多个物流标签擅自合并成一个包裹计算。

## 2. 项目目标

面板要解决以下实际问题：

1. 输入商品实际重量、售价、采购成本和佣金后，立即得到单件利润。
2. 判断SKU是否适合WB跨境销售，识别物流占比过高或负毛利商品。
3. 比较DPX、WB Plus、快线等不同线路的成本和时效。
4. 对已完成、未领取、拒收、退货等订单分别核算损益。
5. 在WB调价后，只修改费率配置，不修改计算代码。
6. 批量导入订单后，形成可供运营和领导查看的利润、物流费用面板。

## 3. 核心业务结论与系统口径

### 3.1 DPX是否包含俄罗斯尾程

DPX报价是从中国指定DPX/WB跨境仓进入WB运输网络，配送至俄罗斯买家履约终点的跨境配送价格。俄罗斯买家的履约终点通常为其选择的WB自提点（ПВЗ），不等同于必须送货上门。

对卖家核算而言，DPX正常正向配送不得再叠加一笔俄罗斯境内尾程物流费。

俄文合同对订单来源进行了区分：

- 俄罗斯境内起运：按俄罗斯境内体积费率计算；
- 从中国等俄罗斯境外国家起运：按卖家选择的跨境仓库及物流产品费率计算。

因此，跨境订单应使用本文件中的“重量费＋订单固定费”，俄罗斯境内“首升＋续升”公式不得同时使用。

### 3.2 DPX计费依据

- 按单个订单包裹的实际重量计费；
- 不使用体积重；
- 实际重量每100克向上取整；
- 单件重量不得超过20kg；
- DPX标准线路：长＋宽＋高不得超过200cm，最长单边不得超过120cm；
- 带电商品电池容量不得超过100Wh；
- 具体禁运品以WB最新禁售/禁运清单为准。

### 3.3 费率时点

系统必须根据订单日期选择当日有效的费率版本。不能只保存一个永远覆盖历史订单的“当前费率”。

费率变更后：

- 新订单使用新版本；
- 历史订单保留原计算结果和当时的费率版本；
- 重算历史订单时必须明确提示，并保留重算前结果。

## 4. 跨境物流计算规则

### 4.1 计费重量

设实际重量为 `actual_weight_g`，计费重量为 `billable_weight_kg`：

```text
billable_weight_g = ceil(actual_weight_g / 100) × 100
billable_weight_kg = billable_weight_g / 1000
```

示例：

| 实际重量 | 计费重量 |
|---:|---:|
| 1g | 0.1kg |
| 100g | 0.1kg |
| 101g | 0.2kg |
| 270g | 0.3kg |
| 300g | 0.3kg |
| 301g | 0.4kg |
| 1,050g | 1.1kg |

### 4.2 单包裹物流费用通用公式

```text
parcel_logistics_cny = billable_weight_kg × kg_rate_cny + fixed_fee_cny
```

多包裹订单：

```text
order_logistics_cny = sum(parcel_logistics_cny)
```

注意：每个物流标签独立取整、独立判断重量区间、独立收取固定费。系统不能先把多个包裹重量相加后只取整一次，除非平台确实只生成一个物流标签。

### 4.3 DPX标准/超级经济线路

适用仓库包括DPX深圳、东莞、广州、中山等，以及当前费率相同的超级经济线路。

```text
当0.1kg ≤ 计费重量 ≤ 0.3kg：
物流费 = 计费重量 × 58 + 2

当0.4kg ≤ 计费重量 ≤ 20kg：
物流费 = 计费重量 × 43 + 8
```

DPX深圳基础配置：

| 字段 | 数值 |
|---|---|
| 线路ID | DPX-SZ-382822 |
| 线路名称 | DPX深圳标准 |
| 时效 | 15–30天 |
| 0.1–0.3kg费率 | 58元/kg＋2元/订单包裹 |
| 0.4–20kg费率 | 43元/kg＋8元/订单包裹 |
| 计重方式 | 实际重量，每100g向上取整 |
| 最大重量 | 20kg |
| 三边之和 | ≤200cm |
| 最长单边 | ≤120cm |
| 生效日期 | 2026-02-09 |

### 4.4 其他线路初始配置

下列费率来自同一份费率表，必须做成可编辑配置，不能写死在页面组件中。

| 线路 | 时效 | 0.1–0.3kg | 0.4–20kg | 主要限制 |
|---|---:|---:|---:|---|
| DPX标准 | 15–30天 | 58元/kg＋2元/单 | 43元/kg＋8元/单 | 三边和≤200cm；单边≤120cm |
| WB超级经济 | 15–30天 | 58元/kg＋2元/单 | 43元/kg＋8元/单 | 多数仓单边≤115cm |
| WB Plus东莞/珲春 | 7天 | 48元/kg＋9元/单 | 48元/kg＋9元/单 | 三边和≤200cm；单边≤120cm |
| 香港快线 | 10天 | 89元/kg＋17元/单 | 89元/kg＋17元/单 | 三边和≤200cm；单边≤60cm |
| 东莞快线 | 10天 | 122元/kg＋19元/单 | 122元/kg＋19元/单 | 三边和≤200cm；单边≤100cm |

明斯克线路与当前中国至俄罗斯业务无关，V1默认隐藏，但费率数据结构应允许后续新增国家和线路。

### 4.5 DPX标准测试结果

| 实际重量 | 计费重量 | 运费公式 | 应得结果 |
|---:|---:|---|---:|
| 1g | 0.1kg | 0.1×58＋2 | ¥7.80 |
| 80g | 0.1kg | 0.1×58＋2 | ¥7.80 |
| 101g | 0.2kg | 0.2×58＋2 | ¥13.60 |
| 270g | 0.3kg | 0.3×58＋2 | ¥19.40 |
| 300g | 0.3kg | 0.3×58＋2 | ¥19.40 |
| 301g | 0.4kg | 0.4×43＋8 | ¥25.20 |
| 400g | 0.4kg | 0.4×43＋8 | ¥25.20 |
| 401g | 0.5kg | 0.5×43＋8 | ¥29.50 |
| 500g | 0.5kg | 0.5×43＋8 | ¥29.50 |
| 800g | 0.8kg | 0.8×43＋8 | ¥42.40 |
| 1,000g | 1.0kg | 1.0×43＋8 | ¥51.00 |
| 1,050g | 1.1kg | 1.1×43＋8 | ¥55.30 |
| 2,000g | 2.0kg | 2.0×43＋8 | ¥94.00 |
| 20,000g | 20.0kg | 20×43＋8 | ¥868.00 |
| 20,001g | 20.1kg | 超过上限 | 禁止计算并提示超重 |

### 4.6 关键重量跳点提醒

301g会从0.3kg档直接进入0.4kg档：

```text
300g：¥19.40
301g：¥25.20
增加1g，运费增加¥5.80
```

面板必须对以下重量区间给出“包装优化”提醒：

- 91–100g；
- 191–200g；
- 291–300g，重点预警；
- 此后每个整百克前10g。

提醒文案示例：

> 当前含包装重量301g，若减重至300g，DPX单件运费可由¥25.20降至¥19.40，每单节省¥5.80。

## 5. 多件及多包裹订单规则

系统必须同时支持：

1. 一个SKU一件、一个物流标签；
2. 同一SKU多件合并为一个包裹；
3. 同一订单拆成多个包裹；
4. 多SKU混装一个包裹；
5. 多SKU拆成多个物流标签。

每个包裹至少记录：

- 包裹ID；
- 对应订单ID；
- 包含SKU及数量；
- 实际总重量；
- 外包装重量；
- 长、宽、高；
- 物流线路；
- 物流标签号；
- 费率版本；
- 计费重量；
- 物流费。

示例：两个270g包裹分别发货：

```text
2 × (0.3×58＋2) = ¥38.80
```

如果平台实际生成一个540g的合并包裹：

```text
540g向上取整为0.6kg
0.6×43＋8 = ¥33.80
```

两种结果不能混用，必须以平台实际物流标签数量为准。

## 6. 订单利润核算口径

### 6.1 统一币种

V1以人民币作为经营分析本位币，同时保留卢布原值。

全局汇率字段：

```text
rub_per_cny = 1人民币可兑换的卢布数
```

转换公式：

```text
amount_cny = amount_rub / rub_per_cny
amount_rub = amount_cny × rub_per_cny
```

汇率必须由用户手工维护，支持生效日期。不得自动填入未经确认的实时汇率。

### 6.2 收入口径

不要直接把“买家实付”永远等同于卖家销售收入，因为可能存在平台补贴、卖家折扣或特殊促销。

订单至少同时保留：

- `buyer_paid_rub`：买家实际支付；
- `seller_revenue_base_rub`：平台报表确认的卖家收入/佣金计提基数；
- `platform_subsidy_rub`：平台承担的补贴；
- `seller_discount_rub`：卖家承担的折扣。

利润计算默认使用 `seller_revenue_base_rub`，没有平台报表时才允许临时使用买家实付，并明确显示“估算口径”。

### 6.3 平台结算预估

```text
sales_revenue_cny = seller_revenue_base_rub / rub_per_cny

commission_cny = commission_base_rub × commission_rate / rub_per_cny

platform_net_settlement_cny =
    sales_revenue_cny
  - commission_cny
  - order_logistics_cny
  - acquiring_fee_cny
  - seller_promotion_cost_cny
  - platform_other_deduction_cny
```

其中佣金率必须按SKU类目或订单实际值配置，不得在程序中预设一个统一佣金率。

### 6.4 单订单经营利润

```text
operating_profit_cny =
    platform_net_settlement_cny
  - product_purchase_cost_cny
  - packaging_cost_cny
  - china_inbound_to_dpx_cost_cny
  - tax_cost_cny
  - certification_allocation_cny
  - other_operating_cost_cny
```

```text
profit_margin = operating_profit_cny / sales_revenue_cny
```

```text
logistics_ratio = order_logistics_cny / sales_revenue_cny
```

```text
cost_roi = operating_profit_cny /
  (product_purchase_cost_cny
   + packaging_cost_cny
   + china_inbound_to_dpx_cost_cny
   + order_logistics_cny
   + seller_promotion_cost_cny)
```

分母为0时不得报错或显示Infinity，应显示“不可计算”。

### 6.5 税费设置

V1允许以下税费方式：

- 手工录入每单税费；
- 按销售收入百分比；
- 按平台净结算百分比；
- 暂不计税，仅用于敏感性分析。

系统不得自行判断俄罗斯税制、进口税、增值税或中国出口税务处理。税率设置旁必须显示：

> 税费仅按用户选择的测算口径计算，不构成税务或合规结论。

## 7. 异常订单和退货损益

订单状态至少包括：

- 待发货；
- 已交DPX；
- 运输中；
- 已签收；
- 买家拒收；
- 超期未领取；
- 签收后退货；
- 发货前取消；
- 丢失/破损；
- 已赔付；
- 其他异常。

### 7.1 已签收

正常确认收入，扣除佣金、DPX运费和全部经营成本。

### 7.2 拒收或超期未领取

WB服务条款下，商品送达、存储期届满或买家拒收均可能构成正向配送服务已经发生。因此默认规则为：

- 销售收入：0或冲回；
- 正向DPX运费：保留；
- 俄罗斯买家至WB合作仓的标准反向配送：依据当前中国跨境条款，默认标记为已包含；
- 从俄罗斯退货仓运回中国、销毁或特殊处理：不视为包含，按实际金额录入；
- 可回收商品价值：根据用户设置的库存回收率计算。

### 7.3 签收后退货

```text
inventory_loss_cny = product_purchase_cost_cny × (1 - inventory_recovery_rate)
```

```text
failed_order_loss_cny =
    forward_logistics_cny
  + packaging_cost_cny
  + china_inbound_to_dpx_cost_cny
  + non_refunded_commission_cny
  + return_to_china_or_disposal_cost_cny
  + inventory_loss_cny
  + other_failure_cost_cny
```

`inventory_recovery_rate`取值0%–100%，默认值不得替用户预设。

### 7.4 发货前取消

默认物流费为0，但必须允许用户依据实际平台账单改为已发生费用。系统要区分“预计规则”和“账单实扣”。

### 7.5 预计值与实际值

每一项费用均支持：

- `estimated_value`：根据公式预测；
- `actual_value`：根据WB账单确认；
- `variance`：实际值－预计值；
- `variance_reason`：差异原因。

实际值存在时，经营报表优先使用实际值；计算明细仍需展示预计值和差异。

### 7.6 反向配送事件类型与赔偿倍数（依据WB服务条款13.1.14）

为区分不同反向事件的实际赔付口径，系统按WB俄文条款13.1.14定义反向事件枚举，并配置默认赔偿倍数。

#### 7.6.1 反向事件类型枚举 `reverse_event_type`

| 枚举值 | 中文标签 | 默认赔偿倍数 | 是否需待账单确认 |
|---|---|---:|:---:|
| `none` | 正常签收 | 0×CSG | 否 |
| `cancelled_before_handover` | 交仓前取消 | 0×CSG | 否 |
| `not_exported_from_china_after_handover` | 未出中国即退回 | 1×CSG | 否 |
| `buyer_returned` | 买家退货 | 1×CSG | 否 |
| `refused_or_unclaimed` | 拒收/未领取 | 1×CSG（暂按1测算） | 是 |
| `customs_failed_returned_to_china` | 清关失败退回中国 | 2×CSG | 否 |
| `manual` | 手工填写 | 由用户填写 | 否 |

说明：
- `CSG`为正向跨境物流费基数（即按本文件第4节公式计算的单包裹或订单正向物流费）；
- 清关失败默认按2×CSG测算，系统不得自动叠加为3×CSG（即不得在2×CSG赔偿之外再额外加一笔正向费）；
- 拒收/未领取暂按1×CSG测算，必须在订单标签上标红"待账单确认"；
- 交仓前取消视为商品仍在卖家手中，正向费和赔偿均为0。

#### 7.6.2 反向赔偿计算公式

```text
csg_total_cny = sum(parcel_csg_cny)               # 多包裹独立计算后汇总
estimated_reverse_compensation_cny = csg_total_cny × default_multiplier
reverse_compensation_used_cny =
    actual_reverse_compensation_cny ?? estimated_reverse_compensation_cny
```

#### 7.6.3 物流总成本

```text
forward_logistics_used_cny =
    actual_forward_logistics_cny
    ?? (forward_fee_applied ? csg_total_cny : 0)

total_logistics_cost_cny =
    forward_logistics_used_cny
  + reverse_compensation_used_cny
  + other_reverse_cost_cny
```

其中：
- `forward_fee_applied`为布尔字段，标记该反向事件下是否仍计提正向物流费；
- 交仓前取消、清关失败退回中国、未出中国即退回：默认`forward_fee_applied=false`；
- 买家退货、拒收/未领取：默认`forward_fee_applied=true`；
- 不得对DPX跨境订单在以上任何场景下额外叠加俄罗斯境内"8元首升+2元续升"体积运费。

#### 7.6.4 预计与实际差异跟踪

```text
estimated_total_cny = estimated_forward_logistics_cny + estimated_reverse_compensation_cny
actual_total_cny     = actual_forward_logistics_cny     + actual_reverse_compensation_cny
variance_cny         = actual_total_cny - estimated_total_cny
calculation_basis    = actual_reverse_compensation_cny !== null
                       || actual_forward_logistics_cny !== null ? 'actual' : 'estimated'
```

#### 7.6.5 订单标签系统

系统按事件类型和计算状态自动生成视觉标签：

| 标签文案 | 触发条件 | 颜色 |
|---|---|---|
| 正常签收 | `reverse_event_type=none` 且 `multiplier=0` | 绿色 |
| 一倍赔偿 | `multiplier=1` 且不需要账单确认 | 橙色 |
| 两倍赔偿 | `multiplier=2` | 红色 |
| 待账单确认 | `needs_bill_confirmation=true` | 黄色 |
| 预计与实扣不一致 | `calculation_basis=actual` 且 `variance_cny≠0` | 紫色 |

#### 7.6.6 异常订单费用模块

在单订单核算器和订单明细页提供"异常订单费用"独立模块，显示：

- 反向事件类型（中文标签）；
- 默认赔偿倍数；
- 正向物流费（预计/实际/使用值）；
- 反向赔偿金额（预计/实际/使用值）；
- 其他反向成本（退回中国费、销毁费等）；
- 物流总成本；
- 预计总额、实际总额、差异；
- 计算依据标签（estimated/actual）；
- 自动生成的订单标签集合。

## 8. 数据结构

### 8.1 全局设置 `global_settings`

| 字段 | 类型 | 说明 |
|---|---|---|
| base_currency | string | 默认CNY |
| rub_per_cny | decimal | 1人民币兑换卢布数 |
| exchange_rate_effective_from | date | 汇率生效日期 |
| tax_method | enum | manual/revenue/settlement/none |
| tax_rate | decimal | 用户填写 |
| default_route_id | string | 默认线路 |
| default_commission_rate | decimal/null | 默认留空 |
| default_reverse_included | boolean | 中国跨境费率默认true，可配置 |
| timezone | string | 默认Asia/Shanghai |

### 8.2 费率表 `logistics_tariffs`

| 字段 | 类型 | 说明 |
|---|---|---|
| tariff_id | string | 唯一ID |
| route_name | string | 线路名称 |
| warehouse_code | string | WB仓库代码 |
| origin_city | string | 起运城市 |
| destination_country | string | 默认RU |
| service_level | string | 标准/超级经济/快线等 |
| eta_min_days | integer | 最小时效 |
| eta_max_days | integer | 最大时效 |
| weight_rounding_g | integer | 当前为100 |
| charge_basis | enum | actual_weight/volumetric/max；DPX为actual_weight |
| max_weight_kg | decimal | 当前20 |
| max_sum_dimensions_cm | decimal | 当前200 |
| max_single_side_cm | decimal | DPX当前120 |
| battery_limit_wh | decimal/null | 当前100 |
| reverse_to_ru_warehouse_included | boolean | 是否包含退至俄仓 |
| effective_from | date | 生效日期 |
| effective_to | date/null | 失效日期 |
| active | boolean | 是否启用 |
| source_name | string | 费率来源文件 |
| notes | text | 备注 |

费率区间使用子表 `tariff_tiers`：

| 字段 | 类型 | 说明 |
|---|---|---|
| tariff_id | string | 对应线路 |
| min_weight_kg | decimal | 区间下限 |
| max_weight_kg | decimal | 区间上限 |
| kg_rate_cny | decimal | 每公斤费率 |
| fixed_fee_cny | decimal | 每包裹固定费 |

### 8.3 SKU资料 `sku_master`

| 字段 | 类型 | 说明 |
|---|---|---|
| sku_id | string | 内部SKU |
| wb_nm_id | string/null | WB商品ID |
| product_name_cn | string | 中文品名 |
| product_name_ru | string/null | 俄文品名 |
| category | string | WB类目 |
| actual_unit_weight_g | decimal | 商品含销售包装重量 |
| product_length_cm | decimal | 长 |
| product_width_cm | decimal | 宽 |
| product_height_cm | decimal | 高 |
| purchase_cost_cny | decimal | 单件采购成本 |
| packaging_cost_cny | decimal | 额外包装成本 |
| china_inbound_cost_cny | decimal | 国内送至DPX仓分摊 |
| certification_allocation_cny | decimal | 认证分摊 |
| target_sale_price_rub | decimal | 目标售价 |
| commission_rate | decimal | 类目佣金率 |
| default_route_id | string | 默认物流线路 |
| active | boolean | 是否启用 |

### 8.4 订单 `orders`

| 字段 | 类型 | 说明 |
|---|---|---|
| order_id | string | WB订单号 |
| order_date | datetime | 买家下单时间 |
| status | enum | 订单状态 |
| sku_id | string | SKU |
| quantity | integer | 数量 |
| buyer_paid_rub | decimal | 买家实付 |
| seller_revenue_base_rub | decimal | 卖家收入/佣金基数 |
| platform_subsidy_rub | decimal | 平台补贴 |
| seller_discount_rub | decimal | 卖家承担折扣 |
| commission_base_rub | decimal | 佣金基数 |
| commission_rate | decimal | 实际佣金率 |
| acquiring_fee_rub | decimal | 支付费用 |
| promotion_cost_rub | decimal | 卖家承担促销 |
| platform_other_deduction_rub | decimal | 其他平台扣款 |
| route_id | string | 物流线路 |
| tariff_id | string | 使用的费率版本 |
| parcel_count | integer | 物流标签数量 |
| estimated_logistics_cny | decimal | 预计物流费 |
| actual_logistics_cny | decimal/null | 账单实扣 |
| tax_cost_cny | decimal | 税费 |
| other_operating_cost_cny | decimal | 其他成本 |
| inventory_recovery_rate | decimal/null | 退货库存回收率 |
| return_to_china_or_disposal_cost_cny | decimal | 退回/销毁成本 |
| reverse_event_type | enum | 反向事件类型（见7.6.1） |
| forward_fee_applied | boolean | 反向场景下是否仍计提正向费 |
| estimated_forward_logistics_cny | decimal/null | 预计正向物流费 |
| actual_forward_logistics_cny | decimal/null | 实际正向物流费（账单） |
| estimated_reverse_compensation_cny | decimal/null | 预计反向赔偿 |
| actual_reverse_compensation_cny | decimal/null | 实际反向赔偿（账单） |
| other_reverse_cost_cny | decimal | 其他反向成本（退回中国等） |
| calculation_basis | enum | estimated/actual |
| variance_cny | decimal/null | 实际总额-预计总额 |
| needs_bill_confirmation | boolean | 是否待账单确认 |
| notes | text | 备注 |

### 8.5 包裹 `parcels`

| 字段 | 类型 | 说明 |
|---|---|---|
| parcel_id | string | 包裹ID |
| order_id | string | 订单ID |
| label_number | string/null | 物流标签 |
| actual_weight_g | decimal | 实际重量 |
| billable_weight_g | decimal | 计费重量 |
| length_cm | decimal | 长 |
| width_cm | decimal | 宽 |
| height_cm | decimal | 高 |
| tariff_tier_id | string | 命中的费率区间 |
| estimated_fee_cny | decimal | 预计费 |
| actual_fee_cny | decimal/null | 实际费 |
| validation_status | enum | pass/warning/error |
| validation_messages | json | 尺寸、重量和费率提示 |

## 9. CSV导入模板

V1至少支持以下字段：

```csv
order_id,order_date,status,sku_id,quantity,buyer_paid_rub,seller_revenue_base_rub,commission_rate,route_id,parcel_id,actual_weight_g,length_cm,width_cm,height_cm,purchase_cost_cny,packaging_cost_cny,china_inbound_cost_cny,promotion_cost_rub,tax_cost_cny,actual_logistics_cny,reverse_event_type,forward_fee_applied,estimated_forward_logistics_cny,actual_forward_logistics_cny,estimated_reverse_compensation_cny,actual_reverse_compensation_cny,other_reverse_cost_cny,notes
```

新增反向配送字段说明：

| 字段 | 取值 | 说明 |
|---|---|---|
| `reverse_event_type` | `none`/`cancelled_before_handover`/`not_exported_from_china_after_handover`/`buyer_returned`/`refused_or_unclaimed`/`customs_failed_returned_to_china`/`manual` | 反向事件类型，默认`none` |
| `forward_fee_applied` | `true`/`false` | 反向场景下是否仍计提正向费，留空按事件类型默认值 |
| `estimated_forward_logistics_cny` | decimal | 预计正向物流费 |
| `actual_forward_logistics_cny` | decimal/null | 实际正向物流费（账单） |
| `estimated_reverse_compensation_cny` | decimal/null | 预计反向赔偿 |
| `actual_reverse_compensation_cny` | decimal/null | 实际反向赔偿（账单） |
| `other_reverse_cost_cny` | decimal | 其他反向成本 |

导入要求：

- 导入前显示字段映射预览；
- 金额、百分比、日期和重量格式错误必须逐行提示；
- 同一订单多包裹允许多行；
- 支持选择“覆盖、跳过、作为新版本导入”；
- 导入完成后显示成功、警告和失败行数；
- 可下载失败行及错误原因；
- 不得静默丢弃错误数据；
- `reverse_event_type`非法值必须逐行提示并跳过；
- `actual_*`字段与`estimated_*`字段同时存在时，计算结果按实际值，并记录差异。

## 10. 页面和功能模块

### 10.1 总览页

顶部筛选：

- 日期范围；
- SKU；
- 类目；
- 物流线路；
- 订单状态；
- 预计/实际口径；
- 正常/异常订单。

核心指标卡：

- 订单数；
- 销售收入（CNY/RUB切换）；
- 平台净结算；
- 总物流费；
- 平均每单物流费；
- 物流费率；
- 经营利润；
- 利润率；
- 负毛利订单数；
- 拒收/退货损失；
- 预计与实扣物流差异。

建议图表：

- 每日/每周收入、利润和物流费趋势；
- 各SKU利润与利润率排名；
- 各线路平均运费及时效对比；
- 成本结构占比；
- 订单状态损失结构；
- 重量区间订单分布与物流成本。

### 10.2 单订单快速核算器

输入：

- SKU或手工商品；
- 含包装重量；
- 包裹数量；
- 长宽高；
- 线路；
- 售价；
- 佣金率；
- 汇率；
- 商品成本；
- 包装费；
- 国内送仓费；
- 广告/促销；
- 税费；
- 订单状态。

输出：

- 实际重量与计费重量；
- 命中的费率区间；
- 物流计算过程；
- 平台扣费；
- 预计净结算；
- 经营利润；
- 利润率；
- 物流费率；
- 盈亏平衡售价；
- 建议最低售价；
- 包装减重建议；
- 异常和缺失字段提示。

### 10.3 SKU利润表

每行显示：

- SKU/商品名称；
- 售价；
- 重量；
- 计费重量；
- 线路；
- 运费；
- 佣金；
- 商品成本；
- 其他成本；
- 单件利润；
- 利润率；
- 物流费率；
- 盈亏平衡售价；
- 状态和风险标签。

支持排序、筛选、批量编辑、导出和复制核算方案。

### 10.4 线路对比器

输入同一个包裹重量和尺寸，同时计算：

- DPX标准；
- 超级经济；
- WB Plus；
- 香港快线；
- 东莞快线；
- 用户新增线路。

输出：

- 运费；
- 时效；
- 与最便宜线路的差价；
- 尺寸/重量是否符合；
- 每缩短一天时效增加的成本；
- 推荐线路及推荐理由。

推荐规则必须可解释，例如：

> WB Plus预计比DPX快8–23天，本单增加¥3.50，适合高毛利、重视时效的轻小件。

不要仅输出“推荐”，必须展示计算依据。

### 10.5 费率管理

功能要求：

- 新增、复制、编辑、停用费率；
- 设置生效和失效日期；
- 一个线路配置多个重量区间；
- 保存来源文件名称和备注；
- 显示修改记录；
- 导入/导出JSON或CSV；
- 修改费率前提示影响的预计订单数量；
- 禁止无提示覆盖历史订单费率。

### 10.6 订单明细与对账

支持：

- 查看单订单完整公式；
- 对比预计物流费与WB实扣；
- 标记差异原因；
- 批量确认账单实际值；
- 筛选异常扣费；
- 导出对账表；
- 保留每次重算记录。

## 11. 预警规则

### 11.1 阻断错误

- 实际重量为空、≤0或超过20kg；
- 三边之和超过线路限制；
- 单边超过线路限制；
- 找不到订单日期对应的费率；
- 汇率为0或为空且存在卢布金额；
- 包裹数量小于1；
- 重量区间存在重叠或断档；
- 金额或百分比格式非法。

### 11.2 警告

- 计费重量处于300g跳档附近；
- 物流费率超过用户设定阈值；
- 利润率低于用户设定阈值；
- 预计利润为负；
- 使用买家实付替代卖家收入基数；
- 佣金率、税率或采购成本缺失；
- 实际物流费与预计费差异超过阈值；
- 订单被拒收、未领取或退货；
- 费率即将失效。

阈值必须允许用户在设置中修改。

## 12. 界面与视觉要求

面板面向日常运营人员，优先保证高可读性和快速核算。

- 使用明亮、干净的视觉调性；
- 中文为默认界面，代码字段不直接暴露给普通用户；
- 关键数字使用清晰的等宽数字或表格数字样式；
- 收入、成本、利润在颜色上保持一致语义；
- 负利润和阻断错误使用红色，警告使用橙色；
- 不要大面积渐变、玻璃拟态、低对比灰字或过度装饰；
- 桌面端优先，同时保证390px移动端无横向溢出；
- 大表格在移动端使用卡片或固定首列，不强行压缩全部列；
- 所有公式结果可展开查看计算过程；
- 金额默认保留2位小数，重量显示克和公斤；
- 人民币显示`¥`，卢布显示`₽`，不要混用；
- 费率来源、更新时间和计算口径在页面可见。

## 13. 技术实现要求

### 13.1 计算引擎

- 运费、佣金、汇率、利润等全部使用Decimal/BigNumber类库，避免JavaScript浮点误差；
- 计算函数应为独立纯函数，便于测试和在前后端复用；
- 不允许只在UI中拼接公式；
- 每次计算返回结果和计算步骤；
- 计算结果必须保存使用的费率版本、汇率版本和关键输入快照；
- 预计值与实际值分开存储。

建议函数：

```ts
roundUpWeight(actualWeightG: Decimal, stepG: Decimal): Decimal
validateParcel(parcel, tariff): ValidationResult
selectTariffVersion(routeId, orderDate): Tariff
selectTariffTier(tariff, billableWeightKg): TariffTier
calculateParcelLogistics(parcel, tariff): LogisticsCalculation
calculateOrderLogistics(parcels): OrderLogisticsCalculation
calculatePlatformSettlement(order, settings): SettlementCalculation
calculateOperatingProfit(order, sku, settings): ProfitCalculation
compareRoutes(parcel, routes): RouteComparison[]
```

### 13.2 参考伪代码

```ts
function calculateParcelLogistics(actualWeightG, tariff) {
  if (actualWeightG <= 0) throw new Error('重量必须大于0');

  const billableWeightG = ceilToStep(
    actualWeightG,
    tariff.weightRoundingG
  );

  const billableWeightKg = billableWeightG.div(1000);

  if (billableWeightKg.gt(tariff.maxWeightKg)) {
    throw new Error('超过线路最大重量');
  }

  const tier = tariff.tiers.find(t =>
    billableWeightKg.gte(t.minWeightKg) &&
    billableWeightKg.lte(t.maxWeightKg)
  );

  if (!tier) throw new Error('找不到适用费率区间');

  const fee = billableWeightKg
    .mul(tier.kgRateCny)
    .add(tier.fixedFeeCny);

  return {
    actualWeightG,
    billableWeightG,
    billableWeightKg,
    tier,
    feeCny: fee.toDecimalPlaces(2),
    steps: [
      `实际重量${actualWeightG}g`,
      `按${tariff.weightRoundingG}g向上取整为${billableWeightG}g`,
      `${billableWeightKg}kg × ${tier.kgRateCny} + ${tier.fixedFeeCny}`,
      `物流费=${fee.toDecimalPlaces(2)}元`
    ]
  };
}
```

### 13.3 数据存储

如现有项目已有数据库，沿用现有数据库和迁移方式；如为纯本地工具，V1可使用IndexedDB或项目现有本地持久化方案。

必须支持：

- 数据备份与恢复；
- CSV导入导出；
- 费率版本历史；
- 订单计算快照；
- 修改时间和修改来源；
- 不因页面刷新丢失数据。

### 13.4 后续WB接口

V1不强制接入WB API，但数据层必须预留：

- WB订单导入；
- 财务报告导入；
- 实际佣金和物流扣费回填；
- 订单状态同步；
- SKU/NM ID映射；
- 预计值与实际账单自动对账。

任何未来API接入都不得把密钥写入前端代码或提交到仓库。

## 14. 默认费率配置示例

```json
{
  "tariffId": "DPX-SZ-382822-20260209",
  "routeName": "DPX深圳标准",
  "warehouseCode": "382822",
  "originCity": "深圳",
  "destinationCountry": "RU",
  "serviceLevel": "standard",
  "etaMinDays": 15,
  "etaMaxDays": 30,
  "weightRoundingG": 100,
  "chargeBasis": "actual_weight",
  "maxWeightKg": 20,
  "maxSumDimensionsCm": 200,
  "maxSingleSideCm": 120,
  "batteryLimitWh": 100,
  "reverseToRuWarehouseIncluded": true,
  "effectiveFrom": "2026-02-09",
  "effectiveTo": null,
  "active": true,
  "tiers": [
    {
      "minWeightKg": 0.1,
      "maxWeightKg": 0.3,
      "kgRateCny": 58,
      "fixedFeeCny": 2
    },
    {
      "minWeightKg": 0.4,
      "maxWeightKg": 20,
      "kgRateCny": 43,
      "fixedFeeCny": 8
    }
  ],
  "sourceName": "DPX运费(1).pdf"
}
```

## 15. 必须完成的自动化测试

### 15.1 运费单元测试

逐项验证第4.5节全部案例，尤其是：

- 100g与101g；
- 300g与301g；
- 400g与401g；
- 1,000g与1,001g；
- 20kg与20.001kg；
- 多包裹分别取整；
- 无费率区间时阻断；
- 历史订单按历史费率计算。

### 15.2 尺寸测试

- `52×18×18cm`：三边和88cm，最长边52cm，DPX通过；
- `120×40×40cm`：三边和200cm，最长边120cm，DPX通过；
- `121×39×39cm`：三边和199cm，但最长边121cm，DPX不通过；
- `100×60×41cm`：三边和201cm，DPX不通过。

### 15.3 线路对比测试

500g包裹：

```text
DPX：0.5×43＋8 = ¥29.50
WB Plus：0.5×48＋9 = ¥33.00
差价：¥3.50
```

系统应正确显示WB Plus增加¥3.50、预计时效由15–30天缩短至7天。

### 15.4 利润测试

至少构造以下测试：

- 正常签收且盈利；
- 正常签收但负毛利；
- 301g重量跳档；
- 买家拒收，收入冲回但正向物流保留；
- 实际物流费覆盖预计值；
- 汇率变更但历史订单不被自动重算；
- 分母为0时利润率/ROI安全显示；
- 佣金率缺失时给出警告而不是默认为0。

### 15.5 反向配送赔偿测试

依据7.6节，500g订单（CSG=¥29.50）必须通过以下场景：

| 测试 | 事件类型 | forward_fee_applied | 期望倍数 | 期望反向赔偿 | 期望正向使用值 | 期望物流总成本 |
|---|---|:---:|---:|---:|---:|---:|
| 正常签收 | none | true | 0 | ¥0 | ¥29.50 | ¥29.50 |
| 未出中国即退回 | not_exported_from_china | false | 1 | ¥29.50 | ¥0 | ¥29.50 |
| 买家退货 | buyer_returned | true | 1 | ¥29.50 | ¥29.50 | ¥59.00 |
| 清关失败退回中国 | customs_failed | false | 2 | ¥59.00 | ¥0 | ¥59.00 |
| 交仓前取消 | cancelled_before_handover | false | 0 | ¥0 | ¥0 | ¥0 |
| 拒收/未领取 | refused_or_unclaimed | true | 1 | ¥29.50 | ¥29.50 | ¥59.00 |

附加验证：

- 清关失败场景物流总成本不得自动计算为¥88.50（即不得3×CSG叠加正向费）；
- 买家退货场景不得叠加俄罗斯境内"8元首升+2元续升"体积运费；
- 拒收/未领取必须标记`needs_bill_confirmation=true`；
- `buyer_to_ru_warehouse_reverse_included=true`时，买家退货一倍赔偿仍正常计算；
- 实际账单值存在时覆盖预计值，差异和预计值均保留；
- 多包裹订单CSG和赔偿分别独立计算后汇总；
- 历史订单按订单日期匹配历史/当前费率版本，7-21用旧版，7-22用0726版。

## 16. 验收标准

只有同时满足以下条件才算完成：

1. DPX全部边界测试结果与本文一致。
2. 跨境订单没有重复叠加俄罗斯境内体积尾程费。
3. 每一笔运费和利润都能展开查看计算过程。
4. 费率、佣金、汇率、税率和预警阈值可以维护。
5. 历史订单绑定历史费率版本。
6. 支持单订单快速核算和批量CSV导入。
7. 总览、SKU利润、线路对比、订单对账和费率管理页面可用。
8. 预计值与实际账单值分开保存并显示差异。
9. 重量、尺寸、费率断档和负毛利预警有效。
10. 桌面端和390px移动端无明显布局错误或横向溢出。
11. 自动化测试通过，没有用浮点误差修补或硬编码测试答案。
12. README说明启动、构建、测试、数据导入和费率更新方法。

## 17. Trae最终交付内容

实施完成后请提供：

- 已完成的源代码；
- 数据库迁移或本地数据结构；
- 默认费率配置；
- CSV导入模板和示例数据；
- 自动化测试及运行结果；
- README；
- 主要页面截图；
- 已实现功能清单；
- 未实现项和原因；
- 已知风险；
- 回滚方式；
- 实际验收结果。

不要只回复“已完成”，必须给出测试证据和可复核结果。

## 18. 费率来源与重要说明

主要依据：

1. 用户提供的《DPX运费(1).pdf》；
2. 用户提供的Wildberries俄文合同第13.1.11条截图；
3. Wildberries卖家服务条款：`https://seller.wildberries.ru/instructions/ru/tj/material/service-terms`；
4. Wildberries物流说明：`https://seller.wildberries.ru/instructions/ru/ru/material/logistics-types-and-cost-calculation`。

重要边界：

- 本文只锁定当前已核实的物流计算规则；
- 平台佣金、税率、广告、促销和清关税费必须按实际业务资料维护；
- 中国跨境条款所述反向物流只到俄罗斯境内WB合作仓，不代表免费退回中国；
- 正向DPX费在买家拒收或超期未领取时仍可能发生；
- 实际结算以买家下单时卖家后台生效费率和WB财务账单为准；
- 面板必须允许用实际账单覆盖预计值，同时保留预计值和差异原因。

