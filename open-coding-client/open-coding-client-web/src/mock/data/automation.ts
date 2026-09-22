/**
 * 自动化模板库 / 智能增强包 / 前沿探索 域 mock 数据（卷 34 / 卷 35 / 卷 25）。
 *
 * 三条主线：
 * - 自动化：模板是「配置」不是新的执行路径 —— 模板声明 triggers/target/steps/permissions/verification，
 *   运行时仍走卷 15 调度 + 卷 06 决策链 + 卷 07 沙箱；默认只提 PR，禁 force-push。
 * - 智能增强：8 项能力共用共性约束 C1–C8 —— 产出标注「AI 生成 + 模型 + 提示词版本」、
 *   可校订、不自动合并、成本可见、强制引用、无依据明确拒答。
 * - 前沿探索：12 个方向统一模板 + 五级阶梯 + 「实验」徽标 + 可关闭 + 数据隔离与下线迁移。
 *
 * 数据全部由固定种子确定性生成，中文，互相以 id 关联。
 */
import { Rng, NAMES, REPOS } from '../rng';

/* ============================================================================
 * 一、自动化模板库（卷 34）
 * ========================================================================== */

/** 模板场景分类（七类，与 N2-01 侧栏一致） */
export type TemplateCategory = '依赖' | '巡检' | '文档' | '发布' | '运维' | '质量' | '治理';
/** 声明风险级（R0–R3，装载期与 permissions 交叉校验） */
export type AutomationRisk = 'R0' | 'R1' | 'R2' | 'R3';
/** 参数来源：user=用户输入，probe=仓库/环境探测，context=上下文推导（非用户来源必须标记） */
export type InputSource = 'user' | 'probe' | 'context';
/** 产出契约类型 */
export type OutputType = 'pr' | 'comment' | 'report' | 'notification' | 'file';
/** 受限步骤类型（声明式，非脚本；不允许 shell 管道/重定向/网络下载） */
export type StepType = 'detect' | 'filter' | 'for-each' | 'apply' | 'run' | 'verify' | 'open-pr' | 'report';
/** 权限上限：只读 / 禁 force-push（可写但不许强推） */
export type PermissionCeiling = 'read-only' | 'no-force-push' | 'no-merge';
/** 触发对象绑定 */
export type TemplateTarget = 'task_template' | 'plan_template' | 'goal' | 'session_template' | 'team_run';
/** 模板来源 */
export type Provenance = 'builtin' | 'org-repo' | 'market';
/** 实例状态 */
export type InstanceState = 'ENABLED' | 'DISABLED' | 'PAUSED';
/** 九态运行机（卷 34 §5.5） */
export type RunStatus =
  | 'QUEUED' | 'DEDUPLICATED' | 'BLOCKED' | 'RUNNING' | 'VERIFYING'
  | 'SUCCEEDED' | 'FAILED' | 'ESCALATED' | 'CANCELLED';

export interface TemplateInput {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'enum';
  /** enum 取值域 */
  enum?: string[];
  /** 数值范围（如 1–10） */
  range?: string;
  default: string | number | boolean;
  source: InputSource;
  required: boolean;
}

export interface TemplateOutput {
  type: OutputType;
  schema: string;
  /** 存放位置/通道 */
  storage: string;
  /** freeform=true 时正文由模型自由生成（需门禁约束） */
  freeform: boolean;
}

export interface TemplateTrigger {
  kind: '时间' | '事件' | '条件' | '手动' | '组合';
  spec: string;
  timezone?: string;
  /** 防抖（合并短时间内的重复触发） */
  debounce?: string;
  /** 节流（同窗口最多一次） */
  throttle?: string;
}

export interface TemplateStep {
  type: StepType;
  desc: string;
}

export interface TemplatePermissions {
  allow: string[];
  ceiling: PermissionCeiling;
  /** 显式拒绝清单（上限清单不可请求） */
  denied: string[];
}

export interface TemplateBudget {
  costUsd: number;
  durationMin: number;
  toolCalls: number;
  fanout: number;
}

export interface TemplateVerification {
  assert: string;
  mechanical: boolean;
}

export interface TemplateFailure {
  retry: string;
  degrade: string;
  dropArtifacts: string;
  circuitThreshold: string;
}

export interface TemplatePresentation {
  format: '摘要' | '详细' | '仅异常';
  slots: string[];
  language: string;
}

export interface TemplateMetric {
  key: string;
  target: string;
}

export interface TemplateCompat {
  contractVersion: string;
  tools: string[];
  skills: string[];
}

export interface AutomationTemplate {
  id: string;
  name: string;
  version: string;
  summary: string;
  why: string;
  category: TemplateCategory;
  tags: string[];
  riskLevel: AutomationRisk;
  inputs: TemplateInput[];
  outputs: TemplateOutput[];
  triggers: TemplateTrigger[];
  target: TemplateTarget;
  steps: TemplateStep[];
  permissions: TemplatePermissions;
  budget: TemplateBudget;
  verification: TemplateVerification[];
  failure: TemplateFailure;
  presentation: TemplatePresentation;
  metrics: TemplateMetric[];
  compat: TemplateCompat;
  provenance: Provenance;
  signature: string;
  /** 市场/私仓分发时的签名主体 */
  signedBy: string;
  /** 是否已在本租户安装 */
  installed: boolean;
  /** 沙箱档位（与风险级交叉校验） */
  sandboxTier: string;
  /** 度量主指标 */
  mainMetric: string;
}

export interface InstanceInputBinding {
  name: string;
  value: string;
  source: InputSource;
}

export interface InstanceAuthorizationSnapshot {
  grantedBy: string;
  at: string;
  actions: string[];
  ceiling: PermissionCeiling;
  /** 企业基线版本（审计用） */
  baselineVersion: string;
}

export interface InstanceBudgetEnvelope {
  costUsd: number;
  durationMin: number;
  toolCalls: number;
  fanout: number;
  usedCostUsd: number;
  usedToolCalls: number;
}

export interface TemplateInstance {
  id: string;
  templateId: string;
  templateName: string;
  /** 定义版本冻结：升级不自动迁移 */
  definitionVersion: string;
  latestVersion: string;
  state: InstanceState;
  inputsBinding: InstanceInputBinding[];
  targetBinding: { kind: TemplateTarget; ref: string; desc: string };
  authorizationSnapshot: InstanceAuthorizationSnapshot;
  budgetEnvelope: InstanceBudgetEnvelope;
  createdAt: string;
  lastRunAt: string;
  runCount: number;
  successRatio: number;
  owner: string;
  scope: string;
}

export interface RunLedgerEntry {
  at: string;
  action: string;
  /** 实际影响面（文件/分支/PR/耗时） */
  effect: string;
  /** 权限决策结论（决策链引用） */
  decision: string;
}

export interface RunStep {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  durationMs: number;
  ledger: RunLedgerEntry[];
}

export interface RunArtifactRef {
  id: string;
  type: OutputType;
  ref: string;
}

export interface VerificationResult {
  assert: string;
  expected: string;
  actual: string;
  pass: boolean;
}

export interface TemplateRun {
  runId: string;
  templateId: string;
  templateName: string;
  version: string;
  triggerSource: string;
  idempotencyKey: string;
  /** 命中去重窗口时，指向首次运行（用于解释「为什么没跑」） */
  deduplicatedOf?: string;
  dedupWindow?: string;
  status: RunStatus;
  steps: RunStep[];
  artifacts: RunArtifactRef[];
  costUsd: number;
  startedAt: string;
  endedAt: string | null;
  verificationResults: VerificationResult[];
  /** BLOCKED 原因（预授权越界/兼容不符/配额不足），不消耗预算 */
  blockedReason?: string;
  /** 失败阶段与已采取动作 */
  failureStage?: string;
  takenAction?: string;
  escalation?: { threshold: string; consecutiveFailures: number; escalatedTo: string; at: string };
  cancellable: boolean;
  actor: string;
}

export interface TakeoverItem {
  id: string;
  runId: string;
  templateName: string;
  kind: 'ESCALATED' | 'BLOCKED';
  reason: string;
  since: string;
  attempts: number;
  suggestedFix: string;
  oneClickFix: string;
  /** 通知级别固定为「需处理」且不可静默 */
  notifyLevel: '需处理';
}

export interface TakeoverBacklog {
  week: string;
  escalatedCount: number;
  blockedCount: number;
  avgHandleMinutes: number;
  oldestMinutes: number;
  slaBreach: number;
}

export interface AutomationArtifact {
  id: string;
  type: OutputType;
  templateId: string;
  templateName: string;
  runId: string;
  title: string;
  location: string;
  schema: string;
  adopted: boolean;
  /** 采纳率（PR 合并率 / 报告被引用率） */
  adoptRatio: number;
  /** 幂等更新标记：created / updated / reused（同一条评论复用） */
  idempotentUpdate: 'created' | 'updated' | 'reused';
  at: string;
  sizeKb: number;
  freeform: boolean;
}

export interface AutomationMetricsBoard {
  kpis: {
    key: string;
    label: string;
    value: number;
    unit: string;
    format: 'number' | 'cost' | 'percent';
    delta: number;
    target: number;
    targetKind: 'min' | 'max';
    hint: string;
    /** 数据缺口标注（不静默：缺基准/缺采集即标注） */
    gap?: string;
  }[];
  byTemplate: {
    templateId: string;
    templateName: string;
    runs: number;
    savedHours: number;
    savedHoursEstimated: boolean;
    findings: number;
    adoptRatio: number;
    unitCost: number;
  }[];
  findingsByType: { name: string; value: number }[];
  findingsBySeverity: { name: string; value: number }[];
  trend: { name: string; points: { x: string; y: number }[] }[];
  dataGaps: string[];
}

export interface NotificationRouting {
  levels: {
    level: '信息' | '需关注' | '需处理';
    channels: string[];
    merge: string;
    quiet: string;
    examples: string[];
  }[];
  takeoverRule: string;
}

export interface AuditItem {
  key: string;
  label: string;
  content: string;
  level: '强制' | '条件' | '可关闭';
  note: string;
}

export interface ExportedPackage {
  id: string;
  name: string;
  sizeKb: number;
  createdAt: string;
  fileCount: number;
  entries: { path: string; kind: string; hash: string }[];
  stripped: string[];
  tenantCheck: {
    result: 'PASS' | 'BLOCKED';
    checks: { item: string; result: 'PASS' | 'WARN' | 'BLOCKED'; detail: string }[];
  };
}

export interface MarketSync {
  status: 'synced' | 'sync.failed';
  catalogVersion: string;
  lastSyncAt: string;
  nextSyncAt: string;
  /** 离线标记：市场不可用时用本地缓存模板集并标记「离线」 */
  offline: boolean;
  sources: {
    name: string;
    kind: '公共市场' | '组织私仓' | '本地缓存';
    version: string;
    syncedAt: string;
    status: 'synced' | 'sync.failed' | 'offline';
    note: string;
  }[];
  failures: { source: string; code: string; reason: string; recovery: string }[];
}

export interface AutomationData {
  templates: AutomationTemplate[];
  categories: { name: TemplateCategory; count: number }[];
  instances: TemplateInstance[];
  runs: TemplateRun[];
  takeovers: { queue: TakeoverItem[]; backlog: TakeoverBacklog[] };
  artifacts: AutomationArtifact[];
  metricsBoard: AutomationMetricsBoard;
  notificationRouting: NotificationRouting;
  auditSnapshot: { items: AuditItem[]; snapshotRef: string }[];
  exportedPackage: ExportedPackage;
  marketSync: MarketSync;
}

const DENIED_CEILING = ['force-push', '删他分支', '生产环境写', '密钥/凭据读取', '审计日志改写', '权限与策略修改', '模板自修改'];

/** 构造 inputs 的紧凑写法：name|type|default|source|required|enum|range */
function input(name: string, type: TemplateInput['type'], def: string | number | boolean, source: InputSource, required = true, enumV?: string[], range?: string): TemplateInput {
  return { name, type, default: def, source, required, enum: enumV, range };
}

function step(type: StepType, desc: string): TemplateStep {
  return { type, desc };
}

/* --- 12 个内置模板族（卷 34 §5.6，全部带真实步骤/权限上限/档位/预算/失败映射/度量主指标） --- */

const TEMPLATES: AutomationTemplate[] = [
  {
    id: 'builtin.deps-upgrade',
    name: '依赖升级',
    version: '2.1.0',
    summary: '检测过期依赖 → 安全优先过滤 → 逐个升级并跑构建/测试 → 逐个提 PR。',
    why: '每周每仓节省 1–3 小时人工，并把安全补丁暴露窗口中位数从 14 天压到 2 天。',
    category: '依赖',
    tags: ['依赖', '安全补丁', 'PR', '定时'],
    riskLevel: 'R2',
    inputs: [
      input('scope', 'enum', 'patch', 'user', true, ['patch', 'minor']),
      input('maxPrs', 'integer', 3, 'user', true, undefined, '1–10'),
      input('packageManager', 'string', 'npm', 'probe', false),
    ],
    outputs: [
      { type: 'pr', schema: 'deps-upgrade-pr@2', storage: '独立分支 + 独立 worktree', freeform: false },
      { type: 'report', schema: 'deps-upgrade-report@2', storage: '运行报告（Markdown + JSON）', freeform: true },
    ],
    triggers: [
      { kind: '时间', spec: '每周一 09:00（cron 0 0 9 * * 1）', timezone: 'Asia/Shanghai', debounce: '10min', throttle: '每仓每日 1 次' },
      { kind: '事件', spec: 'dependency.outdated（安全补丁可用时立即触发）', throttle: '同仓库 6h 最多 1 次' },
    ],
    target: 'task_template',
    steps: [
      step('detect', '检测过期依赖（含安全通告交叉比对）'),
      step('filter', '安全优先过滤：security > patch > minor，且按 ${scope} 收敛'),
      step('for-each', '对每个候选包：升级 → 构建 + 测试 → 断言无回归 → 提 PR（受 ${maxPrs} 限制）'),
      step('report', '汇总升级结果与未处理清单（超限停止并报告）'),
    ],
    permissions: {
      allow: ['workspace.write', 'command.build', 'command.test', 'git.branch', 'git.commit', 'git.push', 'pr.create'],
      ceiling: 'no-force-push',
      denied: DENIED_CEILING,
    },
    budget: { costUsd: 20, durationMin: 60, toolCalls: 400, fanout: 1 },
    verification: [
      { assert: 'build.success && test.success', mechanical: true },
      { assert: 'diff.touchedOnly(["**/package.json", "**/package-lock.json"])', mechanical: true },
    ],
    failure: {
      retry: '构建失败重试 1 次（幂等步骤，退避 60s）',
      degrade: '仍失败则降级为「只出升级建议报告」',
      dropArtifacts: '丢弃分支与临时产物，仅保留报告',
      circuitThreshold: '连续 3 次失败 → 熔断并升级人工',
    },
    presentation: { format: '摘要', slots: ['PR 描述', '报告', '通知'], language: 'follow-user' },
    metrics: [
      { key: 'saved_hours', target: '≥ 1h/仓/周' },
      { key: 'artifact_adopt_ratio', target: '≥ 60%' },
    ],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['git', 'shell', 'file-edit'], skills: [] },
    provenance: 'builtin',
    signature: 'ed25519:9f2c4a…a71b',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L2 可写',
    mainMetric: '节省时长、PR 采纳率',
  },
  {
    id: 'builtin.pr-triage',
    name: 'PR 巡检',
    version: '1.4.0',
    summary: '读 PR diff → 规则通道 + 模型通道检查 → 产出 SARIF/JSON → 单条评论更新。',
    why: '首轮人工评审前自动发现规范、测试与安全类问题，减少 20–30% 评审往返。',
    category: '质量',
    tags: ['审查', '规范', '安全', 'SARIF'],
    riskLevel: 'R1',
    inputs: [
      input('severityFloor', 'enum', 'warn', 'user', true, ['info', 'warn', 'error']),
      input('pathFilter', 'string', '**/*', 'user', false),
      input('rulePack', 'string', 'org-default@3', 'context', false),
    ],
    outputs: [
      { type: 'comment', schema: 'pr-triage-comment@1', storage: 'PR 单条评论（更新而非新建）', freeform: true },
      { type: 'report', schema: 'pr-triage-sarif@2', storage: 'SARIF 附件（CI 可消费）', freeform: false },
    ],
    triggers: [
      { kind: '事件', spec: 'pull_request.opened | pull_request.updated', debounce: '30s', throttle: '同 PR 10min 最多 2 次' },
    ],
    target: 'task_template',
    steps: [
      step('detect', '读取 diff 与仓库约定文件（AGENTS 类规则）'),
      step('run', '规则通道（确定性）+ 模型通道（给依据引用行 + 规则名）'),
      step('filter', '按 ${severityFloor} 过滤；低置信默认折叠不阻塞合并'),
      step('report', '产出 SARIF/JSON 并更新同一条 PR 评论'),
    ],
    permissions: {
      allow: ['workspace.read', 'repo.comment'],
      ceiling: 'read-only',
      denied: [...DENIED_CEILING, 'workspace.write', 'git.push'],
    },
    budget: { costUsd: 3, durationMin: 15, toolCalls: 120, fanout: 1 },
    verification: [
      { assert: 'comment.created', mechanical: true },
      { assert: 'findings.every(f => f.evidenceRef != null)', mechanical: true },
    ],
    failure: {
      retry: '分析失败重试 1 次',
      degrade: '降级为「未完成分析」评论（不产出错误结论）',
      dropArtifacts: '不写任何仓库内容',
      circuitThreshold: '连续 5 次分析失败 → 熔断并升级人工',
    },
    presentation: { format: '摘要', slots: ['评审评论', '通知'], language: 'follow-user' },
    metrics: [
      { key: 'findings_total', target: '≥ 5/PR' },
      { key: 'false_positive_ratio', target: '≤ 15%' },
    ],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['git', 'file-read'], skills: ['intel/review-bot'] },
    provenance: 'builtin',
    signature: 'ed25519:31ab7d…5c02',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L1 只读',
    mainMetric: '发现问题数',
  },
  {
    id: 'builtin.docs-sync',
    name: '文档同步',
    version: '1.2.0',
    summary: '主分支合并后检测代码/API/配置/命令变化与文档的漂移，生成修订 PR 或报告。',
    why: '把「文档滞后」从人工周检变为合并即检，人工校订段落受保护不被覆盖。',
    category: '文档',
    tags: ['文档', '漂移', '可共编'],
    riskLevel: 'R2',
    inputs: [
      input('writePath', 'string', 'docs/**', 'user', true),
      input('mode', 'enum', 'pr', 'user', true, ['pr', 'report-only']),
      input('docOwners', 'string', 'CODEOWNERS 推导', 'context', false),
    ],
    outputs: [
      { type: 'pr', schema: 'docs-sync-pr@2', storage: '仅文档目录（写路径白名单）', freeform: true },
      { type: 'report', schema: 'doc-drift-report@1', storage: '运行报告 + 文档所有者通知', freeform: false },
    ],
    triggers: [
      { kind: '事件', spec: 'push 到主分支（路径过滤：源码/配置/命令变更）', debounce: '5min', throttle: '每仓 2h 最多 1 次' },
      { kind: '时间', spec: '每日 08:30 兜底扫描', timezone: 'Asia/Shanghai' },
    ],
    target: 'plan_template',
    steps: [
      step('detect', '结构化提取公开接口/配置项/环境变量/CLI 命令，与文档声明比对'),
      step('filter', '差异分类：缺失 / 过时 / 多余；跳过人工校订受保护段落'),
      step('apply', '在 ${writePath} 内生成修订（冲突段落并排展示，不覆盖人工内容）'),
      step('open-pr', '提交文档 PR（标签 docs, automated）'),
      step('report', '报告差异清单与未处理冲突'),
    ],
    permissions: {
      allow: ['workspace.read', 'workspace.write', 'git.branch', 'git.commit', 'git.push', 'pr.create'],
      ceiling: 'no-force-push',
      denied: DENIED_CEILING,
    },
    budget: { costUsd: 10, durationMin: 40, toolCalls: 240, fanout: 1 },
    verification: [
      { assert: 'diff.touchedOnly([writePath])', mechanical: true },
      { assert: 'protectedSegments.unchanged == true', mechanical: true },
    ],
    failure: {
      retry: '生成失败重试 1 次',
      degrade: '冲突无法自动消解 → 转人工并标注冲突位置',
      dropArtifacts: '丢弃文档 PR，仅保留差异报告',
      circuitThreshold: '同一文档连续 3 次修订被驳回 → 转「只报告」模式',
    },
    presentation: { format: '详细', slots: ['PR 描述', '报告', '通知（文档所有者）'], language: 'follow-user' },
    metrics: [
      { key: 'saved_hours', target: '≥ 0.5h/次' },
      { key: 'artifact_adopt_ratio', target: '≥ 50%' },
    ],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['git', 'file-edit', 'kb-search'], skills: ['intel/doc-drift'] },
    provenance: 'builtin',
    signature: 'ed25519:77d1e0…9a34',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L2 可写（限文档目录）',
    mainMetric: '节省时长、报告采纳率',
  },
  {
    id: 'builtin.release-notes',
    name: '发布说明',
    version: '1.1.0',
    summary: '标签/发布事件触发，收集提交并归类 feat/fix/breaking，生成双语发布说明并更新 CHANGELOG。',
    why: '把发版前的说明整理从 40 分钟降到 5 分钟，且 breaking 变更强制人工确认。',
    category: '发布',
    tags: ['发布', 'CHANGELOG', '双语'],
    riskLevel: 'R1',
    inputs: [
      input('fromTag', 'string', '上一发布标签', 'probe', true),
      input('toTag', 'string', '本次标签', 'probe', true),
      input('language', 'enum', 'zh-CN+en-US', 'user', true, ['zh-CN', 'en-US', 'zh-CN+en-US']),
    ],
    outputs: [
      { type: 'file', schema: 'changelog-entry@1', storage: 'CHANGELOG.md（追加）', freeform: true },
      { type: 'report', schema: 'release-notes@1', storage: '发布说明（双语）', freeform: true },
    ],
    triggers: [{ kind: '事件', spec: 'tag.created | release.published' }],
    target: 'task_template',
    steps: [
      step('detect', '收集标签区间内的提交与关联 PR'),
      step('apply', '归类 feat/fix/breaking/docs/chore，生成双语条目'),
      step('verify', 'breaking 与 security 条目挂「待人工确认」标记'),
      step('report', '更新 CHANGELOG 并产出发布说明'),
    ],
    permissions: { allow: ['workspace.read', 'workspace.write', 'git.commit'], ceiling: 'no-force-push', denied: [...DENIED_CEILING, 'git.push', 'pr.create'] },
    budget: { costUsd: 5, durationMin: 20, toolCalls: 150, fanout: 1 },
    verification: [
      { assert: 'changelog.entries.length > 0', mechanical: true },
      { assert: 'uncategorized.count == 0 || uncategorized.marked == true', mechanical: true },
    ],
    failure: {
      retry: '归类失败重试 1 次',
      degrade: '分类置信度低 → 标记「未分类」交人工（不猜测）',
      dropArtifacts: '不写 CHANGELOG，仅出草稿',
      circuitThreshold: '连续 3 次失败 → 熔断并升级人工',
    },
    presentation: { format: '详细', slots: ['报告', 'PR 描述', '通知'], language: 'zh-CN + en-US' },
    metrics: [{ key: 'saved_hours', target: '≥ 0.5h/次' }],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['git', 'file-edit'], skills: ['intel/pr-description'] },
    provenance: 'builtin',
    signature: 'ed25519:0c93be…4410',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L1 只读',
    mainMetric: '节省时长',
  },
  {
    id: 'builtin.incident-postmortem',
    name: '事故复盘',
    version: '1.0.0',
    summary: '事故关闭后回放事件总线，聚合时间线并按卷 32 模板生成复盘草稿，待人工完善。',
    why: '复盘准备时间从 2 小时降到 15 分钟，且数据缺口显式列出而不臆造时间线。',
    category: '运维',
    tags: ['事故', '复盘', '时间线'],
    riskLevel: 'R0',
    inputs: [
      input('incidentId', 'string', '—', 'context', true),
      input('windowBefore', 'integer', 120, 'user', false, undefined, '10–1440 分钟'),
      input('includeAlerts', 'boolean', true, 'user', false),
    ],
    outputs: [{ type: 'report', schema: 'postmortem-draft@1', storage: '复盘草稿（Markdown）', freeform: true }],
    triggers: [{ kind: '事件', spec: 'incident.closed' }],
    target: 'session_template',
    steps: [
      step('detect', '按 incidentId 回放事件/变更/告警，聚合时间线'),
      step('filter', '剔除噪声事件，保留因果链候选'),
      step('report', '按卷 32 §6 模板生成复盘草稿 + 数据缺口清单'),
    ],
    permissions: { allow: ['workspace.read'], ceiling: 'read-only', denied: [...DENIED_CEILING, 'workspace.write', 'repo.comment', 'git.push'] },
    budget: { costUsd: 4, durationMin: 20, toolCalls: 120, fanout: 1 },
    verification: [
      { assert: 'timeline.every(e => e.eventRef != null)', mechanical: true },
      { assert: 'dataGaps.listed == true', mechanical: true },
    ],
    failure: {
      retry: '不重试臆造（数据缺口列清单）',
      degrade: '事件源缺失 → 输出部分时间线并标注缺口',
      dropArtifacts: '不产出草稿（避免误导）',
      circuitThreshold: '连续 2 次失败 → 升级人工',
    },
    presentation: { format: '详细', slots: ['报告'], language: 'follow-user' },
    metrics: [{ key: 'saved_hours', target: '≥ 1h/次' }],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['event-query'], skills: [] },
    provenance: 'builtin',
    signature: 'ed25519:5be402…77aa',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L1 只读',
    mainMetric: '节省时长',
  },
  {
    id: 'builtin.tech-debt-scan',
    name: '技术债巡检',
    version: '1.3.0',
    summary: '周定时扫描重复率/超长函数/陈旧 TODO/过时依赖/覆盖率下降，排序产出技术债报告。',
    why: '把「债在哪」从口头讨论变成可排序清单，并可转链式清理模板。',
    category: '治理',
    tags: ['技术债', '扫描', '周定时'],
    riskLevel: 'R1',
    inputs: [
      input('topN', 'integer', 20, 'user', true, undefined, '5–100'),
      input('modules', 'string', '全部模块', 'probe', false),
    ],
    outputs: [
      { type: 'report', schema: 'tech-debt-report@3', storage: '报告（Markdown + 看板卡片）', freeform: true },
      { type: 'pr', schema: 'tech-debt-cleanup-pr@1', storage: '仅在扩展授权后生成', freeform: false },
    ],
    triggers: [{ kind: '时间', spec: '每周日 02:00', timezone: 'Asia/Shanghai', throttle: '每仓每周 1 次' }],
    target: 'plan_template',
    steps: [
      step('detect', '五维扫描（重复率 / 超长函数 / 陈旧 TODO / 过时依赖 / 覆盖率下降）'),
      step('filter', '按影响面与修复成本排序，取 topN'),
      step('report', '产出报告；可选转链式清理模板（需扩展授权）'),
    ],
    permissions: { allow: ['workspace.read', 'command.build'], ceiling: 'read-only', denied: [...DENIED_CEILING, 'workspace.write', 'git.push'] },
    budget: { costUsd: 8, durationMin: 30, toolCalls: 200, fanout: 1 },
    verification: [
      { assert: 'report.sections.all(s => s.evidenceRef != null)', mechanical: true },
      { assert: 'scan.coverage >= 0.9', mechanical: true },
    ],
    failure: {
      retry: '扫描超时 → 分模块续跑',
      degrade: '部分模块未采集 → 标注「未采集」',
      dropArtifacts: '不产出半成品报告',
      circuitThreshold: '连续 4 次超时 → 熔断并升级人工',
    },
    presentation: { format: '摘要', slots: ['报告', '看板卡片'], language: 'follow-user' },
    metrics: [{ key: 'findings_total', target: '≥ 10/周' }],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['file-read', 'shell'], skills: [] },
    provenance: 'builtin',
    signature: 'ed25519:2a71f9…08cd',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L1 只读',
    mainMetric: '发现问题数',
  },
  {
    id: 'builtin.metrics-weekly',
    name: '指标周报',
    version: '1.0.0',
    summary: '聚合活力/成本/质量/自动化收益指标（含环比），生成周报并投递。',
    why: '把周会前的数据整理自动化，数据不全时标注缺失来源而非编造。',
    category: '巡检',
    tags: ['指标', '周报', '环比'],
    riskLevel: 'R0',
    inputs: [
      input('period', 'enum', '本周', 'user', true, ['本周', '上周', '近 4 周']),
      input('channels', 'string', 'IM + 邮件', 'user', false),
    ],
    outputs: [
      { type: 'report', schema: 'metrics-weekly@1', storage: '周报（Markdown / IM / 邮件）', freeform: true },
      { type: 'notification', schema: 'digest-notify@1', storage: '通知聚合中心', freeform: false },
    ],
    triggers: [{ kind: '时间', spec: '每周一 08:00', timezone: 'Asia/Shanghai' }],
    target: 'task_template',
    steps: [
      step('detect', '采集四类指标与上一周期基线'),
      step('apply', '计算环比并生成周报章节'),
      step('report', '投递到声明通道；数据缺失来源单独列出'),
    ],
    permissions: { allow: ['workspace.read'], ceiling: 'read-only', denied: [...DENIED_CEILING, 'workspace.write'] },
    budget: { costUsd: 2, durationMin: 10, toolCalls: 80, fanout: 1 },
    verification: [
      { assert: 'each.metric.source != null', mechanical: true },
      { assert: 'missingSources.listed == true', mechanical: true },
    ],
    failure: {
      retry: '采集失败重试 1 次',
      degrade: '数据不全 → 输出部分周报 + 标注缺失来源',
      dropArtifacts: '不投递不完整周报',
      circuitThreshold: '连续 2 次失败 → 升级人工',
    },
    presentation: { format: '摘要', slots: ['报告', '通知', '看板卡片'], language: 'follow-user' },
    metrics: [{ key: 'unit_cost', target: '≤ $0.05/份' }],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['metrics-query'], skills: ['intel/digest-standup'] },
    provenance: 'builtin',
    signature: 'ed25519:c40e13…b9f1',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: false,
    sandboxTier: 'L1 只读',
    mainMetric: '单位成本',
  },
  {
    id: 'builtin.test-gap-fill',
    name: '测试补齐',
    version: '1.5.0',
    summary: '定位未覆盖关键路径 → 生成测试 → 沙箱运行验证 → 提测试 PR（生成即运行）。',
    why: '把覆盖率缺口驱动到「生成即运行」：不通过的测试直接丢弃，不污染主干。',
    category: '质量',
    tags: ['测试', '覆盖率', 'PR'],
    riskLevel: 'R2',
    inputs: [
      input('coverageTarget', 'integer', 80, 'user', true, undefined, '50–95'),
      input('maxFiles', 'integer', 10, 'user', true, undefined, '1–20'),
      input('changeDriven', 'boolean', true, 'user', false),
    ],
    outputs: [
      { type: 'pr', schema: 'test-gap-pr@2', storage: '测试目录（写路径白名单）', freeform: false },
      { type: 'report', schema: 'coverage-delta@1', storage: '覆盖率变化报告', freeform: false },
    ],
    triggers: [
      { kind: '事件', spec: 'coverage.dropped（门禁未过）| new-function.untested' },
      { kind: '时间', spec: '每周三 03:00', timezone: 'Asia/Shanghai' },
    ],
    target: 'task_template',
    steps: [
      step('detect', '定位未覆盖关键路径与缺口函数'),
      step('for-each', '逐个目标生成单元/集成/属性测试 → 沙箱运行验证 → 假测试检测'),
      step('verify', '断言覆盖率提升且既有测试期望未被修改'),
      step('open-pr', '提测试 PR（受 ${maxFiles} 限制）'),
    ],
    permissions: { allow: ['workspace.read', 'workspace.write', 'command.build', 'command.test', 'git.branch', 'git.commit', 'git.push', 'pr.create'], ceiling: 'no-force-push', denied: DENIED_CEILING },
    budget: { costUsd: 15, durationMin: 45, toolCalls: 300, fanout: 4 },
    verification: [
      { assert: 'generatedTests.all(t => t.run == "pass")', mechanical: true },
      { assert: 'existingExpectations.unchanged == true', mechanical: true },
      { assert: 'fakeTest.detected == 0', mechanical: true },
    ],
    failure: {
      retry: '生成测试不通过 → 重试 1 次（换策略）',
      degrade: '拒绝率 > 50% → 降级为「只给测试要点清单」',
      dropArtifacts: '丢弃不通过的测试文件与分支',
      circuitThreshold: '连续 3 次失败 → 熔断并升级人工',
    },
    presentation: { format: '摘要', slots: ['PR 描述', '报告'], language: 'follow-user' },
    metrics: [
      { key: 'artifact_adopt_ratio', target: '≥ 55%' },
      { key: 'findings_total', target: '≥ 8/次' },
    ],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['git', 'shell', 'file-edit'], skills: ['intel/test-gen'] },
    provenance: 'builtin',
    signature: 'ed25519:8d2047…31e6',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L2 可写（限测试目录）',
    mainMetric: 'PR 采纳率、发现问题数',
  },
  {
    id: 'builtin.flaky-hunt',
    name: 'Flaky 检测',
    version: '1.2.0',
    summary: '三法交叉识别不稳定用例 → 六类归因 → 报告 + 低风险修复 PR。',
    why: '把「这个测试又挂了」变成带置信度与证据的归因结论，无法判定时进观察清单而不误改。',
    category: '质量',
    tags: ['flaky', '归因', '观察清单'],
    riskLevel: 'R2',
    inputs: [
      input('rerunCount', 'integer', 3, 'user', true, undefined, '2–5'),
      input('autoFix', 'boolean', false, 'user', false),
    ],
    outputs: [
      { type: 'report', schema: 'flaky-report@2', storage: '报告 + 观察清单', freeform: false },
      { type: 'pr', schema: 'flaky-fix-pr@1', storage: '测试目录（仅高置信低风险）', freeform: false },
    ],
    triggers: [
      { kind: '事件', spec: 'test.run.finished（含重跑判定）', debounce: '2min' },
      { kind: '时间', spec: '每日 07:00 汇总', timezone: 'Asia/Shanghai' },
    ],
    target: 'plan_template',
    steps: [
      step('detect', '识别候选不稳定用例（同提交重跑不一致）'),
      step('verify', '三法交叉：重跑不一致 / 跨运行方差超阈值 / 隔离运行后稳定'),
      step('apply', '仅在 ${autoFix} 且高置信低风险时生成隔离标记或修复'),
      step('report', '输出归因结论 + 观察清单 + 修复 PR'),
    ],
    permissions: { allow: ['workspace.read', 'workspace.write', 'command.test', 'git.branch', 'git.commit', 'git.push', 'pr.create'], ceiling: 'no-force-push', denied: DENIED_CEILING },
    budget: { costUsd: 12, durationMin: 40, toolCalls: 260, fanout: 4 },
    verification: [
      { assert: 'flaky.confidence in ["高","中","低"]', mechanical: true },
      { assert: 'singleFailure.markedAsFlaky == false', mechanical: true },
    ],
    failure: {
      retry: '重跑不可用 → 退化为统计法并降置信度',
      degrade: '无法判定 → 进入观察清单（不误改）',
      dropArtifacts: '丢弃修复 PR，仅保留报告',
      circuitThreshold: '修复 PR 连续 2 次失败 → 停止自动修复',
    },
    presentation: { format: '摘要', slots: ['报告', 'PR 描述', '通知'], language: 'follow-user' },
    metrics: [{ key: 'findings_total', target: '≥ 3/周' }],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['shell', 'git', 'file-edit'], skills: ['intel/flaky-detect'] },
    provenance: 'builtin',
    signature: 'ed25519:6f8a52…d0b7',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L2 可写（限测试目录）',
    mainMetric: '发现问题数',
  },
  {
    id: 'builtin.license-audit',
    name: '依赖许可证审计',
    version: '1.0.0',
    summary: '收集依赖许可证 → 对照组织白名单 → 违规清单 + 替代建议。',
    why: '把合规检查从事后补救变成月度例行；白名单缺失时全量标「待定级」而非放行。',
    category: '治理',
    tags: ['许可证', '合规', '月度'],
    riskLevel: 'R0',
    inputs: [
      input('policyVersion', 'string', 'org-license-policy@2026.1', 'context', true),
      input('includeTransitive', 'boolean', true, 'user', false),
    ],
    outputs: [{ type: 'report', schema: 'license-audit@1', storage: '合规报告 + 违规清单', freeform: false }],
    triggers: [
      { kind: '时间', spec: '每月 1 日 06:00', timezone: 'Asia/Shanghai' },
      { kind: '事件', spec: 'dependency.changed' },
    ],
    target: 'task_template',
    steps: [
      step('detect', '收集直接与传递依赖的许可证声明'),
      step('filter', '对照组织白名单分级（允许 / 待定级 / 违规）'),
      step('report', '输出违规清单与替代建议'),
    ],
    permissions: { allow: ['workspace.read'], ceiling: 'read-only', denied: [...DENIED_CEILING, 'workspace.write', 'git.push'] },
    budget: { costUsd: 3, durationMin: 15, toolCalls: 100, fanout: 1 },
    verification: [
      { assert: 'violations.every(v => v.licenseRef != null)', mechanical: true },
      { assert: 'unknown.markedAsPending == true', mechanical: true },
    ],
    failure: {
      retry: '白名单服务不可用 → 重试 2 次',
      degrade: '白名单缺失 → 全量标「待定级」（不放行）',
      dropArtifacts: '不产出放行结论',
      circuitThreshold: '连续 3 次失败 → 升级人工',
    },
    presentation: { format: '详细', slots: ['报告', '通知'], language: 'follow-user' },
    metrics: [{ key: 'findings_total', target: '违规 0 项' }],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['file-read'], skills: [] },
    provenance: 'builtin',
    signature: 'ed25519:ab5531…2f7c',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L1 只读',
    mainMetric: '发现问题数',
  },
  {
    id: 'builtin.weekly-digest',
    name: '周报汇总',
    version: '1.1.0',
    summary: '聚合本周各模板运行结果与人工进度，生成单份汇总（含自动化收益章节）。',
    why: '让自动化收益可被管理层读懂：省了多少小时、提了多少 PR、采纳率多少。',
    category: '巡检',
    tags: ['汇总', '收益', '周报'],
    riskLevel: 'R0',
    inputs: [input('upstreamTemplates', 'string', '全部已启用实例', 'context', false)],
    outputs: [
      { type: 'report', schema: 'weekly-digest@2', storage: '汇总报告', freeform: true },
      { type: 'notification', schema: 'digest-notify@1', storage: '通知聚合中心', freeform: false },
    ],
    triggers: [{ kind: '时间', spec: '每周五 17:30', timezone: 'Asia/Shanghai' }],
    target: 'task_template',
    steps: [
      step('detect', '采集上游模板运行结果与人工进度'),
      step('apply', '生成汇总与自动化收益章节（含环比）'),
      step('report', '投递汇总；上游数据缺失 → 部分汇总 + 标注'),
    ],
    permissions: { allow: ['workspace.read'], ceiling: 'read-only', denied: [...DENIED_CEILING, 'workspace.write'] },
    budget: { costUsd: 2, durationMin: 10, toolCalls: 80, fanout: 1 },
    verification: [
      { assert: 'sections.every(s => s.upstreamRef != null)', mechanical: true },
      { assert: 'missingUpstream.listed == true', mechanical: true },
    ],
    failure: {
      retry: '投递失败重试 1 次',
      degrade: '上游数据缺失 → 降级为部分汇总 + 标注',
      dropArtifacts: '不投递空汇总',
      circuitThreshold: '连续 2 次失败 → 升级人工',
    },
    presentation: { format: '摘要', slots: ['报告', '通知'], language: 'follow-user' },
    metrics: [{ key: 'unit_cost', target: '≤ $0.05/份' }],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['metrics-query'], skills: [] },
    provenance: 'builtin',
    signature: 'ed25519:1de9c4…6b50',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L1 只读',
    mainMetric: '单位成本',
  },
  {
    id: 'builtin.repo-health',
    name: '仓库健康巡检',
    version: '1.0.0',
    summary: '检查构建状态/过期分支/大文件/worktree 残留/CI 时长/依赖陈旧度 → 健康分 + 建议清单。',
    why: '一次巡检覆盖六项仓库卫生指标，单项失败只标「未采集」而不会让整份报告失效。',
    category: '巡检',
    tags: ['健康分', '仓库卫生', '看板'],
    riskLevel: 'R0',
    inputs: [
      input('staleBranchDays', 'integer', 30, 'user', true, undefined, '7–180'),
      input('largeFileMb', 'integer', 5, 'user', false, undefined, '1–100'),
    ],
    outputs: [
      { type: 'report', schema: 'repo-health@1', storage: '健康报告 + 看板卡片', freeform: false },
      { type: 'file', schema: 'repo-health-json@1', storage: 'JSON 明细（供看板消费）', freeform: false },
    ],
    triggers: [{ kind: '时间', spec: '每周一 07:00', timezone: 'Asia/Shanghai', throttle: '每仓每周 1 次' }],
    target: 'task_template',
    steps: [
      step('detect', '六项检查：构建状态 / 过期分支 / 大文件 / worktree 残留 / CI 时长 / 依赖陈旧度'),
      step('filter', '按影响面排序，计算健康分'),
      step('report', '输出健康分与建议清单（单项失败标「未采集」）'),
    ],
    permissions: { allow: ['workspace.read'], ceiling: 'read-only', denied: [...DENIED_CEILING, 'workspace.write', 'git.push'] },
    budget: { costUsd: 6, durationMin: 25, toolCalls: 180, fanout: 1 },
    verification: [
      { assert: 'checks.every(c => c.status in ["ok","warn","not-collected"])', mechanical: true },
      { assert: 'score.range == [0,100]', mechanical: true },
    ],
    failure: {
      retry: '单项失败不重试整轮',
      degrade: '单项失败 → 标记「未采集」并降低置信说明',
      dropArtifacts: '不产出被污染的健康分（标注为部分）',
      circuitThreshold: '连续 3 次失败 → 升级人工',
    },
    presentation: { format: '摘要', slots: ['报告', '看板卡片'], language: 'follow-user' },
    metrics: [{ key: 'findings_total', target: '≥ 4/周' }],
    compat: { contractVersion: 'harness-contract 1.4', tools: ['git', 'shell', 'file-read'], skills: [] },
    provenance: 'builtin',
    signature: 'ed25519:f2c784…3d19',
    signedBy: 'OpenCoding 内置（内核签名）',
    installed: true,
    sandboxTier: 'L1 只读',
    mainMetric: '发现问题数',
  },
];

/* --- 模板实例（≥10，含定义版本冻结 + 授权快照 + 预算信封） --- */

function buildInstances(r: Rng): TemplateInstance[] {
  const picks: { id: string; scope: string; state: InstanceState; targetRef: string; targetKind: TemplateTarget; hours: number }[] = [
    { id: 'builtin.deps-upgrade', scope: 'payment-core', state: 'ENABLED', targetRef: 'task-template/deps-upgrade', targetKind: 'task_template', hours: 6 },
    { id: 'builtin.pr-triage', scope: 'payment-core / identity-gateway', state: 'ENABLED', targetRef: 'task-template/pr-triage', targetKind: 'task_template', hours: 3 },
    { id: 'builtin.docs-sync', scope: 'web-console', state: 'ENABLED', targetRef: 'plan-template/docs-sync', targetKind: 'plan_template', hours: 12 },
    { id: 'builtin.release-notes', scope: 'payment-core', state: 'ENABLED', targetRef: 'task-template/release-notes', targetKind: 'task_template', hours: 26 },
    { id: 'builtin.incident-postmortem', scope: '全组织', state: 'ENABLED', targetRef: 'session-template/postmortem', targetKind: 'session_template', hours: 40 },
    { id: 'builtin.tech-debt-scan', scope: 'billing-ledger', state: 'PAUSED', targetRef: 'plan-template/tech-debt', targetKind: 'plan_template', hours: 52 },
    { id: 'builtin.test-gap-fill', scope: 'risk-engine', state: 'ENABLED', targetRef: 'task-template/test-gap', targetKind: 'task_template', hours: 20 },
    { id: 'builtin.flaky-hunt', scope: 'search-index', state: 'ENABLED', targetRef: 'plan-template/flaky', targetKind: 'plan_template', hours: 30 },
    { id: 'builtin.license-audit', scope: '全组织', state: 'ENABLED', targetRef: 'task-template/license', targetKind: 'task_template', hours: 96 },
    { id: 'builtin.weekly-digest', scope: '全组织', state: 'ENABLED', targetRef: 'team-run/platform-weekly', targetKind: 'team_run', hours: 120 },
    { id: 'builtin.repo-health', scope: 'mobile-bff', state: 'DISABLED', targetRef: 'task-template/repo-health', targetKind: 'task_template', hours: 150 },
    { id: 'builtin.metrics-weekly', scope: 'data-pipeline', state: 'PAUSED', targetRef: 'task-template/metrics-weekly', targetKind: 'task_template', hours: 72 },
  ];

  return picks.map((p, i) => {
    const t = TEMPLATES.find((x) => x.id === p.id)!;
    const ceiling: PermissionCeiling = t.permissions.ceiling;
    const runCount = r.int(3, 26);
    return {
      id: `inst-${String(i + 1).padStart(2, '0')}`,
      templateId: t.id,
      templateName: t.name,
      definitionVersion: t.version,
      latestVersion: t.version,
      state: p.state,
      inputsBinding: t.inputs.slice(0, 3).map((inp) => ({
        name: inp.name,
        value: String(inp.default),
        source: inp.source,
      })),
      targetBinding: { kind: p.targetKind, ref: p.targetRef, desc: `绑定仓库 ${p.scope}` },
      authorizationSnapshot: {
        grantedBy: r.pick(NAMES),
        at: r.agoHours(p.hours + 6),
        actions: t.permissions.allow,
        ceiling,
        baselineVersion: 'enterprise-baseline@2026.07',
      },
      budgetEnvelope: {
        costUsd: t.budget.costUsd,
        durationMin: t.budget.durationMin,
        toolCalls: t.budget.toolCalls,
        fanout: t.budget.fanout,
        usedCostUsd: r.float(0.6, t.budget.costUsd * 0.82, 2),
        usedToolCalls: r.int(12, Math.round(t.budget.toolCalls * 0.8)),
      },
      createdAt: r.agoHours(p.hours + 48),
      lastRunAt: r.agoHours(r.int(2, 48)),
      runCount,
      successRatio: r.float(0.72, 0.97, 2),
      owner: r.pick(NAMES),
      scope: p.scope,
    };
  });
}

/* --- 运行（≥20，覆盖九态含 DEDUPLICATED / BLOCKED / ESCALATED / FAILED） --- */

interface RunSeed {
  templateId: string;
  status: RunStatus;
  trigger: string;
  ageMin: number;
  failStage?: string;
  blocked?: string;
  dedupOf?: string;
}

const RUN_SEEDS: RunSeed[] = [
  { templateId: 'builtin.deps-upgrade', status: 'SUCCEEDED', trigger: '计划触发 · 每周一 09:00', ageMin: 180 },
  { templateId: 'builtin.pr-triage', status: 'SUCCEEDED', trigger: '事件触发 · pull_request.opened', ageMin: 96 },
  { templateId: 'builtin.pr-triage', status: 'DEDUPLICATED', trigger: '事件触发 · pull_request.updated', ageMin: 92, dedupOf: 'run-0002' },
  { templateId: 'builtin.docs-sync', status: 'RUNNING', trigger: '事件触发 · push@main', ageMin: 12 },
  { templateId: 'builtin.test-gap-fill', status: 'VERIFYING', trigger: '事件触发 · coverage.dropped', ageMin: 34 },
  { templateId: 'builtin.deps-upgrade', status: 'BLOCKED', trigger: '计划触发 · 每周一 09:00', ageMin: 300, blocked: '预授权越界：实例未授予 git.push，步骤 open-pr 被静态门拦截（不消耗预算）' },
  { templateId: 'builtin.flaky-hunt', status: 'FAILED', trigger: '事件触发 · test.run.finished', ageMin: 420, failStage: '步骤 3/5 verify：重跑判定环境不可用，退避重试 3 次耗尽' },
  { templateId: 'builtin.flaky-hunt', status: 'ESCALATED', trigger: '事件触发 · test.run.finished', ageMin: 900, failStage: '修复 PR 连续 2 次复验失败，按阈值熔断' },
  { templateId: 'builtin.tech-debt-scan', status: 'ESCALATED', trigger: '计划触发 · 每周日 02:00', ageMin: 1500, failStage: '扫描连续 4 次超时（大仓分模块续跑仍超限）' },
  { templateId: 'builtin.test-gap-fill', status: 'SUCCEEDED', trigger: '事件触发 · new-function.untested', ageMin: 620 },
  { templateId: 'builtin.docs-sync', status: 'SUCCEEDED', trigger: '计划触发 · 每日 08:30', ageMin: 1080 },
  { templateId: 'builtin.docs-sync', status: 'BLOCKED', trigger: '事件触发 · push@main', ageMin: 1180, blocked: '兼容不符：实例冻结版本 1.2.0 需要 harness-contract ≥1.4，当前运行节点为 1.3' },
  { templateId: 'builtin.release-notes', status: 'SUCCEEDED', trigger: '事件触发 · tag.created v2.9.0', ageMin: 1320 },
  { templateId: 'builtin.incident-postmortem', status: 'SUCCEEDED', trigger: '事件触发 · incident.closed INC-2291', ageMin: 1440 },
  { templateId: 'builtin.repo-health', status: 'QUEUED', trigger: '计划触发 · 每周一 07:00', ageMin: 6 },
  { templateId: 'builtin.license-audit', status: 'QUEUED', trigger: '事件触发 · dependency.changed', ageMin: 3 },
  { templateId: 'builtin.metrics-weekly', status: 'CANCELLED', trigger: '计划触发 · 每周一 08:00', ageMin: 2160 },
  { templateId: 'builtin.pr-triage', status: 'FAILED', trigger: '事件触发 · pull_request.opened', ageMin: 2400, failStage: '步骤 2/4 run：分析服务超时，重试 1 次后仍失败，已降级「未完成分析」' },
  { templateId: 'builtin.weekly-digest', status: 'SUCCEEDED', trigger: '计划触发 · 每周五 17:30', ageMin: 3000 },
  { templateId: 'builtin.deps-upgrade', status: 'SUCCEEDED', trigger: '计划触发 · 每周一 09:00', ageMin: 10080 },
  { templateId: 'builtin.test-gap-fill', status: 'DEDUPLICATED', trigger: '计划触发 · 每周三 03:00', ageMin: 10020, dedupOf: 'run-0010' },
  { templateId: 'builtin.repo-health', status: 'SUCCEEDED', trigger: '计划触发 · 每周一 07:00', ageMin: 10060 },
  { templateId: 'builtin.license-audit', status: 'SUCCEEDED', trigger: '计划触发 · 每月 1 日 06:00', ageMin: 20160 },
  { templateId: 'builtin.flaky-hunt', status: 'SUCCEEDED', trigger: '计划触发 · 每日 07:00', ageMin: 20040 },
];

function statusOfStep(run: RunStatus, idx: number, total: number): RunStep['status'] {
  if (run === 'SUCCEEDED') return 'done';
  if (run === 'FAILED' || run === 'ESCALATED') return idx < total - 1 ? 'done' : 'failed';
  if (run === 'RUNNING') return idx < total - 1 ? 'done' : 'running';
  if (run === 'VERIFYING') return 'done';
  if (run === 'CANCELLED') return idx < total - 1 ? 'done' : 'skipped';
  return 'pending';
}

function buildRuns(r: Rng): TemplateRun[] {
  return RUN_SEEDS.map((seed, i) => {
    const t = TEMPLATES.find((x) => x.id === seed.templateId)!;
    const runId = `run-${String(i + 1).padStart(4, '0')}`;
    const status = seed.status;
    const stepCount = Math.min(t.steps.length, 5);
    const steps: RunStep[] = t.steps.slice(0, stepCount).map((s, idx) => {
      const st = statusOfStep(status, idx, stepCount);
      const ledger: RunLedgerEntry[] = st === 'pending' ? [] : [
        {
          at: r.ago(Math.max(1, seed.ageMin - idx * 3)),
          action: `${s.type} · ${s.desc.slice(0, 22)}`,
          effect: `影响面：${r.pick(['3 个文件', '1 个分支', '1 条评论', '2 个 PR', '0 个文件（只读）'])}`,
          decision: r.weighted(['ALLOW（预授权内）', 'ALLOW（决策链）', 'ASK→ALLOW（人工确认）', 'DENY（静态门拦截）'], [5, 3, 2, 1]),
        },
      ];
      if (st === 'running') {
        ledger.push({ at: r.ago(2), action: '步骤执行中', effect: '已执行 1 个工具调用', decision: 'ALLOW（预授权内）' });
      }
      return {
        name: `${idx + 1}. ${s.type} — ${s.desc}`,
        status: st,
        durationMs: st === 'pending' ? 0 : r.int(1200, 260000),
        ledger,
      };
    });

    const artifacts: RunArtifactRef[] = status === 'SUCCEEDED'
      ? t.outputs.map((o, k) => ({ id: `art-${runId}-${k + 1}`, type: o.type, ref: `${o.type}/${runId}/${o.schema}` }))
      : status === 'VERIFYING'
        ? t.outputs.slice(0, 1).map((o, k) => ({ id: `art-${runId}-${k + 1}`, type: o.type, ref: `${o.type}/${runId}/${o.schema}` }))
        : [];

    const verificationResults: VerificationResult[] = status === 'QUEUED' || status === 'DEDUPLICATED' || status === 'BLOCKED' || status === 'RUNNING'
      ? []
      : t.verification.map((v, k) => ({
        assert: v.assert,
        expected: 'true',
        actual: status === 'SUCCEEDED' || status === 'VERIFYING' ? 'true' : k === 0 ? 'false' : 'true',
        pass: status === 'SUCCEEDED' || status === 'VERIFYING' ? true : k !== 0,
      }));

    const ended = ['SUCCEEDED', 'FAILED', 'ESCALATED', 'CANCELLED', 'BLOCKED', 'DEDUPLICATED'].includes(status);
    const costUsd = status === 'BLOCKED' || status === 'DEDUPLICATED' || status === 'QUEUED'
      ? 0
      : r.float(0.4, t.budget.costUsd * 0.9, 2);

    return {
      runId,
      templateId: t.id,
      templateName: t.name,
      version: t.version,
      triggerSource: seed.trigger,
      idempotencyKey: `idem-${t.id.replace('builtin.', '')}-${r.int(10000, 99999)}`,
      deduplicatedOf: seed.dedupOf,
      dedupWindow: seed.dedupOf ? '去重窗口 30min（hash(templateId, version, targetRef, inputsDigest)）' : undefined,
      status,
      steps,
      artifacts,
      costUsd,
      startedAt: r.ago(seed.ageMin),
      endedAt: ended ? r.ago(Math.max(1, seed.ageMin - r.int(4, 40))) : null,
      verificationResults,
      blockedReason: seed.blocked,
      failureStage: seed.failStage,
      takenAction: seed.failStage
        ? (status === 'ESCALATED'
          ? '已丢弃分支与临时产物，保留报告；熔断已开启并升级人工'
          : '已按失败策略降级/重试；半成品产物未产生')
        : undefined,
      escalation: status === 'ESCALATED'
        ? {
          threshold: '连续失败达阈值（默认 3，可在实例中覆盖）',
          consecutiveFailures: r.int(3, 5),
          escalatedTo: r.pick(NAMES),
          at: r.ago(Math.max(1, seed.ageMin - 30)),
        }
        : undefined,
      cancellable: status === 'RUNNING' || status === 'VERIFYING' || status === 'QUEUED',
      actor: r.pick(NAMES),
    };
  });
}

/* --- 失败接管队列 + backlog --- */

function buildTakeovers(r: Rng, runs: TemplateRun[]): { queue: TakeoverItem[]; backlog: TakeoverBacklog[] } {
  const escalated = runs.filter((x) => x.status === 'ESCALATED');
  const blocked = runs.filter((x) => x.status === 'BLOCKED');
  const fix: Record<string, { fix: string; cmd: string }> = {
    'builtin.flaky-hunt': { fix: '关闭自动修复，仅保留观察清单；在实例中把 autoFix 置为 false', cmd: 'oc automation instance update inst-08 --set autoFix=false' },
    'builtin.tech-debt-scan': { fix: '将扫描拆为两批（按模块续跑）并上调时长上限到 60min', cmd: 'oc automation instance update inst-06 --set durationMin=60 --set modules=两批' },
    'builtin.deps-upgrade': { fix: '为该实例补充 git.push 预授权（或改为只出报告）', cmd: 'oc automation instance grant inst-01 --action git.push' },
    'builtin.docs-sync': { fix: '升级运行节点到 harness-contract 1.4，或把实例冻结版本升级到 1.2.0', cmd: 'oc automation instance upgrade inst-03 --to 1.2.0' },
  };
  const all = [...escalated, ...blocked];
  const queue: TakeoverItem[] = all.map((run, i) => {
    const meta = fix[run.templateId] ?? { fix: '检查实例参数与授权快照后重跑', cmd: `oc automation run resume ${run.runId}` };
    return {
      id: `tko-${String(i + 1).padStart(2, '0')}`,
      runId: run.runId,
      templateName: run.templateName,
      kind: run.status === 'ESCALATED' ? 'ESCALATED' : 'BLOCKED',
      reason: run.blockedReason ?? run.failureStage ?? '未知原因',
      since: run.endedAt ?? run.startedAt,
      attempts: run.escalation?.consecutiveFailures ?? r.int(1, 3),
      suggestedFix: meta.fix,
      oneClickFix: meta.cmd,
      notifyLevel: '需处理',
    };
  });
  const backlog: TakeoverBacklog[] = [
    { week: 'W32', escalatedCount: 2, blockedCount: 2, avgHandleMinutes: 34, oldestMinutes: 900, slaBreach: 0 },
    { week: 'W33', escalatedCount: 1, blockedCount: 3, avgHandleMinutes: 41, oldestMinutes: 1620, slaBreach: 1 },
    { week: 'W34', escalatedCount: 3, blockedCount: 1, avgHandleMinutes: 28, oldestMinutes: 480, slaBreach: 0 },
    { week: 'W35', escalatedCount: 2, blockedCount: 2, avgHandleMinutes: 22, oldestMinutes: 1500, slaBreach: 0 },
  ];
  return { queue, backlog };
}

/* --- 产物（五类 + 幂等更新标记） --- */

function buildArtifacts(r: Rng, runs: TemplateRun[]): AutomationArtifact[] {
  const titles: Record<string, string> = {
    pr: 'chore(deps): bump axios 1.7.2 → 1.7.9（安全补丁）',
    comment: 'PR 巡检发现：3 error / 6 warn（SARIF 附件）',
    report: '技术债巡检报告（top20・含证据引用）',
    notification: '事故复盘草稿已生成：INC-2291',
    file: 'CHANGELOG 条目（v2.9.0 · 双语）',
  };
  const loc: Record<string, string> = {
    pr: 'pr://payment-core/4821',
    comment: 'comment://pr-4815#issuecomment-2291',
    report: 'artifact://automation/run-0009/report.md',
    notification: 'notification://inapp/tko-01',
    file: 'repo://payment-core/CHANGELOG.md#v2.9.0',
  };
  const out: AutomationArtifact[] = [];
  const types: OutputType[] = ['pr', 'comment', 'report', 'notification', 'file'];
  types.forEach((type, ti) => {
    const list = runs.filter((x) => x.artifacts.some((a) => a.type === type));
    const use = list.length ? list : runs.slice(0, 3);
    use.slice(0, 4).forEach((run, k) => {
      out.push({
        id: `art-${ti + 1}${k + 1}`,
        type,
        templateId: run.templateId,
        templateName: run.templateName,
        runId: run.runId,
        title: titles[type],
        location: loc[type],
        schema: `${type}-schema@${r.int(1, 2)}`,
        adopted: k % 3 !== 2,
        adoptRatio: r.float(0.42, 0.92, 2),
        idempotentUpdate: k === 0 ? 'created' : k === 1 ? 'updated' : 'reused',
        at: run.startedAt,
        sizeKb: r.float(1.2, 320, 1),
        freeform: type === 'comment' || type === 'report' || type === 'notification',
      });
    });
  });
  return out;
}

/* --- 度量看板（四指标 + 数据缺口） --- */

function buildMetricsBoard(r: Rng): AutomationMetricsBoard {
  const byTemplate = TEMPLATES.map((t) => ({
    templateId: t.id,
    templateName: t.name,
    runs: r.int(4, 28),
    savedHours: r.float(1.5, 26, 1),
    savedHoursEstimated: t.category === '文档' || t.category === '运维',
    findings: r.int(0, 62),
    adoptRatio: r.float(0.38, 0.93, 2),
    unitCost: r.float(0.12, 3.4, 2),
  }));
  const weeks = ['W29', 'W30', 'W31', 'W32', 'W33', 'W34', 'W35'];
  return {
    kpis: [
      { key: 'saved_hours', label: '节省人力时长', value: 268.5, unit: 'h', format: 'number', delta: 12.4, target: 240, targetKind: 'min', hint: '任务基准时长 × 完成次数；无基准的模板按估算标注' },
      { key: 'findings', label: '发现问题数', value: 612, unit: '项', format: 'number', delta: 8.1, target: 500, targetKind: 'min', hint: '按类型与严重度拆分；含检测类模板的观察项' },
      { key: 'adopt_ratio', label: '产物采纳率', value: 64.8, unit: '%', format: 'percent', delta: 3.2, target: 60, targetKind: 'min', hint: 'PR 合并率 / 报告被引用率' },
      { key: 'unit_cost', label: '单位成本', value: 1.42, unit: 'USD/有效产出', format: 'cost', delta: -6.5, target: 1.8, targetKind: 'max', hint: '成本 ÷ 有效产出；低于目标为好', gap: '「有效产出」口径在 3 个模板中缺基准，暂以采纳产物计数' },
    ],
    byTemplate,
    findingsByType: [
      { name: '规范', value: 214 },
      { name: '安全', value: 96 },
      { name: '测试缺口', value: 132 },
      { name: '文档漂移', value: 74 },
      { name: '依赖/许可证', value: 58 },
      { name: '仓库卫生', value: 38 },
    ],
    findingsBySeverity: [
      { name: 'error', value: 88 },
      { name: 'warn', value: 341 },
      { name: 'info', value: 183 },
    ],
    trend: [
      { name: '节省时长', points: weeks.map((w, i) => ({ x: w, y: Math.round(24 + i * 4.6) })) },
      { name: '发现问题数', points: weeks.map((w, i) => ({ x: w, y: Math.round(62 + i * 7.2 - (i % 3) * 6) })) },
    ],
    dataGaps: [
      '依赖升级的基准人工时长缺 2 个仓库样本，节省时长按中位数估算（已在单元格标注「估算」）。',
      '事故复盘的「准备时间」基线来自 4 次人工记录，样本不足，未纳入主指标。',
      '许可证审计的替代成本未采集，单位成本仅含模型与工具调用成本。',
    ],
  };
}

/* --- 通知路由（三级 → 渠道 + 合并 + 静默） --- */

const NOTIFICATION_ROUTING: NotificationRouting = {
  levels: [
    {
      level: '信息',
      channels: ['应用内', '看板'],
      merge: '同模板 30min 合并为一条（count 累加）',
      quiet: '静默时段折叠为每日摘要',
      examples: ['模板运行成功', '产物已更新（幂等复用同一条评论）'],
    },
    {
      level: '需关注',
      channels: ['应用内', 'IM'],
      merge: '同模板同目标 10min 合并',
      quiet: '静默时段延迟至次日 08:00 投递',
      examples: ['声明与生效权限上限不一致', '预算信封水位 ≥ 80%', '验收断言部分失败但可补偿'],
    },
    {
      level: '需处理',
      channels: ['应用内', 'IM', '邮件', 'Webhook'],
      merge: '不合并（逐条投递，避免淹没）',
      quiet: '不可静默（穿透静默时段，P0 语义）',
      examples: ['运行 ESCALATED 需人工接管', '运行 BLOCKED 需修正参数或授权', '模板尝试自我提权被拒绝（安全事件）'],
    },
  ],
  takeoverRule: '接管请求固定为「需处理」且不可静默：必须携带运行链接、失败步骤、已采取动作与一键修正命令，保证人工能在一处完成处置。',
};

/* --- 审计与授权快照（五项 × 三级） --- */

function buildAuditSnapshot(r: Rng, instances: TemplateInstance[]): AutomationData['auditSnapshot'] {
  const base = [
    { key: 'auth_snapshot', label: '授权快照', content: '授予人 / 授予时间 / 动作清单 / 上限 / 企业基线版本', level: '强制' as const, note: '不可关闭；实例升级需刷新快照' },
    { key: 'template_provenance', label: '模板来源与签名', content: '来源（内置/私仓/市场）+ 签名主体 + 哈希 + 安装人', level: '强制' as const, note: '未签名在市场强制模式下直接拒绝' },
    { key: 'run_actions', label: '运行动作', content: '每步实际工具调用与文件/仓库影响面（含被拒绝动作）', level: '强制' as const, note: '含 DENY 记录，可回放' },
    { key: 'content_egress', label: '内容外发', content: '外发目标通道 + 字段范围（脱敏后摘要）', level: '条件' as const, note: '按组织 DLP 策略启用；默认记录摘要' },
    { key: 'metrics_report', label: '度量上报', content: '上报字段与缺口标记', level: '可关闭' as const, note: '企业可强制关闭遥测（缺口标记仍本地保留）' },
  ];
  return instances.slice(0, 4).map((inst, i) => ({
    items: base.map((b) => ({ ...b })),
    snapshotRef: `snap-${inst.id}-${r.int(1000, 9999)}-${i + 1}`,
  }));
}

/* --- 导出包（剥离凭证/路径/地址 + 跨租户校验） --- */

function buildExportedPackage(r: Rng): ExportedPackage {
  return {
    id: `pkg-${r.int(100000, 999999)}`,
    name: 'automation-package-payment-core-2026W35.tar.zst',
    sizeKb: r.float(420, 1860, 1),
    createdAt: r.agoHours(6),
    fileCount: 48,
    entries: [
      { path: 'manifest.json', kind: '清单（版本/哈希/来源）', hash: 'sha256:9f2c…a71b' },
      { path: 'definitions/deps-upgrade@2.1.0.yaml', kind: '模板定义（含签名）', hash: 'sha256:31ab…5c02' },
      { path: 'definitions/pr-triage@1.4.0.yaml', kind: '模板定义（含签名）', hash: 'sha256:0c93…4410' },
      { path: 'instances/inst-01.json', kind: '实例（参数 + 目标，已剥离凭证）', hash: 'sha256:77d1…9a34' },
      { path: 'metrics/by-template.csv', kind: '度量聚合（含缺口标记）', hash: 'sha256:2a71…08cd' },
      { path: 'audit/snapshot-summary.json', kind: '审计摘要（脱敏）', hash: 'sha256:c40e…b9f1' },
    ],
    stripped: [
      '凭证：所有 apiKey / token / secret 替换为引用名（secret://…），明文不进入包',
      '绝对路径：宿主路径替换为工作区相对路径与占位符 ${WORKSPACE}',
      '内部地址：内网域名/IP 替换为 ${INTERNAL_ENDPOINT}，外发通道地址不导出',
      '个人信息：授予快照中的邮箱替换为成员 ID',
    ],
    tenantCheck: {
      result: 'BLOCKED',
      checks: [
        { item: '凭证剥离', result: 'PASS', detail: '未发现明文凭证（扫描 48 个文件）' },
        { item: '绝对路径剥离', result: 'PASS', detail: '未发现宿主绝对路径' },
        { item: '内部地址剥离', result: 'WARN', detail: '2 处内网域名将被替换为占位符（已在包内替换）' },
        { item: '跨租户引用', result: 'BLOCKED', detail: 'inst-03 的目标绑定指向租户「云枢科技-测试」的仓库，跨租户导入需显式解绑或申请共享' },
      ],
    },
  };
}

/* --- 市场同步（synced / sync.failed + 离线标记） --- */

function buildMarketSync(r: Rng): MarketSync {
  return {
    status: 'sync.failed',
    catalogVersion: 'market-catalog-2026.35.2',
    lastSyncAt: r.agoHours(19),
    nextSyncAt: r.future(300),
    offline: true,
    sources: [
      { name: 'OpenCoding 公共市场', kind: '公共市场', version: '2026.35.2', syncedAt: r.agoHours(19), status: 'sync.failed', note: '签名校验通过但索引下载中断（保留上次目录）' },
      { name: '组织私仓 registry/org-templates', kind: '组织私仓', version: '2026.35.1', syncedAt: r.agoHours(26), status: 'synced', note: '已同步 12 个组织模板（含 3 个覆盖内置的变体）' },
      { name: '本地缓存', kind: '本地缓存', version: '2026.35.2', syncedAt: r.agoHours(19), status: 'offline', note: '离线标记：市场不可用时以缓存与本地包继续可用（功能不静默降级）' },
    ],
    failures: [
      {
        source: 'OpenCoding 公共市场',
        code: 'DEPENDENCY_UNAVAILABLE',
        reason: '索引分片下载在 68% 处超时（网络中断 3 次）',
        recovery: '保留上次目录并标记「离线」；可重试同步或导入离线镜像包',
      },
    ],
  };
}

/* --- 自动化域装配（含 intel / frontier 两个子域，单次 Rng 序列保证确定性） --- */

/** 一次构建的全域数据：自动化 + 智能增强 + 前沿探索（互相以 id 关联） */
export interface AutomationBundle extends AutomationData {
  intel: IntelData;
  frontier: FrontierData;
}

export function buildAutomationData(r: Rng): AutomationBundle {
  const instances = buildInstances(r);
  const runs = buildRuns(r);
  return {
    templates: TEMPLATES,
    categories: (['依赖', '巡检', '文档', '发布', '运维', '质量', '治理'] as TemplateCategory[]).map((name) => ({
      name,
      count: TEMPLATES.filter((t) => t.category === name).length,
    })),
    instances,
    runs,
    takeovers: buildTakeovers(r, runs),
    artifacts: buildArtifacts(r, runs),
    metricsBoard: buildMetricsBoard(r),
    notificationRouting: NOTIFICATION_ROUTING,
    auditSnapshot: buildAuditSnapshot(r, instances),
    exportedPackage: buildExportedPackage(r),
    marketSync: buildMarketSync(r),
    intel: buildIntelData(r),
    frontier: buildFrontierData(r),
  };
}


/** 便捷视图：按 id 取模板 */
export function findTemplate(id: string): AutomationTemplate | undefined {
  return automationData.templates.find((t) => t.id === id);
}

/** 便捷视图：按 id 取运行 */
export function findRun(id: string): TemplateRun | undefined {
  return automationData.runs.find((x) => x.runId === id);
}

/* ============================================================================
 * 二、智能增强包（卷 35）—— 8 项能力 + 三层门禁 + 四类反馈
 * ========================================================================== */

/** 四类能力（生成 / 审查 / 检测 / 汇总） */
export type IntelCategory = '生成' | '审查' | '检测' | '汇总';
/** 触发面四类：命令 / 事件 / 计划 / 会话内联 */
export type IntelTrigger = '命令' | '事件' | '计划' | '会话内联';
/** 草稿产出生命周期（卷 35 §5.2 状态机） */
export type OutputStatus = 'DRAFT' | 'ADOPTED' | 'EDITED' | 'REJECTED' | 'SUPERSEDED' | 'INGESTED';
/** 三层质量门禁 + 条件人工门 */
export type GateLayer = '结构' | '引用' | '安全' | '人工门';
/** Flaky 归因六类 */
export type FlakyAttribution = '时序' | '网络' | '共享状态' | '随机' | '资源竞争' | '顺序依赖';
/** 四类反馈 */
export type FeedbackCategory = '采纳' | '编辑' | '驳回' | '误报';

export interface IntelCapability {
  /** 稳定键（禁止配置化，能力 ID 即契约） */
  id: string;
  name: string;
  /** 等价 CLI 动词 */
  verb: string;
  category: IntelCategory;
  triggers: IntelTrigger[];
  inputContract: string[];
  outputContract: string[];
  toolDeps: string[];
  writeScopes: string[];
  gateProfile: string;
  budget: { runUsd: number; dailyUsd: number };
  enabled: boolean;
  adoptionRatio: number;
  falsePositiveRatio: number;
  timeSavedMinutes: number;
  costPerRun: number;
  model: string;
  promptVersion: string;
  quality: string[];
  failure: string[];
}

export interface IntelRun {
  runId: string;
  capabilityId: string;
  stage: string;
  trigger: IntelTrigger;
  subjectRef: string;
  subjectDigest: string;
  status: 'started' | 'completed' | 'failed';
  costUsd: number;
  budgetUsd: number;
  startedAt: string;
  cancellable: boolean;
  gateResult: string;
  model: string;
  promptVersion: string;
}

export interface IntelCitation {
  ref: string;
  kind: 'file' | 'doc' | 'event' | 'commit';
  loc: string;
}

export interface IntelGateLayerResult {
  layer: GateLayer;
  pass: boolean;
  reason: string;
}

export interface IntelOutput {
  id: string;
  capabilityId: string;
  capabilityName: string;
  title: string;
  subjectRef: string;
  /** 归属标注（C1）：模型 + 提示词版本缺失即被门禁拦截 */
  generator: { model: string; promptVersion: string };
  citationCoverage: number;
  status: OutputStatus;
  content: string[];
  citations: IntelCitation[];
  conflictsWithHuman?: { humanRef: string; humanText: string; aiText: string; note: string };
  costUsd: number;
  createdAt: string;
  gateLayers: IntelGateLayerResult[];
  adoptedBy?: string;
  /** 与人类既有内容冲突时并排展示，不覆盖（C2） */
  humanOwned?: boolean;
}

export interface IntelFinding {
  id: string;
  ruleId: string;
  capabilityId: string;
  location: { file: string; line: number };
  severity: 'error' | 'warn' | 'info';
  confidence: '高' | '中' | '低';
  /** 依据（引用行 + 规则名），模型通道必须给依据 */
  basis: string;
  suggestion: string;
  falsePositive: boolean;
  channel: '规则通道' | '模型通道';
  threadId?: string;
}

export interface ReviewThread {
  id: string;
  prRef: string;
  headSha: string;
  status: 'OPEN' | 'FIXED' | 'REVERIFIED' | 'BLOCKED';
  maxRounds: number;
  rounds: { round: number; kind: '发现' | '修复' | '复验'; summary: string; at: string; result: 'pending' | 'pass' | 'fail' }[];
  blockedReason?: string;
  /** 线程基于旧 HEAD → 必须标记，避免误判 */
  staleOnHead: boolean;
}

export interface FlakyFinding {
  id: string;
  testId: string;
  name: string;
  attribution: FlakyAttribution;
  confidence: '高' | '中' | '低';
  evidence: string[];
  /** 低置信 → 仅进入观察清单（不误改） */
  observation: boolean;
  isolationSuggestion: string;
  fixPr?: string;
}

export interface DocDriftItem {
  id: string;
  doc: string;
  docVersion: string;
  kind: '缺失' | '过时' | '多余';
  detail: string;
  sourceOfTruth: string;
  writePathAllowed: boolean;
  /** 人工校订段落受保护：重生成不覆盖 */
  protectedSegments: { heading: string; editedBy: string; editedAt: string }[];
  conflict?: { aiText: string; humanText: string };
  status: '待处理' | '已提 PR' | '转人工' | '只报告';
}

export interface DigestData {
  id: string;
  kind: 'Standup' | '周报';
  period: string;
  /** 客观事实层：每条必须带事件来源，无来源即门禁失败 */
  objective: { label: string; value: string; source: string }[];
  /** 主观摘要层：必须标注 AI 生成 */
  subjective: { text: string; ai: true; citation: string }[];
  wow: { metric: string; current: number; prev: number; delta: number }[];
  attention: string[];
  dataGaps: string[];
  deliveredTo: string;
  at: string;
}

export interface QaThread {
  id: string;
  question: string;
  askedBy: string;
  at: string;
  answer: string;
  answerKind: '有依据' | '无依据拒答' | '权限不足拒答';
  citations: IntelCitation[];
  refuseReason?: string;
  asContext: boolean;
  missingPermission?: string;
}

export interface MigrationBatch {
  no: number;
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
  files: number;
  verification: string;
  report: string;
}

export interface MigrationPlan {
  id: string;
  title: string;
  spec: { rules: string[]; good: string; bad: string; acceptance: string[] };
  impact: { files: number; modules: string[]; risk: string };
  batchSize: number;
  batches: MigrationBatch[];
  resumePoint: string;
  report: string;
  status: 'RUNNING' | 'PAUSED' | 'DONE';
}

export interface GateBlock {
  id: string;
  capabilityId: string;
  layer: GateLayer;
  reasonCode: string;
  reason: string;
  fix: string;
  at: string;
  outputRef: string;
}

export interface BudgetPanelData {
  runUsd: number;
  dailyUsd: number;
  spentTodayUsd: number;
  spentTotalUsd: number;
  circuit: 'closed' | 'open';
  circuitReason: string;
  tiers: { tier: string; model: string; useFor: string; share: number }[];
  degradeLadder: { step: number; condition: string; behavior: string }[];
}

export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  target: string;
  capabilityId: string;
  at: string;
  by: string;
  ingested: boolean;
  ingestedAs: string;
  /** 两段式降权：先降权 → 人工复核后停用 */
  downweight?: { stage: '已降权' | '待复核' | '已停用'; ruleId: string; hits: number };
}

export interface EvalSnapshot {
  id: string;
  capabilityId: string;
  caseRef: string;
  expectedDigest: string;
  actualDigest: string;
  pass: boolean;
  promptVersion: string;
  regressionOf?: string;
  at: string;
}

export interface IntelData {
  capabilities: IntelCapability[];
  runs: IntelRun[];
  outputs: IntelOutput[];
  findings: IntelFinding[];
  reviewThreads: ReviewThread[];
  flakyFindings: FlakyFinding[];
  docDrift: DocDriftItem[];
  digests: DigestData[];
  qaThreads: QaThread[];
  migrations: MigrationPlan[];
  gateBlocks: GateBlock[];
  budgetPanel: BudgetPanelData;
  feedbackQueue: FeedbackItem[];
  evalSnapshots: EvalSnapshot[];
}

const INLINE = '会话内联';

function buildIntelRuns(r: Rng): IntelRun[] {
  const seeds: { id: string; status: IntelRun['status']; stage: string; trigger: IntelTrigger; subject: string }[] = [
    { id: 'pr.description', status: 'started', stage: '生成中 · 第 2/3 段（影响面）', trigger: '事件', subject: 'diff:payment-core@4821' },
    { id: 'review.bot', status: 'started', stage: '三层门禁 · 引用校验（已 68%）', trigger: '事件', subject: 'pr://payment-core/4815' },
    { id: 'test.gen', status: 'completed', stage: '完成 · 提交测试 PR #4830', trigger: '事件', subject: 'coverage-gap:risk-engine' },
    { id: 'code.migrate', status: 'started', stage: '批次 3/6 校验中（可取消，已完成批次保留）', trigger: '命令', subject: 'plan:migrate-h2-to-jdbc' },
    { id: 'doc.drift', status: 'completed', stage: '完成 · 差异 7 项，已提修订 PR', trigger: '计划', subject: 'docs-scan:2026-08-31' },
    { id: 'digest.standup', status: 'completed', stage: '完成 · 已投递 IM + 邮件', trigger: '计划', subject: 'window:2026-W35' },
    { id: 'repo.qa', status: 'completed', stage: '完成 · 3 条引用，无拒答', trigger: INLINE, subject: 'q:审批链实现在哪' },
    { id: 'flaky.detect', status: 'failed', stage: '失败 · 重跑环境不可用（已退化为统计法并降置信）', trigger: '事件', subject: 'suite:order-suite' },
    { id: 'review.bot', status: 'completed', stage: '完成 · 14 项发现（3 error）', trigger: '事件', subject: 'pr://identity-gateway/2210' },
    { id: 'pr.description', status: 'completed', stage: '完成 · 引用覆盖率 94%', trigger: '命令', subject: 'diff:billing-ledger@9107' },
    { id: 'code.migrate', status: 'failed', stage: '失败 · 批次 2 验收命令不通过，已回滚该批', trigger: '命令', subject: 'plan:migrate-axios-to-fetch' },
    { id: 'repo.qa', status: 'failed', stage: '失败 · 检索服务不可用（明确拒答并给检索范围）', trigger: '命令', subject: 'q:计费口径在哪定义' },
  ];
  return seeds.map((s, i) => {
    const cap = CAPABILITIES.find((c) => c.id === s.id)!;
    return {
      runId: `airun-${String(i + 1).padStart(3, '0')}`,
      capabilityId: cap.id,
      stage: s.stage,
      trigger: s.trigger,
      subjectRef: s.subject,
      subjectDigest: `sha256:${r.int(10000000, 99999999)}`,
      status: s.status,
      costUsd: s.status === 'failed' ? r.float(0.05, cap.budget.runUsd * 0.6, 2) : r.float(0.08, cap.budget.runUsd, 2),
      budgetUsd: cap.budget.runUsd,
      startedAt: r.ago(r.int(1, 2880)),
      cancellable: s.status === 'started',
      gateResult: s.status === 'failed' ? '未执行（前置失败）' : '结构 PASS · 引用 PASS · 安全 PASS',
      model: cap.model,
      promptVersion: cap.promptVersion,
    };
  });
}

function buildIntelOutputs(r: Rng): IntelOutput[] {
  const six = [
    '摘要：为依赖升级模板补回滚路径，避免升级失败阻塞发布。',
    '动机：v2.9 发布前 3 次构建失败均因依赖不兼容，人工定位平均 40 分钟。',
    '影响面：src/deps/resolver.ts、scripts/upgrade.mjs；不涉及公开 API。',
    '验证方式：pnpm test（1468 通过）、pnpm build（成功）、模板干跑断言全通过。',
    '风险与回滚：风险中；回滚为 revert 本次提交（无数据迁移）。',
    '未覆盖项：Windows 平台下的路径大小写差异未验证（标注待补）。',
  ];
  const base: { cap: string; title: string; status: OutputStatus; cov: number; conflict?: boolean }[] = [
    { cap: 'pr.description', title: 'PR #4821 描述 + 变更日志条目', status: 'ADOPTED', cov: 0.94 },
    { cap: 'pr.description', title: 'PR #4816 描述（依赖升级）', status: 'EDITED', cov: 0.91 },
    { cap: 'pr.description', title: 'PR #4809 描述（未覆盖项高亮）', status: 'ADOPTED', cov: 0.88 },
    { cap: 'review.bot', title: 'PR #4815 审查发现汇总（SARIF）', status: 'DRAFT', cov: 0.96 },
    { cap: 'review.bot', title: 'PR #2210 审查发现（identity-gateway）', status: 'ADOPTED', cov: 0.93 },
    { cap: 'review.bot', title: 'PR #4802 审查发现（低置信已折叠）', status: 'REJECTED', cov: 0.72 },
    { cap: 'test.gen', title: '测试 PR #4830（单元 12 / 集成 3 / 属性 2）', status: 'DRAFT', cov: 0.85 },
    { cap: 'test.gen', title: '覆盖率补强草稿（risk-engine）', status: 'SUPERSEDED', cov: 0.8 },
    { cap: 'flaky.detect', title: 'Flaky 归因报告（order-suite）', status: 'ADOPTED', cov: 0.9 },
    { cap: 'flaky.detect', title: '观察清单条目（低置信 4 项）', status: 'DRAFT', cov: 0.66 },
    { cap: 'doc.drift', title: '文档修订 PR #142（docs/api/**）', status: 'DRAFT', cov: 0.89 },
    { cap: 'doc.drift', title: '文档漂移报告（7 项差异）', status: 'EDITED', cov: 0.92, conflict: true },
    { cap: 'digest.standup', title: 'Standup 汇总（2026-08-31）', status: 'ADOPTED', cov: 0.87 },
    { cap: 'digest.standup', title: '周报（W35 · 含自动化收益）', status: 'DRAFT', cov: 0.84 },
    { cap: 'repo.qa', title: '问答：审批链在哪个包实现', status: 'ADOPTED', cov: 1 },
    { cap: 'repo.qa', title: '问答：计费口径定义（无依据拒答）', status: 'REJECTED', cov: 0 },
    { cap: 'code.migrate', title: '迁移报告（批次 1–2 完成）', status: 'INGESTED', cov: 0.9 },
    { cap: 'code.migrate', title: '迁移规格草稿（axios → fetch）', status: 'SUPERSEDED', cov: 0.77 },
  ];
  return base.map((b, i) => {
    const cap = CAPABILITIES.find((c) => c.id === b.cap)!;
    return {
      id: `out-${String(i + 1).padStart(3, '0')}`,
      capabilityId: cap.id,
      capabilityName: cap.name,
      title: b.title,
      subjectRef: `subject-${r.int(1000, 9999)}`,
      generator: { model: cap.model, promptVersion: cap.promptVersion },
      citationCoverage: b.cov,
      status: b.status,
      content: cap.id === 'pr.description' ? six : cap.outputContract.slice(0, 4),
      citations: cap.id === 'repo.qa' && b.cov === 0
        ? []
        : [
          { ref: `${r.pick(REPOS)}/src/${r.pick(['deps/resolver.ts', 'approval/chain.ts', 'api/routes.ts', 'billing/ledger.ts'])}`, kind: 'file', loc: `L${r.int(12, 420)}-L${r.int(430, 700)}` },
          { ref: cap.id === 'digest.standup' ? 'event://task.state.changed#128432' : 'doc://harness/34-automation-templates.md', kind: cap.id === 'digest.standup' ? 'event' : 'doc', loc: '§5.6' },
        ],
      conflictsWithHuman: b.conflict
        ? {
          humanRef: 'docs/api/upgrade.md（人工校订段落：注意事项）',
          humanText: '注意：证书校验失败时不要跳过 TLS 校验，须先更新根证书。',
          aiText: '注意：证书校验失败可临时跳过 TLS 校验以完成升级。',
          note: 'AI 与人工内容冲突：人工修订受保护，AI 版本不得覆盖；此处并排展示待人工裁决。',
        }
        : undefined,
      costUsd: r.float(0.08, cap.budget.runUsd, 2),
      createdAt: r.ago(r.int(20, 5760)),
      gateLayers: [
        { layer: '结构', pass: true, reason: '输出符合 schema（字段齐全）' },
        { layer: '引用', pass: b.cov > 0, reason: b.cov > 0 ? `引用覆盖率 ${(b.cov * 100).toFixed(0)}%` : '无引用 → 拦截（不得输出无依据结论）' },
        { layer: '安全', pass: true, reason: '未发现密钥/危险 API/越权写路径' },
      ],
      adoptedBy: b.status === 'ADOPTED' || b.status === 'EDITED' ? r.pick(NAMES) : undefined,
      humanOwned: b.conflict,
    };
  });
}

function buildIntelFindings(r: Rng): IntelFinding[] {
  const items: Omit<IntelFinding, 'id'>[] = [
    { ruleId: 'rule/oc-sec/secret-in-diff', capabilityId: 'review.bot', location: { file: 'src/config/endpoint.ts', line: 42 }, severity: 'error', confidence: '高', basis: '命中规则「明文密钥」；引用行 L42 出现 sk- 前缀字面量', suggestion: '改为引用式凭证（secret://…）并轮换该密钥', falsePositive: false, channel: '规则通道' },
    { ruleId: 'rule/oc-lint/unhandled-promise', capabilityId: 'review.bot', location: { file: 'src/deps/resolver.ts', line: 118 }, severity: 'error', confidence: '高', basis: '规则「未处理 Promise 拒绝」+ 引用行 L118', suggestion: '补 .catch 或改用 await + try', falsePositive: false, channel: '规则通道' },
    { ruleId: 'rule/oc-test/missing-negative-case', capabilityId: 'review.bot', location: { file: 'tests/deps/resolver.spec.ts', line: 7 }, severity: 'warn', confidence: '中', basis: '模型通道：新增分支无失败路径用例（引用 L7-L40）', suggestion: '补一条网络失败时的降级用例', falsePositive: false, channel: '模型通道' },
    { ruleId: 'rule/oc-style/naming', capabilityId: 'review.bot', location: { file: 'src/api/routes.ts', line: 210 }, severity: 'info', confidence: '中', basis: '命名与仓库约定不一致（引用 AGENTS.md §命名）', suggestion: '改为 fetchUpgradePlan', falsePositive: false, channel: '模型通道' },
    { ruleId: 'rule/oc-sec/dangerous-api', capabilityId: 'review.bot', location: { file: 'scripts/upgrade.mjs', line: 63 }, severity: 'warn', confidence: '低', basis: '可疑 eval 用法（引用 L63），上下文未确认', suggestion: '人工确认是否可替换为显式解析', falsePositive: false, channel: '模型通道' },
    { ruleId: 'rule/oc-lint/todo-age', capabilityId: 'tech-debt', location: { file: 'src/billing/ledger.ts', line: 331 }, severity: 'info', confidence: '高', basis: 'TODO 已存在 214 天（引用 L331 + 提交时间）', suggestion: '转任务或清理', falsePositive: false, channel: '规则通道' },
    { ruleId: 'rule/oc-doc/param-drift', capabilityId: 'doc.drift', location: { file: 'docs/api/upgrade.md', line: 88 }, severity: 'warn', confidence: '高', basis: '代码侧参数 strictMode 未在文档声明（引用 L88）', suggestion: '补文档或移除参数', falsePositive: false, channel: '规则通道' },
    { ruleId: 'rule/oc-doc/env-missing', capabilityId: 'doc.drift', location: { file: 'docs/setup/env.md', line: 12 }, severity: 'info', confidence: '中', basis: '环境变量 OC_TIMEOUT_MS 缺失文档（引用 .env.example L12）', suggestion: '补入环境变量清单', falsePositive: false, channel: '规则通道' },
    { ruleId: 'rule/oc-flaky/order-dependency', capabilityId: 'flaky.detect', location: { file: 'tests/order-suite.spec.ts', line: 54 }, severity: 'warn', confidence: '高', basis: '隔离运行后稳定 + 顺序变更即失败（三法交叉）', suggestion: '用例间共享状态改为每例初始化', falsePositive: false, channel: '模型通道' },
    { ruleId: 'rule/oc-flaky/timing', capabilityId: 'flaky.detect', location: { file: 'tests/ci/gate.spec.ts', line: 33 }, severity: 'info', confidence: '低', basis: '跨运行方差超阈值但重跑一致（证据不足）', suggestion: '进入观察清单，暂不修改', falsePositive: false, channel: '模型通道' },
    { ruleId: 'rule/oc-license/copyleft', capabilityId: 'license', location: { file: 'package.json', line: 96 }, severity: 'error', confidence: '高', basis: 'license 字段为 GPL-3.0（命中组织白名单禁入项）', suggestion: '替换为 MIT 等价库或申请例外', falsePositive: false, channel: '规则通道' },
    { ruleId: 'rule/oc-style/line-length', capabilityId: 'review.bot', location: { file: 'src/api/routes.ts', line: 61 }, severity: 'info', confidence: '低', basis: '模型通道误判（该行在忽略清单内）', suggestion: '无需处理（已标记误报）', falsePositive: true, channel: '模型通道' },
    { ruleId: 'rule/oc-sec/hardcoded-host', capabilityId: 'review.bot', location: { file: 'src/config/gateway.ts', line: 19 }, severity: 'warn', confidence: '中', basis: '硬编码内网域名（引用 L19）', suggestion: '抽为配置项并由环境变量注入', falsePositive: false, channel: '规则通道' },
    { ruleId: 'rule/oc-test/hollow-assert', capabilityId: 'test.gen', location: { file: 'tests/new/resolver.gen.spec.ts', line: 14 }, severity: 'error', confidence: '高', basis: '假测试检测：断言恒真（expect(true).toBe(true)）', suggestion: '拒收该用例并重新生成', falsePositive: false, channel: '规则通道' },
  ];
  return items.map((it, i) => ({ ...it, id: `find-${String(i + 1).padStart(3, '0')}`, threadId: i < 3 ? 'thread-01' : i === 8 ? 'thread-02' : undefined })) as IntelFinding[];
}

function buildReviewThreads(r: Rng): ReviewThread[] {
  return [
    {
      id: 'thread-01',
      prRef: 'pr://payment-core/4815',
      headSha: 'a91f0c2',
      status: 'REVERIFIED',
      maxRounds: 6,
      rounds: [
        { round: 1, kind: '发现', summary: '3 error / 6 warn（含明文密钥与未处理 Promise）', at: r.agoHours(20), result: 'pass' },
        { round: 2, kind: '修复', summary: '人工点「请修复」：改为引用式凭证 + 补 catch', at: r.agoHours(18), result: 'pass' },
        { round: 3, kind: '复验', summary: '复验同一发现：secret-in-diff 已消除，unhandled-promise 已消除', at: r.agoHours(17), result: 'pass' },
        { round: 4, kind: '发现', summary: '新增 warn：降级分支缺少用例', at: r.agoHours(16), result: 'pass' },
      ],
      staleOnHead: false,
    },
    {
      id: 'thread-02',
      prRef: 'pr://search-index/3320',
      headSha: '77be104',
      status: 'BLOCKED',
      maxRounds: 6,
      rounds: [
        { round: 1, kind: '发现', summary: 'order-dependency 归因（高置信）', at: r.agoHours(9), result: 'pass' },
        { round: 2, kind: '修复', summary: '自动修复：每例初始化共享状态', at: r.agoHours(8), result: 'fail' },
        { round: 3, kind: '复验', summary: '复验失败：用例仍不稳定（同一提交重跑不一致）', at: r.agoHours(7), result: 'fail' },
        { round: 4, kind: '修复', summary: '第二次修复尝试（超时等待改为轮询）', at: r.agoHours(6), result: 'fail' },
      ],
      blockedReason: '修复后复验连续失败，已回滚该修复并标记线程 BLOCKED，交人工处理（不再自动重试）。',
      staleOnHead: true,
    },
    {
      id: 'thread-03',
      prRef: 'pr://identity-gateway/2210',
      headSha: '0c4d881',
      status: 'FIXED',
      maxRounds: 6,
      rounds: [
        { round: 1, kind: '发现', summary: '2 warn（硬编码内网域名、命名不一致）', at: r.agoDays(2), result: 'pass' },
        { round: 2, kind: '修复', summary: '人工点「请修复」：抽配置项 + 改名', at: r.agoDays(2), result: 'pass' },
      ],
      staleOnHead: false,
    },
    {
      id: 'thread-04',
      prRef: 'pr://web-console/1188',
      headSha: 'f1029aa',
      status: 'OPEN',
      maxRounds: 6,
      rounds: [
        { round: 1, kind: '发现', summary: '5 info（含 1 条误报）', at: r.agoHours(3), result: 'pass' },
        { round: 2, kind: '发现', summary: '等待作者回应；已到第 2/6 轮（上限 6）', at: r.agoHours(1), result: 'pending' },
      ],
      staleOnHead: false,
    },
  ];
}

function buildFlakyFindings(r: Rng): FlakyFinding[] {
  const seeds: { name: string; attr: FlakyAttribution; conf: '高' | '中' | '低'; obs: boolean; ev: string[] }[] = [
    { name: 'order-suite › 并发下单应保证幂等', attr: '共享状态', conf: '高', obs: false, ev: ['同提交重跑 3 次：2 失败 1 通过', '隔离运行 5 次全通过', '用例间共享同一 DB 连接（L54）'] },
    { name: 'ci-gate › 构建超时控制', attr: '时序', conf: '中', obs: false, ev: ['跨运行方差 3.2×（阈值 2.0）', '失败集中在 CI 高负载时段'] },
    { name: 'search › 索引一致性（分片）', attr: '资源竞争', conf: '高', obs: false, ev: ['隔离运行后稳定', '与并行用例争用同一临时目录'] },
    { name: 'billing › 重试退避窗口', attr: '随机', conf: '中', obs: false, ev: ['随机种子未固定（faker.seed 缺失）', '重跑 3 次中 1 次失败'] },
    { name: 'gateway › 外部端点探活', attr: '网络', conf: '低', obs: true, ev: ['失败签名指向测试端点抖动', '重跑环境不可用，仅统计法证据'] },
    { name: 'pipeline › 步骤顺序依赖', attr: '顺序依赖', conf: '低', obs: true, ev: ['仅 1 次失败，无重跑证据（单次失败不得标记 flaky）'] },
  ];
  return seeds.map((s, i) => ({
    id: `flk-${String(i + 1).padStart(2, '0')}`,
    testId: `spec-${r.int(1000, 9999)}`,
    name: s.name,
    attribution: s.attr,
    confidence: s.conf,
    evidence: s.ev,
    observation: s.obs,
    isolationSuggestion: s.obs ? '维持现状 + 观察 2 周（证据不足，不自动修改）' : `在隔离套件中先跑该用例，并在 CI 中标记 ${s.attr} 归因标签`,
    fixPr: s.obs ? undefined : `pr://${r.pick(REPOS)}/${r.int(4000, 4900)}`,
  }));
}

function buildDocDrift(r: Rng): DocDriftItem[] {
  return [
    {
      id: 'drift-01',
      doc: 'docs/api/upgrade.md',
      docVersion: 'v12（2026-08-11）',
      kind: '过时',
      detail: '代码侧新增参数 strictMode（默认 true），文档未声明；示例命令缺少该参数。',
      sourceOfTruth: 'src/deps/resolver.ts L118（结构化提取）',
      writePathAllowed: true,
      protectedSegments: [{ heading: '注意事项（人工校订）', editedBy: r.pick(NAMES), editedAt: r.agoDays(9) }],
      conflict: { aiText: 'strictMode 默认为 false，可关闭校验以提速。', humanText: 'strictMode 默认为 true；不允许在生产关闭校验。' },
      status: '转人工',
    },
    {
      id: 'drift-02',
      doc: 'docs/setup/env.md',
      docVersion: 'v7（2026-07-02）',
      kind: '缺失',
      detail: '环境变量 OC_TIMEOUT_MS / INTEL_DAILY_BUDGET_USD 未记录。',
      sourceOfTruth: '.env.example（模板为唯一变量清单）',
      writePathAllowed: true,
      protectedSegments: [],
      status: '已提 PR',
    },
    {
      id: 'drift-03',
      doc: 'docs/automation/templates.md',
      docVersion: 'v3（2026-06-20）',
      kind: '缺失',
      detail: '12 个内置模板族的权限上限与预算表未同步（卷 34 §5.6）。',
      sourceOfTruth: '卷 34 §5.6 + 模板定义签名包',
      writePathAllowed: true,
      protectedSegments: [{ heading: '自定义模板规范（人工校订）', editedBy: r.pick(NAMES), editedAt: r.agoDays(21) }],
      status: '待处理',
    },
    {
      id: 'drift-04',
      doc: 'docs/cli/reference.md',
      docVersion: 'v19（2026-08-25）',
      kind: '多余',
      detail: '记录了已移除的命令 `oc automation template pin`（v2.0 起改为实例冻结版本）。',
      sourceOfTruth: 'CLI 契约（命令清单）',
      writePathAllowed: true,
      protectedSegments: [],
      status: '已提 PR',
    },
    {
      id: 'drift-05',
      doc: 'docs/kb/approval-chain.md',
      docVersion: 'v4（2026-05-14）',
      kind: '过时',
      detail: '审批链层级描述与卷 06 现状不一致（新增「插件级」层级）。',
      sourceOfTruth: '卷 06 §层级树',
      writePathAllowed: false,
      protectedSegments: [{ heading: '本组织例外说明（人工校订）', editedBy: r.pick(NAMES), editedAt: r.agoDays(30) }],
      status: '只报告',
    },
    {
      id: 'drift-06',
      doc: 'docs/onboarding/first-run.md',
      docVersion: 'v2（2026-04-30）',
      kind: '多余',
      detail: '仍描述旧的 7 步向导，实际为 S1–S5 五步（卷 29 §4.6）。',
      sourceOfTruth: '卷 29 §4.6',
      writePathAllowed: true,
      protectedSegments: [],
      status: '待处理',
    },
  ];
}

function buildDigests(r: Rng): DigestData[] {
  return [
    {
      id: 'dig-01',
      kind: 'Standup',
      period: '2026-08-31（周一）',
      objective: [
        { label: '完成任务', value: '7 个（其中 2 个阻塞解除）', source: 'event://workitem.state.changed#128410' },
        { label: '提交 / PR', value: '23 次提交 · 6 个 PR（4 已合并）', source: 'event://git.commit#4412' },
        { label: '审查活动', value: '发现 14 项（3 error 已修复）', source: 'event://ai.run.completed#airun-009' },
        { label: '自动化收益', value: '节省 11.5h（依赖升级 4h、Flaky 归因 3.5h、文档同步 4h）', source: 'event://automation.value.measured#W35' },
      ],
      subjective: [
        { text: '整体节奏平稳；风险集中在 risk-engine 的覆盖率缺口，建议本周优先补测。', ai: true, citation: '由 7 条客观事实归纳（模型 gpt-5.1-mini · prompt digest@v8）' },
        { text: '两个阻塞项均与测试环境凭证有关，建议统一改为引用式凭证。', ai: true, citation: '引用 event://workitem.blocked#128388' },
      ],
      wow: [
        { metric: '完成任务', current: 7, prev: 5, delta: 40 },
        { metric: 'PR 合并', current: 4, prev: 6, delta: -33.3 },
        { metric: '自动化节省时长', current: 11.5, prev: 8.2, delta: 40.2 },
      ],
      attention: ['risk-engine 覆盖率 71%（目标 80%），已触发测试补齐模板', 'PR #4802 审查发现被驳回 2 项，规则权重已进入两段式降权流程'],
      dataGaps: ['事故与告警数据源本周未接入（incident 事件未采集），事故相关事实缺失', '团队 A 的任务状态事件延迟 42 分钟，可能影响「完成任务」计数'],
      deliveredTo: 'IM（#dev-standup）+ 邮件（每日 09:30）',
      at: r.agoHours(14),
    },
    {
      id: 'dig-02',
      kind: '周报',
      period: '2026-W35（08-24 ~ 08-30）',
      objective: [
        { label: '模板运行', value: '46 次（成功 38 / 失败 3 / 接管 5）', source: 'event://automation.run.completed#W35' },
        { label: '产物', value: 'PR 9 · 评论 12 · 报告 14 · 通知 6', source: 'event://automation.artifact.created#W35' },
        { label: '成本', value: '$61.42（预算 $90，水位 68%）', source: 'metrics://cost/automation?window=W35' },
      ],
      subjective: [
        { text: '依赖升级的 PR 采纳率 78%，明显高于上月（61%），建议推广到其余 2 个仓库。', ai: true, citation: '引用 metrics://automation/artifact-adopt?template=deps-upgrade' },
      ],
      wow: [
        { metric: '节省时长', current: 62.5, prev: 54.1, delta: 15.5 },
        { metric: '发现问题数', current: 148, prev: 122, delta: 21.3 },
      ],
      attention: ['接管 backlog 4 项（1 项超 SLA 27 小时）', '许可证审计报出 1 项 GPL-3.0 依赖，需在下个发布前处置'],
      dataGaps: ['「产物被引用率」缺 3 个模板的采集口径，周报中该指标仅覆盖 9/12 模板'],
      deliveredTo: 'IM（#platform-weekly）+ 邮件 + 看板卡片',
      at: r.agoHours(60),
    },
  ];
}

function buildQaThreads(r: Rng): QaThread[] {
  return [
    {
      id: 'qa-01',
      question: '审批链的决策顺序在哪里实现？',
      askedBy: r.pick(NAMES),
      at: r.agoHours(3),
      answer: '决策链按「组织 → 租户 → 项目 → 工作区 → 会话 → 用户」六级求值，拒绝优先；实现在 kernel-permission 的 decision-chain 包，入口为 DecisionChain#evaluate。',
      answerKind: '有依据',
      citations: [
        { ref: 'payment-core/src/permission/decision-chain.ts', kind: 'file', loc: 'L42-L118' },
        { ref: 'doc://harness/06-permission-system.md', kind: 'doc', loc: '§4.2 六级求值' },
      ],
      asContext: true,
    },
    {
      id: 'qa-02',
      question: '为什么自动化模板不能 push --force？',
      askedBy: r.pick(NAMES),
      at: r.agoHours(6),
      answer: '上限清单（不可请求）显式包含 force-push：模板只能在实例化时授予的权限集内行动，且动作仍需决策链裁决；声明与实际上限不符会在装载期被拒绝。',
      answerKind: '有依据',
      citations: [
        { ref: 'doc://harness/34-automation-templates.md', kind: 'doc', loc: '§5.7 权限与安全约束' },
        { ref: 'commit://9f2c4a1', kind: 'commit', loc: 'feat(automation): add permission ceiling' },
      ],
      asContext: false,
    },
    {
      id: 'qa-03',
      question: '我们的计费口径是「按 token 还是按席位」？',
      askedBy: r.pick(NAMES),
      at: r.agoHours(9),
      answer: '未找到依据：仓库与文档中检索到 3 处提及计费，但均为占位描述或指向外部文档，无法确认口径。检索范围：当前仓库（含 docs/）、项目知识库、近 30 天会话；建议在「企业治理 → 配额与计量计费」中确认。',
      answerKind: '无依据拒答',
      citations: [],
      refuseReason: '检索范围内不存在可引用依据 → 明确拒答，不编造口径（强制引用门禁）。',
      asContext: false,
    },
    {
      id: 'qa-04',
      question: '云枢科技-测试 租户的模板实例有哪些？',
      askedBy: r.pick(NAMES),
      at: r.agoHours(11),
      answer: '无法回答：你当前缺少跨租户读取权限（需要 automation.manage@tenant 或该租户的共享授权）。已记录本次访问到安全审计；公共知识不降级返回。',
      answerKind: '权限不足拒答',
      citations: [],
      refuseReason: '权限校验失败：跨租户资源；不静默降级为公共知识（卷 35 §5.6）。',
      asContext: false,
      missingPermission: 'automation.manage@tenant',
    },
    {
      id: 'qa-05',
      question: '文档漂移检测会不会覆盖我们手工改过的段落？',
      askedBy: r.pick(NAMES),
      at: r.agoHours(20),
      answer: '不会：人工已校订段落标记为受保护（protectedSegments），重生成不覆盖，冲突以并排方式展示待人工裁决。',
      answerKind: '有依据',
      citations: [
        { ref: 'docs/api/upgrade.md', kind: 'doc', loc: '注意事项（人工校订）' },
        { ref: 'doc://harness/35-intelligent-augmentation.md', kind: 'doc', loc: '§5.3 ⑤ 质量判据' },
      ],
      asContext: true,
    },
  ];
}

function buildMigrations(r: Rng): MigrationPlan[] {
  return [
    {
      id: 'mig-01',
      title: 'H2 测试夹具迁移到 Testcontainers',
      spec: {
        rules: ['替换 @DataJpaTest 的内存库配置为 Testcontainers', '保留既有断言不变', '连接参数抽为常量'],
        good: 'tests/fixtures/OrderRepositoryIT.java（每批 1 个夹具，独立分支）',
        bad: 'tests/legacy/H2SmokeTest.java（不改：遗留用例显式豁免）',
        acceptance: ['./gradlew test --tests "*IT" 全部通过', 'git diff 不含生产代码'],
      },
      impact: { files: 128, modules: ['payment-core', 'risk-engine', 'billing-ledger'], risk: '中（测试基础设施，不影响运行时行为）' },
      batchSize: 50,
      batches: [
        { no: 1, status: 'SUCCEEDED', files: 50, verification: '验收命令通过（IT 214 通过 / 0 失败）', report: 'report://mig-01/batch-1' },
        { no: 2, status: 'SUCCEEDED', files: 50, verification: '验收命令通过（IT 198 通过 / 0 失败）', report: 'report://mig-01/batch-2' },
        { no: 3, status: 'FAILED', files: 28, verification: '验收失败：3 个用例断言超时（连接池配置未迁移）', report: 'report://mig-01/batch-3-diagnosis' },
        { no: 4, status: 'PENDING', files: 0, verification: '—', report: '—' },
      ],
      resumePoint: '续跑点：批次 3（已回滚该批并重建分支；批次 1–2 不受影响）',
      report: '迁移报告：自动迁移比例 78%（100/128 文件），人工干预点 3 处（连接池配置、遗留豁免、断言超时）',
      status: 'PAUSED',
    },
    {
      id: 'mig-02',
      title: 'axios 调用迁移到原生 fetch',
      spec: {
        rules: ['axios.get/post 置换为 fetch + 统一错误包装', '保持返回结构不变', '超时改为 AbortSignal.timeout'],
        good: 'src/api/client.ts（先迁移封装层，再迁移调用点）',
        bad: 'src/legacy/uploader.ts（暂不改：依赖 axios 进度事件）',
        acceptance: ['pnpm test 通过', 'e2e 冒烟通过', '不新增运行时依赖'],
      },
      impact: { files: 64, modules: ['web-console', 'mobile-bff'], risk: '中' },
      batchSize: 20,
      batches: [
        { no: 1, status: 'SUCCEEDED', files: 20, verification: '验收通过（单测 512 通过）', report: 'report://mig-02/batch-1' },
        { no: 2, status: 'FAILED', files: 6, verification: '验收失败：2 个 e2e 因重定向处理差异失败', report: 'report://mig-02/batch-2-diagnosis' },
      ],
      resumePoint: '已停止后续批次；规格歧义待澄清（重定向是否手工跟随），续跑从批次 2 重建分支',
      report: '迁移报告：自动迁移比例 31%（20/64），人工干预点 2 处',
      status: 'PAUSED',
    },
  ];
}

function buildGateBlocks(r: Rng): GateBlock[] {
  const seeds: { cap: string; layer: GateLayer; code: string; reason: string; fix: string }[] = [
    { cap: 'pr.description', layer: '引用', code: 'CITATION_COVERAGE_LOW', reason: '引用覆盖率 72%（阈值 90%）：3 条摘要无文件或提交引用', fix: '补充引用或删除无依据条目（不得输出无引用结论）' },
    { cap: 'review.bot', layer: '安全', code: 'SECRET_IN_OUTPUT', reason: '输出中发现疑似密钥（sk- 前缀）——安全扫描拦截', fix: '改为引用式凭证；轮换该密钥后重跑' },
    { cap: 'test.gen', layer: '结构', code: 'SCHEMA_MISSING_FIELD', reason: 'generator 字段缺失（无「AI 生成 + 模型 + 提示词版本」标注）', fix: '补齐归属标注后重新生成；缺失即被门禁拦截（C1）' },
    { cap: 'doc.drift', layer: '安全', code: 'WRITE_PATH_VIOLATION', reason: '修订 PR 触及 docs 之外的路径（src/config/gateway.ts）', fix: '收敛到白名单路径或申请扩展写范围（默认整体拒绝）' },
    { cap: 'code.migrate', layer: '人工门', code: 'HIGH_RISK_WRITE', reason: '批次触及公开 API 签名（高风险写入）→ 需人工确认', fix: '在审批中心确认后放行，或改规格排除该模块' },
    { cap: 'digest.standup', layer: '引用', code: 'OBJECTIVE_MISSING_SOURCE', reason: '客观层 1 个字段无事件来源（「完成任务 7 个」缺 eventRef）', fix: '补事件来源或移入「数据缺口」清单（客观层无来源即失败）' },
    { cap: 'repo.qa', layer: '引用', code: 'CITATION_UNREACHABLE', reason: '引用 2 指向的文档版本已被取代（v3 → v5）', fix: '更新引用到最新版本；标注并降置信' },
    { cap: 'flaky.detect', layer: '人工门', code: 'LOW_CONFIDENCE_AUTOFIX', reason: '低置信结论请求自动修复（策略禁止）', fix: '转入观察清单，人工确认后再开启自动修复' },
  ];
  return seeds.map((s, i) => ({
    id: `blk-${String(i + 1).padStart(2, '0')}`,
    capabilityId: s.cap,
    layer: s.layer,
    reasonCode: s.code,
    reason: s.reason,
    fix: s.fix,
    at: r.agoHours(r.int(2, 200)),
    outputRef: `out-${String(r.int(1, 18)).padStart(3, '0')}`,
  }));
}

const BUDGET_PANEL: BudgetPanelData = {
  runUsd: 2.0,
  dailyUsd: 50.0,
  spentTodayUsd: 18.42,
  spentTotalUsd: 412.86,
  circuit: 'closed',
  circuitReason: '近 24h 无连续超限；上次熔断 12 天前（单日预算耗尽 1 次，人工提额后恢复）',
  tiers: [
    { tier: 'efficient', model: 'gpt-5.1-mini', useFor: '汇总、摘要、分类、检索重排', share: 0.42 },
    { tier: 'balanced', model: 'claude-sonnet-4.5', useFor: '生成、审查、测试生成（默认档）', share: 0.48 },
    { tier: 'deep', model: 'claude-opus-4.6', useFor: '迁移助手、复杂推理（需显式声明）', share: 0.1 },
  ],
  degradeLadder: [
    { step: 1, condition: '单次运行达 70% 预算', behavior: '停止扩展检索范围，改用缓存上下文' },
    { step: 2, condition: '单次运行达 100% 预算', behavior: '中断运行、保留已完成部分、发 ai.budget.exhausted' },
    { step: 3, condition: '单日达 80% 预算', behavior: '非事件触发的能力改排队，事件触发降级到 efficient 档' },
    { step: 4, condition: '单日达 100% 预算', behavior: '熔断：仅保留只读问答与报告类能力；接管请求不静默（仍投递）' },
  ],
};

function buildFeedbackQueue(r: Rng): FeedbackItem[] {
  const seeds: { cat: FeedbackCategory; target: string; cap: string; dw?: FeedbackItem['downweight'] }[] = [
    { cat: '采纳', target: 'out-001（PR #4821 描述）', cap: 'pr.description' },
    { cat: '采纳', target: 'out-013（Standup 汇总）', cap: 'digest.standup' },
    { cat: '编辑', target: 'out-002（PR #4816 描述：补充回滚说明）', cap: 'pr.description' },
    { cat: '编辑', target: 'out-012（文档漂移报告：修正 2 处措辞）', cap: 'doc.drift' },
    { cat: '驳回', target: 'out-006（低置信审查发现：误报）', cap: 'review.bot', dw: { stage: '已降权', ruleId: 'rule/oc-style/line-length', hits: 3 } },
    { cat: '驳回', target: 'out-016（问答：无依据拒答被视为不满足）', cap: 'repo.qa' },
    { cat: '误报', target: 'find-012（line-length 误报）', cap: 'review.bot', dw: { stage: '待复核', ruleId: 'rule/oc-style/line-length', hits: 5 } },
    { cat: '误报', target: 'find-005（危险 API 误报：上下文未确认）', cap: 'review.bot' },
    { cat: '误报', target: 'find-010（时序归因证据不足）', cap: 'flaky.detect', dw: { stage: '已停用', ruleId: 'rule/oc-flaky/timing', hits: 8 } },
  ];
  return seeds.map((s, i) => ({
    id: `fb-${String(i + 1).padStart(3, '0')}`,
    category: s.cat,
    target: s.target,
    capabilityId: s.cap,
    at: r.agoHours(r.int(1, 300)),
    by: r.pick(NAMES),
    ingested: s.cat === '驳回' || s.cat === '误报',
    ingestedAs: s.cat === '驳回' || s.cat === '误报' ? `oc_ai_eval_case（来源运行 airun-${String(r.int(1, 12)).padStart(3, '0')}）` : '（不回灌：正向样本仅计入采纳率）',
    downweight: s.dw,
  }));
}

function buildEvalSnapshots(r: Rng): EvalSnapshot[] {
  return [
    { id: 'snap-01', capabilityId: 'pr.description', caseRef: 'case/pr-desc/001', expectedDigest: 'sha256:0a91f2c4', actualDigest: 'sha256:0a91f2c4', pass: true, promptVersion: 'pr-desc@v7', at: r.agoHours(20) },
    { id: 'snap-02', capabilityId: 'review.bot', caseRef: 'case/review/014', expectedDigest: 'sha256:77be1044', actualDigest: 'sha256:77be1044', pass: true, promptVersion: 'review@v12', at: r.agoHours(19) },
    { id: 'snap-03', capabilityId: 'review.bot', caseRef: 'case/review/015', expectedDigest: 'sha256:31ab7d95', actualDigest: 'sha256:c40e13b9', pass: false, promptVersion: 'review@v13-rc1', regressionOf: 'review@v12', at: r.agoHours(4) },
    { id: 'snap-04', capabilityId: 'digest.standup', caseRef: 'case/digest/003', expectedDigest: 'sha256:9f2c4a71', actualDigest: 'sha256:9f2c4a71', pass: true, promptVersion: 'digest@v8', at: r.agoHours(30) },
    { id: 'snap-05', capabilityId: 'doc.drift', caseRef: 'case/doc-drift/007', expectedDigest: 'sha256:2a71f908', actualDigest: 'sha256:5be40277', pass: false, promptVersion: 'doc-drift@v6-rc1', regressionOf: 'doc-drift@v5', at: r.agoHours(2) },
  ];
}

export function buildIntelData(r: Rng): IntelData {
  return {
    capabilities: CAPABILITIES,
    runs: buildIntelRuns(r),
    outputs: buildIntelOutputs(r),
    findings: buildIntelFindings(r),
    reviewThreads: buildReviewThreads(r),
    flakyFindings: buildFlakyFindings(r),
    docDrift: buildDocDrift(r),
    digests: buildDigests(r),
    qaThreads: buildQaThreads(r),
    migrations: buildMigrations(r),
    gateBlocks: buildGateBlocks(r),
    budgetPanel: BUDGET_PANEL,
    feedbackQueue: buildFeedbackQueue(r),
    evalSnapshots: buildEvalSnapshots(r),
  };
}

/** 便捷视图：按 id 取增强能力 */
export function findCapability(id: string): IntelCapability | undefined {
  return intelData.capabilities.find((c) => c.id === id);
}

/** 便捷视图：按 id 取草稿产出 */
export function findOutput(id: string): IntelOutput | undefined {
  return intelData.outputs.find((o) => o.id === id);
}

/* ============================================================================
 * 三、前沿探索（卷 25）—— 五级阶梯 + 12 方向 + 实验开关 + 数据隔离
 * ========================================================================== */

/** 五级阶梯（lab → internal → beta → ga，以及 dropped / deprecated 两个出口） */
export type ExperimentLevel = 'lab' | 'internal' | 'beta' | 'ga' | 'dropped' | 'deprecated';

export interface Experiment {
  id: string;
  title: string;
  /** 假设：若 X 则 Y，因为 Z */
  hypothesis: string;
  /** 落地入口（扩展点/工具/模式） */
  entry: string;
  /** 影响面（哪些域） */
  scope: string[];
  successCriteria: string[];
  risks: string[];
  /** 退出条件：无退出条件不得进入 beta（硬性规则） */
  exitCriteria: string;
  level: ExperimentLevel;
  owner: string;
  reviewDate: string;
  metricsRef: string;
  budget: { usd: number; spentUsd: number };
  costSpent: number;
  successRatio: number;
  startedAt: string;
  /** 选定的设计分支（卷 25 §3 结论） */
  decision: string;
  /** 用户可关闭（GA 可配） */
  userClosable: boolean;
  dataNamespace: string;
  notes: string;
}

export interface FrontierGate {
  level: ExperimentLevel;
  entry: string;
  visibility: string;
  switchKind: string;
  dataPolicy: string;
}

export interface FrontierReview {
  quarter: string;
  date: string;
  chair: string;
  items: { id: string; title: string; decision: '保留' | '推进' | '终止'; rationale: string }[];
}

export interface ExperimentFlag {
  id: string;
  experimentId: string;
  name: string;
  kind: '硬编码开关' | '实验开关' | '租户级开关' | '默认开启';
  rollout: string;
  userClosable: boolean;
  /** 界面必须显示「实验」徽标 */
  badge: true;
  defaultOn: boolean;
  notes: string;
}

export interface IsolationItem {
  experimentId: string;
  namespace: string;
  cleanup: { method: string; retainDays: number; exportable: boolean; deletable: boolean };
  migration: string;
}

export interface MultimodalTask {
  id: string;
  kind: '设计稿→代码' | '截图→修复' | '视频理解' | '图示生成';
  inputRef: string;
  output: string;
  structureAccuracy: number;
  visualDiff: { metric: string; value: number; threshold: number };
  report: string;
  status: 'SUCCEEDED' | 'FAILED' | 'VERIFYING';
  diffPath?: string;
}

export interface ComputerUseRun {
  id: string;
  scenario: string;
  runtime: '浏览器（沙箱）' | '桌面应用（沙箱）';
  /** 执行强度上报：FULL 完整执行 / PARTIAL 部分执行（须显式上报） */
  intensity: 'FULL' | 'PARTIAL';
  partialReason?: string;
  steps: number;
  boundaryViolations: number;
  result: 'SUCCEEDED' | 'FAILED';
  durationMs: number;
  recording: string;
}

export interface EvolutionDraft {
  id: string;
  source: string;
  kind: '技能草稿' | '评测用例' | '提示词建议';
  fromRun: string;
  summary: string;
  status: '待评审' | '已采纳' | '已驳回';
  /** 禁止自动发布：必须人工评审 */
  autoPublish: false;
  reviewedBy?: string;
  checklist: string[];
}

export interface FrontierData {
  experiments: Experiment[];
  gates: FrontierGate[];
  reviews: FrontierReview[];
  flags: ExperimentFlag[];
  isolation: { standard: string; items: IsolationItem[] };
  multimodalTasks: MultimodalTask[];
  computerUseRuns: ComputerUseRun[];
  evolutionDrafts: EvolutionDraft[];
  /** 活跃上限（默认 ≤ 8） */
  activeLimit: number;
  activeCount: number;
}

interface ExpSeed {
  id: string;
  title: string;
  hypothesis: string;
  entry: string;
  scope: string[];
  success: string[];
  risks: string[];
  exit: string;
  level: ExperimentLevel;
  decision: string;
  ratio: number;
  closable: boolean;
  notes: string;
}

const EXP_SEEDS: ExpSeed[] = [
  {
    id: 'D-FR-1',
    title: '多模态协作深度',
    hypothesis: '若把设计稿/截图/视频接入会话并做视觉对比迭代，则「设计稿→代码」任务的结构正确率 ≥ 80%，因为差异可量化并可迭代收敛。',
    entry: 'view_image / extract_document 工具 + 会话输入增强（卷 22）+ 视觉对比验证器（卷 12）',
    scope: ['会话输入', '工具系统', '验证器'],
    success: ['设计稿还原任务结构正确率 ≥ 80%', '视觉差异可量化并收敛（连续 2 轮差异下降）'],
    risks: ['多模态输入可能夹带敏感信息（需 DLP 前置）', '视觉对比误判导致过度修改（需人工确认门）'],
    exit: '结构正确率连续 2 个月 < 70% 或视觉差异不收敛 → 退出并回退到「仅输入」基线',
    level: 'internal',
    decision: 'B2 双向多模态（设计稿↔代码 ↔截图回评 ↔图示生成）',
    ratio: 0.82,
    closable: true,
    notes: '设计稿→代码已在内部基准（42 例）达 82%；截图回评仍在打磨误判率。',
  },
  {
    id: 'D-FR-2',
    title: '计算机使用（GUI 自动化）',
    hypothesis: '若在沙箱内做 GUI/浏览器操作（截图 + 坐标/元素定位），则端到端验证通过率 ≥ 70%，因为能真点一遍而不只跑测试。',
    entry: '沙箱虚拟显示 + 浏览器驱动 + 卷 07 强隔离绑定',
    scope: ['沙箱', '工具系统', '验证器'],
    success: ['10 个典型 WEB 流程端到端自动化通过率 ≥ 70%', '越界操作 = 0'],
    risks: ['坐标定位脆弱导致不稳定（需元素定位优先）', '越界操作风险（零容忍：一旦越界立即停用）'],
    exit: '越界操作出现 1 次即停用；通过率连续 1 个月 < 60% → 退出',
    level: 'beta',
    decision: 'B2 沙箱内 GUI 自动化（验证用途优先，不做用户桌面操作）',
    ratio: 0.71,
    closable: true,
    notes: '执行强度 FULL/PARTIAL 逐次上报；PARTIAL 必须给出降级原因（不静默）。',
  },
  {
    id: 'D-FR-3',
    title: '自进化（从失败中学习）',
    hypothesis: '若从失败轨迹提炼技能草稿/评测用例/提示词建议并人工评审发布，则组织能力随时间增强，因为失败样本成为资产。',
    entry: '卷 08 技能创作器 + 卷 26 评测挂钩 + 卷 04 灰度验证',
    scope: ['技能系统', '评测', '提示词'],
    success: ['每季度沉淀 ≥ 20 条有效改进（被采纳且指标提升）'],
    risks: ['草稿质量参差（需评审队列）', '若允许自动发布将不可控（明确禁止）'],
    exit: '连续 2 个季度有效改进 < 8 条 → 退出并保留人工提炼通道',
    level: 'internal',
    decision: 'B2 受控自进化：全部人工评审后发布（禁止自动发布）',
    ratio: 0.64,
    closable: false,
    notes: '技能草稿评审队列当前 6 条待办；自动发布被硬性禁止（代码层不可达）。',
  },
  {
    id: 'D-FR-4',
    title: '评测驱动开发（EDD）',
    hypothesis: '若以内部任务基准 + 变更门禁 + 模型 A/B 驱动开发，则质量可持续，因为每次变更都有可回归的证据。',
    entry: '卷 26 评测集 + 变更门禁 + 基准与真实会话采样联动',
    scope: ['评测', '模型路由', 'CI 门禁'],
    success: ['基准回归全部达标（成功率/成本/时长/轨迹评分）', '门禁在 CI 中稳定拦截劣化变更'],
    risks: ['基准过拟合（需定期注入新用例）'],
    exit: '门禁误伤率 > 20% 或基准与线上指标背离 → 回退到人工回归',
    level: 'ga',
    decision: 'B2 基准驱动（基准 + 门禁 + A/B + 失败提炼）',
    ratio: 0.93,
    closable: true,
    notes: '已并入卷 26 主线；本卷仅保留实验登记与回流入口。',
  },
  {
    id: 'D-FR-5',
    title: 'Agent 与技能市场',
    hypothesis: '若提供技能/插件/团队模板三类市场并统一签名、评分与安全扫描，则生态飞轮启动，因为分发成本显著下降。',
    entry: '卷 08 技能 + 卷 18 插件 + 卷 13 团队模板三市场',
    scope: ['技能', '插件', '团队模板', '企业私仓'],
    success: ['市场安装量月增 ≥ 15%', '未签名内容在强制模式 0 上架'],
    risks: ['恶意内容（需签名 + 安全扫描 + 企业白名单）'],
    exit: '安装量连续 2 个季度零增长或出现 1 起安全事件 → 关闭公开市场仅留私仓',
    level: 'beta',
    decision: 'B2 三类市场 + 企业私有市场镜像公共内容',
    ratio: 0.68,
    closable: true,
    notes: '企业私仓已镜像 42 个内容；公开市场仅在白名单租户开启。',
  },
  {
    id: 'D-FR-6',
    title: '跨 Harness 联邦',
    hypothesis: '若通过 A2A 与其他 Coding Agent 组成能力联邦，则外部专家能力可被复用，因为任务与证据可共享而不共享上下文。',
    entry: '卷 23 A2A 服务面 + 协议适配器',
    scope: ['A2A', '远程审批', '企业联邦目录'],
    success: ['跨实例任务成功率 ≥ 85%', '远程审批回路可用'],
    risks: ['协议版本漂移（需能力发现与版本协商）'],
    exit: '协议不兼容导致失败率 > 30% → 退出',
    level: 'deprecated',
    decision: 'B2 联邦协作（共享任务与证据，不共享上下文）',
    ratio: 0.55,
    closable: true,
    notes: '已被更好的方案取代：联邦能力并入卷 23 A2A 统一通道与「企业联邦目录」，实验项关闭并指引迁移。',
  },
  {
    id: 'D-FR-7',
    title: '个人助理化',
    hypothesis: '若基于记忆与日程在合适时机主动建议（可关、本地优先），则日常价值提升，因为建议贴合真实上下文。',
    entry: '卷 10 记忆 + 卷 15 日程 + 主动建议通道',
    scope: ['记忆', '日程', '通知'],
    success: ['建议采纳率 ≥ 25%', '打扰投诉 = 0'],
    risks: ['隐私边界（默认关闭云端推理上下文）', '打扰过度（需频控与静默）'],
    exit: '采纳率 < 10% 或出现隐私事件 → 关闭',
    level: 'lab',
    decision: 'B2 主动建议（可关，本地优先，默认关闭）',
    ratio: 0.0,
    closable: true,
    notes: '实验室阶段：假设与成功判据已书面化，未上报任何使用数据。',
  },
  {
    id: 'D-FR-8',
    title: '端侧/小模型辅助',
    hypothesis: '若轻任务（摘要/分类/检索重排/简单编辑）走端侧小模型、重任务走云端，则成本显著下降，因为无关任务不消耗大模型。',
    entry: '卷 02 D-MDL-6 分层路由 + Ollama/本地量化模型',
    scope: ['模型路由', '成本'],
    success: ['轻任务成本下降 ≥ 40%', '质量不劣化（基准回归通过）'],
    risks: ['端侧质量波动（需按任务类型设阈值）', '本地运行时不可用需显式降级'],
    exit: '质量劣化超阈值或成本下降 < 15% → 仅保留云端路由',
    level: 'internal',
    decision: 'B2 分层推理（轻任务端侧，重任务云端）',
    ratio: 0.77,
    closable: true,
    notes: '端侧不预装：检测到本地 Ollama 运行时后才可选启用。',
  },
  {
    id: 'D-FR-9',
    title: '形式化验证辅助',
    hypothesis: '若对关键算法/并发代码提供不变量检查与属性测试生成，则关键路径缺陷前移，因为形式化约束可被机械检查。',
    entry: '外部工具集成（不变量检查器 / 属性测试 / 模型检查辅助）',
    scope: ['验证器', '工具系统'],
    success: ['关键路径缺陷发现前置率 ≥ 30%'],
    risks: ['投入产出比低（工具链重）', '误报导致工程师不信任'],
    exit: 'lab 阶段投入产出不达标 → 退出，不进入 internal',
    level: 'dropped',
    decision: 'B2 关键路径增强（lab 起步，工具形态接入，不内置证明器）',
    ratio: 0.0,
    closable: true,
    notes: '假设被否：两轮实验未能在两周内产出可解释结论，投入产出比不达标，实验关闭并归档数据。',
  },
  {
    id: 'D-FR-10',
    title: '组织知识图谱',
    hypothesis: '若构建「人-代码-决策」图谱用于路由与影响分析，则能找到对的人，因为关系可查询而非靠记忆。',
    entry: '提交/任务/审查/记忆/知识页五源关系抽取',
    scope: ['知识', '记忆', '协作'],
    success: ['路由准确率 ≥ 70%', '影响分析召回 ≥ 80%'],
    risks: ['图谱维护成本高（关系漂移）', '组织隐私边界'],
    exit: '图谱维护成本高于路由收益 → 退出',
    level: 'dropped',
    decision: 'B2 人-代码-决策图谱（用于路由与影响分析）',
    ratio: 0.0,
    closable: true,
    notes: '假设被否：图谱新鲜度维护成本高于收益，实验关闭；关系数据已归档且可导出。',
  },
  {
    id: 'D-FR-11',
    title: '自主运维',
    hypothesis: '若内核自检能自动修复常见故障（重连/降级/清理）并生成诊断报告，则运维负担下降，因为常见故障无需人工。',
    entry: '内核自检 + 自愈动作库 + 诊断报告生成',
    scope: ['可观测', '运维', '诊断'],
    success: ['常见故障自动修复率 ≥ 60%', '误修率 = 0（不可发生）'],
    risks: ['误修放大故障（需白名单动作 + 演练）', '自主变更线上被明确排除'],
    exit: '出现 1 次误修或自动修复率连续 1 个月 < 30% → 退出',
    level: 'lab',
    decision: 'B2 自诊断 + 自愈 + 演练（不做自主变更线上）',
    ratio: 0.0,
    closable: true,
    notes: '实验室阶段：自愈动作白名单（重连/降级/清理临时产物），线上变更仍需人工审批。',
  },
  {
    id: 'D-FR-12',
    title: '研究通道',
    hypothesis: '若把实验清单 + 开关框架 + 评测挂钩 + 下线流程 + 季度评审制度化，则探索有序，因为每个方向都有登记与出口。',
    entry: '本卷实验清单 + 卷 24 D-ENT-9 特性开关 + 卷 26 评测挂钩',
    scope: ['治理', '平台'],
    success: ['12 个方向全部登记', '每季度评审有保留/推进/终止记录'],
    risks: ['流程空转（需季度评审强制）'],
    exit: '机制被并入职级平台能力后，本实验项退出（转为常设流程）',
    level: 'deprecated',
    decision: 'B2 制度化（清单 + 开关 + 评测 + 季度评审）',
    ratio: 0.9,
    closable: false,
    notes: '已被更好方案取代：实验登记迁移到 Registry 与卷 24 特性开关框架，本实验项归档（流程保留）。',
  },
];

function buildExperiments(r: Rng): Experiment[] {
  return EXP_SEEDS.map((s, i) => {
    const budgetUsd = r.int(6, 40);
    const spent = s.level === 'lab' ? r.float(0.4, 3, 2) : r.float(1.2, budgetUsd * 0.85, 2);
    return {
      id: s.id,
      title: s.title,
      hypothesis: s.hypothesis,
      entry: s.entry,
      scope: s.scope,
      successCriteria: s.success,
      risks: s.risks,
      exitCriteria: s.exit,
      level: s.level,
      owner: r.pick(NAMES),
      reviewDate: r.future(r.int(3, 45) * 24 * 60),
      metricsRef: `metrics://frontier/${s.id.toLowerCase()}?board=experiments`,
      budget: { usd: budgetUsd, spentUsd: spent },
      costSpent: spent,
      successRatio: s.ratio,
      startedAt: r.agoDays(r.int(30, 240)),
      decision: s.decision,
      userClosable: s.closable,
      dataNamespace: `exp.${s.id.toLowerCase()}.${TENANT_SLUG}`,
      notes: s.notes,
    };
  });
}

const TENANT_SLUG = 'yunshu';

const FRONTIER_GATES: FrontierGate[] = [
  { level: 'lab', entry: '假设 + 成功判据书面化', visibility: '仅开发者', switchKind: '硬编码开关', dataPolicy: '不上报' },
  { level: 'internal', entry: '原型可演示 + 已知限制清单', visibility: '团队内', switchKind: '实验开关', dataPolicy: '匿名使用统计' },
  { level: 'beta', entry: '通过安全红队 + 质量基线', visibility: '白名单用户/租户', switchKind: '租户级开关', dataPolicy: '全量指标 + 反馈收集' },
  { level: 'ga', entry: '指标达标 + 运维就绪（监控/告警/文档）', visibility: '全量（可配）', switchKind: '默认开启', dataPolicy: '全量' },
  { level: 'dropped', entry: '退出条件触发（假设被否 / 收益不足 / 风险不达标）', visibility: '关闭 + 公告 + 迁移建议', switchKind: '移除路径明确', dataPolicy: '归档' },
  { level: 'deprecated', entry: '被更好方案取代', visibility: '关闭 + 公告 + 迁移建议', switchKind: '移除路径明确', dataPolicy: '归档' },
];

const FRONTIER_REVIEWS: FrontierReview[] = [
  {
    quarter: '2026 Q2',
    date: '2026-06-26',
    chair: '沈亦舟',
    items: [
      { id: 'D-FR-4', title: '评测驱动开发', decision: '推进', rationale: '基准回归全达标且 CI 门禁稳定，晋级 ga。' },
      { id: 'D-FR-2', title: '计算机使用', decision: '推进', rationale: '10 个流程通过率 71% 达标，晋级 beta（白名单租户）。' },
      { id: 'D-FR-9', title: '形式化验证辅助', decision: '终止', rationale: 'lab 阶段两轮实验未产出可解释结论，投入产出不达标。' },
      { id: 'D-FR-10', title: '组织知识图谱', decision: '终止', rationale: '图谱新鲜度维护成本高于路由收益，假设被否。' },
    ],
  },
  {
    quarter: '2026 Q3',
    date: '2026-09-25',
    chair: '林晚照',
    items: [
      { id: 'D-FR-1', title: '多模态协作深度', decision: '推进', rationale: '内部基准结构正确率 82%，准备 beta 门禁（红队 + 质量基线）。' },
      { id: 'D-FR-8', title: '端侧小模型辅助', decision: '推进', rationale: '轻任务成本下降 44%，质量基准无劣化。' },
      { id: 'D-FR-6', title: '跨 Harness 联邦', decision: '终止', rationale: '联邦能力并入 A2A 统一通道，实验项归档并指引迁移。' },
      { id: 'D-FR-12', title: '研究通道', decision: '终止', rationale: '制度化流程转为常设（Registry + 特性开关），实验项退出。' },
      { id: 'D-FR-7', title: '个人助理化', decision: '保留', rationale: 'lab 阶段，需补齐打扰频控与隐私边界设计后再评估。' },
    ],
  },
];

function buildFlags(r: Rng): ExperimentFlag[] {
  const seeds: { exp: string; name: string; kind: ExperimentFlag['kind']; rollout: string; closable: boolean; on: boolean; note: string }[] = [
    { exp: 'D-FR-1', name: 'oc.experiment.multimodal-collab', kind: '实验开关', rollout: '团队内 12 人 + 白名单租户 2 个', closable: true, on: true, note: '开启后会话输入支持设计稿/截图/视频，界面显示「实验」徽标并可一键关闭。' },
    { exp: 'D-FR-2', name: 'oc.experiment.computer-use', kind: '租户级开关', rollout: '白名单租户 1 个（云枢科技-测试）', closable: true, on: false, note: '沙箱内 GUI 自动化；执行强度 FULL/PARTIAL 逐次上报，越界零容忍。' },
    { exp: 'D-FR-3', name: 'oc.experiment.self-evolution', kind: '实验开关', rollout: '团队内全量（草稿评审队列）', closable: false, on: true, note: '仅生成草稿，禁止自动发布；关闭需管理员操作（草稿队列随之只读）。' },
    { exp: 'D-FR-4', name: 'oc.experiment.edd-gate', kind: '默认开启', rollout: '全量', closable: true, on: true, note: 'GA 后并入主线；用户可在设置中关闭门禁拦截，但审计仍记录。' },
    { exp: 'D-FR-5', name: 'oc.experiment.market-public', kind: '租户级开关', rollout: '白名单租户 3 个', closable: true, on: false, note: '公共市场访问；企业私仓始终可用（不受该开关影响）。' },
    { exp: 'D-FR-8', name: 'oc.experiment.edge-model', kind: '实验开关', rollout: '团队内 + 检测到本地 Ollama 的租户', closable: true, on: false, note: '端侧不预装；启用后轻任务走本地模型，成本与命中原因此处可查。' },
    { exp: 'D-FR-11', name: 'oc.experiment.self-heal', kind: '硬编码开关', rollout: '仅开发者（内部构建）', closable: false, on: false, note: '实验室阶段硬编码开关；仅白名单动作（重连/降级/清理临时产物）。' },
  ];
  return seeds.map((s, i) => ({
    id: `flag-${String(i + 1).padStart(2, '0')}`,
    experimentId: s.exp,
    name: s.name,
    kind: s.kind,
    rollout: s.rollout,
    userClosable: s.closable,
    badge: true,
    defaultOn: s.on,
    notes: s.note,
  }));
}

function buildIsolation(r: Rng): FrontierData['isolation'] {
  const items: IsolationItem[] = EXP_SEEDS.map((s) => ({
    experimentId: s.id,
    namespace: `exp.${s.id.toLowerCase()}.${TENANT_SLUG}`,
    cleanup: {
      method: s.level === 'lab' ? '一键清理（不留副本）' : '一键清理 + 归档摘要',
      retainDays: s.level === 'lab' ? 0 : s.level === 'internal' ? 30 : 90,
      exportable: true,
      deletable: true,
    },
    migration: s.level === 'ga'
      ? 'GA 并入主线：命名空间数据迁移到主线表族（保留 90 天双写窗口）'
      : s.level === 'dropped' || s.level === 'deprecated'
        ? '下线迁移：数据已归档为只读包（可导出/可删除），索引与开关全量移除，指引见公告'
        : '晋级时提供迁移说明：命名空间数据整体搬迁，旧命名空间在 30 天后清理',
  }));
  return {
    standard: '实验数据单独命名空间（可整体清理）；实验不得绕过卷 06/07/16 的任何约束；涉及用户数据的实验必须显式同意，默认匿名。',
    items,
  };
}

function buildMultimodal(r: Rng): MultimodalTask[] {
  const seeds: { kind: MultimodalTask['kind']; input: string; out: string; acc: number; diff: number; status: MultimodalTask['status']; path?: string }[] = [
    { kind: '设计稿→代码', input: '设计稿 v4（Figma 导出，含 6 个组件）', out: 'Vue 组件 3 个 + 样式 token 12 项', acc: 0.86, diff: 3.2, status: 'SUCCEEDED', path: 'src/components/order/OrderCard.vue' },
    { kind: '设计稿→代码', input: '设计稿 v2（含暗色变体）', out: '组件 2 个（暗色变体缺失）', acc: 0.74, diff: 8.7, status: 'FAILED', path: 'src/components/order/OrderList.vue' },
    { kind: '截图→修复', input: '缺陷截图（按钮错位，1280×800）', out: '样式修复 diff（flex 对齐）', acc: 0.92, diff: 1.1, status: 'SUCCEEDED', path: 'src/styles/button.scss' },
    { kind: '视频理解', input: '录屏 02:14（复现步骤 5 步）', out: '缺陷复现要点 5 条 + 触发条件', acc: 0.81, diff: 0, status: 'SUCCEEDED' },
    { kind: '图示生成', input: '模块依赖描述（8 个模块）', out: '架构图（Mermaid）+ 依赖说明', acc: 0.88, diff: 0, status: 'VERIFYING' },
  ];
  return seeds.map((s, i) => ({
    id: `mm-${String(i + 1).padStart(2, '0')}`,
    kind: s.kind,
    inputRef: s.input,
    output: s.out,
    structureAccuracy: s.acc,
    visualDiff: { metric: '像素差异率', value: s.diff, threshold: 5 },
    report: `report://frontier/multimodal/${i + 1}`,
    status: s.status,
    diffPath: s.path,
  }));
}

function buildComputerUse(r: Rng): ComputerUseRun[] {
  const seeds: { scenario: string; runtime: ComputerUseRun['runtime']; intensity: 'FULL' | 'PARTIAL'; partial?: string; steps: number; result: ComputerUseRun['result']; dur: number }[] = [
    { scenario: '注册 → 下单 → 支付（Web 全流程）', runtime: '浏览器（沙箱）', intensity: 'FULL', steps: 18, result: 'SUCCEEDED', dur: 96_000 },
    { scenario: '审批卡键盘全流程（A/S/R + Tab 范围）', runtime: '浏览器（沙箱）', intensity: 'FULL', steps: 11, result: 'SUCCEEDED', dur: 42_000 },
    { scenario: '桌面客户端安装向导点击验证', runtime: '桌面应用（沙箱）', intensity: 'PARTIAL', partial: '沙箱缺少桌面合成器，已跳过 3 个拖拽步骤并显式上报（不静默）', steps: 9, result: 'FAILED', dur: 61_000 },
    { scenario: '文件管理器多选上传', runtime: '桌面应用（沙箱）', intensity: 'PARTIAL', partial: '文件选择对话框为系统原生控件，沙箱内不可见 → 改用路径输入等价路径', steps: 7, result: 'SUCCEEDED', dur: 33_000 },
  ];
  return seeds.map((s, i) => ({
    id: `cu-${String(i + 1).padStart(2, '0')}`,
    scenario: s.scenario,
    runtime: s.runtime,
    intensity: s.intensity,
    partialReason: s.partial,
    steps: s.steps,
    boundaryViolations: 0,
    result: s.result,
    durationMs: s.dur,
    recording: `artifact://frontier/computer-use/cu-${i + 1}.webm（含操作轨迹与截图序列）`,
  }));
}

function buildEvolutionDrafts(r: Rng): EvolutionDraft[] {
  const seeds: { kind: EvolutionDraft['kind']; from: string; summary: string; status: EvolutionDraft['status']; reviewer?: string }[] = [
    { kind: '技能草稿', from: 'session/8123（迁移任务失败轨迹 ×4）', summary: '「Gradle 依赖冲突定位」技能：先跑 dependencyInsight 再改版本约束', status: '待评审' },
    { kind: '技能草稿', from: 'session/8090（文档同步冲突轨迹 ×6）', summary: '「文档受保护段落识别」技能：先读 protectedSegments 再生成修订', status: '已采纳', reviewer: '顾清和' },
    { kind: '评测用例', from: 'session/8155 + airun-006', summary: '用例：低置信 Flaky 结论不得生成自动修复（期望处置=拒答）', status: '已采纳', reviewer: '周砚青' },
    { kind: '评测用例', from: 'session/8177', summary: '用例：模板权限越界时装载期拒绝并给出中文原因', status: '待评审' },
    { kind: '提示词建议', from: 'airun-003（测试生成假测试拒收 3 次）', summary: 'test-gen 提示词增加「禁止恒真断言」硬约束，并附反例', status: '待评审' },
    { kind: '提示词建议', from: 'airun-010（未覆盖项缺失）', summary: 'pr-desc 提示词要求「未覆盖项」段必须显式给出（含空值声明）', status: '已驳回', reviewer: '江月白' },
  ];
  return seeds.map((s, i) => ({
    id: `evo-${String(i + 1).padStart(2, '0')}`,
    source: '失败轨迹学习',
    kind: s.kind,
    fromRun: s.from,
    summary: s.summary,
    status: s.status,
    autoPublish: false,
    reviewedBy: s.reviewer,
    checklist: ['是否有失败轨迹证据', '是否与既有技能/用例重复', '是否可在评测集回归验证', '是否触及安全基线（权限/沙箱/审计）'],
  }));
}

export function buildFrontierData(r: Rng): FrontierData {
  const experiments = buildExperiments(r);
  const ACTIVE = ['lab', 'internal', 'beta', 'ga'];
  return {
    experiments,
    gates: FRONTIER_GATES,
    reviews: FRONTIER_REVIEWS,
    flags: buildFlags(r),
    isolation: buildIsolation(r),
    multimodalTasks: buildMultimodal(r),
    computerUseRuns: buildComputerUse(r),
    evolutionDrafts: buildEvolutionDrafts(r),
    activeLimit: 8,
    activeCount: experiments.filter((e) => ACTIVE.includes(e.level)).length,
  };
}

/** 便捷视图：按 id 取实验 */
export function findExperiment(id: string): Experiment | undefined {
  return frontierData.experiments.find((e) => e.id === id);
}




const CAPABILITIES: IntelCapability[] = [
  {
    id: 'pr.description',
    name: 'PR 描述与变更日志',
    verb: 'oc ai pr-describe --pr 4821',
    category: '生成',
    triggers: ['事件', '命令', '会话内联'],
    inputContract: ['分支 diff', '提交列表', '任务与计划引用', '测试证据', '审查评论', '模板骨架'],
    outputContract: ['PR 描述（摘要/动机/影响面/验证方式/风险与回滚/未覆盖项）', '变更日志条目（分类 + 双语）'],
    toolDeps: ['git', 'file-read', 'kb-search'],
    writeScopes: ['pr.description（PR 正文，不写代码）'],
    gateProfile: '三层门禁（结构 → 引用 ≥90% → 安全扫描）',
    budget: { runUsd: 0.6, dailyUsd: 50 },
    enabled: true,
    adoptionRatio: 0.86,
    falsePositiveRatio: 0.03,
    timeSavedMinutes: 12,
    costPerRun: 0.42,
    model: 'claude-sonnet-4.5',
    promptVersion: 'pr-desc@v7',
    quality: ['引用覆盖率 ≥ 90%', '未覆盖项非空则高亮', 'breaking / security 条目必须人工确认'],
    failure: ['diff > 400 文件 → 只出标题与摘要 + 明确列出未分析范围', '模型失败 → 回退模板骨架并标注「生成降级」', '分类不确定 → 标「未分类」交人工'],
  },
  {
    id: 'review.bot',
    name: '审查机器人',
    verb: 'oc ai review --pr 4815',
    category: '审查',
    triggers: ['事件', '命令', INLINE],
    inputContract: ['diff', '仓库约定（AGENTS 类规则）', '历史发现与处置', '规则清单', '既有审查线程'],
    outputContract: ['发现列表（ruleId/位置/严重度/置信度/依据/修复建议）', 'SARIF', '内联评论'],
    toolDeps: ['git', 'file-read', 'sarif-writer'],
    writeScopes: ['repo.comment（评论与 SARIF，不写代码）'],
    gateProfile: '三层门禁 + 条件人工门（高置信安全问题请求变更需人工确认）',
    budget: { runUsd: 2.0, dailyUsd: 50 },
    enabled: true,
    adoptionRatio: 0.71,
    falsePositiveRatio: 0.12,
    timeSavedMinutes: 26,
    costPerRun: 1.35,
    model: 'claude-sonnet-4.5',
    promptVersion: 'review@v12',
    quality: ['规则通道确定性优先', '模型通道必须给依据（引用行 + 规则名）', '低置信默认折叠不阻塞合并'],
    failure: ['单轮超时 → 保留已产出发现，线程可续', '修复后复验失败 → 回滚该修复并标记线程 BLOCKED', '误报反馈 → 规则两段式降权（先降权，人工复核后停用）'],
  },
  {
    id: 'test.gen',
    name: '测试生成与覆盖补强',
    verb: 'oc ai test-gen --scope diff',
    category: '生成',
    triggers: ['命令', '事件', '计划'],
    inputContract: ['变更 diff', '覆盖率报告与缺口', '被测模块公共接口', '既有测试风格样例'],
    outputContract: ['测试 PR（单元/集成/属性三分）', '覆盖率变化', '未覆盖残余说明'],
    toolDeps: ['git', 'shell', 'file-edit'],
    writeScopes: ['tests/**（测试目录白名单，只提 PR）'],
    gateProfile: '三层门禁 + 生成即运行（不通过即丢弃）',
    budget: { runUsd: 2.0, dailyUsd: 50 },
    enabled: true,
    adoptionRatio: 0.58,
    falsePositiveRatio: 0.09,
    timeSavedMinutes: 38,
    costPerRun: 1.82,
    model: 'claude-sonnet-4.5',
    promptVersion: 'test-gen@v9',
    quality: ['生成即运行：不通过即丢弃并报告', '假测试检测（无断言/恒真断言/只测 getter）拒收', '新增用例不得修改既有测试期望'],
    failure: ['运行环境缺失 → 标记 skipped 不产 PR', '拒绝率 > 50% → 降级为「只给测试要点清单」', '单文件生成上限默认 20 例'],
  },
  {
    id: 'flaky.detect',
    name: 'Flaky 检测与隔离',
    verb: 'oc ai flaky --suite order-suite',
    category: '检测',
    triggers: ['事件', '计划', '命令'],
    inputContract: ['测试事件（含重跑）', '执行环境信息', '历史方差', '失败签名'],
    outputContract: ['观察清单（低置信）', '归因结论（六类）', '隔离建议', '修复 PR（仅高置信低风险）'],
    toolDeps: ['shell', 'git', 'metrics-query'],
    writeScopes: ['tests/**（隔离标记默认只建议）'],
    gateProfile: '三层门禁 + 单次失败不得标记 flaky',
    budget: { runUsd: 2.0, dailyUsd: 50 },
    enabled: true,
    adoptionRatio: 0.62,
    falsePositiveRatio: 0.15,
    timeSavedMinutes: 44,
    costPerRun: 1.6,
    model: 'claude-sonnet-4.5',
    promptVersion: 'flaky@v6',
    quality: ['三法交叉：同提交重跑不一致 / 跨运行方差超阈值 / 隔离运行后稳定', '置信度与证据一并输出'],
    failure: ['重跑不可用 → 退化为统计法并降置信度', '隔离默认只建议（企业可开自动标记）', '修复 PR 连续 2 次失败 → 停止自动修复，转观察清单'],
  },
  {
    id: 'doc.drift',
    name: '文档漂移检测',
    verb: 'oc ai doc-drift --path docs/**',
    category: '检测',
    triggers: ['计划', '事件', '命令'],
    inputContract: ['代码侧结构化提取（公开接口/配置项/环境变量/CLI 命令）', '文档侧声明', '文档归属与白名单计划'],
    outputContract: ['差异清单（缺失/过时/多余）', '修订 PR（仅允许写路径）', '文档所有者通知'],
    toolDeps: ['file-read', 'kb-search', 'git'],
    writeScopes: ['docs/**（可配白名单，人工校订段落受保护）'],
    gateProfile: '三层门禁 + 写路径越界即整体拒绝',
    budget: { runUsd: 1.2, dailyUsd: 50 },
    enabled: true,
    adoptionRatio: 0.54,
    falsePositiveRatio: 0.18,
    timeSavedMinutes: 30,
    costPerRun: 0.88,
    model: 'gpt-5.1',
    promptVersion: 'doc-drift@v5',
    quality: ['结构化比对优先、语义检索补充', '修订 PR 仅触及文档目录', '人工已校订段落受保护（冲突并排展示）'],
    failure: ['文档侧无法解析（非结构化）→ 只报告不修订', '写路径越界 → 整体拒绝并告警', '同一文档连续 3 次修订被驳回 → 转「只报告」模式'],
  },
  {
    id: 'digest.standup',
    name: 'Standup / 周报汇总',
    verb: 'oc ai digest --period week',
    category: '汇总',
    triggers: ['计划', '命令', '会话内联'],
    inputContract: ['任务状态变化', '提交与 PR', '审查活动', '事故与告警', '自动化收益', '上一周期报告'],
    outputContract: ['客观事实层（每条带事件来源）', '主观摘要层（标注 AI）', '环比', '需关注清单', '数据缺口清单'],
    toolDeps: ['event-query', 'metrics-query'],
    writeScopes: ['仅报告与通知（只读）'],
    gateProfile: '三层门禁 + 客观层字段无事件来源即失败',
    budget: { runUsd: 0.4, dailyUsd: 50 },
    enabled: true,
    adoptionRatio: 0.79,
    falsePositiveRatio: 0.02,
    timeSavedMinutes: 18,
    costPerRun: 0.26,
    model: 'gpt-5.1-mini',
    promptVersion: 'digest@v8',
    quality: ['客观层字段无事件来源即为门禁失败', '主观层必须标注', '不得出现无来源的量化断言'],
    failure: ['数据源缺失 → 明确输出「数据缺口」而非推断', '无事件 → 输出空报告并说明', '交付通道失败 → 本地留档并重试一次'],
  },
  {
    id: 'repo.qa',
    name: '仓库知识问答',
    verb: 'oc ai ask "审批链在哪里实现"',
    category: '汇总',
    triggers: [INLINE, '命令'],
    inputContract: ['自然语言问题', '检索范围约束（仓库/文档/历史会话）', '用户权限上下文'],
    outputContract: ['回答 + 引用列表（文件 + 行 / 文档 + 版本）', '可「作为上下文引用」进入会话'],
    toolDeps: ['kb-search', 'symbol-index', 'file-read'],
    writeScopes: ['只读（不产生写动作）'],
    gateProfile: '三层门禁 + 强制引用 + 无依据明确拒答',
    budget: { runUsd: 0.3, dailyUsd: 50 },
    enabled: true,
    adoptionRatio: 0.83,
    falsePositiveRatio: 0.05,
    timeSavedMinutes: 9,
    costPerRun: 0.18,
    model: 'gpt-5.1',
    promptVersion: 'repo-qa@v11',
    quality: ['强制引用；无依据时明确回答「未找到依据」并给出检索范围', '引用必须可打开且版本可追溯', '权限不足明确拒绝（不静默降级为公共知识）'],
    failure: ['引用不可达 → 标注并降置信', '权限不足 → 明确拒绝并说明缺失权限', '缓存命中必须校验权限指纹'],
  },
  {
    id: 'code.migrate',
    name: '代码迁移助手',
    verb: 'oc ai migrate --spec migrate-h2-to-jdbc',
    category: '生成',
    triggers: ['命令', '计划'],
    inputContract: ['迁移规格（规则 + 正反例 + 验收命令）', '目标模式', '影响面分析结果', '批次状态'],
    outputContract: ['分批 PR（每批独立分支与提交）', '每批验证结果', '迁移报告（自动比例/人工干预点）', '断点续跑状态'],
    toolDeps: ['git', 'shell', 'file-edit', 'kb-search'],
    writeScopes: ['src/**（按规格白名单，只提 PR，不自动合并）'],
    gateProfile: '三层门禁 + 每批必须通过规格声明的验收命令',
    budget: { runUsd: 2.0, dailyUsd: 50 },
    enabled: false,
    adoptionRatio: 0.47,
    falsePositiveRatio: 0.21,
    timeSavedMinutes: 96,
    costPerRun: 1.94,
    model: 'claude-opus-4.6',
    promptVersion: 'migrate@v4',
    quality: ['每批必须通过规格验收命令（构建/测试）', '不改变公开行为（除规格要求）', '批次大小默认 ≤ 50 文件（可配 10–200）'],
    failure: ['批次失败 → 回滚该批、生成诊断、停止后续批次并保留已完成批次', '规格歧义 → 暂停并列出待澄清项（不猜测）', '续跑从失败批次重建分支'],
  },
];

// ── 模块级数据构建（必须置于文件末尾）──
// 构建函数会引用本文件后续声明的常量（CAPABILITIES/EXP_SEEDS/FRONTIER_GATES 等），
// 提前执行会触发 TDZ（Cannot access 'X' before initialization），因此统一放到最后。
export const automationData: AutomationBundle = buildAutomationData(new Rng(340021));

/** 智能增强子域（与 automationData 同源，保证 id 关联一致） */
export const intelData: IntelData = automationData.intel;

/** 前沿探索子域 */
export const frontierData: FrontierData = automationData.frontier;
