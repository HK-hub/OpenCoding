# R06 · 企业级与运维就绪评审（客户平台团队验收视角：impl/24、25、26、29、34）

> 评审轮次：REVIEW ROUND 6（镜头：**企业级与运维就绪** —— 「企业客户的平台团队会不会接受」）
> 范围：`impl/24-a2a-gateway-impl.md`、`impl/25-enterprise-iam-audit-impl.md`、`impl/26-quota-cost-impl.md`、`impl/29-developer-ecosystem-impl.md`、`impl/34-operations-runtime-impl.md` + 本文件
> 参照基准：`24-enterprise-operations.md`（§4.10 租户化清单 / 跨租户红线 1–4 / §4.7 SLO / §8 DoD）、`31-capacity-and-cost.md`（§4.3 六维归因 / §4.5 配额智能 / §4.7 告警阈值 / §8 DoD）、`32-operations-runbook.md`（§2 SLO 燃尽 / §3 告警清单 / §4 Runbook / §5 演练 / §7 值班升级）、`27-technical-path.md`（版本协商与迁移纪律）、`research/CROSS-COMPARISON.md` §4（N3/N4 负证据 = 差异化窗口）
> 交付约束：**只增不改** —— 未删除任何小节、`REQ-*` / `I-*` / `D-*` 编号；新增内容均带「R06 新增」锚点便于机械检索；Mermaid 未新增（全部沿用原图），代码围栏 26/24/24/26/28 均为偶数、闭合平衡
> 结论摘要：五文件各补一张**资源级隔离矩阵**（共 36 行，逐行带运行时阻断 + 泄漏用例）；身份与资产生命周期补成闭环（含交接窗口与吊销 SLA ≤ 5 分钟）；配额治理补「准入 / 在途 / 事后」三段式与成本归因 join 键表；新登记 **34 条 Runbook 首命令**（RB-A2A-01…06、RB-ENT-01…07、RB-COST-01…07、RB-ECO-01…07）+ 34 §9.6「值班首 5 分钟索引」；外部消费方 SLA 面（限流/配额/错误契约/版本弃用）在 24 §10.2 与 29 §9.6 成文；每文件 §⑪ 增补跨租户泄漏用例与可运行验收命令。

---

## 一、方法与判据

1. **「可证明性」判据（本镜头核心）**：任何隔离声明必须能回答三问 —— ① 机制在哪一层（数据面/键面/对象面/索引面/分区面）？② **运行时**是谁在拒绝（拦截器 / Key 工厂结构断言 + 读路径二次校验 / 路径构造与签名 URL 绑定 / 前置过滤 / 分区校验），而不是「按约定过滤」？③ 哪条测试会因为它坏了而失败（用例编号）？三问缺一即记为缺口并就地补齐。
2. **验收主体代入**：以「客户平台团队」的七问自查 —— 跨租户能不能漏？人走了权限多久停？钱花在哪答不答得出？3am 值班照哪一页做？外部调用方会不会被打爆/突然不可用？升级会不会破坏集成？验收命令能不能在 CI 直接跑？
3. **缺口二分**：**可就地闭合**（本文件内补矩阵/表/配置/用例/命令）全部就地修复；**跨卷或需评审**（如 27 缺弃用期条款、卷 32 缺四域 Runbook 编号）只登记进各文件 §「依赖修订」+ 本文件 §七，不越权改 Phase A 卷册。

---

## 二、隔离矩阵（五文件 × 资源类型；「运行时阻断」= 真正会拒绝的那一步）

| 文件 | 资源类型 | 隔离机制 | 运行时阻断（非约定） | 用例落点 |
| --- | --- | --- | --- | --- |
| 24 A2A | PostgreSQL 7 表 | `tenant_id` + 拦截器强制注入 | 缺上下文抛 `TENANT_CONTEXT_MISSING`（不返回空集）；无租户列的表走 `caller_id`/`session_id` 联表校验归属 | §11.3 跨租户泄漏行 |
| 24 | Redis 4 类键 | 首段租户（`federationCard` 为显式共享域白名单） | 命中后比对值 `tenantId` 与上下文，不一致丢弃 + 告警 | 同上 |
| 24 | 对象存储（产物/证据/导出） | 前缀 `oc-a2a/{tenantId}/{callerId}/{taskId}/` | 签名 URL 载荷含 `tenantId+callerId+artifactId`，校验当前调用方身份（URL 不可转让）+ `revoked_at` 逐请求校验 | 同上 |
| 24 | 向量/全文 | 本面不建独立索引 | 复用 25/11 的「召回前置过滤」不变式 | 转 29 §⑪ |
| 24 | 队列/事件分区 | `tenantId:callerId:taskId` 分区键 | 消费者校验信封与分区一致 → 毒信 + SEV2 | §11.3 |
| 25 IAM | PostgreSQL 企业表族 | `tenant_id` + 拦截器 | 缺上下文抛 `TENANT_CONTEXT_MISSING`；全局字典表白名单需双签 | §10.4.1 / §11.3 |
| 25 | Redis 5 类键 | 首段租户（`entAuthzCache` 等） | 工厂重载集穷举断言 + 读路径二次校验 | 同上 |
| 25 | 对象存储（WORM/证据/诊断包） | 前缀 `oc-*/{tenantId}/...` | 路径只允许由 `TenantContext` 构造；签名 URL 绑定主体 | 同上 |
| 25 | 向量/全文（共享知识域） | `tenant_id` 标签 + `shared` 标记 | 召回前置过滤；未标注 `shared` 的跨租户注入拒绝 | 同上 |
| 25 | 作业/消费者 | 按 `tenantId` 分片 + 锁键含租户 | 信封与分片一致性校验 → 毒信 + SEV2 | §11.3 |
| 26 Cost | PostgreSQL 12 表（定价类为全局白名单） | 六维列含 `tenant_id` + 拦截器 | 缺上下文抛异常；定价全局表显式登记且只读 | §11.2 多租户泄漏行 |
| 26 | Redis 6 类键 | 首段租户（`costPrice` 为不可变全局白名单） | 二次校验 + Lua 内不接受外部 `tenantId`（由上下文装配） | 同上 |
| 26 | 对象存储（对账差异/报表导出） | `oc-cost-recon|export/{tenantId}/...` | 服务端构造路径 + 主体绑定签名 URL | 同上 |
| 26 | 看板/下钻/缓存 | 三重过滤（租户+项目+角色） | 下钻不缓存；缓存键含权限指纹 | 同上 |
| 26 | 归因维度解析 | 只读本租户组织树（25 §8.1） | 跨租户维度 ID 解析失败 → `oc_cost_attribution_missing_total`（不猜测、不归父级） | 同上 |
| 29 Eco | PostgreSQL 表族（公共 Registry 元数据为共享域） | `tenant_id`（R06 为 `oc_deeplink_audit`/`oc_im_binding` 补列） | 缺上下文抛异常；公共 Registry 只写制品元数据 | §11.1 跨租户泄漏行 |
| 29 | Redis 7 类键 | 首段租户（公共 Registry 索引缓存白名单） | 二次校验 + 工厂穷举断言 | 同上 |
| 29 | 对象存储 5 前缀 | 租户段（R06 补 `oc-registry-mirror`/`oc-import*`/`oc-feedback`） | 服务端构造 + 主体绑定 URL；公共源写入前敏感扫描 | 同上 |
| 29 | 统一搜索 | `tenant_id+project_id+visibility` 取自会话上下文 | 前置过滤 + 越权命中在结果构造期剔除并计数 | 同上 |
| 29 | 深链 / IM 推送 | 签名载荷含 `tenantId+actorUserId`；绑定按租户归属 | 验签后校验上下文租户与主体；推送前校验接收人绑定归属 | 同上 |
| 34 Ops | PostgreSQL 表族 | 平台级表白名单；租户级表（修复/证据/事故/时间线）带 `tenant_ref`（R06 补列） | 拦截器对 `tenant_ref` 非空行注入租户条件；**修复批次写入前逐行校验行归属**，越界整批拒绝 | §11.2 运维面租户边界行 |
| 34 | 对象存储 4 前缀 | `{tenantRef|_platform}` 段前置 | 服务端构造 + 主体绑定 URL；脱敏命中 0 才归档 | 同上 |
| 34 | 修复工具（数据面） | 计划带 `tenant_ref` + 显式 `scope` | scope 必须落在租户内（禁「全库」）；dry-run 零写 + 执行前二次校验 | 同上 |
| 34 | 状态页/通告 | 平台级聚合，不含租户明细 | 渲染含租户名即契约测试失败 | 同上 |

**跨文件一致性**：五文件的 `RedisKeys` 纪律统一为「**除显式登记白名单外，首变参恒为 `tenantId`**」，并各自补「读路径二次校验」；异常语义统一为 `TENANT_CONTEXT_MISSING`（缺上下文）与 `CROSS_TENANT_DENIED`（越界），越界一律 SEV2（冻结 + 取证 + 告警）。

---

## 三、组织与身份生命周期完整性（含资产交接与吊销 SLA）

| 阶段 | 24 调用方 | 25 组织/成员 | 26（成本数据） | 29 生态身份面 | 34（运维面） |
| --- | --- | --- | --- | --- | --- |
| 登记/邀请 | `a2a.caller.registered`（未激活不可调用） | 邀请一次性票据 TTL 72h；未激活不参与求值、不占席位 | — | IM 绑定挑战码；IDE 连接令牌签发 | — |
| 激活 | 首次认证 + scope 完整性校验（缺则降只读） | SSO JIT 最小角色 + 域独占 + 速率阈值 | — | 深链首次确认 | — |
| 角色/归属变更 | scope **只可收窄或显式追加**（记 `granted_by`） | 角色变更乐观锁 + MFA + 前后值审计；组映射 1s 内一致 | 预算/配额作用域变更双人复核 | 群组/团队映射导入 | 值班权限变更审计 |
| 暂停 | SUSPENDED：新提交 ≤ 60s 内拒；存量安全点取消 | SUSPENDED：吊销扇出 ≤ 5 分钟 | 熔断仅作用自治任务 | 相关面拒绝（fail-closed） | 租户熔断需审批 |
| 离职/注销 | DEPROVISIONED：级联吊销 5 类凭据/授权 + fail-closed | 吊销扇出 7 类 + **资产交接 30 天窗口**、未认领 90 天告警 → 合规删除评估 | 账本保留、明细去标识化（R06 补） | IDE 令牌/IM 绑定/深链/CI 引用四类 ≤ 5 分钟失效 | `tenant_ref` 资产随租户删除联动（卷 19） |
| 数据保留/删除 | 复用 25 §7.1（级联删除 + tombstone + DEK 销毁） | 删除证明 + 审计按留存策略**不提前删** | **禁止**为删除而删账本（会断对账） | 快照按 7/30 天清理，无长期驻留 | 证据按 `retention_days`，事故证据可单独延长 |
| SCIM 对账 | — | **全量漂移对账**（默认每日 03:00）：四类差异；漏建/漏删自动修复，**角色类只报告**；漂移率 > 0.5% 告警 | — | — | — |

**修复的关键缺口**：① 24 调用方生命周期原只有「吊销」一句，缺「登记→激活→变更→暂停→注销」全链与资产/授权交接；② 25 缺**离职资产交接**（原仅「工作对象归属可转移」一句）与**SCIM 漂移对账**（原只有增量 + 冲突清单）；③ 26 缺租户/主体注销时计量数据的处置边界；④ 29 缺生态侧身份面（IDE 令牌/IM 绑定/深链/CI 凭据）的吊销扇出与结果上报；⑤ 34 缺运维面租户边界（原仅一条 DoD 勾选项）。

---

## 四、配额与成本治理执行点（「谁在花多少钱」可答性）

| 阶段 | 执行点 | 手段 | 超限行为 | 落点 |
| --- | --- | --- | --- | --- |
| 准入前 pre-flight | 模型/工具调用前、A2A 提交前、自治回合前 | `QuotaGate` 四级取最紧 + 预测式放宽 + Redis Lua 多级预扣 | `cost.quota.exceeded`（原因 + 命中维度 + 替代动作）；A2A `429 + Retry-After` | 26 §9.6 / 24 §9.8 |
| 在途 in-flight | 流式生成、长任务、外部任务并发 | 软区（预扣 × 1.2）/ 硬上限（任务/日配额）+ 并发计数 | `ABORT_STREAM` 或 `SUSPEND_FOR_APPROVAL`，**产出落库** + 显式标记 | 同上 |
| 事后 post-hoc | 调用/回合/日结/月账期 | 结算恰好一次 → 投影校验 → 对账（容差 1%）→ 账单导出 + `BillingSinkSPI` | 七类归因 + 追加式修正分录；账单缺失不静默通过 | 26 §9.6 / §9.2 `invoice-export` |

**归因 join 键**：`callerId → link_id → work_item_id / session_id → oc_usage_event(session_id, task_id, model_id, tool_name, business_stage)`；会话 / 项目 / 团队 / 模型 / 工具 / 缓存折扣六问各有明确 join 路径（26 §9.6 表）；维度缺失记 `oc_cost_attribution_missing_total`，**禁止**静默归入「未知/父级」。

**修复的关键缺口**：① 26 原缺「对外账单/报表导出」端点（`BillingSinkSPI` 在 25 登记却无实现落点）；② 原缺归因 join 键的成文（只说六维，未说「怎么 join、缺了怎么办」）；③ 24 原缺外部调用方用量/预算对账面与 `callerId` 归因附加维度；④ Redis 键原缺租户段（预扣/幂等键跨租户碰撞会让 A 的重复提交命中 B 的任务）。

---

## 五、可运维性：探针 / 指标 / 结构化日志 / Runbook 增量

**探针**：34 五层为内置下限；R06 要求四域按 `HealthProbeSPI` 注册独立层（`ENT` / `COST` / `A2A` / `ECO`），`/deep?layers=` 子集调用，均为**功能探测**（IdP 断言算法自检、预扣路径可写、A2A 回环自检提交、Registry 签名链可用），并把 `oc doctor --deep --format json` 的 `jq` 断言由 `length==5` 放宽为 `>=5`。

**新增 Runbook 首命令（34 条，全部「告警 → 首命令 → 停止条件 → 升级」四元组）**：

| 域 | Runbook | 代表首命令 | 停止条件示例 |
| --- | --- | --- | --- |
| 24 A2A | RB-A2A-01…06 | `oc doctor --deep --layers=a2a`；`POST /a2a/v1/federation/nodes/{id}/suspend` | 恢复或已暂停问题调用方；审批不可放行（超时默认拒绝） |
| 25 IAM | RB-ENT-01…07 | `POST /identity-providers/{id}/scim/reconcile`；`POST /api/v1/audit/chain/verify` | 已冻结分区 + 已取证 + 已通告（SEV1/SEV2） |
| 26 Cost | RB-COST-01…07 | `GET /api/v1/cost/usage` 下钻 Top3；重跑预扣回收（幂等） | 仅自治暂停、人工保留；差异 ≤ 1% |
| 29 Eco | RB-ECO-01…07 | 切换私仓镜像/本地缓存（**只读降级**）；`GET /api/v1/eco/registry/sync` 续传 | 安装路径仍 fail-closed；门禁不得跳过 |
| 34 Ops | 34 §9.6 索引（卷 32 12 条 + 跨域 4 行） | `oc ops runbook run RB-01`… | 15/30/60min 四级升级；**禁止**以下调阈值/关告警作为处置 |

**统一纪律**：首命令必须幂等可重跑；未绑定 Runbook 的告警不允许上线（卷 32 §3 + 34 REQ-OPS-10），因此 34 §9.6 索引与 `oc_ops_alert_rule.runbook_id` 差集为空由契约测试守住。

---

## 六、外部 SLA 面与版本弃用（A2A / SDK / CI / IDE / Registry）

- **24 §10.2 新增「对外 SLA 面」表**：限流（60 RPM/突发 10，超限 429 + `Retry-After` + 排队位置）、配额（五类调用方默认 + 日预算 + 单任务信封）、错误契约（`retryable` 逐码声明）、版本（`protocolVersion` 交集 + 兼容期 ≥ 2 小版本）、弃用（公告 ≥ 1 小版本 + 弃用期 ≥ 2 小版本 + `Deprecation`/`Sunset` 头）。
- **29 §9.6 新增五类消费面 SLA 表**（SDK / CI / IDE / IM / Registry）+ **破坏性变更政策**：破坏性变更走「公告 → 双栈 → 弃用告警 → 弃用期后移除」并登记 `DECISIONS.md`；非破坏性变更（只增）可直接发布但消费端须容忍新增枚举值；生成物兼容性由漂移校验与 `kernel_range` 机械守住，禁止人工宣称「向后兼容」。
- **与 27 的一致性**：27 已定义「协议版本协商 + 双栈并存 + 迁移演练 + 回滚」，**未定义弃用期长度**；三文件（24/25/29）统一采用附录 B §B.8 的「≥ 2 小版本」，并在 findings 登记「建议 27 增补弃用期条款」；若 27 后续收紧则以 27 为准（口径已写入各文件）。

---

## 七、验收命令（可直接运行）

```bash
# 隔离矩阵逐行对抗（每域独立，任一组「通过」即失败）
scripts/ci/tenant-isolation-scan.sh --surface a2a|ent|cost|eco|ops

# 生命周期 / 对账 / 归因（R06 新增用例）
mvn -pl harness-host/host-enterprise test -Dtest='ScimDriftReconcile*Test,Handover*Test,CredentialRevocation*Test'
mvn -pl harness-platform/platform-persistence test -Dtest='InvoiceExport*Test,CostAttributionJoin*Test'
mvn -pl harness-platform/platform-eco test -Dtest='EcoIdentityRevocation*Test,SearchTenantLeak*Test'
mvn -pl harness-platform/platform-ops test -Dtest='OncallIndexContractTest'

# 探针与 Runbook 冒烟（各域层 + 幂等）
oc doctor --deep --format json --layers ent && oc ops runbook run RB-ENT-03 --dry-run
oc doctor --deep --format json --layers cost && oc ops runbook run RB-COST-02 --dry-run
oc doctor --deep --format json --layers a2a && oc ops runbook run RB-A2A-01 --dry-run
oc doctor --deep --format json --layers eco && oc ops runbook run RB-ECO-05 --dry-run
oc doctor --deep --format json > /tmp/doctor.json && jq -e '.layers|length>=5' /tmp/doctor.json
```

---

## 八、残余问题与依赖修订（不阻塞本轮，需在后续轮次/卷册闭合）

1. **27 缺弃用期条款**（P1）：三文件已统一口径为「≥ 2 小版本」，但 27 作为交付路径权威未写；建议在 27 增补「对外契约弃用与破坏性变更流程」小节，否则 24 §10.2 / 29 §9.6 的引用在终局审计时会被判为「引用未定义条款」。
2. **卷 32 未登记四域 Runbook 编号**（P1）：RB-A2A/RB-ENT/RB-COST/RB-ECO 共 34 条的权威清单目前分散在四份 impl；卷 32 §3/§4 补登后需同步「告警规则 ≥ 12 条」与「Runbook ≥ 10 条」的 DoD 计数（卷 32 §9）。
3. **卷 24 §4.10 缺两行**（P1）：① 身份与资产交接（离职资产不得孤儿化）；② 跨租户共享域（联邦目录 / 共享知识域 / 公共 Registry 元数据）必须显式声明可见租户集合。本文件已按「显式登记 + 路由期校验」实现，但清单未收口。
4. **34 §9.3 探针层注册契约未成文**（P2）：本文件要求域层注册，但 34 原文档只定义五层；已用「建议修订」登记，若 34 采纳需同步 `/deep` 的层数断言与 DoD 计数。
5. **「公共 Registry 元数据」的共享域属性需一次法务/合规确认**（P2）：当前按「只含制品元数据、写入前敏感扫描」处置（29 §8.5），若客户要求制品元数据也按租户隔离，需评估私仓强制模式（`registry-mirror-enabled` 默认关，企业模式开启）。
6. **成本归因对 A2A 外部调用方的口径**（P2）：`callerId` 作为附加维度写入 `oc_usage_event`，但 26 的六维滚动聚合表 PK 未含 `callerId`；若客户要求「按调用方出账」，需评估扩展 `oc_usage_rollup_hourly` PK（存储成本 vs 查询性能），当前以 `oc_usage_event` 明细 + 对账导出承接。
7. **SLA 量化缺口（口头承诺风险）**（P2）：五文件的 SLA 均为「≤ 5 分钟吊销」「≤ 60s 暂停生效」「≤ 300s P99」等**内部目标**，尚无对外合同级 SLA 文本（可用性 99.9% 等见卷 24 §4.7）；企业采购若要求 SLA 条款与罚则，需产品/法务侧单独产出（非技术文档范围）。

---

## 九、结论

- **多租户隔离可证明性**：五文件 × 七类资源共 **37 行**矩阵，全部具备「机制 + 运行时阻断 + 泄漏用例」三要素；原先 12 处「按约定过滤」表述已升级为运行时检查（拦截器抛错而非返回空、Key 二次校验、签名 URL 身份绑定、批次行归属校验、分区一致性校验），并补齐 3 处结构性缺口（26/29/24 的 Redis 键租户段、29 两张表缺租户列、34 缺 `tenant_ref` 列）。
- **身份生命周期**：从「吊销」单点补成「邀请→激活→变更→暂停→离职→交接→删除」闭环；离职吊销 SLA ≤ 5 分钟且未确认期间 fail-closed；新增 SCIM 漂移对账（漏删优先自动修复、角色类只报告）。
- **成本与配额治理**：准入 / 在途 / 事后三段式全部有成文执行点与断言；对客账单导出路径补齐（`invoice-export` + `BillingSinkSPI`）；归因 join 键与「缺维度即告警」不变量落地。
- **可运维性**：五文件均具备探针（含功能探测）+ 具名指标 + 结构化日志字段 + Runbook 首命令 + 3am 行动索引；34 §9.6 把「告警→首命令→停止条件→升级」变成唯一索引。
- **未修复项**：§八 共 7 条，全部为**跨卷册/需评审**类（不可在本轮五文件内闭合），已按「只登记不改卷」纪律分散登记到各文件 §依赖修订 与本文件；无「本文件内可修而未修」的违规项。
