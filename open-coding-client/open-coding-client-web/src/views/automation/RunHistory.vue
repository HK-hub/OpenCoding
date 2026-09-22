<script setup lang="ts">
/**
 * 运行历史（N2-07）：多维筛选（模板 / 终态 / 触发源）+ 结果趋势 + 运行表。
 * 溯源：卷 34 §5.5/§7；BUILD-MANIFEST N2-07。
 * 幂等语义：DEDUPLICATED 必须能解释「为什么没跑」（去重窗口 + 首次 runId）。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import { automationData } from '@/mock/data/automation';
import type { RunStatus } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

const tplFilter = ref('全部');
const statusFilter = ref<'全部' | RunStatus>('全部');
const keyword = ref('');

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'OFFLINE', 'PERMISSION_DENIED', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onTpl(v: unknown) {
  tplFilter.value = String(v);
}
function onStatus(v: unknown) {
  statusFilter.value = String(v) as '全部' | RunStatus;
}

const rows = computed(() =>
  automationData.runs.filter((r) => {
    if (tplFilter.value !== '全部' && r.templateId !== tplFilter.value) return false;
    if (statusFilter.value !== '全部' && r.status !== statusFilter.value) return false;
    const kw = keyword.value.trim();
    if (kw && !`${r.runId} ${r.templateName} ${r.triggerSource} ${r.idempotencyKey}`.toLowerCase().includes(kw.toLowerCase())) return false;
    return true;
  }),
);

const counts = computed(() => {
  const c: Record<string, number> = {};
  rows.value.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
  return c;
});
const totalCost = computed(() => rows.value.reduce((a, r) => a + r.costUsd, 0));
const takeoverCount = computed(() => rows.value.filter((r) => r.status === 'ESCALATED' || r.status === 'BLOCKED').length);

/** 终态分布（donut）与近 12 次运行成本（bar） */
const statusValues = computed(() => Object.entries(counts.value).map(([name, value]) => ({ name, value })));
const costSeries = computed(() => [{
  name: '运行成本（USD）',
  points: rows.value.slice(0, 12).reverse().map((r) => ({ x: r.runId.replace('run-', '#'), y: Number(r.costUsd.toFixed(2)) })),
}]);

const columns = [
  { colKey: 'runId', title: '运行', width: 120, cell: 'id' },
  { colKey: 'templateName', title: '模板', width: 160 },
  { colKey: 'triggerSource', title: '触发源', width: 250, ellipsis: true },
  { colKey: 'idempotencyKey', title: '幂等键 / 去重', width: 230, cell: 'idem' },
  { colKey: 'status', title: '终态', width: 130, cell: 'status' },
  { colKey: 'costUsd', title: '成本', width: 90, cell: 'cost' },
  { colKey: 'duration', title: '耗时', width: 100, cell: 'dur' },
  { colKey: 'artifacts', title: '产物', width: 90, cell: 'art' },
  { colKey: 'op', title: '操作', width: 90, cell: 'op' },
];

const STATUS_THEME: Record<RunStatus, 'success' | 'warning' | 'danger' | 'primary' | 'default'> = {
  SUCCEEDED: 'success', FAILED: 'danger', ESCALATED: 'warning', BLOCKED: 'warning',
  DEDUPLICATED: 'default', RUNNING: 'primary', VERIFYING: 'primary', QUEUED: 'default', CANCELLED: 'default',
};

onMounted(() => {
  window.setTimeout(() => (demo.value = automationData.runs.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="运行历史"
      desc="触发源 / 幂等键 / 终态 / 成本 / 耗时 / 产物；DEDUPLICATED 给出命中的历史运行，解释「为什么没跑」。"
      volume="卷 34" manifest="N2-07" cli="oc automation run list --status all --with-idempotency"
      :status="[{ label: `${rows.length} 条运行`, theme: 'default' }, { label: `${takeoverCount} 条需接管`, theme: takeoverCount ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="tplFilter" size="small" style="width: 190px" aria-label="按模板筛选" :options="[{ value: '全部', label: '全部模板' }, ...automationData.templates.map((t) => ({ value: t.id, label: t.name }))]" @change="onTpl" />
        <Select :value="statusFilter" size="small" style="width: 170px" aria-label="按终态筛选" :options="['全部', 'SUCCEEDED', 'FAILED', 'ESCALATED', 'BLOCKED', 'DEDUPLICATED', 'RUNNING', 'VERIFYING', 'QUEUED', 'CANCELLED'].map((s) => ({ value: s, label: s }))" @change="onStatus" />
        <Input v-model="keyword" size="small" style="width: 180px" placeholder="搜索运行 id / 触发源" clearable />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在拉取运行账本（按月分区）…"
      empty-title="该条件下没有运行" empty-desc="换一个模板或终态筛选；DEDUPLICATED 与 BLOCKED 运行不消耗预算。"
      empty-action="清空筛选" example-task="查看近 7 天全部 ESCALATED 运行并进入接管工作台"
      :disabled-capabilities="['调度触发', '手动运行']" what="运行账本加载失败"
      why="运行存储查询超时（账本按月分区，跨月查询代价高）" how="缩小时间范围后重试；运行终态通知仍会投递（接管请求不静默）" trace-id="trace-0c93be44"
      :collapsed-summary="`运行较多（${rows.length} 条），已折叠展示（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="tplFilter = '全部'; statusFilter = '全部'; keyword = ''" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="运行总数" :value="rows.length" icon="history" hint="含 DEDUPLICATED / BLOCKED（不消耗预算）" />
        <StatCard label="成功率" :value="rows.length ? ((counts.SUCCEEDED ?? 0) / rows.length) * 100 : 0" format="percent" icon="check" :delta="2.4" :lower-is-better="false" :target="80" hint="达标线 80%（可在实例中覆盖）" />
        <StatCard label="成本合计" :value="totalCost" format="cost" icon="discount" :delta="-6.1" :target="60" hint="含模型与工具调用成本" />
        <StatCard label="需接管" :value="takeoverCount" icon="error" :lower-is-better="true" hint="ESCALATED + BLOCKED；固定「需处理」且不可静默" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">终态分布（九态运行机）</div>
          <OcChart type="donut" :values="statusValues" :height="200" aria-label="运行终态分布" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">近 12 次运行成本（USD）</div>
          <OcChart type="bar" :series="costSeries" :height="200" format="cost" unit="USD" aria-label="运行成本趋势" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">超预算即停并保留已完成部分；DEDUPLICATED / BLOCKED 为 0 成本。</div>
        </div>
      </div>

      <Table :data="rows" :columns="columns" row-key="runId" size="small" :pagination="undefined">
        <template #id="{ row }">
          <Button size="small" variant="text" @click="router.push(`/automation/runs/${row.runId}`)"><span class="oc-mono">{{ row.runId }}</span></Button>
        </template>
        <template #idem="{ row }">
          <div class="oc-stack" style="gap: 0">
            <span class="oc-mono" style="font-size: 11px">{{ row.idempotencyKey }}</span>
            <span v-if="row.status === 'DEDUPLICATED'" class="oc-muted" style="font-size: 11px">
              命中 {{ row.dedupWindow }} → 复用于 <span class="oc-mono">{{ row.deduplicatedOf }}</span>
            </span>
          </div>
        </template>
        <template #status="{ row }">
          <Tag size="small" :theme="STATUS_THEME[row.status as RunStatus]" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #cost="{ row }">${{ row.costUsd.toFixed(2) }}</template>
        <template #dur="{ row }">{{ row.endedAt ? `${Math.max(1, Math.round((new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime()) / 60000))}min` : '进行中' }}</template>
        <template #art="{ row }">{{ row.artifacts.length }} 个</template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="router.push(`/automation/runs/${row.runId}`)">详情</Button>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
