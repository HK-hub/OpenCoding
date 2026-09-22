<script setup lang="ts">
/**
 * 成本看板（N-06）：趋势 + 六维归因 + 预算水位 + 缓存折扣单列。
 * 溯源：卷 31 §4.3 / §4.2
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import { downloadCsv } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const dim = ref('team');
const trend = computed(() => d.cost.trend.map((t) => ({ x: t.day, y: t.totalUsd })));
const budgetLine = computed(() => d.cost.trend.map((t) => ({ x: t.day, y: t.budgetUsd })));
const dimOptions = computed(() => d.cost.dims.map((x) => ({ label: x.label, value: x.key })));
const drillTotal = computed(() => d.cost.drilldown.reduce((a, b) => a + b.costUsd, 0));
const cacheHits = computed(() => d.cost.drilldown.filter((x) => x.cacheHit).length);

/** 导出报表：六维归因 + 缓存折扣 + 对账 + 14 天趋势，全部取自当前看板数据 */
function exportReport() {
  const rows: (string | number)[][] = [
    ['维度', '金额(USD)', '占比(%)', '缓存折扣(USD)', '异常', '说明'],
    ...d.cost.dims.map((x) => [x.label, x.amountUsd, x.sharePct, x.cacheDiscountUsd, x.anomaly ? '是' : '否', x.note] as (string | number)[]),
    [],
    ['对账窗口', '聚合(USD)', '账单(USD)', '误差(%)', '结论'],
    [d.cost.reconciliation.window, d.cost.reconciliation.attributedUsd, d.cost.reconciliation.billedUsd, d.cost.reconciliation.errorPct, d.cost.reconciliation.pass ? '通过' : '不通过'],
    [],
    ['缓存读取 token', '缓存写入 token', '命中率(%)', '节省(USD)', '惩罚说明'],
    [d.cost.cache.cacheReadTokens, d.cost.cache.cacheWriteTokens, d.cost.cache.hitRatePct, d.cost.cache.savedUsd, d.cost.cache.penaltyNote],
    [],
    ['日期', '日成本(USD)', '日预算(USD)'],
    ...d.cost.trend.map((t) => [t.day, t.totalUsd, t.budgetUsd] as (string | number)[]),
  ];
  const file = downloadCsv(rows, `cost-report-${Date.now()}.csv`);
  MessagePlugin.success('已生成 ' + file);
}

onMounted(() => {
  setTimeout(() => { state.value = d.cost.trend.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="成本看板"
      desc="日/周/月趋势 + 六维归因（租户/项目/团队/会话/模型/工具）+ 缓存折扣单列；异常检测（偏离基线 > 50% 告警）并可下钻到单次调用。"
      volume="卷 31"
      manifest="N-06"
      cli="oc cost report --window 14d --by team --with-cache"
      :status="[{ label: '对账误差 ≤ 0.5%', theme: 'success' }, { label: '缓存单列', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">刷新</Button>
        <Button size="small" theme="primary" @click="exportReport">导出报表</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      missing-permission="billing.read"
      risk-level="R2"
      apply-path="计费数据为受限数据：请在「角色与权限 → 申请授权」提交（需 Auditor/Owner 审批）"
      empty-title="该窗口内没有成本数据"
      empty-desc="可能因窗口过窄或该范围无用量；可切换到 30 天窗口，或检查是否命中遥测/计量开关关闭。"
      empty-action="切换到 30 天"
      example-task="查看哪个团队成本异常并下钻到具体任务"
      what="成本看板加载失败"
      why="聚合任务滞后（消费者 lag > 60s，al-06 已触发）或对账窗口未闭合"
      how="可重试；滞后恢复后自动追平，历史窗口数据不受影响"
      trace-id="trace-cost-51a8c2"
      @retry="state = 'LOADING'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="本月成本" :value="8680" format="cost" unit="USD" :target="12000" target-kind="max" icon="discount" hint="预算水位 72%" />
        <StatCard label="缓存折扣（单列）" :value="d.cost.cache.savedUsd" format="cost" unit="USD" lower-is-better hint="命中率 71.4%" />
        <StatCard label="缓存命中率" :value="d.cost.cache.hitRatePct" format="percent" :target="70" target-kind="min" />
        <StatCard label="对账误差" :value="d.cost.reconciliation.errorPct" format="percent" :target="1" target-kind="max" hint="目标 ≤ 1%（口径：聚合 vs 账单）" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">14 天趋势（含预算线）</div>
          <div class="oc-flex" style="gap: 4px">
            <Tag v-for="o in dimOptions" :key="o.value" size="small" :theme="dim === o.value ? 'primary' : 'default'" variant="light-outline" style="cursor: pointer" @click="dim = o.value">
              {{ o.label }}
            </Tag>
          </div>
        </div>
        <OcChart
          type="line"
          :series="[{ name: '日成本', points: trend }, { name: '日预算', points: budgetLine, color: '#8e5ee5' }]"
          :height="220"
          format="cost"
          unit="USD"
          aria-label="成本趋势"
        />
        <div class="oc-muted" style="font-size: 12px">
          缓存失效惩罚：命中率 70% → 0% 时输入成本上升 170%（约 +$2,100/月）——这是把缓存折扣单列的原因。
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">六维归因</div>
          <Table :data="d.cost.dims" row-key="key" size="small">
            <template #label="{ row }">
              <span>{{ row.label }}</span>
              <Tag v-if="row.anomaly" size="small" theme="danger" variant="light-outline" style="margin-left: 4px">异常</Tag>
            </template>
            <template #amountUsd="{ row }"><span class="oc-mono">${{ row.amountUsd.toLocaleString('zh-CN') }}</span></template>
            <template #cacheDiscountUsd="{ row }"><span class="oc-mono">-${{ row.cacheDiscountUsd }}</span></template>
            <template #note="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.note }}</span></template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">异常标记（偏离基线 > 50%）</div>
          <div class="oc-stack">
            <div v-for="a in d.cost.anomalies" :key="a.id" class="oc-card" style="box-shadow: none">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag size="small" :theme="a.deviationPct > 0 ? 'danger' : 'success'" variant="light-outline">{{ a.deviationPct > 0 ? '+' : '' }}{{ a.deviationPct }}%</Tag>
                <b style="font-size: 12px">{{ a.scope }}</b>
                <span class="oc-muted">{{ new Date(a.at).toLocaleString('zh-CN') }}</span>
              </div>
              <div class="oc-muted" style="font-size: 12px">原因：{{ a.cause }}；动作：{{ a.action }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">下钻到单次调用（合计 ${{ drillTotal.toFixed(2) }}，缓存命中 {{ cacheHits }}/{{ d.cost.drilldown.length }}）</div>
          <CopyableId id="trace-cost-drill-0912" label="复制 traceId" />
        </div>
        <Table :data="d.cost.drilldown" row-key="at" size="small">
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #taskId="{ row }"><span class="oc-mono">{{ row.taskId }}</span></template>
          <template #inputTokens="{ row }">{{ (row.inputTokens / 1000).toFixed(1) }}k</template>
          <template #outputTokens="{ row }">{{ (row.outputTokens / 1000).toFixed(2) }}k</template>
          <template #costUsd="{ row }"><span class="oc-mono">${{ Number(row.costUsd).toFixed(4) }}</span></template>
          <template #cacheHit="{ row }">
            <Tag size="small" :theme="row.cacheHit ? 'success' : 'default'" variant="light-outline">{{ row.cacheHit ? '缓存命中' : '未命中' }}</Tag>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
