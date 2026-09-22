import type { OcRoute } from '../types';

/**
 * 智能增强包域路由（卷 35 / impl/32）。
 * 契约：产出标注「AI 生成 + 模型 + 提示词版本」、可校订、不自动合并、成本可见、无依据明确拒答。
 */
export default [
  {
    path: '/intel/capabilities',
    name: 'intel-capabilities',
    component: () => import('@/views/intel/CapabilityCenter.vue'),
    meta: { title: '增强能力中心', group: '自动化与智能', groupOrder: 11, order: 20, icon: 'robot', desc: '8 项能力卡（类别徽标 / 触发面 / 启用开关）+ 四指标 KPI', surface: 'intel', volume: '卷 35', manifest: 'N3-01' },
  },
  {
    path: '/intel/capabilities/:id',
    name: 'intel-capability-detail',
    component: () => import('@/views/intel/CapabilityDetail.vue'),
    meta: { title: '能力详情', group: '自动化与智能', groupOrder: 11, order: 21, icon: 'file', desc: '描述符（触发面 / 输入输出契约 / 工具依赖 / 写范围 / 门禁档 / 预算）+ 运行历史 + 度量 + 反馈样本', surface: 'intel', volume: '卷 35', manifest: 'N3-02', hidden: true },
  },
  {
    path: '/intel/outputs',
    name: 'intel-outputs',
    component: () => import('@/views/intel/OutputInbox.vue'),
    meta: { title: '草稿收件箱', group: '自动化与智能', groupOrder: 11, order: 22, icon: 'mail', desc: '草稿卡（生成器标注 / 引用覆盖率 / 成本 / 状态）+ 采纳 / 编辑 / 驳回 / 误报', surface: 'intel', volume: '卷 35', manifest: 'N3-03', permission: 'intel.use' },
  },
  {
    path: '/intel/outputs/:id',
    name: 'intel-output-detail',
    component: () => import('@/views/intel/OutputDetail.vue'),
    meta: { title: '草稿详情', group: '自动化与智能', groupOrder: 11, order: 23, icon: 'browse', desc: '正文（PR 描述六段）+ 引用列表 + 与人类内容并排冲突（不覆盖）', surface: 'intel', volume: '卷 35', manifest: 'N3-04', hidden: true },
  },
  {
    path: '/intel/review-bot',
    name: 'intel-review-bot',
    component: () => import('@/views/intel/ReviewBot.vue'),
    meta: { title: '审查机器人', group: '自动化与智能', groupOrder: 11, order: 24, icon: 'bug', desc: '发现列表（ruleId / 位置 / 严重度 / 置信度 / 依据 / 修复建议）+ SARIF + 置信度折叠', surface: 'intel', volume: '卷 35', manifest: 'N3-05' },
  },
  {
    path: '/intel/review-threads',
    name: 'intel-review-threads',
    component: () => import('@/views/intel/ReviewThreads.vue'),
    meta: { title: '多轮修复线程', group: '自动化与智能', groupOrder: 11, order: 25, icon: 'chat-bubble', desc: '轮次（发现 / 修复 / 复验）+「请修复」+ 上限 6 轮 + BLOCKED', surface: 'intel', volume: '卷 35', manifest: 'N3-06', permission: 'intel.use' },
  },
  {
    path: '/intel/test-gen',
    name: 'intel-test-gen',
    component: () => import('@/views/intel/TestGen.vue'),
    meta: { title: '测试生成', group: '自动化与智能', groupOrder: 11, order: 26, icon: 'task-checked', desc: '测试 PR（单元 / 集成 / 属性）+ 覆盖率变化 + 残余说明 + 假测试拒收记录', surface: 'intel', volume: '卷 35', manifest: 'N3-07' },
  },
  {
    path: '/intel/flaky',
    name: 'intel-flaky',
    component: () => import('@/views/intel/Flaky.vue'),
    meta: { title: 'Flaky 检测', group: '自动化与智能', groupOrder: 11, order: 27, icon: 'refresh', desc: '观察清单 + 六类归因 + 隔离建议 + 修复 PR', surface: 'intel', volume: '卷 35', manifest: 'N3-08' },
  },
  {
    path: '/intel/doc-drift',
    name: 'intel-doc-drift',
    component: () => import('@/views/intel/DocDrift.vue'),
    meta: { title: '文档漂移', group: '自动化与智能', groupOrder: 11, order: 28, icon: 'file-copy', desc: '差异清单（缺失 / 过时 / 多余）+ 受保护段落徽标 + 冲突并排', surface: 'intel', volume: '卷 35', manifest: 'N3-09' },
  },
  {
    path: '/intel/standup',
    name: 'intel-standup',
    component: () => import('@/views/intel/Standup.vue'),
    meta: { title: 'Standup 与周报', group: '自动化与智能', groupOrder: 11, order: 29, icon: 'notification', desc: '客观事实层（带事件来源）/ 主观摘要层（标注 AI）/ 环比 / 需关注 / 数据缺口', surface: 'intel', volume: '卷 35', manifest: 'N3-10' },
  },
  {
    path: '/intel/qa',
    name: 'intel-qa',
    component: () => import('@/views/intel/RepoQa.vue'),
    meta: { title: '仓库知识问答', group: '自动化与智能', groupOrder: 11, order: 30, icon: 'help', desc: '问答流 + 引用列表 + 无依据拒答 + 权限不足拒答 + 作为上下文引用', surface: 'intel', volume: '卷 35', manifest: 'N3-11' },
  },
  {
    path: '/intel/migration',
    name: 'intel-migration',
    component: () => import('@/views/intel/MigrationAssistant.vue'),
    meta: { title: '迁移助手', group: '自动化与智能', groupOrder: 11, order: 31, icon: 'sitemap', desc: '规格卡 + 影响面 + 批次（≤50 文件）+ 每批验证 + 续跑点 + 报告', surface: 'intel', volume: '卷 35', manifest: 'N3-12', permission: 'intel.use' },
  },
  {
    path: '/intel/gate-reports',
    name: 'intel-gate-reports',
    component: () => import('@/views/intel/GateReports.vue'),
    meta: { title: '门禁拦截报告', group: '自动化与智能', groupOrder: 11, order: 32, icon: 'secured', desc: '拦截层（结构 / 引用 / 安全 / 人工门）+ 理由码 + 修复建议', surface: 'intel', volume: '卷 35', manifest: 'N3-13' },
  },
  {
    path: '/intel/budget',
    name: 'intel-budget',
    component: () => import('@/views/intel/BudgetPanel.vue'),
    meta: { title: '增强预算与熔断', group: '自动化与智能', groupOrder: 11, order: 33, icon: 'discount', desc: '单次 / 日预算 + 当前花费 + 熔断 + 分级路由 + 降级阶梯', surface: 'intel', volume: '卷 35', manifest: 'N3-14' },
  },
  {
    path: '/intel/feedback',
    name: 'intel-feedback',
    component: () => import('@/views/intel/FeedbackLoop.vue'),
    meta: { title: '反馈回灌与降权', group: '自动化与智能', groupOrder: 11, order: 34, icon: 'thumb-up', desc: '回灌队列（采纳 / 编辑 / 驳回 / 误报）+ 两段式降权 + 积压告警', surface: 'intel', volume: '卷 35', manifest: 'N3-15', permission: 'intel.use' },
  },
  {
    path: '/intel/eval-snapshots',
    name: 'intel-eval-snapshots',
    component: () => import('@/views/intel/EvalSnapshots.vue'),
    meta: { title: '评测快照回归', group: '自动化与智能', groupOrder: 11, order: 35, icon: 'check', desc: '期望输出快照 + 提示词改版回归比对', surface: 'intel', volume: '卷 35', manifest: 'N3-16' },
  },
] as OcRoute[];
