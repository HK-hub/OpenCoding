<script setup lang="ts">
/**
 * W-02 索引状态：进度 / 块数 / 耗时 / 失败原因 / 断点续传 / 滞后秒数 + 后台重建。
 * 索引与工作区版本（提交哈希）绑定，落后者可识别；失败保留进度可续传，大仓重建在后台进行（卷 11 §7）。
 * 溯源：卷 11 D-KB-6 / BUILD-MANIFEST W-02
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import type { IndexJob } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.knowledge;

const state = ref<UiStateKind>('LOADING');
const mode = ref('all');
const paused = ref(false);
/** 手动后台重建任务（排队中）：提交后进入任务表，重建期间新旧索引并存 */
const manualJobs = ref<IndexJob[]>([]);

const rows = computed(() => [...manualJobs.value, ...data.indexJobs].filter((j) => mode.value === 'all' || j.mode === mode.value));
const running = computed(() => [...manualJobs.value, ...data.indexJobs].filter((j) => j.state === 'RUNNING' || j.state === 'QUEUED'));
// 已断点续传的失败任务不再计入失败数（计数与行内状态保持一致）
const failed = computed(() => data.indexJobs.filter((j) => j.state === 'FAILED' && !resumed.value.includes(j.jobId)));

/** 索引耗时对比（同一目标的历史重建耗时，单位秒） */
const durationSeries = computed(() => [
  {
    name: '耗时（秒）',
    points: [
      { x: '本地工作区', y: 42 },
      { x: 'GitHub 仓库', y: 86 },
      { x: 'payment-core', y: 1812 },
      { x: '竞品文档', y: 268 },
      { x: 'Jira', y: 12 },
    ],
  },
]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function jobTheme(s: string) {
  return s === 'SUCCEEDED' ? 'success' : s === 'RUNNING' ? 'primary' : s === 'FAILED' ? 'danger' : s === 'CANCELLING' ? 'warning' : 'default';
}

function durationText(ms: number) {
  if (!ms) return '—';
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

/** 长任务中断语义：在安全点暂停，已完成的块保留可检索 */
function pauseRebuild() {
  paused.value = true;
  MessagePlugin.warning('已在安全点暂停：已索引 62% 的块保持可检索，恢复后从断点继续（不重跑）');
}

/** 提交后台重建：排队一个重建任务并计入「进行中」，重建期间新旧索引并存 */
function submitRebuild() {
  const seq = manualJobs.value.length + 1;
  manualJobs.value = [
    { jobId: `kjob-manual-${seq}`, target: '全部启用源（手动后台重建）', mode: 'rebuild', progress: 0, chunksTotal: 0, durationMs: 0, failedReason: '', resumable: false, commitHash: '', state: 'QUEUED' },
    ...manualJobs.value,
  ];
  MessagePlugin.success(`已提交后台重建任务（排队中）：共 ${manualJobs.value.length} 个手动任务待执行，重建期间新旧索引并存`);
}

/** 已请求取消的任务（按 jobId）：行内状态就地翻转为取消中，进度冻结在安全点 */
const cancelling = ref<string[]>([]);
/** 已断点续传的任务（按 jobId）：失败态就地回到运行态，失败原因隐藏 */
const resumed = ref<string[]>([]);

/** 行内状态展示：叠加取消/续传的就地翻转，不改写 mock 行对象 */
function rowState(row: IndexJob) {
  if (cancelling.value.includes(row.jobId)) return 'CANCELLING';
  if (resumed.value.includes(row.jobId)) return 'RUNNING';
  return row.state;
}

/** 请求取消（安全点）：当前批次边界停止，已完成块保留，可恢复续跑 */
function cancelJob(row: IndexJob) {
  if (!cancelling.value.includes(row.jobId)) cancelling.value.push(row.jobId);
  MessagePlugin.warning(`已请求取消「${row.target}」：在当前批次安全点停止，已完成 ${row.progress}% 的块保留；点「恢复续跑」可从断点继续`);
}

/** 恢复续跑：解除取消请求回到运行态（不重跑已完成块） */
function resumeJob(row: IndexJob) {
  cancelling.value = cancelling.value.filter((id) => id !== row.jobId);
  MessagePlugin.success(`已恢复续跑「${row.target}」：从 ${row.progress}% 断点继续，不重跑已完成块`);
}

/** 断点续传：失败任务就地回到运行态并清空失败原因（重跑只处理未完成块） */
function resumeFailedJob(row: IndexJob) {
  if (!resumed.value.includes(row.jobId)) resumed.value.push(row.jobId);
  MessagePlugin.success(`已从 ${row.progress}% 断点续传「${row.target}」：状态回到运行中，不重跑已完成块`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="索引状态"
      desc="索引任务全生命周期：进度、块数、耗时、失败原因、断点续传与滞后秒数；重建在后台进行，暂停只在安全点生效。"
      volume="卷 11"
      manifest="W-02"
      cli="oc kb index status --watch"
      :status="[{ label: `${running.length} 个进行中`, theme: running.length ? 'primary' : 'default' }, { label: failed.length ? `${failed.length} 个失败` : '无失败任务', theme: failed.length ? 'danger' : 'success' }]"
    >
      <template #actions>
        <Select v-model="mode" size="small" style="width: 130px" :options="[{ label: '全部任务', value: 'all' }, { label: '增量', value: 'incremental' }, { label: '重建', value: 'rebuild' }]" />
        <Popconfirm content="后台重建不影响检索：重建期间新旧索引并存，检索结果标注索引版本。" @confirm="submitRebuild">
          <Button size="small" theme="primary"><OcIcon name="refresh" size="12px" /> 后台重建</Button>
        </Popconfirm>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="进行中任务" :value="running.length" unit="个" icon="loading" :lower-is-better="true" hint="进度可见；可暂停/取消（安全点语义）" />
      <StatCard label="索引块总数" :value="data.sources.reduce((a, s) => a + s.chunkCount, 0)" unit="块" format="token" icon="layers" hint="八类来源合计；单租户容量 ≥ 500 万块" />
      <StatCard label="增量滞后" :value="Math.round(data.sources.reduce((a, s) => a + s.lagSeconds, 0) / data.sources.length)" unit="秒" icon="time" :lower-is-better="true" hint="目标：从文件变更到可检索 ≤ 30s" />
      <StatCard label="失败任务" :value="failed.length" unit="个" icon="error" :lower-is-better="true" hint="失败保留进度，可断点续传" />
    </div>

    <StateShell
      :state="state"
      stage="读取索引任务…"
      empty-title="没有索引任务"
      empty-desc="接入知识源后会自动创建首次全量索引任务；也可手动触发后台重建。"
      empty-action="查看知识源"
      example-task="对 payment-core 触发后台重建并观察进度"
      what="索引任务加载失败"
      why="索引调度器不可达（队列服务连接中断）。"
      how="可重试；检索仍可用上一版本索引（带「可能过时」标注）。"
      trace-id="trace-kidx-5b13da"
      :cancellable="true"
      @retry="state = 'NORMAL'"
      @cancel="pauseRebuild"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">
          索引任务
          <span class="oc-flex" style="gap: 6px">
            <Tag v-if="paused" size="small" theme="warning">已暂停（安全点）</Tag>
            <span class="oc-muted" style="font-size: 12px">索引与提交哈希绑定，落后者可识别</span>
          </span>
        </h3>
        <Table
          :data="rows"
          :columns="[
            { colKey: 'target', title: '目标 / 模式', cell: 'cell' },
            { colKey: 'progress', title: '进度', width: 200, cell: 'cell' },
            { colKey: 'chunksTotal', title: '块数', width: 100, cell: 'cell' },
            { colKey: 'durationMs', title: '耗时', width: 92, cell: 'cell' },
            { colKey: 'commitHash', title: '提交', width: 100, cell: 'cell' },
            { colKey: 'state', title: '状态', width: 100, cell: 'cell' },
            { colKey: 'op', title: '操作', width: 150, cell: 'cell' },
          ]"
          row-key="jobId"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'target'">
              <div style="font-size: 13px">{{ row.target }}</div>
              <Tag size="small" variant="outline" style="margin-top: 2px">{{ row.mode === 'incremental' ? '增量' : '重建' }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'progress'">
              <Progress :percentage="row.progress" theme="line" :status="rowState(row) === 'FAILED' ? 'error' : rowState(row) === 'SUCCEEDED' ? 'success' : rowState(row) === 'CANCELLING' ? 'warning' : 'active'" size="small" />
              <div v-if="rowState(row) === 'FAILED' && row.failedReason" class="oc-muted" style="font-size: 11px; margin-top: 2px; color: var(--oc-sev-error)">
                {{ row.failedReason }}
              </div>
              <div v-else-if="rowState(row) === 'CANCELLING'" class="oc-muted" style="font-size: 11px; margin-top: 2px; color: var(--oc-sev-warn)">
                进度已冻结在安全点：第 {{ Math.round(row.progress) }}% 批次结束处
              </div>
            </template>
            <template v-else-if="col.colKey === 'chunksTotal'"><span class="oc-mono">{{ row.chunksTotal.toLocaleString('zh-CN') }}</span></template>
            <template v-else-if="col.colKey === 'durationMs'">
              <span class="oc-mono">{{ durationText(row.durationMs) }}</span>
            </template>
            <template v-else-if="col.colKey === 'commitHash'">
              <span class="oc-mono">{{ row.commitHash || '—' }}</span>
            </template>
            <template v-else-if="col.colKey === 'state'">
              <Tag size="small" :theme="jobTheme(rowState(row))" variant="light-outline">{{ rowState(row) === 'CANCELLING' ? '取消中（安全点）' : rowState(row) }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'op'">
              <template v-if="row.resumable && rowState(row) === 'FAILED'">
                <Button size="small" variant="text" @click="resumeFailedJob(row)">断点续传</Button>
              </template>
              <template v-else-if="rowState(row) === 'RUNNING'">
                <Button size="small" variant="text" @click="pauseRebuild">暂停</Button>
                <Button size="small" variant="text" @click="cancelJob(row)">取消</Button>
              </template>
              <template v-else-if="rowState(row) === 'CANCELLING'">
                <Button size="small" variant="text" @click="resumeJob(row)">恢复续跑</Button>
              </template>
              <template v-else>
                <span class="oc-muted" style="font-size: 12px">—</span>
              </template>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">各源最近一次索引耗时（秒）</h3>
          <OcChart type="bar" :series="durationSeries" :height="190" unit="s" aria-label="索引耗时" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">长任务控制语义</h3>
          <div class="oc-kv">
            <span class="oc-kv__k">暂停</span><span>在批次边界（安全点）生效；已索引块保持可检索</span>
            <span class="oc-kv__k">取消</span><span>在当前批次安全点停止，保留已完成部分，不产生半成品块</span>
            <span class="oc-kv__k">断点续传</span><span>失败任务保留进度与解析状态，重跑只处理未完成块</span>
            <span class="oc-kv__k">并发</span><span>重建与增量互斥（同源串行），跨源可并行（受资源上限约束）</span>
          </div>
          <div class="oc-divider" />
          <div class="oc-flex" style="gap: 8px">
            <Tooltip content="索引落后者在检索结果中标注「索引落后 N 个提交」，并降低排序权重">
              <Tag size="small" theme="warning" variant="light-outline">落后可识别</Tag>
            </Tooltip>
            <Tag size="small" variant="outline">嵌入调用计量并入预算</Tag>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
