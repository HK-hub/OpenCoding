# R10 · 终局机械回归（全语料）

> 轮次：R10（终局机械回归）｜ 范围：`docs/harness/**/*.md`（快照 159 文件，见 §5）｜ 快照时间：2026-09-21 03:51（并行轮次正在同步索引文件，行数以命令输出为准）
> 结论：六项机械检查全部执行——**Mermaid 606/606 通过（0 FAIL）｜ 真占位 0（raw 171 全部为合法用法）｜ 模板 71/71 合规 ｜ 编号：修复 2 组 16 个 I- 碰撞 id、台账 277/277 零差异 ｜ 引用：0 真悬空、4 处陈旧锚点已修**；缺陷 7 项 9 处就地修复（§7），索引类残余 4 项转交 owner（§8）。

---

## 1. 检查 1 · Mermaid 全量

**命令**（检查器：`.research-cache/mmd-check/check.mjs`，mermaid v11 + jsdom 解析，逐块 `mermaid.parse`）：

```bash
cd D:/learn/project/OpenCoding/.research-cache/mmd-check
find D:/learn/project/OpenCoding/docs/harness -name "*.md" -type f | sort > /tmp/harness-files.txt   # 159 行
xargs node check.mjs < /tmp/harness-files.txt
```

**首轮（编辑前）与终轮（全部编辑后）字面输出一致**：

```
total=606 fail=0        # EXIT=0；606 行 OK，0 行 FAIL
```

**图类型分布**（脚本口径=每块首个内容行）：`sequenceDiagram 286 / stateDiagram-v2 139 / flowchart 93 / classDiagram 72 / graph 16`，合计 606。

**语义抽查（结构通过之上的第二层判断，0 修复）**：

- `graph` 旧语法 16 处**全部位于 Phase A 卷/附录**（`01-harness-architecture.md`×3，`02/03/05/09/11/14/16/22/23/24/27/30` 与 `appendix-a-domain-model.md` 各 1）；`impl/`（含 components）内为 **0 处**，满足实现层写作模板「`flowchart`/`classDiagram`/`sequenceDiagram`/`stateDiagram-v2`」要求。`graph` 为 mermaid 合法等价写法且属冻结卷册，不改。
- 无空图（每块均有 ≥1 节点/参与者/状态），无实验语法（全部为目标清单内类型）。

---

## 2. 检查 2 · 占位与空节

**原始命令与结果**：

```bash
grep -rn 'TODO\|FIXME\|待填\|占位\|TBD' docs/harness --include=*.md | grep -v '/archive/'   # → 171 行
```

按题述口径「排除归档与合法用法」逐行分类（分类脚本对每行取命中词与文件上下文判读，区间：全部 171 行）：

| 类别 | 数量 | 判据与示例 |
| --- | --- | --- |
| A 规范语境「占位符」 | 73 | 日志/模板规范术语（`impl/01:173`、`impl/03:860` 等「`{}` 占位符」） |
| B 设计语义「占位」 | 35 | 骨架屏/流式占位（`impl/30:735`）、工具卡占位行（`impl/22:809`）、拓扑占位（`33-interaction-details.md:53`）、回放 `SIMULATED` 占位（`impl/16:862`、`C22:370`）、AUDIT 对「R4+ 待编排」占位的缺口记录 |
| C 竞品证据引用 | 20 | 竞品源码 TODO 清单/指针占位（`research/competitors/02-opencode.md:16,259`、`03-codex.md:34,38`，均为 `[E1]` 证据原文） |
| D 评审历史词表 | 38 | R01–R10 评审自身的词表与 grep 命令描述（`reviews/R01-scope-kernel.md:96`、`AUDIT.md:71`） |
| E 规则/扫描目标文本 | 5 | 「禁止 TODO/占位符」写作约束（`impl/README.md:38`、`impl/31:1046`）、技术债模板的扫描目标「陈旧 TODO」（`34-automation-templates.md:291,598`） |
| F **真占位** | **0** | — |

**结论**：题述命令按字面返回 171（非 0），但 **0 条为待填语义**；全部为竞品事实、评审词表、规范术语与产品文案。按裁决口径计 **占位缺陷 = 0**。注意：评审类文件（含本文件，13 行词表/命令文本）会持续贡献 D 类噪声，审计复跑时应按同一分类口径判读。

**空节扫描**（脚本：对每个 `##` 级标题统计到下一同级标题的非空正文行，排除代码围栏）：

```bash
# 全树 ## 级节共 1,571 个
# body < 2 行（真空节）：修复前 1 处 → 修复后 0 处
# body ≤ 4 行：78 处
```

- 修复前唯一真空节：`appendix-b-interface-contracts.md:97`「B.6 A2A 服务面（摘要）」正文仅 1 行指针。**已修复**：展开为 9 端点摘要表 + 11 类外部事件清单（依据卷 23 §4.1，见 §7）。
- 其余 ≤4 行节（78 处）逐节判读为**有意极简形态**：36 卷统一「1. 本卷定位」3 条 bullet、决策矩阵小表、组件文末「修订建议」登记块（3 行）、`DECISIONS.md:344` 指针节等，无待填语义，不改。

---

## 3. 检查 3 · 模板完整性（35 系统 + 36 组件，全量不抽样）

**命令**（脚本口径：提取 `##` 级标题序列，将 `①…⑪` 归一为 1…11，比对 `[1..11]` 顺序）：

```bash
# 见本轮脚本 r10-sections.mjs；等价 grep：grep -oE '^## [0-9]+[.、]' 与 '^## [①-⑪]'
```

**结果**：

- `impl/NN-*-impl.md`：**35/35 合规**，11 节顺序全部为 `1,2,3,…,11`；其中 6 份（07/08/17/18/27/28）在第 11 节之后附 `## 12. 实现级决策汇总（I-…）`——位于 11 节序列之外，属附加汇总节，不构成偏差。
- `impl/components/C**-*.md`：**36/36 合规**，①…⑪ 顺序完整，文末另有未编号「修订建议」块（约定内）。
- 一致性注记（非缺陷，不改号）：impl 标题序号存在双风格——21 份用 `①…⑪`、14 份用 `1.…11.`（含 6 份到 `12.`）；跨文件引用同时存在「§③.7」与「§3.7」两种写法。两者均指向同一 11 节语义结构，强制统一会波及全语料引用（含卷册冻结文本），**报告不修订**。

---

## 4. 检查 4 · 编号唯一性

**REQ（impl + components，每文件去重）**：

```bash
grep -oE '^\| REQ-[A-Za-z0-9-]+' FILE | sort | uniq -d     # 逐文件：全部 0 输出
grep -rn '^| REQ-' --include=*.md . | awk -F'|' '{print $1"|"$2}' | sort | uniq -d   # 全树：0 输出
```

结果：71 份（35+36）逐文件定义行 **0 重复**；全树 1,861 条 REQ 定义行**同文件内 0 重复**（跨文件同号仅出现在卷/impl 的有意对齐场景，不判缺陷）。

**I- 决策（全树唯一性）**：发现并修复 **2 组 16 个碰撞 id**（详见 §7）：

| 碰撞组 | 冲突文件 | 处置 |
| --- | --- | --- |
| `I-C-MR-1…4`（+ `REQ-C-MR-n`） | C06 ModelRouter ↔ C26 MigrationRunner | C26 全文件改缀 **MIG**（`REQ-C-MIG` / `I-C-MIG` / `R-MIG`，14+9+9 处引用） |
| `I-C-RC-1…4`（+ `REQ-C-RC-0n`，字符串重号 `RC-10/11/12`） | C25 RecoveryCoordinator ↔ C32 RegistryClient | C32 全文件改缀 **REG** 并去零填充（`REQ-C-REG-1…12` / `I-C-REG`，15+6 处引用） |

复算：`I-C-<别名>` 前缀映射 0 碰撞（每别名仅 1 文件）；定义行口径全树 0 碰撞；**impl 定义 277 条 ↔ `IMPL-DECISIONS.md` 台账 277 条，双向 diff = 0**；全树 `I-` 去重 token 426（其中组件级 `I-C-*` 148；`I-XXX-1` 为 R07 模板记号非 id）。

**H-/D-/X-/L- 交叉引用（抽 20+，实抽 24 处并由全量扫描兜底）**：

| 族 | 全量引用 | 去重 id | 悬空 | 抽样（file:line → home 命中） |
| --- | --- | --- | --- | --- |
| H- | 294 | 20 | 0 | `00:794→H-004`、`ALTERNATIVES:32→H-018`、`impl/01:96→H-003`、`impl/13:3→H-005`、`impl/22:1146→H-001`、`C20:5→H-005` |
| D- | 1,663 | 460 | 0 | `00:793→D-PROD-1`、`16:288→D-EVT-1`、`33:204→D-UX-4`、`impl/07:3→D-SBOX-1`、`impl/21:1078→D-GIT-6`、`C18:28→D-AGI-7` |
| X- | 445 | 107 | 0 | `C05:448→X-84`、`SUGGESTIONS:48→X-96`、`IMPL-DECISIONS:620→X-21`、`IMPL-DECISIONS:699→X-90`、`impl/README:175→X-41`、`appendix-d:26→X-03（附录 D 外部系统命名空间，自带定义 169–177 行）` |
| L- | 1,036 | 93 | 0 | `34:30→L-046`、`impl/19:997→L-053`、`impl/29:87→L-081`、`C21:366→L-045`、`LESSONS:197→L-026`、`LESSONS:545→L-002` |

---

## 5. 检查 5 · 图与计数真值（终局快照）

**命令**：

```bash
cd D:/learn/project/OpenCoding/docs/harness
# 文件/行数：find DIR -maxdepth 1 -name '*.md' -type f | wc -l  /  -exec cat {} + | wc -l
# 图：     find DIR -maxdepth 1 -name '*.md' -exec grep -h '^```mermaid' {} + | wc -l
# REQ 行： 同上，grep -h '^| REQ-'
```

**快照时间：2026-09-21 03:51:22（含并行轮次已落盘的 `reviews/R10-sync.md`；不含本文件）**：

| 目录 | 文件 | 行数 | Mermaid | REQ 定义行 |
| --- | ---: | ---: | ---: | ---: |
| `.`（卷 36 + 附录 A–D + 索引 5） | 45 | 13,919 | 68 | 607 |
| `impl/`（35 方案 + 台账 + README） | 37 | 36,877 | 306 | 829 |
| `impl/components/`（36 组件 + README + SUGGESTIONS） | 38 | 16,614 | 187 | 425 |
| `research/`（顶层 3） | 3 | 1,524 | 5 | 0 |
| `research/competitors/`（9 竞品 + 2 汇总计入 research 顶层） | 9 | 6,195 | 39 | 0 |
| `reviews/` | 24 | 3,479 | 1 | 0 |
| `archive/` | 3 | 415 | 0 | 0 |
| **合计** | **159** | **79,023** | **606** | **1,861** |

- 列校验：`45+37+38+3+9+24+3=159`；行数合计 79,023；图合计 606（与 §1 校验器 total 一致）；REQ 合计 1,861（`607+829+425`）。
- **I- 决策真值**：impl 级 **277** 条（= 台账 277，双向 diff 0）｜组件级 `I-C-*` **148** 个（去重）｜全树去重 token **426**。
- 写入本文件后目录为 160 文件；`reviews/` 25 份（含 R10-walkthrough / R10-sync / R10-final）。

---

## 6. 检查 6 · 失效引用

**6.1 文件引用**（脚本：抽取全树 `.md` token，按 `本目录/impl/impl/components/research/research/competitors/reviews/archive` 候选路径解析）：

- 输出 65 个候选未解析 token，逐类判读后 **真悬空 = 0**：
  - 竞品仓内路径（`docs/user-guide/22-permissions-and-safety.md`、`specs/v2/session.md`、`crates/...` 等，均为 `[E1]/[E2]` 证据坐标，非本仓文件）；
  - 外部项目文件（`AGENTS.md`、`CLAUDE.md`、`MEMORY.md`、`SKILL.md`、`.qoder/rules/*.md`——经核 `.qoder/rules/` 与根 `.env.example` 均存在）；
  - 旧草案名 `34-automation-playbooks.md` / `35-ai-enhancements.md`（`34-automation-templates.md:157`、`35-intelligent-augmentation.md:7`）——同段落均给出 `archive/*.superseded.md` 归档路径，属合法历史引用；
  - `ITERATIONS.md:238` 的 `34-automation-playbooks-impl.md` 为「改名前后对照」记述（→ `31-automation-library-impl.md`）。
- 路径解析抽查：`docs/design/*.md`（4 处引用、2 个文件均实存）、`archive/README.md`、`.env.example` 全部解析。

**6.2 陈旧小节锚点**（脚本：`(impl/NN|impl/components/Cxx) §N(.M)` 共 602 处，逐条校验目标节存在性）：

- 8 个候选 → **4 处真悬空已修复**（C08:59、C17:44、C18:43、C32:25，见 §7）；
- 4 处判为检查器误报并保留：`impl/35:36,262` 的 `impl/24 §3.7` = §③ 第 7 条（I-A2A-7，语料既有「§节.条目序」记法）；`C34:68,386` 的 `impl/33 §⑩.11`/`§⑩.5` = §⑩ 编号列表第 11/5 条（实存）。

**6.3 v1 模块名与命令**：

```bash
grep -rn 'mvn -pl open-coding' docs/harness --include=*.md     # → 0 命中
```

- 剩余 `open-coding-bootstrap` 命中均在「迁移来源/历史注记」语境（`impl/01:39`、`impl/17:50`、`impl/18:54`、`impl/24:1101` 标注性注释、`27-technical-path.md:281` 映射表），**示例命令内 v1 名 = 0**；全树 `mvn -pl` 选择器均为 `harness-kernel/*`、`harness-platform/*`、`harness-host/*`、`harness-contract` 目标名。

---

## 7. 本轮缺陷与修复清单（7 项 / 9 处）

| # | 位置 | 类型 | 处置 |
| --- | --- | --- | --- |
| 1 | `impl/components/C26-migration-runner.md`（:8、:47、:51–61、:65–74、:317/319/398/437/445–448 等） | I-/REQ-/R- 号段碰撞（与 C06） | `REQ-C-MR→MIG`、`I-C-MR→MIG`、`R-MR→MIG` 全文件改缀（32 处引用） |
| 2 | `impl/components/C32-registry-client.md`（:6、:25、:38–54、:58–65） | I-/REQ- 号段碰撞（与 C25）+ 零填充不一致 | 改缀 `REG` 并去零填充（`REQ-C-REG-1…12`），21 处引用 |
| 3 | `impl/components/README.md:240–248` | 建议台账引用旧号 `R-MR-*` | 同步为 `R-MIG-*`（4 行） |
| 4 | `impl/components/README.md:297` | 维护约定仍写「已知重号（合并前必须裁决）」 | 改写为「R10 已按建议就地修复」并记录复算结论 |
| 5 | `impl/components/SUGGESTIONS.md:123–126` | 建议登记册引用旧号 | 同步为 `R-MIG-*`（4 行） |
| 6 | `impl/components/C08-tool-registry.md:59` | 悬空锚点 `impl/05 §5.1` | 改为 `impl/05 §5（类图四成员）`（ToolSpec 四成员实存于 §5 类图） |
| 7 | `impl/components/C17-knowledge-indexer.md:44` | 悬空锚点 `impl/11 §4.2` | 改为 `impl/11 §6.2`（「三路混合检索与融合（P95 ≤ 300ms）」同名实存） |
| 8 | `impl/components/C18-subagent-router.md:43` | 悬空锚点 `impl/12 §4.3` | 改为 `impl/12 §3（I-AG-7）`（双信封预算定义处） |
| 9 | `appendix-b-interface-contracts.md:97` | 全树唯一真空节（1 行指针） | B.6 展开为 9 端点摘要表 + 11 类外部事件清单（对齐卷 23 §4.1 与 B.4/B.5 体例） |

修复后复算：Mermaid 606/606（B.6 未引入图）；I- 唯一性 0 碰撞；锚点悬空 0；空节 0；占位 0。

---

## 8. 残余清单（转交索引文件 owner）

1. **`impl/README.md` §2 索引总表：图数列过期（总 298 → 实测 306，8 个文件各 +1）**——命令 `grep -c '^```mermaid' FILE` 可机械复核（该表 §2 声明的口径即此命令，`17→8、19→10` 两个样例仍正确）：

   | 文件 | 表内值 | 实测 |
   | --- | ---: | ---: |
   | 03-context-engine | 7 | 8 |
   | 10-memory-system | 10 | 11 |
   | 11-knowledge-system | 8 | 9 |
   | 13-agent-teams | 8 | 9 |
   | 21-git-worktree | 8 | 9 |
   | 22-cli-tui | 9 | 10 |
   | 23-desktop-electron-vue | 10 | 11 |
   | 30-interaction-ux | 9 | 10 |
   | **合计** | **298** | **306** |

   同表汇总行「I- 决策 268」已落后于台账实测 **277**（AUDIT 在 R09 已记录该差值）；REQ 汇总「817」与本轮按同域去重口径复算存在个别差值（21:+2、22:+4、23:+4、33:+1 等），**建议按 §2 自带命令整体复算后再改，R10 不代为改数**。
2. **`AUDIT.md`（71/76/127/146/191/202/209 行）**：仍为 R09 时点值（153 文件 / 605 图 / reviews 20 份 /「Phase B 表 4 行」）；R10 实测为 **159 文件 / 606 图 / 24 份（+本文件 25）/ Phase B 表已补 R4–R10**。本文件 §5 的六项真值可直接引用。
3. **`ITERATIONS.md`（Phase B R10 行）**：现仅登记 `R10-sync.md`；本轮并行产出为 `R10-sync.md`、`R10-walkthrough.md` 与本文件 **`R10-final.md`**（reviews 目录 24 → 25 份），请补记。
4. **`IMPL-DECISIONS.md` / `appendix-d` / 根 `README.md`**：本轮只读观察，未改动；组件级局部号（`X-C32-1…3` 等）并入台账仍待编排方按 `SUGGESTIONS.md` §1 并号提案执行（首批实际可用起点 X-97）。
5. **一致性注记（非缺陷，供审计备注）**：impl 标题序号双风格（`①…⑪` 21 份 / `N.` 14 份）；`graph` 旧语法 16 处限 Phase A 卷册；`I-XXX-1`（`reviews/R07-scope-build-platform.md:145`）为模板记号非悬空 id。

---

## 9. 复算命令汇总（供终局审计直接引用）

```bash
# ① Mermaid（159 文件 → total=606 fail=0）
cd .research-cache/mmd-check && find ../../docs/harness -name '*.md' | sort | xargs node check.mjs
# ② 占位原始命中（171，经分类为 0 真占位）
grep -rn 'TODO\|FIXME\|待填\|占位\|TBD' docs/harness --include=*.md | grep -v '/archive/' | wc -l
# ③ 11 节模板（impl 35/35、components 36/36）
grep -cE '^## ([①-⑪]|[0-9]+[.、])' impl/NN-*-impl.md / impl/components/C*.md
# ④ 编号唯一性（0 重复 / 0 碰撞 / 台账 277 双向 0 差）
grep -oE '^\| REQ-[A-Za-z0-9-]+' FILE | sort | uniq -d
grep -rnE '^\| I-[A-Z][A-Z0-9]*-[0-9]+ ' impl --include=*.md | grep -v IMPL-DECISIONS | awk -F'|' '{print $2}' | sort | uniq -d
# ⑤ 真值
find docs/harness -name '*.md' -type f | wc -l                      # 159
find docs/harness -name '*.md' -type f -exec cat {} + | wc -l       # 79023
grep -rh '^```mermaid' docs/harness --include=*.md | wc -l          # 606
grep -rh '^| REQ-' docs/harness --include=*.md | wc -l              # 1861
# ⑥ v1 模块名（0 命中）
grep -rn 'mvn -pl open-coding' docs/harness --include=*.md
```
