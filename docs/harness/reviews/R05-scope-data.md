# R05 · 恢复 · 幂等 · 迁移一致性评审（数据与检索侧：impl/03、10、11、13、21）

> 评审轮次：REVIEW ROUND 5（镜头：恢复 · 幂等 · 迁移一致性 — 数据与检索侧）
> 范围：`impl/03-context-engine-impl.md`、`impl/10-memory-system-impl.md`、`impl/11-knowledge-system-impl.md`、`impl/13-agent-teams-impl.md`、`impl/21-git-worktree-impl.md` + 本文件
> 参照基准：`impl/16-event-bus-impl.md`（事件唯一事实源 / §⑩.4 回放隔离 / §⑩.9 协作规则 / `oc_projection_state`）、`impl/19-persistence-recovery-impl.md`（§⑥.4 六层合规删除 / §⑦.4 删除请求状态机 / §⑥.1 迁移安全序列）、`.qoder/rules/`（Java 示例规范，本轮**未新增任何 Java 示例**，故无违规面）
> 交付约束：**只增不改**——未删除任何小节、决策编号（`I-*` / `D-*`）、REQ 编号或既有结论；新增内容一律带「R05 新增」锚点便于机械检索；新增 REQ 仅两个（`REQ-MEM-21` / `REQ-GIT-21`），沿用 R04 的登记惯例（新编号在文件内自登记 + 本文件汇总）
> 结论摘要：五个有状态存储（上下文检查点 / 记忆 + 向量索引 / 知识索引 + 符号图 / 团队账本 + 黑板 / worktree 台账）逐存储补齐**崩溃 / 损坏 / 迁移**三条重建路径；删除模型逐域穿透到**派生索引、缓存、对象存储、快照、备份**五类残面；竞态注册 **24 条**（逐条核对控制类型：6 条原有控制直接通过，18 条补齐明确判定，含 1 条结构性缺口——团队结算缺唯一约束）；迁移计划补齐 **4 类版本维度**（嵌入模型 / 维度 / 分词器 / 解析器）+ 上下文 token 计量版本化；修复**结构性缺口 2 处**（团队黑板无持久化载体、worktree 台账无对账协议）；与 16/19 的口径分歧逐条收敛到权威源。

---

## 一、方法与可复核口径

1. 对每个存储先回答「**真源是什么**」，再回答三条重建路径：**(a) 进程崩溃**（提交点在哪、未提交是否视为未发生）、**(b) 损坏**（最小重建单位、是否可整体丢弃）、**(c) Schema 迁移**（版本字段、读取侧向上解释、回写禁令）。
2. 「索引不是真源」逐处核验：凡出现「查索引 → 推断源状态」的表述即判缺陷；凡缓存/投影未在 `oc_projection_state` 登记即判缺口。
3. 删除模型按 19 §⑥.4 六层（在线表 / 投影 / 索引 / 归档 / 日志段 / 备份）逐域对照，额外登记**跨域残面**（对象存储副本、快照与回滚点、导出包、Redis 计数器）。
4. 竞态清单按「同一资源的可并写路径」穷举，逐条追问「唯一约束 / CAS / 租约 / 仅追加」四类控制是否**已声明**；未声明即就地补。
5. 与 16/19 的一致性以「同一语义只有一处权威」核对：分区与 `seq`、至少一次 + 幂等、保留与归档、删除证明归属。

## 二、重建路径总表（五存储 × 三路径，跨文件对照）

| 存储（域） | 真源 | (a) 崩溃 | (b) 损坏 | (c) 迁移 | 落点 |
| --- | --- | --- | --- | --- | --- |
| 上下文快照 / 压缩记录 / 引用（03） | **事件流**（分区键 = `sessionId`）；快照 = 事件 + 来源清单的纯函数 | 未提交即不存在（同轮事务）；历史快照不重算 | 行损坏 → 按 `(sessionId, turnSeq)` 从事件重建；blob 缺失 → 显式「不可再读」 | `sections`/`breakpoints` JSONB 含 `schema_version`，只做向上解释 | `03:711`、`03:904`、`03:919` 表 |
| 上下文检查点（03） | 事件流（物化载荷为**加速**，非第二真源） | 写失败 3 次退避 → 降级「懒物化 + 事件锚点」 | 与 `event_anchor_seq` 不一致 → 丢弃载荷走事件重放并记降级 | `payload_format_version` + `estimator_version` 必填，超代拒绝强解 | `03:707`、`03:923` |
| 记忆条目 + 文件源（10） | `.oc/memory/*.md`（项目/组织层）+ `oc_memory_entry` 元数据 | 「先文件后索引」→ 崩溃后按 `content_digest` 重建索引 | 文件非法 → 保留旧索引 + 告警；条目损坏 → 以文件为准重建 | YAML 头字段只增不改；`version` 单调 | `10:894`、`10:899` 表；§6.4 漂移协议 |
| 记忆索引（全文 + 向量）（10） | **不是真源**（可由文件源 + 元数据整体丢弃重建） | `oc_memory_index_task` 状态机续跑；`PARTIAL` 不参与召回 | 全量重嵌 / 全文重建；`generation` 过滤禁止跨代混排 | 模型变更 / 维度变更 / 分词器变更三场景 → `oc_memory_index_generation` SHADOW→ACTIVE | `10:703`、`10:899` 表、`10:79`（REQ-MEM-21） |
| 知识索引 + 符号图（11） | **外部源 + commit**（`oc_kb_citation_audit` 除外：审计事实不可重建） | 批内单事务、批间独立提交 → 从游标续跑 | 块/符号/边按 `document_id` 重解析；图快照缓存直接淘汰 | `tsv_config_version` / `parser_version` / `embedding_generation` 变更即重建对应列 | `11:657`、`11:879`、`11:896-897`、`11:644-645` |
| 团队黑板 + 账本（13） | **黑板 = 调度唯一事实源**（本轮补 `oc_team_board_entry` 持久化载体）；账本自持久 | 与事件同事务；重启从 `max(seq)` 续写 | 条目损坏 → 按事件重建 `seq` 区间（只追加，禁止就地修补） | `topology`/`write_scope` JSONB 含 `schema_version` | `13:698`、`13:708`、`13:945`、`13:936` |
| worktree / 检查点台账（21） | **仓库自身**（`refs/*`、`.git/worktrees/*`、对象库）+ 卷 14 任务 | 对账修复（`DIR_MISSING` → `FAILED` 并释放租约） | 台账行损坏 → 由 `git worktree list` + 目录重建；检查点对象缺失 → `OBJECT_MISSING` 显式不可恢复 | 枚举只增不改；`reconcile_state` 以可空列 expand | `21:652`、`21:658`、`21:664`、`21:946` |

## 三、删除覆盖矩阵（五域 × 残面；「＋」= 本轮补齐的缺口）

| 残面 | 03 上下文 | 10 记忆 | 11 知识 | 13 团队 | 21 worktree |
| --- | --- | --- | --- | --- | --- |
| 在线表 | 快照/压缩/引用/检查点级联 | 条目 + 版本链 + 候选 | 源→文档→块三级置位（**＋含全部索引代**） | 团队/成员/黑板/消息/认领 | 七张台账表 |
| 派生索引与投影 | 诊断投影、`oc_projection_state` | 全文 + 向量（**＋含 SHADOW/RETIRED 代**） | HNSW/GIN/`tsv`/embedding | 三视图、时间线、成本瀑布 | 面板投影、队列视图 |
| 缓存 | `oc:ctx:*` 全键；符号图缓存按**仓库源**删 | 召回缓存 + 面板快照 + 队列条目 | 查询/repo map/图快照/嵌入/解析缓存（广播失效） | 全部 `oc:team:*`（含计数器） | 全部 `oc:git:*` |
| 对象存储 | artifact/compaction/checkpoint 对象 | **＋导出包 `memory/exports/**` 登记失效 + 物理清除** | **＋`kb/raw` 原件副本随源删除**、wiki 大页、治理报告 | 报告正文 + 消息大载荷 + 导出包 | 预检报告/冲突附件 |
| 快照 / 回滚点 | 冷归档快照写标记 + 读取过滤 | 备份 tombstone + 敏感条目 DEK 销毁 | 旧代索引 + 备份 tombstone | worktree 分支清单移交卷 21 | **＋`refs/oc/` 三类私有 ref（backup / attic / restore-transactions）+ attic 补丁 + 检查点 git dir 必须穿透** |
| 事件载荷 | 段内处置，不重写历史行（16 §⑩.9） | 只清引用（无原文） | 含 `citation_ref`/路径/符号名 | 含 `verdict`/`rationale` | 含尾注/文件清单 |
| 备份与证明 | 19 §⑥.4 / §⑦.4 统一执行器，本域只提交计数 | 同左；证明与 `oc_deletion_certificate` 哈希链对账 | 同左；证明不另立 | 同左；`oc_team_arbitration`「不可删」例外收敛为**主体过滤视图** | 同左 |
| 特有残面 | **来源删除传播**：`source_state=REMOVED` + 替换声明，禁止「快照已缓存」继续注入 | 组织层远端副本（`MemorySyncSPI` 冲突显式提示） | 知识页中由被删源生成的块 → 陈旧标记 + 降权 + 重生成 | 跨域交接：worktree 清理由卷 21 承接（团队不得直接删分支） | **凭据短租约即时失效**（不等待 TTL） |

> 未闭合的跨域事项：03 的冷归档过滤是否可被直接对象访问绕过（取决于归档介质是否支持读取时过滤）→ 见 §九 R1。

## 四、竞态注册表（24 条；★ = 本轮补齐的控制）

| # | 写路径 | 竞争形态 | 控制（类型） | 落点 |
| --- | --- | --- | --- | --- |
| 1 | 上下文快照写入 | 同轮双写 | 唯一 `(session_id, turn_seq)` + 装配锁租约 | `03:704` / `03:932` |
| 2 | 检查点写入 | 触发点重叠 | 唯一 `(session_id, seq)` + 幂等 upsert + 载荷绑定同一快照版本 ★ | `03:707` / `03:935` |
| 3 | 压缩提交 vs 检查点 | 压缩回滚后旧检查点残留 | 提交后触发 + 回滚覆盖/标记失效 ★ | `03:936` |
| 4 | 引用登记 | 同内容重复落盘 | 唯一 `(scheme, content_hash)` + 去重回读既有 `refId` ★ | `03:938` |
| 5 | 再读鉴权 vs 删除 | TOCTOU 读已删引用 | 鉴权与删除/过期判定同一判定内完成 ★ | `03:939` |
| 6 | 投影重建 vs 追加 | 重建期写入 | 16 §⑩.4 同分区互斥 + 租约 | `03:940` |
| 7 | 记忆候选写入 | 重复落库 | 幂等键 `(tenantId, scope, key, valueDigest)` + 部分唯一 | `10:906` |
| 8 | 记忆 supersede | 版本链分叉 | **条件更新 `WHERE status + version`，行数 ≠ 1 抛 `MEMORY_CONFLICT`** ★ | `10:907` |
| 9 | 记忆索引 vs 删除 | 索引任务「复活」已删条目 | 先置终态再清索引 + **提交前二次校验条目状态 + 清理在途索引任务** ★ | `10:908` |
| 10 | 记忆文件写入 vs 面板编辑 | 双写主题文件 | 原子替换 + `file_version` 条件写 + 冲突显式漂移 | `10:909` |
| 11 | 记忆归并 | 并发归并重复写入 | 单锁（性能）+ 幂等键（正确性，锁丢失仍去重）★ | `10:910` |
| 12 | 记忆召回缓存 vs 删除 | 命中旧缓存 | 同请求内清缓存（不依赖 TTL）+ 键含 generation ★ | `10:912` |
| 13 | 知识索引 vs 重建 | 双写同一 `document_id` | 源级独占锁（**重建与增量必须同一把锁**）+ 待办重放 ★ | `11:906` |
| 14 | 知识块写入 | 重复写入 | 幂等键 `(document_id, content_hash, generation)` + 幂等命中复用 `chunk_id` ★ | `11:907` |
| 15 | 嵌入代提升 | 并发 promote | **CAS `WHERE state='SHADOW'`，行数 ≠ 1 抛异常 + 旧代同事务 RETIRED** ★ | `11:908` |
| 16 | repo map 快照 | 跨 parser 版本静默复用 | 快照锁 + **绑定 `parser_version` 与 commit，跨版本禁止复用** ★ | `11:910` |
| 17 | 知识页生成 vs 人工编辑 | 自动覆盖人工块 | 页级锁 + 块保护 + 条件更新（`edited_hash`）★ | `11:911` |
| 18 | 源删除 vs 重建 | 重建复活内容 | 删除优先 + 写入前校验源状态 | `11:912` / `11:966` |
| 19 | 黑板追加 | 多成员并发、`seq` 重复 | 单写者串行 + `uk(team_id, seq)`；**禁止先查 `max(seq)` 再写** ★ | `13:952` |
| 20 | 团队认领 | 并发认领 | `claim_if_ready` 条件更新 + 部分唯一（行数 = 1） | `13:953` |
| 21 | 预算结算 | 同 `usage_ref` 重复扣减 | **部分唯一 `(member_id, usage_ref) where direction='SETTLE'` + 条件写余额** ★ | `13:699` / `13:954` |
| 22 | 团队合并入队 | 两套串行语义 | 卷 21 队列为唯一执行者，团队侧仅登记（禁止自行 merge）★ | `13:956` |
| 23 | worktree 获取 / 热池取用 | 同任务双目录、池目录双绑定 | `uk(repo_id, task_id)` + `ON CONFLICT DO NOTHING` + 回读；**取用与登记同事务** ★ | `21:970` |
| 24 | worktree 对账 / GC / 检查点回收 | 对账误删在途目录、GC 与创建竞态 | 三源比对 + 观察窗（先归档后删）+ 单实例锁 + **回收前二次校验引用** ★ | `21:948`、`21:973`、`21:974` |

## 五、索引与检索的迁移计划（本轮新增）

| 变更类型 | 域 | 检测 | 迁移 / 重建 | 落点 |
| --- | --- | --- | --- | --- |
| 嵌入模型变更（同维度） | 10 | 配置 `model` 变化 → 建 SHADOW 代 | 逐批重嵌 → CAS promote → 旧代 RETIRED；重建期旧代服务 | `10:703` 表第 1 行 |
| 向量维度变更 | 10 | `dim` 与活动代不一致 | **expand-contract**：新列/新分区 + 双写 + 回填 + 读切换 + 观察期后移除（禁用同列混存维度） | `10:703` 表第 2 行 |
| 分词器 / 切分配置变更（全文） | 10 | `tokenizer_version` 变化 | 建全文 SHADOW 代 → 重算 `tsv` → 抽样召回对比 → promote | `10:703` 表第 3 行 |
| 嵌入模型 / 维度（知识） | 11 | 代状态机 | SHADOW → ACTIVE → RETIRE；维度走新列 expand-contract；**代提升 CAS** | `11:908`、`11:900` |
| 解析器（符号抽取）变更 | 11 | `parser_version` 落库版本变化 | 按文件粒度重建符号与边 + 重算 PageRank + 淘汰旧图快照；`oc_kb_index_lag_seconds` 门禁 | `11:897`、`11:910` |
| 全文检索配置变更（知识） | 11 | `tsv_config_version` 变化 | 全文列整体重建（`pg_search` BM25 配置随版本） | `11:644`、`11:896` |
| **token 计量口径变更（上下文）** | 03 | `estimator_version` / `tokenizer_family` 落库 | **历史快照按写入版本解释，禁止重算回写**；校准账本按版本分桶；差异仅进诊断对比 | `03:704`、`03:951` |

> 历史会话可读性：03 的快照/检查点都带格式与计量版本（`payload_format_version` / `estimator_version` / `tokenizer_family`），读取侧只做向上解释；11 的 `oc_kb_citation_audit` 与 `oc_kb_wiki_revision` 作为审计/人工产物按版本链只追加。

## 六、快照 / 回滚 vs 合规（本轮补齐）

- **21（新增 REQ-GIT-21）**：合规删除必须穿透 `refs/oc/backup|attic|restore-transactions`、attic 补丁与检查点 git dir；历史不可变约束**只**约束事件流（16 §⑩.9），不豁免**可重建的本地快照**——这是本域此前的实质漏删风险（影子仓/attic 会长期保留已被要求删除的内容）。落点 `21:113`、`21:946`、`21:977` 表。
- **03**：快照与压缩地图属派生物，删除走 19 六层第 1/4 层；S3/S4 区段的来源被删后必须经 `oc_context_source_state=REMOVED` 下发替换声明，**禁止**以「快照已缓存」为由继续注入已删内容（`03:961`）。
- **10 / 11 / 13**：导出包、`kb/raw` 副本、报告正文分别纳入各自删除矩阵（`10:961`、`11:962`、`13:970`）。

## 七、与 16 / 19 的一致性核对（发现并修复的分歧）

| # | 事项 | 分歧描述 | 修复 |
| --- | --- | --- | --- |
| CO-1 | 黑板「唯一事实源」无载体 | 13 声明黑板为唯一事实源，但 §⑧.1 十张表**没有黑板条目表** → 崩溃后无持久事实可依，违反 REQ-TEAM-04 | 补 `oc_team_board_entry`（只追加 + `uk(team_id, seq)`）并在 §10.7 给出重建路径（`13:698`、`13:708`） |
| CO-2 | 团队结算可重复扣减 | 账本仅有 `uk(entry_id)`，同一 `usage_ref` 重放会二次扣减 | 补部分唯一 `(member_id, usage_ref) where direction='SETTLE'`（`13:699`） |
| CO-3 | worktree 台账与物理状态无对账 | 21 只有 GC 与状态机，缺「台账 ↔ 磁盘 ↔ `git worktree list` ↔ `refs/oc/*`」比对 → 漂移不可检测 | 补对账协议 + `reconcile_state`/`verify_state` + R5 修订建议（`21:946`、`21:942`） |
| CO-4 | 检查点「可恢复」断言无校验字段 | 21 检查点行无对象存在性校验 → 可能对缺失对象声称可恢复 | 补 `verify_state`（`OBJECT_MISSING` 时 fail-explicit）（`21:658`、`21:962`） |
| CO-5 | 知识块缺删除置位字段 | `oc_kb_document` 有 `deleted_at`，`oc_kb_chunk` 无 → 块级谓词无法强制过滤 | 补 `deleted_at` + 部分索引 + 三级置位规则（`11:644`、`11:658`） |
| CO-6 | 解析器 / 分词器版本未落库 | 缓存键含 `parserVersion`，但索引行不带版本 → 升级后旧行无法判定为陈旧 | 补 `parser_version`（symbol）与 `tsv_config_version`（chunk）（`11:644-645`） |
| CO-7 | 上下文 token 计量无版本 | 历史快照无法回答「当时用什么口径算的」 | 补 `tokenizer_family`/`estimator_version`/`calibration_epoch` + 不重算规则（`03:704`、`03:951`）、检查点 `payload_format_version`（`03:707`） |
| CO-8 | 域内「索引不是真源」缺显式声明 | 多处依赖该假设（降级、删除、重建）却无单点声明 | 五文件均落地不变式 + `oc_projection_state` 登记（03/10/11/13/21 各自 §真源与重建登记） |

## 八、复核命令（结论可独立复现）

```bash
# Mermaid 全量真实解析（本轮 5 份，期望 total=46 fail=0；改动前为 41）
node .research-cache/mmd-check/check.mjs docs/harness/impl/03-context-engine-impl.md docs/harness/impl/10-memory-system-impl.md docs/harness/impl/11-knowledge-system-impl.md docs/harness/impl/13-agent-teams-impl.md docs/harness/impl/21-git-worktree-impl.md
# 新增锚点检索（期望：54 行命中，其中「R05 新增」51 处）
grep -rn "R05 新增\|R05 数据与检索侧" docs/harness/impl/03-context-engine-impl.md docs/harness/impl/10-memory-system-impl.md docs/harness/impl/11-knowledge-system-impl.md docs/harness/impl/13-agent-teams-impl.md docs/harness/impl/21-git-worktree-impl.md | wc -l
# 新增决策 / 需求 / 字段检索（期望 ≥ 27 行）
grep -rn "REQ-MEM-21\|REQ-GIT-21\|oc_team_board_entry\|oc_memory_index_generation\|reconcile_state\|verify_state\|tsv_config_version\|payload_format_version" docs/harness/impl/*.md | wc -l
# 交叉引用完整性（期望：5 份文件各 ≥ 1 处引用 16 与 19；合计 16→6 行、19→5 行）
for f in 03-context-engine 10-memory-system 11-knowledge-system 13-agent-teams 21-git-worktree; do
  echo "$f: 16=$(grep -c '16-event-bus-impl.md' docs/harness/impl/$f-impl.md) 19=$(grep -c '19-persistence-recovery-impl.md' docs/harness/impl/$f-impl.md)"
done
```

核对结果：Mermaid **46/46 通过（fail=0）**；「R05 新增」锚点 **51 处**（含小节标题的 `R05` 标记共 54 行）；新增/细化编号命中 **27 行**；16/19 交叉引用覆盖 **5/5 份文件**；无 Java 代码块新增（`javabalance` 0 UNBALANCED），故 `.qoder/rules/` 五条规范按「本轮无新增 Java 代码」判定为通过；表格结构检查仅 3 处**既有**转义管道行（`\|`，非本轮引入）。

## 九、残余风险（按优先级排序）

| # | 风险 | 现状与理由 | 建议处置（下一轮 / 实现期） |
| --- | --- | --- | --- |
| R1 | **冷归档快照的「读取时过滤」依赖介质能力**：03 的快照/压缩地图进入 19 归档层后仅写删除标记，若归档介质不支持读取时过滤（如只读对象存储 + 外部直链），被删内容仍可被直接访问 | 19 §⑥.4 的归档层语义是「读时过滤」，未定义介质最小能力 | 在 19 增补「归档介质最小能力声明（支持读取时过滤 / 或需重写归档）」并纳入合规演练；03 侧已声明来源删除传播，但归档包内的历史正文仍受该前提约束 |
| R2 | **13 的 `oc_team_arbitration`「不可删」与 19 删除模型的口径冲突**：Phase A 卷 13 用语为不可删，本轮收敛为「含主体数据时按 19 主体过滤视图处置」，但未改动 Phase A 卷册 | 属契约措辞冲突，本文无权修改冻结卷册 | 登记进 `IMPL-DECISIONS.md` 修订建议（与 13 §10.6 现有 4 条并列），由终局审计裁决 |
| R3 | **超大租户的跨代重嵌成本无容量模型**：11 的维度变更要求全量重嵌（500 万块量级），迁移计划有步骤但无窗口/成本上限与限速门禁 | 容量估算只覆盖稳态（§⑩.3） | 实现期补「重嵌吞吐 × 代窗口」测算与租户级限速配置（`kb.embedding.rebuild-rate` 类），并纳入 31 成本口径 |
| R4 | **对账的孤儿判定窗口与并发创建窗口可能重叠**：`ORPHAN_DIR` 依赖观察窗（24h）与 `reconcile-interval`，极端时序下可能把在途目录判为孤儿 | 已有「先归档后删 + 不 rm -rf + 二次校验」三道缓解 | 实现期补「创建-对账竞态」故障注入用例（进程在 `CREATING` 中暂停 > 观察窗），断言不误删 |
| R5 | **记忆导出包清单载体未定**：10 的删除要求「导出包登记失效 + 物理清除」，但导出包为 `<ts>.zip` 无清单表，无对象存储列举能力的环境无法枚举 | 导出任务本身幂等，缺的是「按主体反查导出包」的索引 | 实现期新增导出包清单（对象前缀 + `oc_memory_export_job` 行）或改为版本化前缀 + 主体键，二选一并在 19 导出框架内统一 |
| R6 | **快照可重建性依赖事件载荷的完整来源清单**：03 声明「按事件重建同一快照」，前提是 `context.assembled` 载荷必含逐段来源清单与哈希；Schema 演进若遗漏该字段，重建将退化为不可复现 | 16 §⑩.10 允许「新增可选字段」，未强制该载荷的存在性 | 在 16 的 Registry 门禁中为 `context.assembled` 增加「来源清单非空」的结构断言（golden 文件），并把「可重建性」列为该事件类型的兼容性红线 |

> 交付说明：本轮改动仅落在上述 5 份 impl 文件与本文；未删除任何小节、决策编号、REQ 编号与既有结论；新增内容全部为「加严 / 补全」方向（补唯一约束、补 CAS、补对账、补版本字段、补删除穿透），并同步写入各文件的故障注入矩阵与 DoD 勾选项，便于终局审计按「R05」锚点批量核验。
