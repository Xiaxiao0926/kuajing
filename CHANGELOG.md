# CHANGELOG.md — 变更记录

> 记录原则：每个有意义的变更（功能/修复/重构/文档/数据）必须在此登记。
> 格式：日期 | 类型 | 说明（关联 commit/tag）。类型：feat / fix / refactor / docs / chore / data。

---

## 2026-08-14（整改阶段 V3）

### docs — T1 文档层（AI 接管交付物）
- 新增 `AGENTS.md`：AI 协作宪法（禁止事项、强制测试、范围铁律、Git 纪律、角色分工、复杂任务工作流）。
- 新增 `ARCHITECTURE.md`：4 应用拓扑、数据流、关键文件索引、已知漂移。
- 新增 `BUSINESS_RULES.md`：业务公式唯一权威描述（WB 运费/利润/反向赔偿 + Ozon CEL 渠道），来源标注到规格章节。
- 新增 `RUNBOOK.md`：启动/测试/路径配置/费率更新/备份/故障排查 + AI 角色→模型映射表。
- 新增 `TECH_DEBT.md`：13 项技术债登记（含双端汇率漂移 TD-1）。
- 新增本文件 `CHANGELOG.md`。
- 分支：`docs/v3-t1-ai-handoff`（待验收合并）。

### chore — T0 收尾（已合并 main，tag `v3-t0-baseline`）
- `fix/v3-t0-cleanup` 合并进 main（merge `744bb14`）。
- 回退 `manifest.json` 运行时 timestamp 无关改动（`1cd502b`）。
- `tunnel.js` 提示改为 `npm install --no-save localtunnel`（可选依赖不写入 package.json）。
- Secret 审计结论措辞严谨化（"扫描范围内未发现已知敏感凭据"）。
- 新增 `整改任务书V3.md`（V3.1：审计报告入库、平台无关测试命令、Lead/Fast 去型号化、T2 迁移冻结、golden provenance）。

### fix — T0 整改收尾（`e298f56`）
- Secret 审计报告 `_audit/secret_audit_report.md` 入库（gitignored 仅 raw/tmp）。
- 跨平台测试：`scripts/run-wb-py-test.js`（py -3 → python3 → python 探测）；`package.json` 新增 `test:python`/`test:golden`/`test:sync`。
- `tunnel.js` 缺 localtunnel 时优雅退出 exit 0（不再崩溃）。
- 删除 `cc-switch/` 残留仓库；`public/` 37 个孤儿脚本归档至 `_archive/deprecated/`。
- 旧 PRD/技术文档归位 `ozon_hair_dryer_analysis/`；删除空 `uploads/` 与 `cloudflared.exe`（51MB）。
- 验证：npm test 全绿（React 65 + Python 31）；npm start 冒烟通过；零业务公式改动。

### chore — P1 工程卫生（`d6a197d`）
- 29 个一次性脚本归档至 `_archive/{debug,analysis,deprecated,reports,migration}`，根目录 43→14 文件。
- 新增根 `README.md`（4 应用清单/启动/数据流/目录结构）。
- `config.js` 三层路径优先级（BASE_PATH → data/ → Legacy）+ `LEGACY_PATH_ENABLED` 开关。
- `tunnel.js` 去硬编码路径（该改动引入 localtunnel 依赖缺失问题，已在 T0 修复）。
- 根 `package.json` 接入 `npm test`（当时 Python 部分在本机 python 空壳环境失败，T0 已改为跨平台探测）。

### chore — 全量快照（`7456a6d`）
- 首次全量快照：ozon-react、ozon-product-analyzer、server.js、运费计算文档。
- 测试基线：React wbEngine 65 通过 / Python wb_test 31 通过。
- 数据资产入库：WB 佣金表（96 类目/7424 条）、CEL 费率表、0726 费率 PDF。

---

## 2026-05-22 之前

### feat — 项目初始（`747f254`）
- init：OZON 跨境电商项目 = React 前端（市场调研/核算面板）+ 京东联盟后端（jd-union-service，已在快照中移除）。
- 业务数据形成期：市场分析（发膜/护发喷雾/矫形枕/手套/枕头热销数据 05-06~05-12）、供应链工厂目录、样品终选和包材。
- WB 需求规格说明书 V1.1 定稿（DPX 线路、反向赔偿 13.1.14）。
