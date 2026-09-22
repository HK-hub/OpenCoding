import { defineStore } from 'pinia';
import { bus } from '@/mock/bus';
import { db } from '@/mock/db';
import type { Session, SessionItem } from '@/mock/data/session';
import { useUiStore } from './ui';

/** 会话面：服务端真源 + 端上仅保留草稿/滚动/焦点三类本地状态 */
export const useSessionStore = defineStore('session', {
  state: () => ({
    sessions: db.sessions as Session[],
    activeId: db.sessions[0].id,
    items: db.items as SessionItem[],
    /** 流式进行中 */
    streaming: false,
    /** 当前回答的增量缓冲 */
    streamBuffer: '',
    streamThinking: '',
    streamToolStatus: '' as string,
    /** 草稿（与会话绑定，离线也可保留） */
    drafts: {} as Record<string, string>,
    /** 队列策略：queue / interrupt / reject / coalesce */
    queuePolicy: 'queue' as 'queue' | 'interrupt' | 'reject' | 'coalesce',
    queued: 0,
    /** 从某条消息 fork 的标记 */
    forkedFromItem: null as string | null,
    /** 已中断的可回滚安全点 */
    lastInterrupt: null as { stepId: string; note: string } | null,
    /** 待编辑重发的条目（编辑 → 重发会产生双分支 diff） */
    editTarget: null as { itemId: string; text: string } | null,
    /** 书签 / 注解（结论摘要用） */
    bookmarks: [] as { id: string; itemId: string; note: string; at: string }[],
    /** 自动度/模式（会话级） */
    independence: 'collaborate' as 'propose' | 'collaborate' | 'autonomous',
    loading: false,
  }),

  getters: {
    active(state): Session | undefined {
      return state.sessions.find((s) => s.id === state.activeId);
    },
    runningCount: (state) => state.sessions.filter((s) => s.state === 'RUNNING' || s.state === 'WAITING_APPROVAL').length,
    archived: (state) => state.sessions.filter((s) => s.retention !== 'SESSION'),
    pendingApprovalItems(state): SessionItem[] {
      return state.items.filter((i) => i.type === 'approval' && i.approval && !i.approval.decision);
    },
  },

  actions: {
    select(id: string) {
      this.activeId = id;
      // 会话隔离：切换会话时整体替换条目流（同会话再次进入沿用已追加的条目）
      this.items = db.itemsBySession[id] ?? (db.itemsBySession[id] = []);
      const s = this.sessions.find((x) => x.id === id);
      if (s) s.unread = false;
      bus.emit('session', 'session.attach', { sessionId: id, lastEventSeq: s?.lastEventSeq ?? 0 });
      const ui = useUiStore();
      ui.lastEventSeq = s?.lastEventSeq ?? ui.lastEventSeq;
    },

    setDraft(id: string, text: string) {
      this.drafts[id] = text;
    },

    /** 编辑重发：把历史消息载入输入区；重发后原分支保留（双分支可 diff） */
    beginEdit(itemId: string, text: string) {
      this.editTarget = { itemId, text };
      const ui = useUiStore();
      ui.announce('已载入该条消息，可直接修改后重发；原分支会保留以便对比。');
    },

    cancelEdit() {
      this.editTarget = null;
    },

    /** 书签/注解：写入会话流作为 notice 条目，并进入结论摘要 */
    bookmark(itemId: string, note: string) {
      this.bookmarks.push({ id: `bm-${Math.random().toString(36).slice(2, 7)}`, itemId, note, at: new Date().toISOString() });
      const ui = useUiStore();
      ui.announce(`已添加书签：${note}`);
    },

    /** 发送消息：本地乐观占位 → 流式增量 → 落定为 durable 条目 */
    async send(text: string, attachments: string[] = []) {
      if (!text.trim()) return;
      const ui = useUiStore();
      const sessionId = this.activeId;
      const baseSeq = (this.sessions.find((s) => s.id === sessionId)?.lastEventSeq ?? 0) + 1;

      if (this.streaming && this.queuePolicy !== 'interrupt') {
        this.queued += 1;
        ui.pushNotification({
          kind: 'task_done', level: 'P2', title: '已入队', body: `当前轮次执行中，按「${this.queuePolicy}」策略排队（队列深度 ${this.queued}）`,
          actions: [], aggregateKey: 'queue', penetrateQuiet: false, channel: 'inapp',
        });
        return;
      }

      // 用户消息（durable）
      this.items.push({
        itemId: `it_${baseSeq.toString(36)}`, seq: baseSeq, turnNo: 2, type: 'user_message', actor: 'user',
        at: new Date().toISOString(), text: attachments.length ? `${text}\n\n（附件 ${attachments.length} 个）` : text,
      });
      this.drafts[sessionId] = '';

      // 助手占位 → 流式（16ms 批帧归并；不逐 token 入库）
      const nextSeq = baseSeq + 1;
      const placeholder: SessionItem = {
        itemId: `it_${nextSeq.toString(36)}`, seq: nextSeq, turnNo: 2, type: 'assistant_message', actor: 'agent',
        at: new Date().toISOString(), text: '', thinking: '', 
      };
      this.items.push(placeholder);
      // 取回响应式代理：直接改原始对象不会触发渲染，流式将无法增量上屏
      const live = this.items[this.items.length - 1];
      this.streaming = true;
      this.streamBuffer = '';
      this.streamThinking = '';
      this.streamToolStatus = '正在规划…';
      ui.setViewState({ state: 'NORMAL' });

      const answer = [
        '收到。我按「先取证、再改动、后验证」的顺序处理：\n\n',
        '1. **取证**：读取目标文件与最近的提交记录，确认当前行为与约束；\n',
        '2. **改动**：仅修改必要范围，写前生成 diff 供你预览；\n',
        '3. **验证**：运行相关单测与构建，附上证据（L1 静态 / L2 可执行）；\n',
        '4. **交付**：输出变更摘要 + 未验证项 + 等价 CLI 命令。\n\n',
        '风险提示：涉及 `run_command`（R2 执行）与 `edit_file`（R1 受控写），将在执行前请求审批，',
        '你可以选择「仅本次」或授予「本会话 / 本项目 / 按模式」范围。\n',
      ].join('');

      const chunks = answer.match(/[\s\S]{1,8}/g) ?? [];
      for (const c of chunks) {
        await new Promise<void>((res) => setTimeout(res, 18));
        this.streamBuffer += c;
        live.text = this.streamBuffer;
        live.thinking = '用户请求涉及代码改动；需先确认约束「不改公开签名」；执行类动作需审批。';
        ui.lastEventSeq += 1;
      }

      this.streamToolStatus = '';
      this.streaming = false;
      const s = this.sessions.find((x) => x.id === sessionId);
      if (s) {
        s.lastEventSeq = nextSeq;
        s.updatedAt = new Date().toISOString();
        s.messages += 2;
        s.tokens += 900;
        s.cost += 0.0132;
      }
      bus.emit('session', 'session.turn.completed', { sessionId, seq: nextSeq });
      ui.track('ui.action.rejected', { action: 'send', sessionId });
    },

    interrupt(reason = 'USER_INTERRUPT') {
      this.streaming = false;
      this.streamToolStatus = '';
      this.lastInterrupt = { stepId: 'step-4', note: '已在当前步骤结束后停止；已完成工具结果保留。' };
      const ui = useUiStore();
      ui.setViewState({ state: 'NORMAL' });
      ui.pushNotification({
        kind: 'task_done', level: 'P1', title: '已中断（安全点）', body: '将在最近安全检查点停止；可查看可回滚点或继续。',
        actions: [{ label: '查看可回滚点', path: '/session/guard' }], aggregateKey: 'interrupt', penetrateQuiet: false, channel: 'inapp',
      });
    },

    pause() {
      const s = this.active;
      if (s) s.state = 'PAUSED';
      this.streaming = false;
    },

    resume() {
      const s = this.active;
      if (s) s.state = 'RUNNING';
    },

    /** 审批决策：乐观置 pending，服务端确认为准 */
    respond(item: SessionItem, decision: 'ALLOW' | 'ALLOW_ONCE' | 'DENY', scope?: string, reason?: string) {
      if (!item.approval) return;
      item.approval.decision = decision;
      item.approval.reason = reason;
      item.approval.scopeOptions = scope ? [scope] : item.approval.scopeOptions;
      const ui = useUiStore();
      ui.pendingApprovals = Math.max(0, ui.pendingApprovals - 1);
      bus.emit('approval', 'approval.resolved', { approvalId: item.approval.approvalId, decision, scope });
      ui.pushNotification({
        kind: 'task_done',
        level: 'P2',
        title: decision === 'DENY' ? '审批已拒绝' : '审批已批准',
        body: `${item.approval.actionSummary}（范围：${scope ?? 'once'}）`,
        actions: [],
        aggregateKey: `approval-${item.approval.approvalId}`,
        penetrateQuiet: false,
        channel: 'inapp',
      });
    },

    /** 从任一消息点 fork */
    fork(itemId: string) {
      const src = this.active;
      if (!src) return '';
      const id = `S-${Math.random().toString(36).slice(2, 6)}`;
      this.sessions.unshift({
        ...src,
        id,
        shortId: `S-${Math.random().toString(36).slice(2, 6)}`,
        title: `${src.title}（分支）`,
        state: 'IDLE',
        forkedFrom: src.shortId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pendingApprovals: 0,
        unread: false,
      });
      this.forkedFromItem = itemId;
      // 分叉即切到新分支：activeId 与条目流同时切换，避免标题与内容不一致
      db.itemsBySession[id] = [];
      this.activeId = id;
      this.items = db.itemsBySession[id];
      return id;
    },

    archive(id: string) {
      const s = this.sessions.find((x) => x.id === id);
      if (s) s.retention = 'ARCHIVED';
    },

    restore(id: string) {
      const s = this.sessions.find((x) => x.id === id);
      if (s) s.retention = 'SESSION';
    },

    remove(id: string) {
      const s = this.sessions.find((x) => x.id === id);
      if (s) s.retention = 'TRASH';
    },

    purge(id: string) {
      this.sessions = this.sessions.filter((x) => x.id !== id);
    },

    create(title = '新建会话'): string {
      const id = `S-${Math.random().toString(36).slice(2, 6)}`;
      this.sessions.unshift({
        id,
        shortId: `S-${Math.random().toString(36).slice(2, 6)}`,
        title,
        state: 'IDLE',
        phase: 'PARSE',
        mode: 'coding',
        autonomy: 'collaborate',
        permissionMode: 'default',
        workspace: 'WS-2000',
        repo: 'payment-core',
        branch: 'oc/7f3a-new',
        model: 'claude-sonnet-4.5',
        lastEventSeq: 1,
        lastEventType: 'session.created',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retention: 'SESSION',
        tokens: 0,
        cost: 0,
        messages: 0,
        pendingApprovals: 0,
        owner: '沈亦舟',
        tags: [],
        hasMedia: false,
      });
      this.activeId = id;
      // 新会话从空条目流开始
      db.itemsBySession[id] = [];
      this.items = db.itemsBySession[id];
      return id;
    },
  },
});
