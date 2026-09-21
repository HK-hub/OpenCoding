# Phase B 总规划：竞品源码级研究 + 逐系统实现技术方案

> 本文件是 Phase B（目标第二段）的**唯一施工图**：定义研究范围、竞品清单、研究维度、交付物命名与写作模板、批次分工与验收标准。
>
> 输入契约：`docs/harness/`（Phase A 目标态设计全集，45 顶层文件 / 36 卷 / 420 决策登记口径，见 `DECISIONS.md` §3）为**上游设计**；`docs/design/`（v1 冻结契约）为需求意图来源。Phase B 不推翻 Phase A 的任何选定分支；发现 Phase A 与竞品事实冲突时，**先在本目录记录「反驳证据 + 建议修订」**，由 `IMPL-DECISIONS.md` 汇总，不直接改动 Phase A 卷册（TODO 统一回改）。
>
> 产出层定位：Phase A = **做什么（what/why）**；Phase B = **怎么做（how）**——逐系统实现技术方案 + 竞品源码级事实依据。

---

## 1. 交付物总览

### 1.1 竞品研究（`docs/harness/research/competitors/`）

| # | 文件 | 对象 | 源码可及性 |
| --- | --- | --- | --- |
| 01 | `01-claude-code-purpose-built.md` | Claude Code（官方，闭源） + `Gitlawb/openclaude`（开源复刻参考） | 官方文档/公开逆向资料 + 开源复刻源码 |
| 02 | `02-opencode.md` | `sst/opencode`（TypeScript，TUI + Server） | 完全开源 |
| 03 | `03-codex.md` | `openai/codex`（Rust，CLI + 云） | 完全开源 |
| 04 | `04-deepseek-harness.md` | DeepSeek 官方 Harness / 相关开源实现 | 需检索确认仓库（写入文档时标注证据等级） |
| 05 | `05-minimax-cli.md` | MiniMax CLI（近期开源） | 需检索确认仓库 |
| 06 | `06-grok-cli-and-build.md` | Grok CLI / gork build 类工具（xAI 生态） | 需检索确认 |
| 07 | `07-qoder.md` | Qoder（阿里，IDE + CLI） | 公开资料为主 |
| 08 | `08-gemini-cli.md` | `google-gemini/gemini-cli`（TypeScript，开源） | 完全开源 |
| 09 | `09-secondary-tier.md` | Aider / Cline / Roo Code / Continue / Goose / SWE-agent 等 | 完全开源 |
| 10 | `CROSS-COMPARISON.md` | 24 系统 × N 竞品的横向矩阵 | 汇总 |
| 11 | `LESSONS-AND-ADOPTIONS.md` | 采纳/拒绝清单 → 映射到 Phase A 决策与 Phase B 实现方案 | 汇总 |

### 1.2 逐系统实现技术方案（`docs/harness/impl/`）

| # | 文件 | 对应 Phase A 卷 | 实现主体 |
| --- | --- | --- | --- |
| 01 | `01-kernel-runtime-impl.md` | 01 | 内核/外壳分层、会话运行时、并发、恢复、启动档 |
| 02 | `02-model-gateway-impl.md` | 02 | Provider 抽象、四协议适配器、装饰器链、路由计量 |
| 03 | `03-context-engine-impl.md` | 03 | 九区段组装、四级压缩、引用外置、缓存亲和 |
| 04 | `04-prompt-manager-impl.md` | 04 | 资产模型、组装流水线、版本灰度 |
| 05 | `05-tool-system-impl.md` | 05 | 三通道契约、执行管线、调度、内置工具族 |
| 06 | `06-permission-system-impl.md` | 06 | 风险分级、决策链、审批编排、策略 DSL |
| 07 | `07-sandbox-executor-impl.md` | 07 | 五档隔离、跨平台执行、网络/密钥代理 |
| 08 | `08-skill-system-impl.md` | 08 | 技能包、发现激活、能力声明、市场 |
| 09 | `09-mcp-gateway-impl.md` | 09 | 四传输客户端、能力映射、Server 暴露 |
| 10 | `10-memory-system-impl.md` | 10 | 四层记忆、候选写入、混合召回 |
| 11 | `11-knowledge-system-impl.md` | 11 | 连接器、切分、三路检索、知识页 |
| 12 | `12-agent-runtime-impl.md` | 12 | 主循环、Thread/Turn/Item、SubAgent、扇出 |
| 13 | `13-agent-teams-impl.md` | 13 | 编制、拓扑、黑板、仲裁、预算熔断 |
| 14 | `14-task-plan-engine-impl.md` | 14 | WorkItem 状态机、DAG、规格驱动、证据验收 |
| 15 | `15-goal-scheduler-impl.md` | 15 | Goal 自治循环、达成判定、触发器与熔断 |
| 16 | `16-event-bus-impl.md` | 16 | 事件信封、双通道、分区有序、回放 |
| 17 | `17-hook-engine-impl.md` | 17 | 钩子点、匹配、阻断改写、沙箱执行 |
| 18 | `18-plugin-runtime-impl.md` | 18 | 扩展点装载、隔离、依赖求解、SDK |
| 19 | `19-persistence-recovery-impl.md` | 19 | 数据分域、迁移流水线、崩溃恢复、导出包 |
| 20 | `20-workspace-provider-impl.md` | 20 | 本地/SSH/容器/云工作区、连接池、快照 |
| 21 | `21-git-worktree-impl.md` | 21 | 隔离、提交、合并队列、护栏 |
| 22 | `22-cli-tui-impl.md` | 22 | CLI 命令面、TUI 渲染、键盘流、无头模式 |
| 23 | `23-desktop-electron-vue-impl.md` | 22 | Electron 主进程、Vue 前端、IPC、状态模型 |
| 24 | `24-a2a-gateway-impl.md` | 23 | 服务面端点、任务映射、RemoteAgent、认证 |
| 25 | `25-enterprise-iam-audit-impl.md` | 24 | 租户、SSO/SCIM、角色、审计、DLP |
| 26 | `26-quota-cost-impl.md` | 31 | 配额、计量、成本归因、预算熔断 |
| 27 | `27-security-runtime-impl.md` | 30 | 密钥生命周期、供应链、威胁对策落地 |
| 28 | `28-distribution-telemetry-impl.md` | 28 | 更新器、通道、遥测同意、许可 |
| 29 | `29-developer-ecosystem-impl.md` | 29 | SDK 生成、IDE/CI 集成、Registry、导入迁移 |
| 30 | `30-interaction-ux-impl.md` | 22/33 | 组件树、界面状态机、关键交互逐帧 |
| 31 | `31-automation-library-impl.md` | 34（新建） | 自动化模板库（依赖升级/巡检/发布说明…） |
| 32 | `32-intelligent-augmentation-impl.md` | 35（新建） | 智能增强包（PR 描述/审查机器人/测试生成…） |
| 33 | `33-quality-eval-impl.md` | 26 | 假模型、故障注入、基准运行器、CI 门禁 |
| 34 | `34-operations-runtime-impl.md` | 32 | 健康检查、SLO、演练自动化、容量水位 |
| 35 | `35-frontier-prototypes-impl.md` | 25 | 多模态/计算机使用/自进化等原型级方案 |
| — | `IMPL-DECISIONS.md` | — | 实现级决策台账（`I-<域>-<n>`）+ Phase A 修订建议 |
| — | `impl/README.md` | — | 实现方案总索引与阅读顺序 |

---

## 2. 研究方法（竞品研究，强制）

**证据分级**（每份研究文档必须为每条结论标注等级）：

| 等级 | 含义 | 标注 |
| --- | --- | --- |
| E1 | 直接读到源码（给出仓库、文件路径、类/函数名，尽量给行号或提交号） | `[E1]` |
| E2 | 官方文档 / 官方博客 / 官方 schema 文件 | `[E2]` |
| E3 | 第三方分析、逆向资料、媒体报道、社区讨论 | `[E3]` |
| E4 | 推断（明确写出推理链，禁止伪装为事实） | `[E4]` |

**研究手段优先级**：① `WebFetch` 抓取 `raw.githubusercontent.com` 源码文件（首选，无鉴权）→ ② `WebSearch` 定位仓库/文档/发布说明 → ③ `WebFetch` 官方文档站 → ④ 必要时 `git clone --depth 1` 到 `.research-cache/<owner>-<repo>/`（该目录已在 `.gitignore`，用完可留作证据）。

**R02 复核规程（Round 2 起强制）**：对已产出报告与 `CROSS-COMPARISON.md` 的「未观测」格，每轮复核必须执行：

1. **优先本地复验**：`.research-cache/<repo>/` 存在时，一律以 `git grep -n`（或 `grep -r`，命中损坏索引的仓库用后者）做**全仓机械核对**，并把**检索词原文**回填到格内（格式：`R02 核验：<命令或检索词>`）。
2. **格内必须可复核**：任何保留「未观测」字样的格，必须携带「检索词或机械核对说明」；无口径的「未观测」视为缺陷（R02 起 0 容忍）。
3. **改判留痕**：新证据推翻原口径时，格内写「原「未观测」口径修正」并给出文件路径（尽量 **路径:行号**），同时在 `CROSS-COMPARISON.md §8.4` 登记一行（编号 C-<n>）。
4. **引文纠错**：核验发现路径/行号错误时，直接修正引文并标注「R02 路径/行号修正」（机制成立时等级不变）。
5. **闭源列**：Claude Code 官方侧与 Qoder 无本地克隆时，用 `WebSearch` 检索官方支持站/文档站；第三方桥接指南与媒体报道**不计**为官方证据。

**统一研究维度（24 项，逐项必答；无证据写「未观测到 + 检索词」）**：
1) 进程与运行拓扑（单进程/常驻/客户端-服务端拆分、IPC 协议）；2) Agent 主循环与回合模型；3) 工具系统（注册、schema、执行、并行、结果回传）；4) 权限与审批（模式、粒度、持久化规则）；5) 上下文管理（窗口预算、压缩触发点与算法、缓存策略）；6) 提示词组织（系统提示装配、分层指令文件、注入顺序）；7) MCP（传输、能力、配置面、OAuth）；8) Skill/插件机制；9) SubAgent/多 Agent 编排；10) 任务/计划/Todo 机制；11) Goal/自治循环/Schedule；12) 会话持久化与恢复（存储格式、resume/fork/compact）；13) 事件与可观测（流式协议、事件类型清单）；14) Hooks/生命周期扩展点；15) 沙箱与安全执行（隔离技术、网络策略、审批绕过防护）；16) 工作区/远程执行（SSH/容器/云）；17) Git 与 worktree 集成；18) 记忆/知识库；19) A2A/被集成能力（作为库、SDK、headless、MCP server、协议）；20) 客户端形态（TUI/桌面/IDE/Web）与交互细节；21) 配置面与层级；22) 更新/分发/遥测/许可；23) 企业能力（多用户、审计、配额、私有化）；24) 显著工程细节（性能、并发、失败处理、测试策略）。

**每份竞品研究文档固定骨架**：① 结论速览（10 条以内，逐条带证据等级）② 产品与仓库事实（版本、语言、许可、活跃度、官方入口）③ 架构总览（架构图 + 进程拓扑）④ 24 维度逐项分析（含源码证据）⑤ 核心流程源码走读（≥3 个：主循环 / 工具调用 / 权限或持久化）⑥ 工程亮点与可借鉴点 ⑦ 局限与不可照搬点 ⑧ 对我们（OpenCoding）的 8–15 条启示（映射到 Phase A 卷号）⑨ 参考来源清单（URL 全列）⑩ 检索词与未决问题。

---

## 3. 实现方案写作模板（强制，11 节 + 图）

每份 `NN-xxx-impl.md` 必须包含以下小节，顺序固定：

1. **实现目标与范围**：对应 Phase A 卷号与决策号；本组件解决什么；不解决什么；上游/下游依赖。
2. **功能需求清单（REQ-<域>-n）**：逐条写「需求描述 + 来源（Phase A 章节/竞品证据）+ 优先级 P0/P1/P2 + 验收要点」，**含竞品研究带来的增量需求**（引用 `research/` 文件与证据等级）。
3. **技术方案选型（M×N 比选）**：本组件实现的**关键技术分叉**（≥3 个维度，每维度 ≥2 分支）→ 评分矩阵（权重沿用 README §4：F30/U20/S25/M25）→ 选定分支 + 被放弃分支的代价 → 登记为 `I-<域>-<n>`。
4. **总体架构图**：Mermaid `flowchart`（模块/类族/依赖方向），标注 内核 or 外壳、Spring 装配点。
5. **类图**：Mermaid `classDiagram`，含关键接口/实现/枚举/record；给出**Java 21 签名**（接口方法、构造、重要泛型）。
6. **核心流程时序图（≥3 个流程）**：Mermaid `sequenceDiagram`，每个流程配「前置条件 / 主路径 / 异常与补偿分支 / 幂等与并发点」说明。
7. **状态机**：Mermaid `stateDiagram-v2`（若有状态实体：会话、任务、审批、插件、连接等）。
8. **数据模型**：表（`oc_*`，字段/索引/约束/分区）、Redis Key（经统一 Key 工厂）、对象存储前缀、事件类型清单。
9. **接口与扩展点**：REST/WS 端点（方法+路径+入参出参+错误码）、SPI 扩展点（对接卷 18 目录）、配置项（`open-coding.*` + 环境变量 + 默认值 + 必填性）。
10. **非功能与工程细节**：并发模型（虚拟线程/线程池/背压）、性能预算（给出数字）、容量估算、缓存策略、失败与降级、安全（权限/脱敏/越权）、可观测（指标名 + 日志打点 + 追踪 span）。
11. **测试与验收（DoD）**：单测/集成/契约/回放用例清单、故障注入场景、性能门禁、可执行的验收命令（`mvn -pl ... test` 等）。

**写作硬约束**：
- 全部中文正文；专有名词保留英文；禁止 TODO/占位符；每个技术分叉必须有结论。
- 图必须是**合法 Mermaid**（`flowchart`/`classDiagram`/`sequenceDiagram`/`stateDiagram-v2` 一类；禁止用未在 `docs/design/diagrams/` 验证过的实验语法；节点文本含 `()`、`[]`、`:` 时用引号包裹）。
- 每条关键设计必须能指回 Phase A 卷/决策号，或标注为 Phase B 新增并登记 `I-` 决策号。
- 涉及 Java 代码形态的，必须符合 `.qoder/rules/` 五条规范（注释、配置抽取、常量抽取、异常处理、日志）：接口签名与示例代码不得出现魔法值、裸 `RuntimeException`、`e.getMessage()` 日志等反例。
- 单文件目标体量：**500–900 行**；宁可分节详实，不可空泛。

---

## 4. 批次分工与并发规程

| 批次 | 内容 | 并发度 | 依赖 |
| --- | --- | --- | --- |
| B0 | 本规划 + 目录骨架 | 1 | 无 |
| B1 | 竞品研究 9 份（01–09） | 6 agent 并行 | 读本文件 §2 |
| B2 | `CROSS-COMPARISON.md` + `LESSONS-AND-ADOPTIONS.md` | 2 agent 并行 | B1 完成 |
| B3 | 实现方案 01–12 | 6 agent 并行（每人 2 份） | 读本文件 §3 + 对应卷 + 相关竞品报告 |
| B4 | 实现方案 13–24 | 6 agent 并行（每人 2 份） | 同上 |
| B5 | 实现方案 25–35 + 卷 34/35 新建 + 附录 D | 6 agent 并行 | 同上 |
| B6 | 十轮以上自审查（多视角并行）+ 逐轮修复 | 4–6 agent/轮 | B3–B5 完成 |
| B7 | 终局审计 + 索引同步（README/AUDIT/ITERATIONS/DECISIONS） | 1–2 agent | B6 完成 |

**并发写文件互斥规则**：agent 只允许写自己负责的文件；聚合类文件（`IMPL-DECISIONS.md`、`README.md`、`AUDIT.md`、`ITERATIONS.md`）由主控 agent 统一维护，避免并行冲突。每份文档完成后自报「文件路径 + 行数 + 图数量 + 未决问题数」。

---

## 5. 验收标准（Phase B DoD）

| # | 验收项 | 判据 |
| --- | --- | --- |
| 1 | 竞品覆盖 | ≥9 份竞品研究报告，全部含 24 维度逐项回答与证据分级；至少 3 家达到 E1（源码级）证据密度 |
| 2 | 实现方案覆盖 | 35 份实现方案，覆盖全部 36 卷（00–35，含卷 34/35）+ 附录 D |
| 3 | 图表密度 | 每份实现方案 ≥5 张 Mermaid 图（架构/类/时序≥3/状态机）；全量图通过 `mermaid@11` 本地 `parse()` 校验 |
| 4 | 决策可追溯 | 每份实现方案含 ≥3 个 `I-` 决策并汇总进 `IMPL-DECISIONS.md`；与 Phase A 决策无冲突（冲突须登记修订建议） |
| 5 | 增量需求 | 每份实现方案 REQ 清单中 ≥2 条来自竞品研究证据的增量需求 |
| 6 | 自审查 | ≥10 轮多视角审查记录于 `ITERATIONS.md`（Phase B 段），每轮有文件级变更证据 |
| 7 | 终局审计 | `AUDIT.md` 追加 Phase B 段：目标→交付物逐条映射 + 命令级校验结果 |
