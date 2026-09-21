# R07 · 可落地性与实施顺序（范围：`impl/19–35` 十七份 + 卷 34/35 + 附录 D）

> 执行轮次：Phase B 自审查 · 第 7 轮（lens = **可落地性与实施顺序**：模块落点 / 端形态落点 / 20 步依赖序 / 迁移批次 / CI 门禁可执行性）。
> 审查范围：`impl/19-persistence-recovery-impl.md` … `impl/35-frontier-prototypes-impl.md`（17 份）+ `34-automation-templates.md`、`35-intelligent-augmentation.md`、`appendix-d-component-inventory.md`（3 份）。
> 基准契约：`27-technical-path.md` §4.1（仓库结构）/ §4.2（R1–R5）/ §4.3（设计→代码映射）/ §4.4（迁移批次 B1–B6）/ §4.5（20 步序列）/ §4.6（CI 门禁）；`01-harness-architecture.md` §4.5。
> 修改约束：只增不删；中文；决策编号零改动；Mermaid 未新增；**卷 27 不在修改范围** → 需要改卷 27 的项一律记为「修订建议」（§7）。行号为 R07 取证时点实测（编辑后会漂移，均以引用文本为准）。
> 结论摘要：**9 处模块/端形态缺陷（M1–M9）全部就地修正**（含 v1 遗留名 8 处：`open-coding-bootstrap` ×2、`open-coding-client` ×5、`open-coding-integrations` ×1；契约子模块双轨 3 处；前端第四包 4 处；IDE/示例目录无落点 1 处）；**23 个未登记扩展模块**登记在案（§2.2）；**17 份文件全部补齐「模块 / 顺序 / 批次」落地登记**；发现 **不可行前置 2 处、循环 2 处、同批互斥 1 处**（§3）；**120 张 `oc_*` 表未映射到 B1–B6** → 提出 5 个新批次（§4）；**CI 命令缺陷 8 处全部修正**（§5）；**169 条 `I-` 决策无一与实现类绑定**（§6）。

## 1. 方法与取证（可复核）

| 步骤 | 手段 | 输出 |
| --- | --- | --- |
| 模块落点清点 | 对 17 份逐份检索 `harness-*` / `open-coding-*` / `mvn -pl` 模块坐标 | §2.1 修正项 + §2.2 扩展清单 |
| 卷 27 §4.1 对照 | 逐名比对 `harness-contract/kernel-*/platform-*/host-*` 与 `client/{app,ui,sdk}` | 命中：契约子模块双轨、platform-enterprise 拆分、根级 testkit |
| 端形态对照 | 22/23/30 检索 `client/`、`packages/*`、`pnpm`/`npm --prefix`、生成命令 | §2.3（三包口径 + 类型单一来源） |
| 顺序对齐 | 17 份逐份检索「卷 27 §4.5 / 第 N 步 / 实施顺序」 | 原**零命中** → 逐份补 `落地登记`，见 §3 |
| 批次对齐 | 逐份提取 §⑧.1 表名（`oc_*`）与 §4.4 B1–B6 比对 | §4（映射 + 未映射 + 双声明） |
| CI 可执行性 | 逐份提取 §⑪ 命令（`mvn -pl` / `pnpm` / `scripts/ci`）| §5（8 处修正） |
| I- 落点抽查 | 逐份统计 `^\| I-` 行数与「模块/类」命中 | §6（169 条 / 模块 0 条 / 类 1 条） |

## 2. 模块映射表（卷 27 §4.1 / §4.3 口径）

### 2.1 修正项（原状 → 修正后；全部已就地修复）

| # | 位置 | 原状（问题） | 修正后 |
| --- | --- | --- | --- |
| M1 | `impl/32` 头 + §⑤.2 图 + §⑪.1 | `harness-contract/harness-contract-intel`（双轨：卷 27 §4.1 的 `harness-contract` 是**单模块**） | `harness-contract`（包 `contract/intel`）；CI 改 `mvn -pl harness-contract,harness-platform/platform-intel -am compile` |
| M2 | `impl/33` 头 + §④ 图 | `harness-contract/contract-qa`（同上） | `harness-contract`（包 `contract/qa`） |
| M3 | `impl/34` 头 + §④ 图 | `harness-contract/contract-ops`（同上） | `harness-contract`（包 `contract/ops`） |
| M4 | `impl/24:1095`、`impl/35:1001` | `mvn -pl open-coding-bootstrap -am test`（v1 模块名） | `mvn -pl harness-host/host-bootstrap -am test` |
| M5 | `impl/35:996` | `mvn -pl harness-core -am test`（**模块不存在**） | `mvn -pl harness-kernel/kernel-frontier -am test` |
| M6 | `impl/29:18` | `open-coding-integrations 模块`（v1 名） | `harness-platform/platform-eco` + `harness-kernel/kernel-eco`（v1 名标注废弃） |
| M7 | `impl/22:1141`、`impl/30` §⑪.2 | `npm --prefix open-coding-client …`（v1 前端目录名 + 包管理器与 23 不一致） | `pnpm -C client …`（`client/` 为卷 27 §4.1 pnpm workspace） |
| M8 | `impl/23:344/429/1033`、`impl/33:869` | `client/packages/shared` / `@open-coding/shared`（**第四包**，与 D-PATH-5 三包冲突） | 协议类型 → `@open-coding/sdk`；IPC 清单生成到 `app/src/shared/ipc/`（应用内部） |
| M9 | `impl/29` §⑪.2 | `integrations/ide-vscode` / `sdk/examples` 目录未在卷 27 §4.1 列（IDE 插件与示例库无落点） | 标注为**扩展落点待登记**，并给出并入 `client/` workspace 的备选命令（复用 `packages/sdk`） |

### 2.2 扩展模块登记（卷 27 §4.1 未列，命名遵循 `harness-<层>/<层前缀>-<域>`；**待卷 27 登记**）

| 层 | 扩展模块 | 归属文件 |
| --- | --- | --- |
| kernel | `kernel-cost` / `kernel-governance` / `kernel-security` / `kernel-dist` / `kernel-eco` | 26 / 25 / 27 / 28 / 29 |
| kernel | `kernel-qa` / `kernel-ops` / `kernel-frontier` | 33 / 34 / 35 |
| platform | `platform-identity` + `platform-audit`（= 卷 27 `platform-enterprise` 的**拆分口径**） | 25 |
| platform | `platform-security` / `platform-dist` / `platform-eco` | 27 / 28 / 29 |
| platform | `platform-intel` / `platform-qa` / `platform-ops` / `platform-frontier` | 32 / 33 / 34 / 35 |
| host | `host-enterprise` / `host-automation` / `host-intel` / `host-ui` / `host-frontier` | 25 / 31 / 32 / 30 / 35 |
| 根级 | `harness-testkit`（仅测试期依赖，禁入生产 classpath） | 33 |

> 计数：kernel 8 + platform 9 + host 5 + 根级 1 = **23 个**。其中 3 个（`host-automation` / `host-intel` / `host-ui`）已在文件内给出**降级备选**（落 `host-app` + `host-protocol` 命名空间面），避免登记受阻即阻塞开工。

### 2.3 前端与端形态落点（22 / 23 / 30）

- **包布局（唯一口径）**：`client/packages/app`（Electron 主/预加载/渲染）、`packages/ui`（组件与主题）、`packages/sdk`（协议客户端）——卷 27 §4.1 D-PATH-5，**无第四包**。
- **类型单一来源**：后端契约（`harness-contract`）→ `host-protocol` 生成 → `client/packages/sdk`；本地 IPC 清单 → `app/src/shared/ipc/` 生成类型。两条来源各只有一个生成入口，生成目录禁手改（REQ-DSK-03）。
- **构建/运行命令**：`pnpm -C client install` / `pnpm --filter @open-coding/app test` / `pnpm --filter @open-coding/sdk generate --check` / `pnpm -C client run lint:i18n|check:a11y|perf:budget|package:<os>`；CLI 端为 `mvn -pl harness-host/host-cli -am test` + `scripts/ci/cli-pty-e2e.sh`（§⑪ 已统一）。

## 3. 实施顺序（对齐卷 27 §4.5 二十步）

| 文件 | 步 | 前置步骤 | 说明 / 拆分 |
| --- | --- | --- | --- |
| 19 持久化 | 9 | 2 | 第 9 步只交付迁移框架 + 事件表 + 会话/租户基础表；B4–B6 表族随 14/16/19/20 步进入 |
| 20 工作区 | 12 | 4, 11 | 容器/Cloud 后端按原文后置，不作第 12 步验收前置 |
| 21 Git | 13 | 12（护栏最小集另需 7） | 第 7 步未完成时只交付「隔离创建 + 只读扫描」 |
| 22 CLI/TUI | 8 | 5, 6, 7 | 首次运行向导引用 29，属**后置挂载**（不阻塞第 8 步） |
| 23 桌面 | 15 | 8 | 成本面板只读；配额/预算裁决随 20 |
| 24 A2A | 20 | 9, 15, 19 | 同批内部：25 身份最小集 → 24 → 25 完整治理面 |
| 25 企业 | 20（基础身份属 B1） | 9, 15, 19 | 分两段：基础身份/租户先于第 9 步；治理面随 20 |
| 26 配额成本 | 20 + **提前段** | 9 | 计量最小集须在 15 之前（否则成本面板无数据源） |
| 27 安全运行时 | **无对应步（缺口）** | 4, 7（前置段）/ 20（完整段） | 建议两段挂载，见 §3.2 C5 |
| 28 分发更新 | 20 + **提前段** | 8, 15（打包最小集）/ 20 | 打包签名须随端交付 |
| 29 生态 | 17–18 区段 + 20 收口 | 4, 14, 17 | 与 22 同接缝，先 22 骨架后 29 挂 `init`/`import` |
| 30 交互细则 | 横切 8 / 15 | — | 文案键空间先行冻结，再实现两端 |
| 31 自动化 | 17–19 之间 | 4, 14, 17 | **不得早于第 14 步**（WorkItem 租约 + 幂等） |
| 32 智能增强 | 20 之后 | 9, 15（+4/14/17 产物） | 头部「B5 批次」= 研究规划批次，**非** §4.4 迁移批次 |
| 33 质量评测 | 横切 1 起 | — | 最小门禁随第 1 步；完整评测随 9/15 后 |
| 34 运维运行时 | 20 之后（`/live` `/ready` 提前到 9） | 9, 15, 19, 20 | 健康面先行、治理面后置 |
| 35 前沿原型 | 20 之后（无独立步） | 按消费域逐步（4/7/8/11/16/19） | 不得以「实验」名义跳过前置域 |

### 3.1 循环与不可行前置（C1–C5，已就地写入对应文件的「落地登记」）

- **C1 互锁（22 ↔ 29）**：22 的首次运行向导调用 29 的 `oc init`/导入；29 的命令面宿主是 `host-cli`（22）。处置：先交付 22 命令骨架（第 8 步），向导与 `oc import` 作为 29 就绪后的挂载点，同接缝禁止并行。
- **C2 不可行前置（15 → 26）**：第 15 步桌面「成本面板」依赖计量，而 26 全部落在第 20 步 → 无数据源。处置：26 拆「计量最小集（9 后）+ 配额预算（20）」。**这是原 20 步序列本身的一条缺口**。
- **C3 倒置（28）**：签名/打包/更新通道在原文只在第 20 步，但第 8/15 步就要交付可安装端。处置：28 拆「打包签名最小集（随 8/15）+ 完整段（20）」。
- **C4 同批互为前置（24 ↔ 25）**：24 的五类调用方认证依赖 25 的主体模型；25 的吊销扇出清单引用 24 的委托凭据与 `oc_acp_session_link`。处置：同批（20）内部固定 `25 身份最小集 → 24 → 25 治理面`。
- **C5 结构性缺口（27）**：卷 27 §4.5 二十步**无安全步骤**，而命令静态检查/凭证租约是第 4/7 步的前置围栏（否则「先开工具执行口、后补围栏」）。处置：建议 §4.5 增两段挂载（4/7 前置段 + 20 完整段），已记 §7 建议 S2。

### 3.2 无法自行启动、必须等更早步骤的系统

`31`（等 14）、`32`（等 9/15）、`34`（等 19/20）、`35`（等各消费域）、`24`（等 25 最小集）、`23`（等 8）、`26` 的配额段（等 19/20）。已在各文件落地登记中逐条写明「不得早于」。

## 4. 数据迁移批次映射（卷 27 §4.4，**不改台账**）

### 4.1 落在 B1–B6 内的（就地写入文件）

- `19`：B1（事件/会话/迁移框架/恢复/导出/快照）+ B2（`oc_side_effect_ledger` ≡ `oc_tool_side_effect`）+ B3（保留/删除/校验/备份/演练）+ B4（执行/证据/调度/子代理）。
- `20`：B1（工作区/绑定/连接档/环境档/忽略规则/配额样本）+ B4（命令/PTY/后台任务/待重放队列）。
- `25`：B1（租户/身份/团队/服务账号/API Key）+ B3（角色/策略/求值轨迹/审计链/合规证据）+ B6（特性开关/DLP/SCIM）。
- `26`：B2（用量/账本/预扣/定价/对账/存储计量）+ B6（预算/配额/分配规则/容量参数/优化项）。
- `29`：B6（`oc_scope` 等技能/插件邻域）。

### 4.2 未映射到 B1–B6 的表族 → 建议新批次（**120 张表**，按文件归集）

| 建议批次 | 内容（表族，按当前已声明数量） | 来源文件 | 说明 |
| --- | --- | --- | --- |
| **B7 端形态与交互** | `oc_cli_*`（6）+ `oc_ui_*`（23: 6）+ `oc_ui_preference`/`oc_share_link`/`oc_share_visit`（3） | 22 / 23 / 30 | 端侧与偏好/分享面；依赖 B1（`tenant_id`/会话） |
| **B8 安全运行时与分发遥测** | `oc_sec_*`（9）+ `oc_dist_*`（7） | 27 / 28 | 与第 20 步同批；`oc_sec_egress_manifest` 为跨文件共用清单 |
| **B9 生态与互操作** | `oc_a2a_*`/`oc_remote_agent*`/`oc_acp_session_link`/`oc_federation_*`（9）+ `oc_registry_*`/`oc_import_item`/`oc_im_binding`/`oc_feedback_item`/`oc_deeplink_audit`/`oc_search_document`/`oc_sdk_release`（10） | 24 / 29 | 服务面与生态；`oc_import_job` 复用 B1 的 `19` 表 |
| **B10 自动化、智能增强与前沿实验** | `oc_automation_*`（9）+ `oc_ai_*`（9）+ `oc_experiment_*`/`oc_prototype_run`/`oc_federation_pair`（8） | 31 / 32 / 35 | 依赖 B4（WorkItem）与 B6（特性开关） |
| **B11 质量与运维** | `oc_qa_*`（14）+ `oc_ops_*`（22） | 33 / 34 | 依赖 B1/B3（证据与事件链） |
| **B4 扩写（非新批次）** | `oc_git_*`（8） | 21 | 建议把 §4.4 B4 表述扩为「工作对象 + 团队 + 调度记录 + **交付物（Git/worktree/合并队列/提交追溯）**」 |

### 4.3 同名表双声明（所有权冲突，已就地标注唯一拥有者）

| 表 | 声明文件 | 裁定 |
| --- | --- | --- |
| `oc_acp_session_link` | 24 / 25 | 拥有者 **24**（25 只做吊销扇出引用） |
| `oc_audit_event` | 24 / 25 | 拥有者 **25**（24 只写不建） |
| `oc_usage_event` | 24 / 26 | 拥有者 **26**（24 只引用计量） |
| `oc_import_job` | 19 / 29 | 拥有者 **19**（29 只写 `oc_import_item` 明细） |
| `oc_qa_improvement_item` | 33 / 34 | 拥有者 **33**（34 只引用） |
| `oc_ui_preference` | 23 / 30 | 拥有者 **30**（23 声明本地副本 + 同步读取，禁双写） |
| `oc_snapshot` / `oc_snapshot_entry` | 19 / 20 / 21 | 拥有者 **19**（20/21 只读引用） |
| `oc_workspace_pending_op` | 19 / 20 | 拥有者 **20**（19 只在崩溃矩阵引用） |
| `oc_sec_egress_manifest` | 27 / 28 | 拥有者 **27**（28 按端点维度引用） |

## 5. CI 门禁修正（卷 27 §4.6 对照；全部已修复）

| # | 位置 | 原命令 | 修正 | 门禁归属（§4.6） |
| --- | --- | --- | --- | --- |
| 1 | `impl/24` §⑪.4 | `mvn -pl open-coding-bootstrap -am test` | `mvn -pl harness-host/host-bootstrap -am test` | 集成测试 |
| 2 | `impl/35` §⑪ | `mvn -pl harness-core -am test -Dgroups=frontier-gate` | `mvn -pl harness-kernel/kernel-frontier -am test …` | 单元测试 |
| 3 | `impl/35` §⑪ | `mvn -pl open-coding-bootstrap -am test` | `mvn -pl harness-host/host-bootstrap -am test` | 集成测试 |
| 4 | `impl/32` §⑪.1 | `mvn -pl harness-contract/harness-contract-intel,…` | `mvn -pl harness-contract,harness-platform/platform-intel -am compile` | 依赖规则 + 编译 |
| 5 | `impl/22` §⑪.7 | `npm --prefix open-coding-client run lint:copy` | `pnpm -C client run lint:copy` | 前端构建 + 类型检查 |
| 6 | `impl/30` §⑪.2 | 4 条 `npm --prefix open-coding-client …` | 4 条 `pnpm -C client …` | 前端构建 + a11y + e2e |
| 7 | `impl/23` §⑪.5 | `pnpm --filter @open-coding/shared generate --check` | `--filter @open-coding/sdk generate --check` + `app run gen:ipc --check` | 契约漂移（生成物一致） |
| 8 | `impl/33` §⑪.4 | `@open-coding/shared generate --check` | `@open-coding/sdk generate --check` + `gen:ipc --check` | 契约测试 |

**其余核对结论**：`19/20/21/25/26/27/28/29/31/34` 的 `mvn -pl` 坐标均与卷 27 §4.1 或 §2.2 扩展清单一致；`33` 的 `scripts/ci/gate.mjs --profile fast|full` 与 §4.6 门禁链（格式 → Enforcer → 单测 → 集成 → 契约 → 前端 → 评测 → 红队 → 性能）同序；`22/23/30` 的 `scripts/ci/*.sh` 属 §4.6 的平台无关脚本口径。

## 6. I- 决策落点报告（`I-` 决策未绑定实现模块/类）

- 实算：17 份合计 **169 条** `I-` 决策行（最高 `impl/32` 19 条，最低 `impl/23` 6 条）。
- 抽查结论：**模块落点 0 条、类级落点 1 条**（`impl/28` §3.6 `I-DIST-1` 点名 `UpdateCore`）。其余全部只有「决策 / 选定 / 被放弃代价 / 回退触发」四列，实现信息散落在 §1.4–§1.5 与 §⑤ 类图，无法从决策编号反查代码。
- 处置：每份文件已在「落地登记」中写明「`I-XXX-1…N` 的模块落点见上表、类级落点见 §⑤」，并把「在 §③ 决策表增设『落点（模块/类）』列」登记为建议 **S4**（§7）。

## 7. 剩余风险与修订建议（只登记，不改卷 27）

| # | 建议 | 目标 | 理由 |
| --- | --- | --- | --- |
| S1 | 卷 27 §4.1 登记 23 个扩展模块（§2.2），或明确「扩展模块须在本表增补后方可入库」 | `27-technical-path.md` §4.1 | 当前 impl 各文件与 §4.1 存在**命名双轨**；不登记则 Enforcer/CI 的模块白名单无法建立 |
| S2 | 卷 27 §4.5 为「安全运行时」与「分发/更新」各增两段挂载（4/7 前置 + 20 完整；8/15 打包 + 20 完整） | 同上 §4.5 | C3/C5：按原序列会出现「先开口、后补围栏」「先交付端、后建签名通道」 |
| S3 | 卷 27 §4.3 补 卷 28–35 的落点行（28→`platform-dist`、29→`platform-eco`、30→`platform-security`、31→`kernel-cost`+`platform-persistence`、32→`platform-intel`、33→`platform-qa`、34→`platform-ops`、35→`platform-frontier`） | 同上 §4.3 | 现表只覆盖卷 01–26，Phase B 十份无映射 |
| S4 | 各 §③ 决策表增设「落点（模块 / 类）」列，或由 `IMPL-DECISIONS.md` 汇总补充 | 全部 impl | §6：169 条决策无法反查实现 |
| S5 | 卷 27 §4.4 新增 B7–B11（或明确不接受新批次时的替代归并），并把 B4 表述扩写到「交付物（Git）」 | 同上 §4.4 | 120 张表无批次落点，无法按批次排期与回滚 |
| S6 | 表所有权唯一化：9 组同名表按 §4.3 裁定写回各文件（已就地标注），`oc_*` 注册表建议由 `19` 汇总 | 各 impl §⑧ | 双声明会让「单一写入者」纪律失效（卷 19 D-PERS-1） |

**剩余风险（未修，需人工决策）**：① `host-ui`/`host-automation`/`host-intel` 三处「扩展模块 vs 命名空间面」二选一尚未定死（各文件已给双方案，开工前必须冻结）；② `platform-enterprise` 拆成 `platform-identity` + `platform-audit` 会改变卷 27 的模块数（12 → 14 个 platform 子模块），需在 S1 一并裁决；③ 26 的计量最小集若被强行压到第 20 步，第 15 步成本面板与第 19 步预算门将同时失源（已作为 C2 记录，属需要改卷 27 而非改 impl 的缺口）。
