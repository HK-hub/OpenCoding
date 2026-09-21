# R01 · 企业/生态/前沿层机械校验与编号一致性评审（impl/25 – impl/35 + 索引/台账/附录 D）

> 评审轮次：REVIEW ROUND 1（镜头：机械校验与编号一致性）
> 范围：`impl/25` … `impl/35`（11 份）+ `impl/README.md` + `impl/IMPL-DECISIONS.md` + `34-automation-templates.md` + `35-intelligent-augmentation.md` + `appendix-d-component-inventory.md`（共 16 份，12,840 行）
> 参照：`DECISIONS.md`、`research/LESSONS-AND-ADOPTIONS.md`、`.qoder/rules/*`、`00-vision-and-product.md`
> 结论：**11 节模板 / Mermaid（修复后）/ I-决策台账 / README §2 索引 / 附录 D / 占位 / Java 规范 全部通过；4 项 SAFE 修复已落地；5 项编号体系类缺陷登记报告（不擅改编号）。**

---

## 一、方法与工具（可复核）

| # | 检查项 | 手段 | 覆盖量 |
| --- | --- | --- | --- |
| 1 | 模板完整性 | Node 脚本抽取全部 `^##` 标题，按 11 节环形序号（①–⑪，或 `1.`–`11.`）做存在 + 顺序断言；卷 34/35 对 10 元素骨架逐项匹配 | 11 份 × 11 节 + 2 卷骨架 |
| 2 | Mermaid 合法性 | `node .research-cache/mmd-check/check.mjs`（mermaid 11.17.2 + jsdom 真解析，非启发式）+ 围栏配对脚本（偶数校验） | 102 图 + 16 文件围栏 |
| 3 | REQ/I 编号一致性 | 逐文件抽 `REQ-<域>-[0-9]+`（表行定义重复检测、缺口检测、空单元格检测）；I- id 与 `IMPL-DECISIONS.md` §2 双向 diff（逐 id 集合比对） | 11 域 94 条 I- / 11 张 REQ 表 |
| 4 | README §2 索引核对 | Node 脚本复算 35 行「REQ 数 / I-决策数 / 图数」并与表内声明逐行比对 + 合计 | 35 行 + 合计 817/268/296 |
| 5 | 附录 D 完整性 | 解析 D.1–D.5 全部行：行数、分组、类型、状态分布、`实现方案`列 `impl/NN` 存在性；D.6/D.7 覆盖映射逐项核对 | 137 行 + D.6 26 行 + D.7 |
| 6 | 交叉引用有效性 | `卷 NN` 范围校验、`H-`/`L-`/`X-`/`D-` id 集合比对、`.md` 文件引用多根解析（repo root / harness / impl / research / competitors / archive） | 卷引用全量 + 70 个 L- + 8 个 H- + X-1…81 + 217 个 D- 引用 + 100 个去重 `.md` 引用 |
| 7 | 格式与占位 | 严格词表 `TODO\|FIXME\|待填\|TBD\|占位\|WIP`；空节检测（`##` 后直到下一同级标题无内容）；围栏奇偶校验 | 16 文件全文 |
| 8 | Java 规范抽样 | 抽取全部 ` ```java ` 块（35 块 / 1,531 行），每文件抽 3 块（不足 3 块者 100% 覆盖，实抽 23 块）+ 对全部围栏（java/text）执行 8 条机械规则扫描 | 35 块 / 1,531 行 |

机械规则集（检查 8）：`LoggerFactory.getLogger`、`System.out.print*`、`printStackTrace()`、`log.*("…" + var)` 拼接、`log.*(e.getMessage())`、裸抛 `RuntimeException/IllegalArgumentException`、`// TODO|FIXME`、`BusinessException("")`；辅以 `@Slf4j` 覆盖与日志占位符 `{}` 与参数数比对。

---

## 二、逐项结果

### 检查 1 · 模板完整性 —— 通过（11/11 + 2/2 卷 + 附录 D 齐全）

| 对象 | 结果 | 备注 |
| --- | --- | --- |
| 25/26/29/30/31/32/33/34/35 | ✅ ①–⑪ 全序一致 | 环形序号 |
| 27/28 | ✅ 1.–11. 全序一致 | 阿拉伯序号；追加 `## 12. 实现级决策汇总`（模板外增量，见 F-09） |
| 卷 34 / 卷 35 | ✅ 骨架 10 元素全中（本卷定位 / 原始意图与需求 / 设计空间 M×N / 比选矩阵 / 选定方案详设 / 扩展点与插件面 / 事件与可观测 / 非功能 / DoD / 开放问题） | 34 另有「附录 · 既有草稿决策对齐」 |
| 附录 D | ✅ 全量清单 D.1–D.5（137 行）+ 孤儿检查 D.7（D.7.1 0 孤儿 / D.7.2 跨卷 / D.7.3 卷覆盖 / D.7.4 统计） | 详见检查 5 |

### 检查 2 · Mermaid 合法性 —— 修复后通过（102/102）

| 文件 | 图数（实跑） | 类型分布 | 失败 |
| --- | --- | --- | --- |
| 25 / 26 / 28 / 30 / 33 | 各 9 | flowchart1/class1或2/seq4–5/state2 | 0 |
| 27 | 8 | flowchart1/class1/seq4/state2 | 0 |
| 29 | 8 | flowchart1/class1/seq4/state2 | **1 → 已修复**（F-02） |
| 31 / 35 | 各 7 | flowchart1/class1/seq3/state2 | 0 |
| 32 | 10 | flowchart2/class1/seq5/state2 | 0 |
| 34 | 11 | flowchart1/class1/seq6/state3 | 0 |
| README / IMPL-DECISIONS / 附录 D | 0 / 0 / 0 | — | — |
| 卷 34 / 卷 35 | 各 3 | flowchart | 0 |

首行关键字全部 ∈ {flowchart, classDiagram, sequenceDiagram, stateDiagram-v2}；修复后 16 文件围栏奇偶全部为偶（28 号文件 33→34，见 F-01）。

### 检查 3 · REQ/I 编号一致性 —— 通过（表内 0 缺陷），编号体系 3 类问题登记

| 文件（域） | REQ 区间（去重实算） | 表内重复 | 缺口 | 空单元格 | I- 决策 文件↔台账 |
| --- | --- | --- | --- | --- | --- |
| 25（ENT） | 1, 13–41（30） | 0 | 0 | 0 | 6/6 ✅ |
| 26（COST） | 01–28（28） | 0 | 0 | 0 | 9/9 ✅ |
| 27（SEC） | 1–22（22） | 0 | 0 | 0 | 7/7 ✅ |
| 28（DIST） | 1–22（22） | 0 | 0 | 0 | 7/7 ✅ |
| 29（ECO） | 01–32（32） | 0 | 0 | 0 | 10/10 ✅ |
| 30（UX） | 01–31（31） | 0 | 0 | 0 | 9/9 ✅ |
| 31（AUTO） | 1–18（18） | 0 | 0 | 0 | 8/8 ✅ |
| 32（INTEL） | 1–24（24） | 0 | 0 | 0 | 10/10 ✅ |
| 33（QA） | 01–30（30，另 1 处引用）+1 引用 | 0 | 0 | 0 | 10/10 ✅ |
| 34（OPS） | 01–30（30，另 1 处引用） | 0 | 0 | 0 | 10/10 ✅ |
| 35（FRONTIER） | 01–30（30） | 0 | 0 | 0 | 8/8 ✅ |

- I- id 双向 diff：**0 缺 0 多**（94 条，逐 id 集合比对）；I- 号段连续无缺口（各域 1..n 全中）。
- **README §2 索引实算比对：35 行 + 合计零失配**（合计 REQ 817 / I 268 / 图 296 与实跑一致，索引未说谎）。
- 遗留编号体系问题（不擅改，登记见 F-03）：padding 混用、与 Phase A 同号段语义不延续、同串同号不同义（impl/32 vs 卷 35）。

### 检查 4 · 附录 D 完整性 —— 通过，1 处映射笔误已修复

| 项 | 声明值 | 实算值 | 判定 |
| --- | --- | --- | --- |
| 组件总行数 | 137 | 137 | ✅ |
| 分组 | K42 / P33 / E32 / T16 / X14 | 42/33/32/16/14 | ✅ |
| 类型 | 63/28/8/9/15/14 | 63/28/8/9/15/14 | ✅ |
| 状态 | 完成 70 / 待实现 67 / 设计完成 0 | 70/67/0 | ✅ |
| D.6 轮次 2 核对 | 26/26 | 26 行 | ✅ |
| `实现方案`列文件存在性 | — | 全部命中（impl/01–35 均存在，含 E-32 双引用 23+30） | ✅ |
| D.7.3 卷覆盖映射 | 30→…、T-14 | 30 卷实为 X-14（T-14 属 28） | **笔误 → 已修复**（F-05） |

### 检查 5 · 交叉引用有效性 —— 通过（0 悬空）

- `卷 NN`：仅出现 00–35，无越界；`H-` 8 个（001/002/003/005/006/011/015/019）全部存在于 `DECISIONS.md`。
- `L-`：本 16 份共 70 个去重引用，对 `LESSONS-AND-ADOPTIONS.md` 有效 id 集 **0 悬空**。
- `X-`：范围全部 ∈ X-1…X-81；`IMPL-DECISIONS.md` §4.2 共 81 行、无缺号无重号；README §4 逐文件建议数与 §4.2 登记数可解释一致（impl/26 的 7 行原始建议中 1 行合并入 X-62）。
- `D-`：217 个引用全部落在 Phase A 域码区间内；本地型前缀（D-QC/D-IQA/D-IOPS/D-ECOIMPL/D-UXIMPL/D-CLII/D-WSI）与 D-INTEL 见 F-07。
- 路径引用：`docs/harness/24-enterprise-operations.md` 等 repo-root 相对路径、`research/competitors/0N-*.md`、`archive/34-automation-playbooks.superseded.md`、`archive/35-ai-enhancements.superseded.md`、`agents.md`、`.qoder/rules/*` **全部存在**；`SKILL.md`（32:88、35:90）为竞品格式描述，非仓内路径。

### 检查 6 · 格式与占位 —— 通过

- 严格词表实际占位 **0**；全部 `占位` 命中均为合法用法（「占位符」=日志 `{}` 纪律表述、「待补值提示」=产品功能、`IMPL-DECISIONS §3.3 待补清单` 的正文为「无」）。
- 空节 **0**（`##`/`###` 后至下一同级标题间无内容者为零）；围栏奇偶：修复 28 号文件后 16 文件全偶。

### 检查 7 · Java 规范抽样 —— 通过（35 块，0 违规）

| 规则 | 命中 |
| --- | --- |
| `LoggerFactory.getLogger` / `System.out.print*` / `printStackTrace()` | 0 |
| 日志拼接 `log.*("…" + v)` / `e.getMessage()` 替代 Throwable | 0 |
| 裸抛 `RuntimeException` / `IllegalArgumentException` / 空文案异常 | 0 |
| 日志 `{}` 占位与参数不匹配 | 0（初报 5 处为多行调用误报，逐行复核均为正确形态） |
| `@Slf4j` 缺失（块内含 `log.*` 却无注解） | 0 |
| 写方法缺 `@Transactional(rollbackFor = Exception.class)` | 0（抽样中含写路径的块均带注解） |

抽样形态：27/28 各 3 块、29/30/31/32 各 3 块（全部块）、25/26/33/34/35 各 1 块（该 5 文件全文仅 1 个 java 块，100% 覆盖）。观察项：29:450/499 `IllegalStateException`（系统/配置类，带 cause 或不表达业务失败）见 F-08。

---

## 三、发现清单（文件:行 + 证据 + 严重度）

| ID | 严重度 | 位置 | 证据 | 处置 |
| --- | --- | --- | --- | --- |
| F-01 | 中 | `impl/28-distribution-telemetry-impl.md:378` | 代码块闭合围栏与末行粘连：末行 `}` 之后**同行**直接出现三个反引号（未换行），导致该文件围栏计数为奇（33）、`UpdateCore` 块与下一 `java` 块配对错乱 | **已修复**（§四） |
| F-02 | 中 | `impl/29-developer-ecosystem-impl.md:348` | 同一行写两条 class 关系（`SdkLanguageGenerator ..> ContractIr  SdkGenerationPipeline o-- SdkLanguageGenerator`），mermaid 真解析报错 `Parse error on line 85 … got 'AGGREGATION'` | **已修复**（§四） |
| F-03 | 中 | 26/29/30/33/34/35（padding）、27/28/29/33/34/35（Phase A 同号段）、`impl/32` vs `35-intelligent-augmentation.md` §2.3 | ① padding 混用：同套文件内 `REQ-COST-01`（26）与 `REQ-SEC-1`（27）并存，33/34 文件内混用（正文 `REQ-QA-01`，引 3 行处 `REQ-QA-1…8` 指向 Phase A）；② 与 Phase A 号段重叠且语义不延续：`REQ-SEC-2`＝「A0 引用式使用」vs 卷 00 `REQ-SEC-2`＝「信任边界建模」、`REQ-OPS-1`＝「SLO 与燃尽」vs impl/34 `REQ-OPS-01`＝「分层探针」等；③ 同串同号不同义：卷 35 `REQ-INTEL-3/4/5`＝「质量门禁链/成本控制/PR 描述」而 impl/32 同名号＝「运行幂等/门禁链/预算守卫」；impl/35 §② 标题「续 REQ-FR-1…12」但全文无 REQ-FR 连续号（REQ-FRONTIER-01＝五级阶梯≠REQ-FR-1 多模态） | 报告（编号体系变更须作者裁决；同源先例见 `reviews/R01-scope-collab.md` F-05） |
| F-04 | 中 | `impl/IMPL-DECISIONS.md:554` | §3.2「高密度文件（≥9 条）」清单漏列 impl/29（10）、impl/32（10），实算 ≥9 共 10 份 | **已修复**（§四） |
| F-05 | 中 | `appendix-d-component-inventory.md:259` | §D.7.3 卷 30 覆盖映射写作「30→E-07…E-11、T-14」，T-14 主卷为 28；卷 30 实含 X-14（包仓库与镜像源） | **已修复**（§四） |
| F-06 | 中 | `appendix-d-component-inventory.md:6,269` | 状态列滞后：49 行指向 impl/25–34 仍记「待实现」，并声明「批次 3 产出中」；而 impl/25–35 已全部落盘（mtime 2026-09-21 01:19–01:23） | 报告；批量状态翻转属流程动作，待编排方统一执行（表尾维护约定已预告） |
| F-07 | 低 | `impl/29:89-159`、`30:90-…`、`33:98-…`、`34:108-…`、`26:128-…`、`22:116-…`、`20:121-…`；`35-intelligent-augmentation.md` §11 | impl 内使用本地型决策前缀（D-ECOIMPL-n、D-UXIMPL-n、D-QC-n、D-IQA-n、D-IOPS-n，及他文件引用的 D-CLII-2/D-WSI-10），均在同文件定义、非悬空，但未登记于 `DECISIONS.md` 域码表，与 Phase A 同域 `D-` 号段并列易混；D-INTEL-1…8 定义于卷 35 §11，而 `DECISIONS.md` §2 仍记「AI→D-AI-0…12」（X-69 已就 D-AUTO 同类问题登记治理项） | 报告；建议注册域码或在 §③ 加「本节 D-xx-IMPL 为文件内分叉号」声明 |
| F-08 | 低 | `impl/29-developer-ecosystem-impl.md:450,499` | `throw new IllegalStateException(...)`（验签器不可用 / 公钥未配置）。不在 exception-handling-rules 禁令清单（仅禁 RuntimeException/IllegalArgumentException/NPE）且 450 带 cause，但与「统一业务异常」精神存在张力 | 报告；建议确认系统级异常口径 |
| F-09 | 低 | `impl/27`、`impl/28` | 采用 `## 1.`–`11.` 并以 `## 12. 实现级决策汇总` 收尾，与 README §1.2「11 节固定顺序」表述有偏差（同类先例：impl/17、18 已由协作层轮次登记） | 报告（范围说明，无内容缺失） |

---

## 四、已应用的修复（before / after）

| # | 文件:行 | before | after | 依据 |
| --- | --- | --- | --- | --- |
| 修复 1 | `impl/28-distribution-telemetry-impl.md:378` | 行尾 `}` 之后**同行粘连**三个反引号（未换行，围栏失效） | `}` 与独立成行的三个反引号（拆为两行） | 围栏未闭合使文件计数为奇、块配对错乱；修复后围栏 34（偶），复检 java 块 7 个结构完整 |
| 修复 2 | `impl/29-developer-ecosystem-impl.md:348` | `  SdkLanguageGenerator ..> ContractIr  SdkGenerationPipeline o-- SdkLanguageGenerator` | 拆为两行：`  SdkLanguageGenerator ..> ContractIr` / `  SdkGenerationPipeline o-- SdkLanguageGenerator` | mermaid 单行仅允许一条关系；修复后该图 `OK`（复检 28/29 共 17 图全 OK） |
| 修复 3 | `impl/IMPL-DECISIONS.md:554` | 高密度清单「impl/15、16、21、22、26、30、33、34」 | 「impl/15、16、21、22、26、29、30、32、33、34」，示例补「生态/智能增强」 | 与 §3.1 逐域计数（29=10、32=10）一致 |
| 修复 4 | `appendix-d-component-inventory.md:259` | 「30→E-07…E-11、T-14」 | 「30→E-07…E-11、X-14」 | 以表内「归属卷」列为唯一事实源（T-14@28、X-14@30） |

**未新增/删除任何内容**；未改动任何 `I-` 决策编号、未回改 Phase A 卷册；未触碰 16 份范围文件以外的文件（仅本报告）。

---

## 五、未修复项的处置理由

1. **F-03（编号体系）**：涉及 ~150 处 REQ id 改写或映射表补写，且「padding 统一方向」「Phase A 号段如何延续」需作者裁决；本镜头明确「不要 renumber（报告）」，故只登记。建议：先出「REQ id 规范一页纸」（padding 方向、断点声明格式、域码映射行），下一轮一次性对齐。
2. **F-06（附录 D 状态滞后）**：49 行状态 + 表头「批次 3 产出中」属流水线同步动作，应由编排方在批次 3 收口时批量翻转（表尾维护约定已写明「落盘后本表状态应批量更新」）。
3. **F-07/F-08/F-09**：为治理与口径建议，均非机械错误，留待作者确认。

---

## 六、复核结论（本轮）

- 11 节模板 **11/11 通过**；卷 34/35 骨架 **2/2 通过**；附录 D 清单 + 孤儿检查齐全且数值自洽。
- Mermaid **102/102 解析通过（0 失败，修复 1 处）**；围栏奇偶修复后 **16/16 为偶**。
- REQ 表内 **0 重复 / 0 缺口 / 0 空单元格**；I- 决策文件↔台账 **双向 diff = 0**；README §2 索引 **35 行 + 合计 0 失配**。
- 交叉引用 **0 悬空**（卷 / 文件 / H- / L- / X- / D- 全量）；占位词表与空节 **均 0**；Java 机械规则 **0 命中**。
- 缺陷 9 项：**中 6（F-01/F-02/F-04/F-05 已在位修复，F-03/F-06 为报告）**、低 3（F-07/F-08/F-09 报告）；另有先例登记项 1（impl/17、18 数字小节）。
- 机械层判定：**本 16 份产出在可自动校验维度上达到可提交状态**；F-03 编号体系裁决后进入下一轮一致性复核。
