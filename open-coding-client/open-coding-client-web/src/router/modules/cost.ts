import type { OcRoute } from '../types';

/** 成本与配额路由（卷 31） */
export default [
  {
    path: '/cost/overview',
    name: 'cost-overview',
    component: () => import('@/views/cost/CostOverview.vue'),
    meta: { title: '成本与用量', group: '上下文与成本', groupOrder: 7, order: 4, icon: 'discount', desc: '六维聚合切换 + 缓存折扣单列 + 异常标记 + 下钻表格', surface: 'cost', volume: '卷 31', manifest: 'S-13' },
  },
  {
    path: '/cost/why-expensive',
    name: 'cost-why',
    component: () => import('@/views/cost/WhyExpensive.vue'),
    meta: { title: '为什么这么贵', group: '上下文与成本', groupOrder: 7, order: 5, icon: 'help', desc: '解释投影：成本归因到上下文区段与具体调用 + 优化建议 ROI', surface: 'cost', volume: '卷 31', manifest: 'S-13' },
  },
  {
    path: '/cost/quota',
    name: 'cost-quota',
    component: () => import('@/views/cost/QuotaPolicy.vue'),
    meta: { title: '配额与预算策略', group: '上下文与成本', groupOrder: 7, order: 6, icon: 'secured', desc: '静态基线 + 预测额度 + 再分配 + 熔断（×3）与降级偏好', surface: 'cost', volume: '卷 31', manifest: 'G4-04' },
  },
] as OcRoute[];
