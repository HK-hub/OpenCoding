<script setup lang="ts">
/**
 * V-02 事件详情。
 * 16 字段信封逐字段展示（含 actor/trace 嵌套），payload 脱敏呈现、schemaRef 溯源、
 * 并以 traceId 拉出同一条 trace 的事件链上下文（事件 ↔ trace 互查入口）。
 * 溯源：卷 16 §4.1/§4.8；BUILD-MANIFEST V-02。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData, isAuditEvent } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const selectedId = ref(platformData.events[10].eventId);

const event = computed(() => platformData.events.find((e) => e.eventId === selectedId.value) ?? null);

/** 同一 trace 的事件链（父子 span 关系由 parentSpanId 标出） */
const traceChain = computed(() =>
  event.value ? platformData.events.filter((e) => e.trace.traceId === event.value!.trace.traceId) : [],
);

const envelope = computed(() => {
  const e = event.value;
  if (!e) return [];
  return [
    { key: 'eventId', label: 'eventId（UUIDv7，含时间序）', value: e.eventId, mono: true, copyable: true },
    { key: 'type', label: 'type（<域>.<对象>.<动作>）', value: e.type, mono: true },
    { key: 'version', label: 'version（Schema 版本）', value: `v${e.version}` },
    { key: 'category', label: 'category', value: e.category, tag: { text: e.category, theme: e.category === 'domain' ? 'primary' as const : e.category === 'system' ? 'warning' as const : 'default' as const } },
    { key: 'tenantId', label: 'tenantId（强制）', value: e.tenantId },
    { key: 'projectId', label: 'projectId（强制）', value: e.projectId, mono: true },
    { key: 'partitionKey', label: 'partitionKey（分区键）', value: e.partitionKey, mono: true, hint: '分区内 seq 严格单调' },
    { key: 'seq', label: 'seq（分区内单调序号）', value: e.seq },
    { key: 'occurredAt', label: 'occurredAt（发生时间）', value: new Date(e.occurredAt).toLocaleString('zh-CN') },
    { key: 'recordedAt', label: 'recordedAt（写入时间）', value: new Date(e.recordedAt).toLocaleString('zh-CN'), hint: '含写入前脱敏与 Schema 校验耗时' },
    { key: 'actor', label: 'actor.kind / actor.id', value: `${e.actor.kind} · ${e.actor.id}`, tag: { text: e.actor.kind, theme: e.actor.kind === 'system' ? 'default' as const : 'primary' as const } },
    { key: 'span', label: 'trace.spanId', value: e.trace.spanId, mono: true },
    { key: 'parentSpan', label: 'trace.parentSpanId', value: e.trace.parentSpanId ?? '（根 span）', mono: true },
    { key: 'correlationId', label: 'correlationId（业务关联）', value: e.correlationId, mono: true, copyable: true },
    { key: 'sensitivity', label: 'sensitivity（决定加密与访问）', value: e.sensitivity, tag: { text: e.sensitivity, theme: e.sensitivity === 'sensitive' ? 'danger' as const : e.sensitivity === 'internal' ? 'warning' as const : 'default' as const } },
    { key: 'schemaRef', label: 'schemaRef（定义引用）', value: e.schemaRef, mono: true },
  ];
});

const chainColumns = [
  { colKey: 'seq', title: 'seq', width: 90 },
  { colKey: 'type', title: '事件类型', width: 240 },
  { colKey: 'span', title: 'spanId / parentSpanId', width: 240, cell: 'span' },
  { colKey: 'at', title: '发生时间', width: 150 },
  { colKey: 'summary', title: '摘要', ellipsis: true },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.events.length ? 'NORMAL' : 'EMPTY'), 220);
  ui.setViewState({ state: 'NORMAL' });
});

const cliForEvent = computed(() => `oc event show --event-id ${selectedId.value} --with-trace`);

/** 在回放控制台中打开当前 trace：携带 traceId 跳转（回放范围由 trace 上下文确定） */
function openReplayForTrace() {
  const traceId = event.value?.trace.traceId;
  if (!traceId) {
    MessagePlugin.warning('当前事件缺少 traceId，无法在回放控制台中打开该 trace');
    return;
  }
  router.push({ path: '/event/replay', query: { traceId } });
}
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="事件详情"
      desc="事件信封是事实源的最小单元：16 字段 + 脱敏后的类型化载荷。仅追加、不可就地修改（修订以新事件表达）。"
      volume="卷 16" manifest="V-02" :cli="cliForEvent"
      :status="[{ label: isAuditEvent(event ?? platformData.events[0]) ? 'AUDIT 审计链条目' : '常规事件', theme: 'default' }, { label: '只读', theme: 'primary' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
      </template>
    </PageHeader>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap">
        <Select v-model="selectedId" size="small" filterable style="width: 520px" aria-label="选择事件">
          <Option v-for="e in platformData.events" :key="e.eventId" :value="e.eventId" :label="`${e.type} · seq ${e.seq} · ${e.category}`" />
        </Select>
        <CliHint :command="cliForEvent" label="复制查询命令" />
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在读取事件与 trace 上下文…"
      empty-title="事件不存在或已随留存策略删除" empty-desc="编号未命中（可能已归档到冷存或按合规要求删除）。"
      empty-action="从事件流重选" example-task="在事件流中暂停并复制 eventId 后回到本页查询"
      what="事件详情读取失败" why="事件存储分区查询超时（冷存回源）"
      how="可重试；或先在「事件流浏览器」定位新事件（热分区）" trace-id="trace-b72d1188"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            事件信封（16 字段）
            <Tag v-if="event && isAuditEvent(event)" theme="danger" variant="light-outline" size="small">AUDIT 标记</Tag>
          </h3>
          <InfoGrid :items="envelope" :columns="1" />
        </div>
        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">payload（已脱敏的类型化载荷）</h3>
            <JsonBlock :value="event?.payload ?? {}" label="payload" :collapse-over="220" />
            <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
              <Tag size="small" variant="light-outline">写入前脱敏</Tag>
              <Tag size="small" variant="light-outline">密钥类字段永不明文</Tag>
              <CopyableId :id="event?.eventId ?? '—'" label="复制 eventId" />
            </div>
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">schemaRef 与兼容性</h3>
            <InfoGrid :columns="1" :items="[
              { key: 'ref', label: 'Schema 引用', value: event?.schemaRef ?? '—', mono: true },
              { key: 'compat', label: '兼容性', value: '向后兼容（新增可选字段），CI 校验通过', tag: { text: 'backward', theme: 'success' } },
              { key: 'consume', label: '消费者解析', value: `按 v${event?.version ?? 1} 解析；升级消费者不回溯改写历史事件` },
              { key: 'reject', label: '被拒记录', value: '无（该类型 Schema 未被拒绝过）' },
            ]" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          trace 上下文（同 traceId 事件链）
          <span class="oc-flex" style="gap: 6px">
            <CopyableId :id="event?.trace.traceId ?? '—'" label="复制 traceId" />
            <CliHint :command="`oc trace show --trace-id ${event?.trace.traceId ?? ''}`" label="查看 span 树" />
          </span>
        </h3>
        <Table :data="traceChain" :columns="chainColumns" row-key="eventId" size="small" :pagination="undefined">
          <template #span="{ row }">
            <span class="oc-mono">{{ row.trace.spanId }}{{ row.trace.parentSpanId ? ` ← ${row.trace.parentSpanId}` : '（根）' }}</span>
          </template>
          <template #at="{ row }">
            <span class="oc-muted">{{ new Date(row.occurredAt).toLocaleTimeString('zh-CN', { hour12: false }) }}</span>
          </template>
          <template #summary="{ row }">
            <span class="oc-truncate">{{ String(Object.values(row.payload)[0] ?? '') }}</span>
          </template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag size="small" variant="light-outline">事件携带 trace/span（对齐 OpenTelemetry 语义）</Tag>
          <Tag size="small" theme="primary" variant="light-outline">一次 Turn 一个 span 树：模型与工具调用为子 span</Tag>
          <Button size="small" variant="text" @click="openReplayForTrace">在回放控制台中打开该 trace</Button>
        </div>
      </div>
    </StateShell>
  </div>
</template>
