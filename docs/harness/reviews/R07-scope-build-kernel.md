# R07 · 构建与落地就绪评审（镜头：模块落点 / 实施顺序 / 数据批次 / CI 门禁 / 并行度）

> 评审轮次：REVIEW ROUND 7（镜头：**可落地性与实施顺序**——把「设计能落成 reactor」这句话验到**模块路径、步号、批次号、可执行命令**四个机械层）
> 范围：`impl/01-kernel-runtime-impl.md` … `impl/18-plugin-runtime-impl.md`（18 文件）+ 本文件
> 参照基准：`27-technical-path.md` §4.1 仓库结构（四段式）、§4.2 依赖规则 R1–R5、§4.3 设计→代码映射（26 卷落点）、§4.4 数据迁移批次 B1–B6、§4.5 关键机制 20 步、§4.6 CI 门禁；`01-harness-architecture.md` §4.2 三带与 §4.5 模块铁律；`appendix-a-domain-model.md` §A.6/A.9（表族与 B7 声明）
> 交付约束：**只增不改**——未删除任何 REQ / I-* 编号与既有小节；本文件不改动冻结卷册与 `IMPL-DECISIONS.md` §4 台账（X 条目在此登记，由终局审计回填）
> 结论摘要：**模块命名双轨已在本 18 文件内收敛为目标 reactor 名**（v1 名降级为「迁移来源」列，共 7 文件改写落点表、4 文件改写 Mermaid 图标签）；**发现 4 处成环/缺步**（01↔16、02↔03↔04、05↔17、04/17 无步号）并以「契约先行 + 插入步 2.5/11.5」给出可执行解法；**未映射表 19 张**（上下文 6 + 提示词 6 + 沙箱 6 + 能力门控 1）登记 7 条 X 修订建议（X-83…X-89）；**CI 命令 11 处不可执行已修复**（7 处 v1 模块名/目录、2 处缺 `-am`、3 处 `-P` 空格，另对跨 `-am` 的 `-Dtest` 统一补 `-DfailIfNoTests=false`）。

---

## 一、模块落点核对（18 文件 × 卷 27 §4.1/§4.3）

判定口径：① 文件必须给出**具体 Maven 模块**（可作 `-pl` 选择器）；② 模块名必须是 §4.1 的 `harness-*` 目标名；③ v1 名只允许出现在标注「迁移来源」的列/注释中。

| # | impl 文件（卷） | 卷 27 §4.3 规定落点 | 修复后文件声明的模块 | 一致？ | R07 处置 |
| --- | --- | --- | --- | --- | --- |
| 01 | 01 内核与运行时 | `harness-contract` + `host-bootstrap` | contract + `kernel-agent(session)` + host-{app,bootstrap,protocol,cli,server} + `client/*` | ✅ | §1.4 表重写（原表把 v1 名写成「迁移后」列，语义倒置）；3 处 Mermaid 标签 + 2 处行内铁律改名 |
| 02 | 02 模型网关 | `kernel-model` + `platform-*` | `kernel-model` + contract + `platform-{enterprise,runtime-store,persistence}` | ✅ | 补「模块归属」目标名；Mermaid 标签改名 |
| 03 | 03 上下文引擎 | `kernel-context` | `kernel-context` + contract + `platform-persistence` + `host-{protocol,bootstrap}` | ✅ | Mermaid 标签 ×2 改名；行内铁律改名 |
| 04 | 04 提示词 | `kernel-prompt` | `kernel-prompt` + contract + `platform-persistence` + `host-{bootstrap,protocol}` | ✅ | Mermaid 标签 ×2 改名；行内铁律改名 |
| 05 | 05 工具系统 | `kernel-tool` | contract + `kernel-tool` + `platform-{sandbox,workspace,runtime-store,persistence}` | ✅（v1 曾放 `core-agent`） | §1.4 表整体改为目标名 + v1 列；管线/调度/账本收敛到 `kernel-tool`（§4.3 权威） |
| 06 | 06 权限 | `kernel-permission` | contract + `kernel-permission` + `platform-{persistence,runtime-store}` + `host-{protocol,app}` | ✅（v1 曾放 `core-agent`） | §1.4 表整体改为目标名 + v1 列 |
| 07 | 07 沙箱 | `platform-sandbox` | contract + `kernel-agent(决策)` + `platform-sandbox` + `platform-persistence` | ✅ | §1.4 表改 5 列（目标/v1/装配）；§7 装配点改名 |
| 08 | 08 技能 | `platform-skill` | contract + `kernel-agent(纯决策)` + `platform-skill` + `platform-persistence` | ✅ | §1.4 表改 5 列；§7 装配点改名 |
| 09 | 09 MCP | `platform-mcp` | contract + `platform-mcp` + `platform-persistence` + host-{bootstrap,protocol} | ✅ | 补落地核对块；命令补 `-am` |
| 10 | 10 记忆 | `platform-memory` + kernel（召回模型） | `platform-memory` + contract（RRF 纯函数）+ `kernel-context`（S4 注入） | ✅ | 补落地核对块；命令补 `-am` |
| 11 | 11 知识 | `platform-knowledge` | contract + `platform-knowledge` + `platform-persistence` + `host-{app,protocol}` | ✅ | 补落地核对块（目录树已是目标名） |
| 12 | 12 Agent | `kernel-agent` | `kernel-agent` + contract + `platform-persistence` + `host-{protocol,bootstrap}` | ✅ | 补落地核对块 |
| 13 | 13 Teams | `kernel-agent` + `host-app` | contract + `kernel-agent(team)` + `platform-{persistence,vcs}` + `host-{app,protocol}` | ✅ | 补落地核对块（短名展开为全路径） |
| 14 | 14 任务 | `kernel-work` | contract + `kernel-work` + `platform-persistence` + `host-{app,protocol}` | ✅ | 补落地核对块（短名展开） |
| 15 | 15 Goal/Schedule | `kernel-work` + `host-server`（调度器） | contract + `kernel-work` + `platform-{persistence,runtime-store}` + `host-{app,server,protocol}` | ✅（**R07 补 `host-server`**） | 目录树新增 `SchedulerRunner` 行 + 宿主唯一性纪律；命令新增 host-server 一行 |
| 16 | 16 事件 | `kernel-event` + `platform-persistence` | contract + `kernel-event` + `platform-persistence` + `platform-runtime-store` + `host-{app,protocol}` | ✅ | 补落地核对块（含与 01 的契约边界声明） |
| 17 | 17 Hooks | `platform-hooks` | contract + `kernel-agent` + `platform-hooks` + `platform-persistence` + host-{protocol,bootstrap} | ✅（原为 v1 名） | §1.4 表改为目标名 + v1 列；映射注重写为「命令只允许目标名」 |
| 18 | 18 插件 | `platform-plugin` + `harness-contract`（SPI） | contract + `platform-plugin`（`pure`/`config` 分包）+ `platform-persistence` + host-{protocol,bootstrap} + `tools/plugin-sdk` | ⚠️（SDK 模块 §4.1 未命名） | §1.4 表改为目标名；SDK 落点登记 X-88 |

**双轨结论**：18 文件中 7 个（01/05/06/07/08/17/18）原以 v1 名为主表列，本轮全部改为「目标模块」主列 + 「v1 迁移来源」副列；`harness-core` / `harness-surface` 仅作为卷 01 §4.2 别名保留在 4 个文件的图标签与 3 处行内说明中，且均显式标注「非 reactor 路径、禁作 `-pl` 选择器」。

## 二、实施顺序核对（卷 27 §4.5 20 步 × 本 18 系统）

**依赖有序列表（层内可并行，层间串行）**：

| 序 | 系统（impl） | 步号（§4.5） | 硬前置 | 说明 |
| --- | --- | --- | --- | --- |
| L0 | 01 内核骨架 + 16 事件信封 | 1、2 | — | 同一批交付：契约骨架 + Enforcer（步 1）与事件写入端口 + 内存实现（步 2）互为前提，二者以 `harness-contract` 中的 `EventEnvelope`/`EventAppenderPort` 为唯一接缝 |
| L1 | 02 模型网关 | 3 | L0 | 先 1 个协议 + 假模型即可解锁下游 |
| L2 | 04 提示词最小集 | **无步号（建议 2.5）** | L0 | 02 的 `promptFamily` 声明与 05 的模型侧投射都需要最小资产集，故必须早于 L3 |
| L3 | 05 工具运行时 | 4 | L0、L1 | read/edit/command 三工具闭环 |
| L4 | 12 Agent 主循环 | 5 | L1–L3 | 全序列首个「真实任务」集成点 |
| L5 | 06 权限决策链 | 7 | L3 | §4.5 只依赖步 4，可与 L4 并行；审批多通道随步 8 增补 |
| L6 | 03 上下文引擎 | 6、10 | L4 | 结构索引（I-CTX-4）实际依赖 11（步 16）→ 该特性顺延，03 主干降级可用 |
| L7 | 07 沙箱（L0+） | 11 | L3 | L1/L2/L3 档位顺延至 12/20 步 |
| L8 | 17 Hooks | **无步号（建议 11.5）** | L3、L5、L7 | 契约先行（`HookPoint` 入 contract）→ 与 05 不成环 |
| L9 | 14 任务/计划 | 14 | L4、L6 | 下游 08/09/13/15 的工作对象 |
| L10 | 10 记忆 + 11 知识 | 16 | L6 | 二者表族与权限独立，可双队并行 |
| L11 | 08 Skill + 09 MCP | 17 | L3、L9 | MCP 工具经 05 统一管线注册 |
| L12 | 18 插件 | 18 | L11 | 扩展点目录契约先行，可与 11 并行开发、第 18 步收口 |
| L13 | 13 Teams + 15 Goal/Schedule | 19、13（物理） | L9、L10、L12、（vcs 步 13） | Teams 的隔离/合并依赖步 13（Git+worktree）；Goal 复用 12 的 `oc_checkpoint`（禁第二套） |

**环路与不可行点（4 处，均已在文件内声明解法）**：

| # | 环路/缺口 | 表现 | 解法（已写入文件） |
| --- | --- | --- | --- |
| C1 | 01 ↔ 16 | 01 §1.3 声明「上游为卷 16 事件信封」，16 的持久订阅与会话有序分区依赖 01 的会话运行时 | 信封与追加端口定义进 `harness-contract`；01 只消费端口 → 无编译环（01 §1.3/§落地核对、16 §落地核对） |
| C2 | 02 ↔ 03 ↔ 04 | 02 需 04 的 `promptFamily`；03 需 02 的 `ModelCapability`；04 需 03 的 `PromptAssemblyRequest` | 三类型入 contract，三方自步 2 起并行；**04 无步号**是真实缺口 → X-86 |
| C3 | 05 ↔ 17 | 05 依赖 17 的四个钩子点；17 的钩子点语义定义在 05/06 管线插入位 | 枚举与决策 record 入 contract（默认 no-op 实现）；17 整体顺延至步 11.5 → X-87 |
| C4 | 03 → 11（跨步） | I-CTX-4 结构索引（符号图）落在 `platform-knowledge`（步 16），晚于 03（步 6/10） | 03 仅依赖 `SymbolIndexSPI` 端口，符号图未就绪时按「无结构索引」降级（03 §③ B2 已有降级口径） |

**顺序纪律（本轮新增为契约）**：任何 impl 文件不得声明「依赖晚于自身步号且无契约兜底」的强前置；违反即视为顺序缺陷（与 C2/C3 同类）。

## 三、数据迁移批次核对（卷 27 §4.4 B1–B6）

**已映射**（18 文件中已明确的表，按批次归位）：B1 = `oc_session*`/`oc_turn`/`oc_item`/`oc_checkpoint`/`oc_event_log`/`oc_projection_offset|state`/`oc_dead_letter`/`oc_consumer_offset`/`oc_consumer_idempotency`/`oc_event_producer_idempotency`/`oc_event_seq`/`oc_event_deadletter`/`oc_event_archive`/`oc_event_purge_proof`/`oc_webhook_subscription`/`oc_thread`/`oc_agent_input`；B2 = `oc_provider`/`oc_model_descriptor`/`oc_model_call`/`oc_usage_record`/`oc_usage_hourly`/`oc_route_rule`/`oc_credential`/`oc_tool_call`/`oc_tool_result`/`oc_tool_registration`/`oc_tool_artifact`/`oc_tool_side_effect`（≡ `oc_side_effect_ledger`，唯一物理表）；B3 = `oc_policy*`/`oc_permission_decision`/`oc_approval`/`oc_grant_memory`/`oc_decision_replay`/`oc_audit_event`/`oc_audit_anchor`；B4 = `oc_work_item*`/`oc_agent_definition`/`oc_guard_trip`/`oc_trajectory_export`/`oc_team*`/`oc_goal*`/`oc_schedule*`；B5 = `oc_memory_*`/`oc_kb_*`/`oc_memory_index_task`；B6 = `oc_skill_*`/`oc_mcp_*`/`oc_hook*`/`oc_plugin`/`oc_plugin_version`/`oc_plugin_grant`/`oc_plugin_health`/`oc_extension_registry`。

**未映射表（19 张，需新批次或扩展批次）**：

| 表 | 来源文件 | 建议归位 | 理由 |
| --- | --- | --- | --- |
| `oc_context_snapshot` / `oc_context_checkpoint` / `oc_context_ref` / `oc_context_source_state` / `oc_context_compaction` / `oc_context_injection_scan` | 03 | **B1 扩展子批 B1b（会话派生结构）** | 全部随会话生命周期；B1 只写了「会话基础表」，派生结构无色位 |
| `oc_prompt_asset` / `oc_prompt_asset_version` / `oc_prompt_release` / `oc_prompt_gray_arm` / `oc_prompt_assembly_log` / `oc_prompt_drift_finding` | 04 | **B1b 或 B6** | 资产库是组织级配置而非会话派生；若按 B6（资产类）需接受其晚于 B2 的可用性 |
| `oc_sandbox_plan` / `oc_execution_record` / `oc_sandbox_violation` / `oc_sandbox_capability` / `oc_snapshot_ref` / `oc_credential_lease` | 07 | **B2 扩展** | 工具执行面附属记录，与 `oc_tool_call` 同生命周期 |
| `oc_capability_gate` | 01 | **B1 扩展** | 装配门控与降级留痕，随会话/实例启动记录 |

**其他对账发现**：附录 A.6 示例名为 `oc_workitem`/`oc_workitem_dep`/`oc_evidence`，impl/14 用 `oc_work_item*` 长前缀 → **表名分歧**需在 B4 脚本落地前统一（本文件不自改卷册，登记 X-89）。

## 四、CI 门禁命令可执行性（卷 27 §4.6）

判定口径：命令必须 ① 用目标模块路径（可作 `-pl`）；② 与 `-am` 搭配；③ 跨 `-am` 用 `-Dtest` 过滤时必须 `-DfailIfNoTests=false`；④ profile 用 `-P<name>`（无空格）。

| 文件:行 | 原命令 | 问题 | 修复 |
| --- | --- | --- | --- |
| 17 §11.5 ×4 | `open-coding-core-agent` / `-infrastructure` / `-bootstrap` | v1 模块名（非 reactor 路径） | → `harness-kernel/kernel-agent` / `harness-platform/platform-hooks` / `harness-host/host-bootstrap` |
| 18 §11.5 ×4 | `open-coding-core-implementation` / `-infrastructure` / `-bootstrap` / `cd open-coding-plugin` | v1 模块名 + 目录不存在 | → `platform-plugin`（×2，pure 包纪律）、`host-bootstrap`、`cd tools/plugin-sdk` |
| 17 §11.5 | `mvn -pl host-bootstrap -am verify -P hook-gates` | `-P` 与 profile 名间有空格（Maven 解析为 goal） | → `-Phook-gates` |
| 18 §11.5 | `... verify -P plugin-gates` / `-P plugin-e2e` | 同上 | → `-Pplugin-gates` / `-Pplugin-e2e` |
| 09 §11.5 ×2 | `mvn -pl harness-platform/platform-mcp test`（无 `-am`） | 未安装上游依赖时失败 | 补 `-am` |
| 10 §11.5 | `mvn -pl harness-platform/platform-memory test` | 同上 | 补 `-am` |
| 03/04/07/08/17/18 各 `-Dtest` 行 | `-pl <leaf> -am test -Dtest='…'` | 上游模块无匹配用例 → surefire「No tests were executed」失败 | 统一补 `-DfailIfNoTests=false` |
| 07 §11.5 / 08 §11.5 | `mvn -pl harness-kernel -am test -Dtest='…'` | 聚合选择器跨 8 个子模块跑同一过滤，定位模糊 | → leaf 路径 `harness-kernel/kernel-agent`（决策纯函数所在模块） |
| 15 §11.5 | 缺少调度器宿主验收 | §4.3 要求 `host-server` 落点无验收 | 新增 `mvn -pl harness-host/host-server -am test`（`SchedulerRunner` 租约抢占/错过补跑） |

**门禁映射（每文件已补一行「门禁映射」）**：内核单测 → 「单元测试 + 覆盖率门」；PG/Redis 容器 → 「集成测试」；协议/事件/SPI/适配一致性 → 「契约测试」；`*/gate.sh` → 「安全红队 / 性能基准（抽样）」；离线评测挂钩 → 「离线评测（核心集，按变更矩阵选子集）」。**缺口**：§4.6 首门「格式与规范（编码规范 + 提交信息）」与「依赖规则 R1–R5」在本 18 文件中仅 01（类型计数门禁）与 05/06（ArchUnit）声明，其余文件未显式挂门 → 建议由 `scripts/ci/all.sh` 统一承载，无需逐文件重复（登记为余项）。

## 五、并行度与团队边界

| 并行组 | 成员 | 共用接缝（唯一集成点） | 团队边界风险 |
| --- | --- | --- | --- |
| P0（步 1–2） | 01 ∥ 16 | `harness-contract` 事件信封与端口 | **同族两队改同一契约包**：必须契约先行锁定，禁止各自加字段（C1 的根因） |
| P1（步 3–4） | 02 ∥ 04 ∥ 05 | canonical 模型 / `PromptArtifact` / `ToolSchemaProjector` | 02 与 04 的 `promptFamily` 若被 04 改语义，02 需回归（C2 根因） |
| P2（步 5–7） | 12 ∥ 06 ∥ 03 | `ActionDescriptor` / `ModelCapability` / 预算信封 | 12 是首个集成点：03/06 任一延期即阻塞 12 的 DoD |
| P3（步 11–11.5） | 07 ∥ 17 | `SandboxPlanRequest` / `HookPoint` 枚举 | 17 无步号：接入窗口易被 07 吞掉 → 需显式占位（X-87） |
| P4（步 14–18） | 14 ∥ 10 ∥ 11 ∥ 08 ∥ 09 ∥ 18 | WorkItem 端口 / `EmbeddingProviderSPI` / 扩展点目录 | 08/09/18 三队同抢 `platform-plugin` 与扩展点目录 → 目录归属需指定单一 owner |
| P5（步 19） | 13 ∥ 15 | 团队账本 ↔ 目标预算 / `oc_checkpoint` 唯一口径 | 两队同时改检查点语义的风险 → 12 的 I-AG-9 为唯一权威 |

**不可并行（串行）**：01/16 →（02、04）→ 05 → 12 → {03, 06} → 14 → {08, 09} → 18 → {13, 15}。**建议冻结点**：契约包 `harness-contract` 每轮只允许一个 owner 合入（P0/P1 冲突的唯一护栏）。

## 六、I-* 决策可落点性核对

18 文件共 **127 条 I- 决策**（按 `IMPL-DECISIONS.md` §2 各域登记数：ARC 7 + MDL 7 + CTX 6 + PRM 5 + TOOL 5 + PERM 6 + SBOX 7 + SKILL 7 + MCP 6 + MEM 6 + KB 8 + AG 8 + TEAM 8 + TASK 8 + GOAL 9 + EVT 9 + HOOK 7 + PLG 7；`impl/12` 另含 R05 增量 `I-AG-9`；跨文件引用如 I-ARC-3/I-CTX-4/I-AG-9/I-PLG-5 不重复计）。R07 为**本域每条**补「模块 + 类」落点行（写入各文件「落地核对」块的 `I-* 落点` 条目）：

- 落点完整（模块 + 类名齐备）：01/02/03/04/05/06/07/08/09/10/11/12/13/14/15/16/17/18 全部 18 文件（本轮新增）。
- 需注意的**跨模块**落点：I-CTX-4 → `platform-knowledge`（非 `kernel-context`）；I-TOOL-4 → `platform-sandbox`（非 `kernel-tool`）；I-PERM-4 → Redis 热层在 `platform-runtime-store`、冷层在 `platform-persistence`；I-PLG-1/6 → 契约侧在 `harness-contract`。
- **口径差异（已登记，未改卷册）**：impl/05 原把 `ToolRuntime`/`ToolScheduler` 放 `core-agent`，与 §4.3「卷 05 → kernel-tool（执行管线）」不一致 → 本轮按 §4.3 收敛到 `kernel-tool`，v1 放置记入「迁移来源」列。

## 七、X 修订建议（写入本文件，回填 `IMPL-DECISIONS.md` §4，编号续 X-82）

| 编号 | 建议内容 | 触发来源 | 建议落点 | 状态 |
| --- | --- | --- | --- | --- |
| X-83 | §4.4 B1 增列「B1b 会话派生结构子批」：上下文快照/引用/压缩/注入扫描 6 表随 `oc_session` 同批 | impl/03 §落地核对 | 卷 27 §4.4 | 待终局审计 |
| X-84 | §4.4 B1–B6 增列「提示词资产」表族（6 表）归位（建议 B6 或 B1b） | impl/04 §落地核对 | 卷 27 §4.4 | 待终局审计 |
| X-85 | 沙箱执行面 6 表并入 B2 扩展（与 `oc_tool_call` 同生命周期）；`oc_capability_gate` 并入 B1 | impl/07、impl/01 §落地核对 | 卷 27 §4.4 | 待终局审计 |
| X-86 | §4.5 20 步插入「步 2.5：提示词资产最小集（模板 + 组装 + 指纹）」 | impl/04 §落地核对（C2） | 卷 27 §4.5 | 待终局审计 |
| X-87 | §4.5 20 步插入「步 11.5：Hooks（目录 + 进程内/脚本两形态）」 | impl/17 §落地核对（C3） | 卷 27 §4.5 | 待终局审计 |
| X-88 | §4.1 为插件开发套件命名模块（建议 `tools/plugin-sdk`，仅依赖 `harness-contract`） | impl/18 §1.4 命名缺口 | 卷 27 §4.1/§4.3 | 待终局审计 |
| X-89 | 统一工作对象表名：附录 A.6 `oc_workitem*` vs impl/14 `oc_work_item*`（B4 脚本落地前必须定名） | 本文件 §三 | 附录 A.6 + 卷 27 §4.4 | 待终局审计 |

## 八、残余风险

1. **`harness-kernel` 聚合选择器的语义依赖**：01/07/08 曾用 `-pl harness-kernel`；本轮已把 07/08 收敛为 leaf 路径，01 保留聚合（其验收本就是全内核）。若 Maven 版本对聚合选择器行为变化，01 需显式枚举子模块 → 建议在 `scripts/ci` 用 profile 固化。
2. **17/18 的步号缺位**：即使采用 X-86/X-87，若排期不显式占位，Hooks 与提示词将被「隐式前置」吞掉（P3/P1 风险）；本轮已在两文件写入建议步号与契约先行纪律，但仍需排期确认。
3. **表名与表族两处口径未定**：X-83–X-85、X-89 未裁决前，B1/B2/B4 迁移脚本无法冻结；建议在 M1 契约冻结时一并裁决（与卷 27 §4.4「每批次独立可回滚」配套）。
4. **`platform-plugin` 承载三重职责**（类加载/宿主/纯逻辑），与 R1 精神有张力：本轮以「`pure` 子包零 Spring + `config` 子包装配」的包级纪律兜底，若 H-003 类型计数门禁触发，优先把 `pure` 包迁往 kernel 侧（登记为回退预案，不新增模块）。
5. **门禁首层未逐文件挂载**：格式/规范与 R1–R5 依赖校验依赖 CI 统一脚本；若团队在本地只跑 `-pl <module>` 命令，可能出现「本地绿、CI 红」的错位。
