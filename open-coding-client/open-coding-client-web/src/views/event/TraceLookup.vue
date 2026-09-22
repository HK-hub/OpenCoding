<script setup lang="ts">
/**
 * V-10 追踪互查。
 * 双向查询：事件 → trace/span 上下文；traceId → 事件链；指标点 → 派生该点的相关事件。
 * 溯源：卷 16 §4.8/D-EVT-10；BUILD-MANIFEST V-10。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcChart from '@/components/common/OcChart.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const mode = ref<'trace2event' | 'event2trace' | 'metric2event'>('trace2event');
const traceInput = ref('trace-0001a3f2');
const eventId = ref(platformData.events[3].eventId);

const traceId = computed(() => {
  const found = platformData.events.find((e) => e.trace.traceId === traceInput.value);
  return found?.trace.traceId ?? traceInput.value;
});

const eventsByTrace = computed(() => platformData.events.filter((e) => e.trace.traceId === traceId.value));
const selectedEvent = computed(() => platformData.events.find((e) => e.eventId === eventId.value) ?? platformData.events[0]);
const eventsBySelectedTrace = computed(() => platformData.events.filter((e) => e.trace.traceId === selectedEvent.value.trace.traceId));

/** 指标点 → 事件（由事件流聚合派生，指标与事件可互查） */
const METRIC_POINTS = [
  { metric: 'oc_event_consumer_lag_seconds', point: 'audit-proj @ 07:20 = 194s', events: ['system.eventlog.consumer.lag', 'permission.decision'], window: '07:15–07:20' },
  { metric: 'oc_git_merge_queue_depth', point: 'main @ 06:40 = 4', events: ['git.merge.queued', 'git.merge.conflict'], window: '06:30–06:45' },
  { metric: 'oc_workspace_disk_used_ratio', point: 'ws-0003 @ 05:18 = 0.92', events: ['workspace.quota.exceeded', 'workspace.command.completed'], window: '05:10–05:20' },
  { metric: 'oc_restore_drill_success_ratio', point: '2026-Q3 = 0.75', events: ['system.restore.verified', 'system.backup.completed'], window: '季度窗口' },
];

const traceColumns = [
  { colKey: 'seq', title: 'seq', width: 90 },
  { colKey: 'type', title: '事件类型', width: 250, cell: 'type' },
  { colKey: 'span', title: 'span / parent', width: 220, cell: 'span' },
  { colKey: 'at', title: '发生时间', width: 170, cell: 'at' },
];

const metricColumns = [
  { colKey: 'metric', title: '指标', width: 260, cell: 'metric' },
  { colKey: 'point', title: '指标点（异常采样）', width: 220 },
  { colKey: 'window', title: '窗口', width: 140 },
  { colKey: 'events', title: '派生该点的事件（可下钻）', cell: 'events' },
];

const latencySeries = computed(() => [
  {
    name: 'oc_event_append_latency_ms',
    points: [7, 6, 8, 7, 9, 11, 8, 7].map((v, i) => ({ x: `${i * 5}分前`, y: v })),
  },
]);

/** 指标点下钻：先从事件表按事件类型精确匹配，无命中时退化为同域前缀匹配 */
const drillPoint = ref<(typeof METRIC_POINTS)[number] | null>(null);
const drillResult = computed(() => {
  const point = drillPoint.value;
  if (!point) return null;
  const exact = platformData.events.filter((e) => point.events.includes(e.type));
  const domains = new Set(point.events.map((t) => t.split('.')[0]));
  const base = exact.length ? exact : platformData.events.filter((e) => domains.has(e.type.split('.')[0]));
  return { exact: exact.length > 0, total: base.length, list: base.slice(0, 8) };
});

const drillColumns = [
  { colKey: 'eventId', title: '事件 id', width: 150, cell: 'id' },
  { colKey: 'type', title: '事件类型', width: 230, cell: 'type' },
  { colKey: 'seq', title: 'seq', width: 90 },
  { colKey: 'at', title: '发生时间', width: 180, cell: 'at' },
  { colKey: 'trace', title: 'traceId', cell: 'trace' },
];

/** 从下钻结果切到主视图：以首条命中事件的 trace 打开事件链 */
function drillToEventChain() {
  const first = drillResult.value?.list[0];
  if (!first) return;
  traceInput.value = first.trace.traceId;
  mode.value = 'trace2event';
  drillPoint.value = null;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.events.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="事件与追踪互查"
      desc="事件携带 trace/span 上下文（对齐 OpenTelemetry 语义）：既可由事件回看整棵 span 树，也可由 traceId 拉出全部事件；指标由事件派生，可反向下钻。"
      volume="卷 16" manifest="V-10" cli="oc trace lookup --trace-id trace-0001a3f2 --with-events"
      :status="[{ label: '只读查询', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="mode" size="small" style="width: 190px" aria-label="查询方向">
          <Option value="trace2event" label="traceId → 事件链" />
          <Option value="event2trace" label="事件 → trace 上下文" />
          <Option value="metric2event" label="指标点 → 事件" />
        </Select>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--3">
      <StatCard label="追加延迟 P95" :value="10" unit="ms" icon="system" hint="SLO：新增事件追加 P95 ≤ 10ms" />
      <StatCard label="端到端推送延迟" :value="186" unit="ms" icon="loading" hint="目标 ≤ 200ms（含脱敏与 Schema 校验）" />
      <StatCard label="span 树规模（当前 trace）" :value="eventsByTrace.length || eventsBySelectedTrace.length" icon="sitemap" hint="一次 Turn 一个 span 树，工具/模型调用为子 span" />
    </div>

    <StateShell
      :state="demo" stage="正在按 traceId 聚合事件链…"
      empty-title="该 traceId 没有关联事件" empty-desc="trace 可能是 live 通道帧产生的临时上下文（不持久），或超出在线保留窗口。"
      empty-action="从事件流复制 traceId" example-task="在错误卡上复制 traceId，回到本页互查全部子 span 事件"
      what="追踪查询失败" why="trace 索引分片不可用（与事件表同库，只读副本延迟升高）"
      how="重试；或改用事件 ID 直查（走主键，不依赖 trace 索引）" trace-id="trace-d14f8a55"
      @retry="demo = 'NORMAL'" @empty-action="mode = 'event2trace'"
    >
      <div class="oc-card">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Input v-model="traceInput" size="small" style="width: 320px" placeholder="traceId（如 trace-0001a3f2）" clearable />
          <Select v-model="eventId" size="small" filterable style="width: 420px" aria-label="选择事件">
            <Option v-for="e in platformData.events" :key="e.eventId" :value="e.eventId" :label="`${e.type} · ${e.trace.traceId}`" />
          </Select>
          <CopyableId :id="traceId" label="复制 traceId" />
        </div>
      </div>

      <div v-if="mode === 'trace2event'" class="oc-card">
        <h3 class="oc-card__title">traceId → 事件链（按分区 seq 排序，跨分区不比较顺序）</h3>
        <Table :data="eventsByTrace.length ? eventsByTrace : eventsBySelectedTrace" :columns="traceColumns" row-key="eventId" size="small" :pagination="undefined">
          <template #type="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-mono">{{ row.type }}</span>
              <Tag size="small" variant="outline">v{{ row.version }}</Tag>
            </div>
          </template>
          <template #span="{ row }"><span class="oc-mono">{{ row.trace.spanId }}{{ row.trace.parentSpanId ? ` ← ${row.trace.parentSpanId}` : '（根）' }}</span></template>
          <template #at="{ row }"><span class="oc-muted">{{ new Date(row.occurredAt).toLocaleString('zh-CN') }}</span></template>
        </Table>
      </div>

      <div v-else-if="mode === 'event2trace'" class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">事件 → trace 上下文</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'type', label: '事件类型', value: selectedEvent.type, mono: true },
            { key: 'trace', label: 'traceId', value: selectedEvent.trace.traceId, mono: true, copyable: true },
            { key: 'span', label: 'spanId', value: selectedEvent.trace.spanId, mono: true },
            { key: 'parent', label: 'parentSpanId', value: selectedEvent.trace.parentSpanId ?? '（根 span，通常为 Turn 入口）', mono: true },
            { key: 'corr', label: 'correlationId（业务关联）', value: selectedEvent.correlationId, mono: true, copyable: true },
            { key: 'log', label: '结构化日志关联', value: '技术日志携带相同 trace 上下文（业务语义不重复记日志）' },
          ]" />
          <div class="oc-flex" style="margin-top: 8px">
            <CliHint :command="`oc trace show --trace-id ${selectedEvent.trace.traceId}`" />
          </div>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">同 trace 的兄弟事件（{{ eventsBySelectedTrace.length }} 条）</h3>
          <Table :data="eventsBySelectedTrace" :columns="traceColumns" row-key="eventId" size="small" :pagination="undefined">
            <template #type="{ row }"><span class="oc-mono">{{ row.type }}</span></template>
            <template #span="{ row }"><span class="oc-mono">{{ row.trace.spanId }}</span></template>
            <template #at="{ row }"><span class="oc-muted">{{ new Date(row.occurredAt).toLocaleTimeString('zh-CN', { hour12: false }) }}</span></template>
          </Table>
        </div>
      </div>

      <div v-else class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">指标趋势（延迟类，10% 采样）</h3>
          <OcChart type="line" :height="200" unit="ms" :series="latencySeries" :threshold="{ value: 10, label: 'SLO 10ms' }" aria-label="事件追加延迟" />
          <Tag size="small" variant="outline" style="margin-top: 8px">指标由事件流聚合派生；异常点可反查派生事件</Tag>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">异常指标点 → 相关事件</h3>
          <Table :data="METRIC_POINTS" :columns="metricColumns" row-key="metric" size="small" :pagination="undefined">
            <template #metric="{ row }"><span class="oc-mono">{{ row.metric }}</span></template>
            <template #events="{ row }">
              <div class="oc-flex oc-flex--wrap" style="gap: 4px">
                <Tag v-for="e in row.events" :key="e" size="small" variant="light-outline" class="oc-mono">{{ e }}</Tag>
                <Button size="small" variant="text" @click="drillPoint = row">下钻</Button>
              </div>
            </template>
          </Table>
        </div>
      </div>
    </StateShell>

    <Dialog
      :visible="!!drillPoint"
      @visible-change="(v: boolean) => { if (!v) drillPoint = null }"
      :header="`指标点下钻 · ${drillPoint?.metric ?? ''}`" width="760px" :footer="false"
    >
      <div v-if="drillPoint && drillResult" class="oc-stack" style="gap: 8px">
        <div style="font-size: 12px">指标点：<span class="oc-mono">{{ drillPoint.point }}</span> · 窗口 {{ drillPoint.window }}</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 4px">
          <Tag v-for="t in drillPoint.events" :key="t" size="small" variant="light-outline" class="oc-mono">{{ t }}</Tag>
        </div>
        <div class="oc-muted" style="font-size: 12px">
          {{ drillResult.exact ? '按事件类型精确匹配' : '无精确匹配，已按同域前缀扩展' }}：命中 {{ drillResult.total }} 条，展示前 {{ drillResult.list.length }} 条（在线保留窗口内）
        </div>
        <Table :data="drillResult.list" :columns="drillColumns" row-key="eventId" size="small" :pagination="undefined">
          <template #id="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.eventId }}</span></template>
          <template #type="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.type }}</span></template>
          <template #at="{ row }"><span class="oc-muted">{{ new Date(row.occurredAt).toLocaleString('zh-CN') }}</span></template>
          <template #trace="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.trace.traceId }}</span></template>
        </Table>
        <div v-if="!drillResult.list.length" class="oc-muted" style="font-size: 12px">该指标点派生的事件在当前在线保留窗口内无记录；可在「事件流浏览器」扩大范围后重查。</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <CliHint :command="`oc event query --types ${drillPoint.events.join(',')} --window ${drillPoint.window}`" label="复制下钻查询命令" />
          <Button v-if="drillResult.list.length" size="small" variant="outline" @click="drillToEventChain">按首条事件切换事件链</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
