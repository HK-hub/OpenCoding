import type { OcRoute } from '../types';

/**
 * 任务与协作域路由（harness 卷 13 Agent Teams / 卷 14 任务与计划 / 卷 15 Goal 与 Schedule）。
 * 分组「任务与协作」＝ 任务与计划、Goal、Schedule、团队、人机混合。
 */
export default [
  {
    path: '/task/board',
    name: 'task-board',
    component: () => import('@/views/task/TaskBoard.vue'),
    meta: { title: '任务看板', group: '任务与协作', groupOrder: 2, order: 1, icon: 'task', desc: '七态列 + 拖拽改状态 + 证据驱动验收环 + 阻塞原因内联', surface: 'task', volume: '卷 14', manifest: 'J-01' },
  },
  {
    path: '/task/timeline',
    name: 'task-timeline',
    component: () => import('@/views/task/TaskTimeline.vue'),
    meta: { title: '任务时间线', group: '任务与协作', groupOrder: 2, order: 2, icon: 'time', desc: '成员泳道 × 时间 + 里程碑标记 + 依赖箭头 + 关键路径', surface: 'task', volume: '卷 14', manifest: 'J-02' },
  },
  {
    path: '/task/dependencies',
    name: 'task-dependencies',
    component: () => import('@/views/task/DependencyGraph.vue'),
    meta: { title: '依赖图', group: '任务与协作', groupOrder: 2, order: 3, icon: 'sitemap', desc: 'DAG 分层布局 + 关键路径高亮 + 环检测拒绝（含环路径）', surface: 'task', volume: '卷 14', manifest: 'J-03' },
  },
  {
    path: '/task/spec',
    name: 'task-spec',
    component: () => import('@/views/task/SpecReview.vue'),
    meta: { title: '规格评审', group: '任务与协作', groupOrder: 2, order: 4, icon: 'file', desc: '.oc/tasks/<id>.md 八段 + 版本 diff + 变更触发重规划', surface: 'task', volume: '卷 14', manifest: 'J-05' },
  },
  {
    path: '/task/decompose',
    name: 'task-decompose',
    component: () => import('@/views/task/Decomposition.vue'),
    meta: { title: '分解确认', group: '任务与协作', groupOrder: 2, order: 5, icon: 'layers', desc: 'AI 候选分解（理由 + 风险）→ 增删改 → 确认写入', surface: 'task', volume: '卷 14', manifest: 'J-06' },
  },
  {
    path: '/task/templates',
    name: 'task-templates',
    component: () => import('@/views/task/TemplateLibrary.vue'),
    meta: { title: '任务模板库', group: '任务与协作', groupOrder: 2, order: 6, icon: 'file-copy', desc: '六类常见任务的标准步骤、验收清单与风险提示', surface: 'task', volume: '卷 14', manifest: 'J-07' },
  },
  {
    path: '/task/tree',
    name: 'task-tree',
    component: () => import('@/views/task/WorkTree.vue'),
    meta: { title: '工作对象树', group: '任务与协作', groupOrder: 2, order: 7, icon: 'git', desc: 'Goal→Plan→Task→Step 递归分解与懒加载（10k 节点提示）', surface: 'task', volume: '卷 14', manifest: 'J-08' },
  },
  {
    path: '/task/preemption',
    name: 'task-preemption',
    component: () => import('@/views/task/Preemption.vue'),
    meta: { title: '抢占与恢复', group: '任务与协作', groupOrder: 2, order: 8, icon: 'flag', desc: '优先级排序 + 安全点抢占 + 检查点恢复 + 理由留痕', surface: 'task', volume: '卷 14', manifest: 'J-09' },
  },
  {
    path: '/task/acceptance',
    name: 'task-acceptance',
    component: () => import('@/views/task/Acceptance.vue'),
    meta: { title: '验收与证据', group: '任务与协作', groupOrder: 2, order: 9, icon: 'check', desc: '三级验证（L1 静态/L2 可执行/L3 语义）+ 证据链 + 完成报告', surface: 'task', volume: '卷 14', manifest: 'J-10' },
  },
  {
    path: '/task/detail',
    name: 'task-detail',
    component: () => import('@/views/task/TaskDetail.vue'),
    meta: { title: '任务详情', group: '任务与协作', groupOrder: 2, order: 10, icon: 'browse', desc: '概览/Step/验收/证据/依赖/规格/写范围/指派/预算/迁移历史', surface: 'task', volume: '卷 14', manifest: 'J-04', hidden: true },
  },
  {
    path: '/goal/list',
    name: 'goal-list',
    component: () => import('@/views/goal/GoalList.vue'),
    meta: { title: '目标列表', group: '任务与协作', groupOrder: 2, order: 11, icon: 'star', desc: '目标陈述 / 自治级别 / 进度 / 预算 / 漂移标记 / 状态', surface: 'task', volume: '卷 15', manifest: 'X-01' },
  },
  {
    path: '/goal/create',
    name: 'goal-create',
    component: () => import('@/views/goal/GoalCreate.vue'),
    meta: { title: '创建目标', group: '任务与协作', groupOrder: 2, order: 12, icon: 'add', desc: '八步向导：目标→验收→约束→预算→自治→介入点→汇报→终止', surface: 'wizard', volume: '卷 15', manifest: 'X-02' },
  },
  {
    path: '/goal/detail',
    name: 'goal-detail',
    component: () => import('@/views/goal/GoalDetail.vue'),
    meta: { title: '目标详情', group: '任务与协作', groupOrder: 2, order: 13, icon: 'chart-line', desc: '六 Tab：概览/验收证据/Tick 时间线/汇报/预算成本/介入点', surface: 'task', volume: '卷 15', manifest: 'X-03' },
  },
  {
    path: '/goal/achievement',
    name: 'goal-achievement',
    component: () => import('@/views/goal/GoalAchievement.vue'),
    meta: { title: '达成判定', group: '任务与协作', groupOrder: 2, order: 14, icon: 'task-checked', desc: '逐条结论 + 证据清单 → 确认/驳回；假完成被拦截', surface: 'task', volume: '卷 15', manifest: 'X-04' },
  },
  {
    path: '/goal/drift',
    name: 'goal-drift',
    component: () => import('@/views/goal/GoalDrift.vue'),
    meta: { title: '漂移告警', group: '任务与协作', groupOrder: 2, order: 15, icon: 'error', desc: '三类证据（验收进展 / 语义相似度 / 约束违反）+ 暂停/继续/调整', surface: 'task', volume: '卷 15', manifest: 'X-05' },
  },
  {
    path: '/schedule/list',
    name: 'schedule-list',
    component: () => import('@/views/schedule/ScheduleList.vue'),
    meta: { title: '计划列表', group: '任务与协作', groupOrder: 2, order: 21, icon: 'calendar', desc: '触发摘要 / 下次触发 / 上次结果 / 熔断状态 + 启停与手动触发', surface: 'automation', volume: '卷 15', manifest: 'X-06' },
  },
  {
    path: '/schedule/editor',
    name: 'schedule-editor',
    component: () => import('@/views/schedule/ScheduleEditor.vue'),
    meta: { title: '计划编辑器', group: '任务与协作', groupOrder: 2, order: 22, icon: 'edit', desc: '八区编辑器 + 字段级中文校验（含预授权 Allowlist 与熔断）', surface: 'automation', volume: '卷 15', manifest: 'X-07' },
  },
  {
    path: '/schedule/triggers',
    name: 'schedule-triggers',
    component: () => import('@/views/schedule/TriggerEditor.vue'),
    meta: { title: '触发器编辑器', group: '任务与协作', groupOrder: 2, order: 23, icon: 'time', desc: '五类触发器（时间/事件/条件/手动/组合）+ 时区 + 幂等键预览', surface: 'automation', volume: '卷 15', manifest: 'X-08' },
  },
  {
    path: '/schedule/calendar',
    name: 'schedule-calendar',
    component: () => import('@/views/schedule/ScheduleCalendar.vue'),
    meta: { title: '计划日历', group: '任务与协作', groupOrder: 2, order: 24, icon: 'calendar', desc: '日历视图 + 资源冲突（同工作区/分支/环境/预算池）+ 错峰建议', surface: 'automation', volume: '卷 15', manifest: 'X-09' },
  },
  {
    path: '/schedule/runs',
    name: 'schedule-runs',
    component: () => import('@/views/schedule/ScheduleRuns.vue'),
    meta: { title: '运行历史', group: '任务与协作', groupOrder: 2, order: 25, icon: 'history', desc: '触发源/决策/动作/结果/耗时/幂等键 + 一键回滚', surface: 'automation', volume: '卷 15', manifest: 'X-10' },
  },
  {
    path: '/schedule/safety',
    name: 'schedule-safety',
    component: () => import('@/views/schedule/ScheduleSafety.vue'),
    meta: { title: '预授权与熔断', group: '任务与协作', groupOrder: 2, order: 26, icon: 'secured', desc: '越界安全事件 + 熔断 open/closed + 人工确认恢复', surface: 'automation', volume: '卷 15', manifest: 'X-11' },
  },
  {
    path: '/team/overview',
    name: 'team-overview',
    component: () => import('@/views/team/TeamOverview.vue'),
    meta: { title: '团队总览', group: '任务与协作', groupOrder: 2, order: 31, icon: 'robot', desc: '三视图（拓扑/泳道/成本瀑布）+ 主管摘要 + 干预入口', surface: 'task', volume: '卷 13', manifest: 'R-01' },
  },
  {
    path: '/team/members',
    name: 'team-members',
    component: () => import('@/views/team/TeamMembers.vue'),
    meta: { title: '团队成员', group: '任务与协作', groupOrder: 2, order: 32, icon: 'user', desc: '角色/类型/工作区/预算配额/当前任务/状态 + 暂停与移除', surface: 'task', volume: '卷 13', manifest: 'R-02' },
  },
  {
    path: '/team/board',
    name: 'team-board',
    component: () => import('@/views/team/TeamBoard.vue'),
    meta: { title: '团队黑板', group: '任务与协作', groupOrder: 2, order: 33, icon: 'layers', desc: '任务列表 + 证据库 + 决策记录 + 阻塞清单 + 认领登记', surface: 'task', volume: '卷 13', manifest: 'R-03' },
  },
  {
    path: '/team/messages',
    name: 'team-messages',
    component: () => import('@/views/team/TeamMessages.vue'),
    meta: { title: '结构化消息', group: '任务与协作', groupOrder: 2, order: 34, icon: 'chat-bubble', desc: '七类消息（交接/求助/阻塞/提议/审查/裁决/预算告警）按类型过滤', surface: 'task', volume: '卷 13', manifest: 'R-04' },
  },
  {
    path: '/team/arbitration',
    name: 'team-arbitration',
    component: () => import('@/views/team/TeamArbitration.vue'),
    meta: { title: '仲裁与权限审计', group: '任务与协作', groupOrder: 2, order: 35, icon: 'secured', desc: '争议/观点/裁决/理由/影响 + 权限上限链（成员⊆团队⊆会话）', surface: 'task', volume: '卷 13', manifest: 'R-05、R-09' },
  },
  {
    path: '/team/budget',
    name: 'team-budget',
    component: () => import('@/views/team/TeamBudget.vue'),
    meta: { title: '团队预算与熔断', group: '任务与协作', groupOrder: 2, order: 36, icon: 'discount', desc: '总额/已用/剩余 + 动态回收 + 消耗率预警 + 熔断需人工恢复', surface: 'cost', volume: '卷 13', manifest: 'R-06' },
  },
  {
    path: '/team/merge',
    name: 'team-merge',
    component: () => import('@/views/team/TeamMerge.vue'),
    meta: { title: '隔离与合并', group: '任务与协作', groupOrder: 2, order: 37, icon: 'git', desc: '成员 worktree + 写范围声明 + 重叠串行化 + 合并队列 + 冲突与回滚', surface: 'task', volume: '卷 13', manifest: 'R-07' },
  },
  {
    path: '/team/human',
    name: 'team-human',
    component: () => import('@/views/team/TeamHuman.vue'),
    meta: { title: '人机混合', group: '任务与协作', groupOrder: 2, order: 38, icon: 'user-circle', desc: '人类任务认领/产出提交/SLA 超时转派 + 团队报告（阶段/完成）', surface: 'task', volume: '卷 13', manifest: 'R-10' },
  },
] as OcRoute[];
