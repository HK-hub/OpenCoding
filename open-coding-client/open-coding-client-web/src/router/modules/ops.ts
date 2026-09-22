/**
 * 运维域路由（卷 32 / 卷 31 / BUILD-MANIFEST G5-01…G5-07、G4-01…G4-05）。默认导出 OcRoute[]。
 */
import type { OcRoute } from '../types';

export default [
  { path: '/ops/slo', name: 'ops-slo', component: () => import('@/views/ops/SloBurn.vue'), meta: { title: 'SLO 与燃尽', group: '质量与运维', groupOrder: 12, order: 20, icon: 'chart-line', desc: '5 项 SLO + 快慢燃尽 + 违反冻结发布', surface: 'settings', volume: '卷 32', manifest: 'G5-01' } },
  { path: '/ops/alerts', name: 'ops-alerts', component: () => import('@/views/ops/AlertCenter.vue'), meta: { title: '告警中心', group: '质量与运维', groupOrder: 12, order: 21, icon: 'notification', desc: 'P0/P1/P2 ≥12 条 + 唯一 Runbook + 验证命令 + 成功判据', surface: 'settings', volume: '卷 32', manifest: 'G5-02' } },
  { path: '/ops/runbooks', name: 'ops-runbooks', component: () => import('@/views/ops/Runbooks.vue'), meta: { title: 'Runbook 库', group: '质量与运维', groupOrder: 12, order: 22, icon: 'bookmark', desc: 'RB-01…RB-12 步骤勾选 + 命令 + 成功判据 + 执行记录', surface: 'settings', volume: '卷 32', manifest: 'G5-03' } },
  { path: '/ops/drills', name: 'ops-drills', component: () => import('@/views/ops/Drills.vue'), meta: { title: '故障演练', group: '质量与运维', groupOrder: 12, order: 23, icon: 'sound', desc: '九类演练 + 报告 + 改进项落代码/配置/测试/文档', surface: 'settings', volume: '卷 32', manifest: 'G5-04' } },
  { path: '/ops/postmortem', name: 'ops-postmortem', component: () => import('@/views/ops/Postmortem.vue'), meta: { title: '复盘', group: '质量与运维', groupOrder: 12, order: 24, icon: 'history', desc: '7 段模板 + 改进项必须落四类之一', surface: 'settings', volume: '卷 32', manifest: 'G5-05' } },
  { path: '/ops/on-call', name: 'ops-oncall', component: () => import('@/views/ops/OnCall.vue'), meta: { title: '值班与升级', group: '质量与运维', groupOrder: 12, order: 25, icon: 'user', desc: '主副班 + 四级升级 15/30/60 分钟 + 交接单', surface: 'settings', volume: '卷 32', manifest: 'G5-06' } },
  { path: '/ops/waterline', name: 'ops-waterline', component: () => import('@/views/ops/Waterline.vue'), meta: { title: '容量水位', group: '质量与运维', groupOrder: 12, order: 26, icon: 'chart', desc: '四级水位 <60/60-80/80-90/≥90 + 一键执行动作', surface: 'settings', volume: '卷 32', manifest: 'G5-07、G4-05' } },
  { path: '/ops/extreme', name: 'ops-extreme', component: () => import('@/views/ops/ExtremeScenarios.vue'), meta: { title: '极端组合场景', group: '质量与运维', groupOrder: 12, order: 27, icon: 'error', desc: 'RB-12 七组合场景 + 降级顺序 + 恢复判据', surface: 'settings', volume: '卷 32', manifest: 'G5-04' } },
  { path: '/ops/capacity-model', name: 'ops-capacity-model', component: () => import('@/views/ops/CapacityModel.vue'), meta: { title: '容量模型', group: '质量与运维', groupOrder: 12, order: 28, icon: 'database', desc: '容量公式卡 + 10k 用户测算 + 校准偏差', surface: 'cost', volume: '卷 31', manifest: 'G4-01' } },
  { path: '/ops/cost-attribution', name: 'ops-cost-attribution', component: () => import('@/views/ops/CostAttribution.vue'), meta: { title: '成本归因', group: '质量与运维', groupOrder: 12, order: 29, icon: 'discount', desc: '六维 + 缓存单列 + 下钻 + 误差 ≤1% + 异常标记', surface: 'cost', volume: '卷 31', manifest: 'G4-02', permission: 'billing.read' } },
  { path: '/ops/optimization', name: 'ops-optimization', component: () => import('@/views/ops/Optimization.vue'), meta: { title: '优化清单', group: '质量与运维', groupOrder: 12, order: 30, icon: 'lightbulb', desc: '10 项 ROI + 前后对比 + 质量不劣化验证', surface: 'cost', volume: '卷 31', manifest: 'G4-03' } },
  { path: '/ops/unit-economics', name: 'ops-unit-economics', component: () => import('@/views/ops/UnitEconomics.vue'), meta: { title: '单位经济性', group: '质量与运维', groupOrder: 12, order: 31, icon: 'discount', desc: '三版本 + 每席/每任务成本 + 敏感度重算', surface: 'cost', volume: '卷 31', manifest: 'G4-01' } },
] as OcRoute[];
