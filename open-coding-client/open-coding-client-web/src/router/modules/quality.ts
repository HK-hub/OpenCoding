/**
 * 质量与评测域路由（卷 26 / BUILD-MANIFEST Y-01…Y-05）。默认导出 OcRoute[]。
 */
import type { OcRoute } from '../types';

export default [
  { path: '/quality/test-pyramid', name: 'qa-pyramid', component: () => import('@/views/quality/TestPyramid.vue'), meta: { title: '测试体系', group: '质量与运维', groupOrder: 12, order: 1, icon: 'layers', desc: '五层测试（单元/集成/契约/端到端/混沌）+ 覆盖率 + 门禁', surface: 'task', volume: '卷 26', manifest: 'Y-01' } },
  { path: '/quality/eval-tasks', name: 'qa-eval-tasks', component: () => import('@/views/quality/EvalTasks.vue'), meta: { title: '评测任务集', group: '质量与运维', groupOrder: 12, order: 2, icon: 'task', desc: '八类任务 + 权重 + 可复现环境 + 验收脚本', surface: 'task', volume: '卷 26', manifest: 'Y-01' } },
  { path: '/quality/eval-runs', name: 'qa-eval-runs', component: () => import('@/views/quality/EvalRuns.vue'), meta: { title: '评测运行', group: '质量与运维', groupOrder: 12, order: 3, icon: 'history', desc: '运行历史 + 版本对比 + 基线变更评审', surface: 'task', volume: '卷 26', manifest: 'Y-03' } },
  { path: '/quality/score', name: 'qa-score', component: () => import('@/views/quality/ScoreReport.vue'), meta: { title: '评分报告', group: '质量与运维', groupOrder: 12, order: 4, icon: 'chart', desc: '六维雷达 + 加权总分 + 回归判定（>3% / >2pp）', surface: 'task', volume: '卷 26', manifest: 'Y-01' } },
  { path: '/quality/online-metrics', name: 'qa-online', component: () => import('@/views/quality/OnlineMetrics.vue'), meta: { title: '在线指标', group: '质量与运维', groupOrder: 12, order: 5, icon: 'chart-line', desc: '8 项核心指标 + 目标线 + 趋势', surface: 'task', volume: '卷 26', manifest: 'Y-03' } },
  { path: '/quality/gates', name: 'qa-gates', component: () => import('@/views/quality/GateMatrix.vue'), meta: { title: '变更门禁矩阵', group: '质量与运维', groupOrder: 12, order: 6, icon: 'check', desc: '14 类变更 × 必过项 + CI 状态', surface: 'task', volume: '卷 26', manifest: 'Y-01' } },
  { path: '/quality/red-team', name: 'qa-red-team', component: () => import('@/views/quality/RedTeam.vue'), meta: { title: '红队与安全评测', group: '质量与运维', groupOrder: 12, order: 7, icon: 'bug', desc: '10 类用例（≥60 条）+ 通过率 + 季度复核', surface: 'task', volume: '卷 26', manifest: 'Y-02' } },
  { path: '/quality/benchmarks', name: 'qa-benchmarks', component: () => import('@/views/quality/Benchmarks.vue'), meta: { title: '性能容量基准', group: '质量与运维', groupOrder: 12, order: 8, icon: 'chart-bar', desc: '8 场景 vs 目标 + 趋势', surface: 'task', volume: '卷 26', manifest: 'Y-03' } },
  { path: '/quality/journeys', name: 'qa-journeys', component: () => import('@/views/quality/Journeys.vue'), meta: { title: '核心旅程 J1–J12', group: '质量与运维', groupOrder: 12, order: 9, icon: 'sitemap', desc: '端到端验收清单 + 近 6 次运行热力图', surface: 'task', volume: '卷 26', manifest: 'Y-03' } },
  { path: '/quality/chaos', name: 'qa-chaos', component: () => import('@/views/quality/Chaos.vue'), meta: { title: '混沌实验', group: '质量与运维', groupOrder: 12, order: 10, icon: 'bug', desc: 'C1–C10 + 假设 / 观测 / 结论', surface: 'task', volume: '卷 26', manifest: 'Y-01' } },
  { path: '/quality/feedback', name: 'qa-feedback', component: () => import('@/views/quality/FeedbackLoop.vue'), meta: { title: '反馈闭环', group: '质量与运维', groupOrder: 12, order: 11, icon: 'chat-bubble', desc: '来源 → 归因 → 处理 → 验证 + 满意度回访', surface: 'task', volume: '卷 26', manifest: 'Y-04' } },
  { path: '/quality/roadmap', name: 'qa-roadmap', component: () => import('@/views/quality/Roadmap.vue'), meta: { title: '实施路线图', group: '质量与运维', groupOrder: 12, order: 12, icon: 'flag', desc: 'P0–P4 分期 + 退出条件 + 验收报告', surface: 'task', volume: '卷 26', manifest: 'Y-05' } },
  { path: '/quality/risks', name: 'qa-risks', component: () => import('@/views/quality/RiskRegister.vue'), meta: { title: '风险登记册', group: '质量与运维', groupOrder: 12, order: 13, icon: 'error', desc: 'Top 15 风险 + 缓解 + 季度复评', surface: 'task', volume: '卷 26', manifest: 'Y-05' } },
  { path: '/quality/dod', name: 'qa-dod', component: () => import('@/views/quality/DodChecklist.vue'), meta: { title: 'DoD 总表', group: '质量与运维', groupOrder: 12, order: 14, icon: 'task-checked', desc: '26 域完成定义汇总 + 全绿指示灯', surface: 'task', volume: '卷 26', manifest: 'Y-05' } },
] as OcRoute[];
