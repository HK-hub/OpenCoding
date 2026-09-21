# R09 证据真伪与引用链审计（Round 9）

> **镜头**：证据真伪与引用链审计（lens: 证据真伪与引用链审计）。**范围**：`research/competitors/*.md`（9 份）、`research/CROSS-COMPARISON.md`、`research/LESSONS-AND-ADOPTIONS.md` 的可证伪断言；`impl/` 只读抽查、不改。
> **方法**：全部核验在本地浅克隆 `.research-cache/<repo>`（19 个目录）内完成，**零联网请求**；对每条断言执行「文件存在 → 符号存在 → 行为描述与源码一致」三步核对（`ls`、`sed -n`、`grep -n`、`awk`、`wc -l`、`git log -1`）。
> **与 R02 的关系**：R02 抽查 20 条 E1（18 成立）；本轮扩大为 **40 条 E1（覆盖 9 份报告，每份 ≥4 条）+ 全量矩阵「未观测」格程序化核对 + §3 全部 25 项机制出处反查 + 负面证据抽样复现**。

---

## §1 E1 断言核验表（40 条）

判定口径：**成立** = 文件/符号/行为三者一致；**部分** = 结论成立但引用或数字不精确；**不成立** = 与源码证据矛盾。

| # | 断言（摘要） | 报告:行 | 仓库（.research-cache/） | 核验路径 | 判定 | 处理 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 权限链 `hasPermissionsToUseToolInner`@1524 / `hasPermissionsToUseToolWithModeHandling`@556 | 01:14 | Gitlawb-openclaude | `src/utils/permissions/permissions.ts`（sed 定位） | 成立 | 无 |
| 2 | 批分区并发（连续只读合并）+ 上限 10 + `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | 01:16 | Gitlawb-openclaude | `src/services/tools/toolOrchestration.ts:8-11,94-119` | 成立 | 无 |
| 3 | 工具结果三层预算 50k 字符 / 200k 每消息 / 100k token，`BYTES_PER_TOKEN=4` | 01:17 | Gitlawb-openclaude | `src/constants/toolLimits.ts:11,25,30,46` | 成立 | 无 |
| 4 | `State` 记录 **14** 个跨迭代字段 | 01:22 | Gitlawb-openclaude | `src/query.ts:629-654`（逐字段清点） | **部分**（实际 **15** 个） | 修正为 15（报告 2 处 + CROSS 1 处） |
| 5 | **122** 个供应商/认证类环境变量被剥离 | 01:23 | Gitlawb-openclaude | `src/utils/managedEnvConstants.ts:14-75`（`awk` 计数） | **不成立**（实际 **48** + 1 前缀） | 修正为 48+1（报告 4 处 + CROSS 1 处） |
| 6 | 权限 `findLast` 取胜 + `Reply = once/always/reject` | 02:24 | sst-opencode | `packages/core/src/permission.ts:76-86,155-162`、`packages/schema/src/permission.ts:41` | 成立 | 无 |
| 7 | Bash 不沙箱：源码注释 + spec 陈述 + advisory 扫描三处证据 | 02:26 | sst-opencode | `packages/core/src/tool/bash.ts:109,138-140`、`specs/v2/session.md:204` | 成立 | 无 |
| 8 | codemode 自研 AST 解释器 **3465 行** + 13 模块白名单 stdlib（无 fs/process/fetch/require） | 02:26,268-269 | sst-opencode | `packages/codemode/README.md`、`src/interpreter/runtime.ts`（wc=3465）、`src/stdlib/`（ls=13） | 成立 | 无 |
| 9 | 快照影子 Git 仓 `{global.data}/snapshot/{projectID}/{hash(worktree)}` | 02:28 | sst-opencode | `packages/core/src/snapshot.ts:94-122` | 成立 | 无 |
| 10 | 按模型族匹配 **10 套**提示词，最大一份 **155 行** | 02:30 | sst-opencode | `packages/opencode/src/session/system.ts:28-51`、`prompt/*.txt`（gemini.txt=155） | 成立 | 无 |
| 11 | 并行工具调度用一把 `tokio::sync::RwLock<()>`（读=并行/写=互斥） | 03:19 | openai-codex | `codex-rs/core/src/tools/parallel.rs:44-64,174-185` | 成立 | 无 |
| 12 | `SandboxPolicy` 4 档 × `SandboxType` 5 类正交 | 03:15 | openai-codex | `codex-rs/protocol/src/protocol.rs:1068-1178`、`sandbox.rs:1-42` | 成立 | 无 |
| 13 | Seatbelt 硬编码 `/usr/bin/sandbox-exec` + 基础策略 `(deny default)` + 参考 Chrome | 03:17 | openai-codex | `sandboxing/src/seatbelt.rs`、`seatbelt_base_policy.sbpl:1-20` | 成立 | 无 |
| 14 | Linux 沙箱 bwrap + `no_new_privs` + seccomp；bundled bwrap 摘要失败**退出码 8** | 03:16 | openai-codex | `codex-rs/linux-sandbox/src/lib.rs:1-40`（常量 `BUNDLED_BWRAP_DIGEST_VERIFICATION_FAILURE_EXIT_CODE=8`） | 成立 | 无 |
| 15 | `GENERATION` 不可变：v0→v3 相邻迁移链 + 撕裂尾修复 | 04:36 | deepseek-ai-deepseek-harness | `packages/session/session-persistence-jsonl/README.md:12,62-68` | 成立 | 无 |
| 16 | 每 step 默认最多 **10** 个在飞并行安全调用 | 04:177 | deepseek-ai-deepseek-harness | `packages/core/agent-loop/src/constants.ts:6` | 成立 | 无 |
| 17 | 5 个 shipped profile（web/headless/sdk/sdk-minimal/acp）+ 入口机械门禁 | 04:34 | deepseek-ai-deepseek-harness | `docs/architecture.md:43-47` + `scripts/verify-application-entrypoints.ts` 存在 | 成立 | 无 |
| 18 | `spillStore` **不提供**保留期/替换/检索/搜索操作 | 04:208 | deepseek-ai-deepseek-harness | `packages/spill/spill/README.md`（原文逐句核对） | 成立 | 无 |
| 19 | `MiniMax-AI/cli` 的 `src/agent/` 仅 5 文件、**无 agent 循环** | 05:21 | MiniMax-AI-cli | `src/agent/{types,availability,installer,configurator,verify}.ts`（ls） | 成立 | 无 |
| 20 | `PermissionMode` 6 模式 + `AskForApproval` 4 策略 + 规则三级来源 | 05:38 | MiniMax-AI-minimax-code | `types.ts:14-52`（模式/来源/shell 规则）；**`AskForApproval` 实于 `ask-policy.ts:26`** | **部分**（引用文件错位） | 拆分为双文件引用 + 补 `argvPrefix` |
| 21 | `RuntimeEventType` 6 值（数值枚举为兼容旧会话保留）+ `AgentToolMode` 3 档 | 05:42,343 | MiniMax-AI-minimax-code | `packages/protocol/src/runtime.ts:121-135` | 成立 | 无 |
| 22 | sandbox-runtime pin `0.0.74-mcode.2` / rev `630552a3…` +「网络代理关闭仍保持文件保护」 | 05:39 | MiniMax-AI-minimax-code | `third_party/sandbox-runtime/README.md`（逐句核对） | 成立 | 无 |
| 23 | `GoalStatus` 含 `BackOffPaused/NoProgressPaused/InfraPaused/BudgetLimited/Blocked`；NoProgress 由「缺口指纹连续不变」触发 | 06:35 | xai-org-grok-build | `xai-grok-shell/src/session/goal_tracker.rs:41-110`（枚举 + 注释 :107-109） | 成立 | 无 |
| 24 | 事件系统「**57** 个事件变体」单枚举 | 06:38,241 | xai-org-grok-build | `xai-grok-session-events/src/types.rs`（Python 逐变体清点） | **不成立**（实际 **58**） | 修正为 58（报告 2 处 + CROSS 1 处） |
| 25 | `implementations/` 下并存 `codex/` 与 `opencode/` 移植目录 + `THIRD_PARTY_NOTICES.md` 按 Apache §4(b) 标注 | 06:39 | xai-org-grok-build | `xai-grok-tools/src/implementations/`（ls）、`THIRD_PARTY_NOTICES.md`（grep "Apache License 2.0 §4(b)"） | 成立 | 无 |
| 26 | `PermissionDecisionReason` **25** 变体 @ `permission_analytics.rs:116` | 06:32 | xai-org-grok-build | `xai-grok-telemetry/src/events/permission_analytics.rs:116`（awk 枚举计数=25） | 成立（精确） | 无 |
| 27 | `bundle/builtin/` 4 个 SKILL.md；`agent-creator/SKILL.md` 泄漏 `argumentSubstitution.ts` | 07:187,392 | qoder-cli-artifact | `package/bundle/builtin/{skill-creator,agent-creator,hook-config,sdk}/`、`agent-creator/SKILL.md:34` | 成立 | 无 |
| 28 | `chat.proto`：`ReasoningEffort` 枚举、`patches: map<string,ChatPatchList>`、`cache_id`、`cache_control` | 07:24,133 | qoder-cli-artifact | `package/bundle/proto/chat.proto`（grep 四处字段） | 成立 | 无 |
| 29 | `qodercli.js` 符号计数（worktree 656 / autoMemory 55 / compaction 33）+ worker **10,202 行** | 07:101,116,177 | qoder-cli-artifact | `bundle/qodercli.js`（grep -o | wc -l，三值全中）、`bundle/qoder-worker-runtime.mjs`（wc=10202） | 成立 | 无 |
| 30 | vendored 安全插件：`plugin.json` 元数据 + hooks matcher `Edit\|Write\|MultiEdit\|NotebookEdit` 与 `if: "Bash(git push *)"` | 07:207 | qoder-cli-artifact | `vendor/qoder-security/.qoder-plugin/{plugin.json,qoder-hooks.json}` | 成立 | 无 |
| 31 | `Scheduler`@`scheduler.ts:99` + `CoreToolCallStatus` 7 态状态机 @ `types.ts:26` | 08:13 | google-gemini-cli | `packages/core/src/scheduler/{scheduler.ts:99,types.ts:26}` | 成立 | 无 |
| 32 | `PolicyRule`@`policy/types.ts:114` + 5 层信任带 `1+priority/1000`（read-only.toml 文件头） | 08:14 | google-gemini-cli | `policy/types.ts:114`、`policy/policies/read-only.toml:1-25` | 成立 | 无 |
| 33 | `checkpointUtils.ts:84 processRestorableToolCalls` + 影子提交（commitHash 元数据） | 08:16 | google-gemini-cli | `utils/checkpointUtils.ts:84,100-137` | 成立 | 无 |
| 34 | 循环检测：工具签名 5 次 / 文本 50 字符块 10 次 / 30 轮后每 **5–15** 轮复核 / 置信度 **0.9** / alias `loop-detection-double-check` | 08:18 | google-gemini-cli | `services/loopDetectionService.ts:29-101`（常量全命中） | 成立 | 无 |
| 35 | 压缩阈值 = 上限 × **0.5** + 失败状态码 `COMPRESSION_FAILED_EMPTY_SUMMARY` / `…_INFLATED_TOKEN_COUNT` | 08:17 | google-gemini-cli | `context/chatCompressionService.ts:41,426,469` | 成立 | 无 |
| 36 | Aider Repo Map `get_ranked_tags`@365 / `get_ranked_tags_map_uncached`@629 | 09:24 | aider | `aider/repomap.py:365,629` | 成立 | 无 |
| 37 | Roo 内置五模式（code/architect/ask/debug/orchestrator）+ `new_task` boomerang | 09:27 | roo-code | `packages/types/src/mode.ts`（slug@170/182/192/204/216，orchestrator@216-231） | **部分**（行号/文件错位） | 修正为 `mode.ts:160-231`；原引 `src/shared/modes.ts:216-225` 为 getRoleDefinition 辅助函数（该文件 0 处提及 orchestrator） |
| 38 | Cline 检查点恢复事务：`refs/cline/restore-transactions/<uuid>` 私有引用 @ `checkpoint-restore.ts:56` | 09:26 | cline | `sdk/packages/core/src/session/checkpoint-restore.ts:50-100`（函数起于 50，私有 ref 构造 @68） | **部分**（行号偏移） | 精化为 `:50-100`（报告 2 处 + CROSS M15） |
| 39 | Goose `state_machine/mod.rs`「有序、可重入流水线」+ `ops_*` 覆盖清单 | 09:29 | goose | `crates/goose/src/agents/state_machine/mod.rs:1-30` | 成立 | 无 |
| 40 | Continue `requestRule` 仅列 `alwaysApply === false && !globs` 的规则 | 09:28 | continue | `core/tools/definitions/requestRule.ts:7-10` | 成立 | 无 |

**统计：成立 34 / 部分 4 / 不成立 2**（不成立率 5%，均为数字或引用错位，无结论级推翻）。

### 1.1 补充核验（不在 40 行内，抽样顺带确认）

| 断言 | 位置 | 结果 |
| --- | --- | --- |
| `HOOK_EVENTS` **27** 个事件点 | 01:19 | 成立（`coreTypes.ts` 数组逐项计数 = 27） |
| `src/daemon/main.ts` 自述 inert stub | 01:162 | 成立（头注释原文「Inert stub…」） |
| DeepSeek 工具目录 **68** 个模型可见工具 | 04:40 / CROSS §2.1 | 成立（`grep -c '^### ' docs/tool-catalog.md` = 68） |
| MiniMax Code **97** 个非测试工具文件 | CROSS §2.1 | 成立（`find packages/agent-tools/src -name "*.ts" ! -name "*.test.ts"` = 97） |
| Codex `EventMsg` **83** 变体 | CROSS §2.1 | 成立（awk 枚举计数 = 83） |
| `Superagent-ai/grok-cli` `--max-tool-rounds` 默认 **400** + 前置 hook 阻断回 `[Hook blocked]` | 06:128,135 | 成立（`src/index.ts:367-368`、`src/grok/tools.ts:99-125`） |
| MiniMax 迁移备份：前缀 `runtime-state-before-v2-migration`、`backupMs/migrationsMs` 计量 | 05:330-331 / CROSS M9 | 成立（`backup.ts:9,64,117`、`initialize.ts` timings 接口） |
| Gemini `GOVERNANCE_FILES` / `SECRET_FILES` 常量 | 08:19 | 成立（`sandboxManager.ts:198,208`） |
| `rollout-<RFC3339>-<threadId>[_<rolloutId>].jsonl` 解析 | 03:20 | 成立（`rollout_file_name.rs:29-50`） |

---

## §2 修正清单（before → after，含 diff 摘要）

| # | 文件 | before | after | 依据 |
| --- | --- | --- | --- | --- |
| C1 | `competitors/01-…md`（4 处：§1-10、§9 环境变量钉扎、§10 第 5 条、§8 采纳表） | 「122 个环境变量」 | 「48 个（+1 `VERTEX_REGION_CLAUDE_*` 前缀规则）」+ R09 标记 | `awk` 计数 `PROVIDER_MANAGED_ENV_VARS` 集合 = 48 行项 |
| C2 | `competitors/01-…md`（2 处：§1-9、时序图） | 「State 记录 14 个跨迭代字段」 | 「15 个」+ R09 标记 | `query.ts` 逐字段清点 = 15 |
| C3 | `competitors/01-…md` §2.2 许可行 | 「仓库 LICENSE 为 MIT（README 声明…）」 | 精化：根 `LICENSE` 实为 **NOTICE 声明**（衍生自 Anthropic；仅贡献者修改按 MIT；原文明确「无授权分发其专有源码」） | `LICENSE` 全文实读，风险声明强于原表述 |
| C4 | `competitors/05-…md` §1-4 | `AskForApproval` 引 `types.ts:13-52` | 拆分为 `types.ts:14-52`（模式/来源）+ `ask-policy.ts:26`（AskForApproval）；补 shell 规则含 `argvPrefix` | `ask-policy.ts:26` 类型定义实读 |
| C5 | `competitors/06-…md`（2 处）+ `CROSS-COMPARISON.md` §2.2 事件格 | 「57 个事件变体」 | 「58 个」+ R09 标记 | Python 逐变体清点 `Event` 枚举 = 58 |
| C6 | `competitors/09-…md`（5 处：§1-4、§2.3-2、§③-9、§④.3 SubAgent、§⑤ S13） | `mode.ts:9-45`、`src/shared/modes.ts:216-225` | `packages/types/src/mode.ts:160-231`（五模式）/`:216-231`（orchestrator）+ R09 标记 | slug 实际位置 170/182/192/204/216；`shared/modes.ts` 0 处提及 orchestrator |
| C7 | `competitors/09-…md`（4 处：§1-3、§2.2-1、§③-12、§⑤ S7）+ CROSS M15 | `checkpoint-restore.ts:56` / `:56-100` | 统一为 `:50-100`（私有 ref @68）+ 标记 | 函数签名 @50，`refs/cline/…` @68 |
| C8 | `CROSS-COMPARISON.md` §2.2 Goal 格（OpenCode） | 「`grep -rn "cron" …` **0 命中**」 | 「实际 5 处命中，均为 i18n「cronologie」与 markdown 关键字表 `crontab` 误报，无调度器实现——结论不变」 | 复现搜索；与报告 02 §10 第 8 条的准确表述对齐 |
| C9 | `CROSS-COMPARISON.md` §2.3 分发遥测格（OpenCode） | 「`sentry\|crashReporter` **0 命中**」 | 修正：Web app 与 Desktop renderer 以 `VITE_SENTRY_DSN` 可选启用前端 Sentry（`packages/app/src/entry.tsx:133`、`packages/desktop/src/renderer/index.tsx:40`），CI 持有 `SENTRY_AUTH_TOKEN`；**CLI/内核范围内原结论仍成立** | 55 个文件命中；报告 02 §524 已有准确表述，矩阵未同步 |
| C10 | `CROSS-COMPARISON.md` M20 | `mode.ts:9-70` | 补充内置五模式 slug 行号（`:170/182/192/204/216`） | 同 C6 |
| C11 | `CROSS-COMPARISON.md` M23 | E1 证据未标衍生品 | 补「**衍生品来源**：此段 E1 属 openclaude 衍生品事实，不等于官方实现」 | 01 号报告 §2 声明；M23 引的是 `src/utils/permissions/permissions.ts` |
| C12 | `competitors/02-…md` §4.11 | 「`grep -rn "cron"` 无命中」 | 与 C8 同步的精确表述 | 同上 |
| C13 | 9 份报告文首 | 无统一「证据时点」行 | 各补 1 行（见 §7） | 本地 `git log -1` |

> 说明：C1/C2/C5 属**数字类不成立**，C4/C6/C7 属**引用错位**，C8/C9 属**检索口径不可复现**（结论均未被推翻）。所有修正均在原位留「R09 复核」痕迹，未删除原表述。

---

## §3 引用链贯通（15 处抽查，含全部 impl 头部证据段）

方法：`grep -rn "competitors/" impl/`（75 处，覆盖 26 个主文件 + 15 个组件文件）→ 抽样 15 处逐条回查「被引报告是否确有该结论」。

| # | impl 位置 | 引用内容 | 回查结果 |
| --- | --- | --- | --- |
| 1 | `06-permission-system-impl.md:5` | 02 规则链/批量授权/级联拒绝；03 denied-read 不变式；04 fail-closed 封闭结果集；05 硬拦截注册表；08 信任带 | 全部命中（02 §1-6、03 §1-6、04 §1-6、05 §1-3、08 §1-2） |
| 2 | `08-skill-system-impl.md:5` | 03 `SkillMetadata/SkillScope/SkillPolicy`；04 frontmatter 严格校验；08 `activate_skill`；01 渐进披露 | 全部命中（03:205-206、08:190-193） |
| 3 | `11-knowledge-system-impl.md:108`（REQ-KB-12） | 09 §2.1 Aider `repomap.py:365/:629` | 命中（09:24、09:90，§2.1 正文） |
| 4 | `11-knowledge-system-impl.md:112`（REQ-KB-16） | 07 §1-7 Repo Wiki 人工保护 + 反向同步 | 命中（07:31） |
| 5 | `12-agent-runtime-impl.md:102`（REQ-AG-04） | 04「Model-visible means logged」+ 02 §1-4 事件溯源投影 | 命中（04:35、02:21） |
| 6 | `13-agent-teams-impl.md:87`（REQ-TEAM-01） | L-010 ← 09 §⑤ S4 `ModeConfig.groups` | 命中（LESSONS:174、09:698） |
| 7 | `14-task-plan-engine-impl.md:209` | 07 §8-2 四段 Spec；08 §⑧ G13 plan mode；09 §④ Roo 子任务 | 命中（07:505、08:469） |
| 8 | `15-goal-scheduler-impl.md:201` | 06 §8-4 goal_tracker（L-044）；05 §8 M15 会话归属；09 §⑤ S12 recipe | 命中（06:35、05:644、09:716） |
| 9 | `16-event-bus-impl.md:187` | 04 waterfall 显式 `next()`；02 幂等不变量/两族事件（L-051） | 命中（04:179,186；LESSONS:243） |
| 10 | `17-hook-engine-impl.md:5` | 01 hooks 31 事件（E2）+ 8 次上限；07 四类入口（vendored 实证）；04 waterfall；08 `trustedHooks`；03 `output_spill` | 全部命中（01:19,37；07:159,267；08:239；03:261） |
| 11 | `18-plugin-runtime-impl.md:187` | 02 `PluginHost` 同进程同权限；04 Cordis 可逆副作用；07 `plugin.json` 分发 | 全部命中（02:357,780；07:207） |
| 12 | `19-persistence-recovery-impl.md:223` | 05 §8 M1 备份授权删除（L-053）；06 §8-9 本地存储（L-086）；04 代模型 | 命中（05:630、06:491、04:36） |
| 13 | `22-cli-tui-impl.md:227` | L-008 外壳差异（07 §8-4）；L-056 headless 共用协议（03） | 命中（LESSONS:172,248；07:506） |
| 14 | `23-desktop-electron-vue-impl.md:98,220` | 04 §4.1 桌面 Node IPC 四类 | 命中（04:166 §4.1 维度表） |
| 15 | `24-a2a-gateway-impl.md:236` | 08 §4.19 A2A 服务端；CROSS §7.4 Q10 / §7.5 X1 | 命中（08:266-272、CROSS:512,518） |

**结论：断链 0 处**。另核对 impl 引用的 15 个 `L-0xx` 编号（L-008/010/038/042/044/045/046/047/051/053/056/057/076/083/086）在 `LESSONS-AND-ADOPTIONS.md` 全部存在且内容对应。**0 处断链，但发现 2 处「可解析的不精确引用」**（已记录，不需改 impl）：`17-hook-engine-impl.md` 引「03-codex §8」实为 §8 建议表第 9 行（存在）；`15-goal-scheduler-impl.md` 引「05 §8 M15」为 §8 采纳表 M15 行（存在）。

---

## §4 交叉对比一致性

### 4.1 §2 矩阵「未观测」格检索口径（R02 声称 100%）

程序化核对（`awk -F'|'` 逐格）：§2.1–§2.3 全部含「未观测」的格 **44 格**，每格均带 `R02 核验/复验/补证` 或显式 `grep/find` 检索词——**R02 的 100% 口径 claim 成立**。抽样 15 格列出：

| # | 域 × 竞品 | 格内检索口径（摘） |
| --- | --- | --- |
| 1 | 记忆 × OpenCode | `memory*` 全量核对无子系统；4 处命中逐一定性 |
| 2 | 记忆 × DeepSeek | `packages/` 55 个一级包无 memory*/knowledge* |
| 3 | 知识库 × Codex | `codex-rs/` 无 vector/qdrant/faiss/hnsw 依赖 |
| 4 | 知识库 × MiniMax | `docs/tui-capabilities.md:41` 主动移除声明 |
| 5 | MCP × Codex | `ServerHandler` 命中仅 `app-server/tests/*` |
| 6 | MCP × MiniMax | `types.ts:4-7`「we trim the legacy daemon surface (OAuth2 flow…)」 |
| 7 | Goal × OpenCode | `grep -rn "cron" …`（R09 已修正口径，结论不变） |
| 8 | Goal × Gemini | `scheduler/` 目录语义核对 = 工具调度 |
| 9 | 企业运维 × DeepSeek | `tenant` 1 处误用注释、`sso\|scim` 0 命中 |
| 10 | 工作区 × OpenCode | `ssh` 仅命中 xai 插件注释；`containers` 为镜像构建包 |
| 11 | 工作区 × MiniMax | `ssh` 仅 `.ssh/` 排除与危险命令模式 |
| 12 | Teams × OpenCode | `teammate/peer-to-peer/blackboard` 于 `packages/core/src` 0 命中 |
| 13 | 插件 × OpenCode | `packages/plugin/src` 无 marketplace/signature/依赖求解 |
| 14 | 分发遥测 × OpenCode | （R09 修正：Sentry 存在于 Web/Desktop，CLI 范围结论不变） |
| 15 | Git × DeepSeek | 工具目录全量比对 68 工具无 git；`grep -ril worktree` 命中均无关 |

**样例全过（14/15 口径直接成立，1 格经 R09 修正后成立）。**

### 4.2 §3 独有机制榜（25 项）出处反查

对 M1–M25 逐项在 9 份报告中反查关键字：**25/25 均能在声明的来源报告中找到出处**（M1 codemode→02；M2/M3→03；M4/M5/M6→04；M7/M8/M9→05；M10/M11→08；M12/M13/M14→07；M15/M16→09+08；M17→09；M18→09；M19→09；M20/M21→09；M22→06；M23→01；M24/M25→09）。**0 项无出处**。其中 M23 经 R09 补标「衍生品」（见 C11）。

---

## §5 负面证据复核（§4 反面证据）

### 5.1 当时的检索词（§4.1 明示 + 各报告 §10 附）

`grep -rn "cron"`、`find packages -iname "*compact*"`、`grep -ril worktree`、`grep -rln "mcp"`、`grep -rni "tenant|scim|quota|billing"`、`grep -rni "memory\|embedding\|vector"`、`grep -rn "A2A\|agent2agent"`、`grep -rni "ssh"`、`grep -rni "sentry\|crashReporter"`、工具目录全量比对（68/97 个文件清单）、`ls packages/*/src` 全量核对、mini-swe-agent/`tui-capabilities.md` 权威文档明示。

### 5.2 本轮抽样复现（本地重跑）

| 检索 | 目标结论 | 复现结果 |
| --- | --- | --- |
| `grep -rni "agent2agent" deepseek-harness/packages` | N3 无 A2A | 0 命中 ✓ |
| `grep -rni "oauth" minimax-code/packages/mcp/` | MCP OAuth 被裁剪 | 0 命中 ✓ |
| `grep -rniE "\bscim\b" codex-rs` | N4 无 SCIM | 0 命中 ✓ |
| `grep -rniE "merge.?queue" cline/sdk` | 合并队列全空 | 0 命中 ✓ |
| `ls packages/core/src \| grep -i memory` (opencode) | N1 无记忆 | 0 命中 ✓ |
| `grep -ril worktree deepseek-harness/packages/core` | N5 git/worktree 空白 | 0 命中 ✓ |
| `grep -rl "qdrant\|faiss\|hnsw" gemini packages/core/src` | N2 无向量库 | 0 命中 ✓ |
| `grep -rniE "multi-tenant" grok-build/crates` | N4 Grok 无多租户 | 1 命中，为 `transport.rs:20` 注释（「multi-tenant tooling sessions sharing」语境），**不影响结论** |
| `grep -rn "cron" sst-opencode/packages --include=*.ts` | OpenCode 无调度 | **5 命中（误报）** → 已修正口径（C8） |
| `grep -rniE "sentry\|crashReporter" sst-opencode` | OpenCode 无崩溃上报 | **55 文件命中（Web/Desktop 前端 Sentry）** → 已修正口径（C9） |

### 5.3 置信度与失效条件

- **置信度**：开源 7 组（OpenCode/Codex/DeepSeek/MiniMax/Grok/Gemini/二线）的负证据为 **[E1] 级、可机械复现**；抽样 8/10 直接复现，2 例为口径不精确（非结论错误），修正后置信度维持高位。闭源 2 组（Claude Code 官方面、Qoder）的负证据仍为 **[E2] 级——只能证明「公开材料未见」，不能证明「不存在」**。
- **失效条件**：① 上游漂移（Aider/Roo/Continue/SWE-agent 距快照 2–4 个月未推送；OpenCode V1→V2 迁移中；MiniMax/DeepSeek 处 alpha）；② 新术语未纳入检索词（如厂商改用新命名会漏检）；③ ≥5 组判定规则对「3–4 组缺失」的主题不升级为主题级负证据（如 N8 工具级并行）。
- **后续承诺**：`CROSS-COMPARISON.md` §4.3 第 3 条 + §7.4 Q9 已登记「B7 终局审计以同检索手段复核一次，结果写入 `ITERATIONS.md`」——R09 建议将本轮修正后的**精确口径**（C8/C9）作为复核基线，避免沿用不可复现的旧措辞。

---

## §6 许可与合规

1. **衍生品标注仍完整**：`01-claude-code-purpose-built.md` 文首声明 + 正文逐条「（衍生品）」标记 + `CROSS-COMPARISON.md` §1.2 第 64 行 + §3.2 R4「直接引用复刻仓代码」拒绝项均在场；R09 进一步强化 §2.2 许可行（C3）。
2. **impl 侧抽查（5 处）**：`impl/` 全库 `grep -rn "openclaude"` = **0 命中**（无字面引用，更无代码级引用）；抽查 5 处竞品引用——`07-sandbox:5`（Codex/MiniMax/Gemini，Apache-2.0/MIT）、`18-plugin:187`（OpenCode MIT / DeepSeek Cordis）、`21-git-worktree:117`（Roo 配方级清单，Apache-2.0）、`24-a2a:236`（Gemini Apache-2.0）、`17-hook:181`（Claude Code E2 文档 + 衍生品 E1 已标注）——全部为**机制/配方级采纳**，无「复制代码」类表述（`grep "照抄\|直接复制" impl/` 无命中，仅出现「深拷贝」等无关命中）。
3. **许可证实读抽验**：aider/cline/roo-code/continue/goose/gemini-cli/openai-codex = Apache-2.0；swe-agent/openhands/minimax-code/opencode = MIT；MiniMax `third_party/sandbox-runtime` = Apache-2.0（README 指向的 LICENSE 实读）——与 `CROSS-COMPARISON.md` §2.3 许可行一致。
4. **Grok 移植范式**：`implementations/codex|opencode` + `THIRD_PARTY_NOTICES.md` 的 Apache §4(b) 改动标注核实存在，作为「合法吸收」样本引用正确（06:39）。
5. **残留提示**：impl 复用 MiniMax MITM（M7）与工具租约（M8）时，报告/CROSS 已标 Apache-2.0 与「适配」；若未来从「机制采纳」升级为「代码级移植」，须按 Apache-2.0 加 NOTICE——建议在 `impl/07`/`impl/30` 的引用行补一句许可提示（本轮不改 impl，列入残余风险）。

---

## §7 时效性标注（本轮补齐）

9 份报告文首均新增「证据时点」行，锚点如下：

| 报告 | 证据时点（克隆 commit / 访问窗口） |
| --- | --- |
| 01 Claude Code | `d16318a`（2026-09-16）；官方文档抓取 2026-09-17–21 |
| 02 OpenCode | `ebb7b76`（2026-09-19，dev）；GitHub API 2026-09-20 |
| 03 Codex | `5c5308f`（2026-09-20）；官方文档站本次 403 |
| 04 DeepSeek | `ddefc45`（2026-09-17，0.1.6-alpha.2）；API 2026-09-21 |
| 05 MiniMax | **本轮补齐三仓哈希**：`73a2581`（09-20）/ `33453cf`（09-19）/ `d76a4f6`（02-14） |
| 06 Grok | 官方 `4247f66`（2026-09-19）；社区 `fb97af8`（2026-05-15） |
| 07 Qoder | 无 git 可锚：以分发包版本 `1.1.59`（2026-09-19 发布）+ 抓取窗口 2026-09-19–21 为锚 |
| 08 Gemini | `cfbcaa8`（2026-09-18）；API 2026-09-20 |
| 09 二线 | 7 仓哈希原表完整；API 2026-09-20 |

**缺 commit 的仅 07（主体闭源、分发包无 `.git`）**——已按「包版本为唯一可比锚点」处理并写入 findings；`qoder-cli-artifact` 目录无 `.git`，属预期（npm pack 解包物）。

---

## §8 残余风险清单

1. **抽样面仍有限**：9 份报告共约 1,590 处 `[E1]` 标签，本轮仅 40 条（+10 补充）。建议 B7 终局审计对「数字类断言」做**脚本化全量校验**（阈值/计数/变体数最易复现、也最易出错——本轮 3 个数字错误全部属此类）。
2. **闭源列不可证否**：Claude Code 官方部分与 Qoder 的「未观测」永远只是「公开材料未见」；引用纪律（§7.6）必须持续执行。
3. **上游漂移**：4 个二线仓与社区 grok-cli 已 2–4 个月未推送；OpenCode 处 V1→V2、MiniMax/DeepSeek 处 alpha——负证据清单（§4.2）按 §7.4 Q9 承诺在 B7 复核。
4. **数字一致性外溢**：本轮修正的 48/15/58 三个数字，需确认无其他下游文件（卷册、AUDIT.md）转抄旧值——已 grep 确认 `docs/harness/` 根目录卷册未见转抄；`AUDIT.md`/`ITERATIONS.md` 的全局数字审计（Task #14/#16）仍待执行。
5. **衍生品证据的法律不确定性**：M23 等以 openclaude 为 E1 来源的机制结论，虽已加标签，其「机制对照」用法在合规上仍属灰区；建议 R10 考虑为「01 号报告 E1 引用唯一的 M23」寻找 [E2] 官方 docs 补充锚点。
6. **impl 许可提示缺位**：见 §6-5。
7. **本地缓存的绑定风险**：全部核验依赖 `.research-cache/`（已 gitignore）。若缓存被清理，本轮结论只能以记录的命令+哈希重放——建议将 19 个仓库的 `HEAD 哈希清单`固化到某处版本化文档（当前分散在各报告文首，已可满足）。
8. **口径基线**：C8/C9 修正后，`CROSS-COMPARISON.md` §4.1/§7.2 的检索手段表述建议同步一次（当前 §7.2 的示例列表未包含本轮新口径），留待 R10 或 B7 统一。

---

## §9 命令清单（可复现）

```bash
# 逐条核验（示例，全部在 D:/learn/project/OpenCoding/.research-cache/<repo> 内执行）
git -C <repo> log -1 --format='%H %ad' --date=short        # 证据时点
sed -n '1520,1530p' src/utils/permissions/permissions.ts   # 01 权限链
awk '/const PROVIDER_MANAGED_ENV_VARS/,/^\]\)/' src/utils/managedEnvConstants.ts | grep -cE "^\s*'[A-Z_]+',?"  # 01 = 48
sed -n '629,654p' src/query.ts                              # 01 State 15 字段
wc -l packages/codemode/src/interpreter/runtime.ts          # 02 = 3465
wc -l packages/opencode/src/session/prompt/gemini.txt       # 02 = 155
awk '/pub enum Event \{/{f=1;next} f&&/^\}/{f=0} f&&/^    [A-Z]/{c++} END{print c}' crates/codegen/xai-grok-session-events/src/types.rs  # 06 = 58
awk '/pub enum PermissionDecisionReason/,/^}/' crates/codegen/xai-grok-telemetry/src/events/permission_analytics.rs | grep -cE "^\s+[A-Z][A-Za-z]*,?$"  # 06 = 25
grep -n 'slug: "' packages/types/src/mode.ts                # 09 = 170/182/192/204/216
grep -n "refs/cline/restore-transactions" sdk/packages/core/src/session/checkpoint-restore.ts  # 09 = :68
grep -c '^### ' docs/tool-catalog.md                        # 04 = 68
find packages/agent-tools/src -name "*.ts" ! -name "*.test.ts" | wc -l   # 05 = 97
awk '/pub enum EventMsg/,/^}/' codex-rs/protocol/src/protocol.rs | grep -cE "^\s+[A-Z][A-Za-z0-9]*(\(|,| \{)"  # 03 = 83
wc -l bundle/qoder-worker-runtime.mjs                       # 07 = 10202
grep -o "worktree" bundle/qodercli.js | wc -l               # 07 = 656
# 负面证据复现（本地，零联网）
grep -rniE "agent2agent" packages/ ; grep -rni "oauth" packages/mcp/ ; grep -rniE "\bscim\b" codex-rs/
grep -rliE "sentry" . --exclude-dir=.git --exclude-dir=node_modules   # C9 复现
# 引用链检查
grep -rn "competitors/" impl/ | wc -l                       # = 75
for L in L-008 L-044 L-053 L-086; do grep -c "$L" research/LESSONS-AND-ADOPTIONS.md; done
```

---

**结论摘要**：40 条 E1 断言 **34 成立 / 4 部分 / 2 不成立**（不成立均为数字或引用错位，无结论级翻案）；已原位修正 13 组（含跨文件同步）；引用链 0 断链（75 处引用抽样 15 处全部贯通，15 个 L 编号全存在）；矩阵 44 个「未观测」格检索口径 100% 在场（R02 claim 成立），§3 全部 25 项机制出处可反查；负面证据抽样 8/10 直接复现、2 例口径修正（结论不变）；许可风险标注完整且 impl 无代码级照搬；9 份报告补齐「证据时点」。
