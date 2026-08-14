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
npm test             # 强制：React 65 + Python 31（跨平台，自动探测 py -3/python3/python）
npm run test:python  # 仅 Python 31 项
npm run test:golden  # ⚠️ T2 完成前是占位器（SKIP 退出 0），不代表黄金案例通过
npm run test:sync    # ⚠️ T2 完成前是占位器（SKIP 退出 0），不代表双端对拍通过
```

**修改任何涉及 wbEngine/ozonEngine/tariffs/commission/logistics/profit/税费/汇率/成本的代码后，必须 `npm test` 全绿后才能提交。**

---

## 3. 路径配置（环境变量）

| 变量 | 作用 | 默认值 |
|---|---|---|
| `BASE_PATH` | 价格分析 API 数据根目录（含 市场价/报价表/分析结果 子目录） | Legacy 回退见下 |
| `PORT` | 价格分析 API 端口 | 8888 |
| `LEGACY_PATH_ENABLED` | 是否允许回退到 `E:\Desktop\坪优报价分析` | `true` |
| `OZON_DATA_DIR` | Python 选品面板数据目录（T2 生效） | — |
| `WB_DATA_DIR` | Python WB 面板数据目录（T2 生效） | — |
| `CONFIG_DIR` | 双端共享配置目录（T2 生效） | — |

三层优先级（`config.js` 已实现）：
1. `BASE_PATH` 环境变量；
2. 项目内 `data/`；
3. Legacy `E:\Desktop\坪优报价分析`（仅当 `LEGACY_PATH_ENABLED != false`）。

**禁止在代码中写死本机路径**；换机器只需设环境变量。

---

## 4. 更新费率流程（示例：WB 平台调价）

1. 取得官方费率文件/公告，存入 `运费计算/`（保留原文件名+日期）。
2. **不修改引擎代码**——T2 后只改 `config/wb_tariffs.json`（新增版本条目：`effective_from` 新日期，旧版本设 `effective_to`）。
3. T2 前临时做法：React 在 `wbConfig.js` 追加新版本对象；Python 在 `wb_data/tariffs.json` 追加同值条目；**两端必须同步改**。
4. `npm test` 全绿；补充新版本测试用例（参考 `wbEngine.test.mjs` 的历史版本测试写法）。
5. 更新 `BUSINESS_RULES.md` §3 与 `CHANGELOG.md`。
6. 历史订单不受影响（按订单日期匹配版本）。

---

## 5. 备份与恢复

- **代码**：git 是唯一事实源。每阶段合并到 main 并打 tag（如 `v3-t0-baseline`）。备份 = `git clone https://github.com/Xiaxiao0926/kuajing.git`。
- **业务数据**（市场分析/、选品/、运费计算/、根目录 xlsx）：git 内包含；另有原位置（`E:\Desktop\坪优报价分析`）保留原始文件。
- **Python 面板运行时数据**：`ozon-product-analyzer/wb_data/*.json`（settings/tariffs/skus/orders）。tariffs 在 git 内；skus/orders 为本地数据，定期拷出备份。
- **React 本地状态**：`市场分析/persisted-data.json`（gitignored，本地持久化）。

---

## 6. 故障排查

| 现象 | 排查 |
|---|---|
| `npm test` Python 部分失败 | 确认 Python 3.10+ 安装且 `py -3` 或 `python3` 可用；看 `scripts/run-wb-py-test.js` 输出的解释器探测结果 |
| `npm start` 提示文件夹不存在 | `BASE_PATH` 指向的目录缺 市场价/报价表 子目录；确认 `LEGACY_PATH_ENABLED` 或自建 `data/市场价`、`data/报价表` |
| `node tunnel.js` 报 localtunnel 未安装 | 可选功能，不影响主服务；需要时 `npm install --no-save localtunnel` |
| React 页面上传后不显示新文件 | vite 数据同步插件需 dev server 运行；检查 `市场分析/uploads/` 与 `public/data/manifest.json` 的 `updatedAt` |
| Python 面板与 React 算出的 WB 费用不同 | 已知汇率漂移（BUSINESS_RULES §10：React 12 vs Python settings.json 11.5）——T2 统一 config 前属预期，报告中注明即可，**禁止顺手改** |
| `/api/ai` 502 | AI 图片服务（localhost:8000）未启动；非核心功能 |
| push 报 schannel 凭证错误 | Windows 凭据管理器配置 GitHub PAT：`git config credential.helper manager` 后首次 push 弹窗输入 |

---

## 7. 发布流程

```text
feature branch（fix/ feat/ docs/ refactor/ 前缀）
  → 自检：npm test 全绿 + git diff 无超范围改动
  → commit（一个任务一个清晰 commit）
  → push → 人验收
  → merge --no-ff 到 main（重大阶段打 tag）
```

---

## 8. AI 角色 → 当前模型映射（模型换代只改这里）

| 角色 | 当前推荐模型 |
|---|---|
| Lead / Pro（技术负责人） | DeepSeek V4 Pro（deepseek-v4-pro）；同级候选：GPT-5.6 |
| Fast / Flash（日常开发） | DeepSeek V4 Flash（deepseek-v4-flash）；同级候选：Kimi K3 |
| Design / UI | 多模态模型（按需选择） |

> 说明：`deepseek-chat` / `deepseek-reasoner` 旧模型名已于 2026-07-24 停用；接 Agent 工具链时使用新模型名。AGENTS.md 不绑定任何型号。
