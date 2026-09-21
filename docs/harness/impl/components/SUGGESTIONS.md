# 组件级修订建议登记册（`SUGGESTIONS.md`）

> 本册是 `docs/harness/impl/components/` 36 份组件文档（C01…C36）**本地修订建议的唯一汇总登记**，与 `README.md` §5 同源同表（分域重组）。
> 范围与状态：全部条目为 `X-Cxx-n` / `R-Cxx-n` / `Cxx-Gn` / 候补 `X-9x` 形态，**均未并入** `impl/IMPL-DECISIONS.md` §4——该台账表内止于 X-82（`grep -n 'X-82' impl/IMPL-DECISIONS.md` 命中汇总行与 X-82 行；标题计 81 条、表内计 82 条，并号起点以表内最大号 X-82 为准），且不含任何组件文件引用（`grep -n 'components/\|C0[0-9]' impl/IMPL-DECISIONS.md` 零命中）。
> 口径：文件登记共 **129** 条（逐文件登记块清点）；3 对同源/重复登记合并为单行后唯一 **126** 条：`X-C09-2 = X-C10-3`、`R-SM-1 = R-AL-2`、`X-C23-4 = X-C24-1`。
> 严重度判据：**阻塞** = 原文自标阻塞，或位于 B4/B6 迁移脚本冻结、启动门禁（Fail-Fast）、全局错误码映射之前必须裁决；**重要** = 契约/表/配置/事件/错误码/安全缺口；**一般** = 措辞、命名、指针、计数、图示、口径澄清。
> 处置约定：本册只登记、不改上游任何文件；**由编排方（主控）执行并入与重编号**，并入后回填各组件文件「待并号」为正式 `X-n`。

---

## 1. 并号提案（待编排方并入台账）

| 步骤 | 规则 |
| --- | --- |
| 号段起点 | 自 **X-83 起**顺序分配；`X-83…X-89` 已被 R07 预占（`reviews/R07-scope-build-kernel.md` 表内 7 条，待并入）、`X-90…X-96` 已被 C05/C06 候补自留（C05 R-1/R-2/R-3、C06 R-1…R-4）→ **本册其余条目首批实际可用起点为 X-97** |
| 排序 | 按 C01 → C36 文件序、文件内登记序；同源合并项只分配一个号，出处列保留双文件 |
| 冲突改判 | C03 `R-CA-1` 自注「建议登记为 X-83」与 R07 预占冲突，编排方须改判正式号（不得沿用自编号） |
| 回填 | 分配后：① 更新 `IMPL-DECISIONS.md` §4 表与汇总计数；② 回填各组件文件登记块 `X-Cxx-n → X-n`（保留原局部号作别名）；③ 更新 `README.md` §5 与 `components/README.md` |
| 阻断项优先 | 6 条阻塞项（见 §3）建议最先裁决，其中 X-C12-2 / X-C20-1（R07 已登记 X-89）/ X-C28-5 直接影响 B1/B2/B4 迁移脚本冻结排期 |

## 2. 分域登记表（按运行路径/组件域分组）

> 列 = 建议编号 ｜ 内容一句话 ｜ 出处 ｜ 严重度 ｜ 建议落点；组内按编号顺序。

### 2.1 会话主链路（C01–C15，47 条）

| 建议编号 | 内容一句话 | 出处 | 严重度 | 建议落点 |
| --- | --- | --- | --- | --- |
| R-SM-1 | 输入表口径统一为同一物理表（会话/Agent 两表语义重叠） | C01 | 重要 | impl/01 §8.1、impl/12 §8.1、impl/19 B1 批次 |
| R-SM-2 | 会话执行权 Redis Key 收敛为单一命名族并注明不承载正确性 | C01 | 一般 | impl/01 §8.2、impl/12 §8.2 |
| R-SM-3 | 会话保留三态（L-083）在 oc_session 语义补归属说明 | C01 | 重要 | oc_session 语义、卷 15/19 |
| R-AL-1 | InputAdmission 同名双域重命名（Session/Turn 前缀） | C02 | 重要 | impl/01 §5.1、impl/12 §1.5、附录 C |
| R-AL-3 | 会话执行体态与 Turn 等待态补跨域映射表 | C02 | 重要 | 卷 01 §4.6、卷 12 §7.1 |
| R-CA-1 | 预算缩放模式取值集声明（四模式或按 AgentMode 枚举） | C03 | 重要 | 卷 03 §4.1、harness-common |
| R-CA-2 | 来源注册表类名统一为 ContextSourceRegistry | C03 | 一般 | impl/03 §4/§1.4/§9.2 |
| R-CA-3 | userTunableSections 默认 S4/S5/S7/S8，空集拒绝启动 | C03 | 重要 | impl/03 §5.2 |
| R-CA-4 | 熔断紧预算系数 tightBudgetRatio=0.75 配置化（与 R-CMP-2 同源） | C03 | 重要 | impl/03 §10.3/§5.2 |
| R-CMP-1 | 双水位语义成文（升级=软水位 0.80；硬水位=目标线） | C04 | 重要 | impl/03 §6.2/§11.1 |
| R-CMP-2 | 压缩回灌预算与文件数配置化（50000 / 5） | C04 | 重要 | impl/03 §5.2/§9 |
| R-CMP-3 | 门面 compact 与内部 compactIfNeeded 命名分层 | C04 | 一般 | impl/03 §5.2/§6.1 |
| R-CMP-4 | 膨胀判定阈值 inflateTolerance 判据补齐 | C04 | 重要 | impl/03 §11.1 |
| R-1（候补 X-90） | PromptArtifact 支持多缓存断点 List<CacheBreakpoint> | C05 | 重要 | harness-contract、卷 03/02 |
| R-2（候补 X-91） | 指令源三态「上次已接受值」补存储与端口归属 | C05 | 重要 | platform-persistence、X-84 表族 |
| R-3（候补 X-92） | 补 prompt.boundary.drift 事件与 VariableSource 枚举 | C05 | 重要 | harness-contract、事件 Schema |
| R-1（候补 X-93） | 灰度会话钉臂 Redis Key 归属（oc:mdl:gray:*） | C06 | 重要 | impl/02 §8.2、RedisKeys |
| R-2（候补 X-94） | oc_route_rule.gray 补 eval_binding / degrade_threshold | C06 | 重要 | impl/02 §8.1、卷 26 |
| R-3（候补 X-95） | ModelTier 契约定义与下线映射表归属 | C06 | 重要 | harness-contract、impl/02 §9.5 |
| R-4（候补 X-96） | 路由评分/灰度配置键并入系统级清单与 .env.example | C06 | 重要 | impl/02 §9.5 |
| C07-G1 | ModelErrorCode 与契约 ErrorCode 逐值映射表 | C07 | 重要 | 卷 02 附录、附录 B.11 |
| C07-G2 | 补登 MODEL_PROTOCOL_ERROR 与取消语义 | C07 | 重要 | 附录 B.11 |
| C07-G3 | 「4 协议族 / 5 适配器实例」计数口径澄清 | C07 | 一般 | 卷 02 §1 |
| C08-G1 | 工具域内码与附录 B.11 四码映射表 | C08 | 重要 | 附录 B.11、impl/05 §10.1 |
| C08-G2 | ToolSourceSPI 补覆盖声明位与层优先级枚举 | C08 | 重要 | 卷 05 §9.2 |
| C08-G3 | oc_tool_registration 补 layer/superseded_by/revoked_at 列 | C08 | 重要 | impl/05 §8.1 |
| X-C09-1 | 失败计数口径改为 (toolName, argsDigest) 会话滑动窗口 | C09 | 重要 | impl/05 §2.1 |
| X-C09-2 | 取消「权限预检」双入口（预检不得产权限结论） | C09 | 重要 | 卷 05 §4.1、D-PERM-3 |
| X-C10-1 | expressionRef 强制声明具体度/次序键 | C10 | 重要 | impl/06 §3.7.4 |
| X-C10-2 | 批量传播重算竞态以 CAS+终态不可迁移线性化 | C10 | 重要 | impl/06 §3.7.8 |
| X-C11-1 | 补注端上呈现态不属于内核终态 | C11 | 一般 | impl/06 §7.1 |
| X-C11-2 | 悬空引用 §7.3 修正为 §7.1 | C11 | 一般 | impl/22 §7.2、impl/30 §6.1 |
| X-C11-3 | 增补 GET /api/v1/approvals 运维查询端点 | C11 | 一般 | impl/06 §9.1 |
| X-C11-4 | oc_approval 补索引 (tenant_id, session_id, state) | C11 | 一般 | impl/06 §8 |
| X-C11-5 | APPROVAL_ESCALATED 并入 impl/06 错误枚举 | C11 | 重要 | impl/06 错误码表 |
| X-C12-1 | ExecutionIsolationPort 补 cancel 显式语义 | C12 | 重要 | impl/07 §5 |
| X-C12-2 | oc_sandbox_* 六表批次归属裁决（影响排期） | C12 | 阻塞 | 卷 27 §4.4 |
| X-C12-3 | IsolationProvider/enforcement 命名统一与 P-19 桥接 | C12 | 一般 | impl/07 §5/§8.1、附录 D |
| X-C12-4 | 提权降级呈现复用 sandbox.degraded | C12 | 一般 | impl/07 §10.3/§5 |
| X-C12-5 | macOS Seatbelt 弃用回退路径入能力矩阵 | C12 | 重要 | impl/07 §4.2 |
| R-C13-1 | 组织 enforced 覆盖不可用时「不回落」语义补登 | C13 | 重要 | 卷 08 §4.1 |
| R-C13-2 | 技能建议缓存 TTL 配置回填系统级表与模板 | C13 | 一般 | impl/08 §9.5、.env.example |
| R-C14-1 | capability.refresh-debounce-ms 回填系统级配置表 | C14 | 一般 | impl/09 §9.3 |
| R-C14-2 | McpStartupOrchestrator 补入系统级类图 | C14 | 一般 | impl/09 §5/§1.4 |
| R-C14-3 | 卷 09 §4.2 补登 QUARANTINED 隔离态与人工重试 | C14 | 重要 | 卷 09 §4.2 |
| X-C15-1 | 撤销两级语义拆分（即时失效 + drain + 租约回收） | C15 | 重要 | impl/09 §9.1/§10.5 |
| X-C15-2 | 写类工具外部审批通道回落与无审批人拒绝 | C15 | 重要 | impl/09 §9.1 |

### 2.2 协作与自治（C18–C24，27 条）

| 建议编号 | 内容一句话 | 出处 | 严重度 | 建议落点 |
| --- | --- | --- | --- | --- |
| X-C18-1 | oc_subagent_link 增 brief_digest 与唯一索引（幂等派发） | C18 | 重要 | impl/12 §8.1 |
| X-C18-2 | 补 queued/budget_paused/merged 三条事件与指标标签 | C18 | 重要 | impl/12 §8.3、卷 12 §6 |
| X-C18-3 | 单 Agent 场景最小验证门 MergeVerificationGate | C18 | 重要 | 卷 12 §4.3 |
| R-C19-1 | 死锁误报回落开关 deadlock-mode 入 TeamProperties | C19 | 重要 | impl/13 §9.3、.env.example |
| R-C19-2 | 人工接管锁 Key 与 TTL 补登 Redis Key 表 | C19 | 重要 | impl/13 §8.2 |
| R-C19-3 | verifier 独立性判据三元组与拒绝错误码 | C19 | 重要 | 卷 13 REQ-TEAM-15 |
| X-C19-1 | 团队账本结算幂等约束随 B4 批次落地 | C19 | 重要 | impl/13 B4、uk(member_id, usage_ref) |
| X-C19-2 | 补 team.message.delivered/consumed/expired 事件 | C19 | 重要 | impl/13 §8.3 |
| R-C20-1 | 验收表补独立验证承载（verified_by/verdict_ref） | C20 | 重要 | impl/14 §8.1、B4 |
| R-C20-2 | 完成信号双口径权威规则（事件为权威） | C20 | 重要 | impl/14 §10.7 |
| R-C20-3 | 计划模式不新增实体 + 补进出两条事件 | C20 | 重要 | impl/14 §10.4/§8.1 |
| X-C20-1 | 工作对象表名统一定名（R07 已登记 X-89） | C20 | 阻塞 | 附录 A.6、卷 27 §4.4 |
| X-C20-2 | 补登 workitem.execution.lease.rejected 事件 | C20 | 重要 | impl/14 §8.3 |
| X-C21-1 | 触发到启动 500ms 拆四段预算 + stage 指标标签 | C21 | 重要 | 卷 15 §7、impl/15 §10.2 |
| X-C21-2 | noProgress 相关配置键统一分组 | C21 | 重要 | impl/15 §9.3 |
| X-C21-3 | 会话归属三态解析由归档判定单点消费 | C21 | 重要 | impl/15 §8.1、卷 19 |
| X-C22-1 | 投影表恢复优先级条款（不进关键备份） | C22 | 重要 | 卷 19 §7 |
| X-C22-2 | live 保活参数由端侧统一引用 event.stream.* | C22 | 重要 | impl/22/23/24 |
| X-C22-3 | 卷 16 §4 补「先订阅后重放」等两条不变量 | C22 | 重要 | 卷 16 §4 |
| X-C22-4 | 合规删除后哈希链断点校验规则 | C22 | 重要 | 卷 16/24、oc_event_purge_proof |
| X-C23-1 | ExitCodeAdapter 兼容层落点与配置键 | C23 | 重要 | impl/17 §5/§9 |
| X-C23-2 | 关机类钩子二次阻断上限与人工裁决通道 | C23 | 重要 | impl/17 §4.2、卷 34 |
| X-C23-3 | 回放事实源以事件流为权威的口径 | C23 | 一般 | impl/17 §6.4 |
| X-C23-4 | 目录生成器与 freshness 门禁合并（= C24 X-C24-1） | C23 | 重要 | impl/17 §1.4、impl/18 §3.1 |
| X-C24-2 | 插件 SDK 模块命名（tools/plugin-sdk）与代际兼容表 | C24 | 重要 | 卷 27 §4.1/§4.8.1 |
| X-C24-3 | 类加载双前缀收敛判据（M8 后拒载 v1 前缀） | C24 | 重要 | 卷 27 §4.8.1 |
| X-C24-4 | unclean 确认端点与注册计划事实源（oc_extension_registry） | C24 | 重要 | impl/18 §9.1/§6.4 |

### 2.3 数据与恢复（C16 / C17 / C25–C28，24 条）

| 建议编号 | 内容一句话 | 出处 | 严重度 | 建议落点 |
| --- | --- | --- | --- | --- |
| X-C16-1 | memory.drift.detected 增 cause 枚举字段 | C16 | 一般 | 卷 10 事件 Schema |
| X-C16-2 | 技能候选流向卷 08 的载荷契约补登记 | C16 | 重要 | 卷 08/10 交界 |
| X-C17-1 | 符号图归属单点化到 repomap/（删内核侧表述） | C17 | 重要 | impl/03 §3.4/§4、impl/11 §1.5 |
| X-C17-2 | repo map 预算与缓存 TTL 双轨统一（预算 1024） | C17 | 重要 | impl/11 §9.3/§8.2、impl/03 §9.3 |
| X-C17-3 | 知识删除贯通「旧代 + kb/raw」补可执行判据 | C17 | 重要 | 卷 11 §10.11、impl/19 §6.4 |
| R-RC-1 | 恢复事件命名族收敛为 system.* | C25 | 重要 | 卷 16 事件目录、impl/01 §3.5、impl/19 §8.4 |
| R-RC-2 | RecoveryCoordinator 同名类定名（BootDriver + Coordinator） | C25 | 重要 | impl/01 §3.5/§5、impl/19 §1.5 |
| R-RC-3 | 副作用账本状态取值冻结四值枚举 | C25 | 重要 | harness-contract、impl/12 §8.1 |
| R-RC-4 | 恢复扫描/重放/租约三参数配置化与模板同步 | C25 | 重要 | impl/19 §9.5、.env.example |
| R-RC-5 | 检查点形态收敛 + 三域 token 映射机械断言 | C25 | 重要 | impl/01 §8.1、impl/03 §6.4、ArchUnit |
| R-MIG-1 | 破坏性 DDL 锁预算与在线 DDL 白名单条款 | C26 | 重要 | 卷 19 §4.2、impl/19 §10 |
| R-MIG-2 | 段代级配置（retain/generations/hops）与模板 | C26 | 重要 | impl/19 §9.5、.env.example |
| R-MIG-3 | repair-* 解析单点实现（CI 复用同一实现） | C26 | 重要 | impl/19 §9.4、CI 门禁 |
| R-MIG-4 | 观察期时长与代际门禁合并登记 | C26 | 重要 | 卷 19 §4.2、impl/19 §9.5/§10.3 |
| X-C27-1 | 台账 §2.20 计数修正为 9（补 I-WS-9） | C27 | 一般 | IMPL-DECISIONS §2.20 |
| X-C27-2 | SSH 连接池容量口径与单实例上限公式统一 | C27 | 一般 | impl/20 §9.5/§10.2 |
| X-C27-3 | 主机密钥枚举 code 与配置取值不一致（启动误拒） | C27 | 阻塞 | impl/20 §10.6/§9.5 |
| X-C27-4 | 心跳阈值与退避参数配置化 | C27 | 重要 | impl/20 §9.5 |
| X-C27-5 | 待重放队列与恢复协调器回调契约闭合 | C27 | 重要 | impl/20 §10.3、卷 19 §10.3 |
| X-C28-1 | 台账 §2.21 计数修正为 10（补 I-GIT-10） | C28 | 一般 | IMPL-DECISIONS §2.21 |
| X-C28-2 | PREFLIGHT_NOT_CONFIGURED 补入错误矩阵与附录 B | C28 | 重要 | impl/21 §9.1、附录 B §B.7 |
| X-C28-3 | Git 错误码跨文件命名统一（防漏映射） | C28 | 阻塞 | 附录 B §B.7、impl/21 §9.1 |
| X-C28-4 | 合并状态机图补 BLOCKED_MANUAL 节点与边 | C28 | 一般 | impl/21 §7.2 |
| X-C28-5 | oc_git_* 批次归属与 preflight 审批落点（影响排期） | C28 | 阻塞 | 卷 27 §4.4、impl/21 §9.4 |

### 2.4 企业治理（C29–C34，22 条）

| 建议编号 | 内容一句话 | 出处 | 严重度 | 建议落点 |
| --- | --- | --- | --- | --- |
| X-C29-1 | 单条账本分录 P95 ≤ 10ms 预算与指标 | C29 | 一般 | impl/26 §10.2 |
| X-C29-2 | SETTLING 进入/退出条件与超时回收 | C29 | 重要 | impl/26 §7.2/§8.1 |
| X-C29-3 | 溢出账务口径 ADJUST(ESTIMATE_GAP) | C29 | 重要 | impl/26 §6.1 |
| X-C30-1 | 新增 oc_audit_segment 段表（封段状态载体） | C30 | 重要 | impl/25 §8.3、B3 |
| X-C30-2 | 写入降级阈值配置与队列深度指标 | C30 | 重要 | impl/25 §10.1/§10.7.1 |
| X-C30-3 | 补 ent.audit.archive.failed 失败事件 | C30 | 重要 | impl/25 §8.7 |
| X-C31-1 | acp.sessionRecoveryPolicy 配置键与恢复策略 | C31 | 重要 | impl/24 §6.2/§9.2 |
| X-C31-2 | 远程验证复核绑定 VerificationEngine 与提升判据 | C31 | 重要 | impl/24 REQ-A2A-20/§6.4 |
| X-C31-3 | 外部成员身份落点二选一 | C31 | 重要 | impl/24 §8.1、卷 13/14 |
| X-C32-1 | 完整性错误码 ECO_INTEGRITY_FAILED 与信任根配置键 | C32 | 重要 | 附录 B、impl/29 §9.4/§9.5 |
| X-C32-2 | 评分/离线包端点与 oc registry 六条子命令 | C32 | 重要 | impl/29 §9.1、impl/22 §7 |
| X-C32-3 | 包依赖声明列 dependencies jsonb 与锁文件口径 | C32 | 重要 | impl/29 §8.1 |
| X-C33-1 | 错误矩阵 7 码未声明与命名不一致 | C33 | 阻塞 | impl/28 §5.4/§9.6 |
| X-C33-2 | DowngradeTicket 契约类与验签接口 | C33 | 重要 | impl/28 §5、harness-contract |
| X-C33-3 | 更新状态机补两条边（下载失败保留 / 回滚转人工） | C33 | 重要 | impl/28 §7.1、卷 28 §6 |
| X-C33-4 | 端侧放量载体二选一冻结口径 | C33 | 重要 | 卷 28 §3/§4.2、卷 24 |
| X-C33-5 | LicenseGate.assertWritable 单点写门槛 | C33 | 重要 | harness-contract、impl/28 §6.5 |
| X-C34-1 | hygiene 补「重复率检查」第四件门禁 | C34 | 重要 | impl/33 REQ-QA-18/19 |
| X-C34-2 | harness-testkit 模块登记（卷 27 §4.1 与附录 D） | C34 | 重要 | 卷 27 §4.1 |
| X-C34-3 | RunIdentityCodec 编解码契约 | C34 | 重要 | harness-contract、impl/33 §11.1 |
| X-C34-4 | gate profile docs 级定义 | C34 | 一般 | I-QA-10、卷 27 §4.6 |
| X-C34-5 | 判官校准队列承载表与端点 | C34 | 重要 | impl/33 §8.1 |

### 2.5 产品能力（C35–C36，6 条）

| 建议编号 | 内容一句话 | 出处 | 严重度 | 建议落点 |
| --- | --- | --- | --- | --- |
| X-C35-1 | 三项 SPI 归属补齐或声明合并 | C35 | 重要 | 卷 34 §6、impl/31 §9.3 |
| X-C35-2 | 串行粒度统一为实例级 | C35 | 一般 | 卷 34 §8、impl/31 §6.2 |
| X-C35-3 | 取消后重跑语义（新 runId + forceRerun） | C35 | 重要 | 卷 34 §5.5 |
| X-C36-1 | GateOrder 常量类登记（顺序禁止配置化） | C36 | 重要 | impl/32 §5.1 |
| X-C36-2 | 内联时延 30s 定义为降级触发线 | C36 | 重要 | impl/32 §9 |
| X-C36-3 | 产出「编辑」双轨统一（状态迁移产生事件） | C36 | 重要 | impl/32、oc_ai_feedback.kind |

## 3. 统计与并号清单

| 维度 | 阻塞 | 重要 | 一般 | 合计 |
| --- | --- | --- | --- | --- |
| 会话主链路（C01–C15） | 1 | 33 | 13 | 47 |
| 协作与自治（C18–C24） | 1 | 25 | 1 | 27 |
| 数据与恢复（C16/C17/C25–C28） | 3 | 16 | 5 | 24 |
| 企业治理（C29–C34） | 1 | 19 | 2 | 22 |
| 产品能力（C35–C36） | 0 | 5 | 1 | 6 |
| **合计** | **6** | **98** | **22** | **126** |

- **6 条阻塞项（优先裁决）**：`X-C12-2`（沙箱六表批次）、`X-C20-1`（工作对象表名，R07 已登记 X-89）、`X-C27-3`（主机密钥枚举 vs 配置取值，启动 Fail-Fast 会误拒合法配置）、`X-C28-3`（Git 错误码两套命名，错误响应可能漏映射）、`X-C28-5`（oc_git_* 批次与审批落点，影响第 13 步验收）、`X-C33-1`（更新错误矩阵 7 码未声明且两名同义）。
- **去重记录（129 → 126）**：`X-C09-2 = X-C10-3`（权限预检双入口，C10 自注跨组件）、`R-SM-1 = R-AL-2`（输入表口径，两文件互相登记）、`X-C23-4 = X-C24-1`（目录生成器与 freshness 门禁，两文件合并登记）。
- **编排方动作清单**：① 按 §1 规则分配 X-97 起正式号（含 X-90…X-96 候补确认/改判）；② 更新 `impl/IMPL-DECISIONS.md` §4 表与计数（现 82 条 → 82 + 126 = 208 条，含 6 阻塞）；③ 回填 36 份组件文件登记块；④ 同步 `README.md` §5 与本册。

## 4. 复算命令（本册全部数字可复核）

```bash
# ① 本册数据行与严重度（自证）→ 数据行 126；阻塞 6 / 重要 98 / 一般 22
grep -cE '^\| .+ \| C[0-9]{2} \| (阻塞|重要|一般) \|' SUGGESTIONS.md
grep -E '^\| .+ \| C[0-9]{2} \| (阻塞|重要|一般) \|' SUGGESTIONS.md | grep -oE '(阻塞|重要|一般) \|' | sort | uniq -c
# ② 分组合计（自证）→ 47 / 27 / 24 / 22 / 6
awk '/^### 2\./{g=$0} /^\| (X-C|R-|C0)/{c[g]++} END{for(k in c) print c[k], k}' SUGGESTIONS.md
# ③ 上游登记核对：X-C 族 token 唯一 82（含跨文件重复登记 X-C10-3 / X-C24-1）；
#    R/G 族 token 唯一 39（R-SM/AL/CA/CMP/RC/MR/C13/C14/C19/C20 计 34 + C07/C08 的 G 计 5，其中 C08-G3 为同行并写）；
#    C05/C06 候补 R-n token 唯一 4（逐条登记 7）。token 三式 82+39+4 = 125，
#    与登记总数 129 差 4 = 同行并写 1（C08-G3）+ 跨文件同 token 3（C05/C06 的 R-1…R-3）
cat C*.md | grep -oE 'X-C[0-9]{2}-[0-9]+' | sort -u | wc -l
cat C*.md | grep -oE '(R-(SM|AL|CA|CMP|RC|MR)-[0-9]+|R-C1[3-4]-[0-9]+|R-C(19|20)-[0-9]+|C0[78]-G[0-9]+)' | sort -u | wc -l
cat C05*.md C06*.md | grep -oE 'R-[1-4]（候补' | sort -u | wc -l
# ④ 台账现状与 R07 预占核对
grep -n 'X-82' ../IMPL-DECISIONS.md | head -3                          # 表内止于 X-82
grep -n 'X-8[3-9]' ../../reviews/R07-scope-build-kernel.md | head -8   # R07 预占 X-83…X-89
```

> 说明：逐条登记数以各文件「修订建议」登记块的人工清点为准（36 处登记块，本册 §2 全量列示），token 级命令为上表的机械交叉核对；两者差额原因已在上文 ③ 注明。
