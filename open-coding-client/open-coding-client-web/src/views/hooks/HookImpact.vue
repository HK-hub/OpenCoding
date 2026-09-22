<script setup lang="ts">
/**
 * hooks 影响面与 dry-run（H-05）：只观察不改写 + 触发次数 / 阻断率 / 改写次数 / 平均耗时。
 * 溯源：卷 17 D-HOOK-8 调试与治理；用历史窗口评估新钩子上线后的影响，避免「上线即阻断一切」。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import StateShell from '@/components/common/StateShell.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { HOOK_CAP_LABEL, SCOPE_LABEL, fmtMs, useExtList } from '@/components/extension/useExtList';
import { downloadJson } from '@/utils/download';

const router = useRouter();
const hooks = extensionData.hooks;
const dryRun = ref(true);

const { keyword, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(hooks, {
  persistKey: 'hook-impact',
  pageSize: 10,
  match: (h, kw) => !kw || `${h.id}${h.name}${h.point}`.toLowerCase().includes(kw),
});

const totals = computed(() => ({
  executions: hooks.reduce((a, h) => a + h.stats.executions, 0),
  blocked: hooks.reduce((a, h) => a + Math.round((h.stats.blockRate / 100) * h.stats.executions), 0),
  rewrites: hooks.reduce((a, h) => a + h.stats.rewriteCount, 0),
  avgLatency: Math.round(hooks.reduce((a, h) => a + h.stats.avgLatencyMs, 0) / hooks.length),
}));

/** 影响面提示：阻断率过高 / 平均耗时接近总预算 / 改写冲突风险 */
const advice = computed(() => {
  const items: { level: 'warning' | 'danger'; text: string }[] = [];
  hooks.forEach((h) => {
    if (h.stats.blockRate > 25) items.push({ level: 'warning', text: `${h.id} 阻断率 ${h.stats.blockRate}% 偏高：建议收窄 match 条件（避免误拦正常流程）` });
    if (h.stats.avgLatencyMs > 800) items.push({ level: 'warning', text: `${h.id} 平均耗时 ${fmtMs(h.stats.avgLatencyMs)}：接近单钩子 2s 上限，建议改为异步观察` });
    if (h.stats.circuitDisabled) items.push({ level: 'danger', text: `${h.id} 已因连续失败被熔断禁用：修复脚本后手动启用（当前该点无干预）` });
  });
  return items;
});

const trendSeries = computed(() => [
  { name: '触发次数', points: [120, 168, 210, 246, 288, 332, 366, 402, 436, 470].map((y, i) => ({ x: `#${i + 1}`, y })) },
  { name: '改写次数', points: [12, 18, 22, 26, 31, 38, 42, 47, 52, 58].map((y, i) => ({ x: `#${i + 1}`, y })) },
]);

const columns = [
  { colKey: 'name', title: '钩子', width: 260 },
  { colKey: 'point', title: '钩子点', width: 210 },
  { colKey: 'scope', title: '作用域', width: 140 },
  { colKey: 'cap', title: '能力', width: 130 },
  { colKey: 'exec', title: '触发次数', width: 110 },
  { colKey: 'block', title: '阻断率', width: 110 },
  { colKey: 'rewrite', title: '改写次数', width: 110 },
  { colKey: 'latency', title: '平均耗时', width: 120 },
];

/** 导出影响面报告：聚合口径与钩子明细取自本页当前过滤结果（matched）与统计计算属性 */
function exportReport() {
  const filename = `oc-hooks-impact-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson(
    {
      window: '7d',
      dryRun: dryRun.value,
      totals: totals.value,
      advice: advice.value,
      trend: trendSeries.value,
      hooks: matched.value.map((h) => ({
        id: h.id,
        name: h.name,
        point: h.point,
        scope: h.scope,
        capability: h.capability,
        match: h.match,
        failurePolicy: h.failurePolicy,
        enabled: h.enabled,
        stats: h.stats,
      })),
    },
    filename,
  );
  MessagePlugin.success(`已导出影响面报告（${filename}，${matched.value.length} 个钩子）`);
}
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="hooks 影响面与 dry-run"
      desc="用历史窗口评估钩子影响：只看不改（dry-run）先行验证，再决定是否转为实际干预。"
      volume="卷 17" manifest="H-05" cli="oc hooks impact --window 7d --dry-run"
      :status="[
        { label: dryRun ? 'dry-run 开启（只观察）' : '实际干预生效', theme: dryRun ? 'warning' : 'danger' },
        { label: '窗口 7 天', theme: 'default' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/hooks')">返回列表</Button>
        <Button size="small" variant="outline" @click="exportReport">导出报告</Button>
      </template>
    </PageHeader>

    <div class="oc-card">
      <div class="oc-flex--between oc-flex--wrap" style="gap: 10px">
        <div class="oc-flex" style="gap: 10px">
          <span class="oc-secondary" style="font-size: 13px">dry-run 全局开关</span>
          <Switch v-model="dryRun" @change="(v) => MessagePlugin.warning(v ? '已开启 dry-run：所有钩子只观察不改写（阻断也不生效）' : '已关闭 dry-run：阻断与改写将实际生效')" />
        </div>
        <span class="oc-muted" style="font-size: 12px">
          <OcIcon name="help" size="12px" /> dry-run 期间仍记录「本应阻断/本应改写」明细，用于评估误伤率
        </span>
      </div>
    </div>

    <Alert
      v-if="dryRun"
      theme="warning"
      message="当前为 dry-run：钩子判定结果不生效"
      description="适用于新钩子上线前的灰度验证；关闭后改写会立即影响参数与结果（并重新走权限决策）。"
    />

    <div class="oc-grid oc-grid--4">
      <StatCard label="窗口内触发总数" :value="totals.executions" unit="次" icon="link" :trend="[120, 168, 210, 246, 288, 332, 366, 402, 436, totals.executions / 10]" />
      <StatCard label="阻断次数" :value="totals.blocked" unit="次" icon="lock" :lower-is-better="true" hint="阻断即终止后续钩子" />
      <StatCard label="改写次数" :value="totals.rewrites" unit="次" icon="edit" :lower-is-better="true" hint="改写均记录 diff" />
      <StatCard label="平均单钩子耗时" :value="totals.avgLatency" unit="ms" icon="time" :target="2000" target-kind="max" hint="总预算 5s / 次调用" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">触发与改写趋势（10 个窗口）</h3>
        <OcChart type="line" :series="trendSeries" :height="200" aria-label="钩子触发与改写趋势" />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          优化建议
          <Tag size="small" :theme="advice.length ? 'warning' : 'success'" variant="light-outline">{{ advice.length }} 条</Tag>
        </h3>
        <div v-if="advice.length" class="oc-stack" style="gap: 6px">
          <div v-for="a in advice" :key="a.text" class="oc-flex" style="gap: 6px; align-items: flex-start">
            <Tag size="small" :theme="a.level" variant="light-outline">{{ a.level === 'danger' ? '熔断' : '建议' }}</Tag>
            <span style="font-size: 12px">{{ a.text }}</span>
          </div>
        </div>
        <div v-else class="oc-muted" style="font-size: 12px">当前无优化建议：阻断率与耗时均在合理区间。</div>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="10"
      empty-title="窗口内没有钩子执行记录"
      empty-desc="默认零钩子或所选窗口内无匹配调用；安装模板或放宽窗口后可见影响面。"
      empty-action="打开模板库"
      example-task="评估「敏感扫描」钩子上线后预计阻断多少提交"
      what="影响面数据加载失败"
      why="事件存储查询超时（窗口内事件量过大，未命中分区索引）。"
      how="可重试；或缩短窗口到 24h。"
      trace-id="trace-hook-impact-77b2"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="router.push('/extension/hooks/templates')"
    >
      <Table row-key="id" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.id }}</span>
              <b style="font-size: 13px">{{ row.name }}</b>
            </div>
            <span class="oc-muted" style="font-size: 11px">{{ row.match.toolName || row.match.commandPattern || row.match.eventType || '匹配全部' }}</span>
          </div>
        </template>
        <template #point="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.point }}</span></template>
        <template #scope="{ row }"><Tag size="small" variant="outline">{{ SCOPE_LABEL[row.scope] }}</Tag></template>
        <template #cap="{ row }">
          <Tag size="small" :theme="row.capability === 'block' ? 'danger' : row.capability === 'rewrite' ? 'warning' : 'primary'" variant="light-outline">
            {{ HOOK_CAP_LABEL[row.capability] }}
          </Tag>
        </template>
        <template #exec="{ row }"><span class="oc-mono">{{ row.stats.executions }}</span></template>
        <template #block="{ row }">
          <Tooltip :content="dryRun ? 'dry-run 下不实际阻断（仅记录本应阻断）' : '实际阻断生效'">
            <Tag size="small" :theme="row.stats.blockRate > 25 ? 'warning' : 'default'" variant="light-outline">{{ row.stats.blockRate }}%</Tag>
          </Tooltip>
        </template>
        <template #rewrite="{ row }"><span class="oc-mono">{{ row.stats.rewriteCount }}</span></template>
        <template #latency="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtMs(row.stats.avgLatencyMs) }}</span></template>
      </Table>
    </StateShell>
  </div>
</template>
