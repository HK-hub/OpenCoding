/**
 * 审批域 mock 数据（卷 06 §4.3/§4.4 + impl/30 §6.1 + impl/16 §6.3）。
 * 契约要点：
 * - 审批请求字段序与跨端协议一致（approvalId/会话/任务/动作摘要/预览/风险与理由/可选范围/超时/上下文链接/责任记录）。
 * - 事件仅追加不可变；终态三呈现分离（按策略拒绝 / 已升级 / 无人应答），端上不得本地判定超时结果。
 * - 范围词汇与六级授权记忆一一对应（once/session/project/workspace/pattern/dir），R4/R5 与无法解析命令只允许「仅本次」。
 */
import { Rng, NAMES } from '../rng';
import { buildSessionData } from './session';

/** 风险类 R0–R5（判定依据见卷 06 §4.1） */
export type RiskClass = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
/** 六级授权范围（唯一权威词汇，禁止自造第七种） */
export type GrantScope = 'once' | 'session' | 'project' | 'workspace' | 'pattern' | 'dir';
/** 审批编排状态机（卷 06 §4.4） */
export type ApprovalState = 'Requested' | 'Granted' | 'Denied' | 'Expired' | 'Escalated' | 'Unavailable' | 'Halted';
/** 超时动作：默认 deny，企业可配 escalate */
export type TimeoutAction = 'deny' | 'escalate';
/** 责任记录：谁请求（用户 / Agent / 子 Agent / 外部调用方） */
export type RequesterKind = 'user' | 'agent' | 'subagent' | 'external';
/** 事件操作者类型 */
export type ActorKind = 'user' | 'agent' | 'system' | 'external';
/** 终态分类（统计必须分离，禁止把三者混为一谈） */
export type TerminalKind = 'PENDING' | 'GRANTED' | 'DENIED' | 'POLICY_DENY' | 'ESCALATED' | 'UNAVAILABLE' | 'HALTED';
/** 预览形态：diff / 命令全文 / 网络目标 / 无预览 */
export type PreviewKind = 'diff' | 'command' | 'network' | 'none';

export interface ActionSummary {
  tool: string;
  targetResource: string;
  humanReadableDesc: string;
}

export interface ApprovalPreview {
  kind: PreviewKind;
  /** 文件 diff 原文（③ 预览按纯文本渲染，展开时再结构化） */
  diff?: string;
  /** 命令全文（无法解析时保留原文，便于人工核对） */
  commandFullText?: string;
  /** 网络目标（出网类动作必填） */
  networkTarget?: string;
  /** 影响面估计 */
  blastRadiusEstimate?: string;
}

export interface ApprovalRequest {
  approvalId: string;
  sessionId: string;
  sessionTitle: string;
  taskId: string;
  actionSummary: ActionSummary;
  preview: ApprovalPreview;
  riskClass: RiskClass;
  /** 触发风险级的具体理由（含参数级判定说明） */
  riskReason: string;
  /** 可选范围 chips；R4/R5 与 UNPARSED 命令仅含 once */
  scopeOptions: GrantScope[];
  /** 范围被锁定时的显式说明（tooltip/文案，禁止静默收窄） */
  scopeLockedReason?: string;
  timeout: { defaultMs: number; timeoutAction: TimeoutAction };
  contextLinks: { sessionMessageRef: string; planRef: string };
  requesterIdentity: { kind: RequesterKind; name: string; chain: string };
  /** 申请理由（升级/例外流程时由请求方填写） */
  reason?: string;
  state: ApprovalState;
  terminal: TerminalKind;
  respondedBy?: string;
  respondedAt?: string;
  grantScope?: GrantScope;
  /** 30s 去重窗口内合并的同动作数量（>1 时标注「同动作 ×N」） */
  dedupeWindowCount: number;
  /** 被合并的每一次目标资源（展开可见，不隐藏） */
  dedupeTargets: string[];
  createdAt: string;
  /** 展示倒计时基准；端上仅展示，终态以服务端为准 */
  expiresAt: string;
  actionDigest: string;
  /** 倒计时展示上限（秒，impl/30 §9.4：300s 兜底，仅展示不判定） */
  displayCapSeconds: number;
}

export interface ApprovalEvent {
  readonly eventId: string;
  readonly approvalId: string;
  readonly fromState: ApprovalState | 'None';
  readonly toState: ApprovalState;
  readonly actorIdentity: string;
  readonly actorKind: ActorKind;
  readonly reason: string;
  readonly at: string;
}

export interface ReplayRecord {
  decisionId: string;
  approvalId: string;
  actionDescriptor: string;
  policyVersion: string;
  evaluationTrace: { step: number; rule: string; result: 'ALLOW' | 'ASK' | 'DENY' | 'FORCE' | 'NO_MATCH'; note: string }[];
  contextSummaryRef: string;
  /** 重放结果与原决策是否一致 */
  replayMatch: boolean;
  /** 不一致时的分歧说明（含首个分歧点） */
  divergence?: string;
  replayedAt: string;
}

export interface ApprovalChannel {
  id: 'cli' | 'desktop' | 'a2a' | 'im';
  name: string;
  /** 通道健康：READY 正常 / DEGRADED 降级 / UNAVAILABLE 不可用 */
  state: 'READY' | 'DEGRADED' | 'UNAVAILABLE';
  enabled: boolean;
  deliveryTarget: string;
  lastDelivery: { at: string; approvalId: string; result: string };
  failureRetries: number;
  retryPolicy: string;
  note: string;
}

export interface DeliveryRecord {
  id: string;
  approvalId: string;
  channel: ApprovalChannel['id'];
  at: string;
  /** DELIVERED 已投递 / MERGED 去重合并 / RETRYING 重试中 / FAILED 投递失败 */
  result: 'DELIVERED' | 'MERGED' | 'RETRYING' | 'FAILED';
  latencyMs: number;
  retries: number;
  detail: string;
}

export interface EscalationLevel {
  level: 1 | 2 | 3;
  role: string;
  owner: string;
  slaMinutes: number;
  arrivedAt: string | null;
  note: string;
}

export interface EscalationChain {
  approvalId: string;
  levels: EscalationLevel[];
  currentLevel: 1 | 2 | 3;
  slaRemainingMs: number;
  startedAt: string;
  resolved: boolean;
  outcome: string;
}

export interface ApprovalStats {
  totalRequests: number;
  /** 决策引擎 ask 比例（oc_permission_ask_ratio） */
  askRatio: number;
  /** 平均人工时延（ms） */
  avgHumanLatencyMs: number;
  timeoutCount: number;
  pendingCount: number;
  grantedCount: number;
  /** 用户主动拒绝（与超时收口分开计数） */
  deniedByUserCount: number;
  /** 按策略拒绝（超时 deny 收口 + 基线强制） */
  policyDeniedCount: number;
  /** 已升级（等待上级应答） */
  escalatedCount: number;
  /** 无人应答（通道全断 / 应答者缺失） */
  unavailableCount: number;
  haltedCount: number;
  dedupedMergedCount: number;
  storedScopeCount: number;
  byRisk: { name: string; value: number }[];
  latencyTrend: { name: string; points: { x: string; y: number }[] }[];
  outcomeFunnel: { name: string; value: number }[];
}

export interface ApprovalData {
  approvals: ApprovalRequest[];
  approvalEvents: ApprovalEvent[];
  replayRecords: ReplayRecord[];
  channels: ApprovalChannel[];
  deliveries: DeliveryRecord[];
  escalations: EscalationChain[];
  escalationTemplate: EscalationLevel[];
  approvalStats: ApprovalStats;
}

/** 六级范围词汇表（审批卡 chips 与授权记忆共用同一词汇，禁止自造） */
export const SCOPE_CATALOG: { scope: GrantScope; chip: string; semantic: string; availability: string }[] = [
  { scope: 'once', chip: '仅本次', semantic: '就这一次，不写记忆', availability: '全部动作可用（含 R4/R5 与无法解析命令）' },
  { scope: 'session', chip: '本会话', semantic: '本次会话内同类动作都同意', availability: 'R0–R3；受 batch-scope-max 上限约束' },
  { scope: 'project', chip: '本项目', semantic: '这个项目内同类动作都同意', availability: 'R0–R3；受 batch-scope-max 上限约束' },
  { scope: 'workspace', chip: '本工作区', semantic: '这个工作区内同类动作都同意', availability: 'R0–R3；受 batch-scope-max 上限约束' },
  { scope: 'pattern', chip: '按模式', semantic: '匹配该路径/命令模式时才同意（禁止盲授，确认前可见展开）', availability: 'R0–R3；模式必须可在确认前看到展开结果' },
  { scope: 'dir', chip: '按目录', semantic: '该目录下才同意', availability: 'R0–R3；目录路径在确认前可见' },
];

/** 审批状态展示元数据（文案与主题色单源） */
export const STATE_META: Record<ApprovalState, { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  Requested: { label: '待审批', theme: 'warning' },
  Granted: { label: '已批准', theme: 'success' },
  Denied: { label: '已拒绝', theme: 'danger' },
  Expired: { label: '倒计时结束（待内核裁定）', theme: 'default' },
  Escalated: { label: '已升级', theme: 'primary' },
  Unavailable: { label: '无人应答', theme: 'default' },
  Halted: { label: '已挂起', theme: 'danger' },
};

/** 终态三呈现分离（统计与视图都按此分桶） */
export const TERMINAL_META: Record<TerminalKind, { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger'; hint: string }> = {
  PENDING: { label: '等待应答', theme: 'warning', hint: '仍在等待人工或策略应答，未成终态。' },
  GRANTED: { label: '已批准', theme: 'success', hint: '批准已生效，按授予范围写入授权记忆。' },
  DENIED: { label: '用户拒绝', theme: 'danger', hint: '由用户主动拒绝（计入用户决策）。' },
  POLICY_DENY: { label: '按策略拒绝', theme: 'danger', hint: '超时按 deny 收口或企业基线强制拒绝——不计入用户主动拒绝。' },
  ESCALATED: { label: '已升级', theme: 'primary', hint: '超时动作 escalate：已按升级链转交上级审批人，等待应答。' },
  UNAVAILABLE: { label: '无人应答', theme: 'default', hint: '仅对应通道全断 / 应答者缺失 / 应答不合规；已按 fail-closed 收口。' },
  HALTED: { label: '已挂起', theme: 'danger', hint: '被安全基线阻断，会话按策略挂起，需合规路径恢复。' },
};

const PAYMENT_DIFF = [
  '--- a/src/main/java/com/acme/payment/PaymentServiceImpl.java',
  '+++ b/src/main/java/com/acme/payment/PaymentServiceImpl.java',
  '@@ -88,12 +88,38 @@ public ReceiptResult handleRetry(String idempotencyKey, ReceiptCommand cmd) {',
  '-    ReceiptResult cached = cache.get(idempotencyKey);',
  '-    if (cached != null) {',
  '-        return cached;',
  '-    }',
  '+    // 幂等键唯一约束由持久层兜底：先尝试写入，冲突时回读首次结果',
  '+    try {',
  '+        ReceiptResult first = repository.insertIfAbsent(idempotencyKey, cmd);',
  '+        if (first != null) {',
  '+            return first;',
  '+        }',
  '+    } catch (DuplicateKeyException e) {',
  '+        log.warn("幂等键冲突，回读首次结果，idempotencyKey={}", idempotencyKey);',
  '+    }',
  '+    return repository.selectByIdempotencyKey(idempotencyKey);',
].join('\n');

export function buildApprovalData(r: Rng): ApprovalData {
  // 会话/任务/工作区标识复用会话域数据，避免第二套 id 真相源
  const sessionData = buildSessionData(new Rng(20260921));
  const sessions = sessionData.sessions;
  const ref = (i: number) => ({ sessionId: sessions[i].id, sessionTitle: sessions[i].title });

  const approvals: ApprovalRequest[] = [
    {
      ...ref(0),
      approvalId: 'AR-4f21',
      taskId: 'T-7f3a',
      actionSummary: {
        tool: 'run_command',
        targetResource: 'workspace local:/worktrees/payment-core/T-7f3a',
        humanReadableDesc: '在 payment-core 工作区运行幂等单测（mvn -pl payment-core test -Dtest=IdempotencyGuardTest）',
      },
      preview: {
        kind: 'command',
        commandFullText: 'mvn -pl payment-core test -Dtest=IdempotencyGuardTest -DfailIfNoTests=false\n# 沙箱档 L0+ · 资源上限 cpu 2 / mem 2GiB / 超时 300s · 工作区写范围限 T-7f3a',
        blastRadiusEstimate: '仅影响隔离 worktree 的构建缓存；不触网、无外部副作用',
      },
      riskClass: 'R2',
      riskReason: '参数级判定：命令为 mvn test（构建执行类）；已授予记忆仅匹配模式「mvn * test*」，本次新增 verify 阶段参数与 -D 覆盖，模式不命中 → 重新 ASK',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[0].shortId}#turn=1/msg=9`, planRef: 'plan://T-7f3a/step-5' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Requested',
      terminal: 'PENDING',
      dedupeWindowCount: 3,
      dedupeTargets: [
        'workspace local:/worktrees/payment-core/T-7f3a',
        'workspace local:/worktrees/payment-core/T-7f3a/src/test',
        'workspace local:/worktrees/payment-core/T-7f3a/pom.xml',
      ],
      createdAt: r.ago(6),
      expiresAt: r.future(4),
      actionDigest: 'd41f8e0c',
      displayCapSeconds: 300,
    },
    {
      ...ref(0),
      approvalId: 'AR-4f22',
      taskId: 'T-7f3a',
      actionSummary: {
        tool: 'edit_file',
        targetResource: 'src/main/java/com/acme/payment/PaymentServiceImpl.java',
        humanReadableDesc: '编辑支付回执实现：持久层唯一约束 + 冲突时回读首次结果（+38 −12）',
      },
      preview: { kind: 'diff', diff: PAYMENT_DIFF, blastRadiusEstimate: '单文件原子替换；写入前保留旧哈希，可一键回滚' },
      riskClass: 'R1',
      riskReason: '受控写：工作区内文件写，附 diff 预览；未命中组织/租户 DENY 规则',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[0].shortId}#turn=1/msg=7`, planRef: 'plan://T-7f3a/step-2' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Granted',
      terminal: 'GRANTED',
      respondedBy: `${NAMES[0]}（会话所有者）`,
      respondedAt: r.agoHours(2),
      grantScope: 'session',
      dedupeWindowCount: 1,
      dedupeTargets: ['src/main/java/com/acme/payment/PaymentServiceImpl.java'],
      createdAt: r.agoHours(2),
      expiresAt: r.agoHours(2),
      actionDigest: '8b31c5aa',
      displayCapSeconds: 300,
    },
    {
      ...ref(0),
      approvalId: 'AR-4f23',
      taskId: 'T-7f3a',
      actionSummary: {
        tool: 'web_fetch',
        targetResource: 'https://blog.example-vendor.io/idempotency-best-practice',
        humanReadableDesc: '抓取外部博客页面作为幂等实现参考',
      },
      preview: {
        kind: 'network',
        networkTarget: 'HTTPS GET blog.example-vendor.io（白名单外域名）· 出口经审计代理 · 请求体不含仓库内容',
        blastRadiusEstimate: '仅出站读取；但该域名未加白，可能触发 DLP 告警',
      },
      riskClass: 'R3',
      riskReason: '外发类：目标域名不在网络白名单（network.allowlist）内，且仓库内有等价内网资料',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[0].shortId}#turn=1/msg=4`, planRef: 'plan://T-7f3a/step-1' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      reason: '用户拒绝：该域名未加白，请改用 kb_search 检索内网规范',
      state: 'Denied',
      terminal: 'DENIED',
      respondedBy: `${NAMES[0]}（会话所有者）`,
      respondedAt: r.agoHours(3),
      dedupeWindowCount: 1,
      dedupeTargets: ['https://blog.example-vendor.io/idempotency-best-practice'],
      createdAt: r.agoHours(3),
      expiresAt: r.agoHours(3),
      actionDigest: '2c77e091',
      displayCapSeconds: 300,
    },
    {
      ...ref(0),
      approvalId: 'AR-4f2c',
      taskId: 'T-7f3a',
      actionSummary: {
        tool: 'run_command',
        targetResource: 'workspace local:/worktrees/payment-core/T-7f3a（git 工作区）',
        humanReadableDesc: 'git reset --hard origin/main：丢弃工作区全部未提交改动',
      },
      preview: {
        kind: 'command',
        commandFullText: 'git reset --hard origin/main\n# 将丢弃当前 worktree 的 3 个未提交文件改动；不可撤销（无 reflog 依赖）',
        blastRadiusEstimate: '不可逆：3 个文件改动将永久丢失，需重新生成',
      },
      riskClass: 'R4',
      riskReason: '破坏性动作：reset --hard 命中内置危险命令规则库（destructive-git），企业基线要求强 ASK',
      scopeOptions: ['once'],
      scopeLockedReason: 'R4 破坏性操作不留存授权：仅提供「仅本次」，且不写入授权记忆',
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[0].shortId}#turn=1/msg=12`, planRef: 'plan://T-7f3a/step-5' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Requested',
      terminal: 'PENDING',
      dedupeWindowCount: 1,
      dedupeTargets: ['workspace local:/worktrees/payment-core/T-7f3a（git 工作区）'],
      createdAt: r.ago(4),
      expiresAt: r.future(6),
      actionDigest: 'f0a1b7de',
      displayCapSeconds: 300,
    },
    {
      ...ref(1),
      approvalId: 'AR-4f26',
      taskId: 'T-1b02',
      actionSummary: {
        tool: 'run_command',
        targetResource: 'ssh://tester-01.internal:/srv/identity-gateway',
        humanReadableDesc: '在测试机复现登录态问题：重启 identity-gateway 容器',
      },
      preview: {
        kind: 'command',
        commandFullText: 'ssh tester-01.internal "docker compose -f /srv/identity-gateway/dc.yml restart gateway"\n# 远程主机执行（非本机沙箱）：文件系统围栏不适用，仅保留网络围栏',
        blastRadiusEstimate: '影响 1 台测试机上的 1 个容器；测试环境短暂不可用（约 30s）',
      },
      riskClass: 'R2',
      riskReason: '执行类 + 远程目标：命令在远程主机执行，沙箱围栏覆盖不到，按执行类强约束处理',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[1].shortId}#turn=3/msg=2`, planRef: 'plan://T-71b2/step-3' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Expired',
      terminal: 'POLICY_DENY',
      respondedBy: '内核（超时收口，非人工）',
      respondedAt: r.ago(95),
      dedupeWindowCount: 1,
      dedupeTargets: ['ssh://tester-01.internal:/srv/identity-gateway'],
      createdAt: r.ago(100),
      expiresAt: r.ago(95),
      actionDigest: '5e0c9d13',
      displayCapSeconds: 300,
    },
    {
      ...ref(1),
      approvalId: 'AR-4f27',
      taskId: 'T-1b02',
      actionSummary: {
        tool: 'run_command',
        targetResource: 'repo:/identity-gateway/scripts/deploy.sh',
        humanReadableDesc: '执行仓库内发布脚本（命令含命令替换，无法完整解析）',
      },
      preview: {
        kind: 'command',
        commandFullText: './scripts/deploy.sh --env=prod --tag=$(cat .release/latest) --force',
        blastRadiusEstimate: '解析不确定：--force 与命令替换可能覆盖生产配置；按 R2/R4 取高判定',
      },
      riskClass: 'R4',
      riskReason: '参数级 AST 解析失败（UNPARSED）：命令替换 + --force 无法确定最终行为，按「无法解析的命令」取高档并锁定最小范围',
      scopeOptions: ['once'],
      scopeLockedReason: '无法解析 / 部分解析的命令只允许「仅本次」：无法为不确定行为建立可信模式',
      timeout: { defaultMs: 300_000, timeoutAction: 'escalate' },
      contextLinks: { sessionMessageRef: `${sessions[1].shortId}#turn=3/msg=5`, planRef: 'plan://T-71b2/step-4' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Requested',
      terminal: 'PENDING',
      dedupeWindowCount: 1,
      dedupeTargets: ['repo:/identity-gateway/scripts/deploy.sh'],
      createdAt: r.ago(9),
      expiresAt: r.future(8),
      actionDigest: 'a6f2e48b',
      displayCapSeconds: 300,
    },
    {
      ...ref(2),
      approvalId: 'AR-4f28',
      taskId: 'T-2e88',
      actionSummary: {
        tool: 'run_command',
        targetResource: 'workspace local:/worktrees/billing-ledger/T-6d90',
        humanReadableDesc: '运行账务聚合模块单测（mvn -pl billing-ledger test）',
      },
      preview: {
        kind: 'command',
        commandFullText: 'mvn -pl billing-ledger test -DskipITs\n# 沙箱档 L0+ · cpu 2 / mem 3GiB / 超时 300s',
        blastRadiusEstimate: '仅本地构建；无网络、无外部资源',
      },
      riskClass: 'R2',
      riskReason: '执行类：运行测试与构建，命中组织基线中「测试类命令在沙箱内可 ASK 后执行」的常规路径',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[2].shortId}#turn=2/msg=6`, planRef: 'plan://T-6d90/step-4' },
      requesterIdentity: { kind: 'subagent', name: '子 Agent：tester（深度 1）', chain: '权限为父会话收窄子集，责任归属父会话所有者' },
      state: 'Granted',
      terminal: 'GRANTED',
      respondedBy: `${NAMES[0]}（会话所有者）`,
      respondedAt: r.agoHours(2),
      grantScope: 'session',
      dedupeWindowCount: 1,
      dedupeTargets: ['workspace local:/worktrees/billing-ledger/T-6d90'],
      createdAt: r.agoHours(2),
      expiresAt: r.agoHours(2),
      actionDigest: 'b73d10f5',
      displayCapSeconds: 300,
    },
    {
      ...ref(2),
      approvalId: 'AR-4f29',
      taskId: 'T-2e88',
      actionSummary: {
        tool: 'webhook_notify',
        targetResource: 'https://ci.partner-ops.example.com/hooks/oc-build',
        humanReadableDesc: '向外部伙伴 CI 推送构建结果摘要',
      },
      preview: {
        kind: 'network',
        networkTarget: 'HTTPS POST ci.partner-ops.example.com（白名单内域名）· 载荷为脱敏构建摘要',
        blastRadiusEstimate: '出网一次；载荷含仓库名与测试通过率，不含源码与凭证',
      },
      riskClass: 'R3',
      riskReason: '外发类：域名在白名单内（可 ALLOW），但载荷包含构建元数据，企业策略要求人工确认',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'escalate' },
      contextLinks: { sessionMessageRef: `${sessions[2].shortId}#turn=2/msg=9`, planRef: 'plan://T-6d90/step-6' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Escalated',
      terminal: 'ESCALATED',
      respondedBy: '内核（超时 escalate → 已转交团队管理员）',
      respondedAt: r.ago(70),
      dedupeWindowCount: 1,
      dedupeTargets: ['https://ci.partner-ops.example.com/hooks/oc-build'],
      createdAt: r.ago(76),
      expiresAt: r.ago(71),
      actionDigest: 'cc91a207',
      displayCapSeconds: 300,
    },
    {
      ...ref(3),
      approvalId: 'AR-4f2a',
      taskId: 'T-3f72',
      actionSummary: {
        tool: 'write_file',
        targetResource: 'src/test/**（web-console 测试目录）',
        humanReadableDesc: '在测试目录批量新增无障碍用例文件（4 个）',
      },
      preview: {
        kind: 'command',
        commandFullText: 'write src/test/a11y/theme-contrast.spec.ts (+86)\nwrite src/test/a11y/focus-ring.spec.ts (+64)\nwrite src/test/a11y/font-scale.spec.ts (+58)\nwrite src/test/a11y/reduced-motion.spec.ts (+72)',
        blastRadiusEstimate: '仅测试目录；不触碰产品代码与构建配置',
      },
      riskClass: 'R1',
      riskReason: '受控写：目录级授权（dir 范围），写入范围限定 src/test/**',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[3].shortId}#turn=4/msg=3`, planRef: 'plan://T-6a12/step-3' },
      requesterIdentity: { kind: 'subagent', name: '子 Agent：a11y-tester（深度 1）', chain: '权限为父会话收窄子集，责任归属父会话所有者' },
      state: 'Granted',
      terminal: 'GRANTED',
      respondedBy: `${NAMES[1]}（会话所有者）`,
      respondedAt: r.agoDays(1),
      grantScope: 'dir',
      dedupeWindowCount: 1,
      dedupeTargets: ['src/test/**（web-console 测试目录）'],
      createdAt: r.agoDays(1),
      expiresAt: r.agoDays(1),
      actionDigest: '7d5b3c90',
      displayCapSeconds: 300,
    },
    {
      ...ref(4),
      approvalId: 'AR-4f2b',
      taskId: 'T-5a31',
      actionSummary: {
        tool: 'run_command',
        targetResource: 'workspace local:/worktrees/data-pipeline/T-69f1',
        humanReadableDesc: '外部调用方请求执行失败重放脚本（--dry-run 之外带 --commit）',
      },
      preview: {
        kind: 'command',
        commandFullText: 'python tools/replay_failed_batches.py --since=2026-09-18 --commit\n# 由外部调用方（a2a://partner-ops）发起；不属于任何本地会话用户',
        blastRadiusEstimate: '重放将写入 data-pipeline 的批次状态表（幂等键：batch_id + attempt）',
      },
      riskClass: 'R2',
      riskReason: '跨主体请求：非本租户用户发起，应答者需明确承担执行责任；通道全断导致无人应答',
      scopeOptions: ['once'],
      scopeLockedReason: '外部调用方请求不写入本地授权记忆：仅提供「仅本次」，防止跨主体授权残留',
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[4].shortId}#turn=3/msg=1`, planRef: 'plan://T-69f1/step-2' },
      requesterIdentity: { kind: 'external', name: '外部调用方 a2a://partner-ops（联邦实例）', chain: '责任链：联邦实例管理员 → 本实例团队管理员' },
      state: 'Unavailable',
      terminal: 'UNAVAILABLE',
      respondedBy: '内核（fail-closed：通道全断且应答者缺失，按安全默认拒绝）',
      respondedAt: r.agoDays(1),
      dedupeWindowCount: 1,
      dedupeTargets: ['workspace local:/worktrees/data-pipeline/T-69f1'],
      createdAt: r.agoDays(1),
      expiresAt: r.agoDays(1),
      actionDigest: 'e8c4a612',
      displayCapSeconds: 300,
    },
    {
      ...ref(5),
      approvalId: 'AR-4f2d',
      taskId: 'T-6b21',
      actionSummary: {
        tool: 'delegate_subagent',
        targetResource: 'agent://tester（预算信封 tokens ≤200k / $0.80 / 工具 ≤40）',
        humanReadableDesc: '派生 tester 子 Agent 并行补齐稳定性测试',
      },
      preview: {
        kind: 'none',
        blastRadiusEstimate: '子 Agent 工具子集为父级收窄子集（read_file / write_file / run_tests），写范围限 src/test/**',
      },
      riskClass: 'R2',
      riskReason: '派生执行主体：子 Agent 具备执行类工具，需父级责任人对预算信封与写范围确认',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[5].shortId}#turn=2/msg=4`, planRef: 'plan://T-69a8/step-3' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Granted',
      terminal: 'GRANTED',
      respondedBy: `${NAMES[2]}（会话所有者）`,
      respondedAt: r.agoDays(2),
      grantScope: 'once',
      dedupeWindowCount: 1,
      dedupeTargets: ['agent://tester（预算信封 tokens ≤200k / $0.80 / 工具 ≤40）'],
      createdAt: r.agoDays(2),
      expiresAt: r.agoDays(2),
      actionDigest: '91ab7f34',
      displayCapSeconds: 300,
    },
    {
      ...ref(6),
      approvalId: 'AR-4f2e',
      taskId: 'T-8d99',
      actionSummary: {
        tool: 'secret_read',
        targetResource: 'secret://prod/payment/db-password',
        humanReadableDesc: '读取生产支付库口令以复现线上连接池耗尽问题',
      },
      preview: {
        kind: 'none',
        blastRadiusEstimate: '凭证使用经密钥代理：真实值仅存代理内存，注入为短期令牌（TTL 5 分钟），日志与事件中只出现引用名',
      },
      riskClass: 'R5',
      riskReason: '敏感类：命中企业基线「生产凭证默认禁止」；例外流程需平台管理员令牌，且仅限本次使用',
      scopeOptions: ['once'],
      scopeLockedReason: 'R5 敏感操作不留存授权：仅提供「仅本次」+ 短期令牌，禁止写入任何范围的授权记忆',
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[6].shortId}#turn=5/msg=2`, planRef: 'plan://T-68c5/step-5' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      reason: '申请理由：线上连接池耗尽需只读诊断；不使用凭证执行任何写操作，仅做连接数采样 5 分钟。',
      state: 'Requested',
      terminal: 'PENDING',
      dedupeWindowCount: 1,
      dedupeTargets: ['secret://prod/payment/db-password'],
      createdAt: r.ago(3),
      expiresAt: r.future(7),
      actionDigest: '3f6e0d21',
      displayCapSeconds: 300,
    },
    {
      ...ref(7),
      approvalId: 'AR-4f2f',
      taskId: 'T-9c40',
      actionSummary: {
        tool: 'artifact_publish',
        targetResource: 'oss://public-builds/mobile-bff/2.9.0-rc1/',
        humanReadableDesc: '上传构建产物到公共对象存储桶（供外部预览）',
      },
      preview: {
        kind: 'network',
        networkTarget: 'HTTPS PUT public-builds.oss.example.com（公共读桶）',
        blastRadiusEstimate: '对外可见：产物含内部模块名与符号表；企业基线禁止公共桶外发',
      },
      riskClass: 'R2',
      riskReason: '动作风险 R2，但命中企业基线锁定项（public-bucket-upload=DENY）：基线不可被下级放宽，动作被直接拒绝并按策略挂起会话',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[7].shortId}#turn=3/msg=7`, planRef: 'plan://T-6810/step-4' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Halted',
      terminal: 'HALTED',
      respondedBy: '企业基线（组织层策略 public-bucket-upload，锁定不可覆盖）',
      respondedAt: r.agoDays(3),
      dedupeWindowCount: 1,
      dedupeTargets: ['oss://public-builds/mobile-bff/2.9.0-rc1/'],
      createdAt: r.agoDays(3),
      expiresAt: r.agoDays(3),
      actionDigest: '60b9e73f',
      displayCapSeconds: 300,
    },
    {
      ...ref(8),
      approvalId: 'AR-4f30',
      taskId: 'T-0e15',
      actionSummary: {
        tool: 'run_tests',
        targetResource: 'workspace local:/worktrees/search-index/T-67d2',
        humanReadableDesc: '运行 search-index 全量回归测试（含慢速集成用例）',
      },
      preview: {
        kind: 'command',
        commandFullText: 'mvn -pl search-index verify -Pit-slow\n# 预计 22 分钟；cpu 4 / mem 6GiB / 超时 1800s；沙箱档 L1',
        blastRadiusEstimate: '本地只读测试 + 临时索引目录写入（/tmp/oc-it-*，结束后清理）',
      },
      riskClass: 'R2',
      riskReason: '执行类：长时间全量测试，资源占用较高；首次超时后按 escalate 升级至团队管理员',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'escalate' },
      contextLinks: { sessionMessageRef: `${sessions[8].shortId}#turn=4/msg=1`, planRef: 'plan://T-67d2/step-5' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Granted',
      terminal: 'GRANTED',
      respondedBy: `${NAMES[2]}（团队管理员，二级升级应答）`,
      respondedAt: r.agoDays(2),
      grantScope: 'once',
      dedupeWindowCount: 1,
      dedupeTargets: ['workspace local:/worktrees/search-index/T-67d2'],
      createdAt: r.agoDays(2),
      expiresAt: r.agoDays(2),
      actionDigest: '1a8f47c6',
      displayCapSeconds: 300,
    },
    {
      ...ref(9),
      approvalId: 'AR-4f31',
      taskId: 'T-4c66',
      actionSummary: {
        tool: 'run_command',
        targetResource: 'k8s://prod-cluster/ns-prod-payment',
        humanReadableDesc: '删除生产集群中 payment 命名空间的灰度 Deployment',
      },
      preview: {
        kind: 'command',
        commandFullText: 'kubectl -n prod-payment delete deploy payment-canary --grace-period=0\n# 命中企业基线：生产命名空间禁止 delete 类命令（prohibited-in-prod）',
        blastRadiusEstimate: '生产资源变更：可能中断灰度流量；基线判定为禁止类',
      },
      riskClass: 'R4',
      riskReason: '破坏性 + 生产资源：企业基线强制 DENY（不可被下级放宽），未进入人工审批队列',
      scopeOptions: ['once'],
      scopeLockedReason: 'R4 破坏性操作不留存授权：仅提供「仅本次」；本次因企业基线连人工审批都不开放',
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[9].shortId}#turn=2/msg=8`, planRef: 'plan://T-6640/step-6' },
      requesterIdentity: { kind: 'agent', name: 'OpenCoding Agent（主会话）', chain: '会话所有者为最终责任人' },
      state: 'Denied',
      terminal: 'POLICY_DENY',
      respondedBy: '企业基线（组织层策略 prohibited-in-prod）',
      respondedAt: r.agoDays(4),
      dedupeWindowCount: 1,
      dedupeTargets: ['k8s://prod-cluster/ns-prod-payment'],
      createdAt: r.agoDays(4),
      expiresAt: r.agoDays(4),
      actionDigest: '9c25d18a',
      displayCapSeconds: 300,
    },
    {
      ...ref(9),
      approvalId: 'AR-4f32',
      taskId: 'T-4c66',
      actionSummary: {
        tool: 'run_command',
        targetResource: 'workspace local:/worktrees/risk-engine/T-65f0',
        humanReadableDesc: '用户手动请求：清理本地 Docker 构建缓存（docker system prune -f）',
      },
      preview: {
        kind: 'command',
        commandFullText: 'docker system prune -f\n# 回收约 12.4 GB 构建缓存；无 --all 参数，运行中容器与镜像不受影响',
        blastRadiusEstimate: '本地资源回收；不影响运行中容器；不触网',
      },
      riskClass: 'R2',
      riskReason: '执行类（用户主动发起）：人工发起不豁免风险判定，仍走同一决策链并留痕',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      timeout: { defaultMs: 300_000, timeoutAction: 'deny' },
      contextLinks: { sessionMessageRef: `${sessions[9].shortId}#turn=2/msg=11`, planRef: 'manual://user-request/prune' },
      requesterIdentity: { kind: 'user', name: `${NAMES[0]}（会话所有者，手动触发）`, chain: '用户自请求自确认：仍记录决策与理由，不留白' },
      reason: '用户请求：构建缓存占满磁盘，需立即回收以恢复 CI 本地构建。',
      state: 'Granted',
      terminal: 'GRANTED',
      respondedBy: `${NAMES[0]}（会话所有者）`,
      respondedAt: r.ago(40),
      grantScope: 'once',
      dedupeWindowCount: 1,
      dedupeTargets: ['workspace local:/worktrees/risk-engine/T-65f0'],
      createdAt: r.ago(41),
      expiresAt: r.ago(40),
      actionDigest: '4b12f8c7',
      displayCapSeconds: 300,
    },
  ];

  // 不可变审计：仅追加、不可修改（Object.freeze 兜底，视图侧只读呈现）
  const rawEvents: Omit<ApprovalEvent, 'eventId'>[] = [
    { approvalId: 'AR-4f21', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: '动作经决策链判定为 ASK（模式「mvn * test*」未命中，重新询问）', at: r.ago(6) },
    { approvalId: 'AR-4f21', fromState: 'Requested', toState: 'Requested', actorIdentity: 'kernel://dedupe-window', actorKind: 'system', reason: '30s 去重窗口合并同动作 ×3（同工具同参数，目标资源不同），展开可见每次目标', at: r.ago(5) },
    { approvalId: 'AR-4f22', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: 'R1 受控写附 diff 预览，进入审批', at: r.agoHours(2) },
    { approvalId: 'AR-4f22', fromState: 'Requested', toState: 'Granted', actorIdentity: `${NAMES[0]}（会话所有者）`, actorKind: 'user', reason: '批准并授予范围：session（本会话内同类 edit_file）', at: r.agoHours(2) },
    { approvalId: 'AR-4f23', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: 'R3 外发：目标域名不在网络白名单，进入审批', at: r.agoHours(3) },
    { approvalId: 'AR-4f23', fromState: 'Requested', toState: 'Denied', actorIdentity: `${NAMES[0]}（会话所有者）`, actorKind: 'user', reason: '用户拒绝：该域名未加白，请改用 kb_search 检索内网规范', at: r.agoHours(3) },
    { approvalId: 'AR-4f2c', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: 'R4 破坏性动作：reset --hard 命中危险命令规则库，范围锁定为「仅本次」', at: r.ago(4) },
    { approvalId: 'AR-4f26', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: 'R2 执行（远程目标）：沙箱围栏不覆盖远程主机，进入审批', at: r.ago(100) },
    { approvalId: 'AR-4f26', fromState: 'Requested', toState: 'Expired', actorIdentity: 'kernel://approval-orchestrator', actorKind: 'system', reason: '展示倒计时结束（300s 内无应答）；端上不判定终态，等待内核按超时动作收口', at: r.ago(95) },
    { approvalId: 'AR-4f26', fromState: 'Expired', toState: 'Denied', actorIdentity: 'kernel://approval-orchestrator', actorKind: 'system', reason: '超时动作 deny：按策略拒绝（不计入用户主动拒绝），恢复入口：重新发起', at: r.ago(95) },
    { approvalId: 'AR-4f27', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: '命令解析失败（UNPARSED）：按 R2/R4 取高，范围锁定为「仅本次」', at: r.ago(9) },
    { approvalId: 'AR-4f27', fromState: 'Requested', toState: 'Requested', actorIdentity: 'kernel://risk-assessor', actorKind: 'system', reason: '范围收紧：无法解析命令不提供任何留存范围（防止为不确定行为建立可信模式）', at: r.ago(9) },
    { approvalId: 'AR-4f28', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://subagent/tester', actorKind: 'agent', reason: '子 Agent 请求（工具子集为父级收窄子集），预算信封已声明', at: r.agoHours(2) },
    { approvalId: 'AR-4f28', fromState: 'Requested', toState: 'Granted', actorIdentity: `${NAMES[0]}（会话所有者）`, actorKind: 'user', reason: '批准并授予范围：session（本会话内 mvn test 类命令）', at: r.agoHours(2) },
    { approvalId: 'AR-4f29', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: 'R3 外发（白名单域名但载荷含构建元数据）：企业策略要求人工确认', at: r.ago(76) },
    { approvalId: 'AR-4f29', fromState: 'Requested', toState: 'Expired', actorIdentity: 'kernel://approval-orchestrator', actorKind: 'system', reason: '倒计时结束，超时动作声明为 escalate', at: r.ago(71) },
    { approvalId: 'AR-4f29', fromState: 'Expired', toState: 'Escalated', actorIdentity: 'kernel://escalation-chain', actorKind: 'system', reason: '一级无应答 → 升级至团队管理员（顾清和），SLA 15 分钟', at: r.ago(70) },
    { approvalId: 'AR-4f2a', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://subagent/a11y-tester', actorKind: 'agent', reason: 'R1 目录级写：写范围声明为 src/test/**', at: r.agoDays(1) },
    { approvalId: 'AR-4f2a', fromState: 'Requested', toState: 'Granted', actorIdentity: `${NAMES[1]}（会话所有者）`, actorKind: 'user', reason: '批准并授予范围：dir（src/test/**，确认前已展开目录清单）', at: r.agoDays(1) },
    { approvalId: 'AR-4f2b', fromState: 'None', toState: 'Requested', actorIdentity: 'a2a://partner-ops（联邦实例）', actorKind: 'external', reason: '外部调用方请求执行写类脚本；不写入本地授权记忆', at: r.agoDays(1) },
    { approvalId: 'AR-4f2b', fromState: 'Requested', toState: 'Unavailable', actorIdentity: 'kernel://approval-orchestrator', actorKind: 'system', reason: '通道全断 + 应答者缺失：按 fail-closed 安全默认拒绝（区别于超时收口）', at: r.agoDays(1) },
    { approvalId: 'AR-4f2d', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: '派生执行主体：确认预算信封与工具子集', at: r.agoDays(2) },
    { approvalId: 'AR-4f2d', fromState: 'Requested', toState: 'Granted', actorIdentity: `${NAMES[2]}（会话所有者）`, actorKind: 'user', reason: '批准（仅本次）：不保留派生授权', at: r.agoDays(2) },
    { approvalId: 'AR-4f2e', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: 'R5 敏感：命中企业基线例外流程，需平台管理员令牌，仅本次可用', at: r.ago(3) },
    { approvalId: 'AR-4f2e', fromState: 'Requested', toState: 'Requested', actorIdentity: 'kernel://baseline-guard', actorKind: 'system', reason: '范围锁定：R5 不提供任何留存范围，令牌 TTL 5 分钟且不可续期', at: r.ago(3) },
    { approvalId: 'AR-4f2f', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: '动作风险 R2，但企业基线锁定项 public-bucket-upload=DENY', at: r.agoDays(3) },
    { approvalId: 'AR-4f2f', fromState: 'Requested', toState: 'Halted', actorIdentity: 'policy://org-baseline@v12', actorKind: 'system', reason: '基线强制拒绝并挂起会话；需合规存储路径或管理员变更基线后恢复', at: r.agoDays(3) },
    { approvalId: 'AR-4f30', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: 'R2 长时执行（预计 22 分钟），超时动作声明为 escalate', at: r.agoDays(2) },
    { approvalId: 'AR-4f30', fromState: 'Requested', toState: 'Expired', actorIdentity: 'kernel://approval-orchestrator', actorKind: 'system', reason: '倒计时结束（本人在会议中未响应）', at: r.agoDays(2) },
    { approvalId: 'AR-4f30', fromState: 'Expired', toState: 'Escalated', actorIdentity: 'kernel://escalation-chain', actorKind: 'system', reason: '升级至团队管理员（顾清和），附执行窗口与资源占用说明', at: r.agoDays(2) },
    { approvalId: 'AR-4f30', fromState: 'Escalated', toState: 'Granted', actorIdentity: `${NAMES[2]}（团队管理员）`, actorKind: 'user', reason: '批准（仅本次）：同意在资源窗口内执行，结束后回收', at: r.agoDays(2) },
    { approvalId: 'AR-4f31', fromState: 'None', toState: 'Requested', actorIdentity: 'agent://main-session', actorKind: 'agent', reason: 'R4 + 生产资源：命中企业基线 prohibited-in-prod', at: r.agoDays(4) },
    { approvalId: 'AR-4f31', fromState: 'Requested', toState: 'Denied', actorIdentity: 'policy://org-baseline@v12', actorKind: 'system', reason: '基线强制拒绝（不可被下级放宽）；已生成安全事件 permission.override.denied', at: r.agoDays(4) },
    { approvalId: 'AR-4f32', fromState: 'None', toState: 'Requested', actorIdentity: `${NAMES[0]}（会话所有者，手动触发）`, actorKind: 'user', reason: '用户手动发起执行类动作：进入同一决策链（发起者身份不豁免风险判定）', at: r.ago(41) },
    { approvalId: 'AR-4f32', fromState: 'Requested', toState: 'Granted', actorIdentity: `${NAMES[0]}（会话所有者）`, actorKind: 'user', reason: '批准（仅本次）：本地缓存回收，无外发与跨区影响', at: r.ago(40) },
  ];
  const approvalEvents: ApprovalEvent[] = Object.freeze(
    rawEvents.map((e, i) => Object.freeze({ ...e, eventId: `EV-${(0x9f00 + i).toString(16)}` })),
  ) as unknown as ApprovalEvent[];

  const replayRecords: ReplayRecord[] = [
    {
      decisionId: 'DEC-9f21a3',
      approvalId: 'AR-4f22',
      actionDescriptor: 'edit_file(path=src/main/java/com/acme/payment/PaymentServiceImpl.java, bytes=2140)',
      policyVersion: 'policy.org@v12 / project@v7 / workspace@v3',
      evaluationTrace: [
        { step: 1, rule: 'org.baseline.dlp-scan', result: 'NO_MATCH', note: 'diff 未命中密钥/凭证特征' },
        { step: 2, rule: 'workspace.write-scope(T-7f3a)', result: 'ALLOW', note: '路径在 worktree 写范围内' },
        { step: 3, rule: 'project.file-write(src/**)', result: 'ASK', note: '受控写默认按模式询问' },
        { step: 4, rule: 'mode.default:edit=ask', result: 'ASK', note: '模式为 default，未开启 acceptEdits' },
        { step: 5, rule: 'human.decision(AR-4f22)', result: 'ALLOW', note: '用户批准并授予 session 范围' },
      ],
      contextSummaryRef: 'ctx://S-4001/turn=1/summary#L2',
      replayMatch: true,
      replayedAt: r.agoHours(1),
    },
    {
      decisionId: 'DEC-9f21b7',
      approvalId: 'AR-4f26',
      actionDescriptor: 'run_command(ssh tester-01.internal, restart gateway)',
      policyVersion: 'policy.org@v12 / project@v7 / sandbox@v5',
      evaluationTrace: [
        { step: 1, rule: 'sandbox.remote-host-detect', result: 'ASK', note: '远程主机：文件系统围栏不适用，仅网络围栏生效' },
        { step: 2, rule: 'project.test-host-allowlist', result: 'NO_MATCH', note: 'tester-01 未登记为免确认主机' },
        { step: 3, rule: 'mode.default:exec=ask', result: 'ASK', note: '执行类默认询问' },
        { step: 4, rule: 'approval.timeout(300s)', result: 'ASK', note: '超时动作声明为 deny' },
        { step: 5, rule: 'timeout.policy.deny', result: 'DENY', note: '倒计时结束 → 按策略拒绝（非用户拒绝）' },
      ],
      contextSummaryRef: 'ctx://S-41b2/turn=3/summary#L1',
      replayMatch: true,
      replayedAt: r.ago(90),
    },
    {
      decisionId: 'DEC-9f21c2',
      approvalId: 'AR-4f27',
      actionDescriptor: 'run_command(./scripts/deploy.sh --env=prod --tag=$(cat .release/latest) --force)',
      policyVersion: 'policy.org@v12 / project@v7',
      evaluationTrace: [
        { step: 1, rule: 'risk.ast-parse', result: 'FORCE', note: '命令替换导致解析失败（UNPARSED）→ 无法为参数建立可信模式' },
        { step: 2, rule: 'risk.unparsed.take-max', result: 'FORCE', note: '按 R2/R4 取高 → R4' },
        { step: 3, rule: 'scope.unparsed.once-only', result: 'FORCE', note: '范围锁定为「仅本次」，禁止留存' },
        { step: 4, rule: 'approval.timeout(300s)', result: 'ASK', note: '超时动作 escalate（部署类偏好升级而非静默拒绝）' },
      ],
      contextSummaryRef: 'ctx://S-41b2/turn=3/summary#L2',
      replayMatch: true,
      replayedAt: r.ago(5),
    },
    {
      decisionId: 'DEC-9f21d9',
      approvalId: 'AR-4f29',
      actionDescriptor: 'webhook_notify(POST https://ci.partner-ops.example.com/hooks/oc-build)',
      policyVersion: 'policy.org@v12 → 重放使用 policy.org@v13',
      evaluationTrace: [
        { step: 1, rule: 'network.allowlist(partner-ops)', result: 'ALLOW', note: '域名在白名单内' },
        { step: 2, rule: 'dlp.payload-scan', result: 'ASK', note: '载荷含构建元数据，v13 起要求人工确认' },
        { step: 3, rule: 'approval.timeout(300s)', result: 'ASK', note: '超时动作 escalate' },
        { step: 4, rule: 'escalation.chain(level=2)', result: 'ASK', note: 'v13 新增：一级 SLA 内未响应直接升级（不再二次等待）' },
      ],
      contextSummaryRef: 'ctx://S-42d0/turn=2/summary#L1',
      replayMatch: false,
      divergence: '首个分歧：步骤 4——原决策在 v12 下等待一级二次提醒（ASK），重放 v13 立即升级（ESCALATE）。策略版本差异导致编排分支不同，最终安全结论一致。',
      replayedAt: r.ago(30),
    },
    {
      decisionId: 'DEC-9f21e4',
      approvalId: 'AR-4f2b',
      actionDescriptor: 'run_command(python tools/replay_failed_batches.py --commit) @ a2a://partner-ops',
      policyVersion: 'policy.org@v12 / federation@v2',
      evaluationTrace: [
        { step: 1, rule: 'requester.cross-tenant-check', result: 'ASK', note: '联邦外部调用方：需本地应答者承担执行责任' },
        { step: 2, rule: 'channel.availability-snapshot', result: 'FORCE', note: '原决策时 IM 通道 DEGRADED，桌面/CLI 可达' },
        { step: 3, rule: 'scope.external.once-only', result: 'FORCE', note: '外部调用方请求不写入本地授权记忆' },
        { step: 4, rule: 'approval.unavailable.fail-closed', result: 'DENY', note: '重放时探测通道全断 + 应答者缺失 → UNAVAILABLE' },
      ],
      contextSummaryRef: 'ctx://S-43e1/turn=3/summary#L1',
      replayMatch: false,
      divergence: '首个分歧：步骤 2——通道可用性快照从 DEGRADED 变为 UNAVAILABLE（环境差异，非策略差异）。安全结论一致：均按 fail-closed 拒绝。',
      replayedAt: r.agoDays(1),
    },
    {
      decisionId: 'DEC-9f21f0',
      approvalId: 'AR-4f2c',
      actionDescriptor: 'run_command(git reset --hard origin/main)',
      policyVersion: 'policy.org@v12 / builtin.dangerous-commands@v9',
      evaluationTrace: [
        { step: 1, rule: 'builtin.dangerous-commands(destructive-git)', result: 'ASK', note: '命中 reset --hard 规则' },
        { step: 2, rule: 'risk.r4.strong-ask', result: 'ASK', note: 'R4 破坏性：需显式确认与理由' },
        { step: 3, rule: 'scope.r4.once-only', result: 'FORCE', note: 'R4/R5 不提供除「仅本次」外的任何范围（REQ-PERM-28）' },
      ],
      contextSummaryRef: 'ctx://S-4001/turn=1/summary#L2',
      replayMatch: true,
      replayedAt: r.ago(3),
    },
    {
      decisionId: 'DEC-9f2201',
      approvalId: 'AR-4f31',
      actionDescriptor: 'run_command(kubectl -n prod-payment delete deploy payment-canary)',
      policyVersion: 'policy.org@v12（基线锁定项）',
      evaluationTrace: [
        { step: 1, rule: 'resource.prod-classify', result: 'FORCE', note: '生产命名空间：资产分级 A1' },
        { step: 2, rule: 'org.baseline.prohibited-in-prod', result: 'DENY', note: '基线锁定，不可被租户/项目/工作区放宽' },
        { step: 3, rule: 'override.attempt-detect', result: 'DENY', note: '已生成安全事件 permission.override.denied' },
      ],
      contextSummaryRef: 'ctx://S-4533/turn=2/summary#L1',
      replayMatch: true,
      replayedAt: r.agoDays(4),
    },
  ];

  const channels: ApprovalChannel[] = [
    {
      id: 'cli',
      name: 'CLI 内联',
      state: 'READY',
      enabled: true,
      deliveryTarget: 'tty://local（oc run 会话内联渲染）',
      lastDelivery: { at: r.ago(4), approvalId: 'AR-4f2c', result: '已展示（等待 A/S/R 输入）' },
      failureRetries: 0,
      retryPolicy: '无需重试：终端内联同步渲染，进程存活即可达',
      note: '键盘 A/S/R/Shift+R/D/Tab；Esc 收起不产生决策',
    },
    {
      id: 'desktop',
      name: '桌面卡片',
      state: 'READY',
      enabled: true,
      deliveryTarget: 'desktop://workbench（本 Web 客户端 + 桌面端共用协议）',
      lastDelivery: { at: r.ago(6), approvalId: 'AR-4f21', result: '已送达（含 diff 预览与范围 chips）' },
      failureRetries: 0,
      retryPolicy: '断线重连后按 seq 补投；重复投递按 approvalId 幂等去重',
      note: '主通道：支持 diff hunk 折叠、批量批准与 30s 去重合并标注',
    },
    {
      id: 'a2a',
      name: '远程 A2A 回调',
      state: 'DEGRADED',
      enabled: true,
      deliveryTarget: 'a2a://partner-ops/approval-callback',
      lastDelivery: { at: r.agoDays(1), approvalId: 'AR-4f2b', result: '回调超时（第 2 次重试仍失败）' },
      failureRetries: 2,
      retryPolicy: '指数退避 5s/15s/45s，最多 3 次；仍失败则降级为桌面通道并标注「远程不可达」',
      note: '远程端不可达时不静默：本地保留待审批条目并显式提示通道降级',
    },
    {
      id: 'im',
      name: 'IM 机器人',
      state: 'UNAVAILABLE',
      enabled: false,
      deliveryTarget: 'im://robot/oc-approval（Webhook 签名校验失败）',
      lastDelivery: { at: r.agoDays(2), approvalId: 'AR-4f2d', result: '投递失败（签名不匹配，已熔断）' },
      failureRetries: 3,
      retryPolicy: '熔断后 10 分钟内不再投递该通道；恢复需重新绑定密钥引用并验证签名',
      note: '通道不可用时按 fail-closed：不因「投递失败」而视为已通知',
    },
  ];

  const deliveries: DeliveryRecord[] = [
    { id: 'DL-9f01', approvalId: 'AR-4f21', channel: 'desktop', at: r.ago(6), result: 'DELIVERED', latencyMs: 180, retries: 0, detail: '含 diff/命令预览与六级范围 chips' },
    { id: 'DL-9f02', approvalId: 'AR-4f21', channel: 'cli', at: r.ago(6), result: 'MERGED', latencyMs: 12, retries: 0, detail: '同动作 ×3 在 30s 窗口内合并为一张卡' },
    { id: 'DL-9f03', approvalId: 'AR-4f2c', channel: 'desktop', at: r.ago(4), result: 'DELIVERED', latencyMs: 164, retries: 0, detail: 'R4 强确认卡（范围仅「仅本次」）' },
    { id: 'DL-9f04', approvalId: 'AR-4f2c', channel: 'im', at: r.ago(4), result: 'FAILED', latencyMs: 3_000, retries: 2, detail: 'Webhook 签名校验失败（通道已熔断）' },
    { id: 'DL-9f05', approvalId: 'AR-4f2b', channel: 'a2a', at: r.agoDays(1), result: 'FAILED', latencyMs: 15_000, retries: 2, detail: '回调端点超时；远程端 ACK 缺失' },
    { id: 'DL-9f06', approvalId: 'AR-4f2b', channel: 'desktop', at: r.agoDays(1), result: 'DELIVERED', latencyMs: 210, retries: 0, detail: '降级通道投递成功，并标注「远程不可达」' },
    { id: 'DL-9f07', approvalId: 'AR-4f2e', channel: 'desktop', at: r.ago(3), result: 'DELIVERED', latencyMs: 152, retries: 0, detail: 'R5 例外流程卡（需平台管理员令牌）' },
    { id: 'DL-9f08', approvalId: 'AR-4f2e', channel: 'cli', at: r.ago(3), result: 'MERGED', latencyMs: 9, retries: 0, detail: 'CLI 与桌面同 approvalId 幂等去重' },
    { id: 'DL-9f09', approvalId: 'AR-4f26', channel: 'desktop', at: r.ago(100), result: 'DELIVERED', latencyMs: 168, retries: 0, detail: '超时后由内核收口（通道无责）' },
    { id: 'DL-9f0a', approvalId: 'AR-4f29', channel: 'a2a', at: r.ago(76), result: 'DELIVERED', latencyMs: 640, retries: 1, detail: '首次 ACK 丢失，第 1 次重试成功' },
    { id: 'DL-9f0b', approvalId: 'AR-4f30', channel: 'desktop', at: r.agoDays(2), result: 'DELIVERED', latencyMs: 174, retries: 0, detail: '升级后重新投递给团队管理员' },
    { id: 'DL-9f0c', approvalId: 'AR-4f27', channel: 'desktop', at: r.ago(9), result: 'RETRYING', latencyMs: 1_200, retries: 1, detail: '推送服务抖动，正在退避重试（不视为已通知）' },
  ];

  const escalationTemplate: EscalationLevel[] = [
    { level: 1, role: '会话所有者', owner: '当前会话责任人', slaMinutes: 5, arrivedAt: null, note: '第一应答人；SLA 超时按该请求声明的超时动作收口（deny 或 escalate）' },
    { level: 2, role: '团队管理员', owner: '平台团队管理员', slaMinutes: 15, arrivedAt: null, note: '可批准跨项目/跨工作区范围；升级时附执行窗口与资源占用说明' },
    { level: 3, role: '平台管理员', owner: '平台治理负责人', slaMinutes: 60, arrivedAt: null, note: 'R5 例外与基线例外唯一放行口；应答留痕并生成审计条目' },
  ];

  const escalations: EscalationChain[] = [
    {
      approvalId: 'AR-4f29',
      currentLevel: 2,
      slaRemainingMs: 8 * 60_000,
      startedAt: r.ago(70),
      resolved: false,
      outcome: '等待团队管理员应答（一级 SLA 5 分钟已超时，超时动作 escalate）',
      levels: escalationTemplate.map((l) => ({
        ...l,
        arrivedAt: l.level === 1 ? r.ago(76) : l.level === 2 ? r.ago(70) : null,
        note: l.level === 2 ? '已附构建摘要载荷与出网审计记录' : l.note,
      })),
    },
    {
      approvalId: 'AR-4f30',
      currentLevel: 2,
      slaRemainingMs: 0,
      startedAt: r.agoDays(2),
      resolved: true,
      outcome: '团队管理员批准（仅本次）：执行窗口 22 分钟，结束后回收临时资源',
      levels: escalationTemplate.map((l) => ({
        ...l,
        arrivedAt: l.level === 1 ? r.agoDays(2) : l.level === 2 ? r.agoDays(2) : null,
        note: l.level === 2 ? '批准并设定执行窗口；结束后自动回收' : l.note,
      })),
    },
  ];

  const approvalStats: ApprovalStats = {
    totalRequests: approvals.length,
    askRatio: 0.185,
    avgHumanLatencyMs: 42_600,
    timeoutCount: 3,
    pendingCount: approvals.filter((a) => a.state === 'Requested').length,
    grantedCount: approvals.filter((a) => a.terminal === 'GRANTED').length,
    deniedByUserCount: approvals.filter((a) => a.terminal === 'DENIED').length,
    policyDeniedCount: approvals.filter((a) => a.terminal === 'POLICY_DENY').length,
    escalatedCount: approvals.filter((a) => a.terminal === 'ESCALATED').length,
    unavailableCount: approvals.filter((a) => a.terminal === 'UNAVAILABLE').length,
    haltedCount: approvals.filter((a) => a.terminal === 'HALTED').length,
    dedupedMergedCount: 4,
    storedScopeCount: sessionData.grantMemories.length,
    byRisk: (['R0', 'R1', 'R2', 'R3', 'R4', 'R5'] as RiskClass[]).map((rc) => ({
      name: rc,
      value: approvals.filter((a) => a.riskClass === rc).length,
    })),
    latencyTrend: [
      { name: '人工时延中位（s）', points: [58, 46, 51, 39, 44, 37, 43].map((y, i) => ({ x: `D-${6 - i}`, y })) },
      { name: '自动/策略时延（s）', points: [1.2, 0.9, 1.1, 0.8, 1.0, 0.7, 0.9].map((y, i) => ({ x: `D-${6 - i}`, y })) },
    ],
    outcomeFunnel: [
      { name: '决策链判定为 ASK', value: 62 },
      { name: '生成审批请求', value: 41 },
      { name: '人工应答', value: 33 },
      { name: '已成终态', value: 30 },
    ],
  };

  return { approvals, approvalEvents, replayRecords, channels, deliveries, escalations, escalationTemplate, approvalStats };
}

/** 固定种子实例：页面直接 import 使用，保证刷新一致 */
export const approvalData = buildApprovalData(new Rng(20260921));
