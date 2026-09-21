# 附录 C · 术语表与命名约定（Glossary）

> 统一术语是本套文档可执行的前提：任何文档、代码、UI 文案、事件命名都必须使用本表术语；同义异名视为缺陷。

---

## C.1 核心术语

| 术语（中/英） | 定义 | 不用于 |
| --- | --- | --- |
| **Harness** | 承载 Agent 的完整工程体系：内核 + 外壳 + 端 + 生态 | 不指「模型」或「应用」 |
| **内核 / Kernel** | 无框架依赖的纯 Java 领域运行时：Agent 循环、上下文、工具、权限决策、工作对象、事件模型 | 不指「Spring 服务」 |
| **外壳 / Host** | 承载内核的应用层：应用服务、适配器、协议面、装配 | 不指「端」 |
| **端 / Surface** | 用户可见形态：CLI/TUI、桌面端、IDE 插件、只读跟随端 | 不指「外壳」 |
| **Thread / Turn / Item** | 会话主线 / 一次用户意图的完整处理 / 原子输入输出 | 不用「消息流」替代 |
| **会话 / Session** | 用户与 Agent 的一段持续交互（含多个 Turn） | 不指「进程」 |
| **上下文快照 / ContextSnapshot** | 一次模型调用的完整输入形态（九区段 + 元数据） | 不指「提示词」 |
| **区段 / Section** | 上下文快照中的一层（S1–S9） | — |
| **压缩 / Compaction** | 超预算时对上下文的多级缩减（裁剪/摘要/替换/折叠） | 不指「模型压缩」 |
| **引用外置 / Artifact Reference** | 大结果不内联，转为可寻址引用 | 不指「链接」 |
| **工具契约 / ToolSpec** | 工具的声明（语义 + Schema + 风险 + 资源） | 不指「函数签名」 |
| **动作描述 / ActionDescriptor** | 一次待判定动作的规范化描述（工具 + 参数 + 目标资源 + 风险线索） | 不指「请求」 |
| **权限决策 / PermissionDecision** | 策略求值结果：ALLOW / ALLOW_ONCE / ASK / DENY | 不指「审批」 |
| **审批 / Approval** | 对 ASK 结果的人工/自动裁定流程 | 不指「决策」 |
| **授权记忆 / GrantMemory** | 记住的授权（含范围与到期） | 不指「策略」 |
| **沙箱档 / Isolation Tier** | L0 / L0+ / L1 / L2 / L3 五档隔离 | 不指「容器」 |
| **工作区 / Workspace** | 统一抽象的执行现场（本地/SSH/容器/云） | 不指「目录」 |
| **worktree 隔离** | 用 Git worktree 为并行任务提供独立工作树 | 不指「分支」 |
| **Skill / 技能** | 内容型能力包（指令 + 资源 + 脚本 + 工具声明 + 验收） | 不指「工具」 |
| **Plugin / 插件** | 代码型扩展（实现扩展点，可携带技能） | 不指「脚本」 |
| **Hook / 钩子** | 生命周期干预点上的轻量观察/阻断/改写 | 不指「插件」 |
| **扩展点 / Extension Point** | 内核暴露的可实现接口（稳定性分级） | 不指「API」 |
| **记忆 / Memory** | 跨会话可复用的偏好、约定与结论（四层） | 不指「知识」「历史」 |
| **知识库 / Knowledge Base** | 外部文档与代码的索引与检索 | 不指「记忆」 |
| **历史 / History** | 发生过什么的完整事件记录 | 不指「记忆」 |
| **WorkItem** | 统一工作对象：Goal → Plan → Task → Step | 不用「工单」 |
| **证据 / Evidence** | 完成判定的客观依据（命令输出/测试结果/引用） | 不指「说明」 |
| **验收标准 / Acceptance** | 可检验的完成条件 | 不指「需求」 |
| **Goal 目标模式** | 目标 + 验收 + 预算 + 终止条件的长期自治运行 | 不指「任务」 |
| **Schedule 计划模式** | 按时间/事件/条件触发的自动化 | 不指「定时器」 |
| **Agent Teams** | 多角色协作的团队执行（编制 + 拓扑 + 黑板 + 预算） | 不指「子 Agent」 |
| **SubAgent / 子 Agent** | 由父 Agent 派生的独立上下文执行体 | 不指「团队成员」 |
| **自主度 / Autonomy Level** | 建议 / 协作 / 自治 三档 | 不指「权限模式」 |
| **权限模式 / Permission Mode** | readonly / plan / default / acceptEdits / autonomous / yolo | 不指「自主度」 |
| **事件 / Event** | 事实源记录（领域/系统/遥测三类） | 不指「日志」 |
| **投影 / Projection** | 由事件派生的读模型 | 不指「缓存」 |
| **检查点 / Checkpoint** | 可恢复的结构化进度快照 | 不指「备份」 |
| **副作用账本 / Side-effect Ledger** | 已发生非幂等动作的记录（防重放重复执行） | 不指「审计」 |
| **审计事件 / Audit Event** | 不可篡改的安全与合规记录 | 不指「业务事件」 |
| **A2A** | Agent 间任务级互操作（服务面 + 客户端面） | 与 MCP 混用 |
| **MCP** | 能力接入协议（工具/资源/提示词） | 与 A2A 混用 |
| **联邦 / Federation** | 多实例注册与路由协作 | 不指「集群」 |
| **DLP** | 数据防泄漏策略（外发内容管控） | 不指「脱敏」 |
| **信封加密** | 用数据密钥加密内容、密钥再被主密钥加密 | 不指「哈希」 |
| **基线 / Baseline** | 评测指标的版本化参考值 | 不指「默认值」 |
| **门禁 / Gate** | 变更必须通过的评测集合 | 不指「审批」 |

## C.2 易混淆概念对照

| A | B | 区别 |
| --- | --- | --- |
| 记忆 Memory | 知识 Knowledge | 记忆是「关于你与项目的结论」，知识是「文档与代码的内容」 |
| 权限 Permission | 自主度 Autonomy | 权限决定「能不能做」，自主度决定「是否需要先问」 |
| 沙箱 Sandbox | 工作区 Workspace | 沙箱是「边界」，工作区是「现场」 |
| 审批 Approval | 授权记忆 GrantMemory | 审批是一次裁定，授权记忆是裁定结果的复用 |
| 工具 Tool | 技能 Skill | 工具是「动作」，技能是「做法与知识」 |
| 插件 Plugin | 钩子 Hook | 插件是能力提供者，钩子是流程干预者 |
| 事件 Event | 日志 Log | 事件是事实源（结构化、持久、可回放），日志是技术诊断输出 |
| 投影 Projection | 快照 Snapshot | 投影由事件推导（可重建），快照是某时刻状态（可校验） |
| 目标 Goal | 任务 Task | 目标是长期意图（含终止条件），任务是可执行可验收单元 |
| SubAgent | 团队成员 Member | 子 Agent 属于单 Agent 内部；成员属于团队编排 |

## C.3 命名约定

| 类别 | 约定 | 示例 |
| --- | --- | --- |
| 代码包 | `com.hk.opencoding.<band>.<domain>` | `...kernel.agent`、`...platform.persistence` |
| 类名 | 领域名词，无技术后缀滥用 | `ContextEngine`、`PermissionChain` |
| 事件 | `<域>.<对象>.<动作>` | `tool.call.completed` |
| 指标 | `oc_<域>_<对象>_<指标>` | `oc_model_request_latency_ms` |
| 错误码 | 大写下划线 | `TASK_STATE_INVALID` |
| 表 | `oc_<对象>` | `oc_workitem` |
| 配置 | `open-coding.<域>.<项>` | `open-coding.model.routing.default-model` |
| 环境变量 | 大写下划线，服务名前缀 | `OPEN_CODING_...`、`ANTHROPIC_API_KEY` |
| 短 ID | 前缀 + 短码 | `T-7f3a`、`AR-4f21` |
| 分支 | `oc/<task-id>-<slug>` | `oc/T-7f3a-fix-login` |
| worktree 目录 | `<home>/worktrees/<repo>/<task-id>` | — |
| Redis Key | `oc:<module>:<type>:<biz>` | `oc:session:lock:S-1b2c` |
| 事件版本 | 语义化整数 | `version: 3` |

## C.4 与 v1（当前仓库）词汇的映射

> 说明：v1 是既有实现（`docs/design/*`），本套为目标态。下表用于阅读存量代码时的心智转换。

| v1 词汇 | 目标态对应 | 说明 |
| --- | --- | --- |
| core-api / core-model / core-agent / core-tool / core-implementation | 内核域带各域（卷 01 §4.2） | 拆分维度由「技术层」改为「能力域 + 三带」 |
| `oc_*` 表（v1） | `oc_*` 表族（附录 A.6） | 前缀保留，分域与所有权重新定义 |
| Provider / ModelDescriptor（v1） | 同名词（卷 02） | 语义保留，增加能力矩阵与路由 |
| ToolDefinition / @Tool（v1） | ToolSpec 三通道（卷 05） | 注解式保留为通道 A |
| 权限模式（v1 §5.7） | 六档模式（卷 06 D-PERM-9） | 档位扩展为六档并对齐自主度 |
| 事件流时序（v1 §10） | 事件系统（卷 16） | 双通道（实时/持久）明确化 |
| 会话并发单飞 + 队列（v1） | 会话执行体（卷 01 §4.6） | 保留并扩展队列策略 |
| fork / resume / export / import（v1） | 会话协议（附录 B.2）+ 导出包（卷 19 §4.4） | 能力保留，格式厂商中立 |

## C.5 缩写表

| 缩写 | 全称 |
| --- | --- |
| A2A | Agent to Agent |
| DLP | Data Loss Prevention |
| EDD | Evaluation-Driven Development |
| JSON-RPC | JSON Remote Procedure Call |
| LSP | Language Server Protocol |
| MCP | Model Context Protocol |
| PITR | Point-In-Time Recovery |
| RBAC | Role-Based Access Control |
| RPO / RTO | Recovery Point / Time Objective |
| SCIM | System for Cross-domain Identity Management |
| SLO / SLI | Service Level Objective / Indicator |
| SSE | Server-Sent Events |
| SSO | Single Sign-On |
| WS | WebSocket |

---

## C.6 术语口径补注（R03 跨语料一致性轮增补）

> 背景：R03 跨语料审计发现若干「同表词汇被另一概念合法复用」与「简写与全称并存」的情形。为避免误判为术语违规，本节显式登记合法用例与口径；**不修改 C.1–C.5 任何既有条目**。

| # | 术语/简写 | 实际用法（经核验，合法） | 口径说明 |
| --- | --- | --- | --- |
| C6-1 | 「工单」 | `FeedbackTicketService`（附录 D E-15）、`ITERATIONS.md` 轮次 2 的「反馈与工单服务」、`DECISIONS.md` H-018「CI/工单/其他 Agent」 | C.1「WorkItem 不用『工单』」约束的是**内部工作对象命名**；上述「工单」指**外部工单/工单系统实体**（Feedback Ticket），不属 WorkItem 体系 |
| C6-2 | 「消息流」 | 卷 22 §4.5 团队视图「消息流（按类型过滤）」 | C.1 的禁令针对**会话主线**不得改称消息流；团队黑板的**消息列表**是另一概念（Team Message Stream），合法 |
| C6-3 | Turn 的中文对应 | 全树正文写作「回合」（如 impl/03「回合边界提交」、impl/10「回合内候选标记」） | C.1 只定义英文原语；中文正式对应为：Thread = 会话主线、Turn = 回合、Item = 条目，三者可中英混排但须一一对应 |
| C6-4 | 「L0–L3」简写 | 卷 00 §5.21 矩阵与 REQ-SBOX-1、卷 30 边界图（B4）、`ALTERNATIVES.md` H-009 行 | **已收敛口径**：五档全称为 L0 / L0+ / L1 / L2 / L3（C.1 沙箱档行）；「L0–L3」为历史简写，仅在**连续区间**语义下可读，正式文档与决策文本须使用五档全称（卷 00 / 卷 30 / `ALTERNATIVES.md` 的简写已登记为 Phase A 修订建议 X-R03-1） |
| C6-5 | 异常类名 | `HarnessException`（内核）/ `BusinessException`（外壳）/ `AiException`（模型适配层，D33） | 分层口径以 `impl/README.md` §5.5 与 `impl/IMPL-DECISIONS.md` §1.3-6 为权威；三者名不同但同属一个异常体系，不构成「平行体系」违规 |
| C6-6 | 「沙箱」与「工作区」并用 | 卷 07 / 卷 20 的「强隔离（卷 07 档位）」映射表 | 沙箱是**边界**、工作区是**现场**（C.2）；「工作区的隔离档」是二者的合法组合表述，不视为混用 |
