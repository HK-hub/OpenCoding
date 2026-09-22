<script setup lang="ts">
/**
 * Z-08 一致性校验。
 * 六类校验对（事件↔投影 / 事件↔快照 / 引用完整性 / 索引↔工作区版本 / 记忆文件↔索引 / 审计链）；
 * 偏差可自动修复，但审计链偏差仅告警不可自动修复（不可篡改语义）。
 * 溯源：卷 19 D-PERS-11/§4.5；BUILD-MANIFEST Z-08。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { ConsistencyCheck } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const onlyDrift = ref(false);
const active = ref<ConsistencyCheck>(platformData.persistence.consistencyChecks[5]);
const fixOpen = ref(false);

const checks = computed(() => platformData.persistence.consistencyChecks);
const rows = computed(() => (onlyDrift.value ? checks.value.filter((c) => c.driftCount > 0) : checks.value));
const driftTotal = computed(() => checks.value.reduce((a, c) => a + c.driftCount, 0));
const autoFixable = computed(() => checks.value.filter((c) => c.autoFix && c.driftCount > 0).length);

const trendSeries = computed(() => [
  { name: '偏差计数（近 7 天）', points: [3, 2, 4, 3, 6, 4, 5].map((v, i) => ({ x: `T-${6 - i}`, y: v })) },
]);

const columns = [
  { colKey: 'pair', title: '校验对', width: 300, cell: 'pair' },
  { colKey: 'method', title: '方法', ellipsis: true },
  { colKey: 'driftCount', title: '偏差数', width: 100, cell: 'drift' },
  { colKey: 'autoFix', title: '偏差处理', width: 200, cell: 'fix' },
  { colKey: 'lastRunAt', title: '最近运行', width: 170, cell: 'at' },
  { colKey: 'status', title: '状态', width: 130, cell: 'status' },
  { colKey: 'op', title: '操作', width: 96, cell: 'op' },
];

const STATUS_THEME: Record<string, 'success' | 'warning' | 'danger'> = { CONSISTENT: 'success', DRIFT: 'warning', ALERT_ONLY: 'danger' };

function doFix() {
  if (!active.value.autoFix) {
    MessagePlugin.error('审计链偏差不可自动修复：仅告警并通知合规官（哈希链不可篡改）');
    return;
  }
  MessagePlugin.success(`已提交自动修复：${active.value.pair}（${active.value.detail}）`);
  fixOpen.value = false;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = checks.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="一致性校验"
      desc="六类校验对覆盖事件、投影、快照、引用、索引与审计链；偏差可按策略自动修复，唯独审计链偏差只告警——哈希链的不可篡改优先于自动修复。"
      volume="卷 19" manifest="Z-08" cli="oc persistence consistency run --all && oc persistence consistency fix --pair <pair>"
      :status="[{ label: `${driftTotal} 处偏差`, theme: driftTotal ? 'warning' : 'success' }, { label: '审计链仅告警', theme: 'danger' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Button size="small" :theme="onlyDrift ? 'warning' : 'default'" variant="outline" @click="onlyDrift = !onlyDrift">
          {{ onlyDrift ? '显示全部' : '只看有偏差' }}
        </Button>
        <Button size="small" theme="primary" @click="fixOpen = true">修复所选</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="校验对总数" :value="checks.length" icon="sitemap" hint="每日抽样运行（默认 03:00）" />
      <StatCard label="偏差总数" :value="driftTotal" icon="bug" hint="偏差均有明细与修复路径" />
      <StatCard label="可自动修复" :value="autoFixable" icon="refresh" hint="重建投影 / 刷新快照 / 重建索引" />
      <StatCard label="仅告警（不可修复）" :value="checks.filter((c) => !c.autoFix && c.driftCount > 0).length" icon="secured" hint="审计链哈希断点：通知合规官并留证" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">偏差趋势（近 7 天）</h3>
        <OcChart type="bar" :height="200" :series="trendSeries" :threshold="{ value: 3, label: '抑制阈值 3' }" aria-label="一致性偏差趋势" />
        <Tag size="small" variant="outline" style="margin-top: 8px">连续超阈值将触发抑制：暂停自动修复，先人工确认根因</Tag>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          偏差详情：{{ active.pair }}
          <CliHint :command="`oc persistence consistency show --pair '${active.pair}'`" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'method', label: '校验方法', value: active.method },
          { key: 'drift', label: '偏差数', value: `${active.driftCount}` },
          { key: 'detail', label: '偏差明细', value: active.detail },
          { key: 'policy', label: '修复策略', value: active.autoFix ? '可自动修复（安全：以事件为准重建派生数据）' : '仅告警不可自动修复（哈希链完整性）' },
          { key: 'run', label: '最近运行', value: new Date(active.lastRunAt).toLocaleString('zh-CN') },
          { key: 'alert', label: '告警去向', value: active.autoFix ? '运维告警 + Runbook（含修复命令）' : '合规官 + 安全事件（SEV3）' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag v-if="!active.autoFix" theme="danger" variant="light-outline" size="small">审计链偏差：禁止自动修复，必须人工复核并记录结论</Tag>
          <Tag v-else theme="warning" variant="light-outline" size="small">自动修复以事件为准，修复动作写入审计</Tag>
        </div>
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在抽样重建投影并比对…"
      empty-title="没有一致性校验任务" empty-desc="校验任务未启用，或该租户关闭了抽样校验（企业可配每日/每周）。"
      empty-action="启用每日抽样校验" example-task="重建会话投影并与事件比对，确认无偏差"
      what="一致性校验结果读取失败" why="校验结果表读取超时（抽样重建正在占用只读副本）"
      how="重试；校验运行本身不受影响，结果稍后可查" trace-id="trace-f88b4e33"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="pair" size="small" :pagination="undefined">
        <template #pair="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span>{{ row.pair }}</span>
            <Tag v-if="!row.autoFix && row.driftCount" theme="danger" size="small" variant="light-outline">仅告警</Tag>
          </div>
        </template>
        <template #drift="{ row }">
          <span :style="{ color: row.driftCount ? 'var(--oc-sev-warn)' : undefined }">{{ row.driftCount }}</span>
        </template>
        <template #fix="{ row }">
          <Tag :theme="row.autoFix ? 'success' : 'danger'" size="small" variant="light-outline">
            {{ row.autoFix ? '可自动修复' : '仅告警（不可修复）' }}
          </Tag>
        </template>
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.lastRunAt).toLocaleTimeString('zh-CN', { hour12: false }) }}</span></template>
        <template #status="{ row }">
          <Tag :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="active = row as ConsistencyCheck; fixOpen = true">修复</Button>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="fixOpen" :header="active.autoFix ? '自动修复偏差（可撤销）' : '审计链偏差：仅告警（不可修复）'" width="600px" :confirm-btn="{ content: active.autoFix ? '执行修复' : '通知合规官', theme: active.autoFix ? 'primary' : 'danger' }" cancel-btn="取消" @confirm="doFix">
      <div class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'pair', label: '校验对', value: active.pair },
          { key: 'detail', label: '偏差明细', value: active.detail },
          { key: 'action', label: active.autoFix ? '修复动作' : '处置动作', value: active.autoFix ? '以事件为准重建派生数据（投影/快照/索引）；修复前后各留一份比对快照' : '仅告警：通知合规官 + 生成安全事件（SEV3），保留哈希断点证据链' },
          { key: 'undo', label: '可撤销', value: active.autoFix ? '可撤销（保留修复前快照）' : '不适用（不修改数据）' },
          { key: 'audit', label: '审计', value: '修复或告警均写入审计事件（含操作者与依据）' },
        ]" />
        <Tag v-if="!active.autoFix" theme="danger" variant="light-outline" size="small">审计链不可篡改：任何自动重写都会破坏哈希链，因此只允许告警</Tag>
      </div>
    </Dialog>
  </div>
</template>
