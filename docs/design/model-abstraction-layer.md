# OpenCoding 模型抽象层 — 详细设计 v2.0

> 状态：**设计已定稿（M1–M20），待你审阅确认；代码未改动**
> 日期：2026-09-14
> 定位：本文是模型抽象层的**唯一权威依据**，覆盖并取代 `core-api-contract-and-model-adapter.md` 的 §5.2 / §5.3 / §5.4 / §5.5 / §5.8 / §5.10 / §6 / §7.1。
> 范围：`core-api` 的模型相关契约 + `core-model` 全部实现 + `core-implementation` 的装配与默认实现 + `core-agent` 的单轮执行与调用侧。

---

## 1. 决策日志

| # | 决策 | 结论 |
|---|---|---|
| M1 | 顶层范式 | **分模态独立契约**：`AiModel` 基座 + 每模态自我描述的接口；差异靠类型表达，不用泛型参数 |
| M2 | 三层职责 | `ModelDescriptor`（纯元数据 record）/ `ModelProvider`（纯配置实体，不含实例）/ `AiModel`（运行时实例 = client + 元数据快照） |
| M3 | 查找入口 | 上层**只依赖一个** `ModelRegistry`；`ModelProviderRegistry` 管 yaml+DB 合并；`ModelFactory` 降为被 Registry 调用的 SPI；**删除 `ModelResolver`** |
| M4 | 厂商参数 | canonical 参数强类型，厂商特有 + 协议专属走 `ObjectNode providerOptions` 透传；**协议字段不进 canonical**（`previousResponseId` 从 `ChatRequest` 移出） |
| M5 | 实例生命周期 | SDK client 按 `providerKey` 单例；`AiModel` 按 `(providerKey, modelId)` 缓存；`reload()` 全量失效，在途 run 用旧实例跑完 |
| M6 | 能力接口层次 | **删除 `model/capable/*` 整个包**；`StreamingChatModel extends ChatModel`；非流式由流式聚合兜底 |
| M7 | 类图层数 | 两层基座（`AbstractAiModel` + 每模态 `AbstractXxxModel`）+ 协议差异下沉到 Mapper/Codec |
| M8 | 请求组装 | 独立 `ChatRequestAssembler` SPI，**只读 `ChatSession` 内存 canonical 历史** |
| M9 | 单轮执行 | `ChatTurnExecutor` 契约（api 声明 / core-agent 实现）；`ChatSession` 退化为**状态容器 + 落库门面，无 send/stream** |
| M10 | 依赖方向 | `ChatService \| AgentLoop → ChatTurnExecutor → Assembler → ChatSession(只读) → ConversationStore`（单向无环） |
| M11 | 重试与校验 | 装饰器链 `CapabilityGuard → RetryingChatModel → [插件装饰器] → 适配器`；重试边界 = 单次模型调用 |
| M12 | 流式聚合 | 聚合在**适配器内**，`StreamCompleted` 必定携带完整 parts/toolCalls/usage |
| M13 | 工具结果 | 双通道 `ToolResult(modelParts, displayPayload)`；`displayPayload` 类型上不可能进上下文 |
| M14 | 公共基座 | 保留 `AiRequest` / `AiResponse` / `AiStreamEvent` 三个接口（record 实现它们），作为计量/审计/trace 的唯一接缝 |
| M15 | 切换模型 | 作废 `nativeStateToken` + 下一轮全量重放 + 记 `MODEL_SWITCHED` 审计事件 |
| M16 | 能力冲突 | 声明为准；运行时发现声明错误只翻译错误码 + 落审计，**绝不自动改配置** |
| M17 | 逃生舱 | `AiModel.unwrap(Class<T>)`，装饰器转发到 inner；调用方只需依赖 core-api + 厂商 SDK |
| M18 | 会话并发 | 会话级单飞守卫 + 策略可配（`QUEUE` 默认 / `REJECT` / `CANCEL`） |
| M19 | 装饰器扩展 | `ModelDecorator` SPI，插件可插入横切装饰器（配额/计量/trace/合规） |
| M20 | 音频粒度 | `ModelCapability` 新增 `SPEECH_TO_TEXT` / `TEXT_TO_SPEECH`，**保留 `AUDIO` 作为聚合展示位**；`SpeechToTextModel` / `TextToSpeechModel` 接口独立 |

---

## 2. 依赖关系

### 2.1 依赖图

```
                     ┌────────────────────────────────────────────────┐
                     │              core-api（契约层）                 │
                     │  AiModel 类型树 · SPI · record 值对象 · 异常     │
                     │  依赖：jackson-databind + reactor-core + slf4j  │
                     │  零 Spring，零厂商 SDK                          │
                     └──────▲─────────────────▲─────────────────▲─────┘
                            │                 │                 │
        ┌───────────────────┘                 │                 └───────────────┐
        │                                     │                                 │
┌───────┴─────────┐               ┌───────────┴──────────┐          ┌───────────┴────────┐
│   core-model    │               │    core-agent        │          │    core-tool       │
│  四协议适配器    │               │  AgentLoop           │          │  7 内置工具         │
│  Mapper + Codec │               │  ChatTurnExecutor    │          │  nexec / pty4j     │
│  含 SDK 依赖     │               │  Assembler / 权限/压缩 │          │                    │
└───────┬─────────┘               └──────────────────────┘          └────────────────────┘
        │ 被装配
        ▼
┌───────────────────────────────────────┐
│        core-implementation            │  纯 Java 默认实现（零 Spring）
│  CachingModelRegistry   ← 上层唯一入口  │
│  SnapshotProviderRegistry             │
│  DefaultModelFactory                  │
│  CapabilityGuard / RetryingChatModel  │
│  DefaultChatSession / InMemoryStore   │
└───────┬───────────────────────────────┘
        │ 被 domain / bootstrap 按 SPI 覆盖
        ▼
┌───────────────────────────────┐      ┌──────────────────────────────────┐
│  open-coding-domain (✅Spring) │      │  open-coding-bootstrap (✅Spring) │
│  DB 版 SPI + Flyway + 实体     │◀─────│  @AutoConfiguration               │
│  DbModelProviderRegistry      │      │  配置绑定 + reload 触发            │
└───────────────────────────────┘      └──────────────────────────────────┘
```

### 2.2 依赖铁律

1. **core-* 永不依赖 Spring、domain、infrastructure**。DB 版实现住在 domain，由 bootstrap 装配时覆盖（`@ConditionalOnMissingBean`）。
2. **模型实例不依赖会话**。`AiModel` / `ChatRequest` / `ChatResponse` 里没有任何 `ChatSession` 引用；方向永远是 上层 → 模型层。
3. **写路径唯一**：所有消息落库只经过 `ChatSession.append()`；`ChatTurnExecutor` 无副作用。
4. **读路径唯一**：所有请求组装只经过 `ChatRequestAssembler`，历史只从 `ChatSession.messages()` 读。

实测铁律的检查项：`mvn dependency:tree -pl open-coding-core/open-coding-core-model` 不应出现 `spring-*`。

---

## 3. 类图

> 本章 4 张图的 **Mermaid 可渲染版本**见 `core-api-contract-and-model-adapter.md` §3.4（图1–图4）；ASCII 手绘版移到本文件 **附录 A**（终端可读，保留 ★ 注解）。

### 3.1 类型树（core-api）

- 基座 `AiModel` 提供三件事：身份（`providerKey()` / `modelId()`）、元数据入口（`descriptor()`）、能力集合（`capabilities()`），外加逃生舱 `unwrap(Class)`。
- **唯一一层派生**是 `StreamingChatModel extends ChatModel`；其余 6 个模态接口（Embedding / Image / Video / SpeechToText / TextToSpeech）直接继承 `AiModel`。
- 跨模态公共基座 `AiRequest` / `AiResponse` / `AiStreamEvent` 由 record 实现，作为计量、审计与 trace 的唯一接缝（M14）。
- 配置侧与运行时解耦：`ModelProvider`（配置实体）产出 `ModelDescriptor`（元数据 record），两者都不含 client 与行为。

### 3.2 查找与装配（core-api 契约 + core-implementation 实现）

- `ModelRegistry` 是**上层唯一入口**（Facade）：元数据查询 + `resolve()` + 实例缓存 + `invalidate()`。
- 向下协作三个 SPI：`ModelProviderRegistry`（yaml + DB 合并）、`ModelFactory`（造实例）、`ModelDecorator`（装饰链）。
- 缓存两张表：`clients`（key = providerKey）与 `models`（key = providerKey + modelId）；`reload()` 全量失效，在途 run 持旧实例跑完（M5）。

### 3.3 实现树（core-model）

- 两层基座：`AbstractAiModel`（持 provider + descriptor 快照、实现 `unwrap`）→ 每模态 `AbstractXxxModel`；`AbstractChatModel` 额外提供 `require()` 能力校验与 `collect()` 流式聚合兜底。
- 每个协议的具体 Model 只做编排（约 40 行），协议差异全部下沉到三件套 Mapper（Request / Response / Stream）与 `OptionsCodec`；流式累加器在 `StreamMapper` 内部（M12）。
- **新增第 5 个协议 = 新增 5 个小类**，基类、接口、Registry、上层代码零改动。

### 3.4 调用侧（core-agent + core-implementation）

- 依赖单向无环：`ChatService | AgentLoop → ChatTurnExecutor → ChatRequestAssembler → ChatSession(只读) → ConversationStore`（M10）。
- `ChatSession` **没有 `send()` / `stream()`**，只有 `messages()` / `append()` / `switchModel()` / `acquireRun()`（M9 / M18）。
- `ChatTurnExecutor` 无副作用：不落库、不改 session；落库由调用方 `append()` 完成。

---

## 4. 接口清单

### 4.1 基础设施类型

```java
// ── error ──
public class AiException extends RuntimeException {
    private final ErrorCode code;
    private final String providerKey;
    private final Integer httpStatus;
    public AiException(ErrorCode code, String message, String providerKey,
                       Integer httpStatus, Throwable cause) { ... }
    public boolean retryable() { return code.retryable(); }
}

public enum ErrorCode {
    INVALID_REQUEST(false), AUTHENTICATION_FAILED(false), PERMISSION_DENIED(false),
    RATE_LIMITED(true), QUOTA_EXCEEDED(false), CONTEXT_LENGTH_EXCEEDED(false),
    CONTENT_FILTERED(false), MODEL_NOT_FOUND(false), UNSUPPORTED_CAPABILITY(false),
    PROVIDER_UNAVAILABLE(true), NETWORK_ERROR(true), TIMEOUT(true),
    STREAM_INTERRUPTED(true), TOOL_EXECUTION_FAILED(false), CONFLICT(false),
    APPROVAL_DENIED(false), ABORTED(false), INTERNAL_ERROR(false);
    private final boolean retryable;
    public boolean retryable() { return retryable; }
}

// ── usage ──
public record Usage(int inputTokens, int cachedInputTokens,
                    int outputTokens, int reasoningTokens) {
    public static final Usage ZERO = new Usage(0, 0, 0, 0);
    public int totalTokens() { return inputTokens + outputTokens; }
}
```

### 4.2 公共基座（M14）

```java
public interface AiRequest {
    String sessionId();
    String runId();
    ObjectNode extraParams();          // 已合并的透传参数（providerOptions 的运行时快照）
}

public interface AiResponse {
    String providerKey();
    String modelId();
    Usage usage();
    long latencyMs();
    ObjectNode rawProviderPayload();   // capture-raw-payload 关闭时为 null
}

public interface AiStreamEvent {
    String messageId();
    long seq();
}
```

### 4.3 模型能力契约（M1 + M6）

```java
public interface AiModel {
    String providerKey();
    String modelId();
    ModelDescriptor descriptor();
    Set<ModelCapability> capabilities();

    default boolean supports(ModelCapability capability) {
        return capabilities().contains(capability);
    }

    /** 逃生舱（M17）：取底层 SDK client 做 canonical 契约未覆盖的事。
     *  <p>适配器直接返回自身 client；装饰器必须转发给 inner。 */
    default <T> Optional<T> unwrap(Class<T> sdkType) { return Optional.empty(); }
}

public interface ChatModel extends AiModel {
    ChatResponse chat(ChatRequest request);
}

/** 唯一一层派生（M6）：能流式则必然能阻塞（由 collect 兜底） */
public interface StreamingChatModel extends ChatModel {
    Flux<ChatStreamEvent> stream(ChatRequest request);
}

public interface EmbeddingModel extends AiModel {
    EmbeddingResponse embed(EmbeddingRequest request);
}

public interface ImageModel extends AiModel {
    ImageResponse generate(ImageRequest request);
}

public interface VideoModel extends AiModel {
    VideoTask submit(VideoRequest request);          // 异步任务制
    VideoTask poll(String taskId);
}

// M20 已定：新增 SPEECH_TO_TEXT / TEXT_TO_SPEECH；保留 AUDIO 作为聚合展示位
public interface SpeechToTextModel extends AiModel {
    TranscriptResponse transcribe(SpeechToTextRequest request);
}
public interface TextToSpeechModel extends AiModel {
    AudioResponse synthesize(TextToSpeechRequest request);
}
```

### 4.4 配置与元数据（M2）

```java
public interface ModelProvider {
    String providerKey();
    String providerName();
    ProtocolType protocol();
    String baseUrl();
    String apiKey();
    String authHeader();
    Map<String, String> customHeaders();
    Duration timeout();
    Duration connectTimeout();
    ObjectNode extraBody();
    boolean enabled();
    String proxy();
    List<ModelDescriptor> models();      // 元数据列表（不含实例）
    ConfigurationSource source();        // YAML | DATABASE（派生，供 UI 展示）
}

public enum ConfigurationSource { YAML, DATABASE }

public record ModelDescriptor(
        String modelId, String modelName, String description,
        Set<ModelCapability> capabilities,
        Integer contextWindow, Integer maxOutputTokens,
        boolean supportsStreaming, boolean supportsToolCall, boolean supportsVision,
        boolean supportsReasoning, boolean supportsStructuredOutput,
        BigDecimal inputPrice, BigDecimal outputPrice,      // 每百万 token
        BigDecimal defaultTemperature, BigDecimal defaultTopP, Integer defaultTopK,
        ObjectNode extraBody, boolean enabled) {

    /** 三级合并的最低优先级来源；tool/vision/reasoning 等能力位为硬约束，不参与合并 */
    public ChatOptions defaultsAsOptions() { ... }
}
```

### 4.5 查找与装配 SPI（M3 + M19）

```java
/** yaml + DB 合并的唯一实现点（领域侧） */
public interface ModelProviderRegistry {
    List<ModelProvider> providers();
    Optional<ModelProvider> find(String providerKey);
    Optional<ModelDescriptor> findModel(String providerKey, String modelId);

    /** 重新合并 yaml + DB → 新不可变快照；DB 命中 providerKey 时逐字段覆盖 */
    void reload();

    void upsert(ModelProvider provider);     // 写 DB 后触发 reload
    void remove(String providerKey);
}

/** 上层唯一入口：元数据查询 + 实例解析 + 缓存 */
public interface ModelRegistry {
    List<ModelProvider> providers();
    Optional<ModelProvider> findProvider(String providerKey);
    Optional<ModelDescriptor> findModel(String providerKey, String modelId);
    List<ModelDescriptor> listModels();

    AiModel resolve(String providerKey, String modelId);
    <T extends AiModel> T resolve(String providerKey, String modelId, Class<T> type);

    /** 缓存全量失效（M5）；在途运行持有的旧实例继续跑完 */
    void invalidate();
}

/** 造实例（插件可整体替换，M3） */
public interface ModelFactory {
    AiModel create(ModelProvider provider, ModelDescriptor descriptor);
}

/** 横切装饰器（M19）：插件可插入配额/计量/trace/合规 */
public interface ModelDecorator {
    int order();                                  // 越小越靠内（靠近适配器）
    default boolean supports(ModelDescriptor descriptor) { return true; }
    AiModel decorate(AiModel inner, ModelDescriptor descriptor);
}
```

### 4.6 请求与响应

```java
// ── canonical 选项：跨协议可映射的强类型部分 ──
public record ChatOptions(BigDecimal temperature, BigDecimal topP, Integer topK,
                          Integer maxOutputTokens, ReasoningEffort reasoningEffort,
                          Boolean enableCache, ResponseFormat responseFormat,
                          ObjectNode providerOptions) {     // ← M4 厂商透传
    public static final ChatOptions EMPTY = new ChatOptions(null, null, null, null,
            null, null, null, null);
}

public enum ReasoningEffort { MINIMAL, LOW, MEDIUM, HIGH }

public record ResponseFormat(ResponseFormatType type, String jsonSchema) {
    public static ResponseFormat text() { ... }
    public static ResponseFormat jsonObject() { ... }
    public static ResponseFormat jsonSchema(String schema) { ... }
}
public enum ResponseFormatType { TEXT, JSON_OBJECT, JSON_SCHEMA }

public record ChatRequest(
        String sessionId, String runId,
        List<Message> messages,
        List<ToolDefinition> tools,
        String systemPrompt,
        ChatOptions options,
        ObjectNode extraParams) implements AiRequest {
    public static Builder builder() { ... }
}
// ★ previousResponseId 不再是字段：它属于 OpenAI Responses，放在
//   options.providerOptions = {"previous_response_id":"resp_xxx"}（M4）

public record ChatResponse(
        String messageId, String providerKey, String modelId,
        List<ContentPart> parts, List<ToolCall> toolCalls,
        FinishReason finishReason, String rawFinishReason,
        Usage usage, String nativeStateToken,      // Responses 的 response_id，其他协议 null
        long latencyMs, ObjectNode rawProviderPayload) implements AiResponse {}

// ── 流式事件（sealed） ──
public sealed interface ChatStreamEvent extends AiStreamEvent
        permits StreamStarted, TextDelta, ReasoningDelta, ToolCallDelta,
                UsageReported, StreamCompleted, StreamFailed {}

public record StreamStarted(String messageId, long seq,
                            String providerKey, String modelId) implements ChatStreamEvent {}
public record TextDelta(String messageId, long seq, String text) implements ChatStreamEvent {}
public record ReasoningDelta(String messageId, long seq, String text,
                             String signature) implements ChatStreamEvent {}
public record ToolCallDelta(String messageId, long seq, int index, String callId,
                           String functionName, String argumentsFragment) implements ChatStreamEvent {}
public record UsageReported(String messageId, long seq, Usage usage) implements ChatStreamEvent {}

/** 不变量（M12）：本事件必定携带完整消息，上层拿到即可直接用 */
public record StreamCompleted(String messageId, long seq,
                              List<ContentPart> parts, List<ToolCall> toolCalls,
                              FinishReason finishReason, String rawFinishReason,
                              Usage usage, String nativeStateToken) implements ChatStreamEvent {}

public record StreamFailed(String messageId, long seq, ErrorCode errorCode,
                           String message, boolean retryable) implements ChatStreamEvent {}
```

### 4.7 会话与执行（M8 + M9 + M18）

```java
public interface ChatSession {
    // ── 只读 ──
    String id();
    String title();
    String projectId();                 // 可空（D34 不强制挂 project）
    AgentMode agentMode();
    PermissionMode permissionMode();
    String providerKey();
    String modelId();
    List<Message> messages();           // canonical 视图，唯一事实源（M8）
    String nativeStateToken();

    // ── 变更（唯一写入口）──
    void append(Message message);       // 落库 + 入内存 canonical
    void switchModel(String providerKey, String modelId);      // M15：作废 token
    void switchModes(AgentMode agentMode, PermissionMode permissionMode);

    // ── 单飞守卫（M18）──
    RunHandle acquireRun(QueuePolicy policy);
    interface RunHandle extends AutoCloseable { String runId(); void abort(String reason); }

    // ── 派发 ──
    ChatSession fork(int atSeq, String newTitle);
    SessionExport export(ExportOptions options);
}

public enum QueuePolicy { QUEUE, REJECT, CANCEL }

/** 本轮调用的输入（不含用户消息本身 —— 用户消息先 append 到 session，M8/M10） */
public record ChatTurnRequest(List<ToolDefinition> tools,
                              ChatOptions overrides,
                              PermissionMode permissionMode) {}

public interface ChatTurnExecutor {
    ChatResponse execute(ChatSession session, ChatTurnRequest turn);
    Flux<ChatStreamEvent> executeStream(ChatSession session, ChatTurnRequest turn);
}

public interface ChatRequestAssembler {
    ChatRequest assemble(ChatSession session, ChatTurnRequest turn,
                         ModelDescriptor descriptor);
}
```

### 4.8 工具结果双通道（M13）

```java
public record ToolResult(
        String toolCallId, boolean success,
        List<ContentPart> modelParts,       // 进 canonical 历史、发给模型
        ObjectNode displayPayload,          // 只落库 + 推前端，永不进上下文
        String errorCode, String errorMessage,
        long durationMs, boolean truncated) {

    public static ToolResult modelOnly(String callId, List<ContentPart> parts) { ... }
}
```

### 4.9 横切观察者（M14 的接缝）

```java
public interface UsageRecorder {
    void record(UsageRecord record);      // 一个签名覆盖全部模态
}

public interface ModelCallObserver {
    void onCall(AiRequest request, AiResponse response, long durationMs);
    void onError(AiRequest request, AiException error);
}
```

---

## 5. 选项合并与提示词组装

### 5.1 三级合并（Assembler 内部，优先级从低到高）

```
ModelDescriptor 默认值              (defaultTemperature / defaultTopP / defaultTopK /
        ↓                            maxOutputTokens / extraBody)
oc_session.model_options            (会话级覆盖，JSONB)
        ↓
ChatTurnRequest.overrides           (本轮调用，最高)
        ↓
effectiveChatOptions  ──▶ ChatRequest.options
```

**不参与合并的硬约束**（来自 `ModelDescriptor`，用于校验而非取值）：

| 能力位 | 不满足时 |
|---|---|
| `supportsStreaming` 且请求走 `stream()` | `UNSUPPORTED_CAPABILITY` |
| `supportsToolCall` 且 `tools` 非空 | `UNSUPPORTED_CAPABILITY` |
| `supportsReasoning` 且 `reasoningEffort != null` | `UNSUPPORTED_CAPABILITY` |
| `supportsVision` 且消息含 `ImagePart` | `UNSUPPORTED_CAPABILITY` |
| `supportsStructuredOutput` 且 `responseFormat.type != TEXT` | `UNSUPPORTED_CAPABILITY` |

校验由 `CapabilityGuard` 装饰器执行（**请求发出前**，不烧 token，M16 前半）。

### 5.2 providerOptions 组装规则

```java
// Assembler 负责拼装，优先级：
//   ModelDescriptor.extraBody（模型级默认）
//     ↓ 深合并
//   ModelProvider.extraBody（provider 级默认）
//     ↓ 深合并
//   ChatOptions.providerOptions（本轮调用）
//     ↓ 深合并
//   协议专属（如 Responses 的 previous_response_id 由 Executor 在模型切换后决定）
```

`providerOptions` 的校验在适配器的 `OptionsCodec` 内：未知 key 记 WARN 并透传（厂商会新增参数，不该因为框架不认识就拒绝），非法值抛 `INVALID_REQUEST`。

### 5.3 提示词组装

`systemPrompt` 由 Assembler 组装，拼装顺序（后者在前者之后追加）：

1. AgentMode 内置指令（PLAN = 只读规划；BUILD = 执行）
2. 项目级自定义指令（project 上预留，v1 从 `oc_project` 读）
3. 压缩摘要（若本会话已发生压缩，作为最后一段注入）

插件要改这套逻辑 → 替换 `ChatRequestAssembler` 实现（M8 的接缝意义所在）。

---

## 6. 一次 stream 调用的完整时序

```
ChatService / AgentLoop
  │
  1. session.append(Messages.user(parts))              ← 唯一写入口，user 消息先落库
  │
  2. handle = session.acquireRun(QUEUE)                 ← M18 单飞守卫
  │
  3. executor.executeStream(session, turn)              ← M9，返回 Flux
  │
  │    └─ assembler.assemble(session, turn, descriptor) ← M8，只读 session.messages()
  │         · 三级 option 合并（§5.1）
  │         · providerOptions 深合并（§5.2）
  │         · systemPrompt 组装（§5.3）
  │         · 注入 tools + previous_response_id（若无有效 token 则 null）
  │
  │    └─ registry.resolve(providerKey, modelId) : AiModel
  │         命中缓存 → 直接返回装饰链最外层
  │
  │    ┌─────────────────────── 装饰器链（外 → 内）───────────────────────┐
  │    │  [插件装饰器]  QuotaGuard / Metering / Trace / Compliance        │  order 200+
  │    │      ↓                                                          │
  │    │  RetryingChatModel    仅 ErrorCode.retryable=true 退避重试       │  order 100
  │    │      ↓                                                          │
  │    │  CapabilityGuard      声明 vs 请求校验（不通过则不发请求）         │  order 0
  │    │      ↓                                                          │
  │    │  AnthropicChatModel   stream(req)                              │  适配器
  │    │      ├─ RequestMapper  Message[] → MessageParam[]               │
  │    │      ├─ OptionsCodec   providerOptions → thinking/cache_control │
  │    │      ├─ client.messages().createStreaming(...)                  │
  │    │      └─ StreamMapper   SDK 流 → Flux<ChatStreamEvent>（累加）     │  M12
  │    └────────────────────────────────────────────────────────────────┘
  │
  4. 下游消费事件流：
  │     TextDelta / ReasoningDelta  → 直接转发前端（**不落库**）
  │     ToolCallDelta                → 直接转发前端（不落库）
  │     UsageReported                → 更新内存累加
  │     StreamCompleted              → 【收口点】
  │         · session.append(AssistantMessage(parts, toolCalls, usage, token))
  │         · usageRecorder.record(...)
  │         · modelCallObserver.onCall(req, resp, duration)
  │         · 若 AgentLoop：进入工具执行阶段
  │     StreamFailed                 → observer.onError() → 上抛 AiException
  │
  5. handle.close()                                     ← 释放单飞守卫
```

**重试边界（M11 的关键）**：重试只包住第 3 步里的**单次模型调用**。第 4 步的工具执行在第 3 步之外，因此永远不会被重试波及。若在 AgentLoop 层重试，step 内已执行的工具会被重复执行（写文件两遍、commit 两条），这是 explicitly 排除的方案。

**模型切换（M15）**：`switchModel()` 把 `nativeStateToken` 置空；下一次 assemble 时 `previous_response_id` 为 null → 全量重放 canonical 历史；同时落 `oc_agent_event(MODEL_SWITCHED, {from, to, atSeq})`。

---

## 7. 装饰器链与插件扩展点

### 7.1 内置装饰器

| 装饰器 | order | 职责 | 失败行为 |
|---|---|---|---|
| `CapabilityGuard` | 0（最内） | 声明 vs 请求校验（§5.1 表格） | 抛 `UNSUPPORTED_CAPABILITY`，不发请求 |
| `RetryingChatModel` | 100 | 只对 `retryable=true` 退避重试，1s→2s→4s→8s 带抖动 | 耗尽后抛原始 `AiException` |
| `MeteringDecorator`（可选内置） | 200 | 上报 `UsageRecorder` + `ModelCallObserver` | 计量失败不影响主流程（吞异常 + WARN） |

### 7.2 插件扩展点一览

```java
public interface OpenCodingExtension {
    String extensionId();
    default int order() { return 100; }

    /** 注册自定义装饰器：配额、合规前置、trace 注入…… */
    default void contributeDecorators(List<ModelDecorator> decorators) {}
    /** 注册自定义 provider（从 DB/yaml 之外的来源，如远程配置中心） */
    default void contributeProviders(List<ModelProvider> providers) {}
    /** 替换请求组装策略（自定义 systemPrompt / RAG few-shot 注入） */
    default ChatRequestAssembler assembleOverride() { return null; }
    /** 注册工具 / 工具来源（v1.1 的 MCP 也从这里进） */
    default void contributeTools(ToolRegistry registry) {}
}
```

**发现机制（D28）**：`java.util.ServiceLoader`（纯 Java 插件 jar 丢 classpath 即生效）+ Spring `@ConditionalOnMissingBean`（Spring 插件优先级更高，可覆盖默认实现与 DB 实现）。

**逃生舱在装饰链下的可用性**：所有装饰器必须实现 `unwrap` 并转发给 inner：

```java
// RetryingChatModel
@Override public <T> Optional<T> unwrap(Class<T> t) { return delegate.unwrap(t); }
```

否则插件无法透过装饰链拿到底层 SDK client（M17）——这也是「按协议暴露 getter」方案被否决的核心理由。

---

## 8. 设计模式清单

| 模式 | 落点 | 为什么用 |
|---|---|---|
| **Value Object** | `ModelDescriptor` / `ChatOptions` / `ChatRequest` / `ChatResponse` / 流式事件（全部 record） | 不可变 + 可序列化 + 线程安全；跨线程共享无需同步 |
| **Marker Interface（最小化）** | `AiRequest` / `AiResponse` / `AiStreamEvent`（M14） | 给计量/审计/trace 一个覆盖全模态的签名，避免 5 份重载 |
| **Layered Capability Interface** | `StreamingChatModel extends ChatModel extends AiModel`（M6） | 一次 `instanceof` 即可穷举；流式聚合兜底消除「仅流式」死角 |
| **Template Method** | `AbstractChatModel.chat()` = `require()` + `collect(stream())` | 把「校验 + 聚合」骨架固化在基类，子类只实现 `stream()` |
| **Adapter** | `AnthropicChatModel` 等四协议适配器 | 屏蔽协议差异，是整层的存在理由 |
| **Mapper（数据搬运）** | `XxxRequestMapper` / `XxxResponseMapper` / `XxxStreamMapper` | 把易变的厂商字段映射从编排逻辑里剥离，可单独单测 |
| **Accumulator** | `ToolCallAccumulator`（在 `XxxStreamMapper` 内，M12） | 分片 JSON 参数必须累加；把累加态收敛在适配器内 |
| **Codec** | `XxxOptionsCodec`（M4） | `providerOptions` 的 JSON ↔ 强类型读取，非法值在边界拦截 |
| **Strategy** | `ModelDecorator` / `PermissionPolicy` / `ChatRequestAssembler` / `ContextCompactor` / `TokenEstimator` | 可替换算法；插件与测试都能换实现 |
| **Decorator** | `CapabilityGuard` / `RetryingChatModel` / 插件装饰器（M11/M19） | 横切关注与协议实现解耦；可无限叠加、顺序可控 |
| **Chain of Responsibility** | 装饰器链（由 `order()` 排序）+ 权限策略链 | 每个节点可短路（DENY / UNSUPPORTED_CAPABILITY） |
| **Abstract Factory / Factory（SPI）** | `ModelFactory` | 协议 → 实现类的唯一 switch 点；插件可整体替换 |
| **Facade** | `ModelRegistry`（M3） | 上层只认一个入口：元数据查询 + `resolve` + 缓存 + 失效，屏蔽 ProviderRegistry/Factory/Decorator 三方协作 |
| **Registry** | `ModelProviderRegistry` | yaml + DB 双源合并后的统一目录 |
| **Snapshot（Memento）** | `ModelProvider` / `ModelDescriptor` 为不可变快照；`reload()` 整体替换（M5） | 避免「一半旧一半新」；在途请求持旧快照天然一致 |
| **Null Object** | `InMemoryConversationStore` / `NoopUsageRecorder` / `NoopModelCallObserver`（core-implementation） | 让核心逻辑不依赖持久化也能跑（CLI 单机、单测） |
| **Guard Clause** | `CapabilityGuard.require()` | 请求前拦截，避免无效调用烧 token |
| **Escape Hatch / Unwrap** | `AiModel.unwrap(Class<T>)`（M17） | canonical 契约盖不住厂商独有能力时的受控出口，且**在装饰链下仍可用** |
| **Single-Flight Guard** | `ChatSession.acquireRun()`（M18） | 保证同一会话 seq 单调、历史不交错，是可还原现场的前提 |
| **Observer** | `UsageRecorder` / `ModelCallObserver` | 计量与可观测性不侵入主流程 |

---

## 9. 与上一版方案的差异

### 9.1 删除的概念

| 删除项 | 原因 |
|---|---|
| `core-api/model/capable/*`（5 个接口） | 纯中介层，与模态接口表达同一事实（M6） |
| `ModelResolver` | 与 `ModelRegistry` 职责重叠（M3） |
| `AbstractStreamingChatModel` | 与 `AbstractChatModel` 差异仅一个 `stream()` 方法（M7） |
| `MessageBuilder` + `MessageBuilderFactory` 静态 SPI | 不可变记录用工厂类 + `withXxx` 即可（见主方案 §12） |
| `ChatRequest.previousResponseId` | 协议字段，移入 `providerOptions`（M4） |
| `ChatSession.send()/stream()` | 执行归 `ChatTurnExecutor`（M9） |
| `ModelProvider.getModels() : List<AiModel>` | 配置实体不得持有运行时实例（M2） |

### 9.2 新增强化

| 新增项 | 作用 |
|---|---|
| `ChatTurnExecutor` + `ChatRequestAssembler` | 单轮执行与请求组装各成契约，两条调用路径共用（M8/M9） |
| `ModelDecorator` SPI | 企业横切需求（配额/计量/trace/合规）的接缝（M19） |
| `AiModel.unwrap()` | 厂商独有能力的受控出口（M17） |
| `ToolResult.displayPayload` | 类型上保证 UI 载荷不进上下文（M13） |
| `ChatSession.acquireRun()` | 会话单飞，seq 单调（M18） |
| `UsageRecorder` / `ModelCallObserver` | 计量与观测接缝（M14） |
| `ModelCallSnapshot` 落 `oc_agent_run` | 记录本次 run 使用的 provider/model/baseUrl，支撑配置层还原（M5 兼底） |

### 9.3 主方案需同步修改的章节

- §5.1 构造函数注入 → 无（不受影响）
- §5.5 会话（`ChatSession` 去掉 `send/stream`，补 `acquireRun`）
- §5.8 工具（`ToolResult` 双通道）
- §5.10 SPI（补 `ModelDecorator` / `ChatTurnExecutor` / `ChatRequestAssembler`）
- §7.1 AgentLoop（循环体改为调用 `ChatTurnExecutor`）
- §11 M1/M2 验收标准（补类图与契约测试项）

---

## 10. 已确认项与剩余默认项

### 10.1 已确认（原待确认项 1）

| 事项 | 结论 |
|---|---|
| `ModelCapability` 音频粒度 | **M20 已定**：新增 `SPEECH_TO_TEXT` / `TEXT_TO_SPEECH`，**保留 `AUDIO` 作为聚合展示位**；接口侧 `SpeechToTextModel` / `TextToSpeechModel` 独立 |

### 10.2 剩余默认项（不阻塞，按建议执行，可随时推翻）

| # | 事项 | 默认执行 |
|---|---|---|
| 1 | `AudioResponse` 命名（对称 `ImageResponse`） | 采用 `AudioResponse` |
| 2 | `ProtocolType` 中 `COHERE` / `QIANFAN` / `VOLCENGINE_ARK` 无 v1 适配器 | v1 走 `OPENAI_COMPATIBLE` 端点，原生协议 v1.1 |
| 3 | 深合并语义（`ModelDescriptor.extraBody` ← `ModelProvider.extraBody` ← `ChatOptions.providerOptions`） | 对象递归深合并；**数组整体替换**（不拼接，避免重复元素） |
| 4 | `ModelCallObserver` 是否 v1 内置落 `oc_agent_event` | v1 内置默认实现（成本极低、审计价值高） |

---

## 11. 实施顺序（M1/M2 细化）

| 步骤 | 内容 | 验收 |
|---|---|---|
| M1.1 | `error` + `usage` + 三个公共基座 + `model` 接口树（含 `unwrap`） | 编译通过；`core-api` 无 Spring 依赖（`dependency:tree` 验证） |
| M1.2 | `provider` / `ModelDescriptor` / 三个 SPI（`ModelProviderRegistry` / `ModelFactory` / `ModelDecorator` / `ModelRegistry`） | 接口签名冻结，写契约测试（record 相等性、`unwrap` 默认返回 empty） |
| M1.3 | 消息与内容（`Message` sealed + `ContentPart` sealed + `MediaRef` + `Messages` 工厂） | sealed 穷举编译通过；`ContentPartType` 收敛为 6 值 |
| M1.4 | 请求/响应/流式事件（record + sealed，`ChatRequest.Builder`） | `StreamCompleted` 承载完整消息的契约测试 |
| M2.1 | `AbstractAiModel` + `AbstractChatModel`（`collect` 兜底 + `require`） | 用一个假适配器（stub client）验证：只实现 `stream()` 也能跑 `chat()` |
| M2.2 | `CapabilityGuard` + `RetryingChatModel` + `DefaultModelFactory` + `CachingModelRegistry` | 单测：不支持能力时报 `UNSUPPORTED_CAPABILITY` 且不发请求；429 重试 3 次后成功；401 不重试 |
| M2.3 | `AnthropicChatModel` + 4 个 Mapper/Codec | 对真实 key：非流式、流式、tool calling 往返、thinking、用量归一 |
| M2.4 | `OpenAIChatModel`（含 `OPENAI_COMPATIBLE`） | 对 DeepSeek/智谱接一个兼容端点验证「仅换 baseUrl 即可用」 |
| M2.5 | `DefaultChatRequestAssembler` + `DefaultChatTurnExecutor` | 三级合并优先级测试；切换模型后 `previous_response_id` 为 null |
| M2.6 | `DefaultChatSession`（单飞守卫）+ `InMemoryConversationStore` | `QUEUE`/`REJECT`/`CANCEL` 三种策略的并发测试 |

---

## 附录 A：ASCII 原始图（终端可读）

> 正文 §3 的 Mermaid 图在 IDE/GitHub 中渲染；本附录保留手绘 ASCII 版，便于 `cat` / `grep` / 纯文本环境阅读，并保留图中原有的 ★ 注解。

### A.1 类型树（core-api）

```
                        ┌────────────────────────────────────┐
                        │        «interface» AiModel         │
                        │  providerKey()  modelId()          │
                        │  descriptor()   capabilities()      │
                        │  <T> Optional<T> unwrap(Class<T>)   │◀── M17 逃生舱
                        └────────────────┬───────────────────┘
                                         │
        ┌──────────────┬─────────────────┼──────────────────┬───────────────┐
        │              │                 │                  │               │
┌───────▼───────┐ ┌────▼─────────┐ ┌─────▼────────┐ ┌───────▼──────┐ ┌──────▼────────┐
│ «interface»   │ │ «interface»  │ │ «interface»  │ │ «interface»  │ │ «interface»   │
│ ChatModel     │ │ Embedding    │ │ ImageModel   │ │ VideoModel   │ │ SpeechToText  │
│ chat(req)     │ │ Model        │ │ generate(r)  │ │ submit(r)    │ │ /TextToSpeech │
│               │ │ embed(req)   │ │              │ │ poll(id)     │ │ （M20）         │
└───────┬───────┘ └──────────────┘ └──────────────┘ └──────────────┘ └───────────────┘
        │ 唯一一层派生
┌───────▼────────────────┐
│ «interface»            │
│ StreamingChatModel     │
│ stream(req): Flux<..>  │
└────────────────────────┘

请求/响应（record 实现三个公共基座 —— M14）：
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ «interface»      │        │ «interface»      │        │ «interface»      │
│ AiRequest        │        │ AiResponse       │        │ AiStreamEvent    │
│ sessionId()      │        │ providerKey()    │        │ messageId()      │
│ runId()          │        │ modelId()        │        │ seq()            │
│ extraParams()    │        │ usage()          │        └────────▲─────────┘
└────────▲─────────┘        │ latencyMs()      │                 │
         │                  │ rawProviderPayload()│               │
         │                  └────────▲─────────┘                 │
   ChatRequest                 ChatResponse            ChatStreamEvent
   EmbeddingRequest            EmbeddingResponse       （sealed，7 个实现）
   ImageRequest                ImageResponse
   VideoRequest                VideoTask

配置侧（与运行时实例解耦 —— M2）：
┌──────────────────────────┐  models()   ┌──────────────────────────┐
│ «interface»              │────────────▶│ «record» ModelDescriptor │
│ ModelProvider            │             │ 纯元数据：capabilities /  │
│ providerKey / protocol / │             │ contextWindow / prices /  │
│ baseUrl / apiKey /       │             │ limits / features         │
│ authHeader / headers /   │             └──────────────────────────┘
│ timeouts / extraBody /   │
│ proxy / enabled          │  ※ 无 Client、无 AiModel、无 Spring
└──────────────────────────┘
```

### A.2 查找与装配（core-api 契约 + core-implementation 实现）

```
上层代码（AgentLoop / ChatService）只出现这一个：
┌──────────────────────────────────────────────┐
│ «interface» ModelRegistry                    │
│  providers() : List<ModelProvider>           │
│  findModel(providerKey, modelId)             │
│  resolve(providerKey, modelId) : AiModel     │──┐
│  resolve(providerKey, modelId, Class<T>)     │  │ 缓存 (providerKey, modelId)
└───────────────▲──────────────────────────────┘  │
                │ implements                      │
┌───────────────┴──────────────────────────────┐  │
│ CachingModelRegistry  [core-implementation]   │  │
│  clients : Map<providerKey, ClientHandle>     │  │
│  models  : Map<ModelKey, AiModel>             │  │
│  reload() → 两表全量失效（M5）                  │  │
└───────┬──────────────────────────┬────────────┘  │
        │ 元数据                    │ 造实例          │
        ▼                          ▼               │
┌──────────────────────┐  ┌────────────────────────┴──────┐
│ «interface»          │  │ «interface» ModelFactory (SPI) │
│ ModelProviderRegistry│  │  create(provider, modelId, T)  │
│  yaml + DB 合并（M3） │  └───────────┬────────────────────┘
│  reload() / upsert() │              │
└──────────▲───────────┘              ▼
           │                ┌──────────────────────────┐
           │                │ «interface» ModelDecorator│  ← M19 插件扩展点
           │                │  order() supports()       │
           │                │  decorate(inner, desc)    │
           │                └──────────────────────────┘
           │
   ┌───────┴────────┐
   │ yaml / DB 双源  │
   └────────────────┘
```

### A.3 实现树（core-model）

```
AbstractAiModel  [implements AiModel]
  · provider   : ModelProvider      （配置快照）
  · descriptor : ModelDescriptor    （元数据快照）
  · providerKey() / modelId() / capabilities() / descriptor()
  · unwrap(Class<T>) 默认实现：把 client 与请求类型比对
      │
      ├─ AbstractChatModel  [implements ChatModel]
      │    · require(ModelCapability) —— 声明 vs 请求校验（M16 前半）
      │    · collect(Flux<ChatStreamEvent>) : ChatResponse —— 流式聚合兜底（M6）
      │    · chat(req) 默认实现 = collect(stream(req))
      │         │
      │         └─ AnthropicChatModel  [implements StreamingChatModel]
      │              · stream(req) : Flux<ChatStreamEvent>  ← 仅编排，~40 行
      │              ├─ AnthropicClientFactory   provider 单例 client（连接池复用）
      │              ├─ AnthropicRequestMapper   List<Message> → List<MessageParam>
      │              ├─ AnthropicResponseMapper  SDK Message → parts / toolCalls / usage
      │              ├─ AnthropicStreamMapper    SDK 流事件 → Flux（内含 Accumulator，M12）
      │              └─ AnthropicOptionsCodec    providerOptions → thinking / cache_control
      │
      ├─ AbstractEmbeddingModel  └─ OpenAIEmbeddingModel
      ├─ AbstractImageModel      └─ OpenAIImageModel
      └─ AbstractVideoModel      └─ VolcengineVideoModel

★ 新增第 5 个协议 = 新增 5 个小类（Model + 4 个 Mapper/Codec），
  基类、接口、Registry、Factory、上层代码全部零改动。
```

### A.4 调用侧（core-agent + core-implementation）

```
┌───────────────────┐        ┌──────────────────────────┐
│ ChatService       │        │ «interface» AgentLoop     │
│ [application]     │        │ DefaultAgentLoop          │
│ 直连单轮对话       │        │ [core-agent]              │
└─────────┬─────────┘        └────────────┬─────────────┘
          │                               │ 循环 + 工具 + 权限 + 审批 + 压缩
          └───────────────┬───────────────┘
                          ▼
        ┌──────────────────────────────────────────────┐
        │ «interface» ChatTurnExecutor                 │  ← M9
        │  execute(session, turn) : ChatResponse       │
        │  executeStream(session, turn) : Flux<..>     │
        │  ※ 无副作用：不落库、不改 session              │
        └───────────────┬──────────────────────────────┘
                        ▼
        ┌──────────────────────────────────────────────┐
        │ «interface» ChatRequestAssembler  (M8)        │
        │  assemble(session, turn, descriptor)          │
        │          : ChatRequest                        │
        │  · 只读 session.messages()                    │
        │  · 三级 option 合并 + 提示词组装                │
        └───────────────┬──────────────────────────────┘
                        ▼
                 ModelRegistry.resolve() → AiModel

状态侧：
┌────────────────────────────────────────────────────────────┐
│ «interface» ChatSession                                    │
│  只读：id/title/projectId/agentMode/permissionMode/         │
│        providerKey/modelId/messages()                      │
│  变更：append(Message) / switchModel() / switchModes()      │
│  单飞：acquireRun(policy) : RunHandle      ← M18            │
│  派发：fork(atSeq) / export(opts)                           │
│  ※ 没有 send()/stream() —— 执行是 Executor 的事（M9）         │
└────────────────────────────────────────────────────────────┘
                        │ append 是唯一写入口
                        ▼
        ┌──────────────────────────────────────────────┐
        │ «interface» ConversationStore   (SPI)         │
        │  默认：InMemoryConversationStore [implementation]│
        │  DB ：DbConversationStore        [domain]      │
        └──────────────────────────────────────────────┘
```

