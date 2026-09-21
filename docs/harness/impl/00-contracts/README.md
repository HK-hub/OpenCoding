# 契约补全层总索引（`impl/00-contracts/`）

> 本目录是 OpenCoding Harness 目标态设计的**契约补全层**：补齐「一个没读过任何一页的资深工程师，仅凭文档即可写出第一个可编译 PR」所缺的最小充分集——模块清单与坐标、错误码目录、内核端口签名与值对象、首代表结构与批次、零凭证本地运行配方。
> 上游输入：Phase A 36 卷 + `impl/01…35`（系统级方案）+ `impl/components/`（组件级方案）+ Phase A 附录 A/B/C；触发来源为 `reviews/R10-walkthrough.md`（可开工性走查，9 项开工阻塞）。
> 交付轮次：**R10b**（契约补全：可开工性闭环），登记见 `ITERATIONS.md` 轮次表 R10b 行；裁决登记见 `impl/IMPL-DECISIONS.md` §2.36 与 §3.4；本目录 5 份 / 2,425 行 / 0 图（R10b 实测）。

---

## 1. 定位：为什么需要这一层

R10 可开工性走查（`reviews/R10-walkthrough.md`）的结论是：**仅凭既有卷册与 impl 文档写不出第一个能编译的 PR**——模块名在卷 27 只到目录级（24 个扩展模块自述「待登记」）、`ErrorCode` 无定义（写不出 `HarnessException`）、12 个内核端口无方法签名、载荷 record 无字段、B1 表清单三处互斥、受理回执三命名并存。

走查摘要（原文 §〇）：阻塞开工 **9** 项（B1–B9）、增加返工 **7** 项（R1–R7）、文档瑕疵 **4** 项（D1–D4）；三个直接问题的答案均为「不能/会卡住」——契约补全层即为把这组答案翻转为「可以开工」而建。

契约补全层逐项闭合上述缺口，交付形态为 5 份**可直接照抄的契约文档**：

| 缺口（R10-walkthrough 编号） | 本层兑现文档 |
| --- | --- |
| B1 模块清单 / B2 首 PR 落点 | `MODULE-MANIFEST.md`（§2 59 模块、§3 坐标与聚合、§4 迁移期共存） |
| B8 `ErrorCode` 缺失 | `ERROR-CODE-CATALOG.md`（253 码 + 字段定义 + 三层异常映射） |
| B9 端口无签名 / B3 载荷无字段 | `KERNEL-PORTS.md`（12+9 端口全签名 + 18 值对象 + M0 24 类） |
| B4 表字段互斥 / B5 检查点 / B6 B1 批次 | `CORE-DATA-MODEL.md`（B1–B11 批次 + B1 46 表 + DDL 草案） |
| 零凭证跑通 / R4 假模型装配面 | `LOCAL-RUN-RECIPE.md`（7 条命令 + 假模型装配面 + 12 项故障排查） |

**范围外（本层不写什么）**：不重复各 impl 的业务流程/算法/评分矩阵（那些留在系统级与组件级方案）；不新增功能需求（不产生新 `REQ-`）；不修改任何既有文件（差异只登记回改清单）；不承担 Phase A 卷册的语义修订（那属 `X-n` 修订建议体系）。

## 2. 权威性声明（冲突裁决）

1. **可实现性权威**：本目录 5 份文档为「开工所需事实」的**唯一权威**——与 `impl/01…35`、`impl/components/`、Phase A 卷册（在模块名/错误码/端口签名/表结构/运行配方五类事实上）冲突时，**以本层为准**。裁决顺位：`MODULE-MANIFEST` §1.4（模块名）→ 卷 27 §4.2（依赖规则）→ 各 impl §①/§⑪（落点与命令）。
2. **本层不改其它文件**：所有与上游文档的差异一律「只登记、不改写」，逐条列为**回改清单**，位于各契约文档末节：`MODULE-MANIFEST` §7（卷 27/impl 命令/附录 D/本 README 索引的派单）、`ERROR-CODE-CATALOG` §6（22 项替换/别名/新增登记）、`KERNEL-PORTS` §6（15 条 D-PORT 裁决 + 9 条回改派单）、`CORE-DATA-MODEL` §7（D-CDM 裁决表 + 剩余未映射）、`LOCAL-RUN-RECIPE` §7（12 项待补项）。
3. **编号独立**：本层裁决使用专名前缀 `D-PORT-1…15` 与 `D-CDM-1…14`（合计 29 条），与 Phase A `D-<域>-<n>`、Phase B `I-<域>-<n>`（277 条）互不覆盖、互不并入；登记于 `impl/IMPL-DECISIONS.md` §2.36。
4. **冻结语义**：本层文档落盘即冻结；后续任何模块新增/改名、错误码新增、端口签名变更、表结构变更，必须先改本层文档并重算计数，再回改 impl 与卷册。

## 3. 五份文档索引

| 文件 | 解决什么问题 | 关键计数（R10b 实测） | 上游依据 |
| --- | --- | --- | --- |
| `MODULE-MANIFEST.md` | 模块名/坐标/目录/依赖方向/包根的唯一事实源：59 条目 = 主 reactor 54（契约 1 + 内核 17 + 平台 22 + 外壳 12 + 工程 2）+ 独立工程 1 + TS 包 4；含 12 项冲突名裁决、Enforcer/ArchUnit 双轨、六队并行拓扑、CI 选择器铁律、v1 迁移共存与退役顺序 | **59** 模块；§5.4 六门 CI 命令；v1→v2 映射 27 行 | 卷 27 §4.1–§4.5；`impl/01` §1.4；R07 两份 findings；`appendix-d` L277 |
| `ERROR-CODE-CATALOG.md` | 错误码唯一目录：`ErrorCode` 七字段定义、`ErrorSeverity` 四档、`RecoveryAction` 七档、三层异常归属（`HarnessException`/`BusinessException`/`AiException`，兑现 X-82）、重试唯一判据 `retryable`、28 条禁重试码、文案三段式与脱敏、22 项替换/别名处置 | **253** 码（含别名 15、新增 22）；禁自动重试 28 条 | `appendix-b` §B.11；`impl/01–34` §⑨ 错误矩阵；组件 findings（C07/C08/X-C11-5/X-C27-3/X-C28-2/3/X-C32-1/X-C33-1/R-C19-3） |
| `KERNEL-PORTS.md` | 内核端口方法签名冻结：12 领域端口（§3.1–§3.12）+ 9 宿主/传输端口（§3.13），18 个值对象 record 字段级定义，线程与取消语义，`EventPayload` sealed 指针（B3），M0 最小可编译 24 类开工序 | **12+9** 端口 / **18** 值对象 / M0 **24** 类；D-PORT 裁决 **15** 条 | `impl/01` §9.3、02 §5.1、03 §5.1、05 §5、06 §5、07 §5、10 §5.1、12 §5.1、14 §5、16 §5.1、17 §5、19 §5、20 §5；`appendix-b` §B.5/B.7/B.9 |
| `CORE-DATA-MODEL.md` | 数据模型最终裁决：B1–B11 迁移批次总表 + B1 46 表七波清单（owner/可 DROP 语义）+ B1 核心表 DDL 草案（会话/线程/输入/回合/条目/检查点/事件分区族）+ 关键不变量与索引模式 + 容量对齐 + 回改清单 | B1 **46** 表（B1b 5 表另列）；D-CDM 裁决 **14** 条；容量口径 10k 用户 | 卷 27 §4.4；`impl/01/12/19` §8；`impl/03` §8.1；`appendix-a` §A.6/A.8/A.9；组件建议 X-C18-1/X-C20-1/X-C12-2/X-C30-1/X-C28-5 |
| `LOCAL-RUN-RECIPE.md` | 零凭证本地运行配方：新人 ≤15 分钟路径与 CI 同源路径、docker compose 基础设施、`.env` 变量清单、假模型装配面（`@ConditionalOnProperty` + `ResponseScript` 脚本协议）、7 条命令手册（§4.1→4.7）、12 项故障排查、CI 对齐 | 零凭证路径 **7** 条命令（≤15 min）；故障排查 12 项 | `impl/33` §5/§11.5；`impl/02` §9.5；`impl/19` §9.3；`impl/22` §9.2；根 `.env.example` |

> 复算命令（R10b 实跑，详见 `AUDIT.md` §9.1）：
> `sed -n '55,144p' impl/00-contracts/MODULE-MANIFEST.md | grep -c '^| \`'` = 59；`awk '/^## §3/,/^## §4/' impl/00-contracts/ERROR-CODE-CATALOG.md | grep -cE '^[\|] [^\|]+ [\|] \`[A-Z0-9_]+\`'` = 253；`grep -c 'public record' impl/00-contracts/KERNEL-PORTS.md` = 18；`grep -doE 'D-(PORT|CDM)-[0-9]+' impl/00-contracts/*.md | sort -u | wc -l` = 29；`grep -cE '^### 4\.[0-9]' impl/00-contracts/LOCAL-RUN-RECIPE.md` = 7。

### 3.1 逐文档章节目录（速查）

| 文档 | 章节骨架 |
| --- | --- |
| `MODULE-MANIFEST.md` | §1 目的与权威性（含 §1.3 冲突名 12 项 / §1.4 裁决顺位）→ §2 模块总表（六段：契约/内核/平台/外壳/工程/端，§2.7 计数）→ §3 聚合与坐标（坐标规则冻结 / BOM / 根聚合 POM / 打包 / Enforcer+ArchUnit）→ §4 v1 共存与迁移（映射 / 共存规则 / 退役顺序）→ §5 构建顺序（拓扑序 / 六队并行 / 选择器铁律 / CI 六门）→ §6 包名约定 → §7 修订建议（回改清单） |
| `ERROR-CODE-CATALOG.md` | §1 目的与权威性（散落定义取证）→ §2 错误模型（字段 / severity 四档 / recoveryAction 七档 / 三层异常与三重映射）→ §3 全量码表（253 条，按域 30+ 块）→ §4 重试与降级判定（禁重试 28 条）→ §5 用户可见文案（三段式 / 脱敏 / 四端措辞）→ §6 修订与替换清单（22 项）→ §7 CI 校验规则 |
| `KERNEL-PORTS.md` | §1 目的与范围（三条硬规则 + 返回风格）→ §2 端口总表（15 行）→ §3 端口契约逐条（§3.1–§3.12 领域 / §3.13 宿主与传输）→ §4 值对象目录（§4.1–§4.8）→ §5 线程与取消语义 → §6 差异登记（D-PORT-1…15 + 回改派单）→ §7 M0 最小可编译清单（24 类） |
| `CORE-DATA-MODEL.md` | §1 目的与权威性（三条硬性 + 冲突取证 + 职责边界）→ §2 迁移批次（B1–B11 总表 / §2.3 B1 46 表七波 / 组件建议归批）→ §3 核心表 DDL（§3.1–§3.10：会话/线程/输入/回合/条目/检查点/事件族/对象引用）→ §4 关键不变量 → §5 索引与查询模式 → §6 容量对齐 → §7 冲突裁决与回改清单 |
| `LOCAL-RUN-RECIPE.md` | §1 目标（新人路径 / CI 路径 / 非目标）→ §2 前置依赖（软件 / compose / `.env` / 字符集时区）→ §3 假模型装配面（激活 / 互斥 / 脚本协议 / 验证点）→ §4 命令手册（7 条）→ §5 故障排查（12 项）→ §6 CI 对齐 → §7 待补项（12 项） |

### 3.2 一致性守卫与 CI 对应（摘要，全文见各文档末节）

| 守卫 | 机制 | 出处 |
| --- | --- | --- |
| 错误码单点权威 | `ERROR-CODE-CATALOG.md` §7.1 grep guard：全树新增 `ErrorCode` 枚举值必须出现在 §3 总表；`retryable` 只认目录值 | `ERROR-CODE-CATALOG` §7 |
| 模块名守卫 | 未登记模块名不得出现在 `pom.xml`、`-pl` 选择器、验收命令与 CI 脚本；`harness-core`/`harness-surface`/`host-eco` 等废弃名零容忍 | `MODULE-MANIFEST` §1.1/§1.3/§6.3 |
| 选择器铁律 | `-pl` 一律引用 `scripts/ci/selectors/{kernel,platform,host}.txt` 清单；聚合器需 `-am` 语义校正 | `MODULE-MANIFEST` §5.3/§5.4 |
| 端口签名冻结 | 端口接口住 `harness-contract`、适配器住 `platform-*`/`host-*`；内核禁引实现类、禁裸 `System.currentTimeMillis`/`UUID.randomUUID` | `KERNEL-PORTS` §1 |
| 三层异常纪律 | 内核 `HarnessException(ErrorCode, 中文)`、外壳 `BusinessException`、适配层 `AiException(ErrorCode)`；禁裸 `RuntimeException` 表达业务失败（兑现 X-82） | `ERROR-CODE-CATALOG` §2.4；`KERNEL-PORTS` §1 |
| DDL 唯一权威 | B1 表与列以 `CORE-DATA-MODEL` §2/§3 为准；`oc_event_log` 禁 DROP（只 DETACH 归档）、审计/删除证明表禁 DROP/UPDATE | `CORE-DATA-MODEL` §2.3/§4 |
| 零凭证门禁 | CI 的「零凭证」列：全程无 `*_API_KEY`、无出网；7 条命令为最小回归集 | `LOCAL-RUN-RECIPE` §6 |

## 4. 阅读顺序（推荐）

1. **`MODULE-MANIFEST.md`** —— 先建立工程坐标系：59 模块、坐标规则、聚合 POM、依赖方向、CI 选择器、迁移期共存。读法：§2（总表）→ §3（坐标）→ §5（构建顺序）→ §1.3/§1.4（冲突名与裁决顺位）。落点：第一个 PR 的 `pom.xml` 与根 `modules`。
2. **`KERNEL-PORTS.md`** —— 再冻结接口面：12+9 端口签名、18 值对象、M0 24 类开工序。读法：§2（端口总表）→ §3（逐条签名）→ §4（值对象）→ §7（M0 清单）。落点：`harness-contract` 的首批接口与 record。
3. **`CORE-DATA-MODEL.md`** —— 再对齐数据面：B1–B11 批次、B1 46 表、DDL 草案与不变量。读法：§2（批次与 B1 清单）→ §3（B1 核心表 DDL）→ §4/§5（不变量与索引）。落点：第一份 Flyway 迁移（B1 批）。
4. **`ERROR-CODE-CATALOG.md`** —— 再统一失败语义：253 码、字段定义、三层异常、重试判据。读法：§2（错误模型）→ §3（总表，按域）→ §4（重试/降级）→ §5（文案与脱敏）。落点：`ErrorCode` 枚举与全局处理器映射。
5. **`LOCAL-RUN-RECIPE.md`** —— 最后自证可跑：7 条命令从零起跑（含假模型链路与恢复验证）。读法：§1（目标与非目标）→ §2（前置）→ §3（假模型装配）→ §4（命令手册）→ §5（故障排查）。落点：本地冒烟与 CI fast 档。

> 与系统级/组件级方案的衔接：读完本层后返回 `impl/README.md` §1.3 三条路径（11 节模板的系统级方案）与 §1.4（三层关系表）；需要落到具体组件实现时再查 `impl/components/README.md`。

## 5. 与 `reviews/R10-walkthrough.md` 阻塞项的对应（9 项逐条）

状态口径：**已关闭** = 契约层已给出唯一裁决且可直接照做；**部分** = 已登记裁决指针，仍有待编排方回改的正文；残项均为「回改清单」项，不阻塞开工。

| # | 阻塞项（走查原文摘要） | 关闭文档 + 节 | 状态 | 残项 |
| --- | --- | --- | --- | --- |
| B1 | 模块清单不可唯一确定（24 个扩展模块「待登记」，`-pl` 必失败） | `MODULE-MANIFEST.md` §2（59 模块总表）、§1.3（12 项冲突名）、§1.4（裁决顺位）、§5.3/§5.4（选择器与 CI 命令） | ✅ 已关闭 | 卷 27 §4.1 回改（§7.1）；`scripts/ci/selectors/*.txt` 新建（§7.3） |
| B2 | 首个 PR 物理落点未定（根 POM / 聚合 POM / 迁移期并存） | `MODULE-MANIFEST.md` §3.1（坐标规则）、§3.3（根聚合 POM）、§4.2（迁移期共存规则）、§4.3（退役顺序） | ✅ 已关闭 | 卷 27 §4.1/§4.8.1 增注（§7.1） |
| B3 | `EventPayload` sealed 白名单与全域事件规模不自洽 | `KERNEL-PORTS.md` §4.8（登记「按 R10 §八-7 处置」，裁决指针已立） | 🟡 **部分（唯一遗留）** | `impl/16` L388/L390 仍为 `sealed interface EventPayload`（R10b `grep` 复核）；去 sealed / 改走 SchemaRegistry 登记待回改 |
| B4 | 同表字段/约束三处互斥（`oc_turn` / `oc_item` / `oc_event_log`） | `CORE-DATA-MODEL.md` §3.5/§3.6/§3.8（列名与主键/分区裁决）+ §7.1 裁决表 | ✅ 已关闭 | impl/01 §8.1、impl/12 §8.1、impl/16 §8.1 与附录 A.8 回改（§7.1） |
| B5 | `oc_checkpoint` 收敛条款自相矛盾（幂等键含 `session_id` 但列清单缺失） | `CORE-DATA-MODEL.md` §3.7（唯一 `oc_checkpoint` + 撤销 `oc_context_checkpoint`，D-CDM-4） | ✅ 已关闭 | impl/12 §8.1 增 `session_id`；impl/03 §8.1 改别名指针 |
| B6 | B1 数据批次三份清单互斥（首份 Flyway 迁移写不出） | `CORE-DATA-MODEL.md` §2.3（B1 46 表七波 + owner）、§2.1（D-CDM-1 合并取舍） | ✅ 已关闭 | 卷 27 §4.4 每批补「表清单 + owner」；impl/01/12/19 引本文件（§7.1） |
| B7 | 受理回执三命名（`AdmissionReceipt` / `SubmitAck` / `AdmissionOutcome`） | `KERNEL-PORTS.md` D-PORT-3 + §4.8（`AdmissionOutcome` sealed 四分支冻结） | ✅ 已关闭 | impl/12 §5.1/§9.1 别名注；`appendix-b` §B.2 增出参类型列 |
| B8 | `ErrorCode` 契约缺失（写不出 `HarnessException`） | `ERROR-CODE-CATALOG.md` §2（错误模型与三层异常）、§3（253 码）、§6（22 项修订清单） | ✅ 已关闭 | `appendix-b` §B.11 整节替换为指针；域内枚举降为别名（§6-2/3/4） |
| B9 | 12 个内核端口无方法签名 | `KERNEL-PORTS.md` §3.1–§3.13（12 领域 + 9 宿主/传输端口全签名）、§7（M0 24 类） | ✅ 已关闭 | impl/01 §9.3 增签名指针列（§6 回改清单 1） |

**统计：已关闭 8 / 部分 1（B3）/ 遗留 0**。走查另列「增加返工（R1–R7）」与「文档瑕疵（D1–D4）」的收敛去向如下（均为「登记不入正文」，逐条动作见对应契约文档回改清单）：

| 走查项 | 内容摘要 | 收敛去向 | 状态 |
| --- | --- | --- | --- |
| R1 | 单内核模块 vs 8 个 kernel-* 子模块口径冲突 | `MODULE-MANIFEST` §2.2/§4.2（物理 8→16 叶子模块 + 逻辑包冻结） | 已收敛 |
| R2 | CI 入口脚本名冲突（`*.sh`/`all.sh` vs `gate.mjs`） | `MODULE-MANIFEST` §7.1（单入口冻结 `./scripts/ci/gate.mjs`） | 已收敛 |
| R3 | `profile` 一词三义（宿主档/出厂档/门禁档） | `MODULE-MANIFEST` §7.1（术语回改清单）+ `KERNEL-PORTS` D-PORT-2/4 别名收敛 | 已登记 |
| R4 | 假模型无产品链路装配面 | `LOCAL-RUN-RECIPE` §3（`@ConditionalOnProperty` 装配 + `ResponseScript` 协议 + `oc chat --model fake`） | 已收敛 |
| R5 | 会话状态权威表未收敛（Session/Thread 基数） | `CORE-DATA-MODEL` §3.3/§3.2（基数 1:1+0..N 显式声明，D-CDM-8） | 已收敛 |
| R6 | 事件命名分叉（`session.input.*` vs `agent.input.*`） | `KERNEL-PORTS` D-PORT-4（`agent.input.admitted` 登记为弃用别名） | 已收敛 |
| R7 | 外置件/检查点保留期未对账 | 随 B4/B6 表裁决入 `CORE-DATA-MODEL` §7.2「剩余未映射」 | 已登记 |
| D1 | C01–C36 ↔ 附录 D 137 组件映射缺失 | R10 已闭合（附录 D「组件级方案」列：59 命中 / 78 覆盖） | 已闭合 |
| D2 | 「已登记未裁决」修订项无统一清单 | `IMPL-DECISIONS.md` §4 号段登记（X-83…X-215） | 已闭合 |
| D3 | `tools/fake-llm` 与 `kernel-qa` 口径不一致 | `MODULE-MANIFEST` §7.1（假模型收敛 `kernel-qa` 同进程为主） | 已登记 |
| D4 | 前端包名无权威 | `MODULE-MANIFEST` §6.2（TS 包名与工程冻结） | 已收敛 |

> 编号速查：`D-PORT-n` / `D-CDM-n` = 本层裁决（29 条，登记 `IMPL-DECISIONS.md` §2.36）；`I-<域>-n` = 系统级实现决策（277 条，`IMPL-DECISIONS.md` §2）；`X-n` = 修订建议号段（215 条，`IMPL-DECISIONS.md` §4）；`REQ-<域>-n` = 需求号（定义行口径全树 1,861，`impl/README.md` §2）；`H-/D-/L-/E1–E4` 见 `DECISIONS.md` / `research/00-research-plan.md` §2。

## 6. 开工首日路径（M0 摘要，取自 `KERNEL-PORTS.md` §7）

1. **冻结契约（第 1–10 行，一次做完，之后禁随实现增删方法）**：`ErrorCode`+`HarnessException`（X-82 前置）→ `EventEnvelope`/`EventPayload` → `AppendRequest`/`AppendResult` → `ModelRequest`/`ModelResponse`/`Usage` → `StreamEvent`+8 子型 → `AdmissionOutcome`/`SessionInputRecord` → `ToolInvocation`/`ToolResult` → `ContextSnapshot`/`TokenBudget`/`ContextSection` → 5 个标识 record + `ActorRef`/`BudgetEnvelope` → 12 个领域端口接口（KERNEL-PORTS §3.1–§3.12）。
2. **内存链路跑通（第 20/21/23 行）**：`InMemoryEventStore`+`InMemoryPersistence`（`platform-runtime-store`）→ `SystemClockAdapter`/`SnowflakeIdAdapter`/`SpringTransactionAdapter` → `ApplicationAssembler`（`host-bootstrap`，`@ConditionalOnMissingBean` 端口绑定）→ 跑通「建会话 → 发消息（准入）→ 假模型流式文本 → 条目落库 → 恢复（重放）」。
3. **替换为持久化实现（第 22 行）**：`PgPersistenceAdapter`（`platform-persistence`，B1 批 46 表就位后）——同一套端口契约测试复用。
4. **验收命令**：`mvn -q -pl harness-contract,harness-kernel,harness-host/host-protocol -am test`；离线链路 `oc qa replay --suite core`（对应 `LOCAL-RUN-RECIPE.md` §4.6/§4.7）。
5. **首 PR 建哪些模块**：`harness-bom`、`harness-contract`、`harness-kernel`（聚合器）、`kernel-event`（+ 根 POM 追加 `modules`）——见 `MODULE-MANIFEST.md` §7.1 的 §4.5.1 约定。

### 6.1 开工前冻结自检（6 条，逐条可 grep）

1. 模块名都在 `MODULE-MANIFEST.md` §2 的 59 行内？`grep -c '^| `'` 复算一致，且无 `harness-core`/`harness-surface`/`host-eco` 等废弃名出现在 `pom.xml` 与选择器。
2. `ErrorCode` 取值全在 `ERROR-CODE-CATALOG.md` §3？新增码已按 §6 走「替换/别名/新增登记」三档并在枚举落地。
3. 端口方法签名与 `KERNEL-PORTS.md` §3 逐字一致？新增端口/方法已先改本层再回改 impl。
4. 第一份迁移只含 B1 批（46 表）？表名与列名与 `CORE-DATA-MODEL.md` §3 DDL 一致，`oc_event_log` 未被误建唯一约束。
5. `LOCAL-RUN-RECIPE.md` §4 的 7 条命令在空库环境可全绿？异常分支已按 §5 的 12 项排查核对。
6. 本层文档与 `IMPL-DECISIONS.md` §3.4/§4 的计数互洽（29 / 59 / 253 / 18 / 46 / 7 / 215 / 277）？

### 6.2 M1+ 衔接（一句话）

M0 只求「端口契约测试全绿 + 假模型链路可跑通」；真模型适配器（impl/02）、工具族（impl/05）、上下文压缩（impl/03）等按 `IMPL-DECISIONS.md` §2 的各域 `I-` 决策与 `impl/README.md` §3 三条路径推进，异常与错误码一律回到 `ERROR-CODE-CATALOG.md` 登记。

## 7. 维护约定

1. **改动顺位**：任何模块/错误码/端口/表结构变更，先改本目录对应文档并重算计数（各文档末尾计数表），再按各文档「回改清单」回改 impl 与卷册；禁止反向（先改 impl 后改本层）。
2. **计数权威**：本层各计数以文档内「计数与核对」小节为权威（`MODULE-MANIFEST` §2.7、`ERROR-CODE-CATALOG` §3 统计、`KERNEL-PORTS` §7、`CORE-DATA-MODEL` §2.2、`LOCAL-RUN-RECIPE` §4 命令数）；索引层（本 README / `impl/README.md` §2 / `AUDIT.md` §9）与本层不一致时以本层为准。
3. **新增文档**：本目录编号 `00-` 为契约段保留；新增契约文档须在 `MODULE-MANIFEST` §2.1 的模块映射与 `IMPL-DECISIONS.md` §3.4 计数表中同步登记。

## 8. 与其它索引文件的关系

| 索引文件 | 指向本层的位置 | 本层指向其的位置 |
| --- | --- | --- |
| `docs/harness/README.md` §2 | 「实现」区新增 `impl/00-contracts/` 行（R10b） | 本 README §4 回指 `impl/README.md` §1.3/§1.4 与三条阅读路径 |
| `docs/harness/impl/README.md` | §1.4「与 00-contracts / components 两层的关系」（权威顺位表） | 本 README §4 阅读顺序末段 |
| `docs/harness/AUDIT.md` | §9「Phase B 契约补全层与终局计数（R10b 实测）」（§9.1 计数 / §9.2 阻塞关闭 / §9.3 全树终局 / §9.4 结论） | 本 README §5 阻塞对应表为其展开版 |
| `docs/harness/impl/IMPL-DECISIONS.md` | §2.36（29 条裁决）+ §3.4（契约层计数） | 本 README §2.3/§5 编号速查 |
| `docs/harness/ITERATIONS.md` | Phase B 轮次表 R10b 行 | 本 README 文首「交付轮次」 |
| `reviews/R10-walkthrough.md` | 9 项阻塞即本层立项依据 | 本 README §5 逐条对应表（含关闭状态与残项） |

**本索引自身计数复核**（R10b）：本 README 由 R10b 轮新增，属 `impl/00-contracts/` 第 6 份 Markdown（索引件，不计入 5 份契约文档的 2,425 行口径；追加后目录为 6 份 / **2,576** 行，`find impl/00-contracts -name '*.md' -exec cat {} + | wc -l` 复核）。
