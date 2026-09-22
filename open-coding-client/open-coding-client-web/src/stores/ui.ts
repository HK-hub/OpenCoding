import { defineStore } from 'pinia';
import { bus } from '@/mock/bus';
import { runtime } from '@/mock/runtime';

/** 六态（impl/30 §7.1 判别联合） */
export type UiStateKind = 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE' | 'PERMISSION_DENIED' | 'EDGE_DATA' | 'NORMAL';

export interface UiViewState {
  state: UiStateKind;
  /** ERROR 三段式 */
  what?: string;
  why?: string;
  how?: string;
  traceId?: string;
  retryable?: boolean;
  /** OFFLINE 倒计时与受影响能力 */
  reconnectInMs?: number;
  disabledCapabilities?: string[];
  /** PERMISSION_DENIED */
  missingPermission?: string;
  riskLevel?: string;
  applyPath?: string;
  /** EDGE_DATA */
  collapsedSummary?: string;
  /** LOADING 阶段文案 */
  stage?: string;
  cancellable?: boolean;
}

export interface OcNotification {
  id: string;
  /** 六类模板 */
  kind: 'need_input' | 'task_done' | 'task_failed' | 'goal_progress' | 'cost_warning' | 'security';
  level: 'P0' | 'P1' | 'P2';
  title: string;
  body: string;
  actions: { label: string; path?: string; command?: string }[];
  aggregateKey: string;
  count: number;
  createdAt: string;
  read: boolean;
  /** P0 可穿透静默时段 */
  penetrateQuiet: boolean;
  channel: 'desktop' | 'inapp' | 'im' | 'webhook' | 'email';
}

export interface OpenedView {
  path: string;
  title: string;
  icon: string;
  closable: boolean;
}

export interface UiPreferences {
  theme: 'light' | 'dark';
  motion: 'normal' | 'reduced';
  fontScale: number;
  density: 'loose' | 'normal' | 'compact';
  /** 降级档位（自动降档 + 可见可锁） */
  degradeTier: 'normal' | 'compact' | 'minimal';
  degradeLocked: boolean;
  /** 撤销窗口（5–30s） */
  undoWindowSeconds: number;
  /** 每次引导提示最多并存 3 个 */
  maxOpenTips: number;
  /** 通知静默时段 */
  quietHours: [string, string];
  locale: 'zh-CN' | 'en-US';
  /** 无障碍：读屏专用布局 */
  screenReaderLayout: boolean;
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: false,
    railVisible: true,
    commandPaletteOpen: false,
    shortcutHelpOpen: false,
    preferencesOpen: false,
    notificationOpen: false,
    /** 连接状态（唯一可写连接态） */
    connection: 'CONNECTED' as 'CONNECTED' | 'RECONNECTING' | 'OFFLINE',
    lastEventSeq: 128_432,
    degradeReason: '' as string,
    /** 待审批计数（状态栏常驻） */
    pendingApprovals: 3,
    /** 后台任务进度 */
    backgroundTasks: 1,
    /** 当前模型与模式 */
    currentModel: 'claude-sonnet-4.5',
    currentMode: 'default' as 'readonly' | 'plan' | 'default' | 'acceptEdits' | 'autonomous' | 'yolo',
    autonomy: 'collaborate' as 'propose' | 'collaborate' | 'autonomous',
    /** 标签页 */
    tabs: [
      { path: '/session', title: '会话工作台', icon: 'chat', closable: false },
    ] as OpenedView[],
    activeTab: '/session',
    notifications: [] as OcNotification[],
    tipsDismissed: {} as Record<string, string>,
    /** 首次运行状态 */
    onboarded: false,
    /** 全局搜索面板 */
    globalSearchOpen: false,
    /** 当前页面六态（由页面自行上报，供自审与埋点） */
    viewState: { state: 'NORMAL' } as UiViewState,
    /** 渲染降级档位（normal/compact/minimal，自动降档 + 可见可锁） */
    degradeTier: 'normal' as 'normal' | 'compact' | 'minimal',
    degradeLocked: false,
    /** 撤销窗口秒数（可配 5–30） */
    undoWindowSeconds: 10,
    /** 引导提示最多并存数（impl/30 §9.4 默认 3） */
    maxOpenTips: 3,
    /** 通知静默时段（22:00–08:00，P0 可穿透） */
    quietHours: ['22:00', '08:00'] as [string, string],
    /** 撤销窗口（低风险危险操作：默认 10s，可配 5–30s；过期后不可撤销需说明原因） */
    undo: null as { id: string; text: string; consequence: string; at: string } | null,
    /** 埋点（白名单字段） */
    telemetry: [] as { event: string; at: string; fields: Record<string, unknown> }[],
    /** 演示控制台：强制全局六态（null=按页面自身状态渲染） */
    demoState: null as UiStateKind | null,
    /** 演示控制台：慢响应/断连/故障注入开关（作用于 mock runtime） */
    demoSlow: false,
    demoOffline: false,
    demoFault: false,
    demoConsoleOpen: false,
  }),

  getters: {
    preferences(state): UiPreferences {
      return {
        theme: (localStorage.getItem('oc.theme') as 'light' | 'dark') ?? 'light',
        motion: (localStorage.getItem('oc.motion') as 'normal' | 'reduced') ?? 'normal',
        fontScale: Number(localStorage.getItem('oc.fontScale') ?? 1),
        density: 'normal',
        degradeTier: state.degradeTier,
        degradeLocked: state.degradeLocked,
        undoWindowSeconds: state.undoWindowSeconds,
        maxOpenTips: state.maxOpenTips,
        quietHours: state.quietHours,
        locale: 'zh-CN',
        screenReaderLayout: false,
      };
    },
    unreadCount: (state) => state.notifications.filter((n) => !n.read).length,
    navBadges(): Record<string, number> {
      return {
        approval: this.pendingApprovals,
        notification: this.unreadCount,
      };
    },
  },

  actions: {
    track(event: string, fields: Record<string, unknown> = {}) {
      this.telemetry.push({ event, at: new Date().toISOString(), fields });
      if (this.telemetry.length > 400) this.telemetry.shift();
    },

    /** 读屏公告（aria-live 节流在 LiveRegion 中合并，不逐 token 播报） */
    announce(text: string) {
      bus.emit('a11y', 'announce', { text }, 'live');
    },

    /** 低风险危险操作：进入撤销窗口（默认 10s） */
    requestUndo(id: string, text: string, consequence: string) {
      this.undo = { id, text, consequence, at: new Date().toISOString() };
      this.announce(`已执行：${text}。可在 ${this.undoWindowSeconds} 秒内撤销。`);
    },

    confirmUndo() {
      const snapshot = this.undo;
      this.undo = null;
      if (snapshot) this.announce(`已撤销：${snapshot.text}`);
      return snapshot;
    },

    expireUndo() {
      this.undo = null;
    },

    setViewState(v: UiViewState) {
      this.viewState = v;
      this.track('ui.state.changed', { state: v.state });
    },

    openView(view: OpenedView) {
      const exist = this.tabs.find((t) => t.path === view.path);
      if (!exist) {
        if (this.tabs.length >= 12) this.tabs.splice(1, 1);
        this.tabs.push(view);
      }
      this.activeTab = view.path;
      this.track('ui.view.opened', { path: view.path });
    },

    closeView(path: string) {
      const idx = this.tabs.findIndex((t) => t.path === path);
      if (idx <= 0) return;
      this.tabs.splice(idx, 1);
      if (this.activeTab === path) this.activeTab = this.tabs[Math.max(0, idx - 1)].path;
    },

    closeAllViews() {
      this.tabs = [this.tabs[0]];
      this.activeTab = this.tabs[0].path;
    },

    cycleTab(dir: 1 | -1) {
      const idx = this.tabs.findIndex((t) => t.path === this.activeTab);
      const next = (idx + dir + this.tabs.length) % this.tabs.length;
      this.activeTab = this.tabs[next].path;
    },

    /** 通知聚合投递：同 aggregateKey 在窗口内合并，计数 +1 */
    pushNotification(n: Omit<OcNotification, 'id' | 'createdAt' | 'read' | 'count'> & { id?: string }) {
      const existing = this.notifications.find((x) => x.aggregateKey === n.aggregateKey && !x.read);
      if (existing) {
        existing.count += 1;
        existing.createdAt = new Date().toISOString();
        this.track('notification.aggregated', { key: n.aggregateKey });
        return existing;
      }
      const item: OcNotification = {
        ...n,
        id: n.id ?? `ntf-${Math.random().toString(36).slice(2, 8)}`,
        count: 1,
        createdAt: new Date().toISOString(),
        read: false,
      };
      // 静默时段：非 P0 折叠为一条摘要
      const hour = new Date().getHours();
      const quiet = this.quietHours[0] > this.quietHours[1]
        ? hour >= Number(this.quietHours[0].slice(0, 2)) || hour < Number(this.quietHours[1].slice(0, 2))
        : hour >= Number(this.quietHours[0].slice(0, 2)) && hour < Number(this.quietHours[1].slice(0, 2));
      if (quiet && !item.penetrateQuiet) {
        item.level = item.level === 'P0' ? 'P0' : 'P2';
      }
      this.notifications.unshift(item);
      if (this.notifications.length > 60) this.notifications.pop();
      return item;
    },

    markAllRead() {
      this.notifications.forEach((n) => {
        n.read = true;
      });
    },

    dismissTip(featureKey: string) {
      this.tipsDismissed[featureKey] = new Date().toISOString();
      this.track('ui.tip.dismissed', { featureKey });
    },

    shouldShowTip(featureKey: string) {
      if (this.tipsDismissed[featureKey]) return false;
      const open = Object.keys(this.tipsDismissed).length;
      return open < this.maxOpenTips;
    },

    /** 降级：自动降档（不丢内容，只降表现） */
    applyDegrade(tier: 'normal' | 'compact' | 'minimal', reason: string) {
      if (this.degradeLocked) return;
      if (this.degradeTier === tier) return;
      this.degradeTier = tier;
      this.degradeReason = reason;
      this.track('ui.degrade.activated', { tier, reason });
    },

    setConnection(state: 'CONNECTED' | 'RECONNECTING' | 'OFFLINE') {
      this.connection = state;
      if (state === 'OFFLINE') {
        runtime.offline = true;
      } else if (state === 'CONNECTED') {
        runtime.offline = false;
      }
      this.track('connection.changed', { state });
    },

    /** 演示控制台：切换全局强制态（影响所有使用 StateShell 的页面） */
    setDemoState(state: UiStateKind | null) {
      this.demoState = state;
      if (state === 'OFFLINE') this.setConnection('OFFLINE');
      else if (this.demoOffline === false && this.connection === 'OFFLINE') this.setConnection('CONNECTED');
      this.track('demo.state.changed', { state: state ?? 'NORMAL' });
    },

    /** 演示控制台：慢响应（延迟注入：所有请求追加附加延迟，含显式 delay 者） */
    setDemoSlow(slow: boolean) {
      this.demoSlow = slow;
      runtime.slow = slow;
      this.track('demo.slow.changed', { slow });
    },

    /** 演示控制台：断连（离线只读） */
    setDemoOffline(offline: boolean) {
      this.demoOffline = offline;
      this.setConnection(offline ? 'OFFLINE' : 'CONNECTED');
    },

    /** 演示控制台：故障注入（所有写路径统一失败，优先于前缀匹配） */
    setDemoFault(fault: boolean) {
      this.demoFault = fault;
      runtime.writeFault = fault ? 'INTERNAL_ERROR' : null;
      this.track('demo.fault.changed', { fault });
    },

    /** 演示控制台：重置演示数据（保留主题/引导偏好以外的业务态） */
    resetDemo() {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('oc.') && k !== 'oc.theme' && k !== 'oc.motion' && k !== 'oc.fontScale')
        .forEach((k) => localStorage.removeItem(k));
      runtime.offline = false;
      runtime.latency = [90, 280];
      runtime.faults = {};
      runtime.slow = false;
      runtime.writeFault = null;
      this.demoState = null;
      this.demoSlow = false;
      this.demoOffline = false;
      this.demoFault = false;
      this.connection = 'CONNECTED';
      this.tabs = [{ path: '/session', title: '会话工作台', icon: 'chat', closable: false }];
      this.activeTab = '/session';
      this.notifications = [];
      this.telemetry = [];
      this.pendingApprovals = 3;
      this.track('demo.reset', {});
      window.location.reload();
    },

    simulateReconnect() {
      this.setConnection('RECONNECTING');
      window.setTimeout(() => this.setConnection('CONNECTED'), 1600);
    },

    openCommandPalette() {
      this.commandPaletteOpen = true;
    },

    completeOnboarding() {
      this.onboarded = true;
      localStorage.setItem('oc.onboarded', '1');
    },
  },
});
