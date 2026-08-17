# RUNBOOK.md — 运维手册

> 日常启动/测试/换路径/备份/故障排查。行为约束见 `AGENTS.md`，业务公式见 `BUSINESS_RULES.md`。

---

## 1. 启动与停止

### 1.1 React 主面板（端口 5173）

```bash
cd ozon-react
npm install          # 首次
npm run dev          # 开发
npm run build        # 生产构建（输出 dist/）
```

### 1.2 价格分析 API（端口 8888）

```bash
npm install          # 首次
npm start            # node server.js
npm run dev          # nodemon 热重载（watch 4 个核心文件）
```

停止：Ctrl+C。公网穿透（可选）：`node tunnel.js`（缺 localtunnel 时优雅退出，见 §6）。

### 1.3 Python 面板

```bash
cd ozon-product-analyzer
pip install -r requirements.txt       # 首次
streamlit run wb_panel.py --server.port 8502   # WB 核算
streamlit run app.py --server.port 8501        # 选品分析
```

### 1.4 冒烟检查

```bash
curl http://localhost:8888/api/summary      # 期望 200 JSON
curl http://localhost:8888/                 # 期望 200 HTML
# React: 浏览器打开 http://localhost:5173，左侧导航可切换各节点
```

---

## 2. 测试（唯一入口：npm，禁止裸调 python）

```bash
npm test              # 强制：React 65 + Python 31（自动前置 sync-config）+ scoring 81/20/13/22 + T6 四套（56/42/44/42）+ golden 56
npm run test:golden   # 强制：黄金业务案例（tests/golden/，provenance 分级）
npm run test:sync     # 强制：双端对拍（16 边界重量 + 2 版本边界，零差异）
npm run sync:config   # 手动同步 config/*.json → src/generated/*.js
```

**修改任何涉及 wbEngine/ozonEngine/tariffs/commission/logistics/profit/税费/汇率/成本的代码后，必须三条全部执行且全绿后才能提交。**

**T6 专项**：`npm run test:t6`（t6Store 56 + gateEngine 42 + costScenario 44 + wbScenario 42）。

---

## 3. 路径配置（环境变量）

| 变量 | 作用 | 默认值 |
|---|---|---|
| `BASE_PATH` | 价格分析 API 数据根目录（含 市场价/报价表/分析结果 子目录） | Legacy 回退见下 |
| `PORT` | 价格分析 API 端口 | 8888 |
| `LEGACY_PATH_ENABLED` | 是否允许回退到 `E:\Desktop\坪优报价分析` | `true` |
| `OZON_DATA_DIR` | Python 选品面板数据目录 | `../选品/`（仓库内） |
| `WB_COMMISSION_FILE` | WB 佣金 xlsx 路径 | `../运费计算/wb佣金.xlsx` |
| `CONFIG_DIR` | 双端共享配置目录（唯一事实源） | `../config/`（仓库内） |

三层优先级（`config.js` 已实现）：
1. `BASE_PATH` 环境变量；
2. 项目内 `data/`；
3. Legacy `E:\Desktop\坪优报价分析`（仅当 `LEGACY_PATH_ENABLED != false`）。

**禁止在代码中写死本机路径**；换机器只需设环境变量。

---

## 4. 更新费率流程（T2 后：只改 config，禁止改引擎）

1. 取得官方费率文件/公告，存入 `运费计算/`（保留原文件名+日期）。
2. **只改 `config/wb_tariffs.json`（WB）或 `config/ozon_channels.json`（Ozon）**：新增版本条目（`effective_from` 新日期，旧版本设 `effective_to`）；数值语义遵守 `config/schema/`。
3. `npm run sync:config` 生成 React 侧 generated 文件（`npm test` 会自动执行）。
4. 全量验证：`npm test`（65+31）+ `npm run test:golden` + `npm run test:sync`（对拍零差异）。
5. 更新 `BUSINESS_RULES.md` 对应章节与 `CHANGELOG.md`。
6. 历史订单不受影响（引擎按订单日期匹配版本）。

**禁止**：不得在 `wbConfig.js` / `ozonEngine.js` / `wb_data.py` 内嵌常量中改数值（它们只是 adapter/兜底）。

---

## 5. 备份与恢复

- **代码**：git 是唯一事实源。每阶段合并到 main 并打 tag（如 `v3-t0-baseline`）。备份 = `git clone https://github.com/Xiaxiao0926/kuajing.git`。
- **业务数据**（市场分析/、选品/、运费计算/、根目录 xlsx）：git 内包含；另有原位置（`E:\Desktop\坪优报价分析`）保留原始文件。
- **Python 面板运行时数据**：skus/orders 在 `ozon-product-analyzer/wb_data/`（本地数据，定期拷出备份）；**设置与费率唯一事实源在 `config/*.json`（git 跟踪）**。
- **React 本地状态**：`市场分析/persisted-data.json`（gitignored，本地持久化）。

---

## 6. 故障排查

| 现象 | 排查 |
|---|---|
| `npm test` Python 部分失败 | 确认 Python 3.10+ 安装且 `py -3` 或 `python3` 可用；看 `scripts/run-wb-py-test.js` 输出的解释器探测结果 |
| `npm start` 提示文件夹不存在 | `BASE_PATH` 指向的目录缺 市场价/报价表 子目录；确认 `LEGACY_PATH_ENABLED` 或自建 `data/市场价`、`data/报价表` |
| `node tunnel.js` 报 localtunnel 未安装 | 可选功能，不影响主服务；需要时 `npm install --no-save localtunnel` |
| React 页面上传后不显示新文件 | vite 数据同步插件需 dev server 运行；检查 `市场分析/uploads/` 与 `public/data/manifest.json` 的 `updatedAt` |
| Python 面板与 React 算出的 WB 费用不同 | 先检查 `ozon-product-analyzer/wb_data/settings.json` 的 `rub_per_cny` 是否被本机运行态改成非 12（仓库基线 12/12/12，见 BUSINESS_RULES §10）——若不一致，**登记 TD-1 并向需求方确认正确值，禁止顺手改** |
| `/api/ai` 502 | AI 图片服务（localhost:8000）未启动；非核心功能 |
| push 报 schannel 凭证错误 | Windows 凭据管理器配置 GitHub PAT：`git config credential.helper manager` 后首次 push 弹窗输入 |

---

## 7. 发布流程

```text
feature branch（fix/ feat/ docs/ refactor/ 前缀）
  → 自检：npm test 全绿 + git diff 无超范围改动
  → commit（一个逻辑变更一个清晰 commit）
  → push → 人验收
  → merge --no-ff 到 main（重大阶段打 tag）
```

---

## 8. AI 角色 → 当前模型映射（模型换代只改这里）

| 角色 | 当前推荐模型 |
|---|---|
| Lead / Pro（技术负责人） | DeepSeek V4 Pro（deepseek-v4-pro）；同级候选：GPT-5.6 |
| Fast / Flash（日常开发） | DeepSeek V4 Flash（deepseek-v4-flash）；同级候选：Kimi K3、Gemini 3.7 Flash（本机 Antigravity CLI：`agy --print --model gemini-3.7-flash-medium`，仅限有界子任务，产物必须过主代理评审与全量测试门） |
| Design / UI | 多模态模型（按需选择） |

> 说明：`deepseek-chat` / `deepseek-reasoner` 旧模型名已于 2026-07-24 停用；接 Agent 工具链时使用新模型名。AGENTS.md 不绑定任何型号。

---

## 9. 选品评分（T4）数据更新与重建

- **更新候选数据**：替换 `选品/跨境项目产品线扩展计划.xlsx` 后运行
  `node scripts/build-scoring-input.js` → 重新生成 `ozon-react/public/data/scoring_candidates.json`；
  随后必跑 `npm run test:scoring`（适配层回归锁定分布，期望值需随新数据复核）+ `node scripts/t4-score-audit.js`。
- **重建 BSR 基准**：更新 `市场分析/市场bsr/*.xlsx` 后运行 `node scripts/build-bsr-benchmark.js`
  （浏览器运行资产仅消费聚合后的 `bsr_market_benchmarks.json`，不把 19,000 行明细复制进运行时 JSON；
  原始 BSR xlsx 当前仍保留在 Git 仓库中，数据公开风险见 TD-19）；
  同样重跑审计确认映射覆盖率与维度验证矩阵。
- **评分规则**：只改 `config/scoring_rules.json`（唯一事实源）；`npm run test:sync` 校验生成物一致性；
  λ 越界（>1）或六维权重和≠100 会被 sync-config fail-close 拒绝。
- **测试入口**：`npm test`（scoring 81+20+13+导出+golden 56+python 31）；`npm run test:scoring`；`npm run test:scoring-golden`。
- **审计/实验**：`node scripts/t4-score-audit.js`；λ 校准实验用 `T4_SCALE_WEIGHT` 环境变量（PowerShell：`$env:T4_SCALE_WEIGHT=0.4`），生产值以 config 为准。
- **UI↔审计同源**：两者共用 `scoringDataAdapter.js`；验收对拍 `node _audit/tmp/verify-ui-audit-identity.js`（5 SKU 逐位一致）。
