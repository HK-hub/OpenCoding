<script setup lang="ts">
/**
 * V-01 事件流浏览器（Live Tail）。
 * 双通道模型：durable（带 seq，可断线续传/可重放）与 live（不带 seq，可丢）。
 * live 通道背压丢弃时显式给出 stream.gap 提示，并引导切回 durable 续传。
 * 溯源：卷 16 §4.3/§4.4；BUILD-MANIFEST V-01。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, Input, Option, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { platformData, isAuditEvent, EVENT_DOMAINS } from '@/mock/data/platform';
import type { EventEnvelope, Sensitivity } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE'>('LOADING');
const channel = ref<'durable' | 'live'>('durable');
const category = ref<string>('');
const domain = ref<string>('');
const sensitivity = ref<string>('');
const keyword = ref('');
const paused = ref(false);
const limit = ref(20);

/** 实时通道帧（不持久、无 seq；结束后仅落语义事件与摘要） */
const LIVE_FRAMES: { type: string; payload: Record<string, unknown> }[] = [
  { type: 'agent.turn.delta', payload: { turnId: 'T-77', delta: '对账差异定位完成，准备写入修复' } },
  { type: 'tool.output.delta', payload: { toolCallId: 'tc-118', delta: '+128 lines（已缓冲，不入库）' } },
  { type: 'model.stream.delta', payload: { model: 'claude-sonnet-4.5', tokens: 42 } },
  { type: 'progress.heartbeat', payload: { sessionId: 'S-1b2c', step: 19, pct: 0.72 } },
];

interface TailRow {
  key: string;
  channel: 'durable' | 'live';
  seq: number | null;
  event: EventEnvelope | null;
  type: string;
  category: string;
  actor: string;
  sensitivity: Sensitivity | '—';
  at: string;
  summary: string;
  gap: boolean;
}

let tick = 0;
let timer = 0;
const appended = ref<TailRow[]>([]);
const dropped = ref(0);
const gapNotice = ref(false);
const resumeSeq = 128432;

function toRow(e: EventEnvelope): TailRow {
  return {
    key: e.eventId,
    channel: 'durable',
    seq: e.seq,
    event: e,
    type: e.type,
    category: e.category,
    actor: `${e.actor.kind}:${e.actor.id}`,
    sensitivity: e.sensitivity,
    at: new Date(e.occurredAt).toLocaleTimeString('zh-CN', { hour12: false }),
    summary: String(Object.values(e.payload)[0] ?? ''),
    gap: false,
  };
}

/** durable 首屏窗口：取最新 24 条并倒序渲染（尾随语义，最新在前） */
const durableRows = computed(() => platformData.events.slice(-24).reverse().map(toRow));

/** 合并流：durable 首屏 + 实时追加，时间倒序模拟尾随；先按当前通道过滤，durable 视图不混入 live 帧 */
const rows = computed<TailRow[]>(() => {
  const base = channel.value === 'live' ? [] : durableRows.value;
  const all = [...appended.value, ...base];
  const filtered = all.filter((r) => {
    if (r.channel !== channel.value) return false;
    if (category.value && r.category !== category.value) return false;
    if (domain.value && !r.type.startsWith(`${domain.value}.`)) return false;
    if (sensitivity.value && r.sensitivity !== sensitivity.value) return false;
    if (keyword.value && !`${r.type} ${r.summary}`.toLowerCase().includes(keyword.value.toLowerCase())) return false;
    return true;
  });
  return filtered;
});

const shown = computed(() => rows.value.slice(0, limit.value));
const edge = computed(() => !paused.value && rows.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));

const liveRate = ref(0);
function pushFrame() {
  const frame = LIVE_FRAMES[tick % LIVE_FRAMES.length];
  const seqTick = 221 + tick;
  // 背压：live 通道缓冲超阈值时丢弃最旧帧，并给出 stream.gap（可丢语义）
  if (tick > 0 && tick % 7 === 0) {
    dropped.value += 1;
    gapNotice.value = true;
    appended.value.unshift({
      key: `gap-${tick}`, channel: 'live', seq: null, event: null, type: 'stream.gap',
      category: 'system', actor: 'system:stream', sensitivity: 'normal',
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      summary: `背压丢弃 ${dropped.value} 帧（live 通道不持久，丢失不可补偿）→ 切到 durable 从 seq ${resumeSeq} 续传`,
      gap: true,
    });
  } else {
    appended.value.unshift({
      key: `live-${tick}`, channel: 'live', seq: null, event: null, type: frame.type,
      category: 'telemetry', actor: 'agent:implementer', sensitivity: 'internal',
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      summary: String(frame.payload.delta ?? frame.payload.pct ?? frame.payload.tokens ?? ''), gap: false,
    });
  }
  if (appended.value.length > 40) appended.value.pop();
  // 新到达的 durable 帧以当前时间入列（just-arrived 语义），保持顶部时间单调递减
  if (seqTick % 3 === 0) {
    const arrived = toRow(platformData.events[seqTick % platformData.events.length]);
    appended.value.unshift({ ...arrived, at: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
  }
  tick += 1;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 260);
  timer = window.setInterval(() => {
    if (paused.value || demo.value !== 'NORMAL') return;
    pushFrame();
    liveRate.value = 8 + (tick % 5);
  }, 1600);
  ui.setViewState({ state: 'NORMAL' });
});
onUnmounted(() => window.clearInterval(timer));

const columns = [
  { colKey: 'channel', title: '通道', width: 96, cell: 'channel' },
  { colKey: 'seq', title: 'seq', width: 96, cell: 'seqCell' },
  { colKey: 'type', title: '事件类型', width: 236, cell: 'type' },
  { colKey: 'category', title: '分类', width: 132, cell: 'category' },
  { colKey: 'actor', title: '发起者', width: 150, ellipsis: true },
  { colKey: 'sensitivity', title: '敏感度', width: 96, cell: 'sensitivity' },
  { colKey: 'at', title: '发生时间', width: 96 },
  { colKey: 'summary', title: '载荷摘要', ellipsis: true },
];

const SENS_THEME: Record<string, 'default' | 'warning' | 'danger'> = { normal: 'default', internal: 'warning', sensitive: 'danger' };
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="事件流浏览器"
      desc="双通道：durable 事件带分区内单调 seq（可续传可重放），live 增量不持久（可丢）。过滤只作用于视图，不改变订阅位点。"
      volume="卷 16" manifest="V-01" cli="oc event tail --channel durable --from-seq 128432"
      :status="[{ label: paused ? '已暂停' : '尾随中', theme: paused ? 'warning' : 'success' }, { label: '只读', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'OFFLINE', label: '离线' },
        ]" />
        <Button size="small" theme="primary" variant="outline" @click="paused = !paused">
          {{ paused ? '继续尾随' : '暂停尾随' }}
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="durable 追加速率" :value="1842" unit="EPS" icon="system" hint="追加 P95 ≤ 10ms" />
      <StatCard label="live 帧速率" :value="liveRate" unit="帧/s" icon="loading" :hint="`不持久，缓冲上限 100 帧；已丢弃 ${dropped} 帧`" />
      <StatCard label="续传位点" :value="`seq ${resumeSeq}`" format="raw" icon="history" hint="断线重连后从该位点补发，live 丢失帧不补" />
      <StatCard label="审计类事件占比" :value="12.4" format="percent" icon="secured" hint="audit/sec/permission 前缀带 AUDIT 标记" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Select v-model="channel" size="small" style="width: 200px" aria-label="通道">
          <Option value="durable" label="durable（带 seq，可续传）" />
          <Option value="live" label="live（无 seq，可丢）" />
        </Select>
        <Select v-model="category" size="small" style="width: 150px" clearable placeholder="分类" aria-label="分类">
          <Option value="" label="全部分类" />
          <Option value="domain" label="domain" />
          <Option value="system" label="system" />
          <Option value="telemetry" label="telemetry" />
        </Select>
        <Select v-model="domain" size="small" style="width: 160px" clearable placeholder="域前缀" aria-label="域前缀">
          <Option value="" label="全部域前缀" />
          <Option v-for="d in EVENT_DOMAINS" :key="d" :value="d" :label="d" />
        </Select>
        <Select v-model="sensitivity" size="small" style="width: 150px" clearable placeholder="敏感度" aria-label="敏感度">
          <Option value="" label="全部敏感度" />
          <Option value="normal" label="normal" />
          <Option value="internal" label="internal" />
          <Option value="sensitive" label="sensitive" />
        </Select>
        <Input v-model="keyword" size="small" style="width: 220px" placeholder="按类型/载荷摘要检索" clearable />
        <span class="oc-muted" style="font-size: 12px">命中 {{ rows.length }} 条 · durable 按 seq 无序不跨分区比较</span>
      </div>
      <div v-if="gapNotice" class="oc-flex oc-flex--wrap" style="margin-top: 8px">
        <Tag theme="warning" variant="light-outline" size="small">stream.gap</Tag>
        <span style="font-size: 12px">live 通道背压已丢弃 {{ dropped }} 帧（可丢语义，不保证完整性）→ durable 通道可续传，建议切回。</span>
        <Button size="small" variant="text" @click="channel = 'durable'; gapNotice = false">切到 durable 续传</Button>
      </div>
    </div>

    <StateShell
      :state="state" stage="正在建立 WS 订阅（订阅集合：当前会话 + 任务列表 + 审批）…" :cancellable="true"
      empty-title="当前过滤条件下没有事件" empty-desc="域前缀、分类与敏感度组合过窄，或该分区尚未产生事件。"
      empty-action="清除过滤条件" example-task="在会话中执行一次 pnpm test，观察 tool.call.completed 事件"
      what="事件流订阅建立失败" why="WS 通道握手超时（内核返回 503），live 通道已回退为轮询"
      how="可重试；或切到 durable 通道，按 seq 补发断线期间事件" trace-id="trace-a91c4f2e" :retryable="true"
      :reconnect-in-ms="4000" :disabled-capabilities="['live 实时推送', '命令终端流式输出']"
      :collapsed-summary="`已折叠 ${rows.length - shown.length} 条（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="category = ''; domain = ''; sensitivity = ''; keyword = ''"
      @cancel="paused = true" @dismiss-offline="demo = 'NORMAL'"
    >
      <Table :data="shown" :columns="columns" row-key="key" size="small" :pagination="undefined" :bordered="false">
        <template #channel="{ row }">
          <Tag :theme="row.channel === 'durable' ? 'success' : 'warning'" variant="light-outline" size="small">
            {{ row.channel }}
          </Tag>
        </template>
        <template #seqCell="{ row }">
          <span v-if="row.seq" class="oc-mono">{{ row.seq }}</span>
          <Tooltip v-else content="live 帧不持久、无 seq，丢失不可补偿">
            <Tag size="small" variant="outline">无 seq</Tag>
          </Tooltip>
        </template>
        <template #type="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono">{{ row.type }}</span>
            <Tag v-if="row.gap" theme="warning" variant="light-outline" size="small">丢弃</Tag>
            <Tag v-else-if="row.event && isAuditEvent(row.event)" theme="danger" variant="light-outline" size="small">AUDIT</Tag>
          </div>
        </template>
        <template #category="{ row }">
          <Tag :theme="row.category === 'domain' ? 'primary' : row.category === 'system' ? 'warning' : 'default'" size="small" variant="light-outline">
            {{ row.category }}
          </Tag>
        </template>
        <template #sensitivity="{ row }">
          <Tag :theme="SENS_THEME[row.sensitivity] ?? 'default'" size="small" variant="light-outline">{{ row.sensitivity }}</Tag>
        </template>
      </Table>
      <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
        <CopyableId id="trace-a91c4f2e" label="复制当前订阅 traceId" />
        <span class="oc-muted" style="font-size: 12px">断线续传：重连后由 durable 通道按 seq 补发；live 丢弃帧仅以 stream.gap 告警，不补发。</span>
      </div>
    </StateShell>
  </div>
</template>
