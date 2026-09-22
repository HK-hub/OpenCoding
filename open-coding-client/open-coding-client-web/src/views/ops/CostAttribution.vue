<script setup lang="ts">
/**
 * 成本归因（G4-02）：六维切换（租户 / 项目 / 团队 / 会话任务 / 模型 / 工具）、
 * 饼图与堆叠柱图、缓存折扣单列、下钻表 + 单次调用明细抽屉（traceId 可复制）、
 * 偏离基线 >50% 的显式异常标记与对账误差（≤1%）说明。
 * 溯源：卷 31 / BUILD-MANIFEST G4-02
 */
import { computed, onMounted, ref } from 'vue';
import { Drawer, RadioGroup, RadioButton, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const cost = enterpriseData.cost;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const dim = ref(cost.dims[0].key);
const active = ref<{ name: string; calls: number; tokens: number; costUsd: number; sharePct: number; deviationPct: number } | null>(null);

interface Row { name: string; calls: number; tokens: number; costUsd: number; sharePct: number; deviationPct: number; note?: string }
/** 各维度下钻数据（本地确定性；占比合计 100%，异常行给出原因） */
const ROWS: Record<string, Row[]> = {
  tenant: [
    { name: '云枢科技（主租户）', calls: 214800, tokens: 182400000, costUsd: 7420, sharePct: 85.5, deviationPct: 4 },
    { name: '试点租户 · 制造 II 部', calls: 32600, tokens: 24800000, costUsd: 962, sharePct: 11.1, deviationPct: -8 },
    { name: '内部演练租户', calls: 9100, tokens: 6100000, costUsd: 298, sharePct: 3.4, deviationPct: 12 },
  ],
  project: [
    { name: 'data-pipeline', calls: 62400, tokens: 48600000, costUsd: 1560, sharePct: 18.0, deviationPct: 88, note: '批量嵌入未批处理，单次调用计费' },
    { name: 'payment-core', calls: 58200, tokens: 41200000, costUsd: 1340, sharePct: 15.4, deviationPct: 6 },
    { name: '知识库问答', calls: 41800, tokens: 38600000, costUsd: 1180, sharePct: 13.6, deviationPct: -4 },
  ],
  team: [
    { name: '平台工程组', calls: 74800, tokens: 61800000, costUsd: 2180, sharePct: 25.1, deviationPct: 62, note: '长任务自治开启后上下文重复注入（缓存未命中）' },
    { name: '应用研发一组', calls: 52600, tokens: 40200000, costUsd: 1320, sharePct: 15.2, deviationPct: 3 },
    { name: '数据组', calls: 39100, tokens: 29800000, costUsd: 980, sharePct: 11.3, deviationPct: -6 },
  ],
  session: [
    { name: 'task-8801（长任务 · 自治）', calls: 1820, tokens: 18600000, costUsd: 642, sharePct: 7.4, deviationPct: 54, note: '上下文重复注入 + 缓存未命中' },
    { name: 'task-8807（架构评审）', calls: 940, tokens: 8200000, costUsd: 318, sharePct: 3.7, deviationPct: 5 },
    { name: 'task-8813（批量嵌入）', calls: 760, tokens: 6400000, costUsd: 246, sharePct: 2.8, deviationPct: -3 },
  ],
  model: [
    { name: 'claude-sonnet-4.5', calls: 68400, tokens: 58200000, costUsd: 4260, sharePct: 49.1, deviationPct: 8 },
    { name: 'gpt-5-mini（规则路由）', calls: 96400, tokens: 44200000, costUsd: 2480, sharePct: 28.6, deviationPct: -12 },
    { name: 'openai-global（外发敏感）', calls: 21800, tokens: 16400000, costUsd: 1080, sharePct: 12.4, deviationPct: -34, note: '路由切换到 vllm-internal（低价模型，质量门禁已通过）' },
  ],
  tool: [
    { name: 'nexec（沙箱命令）', calls: 112400, tokens: 0, costUsd: 486, sharePct: 5.6, deviationPct: 9 },
    { name: 'web.search（外发）', calls: 18600, tokens: 2400000, costUsd: 372, sharePct: 4.3, deviationPct: 6 },
    { name: 'embed.batch（批处理）', calls: 4200, tokens: 18600000, costUsd: 298, sharePct: 3.4, deviationPct: 52, note: '批处理已启用，历史单次调用仍计入本期' },
  ],
};
const rows = computed(() => ROWS[dim.value] ?? []);
const dimLabel = computed(() => cost.dims.find((d) => d.key === dim.value)?.label ?? '');
const donut = computed(() => rows.value.map((r) => ({ name: r.name, value: r.costUsd })));
const bars = computed(() => [
  { name: '模型与工具支出', points: cost.trend.map((t) => ({ x: t.day, y: t.totalUsd })) },
  { name: '缓存节省（抵扣）', points: cost.trend.map((t) => ({ x: t.day, y: t.cacheSavedUsd })) },
]);
const columns = [
  { colKey: 'name', title: '维度值', width: 230 },
  { colKey: 'calls', title: '调用数', width: 100 },
  { colKey: 'tokens', title: 'token', width: 110 },
  { colKey: 'costUsd', title: '成本', width: 110 },
  { colKey: 'sharePct', title: '占比', width: 90 },
  { colKey: 'deviationPct', title: '偏离基线' },
];

onMounted(() => {
  window.setTimeout(() => {
    state.value = cost.dims.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="成本归因"
      desc="六维归因（租户 / 项目 / 团队 / 会话任务 / 模型 / 工具）+ 缓存折扣单列 + 单次调用下钻；偏离基线 >50% 显式标记原因，对账误差 ≤1%。"
      volume="卷 31"
      manifest="G4-02"
      cli="oc cost attribution --window 24h --top 10 --show-cache"
      :status="[{ label: `对账误差 ${cost.reconciliation.errorPct}%`, theme: cost.reconciliation.pass ? 'success' : 'danger' }]"
    >
      <template #actions>
        <RadioGroup v-model="dim" size="small" variant="default-filled">
          <RadioButton v-for="d in cost.dims" :key="d.key" :value="d.key">{{ d.label }}</RadioButton>
        </RadioGroup>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="当前维度没有可归因数据"
      empty-desc="未产生调用即无成本可归因；若确认有调用，请检查计量上报（失败会以 WARN 记录而非阻断主流程）。"
      empty-action="切换到其它维度"
      example-task="核对「团队」维度下平台工程组用量异常（+62%）"
      what="成本数据加载失败"
      why="计费聚合服务超时；端上不以缓存数据对外承诺金额（对账口径必须一致）"
      how="可重试；导出的归因报告会自动标注「采样窗口」与误差范围"
      trace-id="trace-cost-9b41e7"
      @retry="state = 'LOADING'"
      @empty-action="dim = 'project'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="本期成本（当前维度）" :value="rows.reduce((a, b) => a + b.costUsd, 0)" format="cost" icon="discount" :delta="cost.dims.find((x) => x.key === dim)?.anomaly ? 62 : 4" :lower-is-better="true" />
        <StatCard label="缓存节省（单列）" :value="cost.cache.savedUsd" format="cost" icon="cloud" :lower-is-better="false" :hint="`命中率 ${cost.cache.hitRatePct}%，读 ${(cost.cache.cacheReadTokens / 1e8).toFixed(2)} 亿 token`" />
        <StatCard label="对账误差" :value="cost.reconciliation.errorPct" unit="%" icon="check" target-kind="max" :target="1" :hint="`归因 ${cost.reconciliation.attributedUsd} vs 账单 ${cost.reconciliation.billedUsd}`" />
        <StatCard label="异常项（>50%）" :value="cost.anomalies.filter((a) => Math.abs(a.deviationPct) > 50).length" unit="项" format="raw" icon="flag" :lower-is-better="true" hint="每项必须给出原因与动作" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">占比（{{ dimLabel }} · 环图）</div>
          <OcChart type="donut" :values="donut" :height="210" format="cost" aria-label="维度占比环图" />
          <div class="oc-muted" style="font-size: 12px">占比合计 100%；环图中心为当期合计成本。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">趋势（堆叠柱：支出 vs 缓存抵扣）</div>
          <OcChart type="stacked-bar" :series="bars" :height="210" format="cost" :threshold="{ value: 400, label: '日均预算 $400', kind: 'max' }" aria-label="成本趋势堆叠柱图" />
          <div class="oc-muted" style="font-size: 12px">{{ cost.cache.penaltyNote }}</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">下钻表（点击行查看单次调用明细）</div>
        <Table :data="rows" :columns="columns" row-key="name" size="small" hover @row-click="(ctx: { row: unknown }) => (active = ctx.row as Row)">
          <template #name="{ row }"><span class="oc-mono">{{ row.name }}</span></template>
          <template #calls="{ row }">{{ row.calls.toLocaleString('zh-CN') }}</template>
          <template #tokens="{ row }">{{ (row.tokens / 1e6).toFixed(1) }}M</template>
          <template #costUsd="{ row }">${{ row.costUsd.toLocaleString('zh-CN') }}</template>
          <template #sharePct="{ row }">{{ row.sharePct }}%</template>
          <template #deviationPct="{ row }">
            <div class="oc-flex" style="gap: 4px">
              <Tag size="small" :theme="Math.abs(row.deviationPct) > 50 ? 'danger' : row.deviationPct > 0 ? 'warning' : 'success'" variant="light-outline">
                {{ row.deviationPct > 0 ? '+' : '' }}{{ row.deviationPct }}%
              </Tag>
              <span v-if="row.note" class="oc-muted" style="font-size: 12px">{{ row.note }}</span>
            </div>
          </template>
        </Table>
        <div class="oc-state__hint">对账误差 {{ cost.reconciliation.errorPct }}%（≤1% 视为可接受）：归因口径含缓存抵扣，账单口径为实付；差异来自采样窗口边界。</div>
      </div>

      <Drawer :visible="Boolean(active)" :header="`单次调用明细 · ${active?.name ?? ''}`" size="520px" :footer="false" @close="active = null">
        <div v-if="active" class="oc-stack" style="font-size: 13px">
          <InfoGrid
            :columns="2"
            :items="[
              { key: 'calls', label: '调用数', value: active.calls.toLocaleString('zh-CN') },
              { key: 'tokens', label: 'token 合计', value: `${(active.tokens / 1e6).toFixed(1)}M` },
              { key: 'cost', label: '成本', value: `$${active.costUsd}` },
              { key: 'dev', label: '偏离基线', value: `${active.deviationPct}%`, tag: Math.abs(active.deviationPct) > 50 ? { text: '异常', theme: 'danger' } : { text: '正常', theme: 'success' } },
            ]"
          />
          <div class="oc-divider" />
          <div v-for="c in cost.drilldown.slice(0, 6)" :key="c.taskId" class="oc-flex oc-flex--wrap" style="gap: 6px">
            <span class="oc-mono">{{ c.taskId }}</span>
            <Tag size="small" :theme="c.cacheHit ? 'success' : 'warning'" variant="outline">{{ c.cacheHit ? '缓存命中' : '缓存未命中' }}</Tag>
            <span class="oc-muted">{{ c.model }} · in {{ (c.inputTokens / 1000).toFixed(0) }}k / out {{ c.outputTokens }} · ${{ c.costUsd }}</span>
            <CopyableId :id="`trace-${c.taskId}`" label="复制 traceId" />
          </div>
          <div class="oc-muted" style="font-size: 12px">缓存命中与折扣在下钻中单列显示；未命中调用必须能在提示词资产中找到前缀漂移原因。</div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
