<script setup lang="ts">
/**
 * 在线指标（Y-03）：8 项核心指标（任务完成率 / 平均任务成本 / 首 token 延迟 P95 / 工具调用成功率 /
 * 审批打扰率 / 用户采纳率 / 回退率 / 满意度）+ 目标线与 14 天 sparkline 趋势 + 当前 vs 基线对照 + 异常高亮。
 * 溯源：卷 26 / BUILD-MANIFEST Y-03。
 */
import { computed, onMounted, ref } from 'vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import { Button, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { downloadJson } from '@/utils/download';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 在线指标定义：threshold.targetValue 为达标线（kind=min 表示越大越好） */
interface OnlineMetric {
  key: string; name: string; current: number; baseline: number; targetText: string; targetValue: number;
  kind: 'min' | 'max'; fmt: 'percent' | 'cost' | 'number'; unit: string; trend: number[]; note: string; cause?: string;
}

const DAYS = ['08-30', '08-31', '09-01', '09-02', '09-03', '09-04', '09-05', '09-06', '09-07', '09-08', '09-09', '09-10', '09-11', '09-12'];

const METRICS: OnlineMetric[] = [
  { key: 'completion', name: '任务完成率', current: 87.5, baseline: 86.0, targetText: '≥ 基线', targetValue: 86.0, kind: 'min', fmt: 'percent', unit: '%', trend: [85.1, 85.4, 85.8, 86.0, 85.7, 86.2, 86.4, 86.1, 86.6, 86.9, 87.1, 87.0, 87.4, 87.5], note: '口径：任务级终态为成功 / 总终态任务数（不含取消）' },
  { key: 'cost', name: '平均任务成本', current: 0.0788, baseline: 0.08, targetText: '≤ 基线', targetValue: 0.08, kind: 'max', fmt: 'cost', unit: 'USD', trend: [0.082, 0.081, 0.081, 0.08, 0.0808, 0.0799, 0.0802, 0.0801, 0.0795, 0.0798, 0.0792, 0.0791, 0.0789, 0.0788], note: '口径：缓存折扣后的单位任务成本（含重试消耗）' },
  { key: 'ttft', name: '首 token 延迟 P95', current: 1.72, baseline: 1.45, targetText: '≤ 1.5s', targetValue: 1.5, kind: 'max', fmt: 'number', unit: 's', trend: [1.41, 1.44, 1.46, 1.43, 1.48, 1.52, 1.55, 1.58, 1.62, 1.66, 1.69, 1.71, 1.73, 1.72], note: '口径：网关侧首字节出流 P95（不含排队与审批等待）', cause: '模型端点切换后长提示词冷启动变长；已启用前缀缓存，需观察 2 个窗口' },
  { key: 'tool', name: '工具调用成功率', current: 97.6, baseline: 98.4, targetText: '≥ 98%', targetValue: 98, kind: 'min', fmt: 'percent', unit: '%', trend: [98.5, 98.4, 98.6, 98.2, 98.3, 98.1, 98.2, 97.9, 98.0, 97.8, 97.7, 97.8, 97.5, 97.6], note: '口径：工具调用成功 / 总调用（超时与参数错误均计入失败）', cause: '沙箱冷启动超时占比升高（约 1.1% 调用命中 30s 上限），已调整预热策略' },
  { key: 'interrupt', name: '审批打扰率', current: 5.9, baseline: 6.8, targetText: '≤ 基线', targetValue: 6.8, kind: 'max', fmt: 'percent', unit: '%', trend: [6.9, 6.8, 6.7, 6.8, 6.6, 6.5, 6.4, 6.3, 6.2, 6.1, 6.0, 6.1, 5.9, 5.9], note: '口径：每百次任务的审批打断次数（含批量合并后的计一次）' },
  { key: 'adoption', name: '用户采纳率', current: 64.8, baseline: 63.0, targetText: '≥ 基线', targetValue: 63.0, kind: 'min', fmt: 'percent', unit: '%', trend: [62.5, 62.9, 63.0, 62.8, 63.2, 63.4, 63.1, 63.6, 63.9, 64.1, 64.0, 64.4, 64.6, 64.8], note: '口径：采纳（含微调后采纳）的产物 / 生成的产物总数' },
  { key: 'rollback', name: '回退率', current: 2.6, baseline: 2.9, targetText: '≤ 基线', targetValue: 2.9, kind: 'max', fmt: 'percent', unit: '%', trend: [3.0, 2.9, 2.9, 2.8, 2.9, 2.8, 2.7, 2.8, 2.7, 2.7, 2.6, 2.7, 2.6, 2.6], note: '口径：产物被用户回退 / 生成总数（回退原因强制登记）' },
  { key: 'satisfaction', name: '满意度', current: 4.3, baseline: 4.1, targetText: '≥ 4/5', targetValue: 4, kind: 'min', fmt: 'number', unit: '分', trend: [4.0, 4.1, 4.1, 4.0, 4.1, 4.2, 4.1, 4.2, 4.2, 4.3, 4.2, 4.3, 4.3, 4.3], note: '口径：任务结束回访 5 分制均值（回访完成率 ≥60%）' },
];

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const selected = ref('ttft');
const pageSize = ref(6);
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '指标存储查询超时（metrics-rollup 分片 3 响应 12s）'));

/** 达标判定：kind=min → 越大越好；kind=max → 越小越好 */
function pass(m: OnlineMetric): boolean {
  return m.kind === 'min' ? m.current >= m.targetValue : m.current <= m.targetValue;
}
function display(m: OnlineMetric): string {
  return m.fmt === 'cost' ? `$${m.current.toFixed(4)}` : m.fmt === 'percent' ? `${m.current}%` : `${m.current} ${m.unit}`;
}
function displayBase(m: OnlineMetric): string {
  return m.fmt === 'cost' ? `$${m.baseline.toFixed(4)}` : m.fmt === 'percent' ? `${m.baseline}%` : `${m.baseline} ${m.unit}`;
}
const abnormal = computed(() => METRICS.filter((m) => !pass(m)));
/** 表格列：显式声明，判定与操作列为派生列（不依赖数据结构） */
const metricColumns = [
  { colKey: 'name', title: '指标', width: 170 },
  { colKey: 'current', title: '当前值', width: 120 },
  { colKey: 'baseline', title: '基线', width: 120 },
  { colKey: 'targetText', title: '目标线', width: 110 },
  { colKey: 'verdict', title: '判定', width: 90 },
  { colKey: 'ops', title: '趋势', width: 80 },
];
const active = computed(() => METRICS.find((m) => m.key === selected.value) ?? METRICS[0]);
const shown = computed(() => METRICS.slice(0, pageSize.value));
const sparkPoints = computed(() => active.value.trend.map((v, i) => ({ x: DAYS[i], y: v })));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = METRICS.length > pageSize.value ? 'EDGE_DATA' : METRICS.length ? 'NORMAL' : 'EMPTY'; }, 240);
}

function exportSnapshot() {
  const file = downloadJson({ window: '近 14 天', abnormal: abnormal.value.map((m) => m.key), metrics: METRICS }, `oc-online-metrics-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`指标快照已导出：${file}（异常 ${abnormal.value.length} 项已标注原因）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader title="在线指标" desc="8 项在线指标对照目标线与基线：任一未达标即高亮并给出原因；指标口径冻结，变更需经评审（防止用口径调整粉饰趋势）。" volume="卷 26" manifest="Y-03" cli="oc quality metrics --window 14d --compare-baseline --alert-only" :status="[{ label: `达标 ${METRICS.length - abnormal.length} / ${METRICS.length}`, theme: abnormal.length ? 'warning' : 'success' }, { label: `异常 ${abnormal.length} 项`, theme: abnormal.length ? 'danger' : 'success' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="exportSnapshot">导出指标快照</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="任务完成率" :value="87.5" format="percent" :target="86" target-kind="min" icon="check" hint="≥ 基线 86.0%" />
      <StatCard label="平均任务成本" :value="0.0788" format="cost" unit="USD" :target="0.08" target-kind="max" icon="discount" hint="≤ 基线 $0.0800" />
      <StatCard label="审批打扰率" :value="5.9" format="percent" :target="6.8" target-kind="max" icon="notification" hint="≤ 基线 6.8%，越小越好" />
      <StatCard label="异常指标" :value="abnormal.length" format="number" unit="项" icon="error" :lower-is-better="true" hint="首字延迟 P95 与工具成功率未达标" />
    </div>

    <StateShell :state="state" empty-title="该窗口没有在线指标" empty-desc="可能因采样开关关闭或窗口内无任务；确认遥测开关与采样率后重试。" empty-action="切换 30 天窗口" example-task="定位首 token 延迟 P95 超过 1.5s 的端点与提示词组合" :what="'在线指标加载失败'" :why="err.message" how="可重试；指标滚动聚合会自动追平，展示层失败不影响告警与 SLO 计算。" :trace-id="err.traceId" :collapsed-summary="`共 ${METRICS.length} 项指标，已折叠展示前 ${pageSize} 项（含目标线）`" :page-size="pageSize" @retry="refresh" @load-more="pageSize = METRICS.length" @empty-action="refresh">
      <div class="oc-card">
        <div class="oc-card__title">指标对照表（点击行查看 14 天趋势）</div>
        <Table row-key="key" size="small" :data="shown" :columns="metricColumns" @row-click="(ctx: { row: unknown }) => (selected = (ctx.row as OnlineMetric).key)">
          <template #name="{ row }"><span style="font-weight: 600; font-size: 12px">{{ row.name }}</span><Tag v-if="!pass(row)" size="small" variant="light-outline" theme="danger" style="margin-left: 6px">异常</Tag></template>
          <template #current="{ row }"><span class="oc-mono">{{ display(row) }}</span></template>
          <template #baseline="{ row }"><span class="oc-mono oc-secondary">{{ displayBase(row) }}</span></template>
          <template #targetText="{ row }"><Tag size="small" variant="outline">{{ row.targetText }}</Tag></template>
          <template #verdict="{ row }"><Tag size="small" variant="light-outline" :theme="pass(row) ? 'success' : 'danger'">{{ pass(row) ? '达标' : '未达标' }}</Tag></template>
          <template #ops="{ row }"><Button size="small" variant="text" @click.stop="selected = row.key">趋势</Button></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card" :style="!pass(active) ? 'border-left: 3px solid var(--td-error-color)' : ''">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">趋势 · {{ active.name }}（近 14 天）</div>
            <Tag size="small" variant="light-outline" :theme="pass(active) ? 'success' : 'danger'">{{ pass(active) ? '达标' : '未达标' }}</Tag>
          </div>
          <OcChart type="sparkline" :series="[{ name: active.name, points: sparkPoints }]" :height="150" :threshold="{ value: active.targetValue, label: `目标 ${active.targetText}`, kind: active.kind }" :format="active.fmt === 'cost' ? 'cost' : active.fmt === 'percent' ? 'percent' : 'number'" :unit="active.unit" aria-label="指标趋势迷你图" />
          <JsonBlock :value="{ 当前: display(active), 基线: displayBase(active), 目标: active.targetText, 口径: active.note }" :collapse-over="120" label="对照数据" />
        </div>

        <div class="oc-card">
          <div class="oc-card__title">未达标项与原因（不静默）</div>
          <div class="oc-stack" style="gap: 10px">
            <div v-for="m in abnormal" :key="m.key" class="oc-card" style="box-shadow: none; padding: 10px">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag size="small" theme="danger" variant="light-outline">未达标</Tag>
                <b style="font-size: 12px">{{ m.name }}</b>
                <span class="oc-mono" style="font-size: 12px">{{ display(m) }} vs 目标 {{ m.targetText }}</span>
              </div>
              <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ m.cause }}</div>
            </div>
          </div>
          <div class="oc-divider" />
          <InfoGrid :columns="2" :items="[
            { key: 'cadence', label: '采集节奏', value: '滚动 5 分钟聚合，近 14 天按日展示' }, { key: 'gate', label: '异常后果', value: '进入质量周会 + 关联变更冻结（连续 2 个窗口未恢复）' },
          ]" />
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <CopyableId id="trace-metrics-0912-77a1" label="复制指标快照 traceId" />
            <CliHint command="oc quality metrics show ttft --window 14d --explain" label="查看单指标口径" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
