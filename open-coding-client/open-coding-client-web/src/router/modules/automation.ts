import type { OcRoute } from '../types';

/**
 * 自动化模板库域路由（卷 34 / impl/31）。
 * 契约：模板是配置不是新执行路径；权限上限（禁 force-push/删分支/生产写/密钥读）；默认只提 PR。
 */
export default [
  {
    path: '/automation/templates',
    name: 'automation-templates',
    component: () => import('@/views/automation/TemplateMarket.vue'),
    meta: { title: '模板市场', group: '自动化与智能', groupOrder: 11, order: 1, icon: 'app', desc: '七个分类 × 12 内置模板族 + 风险徽标 / 来源角标 / 签名 / 已安装标记', surface: 'automation', volume: '卷 34', manifest: 'N2-01' },
  },
  {
    path: '/automation/templates/:id',
    name: 'automation-template-detail',
    component: () => import('@/views/automation/TemplateDetail.vue'),
    meta: { title: '模板详情', group: '自动化与智能', groupOrder: 11, order: 2, icon: 'file', desc: '概览 / 触发与目标 / 权限与预算 / 步骤与验收 / 度量 五 Tab', surface: 'automation', volume: '卷 34', manifest: 'N2-02', hidden: true },
  },
  {
    path: '/automation/install',
    name: 'automation-install',
    component: () => import('@/views/automation/InstallWizard.vue'),
    meta: { title: '安装配置向导', group: '自动化与智能', groupOrder: 11, order: 3, icon: 'add', desc: '装（来源+签名）→ 配（inputs 动态表单 + 目标 + 触发器）→ 启（门禁 + 授权快照 + 预算信封）', surface: 'automation', volume: '卷 34', manifest: 'N2-03', permission: 'automation.manage' },
  },
  {
    path: '/automation/dry-run',
    name: 'automation-dry-run',
    component: () => import('@/views/automation/DryRunConsole.vue'),
    meta: { title: '干跑控制台', group: '自动化与智能', groupOrder: 11, order: 4, icon: 'chart-line', desc: '「预期动作 + 权限清单」报告；零副作用、不消耗预算、≤60s', surface: 'automation', volume: '卷 34', manifest: 'N2-04' },
  },
  {
    path: '/automation/sandbox-trial',
    name: 'automation-sandbox-trial',
    component: () => import('@/views/automation/SandboxTrial.vue'),
    meta: { title: '沙箱试运行', group: '自动化与智能', groupOrder: 11, order: 5, icon: 'secured', desc: '步骤账本 + 断言结果 + 三件套门禁（干跑 / 沙箱试运行 / 产出断言）', surface: 'automation', volume: '卷 34', manifest: 'N2-05', permission: 'automation.manage' },
  },
  {
    path: '/automation/instances',
    name: 'automation-instances',
    component: () => import('@/views/automation/Instances.vue'),
    meta: { title: '模板实例', group: '自动化与智能', groupOrder: 11, order: 6, icon: 'layers', desc: '定义版本冻结 + 参数 + 目标 + 授权快照 + 预算信封；暂停 / 恢复 / 升级 / 复制', surface: 'automation', volume: '卷 34', manifest: 'N2-06', permission: 'automation.manage' },
  },
  {
    path: '/automation/runs',
    name: 'automation-runs',
    component: () => import('@/views/automation/RunHistory.vue'),
    meta: { title: '运行历史', group: '自动化与智能', groupOrder: 11, order: 7, icon: 'history', desc: '触发源 / 幂等键 / 终态 / 成本 / 耗时 / 产物 + 多维筛选与趋势', surface: 'automation', volume: '卷 34', manifest: 'N2-07' },
  },
  {
    path: '/automation/runs/:id',
    name: 'automation-run-detail',
    component: () => import('@/views/automation/RunDetail.vue'),
    meta: { title: '运行详情', group: '自动化与智能', groupOrder: 11, order: 8, icon: 'browse', desc: '步骤账本 + 状态机时间线 + 门禁断言 + 产物 + 成本账', surface: 'automation', volume: '卷 34', manifest: 'N2-08', hidden: true },
  },
  {
    path: '/automation/takeover',
    name: 'automation-takeover',
    component: () => import('@/views/automation/Takeover.vue'),
    meta: { title: '失败接管', group: '自动化与智能', groupOrder: 11, order: 9, icon: 'error', desc: 'ESCALATED / BLOCKED 队列 + 接管放行 / 放弃归档 / 一键修正 + backlog', surface: 'automation', volume: '卷 34', manifest: 'N2-09', permission: 'automation.manage' },
  },
  {
    path: '/automation/artifacts',
    name: 'automation-artifacts',
    component: () => import('@/views/automation/Artifacts.vue'),
    meta: { title: '产物', group: '自动化与智能', groupOrder: 11, order: 10, icon: 'file-copy', desc: '五类产物（pr / comment / report / notification / file）+ 幂等更新标记', surface: 'automation', volume: '卷 34', manifest: 'N2-10' },
  },
  {
    path: '/automation/metrics',
    name: 'automation-metrics',
    component: () => import('@/views/automation/MetricsBoard.vue'),
    meta: { title: '自动化度量', group: '自动化与智能', groupOrder: 11, order: 11, icon: 'chart-bar', desc: '四指标（节省时长 / 发现问题 / 采纳率 / 单位成本）+ 数据缺口标注', surface: 'automation', volume: '卷 34', manifest: 'N2-11' },
  },
  {
    path: '/automation/audit',
    name: 'automation-audit',
    component: () => import('@/views/automation/AuditSnapshot.vue'),
    meta: { title: '审计与授权快照', group: '自动化与智能', groupOrder: 11, order: 12, icon: 'lock', desc: '五项审计 × 三级（强制 / 条件 / 可关闭）+ 实例授权快照', surface: 'automation', volume: '卷 34', manifest: 'N2-13' },
  },
  {
    path: '/automation/export',
    name: 'automation-export',
    component: () => import('@/views/automation/ExportImport.vue'),
    meta: { title: '导出导入', group: '自动化与智能', groupOrder: 11, order: 13, icon: 'download', desc: '剥离凭证 / 绝对路径 / 内部地址 + 跨租户校验', surface: 'automation', volume: '卷 34', manifest: 'N2-14', permission: 'automation.manage' },
  },
  {
    path: '/automation/market-sync',
    name: 'automation-market-sync',
    component: () => import('@/views/automation/MarketSync.vue'),
    meta: { title: '市场同步', group: '自动化与智能', groupOrder: 11, order: 14, icon: 'cloud', desc: 'synced / sync.failed + 离线标记（保留缓存目录，不静默降级）', surface: 'automation', volume: '卷 34', manifest: 'N2-15', permission: 'automation.manage' },
  },
] as OcRoute[];
