<script setup lang="ts">
/**
 * 运行历史与详情（X-10）：触发源 / 决策 / 动作 / 结果 / 耗时 / 幂等键 + 一键回滚。
 * 溯源：卷 15 §4.5 事后审计（触发源、决策、动作、结果可查；涉及提交可按卷 21 回滚）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Popconfirm, Select, Table, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { ScheduleRun } from '@/mock/data/task';
import { downloadCsv } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const limit = ref(12);
const outcomeFilter = ref('');
const detail = ref<(ScheduleRun & { scheduleName: string }) | null>(null);

const allRuns = computed(() => taskData.schedules.flatMap((s) => s.runs.map((r) => ({ ...r, scheduleName: s.name }))).sort((a, b) => +new Date(b.at) - +new Date(a.at)));
const runs = computed(() => allRuns.value
  .filter((r) => !outcomeFilter.value || r.outcome === outcomeFilter.value)
  .slice(0, limit.value));

const stats = computed(() => ({
  total: allRuns.value.length,
  ok: allRuns.value.filter((r) => r.outcome === 'SUCCEEDED').length,
  fail: allRuns.value.filter((r) => r.outcome === 'FAILED').length,
  cost: Number(allRuns.value.reduce((a, b) => a + b.cost, 0).toFixed(2)),
}));

const columns = [
  { colKey: 'at', title: '时间', width: 160 },
  { colKey: 'scheduleName', title: '计划' },
  { colKey: 'triggerSource', title: '触发源', width: 210 },
  { colKey: 'outcome', title: '结果', width: 130 },
  { colKey: 'durationMs', title: '耗时', width: 100 },
  { colKey: 'cost', title: '成本', width: 90 },
  { colKey: 'idempotencyKey', title: '幂等键', width: 170 },
  { colKey: 'op', title: '操作', width: 150 },
];

function rollback(r: ScheduleRun & { scheduleName: string }) {
  MessagePlugin.success(`已回滚 ${r.runId}：按幂等键定位副作用并逐项撤销（提交走 git 回滚策略，产物标记失效）`);
  detail.value = null;
}

/** 导出运行账本：CSV 行与页面表格同源；导出全量运行记录（不受页内筛选与折叠影响），含幂等键便于对账 */
function exportLedger() {
  const rows: (string | number)[][] = [
    ['runId', '计划', '开始时间', '触发源', '结果', '耗时(ms)', '成本(USD)', '幂等键', '可回滚'],
    ...allRuns.value.map((r) => [
      r.runId, r.scheduleName, new Date(r.at).toLocaleString('zh-CN'), r.triggerSource,
      r.outcome, r.durationMs, r.cost, r.idempotencyKey, r.rollbackable ? '是' : '否',
    ]),
  ];
  const file = downloadCsv(rows, `oc-schedule-runs-${new Date().toISOString().slice(0, 10)}.csv`);
  MessagePlugin.success(`运行账本已导出：${file}`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = !allRuns.value.length ? 'EMPTY' : allRuns.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
  }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="运行历史" volume="卷 15" manifest="X-10" cli="oc schedule runs --all --show-trigger-source --show-decision"
      desc="每次运行的完整账本：触发源（含 cron 窗口/事件 ID）、预授权决策、动作序列、结果与耗时、幂等键；可对可回滚运行执行一键回滚。"
      :status="[{ label: `共 ${stats.total} 次运行`, theme: 'primary' }, { label: `失败 ${stats.fail}`, theme: stats.fail ? 'danger' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportLedger">导出账本</Button>
        <Button size="small" variant="outline" @click="outcomeFilter = ''; limit = allRuns.length">显示全部</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="成功" :value="stats.ok" unit="次" icon="check" />
      <StatCard label="失败" :value="stats.fail" unit="次" icon="error" :lower-is-better="true" />
      <StatCard label="累计成本" :value="stats.cost" format="cost" icon="discount" :lower-is-better="true" />
      <StatCard label="去重/跳过" :value="allRuns.filter((r) => r.outcome === 'DEDUPLICATED' || r.outcome === 'SKIPPED').length" unit="次" icon="refresh" hint="并发策略与幂等键生效的证据" />
    </div>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
        <Select v-model="outcomeFilter" size="small" clearable placeholder="全部结果" style="width: 200px" :options="['SUCCEEDED', 'FAILED', 'SKIPPED', 'DEDUPLICATED', 'ESCALATED', 'PRECHECK_DENIED', 'ROLLED_BACK'].map((o) => ({ label: o, value: o }))" />
        <Tag size="small" variant="outline">终态集合：SUCCEEDED / FAILED / SKIPPED / DEDUPLICATED / ESCALATED / PRECHECK_DENIED / ROLLED_BACK</Tag>
      </div>
    </div>

    <StateShell
      :state="state" :page-size="limit"
      collapsed-summary="运行记录超过渲染阈值（12 条），已折叠展示；完整记录保留在审计存储中。"
      empty-title="没有运行记录" empty-desc="计划尚未触发过，或记录已超过保留期（默认 90 天，演练计划 365 天）。" empty-action="手动触发一次"
      example-task="手动触发「夜间依赖巡检」并查看账本"
      what="运行历史加载失败" why="审计存储读取超时（冷归档需解冻）"
      how="可重试；或将保留期内的热数据与冷归档分开查询" trace-id="trace-5c81de02"
      @retry="state = 'LOADING'" @load-more="limit = allRuns.length; state = 'NORMAL'" @empty-action="MessagePlugin.info('已手动触发 SCH-01')"
    >
      <div class="oc-card">
        <Table :data="runs" row-key="runId" size="small" :pagination="undefined" :columns="columns">
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #outcome="{ row }">
            <Tag size="small" :theme="row.outcome === 'SUCCEEDED' ? 'success' : row.outcome === 'FAILED' ? 'danger' : row.outcome === 'PRECHECK_DENIED' ? 'danger' : 'warning'" variant="light-outline">
              {{ row.outcome }}
            </Tag>
          </template>
          <template #durationMs="{ row }">{{ Math.round(row.durationMs / 1000) }}s</template>
          <template #cost="{ row }">${{ row.cost }}</template>
          <template #idempotencyKey="{ row }"><span class="oc-mono oc-muted" style="font-size: 11px">{{ row.idempotencyKey }}</span></template>
          <template #op="{ row }">
            <div class="oc-flex" style="gap: 4px">
              <Button size="small" variant="text" @click="detail = row">详情</Button>
              <Popconfirm
                v-if="row.rollbackable"
                content="回滚会按幂等键撤销本次运行的副作用（写入/提交/产物）；回滚本身也会记录为一次运行（ROLLED_BACK）。"
                theme="danger" @confirm="rollback(row)"
              >
                <Button size="small" variant="text" theme="danger">回滚</Button>
              </Popconfirm>
            </div>
          </template>
        </Table>
      </div>

      <Drawer :visible="!!detail" header="运行详情" size="560px" :footer="false" @close="detail = null">
        <div v-if="detail" class="oc-stack">
          <div class="oc-card">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" :theme="detail.outcome === 'SUCCEEDED' ? 'success' : 'warning'" variant="light-outline">{{ detail.outcome }}</Tag>
              <b style="font-size: 13px">{{ detail.scheduleName }}</b>
              <span class="oc-muted oc-mono" style="font-size: 11px">{{ detail.runId }}</span>
            </div>
            <InfoGrid :columns="2" :items="[
              { key: 'at', label: '开始时间', value: new Date(detail.at).toLocaleString('zh-CN') },
              { key: 'dur', label: '耗时', value: `${Math.round(detail.durationMs / 1000)} s` },
              { key: 'cost', label: '成本', value: `$${detail.cost}` },
              { key: 'src', label: '触发源', value: detail.triggerSource },
              { key: 'key', label: '幂等键', value: detail.idempotencyKey, mono: true, copyable: true },
              { key: 'roll', label: '可回滚', value: detail.rollbackable ? '是（未产生不可逆副作用）' : '否（含不可逆动作或已合并提交）' },
            ]" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">预授权决策</div>
            <div class="oc-flex" style="gap: 6px">
              <RiskBadge level="R2" />
              <span class="oc-secondary" style="font-size: 12px">{{ detail.decision }}</span>
            </div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">动作序列</div>
            <Timeline>
              <TimelineItem v-for="(a, i) in detail.actions" :key="a" :label="`步骤 ${i + 1}`">
                <div style="font-size: 12px">{{ a }}</div>
              </TimelineItem>
            </Timeline>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Popconfirm v-if="detail.rollbackable" content="回滚不可撤销：副作用将被逐项撤销，产物标记失效。" theme="danger" @confirm="rollback(detail)">
              <Button size="small" theme="danger" variant="outline">一键回滚</Button>
            </Popconfirm>
            <CliHint :command="`oc schedule run-show ${detail.runId} --with-actions`" />
            <CopyableId id="trace-5c81de02" label="复制 traceId" />
          </div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
