/**
 * 扩展体系（技能 / MCP / Hooks / 插件）页面共用列表状态与展示映射。
 * 统一承载：关键词与过滤记忆（localStorage）、首屏加载、EMPTY/ERROR、EDGE_DATA 折叠、
 * 以及各子域枚举的标签与主题色（子域枚举定义见 mock/data/extension.ts）。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useUiStore } from '@/stores/ui';
import { runtime } from '@/mock/runtime';
import type { SignatureState } from '@/mock/data/extension';

export type ExtListState = 'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA';
export type TagTheme = 'default' | 'primary' | 'success' | 'warning' | 'danger';

/* ---------------- 枚举展示映射 ---------------- */

export const SIGNATURE_LABEL: Record<SignatureState, string> = {
  verified: '签名有效',
  unsigned: '未签名',
  invalid: '签名失败',
};

export const SIGNATURE_THEME: Record<SignatureState, TagTheme> = {
  verified: 'success',
  unsigned: 'warning',
  invalid: 'danger',
};

export const SKILL_STATE_THEME: Record<string, TagTheme> = {
  Discovered: 'default',
  Installed: 'primary',
  Active: 'success',
  Inactive: 'default',
  Disabled: 'warning',
  Updated: 'primary',
  Removed: 'danger',
};

export const SKILL_SCOPE_LABEL: Record<string, string> = {
  builtin: '内置',
  org: '组织',
  project: '项目',
  user: '用户',
};

export const SKILL_SOURCE_LABEL: Record<string, string> = {
  builtin: '内置（随产品）',
  'org-registry': '组织私仓',
  'project-dir': '项目目录 .oc/skills',
  'user-dir': '用户目录 ~/.oc/skills',
};

export const TRIGGER_LABEL: Record<string, string> = {
  'file-pattern': '文件模式',
  'command-prefix': '命令前缀',
  mode: '模式',
  event: '事件',
  keyword: '关键词',
};

export const PERMISSION_MODE_LABEL: Record<string, string> = {
  readonly: 'readonly 只读',
  plan: 'plan 计划',
  default: 'default 默认',
  acceptEdits: 'acceptEdits 接受编辑',
  autonomous: 'autonomous 自治',
  yolo: 'yolo 全权',
};

export const MCP_STATE_THEME: Record<string, TagTheme> = {
  Configured: 'default',
  Starting: 'primary',
  Ready: 'success',
  Degraded: 'warning',
  Failed: 'danger',
  Stopped: 'default',
};

export const MCP_STATE_LABEL: Record<string, string> = {
  Configured: 'Configured 已配置',
  Starting: 'Starting 启动中',
  Ready: 'Ready 就绪',
  Degraded: 'Degraded 降级',
  Failed: 'Failed 失败',
  Stopped: 'Stopped 已停止',
};

export const TRANSPORT_LABEL: Record<string, string> = {
  stdio: 'stdio 本地进程',
  http: 'http 流式',
  sse: 'sse 兼容层',
  ws: 'ws 长连接',
};

export const AUTH_LABEL: Record<string, string> = {
  envKey: '环境变量密钥',
  oauthCode: 'OAuth 授权码 + PKCE',
  deviceCode: '设备码（无界面）',
  serviceCredential: '服务凭证（企业）',
};

export const HOOK_RESULT_THEME: Record<string, TagTheme> = {
  pass: 'success',
  block: 'danger',
  rewrite: 'warning',
  crash: 'danger',
};

export const HOOK_RESULT_LABEL: Record<string, string> = {
  pass: 'pass 通过',
  block: 'block 阻断',
  rewrite: 'rewrite 改写',
  crash: 'crash 崩溃',
};

export const HOOK_CAP_LABEL: Record<string, string> = {
  observe: 'observe 观察',
  block: 'block 阻断',
  rewrite: 'rewrite 改写',
};

export const HOOK_IMPL_LABEL: Record<string, string> = {
  rule: 'rule 声明式规则',
  script: 'script 沙箱脚本',
  plugin: 'plugin 插件回调',
  http: 'http 企业服务',
};

export const HOOK_DOMAIN_LABEL: Record<string, string> = {
  session: '会话',
  'turn-phase': '轮次与阶段',
  model: '模型',
  tool: '工具',
  permission: '权限与审批',
  context: '上下文',
  'workitem-git': '计划任务与提交',
  system: '系统与插件',
};

export const SCOPE_LABEL: Record<string, string> = {
  org: '组织（先求值）',
  project: '项目',
  user: '用户',
  session: '会话（后求值）',
};

export const PLUGIN_HEALTH_THEME: Record<string, TagTheme> = {
  初始化: 'primary',
  就绪: 'success',
  降级: 'warning',
  故障: 'danger',
};

export const PLUGIN_HOST_LABEL: Record<string, string> = {
  'in-process': '进程内（受信任，独立类加载器）',
  'out-of-process': '进程外（进程边界隔离）',
  remote: '远程服务（HTTP/gRPC）',
};

export const PLUGIN_SOURCE_LABEL: Record<string, string> = {
  local: '本地文件',
  'org-registry': '组织私仓',
  market: '公共市场',
};

export const PLUGIN_SURFACE_LABEL: Record<string, string> = {
  panel: '面板',
  command: '命令',
  settings_page: '设置页',
  status_bar_item: '状态栏项',
  inline_card: '内联卡片',
  notification_template: '通知模板',
};

export const STABILITY_THEME: Record<string, TagTheme> = {
  stable: 'success',
  evolving: 'primary',
  experimental: 'warning',
};

export const STABILITY_LABEL: Record<string, string> = {
  stable: 'stable 跨大版本兼容',
  evolving: 'evolving 小版本可增删',
  experimental: 'experimental 可破坏',
};

/* ---------------- 格式化 ---------------- */

export function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
}

export function fmtTime(at: string | null): string {
  return at ? new Date(at).toLocaleString('zh-CN', { hour12: false }) : '—';
}

/* ---------------- 列表状态 ---------------- */

export interface ExtListOptions<T> {
  /** 匹配函数：关键词（小写）+ 过滤值（'all' 表示不过滤） */
  match: (item: T, keyword: string, filter: string) => boolean;
  /** 过滤记忆键（页面内唯一，如 'skills'）；提供后关键词与过滤值写入 localStorage */
  persistKey?: string;
  pageSize?: number;
  loadMs?: number;
}

/**
 * 列表页统一状态机。
 * @param source 全量数据（确定性 mock，页面内计算得到）
 * @param opts 匹配函数、过滤记忆键、分页大小
 * @returns 过滤/分页结果与六态（LOADING/NORMAL/EMPTY/ERROR/EDGE_DATA）
 */
export function useExtList<T>(source: readonly T[], opts: ExtListOptions<T>) {
  const ui = useUiStore();
  const storageKey = opts.persistKey ? `oc.ext.list.${opts.persistKey}` : '';
  const keyword = ref('');
  const filter = ref('all');
  const limit = ref(opts.pageSize ?? 20);
  const phase = ref<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const errorTrace = ref('trace-init0000');

  // 过滤记忆：刷新/返回列表后保持上次的关键词与过滤条件
  if (storageKey) {
    try {
      keyword.value = localStorage.getItem(`${storageKey}.keyword`) ?? '';
      filter.value = localStorage.getItem(`${storageKey}.filter`) ?? 'all';
    } catch {
      /* 隐私模式下不可用，退化为会话内记忆 */
    }
  }
  watch([keyword, filter], () => {
    if (!storageKey) return;
    try {
      localStorage.setItem(`${storageKey}.keyword`, keyword.value);
      localStorage.setItem(`${storageKey}.filter`, filter.value);
    } catch {
      /* 忽略存储不可用 */
    }
  });

  const matched = computed(() => source.filter((it) => opts.match(it, keyword.value.trim().toLowerCase(), filter.value)));
  const visible = computed(() => matched.value.slice(0, limit.value));
  const state = computed<ExtListState>(() => {
    if (phase.value === 'LOADING') return 'LOADING';
    if (phase.value === 'ERROR') return 'ERROR';
    if (!matched.value.length) return 'EMPTY';
    return matched.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
  });
  const edgeSummary = computed(() => `匹配 ${matched.value.length} 条，超过单次渲染阈值（${opts.pageSize ?? 20} 条）已折叠。`);

  function reload() {
    phase.value = 'LOADING';
    window.setTimeout(() => {
      phase.value = 'READY';
      ui.setViewState({ state: state.value });
    }, opts.loadMs ?? 240);
  }

  function loadMore() {
    limit.value += opts.pageSize ?? 20;
  }

  /** 故障注入：用于演示 ERROR 态（三段式 + traceId） */
  function fail(traceId: string) {
    phase.value = 'ERROR';
    errorTrace.value = traceId;
    ui.setViewState({ state: 'ERROR', traceId });
  }

  onMounted(reload);

  return { keyword, filter, limit, matched, visible, state, edgeSummary, errorTrace, reload, loadMore, fail };
}

/**
 * 详情 / 配置 / 向导类页面的页面级状态（六态中的 LOADING / NORMAL / EMPTY / ERROR）。
 * 故障注入经 mock/runtime 的 runtime.faults（按路径前缀配置），错误态附可复制 traceId。
 *
 * @param faultPath 故障注入路径（与 runtime.faults 的 key 前缀一致，如 '/extension/skills/detail'）
 * @param valid 数据是否解析成功（false → EMPTY：标识未命中或对象已清理）
 */
export function usePageState(faultPath: string, valid: () => boolean) {
  const ui = useUiStore();
  const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
  const traceId = ref(`trace-${Math.abs(faultPath.length * 7919).toString(16)}`);

  function reload() {
    state.value = 'LOADING';
    window.setTimeout(() => {
      if (runtime.faults[faultPath]) {
        state.value = 'ERROR';
        traceId.value = `trace-${Math.abs((faultPath.length + 13) * 104729).toString(16)}`;
      } else {
        state.value = valid() ? 'NORMAL' : 'EMPTY';
      }
      ui.setViewState({ state: state.value, traceId: traceId.value });
    }, 220);
  }

  onMounted(reload);
  return { state, traceId, reload };
}
