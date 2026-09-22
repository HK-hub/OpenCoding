import type { OcRoute } from '../types';

/**
 * 记忆域路由（卷 10 · 记忆系统）。
 * 分组：扩展与生态（groupOrder 3）；组内 order 30–39；图标 bookmark。
 */
export default [
  {
    path: '/memory/center',
    name: 'memory-center',
    component: () => import('@/views/memory/MemoryCenter.vue'),
    meta: { title: '记忆中心', group: '扩展与生态', groupOrder: 3, order: 30, icon: 'bookmark', desc: '四层 Tab（工作/会话/项目/组织）+ 条目列表 + 容量提示', surface: 'intel', volume: '卷 10', manifest: 'E-01' },
  },
  {
    path: '/memory/detail',
    name: 'memory-detail',
    component: () => import('@/views/memory/MemoryDetail.vue'),
    meta: { title: '记忆条目详情', group: '扩展与生态', groupOrder: 3, order: 31, icon: 'file', desc: '内容 + 来源 + 版本链 + reviewAt + 召回记录 + 纠正入口', surface: 'intel', volume: '卷 10', manifest: 'E-02', hidden: true },
  },
  {
    path: '/memory/proposals',
    name: 'memory-proposals',
    component: () => import('@/views/memory/MemoryProposal.vue'),
    meta: { title: '写入候选确认', group: '扩展与生态', groupOrder: 3, order: 32, icon: 'check', desc: 'key/value/scope/理由/影响范围 → 同意 / 拒绝 / 改范围（可撤销）', surface: 'intel', volume: '卷 10', manifest: 'E-03' },
  },
  {
    path: '/memory/recall',
    name: 'memory-recall',
    component: () => import('@/views/memory/RecallDebug.vue'),
    meta: { title: '召回调试', group: '扩展与生态', groupOrder: 3, order: 33, icon: 'search', desc: '命中条目 + 分数 + 是否被使用 + 来源标注 + 延迟分解 + 预算裁剪', surface: 'intel', volume: '卷 10', manifest: 'E-04' },
  },
  {
    path: '/memory/conflicts',
    name: 'memory-conflicts',
    component: () => import('@/views/memory/MemoryConflict.vue'),
    meta: { title: '冲突处理', group: '扩展与生态', groupOrder: 3, order: 34, icon: 'bug', desc: 'sameKeyDifferentValue / semanticContradiction + 合并确认', surface: 'intel', volume: '卷 10', manifest: 'E-05' },
  },
  {
    path: '/memory/files',
    name: 'memory-files',
    component: () => import('@/views/memory/MemoryFiles.vue'),
    meta: { title: '文件化同步', group: '扩展与生态', groupOrder: 3, order: 35, icon: 'file-copy', desc: '.oc/memory/*.md + YAML 头预览 + drift.detected（以文件为准）', surface: 'intel', volume: '卷 10', manifest: 'E-06' },
  },
  {
    path: '/memory/deletion',
    name: 'memory-deletion',
    component: () => import('@/views/memory/MemoryDeletion.vue'),
    meta: { title: '遗忘与删除', group: '扩展与生态', groupOrder: 3, order: 36, icon: 'delete', desc: 'TTL → archived / 软删 / 合规删除（穿透备份）+ 删除证明导出', surface: 'settings', volume: '卷 10', manifest: 'E-07' },
  },
  {
    path: '/memory/governance',
    name: 'memory-governance',
    component: () => import('@/views/memory/MemoryGovernance.vue'),
    meta: { title: '组织记忆治理', group: '扩展与生态', groupOrder: 3, order: 37, icon: 'secured', desc: '提案-评审-发布 + 版本回滚 + 过期复审', surface: 'intel', volume: '卷 10', manifest: 'E-08' },
  },
  {
    path: '/memory/privacy',
    name: 'memory-privacy',
    component: () => import('@/views/memory/MemoryPrivacy.vue'),
    meta: { title: '隐私与脱敏', group: '扩展与生态', groupOrder: 3, order: 38, icon: 'lock', desc: 'PII 四类开关 + 脱敏或拒绝 + 加密存储 + 访问审计', surface: 'settings', volume: '卷 10', manifest: 'E-09' },
  },
  {
    path: '/memory/quality',
    name: 'memory-quality',
    component: () => import('@/views/memory/MemoryQuality.vue'),
    meta: { title: '记忆质量评测', group: '扩展与生态', groupOrder: 3, order: 39, icon: 'chart-line', desc: '命中率/误用率/过期率/冲突率 + 一键纠正反哺', surface: 'intel', volume: '卷 10', manifest: 'E-10' },
  },
] as OcRoute[];
