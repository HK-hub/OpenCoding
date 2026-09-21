# 附录 D · 组件清单（Component Inventory）

> 本附录是**交付物级组件清单**：把目标态系统分解为可独立开发、测试、部署的组件，逐项登记**类型 / 归属卷 / 实现方案文件 / 关键依赖 / 状态**。任何「卷册或实现方案里提到、但清单里没有」的实现单元，或反之，都视为设计缺口（孤儿检查见 §D.7）。
>
> **数据来源（本附录写作时逐项核对）**：
> ① `README.md` §2 卷册地图（36 卷：00–35 + 附录 A/B/C）与 §5 覆盖审计表（Phase A 组件基线 108 项）；② `research/00-research-plan.md` §1.2「逐系统实现技术方案」索引（impl/01–35 文件名与归属卷映射，本附录「实现方案」列的唯一权威）；③ `ITERATIONS.md` 轮次 2「组件/服务缺失扫描」26 项缺失组件表（核对见 §D.6）；④ `impl/01–35` 全部已产出文件（模块落点与类族名来自各文件 §1.4/§1.5：如 `01 §1.4` 模块映射、`05 §1.4` 工具模块落点、`06 §1.4` 权限模块落点、`20 §1.5` 工作区模块落点、`24 §1.5` A2A 模块落点；`impl/25–35` 为批次 3 产出，不改变本表结构与状态口径）；⑤ **`impl/components/` 36 份组件级方案**（R10 新增「组件级方案」列的映射依据；索引见 `impl/components/README.md`，修订建议汇总见 `impl/components/SUGGESTIONS.md`）。
>
> **状态口径**：`设计完成` = Phase A 卷册已定义、实现层方案未落盘；`实现方案完成` = 对应 `impl/NN-*.md` 已产出（本附录写作时可核验存在）；`待实现` = 实现层方案未落盘或尚无实现层方案（含卷 25 原型方向）。全部组件均处于「方案层」，代码尚未开工，故状态描述**文档覆盖度**而非编码进度。R01 校验后 `impl/01–35` 全部存在，本表无「待实现」项。
>
> **类型口径**：`进程内服务`（内核/平台域带的库与运行时对象）｜`后台服务`（常驻作业：调度、轮询、清理、聚合）｜`OS 集成`（桌面端与操作系统交互点）｜`外部系统`（本产品不开发、但必须治理的依赖）｜`工程工具`（构建/评测/运维脚本与夹具）｜`协议面`（对外或对内的接口端点族）。
>
> **「组件级方案」列口径（R10 新增）**：命中 `impl/components/` 组件级方案的组件填对应 `Cxx-*.md` 文件（命名差异按各组件文件 §①「组件清单与命名桥接」为桥接关系，非冲突）；未命中者一律标注「由系统级方案覆盖」（其详设即本表「实现方案」列所指 `impl/NN-*-impl.md`）。映射实算（行级命令）：**137 行中 59 行命中**（`grep -cE '^\| [KPETX]-[0-9]{2} \|.*components/C[0-9]' appendix-d-component-inventory.md` = 59）、**78 行由系统级方案覆盖**（`grep -cE '^\| [KPETX]-[0-9]{2} \|.*由系统级方案覆盖' appendix-d-component-inventory.md` = 78）；D.1 命中 24 / D.2 命中 20 / D.3 命中 6 / D.4 命中 9 / D.5 命中 0。该列为「唯一主责组件方案」指针，跨组件协作面（如 P-09 与 C30、T-13 与 C32）在对应组件文件 §⑦ 依赖矩阵中另有登记。

---

## D.1 内核与智能层（K）

| ID | 组件 | 类型 | 归属卷 | 实现方案 | 组件级方案 | 关键依赖 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K-01 | ModelGateway（调用门面：能力校验/路由/装饰器链） | 进程内服务 | 02 | `impl/02` | `components/C06-model-router.md` | K-02、K-03、SecretResolver | 实现方案完成 | 出站唯一口，装饰器顺序不可重排 |
| K-02 | ProtocolAdapter×4（Anthropic/OpenAI/Gemini/Ollama）+ StreamCodec | 进程内服务 | 02 | `impl/02` | `components/C07-model-adapter-family.md` | jackson、SSE、厂商 SDK | 实现方案完成 | 厂商 SDK 依赖集中于此 |
| K-03 | CapabilityMatrix（能力位与窗口约束） | 进程内服务 | 02 | `impl/02` | 由系统级方案覆盖 | K-06 模型目录 | 实现方案完成 | 多模态位供 F-01 判定 |
| K-04 | DecoratorChain（预算/限流/脱敏/审计/重试/观测/计量） | 进程内服务 | 02 | `impl/02` | 由系统级方案覆盖 | K-05、AuditSnapshotStore | 实现方案完成 | 脱敏先于审计快照（轮次 1 修复） |
| K-05 | UsageRecorder + UsageSink | 进程内服务 | 02/31 | `impl/02` | 由系统级方案覆盖 | 卷 31 成本六维 | 实现方案完成 | 计量失败有意吞异常 + WARN（M19） |
| K-06 | ModelCatalogSync（轮 2） | 后台服务 | 02 | `impl/02` | 由系统级方案覆盖 | 远端目录、K-03 | 实现方案完成 | 依赖卷 02 修订补登后才具备完整方案 |
| K-07 | ContextEngine（九区段组装/预算/token 估算） | 进程内服务 | 03 | `impl/03` | `components/C03-context-assembler.md` | SectionProvider、Tokenizer | 实现方案完成 | 稳定前缀分区 + 断点标记 |
| K-08 | CompactionPipeline（四级压缩） | 进程内服务 | 03 | `impl/03` | `components/C04-compaction-engine.md` | 摘要模型、CheckpointStore | 实现方案完成 | 熔断 + 可解释 + 可编辑摘要 |
| K-09 | ArtifactRefRegistry + ArtifactBlobStore | 进程内服务 | 03 | `impl/03` | 由系统级方案覆盖 | 对象存储（X-03） | 实现方案完成 | 外置引用与再读鉴权 |
| K-10 | SymbolIndexService | 进程内服务 | 03/11 | `impl/03` | `components/C17-knowledge-indexer.md` | 解析器、索引存储 | 实现方案完成 | F-11 影响分析依赖 |
| K-11 | PromptManager + PromptAssembler | 进程内服务 | 04 | `impl/04` | `components/C05-prompt-assembler.md` | K-12 | 实现方案完成 | 五阶段组装 + 溯源锚点 |
| K-12 | PromptAssetStore + ReleaseService + GrayBucketResolver | 进程内服务 | 04 | `impl/04` | 由系统级方案覆盖 | 签名、灰度桶 | 实现方案完成 | 双源版本、灰度与回滚 |
| K-13 | ToolRegistry + ToolSchemaGenerator | 进程内服务 | 05 | `impl/05` | `components/C08-tool-registry.md` | jackson | 实现方案完成 | 三通道注册 Fail-Fast |
| K-14 | ToolRuntime（11 步管线）+ ToolOutputProcessor | 进程内服务 | 05 | `impl/05` | `components/C09-tool-executor.md` | K-17、P-19、K-21 | 实现方案完成 | 脱敏先于裁剪外置（轮次 1 修复） |
| K-15 | ToolScheduler（资源声明与冲突图） | 进程内服务 | 05 | `impl/05` | `components/C09-tool-executor.md` | ResourceClaim | 实现方案完成 | 读写分区并行 |
| K-16 | BuiltinTools（文件/搜索/命令/Git/任务/协作/检索/网络/多模态/诊断 12 族） | 进程内服务 | 05 | `impl/05` | 由系统级方案覆盖 | nexec、pty4j、JDK FS | 实现方案完成 | 工具即最小能力单元 |
| K-17 | ActionGateway（动作归一化，唯一副作用入口） | 进程内服务 | 06 | `impl/06` | `components/C10-permission-engine.md` | K-18 | 实现方案完成 | 原型动作一律经此（F-02） |
| K-18 | PermissionEngine + PolicyEvaluator + RiskAssessor + SafetyGuard | 进程内服务 | 06 | `impl/06` | `components/C10-permission-engine.md` | 策略存储、安全基线常量 | 实现方案完成 | 有序判定链、拒绝优先 |
| K-19 | ApprovalOrchestrator（四通道审批编排） | 进程内服务 | 06 | `impl/06` | `components/C11-approval-orchestrator.md` | 通道适配（CLI/WS/A2A/IM） | 实现方案完成 | 封闭结果集 + 超时默认拒绝 |
| K-20 | GrantMemoryStore（六级授权记忆） | 进程内服务 | 06 | `impl/06` | `components/C10-permission-engine.md` | Redis（X-02）+ PG | 实现方案完成 | 授权到期与撤销 |
| K-21 | HookEngine + HookRegistry（8 类 30+ 点） | 进程内服务 | 17 | `impl/17` | `components/C23-hook-engine.md` | P-19（沙箱内执行） | 实现方案完成 | 阻断次数上限防活锁（L-065） |
| K-22 | ExtensionRegistry（扩展点目录/稳定性分级） | 进程内服务 | 18 | `impl/18` | `components/C24-plugin-loader.md` | 版本协商 | 实现方案完成 | 原型与实验装载入口 |
| K-23 | PluginRuntime（装载/依赖求解/隔离/熔断） | 进程内服务 | 18 | `impl/18` | `components/C24-plugin-loader.md` | ClassLoader 隔离、信任校验 | 实现方案完成 | 实验代码隔离形态 B2 |
| K-24 | SkillRuntime + SkillStore（包/锁文件/签名） | 进程内服务 | 08 | `impl/08` | `components/C13-skill-registry.md` | E-12 市场索引 | 实现方案完成 | F-03 技能草稿出口 |
| K-25 | MemoryModel + RecallPipeline（四层/混合召回） | 进程内服务 | 10 | `impl/10` | `components/C16-memory-manager.md` | 索引存储、git 基线判脏 | 实现方案完成 | 候选写入 + 治理发布 |
| K-26 | KnowledgeService + HybridRetriever | 进程内服务 | 11 | `impl/11` | `components/C17-knowledge-indexer.md` | EmbeddingProvider、连接器 | 实现方案完成 | 三路检索 + 前置权限过滤 |
| K-27 | WikiGenerator（项目知识页） | 后台服务 | 11 | `impl/11` | 由系统级方案覆盖 | WikiPageStore | 实现方案完成 | 生成与陈旧检测 |
| K-28 | MediaService（轮 2：内容寻址/转码/缩略图/OCR 钩子） | 进程内服务 | 20/31 | `impl/20` | 由系统级方案覆盖 | 对象存储、ffmpeg 类工具 | 实现方案完成 | 媒体服务；F-01 渲染工件依赖 |
| K-29 | AgentRuntime（Thread/Turn/Item、三策略主循环） | 进程内服务 | 12 | `impl/12` | `components/C02-agent-loop.md` | K-07、K-13、K-18 | 实现方案完成 | 显式状态机 + 循环护栏 |
| K-30 | SubAgentManager + ToolFanOutCoordinator | 进程内服务 | 12 | `impl/12` | `components/C18-subagent-router.md` | 预算信封、P-19 | 实现方案完成 | 派生/隔离/结果契约 |
| K-31 | VerificationEngine + VerificationProvider（三级验证） | 进程内服务 | 12 | `impl/12` | 由系统级方案覆盖 | K-14、K-16 | 实现方案完成 | F-01/F-11 验证复用处 |
| K-32 | WorkItemEngine + DependencyScheduler（四层模型 + DAG） | 进程内服务 | 14 | `impl/14` | `components/C20-workitem-engine.md` | 状态机注册、证据存储 | 实现方案完成 | 规划视图与验收 |
| K-33 | GoalRuntime + TickEngine + TriggerEngine | 进程内服务 | 15 | `impl/15` | `components/C21-goal-scheduler.md` | 预授权、租约、熔断 | 实现方案完成 | F-07 长时自治底座 |
| K-34 | TeamOrchestrator（编制/拓扑/黑板/仲裁） | 进程内服务 | 13 | `impl/13` | `components/C19-team-orchestrator.md` | 预算熔断、HumanMemberBridge | 实现方案完成 | 人机混合编制 |
| K-35 | ExperimentRegistry + CapabilityGate（本批次新增） | 进程内服务 | 25 | `impl/35` | 由系统级方案覆盖 | ExperimentFlagStore | 实现方案完成 | 五级阶梯 + 内核单点门控 |
| K-36 | ExperimentMetricEvaluator + GraduationEvaluator（新增） | 后台服务 | 25/26 | `impl/35` | 由系统级方案覆盖 | P-06 事件、T-03 基准 | 实现方案完成 | 判据窗口求值与毕业建议 |
| K-37 | VisionVerifier + MultimodalRenderPort（新增） | 进程内服务 | 25/03 | `impl/35` | 由系统级方案覆盖 | 渲染沙箱、K-28 | 实现方案完成 | F-01 原型（差异报告可复现） |
| K-38 | ComputerUseDriver（受控浏览器 / 虚拟显示）（新增） | 后台服务 | 25/07 | `impl/35` | 由系统级方案覆盖 | P-19、P-20、K-17 | 实现方案完成 | F-02 原型；执行强度 FULL/PARTIAL 上报 |
| K-39 | SkillDraftForge（失败轨迹 → 三通道草稿）（新增） | 后台服务 | 25/08 | `impl/35` | 由系统级方案覆盖 | P-30 轨迹、K-24、K-26 | 实现方案完成 | F-03 原型；禁止自动发布 |
| K-40 | LocalRuntimeProbe + LocalModelRouter（新增） | 进程内服务 | 25/02 | `impl/35` | 由系统级方案覆盖 | 本地运行时端点（X-08） | 实现方案完成 | F-05 原型；不预装、显式留痕降级 |
| K-41 | KnowledgeGraphIndex + GraphQueryPort（新增） | 进程内服务 | 25/11 | `impl/35` | 由系统级方案覆盖 | PG 邻接表、K-26 权限过滤 | 实现方案完成 | F-06 原型（三类问答） |
| K-42 | RefactorPlanner / ExplanationProjector / VoiceSessionBridge / MarketConnector（新增） | 进程内服务 | 25 | `impl/35` | 由系统级方案覆盖 | K-10、P-06、E-12、ASR 通道 | 实现方案完成 | F-08/F-10/F-11/F-12 原型 SPI 集合 |

---

## D.2 协作与平台层（P）

| ID | 组件 | 类型 | 归属卷 | 实现方案 | 组件级方案 | 关键依赖 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | SessionAppService（会话/任务/团队/工作区用例门面） | 进程内服务 | 01 | `impl/01` | `components/C01-session-manager.md` | K-29、K-32 | 实现方案完成 | 外壳用例编排层 |
| P-02 | SessionProtocolServer（JSON-RPC over stdio/WS） | 协议面 | 01 | `impl/01` | 由系统级方案覆盖 | P-01、P-06 | 实现方案完成 | CLI/桌面/IDE 同源协议 |
| P-03 | ManagementApiServer（REST + OpenAPI） | 协议面 | 01/附录 B | `impl/01` | 由系统级方案覆盖 | P-01 | 实现方案完成 | 管理面薄壳 |
| P-04 | KernelRuntime + 启动档（内嵌/常驻/服务） | 进程内服务 | 01 | `impl/01` | 由系统级方案覆盖 | 装配与冒烟探针 | 实现方案完成 | H-002 运行拓扑落地 |
| P-05 | RuntimeStore（Redis + 进程内降级） | 进程内服务 | 01/31 | `impl/01` | 由系统级方案覆盖 | X-02 | 实现方案完成 | 降级实现必备 |
| P-06 | EventBus/FanoutBus（双通道/分区有序） | 进程内服务 | 16 | `impl/16` | `components/C22-event-bus.md` | EventEnvelope、SchemaRegistry | 实现方案完成 | 实验事件同总线 |
| P-07 | EventLogStore + ConsumerOffsetStore + SchemaRegistry | 后台服务 | 16 | `impl/16` | `components/C22-event-bus.md` | PG 分区、游标 | 实现方案完成 | 回放与续传语义 |
| P-08 | RedactionEngine + PurgeProofStore | 进程内服务 | 16 | `impl/16` | `components/C22-event-bus.md` | 脱敏规则、留存策略 | 实现方案完成 | 写入前脱敏 |
| P-09 | EventExportSink（SIEM/数据湖出口客户端） | 后台服务 | 16/24 | `impl/25` | 由系统级方案覆盖 | X-12 | 实现方案完成 | 轮 2「SIEM 出口」实现侧 |
| P-10 | PersistenceAdapter（仓储端口实现） | 进程内服务 | 19 | `impl/19` | 由系统级方案覆盖 | X-01 | 实现方案完成 | 内核经端口访问存储 |
| P-11 | MigrationEngine + MigrationExecutor（expand-contract） | 后台服务 | 19 | `impl/19` | `components/C26-migration-runner.md` | Flyway、回滚脚本 | 实现方案完成 | schema 与配置变更分离 |
| P-12 | BackupRestoreService + RestoreDrillService | 后台服务 | 19 | `impl/19` | 由系统级方案覆盖 | PITR、对象存储 | 实现方案完成 | 备份演练与证明 |
| P-13 | RecoveryCoordinator + 自动续跑策略引擎（轮 2） | 后台服务 | 19 | `impl/19` | `components/C25-recovery-coordinator.md` | 检查点、幂等重放 | 实现方案完成 | 崩溃恢复协调器增强 |
| P-14 | ExportImportService + TombstoneService | 进程内服务 | 19 | `impl/19` | 由系统级方案覆盖 | 中立导出包、合规删除 | 实现方案完成 | 迁出能力基础件 |
| P-15 | ConsistencyChecker + SafeRepairExecutor | 后台服务 | 19 | `impl/19` | 由系统级方案覆盖 | 六类一致性校验 | 实现方案完成 | 修复动作安全执行 |
| P-16 | WorkspaceService + ProviderRegistry（本地/SSH/容器/云） | 进程内服务 | 20 | `impl/20` | `components/C27-workspace-provider-manager.md` | X-04、SSH 客户端 | 实现方案完成 | 能力矩阵显式声明 |
| P-17 | WatchService + BackgroundTaskRegistry（三模式命令） | 后台服务 | 20 | `impl/20` | `components/C27-workspace-provider-manager.md` | 一次性/后台/常驻 | 实现方案完成 | 输出流与生命周期 |
| P-18 | SnapshotStore + ContentAddressedStore | 进程内服务 | 20/19 | `impl/20` | 由系统级方案覆盖 | 去重与增量 | 实现方案完成 | 危险操作前置快照 |
| P-19 | SandboxOrchestrator + IsolationProvider×4（L0+/L1/L2/L3） | 进程内服务 | 07 | `impl/07` | `components/C12-sandbox-runner.md` | X-04、X-05 | 实现方案完成 | fail-closed + 强度上报 |
| P-20 | NetworkKeyProxy + DangerCommandGuard | 进程内服务 | 07 | `impl/07` | `components/C12-sandbox-runner.md` | 域名白名单、凭据代理 | 实现方案完成 | F-02 凭据注入依赖 |
| P-21 | SandboxImageManager（轮 2） | 后台服务 | 28/07 | `impl/07` | `components/C12-sandbox-runner.md` | 镜像源（X-14）、签名校验 | 实现方案完成 | 拉取/签名/缓存/预热 |
| P-22 | GitService + CommitService + 护栏 | 进程内服务 | 21 | `impl/21` | `components/C28-git-worktree-manager.md` | X-07 | 实现方案完成 | 危险操作护栏与撤销 |
| P-23 | MergeQueueService + MergeLeaseManager | 后台服务 | 21 | `impl/21` | `components/C28-git-worktree-manager.md` | 预检、串行合并 | 实现方案完成 | F-11 分片合并依赖 |
| P-24 | GitHostAdapterRegistry（GitHub/GitLab/Gitea/内网） | 进程内服务 | 21/29 | `impl/21` | 由系统级方案覆盖 | X-07 | 实现方案完成 | 平台适配 + 凭据托管 |
| P-25 | McpSubsystem（客户端/网关/自愈） | 进程内服务 | 09 | `impl/09` | `components/C14-mcp-client-manager.md` | 四传输、企业网关 | 实现方案完成 | 能力接入面 |
| P-26 | McpExposureService（对外 MCP Server） | 协议面 | 09 | `impl/09` | `components/C15-mcp-server-exporter.md` | K-14、K-18 | 实现方案完成 | 对外暴露须经权限门面 |
| P-27 | A2aServer + RemoteAgentClient | 协议面 | 23 | `impl/24` | `components/C31-remote-agent-gateway.md` | 审批回调、幂等键 | 实现方案完成 | 任务联邦主协议线 |
| P-28 | FederationDirectory + AgentCardService（F-04 依赖） | 协议面 | 23/25 | `impl/24` | `components/C31-remote-agent-gateway.md` | 签名 Card、驻留路由 | 实现方案完成 | 跨租户结对与信任分级 |
| P-29 | UnifiedSearch（八源统一搜索）（轮 2 搜索服务） | 进程内服务 | 29/11 | `impl/29` | 由系统级方案覆盖 | K-26 索引、权限过滤 | 实现方案完成 | 跨会话/任务/知识统一入口 |
| P-30 | TrajectoryExporter + SessionRunCoordinator | 进程内服务 | 12/14 | `impl/12` | `components/C02-agent-loop.md` | 事件日志、预算 | 实现方案完成 | F-03 失败轨迹来源 |
| P-31 | PlaybookEngine（12 个自动化模板执行） | 后台服务 | 34 | `impl/31` | `components/C35-automation-runner.md` | K-32、P-22、预授权 | 实现方案完成 | 只提 PR 不合并 |
| P-32 | AiFeaturePack（12 项智能增强特性） | 进程内服务 | 35 | `impl/32` | `components/C36-augmentation-runner.md` | K-31、K-26、门禁 | 实现方案完成 | 标注/可校订/引用强制 |
| P-33 | SseFollowServer（只读跟随端通道） | 协议面 | 22 | `impl/22` | 由系统级方案覆盖 | P-06 游标 | 实现方案完成 | 观察者视图，不承载写 |

---

## D.3 企业·生态·前端（E）

| ID | 组件 | 类型 | 归属卷 | 实现方案 | 组件级方案 | 关键依赖 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E-01 | EnterpriseService（租户/组织/角色/主体） | 进程内服务 | 24 | `impl/25` | 由系统级方案覆盖 | E-02、PG | 实现方案完成 | 多租户基座 |
| E-02 | SsoScimConnector（OIDC/SAML/SCIM 对接） | 进程内服务 | 24 | `impl/25` | 由系统级方案覆盖 | X-11 | 实现方案完成 | 身份同步与离职回收 |
| E-03 | QuotaEngine + BudgetService（轮 2：动态再分配） | 后台服务 | 24/31 | `impl/26` | `components/C29-cost-ledger.md` | P-05、K-05 | 实现方案完成 | 实时准入 + 异步聚合 |
| E-04 | CostAttributor（成本六维归因） | 后台服务 | 31 | `impl/26` | `components/C29-cost-ledger.md` | K-05、P-06 | 实现方案完成 | 单位经济性口径 |
| E-05 | AuditChain + AuditAnchor（哈希链与导出） | 后台服务 | 24/16 | `impl/25` | `components/C30-audit-trail.md` | P-07、E-06 | 实现方案完成 | 三级审计与不可抵赖 |
| E-06 | DlpPolicyEngine（出站 DLP 与脱敏策略） | 进程内服务 | 24/30 | `impl/25` | 由系统级方案覆盖 | 内容分类、策略存储 | 实现方案完成 | 实验出站同样受控 |
| E-07 | SecretService（密钥生命周期：钥匙串/KMS/Vault/HSM） | 进程内服务 | 30 | `impl/27` | 由系统级方案覆盖 | E-10、X-06 | 实现方案完成 | 租约与审计发放 |
| E-08 | CredentialRotationService（轮 2：到期扫描/自动刷新/失效告警） | 后台服务 | 30 | `impl/27` | 由系统级方案覆盖 | E-07、通知（E-22） | 实现方案完成 | 凭证轮换服务 |
| E-09 | SupplyChainScanner（依赖/镜像/插件/模型四类） | 后台服务 | 30 | `impl/27` | 由系统级方案覆盖 | X-14、K-23 | 实现方案完成 | 供应链门禁 |
| E-10 | KeychainBridge（系统钥匙串）（轮 2） | OS 集成 | 30 | `impl/27` | 由系统级方案覆盖 | Keychain/Credential Manager/libsecret | 实现方案完成 | 凭据不进配置与日志 |
| E-11 | CertTrustBridge + ProxyAutoDetect（轮 2：企业代理与自定义 CA） | OS 集成 | 30 | `impl/27` | 由系统级方案覆盖 | 系统证书库、PAC | 实现方案完成 | MITM 代理兼容 |
| E-12 | RegistryService（插件/技能市场服务端）（轮 2） | 后台服务 | 29 | `impl/29` | `components/C32-registry-client.md` | 签名、评分、扫描（E-09） | 实现方案完成 | 私有 Registry 优先 + 镜像 |
| E-13 | ImporterSuite（六类导入迁移器）（轮 2） | 进程内服务 | 29 | `impl/29` | 由系统级方案覆盖 | P-14、K-12 | 实现方案完成 | 不可映射项显式报告 |
| E-14 | WizardService（双端首次向导）（轮 2 模板/向导） | 进程内服务 | 29 | `impl/29` | 由系统级方案覆盖 | P-16、E-13 | 实现方案完成 | 七步向导 + 示例任务闭环 |
| E-15 | FeedbackTicketService（轮 2：反馈 → 工单 → 闭环） | 后台服务 | 29 | `impl/29` | 由系统级方案覆盖 | P-02、E-12 | 实现方案完成 | 会话内反馈回流 |
| E-16 | ProtocolHandler（`oc://` 深链）（轮 2） | OS 集成 | 29 | `impl/22` | 由系统级方案覆盖 | 签名校验、二次确认 | 实现方案完成 | 六动作白名单 |
| E-17 | SingleInstanceLock（单实例与激活）（轮 2） | OS 集成 | 22 | `impl/23` | 由系统级方案覆盖 | 桌面主进程 | 实现方案完成 | 多开防冲突 |
| E-18 | AutoStart + Tray（自动启动与托盘常驻）（轮 2） | OS 集成 | 22 | `impl/23` | 由系统级方案覆盖 | 桌面主进程 | 实现方案完成 | 空闲更新时机联动 |
| E-19 | ShellIntegration（bash/zsh/fish/pwsh 补全 + cd 联动）（轮 2） | OS 集成 | 29 | `impl/22` | 由系统级方案覆盖 | CLI（E-30） | 实现方案完成 | 安装脚本与卸载 |
| E-20 | FileAssociation（项目文件/会话包关联） | OS 集成 | 22 | `impl/23` | 由系统级方案覆盖 | E-16 | 实现方案完成 | 关联与安全打开 |
| E-21 | NotificationBridge（系统通知与免打扰） | OS 集成 | 22/28 | `impl/23` | 由系统级方案覆盖 | E-22 | 实现方案完成 | 六类通知模板（卷 33） |
| E-22 | NotificationAggregator（轮 2 通知服务） | 后台服务 | 28 | `impl/28` | 由系统级方案覆盖 | 聚合键、静默规则、E-21 | 实现方案完成 | 去重/优先级/路由 |
| E-23 | UpdateService（通道/签名/回滚/离线包）（轮 2） | 后台服务 | 28 | `impl/28` | `components/C33-update-manager.md` | X-10、E-31 | 实现方案完成 | 三通道 + 防降级 |
| E-24 | TelemetryService（三级同意、采样、脱敏）（轮 2） | 后台服务 | 28 | `impl/28` | 由系统级方案覆盖 | 同意记录、出口清单 | 实现方案完成 | 默认全关 |
| E-25 | CrashReporter（摘要自动 / 完整转储需确认）（轮 2） | 后台服务 | 28 | `impl/28` | 由系统级方案覆盖 | E-24 | 实现方案完成 | 转储脱敏与留存 |
| E-26 | LicenseService（在线/离线许可、席位、对账）（轮 2） | 后台服务 | 28 | `impl/28` | `components/C33-update-manager.md` | 宽限期、只读降级 | 实现方案完成 | 过期不锁死 |
| E-27 | SharedSdk（TS/Java，契约生成物） | 协议面 | 29 | `impl/29` | 由系统级方案覆盖 | T-01、P-02 | 实现方案完成 | 生成物入库校验 |
| E-28 | IdePlugins（VS Code/JetBrains/Neovim/Zed） | 协议面 | 29 | `impl/29` | 由系统级方案覆盖 | P-02 瘦客户端 | 实现方案完成 | 禁止内嵌 Agent 逻辑 |
| E-29 | ImBot（审批卡片/状态查询/任务提交） | 协议面 | 29 | `impl/29` | 由系统级方案覆盖 | K-19、E-02 | 实现方案完成 | 身份绑定与最小权限 |
| E-30 | CliApp（Picocli + JLine；TUI 与 headless） | 进程内服务 | 22 | `impl/22` | 由系统级方案覆盖 | P-02、E-19 | 实现方案完成 | 实验徽标与面板入口 |
| E-31 | DesktopApp（Electron 主进程/更新器/托盘/深链/单实例） | 进程内服务 | 22/28/29 | `impl/23` | 由系统级方案覆盖 | E-17、E-18、E-23 | 实现方案完成 | 桌面常驻形态 |
| E-32 | DesktopUi（Vue 工作台 + 实验徽标 + 解释投影视图） | 进程内服务 | 22/33 | `impl/23` + `impl/30` | 由系统级方案覆盖 | K-42、E-31 | 实现方案完成 | 九界面 × 六态交互细则 |

---

## D.4 工程与运维（T）

| ID | 组件 | 类型 | 归属卷 | 实现方案 | 组件级方案 | 关键依赖 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | ContractGenerator + 一致性校验（轮 2：契约生成器） | 工程工具 | 27/29 | `impl/29` | 由系统级方案覆盖 | 附录 B 契约、CI | 实现方案完成 | 契约 → SDK/类型生成 |
| T-02 | CiGateScripts（端点覆盖/错误码差集/门禁矩阵） | 工程工具 | 27/26 | `impl/33` | `components/C34-quality-harness.md` | 卷 26 门禁、CI | 实现方案完成 | 平台无关门禁脚本 |
| T-03 | EvalRunner（假环境批量评测，可续跑）（轮 2 基准运行器） | 工程工具 | 26 | `impl/33` | `components/C34-quality-harness.md` | T-04、目录即实验身份 | 实现方案完成 | 六维评分与报告 |
| T-04 | FakeLlm + FaultInjector（轮 2 假模型与故障注入） | 工程工具 | 26 | `impl/33` | `components/C34-quality-harness.md` | 确定性回放 | 实现方案完成 | 离线可跑的前提 |
| T-05 | SeedTool + 脱敏器（轮 2 数据种子与脱敏） | 工程工具 | 29 | `impl/29` | 由系统级方案覆盖 | 规则库、审计 | 实现方案完成 | 演示/评测数据准备 |
| T-06 | OpsRuntime（健康检查/SLO 燃尽/容量水位） | 后台服务 | 32 | `impl/34` | 由系统级方案覆盖 | P-07 指标、卷 31 模型 | 实现方案完成 | 告警绑定 Runbook |
| T-07 | DrillRunner（九类故障演练执行与判据） | 工程工具 | 32 | `impl/34` | 由系统级方案覆盖 | T-09、演练剧本 | 实现方案完成 | 演练报告与改进项 |
| T-08 | RunbookAssets + AlertRulePack（10+ Runbook / 三级告警） | 工程工具 | 32 | `impl/34` | 由系统级方案覆盖 | T-06 | 实现方案完成 | 值班与升级路径 |
| T-09 | ChaosRunner（混沌实验 C1–C10） | 工程工具 | 26/32 | `impl/33` | `components/C34-quality-harness.md` | T-04、沙箱 | 实现方案完成 | 模型/存储/时钟类故障 |
| T-10 | SyntheticRepoGenerator（超大仓/恶意仓夹具） | 工程工具 | 26 | `impl/33` | `components/C34-quality-harness.md` | 仓库模板 | 实现方案完成 | 性能与安全用例来源 |
| T-11 | UpdateRehearsalTool（升级演练与回滚验证） | 工程工具 | 28/32 | `impl/28` | `components/C33-update-manager.md` | E-23、T-12 | 实现方案完成 | 演练通过方可发版 |
| T-12 | CompatMatrixTool（版本兼容矩阵校验） | 工程工具 | 28 | `impl/28` | `components/C33-update-manager.md` | 附录 B §B.12 | 实现方案完成 | 7 组组合校验 |
| T-13 | RegistryMirrorTool（离线镜像与私仓构建） | 工程工具 | 28/29 | `impl/28` | `components/C33-update-manager.md` | E-12、X-10 | 实现方案完成 | air-gapped 交付 |
| T-14 | PackagingToolchain（Electron/NSIS 打包与签名） | 工程工具 | 28 | `impl/28` | `components/C33-update-manager.md` | E-31 | 实现方案完成 | 签名与防降级配套 |
| T-15 | MigrationWorkbench（v1→v2 扫描/演练/报告） | 工程工具 | 19/27 | `impl/19` | 由系统级方案覆盖 | P-11、迁移映射 | 实现方案完成 | S0–S5 六阶段 |
| T-16 | FrontierPrototypeHarness（原型假环境与回放夹具） | 工程工具 | 25/26 | `impl/35` | 由系统级方案覆盖 | T-04、K-35 | 实现方案完成 | 十二方向原型验收夹具 |

---

## D.5 外部系统与集成（X）

| ID | 组件 | 类型 | 归属卷 | 实现方案 | 组件级方案 | 关键依赖 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| X-01 | PostgreSQL（事实源与投影） | 外部系统 | 01/19 | `impl/19` | 由系统级方案覆盖 | 版本区间、扩展白名单 | 实现方案完成 | 分区与 PITR 要求 |
| X-02 | Redis（热态/锁/限流/队列） | 外部系统 | 01/31 | `impl/01` | 由系统级方案覆盖 | 版本区间 | 实现方案完成 | 必须可降级 |
| X-03 | 对象存储（S3 兼容 / 本地 FS） | 外部系统 | 19/31 | `impl/19` | 由系统级方案覆盖 | 生命周期、加密 | 实现方案完成 | 工件/快照/归档 |
| X-04 | 容器运行时（Docker/Podman/containerd） | 外部系统 | 07 | `impl/07` | 由系统级方案覆盖 | 版本探测、镜像白名单 | 实现方案完成 | L1 沙箱承载 |
| X-05 | 微虚拟机（Cloud Hypervisor/Kata 类） | 外部系统 | 07 | `impl/07` | 由系统级方案覆盖 | 企业档可选 | 实现方案完成 | L2 沙箱承载 |
| X-06 | KMS/Vault/HSM | 外部系统 | 30 | `impl/27` | 由系统级方案覆盖 | 端点探活、轮换、审计 | 实现方案完成 | E-07 后端 |
| X-07 | Git 平台（GitHub/GitLab/Gitea/内网） | 外部系统 | 21/29 | `impl/21` | 由系统级方案覆盖 | 平台适配器、凭据托管 | 实现方案完成 | P-24 对接对象 |
| X-08 | 模型端点（云厂商/私有部署/端侧运行时） | 外部系统 | 02/25 | `impl/02` | 由系统级方案覆盖 | 能力矩阵、凭证、路由 | 实现方案完成 | K-02/K-40 对接对象 |
| X-09 | IM 平台（审批/通知/机器人） | 外部系统 | 29 | `impl/29` | 由系统级方案覆盖 | 适配器、身份绑定 | 实现方案完成 | E-29 对接对象 |
| X-10 | CDN 与分发源 | 外部系统 | 28 | `impl/28` | 由系统级方案覆盖 | 签名与校验 | 实现方案完成 | 更新与镜像分发 |
| X-11 | 企业 IdP（OIDC/SAML/LDAP + SCIM） | 外部系统 | 24 | `impl/25` | 由系统级方案覆盖 | E-02 对接 | 实现方案完成 | 身份权威源 |
| X-12 | SIEM / 数据湖（轮 2） | 外部系统 | 16/24 | `impl/25` | 由系统级方案覆盖 | P-09 出口客户端 | 实现方案完成 | 审计与遥测外送 |
| X-13 | 企业网关（模型出口 DLP/审计）（轮 2） | 外部系统 | 24 | `impl/25` | 由系统级方案覆盖 | K-01 出站链路、E-06 | 实现方案完成 | 部署形态：正向代理/旁路 |
| X-14 | 包仓库与镜像源（npm/Maven/容器镜像） | 外部系统 | 30 | `impl/27` | 由系统级方案覆盖 | E-09 扫描 | 实现方案完成 | 供应链治理对象 |

---

## D.6 轮次 2 组件落点核对（26/26）

> 来源：`ITERATIONS.md` 轮次 2「组件/服务缺失扫描」表 26 行，逐行核对到本轮清单 ID；**26/26 已登记，无遗漏**。

| # | 轮次 2 缺失组件 | 清单落点 | 归属卷 | 实现方案 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1 | 更新服务（自升级/通道/回滚） | E-23 | 28 | `impl/28` | 实现方案完成 |
| 2 | 遥测与崩溃上报服务 | E-24 / E-25 | 28 | `impl/28` | 实现方案完成 |
| 3 | 许可与席位服务 | E-26 | 28 | `impl/28` | 实现方案完成 |
| 4 | 通知服务（聚合/静默/路由） | E-22（+E-21 系统通知桥） | 28 | `impl/28` | 实现方案完成 |
| 5 | 模板/向导服务 | E-14 | 29 | `impl/29` | 实现方案完成 |
| 6 | 导入迁移服务（六类） | E-13 | 29 | `impl/29` | 实现方案完成 |
| 7 | Registry 服务（市场服务端） | E-12 | 29 | `impl/29` | 实现方案完成 |
| 8 | 反馈与工单服务 | E-15 | 29 | `impl/29` | 实现方案完成 |
| 9 | 搜索服务（统一搜索） | P-29 | 29/11 | `impl/29` | 实现方案完成 |
| 10 | 媒体服务（寻址/转码/缩略图/OCR） | K-28 | 20/31 | `impl/20` | 实现方案完成 |
| 11 | 沙箱镜像管理服务 | P-21 | 28/07 | `impl/07` | 实现方案完成 |
| 12 | 模型目录同步服务 | K-06 | 02 | `impl/02` | 实现方案完成 |
| 13 | 凭证轮换服务 | E-08 | 30 | `impl/27` | 实现方案完成 |
| 14 | 配额与预算服务（动态再分配增强） | E-03 | 24/31 | `impl/26` | 实现方案完成 |
| 15 | 崩溃恢复协调器（自动续跑增强） | P-13 | 19 | `impl/19` | 实现方案完成 |
| 16 | 系统钥匙串 | E-10 | 30 | `impl/27` | 实现方案完成 |
| 17 | 协议处理器（`oc://` 深链） | E-16 | 29 | `impl/22` | 实现方案完成 |
| 18 | 单实例锁与文件关联 | E-17 / E-20 | 22 | `impl/23` | 实现方案完成 |
| 19 | 自动启动与托盘常驻 | E-18 | 22 | `impl/23` | 实现方案完成 |
| 20 | Shell 集成（补全 + `cd` 联动） | E-19 | 29 | `impl/22` | 实现方案完成 |
| 21 | 系统证书信任与代理 | E-11 | 30 | `impl/27` | 实现方案完成 |
| 22 | 契约生成器与一致性校验 | T-01 | 27/29 | `impl/29` | 实现方案完成 |
| 23 | 假模型 / 故障注入器 / 基准运行器 | T-04 / T-03 | 26 | `impl/33` | 实现方案完成 |
| 24 | 数据种子与脱敏工具 | T-05 | 29 | `impl/29` | 实现方案完成 |
| 25 | 企业网关（模型出口 DLP/审计） | X-13 | 24 | `impl/25` | 实现方案完成 |
| 26 | SIEM / 数据湖出口 | X-12（+P-09 出口客户端） | 16/24 | `impl/25` | 实现方案完成 |

---

## D.7 孤儿组件检查与统计

### D.7.1 有组件无归属卷

**结论：0 项**。D.1–D.5 全部 137 个组件均有唯一「归属卷」（主卷），跨卷协作以「主卷 + 备注」表达，不存在无主组件。轮次 2 的 26 项缺失组件全部有落点（§D.6），其中 21 项为新建子系统/组件，5 项（媒体服务、崩溃恢复协调器、配额预算、数据种子、SIEM 出口）为既有组件的增强，同样已登记。

### D.7.2 跨卷组件（多归属，主卷已在表内）

| 组件 | 主卷 | 协作卷 | 协作面 |
| --- | --- | --- | --- |
| K-05 UsageRecorder | 02 | 31 | 计量 → 成本归因 |
| K-10 SymbolIndexService | 03 | 11 | 上下文符号索引 ↔ 知识检索 |
| K-28 MediaService | 20 | 31、25 | 媒体存储 ↔ 容量 ↔ 渲染工件（F-01） |
| K-35…K-42 实验与原型族 | 25 | 03/07/08/11/02/26 | 原型只经各卷扩展点，不自建能力 |
| P-05 RuntimeStore | 01 | 31 | 运行态 ↔ 容量模型 |
| P-09 EventExportSink | 16 | 24 | 事件出口 ↔ 企业合规 |
| P-18 SnapshotStore | 20 | 19 | 快照 ↔ 持久化 |
| P-21 SandboxImageManager | 28 | 07 | 分发 ↔ 沙箱 |
| P-29 UnifiedSearch | 29 | 11 | 统一入口 ↔ 索引本体 |
| P-30 TrajectoryExporter | 12 | 14、19、25 | 轨迹 ↔ 任务/持久化/F-03 |
| E-03 QuotaEngine | 24 | 31 | 准入 ↔ 成本与容量 |
| E-05 AuditChain | 24 | 16 | 审计 ↔ 事件链 |
| E-06 DlpPolicyEngine | 24 | 30 | 策略 ↔ 安全工程 |
| E-21 NotificationBridge | 22 | 28 | 系统通知 ↔ 通知聚合 |
| E-31 DesktopApp | 22 | 28、29 | 端形态 ↔ 更新 ↔ 深链 |
| E-32 DesktopUi | 22 | 33 | 界面 ↔ 交互细则 |
| X-01 PostgreSQL / X-02 Redis | 01 | 19、31 | 基座 ↔ 持久化 ↔ 容量 |
| X-12 SIEM / X-13 企业网关 | 24 | 16/30 | 合规 ↔ 事件 ↔ 安全 |

### D.7.3 有卷无组件（卷 → 组件覆盖检查）

| 卷 | 组件覆盖 | 结论 |
| --- | --- | --- |
| 00 愿景与产品 | 无 | **基线卷（有意为之）**：需求与功能全景，不含实现组件，非缺口 |
| 01–24 | 逐卷至少 1 个组件（01→P-01…P-05；02→K-01…K-06；03→K-07…K-10；04→K-11/K-12；05→K-13…K-16；06→K-17…K-20；07→P-19…P-21；08→K-24；09→P-25/P-26；10→K-25；11→K-26/K-27；12→K-29…K-31；13→K-34；14→K-32；15→K-33；16→P-06…P-09；17→K-21；18→K-22/K-23；19→P-10…P-15；20→P-16…P-18；21→P-22…P-24；22→E-30/E-31/P-33；23→P-27/P-28；24→E-01…E-06） | 覆盖 |
| 25 前沿探索 | K-35…K-42（实验治理 + 十二方向原型） | 覆盖（本批次新增） |
| 26 评测 | T-03/T-04/T-09/T-10 | 覆盖 |
| 27 技术路径 | T-01/T-02（过程卷，以工程工具承载） | 覆盖（过程卷，无运行时组件属正常） |
| 28–35 | 28→E-22…E-26、T-11…T-14；29→E-12…E-19、E-27…E-29；30→E-07…E-11、X-14；31→E-04；32→T-06…T-08；33→E-32；34→P-31；35→P-32 | 覆盖 |
| 附录 A/B/C | 无 | 总览类附录（领域模型/接口契约/术语），非实现单元，不适用 |

### D.7.4 统计

| 维度 | 分布 |
| --- | --- |
| 组件总数 | **137**（含 `×4`/`×2` 等集合行按 1 项计；轮次 2 的 26 项全部在内） |
| 按分组 | 内核与智能层 K：42 ｜ 协作与平台层 P：33 ｜ 企业·生态·前端 E：32 ｜ 工程与运维 T：16 ｜ 外部系统 X：14 |
| 按类型 | 进程内服务 63 ｜ 后台服务 28 ｜ OS 集成 8 ｜ 协议面 9 ｜ 工程工具 15 ｜ 外部系统 14 |
| 按状态 | 实现方案完成 **137**（`impl/01–35` 全部已产出，R01 逐行核验「实现方案」列指向文件存在） ｜ 待实现 **0**（原 67 行随 `impl/25–34`、`impl/35` 落盘批量翻转） ｜ 设计完成 0 |
| 与 Phase A 基线对照 | Phase A 附录 D 基线 108 项已全部折入本表（多数合并进同族行，如 `BuiltinTools`、`IsolationProvider×4`）；本表净增 29 项（轮 2 的 21 项新建 + 实验与原型族 8 项） |
| 组件级方案映射（R10 新增） | 命中 `impl/components/Cxx-*.md` **59** 项（D.1 24 / D.2 20 / D.3 6 / D.4 9 / D.5 0）；由系统级方案覆盖 **78** 项（D.1 18 / D.2 13 / D.3 26 / D.4 7 / D.5 14）。实算命令（行级）：`grep -cE '^\| [KPETX]-[0-9]{2} \|.*components/C[0-9]' appendix-d-component-inventory.md` = 59、`grep -cE '^\| [KPETX]-[0-9]{2} \|.*由系统级方案覆盖' appendix-d-component-inventory.md` = 78 |

**维护约定**：本表随批次推进更新；状态口径见文首「状态口径」；新增卷或新增原型方向时，先登记本表再写方案（卷 25 的「实验必须登记」纪律同样适用于组件层）。

> **模块落点登记（R07 新增）**：Phase B 实现层引入了 **23 个卷 27 §4.1 未登记的扩展 Maven 模块**（`kernel-cost` / `kernel-governance` / `kernel-security` / `kernel-dist` / `kernel-eco` / `kernel-qa` / `kernel-ops` / `kernel-frontier`；`platform-identity` / `platform-audit` / `platform-security` / `platform-dist` / `platform-eco` / `platform-intel` / `platform-qa` / `platform-ops` / `platform-frontier`；`host-enterprise` / `host-automation` / `host-intel` / `host-ui` / `host-frontier`；根级 `harness-testkit`），清单、归属文件与命名口径见 `reviews/R07-scope-build-platform.md` §2。本表登记新组件时**必须同时标注其 Maven 模块**（组件 → 模块 → 卷三层齐备），避免出现「组件有归属卷、无 Maven 落点」的可落地性缺口。

> **R01 机械校验更新（本轮）**：`impl/01–35-*-impl.md` 共 35 份全部存在；原标「待实现」的 91 个表格单元（组件表 67 + §D.6 缺失组件表 24）逐行核验其「实现方案」列所指 `impl/NN` 文件均存在，统一改标「实现方案完成」。文首「数据来源」④⑤ 的原批次描述同步更新。

> **R02 复核（本轮）**：逐节实算行数 K 42 / P 33 / E 32 / T 16 / X 14 = **137**，与 §D.7.4 声明一致；状态实算「实现方案完成 137（组件表 137 + §D.6 26 行均完成）」、待实现 **0**、设计完成 **0**；「实现方案」列指向的 `impl/01–35` 全部存在（含 E-32 双引用 23+30）；孤儿检查三项结论不变（§D.7.1 0 项 / §D.7.3 全卷覆盖）。本表状态口径确认与 `impl/README.md` §2 索引（REQ/I-/图数）无交叉矛盾。

> **R10 补登记（本轮）**：① 新增「组件级方案」列（口径见文首），137 行全部有值：59 行指向 `impl/components/Cxx-*.md`（组件级方案 36 份已全部落盘，索引见 `impl/components/README.md`；建议汇总见 `impl/components/SUGGESTIONS.md`），78 行标注「由系统级方案覆盖」——消除了 R09 登记的「C↔附录 D 编号映射缺失」缺口（AUDIT §8 W2）；② 组件级方案的修订建议（126 条去重，阻塞 6 / 重要 98 / 一般 22）已由编排方并入 `impl/IMPL-DECISIONS.md` §4 号段登记（X-90…X-215）；③ 本表「实现方案」列与本列构成「组件 → 系统级方案 → 组件级方案」三层指针，任一层缺失即视为设计缺口（维护约定衔接 §D.7 孤儿检查）。
