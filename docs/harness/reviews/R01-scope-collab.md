# R01 · 协作与平台层机械校验与编号一致性评审（impl/13 – impl/24）

> 评审轮次：REVIEW ROUND 1（镜头：机械校验与编号一致性）
> 范围：`impl/13-agent-teams-impl.md` … `impl/24-a2a-gateway-impl.md`（12 份，共 11,442 行）
> 参照：`impl/IMPL-DECISIONS.md`、`DECISIONS.md`、`appendix-*.md`、`research/LESSONS-AND-ADOPTIONS.md`、`.qoder/rules/*`
> 结论：**11 节模板 / REQ 表内编号 / I-决策台账 / Mermaid / 占位 / Java 规范 全部通过；7 项缺陷已登记，1 项已在位修复。**

---

## 一、方法与工具（可复核）

| # | 检查项 | 手段 | 覆盖量 |
| --- | --- | --- | --- |
| 1 | 模板完整性 | Node 脚本抽取全部 `^##` 标题，按 11 节关键字顺序匹配 + 乱序/缺失判定 | 12 文件 134 个 H2 |
| 2 | Mermaid 合法性 | `node .research-cache/mmd-check/check.mjs`（mermaid 11.17.2 + jsdom 真实解析，非启发式） | 103 图 100% 解析 |
| 3 | REQ 唯一性/连续性 | 逐文件切出 §② 区间 → 抽 `REQ-[A-Z0-9]+-[0-9]+` → 行内重复 / 数值缺口 / 来源列空值 | 12 表 266 行 |
| 4 | I-决策一致性 | 文件侧全量抽取 vs `IMPL-DECISIONS.md` §2（75–523 行，268 行台账）双向 diff | 96 条 / 12 域 |
| 5 | 交叉引用有效性 | 多根解析器（`.`/`impl/`/`research/`/competitors/`/`.qoder/rules`/repo root）逐 `.md` ref 判存在；`卷 NN §M.k` 用 Phase A 卷标题集校验；`###/表格行` 锚点校验 `D-<域>I-n`；`§①` 环形序号内部校验 | 468 处 D-、227 处 L-、59 处 H-、6 处 X-、全部卷/文件引用 |
| 6 | 格式与占位 | 严格词表（`TODO\|FIXME\|待填\|TBD\|待补充\|待定\|WIP`）；## 级段落实行数 <5 判空 | 12 文件全文 |
| 7 | Java 规范抽样 | 抽取全部 ```java 块（25 块 / 1,354 行）+ 机械规则扫描 + 人工通读；断言脚本见下 | 25 块 |

机械规则集（检查 7）：`log.*(e.getMessage())`、`System.out.println/printStackTrace`、裸 `throw new RuntimeException|IllegalArgumentException|NullPointerException|IllegalStateException`、`LoggerFactory.getLogger`、`log.*("…" + var)`、声明缺 JavaDoc、`if`/`TimeUnit` 魔法数字、枚举 `code+desc+of()` 三要素。
辅助脚本落于 OS 临时目录（`r01-*.mjs`），未污染仓库。

---

## 二、逐项结果

### 检查 1 · 模板完整性 —— 通过（12/12）

| 文件 | H2 数 | 11 节顺序 | 偏差 |
| --- | --- | --- | --- |
| 13 / 14 / 15 / 16 / 19 / 20 / 21 / 22 / 23 / 24 | 11 | ✅ | — |
| 17-hook-engine | 12 | ✅ | 用 `## N.` 阿拉伯数字；追加 `## 12. 实现级决策汇总` |
| 18-plugin-runtime | 12 | ✅ | 同上（`## 12. 实现级决策汇总`） |

10 份用 `## ①…⑪` 环形序号；17、18 用 `## 1.…11.`。④ 标题：17「总体架构与逐点顺序契约」、18「总体架构与扩展点目录」，其余 10 份为「总体架构图」。**无缺节、无乱序。**

### 检查 2 · Mermaid 合法性 —— 通过（103/103）

| 文件 | 图数 | 类型（首行关键字） | 失败 |
| --- | --- | --- | --- |
| 13-agent-teams | 8 | flowchart 1 / classDiagram 1 / sequenceDiagram 4 / stateDiagram-v2 2 | 0 |
| 14-task-plan-engine | 8 | 同上 | 0 |
| 15-goal-scheduler | 8 | 同上 | 0 |
| 16-event-bus | 8 | 同上 | 0 |
| 17-hook-engine | 7 | sequenceDiagram 3 / 其余同上 | 0 |
| 18-plugin-runtime | 8 | 同 13 | 0 |
| 19-persistence-recovery | 9 | stateDiagram-v2 3 / 其余同上 | 0 |
| 20-workspace-provider | 10 | sequenceDiagram 5 / stateDiagram-v2 3 | 0 |
| 21-git-worktree | 8 | 同 13 | 0 |
| 22-cli-tui | 9 | sequenceDiagram 5 | 0 |
| 23-desktop-electron-vue | 10 | sequenceDiagram 5 / stateDiagram-v2 3 | 0 |
| 24-a2a-gateway | 10 | sequenceDiagram 5 / stateDiagram-v2 3 | 0 |

首行关键字全部 ∈ {flowchart, classDiagram, sequenceDiagram, stateDiagram-v2}；围栏配对（每文件 ``` 计数为偶数）；`subgraph/alt/loop` 配对由真实解析器覆盖。**注**：`List~T~` 形态的 `~` 泛型共 22 处，其中 21 处位于 `classDiagram`（Mermaid 原生泛型语法，正确），仅 1 处落在 `java` 围栏（见 F-01）。

### 检查 3 · REQ 编号唯一性与连续性 —— 通过（12/12，表内零缺陷）

| 文件 | 域码 | 区间 | 条数 | 表内重复 | 缺口 | 缺「来源」 |
| --- | --- | --- | --- | --- | --- | --- |
| 13 | REQ-TEAM | 01–18 | 18 | 0 | 0 | 0 |
| 14 | REQ-TASK | 01–18 | 18 | 0 | 0 | 0 |
| 15 | REQ-GOAL | 01–25 | 25 | 0 | 0 | 0 |
| 16 | REQ-EVT | 01–24 | 24 | 0 | 0 | 0 |
| 17 | REQ-HOOK | 1–24 | 24 | 0 | 0 | 0 |
| 18 | REQ-PLG | 1–24 | 24 | 0 | 0 | 0 |
| 19 | REQ-PERS | 01–19 | 19 | 0 | 0 | 0 |
| 20 | REQ-WS | 01–20 | 20 | 0 | 0 | 0 |
| 21 | REQ-GIT | 01–19 | 19 | 0 | 0 | 0 |
| 22 | REQ-CLI | 01–21 | 21 | 0 | 0 | 0 |
| 23 | REQ-DSK | 01–30 | 30 | 0 | 0 | 0 |
| 24 | REQ-A2A | 11–34 | 24 | 0 | 0 | 0 |

全量跨文件出现（含 §③/§⑩/§⑪ 回引）中的「多次出现」经逐一核对均为**合法引用**（需求表 + DoD 清单 + 注册表引用），非重复定义。跨卷 REQ（`REQ-INT-3/4/6`、`REQ-CMP-15`）已在 `00-vision-and-product.md` 存量（第 23/24/26/52 行），有效。域码 padding 不一致见 F-05；22/23 的域码重划见 F-08。

### 检查 4 · I-决策一致性 —— 通过（12/12，双向 diff = 0）

| 文件 | 域 | 文件侧 | 台账 §2 | file-only | ledger-only |
| --- | --- | --- | --- | --- | --- |
| 13 | TEAM | 8 | 8 | 0 | 0 |
| 14 | TASK | 8 | 8 | 0 | 0 |
| 15 | GOAL | 9 | 9 | 0 | 0 |
| 16 | EVT | 9 | 9 | 0 | 0 |
| 17 | HOOK | 7 | 7 | 0 | 0 |
| 18 | PLG | 7 | 7 | 0 | 0 |
| 19 | PERS | 8 | 8 | 0 | 0 |
| 20 | WS | 8 | 8 | 0 | 0 |
| 21 | GIT | 9 | 9 | 0 | 0 |
| 22 | CLI | 9 | 9 | 0 | 0 |
| 23 | DSK | 6 | 6 | 0 | 0 |
| 24 | A2A | 8 | 8 | 0 | 0 |

12/12 文件 ≥3 条（区间 6–9）。`I-AG-7`（13:144）、`I-PLG-5`（17:38）为跨域**引用**，非本域登记，与台账 §1.1「引用他域只做引用、不重复登记」一致，判定合规。

### 检查 5 · 交叉引用有效性 —— 通过（外部引用 0 悬空）；内部 `§` 引用 7 处悬空（F-03）

- `卷 NN` / `impl/NN`：全部 NN ∈ 00–35，Phase A 卷与 impl 文件均存在，**0 悬空**。
- `NN-*.md` 文件引用：多根解析后 0 悬空。3 处形似悬空（`specs/v2/session.md` 16:91、`docs/architecture.md` 16:106、`docs/tui-capabilities.md` 24:108）经查均为**反引号内竞品仓路径引用**（OpenCode / DeepSeek / MiniMax 源码证据），非本仓交叉引用，判非缺陷。
- 决策号：`D-` 468 处（Phase A 区间校验 + `D-<域>I-n` 同文件 `###`/表行锚点）、`L-` 227 处（对 `LESSONS-AND-ADOPTIONS.md` 的 86 个有效 id 集）、`H-` 59 处（对 H-001…H-020）、`X-` 6 处（台账 §4 共 81 条建议）——**0 悬空**。
- 附录：`附录 B §B.1/2/7/8/9/10/11` 全部命中 `appendix-b-interface-contracts.md` 的 `## B.1…B.12`；`附录 A §A.1`（14:83）、`附录 C`（23:867）有效。
- 内部 `§` 引用：**7 处悬空**（详见 F-03）；另 1 处指代不明（F-09）。

### 检查 6 · 格式与占位 —— 通过

- 严格词表命中 **0**（`TODO` / `FIXME` / `待填` / `TBD` / `待补充` / `待定` / `WIP`）。
- `##` 级段落实行数 <5 的**空段 = 0**。（初次扫描报出的 100+ 条为误报：`##` 父节内容位于其 `###` 子节中，改用「到下一个 `##` 为止」口径后归零。）
- `占位` 字样 17 处全部为**合法用法**：`占位符`（SLF4J `{}` 纪律表述）或 `SIMULATED 占位`（账本状态取值），非占位标记。
- 围栏配对全部为偶数（13 号文件 24 个、其余同量级），无未闭合代码块。

### 检查 7 · Java 规范抽样 —— 通过（25 块 / 1,354 行），1 处硬缺陷（F-01）

| 规则 | 命中 |
| --- | --- |
| `log.*(e.getMessage())` | 0 |
| `System.out.println` / `printStackTrace()` | 0 |
| 裸抛 `RuntimeException` / `IllegalArgumentException` / `NullPointerException` / `IllegalStateException` | 0 |
| `LoggerFactory.getLogger` | 0 |
| 日志字符串拼接（`log.*("…" + v)`） | 0 |
| 类/接口/enum/record 声明缺 JavaDoc | 0 |
| 条件/`TimeUnit`/`sleep` 魔法数字 | 0 |
| `@Slf4j` 缺失（有 `log.*` 却无注解） | 0 |

抽样覆盖：13、14、17、18、19、20 各 3 块；20 为 4 块；15、16、21、24 各 1 块（该 4 文件全文各仅 1 个 java 块，已 100% 覆盖而非抽样）；22 为 2 块；**23（Electron/Vue）无 java 块**，其 2 个 TypeScript 块（77 行）经同规则扫描 0 命中，Java 规范抽样对 23 判 N/A（见 F-10）。
一处 `@Transactional` 缺失告警（18:491 `RegistrationScope`）经复核为**误报**：该类显式声明「内核域，零 Spring 依赖」，按 `agents.md` 依赖铁律不得引入 Spring 事务注解，判合规。事务/外部调用纪律在正文以「写路径 `@Transactional(rollbackFor = Exception.class)`、外部调用经 `AFTER_COMMIT` 异步化」显式声明（13:456、14:825、24 等）。

---

## 三、发现清单（文件:行 + 证据 + 严重度）

| ID | 严重度 | 位置 | 证据 | 处置 |
| --- | --- | --- | --- | --- |
| F-01 | **高** | `impl/13-agent-teams-impl.md:453` | `public record ReviewTopology(…, List~MemberId~ reviewers, …)` —— `java` 围栏内出现 Mermaid 泛型记法，非法 Java、无法编译 | **已修复**（见 §四） |
| F-02 | 中 | `19:350,360,401,409,437,445,461,469`；`20:415,454,462,489,498,525,532`；`24:366,376,385,423,431,462,470,499` | 统一业务异常类名分裂：本 3 份用 `HarnessException`（25 处），而 13/14/15/16/17/18/21/22 及其余 12 份 impl 用 `BusinessException`（88 处）。且 `19:469` 引证「附录 B §B.11」，但该节为**错误码全表**，未定义任何异常类名；全套冻结文档（卷 00–35 / DECISIONS / 附录）**0 处**命名异常类 → 属契约缺口 | 报告；建议登记 X-n 并统一为 `BusinessException`（多数派 + `.qoder/rules/exception-handling-rules.md` 明文） |
| F-03 | 中 | `13:4` `13:456` `15:42` `20:36` `23:7` `23:109` `24:8` | 内部 `§` 引用悬空 7 处，均为**确定的邻近目标**：13:4 `§⑩.8`→`§⑩.6`（13 §⑩ 仅 10.1–10.6）；13:456 `§⑨.4`→`§⑨.3`（§⑨ 仅 9.1–9.3，9.3 即 `TeamProperties` 配置项）；15:42 `§⑥.5`→`§⑥.4`（§⑥ 仅 6.1–6.4，6.4 即熔断与恢复）；20:36 `§⑥.6`→`§⑥.5`（§⑥ 仅 6.1–6.5，6.5 即断线重连）；23:7 / 23:109 `§⑩.9`→`§⑩.8`；24:8 `§⑩.9`→`§⑩.8`（§⑩ 无 10.9，10.8 即依赖修订与建议） | 报告（未修，理由见 §五） |
| F-04 | 中 | `impl/24-a2a-gateway-impl.md` §⑩ | 小节号跳号：`### 10.3 性能预算` → `### 10.5 安全`，**§10.4 缺失**；全文（含引用）0 处出现 `10.4` | 报告（涉及 4 个小节重编号，非安全修复） |
| F-05 | 中 | `13/14/15/16/19/20/21/22/23` §② | REQ 序号 padding 与 Phase A 冻结契约不一致：impl 用 2 位（`REQ-TEAM-01`），Phase A 全卷与 impl 17/18/24 用不定长（`REQ-TEAM-1`，见 `13-agent-teams.md:5`、`00-vision-and-product.md:378,409,457`）。同一需求两种拼写（`REQ-TEAM-1` ≠ `REQ-TEAM-01`）→ 追溯类查询失配 | 报告；建议统一为**不定长**（对齐冻结层）或反向统一并在 README 声明 |
| F-06 | 低 | `16:374` | `public enum Sensitivity { NORMAL, INTERNAL, SENSITIVE }` 三要素全缺（无 `code`/`desc`/`of()`），但 `oc_event_log.sensitivity`（16:665）为持久化列且驱动访问过滤 | 报告；违反 `constant-extraction-rules.md` §2 |
| F-07 | 低 | `16:364` `17:511` `18:443` | `EventCategory` / `HookCapability` / `StabilityLevel` 有 `code`+`desc` 但缺 `of(String)` 工厂（均需从持久化 code 反解析） | 报告 |
| F-08 | 低 | `14:461` `13:422,429,434` | `DependencyType` / `TeamMessageType` / `DeliverySemantic` / `CapabilityMode` 样例中省略 `code`/`desc` 字段与 `of()`（13:418 正文已声明「均含 `code` + `desc` 与 `of(String)` 工厂」，属简写）；`15:383,426` `TerminationReason` / `VerdictValue` 为纯内存派生枚举，可豁免 | 报告（可选：补齐 `of()` 以自洽可编译） |
| F-09 | 低 | `19:701` | 引「附录 A §4」指代不明：`appendix-a-domain-model.md` 无 `§4`，最近候选为 `A.4 状态机清单` 或 `A.8 索引与分区设计`（上下文谈分区与归档，倾向后者） | 报告 |
| F-10 | 低 | `impl/23-desktop-electron-vue-impl.md` | 无 `java` 代码块（前端工程），Java 规范抽样在本文件不适用；其 2 个 TS 块合规 | 报告（范围说明） |
| F-11 | 低 | `impl/22-cli-tui-impl.md:80`；`impl/23-desktop-electron-vue-impl.md:86` | REQ 域码相对卷 22 重划（Phase A 用 `REQ-UI-*`，impl 拆分 `REQ-CLI-*` / `REQ-DSK-*`），仅在「来源」列以 §节号承载映射，无 REQ 级映射表 | 报告；建议在 §② 表下补一行域码映射声明 |

---

## 四、已应用的修复（before / after）

| # | 文件:行 | before | after | 依据 |
| --- | --- | --- | --- | --- |
| 修复 1 | `impl/13-agent-teams-impl.md:453` | `public record ReviewTopology(PlanRef plan, MemberId subject, List~MemberId~ reviewers, int quorum) implements TopologySpec { }` | `public record ReviewTopology(PlanRef plan, MemberId subject, List<MemberId> reviewers, int quorum) implements TopologySpec { }` | `java` 围栏内非法泛型记法；同文件 §⑤ 其余 record 与 `classDiagram` 均用 `List<…>`，目标形态唯一、无歧义。修复后复检：13 号文件 8 图 Mermaid 全 OK、围栏 24 个（偶数）、java 块结构完整 |

**未新增/删除任何内容**；未改动任何 `I-` 决策编号；未触碰 12 份文件以外的任何文件（仅新建本报告目录与文件）。

---

## 五、未修复项的处置理由

1. **F-03（7 处 `§` 悬空）**：本轮 SAFE 修复白名单为「畸形 Mermaid、重复 REQ id、空段补全、占位文案、缺失小节标题」。`§` 引用错指**不属于**上述任一类别，且无法排除作者本意为「应补写 §⑩.9/§⑥.5 等小节」而非「引用写错」。按镜头要求（检查 5 明示「报告悬空项 file+line」）**只登记**。上表已给出每处的唯一邻近目标，下一次迭代可一步改正。
2. **F-02（异常类名分裂）**：改名将波及本 3 份 25 处，且 12/27/28 等 12 份以外的 impl 文件同样使用 `HarnessException`（另有 3 份），超出本文件集范围；须先由作者裁决统一名并登记契约缺口（X-n）。
3. **F-04 / F-05**：均为**编号体系**变更（重编号 4 个小节 / 改写 ~150 处 REQ id），会与已发布引用冲突，属作者裁决项。
4. **F-06 ~ F-11**：为规范符合性与一致性建议，不构成「错误」，留待作者确认口径（是否对非持久化/纯内存枚举豁免 `of()`）。

---

## 六、复核结论（本轮）

- 11 节模板 **12/12 通过**；Mermaid **103/103 解析通过、0 失败**；REQ 表内 **0 重复 / 0 缺口 / 0 缺来源**；I-决策与台账 **双向 diff = 0**；外部交叉引用（卷 / 文件 / D- / L- / H- / X- / 附录）**0 悬空**；占位词表与空段 **均 0**；Java 规范机械规则 **0 命中**，声明 JavaDoc 覆盖 **100%**。
- 缺陷 11 项：**高 1（已修复）**、中 4（1 例外为报告）、低 5、范围说明 1。
- 机械层判定：**本 12 份实现方案在可自动校验维度上达到可提交状态**；`F-02/F-03/F-04/F-05` 4 项需作者裁决后再进入下一轮编号一致性复核。
