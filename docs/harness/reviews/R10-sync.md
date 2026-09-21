# R10 · 终局回归与同步（台账 / 索引 / 附录 D 收口）

> 轮次：Phase B 自审查第 10 轮（lens = **终局回归与台账/索引同步**）——把 R1–R09 期间累积的「文件已产出、台账/索引/附录未同步」的漂移一次性收口。
> 权限边界：本轮只改 5 个文件——`ITERATIONS.md`、`impl/IMPL-DECISIONS.md`、`appendix-d-component-inventory.md`、`README.md`、`impl/components/README.md`（第 4 项要求的互引），并新增本文件；**未改**任何卷册（00–35）、`impl/NN-*-impl.md` 正文与 `impl/components/C*.md` 组件正文。
> 口径：全部计数来自本轮实跑命令（逐条附命令与输出），不采用任何旧轮次转述数；`ls`/`grep`/`awk` 均在工作目录 `docs/harness/` 执行。
> 同伴轮次：同批次并行 R10 轮 `R10-walkthrough.md`（可开工性走查）已落盘，其 findings 由其责任方处置，不在本轮改动范围。

## 〇、结论摘要（先读）

- **① Phase B 轮次表补齐**：`ITERATIONS.md` 的 R4–R10 全部登记（原「R4+ 待编排」1 行占位 → 7 行轮次明细，净增 6 行；R8 = 组件级方案批次，交付记录即 36 份 `impl/components/C*.md`，无独立 reviews/ findings）。
- **② `I-` 台账漂移清零**：实测 **277** 条 vs §2 登记 **268** 条 → 补登 **9** 条（`I-AG-9`、`I-WS-9`、`I-GIT-10`、`I-CLI-10…12`、`I-UX-10…12`，来自 R04–R06 安全/数据/体验轮的就地新增），§2/§3 计数与总数更新为 **277**，双向 diff 差集 0。
- **③ §4 建议去悬空**：登记 R07 预占 `X-83…X-89`（7 条，原样转正）；确认 C05/C06 候补 `X-90…X-96`（7 条，逐条列表）；组件级 126 条去重建议（阻塞 6 / 重要 98 / 一般 22）按组件聚合成表并指向 `impl/components/SUGGESTIONS.md` 逐条清单；号段占用合计 **215 条**（82 + 7 + 7 + 119）。C03 `R-CA-1` 自注 X-83 与 R07 冲突已在台账裁决改判。
- **④ 附录 D 组件级方案列**：137 行全部有值——**59** 行命中 `impl/components/Cxx-*.md`、**78** 行标注「由系统级方案覆盖」；`README.md` 与 `impl/components/README.md` 已互相引用；R09 缺口 W2（C↔附录 D 映射缺失）关闭。
- **⑤ 主 README 收口**：卷册地图/覆盖审计中 卷 32–35、附录 A–D、`research/`、`impl/`、`impl/components/`、`reviews/`、`archive/` 各行齐全且状态列与实测一致（`reviews/` 实测 23 份 + 本文件 = 24 份；组件目录 38 份 = 36 C + README + SUGGESTIONS）。
- **残留（不属本文件权限，已登记待责任方）**：`impl/README.md` §2 与 `DECISIONS.md`（268/81 口径）、`AUDIT.md`（R09 数）、`impl/components/C*.md` 内「待并号」回填、Phase A 轮次 4/12 落地小节（AUDIT W3/W4 余项）。明细见 §四。

## 一、基线实测（命令与输出）

```bash
# [1] reviews/ 目录实测（本文件落笔时点；含同批次 R10-walkthrough.md）
ls reviews/ | wc -l                          # → 23
ls reviews/ | grep -oE '^R[0-9]+' | sort | uniq -c
#  4 R01   4 R02   4 R03   2 R04   2 R05   2 R06   2 R07   2 R09   1 R10

# [2] I- 决策实测 vs 台账 §2 登记（双向 diff）
grep -oh 'I-[A-Z0-9]*-[0-9]\+' impl/*-impl.md | sort -u | wc -l          # → 277
awk '/^## 2\./,/^## 3\./' impl/IMPL-DECISIONS.md \
  | grep -oE '^\| I-[A-Z0-9]*-[0-9]+' | sed 's/^| //' | sort -u | wc -l  # → 268（补登前）→ 277（补登后）
# 正向差集（实测有、§2 无）9 条：I-AG-9 / I-WS-9 / I-GIT-10 / I-CLI-10 / I-CLI-11 / I-CLI-12 / I-UX-10 / I-UX-11 / I-UX-12
# 反向差集（§2 有、实测无）0 条

# [3] 组件级建议册实测
grep -cE '^\| .+ \| C[0-9]{2} \| (阻塞|重要|一般) \|' impl/components/SUGGESTIONS.md   # → 126（去重后）
# 严重度分项：阻塞 6 / 重要 98 / 一般 22；按组件出处清点 36 个组件全覆盖

# [4] 附录 D 行数与映射（行级命令，避免把说明文字计入）
grep -cE '^\| [KPETX]-[0-9]{2} \|' appendix-d-component-inventory.md                    # → 137
grep -cE '^\| [KPETX]-[0-9]{2} \|.*components/C[0-9]' appendix-d-component-inventory.md # → 59（命中）
grep -cE '^\| [KPETX]-[0-9]{2} \|.*由系统级方案覆盖' appendix-d-component-inventory.md   # → 78（覆盖）
# 分组：D.1 24/18、D.2 20/13、D.3 6/26、D.4 9/7、D.5 0/14（命中/覆盖）

# [5] 组件级方案体量（R8 交付物复核）
ls impl/components/C*.md | wc -l             # → 36
cat impl/components/C*.md | wc -l            # → 16101 行
cat impl/components/C*.md | grep -c '```mermaid'  # → 186 图

# [6] 五个被改文件的行数（收口后）
wc -l ITERATIONS.md impl/IMPL-DECISIONS.md appendix-d-component-inventory.md README.md impl/components/README.md
# 265 / 793 / 283 / 191 / 302
```

## 二、逐项落地记录

### 1. ITERATIONS.md——Phase B 轮次表补齐 R4–R10

- 原状：Phase B 表只登记 R1–R3，末行「R4+ 待编排」占位（259 行）。
- 现状（265 行，净增 6 行）：R1–R3 原行保留，占位行替换为 R4–R10 七行，每行为「视角 ｜ 覆盖范围 ｜ findings 文件 ｜ 头条发现/修复 ｜ 状态=完成」：
  - R4 安全与权限纵深（`R04-scope-security-kernel.md`、`R04-scope-security-collab.md`；新增 `I-WS-9`/`I-GIT-10`）；
  - R5 恢复·幂等·迁移一致性（`R05-scope-data.md`、`R05-scope-recovery.md`；新增 `I-AG-9`）；
  - R6 企业级/UX 就绪（`R06-scope-enterprise.md`、`R06-scope-ux.md`；新增 `I-CLI-10…12`、`I-UX-10…12`）；
  - R7 可落地性与实施顺序（`R07-scope-build-kernel.md`、`R07-scope-build-platform.md`；提出 X-83…X-89）；
  - R8 组件级方案批次（交付记录 = `impl/components/C01…C36` 36 份 + `SUGGESTIONS.md`，无独立 findings 文件）；
  - R9 目标可追溯性 + 证据真伪（`R09-traceability.md`、`R09-evidence.md`）；
  - R10 终局回归与同步（本文件 + `R10-walkthrough.md` 同批次）。
- 同步修正：小节标题 `（R1–R3，R03 跨语料轮增补）` → `（R1–R10）`；引言改为附实测命令的口径（R01 4 / R02 4 / R03 4 / R04 2 / R05 2 / R06 2 / R07 2 / R09 2 / R10 1，共 23 份；R8 说明；本文件落盘后 24 份）。
- 对照 AUDIT W1（「ITERATIONS.md 未登记 R4–R7、R8 空缺」）：R4–R10 全登记，**W1 关闭**。

### 2. impl/IMPL-DECISIONS.md——`I-` 补登（268 → 277）与计数刷新

- 补登 9 条（含维度/选定分支/理由/回退触发/来源，格式与既有行一致）：
  - `I-AG-9` 检查点唯一口径（R05）→ §2.12（标题 8 → 9 条）；
  - `I-WS-9` 远端连接信任（R04）→ §2.20（8 → 9 条）；
  - `I-GIT-10` 仓库内容执行面加固（R04）→ §2.21（9 → 10 条）；
  - `I-CLI-10` 首屏路径、`I-CLI-11` 审批终态呈现、`I-CLI-12` 文案键空间（R06）→ §2.22（9 → 12 条）；
  - `I-UX-10` 界面族扩展、`I-UX-11` 审批终态呈现、`I-UX-12` 文案键空间与三段式（R06）→ §2.30（9 → 12 条）。
- 计数同步：文首抽取口径（268 → 277）、§1.3-1、§1.4（全域唯一计数 277 + 新增「与 §2 双向 diff」行）、§2 标题与 R10 补登说明、§3.1（WS 9 / GIT 10 / CLI 12 / UX 12 / AG 9；合计 **277**）、§3.2（平均 7.9；高密度清单补 22/30 的 12 条；回退完备 276/277）、§5.3 结论行。
- 复算：见 §一 [2]，补登后正向/反向差集均为 0。

### 3. impl/IMPL-DECISIONS.md——§4 组件级建议并入与去悬空

- 标题：`## 4. Phase A 修订建议汇总（81 条）` → `## 4. 修订建议汇总（X-1…X-215：Phase A 段 82 条 + R07 7 条 + 组件级 126 条）`；§4.1 增 4 行（R10 扩展 ①②③ + 号段占用汇总）。
- 新增 **§4.3 R07 预占建议（X-83…X-89，7 条）**：按 R07 文件原表转正（B1b 子批、提示词 6 表、沙箱 6 表、步 2.5、步 11.5、`tools/plugin-sdk`、工作对象表名）；`X-89` 记为阻塞并与组件级 `X-C20-1` 同源；附 C03 `R-CA-1` 自注 X-83 的**冲突改判**裁决。
- 新增 **§4.4 组件级建议（X-90…X-215）**：`X-90…X-96` 7 条逐条列表（C05 R-1…R-3、C06 R-1…R-4）+ 按组件聚合表 36 行（条数/阻塞/重要/一般/逐条出处）+ 6 条阻塞清单 + 汇总统计（号段占用 **215** 条；阻塞 3+6，其中 X-C20-1=X-89 同源）；逐条清单权威源指向 `impl/components/SUGGESTIONS.md` §2，并注明与 `impl/components/README.md` §5 同源同表。
- 复算：`awk '/^## 4\./,/^## 5\./' impl/IMPL-DECISIONS.md | grep -oE '^\| X-[0-9]+ ' | sort -u | wc -l` → 96（X-1…X-96）；组件聚合行 36 行。

### 4. appendix-d-component-inventory.md——新增「组件级方案」列

- 5 张组件表（D.1–D.5）表头与分隔行同步扩为 9 列，137 个组件行全部插入该列（脚本化插入后逐行校验，插入位置固定为「实现方案」之后）。
- 命中映射原则：组件文件显式声明（如 C03=K-07、C12=P-19/P-20/P-21、C33=E-23/E-26/T-11…T-14、C34=T-02/T-03/T-04/T-09/T-10）为第一优先；同族主责组件（如 K-17/K-18/K-20→C10、P-06/P-07/P-08→C22）为第二优先；其余一律「由系统级方案覆盖」。
- 配套：文首「数据来源」增 ⑤（`impl/components/` 为映射依据）；新增「组件级方案列口径」专段（含行级实算命令）；§D.7.4 增统计行；文末增 R10 补登记说明（含 R09 缺口 W2 关闭）。**W2 关闭**。
- 复算：见 §一 [4]（137 / 59 / 78；分组 24/18、20/13、6/26、9/7、0/14）。

### 5. README.md 与 impl/components/README.md——索引收口与互引

- `README.md`（189 → 191 行，+2）：附录 D 行（增列说明 + 状态「完成（R10 增列）」）；`ITERATIONS.md` 行（R1–R10 + 状态「完成（R10 刷新）」）；`impl/components/` 行（改为目录级 `C01…C36 + README + SUGGESTIONS`，映射已登记）；`reviews/` 行（实测 23 份明细 + R10 两文件 + R8 说明 + 状态「完成」）；Phase B 交付物脚注（components 38 份、reviews 24 份）；§5 覆盖审计表 2 行（组件完备性增映射；组件级方案行去除「待登记」）；新增「R10 索引收口说明」段（2 行）。
- `impl/components/README.md`（300 → 302 行，+2）：头部增「索引收口（R10）」段（指向 `../../README.md` §2 与 `../../appendix-d-component-inventory.md`）；§5 口径段更新（建议已并入台账 X-83…X-215；注明组件文件内「待并号」回填仍待执行、保留并入前口径）。
- 互引达成：`README.md` → `impl/components/README.md` → `appendix-d-component-inventory.md`/`IMPL-DECISIONS.md` 三向可达。

## 三、可重跑复算清单

```bash
cd docs/harness
ls reviews/ | wc -l                                                                      # 24（含本文件）
grep -oh 'I-[A-Z0-9]*-[0-9]\+' impl/*-impl.md | sort -u | wc -l                           # 277
awk '/^## 2\./,/^## 3\./' impl/IMPL-DECISIONS.md | grep -oE '^\| I-[A-Z0-9]*-[0-9]+' | sed 's/^| //' | sort -u | wc -l   # 277
grep -cE '^\| .+ \| C[0-9]{2} \| (阻塞|重要|一般) \|' impl/components/SUGGESTIONS.md      # 126
grep -cE '^\| [KPETX]-[0-9]{2} \|' appendix-d-component-inventory.md                       # 137
grep -cE '^\| [KPETX]-[0-9]{2} \|.*components/C[0-9]' appendix-d-component-inventory.md     # 59
grep -cE '^\| [KPETX]-[0-9]{2} \|.*由系统级方案覆盖' appendix-d-component-inventory.md      # 78
grep -c '| 组件级方案 |' appendix-d-component-inventory.md                                  # 5（5 张表头）
```

## 四、残留未闭合项（已登记，待对应责任方；不属本轮权限）

| # | 位置 | 现状 | 建议处置 |
| --- | --- | --- | --- |
| 1 | `impl/README.md` §2（L50/L91/L216） | 仍为 `I-` **268** 口径（该文件不在本轮权限） | 刷新为 277；顺带处理 AUDIT W3 的图数 296/298 vs 306、REQ 817 vs 829 |
| 2 | `DECISIONS.md` §3 行（Phase B 实现级决策 = 268）与说明段（81 条 X-） | 口径过时 | 刷新为 277 / X-1…X-215（号段 215） |
| 3 | `AUDIT.md`（行 69/127/144 与 §8 W3） | 仍按 R09 记「I- 268 登记 / 277 实测、X-82」 | 刷新为 277 登记（差集 0）/ X-215；W1/W2 可标关闭（本轮已处置），W3 仅余 impl/README 口径，W4 见下行 |
| 4 | `impl/components/C*.md` 文末「待并号」 | 36 份组件文件未回填正式 `X-n`（属组件正文，本轮禁改） | 按 `SUGGESTIONS.md` §1 并号规则回填（X-90…X-215 已定号段） |
| 5 | `ITERATIONS.md` R01 索引表 Phase A 轮次 4/12 | 「⚠️ 缺口（待补）」仍在（AUDIT W4：Phase A 遗留，非本轮范围） | 由 Phase A 责任方补两轮落地小节 |
| 6 | 同批次 `R10-walkthrough.md` findings | 本轮只登记文件名与轮次，不改其结论 | 由编排方按其文件内「留给编排方处置」清单处理 |
| 7 | `impl/components/` 号段重号（C26/C32 与 C06/C25 撞号） | 同批次 R10 并行轮已就地修复（C26 → `MIG`、C32 → `REG` 并去零填充；复核 `grep -c 'REQ-C-MIG\|I-C-MIG' C26-migration-runner.md` = 21、`grep -c 'REQ-C-REG\|I-C-REG' C32-registry-client.md` = 20）；`impl/components/README.md` §6.4 已更新 | 无需本轮动作，交叉登记备查；组件文件内「待并号」回填仍见上行第 4 条 |

## 五、本轮文件变更清单（全部只增改、无删除）

| 文件 | 变更 | 行数 |
| --- | --- | --- |
| `ITERATIONS.md` | Phase B 表 R4–R10（7 行）+ 引言/标题改写 | 259 → 265（+6） |
| `impl/IMPL-DECISIONS.md` | §2 补登 9 条 + 计数刷新；§4 重写为 X-1…X-215（新增 §4.3/§4.4，含 96+36 行表） | → 793 |
| `appendix-d-component-inventory.md` | 5 表新增「组件级方案」列（137 行）+ 口径段 + 统计行 + R10 说明 | 278 → 283（+5） |
| `README.md` | 卷册地图 4 行 + 覆盖审计 2 行改写 + R10 收口说明段 | 189 → 191（+2） |
| `impl/components/README.md` | 索引收口互引段 + §5 口径更新 | 300 → 302（+2） |
| `reviews/R10-sync.md` | 本文件（新增） | 新增 |
