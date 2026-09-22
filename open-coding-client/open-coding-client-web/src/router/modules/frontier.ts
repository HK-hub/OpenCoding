import type { OcRoute } from '../types';

/**
 * 前沿探索域路由（卷 25）。
 * 契约：每个实验带「实验」徽标、用户可关闭、数据隔离与下线迁移说明；无退出条件不得进入 beta。
 */
export default [
  {
    path: '/frontier/board',
    name: 'frontier-board',
    component: () => import('@/views/frontier/ExperimentBoard.vue'),
    meta: { title: '实验阶梯看板', group: '自动化与智能', groupOrder: 11, order: 40, icon: 'dashboard', desc: '五级阶梯（lab / internal / beta / ga + 出口）看板 + 活跃上限 ≤8', surface: 'intel', volume: '卷 25', manifest: 'U-01', experimental: true },
  },
  {
    path: '/frontier/registry',
    name: 'frontier-registry',
    component: () => import('@/views/frontier/ExperimentRegistry.vue'),
    meta: { title: '实验登记', group: '自动化与智能', groupOrder: 11, order: 41, icon: 'flag', desc: '12 个方向 + 统一模板字段 + 登记向导', surface: 'intel', volume: '卷 25', manifest: 'U-02', experimental: true },
  },
  {
    path: '/frontier/experiments/:id',
    name: 'frontier-experiment-detail',
    component: () => import('@/views/frontier/ExperimentDetail.vue'),
    meta: { title: '实验详情', group: '自动化与智能', groupOrder: 11, order: 42, icon: 'file', desc: '模板字段 + 指标看板 + 晋级 / 终止 + 无退出条件不得进 beta 硬性提示', surface: 'intel', volume: '卷 25', manifest: 'U-03', experimental: true, hidden: true },
  },
  {
    path: '/frontier/flags',
    name: 'frontier-flags',
    component: () => import('@/views/frontier/ExperimentFlags.vue'),
    meta: { title: '实验开关与灰度', group: '自动化与智能', groupOrder: 11, order: 43, icon: 'extension', desc: '实验开关 + 灰度范围 + 用户可关闭 + 「实验」徽标说明', surface: 'settings', volume: '卷 25', manifest: 'U-04', experimental: true },
  },
  {
    path: '/frontier/isolation',
    name: 'frontier-isolation',
    component: () => import('@/views/frontier/ExperimentIsolation.vue'),
    meta: { title: '实验数据隔离', group: '自动化与智能', groupOrder: 11, order: 44, icon: 'database', desc: '数据命名空间 + 一键清理 + 下线迁移说明', surface: 'settings', volume: '卷 25', manifest: 'U-05', experimental: true, permission: 'automation.manage' },
  },
  {
    path: '/frontier/multimodal',
    name: 'frontier-multimodal',
    component: () => import('@/views/frontier/MultimodalLab.vue'),
    meta: { title: '多模态实验室', group: '自动化与智能', groupOrder: 11, order: 45, icon: 'image', desc: '设计稿→代码 / 截图→修复 / 视频理解 + 差异报告', surface: 'intel', volume: '卷 25', manifest: 'U-02', experimental: true },
  },
  {
    path: '/frontier/computer-use',
    name: 'frontier-computer-use',
    component: () => import('@/views/frontier/ComputerUseLab.vue'),
    meta: { title: '计算机使用实验室', group: '自动化与智能', groupOrder: 11, order: 46, icon: 'platform', desc: 'GUI / 浏览器操作 + 执行强度 FULL / PARTIAL 上报 + 越界零容忍', surface: 'intel', volume: '卷 25', manifest: 'U-03', experimental: true },
  },
  {
    path: '/frontier/self-evolution',
    name: 'frontier-self-evolution',
    component: () => import('@/views/frontier/SelfEvolutionLab.vue'),
    meta: { title: '自进化实验室', group: '自动化与智能', groupOrder: 11, order: 47, icon: 'lightbulb', desc: '失败学习 → 技能草稿（禁止自动发布）+ 草稿评审队列', surface: 'intel', volume: '卷 25', manifest: 'U-04', experimental: true },
  },
] as OcRoute[];
