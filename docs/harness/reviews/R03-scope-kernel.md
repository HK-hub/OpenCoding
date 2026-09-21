# R03 · 技术合理性与数字一致性（范围：`impl/01`–`impl/12`）

> 执行轮次：Phase B 自审查 · 第 3 轮（lens = 依赖方向 / 并发模型 / 事务与外部调用 / 数字一致性 / Java 可编译性 / X-82 登记）
> 审查范围：`docs/harness/impl/01-kernel-runtime-impl.md` … `12-agent-runtime-impl.md`（12 份）
> 基准：卷 01 §4.5 铁律 R1–R5、卷 27 §4.1–§4.2、卷 31 §4.1、NFR 表（卷 00 §6.1）、`DECISIONS.md` H-001…H-019、`impl/IMPL-DECISIONS.md`
> 修改约束：只增不删；中文；决策编号零改动；**台账未改**（X-82 由编排方登记）。

## 1. 方法（可复核取证）

| 步骤 | 手段 | 覆盖 |
| --- | --- | --- |
| Java 块清点 | Node 脚本抽取全部 ```java 块（41 块），逐块列类型声明与注解行 | 12/12 |
| 注解扫描 | 全量 grep `@Service`/`@Component`/`@ConfigurationProperties`/`@Transactional` + 文本 `springframework`/`MyBatis`/`JPA`/`Jackson` | 12/12 |
| 并发机制 | grep 虚拟线程/平台线程/`Executors`/`Semaphore`/单飞/锁/队列 → 矩阵（§2） | 12/12 |
| 事务 | grep 事务/AFTER_COMMIT/outbox/提交后 + 逐文件写路径核对（§4.3） | 12/12 |
| 数字 | grep `ms`/`s`/`MB`/`GB`/token/QPS/EPS/并发/深度/保留 → 对照 §3 | 12/12 |
| 格式 | 代码围栏配平复核（编辑后 12/12 偶数，无新增图） | 12/12 |

## 2. 并发矩阵（文件 × 机制）

| 文件 | 主承载线程 | 并行点与上限 | 串行/互斥 | 背压 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 01 | runner=**平台线程/会话**（max-active 默认 50）；Agent 循环与流读取=虚拟线程 | 事件追加器 1 虚拟线程；协议面每连接 1 读取线程 | 单飞=`runner_epoch` 条件更新；`(sessionId,seq)` 唯一约束 | 有界队列阻塞生产者；拉取式流；仅遥测可丢 | 自洽（01 §10.1） |
| 02 | 每模型调用 1 虚拟线程 | 单凭证信号量 8；限流排队 P95 ≤ 2s | 重试装饰器「至多消费一次」 | 用量独立虚拟线程 + 有界队列 4096，满则丢弃计数 | 自洽 |
| 03 | 调用方虚拟线程 + 独立压缩虚拟线程 | 记忆/知识/符号并行 fork；压缩并发=会话数（每会话 1） | 装配锁 + 压缩任务栅栏 | 单来源失败仅降级该来源 | **已修**（自研 `SessionScope`） |
| 04 | 调用方虚拟线程 | 片段哈希可并行 | 租户级发布锁 | 产物缓存 + 事件失效 | 自洽 |
| 05 | 每工具 1 虚拟线程（`newVirtualThreadPerTaskExecutor`） | 单会话并发工具 ≤ 64；读并行/写串行（冲突图） | 分片锁 P99 ≤ 5ms | 输出外置 + 信号量 | **已修**（口径） |
| 06 | 审批等待=虚拟线程 | 决策纯计算无并行 | 应答 CAS 幂等；策略不可变快照 | fail-closed 不无限阻塞 | 自洽 |
| 07 | 每隔离实例 1 虚拟线程 | 并行=min(CPU, 策略并发度)；池 max(2, CPU/4) | 工作区写互斥（Redis 租约+看门狗） | 有界通道暂停 stdout 消费 | **已修**（自研 `SessionScope`） |
| 08 | 同步调用虚拟线程 | registry 同步单飞；评测 worker min(CPU,4) | 会话级激活串行；版本级互斥 | 懒加载 | 自洽 |
| 09 | 读侧每请求 1 虚拟线程；写=每服务器 1 序列化器 | 在途上限 `Semaphore`；`startup.concurrency` | 服务器级锁 + 去抖 500ms | 队列满按风险排队/拒绝 | 自洽 |
| 10 | 召回/归并=虚拟线程 | 向量与全文并行；归并单锁 | `(tenant,scope,key)` 串行；删除租户内串行 | 队列满阻塞降速不丢任务 | 自洽 |
| 11 | `SyncScheduler` 虚拟线程 | 三路召回并行；批并发 min(CPU,8) | 源级独占租约锁 | 有界队列满则调用方阻塞 | 自洽 |
| 12 | 扇出 `newVirtualThreadPerTaskExecutor` | 只读批 ≤ `fanout.maxParallelReadOnly`(10)；子 Agent ≤ 4 | 会话锁（Redis 加速）+ `runner_epoch` 锚点；输入队列 256 | 满则 `RATE_LIMITED` 不丢输入 | **已修**（锚点/口径） |

**结论**：唯一系统性矛盾为「结构化并发实现口径」——03/05/07 明写 JDK preview `StructuredTaskScope`，与 01（I-ARC-3 自研 `SessionScope`，零 preview 依赖）及 12（同 01）冲突；本轮统一为自研 `SessionScope`。runner 采用平台线程（01）与其余各层虚拟线程不冲突：runner 只做编排与阻塞取队，IO 全部在虚拟线程。锁故事统一为「Redis 仅加速、DB 条件更新兜底」（12 §10.1 已补锚点）。

## 3. 数字一致性表（claim | 值 | Phase A 值 | 判定）

| 指标（文件） | 本组取值 | Phase A 基准 | 判定 |
| --- | --- | --- | --- |
| CLI/embedded 内核冷启动（01 §10.2） | ≤ 300ms P95 | NFR-P-6 ≤ 300ms；H-002 回退线 | 一致 |
| 内核内存回退线（01 §10.3 / 03 §10.7 / 12 §10.11） | 单会话 6–10MB、50 会话 ≈500MB 堆；50 装配 ≈300MB | H-002 > 200MB 触发裁剪（单机 CLI 口径） | 一致（口径不同：集群并发 vs 单机空闲） |
| IPC 往返（01 §10.2） | stdio ≤ 5ms；WS ≤ 20ms P95 | 卷 01 §7 ≤ 20ms；H-002 P95 增量 > 50ms 才回退 | 一致 |
| 事件追加（01 §10.2） | ≤ 10ms P95；批量 ≥ 50k EPS | NFR-P-4 | 一致 |
| 会话恢复（01 §10.2） | ≤ 2s P95（10k 事件）；sidecar 启动+恢复 ≤ 3s | NFR-P-5 ≤ 2s（单会话冷加载） | **已修**：注明与 NFR-P-5 不同口径 |
| 活跃会话（01 §10.2） | ≥ 50（server ≥ 500） | NFR-P-9 | 一致 |
| 首字节（02 §10.3） | ≤ 1.5s P95；取消 ≤ 1s | NFR-P-1 | 一致 |
| 模型调用 QPS（02 §10.3） | 50 会话 ≈ 1–2 均值/5 峰值；500 会话 ≈ 11 | 卷 31 §4.1 公式 ≈ 11 QPS@500 | **已修**（原「5–10@50 会话」与公式不符） |
| 上下文装配（03 §10.7） | P50 ≤ 25ms / P95 ≤ 80ms | 卷 03 §7 ≤ 80ms P95 | 一致 |
| 压缩（03 §10.7） | L2 触发至提交 P95 ≤ 15s；不阻塞流式 | NFR-P-10（仅要求异步不阻塞，无秒数） | 一致（impl 级预算，无冲突） |
| 提示词组装（04 §10.7） | P95 ≤ 30ms；产物命中 ≥ 95% | 卷 04 §7 ≤ 30ms / ≥ 95% | 一致 |
| 工具管线（05 §10.2） | ≤ 20ms P95；单会话并发工具 64 | NFR-P-3 ≤ 20ms | 一致 |
| 权限决策（06 §10.2） | P95 ≤ 10ms | 卷 06 §7 ≤ 10ms | 一致 |
| 沙箱（07 §10.1/10.2） | L0/L0+ ≤ 20ms；L1 复用 ≤ 200ms；启动 0.5–2s；代理 ≤ 15/35ms | 卷 07 §7 同值 | 一致 |
| 技能（08 §10.1/10.6） | 装载 ≤ 100ms；索引 ≤ 300ms/1k；激活 ≤ 50ms | 无 Phase A 值（impl 级） | 一致（新增预算） |
| MCP stdio（09 §10.2） | ≤ 10ms P95；热可见 ≤ 200ms | 卷 09 §7 ≤ 10ms | 一致 |
| 记忆召回（10 §10.2） | P95 ≤ 150ms | 卷 10 §7 ≤ 150ms | 一致 |
| 知识检索（11 §10.2） | 30/100/120/50ms；合计 ≤ 300ms P95；索引 ≤ 10min | 卷 11 §4.2 同值；NFR-P-8 | 一致 |
| 阶段切换/插话（12 §10.2） | ≤ 5ms；≤ 1s（安全点后） | 卷 12 §7 同值 | 一致 |
| 子 Agent 深度（12 §9.3/§10.11） | 默认 3 | 卷 12 §4「默认 3；企业可配」 | **已修**（原 §10.11 写 2，与 §9.3 冲突） |
| 检查点节拍（12 §9.3/§10.11） | `checkpoint.everyNItems` 默认 8 | impl 级 | **已修**（原 `checkpointEveryToolCalls=10` 与配置表不符） |
| 单 Turn 内存（12 §10.11） | 4–12MB；50 Turn 按上限 ≈600MB | 卷 01 §10.3 6–10MB/会话 | **已修**（补「按 12MB 上限取、同源估算」） |

## 4. 违规与修复（按类别）

### 4.1 依赖方向（R1–R5）
- 06 §5 `DefaultActionGateway` 带 `@Service`（内核层出现 Spring 容器注解，违反 R1/H-003）→ 移除，并补层带归属说明（外壳装配显式构造）。
- 10 §5 `MemoryRecallService` 的 `@Service` → 保留但 JavaDoc 显式声明属平台域带 `platform-memory`（与 §1.4「外壳装配」一致），内核仅 Ranker/Resolver 纯逻辑。
- 03 §5.2 / 04 §5.2 `@ConfigurationProperties` 属性类 → JavaDoc 标注落平台域带（不随内核编译），消除「内核出现 Spring 注解」歧义。
- 12 §9.3 `AgentProperties` → 增层带归属：属性包在外壳装配，内核只接收 `AgentRuntimeLimits` 值对象（Enforcer R1）。
- 05 §1.4 / §3.6.1：允许依赖「jackson」及 `Jackson convertValue`（卷 27 R1 禁内核 Jackson）→ 改为**零 Jackson**、JSON 经 `JsonCodec` 端口。
- 02 §5.1 域内枚举 `ErrorCode` 与契约层全局 `ErrorCode` 同简名（跨层编译歧义）→ 改名 `ModelErrorCode`（与 `ToolErrorCode`/`SandboxErrorCode` 家族一致），并声明 code 映射。
- 模块名修正：01/02/05/06/07/08 的 mvn 命令由 v1 名改为卷 27 §4.1 reactor 名；09/10 的不存在模块（`open-coding-core-mcp`/`-memory`）改为 `harness-platform/platform-mcp`、`platform-memory`；05–08 §1.4 与 01 §1.4 加桥接/对齐注。

### 4.2 并发模型
- 03 §10.1、05 §10、07 §10.1：`StructuredTaskScope` → 自研 `SessionScope`（I-ARC-3；零 preview 依赖）。
- 04 §10.1：片段哈希并行注明自研 `SessionScope`。
- 12 §10.1：`oc:agent:run:lock` 补正确性锚点（`runner_epoch` 条件更新；Redis 仅加速）。

### 4.3 事务与外部调用
- 12/12 文件现均含「事务与外部调用纪律」：写路径 `@Transactional(rollbackFor = Exception.class)`（内核经 `TransactionPort`/端口，由外壳/平台适配器承载）；外部调用（模型/沙箱/HTTP/嵌入/registry/MCP 进程）移出事务，提交后事件驱动。01 原有（§5.1 `TransactionPort`）并保留；02 强化（独立事务 + 事务外捕获）；其余 9 份本轮补齐。
- 02 §8.1：用量/审计写入「独立事务 + 事务外捕获吞异常（M19）」显式化，避免与 `@Transactional` 回滚语义冲突。
- 内核文件（01/03/05/06/12）不引入注解事务，符合 R1；平台文件（07/08/09/10/11）注明其适配器方法可标注。

### 4.4 Java 可编译性（41 块全量 + top 签名核对）
- sealed `permits` 与 record `implements` 闭合一致；record 组件合法；泛型 `CompletableFuture<T>`、`Map<ContextSectionId, Long>` 等合法；`switch` 穷尽依赖 sealed（文档级）。
- Lombok `@RequiredArgsConstructor` 用于 code+desc 枚举（07/08/09/10）为既有惯例模式，可编译。
- 未发现 TS-isms、非法 permits、非法组件或裸 `RuntimeException` 示例。
- 06/10 类样例为节选（构造字段未在节选中声明）——非语法错误，落地时按 §5 补齐。

### 4.5 X-82 登记
- 12/12 文件异常约定段落已各加一行指针 → **X-82**（`impl/IMPL-DECISIONS.md` §4）。
- **重要**：本轮读取时台账仍为 X-1…X-81（§4.2 表内无 X-82），指针为「待登记指引」；台账登记由编排方执行（本文件不改台账）。若终局不登记，请将 12 处指针改指 `reviews/R02-scope-enterprise.md` §五 遗留 3。

## 5. 剩余问题（未改 / 待裁决）

1. **X-82 台账未落**（见 §4.5）——最高优先级，否则 12 处指针悬空。
2. **模块命名双轨**：impl/01–10 的 §1.4 表保留 v1 仓模块名（已有桥接注），11–35 用 reactor 名；建议审计轮统一为卷 27 名并保留一节映射表。
3. **三带名与 reactor 名并存**：卷 01 §4.2（harness-core/surface）与卷 27 §4.1（harness-kernel/host）未合并口径；01 §1.4 已加对齐注，但 Phase A 卷 01 若回改需同步。
4. **02 改名残留**：`ModelErrorCode` 改名后，§10.7 表头等仍用 `ErrorCode` 简写（决策口径引用）；建议 Phase A 回改时统一措辞。
5. **样例节选**：部分类样例省略字段/构造与 `of()` 工厂；`HostProfile`/`DeliveryMode`/`TurnPhase` 未带 code+desc（内部协议枚举，判定低风险），若按 `.qoder/rules/constant-extraction-rules.md` 严格口径需补。
6. **07 `atLeast` 用 `ordinal()`**：注释已声明「声明顺序即强度、禁止散落 ordinal 比较」，判定为受控用法；若企业基线禁用 ordinal 需换显式权重表（低风险）。
