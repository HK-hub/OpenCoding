<script setup lang="ts">
/**
 * 会话重放与分叉（S-16 / 卷 16 §6.3 V-08）：
 * 四类回放（投影重建 / 会话重放 / 环境重放 / 审计重放）只读属性不同，页面显式标注；
 * 事件重建按 durable 事件渲染历史帧，不重建逐字动画；支持 0.5x/1x/2x/4x 变速与跳转；可从任一消息点 fork。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, RadioGroup, RadioButton, Slider, Tag, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { db } from '@/mock/db';
import { approvalData, STATE_META } from '@/mock/data/approval';
import type { ApprovalState } from '@/mock/data/approval';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { makeError, type MockError } from '@/mock/runtime';

const store = useSessionStore();
const ui = useUiStore();

type Kind = 'projection' | 'session' | 'env' | 'audit';
const kind = ref<Kind>('session');
const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);
const speed = ref<'0.5' | '1' | '2' | '4'>('1');
const cursor = ref(0);
const playing = ref(false);
const replaying = ref(false);
const forkedId = ref('');

/** 四类回放的只读属性差异（唯一权威口径，端上不自行扩写） */
const KINDS: { key: Kind; label: string; writes: string; note: string }[] = [
  { key: 'projection', label: '投影重建', writes: '只写投影表（按 eventId 幂等 upsert）', note: '可重跑：中断后重新发起会从断点继续，不产生重复数据。' },
  { key: 'session', label: '会话重放', writes: '不写任何状态', note: '渲染历史帧，不触发执行、不产生副作用；不重建逐字动画。' },
  { key: 'env', label: '环境重放', writes: '只写沙箱与副作用账本的模拟结果', note: '未结算或不可判定的条目标记 SIMULATED 并给 UNKNOWN_ABANDONED 告警，不真实执行。' },
  { key: 'audit', label: '审计重放', writes: '不写任何状态（只读审计）', note: '重放决策链并比对一致性，分歧时报 REPLAY_DIVERGED（含首个分歧字段）。' },
];

const trajectory = db.trajectory;
const messagePoints = computed(() => store.items.filter((i) => i.type === 'user_message' || i.type === 'assistant_message'));
const writeCalls = computed(() => store.items.filter((i) => i.type === 'tool_call' && ['edit_file', 'write_file', 'run_command'].includes(i.tool?.name ?? '')));
const auditEvents = approvalData.approvalEvents.slice(0, 14);
/** EDGE_DATA：审计重放事件超过渲染阈值时先折叠，避免一次性铺满（阈值来自配置口径） */
const listCap = ref(8);
const visibleAudit = computed(() => auditEvents.slice(0, listCap.value));
const edge = computed(() => kind.value === 'audit' && auditEvents.length > listCap.value);

const speedFactor = computed(() => Number(speed.value));
const positionPct = computed(() => Math.round((cursor.value / Math.max(1, trajectory.length - 1)) * 100));

const shellState = computed(() => {
  if (ui.connection !== 'CONNECTED') return 'OFFLINE' as const;
  if (failure.value) return 'ERROR' as const;
  if (phase.value === 'LOADING') return 'LOADING' as const;
  if (!trajectory.length) return 'EMPTY' as const;
  return edge.value ? ('EDGE_DATA' as const) : ('NORMAL' as const);
});

function togglePlay() {
  playing.value = !playing.value;
  if (!playing.value) return;
  const timer = window.setInterval(() => {
    if (!playing.value) {
      window.clearInterval(timer);
      return;
    }
    cursor.value = Math.min(trajectory.length - 1, cursor.value + 1);
    if (cursor.value >= trajectory.length - 1) {
      playing.value = false;
      window.clearInterval(timer);
    }
  }, Math.max(120, 600 / speedFactor.value));
}

/** 四类回放的执行入口（只读/幂等语义各自不同，均在文案中标注） */
function runReplay() {
  replaying.value = true;
  window.setTimeout(() => {
    replaying.value = false;
    const k = KINDS.find((x) => x.key === kind.value)!;
    MessagePlugin.success(`${k.label}完成：${k.writes}；${kind.value === 'audit' ? '一致性比对见审批历史（1 处分歧已标注）' : '已按事件重建，未触发执行'}`);
  }, 900);
}

function fork(itemId: string) {
  const id = store.fork(itemId);
  forkedId.value = id;
  MessagePlugin.success(`已从该消息点分叉：新会话 ${id}（原会话保留，可对照 diff）`);
  ui.pushNotification({
    kind: 'task_done',
    level: 'P2',
    title: '已创建分叉会话',
    body: `从消息 ${itemId} 分叉；两条分支可并行对照。`,
    actions: [{ label: '打开原会话', path: '/session' }],
    aggregateKey: 'fork',
    penetrateQuiet: false,
    channel: 'inapp',
  });
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="会话重放与分叉"
      desc="从事件重建历史帧、变速与跳转（不重建逐字动画）；四类回放的只读属性不同并显式标注；可从任一消息点 fork。"
      volume="卷 16"
      manifest="S-16"
      cli="oc session replay --session <id> --speed 2x | oc session fork --item <itemId>"
      :status="[{ label: '回放只读', theme: 'default' }, { label: '不重建逐字动画', theme: 'primary' }]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次事件读取失败">
          <Button size="small" variant="text" @click="failure = makeError('CONFLICT', '事件分区正在重建投影')">模拟异常</Button>
        </Tooltip>
        <Button size="small" variant="outline" :loading="replaying" @click="runReplay">{{ KINDS.find((k) => k.key === kind)?.label }}</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="事件数（区间）" :value="trajectory.length" unit="条" format="raw" icon="history" />
      <StatCard label="重放位点 seq" :value="trajectory[cursor]?.seq ?? 0" format="raw" icon="flag" />
      <StatCard label="倍速" :value="speed" unit="x" format="raw" icon="loading" />
      <StatCard label="可 fork 消息点" :value="messagePoints.length" unit="个" format="raw" icon="git" />
    </div>

    <RadioGroup v-model="kind" variant="default-filled">
      <RadioButton v-for="k in KINDS" :key="k.key" :value="k.key">{{ k.label }}</RadioButton>
    </RadioGroup>
    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Tag size="small" theme="primary" variant="light-outline">{{ KINDS.find((k) => k.key === kind)?.writes }}</Tag>
        <span class="oc-secondary" style="font-size: 12px">{{ KINDS.find((k) => k.key === kind)?.note }}</span>
      </div>
    </div>

    <StateShell
      :state="shellState"
      stage="正在按 seq 升序读取事件区间（先订阅后重放）…"
      cancellable
      empty-title="该区间没有可重放事件"
      empty-desc="会话语义上的重放需要 durable 事件；tentative 帧不入日志，因此不会重放逐字动画。"
      empty-action="选择其他区间"
      what="事件区间读取失败"
      :why="failure?.message ?? ''"
      how="可重试；同一分区的重放由租约互斥，冲突时请等待现有回放结束（CONFLICT）。"
      :trace-id="failure?.traceId ?? ''"
      :collapsed-summary="`审计事件 ${auditEvents.length} 条，已折叠展示前 ${listCap} 条（可加载更多）`"
      :page-size="listCap"
      :disabled-capabilities="['回放执行', '变速与跳转', '从消息点 fork']"
      @retry="failure = null; ui.simulateReconnect()"
      @empty-action="cursor = 0"
      @load-more="listCap += 8"
    >
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Button size="small" theme="primary" variant="outline" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</Button>
        <Button v-if="replaying" size="small" variant="text" @click="replaying = false">中止回放（只读，无副作用，可直接重来）</Button>
        <RadioGroup v-model="speed" variant="default-filled" size="small">
          <RadioButton value="0.5">0.5x</RadioButton>
          <RadioButton value="1">1x</RadioButton>
          <RadioButton value="2">2x</RadioButton>
          <RadioButton value="4">4x</RadioButton>
        </RadioGroup>
        <span class="oc-muted" style="font-size: 12px">进度 {{ positionPct }}%（位点 {{ trajectory[cursor]?.seq ?? 0 }}）；跳转按事件位点，不做逐字动画回放</span>
      </div>
      <Slider v-model="cursor" :min="0" :max="trajectory.length - 1" :step="1" :label="false" />

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            {{ kind === 'audit' ? '审计重放：决策链事件' : '事件重建：轨迹帧' }}
            <Tag size="small" variant="outline">{{ kind === 'projection' ? '按 eventId 幂等 upsert' : '只读呈现' }}</Tag>
          </h3>
          <Timeline>
            <TimelineItem
              v-for="(t, i) in (kind === 'audit' ? [] : trajectory)"
              :key="t.seq"
              :dot-color="i === cursor ? 'var(--td-brand-color)' : 'var(--oc-sev-ok)'"
              :loading="i === cursor && playing"
            >
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <CopyableId :id="String(t.seq)" label="复制 seq" />
                <Tag size="small" variant="outline" class="oc-mono">{{ t.type }}</Tag>
                <span v-if="i === cursor" class="oc-muted" style="font-size: 11px">当前位点</span>
              </div>
              <div style="font-size: 12px">{{ t.summary }}</div>
            </TimelineItem>
            <TimelineItem v-for="e in (kind === 'audit' ? visibleAudit : [])" :key="e.eventId" dot-color="var(--td-brand-color)">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <CopyableId :id="e.eventId" label="复制事件号" />
                <Tag size="small" variant="outline">{{ STATE_META[e.toState as ApprovalState].label }}</Tag>
                <span class="oc-muted" style="font-size: 11px">{{ new Date(e.at).toLocaleString('zh-CN') }}</span>
              </div>
              <div style="font-size: 12px">{{ e.reason }}</div>
            </TimelineItem>
          </Timeline>
        </div>

        <div class="oc-stack">
          <div v-if="kind === 'env'" class="oc-card">
            <h3 class="oc-card__title">环境重放：写操作账本</h3>
            <div class="oc-stack" style="gap: 6px">
              <div v-for="c in writeCalls" :key="c.tool?.callId" class="oc-flex--between oc-flex--wrap" style="gap: 6px">
                <div class="oc-flex" style="gap: 6px">
                  <Tag size="small" :theme="c.tool?.status === 'completed' ? 'success' : 'warning'" variant="light-outline">
                    {{ c.tool?.status === 'completed' ? '已结算 · 可重放' : '未结算 · SIMULATED' }}
                  </Tag>
                  <span class="oc-mono" style="font-size: 12px">{{ c.tool?.name }}</span>
                </div>
                <span class="oc-muted oc-truncate" style="font-size: 11px; max-width: 300px">{{ c.tool?.summary }}</span>
              </div>
              <div class="oc-muted" style="font-size: 11px">
                未结算 / 不可判定条目标记 SIMULATED 并给 UNKNOWN_ABANDONED 告警；沙箱可丢弃（重放不改变真实工作区）。
              </div>
            </div>
          </div>

          <div v-if="kind === 'projection'" class="oc-card">
            <h3 class="oc-card__title">投影重建目标</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'target', label: '目标投影', value: 'transcript_projection（会话读模型）+ cost_projection' },
                { key: 'idempotent', label: '幂等键', value: 'eventId（重复 upsert 不产生重复行）' },
                { key: 'guard', label: '回放守卫', value: '三要素比对（aggregate / seq / digest），分歧立即中止 REPLAY_DIVERGED' },
                { key: 'lease', label: '租约', value: '同一分区回放互斥；重复发起被拒绝（CONFLICT）' },
              ]"
            />
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">从任一消息点 fork（分支对照）</h3>
            <div class="oc-stack" style="gap: 6px">
              <div v-for="m in messagePoints" :key="m.itemId" class="oc-flex--between oc-flex--wrap" style="gap: 6px">
                <div class="oc-flex" style="gap: 6px; min-width: 0">
                  <OcIcon :name="m.actor === 'user' ? 'user' : 'robot'" size="13px" />
                  <span class="oc-muted" style="font-size: 11px">{{ new Date(m.at).toLocaleTimeString('zh-CN') }}</span>
                  <span class="oc-truncate" style="font-size: 12px; max-width: 320px">{{ m.text?.slice(0, 60) }}</span>
                </div>
                <Button size="small" variant="outline" @click="fork(m.itemId)">从此分叉</Button>
              </div>
              <div v-if="forkedId" class="oc-flex" style="gap: 6px">
                <Tag size="small" theme="success" variant="light-outline">已创建分支</Tag>
                <CopyableId :id="forkedId" label="复制新会话号" />
                <span class="oc-muted" style="font-size: 11px">原会话保留；两条分支共享历史到分叉点，之后独立演进。</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
