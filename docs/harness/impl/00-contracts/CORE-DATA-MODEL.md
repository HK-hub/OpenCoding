# 核心数据模型（B1 首批表结构 + 全批次表族归属 · 唯一权威）

> 文件：`docs/harness/impl/00-contracts/CORE-DATA-MODEL.md`
> 上游依据：`impl/01`/`03`/`12`/`16`/`19`/`20`/`25`/`26` §⑧、`reviews/R07-scope-build-kernel.md`、`reviews/R07-scope-build-platform.md`、`impl/components/SUGGESTIONS.md`、`impl/components/C01-session-manager.md`、`27-technical-path.md` §4.4、`31-capacity-and-cost.md` §4.1、`appendix-a-domain-model.md` §A.6/§A.9
> 裁决编号：`D-CDM-1 … D-CDM-14`（登记见 §7）
> 状态：M0 契约冻结候选。本文件逐条闭合 `reviews/R10-walkthrough.md` 的 B4（表字段/约束三处互斥）、B5（`oc_checkpoint` 收敛条款自相矛盾）、B6（B1 批次三份清单互斥）三项阻塞。

## §1 目的与权威性

### 1.1 权威范围（三条，硬性）

1. **本文件是 B1 批次（首个 Flyway 迁移）表结构、列定义、约束、索引、分区策略的唯一权威**。任何 impl 文档的 §⑧ 表段与本文冲突时，以本文为准；impl 文档该段降级为「字段语义说明 + 别名指针」，禁止再声明独立的列清单与唯一性口径。
2. **本文件是全 11 个迁移批次（B1–B11）表族归属的唯一权威**。卷 27 §4.4（原 B1–B6）与各 impl §⑧ 的「数据批次」陈述一律以 §2 汇总表为准；未在本表登记的 `oc_*` 表不得进入迁移脚本。
3. **物理表名唯一化**：附录 A.6/A.9 的表名示例是**概念名**，不作物理名；物理名以本文件 §2 表清单（取自各 impl §⑧ 显式声明）为准（D-CDM-11）。

### 1.2 已 grep 到的冲突处（file:line，均以本文件裁决）

| # | 冲突处（file:line） | 冲突内容 |
| --- | --- | --- |
| C1 | `impl/01-kernel-runtime-impl.md:51` / `impl/12-agent-runtime-impl.md:89` / `impl/19-persistence-recovery-impl.md:68` | 三份互斥的 B1 表清单（第一份 Flyway 迁移写不出来） |
| C2 | `impl/01:660` vs `impl/16-event-bus-impl.md:685` vs `impl/01:530` | `oc_event_log` 主键/分区列/唯一性三方互斥 |
| C3 | `impl/01:657` vs `impl/12:634` | `oc_turn` 列名互斥（`state`/`session_id`/`seq` vs `phase`/`thread_id`） |
| C4 | `impl/01:658`（`ref_id, summary`，无正文列）vs `impl/12:635`（`payload_ref` 仅引用） | `oc_item` 消息正文承载列未定义 |
| C5 | `impl/12:637`（列清单无 `session_id`）vs `impl/12:647-650`（幂等键声明为 `(session_id, seq)`） | `oc_checkpoint` 自相矛盾 |
| C6 | `impl/12:637`（`oc_checkpoint`）vs `impl/03-context-engine-impl.md:715`（`oc_context_checkpoint`） | 同一概念两套表名 |
| C7 | `impl/01:656`（`oc_session_input`）vs `impl/12:636`（`oc_agent_input`） | 输入准入表双状；`impl/components/C01-session-manager.md:84` 判「双表并存」淘汰、`:447`（R-SM-1）建议合并 |
| C8 | `impl/01:661`（`oc_projection_offset`/`oc_dead_letter`）vs `impl/16:692/691`（`oc_projection_state`/`oc_event_deadletter`） | 投影位点与死信表名双轨 |
| C9 | `impl/19:721`（`oc_side_effect_ledger`）vs `impl/12:638`（`oc_tool_side_effect`） | 副作用账本表名双轨（impl/19 已注「同一物理表」，本文固化物理名） |
| C10 | `impl/13-agent-teams-impl.md:72`（`oc_team`→B4）vs `impl/25:72`（`oc_team`→B1） | 同一表两个批次 + 双 owner |
| C11 | `impl/02-model-gateway-impl.md:40`（`oc_credential`→B2）vs `appendix-a-domain-model.md:134`（组织/身份域含 `oc_credential`） | 同名跨域 |
| C12 | `impl/02:40`（`oc_usage_record`）vs `impl/26-quota-cost-impl.md:69`（`oc_usage_event`） | 计量双表语义边界未声明 |
| C13 | `appendix-a-domain-model.md:146`（`oc_workitem`/`oc_workitem_dep`/`oc_evidence`）vs `impl/14-task-plan-engine-impl.md:75`（`oc_work_item_*`） | 工作对象表名分歧（R07 X-89，`impl/01:47` 亦登记） |
| C14 | `appendix-a-domain-model.md:168/172`（`oc_event_log` 按 `(tenant_id, occurred_at)` 月分区）vs `impl/19:730`（按 `recorded_at` 分区） | 事件表分区列 |
| C15 | `impl/19:68`（`oc_subagent_link`→B4）vs `impl/12:89`（B1/B2 两可） | 批次归属未定 |
| C16 | `impl/21-git-worktree-impl.md:60`（`oc_git_*` 无批次）vs 卷 27 §4.4（B1–B6 无交付物） | 表族无批次落点 |
| C17 | `impl/components/SUGGESTIONS.md:145`（X-C30-1：`oc_audit_segment` 需新增） | 审计封段状态无载体 |
| C18 | `impl/components/SUGGESTIONS.md:65`（X-C12-2：`oc_sandbox_*` 六表批次未裁决） | 沙箱执行面无批次 |
| C19 | `impl/01:51`（`oc_capability_gate` 未在 B1–B6 明列） | 装配门控无批次 |

### 1.3 职责边界（本文件不写什么）

- 不写 Java 类、不写 Mapper、不写业务语义：表↔实体的 `@TableName("oc_xxx")` 逐实体显式声明（不依赖全局 `table-prefix`），由各域的 `XxxEntity` 落地。
- 不写保留期与合规删除算法：保留窗口引用卷 16 §⑧.1 与卷 19 §4.6；本文件只固化「分区列 + 保留窗口对齐」。
- 不写迁移脚本本体：脚本由 `impl/19` §⑩ 的 `MigrationSourceSPI` 承载，本文件是其输入契约。

## §2 迁移批次最终清单（B1–B11）

### 2.1 三份互斥 B1 清单的合并取舍（D-CDM-1）

| 来源 | 原清单性质 | 取舍 |
| --- | --- | --- |
| `impl/19:68` | 持久化域视角：迁移框架 + 段 + 恢复 + 快照 + 对象引用 | **骨架**：全部保留（含备份/演练表提前到 B1，理由：REQ-PERS-03 要求备份能力先于首个破坏性迁移） |
| `impl/01:51` | 会话主链路视角：会话/输入/轮次/条目/检查点 + 事件表 | **全部保留**；`oc_session_input` 是清单组装遗漏（不是语义分歧），并入 B1 |
| `impl/12:89` | Agent 视角：`oc_thread` + 输入 + 子代理链 + 副作用账本 | `oc_thread` 并入 B1；`oc_subagent_link` 移 **B4**、`oc_tool_side_effect` 移 **B2**（D-CDM-5） |
| 卷 27 §4.4 B1 表述 | 「租户/身份/项目/工作区/会话基础表 + 事件日志分区表」 | **补入** `impl/25:72` 的租户/身份最小集与 `impl/20:68` 的工作区基础表；补定 `oc_project`（D-CDM-12） |
| `impl/16:82` | 事件族表（含 `oc_event_seq` 等定序/幂等/归档表） | **全部并入 B1**：事件族必须同批，缺任一定序/幂等表则追加不成立 |
| 缺批次项 | 上下文 6 表 / 提示词 6 表 / 沙箱 6 表 / `oc_capability_gate`（R07 kernel §三，19 张） | 裁决为 **B1b（5 表，撤销 1 表）/ B6 / B2 / B1**（D-CDM-2/3/4） |

**唯一规则**：B1 = 「租户与主体 → 工作区 → 会话主链路 → 事件族 → 持久化支撑 → 恢复与快照 → 内核控制」七波；**不含**副作用账本、子代理链、任何协作/自治/企业治理表。

### 2.2 批次总表

| 批次 | 目标 | 表清单（表族 / 显式名） | 依赖批 | 可回滚策略 |
| --- | --- | --- | --- | --- |
| **B1** | 租户/身份/项目 + 工作区 + 会话主链路 + 事件日志分区族 + 迁移框架/段/恢复/快照/对象引用 + 能力门控 | 46 表，见 §2.3 | 契约冻结 | 空库可 DROP 全批；含数据后仅允许 expand-contract 反向（停写新列 → 双写回退）；`oc_event_log` 分区只允许 DETACH 归档，**禁止 DROP**（事实源） |
| **B1b** | 会话派生结构（上下文域） | `oc_context_snapshot`、`oc_context_compaction`、`oc_context_ref`、`oc_context_injection_scan`、`oc_context_source_state`（5 表；`oc_context_checkpoint` 撤销，见 D-CDM-4） | B1 | 纯派生物：可整批 DROP 并按事件重建（重建协议 = 卷 16 §⑩.4） |
| **B2** | 模型调用/用量/凭证引用 + 工具执行面（含沙箱附属）+ 计量账本 | `oc_provider`、`oc_model_descriptor`、`oc_model_call`、`oc_usage_record`、`oc_usage_hourly`、`oc_route_rule`、`oc_credential`、`oc_tool_call`、`oc_tool_result`、`oc_tool_registration`、`oc_tool_artifact`、`oc_tool_side_effect`；沙箱 6 表（X-C12-2 裁决）：`oc_sandbox_plan`、`oc_execution_record`、`oc_sandbox_violation`、`oc_sandbox_capability`、`oc_snapshot_ref`、`oc_credential_lease`；账本 8 表：`oc_usage_event`、`oc_usage_rollup_hourly`、`oc_cost_ledger_entry`、`oc_reservation`、`oc_price_table`、`oc_self_hosted_cost_model`、`oc_reconciliation`、`oc_storage_metering` | B1 | 可 DROP（执行面明细非事实源；真源 = 事件 + `oc_tool_side_effect`）。`oc_tool_side_effect` 禁止 DROP，只允许停写 + 保留只读（补偿判据） |
| **B3** | 权限/审批/授权记忆 + 审计链 + 保留/删除/校验/备份元数据 | `oc_policy`、`oc_policy_version`、`oc_permission_decision`、`oc_approval`、`oc_grant_memory`、`oc_decision_replay`、`oc_audit_event`、`oc_audit_chain_anchor`、`oc_audit_export`、**`oc_audit_segment`（新增，解 X-C30-1）**、`oc_role`、`oc_role_binding`、`oc_resource_grant`、`oc_tenant_policy`、`oc_policy_eval_trace`、`oc_compliance_control`、`oc_compliance_evidence`、`oc_retention_policy`、`oc_deletion_request`、`oc_deletion_certificate`、`oc_consistency_run`、`oc_consistency_finding` | B1 | 治理表可逐表 DROP；`oc_audit_*` 与删除证明**禁止 DROP/UPDATE**（WORM 语义），只允许按卷 19 §⑥.4 六层删除路径清理 |
| **B4** | 工作对象 + 团队协作 + 调度记录 + 交付物（Git）+ 子代理链 | `oc_work_item`、`oc_work_item_dependency`、`oc_work_item_acceptance`、`oc_work_item_evidence`、`oc_work_item_execution`、`oc_work_item_spec`、`oc_work_item_view_watermark`、`oc_work_item_template`、`oc_agent_definition`、`oc_guard_trip`、`oc_trajectory_export`、**`oc_subagent_link`**、`oc_team_member`、`oc_team_role`、`oc_team_message`、`oc_team_board_entry`、`oc_team_claim`、`oc_team_arbitration`、`oc_team_merge_entry`、`oc_team_report`、`oc_team_template`、`oc_team_budget_ledger`、`oc_goal`、`oc_goal_criterion`、`oc_goal_evidence`、`oc_goal_session`、`oc_goal_tick`、`oc_schedule`、`oc_schedule_trigger`、`oc_schedule_run`、`oc_schedule_missed`、`oc_schedule_preauth`、`oc_workspace_command`、`oc_workspace_pty_session`、`oc_workspace_background_task`、`oc_workspace_pending_op`、`oc_git_repo`、`oc_git_worktree`、`oc_git_merge_task`、`oc_git_operation_log`、`oc_git_commit_trace`、`oc_git_scan_cache`、`oc_git_conflict_resolution`、`oc_git_checkpoint` | B1 | 可见业务数据：expand-contract + 双写；`oc_git_*` 台账可 DROP 并由仓库/磁盘对账重建（真源 = `refs/*` + `.git/worktrees/*`） |
| **B5** | 记忆 + 知识库（含索引元数据） | `oc_memory_entry`、`oc_memory_version`、`oc_memory_candidate`、`oc_memory_correction`、`oc_memory_deletion_proof`、`oc_memory_feedback_rule`、`oc_memory_index_task`、`oc_memory_recall_log`、`oc_memory_fts`、`oc_kb_source`、`oc_kb_document`、`oc_kb_chunk`、`oc_kb_edge`、`oc_kb_symbol`、`oc_kb_wiki_page`、`oc_kb_wiki_revision`、`oc_kb_embedding_generation`、`oc_kb_stale_record`、`oc_kb_citation_audit`、`oc_kb_feedback` | B1 | 派生索引可整批重建（登记 `oc_projection_state`）；`oc_kb_citation_audit` 与 `oc_memory_deletion_proof` 为审计事实，禁止 DROP |
| **B6** | 扩展生态（Skill/MCP/Hook/Plugin）+ 企业治理（特性开关/DLP/SCIM/预算）+ 提示词资产 | `oc_skill_package`、`oc_skill_version`、`oc_skill_activation`、`oc_skill_source`、`oc_skill_dependency_lock`、`oc_skill_eval_run`、`oc_mcp_server`、`oc_mcp_server_state`、`oc_mcp_capability`、`oc_mcp_tool_binding`、`oc_mcp_auth_grant`、`oc_mcp_exposure_grant`、`oc_mcp_audit`、`oc_mcp_quota_rollup`、`oc_hook`、`oc_hook_binding`、`oc_hook_execution`、`oc_hook_health`、`oc_plugin`、`oc_plugin_version`、`oc_plugin_grant`、`oc_plugin_health`、`oc_extension_registry`、`oc_feature_flag`、`oc_feature_flag_override`、`oc_dlp_rule`、`oc_dlp_block_record`、`oc_scim_sync_record`、`oc_budget`、`oc_quota_policy`、`oc_quota_grant`、`oc_cost_allocation_rule`、`oc_capacity_parameter`、`oc_optimization_finding`；提示词 6 表（R07 X-84 裁决）：`oc_prompt_asset`、`oc_prompt_asset_version`、`oc_prompt_release`、`oc_prompt_gray_arm`、`oc_prompt_assembly_log`、`oc_prompt_drift_finding` | B1–B5 | 资产/配置类可逐表 DROP；`oc_extension_registry`/`oc_plugin_grant` 停写前必须禁止装载（否则插件面不可解释） |
| **B7** | 端形态与交互 | `oc_cli_*`（6）、`oc_ui_*`（6）、`oc_ui_preference`、`oc_share_link`、`oc_share_visit` | B1 | 端侧数据可 DROP（偏好丢失，用户可重建） |
| **B8** | 安全运行时与分发遥测 | `oc_sec_asset_tag`、`oc_sec_credential_meta`、`oc_sec_credential_lease`、`oc_sec_blocklist_version`、`oc_sec_boundary_probe`、`oc_sec_vulnerability`、`oc_sec_incident`、`oc_sec_abuse_signal`、`oc_sec_egress_manifest`（9）；`oc_dist_install_state`、`oc_dist_update_event`、`oc_dist_announcement_ack`、`oc_dist_license`、`oc_dist_crash_fingerprint`、`oc_dist_consent_audit`、`oc_dist_egress_manifest`（7） | B1 | 遥测类可 DROP（合规弃用）；`oc_sec_credential_meta`/`oc_dist_consent_audit` 为安全事实，停写保留只读 |
| **B9** | 生态与互操作 | `oc_a2a_*`、`oc_remote_agent`、`oc_remote_agent_call`、`oc_acp_session_link`、`oc_federation_node`（9）；`oc_registry_entry`、`oc_registry_sync`、`oc_import_item`、`oc_im_binding`、`oc_feedback_item`、`oc_deeplink_audit`、`oc_search_document`、`oc_sdk_release`、`oc_sdk_client`（10） | B1 | 可 DROP（外部目录可重同步；`oc_import_item` 重建需重跑导入） |
| **B10** | 自动化、智能增强与前沿实验 | `oc_automation_*`（9）、`oc_ai_*`（9）、`oc_experiment_*`、`oc_prototype_run`、`oc_federation_pair`（8） | B4 + B6 | 实验类表随开关关闭后 DROP；`oc_ai_run`/`oc_ai_output` 若已被引用为评测证据需先归档 |
| **B11** | 质量与运维 | `oc_qa_*`（14）、`oc_ops_*`（22：`oc_ops_probe_def`、`oc_ops_probe_result`、`oc_ops_slo`、`oc_ops_budget_ledger`、`oc_ops_burn_alert`、`oc_ops_alert_rule`、`oc_ops_alert_event`、`oc_ops_alert_silence`、`oc_ops_alert_quality_daily`、`oc_ops_runbook_def`、`oc_ops_runbook_run`、`oc_ops_runbook_step`、`oc_ops_drill_def`、`oc_ops_drill_run`、`oc_ops_evidence`、`oc_ops_capacity_sample`、`oc_ops_scaling_action`、`oc_ops_repair_plan`、`oc_ops_repair_batch`、`oc_ops_incident`、`oc_ops_timeline_entry`、`oc_ops_postmortem`；另 `oc_ops_improvement_item`、`oc_ops_oncall_shift`、`oc_ops_escalation_event`） | B1 + B3 | 可逐表 DROP；`oc_ops_postmortem`/`oc_ops_incident` 停写保留只读（复盘引用） |

**批次内表族计数口径**：B8 的 `oc_sec_*` 采用 `impl/27` §⑧ 实际表名（含 `oc_sec_egress_manifest`，与 `impl/28` 的 `oc_dist_egress_manifest` 为端点视角与分发视角两张表，**不是**同名双写，D-CDM-13）。

### 2.3 B1 表清单（46 表，按建表顺序七波；owner = 唯一写入者）

| 波 | 表 | owner（实现域） | 说明 |
| --- | --- | --- | --- |
| W1 租户与主体 | `oc_org`、`oc_identity`、`oc_membership`、`oc_team`、`oc_service_account`、`oc_api_key`、`oc_deployment_instance`、**`oc_project`（D-CDM-12 补定）** | `25` | `oc_team` 只建「组织单元 + 归属」列；协作列族（`oc_team_*`）随 B4（D-CDM-9，解 C10） |
| W2 工作区 | `oc_workspace`、`oc_workspace_binding`、`oc_connection_profile`、`oc_env_profile`、`oc_workspace_ignore_rule`、`oc_workspace_quota_sample` | `20` | 与 `20:68` 一致 |
| W3 会话主链路 | `oc_session`、`oc_thread`、`oc_session_input`、`oc_turn`、`oc_item`、`oc_checkpoint` | `01`/`12`/`19` 联合（写入者见 §3 各表） | 本文 §3 给出 DDL |
| W4 事件族 | `oc_event_seq`、`oc_event_log`（分区）、`oc_projection_state`、`oc_consumer_offset`、`oc_consumer_idempotency`、`oc_event_producer_idempotency`、`oc_event_deadletter`、`oc_event_archive`、`oc_event_purge_proof`、`oc_webhook_subscription` | `16` | 表名以 `16:685-695` 为准；`01:661` 的两个旧名作别名（D-CDM-6，解 C8） |
| W5 持久化支撑 | `oc_schema_version`、`oc_migration_record`、`oc_object_ref`、`oc_session_log_segment`、`oc_session_log_generation`、`oc_export_job`、`oc_import_job`、`oc_import_report` | `19` | `oc_import_job` 唯一 owner = `19`（`29` 只写 `oc_import_item`） |
| W6 恢复与快照 | `oc_recovery_scan`、`oc_recovery_item`、`oc_snapshot`、`oc_snapshot_entry`、`oc_backup_job`、`oc_backup_artifact`、`oc_drill_record` | `19` | `oc_snapshot*` 唯一 owner = `19`（`20`/`21` 只读引用） |
| W7 内核控制 | `oc_capability_gate` | `01` | 解 C19：装配门控与降级留痕，随 `oc_session` 同批 |

### 2.4 组件级建议的表归入批次（逐条裁决）

| 建议（SUGGESTIONS.md:line） | 表 | 裁决 |
| --- | --- | --- |
| `X-C12-2`（:65，阻塞） | `oc_sandbox_plan`、`oc_execution_record`、`oc_sandbox_violation`、`oc_sandbox_capability`、`oc_snapshot_ref`、`oc_credential_lease` | **B2**（与 `oc_tool_call` 同生命周期，采纳 R07 kernel X-85） |
| `X-C18-1`（:81） | `oc_subagent_link`（+ `brief_digest`、幂等唯一索引） | **B4**（本文件 D-CDM-5 裁定；新增列 + `uk(parent_thread_id, parent_item_id, brief_digest)`） |
| `X-C30-1`（:145） | `oc_audit_segment`（`segment_id`/`tenant_id`/`from_seq`/`to_seq`/`state`/`manifest_digest`/`archived_at`） | **B3**（采用建议列集，追加 `uk(tenant_id, segment_id)` 与 `(tenant_id, state, to_seq)`） |
| `X-C20-1`（:92）/ R07 X-89 | `oc_workitem*` vs `oc_work_item*` | **B4**，物理名取 `oc_work_item*`（D-CDM-11） |
| `X-C28-5`（:136，阻塞） | `oc_git_*`（8 表） | **B4**（卷 27 §4.4 B4 表述扩写为「工作对象 + 团队 + 调度 + **交付物（Git/worktree/合并队列/提交追溯）**」） |
| R07 X-84 | 提示词 6 表 | **B6**（组织级资产，非会话派生；不接受其晚于 B2 的可用性风险 → 提示词最小集由 `harness-contract` 常量承载，不依赖表） |
| R07 X-83 | 上下文 6 表 | **B1b，且撤销 `oc_context_checkpoint`**（D-CDM-4） |
| `impl/01:51` | `oc_capability_gate` | **B1 W7** |
| `impl/13:72` | `oc_goal*`、`oc_schedule*`、`oc_team_*` | **B4**（工作对象 + 团队 + 调度同批；`oc_team` 本体已前移 B1，见 D-CDM-9） |
| `impl/20:68` | `oc_workspace_command`、`oc_workspace_pty_session`、`oc_workspace_background_task`、`oc_workspace_pending_op` | **B4** |

## §3 核心表定义（B1 范围，PostgreSQL 14+ DDL 草案）

### 3.1 通用约定

- 主键：内部 `id BIGINT`（雪花，应用生成，**禁** `serial`/`identity`）；对外暴露引用用不透明 `TEXT`（ULID 或 UUID 字符串，防遍历）或 `UUID`。
- 通用列（除位点/幂等/字典表外全表必备）：`tenant_id BIGINT NOT NULL`、`created_at TIMESTAMPTZ NOT NULL DEFAULT now()`、`updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`；软删表追加 `deleted_at TIMESTAMPTZ`、乐观锁表追加 `version BIGINT NOT NULL DEFAULT 0`。
- 枚举列一律 `TEXT` 存 **code**（禁存 desc），键值与 `appendix-c` 枚举码表一一对应；`TEXT` 长度不设限（code 短，PG 无性能差异），在 DDL 中用 `CHECK` 约束合法取值集合。
- 结构化/可变结构 `JSONB`，一律内嵌 `schemaVersion` 字段；时间统一 `TIMESTAMPTZ`（UTC 存储）；大对象外置并留指针（`*_ref`）。
- **行尾中文注释在落地脚本中必须转为 `COMMENT ON COLUMN`**（本节为节约篇幅用 `--` 行尾注释表达，语义等价；`mvn` 校验脚本按 `COMMENT ON COLUMN` 条数核对列注释完备性）。
- MyBatis-Plus：每个实体**逐实体显式** `@TableName("oc_xxx")`，不使用全局 `table-prefix`；查询/更新/排序一律 `Entity::getField` 方法引用。

### 3.2 `oc_session`（会话主记录；状态权威 — 裁决 C3/C5 的会话侧）

```sql
CREATE TABLE oc_session (
    id              BIGINT      NOT NULL,                              -- 雪花主键（应用生成）
    tenant_id       BIGINT      NOT NULL,                              -- 租户；上下文缺失即拒（TENANT_CONTEXT_MISSING）
    owner_id        BIGINT      NOT NULL,                              -- 归属主体（人/服务账号）
    project_id      BIGINT,                                            -- 所属项目（可空：未入项目会话）
    workspace_ref   TEXT,                                              -- 工作区引用（oc_workspace.id，不透明串）
    model_ref       TEXT,                                              -- 绑定模型引用（可空=会话内路由）
    title           TEXT,                                              -- 会话标题（列表展示，可空）
    state           TEXT        NOT NULL DEFAULT 'IDLE',               -- RunnerState code
    runner_epoch    BIGINT      NOT NULL DEFAULT 0,                    -- 执行权代数（乐观锁条件列）
    last_event_seq  BIGINT      NOT NULL DEFAULT 0,                    -- 会话最新事件 seq（投影缓存，非真源）
    permission_mode TEXT        NOT NULL DEFAULT 'DEFAULT',            -- 权限模式 code
    retention_class TEXT        NOT NULL DEFAULT 'SESSION',            -- 保留三态（L-083）：SESSION/ARCHIVED/TRASH
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,                                       -- 软删（回收站）
    version         BIGINT      NOT NULL DEFAULT 0,                    -- 乐观锁版本
    CONSTRAINT pk_oc_session PRIMARY KEY (id),
    CONSTRAINT uk_oc_session_tenant_id UNIQUE (tenant_id, id),         -- 供同租户复合外键引用
    CONSTRAINT ck_oc_session_epoch CHECK (runner_epoch >= 0),
    CONSTRAINT ck_oc_session_seq CHECK (last_event_seq >= 0)
);
CREATE INDEX ix_oc_session_owner ON oc_session (tenant_id, owner_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_oc_session_state ON oc_session (tenant_id, state) WHERE deleted_at IS NULL;
CREATE INDEX ix_oc_session_project ON oc_session (tenant_id, project_id);
```

**会话状态权威声明（D-CDM-8）**：会话级状态（`state`/`runner_epoch`/`last_event_seq`）**仅** `oc_session`；`oc_thread` 的 `state` 是执行线程态（主线程通常等同，SubAgent 独立），二者不得互相覆盖。

### 3.3 `oc_thread`（执行线程；Session:Thread 基数显式声明 = 1:1 主线程 + 0..N SubAgent）

```sql
CREATE TABLE oc_thread (
    thread_id        TEXT        NOT NULL,                             -- 对外不透明 ID（主键）
    tenant_id        BIGINT      NOT NULL,
    session_id       BIGINT      NOT NULL,                             -- 归属会话
    parent_thread_id TEXT,                                             -- 非空 = SubAgent 子线程（委派链）
    kind             TEXT        NOT NULL DEFAULT 'MAIN',              -- MAIN/SUBAGENT/TEAM
    workspace_id     BIGINT,
    mode             TEXT        NOT NULL DEFAULT 'REACT',             -- 循环策略 code
    autonomy         TEXT        NOT NULL DEFAULT 'STANDARD',          -- 自主度 code
    budget_total     JSONB       NOT NULL DEFAULT '{}'::jsonb,         -- 双信封预算（含 schemaVersion）
    state            TEXT        NOT NULL DEFAULT 'CREATED',           -- 线程态：CREATED/ACTIVE/PAUSED/COMPLETED/FAILED
    last_event_seq   BIGINT      NOT NULL DEFAULT 0,                   -- 线程位点缓存（真源 = 事件）
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_oc_thread PRIMARY KEY (thread_id),
    CONSTRAINT uk_oc_thread_session_thread UNIQUE (session_id, thread_id),  -- 供 (session_id, thread_id) 复合外键
    CONSTRAINT fk_oc_thread_session FOREIGN KEY (session_id) REFERENCES oc_session (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uk_oc_thread_main ON oc_thread (session_id) WHERE kind = 'MAIN';   -- 主线程唯一
CREATE INDEX ix_oc_thread_parent ON oc_thread (parent_thread_id) WHERE parent_thread_id IS NOT NULL;
```

### 3.4 `oc_session_input`（**唯一输入/准入表**，D-CDM-2 解 C7；`oc_agent_input` 撤销）

```sql
CREATE TABLE oc_session_input (
    id             BIGINT      NOT NULL,                               -- 雪花主键
    tenant_id      BIGINT      NOT NULL,
    session_id     BIGINT      NOT NULL,
    thread_id      TEXT,                                               -- 目标线程（可空=主线；投递语义列）
    input_id       TEXT        NOT NULL,                               -- 业务幂等键（客户端 Idempotency-Key）
    admitted_seq   BIGINT,                                             -- 准入序（成功时分配；幂等重放返回同值）
    state          TEXT        NOT NULL DEFAULT 'QUEUED',              -- QUEUED/ADMITTED/PROMOTED/DROPPED
    delivery       TEXT        NOT NULL DEFAULT 'QUEUE',               -- 投递语义：QUEUE/STEER/INTERRUPT
    source         TEXT        NOT NULL DEFAULT 'USER',                -- USER/APPROVAL/TOOL/SYSTEM
    policy         TEXT,                                               -- 队列满时策略 code
    priority       INTEGER     NOT NULL DEFAULT 0,                     -- 优先级（大者先提升）
    payload        JSONB       NOT NULL,                               -- 输入内容块（多模态块 + 附件引用）
    trace_id       TEXT,
    arrived_at     TIMESTAMPTZ NOT NULL DEFAULT now(),                 -- 到达时刻
    promoted_at    TIMESTAMPTZ,                                        -- 提升时刻
    turn_id        TEXT,                                               -- 提升落入的 Turn
    dropped_reason TEXT,
    CONSTRAINT pk_oc_session_input PRIMARY KEY (id),
    CONSTRAINT uk_oc_session_input_idem UNIQUE (session_id, input_id),  -- 幂等键：唯一执行点
    CONSTRAINT fk_oc_session_input_session FOREIGN KEY (session_id) REFERENCES oc_session (id) ON DELETE CASCADE
);
CREATE INDEX ix_oc_session_input_queue ON oc_session_input (session_id, admitted_seq) WHERE state = 'QUEUED';
CREATE INDEX ix_oc_session_input_thread ON oc_session_input (thread_id, state) WHERE thread_id IS NOT NULL;
```

**裁决理由（一张表而非两张）**：① `C01:84` 已把「双表并存」按状态漂移/双写判为淘汰；② `C01:447`（R-SM-1）建议合并、`impl/19:68` 的 B1 只列 `oc_agent_input`、`impl/01:51` 只列 `oc_session_input`——任取其一都会漏列另一半；③ 语义上「会话准入」是外层、Agent 投递是其子状态，用 `thread_id` + `delivery` 两列即可无损表达；④ 单表使「幂等键唯一」只在一处成立（双表会让同一 `input_id` 在两表各判一次）。

### 3.5 `oc_turn`（轮次；`state` 与 `phase` 并存，D-CDM-3 解 C3）

```sql
CREATE TABLE oc_turn (
    id            BIGINT      NOT NULL,
    tenant_id     BIGINT      NOT NULL,
    turn_id       TEXT        NOT NULL,                                -- 对外不透明 ID
    session_id    BIGINT      NOT NULL,                                -- 会话归属（12 §⑧ 原清单缺此列）
    thread_id     TEXT        NOT NULL,                                -- 归属执行线程
    seq           BIGINT      NOT NULL,                                -- 会话内事件序（与会话事件同空间）
    turn_no       INTEGER     NOT NULL,                                -- 会话内轮次号（从 1 递增）
    state         TEXT        NOT NULL DEFAULT 'PENDING',              -- 轮次生命周期：PENDING/ACTIVE/DRAINING/COMPLETED/FAILED/ABORTED
    phase         TEXT        NOT NULL DEFAULT 'IDLE',                 -- Agent 循环阶段（TurnPhase code）；与 state 非同一概念
    intent        TEXT,                                                -- 轮次意图（用户/系统）
    plan_ref      TEXT,                                                -- 计划引用（文件或 WorkItem）
    planned_depth INTEGER,                                             -- 计划深度（严格计划策略使用）
    usage         JSONB       NOT NULL DEFAULT '{}'::jsonb,            -- token/成本结算（含 schemaVersion）
    outcome       TEXT,                                                -- 收尾结论 code
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at      TIMESTAMPTZ,
    CONSTRAINT pk_oc_turn PRIMARY KEY (id),
    CONSTRAINT uk_oc_turn_id UNIQUE (turn_id),
    CONSTRAINT uk_oc_turn_seq UNIQUE (session_id, seq),                -- 会话内轮次 seq 唯一
    CONSTRAINT uk_oc_turn_no UNIQUE (session_id, turn_no),
    CONSTRAINT fk_oc_turn_session FOREIGN KEY (session_id) REFERENCES oc_session (id) ON DELETE CASCADE,
    CONSTRAINT fk_oc_turn_thread FOREIGN KEY (session_id, thread_id)
        REFERENCES oc_thread (session_id, thread_id)                   -- 复合外键：Turn 的 thread 必须属于同会话
);
CREATE INDEX ix_oc_turn_active ON oc_turn (tenant_id, phase) WHERE state IN ('PENDING', 'ACTIVE', 'DRAINING');
CREATE INDEX ix_oc_turn_thread ON oc_turn (thread_id, started_at DESC);
```

### 3.6 `oc_item`（会话条目；**正文承载列裁决为 `payload JSONB`**，D-CDM-4 解 C4）

```sql
CREATE TABLE oc_item (
    id             BIGINT      NOT NULL,
    tenant_id      BIGINT      NOT NULL,
    item_id        TEXT        NOT NULL,                               -- 对外不透明 ID
    session_id     BIGINT      NOT NULL,
    thread_id      TEXT        NOT NULL,
    turn_id        TEXT,                                               -- 可空（系统级 Item 不属任何 Turn）
    seq            BIGINT      NOT NULL,                               -- 会话事件序（= 对应 durable 事件 seq；单调、可空洞、禁回退）
    item_type      TEXT        NOT NULL,                               -- MESSAGE/TOOL_CALL/TOOL_RESULT/APPROVAL/CHECKPOINT/SUBAGENT/SYSTEM
    actor          TEXT        NOT NULL,                               -- 产生者：USER/ASSISTANT/TOOL/SYSTEM
    payload        JSONB,                                              -- 内联载荷（正文/内容块；阈值内必须内联）
    payload_ref    TEXT,                                               -- 超阈外置（>64KiB → oc_object_ref(content_hash)）
    payload_size   BIGINT      NOT NULL DEFAULT 0,                     -- 载荷字节数（外置阈值判定留痕）
    summary        TEXT,                                               -- 投影摘要（列表渲染，不占模型 token）
    ref_id         TEXT,                                               -- 关联业务引用（审批 ID / 工具调用 ID / 检查点 ID）
    parent_item_id TEXT,                                               -- 父条目（工具调用树/子代理嵌套）
    sensitivity    TEXT        NOT NULL DEFAULT 'INTERNAL',            -- 敏感度（订阅过滤用）
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_oc_item PRIMARY KEY (id),
    CONSTRAINT uk_oc_item_id UNIQUE (item_id),
    CONSTRAINT uk_oc_item_seq UNIQUE (session_id, seq),                -- 会话内条目序唯一（与检查点幂等键同空间）
    CONSTRAINT ck_oc_item_payload CHECK (payload IS NOT NULL OR payload_ref IS NOT NULL),
    CONSTRAINT fk_oc_item_session FOREIGN KEY (session_id) REFERENCES oc_session (id) ON DELETE CASCADE
);
CREATE INDEX ix_oc_item_turn ON oc_item (session_id, turn_id, seq);
CREATE INDEX ix_oc_item_type ON oc_item (session_id, item_type, seq DESC);
```

**裁决理由**：① `impl/12:635` 的 `payload_ref` 命名即「引用」，单靠它会使「消息正文无承载列」，第 5 步「落库」写不出来；② 内联 `payload` + 超阈 `payload_ref` 两列并存，且以 `CHECK` 保证至少一个非空，兼顾短消息（1 次写）与长工具输出（外置）；③ `seq` 采用**会话事件序**而非「Turn 内序号」，使条目、检查点、事件三者共享同一 seq 空间（恢复算法只认一个序）；④ 外置阈值 64KiB 与事件 `EVENT_MAX_PAYLOAD_BYTES`（262144）**有意不同层级**（保留 `impl/12:653` 的口径），二者各自配置化。

### 3.7 `oc_checkpoint`（检查点；唯一物理表，D-CDM-4 解 C5/C6）

```sql
CREATE TABLE oc_checkpoint (
    id                     BIGINT      NOT NULL,
    tenant_id              BIGINT      NOT NULL,
    checkpoint_id          TEXT        NOT NULL,                       -- 对外身份（不透明引用）
    session_id             BIGINT      NOT NULL,                       -- 幂等键所需（12 §⑧ 原清单缺此列）
    thread_id              TEXT        NOT NULL,                       -- 归属列（跨端接管后会变，**不得作身份**）
    turn_id                TEXT,
    seq                    BIGINT      NOT NULL,                       -- 会话事件序；幂等键 = (session_id, seq)
    event_anchor_seq       BIGINT      NOT NULL,                       -- 锚定事件 seq（agent.item.committed(CHECKPOINT)）
    plan_snapshot          JSONB,                                      -- ≡ 01 的 payload_ref 语义位（别名收敛到此）
    workspace_ref          TEXT,                                       -- ≡ 01 的 workspace_version / 03 的 workspace_pointer
    context_digest         JSONB,                                      -- ≡ 03 的 section_digest
    section_digest         JSONB,                                      -- 逐段摘要与预算占用
    budget_consumed        JSONB,                                      -- 预算消耗快照
    side_effect_ledger     JSONB,                                      -- 未结算副作用快照（真源 = oc_tool_side_effect）
    usage                  JSONB,                                      -- token/成本快照
    open_questions         JSONB,                                      -- 未决问题
    payload_ref            TEXT,                                       -- 超大物化载荷外置
    payload_format_version TEXT        NOT NULL,                       -- 物化载荷格式版本（缺版本即拒绝强解）
    estimator_version      TEXT,                                       -- token 估算口径版本
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_oc_checkpoint PRIMARY KEY (id),
    CONSTRAINT uk_oc_checkpoint_id UNIQUE (checkpoint_id),
    CONSTRAINT uk_oc_checkpoint_idem UNIQUE (session_id, seq),
    CONSTRAINT fk_oc_checkpoint_session FOREIGN KEY (session_id) REFERENCES oc_session (id) ON DELETE CASCADE
);
CREATE INDEX ix_oc_checkpoint_latest ON oc_checkpoint (session_id, seq DESC);
CREATE INDEX ix_oc_checkpoint_turn ON oc_checkpoint (turn_id) WHERE turn_id IS NOT NULL;
```

**裁决**：`impl/03:715` 的 `oc_context_checkpoint` **撤销**，其 `oc_context_checkpoint` 独有列（`section_digest`/`budget_consumed`/`event_anchor_seq`/`payload_format_version`/`estimator_version`）以可空列并入本表；`impl/12:647-650` 的「唯一物理表」声明成立，`impl/03` §⑧ 的该行回改为别名指针。完整性判据不变：仅当锚定事件已提交才算「已提交检查点」（半写记录忽略并清理）。

### 3.8 `oc_event_log`（分区事实源）+ `oc_event_seq`（跨分区定序）

```sql
CREATE TABLE oc_event_seq (
    partition_key TEXT        NOT NULL,                                -- 分区键 = 会话/团队/计划 ID
    tenant_id     BIGINT      NOT NULL,
    next_seq      BIGINT      NOT NULL DEFAULT 1,                      -- 下一个可用 seq
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_oc_event_seq PRIMARY KEY (partition_key),
    CONSTRAINT ck_oc_event_seq CHECK (next_seq >= 1)
);

CREATE TABLE oc_event_log (
    event_id      UUID        NOT NULL,                                -- UUIDv7（时间序可排序兜底）
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),                  -- **分区列**（写入时刻，注入时钟）
    occurred_at   TIMESTAMPTZ NOT NULL,                                -- 业务时间（仅作过滤，**不作**分区列）
    tenant_id     BIGINT      NOT NULL,
    project_id    BIGINT,
    category      TEXT        NOT NULL,                                -- DOMAIN/SYSTEM/TELEMETRY/AUDIT
    type          TEXT        NOT NULL,                                -- 点分事件名（只增不改）
    version       INTEGER     NOT NULL DEFAULT 1,
    partition_key TEXT        NOT NULL,
    seq           BIGINT      NOT NULL,                                -- 分区内单调（由 oc_event_seq 分配）
    actor_type    TEXT,
    actor_id      TEXT,
    subagent_id   TEXT,
    trace_id      TEXT,
    span_id       TEXT,
    parent_span_id TEXT,
    correlation_id TEXT,
    sensitivity   TEXT        NOT NULL DEFAULT 'INTERNAL',
    payload       JSONB       NOT NULL,                                -- 元事件载荷只含编号/枚举/计数/耗时/引用
    schema_ref    JSONB,                                               -- {type, version, ignorable}
    hash_prev     CHAR(64),                                            -- 审计类行哈希链（域分隔前缀 + sha256）
    hash          CHAR(64),
    CONSTRAINT pk_oc_event_log PRIMARY KEY (recorded_at, tenant_id, partition_key, seq)
) PARTITION BY RANGE (recorded_at);

CREATE INDEX ix_oc_event_log_partition_seq ON oc_event_log (partition_key, seq);
CREATE INDEX ix_oc_event_log_tenant_type  ON oc_event_log (tenant_id, type, recorded_at);
CREATE INDEX ix_oc_event_log_correlation  ON oc_event_log (correlation_id);
CREATE INDEX ix_oc_event_log_trace        ON oc_event_log (trace_id);
-- 分区模板（兜底）+ 预建：见 §4 IV-10；不建 payload 索引（GIN 仅排障时临时建）
```

**裁决（D-CDM-6，解 C2/C14）**：① 分区列 = `recorded_at`（`impl/19:730` 与 `impl/16:685` 一致），`occurred_at` **不分区**（迟到事件不跨分区改写归档边界）；② 主键必须含分区列 → `impl/01:660` 的 `PK (tenant_id, partition_key, seq)` 在 PG 分区表上**不合法**，废弃；③ **不建**「全局唯一 (partition_key, seq)」——PG 分区表不支持不含分区列的全局唯一约束，跨分区唯一性由 `oc_event_seq` 的行锁分配保证（`impl/16:686`）；④ `impl/01:530` 的「事件追加按 `(sessionId, seq)` 唯一约束串行化」改为：「追加事务内 `UPDATE oc_event_seq ... RETURNING` 分配 seq + 本地索引 `(partition_key, seq)`」；⑤ 审计/合规类行写哈希链，非审计行两列为 NULL（避免全表写放大）。
**保留窗口（对齐卷 16 §⑧.1 与卷 19 §4.6）**：领域/系统在线 1 年（可配到永久）、遥测 30 天、审计 3 年；热 30 天 → 温 1 年 → 冷归档（Parquet + zstd，元数据落 `oc_event_archive`）；分区提前滚动创建 3 个月。

### 3.9 对象引用表；`oc_media` / `oc_blob` 裁决（D-CDM-7）

```sql
CREATE TABLE oc_object_ref (
    id            BIGINT      NOT NULL,
    tenant_id     BIGINT      NOT NULL,
    namespace     TEXT        NOT NULL,                                -- media/artifacts/snapshots/sessionlog/exports/backups
    content_hash  CHAR(64)    NOT NULL,                                -- sha256（内容寻址）
    store_uri     TEXT        NOT NULL,                                -- 对象存储 URI（内容寻址，不可变）
    size_bytes    BIGINT      NOT NULL,
    ref_count     BIGINT      NOT NULL DEFAULT 0,                      -- 引用计数（0 且过宽限期才可回收）
    state         TEXT        NOT NULL DEFAULT 'LIVE',                 -- LIVE/PENDING_GC/DELETED
    pending_gc_at TIMESTAMPTZ,                                         -- 孤儿回收时间点（宽限期后）
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_oc_object_ref PRIMARY KEY (id),
    CONSTRAINT uk_oc_object_ref UNIQUE (namespace, content_hash),      -- 内容寻址去重唯一键
    CONSTRAINT ck_oc_object_ref_refs CHECK (ref_count >= 0)
);
CREATE INDEX ix_oc_object_ref_gc ON oc_object_ref (state, pending_gc_at) WHERE state <> 'LIVE';
```

**裁决：B1 不建 `oc_media` / `oc_blob`**（理由：① 全语料无任何 impl 声明这两张表，纯任务提示词候选；② 媒体元数据由 `oc_item.payload` 的多模态块 + `oc_object_ref`（命名空间 `media/`）承载，引用计数与 GC 由本表统一；③ 需要独立媒体元数据表时，归 **B2** 与 `oc_tool_artifact` 同批，且必须以 `oc_object_ref` 为唯一存储真源，禁止再建第二套内容寻址表）。

### 3.10 B1 其余表（列清单，落到脚本时补全 DDL 与中文列注释）

| 表 | 关键列（超出通用列者） | 约束/索引 | 分区与保留 |
| --- | --- | --- | --- |
| `oc_schema_version` | `domain`、`version`、`checksum`、`applied_at` | `uk(domain, version)` | 长期 |
| `oc_migration_record` | `version`、`domain`、`phase`、`destructive`、`checksum`、`state`、`started_at`、`finished_at`、`rows_affected` | `uk(tenant_id, domain, version)`、`(state, started_at)` | 长期 |
| `oc_session_log_segment` / `_generation` | 段：`generation`、`segment_no`、`format_version`、`content_hash`、`state`、`sealed_at`；代：`manifest_uri`、`manifest_hash`、`state`、`superseded_by` | `uk(session_id, generation, segment_no)`、`uk(session_id, generation)` | 随会话；`ARCHIVED` 后可清行留清单 |
| `oc_export_job` / `oc_import_job` / `oc_import_report` | job：`scope`、`state`、`package_uri`、`manifest_hash`、`signed`、`skipped_count`、`source_instance`；report：`entry_type`、`entry_id`、`result`、`reason` | `(state, created_at)`；包级 `uk(tenant_id, source_instance, package_hash)`；条目级 `(package_hash, entry_id)` | 1 年 |
| `oc_recovery_scan` / `oc_recovery_item` | scan：`scope`、`state`、`candidates`、`auto_resumed`、`confirmation`、`abandoned`；item：`item_ref`（`session:<id>`/`effect:<key>`/`lease:<id>`/`run:<id>`/`op:<key>`/`merge:<id>`）、`verdict`、`evidence_seq`、`compensation`、`resolved_by` | 部分唯一索引 `(tenant_id) WHERE state='RUNNING'`；**`uk(scan_id, item_ref)`**；`(scan_id, verdict)` | 90 天 |
| `oc_snapshot` / `oc_snapshot_entry` | snapshot：`workspace_id`、`manifest_uri`、`size_bytes`、`dedupe_ratio`；entry：`path`、`content_hash`、`mode`、`mtime` | `uk(snapshot_id, path)` | 保留窗口 + 容量上限 |
| `oc_backup_job` / `oc_backup_artifact` / `oc_drill_record` | artifact：`artifact_id`(ULID)、`identity`、`store_uri`、`checksum`、`wal_from`、`wal_to`、`encrypted` | `uk(artifact_id)`、`uk(identity)` | job 1 年；artifact 按保留策略 |
| `oc_projection_state` | `projection_name`、`partition_key`、`last_seq`、`digest`、`status`（LIVE/REBUILDING/BROKEN）、`rebuilt_at` | PK `(projection_name, partition_key)`；`(status, rebuilt_at)` | 长期 |
| `oc_consumer_offset` / `_idempotency` | `consumer_group`、`partition_key`、`offset_seq`、`state`；`event_id`、`applied_at` | PK `(consumer_group, partition_key)`、PK `(consumer_group, event_id)` | 去重窗口 7 天 |
| `oc_event_producer_idempotency` | `producer_key`、`event_id`、`partition_key`、`seq`、`appended_at` | `uk(tenant_id, producer_key)` | 7 天 |
| `oc_event_deadletter` | `target_ref`、`event_id`、`attempts`、`last_status`、`last_error`、`next_retry_at`、`state` | `uk(target_ref, event_id, attempt_round)`；`(state, next_retry_at)` | 90 天 |
| `oc_event_archive` / `oc_event_purge_proof` | archive：`from_recorded_at`、`to_recorded_at`、`category`、`object_ref`、`row_count`、`checksum`；proof：`scope jsonb`、`purged_count`、`proof_object_ref`、`chain_verified` | `(category, to_recorded_at DESC)`、`(tenant_id, completed_at DESC)` | 归档 1 年+；证明 3 年+ |
| `oc_webhook_subscription` | `subscription_id`、`name`、`url_ref`、`secret_ref`、`filters jsonb`、`enabled`、`max_attempts`、`backoff jsonb` | `uk(subscription_id)`、`(tenant_id, enabled)` | 长期；凭证只存引用 |
| `oc_capability_gate` | `gate_key`、`capability`、`outcome`、`reason`、`probed_at`、`evidence_ref` | `(tenant_id, capability, probed_at DESC)` | 90 天 |
| `oc_project` | `project_id`、`tenant_id`、`name`、`slug`、`owner_id`、`state` | `uk(tenant_id, slug)` | 长期 |

## §4 关键不变量与约束

| ID | 不变量 | DB 层执行点 | 应用层执行点 |
| --- | --- | --- | --- |
| IV-1 | 同一 `partition_key` 的事件 `seq` 严格单调且无空洞 | `oc_event_seq` 行锁 + `UPDATE ... RETURNING` 在同一追加事务内；本地索引 `(partition_key, seq)` | `EventAppender` 单写者；追加失败整事务回滚（不留半行） |
| IV-2 | 检查点 `seq` ≤ 该会话最新已提交事件 `seq` | 无 FK 可表达 → 写入时断言（见右） | `CheckpointWriter` 写入前读 `oc_session.last_event_seq` 断言；`seq` 超界抛 `HarnessException(CONFLICT)` |
| IV-3 | 检查点「已提交」= 锚定事件已提交 | `uk(session_id, seq)` 抑制重复；锚定事件在 `oc_event_log` | 半写记录（有行无锚定事件）在恢复扫描时忽略并清理（INV-6） |
| IV-4 | 输入幂等键唯一（同一 `input_id` 只准入一次） | `uk(session_id, input_id)`；命中冲突由写入方改为读取既有行 | `InputAdmission.admit` 捕获唯一冲突 → 返回既有 `admittedSeq`（不报错） |
| IV-5 | 租户列非空且不可跨租户 | 所有租户域表 `tenant_id BIGINT NOT NULL`；无租户语义的全局字典表必须进白名单 | 持久层租户拦截器强制注入条件；注入失败抛 `TENANT_CONTEXT_MISSING`（**不静默返回空集**） |
| IV-6 | 条目 `payload` 与 `payload_ref` 至少一侧非空；外置件必有 `oc_object_ref` 行 | `CHECK (payload IS NOT NULL OR payload_ref IS NOT NULL)` | 外置写入顺序：先 CAS 落对象 + `oc_object_ref` 行，再写 `oc_item.payload_ref`（避免悬挂引用） |
| IV-7 | 条目 `seq` 单调递增、禁回退、允许空洞 | `uk(session_id, seq)`；`seq` 由事件定序分配 | `TrajectoryProjector` 只追加（`SETTLED` 条目永不重写） |
| IV-8 | Turn 的 `thread_id` 必须属于同 `session_id` | 复合外键 `fk_oc_turn_thread (session_id, thread_id)` | 写入前校验线程归属（跨会话复用线程必须是新行） |
| IV-9 | 会话级派生表的 `session_id` 必须存在且有效 | 外键 `→ oc_session(id) ON DELETE CASCADE`（turn/item/input/checkpoint/thread） | 会话删除走卷 19 §⑥.4 六层路径，禁止直接 `DELETE` 绕过删除证明 |
| IV-10 | 分区存在性：热窗口 + 预建 3 个月始终存在，缺失即启动失败 | `oc_ops_probe_def`/启动门禁校验 `pg_class` 分区集合（`19` §10.3 R0 启动门禁） | `HostProfile` 启动序列在 `system.ready` 之前校验；缺失抛 `INTERNAL_ERROR`，禁止「降级启动」 |
| IV-11 | `runner_epoch` 只增不减，执行权抢占必须条件更新且行数 = 1 | `ck_oc_session_epoch CHECK (runner_epoch >= 0)`；条件更新在 `WHERE runner_epoch = :expected` | 更新行数 ≠ 1 → 转排队分支（`CONFLICT`/Queued，**不视为错误**） |
| IV-12 | 引用计数与 GC 状态自洽（`ref_count = 0` 且过宽限期才可 `DELETED`） | `ck_oc_object_ref_refs CHECK (ref_count >= 0)`；`(state, pending_gc_at)` 驱动 GC 扫描 | `ObjectStoreSPI` 单点增减；删除前必须确认无在线引用 |
| IV-13 | 事件表行永久不可变（除合规删除路径） | 撤销 `UPDATE/DELETE` 权限（表级 ACL），仅 `INSERT` + 分区 `DETACH` | 卷 16 §⑩.9「历史不可变」；合规删除只写 `oc_event_purge_proof` |
| IV-14 | 确定性写路径必须单写者（禁止双写同名表） | 无 DB 可表达 → 由 owner 登记表（§2.3）与代码评审双签保证 | 各表 owner 唯一；非 owner 域只能经端口/事件消费（`19` D-PERS-1） |

## §5 索引与查询模式

### 5.1 按会话恢复（最高频；恢复 R2/R6 路径）

```sql
-- ① 取该会话最近已提交检查点（恢复点计算）
SELECT checkpoint_id, seq, payload_ref, payload_format_version
  FROM oc_checkpoint
 WHERE session_id = $1
 ORDER BY seq DESC
 LIMIT 1;                                        -- 命中 ix_oc_checkpoint_latest：O(log n + 1)
-- ② 重放区间 (recoveryPoint, eventTail]
SELECT event_id, seq, type, version, payload
  FROM oc_event_log
 WHERE partition_key = $2 AND seq > $3 AND recorded_at >= $4   -- recorded_at 常量条件 → 分区裁剪
 ORDER BY seq
 LIMIT 1000;                                     -- 命中 ix_oc_event_log_partition_seq：O(log n + k)，k=批大小
-- ③ 渲染会话条目（UI 时间线）
SELECT item_id, turn_id, seq, item_type, actor, COALESCE(payload, '{}'::jsonb) AS payload, summary
  FROM oc_item
 WHERE session_id = $1 AND seq > $3
 ORDER BY seq
 LIMIT 200;                                      -- 命中 uk_oc_item_seq（唯一索引即索引）：O(log n + k)
```

要点：恢复路径必须带 `session_id`/`partition_key` 前缀，禁止「先按 `type` 捞后过滤」；`oc_item` 的 `summary` 列允许 UI 无需读 `payload`（避免长文本进列表查询）。

### 5.2 按租户审计

```sql
-- ① 审计类事件范围扫描（合规导出/审计查询）
SELECT recorded_at, type, actor_type, actor_id, payload
  FROM oc_event_log
 WHERE tenant_id = $1
   AND category = 'AUDIT'
   AND recorded_at >= $2 AND recorded_at < $3      -- 分区裁剪（月）
 ORDER BY recorded_at DESC
 LIMIT 500;                                        -- 命中 ix_oc_event_log_tenant_type：O(log n + k)
-- ② 会话维度审计下钻（谁在何时对哪个会话做了什么）
SELECT s.id, s.owner_id, s.state, e.type, e.seq, e.recorded_at
  FROM oc_session s
  JOIN LATERAL (
      SELECT type, seq, recorded_at FROM oc_event_log
       WHERE partition_key = ('session:' || s.id)::text AND seq > 0
       ORDER BY seq DESC LIMIT 5
  ) e ON true
 WHERE s.tenant_id = $1 AND s.owner_id = $2
 ORDER BY s.updated_at DESC
 LIMIT 50;                                         -- 先 ix_oc_session_owner，再每行 ix_oc_event_log_partition_seq
```

要点：审计查询不得依赖 `payload` 索引（GIN 仅在排障时临时建）；审计类行的哈希链校验按 `(tenant_id, chain_seq)` 顺序扫描，与范围扫描分离。

### 5.3 按时间范围回放

```sql
-- ① 在线窗口内跨会话回放（投影重建/评测重放）
SELECT partition_key, seq, type, payload
  FROM oc_event_log
 WHERE recorded_at >= $1 AND recorded_at < $2
   AND category = 'DOMAIN'
 ORDER BY recorded_at, partition_key, seq
 LIMIT 10000;                                      -- 分区裁剪 + ix_oc_event_log_tenant_type（或无索引顺序扫描，见下）
-- ② 冷数据回读（在线行已归档）
SELECT object_ref, from_recorded_at, to_recorded_at, row_count
  FROM oc_event_archive
 WHERE category = 'DOMAIN' AND to_recorded_at >= $1
 ORDER BY to_recorded_at DESC
 LIMIT 24;                                         -- 命中 (category, to_recorded_at DESC)：O(log n + 24)
```

要点：跨会话时间窗回放**天然无法只靠索引收敛**——它的复杂度由分区裁剪决定（`recorded_at` 常量条件 → 只扫命中月份的分区内索引）；未带时间常量条件的全表回放是 O(在线分区总行数)，必须由 `event.admin` 权限 + `RATE_LIMITED` 限流约束（禁在会话面暴露）。

| 查询类 | 索引 | 复杂度 | 备注 |
| --- | --- | --- | --- |
| 会话恢复：检查点 | `ix_oc_checkpoint_latest` | O(log n + 1) | n = 单会话检查点数（≤ 会话轮次） |
| 会话恢复：事件尾重放 | `ix_oc_event_log_partition_seq` | O(log n + k) | 分区裁剪后单分区内 |
| 会话恢复：条目渲染 | `uk_oc_item_seq` / `ix_oc_item_turn` | O(log n + k) | k = 页大小 |
| 租户审计 | `ix_oc_event_log_tenant_type` | O(log n + k) | 需 `recorded_at` 常量条件 |
| 会话列表 | `ix_oc_session_owner` | O(log n + k) | 部分索引排除软删 |
| 时间窗回放 | 分区裁剪 + `(category, to_recorded_at DESC)` | O(P + k)，P = 命中分区数 | 归档元数据兜底回读 |

## §6 数据量与容量对齐

**口径来源**：卷 31 §4.1「10k 用户」基准（`U=10000`、`T=50 轮/人/日`、`E_r=60 事件/轮`、`S_e≈1.5KiB`）。

| 量（10k 用户） | 公式 | 值 | 对 B1 的决策含义 |
| --- | --- | --- | --- |
| 日事件数 | `U×T×E_r` | **3.0×10⁷ 行/天** | 单月分区 ≈ **9.0×10⁸ 行**；必须月分区 + 预建 3 个月 |
| 日事件字节（原始） | `日事件数×S_e` | **45 GB/天** | 单月原始 ≈ 1.35 TB |
| 在线热数据（30 天） | 压缩前保留热副本 | **≈1.35 TB（含索引 ≈1.8 TB）** | 单实例热数据规划线 = 2 TB 内（卷 31 结论） |
| 索引体积（B1 三索引） | `数据 × 35%~45%` | **≈0.45 TB / 30 天** | 索引必须分区本地化；禁建 `payload` GIN（否则再 +30%） |
| 归档压缩后 | `×0.23`（Parquet+zstd） | **≈10.5 GB/天 → 3.8 TB/年** | 冷层按年增长，与 `oc_event_archive` 元数据对齐 |
| 分区数 | 热 30 天 + 预建 3 个月 + 在线保留 1 年 | **在线 12–15 个/租户域** | 分区提前滚动创建 3 个月（`open-coding.event.partition.months-ahead`） |
| 会话与消息 | `U×T×4×2KiB` | ≈4 GB/天 → 120 GB/30 天 | `oc_item` 随会话保留；`summary` 列降低列表查询读放大 |
| 检查点增量 | `U×T×0.2MiB×去重 0.25` | ≈25 GB/天（**默认仅并行/团队开启 → ≈5 GB/天**） | `oc_checkpoint.payload_ref` 外置是必需项（非可选优化） |
| 事件写入峰值 | `日事件数/8h×4` | **≈4.2k EPS** | `oc_event_seq` 行锁是写入热点 → 必须「单事务单分区」并在多分区时按 `partition_key` 字典序加锁 |
| 恢复扫描（1k 未完成会话） | P95 | **≤10 s** | `ix_oc_session_state` 部分索引 + `uk(tenant_id) WHERE state='RUNNING'` |

**两条禁止**（对齐 `impl/19:864`）：① 不得按「10 GiB 热数据」的小档租户口径规划大租户；② 不得把两档混算（小档 ≈ 数十活跃用户，大档 = 卷 31 §4.1 的 10k 口径）。

## §7 冲突裁决与回改清单

### 7.1 裁决表（D-CDM-n ⇔ §1.2 的 Cn）

| 文件（冲突处） | 冲突内容 | 本文件裁决 | 需回改处 |
| --- | --- | --- | --- |
| `impl/01:51`、`impl/12:89`、`impl/19:68` | 三份互斥 B1 清单 | 合并为 §2.3 的 46 表七波清单（D-CDM-1） | 三处「数据批次」段改为「引本文 §2」；卷 27 §4.4 每批补「表清单 + owner」列 |
| `impl/01:660`、`impl/01:530`、`impl/16:685`、`appendix-a:168` | 事件表主键/分区/唯一性 | §3.8：分区列 `recorded_at`，无全局唯一，`oc_event_seq` 定序（D-CDM-6） | 01 §8.1 改为别名指针 + 指向 16 §8.1；附录 A.8 分区列改 `recorded_at` |
| `impl/01:657`、`impl/12:634` | `oc_turn` 列名 | §3.5：`state` 与 `phase` 并存 + `session_id`/`thread_id`/`seq`/`turn_no`（D-CDM-3） | 01/12 表段改为「列名别名表 + 指针」；12 补 `session_id` |
| `impl/01:658`、`impl/12:635` | `oc_item` 正文列 | §3.6：内联 `payload JSONB` + `payload_ref` + `CHECK`（D-CDM-4） | 12 §8.1 增内联列；01 表段加 `payload`/`payload_type` 别名说明 |
| `impl/12:637/647-650`、`impl/03:715` | 检查点自相矛盾 + 两表名 | §3.7：唯一 `oc_checkpoint`，撤销 `oc_context_checkpoint`（D-CDM-4） | 12 §8.1 增 `session_id`；03 §8.1 该行改别名指针；`impl/19:719` 无改 |
| `impl/01:656`、`impl/12:636`、`C01:447` | 输入表双状 | §3.4：唯一 `oc_session_input`，`oc_agent_input` 撤销（D-CDM-2） | 12 §8.1 删除该表行；C01 R-SM-1 标记已裁决；`impl/19:68` B1 清单改写 |
| `impl/01:661`、`impl/16:691/692` | 位点/死信表名 | `oc_projection_state` / `oc_event_deadletter` 为物理名（D-CDM-6） | 01 §8.1 两行改别名指针 |
| `impl/19:721`、`impl/12:638` | 副作用账本表名 | 物理名 `oc_tool_side_effect`；`oc_side_effect_ledger` 为持久化域视图名（D-CDM-9） | 19 §8.1 保持「同一物理表」注 + 补物理名 |
| `impl/13:72`、`impl/25:72` | `oc_team` 双批次 | `oc_team` 本体 + 归属列 → B1（owner 25）；`oc_team_*` 协作族 → B4（owner 13）（D-CDM-9） | 13 §⑧ 表族拆分为「B1 依赖引用 + B4 自建」 |
| `impl/02:40`、`appendix-a:134` | `oc_credential` 跨域同名 | 物理名归 B2（模型/工具凭证引用，owner 02）；身份域密钥引用走 B1 `oc_api_key`（D-CDM-10） | 附录 A.6 身份行删 `oc_credential`，改为指针 |
| `impl/02:40`、`impl/26:69` | 计量双表 | 两表共存：`oc_usage_record`（模型调用维度明细，owner 02，B2）/ `oc_usage_event`（账本事件，owner 26，B2）（D-CDM-13） | 02/26 各补一句「与另一表的语义边界」 |
| `appendix-a:146`、`impl/14:75` | 工作对象表名 | 物理名 `oc_work_item*`（D-CDM-11） | 附录 A.6/A.8 全部改为 `oc_work_item*`（解 X-89/X-C20-1） |
| 附录 A.9 全表（`oc_update_*`/`oc_announcement`/`oc_license`/`oc_alert_*`/`oc_playbook*`/`oc_capacity_sample`/`oc_secret_ref`/`oc_trust_config`/`oc_external_task`/`oc_repo`/`oc_merge_queue` 等约 40 名） | 概念名与 impl §⑧ 物理名分叉 | 物理名一律取 impl §⑧ 实际前缀（`oc_dist_*`/`oc_ops_*`/`oc_automation_*`/`oc_sec_*`/`oc_a2a_*`/`oc_git_*`）（D-CDM-11） | 附录 A.9 逐行回改（或标注「概念名」）；未回改前不得进入迁移脚本 |
| `impl/21:60` | `oc_git_*` 无批次（X-C28-5 阻塞） | 归 **B4**，卷 27 §4.4 B4 表述扩写为「+ 交付物（Git/worktree/合并队列/提交追溯）」（D-CDM-9） | 卷 27 §4.4 B4 行 + `impl/21` §⑧ 落地登记 |
| `SUGGESTIONS:145`（X-C30-1） | `oc_audit_segment` 缺失 | 新增表，归 **B3**（D-CDM-14） | `impl/25` §8.3 增表行；SUGGESTIONS 标记已采纳 |
| `SUGGESTIONS:65`（X-C12-2，阻塞） | 沙箱六表无批次 | 归 **B2**（D-CDM-9） | 卷 27 §4.4 B2 行 + `impl/07` §⑧ 落地登记 |
| `impl/01:51`（`oc_capability_gate`） | 无批次 | 归 **B1 W7**（D-CDM-14） | 卷 27 §4.4 B1 行 |
| `impl/12:89`、`impl/19:68` | `oc_subagent_link` 批次两可 | 归 **B4**（D-CDM-5） | 12/19 落地登记统一为 B4 |
| C01 `R-SM-1`、C18 `X-C18-1`、C30 `X-C30-1` | 组件级待裁决 | 全部已裁决：见 §2.4 | `SUGGESTIONS.md` §2 三行标记「已由 CORE-DATA-MODEL 裁决」 |

### 7.2 剩余未映射（本文件裁决后仍无落点者）

1. **`oc_project`**：卷 27 §4.4 B1 表述含「项目基础表」、`oc_event_log.project_id` 亦引用它，但全语料**无任何 impl 声明其列与 owner** → 本文件补定为 **B1 W1，owner `25`**（列见 §3.10）；`impl/25` §8.1 需补该表行（D-CDM-12）。
2. **附录 A.9 的约 40 个「概念名」**（`oc_announcement`、`oc_image_cache`、`oc_seat_assignment`、`oc_notification`/`oc_notification_route`、`oc_coachmark_state`、`oc_postmortem`、`oc_alert_rule`/`oc_alert_event`/`oc_runbook_ref`、`oc_capacity_sample`、`oc_cost_attribution`、`oc_quota_dynamic`、`oc_optimization_record`、`oc_playbook*`、`oc_asset_classification`、`oc_secret_ref`/`oc_secret_rotation`、`oc_trust_config`、`oc_vuln_record`、`oc_incident`、`oc_abuse_signal`、`oc_external_task`、`oc_a2a_caller`、`oc_agent_endpoint`、`oc_repo`、`oc_merge_queue`、`oc_git_operation_log` 等）：在附录 A.9 回改前，它们在迁移脚本中**不存在**（物理名见 §2.2 的 B7–B11 表清单）；这是唯一一类「概念名 vs 物理名」遗留，回改后即清零。
3. **`oc_ops_improvement_item` 与 `oc_qa_improvement_item`**：R07 platform §4.3 已裁定 `oc_qa_improvement_item` owner = `33`（`34` 只引用），但 `impl/34` §⑧ 仍声明 `oc_ops_improvement_item` 自有 → 本文件按 R07 裁定执行：`34` 侧该行降级为**视图/引用**，不建独立物理表（D-CDM-14 尾注）。

> 本文件落盘后需由编排方同步：`impl/README.md` §4 未裁决清单（R-SM-1 标记已裁决）、`impl/IMPL-DECISIONS.md` §4（登记 D-CDM-1…14 并回填 X-83/X-84/X-85/X-89/X-C12-2/X-C18-1/X-C20-1/X-C28-5/X-C30-1 状态）、`27-technical-path.md` §4.4（补 B1b 与 B7–B11 + 每批「表清单 + owner」列）、`reviews/R10-walkthrough.md` B4/B5/B6 三项标记为「已由 `impl/00-contracts/CORE-DATA-MODEL.md` 闭合」。
