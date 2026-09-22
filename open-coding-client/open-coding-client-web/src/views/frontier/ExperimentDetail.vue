<script setup lang="ts">
/**
 * 实验详情（U-03）：统一模板字段 + 指标趋势 + 晋级 / 终止 + 无退出条件不得进 beta 的门禁说明。
 * 溯源：卷 25 §4 模板字段与 §5 晋级/终止流程；BUILD-MANIFEST U-03。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Select, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { frontierData } from '@/mock/data/automation';
import type { Experiment, ExperimentLevel } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();

/** 选择实验：优先 query ?id=，其次路径参数，缺省取第一条 */
const expId = ref(String(route.query.id ?? route.params.id ?? frontierData.experiments[0].id));
const experiment = ref<Experiment>(
  frontierData.experiments.find((e) => e.id === expId.value) ?? frontierData.experiments[0],
);
const NEXT_LEVEL: Record<ExperimentLevel, ExperimentLevel> = {
  lab: 'internal', internal: 'beta', beta: 'ga', ga: 'ga', dropped: 'dropped', deprecated: 'deprecated',
};
const LEVEL_THEME: Record<ExperimentLevel, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  lab: 'default', internal: 'primary', beta: 'warning', ga: 'success', dropped: 'danger', deprecated: 'danger',
};

/** 指标趋势：本地确定性序列（成功率 % 与单次成本 USD），与指标引用口径一致 */
const successTrend = computed(() => {
  const base = Math.max(30, Math.round(experiment.value.successRatio * 100));
  return ['W30', 'W31', 'W32', 'W33', 'W34', 'W35'].map((x, i) => ({ x, y: Math.min(100, Math.max(20, base - 12 + i * 2)) }));
});
const costTrend = computed(() =>
  ['W30', 'W31', 'W32', 'W33', 'W34', 'W35'].map((x, i) => ({
    x, y: Number(((experiment.value.costSpent / 6) * (0.7 + i * 0.11)).toFixed(2)),
  })),
);

const gateOpen = computed(() => !!experiment.value.exitCriteria);
const canPromote = computed(() => ['lab', 'internal', 'beta'].includes(experiment.value.level) && (NEXT_LEVEL[experiment.value.level] !== 'beta' || gateOpen.value));

function onSelect(v: unknown) {
  expId.value = String(v);
  experiment.value = frontierData.experiments.find((e) => e.id === expId.value) ?? experiment.value;
}

/** 晋级：可见性与开关类型随阶梯变化，晋级前必须满足入口门禁 */
function promote() {
  const next = NEXT_LEVEL[experiment.value.level];
  experiment.value.level = next;
  experiment.value.notes = `已晋级 ${next}：可见性与数据策略按阶梯规则切换（见登记册 gates）。`;
  MessagePlugin.success(`已晋级为 ${next}：${next === 'beta' ? '白名单可见 + 「实验」徽标 + 全量指标' : next === 'ga' ? '全量可见（可配）+ 默认开启' : '仅团队内可见'}`);
}
/** 终止：关闭 + 归档 + 迁移建议，不可自动恢复（需重新登记） */
function terminate() {
  experiment.value.level = 'dropped';
  experiment.value.notes = '实验终止：数据已归档为只读包（可导出/可删除），开关移除，公告中给出迁移建议。';
  MessagePlugin.warning('已终止并归档：数据保留为只读包，开关移除；重新开始需走登记向导。');
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = frontierData.experiments.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="实验详情"
      :desc="`${experiment.id} · ${experiment.title}：模板字段、指标趋势、晋级与终止都在本页完成，门禁不满足时只读。`"
      volume="卷 25" manifest="U-03" :cli="`oc frontier experiment show ${experiment.id}`" experimental
      :status="[{ label: experiment.level, theme: LEVEL_THEME[experiment.level] }, { label: gateOpen ? '退出条件已登记' : '缺退出条件', theme: gateOpen ? 'success' : 'danger' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="expId" size="small" style="width: 190px" aria-label="切换实验" :options="frontierData.experiments.map((e) => ({ value: e.id, label: `${e.id} ${e.title}` }))" @change="onSelect" />
        <Button size="small" variant="outline" @click="router.push('/frontier/board')">返回看板</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在加载实验模板与指标…"
      empty-title="找不到该实验" empty-desc="编号可能已被归档移除；已终止实验只在季度评审记录中保留摘要。"
      empty-action="返回登记册" example-task="查看 D-FR-2 的退出条件与执行强度上报说明"
      what="实验详情加载失败" why="指标引用 metricsRef 不可达或实验已归档（详情只投影登记数据）"
      how="重试；归档实验的数据包仍可通过「实验数据隔离」导出"
      @retry="demo = 'NORMAL'" @empty-action="router.push('/frontier/registry')"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="成功率" :value="experiment.successRatio * 100" format="percent" icon="chart" :target="70" :lower-is-better="false" hint="beta 门禁参考线 ≥ 70%" />
        <StatCard label="成本已用" :value="experiment.costSpent" format="cost" unit="USD" icon="discount" :target="experiment.budget.usd" target-kind="max" hint="独立预算池，不占团队配额" />
        <StatCard label="影响面" :value="experiment.scope.join(' / ')" format="raw" icon="layers" hint="涉及域即评审参与方" />
        <StatCard label="负责人" :value="experiment.owner" format="raw" icon="user" hint="晋级 / 终止由负责人发起 + 季度评审判定" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">模板字段（统一模板 13 项）</div>
          <InfoGrid :columns="2" :items="[
            { key: 'id', label: '编号', value: experiment.id, mono: true },
            { key: 'level', label: '级别', value: experiment.level, tag: { text: experiment.level, theme: LEVEL_THEME[experiment.level] } },
            { key: 'hypothesis', label: '假设', value: experiment.hypothesis, span: 2 },
            { key: 'entry', label: '落地入口', value: experiment.entry, span: 2 },
            { key: 'scope', label: '影响面', value: experiment.scope.join('、') },
            { key: 'criteria', label: '成功判据', value: experiment.successCriteria.join('；') },
            { key: 'risks', label: '风险', value: experiment.risks.join('；'), span: 2 },
            { key: 'exit', label: '退出条件', value: experiment.exitCriteria },
            { key: 'review', label: '评审日期', value: new Date(experiment.reviewDate).toLocaleDateString('zh-CN') },
            { key: 'metrics', label: '指标引用', value: experiment.metricsRef, mono: true, span: 2 },
            { key: 'budget', label: '预算', value: `$${experiment.budget.usd}（已用 $${experiment.budget.spentUsd}）` },
            { key: 'ns', label: '数据命名空间', value: experiment.dataNamespace, mono: true },
            { key: 'decision', label: '设计分支结论', value: experiment.decision, span: 2 },
            { key: 'notes', label: '备注', value: experiment.notes, span: 2 },
          ]" />
        </div>
        <div class="oc-stack" style="gap: 12px">
          <div class="oc-card">
            <div class="oc-card__title">指标趋势（成功率 / 单次成本）<CliHint command="oc frontier metrics show D-FR-1 --window 6w" /></div>
            <OcChart type="line" :series="[{ name: '成功率', points: successTrend }]" :height="150" format="percent" :threshold="{ value: 70, label: '门禁线 70%', kind: 'min' }" aria-label="实验成功率趋势" />
            <OcChart type="line" :series="[{ name: '单次成本', points: costTrend }]" :height="140" format="cost" unit="USD" aria-label="实验成本趋势" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">晋级 / 终止</div>
            <div class="oc-flex oc-flex--wrap" style="gap: 8px">
              <Popconfirm v-if="canPromote" content="晋级后可见性变化：internal→beta 变为白名单用户/租户默认可见并显示「实验」徽标，数据策略切换为全量指标；beta→ga 变为全量可见（可配）。晋级不可自动回退。是否晋级？" @confirm="promote">
                <Button size="small" theme="primary">晋级到 {{ NEXT_LEVEL[experiment.level] }}</Button>
              </Popconfirm>
              <Button v-else size="small" theme="primary" disabled>晋级受门禁阻止</Button>
              <Popconfirm content="终止后归档与迁移建议：实验关闭、界面入口移除、数据归档为只读包（可导出/可删除），公告中给出迁移建议；重新开始需重新登记，不可自动恢复。是否终止？" @confirm="terminate">
                <Button size="small" theme="danger" variant="outline">终止实验</Button>
              </Popconfirm>
              <CopyableId id="trace-frontier-exp-7be1" label="详情 traceId" short="12" />
            </div>
            <div v-if="!canPromote" class="oc-muted" style="font-size: 12px; margin-top: 6px">
              门禁：无退出条件不得进入 beta（当前 {{ gateOpen ? '已登记' : '缺失' }}）；ga 需指标达标 + 运维就绪，由季度评审执行。
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">门禁与阶梯说明</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag size="small" variant="outline">lab：假设 + 成功判据书面化</Tag>
          <Tag size="small" variant="outline">internal：原型可演示 + 限制清单</Tag>
          <Tag size="small" :theme="gateOpen ? 'warning' : 'danger'" variant="light-outline">beta：红队 + 质量基线 + 退出条件（硬性）</Tag>
          <Tag size="small" variant="outline">ga：指标达标 + 监控/告警/文档就绪</Tag>
        </div>
      </div>
    </StateShell>
  </div>
</template>
