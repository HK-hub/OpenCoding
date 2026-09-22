import type { OcRoute } from '../types';

/**
 * 设置域路由（卷 22 §4.3 / 卷 33 §5 引导五层 / impl/30）。
 * 契约：所有偏好可持久化、可解释影响与默认值；诊断包导出必须脱敏。
 */
export default [
  {
    path: '/settings/preferences',
    name: 'settings-preferences',
    component: () => import('@/views/settings/Preferences.vue'),
    meta: { title: '偏好设置', group: '设置', groupOrder: 14, order: 1, icon: 'setting', desc: '外观 / 密度 / 语言 / 默认模式 / 默认模型', surface: 'settings', volume: '卷 22', manifest: 'G-10' },
  },
  {
    path: '/settings/accessibility',
    name: 'settings-accessibility',
    component: () => import('@/views/settings/Accessibility.vue'),
    meta: { title: '无障碍', group: '设置', groupOrder: 14, order: 2, icon: 'user-circle', desc: '字号缩放 80–150% + 减少动效 + 对比度说明 + 读屏专用布局 + 键盘可达自检', surface: 'settings', volume: '卷 33', manifest: 'G-10' },
  },
  {
    path: '/settings/keymap',
    name: 'settings-keymap',
    component: () => import('@/views/settings/Keymap.vue'),
    meta: { title: '键盘与键位', group: '设置', groupOrder: 14, order: 3, icon: 'terminal', desc: '六层键位表 + 冲突检测 + 重置', surface: 'settings', volume: '卷 33', manifest: 'G-09' },
  },
  {
    path: '/settings/models',
    name: 'settings-models',
    component: () => import('@/views/settings/ModelsSettings.vue'),
    meta: { title: '模型设置', group: '设置', groupOrder: 14, order: 4, icon: 'robot', desc: '默认模型 / 推理强度 / 思考预算 / 结构化输出', surface: 'settings', volume: '卷 02', manifest: 'M-01' },
  },
  {
    path: '/settings/notifications',
    name: 'settings-notifications',
    component: () => import('@/views/settings/NotificationsSettings.vue'),
    meta: { title: '通知设置', group: '设置', groupOrder: 14, order: 5, icon: 'notification', desc: '六类模板 + 渠道 + 静默时段 + P0 穿透', surface: 'settings', volume: '卷 33', manifest: 'F-05、X-12' },
  },
  {
    path: '/settings/workspace',
    name: 'settings-workspace',
    component: () => import('@/views/settings/WorkspaceSettings.vue'),
    meta: { title: '工作区设置', group: '设置', groupOrder: 14, order: 6, icon: 'folder', desc: '默认工作区 / 忽略规则 / 环境清单', surface: 'settings', volume: '卷 20', manifest: 'O-01' },
  },
  {
    path: '/settings/diagnostics',
    name: 'settings-diagnostics',
    component: () => import('@/views/settings/Diagnostics.vue'),
    meta: { title: '诊断', group: '设置', groupOrder: 14, order: 7, icon: 'system', desc: '装配计划 + 能力门控 + 插件健康 + 连接状态 + 最近错误 + 一键导出脱敏诊断包', surface: 'settings', volume: '卷 29', manifest: 'N-12' },
  },
  {
    path: '/settings/tips',
    name: 'settings-tips',
    component: () => import('@/views/settings/TipsSettings.vue'),
    meta: { title: '引导与教学', group: '设置', groupOrder: 14, order: 8, icon: 'lightbulb', desc: '五层引导（L1 首次运行 / L2 情境提示 / L3 内联帮助 / L4 深度文档 / L5 示例任务库）+ 全部可永久关闭', surface: 'settings', volume: '卷 33', manifest: 'G-08' },
  },
  {
    path: '/settings/about',
    name: 'settings-about',
    component: () => import('@/views/settings/About.vue'),
    meta: { title: '关于', group: '设置', groupOrder: 14, order: 9, icon: 'help', desc: '版本 / 通道 / 许可状态 / 更新入口 / 开源许可', surface: 'settings', volume: '卷 28', manifest: 'D-01' },
  },
] as OcRoute[];
