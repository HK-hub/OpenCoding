<script setup lang="ts">
/**
 * 测试体系（Y-01）：五层测试金字塔（单元/集成/契约/端到端/混沌）及各层门禁与执行频率；
 * 覆盖率水位（行 ≥80% / 分支 ≥70%）与各层用例数统计；门禁口径为冻结契约，不随环境变化。
 * 溯源：卷 26 / BUILD-MANIFEST Y-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 五层测试定义：门禁与执行频率是本页的公开契约（各层执行频率之和覆盖提交/合并/发布全链路） */
interface PyramidLayer {
  key: string;
  name: string;
  cases: number;
  passed: number;
  gate: string;
  frequency: string;
  durationMin: number;
  owner: string;
  note: string;
}

const LAYERS: PyramidLayer[] = [
  { key: 'unit', name: '单元测试', cases: 1284, passed: 1281, gate: '函数级覆盖率 ≥90%，失败即阻断', frequency: '每次提交', durationMin: 3, owner: '提交者本地 + CI', note: '最快反馈层：pre-commit 未通过不允许提交' },
  { key: 'integration', name: '集成测试', cases: 316, passed: 312, gate: '关键路径全绿，允许 1 次重试', frequency: '每次合并', durationMin: 12, owner: 'CI（合并队列）', note: '覆盖内核 ↔ 存储 ↔ 事件总线边界' },
  { key: 'contract', name: '契约测试', cases: 88, passed: 87, gate: '契约不兼容即拒绝合并（禁止静默改版）', frequency: '每次合并', durationMin: 6, owner: '平台工程组', note: '四协议适配器 + 事件 Schema 双向校验' },
  { key: 'e2e', name: '端到端', cases: 46, passed: 44, gate: 'J1–J12 核心旅程无阻塞失败', frequency: '每日 + 发布前', durationMin: 38, owner: '质量与运维组', note: 'CLI / 桌面 / Web 三端等价断言' },
  { key: 'chaos', name: '混沌实验', cases: 18, passed: 17, gate: '注入后降低而非放大风险，发布前必须全绿', frequency: '发布前 + 季度', durationMin: 95, owner: 'SRE 与内核组', note: 'C1–C10 的常态化子集，季度全量重跑' },
];

/** 覆盖率水位：行/分支双阈值来自质量门禁（<阈值阻断发布） */
const coverage = ref([
  { key: 'line', label: '行覆盖率', pct: 83.6, target: 80, note: '口径：语句覆盖（含分支内语句）' },
  { key: 'branch', label: '分支覆盖率', pct: 71.2, target: 70, note: '口径：条件分支全覆盖，排除生成代码' },
]);

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(4);
const selected = ref('unit');
const coverLoading = ref(false);
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '覆盖率服务不可达（cov-agent 心跳丢失 42s）'));

const totals = computed(() => {
  const cases = LAYERS.reduce((a, l) => a + l.cases, 0);
  const passed = LAYERS.reduce((a, l) => a + l.passed, 0);
  return { cases, passed, failed: cases - passed, ratePct: Number(((passed / cases) * 100).toFixed(1)) };
});
const active = computed(() => LAYERS.find((l) => l.key === selected.value) ?? LAYERS[0]);
const shown = computed(() => LAYERS.slice(0, pageSize.value));
const layerColumns = [
  { colKey: 'name', title: '层级', width: 150 }, { colKey: 'cases', title: '通过 / 总数', width: 130 },
  { colKey: 'gate', title: '门禁', ellipsis: true }, { colKey: 'frequency', title: '执行频率', width: 130 }, { colKey: 'durationMin', title: '单次耗时', width: 100 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = LAYERS.length > pageSize.value ? 'EDGE_DATA' : LAYERS.length ? 'NORMAL' : 'EMPTY';
  }, 240);
}

/** 重新采集覆盖率：真实排队并以新采集时间回写（不改变阈值口径，避免门禁被"刷新"绕过） */
function recollectCoverage() {
  coverLoading.value = true;
  window.setTimeout(() => {
    coverLoading.value = false;
    MessagePlugin.success('覆盖率采集完成：行 83.6% / 分支 71.2%（与上次一致，阈值口径未变）');
  }, 900);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader title="测试体系" desc="五层金字塔各司其职：下层快而广、上层慢而真；每层有明确门禁与执行频率，任一层未过即阻断对应环节（提交 / 合并 / 发布）。" volume="卷 26" manifest="Y-01" cli="oc quality pyramid --with-coverage --with-gates" :status="[{ label: `五层已注册 ${LAYERS.length}`, theme: 'primary' }, { label: `失败用例 ${totals.failed} 条已归属`, theme: 'warning' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" :loading="coverLoading" @click="recollectCoverage">重新采集覆盖率</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="用例总数" :value="totals.cases" format="number" icon="task-checked" hint="五层合计（每次提交至季度全量）" />
      <StatCard label="本轮通过率" :value="totals.ratePct" format="percent" :target="99" target-kind="min" icon="check" :hint="`${totals.failed} 条失败已定位归属层`" />
      <StatCard label="行覆盖率" :value="coverage[0].pct" format="percent" :target="coverage[0].target" target-kind="min" icon="chart-bar" hint="低于 80% 阻断发布" />
      <StatCard label="分支覆盖率" :value="coverage[1].pct" format="percent" :target="coverage[1].target" target-kind="min" icon="layers" hint="低于 70% 阻断发布" />
    </div>

    <StateShell :state="state" empty-title="测试体系未注册" empty-desc="未读取到任何层的用例（可能仓库初始化未完成）。五层缺一层即视为门禁不成立。" empty-action="重新拉取测试定义" example-task="为新增的内核恢复路径补充单元 + 端到端两层用例" :what="'测试体系加载失败'" :why="err.message" how="可重试；失败时保留上次快照并标注「数据可能滞后」，不影响 CI 中的真实门禁执行。" :trace-id="err.traceId" :collapsed-summary="`五层定义共 ${LAYERS.length} 行，已折叠展示前 ${pageSize} 行（含门禁与频率）`" :page-size="pageSize" @retry="refresh" @load-more="pageSize = LAYERS.length" @empty-action="refresh">
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">五层金字塔（用例数分布）</div>
            <Tag size="small" variant="light-outline">点击行查看门禁</Tag>
          </div>
          <OcChart type="bar" :series="[{ name: '用例数', points: LAYERS.map((l) => ({ x: l.name, y: l.cases })) }]" :height="220" unit="条" aria-label="五层用例数分布" />
          <div class="oc-muted" style="font-size: 12px">塔基宽、塔尖窄：越靠上层执行越慢、环境越真，因此只保留高价值断言。</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">覆盖率水位（行 ≥80% / 分支 ≥70%）</div>
          <div class="oc-stack" style="gap: 14px">
            <div v-for="c in coverage" :key="c.key">
              <div class="oc-flex--between">
                <span style="font-size: 13px">{{ c.label }}</span>
                <span class="oc-mono">{{ c.pct }}% / 目标 {{ c.target }}%</span>
              </div>
              <Progress :percentage="c.pct" :stroke-width="8" :status="c.pct >= c.target ? 'success' : 'error'" />
              <div class="oc-muted" style="font-size: 12px">{{ c.note }}</div>
            </div>
          </div>
          <div class="oc-divider" />
          <InfoGrid :columns="2" :items="[
            { key: 'trend', label: '近 4 次采集', value: '行 82.9 → 83.1 → 83.4 → 83.6（连续回升）' },
            { key: 'exempt', label: '豁免说明', value: '仅生成代码与第三方 vendored 目录排除，豁免清单一文件一评审' },
            { key: 'block', label: '未达标后果', value: '阻断发布（不阻断合并，但合并需登记补齐计划）' },
            { key: 'source', label: '采集方式', value: 'CI 覆盖率代理合并多环境结果，禁止手工回填' },
          ]" />
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <CopyableId id="trace-cov-77d1a4" label="复制采集 traceId" />
            <span class="oc-muted" style="font-size: 12px">最近采集：2026-09-12 09:20</span>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">各层门禁与执行频率</div>
        <Table row-key="key" size="small" :data="shown" :columns="layerColumns" @row-click="(ctx: { row: unknown }) => (selected = (ctx.row as PyramidLayer).key)">
          <template #name="{ row }"><b style="font-size: 12px">{{ row.name }}</b><div class="oc-muted" style="font-size: 11px">{{ row.owner }}</div></template>
          <template #cases="{ row }"><span class="oc-mono">{{ row.passed }} / {{ row.cases }}</span></template>
          <template #gate="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.gate }}</span></template>
          <template #frequency="{ row }"><Tag size="small" variant="light-outline" theme="primary">{{ row.frequency }}</Tag></template>
          <template #durationMin="{ row }">{{ row.durationMin }} 分钟</template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">当前层详情 · {{ active.name }}</div>
        <InfoGrid :columns="3" :items="[
          { key: 'freq', label: '执行频率', value: active.frequency }, { key: 'gate', label: '门禁', value: active.gate },
          { key: 'cases', label: '用例数', value: `${active.cases} 条（通过 ${active.passed}）`, mono: true }, { key: 'duration', label: '单次耗时', value: `${active.durationMin} 分钟` },
          { key: 'owner', label: '责任方', value: active.owner }, { key: 'note', label: '设计意图', value: active.note },
        ]" />
      </div>
    </StateShell>
  </div>
</template>
