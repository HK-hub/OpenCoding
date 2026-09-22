<script setup lang="ts">
/** 冲突与串行化（T-08）：冲突图 + 串行原因（同路径写 / 工作区锁 / 外发上限）。溯源：卷 05 D-TOOL-4 §4.4 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { conflicts, conflictRules } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const verdictFilter = ref('');
const pageSize = ref(12);
const err = ref(makeError('CONFLICT', '冲突图增量快照版本落后（工作区索引变更）'));

const rows = computed(() => conflicts.filter((c) => !verdictFilter.value || c.verdict === verdictFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const serialCount = computed(() => conflicts.filter((c) => c.verdict === '串行').length);
const parallelCount = computed(() => conflicts.filter((c) => c.verdict === '并行').length);

const verdictStats = computed(() => [
  { name: '串行（冲突）', value: serialCount.value },
  { name: '并行（无冲突）', value: parallelCount.value },
]);
const ruleStats = computed(() =>
  conflictRules.map((r) => ({
    name: r.rule,
    value: conflicts.filter((c) => c.rule === r.rule).length,
  })),
);

const columns = [
  { colKey: 'edgeId', title: '边', width: 84 },
  { colKey: 'pair', title: '调用对（工具）', width: 240 },
  { colKey: 'resource', title: '资源', width: 230 },
  { colKey: 'rule', title: '冲突规则', width: 200 },
  { colKey: 'verdict', title: '判定', width: 90 },
  { colKey: 'serializedReason', title: '串行原因 / 说明', ellipsis: true },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="冲突与串行化"
      desc="资源声明 + 冲突图调度：读并行、写串行、命令默认并行（声明工作区锁则串行）、跨工作区并行、外发受并发上限约束。冲突判定必须可解释。"
      volume="卷 05"
      manifest="T-08"
      :cli="`oc tools conflicts --since 2h --explain --format graph`"
      :status="[{ label: `串行 ${serialCount} 次`, theme: 'warning' }, { label: `并行 ${parallelCount} 次`, theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="重算冲突图会重新评估在途调用的可并行性（可能上调并行度，不会取消已串行队列）。确认重算？" @confirm="MessagePlugin.success('冲突图已重算：在途 3 个调用中 1 个可提前并行')">
          <Button size="small" theme="primary">重算冲突图</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="写写串行次数" :value="serialCount" format="raw" icon="lock" hint="同路径写 + 工作区锁" />
      <StatCard label="读读并行" :value="parallelCount" format="raw" icon="search" hint="共享缓存，无额外开销" />
      <StatCard label="平均串行等待" :value="1840" unit="ms" format="raw" icon="time" :target="3000" target-kind="max" />
      <StatCard label="丢更新风险" :value="0" format="raw" icon="secured" hint="串行化保证写序一致（反例见下）" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">判定分布</h3>
        <OcChart type="donut" :values="verdictStats" :height="180" format="number" aria-label="冲突判定分布" />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">规则命中分布</h3>
        <OcChart type="bar" :values="ruleStats" :height="180" format="number" aria-label="冲突规则命中分布" />
      </div>
    </div>

    <div class="oc-flex oc-flex--wrap" style="margin-top: 4px">
      <Tag :theme="verdictFilter === '' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="verdictFilter = ''; refresh()">全部 {{ conflicts.length }}</Tag>
      <Tag :theme="verdictFilter === '串行' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="verdictFilter = '串行'; refresh()">串行 {{ serialCount }}</Tag>
      <Tag :theme="verdictFilter === '并行' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="verdictFilter = '并行'; refresh()">并行 {{ parallelCount }}</Tag>
      <CliHint command="oc tools conflicts --graph --dot" label="导出 graphviz" />
    </div>

    <StateShell
      :state="state"
      empty-title="最近没有资源冲突"
      empty-desc="全部调用都在不重叠的资源上执行（读读并行 / 跨工作区并行）。"
      empty-action="清空筛选"
      example-task="并行对两个仓库做只读检索（验证跨工作区并行）"
      :what="'冲突图加载失败'"
      :why="err.message"
      how="增量快照版本落后：已请求重算（约 1s）；也可手动重算后重试。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 条冲突边，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 12; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="verdictFilter = ''; refresh()"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">冲突规则表（判定语义）</h3>
        <Table row-key="rule" size="small" :data="conflictRules" :columns="[
          { colKey: 'rule', title: '资源组合', width: 240 },
          { colKey: 'verdict', title: '判定', width: 92 },
          { colKey: 'desc', title: '说明', ellipsis: true },
          { colKey: 'enforce', title: '强制力', width: 150 },
        ]">
          <template #verdict="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.verdict === '串行' ? 'warning' : 'success'">{{ row.verdict }}</Tag>
          </template>
          <template #enforce="{ row }">
            <Tag v-if="row.rule.includes('workspaceLock')" size="small" theme="danger" variant="light-outline">硬约束（不可弱化）</Tag>
            <Tag v-else size="small" variant="light-outline">调度优化</Tag>
          </template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">冲突边（最近 2 小时）</h3>
        <Table row-key="edgeId" size="small" :data="shown" :columns="columns">
          <template #edgeId="{ row }"><span class="oc-mono">{{ row.edgeId }}</span></template>
          <template #pair="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <span class="oc-mono">{{ row.toolA }} ↔ {{ row.toolB }}</span>
              <span class="oc-muted" style="font-size: 11px">
                <CopyableId :id="row.callA" label="callA" :short="8" /> ·
                <CopyableId :id="row.callB" label="callB" :short="8" />
              </span>
            </div>
          </template>
          <template #resource="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.resource }}</span></template>
          <template #verdict="{ row }">
            <Tooltip :content="row.serializedReason ?? '无冲突：可并行执行'">
              <Tag size="small" variant="light-outline" :theme="row.verdict === '串行' ? 'warning' : 'success'">{{ row.verdict }}</Tag>
            </Tooltip>
          </template>
          <template #serializedReason="{ row }">
            <span v-if="row.serializedReason" class="oc-secondary" style="font-size: 12px">{{ row.serializedReason }}</span>
            <span v-else class="oc-muted" style="font-size: 12px">资源不重叠（或共享只读缓存），按调度并行</span>
          </template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">反例说明（为什么必须串行）</h3>
        <InfoGrid :columns="2" :items="[
          { key: 'lost', label: '丢更新反例', value: '两个 edit_file 同时对同一文件读-改-写：后写覆盖前写（若并行）→ 已通过行数校验与串行化证明拦截' },
          { key: 'readwrite', label: '读写一致性', value: '读必须在写的原子替换点之后执行，否则读到半成品状态（撕裂读）' },
          { key: 'lock', label: '工作区锁', value: 'git checkout / rebase 声明 workspaceLock：在途命令需等待索引释放' },
          { key: 'egress', label: '外发上限', value: '网络类调用受 4 并发上限约束（防雪崩）；排队时显式标注「已排队」而非静默等待' },
        ]" />
      </div>
    </StateShell>
  </div>
</template>
