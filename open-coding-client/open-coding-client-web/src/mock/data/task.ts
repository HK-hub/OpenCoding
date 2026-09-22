/**
 * 任务与协作域 mock 数据（harness 卷 13 Agent Teams / 卷 14 任务与计划 / 卷 15 Goal 与 Schedule）。
 * 覆盖：WorkItem 四层统一模型、Goal 契约、Schedule 五类触发器、Team 编排与黑板、验收证据链。
 * 全部数据由固定种子生成，数字自洽（进度/预算/耗时互相可核对）。
 */
import { Rng, NAMES, REPOS } from '../rng';

/* ------------------------------------------------------------------ 枚举与常量 */

export type WorkItemLevel = 'goal' | 'plan' | 'task' | 'step';
export type WorkItemStatus = 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'in_review' | 'done' | 'cancelled';
export type Priority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
export type DepKind = 'finish_to_start' | 'artifact' | 'decision';
export type Verdict = 'pass' | 'fail' | 'pending' | 'unverifiable';
export type AutonomyLevel = 'propose' | 'collaborate' | 'autonomous';
export type GoalStatus = 'created' | 'started' | 'paused' | 'achieved' | 'failed' | 'cancelled';
export type ScheduleTargetKind = 'task_template' | 'plan_template' | 'goal' | 'session_template';
export type TriggerKind = 'time' | 'event' | 'condition' | 'manual' | 'composite';
export type ConcurrencyPolicy = 'skip' | 'queue' | 'replace' | 'parallel';
export type Topology = 'supervisor' | 'pipeline' | 'fanout' | 'market' | 'debate' | 'hybrid';
export type TeamState = 'created' | 'running' | 'completed' | 'aborted';
export type MemberState = 'idle' | 'busy' | 'blocked' | 'completed' | 'failed';
export type MessageType = 'handoff' | 'question' | 'blocker' | 'proposal' | 'review_request' | 'verdict' | 'budget_alert';
export type MergeStatus = 'queued' | 'started' | 'completed' | 'conflict' | 'rejected';

/** 看板列顺序（卷 14 §4.2 七态） */
export const STATUS_ORDER: WorkItemStatus[] = ['backlog', 'ready', 'in_progress', 'blocked', 'in_review', 'done', 'cancelled'];

export const STATUS_META: Record<WorkItemStatus, { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  backlog: { label: '待规划', theme: 'default' },
  ready: { label: '可执行', theme: 'primary' },
  in_progress: { label: '进行中', theme: 'primary' },
  blocked: { label: '阻塞', theme: 'warning' },
  in_review: { label: '待验收', theme: 'warning' },
  done: { label: '已完成', theme: 'success' },
  cancelled: { label: '已取消', theme: 'danger' },
};

/** 合法迁移表：非法迁移必须拒绝并给出理由（卷 14 DoD） */
export const LEGAL_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  backlog: ['ready', 'cancelled'],
  ready: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'in_review', 'ready', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  in_review: ['done', 'in_progress'],
  done: [],
  cancelled: [],
};

export const TRANSITION_DENY_REASON: Record<WorkItemStatus, string> = {
  backlog: '待规划任务需先「分解完成且依赖满足」才能进入可执行，不能直接跳到执行态。',
  ready: '可执行任务需先被指派/认领（写入 assignee）才能开始。',
  in_progress: '执行中任务只能流转到阻塞/待验收/回退可执行/取消，不能直接完成。',
  blocked: '阻塞任务必须先解除阻塞原因（记录解除证据）才能继续执行。',
  in_review: '待验收任务只能由验收结论（通过→已完成 / 驳回→进行中）驱动，不能手改。',
  done: '已完成任务不可再迁移（终态）；如需返工请新建派生任务并记录理由。',
  cancelled: '已取消任务为终态；如需重启请从 backlog 新建并关联原任务。',
};

export const PRIORITY_META: Record<Priority, { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  URGENT: { label: '紧急', theme: 'danger' },
  HIGH: { label: '高', theme: 'warning' },
  NORMAL: { label: '普通', theme: 'primary' },
  LOW: { label: '低', theme: 'default' },
};

export const LEVEL_META: Record<WorkItemLevel, { label: string; icon: string }> = {
  goal: { label: 'Goal 目标', icon: 'star' },
  plan: { label: 'Plan 计划', icon: 'sitemap' },
  task: { label: 'Task 任务', icon: 'task' },
  step: { label: 'Step 步骤', icon: 'check' },
};

export const DEP_META: Record<DepKind, { label: string; desc: string }> = {
  finish_to_start: { label: '完成后开始', desc: '前序任务完成（验收通过）后本项才可执行' },
  artifact: { label: '产物依赖', desc: '需要前序产出物存在（文件/接口/迁移脚本）' },
  decision: { label: '裁决依赖', desc: '需要仲裁或人类决策结论作为输入' },
};

export const AUTONOMY_META: Record<AutonomyLevel, { label: string; desc: string }> = {
  propose: { label: '建议', desc: '只产出方案与候选，任何写入都需人工确认' },
  collaborate: { label: '协作', desc: '关键节点（介入点、高风险动作）找人确认，其余自主推进' },
  autonomous: { label: '自治', desc: '预授权范围内自主推进；越界即暂停并通知' },
};

export const GOAL_STATUS_META: Record<GoalStatus, { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  created: { label: '已创建', theme: 'default' },
  started: { label: '进行中', theme: 'primary' },
  paused: { label: '已暂停', theme: 'warning' },
  achieved: { label: '已达成', theme: 'success' },
  failed: { label: '已失败', theme: 'danger' },
  cancelled: { label: '已撤销', theme: 'default' },
};

export const TOPOLOGY_META: Record<Topology, { label: string; desc: string }> = {
  supervisor: { label: '主管-工作者', desc: '主管分解与分派，工作者执行回报；主管是瓶颈与单点' },
  pipeline: { label: '流水线', desc: '阶段串接（设计→实现→测试→审查），串行延迟' },
  fanout: { label: '并行扇出', desc: '同质任务并行（批量重构/测试），合并冲突风险' },
  market: { label: '市场竞标', desc: '成员竞标任务，用于多方案对比，成本翻倍' },
  debate: { label: '辩论评审', desc: '多角色互评以提升质量，用于高风险决策' },
  hybrid: { label: '混合编排', desc: '主管分派 + 阶段流水线 + 同质扇出 + 高风险辩论（默认）' },
};

export const MESSAGE_META: Record<MessageType, { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  handoff: { label: '交接', theme: 'primary' },
  question: { label: '求助', theme: 'default' },
  blocker: { label: '阻塞', theme: 'danger' },
  proposal: { label: '方案提议', theme: 'primary' },
  review_request: { label: '请求审查', theme: 'warning' },
  verdict: { label: '裁决', theme: 'success' },
  budget_alert: { label: '预算告警', theme: 'danger' },
};

/* ------------------------------------------------------------------ 接口定义 */

export interface Dependency { type: DepKind; targetId: string; targetShort: string }

export interface AcceptanceItem {
  id: string;
  /** 可检验条目 */
  text: string;
  /** 验证方式（命令/检查项/人工判据） */
  verifyMethod: string;
  verdict: Verdict;
  /** 证据引用（evidence.id） */
  evidenceRefs: string[];
}

export interface EvidenceItem {
  id: string;
  /** 三级验证：L1 静态 / L2 可执行 / L3 语义 */
  level: 'L1' | 'L2' | 'L3';
  summary: string;
  ref: string;
  by: string;
  at: string;
}

export interface StateTransition { from: WorkItemStatus | '—'; to: WorkItemStatus; actor: string; reason: string; at: string }

export interface WorkItemBudget { tokens: number; cost: number; toolCalls: number; usedTokens: number; usedCost: number; usedToolCalls: number }

export interface WorkItem {
  itemId: string;
  shortId: string;
  parentId: string | null;
  level: WorkItemLevel;
  title: string;
  description: string;
  acceptance: AcceptanceItem[];
  evidence: EvidenceItem[];
  /** 证据驱动进度 0–100（不是人工填的百分比） */
  progress: number;
  dependsOn: Dependency[];
  /** 本项所在的关键路径（shortId 序列，用于高亮） */
  criticalPath: string[];
  workspace: string;
  writeScope: string[];
  assignee: { type: 'human' | 'agent' | 'team'; id: string; name: string };
  priority: Priority;
  budget: WorkItemBudget;
  specRef: { path: string; version: string } | null;
  status: WorkItemStatus;
  blockedReason?: string;
  /** metadata.failed：运行失败标记（不等于任务失败） */
  failedMark?: boolean;
  stateHistory: StateTransition[];
  children: string[];
  estimateHours: number;
  startAt?: string;
  endAt?: string;
  milestoneId?: string;
  /** 实际周期（已完成项） */
  cycleHours?: number;
  tags: string[];
  teamId?: string;
}

export interface GoalCriterion { id: string; text: string; verifyMethod: string; verdict: Verdict; evidenceRefs: string[] }

export interface InterventionPoint {
  id: string;
  name: string;
  /** 触发时机（阶段/条件） */
  when: string;
  mode: 'block' | 'notify';
  state: 'pending' | 'waiting' | 'passed';
  requestedAt?: string;
}

export interface GoalTermination { kind: 'achieved' | 'budget' | 'time' | 'failure' | 'revoke' | 'risk'; condition: string; triggered: boolean }

export interface GoalTick {
  tickNo: number;
  at: string;
  wake: '定时' | '事件' | '手动';
  action: string;
  progress: number;
  cost: number;
  note: string;
}

export interface Goal {
  goalId: string;
  shortId: string;
  objective: string;
  acceptanceCriteria: GoalCriterion[];
  constraints: string[];
  budget: { tokens: number; cost: number; durationMs: number; toolCalls: number; maxIterations: number };
  autonomyLevel: AutonomyLevel;
  interventionPoints: InterventionPoint[];
  reportingPolicy: { nodeChannel: string[]; periodicInterval: string; endReport: string; channels: string[] };
  termination: GoalTermination[];
  status: GoalStatus;
  /** 已满足验收条目的比例 */
  progressRatio: number;
  costTotal: number;
  ticksTotal: number;
  driftFlag: boolean;
  driftDetail?: string;
  planRef: { planId: string; title: string };
  owner: string;
  workspace: string;
  createdAt: string;
  lastTickAt: string;
  nextTickAt: string;
  ticks: GoalTick[];
}

export interface ScheduleTrigger {
  triggerId: string;
  kind: TriggerKind;
  /** 时间类：cron 表达式；事件类：事件名；条件类：表达式 */
  spec: string;
  timezone: string;
  debounceMs: number;
  throttleMs: number;
  idempotencyKeyRule: string;
  /** 组合触发器：AND / OR */
  combinator?: 'AND' | 'OR';
  children?: ScheduleTrigger[];
  enabled: boolean;
}

export interface ScheduleRun {
  runId: string;
  at: string;
  triggerSource: string;
  decision: string;
  actions: string[];
  outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'DEDUPLICATED' | 'ESCALATED' | 'PRECHECK_DENIED' | 'ROLLED_BACK';
  durationMs: number;
  cost: number;
  idempotencyKey: string;
  rollbackable: boolean;
}

export interface Schedule {
  scheduleId: string;
  name: string;
  enabled: boolean;
  triggers: ScheduleTrigger[];
  target: { kind: ScheduleTargetKind; ref: string; name: string };
  inputs: { key: string; value: string; desc: string }[];
  workspaceBinding: { workspace: string; branch: string; env: string };
  permissions: { allow: string[]; ceiling: string };
  concurrencyPolicy: ConcurrencyPolicy;
  notifications: { level: 'P0' | 'P1' | 'P2'; channels: string[] }[];
  circuitBreaker: { failureThreshold: number; alertTargets: string[]; recoveryMode: string; open: boolean; consecutiveFailures: number };
  retention: string;
  nextFireAt: string;
  lastRun: { at: string; outcome: ScheduleRun['outcome']; durationMs: number; cost: number };
  runs: ScheduleRun[];
  conflictWith: string[];
}

export interface TeamMember {
  memberId: string;
  name: string;
  roleRef: string;
  type: 'agent' | 'human';
  worktreeRef: string;
  quota: number;
  used: number;
  currentTaskId: string | null;
  state: MemberState;
  /** 人类成员的 SLA（分钟，超时提醒或转派） */
  slaMinutes?: number;
  claimable?: boolean;
}

export interface BoardDecision { id: string; at: string; by: string; text: string; impact: string }
export interface BoardBlocker { id: string; taskId: string; reason: string; owner: string; since: string; waitingOn: string }
export interface BoardEvidence { id: string; taskId: string; level: 'L1' | 'L2' | 'L3'; summary: string; by: string; at: string }

export interface TeamMessage {
  msgId: string;
  type: MessageType;
  /** 方向：from → to */
  dir: { from: string; to: string };
  payload: Record<string, string | number | string[]>;
  at: string;
  taskRef: string;
}

export interface Arbitration { id: string; at: string; dispute: string; views: { by: string; view: string }[]; ruling: string; reason: string; impact: string }

export interface MergeEntry {
  id: string;
  branch: string;
  target: string;
  status: MergeStatus;
  conflictFiles: string[];
  precheckResult: string;
  owner: string;
  enqueuedAt: string;
}

export interface Team {
  teamId: string;
  name: string;
  templateRef: string;
  topology: Topology;
  state: TeamState;
  budget: { total: number; used: number };
  goal: string;
  sessionRef: string;
  leadMemberId: string;
  members: TeamMember[];
  board: { evidence: BoardEvidence[]; decisions: BoardDecision[]; blockers: BoardBlocker[] };
  messages: TeamMessage[];
  arbitrations: Arbitration[];
  mergeQueue: MergeEntry[];
  report: { progress: number; cost: number; evidence: number; openItems: string[]; publishedAt: string };
  createdAt: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  kind: string;
  desc: string;
  steps: string[];
  acceptance: string[];
  risks: string[];
  usedCount: number;
  shared: boolean;
}

export interface Milestone { id: string; name: string; dueAt: string; status: '待开始' | '进行中' | '已达成' | '风险'; itemIds: string[] }

export interface SpecSection { key: string; title: string; body: string }
export interface SpecDoc {
  taskId: string;
  path: string;
  version: string;
  prevVersion: string;
  sections: SpecSection[];
  reviewers: { name: string; verdict: 'approve' | 'request_changes' | 'pending'; comment: string }[];
  changedSections: string[];
  replanRequired: boolean;
}

export interface DecompositionCandidate {
  id: string;
  level: WorkItemLevel;
  title: string;
  reason: string;
  risk: string;
  estimateHours: number;
  dependsOn: string[];
  acceptance: string;
  selected: boolean;
}

export interface PreemptionRecord {
  id: string;
  victimTaskId: string;
  victimTitle: string;
  byTaskId: string;
  priorityFrom: Priority;
  priorityTo: Priority;
  safePoint: string;
  checkpointRef: string;
  state: 'waiting_safe_point' | 'preempted' | 'resumed' | 'rejected';
  reason: string;
  at: string;
}

export interface AcceptanceCheck {
  id: string;
  taskId: string;
  level: 'L1' | 'L2' | 'L3';
  name: string;
  method: string;
  result: Verdict;
  evidenceRefs: string[];
  note: string;
}

export interface TaskData {
  workItems: WorkItem[];
  criticalPath: string[];
  cycleAttempts: { path: string[]; at: string; rejected: boolean; by: string }[];
  milestones: Milestone[];
  throughputSeries: { name: string; points: { x: string; y: number }[] }[];
  costWaterfall: { name: string; value: number }[];
  teamCostByMember: { name: string; value: number }[];
  templateLibrary: TaskTemplate[];
  specDocs: SpecDoc[];
  decomposition: { taskId: string; candidates: DecompositionCandidate[]; generatedBy: string; at: string };
  preemptions: PreemptionRecord[];
  acceptanceChecks: AcceptanceCheck[];
  goals: Goal[];
  schedules: Schedule[];
  teams: Team[];
}

/* ------------------------------------------------------------------ 构造工具 */

function acc(id: string, text: string, verifyMethod: string, verdict: Verdict, evidenceRefs: string[] = []): AcceptanceItem {
  return { id, text, verifyMethod, verdict, evidenceRefs };
}

function ev(id: string, level: EvidenceItem['level'], summary: string, ref: string, by: string, at: string): EvidenceItem {
  return { id, level, summary, ref, by, at };
}

function his(from: WorkItemStatus | '—', to: WorkItemStatus, actor: string, reason: string, at: string): StateTransition {
  return { from, to, actor, reason, at };
}

function dep(type: DepKind, targetShort: string, targetId: string): Dependency {
  return { type, targetId, targetShort };
}

/* ------------------------------------------------------------------ 主构造函数 */

export function buildTaskData(r: Rng): TaskData {
  const wsMain = 'local:/worktrees/payment-core';
  const wsDocs = 'local:/worktrees/docs-portal';
  const repos = r.sample(REPOS, 4);

  /* ------------------------------ WorkItem：Goal → Plan → Task → Step */
  const items: WorkItem[] = [];
  let seq = 0;
  const ids: Record<string, string> = {};
  const shortOf = (s: string) => ids[s];

  interface Seed {
    short: string; level: WorkItemLevel; title: string; desc: string; status: WorkItemStatus;
    priority: Priority; parent: string | null; hor: [number, number]; tags: string[];
    deps?: [DepKind, string][]; scope: string[]; assignee: WorkItem['assignee'];
    accs: [string, string, Verdict][]; evs: [EvidenceItem['level'], string, string][];
    spec?: [string, string]; blocked?: string; failed?: boolean; milestone?: string; ws?: string;
  }

  const seeds: Seed[] = [
    {
      short: 'G-1a20', level: 'goal', title: '支付链路口径统一（幂等 + 回执）', desc: '以证据驱动方式统一支付回执幂等语义，覆盖 3 个服务与 1 份对外契约。',
      status: 'in_progress', priority: 'HIGH', parent: null, hor: [-52, -1], tags: ['goal', 'payment'], scope: ['src/payment/**'],
      assignee: { type: 'human', id: 'u-shenyz', name: '沈亦舟' },
      accs: [['验收标准全覆盖且有证据', '证据完整度 ≥ 90%', 'pass'], ['零回归', '回归用例全绿', 'pending']],
      evs: [['L2', '12 条验收条目中 10 条已有证据', 'evidence://goal-1a20']],
    },
    {
      short: 'P-3c11', level: 'plan', title: 'Plan A · 幂等内核与回执', desc: '交付幂等内核（唯一约束 + 冲突回读 + 单测），作为后续批次的地基。',
      status: 'in_progress', priority: 'HIGH', parent: 'G-1a20', hor: [-48, -6], tags: ['plan'], scope: ['src/payment/**', 'src/test/**'],
      assignee: { type: 'team', id: 'TEAM-checkout-01', name: '结算攻坚队' },
      accs: [['内核上线且无 P1 缺陷', '灰度 7 天缺陷口径', 'pass']],
      evs: [['L2', '灰度 7 天：幂等冲突率 0.002%', 'evidence://plan-3c11-gray']],
    },
    {
      short: 'P-4d07', level: 'plan', title: 'Plan B · 对外契约与文档同步', desc: '对外 OpenAPI 契约与知识库文档同步，含弃用告警。',
      status: 'ready', priority: 'NORMAL', parent: 'G-1a20', hor: [-20, 30], tags: ['plan', 'docs'], scope: ['docs/**', 'openapi/**'],
      assignee: { type: 'human', id: 'u-linwz', name: '林晚照' },
      accs: [['契约评审通过', '评审记录 + 版本号', 'pending']],
      evs: [],
    },
    {
      short: 'T-7f3a', level: 'task', title: '回执幂等校验（唯一约束 + 冲突回读）', desc: '为 handleRetry 增加幂等校验：持久层唯一约束命中后回读首次结果，不重复扣减。',
      status: 'in_review', priority: 'URGENT', parent: 'P-3c11', hor: [-30, -2], tags: ['payment', 'idempotent'],
      deps: [['finish_to_start', 'T-1b02']], scope: ['src/payment/service/PaymentServiceImpl.java', 'src/payment/mapper/**'],
      assignee: { type: 'agent', id: 'agent-impl-01', name: '实现者 · 落霞' },
      accs: [['并发重试仅扣减一次', 'L2：并发 200 次重放用例', 'pass'], ['公开签名不变', 'L1：japicmp 基线比对', 'pass'], ['移动端并发场景验证', 'L3：人工判据', 'unverifiable']],
      evs: [['L1', 'japicmp：0 处不兼容变更', 'evidence://T-7f3a/japicmp'], ['L2', '128 passed / 0 failed（含 12 例幂等）', 'evidence://T-7f3a/junit']],
      spec: ['.oc/tasks/T-7f3a.md', 'v3'], milestone: 'M-2',
    },
    {
      short: 'T-1b02', level: 'task', title: '持久层唯一约束迁移', desc: '新增 uk_trade_no 唯一索引迁移脚本，含回滚脚本与空库演练。',
      status: 'done', priority: 'HIGH', parent: 'P-3c11', hor: [-34, -24], tags: ['migration'],
      scope: ['migrations/V2026_09__uk_trade_no.sql'], assignee: { type: 'agent', id: 'agent-impl-01', name: '实现者 · 落霞' },
      accs: [['空库与样本库均可执行', 'L2：迁移流水线 6 阶段', 'pass'], ['回滚脚本可用', 'L2：回滚演练', 'pass']],
      evs: [['L2', '迁移流水线全绿（含回滚演练）', 'evidence://T-1b02/pipeline'], ['L1', 'DDL 静态校验通过', 'evidence://T-1b02/ddl-lint']],
      milestone: 'M-1', ws: wsMain,
    },
    {
      short: 'T-2e88', level: 'task', title: '回执重试告警埋点', desc: '为幂等冲突新增指标与告警规则，绑定 Runbook。',
      status: 'in_progress', priority: 'NORMAL', parent: 'P-3c11', hor: [-8, 22], tags: ['observability'],
      deps: [['artifact', 'T-7f3a']], scope: ['src/payment/observability/**', 'deploy/alert-rules/**'],
      assignee: { type: 'agent', id: 'agent-obs-04', name: '观测者 · 望舒' },
      accs: [['冲突率指标可见', 'L2：指标断言', 'pending'], ['告警绑定 Runbook', 'L1：规则校验', 'pass']],
      evs: [['L1', 'alert-rules 静态校验通过', 'evidence://T-2e88/alert-lint']],
    },
    {
      short: 'T-5a31', level: 'task', title: '移动端并发重试外部验证', desc: '移动端弱网并发场景需真机验证，人工判据无法由 Agent 闭环。',
      status: 'blocked', priority: 'HIGH', parent: 'P-3c11', hor: [-6, 14], tags: ['e2e', 'mobile'],
      deps: [['decision', 'D-0007']], scope: ['src/payment/service/PaymentServiceImpl.java'],
      assignee: { type: 'human', id: 'u-zhouyq', name: '周砚青' },
      accs: [['弱网 200 次重试仅一次扣减', 'L3：真机 + 抓包证据', 'unverifiable']],
      evs: [], blocked: '等待移动端团队排期：设备池被 release/2.9 全量回归占用，最早 09-24 可排。',
    },
    {
      short: 'T-9c40', level: 'task', title: '批量重构：回执处理抽取公共模板', desc: '将 6 个服务的回执处理抽取为公共模板方法，保持行为等价。',
      status: 'in_progress', priority: 'NORMAL', parent: 'P-3c11', hor: [-12, 36], tags: ['refactor', 'fanout'],
      scope: ['src/*/receipt/**'], assignee: { type: 'team', id: 'TEAM-migrate-02', name: '重构扇出队' },
      accs: [['行为等价（差分测试）', 'L2：旧新实现对拍 1e4 组合', 'pass'], ['6 个服务全部接入', 'L1：清单核对', 'pending']],
      evs: [['L2', '对拍 10,000 组合 0 差异', 'evidence://T-9c40/diff-test']],
    },
    {
      short: 'T-3f72', level: 'task', title: 'OpenAPI 契约更新与弃用告警', desc: '发布 v2 契约并对 v1 字段加弃用标记，附迁移窗口 90 天。',
      status: 'ready', priority: 'NORMAL', parent: 'P-4d07', hor: [6, 40], tags: ['contract'],
      deps: [['decision', 'D-0009'], ['artifact', 'T-7f3a']], scope: ['openapi/payment.yaml'],
      assignee: { type: 'human', id: 'u-linwz', name: '林晚照' },
      accs: [['契约评审通过', '评审记录 ≥ 2 名评审人', 'pending'], ['弃用告警可查', 'L2：告警断言', 'pending']],
      evs: [],
    },
    {
      short: 'T-6b21', level: 'task', title: '知识库文档同步（口径与故障处置）', desc: '同步幂等口径与故障处置 Runbook 到知识库，避免文档漂移。',
      status: 'backlog', priority: 'LOW', parent: 'P-4d07', hor: [30, 54], tags: ['docs'],
      deps: [['finish_to_start', 'T-3f72']], scope: ['docs/payment/**'], ws: wsDocs,
      assignee: { type: 'agent', id: 'agent-doc-07', name: '文档者 · 知微' },
      accs: [['文档与实现一致', 'L3：语义比对 + 人工抽检', 'pending']], evs: [],
    },
    {
      short: 'T-8d99', level: 'task', title: '依赖升级：PostgreSQL JDBC 42.7', desc: '升级驱动并验证连接池行为与 TLS 配置兼容。',
      status: 'done', priority: 'NORMAL', parent: 'P-3c11', hor: [-70, -48], tags: ['deps'],
      scope: ['pom.xml', 'src/main/resources/application.yml'], assignee: { type: 'agent', id: 'agent-impl-02', name: '实现者 · 听澜' },
      accs: [['全量回归通过', 'L2：mvn verify', 'pass'], ['TLS 握手兼容', 'L2：握手诊断', 'pass']],
      evs: [['L2', 'mvn verify 全绿；连接池指标无劣化', 'evidence://T-8d99/verify']], milestone: 'M-1',
    },
    {
      short: 'T-0e15', level: 'task', title: '回归批次：release/2.9 全量', desc: '发布前全量回归，含性能基线与安全扫描。',
      status: 'blocked', priority: 'URGENT', parent: 'P-3c11', hor: [10, 34], tags: ['release'],
      deps: [['finish_to_start', 'T-9c40']], scope: ['*'], assignee: { type: 'team', id: 'TEAM-checkout-01', name: '结算攻坚队' },
      accs: [['全量回归全绿', 'L2：流水线证据', 'pending'], ['性能不劣化 > 5%', 'L2：基准对比', 'pending']],
      evs: [], blocked: '设备池排期冲突：与 TEAM-migrate-02 的批量对拍争用同一套真机环境，已申请错峰至 09-25 02:00。',
    },
    {
      short: 'T-4c66', level: 'task', title: '废弃任务：旧版对账脚本清理', desc: '需求方已撤销清理计划（对账仍依赖旧脚本），保留记录以备追溯。',
      status: 'cancelled', priority: 'LOW', parent: 'P-3c11', hor: [-40, -30], tags: ['cleanup'],
      scope: ['scripts/reconcile/**'], assignee: { type: 'agent', id: 'agent-impl-02', name: '实现者 · 听澜' },
      accs: [['旧脚本停止被调用', 'L1：调用点扫描', 'fail']], evs: [], blocked: '需求方撤销：对账流程仍依赖旧脚本，清理将导致月度对账中断。',
    },
    {
      short: 'S-11a1', level: 'step', title: '读取 PaymentServiceImpl 与调用链', desc: '定位 handleRetry 与扣减入口，产出调用链草图。',
      status: 'done', priority: 'NORMAL', parent: 'T-7f3a', hor: [-30, -26], tags: ['step'],
      scope: ['src/payment/service/PaymentServiceImpl.java'], assignee: { type: 'agent', id: 'agent-impl-01', name: '实现者 · 落霞' },
      accs: [['调用链完整（含异步分支）', '人工判据', 'pass']], evs: [['L1', '调用链草图 + 符号引用', 'evidence://S-11a1/callgraph']],
    },
    {
      short: 'S-11a2', level: 'step', title: '编写并发重放用例', desc: '构造 200 并发重放，断言扣减一次、回读首次结果。',
      status: 'done', priority: 'HIGH', parent: 'T-7f3a', hor: [-14, -8], tags: ['step', 'test'],
      scope: ['src/test/java/**'], assignee: { type: 'agent', id: 'agent-test-03', name: '测试者 · 清尘' },
      accs: [['200 并发 0 重复扣减', 'L2：用例通过', 'pass']], evs: [['L2', 'IdempotentRetryTest 12 例全绿', 'evidence://S-11a2/junit']],
    },
    {
      short: 'S-11a3', level: 'step', title: '在真机验证弱网重试', desc: '需要真机与设备池，当前被阻塞。',
      status: 'blocked', priority: 'HIGH', parent: 'T-5a31', hor: [-4, 12], tags: ['step', 'mobile'],
      scope: ['*'], assignee: { type: 'human', id: 'u-zhouyq', name: '周砚青' },
      accs: [['弱网 200 次重试仅一次扣减', 'L3：抓包 + 服务端日志', 'pending']],
      evs: [], blocked: '设备池不可用（与 T-0e15 争用同一真机环境）。',
    },
  ];

  seeds.forEach((s) => {
    seq += 1;
    const itemId = `wi-${s.short.toLowerCase()}`;
    ids[s.short] = itemId;
    const startAt = r.agoHours(Math.abs(s.hor[0]));
    const ended = s.status === 'done' || s.status === 'cancelled';
    const endAt = r.agoHours(Math.abs(s.hor[1]));
    const doneAcc = s.accs.filter((a) => a[2] === 'pass').length;
    const progress = s.status === 'done' ? 100
      : s.status === 'cancelled' ? 0
        : Math.round((doneAcc / Math.max(1, s.accs.length)) * 100);
    const evidence: EvidenceItem[] = s.evs.map((e, i) => ev(`${s.short}-E${i + 1}`, e[0], e[1], e[2], s.assignee.name, r.agoHours(Math.abs(s.hor[1]) + i + 1)));

    const history: StateTransition[] = [];
    history.push(his('—', 'backlog', s.assignee.type === 'human' ? s.assignee.name : '主管 Agent', '创建（来自分解或模板）', startAt));
    if (s.level === 'task' || s.level === 'step') {
      history.push(his('backlog', 'ready', '主管 Agent', '依赖满足且验收标准可检验', r.agoHours(Math.abs(s.hor[0]) - 1)));
    }
    if (s.status === 'cancelled') {
      history.push(his('ready', 'cancelled', s.assignee.name, '需求方撤销，保留审计记录', r.agoHours(Math.abs(s.hor[1]))));
    } else if (s.status === 'blocked') {
      history.push(his('ready', 'in_progress', s.assignee.name, '认领并开始执行', r.agoHours(Math.abs(s.hor[0]) - 1)));
      history.push(his('in_progress', 'blocked', s.assignee.name, s.blocked ?? '外部依赖不可用', r.agoHours(3)));
    } else if (s.status === 'done') {
      history.push(his('ready', 'in_progress', s.assignee.name, '认领并开始执行', r.agoHours(Math.abs(s.hor[0]) - 1)));
      history.push(his('in_progress', 'in_review', s.assignee.name, '提交验收并附证据', r.agoHours(Math.abs(s.hor[1]) + 2)));
      history.push(his('in_review', 'done', '验收人 · 顾清和', '逐条验收通过，证据完整', endAt));
    } else if (s.status === 'in_review') {
      history.push(his('ready', 'in_progress', s.assignee.name, '认领并开始执行', r.agoHours(Math.abs(s.hor[0]) - 1)));
      history.push(his('in_progress', 'in_review', s.assignee.name, '提交验收；L3 条目未验证已标注', r.agoHours(Math.abs(s.hor[1]))));
    } else if (s.status === 'in_progress') {
      history.push(his('ready', 'in_progress', s.assignee.name, '认领并开始执行', r.agoHours(Math.abs(s.hor[0]) - 1)));
    }

    items.push({
      itemId, shortId: s.short, parentId: s.parent ? ids[s.parent] : null, level: s.level,
      title: s.title, description: s.desc,
      acceptance: s.accs.map((a, i) => acc(`${s.short}-A${i + 1}`, a[0], a[1], a[2], evidence.filter((e) => a[2] === 'pass').slice(0, 1).map((e) => e.id))),
      evidence, progress,
      dependsOn: (s.deps ?? []).map((d) => dep(d[0], d[1], ids[d[1]])),
      criticalPath: [],
      workspace: s.ws ?? wsMain, writeScope: s.scope,
      assignee: s.assignee, priority: s.priority,
      budget: {
        tokens: r.int(120, 900) * 1000, cost: r.float(2, 26, 2), toolCalls: r.int(40, 320),
        usedTokens: Math.round((r.int(120, 900) * 1000) * (progress / 100 || 0.2)),
        usedCost: Number((r.float(2, 26, 2) * (progress / 100 || 0.25)).toFixed(2)),
        usedToolCalls: Math.round(r.int(40, 320) * (progress / 100 || 0.2)),
      },
      specRef: s.spec ? { path: s.spec[0], version: s.spec[1] } : null,
      status: s.status, blockedReason: s.blocked, failedMark: s.failed,
      stateHistory: history, children: [], estimateHours: r.int(2, 40),
      startAt, endAt: ended ? endAt : undefined,
      milestoneId: s.milestone, cycleHours: ended ? r.int(6, 60) : undefined,
      tags: s.tags, teamId: s.parent === 'P-3c11' ? 'TEAM-checkout-01' : undefined,
    });
  });

  // 父子关系与关键路径（Goal → Plan → Task → Step 主线）
  const byShort = (s: string) => items.find((i) => i.shortId === s);
  ['P-3c11', 'P-4d07'].forEach((p) => { const plan = byShort(p); if (plan) plan.children = items.filter((i) => i.parentId === plan.itemId).map((i) => i.itemId); });
  const goalItem = byShort('G-1a20');
  if (goalItem) goalItem.children = items.filter((i) => i.parentId === goalItem.itemId).map((i) => i.itemId);
  ['T-7f3a', 'T-5a31'].forEach((t) => { const tk = byShort(t); if (tk) tk.children = items.filter((i) => i.parentId === tk.itemId).map((i) => i.itemId); });

  const criticalPath = ['G-1a20', 'P-3c11', 'T-1b02', 'T-7f3a', 'T-0e15'];
  items.forEach((i) => { i.criticalPath = criticalPath.includes(i.shortId) ? criticalPath : []; });

  /* ------------------------------ 里程碑 */
  const milestones: Milestone[] = [
    { id: 'M-1', name: 'M1 · 地基就绪（迁移 + 驱动）', dueAt: r.agoDays(20), status: '已达成', itemIds: ['T-1b02', 'T-8d99'].map((s) => shortOf(s)) },
    { id: 'M-2', name: 'M2 · 幂等内核验收', dueAt: r.future(60 * 24 * 2), status: '进行中', itemIds: ['T-7f3a'].map((s) => shortOf(s)) },
    { id: 'M-3', name: 'M3 · 批量重构接入 6 服务', dueAt: r.future(60 * 24 * 9), status: '风险', itemIds: ['T-9c40'].map((s) => shortOf(s)) },
    { id: 'M-4', name: 'M4 · 契约与文档同步', dueAt: r.future(60 * 24 * 20), status: '待开始', itemIds: ['T-3f72', 'T-6b21'].map((s) => shortOf(s)) },
    { id: 'M-5', name: 'M5 · 发布 2.9 全量回归', dueAt: r.future(60 * 24 * 30), status: '风险', itemIds: ['T-0e15'].map((s) => shortOf(s)) },
  ];

  /* ------------------------------ 规格文档（八段） */
  const specDocs: SpecDoc[] = [
    {
      taskId: shortOf('T-7f3a'), path: '.oc/tasks/T-7f3a.md', version: 'v3', prevVersion: 'v2',
      sections: [
        { key: 'background', title: '1. 背景', body: '网关在超时后重发回执，handleRetry 无幂等校验，导致同笔交易二次扣减。近 30 天共 7 起（对账差异 0.003%）。' },
        { key: 'goal', title: '2. 目标', body: '同一 tradeNo 的重放回执仅生效一次；冲突时回读首次结果并返回成功，保持公开签名不变。' },
        { key: 'acceptance', title: '3. 验收标准', body: 'A1 并发 200 重放仅一次扣减（L2）；A2 japicmp 无不兼容变更（L1）；A3 真机弱网验证（L3，需人工）。' },
        { key: 'constraints', title: '4. 约束', body: '不得修改 PaymentService 公开签名；不得引入新依赖；迁移脚本必须可回滚；写范围限 payment 模块。' },
        { key: 'impact', title: '5. 影响范围', body: 'payment-core（服务 + Mapper + 迁移）；下游 settlement-job 与 reconciliation 读取口径不变。' },
        { key: 'approach', title: '6. 技术方案要点', body: '持久层唯一索引 uk_trade_no + 冲突回读；应用层捕获 DuplicateKeyException 后按 tradeNo 回查并返回既有结果。' },
        { key: 'test-plan', title: '7. 测试计划', body: '单测 12 例（含并发重放、跨日重放）；集成测试使用 Testcontainers；灰度 7 天观测冲突率指标。' },
        { key: 'risks', title: '8. 风险', body: 'R1 唯一索引在存量数据有重复值 → 迁移前执行去重预检；R2 回读延迟 → 命中缓存并设置 50ms 上限。' },
      ],
      reviewers: [
        { name: '顾清和（架构）', verdict: 'approve', comment: '方案与既有唯一约束策略一致，同意。' },
        { name: '韩秋水（SRE）', verdict: 'request_changes', comment: '请在测试计划中补充迁移前后的慢查询对比。' },
        { name: '周砚青（移动端）', verdict: 'pending', comment: '' },
      ],
      changedSections: ['3. 验收标准', '7. 测试计划'],
      replanRequired: true,
    },
    {
      taskId: shortOf('T-9c40'), path: '.oc/tasks/T-9c40.md', version: 'v1', prevVersion: 'v1',
      sections: [
        { key: 'background', title: '1. 背景', body: '6 个服务各自实现回执处理，行为分叉（3 处超时语义不同），缺陷定位成本高。' },
        { key: 'goal', title: '2. 目标', body: '抽取公共模板方法并保持行为等价，一次修复全链路生效。' },
        { key: 'acceptance', title: '3. 验收标准', body: 'A1 旧新实现对拍 10,000 组合 0 差异（L2）；A2 6 个服务全部接入（L1 清单核对）。' },
        { key: 'constraints', title: '4. 约束', body: '批量重构分 6 批串行合入；每批必须通过该服务的契约测试。' },
        { key: 'impact', title: '5. 影响范围', body: '6 个服务的 receipt 包；公共模块新增 receipt-template。' },
        { key: 'approach', title: '6. 技术方案要点', body: '模板方法 + 差异回调；对拍工具复用差分工件生成器。' },
        { key: 'test-plan', title: '7. 测试计划', body: '逐服务契约测试 + 全量对拍 + 每批合并前预检。' },
        { key: 'risks', title: '8. 风险', body: 'R1 隐藏行为差异（如日志字段）→ 对拍覆盖日志摘要；R2 合并队列拥塞 → 限批 2 个并行。' },
      ],
      reviewers: [{ name: '顾清和（架构）', verdict: 'approve', comment: '分批合入 + 对拍是正确路径。' }],
      changedSections: [],
      replanRequired: false,
    },
  ];

  /* ------------------------------ 候选分解（人机协同） */
  const decomposition: TaskData['decomposition'] = {
    taskId: shortOf('T-3f72'),
    generatedBy: 'claude-sonnet-4.5 · 分解策略 decomposition-strategy@2',
    at: r.agoHours(5),
    candidates: [
      { id: 'C1', level: 'task', title: '起草 v2 契约（新增 idempotencyKey 字段）', reason: '契约先行，避免下游各自猜测字段语义', risk: '低：向后兼容', estimateHours: 4, dependsOn: [], acceptance: 'OpenAPI 校验通过 + 2 名评审人 approve', selected: true },
      { id: 'C2', level: 'task', title: 'v1 字段弃用标记与迁移窗口', reason: '给下游 90 天迁移窗口，降低破坏面', risk: '中：下游可能忽略弃用告警', estimateHours: 3, dependsOn: ['C1'], acceptance: '弃用告警可查且进入发布说明', selected: true },
      { id: 'C3', level: 'task', title: '契约变更对账脚本回归', reason: '口径变更可能影响月度对账，需回归', risk: '中：对账脚本无自动化用例', estimateHours: 6, dependsOn: ['C1'], acceptance: '对账差异 ≤ 0.001%', selected: true },
      { id: 'C4', level: 'task', title: '重写网关侧请求适配层', reason: '模型推测网关需要重构以适配新字段', risk: '高：与既有适配层职责重叠，可能引入回归', estimateHours: 12, dependsOn: ['C1'], acceptance: '适配层单测全绿', selected: false },
      { id: 'C5', level: 'step', title: '补充 idempotencyKey 幂等语义示例', reason: '契约需要可执行示例，否则联调歧义', risk: '低', estimateHours: 1, dependsOn: [], acceptance: '示例可被 swagger-cli 校验', selected: true },
    ],
  };

  /* ------------------------------ 抢占记录 */
  const preemptions: PreemptionRecord[] = [
    {
      id: 'PM-01', victimTaskId: shortOf('T-9c40'), victimTitle: '批量重构：回执处理抽取公共模板', byTaskId: shortOf('T-0e15'),
      priorityFrom: 'NORMAL', priorityTo: 'URGENT', safePoint: '第 3 批完成后（工作区已提交，无未落盘副作用）',
      checkpointRef: 'ckp_9c40_p3', state: 'preempted', at: r.agoHours(2),
      reason: '发布窗口提前 24 小时，回归批次需独占设备池与合并队列。',
    },
    {
      id: 'PM-02', victimTaskId: shortOf('T-2e88'), victimTitle: '回执重试告警埋点', byTaskId: shortOf('T-0e15'),
      priorityFrom: 'NORMAL', priorityTo: 'URGENT', safePoint: '当前无进行中的工具调用（只读检索阶段）',
      checkpointRef: 'ckp_2e88_s1', state: 'waiting_safe_point', at: r.agoHours(1),
      reason: '同一工作区写范围重叠（deploy/alert-rules），需等待安全点。',
    },
    {
      id: 'PM-03', victimTaskId: shortOf('T-8d99'), victimTitle: '依赖升级：PostgreSQL JDBC 42.7', byTaskId: shortOf('T-7f3a'),
      priorityFrom: 'NORMAL', priorityTo: 'URGENT', safePoint: '任务已完成',
      checkpointRef: 'ckp_8d99_done', state: 'resumed', at: r.agoDays(2),
      reason: '抢占后已于当日 21:40 从检查点恢复并完成验收。',
    },
    {
      id: 'PM-04', victimTaskId: shortOf('T-6b21'), victimTitle: '知识库文档同步', byTaskId: shortOf('T-4c66'),
      priorityFrom: 'LOW', priorityTo: 'LOW', safePoint: '不可抢占：文档工作区无检查点能力',
      checkpointRef: '—', state: 'rejected', at: r.agoDays(3),
      reason: '被抢占任务无检查点（工作区 docs-portal 未启用快照），按安全优先拒绝抢占。',
    },
  ];

  /* ------------------------------ 三级验证汇总 */
  const acceptanceChecks: AcceptanceCheck[] = [
    { id: 'AC-01', taskId: shortOf('T-7f3a'), level: 'L1', name: '静态检查', method: 'japicmp 基线比对 + 依赖扫描 + 格式检查', result: 'pass', evidenceRefs: [`${'T-7f3a'}-E1`], note: '0 处不兼容变更；无新增依赖。' },
    { id: 'AC-02', taskId: shortOf('T-7f3a'), level: 'L2', name: '可执行验证', method: 'JUnit 128 例（含 12 例并发幂等重放）', result: 'pass', evidenceRefs: [`${'T-7f3a'}-E2`], note: '200 并发重放：扣减 1 次，回读 199 次。' },
    { id: 'AC-03', taskId: shortOf('T-7f3a'), level: 'L3', name: '语义验证', method: '真机弱网抓包 + 人工判据', result: 'unverifiable', evidenceRefs: [], note: '未验证项：移动端弱网并发场景无真机证据（依赖 T-5a31）。' },
    { id: 'AC-04', taskId: shortOf('T-0e15'), level: 'L2', name: '可执行验证', method: '发布流水线全量回归 + 性能基线对比', result: 'pending', evidenceRefs: [], note: '等待设备池排期（与 T-9c40 冲突）。' },
    { id: 'AC-05', taskId: shortOf('T-4c66'), level: 'L1', name: '静态检查', method: '调用点扫描（scripts/reconcile）', result: 'fail', evidenceRefs: [], note: '仍被月度对账调用 6 处，取消任务判定为非法完成。' },
    { id: 'AC-06', taskId: shortOf('T-8d99'), level: 'L3', name: '语义验证', method: '连接池指标语义比对（人工抽检）', result: 'pass', evidenceRefs: [`${'T-8d99'}-E1`], note: 'TLS 握手行为与升级前一致。' },
  ];

  /* ------------------------------ Goal 契约 */
  const goalSeeds: {
    short: string; objective: string; status: GoalStatus; autonomy: AutonomyLevel; drift: boolean;
    ticks: number; ratio: number; cost: number; constraint: string[]; plan: [string, string];
  }[] = [
    { short: 'G-2f51', objective: '在 3 周内把支付链路回执幂等缺陷降到 0，并让对外契约与文档同步（口径唯一）。', status: 'started', autonomy: 'collaborate', drift: false, ticks: 412, ratio: 0.72, cost: 18.42, constraint: ['不得修改 PaymentService 公开签名', '不得引入新的第三方依赖', '只允许在 business_hours 内执行写操作（09:00–21:00）'], plan: ['P-3c11', 'Plan A · 幂等内核与回执'] },
    { short: 'G-3a88', objective: '把 6 个服务的回执处理收敛为单一模板实现，行为等价且可回归验证。', status: 'started', autonomy: 'autonomous', drift: true, ticks: 268, ratio: 0.41, cost: 31.07, constraint: ['每批合入前必须通过对拍', '分批串行合入（同工作区）', '单批预算 ≤ $6'], plan: ['P-5b30', 'Plan C · 批量重构分批合入'] },
    { short: 'G-4c19', objective: '升级 PostgreSQL JDBC 至 42.7 并验证连接池与 TLS 行为无劣化。', status: 'achieved', autonomy: 'propose', drift: false, ticks: 96, ratio: 1, cost: 4.86, constraint: ['仅升级驱动，不动连接池参数'], plan: ['P-6d44', 'Plan D · 依赖升级'] },
    { short: 'G-5d72', objective: '把月度对账脚本迁移到新对账服务并下线旧脚本。', status: 'paused', autonomy: 'collaborate', drift: true, ticks: 154, ratio: 0.35, cost: 9.34, constraint: ['对账差异必须为 0 才能切换', '切换需财务确认'], plan: ['P-7e21', 'Plan E · 对账迁移'] },
    { short: 'G-6e03', objective: '为 release/2.9 建立性能基线并保持回归不劣化 5%。', status: 'failed', autonomy: 'autonomous', drift: false, ticks: 502, ratio: 0.58, cost: 44.9, constraint: ['不得在发布冻结期执行压测', '压测流量必须走影子环境'], plan: ['P-8f90', 'Plan F · 性能基线'] },
    { short: 'G-7a44', objective: '清理 scripts/ 下全部历史对账脚本与临时修复脚本。', status: 'cancelled', autonomy: 'propose', drift: false, ticks: 31, ratio: 0.1, cost: 1.12, constraint: ['需需求方书面确认'], plan: ['P-9a12', 'Plan G · 脚本清理'] },
  ];

  const goals: Goal[] = goalSeeds.map((g, gi) => {
    const criteria: GoalCriterion[] = [
      { id: `${g.short}-C1`, text: '所有验收条目均有可检验证据', verifyMethod: '逐条证据评审（证据完整度 ≥ 90%）', verdict: g.ratio >= 0.9 ? 'pass' : g.ratio >= 0.5 ? 'pending' : 'fail', evidenceRefs: gi === 0 ? ['T-7f3a-E1', 'T-7f3a-E2'] : [] },
      { id: `${g.short}-C2`, text: '零回归（全量用例通过）', verifyMethod: '发布流水线全量回归', verdict: g.status === 'achieved' ? 'pass' : 'pending', evidenceRefs: [] },
      { id: `${g.short}-C3`, text: '成本不超预算（水位 ≤ 90%）', verifyMethod: '预算水位核算', verdict: g.cost > 30 ? 'fail' : 'pass', evidenceRefs: [] },
      { id: `${g.short}-C4`, text: '口径变更已同步知识库并有人工抽检', verifyMethod: 'L3 语义比对 + 人工抽检', verdict: 'unverifiable', evidenceRefs: [] },
    ];
    const ticks: GoalTick[] = Array.from({ length: 8 }, (_, i) => {
      const step = Math.min(g.ticks, Math.round((g.ticks / 8) * (i + 1)));
      return {
        tickNo: step,
        at: r.agoHours((8 - i) * (gi + 1) * 2),
        wake: r.weighted(['定时', '事件', '手动'] as const, [6, 3, 1]),
        action: gi === 2
          ? ['评估：无待推进任务', '推进 T-8d99 验收', '写检查点', '生成阶段汇报'][i % 4]
          : ['推进关键路径任务', '处理阻塞（设备池排期）', '回收闲置成员预算', '生成周期汇报', '重算关键路径', '等待人工介入点', '处理预算告警', '写检查点'][i % 8],
        progress: Math.round(g.ratio * 100 * ((i + 1) / 8)),
        cost: Number(((g.cost / 8) * (i + 1)).toFixed(2)),
        note: i === 6 && g.drift ? '漂移指标越过阈值：产出语义相似度 0.61（阈值 0.70），已暂停并汇报。' : '无异常。',
      };
    });
    return {
      goalId: `goal-${g.short.toLowerCase()}`, shortId: g.short, objective: g.objective,
      acceptanceCriteria: criteria, constraints: g.constraint,
      budget: { tokens: r.int(8, 26) * 1_000_000, cost: r.float(20, 60, 2), durationMs: r.int(6, 30) * 86_400_000, toolCalls: r.int(600, 3200), maxIterations: r.int(400, 1200) },
      autonomyLevel: g.autonomy,
      interventionPoints: [
        { id: `${g.short}-I1`, name: '契约发布前确认', when: '发布 v2 契约前', mode: 'block', state: g.status === 'achieved' ? 'passed' : 'pending' },
        { id: `${g.short}-I2`, name: '生产数据迁移前确认', when: '执行迁移脚本前', mode: 'block', state: gi === 0 ? 'waiting' : 'passed', requestedAt: gi === 0 ? r.agoHours(2) : undefined },
        { id: `${g.short}-I3`, name: '成本逼近上限提醒', when: '预算水位 ≥ 80%', mode: 'notify', state: 'passed' },
      ],
      reportingPolicy: {
        nodeChannel: ['阶段完成', '阻塞', '风险事件'],
        periodicInterval: gi === 1 ? '每 15 分钟' : '每 30 分钟或每 10 步（先到者为准）',
        endReport: '完整报告（验收结论 + 证据清单 + 成本账 + 未决项）',
        channels: ['界面内', '桌面通知', gi % 2 === 0 ? 'IM 机器人' : '邮件'],
      },
      termination: [
        { kind: 'achieved', condition: '全部验收标准有证据且确认通过', triggered: g.status === 'achieved' },
        { kind: 'budget', condition: '累计成本 ≥ 预算硬上限', triggered: g.status === 'failed' },
        { kind: 'time', condition: '超过 3 周窗口', triggered: false },
        { kind: 'failure', condition: '连续失败 ≥ 3 次', triggered: false },
        { kind: 'revoke', condition: '用户撤销目标', triggered: g.status === 'cancelled' },
        { kind: 'risk', condition: '命中风险事件（越权/生产写入）', triggered: false },
      ],
      status: g.status, progressRatio: g.ratio, costTotal: g.cost, ticksTotal: g.ticks,
      driftFlag: g.drift,
      driftDetail: g.drift ? '产出与目标语义相似度 0.61（阈值 0.70）；验收进展 3 步未变化；约束扫描命中 1 项（未分批串行合入）。' : undefined,
      planRef: { planId: g.plan[0], title: g.plan[1] },
      owner: r.pick(NAMES), workspace: gi % 2 === 0 ? wsMain : wsDocs,
      createdAt: r.agoDays(30 - gi * 3), lastTickAt: r.ago(4), nextTickAt: r.future(gi === 1 ? 1 : 6),
      ticks,
    };
  });

  /* ------------------------------ Schedule 计划 */
  const tz = 'Asia/Shanghai';
  const triggerSeeds: ScheduleTrigger[] = [
    { triggerId: 'TR-1', kind: 'time', spec: '0 2 * * 1-5', timezone: tz, debounceMs: 0, throttleMs: 60_000, idempotencyKeyRule: '{scheduleId}:{cronWindow}:{workspace}', enabled: true },
    { triggerId: 'TR-2', kind: 'event', spec: 'git.push:branch=main', timezone: tz, debounceMs: 30_000, throttleMs: 300_000, idempotencyKeyRule: '{scheduleId}:{commitSha}', enabled: true },
    { triggerId: 'TR-3', kind: 'condition', spec: 'dependency.new_version_available == true && severity >= "minor"', timezone: tz, debounceMs: 0, throttleMs: 86_400_000, idempotencyKeyRule: '{scheduleId}:{packageName}:{newVersion}', enabled: true },
    { triggerId: 'TR-4', kind: 'manual', spec: 'oc schedule run <id>', timezone: tz, debounceMs: 0, throttleMs: 10_000, idempotencyKeyRule: '{scheduleId}:{operatorId}:{manualNonce}', enabled: true },
    {
      triggerId: 'TR-5', kind: 'composite', spec: 'AND(时间窗口, 事件)', timezone: tz, debounceMs: 60_000, throttleMs: 900_000,
      idempotencyKeyRule: '{scheduleId}:{eventId}', combinator: 'AND', enabled: true,
      children: [
        { triggerId: 'TR-5a', kind: 'time', spec: '0 20 * * *', timezone: tz, debounceMs: 0, throttleMs: 0, idempotencyKeyRule: '', enabled: true },
        { triggerId: 'TR-5b', kind: 'event', spec: 'ci.pipeline.failed', timezone: tz, debounceMs: 30_000, throttleMs: 0, idempotencyKeyRule: '', enabled: true },
      ],
    },
    { triggerId: 'TR-6', kind: 'event', spec: 'pr.updated:label=needs-review', timezone: tz, debounceMs: 20_000, throttleMs: 120_000, idempotencyKeyRule: '{scheduleId}:{prNumber}:{headSha}', enabled: true },
  ];

  const scheduleSeeds: {
    id: string; name: string; enabled: boolean; trig: number[]; target: [ScheduleTargetKind, string, string];
    policy: ConcurrencyPolicy; breaker: boolean; conflict?: string[]; p0?: boolean;
  }[] = [
    { id: 'SCH-01', name: '夜间依赖巡检与升级候选', enabled: true, trig: [0, 2], target: ['task_template', 'TPL-DEP-UPGRADE', '依赖升级'], policy: 'skip', breaker: false },
    { id: 'SCH-02', name: '主分支提交后文档漂移扫描', enabled: true, trig: [1], target: ['task_template', 'TPL-DOC-SYNC', '文档同步'], policy: 'queue', breaker: false },
    { id: 'SCH-03', name: '每小时发布前回归快跑', enabled: true, trig: [0], target: ['plan_template', 'TPL-REGRESSION', '发布回归计划'], policy: 'skip', breaker: false, conflict: ['SCH-07'] },
    { id: 'SCH-04', name: '夜间批量重构批次合入', enabled: true, trig: [4], target: ['goal', 'G-3a88', '批量重构目标'], policy: 'replace', breaker: true, conflict: ['SCH-03', 'SCH-07'] },
    { id: 'SCH-05', name: 'PR 更新触发审查机器人', enabled: true, trig: [5], target: ['session_template', 'TPL-REVIEW-SESSION', '审查会话模板'], policy: 'parallel', breaker: false },
    { id: 'SCH-06', name: '新版本可用时升级依赖', enabled: false, trig: [2], target: ['task_template', 'TPL-DEP-UPGRADE', '依赖升级'], policy: 'queue', breaker: true },
    { id: 'SCH-07', name: 'CI 失败自动诊断（夜间兜底）', enabled: true, trig: [4, 1], target: ['task_template', 'TPL-BUGFIX', '修 Bug'], policy: 'skip', breaker: false, conflict: ['SCH-03', 'SCH-04'] },
    { id: 'SCH-08', name: '手工触发的迁移演练', enabled: true, trig: [3], target: ['plan_template', 'TPL-MIGRATION', '迁移演练计划'], policy: 'skip', breaker: false, p0: true },
  ];

  const schedules: Schedule[] = scheduleSeeds.map((s) => {
    const triggers = s.trig.map((i) => triggerSeeds[i]);
    const runs: ScheduleRun[] = Array.from({ length: 6 }, (_, i) => {
      const failed = (s.breaker && i < 3) || (s.id === 'SCH-03' && i === 1);
      const outcome: ScheduleRun['outcome'] = failed && s.breaker ? 'FAILED'
        : i === 4 && s.id === 'SCH-02' ? 'SKIPPED'
          : i === 5 && s.id === 'SCH-05' ? 'DEDUPLICATED'
            : i === 2 && s.p0 ? 'PRECHECK_DENIED'
              : 'SUCCEEDED';
      return {
        runId: `${s.id}-R${100 + i}`,
        at: r.agoHours(i * 7 + 2),
        triggerSource: triggers[i % triggers.length].kind === 'time' ? `定时 ${triggers[i % triggers.length].spec}`
          : triggers[i % triggers.length].kind === 'event' ? `事件 ${triggers[i % triggers.length].spec}`
            : triggers[i % triggers.length].kind === 'composite' ? '组合 AND(时间窗口, 事件)' : '手动触发',
        decision: outcome === 'SKIPPED' ? '并发策略 skip：同计划上一次运行仍在进行'
          : outcome === 'DEDUPLICATED' ? '幂等键命中，触发去重'
            : outcome === 'PRECHECK_DENIED' ? '预授权越界：动作 git.push 不在 Allowlist'
              : '在预授权范围内，允许执行',
        actions: ['定位工作区与分支', '生成任务（模板实例化）', '执行 Agent Turn', outcome === 'SUCCEEDED' ? '生成产物与报告' : '暂停并生成告警通知'],
        outcome,
        durationMs: r.int(40_000, 900_000),
        cost: r.float(0.2, 7.4, 2),
        idempotencyKey: `${s.id}:${r.int(100_000, 999_999)}`,
        rollbackable: outcome === 'SUCCEEDED' && r.bool(0.6),
      };
    });
    const last = runs[0];
    const circuitOpen = s.breaker && runs.slice(0, 3).every((x) => x.outcome === 'FAILED');
    return {
      scheduleId: s.id, name: s.name, enabled: s.enabled, triggers, target: { kind: s.target[0], ref: s.target[1], name: s.target[2] },
      inputs: [
        { key: 'scope', value: 'src/**', desc: '扫描范围（glob）' },
        { key: 'severity', value: 'minor', desc: '触发最低严重度' },
        { key: 'dryRun', value: 'false', desc: '是否只生成报告不写入' },
      ],
      workspaceBinding: { workspace: s.id === 'SCH-04' ? 'local:/worktrees/refactor-batch' : wsMain, branch: s.id === 'SCH-02' ? 'main' : 'oc/schedule-batch', env: s.id === 'SCH-08' ? 'staging' : 'shadow' },
      permissions: {
        allow: s.p0 ? ['file.read', 'file.write:src/**', 'command.test'] : ['file.read', 'file.write:src/**', 'command.test', 'git.commit'],
        ceiling: '不可放宽企业基线：git.push / 生产写入 / 密钥读取永不在预授权范围',
      },
      concurrencyPolicy: s.policy,
      notifications: [
        { level: 'P0', channels: ['桌面通知', 'IM 机器人'] },
        { level: 'P1', channels: ['界面内', '邮件'] },
        { level: 'P2', channels: ['界面内'] },
      ],
      circuitBreaker: { failureThreshold: 3, alertTargets: ['sre-oncall', 'team-supervisor'], recoveryMode: '熔断后需人工确认恢复（不允许自动恢复）', open: circuitOpen, consecutiveFailures: runs.slice(0, 3).filter((x) => x.outcome === 'FAILED').length },
      retention: s.p0 ? '运行记录保留 365 天' : '运行记录保留 90 天',
      nextFireAt: s.enabled ? r.future(s.id === 'SCH-03' ? 42 : r.int(60, 1440)) : '',
      lastRun: { at: last.at, outcome: last.outcome, durationMs: last.durationMs, cost: last.cost },
      runs,
      conflictWith: s.conflict ?? [],
    };
  });

  /* ------------------------------ Teams */
  const rolePool = ['实现者·落霞', '测试者·清尘', '审查者·秋水', '文档者·知微', '安全审查者·怀山', '性能专家·越人', '数据专家·听澜'];

  function mkMember(idx: number, team: string, quota: number, state: MemberState, extra: Partial<TeamMember> = {}): TeamMember {
    const type: TeamMember['type'] = idx % 5 === 3 ? 'human' : 'agent';
    return {
      memberId: `${team}-M${idx + 1}`,
      name: type === 'human' ? r.pick(NAMES) : rolePool[idx % rolePool.length],
      roleRef: rolePool[idx % rolePool.length],
      type,
      worktreeRef: `${team.toLowerCase()}/${idx + 1}`,
      quota,
      used: Number((quota * r.float(0.2, 0.98, 2)).toFixed(2)),
      currentTaskId: state === 'busy' ? (idx % 2 === 0 ? shortOf('T-9c40') : shortOf('T-2e88')) : null,
      state,
      slaMinutes: type === 'human' ? 240 : undefined,
      claimable: type === 'human',
      ...extra,
    };
  }

  const teams: Team[] = [
    {
      teamId: 'TEAM-checkout-01', name: '结算攻坚队', templateRef: 'team-template/payment-hardening@v4', topology: 'hybrid',
      state: 'running', budget: { total: 48, used: 33.86 }, goal: '统一支付链路口径（幂等 + 回执）', sessionRef: 'sess-7f3a0c',
      leadMemberId: 'TEAM-checkout-01-M1', createdAt: r.agoDays(5),
      members: [
        mkMember(0, 'TEAM-checkout-01', 14, 'busy'),
        mkMember(1, 'TEAM-checkout-01', 12, 'busy'),
        mkMember(2, 'TEAM-checkout-01', 10, 'idle'),
        mkMember(3, 'TEAM-checkout-01', 6, 'blocked', { slaMinutes: 180, claimable: true }),
        mkMember(4, 'TEAM-checkout-01', 6, 'completed'),
      ],
      board: {
        evidence: [
          { id: 'BE-01', taskId: shortOf('T-7f3a'), level: 'L2', summary: '128 passed / 0 failed（含 12 例幂等）', by: '测试者 · 清尘', at: r.agoHours(6) },
          { id: 'BE-02', taskId: shortOf('T-8d99'), level: 'L2', summary: 'mvn verify 全绿；连接池指标无劣化', by: '实现者 · 听澜', at: r.agoDays(2) },
          { id: 'BE-03', taskId: shortOf('T-9c40'), level: 'L2', summary: '对拍 10,000 组合 0 差异', by: '测试者 · 清尘', at: r.agoHours(9) },
        ],
        decisions: [
          { id: 'BD-01', at: r.agoHours(7), by: '主管 Agent', text: 'T-7f3a 的 L3 条目挂起，不阻塞 in_review → done 的其余条件', impact: '允许带未验证项进入验收，但在报告中显式标注' },
          { id: 'BD-02', at: r.agoHours(3), by: '主管 Agent', text: '回归批次 T-0e15 抢占 T-9c40（优先级 URGENT）', impact: 'T-9c40 保留检查点 ckp_9c40_p3，可恢复' },
          { id: 'BD-03', at: r.agoDays(1), by: '林晚照（人类）', text: '契约评审延后至 M4 里程碑，避免与回归争抢评审人', impact: 'T-3f72 保持 ready，不进入执行' },
        ],
        blockers: [
          { id: 'BB-01', taskId: shortOf('T-5a31'), reason: '移动端真机设备池排期冲突', owner: '周砚青', since: r.agoHours(20), waitingOn: '设备池释放（预计 09-24）' },
          { id: 'BB-02', taskId: shortOf('T-0e15'), reason: '与 T-9c40 对拍争用同一真机环境', owner: 'SRE 韩秋水', since: r.agoHours(4), waitingOn: '错峰窗口 09-25 02:00' },
        ],
      },
      messages: [
        { msgId: 'MSG-01', type: 'handoff', dir: { from: '实现者 · 落霞', to: '测试者 · 清尘' }, payload: { task: 'T-7f3a', artifact: 'evidence://T-7f3a/junit', note: '并发重放用例请覆盖跨日重放' }, at: r.agoHours(8), taskRef: shortOf('T-7f3a') },
        { msgId: 'MSG-02', type: 'review_request', dir: { from: '测试者 · 清尘', to: '审查者 · 秋水' }, payload: { changeSet: 'diff://T-7f3a/v3', acceptance: ['A1', 'A2'] }, at: r.agoHours(6), taskRef: shortOf('T-7f3a') },
        { msgId: 'MSG-03', type: 'verdict', dir: { from: '审查者 · 秋水', to: '团队' }, payload: { result: '通过', mustFix: [], reason: '证据完整，L3 未验证项已标注' }, at: r.agoHours(5), taskRef: shortOf('T-7f3a') },
        { msgId: 'MSG-04', type: 'blocker', dir: { from: '周砚青', to: '主管 Agent' }, payload: { task: 'T-5a31', reason: '设备池不可用', impact: 'L3 验收无法闭环', suggestion: '转派或延期至 09-24' }, at: r.agoHours(4), taskRef: shortOf('T-5a31') },
        { msgId: 'MSG-05', type: 'proposal', dir: { from: '实现者 · 落霞', to: '团队' }, payload: { subject: '合并队列限批 2 并行', tradeoff: '吞吐略降，冲突与回滚风险显著下降' }, at: r.agoHours(3), taskRef: shortOf('T-9c40') },
        { msgId: 'MSG-06', type: 'question', dir: { from: '文档者 · 知微', to: '主管 Agent' }, payload: { question: '契约弃用字段是否需在文档中标注迁移窗口？', tried: '已检索知识库，未见约定' }, at: r.agoHours(2), taskRef: shortOf('T-6b21') },
        { msgId: 'MSG-07', type: 'budget_alert', dir: { from: '观测（预算守卫）', to: '团队' }, payload: { consumed: '70.5%', forecast: '预计 4 小时后触及 90% 预警', advice: '回收 idle 成员配额' }, at: r.agoHours(1), taskRef: shortOf('T-9c40') },
      ],
      arbitrations: [
        {
          id: 'ARB-01', at: r.agoHours(10), dispute: 'T-9c40 是否允许共享同一 worktree 并行改写 receipt 包',
          views: [
            { by: '实现者 · 落霞', view: '写范围重叠（src/*/receipt/**），应串行化以保证行为等价验证可信' },
            { by: '主管 Agent', view: '并行可将批次从 6 天压到 2 天，冲突可在合并队列处理' },
          ],
          ruling: '串行执行，但允许「对拍」阶段并行（只读，无写范围重叠）',
          reason: '卷 13 D-TEAM-5：隔离优先 + 写范围声明，语义冲突必须前置消除；对拍为只读操作不构成写冲突。',
          impact: '批次合入周期 +1.5 天，返工风险从 22% 降到 4%（历史同类型任务口径）。',
        },
      ],
      mergeQueue: [
        { id: 'MQ-01', branch: 'oc/T-7f3a-idempotent-receipt', target: 'main', status: 'completed', conflictFiles: [], precheckResult: '预检通过（构建 + 单测 + 扫描）', owner: '实现者 · 落霞', enqueuedAt: r.agoHours(9) },
        { id: 'MQ-02', branch: 'oc/T-8d99-jdbc-427', target: 'main', status: 'completed', conflictFiles: [], precheckResult: '预检通过', owner: '实现者 · 听澜', enqueuedAt: r.agoDays(2) },
        { id: 'MQ-03', branch: 'oc/T-9c40-receipt-template-b4', target: 'main', status: 'conflict', conflictFiles: ['src/settlement/receipt/ReceiptHandler.java', 'src/reconciliation/receipt/ReceiptMapper.xml'], precheckResult: '冲突：目标文件在基线被 T-0e15 修改', owner: '重构扇出队 · 成员3', enqueuedAt: r.agoHours(2) },
        { id: 'MQ-04', branch: 'oc/T-2e88-alert-metrics', target: 'main', status: 'started', conflictFiles: [], precheckResult: '预检进行中（构建阶段）', owner: '观测者 · 望舒', enqueuedAt: r.agoHours(1) },
        { id: 'MQ-05', branch: 'oc/T-4c66-cleanup', target: 'main', status: 'rejected', conflictFiles: [], precheckResult: '预检拒绝：任务已取消（cancelled 终态）', owner: '实现者 · 听澜', enqueuedAt: r.agoDays(1) },
        { id: 'MQ-06', branch: 'oc/T-3f72-openapi-v2', target: 'main', status: 'queued', conflictFiles: [], precheckResult: '等待租约（队列深度 2）', owner: '林晚照', enqueuedAt: r.ago(40) },
      ],
      report: { progress: 0.68, cost: 33.86, evidence: 11, openItems: ['L3 移动端弱网验证（T-5a31）', '发布回归排期（T-0e15）', '契约评审（T-3f72）'], publishedAt: r.agoHours(1) },
    },
    {
      teamId: 'TEAM-migrate-02', name: '重构扇出队', templateRef: 'team-template/refactor-fanout@v2', topology: 'fanout',
      state: 'running', budget: { total: 36, used: 34.62 }, goal: '6 个服务回执处理收敛为单一模板', sessionRef: 'sess-9a2c41',
      leadMemberId: 'TEAM-migrate-02-M1', createdAt: r.agoDays(9),
      members: [
        mkMember(0, 'TEAM-migrate-02', 8, 'busy'), mkMember(1, 'TEAM-migrate-02', 8, 'busy'),
        mkMember(2, 'TEAM-migrate-02', 8, 'failed'), mkMember(3, 'TEAM-migrate-02', 6, 'idle'),
        mkMember(4, 'TEAM-migrate-02', 6, 'busy'),
      ],
      board: {
        evidence: [{ id: 'BE-04', taskId: shortOf('T-9c40'), level: 'L2', summary: '批次 1-3 对拍 0 差异', by: '测试者 · 清尘', at: r.agoHours(11) }],
        decisions: [{ id: 'BD-04', at: r.agoHours(12), by: '主管 Agent', text: '失败成员 M3 的任务重新分配至 M5', impact: '批次 4 延迟 40 分钟，无质量影响' }],
        blockers: [{ id: 'BB-03', taskId: shortOf('T-9c40'), reason: '成员 M3 连续 3 次构建失败（OOM）', owner: '主管 Agent', since: r.agoHours(3), waitingOn: '提高该 worktree 内存上限后重试' }],
      },
      messages: [
        { msgId: 'MSG-11', type: 'budget_alert', dir: { from: '观测（预算守卫）', to: '团队' }, payload: { consumed: '96.2%', forecast: '预计 30 分钟内超限', advice: '暂停批次 5-6 或申请追加预算' }, at: r.agoHours(2), taskRef: shortOf('T-9c40') },
        { msgId: 'MSG-12', type: 'blocker', dir: { from: '实现者 · 听澜', to: '主管 Agent' }, payload: { task: 'T-9c40', reason: 'worktree OOM', impact: '批次 4 卡住' }, at: r.agoHours(3), taskRef: shortOf('T-9c40') },
        { msgId: 'MSG-13', type: 'handoff', dir: { from: '主管 Agent', to: '实现者 · 越人' }, payload: { task: 'T-9c40', batch: 'batch-4', note: '内存上限已调整至 4Gi' }, at: r.agoHours(2), taskRef: shortOf('T-9c40') },
      ],
      arbitrations: [],
      mergeQueue: [
        { id: 'MQ-11', branch: 'oc/T-9c40-batch1', target: 'main', status: 'completed', conflictFiles: [], precheckResult: '预检通过', owner: '成员1', enqueuedAt: r.agoDays(2) },
        { id: 'MQ-12', branch: 'oc/T-9c40-batch2', target: 'main', status: 'completed', conflictFiles: [], precheckResult: '预检通过', owner: '成员2', enqueuedAt: r.agoDays(1) },
        { id: 'MQ-13', branch: 'oc/T-9c40-batch3', target: 'main', status: 'completed', conflictFiles: [], precheckResult: '预检通过（含日志摘要对拍）', owner: '成员5', enqueuedAt: r.agoHours(11) },
        { id: 'MQ-14', branch: 'oc/T-9c40-batch4', target: 'main', status: 'queued', conflictFiles: [], precheckResult: '等待租约（同分支串行）', owner: '成员4', enqueuedAt: r.agoHours(1) },
      ],
      report: { progress: 0.5, cost: 34.62, evidence: 6, openItems: ['批次 5-6 预算不足', 'M3 失败原因待复盘'], publishedAt: r.agoHours(2) },
    },
    {
      teamId: 'TEAM-recon-03', name: '对账迁移小队', templateRef: 'team-template/pipeline-migration@v1', topology: 'pipeline',
      state: 'completed', budget: { total: 18, used: 11.4 }, goal: '月度对账脚本迁移到新对账服务', sessionRef: 'sess-2d19aa',
      leadMemberId: 'TEAM-recon-03-M1', createdAt: r.agoDays(14),
      members: [
        mkMember(0, 'TEAM-recon-03', 6, 'completed'), mkMember(1, 'TEAM-recon-03', 6, 'completed'),
        mkMember(2, 'TEAM-recon-03', 4, 'completed'), mkMember(3, 'TEAM-recon-03', 2, 'completed', { claimable: true }),
      ],
      board: {
        evidence: [{ id: 'BE-05', taskId: shortOf('T-8d99'), level: 'L3', summary: '对账差异 0（连续 2 个月演练）', by: '数据专家 · 听澜', at: r.agoDays(6) }],
        decisions: [{ id: 'BD-05', at: r.agoDays(7), by: '财务（人类成员）', text: '对账差异为 0，同意切换', impact: '旧脚本保留 1 个季度作为回退路径' }],
        blockers: [],
      },
      messages: [
        { msgId: 'MSG-21', type: 'proposal', dir: { from: '数据专家 · 听澜', to: '团队' }, payload: { subject: '分批切换：先只读双跑，再切写' }, at: r.agoDays(8), taskRef: shortOf('T-8d99') },
        { msgId: 'MSG-22', type: 'verdict', dir: { from: '财务（人类）', to: '团队' }, payload: { result: '通过', reason: '连续两月差异为 0' }, at: r.agoDays(6), taskRef: shortOf('T-8d99') },
      ],
      arbitrations: [],
      mergeQueue: [{ id: 'MQ-21', branch: 'oc/recon-migrate', target: 'main', status: 'completed', conflictFiles: [], precheckResult: '预检通过', owner: '成员1', enqueuedAt: r.agoDays(6) }],
      report: { progress: 1, cost: 11.4, evidence: 8, openItems: ['季度后清理旧脚本'], publishedAt: r.agoDays(5) },
    },
    {
      teamId: 'TEAM-debate-04', name: '接口变更评审团', templateRef: 'team-template/debate-review@v3', topology: 'debate',
      state: 'aborted', budget: { total: 12, used: 9.86 }, goal: '评审并对齐 v2 契约的字段命名与弃用策略', sessionRef: 'sess-4b77e0',
      leadMemberId: 'TEAM-debate-04-M1', createdAt: r.agoDays(3),
      members: [
        mkMember(0, 'TEAM-debate-04', 4, 'completed'), mkMember(1, 'TEAM-debate-04', 4, 'completed'),
        mkMember(2, 'TEAM-debate-04', 4, 'failed'),
      ],
      board: {
        evidence: [],
        decisions: [{ id: 'BD-06', at: r.agoDays(2), by: '主管 Agent', text: '辩论未收敛，升级至人类裁决', impact: '契约评审挂起，不阻塞其余任务' }],
        blockers: [{ id: 'BB-04', taskId: shortOf('T-3f72'), reason: '辩论双方在字段命名（idempotencyKey vs idemKey）上无法收敛', owner: '架构评审委员会', since: r.agoDays(2), waitingOn: '人类裁决收件人（顾清和）' }],
      },
      messages: [
        { msgId: 'MSG-31', type: 'proposal', dir: { from: '审查者 · 秋水', to: '团队' }, payload: { subject: '字段名用 idempotencyKey（自解释优先）' }, at: r.agoDays(3), taskRef: shortOf('T-3f72') },
        { msgId: 'MSG-32', type: 'proposal', dir: { from: '性能专家 · 越人', to: '团队' }, payload: { subject: '字段名用 idemKey（报文体积敏感）' }, at: r.agoDays(3), taskRef: shortOf('T-3f72') },
        { msgId: 'MSG-33', type: 'blocker', dir: { from: '主管 Agent', to: '架构评审委员会' }, payload: { task: 'T-3f72', reason: '辩论 2 轮未收敛', suggestion: '人类裁决' }, at: r.agoDays(2), taskRef: shortOf('T-3f72') },
      ],
      arbitrations: [
        {
          id: 'ARB-11', at: r.agoDays(2), dispute: 'v2 契约幂等字段命名：idempotencyKey 还是 idemKey',
          views: [
            { by: '审查者 · 秋水', view: '自解释优先，命名长但零歧义；历史契约同名字段占比 78%' },
            { by: '性能专家 · 越人', view: '报文体积敏感，短名节省约 0.4% 载荷' },
          ],
          ruling: '升级人类裁决（团队内未收敛）',
          reason: '卷 13 §4.4：verdict 无法通过时由主管升级至人类；命名属对外契约，影响面跨租户。',
          impact: '契约发布推迟 2 天；暂以 v1 字段继续运行，无功能影响。',
        },
      ],
      mergeQueue: [],
      report: { progress: 0.2, cost: 9.86, evidence: 0, openItems: ['字段命名裁决', '辩论成本超预算 22%'], publishedAt: r.agoDays(2) },
    },
  ];

  /* ------------------------------ 任务模板库 */
  const templateLibrary: TaskTemplate[] = [
    { id: 'TPL-API-ADD', name: '新增 API', kind: '功能', desc: '为既有服务新增对外端点，含契约、实现、测试与文档。', steps: ['读取既有契约与实现范式', '起草 OpenAPI 契约片段', '实现端点与校验', '补齐单测 + 集成测试', '更新文档与示例'], acceptance: ['契约校验通过', '单测覆盖分支 ≥ 90%', '文档示例可执行'], risks: ['契约不兼容变更（必须加版本或弃用窗口）', '权限点遗漏导致越权'], usedCount: 34, shared: true },
    { id: 'TPL-REFACTOR', name: '重构模块', kind: '质量', desc: '在保持行为等价前提下重构模块，含对拍与分批合入。', steps: ['行为快照（对拍基线）', '抽取目标结构', '逐批替换并保留旧实现', '对拍验证 0 差异', '删除旧实现'], acceptance: ['对拍 0 差异', '每批独立可回滚', '性能无劣化 > 5%'], risks: ['隐藏行为差异（日志/异常类型）', '合并队列拥塞'], usedCount: 21, shared: true },
    { id: 'TPL-BUGFIX', name: '修 Bug', kind: '缺陷', desc: '从现象到根因到回归用例的闭环修复。', steps: ['复现并固化最小用例', '定位根因（含调用链）', '修复并保留回归用例', '影响面扫描', '生成修复说明'], acceptance: ['最小用例转为回归用例且通过', '同根因的其他调用点已扫描', '修复说明含根因与影响面'], risks: ['只修现象未修根因', '缺回归用例导致复发'], usedCount: 58, shared: true },
    { id: 'TPL-DEP-UPGRADE', name: '依赖升级', kind: '维护', desc: '依赖版本升级与兼容性验证。', steps: ['解析升级说明与破坏性变更', '在分支升级并锁定版本', '全量回归 + 依赖差异审计', '观察指标 24 小时', '合入并更新基线'], acceptance: ['全量回归通过', '依赖差异审计无未审批引入', '指标无劣化'], risks: ['传递依赖冲突', '许可证变更（合规阻断）'], usedCount: 17, shared: true },
    { id: 'TPL-DOC-SYNC', name: '文档同步', kind: '文档', desc: '代码变更后的文档同步，防漂移。', steps: ['差异清单（缺失/过时/多余）', '逐段修订（保留人工保护段）', '生成修订说明', '人工抽检', '标记修订版本'], acceptance: ['差异清单清零或标注例外', '人工保护段未被覆盖', '修订说明含变更点'], risks: ['误改人工校订段落', '示例过期未被检出'], usedCount: 26, shared: true },
    { id: 'TPL-MIGRATION', name: '迁移', kind: '数据', desc: '数据/schema 迁移，含回滚演练与分批验证。', steps: ['预检（重复/脏数据）', '编写前向 + 逆向脚本', '空库与样本库演练', '分批执行并逐批验证', '记录续跑点'], acceptance: ['前向与逆向均可执行', '空库/样本库演练通过', '批间可续跑'], risks: ['存量重复数据阻塞唯一约束', '逆向脚本未经演练'], usedCount: 12, shared: false },
  ];

  /* ------------------------------ 图表序列 */
  const weeks = ['W-11', 'W-10', 'W-9', 'W-8', 'W-7', 'W-6', 'W-5', 'W-4', 'W-3', 'W-2', 'W-1', '本周'];
  const throughputSeries = [
    { name: '完成任务', points: weeks.map((x, i) => ({ x, y: 2 + Math.round(i * 0.7) + r.int(0, 2) })) },
    { name: '新增任务', points: weeks.map((x, i) => ({ x, y: 3 + Math.round(i * 0.5) + r.int(0, 3) })) },
  ];
  const costWaterfall = [
    { name: '规划', value: 2.4 },
    { name: '实现', value: 12.8 },
    { name: '测试', value: 6.2 },
    { name: '审查', value: 3.1 },
    { name: '返工', value: 4.6 },
    { name: '合计', value: 29.1 },
  ];
  const teamCostByMember = teams
    .flatMap((t) => t.members.filter((m) => m.type === 'agent'))
    .slice(0, 8)
    .map((m) => ({ name: m.name, value: Number(m.used.toFixed(2)) }));

  return {
    workItems: items,
    criticalPath,
    cycleAttempts: [
      { path: ['T-0e15', 'T-9c40', 'T-7f3a', 'T-0e15'], at: r.agoHours(4), rejected: true, by: '调度器 · 依赖校验' },
      { path: ['T-3f72', 'T-6b21', 'T-3f72'], at: r.agoDays(2), rejected: true, by: '人类（林晚照）' },
    ],
    milestones,
    throughputSeries,
    costWaterfall,
    teamCostByMember,
    templateLibrary,
    specDocs,
    decomposition,
    preemptions,
    acceptanceChecks,
    goals,
    schedules,
    teams,
  };
}

/** 全站固定种子实例（刷新一致） */
export const taskData: TaskData = buildTaskData(new Rng(20260921));
