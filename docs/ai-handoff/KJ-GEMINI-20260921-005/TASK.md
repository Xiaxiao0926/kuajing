# 005：合规事项表格窄屏可读性样板

执行者 Gemini，Codex 独立验收。状态 ready；仅本地实施，不提交、不推送、不部署。此任务不是全站重构授权。

## 目标

保留现有数据及业务结构，解决 Requirements 表格在 360/390px 下类别、风险、状态挤成逐字竖排，编辑/删除动作难以触达的问题。002 已修好的新增按钮不得退化。本次只做一个可验证的视觉样板。

## 先读与领取

读取 AGENTS.md、ARCHITECTURE.md 的组件约定、004/APPROVED_BASELINE.md、004/REVIEW-REVISION-001.md、004/FRONTEND_REFACTOR_PLAN.md、002/REVIEW.md 及其截图、ProjectCompliancePanel.jsx。
比较 CURRENT_TASK 的任务 ID 与本任务一致且 status=ready、claimed_by=null 后，先记录基线，才改 running/claimed_by=Gemini。若已有其他执行者或哈希变化，暂停并说明差异，不覆盖。
003 仍待合同验收，不实现认证适用性字段或任何新门禁。

## 输入冻结

HEAD de0cecf107e670e1c0d9cf393c50b92ab85afdee；工作区已有大量未提交改动。
精确文件及 SHA256 见同目录 BASELINE.json。必须保存允许修改文件的原始字节副本、哈希、开始 git status 与相关 diff；不得把已有差异算成本轮实现。

## 允许改动白名单

- ozon-react/src/components/t6/ProjectCompliancePanel.jsx：仅 Requirements 表格展示 JSX 与局部 className/必要语义属性，不改状态、effect、业务处理器、Store 调用或其他表单。
- 新增 tests/ia-project-compliance-table-layout.test.mjs，可放测试专用合成 fixture 于本任务 evidence/。
- 本任务 RESULT.md、tests.json、STATUS.json、evidence/；CURRENT_TASK.json 仅更新领取/结果状态。
- 不修改旧测试，尤其不能降低002的布局与001草稿测试断言。需要额外生产文件或状态变更时先报告，不自动扩大白名单。

禁止改 App/Sidebar、全局 CSS/基础组件、store/helper/gate、存储键/schema/API、业务公式、费率、真实数据、generated 索引、依赖、CI、WordPress/PHP、部署文件。不改变保存/取消/删除的业务行为。

## 方案与交互要求

先在 RESULT 记录简短取舍，再执行：本轮默认选稳定列宽+表格内部横向滚动，保留单份行编辑状态，避免另起一套手机表单。用本地宽度、换行与对齐改善阅读，不把整页撑宽。
若此方案经手机实测仍不可用，提交行摘要+详情方案，不自行引入新持久化/跨组件状态。

- 名称和说明允许合理多行；类别/必需/风险/状态/动作保证可辨识宽度，不挤成一字一行。
- 长说明不得只靠鼠标 hover 才能读完整；允许现有单元格自然换行，不隐藏关键字段。
- 编辑输入、保存/取消、删除确认全部能在容器内触达；删除仍二次确认，点击取消不写数据。
- 可滚动容器能获得键盘焦点，有简洁可访问名称；不新增大段使用说明或教程。
- 保持表格语义、现有 Lucide 图标及按钮名称；焦点可见，不靠颜色传达状态。
- 手机主要单元格文字以14px为目标，辅助标记可小一档，但不得缩字解决拥挤。固定字号，零负字距；沿用现有视觉，不嵌套装饰卡片。
- 新增事项区域、其他草稿区、冲突提示和外部更新处理完全保留。改变视口不能重置编辑输入。
- 不做自动轮播，不新增营销区或装饰图。

## 验收与真实浏览器证据

必须加载真实项目 CSS，在隔离合成数据/内存Store下测试，不接真实服务器写入。

1. 360、390、768、1440px：普通与长文本事项截图；390和1440追加编辑、删除确认、新增展开和空态截图。每张标明宽度和状态。
2. DOM 几何断言：整页无意外横向溢出；仅表格容器可横滚；状态文字非逐字竖排；动作滑到最右后完全可见、可点击；新增按钮保持横排。不能仅以 body.scrollWidth 判断全部通过。
3. 真实输入/点击验证：编辑再取消不调用保存；编辑并保存调用原处理器且只更改目标事项；删除取消不删，确认仅删指定事项；新增功能保留。
4. 编辑中从390切1440再回390，输入不丢失；其他合规草稿不被表格操作清空。沿用001专项验证A/B项目切换和外部冲突。
5. 新测试遇到断言失败应非0退出并设置 passed=false；缺浏览器/依赖必须 not_run，不能伪装通过。可用临时合成越界样式做故障注入验证测试确实会失败，不修改生产代码进行注入。
6. 复用旧测试的隔离编译/浏览器方式，但新测试不覆盖旧证据。CODEX_NODE_MODULES 需指向本机已有依赖；本机路径用运行环境注入，不能写入通用源码。缺环境报告阻塞，不擅自安装依赖。
7. 测试输出结果目录设置到005/evidence，避免覆盖002旧截图；现有布局测试通过环境变量 LAYOUT_EVIDENCE_DIR 指向本任务 evidence/legacy-layout。若其他旧测试不支持覆盖则先报告，勿直接改旧测试。

实际运行并留存逐条命令、退出码和日志：
- node tests/ia-project-compliance-table-layout.test.mjs
- node tests/ia-project-compliance-layout.test.mjs
- node tests/ia-project-compliance-draft.test.mjs
- node tests/ia-project-compliance.test.mjs
- node tests/ia-project-compliance-gate.test.mjs
- npm test
- npm run test:golden
- npm run test:sync
- npm --prefix ozon-react run build

遵守仓库 npm 测试启动器，不直接启动 Python。生成文件在运行前保存基线；若测试/构建引入非授权数据或manifest变化，记录并仅恢复本次生成差异到运行前副本，不用 git restore 回退其他人的修改，不删除整个dist。无源码修改就不声称完成UI实现。

## 交付与回滚

RESULT.md：本轮实际差异、方案取舍、各状态截图、验证、已知限制、明确未部署。
tests.json：分开记录静态/行为/几何/人工视觉检查，passed/failed/not_run；有跳过不能笼统写全部通过。
evidence/：原文件副本、baseline/post hashes、仅本轮diff、日志、截图、可重复执行命令。纯合成数据，不含凭据或真实业务记录。
回滚只逆转本轮白名单内增量；若目标有后续改动先停止协调。禁止数据库回滚、目录清空、Git强制重置。
完成后 CURRENT_TASK 与 STATUS 均为 review_ready，由 Codex 验收。不要创建后续任务，不把本地完成写成生产已上线。
