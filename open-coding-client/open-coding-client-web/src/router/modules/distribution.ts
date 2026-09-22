/**
 * 分发 / 遥测 / 许可域路由（卷 28 / BUILD-MANIFEST D-01/D-03/F-01/F-02/F-04/F-05/F-06）。默认导出 OcRoute[]。
 */
import type { OcRoute } from '../types';

export default [
  { path: '/distribution/updates', name: 'dist-updates', component: () => import('@/views/distribution/UpdateCenter.vue'), meta: { title: '更新中心', group: '分发与生态', groupOrder: 13, order: 1, icon: 'download', desc: '当前版本 + 三通道（stable/beta/nightly）+ 决策按钮', surface: 'settings', volume: '卷 28', manifest: 'D-01' } },
  { path: '/distribution/update-detail', name: 'dist-update-detail', component: () => import('@/views/distribution/UpdateDetail.vue'), meta: { title: '更新详情', group: '分发与生态', groupOrder: 13, order: 2, icon: 'file', desc: '元数据 + 制品哈希/签名 + 迁移信息 + 公告', surface: 'settings', volume: '卷 28', manifest: 'D-01', hidden: true } },
  { path: '/distribution/update-progress', name: 'dist-update-progress', component: () => import('@/views/distribution/UpdateProgress.vue'), meta: { title: '更新进度', group: '分发与生态', groupOrder: 13, order: 3, icon: 'loading', desc: '下载 → 校验 → 预检 → 健康检查 + 预检失败阻断原因', surface: 'settings', volume: '卷 28', manifest: 'D-01' } },
  { path: '/distribution/rollback', name: 'dist-rollback', component: () => import('@/views/distribution/Rollback.vue'), meta: { title: '版本回滚', group: '分发与生态', groupOrder: 13, order: 4, icon: 'history', desc: '保留前 2 版本 + ≤2 分钟 + 数据快照说明', surface: 'settings', volume: '卷 28', manifest: 'D-01' } },
  { path: '/distribution/offline', name: 'dist-offline', component: () => import('@/views/distribution/OfflineDistribution.vue'), meta: { title: '离线分发', group: '分发与生态', groupOrder: 13, order: 5, icon: 'layers', desc: '介质包 + 私仓镜像 + 离线激活', surface: 'settings', volume: '卷 28', manifest: 'D-03' } },
  { path: '/distribution/telemetry', name: 'dist-telemetry', component: () => import('@/views/distribution/Telemetry.vue'), meta: { title: '遥测与隐私', group: '分发与生态', groupOrder: 13, order: 6, icon: 'chart-bubble', desc: '三级独立同意（默认全关）+ 采样 + 本地预览 + 一键清除', surface: 'settings', volume: '卷 28', manifest: 'F-01' } },
  { path: '/distribution/crashes', name: 'dist-crashes', component: () => import('@/views/distribution/CrashReports.vue'), meta: { title: '崩溃上报', group: '分发与生态', groupOrder: 13, order: 7, icon: 'error', desc: '本地转储 14 天 + 摘要自动 + 完整需确认 + 上传链接过期', surface: 'settings', volume: '卷 28', manifest: 'F-02' } },
  { path: '/distribution/license', name: 'dist-license', component: () => import('@/views/distribution/License.vue'), meta: { title: '许可与席位', group: '分发与生态', groupOrder: 13, order: 8, icon: 'secured', desc: '席位（30 天活跃口径）+ 宽限 30 天 + 只读降级（可导出）+ 对账', surface: 'settings', volume: '卷 28', manifest: 'F-04', permission: 'billing.read' } },
  { path: '/distribution/notifications', name: 'dist-notifications', component: () => import('@/views/distribution/Notifications.vue'), meta: { title: '通知路由', group: '分发与生态', groupOrder: 13, order: 9, icon: 'notification', desc: '聚合去重 + 优先级路由 + 静默 + 失败重试/死信', surface: 'settings', volume: '卷 28', manifest: 'F-05、X-12' } },
  { path: '/distribution/announcements', name: 'dist-announcements', component: () => import('@/views/distribution/Announcements.vue'), meta: { title: '公告与门槛', group: '分发与生态', groupOrder: 13, order: 10, icon: 'sound', desc: '四级公告 + 已读确认 + 强制门槛 + 一键迁移', surface: 'settings', volume: '卷 28', manifest: 'F-06' } },
  { path: '/distribution/images', name: 'dist-images', component: () => import('@/views/distribution/Images.vue'), meta: { title: '沙箱镜像', group: '分发与生态', groupOrder: 13, order: 11, icon: 'layers', desc: '镜像签名校验 + 本地缓存字节 + 清理', surface: 'settings', volume: '卷 28', manifest: 'D-03' } },
] as OcRoute[];
