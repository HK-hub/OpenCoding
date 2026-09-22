import type { OcRoute } from '../types';

/**
 * Agent 内核域路由（卷 12 · Agent Runtime）。
 * 分组：工作台（groupOrder 1）；组内 order 20–29；图标 robot。
 */
export default [
  {
    path: '/agent/definitions',
    name: 'agent-definitions',
    component: () => import('@/views/agent/AgentDefinitions.vue'),
    meta: { title: 'Agent 定义管理', group: '工作台', groupOrder: 1, order: 20, icon: 'robot', desc: '列表 + 8 字段编辑器 + 四级作用域 + 权限收窄校验', surface: 'registry', volume: '卷 12', manifest: 'A-01' },
  },
  {
    path: '/agent/subagents',
    name: 'agent-subagents',
    component: () => import('@/views/agent/SubAgentTree.vue'),
    meta: { title: 'SubAgent 派生树', group: '工作台', groupOrder: 1, order: 21, icon: 'sitemap', desc: '可折叠派生树 + brief + 预算信封 + 结果契约 + 取消级联', surface: 'session', volume: '卷 12', manifest: 'A-02' },
  },
  {
    path: '/agent/fanout',
    name: 'agent-fanout',
    component: () => import('@/views/agent/FanoutPanel.vue'),
    meta: { title: '并行扇出面板', group: '工作台', groupOrder: 1, order: 22, icon: 'layers', desc: '子任务集合 + 预算分配 + 同文件写冲突前置拦截 + 汇总/去重', surface: 'task', volume: '卷 12', manifest: 'A-03' },
  },
  {
    path: '/agent/verification',
    name: 'agent-verification',
    component: () => import('@/views/agent/VerificationPanel.vue'),
    meta: { title: '验证与证据', group: '工作台', groupOrder: 1, order: 23, icon: 'task-checked', desc: '三级验证（L1 静态/L2 可执行/L3 语义）+ 证据清单 + 未验证项 + 完成报告', surface: 'task', volume: '卷 12', manifest: 'A-04' },
  },
  {
    path: '/agent/loop',
    name: 'agent-loop',
    component: () => import('@/views/agent/LoopStrategy.vue'),
    meta: { title: '循环策略与状态机', group: '工作台', groupOrder: 1, order: 24, icon: 'refresh', desc: '轻计划/严格计划/纯 ReAct 三档切换 + 共享状态机与安全点说明', surface: 'session', volume: '卷 12', manifest: 'A-05' },
  },
  {
    path: '/agent/autonomy',
    name: 'agent-autonomy',
    component: () => import('@/views/agent/AutonomyControl.vue'),
    meta: { title: '自主度控制', group: '工作台', groupOrder: 1, order: 25, icon: 'user-circle', desc: '建议/协作/自治三档 + 可随时收回 + 与权限模式对齐', surface: 'settings', volume: '卷 12', manifest: 'A-06' },
  },
  {
    path: '/agent/capabilities',
    name: 'agent-capabilities',
    component: () => import('@/views/agent/CapabilityIntrospection.vue'),
    meta: { title: '能力自省', group: '工作台', groupOrder: 1, order: 26, icon: 'tools', desc: '可用工具 / 权限上限 / 预算信封 / 环境探测（模型、沙箱、连接）', surface: 'tool', volume: '卷 12', manifest: 'A-07' },
  },
] as OcRoute[];
