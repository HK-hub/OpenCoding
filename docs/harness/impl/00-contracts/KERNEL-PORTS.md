# 内核端口契约（KERNEL-PORTS）
> 定位：兑现 R10 可开工性走查阻塞项 **B9**（12 个内核端口无方法签名，见 R10 §六 A）与 **B8 的端口侧引用面**（`ModelRequest`、8 个 `StreamEvent` 子型、`AssistantMessagePayload` 无字段定义），使工程师能直接写出第一个可编译骨架。
> 权威来源：`impl/01` §9.3、`impl/02` §5.1、`impl/03` §5.1、`impl/05` §5、`impl/06` §5、`impl/07` §5、`impl/10` §5.1、`impl/12` §5.1、`impl/14` §5、`impl/16` §5.1、`impl/17` §5、`impl/19` §5、`impl/20` §5、`appendix-b` §B.5/§B.7/§B.9。本文件**只新增本文件**，命名收敛一律登记在 §6，不回改其它文件。
## §1 目的与范围
**覆盖范围**：内核（`harness-contract` + `harness-kernel/kernel-*`，零框架）的全部出站接缝（outbound port / SPI seam）。内核凡涉及「时间、随机、ID、存储、网络、文件、密钥」的动作必须经端口注入；内核内禁止出现 Spring、JDBC、Redis、HTTP 客户端、JSON 库与 `System.currentTimeMillis` / `UUID.randomUUID` 直调（`impl/01` §5 判定线、`impl/02` §1.3）。

| 组 | 覆盖对象 | 说明 |
| --- | --- | --- |
| 领域端口（§3.1–§3.12） | `ModelGateway` / `ContextPort` / `ToolPort` / `PermissionPort` / `SandboxPort` / `EventPort` / `PersistencePort` / `MemoryPort` / `KnowledgePort` / `WorkspacePort` / `HookPort` / `ClockPort`+`IdPort`+`RandomPort` | 内核业务主链路接缝，方法签名在本文件冻结 |
| 宿主与传输端口（§3.13） | `TransactionPort` / `StoragePort` / `EventStorePort` / `RuntimeStorePort` / `FrameChannel` / `ProtocolCodec` / `HostAdapterPort` / `SecretPort` / `CapabilityProbe` | `impl/01` §9.3「稳定」组，冻结方法形状 |
| 值对象目录（§4） | `ModelRequest` / `ModelResponse` / `StreamEvent`+8 子型 / `AssistantMessagePayload` 等 | 端口出入参，字段级冻结 |

> 本文件的 Java 片段即契约源码形态：类/接口 JavaDoc 说明职责与协作，方法 JavaDoc 含功能、`@param`（业务含义 + 取值约束）、`@return`（可空性/空集合语义）、`@throws`（业务异常场景），与 `.qoder/rules/comment-rules.md` 一致；实现 PR 直接落盘为 Java 文件即可编译。

**三条硬规则**：① 接口住 `harness-contract`（纯契约、零依赖，仅允许 `slf4j-api` 与 Lombok 编译期），适配器住 `harness-platform/platform-*`（v1 仓 `open-coding-domain` + `open-coding-infrastructure`）与 `harness-host/host-*`（v1 仓 `open-coding-application` + `open-coding-bootstrap`），内核禁止引用实现类（REQ-ARC-1、卷 27 §4.2 R1）。② 一个端口一个实现面，多后端由 `CapabilitySet` + `@ConditionalOnMissingBean` 选择（`impl/20` §4），能力缺失抛 `UNSUPPORTED_CAPABILITY`，禁止静默降级。③ 内核侧失败抛 `HarnessException(ErrorCode, 中文文案)`（域内异常为其子类），外壳侧抛 `BusinessException`，可重试只认 `ErrorCode.retryable`（`impl/01` §5.1）；`ErrorCode` 冻结位置属修订建议 **X-82**，本文件只引用不定义。
**返回风格统一（强制）**：单值查询返回 `Optional<T>`（禁止 null）；集合返回空集合；必查资源用 `requireXxx(...)` 抛 `NOT_FOUND`；写操作返回结果 record（仅幂等释放类允许 `void`）；分页统一 cursor（`appendix-b` §B.9 规则 3）。
## §2 端口总表
| 端口名 | 职责 | 实现方（Spring 外壳层） | 对应 impl 文件 | 插件可替换 |
| --- | --- | --- | --- | --- |
| `ModelGateway` | 四协议流式/非流式调用、能力校验、路由、装饰器链 | `platform-persistence`（用量）/ `platform-runtime-store`（限流、目录）/ `platform-enterprise`（凭证），装配 `host-bootstrap` | `impl/02` §5.1/§9.1 | 是（`ProtocolAdapterSPI`/`RouterRuleSPI`/`UsageSinkSPI`） |
| `ContextPort` | 九区段装配、四级压缩、用量反馈 | `platform-persistence`（快照与引用）/ `platform-runtime-store`（缓存亲和） | `impl/03` §5.1/§5.2 | 是（`SectionProvider`/`Compressor`） |
| `ToolPort` | 工具结算唯一入口、取消、可见工具集 | `platform-sandbox` + `platform-workspace` + `platform-persistence`（账本与产物） | `impl/05` §5 | 是（`ToolSourceSPI`/`ToolDecoratorSPI`） |
| `PermissionPort` | 动作四值决策、权限模式与上限查询 | `platform-enterprise`（策略存储）/ `platform-persistence`（决策记录） | `impl/06` §5/§9.2 | 是（`PolicyProvider`/`ApprovalChannel`） |
| `SandboxPort` | 档位选择、围栏会话、执行与终止 | `platform-sandbox` | `impl/07` §5 | 是（`IsolationProvider`/`NetworkPolicySPI`） |
| `EventPort` | 事件追加（写）、按序读、订阅扇出 | `platform-persistence`（分区表）/ `platform-runtime-store`（扇出、Webhook 队列） | `impl/16` §5.1/§9 | 是（`EventProducerSPI`/`RedactionRuleSPI`） |
| `PersistencePort` | 会话/准入/回合/条目/检查点仓储 | `platform-persistence` | `impl/01` §8.1、`impl/12` §8.1、`impl/19` §8 | 否（实现由装配选择） |
| `MemoryPort` | 记忆召回、写入、取代、合规删除 | `platform-memory` | `impl/10` §5.1 | 是（`MemoryStore`/`MemoryRanker`/`PiiDetector`） |
| `KnowledgePort` | 知识检索、索引与治理 | `platform-knowledge` | `impl/11` §5 | 是（`Connector`/`Chunker`/`Reranker`） |
| `WorkspacePort` | 文件读写（fs）与命令执行（exec） | `platform-workspace`（LocalFS/SSH/Container/Cloud） | `impl/20` §5、`impl/21` §1.4 | 是（`WorkspaceProviderSPI` 四后端） |
| `HookPort` | 钩子点执行、阻断与解释 | `platform-hooks`（调用器）/ `platform-runtime-store`（状态与预算） | `impl/17` §5 | 是（`HookImplSPI`/`HookMatcherSPI`） |
| `ClockPort` / `IdPort` / `RandomPort` | 可测性：时间、ID、随机 | `platform-runtime-store`（系统实现）+ `harness-testkit`（固定实现） | `impl/01` §9.3、`impl/15` §1.4 | 否（替换仅限测试装配） |
| `TransactionPort` / `StoragePort` / `EventStorePort` / `RuntimeStorePort` | 事务边界（内核无注解事务）、领域读写、事件持久化、热态锁与租约 | `host-bootstrap`（事务适配器）/ `platform-persistence` / `platform-runtime-store` | `impl/01` §5.1/§9.3、`impl/19` §5 | 否（`local-lite` 降级由装配选择） |
| `FrameChannel` / `ProtocolCodec` / `HostAdapterPort` | 本地 IPC、帧编解码、宿主形态差异 | `host-protocol` / `host-cli` / `host-server` | `impl/01` §5/§9.3 | 是（`SurfaceRenderer`） |
| `SecretPort` / `CapabilityProbe` | 短期凭证租约、启动期能力探测 | `platform-enterprise` / `host-bootstrap` | `impl/01` §9.3、`impl/02` §1.3 | 是（`SecretResolverSPI`） |
## §3 端口契约逐条
> 全部为 Java 21 形态；`HarnessException` 一律携带 `ErrorCode` 与中文文案；`@throws` 只列业务可判定场景，其余按 `INTERNAL_ERROR` 兜底（`appendix-b` §B.7）。
### §3.1 ModelGateway（kernel-model）
```java
package com.hk.opencoding.kernel.model;

/**
 * 模型网关：内核唯一的模型创作入口（能力校验 → 路由 → 八层装饰器 → 协议适配 → 计量）。
 * 流式是唯一创作入口，非流式由流式聚合实现以保证行为一致；厂商 SDK 异常必须在本层翻译为 {@code AiException}（D33），不得外溢。
 * 内核不持有 provider 配置与密钥，只持有 ModelCatalogView 与 SecretRef。
 */
public interface ModelGateway {
    /** 发起流式调用（拉取式游标，取消即关闭底层连接）。@param request 请求（必填：选择器/消息/工具/采样/预算/归属） @param context 上下文（必填：凭证引用/租户/幂等键/缓存断点） @return 流游标（单消费者、阻塞语义） @throws AiException 能力不支持、限流、凭证无效、端点不可用 */
    StreamCursor stream(ModelRequest request, ModelCallContext context);
    /** 非流式聚合调用。@param request 请求（必填，语义同 stream） @param context 上下文（必填） @return 聚合响应（消息、用量、结束原因、实际模型） @throws AiException 语义同 stream */
    ModelResponse generate(ModelRequest request, ModelCallContext context);
    /** 嵌入/重排调用（供知识域）。@param request 嵌入请求（必填：批次/维度/用途标签） @param context 上下文（必填） @return 嵌入响应（向量批次与用量） @throws AiException 模型不支持嵌入或批次超限 */
    EmbedResponse embed(EmbedRequest request, ModelCallContext context);
    /** 查询模型描述符（纯读内存目录视图，不触发 IO 探测）。@param modelId 模型标识（必填） @return 描述符；不存在时返回 Optional.empty() */
    Optional<ModelDescriptor> describe(String modelId);
}
```

```java
package com.hk.opencoding.kernel.model.stream;

/**
 * 三段流式增量封闭集（8 种，D-MDL-3）：seq 会话内单调递增且不入库（REQ-INT-4）。
 * 线级名（message_start / content_delta / …）只出现在协议帧 type 字段，由 ProtocolCodec 投射，不作 Java 类型名（§6 D-PORT-12）。
 */
public sealed interface StreamEvent
        permits TextDelta, ThinkingDelta, ToolCallStarted, ToolCallDelta,
                ToolCallFinished, UsageReported, StreamCompleted, StreamFailed {
    /** @return 会话内单调递增的增量序号（前端排序与丢帧检测的唯一依据） */
    long seq();
}
```

8 个子型 record 定义与字段表见 **§4.3**；`StreamCursor` 见 `impl/02` §5.1（`next()` 阻塞拉取、`usageSoFar()` 部分用量、`close()` 幂等释放）。
### §3.2 ContextPort（kernel-context）
```java
package com.hk.opencoding.kernel.context;

/** 上下文端口：向内核暴露「装配快照 / 触发压缩 / 回传实测用量」，隐藏九区段与四级压缩实现。 */
public interface ContextPort {
    /** 装配一次上下文快照（不触发压缩）。@param request 装配请求（必填：会话/模式/任务/预算覆盖） @return 快照（预算、区段、断点、提示词版本） @throws HarnessException 同会话并发装配（CONFLICT）或指令合并冲突（INVALID_ARGUMENT） */
    ContextSnapshot assemble(ContextAssembleRequest request);
    /** 触发压缩至水位以下。@param snapshot 待压缩快照（必填） @param trigger 触发原因（必填：水位/溢出恢复/用户手动/关键节点预览） @return 压缩记录（结果状态、前后 token、压缩地图引用） */
    CompactionRecord compact(ContextSnapshot snapshot, CompactionTrigger trigger);
    /** 回传实测用量用于校准 token 估算（校准失败只告警，不阻断，M19 同类）。@param feedback 反馈（必填：快照 ID/估算值/实测值/校准系数） */
    void feedback(ContextFeedback feedback);
}
```
### §3.3 ToolPort（kernel-tool）
工具管线多数失败以结构化结果回喂（`success=false` + `ToolErrorCode`），仅契约违约与不可继续的内部错误抛异常（`impl/05` §5 异常段）。

```java
package com.hk.opencoding.kernel.tool;

/** 工具端口：所有副作用的唯一汇聚点（校验 → 钩子 → 权限 → 沙箱/工作区 → 执行 → 结果处理 → 账本）。 */
public interface ToolPort {
    /** 结算一次工具调用（阻塞至结果定型；执行超时由被调方以结构化失败返回，不上抛）。@param call 调用（必填：callId/toolName/argumentsJson/parallelIndex/resourceClaim） @param context 上下文（必填：会话/工作区/取消作用域/预算/权限模式） @return 结构化结果（失败与取消均以 success=false 返回） @throws HarnessException 仅契约违约（注册期 schema 非法、阶段顺序被破坏）或不可继续的内部错误 */
    ToolResult invoke(ToolInvocation call, ToolInvocationContext context);
    /** 请求取消在途调用（安全点语义，幂等，未命中不视为错误）。@param callId 调用标识（必填） @param reason 取消原因（必填：用户中断/预算耗尽/会话关停） */
    void cancel(String callId, CancelReason reason);
    /** 列出当前会话可见工具定义（按模式与权限档裁剪）。@param visibility 可见性视图（必填：会话/模式/epoch） @return 声明列表；无可见工具时返回空列表 */
    List<ToolDeclaration> visibleTools(ToolVisibility visibility);
}
```

`ToolInvocation`/`ToolResult` 见 §4.5；`ToolSettlement`（含 `status`/`elapsedMillis`/`externalized`）为运行时聚合，不进端口签名（§6 D-PORT-8）。
### §3.4 PermissionPort（kernel-permission）
```java
package com.hk.opencoding.kernel.permission;

/**
 * 权限端口：所有副作用发起方必须经此决策（D-PERM-3）。
 * 本端口不抛业务异常：失败以 DENY + PermErrorCode 返回（fail-closed，REQ-PERM-19），由调用方回喂模型。
 */
public interface PermissionPort {
    /** 评估一个动作。@param descriptor 动作描述（必填：actionId/toolName/kind/targets/actor；命令类须带 commandText） @param context 权限上下文（必填：模式/角色/租户/时段/非交互标记/会话） @return 决策（ALLOW/ALLOW_ONCE/ASK/DENY + 风险类 + 命中规则引用 + 可授予范围 + 求值轨迹） */
    PermissionDecision assess(ActionDescriptor descriptor, PermissionContext context);
    /** 查询会话当前权限模式。@param sessionId 会话标识（必填） @return 模式；会话不存在时返回 Optional.empty() */
    Optional<PermissionMode> modeOf(SessionId sessionId);
    /** 查询 Agent 定义/团队/模板的权限上限（子 Agent 与预授权收窄用）。@param definition 定义引用（必填） @return 上限描述（不可为 null；无声明时返回系统默认上限） */
    PermissionCeiling ceilingOf(AgentDefinitionRef definition);
}
```

决策输入输出：入参 `ActionDescriptor` + `PermissionContext`（`impl/06` §5），出参 `PermissionDecision`（含 `ApprovalOutcome` 分支：批准/拒绝/终止/超时/不可用，`impl/06` §6.2）；`ASK` 分支必须携带可授予范围与预览引用，且审批请求**不携带完整敏感参数**（REQ-PERM-30）。
### §3.5 SandboxPort（platform-sandbox）
```java
package com.hk.opencoding.kernel.sandbox;

/**
 * 沙箱端口：工具运行时唯一允许的执行入口，禁止工具层直接调用 ProcessBuilder。
 * 四段式：select（选档出计划）→ prepare（建围栏会话）→ execute（受控执行）→ terminate（回收）。
 * 实际生效围栏参数必须回报（full/partial/none），缺失即判 partial 并告警（REQ-SBOX-14）。
 */
public interface SandboxPort {
    /** 依据风险类、平台能力与策略上下限选择档位并生成计划。@param request 执行请求（必填：toolCallId/riskClass/命令/minTier/maxTier） @return 决策（Permitted 携带计划；Denied 携带 SandboxErrorCode 与 remediation） */
    SandboxPlanDecision select(SandboxPlanRequest request);
    /** 准备围栏会话（创建探针 + 档位不变式校验；失败按策略降级或拒绝）。@param plan 已选计划（必填） @return 隔离会话句柄（档位、围栏参数、录制器引用） @throws HarnessException 档位不可用（SANDBOX_UNAVAILABLE）或围栏拒绝（SANDBOX_DENIED） */
    IsolationSession prepare(SandboxPlan plan);
    /** 在会话内执行命令并返回流式结果。@param session 隔离会话（必填，来自 prepare） @param command 待执行命令（必填：cwd/env 白名单/超时归属） @return 执行流（stdout/stderr 增量 + 退出码 + ExecutionRecord 摘要） @throws HarnessException 围栏违规（SANDBOX_VIOLATION）或资源超限（RESOURCE_EXHAUSTED） */
    ExecutionStream execute(IsolationSession session, ExecutionRequest command);
    /** 强制终止计划关联的全部活动（幂等；会话关停与预算耗尽路径）。@param planId 计划标识（必填） @param reason 终止原因（必填） */
    void terminate(String planId, CancelReason reason);
}
```
### §3.6 EventPort（append / read / subscribe）
追加即提交点：返回成功前事务已含「seq 分配 + 投影 + 位点 + 事件插入」（`impl/16` §10）。

```java
package com.hk.opencoding.kernel.event;

/**
 * 事件端口：事实源的唯一写入口 + 按序读 + 订阅扇出（三面同一实现）。
 * 幂等语义：同一 producerKey 的重复追加返回既有 AppendResult，不产生第二条事件。
 */
public interface EventPort {
    /** 追加一批事件（同一分区、seq 连续）。@param request 追加请求（必填：信封草稿、敏感字段标记、producerKey） @return 结果（eventId、seq、提交位点；幂等命中返回既有结果） @throws HarnessException Schema 不兼容或必填缺失（不可重试） @throws DependencyUnavailableException 存储不可用（retryable，须用同一 producerKey 重试） */
    AppendResult append(AppendRequest request);
    /** 按 seq 区间与过滤条件读取已提交事件（续传/投影重建/导出共用）。@param query 查询条件（必填：分区键、区间、类别与类型过滤、租户） @param from 游标（必填：起始 seq，含否由 query 指定） @return 事件分页（含 nextCursor；窗口外由调用方转快照重建） */
    EventPage read(EventQuery query, EventCursor from);
    /** 订阅实时事件（先注册后重放，避免订阅间隙丢事件）。@param filter 过滤（必填：分区范围、类型集合、类别） @param consumer 消费者（必填；实现必须幂等，跨实例幂等落 oc_consumer_idempotency） @return 订阅句柄（close() 幂等取消） */
    EventSubscription subscribe(EventFilter filter, EventConsumer consumer);
}
```
### §3.7 PersistencePort（会话 / 准入 / 回合 / 条目 / 检查点仓储）
仓储只暴露领域操作、不暴露 SQL（`impl/01` §9.3）；每个方法必带 `TenantContext`（同 §10.6 铁律 1）；更新一律条件更新 + 行数校验。

```java
package com.hk.opencoding.kernel.persistence;

/** 持久化端口：按聚合暴露五类仓储；事务由 TransactionPort 提供（内核无注解事务）。 */
public interface PersistencePort {
    /** @return 会话仓储（主记录与执行权条件更新） */
    SessionRepository sessions();
    /** @return 准入仓储（durable 准入队列，两阶段：准入 → 提升） */
    AdmissionRepository admissions();
    /** @return 回合仓储（Turn 阶段与用量快照） */
    TurnRepository turns();
    /** @return 条目仓储（模型可见历史的唯一事实载体） */
    ItemRepository items();
    /** @return 检查点仓储（恢复加速与回退锚点，不提供正确性） */
    CheckpointRepository checkpoints();

    /** 会话仓储：执行权抢占走条件更新 + 行数校验（!= 1 按并发抢占处理，转排队而非报错）。 */
    interface SessionRepository {
        /** 插入会话主记录。@param session 会话记录（必填：租户/归属/工作区/模型/权限模式） @param tenant 租户上下文（必填） @throws HarnessException 幂等键冲突（CONFLICT）或租户缺失（INVALID_ARGUMENT） */
        void insert(SessionRecord session, TenantContext tenant);
        /** 按标识读取会话。@param sessionId 会话标识（必填） @param tenant 租户上下文（必填） @return 会话记录；不存在返回 Optional.empty() */
        Optional<SessionRecord> find(SessionId sessionId, TenantContext tenant);
        /** 执行权抢占（仅当状态属于 expectedStates 且 epoch 未被推进时成功）。@param cas 条件更新（必填：会话/期望 epoch/新 epoch/许可状态集） @param tenant 租户上下文（必填） @return 更新行数（0 或 1；0 表示被并发抢占） */
        int updateRunnerEpoch(RunnerEpochCas cas, TenantContext tenant);
        /** 推进会话事件位点投影（last_event_seq 单调不回退）。@param sessionId 会话标识（必填） @param lastSeq 新位点（必须大于当前值） @param tenant 租户上下文（必填） @throws HarnessException 位点回退（CONFLICT） */
        void advanceEventSeq(SessionId sessionId, long lastSeq, TenantContext tenant);
    }

    /** 准入仓储：幂等键 (sessionId, inputId) 唯一；状态 ∈ ADMITTED/PROMOTED/DROPPED。 */
    interface AdmissionRepository {
        /** 持久准入一条输入（落库 + 分配 admittedSeq）。@param input 输入记录（必填：会话/inputId/载荷/投递语义/策略） @param tenant 租户上下文（必填） @return 准入结果（Admitted 或 Queued；幂等命中返回首次结果） @throws HarnessException 队列满（RATE_LIMITED）或幂等键与载荷不一致（CONFLICT） */
        AdmissionOutcome admit(SessionInputRecord input, TenantContext tenant);
        /** 提升下一条输入进入模型可见历史（幂等状态迁移）。@param sessionId 会话标识（必填） @param tenant 租户上下文（必填） @return 被提升输入；队列为空返回 Optional.empty() */
        Optional<SessionInputRecord> promoteNext(SessionId sessionId, TenantContext tenant);
        /** 标记输入被丢弃（interrupt 策略或超时）。@param sessionId 会话标识（必填） @param inputId 输入标识（必填） @param reason 丢弃原因（必填，进事件载荷） @param tenant 租户上下文（必填） @return 更新行数（0 表示已被并发处理，不视为错误） */
        int drop(SessionId sessionId, String inputId, String reason, TenantContext tenant);
    }

    /** 回合仓储：phase 列存 TurnPhase 的 code。 */
    interface TurnRepository {
        /** 写入回合起始记录。@param turn 回合记录（必填） @param tenant 租户上下文（必填） */
        void start(TurnRecord turn, TenantContext tenant);
        /** 更新回合阶段与结局（条件更新 + 行数校验）。@param turn 回合记录（必填） @param tenant 租户上下文（必填） @return 更新行数（必须为 1，否则抛 CONFLICT） */
        int finish(TurnRecord turn, TenantContext tenant);
    }

    /** 条目仓储：唯一事实载体，「模型可见 ⟺ 已记录」由本仓储保证。 */
    interface ItemRepository {
        /** 追加条目（seq 会话内严格递增且无空洞）。@param item 条目（必填：会话/seq/类型/载荷/敏感度） @param tenant 租户上下文（必填） @return 已提交条目（含最终 seq 与外置引用） @throws HarnessException seq 冲突（CONFLICT） */
        ItemRecord append(ItemRecord item, TenantContext tenant);
        /** 按 seq 区间读取条目（恢复与快照重建路径）。@param sessionId 会话标识（必填） @param fromSeq 起始 seq（含） @param limit 批大小（必填，来自配置分页上限） @param tenant 租户上下文（必填） @return 条目列表；无数据返回空列表 */
        List<ItemRecord> range(SessionId sessionId, long fromSeq, int limit, TenantContext tenant);
    }

    /** 检查点仓储：唯一物理表以 impl/19 §8 为 DDL 权威；业务幂等键 (sessionId, seq)。 */
    interface CheckpointRepository {
        /** 写入检查点（幂等：同 (sessionId, seq) 重复写入返回既有标识）。@param checkpoint 检查点（必填：会话/seq/计划快照/工作区引用/账本快照） @param tenant 租户上下文（必填） @return 检查点标识 */
        String write(CheckpointRecord checkpoint, TenantContext tenant);
        /** 读取最近检查点。@param sessionId 会话标识（必填） @param tenant 租户上下文（必填） @return 最近检查点；从未写入返回 Optional.empty() */
        Optional<CheckpointRecord> latest(SessionId sessionId, TenantContext tenant);
    }
}
```
### §3.8 MemoryPort（platform-memory）
```java
package com.hk.opencoding.kernel.memory;

/**
 * 记忆端口：召回 + 写入 + 替换 + 合规删除。所有实现强制携带租户上下文，禁止跨租户读写。
 * 分层：工作层与会话层仅内存/会话存储；项目层与组织层以文件为源、DB 为索引（impl/10 §5.1）。
 */
public interface MemoryPort {
    /** 混合召回（关键词 + 语义 + 图，RRF 融合后按预算裁剪）。@param query 召回查询（必填：层级范围/查询文本/项目引用） @param budget 召回预算（必填：条数上限/token 上限，来自配置） @return 命中列表（含来源与置信度）；无命中返回空列表 */
    List<MemoryHit> recall(MemoryQuery query, RecallBudget budget);
    /** 写入一条已通过审核的记忆（重复写入返回既有编号）。@param entry 记忆条目（必填：租户/层级/key-value/来源/置信度） @return 记忆编号 @throws MemoryException 层级与存储不匹配或 PII 未通过复检 */
    String remember(MemoryEntry entry);
    /** 替换既有条目（保留版本链，不物理覆盖）。@param memoryId 被取代编号（必填） @param next 新版本条目（必填，key 必须一致） @return 新版本编号 @throws MemoryException 条目不存在、已被合规删除或 key 不一致 */
    String supersede(String memoryId, MemoryEntry next);
    /** 发起合规删除（级联 + tombstone + 删除证明，异步完成）。@param memoryId 记忆编号（必填） @param reason 删除原因（必填，进审计） @throws MemoryException 删除链路不完整（MEMORY_DELETE_INCOMPLETE） */
    void forget(String memoryId, ForgetReason reason);
}
```
### §3.9 KnowledgePort（platform-knowledge）
```java
package com.hk.opencoding.kernel.knowledge;

/** 知识端口：三路检索（向量/关键词/图）与索引治理；凭据只以 credentialRef 传递（INV-9）。 */
public interface KnowledgePort {
    /** 检索知识库（结果必须携带引用与原文锚点，供溯源与再读鉴权）。@param query 检索条件（必填：项目/查询文本/源过滤/TopK） @return 命中集合（引用、分数、来源）；无命中返回空集合 @throws HarnessException 索引不可用时按策略降级为精确扫描并留痕 */
    KnowledgeHits query(KnowledgeQuery query);
    /** 触发索引增量（幂等：同一 source + revision 重复触发返回既有任务）。@param request 索引请求（必填：源引用/revision/范围；凭据为 credentialRef） @return 索引回执（任务标识与预估文档数） @throws HarnessException 源不可达（DEPENDENCY_UNAVAILABLE）或凭据缺失（INVALID_ARGUMENT） */
    IndexReceipt index(KnowledgeIndexRequest request);
}
```
### §3.10 WorkspacePort（exec / fs 语义）
内核只依赖本端口；四后端共享同一接口，差异经 `CapabilitySet` 声明，能力缺失显式拒绝（`impl/20` §4）。**执行链顺序固定**：权限决策 → 沙箱档位 → 能力校验 → 分派执行 → 审计事件，任一步拒绝即终态（`impl/20` §10.3）。

```java
package com.hk.opencoding.kernel.workspace;

/** 工作区端口：文件面 + 命令面；路径一律用类型化 PathUri，禁止裸字符串跨工作区隐式解析。 */
public interface WorkspacePort {
    /** @return 文件操作子面（读写/列目录/变更监听） */
    FileOps files();
    /** @return 命令执行子面（一次性/PTY/后台任务） */
    CommandOps commands();

    /** 文件面：写入必须原子（临时文件 + 原子替换 + 校验和）。 */
    interface FileOps {
        /** 读取文件片段（分页流式，不整份载入内存）。@param path 类型化路径（必填，工作区根内相对路径） @param range 字节区间（必填：offset + length，受配置上限约束） @return 片段（内容 + 校验和 + 是否截断） @throws HarnessException 路径越界（WORKSPACE_PATH_DENIED）或工作区不可用 */
        FileChunk read(PathUri path, ByteRange range);
        /** 原子写入（读改写语义由调用方声明写前摘要）。@param path 目标路径（必填） @param content 内容流（必填；外置阈值由配置给出） @param expectedDigest 写前摘要（可空；非空时实现必须比对，不符抛 CONFLICT） @return 写入回执（新摘要、字节数、工作区版本） */
        WriteReceipt writeAtomic(PathUri path, ContentStream content, String expectedDigest);
        /** 列目录（cursor 分页）。@param path 目录路径（必填） @param options 选项（必填：忽略规则/深度/页大小） @return 分页结果（含 nextCursor；空目录返回空页） */
        ListingPage list(PathUri path, ListOptions options);
        /** 变更监听或轮询（按后端能力择一；轮询间隔来自配置）。@param path 监听路径（必填） @param horizon 监听时间窗（必填） @return 变更流（关闭即停止；不支持监听时降级为轮询并留痕） */
        ChangeStream watchOrPoll(PathUri path, Duration horizon);
    }

    /** 命令面：一次执行阻塞至终态；环境变量按白名单继承，敏感名默认排除（impl/05 §9.3）。 */
    interface CommandOps {
        /** 一次性命令执行。@param request 命令请求（必填：命令/cwd/env 白名单/超时归属/捕获上限） @return 结果（退出码、stdout/stderr 捕获或外置引用、耗时） @throws HarnessException 工作区不可达或沙箱拒绝；命令自身失败以退出码表达 */
        CommandResult runOnce(CommandRequest request);
        /** 打开 PTY（交互式终端；不支持时抛 UNSUPPORTED_CAPABILITY，禁止降级为伪终端）。@param request PTY 请求（必填：命令/cwd/终端尺寸） @return PTY 句柄（写 stdin / 改尺寸 / 发信号 / 关闭） @throws HarnessException 能力缺失（UNSUPPORTED_CAPABILITY） */
        PtyHandle openPty(PtyRequest request);
        /** 派生后台任务（长命令；句柄可轮询日志与终止）。@param request 命令请求（必填，同 runOnce） @return 后台句柄（taskId + 日志游标 + 终止） @throws HarnessException 后台并发超限（RESOURCE_EXHAUSTED） */
        BackgroundTaskHandle spawnBackground(CommandRequest request);
    }
}
```
### §3.11 HookPort（platform-hooks）
钩子点顺序契约不可破坏：改写先于权限、观察在权限后；沙箱执行由执行器负责，钩子不在隔离器内执行（`impl/17` §4/§5）。

```java
package com.hk.opencoding.kernel.hook;

/** 钩子端口：在四个内核钩子点执行组织/项目/用户/会话四层钩子，并支持「为什么不命中」的解释。 */
public interface HookPort {
    /** 在指定钩子点执行全部适用钩子（顺序执行、累计预算、熔断跳过并记账）。@param point 钩子点（必填，须已在目录注册） @param context 上下文快照（必填；敏感字段按 sensitivity 掩蔽） @return 聚合结果（Observed/Blocked/Rewritten/HookFailed 封闭集；无适用钩子返回 Observed.empty()） @throws HookException 目录版本不匹配、绑定数据损坏或顺序断言失败（Fail-Fast） */
    HookOutcome invoke(HookPoint point, HookContext context);
    /** 解释匹配求值轨迹（与 permission.explain 共用呈现组件）。@param point 钩子点（必填） @param context 上下文快照（必填） @return 解释（候选钩子、命中/短路/预算/熔断原因、最终处置） */
    HookExplanation explain(HookPoint point, HookContext context);
}
```
### §3.12 ClockPort / IdPort / RandomPort（可测性端口）+ 遥测例外
```java
package com.hk.opencoding.kernel.time;

/**
 * 可测性端口组：时间、ID、随机三大不确定源必须注入，禁止内核直调系统 API。
 * 测试装配以 harness-testkit 固定实现替换（固定时钟 + 确定性 ID 序列 + 固定种子）。
 */
public interface ClockPort {
    /** @return 当前时刻（UTC） */
    Instant now();
    /** @return 当前毫秒时间戳（租约与超时计算） */
    long epochMillis();
}

public interface IdPort {
    /** 生成下一个标识。@param kind 标识类型（必填：会话/回合/条目/事件/检查点/派生任务） @return 不透明字符串标识（ULID/UUIDv7 语义：时间有序且不可猜测） */
    String nextId(IdKind kind);
}

public interface RandomPort {
    /** 生成指定区间随机数（灰度分桶与抖动退避的唯一随机源）。@param origin 下界（含） @param bound 上界（不含，必须大于 origin） @return 随机值 */
    int nextInt(int origin, int bound);
}
```

**命名裁决**：冻结名为 `IdPort`（卷 01 §5、`impl/18` §4.2），`IdGeneratorPort` 为其别名（§6 D-PORT-10）。**遥测/计量例外（M19，显式豁免）**：`UsageRecorder`、`ModelCallObserver`、遥测上报与审计快照写入失败为**有意吞异常 + WARN + 指标计数**，端口层不要求上抛、不参与主事务（`impl/02` §8.1、`impl/26` §10.5、`impl/32` §10.5）；该豁免**不得**扩散到业务写路径。
### §3.13 宿主与传输端口组（B9 第二组）
```java
package com.hk.opencoding.kernel.host;

/** 事务边界端口：外壳实现必须标注 @Transactional(rollbackFor = Exception.class)，异常必须导致回滚。 */
public interface TransactionPort {
    /** 在事务内执行并返回结果。@param work 事务体（必填；抛出的任何异常都必须导致回滚，禁止用 try-catch 吞掉） @return 事务体返回值 @throws HarnessException 事务体上抛的业务异常（原样透传） */
    <T> T required(Supplier<T> work);
}

/** 本地 IPC 通道（stdio / 回环 WS / SSE）；stdout 只允许协议帧，日志走 stderr。 */
public interface FrameChannel extends AutoCloseable {
    /** 打开通道（幂等；失败抛 HarnessException 并附传输名）。 */
    void open();
    /** 发送一帧。@param frame 帧（必填；超过 frame-max-bytes 时拒绝） */
    void send(Frame frame);
    /** 阻塞接收一帧。@return 帧 @throws HarnessException 通道已关闭 */
    Frame receive();
    /** 关闭通道（幂等）。 */
    @Override
    void close();
}
```

| 端口 | 冻结方法（其余语义见对应 impl 文件） | 关键约束 |
| --- | --- | --- |
| `ProtocolCodec` | `Frame decode(byte[] raw)`；`byte[] encode(Frame frame)` | 契约单源；内核禁止自带 JSON 库（卷 27 R1，JSON 编解码经本端口注入）；帧缺 `requestId`/`sessionId`/`traceId` 即拒 |
| `HostAdapterPort` | `HostProfile profile()`；`void onShutdown(ShutdownRequest request)` | embedded/sidecar/remote 三档共用同一内核 API，仅装配不同；关停进 `DRAINING`（完成当前工具、写检查点、拒绝新准入） |
| `SecretPort` | `SecretLease lease(SecretRef ref, Duration ttl)` | 只交出短期明文句柄，请求结束即失效；内核永不持有明文；`ref` 为引用名非明文 |
| `CapabilityProbe` | `ProbeReport probe(BootContext context)` | 启动期探测；必需能力缺失 Fail-Fast（退出码 78），可选能力缺失降级留痕并生成 `system.capability.degraded` |

`StoragePort`（领域读写）、`EventStorePort`（追加/按 seq 读/保留窗口/投影位点）、`RuntimeStorePort`（热态/锁/租约/计数器）为同组存储三件套，方法形态与 §3.6/§3.7 一致，本文件不重复冻结（见 §6 回改清单第 1 条）。
## §4 值对象目录
> 全部为 `record`（不可变）；业务标识用不透明字符串（防遍历）；时间一律 `Instant`（UTC）；集合默认空集合；`sensitivity` 决定加密与可见性。
### §4.1 ModelRequest（`kernel.model`）
```java
/** 模型调用请求。@param requestId 请求标识（唯一；重试复用同一值） @param selector 模型选择器（显式模型或档位 Auto/Ultimate/Performance/Efficient） @param messages 消息序列（非空；已过脱敏；首段为稳定前缀与缓存断点） @param tools 工具声明（可为空列表） @param sampling 采样参数（取值来自配置，禁止硬编码） @param providerOptions 厂商逃生门（不得含内核可理解字段，D-MDL-11） @param budget 预算信封（见 §4.8） @param caller 归属元数据（租户/项目/会话/任务/请求集/来源会话，REQ-MDL-18） @param idempotencyKey 幂等键（整条重试序列恒定） */
public record ModelRequest(String requestId, ModelSelector selector, List<CanonicalMessage> messages,
                           List<ToolDeclaration> tools, Sampling sampling, ProviderOptions providerOptions,
                           BudgetEnvelope budget, CallerMetadata caller, String idempotencyKey) {
}
```

| 字段 | 类型 | 可空 | 约束 | 来源 |
| --- | --- | --- | --- | --- |
| `requestId` | `String` | 否 | 唯一；重试复用 | `impl/02` §5/§6.1 |
| `selector` | `ModelSelector` | 否 | 显式模型或档位 | `impl/02` §9.5 |
| `messages` | `List<CanonicalMessage>` | 否 | 非空、稳定前缀 + 缓存断点 | `impl/02` §5.1/§6.1 |
| `tools` | `List<ToolDeclaration>` | 否 | 空列表等价无工具 | `impl/05` §2.3 |
| `sampling` | `Sampling` | 否 | 温度/输出上限等，来自配置 | `impl/02` §5 |
| `providerOptions` | `ProviderOptions` | 否 | 厂商逃生门 | D-MDL-11 |
| `budget` | `BudgetEnvelope` | 否 | 见 §4.8 | `impl/02` §5、卷 01 铁律 8 |
| `caller` | `CallerMetadata` | 否 | 六维归因 | REQ-MDL-18 |
| `idempotencyKey` | `String` | 否 | 重试恒定 | `impl/02` §6.2 |
### §4.2 ModelResponse 与 Usage（`kernel.model`）
```java
/** 非流式聚合响应。@param requestId 请求标识（用量与审计的幂等键） @param modelId 实际执行模型（可能因路由/档位解析不同于请求） @param message 助手消息（工具调用块已合并完整 JSON） @param finishReason 结束原因（STOP/LENGTH/TOOL_USE/CONTENT_FILTER/ERROR） @param usage 用量快照 */
public record ModelResponse(String requestId, String modelId, CanonicalMessage message,
                            FinishReason finishReason, Usage usage) {
}

/** 用量快照（缓存读写单列；成本为最小货币单位整数）。@param inputTokens 输入 token @param outputTokens 输出 token @param cacheReadTokens 缓存读 token（单列，供折扣计量） @param cacheWriteTokens 缓存写 token @param reasoningTokens 推理 token @param ttfbMillis 首字节耗时（毫秒） @param totalMillis 总耗时（毫秒） @param estimatedCostMinor 估算成本（最小货币单位） @param currency 币种（ISO-4217） @param estimated 是否估算值（流式中途为 true，末次为 false） */
public record Usage(long inputTokens, long outputTokens, long cacheReadTokens, long cacheWriteTokens,
                    long reasoningTokens, long ttfbMillis, long totalMillis,
                    long estimatedCostMinor, String currency, boolean estimated) {
}
```
### §4.3 StreamEvent 8 子型（`kernel.model.stream`）
| 子型 | 字段（类型） | 约束 | 线级对应（协议帧 type） |
| --- | --- | --- | --- |
| `TextDelta` | `seq(long)`、`text(String)` | text 非空 | `content_delta` |
| `ThinkingDelta` | `seq`、`text` | 仅推理模型产出 | `thinking_delta` |
| `ToolCallStarted` | `seq`、`toolCallId`、`toolName`、`parallelIndex(int)` | 调用标识与后续 delta/finished 一致 | `tool_call_start` |
| `ToolCallDelta` | `seq`、`toolCallId`、`argumentsDelta(String)` | 分片按 seq 合并为完整 JSON | `tool_call_delta` |
| `ToolCallFinished` | `seq`、`toolCallId`、`argumentsJson(String)` | 完整 JSON，可直接投 `ToolInvocation` | `tool_call_end` |
| `UsageReported` | `seq`、`usage(Usage)` | 流中可多次，末次为最终值 | `usage` |
| `StreamCompleted` | `seq`、`finishReason(FinishReason)` | 终态；此后游标不再产出 | `message_stop` |
| `StreamFailed` | `seq`、`errorCode(ModelErrorCode)`、`retryable(boolean)`、`vendorCode(String)` | 终态；`retryable` 取自 `ErrorCode.retryable`，`vendorCode` 已脱敏可空 | `message_stop`（错误变体） |

```java
/** 文本增量。 */
public record TextDelta(long seq, String text) implements StreamEvent { }
/** 推理（思维链）增量。 */
public record ThinkingDelta(long seq, String text) implements StreamEvent { }
/** 工具调用开始。 */
public record ToolCallStarted(long seq, String toolCallId, String toolName, int parallelIndex) implements StreamEvent { }
/** 工具参数增量（分片，可为不完整 JSON）。 */
public record ToolCallDelta(long seq, String toolCallId, String argumentsDelta) implements StreamEvent { }
/** 工具调用结束（参数已合并完整）。 */
public record ToolCallFinished(long seq, String toolCallId, String argumentsJson) implements StreamEvent { }
/** 用量上报（流中可多次）。 */
public record UsageReported(long seq, Usage usage) implements StreamEvent { }
/** 流正常结束（终态）。 */
public record StreamCompleted(long seq, FinishReason finishReason) implements StreamEvent { }
/** 流失败（终态；不抛厂商异常，错误在此定型）。 */
public record StreamFailed(long seq, ModelErrorCode errorCode, boolean retryable, String vendorCode) implements StreamEvent { }
```
### §4.4 AssistantMessagePayload 与 ItemPayload 家族（`kernel.agent`）
```java
/** 助手消息载荷：模型可见历史中助手侧条目的唯一载体（impl/12 仅给过类型名，字段在此冻结）。@param itemId 条目标识（会话内唯一） @param seq 会话内严格递增序号（无空洞） @param contentBlocks 内容块序列（文本/推理/工具调用；工具调用块为完整 JSON） @param usage 本条消息用量（可空：非终结消息无用量） @param stopReason 结束原因（与 StreamCompleted 一致） @param modelId 实际执行模型（审计与成本归因） */
public record AssistantMessagePayload(String itemId, long seq, List<ContentBlock> contentBlocks,
                                      Usage usage, FinishReason stopReason, String modelId)
        implements ItemPayload {
}

/** 用户消息载荷：提升（promoted）后的输入进入模型可见历史的载体。@param inputId 准入输入标识（幂等键载体） @param admittedSeq 准入序号（提升后仍保留，供审计串联） @param blocks 内容块（多模态块 + 附件引用） */
public record UserMessagePayload(String inputId, long admittedSeq, List<ContentBlock> blocks)
        implements ItemPayload {
}
```

`ItemPayload` 封闭集（`impl/12` §5.1）共 8 子型：`UserMessagePayload`、`AssistantMessagePayload`、`ToolCallPayload`、`ToolResultPayload`、`ApprovalPayload`、`CheckpointPayload`、`NoticePayload`、`SubAgentPayload`。**外置承载裁决**（R10 §六 B4-②）：条目正文统一为内联 `payload jsonb` + 超阈值转 CAS 并留 `payload_ref`，阈值为配置项（`impl/12` §8.1）；端口层不暴露列名（§6 D-PORT-4）。
### §4.5 ToolInvocation / ToolResult（`kernel.tool`）
```java
/** 工具调用（内核名；impl/05 的 ToolCall 为其别名，§6 D-PORT-8）。@param callId 调用标识（与模型侧 toolCallId 一致） @param toolName 工具名（含来源前缀） @param argumentsJson 合并完成的完整参数 JSON @param parallelIndex 并行序号（自零起编号） @param resourceClaim 资源声明（读集/写集/独占标记，来自注册声明） */
public record ToolInvocation(String callId, String toolName, String argumentsJson,
                             int parallelIndex, ResourceClaim resourceClaim) {
}

/** 工具结果（结构化；失败不抛异常而是回喂）。@param callId 调用标识（回填上下文） @param success 是否成功（失败时 errorCode 必填） @param summary 结果摘要（首部结构化信息，模型直接消费） @param content 结果内容（可空：完全外置时仅留引用） @param artifactRef 外置引用（超内联阈值时必填，再读按引用鉴权） @param errorCode 错误码（成功时为 null，取值见 ToolErrorCode） @param hint 修复建议（候选列表/建议动作，可空） @param elapsedMillis 执行耗时（毫秒） @param idempotentHit 幂等命中标记（命中即复用首次结果，副作用计数恒为 1） */
public record ToolResult(String callId, boolean success, String summary, String content,
                         ArtifactRef artifactRef, ToolErrorCode errorCode, String hint,
                         long elapsedMillis, boolean idempotentHit) {
}
```
### §4.6 ContextSnapshot / ContextAssembleRequest（`kernel.context`）
```java
/** 上下文快照（一次调用的输入面；压缩产出新实例以保证可回放）。@param snapshotId 快照标识（不透明引用） @param sessionId 会话标识 @param turnSeq 回合序号（快照归属，用于对拍与断线补发） @param budget token 预算（总预算 + 逐区段分配） @param sections 九区段内容（顺序以 ContextSectionId.order() 为准） @param breakpoints 缓存断点（稳定前缀段边界，供协议投射） @param promptVersions 提示词版本集（装配溯源） @param sourceDigests 来源基线摘要（缓存亲和判定） */
public record ContextSnapshot(String snapshotId, SessionId sessionId, long turnSeq, TokenBudget budget,
                              List<ContextSection> sections, List<CacheBreakpoint> breakpoints,
                              PromptVersionSet promptVersions, Map<SourceKey, String> sourceDigests) {
}

/** 装配请求。@param sessionId 会话标识（必填） @param mode 运行模式（编码/问答/自治，必填） @param workItemRef 关联工作对象（可空：非任务驱动会话） @param budgetOverride 预算覆盖（可空：使用模型窗口默认分配） @param instruction 本次指令文本（可空） */
public record ContextAssembleRequest(SessionId sessionId, KernelMode mode, WorkItemRef workItemRef,
                                     TokenBudget budgetOverride, String instruction) {
}
```

`ArtifactRef`（`refId`/`scheme`/`locator`/`contentHash`/`tokenSize`/`sensitivity`）、`TokenBudget`、`ContextSection` 字段未变，见 `impl/03` §5.1。
### §4.7 WorkItemRef（`kernel.work`）
```java
/** 工作对象引用（短 ID 供人读，UUID 防遍历）。@param shortId 人读短标识（编号规则为业务常量，禁止配置化） @param uuid 不透明引用（审计与权限校验） @param itemType 对象类型（Goal/Plan/Task/Step） */
public record WorkItemRef(String shortId, String uuid, WorkItemType itemType) {
}
```
### §4.8 公共值对象
| 值对象 | 定义要点 | 来源 |
| --- | --- | --- |
| `SessionId` / `TurnId` / `ItemId` / `TenantId` | 单字段不透明字符串 record；`ThreadId` 为 `SessionId` 的 agent 侧别名（§6 D-PORT-2） | `impl/01` §5、`impl/12` §5.1 |
| `ActorRef` | `kind`（USER/AGENT/SUB_AGENT/EXTERNAL/SERVICE）+ `id` + `tenantId`；信封 `Actor` 为其事件投影（§6 D-PORT-13） | `impl/06` §5、`impl/16` §5.1 |
| `BudgetEnvelope` | `tokenLimit` + `costLimitMinor` + `wallClockLimit(Duration)` + `toolCallLimit` + `currency`；划拨/扣减/结算回冲，偏差经 `agent.budget.settled` 上报 | 卷 01 铁律 8、卷 12 §5、`impl/12` §8.4 |
| `AdmissionOutcome` | sealed 四分支 `Admitted`/`Queued`/`Coalesced`/`Rejected`，完整定义沿用 `impl/01` §5.1 | `impl/01` §5.1 |
| `TenantContext` | `tenantId` + 请求主体 + 追踪；**每个**仓储与存储方法必带（缺失即 `INVALID_ARGUMENT`） | `impl/01` §10.6 |
| `CancelReason` | 封闭枚举：`USER_INTERRUPT`/`BUDGET_EXHAUSTED`/`HOST_SHUTDOWN`/`SESSION_CLOSED`/`TIMEOUT` | `impl/01` §5.1、`impl/02` §6.1 |
| `ErrorCode` | 契约层错误码枚举（`code + retryable + httpStatus + jsonRpcCode`），冻结位置属 **X-82** | `appendix-b` §B.11、R10 §八-13 |
| `EventEnvelope<P extends EventPayload>` | 16 字段信封，见 `impl/16` §5.1；`EventPayload` 采用非 sealed + SchemaRegistry 登记的开放扩展模型（R10 §八-7 已闭环，`impl/16` §5.1 已同步） | `impl/16` §5.1 |
## §5 线程与取消语义
| 端口方法 | 语义与承载 | 取消传播 |
| --- | --- | --- |
| `ModelGateway.stream` / `StreamCursor.next()` | 阻塞拉取（每调用一虚拟线程） | `close()` → 取消线程 → 关连接（≤1s） |
| `ModelGateway.generate` / `embed` | 阻塞（虚拟线程）；`PermissionPort.assess` 为本地求值（≤10ms P95），ASK 分支阻塞于审批（安全点） | 中断 → `AiException(CANCELLED)`；审批终止（HALT）即 DENY，不静默放行 |
| `ContextPort.assemble` / `compact` | 阻塞（局部 IO 经端口） | 中断即放弃，不得留下半写快照 |
| `ToolPort.invoke` | 阻塞至结果定型（虚拟线程 + 信号量限流） | 结构化 `TOOL_CANCELLED`，不上抛 |
| `SandboxPort.execute` | 阻塞返回执行流，流消费可阻塞 | `terminate` 幂等；超时按超时归属处置 |
| `EventPort.append` / `PersistencePort.*` | 阻塞（追加即提交点，P95 ≤10ms，批量走单虚拟线程 + 有界队列；仓储为短事务） | 不可取消；失败以可重试异常表达；仓储中断即回滚，禁止吞异常 |
| `MemoryPort` / `KnowledgePort` | 阻塞（嵌入等外部调用**先于事务**） | 中断即放弃，不留半写索引 |
| `WorkspacePort.commands().runOnce` | 阻塞（虚拟线程 / 外部进程） | 终止信号（TERM → 强制），回执幂等 |
| `HookPort.invoke` | 阻塞（受预算与熔断约束） | 超时按 `FailurePolicy` 处置（默认 fail-open 观察位） |
| `ClockPort` / `IdPort` / `RandomPort` | 非阻塞、纯内存 | 不可取消 |

**取消契约**：① 内核侧统一用 `SessionScope`，`CancellationException` 为唯一传播信号（`impl/01` §5.1）；② 阻塞方法必须把 `InterruptedException` 转为 `CancellationException` 并**恢复中断标记**，禁止吞掉；③ 端口实现不得捕获 `CancellationException` 后返回成功值；④ 取消幂等，取消已终态调用返回既有结果。
**超时归属**：超时值由**调用方**给出（`CommandRequest.timeout`、`SandboxPlanRequest` 配套策略、采样上限），由**被调方**强制执行并转为结构化失败（`TOOL_TIMEOUT` / `MODEL_TIMEOUT`）；禁止调用方杀线程或 `Thread.stop`；跨进程调用超时同时计入沙箱 deadline。
**端口层禁止行为（实现侧红线）**：① 不得记录密钥/Token/签名、完整身份证号与银行卡号、验证码明文、文件流与二进制内容；手机号必须脱敏（前 3 后 4），脱敏规则与 `logging-rules` §6 同源。② 不得绕过 `PermissionPort` / `SandboxPort` 直接触达副作用（D-PERM-3、REQ-TOOL-6）。③ 不得在事务体内发起外部调用（HTTP/SDK/脚本），外部调用一律移出事务。④ 不得静默降级为「无隔离/无权限/无租户」执行，能力缺失必须显式 `UNSUPPORTED_CAPABILITY`。⑤ 不得引入未登记的副作用（写路径必须在事件流中有对应事件）。⑥ 不得超出配置上限重试，不得按异常文案判定重试（只认 `ErrorCode.retryable`）。
## §6 与 impl 文档的差异登记（不改，只登记）
| # | 歧义点 | 本文件裁决 | 依据 |
| --- | --- | --- | --- |
| D-PORT-1 | 查询/必查/写的返回风格不一 | 单值 `Optional`、集合空集合、必查 `requireXxx` 抛 `NOT_FOUND`、写返回结果 record | 本文件 §1（统一裁决） |
| D-PORT-2 | `SessionId`（01）vs `ThreadId`（12）；Session↔Thread 基数未声明 | 端口层只暴露 `SessionId`；`ThreadId` 为 agent 侧别名；序号共用 `admittedSeq`/`seq` | R10 §六 R5 |
| D-PORT-3 | `AdmissionOutcome` vs `AdmissionReceipt` vs `SubmitAck` | 冻结 `AdmissionOutcome`（sealed）；后两者降级为协议面序列化视图 | R10 §六 B7 |
| D-PORT-4 | 输入表双承载：`oc_session_input`（01）vs `oc_agent_input`（12） | 端口层只有 `AdmissionRepository`，不暴露表名；DDL 唯一权威为 `impl/19` §8；事件常量单一登记，`agent.input.admitted` 登记为弃用别名 | R10 §六 B4/B6、R6 |
| D-PORT-5 | `SandboxPort`（20/31）vs `ExecutionIsolationPort`（07）；`open(ProfileRef,…)` 形态 | 冻结 `SandboxPort`；四法沿用 07；`open` 为 `select + prepare` 便捷重载 | `impl/07` §5、`impl/31` §1.4 |
| D-PORT-6 | `assess`（06）vs `decide`（15/31） | 冻结 `assess`；`decide` 为别名；`modeOf`/`ceilingOf` 为冻结窄查询 | `impl/06` §5、`impl/12`/`13` §1.4 |
| D-PORT-7 | `LlmPort.complete`（12/09/10）vs `ModelGateway.stream`（02） | `ModelGateway` 为唯一实现面；`LlmPort` 为 Agent 侧窄视图（`complete`/`embed`），委托同一实现 | `impl/02` §9.1、`impl/12` §1.4 |
| D-PORT-8 | `ToolCall`（05）vs `ToolInvocation`（12/C09）；`ToolSettlement` 归属 | 端口名冻结 `ToolInvocation`；`ToolCall` 为别名；`ToolSettlement` 为运行时聚合不进端口 | `impl/05` §5、`impl/12` §5.1 |
| D-PORT-9 | `EventPort` vs `EventAppender`/`EventQueryService`/`FanoutBus`（16） | 冻结 `EventPort` 三面；16 的内部分解降为实现细节 | `impl/16` §5、`impl/01` §9.3 |
| D-PORT-10 | `IdPort`（01/18）vs `IdGeneratorPort` | 冻结 `IdPort`；后者为别名；时钟/ID/随机必须成组注入 | `impl/01` §9.3、`impl/18` §4.2 |
| D-PORT-11 | `WorkspacePort`（05/11）vs `WorkspaceProviderSPI`（20）vs `WorkspaceExecPort`（21） | 冻结 `WorkspacePort{files(),commands()}`；`WorkspaceProviderSPI` 为平台后端 SPI；`WorkspaceExecPort.run` = `commands().runOnce` | `impl/20` §5、`impl/21` §1.4 |
| D-PORT-12 | 8 个 `StreamEvent` 子型名 vs 线级名 | Java 类型名冻结为 impl/02 既有 8 名；线级名只出现在帧 `type`，由 `ProtocolCodec` 投射，不新造类型 | `impl/02` §5.1 |
| D-PORT-13 | `ActorRef`（06/14）vs `Actor`（16 信封） | `ActorRef` 为内核统一主体引用；`Actor` 为其事件投影字段类型 | `impl/06` §5、`impl/16` §5.1 |
| D-PORT-14 | 计量/遥测失败处置 | 显式 fail-open 例外（M19：吞异常 + WARN + 指标），业务写路径不适用 | `impl/02` §8.1、`impl/26` §10.5 |
| D-PORT-15 | `ErrorCode`/`HarnessException` 无定义 | 只引用不定义；冻结位置 `harness-contract`（兑现 X-82） | R10 §六 B8 |

**需回改的文件清单（本文件不改，供编排方派单）**：

| 序 | 文件 | 动作 | 兑现 |
| --- | --- | --- | --- |
| 1 | `impl/01` §9.3 | 端口表增「签名见 `00-contracts/KERNEL-PORTS.md` §3」指针列 | B9 |
| 2 | `impl/02` §5.1 | `StreamEvent` 段增「8 子型字段见 KERNEL-PORTS §4.3」 | B8 端口侧 |
| 3 | `impl/12` §5.1/§9.1 | `SubmitAck` 降级为 `AdmissionOutcome` 序列化视图；`ThreadId` 加别名注 | B7/D-PORT-2 |
| 4 | `impl/12` §8.1 | `oc_item` 增内联 `payload jsonb` 列与外置阈值单一来源 | B4-② |
| 5 | `impl/07` §5 | `ExecutionIsolationPort` 增「=`SandboxPort` 实现别名」注 | D-PORT-5 |
| 6 | `impl/16` §5.1 | `EventAppender` 增「=`EventPort` 写面实现」注 | D-PORT-9 |
| 7 | `impl/19` §8 | 升格 DDL 唯一权威；输入表（`oc_session_input`/`oc_agent_input`）二选一定稿 | B4/B6 |
| 8 | `appendix-b` §B.2/§B.11 | 增出参类型列与 `retryable` 列 | B7/B8 |
| 9 | `impl/13`/`15`/`21`/`31` §1.4 | `decide`/`ceilingOf`/`WorkspaceExecPort`/`open(ProfileRef,…)` 统一为别名注 | D-PORT-5/6/11 |
## §7 最小可编译清单（M0：新建会话 → 发消息 → 流式文本 → 落库 → 恢复）
**类集（24 个编译单元，按开工顺序）**：

| # | 类/接口 | 模块 | 实现端口 | 步（卷 27 §4.5） |
| --- | --- | --- | --- | --- |
| 1 | `ErrorCode` + `HarnessException`（枚举 + 基类） | `harness-contract` | — | 0（X-82 前置） |
| 2 | `EventEnvelope` + `EventPayload` | `harness-contract` | — | 1 |
| 3 | `AppendRequest` + `AppendResult` | `harness-contract` | — | 1 |
| 4 | `ModelRequest` + `ModelResponse` + `Usage` | `harness-contract` | — | 1 |
| 5 | `StreamEvent` + 8 子型 | `harness-contract` | — | 1 |
| 6 | `AdmissionOutcome` + `SessionInputRecord` | `harness-contract` | — | 1 |
| 7 | `ToolInvocation` + `ToolResult` | `harness-contract` | — | 1 |
| 8 | `ContextSnapshot` + `TokenBudget` + `ContextSection` | `harness-contract` | — | 1 |
| 9 | `SessionId`/`TurnId`/`ItemId`/`TenantId`/`ActorRef`/`BudgetEnvelope` | `harness-contract` | — | 1 |
| 10 | 12 个领域端口接口（本文件 §3.1–§3.12） | `harness-contract` | — | 1 |
| 11 | `KernelBootstrap` + `KernelHandle` | `harness-kernel/kernel-agent` | 装配入口 | 2 |
| 12 | `SessionRuntime` + `SessionHandle` | `harness-kernel/kernel-agent` | — | 2 |
| 13 | `InputAdmission` | `harness-kernel/kernel-agent` | `PersistencePort.admissions()` | 2 |
| 14 | `EventAppender` | `harness-kernel/kernel-event` | `EventPort` 写面 | 2 |
| 15 | `FakeModelProvider`（脚本流式） | `harness-kernel/kernel-qa` | `ModelGateway`/`ModelProvider` | 3 |
| 16 | `DefaultToolRuntime` + `read_file` | `harness-kernel/kernel-tool` | `ToolPort` | 4 |
| 17 | `AgentRuntime` + `TurnOrchestrator` | `harness-kernel/kernel-agent` | — | 5 |
| 18 | `CheckpointWriter` | `harness-kernel/kernel-agent` | `PersistencePort.checkpoints()` | 5 |
| 19 | `DefaultContextEngine`（裁剪，压缩后置） | `harness-kernel/kernel-context` | `ContextPort` | 6 |
| 20 | `InMemoryEventStore` + `InMemoryPersistence` | `platform-runtime-store` | `EventPort`/`PersistencePort`/`EventStorePort` | 2 |
| 21 | `SystemClockAdapter` + `SnowflakeIdAdapter` + `SpringTransactionAdapter` | `platform-runtime-store` | `ClockPort`/`IdPort`/`TransactionPort` | 2 |
| 22 | `PgPersistenceAdapter` | `platform-persistence` | `PersistencePort` + `StoragePort` | 9 |
| 23 | `ApplicationAssembler` | `host-bootstrap` | 端口绑定（`@ConditionalOnMissingBean`） | 2 |
| 24 | `SessionProtocolServer` | `host-protocol` | `FrameChannel`/`ProtocolCodec` | 8 |

**顺序与门禁**：先第 1–10 行一次冻结契约（禁随实现增删方法）→ 内存实现（20/21）+ 装配（23）跑通「建会话 → 发消息（准入）→ 假模型流式文本 → 条目落库（内存）→ 恢复（重放）」→ 再以 22 换持久化实现，同一套端口契约测试复用。验收命令：`mvn -q -pl harness-contract,harness-kernel,harness-host/host-protocol -am test`；离线链路 `oc qa replay --suite core`（`impl/33` §11.2）。第 11–19 行的实现类在 M0 只要求「端口契约测试全绿 + 假模型链路可跑通」，真模型与工具族在 M1 之后补齐。
