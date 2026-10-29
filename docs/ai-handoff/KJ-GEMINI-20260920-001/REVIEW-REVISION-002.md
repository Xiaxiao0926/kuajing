# Revision 002 最终本地验收

日期：2026-09-21。
结论：**ACCEPTED_WITH_KNOWN_LIMITATIONS**。草稿保护核心修复通过；手机布局收尾单独移交 KJ-GEMINI-20260921-002。不代表已提交、已部署、服务器同步已验收或线上最终验收。

## 独立验证结果

- 原冻结交付三个文件哈希与 Gemini 报告一致。
- 专项草稿测试（包括实际 React/Chrome A/B/C/F/G/G2/G3 和双侧扩展场景）通过。
- 合规档案测试 32 组、门禁测试 49 项通过。
- npm test、test:golden、test:sync、前端生产构建均独立复跑，退出码 0。
- 独立执行缺依赖分支：明确 not_run，未显示全场景通过。
- 独立注入测试断言错误：子进程退出码 1，包含错误且不显示全场景通过。
- Codex 自有真实组件测试 A/B/F/G/G2/G3 全部通过；测试使用内存 Store 与合成数据，禁用外部网络。
- 构建前后 manifest SHA256 一致；恢复的是执行前字节，不是 Git 版本。保留本地 dist 构建产物，没有删除其他输出。

## 已关闭

- R1：切换项目串写。
- R2：同 ID 父级重渲染时读取陈旧项目。
- R4：草稿回到旧值后冲突隐藏；匹配外部值后再编辑基准失效。
- R5：浏览器断言错误被当成环境问题吞掉。
- R6：正式专项测试的本机硬编码依赖路径。

## H 视觉补验与剩余项

本次使用项目实际 index.css、Tailwind 配置编译样式，真实 Chrome 渲染组件，检查 1440px 与 390px，保存全页截图并查看。

- 两种宽度的文档宽度均等于 viewport，按钮与输入框没有越出左右边界。
- 评估/计划表单及冲突横幅文字能换行，无明显遮挡。
- **390px 的“新增事项”被挤成逐字竖排**，按钮可读性不达标。该 Requirements header 原来就缺少合适的换行/防收缩策略，非本轮草稿逻辑引入；不把它当作数据逻辑返工。
- H 的几何检查通过不等于全部视觉合格；H 总体为 partial，手机按钮列入下一任务并在部署前完成。
- 这里只验了带项目样式的隔离组件，尚未验 WordPress 外壳、侧栏内嵌或真实线上页面。

## 明确保留的限制

- 冲突是提示而非强制锁。用户在看到冲突后仍可主动点击保存本地值；不得宣称实现了服务器级并发合并或禁止覆盖。
- 没有通知/重渲染时不会自动感知其他终端；本次不代表跨端实时同步验收。
- 站内切页离开拦截、Requirement 单独编辑的离开提醒、全站备份恢复仍未纳入本次完整验收。
- 当前专项浏览器测试不自动加入部署流水线；缺依赖时可报告 not_run。因此下一次上线门必须显式运行，不能仅依赖 npm test。
- 本次没有复核此前整个 Gemini 重构、所有未提交文件或服务器 API。

## 证据

- evidence/codex-final-review.mjs / codex-final-review.json
- evidence/codex-final-1440.png / codex-final-390.png
- evidence/codex-final-checks.mjs / codex-final-checks.json
- evidence/codex-final-{draft,compliance,gate,npm,golden,sync,build,missing-dependency,fault-injection}.log

首轮构建复验因 Codex 自定义输出目录的命令引号错误失败，非业务代码错误；保留 codex-build-attempt1-path-error.log，改用项目标准构建命令后成功。没有隐去该尝试。

不部署。当前任务保留结果，下一步仅处理手机布局收尾，再进行认证适用性合同修订。
