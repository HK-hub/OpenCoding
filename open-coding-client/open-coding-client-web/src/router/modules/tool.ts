import type { OcRoute } from '../types';

/** 工具系统域路由（卷 05 + BUILD-MANIFEST T-01…T-13） */
export default [
  {
    path: '/tools/catalog',
    name: 'tools-catalog',
    component: () => import('@/views/tools/ToolCatalog.vue'),
    meta: { title: '工具目录', group: '执行与安全', groupOrder: 5, order: 1, icon: 'tools', desc: '12 族分组 + 风险级 + 来源通道 + 资源声明 + 语义检索', surface: 'tool', volume: '卷 05', manifest: 'T-01' },
  },
  {
    path: '/tools/detail',
    name: 'tools-detail',
    component: () => import('@/views/tools/ToolDetail.vue'),
    meta: { title: '工具详情', group: '执行与安全', groupOrder: 5, order: 2, icon: 'file', desc: '描述/示例/常见错误三件套 + 参数 Schema + 幂等与能力需求', surface: 'tool', volume: '卷 05', manifest: 'T-02' },
  },
  {
    path: '/tools/assembly',
    name: 'tools-assembly',
    component: () => import('@/views/tools/ToolAssembly.vue'),
    meta: { title: '工具集装配', group: '执行与安全', groupOrder: 5, order: 3, icon: 'layers', desc: '模式驱动子集 + 按需加载（deferred）+ token 占用估算', surface: 'tool', volume: '卷 05', manifest: 'T-03' },
  },
  {
    path: '/tools/calls',
    name: 'tools-calls',
    component: () => import('@/views/tools/CallTimeline.vue'),
    meta: { title: '调用时间线', group: '执行与安全', groupOrder: 5, order: 4, icon: 'time', desc: '每次调用：参数摘要 / 资源 / 耗时 / 外置 / 缓存 / 串行原因 / 预算影响', surface: 'tool', volume: '卷 05', manifest: 'T-04' },
  },
  {
    path: '/tools/call-detail',
    name: 'tools-call-detail',
    component: () => import('@/views/tools/CallDetail.vue'),
    meta: { title: '调用详情', group: '执行与安全', groupOrder: 5, order: 5, icon: 'browse', desc: '结构化结果 + 错误类别与修复建议 + 前后哈希 + 决策引用 + 审计回放', surface: 'tool', volume: '卷 05', manifest: 'T-05' },
  },
  {
    path: '/tools/pipeline',
    name: 'tools-pipeline',
    component: () => import('@/views/tools/Pipeline.vue'),
    meta: { title: '执行管线', group: '执行与安全', groupOrder: 5, order: 6, icon: 'sitemap', desc: '11 步固定顺序管线 + 单次调用逐步耗时与结果', surface: 'tool', volume: '卷 05', manifest: 'T-06' },
  },
  {
    path: '/tools/artifacts',
    name: 'tools-artifacts',
    component: () => import('@/views/tools/ArtifactViewer.vue'),
    meta: { title: '外置工件查看器', group: '执行与安全', groupOrder: 5, order: 7, icon: 'folder-open', desc: '结果外置引用 + 结构化头部 + 分页读取（再读重新鉴权）', surface: 'tool', volume: '卷 03', manifest: 'T-07' },
  },
  {
    path: '/tools/conflicts',
    name: 'tools-conflicts',
    component: () => import('@/views/tools/ConflictGraph.vue'),
    meta: { title: '冲突与串行化', group: '执行与安全', groupOrder: 5, order: 8, icon: 'root', desc: '冲突图（读读并行 / 写写串行 / 写读串行 / 命令并行 / 工作区锁）+ 串行原因', surface: 'tool', volume: '卷 05', manifest: 'T-08' },
  },
  {
    path: '/tools/market',
    name: 'tools-market',
    component: () => import('@/views/tools/ToolMarket.vue'),
    meta: { title: '工具包市场', group: '执行与安全', groupOrder: 5, order: 9, icon: 'extension', desc: '工具包版本/签名/权限与资源声明/发布者 + 安装卸载', surface: 'tool', volume: '卷 05', manifest: 'T-09' },
  },
  {
    path: '/tools/aliases',
    name: 'tools-aliases',
    component: () => import('@/views/tools/AliasTable.vue'),
    meta: { title: '别名映射', group: '执行与安全', groupOrder: 5, order: 10, icon: 'link', desc: '旧名 → 新名 + 兼容期倒计时 + 变更事件', surface: 'tool', volume: '卷 05', manifest: 'T-10' },
  },
  {
    path: '/tools/backend-tasks',
    name: 'tools-backend-tasks',
    component: () => import('@/views/tools/BackendTasks.vue'),
    meta: { title: '后台任务句柄', group: '执行与安全', groupOrder: 5, order: 11, icon: 'api', desc: '任务句柄 / 等待模式 / 输出分页读取 / 终止', surface: 'tool', volume: '卷 05', manifest: 'T-11' },
  },
  {
    path: '/tools/side-effects',
    name: 'tools-side-effects',
    component: () => import('@/views/tools/SideEffectLedger.vue'),
    meta: { title: '副作用账本', group: '执行与安全', groupOrder: 5, order: 12, icon: 'history', desc: '幂等键 + 已发生副作用 + 重放跳过记录 + 补偿动作', surface: 'tool', volume: '卷 05', manifest: 'T-12' },
  },
  {
    path: '/tools/macros',
    name: 'tools-macros',
    component: () => import('@/views/tools/MacroList.vue'),
    meta: { title: '宏（组合工具）', group: '执行与安全', groupOrder: 5, order: 13, icon: 'flag', desc: '内置宏逐步展开 + 权限按原子粒度透明判定', surface: 'tool', volume: '卷 05', manifest: 'T-13' },
  },
] as OcRoute[];
