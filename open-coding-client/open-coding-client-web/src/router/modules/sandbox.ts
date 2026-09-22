import type { OcRoute } from '../types';

/** 沙箱与安全执行域路由（卷 07 + BUILD-MANIFEST B-01…B-13） */
export default [
  {
    path: '/sandbox/tiers',
    name: 'sandbox-tiers',
    component: () => import('@/views/sandbox/TierConfig.vue'),
    meta: { title: '沙箱档位配置', group: '执行与安全', groupOrder: 5, order: 1, icon: 'server', desc: 'L0 / L0+ / L1 / L2 / L3 卡 + 策略上下限 + clamp 选档算法', surface: 'settings', volume: '卷 07', manifest: 'B-01' },
  },
  {
    path: '/sandbox/platforms',
    name: 'sandbox-platforms',
    component: () => import('@/views/sandbox/PlatformMatrix.vue'),
    meta: { title: '平台能力矩阵', group: '执行与安全', groupOrder: 5, order: 2, icon: 'platform', desc: '7 类能力 × Linux/macOS/Windows + 不可用格降级标注', surface: 'settings', volume: '卷 07', manifest: 'B-02' },
  },
  {
    path: '/sandbox/plans',
    name: 'sandbox-plans',
    component: () => import('@/views/sandbox/SandboxPlan.vue'),
    meta: { title: '沙箱计划预览', group: '执行与安全', groupOrder: 5, order: 3, icon: 'task', desc: '目标档 / 实际档 / 降级原因 / 策略依据 / 不达标即拒绝', surface: 'settings', volume: '卷 07', manifest: 'B-03' },
  },
  {
    path: '/sandbox/executions',
    name: 'sandbox-executions',
    component: () => import('@/views/sandbox/ExecutionRecords.vue'),
    meta: { title: '执行记录与录制', group: '执行与安全', groupOrder: 5, order: 4, icon: 'terminal', desc: '命令/退出码/输出摘要/资源峰值 + 全量 IO 录制 + 脱敏标记', surface: 'settings', volume: '卷 07', manifest: 'B-04' },
  },
  {
    path: '/sandbox/snapshots',
    name: 'sandbox-snapshots',
    component: () => import('@/views/sandbox/SnapshotManager.vue'),
    meta: { title: '快照管理', group: '执行与安全', groupOrder: 5, order: 5, icon: 'file-copy', desc: '触发源/范围/大小/去重率/TTL/引用计数 + 四种恢复粒度', surface: 'settings', volume: '卷 07', manifest: 'B-05' },
  },
  {
    path: '/sandbox/network',
    name: 'sandbox-network',
    component: () => import('@/views/sandbox/NetworkPolicy.vue'),
    meta: { title: '网络策略', group: '执行与安全', groupOrder: 5, order: 6, icon: 'link', desc: '白名单/黑名单 + 工具族候选确认 + 审计代理开关（默认拒绝）', surface: 'settings', volume: '卷 07', manifest: 'B-06' },
  },
  {
    path: '/sandbox/egress',
    name: 'sandbox-egress',
    component: () => import('@/views/sandbox/EgressEvents.vue'),
    meta: { title: '出网事件', group: '执行与安全', groupOrder: 5, order: 7, icon: 'cloud', desc: '域名/方法/字节/时间/命令 ID/判定 + 申请加白', surface: 'settings', volume: '卷 07', manifest: 'B-07' },
  },
  {
    path: '/sandbox/credentials',
    name: 'sandbox-credentials',
    component: () => import('@/views/sandbox/CredentialProxy.vue'),
    meta: { title: '密钥代理', group: '执行与安全', groupOrder: 5, order: 8, icon: 'lock', desc: '凭证引用↔域名匹配 + 短期令牌 + 伪造环境变量 + 真实值仅存代理内存', surface: 'settings', volume: '卷 07', manifest: 'B-08' },
  },
  {
    path: '/sandbox/danger-rules',
    name: 'sandbox-danger-rules',
    component: () => import('@/views/sandbox/DangerRules.vue'),
    meta: { title: '危险命令规则', group: '执行与安全', groupOrder: 5, order: 9, icon: 'bug', desc: '内置+企业规则库 + Shell 方言 + 命中记录 + 模型二次判定 + 误报控制', surface: 'settings', volume: '卷 07', manifest: 'B-09' },
  },
  {
    path: '/sandbox/resource-limits',
    name: 'sandbox-resource-limits',
    component: () => import('@/views/sandbox/ResourceLimits.vue'),
    meta: { title: '资源限制', group: '执行与安全', groupOrder: 5, order: 10, icon: 'chart-bar', desc: 'CPU/内存/进程/输出/超时/磁盘 + 超限处置预览', surface: 'settings', volume: '卷 07', manifest: 'B-10' },
  },
  {
    path: '/sandbox/violations',
    name: 'sandbox-violations',
    component: () => import('@/views/sandbox/Violations.vue'),
    meta: { title: '安全违规与处置', group: '执行与安全', groupOrder: 5, order: 11, icon: 'error', desc: '六类违规 + 规范化路径 + 处置动作 + 重复升级', surface: 'settings', volume: '卷 07', manifest: 'B-11' },
  },
  {
    path: '/sandbox/supply-chain',
    name: 'sandbox-supply-chain',
    component: () => import('@/views/sandbox/SupplyChain.vue'),
    meta: { title: '供应链安全', group: '执行与安全', groupOrder: 5, order: 12, icon: 'sitemap', desc: '锁文件强制 + 依赖差异审计 + 来源校验 + 安装后扫描 + air-gapped', surface: 'settings', volume: '卷 07', manifest: 'B-12' },
  },
  {
    path: '/sandbox/escape',
    name: 'sandbox-escape',
    component: () => import('@/views/sandbox/EscapeAlert.vue'),
    meta: { title: '逃逸处置告警', group: '执行与安全', groupOrder: 5, order: 13, icon: 'secured', desc: '逃逸迹象：终止沙箱 + 冻结会话 + 告警（NFR-S-1 零容忍）', surface: 'settings', volume: '卷 07', manifest: 'B-13' },
  },
] as OcRoute[];
