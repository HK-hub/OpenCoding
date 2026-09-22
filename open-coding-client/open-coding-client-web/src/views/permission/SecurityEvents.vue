<script setup lang="ts">
/** 安全事件（P-07）：override.denied / bypass.detected / sandbox.denied 三类事件流。溯源：卷 06 §6 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, RadioButton, RadioGroup, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { SecurityEvent } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { securityEvents, summary } = toolData;

type KindFilter = 'all' | SecurityEvent['kind'];
const KIND_LABEL: Record<SecurityEvent['kind'], string> = {
  'override.denied': '放宽被拒（override.denied）',
  'bypass.detected': '旁路发现（bypass.detected）',
  'sandbox.denied': '沙箱拒绝（sandbox.denied）',
};

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const kind = ref<KindFilter>('all');
const severity = ref('');
const pageSize = ref(10);
const current = ref<SecurityEvent | null>(null);
const detailOpen = ref(false);
const err = ref(makeError('PERMISSION_DENIED', '安全事件存储需审计权限（audit.read）'));

const rows = computed(() =>
  securityEvents
    .filter((e) => kind.value === 'all' || e.kind === kind.value)
    .filter((e) => !severity.value || e.severity === severity.value),
);
const shown = computed(() => rows.value.slice(0, pageSize.value));
const unhandled = computed(() => securityEvents.filter((e) => !e.handled).length);

const kindStats = computed(() => [
  { name: 'override.denied', value: securityEvents.filter((e) => e.kind === 'override.denied').length },
  { name: 'bypass.detected', value: securityEvents.filter((e) => e.kind === 'bypass.detected').length },
  { name: 'sandbox.denied', value: securityEvents.filter((e) => e.kind === 'sandbox.denied').length },
]);

const columns = [
  { colKey: 'eventId', title: '事件', width: 100 },
  { colKey: 'kind', title: '类型', width: 210 },
  { colKey: 'severity', title: '级别', width: 80 },
  { colKey: 'actor', title: '来源 / 主体', width: 210 },
  { colKey: 'target', title: '目标 / 企图', ellipsis: true },
  { colKey: 'ruleRef', title: '规则引用', width: 170 },
  { colKey: 'trace', title: 'traceId', width: 150 },
  { colKey: 'handled', title: '处置', width: 110 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function open(ctx: { row: Record<string, unknown> }) {
  current.value = securityEvents.find((e) => e.eventId === ctx.row.eventId) ?? null;
  detailOpen.value = true;
}

function handle(action: 'close' | 'escalate') {
  if (!current.value) return;
  MessagePlugin.success(action === 'close' ? '已结案（处置结论写入审计链，仅追加）' : '已升级至安全工程组（P0 通道 + 值班升级链）');
  detailOpen.value = false;
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="安全事件"
      desc="三类安全事件构成闭环：override.denied（下级放宽被拒）、bypass.detected（未登记副作用 / 绕过管线）、sandbox.denied（沙箱边界拒绝）。均带规则引用与 traceId。"
      volume="卷 06"
      manifest="P-07"
      cli="oc permission events list --kind sandbox.denied --since 24h"
      :status="[{ label: `未处置 ${unhandled}`, theme: unhandled ? 'warning' : 'success' }, { label: '仅追加不可修改', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="refresh">刷新</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="事件总数（24h）" :value="securityEvents.length" format="raw" icon="bug" />
      <StatCard label="放宽被拒" :value="kindStats[0].value" format="raw" icon="lock" hint="基线锁定生效的直接证据" />
      <StatCard label="旁路发现" :value="summary.bypassFindings" format="raw" icon="secured" hint="审计扫描比对副作用账本" />
      <StatCard label="未处置" :value="unhandled" format="raw" icon="notification" hint="P0 未处置将穿透静默时段告警" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <RadioGroup v-model="kind" size="small" @change="refresh">
        <RadioButton value="all">全部</RadioButton>
        <RadioButton v-for="(label, k) in KIND_LABEL" :key="k" :value="k">{{ label }}</RadioButton>
      </RadioGroup>
      <Select v-model="severity" size="small" clearable placeholder="级别" style="width: 130px" :options="['P0', 'P1', 'P2'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc permission events detect --scan-now" label="立即扫描旁路" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">事件类型分布</h3>
        <OcChart type="bar" :values="kindStats" :height="170" format="number" aria-label="安全事件类型分布" />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">处置语义</h3>
        <InfoGrid :columns="1" :items="[
          { key: 'd1', label: 'override.denied', value: '下级策略放宽尝试被阻断：记录操作者与目标层级，必要时通知安全组（基线不可被绕过）' },
          { key: 'd2', label: 'bypass.detected', value: '发现未登记副作用或钩子顺序违规：隔离可疑进程 + 回滚（可回滚项）+ 人工复核' },
          { key: 'd3', label: 'sandbox.denied', value: '路径 / 网络 / 资源 / 凭证边界拒绝：提示可申请加白或改用区内路径（不静默）' },
          { key: 'd4', label: '不可变审计', value: '处置为状态迁移事件（仅追加）：结案 / 升级均写入操作者与理由' },
        ]" />
      </div>
    </div>

    <StateShell
      :state="state"
      empty-title="没有安全事件"
      empty-desc="该筛选条件下无事件（24h 内零拒绝是健康信号，也可能说明策略过宽需复核）。"
      empty-action="清空筛选"
      example-task="查看云元数据端点访问被阻断的事件链"
      :what="'安全事件加载失败'"
      :why="err.message"
      how="安全事件属审计数据（哈希链保护）：需要 audit.read 权限；可在「企业治理 → 审计」申请。"
      :trace-id="err.traceId"
      :missing-permission="'audit.read'"
      risk-level="R4"
      apply-path="在「企业治理 → 组织身份（RBAC）」为当前角色补充审计读取权限"
      :collapsed-summary="`命中 ${rows.length} 条事件，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @apply="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="kind = 'all'; severity = ''; refresh()"
    >
      <Table row-key="eventId" size="small" :data="shown" :columns="columns" :hover="true" @row-click="open">
        <template #eventId="{ row }"><span class="oc-mono">{{ row.eventId }}</span></template>
        <template #kind="{ row }">
          <Tag size="small" variant="light-outline" :theme="row.kind === 'bypass.detected' ? 'danger' : row.kind === 'override.denied' ? 'warning' : 'primary'">{{ KIND_LABEL[row.kind as SecurityEvent['kind']] }}</Tag>
        </template>
        <template #severity="{ row }">
          <Tag size="small" variant="light-outline" :theme="row.severity === 'P0' ? 'danger' : row.severity === 'P1' ? 'warning' : 'default'">{{ row.severity }}</Tag>
        </template>
        <template #actor="{ row }"><span style="font-size: 12px">{{ row.actor }}</span></template>
        <template #trace="{ row }"><CopyableId :id="row.traceId" label="复制 traceId" :short="14" /></template>
        <template #handled="{ row }">
          <Tag v-if="row.handled" size="small" theme="success" variant="light-outline">已处置</Tag>
          <Tag v-else size="small" theme="danger" variant="light-outline">待处置</Tag>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="detailOpen" :header="`安全事件 ${current?.eventId ?? ''}`" width="680px" :footer="false">
      <div v-if="current" class="oc-stack">
        <InfoGrid :columns="2" :items="[
          { key: 'kind', label: '类型', value: KIND_LABEL[current.kind] },
          { key: 'sev', label: '级别', value: current.severity, tag: { text: current.severity, theme: current.severity === 'P0' ? 'danger' : current.severity === 'P1' ? 'warning' : 'default' } },
          { key: 'at', label: '时间', value: new Date(current.at).toLocaleString('zh-CN') },
          { key: 'actor', label: '主体', value: current.actor },
          { key: 'scope', label: '作用域', value: current.scope },
          { key: 'rule', label: '规则引用', value: current.ruleRef, mono: true },
          { key: 'target', label: '目标 / 企图', value: current.target, span: 2 },
          { key: 'detail', label: '详情', value: current.detail, span: 2 },
          { key: 'trace', label: 'traceId', value: current.traceId, mono: true, copyable: true },
          { key: 'decision', label: '关联决策', value: current.decisionRef ?? '无（旁路或沙箱层拦截）', mono: true },
        ]" />
        <div class="oc-flex" style="justify-content: flex-end; gap: 8px">
          <CliHint :command="`oc permission events show ${current.eventId} --with-trace`" label="等价命令" />
          <Button variant="outline" @click="handle('escalate')">升级至安全组</Button>
          <Button theme="primary" @click="handle('close')">标记已处置</Button>
        </div>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          处置不可逆（事件仅追加）：结案后如需更正请追加备注事件，不修改原记录。
        </p>
      </div>
    </Dialog>
  </div>
</template>
