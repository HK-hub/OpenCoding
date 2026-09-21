# 附录 B · 接口契约总览（Interface Contracts）

> 本附录汇总对外与对内的**全部接口面**：会话协议（JSON-RPC）、管理面（REST）、CLI 命令面、插件 SPI、事件信封、A2A 服务面、错误码与版本协商规则。
>
> 定位：这是实现与联调的**索引**——详细语义在各卷，本附录保证命名与边界一致。

---

## B.1 接口面总览

| 面 | 形态 | 使用者 | 详设 |
| --- | --- | --- | --- |
| 会话协议面 | JSON-RPC 2.0 over WS / stdio | CLI、桌面端、IDE 插件 | 卷 01 §4.5、本附录 B.2 |
| 管理面 | REST + OpenAPI | 管理台、自动化脚本、企业平台 | 本附录 B.3 |
| CLI 命令面 | 命令行 | 人类、脚本、CI | 卷 22 §4.4 |
| 插件 SPI | JVM 接口 / 进程协议 / HTTP | 插件开发者 | 卷 18 §4.1 |
| 事件流 | 持久化事件 + WS/SSE 推送 | 前端、插件、外部系统 | 卷 16 |
| A2A 服务面 | REST + SSE/WS | 其他 Agent/平台/CI | 卷 23 §4.1 |
| MCP 面 | MCP 协议（client/server 双向） | 外部 MCP 服务器、外部 Agent | 卷 09 |
| Hook 面 | 配置 + 脚本 + HTTP | 用户/组织 | 卷 17 |

## B.2 会话协议（JSON-RPC 方法表）

**通用约定**：请求含 `requestId`；通知帧无响应；每帧含 `sessionId` 与 `traceId`；错误结构统一（B.7）；能力协商在建连时完成（B.8）。

| 方法 | 方向 | 说明 |
| --- | --- | --- |
| `session.create` | C→S | 创建会话（工作区、模式、模型、权限模式、自主度） |
| `session.list` / `session.get` | C→S | 列表与详情（含统计） |
| `session.attach` / `session.detach` | C→S | 多端接入（attach 返回当前快照 + `lastEventSeq`） |
| `session.resume` | C→S | 断线续传：`resume(fromSeq)`；窗口外返回快照重建指令 |
| `session.sendMessage` | C→S | 发送用户消息（支持多模态块、附件、预算覆盖） |
| `session.steer` | C→S | 插话（安全点生效） |
| `session.interrupt` | C→S | 中断当前执行（安全点停止） |
| `session.pause` / `session.resumeRun` | C→S | 暂停/继续 |
| `session.fork` | C→S | 从某 item 分叉 |
| `session.rewind` | C→S | 回退到检查点（含副作用提示） |
| `session.export` / `session.import` | C→S | 导出/导入会话包（卷 19） |
| `session.close` / `session.archive` | C→S | 关闭/归档 |
| `context.get` / `context.compact` | C→S | 查看上下文占用 / 手动触发压缩 |
| `plan.get` / `plan.update` | C→S | 计划查看与人工编辑 |
| `task.create` / `task.update` / `task.list` | C→S | 任务操作（卷 14） |
| `goal.create` / `goal.pause` / `goal.report` | C→S | 目标模式（卷 15） |
| `team.create` / `team.message` / `team.abort` | C→S | 团队（卷 13） |
| `approval.list` / `approval.respond` | C→S | 审批（含授权范围） |
| `permission.explain` | C→S | 解释某决策（卷 06 D-PERM-12） |
| `workspace.list` / `workspace.exec` | C→S | 工作区（卷 20） |
| `git.status` / `git.diff` / `git.commit` / `git.undo` | C→S | Git（卷 21） |
| `kb.search` / `memory.list` | C→S | 知识与记忆查询 |
| `skill.activate` / `plugin.manage` | C→S | 技能与插件 |
| `diagnostics.get` | C→S | 装配/能力/插件健康摘要 |
| `event`（通知） | S→C | 事件推送（含 seq；流式增量与语义事件分通道） |
| `approval.requested`（通知） | S→C | 审批请求（含预览与倒计时） |
| `agent.phase`（通知） | S→C | 阶段迁移（UI 进度） |
| `error`（通知） | S→C | 异步错误（可恢复项） |

## B.3 管理面（REST 端点表，节选）

| 端点 | 方法 | 说明 | 权限点 |
| --- | --- | --- | --- |
| `/api/v1/projects` | CRUD | 项目 | `project.manage` |
| `/api/v1/workspaces` | CRUD | 工作区与连接配置 | `workspace.manage` |
| `/api/v1/providers` | CRUD | 模型提供方与凭证引用 | `model.credential.manage` |
| `/api/v1/policies` | CRUD | 权限策略（含版本） | `policy.edit` |
| `/api/v1/plugins` | CRUD + `install/enable/disable` | 插件 | `plugin.install` |
| `/api/v1/skills` | CRUD + `install/update` | 技能 | `skill.manage` |
| `/api/v1/hooks` | CRUD + `test` | 钩子 | `hook.manage` |
| `/api/v1/kb/sources` | CRUD + `sync` | 知识源 | `kb.manage` |
| `/api/v1/schedules` | CRUD + `run-now` | 计划任务 | `schedule.manage` |
| `/api/v1/audit/events` | GET + `export` | 审计查询与导出 | `audit.read` |
| `/api/v1/usage` | GET | 用量与成本 | `billing.read` |
| `/api/v1/quota` | GET/PUT | 配额 | `quota.manage` |
| `/api/v1/members` / `/roles` | CRUD | 成员与角色 | `member.manage` |
| `/api/v1/features` | GET/PUT | 特性开关 | `feature.manage` |
| `/api/v1/diagnostics` | GET + `export` | 诊断包 | `diagnostics.read` |
| `/healthz` / `/readyz` / `/metrics` | GET | 健康与指标 | 内网白名单 |

**REST 约定**：分页（cursor）、过滤（query 参数）、幂等（`Idempotency-Key` 头）、错误（B.7）、版本化路径（`/api/v1`）。

## B.4 插件 SPI（摘要）

| 面 | 形态 | 关键接口 |
| --- | --- | --- |
| 注册 | 清单 + 代码/协议 | `PluginManifest`、`ExtensionRegistration` |
| 扩展点 | 见卷 18 §4.1（30+ 类） | 各域 SPI 接口 |
| 服务 | 内核提供 | `StoragePort`、`EventPort`、`SecretPort`、`Logger`、`ConfigPort`、`WorkspacePort`、`LlmPort`（受限） |
| 生命周期 | 回调 | `init` / `start` / `stop` / `dispose` / `health` |
| 进程外协议 | JSON-RPC over stdio/HTTP | 与内核协议同构（能力子集） |
| 权限校验 | 每次调用 | 能力声明 → 授权 → 门面校验 |

## B.5 事件信封（摘要）

见卷 16 §4.1。要点：`eventId`、`type`、`version`、`category`、`tenantId`、`partitionKey`、`seq`、`occurredAt`、`actor`、`traceId`、`correlationId`、`payload`、`sensitivity`。

**外部可见事件集**（A2A 与 Webhook）为内部事件的过滤投影（卷 23 §4.1）。

## B.6 A2A 服务面（摘要）

完整定义见卷 23 §4.1；本附录给出口径摘要（9 端点 + 11 类外部事件）。

| 面 | 端点 | 说明 |
| --- | --- | --- |
| 能力 | `GET /a2a/v1/manifest` | Agent Card（能力 / 约束 / 端点 / 认证 / 限流） |
| 提交 | `POST /a2a/v1/tasks` | 幂等提交（目标工作区、模式、预算、审批回调、优先级） |
| 查询 | `GET /a2a/v1/tasks`、`GET /a2a/v1/tasks/{id}` | 列表（状态/时间过滤 + 分页）与状态摘要 |
| 事件流 | `GET /a2a/v1/tasks/{id}/events`（SSE / WS） | 进度 / 工具 / 审批 / 产物 / 日志摘要 |
| 结果 | `GET /a2a/v1/tasks/{id}/result` | 最终结果（含证据与产物引用） |
| 控制 | `POST /a2a/v1/tasks/{id}/cancel`、`POST /a2a/v1/tasks/{id}/messages` | 安全点取消；追加指令 / 回复审批 |
| 产物 | `GET /a2a/v1/artifacts/{id}` | 取产物（受权限） |

**外部事件（11 类，内部事件的过滤投影）**：`task.queued`、`task.started`、`phase.changed`、`plan.updated`、`tool.summary`、`approval.requested`、`approval.resolved`、`artifact.created`、`task.completed`、`task.failed`、`task.cancelled`。

**认证**：任务面端点按 A2A 入站认证（卷 23 §4.1）；审批回调支持事件流与 Webhook 两形态，超时默认拒绝。

## B.7 错误模型

| 层 | 结构 | 示例 |
| --- | --- | --- |
| 业务错误 | `code`（枚举）+ `message`（中文，面向用户）+ `details`（字段/编号）+ `recovery`（可选动作）+ `traceId` | `TASK_STATE_INVALID: 任务状态已变更（当前 in_review），请刷新后重试` |
| 能力错误 | `UNSUPPORTED_CAPABILITY` + `capability` + `alternatives[]` | 模型不支持视觉 → 建议切换模型或转文本 |
| 权限错误 | `PERMISSION_DENIED` + `decisionId` + `reason` | 含策略引用，供解释与申诉 |
| 依赖错误 | `DEPENDENCY_UNAVAILABLE` + `dependency` + `retryable` | 模型端点/沙箱/存储不可用 |
| 系统错误 | `INTERNAL_ERROR` + `diagnosticsRef` | 携带诊断引用，禁止暴露堆栈给用户 |
| 限流 | `RATE_LIMITED` + `retryAfterMs` | 含配额维度 |

**规则**：错误码一经发布不得改义（可新增）；错误文案必须给出可执行建议；错误必须携带 `traceId`。

## B.8 版本协商与兼容

| 面 | 版本载体 | 协商方式 | 兼容期 |
| --- | --- | --- | --- |
| 会话协议 | 建连握手 `protocolVersion` | 服务端返回支持区间，取交集；不兼容则拒绝并提示升级 | ≥ 2 个小版本 |
| 管理面 REST | 路径版本 `/api/v1` | 新增字段向后兼容；删除需新版本路径 | ≥ 2 个大版本 |
| 事件 Schema | `version` 字段 | 消费者声明支持区间；Registry 校验兼容性 | 永久（只追加） |
| 插件 SPI | 清单 `kernel.compatible` | 装载期校验 | ≥ 2 个小版本 |
| A2A | Agent Card `protocolVersion` | 握手协商 | ≥ 2 个小版本 |

**破坏性变更流程**：公告（≥ 1 个小版本提前）→ 双栈并存 → 弃用告警 → 移除；全过程记录于 `DECISIONS.md` 与发布说明。

## B.9 接口设计规则（强制）

1. 会话语义只走会话协议面；REST 不承载会话状态变更。
2. 所有写操作必须携带 `Idempotency-Key`（或幂等键字段）。
3. 分页统一 cursor 风格；禁止 offset 深分页。
4. 时间统一 ISO-8601（UTC）；金额统一最小货币单位整数。
5. 大对象只传引用（artifact/media ID），禁止内联 base64（除小图标类）。
6. 敏感字段在契约中标 `sensitive: true`，序列化层强制脱敏。
7. 契约由单一来源生成（附录 B + 类型定义 → 生成 Java/TS SDK）。
8. 任何新接口必须同时提供：语义说明、错误矩阵、示例、权限点、DoD 用例。

## B.10 新增域管理端点（卷 28–35）

| 端点 | 方法 | 说明 | 权限点 |
| --- | --- | --- | --- |
| `/api/v1/updates/check` / `apply` / `rollback` | POST | 更新检查/应用/回滚 | `system.update` |
| `/api/v1/updates/channels` | GET/PUT | 通道与策略 | `system.update` |
| `/api/v1/telemetry/consent` | GET/PUT | 遥测三级同意 | `telemetry.manage` |
| `/api/v1/telemetry/preview` | GET | 本地预览将上报内容 | `telemetry.read` |
| `/api/v1/telemetry/export` | POST | 导出/清除本地遥测 | `telemetry.manage` |
| `/api/v1/crash-reports` | GET/POST | 崩溃列表与上传（需确认） | `diagnostics.manage` |
| `/api/v1/license` / `/api/v1/license/seats` | GET/PUT | 许可与席位 | `license.manage` |
| `/api/v1/notifications` / `routes` | GET/PUT | 通知与路由（聚合/静默） | `notification.manage` |
| `/api/v1/announcements` | GET | 公告（按人群过滤） | `*`（读） |
| `/api/v1/sdk/clients` | GET | SDK/IDE 客户端接入统计 | `diagnostics.read` |
| `/api/v1/imports` | POST + GET | 导入任务与迁移报告 | `project.manage` |
| `/api/v1/registries` / `registries/sync` | CRUD + POST | Registry 与镜像同步 | `registry.manage` |
| `/api/v1/feedback` | CRUD | 反馈与状态回传 | `*`（自有） |
| `/api/v1/search` | GET | 统一搜索（八源） | `*`（按源过滤） |
| `/api/v1/deeplinks/audit` | GET | 深链打开审计 | `audit.read` |
| `/api/v1/playbooks` / `runs` | CRUD + POST `run-now` | 自动化模板与运行 | `playbook.manage` |
| `/api/v1/ai/features` / `runs` | GET + POST | 智能增强调用与记录 | `ai.invoke` |
| `/api/v1/ai/outputs/{id}/adopt` / `reject` | POST | 产出处置（质量度量） | `ai.invoke` |
| `/api/v1/capacity/samples` / `cost` | GET | 容量采样与成本归因（六维） | `billing.read` |
| `/api/v1/quota/dynamic` | GET/PUT | 动态额度 | `quota.manage` |
| `/api/v1/alerts` / `runbooks` / `drills` / `postmortems` | CRUD | 运维对象 | `ops.manage` |
| `/api/v1/share-links` | CRUD | 只读分享链接（含过期/密码） | `session.share` |

**约定**：新增端点一律遵守 B.9 的 8 条规则；`/api/v1/search` 与 `/api/v1/cost` 必须支持 `cursor` 分页与 `tenantId` 隐式过滤（不得从请求体取租户）。

## B.11 错误码全表（核心 40 条）

| 域 | 错误码 | 触发 | 用户可见文案要点 |
| --- | --- | --- | --- |
| 通用 | `INVALID_ARGUMENT` | 参数校验失败 | 指出字段与约束（配合 `details`） |
| 通用 | `NOT_FOUND` | 资源不存在 | 给出编号 |
| 通用 | `CONFLICT` | 并发写冲突 | 「已变更，请刷新」 |
| 通用 | `RATE_LIMITED` | 限流 | 含 `retryAfterMs` |
| 通用 | `INTERNAL_ERROR` | 未预期 | 含诊断引用 |
| 能力 | `UNSUPPORTED_CAPABILITY` | 模型/后端不支持 | 附可选替代方案 |
| 模型 | `MODEL_AUTH_FAILED` | 凭证无效 | 提示检查凭证引用 |
| 模型 | `MODEL_QUOTA_EXCEEDED` | 额度耗尽 | 建议切换凭证/模型 |
| 模型 | `MODEL_CONTEXT_OVERFLOW` | 超窗口 | 触发压缩后重试 |
| 模型 | `MODEL_TIMEOUT` / `MODEL_UNAVAILABLE` | 超时/不可用 | 可重试；含端点名 |
| 模型 | `MODEL_CONTENT_BLOCKED` | 内容策略 | 建议修改输入 |
| 上下文 | `CONTEXT_COMPACTION_FAILED` | 压缩失败 | 降级并提示 |
| 工具 | `TOOL_NOT_FOUND` / `TOOL_PARAM_INVALID` / `TOOL_EXEC_TIMEOUT` / `TOOL_OUTPUT_TOO_LARGE` | 工具四类 | 各自可修复建议 |
| 工具 | `TOOL_BLOCKED_BY_POLICY` | 权限/钩子阻断 | 含决策 ID |
| 权限 | `PERMISSION_DENIED` / `APPROVAL_REQUIRED` / `APPROVAL_TIMEOUT` | 决策链三类 | 含 reason 与申请入口 |
| 权限 | `POLICY_OVERRIDE_DENIED` | 下级试图放宽 | 说明企业基线 |
| 沙箱 | `SANDBOX_UNAVAILABLE` / `SANDBOX_DENIED` / `SANDBOX_VIOLATION` | 三档失败 | 显式降级或阻断原因 |
| 沙箱 | `RESOURCE_EXHAUSTED` | 资源超限 | 含峰值与上限 |
| 工作区 | `WORKSPACE_UNAVAILABLE` / `WORKSPACE_PATH_DENIED` / `WORKSPACE_QUOTA_EXCEEDED` | 工作区三类 | — |
| Git | `GIT_CONFLICT` / `GIT_PROTECTED_BRANCH` / `GIT_DANGEROUS_BLOCKED` / `GIT_SECRET_DETECTED` | 四类 | 含建议动作 |
| 任务 | `TASK_STATE_INVALID` / `TASK_DEPENDENCY_CYCLE` / `TASK_ACCEPTANCE_MISSING` | 三类 | — |
| 目标 | `GOAL_BUDGET_EXHAUSTED` / `GOAL_DRIFT_DETECTED` / `GOAL_NOT_CONFIRMED` | 三类 | — |
| 调度 | `SCHEDULE_PREAUTH_DENIED` / `SCHEDULE_CIRCUIT_OPEN` / `SCHEDULE_DUPLICATED` | 三类 | — |
| 插件 | `PLUGIN_SIGNATURE_INVALID` / `PLUGIN_DEPENDENCY_CONFLICT` / `PLUGIN_CIRCUIT_OPEN` / `PLUGIN_CAPABILITY_DENIED` | 四类 | — |
| 更新 | `UPDATE_SIGNATURE_INVALID` / `UPDATE_PRECHECK_FAILED` / `UPDATE_ROLLED_BACK` | 三类 | — |
| 许可 | `LICENSE_GRACE`（警告）/ `LICENSE_EXPIRED_READONLY` | 两类 | 明确数据可导出 |
| A2A | `A2A_CALLER_UNAUTHORIZED` / `A2A_IDEMPOTENT_REPLAY` / `A2A_DEPTH_EXCEEDED` | 三类 | — |
| 安全 | `DLP_BLOCKED` / `MFA_REQUIRED` / `CROSS_TENANT_DENIED` | 三类 | 安全事件留痕 |

**规则**：错误码一经发布不得改义；新增错误必须同时登记文案要点、可重试标记、建议动作与埋点。
**权威指针**：本表为**索引节选**；错误码的**单点权威**为 `docs/harness/impl/00-contracts/ERROR-CODE-CATALOG.md`（含 `ErrorCode` 枚举字段定义、全量码表 + `severity`/`retryable`/恢复动作、`HarnessException`/`BusinessException` 映射与 HTTP/WS/退出码三重映射），冲突时以该目录为准。

## B.12 版本兼容矩阵（发布物）

| 组合 | 兼容策略 | 验证 |
| --- | --- | --- |
| 内核 vN ↔ 协议面 vM | 连接期能力协商（B.8）；主版本不同则拒绝并提示升级 | 每版本跑互操作矩阵 |
| 内核 vN ↔ 插件 SDK vK | 清单声明区间；兼容 ≥ 2 小版本；不满足拒绝装载 | 插件契约测试 |
| 内核 vN ↔ 数据 Schema vD | expand-contract；不可回滚迁移需审批；旧版本可读新数据（双读期） | 迁移测试四项（卷 19） |
| 内核 vN ↔ CLI/桌面 vC | 低版本客户端连高版本内核，仅用交集能力 | 客户端矩阵测试 |
| 内核 vN ↔ 事件 Schema vE | 只追加，永久向后兼容 | Schema 兼容性 CI |
| 任意 ↔ 外部（MCP/A2A） | 适配器独立版本矩阵；破坏性演进只影响适配器 | 互操作用例 |
| 更新通道 ↔ 版本 | 防降级（anti-rollback）；跨大版本需中间版本 | 更新器用例 |
