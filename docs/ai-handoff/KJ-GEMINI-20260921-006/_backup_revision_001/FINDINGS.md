# 独立核算与项目核算读写隔离验证：发现与风险清单 (FINDINGS)

> **任务标识**：KJ-GEMINI-20260921-006 (Revision 001)  
> **基线 Commit**：`de0cecf107e670e1c0d9cf393c50b92ab85afdee`  
> **原则声明**：本清单仅提供复现事实、风险剖析与下一步小修复建议；**禁止任何代码修改与自行修复**。

---

## 缺陷与风险排序清单

### 🔴 发现 1（高风险 / 逻辑污染）：`SingleTab` 空白预填项回退全局独立预设，导致历史采购价穿透污染新项目

- **风险等级**：高（High - 影响业务核算准确性）
- **判定状态**：`needs_decision` / `confirmed_unexpected_fallback`
- **源码精确定位**：
  - `ozon-react/src/utils/t6/costScenarioAdapter.js` 第 166-171 行（`mergeTrustedPrefill` 函数实现）：
    ```javascript
    export function mergeTrustedPrefill(base, prefill) {
      const trusted = Object.fromEntries(
        Object.entries(prefill || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined),
      )
      return { ...base, ...trusted }
    }
    ```
  - `ozon-react/src/components/OzonCalc.jsx` 第 104-107 行（`SingleTab` 状态初始化）：
    ```javascript
    const [params, setParams] = useState(() => {
      const base = persistGet(SHIPPING_KEY) || { ...SINGLE_DEFAULTS }
      return projectContext?.prefill ? mergeTrustedPrefill(base, projectContext.prefill) : base
    })
    ```
- **复现路径与合成数据事实**：
  1. 用户在独立核算工具中测算商品 X，输入采购成本 `65` 元，被自动持久化到全局键 `shipping-calc-rfbs-v2`。
  2. 用户随后进入项目 A（如宠物去油慕斯 `RU-2026-001`）启动成本核算。该项目在候选池录入了平台售价 (2800 RUB) 与重量 (0.35 kg)，但采购成本尚未核定 (`prefill.purchaseCost === ''`)。
  3. `SingleTab` 挂载时，`mergeTrustedPrefill(base, projectContext.prefill)` 过滤掉了空字符串 `prefill.purchaseCost`，逻辑直接回退使用了 `base.purchaseCost`（即上一次独立核算商品 X 的 `65` 元）。
  4. 界面直接展示采购成本为 `65` 元，并自动计算出渠道利润率。
- **已有缓解措施**：
  - `OzonCalc.jsx` 第 152-154 行与第 201-204 行已包含前置人工确认复选框：
    ```javascript
    <label className="flex items-center gap-1.5 text-xs text-workspace-text-secondary cursor-pointer">
      <input type="checkbox" checked={costConfirmed} onChange={(e) => setCostConfirmed(e.target.checked)} />
      已确认采购成本及平台费用假设
    </label>
    <Button variant="primary" size="sm" disabled={!costConfirmed} onClick={saveScenario}>保存此方案到项目</Button>
    ```
    在用户手动勾选确认前，“保存此方案到项目”按钮严格保持禁用（`disabled`），防止未经审阅自动落库。
- **影响与后果**：
  虽然项目模式下编辑输入未写回 `shipping-calc-rfbs-v2`（单品防穿透守卫生效），但**初始读取的盲目回退把完全无关商品的历史价格直接继承到了新项目**。若运营人员未注意并直接勾选确认，将直接依据虚假采购成本批准不可行项目，造成严重业务决策失误。
- **验证证据**：
  - 截图：`evidence/revision-normal/r1-1-ozon-calc-embedded.png`
  - 结果：`evidence/revision-normal/costing-isolation-results.json` Scenario R1.1

---

### 🟠 发现 2（中高风险 / 数据意外丢失）：`SingleTab` 缺乏草稿机制，切 Tab、切项目或关闭抽屉导致未保存输入静默丢失

- **风险等级**：中高（Medium-High - 交互可用性缺陷）
- **判定状态**：`confirmed_unexpected_write` / `data_loss`
- **源码精确定位**：
  - `ozon-react/src/components/OzonCalc.jsx` 第 104-108 行（`useState` 内部状态生命周期）
  - `ozon-react/src/components/t6/ProjectDetailPage.jsx` 第 420-436 行（条件渲染挂载与卸载）
- **复现路径与合成数据事实**：
  1. 用户在项目 A 的 Ozon 单品测算中花费时间细化录入国内运费、贴标费、采购成本（如填入 `108` 元）。
  2. 用户出于对比需要，点击了测算器顶部的“多规格对比” Tab；或者切换查看了项目概览 Tab；或者点击了“返回成本场景列表”。
  3. 此时 `SingleTab` 实例直接被 React unmount 卸载。
  4. 当用户再次切回单品核算时，组件重新 mount，参数再次根据 `prefill + base` 重新生成，之前填入的 `108` 元被完全抹除，静默变回 `65` 元。全程无任何二次确认警告，也没有任何草稿缓存。
- **影响与后果**：
  用户反复调整的成本试算方案极易因误触导航或临时切换而丢失，用户必须重新填写所有输入。
- **验证证据**：
  - 截图：`evidence/scenario-6-draft-loss.png`
  - 结果：`evidence/costing-isolation-results.json` Scenario 6 (`s6CostAfterTab === '65'`)

---

### 🟡 发现 3（中风险 / 范围认知混淆）：`MultiTab` 缺乏项目上下文感知，直接读写全局 `product-pricing-v2`

- **风险等级**：中（Medium - 共享与项目语义混淆）
- **判定状态**：`needs_decision`（业务预期未明）
- **源码精确定位**：
  - `ozon-react/src/components/OzonCalc.jsx` 第 78 行（Tab 切换渲染）
  - `ozon-react/src/components/OzonCalc.jsx` 第 380-500 行（`MultiTab` 组件声明）
- **复现路径与合成数据事实**：
  1. 在项目 A 详情页打开 Ozon 核算器，点击“多规格对比” Tab。
  2. `MultiTab()` 无任何 props 输入，内部直接绑定全局持久化键 `product-pricing-v2`。
  3. 页面完全不显示当前项目编号（如 `RU-2026-001`），但因为处于项目详情抽屉内部，用户会自然假定这是“当前项目的多规格测算”。
  4. 用户在其中修改公共费率或添加规格行，实时触发 `persistSet('product-pricing-v2', ...)`。
  5. 切换到项目 B 或独立 Ozon 核算器，看到的是完全一模一样的规格列表与费率修改。
- **影响与后果**：
  若产品定位多规格对比为“全局通用速算小工具”，则现状符合意图，但**界面严重缺乏提示，造成项目人员误以为多品方案已绑定项目**；若产品预期各项目拥有独立的多 SKU 对比，则现状存在跨项目覆盖缺陷。
- **特别澄清**：这属于共享工具定位与界面表达问题，**绝非多租户越权漏洞**（本项目属于单工作区运营系统，无多租户权限隔离要求）。
- **验证证据**：
  - 截图：`evidence/scenario-3-project-A-multi-tab.png`
  - 轨迹：`evidence/write-trace.log` Scenario 3

---

### 🟡 发现 4（中风险 / UI 可见性缺陷）：`ProjectDetailPage` 错误提示（`notice`）在 `costing` Tab 下不渲染，保存失败无任何错误提示

- **风险等级**：中（Medium - 用户体验与异常反馈缺失）
- **判定状态**：`confirmed_ui_visibility_defect`
- **源码精确定位**：
  - `ozon-react/src/components/t6/ProjectDetailPage.jsx` 第 417-419 行：
    ```javascript
                    </div>
                    {notice && <div className="text-xs text-workspace-text-secondary">{notice}</div>}
                  </div>
                )}
                {tab === 'costing' && (
    ```
- **复现路径与合成数据事实**：
  1. 在项目 A 详情页打开成本 Tab，点击“使用 Ozon 核算”并填写参数。
  2. 模拟底层存储并发锁冲突或验证失败（抛出 `T6_BACKEND_LOCKED` 异常）。
  3. 点击“保存此方案到项目”，`saveOzonScenario` 的 `catch (e)` 捕获错误并执行 `refresh(e.message)`。
  4. 由于当前处于 `tab === 'costing'`，而 `{notice && ...}` 仅在 `tab === 'overview'` 内部渲染，因此当前页面上**完全没有显示任何错误提示**！
  5. 核算器未关闭，保存看似无任何响应，用户无法获知失败原因；只有当用户点击“概览” Tab 时，错误提示才在页面右侧日志下方显现。
- **影响与后果**：
  用户在保存失败时得不到即时反馈，容易误以为界面卡死并重复点击，无法定位保存受阻原因。
- **验证证据**：
  - 截图：`evidence/revision-normal/r3-save-error-notice-in-overview.png`
  - 结果：`evidence/revision-normal/costing-isolation-results.json` Scenario R3

---

### 🟢 发现 5（低风险 / 冗余写入与入口暴露）：`WBCalc` 挂载即触发全局设置写入，且在项目视图暴露全局对账与费率

- **风险等级**：低（Low - 架构规范与边界说明）
- **判定状态**：`verified_shared_behavior` / `potential_risk` / `needs_decision`
- **源码精确定位**：
  - `ozon-react/src/components/WBCalc.jsx` 第 40-63 行（`useState` 挂载初始化与汇率同步写入 `wb-settings-v1`）
  - `ozon-react/src/components/WBCalc.jsx` 第 80-110 行（Tab 导航条渲染 `orders`, `tariffs`）
  - `ozon-react/src/components/wbcalc/tabs/CalculatorTab.jsx` 第 462-493 行（保存 SKU 模板写入 `wb-skus-v1`）
- **复现路径与合成数据事实**：
  1. 在项目模式下挂载 `WBCalc`，即便本地已存在 settings，依然无差别触发一次 `persistSet('wb-settings-v1', ...)`。
  2. 在项目抽屉中，`WBCalc` 顶部的子导航依然完整展示了“订单与对账”与“费率管理”。
  3. 用户在项目 A 的核算抽屉内，可以直接浏览导入的所有历史订单，并能直接修改全平台通用的物流渠道体积重系数与基础报价。
- **影响与后果**：
  项目级操作触及全局运营配置与对账账本；保存 SKU 模板有意写入全局主数据库（属于合理共享），但界面未提示该 SKU 将对所有项目可见。
- **验证证据**：
  - 截图：`evidence/scenario-4-wb-settings.png`, `evidence/scenario-5-project-wb-orders-tab.png`, `evidence/scenario-5-project-wb-tariff-tab.png`

---

## 下一步最小建议修复（最多两项，不编码）

### 💡 建议修复 1（针对发现 1：阻断历史价格跨商品污染，严禁清零）
- **方案内容**：
  在 `OzonCalc.jsx` 的初始化逻辑中：当 `projectContext` 存在时，若候选快照中未包含采购成本（`prefill.purchaseCost === ''`），**绝不回退读取全局 `shipping-calc-rfbs-v2`**；
  同时，**严禁将未核定成本置为 0 或空值计算**（因为引擎内的 `Number(v) || 0` 会将 0 当作零成本并算出虚假超高利润率）。应将初始采购成本显式保持为 `null` 或未核定状态，并强制要求运营人员手动录入有效正数后方可生成利润预测。
- **预期收益**：
  彻底阻断商品间的历史成本交叉污染，杜绝零成本引发的虚假高利润误判。

### 💡 建议修复 2（针对发现 4 & 2：错误提示可见性提升与未保存草稿确认）
- **方案内容**：
  (1) 将 `ProjectDetailPage.jsx:417` 的 `{notice && ...}` 从 `{tab === 'overview' && ...}` 中解耦，提升到所有 Tab 顶层的共享通知栏（或在成本抽屉顶部渲染），确保任何 Tab 下的操作报错均能实时、显式触达用户；  
  (2) 在 `SingleTab` 中增加简单的未保存脏检查：若用户编辑了采购成本等关键参数但未点击保存，在切换 Tab 或关闭抽屉时弹出标准轻量确认弹窗（“当前方案尚未保存至项目，切换将丢失修改”）。
- **预期收益**：
  显著提升异常透明度与数据安全性，无需重构底层复杂持久化层。
