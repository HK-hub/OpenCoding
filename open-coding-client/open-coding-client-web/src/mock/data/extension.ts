/**
 * 扩展体系域 mock 数据：技能（卷 08）/ MCP（卷 09）/ Hooks（卷 17）/ 插件与扩展点（卷 18）。
 * 四子域以 id 互相关联：技能依赖工具（含 `mcp:` 命名空间工具），插件携带技能与钩子实现，
 * 钩子点取自卷 17 的 8 类目录，扩展点目录取自卷 18 §4.1（22 域 / 100+ 点）。
 */
import { Rng, NAMES } from '../rng';

/* ============================== 技能（卷 08） ============================== */

export type SkillScope = 'builtin' | 'org' | 'project' | 'user';
/** 四源发现（优先级 低→高：内置 → 组织 → 项目 → 用户） */
export type SkillSourceKind = 'builtin' | 'org-registry' | 'project-dir' | 'user-dir';
export type SkillInstallState = 'Discovered' | 'Installed' | 'Active' | 'Inactive' | 'Disabled' | 'Updated' | 'Removed';
export type SkillActivationState = 'active' | 'inactive' | 'suggested';
/** 触发条件：文件模式 / 命令前缀 / 模式 / 事件 / 关键词 */
export type TriggerKind = 'file-pattern' | 'command-prefix' | 'mode' | 'event' | 'keyword';
/** 权限六档（技能建议只可收窄，不可放宽） */
export type PermissionMode = 'readonly' | 'plan' | 'default' | 'acceptEdits' | 'autonomous' | 'yolo';
export type SignatureState = 'verified' | 'unsigned' | 'invalid';

export interface SkillSignature {
  state: SignatureState;
  signer: string;
  algorithm: string;
  signedAt: string | null;
  fingerprint: string;
  /** 校验失败/未签名时的显式处置说明（拒绝装载，不静默） */
  reason?: string;
}

export interface SkillTrigger { kind: TriggerKind; value: string }

export interface SkillCapabilities {
  networkDomains: string[];
  commandExecution: boolean;
  fileWriteScopes: string[];
  secretRefs: string[];
  subagent: boolean;
}

export interface SkillEvalCase {
  id: string;
  name: string;
  input: string;
  expect: string;
  status: 'passed' | 'failed' | 'skipped' | 'not-run';
  cost: number;
  durationMs: number;
  lastRun: string | null;
}

export interface SkillEval {
  entry: string;
  gate: { metric: string; threshold: number; actual: number; met: boolean };
  cases: SkillEvalCase[];
  baselineMetrics: { passRate: number; costPerRun: number; durationMs: number; sampleRuns: number };
}

export interface SkillStats {
  activationCount: number;
  successRate: number;
  costPerRun: number;
  durationMs: number;
  userFeedback: { up: number; down: number };
  /** 与「无技能基线」对比的成功率（SkillMetrics 劣化判定依据） */
  baselineSuccessRate: number;
  trend: number[];
}

export interface SkillResource { path: string; kind: 'checklist' | 'example' | 'reference' | 'code' | 'script'; bytes: number; tokens: number }
export interface SkillVersionEntry { version: string; at: string; note: string; breaking: boolean }
export interface SkillDiffLine { type: 'add' | 'del' | 'ctx'; oldLine?: number; newLine?: number; text: string }
export interface SkillInstructionDiff { path: string; additions: number; deletions: number; lines: SkillDiffLine[] }

export interface SkillSuggestion {
  reason: string;
  trigger: string;
  evidence: string;
  confidence: number;
  source: string;
  decision: 'pending' | 'accepted' | 'ignored';
  at: string;
}

export interface SkillData {
  id: string;
  /** 命名空间式 `org.team.skill-name` */
  name: string;
  version: string;
  description: string;
  scope: SkillScope;
  source: SkillSourceKind;
  sourcePath: string;
  owner: string;
  compatibility: { kernelRange: string; modelCapabilities: string[] };
  triggers: SkillTrigger[];
  capabilities: SkillCapabilities;
  tools: { required: string[]; optional: string[] };
  permissions: { recommendedMode: PermissionMode; narrowOnly: true };
  acceptance: string[];
  eval: SkillEval;
  signature: SkillSignature;
  installState: SkillInstallState;
  activationState: SkillActivationState;
  enabled: boolean;
  dependencies: string[];
  dependents: string[];
  lockFile: string;
  stats: SkillStats;
  mainInstructionTokens: number;
  activationReason: string;
  suggestion: SkillSuggestion | null;
  resources: SkillResource[];
  instructionDiff: SkillInstructionDiff;
  versionHistory: SkillVersionEntry[];
  /** 拒绝装载/拒绝激活的结构化原因（签名 / 兼容 / 必需工具缺失） */
  blockedReason?: string;
  missingRequiredTools?: string[];
  /** 劣化（成功率低于无技能基线）→ 自动降级为「建议」 */
  degraded: boolean;
}

interface SkillSeed {
  name: string;
  version: string;
  desc: string;
  scope: SkillScope;
  source: SkillSourceKind;
  state: SkillInstallState;
  activation: SkillActivationState;
  enabled: boolean;
  sig: SignatureState;
  signer?: string;
  mode: PermissionMode;
  kernel: string;
  modelCaps: string[];
  triggers: SkillTrigger[];
  caps: Partial<SkillCapabilities>;
  required: string[];
  optional: string[];
  acceptance: string[];
  deps?: string[];
  dependents?: string[];
  tokens: number;
  reason: string;
  suggestion?: Omit<SkillSuggestion, 'at'> | null;
  blocked?: string;
  missing?: string[];
  degrade?: boolean;
  gate?: number;
}

const SKILL_SEEDS: SkillSeed[] = [
  {
    name: 'acme.platform.java-refactor', version: '2.4.1',
    desc: 'Java 服务重构助手：先建立分层与依赖事实，再给出最小改动清单，禁止跨层直接写库。',
    scope: 'project', source: 'project-dir', state: 'Active', activation: 'active', enabled: true, sig: 'verified',
    mode: 'acceptEdits', kernel: '>=1.2 <2.0', modelCaps: ['tools', 'thinking'],
    triggers: [{ kind: 'file-pattern', value: '**/*.java' }, { kind: 'keyword', value: '重构|分层|循环依赖' }, { kind: 'mode', value: 'coding' }],
    caps: { commandExecution: true, fileWriteScopes: ['src/main/java/**', 'src/test/java/**'], subagent: true },
    required: ['read_file', 'edit_file', 'run_command'], optional: ['kb_search', 'code_search'],
    acceptance: ['公开 API 签名未变更', '分层依赖方向检查通过（domain ← application）', '单测全绿且覆盖不降'],
    deps: ['opencoding.core.java-conventions@^1.0'], dependents: ['acme.platform.db-migration-guard@^2.0'],
    tokens: 4120, reason: '匹配到 **/*.java 且会话模式为 coding，由项目级触发器激活',
    suggestion: { reason: '检测到当前任务为 Java 分层改造', trigger: 'file-pattern: **/*.java', evidence: 'EV-2180 项目知识页「分层约定」+ 近 30 天 42 次成功执行', confidence: 0.86, source: 'project-dir', decision: 'accepted' },
    gate: 0.92,
  },
  {
    name: 'acme.platform.dockerfile-hardening', version: '1.9.0',
    desc: '容器镜像加固：多阶段构建、非 root 运行、最小基础镜像与依赖锁定建议。',
    scope: 'project', source: 'project-dir', state: 'Active', activation: 'active', enabled: true, sig: 'verified',
    mode: 'acceptEdits', kernel: '>=1.1', modelCaps: ['tools'],
    triggers: [{ kind: 'file-pattern', value: '**/Dockerfile*' }, { kind: 'file-pattern', value: '**/*.dockerfile' }],
    caps: { commandExecution: true, fileWriteScopes: ['**/Dockerfile*'], networkDomains: ['registry.internal.acme.com'], subagent: false },
    required: ['read_file', 'edit_file'], optional: ['run_command', 'web_fetch'],
    acceptance: ['基础镜像固定 digest', '运行用户非 root', '镜像体积变化 ≤ +5%'],
    deps: [], dependents: [],
    tokens: 2860, reason: '编辑 Dockerfile 时由文件模式触发器激活',
    suggestion: null, gate: 0.9,
  },
  {
    name: 'acme.qa.api-contract-test', version: '3.1.2',
    desc: '接口契约测试生成：从 OpenAPI 快照生成边界用例，标注不可验证项。',
    scope: 'org', source: 'org-registry', state: 'Installed', activation: 'inactive', enabled: true, sig: 'verified',
    mode: 'default', kernel: '>=1.0', modelCaps: ['tools'],
    triggers: [{ kind: 'command-prefix', value: 'oc test contract' }, { kind: 'keyword', value: '契约|OpenAPI|边界用例' }],
    caps: { commandExecution: true, fileWriteScopes: ['src/test/**'], secretRefs: ['acme.qa.token'] },
    required: ['read_file', 'write_file', 'run_command'], optional: ['mcp:acme-jira.search_issues'],
    acceptance: ['契约用例覆盖全部 4xx 分支', '失败用例附最小复现命令'],
    deps: [], dependents: ['acme.qa.coverage-gate@^1.0'],
    tokens: 5340, reason: '组织级推荐：接口类任务命中关键词，等待用户确认',
    suggestion: { reason: '检测到新增 REST 端点但无契约测试', trigger: 'keyword: 契约', evidence: 'EV-3112 近 14 天 3 次同类任务均补测', confidence: 0.74, source: 'org-registry', decision: 'pending' },
    gate: 0.88,
  },
  {
    name: 'acme.sec.secret-scan', version: '2.0.5',
    desc: '提交前密钥与凭证扫描：命中即阻断提交并给出替换为 SecretPort 引用的修复步骤。',
    scope: 'org', source: 'org-registry', state: 'Active', activation: 'active', enabled: true, sig: 'verified',
    mode: 'plan', kernel: '>=1.0', modelCaps: ['tools'],
    triggers: [{ kind: 'event', value: 'git.commit.before' }, { kind: 'file-pattern', value: '**/*.{env,yaml,yml,properties}' }],
    caps: { commandExecution: true, fileWriteScopes: [], secretRefs: ['acme.scan.rulepack'] },
    required: ['read_file', 'run_command'], optional: ['edit_file'],
    acceptance: ['高危命中 0 条', '中危命中均给出修复路径', '扫描耗时 ≤ 3s'],
    deps: [], dependents: ['acme.platform.java-refactor@^2.0'],
    tokens: 1980, reason: 'git.commit.before 事件触发器激活（组织安全类，下级不可禁用）',
    suggestion: null, gate: 0.95,
  },
  {
    name: 'acme.frontend.a11y-audit', version: '1.4.0',
    desc: '前端无障碍审计：对比度、可达名称、键盘路径与焦点顺序逐项出证。',
    scope: 'user', source: 'user-dir', state: 'Inactive', activation: 'inactive', enabled: true, sig: 'verified',
    mode: 'default', kernel: '>=1.2', modelCaps: ['tools', 'vision'],
    triggers: [{ kind: 'keyword', value: '无障碍|a11y|对比度' }, { kind: 'file-pattern', value: '**/*.vue' }],
    caps: { commandExecution: true, fileWriteScopes: [], networkDomains: [] },
    required: ['read_file', 'run_command'], optional: ['screenshot', 'edit_file'],
    acceptance: ['四类问题各出证据（截图或 DOM 片段）', '不可判定项显式标注'],
    deps: [], dependents: [], tokens: 3260, reason: '用户级技能，需显式调用 `/acme.frontend.a11y-audit`', suggestion: null, gate: 0.85,
  },
  {
    name: 'opencoding.core.sql-tuning', version: '4.2.0',
    desc: 'SQL 性能诊断（内置）：执行计划解读、索引建议与回归基线对比。',
    scope: 'builtin', source: 'builtin', state: 'Active', activation: 'active', enabled: true, sig: 'verified',
    mode: 'readonly', kernel: '>=1.0', modelCaps: ['tools'],
    triggers: [{ kind: 'keyword', value: '慢查询|执行计划|索引' }, { kind: 'command-prefix', value: 'oc db explain' }],
    caps: { commandExecution: true, fileWriteScopes: [], networkDomains: [] },
    required: ['read_file', 'run_command'], optional: ['mcp:postgres-ro.query'],
    acceptance: ['给出前后执行计划对比', '索引建议附写入放大评估'],
    deps: [], dependents: [], tokens: 3760, reason: '内置技能，命中关键词后按建议激活', suggestion: null, gate: 0.9,
  },
  {
    name: 'opencoding.core.incident-postmortem', version: '1.7.3',
    desc: '事故复盘撰写（内置）：时间线、影响面、根因与改进项四段式，改进必须落到代码或配置。',
    scope: 'builtin', source: 'builtin', state: 'Active', activation: 'active', enabled: true, sig: 'verified',
    mode: 'default', kernel: '>=1.0', modelCaps: ['tools'],
    triggers: [{ kind: 'event', value: 'system.ready.after' }, { kind: 'keyword', value: '复盘|postmortem|根因' }],
    caps: { commandExecution: false, fileWriteScopes: ['docs/postmortem/**'] },
    required: ['read_file', 'write_file'], optional: ['kb_search'],
    acceptance: ['时间线每项带事件来源引用', '改进项有负责人与截止时间'],
    deps: [], dependents: [], tokens: 2440, reason: '命中关键词「复盘」，建议激活', suggestion: null, gate: 0.86,
  },
  {
    name: 'acme.data.pipeline-migration', version: '0.9.1',
    desc: '数仓迁移助手：ODPS 方言转换与分区策略迁移，分批验证。',
    scope: 'org', source: 'org-registry', state: 'Disabled', activation: 'inactive', enabled: false, sig: 'unsigned',
    mode: 'default', kernel: '>=1.2', modelCaps: ['tools'],
    triggers: [{ kind: 'keyword', value: 'ODPS|数仓|分区迁移' }],
    caps: { commandExecution: true, fileWriteScopes: ['sql/**'], networkDomains: ['odps.internal.acme.com'] },
    required: ['read_file', 'run_command'], optional: ['edit_file'],
    acceptance: ['分批迁移每批可回滚', '方言转换差异逐条列出'],
    deps: [], dependents: [], tokens: 6120, reason: '已由管理员禁用：未签名技能（企业策略：私仓强制签名）',
    suggestion: null, gate: 0.8,
  },
  {
    name: 'acme.platform.k8s-basics', version: '1.2.0',
    desc: 'K8s 基础操作：命名空间内只读巡检与 Deployment 变更前预检。',
    scope: 'project', source: 'project-dir', state: 'Installed', activation: 'inactive', enabled: true, sig: 'verified',
    mode: 'plan', kernel: '>=1.2', modelCaps: ['tools'],
    triggers: [{ kind: 'file-pattern', value: '**/k8s/**/*.yaml' }, { kind: 'keyword', value: 'Pod|Deployment|Helm' }],
    caps: { commandExecution: true, fileWriteScopes: ['k8s/**'], networkDomains: ['k8s-api.internal.acme.com'], secretRefs: ['acme.k8s.token'] },
    required: ['read_file', 'run_command'], optional: ['mcp:k8s-gateway.list_pods', 'mcp:k8s-gateway.get_logs'],
    acceptance: ['变更前输出资源差异', '预检失败不给出发布命令'],
    deps: [], dependents: ['com.acme.k8s-ops'], tokens: 3480, reason: '被插件 com.acme.k8s-ops 依赖，随插件装配待激活', suggestion: null, gate: 0.87,
  },
  {
    name: 'acme.ai.prompt-eval', version: '2.2.0',
    desc: '提示词回归评测：对改版提示词跑固定用例集，输出通过率与成本回归。',
    scope: 'org', source: 'org-registry', state: 'Active', activation: 'active', enabled: true, sig: 'verified',
    mode: 'default', kernel: '>=1.2', modelCaps: ['tools', 'structured_output'],
    triggers: [{ kind: 'file-pattern', value: '**/prompts/**/*.md' }, { kind: 'event', value: 'prompt.asset.updated' }],
    caps: { commandExecution: true, fileWriteScopes: ['prompts/reports/**'], networkDomains: ['api.internal.acme.com'], secretRefs: ['acme.eval.gatewayKey'] },
    required: ['read_file', 'write_file', 'run_command'], optional: ['mcp:internal-search.search'],
    acceptance: ['基线对比含成本与延迟两项', '通过率下降 ≥2% 时阻断发布'],
    deps: ['acme.ai.prompt-assets@^1.0'], dependents: [], tokens: 4880, reason: '对话资产更新事件触发（自动激活已开启）',
    suggestion: { reason: '提示词文件变更，建议跑回归门禁', trigger: 'event: prompt.asset.updated', evidence: 'EV-4402 上次改版通过率 -3.1%', confidence: 0.81, source: 'org-registry', decision: 'accepted' },
    gate: 0.93,
  },
  {
    name: 'community.react.perf-profiler', version: '1.1.0',
    desc: 'React 渲染性能剖析：定位不必要重渲染并给出最小修复补丁。',
    scope: 'user', source: 'user-dir', state: 'Discovered', activation: 'inactive', enabled: false, sig: 'unsigned',
    mode: 'default', kernel: '>=1.3', modelCaps: ['tools'],
    triggers: [{ kind: 'keyword', value: '重渲染|useMemo|性能剖析' }],
    caps: { commandExecution: true, fileWriteScopes: ['src/**'], networkDomains: ['registry.npmjs.org'] },
    required: ['read_file', 'run_command'], optional: ['edit_file'],
    acceptance: ['给出渲染次数前后对比', '补丁不得改变组件对外行为'],
    deps: [], dependents: [], tokens: 3020, reason: '社区技能未签名：企业策略要求签名后方可安装（可改从私仓获取已签名版本）',
    blocked: '签名未验证：来源 user-dir 且无签名，按企业策略「私仓强制签名」拒绝安装',
    suggestion: null, gate: 0.82,
  },
  {
    name: 'community.speedrun.mega-edits', version: '0.1.0',
    desc: '「极速批量改文件」：跳过预检批量改写仓库文件。',
    scope: 'user', source: 'user-dir', state: 'Discovered', activation: 'inactive', enabled: false, sig: 'invalid',
    mode: 'yolo', kernel: '>=1.0', modelCaps: ['tools'],
    triggers: [{ kind: 'keyword', value: '批量改|一键重写' }],
    caps: { commandExecution: true, fileWriteScopes: ['**/*'], networkDomains: ['unknown-cdn.example'] },
    required: ['write_file', 'run_command'], optional: [],
    acceptance: ['（未声明）'],
    deps: [], dependents: [], tokens: 640, reason: '签名校验失败：公钥信任链不匹配，装载期已隔离并记录事件',
    blocked: '签名校验失败：fingerprint 与发布者公钥不匹配（可能被篡改），已隔离该技能并告警',
    suggestion: null, gate: 0.5,
  },
  {
    name: 'acme.platform.db-migration-guard', version: '2.1.0',
    desc: '数据库迁移护栏：破坏性语句拦截、回滚脚本强制与锁表时长预估。',
    scope: 'org', source: 'org-registry', state: 'Updated', activation: 'active', enabled: true, sig: 'verified',
    mode: 'plan', kernel: '>=1.1', modelCaps: ['tools'],
    triggers: [{ kind: 'file-pattern', value: '**/db/migration/**/*.sql' }, { kind: 'event', value: 'git.commit.before' }],
    caps: { commandExecution: true, fileWriteScopes: ['db/migration/**'], secretRefs: ['acme.db.readonly'] },
    required: ['read_file', 'run_command'], optional: ['mcp:postgres-ro.query'],
    acceptance: ['破坏性语句必须附逆向脚本', '锁表预估 >30s 时要求分批方案'],
    deps: ['acme.platform.java-refactor@^2.0'], dependents: [], tokens: 4260, reason: 'v2.1.0 已就绪，等待版本锁定更新（当前运行 2.0.4）',
    suggestion: null, gate: 0.91,
  },
  {
    name: 'acme.mobile.flutter-tests', version: '1.0.3',
    desc: 'Flutter 测试补齐：Widget 测试 + 金丝雀截图对比，标注平台差异。',
    scope: 'project', source: 'project-dir', state: 'Installed', activation: 'inactive', enabled: true, sig: 'verified',
    mode: 'acceptEdits', kernel: '>=1.2', modelCaps: ['tools', 'vision'],
    triggers: [{ kind: 'file-pattern', value: '**/*_test.dart' }, { kind: 'command-prefix', value: 'flutter test' }],
    caps: { commandExecution: true, fileWriteScopes: ['test/**'], networkDomains: [] },
    required: ['read_file', 'write_file', 'run_command'], optional: ['screenshot'],
    acceptance: ['新增用例覆盖失败分支', '截图基线变更需显式确认'],
    deps: [], dependents: [], tokens: 2680, reason: '项目级技能，命中 Dart 测试文件模式时建议激活', suggestion: null, gate: 0.84,
  },
  {
    name: 'opencoding.core.git-commit-norm', version: '1.3.2',
    desc: '提交信息规范（内置）：Conventional Commits + 结构化尾注（会话/任务/模型/审批）。',
    scope: 'builtin', source: 'builtin', state: 'Active', activation: 'active', enabled: true, sig: 'verified',
    mode: 'default', kernel: '>=1.0', modelCaps: [],
    triggers: [{ kind: 'event', value: 'git.commit.before' }],
    caps: { commandExecution: true, fileWriteScopes: [] },
    required: ['run_command'], optional: ['read_file'],
    acceptance: ['提交信息含范围与动机', '尾注包含会话与任务编号'],
    deps: [], dependents: [], tokens: 1240, reason: 'git.commit.before 事件触发器激活（内置默认开启）', suggestion: null, gate: 0.96,
  },
  {
    name: 'acme.finance.reconcile-report', version: '3.0.0',
    desc: '对账差异分析：逐笔勾兑、差异归因与人工复核清单。',
    scope: 'org', source: 'org-registry', state: 'Active', activation: 'active', enabled: true, sig: 'verified',
    mode: 'default', kernel: '>=1.1', modelCaps: ['tools'],
    triggers: [{ kind: 'keyword', value: '对账|差异|勾兑' }, { kind: 'event', value: 'workitem.state.changed.after' }],
    caps: { commandExecution: true, fileWriteScopes: ['reports/reconcile/**'], secretRefs: ['acme.finance.db'] },
    required: ['read_file', 'run_command'], optional: ['mcp:postgres-ro.query'],
    acceptance: ['差异归因覆盖率 100%', '未归因项进入人工复核清单'],
    deps: [], dependents: [], tokens: 4640, reason: '命中关键词「对账」自动激活（用户已开启该技能自动激活）',
    suggestion: null, degrade: true, gate: 0.9,
  },
];

const RESOURCE_POOL: { path: string; kind: SkillResource['kind'] }[] = [
  { path: 'checklist.md', kind: 'checklist' },
  { path: 'examples/good-case.md', kind: 'example' },
  { path: 'examples/bad-case.md', kind: 'example' },
  { path: 'reference/conventions.md', kind: 'reference' },
  { path: 'scripts/prepare.sh', kind: 'script' },
  { path: 'templates/report.md', kind: 'code' },
];

const EVAL_CASE_NAMES = [
  { name: '正向：标准输入', expect: '按验收清单输出，无越权工具调用' },
  { name: '边界：空输入', expect: '明确拒绝并给出可执行替代路径' },
  { name: '边界：超长上下文', expect: '触发资源引用而非全量注入' },
  { name: '负向：缺失必需工具', expect: '拒绝激活并列出缺失工具' },
  { name: '负向：越权路径写入', expect: '显式拒绝 + 审计事件，不静默降级' },
  { name: '回归：基线对比', expect: '通过率与成本不劣于基线 ±5%' },
];

/** 生成技能指令 diff（用于「指令预览」Tab，走 DiffView 渲染） */
function instructionDiff(name: string, version: string): SkillInstructionDiff {
  const lines: SkillDiffLine[] = [
    { type: 'ctx', oldLine: 1, newLine: 1, text: `# ${name}@${version}` },
    { type: 'ctx', oldLine: 2, newLine: 2, text: '## 过程知识' },
    { type: 'ctx', oldLine: 3, newLine: 3, text: '- 先建立事实：读约束、读既有实现、读验收清单；禁止直接大范围改写' },
    { type: 'del', oldLine: 4, text: '- 输出问题清单，逐条列出' },
    { type: 'add', newLine: 4, text: '- 输出问题清单：按文件聚合、每项附证据引用（repo:// 行号 + 哈希）' },
    { type: 'ctx', oldLine: 5, newLine: 5, text: '## 决策规则' },
    { type: 'del', oldLine: 6, text: '- 无法判定时要求用户输入' },
    { type: 'add', newLine: 6, text: '- 无法判定时先给 2 个候选方案与影响面，再请求用户输入（禁止猜测）' },
    { type: 'add', newLine: 7, text: '- 越权或越界路径一律显式拒绝，并记录 skill.capability.denied 审计' },
    { type: 'ctx', oldLine: 7, newLine: 8, text: '## 输出规范' },
    { type: 'ctx', oldLine: 8, newLine: 9, text: '- 结论 → 证据 → 未验证项，三段式' },
  ];
  return { path: `skills/${name}/skill.md`, additions: 3, deletions: 2, lines };
}

function buildSkills(r: Rng): SkillData[] {
  return SKILL_SEEDS.map((seed, idx) => {
    const caseCount = r.int(4, 6);
    const cases: SkillEvalCase[] = EVAL_CASE_NAMES.slice(0, caseCount).map((c, i) => {
      const failed = seed.degrade && i === 0;
      const status: SkillEvalCase['status'] = seed.state === 'Discovered' ? 'not-run' : failed ? 'failed' : i === caseCount - 1 && r.bool(0.25) ? 'skipped' : 'passed';
      return {
        id: `EV-${String(idx + 1).padStart(2, '0')}${i + 1}`,
        name: c.name,
        input: `cases/${seed.name.split('.').pop()}-${i + 1}.json`,
        expect: c.expect,
        status,
        cost: r.float(0.004, 0.06, 4),
        durationMs: r.int(1800, 42_000),
        lastRun: status === 'not-run' ? null : r.agoHours(r.int(1, 96)),
      };
    });
    const passed = cases.filter((c) => c.status === 'passed').length;
    const actual = Number((passed / Math.max(1, cases.length)).toFixed(2));
    const threshold = seed.gate ?? 0.9;
    const resources: SkillResource[] = RESOURCE_POOL.slice(0, r.int(3, 6)).map((p) => ({
      ...p,
      bytes: r.int(1200, 48_000),
      tokens: r.int(180, 4200),
    }));
    const [maj, min] = seed.version.split('.').map(Number);
    const versionHistory: SkillVersionEntry[] = [
      { version: seed.version, at: r.agoDays(r.int(1, 20)), note: seed.degrade ? '新增差异归因覆盖率断言（回归失败 1 例）' : '指令分段与证据引用要求收紧', breaking: false },
      { version: `${maj}.${Math.max(0, min - 1)}.0`, at: r.agoDays(r.int(30, 90)), note: '兼容内核 1.2：适配新的触发器语义', breaking: false },
      { version: `${maj}.0.0`, at: r.agoDays(r.int(120, 260)), note: '首个稳定版（含能力声明与验收清单）', breaking: true },
    ];
    const stats: SkillStats = {
      activationCount: r.int(6, 320),
      successRate: seed.degrade ? r.float(52, 61, 1) : r.float(84, 97, 1),
      costPerRun: r.float(0.02, 1.4, 3),
      durationMs: r.int(12_000, 480_000),
      userFeedback: { up: r.int(8, 180), down: seed.degrade ? r.int(9, 24) : r.int(0, 7) },
      baselineSuccessRate: r.float(78, 88, 1),
      trend: Array.from({ length: 8 }, () => r.float(60, 98, 1)),
    };
    const signers: Record<SkillSourceKind, string> = {
      builtin: 'OpenCoding 官方（内置信任根）',
      'org-registry': '云枢科技 平台安全组',
      'project-dir': 'payment-core 维护者',
      'user-dir': '（未签名/本地自签）',
    };
    return {
      id: `SK-${String(idx + 1).padStart(2, '0')}`,
      name: seed.name,
      version: seed.version,
      description: seed.desc,
      scope: seed.scope,
      source: seed.source,
      sourcePath: seed.source === 'builtin' ? '内置（随产品）' : seed.source === 'org-registry' ? `${'oc://org-registry/skills/'}${seed.name}` : seed.source === 'project-dir' ? `.oc/skills/${seed.name.split('.').pop()}` : `~/.oc/skills/${seed.name.split('.').pop()}`,
      owner: NAMES[idx % NAMES.length],
      compatibility: { kernelRange: seed.kernel, modelCapabilities: seed.modelCaps },
      triggers: seed.triggers,
      capabilities: {
        networkDomains: seed.caps.networkDomains ?? [],
        commandExecution: seed.caps.commandExecution ?? false,
        fileWriteScopes: seed.caps.fileWriteScopes ?? [],
        secretRefs: seed.caps.secretRefs ?? [],
        subagent: seed.caps.subagent ?? false,
      },
      tools: { required: seed.required, optional: seed.optional },
      permissions: { recommendedMode: seed.mode, narrowOnly: true },
      acceptance: seed.acceptance,
      eval: {
        entry: `oc skill eval ${seed.name}`,
        gate: { metric: '用例通过率', threshold, actual, met: actual >= threshold },
        cases,
        baselineMetrics: { passRate: r.float(80, 92, 1), costPerRun: r.float(0.04, 0.9, 3), durationMs: r.int(20_000, 360_000), sampleRuns: r.int(12, 60) },
      },
      signature: {
        state: seed.sig,
        signer: seed.sig === 'verified' ? (seed.signer ?? signers[seed.source]) : seed.sig === 'unsigned' ? '（无签名）' : 'unknown-publisher',
        algorithm: 'Ed25519',
        signedAt: seed.sig === 'verified' ? r.agoDays(r.int(2, 120)) : null,
        fingerprint: seed.sig === 'verified' ? `9f:2c:${r.int(10, 99)}:${r.int(10, 99)}:ab:${r.int(10, 99)}:7d` : seed.sig === 'unsigned' ? '—' : '??:??:de:ad:be:ef',
        reason: seed.sig === 'invalid' ? '公钥信任链不匹配（fingerprint 与发布者公钥不一致）' : seed.sig === 'unsigned' ? '未签名：企业策略要求私仓技能必须签名' : undefined,
      },
      installState: seed.state,
      activationState: seed.activation,
      enabled: seed.enabled,
      dependencies: seed.deps ?? [],
      dependents: seed.dependents ?? [],
      lockFile: `skills/${seed.name}/skill.lock`,
      stats,
      mainInstructionTokens: seed.tokens,
      activationReason: seed.reason,
      suggestion: seed.suggestion ? { ...seed.suggestion, at: r.agoHours(r.int(1, 12)) } : null,
      resources,
      instructionDiff: instructionDiff(seed.name, seed.version),
      versionHistory,
      blockedReason: seed.blocked,
      missingRequiredTools: seed.missing,
      degraded: Boolean(seed.degrade),
    };
  });
}

/* ============================== MCP（卷 09） ============================== */

export type McpTransport = 'stdio' | 'http' | 'sse' | 'ws';
export type McpLifecycleMode = 'managed' | 'external' | 'cluster';
export type McpServerState = 'Configured' | 'Starting' | 'Ready' | 'Degraded' | 'Failed' | 'Stopped';
export type McpAuthMode = 'envKey' | 'oauthCode' | 'deviceCode' | 'serviceCredential';

export interface McpTool {
  rawName: string;
  namespace: string;
  alias: string;
  /** 风险提示 R0–R5（服务器声明 + 参数推断） */
  riskHint: string;
  conflictWithBuiltin: boolean;
  conflictNote?: string;
  desc: string;
  callCount: number;
  errorRate: number;
}

export interface McpCallLog {
  id: string;
  method: string;
  tool: string;
  paramsDigest: string;
  egressBytes: number;
  decisionRef: string;
  durationMs: number;
  status: 'ok' | 'error' | 'timeout' | 'denied' | 'circuit-open';
  retries: number;
  at: string;
}

export interface McpReverseRequest {
  id: string;
  type: 'sampling' | 'elicitation';
  detail: string;
  budgetImpact: string;
  userDecision: 'allowed' | 'asked' | 'denied' | 'queued';
  at: string;
}

export interface McpResource {
  uri: string;
  name: string;
  subscribed: boolean;
  lastChangedAt: string;
  /** roots 路径围栏内的可见范围 */
  rootsScope: string;
}

export interface McpServerData {
  serverId: string;
  name: string;
  transport: McpTransport;
  transportPriority: McpTransport[];
  lifecycleMode: McpLifecycleMode;
  state: McpServerState;
  stateReason: string;
  capabilitiesDiscovered: string[];
  tools: McpTool[];
  auth: { mode: McpAuthMode; tokenRef: string; scopes: string[]; expiresAt: string | null };
  configSource: 'org' | 'project' | 'user';
  configPath: string;
  limits: { timeoutMs: number; concurrencyMax: number; outputQuotaKb: number };
  circuitBreaker: { failures: number; windowSec: number; state: 'closed' | 'half-open' | 'open'; openAt: string | null; reason: string };
  health: { lastProbeAt: string; healthy: boolean; probeLatencyMs: number; consecutiveFailures: number };
  restart: { total: number; backoffSec: number; nextRetryAt: string | null };
  metrics: { latencyMs: number; p95Ms: number; errorTotal: number; restartTotal: number; egressBytes: number; callTotal: number; trend: number[] };
  resources: McpResource[];
  reverseRequests: McpReverseRequest[];
  callLogs: McpCallLog[];
  exposure: { readonlyTools: boolean; resources: boolean; prompts: boolean; writeTools: boolean; sessionControl: boolean; apiKeyRef: string; scope: string };
  sandboxTier: string;
  networkWhitelist: string[];
  gateway: boolean;
  diagnose: { step: string; ok: boolean; detail: string; ms: number }[];
}

interface McpSeed {
  id: string;
  name: string;
  transport: McpTransport;
  priority: McpTransport[];
  mode: McpLifecycleMode;
  state: McpServerState;
  reason: string;
  caps: string[];
  tools: [string, string, string, string, boolean, string][];
  auth: McpAuthMode;
  tokenRef: string;
  scopes: string[];
  configSource: 'org' | 'project' | 'user';
  path: string;
  circuit?: { state: 'closed' | 'half-open' | 'open'; reason: string };
  failures?: number;
  whitelist: string[];
  gateway?: boolean;
  sandbox: string;
}

const MCP_SEEDS: McpSeed[] = [
  {
    id: 'mcp-filesystem', name: 'filesystem', transport: 'stdio', priority: ['stdio'], mode: 'managed', state: 'Ready',
    reason: '初始化成功，能力已发现（tools/resources）',
    caps: ['tools', 'resources', 'roots'],
    tools: [
      ['read_text_file', 'read_text_file', 'read_file', 'R0', false, '按行范围读取工作区内文本文件'],
      ['write_file', 'write_file', 'mcp_write_file', 'R1', true, '写文件（与内置 write_file 同名，已命名空间化）'],
      ['list_directory', 'list_directory', 'list_dir', 'R0', false, '列目录（忽略规则生效）'],
      ['search_files', 'search_files', 'mcp_search', 'R0', false, '按 glob 搜索文件'],
    ],
    auth: 'envKey', tokenRef: 'secret://project/mcp-filesystem/rootToken', scopes: ['files:read', 'files:write'],
    configSource: 'project', path: '.oc/mcp.json#filesystem', whitelist: [], sandbox: 'L1',
  },
  {
    id: 'mcp-github', name: 'github', transport: 'http', priority: ['http', 'sse'], mode: 'managed', state: 'Ready',
    reason: 'OAuth 授权完成，令牌有效期 42 天',
    caps: ['tools', 'resources', 'prompts'],
    tools: [
      ['create_pull_request', 'create_pull_request', 'gh_create_pr', 'R3', false, '创建 PR（外发：代码差异与描述）'],
      ['list_issues', 'list_issues', 'gh_list_issues', 'R0', false, '列出 Issue'],
      ['get_file_contents', 'get_file_contents', 'gh_read_file', 'R0', false, '读取远端文件内容'],
      ['merge_pull_request', 'merge_pull_request', 'gh_merge_pr', 'R4', false, '合并 PR（破坏性，企业默认 ASK）'],
    ],
    auth: 'oauthCode', tokenRef: 'secret://user/mcp-github/oauth', scopes: ['repo', 'read:org'],
    configSource: 'user', path: '~/.oc/mcp.json#github', whitelist: ['api.github.com', 'github.com'], sandbox: 'L0',
  },
  {
    id: 'mcp-postgres-ro', name: 'postgres-ro', transport: 'stdio', priority: ['stdio'], mode: 'managed', state: 'Degraded',
    reason: '健康探测连续失败 2 次：连接池获取超时（600ms），已降级但保留只读工具可用性',
    caps: ['tools', 'resources'],
    tools: [
      ['query', 'query', 'db_query_ro', 'R0', false, '执行只读 SQL（语句白名单校验）'],
      ['list_schemas', 'list_schemas', 'db_list_schemas', 'R0', false, '列出 schema 与表'],
      ['explain', 'explain', 'db_explain', 'R0', false, '执行计划解读'],
    ],
    auth: 'serviceCredential', tokenRef: 'secret://org/mcp-postgres-ro/roUser', scopes: ['db:readonly'],
    configSource: 'org', path: 'oc://org-registry/mcp.json#postgres-ro', whitelist: [], sandbox: 'L1', failures: 2,
  },
  {
    id: 'mcp-sentry', name: 'sentry', transport: 'sse', priority: ['sse', 'http'], mode: 'managed', state: 'Failed',
    reason: '握手失败：协议版本不兼容（服务器 2024-11-05 / 内核 2025-06-18），已隔离；建议升级服务器或启用兼容层',
    caps: ['tools'],
    tools: [
      ['list_issues', 'list_issues', 'sentry_issues', 'R0', false, '列出异常聚合（不可用：服务器未就绪）'],
    ],
    auth: 'deviceCode', tokenRef: 'secret://org/mcp-sentry/deviceToken', scopes: ['event:read'],
    configSource: 'org', path: 'oc://org-registry/mcp.json#sentry', whitelist: ['sentry.internal.acme.com'], sandbox: 'L0',
  },
  {
    id: 'mcp-jira-cloud', name: 'jira-cloud', transport: 'http', priority: ['http'], mode: 'managed', state: 'Degraded',
    reason: '熔断已打开（5 次失败 / 60s）：上游 503；已停止转发，半开探测每 30s 一次',
    caps: ['tools', 'resources'],
    tools: [
      ['search_issues', 'search_issues', 'jira_search', 'R0', false, 'JQL 检索（当前熔断中）'],
      ['create_issue', 'create_issue', 'jira_create', 'R3', false, '创建 Issue（外发：描述与附件）'],
      ['transition_issue', 'transition_issue', 'jira_transition', 'R2', false, '流转状态'],
    ],
    auth: 'serviceCredential', tokenRef: 'secret://org/mcp-jira/saToken', scopes: ['jira:write'],
    configSource: 'org', path: 'oc://org-registry/mcp.json#jira-cloud', whitelist: ['acme.atlassian.net'], sandbox: 'L0',
    circuit: { state: 'open', reason: '连续 5 次 503（阈值 5 次 / 60s 窗口），已打开熔断并告警' }, failures: 5,
  },
  {
    id: 'mcp-k8s-gateway', name: 'k8s-gateway', transport: 'ws', priority: ['ws', 'http'], mode: 'cluster', state: 'Ready',
    reason: '经企业网关接入（白名单 + 审计 + DLP），连接复用生效',
    caps: ['tools', 'resources'],
    tools: [
      ['list_pods', 'list_pods', 'k8s_list_pods', 'R0', false, '列 Pod（命名空间白名单）'],
      ['get_logs', 'get_logs', 'k8s_get_logs', 'R0', false, '拉取日志（脱敏后回喂）'],
      ['apply_manifest', 'apply_manifest', 'k8s_apply', 'R4', false, '应用清单（企业默认 DENY，需临时授权）'],
      ['describe_resource', 'describe_resource', 'k8s_describe', 'R0', false, '资源详情'],
    ],
    auth: 'serviceCredential', tokenRef: 'secret://org/k8s-gateway/sa', scopes: ['k8s:readonly'],
    configSource: 'org', path: 'oc://org-registry/mcp.json#k8s-gateway', whitelist: ['mcp-gw.acme.internal'], gateway: true, sandbox: 'L2',
  },
  {
    id: 'mcp-slack-notify', name: 'slack-notify', transport: 'http', priority: ['http'], mode: 'external', state: 'Stopped',
    reason: '用户手动停用（维护窗口）；工具已从当前轮次上下文中移除（不中途变更运行中轮次）',
    caps: ['tools'],
    tools: [
      ['post_message', 'post_message', 'slack_post', 'R3', false, '发送消息（外发：文本，DLP 规则生效）'],
      ['list_channels', 'list_channels', 'slack_channels', 'R0', false, '列出频道'],
    ],
    auth: 'envKey', tokenRef: 'secret://user/mcp-slack/botToken', scopes: ['chat:write'],
    configSource: 'user', path: '~/.oc/mcp.json#slack-notify', whitelist: ['slack.com'], sandbox: 'L0',
  },
  {
    id: 'mcp-figma', name: 'figma', transport: 'http', priority: ['http', 'sse'], mode: 'managed', state: 'Ready',
    reason: '能力已发现；别名映射已生效（get_design_context → figma_design）',
    caps: ['tools', 'resources'],
    tools: [
      ['get_design_context', 'get_design_context', 'figma_design', 'R0', false, '读取设计上下文（结构化 + 截图）'],
      ['get_screenshot', 'get_screenshot', 'figma_shot', 'R0', false, '节点截图'],
    ],
    auth: 'oauthCode', tokenRef: 'secret://user/mcp-figma/oauth', scopes: ['file_read'],
    configSource: 'user', path: '~/.oc/mcp.json#figma', whitelist: ['api.figma.com'], sandbox: 'L0',
  },
  {
    id: 'mcp-internal-search', name: 'internal-search', transport: 'stdio', priority: ['stdio'], mode: 'managed', state: 'Configured',
    reason: '已配置但未启用（默认不自动启动第三方本地服务器）；点击「启用」后进入 Starting',
    caps: [],
    tools: [],
    auth: 'envKey', tokenRef: 'secret://org/internal-search/apiKey', scopes: ['search:read'],
    configSource: 'org', path: 'oc://org-registry/mcp.json#internal-search', whitelist: ['search.internal.acme.com'], sandbox: 'L1',
  },
];

function buildMcp(r: Rng): McpServerData[] {
  return MCP_SEEDS.map((seed, si) => {
    const toolCount = seed.tools.length;
    const tools: McpTool[] = seed.tools.map((t, i) => ({
      rawName: t[0],
      namespace: `${seed.name}.${t[0]}`,
      alias: t[1] === t[2] ? t[0] : t[2],
      riskHint: t[3],
      conflictWithBuiltin: t[4],
      conflictNote: t[4] ? `与内置工具 ${t[0]} 同名：内置优先，MCP 版本命名为 ${seed.name}.${t[0]}` : undefined,
      desc: t[5],
      callCount: r.int(0, 1800),
      errorRate: seed.state === 'Ready' ? r.float(0, 2.4, 2) : seed.state === 'Degraded' ? r.float(6, 18, 2) : 0,
    }));
    const callLogs: McpCallLog[] = Array.from({ length: r.int(6, 10) }, (_, i) => {
      const tool = tools.length ? tools[r.int(0, toolCount - 1)] : { rawName: 'initialize', riskHint: 'R0' };
      const bad = seed.state === 'Failed' || (seed.circuit?.state === 'open' && i < 4);
      const status: McpCallLog['status'] = seed.circuit?.state === 'open' && i < 2 ? 'circuit-open' : bad ? 'error' : i === 5 && r.bool(0.3) ? 'timeout' : 'ok';
      return {
        id: `MC-${String(si + 1).padStart(2, '0')}${String(i + 1).padStart(2, '0')}`,
        method: status === 'circuit-open' ? 'tools/call（已拦截）' : i % 3 === 0 ? 'tools/list' : 'tools/call',
        tool: tool.rawName,
        paramsDigest: `sha256:${r.int(1000, 9999)}${r.int(10, 99)}…`,
        egressBytes: status === 'circuit-open' ? 0 : r.int(220, 46_000),
        decisionRef: status === 'circuit-open' ? 'AR-CIRCUIT-DENY' : `AR-${r.int(1000, 9999)}`,
        durationMs: status === 'timeout' ? 30_000 : r.int(18, 4200),
        status,
        retries: status === 'ok' ? 0 : r.int(1, 2),
        at: r.agoHours(i + 1),
      };
    });
    const resources: McpResource[] = seed.caps.includes('resources')
      ? Array.from({ length: r.int(2, 4) }, (_, i) => ({
        uri: `mcp://${seed.name}/${seed.name === 'k8s-gateway' ? 'clusters/prod' : seed.name === 'figma' ? 'files/design-system' : 'schema'}/item-${i + 1}`,
        name: seed.name === 'k8s-gateway' ? `生产集群 · 命名空间 ns-${i + 1}` : seed.name === 'figma' ? `设计文件 · 组件库 ${i + 1}` : `资源 ${i + 1}`,
        subscribed: r.bool(0.5),
        lastChangedAt: r.agoHours(r.int(1, 60)),
        rootsScope: seed.sandbox === 'L1' ? '工作区根（roots 围栏内）' : '只读投影（不透传路径）',
      }))
      : [];
    const reverseRequests: McpReverseRequest[] = Array.from({ length: r.int(2, 4) }, (_, i) => {
      const type: McpReverseRequest['type'] = i % 2 === 0 ? 'sampling' : 'elicitation';
      return {
        id: `RR-${String(si + 1).padStart(2, '0')}${i + 1}`,
        type,
        detail: type === 'sampling' ? `请求模型采样（${r.int(400, 3200)} 输出 token，摘要任务）` : '请求用户输入：选择目标命名空间',
        budgetImpact: type === 'sampling' ? `≈ $${r.float(0.004, 0.09, 4)}（计入会话预算）` : '无直接成本',
        userDecision: i === 1 ? 'asked' : i === 3 ? 'queued' : r.bool(0.7) ? 'allowed' : 'denied',
        at: r.agoHours(i + 2),
      };
    });
    const healthy = seed.state === 'Ready' || seed.state === 'Degraded';
    const diagnoseBase: { step: string; ok: boolean; detail: string; ms: number }[] = [
      { step: '1 · 传输连接', ok: seed.state !== 'Failed', detail: seed.state === 'Failed' ? '连接建立失败：SSE 端点 404' : `${seed.transport} 连接复用正常`, ms: r.int(6, 220) },
      { step: '2 · 协议握手', ok: seed.state !== 'Failed', detail: seed.state === 'Failed' ? '协议版本不兼容（2024-11-05 ≠ 2025-06-18）' : 'initialize 成功，协商版本 2025-06-18', ms: r.int(10, 380) },
      { step: '3 · 能力列表', ok: seed.caps.length > 0, detail: seed.caps.length ? `已发现：${seed.caps.join(' / ')}` : '未启用，未执行能力发现', ms: r.int(8, 260) },
      { step: '4 · tools/list', ok: toolCount > 0, detail: toolCount ? `${toolCount} 个工具，${tools.filter((t) => t.conflictWithBuiltin).length} 个与内置冲突（已命名空间化）` : '无工具', ms: r.int(12, 460) },
      { step: '5 · 延迟探测', ok: healthy, detail: healthy ? `P50 ${r.int(18, 160)}ms / P95 ${r.int(200, 900)}ms` : '探测超时（>3s），已按降级处理', ms: r.int(20, 3100) },
    ];
    return {
      serverId: seed.id,
      name: seed.name,
      transport: seed.transport,
      transportPriority: seed.priority,
      lifecycleMode: seed.mode,
      state: seed.state,
      stateReason: seed.reason,
      capabilitiesDiscovered: seed.caps,
      tools,
      auth: { mode: seed.auth, tokenRef: seed.tokenRef, scopes: seed.scopes, expiresAt: seed.auth === 'oauthCode' ? r.future(60 * 24 * 42) : null },
      configSource: seed.configSource,
      configPath: seed.path,
      limits: { timeoutMs: 30_000, concurrencyMax: r.int(2, 8), outputQuotaKb: 256 },
      circuitBreaker: {
        failures: seed.failures ?? 0,
        windowSec: 60,
        state: seed.circuit?.state ?? 'closed',
        openAt: seed.circuit ? r.ago(12) : null,
        reason: seed.circuit?.reason ?? '窗口内失败 0 次，闭合',
      },
      health: { lastProbeAt: r.ago(r.int(1, 20)), healthy, probeLatencyMs: healthy ? r.int(14, 180) : 3000, consecutiveFailures: seed.failures ?? 0 },
      restart: { total: seed.state === 'Failed' ? r.int(3, 6) : r.int(0, 2), backoffSec: 30, nextRetryAt: seed.state === 'Failed' ? r.future(1) : null },
      metrics: {
        latencyMs: healthy ? r.int(24, 260) : 3000,
        p95Ms: healthy ? r.int(180, 900) : 3000,
        errorTotal: seed.state === 'Ready' ? r.int(0, 24) : seed.state === 'Degraded' ? r.int(60, 220) : r.int(5, 20),
        restartTotal: seed.state === 'Failed' ? r.int(3, 6) : r.int(0, 2),
        egressBytes: r.int(40_000, 42_000_000),
        callTotal: r.int(30, 9000),
        trend: Array.from({ length: 10 }, () => r.float(healthy ? 30 : 900, healthy ? 260 : 3000, 0)),
      },
      resources,
      reverseRequests,
      callLogs,
      exposure: {
        readonlyTools: seed.name === 'filesystem' || seed.name === 'postgres-ro',
        resources: seed.name === 'k8s-gateway',
        prompts: seed.name === 'github',
        writeTools: false,
        sessionControl: false,
        apiKeyRef: `secret://exposure/${seed.name}/apiKey`,
        scope: seed.name === 'k8s-gateway' ? 'org（只读）' : 'project（只读）',
      },
      sandboxTier: seed.sandbox,
      networkWhitelist: seed.whitelist,
      gateway: Boolean(seed.gateway),
      diagnose: diagnoseBase,
    };
  });
}

/* ============================== Hooks（卷 17） ============================== */

export type HookDomain = 'session' | 'turn-phase' | 'model' | 'tool' | 'permission' | 'context' | 'workitem-git' | 'system';
export type HookCapability = 'observe' | 'block' | 'rewrite';
export type HookImpl = 'rule' | 'script' | 'plugin' | 'http';
export type HookScope = 'org' | 'project' | 'user' | 'session';

export interface HookPointData {
  point: string;
  domain: HookDomain;
  /** 该点可用的干预能力（硬约束：权限决策之后只允许观察） */
  capabilities: HookCapability[];
  semantics: string;
  since: string;
}

export interface HookExecution {
  id: string;
  point: string;
  result: 'pass' | 'block' | 'rewrite' | 'crash';
  durationMs: number;
  diff?: { field: string; before: string; after: string };
  reason: string;
  at: string;
}

export interface HookData {
  id: string;
  name: string;
  point: string;
  scope: HookScope;
  match: { toolName: string; pathPattern: string; commandPattern: string; eventType: string; model: string };
  capability: HookCapability;
  rewritableFields: string[];
  impl: HookImpl;
  failurePolicy: 'fail-open' | 'fail-closed';
  timeoutMs: number;
  async: boolean;
  env: string[];
  enabled: boolean;
  signature: { state: SignatureState; signer: string };
  source: 'template' | 'handwritten' | 'plugin' | 'org-policy';
  stats: { executions: number; blockRate: number; rewriteCount: number; avgLatencyMs: number; failureStreak: number; circuitDisabled: boolean };
  executions: HookExecution[];
}

export interface HookTemplate {
  id: string;
  name: string;
  category: '格式化' | '敏感扫描' | '提交规范' | '通知集成' | '审计上报';
  point: string;
  capability: HookCapability;
  impl: HookImpl;
  desc: string;
  signature: { state: SignatureState; signer: string };
  installed: boolean;
  usageCount: number;
}

const HOOK_POINTS: HookPointData[] = [
  { point: 'session.create.before', domain: 'session', capabilities: ['observe', 'block', 'rewrite'], semantics: '会话创建前初始化环境与策略校验；可阻断（如工作区未授权）', since: '1.0' },
  { point: 'session.create.after', domain: 'session', capabilities: ['observe'], semantics: '会话创建后注入上下文与通知（只观察）', since: '1.0' },
  { point: 'session.close.before', domain: 'session', capabilities: ['observe', 'block', 'rewrite'], semantics: '会话关闭前清理与快照；可阻断（未提交变更）', since: '1.0' },
  { point: 'session.close.after', domain: 'session', capabilities: ['observe'], semantics: '会话关闭后归档与上报', since: '1.1' },
  { point: 'turn.start.before', domain: 'turn-phase', capabilities: ['observe', 'block', 'rewrite'], semantics: '轮次开始前注入/改写上下文与模式', since: '1.0' },
  { point: 'turn.complete.after', domain: 'turn-phase', capabilities: ['observe'], semantics: '轮次完成后通知与度量（只观察）', since: '1.0' },
  { point: 'turn.abort.after', domain: 'turn-phase', capabilities: ['observe'], semantics: '中断后记录与补偿提示', since: '1.0' },
  { point: 'phase.plan.before', domain: 'turn-phase', capabilities: ['observe', 'block', 'rewrite'], semantics: '计划生成前校验（可阻断高风险步骤）', since: '1.1' },
  { point: 'phase.plan.after', domain: 'turn-phase', capabilities: ['observe'], semantics: '计划生成后评审提示', since: '1.1' },
  { point: 'phase.execute.before', domain: 'turn-phase', capabilities: ['observe', 'block'], semantics: '执行阶段前置守卫（可阻断）', since: '1.1' },
  { point: 'phase.verify.before', domain: 'turn-phase', capabilities: ['observe', 'block', 'rewrite'], semantics: '验收前强制校验（如必须有测试证据）', since: '1.1' },
  { point: 'phase.verify.after', domain: 'turn-phase', capabilities: ['observe'], semantics: '验收后证据归档', since: '1.1' },
  { point: 'model.request.before', domain: 'model', capabilities: ['observe', 'rewrite'], semantics: '模型请求前改写（谨慎：仅允许声明字段）', since: '1.0' },
  { point: 'model.request.after', domain: 'model', capabilities: ['observe'], semantics: '请求后成本与延迟打点', since: '1.0' },
  { point: 'model.error.after', domain: 'model', capabilities: ['observe'], semantics: '模型错误归因与降级建议', since: '1.0' },
  { point: 'tool.call.before', domain: 'tool', capabilities: ['observe', 'block', 'rewrite'], semantics: '工具参数校验与改写（改写后必须重新走权限决策）', since: '1.0' },
  { point: 'tool.call.after', domain: 'tool', capabilities: ['observe'], semantics: '工具调用后观察/通知', since: '1.0' },
  { point: 'tool.result.before', domain: 'tool', capabilities: ['observe', 'rewrite'], semantics: '结果脱敏与改写（在脱敏之后执行）', since: '1.0' },
  { point: 'tool.result.after', domain: 'tool', capabilities: ['observe'], semantics: '结果归档与度量', since: '1.0' },
  { point: 'tool.error.after', domain: 'tool', capabilities: ['observe'], semantics: '工具错误上报与复现信息收集', since: '1.0' },
  { point: 'permission.decision.before', domain: 'permission', capabilities: ['observe', 'rewrite'], semantics: '决策前收窄（不可放宽：DENY 不可改 ALLOW）', since: '1.0' },
  { point: 'permission.decision.after', domain: 'permission', capabilities: ['observe'], semantics: '决策后审计（只允许观察）', since: '1.0' },
  { point: 'approval.request.before', domain: 'permission', capabilities: ['observe', 'block'], semantics: '审批发起前合并/抑制（防打扰）', since: '1.1' },
  { point: 'approval.resolved.after', domain: 'permission', capabilities: ['observe'], semantics: '审批结论回填与通知', since: '1.1' },
  { point: 'context.assemble.before', domain: 'context', capabilities: ['observe', 'block', 'rewrite'], semantics: '上下文装配前注入规范区段', since: '1.2' },
  { point: 'context.assemble.after', domain: 'context', capabilities: ['observe'], semantics: '装配后归因与水位打点', since: '1.2' },
  { point: 'context.compact.before', domain: 'context', capabilities: ['observe', 'block'], semantics: '压缩前保护不可压缩约束（可阻断）', since: '1.2' },
  { point: 'context.compact.after', domain: 'context', capabilities: ['observe'], semantics: '压缩后保真断言', since: '1.2' },
  { point: 'workitem.create.before', domain: 'workitem-git', capabilities: ['observe', 'block', 'rewrite'], semantics: '任务创建前模板校验与字段补全', since: '1.1' },
  { point: 'workitem.state.changed.after', domain: 'workitem-git', capabilities: ['observe'], semantics: '状态变更后同步外部系统', since: '1.1' },
  { point: 'plan.update.before', domain: 'workitem-git', capabilities: ['observe', 'block'], semantics: '计划变更前审批校验', since: '1.2' },
  { point: 'git.commit.before', domain: 'workitem-git', capabilities: ['observe', 'block', 'rewrite'], semantics: '提交前规范校验、密钥扫描与信息改写', since: '1.0' },
  { point: 'git.commit.after', domain: 'workitem-git', capabilities: ['observe'], semantics: '提交后追溯尾注写入', since: '1.0' },
  { point: 'git.push.before', domain: 'workitem-git', capabilities: ['observe', 'block'], semantics: '推送前保护分支与远程校验', since: '1.0' },
  { point: 'pr.create.before', domain: 'workitem-git', capabilities: ['observe', 'block', 'rewrite'], semantics: 'PR 描述模板与检查清单注入', since: '1.2' },
  { point: 'pr.create.after', domain: 'workitem-git', capabilities: ['observe'], semantics: 'PR 创建后通知与关联', since: '1.2' },
  { point: 'sandbox.exec.before', domain: 'system', capabilities: ['observe', 'block', 'rewrite'], semantics: '沙箱执行前危险命令二次判定', since: '1.0' },
  { point: 'plugin.load.after', domain: 'system', capabilities: ['observe'], semantics: '插件装载后自检与清单核对', since: '1.2' },
  { point: 'system.ready.after', domain: 'system', capabilities: ['observe'], semantics: '内核就绪后自检与预热', since: '1.0' },
  { point: 'system.shutdown.before', domain: 'system', capabilities: ['observe', 'block'], semantics: '关闭前等待在途任务（可阻断）', since: '1.3' },
];

interface HookSeed {
  id: string;
  name: string;
  point: string;
  scope: HookScope;
  cap: HookCapability;
  impl: HookImpl;
  policy: 'fail-open' | 'fail-closed';
  async: boolean;
  match?: Partial<HookData['match']>;
  fields?: string[];
  env?: string[];
  source: HookData['source'];
  enabled?: boolean;
  signature: SignatureState;
  disabled?: boolean;
  reason?: string;
}

const HOOK_SEEDS: HookSeed[] = [
  { id: 'HK-01', name: '提交信息规范校验', point: 'git.commit.before', scope: 'org', cap: 'block', impl: 'rule', policy: 'fail-closed', async: false, match: { commandPattern: 'git commit*' }, source: 'template', signature: 'verified' },
  { id: 'HK-02', name: '敏感信息扫描（提交前）', point: 'git.commit.before', scope: 'org', cap: 'block', impl: 'script', policy: 'fail-closed', async: false, fields: [], env: ['SCAN_RULEPACK=secret://org/scan/rules'], source: 'org-policy', signature: 'verified' },
  { id: 'HK-03', name: '工具结果脱敏改写', point: 'tool.result.before', scope: 'org', cap: 'rewrite', impl: 'script', policy: 'fail-closed', async: false, fields: ['result.content', 'result.summary', 'result.metadata.authorization'], env: ['MASK_PROFILE=strict'], source: 'org-policy', signature: 'verified' },
  { id: 'HK-04', name: '路径参数收窄到工作区', point: 'tool.call.before', scope: 'project', cap: 'rewrite', impl: 'rule', policy: 'fail-open', async: false, match: { toolName: 'write_file,edit_file' }, fields: ['args.path'], source: 'handwritten', signature: 'verified' },
  { id: 'HK-05', name: '格式化后置处理', point: 'tool.call.after', scope: 'user', cap: 'observe', impl: 'plugin', policy: 'fail-open', async: true, match: { toolName: 'edit_file' }, source: 'plugin', signature: 'verified' },
  { id: 'HK-06', name: '企业审计上报', point: 'tool.call.after', scope: 'org', cap: 'observe', impl: 'http', policy: 'fail-open', async: true, env: ['AUDIT_URL=https://audit.acme.internal/v1', 'AUDIT_TOKEN=secret://org/audit/token'], source: 'org-policy', signature: 'verified' },
  { id: 'HK-07', name: 'IM 通知集成', point: 'turn.complete.after', scope: 'user', cap: 'observe', impl: 'http', policy: 'fail-open', async: true, env: ['IM_WEBHOOK=secret://user/im/webhook'], source: 'template', signature: 'verified' },
  { id: 'HK-08', name: '上下文注入规范', point: 'context.assemble.before', scope: 'project', cap: 'rewrite', impl: 'rule', policy: 'fail-open', async: false, fields: ['sections.S2.content'], source: 'handwritten', signature: 'verified' },
  { id: 'HK-09', name: '用户约束不可压缩保护', point: 'context.compact.before', scope: 'project', cap: 'block', impl: 'script', policy: 'fail-closed', async: false, source: 'handwritten', signature: 'verified' },
  { id: 'HK-10', name: '计划高风险步骤拦截', point: 'phase.plan.before', scope: 'project', cap: 'block', impl: 'rule', policy: 'fail-closed', async: false, source: 'handwritten', signature: 'verified' },
  { id: 'HK-11', name: '验收前测试证据强制', point: 'phase.verify.before', scope: 'project', cap: 'block', impl: 'script', policy: 'fail-closed', async: false, source: 'handwritten', signature: 'verified' },
  { id: 'HK-12', name: '成本水位告警', point: 'model.request.after', scope: 'org', cap: 'observe', impl: 'rule', policy: 'fail-open', async: true, source: 'template', signature: 'verified' },
  { id: 'HK-13', name: '模型错误归因补充', point: 'model.error.after', scope: 'org', cap: 'observe', impl: 'plugin', policy: 'fail-open', async: true, source: 'plugin', signature: 'verified' },
  { id: 'HK-14', name: '会话环境初始化', point: 'session.create.after', scope: 'project', cap: 'observe', impl: 'script', policy: 'fail-open', async: false, env: ['PATH_EXTRA=./scripts'], source: 'template', signature: 'verified' },
  { id: 'HK-15', name: '会话关闭清理与快照', point: 'session.close.before', scope: 'project', cap: 'observe', impl: 'script', policy: 'fail-open', async: false, source: 'handwritten', signature: 'verified' },
  { id: 'HK-16', name: '插件装载自检', point: 'plugin.load.after', scope: 'org', cap: 'observe', impl: 'plugin', policy: 'fail-open', async: true, source: 'plugin', signature: 'verified' },
  { id: 'HK-17', name: '权限决策收窄（网络门禁）', point: 'permission.decision.before', scope: 'org', cap: 'rewrite', impl: 'rule', policy: 'fail-closed', async: false, fields: ['decision.scope', 'decision.reason'], source: 'org-policy', signature: 'verified' },
  { id: 'HK-18', name: '危险命令二次判定', point: 'sandbox.exec.before', scope: 'org', cap: 'block', impl: 'script', policy: 'fail-closed', async: false, env: ['DANGER_RULES=secret://org/sandbox/danger'], source: 'org-policy', signature: 'verified', enabled: false, disabled: true, reason: '连续失败 5 次（script 超时），已按熔断策略自动禁用并通知管理员；修复后可手动启用' },
];

function buildHooks(r: Rng): HookData[] {
  return HOOK_SEEDS.map((seed, hi) => {
    const pointMeta = HOOK_POINTS.find((p) => p.point === seed.point);
    const executionCount = r.int(12, 60);
    const executions: HookExecution[] = Array.from({ length: r.int(3, 5) }, (_, i) => {
      const roll = r.next();
      const result: HookExecution['result'] = seed.disabled && i === 0 ? 'crash' : seed.cap === 'block' && roll < 0.4 ? 'block' : seed.cap === 'rewrite' && roll < 0.6 ? 'rewrite' : 'pass';
      return {
        id: `HE-${String(hi + 1).padStart(2, '0')}${i + 1}`,
        point: seed.point,
        result,
        durationMs: result === 'crash' ? 3000 : r.int(4, 1800),
        diff: result === 'rewrite' ? {
          field: (seed.fields ?? ['args.path'])[0],
          before: seed.point === 'tool.result.before' ? 'Authorization: Bearer eyJhbGciOi…（明文）' : '"path": "../../etc/hosts"',
          after: seed.point === 'tool.result.before' ? 'Authorization: ••••••（引用式，明文不入上下文）' : '"path": "src/main/java/App.java"（收窄到工作区）',
        } : undefined,
        reason: result === 'block' ? '命中组织安全规则：阻断并记录（后续钩子不执行）' : result === 'rewrite' ? '改写通过 Schema 校验，已重新走权限决策' : result === 'crash' ? '脚本超时 3000ms（>2000ms 超时上限），按 fail-closed 阻断' : '通过，无干预',
        at: r.agoHours(i + 1),
      };
    });
    const blocked = executions.filter((e) => e.result === 'block').length;
    return {
      id: seed.id,
      name: seed.name,
      point: seed.point,
      scope: seed.scope,
      match: {
        toolName: seed.match?.toolName ?? '',
        pathPattern: seed.match?.pathPattern ?? '',
        commandPattern: seed.match?.commandPattern ?? '',
        eventType: seed.match?.eventType ?? '',
        model: seed.match?.model ?? '',
      },
      capability: seed.cap,
      rewritableFields: seed.cap === 'rewrite' ? (seed.fields ?? []) : [],
      impl: seed.impl,
      failurePolicy: seed.policy,
      timeoutMs: pointMeta?.domain === 'tool' ? 2000 : 2000,
      async: seed.async,
      env: seed.env ?? [],
      enabled: seed.enabled ?? true,
      signature: { state: seed.signature, signer: seed.scope === 'org' ? '云枢科技 平台安全组' : seed.scope === 'project' ? 'payment-core 维护者' : '沈亦舟' },
      source: seed.source,
      stats: {
        executions: executionCount,
        blockRate: seed.cap === 'block' ? Number(((blocked / executions.length) * 100).toFixed(1)) : 0,
        rewriteCount: executions.filter((e) => e.result === 'rewrite').length,
        avgLatencyMs: seed.disabled ? 3000 : r.int(6, 640),
        failureStreak: seed.disabled ? 5 : r.int(0, 1),
        circuitDisabled: Boolean(seed.disabled),
      },
      executions,
    };
  });
}

const HOOK_TEMPLATES: HookTemplate[] = [
  { id: 'HT-01', name: '代码格式化（提交前）', category: '格式化', point: 'tool.call.after', capability: 'observe', impl: 'plugin', desc: '编辑文件后自动格式化并回报差异摘要', signature: { state: 'verified', signer: 'OpenCoding 官方模板' }, installed: true, usageCount: 1840 },
  { id: 'HT-02', name: '敏感信息扫描', category: '敏感扫描', point: 'git.commit.before', capability: 'block', impl: 'script', desc: '密钥/令牌/私钥命中即阻断，附修复建议', signature: { state: 'verified', signer: 'OpenCoding 官方模板' }, installed: true, usageCount: 2310 },
  { id: 'HT-03', name: 'Conventional Commits 校验', category: '提交规范', point: 'git.commit.before', capability: 'rewrite', impl: 'rule', desc: '校验并规范化提交信息（含范围与尾注）', signature: { state: 'verified', signer: 'OpenCoding 官方模板' }, installed: false, usageCount: 960 },
  { id: 'HT-04', name: 'IM 通知（完成/失败）', category: '通知集成', point: 'turn.complete.after', capability: 'observe', impl: 'http', desc: '轮次结束后推送摘要到 IM，失败附 traceId', signature: { state: 'verified', signer: '云枢科技 平台安全组' }, installed: true, usageCount: 512 },
  { id: 'HT-05', name: '审计上报（企业）', category: '审计上报', point: 'tool.call.after', capability: 'observe', impl: 'http', desc: '全量工具调用上报企业审计服务（异步、fail-open）', signature: { state: 'verified', signer: '云枢科技 平台安全组' }, installed: false, usageCount: 288 },
  { id: 'HT-06', name: '测试证据强制', category: '提交规范', point: 'phase.verify.before', capability: 'block', impl: 'script', desc: '无 L2 可执行证据时阻断验收', signature: { state: 'unsigned', signer: '（社区投稿未签名）' }, installed: false, usageCount: 143 },
];

/* ============================== 插件与扩展点（卷 18） ============================== */

export type PluginHostMode = 'in-process' | 'out-of-process' | 'remote';
export type PluginHealth = '初始化' | '就绪' | '降级' | '故障';
export type PluginUiSurface = 'panel' | 'command' | 'settings_page' | 'status_bar_item' | 'inline_card' | 'notification_template';

export interface PluginConfigField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'secret' | 'select';
  default: string | number | boolean;
  secret: boolean;
  label: string;
  options?: string[];
}

export interface PluginUiExtension { surface: PluginUiSurface; name: string; desc: string }

export interface PluginLoadStep { stage: string; ok: boolean; detail: string; ms: number }

export interface PluginData {
  id: string;
  name: string;
  version: string;
  author: string;
  signature: { state: SignatureState; signer: string; fingerprint: string; reason?: string };
  kernel: { compatible: string; hostMode: PluginHostMode };
  capabilities: { extensions: string[]; permissions: string[] };
  resources: { maxMemoryMb: number; maxConcurrency: number };
  configSchema: PluginConfigField[];
  reloadable: boolean;
  dependencies: { plugins: string[]; skills: string[] };
  health: PluginHealth;
  healthReason: string;
  metrics: { callTotal: number; errorTotal: number; initLatencyMs: number; memoryBytes: number; trend: number[] };
  circuitState: 'closed' | 'half-open' | 'open';
  circuitReason: string;
  grantedPermissions: string[];
  /** 被拒绝的权限（越权即拒绝并审计，不静默） */
  deniedPermissions: { permission: string; reason: string; at: string }[];
  loadLog: PluginLoadStep[];
  uiExtensions: PluginUiExtension[];
  source: 'local' | 'org-registry' | 'market';
  compat: { kernel: string; state: 'supported' | 'deprecated' | 'unsupported' | 'untested' }[];
  previousVersion: string | null;
}

interface PluginSeed {
  id: string; name: string; version: string; author: string; sig: SignatureState;
  mode: PluginHostMode; ext: string[]; perms: string[]; mem: number; conc: number;
  health: PluginHealth; healthReason: string; circuit?: { state: PluginData['circuitState']; reason: string };
  reloadable: boolean; depsP?: string[]; depsS?: string[]; denied?: string[]; source: PluginData['source'];
  config?: PluginConfigField[]; ui?: PluginUiExtension[]; failStage?: string; prev?: string | null;
}

const PLUGIN_SEEDS: PluginSeed[] = [
  {
    id: 'com.acme.k8s-ops', name: 'K8s 运维扩展', version: '2.3.1', author: 'ACME Platform Team', sig: 'verified',
    mode: 'in-process', ext: ['tool.provider', 'permission.policy', 'ui.panel'], perms: ['tool.execute:commands', 'network:egress:[api.acme.internal,k8s-api.internal.acme.com]', 'workspace:read', 'secret:ref:acme.k8s.token'],
    mem: 256, conc: 4, health: '就绪', healthReason: '初始化成功，扩展点已注册（3 个）', reloadable: true, depsP: [], depsS: ['acme.platform.k8s-basics@^1.0'], source: 'org-registry', prev: '2.3.0',
    config: [
      { key: 'cluster', type: 'string', default: 'prod-cn-north', secret: false, label: '目标集群' },
      { key: 'namespace', type: 'string', default: 'default', secret: false, label: '默认命名空间' },
      { key: 'tokenRef', type: 'secret', default: 'acme.k8s.token', secret: true, label: '集群令牌引用' },
      { key: 'readonly', type: 'boolean', default: true, secret: false, label: '只读模式' },
    ],
    ui: [
      { surface: 'panel', name: '集群巡检面板', desc: '命名空间资源与事件聚合视图' },
      { surface: 'command', name: 'oc k8s巡检', desc: '命令面板项，等价 CLI 已提供' },
      { surface: 'status_bar_item', name: '集群连接状态', desc: '状态栏项（连接 / 降级 / 断开）' },
    ],
  },
  {
    id: 'com.acme.jira-bridge', name: 'Jira 双向同步', version: '1.8.0', author: 'ACME Delivery Tools', sig: 'verified',
    mode: 'out-of-process', ext: ['workitem.sync', 'notification.channel'], perms: ['network:egress:[acme.atlassian.net]', 'secret:ref:acme.jira.saToken'],
    mem: 192, conc: 2, health: '就绪', healthReason: '进程外宿主就绪，IPC 延迟 P95 3.1ms', reloadable: false, depsS: [], source: 'org-registry', prev: null,
    config: [
      { key: 'site', type: 'string', default: 'acme.atlassian.net', secret: false, label: 'Jira 站点' },
      { key: 'projectKey', type: 'string', default: 'PAY', secret: false, label: '默认项目键' },
      { key: 'saTokenRef', type: 'secret', default: 'acme.jira.saToken', secret: true, label: '服务账号令牌引用' },
      { key: 'syncMode', type: 'select', default: 'bidirectional', secret: false, label: '同步模式', options: ['push', 'pull', 'bidirectional'] },
    ],
    ui: [{ surface: 'inline_card', name: '任务同步卡', desc: '会话内联卡片：显示外部工单映射与同步状态' }],
  },
  {
    id: 'com.acme.secret-guard', name: '密钥防护', version: '3.2.0', author: 'ACME Security', sig: 'verified',
    mode: 'in-process', ext: ['tool.decorator', 'hook.impl', 'policy.rule'], perms: ['workspace:read', 'secret:ref:acme.scan.rulepack'],
    mem: 128, conc: 8, health: '就绪', healthReason: '扩展点调用开销 P95 42µs（进程内）', reloadable: true, source: 'org-registry', prev: '3.1.4',
    config: [
      { key: 'rulepackRef', type: 'secret', default: 'acme.scan.rulepack', secret: true, label: '规则包引用' },
      { key: 'blockOnHigh', type: 'boolean', default: true, secret: false, label: '高危命中阻断' },
      { key: 'entropyThreshold', type: 'number', default: 4.2, secret: false, label: '熵阈值' },
    ],
    ui: [{ surface: 'settings_page', name: '密钥防护设置', desc: '规则包版本与阻断策略' }],
  },
  {
    id: 'com.acme.legacy-adapter', name: '遗留系统适配', version: '0.9.0', author: 'ACME Modernization', sig: 'verified',
    mode: 'out-of-process', ext: ['connector.provider', 'parser'], perms: ['network:egress:[legacy.acme.internal]', 'workspace:read'],
    mem: 384, conc: 2, health: '降级', healthReason: '初始化超时（>1500ms）后成功，但心跳不稳（3 次探测 1 次超时）；扩展点自动降级到内置实现', reloadable: false, source: 'org-registry', prev: null,
    config: [
      { key: 'endpoint', type: 'string', default: 'https://legacy.acme.internal/api', secret: false, label: '遗留系统端点' },
      { key: 'timeoutMs', type: 'number', default: 1500, secret: false, label: '初始化超时（ms）' },
    ],
  },
  {
    id: 'com.acme.billing-sink', name: '计量结算上报', version: '1.4.2', author: 'ACME Finance Platform', sig: 'verified',
    mode: 'remote', ext: ['usage.sink', 'billing.sink'], perms: ['network:egress:[billing.acme.internal]', 'secret:ref:acme.billing.key'],
    mem: 0, conc: 16, health: '就绪', healthReason: '远程服务健康（P95 18ms），配额 200 QPS 内', reloadable: true, source: 'org-registry', prev: '1.4.1',
    config: [
      { key: 'endpoint', type: 'string', default: 'https://billing.acme.internal/v2/usage', secret: false, label: '结算端点' },
      { key: 'apiKeyRef', type: 'secret', default: 'acme.billing.key', secret: true, label: 'API Key 引用' },
      { key: 'batchSize', type: 'number', default: 200, secret: false, label: '批大小' },
    ],
  },
  {
    id: 'com.community.fast-edit', name: '极速批量编辑（社区）', version: '0.3.0', author: 'community-user-8821', sig: 'invalid',
    mode: 'in-process', ext: ['tool.decorator'], perms: ['workspace:write', 'tool.execute:commands'],
    mem: 256, conc: 8, health: '故障', healthReason: '签名校验失败（fingerprint 与发布者公钥不匹配），装载流水线在「校验签名」阶段终止并隔离；未注册任何扩展点',
    reloadable: false, source: 'market', failStage: '校验签名', prev: null,
  },
  {
    id: 'com.acme.flaky-detector', name: 'Flaky 用例检测', version: '2.0.1', author: 'ACME Quality', sig: 'verified',
    mode: 'in-process', ext: ['verification.provider', 'workitem.view'], perms: ['workspace:read', 'tool.execute:commands'],
    mem: 160, conc: 4, health: '就绪', healthReason: '六类归因模型已加载（观察窗口 14 天）', reloadable: true, source: 'org-registry', prev: '2.0.0',
    config: [
      { key: 'windowDays', type: 'number', default: 14, secret: false, label: '观察窗口（天）' },
      { key: 'rerunTimes', type: 'number', default: 5, secret: false, label: '重跑次数' },
    ],
  },
  {
    id: 'com.acme.ui-timeline', name: '会话时间线面板', version: '1.1.0', author: 'ACME Client Team', sig: 'verified',
    mode: 'in-process', ext: ['ui.panel', 'ui.command', 'ui.status_bar_item', 'ui.inline_card'], perms: ['session:read'],
    mem: 96, conc: 4, health: '就绪', healthReason: '沙箱化渲染容器就绪（受控 iframe，无 DOM 全权）', reloadable: true, source: 'market', prev: '1.0.2',
    ui: [
      { surface: 'panel', name: '时间线面板', desc: '按 Turn 聚合的横向时间线' },
      { surface: 'command', name: 'oc timeline', desc: '命令面板项' },
      { surface: 'status_bar_item', name: '当前 Turn 耗时', desc: '状态栏项' },
      { surface: 'inline_card', name: '决策摘要卡', desc: '会话内联卡片' },
      { surface: 'notification_template', name: '长任务提醒模板', desc: '通知模板（静默时段不穿透）' },
    ],
  },
  {
    id: 'com.acme.dlp-scanner', name: 'DLP 外发扫描', version: '2.6.0', author: 'ACME Security', sig: 'verified',
    mode: 'out-of-process', ext: ['policy.rule', 'egress.guard'], perms: ['workspace:read', 'network:egress:[dlp.acme.internal]', 'workspace:write'],
    mem: 512, conc: 1, health: '故障', healthReason: '错误率 38%（阈值 5%）触发熔断：该插件的 policy.rule 扩展点已停用，内核回退到内置规则；半开探测中',
    circuit: { state: 'open', reason: '错误率 38% > 阈值 5%（窗口 60s，样本 120），已打开熔断并告警' },
    reloadable: true, source: 'org-registry', denied: ['workspace:write'], prev: '2.5.1',
    config: [
      { key: 'dlpEndpoint', type: 'string', default: 'https://dlp.acme.internal/scan', secret: false, label: 'DLP 服务端点' },
      { key: 'scanTimeoutMs', type: 'number', default: 800, secret: false, label: '扫描超时（ms）' },
    ],
  },
  {
    id: 'com.acme.coverage-report', name: '覆盖率报告器', version: '0.8.5', author: 'ACME Quality', sig: 'unsigned',
    mode: 'in-process', ext: ['report.renderer'], perms: ['workspace:read'],
    mem: 128, conc: 2, health: '就绪', healthReason: '已就绪（未签名：本地开发来源，企业策略允许 local 来源未签名插件，但禁止发布到私仓）', reloadable: false, source: 'local', prev: null,
  },
  {
    id: 'com.acme.model-router-ext', name: '模型路由扩展', version: '1.2.0', author: 'ACME AI Platform', sig: 'verified',
    mode: 'remote', ext: ['router.rule', 'decorator'], perms: ['network:egress:[router.acme.internal]', 'secret:ref:acme.router.key'],
    mem: 0, conc: 32, health: '就绪', healthReason: '远程健康检查通过（P95 22ms）', reloadable: true, source: 'org-registry', prev: '1.1.3',
    config: [
      { key: 'routerEndpoint', type: 'string', default: 'https://router.acme.internal/v1', secret: false, label: '路由服务端点' },
      { key: 'apiKeyRef', type: 'secret', default: 'acme.router.key', secret: true, label: 'API Key 引用' },
      { key: 'fallbackToBuiltin', type: 'boolean', default: true, secret: false, label: '远程故障时回退内置（仅报错声明）' },
    ],
  },
  {
    id: 'com.acme.notify-templates', name: '通知模板包', version: '1.0.0', author: 'ACME Client Team', sig: 'verified',
    mode: 'in-process', ext: ['ui.notification_template'], perms: [],
    mem: 64, conc: 2, health: '就绪', healthReason: '模板校验通过（六类模板，P0 穿透规则遵循全局设置）', reloadable: true, source: 'market', prev: null,
    ui: [
      { surface: 'notification_template', name: '任务完成模板', desc: '含证据摘要与成本' },
      { surface: 'notification_template', name: '安全事件模板', desc: 'P0 可穿透静默时段' },
    ],
  },
];

const KERNELS = ['1.0', '1.1', '1.2', '1.3'];

function buildPlugins(r: Rng): PluginData[] {
  return PLUGIN_SEEDS.map((seed, pi) => {
    const failAt = seed.failStage;
    const stages = ['扫描来源', '读取清单', '校验签名', '兼容性检查', '依赖解析', '装配与注入', '初始化'];
    const loadLog: PluginLoadStep[] = stages.map((stage) => {
      const failed = failAt ? stage === failAt : stage === '初始化' && seed.health === '降级';
      const before = failAt ? stages.indexOf(stage) < stages.indexOf(failAt) : true;
      const ok = failAt ? before : !failed;
      return {
        stage,
        ok,
        detail: !before && failAt
          ? `已终止：${seed.healthReason}`
          : ok
            ? stage === '校验签名'
              ? `签名有效（${seed.sig === 'verified' ? '发布者公钥匹配' : '本地来源未签名，策略允许'}）`
              : stage === '兼容性检查'
                ? `内核 >=1.2 <2.0 兼容；宿主形态 ${seed.mode}`
                : stage === '依赖解析'
                  ? `依赖 ${seed.depsP?.length ?? 0} 个插件 / ${seed.depsS?.length ?? 0} 个技能，拓扑排序无环`
                  : stage === '初始化'
                    ? seed.healthReason
                    : `${stage}完成`
            : `失败：${seed.healthReason}`,
        ms: ok ? r.int(6, 420) : r.int(900, 1800),
      };
    });
    const denied = (seed.denied ?? []).map((perm, i) => ({
      permission: perm,
      reason: '清单声明超出安装者权限范围（无权限放大），运行期门面已拒绝并记录 plugin.permission.denied 审计',
      at: r.agoHours(i + 3),
    }));
    const granted = seed.perms.filter((p) => !(seed.denied ?? []).includes(p));
    const healthy = seed.health === '就绪';
    return {
      id: seed.id,
      name: seed.name,
      version: seed.version,
      author: seed.author,
      signature: {
        state: seed.sig,
        signer: seed.sig === 'verified' ? (seed.source === 'org-registry' ? '云枢科技 平台安全组' : 'OpenCoding 市场签发') : seed.sig === 'unsigned' ? '（无签名）' : 'unknown-publisher',
        fingerprint: seed.sig === 'verified' ? `ed:${r.int(10, 99)}:${r.int(10, 99)}:4a:${r.int(10, 99)}:c1` : seed.sig === 'unsigned' ? '—' : '??:??:de:ad:be:ef',
        reason: seed.sig === 'invalid' ? '签名校验失败：fingerprint 与公钥信任链不匹配（可能被篡改），已隔离并告警' : undefined,
      },
      kernel: { compatible: '>=1.2 <2.0', hostMode: seed.mode },
      capabilities: { extensions: seed.ext, permissions: seed.perms },
      resources: { maxMemoryMb: seed.mem, maxConcurrency: seed.conc },
      configSchema: seed.config ?? [
        { key: 'enabledFeatures', type: 'string', default: 'all', secret: false, label: '启用特性集' },
      ],
      reloadable: seed.reloadable,
      dependencies: { plugins: seed.depsP ?? [], skills: seed.depsS ?? [] },
      health: seed.health,
      healthReason: seed.healthReason,
      metrics: {
        callTotal: healthy ? r.int(400, 42_000) : r.int(40, 900),
        errorTotal: healthy ? r.int(0, 60) : seed.circuit ? r.int(300, 900) : r.int(20, 120),
        initLatencyMs: seed.health === '降级' ? r.int(1500, 2400) : r.int(120, 900),
        memoryBytes: seed.mem * 1024 * 1024 * (healthy ? r.float(0.42, 0.86, 2) : r.float(0.7, 0.98, 2)),
        trend: Array.from({ length: 10 }, () => r.float(healthy ? 4 : 120, healthy ? 40 : 900, 0)),
      },
      circuitState: seed.circuit?.state ?? 'closed',
      circuitReason: seed.circuit?.reason ?? '错误率与超时均在阈值内，闭合',
      grantedPermissions: granted,
      deniedPermissions: denied,
      loadLog,
      uiExtensions: seed.ui ?? [],
      source: seed.source,
      compat: KERNELS.map((k, i) => ({ kernel: k, state: i === KERNELS.length - 1 && pi % 5 === 0 ? 'untested' : Number(k) >= 1.2 ? 'supported' : 'unsupported' })),
      previousVersion: seed.prev ?? null,
    };
  });
}

/* ============================== 扩展点目录（卷 18 §4.1） ============================== */

export interface ExtensionPointData {
  spi: string;
  stability: 'stable' | 'evolving' | 'experimental';
  locality: '内' | '外' | '内 / 外';
  desc: string;
}

export interface ExtensionDomainData {
  domain: string;
  volume: string;
  stability: 'stable' | 'evolving' | 'experimental';
  locality: '内' | '外' | '内 / 外';
  points: ExtensionPointData[];
}

const CATALOG_SEEDS: { domain: string; volume: string; stability: ExtensionDomainData['stability']; locality: ExtensionDomainData['locality']; points: [string, string][] }[] = [
  { domain: '架构', volume: '卷 01', stability: 'stable', locality: '内', points: [['StoragePort', '持久化抽象（不得直连 DB）'], ['RuntimeStorePort', '运行时状态存储'], ['HostAdapterPort', '宿主形态适配'], ['ProtocolCodec', '协议编解码'], ['ClockPort/IdPort', '时钟与标识生成'], ['CapabilityProbe', '能力探测'], ['AssemblerContributor', '装配贡献'], ['SurfaceRenderer', '界面族渲染']] },
  { domain: '模型', volume: '卷 02', stability: 'stable', locality: '内 / 外', points: [['ProtocolAdapter', '协议适配（Anthropic/OpenAI/Gemini/Ollama）'], ['RouterRule', '路由规则'], ['Decorator', '装饰器链'], ['UsageSink', '用量落点'], ['SecretResolver', '密钥解析（引用式）'], ['EmbeddingProvider', '嵌入提供者'], ['ContentSanitizer', '内容净化']] },
  { domain: '上下文', volume: '卷 03', stability: 'evolving', locality: '内 / 外', points: [['TokenizerEstimator', 'token 估算'], ['SectionProvider', '区段提供者'], ['Compressor', '压缩器'], ['RetrievalAugmentor', '检索增强'], ['InjectionDetector', '注入检测'], ['ContextView', '上下文视图']] },
  { domain: '提示词', volume: '卷 04', stability: 'evolving', locality: '内', points: [['AssetSource', '资产来源'], ['FragmentProvider', '片段提供者'], ['PolicyRule', '策略规则'], ['AssemblyStage', '装配阶段'], ['EvalHook', '评测钩子']] },
  { domain: '工具', volume: '卷 05', stability: 'stable', locality: '内 / 外', points: [['ToolProvider', '工具提供者'], ['ToolDecorator', '工具装饰器'], ['ToolResultRenderer', '结果渲染器'], ['ConflictResolver', '冲突解决'], ['ToolAlias', '别名映射'], ['SandboxPolicyContributor', '沙箱策略贡献']] },
  { domain: '权限', volume: '卷 06', stability: 'stable', locality: '内 / 外', points: [['PolicyProvider', '策略提供者'], ['PolicyRule', '策略规则'], ['RiskAssessor', '风险评级'], ['ApprovalChannel', '审批通道'], ['ApprovalPolicy', '审批策略'], ['AuditSink', '审计落点'], ['CapabilityToken', '能力令牌']] },
  { domain: '沙箱', volume: '卷 07', stability: 'evolving', locality: '外', points: [['IsolationProvider', '隔离提供者'], ['DangerRule', '危险规则'], ['NetworkPolicy', '网络策略'], ['CredentialBroker', '凭证代理'], ['SnapshotProvider', '快照提供者'], ['ExecutionRecorder', '执行录制']] },
  { domain: 'Skill', volume: '卷 08', stability: 'evolving', locality: '内', points: [['SkillSource', '技能来源（四源）'], ['SkillTrigger', '自定义触发器'], ['SkillRouter', '语义路由'], ['SkillAssembler', '装配钩子'], ['SkillEval', '评测运行器'], ['SkillPublisher', '发布通道']] },
  { domain: 'MCP', volume: '卷 09', stability: 'evolving', locality: '内 / 外', points: [['McpTransport', '新传输实现'], ['McpAuth', '自定义认证'], ['McpCapabilityMapper', '能力映射策略'], ['McpPolicy', '准入与外发策略'], ['McpExposure', '对外暴露选择器']] },
  { domain: '记忆', volume: '卷 10', stability: 'evolving', locality: '内 / 外', points: [['MemoryStore', '记忆存储'], ['MemoryWriter', '写入器'], ['MemoryRanker', '排序器'], ['PiiDetector', 'PII 检测'], ['MemorySync', '文件化同步']] },
  { domain: '知识', volume: '卷 11', stability: 'evolving', locality: '内 / 外', points: [['Connector', '连接器'], ['Parser', '解析器'], ['Chunker', '分块器'], ['EmbeddingProvider', '嵌入提供者'], ['Reranker', '重排器'], ['IndexStore', '索引存储'], ['KnowledgePolicy', '知识策略']] },
  { domain: 'Agent', volume: '卷 12', stability: 'evolving', locality: '内', points: [['LoopStrategy', '循环策略'], ['PlanningStrategy', '规划策略'], ['SubAgentPolicy', '子 Agent 策略'], ['VerificationProvider', '验证提供者'], ['ProgressMetric', '进度度量'], ['AgentDefinitionSource', 'Agent 定义来源'], ['TrajectoryExporter', '轨迹导出']] },
  { domain: 'Teams', volume: '卷 13', stability: 'experimental', locality: '内', points: [['RoleLibrary', '角色库'], ['Topology', '拓扑'], ['AssignmentStrategy', '指派策略'], ['ArbitrationPolicy', '仲裁策略'], ['TeamBudgetPolicy', '团队预算策略'], ['TeamView', '团队视图']] },
  { domain: '任务', volume: '卷 14', stability: 'evolving', locality: '内', points: [['WorkItemType', '任务类型'], ['DecompositionStrategy', '分解策略'], ['PriorityPolicy', '优先级策略'], ['AcceptanceValidator', '验收校验器'], ['TaskTemplateProvider', '模板提供者'], ['WorkItemView', '任务视图']] },
  { domain: 'Goal/Schedule', volume: '卷 15', stability: 'evolving', locality: '内 / 外', points: [['Trigger', '触发器'], ['AutonomyPolicy', '自治策略'], ['ReportFormatter', '汇报格式化'], ['NotificationChannel', '通知通道'], ['GoalProgressMetric', '目标进度度量'], ['CircuitBreakerPolicy', '熔断策略']] },
  { domain: '事件', volume: '卷 16', stability: 'stable', locality: '内 / 外', points: [['EventProducer', '事件生产者'], ['EventConsumer', '事件消费者'], ['Projection', '投影'], ['RedactionRule', '脱敏规则'], ['EventExportSink', '导出落点'], ['ReplayPolicy', '重放策略']] },
  { domain: 'Hooks', volume: '卷 17', stability: 'evolving', locality: '内 / 外', points: [['HookPoint', '新增钩子点（版本化）'], ['HookImpl', '新实现形态'], ['HookMatcher', '自定义匹配'], ['HookPolicy', '企业钩子策略'], ['HookTemplateProvider', '模板来源']] },
  { domain: '工作区', volume: '卷 20', stability: 'stable', locality: '外', points: [['WorkspaceProvider', '工作区提供者（local/ssh/container/cloud）'], ['FileSyncStrategy', '文件同步策略'], ['EnvironmentProbe', '环境探测'], ['ProcessSupervisor', '进程监管']] },
  { domain: 'Git', volume: '卷 21', stability: 'evolving', locality: '内 / 外', points: [['GitHostProvider', '托管平台（GitHub/GitLab/内网）'], ['MergeStrategy', '合并策略'], ['ConflictResolver', '冲突解决'], ['CommitPolicy', '提交策略']] },
  { domain: '端', volume: '卷 22', stability: 'experimental', locality: '外', points: [['UIPanelExtension', '面板扩展'], ['UICommandExtension', '命令扩展'], ['UISettingsPageExtension', '设置页扩展'], ['RendererExtension', '渲染扩展（沙箱化）']] },
  { domain: '企业', volume: '卷 24', stability: 'stable', locality: '内 / 外', points: [['IdentityProvider', 'SSO 身份源'], ['BillingSink', '计量落点'], ['ComplianceReport', '合规报告'], ['FeatureFlagProvider', '特性开关']] },
  { domain: '前沿', volume: '卷 25', stability: 'experimental', locality: '外', points: [['ExperimentProvider', '实验提供者'], ['ComputerUseAdapter', '计算机使用适配']] },
];

function buildCatalog(): ExtensionDomainData[] {
  return CATALOG_SEEDS.map((d) => ({
    domain: d.domain,
    volume: d.volume,
    stability: d.stability,
    locality: d.locality,
    points: d.points.map(([spi, desc]) => ({ spi, stability: d.stability, locality: d.locality, desc })),
  }));
}

/* ============================== 审计与网关等横切数据 ============================== */

export interface ExtensionAuditEvent {
  id: string;
  type: 'skill.capability.denied' | 'plugin.permission.denied' | 'mcp.policy.denied' | 'hook.blocked' | 'hook.rewritten' | 'signature.rejected';
  subject: string;
  detail: string;
  decision: 'DENY' | 'ALLOW' | 'BLOCK' | 'REWRITE';
  traceId: string;
  at: string;
}

export interface ExtensionData {
  skills: SkillData[];
  mcpServers: McpServerData[];
  hooks: HookData[];
  hookPoints: HookPointData[];
  hookTemplates: HookTemplate[];
  plugins: PluginData[];
  extensionCatalog: ExtensionDomainData[];
  auditEvents: ExtensionAuditEvent[];
  distribution: {
    channel: 'local' | 'org-registry' | 'market';
    label: string;
    enabled: boolean;
    requireSignature: boolean;
    enterpriseToggle: boolean;
    published: number;
    lastSyncAt: string;
    note: string;
  }[];
  mcpGateway: {
    enabled: boolean;
    mode: 'proxy' | 'passthrough';
    endpoint: string;
    whitelist: string[];
    dlpRules: { id: string; rule: string; action: 'block' | 'redact' | 'audit'; hits: number }[];
    quota: { qps: number; dailyEgressMb: number; usedEgressMb: number };
    credentialPolicy: string;
  };
  autoActivation: { skill: string; enabled: boolean; reason: string; lastTriggeredAt: string | null }[];
}

/** 构建扩展体系全域数据（确定性：仅用 r.* 与固定字面量） */
export function buildExtensionData(r: Rng): ExtensionData {
  const skills = buildSkills(r);
  const mcpServers = buildMcp(r);
  const hooks = buildHooks(r);
  const plugins = buildPlugins(r);

  const auditEvents: ExtensionAuditEvent[] = [
    {
      id: 'AE-01', type: 'signature.rejected', subject: 'community.speedrun.mega-edits@0.1.0',
      detail: '签名校验失败（公钥信任链不匹配），装载期隔离；未注册任何能力，未产生工具调用',
      decision: 'DENY', traceId: 'trace-9a3f21c4', at: r.agoHours(2),
    },
    {
      id: 'AE-02', type: 'plugin.permission.denied', subject: 'com.acme.dlp-scanner@2.6.0',
      detail: '运行期申请 workspace:write（清单已声明但超出安装者权限）；门面拒绝并回退内置规则，未静默放行',
      decision: 'DENY', traceId: 'trace-4c81be07', at: r.agoHours(5),
    },
    {
      id: 'AE-03', type: 'skill.capability.denied', subject: 'acme.data.pipeline-migration@0.9.1',
      detail: '缺少 secret 引用 acme.odps.token 的授权；拒绝激活并提示申请路径（不降级为匿名访问）',
      decision: 'DENY', traceId: 'trace-71f0d2aa', at: r.agoHours(9),
    },
    {
      id: 'AE-04', type: 'hook.blocked', subject: 'HK-02 敏感信息扫描（提交前）',
      detail: '命中高危规则「私钥文件入库」；阻断 git.commit.before，后续钩子未执行',
      decision: 'BLOCK', traceId: 'trace-2b90ee51', at: r.agoHours(11),
    },
    {
      id: 'AE-05', type: 'hook.rewritten', subject: 'HK-03 工具结果脱敏改写',
      detail: '改写 result.content 中的 Authorization 头（明文 → 引用式），改写通过 Schema 校验并重新走权限决策',
      decision: 'REWRITE', traceId: 'trace-6d1c47f9', at: r.agoHours(14),
    },
    {
      id: 'AE-06', type: 'mcp.policy.denied', subject: 'mcp-k8s-gateway.apply_manifest',
      detail: '企业策略禁止经 MCP 执行写类集群操作（R4）；已拒绝，替代路径：走 GitOps 提交清单',
      decision: 'DENY', traceId: 'trace-8ef2b3c1', at: r.agoHours(20),
    },
  ];

  const distribution: ExtensionData['distribution'] = [
    { channel: 'local', label: '本地目录（.oc/skills）', enabled: true, requireSignature: false, enterpriseToggle: false, published: 6, lastSyncAt: r.ago(30), note: '开发期最快通道；企业可要求本地也必须签名' },
    { channel: 'org-registry', label: '组织私仓（oc://org-registry）', enabled: true, requireSignature: true, enterpriseToggle: true, published: 18, lastSyncAt: r.agoHours(4), note: '企业默认通道；强制签名 + 管理员审核' },
    { channel: 'market', label: '公共市场', enabled: false, requireSignature: true, enterpriseToggle: true, published: 0, lastSyncAt: r.agoDays(9), note: '企业策略已禁用公共市场：仅允许私仓白名单来源' },
  ];

  return {
    skills,
    mcpServers,
    hooks,
    hookPoints: HOOK_POINTS,
    hookTemplates: HOOK_TEMPLATES,
    plugins,
    extensionCatalog: buildCatalog(),
    auditEvents,
    distribution,
    mcpGateway: {
      enabled: true,
      mode: 'proxy',
      endpoint: 'https://mcp-gw.acme.internal',
      whitelist: ['api.github.com', 'acme.atlassian.net', 'k8s-api.internal.acme.com', 'api.figma.com'],
      dlpRules: [
        { id: 'DLP-01', rule: '禁止外发源代码行（>40 行连续源码）', action: 'block', hits: 12 },
        { id: 'DLP-02', rule: '身份证 / 银行卡号 → 脱敏后外发', action: 'redact', hits: 3 },
        { id: 'DLP-03', rule: '密钥类字符串直接外发', action: 'block', hits: 7 },
        { id: 'DLP-04', rule: '非白名单域名出网', action: 'audit', hits: 26 },
      ],
      quota: { qps: 200, dailyEgressMb: 5120, usedEgressMb: 1873 },
      credentialPolicy: '统一凭证：客户端不持有服务器原始密钥，由网关按 scope 换发短期令牌（引用式，明文仅存网关内存）',
    },
    autoActivation: [
      { skill: 'acme.finance.reconcile-report@3.0.0', enabled: true, reason: '命中关键词「对账」；近 30 天 96% 建议被采纳', lastTriggeredAt: r.agoHours(1) },
      { skill: 'acme.ai.prompt-eval@2.2.0', enabled: true, reason: '提示词资产更新事件；门禁类技能（不自动执行仅自动装配）', lastTriggeredAt: r.agoHours(6) },
      { skill: 'acme.qa.api-contract-test@3.1.2', enabled: false, reason: '语义路由置信度 0.74 低于阈值 0.8，仅保留建议', lastTriggeredAt: null },
      { skill: 'community.react.perf-profiler@1.1.0', enabled: false, reason: '未签名技能，自动激活被企业策略禁止', lastTriggeredAt: null },
    ],
  };
}

/** 页面直接引用的固定种子实例（刷新一致） */
export const extensionData = buildExtensionData(new Rng(20260921));
