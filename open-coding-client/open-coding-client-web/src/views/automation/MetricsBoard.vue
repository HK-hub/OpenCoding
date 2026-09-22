<script setup lang="ts">
/**
 * 自动化度量看板（N2-11）：四指标（节省人力时长 / 发现问题数 / 产物采纳率 / 单位成本）+ 数据缺口标注。
 * 溯源：卷 34 §5.8 / §7；BUILD-MANIFEST N2-11。
 * 原则：数据不全时标注缺口（估算必须显式标注），不静默。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const board = automationData.metricsBoard;

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const sortBy = ref<'saved' | 'findings' | 'adopt' | 'unit'>('saved');
const rows = computed(() => {
  const list = [...board.byTemplate];
  if (sortBy.value === 'saved') return list.sort((a, b) => b.savedHours - a.savedHours);
  if (sortBy.value === 'findings') return list.sort((a, b) => b.findings - a.findings);
  if (sortBy.value === 'adopt') return list.sort((a, b) => b.adoptRatio - a.adoptRatio);
  return list.sort((a, b) => a.unitCost - b.unitCost);
});
function onSort(v: unknown) {
  sortBy.value = String(v) as typeof sortBy.value;
}

const columns = [
  { colKey: 'templateName', title: '模板', width: 160 },
  { colKey: 'runs', title: '运行次数', width: 100 },
  { colKey: 'savedHours', title: '节省人力时长', width: 160, cell: 'saved' },
  { colKey: 'findings', title: '发现问题数', width: 120 },
  { colKey: 'adoptRatio', title: '产物采纳率', width: 130, cell: 'adopt' },
  { colKey: 'unitCost', title: '单位成本', width: 130, cell: 'unit' },
  { colKey: 'gap', title: '数据缺口', cell: 'gap' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="自动化度量"
      desc="四指标：① 节省人力时长（任务基准 × 完成次数）② 发现问题数（按类型与严重度）③ 产物采纳率 ④ 单位成本。"
      volume="卷 34" manifest="N2-11" cli="oc automation metrics --window 30d --group-by template"
      :status="[{ label: '含数据缺口标注', theme: 'warning' }, { label: '采集经 AutomationMetricsSPI', theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="sortBy" size="small" style="width: 170px" aria-label="排序" :options="[{ value: 'saved', label: '按节省时长' }, { value: 'findings', label: '按发现问题数' }, { value: 'adopt', label: '按采纳率' }, { value: 'unit', label: '按单位成本' }]" @change="onSort" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在聚合四指标（按月分区，度量聚合保留 3 年）…"
      empty-title="暂无度量数据" empty-desc="度量采集需要至少一次成功运行；企业可强制关闭遥测（缺口标记仍本地保留）。"
      empty-action="查看运行历史" example-task="对比「依赖升级」与「技术债巡检」的单位成本，找出 ROI 最高的模板"
      what="度量聚合失败" why="外部制指标源（AutomationMetricsSPI 扩展）不可用" how="重试；指标缺口不影响运行主链路（采集失败为有意吞异常 + WARN）" trace-id="trace-1de9c46b"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard
          v-for="k in board.kpis" :key="k.key"
          :label="k.label" :value="k.value" :unit="k.unit" :format="k.format"
          :delta="k.delta" :target="k.target" :target-kind="k.targetKind" icon="chart-bar" :hint="k.hint"
        />
      </div>

      <Alert v-if="board.dataGaps.length" theme="warning" style="margin: 12px 0"
        :message="`数据缺口（${board.dataGaps.length} 项，已在单元格与本条显式标注，不静默）：${board.dataGaps.join('；')}`" />

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">发现问题按类型（近 30 天）</div>
          <OcChart type="donut" :values="board.findingsByType" :height="210" aria-label="发现问题类型分布" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">发现问题按严重度</div>
          <OcChart type="bar" :values="board.findingsBySeverity" :height="210" unit="项" aria-label="发现问题严重度分布" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">error 类发现必须在报告中单独列出并绑定修复建议。</div>
        </div>
      </div>

      <div class="oc-card" style="margin: 12px 0">
        <div class="oc-card__title">节省时长与发现问题数趋势（近 7 周）<CliHint command="oc automation metrics --window 7w --trend" /></div>
        <OcChart type="line" :series="board.trend" :height="230" :aria-label="'自动化指标趋势'" />
      </div>

      <Table :data="rows" :columns="columns" row-key="templateId" size="small" :pagination="undefined">
        <template #saved="{ row }">
          <span>{{ row.savedHours }} h</span>
          <Tag v-if="row.savedHoursEstimated" size="small" theme="warning" variant="light-outline" style="margin-left: 6px">估算</Tag>
        </template>
        <template #adopt="{ row }"><span :style="{ color: row.adoptRatio < 0.5 ? 'var(--oc-sev-warn)' : undefined }">{{ (row.adoptRatio * 100).toFixed(0) }}%</span></template>
        <template #unit="{ row }">${{ row.unitCost.toFixed(2) }}</template>
        <template #gap="{ row }">
          <span v-if="row.savedHoursEstimated" class="oc-muted" style="font-size: 12px">缺基准样本，节省时长按中位数估算</span>
          <span v-else class="oc-muted" style="font-size: 12px">—</span>
        </template>
      </Table>

      <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
        单位成本口径：成本 ÷ 有效产出（采纳的 PR / 被引用的报告）；「有效产出」计数在 3 个模板中缺基准，已在 KPI 卡标注。
      </div>
    </StateShell>
  </div>
</template>
