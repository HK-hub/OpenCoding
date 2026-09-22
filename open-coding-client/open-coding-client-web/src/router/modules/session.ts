import type { OcRoute } from '../types';

/** 会话与上下文域路由（卷 00 D01 / 卷 03 / 卷 12 / 卷 22） */
export default [
  {
    path: '/session',
    name: 'session-workbench',
    component: () => import('@/views/session/SessionWorkbench.vue'),
    meta: { title: '会话工作台', group: '工作台', groupOrder: 1, order: 1, icon: 'chat', desc: '会话列表 + 流式对话 + 工具卡 + 审批卡 + 上下文面板', surface: 'session', volume: '卷 22', manifest: 'S-01…S-10' },
  },
  {
    path: '/session/archive',
    name: 'session-archive',
    component: () => import('@/views/session/SessionArchive.vue'),
    meta: { title: '归档与回收站', group: '工作台', groupOrder: 1, order: 2, icon: 'history', desc: '归档、恢复、彻底删除（合规删除需二次确认）', surface: 'session', volume: '卷 19', manifest: 'S-01' },
  },
  {
    path: '/session/turns',
    name: 'session-turns',
    component: () => import('@/views/session/TurnInspector.vue'),
    meta: { title: 'Turn 检查器', group: '工作台', groupOrder: 1, order: 3, icon: 'chart', desc: '阶段时间线（解析→评估→规划→执行→反思→验证→收尾）与用量汇总', surface: 'session', volume: '卷 12', manifest: 'S-19' },
  },
  {
    path: '/session/guard',
    name: 'session-guard',
    component: () => import('@/views/session/LoopGuard.vue'),
    meta: { title: '循环防护与回滚点', group: '工作台', groupOrder: 1, order: 4, icon: 'secured', desc: '三重硬上限、重复动作检测、漂移检测、安全点回滚', surface: 'session', volume: '卷 12', manifest: 'S-20' },
  },
  {
    path: '/session/replay',
    name: 'session-replay',
    component: () => import('@/views/session/SessionReplay.vue'),
    meta: { title: '会话重放与分叉', group: '工作台', groupOrder: 1, order: 5, icon: 'loading', desc: '事件重建、变速与跳转、从任一消息点 fork', surface: 'session', volume: '卷 16', manifest: 'S-16' },
  },
  {
    path: '/session/export',
    name: 'session-export',
    component: () => import('@/views/session/SessionExport.vue'),
    meta: { title: '导入导出与复现包', group: '工作台', groupOrder: 1, order: 6, icon: 'download', desc: '中立导出包（manifest/events/workitems/memory/artifacts/checksums）+ 校验', surface: 'session', volume: '卷 19', manifest: 'S-17' },
  },
  {
    path: '/approval/center',
    name: 'approval-center',
    component: () => import('@/views/approval/ApprovalCenter.vue'),
    meta: { title: '审批中心', group: '权限与审批', groupOrder: 4, order: 1, icon: 'secured', desc: '待审批列表 + 字段序 ①–⑦ + 六级范围 chips + 批量操作', surface: 'approval', volume: '卷 06', manifest: 'G-06' },
  },
  {
    path: '/approval/history',
    name: 'approval-history',
    component: () => import('@/views/approval/ApprovalHistory.vue'),
    meta: { title: '审批历史与回放', group: '权限与审批', groupOrder: 4, order: 2, icon: 'history', desc: '不可变审计记录 + 决策链重放一致性', surface: 'approval', volume: '卷 06', manifest: 'P-06' },
  },
  {
    path: '/approval/memory',
    name: 'approval-memory',
    component: () => import('@/views/approval/GrantMemory.vue'),
    meta: { title: '授权记忆', group: '权限与审批', groupOrder: 4, order: 3, icon: 'bookmark', desc: '六级范围（once/session/project/workspace/pattern/dir）可撤销', surface: 'approval', volume: '卷 06', manifest: 'P-05' },
  },
  {
    path: '/approval/channels',
    name: 'approval-channels',
    component: () => import('@/views/approval/ApprovalChannels.vue'),
    meta: { title: '审批通道与 SLA', group: '权限与审批', groupOrder: 4, order: 4, icon: 'mail', desc: '四通道（CLI/桌面/远程 A2A/IM）+ 升级链 + 超时动作', surface: 'approval', volume: '卷 06', manifest: 'P-08、P-09' },
  },
] as OcRoute[];
