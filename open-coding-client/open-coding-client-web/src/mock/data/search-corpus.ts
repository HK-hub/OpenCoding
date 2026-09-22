/**
 * 搜索语料（八源统一搜索的数据源）。
 * 覆盖：会话 / 任务目标 / 知识 / 记忆 / 技能插件 / 工作区文件 / 审计 / 事件。
 */
import { Rng } from '../rng';

export interface SearchHit {
  id: string;
  source: string;
  title: string;
  snippet: string;
  path: string;
  deepLink: string;
  /** 是否因权限被过滤（前置过滤：越权结果不返回，此处仅用于演示「已过滤」提示） */
  restricted?: boolean;
}

export function buildSearchCorpus(_r: Rng): SearchHit[] {
  const corpus: SearchHit[] = [
    { id: 'sc-1', source: '会话', title: '为 payment-core 增加幂等重试并补齐单测', snippet: '…同 key 只生效一次；指数退避 1s/2s/4s；未验证项：移动端并发…', path: '/session', deepLink: 'open/session/S-4001' },
    { id: 'sc-2', source: '会话', title: '排查 identity-gateway 登录态偶发失效', snippet: '…怀疑与令牌续期竞态有关；已开启全量录制…', path: '/session', deepLink: 'open/session/S-4002' },
    { id: 'sc-3', source: '任务 / 目标', title: 'T-7f3a 幂等重试改造（in_review）', snippet: '验收 6/8；证据：128 passed；阻塞原因：等待人工确认 PR', path: '/task/board', deepLink: 'open/task/T-7f3a' },
    { id: 'sc-4', source: '任务 / 目标', title: 'G-1a02 把支付链路 P99 降到 500ms 以内', snippet: '进度 42%；预算已用 61%；漂移检测：无；干预点：上线前必须人工确认', path: '/goal/list', deepLink: 'open/goal/G-1a02' },
    { id: 'sc-5', source: '知识', title: '支付链路幂等设计（项目知识页）', snippet: '…idempotencyKey 由调用方生成，服务端以唯一约束兜底；重试需可区分「已成功响应丢失」…', path: '/knowledge/wiki', deepLink: 'open/wiki/page-3021' },
    { id: 'sc-6', source: '知识', title: 'ADR-014 幂等与重试策略', snippet: '…拒绝共享单例锁方案；采用唯一约束 + 首次结果回读…', path: '/knowledge/search', deepLink: 'open/kb/doc-88' },
    { id: 'sc-7', source: '记忆', title: '项目记忆：提交信息使用中文', snippet: '来源：用户确认（置信 高）· 生效范围：本项目 · 复审：30 天后', path: '/memory/list', deepLink: 'open/kb/doc-90' },
    { id: 'sc-8', source: '记忆', title: '项目记忆：payment-core 幂等键命名约定', snippet: '来源：Agent 提议（已确认）· 影响范围：payment-core/**', path: '/memory/list', deepLink: 'open/kb/doc-91' },
    { id: 'sc-9', source: '技能 / 插件', title: '技能「Dockerfile 优化」（来源：项目）', snippet: '关注镜像层级与缓存；权限声明：只读 + 建议编辑；评测通过率 92%', path: '/registry/skills', deepLink: 'install/skill/dockerfile-opt@1.4' },
    { id: 'sc-10', source: '技能 / 插件', title: '插件「K8s 运维扩展」v2.3.1', snippet: '扩展点：tool.provider / ui.panel；需权限 network:egress:api.acme.internal', path: '/registry/plugins', deepLink: 'install/plugin/com.acme.k8s-ops@2.3.1' },
    { id: 'sc-11', source: '工作区文件', title: 'PaymentServiceImpl.java#L88-L126', snippet: '…handleRetry() 增加幂等校验与退避重试…', path: '/workspace/files', deepLink: 'open/session/S-4001' },
    { id: 'sc-12', source: '工作区文件', title: 'IdempotencyGuardTest.java', snippet: '…concurrentSubmit_onlyOnce / backoff_intervals…', path: '/workspace/files', deepLink: 'open/session/S-4001' },
    { id: 'sc-13', source: '审计', title: '决策 AR-4f21 已批准（R2 执行）', snippet: '批准者：沈亦舟 · 范围：本会话（mvn * test*）· 求值轨迹 3 条规则', path: '/approval/history', deepLink: 'approve/AR-4f21' },
    { id: 'sc-14', source: '审计', title: '密钥轮换：git-token-prod 已轮换', snippet: '触发：到期（90 天）· 执行者：系统 · 影响：3 个工作区连接', path: '/enterprise/credentials', deepLink: 'open/session/S-4001' },
    { id: 'sc-15', source: '事件', title: 'context.compacted（L2）', snippet: 'session=S-4001 · 41200 → 26800 tokens · 地图 map-7f21', path: '/event/live', deepLink: 'open/session/S-4001' },
    { id: 'sc-16', source: '事件', title: 'sandbox.degraded', snippet: '目标档 L1、实际档 L0+、原因：容器运行时不可用', path: '/event/live', deepLink: 'open/session/S-4001', restricted: true },
    { id: 'sc-17', source: '自动化', title: '模板「依赖升级」运行 #8821', snippet: 'SUCCEEDED · 3 个 PR · 成本 $4.12 · 节省约 2.1 小时', path: '/automation/templates', deepLink: 'open/task/T-8821' },
    { id: 'sc-18', source: '智能增强', title: 'PR #412 描述草稿（AI 生成）', snippet: '引用覆盖率 94% · 未覆盖项 2 条 · 待人工校订', path: '/intel/outputs', deepLink: 'open/task/T-7f3a' },
  ];
  return corpus;
}
