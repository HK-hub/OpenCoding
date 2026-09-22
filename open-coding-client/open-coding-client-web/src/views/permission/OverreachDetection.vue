<script setup lang="ts">
/** 越权检测三层（P-10）：决策链（事前）/ 沙箱围栏（事中）/ 审计扫描（事后）。溯源：卷 06 D-PERM-11 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { overreachLayers, securityEvents } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const scanning = ref(false);
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '审计扫描器与事件存储连接中断（增量扫描暂停）'));

const alerting = computed(() => overreachLayers.filter((l) => l.status === '告警'));
const findings = computed(() =>
  securityEvents
    .filter((e) => e.kind !== 'sandbox.denied')
    .map((e) => ({
      eventId: e.eventId,
      layer: e.kind === 'bypass.detected' ? '审计扫描（事后）' : '决策链（事前）',
      target: e.target,
      ruleRef: e.ruleRef,
      severity: e.severity,
      handled: e.handled,
      traceId: e.traceId,
    })),
);
const layerStats = computed(() => overreachLayers.map((l) => ({ name: l.key, value: l.findings })));

const columns = [
  { colKey: 'eventId', title: '发现', width: 110 },
  { colKey: 'layer', title: '所在层', width: 170 },
  { colKey: 'target', title: '发现内容', ellipsis: true },
  { colKey: 'ruleRef', title: '规则 / 校验对', width: 190 },
  { colKey: 'severity', title: '级别', width: 84 },
  { colKey: 'traceId', title: 'traceId', width: 160 , cell: 'traceIdCell' },
  { colKey: 'handled', title: '处置', width: 110 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = overreachLayers.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

function scanNow() {
  scanning.value = true;
  window.setTimeout(() => {
    scanning.value = false;
    MessagePlugin.success('增量扫描完成：比对 214 条工具调用与 10 项副作用登记，新增发现 0 项');
  }, 900);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="越权检测三层"
      desc="纵深防御：决策链（事前统一动作网关）+ 沙箱围栏（事中四类边界）+ 审计扫描（事后未登记副作用比对）。单层防御不足以覆盖「提示注入成功后的越权」。"
      volume="卷 06"
      manifest="P-10"
      cli="oc permission overreach status --layers all"
      :status="[{ label: `告警层 ${alerting.length}`, theme: alerting.length ? 'warning' : 'success' }, { label: '拒绝不静默', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm content="增量扫描为只读比对（不阻断在途动作，不修改副作用账本）。确认立即扫描？" @confirm="scanNow">
          <Button size="small" theme="primary" :loading="scanning">立即扫描</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="防御层" :value="overreachLayers.length" format="raw" icon="layers" hint="事前 / 事中 / 事后" />
      <StatCard label="累计发现" :value="overreachLayers.reduce((a, l) => a + l.findings, 0)" format="raw" icon="bug" />
      <StatCard label="决策链延迟 P95" :value="overreachLayers[0].latencyP95Ms" unit="ms" format="raw" icon="time" :target="10" target-kind="max" />
      <StatCard label="扫描滞后" :value="1" unit="min" format="raw" icon="history" hint="增量扫描周期 15 分钟（滞后为上次扫描距今）" />
    </div>

    <StateShell
      :state="state"
      empty-title="三层状态不可用"
      empty-desc="越权检测依赖内核状态与事件存储，均未就绪（异常态）。"
      empty-action="重新加载"
      example-task="模拟一次未登记副作用，验证审计扫描能否发现"
      :what="'审计扫描暂停'"
      :why="err.message"
      how="扫描暂停期间仍可查询历史发现；重连后自动补扫（按 offset 续扫，不丢区间）。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-grid oc-grid--3">
        <div v-for="l in overreachLayers" :key="l.key" class="oc-card" :style="{ borderColor: l.status === '告警' ? 'var(--oc-sev-warn)' : undefined }">
          <div class="oc-flex oc-flex--between">
            <span style="font-weight: 600">{{ l.layer }}</span>
            <Tag size="small" variant="light-outline" :theme="l.status === '告警' ? 'warning' : 'success'">{{ l.status }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin: 6px 0">{{ l.detail }}</div>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'cover', label: '覆盖', value: l.coverage },
              { key: 'find', label: '发现项', value: String(l.findings) },
              { key: 'p95', label: '延迟 P95', value: `${l.latencyP95Ms} ms` },
              { key: 'scan', label: '最近扫描', value: new Date(l.lastScanAt).toLocaleString('zh-CN') },
            ]"
          />
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">各层发现项数量</h3>
          <OcChart type="bar" :values="layerStats" :height="180" format="number" aria-label="各层发现项数量" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">三层职责与盲区（诚实说明）</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'l1', label: '事前 · 决策链', value: '所有副作用必须构造 ActionDescriptor 经统一网关；盲区：旁路写（不经工具运行时的写入）只能事后发现' },
            { key: 'l2', label: '事中 · 沙箱围栏', value: '路径 / 网络 / 资源 / 凭证四类边界；盲区：平台能力缺失时的降级档（已显式标注且可强制拒绝）' },
            { key: 'l3', label: '事后 · 审计扫描', value: '事件与副作用账本双向比对 + 异常模式检测；盲区：留存期外的历史（已归档至冷存储）' },
          ]" />
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <CliHint command="oc permission overreach scan --incremental --explain" label="等价扫描命令" />
            <CopyableId id="overreach://三层检测/status" label="复制状态引用" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          发现项清单（决策链 + 审计扫描）
          <Tooltip content="沙箱层拒绝记录见「沙箱与安全 → 安全违规与处置」">
            <Tag size="small" variant="light-outline">沙箱层见 B-11</Tag>
          </Tooltip>
        </h3>
        <Table row-key="eventId" size="small" :data="findings" :columns="columns">
          <template #eventId="{ row }"><span class="oc-mono">{{ row.eventId }}</span></template>
          <template #layer="{ row }"><Tag size="small" variant="light-outline">{{ row.layer }}</Tag></template>
          <template #severity="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.severity === 'P0' ? 'danger' : row.severity === 'P1' ? 'warning' : 'default'">{{ row.severity }}</Tag>
          </template>
          <template #traceIdCell="{ row }"><CopyableId :id="row.traceId" label="复制" :short="14" /></template>
          <template #handled="{ row }">
            <Tag v-if="row.handled" size="small" theme="success" variant="light-outline">已处置</Tag>
            <Tag v-else size="small" theme="danger" variant="light-outline">待处置</Tag>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
