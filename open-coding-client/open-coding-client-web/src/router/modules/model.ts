import type { OcRoute } from '../types';

/** 模型与提示词 · 模型网关路由（卷 02 / 卷 31） */
export default [
  {
    path: '/model/providers',
    name: 'model-providers',
    component: () => import('@/views/model/ProviderList.vue'),
    meta: { title: 'Provider 列表', group: '模型与提示词', groupOrder: 8, order: 1, icon: 'server', desc: '协议族 / 端点 / 凭证引用 / 连通状态 / 模型数与最近探测', surface: 'registry', volume: '卷 02', manifest: 'M-01' },
  },
  {
    path: '/model/catalog',
    name: 'model-catalog',
    component: () => import('@/views/model/ModelCatalog.vue'),
    meta: { title: '模型目录', group: '模型与提示词', groupOrder: 8, order: 2, icon: 'database', desc: '三源合并（内置/用户/探测）+ 冲突高亮 + 能力位过滤', surface: 'registry', volume: '卷 02', manifest: 'M-04' },
  },
  {
    path: '/model/capabilities',
    name: 'model-capabilities',
    component: () => import('@/views/model/CapabilityMatrix.vue'),
    meta: { title: '能力矩阵', group: '模型与提示词', groupOrder: 8, order: 3, icon: 'sitemap', desc: '8+2 能力位 × 三态，不支持时显式行为与替代建议', surface: 'registry', volume: '卷 02', manifest: 'M-05' },
  },
  {
    path: '/model/routing',
    name: 'model-routing',
    component: () => import('@/views/model/RouteRules.vue'),
    meta: { title: '路由规则', group: '模型与提示词', groupOrder: 8, order: 4, icon: 'filter', desc: '条件 → 目标 / 回退链 + dry-run 命中模拟', surface: 'registry', volume: '卷 02', manifest: 'M-07' },
  },
  {
    path: '/model/rate-limits',
    name: 'model-rate-limits',
    component: () => import('@/views/model/RateLimitPanel.vue'),
    meta: { title: '限流与重试', group: '模型与提示词', groupOrder: 8, order: 5, icon: 'dashboard', desc: '并发 / RPM / TPM / 最大输出 + 三重试参数 + 熔断状态', surface: 'registry', volume: '卷 02', manifest: 'M-08' },
  },
  {
    path: '/model/cache',
    name: 'model-cache',
    component: () => import('@/views/model/CachePanel.vue'),
    meta: { title: '缓存面板', group: '模型与提示词', groupOrder: 8, order: 6, icon: 'discount', desc: 'cache.enabled + 断点标记 + 命中率观测与未命中原因', surface: 'registry', volume: '卷 02', manifest: 'M-09' },
  },
  {
    path: '/model/credentials',
    name: 'model-credentials',
    component: () => import('@/views/model/CredentialManager.vue'),
    meta: { title: '凭证管理', group: '模型与提示词', groupOrder: 8, order: 7, icon: 'lock', desc: '三层凭证（平台/BYOK/会话）+ 引用式引用名，永不显示明文', surface: 'registry', volume: '卷 02', manifest: 'M-10' },
  },
  {
    path: '/model/decorators',
    name: 'model-decorators',
    component: () => import('@/views/model/DecoratorChain.vue'),
    meta: { title: '装饰器链', group: '模型与提示词', groupOrder: 8, order: 8, icon: 'layers', desc: '8 层固定顺序 + 独立开关 + 失败策略与打点', surface: 'registry', volume: '卷 02', manifest: 'M-11' },
  },
  {
    path: '/model/usage',
    name: 'model-usage',
    component: () => import('@/views/model/UsageCostBoard.vue'),
    meta: { title: '用量与成本看板', group: '模型与提示词', groupOrder: 8, order: 9, icon: 'chart', desc: '六维归因下钻 + 缓存折扣单列 + 延迟分解（TTFB/总耗时）', surface: 'cost', volume: '卷 31', manifest: 'M-12' },
  },
  {
    path: '/model/audit',
    name: 'model-audit',
    component: () => import('@/views/model/CallAudit.vue'),
    meta: { title: '调用审计', group: '模型与提示词', groupOrder: 8, order: 10, icon: 'history', desc: '请求元数据 + 脱敏正文快照 + 保留 TTL', surface: 'registry', volume: '卷 02', manifest: 'M-13' },
  },
  {
    path: '/model/gray',
    name: 'model-gray',
    component: () => import('@/views/model/GrayRelease.vue'),
    meta: { title: '灰度与 A/B', group: '模型与提示词', groupOrder: 8, order: 11, icon: 'flag', desc: '可复现分桶 + arm 指标 + 门控阈值 + 自动回滚历史', surface: 'registry', volume: '卷 02', manifest: 'M-14' },
  },
  {
    path: '/model/errors',
    name: 'model-errors',
    component: () => import('@/views/model/ErrorDiagnostics.vue'),
    meta: { title: '错误诊断', group: '模型与提示词', groupOrder: 8, order: 12, icon: 'bug', desc: '10 类错误 + 可重试标记 + 厂商码脱敏 + 建议动作', surface: 'registry', volume: '卷 02', manifest: 'M-15' },
  },
  {
    path: '/model/providers/:id',
    name: 'model-provider-editor',
    component: () => import('@/views/model/ProviderEditor.vue'),
    meta: { title: 'Provider 编辑', group: '模型与提示词', groupOrder: 8, order: 13, icon: 'edit', hidden: true, surface: 'registry', volume: '卷 02', manifest: 'M-02' },
  },
  {
    path: '/model/providers/:id/test',
    name: 'model-provider-test',
    component: () => import('@/views/model/ConnectivityTest.vue'),
    meta: { title: '连通性测试', group: '模型与提示词', groupOrder: 8, order: 14, icon: 'refresh', hidden: true, surface: 'registry', volume: '卷 02', manifest: 'M-03' },
  },
  {
    path: '/model/catalog/:id',
    name: 'model-detail',
    component: () => import('@/views/model/ModelDetail.vue'),
    meta: { title: '模型详情', group: '模型与提示词', groupOrder: 8, order: 15, icon: 'file', hidden: true, surface: 'registry', volume: '卷 02', manifest: 'M-06' },
  },
] as OcRoute[];
