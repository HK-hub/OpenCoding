<script setup lang="ts">
/** 决策详情与回放（P-06）：动作描述 + 策略版本 + 求值轨迹 + 重放一致性。溯源：卷 06 D-PERM-12 §4.2 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { decisions } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const currentId = ref(decisions[0]?.decisionId ?? '');
const verdictFilter = ref('');
const pageSize = ref(10);
const err = ref(makeError('CONFLICT', '重放输入与原决策不一致：策略版本已变更（v18 → v19）'));

const rows = computed(() => decisions.filter((d) => !verdictFilter.value || d.decision === verdictFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const current = computed(() => decisions.find((d) => d.decisionId === currentId.value) ?? decisions[0]);
const matchCount = computed(() => decisions.filter((d) => d.replayMatch).length);

const consistency = computed(() => [
  { name: '重放一致', value: matchCount.value },
  { name: '存在差异', value: decisions.length - matchCount.value },
]);

const listColumns = [
  { colKey: 'decisionId', title: '决策 ID', width: 150 },
  { colKey: 'toolName', title: '工具', width: 130 },
  { colKey: 'riskClass', title: '风险', width: 100 },
  { colKey: 'mode', title: '模式', width: 110 },
  { colKey: 'decision', title: '决策', width: 110 },
  { colKey: 'latencyMs', title: '耗时', width: 84 },
  { colKey: 'replayMatch', title: '重放', width: 90 },
  { colKey: 'at', title: '时间', width: 170 },
];
const traceColumns = [
  { colKey: 'step', title: '步', width: 56 },
  { colKey: 'rule', title: '求值对象 / 规则', width: 230 },
  { colKey: 'result', title: '结果', width: 90 },
  { colKey: 'note', title: '说明', ellipsis: true },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function pick(ctx: { row: Record<string, unknown> }) {
  currentId.value = String(ctx.row.decisionId);
  ui.track('permission.decision.inspect', { decisionId: currentId.value });
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="决策详情与回放"
      desc="决策依赖输入（动作描述、策略版本、上下文）——记录完整输入 + 求值轨迹，才能回答「哪条策略 + 哪条规则 + 为什么」，并支持重放一致性校验。"
      volume="卷 06"
      manifest="P-06"
      :cli="`oc permission replay ${current.decisionId} --explain`"
      :status="[{ label: `一致 ${matchCount}/${decisions.length}`, theme: 'success' }, { label: '决策 ≤ 10ms P95', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="重放会以记录的输入重新求值（只读，不产生副作用）。若策略版本已变更，重放结果可能不一致并标注差异。确认重放？" @confirm="MessagePlugin.success('重放完成：求值轨迹与原记录一致（差异 0 项）')">
          <Button size="small" theme="primary">重放当前决策</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="决策总数（24h）" :value="decisions.length" format="raw" icon="filter" />
      <StatCard label="重放一致率" :value="Number(((matchCount / Math.max(1, decisions.length)) * 100).toFixed(1))" format="percent" icon="check" :target="95" target-kind="min" />
      <StatCard label="平均决策耗时" :value="Number((decisions.reduce((a, d) => a + d.latencyMs, 0) / decisions.length).toFixed(2))" unit="ms" format="raw" icon="time" :target="10" target-kind="max" />
      <StatCard label="DENY 决策" :value="decisions.filter((d) => d.decision === 'DENY').length" format="raw" icon="close" hint="拒绝必须附原因与策略引用" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="verdictFilter" size="small" clearable placeholder="决策结果" style="width: 170px" :options="['ALLOW', 'ALLOW_ONCE', 'ASK', 'DENY'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc permission decisions export --since 7d --format jsonl" label="导出决策集（回归用例）" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有决策记录"
      empty-desc="该时间窗内没有权限决策（可能全部由钩子前置阻断，或会话处于空闲）。"
      empty-action="清空筛选"
      example-task="回放一次生产环境破坏性动作的审批决策"
      :what="'重放输入与原决策不一致'"
      :why="err.message"
      how="策略版本变更导致差异属预期：重放报告会标注差异点与影响（不改写历史决策），可据此固化回归用例。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 条决策，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="verdictFilter = ''; refresh()"
    >
      <div class="oc-grid" style="grid-template-columns: 1fr 1fr">
        <div class="oc-card">
          <h3 class="oc-card__title">决策列表</h3>
          <Table row-key="decisionId" size="small" :data="shown" :columns="listColumns" :hover="true" @row-click="pick">
            <template #decisionId="{ row }"><CopyableId :id="row.decisionId" label="复制" :short="12" /></template>
            <template #riskClass="{ row }"><RiskBadge :level="row.riskClass" /></template>
            <template #decision="{ row }">
              <Tag size="small" variant="light-outline" :theme="row.decision === 'DENY' ? 'danger' : row.decision === 'ASK' ? 'warning' : row.decision === 'ALLOW_ONCE' ? 'primary' : 'success'">{{ row.decision }}</Tag>
            </template>
            <template #latencyMs="{ row }"><span class="oc-mono">{{ row.latencyMs }} ms</span></template>
            <template #replayMatch="{ row }">
              <Tooltip :content="row.replayMatch ? '重放一致：给定决策 ID 重放求值轨迹与原结果相同' : '存在差异：依赖的工件/策略版本已变更（已在报告中标注）'">
                <Tag size="small" variant="light-outline" :theme="row.replayMatch ? 'success' : 'warning'">{{ row.replayMatch ? '一致' : '差异' }}</Tag>
              </Tooltip>
            </template>
            <template #at="{ row }">{{ new Date(row.at).toLocaleTimeString('zh-CN') }}</template>
          </Table>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">重放一致性分布</h3>
          <OcChart type="donut" :values="consistency" :height="180" format="number" aria-label="决策重放一致性分布" />
          <div class="oc-divider" />
          <InfoGrid :columns="1" :items="[
            { key: 'r1', label: '重放输入', value: '动作描述（含归一化路径 / AST）+ 策略版本 + 上下文摘要引用 + 模式与范围链' },
            { key: 'r2', label: '一致性判定', value: '重放结论与原结论比对；差异必须给出原因（策略变更 / 工件过期 / 记忆撤销）' },
            { key: 'r3', label: '用途', value: '审计复算、策略调优、把真实决策固化为回归用例（防回归）' },
            { key: 'r4', label: '不做的事', value: '重放不重放副作用（写工具按副作用账本跳过已发生条目）' },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          求值轨迹（{{ current.decisionId }} · 拒绝优先 + 具体覆盖宽泛 + 强制项不可放宽）
          <CliHint :command="`oc permission replay ${current.decisionId} --trace`" />
        </h3>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'tool', label: '动作 / 工具', value: `${current.toolName}（${current.riskClass}）` },
            { key: 'mode', label: '模式', value: current.mode },
            { key: 'decision', label: '决策结果', value: `${current.decision}｜${current.reason}`, span: 2 },
            { key: 'refs', label: '命中规则', value: current.ruleRefs.join(' , ') || '无（按默认档位映射）', mono: true, span: 2 },
            { key: 'version', label: '策略版本', value: current.policyVersion },
            { key: 'callId', label: '关联调用', value: current.callId ?? '无（未产生工具调用）', mono: true, copyable: Boolean(current.callId) },
            { key: 'chain', label: '层级链', value: current.scopeChain.join(' → '), span: 2 },
          ]"
        />
        <Table row-key="step" size="small" style="margin-top: 10px" :data="current.evaluationTrace" :columns="traceColumns">
          <template #step="{ row }"><span class="oc-mono">{{ row.step }}</span></template>
          <template #rule="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.rule }}</span></template>
          <template #result="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.result === 'DENY' ? 'danger' : row.result === 'ASK' ? 'warning' : row.result === 'HIT' ? 'primary' : row.result === 'SKIP' ? 'default' : 'success'">{{ row.result }}</Tag>
          </template>
          <template #note="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.note }}</span></template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
