<script setup lang="ts">
/**
 * 单位经济性（G4-01）：三版本（社区版 / 专业版席位制 / 企业版私有化）成本结构，
 * 每席与每任务成本目标（简单 ≤$0.5 / 中等 ≤$5 / 大型 ≤$50），敏感度分析与一键重算。
 * 溯源：卷 31 / BUILD-MANIFEST G4-01
 */
import { computed, onMounted, ref } from 'vue';
import { Button, InputNumber, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData.unitEconomics;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');

/** 三版本成本结构（模型 / 存储 / 基础设施与支持，占比合计 100%） */
const STRUCTURE: Record<string, { model: number; storage: number; infra: number }> = {
  社区版: { model: 0, storage: 60, infra: 40 },
  '专业版（席位制）': { model: 60, storage: 15, infra: 25 },
  '企业版（私有化）': { model: 25, storage: 20, infra: 55 },
};
const structureColumns = [
  { colKey: 'name', title: '版本', width: 160 },
  { colKey: 'model', title: '模型占比', width: 110 },
  { colKey: 'storage', title: '存储占比', width: 110 },
  { colKey: 'infra', title: '基础设施与支持占比', width: 160 },
  { colKey: 'perSeatUsd', title: '每席成本', width: 110 },
  { colKey: 'perTaskUsd', title: '每任务成本', width: 110 },
  { colKey: 'marginPct', title: '毛利', width: 84 },
  { colKey: 'note', title: '说明' },
];
const editions = computed(() => d.editions.map((e) => ({ ...e, ...(STRUCTURE[e.name] ?? { model: 0, storage: 0, infra: 100 }) })));
/** 成本结构堆叠柱：三版本横向对比 */
const structureBars = computed(() => [
  { name: '模型', points: editions.value.map((e) => ({ x: e.name, y: e.model })) },
  { name: '存储', points: editions.value.map((e) => ({ x: e.name, y: e.storage })) },
  { name: '基础设施与支持', points: editions.value.map((e) => ({ x: e.name, y: e.infra })) },
]);
/** 每任务成本分档目标（专业版口径示例） */
const taskCosts = [
  { label: '简单任务', value: 0.28, target: 0.5 },
  { label: '中等任务', value: 4.1, target: 5 },
  { label: '大型任务', value: 38.6, target: 50 },
];

/** 重算参数：模型价系数 / 缓存命中提升 / 端侧分流比例 */
const priceFactor = ref(1.5);
const cacheDelta = ref(20);
const edgeOffload = ref(20);
const BASE_SEAT = 162;
const recalculated = computed(() => {
  const cost = BASE_SEAT * (1 + 0.6 * (priceFactor.value - 1)) * (1 - 0.006 * cacheDelta.value) * (1 - 0.0045 * edgeOffload.value);
  return {
    seat: Number(cost.toFixed(2)),
    task: Number((cost / 30).toFixed(2)),
    deltaPct: Number((((cost - BASE_SEAT) / BASE_SEAT) * 100).toFixed(1)),
  };
});
/** 一键重算：按当前参数重算每席/每任务成本并给出与基线的差异 */
function recalc(): void {
  MessagePlugin.success(`已按当前参数重算：每席 $${recalculated.value.seat}（基线 $${BASE_SEAT}，${recalculated.value.deltaPct}%），每任务 $${recalculated.value.task}`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = d.editions.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="单位经济性"
      desc="三版本成本结构（模型 / 存储 / 基础设施与支持）；每席与每任务成本目标：简单 ≤$0.5、中等 ≤$5、大型 ≤$50；敏感度分析支持一键重算。"
      volume="卷 31"
      manifest="G4-01"
      cli="oc econ model --editions all --sensitivity recalc"
      :status="[{ label: '成本目标不达标即立项阻断', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" theme="primary" @click="recalc">一键重算</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有单位经济性模型"
      empty-desc="缺少成本结构时无法判断版本定价是否可持续；请先补齐模型 / 存储 / 基础设施三项口径。"
      empty-action="初始化三版本口径"
      example-task="测算「模型价 ×1.5」对专业版每席成本的影响"
      what="单位经济学数据加载失败"
      why="价目表与用量聚合不一致，端上不以旧价目出结论（避免定价误判）"
      how="可重试；如需临时口径请附 traceId 与价目版本号"
      trace-id="trace-unit-econ-7c40ba"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard v-for="t in taskCosts" :key="t.label" :label="`${t.label}成本`" :value="t.value" format="cost" icon="discount" :target="t.target" target-kind="max" :hint="`目标 ≤ $${t.target}`" />
        <StatCard label="专业版每席成本" :value="BASE_SEAT" format="cost" icon="user-circle" hint="目标 ≤ $6/席/天（含模型与支持）" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">三版本成本结构（堆叠柱）</div>
          <OcChart type="stacked-bar" :series="structureBars" :height="210" format="percent" :threshold="{ value: 100, label: '占比合计 100%', kind: 'max' }" aria-label="三版本成本结构" />
          <div class="oc-muted" style="font-size: 12px">社区版模型成本为 0（用户自带 Key），成本集中在存储与基础设施；企业版以许可与支持为主。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">敏感度分析（模型价 / 缓存 / 端侧分流）</div>
          <Table :data="d.sensitivity" row-key="factor" size="small" :columns="[{ colKey: 'factor', title: '敏感因子', width: 180 }, { colKey: 'delta', title: '变化', width: 96 }, { colKey: 'impactPct', title: '成本影响', width: 100 }, { colKey: 'note', title: '说明' }]">
            <template #impactPct="{ row }">
              <Tag size="small" :theme="row.impactPct > 0 ? 'danger' : 'success'" variant="outline">{{ row.impactPct > 0 ? '+' : '' }}{{ row.impactPct }}%</Tag>
            </template>
          </Table>
          <div class="oc-state__hint">敏感度用于定价压力测试：任一因子导致每席成本超目标 20% 时，需先做优化（提示词缓存 / 路由）再调整定价。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">成本结构明细（含每席 / 每任务成本与毛利）</div>
        <Table :data="editions" :columns="structureColumns" row-key="name" size="small">
          <template #model="{ row }">{{ row.model }}%</template>
          <template #storage="{ row }">{{ row.storage }}%</template>
          <template #infra="{ row }">{{ row.infra }}%</template>
          <template #perSeatUsd="{ row }">${{ row.perSeatUsd }}</template>
          <template #perTaskUsd="{ row }">${{ row.perTaskUsd }}</template>
          <template #marginPct="{ row }">
            <Tag size="small" :theme="row.marginPct >= 35 ? 'success' : 'warning'" variant="light-outline">{{ row.marginPct }}%</Tag>
          </template>
          <template #note="{ row }"><span class="oc-muted">{{ row.note }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">重算参数（一键重算按当前参数得出结果）</div>
          <div class="oc-stack">
            <div class="oc-flex" style="gap: 8px">
              <span style="width: 150px">模型价系数</span>
              <InputNumber v-model="priceFactor" :min="0.5" :max="3" :step="0.1" size="small" theme="column" />
            </div>
            <div class="oc-flex" style="gap: 8px">
              <span style="width: 150px">缓存命中提升（pp）</span>
              <InputNumber v-model="cacheDelta" :min="0" :max="40" :step="5" size="small" theme="column" />
            </div>
            <div class="oc-flex" style="gap: 8px">
              <span style="width: 150px">端侧分流比例（%）</span>
              <InputNumber v-model="edgeOffload" :min="0" :max="40" :step="5" size="small" theme="column" />
            </div>
            <div class="oc-muted" style="font-size: 12px">
              口径：每席 = 基线 $162 × (1 + 0.6×(模型价系数−1)) × (1 − 0.006×缓存 pp) × (1 − 0.0045×端侧分流%)；参数为默认值时复现「+30% / −12% / −9%」三条敏感度结论。
            </div>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">重算结果</div>
          <InfoGrid
            :columns="2"
            :items="[
              { key: 'seat', label: '重算每席成本', value: `$${recalculated.seat}`, tag: recalculated.deltaPct > 20 ? { text: `较基线 ${recalculated.deltaPct}%`, theme: 'danger' } : { text: `较基线 ${recalculated.deltaPct}%`, theme: 'success' } },
              { key: 'task', label: '重算每任务成本', value: `$${recalculated.task}` },
              { key: 'base', label: '基线每席成本', value: `$${BASE_SEAT}` },
              { key: 'mix', label: '当前参数', value: `价格 ×${priceFactor} / 缓存 +${cacheDelta}pp / 端侧 ${edgeOffload}%` },
            ]"
          />
          <div class="oc-state__hint">重算不改变既有报价与合同，仅用于内部压力测试；结论变更需在成本评审留痕。</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
