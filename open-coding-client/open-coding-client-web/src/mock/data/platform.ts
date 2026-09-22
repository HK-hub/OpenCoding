/**
 * 平台与工程域 mock 数据：事件系统 / 持久化与恢复 / 工作区 / Git 与 Worktree。
 * 确定性生成：仅使用 Rng 与固定字面量，刷新一致；各实体之间以 id 互相引用。
 * 溯源：卷 16（事件）、卷 19（持久化）、卷 20（工作区）、卷 21（Git）；
 * BUILD-MANIFEST V-01…V-10 / Z-01…Z-11 / O-01…O-12 / I-01…I-13。
 */
import { Rng, REPOS, NAMES } from '../rng';

/* ------------------------------------------------------------------ 事件系统 */

/** 事件三分类：领域 / 系统 / 遥测（卷 16 D-EVT-1） */
export type EventCategory = 'domain' | 'system' | 'telemetry';
/** 发起者类型 */
export type ActorKind = 'user' | 'agent' | 'subagent' | 'plugin' | 'system' | 'external';
/** 敏感度：决定加密与访问（卷 16 §4.1） */
export type Sensitivity = 'normal' | 'internal' | 'sensitive';

/** 16 字段事件信封（eventId…schemaRef） */
export interface EventEnvelope {
  eventId: string;
  type: string;
  version: number;
  category: EventCategory;
  tenantId: string;
  projectId: string;
  partitionKey: string;
  seq: number;
  occurredAt: string;
  recordedAt: string;
  actor: { kind: ActorKind; id: string };
  trace: { traceId: string; spanId: string; parentSpanId: string | null };
  correlationId: string;
  payload: Record<string, unknown>;
  sensitivity: Sensitivity;
  schemaRef: string;
}

/** 审计类事件判定：audit.* 前缀 + 系统类安全事件（UI 显示 AUDIT 标记） */
export function isAuditEvent(e: EventEnvelope): boolean {
  return e.type.startsWith('audit.') || e.type.startsWith('sec.') || e.type.startsWith('permission.');
}

/** 事件域前缀（BUILD-MANIFEST §11 全 25 个） */
export const EVENT_DOMAINS = [
  'session', 'agent', 'model', 'context', 'prompt', 'tool', 'permission', 'sandbox',
  'skill', 'mcp', 'memory', 'kb', 'workitem', 'goal', 'schedule', 'team', 'workspace',
  'git', 'plugin', 'hook', 'system', 'audit', 'automation', 'ai', 'sec',
] as const;

export interface ConsumerLag {
  consumer: string;
  group: string;
  offset: number;
  lagSeconds: number;
  thresholdSeconds: number;
  trend: number[];
  note: string;
}

export interface DeadLetter {
  eventId: string;
  type: string;
  consumer: string;
  reason: string;
  attempts: number;
  firstFailedAt: string;
  lastFailedAt: string;
  replayable: boolean;
}

export interface WebhookDelivery {
  at: string;
  statusCode: number;
  durationMs: number;
  attempt: number;
  result: 'succeeded' | 'retrying' | 'dead_letter';
}

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  eventFilter: string[];
  signature: string;
  secretRef: string;
  maxRetries: number;
  status: 'enabled' | 'disabled' | 'degraded';
  deliveries: WebhookDelivery[];
  deadLetterCount: number;
}

export interface ExportJob {
  id: string;
  target: '对象存储' | '数据湖';
  format: 'parquet' | 'jsonl';
  range: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  rows: number;
  sizeBytes: number;
  startedAt: string;
  finishedAt: string | null;
  checksum: string;
}

export interface RetentionPolicy {
  eventClass: string;
  onlineDays: number;
  archiveTier: string;
  archiveFormat: string;
  deleteRule: string;
  legalHold: boolean;
}

export interface ReplayJob {
  replayId: string;
  kind: '投影重建' | '会话重放' | '环境重放' | '审计重放';
  scope: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PAUSED';
  progress: number;
  speed: string;
  cursor: string;
  sandboxId: string | null;
  discardable: boolean;
  sideEffectsSkipped: number;
  note: string;
}

/* --------------------------------------------------- 持久化 / 迁移 / 恢复 */

export interface DataDomain {
  domain: string;
  mainData: string;
  storage: string;
  writer: string;
  retention: string;
}

export interface Migration {
  version: string;
  name: string;
  checksum: string;
  forwardScript: string;
  reverseScript: string | null;
  backfillSteps: string[];
  destructive: boolean;
  rollbackable: boolean;
  status: 'draft' | 'applied' | 'failed' | 'rolled_back';
  durationMs: number;
  appliedAt: string | null;
  approvedBy: string;
}

export interface PipelineStage {
  stage: string;
  status: 'SUCCEEDED' | 'RUNNING' | 'FAILED' | 'SKIPPED' | 'PENDING';
  durationMs: number;
  evidence: string;
  note: string;
}

export interface BackupEntry {
  id: string;
  type: 'physical' | 'wal' | 'logical';
  at: string;
  ageSeconds: number;
  sizeBytes: number;
  walArchiveLagSeconds: number;
  verified: boolean;
  encrypted: boolean;
  location: string;
}

export interface RestoreDrill {
  id: string;
  at: string;
  scope: string;
  rpoSeconds: number;
  rtoSeconds: number;
  result: 'SUCCEEDED' | 'FAILED';
  reportRef: string;
  operator: string;
}

export interface RecoveryScan {
  id: string;
  scannedAt: string;
  unfinishedSessions: { sessionId: string; title: string; lastCheckpoint: string; lastEventSeq: number; recoverable: boolean }[];
  unfinishedTasks: { taskId: string; title: string; state: string; lastCheckpoint: string; recoverable: boolean; reason: string }[];
  unfinishedTeams: { teamId: string; name: string; members: number; dispatch: string; recoverable: boolean }[];
  lastCheckpointRef: string;
  recoverableItems: string[];
  needsHumanItems: string[];
  replaySegments: { segment: string; events: number; sideEffects: number }[];
  sideEffectLedgerSkipped: { entry: string; idempotencyKey: string; reason: string }[];
}

export interface ExportPackage {
  packageId: string;
  manifest: boolean;
  events: number;
  workitems: number;
  memory: number;
  artifacts: number;
  workspaceRefs: number;
  checksums: string;
  sizeBytes: number;
  redacted: boolean;
  missingRefs: string[];
}

export interface ConsistencyCheck {
  pair: string;
  method: string;
  driftCount: number;
  autoFix: boolean;
  lastRunAt: string;
  status: 'CONSISTENT' | 'DRIFT' | 'ALERT_ONLY';
  detail: string;
}

export interface DeletionLayer {
  layer: string;
  status: 'DONE' | 'PENDING' | 'FILTERED_ON_READ' | 'NOT_APPLICABLE';
  detail: string;
}

export interface DeletionProof {
  proofId: string;
  scope: string;
  executor: string;
  executedAt: string;
  layers: DeletionLayer[];
  evidenceRef: string;
  reversible: boolean;
}

/** 对象存储治理（三类命名空间） */
export interface ObjectNamespace {
  namespace: 'media' | 'artifacts' | 'snapshots';
  objects: number;
  bytes: number;
  hotBytes: number;
  coldBytes: number;
  dedupRatio: number;
  refCounted: boolean;
  encrypted: boolean;
  orphanCandidates: number;
  lifecycle: string;
}

export interface DrTopology {
  role: string;
  region: string;
  mode: string;
  replicationLagSeconds: number;
  status: 'HEALTHY' | 'LAGGING' | 'DEGRADED';
  crossRegionBackup: boolean;
}

/* ------------------------------------------------------------------ 工作区 */

export type WorkspaceType = 'local' | 'ssh' | 'container' | 'cloud';
export type WorkspaceStatus = 'created' | 'provisioning' | 'ready' | 'degraded' | 'suspended' | 'destroyed';

export interface WsCapabilities {
  fileOps: boolean;
  watch: boolean;
  oneshot: boolean;
  pty: boolean;
  isolationTier: string;
  snapshot: boolean;
  resourceLimit: boolean;
  offline: boolean;
  /** 连接复用（多路复用/持久连接池） */
  multiplex: boolean;
  /** 能力缺失时的显式降级说明（禁止静默降级） */
  fallbacks: { capability: string; fallback: string; note: string }[];
}

export interface EnvDiffItem {
  tool: string;
  expected: string;
  actual: string;
  severity: 'major' | 'minor' | 'ok';
  action: string;
}

export interface EnvProfile {
  languages: string[];
  toolchain: string[];
  packageManagers: string[];
  git: { branch: string; dirtyFiles: number; ahead: number; behind: number; gc: string; prune: string };
  resources: { cpuCores: number; memoryGb: number; diskFreeGb: number };
  probedAt: string;
  diffFromManifest: EnvDiffItem[];
}

export interface WorkspaceBinding {
  subjectId: string;
  subjectKind: string;
  role: 'primary' | 'related';
  writeScope: string[];
  crossGrant: string;
}

export interface ConnectionProfile {
  host: string;
  image: string;
  endpoint: string;
  jumpHost: string;
  credentialRef: string;
  timeoutMs: number;
  retries: number;
  tags: string[];
}

export interface WsCommand {
  commandId: string;
  mode: 'oneshot' | 'pty' | 'background';
  command: string;
  user: string;
  exitCode: number | null;
  durationMs: number;
  resourcePeak: string;
  outputTail: string[];
  at: string;
  handle: string | null;
}

export interface WsSnapshot {
  snapshotId: string;
  source: string;
  at: string;
  sizeBytes: number;
  dedupRatio: number;
  refCount: number;
  ttlDays: number;
  restoreGranularity: '会话级' | '任务级' | '单文件' | '单工具调用';
}

export interface ConnectionHealth {
  workspaceId: string;
  lastProbeAt: string;
  latencyMs: number;
  multiplexedChannels: number;
  reconnects24h: number;
  backoffAttempts: number;
  backoffCap: number;
  state: 'HEALTHY' | 'RECONNECTING' | 'AUTH_EXPIRED' | 'DOWN';
  note: string;
}

export interface Workspace {
  workspaceId: string;
  name: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  projectId: string;
  quota: {
    diskUsedRatio: number;
    cpu: number;
    memory: number;
    networkTraffic: string;
    inodeCount: number;
    limit: string;
    paused: boolean;
  };
  capabilities: WsCapabilities;
  envProfile: EnvProfile;
  bindings: WorkspaceBinding[];
  connectionProfile: ConnectionProfile;
  health: { heartbeatIntervalMs: number; reconnectBackoff: number; lastProbeAt: string };
  commands: WsCommand[];
  snapshots: WsSnapshot[];
}

/* ------------------------------------------------------------- Git/Worktree */

export interface GitRepo {
  repo: string;
  platform: 'github' | 'gitlab' | 'gitea' | 'internal';
  defaultBranch: string;
  sizeMb: number;
  commitGraph: boolean;
  partialClone: boolean;
  sparse: string;
  lfs: boolean;
  disabledByEnterprise: boolean;
}

export interface GitWorktree {
  worktreeId: string;
  taskId: string;
  repo: string;
  branch: string;
  path: string;
  status: 'ACTIVE' | 'MERGED_PENDING_CLEANUP' | 'CLEANED' | 'ORPHAN' | 'BLOCKED';
  sizeBytes: number;
  baseRevision: string;
  mergedAt: string | null;
  cleanupAt: string | null;
  dirty: boolean;
  writeScope: string[];
}

export interface MergeQueueEntry {
  id: string;
  branch: string;
  target: string;
  taskId: string;
  status: 'queued' | 'started' | 'completed' | 'conflict' | 'rejected';
  leaseOwner: string;
  leaseSeconds: number;
  baseRevision: string;
  replayResult: string;
  precheck: { result: 'passed' | 'failed' | 'running' | 'skipped'; logsRef: string; command: string };
  conflictFiles: string[];
  suggestions: string[];
  mergeStrategy: 'squash' | 'merge-commit' | 'rebase-then-merge';
  durationMs: number;
  rejectionReason: string;
}

export interface GitCommit {
  hash: string;
  type: 'feat' | 'fix' | 'refactor' | 'perf' | 'test' | 'docs' | 'chore' | 'build' | 'ci';
  scope: string;
  subject: string;
  body: string;
  trailers: {
    task: string;
    session: string;
    team: string;
    agent: { role: string; model: string };
    approval: string;
  };
  filesChanged: number;
  additions: number;
  deletions: number;
  coAuthoredBy: string;
  at: string;
}

export interface DangerOp {
  id: string;
  op: string;
  command: string;
  lastAt: string;
  lostCommits: { hash: string; subject: string; author: string }[];
  backupRef: string;
  confirmedBy: string;
  consequence: string;
  reversible: boolean;
  undoCommand: string;
}

export interface ScanHit {
  id: string;
  patternType: '密钥模式' | '大文件' | '敏感路径' | '依赖清单变更' | '证书文件';
  path: string;
  blocked: boolean;
  suggestion: string;
  blobHash: string;
  cached: boolean;
  at: string;
}

export interface GitReview {
  id: string;
  layer: '自审' | '团队审查' | '人类审查';
  reviewerRole: string;
  verdict: 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING' | 'REJECTED';
  comments: { file: string; line: number; text: string; severity: 'info' | 'minor' | 'major' }[];
  reflowedTaskId: string | null;
  at: string;
}

export interface UndoLogEntry {
  id: string;
  command: string;
  performedAt: string;
  restoredFrom: string;
  affected: string;
  ttlDays: number;
  status: 'AVAILABLE' | 'EXPIRED';
}

export interface LargeRepoPrep {
  repo: string;
  files: number;
  steps: { step: string; status: 'SUCCEEDED' | 'RUNNING' | 'PENDING'; detail: string }[];
  progress: number;
  etaSeconds: number;
  statusCheckMs: number;
}

export interface PlatformData {
  events: EventEnvelope[];
  eventJobs: {
    consumerLag: ConsumerLag[];
    deadLetters: DeadLetter[];
    webhookSubscriptions: WebhookSubscription[];
    exportJobs: ExportJob[];
    retentionPolicies: RetentionPolicy[];
  };
  replays: ReplayJob[];
  persistence: {
    domains: DataDomain[];
    migrations: Migration[];
    pipeline: PipelineStage[];
    backups: BackupEntry[];
    drills: RestoreDrill[];
    recoveryScans: RecoveryScan[];
    exportPackages: ExportPackage[];
    consistencyChecks: ConsistencyCheck[];
    deletionProofs: DeletionProof[];
    objectStore: ObjectNamespace[];
    drTopology: DrTopology[];
  };
  workspaces: Workspace[];
  capabilityMatrix: { capability: string; local: string; ssh: string; container: string; cloud: string }[];
  connectionHealth: ConnectionHealth[];
  commandAudit: { id: string; workspaceId: string; host: string; user: string; command: string; exitCode: number | null; resource: string; at: string; redacted: boolean }[];
  git: {
    repos: GitRepo[];
    worktrees: GitWorktree[];
    mergeQueue: MergeQueueEntry[];
    commits: GitCommit[];
    branchPolicy: { protected: string[]; perTaskBranch: boolean; stacked: boolean; naming: string; protectedRule: string };
    dangerOps: DangerOp[];
    scanHits: ScanHit[];
    reviews: GitReview[];
    undoLog: UndoLogEntry[];
    repoPrep: LargeRepoPrep;
  };
}

/* ---------------------------------------------------------------- 生成实现 */

type EvSpec = [type: string, category: EventCategory, sensitivity: Sensitivity, actor: ActorKind, payload: Record<string, unknown>];

const EVENT_SPECS: EvSpec[] = [
  ['session.created', 'domain', 'internal', 'user', { sessionId: 'S-1b2c', title: '重构计费对账链路', mode: 'default', workspaceId: 'ws-0001' }],
  ['session.runner.state.changed', 'domain', 'normal', 'agent', { sessionId: 'S-1b2c', from: 'running', to: 'awaiting_approval', reason: 'R3 推送待审批' }],
  ['session.fork.created', 'domain', 'internal', 'user', { sessionId: 'S-7f3a', fromSeq: 412, title: '对账分叉-快速修复' }],
  ['session.archived', 'domain', 'internal', 'user', { sessionId: 'S-3d91', retentionDays: 365, reason: '任务完成' }],
  ['agent.turn.started', 'domain', 'normal', 'agent', { turnId: 'T-77', sessionId: 'S-1b2c', step: 1, toolset: 'coding-core' }],
  ['agent.turn.completed', 'domain', 'normal', 'agent', { turnId: 'T-77', steps: 9, costUsd: 0.4132, tokens: 184320 }],
  ['agent.subagent.completed', 'domain', 'normal', 'subagent', { subagentId: 'SA-2', role: 'explorer', parentItemId: 'T-77', result: 'found 3 call sites' }],
  ['agent.loop_guard.tripped', 'system', 'internal', 'system', { sessionId: 'S-7f3a', guard: 'repeat_action', repeats: 4, action: 'limit reached' }],
  ['model.request.completed', 'telemetry', 'internal', 'system', { provider: 'anthropic', model: 'claude-sonnet-4.5', ttfbMs: 612, totalMs: 3120, cacheReadTokens: 40960, costUsd: 0.0284 }],
  ['model.error', 'system', 'internal', 'system', { provider: 'openai', model: 'gpt-5.1', code: 'RATE_LIMITED', retryable: true, retryIn: 3 }],
  ['model.usage.recorded', 'telemetry', 'internal', 'system', { sessionId: 'S-1b2c', inputTokens: 96320, outputTokens: 88000, costUsd: 0.4132 }],
  ['context.assembled', 'domain', 'internal', 'agent', { sessionId: 'S-1b2c', segments: 9, tokens: 18340, watermark: 0.62 }],
  ['context.compacted', 'domain', 'internal', 'agent', { sessionId: 'S-1b2c', level: 'L2', beforeTokens: 42100, afterTokens: 9800, fidelity: 'preserved' }],
  ['context.snapshot.restored', 'domain', 'internal', 'system', { sessionId: 'S-1b2c', checkpointRef: 'ckpt-9f21', sideEffectsSkipped: 2 }],
  ['prompt.asset.published', 'domain', 'normal', 'user', { assetId: 'pa-31', version: 12, hash: 'sha256:7f3a91', evaluation: 'Y-01 gate passed' }],
  ['prompt.asset.rollback', 'domain', 'internal', 'user', { assetId: 'pa-31', fromVersion: 12, toVersion: 11, reason: '评测回归失败' }],
  ['tool.call.completed', 'telemetry', 'normal', 'agent', { tool: 'fs.write', risk: 'R1', durationMs: 42, bytes: 1284, externalized: false }],
  ['tool.call.blocked', 'domain', 'sensitive', 'system', { tool: 'shell.exec', risk: 'R4', command: 'rm -rf ./dist', reason: '危险命令规则命中' }],
  ['tool.result.externalized', 'telemetry', 'normal', 'system', { tool: 'repo.search', bytes: 482103, artifactRef: 'artifact://a-7f21', reason: '结果超阈值外置' }],
  ['permission.decision', 'domain', 'sensitive', 'system', { decisionId: 'pd-4f21', action: 'git push --force-with-lease', risk: 'R4', decision: 'ASK', policyVersion: 'pol-118' }],
  ['permission.approval.granted', 'domain', 'internal', 'user', { approvalId: 'ar-4f21', scope: 'session', action: 'git push', ttlSeconds: 7200 }],
  ['permission.approval.denied', 'domain', 'internal', 'user', { approvalId: 'ar-4f2b', scope: 'once', action: 'deploy.prod', reason: '未经变更窗口' }],
  ['permission.policy.updated', 'domain', 'sensitive', 'user', { policyId: 'pol-118', layer: 'organization', change: '禁用 push --force', requiresReverify: true }],
  ['sandbox.selected', 'domain', 'internal', 'system', { tool: 'shell.exec', targetTier: 'L1', actualTier: 'L1', fallback: false }],
  ['sandbox.violation', 'system', 'sensitive', 'system', { sessionId: 'S-7f3a', kind: 'network', target: 'pypi.internal', action: 'DENIED', normalizedPath: '/workspace/app' }],
  ['sandbox.degraded', 'system', 'internal', 'system', { platform: 'windows', requested: 'L2', actual: 'L1', reason: '平台无内核级隔离' }],
  ['skill.activated', 'domain', 'normal', 'agent', { skillId: 'sk-17', name: 'gateway-data-sync', mode: 'suggested', tokens: 1840 }],
  ['skill.install.blocked', 'domain', 'internal', 'system', { skillId: 'sk-42', reason: '签名校验失败', requestedCapability: 'network:any' }],
  ['mcp.server.state.changed', 'domain', 'normal', 'system', { serverId: 'mcp-3', from: 'Starting', to: 'Degraded', latencyMs: 1840, errorRate: 0.12 }],
  ['mcp.tool.discovered', 'domain', 'normal', 'plugin', { serverId: 'mcp-3', tools: 12, namespace: 'mcp__mongo', riskHints: 2 }],
  ['memory.written', 'domain', 'internal', 'agent', { key: 'project.build.command', scope: 'project', confidence: 0.86, source: 'session S-1b2c' }],
  ['memory.conflict.detected', 'domain', 'internal', 'system', { key: 'project.test.framework', kind: 'sameKeyDifferentValue', existing: 'vitest', incoming: 'jest' }],
  ['memory.forgotten', 'domain', 'sensitive', 'user', { key: 'project.user.email', deletionScope: 'compliance', proofRef: 'del-2f11' }],
  ['kb.query.executed', 'telemetry', 'normal', 'agent', { query: 'worktree 合并队列', channels: ['fulltext', 'vector', 'symbol'], latencyMs: 186, degraded: false }],
  ['kb.index.lagging', 'system', 'internal', 'system', { sourceId: 'ks-04', lagSeconds: 932, chunks: 184320, resumePoint: 'main@9f21ab' }],
  ['workitem.state.changed', 'domain', 'normal', 'agent', { taskId: 'T-7f3a', from: 'RUNNING', to: 'VERIFYING', acceptance: '3/5' }],
  ['workitem.evidence.attached', 'domain', 'normal', 'agent', { taskId: 'T-7f3a', level: 'L2', kind: 'test-run', artifactRef: 'artifact://a-31c0' }],
  ['goal.created', 'domain', 'normal', 'user', { goalId: 'G-2f11', statement: '把对账差异率降到 0.1% 以下', autonomy: 'collaborate', budgetUsd: 40 }],
  ['goal.drift.detected', 'system', 'internal', 'system', { goalId: 'G-2f11', evidence: 'semantic_similarity 0.41', threshold: 0.6, action: 'report_only' }],
  ['goal.achieved', 'domain', 'normal', 'system', { goalId: 'G-2f11', acceptance: '5/5', costUsd: 12.42 }],
  ['schedule.triggered', 'domain', 'normal', 'system', { scheduleId: 'SC-7', trigger: 'cron 0 3 * * *', runId: 'run-88', idempotencyKey: 'sc7-20260921' }],
  ['schedule.circuit_open', 'system', 'internal', 'system', { scheduleId: 'SC-9', consecutiveFailures: 3, action: 'circuit open, notify owner' }],
  ['team.created', 'domain', 'normal', 'user', { teamId: 'TM-9d', topology: '主管+3 成员', budgetUsd: 120, template: 'feature-delivery' }],
  ['team.task.assigned', 'domain', 'normal', 'agent', { teamId: 'TM-9d', taskId: 'T-7f3a', member: 'member-frontend', worktreeId: 'wt-0003' }],
  ['team.budget.alert', 'system', 'internal', 'system', { teamId: 'TM-9d', usedRatio: 0.82, burnRatePerHour: 4.2, action: 'degrade routing' }],
  ['workspace.created', 'domain', 'internal', 'user', { workspaceId: 'ws-0002', type: 'ssh', host: 'build-01.internal', isolation: 'L0' }],
  ['workspace.env.drift.detected', 'domain', 'internal', 'system', { workspaceId: 'ws-0003', missing: ['pnpm@9.12'], extra: ['npm@10.8'], severity: 'major' }],
  ['workspace.quota.exceeded', 'system', 'internal', 'system', { workspaceId: 'ws-0003', resource: 'disk', usedRatio: 0.92, action: 'pause new commands' }],
  ['workspace.command.completed', 'telemetry', 'internal', 'system', { workspaceId: 'ws-0001', mode: 'oneshot', command: 'pnpm test --run', exitCode: 0, durationMs: 48210, resourcePeak: 'cpu 3.2 / mem 1.8GB' }],
  ['git.commit.created', 'domain', 'normal', 'agent', { hash: '9f21ab4', type: 'fix', scope: 'reconcile', filesChanged: 6, trailers: 'task=T-7f3a session=S-1b2c' }],
  ['git.merge.conflict', 'domain', 'internal', 'system', { mergeId: 'mq-5', branch: 'oc/T-7f3a-reconcile', conflictFiles: ['src/reconcile/ledger.ts', 'src/reconcile/index.ts'] }],
  ['git.worktree.created', 'domain', 'normal', 'system', { worktreeId: 'wt-0003', taskId: 'T-7f3a', branch: 'oc/T-7f3a-reconcile', base: 'main@9f21ab4' }],
  ['git.secret_scan.blocked', 'system', 'sensitive', 'system', { patternType: '密钥模式', path: 'config/aliyun.ak.json', blobHash: 'blob-7f21', blocked: true }],
  ['git.force_push.blocked', 'system', 'sensitive', 'system', { branch: 'main', reason: '受保护分支默认禁止强推', policyId: 'pol-118' }],
  ['plugin.loaded', 'domain', 'normal', 'plugin', { pluginId: 'pl-06', version: '1.2.0', signature: 'verified', extensionPoints: 3 }],
  ['plugin.circuit_open', 'system', 'internal', 'system', { pluginId: 'pl-11', errorRate: 0.42, isolated: true, since: '2026-09-20T11:20:00Z' }],
  ['hook.executed', 'domain', 'normal', 'plugin', { hookId: 'hk-03', point: 'pre_tool_use', verdict: 'allow', durationMs: 18 }],
  ['hook.blocked', 'domain', 'internal', 'plugin', { hookId: 'hk-07', point: 'pre_commit', reason: '提交消息缺少任务尾注', failurePolicy: 'fail_closed' }],
  ['system.ready', 'system', 'normal', 'system', { mode: 'server', db: 'postgresql', redis: 'connected', degradeTier: 'normal' }],
  ['system.eventlog.consumer.lag', 'system', 'internal', 'system', { consumer: '审计投影', lagSeconds: 194, threshold: 120, severity: 'WARN' }],
  ['system.eventlog.schema.rejected', 'system', 'internal', 'system', { type: 'workitem.state.changed', version: 3, reason: '缺少必填字段 acceptance' }],
  ['system.eventlog.deadletter', 'system', 'internal', 'system', { consumer: '知识挖掘', eventId: 'evt-d1', attempts: 6 }],
  ['system.eventlog.archive.completed', 'system', 'normal', 'system', { from: '2025-08-01', to: '2025-08-31', bytes: 18432000000, format: 'parquet+zstd' }],
  ['system.migration.failed', 'system', 'internal', 'system', { version: 'V2026.09.12', stage: '样本库迁移', reason: '回填脚本超时', rollback: '已执行逆向脚本' }],
  ['system.backup.completed', 'system', 'normal', 'system', { type: '物理备份', bytes: 96468992, durationMs: 184000, verified: true }],
  ['system.recovery.scan.completed', 'system', 'internal', 'system', { scanId: 'rec-2f11', unfinished: 5, recoverable: 4, needsHuman: 1 }],
  ['system.consistency.check.completed', 'system', 'internal', 'system', { checked: 6, drift: 1, autoFixed: 0, alertOnly: 1 }],
  ['system.retention.purged', 'system', 'normal', 'system', { scope: '遥测事件', rows: 18432000, tier: 'online → cold' }],
  ['audit.export.completed', 'domain', 'internal', 'user', { exportId: 'ae-3', range: '2026-08-01..2026-09-01', format: 'JSONL', hashChainVerified: true }],
  ['audit.compliance.delete.executed', 'domain', 'sensitive', 'user', { proofId: 'del-2f11', scope: '记忆条目 project.user.email', layers: 6, executor: '合规官 · 林晚照' }],
  ['audit.chain.verify.failed', 'system', 'sensitive', 'system', { fromSeq: 128420, reason: '哈希链断点', action: '仅告警（不可自动修复）' }],
  ['automation.template.installed', 'domain', 'normal', 'user', { templateId: 'at-12', version: '2.1.0', inputs: 4, risk: 'R2' }],
  ['automation.run.escalated', 'domain', 'internal', 'system', { runId: 'run-91', reason: 'BLOCKED 等待人工接管', slaMinutes: 30 }],
  ['ai.draft.generated', 'domain', 'normal', 'agent', { draftId: 'dr-7', kind: 'pr-description', citations: 6, costUsd: 0.021, needsReview: true }],
  ['ai.review.finding', 'domain', 'normal', 'agent', { findingId: 'fd-21', ruleId: 'security/no-hardcoded-secret', severity: 'major', confidence: 0.92 }],
  ['sec.override.denied', 'domain', 'sensitive', 'system', { action: 'shell.exec sudo systemctl restart', reason: '提权命令在 SSH 工作区禁止', layer: 'decision-chain' }],
  ['sec.bypass.detected', 'system', 'sensitive', 'system', { sessionId: 'S-7f3a', technique: '路径穿越尝试', path: '../../etc/passwd', action: '冻结会话 + 告警' }],
  ['sec.vulnerability.detected', 'system', 'sensitive', 'external', { cve: 'CVE-2026-31841', package: 'lodash@4.17.20', slaHours: 24, source: 'SCA scan' }],
];

function buildEvents(r: Rng): EventEnvelope[] {
  const partitions = ['S-1b2c', 'S-7f3a', 'S-3d91', 'TM-9d', 'G-2f11', 'PRJ-payment-core'];
  const seqByPartition = new Map<string, number>();
  const projects = ['PRJ-payment-core', 'PRJ-identity-gateway', 'PRJ-data-pipeline', 'PRJ-web-console'];

  return EVENT_SPECS.map((spec, i) => {
    const [type, category, sensitivity, actor, payload] = spec;
    const partition = partitions[i % partitions.length];
    const seq = (seqByPartition.get(partition) ?? 128400) + r.int(1, 4);
    seqByPartition.set(partition, seq);
    const occurredMinutes = 720 - i * 7 - r.int(0, 4);
    const occurredAt = r.ago(occurredMinutes);
    const recordedAt = new Date(new Date(occurredAt).getTime() + r.int(4, 90)).toISOString();
    const schemaVersion = type.startsWith('system.eventlog') || type === 'workitem.state.changed' ? 3 : r.pick([1, 1, 2, 2, 3]);
    return {
      eventId: r.uuid(i),
      type,
      version: schemaVersion,
      category,
      tenantId: 'tn-云枢科技',
      projectId: projects[i % projects.length],
      partitionKey: partition,
      seq,
      occurredAt,
      recordedAt,
      actor: {
        kind: actor,
        id: actor === 'user' ? r.pick(NAMES) : actor === 'system' ? 'kernel' : `${actor}-${r.pick(['impl', 'explore', 'verify'])}`,
      },
      trace: {
        traceId: `trace-${(i + 1).toString(16).padStart(4, '0')}${r.int(0x1000, 0xffff).toString(16)}`,
        spanId: `span-${r.int(0x1000, 0xffff).toString(16)}`,
        parentSpanId: i % 5 === 0 ? null : `span-${r.int(0x1000, 0xffff).toString(16)}`,
      },
      correlationId: String(payload.approvalId ?? payload.taskId ?? payload.sessionId ?? payload.workspaceId ?? payload.goalId ?? partition),
      payload,
      sensitivity,
      schemaRef: `schema://oc/${type.replace(/\./g, '/')}@v${schemaVersion}`,
    } satisfies EventEnvelope;
  });
}

/** 8 类消费者（卷 16 §4.5） */
const CONSUMER_LAG: ConsumerLag[] = [
  { consumer: '会话投影', group: 'proj-session', offset: 128432, lagSeconds: 2, thresholdSeconds: 30, trend: [4, 3, 2, 3, 2, 2, 3, 2], note: '健康' },
  { consumer: '任务投影', group: 'proj-workitem', offset: 128428, lagSeconds: 6, thresholdSeconds: 30, trend: [8, 6, 9, 7, 6, 5, 6, 6], note: '健康' },
  { consumer: '计量投影', group: 'proj-usage', offset: 128410, lagSeconds: 21, thresholdSeconds: 60, trend: [12, 15, 18, 22, 25, 23, 21, 21], note: '缓存折扣回填导致轻微堆积' },
  { consumer: '审计投影', group: 'proj-audit', offset: 128221, lagSeconds: 194, thresholdSeconds: 120, trend: [40, 62, 88, 120, 150, 176, 188, 194], note: '超阈值：审批事件量激增' },
  { consumer: '前端推送', group: 'push-frames', offset: 128432, lagSeconds: 1, thresholdSeconds: 5, trend: [1, 1, 2, 1, 1, 1, 1, 1], note: '按 seq 断线续传' },
  { consumer: '记忆挖掘', group: 'mine-memory', offset: 127980, lagSeconds: 452, thresholdSeconds: 300, trend: [120, 180, 260, 330, 390, 420, 440, 452], note: '超阈值：批量窗口任务占用' },
  { consumer: '知识挖掘', group: 'mine-kb', offset: 128302, lagSeconds: 38, thresholdSeconds: 120, trend: [30, 36, 44, 40, 38, 41, 39, 38], note: '有 1 条死信待重放' },
  { consumer: '评测采集', group: 'mine-eval', offset: 128109, lagSeconds: 96, thresholdSeconds: 180, trend: [70, 78, 88, 92, 95, 97, 96, 96], note: '采样 10%（延迟类）' },
];

const DEAD_LETTERS: DeadLetter[] = [
  { eventId: 'evt-d1', type: 'kb.query.executed', consumer: '知识挖掘', reason: '解析失败：chunk 引用缺失 kb://ks-04#c-91', attempts: 6, firstFailedAt: '2026-09-21T02:14:00Z', lastFailedAt: '2026-09-21T06:40:00Z', replayable: true },
  { eventId: 'evt-d2', type: 'workitem.state.changed', consumer: '任务投影', reason: 'Schema v3 校验失败：缺少 acceptance 字段', attempts: 3, firstFailedAt: '2026-09-20T22:10:00Z', lastFailedAt: '2026-09-21T05:02:00Z', replayable: false },
  { eventId: 'evt-d3', type: 'permission.decision', consumer: '审计投影', reason: '投影写入冲突：决策 ID 重复（幂等键命中后仍重试）', attempts: 4, firstFailedAt: '2026-09-21T01:22:00Z', lastFailedAt: '2026-09-21T04:55:00Z', replayable: true },
  { eventId: 'evt-d4', type: 'git.secret_scan.blocked', consumer: 'Webhook 投递', reason: '接收端 5xx（3 次）后进入死信', attempts: 5, firstFailedAt: '2026-09-20T18:31:00Z', lastFailedAt: '2026-09-21T03:12:00Z', replayable: true },
];

const WEBHOOK_SUBSCRIPTIONS: WebhookSubscription[] = [
  {
    id: 'wh-01', name: 'SIEM 安全事件通道', url: 'https://siem.云枢科技.internal/ingest/oc', eventFilter: ['sec.*', 'permission.*', 'audit.*'],
    signature: 'HMAC-SHA256', secretRef: 'secret://tenant/webhook-siem', maxRetries: 5, status: 'enabled', deadLetterCount: 1,
    deliveries: [
      { at: '2026-09-21T07:02:00Z', statusCode: 200, durationMs: 188, attempt: 1, result: 'succeeded' },
      { at: '2026-09-21T06:14:00Z', statusCode: 200, durationMs: 240, attempt: 2, result: 'succeeded' },
      { at: '2026-09-21T03:12:00Z', statusCode: 503, durationMs: 3000, attempt: 5, result: 'dead_letter' },
    ],
  },
  {
    id: 'wh-02', name: '数据湖增量导出通知', url: 'https://lakehouse.云枢科技.internal/hooks/oc-events', eventFilter: ['system.eventlog.archive.*', 'system.retention.purged'],
    signature: 'HMAC-SHA256', secretRef: 'secret://tenant/webhook-lake', maxRetries: 3, status: 'enabled', deadLetterCount: 0,
    deliveries: [
      { at: '2026-09-21T04:00:00Z', statusCode: 200, durationMs: 96, attempt: 1, result: 'succeeded' },
      { at: '2026-09-20T04:00:00Z', statusCode: 200, durationMs: 88, attempt: 1, result: 'succeeded' },
    ],
  },
  {
    id: 'wh-03', name: 'IM 群机器人（事故通报）', url: 'https://im-gateway.internal/oc/p0-alerts', eventFilter: ['goal.drift.detected', 'system.migration.failed', 'sec.bypass.detected'],
    signature: 'HMAC-SHA256', secretRef: 'secret://tenant/im-bot', maxRetries: 5, status: 'degraded', deadLetterCount: 1,
    deliveries: [
      { at: '2026-09-21T06:41:00Z', statusCode: 429, durationMs: 640, attempt: 3, result: 'retrying' },
      { at: '2026-09-21T06:38:00Z', statusCode: 429, durationMs: 520, attempt: 2, result: 'retrying' },
      { at: '2026-09-21T05:20:00Z', statusCode: 200, durationMs: 210, attempt: 1, result: 'succeeded' },
    ],
  },
  {
    id: 'wh-04', name: 'CI 触发通道', url: 'https://ci.云枢科技.internal/trigger', eventFilter: ['git.merge.completed', 'git.merge.rejected'],
    signature: 'HMAC-SHA256', secretRef: 'secret://tenant/ci-token', maxRetries: 5, status: 'disabled', deadLetterCount: 0,
    deliveries: [{ at: '2026-09-18T09:12:00Z', statusCode: 0, durationMs: 0, attempt: 1, result: 'dead_letter' }],
  },
];

const EXPORT_JOBS: ExportJob[] = [
  { id: 'ex-01', target: '数据湖', format: 'parquet', range: '2026-09-01..2026-09-21（领域事件）', status: 'SUCCEEDED', rows: 18420320, sizeBytes: 4187599360, startedAt: '2026-09-21T04:00:00Z', finishedAt: '2026-09-21T04:22:00Z', checksum: 'sha256:4f2a…91c0' },
  { id: 'ex-02', target: '对象存储', format: 'jsonl', range: '2026-09-18..2026-09-20（审计事件）', status: 'SUCCEEDED', rows: 412088, sizeBytes: 96468992, startedAt: '2026-09-21T04:00:00Z', finishedAt: '2026-09-21T04:03:00Z', checksum: 'sha256:7b31…2ea4' },
  { id: 'ex-03', target: '数据湖', format: 'parquet', range: '2026-08-01..2026-08-31（遥测样本 10%）', status: 'RUNNING', rows: 9421820, sizeBytes: 2147483648, startedAt: '2026-09-21T07:10:00Z', finishedAt: null, checksum: '—' },
  { id: 'ex-04', target: '对象存储', format: 'jsonl', range: '2026-09-21（会话 S-7f3a 复现包事件）', status: 'FAILED', rows: 0, sizeBytes: 0, startedAt: '2026-09-21T03:40:00Z', finishedAt: '2026-09-21T03:41:00Z', checksum: '—' },
];

const RETENTION_POLICIES: RetentionPolicy[] = [
  { eventClass: '领域事件（domain）', onlineDays: 365, archiveTier: '冷归档（Parquet + zstd）', archiveFormat: 'parquet', deleteRule: '合规删除穿透（生成删除证明）', legalHold: true },
  { eventClass: '系统事件（system）', onlineDays: 365, archiveTier: '冷归档', archiveFormat: 'parquet', deleteRule: '超期归档，按租户策略清理', legalHold: false },
  { eventClass: '遥测事件（telemetry）', onlineDays: 30, archiveTier: '聚合后丢弃原始', archiveFormat: 'aggregate', deleteRule: '自动删除（聚合结果保留 3 年）', legalHold: false },
  { eventClass: '审计事件（audit/sec/permission）', onlineDays: 1095, archiveTier: '不可变存储（WORM）', archiveFormat: 'jsonl+zstd', deleteRule: '仅按法规要求，需双人复核', legalHold: true },
];

const REPLAYS: ReplayJob[] = [
  { replayId: 'rp-01', kind: '投影重建', scope: '会话投影 · 全量（从 2026-08-01 快照起）', status: 'SUCCEEDED', progress: 100, speed: '最大', cursor: 'seq 128432', sandboxId: null, discardable: false, sideEffectsSkipped: 0, note: '只写投影，无副作用' },
  { replayId: 'rp-02', kind: '会话重放', scope: '会话 S-1b2c（重建最终呈现，不重建逐字动画）', status: 'RUNNING', progress: 62, speed: '8×', cursor: 'seq 128218 / 128432', sandboxId: null, discardable: false, sideEffectsSkipped: 0, note: '支持跳转到任意 seq 与变速' },
  { replayId: 'rp-03', kind: '环境重放', scope: '任务 T-7f3a 的工具调用（沙箱 ws-0004 隔离）', status: 'RUNNING', progress: 34, speed: '实时', cursor: 'toolCall 12/38', sandboxId: 'ws-0004', discardable: true, sideEffectsSkipped: 7, note: '写操作按副作用账本模拟，读操作真实执行，沙箱可丢弃' },
  { replayId: 'rp-04', kind: '审计重放', scope: '审批 ar-4f21 决策链重放（策略版本 pol-118）', status: 'SUCCEEDED', progress: 100, speed: '最大', cursor: 'decision pd-4f21', sandboxId: null, discardable: false, sideEffectsSkipped: 0, note: '重放一致性：一致（决策与历史相同）' },
  { replayId: 'rp-05', kind: '环境重放', scope: '会话 S-7f3a 回归（沙箱已丢弃）', status: 'FAILED', progress: 71, speed: '实时', cursor: 'toolCall 27/38', sandboxId: 'ws-0007', discardable: true, sideEffectsSkipped: 4, note: '失败：沙箱内缺少 internal registry 网络白名单' },
];

/* ------------------------------------------------------------- 持久化数据 */

const DOMAINS: DataDomain[] = [
  { domain: '事件日志', mainData: '领域/系统/遥测事件', storage: 'PG 分区表 + 冷存归档', writer: '事件系统', retention: '领域 1 年+；遥测 30 天' },
  { domain: '会话与条目', mainData: '会话、轮次、条目索引、读模型', storage: 'PG（投影表）', writer: '会话域', retention: '随租户策略' },
  { domain: '检查点', mainData: '检查点元数据 + 摘要', storage: 'PG + 对象存储（大对象）', writer: '上下文域', retention: '随会话' },
  { domain: '任务/计划/目标', mainData: 'WorkItem、依赖、证据', storage: 'PG', writer: '工作对象域', retention: '长期' },
  { domain: '团队', mainData: '团队、成员、消息、黑板', storage: 'PG', writer: 'Teams 域', retention: '长期' },
  { domain: '权限与审计', mainData: '策略、授权记忆、决策轨迹、审批', storage: 'PG（只追加为主）', writer: '权限域', retention: '审计 3 年+' },
  { domain: '计量与成本', mainData: '用量聚合、账单', storage: 'PG（聚合表）', writer: '计量域', retention: '3 年' },
  { domain: '记忆', mainData: '记忆条目与版本', storage: 'PG + 文件（项目/组织层）', writer: '记忆域', retention: '按条目 TTL' },
  { domain: '知识', mainData: '文档元数据、块、索引、图边', storage: 'PG（+ 可选专用引擎）', writer: '知识域', retention: '随源' },
  { domain: '提示词/Skill/插件', mainData: '资产、包、清单、版本', storage: 'PG + 文件 + 对象存储', writer: '各自域', retention: '长期' },
  { domain: '工作区与 Git 引用', mainData: '工作区定义、连接、快照清单', storage: 'PG + 对象存储', writer: '工作区域', retention: '随租户' },
  { domain: '媒体与工件', mainData: '上传媒体、工具外置结果', storage: '对象存储（内容寻址）', writer: '多域（经统一服务）', retention: '引用计数 + TTL' },
  { domain: '运行态', mainData: '热态、锁、限流、队列、订阅位点', storage: 'Redis（可降级进程内）', writer: '各域（经端口）', retention: '秒~小时级' },
  { domain: '配置与密钥', mainData: '配置版本、密钥引用', storage: '配置文件 + PG + KMS', writer: '平台域', retention: '版本化' },
];

const MIGRATIONS: Migration[] = [
  { version: 'V2026.06.01', name: '创建事件分区表 event_log', checksum: 'sha256:1a2b…90ff', forwardScript: 'V2026.06.01__create_event_log.sql', reverseScript: 'R2026.06.01__drop_event_log.sql', backfillSteps: [], destructive: false, rollbackable: true, status: 'applied', durationMs: 1840, appliedAt: '2026-06-01T09:12:00Z', approvedBy: '沈亦舟（平台）' },
  { version: 'V2026.06.18', name: '会话投影表增加 runner_state', checksum: 'sha256:2b31…77c2', forwardScript: 'V2026.06.18__add_runner_state.sql', reverseScript: null, backfillSteps: ['按事件重放回填历史 runner_state'], destructive: false, rollbackable: false, status: 'applied', durationMs: 9600, appliedAt: '2026-06-18T20:02:00Z', approvedBy: '周砚青（会话域）' },
  { version: 'V2026.07.02', name: '工作区表拆出连接配置 connection_profile', checksum: 'sha256:3c47…1a04', forwardScript: 'V2026.07.02__split_connection_profile.sql', reverseScript: 'R2026.07.02__merge_connection_profile.sql', backfillSteps: ['回填 8 个工作区的连接字段', '抽样比对 20 条连接探活'], destructive: false, rollbackable: true, status: 'applied', durationMs: 24800, appliedAt: '2026-07-02T22:40:00Z', approvedBy: '陆知微（工作区域）' },
  { version: 'V2026.07.19', name: '记忆条目增加 review_at 与敏感级', checksum: 'sha256:4d58…3b86', forwardScript: 'V2026.07.19__memory_review_sensitivity.sql', reverseScript: null, backfillSteps: ['按 TTL 推导 review_at'], destructive: false, rollbackable: false, status: 'applied', durationMs: 12400, appliedAt: '2026-07-19T21:15:00Z', approvedBy: '苏慕言（记忆域）' },
  { version: 'V2026.08.03', name: '计量聚合表分区（按月）', checksum: 'sha256:5e69…4c18', forwardScript: 'V2026.08.03__usage_monthly_partition.sql', reverseScript: null, backfillSteps: ['重建 2026-01 起聚合分区'], destructive: false, rollbackable: false, status: 'applied', durationMs: 184000, appliedAt: '2026-08-03T23:50:00Z', approvedBy: '方岑溪（计量域）' },
  { version: 'V2026.08.21', name: '审计决策轨迹增加哈希链列', checksum: 'sha256:6f7a…5d2b', forwardScript: 'V2026.08.21__audit_hash_chain.sql', reverseScript: null, backfillSteps: ['按 seq 顺序重算哈希链', '链校验抽样 1000 条'], destructive: false, rollbackable: false, status: 'applied', durationMs: 362000, appliedAt: '2026-08-21T20:30:00Z', approvedBy: '贺清尘（合规）' },
  { version: 'V2026.09.01', name: '任务表增加验收进度 acceptance', checksum: 'sha256:7a8b…6e3c', forwardScript: 'V2026.09.01__workitem_acceptance.sql', reverseScript: 'R2026.09.01__drop_acceptance.sql', backfillSteps: ['由证据表聚合回填'], destructive: false, rollbackable: true, status: 'applied', durationMs: 72400, appliedAt: '2026-09-01T19:05:00Z', approvedBy: '顾清和（工作对象域）' },
  { version: 'V2026.09.08', name: '对象存储引用计数表', checksum: 'sha256:8b9c…7f4d', forwardScript: 'V2026.09.08__object_refcount.sql', reverseScript: null, backfillSteps: ['扫描三类命名空间重建计数'], destructive: false, rollbackable: false, status: 'applied', durationMs: 480000, appliedAt: '2026-09-08T22:18:00Z', approvedBy: '陆知微（工作区域）' },
  { version: 'V2026.09.12', name: '收缩旧列 session.legacy_mode（expand-contract 第三阶段）', checksum: 'sha256:9cad…80ee', forwardScript: 'V2026.09.12__contract_legacy_mode.sql', reverseScript: 'R2026.09.12__restore_legacy_mode.sql', backfillSteps: ['校验读路径全部切到 mode', '观察期 7 天无读旧列'], destructive: true, rollbackable: true, status: 'rolled_back', durationMs: 21600, appliedAt: '2026-09-12T21:40:00Z', approvedBy: '沈亦舟（平台）+ 变更委员会' },
  { version: 'V2026.09.15', name: '事件表按租户三级分区（性能）', checksum: 'sha256:adbe…91ff', forwardScript: 'V2026.09.15__event_tenant_partition.sql', reverseScript: null, backfillSteps: ['新建分区并分批搬迁', '搬迁后行数与校验和比对'], destructive: false, rollbackable: false, status: 'applied', durationMs: 942000, appliedAt: '2026-09-15T23:10:00Z', approvedBy: '沈亦舟（平台）' },
  { version: 'V2026.09.20', name: '删除废弃索引 idx_event_payload_gin', checksum: 'sha256:bcef…a200', forwardScript: 'V2026.09.20__drop_event_payload_idx.sql', reverseScript: 'R2026.09.20__recreate_event_payload_idx.sql', backfillSteps: [], destructive: true, rollbackable: true, status: 'applied', durationMs: 3200, appliedAt: '2026-09-20T20:00:00Z', approvedBy: '沈亦舟（平台）' },
  { version: 'V2026.09.24', name: '工作区快照清单增加 restore_granularity', checksum: 'sha256:cdf0…b311', forwardScript: 'V2026.09.24__snapshot_granularity.sql', reverseScript: null, backfillSteps: ['默认回填「会话级」'], destructive: false, rollbackable: false, status: 'draft', durationMs: 0, appliedAt: null, approvedBy: '待评审（工作区域）' },
  { version: 'V2026.09.26', name: '合规删除证明表 deletion_proof', checksum: 'sha256:de01…c422', forwardScript: 'V2026.09.26__deletion_proof.sql', reverseScript: null, backfillSteps: ['由审计事件回填近 90 天证明'], destructive: false, rollbackable: false, status: 'failed', durationMs: 186000, appliedAt: '2026-09-26T21:30:00Z', approvedBy: '贺清尘（合规）' },
];

const PIPELINE: PipelineStage[] = [
  { stage: 'CI 静态校验', status: 'SUCCEEDED', durationMs: 4200, evidence: '命名/校验和/破坏性标记检查通过；无应用代码引用', note: '破坏性操作需显式标记 destructive=true' },
  { stage: '空库迁移', status: 'SUCCEEDED', durationMs: 18400, evidence: '产物 Schema 与目标模型 diff 为空', note: '从零重建全量迁移链' },
  { stage: '样本库迁移', status: 'SUCCEEDED', durationMs: 96000, evidence: '脱敏生产样本 20 万行迁移成功，无锁等待超时', note: '限速 500 行/秒，可暂停' },
  { stage: '迁移后回归', status: 'RUNNING', durationMs: 142000, evidence: '核心读路径 12/18 通过；一致性校验待跑', note: '读路径 + 六类一致性校验' },
  { stage: '回滚演练', status: 'PENDING', durationMs: 0, evidence: '待执行逆向脚本（V2026.09.24 声明可回滚）', note: '不可回滚迁移需走审批' },
  { stage: '合入与部署', status: 'PENDING', durationMs: 0, evidence: '待生成迁移包', note: '先兼容代码后迁移（expand-contract）' },
];

const BACKUPS: BackupEntry[] = [
  { id: 'bk-01', type: 'physical', at: '2026-09-21T07:00:00Z', ageSeconds: 1860, sizeBytes: 96468992, walArchiveLagSeconds: 2, verified: true, encrypted: true, location: '对象存储 oc-backup/primary/pg-basebackup' },
  { id: 'bk-02', type: 'wal', at: '2026-09-21T07:29:00Z', ageSeconds: 240, sizeBytes: 18432000, walArchiveLagSeconds: 2, verified: true, encrypted: true, location: '对象存储 oc-backup/primary/wal' },
  { id: 'bk-03', type: 'logical', at: '2026-09-20T03:00:00Z', ageSeconds: 101400, sizeBytes: 41313894, walArchiveLagSeconds: 2, verified: true, encrypted: true, location: '对象存储 oc-backup/logical/oc-20260920.dump' },
  { id: 'bk-04', type: 'physical', at: '2026-09-14T07:00:00Z', ageSeconds: 606000, sizeBytes: 91815936, walArchiveLagSeconds: 490, verified: false, encrypted: true, location: '对象存储 oc-backup/primary/weekly' },
];

const DRILLS: RestoreDrill[] = [
  { id: 'dl-01', at: '2026-09-07T02:00:00Z', scope: '全量恢复至独立实例（跨区副本）', rpoSeconds: 42, rtoSeconds: 726, result: 'SUCCEEDED', reportRef: 'report://dr/2026-q3-full', operator: '唐见微（SRE）' },
  { id: 'dl-02', at: '2026-09-14T02:00:00Z', scope: 'PITR 至 2026-09-13T23:14:00Z（误删回滚场景）', rpoSeconds: 58, rtoSeconds: 512, result: 'SUCCEEDED', reportRef: 'report://dr/2026-09-14-pitr', operator: '唐见微（SRE）' },
  { id: 'dl-03', at: '2026-08-31T02:00:00Z', scope: '对象存储跨区复制故障切换', rpoSeconds: 300, rtoSeconds: 1810, result: 'FAILED', reportRef: 'report://dr/2026-08-31-oss-failover', operator: '秦越人（平台）' },
  { id: 'dl-04', at: '2026-06-21T02:00:00Z', scope: '季度演练：主备切换 + 应用重连', rpoSeconds: 35, rtoSeconds: 688, result: 'SUCCEEDED', reportRef: 'report://dr/2026-q2-switchover', operator: '唐见微（SRE）' },
];

function buildRecoveryScans(r: Rng): RecoveryScan[] {
  return [
    {
      id: 'rec-2f11',
      scannedAt: r.ago(24),
      unfinishedSessions: [
        { sessionId: 'S-1b2c', title: '重构计费对账链路', lastCheckpoint: 'ckpt-9f21（step 18/26）', lastEventSeq: 128432, recoverable: true },
        { sessionId: 'S-7f3a', title: '对账分叉-快速修复', lastCheckpoint: 'ckpt-7c02（step 6/12）', lastEventSeq: 128221, recoverable: true },
        { sessionId: 'S-9a04', title: '迁移助手批次执行', lastCheckpoint: 'ckpt-3b11（step 2/9）', lastEventSeq: 128109, recoverable: false },
      ],
      unfinishedTasks: [
        { taskId: 'T-7f3a', title: '对账差异定位与修复', state: 'RUNNING', lastCheckpoint: 'ckpt-7c02', recoverable: true, reason: '工作区干净，可从安全点续跑' },
        { taskId: 'T-31c0', title: '网关路由灰度', state: 'VERIFYING', lastCheckpoint: 'ckpt-4d18', recoverable: false, reason: '依赖人工验收结论（无自动判定）' },
      ],
      unfinishedTeams: [
        { teamId: 'TM-9d', name: '对账链路交付组', members: 4, dispatch: '2 成员已完成提交，1 成员在合并队列中', recoverable: true },
      ],
      lastCheckpointRef: 'ckpt-9f21',
      recoverableItems: [
        '会话 S-1b2c：从 ckpt-9f21 续跑，重放 seq 128433…128452（只读）',
        '会话 S-7f3a：从 ckpt-7c02 续跑，跳过已发生的 3 个写操作（副作用账本命中）',
        '任务 T-7f3a：恢复 worktree wt-0003（未合并，保留分支 oc/T-7f3a-reconcile）',
        '团队 TM-9d：恢复黑板认领登记，合并队列 wt-0003 重新入队',
      ],
      needsHumanItems: [
        '会话 S-9a04：检查点早于最后一次破坏性迁移，需人工确认是否放弃（不可自动续跑）',
        '任务 T-31c0：验收结论缺失，需人工补充证据后方可继续',
      ],
      replaySegments: [
        { segment: 'seq 128433…128452（会话 S-1b2c）', events: 20, sideEffects: 0 },
        { segment: 'seq 128222…128240（会话 S-7f3a）', events: 19, sideEffects: 3 },
        { segment: '工具调用 12…38（任务 T-7f3a 环境重放）', events: 27, sideEffects: 7 },
      ],
      sideEffectLedgerSkipped: [
        { entry: 'fs.write src/reconcile/ledger.ts（已落盘且校验和一致）', idempotencyKey: 'tool:fswrite:sha256:7f3a91', reason: '副作用账本命中，跳过重复写入' },
        { entry: 'git commit -m "fix(reconcile): 差异归因"', idempotencyKey: 'git:commit:9f21ab4', reason: '提交已存在，跳过' },
        { entry: 'webhook 通知团队黑板', idempotencyKey: 'wh:team-board:TM-9d:128221', reason: '同一事件已投递成功，幂等跳过' },
      ],
    },
  ];
}

const EXPORT_PACKAGES: ExportPackage[] = [
  { packageId: 'oc-export-session-S-1b2c-20260921', manifest: true, events: 1842, workitems: 6, memory: 12, artifacts: 38, workspaceRefs: 1, checksums: 'sha256:1f3a…a9d0', sizeBytes: 48210329, redacted: true, missingRefs: [] },
  { packageId: 'oc-export-project-PRJ-data-pipeline-20260918', manifest: true, events: 42188, workitems: 118, memory: 62, artifacts: 318, workspaceRefs: 3, checksums: 'sha256:2b4c…b0e1', sizeBytes: 184320000, redacted: true, missingRefs: ['workspace-refs.json → repo data-pipeline@9f21ab4 在目标实例不存在'] },
  { packageId: 'oc-export-team-TM-9d-20260912', manifest: true, events: 6120, workitems: 24, memory: 8, artifacts: 46, workspaceRefs: 2, checksums: 'sha256:3c5d…c1f2', sizeBytes: 61819340, redacted: false, missingRefs: ['artifacts/index.json → artifact a-31c0 校验和不匹配'] },
];

const CONSISTENCY_CHECKS: ConsistencyCheck[] = [
  { pair: '事件 ↔ 投影', method: '抽样会话重建投影并对比（每日 03:00）', driftCount: 0, autoFix: true, lastRunAt: '2026-09-21T03:12:00Z', status: 'CONSISTENT', detail: '抽样 200 个会话，字段级一致' },
  { pair: '事件 ↔ 快照', method: '序号与关键状态比对', driftCount: 1, autoFix: true, lastRunAt: '2026-09-21T03:20:00Z', status: 'DRIFT', detail: '快照 sn-0012 落后 18 个事件 → 以事件为准刷新快照' },
  { pair: '引用完整性（artifact/媒体/索引）', method: '引用计数与存在性校验', driftCount: 2, autoFix: true, lastRunAt: '2026-09-21T03:30:00Z', status: 'DRIFT', detail: '2 个 artifact 引用计数为 0（孤儿候选）→ 标记后可清理' },
  { pair: '索引 ↔ 工作区版本', method: '索引记录的提交哈希与实际对比', driftCount: 1, autoFix: true, lastRunAt: '2026-09-21T03:40:00Z', status: 'DRIFT', detail: '索引落后 main@9f21ab4 → 触发增量索引' },
  { pair: '记忆文件 ↔ 索引', method: '文件与 DB 对比（以文件为准）', driftCount: 0, autoFix: true, lastRunAt: '2026-09-21T03:50:00Z', status: 'CONSISTENT', detail: '文件与索引一致（.oc/memory 共 42 条）' },
  { pair: '审计链（哈希链）', method: 'seq 区间哈希链重算比对', driftCount: 1, autoFix: false, lastRunAt: '2026-09-21T04:00:00Z', status: 'ALERT_ONLY', detail: 'seq 128420 处哈希链断点 → 仅告警（不可自动修复），已通知合规官' },
];

const DELETION_PROOFS: DeletionProof[] = [
  {
    proofId: 'del-2f11', scope: '记忆条目 project.user.email（跨 3 个环境副本）', executor: '林晚照（合规官）', executedAt: '2026-09-20T18:22:00Z', evidenceRef: 'report://compliance/delete/del-2f11', reversible: false,
    layers: [
      { layer: '在线表', status: 'DONE', detail: '逻辑删除标记 + 后台物理清理完成（0 残留行）' },
      { layer: '投影', status: 'DONE', detail: '会话投影字段同步置空（派生数据）' },
      { layer: '索引（知识/记忆向量）', status: 'DONE', detail: '删除 3 个向量与 2 个文档块' },
      { layer: '归档/冷存', status: 'DONE', detail: '重写受影响分区，删除标记不再命中（1 个 Parquet 分区重写）' },
      { layer: '备份', status: 'FILTERED_ON_READ', detail: '备份内标记，恢复时按标记过滤；超合规期限备份轮换后消亡' },
      { layer: '证明', status: 'DONE', detail: '生成删除证明并写入审计链（哈希链校验通过）' },
    ],
  },
  {
    proofId: 'del-3a02', scope: '会话 S-3d91 全量事件（用户主动删除 + 合规要求）', executor: '贺清尘（合规）', executedAt: '2026-09-14T11:05:00Z', evidenceRef: 'report://compliance/delete/del-3a02', reversible: false,
    layers: [
      { layer: '在线表', status: 'DONE', detail: '删除 4218 行事件（分区裁剪）' },
      { layer: '投影', status: 'DONE', detail: '会话读模型与统计同步删除' },
      { layer: '索引（知识/记忆向量）', status: 'DONE', detail: '无关联向量（会话未入索引）' },
      { layer: '归档/冷存', status: 'PENDING', detail: '历史归档分区重写排队中（预计 2026-09-22 完成）' },
      { layer: '备份', status: 'FILTERED_ON_READ', detail: '备份标记过滤，恢复时不还原' },
      { layer: '证明', status: 'DONE', detail: '证明已生成；归档层未完成，状态为「部分完成」' },
    ],
  },
];

const OBJECT_STORE: ObjectNamespace[] = [
  { namespace: 'media', objects: 4218, bytes: 128849018880, hotBytes: 18790481920, coldBytes: 110058536960, dedupRatio: 0.34, refCounted: true, encrypted: true, orphanCandidates: 2, lifecycle: '90 天转冷；引用计数为 0 且超 30 天清理' },
  { namespace: 'artifacts', objects: 18432, bytes: 429496729600, hotBytes: 42949672960, coldBytes: 386547056640, dedupRatio: 0.62, refCounted: true, encrypted: true, orphanCandidates: 2, lifecycle: '30 天转冷；随会话保留策略清理' },
  { namespace: 'snapshots', objects: 1842, bytes: 687194767360, hotBytes: 12884901888, coldBytes: 674309865472, dedupRatio: 0.71, refCounted: true, encrypted: true, orphanCandidates: 0, lifecycle: 'TTL 14 天；内容寻址增量，超期自动回收未引用块' },
];

const DR_TOPOLOGY: DrTopology[] = [
  { role: '主库（primary）', region: '华东-2', mode: '读写', replicationLagSeconds: 2, status: 'HEALTHY', crossRegionBackup: true },
  { role: '热备（standby）', region: '华东-2（跨可用区）', mode: '同步复制 + 自动切换', replicationLagSeconds: 2, status: 'HEALTHY', crossRegionBackup: true },
  { role: '跨区副本（dr）', region: '华北-1', mode: '异步复制（RPO ≤ 1min）', replicationLagSeconds: 42, status: 'LAGGING', crossRegionBackup: true },
  { role: '对象存储跨区复制', region: '华东-2 → 华北-1', mode: '双向复制（三类命名空间）', replicationLagSeconds: 184, status: 'DEGRADED', crossRegionBackup: true },
];

/* ------------------------------------------------------------------- 工作区 */

const CAPABILITY_MATRIX: { capability: string; local: string; ssh: string; container: string; cloud: string }[] = [
  { capability: '读/写/编辑文件', local: '✔', ssh: '✔', container: '✔', cloud: '✔' },
  { capability: '目录监听（变更事件）', local: '✔', ssh: '✖ 轮询 2s（非实时）', container: '✔（可挂载）', cloud: '部分（能力声明）' },
  { capability: '一次性命令', local: '✔', ssh: '✔', container: '✔', cloud: '✔' },
  { capability: 'PTY 交互', local: '✔', ssh: '✔', container: '✔', cloud: '部分' },
  { capability: '强隔离（卷 07 档位）', local: 'L0 / L0+', ssh: 'L0（远端围栏有限）', container: 'L1', cloud: 'L2 / L3' },
  { capability: '快照', local: '✔ 内容寻址', ssh: '✔ 增量', container: '✔ 镜像层+差异', cloud: '✔ 平台快照' },
  { capability: '资源强限', local: '部分', ssh: '仅观测', container: '✔', cloud: '✔' },
  { capability: '离线可用', local: '✔', ssh: '✖', container: '取决于镜像源', cloud: '✖' },
  { capability: '连接复用（多路复用）', local: '不适用', ssh: '✔ ControlMaster 风格', container: '✔ 运行时句柄', cloud: '✔ 会话复用（并发上限 8）' },
];

function caps(type: WorkspaceType, over: Partial<WsCapabilities> = {}): WsCapabilities {
  const base: Record<WorkspaceType, WsCapabilities> = {
    local: {
      fileOps: true, watch: true, oneshot: true, pty: true, isolationTier: 'L0 / L0+', snapshot: true, resourceLimit: true, offline: true, multiplex: false,
      fallbacks: [{ capability: '资源强限', fallback: '仅软限制（renice + 输出限额）', note: '本地进程围栏无法硬限内存，超限时告警而非终止' }],
    },
    ssh: {
      fileOps: true, watch: false, oneshot: true, pty: true, isolationTier: 'L0', snapshot: true, resourceLimit: false, offline: false, multiplex: true,
      fallbacks: [
        { capability: '目录监听', fallback: '轮询（2s，可配）', note: '非实时：变更最多延迟 2s 被感知' },
        { capability: '资源强限', fallback: '仅观测 + 超阈值暂停执行', note: '远端主机不可硬限，达到阈值暂停新命令' },
      ],
    },
    container: {
      fileOps: true, watch: true, oneshot: true, pty: true, isolationTier: 'L1', snapshot: true, resourceLimit: true, offline: false, multiplex: true,
      fallbacks: [{ capability: '离线可用', fallback: '依赖本地镜像缓存', note: '镜像源不可达且无缓存时无法准备' }],
    },
    cloud: {
      fileOps: true, watch: false, oneshot: true, pty: true, isolationTier: 'L2 / L3', snapshot: true, resourceLimit: true, offline: false, multiplex: true,
      fallbacks: [
        { capability: '目录监听', fallback: '轮询（2s，可配）', note: '非实时：平台未提供文件事件流' },
        { capability: 'PTY 交互', fallback: '降级为一次性命令 + 轮询输出', note: '部分供应商不支持交互式终端' },
        { capability: '离线可用', fallback: '不可离线', note: '云沙箱必须联网' },
      ],
    },
  };
  return { ...base[type], ...over };
}

function buildWorkspaces(r: Rng): Workspace[] {
  const specs: {
    id: string; name: string; type: WorkspaceType; status: WorkspaceStatus; project: string;
    disk: number; cpu: number; mem: number; net: string; inodes: number; limit: string; paused: boolean;
    languages: string[]; toolchain: string[]; pms: string[];
    host: string; image: string; endpoint: string; jump: string; cred: string; tags: string[];
    bindings: WorkspaceBinding[];
    diffs: EnvDiffItem[];
    commands: [WsCommand['mode'], string, number | null, string][];
    snapshotCount: number;
    capsOverride?: Partial<WsCapabilities>;
  }[] = [
    {
      id: 'ws-0001', name: '支付核心 · 本地', type: 'local', status: 'ready', project: 'PRJ-payment-core',
      disk: 0.62, cpu: 42, mem: 0.58, net: '1.2 GB / 24h', inodes: 184320, limit: '磁盘 60GB / 内存 16GB', paused: false,
      languages: ['TypeScript 5.9', 'Java 21'], toolchain: ['pnpm 9.12', 'Maven 3.9', 'Vitest 3.2'], pms: ['pnpm', 'npm'],
      host: 'localhost', image: '—', endpoint: '—', jump: '—', cred: 'local://fs-identity', tags: ['本地', '主工作区'],
      bindings: [
        { subjectId: 'S-1b2c', subjectKind: '会话', role: 'primary', writeScope: ['src/reconcile/**', 'tests/reconcile/**'], crossGrant: '无（主工作区）' },
        { subjectId: 'T-7f3a', subjectKind: '任务', role: 'related', writeScope: ['src/reconcile/**'], crossGrant: '读工作区 ws-0002（跨区授权，只读）' },
      ],
      diffs: [
        { tool: 'pnpm', expected: '9.12.0', actual: '9.12.0', severity: 'ok', action: '—' },
        { tool: 'node', expected: '22.11.0', actual: '22.11.0', severity: 'ok', action: '—' },
      ],
      commands: [
        ['oneshot', 'pnpm test --run', 0, 'cpu 3.2 / mem 1.8GB'],
        ['pty', 'pnpm vitest --watch', null, 'cpu 0.8 / mem 620MB'],
        ['background', 'pnpm build:watch', null, 'cpu 1.1 / mem 880MB'],
      ],
      snapshotCount: 2,
    },
    {
      id: 'ws-0002', name: '身份网关 · SSH 构建机', type: 'ssh', status: 'ready', project: 'PRJ-identity-gateway',
      disk: 0.48, cpu: 66, mem: 0.71, net: '482 MB / 24h', inodes: 42180, limit: 'SSH 仅观测（阈值 85%）', paused: false,
      languages: ['Java 21'], toolchain: ['Maven 3.9', 'gitleaks 8.18'], pms: ['mvn'],
      host: 'build-01.internal', image: '—', endpoint: 'ssh://build-01.internal:22', jump: 'jump.云枢科技.internal', cred: 'secret://ssh/build-01-key', tags: ['构建机', '内网'],
      bindings: [
        { subjectId: 'TM-9d', subjectKind: '团队', role: 'primary', writeScope: ['services/identity/**'], crossGrant: '无' },
        { subjectId: 'S-1b2c', subjectKind: '会话', role: 'related', writeScope: [], crossGrant: '读工作区（仅观测，无写范围）' },
      ],
      diffs: [
        { tool: 'mvn', expected: '3.9.9', actual: '3.9.6', severity: 'minor', action: '建议升级（不影响构建）' },
        { tool: 'java', expected: '21.0.4', actual: '21.0.4', severity: 'ok', action: '—' },
      ],
      commands: [
        ['oneshot', 'mvn -q -DskipTests package', 0, 'cpu 6.4 / mem 3.2GB'],
        ['pty', 'bash -l', null, 'cpu 0.1 / mem 84MB'],
        ['background', 'mvn test -Dtest=GatewayRouteTest', 1, 'cpu 5.1 / mem 2.4GB'],
      ],
      snapshotCount: 1,
    },
    {
      id: 'ws-0003', name: '数据管道 · 容器（磁盘告警）', type: 'container', status: 'degraded', project: 'PRJ-data-pipeline',
      disk: 0.92, cpu: 88, mem: 0.86, net: '6.4 GB / 24h', inodes: 942180, limit: '磁盘 80GB / CPU 4 核 / 内存 8GB', paused: true,
      languages: ['Python 3.12', 'Go 1.24'], toolchain: ['uv 0.5', 'pytest 8.3'], pms: ['uv', 'pip'],
      host: 'sandbox-node-07', image: 'registry.云枢科技.internal/oc/pipeline:1.24', endpoint: 'unix:///run/oc/ws-0003.sock', jump: '—', cred: 'secret://registry/oc-pipeline', tags: ['容器', '批处理'],
      bindings: [
        { subjectId: 'T-31c0', subjectKind: '任务', role: 'primary', writeScope: ['pipelines/**', 'sql/**'], crossGrant: '无' },
      ],
      diffs: [
        { tool: 'uv', expected: '0.5.4', actual: '0.4.18', severity: 'major', action: '一键准备：重装 uv' },
        { tool: 'pnpm', expected: '—', actual: '10.8.0', severity: 'minor', action: '多余依赖：不在清单中' },
      ],
      commands: [
        ['oneshot', 'uv run pytest -q', 0, 'cpu 3.8 / mem 2.1GB'],
        ['background', 'uv run python -m pipeline.backfill --batch 5000', null, 'cpu 3.9 / mem 4.2GB'],
      ],
      snapshotCount: 2,
    },
    {
      id: 'ws-0004', name: 'Web 控制台 · 云沙箱', type: 'cloud', status: 'ready', project: 'PRJ-web-console',
      disk: 0.34, cpu: 22, mem: 0.41, net: '1.8 GB / 24h', inodes: 18420, limit: '磁盘 40GB / CPU 8 核 / 内存 32GB', paused: false,
      languages: ['TypeScript 5.9'], toolchain: ['pnpm 9.12', 'Playwright 1.49'], pms: ['pnpm'],
      host: '—', image: 'oc/playwright:1.49', endpoint: 'https://sandbox-04.oc.云枢科技.internal', jump: '—', cred: 'secret://cloud/oc-sandbox-oauth', tags: ['云沙箱', 'L2', '环境重放'],
      bindings: [
        { subjectId: 'S-7f3a', subjectKind: '会话', role: 'primary', writeScope: ['apps/console/**'], crossGrant: '无' },
        { subjectId: 'rp-03', subjectKind: '环境重放', role: 'related', writeScope: ['tmp/replay/**'], crossGrant: '一次性授权（可丢弃）' },
      ],
      diffs: [{ tool: 'pnpm', expected: '9.12.0', actual: '9.12.0', severity: 'ok', action: '—' }],
      commands: [
        ['oneshot', 'pnpm test:e2e --project=chromium', 0, 'cpu 4.1 / mem 3.6GB'],
        ['pty', 'pnpm dev --host', null, 'cpu 1.4 / mem 1.2GB'],
        ['background', 'pnpm exec playwright test --repeat-each=3', null, 'cpu 5.2 / mem 4.8GB'],
      ],
      snapshotCount: 3,
    },
    {
      id: 'ws-0005', name: '移动 BFF · 本地（挂起）', type: 'local', status: 'suspended', project: 'PRJ-mobile-bff',
      disk: 0.55, cpu: 0, mem: 0.02, net: '0 MB / 24h', inodes: 62180, limit: '磁盘 40GB / 内存 16GB', paused: false,
      languages: ['TypeScript 5.9', 'Kotlin 2.0'], toolchain: ['pnpm 9.12', 'Gradle 8.10'], pms: ['pnpm'],
      host: 'localhost', image: '—', endpoint: '—', jump: '—', cred: 'local://fs-identity', tags: ['本地', '挂起保留基线'],
      bindings: [{ subjectId: 'S-3d91', subjectKind: '会话', role: 'primary', writeScope: ['bff/**'], crossGrant: '无' }],
      diffs: [{ tool: 'gradle', expected: '8.10', actual: '8.10', severity: 'ok', action: '—' }],
      commands: [['oneshot', 'pnpm test --run', 0, 'cpu 2.2 / mem 1.1GB']],
      snapshotCount: 1,
    },
    {
      id: 'ws-0006', name: '对账批处理 · SSH', type: 'ssh', status: 'ready', project: 'PRJ-payment-core',
      disk: 0.71, cpu: 54, mem: 0.62, net: '2.4 GB / 24h', inodes: 184320, limit: 'SSH 仅观测（阈值 85%）', paused: false,
      languages: ['Python 3.12'], toolchain: ['uv 0.5', 'psql 16.4'], pms: ['uv'],
      host: 'batch-02.internal', image: '—', endpoint: 'ssh://batch-02.internal:22', jump: 'jump.云枢科技.internal', cred: 'secret://ssh/batch-02-key', tags: ['批处理', 'DB 直连'],
      bindings: [{ subjectId: 'T-7f3a', subjectKind: '任务', role: 'related', writeScope: [], crossGrant: '只读（对账查询）' }],
      diffs: [{ tool: 'psql', expected: '16.4', actual: '16.4', severity: 'ok', action: '—' }],
      commands: [
        ['oneshot', 'uv run python -m reconcile.cli --date 2026-09-20', 0, 'cpu 2.8 / mem 1.4GB'],
        ['pty', 'psql -h pg-primary -U oc -d billing', null, 'cpu 0.1 / mem 92MB'],
      ],
      snapshotCount: 1,
    },
    {
      id: 'ws-0007', name: '风控引擎 · 容器（准备中）', type: 'container', status: 'provisioning', project: 'PRJ-risk-engine',
      disk: 0.12, cpu: 8, mem: 0.14, net: '184 MB / 24h', inodes: 8420, limit: '磁盘 60GB / CPU 6 核 / 内存 12GB', paused: false,
      languages: ['Go 1.24'], toolchain: ['go 1.24', 'golangci-lint 1.62'], pms: ['go mod'],
      host: 'sandbox-node-11', image: 'registry.云枢科技.internal/oc/risk:1.24', endpoint: 'unix:///run/oc/ws-0007.sock', jump: '—', cred: 'secret://registry/oc-risk', tags: ['容器', '准备中'],
      bindings: [{ subjectId: 'TM-9d', subjectKind: '团队', role: 'related', writeScope: ['risk/**'], crossGrant: '待授权' }],
      diffs: [{ tool: 'go', expected: '1.24.2', actual: '探测中', severity: 'minor', action: '等待首次探测' }],
      commands: [['oneshot', 'go build ./...', null, '准备中']],
      snapshotCount: 0,
    },
    {
      id: 'ws-0008', name: '通知中枢 · 云沙箱（PTY 降级）', type: 'cloud', status: 'degraded', project: 'PRJ-notification-hub',
      disk: 0.44, cpu: 36, mem: 0.48, net: '942 MB / 24h', inodes: 24180, limit: '磁盘 40GB / CPU 4 核 / 内存 16GB', paused: false,
      languages: ['TypeScript 5.9'], toolchain: ['pnpm 9.12'], pms: ['pnpm'],
      host: '—', image: 'oc/node:22', endpoint: 'https://sandbox-08.oc.云枢科技.internal', jump: '—', cred: 'secret://cloud/oc-sandbox-oauth', tags: ['云沙箱', '供应商不支持 PTY'],
      bindings: [{ subjectId: 'S-9a04', subjectKind: '会话', role: 'primary', writeScope: ['hub/**'], crossGrant: '无' }],
      diffs: [{ tool: 'node', expected: '22.11.0', actual: '22.9.0', severity: 'minor', action: '建议升级（向后兼容）' }],
      commands: [['oneshot', 'pnpm test --run', 0, 'cpu 3.4 / mem 1.9GB']],
      snapshotCount: 1,
      capsOverride: { pty: false, watch: false },
    },
  ];

  const commandPool: Record<WsCommand['mode'], string[]> = {
    oneshot: ['git status --porcelain=v2', 'pnpm lint --max-warnings=0', 'mvn -q verify', 'gitleaks detect --no-banner'],
    pty: ['bash -l', 'psql -h pg-primary -U oc', 'python -m pdb'],
    background: ['pnpm build:watch', 'uv run python -m pipeline.watch', 'tail -f logs/app.log'],
  };

  return specs.map((s, wi) => {
    const snapshots: WsSnapshot[] = Array.from({ length: s.snapshotCount }, (_, si) => ({
      snapshotId: `sn-${(wi + 1).toString().padStart(2, '0')}${si + 1}`,
      source: si === 0 ? `检查点 ckpt-${r.id('c', 4)}（任务边界）` : '工具调用前自动快照（可丢弃）',
      at: r.ago(60 + wi * 45 + si * 12),
      sizeBytes: r.int(18, 480) * 1024 * 1024,
      dedupRatio: r.float(0.58, 0.82, 2),
      refCount: r.int(1, 4),
      ttlDays: 14,
      restoreGranularity: (['会话级', '任务级', '单文件', '单工具调用'] as const)[r.int(0, 3)],
    }));
    const commands: WsCommand[] = s.commands.map(([mode, command, exitCode, peak], ci) => ({
      commandId: `cmd-${s.id}-${ci + 1}`,
      mode,
      command,
      user: s.type === 'ssh' ? 'oc-runner' : 'oc',
      exitCode,
      durationMs: mode === 'background' ? 0 : r.int(120, 96000),
      resourcePeak: peak,
      outputTail: exitCode === null
        ? [`[stdin] ${commandPool[mode][ci % commandPool[mode].length]}`, '等待输出…']
        : r.int(0, 9) > 6
          ? ['error: 1 test failed (reconcile.spec.ts:88)', 'exit code 1']
          : ['Tests 128 passed (128)', `Done in ${r.float(0.4, 8.2, 1)}s`],
      at: r.ago(30 + ci * 18 + wi),
      handle: mode === 'background' ? `bg-${r.int(1000, 9999)}` : null,
    }));
    return {
      workspaceId: s.id, name: s.name, type: s.type, status: s.status, projectId: s.project,
      quota: { diskUsedRatio: s.disk, cpu: s.cpu, memory: s.mem, networkTraffic: s.net, inodeCount: s.inodes, limit: s.limit, paused: s.paused },
      capabilities: caps(s.type, s.capsOverride),
      envProfile: {
        languages: s.languages, toolchain: s.toolchain, packageManagers: s.pms,
        git: {
          branch: r.pick(['main', 'oc/T-7f3a-reconcile', 'feat/console-i18n']),
          dirtyFiles: s.status === 'degraded' ? r.int(3, 22) : r.int(0, 4),
          ahead: r.int(0, 6), behind: r.int(0, 2),
          gc: 'auto（每周）', prune: '14 天前对象',
        },
        resources: { cpuCores: s.type === 'cloud' ? 8 : s.type === 'container' ? 6 : 12, memoryGb: s.type === 'cloud' ? 32 : 16, diskFreeGb: Math.round((1 - s.disk) * 80) },
        probedAt: r.ago(12 + wi * 6),
        diffFromManifest: s.diffs,
      },
      bindings: s.bindings,
      connectionProfile: { host: s.host, image: s.image, endpoint: s.endpoint, jumpHost: s.jump, credentialRef: s.cred, timeoutMs: s.type === 'ssh' ? 30000 : 15000, retries: 3, tags: s.tags },
      health: { heartbeatIntervalMs: 30000, reconnectBackoff: 5, lastProbeAt: r.ago(1 + wi) },
      commands,
      snapshots,
    } satisfies Workspace;
  });
}

function buildConnectionHealth(workspaces: Workspace[], r: Rng): ConnectionHealth[] {
  return workspaces.filter((w) => w.type !== 'local').map((w, i) => ({
    workspaceId: w.workspaceId,
    lastProbeAt: r.ago(1 + i),
    latencyMs: w.type === 'ssh' ? r.int(80, 320) : w.type === 'container' ? r.int(6, 40) : r.int(120, 480),
    multiplexedChannels: r.int(1, 8),
    reconnects24h: w.workspaceId === 'ws-0008' ? 7 : r.int(0, 2),
    backoffAttempts: w.workspaceId === 'ws-0008' ? 5 : r.int(0, 2),
    backoffCap: 5,
    state: w.status === 'degraded' ? (w.workspaceId === 'ws-0008' ? 'RECONNECTING' : 'HEALTHY') : w.status === 'provisioning' ? 'DOWN' : 'HEALTHY',
    note: w.workspaceId === 'ws-0008'
      ? '退避已达上限 5 次，进入 60s 慢探测；PTY 能力缺失（供应商不支持），需重认证后恢复'
      : w.workspaceId === 'ws-0007'
        ? '首次准备中，尚未建立心跳'
        : '心跳 30s 正常，多路复用通道稳定',
  }));
}

const COMMAND_AUDIT = [
  { id: 'ca-001', workspaceId: 'ws-0002', host: 'build-01.internal', user: 'oc-runner', command: 'mvn -q -DskipTests package', exitCode: 0, resource: 'cpu 6.4 / mem 3.2GB / 网络 0', at: '2026-09-21T06:42:00Z', redacted: false },
  { id: 'ca-002', workspaceId: 'ws-0002', host: 'build-01.internal', user: 'oc-runner', command: 'export ALIYUN_AK=••••（密钥引用注入，明文不入日志）', exitCode: 0, resource: 'cpu 0.1 / mem 12MB / 网络 0', at: '2026-09-21T06:40:00Z', redacted: true },
  { id: 'ca-003', workspaceId: 'ws-0003', host: 'sandbox-node-07', user: 'oc', command: 'uv run python -m pipeline.backfill --batch 5000', exitCode: 0, resource: 'cpu 3.9 / mem 4.2GB / 网络 482MB', at: '2026-09-21T05:18:00Z', redacted: false },
  { id: 'ca-004', workspaceId: 'ws-0006', host: 'batch-02.internal', user: 'oc-runner', command: 'psql -h pg-primary -U oc -c "select count(*) from ledger_diff"', exitCode: 0, resource: 'cpu 0.6 / mem 184MB / 网络 12MB', at: '2026-09-21T04:52:00Z', redacted: false },
  { id: 'ca-005', workspaceId: 'ws-0003', host: 'sandbox-node-07', user: 'oc', command: 'sudo systemctl restart pipeline-agent', exitCode: null, resource: '已阻断（提权命令）', at: '2026-09-21T04:20:00Z', redacted: false },
  { id: 'ca-006', workspaceId: 'ws-0004', host: 'sandbox-04.oc.云枢科技.internal', user: 'oc', command: 'pnpm test:e2e --project=chromium', exitCode: 1, resource: 'cpu 4.1 / mem 3.6GB / 网络 184MB', at: '2026-09-21T03:44:00Z', redacted: false },
];

/* ---------------------------------------------------------------- Git 数据 */

function buildGit(r: Rng): PlatformData['git'] {
  const repos: GitRepo[] = [
    { repo: 'payment-core', platform: 'internal', defaultBranch: 'main', sizeMb: 18420, commitGraph: true, partialClone: true, sparse: '按工作区需要（src/**）', lfs: true, disabledByEnterprise: false },
    { repo: 'identity-gateway', platform: 'gitlab', defaultBranch: 'main', sizeMb: 6420, commitGraph: true, partialClone: true, sparse: '全量', lfs: false, disabledByEnterprise: false },
    { repo: 'data-pipeline', platform: 'github', defaultBranch: 'main', sizeMb: 12840, commitGraph: true, partialClone: true, sparse: 'pipelines/**、sql/**', lfs: true, disabledByEnterprise: false },
    { repo: 'web-console', platform: 'github', defaultBranch: 'main', sizeMb: 3840, commitGraph: true, partialClone: false, sparse: '全量', lfs: false, disabledByEnterprise: false },
    { repo: 'legacy-billing', platform: 'gitea', defaultBranch: 'master', sizeMb: 46200, commitGraph: false, partialClone: true, sparse: 'sparse-checkout（仅 billing/**）', lfs: false, disabledByEnterprise: true },
  ];

  const worktrees: GitWorktree[] = [
    { worktreeId: 'wt-0001', taskId: 'T-7f3a', repo: 'payment-core', branch: 'oc/T-7f3a-reconcile', path: '${OPENCODING_HOME}/worktrees/payment-core/T-7f3a', status: 'ACTIVE', sizeBytes: 486000000, baseRevision: 'main@9f21ab4', mergedAt: null, cleanupAt: null, dirty: true, writeScope: ['src/reconcile/**'] },
    { worktreeId: 'wt-0002', taskId: 'T-31c0', repo: 'identity-gateway', branch: 'oc/T-31c0-gray-route', path: '${OPENCODING_HOME}/worktrees/identity-gateway/T-31c0', status: 'ACTIVE', sizeBytes: 312000000, baseRevision: 'main@3c11d0a', mergedAt: null, cleanupAt: null, dirty: false, writeScope: ['services/identity/route/**'] },
    { worktreeId: 'wt-0003', taskId: 'T-7f3a', repo: 'payment-core', branch: 'oc/T-7f3a-reconcile', path: '${OPENCODING_HOME}/worktrees/payment-core/T-7f3a', status: 'ACTIVE', sizeBytes: 512000000, baseRevision: 'main@9f21ab4', mergedAt: null, cleanupAt: null, dirty: true, writeScope: ['src/reconcile/**', 'tests/reconcile/**'] },
    { worktreeId: 'wt-0004', taskId: 'T-88b1', repo: 'web-console', branch: 'oc/T-88b1-i18n', path: '${OPENCODING_HOME}/worktrees/web-console/T-88b1', status: 'MERGED_PENDING_CLEANUP', sizeBytes: 184000000, baseRevision: 'main@7a02ce1', mergedAt: '2026-09-21T04:12:00Z', cleanupAt: '2026-09-22T04:12:00Z', dirty: false, writeScope: ['apps/console/i18n/**'] },
    { worktreeId: 'wt-0005', taskId: 'T-99c2', repo: 'data-pipeline', branch: 'oc/T-99c2-partition', path: '${OPENCODING_HOME}/worktrees/data-pipeline/T-99c2', status: 'ACTIVE', sizeBytes: 942000000, baseRevision: 'main@4b18de0', mergedAt: null, cleanupAt: null, dirty: false, writeScope: ['pipelines/partition/**'] },
    { worktreeId: 'wt-0006', taskId: 'T-41d0', repo: 'identity-gateway', branch: 'oc/T-41d0-scim', path: '${OPENCODING_HOME}/worktrees/identity-gateway/T-41d0', status: 'CLEANED', sizeBytes: 0, baseRevision: 'main@2f8a11c', mergedAt: '2026-09-19T09:40:00Z', cleanupAt: '2026-09-20T09:40:00Z', dirty: false, writeScope: ['services/identity/scim/**'] },
    { worktreeId: 'wt-0007', taskId: 'T-22a8', repo: 'payment-core', branch: 'oc/T-22a8-ledger-perf', path: '${OPENCODING_HOME}/worktrees/payment-core/T-22a8', status: 'ORPHAN', sizeBytes: 620000000, baseRevision: 'main@1d00bb2', mergedAt: null, cleanupAt: null, dirty: true, writeScope: ['src/ledger/**'] },
    { worktreeId: 'wt-0008', taskId: 'T-53e9', repo: 'web-console', branch: 'oc/T-53e9-diff-view', path: '${OPENCODING_HOME}/worktrees/web-console/T-53e9', status: 'ACTIVE', sizeBytes: 216000000, baseRevision: 'main@7a02ce1', mergedAt: null, cleanupAt: null, dirty: false, writeScope: ['apps/console/diff/**'] },
    { worktreeId: 'wt-0009', taskId: 'T-64f0', repo: 'data-pipeline', branch: 'oc/T-64f0-lake-export', path: '${OPENCODING_HOME}/worktrees/data-pipeline/T-64f0', status: 'BLOCKED', sizeBytes: 1060000000, baseRevision: 'main@4b18de0', mergedAt: null, cleanupAt: null, dirty: true, writeScope: ['pipelines/lake/**'] },
    { worktreeId: 'wt-0010', taskId: 'T-75a1', repo: 'payment-core', branch: 'oc/T-75a1-fee-rule', path: '${OPENCODING_HOME}/worktrees/payment-core/T-75a1', status: 'ACTIVE', sizeBytes: 498000000, baseRevision: 'main@9f21ab4', mergedAt: null, cleanupAt: null, dirty: false, writeScope: ['src/fee/**'] },
    { worktreeId: 'wt-0011', taskId: 'T-86b2', repo: 'legacy-billing', branch: 'oc/T-86b2-migrate', path: '${OPENCODING_HOME}/worktrees/legacy-billing/T-86b2', status: 'BLOCKED', sizeBytes: 0, baseRevision: 'master@08fa21c', mergedAt: null, cleanupAt: null, dirty: false, writeScope: ['billing/**'] },
  ];

  const mergeQueue: MergeQueueEntry[] = [
    { id: 'mq-01', branch: 'oc/T-31c0-gray-route', target: 'main', taskId: 'T-31c0', status: 'started', leaseOwner: 'merge-runner-01', leaseSeconds: 240, baseRevision: 'main@3c11d0a', replayResult: '无冲突（rebase 到最新基线）', precheck: { result: 'running', logsRef: 'log://mq/01/precheck', command: 'mvn -q verify && gitleaks detect' }, conflictFiles: [], suggestions: [], mergeStrategy: 'squash', durationMs: 48000, rejectionReason: '' },
    { id: 'mq-02', branch: 'oc/T-88b1-i18n', target: 'main', taskId: 'T-88b1', status: 'completed', leaseOwner: 'merge-runner-01', leaseSeconds: 0, baseRevision: 'main@7a02ce1', replayResult: '无冲突', precheck: { result: 'passed', logsRef: 'log://mq/02/precheck', command: 'pnpm test --run' }, conflictFiles: [], suggestions: [], mergeStrategy: 'squash', durationMs: 62400, rejectionReason: '' },
    { id: 'mq-03', branch: 'oc/T-7f3a-reconcile', target: 'main', taskId: 'T-7f3a', status: 'conflict', leaseOwner: 'merge-runner-02', leaseSeconds: 0, baseRevision: 'main@9f21ab4', replayResult: '冲突：2 个文件（语义冲突 1 处）', precheck: { result: 'skipped', logsRef: 'log://mq/03/conflict', command: '—' }, conflictFiles: ['src/reconcile/ledger.ts', 'src/reconcile/index.ts'], suggestions: ['ledger.ts：保留两侧校验（我方 + 基线新增的幂等键）', 'index.ts：取基线导出顺序，避免循环依赖'], mergeStrategy: 'rebase-then-merge', durationMs: 31200, rejectionReason: '冲突需人工确认后重新入队' },
    { id: 'mq-04', branch: 'oc/T-64f0-lake-export', target: 'main', taskId: 'T-64f0', status: 'rejected', leaseOwner: 'merge-runner-02', leaseSeconds: 0, baseRevision: 'main@4b18de0', replayResult: '无冲突', precheck: { result: 'failed', logsRef: 'log://mq/04/precheck', command: 'uv run pytest -q' }, conflictFiles: [], suggestions: ['修复 tests/lake/test_export.py::test_partition_rollover 失败（分区边界）'], mergeStrategy: 'squash', durationMs: 92000, rejectionReason: '预检失败：3 个测试未通过（目标分支保持健康）' },
    { id: 'mq-05', branch: 'oc/T-99c2-partition', target: 'main', taskId: 'T-99c2', status: 'queued', leaseOwner: '—', leaseSeconds: 0, baseRevision: 'main@4b18de0', replayResult: '待拉取基线', precheck: { result: 'skipped', logsRef: '—', command: '—' }, conflictFiles: [], suggestions: [], mergeStrategy: 'merge-commit', durationMs: 0, rejectionReason: '' },
    { id: 'mq-06', branch: 'oc/T-22a8-ledger-perf', target: 'main', taskId: 'T-22a8', status: 'queued', leaseOwner: '—', leaseSeconds: 0, baseRevision: 'main@1d00bb2', replayResult: '待拉取基线', precheck: { result: 'skipped', logsRef: '—', command: '—' }, conflictFiles: [], suggestions: [], mergeStrategy: 'squash', durationMs: 0, rejectionReason: '' },
    { id: 'mq-07', branch: 'oc/T-75a1-fee-rule', target: 'release/2.9', taskId: 'T-75a1', status: 'completed', leaseOwner: 'merge-runner-01', leaseSeconds: 0, baseRevision: 'release/2.9@aa31c04', replayResult: '无冲突', precheck: { result: 'passed', logsRef: 'log://mq/07/precheck', command: 'mvn -q verify' }, conflictFiles: [], suggestions: [], mergeStrategy: 'squash', durationMs: 54200, rejectionReason: '' },
    { id: 'mq-08', branch: 'oc/T-53e9-diff-view', target: 'main', taskId: 'T-53e9', status: 'rejected', leaseOwner: 'merge-runner-02', leaseSeconds: 0, baseRevision: 'main@7a02ce1', replayResult: '无冲突', precheck: { result: 'failed', logsRef: 'log://mq/08/precheck', command: 'pnpm lint --max-warnings=0' }, conflictFiles: [], suggestions: ['移除 any 断言（apps/console/diff/FileTree.vue:118）'], mergeStrategy: 'squash', durationMs: 41200, rejectionReason: '预检失败：lint 阻断（企业门禁：max-warnings=0）' },
  ];

  const commits: GitCommit[] = [
    { hash: '9f21ab4', type: 'fix', scope: 'reconcile', subject: '差异归因使用幂等键去重', body: '按幂等键（账本 ID + 币种）去重，避免同日重跑产生重复差异行。影响面：对账查询读路径；验证：pnpm test --run reconcile。', trailers: { task: 'T-7f3a', session: 'S-1b2c', team: 'TM-9d', agent: { role: 'implementer', model: 'claude-sonnet-4.5' }, approval: 'ar-4f21' }, filesChanged: 6, additions: 184, deletions: 62, coAuthoredBy: 'OpenCoding Agent', at: '2026-09-21T06:52:00Z' },
    { hash: '3c11d0a', type: 'feat', scope: 'gateway', subject: '路由灰度按请求头分桶', body: '按 x-oc-bucket 稳定分桶，灰度 5%；回滚开关接入特性开关。', trailers: { task: 'T-31c0', session: 'S-1b2c', team: 'TM-9d', agent: { role: 'implementer', model: 'gpt-5.1' }, approval: '—' }, filesChanged: 9, additions: 312, deletions: 44, coAuthoredBy: '—', at: '2026-09-21T04:10:00Z' },
    { hash: '7a02ce1', type: 'refactor', scope: 'console', subject: 'i18n key 收敛到单一词典', body: '合并 3 套词典，移除重复 key 62 个。', trailers: { task: 'T-88b1', session: 'S-7f3a', team: '—', agent: { role: 'implementer', model: 'claude-sonnet-4.5' }, approval: '—' }, filesChanged: 42, additions: 620, deletions: 1180, coAuthoredBy: 'OpenCoding Agent', at: '2026-09-21T03:58:00Z' },
    { hash: '4b18de0', type: 'perf', scope: 'pipeline', subject: '分区滚动按批预取元数据', body: '批预取使回填吞吐提升 2.4×（基准 Y-03）。', trailers: { task: 'T-99c2', session: 'S-7f3a', team: '—', agent: { role: 'implementer', model: 'claude-sonnet-4.5' }, approval: '—' }, filesChanged: 4, additions: 96, deletions: 28, coAuthoredBy: '—', at: '2026-09-21T02:20:00Z' },
    { hash: '2f8a11c', type: 'test', scope: 'identity', subject: 'SCIM 同步补充契约测试', body: '新增 18 条契约用例覆盖分页与过滤。', trailers: { task: 'T-41d0', session: 'S-1b2c', team: 'TM-9d', agent: { role: 'verifier', model: 'claude-sonnet-4.5' }, approval: '—' }, filesChanged: 14, additions: 480, deletions: 6, coAuthoredBy: 'OpenCoding Agent', at: '2026-09-19T09:22:00Z' },
    { hash: '1d00bb2', type: 'docs', scope: 'reconcile', subject: '补充对账口径与验收标准', body: '把验收标准写成可执行断言（L2 证据）。', trailers: { task: 'T-7f3a', session: 'S-1b2c', team: '—', agent: { role: 'implementer', model: 'claude-sonnet-4.5' }, approval: '—' }, filesChanged: 3, additions: 88, deletions: 12, coAuthoredBy: '—', at: '2026-09-18T20:40:00Z' },
    { hash: 'aa31c04', type: 'chore', scope: 'ci', subject: '合并队列预检命令收敛到 .oc/ci.yaml', body: '预检命令单一来源，避免本地与 CI 漂移。', trailers: { task: 'T-75a1', session: 'S-3d91', team: '—', agent: { role: 'implementer', model: 'gpt-5.1' }, approval: '—' }, filesChanged: 2, additions: 24, deletions: 18, coAuthoredBy: '—', at: '2026-09-17T18:12:00Z' },
    { hash: '08fa21c', type: 'build', scope: 'legacy', subject: '接入部分克隆与稀疏检出', body: '大仓首次准备时间从 42min 降到 6min（D-GIT-8）。', trailers: { task: 'T-86b2', session: 'S-9a04', team: '—', agent: { role: 'implementer', model: 'claude-sonnet-4.5' }, approval: 'ar-7c31' }, filesChanged: 5, additions: 140, deletions: 22, coAuthoredBy: 'OpenCoding Agent', at: '2026-09-16T15:30:00Z' },
    { hash: '5e0c914', type: 'ci', scope: 'security', subject: '提交前扫描接入企业私仓规则库', body: '新增 12 条密钥模式；命中即阻断。', trailers: { task: 'T-53e9', session: 'S-7f3a', team: '—', agent: { role: 'implementer', model: 'claude-sonnet-4.5' }, approval: '—' }, filesChanged: 3, additions: 96, deletions: 4, coAuthoredBy: '—', at: '2026-09-15T11:04:00Z' },
    { hash: 'c4012a7', type: 'feat', scope: 'billing', subject: '账单快照支持按日重算', body: '重算使用同一幂等键，避免重复入账（副作用账本对齐）。', trailers: { task: 'T-86b2', session: 'S-9a04', team: 'TM-9d', agent: { role: 'implementer', model: 'claude-sonnet-4.5' }, approval: 'ar-9d02' }, filesChanged: 11, additions: 420, deletions: 96, coAuthoredBy: 'OpenCoding Agent', at: '2026-09-14T09:48:00Z' },
    { hash: 'b7a03d5', type: 'fix', scope: 'diff', subject: '并排视图修正空行对齐', body: '空行补齐使双栏行号可比。', trailers: { task: 'T-53e9', session: 'S-7f3a', team: '—', agent: { role: 'implementer', model: 'gpt-5.1' }, approval: '—' }, filesChanged: 2, additions: 44, deletions: 18, coAuthoredBy: '—', at: '2026-09-13T22:10:00Z' },
    { hash: 'e81c2f0', type: 'refactor', scope: 'ledger', subject: '提取账本行解析器为纯函数', body: '为环境重放可复现做准备（无外部依赖）。', trailers: { task: 'T-22a8', session: 'S-3d91', team: '—', agent: { role: 'implementer', model: 'claude-sonnet-4.5' }, approval: '—' }, filesChanged: 8, additions: 210, deletions: 188, coAuthoredBy: 'OpenCoding Agent', at: '2026-09-12T16:02:00Z' },
  ];

  const dangerOps: DangerOp[] = [
    { id: 'dg-01', op: 'reset --hard', command: 'git reset --hard main@9f21ab4', lastAt: '2026-09-21T06:02:00Z', lostCommits: [{ hash: 'a11f0c2', subject: 'wip: 临时调试日志', author: 'OpenCoding Agent' }, { hash: 'b22e1d3', subject: 'wip: 尝试异步重试', author: 'OpenCoding Agent' }], backupRef: 'oc/backup/20260921T0602', confirmedBy: '沈亦舟', consequence: '丢弃 2 个未推送提交与工作区改动（工作区脏文件 6 个）', reversible: true, undoCommand: 'oc git undo --ref oc/backup/20260921T0602' },
    { id: 'dg-02', op: 'push --force', command: 'git push --force-with-lease origin oc/T-7f3a-reconcile', lastAt: '2026-09-20T18:44:00Z', lostCommits: [], backupRef: 'oc/backup/20260920T1844', confirmedBy: '顾清和', consequence: '远端任务分支被重写；协作者需重新拉取（保护分支默认禁止）', reversible: true, undoCommand: 'oc git undo --ref oc/backup/20260920T1844' },
    { id: 'dg-03', op: 'clean -fd', command: 'git clean -fd', lastAt: '2026-09-20T11:20:00Z', lostCommits: [], backupRef: 'oc/backup/20260920T1120', confirmedBy: '周砚青', consequence: '删除 42 个未跟踪文件（含本地脚本与临时数据）', reversible: false, undoCommand: '不可撤销（未跟踪文件未纳入备份引用）' },
    { id: 'dg-04', op: '删除分支', command: 'git branch -D oc/T-41d0-scim', lastAt: '2026-09-19T20:05:00Z', lostCommits: [{ hash: 'c33f2e4', subject: 'test: 补充分页用例', author: 'OpenCoding Agent' }], backupRef: 'oc/backup/20260919T2005', confirmedBy: '沈亦舟', consequence: '删除已合并分支；未合并提交 1 个（已备份）', reversible: true, undoCommand: 'oc git undo --ref oc/backup/20260919T2005' },
    { id: 'dg-05', op: 'amend-已推送', command: 'git commit --amend --no-edit', lastAt: '2026-09-18T14:32:00Z', lostCommits: [{ hash: 'd44a3f5', subject: 'fix(reconcile): 空值处理', author: 'OpenCoding Agent' }], backupRef: 'oc/backup/20260918T1432', confirmedBy: '顾清和', consequence: '重写已推送提交历史，协作者需 rebase', reversible: true, undoCommand: 'oc git undo --ref oc/backup/20260918T1432' },
    { id: 'dg-06', op: '丢弃未提交改动', command: 'git checkout -- src/reconcile/ledger.ts', lastAt: '2026-09-17T09:12:00Z', lostCommits: [], backupRef: 'oc/backup/20260917T0912', confirmedBy: '林晚照', consequence: '丢弃单文件未提交改动（已自动快照，可从引用恢复）', reversible: true, undoCommand: 'oc git undo --ref oc/backup/20260917T0912' },
    { id: 'dg-07', op: 'rebase-已推送', command: 'git rebase -i origin/main', lastAt: '2026-09-16T21:40:00Z', lostCommits: [], backupRef: 'oc/backup/20260916T2140', confirmedBy: '沈亦舟', consequence: '已推送分支的 6 个提交哈希被重写（协作者影响已通知）', reversible: true, undoCommand: 'oc git undo --ref oc/backup/20260916T2140' },
  ];

  const scanHits: ScanHit[] = [
    { id: 'sh-01', patternType: '密钥模式', path: 'config/aliyun.ak.json', blocked: true, suggestion: '改为密钥引用（secret://cloud/aliyun-ak），文件加入 .gitignore', blobHash: 'blob-7f21…a1', cached: true, at: '2026-09-21T06:40:00Z' },
    { id: 'sh-02', patternType: '大文件', path: 'fixtures/ledger-2026-08.csv', blocked: true, suggestion: '> 100MB 阻断提交；改用 LFS 或对象存储外置（artifact://）', blobHash: 'blob-8a32…b2', cached: false, at: '2026-09-21T05:12:00Z' },
    { id: 'sh-03', patternType: '敏感路径', path: '.env.production', blocked: true, suggestion: '生产配置禁止入库；改用环境变量注入（.env.example 为模板）', blobHash: 'blob-9b43…c3', cached: true, at: '2026-09-20T22:18:00Z' },
    { id: 'sh-04', patternType: '依赖清单变更', path: 'pnpm-lock.yaml', blocked: false, suggestion: '新增 2 个间接依赖（lodash@4.17.20 命中 CVE-2026-31841）→ 建议升级后提交', blobHash: 'blob-ac54…d4', cached: true, at: '2026-09-20T20:02:00Z' },
    { id: 'sh-05', patternType: '证书文件', path: 'deploy/tls/internal.crt', blocked: true, suggestion: '证书与私钥禁止入库；改用证书管理（企业 CA + 轮换 90 天）', blobHash: 'blob-bd65…e5', cached: false, at: '2026-09-19T15:44:00Z' },
    { id: 'sh-06', patternType: '密钥模式', path: 'scripts/deploy.sh', blocked: false, suggestion: '高熵串疑似误报（Base64 构建产物哈希），已加入白名单缓存（按 blob 哈希）', blobHash: 'blob-ce76…f6', cached: true, at: '2026-09-18T13:20:00Z' },
  ];

  const reviews: GitReview[] = [
    { id: 'rv-01', layer: '自审', reviewerRole: 'Agent 自审（对照验收标准）', verdict: 'CHANGES_REQUESTED', comments: [{ file: 'src/reconcile/ledger.ts', line: 88, text: '缺少幂等键空值分支的单测（验收标准第 3 条未覆盖）', severity: 'major' }], reflowedTaskId: 'T-7f3a', at: '2026-09-21T06:20:00Z' },
    { id: 'rv-02', layer: '团队审查', reviewerRole: '审查者（member-verifier）', verdict: 'APPROVED', comments: [{ file: 'tests/reconcile/ledger.spec.ts', line: 42, text: '断言覆盖幂等键去重与并发重放两条路径', severity: 'info' }], reflowedTaskId: null, at: '2026-09-21T06:44:00Z' },
    { id: 'rv-03', layer: '人类审查', reviewerRole: '人类审查（PR #2183）', verdict: 'CHANGES_REQUESTED', comments: [{ file: 'src/reconcile/index.ts', line: 12, text: '导出顺序会引入循环依赖，请改为按需导入', severity: 'major' }, { file: 'src/reconcile/ledger.ts', line: 118, text: '日志需脱敏账本 ID 后四位', severity: 'minor' }], reflowedTaskId: 'T-7f3a', at: '2026-09-21T07:02:00Z' },
    { id: 'rv-04', layer: '人类审查', reviewerRole: '人类审查（PR #2179）', verdict: 'PENDING', comments: [], reflowedTaskId: null, at: '2026-09-20T18:30:00Z' },
  ];

  const undoLog: UndoLogEntry[] = [
    { id: 'un-01', command: 'oc git undo --ref oc/backup/20260921T0602', performedAt: '2026-09-21T06:14:00Z', restoredFrom: 'oc/backup/20260921T0602', affected: '恢复 reset --hard 丢弃的 2 个提交与 6 个脏文件', ttlDays: 30, status: 'AVAILABLE' },
    { id: 'un-02', command: 'oc git undo --ref oc/backup/20260920T1844', performedAt: '2026-09-20T19:02:00Z', restoredFrom: 'oc/backup/20260920T1844', affected: '恢复被强推覆盖的远端任务分支（3 个提交）', ttlDays: 30, status: 'AVAILABLE' },
    { id: 'un-03', command: 'oc git undo --ref oc/backup/20260810T1010', performedAt: '2026-08-10T10:22:00Z', restoredFrom: 'oc/backup/20260810T1010', affected: '恢复误删 tag v2.8.0', ttlDays: 30, status: 'EXPIRED' },
  ];

  const repoPrep: LargeRepoPrep = {
    repo: 'legacy-billing',
    files: 184320,
    steps: [
      { step: '部分克隆（blobless）', status: 'SUCCEEDED', detail: '仅拉取提交图与树，blob 按需获取' },
      { step: '稀疏检出（billing/**）', status: 'SUCCEEDED', detail: '工作区仅物化 6.2 万文件' },
      { step: 'commit-graph 构建', status: 'RUNNING', detail: '已处理 42 万提交 / 68 万（预计 4 分钟）' },
      { step: 'LFS 对象按需拉取', status: 'PENDING', detail: '该仓未启用 LFS（默认提示，可配置）' },
      { step: '首次 status 基线', status: 'PENDING', detail: '目标：status ≤ 500ms（大仓 SLO）' },
    ],
    progress: 0.62,
    etaSeconds: 240,
    statusCheckMs: 486,
  };

  return {
    repos,
    worktrees,
    mergeQueue,
    commits,
    branchPolicy: {
      protected: ['main', 'release/2.8', 'release/2.9'],
      perTaskBranch: true,
      stacked: false,
      naming: 'oc/<task-id>-<slug>（如 oc/T-7f3a-reconcile）',
      protectedRule: '禁止直接推送与强推；合并必须经合并队列或 PR/MR 审查；企业可禁用特定操作',
    },
    dangerOps,
    scanHits,
    reviews,
    undoLog,
    repoPrep,
  };
}

/* -------------------------------------------------------------- 构建入口 */

/** 构建平台与工程域全量数据（确定性） */
export function buildPlatformData(r: Rng): PlatformData {
  const workspaces = buildWorkspaces(r);
  return {
    events: buildEvents(r),
    eventJobs: {
      consumerLag: CONSUMER_LAG,
      deadLetters: DEAD_LETTERS,
      webhookSubscriptions: WEBHOOK_SUBSCRIPTIONS,
      exportJobs: EXPORT_JOBS,
      retentionPolicies: RETENTION_POLICIES,
    },
    replays: REPLAYS,
    persistence: {
      domains: DOMAINS,
      migrations: MIGRATIONS,
      pipeline: PIPELINE,
      backups: BACKUPS,
      drills: DRILLS,
      recoveryScans: buildRecoveryScans(r),
      exportPackages: EXPORT_PACKAGES,
      consistencyChecks: CONSISTENCY_CHECKS,
      deletionProofs: DELETION_PROOFS,
      objectStore: OBJECT_STORE,
      drTopology: DR_TOPOLOGY,
    },
    workspaces,
    capabilityMatrix: CAPABILITY_MATRIX,
    connectionHealth: buildConnectionHealth(workspaces, r),
    commandAudit: COMMAND_AUDIT,
    git: buildGit(r),
  };
}

/** 全站固定种子实例（刷新一致） */
export const platformData = buildPlatformData(new Rng(20260921));

/** 供页面做格式化：字节 → 人类可读 */
export function humanBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** 供页面做格式化：秒 → 中文时长 */
export function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  return `${Math.floor(seconds / 3600)} 小时 ${Math.floor((seconds % 3600) / 60)} 分`;
}

/** 仓库名池（供页面下拉使用，保持与 rng 一致） */
export const PLATFORM_REPOS = REPOS;
