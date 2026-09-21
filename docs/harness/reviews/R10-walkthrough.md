# R10 · 可开工性走查（模拟新人第一周：从零到第一个可编译骨架）

> 轮次：R10（Phase B 自审查第 10 轮）· 镜头：**可开工性（implementability walkthrough）**——一个没读过任何一页、但对 Java 21 / Spring Boot / Maven 熟练的资深工程师，仅凭 `docs/harness/` 与现有仓库，能否在第一天写出第一个能编译的 PR。
> 取证方式：严格按给定脚本逐步行走，所有结论带 `file:line`（行号以本次读取为准）；本轮**只新增本文件**，不改 README/台账/任何卷册（findings 一律留给编排方处置）。
> 判级口径：`阻塞开工` = 不澄清就写不出第一个能编译/能跑的 PR；`增加返工` = 能开工但必然二次返工；`文档瑕疵` = 不影响开工，只影响体验。

## 〇、结论摘要（先读）

| 指标 | 值 |
| --- | --- |
| 阻塞开工（B1–B9） | **9** |
| 增加返工（R1–R7） | **7** |
| 文档瑕疵（D1–D4） | **4** |
| 能否仅凭文档产出「可编译骨架」 | **否**——缺 `ErrorCode` 定义、12 个端口无方法签名、载荷 record 无字段（§六 B7/B8） |
| 能否仅凭文档写出「第一份 Flyway 迁移」 | **否**——B1 表清单在 01/12/19 三处互斥（B6），`oc_event_log` 约束口径三处互斥（B4） |
| 能否本地零模型跑通「会话→消息→流式→落库→恢复」 | **否**——无 fake provider 装配面，`kernel-qa` 等模块未登记（R4/R2/B1） |
| 最阻塞的单点 | **B1 模块清单不可唯一确定**：24 个模块自述「待登记」，而 impl/01/33/34 的验收命令已按这些模块名书写（`-pl` 必失败） |

---

## 一、实际行走路径（我真实读了什么、按什么顺序）

按脚本第 1 步「找入口」，我实际走的路径（≈55 分钟，均为只读）：

1. `README.md` → 索引到 §2 卷册地图，但它是**全量索引**（36 卷 + 45 文件），没有「开工顺序」；§7 只给 10 条铁律，§3 给的是**写作骨架**（面向作者，不是面向实现者）。**没有指向实现层的入口**——我是靠文件名猜到 `impl/` 与 `27-technical-path.md` 的。
2. `impl/README.md` §1.3 给了三条依赖阅读路径（A: 01→12；B: 16→24；C: 25→35），这是本套文档**唯一**的开工序，但它是**阅读序**，不是**实现序**（实现序在 `27 §4.5` 的 20 步）。两份序号体系不同（例：阅读序 A 把 12 放最后，实现序把 12 放第 5 步）。
3. `27-technical-path.md` §4.1–§4.5：拿到模块目录树、依赖规则 R1–R5、数据批次 B1–B6、20 步实现序。**能建立心理模型，但不足以动手**（模块名是目录名，不是 Maven 坐标；见 §二）。
4. `impl/01-kernel-runtime-impl.md`：拿到 §1.4 模块映射表、§5 类图与 3 个 sealed 契约、§8 表/事件、§11 验收命令。这是最接近「开工手册」的一份。
5. 最小链路追踪：`impl/02`（模型）→ `impl/03`（上下文）→ `impl/12`（Agent）→ `impl/16`（事件）→ `impl/19`（持久化/恢复），并按脚本要求补读组件 `C01/C02/C03/C04/C06/C07/C22/C25` 的 §①/§⑤/§11。
6. 为第 4/5 步补读 `impl/33`（假模型/门禁）、`impl/34`（运维/探针）与 `impl/components/README.md`、`appendix-b`（协议与错误码）。
7. 交叉取证：`reviews/R07-scope-build-kernel.md`（模块落点与命令可执行性）、`impl/SUGGESTIONS.md`、`appendix-d`。

**入口摩擦（可直接修）**：README §2 索引行没有「开工必读四件套」指针。建议在 `README.md` §2 表下补一行：「动手前：`27-technical-path.md` §4（工程结构）→ `impl/README.md` §1.3/§3（阅读路径）→ `impl/01` §1.4+§11（宿主契约与命令）→ `impl/IMPL-DECISIONS.md` §4（未裁决修订）」。

## 二、第一个可编译骨架：我能唯一确定的 vs 必须猜的

### 2.1 可确定（卷 27 §4.1 权威，L97–132）

- 契约：`harness-contract`
- 内核：`harness-kernel/kernel-{model,context,prompt,tool,permission,agent,work,event}`
- 平台：`harness-platform/platform-{persistence,runtime-store,workspace,sandbox,vcs,knowledge,memory,enterprise,plugin,mcp,skill,hooks}`
- 外壳：`harness-host/host-{app,protocol,cli,server,a2a,bootstrap}`；前端 `client/{app,ui,sdk}`
- 依赖方向：R1–R5（L158–166）；包根：内核 `com.hk.opencoding.kernel.*`、外壳 `com.hk.opencoding.host.*`（impl/01 L42）；契约/平台包根可从样例反推（`com.hk.opencoding.contract.persistence`，impl/19 L343；`com.hk.opencoding.platform.persistence.recovery`，C25 L264）。

各模块首批类也可从类图/签名块抽出（示例）：契约层 `EventEnvelope/EventPayload/EventAppender`（impl/16 L352–420）、`AdmissionOutcome`（impl/01 L392–411）、`HostProfile`（impl/01 L386）；内核 `ModelGateway/ProtocolAdapter/StreamCursor/ContentBlock`（impl/02 L377–535）、`ContextEngine/ContextSection/TokenBudget/ArtifactRef`（impl/03 L308–455）、`AgentRuntime/ItemPayload/DeliveryMode/TurnPhase`（impl/12 L347–379）、`SessionRuntime/InputAdmission/SessionScope/SessionRunner/EventAppender/CheckpointWriter`（impl/01 L261–375）。

### 2.2 必须猜（每一条都会写进第一个 PR）

| # | 猜什么 | 为什么只能猜 | 建议改法 |
| --- | --- | --- | --- |
| G1 | Maven 坐标（groupId/artifactId/version） | 卷 27 §4.1（L94–138）只给目录名；`pom.xml` 只在 L96 出现一次且无字段。groupId 只能从现有 `pom.xml:7` 推 `com.hk.opencoding`，version 无所依 | 卷 27 §4.1 增「坐标表」：groupId 固定 `com.hk.opencoding`、artifactId=目录名、version 由父 POM `${opencoding.project.version}` 统一 |
| G2 | `harness-kernel`/`-platform`/`-host` 是否有聚合 POM | impl/01 L922 的 `mvn -pl harness-kernel -am test` 要求它存在；卷 27 §4.1 未列 `pom.xml` | 卷 27 §4.1 树内显式补 `harness-kernel/pom.xml` 等三行（聚合器） |
| G3 | 首 PR 的最小模块集 | 全树没有「第一个 PR 建哪些模块」的表述；20 步（卷 27 L214–235）只写机制不写模块 | 卷 27 §4.5 每步补「涉及模块」列，或新增 §4.5.1「首 PR 模块集」 |
| G4 | 24 个「扩展模块」的最终归属 | 见 B1；impl/25 L70、26 L67、27 L41、28 L42、29 L35/L42、30 L42、31 L79、32 L8、33 L8–9、34 L12–13、35 L69 全部自述「待登记」 | 在卷 27 §4.1 追加「扩展模块登记表」（模块名/首现文件/是否测试期）/或统一改写验收命令为聚合选择器 |
| G5 | v1 模块在 reactor 中的位置 | 卷 27 §4.1 树里没有 `open-coding-*`，但 §4.8.1 S1（L292–294）要求 v1/v2 并存；现有 `pom.xml:16–23` 仍是 v1 聚合 | 卷 27 §4.1 增注：「迁移期 `open-coding-*` 与 `harness-*` 同存于根 POM `<modules>`」 |
| G6 | Enforcer 的实现形态 | 卷 27 L373 默认「Maven Enforcer + 自定义规则（或 ArchUnit 作为补充）」——二选一未定，影响第一个 PR 的 pom 与测试目录 | 冻结为「Enforcer（依赖面）+ ArchUnit（包面）两者都要」，写入 §4.2 |
| G7 | 依赖规则里的「Jackson 禁令」边界 | R1（L162）禁 `harness-kernel` 依赖 Jackson，但 impl/02 的适配器需要 JSON 解析且落在 `kernel-model`（impl/02 L508–535）；选项「适配器自带最小 JSON 解析」或「协议适配器下沉 platform」未裁决 | 在卷 27 §4.2 R1 注脚写明：内核内的 JSON 编解码走 `ProtocolCodec` 端口注入（实现留 platform），或显式允许 jackson-core 进 kernel-model |

## 三、最小链路清单（会话 → 消息 → 流式 → 落库 → 恢复）

| # | 环节 | 必须落地的类/接口 | 表 | 事件 | 缺口 |
| --- | --- | --- | --- | --- | --- |
| 1 | 新建会话 | `SessionRuntime.create`（impl/01 L272）、`SessionHandle`（L278）、`KernelBootstrap.boot`（L260） | `oc_session`（impl/01 L655） | `system.started/ready`（L694–695） | `CreateSessionCommand`/`SessionSnapshot` 无字段（仅类图名） |
| 2 | 发消息 | `InputAdmission.admit`（impl/01 L286）、`AgentRuntime.submit`（impl/12 L357） | `oc_session_input`（impl/01 L656）**或** `oc_agent_input`（impl/12 L636） | `session.input.admitted`（impl/01 L701）**或** `agent.input.admitted`（impl/12 L673） | **出参类型三命名**（B7）；准入表二选一（C01 L447 已登记 R-SM-1 未裁决） |
| 3 | 提升 + 装配上下文 | `ContextEngine.assemble`（impl/03 L445）、`TokenBudget`/`ContextSection`（L320–362） | `oc_context_snapshot`（impl/03 L712） | `session.input.promoted`（impl/01 L702） | `ContextAssembleRequest`/`ContextSnapshot` 字段仅类图（impl/03 L226–233，`List sections` 无泛型） |
| 4 | 模型流式返回 | `ModelGateway.stream`（impl/02 L776）、`ProtocolAdapter.open`（L534）、`StreamCursor.next`（L436）、`StreamEvent` 8 子型（L419–425） | 不入库（REQ-INT-4，impl/01 L710） | `model.delta`（impl/02 L758，载荷仅「增量类型与序号」） | 8 个子型的字段全缺（如 `TextDelta` 的 text/seq、`UsageReported` 的 `Usage` 结构）→ 流的合并/展示无法编码 |
| 5 | 落库（消息 + 用量） | `ItemPayload` 8 子型（impl/12 L376–379，`AssistantMessagePayload` 无定义） | `oc_item`（impl/01 L658 **vs** impl/12 L635） | `agent.item.committed`（impl/12 L673，载荷「含类型与 seq」） | **消息正文无承载列**（B4-②）；`payload_ref` 语义=外置引用，未定义内联列名与阈值口径 |
| 6 | 检查点 | `CheckpointWriter.write`（impl/01 L308） | `oc_checkpoint`（impl/12 L637 与 01 L659 冲突） | `agent.item.committed(Type=CHECKPOINT)`（impl/12 L651） | 幂等键 `(session_id, seq)` 但 12 列清单无 `session_id`（B5） |
| 7 | 恢复会话 | `AgentRuntime.recover`（impl/12 L366）、`RecoveryCoordinator`（impl/19 L434 / impl/01 L311 同名） | `oc_recovery_scan/_item`（impl/19 L720）、`oc_checkpoint` | `session.recovery.scanned/completed`（impl/01 L705–706） | 同名类两处语义（C25 L446 R-RC-2 已登记未裁决）；同名类在 01 是内核侧、19 是平台侧，**首 PR 放哪层需裁决** |

## 四、本地跑通（不接真实模型）：配方与可执行性判定

文档给出的零凭证路径只有一条（impl/33 L867/L875）：`mvn -q -pl harness-kernel/kernel-qa -am test` → `oc qa replay --suite core` → `./scripts/ci/gate.mjs --profile fast`。

判定：**当前不可直接执行**，三处硬伤：

1. `kernel-qa` 与 `harness-testkit` 未登记进卷 27 §4.1（impl/33 L8–9 自述「扩展模块，待登记」；C34 X-C34-2 已登记），`-pl` 选择器无对应模块 → 命令必然失败。
2. 「产品链路」没有零模型配方：provider 注册面只有 `open-coding.model.providers[]`（impl/02 L815），**无 fake 条目/无 fake 装配章节**；impl/33 的 `FakeModelProvider` 只被 `oc qa`/测试驱动，未被 §4 的「`oc --profile headless` 启动完整 harness」引用（impl/33 L57 只写目标，不写装配方式）。→ 手工验证「会话→消息→流式→落库→恢复」需自己发明装配。
3. `oc` CLI（`host-cli`）本身要等第 8 步（卷 27 L223），而 §4.5 第 3 步就要「可跑通最小循环」——即**第 3 步的可跑通形态没有 CLI 入口**，卷 27 未写「第 3–7 步用测试驱动还是 CLI 驱动」。

建议：① impl/02 §9.5 增 `open-coding.model.providers[].kind=fake`（或 `open-coding.qa.fake.enabled`）+ `host-bootstrap` 装配段；② impl/33 §11.5 增「手工链路」三条命令（如 `OC_FAKE_SCRIPT=… oc chat --model fake`、`oc session resume <id> --from-seq`）；③ 卷 27 §4.5 每步补「可跑通形态」列（测试驱动/CLI）。

## 五、CI 会跑的 5 条命令 vs 卷 27 §4.6 与各 impl §⑪

| # | 我会跑的命令 | 依据 | 与卷 27 §4.6 对应门 | 一致性问题 |
| --- | --- | --- | --- | --- |
| 1 | `mvn -q -pl harness-contract,harness-kernel -am test` | impl/01 L923（改为显式列表，避开 G2/G4） | 单元测试 + 覆盖率门 | 卷 27 §4.6 未给命令；impl 各自写法不一（有的用聚合 `-pl harness-kernel`） |
| 2 | `./scripts/ci/gate.mjs --profile fast` | impl/33 L851/L872 | 全链路顺序 | **与卷 27 冲突**：L73/L253/L347 写 `./scripts/ci/*.sh` / `all.sh`（见 R2） |
| 3 | `mvn -pl harness-host/host-protocol -am test -Dgroups=contract` | impl/01 L929 | 契约测试（协议/事件 Schema/SPI/适配） | impl/01 L929 用 `-pl harness-host`（聚合器）；impl/16 L1004 用 `host-protocol`——**选择器粒度不一** |
| 4 | `mvn -pl harness-platform/platform-persistence -am verify -Dgroups=fault-injection` | impl/01 L932、C25 L432 | 集成测试（PG/Redis 容器 + 沙箱）+ 故障注入 | `-Dgroups` 在 Surefire 是 JUnit5 Tag 选择；全树未声明测试标签命名规范（谁注册 `contract`/`fault-injection` 标签？） |
| 5 | `oc qa replay --suite core --snapshot-dir harness-testkit/src/test/resources/qa/snapshots` | impl/33 L853 | 离线评测（核心集） | 依赖 G4 未登记模块；且该命令要求 `oc` 已构建（第 8 步后） |

另：**门禁脚本命名空间无索引**。全树出现 `scripts/ci/{gate.mjs, all.sh, agent-gate.sh, event-gate.sh, event-fault-inject.sh, cli-pty-e2e.sh, kernel-api-count.sh, tenant-isolation-scan.sh}`、`scripts/ops/{run-drill.sh, runbook-verify.sh}`、`scripts/gen-sdk.sh`、`scripts/dev/up.sh`（impl/01 L52、12 L964、16 L1002–1003、22 L1143–1144、33 L851–875、34 L1006–1010）。建议卷 27 §4.1 增「`scripts/` 清单表」并把 §4.6/DoD 的 `all.sh` 统一改为单入口名。

---

## 六、对不上账的地方（按阻塞程度排序）

### A. 阻塞开工（不裁决不能开工）

**B1 · 模块清单不可唯一确定（最阻塞）**
证据：卷 27 L101–128 只列 28 个目录；`impl/25 L70`、`26 L67`、`27 L41`、`28 L42`、`29 L35/L42`、`30 L42`、`31 L79`、`32 L8`、`33 L8–9`、`34 L12–13`、`35 L69` 共声明 **24 个扩展模块**（`kernel-{governance,cost,security,dist,eco,qa,ops,frontier}`、`platform-{identity,audit,security,dist,eco,intel,qa,ops,frontier}`、`host-{enterprise,ui,automation,intel,frontier,eco}`、`harness-testkit`），且全部标注「待登记」；而 `impl/01 L922/L929`、`impl/33 L847–853`、`impl/34 L1002–1005` 的验收命令已按这些模块名书写。
改法：在卷 27 §4.1 追加「扩展模块登记表」（列：模块名 / 首现文件:行 / 生产 or 测试期 / 依赖层），并在 §4.5 标注各步是否含扩展模块；未登记期间把 §⑪ 命令一律改为聚合选择器（`-pl harness-kernel -am`）。

**B2 · 首个 PR 的物理落点未定（仓库与根 POM）**
证据：卷 27 §4.1 树（L94–138）无 `open-coding-*`，但 §4.8.1 S1（L293，S0 在 L292）要求 v1/v2 并存；现有 `pom.xml:16–23` 是 v1 聚合，`pom.xml:7` groupId `com.hk.opencoding`，Spring Boot 依赖管理在 `pom.xml:78–80`。
改法：卷 27 §4.1 增注一段「迁移期布局」：根 `pom.xml` 同时聚合 `open-coding-*` 与 `harness-*`；`harness-*` 不继承 v1 的 starter-parent，其 BOM 独立声明。

**B3 · `EventPayload` sealed 白名单与全域事件规模不自洽**
证据：`impl/16 L390`：`public sealed interface EventPayload permits SessionCreated, ToolCallCompleted, GoalTickPayload, TelemetrySample`，并在 L388 写「新增载荷必须扩展本清单（禁止别包实现）」；而 impl/16 自身在 L714–721 又列了 6+ 个元事件、L716–721 的域事件「见各卷」；impl/01 L692–708 15 条、impl/12 L667–674 17 条；全语料点分事件名去重后数百个。
改法：契约层 `EventPayload` 去掉 `sealed`（或只 sealed 到「类别」），载荷按域模块各自声明 + `SchemaRegistry` 注册（impl/16 §9.3 已有注册机制）；删除 L388 的「禁止别包实现」。

**B4 · 同一物理表的字段/约束三处互斥（直接影响第 5 步「落库」）**
① `oc_turn`：impl/01 L657（`session_id, seq, state, usage_ref`）vs impl/12 L634（`turn_id, thread_id, intent, plan_ref, phase, planned_depth, usage jsonb, outcome`）——连状态列名都不同（`state` vs `phase`）。
② `oc_item`：impl/01 L658（`ref_id, summary`，无正文列）vs impl/12 L635（`payload_ref`，注释「>64KB 转对象存储」）——**消息正文/内容块的承载列没有定义**（`payload_ref` 名字即「引用」）。
③ `oc_event_log`：impl/01 L660（PK `(tenant_id, partition_key, seq)`；列 `actor, trace_id`）vs impl/16 L685（明言分区表不能有全局唯一约束，靠 `oc_event_seq`；列 `category/project_id/recorded_at/actor_type/actor_id/…/hash_prev/hash`）vs impl/01 L530（「事件追加按 `(sessionId, seq)` 唯一约束串行化」）——三方互斥。
改法：指定 `impl/19 §8` 为 DDL 唯一权威；01/12/16 的表段改为「列名别名表 + 指针」，把唯一性口径统一为「`oc_event_seq` 行锁 + `(partition_key, seq)` 本地唯一索引」；为 `oc_item` 明确内联载荷列名（建议 `payload jsonb`）与外置阈值单一来源。

**B5 · `oc_checkpoint` 收敛条款自相矛盾**
证据：impl/12 L647–650 声明「唯一物理表、幂等键 `(session_id, seq)`、`thread_id/turn_id` 仅归属列」，但同文件 L637 的列清单里**没有 `session_id`**。
改法：impl/12 L637 增 `session_id`（并注明与 01/03 的 `payload_ref`/`workspace_version` 别名对应），或改幂等键为 `(thread_id, seq)` 并回改 L648 与 impl/01 L659、impl/03 L715。

**B6 · B1 数据批次三份清单互不一致**
证据：impl/01 L51（含 `oc_session_input/oc_turn/oc_item/oc_projection_offset/oc_dead_letter`）、impl/12 L89（`oc_thread/oc_agent_input/oc_subagent_link/oc_tool_side_effect`，且标 B1/B2 两可）、impl/19 L68（B1 含 `oc_agent_input/oc_session_log_*/oc_object_ref/oc_export_job/oc_recovery_*/oc_snapshot*`，不含 `oc_session_input/oc_turn/oc_item/oc_checkpoint`）。第一份 Flyway 迁移写不出来。
改法：impl/19 §8 出「B1 权威表清单」（含 owner 文件、建表顺序、是否分区），其余文件只引用不改写；卷 27 §4.4（L200–208）每批次补「表清单 + owner 指针」列。

**B7 · 受理回执三命名（协议出参未冻结，SDK 生成源不定）**
证据：impl/01 L392–411（`AdmissionOutcome`：Admitted/Queued/Coalesced/Rejected）+ L724（协议出参写作 `AdmissionReceipt`）vs impl/12 L357/L690（`SubmitAck{accepted,inputId,admittedSeq,delivery}`）vs C01 L15/L37/L43（同一概念用 `AdmissionOutcome`，上游表却写 `AdmissionReceipt`）。
改法：`appendix-b` §B.2 增「出参类型」列，冻结 `AdmissionOutcome` 为唯一契约类型，`SubmitAck` 删除或降级为其序列化视图（并同步 impl/12 L357/L690）。

**B8 · `ErrorCode` 契约缺失（写不出 `HarnessException`）**
证据：impl/01 L451、impl/12 L418、impl/19 L478 均要求「业务失败抛 `HarnessException(ErrorCode, 中文)`，重试只认 `ErrorCode.retryable`」；但 `appendix-b` §B.11（L166–199）只有一张 40 条码表，**无 retryable 列、无 Java 枚举定义、无 code→HTTP/JSON-RPC 映射**；X-82（impl/01 L451）只是缺口指针。
改法：`appendix-b` §B.11 增 `retryable` 与「建议动作」列，并在 `harness-contract` 冻结 `ErrorCode`（`code + retryable + httpStatus + jsonRpcCode`）与 `HarnessException`/`BusinessException` 的归属层（兑现 X-82）。

**B9 · 12 个内核端口无方法签名（第一个骨架的「端口面」写不出来）**
证据：impl/01 §9.3（L749–763）只给端口名 + 一句话（`StoragePort/EventStorePort/RuntimeStorePort/TransactionPort/ClockPort/IdPort/RandomPort/FrameChannel/ProtocolCodec/HostAdapterPort/SecretPort/CapabilityProbe` 等 12 项）；唯一有签名的是 `TransactionPort.required(Supplier)`（文字描述，L449）与 `FrameChannel` 的类图方法（L330–336）。
改法：为「稳定」级端口各补一段 Java 签名（方法 + 参数 + 异常 + 幂等语义），或新增 `harness-contract/src/main/java/.../port/README` 列出 12 个端口的冻结签名。

### B. 增加返工（能开工但必然二次返工）

**R1 · 单内核模块 vs 8 个 kernel-* 子模块**：impl/01 L88–99（I-ARC-1 选定「单内核模块 + 包级内聚」）vs 卷 27 L101–108（8 个子模块）vs impl/01 L922（把 `harness-kernel` 当聚合器）。改法：二选一后统一 `-pl` 写法（建议物理 8 模块 + 逻辑单包，并在 §3.1 注明）。

**R2 · CI 入口脚本名冲突**：卷 27 L73/L253/L347（`*.sh`、`all.sh`）vs impl/33 L159/L851/L875（`gate.mjs`）+ 各域 `.sh`。改法：卷 27 §4.7 增「门禁脚本清单」，冻结单入口名（二选一）并回改 §4.6/§7 DoD。

**R3 · `profile` 一词三义**：宿主形态档（impl/01 L770，`open-coding.kernel.profile`=sidecar/embedded/remote）vs 出厂档（impl/33 L57/L709，`oc --profile headless`）vs 门禁档（impl/33 L159，`gate.mjs --profile fast`）。改法：CLI 参数改 `--preset`/`--flavor`，术语表（appendix-c）补三词条，避免配置键与 CLI 撞名。

**R4 · 假模型没有「产品链路」装配面**：见 §四。改法：impl/02 §9.5 增 fake provider 配置项 + `host-bootstrap` 装配；impl/33 §11.5 增手工链路命令。

**R5 · 会话状态权威表未收敛**：impl/01 L655 `oc_session(state, runner_epoch, last_event_seq)` vs impl/12 L633 `oc_thread(state, last_event_seq)`；Thread↔Session 基数全树未声明（grep 无 1:1/1:N 表述）。改法：appendix-a 增「Session / Thread 关系」小节（建议显式声明 1 会话 = N 主线或合并两表）。

**R6 · 事件命名分叉**：`session.input.admitted/promoted/dropped`（impl/01 L701–703）vs `agent.input.admitted/promoted`（impl/12 L673）。改法：impl/16 §8.3 增跨域唯一事件类型清单，或在其一登记弃用别名。

**R7 · 外置件与恢复的保留期未对账**：`oc_context_ref` 默认 30 天（impl/03 L714）vs 检查点/消息「随会话保留」（impl/12 L644），长会话恢复可能读到已回收引用。改法：impl/12 §⑩ 增「外置件 × 恢复对拍」用例，并把 `oc_context_ref` 保留策略与卷 19 `oc_retention_policy`（impl/19 L725）绑定。

### C. 仅文档瑕疵

**D1 · 组件编号 ↔ 附录 D 137 组件映射仍缺**（impl/components/README.md L78 自述待登记；R09 缺口 W2）。
**D2 · 已登记但未裁决的修订项无统一清单**：C01 L447（R-SM-1 输入表统一）、C25 L446–447（R-RC-2/R-RC-3）、R07 的 X-86/X-87（impl/README §4 L164/L170 提到）→ 建议 `IMPL-DECISIONS.md` §4 增「待裁决」状态列。
**D3 · 卷 27 §4.7 的 `tools/fake-llm` 与 impl/33 的 `kernel-qa` 口径不一致**（L258 vs impl/33 L8）：建议 §4.7 改为「假模型：`kernel-qa`（同进程，主路径）+ 可选 `tools/fake-llm` 独立进程（后置）」。
**D4 · 前端包名无权威**：impl/33 L870 用 `pnpm -C client --filter @open-coding/app`，卷 27 §4.1 只给目录 `client/{app,ui,sdk}`，包名 `@open-coding/*` 全树仅此一处。建议卷 27 §4.1 补 pnpm 包名映射。

## 七、最终回答（三个直接问题）

1. **能否仅凭这些文档产出可编译骨架？** 不能。可确定模块名与依赖方向、可确定大量类名，但：`ErrorCode`/`HarnessException` 无定义（B8）、12 个端口无签名（B9）、载荷 record 无字段（`ModelRequest` 仅类图字段名且无泛型，impl/02 L256–266；8 个 `StreamEvent` 子型与 `AssistantMessagePayload` 全空）、23 个模块未登记（B1）、根 POM 落点未定（B2）。
2. **最小链路能否今天开工？** 能开工到「第 3 步」的单元测试形态（impl/01 的类名与状态机足够清晰，是全集质量最高的一份），但第 5 步「落库」会立刻卡在 `oc_item` 正文列与 B1 迁移清单（B4/B6），第 7 步「恢复」会卡在同名 `RecoveryCoordinator` 的层次归属（C25 R-RC-2）。
3. **最该先修的三处**：B1（模块登记表）→ B6（B1 权威表清单）→ B8/B9（契约层 ErrorCode 与端口签名）。三处修完后，本文档 §二/§三的「猜」项可从 7 项降到 2 项以内。

## 八、改法清单（文件 → 精确动作，供编排方直接派单）

| 序 | 文件 | 精确动作 | 兑现 |
| --- | --- | --- | --- |
| 1 | `27-technical-path.md` §4.1（L94–138） | 追加「坐标表 + 聚合 POM 三行 + 扩展模块登记表（24 项）+ 迁移期 v1 并存注」 | G1/G2/G5/B1/B2 |
| 2 | `27-technical-path.md` §4.1/§4.7 | 增「`scripts/` 清单表」；把 L73/L253/L347 的 `*.sh`/`all.sh` 与 impl/33 的 `gate.mjs` 收敛为一个单入口名 | R2 |
| 3 | `27-technical-path.md` §4.4（L200–208） | 每批次表补「表清单 + owner 文件」列（以 impl/19 §8 为权威） | B6 |
| 4 | `27-technical-path.md` §4.5（L214–235） | 每步补「涉及模块」与「可跑通形态（测试驱动/CLI）」两列 | G3/§四-3 |
| 5 | `27-technical-path.md` §4.2（L158–166） | R1 增注：内核内 JSON 编解码走 `ProtocolCodec` 端口（或显式允许 jackson-core）；L373 冻结 Enforcer+ArchUnit 双轨 | G6/G7 |
| 6 | `27-technical-path.md` §4.7（L258/L260 区） | 假模型表述改为「kernel-qa 同进程（主）+ tools/fake-llm 独立进程（后置）」 | D3 |
| 7 | `impl/16-event-bus-impl.md` L386–400 | `EventPayload` 去 sealed（或降为类别级），删除 L388「禁止别包实现」；载荷登记改走 `SchemaRegistry` | B3 |
| 8 | `impl/16-event-bus-impl.md` §8.3（L714–721） | 增「跨域唯一事件类型清单」入口或声明「唯一清单在 SchemaRegistry 目录」 | R6 |
| 9 | `impl/01-kernel-runtime-impl.md` §8.1（L653–661） | 表段改为「别名表 + 指向 impl/19 §8」，保留 `oc_session` 为唯一权威行；`oc_event_log` 唯一性口径与 16 对齐 | B4 |
| 10 | `impl/12-agent-runtime-impl.md` §8.1（L633–642） | `oc_turn/oc_item` 列名与 01 收敛（或反向）；L637 增 `session_id`；`oc_item` 明确内联载荷列 | B4/B5 |
| 11 | `impl/19-persistence-recovery-impl.md` §8 | 升格为「DDL 唯一权威」：B1 全表清单 + 建表顺序 + 分区策略 + owner 列 | B6 |
| 12 | `appendix-b-interface-contracts.md` §B.2（L28–39） | 增「出参类型」列，冻结 `AdmissionOutcome`（sealed）为唯一受理回执类型 | B7 |
| 13 | `appendix-b-interface-contracts.md` §B.11（L166–199） | 增 `retryable`/建议动作列 + Java 枚举冻结位置（`harness-contract`）+ code→HTTP/JSON-RPC 映射；兑现 X-82 | B8 |
| 14 | `impl/01-kernel-runtime-impl.md` §9.3（L749–763） | 12 个稳定端口的 Java 签名逐个补齐（方法/参数/异常/幂等）或另建契约签名清单文件 | B9 |
| 15 | `impl/02-model-gateway-impl.md` §9.5（L811–828） | 增 fake provider 配置项 + `host-bootstrap` 装配段 | R4 |
| 16 | `impl/33-quality-eval-impl.md` §11.5（L847–875） | 增「手工链路零凭证跑通」三条命令；`kernel-qa`/`platform-qa`/`harness-testkit` 标注登记状态为前置 | R4/§四 |
| 17 | `impl/components/C01-session-manager.md` L447 + `C25` L446–447 | 把 R-SM-1/R-RC-2/R-RC-3 提升为 `IMPL-DECISIONS.md` §4 的「待裁决」条目并加回引 | D2/B5/§三-7 |
| 18 | `appendix-a-domain-model.md` | 增「Session / Thread 关系」小节（基数 + 哪张表是会话态权威） | R5 |
| 19 | `appendix-c-glossary.md` | 补 `profile`（宿主档/门禁档/出厂档）、`Thread/Session` 基数三词条 | R3/R5 |
| 20 | `impl/components/README.md` L78 | 补 C01–C36 ↔ 附录 D 137 组件的编号映射表（R09 W2 收口） | D1 |

---

### 本轮方法学与限制

- 行走限制：为控制预算，`impl/04–11、13–15、17–18、20–32、35` 与 `components/C05/C08–C21/C23–C24/C26–C36` 仅做定向检索（模块坐标、表名、事件名、命令），未逐行通读；因此可能仍有未登记的模块/表在该区间。
- 取证快照：本文件所有行号取自 2026-09-21 本轮读取时的文件状态；若期间被并发修改（同轮存在其它 R10 子任务），以文件当前内容为准并沿用同一 `file:line` 定位法复核。
- 未修改任何其它文件；本文件落盘后需由编排方同步：`README.md` §2 索引行（reviews 计数 21→22）与 `AUDIT.md` 计数、`ITERATIONS.md` 轮次登记。
