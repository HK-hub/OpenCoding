/**
 * 会话域 mock 数据（卷 01/12/16/22 + impl/30）。
 * 一个会话 = Thread/Turn/Item 原语；条目类型封闭集见 KP §4.4。
 */
import { Rng, NAMES, REPOS } from '../rng';

export type RunnerState = 'IDLE' | 'RUNNING' | 'WAITING_APPROVAL' | 'PAUSED' | 'FAILED' | 'COMPLETED';
export type ItemType =
  | 'user_message' | 'assistant_message' | 'tool_call' | 'tool_result'
  | 'approval' | 'checkpoint' | 'notice' | 'subagent' | 'plan' | 'ask';
export type TurnPhase = 'PARSE' | 'ASSESS' | 'PLAN' | 'EXECUTE' | 'REFLECT' | 'VERIFY' | 'WRAP';

export interface SessionItem {
  itemId: string;
  seq: number;
  turnNo: number;
  type: ItemType;
  actor: 'user' | 'agent' | 'subagent' | 'system';
  at: string;
  /** 用户对助手结论的反馈：写入条目后按钮置灰；好评进评测正样本，点踩进人工复核 */
  feedback?: { vote: 'up' | 'down'; at: string };
  /** 文本类条目 */
  text?: string;
  /** 推理链（默认折叠） */
  thinking?: string;
  /** 工具调用 */
  tool?: {
    callId: string;
    name: string;
    summary: string;
    args: Record<string, unknown>;
    risk: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'awaiting_approval';
    durationMs?: number;
    resultSummary?: string;
    externalized?: boolean;
    artifactRef?: string;
    cacheHit?: boolean;
  };
  /** 审批卡（字段顺序 ①–⑦） */
  approval?: {
    approvalId: string;
    riskLevel: string;
    actionSummary: string;
    preview: string;
    previewKind: 'diff' | 'command';
    targetResource: string;
    scopeOptions: string[];
    expiresAt: string;
    timeoutAction: 'deny' | 'escalate';
    actionDigest: string;
    decision: 'ALLOW' | 'ALLOW_ONCE' | 'ASK' | 'DENY' | null;
    reason?: string;
  };
  /** 计划卡 */
  plan?: { steps: { text: string; status: 'todo' | 'doing' | 'done' }[]; changeReason?: string };
  /** 检查点 */
  checkpoint?: { checkpointId: string; stepNo: number; sideEffects: number; note: string; restoredAt?: string };
  /** 子 Agent */
  subagent?: { agent: string; brief: string; tools: string[]; budget: string; result?: string; depth: number };
  /** 通知类 */
  notice?: { level: 'info' | 'warn' | 'error'; text: string; traceId?: string };
  /** 结构化提问（ask_user 工具）：选项 + 允许自由输入 + 已回答状态 */
  ask?: {
    question: string;
    /** 单选 / 多选 */
    multiple: boolean;
    options: { value: string; label: string; hint?: string }[];
    /** 允许自由输入（选项覆盖不了时可补一句） */
    allowFreeText: boolean;
    /** 已回答结果 */
    answer?: { selected: string[]; freeText?: string; at: string };
    /** 未回答时的阻塞说明 */
    blocking: string;
    expiresInMs?: number;
  };
}

export interface Session {
  id: string;
  shortId: string;
  title: string;
  state: RunnerState;
  phase: TurnPhase;
  mode: 'coding' | 'plan' | 'review' | 'debug' | 'research' | 'design';
  autonomy: 'propose' | 'collaborate' | 'autonomous';
  permissionMode: 'readonly' | 'plan' | 'default' | 'acceptEdits' | 'autonomous' | 'yolo';
  workspace: string;
  repo: string;
  branch: string;
  worktree?: string;
  model: string;
  lastEventSeq: number;
  lastEventType: string;
  createdAt: string;
  updatedAt: string;
  retention: 'SESSION' | 'ARCHIVED' | 'TRASH';
  tokens: number;
  cost: number;
  messages: number;
  pendingApprovals: number;
  owner: string;
  tags: string[];
  hasMedia: boolean;
  forkedFrom?: string;
  unread?: boolean;
}

export interface ContextSectionData {
  code: string;
  name: string;
  budget: number;
  tokens: number;
  eviction: string;
  compression: string;
  cache: string;
  desc: string;
  sources: string[];
}

export interface SessionData {
  sessions: Session[];
  items: SessionItem[];
  /** 按会话隔离的条目流（会话切换时整体替换，不交叉污染） */
  itemsBySession: Record<string, SessionItem[]>;
  contextSections: ContextSectionData[];
  compactionHistory: { level: string; before: number; after: number; reason: string; at: string; reverted: boolean }[];
  sessionCost: {
    total: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    ttfbMs: number;
    totalMs: number;
    byModelSeries: { name: string; points: { x: string; y: number }[] }[];
    byTool: { name: string; value: number }[];
    budget: number;
  };
  grantMemories: { id: string; scope: string; scopeText: string; tool: string; pattern: string; createdAt: string; source: string; expiresAt: string | null }[];
  safePoints: { stepId: string; at: string; affected: string[]; sideEffects: string }[];
  attachments: { id: string; name: string; kind: 'image' | 'pdf' | 'sheet' | 'audio' | 'video'; size: string; ref: string }[];
  turnPhases: { phase: TurnPhase; at: string; note: string }[];
  trajectory: { seq: number; type: string; summary: string }[];
}

const TOOL_SCRIPTS = [
  { name: 'read_file', summary: '读取 src/main/java/.../PaymentServiceImpl.java', risk: 'R0' },
  { name: 'grep_search', summary: '在 payment-core 中检索 idempotencyKey 用法', risk: 'R0' },
  { name: 'edit_file', summary: '编辑 PaymentServiceImpl（+38 −12）', risk: 'R1' },
  { name: 'write_file', summary: '新增 IdempotencyGuardTest.java（+120）', risk: 'R1' },
  { name: 'run_command', summary: 'mvn -pl payment-core test -Dtest=IdempotencyGuardTest', risk: 'R2' },
  { name: 'run_tests', summary: '运行 payment-core 全量单测', risk: 'R2' },
  { name: 'git_status', summary: '查看工作区变更', risk: 'R0' },
  { name: 'kb_search', summary: '检索「幂等键 设计约定」', risk: 'R0' },
  { name: 'memory_recall', summary: '召回项目记忆「提交信息使用中文」', risk: 'R0' },
  { name: 'web_fetch', summary: '抓取内部规范页（限白名单域名）', risk: 'R3' },
  { name: 'view_image', summary: '识别设计稿中的状态机图', risk: 'R0' },
  { name: 'delegate_subagent', summary: '派生子 Agent：并行补齐测试', risk: 'R1' },
];

export function buildSessionData(r: Rng): SessionData {
  const sessions: Session[] = [];
  const titles = [
    '为 payment-core 增加幂等重试并补齐单测',
    '排查 identity-gateway 登录态偶发失效',
    '重构 billing-ledger 的账务聚合逻辑',
    '给 web-console 接入暗色主题与无障碍修正',
    '梳理 data-pipeline 的失败重放路径',
    '调研搜索索引从 ES 迁到 PG FTS 的可行性',
    '修复 notification-hub 的重复推送',
    '为 mobile-bff 设计 GraphQL 聚合层',
    '把 e2e 用例从 Cypress 迁到 Playwright',
    '给 asset-service 加上内容寻址去重',
    '安全评审：密钥读取路径全量梳理',
    '给 risk-engine 增加规则回归评测集',
  ];
  titles.forEach((title, i) => {
    const state: RunnerState = i === 0 ? 'WAITING_APPROVAL' : i === 1 ? 'RUNNING' : i === 4 ? 'PAUSED' : i === 7 ? 'FAILED' : 'COMPLETED';
    // 时间自洽：创建于 N 分钟前，更新于创建之后（保证 updatedAt ≥ createdAt）
    const createdMinutes = r.int(90, 14_400);
    const updatedMinutes = r.int(1, Math.max(2, createdMinutes - 1));
    sessions.push({
      id: `S-${(1000 + i * 37).toString(36)}${i}`,
      shortId: `S-${(4000 + i * 13).toString(16)}`,
      title,
      state,
      phase: state === 'RUNNING' ? 'EXECUTE' : state === 'WAITING_APPROVAL' ? 'EXECUTE' : state === 'COMPLETED' ? 'WRAP' : 'REFLECT',
      mode: r.pick(['coding', 'coding', 'review', 'debug', 'research', 'design']),
      autonomy: r.pick(['collaborate', 'collaborate', 'propose', 'autonomous']),
      permissionMode: i === 10 ? 'readonly' : i === 4 ? 'autonomous' : 'default',
      workspace: `WS-${(2000 + i).toString(16)}`,
      repo: REPOS[i % REPOS.length],
      branch: `oc/${(700 + i).toString(16)}-${['retry', 'session', 'ledger', 'theme', 'replay', 'fts', 'dedupe', 'graphql', 'playwright', 'cas', 'secret', 'eval'][i]}`,
      worktree: i % 3 === 0 ? `/worktrees/${REPOS[i % REPOS.length]}/T-${(700 + i).toString(16)}` : undefined,
      model: r.weighted(['claude-sonnet-4.5', 'gpt-5.1', 'gemini-2.5-pro', 'deepseek-v3.2', 'qwen3-max'], [5, 3, 2, 2, 1]),
      lastEventSeq: r.int(200, 40_000),
      lastEventType: r.pick(['agent.turn.started', 'tool.call.completed', 'context.compacted', 'workitem.state.changed', 'model.request.completed']),
      createdAt: r.ago(createdMinutes),
      updatedAt: r.ago(updatedMinutes),
      retention: i > 9 ? 'ARCHIVED' : 'SESSION',
      tokens: r.int(12_000, 260_000),
      cost: r.float(0.02, 6.4, 4),
      messages: r.int(6, 84),
      pendingApprovals: i === 0 ? 2 : i === 2 ? 1 : 0,
      owner: r.pick(NAMES),
      tags: r.sample(['P0', '支付', '重构', '前端', '安全', '性能', '文档', '实验'], r.int(1, 3)),
      hasMedia: i % 4 === 0,
      forkedFrom: i === 5 ? 'S-4001' : undefined,
      unread: i < 3,
    });
  });

  // 旗舰会话的完整条目流（Thread/Turn/Item 三类条目分层）
  const items: SessionItem[] = [];
  let seq = 18_231;
  const push = (it: Omit<SessionItem, 'itemId' | 'seq'>) => {
    seq += r.int(1, 9);
    items.push({ ...it, itemId: `it_${seq.toString(36)}`, seq });
    return items[items.length - 1];
  };

  push({
    turnNo: 1, type: 'user_message', actor: 'user', at: r.agoHours(3),
    text: '为 payment-core 的支付回执接口增加幂等重试：同一 idempotencyKey 重复提交只生效一次；失败按指数退避重试 3 次；补齐单测。注意不要改公开 API 签名。',
  });
  push({
    turnNo: 1, type: 'assistant_message', actor: 'agent', at: r.agoHours(3),
    thinking: '用户要求：① 幂等（同 key 只生效一次）② 指数退避重试 3 次 ③ 补单测 ④ 不改公开签名。先看现有实现与项目指令，确认幂等键的既有约定。',
    text: '我先读取现有实现与项目指令，确认幂等键的既有约定，再给出改动方案。\n\n关键约束：\n- 不改公开 API 签名 → 只能在校验层与持久层做文章\n- 同 key 只生效一次 → 需要**唯一约束**兜底，不能只靠应用层判断\n- 重试必须幂等 → 重试前要能区分「已成功但响应丢失」与「未执行」',
  });
  push({
    turnNo: 1, type: 'tool_call', actor: 'agent', at: r.agoHours(3),
    tool: { callId: 'TC-8f21', name: 'kb_search', summary: '检索「幂等键 设计约定」', args: { query: '幂等键 设计约定', scopes: ['repo', 'wiki'] }, risk: 'R0', status: 'completed', durationMs: 41, resultSummary: '命中 3 条：项目知识页「支付链路幂等设计」、记忆「idempotencyKey 由调用方生成」、ADR-014', cacheHit: true },
  });
  push({
    turnNo: 1, type: 'tool_call', actor: 'agent', at: r.agoHours(3),
    tool: {
      callId: 'TC-8f22', name: 'read_file', summary: '读取 PaymentServiceImpl.java', args: { path: 'src/main/java/com/acme/payment/PaymentServiceImpl.java', range: 'L1-L220' },
      risk: 'R0', status: 'completed', durationMs: 12, resultSummary: '220 行；handleRetry() 当前无幂等校验；存在 TODO 标记', externalized: true, artifactRef: 'artifact://tool-call/TC-8f22#section=file',
    },
  });
  push({
    turnNo: 1, type: 'plan', actor: 'agent', at: r.agoHours(3),
    plan: {
      steps: [
        { text: '定位幂等键生成与校验位置（read_file / grep_search）', status: 'done' },
        { text: '在持久层加唯一约束 + 应用层捕获冲突返回首次结果', status: 'doing' },
        { text: '实现指数退避重试（1s/2s/4s，最多 3 次，仅对可重试错误）', status: 'todo' },
        { text: '补单测：并发重复提交、重试幂等、退避间隔断言', status: 'todo' },
        { text: '运行 payment-core 单测与构建（L2 证据）', status: 'todo' },
      ],
      changeReason: '原计划包含「改公开签名」，与用户约束冲突，已改为内部重载。',
    },
  });
  push({
    turnNo: 1, type: 'tool_call', actor: 'agent', at: r.agoHours(2),
    tool: {
      callId: 'TC-8f23', name: 'edit_file', summary: '编辑 PaymentServiceImpl（+38 −12）',
      args: { path: 'src/main/java/com/acme/payment/PaymentServiceImpl.java', patch: '@@ -88,12 +88,38 @@ handleRetry(...)' },
      risk: 'R1', status: 'completed', durationMs: 63, resultSummary: '写入 38 行、删除 12 行；原子替换成功；新校验和 7f4c…',
    },
  });
  push({
    turnNo: 1, type: 'approval', actor: 'agent', at: r.agoHours(2),
    approval: {
      approvalId: 'AR-4f21',
      riskLevel: 'R2',
      actionSummary: 'run_command: mvn -pl payment-core test -Dtest=IdempotencyGuardTest',
      preview: 'mvn -pl payment-core test -Dtest=IdempotencyGuardTest\n  -DfailIfNoTests=false\n# 沙箱档 L0+ · 资源上限 cpu 2 / mem 2GiB / 超时 300s',
      previewKind: 'command',
      targetResource: 'workspace local:/worktrees/payment-core/T-7f3a',
      scopeOptions: ['once', 'session', 'project', 'workspace', 'pattern', 'dir'],
      expiresAt: r.future(4),
      timeoutAction: 'deny',
      actionDigest: 'd41f8e0c',
      decision: null,
    },
  });
  push({
    turnNo: 1, type: 'notice', actor: 'system', at: r.agoHours(2),
    notice: { level: 'info', text: '上下文接近上限（91%），已压缩历史（L2 区段摘要，保留约束与未决项）。查看压缩详情。' },
  });
  push({
    turnNo: 1, type: 'subagent', actor: 'subagent', at: r.agoHours(2),
    subagent: {
      agent: 'tester',
      brief: '目标：为幂等重试补齐单测。验收：并发重复提交只生效一次；重试退避间隔符合 1s/2s/4s；不得修改既有测试期望。约束：只允许写 src/test/**。工具：read_file / write_file / run_tests。',
      tools: ['read_file', 'write_file', 'run_tests'],
      budget: 'tokens ≤ 200k · 成本 ≤ $0.80 · 工具调用 ≤ 40',
      result: '新增 IdempotencyGuardTest 12 例，全部通过；发现 1 处边界（时钟回拨）已上报父会话。',
      depth: 1,
    },
  });
  push({
    turnNo: 1, type: 'tool_call', actor: 'agent', at: r.agoHours(1),
    tool: {
      callId: 'TC-8f24', name: 'run_command', summary: 'mvn -pl payment-core test',
      args: { command: 'mvn -pl payment-core test', cwd: 'payment-core', timeoutMs: 300_000 },
      risk: 'R2', status: 'completed', durationMs: 48_120, resultSummary: 'BUILD SUCCESS · 128 tests passed · 0 failed · 退出码 0', externalized: true, artifactRef: 'artifact://tool-call/TC-8f24#section=output',
    },
  });
  push({
    turnNo: 1, type: 'checkpoint', actor: 'system', at: r.agoHours(1),
    checkpoint: { checkpointId: 'ckp_7f31', stepNo: 4, sideEffects: 2, note: '已提交写入 2 个文件；副作用账本已登记，重放将跳过。' },
  });
  push({
    turnNo: 1, type: 'assistant_message', actor: 'agent', at: r.ago(42),
    text: '改动已完成并通过 L1/L2 验证：\n\n| 项 | 结果 |\n| --- | --- |\n| 幂等保证 | 持久层唯一约束 + 冲突时回读首次结果 |\n| 重试策略 | 指数退避 1s/2s/4s，仅对可重试错误 |\n| 单测 | 新增 12 例，128 passed |\n| 公开 API | 未变更（内部重载） |\n\n**未验证项**：移动端并发场景未覆盖（缺少真机环境）。请确认是否提交 PR。',
  });
  push({
    turnNo: 1, type: 'notice', actor: 'system', at: r.ago(30),
    notice: { level: 'warn', text: '沙箱档位从 L1 降级为 L0+（容器运行时不可用）。网络与路径限制仍然生效。', traceId: 'trace-9f21ab77' },
  });
  push({
    turnNo: 1, type: 'ask', actor: 'agent', at: r.ago(24),
    ask: {
      question: '幂等重试的范围要覆盖到哪一层？（涉及改动范围与验收方式，需要你的决定）',
      multiple: false,
      options: [
        { value: 'api', label: '仅支付回执接口', hint: '改动最小，验收：回执接口并发重复提交只生效一次' },
        { value: 'api-callback', label: '回执接口 + 回调消费', hint: '覆盖重复回调；需额外确认回调侧的既有约定' },
        { value: 'all-write', label: '所有写接口统一幂等层', hint: '改动最大，收益最广；建议单独立项避免与本次改动耦合' },
      ],
      allowFreeText: true,
      blocking: '未回答前不会继续修改代码；已完成的只读检索与计划不受影响。',
      expiresInMs: 30 * 60 * 1000,
    },
  });

  const contextSections: ContextSectionData[] = [
    { code: 'S1', name: '组织策略区', budget: 10_000, tokens: 8_400, eviction: '不可驱逐', compression: '无', cache: '稳定前缀', desc: '企业基线、合规约束、DLP 规则', sources: ['org-policy@v12', 'dlp-rules@v3'] },
    { code: 'S2', name: '模式与角色提示区', budget: 20_000, tokens: 17_200, eviction: '不可驱逐', compression: '资产版本化', cache: '稳定前缀', desc: '模式（编码）+ 角色 + 护栏层', sources: ['mode.coding@v7', 'role.senior-dev@v4', 'guardrail.builtin@v1'] },
    { code: 'S3', name: '项目指令区', budget: 20_000, tokens: 14_900, eviction: '低', compression: '目录级裁剪', cache: '较稳定', desc: 'AGENTS.md / .qoder/rules 分层装载', sources: ['AGENTS.md', '.oc/rules/code-review-protocol.md', 'docs/harness/05-tool-system.md'] },
    { code: 'S4', name: '记忆区', budget: 10_000, tokens: 4_100, eviction: '中', compression: '按相关度截断', cache: '半动态', desc: '四层记忆召回结果（带来源与置信）', sources: ['memory:project/commit-lang', 'memory:project/payment-idempotency'] },
    { code: 'S5', name: '知识检索区', budget: 20_000, tokens: 12_600, eviction: '中', compression: '引用化', cache: '动态尾部', desc: '三路召回 + 重排（带引用标注）', sources: ['kb://payment-idempotency#chunk=4', 'repo://payment-core/.../PaymentServiceImpl.java#L88-L126'] },
    { code: 'S6', name: '计划与任务状态区', budget: 10_000, tokens: 5_300, eviction: '不可驱逐', compression: '结构化不摘要', cache: '动态', desc: 'WorkItem 树 + 验收清单（结构化保留）', sources: ['workitem:T-7f3a', 'acceptance:T-7f3a'] },
    { code: 'S7', name: '对话历史区', budget: 60_000, tokens: 51_800, eviction: '高', compression: '多级压缩主体', cache: '动态', desc: '本会话历史（已 L2 摘要）', sources: ['session:S-4001/turn=1'] },
    { code: 'S8', name: '工具结果区', budget: 40_000, tokens: 21_400, eviction: '高', compression: '外置引用 + 摘要', cache: '动态', desc: '>4k token 结果已外置为 ref', sources: ['artifact://tool-call/TC-8f22', 'artifact://tool-call/TC-8f24'] },
    { code: 'S9', name: '当前指令区', budget: 10_000, tokens: 2_700, eviction: '不可驱逐', compression: '无', cache: '尾部', desc: '当前用户意图与最新插话', sources: ['input:S-4001/turn=2'] },
  ];

  const cost = {
    total: 2.8413,
    inputTokens: 486_200,
    outputTokens: 61_400,
    cacheReadTokens: 312_800,
    cacheWriteTokens: 44_100,
    reasoningTokens: 9_800,
    ttfbMs: 812,
    totalMs: 486_000,
    budget: 5,
    byModelSeries: [
      { name: 'claude-sonnet-4.5', points: [0.18, 0.62, 1.14, 1.42, 1.71, 2.12, 2.42].map((y, i) => ({ x: `T${i + 1}`, y })) },
      { name: 'gpt-5.1（子 Agent）', points: [0, 0.04, 0.09, 0.12, 0.16, 0.21, 0.28].map((y, i) => ({ x: `T${i + 1}`, y })) },
      { name: 'text-embedding-3-large', points: [0.01, 0.02, 0.03, 0.03, 0.04, 0.06, 0.14].map((y, i) => ({ x: `T${i + 1}`, y })) },
    ],
    byTool: [
      { name: 'run_command', value: 0.42 },
      { name: 'read_file', value: 0.18 },
      { name: 'kb_search', value: 0.09 },
      { name: 'edit_file', value: 0.31 },
      { name: 'delegate_subagent', value: 0.28 },
      { name: 'embedding', value: 0.14 },
    ],
  };

  const grantMemories = [
    { id: 'GM-01', scope: 'session', scopeText: '本会话', tool: 'run_command', pattern: 'mvn * test*', createdAt: r.agoHours(2), source: 'AR-4f21', expiresAt: null },
    { id: 'GM-02', scope: 'project', scopeText: '本项目', tool: 'edit_file', pattern: 'src/**/*.java', createdAt: r.agoDays(2), source: 'AR-3a02', expiresAt: r.future(60 * 24 * 30) },
    { id: 'GM-03', scope: 'dir', scopeText: '按目录', tool: 'write_file', pattern: 'src/test/**', createdAt: r.agoDays(1), source: 'AR-3b11', expiresAt: null },
    { id: 'GM-04', scope: 'workspace', scopeText: '本工作区', tool: 'run_command', pattern: 'git status', createdAt: r.agoDays(4), source: 'AR-2c77', expiresAt: null },
    { id: 'GM-05', scope: 'pattern', scopeText: '按模式', tool: 'web_fetch', pattern: 'https://docs.internal/**', createdAt: r.agoDays(6), source: 'AR-1902', expiresAt: r.future(60 * 24 * 14) },
  ];

  const safePoints = [
    { stepId: 'step-4', at: r.agoHours(1), affected: ['local:/worktrees/payment-core/T-7f3a'], sideEffects: '2 个文件写入已登记，重放将跳过' },
    { stepId: 'step-3', at: r.agoHours(2), affected: ['local:/worktrees/payment-core/T-7f3a', 'local:/worktrees/payment-core/T-7f3a/src/test'], sideEffects: '1 个文件写入 + 1 次测试执行' },
    { stepId: 'step-2', at: r.agoHours(3), affected: [], sideEffects: '无副作用（只读检索）' },
  ];

  const attachments: SessionData['attachments'] = [
    { id: 'att-1', name: '回执幂等时序图.png', kind: 'image', size: '318 KB', ref: 'media://sha256:9f21c0…' },
    { id: 'att-2', name: 'payment-api-spec.pdf', kind: 'pdf', size: '1.2 MB', ref: 'media://sha256:41ab77…' },
    { id: 'att-3', name: '压测结果.xlsx', kind: 'sheet', size: '88 KB', ref: 'media://sha256:77d0e1…' },
    { id: 'att-4', name: '需求评述.m4a', kind: 'audio', size: '2.4 MB', ref: 'media://sha256:2b9c14…' },
  ];

  const turnPhases: { phase: TurnPhase; at: string; note: string }[] = [
    { phase: 'PARSE', at: r.agoHours(3), note: '解析用户意图：幂等 + 重试 + 单测，约束「不改公开签名」' },
    { phase: 'ASSESS', at: r.agoHours(3), note: '复杂度：跨模块=false，不可逆=false，验收清晰=true → 轻计划策略' },
    { phase: 'PLAN', at: r.agoHours(3), note: '生成 5 步计划；1 步因约束冲突被替换' },
    { phase: 'EXECUTE', at: r.agoHours(3), note: '执行 6 次工具调用 + 1 次子 Agent 派生' },
    { phase: 'REFLECT', at: r.agoHours(1), note: '第 1 次反思：测试覆盖不足 → 派生 tester 子 Agent' },
    { phase: 'VERIFY', at: r.ago(50), note: '三级验证：L1/L2 通过；L3 有 1 项未验证' },
    { phase: 'WRAP', at: r.ago(20), note: '等待用户确认提交 PR' },
  ];

  const trajectory = [
    { seq: 18224, type: 'kb_search', summary: '检索幂等设计约定，命中 3 条（含项目知识页）' },
    { seq: 18231, type: 'read_file', summary: '读取 PaymentServiceImpl，识别 handleRetry 无幂等校验' },
    { seq: 18240, type: 'edit_file', summary: '持久层唯一约束 + 冲突回读首次结果' },
    { seq: 18248, type: 'delegate_subagent', summary: '派生 tester：补齐 12 例单测' },
    { seq: 18256, type: 'run_tests', summary: '128 passed；未验证项：移动端并发' },
  ];

  // 其余会话各自持有独立条目流：标题即用户意图，附一次只读工具调用与阶段答复；
  // 待审批会话补一张审批卡，保证列表徽标与条目流一致（会话隔离，不共享同一份 items）。
  const itemsBySession: Record<string, SessionItem[]> = { [sessions[0].id]: items };
  sessions.slice(1).forEach((sess, idx) => {
    let sseq = sess.lastEventSeq - 8;
    const mk = (it: Omit<SessionItem, 'itemId' | 'seq'>): SessionItem => {
      sseq += 1;
      return { ...it, itemId: `it_${sess.shortId}_${sseq.toString(36)}`, seq: sseq };
    };
    const turn: SessionItem[] = [
      mk({ turnNo: 1, type: 'user_message', actor: 'user', at: sess.createdAt, text: sess.title }),
      mk({
        turnNo: 1, type: 'tool_call', actor: 'agent', at: sess.createdAt,
        tool: {
          callId: `TC-${(0xa00 + idx).toString(16)}`, name: 'read_file',
          summary: `读取 ${sess.repo} 关键实现`, args: { path: `src/main/${sess.repo}/…`, range: 'L1-L120' },
          risk: 'R0', status: 'completed', durationMs: 18 + idx, cacheHit: idx % 2 === 0,
        },
      }),
      mk({
        turnNo: 1, type: 'assistant_message', actor: 'agent', at: sess.updatedAt,
        text: `进度：${sess.title}\n\n- 已完成：定位相关实现与约束（${sess.repo} · ${sess.branch}）\n- 待办：按计划推进改动并补测试\n- 未决：涉及写与执行的动作将按风险级请求审批`,
      }),
    ];
    if (sess.pendingApprovals > 0) {
      turn.push(mk({
        turnNo: 1, type: 'approval', actor: 'agent', at: sess.updatedAt,
        approval: {
          approvalId: `AR-4f${(0x21 + idx).toString(16)}`, riskLevel: 'R1',
          actionSummary: `edit_file: ${sess.repo}/…（等待授权）`,
          preview: `edit_file ${sess.repo}/src/main/…\n+ // 受控写入，等待授权范围确认`,
          previewKind: 'diff', targetResource: `workspace local:/worktrees/${sess.repo}`,
          scopeOptions: ['once', 'session', 'project'], expiresAt: r.future(6),
          timeoutAction: 'deny', actionDigest: 'b7c1a2e9', decision: null,
        },
      }));
    }
    itemsBySession[sess.id] = turn;
  });

  return { sessions, items, itemsBySession, contextSections, compactionHistory: [
    { level: 'L1', before: 62_400, after: 41_200, reason: '工具结果外置（7 个 >4k token 的结果转为引用）', at: r.agoHours(2), reverted: false },
    { level: 'L2', before: 41_200, after: 26_800, reason: '对话历史分段摘要（保留决策与未决项，用户约束永不压缩）', at: r.agoHours(2), reverted: false },
    { level: 'L4', before: 26_800, after: 9_400, reason: '折叠为检查点 ckp_7f31（结构化进度 + 关键证据引用）', at: r.agoHours(1), reverted: false },
  ], sessionCost: cost, grantMemories, safePoints, attachments, turnPhases, trajectory };
}
