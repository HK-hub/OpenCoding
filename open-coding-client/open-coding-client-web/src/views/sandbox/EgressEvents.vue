<script setup lang="ts">
/** 出网事件（B-07）：域名/方法/字节/时间/命令 ID/判定 + 申请加白。溯源：卷 07 §4.4 §6 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { EgressRecord } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { egressRecords, networkPolicy } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const verdictFilter = ref('');
const pageSize = ref(10);
const applyOpen = ref(false);
const applying = ref<EgressRecord | null>(null);
const err = ref(makeError('SANDBOX_DENIED', '出网事件查询被拒绝（审计权限或留存期外）'));

const rows = computed(() => egressRecords.filter((e) => !verdictFilter.value || e.verdict === verdictFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const denied = computed(() => egressRecords.filter((e) => e.verdict === '拒绝'));

const byDomain = computed(() => {
  const map = new Map<string, number>();
  egressRecords.forEach((e) => map.set(e.domain, (map.get(e.domain) ?? 0) + Math.round((e.bytesIn + e.bytesOut) / 1024)));
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
});

const columns = [
  { colKey: 'recordId', title: '事件', width: 100 },
  { colKey: 'domain', title: '域名', width: 220 },
  { colKey: 'method', title: '方法', width: 80 },
  { colKey: 'bytes', title: '出 / 入', width: 140 },
  { colKey: 'at', title: '时间', width: 160 },
  { colKey: 'callId', title: '调用 ID', width: 140 },
  { colKey: 'commandId', title: '命令 ID', width: 150 },
  { colKey: 'verdict', title: '判定', width: 110 },
  { colKey: 'policyRef', title: '策略引用', width: 170 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function openApply(row: EgressRecord) {
  applying.value = row;
  applyOpen.value = true;
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="出网事件"
      desc="全部出网请求经审计代理记录：域名、方法、字节数、时间、发起命令 ID、策略判定。被拒事件提供「申请加白」入口（拒绝不静默，给恢复路径）。"
      volume="卷 07"
      manifest="B-07"
      cli="oc sandbox egress list --denied --since 24h --explain"
      :status="[{ label: `拒绝 ${denied.length} 次`, theme: denied.length ? 'warning' : 'success' }, { label: `默认 ${networkPolicy.defaultAction}`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="verdictFilter = '拒绝'; refresh()">仅看被拒</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="出网事件（24h）" :value="egressRecords.length" format="raw" icon="cloud" />
      <StatCard label="被拒绝" :value="denied.length" format="raw" icon="close" hint="全部提供恢复路径（加白申请 / 改用私仓）" />
      <StatCard label="累计出流量" :value="Number((egressRecords.reduce((a, e) => a + e.bytesOut, 0) / 1024).toFixed(1))" unit="KB" format="raw" icon="upload" />
      <StatCard label="累计入流量" :value="Number((egressRecords.reduce((a, e) => a + e.bytesIn, 0) / 1024 / 1024).toFixed(1))" unit="MB" format="raw" icon="download" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">流量 Top 域名（KB）</h3>
        <OcChart type="bar" :values="byDomain" :height="180" format="number" unit="KB" aria-label="出网流量 Top 域名" />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">审计代理语义</h3>
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'a1', label: '记录内容', value: '域名 / 方法 / 出流入量 / 时间 / 调用 ID / 命令 ID / 判定 / 策略引用' },
            { key: 'a2', label: '响应扫描', value: '对响应体做敏感信息扫描（密钥 / PII），命中即阻断并告警' },
            { key: 'a3', label: '判定优先级', value: '黑名单 > 白名单 > 工具族候选（未确认）> 默认拒绝' },
            { key: 'a4', label: '留存', value: '出网事件按审计留存策略（默认 30 天）；聚合指标长期保留' },
          ]"
        />
      </div>
    </div>

    <div class="oc-flex oc-flex--wrap" style="margin-top: 4px">
      <Select v-model="verdictFilter" size="small" clearable placeholder="判定" style="width: 150px" :options="['允许', '拒绝', '申请中'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc sandbox egress export --since 7d --format csv" label="导出出网日志" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有出网事件"
      empty-desc="近 24h 无出网请求（可能全程离线工作，或网络类工具未被使用）。"
      empty-action="清空筛选"
      example-task="查看被拒的云元数据端点访问事件并处置"
      :what="'出网事件加载失败'"
      :why="err.message"
      how="出网事件属审计数据：超出留存期的事件已归档至冷存储（可按范围导出）。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 条出网事件，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="verdictFilter = ''; refresh()"
    >
      <Table row-key="recordId" size="small" :data="shown" :columns="columns">
        <template #recordId="{ row }"><span class="oc-mono">{{ row.recordId }}</span></template>
        <template #domain="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono" style="font-weight: 600">{{ row.domain }}</span>
            <Tooltip v-if="row.blockedBy" :content="row.blockedBy">
              <Tag size="small" theme="danger" variant="light-outline">被拒原因</Tag>
            </Tooltip>
          </div>
        </template>
        <template #method="{ row }"><Tag size="small" variant="outline" theme="default" class="oc-mono">{{ row.method }}</Tag></template>
        <template #bytes="{ row }">
          <span class="oc-mono" style="font-size: 11px">{{ (row.bytesOut / 1024).toFixed(1) }}KB / {{ (row.bytesIn / 1024 / 1024).toFixed(2) }}MB</span>
        </template>
        <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
        <template #callId="{ row }"><CopyableId :id="row.callId" label="复制" :short="8" /></template>
        <template #commandId="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.commandId }}</span></template>
        <template #verdict="{ row }">
          <Tag size="small" variant="light-outline" :theme="row.verdict === '允许' ? 'success' : row.verdict === '拒绝' ? 'danger' : 'warning'">{{ row.verdict }}</Tag>
          <Button v-if="row.verdict !== '允许'" size="small" variant="text" @click.stop="openApply(row)">申请加白</Button>
        </template>
        <template #policyRef="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.policyRef }}</span></template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="applyOpen" header="申请加白（出网例外）" width="580px" :on-confirm="() => { applyOpen = false; MessagePlugin.success('加白申请已提交：需策略审批（含用途与影响面），通过后立即生效'); }" :on-cancel="() => (applyOpen = false)">
      <div class="oc-stack">
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'domain', label: '目标域名', value: applying?.domain ?? '', mono: true },
            { key: 'method', label: '方法 / 流量', value: `${applying?.method ?? ''} · 出 ${((applying?.bytesOut ?? 0) / 1024).toFixed(1)}KB` },
            { key: 'by', label: '被拒原因', value: applying?.blockedBy ?? '未命中白名单（默认拒绝）' },
            { key: 'rule', label: '命中策略', value: applying?.policyRef ?? '', mono: true },
          ]"
        />
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">用途说明（必填，进入审计）</div>
          <Textarea :model-value="''" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="例如：需要读取依赖漏洞公告以完成供应链审计" />
        </div>
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">申请范围（建议最小化：仅该域名，不含通配）</div>
          <Input :model-value="applying?.domain ?? ''" size="small" />
        </div>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：审批通过后该域名请求被放行（仍全量审计 + 响应敏感扫描）。
          可逆：可随时移出白名单（立即生效）。<b>黑名单域名（如云元数据端点）不可加白</b>，申请会被基线直接拒绝并生成安全事件。
        </p>
      </div>
    </Dialog>
  </div>
</template>
