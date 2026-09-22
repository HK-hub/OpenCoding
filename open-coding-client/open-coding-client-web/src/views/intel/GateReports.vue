<script setup lang="ts">
/**
 * 门禁拦截报告（N3-13）：拦截层（结构 / 引用 / 安全 / 人工门）+ 理由码 + 修复建议。
 * 溯源：卷 35 §5.1 质量门禁链 / §5.6；BUILD-MANIFEST N3-13。
 * 契约：三层顺序固定（结构 → 引用 → 安全），任一层失败即停；不输出半成品给人类。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import type { GateBlock, GateLayer } from '@/mock/data/automation';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const blocks = intelData.gateBlocks;
const layerFilter = ref<'全部' | GateLayer>('全部');

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onLayer(v: unknown) {
  layerFilter.value = String(v) as '全部' | GateLayer;
}

const rows = computed(() => (layerFilter.value === '全部' ? blocks : blocks.filter((b) => b.layer === layerFilter.value)));
const layerValues = computed(() => ['结构', '引用', '安全', '人工门'].map((l) => ({ name: l, value: blocks.filter((b) => b.layer === l).length })));

const columns = [
  { colKey: 'layer', title: '拦截层', width: 110, cell: 'layer' },
  { colKey: 'reasonCode', title: '理由码', width: 240, cell: 'code' },
  { colKey: 'capabilityId', title: '能力', width: 140 },
  { colKey: 'reason', title: '理由', ellipsis: true },
  { colKey: 'fix', title: '修复建议', ellipsis: true },
  { colKey: 'at', title: '时间', width: 160, cell: 'at' },
];
const LAYER_THEME: Record<GateLayer, 'primary' | 'warning' | 'danger' | 'success'> = { 结构: 'primary', 引用: 'warning', 安全: 'danger', 人工门: 'success' };

function explain(row: GateBlock) {
  MessagePlugin.success(`已展开拦截理由：${row.reasonCode}（不输出半成品给人类；修复后可重跑能力）`);
}

/** 导出拦截报告：当前筛选层下的拦截记录（含理由码与修复建议）+ 分层统计 */
function exportReport() {
  const file = downloadJson(
    {
      filter: { layer: layerFilter.value, viewState: demo.value },
      totalBlocked: blocks.length,
      matchedCount: rows.value.length,
      layerDistribution: layerValues.value,
      gateChain: ['① 结构校验', '② 引用校验', '③ 安全扫描', '④ 条件人工门（不可用时 fail-closed）'],
      blocks: rows.value.map((b) => ({
        id: b.id,
        capabilityId: b.capabilityId,
        layer: b.layer,
        reasonCode: b.reasonCode,
        reason: b.reason,
        fix: b.fix,
        at: b.at,
        outputRef: b.outputRef,
      })),
      redactionNote: '门禁链顺序固定（结构 → 引用 → 安全 → 人工门），任一层失败即停；报告不含任何密钥材料',
    },
    `oc-intel-gate-blocks-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出拦截报告：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = blocks.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="门禁拦截报告"
      desc="三层质量门禁链（结构 → 引用 → 安全）+ 条件人工门；任一层失败即拦截，返回拦截层名与理由，并给修复建议。"
      volume="卷 35" manifest="N3-13" cli="oc ai gate blocks --capability all --with-fix"
      :status="[{ label: `${blocks.length} 次拦截`, theme: blocks.length ? 'warning' : 'success' }, { label: '顺序固定不可跳层', theme: 'primary' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="layerFilter" size="small" style="width: 140px" aria-label="按拦截层筛选" :options="['全部', '结构', '引用', '安全', '人工门'].map((l) => ({ value: l, label: l }))" @change="onLayer" />
        <Button size="small" variant="outline" @click="exportReport">导出报告</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取门禁拦截记录…"
      empty-title="没有拦截记录" empty-desc="近期所有能力产出均通过三层门禁；拦截记录保留用于理由码统计。"
      empty-action="查看草稿收件箱" example-task="查看一条「引用覆盖率不足」拦截，确认修复建议与阈值"
      what="拦截报告加载失败" why="门禁审计存储不可达（拦截理由需与运行记录联查）"
      how="重试；拦截本身不影响运行主链路（超预算/越权限仍会按策略中断）" trace-id="trace-9f2c4a71"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="结构层拦截" :value="blocks.filter((b) => b.layer === '结构').length" icon="layers" :lower-is-better="true" hint="schema 不符 / 归属标注缺失（C1）" />
        <StatCard label="引用层拦截" :value="blocks.filter((b) => b.layer === '引用').length" icon="link" :lower-is-better="true" hint="引用覆盖率不足 / 客观层无来源" />
        <StatCard label="安全层拦截" :value="blocks.filter((b) => b.layer === '安全').length" icon="secured" :lower-is-better="true" hint="密钥 / 危险 API / 写路径越界" />
        <StatCard label="人工门" :value="blocks.filter((b) => b.layer === '人工门').length" icon="user" :lower-is-better="false" hint="高风险写入需人工确认（与审批衔接）" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">拦截层分布</div>
          <OcChart type="donut" :values="layerValues" :height="200" aria-label="拦截层分布" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">门禁链语义<CliHint command="oc ai gate explain --layer all" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'l1', label: '① 结构校验', value: '输出 schema 合法 + 必填归属标注（AI 生成 + 模型 + 提示词版本）' },
            { key: 'l2', label: '② 引用校验', value: '结论类输出必须带引用；客观层字段必须有事件来源' },
            { key: 'l3', label: '③ 安全扫描', value: '密钥 / 危险 API / 越权写路径（100–400ms 延迟）' },
            { key: 'l4', label: '条件人工门', value: '高风险动作追加人工确认；不可用时 fail-closed' },
          ]" />
        </div>
      </div>

      <Alert theme="info" style="margin-bottom: 10px"
        message="拦截即停：不输出半成品给人类视野；拦截理由码与修复建议一并返回，修复后重跑即可（不重复计费去重路径之外的部分）。" />

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #layer="{ row }"><Tag size="small" :theme="LAYER_THEME[row.layer as GateLayer]" variant="light-outline">{{ row.layer }}</Tag></template>
        <template #code="{ row }">
          <span class="oc-mono" style="font-size: 11px">{{ row.reasonCode }}</span>
        </template>
        <template #at="{ row }"><span style="font-size: 12px">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">修复建议明细</div>
        <div v-for="b in rows.slice(0, 5)" :key="b.id" class="oc-stack" style="gap: 2px; margin-bottom: 8px">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag size="small" :theme="LAYER_THEME[b.layer]" variant="light-outline">{{ b.layer }}</Tag>
            <span class="oc-mono" style="font-size: 11px">{{ b.reasonCode }}</span>
            <span style="font-size: 12px">{{ b.reason }}</span>
          </div>
          <div class="oc-muted" style="font-size: 12px">修复：{{ b.fix }}</div>
          <Button size="small" variant="text" @click="explain(b)">展开理由与影响面</Button>
        </div>
      </div>
    </StateShell>
  </div>
</template>
