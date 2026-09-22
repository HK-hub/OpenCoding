import type { OcRoute } from '../types';

/** 权限与审批策略域路由（卷 06 + BUILD-MANIFEST P-01…P-10） */
export default [
  {
    path: '/permission/risk-matrix',
    name: 'permission-risk-matrix',
    component: () => import('@/views/permission/RiskMatrix.vue'),
    meta: { title: '风险分级矩阵', group: '执行与安全', groupOrder: 5, order: 1, icon: 'secured', desc: 'R0–R5 判定依据与默认决策 + 参数级 AST 解析 + 沙箱档映射', surface: 'approval', volume: '卷 06', manifest: 'P-01' },
  },
  {
    path: '/permission/modes',
    name: 'permission-modes',
    component: () => import('@/views/permission/ModeSwitcher.vue'),
    meta: { title: '权限模式切换', group: '执行与安全', groupOrder: 5, order: 2, icon: 'platform', desc: '六档模式语义/适用场景/切换事件；yolo 企业禁用置灰', surface: 'approval', volume: '卷 06', manifest: 'P-02' },
  },
  {
    path: '/permission/policies',
    name: 'permission-policies',
    component: () => import('@/views/permission/PolicyManager.vue'),
    meta: { title: '策略管理', group: '执行与安全', groupOrder: 5, order: 3, icon: 'lock', desc: '六层级树 + 规则（谓词/动作/优先级）+ 拒绝优先 + 基线锁定只读', surface: 'approval', volume: '卷 06', manifest: 'P-03' },
  },
  {
    path: '/permission/auto-approve',
    name: 'permission-auto-approve',
    component: () => import('@/views/permission/AutoApproveRules.vue'),
    meta: { title: '自动批准规则', group: '执行与安全', groupOrder: 5, order: 4, icon: 'task-checked', desc: '规则即代码（谓词 DSL）+ 到期时间 + 记录人 + 审计引用', surface: 'approval', volume: '卷 06', manifest: 'P-04' },
  },
  {
    path: '/permission/decisions',
    name: 'permission-decisions',
    component: () => import('@/views/permission/DecisionReplay.vue'),
    meta: { title: '决策详情与回放', group: '执行与安全', groupOrder: 5, order: 5, icon: 'filter', desc: '求值轨迹 + 策略版本 + 命中规则 + 重放一致性', surface: 'approval', volume: '卷 06', manifest: 'P-06' },
  },
  {
    path: '/permission/security-events',
    name: 'permission-security-events',
    component: () => import('@/views/permission/SecurityEvents.vue'),
    meta: { title: '安全事件', group: '执行与安全', groupOrder: 5, order: 6, icon: 'bug', desc: 'override.denied / bypass.detected / sandbox.denied 三类事件流', surface: 'approval', volume: '卷 06', manifest: 'P-07' },
  },
  {
    path: '/permission/escalation',
    name: 'permission-escalation',
    component: () => import('@/views/permission/Escalation.vue'),
    meta: { title: '升级链与 SLA', group: '执行与安全', groupOrder: 5, order: 7, icon: 'notification', desc: '三级升级链 + SLA + 超时动作（deny/escalate）+ 留痕', surface: 'approval', volume: '卷 06', manifest: 'P-08' },
  },
  {
    path: '/permission/overreach',
    name: 'permission-overreach',
    component: () => import('@/views/permission/OverreachDetection.vue'),
    meta: { title: '越权检测三层', group: '执行与安全', groupOrder: 5, order: 8, icon: 'layers', desc: '决策链（事前）/ 沙箱围栏（事中）/ 审计扫描（事后）状态与发现项', surface: 'approval', volume: '卷 06', manifest: 'P-10' },
  },
] as OcRoute[];
