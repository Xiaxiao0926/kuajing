# KJ-GEMINI-20260921-003：认证适用性合同修订

执行者 Gemini，验收 Codex。只做本地文档与只读代码审计，不修改生产代码/测试，不提交、push、部署，不实施 07A-4C3B。

## 目标

修订 docs/ia/TASK07A4C3A_CERTIFICATION_APPLICABILITY_CONTRACT.md，使下一轮能按明确、可验证的合同开发。不要重做已验收的草稿保护或手机标题布局。
该旧文档的 IMPLEMENTATION STATUS: READY 并非当前授权；本任务应改为待 Codex 验收，消除矛盾。

## 必读与输入冻结

- AGENTS.md、ARCHITECTURE.md、TECH_DEBT.md、docs/ai-handoff/README.md、任务 001 的 REVIEW-REVISION-002.md、任务 002 的 REVIEW.md。
- 07A4A、07A4C1、07A4C2 与旧 07A4C3A 合同；complianceProfile.js、t6Store.js、gateEngine.js、ProjectDetailPage.jsx、ProjectCompliancePanel.jsx、complianceDraftState.js 及相关测试。
- HEAD 基线：de0cecf107e670e1c0d9cf393c50b92ab85afdee。开始前实测；现工作区有大量未提交内容，以当前文件而非 HEAD 版本审计，不清理。
- 旧 4C3A SHA256：CD466667FE216455E8EC2FA14A57D951D19A06349492623DBA3E7293347B01AF。
- t6Store.js：7952EA5669DCC8DBD7C2BF6DFF2BB02DF62D864D23443A7B3FC31E935F2D3F4E。
- complianceProfile.js：47F0EB78C1C5FF61C6A4FEEFB7C48924AA2BE7738DFD02ABC71E9C558032B7AE。
- gateEngine.js：D8F4EEB0D784BBF111D6EB22261F7FF692B92BFBEBB3712F994F69140FB7BA78。
- ProjectDetailPage.jsx：83ADF484DE082DBA76B053BB3840FBC62CEF8985154499473DDE34AA99D7EDE7。
- ProjectCompliancePanel.jsx：8D1A4772569CF59050A6C20C2CE59A2AABC7BC0E564F3DD5BCB390982BFCEC41。
- 草稿 helper 与测试哈希见任务 002 REVIEW.md。开始及结束记录全部审计目标哈希；如漂移，确认实际差异，不覆盖。

## 允许写入

1. 上述 4C3A 合同文档（先保存原副本）。
2. 本任务 RESULT.md、tests.json、evidence/、拟开发文件清单与验收矩阵。
3. CURRENT_TASK.json 的领取/完成状态，不自行指向后续任务。

不改业务代码、通用文档、业务数据、CI、依赖、账号权限，不读取凭据/用户会话，不联网操作生产。

## 必须解决的合同缺口

### A. Store 保存与审计日志

旧合同称“只扩 profile 白名单自然支持”不完整：t6Store.updateProjectCompliance 的 PROFILE_FIELDS 是独立硬编码列表。列出白名单、changedFields、no-op、from/to、审计记录、读取层和 Gate 注入的完整影响链。
写出只改新字段时如何确保持久化并生成一次准确日志；相同值再次保存如何 no-op。不能假称当前已支持。

### B. 历史缺字段不能被其他保存暗中补齐

buildNextProjectCompliance 把初始默认值合并进现对象。若直接扩初始默认值，旧档案只保存 notes 或 Requirement CRUD 就可能变成显式 UNASSESSED，改变门禁含义。
明确区分 UI 显示默认值与持久化事实，定义字段缺失、undefined/null/空串/非法值、显式未评估的处理；非本区块保存和未修改选择不得隐式写入。
新项目与旧项目分别给出真实保存前后 JSON；必须覆盖 notes-only、plan-only、事项增删改、仅打开页面、无变更保存。
不得全库迁移、不得拿“默认补齐”冒充兼容；不要自动更新已处于后续阶段的旧项目。

### C. 判断依据与术语边界

必须区分“需要合格评定处理”“目前判断不需要该处理”“尚未判断”，并说明市场线索、项目人员判断、计划、正式结果不是同一层。
旧文档对 EXEMPT、拒绝函/不适用说明、普通货物以及具体品类的法律断言没有引用，不得原样作为事实冻结。此次以软件内部业务语义为准：删除或标记待专业核验，不据此给任何具体 SKU 下法律结论。无须开展新的法规研究来扩大本任务。
提出最小的判断依据记录（字段、类型、归属、校验、旧值兼容），不能只选 NOT_REQUIRED 就宣称无需任何证明、可清关/销售。判断依据不能挪用暂不开放的证书结果/附件字段。
法规适用结论与上架许可分开；认证路径“计划明确”通过，仅是内部计划检查通过，不代表已取得证件、海关或平台审核通过。

### D. Gate 决策表与风险可见

保留 cert_plan ID，列出缺模块、历史缺字段、显式未判断、需要但无计划、有计划、不需要但无依据、有依据、非法值、空白文本、COMPLETED 与适用性不一致等矩阵。
NOT_EVALUATED 不等于 PASS。解释当前聚合/推进行为及 override 日志，明确任何拟议变化与兼容风险，不能以“零阻断兼容”掩盖未知状态，也不在本轮改变推进政策。
给 SAMPLING -> PRODUCTION 跨阶段例子，但不得把通过内部计划门写成“全链路法定合规放行”。

### E. UI 与草稿保护

冻结字段归属与保存按钮责任：新增选择和依据在同一明确区块保存；另一区块保存不提交它们。
列出草稿 baseline/dirty/conflict/rebase/项目切换/错误保留受影响函数及后续测试，不得回退任务 001 成果。
本轮只文字说明控件方案，不改 JSX，不处理手机表格 backlog。

## 交付与验收

- 修订合同：明确旧方案缺口、实际代码位置、新字段合同、旧/新项目 JSON、Store 影响、Gate 决策表、UI 保存责任、未来开发白名单、回滚与测试矩阵。
- 决策必须可执行；有待裁决项明确标出，禁止边说待定边标 READY。
- RESULT.md 区分“本轮文档完成”和“未来拟实施”；记录实际哈希及差异。
- tests.json：静态核验与文档一致性逐项记录；运行时验证写 not_run（文档任务未开发），不得伪称 PASS。无须重复运行全部构建，生产/测试文件哈希不变为范围证据。
- 保存原合同副本及本轮 diff；回滚仅撤回本轮文档增量，不覆盖后续编辑。
- 完成后置 review_ready，交 Codex 审核。下一实施任务必须另行签发。
