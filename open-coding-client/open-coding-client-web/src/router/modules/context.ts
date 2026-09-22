import type { OcRoute } from '../types';

/** 上下文工程路由（卷 03） */
export default [
  {
    path: '/context/snapshot',
    name: 'context-snapshot',
    component: () => import('@/views/context/ContextSnapshot.vue'),
    meta: { title: '上下文快照', group: '上下文与成本', groupOrder: 7, order: 1, icon: 'layers', desc: '九区段预算、来源清单、缓存断点与逐段 token 归因', surface: 'session', volume: '卷 03', manifest: 'S-11' },
  },
  {
    path: '/context/compaction',
    name: 'context-compaction',
    component: () => import('@/views/context/CompactionMap.vue'),
    meta: { title: '压缩地图', group: '上下文与成本', groupOrder: 7, order: 2, icon: 'browse', desc: 'L1–L4 压缩历史、摘要人工校正、撤销压缩与保真断言', surface: 'session', volume: '卷 03', manifest: 'S-12' },
  },
  {
    path: '/context/references',
    name: 'context-references',
    component: () => import('@/views/context/ReferenceViewer.vue'),
    meta: { title: '引用与工件', group: '上下文与成本', groupOrder: 7, order: 3, icon: 'link', desc: 'artifact:// file:// kb:// checkpoint:// 分页再读（重新鉴权）', surface: 'session', volume: '卷 03', manifest: 'S-12' },
  },
] as OcRoute[];
