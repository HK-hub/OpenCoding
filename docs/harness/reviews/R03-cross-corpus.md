# R03 · 跨语料：全局数字与术语一致性审计

> 执行轮次：Phase B 自审查 · 第 3 轮（lens = 全局数字与术语一致性 / cross-corpus）
> 审查范围：全树（卷 00–35、附录 A–D、`research/`、`impl/`、`reviews/`、索引文件）；**修改面仅限** `README.md`、`DECISIONS.md`、`AUDIT.md`、`ITERATIONS.md`、`appendix-*.md`、`research/`，本轮新建本文件。
> 取证方式：`grep` / `sed` / `node` + 现成 Mermaid 校验器 `.research-cache/mmd-check/check.mjs`（mermaid 11.17.2 + jsdom，逐文件独立进程）；**所有结论均带可复核命令或 file:line**。
> 行号说明：行号为 R03 取证时点；同批次并行的 R03 scope-kernel / collab / enterprise / research 轮可能同时修改 `impl/`，故本文件对 impl 的引用以「文件 + §节」为主、行号仅作定位参考。
> 结论摘要：全局数字台账 **10 组指标**逐条登记（**52 处 `file.md:line` 出处**，另含 §节级引用）；**冲突 10 项**（8 数字/口径 + 2 编号）——R03 复核时点已消解/已修 6 项（本轮索引侧「口径注」3 项 + 同批次并行轮修复 2 项 + 部分修复 1 项），仍开放 4 项（D6/D7/D8/D9，报告项）；术语核对 9 项，附录 C 新增 §C.6 补注、修 `research/competitors/02-opencode.md` 1 处；`AUDIT.md` 计数全量刷新并新增 §7 Phase B 段；`ITERATIONS.md` 新增 Phase B R1–R3 表；`DECISIONS.md` 增 Phase B 域编码与 §4 实现级台账指针。

---

## 1. 方法与可复现命令

| 用途 | 命令（仓库根执行） | 输出（本轮实测） |
| --- | --- | --- |
| 文件计数 | `find docs/harness -name "*.md" \| wc -l`；`ls docs/harness/*.md \| wc -l`；`ls docs/harness/research/competitors/*.md \| wc -l`；`ls docs/harness/impl/*.md \| wc -l`；`ls docs/harness/reviews/*.md \| wc -l` | 105（R03 新建前，含 archive 3）→ **108**（取证时点；同批次并行 R03 轮又新增 2 份 `R03-scope-*.md`）/ 45 / 9 / 37 / 8 → 11 |
| 决策计数 | `grep -c '^### H-' DECISIONS.md`；§2「数量」列 `awk` 求和；`grep -oh 'I-[A-Z0-9]*-[0-9]\+' impl/*.md \| sort -u \| wc -l`；`IMPL-DECISIONS.md` §4 表行计数 | 20 / 400（36 域行 + DOM 行共 37 数据行）/ 268 / 81 |
| REQ 计数 | Phase A：`grep -ohE '^\\| REQ-[A-Z0-9]+-[0-9]+' 0*.md 1*.md 2*.md 3*.md \| sed 's/^\\| //' \| sort -u \| wc -l`（唯一 id）；按文件去重求和（`for f ...`）；`awk '/^## 5\\./,/^## 6\\./' 00-*.md \| grep -cE '^\\| REQ-'`（能力矩阵行） | 443 唯一 / 607 行求和 / 卷 00 §5 = 386 行、35 个域小节 |
| REQ（impl） | `grep -oE '^\\| REQ-[A-Z0-9]+-I?[0-9]+' FILE \| sort -u \| wc -l` 逐文件求和 | 811（定义行）+8（同域正文引用）= 819；`impl/README.md` §2 表载 817 |
| Mermaid | `grep -c` 计数 mermaid 围栏（按目录求和）；`node .research-cache/mmd-check/check.mjs <files>` | 410 块（顶层 68 + research 44 + impl 298）；**410 PASS / 0 FAIL** |
| 图表类型 | `grep -hoE '^(sequenceDiagram\|classDiagram\|flowchart\|stateDiagram)' impl/*.md \| sort \| uniq -c` | 148 / 36 / 38 / 76（合计 298） |
| E1 密度 | `for f in research/competitors/*.md; do grep -o '\\[E1\\]' $f \| wc -l; done` | 9 份合计 1805 处 |
| 组件核验 | `grep -cE '^\\| [KPETX]-[0-9]+.*impl/[0-9]{2}' appendix-d-component-inventory.md`；分组行数逐段计数 | 137/137；K42/P33/E32/T16/X14 |
| 术语检索 | `grep -rn '<term>' README.md DECISIONS.md AUDIT.md ITERATIONS.md appendix-*.md research/` | 见 §5 |

---

## 2. 全局数字台账（指标 | 值 | 出处 | 冲突出处）

| # | 指标 | 值 | 出处（file:line） | 冲突 / 口径结论 |
| --- | --- | --- | --- | --- |
| N1 | CLI 冷启动目标 | ≤ 300ms（P95）；`oc run` 单命令 ≤ 350ms | `00-vision-and-product.md:713`（NFR-P-6）；`22-clients-cli-desktop.md:304`；`DECISIONS.md:55`（H-001 回退线）；`ALTERNATIVES.md:15`；`impl/01-kernel-runtime-impl.md:801`；`impl/22-cli-tui-impl.md:807`、`:935`；`impl/22-cli-tui-impl.md:808`（350ms） | ✅ 一致（`impl/22` §10.2 分解 180+60+60ms） |
| N2 | 内核/端内存上限 | 回退线 200MB（H-001）；桌面空闲 ≤ 350MB（NFR-P-7）；TUI 常驻 ≤ 120MB（Phase B） | `DECISIONS.md:55`；`ALTERNATIVES.md:15`；`impl/22-cli-tui-impl.md:37`、`:96`、`:809`；`00-vision-and-product.md:714`；`22-clients-cli-desktop.md:304`；`impl/23-desktop-electron-vue-impl.md:844`、`:853` | ⚠️ **D1**：200MB 标注「（卷 22 指标）」不成立——卷 22 无 200MB 指标（只有 350MB 桌面 / NFR-P-7）；CLI/TUI 侧 Phase B 为 120MB。处置：`DECISIONS.md` H-001 已加口径注；`ALTERNATIVES.md`（只读面）随 X-R03-1 提修订建议 |
| N3 | IPC 增量延迟 | 回退线 P95 > 50ms；本机协议往返 stdio ≤ 5ms / WS ≤ 20ms | `DECISIONS.md:66`（H-002）；`ALTERNATIVES.md:16`；`impl/01-kernel-runtime-impl.md:173`、`:803`；`impl/23-desktop-electron-vue-impl.md:140`、`:201`（>20 窗口 P95 IPC > 50ms）；`01-harness-architecture.md:435`（协议往返 ≤ 20ms） | ✅ 一致（预算是回退线内） |
| N4 | 上下文预算与压缩阈值 | 九区段默认占比 5/10/10/5/10/5/30/20/5%；软水位 80% 预警 / 硬 95% 触发；外置阈值 > 4k token；估算余量 ×1.1；压缩四级 | `03-context-system.md:137`–`:147`、`:155`、`:206`、`:210`；`impl/03-context-engine-impl.md:466`、`:473`、`:483`、`:674`、`:681` | ✅ 一致（impl 以 0.80/0.95、4096/32768 落地） |
| N5 | 会话并发模型与单飞 | 会话级单飞 + 四种队列策略（queue/interrupt/reject/coalesce）；单实例活跃 ≥ 50、server ≥ 500 | `00-vision-and-product.md:716`（NFR-P-9）；`01-harness-architecture.md:93`；`impl/01-kernel-runtime-impl.md:55`、`:175`、`:771`、`:812`、`:900`；`31-capacity-and-cost.md:129`（10k 峰值 ≈ 500） | ⚠️ **D6**（impl 内部，仍开放）：`impl/01` §10.3 容量估算「server 档 5000 会话」vs §9.5 配置默认 `max-active-server=500` 与 NFR-P-9 —— 10× 口径差，建议标「横向扩展上界」（R03 复核时点仍为 5000） |
| N6 | 10k 用户容量结论 | 事件 3.0×10⁷/天（`U×T×E_r`=10k×50×60）；冷存 3.8TB/年；热数据 2TB 基准；并发活跃 ≈ 500；事件 EPS 峰值 ≈ 4.2k（NFR-P-4 ≥ 50k 余量足） | `31-capacity-and-cost.md:110`、`:113`、`:119`、`:129`、`:131`；`ITERATIONS.md:157`（轮次 5 同口径）；`impl/01-kernel-runtime-impl.md:817`；`impl/16-event-bus-impl.md:832`（已对齐）；`impl/25-enterprise-iam-audit-impl.md:854`；`impl/26-quota-cost-impl.md:836` | ✅ **D2 已消解**：R03 取证时发现 `impl/16` 旧稿「5e6 事件/天」与卷 31 差 6×；同批次 R03 并行轮已按卷 31 改写（“规模对齐卷 31 §4.1：10k × 50 轮 × 60 事件 ≈ 3.0×10⁷/天”），R03 复核通过 |
| N7 | 审计写入延迟 | 事件写入 P95 ≤ 10ms（SLO）；审计写入异步、不阻塞主流程 | `24-enterprise-operations.md:223`（§4.7 SLO 表）、`:323`（§7 性能）；`impl/25-enterprise-iam-audit-impl.md` §9.3 性能预算表、§3.4 回退触发（引「卷 24 §7 的 10ms 预算」）；`impl/16-event-bus-impl.md:819` | ⚠️ **D7**：`impl/25` 引「卷 24 §7 的 10ms 预算」——10ms 实际在 §4.7 SLO 表，§7 只写「审计写入异步」；引用漂移（数字本身一致，R03 复核时点仍未改） |
| N8 | 沙箱档位与网络策略 | 五档 L0/L0+/L1/L2/L3；默认 L0+（能力可用时，否则退 L0）；网络默认白名单（包管理域名 + Git 平台 + 模型端点），SSH 工作区全禁出站仅白名单 | `07-sandbox-security.md:140`–`:145`（档位表）、`:142`（默认执行档）、`:284`（默认隔离档）、`:285`（默认网络策略）；`appendix-c-glossary.md:26`（五档）；`impl/07-sandbox-executor-impl.md:69`、`:114`、`:802`；`20-workspace-system.md:132`；`DECISIONS.md:139`、`:140`、`:143`；`ALTERNATIVES.md:23`；`00-vision-and-product.md:100`、`:260`；`30-security-engineering.md:33` | ⚠️ **D3**（档数 4 vs 5）：`DECISIONS.md:139` H-009 候选分支仅列 L0→L1→L2→L3、`ALTERNATIVES.md:23` 写「L0–L3」；⚠️ **D4**（默认档）：`DECISIONS.md:140` 写「默认 L0 + 路径围栏」vs 卷 07 §4.1/§10「R0/R1 用 L0+，默认 L0+」；⚠️ **D10**（简写扩散）：`00:100`、`00:260`、`30:33` 使用「L0–L3」。处置：DECISIONS 已加口径注（权威=卷 07 五档 + §10 默认 L0+）；`ALTERNATIVES.md`/卷 00/卷 30 记修订建议 X-R03-1 |
| N9 | 事件留存窗口 | 领域 1 年（可永久）/ 系统 1 年 / 遥测 30 天 / 审计 3 年；审计细分：安全 3 年、业务 1 年、使用 90 天 | `16-event-system.md:83`、`:227`、`:229`；`24-enterprise-operations.md:366`；`impl/16-event-bus-impl.md:99`、`:680`、`:766`；`impl/25-enterprise-iam-audit-impl.md:113`、`:462`、`:781`、`:782` | ✅ 一致（impl 已把「事件类别」与「审计类别」两套口径统一映射为 365/365/30/1095 + 1095/365/90） |
| N10 | 配额与成本默认值 | 预算三级 50%/80%/100%；热存储水位 80%/90%；预测式放宽 ≤ 30%；成本回归容差 10%；计量对账误差 ≤ 0.5%；每轮 $0.108、每人日 $5.4 | `31-capacity-and-cost.md:192`、`:196`、`:210`、`:215`、`:230`；`24-enterprise-operations.md:187`、`:335`；`impl/26-quota-cost-impl.md:771`、`:773`；`impl/31-automation-library-impl.md:817`；`impl/32-intelligent-augmentation-impl.md:921` | ✅ 一致（impl/26 §9.3 逐项对齐，含 `quota.dynamicMaxBoostRatio=0.3`、`regression.toleranceRatio=0.10`） |

> **台账外补充（同属「全局数字」但非指标）**：`impl/01:816`（5000 会话，见 D6）、`impl/20:874` vs `impl/20:908`（并发默认 4 vs 16/64，见 D5）、`impl/22:808`（`oc run` ≤ 350ms 为 300ms 门禁的放宽项，已标注在文件中）。

---

## 3. 冲突清单（10 项：8 数字/口径 + 2 编号）

| # | 冲突 | 严重度 | 出处对照（file:line） | 处置 |
| --- | --- | --- | --- | --- |
| D1 | H-001 回退线 200MB 标注「（卷 22 指标）」不成立 | 中 | `DECISIONS.md:55` / `ALTERNATIVES.md:15` / `impl/22:37` ↔ `22:304`（350MB）、`00:714`（NFR-P-7）、`impl/22:96`（120MB） | ✅ 已修：`DECISIONS.md` H-001 追加口径注；`ALTERNATIVES.md` 属只读面，随 X-R03-1 一并提修订建议 |
| D2 | **10k 事件量 6× 偏差** | 高 | `31:110`（3.0×10⁷/天）↔ `impl/16` §10.3 旧稿（5e6/天） | ✅ **已消解**：同批次 R03 并行轮按卷 31 口径改写 `impl/16` §10.3（3.0×10⁷/天、月分区 9×10⁸ 行），R03 复核通过 |
| D3 | 沙箱档数 4 vs 5（H-009 候选枚举缺 L0+） | 高 | `DECISIONS.md:139` / `ALTERNATIVES.md:23` ↔ `07:140-145`、`appendix-c:26`、`impl/07:69` | ✅ 已修：`DECISIONS.md` H-009 加口径注（权威=卷 07 五档）；`ALTERNATIVES.md` 记 X-R03-1 |
| D4 | 默认隔离档 L0 vs L0+ | 高 | `DECISIONS.md:140` ↔ `07:142`、`07:284`、`07:53`（R0/R1 用 L0+） | ✅ 已修：同上口径注；卷 20:132 映射表同挂 |
| D5 | `impl/20` 并发默认值内部不一致（4/连接 vs 16/工作区、64/实例） | 中 | `impl/20` §9.5（每连接 4）↔ §10.3（16/工作区、64/实例；卷 20:185 未给默认值，无卷级冲突） | ✅ **已消解**：同批次 R03 轮在 §9.5/§10.3 显式写出「每连接 4 ⇒ 每工作区 16、单实例 64（配置同源）」，R03 复核通过 |
| D6 | `impl/01` server 档会话数 5000 vs 配置默认 500（NFR-P-9） | 低 | `impl/01` §10.3 ↔ §9.5（`max-active-server=500`）、`00:716` | ⚠️ 报告（R03 复核时点仍为 5000）：台账 §2-N5 记录（疑为横向扩展上界，建议标注） |
| D7 | 审计写入延迟引用「卷 24 §7」vs 实际在 §4.7 | 低 | `impl/25:848`、`impl/25:171` ↔ `24:223`（§4.7）、`24:323`（§7 仅述异步） | ⚠️ 报告：`AUDIT.md` §5 系登记（数字一致，仅引用漂移） |
| D8 | `REQ-AUTO-1…6` / `REQ-AI-1…12` 同号不同义（卷 00 早期草案 vs 卷 34/35 定稿） | 中 | `00:676-681`（AUTO 草案语义）↔ `34:35`+（定稿 16 条）；`00:687`+（AI 草案）↔ `35`（`REQ-AI-*` 与 `REQ-INTEL-1…18`） | ⚠️ 报告：`AUDIT.md` §5 登记；建议终局轮统一为「卷 34/35 定稿优先 + 卷 00 加注」 |
| D9 | 卷 25–33 无 `REQ-<域>-n` 定义行（九卷） | 中 | `grep -cE '^\\| REQ-' 25…33.*.md` 全部 0 ↔ `README.md:88`（骨架第 2 节要求「每条需求给 REQ-ID」）；卷 00/01–24/34/35 均有 | ⚠️ 报告：`AUDIT.md` §3 登记为结构性例外 + 修订建议 X-R03-2 |
| D10 | 「L0–L3」简写与五档全称并存 | 低 | `00:100`、`00:260`、`30:33`、`ALTERNATIVES.md:23` ↔ `07:140-145`、`appendix-c:26` | ✅ 部分修：附录 C §C.6-C6-4 定义口径 + 修 `research/competitors/02-opencode.md:770`；卷 00/30 记 X-R03-1 |

**汇总**：高 3（D2/D3/D4）、中 4（D1/D5/D8/D9）、低 3（D6/D7/D10）。冲突数 **10**：R03 复核时点**已消解/已修 6 项**（D1/D3/D4 由本轮索引侧口径注就地修复；D2/D5 由同批次 R03 并行轮修复并复核通过；D10 部分修复 + 卷级建议），**仍开放 4 项**（D6、D7、D8、D9，均为报告项）。**卷册与 impl 全程未由本轮回改一字**。

---

## 4. AUDIT.md 口径刷新（before → after，全部实测）

| 项 | before（R01 口径，已过期） | after（R03 实测） | 命令 / 证据 |
| --- | --- | --- | --- |
| 全树 Markdown | 97（顶层 45 + research 12 + impl 37 + archive 3，不含 reviews） | **108**（含 reviews 11、archive 3）；不含 archive 105 | `find docs/harness -name "*.md" \| wc -l` = 105（R03 建文件前）→ 108（取证时点，含并行轮产出） |
| 卷/附录 | 36 卷 + 附录 A–D + 5 索引文件 = 45 顶层 | 同（45/45 存在） | `ls docs/harness/*.md \| wc -l` = 45 |
| 决策 | 420（H20 + D400，实枚举 393） | 420（不变）+ **I- 268 / X- 81**（Phase B） | `grep -oh 'I-[A-Z0-9]*-[0-9]\+' impl/*.md \| sort -u \| wc -l` = 268；§4 表行 = 81 |
| 图 | 406 块 / 404 PASS / 2 FAIL（impl/29 真错 + impl/07 误报） | **410 块 / 410 PASS / 0 FAIL** | 顶层 68 + research 44 + impl 298；校验器双跑：Phase A+research `total=112 fail=0`、impl `total=298 fail=0` |
| 图型分布 | 未登记 | seq 148 / state 76 / flow 38 / class 36（= 298） | `grep -hoE '^(sequenceDiagram\|classDiagram\|flowchart\|stateDiagram)' impl/*.md \| sort \| uniq -c` |
| REQ（Phase A） | 未登记 | 唯一 id **443**；按文件去重求和 **607** 行；卷 00 §5 = **386** 行 / 35 域 | §1 命令行 |
| REQ（Phase B） | 未登记 | 定义行 811 + 同域引用 8 = **819**；`impl/README.md` §2 表载 817（差 2：`impl/02` 19→21 R02 拆行后未回填） | §1 命令行；`node` 逐文件比对脚本 |
| 组件 | 108（Phase A 基线） | **137**（K42/P33/E32/T16/X14；Phase A 108 全折入，净增 29）；137/137 行带 `impl/NN` 落点 | `sed -n '/^## D.1/,/^## D.6/p' ... \| grep -cE '^\| [KPETX]-'` = 137 |
| 竞品研究 | 未登记 E1 密度 | 9 份报告 E1 合计 **1805** 处；L- 台账 93 行 | §1 命令行 |
| 迭代 | 25 轮（Phase A） | 25 轮（Phase A）+ **Phase B R1–R3**（`reviews/` 9 份） | ITERATIONS Phase B 表 3 行 |

**AUDIT 结构变更**：新增 §7「Phase B 段」（目标 → 交付物 → 证据 → 结论，B1–B5 行；B4 自我审查行标「进行中（R1–R3 已完成）」）；§2 校验表补 REQ 行、Mermaid 行改写、文件/决策行刷新；§3 补 2 条例外（卷 25–33 REQ、L0–L3 简写）；§4 补 6 项跨语料抽样；§5 关闭 `impl/29` 图错误缺口（R03 复跑 298/298 PASS）并新增 6 项缺口；§6 结论数字同步。

---

## 5. 术语一致性（附录 C 对照实际用法）

| # | 检查项 | 实测用法 | 结论与处置 |
| --- | --- | --- | --- |
| T1 | `HarnessException` vs `BusinessException` | `impl/README.md` §5.5 与 `impl/IMPL-DECISIONS.md` §1.3-6 已统一为「内核 = HarnessException / 外壳 = BusinessException / 模型层 = AiException」；R02 已把 impl/01–12、13–24 收敛；R03 取证时点 impl/13–24 与 25–35 仍分别有 32 / 31 处 `BusinessException` 用例（其中含合法的外壳层用例，需逐处判类） | ⚠️ 体系清晰（非平行体系）；附录 C 增 §C.6-C6-5 注明权威出处；逐处判类由同批次 R03 scope-enterprise/collab 轮收口 |
| T2 | WorkItem vs 「工单」 | 术语表禁「工单」，但 `appendix-d` E-15 `FeedbackTicketService`、`ITERATIONS.md:71`、`DECISIONS.md:240` 用「工单」指**外部工单实体** | ✅ 合法复用：§C.6-C6-1 显式登记口径（内部工作对象禁称工单；外部 Feedback Ticket 不属 WorkItem） |
| T3 | AgentRun vs Turn | 全树无 `AgentRun` 术语（`AgentRuntime` 为类名，`Turn` 为原语）；`impl` 正文以「回合」指 Turn | ✅ 无冲突；§C.6-C6-3 补 Turn=回合 的中文对应 |
| T4 | 工作区 vs 沙箱 | 卷 07（沙箱=边界）与卷 20（工作区=现场）分工清晰；`20:132` 的「工作区的隔离档」映射合法 | ✅ 无混用；§C.6-C6-6 登记组合表述 |
| T5 | Skill vs 插件 | 卷 08/18 分工清晰（内容型能力包 vs 代码型扩展）；`appendix-d` E-12「插件/技能市场」为 Registry 双面组件命名 | ✅ 无冲突（同一组件的两类制品） |
| T6 | 审批 vs 授权 | 卷 06 决策（ALLOW/ASK/DENY）与审批（ASK 裁定）、授权记忆（GrantMemory）三层语义清晰；`07:99`「权限审批」为口语化表述（指审批动作） | ✅ 无实质混用；无卷册改动 |
| T7 | Thread/Turn/Item | 卷 12 定义完整；卷 22（客户端卷）未出现 Thread/Turn/Item（用「会话/条目」表达） | ⚠️ 低：客户端卷词汇未与本表显式对齐，记修订建议 X-R03-3（卷 22 补一行术语引用，非阻断） |
| T8 | 「消息流」 | `22:194` 团队视图「消息流（按类型过滤）」指**团队消息列表** | ✅ 合法：§C.6-C6-2 登记 |
| T9 | 「L0–L3」 | 见 §2-N8 / D10 | ✅ 口径收敛（§C.6-C6-4），简写使用面记 X-R03-1 |

**修正动作（消费者侧）**：附录 C 新增 §C.6（6 条补注，纯新增、未改 C.1–C.5）；`research/competitors/02-opencode.md:770`「五档隔离（L0–L3）」→「（L0/L0+/L1/L2/L3）」。**卷级修正建议（不改卷）**：X-R03-1（卷 00/30 与 `ALTERNATIVES.md` 的 L0–L3 简写）、X-R03-2（卷 25–33 补 REQ 编号）、X-R03-3（卷 22 补 Thread/Turn/Item 术语引用）。

---

## 6. 本轮文件级变更（只增不删）

| # | 文件 | 变更 | 类型 |
| --- | --- | --- | --- |
| 1 | `README.md` | 附录 D 行与覆盖表行 108→137（含 Phase A 基线说明）；卷 35 行 12 项→8 项能力；`ITERATIONS` 行 20+ 轮→25 轮 + Phase B R1–R3；`AUDIT` 行 34 条→45 条 + Phase B 段；§2 新增 `reviews/` 行；表尾注补 reviews | 计数/术语修正 |
| 2 | `AUDIT.md` | 见 §4（§2 全量刷新 + §3 两条例外 + §4 六项抽样 + §5 关闭 1 项/新增 6 项 + §6 同步 + **§7 Phase B 段**） | 口径刷新 |
| 3 | `ITERATIONS.md` | 新增「Phase B 自审查轮次（R1–R3）」小节（表格 3 行 + R4+ 待排期行）；Phase A 表与正文未动 | 新增 |
| 4 | `DECISIONS.md` | §0 增 Phase B 实现层域编码（DSK/COST + 前缀别名 CLI/UX/INTEL）；H-001/H-009 各增口径注；§3 增 Phase B 统计行（I 268 / X 81 / 全树 769）；**新增 §4 实现级台账指针** | 新增 + 口径注 |
| 5 | `appendix-c-glossary.md` | 新增 §C.6 术语口径补注（C6-1…C6-6） | 新增 |
| 6 | `research/competitors/02-opencode.md` | `:770` 五档全称化 | 术语修正 |
| 7 | `reviews/R03-cross-corpus.md` | 本文件 | 新建 |

**未改动**：卷 00–35、附录 A/B/D、`ALTERNATIVES.md`、`impl/` 全部文件（含台账）、`archive/`。

## 7. 未决与移交

| # | 事项 | 归属建议 |
| --- | --- | --- |
| H1 | ~~D2（`impl/16` 事件量 6×）改写~~ **已由同批次 R03 轮完成**（R03 复核通过） | — |
| H2 | D6（`impl/01` 5000 会话标注）、D7（`impl/25` 卷 24 §7 引用改为 §4.7） | impl 责任面（scope-kernel / enterprise 轮） |
| H3 | D8（REQ-AUTO/AI 同号）与 D9（卷 25–33 无 REQ）编号体系裁决 | 编排器终局轮（需业务裁决，跨语料轮不擅改编号） |
| H4 | X-R03-1/2/3 三条卷级修订建议 | 并入 `impl/IMPL-DECISIONS.md` §4 的 X- 续号（如 X-82 起），由 impl 台账统一登记 |
| H5 | `impl/README.md` §2 表 REQ 817 → 819、图 296 → 298 回填 | impl 责任面（属 impl 索引，跨语料轮不越界修改） |
| H6 | `AUDIT.md` §7 B4 行「进行中（R1–R3 已完成）」 | R4–R10 由编排器排期后刷新 |
| H7 | `ALTERNATIVES.md` H-009 行「L0–L3」简写（只读面） | 随 X-R03-1 一并由编排器裁决 |

**本轮完成判据自查**：任务 1（全局数字台账 10 组 + 冲突 10 项带 file:line）✅；任务 2（术语核对 9 项 + 消费者侧修复 + 卷级建议登记）✅；任务 3（AUDIT 计数全量实测刷新 + Phase B 段，B4 标进行中）✅；任务 4（ITERATIONS Phase B 表 R1–R3）✅；任务 5（DECISIONS Phase B 域编码 + §4 指针 + §3 统计）✅；约束遵守：中文、只增不删、未触碰卷册与 impl、范围外零改动。
