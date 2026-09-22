<script setup lang="ts">
/**
 * 会话工作台（旗舰页）：
 * 左：会话列表（筛选/搜索/新建/归档）· 中：流式会话流（TDesign ChatList 承载）· 右：上下文栏（全局）
 * 交互：发送 / 插话 / 中断 / 审批 / fork / 恢复横幅 / 断线重连横幅
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Popup, Tag, Tooltip } from 'tdesign-vue-next';
import { ChatList } from '@tdesign-vue-next/chat';
import type { TdChatItemMeta } from '@tdesign-vue-next/chat';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { db } from '@/mock/db';
import type { SessionItem } from '@/mock/data/session';
import OcIcon from '@/components/common/OcIcon.vue';
import SessionItemView from '@/components/chat/SessionItemView.vue';
import Composer from '@/components/chat/Composer.vue';
import StateShell from '@/components/common/StateShell.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';

const store = useSessionStore();
const ui = useUiStore();
const router = useRouter();

const filter = ref('');
const view = ref<'active' | 'archived'>('active');
const stew = ref('');

/** 会话模板（对齐 D01「会话模板」；新会话自带模式、权限档、工具集与上下文预算） */
const TEMPLATES = [
  { title: '编码任务：功能实现', desc: '默认模式 · 写与执行按风险确认 · 核心工具集 18–24 个' },
  { title: '修复 Bug：定位并验证', desc: '调试模式 · 先复现再修复 · 强制补测试' },
  { title: '代码审查：变更巡检', desc: '审查模式 · 只读 + 建议编辑 · 输出 SARIF 与评论' },
  { title: '技术调研：方案比选', desc: '研究模式 · 只读 · 强制引用来源' },
  { title: '设计还原：设计稿→代码', desc: '设计模式 · 多模态输入 · 差异报告可复现' },
  { title: '长程任务：无人值守', desc: '自治档 · 预授权边界 + 审批升级 + 熔断' },
];

const list = computed(() =>
  store.sessions
    .filter((s) => (view.value === 'active' ? s.retention === 'SESSION' : s.retention !== 'SESSION'))
    .filter((s) => !filter.value || `${s.title}${s.repo}${s.tags.join('')}`.toLowerCase().includes(filter.value.toLowerCase())),
);

/** EDGE_DATA：会话数超阈值时折叠展示 + 加载更多 */
const listLimit = ref(20);
const shownList = computed(() => list.value.slice(0, listLimit.value));
const listOverflow = computed(() => list.value.length > listLimit.value);

/**
 * 映射到 TDesign ChatList 的数据形态。
 * content 必须为数组（契约：AIMessageContent[] | UserMessageContent[]），
 * 这里只投喂纯文本占位，真正的领域渲染由 #content 插槽交给 SessionItemView。
 * ChatList 会把 data 中的原始对象透传给插槽（不经拷贝），
 * 因此用 WeakMap 按对象标识回取领域条目，避免插槽拿到 content 数组而非 SessionItem。
 */
const metaToItem = new WeakMap<TdChatItemMeta, SessionItem>();

const chatData = computed<TdChatItemMeta[]>(() =>
  store.items.map((it) => {
    const meta = {
      avatar: '',
      name: it.actor === 'user' ? '沈亦舟' : it.actor === 'subagent' ? `子 Agent` : it.actor === 'system' ? '系统' : 'OpenCoding',
      role: (it.actor === 'user' ? 'user' : it.actor === 'system' ? 'system' : 'assistant') as TdChatItemMeta['role'],
      datetime: new Date(it.at).toLocaleTimeString('zh-CN'),
      content: [{ type: 'text', data: it.text ?? '' }],
    } as TdChatItemMeta;
    metaToItem.set(meta, it);
    return meta;
  }),
);

const pageState = computed(() => {
  if (store.loading) return 'LOADING';
  if (!store.items.length) return 'EMPTY';
  return 'NORMAL';
});

/** 空态主行动：新建会话并用示例任务起头 */
function startExample() {
  store.create();
  store.send('解释这个项目的架构：读取目录结构与入口文件，输出模块地图与依赖关系，结论附文件引用。');
}

/** 结论摘要：从助手消息中抽取要点（端上仅做展示，正式摘要由服务端投影生成） */
const conclusion = computed(() =>
  store.items
    .filter((i) => i.type === 'assistant_message' && i.text)
    .slice(-2)
    .flatMap((i) => (i.text ?? '').split('\n').filter((l) => l.trim().startsWith('|') || l.trim().startsWith('1.') || l.trim().startsWith('2.') || l.trim().startsWith('3.')).slice(0, 4)),
);

/** 生成摘要：把抽取到的要点落成会话条目（可继续编辑/分叉），而非仅弹提示 */
function generateSummary() {
  const lines = conclusion.value.length ? conclusion.value.map((l) => l.trim()) : ['（本轮暂无可抽取要点：先执行一轮再生成，或手工补充）'];
  const last = store.items[store.items.length - 1];
  const seq = (last?.seq ?? 0) + 1;
  store.items.push({
    itemId: `it_${seq.toString(36)}`,
    seq,
    turnNo: last?.turnNo ?? 1,
    type: 'assistant_message',
    actor: 'agent',
    at: new Date().toISOString(),
    text: ['## 结论摘要（自动抽取，可编辑）', ...lines].join('\n'),
  });
  MessagePlugin.success(`已生成结论摘要（${lines.length} 条要点）并写入会话，可直接编辑`);
}


function pick(it: TdChatItemMeta) {
  return metaToItem.get(it) ?? (it.content as unknown as SessionItem);
}

function onSteer() {
  if (!stew.value.trim()) return;
  store.send(`（插话）${stew.value}`);
  MessagePlugin.success('插话已提交，将在下一个安全点生效（不丢失已有进展）');
  stew.value = '';
}

onMounted(() => {
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-wb">
    <!-- 会话列表 -->
    <aside class="oc-wb__list">
      <div class="oc-wb__list-head">
        <Input v-model="filter" size="small" placeholder="搜索会话（全文 + 语义）" clearable>
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <div class="oc-flex" style="gap: 4px; margin-top: 6px">
          <Popup trigger="click" placement="bottom-left">
            <Button size="small" theme="primary"><OcIcon name="add" size="12px" /> 新建</Button>
            <template #content>
              <div class="oc-stack" style="min-width: 260px">
                <button v-for="t in TEMPLATES" :key="t.title" type="button" class="oc-slash" @click="store.create(t.title)">
                  <b>{{ t.title }}</b>
                  <span class="oc-muted" style="font-size: 11px">{{ t.desc }}</span>
                </button>
              </div>
            </template>
          </Popup>
          <Button size="small" variant="outline" @click="view = view === 'active' ? 'archived' : 'active'">
            {{ view === 'active' ? '归档' : '返回' }}
          </Button>
          <Button size="small" variant="text" @click="router.push('/session/archive')">回收站</Button>
        </div>
      </div>

      <div class="oc-wb__list-body">
        <button
          v-for="s in shownList"
          :key="s.id"
          type="button"
          class="oc-sess"
          :class="{ 'oc-sess--active': s.id === store.activeId }"
          @click="store.select(s.id)"
        >
          <div class="oc-flex--between">
            <span class="oc-flex" style="gap: 5px; min-width: 0">
              <OcIcon
                :name="s.state === 'RUNNING' ? 'loading' : s.state === 'WAITING_APPROVAL' ? 'secured' : s.state === 'FAILED' ? 'error' : s.state === 'PAUSED' ? 'time' : 'task-checked'"
                size="13px"
                :color="s.state === 'RUNNING' ? 'var(--td-brand-color)' : s.state === 'WAITING_APPROVAL' ? 'var(--oc-sev-warn)' : s.state === 'FAILED' ? 'var(--oc-sev-error)' : 'var(--oc-sev-ok)'"
              />
              <b class="oc-truncate" style="font-size: 12px">{{ s.title }}</b>
            </span>
            <Tag v-if="s.pendingApprovals" size="small" theme="warning" variant="light-outline">{{ s.pendingApprovals }}</Tag>
            <span v-if="s.unread" class="oc-sess__dot" />
          </div>
          <div class="oc-flex oc-muted" style="gap: 6px; margin-top: 3px; font-size: 11px">
            <span class="oc-mono">{{ s.shortId }}</span>
            <span>{{ s.repo }}</span>
            <span>{{ s.messages }} 条</span>
            <span>${{ s.cost.toFixed(3) }}</span>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 4px; margin-top: 4px">
            <Tag v-for="t in s.tags" :key="t" size="small" variant="outline">{{ t }}</Tag>
            <Tag v-if="s.forkedFrom" size="small" theme="primary" variant="light-outline">fork 自 {{ s.forkedFrom }}</Tag>
            <Tag v-if="s.hasMedia" size="small" variant="outline">含媒体</Tag>
          </div>
        </button>
        <div v-if="!list.length" class="oc-muted" style="padding: 16px; font-size: 12px; text-align: center">
          没有匹配的会话。试试更短的关键词，或新建一个会话。
        </div>
        <Button v-else-if="listOverflow" size="small" variant="text" block @click="listLimit += 20">
          加载更多（已展示 {{ shownList.length }} / {{ list.length }} 条）
        </Button>
      </div>
    </aside>

    <!-- 会话流 -->
    <section class="oc-wb__main">
      <header class="oc-wb__head">
        <div class="oc-flex" style="gap: 8px; min-width: 0">
          <b class="oc-truncate">{{ store.active?.title }}</b>
          <Tag size="small" variant="outline" class="oc-mono">{{ store.active?.shortId }}</Tag>
          <Tag size="small" theme="primary" variant="light-outline">{{ store.active?.repo }} · {{ store.active?.branch }}</Tag>
          <Tooltip content="工作区与分支一对一绑定；并行任务使用 worktree 隔离">
            <Tag v-if="store.active?.worktree" size="small" variant="outline">worktree 隔离</Tag>
          </Tooltip>
          <Tag size="small" variant="outline" style="color: var(--td-text-color-placeholder)">卷 22 · S-01…S-10</Tag>
          <CliHint command="oc session attach --id S-4001" />
        </div>
        <div class="oc-flex" style="gap: 4px">
          <Tooltip content="中断（Esc）：在安全点停止并给出可回滚点">
            <Button size="small" variant="text" @click="store.interrupt()"><OcIcon name="close" size="13px" /> 中断</Button>
          </Tooltip>
          <Popup trigger="click" placement="bottom-right">
            <Button size="small" variant="text"><OcIcon name="bookmark" size="13px" /> 书签/摘要 ({{ store.bookmarks.length }})</Button>
            <template #content>
              <div class="oc-stack" style="min-width: 340px; max-width: 460px">
                <b style="font-size: 12px">书签与注解</b>
                <div v-if="!store.bookmarks.length" class="oc-muted" style="font-size: 12px">
                  暂无书签。可在任意消息上点击「书签」标记关键结论。
                </div>
                <div v-for="b in store.bookmarks" :key="b.id" class="oc-flex" style="gap: 6px; font-size: 12px">
                  <OcIcon name="bookmark" size="12px" />
                  <span class="oc-grow oc-truncate">{{ b.note }}</span>
                  <span class="oc-muted">{{ new Date(b.at).toLocaleTimeString('zh-CN') }}</span>
                </div>
                <div class="oc-divider" />
                <b style="font-size: 12px">结论摘要（自动抽取，可编辑）</b>
                <div v-for="(c, i) in conclusion" :key="i" class="oc-secondary" style="font-size: 12px">
                  · {{ c }}
                </div>
                <Button size="small" variant="outline" :disabled="store.streaming" @click="generateSummary()">
                  {{ store.streaming ? '执行中，暂不可生成' : '生成摘要' }}
                </Button>
              </div>
            </template>
          </Popup>
          <Button size="small" variant="text" @click="router.push('/session/turns')">Turn 检查器</Button>
          <Button size="small" variant="text" @click="router.push('/session/export')">导出</Button>
          <Button size="small" variant="text" @click="router.push('/session/replay')">重放</Button>
        </div>
      </header>

      <!-- 恢复 / 降级 / 断线 横幅 -->
      <div v-if="store.lastInterrupt" class="oc-banner oc-banner--info">
        <OcIcon name="history" size="13px" />
        <span class="oc-grow">{{ store.lastInterrupt.note }}</span>
        <Button size="small" variant="text" @click="router.push('/session/guard')">查看可回滚点</Button>
        <Button size="small" variant="text" @click="store.lastInterrupt = null">继续执行</Button>
      </div>
      <div v-if="ui.connection !== 'CONNECTED'" class="oc-banner oc-banner--warn">
        <OcIcon name="cloud" size="13px" />
        <span class="oc-grow">
          与内核连接{{ ui.connection === 'OFFLINE' ? '已断开（只读）' : '正在重连' }}；恢复后自动从 seq {{ ui.lastEventSeq }} 续传，不重放逐字动画。
        </span>
        <Button size="small" variant="text" @click="ui.simulateReconnect()">立即重连</Button>
      </div>

      <div class="oc-wb__stream">
        <StateShell
          :state="pageState"
          :skeleton-rows="4"
          empty-title="开始第一次会话"
          empty-desc="我会先读代码，再提方案，改动前会请你确认。所有写与执行动作都按风险等级请求审批。"
          empty-action="用示例任务开始"
          example-task="解释这个项目的架构"
          @empty-action="startExample"
        >
          <ChatList
            :data="chatData"
            :clear-history="false"
            :auto-scroll="true"
            animation="gradient"
            style="height: 100%"
          >
            <template #content="{ item }">
              <SessionItemView :item="pick(item)" :index="chatData.indexOf(item)" />
            </template>
            <template #actionbar="{ item }">
              <div v-if="pick(item).type === 'assistant_message'" class="oc-flex oc-muted" style="gap: 4px; font-size: 11px">
                <span>seq {{ pick(item).seq }}</span>
                <span>· 模型 claude-sonnet-4.5</span>
                <span>· 缓存命中 42%</span>
                <span>· 成本 $0.0132</span>
              </div>
            </template>
          </ChatList>
        </StateShell>
      </div>

      <!-- 插话条 -->
      <div class="oc-wb__steer">
        <Input v-model="stew" size="small" placeholder="插话（steer）：在下一个安全点注入新指令，不丢失已有进展" @enter="onSteer">
          <template #suffix><Button size="small" variant="text" @click="onSteer">发送</Button></template>
        </Input>
      </div>

      <Composer />
    </section>
  </div>
</template>

<style scoped>
.oc-wb {
  display: flex;
  height: 100%;
  margin: -14px -16px;
  min-height: 0;
}

.oc-wb__list {
  width: 268px;
  flex: none;
  border-right: 1px solid var(--oc-border);
  background: var(--oc-bg-container);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.oc-wb__list-head {
  padding: 10px;
  border-bottom: 1px solid var(--oc-border);
}

.oc-wb__list-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.oc-sess {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  padding: 8px 9px;
  cursor: pointer;
  margin-bottom: 4px;
  color: var(--td-text-color-primary);
}

.oc-sess:hover {
  background: var(--td-bg-color-container-hover, #f6f6f6);
}

.oc-sess--active {
  background: var(--td-brand-color-light, #eaf1ff);
  border-color: var(--td-brand-color-2, #cce0ff);
}

.oc-sess__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--td-brand-color);
  flex: none;
}

.oc-wb__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.oc-wb__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--oc-border);
  background: var(--oc-bg-container);
}

.oc-wb__stream {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  min-height: 0;
}

.oc-wb__steer {
  padding: 6px 12px;
  border-top: 1px dashed var(--oc-border);
}

.oc-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
}

.oc-banner--info {
  background: var(--td-brand-color-light, #eaf1ff);
  color: var(--td-brand-color-8, #0b3f9e);
}

.oc-banner--warn {
  background: var(--td-warning-color-1, #fff1e9);
  color: var(--td-warning-color-7, #8c4a00);
}
</style>
