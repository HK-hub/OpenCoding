<script setup lang="ts">
/** 调用时间线（T-04）：工具/参数摘要/资源/耗时/结果大小/外置/缓存/串行原因/预算影响。溯源：卷 05 §6 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcChart from '@/components/common/OcChart.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const router = useRouter();
const { toolCalls, tools, summary, decisions } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const status = ref('');
const toolName = ref('');
const pageSize = ref(16);
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '事件流订阅中断（tool.call.* 通道）'));

const riskOf = (name: string) => tools.find((t) => t.name === name)?.riskLevel ?? 'R0';
const decisionOf = (callId: string) => decisions.find((d) => d.callId === callId);

const rows = computed(() =>
  toolCalls
    .filter((c) => !status.value || c.status === status.value)
    .filter((c) => !toolName.value || c.toolName === toolName.value)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
);
const shown = computed(() => rows.value.slice(0, pageSize.value));

/** 预算影响：结果 token 折算成本（含缓存折扣） */
function costOf(row: { resultTokens: number; cacheHit: boolean }): number {
  const perToken = 0.000003;
  return Number((row.resultTokens * perToken * (row.cacheHit ? 0.25 : 1)).toFixed(4));
}

const latencySeries = computed(() => [
  {
    name: '耗时（ms）',
    points: shown.value.slice(0, 12).reverse().map((c) => ({ x: c.toolName.slice(0, 12), y: c.durationMs })),
  },
]);

const columns = [
  { colKey: 'callId', title: '调用 ID', width: 150 },
  { colKey: 'toolName', title: '工具 / 风险', width: 180 },
  { colKey: 'paramSummaryMasked', title: '参数摘要（脱敏）', ellipsis: true },
  { colKey: 'resourceDecls', title: '资源声明', width: 150 },
  { colKey: 'durationMs', title: '耗时', width: 92 },
  { colKey: 'result', title: '结果大小 / 外置', width: 160 },
  { colKey: 'cacheHit', title: '缓存', width: 84 },
  { colKey: 'serializedReason', title: '串行原因', width: 210 },
  { colKey: 'cost', title: '预算影响', width: 110 },
  { colKey: 'status', title: '状态', width: 130 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 240);
}

function openCall(ctx: { row: Record<string, unknown> }) {
  const callId = String(ctx.row.callId);
  ui.track('tool.call.open', { callId });
  router.push({ path: '/tools/call-detail', query: { call: callId } });
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="调用时间线"
      desc="每一次工具调用的事件级视图：参数摘要（已脱敏）、资源声明、耗时、结果大小与外置、缓存命中、因冲突串行的原因、预算影响。"
      volume="卷 05"
      manifest="T-04"
      cli="oc tools calls --since 2h --status failed,blocked --explain"
      :status="[{ label: '实时订阅 tool.call.*', theme: 'primary' }, { label: `24h ${summary.calls24h} 次`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="refresh">刷新</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="调用总数（24h）" :value="summary.calls24h" icon="task" :trend="[18, 22, 19, 27, 24, 31, 29, 34]" />
      <StatCard label="成功率" :value="summary.callSuccessRate" format="percent" icon="task-checked" :delta="1.2" :target="97" target-kind="min" />
      <StatCard label="缓存命中率" :value="summary.cacheHitRate" format="percent" icon="discount" hint="只读工具按参数 + 工作区版本键缓存" :delta="3.6" />
      <StatCard label="外置工件" :value="summary.externalizedCount" format="raw" icon="folder-open" hint="≥4k token 的结果转外置引用" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="status" size="small" clearable placeholder="调用状态" style="width: 170px" :options="['pending', 'validating', 'deciding', 'awaiting_approval', 'executing', 'completed', 'failed', 'blocked', 'cancelled'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <Select v-model="toolName" size="small" clearable placeholder="工具" style="width: 200px" :options="tools.map((t) => ({ label: t.name, value: t.name }))" @change="refresh" />
      <span class="oc-muted" style="font-size: 12px">时间线按开始时间倒序；点击行进入调用详情（结果 / 错误类别 / 决策引用 / 审计回放）</span>
    </div>

    <StateShell
      :state="state"
      empty-title="该窗口内没有工具调用"
      empty-desc="尚未观察到匹配的 tool.call.* 事件；可能是会话空闲或筛选过窄。"
      empty-action="清空筛选"
      example-task="运行一次单元测试并查看调用链"
      :what="`事件流订阅失败（tool.call.*）`"
      :why="err.message"
      how="已自动重连（退避上限 5 次）；恢复后时间线自动补齐，也可手动刷新。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 条调用记录，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 16; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="status = ''; toolName = ''; refresh()"
    >
      <div class="oc-card" style="margin-bottom: 12px">
        <h3 class="oc-card__title">最近 12 次调用耗时</h3>
        <OcChart type="line" :series="latencySeries" :height="170" format="number" unit="ms" aria-label="最近 12 次工具调用耗时" />
      </div>

      <Table row-key="callId" size="small" :data="shown" :columns="columns" :hover="true" @row-click="openCall">
        <template #callId="{ row }"><CopyableId :id="row.callId" label="复制调用 ID" :short="8" /></template>
        <template #toolName="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono">{{ row.toolName }}</span>
            <RiskBadge :level="riskOf(row.toolName)" />
          </div>
        </template>
        <template #paramSummaryMasked="{ row }">
          <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.paramSummaryMasked }}</span>
        </template>
        <template #resourceDecls="{ row }">
          <Tag v-for="r in row.resourceDecls" :key="r" size="small" variant="light-outline" style="margin: 1px">{{ r }}</Tag>
        </template>
        <template #durationMs="{ row }">
          <span>{{ row.durationMs ? `${row.durationMs} ms` : '—' }}</span>
        </template>
        <template #result="{ row }">
          <span>{{ (row.resultSizeBytes / 1024).toFixed(1) }} KB / {{ row.resultTokens }}t</span>
          <Tooltip v-if="row.externalized" :content="`已外置：${row.artifactRef}`">
            <Tag size="small" theme="warning" variant="light-outline" style="margin-left: 4px">外置</Tag>
          </Tooltip>
        </template>
        <template #cacheHit="{ row }">
          <Tag v-if="row.cacheHit" size="small" theme="success" variant="light-outline">命中</Tag>
          <span v-else class="oc-muted">—</span>
        </template>
        <template #serializedReason="{ row }">
          <Tooltip v-if="row.serializedReason" :content="row.serializedReason">
            <Tag size="small" theme="warning" variant="light-outline">串行</Tag>
          </Tooltip>
          <Tag v-else size="small" variant="light-outline">并行</Tag>
        </template>
        <template #cost="{ row }">
          <span class="oc-mono">${{ costOf(row) }}</span>
        </template>
        <template #status="{ row }">
          <Tag
            size="small"
            variant="light-outline"
            :theme="row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'blocked' ? 'warning' : row.status === 'awaiting_approval' ? 'primary' : 'default'"
          >
            {{ row.status }}
          </Tag>
          <Tooltip v-if="decisionOf(row.callId)" :content="`决策 ${decisionOf(row.callId)?.decision}｜${decisionOf(row.callId)?.reason}`">
            <Tag size="small" variant="outline" theme="default" style="margin-left: 4px">决策可解释</Tag>
          </Tooltip>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
