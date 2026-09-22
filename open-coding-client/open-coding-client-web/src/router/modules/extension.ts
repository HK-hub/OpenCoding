import type { OcRoute } from '../types';

/** 扩展与生态域路由（卷 08 技能 / 卷 09 MCP / 卷 17 Hooks / 卷 18 插件与扩展点） */
export default [
  /* ---------------- 技能（卷 08） ---------------- */
  {
    path: '/extension/skills',
    name: 'skill-library',
    component: () => import('@/views/skill/SkillLibrary.vue'),
    meta: { title: '技能库', group: '扩展与生态', groupOrder: 3, order: 1, icon: 'browse', desc: '四源发现 + 来源/兼容/状态/签名/评测徽标 + 启用点', surface: 'registry', volume: '卷 08', manifest: 'K-01' },
  },
  {
    path: '/extension/skills/suggestion',
    name: 'skill-suggestion',
    component: () => import('@/views/skill/SkillSuggestion.vue'),
    meta: { title: '技能建议与激活', group: '扩展与生态', groupOrder: 3, order: 2, icon: 'star', desc: '建议理由 + 「为什么生效」溯源 + 停用 + 自动激活开关', surface: 'registry', volume: '卷 08', manifest: 'K-04' },
  },
  {
    path: '/extension/skills/eval',
    name: 'skill-eval',
    component: () => import('@/views/skill/SkillEval.vue'),
    meta: { title: '技能评测门禁', group: '扩展与生态', groupOrder: 3, order: 3, icon: 'task-checked', desc: '用例列表 + 一键跑 + 通过率/成本/时长 + 门槛达标', surface: 'registry', volume: '卷 08', manifest: 'K-07' },
  },
  {
    path: '/extension/skills/creator',
    name: 'skill-creator',
    component: () => import('@/views/skill/SkillCreator.vue'),
    meta: { title: '技能创作器', group: '扩展与生态', groupOrder: 3, order: 4, icon: 'lightbulb', desc: '从会话提炼 / 模板脚手架 / 一键跑用例（人工评审后发布）', surface: 'wizard', volume: '卷 08', manifest: 'K-08' },
  },
  {
    path: '/extension/skills/distribution',
    name: 'skill-distribution',
    component: () => import('@/views/skill/SkillDistribution.vue'),
    meta: { title: '技能分发与签名', group: '扩展与生态', groupOrder: 3, order: 5, icon: 'share', desc: '三通道（本地/私仓/公共市场）+ 签名 + 企业开关', surface: 'registry', volume: '卷 08', manifest: 'K-09' },
  },
  {
    path: '/extension/skills/metrics',
    name: 'skill-metrics',
    component: () => import('@/views/skill/SkillMetrics.vue'),
    meta: { title: '技能使用度量', group: '扩展与生态', groupOrder: 3, order: 6, icon: 'chart-line', desc: '激活/成功率/成本/时长 + 无技能基线对比 + 劣化降级', surface: 'cost', volume: '卷 08', manifest: 'K-10' },
  },
  {
    path: '/extension/skills/detail',
    name: 'skill-detail',
    component: () => import('@/views/skill/SkillDetail.vue'),
    meta: { title: '技能详情', hidden: true, icon: 'file', desc: '八 Tab：概览/指令/资源/工具依赖/能力/权限/评测/统计', surface: 'registry', volume: '卷 08', manifest: 'K-02' },
  },
  {
    path: '/extension/skills/install',
    name: 'skill-install-confirm',
    component: () => import('@/views/skill/InstallConfirm.vue'),
    meta: { title: '安装确认', hidden: true, icon: 'download', desc: '能力声明逐条授权 + 同意并安装（最小权限）', surface: 'approval', volume: '卷 08', manifest: 'K-03' },
  },
  {
    path: '/extension/skills/uninstall',
    name: 'skill-uninstall-confirm',
    component: () => import('@/views/skill/UninstallConfirm.vue'),
    meta: { title: '卸载与禁用确认', hidden: true, icon: 'delete', desc: '依赖链提示 + 强制卸载需理由', surface: 'registry', volume: '卷 08', manifest: 'K-05' },
  },

  /* ---------------- MCP（卷 09） ---------------- */
  {
    path: '/extension/mcp',
    name: 'mcp-servers',
    component: () => import('@/views/mcp/McpServers.vue'),
    meta: { title: 'MCP 服务器', group: '扩展与生态', groupOrder: 3, order: 7, icon: 'server', desc: '传输/状态徽标 + 延迟/错误率/外发字节 + 熔断可见', surface: 'registry', volume: '卷 09', manifest: 'C-01' },
  },
  {
    path: '/extension/mcp/tools',
    name: 'mcp-tools',
    component: () => import('@/views/mcp/McpTools.vue'),
    meta: { title: 'MCP 工具发现', group: '扩展与生态', groupOrder: 3, order: 8, icon: 'tools', desc: '原始名/命名空间/别名 + 风险提示 + 与内置冲突告警', surface: 'tool', volume: '卷 09', manifest: 'C-03' },
  },
  {
    path: '/extension/mcp/logs',
    name: 'mcp-call-logs',
    component: () => import('@/views/mcp/McpCallLogs.vue'),
    meta: { title: 'MCP 调用审计', group: '扩展与生态', groupOrder: 3, order: 9, icon: 'history', desc: 'server/method/参数摘要/外发字节/决策引用/耗时/重试', surface: 'registry', volume: '卷 09', manifest: 'C-04' },
  },
  {
    path: '/extension/mcp/add',
    name: 'mcp-add-wizard',
    component: () => import('@/views/mcp/McpAddWizard.vue'),
    meta: { title: '添加 MCP 服务器', group: '扩展与生态', groupOrder: 3, order: 10, icon: 'file-add', desc: '来源 + 传输与优先级 + 网络白名单 + 沙箱档 + 凭证注入', surface: 'wizard', volume: '卷 09', manifest: 'C-05' },
  },
  {
    path: '/extension/mcp/diagnose',
    name: 'mcp-diagnose',
    component: () => import('@/views/mcp/McpDiagnose.vue'),
    meta: { title: 'MCP 一键诊断', group: '扩展与生态', groupOrder: 3, order: 11, icon: 'bug', desc: '握手/能力列表/延迟探测 + 可操作修复建议', surface: 'settings', volume: '卷 09', manifest: 'C-06' },
  },
  {
    path: '/extension/mcp/gateway',
    name: 'mcp-gateway',
    component: () => import('@/views/mcp/McpGateway.vue'),
    meta: { title: '企业 MCP 网关', group: '扩展与生态', groupOrder: 3, order: 12, icon: 'secured', desc: '白名单/审计/DLP 规则/配额/统一凭证', surface: 'settings', volume: '卷 09', manifest: 'C-07' },
  },
  {
    path: '/extension/mcp/exposure',
    name: 'mcp-exposure',
    component: () => import('@/views/mcp/McpExposure.vue'),
    meta: { title: '对外暴露矩阵', group: '扩展与生态', groupOrder: 3, order: 13, icon: 'upload', desc: '只读/资源/提示词/写类/会话控制开关 + scope + 审计', surface: 'settings', volume: '卷 09', manifest: 'C-08' },
  },
  {
    path: '/extension/mcp/resources',
    name: 'mcp-resources',
    component: () => import('@/views/mcp/McpResources.vue'),
    meta: { title: 'MCP 资源订阅', group: '扩展与生态', groupOrder: 3, order: 14, icon: 'folder-open', desc: 'mcp:// 资源 + 订阅变更 + roots 路径围栏', surface: 'registry', volume: '卷 09', manifest: 'C-10' },
  },
  {
    path: '/extension/mcp/isolation',
    name: 'mcp-isolation',
    component: () => import('@/views/mcp/McpIsolation.vue'),
    meta: { title: '故障隔离与熔断', group: '扩展与生态', groupOrder: 3, order: 15, icon: 'system', desc: '超时/并发/熔断（5 次/60s）/输出限额/重启退避', surface: 'settings', volume: '卷 09', manifest: 'C-11' },
  },
  {
    path: '/extension/mcp/detail',
    name: 'mcp-detail',
    component: () => import('@/views/mcp/McpDetail.vue'),
    meta: { title: 'MCP 服务器详情', hidden: true, icon: 'server', desc: '六 Tab：概览/工具/资源/反向请求/认证来源/审计', surface: 'registry', volume: '卷 09', manifest: 'C-02' },
  },
  {
    path: '/extension/mcp/reverse',
    name: 'mcp-reverse',
    component: () => import('@/views/mcp/McpReverse.vue'),
    meta: { title: '反向请求策略', hidden: true, icon: 'refresh', desc: 'sampling 预算确认 / elicitation 用户输入', surface: 'approval', volume: '卷 09', manifest: 'C-09' },
  },

  /* ---------------- Hooks（卷 17） ---------------- */
  {
    path: '/extension/hooks',
    name: 'hook-list',
    component: () => import('@/views/hooks/HookList.vue'),
    meta: { title: '钩子列表', group: '扩展与生态', groupOrder: 3, order: 16, icon: 'link', desc: 'id/point/scope/capability/impl/签名/熔断 + 一键禁用', surface: 'settings', volume: '卷 17', manifest: 'H-01' },
  },
  {
    path: '/extension/hooks/catalog',
    name: 'hook-catalog',
    component: () => import('@/views/hooks/HookCatalog.vue'),
    meta: { title: '钩子点目录', group: '扩展与生态', groupOrder: 3, order: 17, icon: 'sitemap', desc: '8 类 40 点目录 + 每点语义与可用能力（observe/block/rewrite）', surface: 'settings', volume: '卷 17', manifest: 'H-02' },
  },
  {
    path: '/extension/hooks/editor',
    name: 'hook-editor',
    component: () => import('@/views/hooks/HookEditor.vue'),
    meta: { title: '钩子编辑器', group: '扩展与生态', groupOrder: 3, order: 18, icon: 'edit', desc: '表单/YAML 双模 + match + 改写字段白名单 + 失败策略', surface: 'settings', volume: '卷 17', manifest: 'H-03' },
  },
  {
    path: '/extension/hooks/test',
    name: 'hook-test',
    component: () => import('@/views/hooks/HookTest.vue'),
    meta: { title: '钩子试跑', group: '扩展与生态', groupOrder: 3, order: 19, icon: 'terminal', desc: '样例输入 → 判定/改写 diff/耗时（本地试跑，无副作用）', surface: 'settings', volume: '卷 17', manifest: 'H-04' },
  },
  {
    path: '/extension/hooks/impact',
    name: 'hook-impact',
    component: () => import('@/views/hooks/HookImpact.vue'),
    meta: { title: 'hooks 影响面与 dry-run', group: '扩展与生态', groupOrder: 3, order: 20, icon: 'chart', desc: '只观察不改写 + 触发次数/阻断率/改写次数/平均耗时', surface: 'settings', volume: '卷 17', manifest: 'H-05' },
  },
  {
    path: '/extension/hooks/logs',
    name: 'hook-logs',
    component: () => import('@/views/hooks/HookLogs.vue'),
    meta: { title: '钩子执行日志', group: '扩展与生态', groupOrder: 3, order: 21, icon: 'history', desc: 'executed / blocked / rewritten 明细 + 改写 diff', surface: 'settings', volume: '卷 17', manifest: 'H-06' },
  },
  {
    path: '/extension/hooks/templates',
    name: 'hook-templates',
    component: () => import('@/views/hooks/HookTemplates.vue'),
    meta: { title: '钩子模板库', group: '扩展与生态', groupOrder: 3, order: 22, icon: 'file-copy', desc: '格式化/敏感扫描/提交规范/通知集成/审计上报 + 签名', surface: 'registry', volume: '卷 17', manifest: 'H-08' },
  },

  /* ---------------- 插件与扩展点（卷 18） ---------------- */
  {
    path: '/extension/plugins',
    name: 'plugin-market',
    component: () => import('@/views/plugin/PluginMarket.vue'),
    meta: { title: '插件市场与已安装', group: '扩展与生态', groupOrder: 3, order: 23, icon: 'extension', desc: '三层来源 + 签名 + 版本 + 健康 + 熔断', surface: 'registry', volume: '卷 18', manifest: 'L-01' },
  },
  {
    path: '/extension/plugins/load-log',
    name: 'plugin-load-log',
    component: () => import('@/views/plugin/PluginLoadLog.vue'),
    meta: { title: '插件装载日志', group: '扩展与生态', groupOrder: 3, order: 24, icon: 'code', desc: '扫描→清单→签名→兼容→依赖→装配→初始化 逐步结果', surface: 'settings', volume: '卷 18', manifest: 'L-03' },
  },
  {
    path: '/extension/catalog',
    name: 'extension-catalog',
    component: () => import('@/views/plugin/ExtensionCatalog.vue'),
    meta: { title: '扩展点目录', group: '扩展与生态', groupOrder: 3, order: 25, icon: 'layers', desc: '22 域 120+ 扩展点 + 稳定性（stable/evolving/experimental）+ 内/外', surface: 'registry', volume: '卷 18', manifest: 'L-04' },
  },
  {
    path: '/extension/plugins/health',
    name: 'plugin-health',
    component: () => import('@/views/plugin/PluginHealth.vue'),
    meta: { title: '插件健康与熔断', group: '扩展与生态', groupOrder: 3, order: 26, icon: 'secured', desc: '健康四态 + 熔断 + 隔离日志 + 指标', surface: 'settings', volume: '卷 18', manifest: 'L-05' },
  },
  {
    path: '/extension/plugins/dev-console',
    name: 'plugin-dev-console',
    component: () => import('@/views/plugin/PluginDevConsole.vue'),
    meta: { title: '插件开发者控制台', group: '扩展与生态', groupOrder: 3, order: 27, icon: 'terminal', desc: '脚手架/热重载/契约测试/打包签名/发布私仓', surface: 'registry', volume: '卷 18', manifest: 'L-06' },
  },
  {
    path: '/extension/plugins/compatibility',
    name: 'plugin-compatibility',
    component: () => import('@/views/plugin/PluginCompatibility.vue'),
    meta: { title: '插件兼容矩阵', group: '扩展与生态', groupOrder: 3, order: 28, icon: 'dashboard', desc: '插件 × 内核版本支持矩阵 + 升级/降级建议', surface: 'registry', volume: '卷 18', manifest: 'L-07' },
  },
  {
    path: '/extension/plugins/ui-host',
    name: 'plugin-ui-host',
    component: () => import('@/views/plugin/PluginUiHost.vue'),
    meta: { title: 'UI 扩展宿主', group: '扩展与生态', groupOrder: 3, order: 29, icon: 'app', desc: '面板/命令/设置页/状态栏/内联卡片/通知模板（沙箱化渲染）', surface: 'registry', volume: '卷 18', manifest: 'L-08' },
  },
  {
    path: '/extension/plugins/upgrade',
    name: 'plugin-upgrade',
    component: () => import('@/views/plugin/PluginUpgrade.vue'),
    meta: { title: '插件升级与回滚', group: '扩展与生态', groupOrder: 3, order: 30, icon: 'refresh', desc: '版本迁移 + 兼容校验 + 升级/回滚（含后果说明）', surface: 'registry', volume: '卷 18', manifest: 'L-09' },
  },
  {
    path: '/extension/plugins/detail',
    name: 'plugin-detail',
    component: () => import('@/views/plugin/PluginDetail.vue'),
    meta: { title: '插件详情', hidden: true, icon: 'extension', desc: '五 Tab：概览/能力与权限/资源/配置 Schema/依赖', surface: 'registry', volume: '卷 18', manifest: 'L-02' },
  },
] as OcRoute[];
