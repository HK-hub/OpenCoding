import type { OcRoute } from '../types';

/** 持久化 / 迁移 / 恢复域路由（卷 19；BUILD-MANIFEST Z-01…Z-11） */
export default [
  {
    path: '/persistence/domains',
    name: 'persistence-domains',
    component: () => import('@/views/persistence/DataDomains.vue'),
    meta: { title: '数据分域总览', group: '平台与工程', groupOrder: 9, order: 11, icon: 'database', desc: '14 域表：主要数据 / 存储 / 唯一写入者 / 保留', surface: 'registry', volume: '卷 19', manifest: 'Z-01' },
  },
  {
    path: '/persistence/migrations',
    name: 'persistence-migrations',
    component: () => import('@/views/persistence/Migrations.vue'),
    meta: { title: '迁移列表与迁移包', group: '平台与工程', groupOrder: 9, order: 12, icon: 'database', desc: '版本 / 校验和 / 前向逆向脚本 / 回填 / 破坏性审批', surface: 'settings', volume: '卷 19', manifest: 'Z-02' },
  },
  {
    path: '/persistence/pipeline',
    name: 'persistence-pipeline',
    component: () => import('@/views/persistence/MigrationPipeline.vue'),
    meta: { title: '迁移流水线看板', group: '平台与工程', groupOrder: 9, order: 13, icon: 'database', desc: '六阶段：静态校验→空库→样本→回归→回滚演练→合入部署', surface: 'automation', volume: '卷 19', manifest: 'Z-03' },
  },
  {
    path: '/persistence/backup',
    name: 'persistence-backup',
    component: () => import('@/views/persistence/BackupPitr.vue'),
    meta: { title: '备份与 PITR', group: '平台与工程', groupOrder: 9, order: 14, icon: 'database', desc: '物理 + WAL + 逻辑导出 + 备份年龄 + WAL 滞后 + 时间点恢复', surface: 'settings', volume: '卷 19', manifest: 'Z-04' },
  },
  {
    path: '/persistence/drill',
    name: 'persistence-drill',
    component: () => import('@/views/persistence/RestoreDrill.vue'),
    meta: { title: '恢复演练', group: '平台与工程', groupOrder: 9, order: 15, icon: 'database', desc: 'RPO ≤ 1min / RTO ≤ 15min 证据 + 演练报告', surface: 'settings', volume: '卷 19', manifest: 'Z-05' },
  },
  {
    path: '/persistence/recovery',
    name: 'persistence-recovery',
    component: () => import('@/views/persistence/RecoveryCoordinator.vue'),
    meta: { title: '崩溃恢复协调器', group: '平台与工程', groupOrder: 9, order: 16, icon: 'database', desc: '未完成会话/任务/团队 + 检查点校验 + 副作用账本跳过', surface: 'task', volume: '卷 19', manifest: 'Z-06' },
  },
  {
    path: '/persistence/import-export',
    name: 'persistence-import-export',
    component: () => import('@/views/persistence/ImportExportCenter.vue'),
    meta: { title: '导入导出中心', group: '平台与工程', groupOrder: 9, order: 17, icon: 'database', desc: '厂商中立包结构 + 哈希校验 + 部分导入 + 引用缺失报告', surface: 'settings', volume: '卷 19', manifest: 'Z-07' },
  },
  {
    path: '/persistence/consistency',
    name: 'persistence-consistency',
    component: () => import('@/views/persistence/ConsistencyCheck.vue'),
    meta: { title: '一致性校验', group: '平台与工程', groupOrder: 9, order: 18, icon: 'database', desc: '六类校验对 + 偏差 + 自动修复（审计链仅告警）', surface: 'settings', volume: '卷 19', manifest: 'Z-08' },
  },
  {
    path: '/persistence/retention',
    name: 'persistence-retention',
    component: () => import('@/views/persistence/RetentionPurge.vue'),
    meta: { title: '保留与合规删除', group: '平台与工程', groupOrder: 9, order: 19, icon: 'database', desc: '分级保留 + 六层贯通 + 删除证明查看器', surface: 'settings', volume: '卷 19', manifest: 'Z-09', permission: 'compliance.delete' },
  },
  {
    path: '/persistence/object-storage',
    name: 'persistence-object-storage',
    component: () => import('@/views/persistence/ObjectStorage.vue'),
    meta: { title: '对象存储治理', group: '平台与工程', groupOrder: 9, order: 20, icon: 'database', desc: '三类命名空间 + 引用计数 + 冷热分层 + 去重率 + 加密', surface: 'settings', volume: '卷 19', manifest: 'Z-10' },
  },
  {
    path: '/persistence/disaster-recovery',
    name: 'persistence-disaster-recovery',
    component: () => import('@/views/persistence/DisasterRecovery.vue'),
    meta: { title: '灾备与演练', group: '平台与工程', groupOrder: 9, order: 21, icon: 'database', desc: '主备/多副本 + 跨区备份 + 季度演练报告', surface: 'settings', volume: '卷 19', manifest: 'Z-11' },
  },
] as OcRoute[];
