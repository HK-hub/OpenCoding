/**
 * 安全工程域路由（卷 30 / BUILD-MANIFEST G3-01…G3-10）。默认导出 OcRoute[]。
 */
import type { OcRoute } from '../types';

export default [
  { path: '/security/overview', name: 'sec-overview', component: () => import('@/views/security/Overview.vue'), meta: { title: '安全总览', group: '企业治理', groupOrder: 10, order: 20, icon: 'secured', desc: '资产分级 A0–A3 + 10 信任边界拓扑 + STRIDE 矩阵', surface: 'settings', volume: '卷 30', manifest: 'G3-01' } },
  { path: '/security/credentials', name: 'sec-credentials', component: () => import('@/views/security/Credentials.vue'), meta: { title: '凭证与密钥', group: '企业治理', groupOrder: 10, order: 21, icon: 'lock', desc: '六类密钥 + 六态时间线 + 90 天轮换倒计时', surface: 'settings', volume: '卷 30', manifest: 'G3-02', permission: 'credential.manage' } },
  { path: '/security/cert-proxy', name: 'sec-cert-proxy', component: () => import('@/views/security/CertProxy.vue'), meta: { title: '证书与企业代理', group: '企业治理', groupOrder: 10, order: 22, icon: 'api', desc: '自定义 CA + 代理 + 证书固定与例外 + TLS 握手诊断', surface: 'settings', volume: '卷 30', manifest: 'G3-03' } },
  { path: '/security/supply-chain', name: 'sec-supply-chain', component: () => import('@/views/security/SupplyChain.vue'), meta: { title: '供应链安全', group: '企业治理', groupOrder: 10, order: 23, icon: 'extension', desc: '四类制品检查 + 失败动作与阻断点', surface: 'settings', volume: '卷 30', manifest: 'G3-04' } },
  { path: '/security/vulnerabilities', name: 'sec-vulns', component: () => import('@/views/security/Vulnerabilities.vue'), meta: { title: '漏洞管理', group: '企业治理', groupOrder: 10, order: 24, icon: 'bug', desc: '生命周期 + SLA 倒计时（24h/7d/30d/90d）+ 私密报告', surface: 'settings', volume: '卷 30', manifest: 'G3-05' } },
  { path: '/security/compliance', name: 'sec-compliance', component: () => import('@/views/security/Compliance.vue'), meta: { title: '合规映射', group: '企业治理', groupOrder: 10, order: 25, icon: 'check', desc: '等保/ISO/SOC2/GDPR/个保法 + 控制项→落点→证据', surface: 'settings', volume: '卷 30', manifest: 'G3-06', permission: 'audit.read' } },
  { path: '/security/incidents', name: 'sec-incidents', component: () => import('@/views/security/Incidents.vue'), meta: { title: '安全事件响应', group: '企业治理', groupOrder: 10, order: 26, icon: 'error', desc: 'SEV1–4 + 四角色 + 冻结隔离 + 取证 + 复盘', surface: 'settings', volume: '卷 30', manifest: 'G3-07' } },
  { path: '/security/abuse', name: 'sec-abuse', component: () => import('@/views/security/Abuse.vue'), meta: { title: '防滥用', group: '企业治理', groupOrder: 10, order: 27, icon: 'sound', desc: '五类检测 × 信号 × 处置 + 误报控制', surface: 'settings', volume: '卷 30', manifest: 'G3-08' } },
  { path: '/security/privacy', name: 'sec-privacy', component: () => import('@/views/security/Privacy.vue'), meta: { title: '隐私工程', group: '企业治理', groupOrder: 10, order: 28, icon: 'browse', desc: '最小化/目的限制/PII/可导出可删除/跨境/遥测本地预览', surface: 'settings', volume: '卷 30', manifest: 'G3-09' } },
  { path: '/security/gates', name: 'sec-gates', component: () => import('@/views/security/SecurityGates.vue'), meta: { title: '安全测试门禁', group: '企业治理', groupOrder: 10, order: 29, icon: 'check', desc: '六层门禁（SAST/依赖镜像/密钥泄漏/DAST/模糊/红队）+ 通过率', surface: 'settings', volume: '卷 30', manifest: 'G3-10' } },
] as OcRoute[];
