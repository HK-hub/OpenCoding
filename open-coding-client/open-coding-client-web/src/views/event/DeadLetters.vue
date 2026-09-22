<script setup lang="ts">
/**
 * V-05 死信队列。
 * 失败事件 + 失败原因 + 重放（先校验幂等键与 Schema，避免重复副作用；不可重放项显式说明）。
 * 溯源：卷 16 §4.5/§6；BUILD-MANIFEST V-05。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { DeadLetter } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const consumer = ref('');
const replayTarget = ref<DeadLetter | null>(null);
const replayMode = ref<'original' | 'safe'>('safe');
const note = ref('');
const replayed = ref<string[]>([]);

const deadLetters = computed(() => platformData.eventJobs.deadLetters);
const rows = computed(() => {
  const base = deadLetters.value.filter((d) => !replayed.value.includes(d.eventId));
  return consumer.value ? base.filter((d) => d.consumer === consumer.value) : base;
});
const replayableCount = computed(() => rows.value.filter((d) => d.replayable).length);

const columns = [
  { colKey: 'eventId', title: 'eventId', width: 190, cell: 'id' },
  { colKey: 'type', title: '事件类型', width: 210, cell: 'type' },
  { colKey: 'consumer', title: '消费者', width: 130 },
  { colKey: 'attempts', title: '尝试次数', width: 96 },
  { colKey: 'reason', title: '失败原因', ellipsis: true },
  { colKey: 'lastFailedAt', title: '最近失败', width: 160 },
  { colKey: 'op', title: '操作', width: 96, cell: 'op' },
];

/** 重放动作：先做幂等与 Schema 前置校验，再投递（至少一次 + 幂等键） */
function confirmReplay() {
  const target = replayTarget.value;
  if (!target) return;
  if (!target.replayable && replayMode.value === 'original') {
    MessagePlugin.error('该事件不可按原样重放：需先修复 Schema 或引用后重放（避免重复副作用）');
    return;
  }
  replayed.value = [...replayed.value, target.eventId];
  MessagePlugin.success(`已按「${replayMode.value === 'safe' ? '幂等安全模式' : '原样'}」重放 ${target.eventId}（幂等键 eventId + 消费者组）`);
  replayTarget.value = null;
  note.value = '';
}

onMounted(() => {
  window.setTimeout(() => (demo.value = deadLetters.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="死信队列"
      desc="消费者连续失败或 Webhook 投递失败进入死信；重放前必须校验幂等键与 Schema，避免重复副作用。"
      volume="卷 16" manifest="V-05" cli="oc event deadletter list --replayable"
      :status="[{ label: `${rows.length} 条待处理`, theme: rows.length ? 'warning' : 'success' }, { label: `可重放 ${replayableCount}`, theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="consumer" size="small" style="width: 170px" clearable placeholder="按消费者过滤" aria-label="消费者">
          <Option value="" label="全部消费者" />
          <Option v-for="c in ['任务投影', '审计投影', '知识挖掘', 'Webhook 投递']" :key="c" :value="c" :label="c" />
        </Select>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--3">
      <StatCard label="死信总数（24h）" :value="deadLetters.length + replayed.length" icon="mail" hint="消费者失败 + Webhook 投递失败" />
      <StatCard label="可自动重放" :value="replayableCount" icon="refresh" hint="幂等键与 Schema 校验通过" />
      <StatCard label="需人工修复" :value="rows.filter((d) => !d.replayable).length" icon="bug" hint="Schema 不兼容或引用缺失" />
    </div>

    <StateShell
      :state="demo" stage="正在读取死信队列（消费者组位点对账中）…"
      empty-title="死信队列已清空" empty-desc="所有失败事件都已重放成功或被修复后移除。"
      empty-action="查看消费者滞后" example-task="构造一次 Schema 不兼容投递，观察死信生成与重放拦截"
      what="死信队列读取失败" why="死信存储分区不可达（与消费者同库，主库延迟升高）"
      how="重试；或从事件流按 type 前缀过滤定位失败事件" trace-id="trace-e52b3c19"
      @retry="demo = 'NORMAL'" @empty-action="consumer = ''"
    >
      <Table :data="rows" :columns="columns" row-key="eventId" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.eventId }}</span></template>
        <template #type="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono">{{ row.type }}</span>
            <Tag v-if="!row.replayable" theme="danger" size="small" variant="light-outline">不可重放</Tag>
            <Tag v-else theme="success" size="small" variant="light-outline">可重放</Tag>
          </div>
        </template>
        <template #lastFailedAt="{ row }"><span class="oc-muted">{{ new Date(row.lastFailedAt).toLocaleString('zh-CN') }}</span></template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="replayTarget = row as DeadLetter">重放</Button>
        </template>
      </Table>
    </StateShell>

    <Dialog
      :visible="!!replayTarget" @visible-change="(v: boolean) => { if (!v) replayTarget = null }" header="重放死信事件" width="620px"
      :confirm-btn="{ content: '确认重放', theme: 'primary' }" cancel-btn="取消" @confirm="confirmReplay"
    >
      <div v-if="replayTarget" class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'id', label: 'eventId（幂等键组成部分）', value: replayTarget.eventId, mono: true },
          { key: 'type', label: '事件类型', value: replayTarget.type, mono: true },
          { key: 'consumer', label: '目标消费者组', value: replayTarget.consumer },
          { key: 'attempts', label: '已尝试次数', value: `${replayTarget.attempts} 次（含指数退避）` },
          { key: 'reason', label: '失败原因', value: replayTarget.reason },
        ]" />
        <div>
          <div class="oc-kv__k" style="margin-bottom: 4px">重放模式</div>
          <Select v-model="replayMode" size="small" style="width: 100%">
            <Option value="safe" label="幂等安全模式（推荐）：命中幂等键则跳过，仅补投缺失分支" />
            <Option value="original" label="按原样重放：不跳过任何步骤（需确认无重复副作用）" />
          </Select>
        </div>
        <div v-if="!replayTarget.replayable" class="oc-card" style="border-color: var(--oc-sev-warn)">
          <div class="oc-flex oc-flex--wrap">
            <Tag theme="warning" variant="light-outline" size="small">不可按原样重放</Tag>
            <span style="font-size: 12px">该事件的 Schema 与当前注册表不兼容，或引用的资源已缺失。请先修复后重放。</span>
          </div>
        </div>
        <div>
          <div class="oc-kv__k" style="margin-bottom: 4px">操作理由（写入审计）</div>
          <Input v-model="note" size="small" placeholder="例如：修复 kb://ks-04#c-91 引用后重放" />
        </div>
        <JsonBlock :mask="false" :value="{ idempotencyKey: `${replayTarget.eventId} + ${replayTarget.consumer}`, skipIfExists: replayMode === 'safe', sideEffectLedger: '重放前校验副作用账本' }" label="重放前置校验" />
        <CliHint :command="`oc event deadletter replay --event-id ${replayTarget.eventId} --mode ${replayMode}`" />
      </div>
    </Dialog>
  </div>
</template>
