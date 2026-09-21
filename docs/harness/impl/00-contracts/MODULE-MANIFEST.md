# MODULE-MANIFEST · Harness 模块清单（唯一权威）

> **状态**：冻结候选——自本文件被接受之日起，模块名、坐标、目录与包根**不可变更**；变更须先改本文件并走 §7 流程。
> **位置**：`docs/harness/impl/00-contracts/MODULE-MANIFEST.md`（impl 层契约文件 00 号，先于 01–35 生效）。
> **关闭的缺口**：`reviews/R10-walkthrough.md` §六 **G1**（Maven 坐标不可唯一确定）/ **G2**（三个层带聚合 POM 未定义）/ **G5**（v1 模块在 reactor 中的位置未定义）/ **B1**（模块清单不可唯一确定，24 处「待登记」）/ **B2**（首个 PR 的物理落点未定）。
> **取证依据**：`27-technical-path.md` §4.1–§4.5/§4.8；`01-harness-architecture.md` §4.5；`impl/README.md` §1.2/§5；`appendix-d-component-inventory.md` L277；`reviews/R07-scope-build-kernel.md` §1–§2 与 `R07-scope-build-platform.md` §2；根 `pom.xml`（v1 实况）；`grep -rhoE '\-pl [^ ]+' docs/harness/impl | sort -u`（选择器全量，去重 49 条）。

## §1 目的与权威性

### 1.1 单一权威声明

本文件是 OpenCoding Harness（下称 v2）**模块名、Maven 坐标、目录、编译期依赖方向、Java 包根**的唯一事实源。卷 27 §4.1（L94–138）目前只给出目录名，未给坐标与聚合器；在卷 27 按 §7.1 回改之前，**任何与本文件冲突的模块名以本文件为准**。本文件生效后，未在此登记的模块名不得出现在 `pom.xml`、`-pl` 选择器、验收命令与 CI 脚本中。

### 1.2 与其他文件的关系

| 文件 | 关系 |
| --- | --- |
| `27-technical-path.md` §4.1–§4.5 | 上位设计（四段式结构、R1–R5 依赖规则、20 步实现序、迁移批次）；本文件是其**坐标化展开**，逐条可执行 |
| `01-harness-architecture.md` §4.5 | 三带铁律与内核零框架；其中 `harness-core`/`harness-surface` 是**域带别名**，本文件明确其**非模块名** |
| `impl/**` 各文件 §①/§⑪ | 模块落点与验收命令来源；与本文件冲突时**改 impl**（§7.2 给出逐文件动作） |
| `appendix-d-component-inventory.md` | 组件 → 模块 → 卷三层登记；其「模块」列的权威在本文件 |

### 1.3 已知冲突名清单（offenders，均为 grep 实证）

| 名称 | 出现位置（file:line） | 性质 | 本文件裁决 |
| --- | --- | --- | --- |
| `harness-core` | impl/01 L37/44/49/89/99/213、02 L38/189、03 L40/147/199、04 L44/140/162/194、05 L55、13 L70、35 L72/1003 | 卷 01 §4.2 的三带**别名**，非 reactor 路径 | **废弃为模块名**；仅允许作域带术语出现在 01 卷 §4.2 与 Mermaid 图标签；禁止出现在 pom、依赖声明与 `-pl` 中 |
| `harness-surface` | impl/01 L40/44/49/196、03 L170、04 L162 | 同上（交互域带别名） | 同上 |
| `harness-contract/harness-contract-intel` | impl/32 L8/L1042 | 契约**子模块双轨**（卷 27 §4.1 的 `harness-contract` 是单模块） | **废弃**；契约永远单模块，按 `contract/<域>` 分包 |
| `harness-contract/contract-qa` | impl/33 L8 | 同上 | 同上（包 `contract/qa`） |
| `harness-contract/contract-ops` | impl/34 L12 | 同上 | 同上（包 `contract/ops`） |
| `harness-host/host-eco` | impl/29 L35/L924 | 生态外壳模块名，与同文件 §1.5「`host-{protocol,cli,bootstrap}`」自相矛盾 | **撤销**；生态外壳面落 `host-protocol` 的 `eco.*` 命名空间 + `host-bootstrap` 装配（以 §1.5 为准） |
| `host-ui`、`host-automation`、`host-intel` | impl/30 L42/L1080、31 L79/L1016、32 L8/L1047（均附「降级备选」） | 同一模块两种口径，未定死 | **保留为正式模块**（冻结「新增」分支，交付期不再二选一）；impl 中的降级表述作废并回改（§7.2） |
| `integrations/ide-vscode`、`sdk/examples` | impl/29 L1054–1055 | 未登记目录落点 | **收敛进 client workspace**：`client/packages/ide-vscode`；示例并入 `client/packages/sdk/examples/`（§2.6） |
| `tools/plugin-sdk` | impl/18 L55/L58/L987（X-88、X-C24-2） | 插件开发套件未命名模块 | **登记为独立 Maven 工程**（§2.5），仅依赖 `harness-contract` |
| `tools/fake-llm`、`tools/seed`、`tools/eval` | 卷 27 §4.3/§4.7（L197/260/261/375） | 工具目录与 impl/33 的 `kernel-qa`/`platform-qa` 双轨 | **收敛**：假模型 → `kernel-qa`（同进程主路径）；种子数据 → `oc qa seed`（host-cli 命令 + platform-qa 数据）；评测运行器 → `platform-qa`（`tools/eval` 降为别名） |
| `open-coding-*`（v1 名） | 命令级残留已由 R07 清零（impl/35 L72、24 L1100 为修正说明；22 L64、29 L18 为禁令/废弃标注）；现存命中全部位于「迁移来源」列（impl/05 L45–51、07 L40–43、08 L44–47、17 L46–50、18 L49–55） | v1 模块名，仅迁移期对账 | **仅允许出现在「v1 迁移来源」列/注释**；禁止作 `-pl` 选择器与依赖坐标 |
| `harness-design` | 卷 27 L165（R4） | 表述勘误：它指向 `docs/design`（文档目录，无坐标） | R4 改写为「不得依赖 v1 包前缀 `com.hk.opencoding.{core,domain,infrastructure,application,interfaces,bootstrap}`」（§7.1） |

### 1.4 裁决顺位

1. 本文件（模块名/坐标/目录/依赖/包根）→ 2. 卷 27 §4.2 依赖规则 R1–R5 → 3. `01-harness-architecture.md` §4.5 → 4. impl 各文件 §① 模块落点 → 5. impl 各文件 §⑪ 验收命令。**第 5 位与上位冲突时改命令，不改契约。**

---

## §2 模块总表

### 2.0 列口径与段映射

- 列口径：`artifactId` / `groupId` / 段 / 目录 / 职责（一句话存在理由）/ 编译期依赖 / 对应卷与 impl / 首批类或包 / v1 关系。
- 段映射（与任务口径对齐）：**内核** = 契约段 + 内核段；**核心实现** = 平台段；**外壳** = 外壳段；**端** = 端段；**插件** = 工程段中的 `plugin-sdk`；**工程** = 工程段其余（BOM、testkit）。
- groupId 全为 `com.hk.opencoding`（对齐根 `pom.xml` L7 与 `AGENTS.md`）；version 全为 `${opencoding.project.version}`（当前 `0.0.1`）。
- 「对应卷 / impl」列给出主归属卷与所有权文件，跨域引用不重复登记。

### 2.1 契约段（1）

| artifactId | groupId | 段 | 目录 | 职责（存在理由） | 编译期依赖 | 对应卷 / impl | 首批类 / 包 | v1 关系 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `harness-contract` | `com.hk.opencoding` | 契约 | `harness-contract/` | 全系统唯一契约源（端口/枚举/record/事件 Schema/错误码），零第三方依赖；缺它则各端各写协议 | 无（仅 JDK） | 卷 01/16/18/24；impl 全 35 份 | 包 `com.hk.opencoding.contract.{session,event,error,model,context,prompt,tool,permission,work,team,plugin,mcp,skill,hook,memory,knowledge,vcs,workspace,sandbox,codec,ent,cost,security,dist,eco,intel,qa,ops,frontier,ux}`；首批 `ErrorCode`/`HarnessException`/`EventEnvelope`/`EventAppender`/`AdmissionOutcome`/`HostProfile` | 新增（语义承自 v1 `open-coding-common` + `open-coding-core-api`） |

### 2.2 内核段（17：1 聚合器 + 16 叶子）

| artifactId | groupId | 段 | 目录 | 职责（存在理由） | 编译期依赖 | 对应卷 / impl | 首批类 / 包 | v1 关系 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `harness-kernel` | `com.hk.opencoding` | 内核 | `harness-kernel/` | 层带聚合器（`packaging=pom`）：承载 R1「零 Spring/Jackson/JDBC/Redis/HTTP」Enforcer 基线；无源码 | `harness-contract` | 卷 27 §4.1/§4.2；impl/01 L89–99 | 仅 `pom.xml` | 新增（聚合器，v1 无对应） |
| `kernel-model` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-model/` | 四协议适配器与模型网关（装饰器链/路由/计量），内核内唯一可携带厂商 SDK 的模块 | `harness-contract` | 卷 02；impl/02 | 包 `com.hk.opencoding.kernel.model.{adapter,stream,decorate,block}`；`ModelGateway`/`ProtocolAdapter`/`StreamCursor`/`ContentBlock` | 承自 v1 `open-coding-core-model`（裁剪依赖后重写） |
| `kernel-context` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-context/` | 九区段上下文组装、预算拟合、四级压缩、引用外置 | `harness-contract` | 卷 03；impl/03 | 包 `kernel.context`；`ContextEngine`/`TokenBudget`/`ContextSection`/`ArtifactRef` | 新增（v1 无独立上下文模块） |
| `kernel-prompt` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-prompt/` | 提示词资产解析树、变量绑定、条件渲染、指纹与灰度判定 | `harness-contract` | 卷 04；impl/04 | 包 `kernel.prompt`；`PromptArtifact`/`PromptAssemblyRequest` | 新增 |
| `kernel-tool` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-tool/` | 工具三通道契约实现：注册表、参数校验、执行管线、冲突图调度、副作用账本、内置工具族 | `harness-contract` | 卷 05；impl/05 | 包 `kernel.tool.{registry,pipeline,scheduler,ledger}`；`ToolRuntime`/`ToolScheduler`/`SideEffectLedger` | 承自 v1 `open-coding-core-tool`（命令执行下沉平台段） |
| `kernel-permission` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-permission/` | 风险分级、五层决策链、审批编排、策略 DSL 求值（零框架可单测） | `harness-contract` | 卷 06；impl/06 | 包 `kernel.permission` | 新增（v1 权限逻辑分散于 application/interfaces） |
| `kernel-agent` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-agent/` | 主循环（ReAct）、Thread/Turn/Item、SubAgent 扇出、会话运行时状态机、检查点、团队编排队列 | `harness-contract`、`kernel-event`、`kernel-model`、`kernel-context`、`kernel-tool`、`kernel-permission` | 卷 12/13；impl/01/12/13 | 包 `kernel.agent` + `kernel.agent.team` + `kernel.agent.session`；`AgentRuntime`/`SessionRuntime`/`InputAdmission`/`CheckpointWriter` | 承自 v1 `open-coding-core-agent`（循环重写） |
| `kernel-work` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-work/` | WorkItem 状态机/DAG/租约、Goal 自治循环与熔断、自动化模板展开 | `harness-contract`、`kernel-event` | 卷 14/15/34；impl/14/15/21/31 | 包 `kernel.work` + `kernel.work.automation` | 新增 |
| `kernel-event` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-event/` | 事件信封、双通道、分区有序、投影与回放决策（不含存储实现） | `harness-contract` | 卷 16；impl/16 | 包 `kernel.event` | 新增（v1 无事件总线） |
| `kernel-governance` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-governance/` | 企业治理纯逻辑：租户解析、主体/角色→能力映射、合规删除判定（零 Spring，供 `platform-identity` 复用） | `harness-contract` | 卷 24；impl/25 | 包 `kernel.governance` | 新增（扩展，appendix-d L277 已登记） |
| `kernel-cost` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-cost/` | 计价、预算判定、阈值熔断、成本归因与 ROI 的纯决策（假时钟可测） | `harness-contract` | 卷 31；impl/26 | 包 `kernel.cost` | 新增（扩展） |
| `kernel-security` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-security/` | 命令 AST 检查、规则匹配、密钥引用决策、供应链校验纯逻辑 | `harness-contract` | 卷 30；impl/27 | 包 `kernel.security` | 新增（扩展） |
| `kernel-dist` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-dist/` | 更新候选评估、防降级矩阵、更新通道选择纯逻辑 | `harness-contract` | 卷 28；impl/28 | 包 `kernel.dist` | 新增（扩展） |
| `kernel-eco` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-eco/` | 生态身份吊销判定、搜索排序与深链校验前置逻辑 | `harness-contract` | 卷 29；impl/29 | 包 `kernel.eco` | 新增（扩展） |
| `kernel-qa` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-qa/` | 假模型脚本引擎、故障注入器、评分器、门禁判定；**离线零凭证跑通主链路的唯一入口** | `harness-contract` | 卷 26；impl/33 | 包 `kernel.qa`；`FakeModelProvider`/`ScriptedModel` | 新增（扩展；兑现 R10 §四 R4） |
| `kernel-ops` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-ops/` | 燃尽计算、容量水位判定、降级顺序决策、幂等步骤与指纹 | `harness-contract` | 卷 32；impl/34 | 包 `kernel.ops` | 新增（扩展） |
| `kernel-frontier` | `com.hk.opencoding` | 内核 | `harness-kernel/kernel-frontier/` | 前沿实验门控与原型纯逻辑（实验命名空间，禁止平行实现） | `harness-contract` | 卷 25；impl/35 | 包 `kernel.frontier` | 新增（扩展） |

### 2.3 平台段（22：1 聚合器 + 21 叶子；Spring 允许）

| artifactId | groupId | 段 | 目录 | 职责（存在理由） | 编译期依赖 | 对应卷 / impl | 首批类 / 包 | v1 关系 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `harness-platform` | `com.hk.opencoding` | 平台 | `harness-platform/` | 层带聚合器（`packaging=pom`）：承载 R2「不得依赖 `harness-host`」Enforcer 基线；无源码 | `harness-contract` | 卷 27 §4.2 | 仅 `pom.xml` | 新增（聚合器） |
| `platform-persistence` | `com.hk.opencoding` | 平台 | `harness-platform/platform-persistence/` | PG 仓储、迁移框架（Flyway）、事件表、备份恢复、导出包；**DDL 唯一权威**；含 `legacy` 只读桥 | `harness-contract`、`platform-runtime-store` | 卷 19；impl/19 | 包 `platform.persistence.{,recovery,legacy}` | 承自 v1 `open-coding-domain`（表族重构） |
| `platform-runtime-store` | `com.hk.opencoding` | 平台 | `harness-platform/platform-runtime-store/` | Redis 与进程内降级实现（锁/位点/缓存/对象存储引用），v1 基础设施的收敛点 | `harness-contract` | 卷 01；impl/02/05/06/10/15/16/19/26/31 | 包 `platform.runtime.store` | 承自 v1 `open-coding-infrastructure`（按域拆分） |
| `platform-workspace` | `com.hk.opencoding` | 平台 | `harness-platform/platform-workspace/` | 四类工作区后端（本地/SSH/容器/云）、连接池、忽略语义、快照 | `harness-contract`、`platform-sandbox` | 卷 20；impl/20 | 包 `platform.workspace.{,exec}` | 新增（v1 无工作区抽象） |
| `platform-sandbox` | `com.hk.opencoding` | 平台 | `harness-platform/platform-sandbox/` | 五档隔离执行、跨平台命令执行、网络与密钥代理（凭据注入通道） | `harness-contract` | 卷 07；impl/07 | 包 `platform.sandbox` | 承自 v1 `open-coding-core-tool`（命令执行部分下沉） |
| `platform-vcs` | `com.hk.opencoding` | 平台 | `harness-platform/platform-vcs/` | Git 集成、worktree 隔离、合并队列、护栏与回滚点 | `harness-contract` | 卷 21；impl/21 | 包 `platform.vcs` | 新增 |
| `platform-knowledge` | `com.hk.opencoding` | 平台 | `harness-platform/platform-knowledge/` | 知识连接器、切分、三路检索（含 pgvector）、引用与知识页 | `harness-contract`、`platform-persistence` | 卷 11；impl/11 | 包 `platform.knowledge` | 新增 |
| `platform-memory` | `com.hk.opencoding` | 平台 | `harness-platform/platform-memory/` | 四层记忆存储、候选写入、混合召回、合规删除 | `harness-contract`、`platform-persistence`、`platform-runtime-store` | 卷 10；impl/10 | 包 `platform.memory` | 新增 |
| `platform-enterprise` | `com.hk.opencoding` | 平台 | `harness-platform/platform-enterprise/` | 企业基线：租户上下文贯穿、配额骨架、DLP、诊断面（实现按 §2.3 拆分为 identity/audit 两模块） | `harness-contract`、`platform-persistence` | 卷 24；impl/25 | 包 `platform.enterprise` | 新增（v1 无对应） |
| `platform-identity` | `com.hk.opencoding` | 平台 | `harness-platform/platform-identity/` | `platform-enterprise` 拆分件：SSO/SCIM/主体与角色、会话与令牌吊销 | `harness-contract`、`platform-persistence`、`kernel-governance` | 卷 24；impl/25 | 包 `platform.identity` | 新增（扩展，拆分口径） |
| `platform-audit` | `com.hk.opencoding` | 平台 | `harness-platform/platform-audit/` | `platform-enterprise` 拆分件：审计事件采集、归档介质、合规查询与导出 | `harness-contract`、`platform-persistence` | 卷 24；impl/25 | 包 `platform.audit` | 新增（扩展，拆分口径） |
| `platform-plugin` | `com.hk.opencoding` | 平台 | `harness-platform/platform-plugin/` | 插件装载器、类加载隔离、依赖求解、稳定性契约校验、市场客户端（`pure`/`config` 分包） | `harness-contract`、`platform-persistence` | 卷 18；impl/18 | 包 `platform.plugin.{pure,config}` | 承自 v1 `open-coding-plugin` |
| `platform-mcp` | `com.hk.opencoding` | 平台 | `harness-platform/platform-mcp/` | MCP 四传输客户端、能力映射、Server 暴露、企业网关 | `harness-contract`、`platform-persistence` | 卷 09；impl/09 | 包 `platform.mcp` | 新增 |
| `platform-skill` | `com.hk.opencoding` | 平台 | `harness-platform/platform-skill/` | 技能包装载、激活、能力声明校验、分发与市场 | `harness-contract`、`platform-persistence` | 卷 08；impl/08 | 包 `platform.skill` | 新增 |
| `platform-hooks` | `com.hk.opencoding` | 平台 | `harness-platform/platform-hooks/` | 钩子点执行器、脚本/HTTP 沙箱执行、超时与熔断 | `harness-contract`、`platform-persistence` | 卷 17；impl/17 | 包 `platform.hooks` | 新增 |
| `platform-security` | `com.hk.opencoding` | 平台 | `harness-platform/platform-security/` | 密钥生命周期（钥匙串/KMS/代理）、供应链校验、威胁对策落地 | `harness-contract` | 卷 30；impl/27 | 包 `platform.security` | 新增（扩展） |
| `platform-dist` | `com.hk.opencoding` | 平台 | `harness-platform/platform-dist/` | 更新器、更新通道、差分与私仓、遥测聚合、许可 | `harness-contract`、`platform-persistence` | 卷 28；impl/28 | 包 `platform.dist` | 新增（扩展） |
| `platform-eco` | `com.hk.opencoding` | 平台 | `harness-platform/platform-eco/` | Registry 客户端、导入器、统一搜索、深链校验、IM 绑定 | `harness-contract`、`platform-persistence`、`kernel-eco` | 卷 29；impl/29 | 包 `platform.eco` | 新增（扩展；替代 v1 `open-coding-integrations`，已废弃名） |
| `platform-intel` | `com.hk.opencoding` | 平台 | `harness-platform/platform-intel/` | 智能增强能力宿主：PR 描述/审查机器人/测试生成等只读能力与门禁 | `harness-contract`、`platform-persistence` | 卷 35；impl/32 | 包 `platform.intel` | 新增（扩展） |
| `platform-qa` | `com.hk.opencoding` | 平台 | `harness-platform/platform-qa/` | 评测任务集、快照台账、基准运行器、趋势数据（`tools/eval` 的归宿） | `harness-contract`、`platform-persistence` | 卷 26；impl/33 | 包 `platform.qa` | 新增（扩展） |
| `platform-ops` | `com.hk.opencoding` | 平台 | `harness-platform/platform-ops/` | 探针执行器、自愈、告警治理、演练编排、修复执行器、事故时间线 | `harness-contract`、`platform-persistence` | 卷 32；impl/34 | 包 `platform.ops` | 新增（扩展） |
| `platform-frontier` | `com.hk.opencoding` | 平台 | `harness-platform/platform-frontier/` | 前沿实验宿主：多模态/计算机使用/自进化原型的平台侧装配与门控 | `harness-contract`、`platform-persistence` | 卷 25；impl/35 | 包 `platform.frontier` | 新增（扩展） |

### 2.4 外壳段（12：1 聚合器 + 11 叶子）

| artifactId | groupId | 段 | 目录 | 职责（存在理由） | 编译期依赖 | 对应卷 / impl | 首批类 / 包 | v1 关系 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `harness-host` | `com.hk.opencoding` | 外壳 | `harness-host/` | 层带聚合器（`packaging=pom`）：承载「外壳只能依赖内核与平台，不得反向」基线；无源码 | `harness-contract` | 卷 27 §4.2 | 仅 `pom.xml` | 新增（聚合器） |
| `host-app` | `com.hk.opencoding` | 外壳 | `harness-host/host-app/` | 用例编排与事务边界（会话/项目/团队/成本审批桥/自动化调度），v1 `application` 的收口 | `harness-contract`、`kernel-agent`、`kernel-work`、`platform-persistence` | 卷 13/15/24/26；impl/13/15/25/26/31 | 包 `host.app.{,team,work}` | 承自 v1 `open-coding-application` |
| `host-protocol` | `com.hk.opencoding` | 外壳 | `harness-host/host-protocol/` | 协议面（JSON-RPC/REST/SSE/WS）+ SDK 生成源 + 事件 Schema 发布；`ui.*`/`eco.*`/`intel.*`/`automation.*` 命名空间宿主 | `harness-contract`、`host-app` | 卷 01/22；impl 全 35 份 | 包 `host.protocol` | 承自 v1 `open-coding-interfaces` |
| `host-cli` | `com.hk.opencoding` | 外壳 | `harness-host/host-cli/` | CLI/TUI 端与 `oc` 命令面（含 embedded/sidecar/remote 三档宿主、`oc qa`/`oc ops`/`oc doctor`） | `harness-contract`、`host-protocol`、`host-app` | 卷 22；impl/22/33/34 | 包 `host.cli` | 新增（v1 无 CLI） |
| `host-server` | `com.hk.opencoding` | 外壳 | `harness-host/host-server/` | 服务形态入口（Spring Boot 应用）与调度器宿主（SchedulerRunner） | `harness-contract`、`host-protocol`、`host-app` | 卷 15/19；impl/15/19/20 | 包 `host.server`；启动类 | 新增（服务形态，v1 由 `open-coding-bootstrap` 兼任） |
| `host-a2a` | `com.hk.opencoding` | 外壳 | `harness-host/host-a2a/` | A2A/ACP 服务面与客户端、任务映射、联邦目录、mTLS | `harness-contract`、`host-app`、`host-protocol` | 卷 23；impl/24 | 包 `host.a2a` | 新增 |
| `host-bootstrap` | `com.hk.opencoding` | 外壳 | `harness-host/host-bootstrap/` | **显式装配计划**与启动入口：能力探测、`@ConfigurationPropertiesScan` 激活、宿主档切换；全树唯一装配点 | 全部 `kernel-*`、`platform-*`、`host-app/host-protocol` | 卷 01；impl/01 及全 35 份 §⑨ | 包 `host.bootstrap` | 承自 v1 `open-coding-bootstrap` + `open-coding-core-implementation` |
| `host-enterprise` | `com.hk.opencoding` | 外壳 | `harness-host/host-enterprise/` | 企业治理装配面（SSO/SCIM/审计/配额控制台/诊断端点） | `platform-identity`、`platform-audit`、`host-protocol` | 卷 24；impl/25 | 包 `host.enterprise` | 新增（扩展） |
| `host-ui` | `com.hk.opencoding` | 外壳 | `harness-host/host-ui/` | 服务侧交互支撑（分享/偏好/安全点/组件契约的 BFF 面）；端实现仍在 `client/*` 与 `host-cli` | `host-protocol`、`host-app` | 卷 22/33；impl/30 | 包 `host.ui` | 新增（扩展；降级备选作废） |
| `host-automation` | `com.hk.opencoding` | 外壳 | `harness-host/host-automation/` | 自动化模板库的装配与运行面（模板目录、干跑、沙箱试运行门禁） | `kernel-work`、`host-protocol`、`host-app` | 卷 34；impl/31 | 包 `host.automation` | 新增（扩展；降级备选作废） |
| `host-intel` | `com.hk.opencoding` | 外壳 | `harness-host/host-intel/` | 智能增强的装配与契约面（能力入口、取消、解释同源、成本对账） | `platform-intel`、`host-protocol` | 卷 35；impl/32 | 包 `host.intel` | 新增（扩展；降级备选作废） |
| `host-frontier` | `com.hk.opencoding` | 外壳 | `harness-host/host-frontier/` | 前沿实验的装配与实验治理端点（实验面板与徽标） | `platform-frontier`、`host-protocol` | 卷 25；impl/35 | 包 `host.frontier` | 新增（扩展） |

### 2.5 工程段（3）

| artifactId | groupId | 段 | 目录 | 职责（存在理由） | 编译期依赖 | 对应卷 / impl | 首批类 / 包 | v1 关系 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `harness-bom` | `com.hk.opencoding` | 工程 | `harness-bom/` | v2 唯一 BOM 与父 POM：导入 `spring-boot-dependencies`、统一全部 `harness-*` 坐标与插件基线、装配 Enforcer | 无（仅 pom） | 卷 27 §4.1/§4.2/§4.6 | 仅 `pom.xml` | 新增 |
| `harness-testkit` | `com.hk.opencoding` | 工程 | `harness-testkit/` | 测试基座：Testcontainers、脚本化协议客户端、PTY 驱动、SSE mock；**仅测试期依赖，禁入生产 classpath** | `harness-contract`、`host-protocol`（test scope） | 卷 26；impl/33 | 包 `com.hk.opencoding.testkit` | 新增（根级扩展，appendix-d L277 已登记） |
| `plugin-sdk` | `com.hk.opencoding` | 插件 | `tools/plugin-sdk/` | 插件开发套件（脚手架/清单校验/契约测试/打包签名），**独立 reactor**，仅依赖 `harness-contract` | `harness-contract` | 卷 18；impl/18 L55/L987（X-88） | 包 `com.hk.opencoding.pluginsdk` | 承自 v1 `open-coding-plugin` 的 SDK 部分 |

### 2.6 端段（4，非 Maven）

| 包名 | 工程 | 段 | 目录 | 职责（存在理由） | 依赖 | 对应卷 / impl | 首批产出 | v1 关系 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@open-coding/app` | pnpm | 端 | `client/packages/app/` | Electron 主/预加载/渲染进程与 IPC 清单（`app/src/shared/ipc/`） | `@open-coding/ui`、`@open-coding/sdk` | 卷 22；impl/23 | 工作台三视图 + 审批流 + diff + 成本面板 | 重写自 v1 `open-coding-client` |
| `@open-coding/ui` | pnpm | 端 | `client/packages/ui/` | 组件库、主题、可访问性基线（唯一视觉实现源） | — | 卷 22/33；impl/30 | 组件契约与设计令牌 | 重写自 v1 `open-coding-client` |
| `@open-coding/sdk` | pnpm | 端 | `client/packages/sdk/` | 协议客户端（由 `host-protocol` 生成 + 手写封装）；**TS 类型单一来源**；含 `examples/`（原 `sdk/examples` 落点） | 生成自 `host-protocol` | 卷 01/22；impl/22/23/29 | 生成客户端 + `generate --check` 门禁 | 新增 |
| `@open-coding/ide-vscode` | pnpm | 端 | `client/packages/ide-vscode/` | IDE 插件端（原 `integrations/ide-vscode` 收敛落点），复用 `@open-coding/sdk` | `@open-coding/sdk` | 卷 29；impl/29 L1054 | 插件脚手架与端到端用例 | 新增 |

### 2.7 计数与 §⑪ 覆盖核对

- **主 reactor Maven 模块 54 个**：契约 1 + 内核聚合器 1 + 内核叶子 16 + 平台聚合器 1 + 平台叶子 21 + 外壳聚合器 1 + 外壳叶子 11 + `harness-bom` + `harness-testkit`。
- **独立 Maven 工程 1 个**：`tools/plugin-sdk`（不进主 reactor，单独 `./mvnw verify`）；**TS 包 4 个**；**条目总计 59**。
- **相对卷 27 §4.1（27 个 Java 模块 + 3 TS 包）净增 27 个 Java 模块**：扩展叶子 22（内核 8 + 平台 9 + 外壳 5，其中平台 2 个为 `platform-enterprise` 拆分口径）+ 三聚合器 + `harness-bom` + `harness-testkit`；另加独立工程 `plugin-sdk` 与 TS 包 `@open-coding/ide-vscode`（appendix-d L277 登记 23 个 = 22 扩展叶子 + `harness-testkit`，与本文件一致）。
- **§⑪ 已引用但卷 27 §4.1 从未定义的模块 = 21 个**：进入 `-pl` 选择器的扩展叶子 18（`kernel-{governance,cost,security,dist,qa,ops,frontier}` 7 + `platform-{intel,eco,security,dist,qa,ops}` 6 + `host-{enterprise,automation,intel,ui,frontier}` 5）+ 聚合器 `harness-kernel` 与 `harness-host` 2 + `harness-testkit` 1；另有 4 个仅在正文引用而未定义（`kernel-eco`、`platform-identity`、`platform-audit`、`platform-frontier`）与 1 个已撤销（`host-eco`），一并在 §1.3 收口。
- **§⑪ 选择器形态核对**：`-pl` 去重 49 条中，全路径选择器与 `harness-contract` 可直接沿用；需改写的有 12 处（`harness-kernel`/`harness-host` 聚合器写法 4 处、`harness-host/<module>` 占位符 2 处、缺 `-am` 6 处）与 3 处 v1/别名残留，逐条见 §7.2。

---

## §3 聚合与坐标

### 3.1 坐标规则（冻结）

| 项 | 规则 |
| --- | --- |
| groupId | 全模块 `com.hk.opencoding`（对齐根 `pom.xml` L7 与 `AGENTS.md`；`plugin-sdk` 同 groupId，artifactId 不带 `harness-` 前缀以示独立工程） |
| version | 全模块 `${opencoding.project.version}`（当前 `0.0.1`），由根 POM properties 定义；沿用根 POM 已就位的 `flatten-maven-plugin`，**禁止**子模块覆写版本 |
| artifactId | 叶子模块 = 目录名（`kernel-*` / `platform-*` / `host-*`）；层带聚合器 = `harness-kernel`/`harness-platform`/`harness-host`；BOM = `harness-bom`；测试基座 = `harness-testkit` |
| 版本递增 | 迁移期 v2 与 v1 同处 `0.0.1`（v1 尚未发布）；v2 首次对外发布时整体提到 `0.1.0`，此后按语义化版本：契约模块破坏性变更 = 主版本 +1，其余模块跟随 `harness-bom` 统一版本（禁止模块独立版本号） |
| 坐标引用 | 模块间依赖**不写版本**（由 `harness-bom` 的 dependencyManagement 提供）；`plugin-sdk` 对 `harness-contract` 的依赖**显式写版本区间**（SDK 代际兼容表，X-C24-2） |

### 3.2 BOM 与依赖管理

- `harness-bom`（新增，`packaging=pom`，parent = 根 POM）是 v2 的**唯一** BOM 与父 POM：① `dependencyManagement` 导入 `spring-boot-dependencies`（版本沿用根 POM `spring-boot.version`，当前 3.5.16）；② 声明全部 54 个 v2 模块坐标（`${opencoding.project.version}`）；③ 统一插件基线（`maven-compiler-plugin` 的 `release=21`、Surefire、Failsafe、Shade、Enforcer、ArchUnit）。
- 全部 `harness-*` 模块以 `harness-bom` 为 parent；层带聚合器 `harness-kernel`/`harness-platform`/`harness-host` 的 parent 也是 `harness-bom`，其 `<modules>` 列本带叶子。
- **导入点唯一**：`spring-boot-dependencies` 只 import 一次（在 `harness-bom`），禁止子模块再 import，避免双 BOM 版本漂移。

### 3.3 根聚合 POM

- 根 `pom.xml` 保持 `packaging=pom`、`artifactId=OpenCoding`，**迁移期同时聚合 v1 与 v2**（兑现卷 27 §4.8.1 S1「v1/v2 并存」）。`<modules>` 追加顺序（Maven 顺序不敏感，按此书写便于阅读）：

```text
open-coding-core        # v1 保留
open-coding-bootstrap   # v1 保留
open-coding-common      # v1 保留
open-coding-domain      # v1 保留
open-coding-infrastructure
open-coding-application
open-coding-interfaces
open-coding-plugin
harness-bom             # v2 起点（BOM/父 POM）
harness-contract
harness-kernel
harness-platform
harness-host
harness-testkit
```

- `tools/plugin-sdk` **不进**根聚合器（独立 reactor，自带 `mvnw`），保证 SDK 与内核解耦（R1–R4 不因命名放宽）。
- Java 21 配置：根 POM 追加 `maven.compiler.release=21`（现仅设 `source/target`），`harness-bom` 统一 `release`，杜绝用 JDK 21 编译出 17 目标类的错配。

### 3.4 打包与产物

| 产物 | 归属模块 / 工程 | 方式 |
| --- | --- | --- |
| CLI 可执行 `oc` | `host-cli` | `maven-shade-plugin` 打 fat-jar + `bin/oc` 启动脚本（jlink/GraalVM 原生镜像后置，非 v1.0 门禁） |
| 服务端可执行 jar | `host-server` | `spring-boot-maven-plugin` repackage（`executable=true`，根 POM 已配） |
| 桌面安装包 | `client/`（pnpm workspace） | `pnpm -C client run package:win\|mac\|linux` → electron-builder 输出 `client/dist/pack/<os>`，签名后交 `platform-dist` 更新器 |
| 插件包 | `tools/plugin-sdk` + `platform-plugin` | SDK 产出 `.ocplugin` 归档（清单 + 签名），`platform-plugin` 做装载期校验 |
| Java/TS 协议产物 | `host-protocol` → `client/packages/sdk` | `mvn -q -pl harness-host/host-protocol -am verify -Dsdk.skip=false`；生成物入库，CI 校验一致性 |

### 3.5 Enforcer 与架构守护

冻结为**双轨**（兑现 R10 G6）：`harness-bom` 配 `maven-enforcer-plugin`（依赖面：R1–R5，含 `bannedDependencies` 禁 v1 坐标与 Jackson 进内核、禁版本范围、禁循环）；`harness-testkit` 配 ArchUnit（包面：内核禁 `org.springframework.*`、平台禁 `host.*`、契约禁 `platform.*`）。Enforcer 在 `harness-bom` 的 `<build>` 生效，子树自动继承。

---

## §4 与 v1 模块的共存与迁移

### 4.1 映射表（v1 → v2）

| v1 模块（现状仓库实测） | v2 目标 | 策略 |
| --- | --- | --- |
| `open-coding-common`（枚举/工具） | `harness-contract` | 语义保留，重写为契约与枚举（去 Spring）；**最先退役** |
| `open-coding-core`（聚合器 + 父 POM） | 三个层带聚合器 | **废弃**：v2 以 `harness-kernel`/`harness-platform`/`harness-host` 替代，v1 聚合器随 S4 下线 |
| `open-coding-core/open-coding-core-api` | `harness-contract` + `kernel-*` | 契约保留、按域拆分；工具契约按卷 05 重写三通道 |
| `open-coding-core/open-coding-core-model` | `kernel-model` | 适配器实现保留（裁剪依赖），能力矩阵/装饰器链按卷 02 补齐 |
| `open-coding-core/open-coding-core-agent` | `kernel-agent` + `kernel-work` | 循环重写（Thread/Turn/Item 阶段化），保留重试与压缩思路 |
| `open-coding-core/open-coding-core-tool` | `kernel-tool` + `platform-sandbox` | 内置工具迁统一管线；命令执行移至沙箱/工作区层 |
| `open-coding-core/open-coding-core-implementation` | `host-bootstrap` | 由显式装配计划替代（D-ARC-9） |
| `open-coding-domain`（实体/Mapper/Flyway） | `platform-persistence` | 表族重构（附录 A.6），迁移脚本重排为批次 B1–B6；**实测当前无表无迁移脚本**，冲突面为零 |
| `open-coding-infrastructure` | `platform-runtime-store` + `platform-workspace` + `platform-persistence` | 按域拆分（缓存/文件/媒体/加密） |
| `open-coding-application` | `host-app` | 用例编排保留思路，接口对齐会话协议 |
| `open-coding-interfaces` | `host-protocol` + `host-server` | REST/WS 面按卷 01 分层（管理面/会话面） |
| `open-coding-bootstrap` | `host-bootstrap` + `host-server` | 装配计划 + 能力门控；启动入口一次性切换 |
| `open-coding-plugin` | `platform-plugin` + `tools/plugin-sdk` | 扩展点目录化（卷 18）；SDK 独立成工程 |
| `open-coding-client` | `client/packages/{app,ui,sdk}` | 重写为工作台信息架构（卷 22） |
| `docs/design/*`（v1 契约） | 对照保留 | 迁移期参考；S5 归档为历史 |

### 4.2 迁移期共存规则（强制）

1. **v1 零改动**：迁移期内 `open-coding-*` 的源码、POM、依赖与配置**一行不改**（除安全修复），继续可编译、可启动；v1 不继承 `harness-bom`、不装配 v2 Enforcer/ArchUnit。
2. **单向禁止**：v2 模块禁止依赖 v1 坐标（`com.hk.opencoding:open-coding-*`）与 v1 包前缀（`com.hk.opencoding.{core,domain,infrastructure,application,interfaces,bootstrap}`），由 Enforcer `bannedDependencies` 强制（R4 的勘误版，见 §1.3）。
3. **唯一只读桥**：迁移期唯一允许的 v1 数据读取路径是 `platform-persistence` 的 `legacy` 子包（`com.hk.opencoding.platform.persistence.legacy`，S1 只读适配），单事务、只读、无写回；v1 当前尚未落表（实测 `open-coding-domain` 仅含事件与 properties），该桥在 v1 落表后启用，接口先行。
4. **双写单通道**：S2 双写由 `platform-persistence` 内的 legacy 写入器在**同一事务**完成，禁止开启第二条写入通道或独立回写任务。
5. **入口唯一**：迁移期 `open-coding-bootstrap` 仍是唯一可执行入口；`host-server` 以独立端口与独立 profile 并存，禁止同端口双入口。
6. **表名空间**：v2 `oc_*` DDL 唯一权威在 `impl/19` §8；v1 若届时建表，采用前缀或 schema 隔离，迁移期以 v2 口径为准。

### 4.3 退役顺序（S4 执行，逐模块）

| 序 | v1 模块 | 前置（v2 侧已验收） | 理由 |
| --- | --- | --- | --- |
| 1 | `open-coding-core/open-coding-core-api` | `harness-contract` 编译 + Enforcer 生效 | 无外部依赖，契约先行回收 |
| 2 | `open-coding-common` | `harness-contract` 枚举/工具齐备 | 同上，且被 v1 其余模块引用，需先确认无引用 |
| 3 | `open-coding-plugin` | `platform-plugin` + `plugin-sdk` 门禁通过 | 独立域，先退最小面 |
| 4 | `open-coding-core/open-coding-core-model` | `kernel-model` 四协议契约测试通过 | 适配器替换完成即可退 |
| 5 | `open-coding-core/open-coding-core-tool` | `kernel-tool` + `platform-sandbox` 通过 | 内置工具与命令执行双落点 |
| 6 | `open-coding-core/open-coding-core-agent` | `kernel-agent` + `kernel-work` 主链路通过 | 循环重写替换 |
| 7 | `open-coding-core/open-coding-core-implementation` | `host-bootstrap` 装配计划接管 | 装配替代完成 |
| 8 | `open-coding-application` | `host-app` 用例通过 | 上层编排切换 |
| 9 | `open-coding-interfaces` | `host-protocol` + `host-server` 契约通过 | 协议面切换 |
| 10 | `open-coding-infrastructure` | `platform-*` 各适配器通过 | 多域拆分，退出面最大 |
| 11 | `open-coding-domain` | `platform-persistence` 表族 + 数据迁移完成 | 数据最后退，避免双写期断档 |
| 12 | `open-coding-bootstrap` | `host-server` 成为唯一入口且旧客户端版本门槛生效 | 入口一次性切换，最后退 |
| 13 | `open-coding-client`（目录） | `client/` 三包 + 桌面端发布 | 前端重写独立节奏 |
| 14 | `open-coding-core`（聚合器 POM） | 上述 1–7 全部完成 | 空壳聚合器，最后删 |

每步退役后必须执行：根 POM `<modules>` 移除该行 → 全量 `mvn clean install` → 依赖检查确认无引用 → 记录在案（卷 27 §4.8.1 S4/S5）。

---

## §5 构建顺序与并行度

### 5.1 拓扑序（层内可并行，层间串行）

```text
L0  harness-bom → harness-contract
L1  kernel-event / kernel-model / kernel-context / kernel-prompt / kernel-tool / kernel-permission
L2  kernel-agent（依赖 L1 的 event/model/context/tool/permission）、kernel-work（依赖 kernel-event）
L3  platform-runtime-store / platform-sandbox
L4  platform-persistence（依赖 runtime-store）、platform-workspace（依赖 sandbox）、platform-vcs、platform-plugin、platform-hooks、platform-mcp、platform-skill
L5  platform-knowledge / platform-memory（依赖 persistence）、platform-enterprise → platform-identity / platform-audit
L6  host-app、host-protocol（依赖 app）
L7  host-cli / host-server / host-a2a（依赖 protocol；host-cli 另依赖 app）
L8  host-bootstrap（依赖全部）
L9  harness-testkit（test 期）→ host-protocol 生成 SDK → client 构建 → 端到端
扩展作用域（随主序挂载）：kernel-{cost,governance,security,dist,eco,qa,ops,frontier} 随 L1–L2；
platform-{security,dist,eco,intel,qa,ops,frontier} 随 L4–L5；host-{enterprise,ui,automation,intel,frontier} 随 L7；
tools/plugin-sdk 随 L4（独立 reactor，仅依赖 harness-contract）
```

### 5.2 并行分工（六队，共享 L0 冻结契约后并行）

| 队 | 独占模块 | 可并行起点 |
| --- | --- | --- |
| A 内核核心 | `harness-contract`、`kernel-{model,context,prompt,tool,permission,event}` | L0 起（契约先冻结端口签名） |
| B 内核智能 | `kernel-agent`、`kernel-work` | L1 完成后（依赖 A 的产物） |
| C 平台数据 | `platform-{persistence,runtime-store,workspace,sandbox,vcs,plugin,hooks,mcp,skill}` | L1 起，与 A/B 并行 |
| D 平台智能 | `platform-{knowledge,memory,eco,intel,qa,ops,security,dist,frontier}` | L4 完成后 |
| E 外壳与端 | `host-{app,protocol,cli,server,a2a,bootstrap,ui,automation,enterprise,frontier}` + `client/*` | L6 起；协议类型生成与端开发并行（类型单一来源 = `host-protocol`） |
| F 质量工程 | `harness-testkit`、`kernel-qa`、`platform-qa`、`scripts/ci/*` | L0 起（假模型与门禁骨架先行，解锁零凭证主链路） |

### 5.3 Maven 选择器铁律（Maven 3.9.16 实测，2026-09-21）

| 形式 | 实测结果 | 结论 |
| --- | --- | --- |
| `-pl <聚合器> -am` | 仅构建聚合器＋其父/上游，**不含子模块** | **禁止**用于层带级测试（impl/01 L922 的写法错误，必须改） |
| `-pl <聚合器> -amd` | 构建聚合器＋全部子模块＋**下游**依赖它者 | 仅用于「本带及其下游」；`harness-platform -amd` 会连带 `harness-host`，禁用于 CI 层带门禁 |
| `-pl <模块全路径> -am` | 目标＋上游闭包（含兄弟模块，保证可离线编译） | **CI 与验收命令的唯一推荐形式** |
| `-pl <聚合器> -amd -am` | 全 reactor 连通集（等于全量构建，掩盖依赖违规） | 禁用 |
| 短名（`kernel-model`）、占位符（`harness-kernel/<module>`）、通配 | 解析失败或歧义 | 禁用；选择器必须是**目录路径**或 **`groupId:artifactId`** |

补充铁律：① 跨模块 `-Dtest` 过滤必须带 `-DfailIfNoTests=false`；② `-P` 与 profile 名之间不得有空格；③ `-pl` 列表以 `scripts/ci/selectors/*.txt` 为唯一载体（由本文件 §2 派生，新增/删除模块必须同步）。

### 5.4 CI 命令（精确形式，卷 27 §4.6 六门映射）

```bash
# 选择器清单（与 §2 同源，逗号分隔，无空格）
# scripts/ci/selectors/kernel.txt   = harness-contract,harness-kernel/kernel-*（16 项全路径）
# scripts/ci/selectors/platform.txt = harness-platform/platform-*（21 项全路径）
# scripts/ci/selectors/host.txt     = harness-host/host-*（6 项全路径）

# 门 1｜单元测试 + 覆盖率（内核全带，替代 impl/01 L922 的错误写法）
mvn -q -pl "$(cat scripts/ci/selectors/kernel.txt)" -am test

# 门 2｜单域迭代（本地与 PR 最常用，形态固定）
mvn -pl harness-kernel/kernel-agent -am test
mvn -pl harness-platform/platform-persistence -am test

# 门 3｜契约测试（协议/事件 Schema/SPI/适配）
mvn -pl harness-contract,harness-host/host-protocol -am test -Dgroups=contract

# 门 4｜集成测试（PG/Redis 容器 + 沙箱）+ 故障注入
mvn -pl harness-platform/platform-persistence -am verify -Dgroups=fault-injection

# 门 5｜装配回归 + 测试基座（main 链路）
mvn -pl harness-host/host-bootstrap -am test
mvn -pl harness-testkit -am test

# 门 6｜离线评测与门禁（单入口脚本，冻结为 gate.mjs）
mvn -pl harness-kernel/kernel-qa,harness-platform/platform-qa -am test
./scripts/ci/gate.mjs --profile fast

# 生成物一致性（SDK 与 Schema）
mvn -q -pl harness-host/host-protocol -am verify -Dsdk.skip=false
pnpm -C client --filter @open-coding/sdk generate --check

# 前端（独立 pnpm 工程）
pnpm -C client install && pnpm -C client --filter @open-coding/app test
```

---

## §6 包名与命名约定

### 6.1 Java 包名（与 `AGENTS.md` 的 `com.hk.opencoding` 前缀一致）

| 模块 | 包根 | 子包约定 |
| --- | --- | --- |
| `harness-contract` | `com.hk.opencoding.contract` | 按域：`contract.<域>`（`session`/`event`/`error`/`model`/`tool`/`permission`/`work`/`team`/`plugin`/`mcp`/`skill`/`hook`/`memory`/`knowledge`/`vcs`/`workspace`/`sandbox`/`codec`/`ent`/`cost`/`security`/`dist`/`eco`/`intel`/`qa`/`ops`/`frontier`/`ux`）；**无子模块** |
| 内核段 | `com.hk.opencoding.kernel` | 每模块一段：`kernel.model`/`kernel.context`/`kernel.prompt`/`kernel.tool`/`kernel.permission`/`kernel.agent`（含 `kernel.agent.session`、`kernel.agent.team`）/`kernel.work`（含 `kernel.work.automation`）/`kernel.event`/`kernel.governance`/`kernel.cost`/`kernel.security`/`kernel.dist`/`kernel.eco`/`kernel.qa`/`kernel.ops`/`kernel.frontier` |
| 平台段 | `com.hk.opencoding.platform` | `platform.persistence`（+`.recovery`、`.legacy`）/`platform.runtime.store`/`platform.workspace`（+`.exec`）/`platform.sandbox`/`platform.vcs`/`platform.knowledge`/`platform.memory`/`platform.enterprise`/`platform.identity`/`platform.audit`/`platform.plugin`（+`.pure`、`.config`）/`platform.mcp`/`platform.skill`/`platform.hooks`/`platform.security`/`platform.dist`/`platform.eco`/`platform.intel`/`platform.qa`/`platform.ops`/`platform.frontier` |
| 外壳段 | `com.hk.opencoding.host` | `host.app`（+`.team`、`.work`）/`host.protocol`/`host.cli`/`host.server`/`host.a2a`/`host.bootstrap`/`host.enterprise`/`host.ui`/`host.automation`/`host.intel`/`host.frontier` |
| 工程段 | `com.hk.opencoding.testkit`、`com.hk.opencoding.pluginsdk` | 契约模块的子包名不得使用 `core` 前缀（v1 包为 `com.hk.opencoding.core.*`，属禁止前缀） |

### 6.2 TS 包名与工程

- 包管理器统一 **pnpm workspace**（`client/`），禁止 `npm --prefix`；包名统一 `@open-coding/<name>`，与目录 `client/packages/<name>` 一一对应：`app`、`ui`、`sdk`、`ide-vscode`。
- 类型单一来源：后端契约（`harness-contract`）→ `host-protocol` 生成 → `client/packages/sdk`；本地 IPC 清单生成到 `app/src/shared/ipc/`。生成目录禁手改；**不得**再出现第四个包（`@open-coding/shared` 已废弃）。
- 端侧命令统一 `pnpm -C client ...`；`tools/plugin-sdk` 使用自带 `./mvnw`，不与主 reactor 共享 `mvn` 调用。

### 6.3 冻结规则

1. 本文件被接受后，§2 的 `artifactId`、目录、段归属、包根**冻结**；新增模块必须先在本文件登记（含依赖与包根），再建目录与 POM。
2. 模块重命名 = 契约破坏：需在本文件 §7 追加修订条目 + 全量回改受影响 impl（§7.2 模式）+ 在 `IMPL-DECISIONS.md` §4 登记 X 条目。
3. 依赖方向变更（新增跨带依赖）需 ArchUnit 规则同步更新并在 CI 生效，否则视为违规。
4. 命名口径统一为 `harness-<层带>/<层前缀>-<域>`；层前缀固定为 `kernel` / `platform` / `host`，禁止新前缀。

---

## §7 修订建议（X-revision）

> 口径：本文件不改卷册；以下为「文件 → 精确动作」派单清单，由编排方回改。执行后本文件升为「已生效」。

### 7.1 卷 27 §4.1–§4.5 改法

| 位置 | 精确动作 |
| --- | --- |
| §4.1（L92–138） | 目录树后追加：① **坐标规则**小节（groupId/version/artifactId 三行）；② 聚合 POM 三行（`harness-kernel/pom.xml`、`harness-platform/pom.xml`、`harness-host/pom.xml`，`packaging=pom`）；③ 新增 `harness-bom/`、`harness-testkit/`、`tools/plugin-sdk/`、`client/packages/ide-vscode/` 四个条目；④ **扩展模块登记表**（23 项，直接指向本文件 §2）；⑤ **迁移期 v1 并存注**（根 POM `<modules>` 同时列 `open-coding-*` 与 `harness-*`，v1 不改一行，见本文件 §4.2） |
| §4.1 入口 | 新增一行指针：「模块清单权威版本见 `impl/00-contracts/MODULE-MANIFEST.md`」 |
| §4.2（L158–166 与 L373） | R1 补 JSON 口径注脚：内核内 JSON 编解码走 `ProtocolCodec` 端口注入（实现留平台段），或显式放行 `jackson-core` 进 `kernel-model`（二选一必须在首个 PR 前定）；R4 勘误为「不得依赖 v1 包前缀 `com.hk.opencoding.{core,domain,infrastructure,application,interfaces,bootstrap}`」；L373 冻结为「Enforcer（依赖面）+ ArchUnit（包面）双轨」 |
| §4.3（L168–198） | 补缺失三行（R07 已登记）：卷 29 → `platform-eco`/`kernel-eco`、卷 30 → `platform-security`/`kernel-security`、卷 31 → `kernel-cost`（+`platform-persistence` 表族）；把「26 质量」行的 `tools/eval` 改为 `platform-qa` |
| §4.4（L199–211） | 每批次补「表清单 + owner 文件」列（权威在 `impl/19` §8），与本文件 §2 的模块列对齐 |
| §4.5（L212–236） | 每步补「涉及模块」列（取值 = 本文件 §5.1 拓扑序）与「可跑通形态（测试驱动/CLI）」列；新增 §4.5.1「首 PR 模块集」= `harness-bom`、`harness-contract`、`harness-kernel`、`kernel-event`（+根 POM 追加 modules） |
| §4.6/§4.7（L237–266） | 门禁单入口名冻结为 `./scripts/ci/gate.mjs`（L73/L253/L347 的 `*.sh`/`all.sh` 全量替换）；假模型口径按本文件 §1.3 收敛（`kernel-qa` 同进程为主、`tools/fake-llm` 后置）；`tools/seed` → `oc qa seed`；`tools/eval` → `platform-qa` |
| §4.8.1（L288–311） | S1/S2 增注：只读桥落 `platform-persistence` 的 `legacy` 子包（单事务、只读、S5 删除）；S4 退役顺序引用本文件 §4.3 |

### 7.2 impl 文件 §⑪ 命令改动（逐文件）

| 文件 | 精确动作 |
| --- | --- |
| `impl/01` L922 | `mvn -pl harness-kernel -am test` → `mvn -q -pl "$(cat scripts/ci/selectors/kernel.txt)" -am test`（聚合器 `-am` 不含子模块，实测见 §5.3） |
| `impl/01` L926/L929/L932 | `-pl harness-host` → `-pl harness-host/host-bootstrap`（或 `selectors/host.txt` 列表）；L929 的 `-Dgroups=contract` 保留 |
| `impl/24` L1091/L1092 | `-pl harness-host/host-a2a test` 补 `-am`（保持与其他文件一致） |
| `impl/25` L1049/L1051/L1054 | `-pl harness-host/host-enterprise test` 补 `-am` |
| `impl/26` L1051 | `-pl harness-platform/platform-persistence test` 补 `-am` |
| `impl/29` L1046 | `-pl harness-platform/platform-eco test` 补 `-am` |
| `impl/31` L989 | `-pl harness-kernel/kernel-work test` 补 `-am` |
| `impl/34` L1012 | `-pl harness-platform/platform-ops test` 补 `-am` |
| `impl/30` L42/L1080、`impl/31` L79/L1016、`impl/32` L8/L1047 | 删除「降级备选（落 host-app + host-protocol 命名空间）」分支，冻结为 `host-ui`/`host-automation`/`host-intel` 正式模块（本文件 §2.4） |
| `impl/29` L35/L924 | `harness-host/host-eco` → `harness-host/host-protocol`（`eco.*` 命名空间）+ `harness-host/host-bootstrap` 装配 |
| `impl/29` L1054–1055 | `npm --prefix integrations/ide-vscode run test` → `pnpm -C client --filter @open-coding/ide-vscode test`；`npm --prefix sdk/examples run verify` → `pnpm -C client --filter @open-coding/sdk run verify:examples` |
| `impl/33` L849/L853 | 登记状态注记改为「已登记（`harness-testkit`，见 MODULE-MANIFEST §2.5）」；`oc qa replay` 前追加 `mvn -pl harness-host/host-cli -am install`（CLI 未安装时命令不可用） |
| `impl/35` L1003 | 删除「扩展模块，待登记」后缀（`kernel-frontier` 已登记） |
| `impl/18` L55/L58 | 「命名待卷册确认」→ 冻结为 `tools/plugin-sdk` 独立工程 |
| `impl/13` L70、`impl/02` L38/L189、`impl/03`/`impl/04` 图标签 | 删除 `harness-core` 别名引用（保留域带术语时须写明「非 reactor 路径」） |

### 7.3 其他文件

| 文件 | 精确动作 |
| --- | --- |
| `appendix-d-component-inventory.md` L277 | 「23 个未登记扩展模块」→「23 个已登记扩展模块（权威清单见 `impl/00-contracts/MODULE-MANIFEST.md` §2）」，计数口径指向本文件 |
| `impl/IMPL-DECISIONS.md` X-88、`impl/components/C24-plugin-loader.md` X-C24-2 | 状态「待终局审计」→「已裁决：`tools/plugin-sdk` 独立工程」 |
| `reviews/R07-scope-build-kernel.md` §2.2、`reviews/R07-scope-build-platform.md` §2.2 | 追加一行「已由 MODULE-MANIFEST 收口，计数以该文件 §2.7 为准」 |
| `docs/harness/README.md` §2 索引 | 增加 `impl/00-contracts/MODULE-MANIFEST.md` 行（impl 层 00 号契约） |
| `scripts/ci/selectors/{kernel,platform,host}.txt` | 新建三个选择器清单文件（内容按本文件 §2 派生），CI 与验收命令统一引用 |

### 7.4 生效与冻结

本文件随 §7.1–§7.3 首批动作执行后转为**已生效**；此后 ① 任何模块新增/改名/删除必须先改本文件；② impl 与卷册出现与本文件不一致的模块名时，按本文件 §1.4 裁决顺位处理并回改；③ 本文件行数与条目计数（§2.7）在每次修订后重算。
