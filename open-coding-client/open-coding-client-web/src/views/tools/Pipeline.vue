<script setup lang="ts">
/** 执行管线（T-06）：11 步固定顺序管线可视化 + 某次调用逐步耗时与结果。溯源：卷 05 §4.2 */
import { computed, onMounted, ref } from 'vue';
import { Button, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { pipeline, pipelineTrace, pipelineTraceCallId, toolCalls } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const callId = ref(pipelineTraceCallId);
const err = ref(makeError('INTERNAL_ERROR', 'pipeline trace 采样缺失'));

const currentCall = computed(() => toolCalls.find((c) => c.callId === callId.value));
const totalMs = computed(() => pipelineTrace.reduce((a, s) => a + s.durationMs, 0));
const overheadMs = computed(() => pipeline.filter((p) => p.stepNo !== 7).reduce((a, p) => a + p.typicalLatencyMs, 0));

const durationSeries = computed(() => [
  { name: '本步耗时（ms）', points: pipelineTrace.map((s) => ({ x: s.stepNo.toString(), y: s.durationMs })) },
]);

const stepColumns = [
  { colKey: 'stepNo', title: '步', width: 56 },
  { colKey: 'name', title: '步骤', width: 140 },
  { colKey: 'durationMs', title: '本步耗时', width: 100 },
  { colKey: 'result', title: '结果', width: 100 },
  { colKey: 'note', title: '打点说明（本次调用）', ellipsis: true },
];

const orderRules = computed(() => pipeline.filter((p) => p.orderRule.includes('铁律') || p.orderRule.includes('必须') || p.orderRule.includes('不可')).map((p) => ({ key: p.key, label: `第 ${p.stepNo} 步 · ${p.name}`, value: p.orderRule })));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = pipeline.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

function onPick(v: unknown) {
  callId.value = String(v ?? '');
  refresh();
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="执行管线"
      desc="任何工具（内置 / MCP / 插件 / 脚本 / HTTP）走同一条管线，不允许旁路：11 步固定顺序，前 6 步为约束与路由，第 7 步才发生副作用。"
      volume="卷 05"
      manifest="T-06"
      :cli="`oc tools pipeline --call ${callId} --explain`"
      :status="[{ label: '顺序不可跳过', theme: 'warning' }, { label: `管线开销 ${overheadMs}ms`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="refresh">重新采样</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="管线步骤" :value="pipeline.length" format="raw" icon="sitemap" hint="固定顺序，不可跳过" />
      <StatCard label="本次总耗时" :value="totalMs" unit="ms" format="raw" icon="time" :hint="`调用 ${callId}`" />
      <StatCard label="管线开销（不含执行）" :value="overheadMs" unit="ms" format="raw" icon="secured" :target="20" target-kind="max" hint="NFR：管线开销 ≤ 20ms" />
      <StatCard label="跳过的步骤" :value="pipelineTrace.filter((s) => s.result === 'SKIPPED').length" format="raw" icon="check" hint="跳过必须显式标注，不静默失败" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select
        v-model="callId"
        size="small"
        style="width: 360px"
        :options="toolCalls.map((c) => ({ label: `${c.callId} · ${c.toolName}（${c.status}）`, value: c.callId }))"
        @change="onPick"
      />
      <CopyableId :id="callId" label="复制调用 ID" :short="8" />
      <CliHint :command="`oc tools pipeline --call ${callId} --json`" label="导出逐步轨迹" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有可展示的管线定义"
      empty-desc="管线元数据未加载（可能因内核版本不匹配）。请重试或导出诊断包。"
      empty-action="重试加载"
      :what="'管线轨迹采样失败'"
      :why="err.message"
      how="轨迹为采样数据（1% 采样 + 失败调用 100% 保留）；可切换其他调用或稍后重试。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">11 步定义（固定顺序）</h3>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="p in pipeline" :key="p.key" class="oc-flex" style="align-items: flex-start; gap: 8px">
              <Tag :theme="[3, 4, 5, 8].includes(p.stepNo) ? 'warning' : p.stepNo === 7 ? 'danger' : 'default'" size="small" variant="light-outline">
                {{ p.stepNo }}
              </Tag>
              <div class="oc-grow">
                <div style="font-size: 13px; font-weight: 600">{{ p.name }}</div>
                <div class="oc-muted" style="font-size: 12px">{{ p.desc }}</div>
                <div class="oc-muted" style="font-size: 11px">失败行为：{{ p.failBehavior }} · 事件：<span class="oc-mono">{{ p.event }}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">顺序铁律（违反即缺陷）</h3>
          <InfoGrid :columns="1" :items="orderRules" />
          <div class="oc-divider" />
          <p class="oc-muted" style="font-size: 12px; margin: 0">
            说明：① 改写类钩子必须先于权限决策（按最终形态鉴权，防绕过）；② 权限决策后只允许观察类钩子；③ 脱敏必须先于结果裁剪与外置；④ 幂等与事件写入必须先于回喂。
          </p>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">本次调用逐步耗时（{{ callId }}）</h3>
          <OcChart type="bar" :series="durationSeries" :height="200" format="number" unit="ms" aria-label="本次调用逐步耗时" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">逐步结果与打点</h3>
          <Table row-key="stepNo" size="small" :data="pipelineTrace" :columns="stepColumns">
            <template #stepNo="{ row }"><span class="oc-mono">{{ row.stepNo }}</span></template>
            <template #durationMs="{ row }"><span class="oc-mono">{{ row.durationMs }} ms</span></template>
            <template #result="{ row }">
              <Tooltip :content="row.note">
                <Tag size="small" variant="light-outline" :theme="row.result === 'OK' ? 'success' : row.result === 'WAIT' ? 'warning' : row.result === 'BLOCKED' ? 'danger' : 'default'">{{ row.result }}</Tag>
              </Tooltip>
            </template>
            <template #note="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.note }}</span></template>
          </Table>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">本次调用上下文</h3>
        <InfoGrid :columns="2" :items="[
          { key: 'call', label: '调用 ID', value: callId, copyable: true, mono: true },
          { key: 'tool', label: '工具 / 状态', value: `${currentCall?.toolName ?? '—'} / ${currentCall?.status ?? '—'}` },
          { key: 'params', label: '参数摘要', value: currentCall?.paramSummaryMasked ?? '—', block: true, mono: true },
          { key: 'wait', label: '审批等待', value: pipelineTrace.some((s) => s.result === 'WAIT') ? '第 4 步等待人工审批 41s（ASK → 批准，范围=本项目）' : '无审批等待' },
          { key: 'skipped', label: '跳过项', value: pipelineTrace.filter((s) => s.result === 'SKIPPED').map((s) => `第 ${s.stepNo} 步 ${s.name}`).join('；') || '无' },
        ]" />
      </div>
    </StateShell>
  </div>
</template>
