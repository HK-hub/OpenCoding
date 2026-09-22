<script setup lang="ts">
/**
 * 性能容量基准（Y-03）：8 场景对照基线/目标/实测与通过判定；历史趋势（近 6 周）；
 * 未达标场景标红并给出原因与整改状态；「重跑基准」在专用环境执行（阶段式进度）。
 * 溯源：卷 26 / BUILD-MANIFEST Y-03。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

const WEEKS = ['W32', 'W33', 'W34', 'W35', 'W36', 'W37'];
/** 历史趋势：单位分离（吞吐 k/s、耗时 s），只展示关键两场景以保持可读 */
const THROUGHPUT_TREND = [8.2, 8.1, 7.6, 7.0, 6.7, 6.4];
const COMPRESS_TREND = [44, 45, 46, 48, 50, 52];

interface BenchRow { key: string; name: string; baseline: string; target: string; targetValue: string; actual: string; pass: boolean; cause?: string }

const ROWS_SEED: BenchRow[] = [
  { key: 'ttft', name: '会话首 token 延迟 P95', baseline: '1.41s', target: '≤ 1.50s', targetValue: '1.50s', actual: '1.42s', pass: true },
  { key: 'e2e', name: '单任务端到端时长 P50', baseline: '44s', target: '≤ 60s', targetValue: '60s', actual: '58s', pass: true },
  { key: 'event', name: '事件写入吞吐', baseline: '8.0k/s', target: '≥ 8.0k/s', targetValue: '8.0k/s', actual: '6.4k/s', pass: false, cause: '读写共用实例产生写放大；已排期写入分片（预计 W39 恢复）' },
  { key: 'concurrency', name: '并发会话数（L2 沙箱）', baseline: '180', target: '≥ 200', targetValue: '200', actual: '200', pass: true },
  { key: 'tool', name: '工具调用延迟 P95', baseline: '820ms', target: '≤ 800ms', targetValue: '800ms', actual: '760ms', pass: true },
  { key: 'compact', name: '上下文压缩（1M token）', baseline: '48s', target: '≤ 45s', targetValue: '45s', actual: '52s', pass: false, cause: '新增分块校验后耗时上升；批处理参数调优中（W38 复测）' },
  { key: 'index', name: '工作区索引（10 万文件）', baseline: '11.5min', target: '≤ 10min', targetValue: '10min', actual: '9.2min', pass: true },
  { key: 'coldstart', name: '冷启动到可交互', baseline: '2.9s', target: '≤ 3.0s', targetValue: '3.0s', actual: '2.6s', pass: true },
];

const rows = ref<BenchRow[]>(ROWS_SEED.map((r) => ({ ...r })));
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(6);
const running = ref(false);
const stage = ref('');
const lastRunAt = ref('2026-09-11 04:20');
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '基准环境资源池被占用（独占窗口未释放）'));

const columns = [
  { colKey: 'name', title: '场景', width: 220 },
  { colKey: 'baseline', title: '基线', width: 110 },
  { colKey: 'target', title: '目标', width: 110 },
  { colKey: 'actual', title: '实测', width: 110 },
  { colKey: 'pass', title: '是否通过', width: 100 },
  { colKey: 'cause', title: '未达标说明 / 整改状态', ellipsis: true },
];
const shown = computed(() => rows.value.slice(0, pageSize.value));
const failed = computed(() => rows.value.filter((r) => !r.pass));
const passRate = computed(() => rows.value.length ? Number(((rows.value.filter((r) => r.pass).length / rows.value.length) * 100).toFixed(1)) : 0);
const throughputPoints = computed(() => WEEKS.map((w, i) => ({ x: w, y: THROUGHPUT_TREND[i] })));
const compressPoints = computed(() => WEEKS.map((w, i) => ({ x: w, y: COMPRESS_TREND[i] })));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = rows.value.length > pageSize.value ? 'EDGE_DATA' : rows.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
}

/** 重跑基准：在独占基准环境执行，阶段式推进；完成后按实测更新结果（未达标仍保持标红） */
function rerunBenchmarks() {
  running.value = true;
  stage.value = '阶段 1/3：申请独占基准环境…';
  window.setTimeout(() => {
    stage.value = '阶段 2/3：执行 8 场景（事件吞吐 / 压缩耗时重跑加长采样）…';
    window.setTimeout(() => {
      stage.value = '阶段 3/3：结果校验与归档（对比基线，标注偏差）…';
      window.setTimeout(() => {
        rows.value = rows.value.map((r) => (r.key === 'event' ? { ...r, actual: '6.6k/s' } : r.key === 'compact' ? { ...r, actual: '49s' } : r));
        lastRunAt.value = '2026-09-12 17:05';
        running.value = false;
        stage.value = '';
        MessagePlugin.warning('基准重跑完成：事件吞吐 6.4→6.6k/s、压缩 52→49s，仍未达标（保持标红，W38 复测）');
      }, 800);
    }, 900);
  }, 700);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader title="性能容量基准" desc="8 个容量场景在独占环境定期重跑：对照基线与目标判定通过；未达标场景保持标红并绑定整改项，禁止用「平均一下」掩盖问题。" volume="卷 26" manifest="Y-03" cli="oc quality bench run --scene all --exclusive && oc quality bench report --compare-baseline" :status="[{ label: `通过 ${rows.length - failed.length} / ${rows.length}`, theme: failed.length ? 'warning' : 'success' }, { label: `未达标 ${failed.length} 项`, theme: failed.length ? 'danger' : 'success' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="重跑将占用独占基准环境约 40 分钟（不阻塞生产流量）；期间结果以最近一次完成为准，不能手工填写实测值。" @confirm="rerunBenchmarks">
          <Button size="small" theme="primary" :loading="running" :disabled="running">重跑基准</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="场景数" :value="rows.length" format="number" icon="chart-bar" hint="吞吐/延迟/容量/索引/启动全链路" />
      <StatCard label="通过率" :value="passRate" format="percent" :target="100" target-kind="min" icon="check" hint="目标 100% 通过" />
      <StatCard label="未达标场景" :value="failed.length" format="number" icon="error" :lower-is-better="true" hint="事件写入吞吐 / 上下文压缩" />
      <StatCard label="最近重跑" :value="lastRunAt" format="raw" icon="history" hint="独占环境执行，约 40 分钟一轮" />
    </div>

    <div v-if="running || stage" class="oc-card" style="margin-top: 12px">
      <div class="oc-flex" style="gap: 8px">
        <Tag size="small" variant="light-outline" theme="primary">重跑中</Tag>
        <span style="font-size: 12px">{{ stage }}</span>
      </div>
      <div class="oc-muted" style="font-size: 12px; margin-top: 4px">进度按阶段报告（申请环境 → 执行场景 → 校验归档）；不提供虚假百分比。</div>
    </div>

    <StateShell :state="state" empty-title="暂无基准数据" empty-desc="尚未建立基线或基准环境未执行过任务；首次运行将同时建立基线。" empty-action="运行首次基准" example-task="对比事件写入吞吐在近 6 周的变化并定位写放大原因" :what="'基准数据加载失败'" :why="err.message" how="可重试；基准失败不覆盖上次结果，配额与告警不因页面不可用而漂移。" :trace-id="err.traceId" :collapsed-summary="`共 ${rows.length} 个场景，已折叠展示前 ${pageSize} 个`" :page-size="pageSize" @retry="refresh" @load-more="pageSize = rows.length" @empty-action="refresh">
      <div class="oc-card">
        <div class="oc-card__title">场景对照表</div>
        <Table row-key="key" size="small" :data="shown" :columns="columns">
          <template #name="{ row }"><b style="font-size: 12px">{{ row.name }}</b><Tag v-if="!row.pass" size="small" variant="light-outline" theme="danger" style="margin-left: 6px">未达标</Tag></template>
          <template #actual="{ row }"><span class="oc-mono" :style="!row.pass ? 'color: var(--td-error-color)' : ''">{{ row.actual }}</span></template>
          <template #pass="{ row }"><Tag size="small" variant="light-outline" :theme="row.pass ? 'success' : 'danger'">{{ row.pass ? '通过' : '未达标' }}</Tag></template>
          <template #cause="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.cause ?? '—' }}</span></template>
        </Table>
        <CliHint command="oc quality bench run --scene event-throughput --exclusive --trace" label="单场景重跑" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">历史趋势 · 事件写入吞吐（k/s，目标 ≥8.0）</div>
          <OcChart type="line" :series="[{ name: '事件写入吞吐', points: throughputPoints }]" :height="180" unit="k/s" :threshold="{ value: 8.0, label: '目标线 8.0k/s', kind: 'min' }" aria-label="事件写入吞吐趋势" />
          <div class="oc-muted" style="font-size: 12px">连续 6 周下行；根因为读写共用实例的写放大，整改中（分片写入）。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">历史趋势 · 上下文压缩耗时（s，目标 ≤45）</div>
          <OcChart type="line" :series="[{ name: '压缩耗时', points: compressPoints }]" :height="180" unit="s" :threshold="{ value: 45, label: '目标线 45s', kind: 'max' }" aria-label="压缩耗时趋势" />
          <div class="oc-muted" style="font-size: 12px">新增分块校验后耗时上升；W38 调优批处理参数后复测。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">未达标项说明（显式标红，不允许静默）</div>
        <div v-for="r in failed" :key="r.key" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
          <Tag size="small" theme="danger" variant="light-outline">未达标</Tag>
          <b style="font-size: 12px">{{ r.name }}</b>
          <span class="oc-secondary" style="font-size: 12px">基线 {{ r.baseline }} / 目标 {{ r.target }} / 实测 {{ r.actual }}；{{ r.cause }}</span>
        </div>
        <div class="oc-flex" style="margin-top: 8px; gap: 6px">
          <CopyableId id="trace-bench-0912-3c1d" label="复制基准快照 traceId" />
          <span class="oc-muted" style="font-size: 12px">结论：未达标不影响功能正确性，但阻断容量承诺类发布（见变更门禁矩阵「成本基线」行）。</span>
        </div>
      </div>
    </StateShell>
  </div>
</template>
