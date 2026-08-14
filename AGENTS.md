# AGENTS.md — AI 协作宪法

> 任何 AI（DeepSeek / Kimi / GPT / GLM / Codex / Claude 等）在本仓库工作前**必须先读本文件**。
> 本文件是仓库的最高行为准则；与具体模型型号无关（当前模型→角色映射见 `RUNBOOK.md`）。

---

## 1. 项目是什么

Ozon/WB 俄罗斯跨境电商运营工作区 = **4 个应用 + 多类业务数据资产**。

| # | 应用 | 技术栈 | 端口 | 职责 |
|---|------|--------|------|------|
| 1 | Ozon 跨境运营面板 | React + Vite | 5173 | 主入口：市场调研 / Ozon+WB 核算 / 内容制作 |
| 2 | 价格分析 API | Node.js | 8888 | 市场价清洗 / 价格优势分析 / 候选商品管理 |
| 3 | WB 跨境核算面板（Python） | Streamlit | 8502 | WB 运费/利润/反向赔偿核算（独立单元） |
| 4 | Ozon 选品分析面板（Python） | Streamlit | 8501 | 市场数据分析 / 产品定价建议 |

详细架构与数据流见 `ARCHITECTURE.md`。

---

## 2. 目录分类

### 2.1 生产代码（改动须遵守本文全部规则）
- `ozon-react/` — React 前端（组件 `src/components/`，引擎 `src/utils/`）
- `ozon-product-analyzer/` — Python 面板（`wb_calc.py`/`wb_data.py`/`wb_panel.py`/`app.py`）
- `server.js` / `config.js` / `market_data_processor.js` / `analyze_with_cleaned_data.js` — Node 价格分析
- `scripts/` — 跨平台测试启动器（AI 不得绕过，见 §5）

### 2.2 业务数据（**禁止删除、禁止改动内容**）
- `市场分析/`、`选品/`、`运费计算/`（含需求规格说明书与费率 PDF）
- 根目录 xlsx/pdf 业务文件
- `ozon-react/public/data/`（WB 佣金表、热销数据、manifest）

### 2.3 历史归档（**只读，禁止修改**）
- `_archive/`（debug / analysis / deprecated / reports / migration）

### 2.4 文档（先读后改）
- 本文件、`ARCHITECTURE.md`、`BUSINESS_RULES.md`、`RUNBOOK.md`、`CHANGELOG.md`、`TECH_DEBT.md`
- `_audit/secret_audit_report.md`（安全审计历史，只读）

---

## 3. 禁止事项（无例外）

1. **禁止修改计算公式**：`wbEngine.js`、`ozonEngine.js`、`wb_calc.py`、`wbConfig.js`、`ozonEngine.js` 中的运费/佣金/利润/赔偿逻辑，除非需求方明确要求，且**同时**更新 `BUSINESS_RULES.md` 与黄金案例。
2. **禁止提交任何凭据**：API Key / Token / Cookie / `.env` / `*.pem` / `*.key` / `ai_config.json`。
3. **禁止写死本机路径**（`D:\`、`E:\`、`C:\Users\` 等）。一律使用环境变量 `OZON_DATA_DIR` / `WB_DATA_DIR` / `CONFIG_DIR` / `BASE_PATH` + 文档化默认值。
4. **禁止顺手重构、升级依赖、统一代码风格、删除"看起来没用"的数据、迁移技术栈。** 发现技术债只能登记 `TECH_DEBT.md`，等待授权。
5. **禁止无需求大规模重写。** 本项目最初由 GLM 生成——历史来源不是重写理由。
6. **禁止把业务数据 xlsx/pdf 推送到公开仓库**，除非需求方确认脱敏。
7. **禁止在本文件或 AGENTS 层绑定具体模型型号**；模型换代只改 `RUNBOOK.md` 的映射表。

---

## 4. 修改前必须读

| 修改对象 | 必读 |
|---|---|
| 计算/费率/佣金/利润 | `BUSINESS_RULES.md` + 对应引擎测试文件 |
| 路径/配置/启动 | `RUNBOOK.md` §路径配置 |
| React UI | 对应组件 + `ARCHITECTURE.md` §关键文件索引 |
| 数据结构/迁移 | `ARCHITECTURE.md` + `TECH_DEBT.md` |

---

## 5. 修改后必须跑（真执行，禁止口头声称"应该没影响"）

### 当前强制测试（每次修改后必须运行且必须全绿）
```bash
npm test          # React wbEngine 65 项 + Python wb_test 31 项
```

### 阶段化测试（T2 完成前**未启用**，不得依赖其结果）
```bash
npm run test:golden   # ⚠️ 当前为占位器（输出 SKIP 后退出 0），不代表黄金案例已通过
npm run test:sync     # ⚠️ 当前为占位器（输出 SKIP 后退出 0），不代表双端对拍已通过
```

> T2 完成后，这两条升级为强制测试，届时删除本"未启用"说明。
> 只允许使用以上 npm 命令；禁止直接调用 `python` / `python3` / `py` 启动器（跨平台探测已封装在 `scripts/run-wb-py-test.js`）。

---

## 6. 修改范围铁律

- **只改完成当前任务必须的文件。** 任何超范围改动必须先在回复中说明理由并等待确认。
- 页面组件只做编排（orchestration）；计算逻辑属于引擎层（`src/utils/`），不得下沉进组件。
- 拆分组件不得顺手"优化"业务逻辑；拆分前后计算结果必须逐位一致。

---

## 7. Git 纪律

```text
main
  ├── fix/<issue>-<desc>      一个任务 = 一个分支 = 一个清晰 commit
  ├── feat/<desc>
  ├── docs/<desc>
  └── refactor/<desc>
```

- 禁止连续多天工作后一次性提交；每个 commit 只做一件事。
- 提交前自查 `git diff` 是否超范围；**业务计算文件的意外改动 = 失败**。
- 改坏了 `git reset` 即回滚；重大阶段合并用 `--no-ff` 并在 main 上打 tag（如 `v3-t0-baseline`）。

---

## 8. AI 角色分工（与型号无关）

| 角色 | 适用任务 |
|---|---|
| **Lead / Pro** | 架构决策、未知 Bug 分析、业务公式变更、跨端（React+Python）修改、数据迁移、大型重构、Git 事故处理 |
| **Fast / Flash** | UI 小改、字段/文案、明确小 Bug、写测试、补文档、已批准方案的机械执行 |
| **Design / UI** | 视觉/交互设计、组件外观 |

- Fast 不得自行决定是否重构系统；只能执行 Lead 已批准的方案。
- 具体当前模型→角色映射见 `RUNBOOK.md`（模型换代只改那里）。

---

## 9. 复杂任务工作流（强制）

```
第一阶段：阅读（只分析）
  → 列出涉及文件、解释现有数据流、说明拟改范围、列风险
  → 禁止写代码
第二阶段：执行（小范围修改）
第三阶段：测试（npm test 全绿；黄金案例存在时加跑）
第四阶段：git diff 自查是否超范围
第五阶段：提交（一个清晰 commit）
```

涉及利润计算的任务，第一阶段只允许分析，不得直接改引擎。
