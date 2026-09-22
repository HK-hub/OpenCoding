import type { OcRoute } from '../types';

/** 事件系统域路由（卷 16；BUILD-MANIFEST V-01…V-10） */
export default [
  {
    path: '/event/live-tail',
    name: 'event-live-tail',
    component: () => import('@/views/event/LiveTail.vue'),
    meta: { title: '事件流浏览器', group: '平台与工程', groupOrder: 9, order: 1, icon: 'system', desc: '实时追加 + 双通道（durable seq / live 可丢）+ 域前缀与敏感度过滤', surface: 'registry', volume: '卷 16', manifest: 'V-01' },
  },
  {
    path: '/event/detail',
    name: 'event-detail',
    component: () => import('@/views/event/EventDetail.vue'),
    meta: { title: '事件详情', group: '平台与工程', groupOrder: 9, order: 2, icon: 'system', desc: '16 字段信封 + payload + schemaRef + trace 上下文', surface: 'registry', volume: '卷 16', manifest: 'V-02' },
  },
  {
    path: '/event/schema',
    name: 'event-schema',
    component: () => import('@/views/event/SchemaRegistry.vue'),
    meta: { title: '事件 Schema 目录', group: '平台与工程', groupOrder: 9, order: 3, icon: 'system', desc: '声明式定义 + 版本 + 兼容性校验 + 被拒 Schema', surface: 'registry', volume: '卷 16', manifest: 'V-03' },
  },
  {
    path: '/event/consumers',
    name: 'event-consumers',
    component: () => import('@/views/event/Consumers.vue'),
    meta: { title: '消费者与滞后', group: '平台与工程', groupOrder: 9, order: 4, icon: 'system', desc: '8 类消费者 + offset + 滞后秒数 + 告警阈值 + 趋势', surface: 'registry', volume: '卷 16', manifest: 'V-04' },
  },
  {
    path: '/event/dead-letters',
    name: 'event-dead-letters',
    component: () => import('@/views/event/DeadLetters.vue'),
    meta: { title: '死信队列', group: '平台与工程', groupOrder: 9, order: 5, icon: 'system', desc: '失败事件 + 失败原因 + 重放（幂等键校验）', surface: 'registry', volume: '卷 16', manifest: 'V-05' },
  },
  {
    path: '/event/webhooks',
    name: 'event-webhooks',
    component: () => import('@/views/event/WebhookSubscriptions.vue'),
    meta: { title: 'Webhook 订阅', group: '平台与工程', groupOrder: 9, order: 6, icon: 'system', desc: '事件过滤 + 签名 + 重试 + 死信 + 投递记录', surface: 'registry', volume: '卷 16', manifest: 'V-06' },
  },
  {
    path: '/event/export',
    name: 'event-export',
    component: () => import('@/views/event/ExportJobs.vue'),
    meta: { title: '事件导出任务', group: '平台与工程', groupOrder: 9, order: 7, icon: 'system', desc: 'Parquet/JSONL → 对象存储/数据湖 + 状态与产物', surface: 'registry', volume: '卷 16', manifest: 'V-07' },
  },
  {
    path: '/event/replay',
    name: 'event-replay',
    component: () => import('@/views/event/ReplayConsole.vue'),
    meta: { title: '回放控制台', group: '平台与工程', groupOrder: 9, order: 8, icon: 'system', desc: '投影重建 / 会话重放（变速跳转）/ 环境重放（可丢弃）/ 审计重放', surface: 'intel', volume: '卷 16', manifest: 'V-08' },
  },
  {
    path: '/event/retention',
    name: 'event-retention',
    component: () => import('@/views/event/Retention.vue'),
    meta: { title: '留存与归档', group: '平台与工程', groupOrder: 9, order: 9, icon: 'system', desc: '分类留存 + 冷归档 + 合规删除穿透 + 删除证明', surface: 'settings', volume: '卷 16', manifest: 'V-09', permission: 'compliance.delete' },
  },
  {
    path: '/event/trace',
    name: 'event-trace',
    component: () => import('@/views/event/TraceLookup.vue'),
    meta: { title: '事件与追踪互查', group: '平台与工程', groupOrder: 9, order: 10, icon: 'system', desc: '事件 ↔ trace/span 互查 + 指标点 → 事件', surface: 'intel', volume: '卷 16', manifest: 'V-10' },
  },
] as OcRoute[];
