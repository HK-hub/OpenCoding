/**
 * A2A 互操作域路由（卷 23 / BUILD-MANIFEST Q-01…Q-10）。默认导出 OcRoute[]。
 */
import type { OcRoute } from '../types';

export default [
  { path: '/a2a/service', name: 'a2a-service', component: () => import('@/views/a2a/ServiceOverview.vue'), meta: { title: 'A2A 服务面', group: '分发与生态', groupOrder: 13, order: 40, icon: 'api', desc: '九端点 + 端点健康 + 服务面开关（local 默认关闭，仅回环）', surface: 'task', volume: '卷 23', manifest: 'Q-01' } },
  { path: '/a2a/agent-card', name: 'a2a-agent-card', component: () => import('@/views/a2a/AgentCard.vue'), meta: { title: '能力发现', group: '分发与生态', groupOrder: 13, order: 41, icon: 'code', desc: 'Agent Card：能力 / 约束 / 认证 / 端点 / 限速 + 签名状态', surface: 'task', volume: '卷 23', manifest: 'Q-02' } },
  { path: '/a2a/tasks', name: 'a2a-tasks', component: () => import('@/views/a2a/ExternalTasks.vue'), meta: { title: '外部任务', group: '分发与生态', groupOrder: 13, order: 42, icon: 'task', desc: '列表 + 排队位置/ETA + 幂等命中 + 状态过滤', surface: 'task', volume: '卷 23', manifest: 'Q-03' } },
  { path: '/a2a/tasks/:id', name: 'a2a-task-detail', component: () => import('@/views/a2a/ExternalTaskDetail.vue'), meta: { title: '外部任务详情', group: '分发与生态', groupOrder: 13, order: 43, icon: 'file', desc: '四 Tab：事件流 / 结果与产物 / 审批 / 审计链', surface: 'task', volume: '卷 23', manifest: 'Q-04', hidden: true } },
  { path: '/a2a/submit', name: 'a2a-submit', component: () => import('@/views/a2a/SubmitConsole.vue'), meta: { title: '提交调试台', group: '分发与生态', groupOrder: 13, order: 44, icon: 'terminal', desc: '幂等键 / 预算 / 回调 / 优先级 + 请求预览', surface: 'task', volume: '卷 23', manifest: 'Q-05' } },
  { path: '/a2a/subscriptions', name: 'a2a-subscriptions', component: () => import('@/views/a2a/EventSubscription.vue'), meta: { title: '事件订阅', group: '分发与生态', groupOrder: 13, order: 45, icon: 'notification', desc: 'SSE/WS + Last-Event-ID 续传 + 11 类外部事件过滤', surface: 'task', volume: '卷 23', manifest: 'Q-06' } },
  { path: '/a2a/approvals', name: 'a2a-approvals', component: () => import('@/views/a2a/ApprovalCallback.vue'), meta: { title: '远程审批回调', group: '分发与生态', groupOrder: 13, order: 46, icon: 'secured', desc: '审批转发 + 超时默认拒绝（10 分钟）+ 范围决策', surface: 'approval', volume: '卷 23', manifest: 'Q-07' } },
  { path: '/a2a/remote-agents', name: 'a2a-remote-agents', component: () => import('@/views/a2a/RemoteAgents.vue'), meta: { title: '远程 Agent', group: '分发与生态', groupOrder: 13, order: 47, icon: 'robot', desc: '注册与调用 + 出站 DLP 提示 + 「未验证」产出标记', surface: 'task', volume: '卷 23', manifest: 'Q-08' } },
  { path: '/a2a/federation', name: 'a2a-federation', component: () => import('@/views/a2a/Federation.vue'), meta: { title: '企业联邦', group: '分发与生态', groupOrder: 13, order: 48, icon: 'cloud', desc: '联邦目录 + 驻留约束路由 + 路由日志', surface: 'task', volume: '卷 23', manifest: 'Q-09' } },
  { path: '/a2a/caller-quotas', name: 'a2a-caller-quotas', component: () => import('@/views/a2a/CallerQuotas.vue'), meta: { title: '调用方配额', group: '分发与生态', groupOrder: 13, order: 49, icon: 'chart', desc: '五类调用方认证矩阵 + 限流 + 拒绝计数', surface: 'task', volume: '卷 23', manifest: 'Q-10' } },
] as OcRoute[];
