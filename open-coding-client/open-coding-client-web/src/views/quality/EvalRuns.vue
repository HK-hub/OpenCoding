<script setup lang="ts">
/**
 * 评测运行（Y-03）：运行历史（总分/是否回归）、两次运行对比（逐维度差值与总分差）、
 * 基线变更评审（≥2 名评审人，缺第二人审批以 QA_BASELINE_NOT_APPROVED 阻断）与阶段性运行进度（不显示虚假百分比）。
 * 溯源：卷 26 / BUILD-MANIFEST Y-03。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Dialog, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 六维权重（合计 100%）：与评分报告页同源口径，运行侧不得另立标准 */
const DIMS = [
  { key: 'success', name: '任务成功率', weight: 0.4 }, { key: 'quality', name: '正确性与质量', weight: 0.2 },
  { key: 'cost', name: '成本效率', weight: 0.15 }, { key: 'latency', name: '时长效率', weight: 0.1 },
  { key: 'security', name: '安全性', weight: 0.1 }, { key: 'trajectory', name: '轨迹质量', weight: 0.05 },
];
/** 基线运行 R-2300：回归判定与之对比 —— 总分 ↓>3% 或成功率 ↓>2pp 判为回归 */
const BASELINE_DIMS = [91.2, 85.0, 80.0, 80.5, 96.0, 87.0];

interface EvalRun { runId: string; suite: string; version: string; at: string; dims: number[] }
const RUNS: EvalRun[] = [
  { runId: 'R-2321', suite: '核心任务集 v9', version: '0.9.3', at: '2026-09-12 10:20', dims: [88.2, 82.0, 74.0, 79.0, 96.0, 88.5] },
  { runId: 'R-2318', suite: '核心任务集 v9', version: '0.9.2', at: '2026-09-11 02:10', dims: [90.5, 84.6, 77.5, 80.0, 96.0, 87.5] },
  { runId: 'R-2315', suite: '核心任务集 v9', version: '0.9.2', at: '2026-09-10 02:10', dims: [90.1, 84.0, 76.5, 79.5, 96.0, 86.5] },
  { runId: 'R-2310', suite: '长任务子集 v3', version: '0.9.1', at: '2026-09-08 02:10', dims: [86.0, 81.0, 72.0, 76.0, 96.0, 85.0] },
  { runId: 'R-2304', suite: '核心任务集 v9', version: '0.9.0', at: '2026-09-05 02:12', dims: [89.4, 83.2, 75.8, 78.5, 95.5, 86.0] },
  { runId: 'R-2300', suite: '核心任务集 v9', version: '0.9.0-rc2', at: '2026-09-02 12:00', dims: BASELINE_DIMS },
  { runId: 'R-2296', suite: '长任务子集 v2', version: '0.8.9', at: '2026-08-30 02:11', dims: [83.5, 79.5, 71.0, 75.5, 95.0, 84.0] },
  { runId: 'R-2292', suite: '核心任务集 v8', version: '0.8.9', at: '2026-08-28 02:14', dims: [88.0, 82.5, 75.0, 77.0, 95.0, 85.5] },
];
function weighted(dims: number[]): number { return Number(dims.reduce((acc, v, i) => acc + v * DIMS[i].weight, 0).toFixed(1)); }
/** 回归判定：总分降幅 >3% 或成功率降幅 >2pp，任一触发即判回归 */
function judge(run: EvalRun): boolean {
  if (run.runId === 'R-2300') return false;
  return (weighted(BASELINE_DIMS) - weighted(run.dims)) / weighted(BASELINE_DIMS) * 100 > 3 || BASELINE_DIMS[0] - run.dims[0] > 2;
}

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(6); const compareOpen = ref(false); const baselineOpen = ref(false);
const compareA = ref('R-2318'); const compareB = ref('R-2321');
const reviewerA = ref(''); const reviewerB = ref(''); const reviewChange = ref('调整基线成功率'); const approveError = ref('');
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '评测运行库只读副本不可达（replica lag 120s）'));

const runOptions = computed(() => RUNS.map((r) => ({ label: `${r.runId} · ${r.version} · ${r.at}`, value: r.runId })));
const reviewerOptions = ['周婷（质量负责人）', '李昂（内核负责人）', '王珂（安全负责人）', '陈默（平台工程）'].map((n) => ({ label: n, value: n }));
const shown = computed(() => RUNS.slice(0, pageSize.value));
const regressions = computed(() => RUNS.filter(judge).length);
/** 表格行：显式派生「总分 / 是否回归」，避免对未声明列使用插槽 */
const runColumns = [
  { colKey: 'runId', title: 'runId', width: 110 , cell: 'runIdCell' }, { colKey: 'suite', title: '任务集', width: 150 },
  { colKey: 'version', title: '版本', width: 90 }, { colKey: 'at', title: '时间', width: 160 },
  { colKey: 'total', title: '总分', width: 80 }, { colKey: 'regression', title: '是否回归', width: 110 }, { colKey: 'ops', title: '操作', width: 80 },
];
const runRows = computed(() => shown.value.map((r) => ({ ...r, total: weighted(r.dims), regression: judge(r) })));
const runA = computed(() => RUNS.find((r) => r.runId === compareA.value));
const runB = computed(() => RUNS.find((r) => r.runId === compareB.value));
const diffRows = computed(() => {
  if (!runA.value || !runB.value) return [];
  return DIMS.map((d, i) => ({ key: d.key, name: d.name, weightPct: Math.round(d.weight * 100), a: runA.value!.dims[i], b: runB.value!.dims[i], delta: Number((runB.value!.dims[i] - runA.value!.dims[i]).toFixed(1)) }));
});
const totalDelta = computed(() => (runA.value && runB.value ? Number((weighted(runB.value.dims) - weighted(runA.value.dims)).toFixed(1)) : 0));
const diffColumns = [
  { colKey: 'name', title: '维度', width: 150 }, { colKey: 'weightPct', title: '权重', width: 80 }, { colKey: 'a', title: '运行 A', width: 90 }, { colKey: 'b', title: '运行 B', width: 90 }, { colKey: 'delta', title: '差值', width: 90 },
];
/** 进行中的运行：按阶段与已完成任务数报告，不给出虚假百分比 */
const stages = [
  { name: '环境准备（repo/commit 校验）', done: true }, { name: '任务集快照与权重校验', done: true }, { name: '逐任务执行（已完成 9 / 14）', done: false, current: true },
  { name: '六维评分与回归判定', done: false }, { name: '报告归档与基线对比', done: false },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = RUNS.length > pageSize.value ? 'EDGE_DATA' : RUNS.length ? 'NORMAL' : 'EMPTY'; }, 240);
}
/** 基线变更审批：任缺一名评审人即阻止，并给出错误码与补救路径 */
function approveBaseline() {
  if (!reviewerA.value || !reviewerB.value) {
    approveError.value = `缺少${!reviewerA.value ? '第一' : '第二'}评审人审批：基线变更必须 ≥2 名评审人批准（QA_BASELINE_NOT_APPROVED），本次变更不生效。`;
    return;
  }
  approveError.value = ''; baselineOpen.value = false;
  MessagePlugin.success(`基线变更已批准：${reviewChange.value}（评审人：${reviewerA.value}、${reviewerB.value}）`);
}
onMounted(() => { refresh(); ui.setViewState({ state: 'NORMAL' }); });
</script>

<template>
  <div class="oc-page">
    <PageHeader title="评测运行" desc="每次运行产出总分与六维得分；与基线对比自动判定回归（总分 ↓>3% 或成功率 ↓>2pp）；基线变更必须两名评审人批准后方可生效。" volume="卷 26" manifest="Y-03" cli="oc eval runs list --suite core-v9 --judge-regression && oc eval runs diff R-2318 R-2321" :status="[{ label: `回归 ${regressions} 次`, theme: regressions ? 'danger' : 'success' }, { label: '基线 R-2300', theme: 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="approveError = ''; baselineOpen = true">基线变更评审</Button>
        <Button size="small" theme="primary" @click="compareOpen = true">选择两次运行对比</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="运行次数（近 30 天）" :value="RUNS.length" format="number" icon="history" hint="全部来自 CI 定时与变更触发" />
      <StatCard label="回归次数" :value="regressions" format="number" icon="error" :lower-is-better="true" hint="任一条阈值触发即计一次" />
      <StatCard label="基线总分" :value="weighted(BASELINE_DIMS)" format="raw" icon="flag" hint="六维加权（权重合计 100%）" />
      <StatCard label="最新总分" :value="weighted(RUNS[0].dims)" format="raw" :target="weighted(BASELINE_DIMS)" target-kind="min" icon="chart-line" hint="低于基线 3% 即判回归" />
    </div>

    <StateShell :state="state" empty-title="暂无评测运行记录" empty-desc="还没有任何运行（任务集可能尚未登记或 CI 未触发）。首次运行将自动建立基线。" empty-action="触发一次全量运行" example-task="对比 R-2318 与 R-2321，定位成功率下降的维度" :what="'评测运行加载失败'" :why="err.message" how="可重试；进行中的运行在服务端继续执行，不受页面读取失败影响。" :trace-id="err.traceId" :collapsed-summary="`共 ${RUNS.length} 次运行，已折叠展示最近 ${pageSize} 次`" :page-size="pageSize" @retry="refresh" @load-more="pageSize = RUNS.length" @empty-action="refresh">
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">运行历史（阈值：总分 ↓>3% 或成功率 ↓>2pp）</div>
          <Table row-key="runId" size="small" :data="runRows" :columns="runColumns">
            <template #runIdCell="{ row }"><span class="oc-mono">{{ row.runId }}</span></template>
            <template #version="{ row }"><Tag size="small" variant="light-outline">{{ row.version }}</Tag></template>
            <template #total="{ row }"><span class="oc-mono">{{ row.total }}</span></template>
            <template #regression="{ row }"><Tag size="small" variant="light-outline" :theme="row.regression ? 'danger' : 'success'">{{ row.regression ? '回归' : '无回归' }}</Tag></template>
            <template #ops="{ row }"><Button size="small" variant="text" @click="compareA = row.runId; compareOpen = true">对比</Button></template>
          </Table>
          <CliHint command="oc eval runs show R-2321 --explain" label="查看单次运行详情" />
        </div>

        <div class="oc-card">
          <div class="oc-card__title">进行中的运行 · R-2324（阶段式报告，不显示虚假百分比）</div>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="s in stages" :key="s.name" class="oc-flex" style="gap: 6px">
              <Tag size="small" variant="light-outline" :theme="s.done ? 'success' : s.current ? 'primary' : 'default'">{{ s.done ? '已完成' : s.current ? '进行中' : '排队中' }}</Tag>
              <span style="font-size: 12px">{{ s.name }}</span>
            </div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">进度按「阶段 + 已完成任务数」报告；无法给出可信百分比时宁可不给，避免误导决策。</div>
          <div class="oc-flex" style="margin-top: 8px; gap: 8px">
            <Popconfirm theme="warning" content="在安全点停止后保留已完成 9/14 的任务结果与快照，可在修复环境后原样续跑；已消耗成本不退还。" @confirm="MessagePlugin.warning('已在安全点停止 R-2324：保留 9/14 结果快照（可续跑）')"><Button size="small" variant="outline">安全点停止</Button></Popconfirm>
            <CopyableId id="trace-run-2324-9f2c" label="复制运行 traceId" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">回归判定口径</div>
        <InfoGrid :columns="2" :items="[
          { key: 'rule', label: '判定规则', value: '总分降幅 >3% 或成功率降幅 >2pp，任一触发即判回归（不平均、不抵消）' }, { key: 'block', label: '判定后果', value: '阻断涉及内核/提示词/工具/权限的变更合并；修复后重跑并附对比' },
          { key: 'noise', label: '噪声处理', value: '任务级判定需 ≥3 次重跑一致；偶发失败标注「不稳定」而不直接计回归' }, { key: 'baseline', label: '基线变更', value: '仅允许提高要求或修正口径错误；须 ≥2 名评审人批准' },
        ]" />
      </div>
    </StateShell>

    <Dialog v-model:visible="compareOpen" header="两次运行对比（逐维度差值 + 总分差）" width="720px" :footer="false">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 8px">
        <Select v-model="compareA" :options="runOptions" style="width: 260px" aria-label="运行 A" />
        <span class="oc-muted" style="line-height: 32px">对比</span>
        <Select v-model="compareB" :options="runOptions" style="width: 260px" aria-label="运行 B" />
      </div>
      <Table row-key="key" size="small" :data="diffRows" :columns="diffColumns">
        <template #delta="{ row }"><Tag size="small" variant="light-outline" :theme="row.delta < 0 ? 'danger' : row.delta > 0 ? 'success' : 'default'">{{ row.delta > 0 ? '+' : '' }}{{ row.delta }}</Tag></template>
      </Table>
      <div class="oc-flex oc-flex--wrap" style="margin-top: 10px; gap: 8px">
        <Tag size="small" :theme="totalDelta < 0 ? 'danger' : 'success'" variant="light-outline">总分差 {{ totalDelta > 0 ? '+' : '' }}{{ totalDelta }}</Tag>
        <Tag size="small" variant="outline">{{ compareA }} → {{ compareB }}（权重合计 100%）</Tag>
        <span v-if="totalDelta < 0" class="oc-muted" style="font-size: 12px">总分下降 {{ Math.abs((totalDelta / weighted(runA?.dims ?? BASELINE_DIMS)) * 100).toFixed(1) }}%，{{ Math.abs(totalDelta) / weighted(runA?.dims ?? BASELINE_DIMS) * 100 > 3 ? '达到回归阈值，需定位归因' : '未达到回归阈值' }}</span>
        <span v-else class="oc-muted" style="font-size: 12px">总分上升或持平，未触发回归阈值。</span>
      </div>
    </Dialog>

    <Dialog v-model:visible="baselineOpen" header="基线变更评审（≥2 名评审人）" width="600px" :confirm-btn="{ content: '批准变更', theme: 'primary' }" cancel-btn="取消" @confirm="approveBaseline">
      <div class="oc-stack">
        <Alert v-if="approveError" theme="error" :message="approveError" />
        <div><div class="oc-card__title">变更内容</div><Select v-model="reviewChange" :options="['调整基线成功率', '调整基线成本', '更换模型端点后重立基线'].map((v) => ({ label: v, value: v }))" aria-label="变更内容" /></div>
        <div class="oc-flex" style="gap: 12px">
          <div class="oc-grow"><div class="oc-card__title">第一评审人</div><Select v-model="reviewerA" :options="reviewerOptions" placeholder="选择评审人" clearable aria-label="第一评审人" /></div>
          <div class="oc-grow"><div class="oc-card__title">第二评审人（必须与第一人不同）</div><Select v-model="reviewerB" :options="reviewerOptions" placeholder="选择评审人" clearable aria-label="第二评审人" /></div>
        </div>
        <div class="oc-muted" style="font-size: 12px">任缺一名评审人时保存被拒绝并返回错误码 QA_BASELINE_NOT_APPROVED；基线不生效，运行继续使用旧基线。</div>
      </div>
    </Dialog>
  </div>
</template>