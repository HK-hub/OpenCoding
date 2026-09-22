<script setup lang="ts">
/**
 * 成本与用量（S-13）：KPI、六维聚合切换、模型堆叠图、工具环形图、异常标记与下钻抽屉。
 * 口径：成本 4 位小数、误差 ≤1%、缓存折扣单列（不混入净成本）。溯源：卷 31 §4.1。
 */
import { computed, onMounted, ref } from 'vue';
import { Drawer, MessagePlugin, Table, Tabs, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { db } from '@/mock/db';

interface DrillRow {
  key: string;
  calls: number;
  tokens: number;
  cost: number;
  cacheSaved: number;
  deltaPct: number;
}

const ui = useUiStore();
const cost = db.sessionCost;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const dimension = ref('session');
const activeRow = ref<DrillRow | null>(null);

const DIMENSIONS = [
  { value: 'session', label: '会话', keys: ['S-4001（当前）', 'S-4002 排查登录态', 'S-4003 账务聚合'] },
  { value: 'task', label: '任务', keys: ['T-7f3a 幂等重试', 'T-7f2a 回执排查', 'T-7f19 对账重构'] },
  { value: 'team', label: '团队', keys: ['payment-core', 'identity-gateway', 'billing-ledger'] },
  { value: 'model', label: '模型', keys: ['claude-sonnet-4.5', 'gpt-5.1（子 Agent）', 'text-embedding-3-large'] },
  { value: 'day', label: '日', keys: ['09-19', '09-20', '09-21'] },
];
/** 份额与偏差为固定字面量（确定性演示）：第二行 >50% 偏离基线 → 异常标记 */
const SHARES = [0.62, 0.25, 0.13];
const DELTAS = [18, 62, -8];

const rows = computed<DrillRow[]>(() => {
  const dim = DIMENSIONS.find((d) => d.value === dimension.value) ?? DIMENSIONS[0];
  return dim.keys.map((key, i) => ({
    key,
    calls: Math.round([412, 168, 96][i] * (dimension.value === 'day' ? 1.8 : 1)),
    tokens: Math.round((cost.inputTokens + cost.outputTokens) * SHARES[i]),
    cost: Number((cost.total * SHARES[i]).toFixed(4)),
    cacheSaved: Number((cost.total * SHARES[i] * 0.21).toFixed(4)),
    deltaPct: DELTAS[i],
  }));
});
const anomalyCount = computed(() => rows.value.filter((r) => Math.abs(r.deltaPct) > 50).length);

const columns = [
  { colKey: 'key', title: '维度键', width: 210 },
  { colKey: 'calls', title: '调用次数', width: 100 },
  { colKey: 'tokens', title: 'token（入+出）', width: 140 },
  { colKey: 'cost', title: '成本（USD，4 位小数）', width: 180 },
  { colKey: 'cacheSaved', title: '缓存折扣（单列）', width: 150 },
  { colKey: 'deltaPct', title: '偏离基线', width: 140 },
];

onMounted(() => {
  window.setTimeout(() => { state.value = cost.total ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="成本与用量"
      desc="本会话成本、预算与 token 结构；按会话/任务/团队/模型/日切换聚合；缓存折扣单列，偏离基线 >50% 显式标记。"
      volume="卷 31"
      manifest="S-13"
      cli="oc cost overview --session S-4001 --group-by model --show-cache-saved"
      :status="[{ label: `$${cost.total} / 预算 $${cost.budget}`, theme: 'primary' }, { label: '缓存折扣单列', theme: 'default' }]"
    >
      <template #actions>
        <Tooltip content="把成本归因到上下文区段与具体调用，并给出可执行优化项">
          <Tag size="small" variant="outline">下钻：为什么这么贵</Tag>
        </Tooltip>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚无计量数据"
      empty-desc="本会话还没有模型调用（计量从第一次请求开始记录），因此无成本可展示。"
      empty-action="返回会话工作台"
      example-task="按「模型」维度聚合，下钻查看 run_command 的单次调用与缓存命中"
      what="成本面板加载失败"
      why="计量账本读取失败（usage 事件序号与账本不一致）"
      how="可重试；失败时展示上次成功聚合并标注时间，不以估算值冒充实测"
      trace-id="trace-cost-2c07"
      collapsed-summary="下钻行超过单页阈值，仅渲染前 20 行（更细粒度按需加载）。"
      :page-size="20"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('已返回会话工作台（只读跳转）')"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="本会话成本" :value="cost.total" format="cost" icon="discount" :target="cost.budget" target-kind="max" :lower-is-better="true" />
        <StatCard label="预算" :value="cost.budget" format="cost" icon="dashboard" />
        <StatCard label="输入 token" :value="cost.inputTokens" format="token" icon="upload" />
        <StatCard label="输出 token" :value="cost.outputTokens" format="token" icon="download" />
      </div>
      <div class="oc-grid oc-grid--4" style="margin-top: 10px">
        <StatCard label="缓存读取 token" :value="cost.cacheReadTokens" format="token" icon="refresh" hint="缓存读取按折扣单价计费" />
        <StatCard label="推理 token" :value="cost.reasoningTokens" format="token" icon="robot" hint="思考预算内计量" />
        <StatCard label="TTFB（首字节）" :value="cost.ttfbMs" unit="ms" icon="time" :lower-is-better="true" />
        <StatCard label="总耗时" :value="cost.totalMs" unit="ms" icon="history" :lower-is-better="true" />
      </div>

      <Tabs v-model="dimension" :options="DIMENSIONS.map((d) => ({ label: d.label, value: d.value }))" style="margin-top: 10px" />

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">按模型序列的累计成本（堆叠）</div>
          <OcChart type="stacked-bar" :series="cost.byModelSeries" :height="220" format="cost" aria-label="按模型序列的累计成本" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">工具调用成本分布</div>
          <OcChart type="donut" :values="cost.byTool" :height="220" format="cost" aria-label="工具调用成本分布" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">下钻表格（点击行打开单次调用）</div>
        <Table :data="rows" row-key="key" size="small" :columns="columns" :pagination="undefined" @row-click="(ctx: { row: unknown }) => (activeRow = ctx.row as DrillRow)">
          <template #tokens="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.tokens.toLocaleString('zh-CN') }}</span></template>
          <template #cost="{ row }"><span class="oc-mono" style="font-size: 11px">${{ row.cost.toFixed(4) }}</span></template>
          <template #cacheSaved="{ row }"><span class="oc-mono" style="font-size: 11px">−${{ row.cacheSaved.toFixed(4) }}</span></template>
          <template #deltaPct="{ row }">
            <Tag size="small" :theme="Math.abs(row.deltaPct) > 50 ? 'danger' : 'default'" variant="light-outline">
              {{ row.deltaPct > 0 ? '+' : '' }}{{ row.deltaPct }}%{{ Math.abs(row.deltaPct) > 50 ? ' · 偏离基线 >50%' : '' }}
            </Tag>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          异常标记不阻断：偏离基线 >50% 仅显式提示，是否行动由你决定（{{ anomalyCount }} 项命中）。
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">口径说明</div>
        <InfoGrid :columns="3" :items="[
          { key: 'scale', label: '精度', value: '成本保留 4 位小数（展示与导出同精度）' },
          { key: 'err', label: '误差', value: '与账单对账误差 ≤1%（超差需显式标注）' },
          { key: 'cache', label: '缓存折扣', value: '缓存读取/写入单独列示，不混入净成本' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc cost overview --group-by day --show-cache-saved --export csv" />
          <CopyableId id="trace-cost-2c07" label="复制 traceId" />
        </div>
      </div>

      <Drawer :visible="Boolean(activeRow)" :header="`单次调用 · ${activeRow?.key ?? ''}`" size="420px" :footer="false" @close="activeRow = null">
        <div v-if="activeRow" class="oc-stack">
          <InfoGrid :columns="1" :items="[
            { key: 'model', label: '模型', value: activeRow.key, mono: true },
            { key: 'calls', label: '聚合调用次数', value: activeRow.calls },
            { key: 'tokens', label: 'token', value: activeRow.tokens.toLocaleString('zh-CN') },
            { key: 'cost', label: '成本', value: `$${activeRow.cost.toFixed(4)}` },
            { key: 'cache', label: '缓存折扣', value: `−$${activeRow.cacheSaved.toFixed(4)}` },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
            <Tag size="small" theme="success" variant="light-outline">缓存命中（前缀复用）</Tag>
            <Tag size="small" variant="outline">TTFB {{ cost.ttfbMs }}ms</Tag>
            <CopyableId :id="`trace-call-${activeRow.key.slice(0, 6).replace(/[^a-z0-9]/gi, '')}-8f21`" label="复制 traceId" />
          </div>
          <div class="oc-muted" style="font-size: 12px">单次调用明细与账本一致：入参/出参 token、缓存读写、单价与折扣均可逐项核对（误差 ≤1%）。</div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
