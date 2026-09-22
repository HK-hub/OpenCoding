<script setup lang="ts">
/**
 * Standup 与周报（N3-10）：客观事实层（带事件来源）/ 主观摘要层（标注 AI）/ 环比 / 需关注 / 数据缺口。
 * 溯源：卷 35 §5.3 ⑥；BUILD-MANIFEST N3-10。
 * 契约：客观层字段无事件来源即门禁失败；不得出现无来源的量化断言。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const digests = intelData.digests;
const pickedId = ref(digests[0].id);
const digest = computed(() => digests.find((d) => d.id === pickedId.value)!);

/** 投递记录（本页可见）：渠道 / 时间 / 状态；失败本地留档并重试一次 */
const deliveries = ref<{ id: string; channel: string; at: string; state: string }[]>([
  { id: 'DL-01', channel: digests[0].deliveredTo, at: digests[0].at, state: '成功' },
]);

/** 重新投递：向声明的交付通道重发，并把记录写入「投递记录」 */
function redeliver() {
  const rec = {
    id: `DL-${String(deliveries.value.length + 1).padStart(2, '0')}`,
    channel: digest.value.deliveredTo,
    at: new Date().toISOString(),
    state: '已重投',
  };
  deliveries.value = [rec, ...deliveries.value];
  MessagePlugin.success(`已重新投递到「${digest.value.deliveredTo}」：投递记录 +1（失败会本地留档并重试一次）`);
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onPick(v: unknown) {
  pickedId.value = String(v);
}

const objColumns = [
  { colKey: 'label', title: '客观事实（不可编造）', width: 150 },
  { colKey: 'value', title: '值', ellipsis: true },
  { colKey: 'source', title: '事件来源（缺失即门禁失败）', width: 320, cell: 'src' },
];
const wowSeries = computed(() => [{
  name: '环比变化（%）',
  points: digest.value.wow.map((w) => ({ x: w.metric, y: w.delta })),
}]);

onMounted(() => {
  window.setTimeout(() => (demo.value = digests.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`Standup 与周报 · ${digest.period}`"
      desc="客观事实层（每条带事件来源）+ 主观摘要层（标注 AI 生成）+ 环比 + 「需要关注」+ 数据缺口清单。"
      volume="卷 35" manifest="N3-10" cli="oc ai digest --period week --show-sources"
      :status="[{ label: digest.kind, theme: 'primary' }, { label: `${digest.dataGaps.length} 项数据缺口`, theme: digest.dataGaps.length ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="pickedId" size="small" style="width: 230px" aria-label="选择报告" :options="digests.map((d) => ({ value: d.id, label: `${d.kind} · ${d.period}` }))" @change="onPick" />
        <Button size="small" variant="outline" @click="redeliver">重新投递</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在聚合事件并生成客观事实层…"
      empty-title="暂无汇总" empty-desc="周期内没有事件；无事件时输出空报告并说明，不做推断。"
      empty-action="生成本期汇总" example-task="查看「需要关注」清单，确认每条都可追溯到事件来源"
      what="汇总生成失败" why="数据源缺失或交付通道不可用（本地留档并重试一次）"
      how="补齐数据源或修复通道后重试；缺口会显式列出而非静默" trace-id="trace-1de9c46b"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--3">
        <div class="oc-card">
          <div class="oc-card__title">报告元信息</div>
          <div class="oc-stack" style="gap: 4px; font-size: 13px">
            <span>类型：<Tag size="small" variant="light-outline" theme="primary">{{ digest.kind }}</Tag></span>
            <span>周期：{{ digest.period }}</span>
            <span>交付：{{ digest.deliveredTo }}</span>
            <span>生成时间：{{ new Date(digest.at).toLocaleString('zh-CN') }}</span>
            <span class="oc-muted" style="font-size: 12px">生成器：gpt-5.1-mini · prompt digest@v8（主观层标注 AI）</span>
            <div class="oc-divider" />
            <span style="font-size: 12px">投递记录（{{ deliveries.length }}）· 失败本地留档并重试一次</span>
            <div v-for="d in deliveries" :key="d.id" class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px">
              <Tag size="small" :theme="d.state === '成功' ? 'success' : 'warning'" variant="light-outline">{{ d.state }}</Tag>
              <span class="oc-mono">{{ d.channel }}</span>
              <span class="oc-muted">{{ new Date(d.at).toLocaleString('zh-CN') }}</span>
            </div>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">需关注清单</div>
          <div v-for="(a, i) in digest.attention" :key="i" class="oc-flex" style="gap: 6px; margin-bottom: 6px">
            <Tag size="small" theme="warning" variant="light-outline">需关注</Tag>
            <span style="font-size: 13px">{{ a }}</span>
          </div>
          <div v-if="!digest.attention.length" class="oc-muted">本期无需关注项。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">数据缺口清单（明确列出，不推断）</div>
          <div v-for="(g, i) in digest.dataGaps" :key="i" class="oc-flex" style="gap: 6px; margin-bottom: 6px">
            <Tag size="small" theme="danger" variant="light-outline">缺口</Tag>
            <span style="font-size: 13px">{{ g }}</span>
          </div>
          <div v-if="!digest.dataGaps.length" class="oc-muted">本期数据完整。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">客观事实层（带事件来源；无来源即门禁失败）<CliHint :command="`oc ai digest sources ${digest.id}`" /></div>
        <Table :data="digest.objective" :columns="objColumns" row-key="label" size="small" :pagination="undefined">
          <template #src="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.source }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">主观摘要层（标注 AI 生成 + 引用依据）</div>
          <div v-for="(s, i) in digest.subjective" :key="i" class="oc-stack" style="gap: 2px; margin-bottom: 8px">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" theme="warning" variant="light-outline">AI 生成</Tag>
              <span style="font-size: 13px">{{ s.text }}</span>
            </div>
            <span class="oc-muted" style="font-size: 11px">{{ s.citation }}</span>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">环比（与上一周期）</div>
          <OcChart type="bar" :series="wowSeries" :height="190" unit="%" aria-label="环比变化" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 6px">
            <Tag v-for="w in digest.wow" :key="w.metric" size="small" variant="outline">
              {{ w.metric }}：{{ w.prev }} → {{ w.current }}（{{ w.delta > 0 ? '+' : '' }}{{ w.delta }}%）
            </Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">环比基于同口径历史；口径变更会显式标注（否则不出量化断言）。</div>
        </div>
      </div>

      <Alert theme="info" style="margin-top: 12px"
        message="交付通道失败 → 本地留档并重试一次；客观层字段无事件来源会被门禁拦截，不以「推断」补齐。" />
    </StateShell>
  </div>
</template>
