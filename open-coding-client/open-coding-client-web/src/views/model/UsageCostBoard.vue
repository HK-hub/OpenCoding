<script setup lang="ts">
/**
 * 用量与成本看板（M-12 / 卷 31 §4.3，S-13）：
 * 六维归因切换（租户/项目/会话/任务/团队/模型）+ 缓存折扣单列 + 异常标记（偏离基线 > 50%）+
 * 延迟分解（TTFB / 总耗时） + 下钻到单次调用。金额在缺少 cost.read 时用掩码显示并给出申请路径。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, RadioGroup, RadioButton, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import type { InfoItem } from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtCost, fmtToken, fmtUsd, waterTheme, type PageState } from '@/components/gateway/types';
import { modelData } from '@/mock/data/model';
import type { UsageDimensionKey, UsageRowData } from '@/mock/data/model';
import { downloadCsv } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const dimension = ref<UsageDimensionKey>('model');
const maskAmounts = ref(false);
const drill = ref<UsageRowData | null>(null);
const drawerOpen = ref(false);

const meta = computed(() => data.usageDimensionMeta.find((d) => d.key === dimension.value)!);
const rows = computed(() => data.usageRows.filter((r) => r.dimension === dimension.value));
const dimensionTotal = computed(() => rows.value.reduce((a, b) => a + b.costUsd, 0));
const anomalies = computed(() => data.usageRows.filter((r) => r.anomaly));
const waterPct = computed(() => (data.usageTotals.costUsd / data.usageTotals.budgetUsd) * 100);
const avgCost = computed(() => data.usageTotals.costUsd / data.usageTotals.calls);
const sessionRemainder = computed(() => {
  if (dimension.value !== 'session') return null;
  return data.usageTotals.costUsd - dimensionTotal.value;
});

const money = (v: number) => (maskAmounts.value ? '••••（需 cost.read）' : fmtUsd(v));
const moneyPrecise = (v: number) => (maskAmounts.value ? '••••' : fmtCost(v));

const columns: PrimaryTableCol[] = [
  { colKey: 'label', title: '归因键', width: 220 },
  { colKey: 'cost', title: '成本（缓存折扣单列）', width: 240 },
  { colKey: 'tokens', title: 'token（入 / 出 / 缓存读）', width: 240 },
  { colKey: 'cachePct', title: '缓存读占比', width: 140 },
  { colKey: 'delta', title: '相对基线', width: 150 },
  { colKey: 'anomaly', title: '异常标记（>50%）', width: 160 },
  { colKey: 'drill', title: '下钻', width: 110 },
];

const drillItems = computed<InfoItem[]>(() => {
  if (!drill.value) return [];
  return [
    { key: 'dim', label: '归因维度', value: `${meta.value.label} · ${drill.value.key}` },
    { key: 'calls', label: '调用次数', value: drill.value.calls.toLocaleString('zh-CN') },
    { key: 'cost', label: '成本合计', value: money(drill.value.costUsd) },
    { key: 'saved', label: '缓存折扣（节省）', value: money(drill.value.cacheSavedUsd) },
    { key: 'in', label: '输入 token', value: fmtToken(drill.value.inputTokens) },
    { key: 'out', label: '输出 token', value: fmtToken(drill.value.outputTokens) },
    { key: 'cr', label: '缓存读 token', value: fmtToken(drill.value.cacheReadTokens) },
    { key: 'cw', label: '缓存写 token', value: fmtToken(drill.value.cacheWriteTokens) },
    { key: 'note', label: '备注', value: drill.value.anomalyNote || drill.value.note || '—', span: 2 },
  ];
});

const drillCalls = computed(() => {
  const ids = drill.value?.drillCallIds ?? [];
  return data.callAuditRecords.filter((c) => ids.includes(c.id));
});

const latencyColumns: PrimaryTableCol[] = [
  { colKey: 'stage', title: '阶段', width: 200 },
  { colKey: 'p50', title: 'P50', width: 110 },
  { colKey: 'p95', title: 'P95', width: 110 },
  { colKey: 'share', title: '占总耗时', width: 120 },
  { colKey: 'note', title: '说明' },
];

const latencyRows = computed(() =>
  data.latencyBreakdown.map((s) => ({ id: s.stage, stage: s.stage, p50: `${s.p50Ms}ms`, p95: `${s.p95Ms}ms`, share: `${s.sharePct}%`, note: s.note })),
);

const ttfbRows = computed(() =>
  data.latencyBreakdown
    .filter((s) => ['预算守卫', '限流检查', '脱敏', '凭证注入', '上游首字节（TTFB）'].includes(s.stage))
    .map((s) => ({ name: s.stage, value: s.p50Ms })),
);

function openDrill(row: UsageRowData) {
  drill.value = row;
  drawerOpen.value = true;
}

/** 导出成本明细 CSV：当前归因维度的行明细 + 汇总；金额列按当前权限口径（掩码开关）输出 */
function exportDetail() {
  const header = ['归因键', '标签', '调用次数', '输入token', '输出token', '缓存读token', '缓存写token', '成本', '缓存折扣', '缓存读占比%', '相对基线%', '异常', '异常说明'];
  const body = rows.value.map((r) => [
    r.key,
    r.label,
    r.calls,
    r.inputTokens,
    r.outputTokens,
    r.cacheReadTokens,
    r.cacheWriteTokens,
    // 金额列走与界面相同的口径：缺 cost.read 时输出掩码而非估算值，避免误导预算决策
    money(r.costUsd),
    money(r.cacheSavedUsd),
    r.cacheReadPct,
    r.deltaPct,
    r.anomaly ? '偏离 >50%' : '',
    r.anomalyNote,
  ]);
  const summary: (string | number)[][] = [
    [],
    ['维度合计', meta.value.label, '', '', '', '', '', money(dimensionTotal.value)],
    ['观察窗（天）', data.usageTotals.windowDays],
    ['预算水位%', waterPct.value.toFixed(1)],
    ['金额列口径', maskAmounts.value ? '已掩码（缺 cost.read，仅显示掩码符）' : '完整金额（具备 cost.read）'],
  ];
  const file = downloadCsv([header, ...body, ...summary], `oc-model-usage-cost-${dimension.value}-${new Date().toISOString().slice(0, 10)}.csv`);
  MessagePlugin.success(`已导出成本明细：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = rows.value.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="用量与成本看板"
      desc="六维归因（租户/项目/会话/任务/团队/模型）+ 缓存折扣单列 + 延迟分解。任一维度都可下钻到单次调用（含缓存命中标记），误差目标 ≤1%。"
      volume="卷 31"
      manifest="M-12"
      cli="oc model usage report --dimension model --window 30d --drill call-9f2a-08"
      :status="[{ label: `观察窗 ${data.usageTotals.windowDays} 天`, theme: 'default' }, { label: `异常 ${anomalies.length} 处`, theme: anomalies.length ? 'warning' : 'success' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Tooltip content="无 cost.read 权限时金额自动掩码；本开关用于演示屏蔽效果（跟随只读分享视图口径）">
          <span class="oc-flex" style="gap: 4px">金额屏蔽 <Switch v-model="maskAmounts" size="small" /></span>
        </Tooltip>
        <Button size="small" variant="outline" @click="exportDetail">导出明细</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="30 天成本合计" :value="maskAmounts ? '已掩码' : data.usageTotals.costUsd" :format="maskAmounts ? 'raw' : 'cost'" icon="discount" :delta="data.usageTotals.deltaPct" :target="data.usageTotals.budgetUsd" target-kind="max" :hint="`预算 ${money(data.usageTotals.budgetUsd)} · 水位 ${waterPct.toFixed(1)}%`" />
      <StatCard label="缓存折扣（节省）" :value="maskAmounts ? '已掩码' : data.usageTotals.cacheSavedUsd" :format="maskAmounts ? 'raw' : 'cost'" icon="refresh" hint="缓存折扣单列：净节省已扣除缓存写溢价，不并入主成本" />
      <StatCard label="预算水位" :value="waterPct" format="percent" icon="secured" :target="80" target-kind="max" :hint="'水位 ≥80% 告警、≥90% 阻断高成本新任务（保留人工会话）'" />
      <StatCard label="平均单次调用成本" :value="maskAmounts ? '已掩码' : avgCost" :format="maskAmounts ? 'raw' : 'cost'" icon="api" :hint="`调用 ${data.usageTotals.calls.toLocaleString('zh-CN')} 次 · 缓存读占比 ${data.usageTotals.cacheReadPct}%`" />
    </div>

    <StateShell
      :state="state"
      empty-title="该维度暂无用量"
      empty-desc="选定维度下没有归因数据；可能观察窗内没有调用，或归因标签未上报。"
      empty-action="切换到「模型」维度"
      what="成本看板加载失败"
      why="计量数据源不可达；金额类字段在恢复前不展示估算值（避免误导预算决策）。"
      how="可重试；已确认的调用仍会补写 usage 事件，恢复后自动补齐。"
      trace-id="trace-usage-7a11"
      missing-permission="cost.read"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」申请 cost.read（金额可见性权限；未获授权时页面仅显示掩码与百分比）"
      @retry="state = 'LOADING'"
      @empty-action="dimension = 'model'"
    >
      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 6px">
        <RadioGroup v-model="dimension" variant="default-filled" size="small">
          <RadioButton v-for="d in data.usageDimensionMeta" :key="d.key" :value="d.key">{{ d.label }}</RadioButton>
        </RadioGroup>
        <span class="oc-muted" style="font-size: 12px">{{ meta.label }}维度回答问题：{{ meta.question }}（{{ meta.note }}）</span>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">
            <span>30 天成本与缓存节省</span>
            <span class="oc-muted" style="font-size: 12px">异常日（偏离基线 &gt;50%）保持真实抬升，不做平滑</span>
          </div>
          <OcChart type="area" format="cost" :height="200" :series="data.costSeries.slice(0, 2)" :threshold="{ value: data.usageTotals.budgetUsd / 30, label: '日均预算线', kind: 'max' }" aria-label="30 天成本曲线" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">
            <span>预算水位（累计）</span>
            <Tooltip content="水位 ≥80% 告警：通知 + 降级可用；≥90% 阻断高成本新任务（人工会话保留）">
              <span class="oc-muted" style="font-size: 12px">阈值 80 / 90</span>
            </Tooltip>
          </div>
          <OcChart type="line" format="percent" :height="200" :series="[data.costSeries[2]]" :threshold="{ value: 80, label: '告警水位 80%', kind: 'max' }" aria-label="预算水位曲线" />
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>归因明细 · {{ meta.label }}</span>
          <span class="oc-muted" style="font-size: 12px">
            本维度合计 {{ money(dimensionTotal) }}
            <template v-if="sessionRemainder !== null">；会话维度为 Top-N 下钻，其余会话合计 {{ money(sessionRemainder) }}</template>
          </span>
        </div>
        <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="{ pageSize: 10, total: rows.length }">
          <template #label="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <b>{{ row.label }}</b>
              <span class="oc-mono oc-muted" style="font-size: 12px">{{ row.key }}</span>
            </div>
          </template>
          <template #cost="{ row }">
            <div class="oc-stack" style="gap: 2px; font-size: 12px">
              <span>成本 {{ money(row.costUsd) }}</span>
              <span class="oc-muted">缓存折扣 −{{ money(row.cacheSavedUsd) }}</span>
            </div>
          </template>
          <template #tokens="{ row }">
            <span class="oc-mono" style="font-size: 12px">{{ fmtToken(row.inputTokens) }} / {{ fmtToken(row.outputTokens) }} / {{ fmtToken(row.cacheReadTokens) }}</span>
          </template>
          <template #cachePct="{ row }">
            <Tag :theme="row.cacheReadPct >= 70 ? 'success' : row.cacheReadPct >= 40 ? 'warning' : 'default'" size="small" variant="light-outline">{{ row.cacheReadPct }}%</Tag>
          </template>
          <template #delta="{ row }">
            <span :style="{ color: row.deltaPct > 0 ? 'var(--oc-sev-error)' : 'var(--oc-sev-ok)' }">
              {{ row.deltaPct > 0 ? '▲' : '▼' }} {{ Math.abs(row.deltaPct).toFixed(1) }}%
            </span>
          </template>
          <template #anomaly="{ row }">
            <Tooltip v-if="row.anomaly" :content="row.anomalyNote">
              <Tag theme="danger" size="small" variant="light-outline">偏离 &gt;50%</Tag>
            </Tooltip>
            <span v-else class="oc-muted">—</span>
          </template>
          <template #drill="{ row }">
            <Button size="small" variant="text" @click="openDrill(row as UsageRowData)">下钻</Button>
          </template>
        </Table>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>延迟分解（TTFB / 总耗时）</span>
          <span class="oc-muted" style="font-size: 12px">装饰器链自身开销计入前 4 段；门面 + 链路目标 ≤15ms（P95）</span>
        </div>
        <OcChart type="waterfall" format="number" unit="ms" :values="ttfbRows" :height="180" aria-label="首字节延迟分解" />
        <Table :data="latencyRows" :columns="latencyColumns" row-key="id" size="small" :pagination="{ pageSize: 8, total: latencyRows.length }" />
      </div>

      <Drawer v-model:visible="drawerOpen" :header="`下钻 · ${drill?.label ?? ''}`" size="560px" :footer="false">
        <InfoGrid :items="drillItems" :columns="2" />
        <div class="oc-divider" />
        <div class="oc-card__title">单次调用（可继续下钻到调用审计）</div>
        <div v-if="drillCalls.length" class="oc-stack">
          <div v-for="c in drillCalls" :key="c.id" class="oc-card" style="padding: 8px 10px">
            <div class="oc-flex--between">
              <CopyableId :id="c.traceId" label="复制 traceId" short="26" />
              <span class="oc-flex" style="gap: 6px">
                <Tag :theme="c.status === 'succeeded' ? 'success' : c.status === 'cancelled' ? 'default' : 'danger'" size="small" variant="light-outline">{{ c.status }}</Tag>
                <span style="font-size: 12px">{{ moneyPrecise((c.usage.inputTokens / 1_000_000) * 3 + (c.usage.outputTokens / 1_000_000) * 15) }}</span>
              </span>
            </div>
            <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
              {{ c.modelId }} · 输入 {{ fmtToken(c.usage.inputTokens) }} / 输出 {{ fmtToken(c.usage.outputTokens) }} · TTFB {{ c.usage.ttfbMs }}ms / 总 {{ c.usage.totalMs }}ms
            </div>
          </div>
        </div>
        <div v-else class="oc-muted" style="font-size: 13px">该归因键未记录可下钻的调用样本；可到「调用审计」按维度筛选。</div>
      </Drawer>
    </StateShell>
  </div>
</template>
