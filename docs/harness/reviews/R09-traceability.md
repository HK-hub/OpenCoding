# R09 · 目标可追溯性审计（原始需求 → 交付物 逐条映射）

> 轮次：R09（Phase B 自审查第 9 轮）· 镜头：目标可追溯性审计——把原始 objective 的显式要求逐条映射到交付物，全部以实跑命令取证。
> 取证时间：2026-09-21 · 环境：Git Bash（win32）+ node v24.16.0 + `mermaid@11` + JSDOM（本地 `.research-cache/mmd-check/check.mjs`，无外发）。
> 范围：`docs/harness/` 全树（R09 取证时点 153 个 Markdown；本文件落盘后 154）。本轮只改 `README.md`（索引行）、`AUDIT.md`（计数刷新 + §8）并新增本文件；卷册/impl/组件类文件的缺口一律登记不就地改。

## 〇、结论摘要（先读）

| 指标 | 值 |
| --- | --- |
| 矩阵行数 | **36**（行 1–32 产品/功能/技术面；行 33–36 研究与实现面） |
| 直接达标行 | **34**；⚠️ 行 33/36（迭代轮次与最终自审 10 遍未达） |
| 声明核验 | 图数量声明 ✅ / 竞品 REQ 抽样 8/8 ✅ / Phase B R1–R8 登记声明 **❌（实为 R1–R3 + 占位）** / reviews 20/20 非空 ✅ |
| 弱覆盖项 | **4**（W1 轮次登记缺口 · W2 组件方案索引孤岛 · W3 Phase B 台账漂移 · W4 Phase A 遗留 4/12 轮） |
| 本轮修改 | `README.md`（索引行）、`AUDIT.md`（计数刷新 + §8）、本文件 |

## 一、审计方法（可复核口径）

| 口径 | 命令 / 规则 |
| --- | --- |
| 文件存在性 | 逐行 `ls <卷> <impl/NN> <Cxx 组件文件>`，统计 `files=N/N` |
| 图块计数 | `grep -c '```mermaid' FILE`（原始提及）；解析验证用 `check.mjs`（`line.trim().startsWith('```mermaid')` 围栏块 → `mermaid.parse()`） |
| 竞品增量 REQ | REQ 定义行（`^\| REQ-`）且该行含 `[E1]–[E4]` 证据标签或「竞品」字样（与 `impl/README.md` §1.2/§5.1「≥2 条竞品增量 REQ」门槛对照） |
| 台账计数 | `grep -c '^### H-' DECISIONS.md`、§2 域行「数量」列求和、`grep -oh 'I-[A-Z0-9]*-[0-9]\+' impl/*.md \| sort -u \| wc -l`、`grep -cE '^\| X-[0-9]+' impl/IMPL-DECISIONS.md` |
| 解析验证 | `node check.mjs <全树 153 个 md>` → **total=605 / fail=0**（611 处 grep 提及中有 6 处为行内文本/命令示例，非围栏块） |

图块解析分层实测：components 186 / impl 306 / research 44 / 根+附录 68 / reviews 1 = 605，全部 PASS。

## 二、可追溯矩阵（36 行）

### A. 第一段：产品/功能/技术面（行 1–32）

| # | 需求原文要点 | 承诺交付 | 实际文件（实测） | 校验命令与实测值 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 1 | 对标 codex / claude code / qoder / deepseek harness（+ opencode / grok build / minimax cli 等） | 卷 00 §4 对标（4 主 + 5 次）+ research 9 家源码级报告 | `00-vision-and-product.md` §4.1/§4.2；`research/competitors/01…09`（含 02-opencode、05-minimax、06-grok） | `ls research/competitors/*.md \| wc -l`=**9**；卷 00 提及 claude/codex/qoder/deepseek=15/10/5/7 | ✅（grok/minimax 仅研究层覆盖：卷 00 §4.2 五家为 Cursor/Cline/opencode/Aider/Gemini） |
| 2 | 功能/设计/技术路径「最全面」制定 | 36 卷 + 卷 27 技术路径 + 每卷 10 节骨架 | 00–35 全 36 卷 | `ls [0-3][0-9]-*.md \| wc -l`=**36**；`grep -l '分支' [0-3]*.md \| wc -l`=**34**（M×N 分叉面） | ✅ |
| 3 | 不询问用户；M×N 平行多分支（决策台账 + 备选档案） | `DECISIONS.md` + `ALTERNATIVES.md` + 各卷 §3 | H 20 条 + 域内 400 条 = 420；ALTERNATIVES：H 行 20 + Top30 + §3 切换规程 | `grep -c '^### H-'`=**20**；域行求和=**400**；`grep -cE '^\| H-' ALTERNATIVES.md`=**20**；`grep -c '不询问' README.md`=2（默认执行条款） | ✅（Phase B `I-` 台账漂移见 W3） |
| 4 | 唯一最佳方案比选方法（功能全/UX/落地稳/企业可维护） | README §4：权重 30/20/25/25 + 并列决胜 F>S>M>U | `README.md` L104–113；各卷「选定（F=9 U=8 S=9 M=9 → 88）」 | `grep -n 'F > S > M > U' README.md`=**L113**；`grep -c '选定' 05-tool-system.md`=6（抽样） | ✅ |
| 5 | 技术栈 Java / Spring Boot / Electron / Vue / Redis / PostgreSQL | 卷 01 §4.4 技术基座表 | `01-harness-architecture.md` §4.4（L261） | 关键词计数：Java=4、Spring=4、Electron=4、Vue=3、Redis=15、PostgreSQL=2 | ✅ |
| 6 | CLI 与桌面端同源双端 | 卷 01 §4.3 + 卷 22 + impl/22 + impl/23 | `22-clients-cli-desktop.md`；`impl/22-cli-tui-impl.md`；`impl/23-desktop-electron-vue-impl.md` | `files=3/3, mermaid_sum=23`（Electron=5 / Vue=5 / TUI=9） | ✅ |
| 7 | 自封装 LLM 接入层 | 卷 02 + impl/02 + 组件 C06/C07 | `02-model-gateway.md`；`impl/02`；`C06-model-router`、`C07-model-adapter-family` | `files=4/4, mermaid_sum=19` | ✅ |
| 8 | 工具系统 | 卷 05 + impl/05 + C08/C09 | `05-tool-system.md`；`impl/05`；`C08-tool-registry`、`C09-tool-executor` | `files=4/4, mermaid_sum=18` | ✅ |
| 9 | 权限系统 | 卷 06 + impl/06 + C10/C11 | `06-permission-system.md`；`impl/06`；`C10-permission-engine`、`C11-approval-orchestrator` | `files=4/4, mermaid_sum=23` | ✅ |
| 10 | skill 系统 | 卷 08 + impl/08 + C13 | `08-skill-system.md`；`impl/08`；`C13-skill-registry` | `files=3/3, mermaid_sum=14` | ✅ |
| 11 | mcp 系统 | 卷 09 + impl/09 + C14/C15 | `09-mcp-system.md`；`impl/09`；`C14-mcp-client-manager`、`C15-mcp-server-exporter` | `files=4/4, mermaid_sum=22` | ✅ |
| 12 | context 系统 | 卷 03 + impl/03 + C03/C04 | `03-context-system.md`；`impl/03`；`C03-context-assembler`、`C04-compaction-engine` | `files=4/4, mermaid_sum=19` | ✅ |
| 13 | memory 系统 | 卷 10 + impl/10 + C16 | `10-memory-system.md`；`impl/10`；`C16-memory-manager` | `files=3/3, mermaid_sum=18` | ✅ |
| 14 | agent（sub-agent / multi-agent） | 卷 12 + impl/12 + C02/C18 | `12-agent-core.md`（subagent 相关行 =14）；`impl/12`；`C02-agent-loop`、`C18-subagent-router` | `files=4/4, mermaid_sum=21` | ✅ |
| 15 | task 系统 | 卷 14 + impl/14 + C20 | `14-task-and-plan.md`；`impl/14`；`C20-workitem-engine` | `files=3/3, mermaid_sum=16` | ✅ |
| 16 | plan to do 系统 | 卷 14 §4.1/§4.4/§4.5（Plan 层与规格文件） | 与行 15 同文件共享（无独立文件） | 同 15 | ✅（共享卷，设计口径） |
| 17 | goal 目标模式 | 卷 15 + impl/15 + C21 | `15-goal-and-schedule.md`（Goal=13）；`impl/15`；`C21-goal-scheduler` | `files=3/3, mermaid_sum=15` | ✅ |
| 18 | schedule 计划模式 | 卷 15 §4.4（五类触发器） | 与行 17 同文件共享 | `grep -c 'Schedule' 15-*.md`=6 | ✅（共享卷） |
| 19 | 知识库 | 卷 11 + impl/11 + C17 | `11-knowledge-system.md`；`impl/11`；`C17-knowledge-indexer` | `files=3/3, mermaid_sum=15` | ✅ |
| 20 | 全生命周期事件 | 卷 16 + impl/16 + C22 | `16-event-system.md`；`impl/16`；`C22-event-bus` | `files=3/3, mermaid_sum=15` | ✅ |
| 21 | 高度插件化 | 卷 18 + impl/18 + C24 | `18-plugin-extension.md`；`impl/18`；`C24-plugin-loader` | `files=3/3, mermaid_sum=14` | ✅ |
| 22 | 持久化迁移/恢复 | 卷 19 + impl/19 + C25/C26 | `19-persistence-migration-recovery.md`；`impl/19`；`C25-recovery-coordinator`、`C26-migration-runner` | `files=4/4, mermaid_sum=22` | ✅ |
| 23 | hooks | 卷 17 + impl/17 + C23 | `17-hooks-system.md`；`impl/17`；`C23-hook-engine` | `files=3/3, mermaid_sum=14` | ✅ |
| 24 | 提示词管理 | 卷 04 + impl/04 + C05 | `04-prompt-system.md`；`impl/04`；`C05-prompt-assembler` | `files=3/3, mermaid_sum=14` | ✅ |
| 25 | agent teams | 卷 13 + impl/13 + C19 | `13-agent-teams.md`；`impl/13`；`C19-team-orchestrator` | `files=3/3, mermaid_sum=16` | ✅ |
| 26 | worktree 隔离 | 卷 21 §4.1/§4.3 + impl/21 + C28 | `21-git-and-worktree.md`；`impl/21`；`C28-git-worktree-manager` | `files=3/3, mermaid_sum=17` | ✅ |
| 27 | 沙箱安全 | 卷 07 + impl/07 + C12 | `07-sandbox-security.md`；`impl/07`；`C12-sandbox-runner` | `files=3/3, mermaid_sum=16` | ✅ |
| 28 | 工作区（本地/SSH 等） | 卷 20 + impl/20 + C27 | `20-workspace-system.md`；`impl/20`；`C27-workspace-provider-manager` | `files=3/3, mermaid_sum=18` | ✅ |
| 29 | git | 卷 21（提交/合并队列/护栏）+ impl/21 | 与行 26 同文件共享 | 同 26；impl/21 图=9 | ✅（共享卷） |
| 30 | Agent2Agent（接入或被调用） | 卷 23 + impl/24 + C31 | `23-agent2agent-interop.md`；`impl/24-a2a-gateway-impl.md`；`C31-remote-agent-gateway` | `files=3/3, mermaid_sum=18` | ✅（编号偏移已在 impl/README §2 登记） |
| 31 | 完整 Harness 架构与功能特性 | 卷 01 + 卷 00 §5（35 域 386 项）+ 12/16/18/26 | `00-vision-and-product.md` §5.01–5.35 | `grep -cE '^### 5\.[0-9]+ D[0-9]{2}' 00-*.md`=**35**；`grep -c '386'`=2 | ✅ |
| 32 | 前沿探索 | 卷 25（五级阶梯 + 12 方向）+ impl/35 | `25-frontier-exploration.md` §3；`impl/35-frontier-prototypes-impl.md` | `grep -cE '^### ' 25-*.md`=**12**；`files=2/2, mermaid_sum=8` | ✅ |

### B. 第二段：研究与实现面（行 33–36）

| # | 需求原文要点 | 承诺交付 | 实际文件（实测） | 校验命令与实测值 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 33 | 自审查/补全/扩展迭代（Phase A ≥20 遍 + Phase B ≥10 遍） | `ITERATIONS.md`（Phase A 25 轮 + Phase B 表）+ `reviews/` | Phase A 25 轮齐；Phase B findings 20 份（R1–R7） | `grep -cE '^\| [0-9]+ \|' ITERATIONS.md`=**25**；Phase B 表 `grep -cE '^\| R[0-9]'`=**4**（R1/R2/R3 + 「R4+」占位）；`ls reviews/*.md \| wc -l`=**20** | ⚠️ Phase A ✅；Phase B **7/10 轮**（本 R09 落盘后 8 轮，R8 空缺）且 R4–R7 未登记 |
| 34 | 竞品联网深度调研、源码级探索、深度科研报告 | `research/` 12 份（9 家报告 + 交叉对比 + 采纳台账 + 规划） | 9 份报告按 10 节固定骨架；`.research-cache/` 19 项（openai-codex、deepseek-harness、gemini-cli、aider、cline、MiniMax 等） | `[E1]` 逐份=173/351/220/207/197/109/50/156/342，合计 **1805**（`[E1]–[E4]` 合计 2414；外部链接 175 处）；`grep -cE '^\| L-[0-9]{3}'`=**93** | ✅（8/9 报告 [E1]≥100，超配 DoD「≥3 家 E1」） |
| 35 | 每个组件/系统/manager/插件核心流程单独技术方案（功能需求 + 流程 + 时序图 + 类图 + 架构图） | 35 份系统 impl + 36 份组件级方案 + 附录 D 137 组件落点 | `impl/01…35`（16,101+ 行）；`impl/components/C01…C36`（合计 16,101 行）；`appendix-d` | impl 每份图=7…11（min **7** ≥5）；组件每份图=4…7（min **4** ≥4）；35/35 含 flowchart+classDiagram+sequenceDiagram（seq min=3）；`grep -cE '^\| [KPETX]-[0-9]+.*impl/[0-9]{2}'`=**137/137** | ✅（结构达标；组件无总索引与 137↔36 映射，见 W2） |
| 36 | 最终自我审查 10 遍以上 | `reviews/` ≥10 轮 + `ITERATIONS.md` Phase B 登记 | 与行 33 同源证据 | `ls reviews/ \| grep -c '^R0[1-8]'`：R1 4 / R2 4 / R3 4 / R4 2 / R5 2 / R6 2 / R7 2 / R8 **0** | ⚠️ 同 W1：7 轮（+R09 = 8），未达 ≥10 |

## 三、四项专项声明核验（逐项给出真值）

### 3.1 「每个 impl ≥5 图；每个组件 ≥4 图；共 36 个组件文件」

| 声明 | 实测 | 结论 |
| --- | --- | --- |
| impl 每份 ≥5 图 | 35 份逐份计数：min=**7**（impl/04、05、31、35），max=11 —— 全量 ≥7 | **成立（超配）** |
| 组件每份 ≥4 图 | 36 份逐份计数：min=**4**（C03/C04/C07/C08/C13/C14/C33/C34），max=7 | **成立** |
| 组件文件共 36 份 | `ls impl/components/*.md \| wc -l`=**36**（C01–C36，无 README） | **成立** |
| 解析验证 | `node check.mjs`（全树 153 文件）：**605 块 / 0 FAIL**；分层 components 186、impl 306、research 44、根+附录 68、reviews 1（另 6 处为行内提及非围栏块） | **成立** |

**图数量逐文件实测（供复核）**

- impl（35 份，格式 `文件名=图数`）：01=8、02=8、03=8、04=7、05=7、06=8、07=8、08=8、09=10、10=11、11=9、12=8、13=9、14=8、15=8、16=8、17=8、18=8、19=10、20=10、21=9、22=10、23=11、24=10、25=9、26=9、27=8、28=9、29=8、30=10、31=7、32=10、33=9、34=11、35=7 → 合计 **306**，min=7。
- 组件（36 份）：C01=5、C02=6、C03=4、C04=4、C05=5、C06=5、C07=4、C08=4、C09=5、C10=6、C11=7、C12=7、C13=4、C14=4、C15=6、C16=5、C17=5、C18=5、C19=6、C20=6、C21=5、C22=5、C23=5、C24=5、C25=5、C26=5、C27=6、C28=6、C29=5、C30=5、C31=6、C32=7、C33=4、C34=4、C35=5、C36=5 → 合计 **186**，min=4。
- 图类型结构（行 35 之「时序图 + 类图 + 架构图」承诺）：35/35 impl 份同时含 `flowchart`（架构）=1–3、`classDiagram`=1–2、`sequenceDiagram`=3–6；`stateDiagram` 35/35 份均有（1–4）。

### 3.2 「每份 impl 含 ≥2 条竞品增量 REQ」（抽样 8 份）

命令：`grep -E '^\| REQ-' <file> | grep -cE '\[E[1-4]\]|竞品'`

| 抽样文件 | 竞品增量 REQ 行 | 命中 |
| --- | --- | --- |
| impl/01-kernel-runtime-impl.md | 6 | ✅ |
| impl/05-tool-system-impl.md | 9 | ✅ |
| impl/12-agent-runtime-impl.md | 9 | ✅ |
| impl/18-plugin-runtime-impl.md | 12 | ✅ |
| impl/23-desktop-electron-vue-impl.md | 15 | ✅ |
| impl/28-distribution-telemetry-impl.md | 5 | ✅ |
| impl/31-automation-library-impl.md | 6 | ✅ |
| impl/35-frontier-prototypes-impl.md | 12 | ✅ |

抽样 **8/8 命中**；全量 35/35 最低 5 条（无未命中），远高于门槛 2。

### 3.3 「ITERATIONS.md Phase B 段落已登记 R1–R8」

**声明不成立。** 实测：Phase B 表仅 **4 行** = R1 / R2 / R3 三行明细 + 「R4+ 待编排」占位行；不存在 R4–R8 明细登记。而 `reviews/` 中 R4–R7 的 findings 文件（各 2 份）**已实际产出**——登记落后于产出。缺登记轮次：**R4、R5、R6、R7**；缺产出轮次：**R8**（无文件、无登记）。表头与正文（L252）仍写「R1–R3……共 11 份」，为 R03 时点旧值。

### 3.4 `reviews/` 逐份清单（20/20 存在且非空）

| 文件 | 行数 | 字节 | 文件 | 行数 | 字节 |
| --- | --- | --- | --- | --- | --- |
| R01-scope-research-phaseA.md | 145 | 16850 | R03-scope-enterprise.md | 101 | 14112 |
| R01-scope-kernel.md | 151 | 10604 | R04-scope-security-kernel.md | 169 | 21653 |
| R01-scope-collab.md | 170 | 15596 | R04-scope-security-collab.md | 138 | 23341 |
| R01-scope-enterprise.md | 157 | 15651 | R05-scope-recovery.md | 136 | 22078 |
| R02-scope-research.md | 163 | 19045 | R05-scope-data.md | 136 | 21633 |
| R02-scope-kernel.md | 98 | 15165 | R06-scope-enterprise.md | 148 | 19544 |
| R02-scope-collab.md | 110 | 15747 | R06-scope-ux.md | 138 | 20592 |
| R02-scope-enterprise.md | 104 | 18010 | R07-scope-build-kernel.md | 142 | 19966 |
| R03-cross-corpus.md | 128 | 21427 | R07-scope-build-platform.md | 158 | 18148 |
| R03-scope-kernel.md | 103 | 12040 | R03-scope-collab.md | 114 | 14787 |

汇总：20/20 存在且非空（合计 2,709 行 / 355,989 字节）；轮次覆盖 R1–R7，**R8 为 0 份**。

## 四、弱覆盖清单（按严重度排序）

| 排序 | 弱项（行号） | 证据 | 影响 |
| --- | --- | --- | --- |
| W1 | 行 33 + 行 36：Phase B 自审查轮次 | findings 7 轮（20 份）对目标 ≥10 轮；`ITERATIONS.md` Phase B 表只登记 R1–R3 + 占位；R8 空缺。本 R09 落盘后为 8 轮 | 目标「≥10 遍」未达标（缺 ≥2 轮）；「迭代可追溯」链条在 R4–R7 断档 |
| W2 | 行 35：组件级方案可追溯性 | `impl/components/` 36 份文件在目录外 **0 处被引用**（`grep -rl 'components/C'` 无命中；README §2 / impl/README §2 / 附录 D 均未登记）；C 文件内部含附录 D 组件码（36/36），但无反向映射与 C↔137 映射表 | 36 份组件方案为「索引孤岛」，无法从任一总索引找到；组件完备性口径（137 vs 36）无法机械对账 |
| W3 | 行 3（Phase B 侧）：决策台账口径漂移 | `I-` 实测唯一 **277** 条 vs 台账登记 **268**（9 条未登记：I-AG-9、I-CLI-10…12、I-GIT-10、I-UX-10…12、I-WS-9）；`impl/README.md` §2 图数表 **296** / 正文 **298** vs 实测 **306**；REQ 合计 **817** vs 实测 **829**；AUDIT 词句 X- 81 vs 台账实有 **82** 行（X-82 已入表） | 违反 impl/README §5.2「以台账为准」硬约束；审计数字与索引数字三处互不一致 |
| W4 | 行 33（Phase A 遗留）：轮次 4/12 无独立落地小节 | `ITERATIONS.md` L130–131 自登记「仅轮次表摘要」；R01 已登记未补 | Phase A 追责链缺 2 轮文件级证据（低危，已暴露） |
| W5 | 行 16/18/29：共享交付行 | plan/schedule/git 与 task/goal/worktree 共享卷与 impl 文件（设计口径，非缺口） | 无需修复，保留注记 |

**W1–W4 取证原文（可复核）**

```
$ grep -cE '^\| R[0-9]' ITERATIONS.md
4                      # R1 / R2 / R3 / R4+占位 —— 无 R4–R8 明细行
$ ls reviews/ | grep -c '^R0[4-7]'
8                      # R04×2 + R05×2 + R06×2 + R07×2（已产出未登记）
$ ls reviews/ | grep -c '^R08'
0                      # R8 无文件
$ grep -rl 'components/C' --include='*.md' . | grep -v 'impl/components/'
(空)                   # W2：36 份组件方案在目录外 0 引用
$ grep -oh 'I-[A-Z0-9]*-[0-9]\+' impl/*.md | sort -u | wc -l
277                    # vs IMPL-DECISIONS 台账 268（差值 9 条）
$ grep -cE '^\| X-[0-9]+' impl/IMPL-DECISIONS.md
82                     # vs AUDIT/impl README 词句「X-81」
$ grep -c '```mermaid' impl/*-impl.md | awk -F: '{s+=$2} END {print s}'
306                    # vs impl/README §2 表 296 / 正文 298
```

## 五、缺口与修复计划

**本轮已修（仅限允许范围）**

1. `README.md`：§2 卷册地图补 `impl/components/` 行（36 份组件级方案）；reviews 行刷新为 R1–R7 共 20 份；ITERATIONS 行与脚注（11 份 → 20 份）刷新；§5 覆盖表补「组件级方案」行。
2. `AUDIT.md`：§2 计数（文件 153/150、图 605、REQ 829、I- 277、X- 82、reviews 20）与 §7 B2/B3/B4/B5 行刷新；新增 §8「Phase B 目标可追溯矩阵（R09 实测）」。
3. 本文件：36 行矩阵 + 4 项声明核验 + 弱覆盖清单落盘。

**待责任方修复（本轮登记不改，按序）**

1. `ITERATIONS.md`：Phase B 表补 R4–R7 明细行（引用各 2 份 findings）+「R4+ 待编排」改为「R8–R10 待排期」；表头「R1–R3」改「R1–R7」。
2. `impl/IMPL-DECISIONS.md`：登记 9 条未入账 `I-` 并把 §2/§3 总数 268 → 277 同步（硬约束）。
3. `impl/README.md`：§2 合计行 296/298 → 306；REQ 817 → 829；X- 81 → 82（与台账行数一致）。
4. `impl/components/`：补 README（36 份索引 + 写作模板 + C↔附录 D 编号映射表）；附录 D §D.7 增补「组件 → C 文件」列。
5. `ITERATIONS.md`：补 Phase A 轮次 4/12 落地小节（遗留）。
6. 流程建议：R10 起每轮产出后即时在 ITERATIONS Phase B 表登记（本次漂移根因是「先产出、后登记」未同步）。

## 六、结论

- 36 行原始需求**全部有交付物落点（36/36 ✅）**，其中 34 行直接达标、2 行（33/36）以「目标未达 + 缺口已登记」计为 ⚠️。
- 4 项专项声明：图数量（impl ≥5 / 组件 ≥4 / 36 份）**成立**；竞品增量 REQ 抽样 **8/8 成立**；Phase B「已登记 R1–R8」**不成立**（实为 R1–R3 + 占位，R4–R7 未登记、R8 缺）；`reviews/` 20/20 **存在且非空**。
- 弱覆盖共 4 项（W1–W4），全部已给可执行修复计划；W1（轮次登记）与 W3（台账漂移）为阻断「终局审计」的两项主因。
