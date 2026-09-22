<script setup lang="ts">
/**
 * 实验开关与灰度（U-04）：每实验一行的开关类型 / 灰度范围 / 数据策略 + 用户可关闭 + 「实验」徽标说明。
 * 溯源：卷 25 §6 实验开关与数据策略；BUILD-MANIFEST U-04。
 * 契约：beta 及以上默认可见并显示「实验」徽标；关闭后能力入口隐藏（不静默）；硬编码开关仅开发者可改。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { frontierData } from '@/mock/data/automation';
import type { ExperimentFlag } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const flags = ref<ExperimentFlag[]>(frontierData.flags.map((f) => ({ ...f })));
const experiments = computed(() => frontierData.experiments);

/** 阶梯 → 开关类型与数据策略（与实验的 level 关联展示，默认值来自 gates） */
function gateOf(experimentId: string) {
  const exp = experiments.value.find((e) => e.id === experimentId);
  return frontierData.gates.find((g) => g.level === exp?.level);
}

const KIND_THEME: Record<ExperimentFlag['kind'], 'default' | 'primary' | 'warning' | 'success'> = {
  硬编码开关: 'default', 实验开关: 'primary', 租户级开关: 'warning', 默认开启: 'success',
};
const columns = [
  { colKey: 'name', title: '开关（每实验一行）', width: 230, cell: 'name' },
  { colKey: 'kind', title: '开关类型', width: 120, cell: 'kind' },
  { colKey: 'rollout', title: '灰度范围', width: 240, ellipsis: true },
  { colKey: 'dataPolicy', title: '数据策略', width: 150, cell: 'policy' },
  { colKey: 'userClosable', title: '用户可关闭', width: 120, cell: 'closable' },
  { colKey: 'on', title: '当前状态', width: 110, cell: 'on' },
];
const enabledCount = computed(() => flags.value.filter((f) => f.defaultOn).length);

function toggle(row: ExperimentFlag, value: unknown) {
  const on = value === true;
  if (!row.userClosable) {
    MessagePlugin.warning(`「${row.name}」为${row.kind}：仅管理员可改（${row.notes}）`);
    return;
  }
  row.defaultOn = on;
  // 关闭后能力入口整体隐藏（不静默降级为可用），重新开启不需要重启
  MessagePlugin.success(on ? `已开启「${row.name}」：界面显示「实验」徽标，能力入口恢复` : `已关闭「${row.name}」：能力入口隐藏并停止采集，已产生的实验数据保留`);
}
function explainBadge() {
  MessagePlugin.info('「实验」徽标含义：该能力处于 beta 及以上、默认可见，但尚未 GA；用户可自行关闭，关闭后入口隐藏。');
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = flags.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="实验开关与灰度"
      desc="每个实验一个开关，按阶梯决定开关类型与数据策略；用户可关闭任何实验能力，关闭后入口隐藏、采集停止。"
      volume="卷 25" manifest="U-04" cli="oc frontier flags list --with-rollout" experimental
      :status="[{ label: `${flags.length} 个开关`, theme: 'default' }, { label: `${enabledCount} 个开启中`, theme: enabledCount ? 'warning' : 'success' }, { label: '实验徽标强制', theme: 'primary' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="explainBadge">实验徽标说明</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取实验开关与灰度范围…"
      empty-title="没有实验开关" empty-desc="当前没有处于 beta 及以上的实验；lab/internal 阶段使用硬编码或实验开关，不进入灰度。"
      empty-action="去看板查看阶梯" example-task="关闭「多模态协作」开关，确认入口隐藏且数据保留"
      what="实验开关加载失败" why="开关框架（卷 24 特性开关）不可达，灰度范围由框架下发"
      how="重试；开关状态在 GA 后并入主线开关，不受本页影响" 
      :collapsed-summary="`开关 ${flags.length} 个（含 3 个默认关闭），表格已折叠展示（边界数据态）。`" :page-size="flags.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="开关总数" :value="flags.length" unit="个" icon="extension" hint="一个实验一个开关，不合并" />
        <StatCard label="默认关闭" :value="flags.length - enabledCount" unit="个" icon="close" :lower-is-better="true" hint="关闭即入口隐藏（不静默保留可用）" />
        <StatCard label="用户可关闭" :value="flags.filter((f) => f.userClosable).length" unit="个" icon="user" :lower-is-better="false" hint="用户关掉后能力隐藏，数据中心仍保留已采集数据" />
        <StatCard label="硬编码开关" :value="flags.filter((f) => f.kind === '硬编码开关').length" unit="个" icon="lock" :lower-is-better="true" hint="lab 阶段仅开发者构建可改" />
      </div>

      <Table :data="flags" :columns="columns" row-key="id" size="small" :pagination="undefined" style="margin-top: 12px">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 0">
            <span class="oc-mono" style="font-size: 11px">{{ row.name }}</span>
            <span class="oc-muted" style="font-size: 11px">{{ row.experimentId }}</span>
          </div>
        </template>
        <template #kind="{ row }">
          <Tag size="small" :theme="KIND_THEME[row.kind as ExperimentFlag['kind']]" variant="light-outline">{{ row.kind }}</Tag>
        </template>
        <template #policy="{ row }">{{ gateOf(row.experimentId)?.dataPolicy ?? '不上报' }}</template>
        <template #closable="{ row }">
          <span :style="{ color: row.userClosable ? undefined : 'var(--td-text-color-placeholder)' }">{{ row.userClosable ? '可关闭' : '仅管理员' }}</span>
        </template>
        <template #on="{ row }">
          <Switch :value="row.defaultOn" size="small" :disabled="!row.userClosable" :aria-label="`切换 ${row.name}`" @change="(v: unknown) => toggle(row, v)" />
          <span v-if="!row.defaultOn" class="oc-muted" style="font-size: 12px; margin-left: 6px">入口已隐藏</span>
        </template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">「实验徽标」与可见性<CliHint command="oc frontier flags explain --badge" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'badge', label: '徽标', value: 'beta 及以上能力默认可见，界面强制显示「实验」标签（不可隐藏）' },
            { key: 'close', label: '用户关闭', value: '关闭后能力入口整体隐藏、停止数据采集；不静默保留半可用状态' },
            { key: 'reopen', label: '重新开启', value: '用户可自行重新开启，无需重启；开发中状态不进入用户可见区（lab/internal）' },
            { key: 'hard', label: '硬编码开关', value: 'lab 阶段仅内部构建启用，用户不可见也不可关（灰度为「仅开发者」）' },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">数据策略（按阶梯）</div>
          <InfoGrid :columns="1" :items="frontierData.gates.map((g) => ({ key: g.level, label: g.level, value: `${g.switchKind} · ${g.dataPolicy} · 可见性：${g.visibility}` }))" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <Tag size="small" theme="warning" variant="light-outline">默认关闭的实验：{{ flags.filter((f) => !f.defaultOn).length }} 个</Tag>
            <CopyableId id="trace-frontier-flags-2d55" label="开关 traceId" short="12" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
