<script setup lang="ts">
/**
 * 评分报告（Y-01）：六维雷达（权重合计 100%）+ 加权总分与基线对比 + 回归判定徽标（总分 ↓>3% 或成功率 ↓>2pp）
 * + 维度明细表（权重、本次/基线、差值、判定与得分依据）。
 * 溯源：卷 26 / BUILD-MANIFEST Y-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
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

/** 六维权重（合计 100%）与得分依据：权重是冻结契约，只能经评审变更 */
interface Dim { key: string; name: string; weight: number; basis: string }
const DIMS: Dim[] = [
  { key: 'success', name: '任务成功率', weight: 40, basis: '通过验收脚本的任务数 / 总任务数（含长任务自治子集）' },
  { key: 'quality', name: '正确性与质量', weight: 20, basis: '回归用例通过率 + 人工抽检缺陷密度（每千行 ≤0.4 个）' },
  { key: 'cost', name: '成本效率', weight: 15, basis: '单位任务成本相对基线的比值，按缓存折扣后口径' },
  { key: 'latency', name: '时长效率', weight: 10, basis: '任务墙钟时长 P50 相对基线，含审批等待但不含排队' },
  { key: 'security', name: '安全性', weight: 10, basis: '红队用例通过率 + 越权/外泄零命中（命中即判 0 分）' },
  { key: 'trajectory', name: '轨迹质量', weight: 5, basis: '无无效重试、无跳步、审批等待被正确记录（人工抽样 20 条）' },
];

/** 报告数据：基线 R-2300 与最近两次运行（数值与评测运行页一致） */
const BASELINE = [91.2, 85.0, 80.0, 80.5, 96.0, 87.0];
const REPORTS: Record<string, { version: string; at: string; dims: number[] }> = {
  'R-2321': { version: '0.9.3', at: '2026-09-12 10:20', dims: [88.2, 82.0, 74.0, 79.0, 96.0, 88.5] },
  'R-2318': { version: '0.9.2', at: '2026-09-11 02:10', dims: [90.5, 84.6, 77.5, 80.0, 96.0, 87.5] },
};
const reportId = ref('R-2321');
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const err = ref(makeError('INTERNAL_ERROR', '评分聚合失败（dimension-aggregator 输出与权重快照不匹配）'));

const report = computed(() => REPORTS[reportId.value]);
const total = computed(() => Number(report.value.dims.reduce((a, v, i) => a + v * (DIMS[i].weight / 100), 0).toFixed(1)));
const baseTotal = computed(() => Number(BASELINE.reduce((a, v, i) => a + v * (DIMS[i].weight / 100), 0).toFixed(1)));
const totalDropPct = computed(() => Number((((baseTotal.value - total.value) / baseTotal.value) * 100).toFixed(1)));
const successDropPp = computed(() => Number((BASELINE[0] - report.value.dims[0]).toFixed(1)));
/** 回归双阈值：总分降幅 >3% 或成功率降幅 >2pp，任一触发即标红且必须给出原因 */
const regression = computed(() => totalDropPct.value > 3 || successDropPp.value > 2);
const regressionReason = computed(() => {
  if (!regression.value) return '总分与成功率双阈值均未触发，判定无回归（允许合并）。';
  const hits: string[] = [];
  if (totalDropPct.value > 3) hits.push(`加权总分 ↓${totalDropPct.value}%（阈值 >3%）`);
  if (successDropPp.value > 2) hits.push(`任务成功率 ↓${successDropPp.value}pp（阈值 >2pp）`);
  return `${hits.join('；')}。主要原因：长任务自治子集成功率下降（EV-008/EV-014 未达基线），成本效率随重试次数上升而下降。`;
});
const radarValues = computed(() => DIMS.map((d, i) => ({ name: `${d.name}·${d.weight}%`, value: report.value.dims[i] })));
const rows = computed(() => DIMS.map((d, i) => ({
  key: d.key, name: d.name, weightPct: d.weight, current: report.value.dims[i], base: BASELINE[i],
  delta: Number((report.value.dims[i] - BASELINE[i]).toFixed(1)), basis: d.basis,
})));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = REPORTS[reportId.value] ? 'NORMAL' : 'EMPTY'; }, 240);
}

function exportReport() {
  const file = downloadJson(
    { reportId: reportId.value, version: report.value.version, total: total.value, baselineTotal: baseTotal.value, regression: regression.value, reason: regressionReason.value, dims: rows.value },
    `oc-score-report-${reportId.value}.json`,
  );
  MessagePlugin.success(`评分报告已导出：${file}`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="评分报告"
      desc="六维加权评分（成功率 40% / 正确性与质量 20% / 成本效率 15% / 时长效率 10% / 安全性 10% / 轨迹质量 5%），与基线对比后给出回归判定与原因。"
      volume="卷 26"
      manifest="Y-01"
      cli="oc eval report R-2321 --dims all --compare-baseline"
      :status="[{ label: regression ? '判定：回归' : '判定：无回归', theme: regression ? 'danger' : 'success' }, { label: '权重合计 100%', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Select v-model="reportId" :options="Object.keys(REPORTS).map((k) => ({ label: `${k} · ${REPORTS[k].version}`, value: k }))" style="width: 180px" aria-label="选择运行" />
        <Button size="small" theme="primary" @click="exportReport">导出评分报告</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="该运行暂无评分报告"
      empty-desc="评分聚合尚未完成或运行被取消；完成评分后报告自动生成。"
      empty-action="重新拉取报告"
      example-task="查看 R-2321 成功率骤降 3pp 的维度归因"
      what="评分报告加载失败"
      :why="err.message"
      how="可重试；评分结论以最近一次成功聚合为准，失败不会覆盖旧报告。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-grid oc-grid--3">
        <StatCard label="加权总分（六维）" :value="total" format="raw" :target="baseTotal" target-kind="min" :delta="Number((-totalDropPct).toFixed(1))" icon="chart" hint="目标：不低于基线" />
        <StatCard label="基线总分" :value="baseTotal" format="raw" icon="flag" hint="基线 R-2300 · 变更须 ≥2 名评审人批准" />
        <StatCard label="成功率降幅" :value="successDropPp" format="raw" unit="pp" icon="error" :lower-is-better="true" hint="阈值 >2pp 触发回归" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">六维雷达（{{ reportId }} · v{{ report.version }} · {{ report.at }}）</div>
          <OcChart type="radar" :values="radarValues" :height="240" aria-label="六维评分雷达图" />
          <div class="oc-muted" style="font-size: 12px">雷达轴标签含权重；权重合计 100%，任何维度不允许为提升总分而临时改权重。</div>
        </div>

        <div class="oc-stack">
          <div class="oc-card" :style="regression ? 'border-left: 3px solid var(--td-error-color)' : 'border-left: 3px solid var(--td-success-color)'">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" variant="light-outline" :theme="regression ? 'danger' : 'success'">
                {{ regression ? '回归判定：回归' : '回归判定：无回归' }}
              </Tag>
              <Tag size="small" variant="outline">阈值：总分 ↓>3% 或成功率 ↓>2pp</Tag>
            </div>
            <div style="font-size: 12px; margin-top: 6px">{{ regressionReason }}</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">报告元信息</div>
            <InfoGrid
              :columns="2"
              :items="[
                { key: 'suite', label: '任务集', value: '核心任务集 v9（14 条 / 八类）' },
                { key: 'judge', label: '判定方', value: '评分聚合器（自动）+ 质量负责人复核' },
                { key: 'noise', label: '噪声处理', value: '任务级 ≥3 次重跑一致才计入；偶发失败标注「不稳定」' },
                { key: 'cost', label: '本次成本', value: '$6.84 / 预算 $8.00', mono: true },
              ]"
            />
            <div class="oc-flex" style="margin-top: 8px">
              <CopyableId id="trace-score-2321-c41e" label="复制评分 traceId" />
            </div>
          </div>
          <CliHint command="oc eval report R-2321 --show-basis --json" label="导出维度依据" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">维度明细（权重与得分依据）</div>
        <Table row-key="key" size="small" :data="rows">
          <template #name="{ row }"><b style="font-size: 12px">{{ row.name }}</b></template>
          <template #weightPct="{ row }">{{ row.weightPct }}%</template>
          <template #current="{ row }"><span class="oc-mono">{{ row.current }}</span></template>
          <template #base="{ row }"><span class="oc-mono">{{ row.base }}</span></template>
          <template #delta="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.delta < 0 ? 'danger' : row.delta > 0 ? 'success' : 'default'">
              {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}
            </Tag>
          </template>
          <template #verdict="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.key === 'success' && row.delta < -2 ? 'danger' : row.delta < 0 ? 'warning' : 'success'">
              {{ row.key === 'success' && row.delta < -2 ? '触发回归阈值' : row.delta < 0 ? '低于基线（未触发）' : '优于/持平基线' }}
            </Tag>
          </template>
          <template #basis="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.basis }}</span></template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">维度得分均为 0–100 归一化值；加权总分保留一位小数，四舍五入后再判阈值。</div>
      </div>
    </StateShell>
  </div>
</template>
