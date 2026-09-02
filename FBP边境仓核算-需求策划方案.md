# FBP 边境仓核算 — 需求策划方案（2026-09-02）

> 主题：Ozon 核算体系新增 FBP（Fulfilled by Partner）边境仓模式独立核算页面
> 状态：**一期已交付（本地完成待部署）**——实施结果与修正记录见《流程任务书-20260902-FBP边境仓核算.md》
> 资费表来源：`D:\ozon\运费计算\FBP_list_of_services_CN_HK1092026_1788173088.xlsx`（2026-09-02 放入）
> 前序：《流程任务书-20260901-选品市场分析纯度流水线.md》（沿用其配置同步/测试/交接纪律）

---

## 1. 背景与目标

现有 Ozon 跨境核算面板（OzonCalc，节点 n8「物流与成本」）只支持 **rFBS 跨境直邮**（CEL V7.24 资费表，按 kg 计费，全程到客户）。本次新增 **FBP 边境仓模式**：货物备在中国边境仓（珲春/绥芬河/东莞等），出单后由 3PL 从边境仓发往 Ozon 俄罗斯分拣中心，Ozon 完成尾程配送。

**目标**：独立新页面核算 FBP 模式单件利润，与 rFBS 面板并列，供选品与定价决策对比参考。

## 2. 资费表数据侦察结论

### 2.1 表格画像

| 项 | 结论 |
| --- | --- |
| 结构 | 4 sheets：`CHINA FBP`/`中国 FBP`（正向费率主表 194 行，有效 164 行）+ `CHINA FBP WHS`/`中国 FBP WHS`（仓库→服务映射，中英同内容，以中文表为准） |
| 物流商 | 10 家：CEL、GUOO、RETS、Ural、Ural HK、DEX、XY（Xingyuan）、ZTO |
| 目的国 | 俄罗斯（主）/ 白俄罗斯 / 哈萨克斯坦 |
| 服务等级 | Super Express / Express / Standard / Economy（Smart = Standard+Economy 混合，费率与纯等级重复，**一期跳过**） |
| 评分组 | Extra Small / Budget / Small / Big / Premium Small / Premium Big / Other（与现有 rFBS 体系一致，申报价值区间判定口径相同） |
| 计费币种 | CNY 按克（主）；Ural HK 每 100g（CNY）；**DEX 香港 = USD（一期排除）** |
| 计费重量 | 4 种：实重 / max(实重, 体积重÷12000) / max(实重, 体积重÷6000) / 条件体积重（三边和≤90cm 用实重，>90cm 用体积重——仅 DEX，随 DEX 一并排除） |
| 边境仓 | 10 仓：CEL 珲春/长春、GUOO 东莞/黑河、RETS 哈尔滨、Ural 东莞/杭州/霍尔果斯/广州/香港、XY 绥芬河 |
| 逆向物流 | 文本规则（无附加费退回/销毁、运费×1.5/×2 倍、<5000₽ 直接处置等）——**一期仅展示，不入计算** |

### 2.2 脏数据预警（提取脚本必须处理）

- 俄式小数逗号：`¥69.64 + ¥0,0371/1克`、`$1,45/100克`
- 全角/不规则空格：`¥ 25.83 + ¥ 0.0191/1 克`、`¥40.44  + ¥ 0.0371/1克`
- 分隔行 `[null,"переход"]` 需跳过
- DEX 行 USD 费率 → 一期整行排除（约 4 行）

### 2.3 与 rFBS 的口径差异（引擎必须新增的能力）

| 维度 | rFBS（现有） | FBP（新增） |
| --- | --- | --- |
| 计费公式 | fixed ¥ + ¥/kg × kg | fixed ¥ + ¥/g × g（线性折算每百克） |
| 覆盖段 | 中国→俄罗斯客户**全程** | 中国揽收点→Ozon 分拣中心（**尾程另算**） |
| 目的国 | 仅俄罗斯 | 俄 / 白俄 / 哈萨克 |
| 物流商 | CEL 单家 | 10 家 3PL |
| 电池/液体 | 无限制维度 | 禁止 / 允许 / 需要 MSDS 三态过滤 |
| 边境仓 | 无 | 10 仓映射（筛选可用 3PL） |
| 仓储费 | 无 | 90 天免仓期，后 ¥4/m³/天 |
| 国内段 | 工厂→跨境发货点 | 工厂→**边境仓**（用户明确要求纳入） |

## 3. 业务口径（已冻结 / 待提供）

### 3.1 已冻结（2026-09-02 用户确认）

1. **独立新页面**，不做 OzonCalc 内模式切换；挂「物流与成本」组，与 OzonCalc 并列。
2. **三国全做**：目的国下拉（俄罗斯默认 / 白俄 / 哈萨克），引擎与配置按目的国区分费率。
3. **DEX 美元线路一期排除**（含条件体积重规则随之排除），二期再议汇率折算。
4. **Smart 服务跳过**（费率与纯 Standard/Economy 重复，避免重复线路）。
5. **成本模型新增**：国内段到边境仓运费（¥/件）+ 仓储费（90 天免租，后 ¥4/m³/天，按单件体积×库存天数摊算）。

### 3.2 待用户提供（阻塞项，不阻塞一期开工）

| # | 依赖 | 阻塞内容 | 一期兜底 |
| --- | --- | --- | --- |
| 1 | **Ozon 尾程配送费率表**（分拣中心→买家） | 尾程自动查表计算 | UI 提供「尾程费 ₽/件」手动输入项（默认 0），标注"待费率表"；配置预留 `last_mile` 结构，表到位后切换自动查表 |
| 2 | 尾程费计费口径（按件 / 按重 / 按评分组） | 同上 | 同上 |

## 4. FBP 成本模型（单件利润链）

```text
收入侧
  挂牌价 ₽ × (1-折扣率) = 成交价 ₽ → ÷汇率R = 成交价 ¥
成本侧（¥）
  采购成本
+ 国内段运费（工厂→边境仓）          ← 新增
+ 贴标费
+ FBP 国际段运费 = fixed + rate/g × 计费重量g   ← 新引擎
      计费重量 = 实重 或 max(实重, 长×宽×高÷vol_div)
+ Ozon 尾程配送费 ₽ ÷ R             ← 预留（手动输入/待费率表）
+ 仓储费 = max(0, 预计库存天数-90) × 单件体积m³ × ¥4/天   ← 新增
      单件体积 = 长×宽×高cm ÷ 1,000,000
+ 交付代理费（沿用 agency_fee：rate/min/max₽）
+ 平台费 = (佣金% + 广告% + 支付费%) × 成交价
+ 退货损失% × 成交价（FBP 逆向规则文本作参考展示）
= 毛利 / 毛利率
```

渠道适用性过滤（自动）：目的国 → 边境仓（可选）→ 尺寸（三边和/最长边）→ 重量区间 → 申报价值区间（₽）→ 电池/液体属性（商品勾选「含电池/含液体」时排除"禁止"线路，MSDS 线路标注提示）。

## 5. 技术方案

### 5.1 配置层（单一事实源）

新增 `config/ozon_fbp_channels.json` → sync-config 同步生成 `generated/ozon_fbp_channels.js`，新增 `validateFbpChannels` 校验（fail-close，沿袭现有纪律）。`source` 字段含版本标识 `FBP_list_of_services_CN_HK1092026`（沿袭 TARIFF_VERSION 动态提取惯例）。

```json
{
  "source": "FBP_list_of_services_CN_HK1092026 (中国FBP sheet)",
  "source_date": "2026-09-02",
  "version": "FBP-2026.09",
  "storage": { "free_days": 90, "rate_cny_per_m3_per_day": 4 },
  "last_mile": { "source": null, "note": "Ozon尾程配送费待用户提供费率表", "billing": null, "rows": [] },
  "warehouses": [
    { "id": "cel_hunchun", "name": "CEL 珲春", "carriers": ["CEL"] },
    { "id": "xingyuan_suifenhe", "name": "XY 绥芬河", "carriers": ["XY"] }
  ],
  "groups": [
    {
      "destination": "RU",
      "destination_zh": "俄罗斯",
      "carrier": "CEL",
      "service_level": "Standard",
      "service_name": "CEL FBP Standard",
      "channels": [
        {
          "id": "cel_ru_standard_small",
          "scoring_group": "Small",
          "speed_days": "7-19",
          "fixed_cny": 17.97,
          "rate_per_g_cny": 0.0393,
          "weight_min_g": 1,
          "weight_max_g": 2000,
          "sum_max_cm": 150,
          "side_max_cm": 60,
          "price_min_rub": 1501,
          "price_max_rub": 7000,
          "batteries": "forbidden",
          "liquids": "allowed",
          "charge_weight": "actual",
          "vol_divisor": null,
          "loss_compensation_rub": 7000,
          "reverse_policy": "清关前取消无附加费销毁；清关后 运费×1.5"
        }
      ]
    }
  ]
}
```

### 5.2 引擎层

新增 `ozon-react/src/utils/ozonFbpEngine.js`（与 ozonEngine 并列，**不改现有 rFBS 引擎**）：

- `FBP_DESTINATIONS` / `FBP_WAREHOUSES` / `FBP_CHANNEL_GROUPS` / `ALL_FBP_CHANNELS`
- `calcFbpShipping(ch, price, weight, dims)`：适用性过滤（返回不可用原因）+ 计费重（actual / max_vol÷12000 / ÷6000）+ `cost = fixed + rate_per_g × chargeWeight_g`
- `calcStorageFee(length, width, height, days)`：90 天免租 + ¥4/m³/天
- `calcFbpProfit(ch, inputs, params)`：§4 完整利润链；汇率沿用 ozonEngine 的 live binding `R`（**硬约束：不得改为 const**）；代理费沿用 `calculateAgencyFeeRub`
- `getBestFbpShipping(...)`：利润最高线路

### 5.3 提取脚本

新增 `scripts/extract_fbp_tariffs.py`（Node 亦可）：xlsx → config JSON。要点：跳过 `переход` 分隔行、清洗俄式小数逗号与空格、per_100g 线性折算为 per_g、DEX 整行排除、WHS 表解析仓库映射、输出统计摘要 + 异常清单供人工抽查。**输出需人工核验 3-5 行后定稿**。

### 5.4 UI 层

新增 `ozon-react/src/components/OzonFbpCalc.jsx`（独立页面，样式沿袭 OzonCalc 卡片/表格约定）：

- **参数区**：商品（售价₽/实重kg/长宽高cm/含电池?/含液体?）→ 国内段（采购成本/工厂→边境仓运费/贴标费）→ 库存（预计库存天数，默认 90；单件体积与仓租实时预览）→ 平台费（佣金/广告/支付/代理费/退货损失%）→ 筛选（目的国下拉默认俄罗斯 / 边境仓下拉默认全部）
- **结果区**：3PL×服务等级分组线路对比表（运费/计费重/时效/仓租/利润/利润率，不可用线路灰显带原因）→ 最优线路卡（含成本分解：国内段、FBP 运费、尾程费、仓租、代理费、平台费、退货损失）→ 逆向物流规则提示
- **持久化**：localStorage 手动保存按钮 + 方案历史记录（用户既有偏好）；沿袭 PurityPipelinePage 的 persist 模式
- **路由**：App.jsx 新增 `__fbp_calc__` 懒加载分支 + 错误边界标题；Sidebar「物流与成本」组新增「FBP 边境仓核算」

### 5.5 测试策略

1. 提取校验：脚本输出统计（行数/物流商/目的国分布）对照 §2.1 画像
2. 单测 `ozonFbpEngine.test.mjs`：费率解析（脏字符串）、计费重三模式、电池/液体/目的国过滤、仓租 90 天边界、利润链（含汇率 live binding 生效）
3. e2e 抽样核验：表内取真实行手工复算（如 CEL Standard Small，2000₽/1kg：17.97 + 0.0393×1000 = ¥57.27）
4. `npm test` 主链挂入 `test:fbp`

## 6. 实施计划

| 阶段 | 内容 | 预估 |
| --- | --- | --- |
| P1 | 提取脚本 + 配置定稿（人工核验）+ sync 校验 | 0.5 天 |
| P2 | FBP 引擎 + 单测 | 1 天 |
| P3 | UI 独立页面 + 路由/导航 + 持久化 | 1–1.5 天 |
| P4 | e2e + 全量回归 + 流程任务书归档 | 0.5 天 |
| 合计 | | **3–4 天**（实际取决于表内脏数据程度，不提前锁死） |

尾程费率表到位后（P5，另行小迭代）：填 `last_mile.rows` + 引擎切换自动查表 + 测试，约 0.5 天。

## 7. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 尾程费缺失导致核价误导 | UI 强标注"尾程费待配置/手动估算"，利润卡明示假设；费率表到位前不冻结项目成本场景 |
| 费率脏数据（逗号小数/空格） | 提取脚本严格正则 + 异常清单 + 人工抽查 3-5 行定稿 |
| Ural HK 每百克进位语义不明 | 一期线性折算（0.105¥/g），配置留 rate_unit 字段，UI 注明；误差 ≤¥0.1/单 |
| 白俄/哈萨克申报价值区间与俄罗斯不同（如白俄 Premium Small 上限 18000₽） | 按行原样保留区间，过滤逻辑统一按目的国分组内判断 |
| 三国费率相近线路多（约 160 行）导致对比表过长 | 默认按目的国+评分组过滤，仅展示适用线路；不可用线路折叠 |

## 8. 依赖清单（待用户提供）

1. **Ozon FBP 尾程配送费率表**（分拣中心→买家，含计费口径）——P5 阻塞项
2. （可选）确认代理费口径是否沿用现有 settings.json `agency_fee`（2%/15₽/200₽ 封顶）

## 9. 与二期待办的衔接

- **模块1 批次摊销**（20260831 规划二期）：FBP「国内段运费」一期为单件直填 ¥/件；批次摊销模型（批次总费用÷摊销数量）落地后，此处切换为摊销结果引用，两线在成本核算链汇合。
- DEX USD 线路 + 汇率折算、逆向物流结构化计费：二期。
