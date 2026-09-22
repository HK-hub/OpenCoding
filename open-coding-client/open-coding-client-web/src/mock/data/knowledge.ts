/**
 * 记忆 / 知识库 / Agent 内核 三域 mock 数据（卷 10 / 卷 11 / 卷 12 + impl/30）。
 * 三域概念互相独立但界面强关联：记忆 = 跨会话可复用结论；知识 = 外部文档与代码索引；内核 = 单会话内的智能行为组织。
 * 交互引用关系：记忆条目 ↔ 召回调试/冲突/文件同步；知识源 ↔ 索引任务/检索/引用；子 Agent ↔ 扇出/验证/循环防护。
 */
import { Rng, REPOS } from '../rng';

/* ============================ 记忆系统（卷 10） ============================ */

export type MemoryScope = 'work' | 'session' | 'project' | 'org';
export type MemoryStatus = 'active' | 'superseded' | 'archived' | 'deleted';
export type MemoryConfidence = '高' | '中' | '低';
export type MemorySensitivity = '公开' | '内部' | '敏感';

/** 记忆条目四层模型（卷 10 §4.1） */
export type MemoryEntry = {
  memoryId: string;
  scope: MemoryScope;
  key: string;
  value: string;
  tags: string[];
  paths: string[];
  confidence: MemoryConfidence;
  source: { type: '会话' | '任务' | '工具' | '导入'; ref: string };
  /** TTL 语义：'永久' / 具体到期时间 / '任务结束释放' */
  ttl: string;
  reviewAt: string;
  status: MemoryStatus;
  supersedes?: string;
  supersededBy?: string;
  sensitivity: MemorySensitivity;
  author: string;
  reason: string;
  affectedScope: string;
};

/** 记忆写入候选（卷 10 §4.2：候选 → 过滤 → 确认/自动 → 落库，可撤销） */
export type MemoryProposal = {
  proposalId: string;
  key: string;
  value: string;
  scope: MemoryScope;
  reason: string;
  impact: string;
  state: 'pending' | 'accepted' | 'rejected';
  how: 'auto' | 'confirm';
  author: string;
  at: string;
  /** 撤销窗口内可撤回（产品铁律：写入必须可撤销） */
  revocable: boolean;
};

/** 召回调试（卷 10 §4.3 召回管线） */
export type RecallDebugQuery = {
  query: string;
  at: string;
  sessionRef: string;
  hits: { memoryId: string; score: number; used: boolean; sourceType: '规则' | '全文' | '向量' | '重排' }[];
  latencyBreakdown: { ruleMs: number; fulltextMs: number; vectorMs: number; rerankMs: number };
  budgetTrimmed: { trimmed: number; budgetTokens: number; usedTokens: number };
};

/** 冲突检测（卷 10 D-MEM-5） */
export type MemoryConflict = {
  conflictId: string;
  kind: 'sameKeyDifferentValue' | 'semanticContradiction';
  a: string;
  b: string;
  severity: '高' | '中' | '低';
  resolution: string;
  detectedAt: string;
};

/** 项目/组织记忆文件化（卷 10 §4.4：文件为源，DB 为索引） */
export type MemoryFile = {
  path: string;
  yamlHeader: string;
  content: string;
  drift: boolean;
  entryCount: number;
  lastSyncedAt: string;
  indexState: 'in_sync' | 'drift' | 'pending';
  sourceOfTruth: 'file';
};

/** 遗忘与删除（卷 10 §4.5） */
export type MemoryDeletion = {
  deletionId: string;
  level: 'ttl' | 'soft' | 'compliance';
  scope: MemoryScope;
  target: string;
  state: 'DONE' | 'RUNNING';
  exported: boolean;
  proof: { at: string; range: string; executor: string; layers: { name: string; done: boolean }[] };
};

/** 组织记忆治理（卷 10 D-MEM-8） */
export type OrgMemoryGovernance = {
  governanceId: string;
  proposal: string;
  reviewer: string;
  rationale: string;
  impact: string;
  state: '评审中' | '已发布' | '已驳回' | '已回滚';
  version: string;
  at: string;
};

/** 隐私与脱敏（卷 10 D-MEM-7） */
export type MemoryPrivacy = {
  piiTypes: { type: '手机号' | '邮箱' | '证件' | '密钥'; enabled: boolean; action: '脱敏' | '拒绝写入' }[];
  policy: string;
  encrypted: boolean;
  auditLog: { at: string; actor: string; target: string; action: string; result: '允许' | '脱敏返回' | '拒绝' }[];
};

/** 记忆质量评测（卷 10 D-MEM-10） */
export type MemoryQuality = {
  hitRate: number;
  misuseRate: number;
  expiredRate: number;
  conflictRate: number;
  history: { week: string; hitRate: number; misuseRate: number }[];
  corrections: { at: string; memoryId: string; by: string; text: string; feedback: boolean }[];
};

/* ============================ 知识库（卷 11） ============================ */

export type KnowledgeSourceType =
  | '本地' | '仓库' | '工单' | '聊天' | '网页' | '对象存储' | 'DB Schema' | 'API 文档';

export type KnowledgeSource = {
  sourceId: string;
  name: string;
  type: KnowledgeSourceType;
  credentialRef: string;
  syncMode: 'incremental' | 'full';
  lastSyncAt: string;
  syncStatus: 'synced' | 'syncing' | 'degraded' | 'failed' | 'paused';
  chunkCount: number;
  lagSeconds: number;
  logs: { at: string; level: 'ok' | 'warn' | 'error'; text: string }[];
};

export type KnowledgeChunk = {
  chunkId: string;
  sourceId: string;
  docPath: string;
  strategy: 'AST' | '标题层级' | '表格整块' | '会话窗口' | '语义';
  tokens: number;
  symbols: { name: string; kind: '类' | '接口' | '方法' | '函数' | '常量' | '枚举' }[];
};

export type IndexJob = {
  jobId: string;
  target: string;
  mode: 'incremental' | 'rebuild';
  progress: number;
  chunksTotal: number;
  durationMs: number;
  failedReason: string;
  resumable: boolean;
  commitHash: string;
  state: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'QUEUED';
};

export type SearchResult = {
  resultId: string;
  title: string;
  snippet: string;
  score: number;
  rerankScore: number;
  citation: string;
  citationKind: 'repo' | 'doc' | 'url' | 'ticket' | 'wiki';
  permissionTags: { tenant: string; project: string; visibility: '公开' | '项目' | '内部' | '受限'; acl: string };
  stale: boolean;
  lastVerifiedAt: string;
};

/** 检索轨迹（卷 11 §4.2 延迟预算 + D-KB-7 前置过滤） */
export type QueryTrace = {
  query: string;
  rewrite: string;
  filters: string[];
  paths: { name: '全文' | '向量' | '符号'; used: boolean; degraded: boolean; note: string }[];
  latencyMs: { understand: number; recall: number; fusion: number; filter: number };
  /** 前置权限过滤掉的结果数（绝不返回越权内容，只回报数量） */
  permissionFiltered: number;
  noEvidence: boolean;
};

export type WikiPage = {
  pageId: string;
  title: string;
  repo: string;
  version: string;
  sections: { name: string; content: string; sources: string[]; pendingConfirm: boolean }[];
  generatedAt: string;
  sourcedFrom: string[];
  pendingConfirm: string[];
  editedByHuman: boolean;
};

export type StaleFinding = {
  findingId: string;
  kind: '引用失效' | '版本落后' | '长期未访问' | '被新版本取代';
  target: string;
  suggestion: string;
  weight: number;
  detectedAt: string;
};

export type KnowledgeGovernance = {
  contributions: { contributor: string; source: string; usageCount: number; acceptanceRate: number }[];
  feedbackQueue: { id: string; target: string; kind: string; reporter: string; at: string; state: '待处理' | '修复中' | '已回写' }[];
};

/* ============================ Agent 内核（卷 12） ============================ */

export type AgentDefinition = {
  name: string;
  description: string;
  promptRole: string;
  tools: { allow: string[]; deny: string[] };
  permissions: { mode: string; ceiling: string };
  delegation: { enabled: boolean; maxDepth: number; maxNodes: number };
  budget: { default: string };
  scope: 'builtin' | 'org' | 'project' | 'user';
  handoff: string;
  /** 权限收窄校验（子 Agent 权限只减不增） */
  narrowing: { ok: boolean; note: string };
};

export type SubAgent = {
  agentId: string;
  name: string;
  parentItemId: string;
  depth: number;
  status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'paused';
  brief: { goal: string; acceptance: string[]; known: string[]; constraints: string[]; refs: string[]; banned: string[] };
  tools: string[];
  budget: { tokenLimit: number; usedTokens: number; stepLimit: number; usedSteps: number; timeLimitMin: number };
  isolation: string;
  returnContract: {
    conclusion: string;
    evidence: string[];
    artifacts: string[];
    openQuestions: string[];
    confidence: MemoryConfidence;
    usage: { tokens: number; cost: number; durationMs: number };
  } | null;
};

export type Fanout = {
  batchId: string;
  goal: string;
  subtasks: { taskId: string; title: string; agent: string; budgetTokens: number; files: string[]; status: string }[];
  conflicts: { file: string; agents: string[] }[];
  merged: boolean;
  dedupedCount: number;
  budgetAllocation: { total: number; allocated: number; reserved: number };
};

export type Verification = {
  level: 'L1 静态' | 'L2 可执行' | 'L3 语义';
  items: { name: string; ok: boolean; evidence: string }[];
};

export type LoopGuard = {
  limits: { steps: number; durationMs: number; cost: number };
  used: { steps: number; durationMs: number; cost: number };
  progress: number;
  repeatedActions: { tool: string; args: string; count: number }[];
  driftScore: number;
  outOfBoundsSummary: { what: string; blockedAt: string; nextStep: string };
};

export type Checkpoint = {
  checkpointId: string;
  stepNo: number;
  at: string;
  sideEffects: number;
  note: string;
  restorable: boolean;
};

export type TrajectoryItem = {
  seq: number;
  phase: '解析' | '评估' | '规划' | '执行' | '反思' | '验证' | '收尾';
  at: string;
  summary: string;
  evidence: string;
};

export type KnowledgeData = {
  memory: {
    entries: MemoryEntry[];
    proposals: MemoryProposal[];
    recallDebug: RecallDebugQuery[];
    conflicts: MemoryConflict[];
    files: MemoryFile[];
    deletions: MemoryDeletion[];
    orgGovernance: OrgMemoryGovernance[];
    privacy: MemoryPrivacy;
    qualityMetrics: MemoryQuality;
  };
  knowledge: {
    sources: KnowledgeSource[];
    chunks: KnowledgeChunk[];
    indexJobs: IndexJob[];
    searchResults: SearchResult[];
    queryTrace: QueryTrace;
    wikiPages: WikiPage[];
    staleFindings: StaleFinding[];
    governance: KnowledgeGovernance;
  };
  agent: {
    definitions: AgentDefinition[];
    subagents: SubAgent[];
    fanout: Fanout[];
    verification: Verification[];
    guard: LoopGuard;
    checkpoints: Checkpoint[];
    trajectory: TrajectoryItem[];
  };
};

/** 记忆层级中文标签（界面与日志统一口径） */
export const MEMORY_SCOPE_LABEL: Record<MemoryScope, string> = {
  work: '工作记忆',
  session: '会话记忆',
  project: '项目记忆',
  org: '组织记忆',
};

/** 知识源八类连接器 */
export const KNOWLEDGE_SOURCE_TYPES: KnowledgeSourceType[] = [
  '本地', '仓库', '工单', '聊天', '网页', '对象存储', 'DB Schema', 'API 文档',
];

const WIKI_SECTION_NAMES = ['架构概览', '模块地图', '依赖关系', '关键流程', '术语表', '常见变更点', '测试与构建'];

/** 项目知识页七段内容：按仓库名生成，结论可溯源，无法溯源的段落标注「待确认」 */
function buildWikiSections(r: Rng, repo: string, idx: number) {
  const moduleA = r.pick(['gateway', 'domain', 'application', 'interfaces', 'infrastructure']);
  const moduleB = r.pick(['common', 'core-api', 'core-model', 'core-agent', 'core-tool']);
  const text: Record<string, string> = {
    架构概览: `${repo} 为分层单体：interfaces 只做协议适配，application 编排用例，domain 持有实体与迁移脚本，core 系列零 Spring 依赖。`,
    模块地图: `核心模块：${moduleA}（入口与编排）、${moduleB}（纯契约与实现）、mapper 层（MyBatis-Plus）。模块边界以包路径约束。`,
    依赖关系: `依赖方向单向：common ← core-api ← core-* ；domain → application → interfaces → bootstrap。检测到 0 处反向依赖。`,
    关键流程: `主链路：请求进入 interfaces → application 用例 → domain 仓储 → core-agent 循环（规划/执行/验证）→ 事件写回。`,
    术语表: 'Thread=会话主线；Turn=一次用户意图周期；Item=原子输入输出；记忆≠知识；权限≠自主度。',
    常见变更点: `高频改动文件：${repo}/src/main/java/**/Service.java、resources/application.yml；迁移脚本变更需双人评审。`,
    测试与构建: '构建：mvn clean install；单测离线可跑；main 链路跑 mvn -pl open-coding-bootstrap -am test。',
  };
  return WIKI_SECTION_NAMES.map((name, i) => ({
    name,
    content: text[name],
    sources:
      name === '架构概览'
        ? [`repo://${repo}/README.md#L1-L40@a91f3c2`, `repo://${repo}/src/main/java@a91f3c2`]
        : [`repo://${repo}/src/main/java#symbol=${moduleA}@a91f3c2`, `wiki://page-${idx}-${i}@v${idx + 1}`],
    pendingConfirm: (idx === 2 && name === '关键流程') || (idx === 5 && name === '测试与构建'),
  }));
}

/** 构建三域 mock 数据（确定性：仅使用 r.* 与固定字面量） */
export function buildKnowledgeData(r: Rng): KnowledgeData {
  /* ---------- 记忆：四层条目 ---------- */
  const entries: MemoryEntry[] = [
    {
      memoryId: 'mem-w-01', scope: 'work', key: 'assumption:payment-idempotent',
      value: '假设 payment-core 下单接口已具备幂等键，待用 checkIdempotentKey 用例验证。',
      tags: ['支付', '假设', '待验证'], paths: ['src/main/java/com/hk/payment/PaymentService.java'],
      confidence: '低', source: { type: '任务', ref: 'task-8f21' }, ttl: '任务结束释放', reviewAt: '本任务收尾时复审',
      status: 'active', sensitivity: '内部', author: 'Agent（推断）', reason: '分析下单链路时提出，尚未被任何测试或文档证实。',
      affectedScope: '仅当前任务黑板，不注入其他会话',
    },
    {
      memoryId: 'mem-w-02', scope: 'work', key: 'todo:verify-migration-v0007',
      value: '待验证 V0007 迁移脚本在空库与样本库均可重放，且回退脚本有效。',
      tags: ['迁移', '待办'], paths: ['src/main/resources/db/migration/V0007__add_oc_memory.sql'],
      confidence: '中', source: { type: '工具', ref: 'tool-call-4b09' }, ttl: '任务结束释放', reviewAt: '迁移验证后关闭',
      status: 'active', sensitivity: '内部', author: 'Agent', reason: '迁移演练仅覆盖样本库，空库路径缺失证据。',
      affectedScope: '当前任务与迁移子系统',
    },
    {
      memoryId: 'mem-w-03', scope: 'work', key: 'conclusion:adapter-registry-shape',
      value: '结论：四协议适配器注册表以 Map<protocol, ModelAdapter> 暴露，禁止在调用点 switch 协议。',
      tags: ['架构', '模型适配'], paths: ['src/main/java/com/hk/opencoding/core/model/ModelAdapterRegistry.java'],
      confidence: '中', source: { type: '会话', ref: 'sess-2f81' }, ttl: '任务结束释放', reviewAt: '本任务收尾时复审',
      status: 'superseded', supersededBy: 'mem-p-04', sensitivity: '内部', author: 'Agent',
      reason: '会话内临时结论，已被项目层架构约定取代。', affectedScope: '模型适配子系统',
    },
    {
      memoryId: 'mem-w-04', scope: 'work', key: 'risky:inmemory-store-lock',
      value: '内存 store 用 ReentrantLock 保护，仅在单实例部署假设下成立；多实例需换 Redis 实现。',
      tags: ['风险', '并发'], paths: ['src/main/java/com/hk/opencoding/core/implementation/store/InMemoryStore.java'],
      confidence: '中', source: { type: '任务', ref: 'task-8f21' }, ttl: '任务结束释放', reviewAt: '任务归档前复审',
      status: 'archived', sensitivity: '内部', author: 'Agent', reason: '任务结束，风险项已转任务 J-2291 跟踪。',
      affectedScope: '部署形态相关',
    },
    {
      memoryId: 'mem-s-01', scope: 'session', key: 'pref:commit-style',
      value: '用户偏好小步提交：每个逻辑变更独立 commit，提交信息用 Conventional Commits + 中文描述。',
      tags: ['偏好', 'git'], paths: ['.gitmessage', 'AGENTS.md'],
      confidence: '高', source: { type: '会话', ref: 'sess-2f81#turn-4' }, ttl: '会话存活期', reviewAt: '会话归档时',
      status: 'active', sensitivity: '内部', author: '沈亦舟（确认）', reason: '用户在会话中显式要求，并两次纠正 Agent 的批量提交。',
      affectedScope: '本会话全部写操作',
    },
    {
      memoryId: 'mem-s-02', scope: 'session', key: 'constraint:no-force-push',
      value: '本会话内禁止 push --force 与 reset --hard（用户显式约束）。',
      tags: ['约束', '风险'], paths: [],
      confidence: '高', source: { type: '会话', ref: 'sess-2f81#turn-6' }, ttl: '会话存活期', reviewAt: '会话归档时',
      status: 'active', sensitivity: '内部', author: '沈亦舟（确认）', reason: '用户明确拒绝破坏性 git 操作。',
      affectedScope: '本会话工具调用前置校验',
    },
    {
      memoryId: 'mem-s-03', scope: 'session', key: 'pref:test-first',
      value: '用户倾向先补回归测试再改实现，测试文件与实现同批提交。',
      tags: ['偏好', '测试'], paths: ['src/test/java'],
      confidence: '中', source: { type: '会话', ref: 'sess-1c07#turn-2' }, ttl: '会话存活期', reviewAt: '会话归档时',
      status: 'archived', sensitivity: '内部', author: 'Agent', reason: '会话已归档，条目转 archived（不再召回，仍可查）。',
      affectedScope: '原会话',
    },
    {
      memoryId: 'mem-s-04', scope: 'session', key: 'decision:no-fallback-chain',
      value: '决策：模型错误不做 fallback 链，统一按 ErrorCode.retryable 决定是否重试。',
      tags: ['决策', '模型'], paths: ['docs/design/core-api-contract-and-model-adapter.md'],
      confidence: '高', source: { type: '会话', ref: 'sess-2f81#turn-9' }, ttl: '会话存活期', reviewAt: '会话归档时',
      status: 'superseded', supersededBy: 'mem-p-06', sensitivity: '内部', author: '沈亦舟（确认）',
      reason: '结论已提升为项目级约定，会话层副本标记 superseded。', affectedScope: '模型调用与重试策略',
    },
    {
      memoryId: 'mem-s-05', scope: 'session', key: 'pref:single-commit-per-pr',
      value: '本会话用户倾向把改动压成单个提交，便于整体回滚。',
      tags: ['偏好', 'git'], paths: [],
      confidence: '低', source: { type: '会话', ref: 'sess-1c07#turn-7' }, ttl: '会话存活期', reviewAt: '冲突确认后',
      status: 'superseded', supersededBy: 'mem-s-01', sensitivity: '内部', author: 'Agent（推断）',
      reason: '与项目提交规范冲突，经用户确认后以 mem-s-01 为准。', affectedScope: '原会话',
    },
    {
      memoryId: 'mem-p-01', scope: 'project', key: 'rule:no-direct-prod-db',
      value: '禁止直接操作生产库；schema 变更一律走 Flyway 迁移脚本并经双人评审。',
      tags: ['合规', '数据库', '硬约束'], paths: ['src/main/resources/db/migration/'],
      confidence: '高', source: { type: '导入', ref: '.oc/memory/project-rules.md#L12' }, ttl: '永久', reviewAt: '2026-12-01',
      status: 'active', sensitivity: '敏感', author: '组织管理员（导入）', reason: '来自项目规则文件，附口述事故复盘依据。',
      affectedScope: '全项目写操作与工具前置校验',
    },
    {
      memoryId: 'mem-p-02', scope: 'project', key: 'convention:error-code-catalog',
      value: '新增错误码必须登记到 impl/00-contracts 错误码目录，并给出 retryable 标记与中文文案。',
      tags: ['约定', '错误码'], paths: ['docs/harness/impl/00-contracts/'],
      confidence: '高', source: { type: '导入', ref: '.oc/memory/api-conventions.md#L8' }, ttl: '永久', reviewAt: '2026-11-15',
      status: 'active', sensitivity: '内部', author: '沈亦舟', reason: '历史 review 中反复出现未登记错误码导致的联调阻塞。',
      affectedScope: '接口层与错误处理',
    },
    {
      memoryId: 'mem-p-03', scope: 'project', key: 'arch:core-no-spring',
      value: 'core 系列模块禁止依赖 Spring/domain/infrastructure（依赖方向铁律）。',
      tags: ['架构', '依赖'], paths: ['pom.xml', 'AGENTS.md'],
      confidence: '高', source: { type: '导入', ref: '.oc/memory/arch-decisions.md#L4' }, ttl: '永久', reviewAt: '2026-10-20',
      status: 'active', sensitivity: '公开', author: '架构评审 Agent', reason: '契约层要求零 Spring，便于 CLI 与测试复用。',
      affectedScope: '全部模块依赖声明',
    },
    {
      memoryId: 'mem-p-04', scope: 'project', key: 'arch:adapter-registry',
      value: '适配器注册表以 protocol→adapter 映射暴露，新增协议只注册不修改调用点。',
      tags: ['架构', '模型适配'], paths: ['src/main/java/com/hk/opencoding/core/model/ModelAdapterRegistry.java'],
      confidence: '高', source: { type: '任务', ref: 'task-8f21' }, ttl: '永久', reviewAt: '2026-11-01',
      status: 'active', supersedes: 'mem-w-03', sensitivity: '内部', author: '架构评审 Agent',
      reason: '会话结论升级为项目约定，含 SPI 覆盖需求。', affectedScope: '模型适配层',
    },
    {
      memoryId: 'mem-p-05', scope: 'project', key: 'perf:index-budget',
      value: '单仓首次索引预算 ≤ 10min；超限转后台重建并在 UI 显式标注滞后秒数。',
      tags: ['性能', '索引'], paths: ['docs/harness/11-knowledge-system.md'],
      confidence: '中', source: { type: '会话', ref: 'sess-3a55#turn-3' }, ttl: '2026-12-31', reviewAt: '2026-10-05',
      status: 'active', sensitivity: '内部', author: 'Agent', reason: '大仓首次索引实测 8.4min，预留余量后定为 10min。',
      affectedScope: '索引调度与 W-02 状态面板',
    },
    {
      memoryId: 'mem-p-06', scope: 'project', key: 'decision:no-fallback-chain',
      value: '模型错误不做 fallback 链；重试只认 ErrorCode.retryable，换路需显式声明。',
      tags: ['决策', '模型', '重试'], paths: ['docs/design/model-abstraction-layer.md'],
      confidence: '高', source: { type: '会话', ref: 'sess-2f81#turn-9' }, ttl: '永久', reviewAt: '2026-11-20',
      status: 'active', supersedes: 'mem-s-04', sensitivity: '内部', author: '沈亦舟（确认）',
      reason: '避免隐式换路掩盖真实错误，重试语义必须显式。', affectedScope: '模型网关与重试装饰器',
    },
    {
      memoryId: 'mem-p-07', scope: 'project', key: 'temp:hotfix-branch-name',
      value: '临时约定：本次热修分支命名 oc/hotfix-<date>，随后并入 release/2.9。',
      tags: ['临时', 'git'], paths: [],
      confidence: '低', source: { type: '会话', ref: 'sess-0b12#turn-1' }, ttl: '2026-09-30', reviewAt: '已过期',
      status: 'deleted', sensitivity: '内部', author: 'Agent', reason: '用户删除（软删）：临时约定已失效，索引已清理，不可召回。',
      affectedScope: '原会话',
    },
    {
      memoryId: 'mem-p-08', scope: 'project', key: 'perf:external-embedding-enabled',
      value: '允许把变更代码片段外发到外部嵌入服务，以提升检索召回质量。',
      tags: ['检索', '外发'], paths: ['docs/harness/11-knowledge-system.md'],
      confidence: '低', source: { type: '会话', ref: 'sess-3a55#turn-8' }, ttl: '2026-12-31', reviewAt: '冲突裁决后复审',
      status: 'active', sensitivity: '内部', author: 'Agent（推断）',
      reason: '为提高召回率提出，但与组织数据驻留策略语义矛盾，待组织评审裁决。', affectedScope: '嵌入与索引设置',
    },
    {
      memoryId: 'mem-p-09', scope: 'project', key: 'policy:hotfix-single-review',
      value: '生产热修允许单人评审，需在 24h 内补第二评审人签署。',
      tags: ['发布', '例外'], paths: ['.oc/memory/project-rules.md'],
      confidence: '中', source: { type: '导入', ref: '.oc/memory/project-rules.md#L31' }, ttl: '永久', reviewAt: '2026-11-08',
      status: 'active', sensitivity: '内部', author: '发布负责人', reason: '事故窗口期的例外通道，含补签时限。',
      affectedScope: '发布编排与审批链',
    },
    {
      memoryId: 'mem-p-10', scope: 'project', key: 'rule:no-direct-prod-db',
      value: '紧急情况下允许 DBA 直连生产库改数据，事后 24h 内补录操作记录。',
      tags: ['数据库', '例外'], paths: ['.oc/memory/project-rules.md'],
      confidence: '中', source: { type: '导入', ref: '.oc/memory/project-rules.md#L44' }, ttl: '永久', reviewAt: '未决：等待组织评审',
      status: 'active', sensitivity: '敏感', author: '运维代表', reason: '与 mem-p-01 同键不同值，已生成冲突记录 mem-cft-04。',
      affectedScope: '全项目生产库操作',
    },
    {
      memoryId: 'mem-o-01', scope: 'org', key: 'policy:release-dual-review',
      value: '发布必须走双人评审，且评审人不得为提交人；紧急通道需事后补签。',
      tags: ['组织规范', '评审'], paths: ['.oc/memory/org-policies.md#L6'],
      confidence: '高', source: { type: '导入', ref: 'org://policies/release-v3@v3' }, ttl: '永久', reviewAt: '2027-01-15',
      status: 'active', sensitivity: '公开', author: '组织管理员', reason: 'ISO 27001 变更管理要求，映射到发布编排门禁。',
      affectedScope: '全组织发布流程',
    },
    {
      memoryId: 'mem-o-02', scope: 'org', key: 'policy:model-call-audit',
      value: '所有模型调用必须留审计快照（脱敏正文 + 元数据），保留 90 天。',
      tags: ['组织规范', '审计'], paths: ['.oc/memory/org-policies.md#L18'],
      confidence: '高', source: { type: '导入', ref: 'org://policies/audit-v2@v2' }, ttl: '永久', reviewAt: '2026-12-10',
      status: 'active', sensitivity: '内部', author: '合规负责人', reason: '满足个保法最小留存与可追溯要求。',
      affectedScope: '模型网关审计与保留策略',
    },
    {
      memoryId: 'mem-o-03', scope: 'org', key: 'policy:secret-ref-only',
      value: '凭证只以引用方式出现；明文仅存密钥代理内存，禁止写入配置文件。',
      tags: ['组织规范', '密钥'], paths: ['.oc/memory/org-policies.md#L22'],
      confidence: '高', source: { type: '导入', ref: 'org://policies/secret-v1@v1' }, ttl: '永久', reviewAt: '已复审',
      status: 'superseded', supersededBy: 'mem-o-05', sensitivity: '敏感', author: '安全负责人',
      reason: 'v1 缺少短期令牌与脱敏细则，由 v2（mem-o-05）取代。', affectedScope: '全组织凭证处理',
    },
    {
      memoryId: 'mem-o-04', scope: 'org', key: 'convention:incident-severity',
      value: '事件分级 SEV1–SEV4 判定与四角色分工（指挥/沟通/取证/复盘）。',
      tags: ['组织规范', '事件响应'], paths: ['.oc/memory/org-policies.md#L30'],
      confidence: '中', source: { type: '导入', ref: 'org://runbook/incident-v1@v1' }, ttl: '永久', reviewAt: '2027-03-01',
      status: 'archived', sensitivity: '内部', author: 'SRE 负责人', reason: '已并入新版 Runbook，条目归档保留可查。',
      affectedScope: '全组织事件响应',
    },
    {
      memoryId: 'mem-o-05', scope: 'org', key: 'policy:secret-handling',
      value: '凭证引用 + 短期令牌注入；日志/导出/遥测强制脱敏，伪造环境变量仅存代理进程。',
      tags: ['组织规范', '密钥', '脱敏'], paths: ['.oc/memory/org-policies.md#L22'],
      confidence: '高', source: { type: '导入', ref: 'org://policies/secret-v2@v2' }, ttl: '永久', reviewAt: '2026-12-10',
      status: 'active', supersedes: 'mem-o-03', sensitivity: '敏感', author: '安全负责人',
      reason: 'v2 补充短期令牌与导出脱敏条款，评审通过并发布。', affectedScope: '全组织凭证与日志处理',
    },
    {
      memoryId: 'mem-o-06', scope: 'org', key: 'policy:data-residency',
      value: '境内租户数据不得外发到区域外推理端点；例外需登记白名单并逐次审批。',
      tags: ['组织规范', '驻留'], paths: ['.oc/memory/org-policies.md#L40'],
      confidence: '高', source: { type: '导入', ref: 'org://policies/residency-v2@v2' }, ttl: '永久', reviewAt: '2026-12-28',
      status: 'active', sensitivity: '内部', author: '合规负责人', reason: '数据出境合规要求，硬约束先于检索质量优化。',
      affectedScope: '模型路由、嵌入服务与知识外发开关',
    },
  ];

  /* ---------- 记忆：写入候选（候选 → 确认 / 自动，全部可撤销） ---------- */
  const proposals: MemoryProposal[] = [
    {
      proposalId: 'mpr-01', key: 'pref:changelog-format', value: '变更日志按「新增/修复/破坏性」三段书写，中文标题不超 40 字。', scope: 'project',
      reason: '连续 3 次提交说明格式不一致，用户手动重写。', impact: '影响提交信息与发布说明生成', state: 'pending', how: 'confirm',
      author: 'Agent', at: r.agoHours(2), revocable: true,
    },
    {
      proposalId: 'mpr-02', key: 'convention:vitest-over-jest', value: '前端单测统一用 Vitest，禁止引入 Jest 生态。', scope: 'project',
      reason: '检测到 package.json 已含 vite 生态，无 jest 依赖。', impact: '影响前端测试脚手架与 CI 脚本', state: 'accepted', how: 'auto',
      author: 'Agent', at: r.agoHours(26), revocable: true,
    },
    {
      proposalId: 'mpr-03', key: 'pref:always-squash', value: '合并前把分支压成单个提交。', scope: 'session',
      reason: '从会话行为推断（用户连续两次 amend）。', impact: '仅影响本会话提交策略', state: 'rejected', how: 'confirm',
      author: 'Agent（推断）', at: r.agoHours(30), revocable: false,
    },
    {
      proposalId: 'mpr-04', key: 'rule:sandbox-min-level', value: '不可信输入驱动的任务默认使用 L2 沙箱档，不得降档。', scope: 'project',
      reason: '安全演练发现 L1 档执行外部脚本无网络隔离。', impact: '影响工具执行沙箱路由与 B-03 计划预览', state: 'pending', how: 'confirm',
      author: '安全审查 Agent', at: r.agoHours(5), revocable: true,
    },
    {
      proposalId: 'mpr-05', key: 'arch:index-store-default-pg', value: '索引默认落 PostgreSQL（全文 + 向量 + 边表），规模阈值触发切换。', scope: 'project',
      reason: '设计文档 D-KB-2 已冻结该决策，需写入项目记忆供检索。', impact: '影响索引存储与迁移路径', state: 'accepted', how: 'confirm',
      author: '沈亦舟', at: r.agoDays(2), revocable: true,
    },
    {
      proposalId: 'mpr-06', key: 'pref:chinese-comments', value: '代码注释与文档一律中文，专有名词可保留英文。', scope: 'project',
      reason: '历史代码存在中英混排注释，review 反复提出。', impact: '影响全部新增代码注释风格', state: 'pending', how: 'confirm',
      author: 'Agent', at: r.agoHours(9), revocable: true,
    },
    {
      proposalId: 'mpr-07', key: 'policy:model-call-audit-ttl', value: '审计快照保留 90 天后自动转冷归档，可合规删除。', scope: 'org',
      reason: '组织策略 mem-o-02 的落地细则，需明确归档层级。', impact: '影响审计留存与合规删除穿透层', state: 'accepted', how: 'confirm',
      author: '合规负责人', at: r.agoDays(4), revocable: true,
    },
    {
      proposalId: 'mpr-08', key: 'assumption:redis-cluster', value: '假设生产环境 Redis 为集群模式，键需按 hash tag 分片。', scope: 'work',
      reason: '从连接串片段猜测，无环境探测证据。', impact: '仅当前任务，验证失败即丢弃', state: 'rejected', how: 'confirm',
      author: 'Agent（推断）', at: r.agoHours(12), revocable: false,
    },
    {
      proposalId: 'mpr-09', key: 'pref:no-emoji-in-code', value: '代码与提交信息中不使用 emoji。', scope: 'project',
      reason: '用户在 review 中两次删除 emoji 注释。', impact: '影响提交信息与注释风格', state: 'pending', how: 'confirm',
      author: 'Agent', at: r.agoHours(20), revocable: true,
    },
    {
      proposalId: 'mpr-10', key: 'convention:mapper-resultmap', value: 'Mapper XML 必须声明 resultMap 并与实体字段显式映射。', scope: 'project',
      reason: '检测到 3 处 select * 直接映射，字段增减易静默错位。', impact: '影响 mapper 层与查询正确性', state: 'accepted', how: 'auto',
      author: 'Agent', at: r.agoDays(3), revocable: true,
    },
    {
      proposalId: 'mpr-11', key: 'policy:code-egress-default-off', value: '代码外发到外部嵌入服务默认关闭，需企业显式开启并审计。', scope: 'org',
      reason: '与 mem-o-06 驻留策略一致，需在组织层固化。', impact: '影响 W-09 外发开关与嵌入迁移', state: 'pending', how: 'confirm',
      author: '合规负责人', at: r.agoHours(40), revocable: true,
    },
    {
      proposalId: 'mpr-12', key: 'secret:local-db-password', value: '本地数据库口令为 ******（原文已省略）。', scope: 'project',
      reason: 'Agent 尝试记住连接串中的口令。', impact: '命中密钥类 PII 策略，直接拒绝写入。', state: 'rejected', how: 'confirm',
      author: 'Agent', at: r.agoDays(6), revocable: false,
    },
    {
      proposalId: 'mpr-13', key: 'rule:no-insql', value: '禁止 inSql() 等字符串拼接 SQL，必须参数化或条件构造器。', scope: 'project',
      reason: '上次越权探测演示发现拼接 SQL 可绕过条件。', impact: '影响全部查询构造方式', state: 'accepted', how: 'confirm',
      author: '安全审查 Agent', at: r.agoDays(5), revocable: true,
    },
    {
      proposalId: 'mpr-14', key: 'pref:test-naming', value: '测试方法命名 shouldXxx_whenYyy 双语混排不推荐，统一中文描述 + 英文标识。', scope: 'project',
      reason: '测试命名风格不统一，检索困难。', impact: '影响测试文件可维护性', state: 'pending', how: 'confirm',
      author: 'Agent', at: r.agoHours(52), revocable: true,
    },
  ];

  /* ---------- 记忆：召回调试（含预算裁剪与未被使用的命中） ---------- */
  const recallDebug: RecallDebugQuery[] = [
    {
      query: '这个项目里发布流程有哪些硬约束？',
      at: r.agoHours(1), sessionRef: 'sess-2f81#turn-11',
      hits: [
        { memoryId: 'mem-o-01', score: 0.94, used: true, sourceType: '规则' },
        { memoryId: 'mem-p-09', score: 0.81, used: true, sourceType: '全文' },
        { memoryId: 'mem-o-06', score: 0.66, used: false, sourceType: '向量' },
        { memoryId: 'mem-o-02', score: 0.58, used: false, sourceType: '向量' },
        { memoryId: 'mem-p-02', score: 0.41, used: false, sourceType: '重排' },
      ],
      latencyBreakdown: { ruleMs: 9, fulltextMs: 34, vectorMs: 71, rerankMs: 42 },
      budgetTrimmed: { trimmed: 2, budgetTokens: 900, usedTokens: 900 },
    },
    {
      query: '下单接口是否幂等？',
      at: r.agoHours(3), sessionRef: 'sess-2f81#turn-6',
      hits: [
        { memoryId: 'mem-w-01', score: 0.88, used: true, sourceType: '规则' },
        { memoryId: 'mem-p-01', score: 0.52, used: false, sourceType: '全文' },
        { memoryId: 'mem-s-02', score: 0.34, used: false, sourceType: '向量' },
      ],
      latencyBreakdown: { ruleMs: 7, fulltextMs: 28, vectorMs: 66, rerankMs: 31 },
      budgetTrimmed: { trimmed: 0, budgetTokens: 900, usedTokens: 512 },
    },
    {
      query: '凭证怎么注入？有没有明文落盘风险？',
      at: r.agoHours(8), sessionRef: 'sess-3a55#turn-2',
      hits: [
        { memoryId: 'mem-o-05', score: 0.97, used: true, sourceType: '规则' },
        { memoryId: 'mem-o-03', score: 0.63, used: false, sourceType: '全文' },
        { memoryId: 'mem-p-01', score: 0.29, used: false, sourceType: '向量' },
      ],
      latencyBreakdown: { ruleMs: 11, fulltextMs: 41, vectorMs: 88, rerankMs: 55 },
      budgetTrimmed: { trimmed: 1, budgetTokens: 1200, usedTokens: 1200 },
    },
  ];

  /* ---------- 记忆：冲突（含未决高严重度） ---------- */
  const conflicts: MemoryConflict[] = [
    {
      conflictId: 'mcf-01', kind: 'sameKeyDifferentValue', a: 'mem-p-06', b: 'mem-s-04', severity: '中',
      resolution: '保留项目层新版本；会话层副本标记 superseded，版本链可审计。', detectedAt: r.agoDays(2),
    },
    {
      conflictId: 'mcf-02', kind: 'semanticContradiction', a: 'mem-p-08', b: 'mem-o-06', severity: '高',
      resolution: '未决：进入组织评审；当前按更严格策略执行（代码外发开关保持关闭）。', detectedAt: r.agoHours(6),
    },
    {
      conflictId: 'mcf-03', kind: 'sameKeyDifferentValue', a: 'mem-s-01', b: 'mem-s-05', severity: '中',
      resolution: '合并确认：以 mem-s-01（项目提交规范）为准，mem-s-05 标记 superseded 并记录理由。', detectedAt: r.agoDays(1),
    },
    {
      conflictId: 'mcf-04', kind: 'sameKeyDifferentValue', a: 'mem-p-01', b: 'mem-p-10', severity: '高',
      resolution: '未决：等待组织评审；裁决前执行最严格策略（禁止直连生产库）。', detectedAt: r.agoHours(26),
    },
  ];

  /* ---------- 记忆：文件化同步（文件为源，漂移以文件为准） ---------- */
  const files: MemoryFile[] = [
    {
      path: '.oc/memory/project-rules.md',
      yamlHeader: 'scope: project\nkey: rule:no-direct-prod-db\ntags: [合规, 数据库]\nttl: permanent\nstatus: active\nsensitivity: 敏感',
      content: '---\nscope: project\ntags: [合规, 数据库]\n---\n\n## 生产库访问\n\n- 禁止直连生产库改数据；一切 schema 变更走 Flyway 迁移脚本。\n- 迁移脚本需双人评审，禁止在窗口外执行。\n- 例外通道见《热修单人评审》，需 24h 内补签。\n',
      drift: false, entryCount: 6, lastSyncedAt: r.agoHours(1), indexState: 'in_sync', sourceOfTruth: 'file',
    },
    {
      path: '.oc/memory/arch-decisions.md',
      yamlHeader: 'scope: project\nkey: arch:*\ntags: [架构, 依赖]\nttl: permanent\nstatus: active',
      content: '---\nscope: project\ntags: [架构, 依赖]\n---\n\n## 依赖方向\n\n- common ← core-api ← core-*；core 系列零 Spring 依赖。\n- domain → application → interfaces → bootstrap 单向无环。\n\n## 模型适配\n\n- 适配器注册表按 protocol 映射；新增协议只注册，不改调用点。\n',
      drift: true, entryCount: 9, lastSyncedAt: r.agoHours(19), indexState: 'drift', sourceOfTruth: 'file',
    },
    {
      path: '.oc/memory/api-conventions.md',
      yamlHeader: 'scope: project\nkey: convention:*\ntags: [约定, 接口]\nttl: permanent\nstatus: active',
      content: '---\nscope: project\ntags: [约定, 接口]\n---\n\n## 错误码\n\n- 新增错误码登记到 impl/00-contracts，附 retryable 与中文文案。\n- 禁止裸抛 RuntimeException 表达业务失败。\n',
      drift: false, entryCount: 4, lastSyncedAt: r.agoHours(3), indexState: 'in_sync', sourceOfTruth: 'file',
    },
    {
      path: '.oc/memory/org-policies.md',
      yamlHeader: 'scope: org\nkey: policy:*\ntags: [组织规范]\nttl: permanent\nstatus: active\nsensitivity: 内部',
      content: '---\nscope: org\ntags: [组织规范]\n---\n\n## 发布\n\n- 双人评审，评审人不得为提交人。\n\n## 凭证\n\n- 只存引用；短期令牌注入；日志强制脱敏。\n\n## 驻留\n\n- 境内租户数据不得外发到区域外端点。\n',
      drift: false, entryCount: 5, lastSyncedAt: r.agoHours(6), indexState: 'pending', sourceOfTruth: 'file',
    },
  ];

  /* ---------- 记忆：删除三级（含合规删除证明） ---------- */
  const delLayers = (done: number) =>
    ['数据库', '全文索引', '向量索引', '召回缓存', '备份集', '事件投影'].map((name, i) => ({ name, done: i < done }));

  const deletions: MemoryDeletion[] = [
    {
      deletionId: 'mdl-01', level: 'ttl', scope: 'session', target: 'mem-s-03（pref:test-first）', state: 'DONE', exported: false,
      proof: { at: r.agoDays(6), range: '89 条会话记忆（30 天未召回）', executor: 'scheduler:memory-ttl', layers: delLayers(4) },
    },
    {
      deletionId: 'mdl-02', level: 'soft', scope: 'project', target: 'mem-p-07（temp:hotfix-branch-name）', state: 'DONE', exported: false,
      proof: { at: r.agoDays(2), range: '1 条（临时约定已失效）', executor: '沈亦舟', layers: delLayers(3) },
    },
    {
      deletionId: 'mdl-03', level: 'compliance', scope: 'org', target: '3 条含密钥片段的组织记忆', state: 'RUNNING', exported: true,
      proof: { at: r.agoHours(4), range: '3 条（含 1 条敏感级，已加密）', executor: '合规管理员 林晚照', layers: delLayers(4) },
    },
    {
      deletionId: 'mdl-04', level: 'compliance', scope: 'project', target: '2 条他人 PII 记忆（手机号）', state: 'DONE', exported: true,
      proof: { at: r.agoDays(9), range: '2 条（穿透备份与投影）', executor: '合规管理员 林晚照', layers: delLayers(6) },
    },
  ];

  /* ---------- 记忆：组织记忆治理 ---------- */
  const orgGovernance: OrgMemoryGovernance[] = [
    {
      governanceId: 'gov-01', proposal: 'policy:secret-handling（v2：短期令牌 + 导出脱敏）', reviewer: '安全负责人 贺清尘',
      rationale: 'v1 缺少令牌有效期与导出脱敏条款，事故复盘要求补齐。', impact: '全组织凭证与日志处理；影响 12 个服务',
      state: '已发布', version: 'v2', at: r.agoDays(8),
    },
    {
      governanceId: 'gov-02', proposal: 'policy:embedding-egress-allowlist（外部嵌入白名单）', reviewer: '合规负责人 林晚照',
      rationale: '与 mem-o-06 驻留策略存在冲突，需先裁决再发布。', impact: '影响检索质量与数据出境合规',
      state: '评审中', version: 'v1-draft', at: r.agoHours(20),
    },
    {
      governanceId: 'gov-03', proposal: 'policy:index-budget-relaxed（索引预算放宽到 20min）', reviewer: '架构评审 Agent',
      rationale: '未提供影响面评估（大仓并发时的资源竞争证据缺失）。', impact: '可能挤占模型调用配额',
      state: '已驳回', version: 'v1', at: r.agoDays(4),
    },
    {
      governanceId: 'gov-04', proposal: 'policy:residency-exception-list（驻留例外清单 v3）', reviewer: '合规负责人 林晚照',
      rationale: '回滚演练发现例外范围过宽（覆盖 30% 租户），回滚至 v2。', impact: '影响模型路由与嵌入服务选择',
      state: '已回滚', version: 'v2（回滚自 v3）', at: r.agoDays(11),
    },
  ];

  /* ---------- 记忆：隐私与脱敏 ---------- */
  const privacy: MemoryPrivacy = {
    piiTypes: [
      { type: '手机号', enabled: true, action: '脱敏' },
      { type: '邮箱', enabled: true, action: '脱敏' },
      { type: '证件', enabled: true, action: '拒绝写入' },
      { type: '密钥', enabled: true, action: '拒绝写入' },
    ],
    policy: '写入前检测四类 PII：脱敏类替换为掩码后入库；拒绝类直接丢弃并留事件；敏感级条目加密存储（AES-GCM，密钥经密钥代理）。',
    encrypted: true,
    auditLog: [
      { at: r.agoHours(1), actor: '沈亦舟', target: 'mem-p-01（敏感级）', action: '召回读取', result: '允许' },
      { at: r.agoHours(3), actor: 'Agent（sess-3a55）', target: 'mem-o-05（敏感级）', action: '召回读取', result: '允许' },
      { at: r.agoHours(12), actor: 'Agent（sess-0b12）', target: 'mem-p-10（含运维联系人手机号）', action: '写入候选', result: '脱敏返回' },
      { at: r.agoDays(6), actor: 'Agent（sess-1c07）', target: '连接串口令', action: '写入候选', result: '拒绝' },
      { at: r.agoDays(9), actor: '合规管理员 林晚照', target: 'mem-*（PII 相关）', action: '合规删除', result: '允许' },
    ],
  };

  /* ---------- 记忆：质量评测（四项指标 + 纠正反哺） ---------- */
  const qualityMetrics: MemoryQuality = {
    hitRate: 0.78, misuseRate: 0.062, expiredRate: 0.11, conflictRate: 0.028,
    history: Array.from({ length: 8 }, (_, i) => ({
      week: `W${i + 30}`,
      hitRate: r.float(0.68, 0.82, 2),
      misuseRate: r.float(0.04, 0.09, 3),
    })),
    corrections: [
      { at: r.agoDays(1), memoryId: 'mem-p-05', by: '沈亦舟', text: '预算改为 10min（原 6min 会在 12 万文件仓库超限）。', feedback: true },
      { at: r.agoDays(3), memoryId: 'mem-p-02', by: '架构评审 Agent', text: '错误码目录路径补全为 impl/00-contracts/，并补 retryable。', feedback: true },
      { at: r.agoDays(7), memoryId: 'mem-o-04', by: 'SRE 负责人', text: '事件分级已并入新版 Runbook，标记 archived。', feedback: false },
      { at: r.agoDays(12), memoryId: 'mem-s-05', by: '沈亦舟', text: '与提交规范冲突，标记 superseded，同类提议降级为需确认。', feedback: true },
    ],
  };

  /* ---------- 知识：八类连接器 ---------- */
  const sources: KnowledgeSource[] = [
    {
      sourceId: 'ksrc-01', name: '本地工作区（open-coding-client-web）', type: '本地', credentialRef: '无需凭据（本地只读）',
      syncMode: 'incremental', lastSyncAt: r.ago(2), syncStatus: 'synced', chunkCount: 4820, lagSeconds: 6,
      logs: [{ at: r.ago(2), level: 'ok', text: '增量同步完成：变更 12 文件 / 新增 38 块' }],
    },
    {
      sourceId: 'ksrc-02', name: 'GitHub · hk/opencoding', type: '仓库', credentialRef: 'cred://git/github-org-token',
      syncMode: 'incremental', lastSyncAt: r.ago(5), syncStatus: 'synced', chunkCount: 12840, lagSeconds: 12,
      logs: [{ at: r.ago(5), level: 'ok', text: 'webhook 触发增量索引：commit a91f3c2' }],
    },
    {
      sourceId: 'ksrc-03', name: 'GitLab 内网 · payment-core', type: '仓库', credentialRef: 'cred://git/gitlab-internal-pat',
      syncMode: 'full', lastSyncAt: r.ago(40), syncStatus: 'syncing', chunkCount: 6420, lagSeconds: 240,
      logs: [
        { at: r.ago(40), level: 'warn', text: '全量重建进行中：进度 62%，限流触发退避' },
        { at: r.ago(70), level: 'ok', text: '解析器就绪：Java AST + XML 资源' },
      ],
    },
    {
      sourceId: 'ksrc-04', name: 'Aone 工单（编码域）', type: '工单', credentialRef: 'cred://aone/service-token',
      syncMode: 'incremental', lastSyncAt: r.ago(9), syncStatus: 'synced', chunkCount: 2180, lagSeconds: 45,
      logs: [{ at: r.ago(9), level: 'ok', text: '同步 26 条工单变更（含 3 条关闭态）' }],
    },
    {
      sourceId: 'ksrc-05', name: 'Jira 服务台', type: '工单', credentialRef: 'cred://jira/readonly',
      syncMode: 'incremental', lastSyncAt: r.agoHours(1), syncStatus: 'degraded', chunkCount: 1560, lagSeconds: 3600,
      logs: [{ at: r.agoHours(1), level: 'warn', text: '上游 API 429 限流，本轮仅同步 12/180 条，已标注滞后' }],
    },
    {
      sourceId: 'ksrc-06', name: '企业 IM · 研发群归档', type: '聊天', credentialRef: 'cred://im/archive-reader',
      syncMode: 'incremental', lastSyncAt: r.ago(30), syncStatus: 'synced', chunkCount: 3260, lagSeconds: 120,
      logs: [{ at: r.ago(30), level: 'ok', text: '按会话窗口切分：新增 64 块（已脱敏手机号 4 处）' }],
    },
    {
      sourceId: 'ksrc-07', name: '公开文档抓取（docs.spring.io 等）', type: '网页', credentialRef: '无需凭据（公共网页）',
      syncMode: 'full', lastSyncAt: r.agoHours(6), syncStatus: 'synced', chunkCount: 8940, lagSeconds: 21600,
      logs: [{ at: r.agoHours(6), level: 'ok', text: '抓取 128 页：快照已存档（url://…#captured=）' }],
    },
    {
      sourceId: 'ksrc-08', name: '竞品公开文档', type: '网页', credentialRef: '无需凭据（公共网页）',
      syncMode: 'full', lastSyncAt: r.agoDays(2), syncStatus: 'failed', chunkCount: 410, lagSeconds: 172800,
      logs: [{ at: r.agoDays(2), level: 'error', text: '抓取失败：robots.txt 拒绝 78% 路径，已停止并保留快照' }],
    },
    {
      sourceId: 'ksrc-09', name: 'OSS 设计资产桶（只读）', type: '对象存储', credentialRef: 'cred://oss/readonly-role',
      syncMode: 'incremental', lastSyncAt: r.agoHours(2), syncStatus: 'synced', chunkCount: 1120, lagSeconds: 7800,
      logs: [{ at: r.agoHours(2), level: 'ok', text: '仅索引元数据与可提取文本，媒体正文不入库' }],
    },
    {
      sourceId: 'ksrc-10', name: 'PG 元数据快照（information_schema）', type: 'DB Schema', credentialRef: 'cred://pg/metadata-reader',
      syncMode: 'incremental', lastSyncAt: r.ago(15), syncStatus: 'synced', chunkCount: 760, lagSeconds: 900,
      logs: [{ at: r.ago(15), level: 'ok', text: '解析 42 张 oc_* 表：列注释与索引已入图' }],
    },
    {
      sourceId: 'ksrc-11', name: 'OpenAPI（open-coding-interfaces）', type: 'API 文档', credentialRef: 'cred://repo/openapi-build',
      syncMode: 'incremental', lastSyncAt: r.ago(8), syncStatus: 'synced', chunkCount: 640, lagSeconds: 30,
      logs: [{ at: r.ago(8), level: 'ok', text: '接口文档增量更新：新增 6 个端点描述' }],
    },
    {
      sourceId: 'ksrc-12', name: '内部 API 门户（Swagger 聚合）', type: 'API 文档', credentialRef: 'cred://portal/api-token',
      syncMode: 'incremental', lastSyncAt: r.agoDays(3), syncStatus: 'paused', chunkCount: 980, lagSeconds: 259200,
      logs: [{ at: r.agoDays(3), level: 'warn', text: '用户暂停同步（门户改版中，路径规则失效）' }],
    },
  ];

  /* ---------- 知识：块（结构感知切分 + 符号级信息） ---------- */
  const chunkSpecs: [string, KnowledgeChunk['strategy'], string, string, KnowledgeChunk['symbols']][] = [
    ['src/main/java/com/hk/opencoding/application/SessionService.java', 'AST', 'ksrc-02', 'SessionService.java', [{ name: 'SessionService', kind: '类' }, { name: 'startSession', kind: '方法' }, { name: 'MAX_CONCURRENT_TURNS', kind: '常量' }]],
    ['src/main/java/com/hk/opencoding/application/ProjectService.java', 'AST', 'ksrc-02', 'ProjectService.java', [{ name: 'ProjectService', kind: '类' }, { name: 'bindWorkspace', kind: '方法' }]],
    ['src/main/java/com/hk/opencoding/domain/entity/OcMemoryEntry.java', 'AST', 'ksrc-02', 'OcMemoryEntry.java', [{ name: 'OcMemoryEntry', kind: '类' }, { name: 'scope', kind: '常量' }]],
    ['src/main/java/com/hk/opencoding/domain/entity/OcKnowledgeChunk.java', 'AST', 'ksrc-02', 'OcKnowledgeChunk.java', [{ name: 'OcKnowledgeChunk', kind: '类' }]],
    ['src/main/java/com/hk/opencoding/interfaces/rest/MemoryController.java', 'AST', 'ksrc-02', 'MemoryController.java', [{ name: 'MemoryController', kind: '类' }, { name: 'proposeMemory', kind: '方法' }]],
    ['src/main/java/com/hk/opencoding/core/agent/AgentLoop.java', 'AST', 'ksrc-02', 'AgentLoop.java', [{ name: 'AgentLoop', kind: '类' }, { name: 'LoopStrategy', kind: '枚举' }, { name: 'step', kind: '方法' }]],
    ['src/main/java/com/hk/opencoding/core/agent/SubAgentPolicy.java', 'AST', 'ksrc-02', 'SubAgentPolicy.java', [{ name: 'SubAgentPolicy', kind: '接口' }, { name: 'narrowPermissions', kind: '方法' }]],
    ['src/main/java/com/hk/opencoding/core/model/ModelAdapterRegistry.java', 'AST', 'ksrc-02', 'ModelAdapterRegistry.java', [{ name: 'ModelAdapterRegistry', kind: '类' }, { name: 'resolve', kind: '方法' }]],
    ['src/main/resources/db/migration/V0007__add_oc_memory.sql', '语义', 'ksrc-02', 'V0007__add_oc_memory.sql', [{ name: 'oc_memory_entry', kind: '常量' }, { name: 'idx_memory_scope_key', kind: '常量' }]],
    ['src/main/resources/db/migration/V0009__add_oc_knowledge_chunk.sql', '语义', 'ksrc-02', 'V0009__add_oc_knowledge_chunk.sql', [{ name: 'oc_knowledge_chunk', kind: '常量' }]],
    ['docs/harness/10-memory-system.md', '标题层级', 'ksrc-02', '10-memory-system.md', [{ name: 'D-MEM-2 写入策略', kind: '常量' }, { name: 'D-MEM-6 遗忘与删除', kind: '常量' }]],
    ['docs/harness/11-knowledge-system.md', '标题层级', 'ksrc-02', '11-knowledge-system.md', [{ name: 'D-KB-4 检索路径', kind: '常量' }, { name: '引用模型', kind: '常量' }]],
    ['docs/harness/12-agent-core.md', '标题层级', 'ksrc-02', '12-agent-core.md', [{ name: 'SubAgent 协议', kind: '常量' }, { name: '三级验证', kind: '常量' }]],
    ['docs/design/model-abstraction-layer.md', '标题层级', 'ksrc-02', 'model-abstraction-layer.md', [{ name: 'AiException', kind: '类' }, { name: 'ErrorCode', kind: '枚举' }]],
    ['src/main/java/com/hk/payment/PaymentService.java', 'AST', 'ksrc-03', 'PaymentService.java', [{ name: 'PaymentService', kind: '类' }, { name: 'submit', kind: '方法' }, { name: 'checkIdempotentKey', kind: '方法' }]],
    ['src/main/java/com/hk/payment/PaymentRepository.java', 'AST', 'ksrc-03', 'PaymentRepository.java', [{ name: 'PaymentRepository', kind: '接口' }]],
    ['aone/TICKET-91823', '表格整块', 'ksrc-04', '支持记忆四层作用域', [{ name: '验收标准表', kind: '常量' }]],
    ['aone/TICKET-92110', '表格整块', 'ksrc-04', '检索延迟分解埋点', [{ name: '延迟预算表', kind: '常量' }]],
    ['jira/SD-4471', '表格整块', 'ksrc-05', 'Jira 同步限流问题', [{ name: '影响面表', kind: '常量' }]],
    ['im/rd-group/2026-09-18', '会话窗口', 'ksrc-06', '讨论：索引预算与并发', [{ name: '嵌入模型切换讨论', kind: '常量' }]],
    ['im/rd-group/2026-09-20', '会话窗口', 'ksrc-06', '讨论：记忆冲突裁决', [{ name: '冲突裁决讨论', kind: '常量' }]],
    ['web/docs-spring-io/expression-language', '语义', 'ksrc-07', 'Spring EL 章节', [{ name: 'SpEL 解析器', kind: '常量' }]],
    ['oss/design/harness-ui-spec-v4.pdf', '语义', 'ksrc-09', 'Harness UI 规范 v4', [{ name: '六态矩阵', kind: '常量' }]],
    ['db/information_schema/oc_memory_entry', '表格整块', 'ksrc-10', 'oc_memory_entry 列定义', [{ name: 'oc_memory_entry', kind: '常量' }, { name: 'sensitivity', kind: '常量' }]],
    ['openapi/memory-propose.yaml', '语义', 'ksrc-11', 'POST /memory/proposals', [{ name: 'POST /memory/proposals', kind: '常量' }]],
    ['openapi/knowledge-query.yaml', '语义', 'ksrc-11', 'POST /knowledge/query', [{ name: 'POST /knowledge/query', kind: '常量' }]],
  ];
  const chunks: KnowledgeChunk[] = chunkSpecs.map((c, i) => ({
    chunkId: `kch-${String(i + 1).padStart(3, '0')}`,
    docPath: c[0],
    strategy: c[1],
    sourceId: c[2],
    symbols: c[4],
    tokens: r.int(180, 1600),
  }));

  /* ---------- 知识：索引任务（含失败与断点续传） ---------- */
  const indexJobs: IndexJob[] = [
    {
      jobId: 'kjob-01', target: 'payment-core（全量重建）', mode: 'rebuild', progress: 62, chunksTotal: 45800,
      durationMs: 1_812_000, failedReason: '', resumable: true, commitHash: 'a91f3c2', state: 'RUNNING',
    },
    {
      jobId: 'kjob-02', target: 'GitHub · hk/opencoding（增量）', mode: 'incremental', progress: 100, chunksTotal: 3120,
      durationMs: 42_800, failedReason: '', resumable: false, commitHash: 'a91f3c2', state: 'SUCCEEDED',
    },
    {
      jobId: 'kjob-03', target: '竞品公开文档（全量）', mode: 'rebuild', progress: 41, chunksTotal: 4100,
      durationMs: 268_000, failedReason: '解析器异常：robots.txt 拒绝路径导致抓取中断（已保留 41% 进度）',
      resumable: true, commitHash: '', state: 'FAILED',
    },
    {
      jobId: 'kjob-04', target: 'Jira 服务台（增量）', mode: 'incremental', progress: 0, chunksTotal: 180,
      durationMs: 0, failedReason: '', resumable: false, commitHash: 'a91f3c2', state: 'QUEUED',
    },
  ];

  /* ---------- 知识：检索结果（五类引用 + 权限标签 + 陈旧标注） ---------- */
  const searchResults: SearchResult[] = [
    {
      resultId: 'rs-01', title: 'ContextSnapshotService.java · 九区段预算装配', snippet: '九区段 token 预算与水位：S4（记忆）固定 5%，S5（知识）按需伸缩，80%/95% 触发压缩。',
      score: 0.93, rerankScore: 0.96, citation: 'repo://opencoding/src/main/java/com/hk/opencoding/application/ContextSnapshotService.java#L120-L160@a91f3c2',
      citationKind: 'repo', permissionTags: { tenant: '云枢科技', project: 'opencoding', visibility: '项目', acl: 'project-member' },
      stale: false, lastVerifiedAt: r.agoHours(3),
    },
    {
      resultId: 'rs-02', title: '卷 11 · 引用模型（五类）', snippet: '每条检索结果携带来源与版本：repo/doc/url/ticket/wiki，注入上下文时保留可点开链接。',
      score: 0.9, rerankScore: 0.94, citation: 'doc://harness/11-knowledge-system#chunk=42@v12',
      citationKind: 'doc', permissionTags: { tenant: '云枢科技', project: 'opencoding', visibility: '公开', acl: 'org-member' },
      stale: false, lastVerifiedAt: r.agoDays(1),
    },
    {
      resultId: 'rs-03', title: 'Spring 官方文档 · 表达式语言', snippet: '抓取快照（2026-09-12）：SpEL 求值上下文与安全边界，用于提示词模板变量注入。',
      score: 0.71, rerankScore: 0.68, citation: 'url://docs.spring.io/spring-framework/reference/core/expressions.html#captured=2026-09-12T09:20:00Z',
      citationKind: 'url', permissionTags: { tenant: '云枢科技', project: 'opencoding', visibility: '公开', acl: 'public' },
      stale: false, lastVerifiedAt: r.agoHours(8),
    },
    {
      resultId: 'rs-04', title: 'TICKET-91823 · 记忆四层作用域验收标准', snippet: '验收：四层各 1 条写入/召回/过期用例；候选链路可撤销；文件化同步以文件为准。',
      score: 0.68, rerankScore: 0.72, citation: 'ticket://aone/TICKET-91823#comment=7',
      citationKind: 'ticket', permissionTags: { tenant: '云枢科技', project: 'opencoding', visibility: '项目', acl: 'project-member' },
      stale: false, lastVerifiedAt: r.agoDays(2),
    },
    {
      resultId: 'rs-05', title: '项目知识页 · open-coding-client-web', snippet: '架构概览 / 模块地图 / 关键流程（七段），每条结论附来源；两段标注待确认。',
      score: 0.64, rerankScore: 0.7, citation: 'wiki://page-3@v4',
      citationKind: 'wiki', permissionTags: { tenant: '云枢科技', project: 'opencoding', visibility: '项目', acl: 'project-member' },
      stale: false, lastVerifiedAt: r.agoHours(5),
    },
    {
      resultId: 'rs-06', title: 'PaymentService.java · submit 幂等实现', snippet: 'submit() 使用 checkIdempotentKey 前置校验；未命中则写入幂等键并返回既有单据。',
      score: 0.61, rerankScore: 0.66, citation: 'repo://payment-core/src/main/java/com/hk/payment/PaymentService.java#L40-L96@7c1de44',
      citationKind: 'repo', permissionTags: { tenant: '云枢科技', project: 'payment-core', visibility: '受限', acl: 'payment-team' },
      stale: true, lastVerifiedAt: r.agoDays(21),
    },
    {
      resultId: 'rs-07', title: '旧版错误码表（v1）', snippet: '错误码映射表（已废弃）：仍使用裸 RuntimeException 映射，缺少 retryable 标记。',
      score: 0.44, rerankScore: 0.38, citation: 'doc://opencoding/ERROR-CODE-v1#chunk=8@v1',
      citationKind: 'doc', permissionTags: { tenant: '云枢科技', project: 'opencoding', visibility: '项目', acl: 'project-member' },
      stale: true, lastVerifiedAt: r.agoDays(64),
    },
    {
      resultId: 'rs-08', title: 'IM 讨论 · 嵌入模型切换', snippet: '讨论记录：换嵌入模型需新旧索引并存期，检索可用性不受影响；外发开关保持关闭。',
      score: 0.58, rerankScore: 0.6, citation: 'ticket://im/rd-group/2026-09-18#comment=12',
      citationKind: 'ticket', permissionTags: { tenant: '云枢科技', project: 'opencoding', visibility: '项目', acl: 'project-member' },
      stale: false, lastVerifiedAt: r.agoDays(1),
    },
    {
      resultId: 'rs-09', title: 'OSS 设计规范 v4 · 六态矩阵', snippet: '六态 × 11 界面族验收矩阵；每个错误卡必须可复制 traceId。',
      score: 0.52, rerankScore: 0.56, citation: 'doc://oss/design/harness-ui-spec-v4#chunk=3@v4',
      citationKind: 'doc', permissionTags: { tenant: '云枢科技', project: 'opencoding', visibility: '内部', acl: 'design-guild' },
      stale: false, lastVerifiedAt: r.agoDays(4),
    },
  ];

  const queryTrace: QueryTrace = {
    query: '记忆四层作用域怎么写入，冲突怎么裁决？',
    rewrite: '记忆 写入策略 四层作用域 冲突检测 合并确认（同时检索：记忆系统卷 / 设计文档 / 工单验收标准）',
    filters: ['visibility ∈ {公开, 项目}', 'project = opencoding', '排除 stale=true', 'topK=8'],
    paths: [
      { name: '全文', used: true, degraded: false, note: 'BM25 命中 12 条' },
      { name: '向量', used: true, degraded: false, note: '语义命中 21 条（embedding v3）' },
      { name: '符号', used: false, degraded: true, note: '符号图索引重建中（kjob-01 62%），已按降级标注返回' },
    ],
    latencyMs: { understand: 22, recall: 96, fusion: 112, filter: 31 },
    permissionFiltered: 7,
    noEvidence: false,
  };

  /* ---------- 知识：项目知识页（七段 + 溯源 + 待确认） ---------- */
  const wikiPages: WikiPage[] = REPOS.slice(0, 8).map((repo, i) => ({
    pageId: `wiki-${i + 1}`,
    title: `${repo} · 项目知识页`,
    repo,
    version: `v${i + 2}`,
    sections: buildWikiSections(r, repo, i),
    generatedAt: r.agoHours(6 + i * 9),
    sourcedFrom: [`repo://${repo}@a91f3c2`, 'wiki://index/symbol-graph', `doc://harness/11-knowledge-system#chunk=12@v12`],
    pendingConfirm: i === 2 ? ['关键流程：入口链路缺少运行时证据', '测试与构建：CI 命令与本地不一致'] : i === 5 ? ['测试与构建：构建耗时未复测'] : [],
    editedByHuman: i === 1 || i === 4,
  }));

  /* ---------- 知识：陈旧检测（四类） ---------- */
  const staleFindings: StaleFinding[] = [
    {
      findingId: 'ksf-01', kind: '引用失效', target: 'repo://opencoding/src/main/java/com/hk/opencoding/legacy/OldSyncService.java#L10-L60',
      suggestion: '文件已删除；建议将该块标记失效并降权 0.5，来源引用改写为迁移后路径。', weight: 0.5, detectedAt: r.agoHours(7),
    },
    {
      findingId: 'ksf-02', kind: '版本落后', target: 'payment-core 索引（落后 3 个提交 / 21 天）',
      suggestion: '增量同步被全量重建阻塞；建议排队增量任务，或重建完成后立即补齐。', weight: 0.4, detectedAt: r.agoHours(5),
    },
    {
      findingId: 'ksf-03', kind: '长期未访问', target: 'doc://opencoding/ERROR-CODE-v1#chunk=8@v1',
      suggestion: '64 天未访问且已被新版本取代；建议归档并从默认检索集合移除。', weight: 0.35, detectedAt: r.agoDays(2),
    },
    {
      findingId: 'ksf-04', kind: '被新版本取代', target: 'wiki://page-6@v3（已有 v4 且人工编辑过）',
      suggestion: '旧版本仅保留对比用途；检索降权，引用默认指向 v4。', weight: 0.3, detectedAt: r.agoDays(3),
    },
    {
      findingId: 'ksf-05', kind: '引用失效', target: 'ticket://jira/SD-4471#comment=9（工单已迁移 Aone）',
      suggestion: '迁移映射缺失；建议补迁移表映射，否则引用不可达应标注降置信。', weight: 0.45, detectedAt: r.agoDays(1),
    },
    {
      findingId: 'ksf-06', kind: '长期未访问', target: 'im/rd-group/2026-06-02（会话窗口块 128 个）',
      suggestion: '讨论已过期且无引用；建议批量降权并进入审核队列确认。', weight: 0.25, detectedAt: r.agoDays(5),
    },
  ];

  /* ---------- 知识：治理（贡献度量 + 反馈队列） ---------- */
  const knowledgeGovernance: KnowledgeGovernance = {
    contributions: [
      { contributor: '沈亦舟', source: 'repo://opencoding', usageCount: 1842, acceptanceRate: 0.82 },
      { contributor: '架构评审 Agent', source: 'doc://harness/*', usageCount: 964, acceptanceRate: 0.74 },
      { contributor: '林晚照', source: 'wiki://page-4', usageCount: 610, acceptanceRate: 0.88 },
      { contributor: '合规组', source: 'ticket://aone/*', usageCount: 288, acceptanceRate: 0.63 },
      { contributor: '外部文档抓取', source: 'url://docs.spring.io', usageCount: 1220, acceptanceRate: 0.41 },
    ],
    feedbackQueue: [
      { id: 'kfb-01', target: 'rs-07（旧版错误码表 v1）', kind: '内容过时', reporter: '沈亦舟', at: r.agoHours(4), state: '修复中' },
      { id: 'kfb-02', target: 'kch-014（PaymentService 块）', kind: '引用不可达（版本落后）', reporter: 'Agent（sess-2f81）', at: r.agoHours(6), state: '待处理' },
      { id: 'kfb-03', target: 'wiki://page-3@v4', kind: '待确认段落被当作事实引用', reporter: '沈亦舟', at: r.agoDays(1), state: '待处理' },
      { id: 'kfb-04', target: 'kch-022（Spring EL 抓取快照）', kind: '抓取时间过久', reporter: 'Agent（sess-3a55）', at: r.agoDays(2), state: '已回写' },
      { id: 'kfb-05', target: 'ksrc-05（Jira 服务台）', kind: '同步滞后超阈值', reporter: '运维值班', at: r.agoHours(1), state: '修复中' },
    ],
  };

  /* ---------- 内核：Agent 定义（8 字段 + 四级作用域 + 权限收窄） ---------- */
  const definitions: AgentDefinition[] = [
    {
      name: '主编码 Agent', description: '默认编码执行者：读代码、改代码、跑测试、给证据。', promptRole: 'roles/coding-primary@v3',
      tools: { allow: ['read_file', 'edit_file', 'search', 'run_tests', 'git_status'], deny: ['git_push', 'deploy'] },
      permissions: { mode: 'default', ceiling: 'acceptEdits' }, delegation: { enabled: true, maxDepth: 3, maxNodes: 4 },
      budget: { default: '200k token / 30min / 80 tool calls' }, scope: 'builtin',
      handoff: '触发破坏性操作、跨仓库改动或连续 2 次验证失败时移交人类',
      narrowing: { ok: true, note: '工具集与权限均不超过父会话（default ≤ acceptEdits）。' },
    },
    {
      name: '架构评审 Agent', description: '只读评审：依赖方向、接口契约、可测试性。', promptRole: 'roles/arch-review@v2',
      tools: { allow: ['read_file', 'search', 'symbol_graph'], deny: ['edit_file', 'run_shell'] },
      permissions: { mode: 'readonly', ceiling: 'readonly' }, delegation: { enabled: false, maxDepth: 0, maxNodes: 0 },
      budget: { default: '80k token / 15min / 30 tool calls' }, scope: 'builtin',
      handoff: '发现架构级风险时输出评审意见并移交主 Agent 决策',
      narrowing: { ok: true, note: '只读档，无法获得写权限（防止评审越权修改）。' },
    },
    {
      name: '测试补全覆盖 Agent', description: '按风险排序补回归测试，报告覆盖率变化与残余风险。', promptRole: 'roles/test-coverage@v1',
      tools: { allow: ['read_file', 'edit_file', 'run_tests', 'coverage_report'], deny: ['edit_file:src/main/**'] },
      permissions: { mode: 'acceptEdits', ceiling: 'acceptEdits' }, delegation: { enabled: true, maxDepth: 1, maxNodes: 2 },
      budget: { default: '120k token / 20min / 50 tool calls' }, scope: 'project',
      handoff: '覆盖率提升不足 5% 或出现 flaky 用例时移交人类确认',
      narrowing: { ok: true, note: '写范围限定 src/test/**，deny 覆盖 src/main/**。' },
    },
    {
      name: '迁移脚本 Agent', description: '生成并验证 Flyway 迁移脚本（前向 + 回退）。', promptRole: 'roles/migration@v1',
      tools: { allow: ['read_file', 'edit_file', 'run_migration_dryrun'], deny: ['run_migration_apply'] },
      permissions: { mode: 'default', ceiling: 'default' }, delegation: { enabled: false, maxDepth: 0, maxNodes: 0 },
      budget: { default: '60k token / 12min / 24 tool calls' }, scope: 'project',
      handoff: '任何写入生产库的动作一律移交人类 + 双人评审',
      narrowing: { ok: true, note: '仅 dry-run；apply 需审批，不在 Agent 权限内。' },
    },
    {
      name: '文档漂移修复 Agent', description: '对比代码与文档，生成修订 PR 并保护人工校订段落。', promptRole: 'roles/doc-drift@v2',
      tools: { allow: ['read_file', 'edit_file', 'search'], deny: ['run_shell'] },
      permissions: { mode: 'acceptEdits', ceiling: 'acceptEdits' }, delegation: { enabled: false, maxDepth: 0, maxNodes: 0 },
      budget: { default: '90k token / 18min / 40 tool calls' }, scope: 'org',
      handoff: '人工校订段落（editedByHuman）冲突时移交文档负责人',
      narrowing: { ok: true, note: '禁止覆写人工校订段落，由工具层强制。' },
    },
    {
      name: '安全审查（红队）Agent', description: '按 STRIDE 与越权探测清单做只读审查，输出风险清单。', promptRole: 'roles/redteam@v3',
      tools: { allow: ['read_file', 'search', 'sandbox_probe'], deny: ['edit_file', 'network_egress'] },
      permissions: { mode: 'readonly', ceiling: 'readonly' }, delegation: { enabled: false, maxDepth: 0, maxNodes: 0 },
      budget: { default: '100k token / 25min / 60 tool calls' }, scope: 'org',
      handoff: '发现越权可达路径时立即阻断并通知安全负责人',
      narrowing: { ok: true, note: '不允许出网；探测在持久沙箱档内执行。' },
    },
    {
      name: '依赖升级 Agent', description: '批量升级依赖并跑回归，遇到破坏性变更给出回滚方案。', promptRole: 'roles/dep-upgrade@v1',
      tools: { allow: ['read_file', 'edit_file', 'run_tests', 'network:registry'], deny: ['git_push'] },
      permissions: { mode: 'default', ceiling: 'default' }, delegation: { enabled: true, maxDepth: 1, maxNodes: 3 },
      budget: { default: '150k token / 40min / 70 tool calls' }, scope: 'project',
      handoff: '主版本升级或需要变更公共 API 时移交架构评审',
      narrowing: { ok: true, note: '出网仅限包仓库域名白名单。' },
    },
    {
      name: '数据管道 Agent', description: '维护 ETL 与数据一致性校验，产出偏差报告。', promptRole: 'roles/data-pipeline@v1',
      tools: { allow: ['read_file', 'edit_file', 'run_sql_dryrun'], deny: ['run_sql_apply'] },
      permissions: { mode: 'plan', ceiling: 'default' }, delegation: { enabled: false, maxDepth: 0, maxNodes: 0 },
      budget: { default: '70k token / 20min / 30 tool calls' }, scope: 'org',
      handoff: '涉及跨库写入或驻留例外时移交合规评审',
      narrowing: { ok: true, note: 'plan 模式先出方案；写入需人类放行。' },
    },
    {
      name: '知识页维护 Agent', description: '重生成项目知识页并对比版本，标出待确认段落。', promptRole: 'roles/wiki-maintainer@v1',
      tools: { allow: ['read_file', 'search', 'wiki_write'], deny: ['edit_file:src/**'] },
      permissions: { mode: 'acceptEdits', ceiling: 'acceptEdits' }, delegation: { enabled: false, maxDepth: 0, maxNodes: 0 },
      budget: { default: '80k token / 20min / 36 tool calls' }, scope: 'builtin',
      handoff: '无法溯源的结论一律标「待确认」，不直接写入事实层',
      narrowing: { ok: true, note: '写范围仅 wiki 命名空间。' },
    },
    {
      name: '发布编排 Agent', description: '编排发布检查清单（构建/扫描/门禁）并生成发布说明。', promptRole: 'roles/release-orchestrator@v2',
      tools: { allow: ['read_file', 'run_tests', 'run_scan', 'create_release_note'], deny: ['deploy_prod'] },
      permissions: { mode: 'default', ceiling: 'default' }, delegation: { enabled: true, maxDepth: 1, maxNodes: 2 },
      budget: { default: '120k token / 30min / 50 tool calls' }, scope: 'org',
      handoff: '门禁未达标或需要紧急通道时移交发布负责人',
      narrowing: { ok: true, note: '禁止 deploy_prod；生产部署必须人类放行。' },
    },
    {
      name: '驻留合规审查 Agent', description: '校验模型路由、嵌入服务与知识外发是否符合驻留策略。', promptRole: 'roles/residency-review@v1',
      tools: { allow: ['read_file', 'search', 'policy_eval'], deny: ['edit_file', 'network_egress'] },
      permissions: { mode: 'readonly', ceiling: 'readonly' }, delegation: { enabled: false, maxDepth: 0, maxNodes: 0 },
      budget: { default: '60k token / 15min / 24 tool calls' }, scope: 'org',
      handoff: '发现例外清单过宽时输出裁决请求给合规负责人',
      narrowing: { ok: true, note: '只读；策略评估在本地执行。' },
    },
    {
      name: '前端还原度 Agent（自定义）', description: '按设计规范核对前端页面还原度并输出差异清单。', promptRole: 'roles/ui-parity@v1',
      tools: { allow: ['read_file', 'edit_file', 'run_tests'], deny: [] },
      permissions: { mode: 'autonomous', ceiling: 'autonomous' }, delegation: { enabled: true, maxDepth: 5, maxNodes: 12 },
      budget: { default: '400k token / 120min / 200 tool calls' }, scope: 'user',
      handoff: '—',
      narrowing: { ok: false, note: '权限收窄校验失败：请求 autonomous 超过组织上限 acceptEdits，且派生深度 5 > 上限 3；已拒绝装载。' },
    },
  ];

  /* ---------- 内核：子 Agent（brief / 预算信封 / 结果契约 / 级联取消） ---------- */
  const subagents: SubAgent[] = [
    {
      agentId: 'sa-01', name: '子 Agent · 迁移脚本验证', parentItemId: 'item-2f81-042', depth: 1, status: 'succeeded',
      brief: {
        goal: '验证 V0007/V0009 迁移脚本在空库与样本库均可重放，并验证回退脚本。',
        acceptance: ['空库执行成功且无告警', '样本库重放后行数一致', '回退脚本可回滚到上一版本'],
        known: ['迁移目录 src/main/resources/db/migration', 'Flyway 版本策略为 forward-only + 手工回退'],
        constraints: ['只允许连接本地沙箱数据库', '禁止修改任何迁移脚本（只读验证）'],
        refs: ['file://src/main/resources/db/migration/V0007__add_oc_memory.sql', 'kb://kch-009', 'doc://harness/19-persistence#chunk=22@v9'],
        banned: ['禁止 git push', '禁止连接生产库', '禁止修改 src/main/resources/**'],
      },
      tools: ['read_file', 'run_migration_dryrun', 'run_tests'],
      budget: { tokenLimit: 80_000, usedTokens: 61_240, stepLimit: 40, usedSteps: 27, timeLimitMin: 15 },
      isolation: '选择性继承：brief + 显式引用；父对话不继承，父上下文变更不影响子',
      returnContract: {
        conclusion: '空库与样本库均可重放；回退脚本在样本库验证通过，空库回退缺少低版本环境未验证。',
        evidence: ['命令：mvn -pl open-coding-domain flyway:info → 无告警', '命令：psql -f V0007 + 行数对比 → 一致', '日志：dryrun-3f21 全程退出码 0'],
        artifacts: ['artifact://logs/migration-dryrun-3f21.txt'],
        openQuestions: ['空库回退脚本未验证（缺少 v0006 环境）'],
        confidence: '中',
        usage: { tokens: 61_240, cost: 0.412, durationMs: 386_000 },
      },
    },
    {
      agentId: 'sa-02', name: '子 Agent · 检索质量对比', parentItemId: 'item-2f81-045', depth: 1, status: 'succeeded',
      brief: {
        goal: '对比三家嵌入模型在编码域查询上的召回质量，给出切换建议。',
        acceptance: ['同一查询集（40 条）对比 recall@10', '给出成本与延迟对比'],
        known: ['现有索引使用 embedding v3', '外发开关默认关闭'],
        constraints: ['不得外发任何代码片段（仅用公开文档片段做外部模型对比）'],
        refs: ['kb://kch-021', 'wiki://page-2@v3'],
        banned: ['禁止外发私有代码', '禁止直接切换生产索引'],
      },
      tools: ['search', 'run_eval'],
      budget: { tokenLimit: 120_000, usedTokens: 108_900, stepLimit: 60, usedSteps: 52, timeLimitMin: 25 },
      isolation: '选择性继承：仅注入查询集与公开文档片段',
      returnContract: {
        conclusion: '内部模型 recall@10 = 0.78，外部模型 0.84 但触发驻留冲突；建议维持内部模型并优化切分策略。',
        evidence: ['评测：eval-9c31（40 查询 × 3 模型）', '延迟：内部 74ms / 外部 118ms'],
        artifacts: ['artifact://reports/embedding-compare-9c31.json'],
        openQuestions: ['切分策略调优收益未量化'],
        confidence: '高',
        usage: { tokens: 108_900, cost: 0.94, durationMs: 702_000 },
      },
    },
    {
      agentId: 'sa-03', name: '子 Agent · 前端页面还原核对', parentItemId: 'item-2f81-051', depth: 2, status: 'running',
      brief: {
        goal: '核对记忆中心 10 个页面的六态实现与组件复用情况。',
        acceptance: ['每页六态至少实现 EMPTY/LOADING/ERROR', '列表页含 EDGE_DATA', '无自定义组件重复造轮子'],
        known: ['组件清单见 .recon/DEVELOPER-GUIDE.md §4'],
        constraints: ['只读；不得修改他人文件'],
        refs: ['file://.recon/DEVELOPER-GUIDE.md', 'wiki://page-3@v4'],
        banned: ['禁止新增 npm 依赖', '禁止修改公共组件'],
      },
      tools: ['read_file', 'search'],
      budget: { tokenLimit: 60_000, usedTokens: 22_180, stepLimit: 30, usedSteps: 11, timeLimitMin: 10 },
      isolation: '选择性继承：仅注入组件清单与目标页面列表',
      returnContract: null,
    },
    {
      agentId: 'sa-04', name: '子 Agent · 循环防护演练', parentItemId: 'item-2f81-058', depth: 1, status: 'paused',
      brief: {
        goal: '构造重复动作与目标漂移场景，验证三重上限触发后的摘要输出。',
        acceptance: ['重复动作 5 次内触发检测', '触发后暂停并输出摘要', '不静默终止'],
        known: ['默认上限：120 步 / 60min / $8'],
        constraints: ['演练在沙箱内进行，不影响真实会话'],
        refs: ['doc://harness/12-agent-core#chunk=31@v6'],
        banned: ['禁止写入真实工作区'],
      },
      tools: ['run_sim'],
      budget: { tokenLimit: 40_000, usedTokens: 31_500, stepLimit: 20, usedSteps: 18, timeLimitMin: 12 },
      isolation: '完全隔离（仅传任务描述）',
      returnContract: null,
    },
    {
      agentId: 'sa-05', name: '子 Agent · 依赖差异审计', parentItemId: 'item-2f81-060', depth: 1, status: 'failed',
      brief: {
        goal: '审计本次依赖升级的差异与来源校验结果。',
        acceptance: ['列出新增/升级依赖与来源', '锁文件一致性校验'],
        known: ['锁文件强制开启'],
        constraints: ['只读审计'],
        refs: ['file://package-lock.json'],
        banned: ['禁止执行任何安装命令'],
      },
      tools: ['read_file', 'run_scan'],
      budget: { tokenLimit: 50_000, usedTokens: 18_400, stepLimit: 24, usedSteps: 9, timeLimitMin: 10 },
      isolation: '选择性继承：仅注入锁文件引用',
      returnContract: {
        conclusion: '审计中断：registry 元数据拉取失败（网络白名单未含私有镜像域名）。',
        evidence: ['命令：npm audit → 退出码 1（EAI_AGAIN）'],
        artifacts: [],
        openQuestions: ['私有镜像域名是否加入白名单需人类决策'],
        confidence: '低',
        usage: { tokens: 18_400, cost: 0.11, durationMs: 96_000 },
      },
    },
    {
      agentId: 'sa-06', name: '子 Agent · 知识陈旧扫描', parentItemId: 'item-3a55-014', depth: 1, status: 'succeeded',
      brief: {
        goal: '扫描引用失效与长期未访问的知识块，产出降权建议。',
        acceptance: ['四类陈旧全部覆盖', '每条给出降权权重与依据'],
        known: ['陈旧阈值：版本差 > 5 或 > 90 天未访问'],
        constraints: ['只读；降权需人类确认后执行'],
        refs: ['doc://harness/11-knowledge-system#chunk=48@v12'],
        banned: ['禁止直接改写索引权重'],
      },
      tools: ['search', 'read_file'],
      budget: { tokenLimit: 70_000, usedTokens: 44_900, stepLimit: 30, usedSteps: 21, timeLimitMin: 15 },
      isolation: '选择性继承：仅注入阈值配置与索引快照',
      returnContract: {
        conclusion: '发现 6 条陈旧项：2 引用失效、1 版本落后、2 长期未访问、1 被取代；建议权 0.25–0.5。',
        evidence: ['扫描：stale-scan-2f91（覆盖 12840 块）', '抽样复核 12 块全部命中'],
        artifacts: ['artifact://reports/stale-scan-2f91.json'],
        openQuestions: ['降权是否需要人工逐条确认存在分歧'],
        confidence: '高',
        usage: { tokens: 44_900, cost: 0.36, durationMs: 512_000 },
      },
    },
    {
      agentId: 'sa-07', name: '子 Agent · 隐私脱敏回归', parentItemId: 'item-3a55-019', depth: 2, status: 'cancelled',
      brief: {
        goal: '回归四类 PII 的脱敏与拒绝写入行为。',
        acceptance: ['手机号/邮箱脱敏', '证件/密钥拒绝并留事件'],
        known: ['PII 检测为写入前必过链路'],
        constraints: ['使用合成样本，禁止真实 PII'],
        refs: ['doc://harness/10-memory-system#chunk=57@v10'],
        banned: ['禁止使用真实用户数据'],
      },
      tools: ['read_file', 'run_tests'],
      budget: { tokenLimit: 40_000, usedTokens: 9_800, stepLimit: 20, usedSteps: 6, timeLimitMin: 10 },
      isolation: '选择性继承：仅注入合成样本集',
      returnContract: null,
    },
    {
      agentId: 'sa-08', name: '子 Agent · 审计留存核验', parentItemId: 'item-0b12-007', depth: 1, status: 'succeeded',
      brief: {
        goal: '核验模型调用审计快照的脱敏与 90 天留存策略是否生效。',
        acceptance: ['快照不含明文 prompt 中的密钥', 'TTL = 90 天且可合规删除'],
        known: ['审计保留策略 mem-o-02'],
        constraints: ['只读核验；合规删除需合规管理员执行'],
        refs: ['org://policies/audit-v2@v2', 'kb://kch-010'],
        banned: ['禁止导出审计正文'],
      },
      tools: ['read_file', 'policy_eval'],
      budget: { tokenLimit: 50_000, usedTokens: 38_100, stepLimit: 24, usedSteps: 17, timeLimitMin: 12 },
      isolation: '选择性继承：仅注入策略引用与抽样清单',
      returnContract: {
        conclusion: '抽样 200 条快照：0 条含明文密钥；TTL 生效；合规删除探针成功穿透 6 层。',
        evidence: ['抽样报告：audit-verify-77aa', '删除证明：proof-3c91（含 6 层穿透记录）'],
        artifacts: ['artifact://reports/audit-verify-77aa.json'],
        openQuestions: [],
        confidence: '高',
        usage: { tokens: 38_100, cost: 0.29, durationMs: 288_000 },
      },
    },
  ];

  /* ---------- 内核：并行扇出（含同文件写冲突前置拦截） ---------- */
  const fanout: Fanout[] = [
    {
      batchId: 'fan-01', goal: '记忆中心 10 页实现（并行扇出后汇总）',
      subtasks: [
        { taskId: 'st-01', title: 'E-01/E-02 记忆中心与详情', agent: 'sa-03', budgetTokens: 60_000, files: ['src/views/memory/MemoryCenter.vue', 'src/views/memory/MemoryDetail.vue'], status: 'succeeded' },
        { taskId: 'st-02', title: 'E-03/E-04 写入确认与召回调试', agent: 'sa-03', budgetTokens: 60_000, files: ['src/views/memory/MemoryProposal.vue', 'src/views/memory/RecallDebug.vue'], status: 'succeeded' },
        { taskId: 'st-03', title: 'E-05/E-06 冲突处理与文件化同步', agent: 'sa-06', budgetTokens: 50_000, files: ['src/views/memory/MemoryConflict.vue', 'src/views/memory/MemoryFiles.vue'], status: 'succeeded' },
        { taskId: 'st-04', title: 'E-09/E-10 隐私与质量（写冲突演示）', agent: 'sa-07', budgetTokens: 50_000, files: ['src/mock/data/knowledge.ts'], status: 'blocked' },
        { taskId: 'st-05', title: '数据模块统一收敛', agent: 'sa-03', budgetTokens: 40_000, files: ['src/mock/data/knowledge.ts'], status: 'succeeded' },
      ],
      conflicts: [{ file: 'src/mock/data/knowledge.ts', agents: ['sa-07', 'sa-03'] }],
      merged: false, dedupedCount: 7,
      budgetAllocation: { total: 260_000, allocated: 220_000, reserved: 40_000 },
    },
    {
      batchId: 'fan-02', goal: '知识库 9 页实现（进行中）',
      subtasks: [
        { taskId: 'st-11', title: 'W-01/W-02 源管理与索引状态', agent: 'sa-06', budgetTokens: 70_000, files: ['src/views/knowledge/SourceManager.vue', 'src/views/knowledge/IndexStatus.vue'], status: 'running' },
        { taskId: 'st-12', title: 'W-03/W-04 检索工作台与引用', agent: 'sa-02', budgetTokens: 80_000, files: ['src/views/knowledge/SearchWorkbench.vue', 'src/views/knowledge/CitationViewer.vue'], status: 'running' },
        { taskId: 'st-13', title: 'W-08 符号图', agent: 'sa-06', budgetTokens: 50_000, files: ['src/views/knowledge/SymbolGraph.vue'], status: 'queued' },
      ],
      conflicts: [], merged: false, dedupedCount: 0,
      budgetAllocation: { total: 300_000, allocated: 200_000, reserved: 100_000 },
    },
  ];

  /* ---------- 内核：三级验证（含未验证项） ---------- */
  const verification: Verification[] = [
    {
      level: 'L1 静态',
      items: [
        { name: 'TypeScript 严格模式编译（vue-tsc）', ok: true, evidence: '命令：npx vue-tsc --noEmit -p tsconfig.app.json → 本域文件 0 error' },
        { name: 'Java 模块编译', ok: true, evidence: '命令：mvn -pl open-coding-domain -am compile → BUILD SUCCESS' },
        { name: '迁移脚本语法检查', ok: true, evidence: '命令：flyway validate → 无语法错误' },
      ],
    },
    {
      level: 'L2 可执行',
      items: [
        { name: '记忆域单测（写入候选/冲突/删除）', ok: true, evidence: '命令：mvn -pl open-coding-domain test -Dtest=Memory* → 42 passed' },
        { name: '索引增量延迟 ≤ 30s', ok: false, evidence: '实测 47s（大仓抽样 3 次，其中 2 次超阈值）' },
        { name: '越权探测：不可检索告知与计数侧信道', ok: true, evidence: '命令：probe -s cross_tenant → 返回 0 条内容 + 已过滤 N 条计数' },
      ],
    },
    {
      level: 'L3 语义',
      items: [
        { name: '验收标准逐条核对（记忆四层）', ok: true, evidence: '24 条条目覆盖四层，每条含来源与版本链' },
        { name: '知识问答强制引用', ok: true, evidence: '9 条结果全部带 citation；无依据场景返回「未找到依据」' },
        { name: '完成声明附证据（内核）', ok: true, evidence: '子 Agent 返回契约 6 份均含 evidence 列表' },
        { name: '文档漂移自动修订质量', ok: false, evidence: '未验证：人工校订段落保护规则缺少端到端用例' },
      ],
    },
  ];

  /* ---------- 内核：循环防护（三重上限 + 漂移 + 越界摘要） ---------- */
  const guard: LoopGuard = {
    limits: { steps: 120, durationMs: 3_600_000, cost: 8 },
    used: { steps: 96, durationMs: 2_340_000, cost: 6.42 },
    progress: 0.72,
    repeatedActions: [
      { tool: 'grep_search', args: '"DirectByteBuffer" --include=*.java', count: 6 },
      { tool: 'read_file', args: 'src/main/java/com/hk/payment/PaymentService.java --range=1-200', count: 4 },
    ],
    driftScore: 0.34,
    outOfBoundsSummary: {
      what: '同一工具 + 相同参数重复 6 次（超过阈值 5），且目标漂移分 0.34（阈值 0.3）',
      blockedAt: 'step 96（安全点：一次工具调用结束后）',
      nextStep: '暂停并请求决策：① 继续并放宽重复阈值 ② 调整为严格计划模式 ③ 停止并保留已完成部分',
    },
  };

  /* ---------- 内核：检查点与轨迹 ---------- */
  const checkpoints: Checkpoint[] = [
    { checkpointId: 'ckpt-01', stepNo: 12, at: r.agoHours(3), sideEffects: 2, note: '索引配置读取完成，尚未写入', restorable: true },
    { checkpointId: 'ckpt-02', stepNo: 34, at: r.agoHours(2), sideEffects: 5, note: '迁移脚本 dry-run 通过', restorable: true },
    { checkpointId: 'ckpt-03', stepNo: 58, at: r.agoHours(1), sideEffects: 9, note: '数据模块写入（可回滚到该点）', restorable: true },
    { checkpointId: 'ckpt-04', stepNo: 77, at: r.ago(40), sideEffects: 12, note: '子 Agent 扇出前快照', restorable: true },
    { checkpointId: 'ckpt-05', stepNo: 96, at: r.ago(12), sideEffects: 14, note: '上限触发点（暂停状态）', restorable: false },
  ];

  const trajectory: TrajectoryItem[] = [
    { seq: 1, phase: '解析', at: r.agoHours(4), summary: '识别意图：实现记忆/知识/内核三域页面，明确验收标准', evidence: '意图清单 3 条 + 验收标准 12 条' },
    { seq: 2, phase: '评估', at: r.agoHours(4), summary: '复杂度评估：跨 3 域、26 页面、涉及 1 个共享数据模块 → 采用严格计划', evidence: '计划深度=严格；建议自主度=协作' },
    { seq: 3, phase: '规划', at: r.agoHours(4), summary: '产出计划：数据模块 → 路由 → 页面批次（含并行扇出）', evidence: 'plan-7c31（26 个任务项）' },
    { seq: 4, phase: '执行', at: r.agoHours(3), summary: '落数据模块知识三域数据（24 条记忆/12 源/27 块）', evidence: 'artifact://reports/data-module-check.json' },
    { seq: 5, phase: '执行', at: r.agoHours(2), summary: '并行扇出 5 个子任务，汇总去重 7 处', evidence: 'fan-01 结果契约 5 份' },
    { seq: 6, phase: '反思', at: r.agoHours(2), summary: '反思：共享数据文件存在写冲突风险 → 改为串行化并前置拦截', evidence: 'conflicts 1 条（knowledge.ts）' },
    { seq: 7, phase: '执行', at: r.agoHours(1), summary: '页面批次 2：知识库 9 页（检索/引用/符号图）', evidence: 'batch fan-02（3 子任务）' },
    { seq: 8, phase: '验证', at: r.ago(50), summary: 'L1 静态通过；L2 索引延迟未达标（47s > 30s）', evidence: 'verification.L2 第 2 项 ok=false' },
    { seq: 9, phase: '验证', at: r.ago(30), summary: 'L3 语义：文档漂移自动修订未验证，已显式标注', evidence: 'verification.L3 第 4 项 ok=false' },
    { seq: 10, phase: '收尾', at: r.ago(10), summary: '上限触发暂停：输出「做了什么/卡在哪/建议下一步」摘要，等待决策', evidence: 'guard.outOfBoundsSummary' },
  ];

  return {
    memory: { entries, proposals, recallDebug, conflicts, files, deletions, orgGovernance, privacy, qualityMetrics },
    knowledge: { sources, chunks, indexJobs, searchResults, queryTrace, wikiPages, staleFindings, governance: knowledgeGovernance },
    agent: { definitions, subagents, fanout, verification, guard, checkpoints, trajectory },
  };
}

/** 全站固定种子：刷新后数据一致（契约 §3） */
export const knowledgeData = buildKnowledgeData(new Rng(20261011));

/** 说明性常量：三域共用的负样本清单（自审可核对「异常态演示」是否齐全） */
export const NEGATIVE_SAMPLES = [
  '记忆：冲突 mem-cft-02/mcf-04（未决，高严重度）',
  '记忆：文件漂移 arch-decisions.md（以文件为准）',
  '记忆：合规删除 RUNNING（穿透 6 层未完成）',
  '记忆：PII 拒绝写入（密钥类）',
  '知识：索引任务 FAILED（解析器异常，可断点续传）',
  '知识：语义路降级（符号索引重建中）',
  '知识：越权过滤 7 条（计数不泄露内容）',
  '内核：Agent 定义权限收窄校验失败（拒绝装载）',
  '内核：子 Agent 失败/取消（错误不炸父）',
  '内核：循环防护上限触发（暂停 + 摘要）',
] as const;

/** 数据自检：数量（由数据自身派生，避免与实际漂移） */
export const DATA_STATS = {
  memoryEntries: knowledgeData.memory.entries.length,
  memoryProposals: knowledgeData.memory.proposals.length,
  knowledgeSources: knowledgeData.knowledge.sources.length,
  knowledgeChunks: knowledgeData.knowledge.chunks.length,
  wikiPages: knowledgeData.knowledge.wikiPages.length,
  agentDefinitions: knowledgeData.agent.definitions.length,
  subagents: knowledgeData.agent.subagents.length,
};
