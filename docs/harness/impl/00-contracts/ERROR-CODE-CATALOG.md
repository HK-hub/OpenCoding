# 错误码目录（ERROR-CODE-CATALOG）

> **定位**：OpenCoding Harness 全部错误码的**单点权威目录**。所有域内错误码定义（`ModelErrorCode` / `ToolErrorCode` / `SandboxErrorCode` / `SkillErrorCode` / `DistErrorCode` / `SecErrorCode` / `HookErrorCode` / `PluginErrorCode` 等）以本目录为准，散落定义按 §6 处置。
> **冻结落点**：契约层 `harness-contract` 的 `ErrorCode` 枚举（Java 21 `enum`，`code` 为稳定契约，**只增不改义**）；域内枚举降级为「`ErrorCode` 的语义别名集合」，不得脱离本目录扩码。
> **登记版本**：v1 · 2026-09-21。兑现修订建议：`X-82`、`B8`、`X-C27-3`、`X-C28-2/3`、`X-C33-1`、`C07-G1`、`C07-G2`、`C08-G1`、`X-C11-5`、`X-C32-1`、`R-C19-3`。

---

## §1 目的与权威性

### 1.1 为什么需要本目录

Phase B 走查（`reviews/R10-walkthrough.md` §六 B8）结论：全套文档要求「业务失败统一抛 `HarnessException(ErrorCode, 中文文案)`，重试只认 `ErrorCode.retryable`」，但 `ErrorCode` **本身没有定义**——`appendix-b-interface-contracts.md` §B.11 只有一张 40 条码表，无 `retryable` 列、无 Java 枚举形状、无 `code → HTTP / JSON-RPC / 退出码` 映射；X-82 只是缺口指针。后果是：第一个可编译骨架写不出 `HarnessException`，重试装饰器无法判定，全局异常处理器无法映射。

本目录一次补齐：枚举字段（§2）→ 全量码表（§3）→ 重试判定（§4）→ 文案规则（§5）→ 替换清单（§6）→ CI 校验（§7）。

### 1.2 权威性声明（冲突裁决顺序）

1. 本目录 = 错误码的**唯一权威**；任何 impl 文件、组件文档、附录的错误码表与本目录冲突时以本目录为准，并按 §6 修订原文件。
2. **只增不改义**。新增码必须：① 在 §3 登记完整 7 列；② 在 `harness-contract` 枚举落地；③ 补 `docAnchor`（本目录锚点 + 冻结卷册锚点）。
3. 已发布（进入任一 release tag）的码禁止删除与改义；确需弃用 → 枚举项保留并标 `deprecated`，同时在 §6「别名保留」行登记。
4. `retryable` 是**重试唯一判据**（对齐卷 02 D14 与 `agents.md` 第四节）：禁止按异常类型、厂商错误码或文案判定；`retryable=false` 的码失败后**不得产生额外模型调用**（成本可断言）。

### 1.3 散落定义发现摘要（grep 取证）

```bash
grep -rn 'ErrorCode\|Error_Code\|错误码' docs/harness/impl docs/harness/appendix-b-interface-contracts.md
# → 450 行命中，跨 76 个文件（head -50 截断后只见 01/02/03/04/05 局部）
grep -n '错误矩阵\|错误码枚举\|错误码表' docs/harness/impl/*.md
# → 34 份 impl 文件（01–34）各有「错误矩阵」小节；impl/35 仅在端点表散见错误码列
grep -rn 'public enum [A-Za-z]*ErrorCode' docs/harness/impl/*.md
# → 仅 3 处显式 Java 枚举：ModelErrorCode（impl/02 §5.4）、SecErrorCode（impl/27 §5.4）、DistErrorCode（impl/28 §5.4）
```

| 类别 | 位置 | 现状 | 处置 |
| --- | --- | --- | --- |
| 全局核心表 | `appendix-b` §B.11（L180–213） | 40 条码表，无 `retryable` / severity / 枚举形状 | **替换**为「错误模型规则 + 指向本目录的权威指针」 |
| 域内错误矩阵 | `impl/01–34` 各 §⑨/§10.x（34 处） | 码名与文案各自成表，`retryable` 有列但互不交叉校验 | 表体保留（域内呈现口径）；**码集合 / severity / retryable / 恢复动作以本目录为唯一来源** |
| Java 枚举 | `impl/02`（10 项）、`impl/27`（9 项）、`impl/28`（8 项） | 三处各自 `code + desc`，与全局 `ErrorCode` 只有「一一映射」文字承诺 | 降级为别名集合；映射关系由 §3 的码行直接承载 |
| 组件 findings | `C07-G1/G2`、`C08-G1`、`X-C11-5`、`X-C27-3`、`X-C28-2/3`、`X-C32-1`、`X-C33-1`、`R-C19-3` | 发现缺码 / 重名 / 枚举与配置取值不一致 | 全部由 §6 逐条处置 |
| 退出码口径 | `impl/22` §9.1、`impl/34` §9.2（`oc doctor`） | 退出码只在局部定义 | 由 §2.4 三重映射表收口 |

**不纳入本目录的相邻概念**（枚举取值，非错误码）：`CompactionOutcome`（`NOOP`/`TRUNCATED_HEAD`/`EMPTY_SUMMARY`/`INFLATED_TOKENS`/`GUARD_VIOLATION`/`FAILED`）、`ContentTrust`、`EvictionLevel`、审批决策值（`ASK`/`DENY`/`ALLOW_ONCE`/`ALLOW_SCOPE`）、对账状态（`IN_SYNC`/`DIR_MISSING`/`REF_MISSING`）。

---

## §2 错误模型

### 2.1 `ErrorCode` 字段定义（强制）

`harness-contract` 单文件声明，形状固定为「七字段 + `of(String)` 工厂」：

```java
public enum ErrorCode {
    MODEL_TIMEOUT("MODEL_TIMEOUT", 504, ErrorSeverity.ERROR, true,
        "error.model.timeout", RecoveryAction.RETRY, "ERROR-CODE-CATALOG#3");
    // 每项：code, httpStatus, severity, retryable, userMessageKey, recoveryAction, docAnchor
    private final String code; private final int httpStatus; private final ErrorSeverity severity;
    private final boolean retryable; private final String userMessageKey;
    private final RecoveryAction recoveryAction; private final String docAnchor;
    public static ErrorCode of(String code) { /* 线性匹配；未知即抛 HarnessException */ }
}
```

| 字段 | 约束 |
| --- | --- |
| `code` | `^[A-Z][A-Z0-9_]*$`，长度 ≤ 48；与 §3 逐字一致；**DB 与日志只存 code，不存文案** |
| `httpStatus` | 走 §2.4 映射；`4xx` = 调用方可修复，`5xx` = 服务端/依赖侧；`499` 保留给端侧取消 |
| `severity` | §2.2 四档；**同一码在全域 severity 唯一**，不允许域内重定义 |
| `retryable` | §4；`true` 仅表示「**同参数**重试可能成功」，不承诺成功、不授权换模型/换路径 |
| `userMessageKey` | §7.2 命名规则（`error.<域>.<语义>`）；文案本体见 §3 |
| `recoveryAction` | §2.3 七档；一码一动作（多动作在文案里展开，不新增枚举位） |
| `docAnchor` | 本目录锚点 + 冻结卷册节，供追溯 |

### 2.2 `ErrorSeverity`（四档）

| 取值 | 判据 | 日志 | 告警 | 示例 |
| --- | --- | --- | --- | --- |
| `INFO` | **非错误语义**的正常拒绝/幂等命中 | `log.info` | 不告警 | `A2A_IDEMPOTENT_REPLAY`、`SCHEDULE_DUPLICATED`、`CONTEXT_BUDGET_OK` |
| `WARN` | 调用方或用户可自行修复（参数/状态/冲突/限流/配额/审批/业务规则） | `log.warn` | 计指标不告警 | `INVALID_ARGUMENT`、`CONFLICT`、`RATE_LIMITED` |
| `ERROR` | 依赖不可用、内部失败、外部故障、安全阻断（影响主流程但可恢复） | `log.error` + `Throwable` | 阈值告警 | `DEPENDENCY_UNAVAILABLE`、`INTERNAL_ERROR`、`SANDBOX_VIOLATION` |
| `FATAL` | 启动失败、数据损坏、安全红线（越权/逃逸/密钥外泄/跨租户） | `log.error` + `Throwable` | 立即告警（SEV1/SEV2） | `TENANT_CONTEXT_MISSING`、`AUDIT_CHAIN_BROKEN`、`CROSS_TENANT_DENIED` |

### 2.3 `RecoveryAction`（七档，不允许第八档）

| 取值 | 语义 | 端上呈现 | 示例 |
| --- | --- | --- | --- |
| `NONE` | 无动作（信息性） | 提示不阻断 | `SCHEDULE_DUPLICATED` |
| `RETRY` | 同参数退避重试（仅 `retryable=true`） | 「重试」+ 倒计时 | `MODEL_TIMEOUT` |
| `FIX_INPUT` | 改参数/改配置后重试 | 高亮出错字段 | `INVALID_ARGUMENT` |
| `RE_PROMPT` | 回喂模型，由 Agent 换参数/换工具 | 面板提示 + 回喂 | `TOOL_INVALID_ARGUMENTS` |
| `ESCALATE` | 升级人工（审批人/运维/安全值班） | 「申请审批」「联系管理员」 | `APPROVAL_REQUIRED`、`POLICY_LOCKED` |
| `CONTACT_ADMIN` | 仅管理员可解（策略/许可/签名根/配额） | 「联系管理员」+ 策略引用 | `DIST_DOWNGRADE_BLOCKED` |
| `ABORT` | 终止动作/会话（安全优先，无恢复路径） | 冻结 + 取证入口 | `SANDBOX_VIOLATION`、`DLP_BLOCKED` |

### 2.4 三层异常归属与三重映射（兑现 X-82）

| 层带 | 模块 | 异常类型 | 说明 |
| --- | --- | --- | --- |
| 契约层 | `harness-contract` | `HarnessException`（**根**） | 持有 `ErrorCode`；枚举**只在本模块声明** |
| 内核层 | `harness-kernel/kernel-*`（零 Spring） | `HarnessException` + 域内子类 | 子类：`AiException`（模型/适配，D33）、`SandboxException`、`SkillException`、`McpException`、`MemoryException`、`HookException`、`PluginException`、`DistRuntimeException`、`SecRuntimeException`——**全部继承 `HarnessException`，不得平行造根** |
| 外壳层 | `harness-platform/platform-*`、`harness-host/host-*`（Spring） | `BusinessException` | 对齐 `.qoder/rules/exception-handling-rules.md`；同样持有 `ErrorCode` |

**映射规则**：任何一层失败都必须携带 `ErrorCode`；域内子类在出口按 `code` 映射为全局 `ErrorCode`——因域内 code 与全局 code **逐字相同**（见 §3），该映射是**恒等映射**，不存在「翻译表漏配」。全局异常处理器是**唯一**把异常转响应的地方；业务代码禁止 `try-catch` 后自行包装。**例外**：计量/观测上报（`UsageRecorder`/`ModelCallObserver`）失败是有意吞异常 + `WARN`（M19），不适用本规则。

| ErrorCode 分类 | HTTP（管理面 REST） | WS / JSON-RPC 帧 | CLI 退出码 |
| --- | --- | --- | --- |
| `INVALID_ARGUMENT` | `400` | `-32602` + `code` | `2`（`INPUT_ERROR`） |
| `AUTH_REQUIRED` | `401` | `error {recoverable:true}` | `43`（`CONFIG_ERROR`） |
| `PERMISSION_DENIED` / `AUTH_FORBIDDEN` | `403` | `error {code, decisionId}` | `2` |
| `NOT_FOUND` | `404` | `error {code}` | `2` |
| `CONFLICT` / `SCHEDULE_DUPLICATED` | `409` | `error {recoverable:true}` | `1` |
| `POLICY_OVERRIDE_DENIED` / `DLP_BLOCKED` | `403` | `error {code}` | `2` |
| `RATE_LIMITED` / `QUOTA_EXCEEDED` | `429` + `Retry-After` | `error {retryAfterMs}` | `1`（配额另有 `30`/`53`） |
| `UNSUPPORTED_CAPABILITY` / `UNSUPPORTED_PROTOCOL` | `422` | `error {alternatives[]}` | `2` |
| `APPROVAL_REQUIRED` / `APPROVAL_ESCALATED` | `202` + 审批对象 | `approval.requested` 帧 | `1`（需人工） |
| `APPROVAL_EXPIRED` / `APPROVAL_DENIED` / `APPROVAL_UNAVAILABLE` | `409` / `403` | `approval.resolved` 帧 | `1` / `2` |
| `DEPENDENCY_UNAVAILABLE` / `RESOURCE_EXHAUSTED` | `503` | `error {recoverable:true}` | `44`（`LINK_ERROR`）/ `1` |
| `INTERNAL_ERROR` | `500` + `diagnosticsRef` | `error {traceId}` | `1`（`FAILED`） |
| `TENANT_CONTEXT_MISSING` / `CROSS_TENANT_DENIED` | `400` / `403` | `error {code}`（不可重试） | `2` |
| 启动期 `FATAL` 码 | —（无 HTTP） | — | `78`（`EX_CONFIG`） |
| 用户中断 | — | `session.interrupted` | `130`（SIGINT） |
| 无头批处理超限 | — | — | `30` 预算 / `42` 输入 / `53` 预算或轮次 |

**规则**：① 退出码为 CLI 主口径，`code` 供端侧判定（端上**只按 code 分支，禁止按 message 匹配**）；② `error` 帧必带 `traceId` 与 `recoverable`（= `retryable || recoveryAction==ESCALATE`）；③ 帧内 `code` 必须是 §3 登记码，未登记即实现缺陷（§7 校验）。判决顺序：`ErrorCode` 解析 → `severity` 定日志 → `retryable` 写 `recoverable` → `recoveryAction` 定 UI → HTTP/退出码映射 → `traceId` 注入 → 脱敏（§5.3）。

---

## §3 全量错误码总表

> **分组说明**：下表按**域**分块排列（域列有序；块内按定义序）。域前缀与实现模块的对应：通用/上下文/提示词 → `harness-contract` + `kernel-context`/`kernel-prompt`；模型 → `kernel-model`；工具 → `kernel-tool`；权限/沙箱/技能/MCP/记忆/知识 → `kernel-*` 与 `platform-*`；Agent/团队/任务/目标 → `kernel-agent`/`kernel-work`；事件/钩子/插件 → `kernel-event`/`platform-hooks`/`platform-plugin`；持久化/工作区/Git → `platform-*`；CLI/A2A/企业/成本/安全/分发/生态/交互/自动化/智能增强/质量/运维/前沿 → `host-*`/`platform-*`/`kernel-*`（详见各域 §⑨）。
> 列：**域** ｜ **错误码** ｜ **含义** ｜ **severity** ｜ **retryable** ｜ **用户可见文案**（「事实 + 原因 + 动作」三段，完整规则见 §5）｜ **恢复动作** ｜ **出处**。`★` = 本目录新增（须随 §6 同步）；「别名」行的规范码见「恢复动作」列后括注。

| 域 | 错误码 | 含义 | severity | retryable | 用户可见文案 | 恢复动作 | 出处 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 通用 | `INVALID_ARGUMENT` | 参数/枚举/契约字段非法 | WARN | 否 | 请求参数不合法；`<field>` 超出允许范围 `<range>`；按提示收敛后重试 | FIX_INPUT | 附录B §B.11、impl/01 §10.8 |
| 通用 | `NOT_FOUND` | 资源不存在或已归档 | WARN | 否 | 指定对象不存在；`<id>` 未找到或已清理；核对编号或从列表重选 | FIX_INPUT | 附录B §B.11 |
| 通用 | `CONFLICT` | 并发写冲突 / 乐观锁行数 ≠ 1 / 状态漂移 | WARN | 是 | 内容已变更（可能其他端先操作）；已为你刷新；请在新状态下重试 | RETRY | 附录B §B.11 |
| 通用 | `RATE_LIMITED` | 限流（含配额维度） | WARN | 是 | 请求过于频繁；命中 `<dimension>` 限流；等待 `<retryAfterMs>`ms 后重试 | RETRY | 附录B §B.11 |
| 通用 | `INTERNAL_ERROR` | 未预期内部错误（兜底码） | ERROR | 否 | 系统处理失败；已记录诊断引用 `<diagnosticsRef>`；请稍后重试或导出诊断包 | ESCALATE | 附录B §B.11、impl/01 §10.8 |
| 通用 | `UNSUPPORTED_CAPABILITY` | 能力不支持（能力矩阵未声明） | WARN | 否 | 当前对象不支持 `<capability>`；可选替代见 `alternatives`；请显式换路径 | FIX_INPUT | 附录B §B.11（**禁止静默降级**） |
| 通用 | `UNSUPPORTED_PROTOCOL` | 协议版本交集为空 | WARN | 否 | 协议版本不兼容；支持 `<a>`、对方要求 `<b>`；请升级内核或对端 | CONTACT_ADMIN | impl/09 §10.7 |
| 通用 | `DEPENDENCY_UNAVAILABLE` | 外部依赖不可用（模型/存储/网关/对端） | ERROR | 是 | 依赖暂不可用；`<dependency>` 不可达；已自动重试，可继续等待或检查配置 | RETRY | 附录B §B.11 |
| 通用 | `RESOURCE_EXHAUSTED` | 资源超限（CPU/内存/进程/磁盘/窗口） | WARN | 是 | 超出资源上限；`<dimension>` 峰值 `<peak>` > 上限 `<limit>`；调大上限或缩小任务 | FIX_INPUT | 附录B §B.11、impl/07 §10.6 |
| 通用 | `QUOTA_EXCEEDED` | 配额不足（四级取最紧） | WARN | 否 | 额度不足；命中维度 `<scope>`（团队/项目/组织）；申请临时额度或等待周期重置 | ESCALATE | impl/26 §9.5 |
| 通用 | `CANCELLED` | 操作被取消（用户/上游） | INFO | 否 | 操作已取消；由用户或上游发起；可重新发起 | RETRY | impl/02 §5.4、impl/23 §9.2 |
| 通用 | `AUTH_REQUIRED` | 需认证 / 授权已失效 | WARN | 否 | 凭据无效或已失效；可能被吊销或过期；重新授权后重试 | FIX_INPUT | 附录B §B.11、impl/09 §10.7 |
| 通用 | `AUTH_FORBIDDEN` | 已认证但无权（引用/资源越权） | ERROR | 否 | 无权访问该资源；该资源不属于当前主体；如需访问请走授权流程 | ESCALATE | impl/03 §10.6 |
| 通用 | `POLICY_OVERRIDE_DENIED` | 下级试图放宽上级策略 | WARN | 否 | 该设置为强制项；`<scope>` 层级锁定；覆盖请求已被拒绝 | CONTACT_ADMIN | 附录B §B.11 |
| 通用 | `TENANT_CONTEXT_MISSING` | 租户上下文缺失（越权防线） | FATAL | 否 | 请求缺少租户上下文；调用方/网关未注入；已拒绝并留痕 | CONTACT_ADMIN | impl/25 §9.5、impl/01 §10.8 |
| 通用 | `TURN_LIMIT` | 轮次/步数超限 | WARN | 是 | 本轮已达轮次上限；步数 `<used>`/`<limit>`；输入「继续」或调高配额可续跑 | RETRY | impl/22 §9.1 |
| 通用 | `BUDGET_EXCEEDED` | 预算超限（任务/轮次/组织） | WARN | 否 | 已达预算上限；本次需要 `<need>` 超过剩余 `<left>`；提额或缩小范围后续跑 | ESCALATE | impl/26 §9.5、impl/12 §10.10 |
| 通用 | `DEGRADED_MODE` | 能力降级运行（显式标注） | INFO | 否 | 部分能力已降级；`<capability>` 不可用；已门控关闭，恢复后自动重探 | NONE | impl/23 §9.2 |
| 通用 | `PARAM_INVALID`（别名） | 参数非法 → 规范码 `INVALID_ARGUMENT` | WARN | 否 | 同 `INVALID_ARGUMENT` | FIX_INPUT | impl/31/33/34（**废弃名**） |
| 通用 | `FORBIDDEN`（别名） | 权限拒绝 → `PERMISSION_DENIED` | WARN | 否 | 同 `PERMISSION_DENIED` | ESCALATE | impl/33/34（**废弃名**） |
| 通用 | `RESOURCE_NOT_FOUND`（别名） | 资源不存在 → `NOT_FOUND` | WARN | 否 | 同 `NOT_FOUND` | FIX_INPUT | impl/10/33/34（**废弃名**） |
| 通用 | `CONCURRENT_CONFLICT`（别名） | 并发冲突 → `CONFLICT` | WARN | 否 | 同 `CONFLICT` | RETRY | impl/33 §9.5（**废弃名**） |
| 上下文 | `CONTEXT_BUDGET_OK` | 无可压缩空间（NOOP，非错误） | INFO | 否 | 当前无需压缩；水位已在目标线内；继续执行 | NONE | impl/03 §10.6 |
| 上下文 | `CONTEXT_BUSY` | 同会话已有装配在途（未拿到锁） | WARN | 是 | 上下文正在装配中；同会话仅允许一个压缩/装配；稍后自动重试 | RETRY | impl/03 §10.6 |
| 上下文 | `CONTEXT_NOT_FOUND` | 会话不存在或已归档 | WARN | 否 | 会话不存在或已归档；`sessionId=<id>` 未命中；重新 attach 或新建 | FIX_INPUT | impl/03 §10.6 |
| 上下文 | `CONTEXT_COMPACTION_FAILED` | 压缩未生效（摘要空 / 膨胀 / 保真失败） | WARN | 否 | 本次压缩未生效；已回滚到压缩前状态；系统将改走紧预算 | NONE | 附录B §B.11、impl/03 §10.6 |
| 上下文 | `CONTEXT_BREAKER_OPEN` | 压缩熔断中（冷却窗口） | WARN | 是 | 压缩已暂停；冷却剩余 `<n>` 秒；当前使用紧预算保障 | RETRY | impl/03 §10.6 |
| 上下文 | `CONTEXT_FIDELITY_VIOLATION` | 保真校验违规（编辑摘要越界） | WARN | 否 | 编辑后的摘要违反保真约束；命中规则 `<rule>`；已回滚到上一版 | FIX_INPUT | impl/03 §10.6 |
| 上下文 | `CONTEXT_REF_NOT_FOUND` | 外置引用不存在 | WARN | 否 | 引用的外置结果已不可用；未找到 `<ref>`；请重跑原工具生成新引用 | RE_PROMPT | impl/03 §10.6 |
| 上下文 | `CONTEXT_REF_EXPIRED` | 外置引用已过期（保留期到） | WARN | 否 | 引用的外置结果已过期；超出保留期；请重跑原工具 | RE_PROMPT | impl/03 §10.6 |
| 提示词 | `PROMPT_VARIABLE_MISSING` | 必填变量缺失（Fail-Fast） | WARN | 否 | 提示词变量 `<name>` 缺失；来源约束 `<sources>`；补充后重试（不渲染半成品） | FIX_INPUT | impl/04 §10.6 |
| 提示词 | `PROMPT_SEGMENT_CYCLE` | 片段循环引用 / 深度超限 | WARN | 否 | 片段存在循环引用；链路 `<a → b → a>`；请修复引用链 | FIX_INPUT | impl/04 §10.6 |
| 提示词 | `PROMPT_SEGMENT_UNAVAILABLE` | 指令源读失败（可恢复） | WARN | 是 | 指令来源暂不可用；已保留上次已接受内容；来源恢复后自动渲染 | RETRY | impl/04 §10.6 |
| 提示词 | `PROMPT_SEGMENT_REMOVED` | 指令源被显式移除 | WARN | 否 | 项目指令已被移除；来源已删除；已下发替换声明 | NONE | impl/04 §10.6 |
| 提示词 | `PROMPT_OVERRIDE_DENIED` | 覆盖被拒（enforced 层级） | WARN | 否 | 该资产为强制项；层级 `<scope>` 锁定；覆盖请求已被拒绝 | CONTACT_ADMIN | impl/04 §10.6 |
| 提示词 | `PROMPT_EVAL_GATE_FAILED` | 评测门禁不通过（发布阻断） | WARN | 否 | 评测未达门禁；通过率 `<x>` < 基线 `<y>`；修复劣化片段后重新发布 | FIX_INPUT | impl/04 §10.6 |
| 提示词 | `PROMPT_FINGERPRINT_MISMATCH` | 提示词指纹复现不一致 | ERROR | 是 | 该轮提示词指纹与记录不一致；可能存在非幂等片段；已告警并重算 | RETRY | impl/04 §10.6 |
| 提示词 | `PROMPT_ASSET_NOT_FOUND` | 提示词资产 / 版本不存在 | WARN | 否 | 提示词资产不存在；`assetId=<id>` 未命中；请核对资产标识 | FIX_INPUT | impl/04 §10.6 |
| 模型 | `MODEL_AUTH_FAILED` | 凭证无效/过期（刷新后仍失败） | ERROR | 否 | 凭证无效或已过期；`<credentialRef>` 校验未通过；请检查该引用配置 | CONTACT_ADMIN | 附录B §B.11、impl/02 §10.7 |
| 模型 | `MODEL_QUOTA_EXCEEDED` | 提供方额度耗尽 | WARN | 否 | 模型额度已耗尽；提供方返回配额不足；请切换凭证或模型 | ESCALATE | 附录B §B.11 |
| 模型 | `MODEL_CONTEXT_OVERFLOW` | 上下文超窗口 | WARN | 否 | 上下文超出模型窗口；已触发压缩；压缩后可重试一次，二次溢出即失败 | RE_PROMPT | 附录B §B.11、impl/02 §10.7 |
| 模型 | `MODEL_TIMEOUT` | 首字节/流空闲超时 | ERROR | 是 | 模型响应超时；`<endpoint>` 在 `<ms>`ms 内无响应；已自动重试一次 | RETRY | 附录B §B.11 |
| 模型 | `MODEL_UNAVAILABLE` | 端点不可用 / 熔断冷却中 | ERROR | 是 | 模型端点已熔断；冷却剩余 `<n>` 秒；窗口结束后自动半开探测 | RETRY | 附录B §B.11 |
| 模型 | `MODEL_CONTENT_BLOCKED` | 内容被安全策略阻断 | WARN | 否 | 内容被模型安全策略拦截；未自动改写输入；请修改输入后重试 | RE_PROMPT | 附录B §B.11 |
| 模型 | `MODEL_PROTOCOL_ERROR` ★ | 厂商协议畸形 / 响应不可解析 | ERROR | 是 | 模型返回内容无法解析；本次调用已中止；将整请求重试至多一次 | RETRY | **新登 C07-G2**；impl/02 §5.4 |
| 模型 | `MODEL_STREAM_TRUNCATED` ★ | 流中途截断（有部分增量） | WARN | 是 | 响应流中断；连接在 `<seq>` 处断开；已保留已收内容并可重试 | RETRY | **新增**（impl/33 REQ-QA-06 需可断言码） |
| 模型 | `MODEL_EMPTY_RESPONSE` ★ | 空响应（无内容块且无错误） | WARN | 是 | 模型返回空响应；未产出任何内容块；已自动重试一次 | RETRY | **新增**（同上） |
| 工具 | `TOOL_NOT_FOUND` | 未知工具名 / 幻觉名 | WARN | 否 | 工具 `<name>` 不存在；相近候选 `<candidates>`；请改用候选工具 | RE_PROMPT | 附录B §B.11、impl/05 §10.1 |
| 工具 | `TOOL_INVALID_ARGUMENTS` | 参数校验失败（required/类型/enum/format） | WARN | 否 | 参数 `<path>` 期望 `<expected>`；实际 `<actual>`；按提示修正后重试 | RE_PROMPT | impl/05 §10.1（闭环 C08-G1） |
| 工具 | `TOOL_TIMEOUT` | 执行超时 | WARN | 是 | 工具执行超时；已执行 `<ms>` 超过上限；可调大超时或缩小任务 | RETRY | impl/05 §10.1 |
| 工具 | `TOOL_CANCELLED` | 用户/上游取消 | INFO | 否 | 工具调用已取消；由用户中断触发；可重新发起 | RETRY | impl/05 §5.4、§10.1 |
| 工具 | `TOOL_EXECUTION_FAILED` | 执行失败（非参数原因） | ERROR | 否 | 工具执行失败；`<reason>`；请改参数或换工具 | RE_PROMPT | impl/05 §5.4 |
| 工具 | `TOOL_OUTPUT_TOO_LARGE` | 输出超限（已外置） | WARN | 否 | 结果已裁剪；原始 `<bytes>` 字节超出内联阈值；完整内容可分页回读 | NONE | 附录B §B.11、impl/05 §10.1 |
| 工具 | `TOOL_BLOCKED_BY_POLICY` | 权限/钩子阻断 | WARN | 否 | 已被策略拒绝；命中 `<ruleRef>` 或 `decisionId`；如需放行请修改策略 | ESCALATE | 附录B §B.11 |
| 工具 | `STALE_TOOL_CALL` | 陈旧调用（重放命中旧批次） | WARN | 否 | 该调用属于已作废的回复批次；批次已被取代；未执行，请基于最新批次重发 | RE_PROMPT | impl/05 §10.1 |
| 工具 | `ARTIFACT_UNAVAILABLE` | 引用结果不可再读 | WARN | 是 | 引用的结果已过期；保留期已到或引用被回收；请重新执行原工具 | RE_PROMPT | impl/05 §10.1 |
| 工具 | `TOOL_PARAM_INVALID`（别名） | → `TOOL_INVALID_ARGUMENTS` | WARN | 否 | 同 `TOOL_INVALID_ARGUMENTS` | RE_PROMPT | 附录B §B.11（**废弃名**） |
| 工具 | `TOOL_EXEC_TIMEOUT`（别名） | → `TOOL_TIMEOUT` | WARN | 是 | 同 `TOOL_TIMEOUT` | RETRY | 附录B §B.11（**废弃名**） |
| 权限 | `PERMISSION_DENIED` | 决策链拒绝（含敏感集合不可放行） | WARN | 否 | 该操作被拒绝；命中 `<ruleRef>`（`decisionId=<id>`）；如需放行请修改策略 | ESCALATE | 附录B §B.11、impl/06 §10.1 |
| 权限 | `APPROVAL_REQUIRED` | 需人工审批（挂起） | INFO | 否 | 该操作需人工确认；风险级 `<R0–R5>`；请在审批卡片确认或拒绝 | ESCALATE | 附录B §B.11 |
| 权限 | `APPROVAL_TIMEOUT` | 审批超时（通用口径） | WARN | 否 | 审批超时；`<timeout>`s 内未响应；已按策略处置 | ESCALATE | 附录B §B.11、impl/24 §9.1 |
| 权限 | `APPROVAL_EXPIRED` | 审批超时且动作为 `deny` | WARN | 是 | 审批超时已按策略拒绝；`<timeout>`s 内未响应；可重新发起（**不计入用户拒绝**） | RETRY | impl/22 §9.1（R06 修正）、impl/30 §9.5 |
| 权限 | `APPROVAL_ESCALATED` ★ | 审批超时且动作为 `escalate`（已升级） | INFO | 是 | 已升级至上级审批人；`<timeout>`s 内未响应；可继续等待或查看升级对象 | ESCALATE | **新登 X-C11-5**；impl/30 §9.5 |
| 权限 | `APPROVAL_UNAVAILABLE` | 审批通道不可用/无人应答（fail-closed） | ERROR | 是 | 无人应答或通道不可用，已按安全默认拒绝；通道恢复后可重新发起 | ESCALATE | impl/05 §10.1、impl/06 §10.1 |
| 权限 | `APPROVAL_DENIED` | 用户主动拒绝 | INFO | 否 | 该操作已被拒绝；由你或审批人拒绝；可调整动作后重发 | RE_PROMPT | impl/22 §9.1 |
| 权限 | `APPROVAL_FORBIDDEN_SCOPE` | 审批越出授权范围 | WARN | 否 | 审批范围越界；申请范围超出你被授予的额度；请重新申请 | ESCALATE | impl/06 §3.7.x（C11） |
| 权限 | `APPROVAL_INSUFFICIENT` | 审批不足（双人原则未满足） | WARN | 否 | 缺少第二人复核；基线与修复计划需 ≥ 2 人评审；请另一名评审人批准 | ESCALATE | impl/33 §9.5、impl/34 §9.5 |
| 权限 | `APPROVAL_STATE_INVALID` | 审批状态非法（已终结再响应） | WARN | 否 | 该审批已结束；状态已被其他端推进；卡片已转只读 | NONE | impl/06 §3.7.8、impl/23 §9.2 |
| 权限 | `SELF_APPROVAL_DENIED` | 自证裁决被拒（非主管仲裁） | WARN | 否 | 不可自我审批；你的角色不满足独立性要求；请由他人仲裁 | ESCALATE | impl/13 §9.1 |
| 权限 | `POLICY_LOCKED` | 组织锁定层级被下级覆盖尝试 | WARN | 否 | 组织策略为锁定项；层级 `<scope>` 不可放宽；如需变更由管理员发布新版本 | CONTACT_ADMIN | impl/06 §9.1、§10.1 |
| 权限 | `POLICY_INVALID` | 策略体非法（语法/引用） | WARN | 否 | 策略未通过校验；`<field>` 不符合契约；修正后重新提交 | FIX_INPUT | impl/06 §9.1 |
| 权限 | `POLICY_INTEGRITY_VIOLATION` | 策略包签名/哈希校验失败 | ERROR | 否 | 策略包校验失败；签名或哈希不符；已保留上一版本，请管理员重签 | CONTACT_ADMIN | impl/06 §10.1 |
| 权限 | `POLICY_BASELINE_VIOLATION` | 下级设置突破组织基线 | WARN | 否 | 该设置超出组织基线；已被拒绝；请联系管理员 | ESCALATE | impl/25 §9.5 |
| 权限 | `PERM_CONTRACT_VIOLATION` | 决策网关契约违约（fail-closed） | ERROR | 否 | 内部契约异常（已按拒绝处理）；决策输入缺必填字段；已记录并告警 | CONTACT_ADMIN | impl/06 §5.4 |
| 权限 | `DECISION_NOT_FOUND` | 决策记录不存在（解释/重放） | WARN | 否 | 未找到该决策记录；`decisionId=<id>` 不存在或已过期；请刷新后重选 | FIX_INPUT | impl/06 §9.1 |
| 沙箱 | `SANDBOX_UNAVAILABLE` | 隔离档不可用 / 低于降级地板 / 探测失败 | ERROR | 是 | 隔离档不可用；需求 `<tier>`、可达 `<best>`；可选动作 `<remediation>` | FIX_INPUT | 附录B §B.11、impl/07 §10.6 |
| 沙箱 | `SANDBOX_DENIED` | 围栏拒绝（越界写/非白名单出网/建栅失败） | WARN | 否 | 操作超出沙箱边界；`<kind>`：`<path/domain>`；已阻断，请改用区内路径或申请白名单 | ESCALATE | 附录B §B.11、impl/07 §10.6 |
| 沙箱 | `SANDBOX_VIOLATION` | 逃逸迹象 / 凭证外泄（零容忍） | FATAL | 否 | 检测到逃逸迹象，会话已冻结；已上报安全事件；请联系安全值班 | ABORT | 附录B §B.11、impl/07 §10.6 |
| 技能 | `SKILL_MANIFEST_INVALID` | 清单必填缺失/类型非法/未知字段 | WARN | 否 | 技能 `<id>` 清单非法；`<fieldPath>` `<reason>`；已隔离该技能，其余不受影响 | CONTACT_ADMIN | impl/08 §10.5 |
| 技能 | `SKILL_DEPENDENCY_CONFLICT` | 依赖区间交集为空 / 硬循环 | WARN | 否 | 技能 `<id>` 依赖冲突；`<冲突链>`；请修正版本约束 | FIX_INPUT | impl/08 §5.4 |
| 技能 | `SKILL_CAPABILITY_DENIED` | 申请能力未授权 | WARN | 否 | 技能 `<id>` 的能力未授权；`<capability>`；需在安装同意中显式授权 | ESCALATE | impl/08 §5.4 |
| 技能 | `SKILL_SIGNATURE_INVALID` | 签名校验失败（受控作用域） | ERROR | 否 | 技能 `<id>` 签名无效；主体 `<subject>`；已拒绝装载（无「信任本机」开关） | CONTACT_ADMIN | impl/08 §5.4 |
| 技能 | `SKILL_TOOL_MISSING` | 依赖工具当前不可用 | WARN | 是 | 技能 `<id>` 依赖的工具 `<tool>` 不可用；工具恢复后自动可激活 | RETRY | impl/08 §10.5 |
| 技能 | `SKILL_BUDGET_EXCEEDED` | 注入超预算 | WARN | 否 | 技能 `<id>` 超出注入预算；`<tokens>` > 上限；请拆分到 `resources/` | FIX_INPUT | impl/08 §5.4 |
| 技能 | `SKILL_EVAL_BLOCKED` | 评测环境缺失 / 用例 blocked（门禁拒绝发布） | WARN | 是 | 技能 `<id>` 用例无法运行；环境缺失；补齐环境后重跑 | RETRY | impl/08 §10.5 |
| 技能 | `SKILL_DEACTIVATE_FAILED` | 停用未完成（注册残留） | ERROR | 是 | 技能停用未完成；存在未回卷注册；系统将自动重试回卷 | RETRY | impl/08 §10.5 |
| MCP | `MCP_POLICY_DENIED` | 来源完整性校验失败 / 未签名 | ERROR | 否 | MCP 服务器来源未通过完整性校验；已拒绝装载；请改用私有源白名单 | CONTACT_ADMIN | impl/09 §10.7 |
| MCP | `MCP_SCHEMA_UNSUPPORTED` | 工具名/参数投影超出模型侧上限 | WARN | 否 | 服务器工具名无法投影；超长或被保留；已退化为短哈希后缀 | NONE | impl/09 §4.x（`SCHEMA_UNSUPPORTED`） |
| MCP | `MCP_STATE_UNKNOWN` | 服务器状态码未知（禁止回落默认） | ERROR | 否 | 服务器状态异常；未知状态码 `<code>`；该服务器已隔离 | CONTACT_ADMIN | impl/09 §5.x |
| 记忆 | `MEMORY_FILE_INVALID` | 记忆文件格式非法（保留旧索引） | WARN | 否 | 记忆文件 `<topic>` 格式非法；`<reason>`；已保留旧索引，请修复文件 | FIX_INPUT | impl/10 §10.7 |
| 记忆 | `MEMORY_CONFLICT` | 候选与既有记忆语义冲突（挂起） | WARN | 是 | 存在与既有记忆冲突的新候选；已挂起待判定；模型恢复后自动补判 | RETRY | impl/10 §10.7 |
| 记忆 | `MEMORY_DELETE_INCOMPLETE` | 合规删除任一步失败 | ERROR | 是 | 删除未完成；步骤 `<step>` 失败；已登记补偿任务并续跑 | RETRY | impl/10 §10.7 |
| 记忆 | `MEMORY_STATUS_UNKNOWN` | 记忆状态码未知 | ERROR | 否 | 记忆状态异常；未知状态 `<code>`；已拒绝该条目操作 | CONTACT_ADMIN | impl/10 §5.x |
| 知识 | `KB_QUERY_UNAVAILABLE` | 三路召回全失败 | ERROR | 是 | 知识检索暂不可用；三路召回均失败；已退避重试（不返回空结果冒充无知识） | RETRY | impl/11 §10.9 |
| 知识 | `KB_INDEX_NOT_READY` | 索引构建中（首次） | INFO | 是 | 索引构建中；进度 `<p>`%；稍后可用，可查看状态页 | RETRY | impl/11 §10.9 |
| 知识 | `KB_CITATION_GONE` | 引用目标已失效（文件/块被删） | WARN | 否 | 引用目标已不存在；`<citationRef>` 已失效；已降权该引用 | NONE | impl/11 §10.9 |
| Agent | `AGENT_DRIFT_DETECTED` | 目标漂移检测命中 | WARN | 否 | 检测到目标漂移；当前轨迹偏离已确认目标；已暂停并请求决策 | ESCALATE | impl/12 §10.10 |
| Agent | `VERIFICATION_MISSING` | `done` 无验证证据 | WARN | 否 | 完成声明缺少验证证据；未登记可执行证据；已拒绝写入完成态 | RE_PROMPT | impl/12 §10.10 |
| Agent | `SIDE_EFFECT_UNCERTAIN` | 不可判定副作用（恢复期） | ERROR | 否 | 存在不确定的副作用；需人工确认采纳外部状态或回退检查点 | ESCALATE | impl/12 §10.10 |
| Agent | `VERIFICATION_FAILED` | 验证执行失败（证据不成立） | WARN | 是 | 验证未通过；`<validator>` 判定失败；修正后重新验证 | RETRY | impl/14 §8.x |
| Agent | `AGENT_FANOUT_EXCEEDED` ★ | 子 Agent 扇出/嵌套深度超限 | WARN | 否 | 子 Agent 扇出超限；并行上限 `<max>`、深度上限 `<depth>`；请收敛拆分 | FIX_INPUT | **新增**（impl/12 §9.3 有配置项无码） |
| 团队 | `TEAM_EXCEEDED` | 团队级配额/并发超限（配额原因枚举） | WARN | 否 | 团队额度不足；命中团队维度；申请临时额度或等待重置 | ESCALATE | impl/26 REQ-COST-07 |
| 团队 | `A2A_DEPTH_EXCEEDED` | 跨实例成员跳数超限 / 环路 | WARN | 否 | 委派链过深；跳数超限或检测到环路；改为本地成员或拆两层 | FIX_INPUT | 附录B §B.11、impl/13 §9.1 |
| 团队 | `VERIFIER_INDEPENDENCE_DENIED` ★ | 验证者独立性判据不满足（自证） | WARN | 否 | 验证者不具备独立性；与产出者同源；请改派独立验证者 | ESCALATE | **新增**（兑现 C19 `R-C19-3`） |
| 任务 | `TASK_STATE_INVALID` | 非法状态迁移（含跳过验收） | WARN | 否 | 任务状态已变更；当前 `<cur>`、期望 `<expected>`；请刷新后重试 | FIX_INPUT | 附录B §B.11、impl/14 §9.1 |
| 任务 | `TASK_DEPENDENCY_CYCLE` | 依赖建边形成环 | WARN | 否 | 依赖存在环；环路径 `<a → b → a>`；请调整依赖后重试 | FIX_INPUT | 附录B §B.11 |
| 任务 | `TASK_ACCEPTANCE_MISSING` | Task 层缺验收节 / 证据不完整 | WARN | 否 | 缺少验收定义；Task 层无验收节或证据不齐；补齐后重试 | FIX_INPUT | 附录B §B.11、impl/14 §9.1 |
| 目标 | `GOAL_BUDGET_EXHAUSTED` | 目标预算耗尽 | WARN | 否 | 目标预算已耗尽；成本/Token 已达上限；提额或收敛目标后续跑 | ESCALATE | 附录B §B.11 |
| 目标 | `GOAL_DRIFT_DETECTED` | 目标漂移检出（语义判定） | WARN | 否 | 检测到目标漂移；当前产出偏离已确认目标；已暂停并请求决策 | ESCALATE | 附录B §B.11 |
| 目标 | `GOAL_NOT_CONFIRMED` | 目标未确认即被推进 | WARN | 否 | 目标尚未确认；`CLARIFYING` 阶段未完成；请先确认验收标准 | FIX_INPUT | 附录B §B.11 |
| 目标 | `SCHEDULE_PREAUTH_DENIED` | 计划声明外动作触发前静态校验拒绝 | WARN | 否 | 计划未声明该动作；发布/删除/外发需预授权；请调整声明并重走批准 | ESCALATE | 附录B §B.11、impl/15 §9.1 |
| 目标 | `SCHEDULE_CIRCUIT_OPEN` | 熔断打开期间触发 | WARN | 否 | 调度已熔断；连续失败达阈值；需运维确认后重置（授予固定预算） | ESCALATE | 附录B §B.11、impl/15 §9.1 |
| 目标 | `SCHEDULE_DUPLICATED` | 幂等键命中（重复触发） | INFO | 否 | 该计划已触发；幂等键命中；已返回既有运行记录 `<runId>` | NONE | 附录B §B.11、impl/15 §9.1 |
| 事件 | `SCHEMA_REJECTED` | 类型未登记 / 破坏性变更 / 必填缺失 | WARN | 否 | 事件未通过 Schema 校验；`<type>@<version>` 不兼容；请改「新 type / 新 version + 可选字段」 | FIX_INPUT | impl/16 §9.1 |
| 事件 | `REPLAY_DIVERGED` | 回放三要素比对分歧 | WARN | 否 | 回放出现分歧；`<aggregate>@<seq>` 首个分歧字段 `<field>`；可重跑投影重建 | FIX_INPUT | impl/16 §9.1 |
| 事件 | `CROSS_TENANT_DENIED` | 跨租户读取任何事件/资源 | FATAL | 否 | 无权访问该资源；该数据属于其他租户；已记录安全审计（不得重试） | ABORT | 附录B §B.11、impl/16 §9.1 |
| 钩子 | `HOOK_NOT_FOUND` | 定义/绑定/执行记录不存在 | WARN | 否 | 未找到钩子对象；`<id>` 不存在；请刷新列表后重选 | FIX_INPUT | impl/17 §9.1 |
| 钩子 | `HOOK_ORDER_VIOLATION` | 顺序契约被破坏 | ERROR | 否 | 钩子顺序异常；顺序表被改写或装配断言失败；已按发布门禁阻断 | CONTACT_ADMIN | impl/17 §8.x |
| 钩子 | `HOOK_REWRITE_DENIED` | 改写未声明字段 / 下级禁用组织钩子 | WARN | 否 | 改写被拒；字段不在 `rewritableFields` 或为组织强制项；请补齐声明或走审批 | ESCALATE | impl/17 §8.x |
| 钩子 | `HOOK_CONTRACT_VIOLATION` | 决策越权 / 输出非法 / 方向断言失败 | ERROR | 否 | 钩子违反契约；连续触发将进入隔离；请修正实现 | CONTACT_ADMIN | impl/17 §8.x |
| 钩子 | `HOOK_QUARANTINED` | 定义被隔离（硬截止/连续失败） | ERROR | 否 | 钩子已隔离；连续失败达阈值；管理面确认后重新启用（先跑契约测试） | CONTACT_ADMIN | impl/17 §8.x |
| 钩子 | `HOOK_CIRCUIT_OPEN` | 熔断打开期间调用 | WARN | 是 | 钩子已熔断；冷却剩余 `<n>` 秒；冷却后自动半开 | RETRY | impl/17 §8.x |
| 钩子 | `HOOK_TIMEOUT` | 钩子执行超时（按点策略处置） | WARN | 否 | 钩子执行超时；`<hookId>@<point>` 超时；已按逐点失败策略处置 | NONE | impl/17（超时语义） |
| 插件 | `PLUGIN_NOT_FOUND` | 插件/版本/扩展点注册不存在 | WARN | 否 | 插件不存在；`<pluginId>@<version>` 未找到；请刷新列表后重选 | FIX_INPUT | impl/18 §9.1 |
| 插件 | `PLUGIN_VERSION_CONFLICT` | 依赖区间冲突 / 不满足 `kernel.compatible` / 被依赖时卸载 | WARN | 否 | 插件版本冲突；`<冲突建议>`；请按建议禁用、升级、降级或换来源 | FIX_INPUT | impl/18 §9.1 |
| 插件 | `PLUGIN_SIGNATURE_INVALID` | 签名不符 / 信任根不匹配 / 逐文件哈希差异 | ERROR | 否 | 插件签名无效；信任根或哈希不符；请从受信来源重新获取（禁止跳过校验） | CONTACT_ADMIN | impl/18 §9.1 |
| 插件 | `PLUGIN_PERMISSION_DENIED` | 申请超出安装者权限 / 运行期越权 | WARN | 否 | 插件能力未授权；`<capability>` 超出安装者权限；授权位只可收窄 | ESCALATE | impl/18 §9.1 |
| 插件 | `PLUGIN_LOAD_CYCLE` | 依赖图自环 / 互环 / 同 ID 重复装载 | WARN | 否 | 插件依赖成环；环路径 `<a → b → a>`；请调整依赖后重试 | FIX_INPUT | impl/18 REQ-PLG-15 |
| 插件 | `PLUGIN_STALE_HANDLE` | 热重载后旧句柄跨回合调用 | ERROR | 否 | 插件句柄已失效；热重载后旧句柄被调用；框架已自动重新解析，连续出现即缺陷 | CONTACT_ADMIN | impl/18 §9.1 |
| 插件 | `PLUGIN_QUARANTINED` | 扩展点熔断 / 隔离期内调用 | WARN | 是 | 插件已隔离；扩展点熔断中；等待冷却或人工确认 | RETRY | impl/18 §9.1 |
| 插件 | `PLUGIN_UNCLEAN` | 回卷失败 / 残留检测命中 | ERROR | 否 | 插件卸载不彻底；存在残留副作用；请人工确认清理后再启用 | CONTACT_ADMIN | impl/18 §9.1 |
| 插件 | `PLUGIN_DEPENDENCY_CONFLICT`（别名） | → `PLUGIN_VERSION_CONFLICT` | WARN | 否 | 同 `PLUGIN_VERSION_CONFLICT` | FIX_INPUT | 附录B §B.11（**废弃名**） |
| 插件 | `PLUGIN_CIRCUIT_OPEN`（别名） | → `PLUGIN_QUARANTINED` | WARN | 是 | 同 `PLUGIN_QUARANTINED` | RETRY | 附录B §B.11（**废弃名**） |
| 插件 | `PLUGIN_CAPABILITY_DENIED`（别名） | → `PLUGIN_PERMISSION_DENIED` | WARN | 否 | 同 `PLUGIN_PERMISSION_DENIED` | ESCALATE | 附录B §B.11（**废弃名**） |
| 持久化 | `SNAPSHOT_INTEGRITY_FAILED` | 快照校验和不符（防篡改） | ERROR | 否 | 快照校验失败，已拒绝加载；内容哈希与登记值不一致；请重新录制，勿手改入仓文件 | CONTACT_ADMIN | impl/33 §9.5 |
| 持久化 | `PERS_SCHEMA_VERSION_MISMATCH` ★ | Schema 版本集合不匹配（启动门禁） | FATAL | 否 | 启动失败：数据结构版本与程序不一致；请执行 `oc migrate` 或升级程序 | CONTACT_ADMIN | **新增**（impl/19 §9.1 原用 `INTERNAL_ERROR`） |
| 持久化 | `PERS_RECOVERY_NOT_CONVERGED` ★ | 恢复重放未收敛（再次崩溃/数据缺口） | ERROR | 否 | 会话恢复未能收敛；已保留现场；可导出轨迹并人工确认后 rewind | ESCALATE | **新增**（impl/12 §10.10 原用 `INTERNAL_ERROR`） |
| 工作区 | `WORKSPACE_UNAVAILABLE` | 工作区不存在 / 连接不可用 / 探测失败 | ERROR | 是 | 工作区不可用；`<workspaceId>` 连接失败或不存在；已自动重探，可稍后重试 | RETRY | 附录B §B.11、impl/20 §9.1 |
| 工作区 | `WORKSPACE_PATH_DENIED` | 路径围栏拒绝（`..`/符号链接/只读区写） | WARN | 否 | 目标路径超出工作区围栏；`<path>` 被拒；请改用区内路径或申请跨区授权 | ESCALATE | 附录B §B.11、impl/20 §9.1 |
| 工作区 | `WORKSPACE_QUOTA_EXCEEDED` | 磁盘/配额超阈值 | WARN | 是 | 工作区配额已满；`<used>`/`<limit>`；清理或扩容后重试（执行侧已暂停） | ESCALATE | 附录B §B.11、impl/20 §9.1 |
| 工作区 | `WORKSPACE_HOSTKEY_MISMATCH` ★ | SSH 主机密钥不匹配（疑似 MITM） | FATAL | 否 | 主机密钥校验失败，连接已阻断；指纹变化疑似中间人；请人工核对指纹并更新受控 known_hosts | ABORT | **新增**（**兑现 X-C27-3**；impl/20 §10.6） |
| 工作区 | `WORKSPACE_SSH_POLICY_INVALID` ★ | SSH 主机密钥策略配置取值非法（启动校验） | FATAL | 否 | 启动失败：SSH 主机密钥策略取值非法；仅允许 `strict` / `strict-trust-on-first-use`；请修正配置 | FIX_INPUT | **新增**（**兑现 X-C27-3**） |
| Git | `GIT_CONFLICT` | 预检/执行期合并冲突（含语义强制人工） | WARN | 否 | 合并冲突：`<文件>`；类型 `<content/lock/binary>`；请在工作台解决后重新入队 | ESCALATE | 附录B §B.11、impl/21 §9.1 |
| Git | `GIT_PROTECTED_BRANCH` | 直推 / force push 保护分支 | WARN | 否 | 保护分支禁止直接推送；`<branch>` 在保护清单；请开分支并提 PR | FIX_INPUT | 附录B §B.11、impl/21 §9.1 |
| Git | `GIT_DANGEROUS_BLOCKED` | 危险操作未确认 / 令牌过期 / 仓库内容试图成为执行面 | WARN | 否 | 危险操作已被拦截；未确认或令牌已过期，或仓库 hooks/filter 试图成为执行面；请重新发起确认 | ESCALATE | **规范化**（旧名 `DANGEROUS_OPERATION_DENIED`，X-C28-3） |
| Git | `GIT_SECRET_DETECTED` | 提交扫描命中密钥/大文件 | WARN | 否 | 提交被拦截；命中密钥或超大文件规则 `<ruleId>`；请移除敏感内容后重试 | FIX_INPUT | 附录B §B.11（**语义归位**） |
| Git | `GIT_SCAN_UNAVAILABLE` | 扫描规则源加载失败（fail-closed） | ERROR | 是 | 提交扫描不可用；规则集加载失败；已按安全默认拒绝提交，请修复规则源后重试 | RETRY | impl/21 §9.1（旧名 `SCAN_UNAVAILABLE`） |
| Git | `GIT_PREFLIGHT_NOT_CONFIGURED` ★ | 预检命令缺失（仓库级与全局皆无） | WARN | 否 | 预检命令未配置；仓库 `.oc/ci.yaml` 与全局配置均缺失；请在入队前配置 | FIX_INPUT | **新登 X-C28-2**（旧名 `PREFLIGHT_NOT_CONFIGURED`） |
| CLI | `INPUT_ERROR` | 参数非法 / 深链签名或 nonce 校验失败 | WARN | 否 | 输入不合法；`<field>` 校验失败；请修正参数后重试（脚本按退出码 2 分支） | FIX_INPUT | impl/22 §9.1 |
| CLI | `CONFIG_ERROR` | 配置缺失或非法 / 键位覆盖冲突 | WARN | 否 | 配置不可用；`<key>` 缺失或非法；请 `oc config` 修正后重试 | FIX_INPUT | impl/22 §9.1 |
| CLI | `LINK_ERROR` | 内核不可达 / 协议版本不兼容 | ERROR | 是 | 内核连接失败；不可达或协议不兼容；正在自动重连，可用 `oc doctor` 诊断 | RETRY | impl/22 §9.1 |
| CLI | `FAILED` | 其他执行失败（域码透传兜底） | ERROR | 否 | 执行失败；`<code>`；请按错误码对应的恢复动作处置（禁止按 message 判断） | ESCALATE | impl/22 §9.1 |
| A2A | `A2A_CALLER_UNAUTHORIZED` | 认证失败 / scope 不足 / Card 签名无效 | ERROR | 否 | 调用方未通过认证；scope 不足或 Card 签名无效；请轮换凭证或修正 scope（不得重试） | CONTACT_ADMIN | 附录B §B.11、impl/24 §9.1 |
| A2A | `A2A_IDEMPOTENT_REPLAY` | 幂等键命中且载荷一致（非错误语义） | INFO | 否 | 该任务已受理；幂等键命中；已返回既有 `taskId`，请直接读取结果 | NONE | 附录B §B.11、impl/24 §9.1 |
| 企业 | `SSO_STATE_INVALID` | 登录 `state` 过期或已消费（重放） | WARN | 否 | 登录状态已失效；`state` 过期或已被使用；请重新发起登录 | FIX_INPUT | impl/25 §9.5 |
| 企业 | `SCIM_CONFLICT` | SCIM 邮箱重复 / 组缺失 | WARN | 否 | 同步存在冲突条目；需人工裁决；游标不推进并列出冲突清单 | ESCALATE | impl/25 §9.5 |
| 企业 | `DLP_BLOCKED` | DLP 命中出站规则 | FATAL | 否 | 命中数据外发规则，已阻断；出站内容含受控字段；请按脱敏建议修改后重试 | ABORT | 附录B §B.11、impl/25 §9.5 |
| 企业 | `RESIDENCY_VIOLATION` | 请求超出数据驻留区域 | FATAL | 否 | 该操作超出数据驻留区域；路由目标不在允许区；请申请跨区放行 | ABORT | impl/25 §9.5 |
| 企业 | `AUDIT_CHAIN_BROKEN` | 审计链校验失败（SEV1） | FATAL | 否 | 审计完整性校验失败；哈希链出现断点；已冻结分区写并取证，请联系安全值班 | ABORT | impl/25 §9.5 |
| 企业 | `MFA_REQUIRED` | 管理写操作缺 MFA | WARN | 否 | 需要二次验证；该操作要求 step-up；完成 MFA 后重试（当前无副作用） | FIX_INPUT | 附录B §B.11、impl/25 §9.5 |
| 企业 | `ECO_INTEGRITY_FAILED` ★ | 包完整性校验失败（信任根不匹配） | ERROR | 否 | 包完整性校验失败；信任根或摘要不符；已拒绝装载并留痕 | CONTACT_ADMIN | **新登 X-C32-1**（impl/29 §9.4/§9.5） |
| 成本 | `TRUNCATED_BUDGET` | 流式中途触达硬上限（输出已落库） | WARN | 否 | 已达任务预算上限；输出已中止并落库；提高预算后可续跑 | ESCALATE | impl/26 §9.5 |
| 成本 | `BUDGET_PAUSED` | 预算耗尽导致自治任务暂停 | WARN | 否 | 自治任务已暂停；预算耗尽；提额后自动恢复 | ESCALATE | impl/15 §9.1 |
| 成本 | `COST_METERING_DEGRADED` ★ | 计量上报降级（观测侧有意吞异常） | WARN | 否 | 计量数据暂缺；观测写入失败已降级；不影响执行，恢复后补齐 | NONE | **新增**（M19 口径显式化） |
| 安全 | `SEC_CREDENTIAL_NOT_FOUND` | 凭据引用不存在 / 已销毁 | WARN | 否 | 指定的凭证引用不存在；`secretRef=<ref>` 未命中；请核对引用 | FIX_INPUT | impl/27 §5.4、§9.5 |
| 安全 | `SEC_STORE_UNAVAILABLE` | 密钥服务 / KMS 不可用（敏感操作 fail-closed） | ERROR | 是 | 密钥服务暂不可用；敏感操作已阻断；稍后重试或联系管理员 | RETRY | impl/27 §5.4 |
| 安全 | `SEC_ROTATION_CONFLICT` | 轮换并发冲突 / 引用已存在 | WARN | 是 | 该凭证正在轮换中；并发冲突已被锁串行化；稍后重试 | RETRY | impl/27 §5.4 |
| 安全 | `SEC_ROTATION_FAILED` | 轮换失败（旧密钥保留） | ERROR | 是 | 密钥轮换失败；旧密钥已保留；可重试或联系管理员 | RETRY | impl/27 §5.4 |
| 安全 | `SEC_LEASE_DENIED` | 凭据租约未授权（能力/域名不在白名单） | WARN | 否 | 凭据租约被拒；能力或目标域名不在白名单；请申请白名单 | ESCALATE | impl/27 §5.4 |
| 安全 | `SEC_LEASE_ACTIVE` | 活跃租约未清即销毁 | WARN | 否 | 该凭证仍有活跃租约；无法销毁；请先撤销租约 | FIX_INPUT | impl/27 §5.4、§9.5 |
| 安全 | `SEC_RULEPACK_INVALID` | 规则包签名或语法非法 | ERROR | 否 | 规则包校验失败；签名或语法不符；已拒绝加载并回退内置基线包 | CONTACT_ADMIN | impl/27 §5.4、§9.5 |
| 安全 | `SEC_BOUNDARY_FAILED` | 信任边界校验失败 | FATAL | 否 | 信任边界校验失败；跨边界调用未通过校验；已阻断并告警 | ABORT | impl/27 §5.4 |
| 安全 | `SEC_CONTRACT_VIOLATION` | 安全契约违例（未知枚举，禁止回落默认） | ERROR | 否 | 请求含非法枚举值；安全域不接受默认回落；已拒绝并记录 | FIX_INPUT | impl/27 §5.4、§9.5 |
| 安全 | `SEC_COMMAND_BLOCKED` | 命令命中硬拦截 | WARN | 否 | 该命令命中高危模式已被拦截；规则 `<ruleId>`；请改用安全等价命令 | FIX_INPUT | impl/27 §9.5 |
| 分发 | `DIST_SIGNATURE_INVALID` | 元数据/制品签名校验失败 | ERROR | 否 | 更新包校验失败，已拒绝；签名或信任根不符；请联系管理员核对私仓 | CONTACT_ADMIN | impl/28 §5.4、§9.6 |
| 分发 | `DIST_MANIFEST_EXPIRED` | 更新元数据过期（禁止降级为无签名） | WARN | 是 | 更新元数据已过期；超出有效期或时钟偏移；请稍后重试或使用离线介质 | RETRY | impl/28 §5.4（**统一名**，旧名 `DIST_METADATA_EXPIRED`） |
| 分发 | `DIST_DIGEST_MISMATCH` | 制品摘要不符（已回退全量） | WARN | 是 | 制品哈希不符；校验值不一致；已丢弃并回退全量下载 | RETRY | impl/28 §5.4 |
| 分发 | `DIST_DOWNGRADE_BLOCKED` | 防降级拦截 | WARN | 否 | 目标版本低于当前版本，已拒绝；紧急回退请走审批豁免 | CONTACT_ADMIN | impl/28 §5.4、§9.6 |
| 分发 | `DIST_VERSION_PINNED` ★ | 版本被企业策略钉扎 | WARN | 否 | 该版本不在企业允许范围内；被锁定策略过滤；请查看组织更新策略 | CONTACT_ADMIN | **新登 X-C33-1** |
| 分发 | `DIST_POLICY_CONFLICT` | 企业锁定与候选不可满足 | WARN | 否 | 候选版本与企业策略冲突；锁定与通道设置不可同时满足；请检查策略 | CONTACT_ADMIN | impl/28 §5.4 |
| 分发 | `DIST_DELTA_MISMATCH` ★ | 差分应用哈希不符（已切全量） | WARN | 是 | 增量包校验失败；差分摘要不符；已自动切换全量下载（不重试差分） | RETRY | **新登 X-C33-1** |
| 分发 | `DIST_STAGING_FAILED` ★ | 暂存失败（空间不足/文件占用） | WARN | 是 | 更新准备失败；空间不足或文件被占用；请释放空间后重试（当前版本保留） | FIX_INPUT | **新登 X-C33-1** |
| 分发 | `DIST_HEALTHCHECK_FAILED` ★ | 新版本健康检查失败（自动回滚） | ERROR | 否 | 新版本健康检查失败；已自动回滚 ≤ 2 分钟；迁移不可回滚时转人工 | ESCALATE | **新登 X-C33-1** |
| 分发 | `DIST_LICENSE_EXPIRED` | 许可过期且宽限耗尽（进入只读） | WARN | 否 | 许可已过期，当前为只读模式；可继续读取与导出；请续期或导入离线延期包 | CONTACT_ADMIN | impl/28 §5.4、§9.6 |
| 分发 | `DIST_SEAT_LIMIT_REACHED` ★ | 活跃席位达上限 | WARN | 否 | 活跃席位已达上限；无法激活新成员；请释放席位（既有会话不中断） | CONTACT_ADMIN | **新登 X-C33-1** |
| 分发 | `DIST_CONSENT_REQUIRED` | 遥测同意缺失（编码缺陷，不应运行期出现） | ERROR | 否 | 未获得对应级别遥测同意，已丢弃数据；属实现缺陷；请上报 | CONTACT_ADMIN | impl/28 §5.4 |
| 分发 | `DIST_CONTRACT_VIOLATION` | 未知通道/枚举，禁止回退 stable | ERROR | 否 | 分发契约违例；未知通道或枚举值；已显式失败（禁止回退默认通道） | CONTACT_ADMIN | impl/28 §5.4 |
| 分发 | `LICENSE_GRACE` | 许可宽限期内（警告，非失败） | INFO | 否 | 许可已进入宽限期；剩余 `<days>` 天；请及时续期（功能暂不受限） | CONTACT_ADMIN | 附录B §B.11 |
| 分发 | `LICENSE_EXPIRED_READONLY`（别名） | → `DIST_LICENSE_EXPIRED` | WARN | 否 | 同 `DIST_LICENSE_EXPIRED` | CONTACT_ADMIN | 附录B §B.11（**废弃名**） |
| 分发 | `LICENSE_SEAT_EXCEEDED`（别名） | → `DIST_SEAT_LIMIT_REACHED` | WARN | 否 | 同 `DIST_SEAT_LIMIT_REACHED` | CONTACT_ADMIN | impl/28 §9.6（**废弃名**） |
| 分发 | `UPDATE_SIGNATURE_INVALID`（别名） | → `DIST_SIGNATURE_INVALID` | ERROR | 否 | 同 `DIST_SIGNATURE_INVALID` | CONTACT_ADMIN | 附录B §B.11（**废弃名**） |
| 分发 | `UPDATE_PRECHECK_FAILED`（别名） | → `DIST_VERSION_PINNED` + `DIST_POLICY_CONFLICT` | WARN | 否 | 更新预检未通过；可能被钉扎或被策略过滤；请查看组织更新策略 | CONTACT_ADMIN | 附录B §B.11（**废弃名**） |
| 分发 | `UPDATE_ROLLED_BACK`（别名） | → `DIST_HEALTHCHECK_FAILED` | ERROR | 否 | 同 `DIST_HEALTHCHECK_FAILED` | ESCALATE | 附录B §B.11（**废弃名**） |
| 生态 | `ECO_SDK_DRIFT` | 生成物与契约不一致（合并已阻断） | ERROR | 否 | 生成物与契约不一致，已阻断合并；存在未重跑生成或手改；请重跑生成或撤销手改 | FIX_INPUT | impl/29 §9.5 |
| 生态 | `ECO_VERSION_INCOMPATIBLE` | 包与内核版本不兼容 | WARN | 否 | 该包与当前内核版本不兼容；兼容区间 `<range>`；请升级内核或改用兼容版本 | FIX_INPUT | impl/29 §9.5 |
| 生态 | `ECO_IMPORT_PARTIAL` | 导入部分完成（失败项已回滚） | WARN | 否 | 部分导入完成；失败项已回滚并生成报告；请查看报告修复后重试 | FIX_INPUT | impl/29 §9.5 |
| 生态 | `ECO_DEEPLINK_INVALID` | 深链签名/时效/nonce 失败（对外不区分原因） | WARN | 否 | 链接无效或已过期；可能过期、被撤销或签名不符；请去应用内查看 | FIX_INPUT | impl/29 §9.5 |
| 交互 | `UX_COPY_KEY_MISSING` | 文案键缺失（构建期阻断） | ERROR | 否 | （端上显示兜底文案，不显示键名）；语言包缺键 `<key>`；已记违规计数 | CONTACT_ADMIN | impl/30 §9.6 |
| 交互 | `UX_PRESENTATION_DEGRADED` | 呈现元数据缺失（降级渲染） | INFO | 否 | （卡片角落标「渲染已简化」）；缺少展示元数据；已退化为纯文本 + 时长 | NONE | impl/30 §9.5 |
| 交互 | `UX_SHARE_TOKEN_INVALID` | 分享令牌无效/过期（不泄露会话是否存在） | WARN | 否 | 链接无效或已过期；可能已过期或被撤销；请联系分享人重新生成 | FIX_INPUT | impl/30 §9.5 |
| 交互 | `UX_FIRSTRUN_STEP_FAILED` | 首次运行某步失败（原子提交，不写半成品） | WARN | 否 | 该步骤未完成；`<cause>`（如凭证 401）；已回到该步，修正后直接重试 | FIX_INPUT | impl/30 §9.5 |
| 自动化 | `AUTO_SIGNATURE_INVALID` | 模板/导出包签名无效 | ERROR | 否 | 模板签名无效；来源未通过校验；已拒绝装载 | CONTACT_ADMIN | impl/31 §9.1（旧名 `SIGNATURE_INVALID`） |
| 自动化 | `AUTO_COMPAT_BLOCKED` | 模板与内核/依赖不兼容 | WARN | 否 | 模板不兼容；`kernel_range` 不满足；请改用兼容版本 | FIX_INPUT | impl/31 §9.1（旧名 `COMPAT_BLOCKED`） |
| 自动化 | `AUTO_PACKAGE_VIOLATION` | 包结构/内容违规 | WARN | 否 | 模板包结构违规；缺少清单或含禁止内容；请按报告修正后重新打包 | FIX_INPUT | impl/31 §9.1（旧名 `PACKAGE_VIOLATION`） |
| 自动化 | `AUTO_LINT_BLOCKED` | 模板校验未通过（门禁） | WARN | 否 | 模板校验未通过；字段 `<field>` 不符合契约；按报告修正后重新装载 | FIX_INPUT | impl/31 §9.4 |
| 自动化 | `AUTO_DRYRUN_TIMEOUT` | 试运行超时 | WARN | 是 | 试运行超时；`<ms>` 内未完成；可缩小样例或稍后重试 | RETRY | impl/31 §9.1（旧名 `DRYRUN_TIMEOUT`） |
| 自动化 | `AUTO_PREAUTH_DENIED` | 实例创建超出预授权声明 | WARN | 否 | 动作未在预授权范围内；声明外动作被拒；请调整声明或走审批 | ESCALATE | impl/31 §9.1（旧名 `PREAUTH_DENIED`） |
| 自动化 | `AUTO_TAKEOVER_NOT_ALLOWED` | 接管动作在当前状态不允许 | WARN | 否 | 当前状态不可接管；运行已终态或未挂起；请刷新状态后重试 | FIX_INPUT | impl/31 §9.1（旧名 `TAKEOVER_NOT_ALLOWED`） |
| 自动化 | `AUTO_RUN_NOT_FOUND` | 模板/实例/运行不存在 | WARN | 否 | 运行对象不存在；`<runId>` 未找到；请从运行列表重选 | FIX_INPUT | impl/31 §9.1 |
| 智能增强 | `INTEL_CAPABILITY_NOT_FOUND` | 能力未注册 | WARN | 否 | 该能力不可用；`<capabilityId>` 未注册；可改用 `oc ai list` 中的其他能力 | FIX_INPUT | impl/32 §9.5 |
| 智能增强 | `INTEL_FEATURE_DISABLED` | 能力被管理员策略禁用 | WARN | 否 | 该能力已禁用；企业策略或用户设置关闭；联系管理员开通 | CONTACT_ADMIN | impl/32 §9.5 |
| 智能增强 | `INTEL_SUBJECT_STALE` | 主体已变更（漂移，预扣释放） | WARN | 是 | 内容已更新；主体摘要与运行时不一致；刷新后基于最新版本重试 | RETRY | impl/32 §9.5 |
| 智能增强 | `INTEL_BUDGET_EXCEEDED` | 预算耗尽（BLOCKED 可续跑） | WARN | 否 | 已达预算上限；本次需要 `<need>` 超过剩余 `<left>`；提额或缩范围后续跑 | ESCALATE | impl/32 §9.5 |
| 智能增强 | `INTEL_EVIDENCE_INSUFFICIENT` | 引用证据不足（问答拒答，非 HTTP 错误） | INFO | 否 | 依据不足，无法回答；检索未命中可引用片段；缩小范围或指定文件路径后再问 | RE_PROMPT | impl/32 §⑨.4 |
| 智能增强 | `INTEL_THREAD_CLOSED` | 审查线程已关闭 | WARN | 否 | 该线程已关闭；已归档或轮次耗尽；可新建线程发起新一轮修复 | FIX_INPUT | impl/32 §9.5 |
| 智能增强 | `INTEL_THREAD_BLOCKED` | 审查线程阻塞（需人工接手） | ERROR | 否 | 该线程需人工接手；复验连续失败；已暂停自动重试 | ESCALATE | impl/32 §9.5 |
| 智能增强 | `INTEL_WORKSPACE_UNAVAILABLE` | 隔离环境（worktree）不可用 | ERROR | 是 | 隔离环境暂不可用；worktree 创建失败或不可写；可稍后重试或改用 patch 提案 | RETRY | impl/32 §9.5 |
| 智能增强 | `INTEL_GATE_UNAVAILABLE` | 门禁链自身不可用（fail-closed） | ERROR | 是 | 产出暂不可发布；校验组件不可用；产出留草稿且不进入他人视野 | RETRY | impl/32 §9.5 |
| 智能增强 | `INTEL_SPEC_AMBIGUOUS` | 迁移规格存在歧义 | WARN | 否 | 迁移规格存在歧义；`<items>` 无法唯一判定；补全规格后重新启动 | FIX_INPUT | impl/32 §9.5 |
| 智能增强 | `INTEL_RUN_NOT_RESUMABLE` | 运行状态不支持续跑 | WARN | 否 | 该运行不支持续跑；当前状态 `<state>`；可新建运行或对失败部分单独重跑 | FIX_INPUT | impl/32 §9.5 |
| 智能增强 | `INTEL_RUN_NOT_CANCELLABLE` | 运行状态不支持取消（已终态） | WARN | 否 | 该运行不支持取消；已进入终态；已发布产出保留，可局部重跑 | FIX_INPUT | impl/32 §9.5 |
| 智能增强 | `INTEL_ARTIFACT_NOT_FOUND` | 产出/草稿不存在 | WARN | 否 | 产出不存在；`<artifactId>` 未找到或已清理；请刷新后重选 | FIX_INPUT | impl/32 §8.x |
| 质量 | `EXPECTED_OUTPUT_MISSING` | 期望输出未录制（拒绝刷新） | WARN | 否 | 期望输出不存在，无法刷新；该用例尚未录制；先执行 `oc qa snapshot record` | FIX_INPUT | impl/33 §9.5 |
| 质量 | `GATE_INPUT_INCOMPLETE` | 门禁输入不完整（不猜类型） | WARN | 否 | 门禁输入缺失；缺少变更区间或变更类型；补齐输入后重新评估 | FIX_INPUT | impl/33 §9.5 |
| 质量 | `QA_CONCURRENT_RUN`（别名） | → `CONFLICT`（同任务并发运行） | WARN | 否 | 该任务已在运行中；同一任务不允许并行；等待既有运行或查看其结果 | RETRY | impl/33 §9.5（**废弃名**） |
| 质量 | `QA_SNAPSHOT_OVER_QUOTA` ★ | 快照仓超限（分层降级） | WARN | 是 | 快照仓已超限；已达上限 `<bytes>`；已降级为对象存储分层，接口不变 | NONE | **新增**（impl/33 §⑩.3 有配额无码） |
| 质量 | `QA_BASELINE_NOT_APPROVED` | 基线缺少第二人审批 | WARN | 否 | 基线缺少第二人审批；基线变更需 ≥ 2 人评审；请另一名评审人批准 | ESCALATE | impl/33 §9.5（`APPROVAL_INSUFFICIENT` 的语义位） |
| 运维 | `PROBE_THROTTLED` | 深度探针被限流（保护依赖） | WARN | 是 | 探针已被限流；短时间重复调用超过配额；请稍后重试 | RETRY | impl/34 §9.2 |
| 运维 | `RUNBOOK_UNVERIFIED` | Runbook 未通过验证 | WARN | 否 | 该 Runbook 未经验证；最近验证记录缺失或过期；请先验证或改用已验手段 | FIX_INPUT | impl/34 §9.2 |
| 运维 | `ENVIRONMENT_FORBIDDEN` | 环境不允许该操作（生产破坏性步骤） | FATAL | 否 | 生产环境禁止破坏性步骤；命中环境标记；请在预发验证后走变更流程 | ABORT | impl/34 §9.2 |
| 运维 | `REVIEWER_REQUIRED` | 缺第二人复核 | WARN | 否 | 修复计划缺少复核；需第二人批准；请补复核后执行 | ESCALATE | impl/34 §9.2 |
| 运维 | `DRY_RUN_MISSING` | 未先 dry-run 即执行 | WARN | 否 | 该计划未执行 dry-run；安全前置未满足；请先 dry-run 再执行 | FIX_INPUT | impl/34 §9.2 |
| 运维 | `IMPROVEMENT_KIND_REQUIRED` | 复盘缺改进项类型 | WARN | 否 | 复盘缺少改进项类型；字段必填缺失；请补齐后提交 | FIX_INPUT | impl/34 §9.2 |
| 运维 | `OPS_DESTRUCTIVE_FORBIDDEN` | 生产环境破坏性步骤（双保险拒绝） | FATAL | 否 | 生产环境禁止破坏性步骤；配置 + 环境标记双保险拒绝；请改预发验证 | ABORT | impl/34 §9.5 |
| 运维 | `OPS_REPAIR_VERIFY_FAILED` | 修复未通过校验（已自动回滚） | ERROR | 否 | 修复未通过校验，已自动回滚；校验 `<check>` 失败；请查看回滚报告 | ESCALATE | impl/34 §9.5 |
| 运维 | `OPS_ALERT_PIPELINE_DEGRADED` ★ | 告警管道溢出（显式降级，不静默丢弃） | WARN | 否 | 告警管道已降级；有界队列溢出；告警转状态页可见，请查看状态页 | NONE | **新增**（impl/34 §⑩ 有降级语义无码） |
| 运维 | `OPS_EVIDENCE_WRITE_FAILED` ★ | 证据写入失败（补偿重试，不回滚业务） | WARN | 是 | 证据写入失败；不影响已执行动作；补偿任务将重试写入 | NONE | **新增**（impl/34 §9.5 现无码） |
| 运维 | `OPS_TIMELINE_GAP` ★ | 事故时间线存在缺口（显式标注） | INFO | 否 | 时间线含缺口（已标注）；事件采集断档；可人工补注 | NONE | **新增**（impl/34 §9.5 现无码） |
| 前沿 | `FRONTIER_FIELD_REQUIRED` | 实验定义缺必填字段 | WARN | 否 | 实验定义缺少必填字段；`<field>` 为登记必填；补齐后重新提交 | FIX_INPUT | impl/35 §9.1 |
| 前沿 | `FRONTIER_EXPERIMENT_LIMIT_EXCEEDED` | 实验数量/资源超上限 | WARN | 否 | 实验数量已达上限；当前 `<n>`/上限 `<max>`；请归档旧实验后重试 | FIX_INPUT | impl/35 §9.1 |
| 前沿 | `FRONTIER_DUPLICATE_EXPERIMENT` | 重复实验（同判据/同主体） | WARN | 否 | 该实验已存在；判据与主体重复；请复用既有实验或修改判据 | FIX_INPUT | impl/35 §9.1 |
| 前沿 | `FRONTIER_EXPERIMENT_NOT_FOUND` | 实验不存在 | WARN | 否 | 实验不存在；`<experimentId>` 未找到；请刷新列表后重选 | FIX_INPUT | impl/35 §9.1 |
| 前沿 | `FRONTIER_LEVEL_TRANSITION_DENIED` | 级别迁移被拒（信任不足） | WARN | 否 | 级别迁移被拒；当前信任级不足；请补齐评审与证据后重试 | ESCALATE | impl/35 §9.1 |
| 前沿 | `FRONTIER_EXIT_CRITERIA_MISSING` | 缺退出判据 | WARN | 否 | 缺少退出判据；升级前必须声明退出条件；补齐后重新提交 | FIX_INPUT | impl/35 §9.1 |
| 前沿 | `FRONTIER_FLAG_SCOPE_DENIED` | 开关作用域越权 | WARN | 否 | 开关作用域越权；`<scope>` 超出你的授权范围；请申请或缩小作用域 | ESCALATE | impl/35 §9.1 |
| 前沿 | `FRONTIER_REVIEW_CONFLICT` | 并发评审冲突 | WARN | 是 | 评审已被他人提交；并发冲突；请刷新后查看既有评审结论 | RETRY | impl/35 §9.1 |
| 前沿 | `FRONTIER_DATA_EXPORT_DENIED` | 数据导出被拒 | WARN | 否 | 数据导出被拒；含受限数据或未获授权；请申请导出审批 | ESCALATE | impl/35 §9.1 |
| 前沿 | `FRONTIER_DATA_DELETE_CONFLICT` | 删除冲突（GA 实验禁止删除） | WARN | 否 | 该实验数据禁止删除；已晋升 GA；请走合规删除流程 | CONTACT_ADMIN | impl/35 §9.1 |
| 前沿 | `FRONTIER_CAPABILITY_UNAVAILABLE` | 能力不可用（十二方向声明） | WARN | 否 | 该前沿能力不可用；未在当前形态声明；请查看能力清单 | FIX_INPUT | impl/35 §8.x |
| 前沿 | `FRONTIER_DISPOSAL_INCOMPLETE` | 处置（清理/下线）未完成 | ERROR | 是 | 实验处置未完成；存在未清理资源；补偿任务将续跑 | RETRY | impl/35 §8.x |
| 前沿 | `FRONTIER_INSUFFICIENT_SAMPLE` | 样本量不足（判据不成立） | WARN | 否 | 样本量不足；当前 `<n>` < 要求 `<min>`；请延长实验窗口 | NONE | impl/35 §8.x |
| 前沿 | `FRONTIER_INVALID_TRANSITION` | 非法状态迁移 | WARN | 否 | 非法状态迁移；当前 `<cur>` 不支持迁往 `<next>`；请刷新后重试 | FIX_INPUT | impl/35 §8.x |
| 前沿 | `FRONTIER_TRUST_INSUFFICIENT` | 信任级不足以启用该强度 | WARN | 否 | 信任级不足；实验级别未达要求；请先完成评审升级 | ESCALATE | impl/35 §8.x |

**统计**：共 **253** 条码（其中 `★` 新增 22 条、别名 15 条）；覆盖 §1.3 所列全部散落定义与全部已知 impl/组件散落命名，无遗漏码。

---

## §4 重试与降级判定

### 4.1 唯一判据

**只有 `retryable=true` 的码允许自动重试**。判定链固定：`ErrorCode` → `retryable` → 退避预算 → 是否仍重试。以下替代判据均为实现缺陷（CI 可静态检出）：按异常类型（`catch (TimeoutException)`）、按厂商错误码（`429 → retry`）、按文案关键字（`contains("超时")`）、按 HTTP 状态码直判。

### 4.2 分域退避与重复预算

| 域 | 退避 | 重复预算（默认） | 超预算处置 | 出处 |
| --- | --- | --- | --- | --- |
| 模型 | 指数退避 + 抖动；429 尊重 `Retry-After` | `retry.max-attempts`（默认 3；仅 4 类可重试：`DEPENDENCY_UNAVAILABLE` / `RATE_LIMITED` / `MODEL_TIMEOUT` / `MODEL_PROTOCOL_ERROR`） | 触发熔断并快速失败，**不换模型**（D14：无 fallback 链） | impl/02 §9.5/§10.7 |
| 工具 | 固定 200ms | 同工具同参数连续失败达阈值（默认 3） | 升级 `log.error` + 一次显式提示；结果仍 `success=false` 回喂 | impl/05 §10.1 |
| 上下文 | 退避 200ms | 连续 3 次 | 按系统错误上报；压缩链进熔断（冷却 5 分钟） | impl/03 §10.6 |
| 权限 | **不自动重试**（决策/审批是结论不是异常） | — | 通道恢复后由**用户**重新发起 | impl/06 §10.1 |
| 技能/MCP | 域内退避 | 熔断阈值 + 冷却 | 转 `QUARANTINED`；面板一键重试 | impl/08/09 §10.x |
| 工作区/Git | 自动退避重连 | 重连 ≤ 策略上限 | 进 `degraded`；Git 侧「待同步」队列 | impl/20/21 §9.1 |
| A2A | 按 `Retry-After` | 调用方自定（服务端只声明 `retryable`） | 熔断期快速失败 | impl/24 §9.1 |
| 分发 | 元数据/差分失败即重试 | 健康检查失败自动回滚 ≤ 2 分钟 | 迁移不可回滚 → 转人工 | impl/28 §9.6 |
| 运维/增强/自动化 | 域内退避 | 见各域 §9 | `BLOCKED` 可续跑（保留已完成部分） | impl/32/34 §9.5 |

**纪律**：① 重试必须复用同一幂等键（模型 `request_id`、工具 `callId`），**禁止**因重试产生第二条 `oc_usage_record` 或第二个副作用；② 不可重试错误**不得消耗退避预算**（故障注入用例断言「不产生额外调用」）；③ 熔断与 `retryable` **解耦**——`retryable=true` 仍可能在冷却期被快速失败拒绝（`MODEL_UNAVAILABLE`）。

### 4.3 绝对禁止自动重试的码（权限/审批/安全类，28 条）

`PERMISSION_DENIED`、`POLICY_OVERRIDE_DENIED`、`POLICY_LOCKED`、`POLICY_BASELINE_VIOLATION`、`SELF_APPROVAL_DENIED`、`APPROVAL_DENIED`、`APPROVAL_STATE_INVALID`、`APPROVAL_FORBIDDEN_SCOPE`、`APPROVAL_INSUFFICIENT`、`REVIEWER_REQUIRED`、`ENVIRONMENT_FORBIDDEN`、`OPS_DESTRUCTIVE_FORBIDDEN`、`SANDBOX_DENIED`、`SANDBOX_VIOLATION`、`SEC_BOUNDARY_FAILED`、`SEC_CONTRACT_VIOLATION`、`SEC_LEASE_DENIED`、`CROSS_TENANT_DENIED`、`TENANT_CONTEXT_MISSING`、`DLP_BLOCKED`、`RESIDENCY_VIOLATION`、`AUDIT_CHAIN_BROKEN`、`A2A_CALLER_UNAUTHORIZED`、`GIT_PROTECTED_BRANCH`、`GIT_DANGEROUS_BLOCKED`、`WORKSPACE_HOSTKEY_MISMATCH`、`FRONTIER_FLAG_SCOPE_DENIED`、`FRONTIER_DATA_EXPORT_DENIED`。即便被误标 `retryable=true` 也**禁止自动重试**（发现即缺陷）。

**理由**：这些码的失败是「**策略结论**」而非「瞬时故障」——重试不会改变结果，只会放大越权尝试、污染审批统计、拉高审计噪声（对齐 REQ-INT-9「不静默换路径」与卷 30 安全红线）。

### 4.4 降级判定

降级（换轻路径）与重试是两件事：**只有显式声明了替代能力的路径才允许降级**（`UNSUPPORTED_CAPABILITY` 必须携带 `alternatives[]`），且降级必须**事件化**（`model.capability.mismatch`、`sandbox.degraded`、`skill.registry.degraded`）。**禁止静默降级**；`retryable=true` 的码在重试失败后同样**禁止**静默换模型/换工具/换隔离档。

---

## §5 用户可见文案规则

### 5.1 三段式模板（强制）

每条文案由 **事实（what）→ 原因（why）→ 动作（how）** 构成，固定顺序渲染，三段必须在**同一条文案内可读**（不得只给事实让用户猜下一步）。基线语言 `zh-CN`；端上呈现规则见 `impl/30` §9.6。

- **事实**：发生了什么（含业务编号：`sessionId` / `decisionId` / `workspaceId` / `runId`）。
- **原因**：为什么（策略引用、依赖逻辑名、阈值、当前状态），不含内部实现细节。
- **动作**：可执行的下一步（重试 / 改参数 / 申请审批 / 联系管理员 / 查看报告）。

正例：`该操作被拒绝（事实）；命中策略 ruleRef=org.prod.danger（原因）；如需放行请修改策略或申请临时授权（动作）`。
反例：`Error 403: policy check failed`（无原因与动作）、`forbidden`（无编号）、`系统错误，请联系管理员`（事实与原因无边界）。

### 5.2 禁止泄露的内部细节

**禁止**出现：Java 异常类名与堆栈、文件系统绝对路径（含 `OC_HOME` 真值）、SQL 与表名、密钥/Token（含片段）、内部类与方法名、`traceId` 之外的诊断标识、依赖的内部主机名与端口、`known_hosts` 内容及其哈希。**允许**：业务编号、策略引用（`ruleRef`/`decisionId`）、能力标识、依赖的逻辑名（「模型服务」「密钥服务」，非 endpoint 真值）、`traceId`（供工单对账）。

### 5.3 敏感信息脱敏（与 logging-rules 同源）

手机号保留前 3 后 4；身份证/银行卡只留后 4；`api-key` / `accessToken` / `secretKey` / `signature` 一律掩码（仅留长度与前 4 位哈希前缀）；验证码禁止明文；文件流与二进制禁止呈现。**错误文案与日志共用同一脱敏工具**（单点实现，禁止各域自写正则）。

### 5.4 面向四端的措辞差异（各 3 例）

| 端 | 措辞特征 | 示例 |
| --- | --- | --- |
| CLI | 极简单行、面向脚本；给命令与退出码提示，不写长句 | ① `工具 bq.run 不存在；候选：bq.query、bq.load（exit 2）` ② `模型响应超时，已重试 3 次后失败；用 oc doctor 诊断（exit 44）` ③ `保护分支 main 禁止直推；请开分支并提 PR（exit 2）` |
| TUI | 短句 + 按键提示；可换行；强调「按什么键」 | ① `审批超时 300s，已按策略拒绝 — 按 r 重新发起` ② `上下文正在压缩，冷却剩余 42s — 按 Esc 用紧预算继续` ③ `技能签名无效，已拒绝装载 — 按 i 查看详情` |
| 桌面（Vue/Electron） | 三段式 + 卡片动作按钮；可含「查看升级对象」类入口 | ① `已升级至上级审批人（事实）；你 300s 内未响应（原因）；可继续等待，或前往审批列表查看升级对象（动作）` ② `连接已断开，正在重连（事实）；本机内核不可达（原因）；受影响动作已禁用，重连成功后自动恢复（动作）` ③ `洞察运行未产出（事实）；需要 120k token 超过剩余 30k（原因）；可提额或缩短时间窗后续跑（动作）` |
| API / SDK | 机器可读优先：`code` + `message` + `details` + `recovery` + `traceId`；`message` 仍为三段式中文 | ① `{code:"MODEL_TIMEOUT", message:"模型响应超时；endpoint 在 30000ms 内无响应；已自动重试，可稍后重试", details:{endpoint:"..."}, recovery:"RETRY", traceId:"..."}` ② `{code:"TASK_STATE_INVALID", message:"任务状态已变更；当前 in_review、期望 in_progress；请刷新后重试", recovery:"FIX_INPUT"}` ③ `{code:"UNSUPPORTED_CAPABILITY", message:"当前模型不支持 vision；可选替代：gpt-4o、qwen-vl；请显式换模型", details:{capability:"vision", alternatives:[...]}, recovery:"FIX_INPUT"}` |

**共性规则**：四端**共享同一 `code` 与同一文案数据源**（服务端只下发数据型文案与键，端上取词渲染）；端上**只按 `code` 分支**，禁止按 `message` 匹配；缺键回退 `zh-CN` 兜底包并计数（`oc_ui_copy_violations_total`），**禁止**显示键名或空串。

---

## §6 修订与替换清单

> 处置三档：**替换**（原定义删除或改为引用本目录）｜**别名保留**（废名保留、映射到规范码、新代码禁用）｜**新增登记**（原文件缺码，补齐后再引用）。

| # | 文件 | 现有定义 | 处置 | 原因 |
| --- | --- | --- | --- | --- |
| 1 | `appendix-b-interface-contracts.md` §B.11（L180–213） | 40 条码表，无 `retryable`/severity/枚举形状 | **替换**：整节改为「错误模型规则 + 指向本目录的权威指针」 | 兑现 B8 / X-82；消除两处真相 |
| 2 | `impl/02-model-gateway-impl.md` §5.4 | `ModelErrorCode`（10 项，自带 `retryable`） | **别名保留**：7 规范码 + 3 引用 GEN 码；`retryable` 改由本目录提供 | 兑现 C07-G1（逐值映射表 = §3「模型」块）；**C07-G2 补登** `MODEL_PROTOCOL_ERROR` 与新增 `MODEL_STREAM_TRUNCATED`/`MODEL_EMPTY_RESPONSE` |
| 3 | `impl/27-security-runtime-impl.md` §5.4 | `SecErrorCode`（9 项） | **别名保留**：9 项即 §3「安全」块规范码，声明位置不变、语义以本目录为准 | 域内 code 与全局 code 逐字相同，映射为恒等 |
| 4 | `impl/28-distribution-telemetry-impl.md` §5.4 | `DistErrorCode`（8 项） | **替换 + 新增登记**：补 7 码（`DIST_VERSION_PINNED`/`DIST_DELTA_MISMATCH`/`DIST_STAGING_FAILED`/`DIST_HEALTHCHECK_FAILED`/`DIST_SEAT_LIMIT_REACHED` + 许可两名）；`DIST_METADATA_EXPIRED` → **`DIST_MANIFEST_EXPIRED`** | **兑现 X-C33-1**（7 码未声明 + 两名同义） |
| 5 | `impl/28-distribution-telemetry-impl.md` §9.6 | 错误矩阵逐行用散名（`DIST_METADATA_EXPIRED`/`DIST_VERSION_PINNED`/`DIST_DELTA_MISMATCH`/`DIST_STAGING_FAILED`/`DIST_HEALTHCHECK_FAILED`/`LICENSE_EXPIRED_READONLY`/`LICENSE_SEAT_EXCEEDED`） | **替换**：逐行改为枚举引用（§3「分发」块） | 只增不改；矩阵改引用，不再自行定义 |
| 6 | `impl/21-git-worktree-impl.md` §9.1 + `appendix-b` §B.7/§B.11 | 两套命名：`DANGEROUS_OPERATION_DENIED`/`SCAN_UNAVAILABLE`（impl/21）vs `GIT_DANGEROUS_BLOCKED`/`GIT_SECRET_DETECTED`（附录 B） | **替换 + 别名保留**：冻结 `GIT_DANGEROUS_BLOCKED`（别名 `DANGEROUS_OPERATION_DENIED`）；`GIT_SECRET_DETECTED` 归位为「命中密钥/大文件」，`GIT_SCAN_UNAVAILABLE` 为「规则源加载失败（fail-closed）」——**二者语义不同，均保留** | **兑现 X-C28-3**（两套命名会导致全局处理器漏映射）；原 B.11 把「密钥命中」与「扫描不可用」混为一码 |
| 7 | `impl/21-git-worktree-impl.md` §9.1 | `PREFLIGHT_NOT_CONFIGURED` 仅见于组件 findings | **新增登记**：定名 `GIT_PREFLIGHT_NOT_CONFIGURED`，补入错误矩阵与 §B.11 指针 | **兑现 X-C28-2** |
| 8 | `impl/20-workspace-provider-impl.md` §10.6/§9.5 | 枚举 code `STRICT`/`TRUST_ON_FIRST_USE` vs 配置取值 `strict`/`strict-trust-on-first-use`；主机密钥不匹配无专用码 | **替换**：补「配置取值 ↔ 枚举 code」映射表（`strict` → `STRICT`；`strict-trust-on-first-use` → `TRUST_ON_FIRST_USE`），启动校验按映射表解析（禁止直接 `of(rawValue)`）；新增 `WORKSPACE_HOSTKEY_MISMATCH` / `WORKSPACE_SSH_POLICY_INVALID` | **兑现 X-C27-3**（启动 Fail-Fast 会误拒合法配置）；主机密钥变化需可映射到全局处理器的专用码 |
| 9 | `impl/11` §10.9、`impl/10` §10.7、`impl/33/34` 各表 | `RESOURCE_NOT_FOUND`、`FORBIDDEN`、`PARAM_INVALID`、`CONCURRENT_CONFLICT` | **别名保留**：分别映射 `NOT_FOUND` / `PERMISSION_DENIED` / `INVALID_ARGUMENT` / `CONFLICT` | 同义四组异名；全局处理器按码映射会漏配 |
| 10 | `impl/05-tool-system-impl.md` §5.4 + `appendix-b` §B.11 | `TOOL_PARAM_INVALID`/`TOOL_EXEC_TIMEOUT`（B.11）vs `TOOL_INVALID_ARGUMENTS`/`TOOL_TIMEOUT`（impl/05） | **别名保留**：以 impl/05 为准 | 兑现 C08-G1（工具域内码 ↔ B.11 四码映射表 = §3「工具」块） |
| 11 | `impl/06`（C11 findings） | `APPROVAL_ESCALATED` 仅见于 impl/22/30 文案 | **新增登记**：正式登记入 §3「权限」块并回填 impl/06 错误矩阵 | **兑现 X-C11-5** |
| 12 | `impl/29-developer-ecosystem-impl.md` §9.4/§9.5 + `appendix-b` | `ECO_INTEGRITY_FAILED` 仅见于 C32 findings | **新增登记**：登记入 §3「企业」块并补信任根配置键出处 | **兑现 X-C32-1** |
| 13 | `impl/31-automation-library-impl.md` §9.1/§9.4 | `SIGNATURE_INVALID`/`COMPAT_BLOCKED`/`PACKAGE_VIOLATION`/`LINT_BLOCKED`/`DRYRUN_TIMEOUT`/`PREAUTH_DENIED`/`TAKEOVER_NOT_ALLOWED` | **替换 + 别名保留**：加域前缀（`AUTO_*`），旧名别名保留 | 无域前缀的裸名与技能/分发的签名码语义混淆 |
| 14 | `appendix-b` §B.11 许可类 | `LICENSE_GRACE`/`LICENSE_EXPIRED_READONLY`；impl/28 的 `LICENSE_SEAT_EXCEEDED`/`DIST_LICENSE_EXPIRED` | **别名保留**：`LICENSE_EXPIRED_READONLY` → `DIST_LICENSE_EXPIRED`；`LICENSE_SEAT_EXCEEDED` → `DIST_SEAT_LIMIT_REACHED`；`LICENSE_GRACE` 保留为 INFO 码 | 同一许可语义两套码 |
| 15 | `appendix-b` §B.11 更新类 | `UPDATE_SIGNATURE_INVALID`/`UPDATE_PRECHECK_FAILED`/`UPDATE_ROLLED_BACK` | **别名保留**：分别 → `DIST_SIGNATURE_INVALID`；`DIST_VERSION_PINNED` + `DIST_POLICY_CONFLICT`；`DIST_HEALTHCHECK_FAILED` | 与 impl/28 两套命名；桌面端（impl/23 §9.2）已按前者写码 |
| 16 | `appendix-b` §B.11 插件类 | `PLUGIN_DEPENDENCY_CONFLICT`/`PLUGIN_CIRCUIT_OPEN`/`PLUGIN_CAPABILITY_DENIED` 与 impl/18 八码并存 | **别名保留**：分别 → `PLUGIN_VERSION_CONFLICT`/`PLUGIN_QUARANTINED`/`PLUGIN_PERMISSION_DENIED`；`PLUGIN_SIGNATURE_INVALID` 两处同名保留 | impl/18 为多码方（8 码 ⊇ B.11 四码） |
| 17 | `impl/01` §10.8、`impl/12` §10.10、`impl/19` §9.1 | 恢复/迁移收敛失败与 Schema 版本不匹配均用 `INTERNAL_ERROR` 泛指 | **替换**：显式化为 `PERS_RECOVERY_NOT_CONVERGED` / `PERS_SCHEMA_VERSION_MISMATCH`（`INTERNAL_ERROR` 降为兜底） | 兜底码无法驱动 `recoveryAction`（一个是人工判定、一个是启动门禁） |
| 18 | `impl/33` §9.5、`impl/34` §9.5 | 快照超限/告警溢出/证据写失败/时间线缺口四类显式降级**无码** | **新增登记**：`QA_SNAPSHOT_OVER_QUOTA`、`OPS_ALERT_PIPELINE_DEGRADED`、`OPS_EVIDENCE_WRITE_FAILED`、`OPS_TIMELINE_GAP` | 四处均要求「显式降级、不静默」，缺码导致端上无法分支 |
| 19 | `impl/12` §9.3、`impl/13` | 子 Agent 扇出上限、验证者独立性判据有配置/判据但无码 | **新增登记**：`AGENT_FANOUT_EXCEEDED`、`VERIFIER_INDEPENDENCE_DENIED` | 兑现 C19 `R-C19-3`（判据三元组 + 拒绝错误码） |
| 20 | `impl/30` §9.5/§9.6 | 文案键空间 `ui.*` 已定，错误文案键**无命名规则** | **替换**：错误键统一 `error.<域>.<语义>`（§7.2）；`ui.*` 只承载界面静态文案 | 避免错误文案与界面文案两套键空间混用 |
| 21 | 全树 `SshHostKeyPolicyEnum.of()` 调用点 | 直接 `of(rawValue)` 会误拒合法配置 | **替换**：改为 `ofConfig(rawValue)`（内部按映射表转换） | 兑现 X-C27-3 |
| 22 | 全部 impl 文件 §⑨ 末条纪律 | 「任何新增 ErrorCode 必须同步本节与附录 B 错误码表」 | **替换**：改为「必须同步 `impl/00-contracts/ERROR-CODE-CATALOG.md`」 | 避免二次散落（本目录为唯一登记处） |

---

## §7 校验规则（CI 强制）

### 7.1 单点权威守卫（grep guard）

CI 门禁 `scripts/ci/error-code-gate.mjs`（新增，挂载于 `gate.mjs --profile fast`）执行三条机械检查：

1. **未登记码检出**：扫描 `docs/harness/impl/*.md`（含 `components/`）与 `docs/harness/appendix-*.md`，提取码形态 token（`` `[A-Z][A-Z0-9_]{3,}` ``），与 §3 表做差集；**差集非空即失败**，输出「文件:行 + 疑似码」。白名单（配置键、枚举取值、事件名、表名、环境变量）维护在同目录 `error-code-allowlist.txt`。
2. **反向完备性**：§3 每个码必须在 `harness-contract` 枚举中存在——`ErrorCode.values()` 与目录表双向 diff 的单元测试 `ErrorCodeCatalogParityTest`，缺一即失败。
3. **列完整性**：§3 每行必须含 8 列（域/码/含义/severity/retryable/文案/动作/出处），且 `severity` ∈ §2.2 四档、`recoveryAction` ∈ §2.3 七档；缺失或越界即失败。

**新增域错误码的唯一合法路径**：① 在 §3 追加行（完整 8 列）→ ② 在 `harness-contract` 枚举追加项 → ③ 域 impl 错误矩阵**只引用**该码 → ④ CI 三条检查全绿。**任何 impl/组件文档新增领域错误码而不登记本目录，一律 CI 失败。**

### 7.2 文案键命名规则（loc-key）

- **错误文案键**：`error.<域小写>.<语义>`，如 `error.model.timeout`、`error.tool.invalid_arguments`、`error.dist.downgrade_blocked`；域小写与 §3「域」列对应（模型 → `model`，智能增强 → `intel`，分发 → `dist`）。**禁止**序号与临时名（`error.msg1`、`error.tmp2`）。
- **界面静态文案键**：沿用 `ui.<surface>.<element>.<variant>`（`impl/30` §9.6）；错误码驱动的动态文案**必须**走 `error.*` 键。
- 每个键在基线包 `zh-CN` 必须存在；缺失即构建失败（`UX_COPY_KEY_MISSING`）；其他 locale 缺键回退 `zh-CN` 并计数，**禁止**显示键名。
- 键与 `code` 的绑定**只在错误码枚举的 `userMessageKey` 字段声明**；禁止端上写 `if (code === 'MODEL_TIMEOUT')` 之类的分支表。

### 7.3 一致性用例（DoD）

- `ErrorCodeCatalogParityTest`：枚举 ↔ 目录表双向 diff 为空；`code` 唯一性与正则合规。
- `ErrorCodeRetryTableTest`：`retryable` 全表断言（尤其 §4.3 的 28 条禁止重试码恒为 `false`）。
- `ErrorCodeMappingTest`：HTTP / WS / CLI 退出码三重映射逐码断言（§2.4）。
- `ErrorCopyTriadTest`：`error.*` 键值满足三段式（含业务编号占位符；不含绝对路径与密钥模式）。
- `DeprecatedAliasTest`：§6 登记的全部别名码在枚举中保留并标 `deprecated`，且**无新代码引用**（静态扫描）。

---

> **维护者**：契约层负责人（`harness-contract` owner）。**变更流程**：本目录修订 → 枚举同步 → 域错误矩阵引用更新 → CI 三条守卫全绿 → 记录到 `IMPL-DECISIONS.md`（新增码不改变已发布码语义，属非破坏性变更）。
> **修订历史**：v1 · 2026-09-21 · 首版（闭合 R10-walkthrough `B8` 与组件级 6 条阻塞项中 4 条错误码相关项：`X-C27-3` / `X-C28-2` / `X-C28-3` / `X-C33-1`）。
