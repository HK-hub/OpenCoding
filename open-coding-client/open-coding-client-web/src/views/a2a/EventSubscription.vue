<script setup lang="ts">
/**
 * 事件订阅（Q-06）：SSE / WebSocket 订阅 + Last-Event-ID 续传 + 11 类外部事件过滤。
 * 溯源：卷 23 §4.1（/tasks/{id}/events）§7（断线可续）
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { A2AEventType } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref<A2AEventType[]>(['task.queued', 'task.started', 'phase.changed']);
const editing = ref(false);
const allTypes: A2AEventType[] = ['task.queued', 'task.started', 'phase.changed', 'plan.updated', 'tool.summary', 'approval.requested', 'approval.resolved', 'artifact.created', 'task.completed', 'task.failed', 'task.cancelled'];
const filtered = computed(() => d.a2a.externalEvents.filter((e) => selected.value.includes(e.type)));
const lag = computed(() => filtered.value.map((e) => ({ x: String(e.seq), y: e.latencyMs })));
/** 订阅状态局部投影：ref 包装后即可在就地修改领域数据的同时触发统计卡与表格刷新 */
const subs = ref(d.a2a.subscriptions);
const reconnecting = ref(false);

/** 重连并续传：可续传订阅从 Last-Event-ID 恢复；超出保留窗口的显式标注需重取全量（不静默重放） */
function reconnectAll() {
  reconnecting.value = true;
  MessagePlugin.info('正在重连订阅并请求从 Last-Event-ID 续传…');
  window.setTimeout(() => {
    let resumed = 0;
    let blocked = 0;
    subs.value.forEach((s) => {
      if (!s.resumable) {
        // 保留窗口（7 天）外的位点无法补投，只能重取全量结果后重建订阅
        s.note = 'Last-Event-ID 超出保留窗口（7 天）：需调用 /tasks/{id}/result 重取全量结果后重建订阅';
        blocked += 1;
        return;
      }
      s.reconnectCount += 1;
      s.state = 'CONNECTED';
      s.note = `已从 Last-Event-ID ${s.lastEventId} 续传（重连次数 ${s.reconnectCount}）`;
      resumed += 1;
    });
    reconnecting.value = false;
    MessagePlugin.success(`重连并续传完成：${resumed} 条订阅已恢复并从 Last-Event-ID 补投缺口；${blocked} 条超出保留窗口，需重取全量结果（不静默重放）`);
  }, 600);
}

function toggle(t: A2AEventType) {
  const i = selected.value.indexOf(t);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(t);
}

onMounted(() => {
  setTimeout(() => { state.value = filtered.value.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="事件订阅"
      desc="外部可见事件为内部事件的过滤投影（11 类稳定契约）；SSE/WS 断线可用 Last-Event-ID 续传，超出保留窗口需重取全量结果。"
      volume="卷 23"
      manifest="Q-06"
      cli="oc a2a subscribe --task <id> --transport sse --resume"
      :status="[{ label: '外部契约稳定', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="editing = !editing">{{ editing ? '完成过滤' : '编辑过滤' }}</Button>
        <Button size="small" variant="outline" :loading="reconnecting" @click="reconnectAll">重连并续传</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有匹配的事件"
      empty-desc="当前过滤条件过于狭窄；至少保留 task.queued 与终态事件（task.completed / task.failed / task.cancelled）以便调用方收敛。"
      empty-action="恢复默认过滤"
      example-task="订阅 task.queued + approval.requested，验证审批回调链路"
      what="事件流订阅失败"
      why="Last-Event-ID 超出保留窗口（7 天）或订阅连接被限流（调用方 RPM 超限返回 429）"
      how="可重试；若为窗口超限，请调用 /tasks/{id}/result 重取全量结果后重建订阅"
      trace-id="trace-a2a-sub-4d0f22"
      @retry="state = 'LOADING'"
      @empty-action="selected = ['task.queued', 'task.started', 'phase.changed']; state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="活跃订阅" :value="subs.filter((s) => s.state === 'CONNECTED').length" unit="条" :target="3" target-kind="min" />
        <StatCard label="重连中" :value="subs.filter((s) => s.state === 'RECONNECTING').length" unit="条" :target="1" target-kind="max" />
        <StatCard label="事件投递 P95" :value="320" unit="ms" :target="500" target-kind="max" hint="目标 ≤ 500ms（跨网络）" />
        <StatCard label="过滤事件类型" :value="selected.length" unit="类" :target="11" target-kind="max" />
      </div>

      <div v-if="editing" class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">11 类外部事件过滤</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag
            v-for="t in allTypes"
            :key="t"
            size="small"
            :theme="selected.includes(t) ? 'primary' : 'default'"
            variant="light-outline"
            style="cursor: pointer"
            @click="toggle(t)"
          >
            {{ t }}
          </Tag>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          敏感事件（tool.summary / artifact.created）载荷已最小化：不含内部路径、提示词与工具完整输出。
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">订阅状态与续传点</div>
          <Table
            :data="subs"
            row-key="id"
            size="small"
            :columns="[
              { colKey: 'id', title: '订阅', width: 90 },
              { colKey: 'transport', title: '传输', width: 110 },
              { colKey: 'lastEventId', title: 'Last-Event-ID', width: 130 },
              { colKey: 'resumable', title: '可续传', width: 100 },
              { colKey: 'state', title: '状态', width: 120 },
            ]"
          >
            <template #transport="{ row }">
              <Tag size="small" variant="outline">{{ row.transport }}</Tag>
            </template>
            <template #resumable="{ row }">
              <Tag size="small" :theme="row.resumable ? 'success' : 'danger'" variant="light-outline">{{ row.resumable ? '可续传' : '不可续传' }}</Tag>
            </template>
            <template #state="{ row }">
              <Tooltip :content="row.note ?? `重连次数 ${row.reconnectCount}`">
                <Tag size="small" :theme="row.state === 'CONNECTED' ? 'success' : row.state === 'RECONNECTING' ? 'warning' : 'danger'" variant="light-outline">{{ row.state }}</Tag>
              </Tooltip>
            </template>
          </Table>
          <div class="oc-state__hint" style="margin-top: 6px">负样本：{{ subs[3].note }}</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">投递延迟（按 seq）</div>
          <OcChart type="line" :series="[{ name: '投递延迟', points: lag }]" :height="200" unit="ms" :threshold="{ value: 500, label: '目标上限 500ms' }" aria-label="事件投递延迟" />
          <CopyableId id="trace-a2a-sub-lag" label="复制 traceId" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">事件明细（过滤后）</div>
        <Table
          :data="filtered"
          row-key="seq"
          size="small"
          :columns="[
            { colKey: 'seq', title: 'seq', width: 100 },
            { colKey: 'type', title: '类型', width: 180 },
            { colKey: 'taskId', title: 'taskId', width: 120 },
            { colKey: 'payloadSummary', title: '载荷摘要' },
            { colKey: 'deliveredSubscribers', title: '订阅者', width: 100 },
          ]"
        >
          <template #type="{ row }">
            <Tag size="small" :theme="row.sensitive ? 'warning' : 'default'" variant="light-outline">{{ row.type }}</Tag>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
