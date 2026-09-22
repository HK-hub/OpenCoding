import type { OcRoute } from '../types';

/**
 * 知识库域路由（卷 11 · 知识系统）。
 * 分组：扩展与生态（groupOrder 3）；组内 order 20–29；图标 database。
 */
export default [
  {
    path: '/knowledge/sources',
    name: 'knowledge-sources',
    component: () => import('@/views/knowledge/SourceManager.vue'),
    meta: { title: '知识源管理', group: '扩展与生态', groupOrder: 3, order: 20, icon: 'database', desc: '八类连接器 + 同步状态 + 增量同步 + 凭据隔离 + 同步日志', surface: 'intel', volume: '卷 11', manifest: 'W-01' },
  },
  {
    path: '/knowledge/index',
    name: 'knowledge-index',
    component: () => import('@/views/knowledge/IndexStatus.vue'),
    meta: { title: '索引状态', group: '扩展与生态', groupOrder: 3, order: 21, icon: 'layers', desc: '进度/块数/耗时/失败原因/断点续传/滞后秒数 + 后台重建', surface: 'intel', volume: '卷 11', manifest: 'W-02' },
  },
  {
    path: '/knowledge/search',
    name: 'knowledge-search',
    component: () => import('@/views/knowledge/SearchWorkbench.vue'),
    meta: { title: '检索工作台', group: '扩展与生态', groupOrder: 3, order: 22, icon: 'search', desc: '查询理解 + 三路召回降级标注 + 重排 + 延迟分解 + 强制引用', surface: 'intel', volume: '卷 11', manifest: 'W-03' },
  },
  {
    path: '/knowledge/citation',
    name: 'knowledge-citation',
    component: () => import('@/views/knowledge/CitationViewer.vue'),
    meta: { title: '引用溯源', group: '扩展与生态', groupOrder: 3, order: 23, icon: 'link', desc: '五类引用打开 + 已变更差异提示 + 网页快照 + 打开审计', surface: 'intel', volume: '卷 11', manifest: 'W-04', hidden: true },
  },
  {
    path: '/knowledge/wiki',
    name: 'knowledge-wiki',
    component: () => import('@/views/knowledge/WikiPages.vue'),
    meta: { title: '项目知识页', group: '扩展与生态', groupOrder: 3, order: 24, icon: 'file', desc: '七段结构 + 逐条溯源 + 待确认标注 + 可编辑 + 版本对比', surface: 'intel', volume: '卷 11', manifest: 'W-05' },
  },
  {
    path: '/knowledge/governance',
    name: 'knowledge-governance',
    component: () => import('@/views/knowledge/KnowledgeGovernance.vue'),
    meta: { title: '知识治理', group: '扩展与生态', groupOrder: 3, order: 25, icon: 'secured', desc: '陈旧检测四类 + 降权 + 审核流 + 贡献度量 + 反馈队列', surface: 'intel', volume: '卷 11', manifest: 'W-06' },
  },
  {
    path: '/knowledge/permission',
    name: 'knowledge-permission',
    component: () => import('@/views/knowledge/KnowledgePermission.vue'),
    meta: { title: '知识权限与多租户', group: '扩展与生态', groupOrder: 3, order: 26, icon: 'lock', desc: '权限标签 + 前置过滤校验 + 共享知识域 + 检索审计（越权探测）', surface: 'intel', volume: '卷 11', manifest: 'W-07' },
  },
  {
    path: '/knowledge/symbols',
    name: 'knowledge-symbols',
    component: () => import('@/views/knowledge/SymbolGraph.vue'),
    meta: { title: '符号与结构图', group: '扩展与生态', groupOrder: 3, order: 27, icon: 'sitemap', desc: '符号级信息 + 导入/调用/继承/依赖边 + 模块摘要', surface: 'intel', volume: '卷 11', manifest: 'W-08' },
  },
  {
    path: '/knowledge/settings',
    name: 'knowledge-settings',
    component: () => import('@/views/knowledge/IndexSettings.vue'),
    meta: { title: '嵌入与索引设置', group: '扩展与生态', groupOrder: 3, order: 28, icon: 'setting', desc: '嵌入模型 + 渐进迁移 + IndexStore 切换 + 代码外发开关（默认禁用）', surface: 'settings', volume: '卷 11', manifest: 'W-09' },
  },
] as OcRoute[];
