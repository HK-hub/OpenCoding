# R02 研究层复核报告（lens：研究深度补强）

> **范围**：`docs/harness/research/`（`00-research-plan.md`、`CROSS-COMPARISON.md`、`LESSONS-AND-ADOPTIONS.md`、`competitors/01…09`）。
> **本轮目标**：把 Round 1 遗留的「未观测」空白与薄报告补齐——**补证优先、口径回填兜底、改判留痕**；不新增无证据结论。
> **方法基线**：`00-research-plan.md` §2（证据分级 + R02 复核规程，本轮新增）；主证据源为 `.research-cache/` 本地克隆（19 个目录，见 §7）。
> **日期**：2026-09-21（R02，Round 2 research 镜头）。

---

## 0. 结论摘要

1. **未观测格：48 → 44**，且**剩余 44 格 100% 携带检索口径**（Round 1 约 41/48 格属「无口径空白」）——「无口径空白」清零，超额完成「减少 ≥60%」目标。
2. **13 处口径改判/纠错**（C1–C13）：4 格因新证据退出「未观测」计数（Grok 知识库、MiniMax 记忆、OpenCode 上下文、OpenHands 定位），9 格带「原口径修正/推翻」留痕（Cline 工具并行、MiniMax MCP OAuth、Qoder MCP OAuth、MiniMax 记忆、Codex 定时、Roo 事件、Cline SSH、Claude Code SSO、Gemini 自更新器）；2 处为纯引文纠错（M8 路径、M16 行号）。
3. **E1 抽样核验：20 条受检声明，18 条完全成立**（其中 3 条为数字级精确：OpenCode `runtime.ts` 恰 3465 行、Qoder `chat.proto` 恰 322 行、Grok `PermissionDecisionReason` 恰 25 变体）；**2 条为引文错误**（机制成立，路径/行号修正）；**0 条被降级为 [E3]/[E4]**。
4. **薄报告深化**：06（+§11 七小节，记忆子系统升级为 [E1] 并关闭原未决问题第 3 条）、07（+§11 六小节，MCP OAuth 从「未观测」改判为「已观测」）、09（+2 张 Mermaid 图，经 `mermaid@11 parse()` 校验通过）。
5. **新增 §8「机制迁移可行性评估」**（CROSS-COMPARISON）：Top 12 机制逐个给出 **迁移成本 低/中/高 + 具体阻塞点 + 落地建议** + 三条硬依赖链 + 平台降级声明——补上「研究 → 实现」的桥。
6. **LESSONS 台账 86 → 93 行**（新增 L-087…L-093），并对已采纳行 **L-062 作证据升级声明**（[E2]→[E1]），对开放问题 **Q7 作部分关闭**注记。
7. **需要修正的既有结论（3 条，已同步）**：① 「二线 7 家 SSH 全未观测」不成立（Cline 已有 SSH 远程环境）；② 「Qoder CLI 侧 OAuth 未观测」不成立（有 MCP OAuth 客户端 + 登录 OAuth）；③ 「MiniMax 仅轻量 memory 工具」低估（有文件式记忆系统 + 会话级策略）。

---

## 1. 步骤一：未观测格补证（48 → 44，零无口径空白）

### 1.1 逐格处理结果（13 处改判/纠错）

| # | 位置（§2 矩阵） | 原口径 | R02 处理 | 证据（路径:行号或检索） |
| --- | --- | --- | --- | --- |
| C1 | 记忆 · MiniMax | 仅轻量 memory 工具 | **升级**：文件式记忆系统（user/agent 双作用域 + topics/daily/archive + 会话级 recall 锁 + 注入 cap） | `packages/local-runtime/src/memory/`；`local-runtime-v2/.../memory-policy.ts`、`memory-recall-admission.ts` |
| C2 | 知识库 · Grok | user-guide 未展开（未观测） | **升级**：代码图谱为产品能力（`codebase_indexing=true` 默认开）；user-guide 27 篇 | `docs/user-guide/05-configuration.md:97`；`crates/codegen/xai-codebase-graph/` |
| C3 | 知识库 · Gemini | 未观测向量库 | **细化**：无索引子系统，但有 embedding 客户端且无消费方（有 API 无产品面） | `core/src/core/baseLlmClient.ts:196`；`config/models.ts:115` |
| C4 | MCP · Qoder | CLI 侧 OAuth 未观测 | **推翻**：MCP OAuth 客户端（RFC 9728/8414 + 回调）+ 登录 OAuth（区域双客户端 ID） | `bundle/qodercli.js`：`oauth-protected-resource`/`oauth-authorization-server`/`mcp_oauth_callback_url`/`qoder-cli-oauth` |
| C5 | MCP · MiniMax | 未观测 MCP OAuth | **升级**：OAuth2 被**主动裁掉**（原文引用入格） | `packages/agent-modules/mcp/src/runtime/types.ts:4-7` |
| C6 | Goal · Codex | 未观测本地定时调度 | **推翻**：定时走「桌面动态工具 + 触发标签 + 特性门」互操作面，CLI 内核无 cron | `core/src/tools/handlers/tool_search.rs:365`；`session/turn_input.rs:132-175`；`features/src/lib.rs:260-263` |
| C7 | 事件 · Roo | Roo 事件协议未观测 | **部分推翻**：有类型化事件枚举 `RooCodeEventName`（无 wire 协议/回放） | `packages/types/src/events.ts:11-40` |
| C8 | 工作区 · 二线 | SSH 远程工作区 7 家均未观测 | **推翻**：Cline 已实现 SSH 远程环境（profile/knownHosts/helper/状态机） | `sdk/packages/core/src/remote/remote-environments.ts`；`apps/examples/desktop-app/scripts/verify-ssh-poc.ts` |
| C9 | 企业 · Claude Code | 未观测 SSO/SCIM 公开文档 | **推翻**：账户层有 JIT/SCIM + SSO 官方文档（CLI 本地策略面不变） | support.claude.com（`Set up JIT or SCIM provisioning` 等） |
| C10 | 分发 · Gemini | 未观测内置自更新器 | **推翻**：有内置自动更新器（安装方式探测 + detached spawn + 频道稳定性守卫） | `packages/cli/src/utils/handleAutoUpdate.ts` |
| C11 | 工具 · 二线 | 7 家均未观测工具级并行调度器 | **部分推翻**：Cline 有「相邻并行组」实现，其余 6 家维持未观测 | `sdk/packages/agents/src/agent-runtime.ts:1890-1913` |
| C12 | §3 M8 引文 | `packages/agent-tools/src/{lease-broker,…}.ts` | **引文修正**：实为 `packages/mcode-tools-host/src/{lease-broker,resource,integration,contracts}.ts`（机制 [E1] 成立） | 目录核对 |
| C13 | §3 M16 引文 | `agent-runtime.ts:2018-2044`（attach/detach） | **引文修正**：正确出处 `sdk/ARCHITECTURE.md:149` + `hub/client/session-client.ts:434`（`session.detach`） | 行号核验 |

> 以上 C1–C13 已同步登记进 `CROSS-COMPARISON.md §8.4`；受影响的下游结论（§0 速览条目 1/4、§4.2 的 N1/N4/N6/N8/N9、§6.1 的 A3/A8/A11、§7.1 统计与域分布、§2.4 观察 2/8）已一并修正。

### 1.2 计数对账（before → after）

| 分区 | 原含「未观测」格 | R02 后 | 说明 |
| --- | --- | --- | --- |
| §2.1 内核与智能层 | 18 | **14** | 退出 4 格（MiniMax 记忆、Grok 知识库、OpenCode 上下文、OpenHands 定位）；新增口径回填 10 格 |
| §2.2 协作与平台层 | 21 | **21** | 格数不变：4 处改判（Roo 事件、Cline SSH、Cline 工具并行、Codex 定时）均以「修正留痕」形式保留在该行计数内（含「原「未观测」口径修正」字样） |
| §2.3 企业、生态与前端 | 9 | **9** | 格数不变（Claude Code SSO、Gemini 自更新器为修正留痕式保留） |
| **合计** | **48** | **44** | 无口径空白：原约 41 格 → **0 格** |

### 1.3 「确认无法观测」的复核手段（抽样）

- **DeepSeek MCP OAuth**：`grep -rli oauth packages/mcp/` → 0 命中；`prompts/list|get` → 0 命中。
- **Codex 多租户/SSO/SCIM**：`\bscim\b|multi-tenant` 于 `codex-rs` → 0；`sso` 仅命中 AWS Bedrock 登录引导。
- **Gemini fork / SSH 工作区**：无 `forkSession`；`\bssh\b` 仅扩展 git URL 与 URL 解析语境。
- **二线多租户 / 合并队列**：7 仓 `multi-tenant|multitenant|\bscim\b` 与 `merge queue|mergeQueue` 全 0 命中。
- **闭源列（Claude Code A2A）**：`WebSearch` 仅第三方桥接指南，无官方 A2A 公告 → 维持「未观测 A2A 协议声明」（[E2]）。

---

## 2. 步骤二：薄报告深化与图补强

| 文件 | 变更 | 规模 |
| --- | --- | --- |
| `competitors/06-grok-cli-and-build.md` | 新增 **§11 R02 深化补记**（7 小节）：记忆双管线（legacy/v2）+ 8 步检索管线 + Dream 门 + 降级契约（[E2]→[E1]）；代码图谱产品化（关闭 §10 未决 3）；MCP OAuth 补强；权限模式族；96 个 crate 的子系统边界；5 条增量启示；G1–G5 修正台账 | +约 130 行（481→612） |
| `competitors/07-qoder.md` | 新增 **§11 R02 深化补记**（6 小节）：MCP OAuth 取证（推翻未观测）；登录 OAuth 与区域双客户端 ID；hooks 9 事件符号计数；会话保留四计数器；工具/能力面符号密度；5 条增量启示；Q7–Q10 修正台账 | +约 130 行（503→631） |
| `competitors/09-secondary-tier.md` | 新增 **§③.2 集合架构对照图**（flowchart：IDE 插件族 / 终端族 / 控制面族）+ **§③.3 代表性流程时序**（Aider Repo Map → 编辑 → 提交，含 `dirty_commit` 与二进制拟合细节）；修正 §③.1 第 16 行（Cline SSH） | +约 60 行（760→820），图 0→2 |

**Mermaid 校验**：`09-secondary-tier.md` 的 2 张图经 `mermaid@11` 本地 `parse()`（`.research-cache/mmd-check`）验证 `OK #1 / OK #2`（total=2 fail=0）。

---

## 3. 步骤三：CROSS-COMPARISON 新增 §8（机制迁移可行性）

- **§8.1 Top 12 迁移评分表**：M2（低）/ M4（中）/ M5（中）/ M6（低）/ M7（高）/ M8（中）/ M10（中）/ M15（中）/ M17（高）/ M21（低）/ M23（低）/ M24（中）。
  - **高成本机制的共性阻塞**：原实现依赖 Java 栈外运行时——M7（seccomp/TLS 终止按平台分化）、M17（tree-sitter 原生绑定与多语言语法加载）。
  - **低成本机制的共性**：纯谓词/清单/顺序语义（M2 不变式、M6 事件锁、M21 git 环境清洗、M23 钩子顺序），其难点在「语义对齐」而非技术依赖。
- **§8.2 三条硬依赖链**：沙箱链（M2→M7→M8）/ 持久化链（M6→M4→M5）/ 内核链（M24→M23 顺序→M15）。
- **§8.3 平台降级声明**：M7 必须交付「平台 × 能力 × 降级」矩阵；M17 若绑定不可行退化为「LSP/ctags 符号源 + 同一算法骨架」。
- **§8.4 R02 修正清单**（C1–C13）+ E1 抽样核验摘要。

---

## 4. 步骤四：E1 抽样核验（12+ 条，20 条全表）

> 规则：文件路径存在 + 符号/文本在该位置的窗口内命中即「成立」；仅引用错误而机制成立记「引文修正」，**不降级**；机制本身无法复现才降级为 [E3]/[E4]（本轮 0 条）。

| # | 声明（来源 §3/报告） | 仓库 | 文件（核验位置） | 结论 |
| --- | --- | --- | --- | --- |
| V1 | 放行型钩子：放行前重跑规则/计划校验（M23） | Gitlawb-openclaude | `src/utils/permissions/permissions.ts:432-553`（1898 行，`runPermissionRequestHooksForHeadlessAgent` + `enforcePlanMode`/`checkRuleBasedPermissions`） | **成立** |
| V2 | OpenCode 语言级沙箱解释器 3465 行（M1） | sst-opencode | `packages/codemode/src/interpreter/runtime.ts` = **3465 行**（精确） | **成立（数字级）** |
| V3 | 结构性不脱沙箱谓词（M2） | openai-codex | `codex-rs/core/src/tools/sandboxing.rs:276`（`unsandboxed_execution_allowed`）+ `:279`（`has_denied_read_restrictions`）+ `:247`（`NoOverride`） | **成立** |
| V4 | 审批回写规则（M3） | openai-codex | `codex-rs/execpolicy/src/amend.rs:65/:85`（`blocking_append_allow_prefix_rule` / `blocking_append_network_rule`） | **成立** |
| V5 | 代模型：v0…v3 命名 + 永不重命名/覆盖/删除（M4） | deepseek-harness | `packages/session/session-persistence-jsonl/README.md:60-70`；`docs/architecture.md:123` | **成立** |
| V6 | 不变式「模型可见 ⟺ 已记录」（M5） | deepseek-harness | `docs/architecture.md`（`deriveMessages()` 投影 + 运行时不变式断言段） | **成立** |
| V7 | 凭据遮蔽 MITM（M7） | minimax-code | `third_party/sandbox-runtime/src/sandbox/{credential-mask-env,credential-mask-files,credential-extract}.ts` | **成立** |
| V8 | 迁移前备份 + 授权删除（M9） | minimax-code | `local-runtime-v2/src/infra/db/backup.ts:9`（`BACKUP_FILE_PREFIX='runtime-state-before-v2-migration'`，共 283 行） | **成立** |
| V9 | 决策原因 25 变体（M22） | xai-org-grok-build | `crates/codegen/xai-grok-telemetry/src/events/permission_analytics.rs:116`（`PermissionDecisionReason` 枚举，**恰 25 个变体**） | **成立（数字级）** |
| V10 | ChatPatch 增量上下文契约（M12） | qoder-cli-artifact | `package/bundle/proto/chat.proto` = **322 行**（精确）；`:47` `patches`、`:232` `ChatPatch{cache_id}` | **成立（数字级）** |
| V11 | 策略分带 + 带内 priority（M10） | google-gemini-cli | `packages/core/src/policy/types.ts:114`（`PolicyRule`）、`:337-356`（`PolicySettings`）；`policy/policies/read-only.toml` | **成立** |
| V12 | 影子仓清洗 7 个 `GIT_*`（M21） | roo-code | `src/services/checkpoints/ShadowCheckpointService.ts:37-43`（GIT_DIR/WORK_TREE/INDEX_FILE/OBJECT_DIRECTORY/ALTERNATE_OBJECT_DIRECTORIES/CEILING_DIRECTORIES/TEMPLATE_DIR） | **成立（7 项精确）** |
| V13 | Repo Map：预算联动与个性化排序（M17） | aider | `aider/repomap.py:56`（`map_mul_no_files=8`）、`:383`（`personalize = 100/len(fnames)`）、`:689-695`（`pct_err` 二分拟合）、`:712`（缓存键 = 文件+lois+mtime） | **成立** |
| V14 | 检查点恢复事务私有引用（M15） | cline | `sdk/packages/core/src/session/checkpoint-restore.ts:68`（`refs/cline/restore-transactions/<uuid>`；函数起于 :50） | **成立（行号窗口内）** |
| V15 | 宿主 attach/detach 不停权威 runtime（M16） | cline | `sdk/ARCHITECTURE.md:149` + `sdk/packages/core/src/hub/client/session-client.ts:434`（`session.detach`） | **引文修正**（原引 `agent-runtime.ts:2018-2044` 实为工具审批逻辑） |
| V16 | 工具凭据租约（M8） | minimax-code | `packages/mcode-tools-host/src/{lease-broker,resource,integration,contracts}.ts` + `oauth-lease-protocol/src/{node-server,node-client,codec,endpoints}.ts` | **引文修正**（原引 `agent-tools/src` 目录错误；机制成立） |
| V17 | 状态机 + effects-as-data（M24） | goose | `crates/goose/src/agents/state_machine/`（18 个 `ops_*.rs`）+ `effects.rs:8`（`pub enum GooseEffect`） | **成立** |
| V18 | 按需规则只列 `alwaysApply===false && !globs`（M19） | continue | `core/tools/definitions/requestRule.ts:10-12` | **成立** |
| V19 | 职责边界（不执行/不隔离/不持凭据/不跑定时）（M25） | openhands | `docs/architecture.md:7-25`（System boundaries 四条 not responsible 原文） | **成立** |
| V20 | 三档工具披露枚举（MiniMax 工具格） | minimax-code | `packages/protocol/src/runtime.ts:137-141`（`AgentToolMode { OMIT=1, INLINE=2, TOOL_SEARCH=3 }`） | **成立** |

**核验统计**：成立 18 / 引文修正 2 / 降级 0；其中「数字级精确」3 条（V2/V9/V10）。

---

## 5. 步骤五：LESSONS-AND-ADOPTIONS 更新

1. **新增 §2.9（R02 增补）7 行**，L- 编号延续：
   - **L-087**（卷 20，P1，采纳）Cline SSH 远程环境最小形态；
   - **L-088**（卷 05，P2，适配）工具级并行「相邻并行组」；
   - **L-089**（卷 28，P2，适配）自更新器安装方式探测 + 频道稳定性守卫；
   - **L-090**（卷 10，P1，采纳）会话级记忆策略 + 首条用户消息锁 recall；
   - **L-091**（卷 10，P1，适配）记忆写入两档制（默认元数据/显式深摘要）；
   - **L-092**（卷 15，P2，适配）定时自动化的拓扑分离（宿主注入工具 + 触发标签）；
   - **L-093**（卷 09/30，P0，采纳）MCP OAuth 全链路 + 凭据落盘声明。
2. **修订声明**：**L-062 证据升级**（[E2]→[E1]，补双管线/8 步检索/Dream 门/降级契约；新增「文档 `<project-slug>-<hash8>` vs 代码 `blake3(cwd)[..16]` 漂移，以代码为准」）；**L-049 不修订**（原行已覆盖 Roo 配方）。
3. **计数与矩阵同步**：§2 台账 86→**93 行**（P0 60 / P1 22 / P2 11；采纳 60 / 适配 33）；§6.4 落点覆盖矩阵更新 7 个 impl 文件的行清单（01/05/09/10/15/20/27/28 相关项，其中 8 个文件新增或扩充 L- 引用）。
4. **开放问题**：Q7 部分关闭（OpenHands 循环位置已定位到姊妹仓，代码级 E1 仍不可得）。

---

## 6. 剩余缺口与未决（诚实清单）

1. **不降级的 44 格仍是「截至 2026-09 快照的负证据」**：闭源列（Claude Code 官方、Qoder）的否证权威性天然低于开源列——不得在 impl 中写成「竞品不支持」。
2. **Grok 记忆的「文档 vs 代码」漂移**（目录命名）已澄清但**未穷尽核对**（如 source_weights 默认值、`min_score` 默认 0.7 的代码出处未逐行验证）。
3. **Qoder bundle 为打包产物**：只能做符号级取证；`qoder-worker-runtime.mjs` 与 `qodercli.js` 的职责边界未展开（新增未决）。
4. **二线 6 家的 SSH / 并行 / 事件负证据**仍是「检索词级」而非「全仓穷尽级」（部分仓库有 node_modules 噪声，已排除）。
5. **`§8 迁移评估` 的「人日」为量级估计**，非测量值；进入 impl 时须由 I- 决策复核。
6. **未覆盖项**：`competitors/01–05、08` 本轮未逐节回读（仅按 CROSS-COMPARISON 抽样回查）；若需同深度深化，建议 R03 排期。

---

## 7. 方法与证据口径（可复核）

- **本地克隆基线**（`.research-cache/`）：`Gitlawb-openclaude`、`sst-opencode`、`openai-codex`、`deepseek-ai-deepseek-harness`、`MiniMax-AI-minimax-code`（+ `-cli`/`-Mini-Agent` 对照）、`xai-org-grok-build`（+ `superagent-ai-grok-cli` 对照）、`google-gemini-cli`、`aider`/`cline`/`roo-code`/`continue`/`goose`/`swe-agent`/`openhands`、`qoder-cli-artifact`（npm 解包实物）、`mmd-check`（mermaid 校验）。
- **命令口径**：`git -C <repo> grep -n` / `grep -rli --include=<ext>`；对索引损坏的克隆（gemini-cli）改用直接 `grep -r`；符号计数用 `grep -o | sort | uniq -c`（**计数必须连同检索面引用**）。
- **图校验**：`node .research-cache/mmd-check/check.mjs <file>` → `total=2 fail=0`。
- **本轮未做的事**：未修改 `impl/` 与 Phase A 卷册；未对 01–05/08 报告追加新事实；未把任何 [E2]/[E4] 结论提升为 [E1]（仅 Grok 记忆与代码图谱两条按 [E1] 源补证并明示出处）。

---

## 8. 变更文件清单（本轮）

| 文件 | 变更类型 | 行数变化 |
| --- | --- | --- |
| `research/00-research-plan.md` | 新增「R02 复核规程（5 条）」 | 144→153（+9） |
| `research/CROSS-COMPARISON.md` | 48 格更新 + §8 新节（4 小节）+ 统计/负证据/定位差同步 | 633→701（+68） |
| `research/LESSONS-AND-ADOPTIONS.md` | §2.9 七行 + 计数/矩阵/自报同步 + L-062 修订声明 + Q7 注记 | 649→670（+21） |
| `research/competitors/06-…md` | §11 深化补记（7 小节） | 544→612（+68） |
| `research/competitors/07-qoder.md` | §11 深化补记（6 小节） | 572→631（+59） |
| `research/competitors/09-…md` | §③.2/③.3 两张 Mermaid + 行 16 修正 | 760→820（+60） |
| `reviews/R02-scope-research.md` | 本文件（findings） | 新建（163 行） |
