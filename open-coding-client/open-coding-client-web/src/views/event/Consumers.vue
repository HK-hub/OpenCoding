<script setup lang="ts">
/**
 * V-04 消费者与滞后。
 * 8 类消费者（会话投影/任务投影/计量投影/审计投影/前端推送/记忆挖掘/知识挖掘/评测采集）
 * 的 offset、滞后秒数、告警阈值与趋势；超阈值显式告警，不静默。
 * 溯源：卷 16 §4.5/§6；BUILD-MANIFEST V-04。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Option, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { ConsumerLag } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const onlyAlert = ref(false);
const detail = ref<ConsumerLag | null>(platformData.eventJobs.consumerLag[3]);

const consumers = computed(() => platformData.eventJobs.consumerLag);
const rows = computed(() => (onlyAlert.value ? consumers.value.filter((c) => c.lagSeconds > c.thresholdSeconds) : consumers.value));
const overCount = computed(() => consumers.value.filter((c) => c.lagSeconds > c.thresholdSeconds).length);

/** 全消费者滞后趋势（分钟粒度，用于看板对比） */
const trendSeries = computed(() =>
  consumers.value.slice(0, 4).map((c) => ({
    name: c.consumer,
    points: c.trend.map((v, i) => ({ x: `${i * 5}分前`, y: v })),
  })),
);

const columns = [
  { colKey: 'consumer', title: '消费者', width: 150, cell: 'consumer' },
  { colKey: 'group', title: '消费者组', width: 150 },
  { colKey: 'offset', title: 'offset（位点）', width: 130, cell: 'offset' },
  { colKey: 'lagSeconds', title: '滞后秒数', width: 150, cell: 'lag' },
  { colKey: 'thresholdSeconds', title: '告警阈值', width: 110 },
  { colKey: 'note', title: '说明', ellipsis: true },
  { colKey: 'op', title: '操作', width: 80, cell: 'op' },
];

const state = computed(() => (demo.value === 'NORMAL' && !rows.value.length ? 'EMPTY' : demo.value));

onMounted(() => {
  window.setTimeout(() => (demo.value = consumers.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="消费者与滞后"
      desc="至少一次投递 + 消费者幂等（幂等键 = eventId + 消费者组），位点持久化；滞后超阈值告警并给出恢复路径。"
      volume="卷 16" manifest="V-04" cli="oc event consumers --show-lag --threshold"
      :status="[{ label: `${consumers.length} 类消费者`, theme: 'default' }, { label: overCount ? `${overCount} 个超阈值` : '全部健康', theme: overCount ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Button size="small" :theme="onlyAlert ? 'primary' : 'default'" variant="outline" @click="onlyAlert = !onlyAlert">
          {{ onlyAlert ? '显示全部' : '只看超阈值' }}
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="最大滞后" :value="Math.max(...consumers.map((c) => c.lagSeconds))" unit="秒" icon="time" :delta="18.4" :lower-is-better="true" hint="审计投影 / 记忆挖掘超阈值" />
      <StatCard label="总消费位点" :value="consumers.reduce((a, c) => a + c.offset, 0)" format="token" icon="system" hint="分区内单一位点，跨分区不比较" />
      <StatCard label="超阈值消费者" :value="overCount" icon="secured" hint="告警进入通知中心，绑定 Runbook" />
      <StatCard label="死信待重放" :value="platformData.eventJobs.deadLetters.filter((d) => d.replayable).length" icon="mail" hint="不可重放项需修复 Schema 或引用后重放" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">滞后趋势（前 4 类消费者，近 40 分钟）</h3>
        <OcChart
          type="line" :height="220" unit="秒" :series="trendSeries"
          :threshold="{ value: 120, label: '告警阈值 120s' }" aria-label="消费者滞后趋势"
        />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">审计投影连续 7 个采样点上升</Tag>
          <Tag variant="outline" size="small">阈值可按消费者单独配置（企业策略）</Tag>
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          消费者详情
          <CliHint :command="`oc event consumers --detail ${detail?.group ?? ''}`" />
        </h3>
        <InfoGrid v-if="detail" :columns="1" :items="[
          { key: 'name', label: '消费者', value: detail.consumer },
          { key: 'group', label: '消费者组 / 幂等键', value: `${detail.group} · 幂等键 eventId` },
          { key: 'offset', label: 'offset', value: detail.offset, mono: true },
          { key: 'lag', label: '滞后', value: detail.lagSeconds >= detail.thresholdSeconds ? `${detail.lagSeconds} 秒（超阈值 ${detail.thresholdSeconds}s）` : `${detail.lagSeconds} 秒（阈值 ${detail.thresholdSeconds}s）`, tag: { text: detail.lagSeconds >= detail.thresholdSeconds ? 'WARN' : 'OK', theme: detail.lagSeconds >= detail.thresholdSeconds ? 'warning' : 'success' } },
          { key: 'input', label: '输入 → 输出', value: detail.consumer === '审计投影' ? '权限/工具/审批/系统事件 → 审计视图与导出' : '事件流 → 派生读模型（仅写投影）' },
          { key: 'route', label: '恢复路径', value: detail.lagSeconds >= detail.thresholdSeconds ? '横向扩容消费者实例；必要时暂停非关键投影（评测采集）让路' : '无需干预' },
        ]" />
        <div v-else class="oc-muted">选择左侧表格中的消费者查看详情</div>
      </div>
    </div>

    <StateShell
      :state="state" stage="正在拉取消费者位点与滞后…"
      empty-title="没有满足条件的消费者" empty-desc="当前过滤为「只看超阈值」且所有消费者均健康。"
      empty-action="显示全部消费者" example-task="注入消费失败，观察滞后上升与告警"
      what="消费者滞后读取失败" why="位点存储（Redis）连接中断，滞后数据可能陈旧"
      how="重试；或先查看事件流确认内核仍健康" trace-id="trace-d41f7720"
      @retry="demo = 'NORMAL'" @empty-action="onlyAlert = false"
    >
      <Table :data="rows" :columns="columns" row-key="group" size="small" :pagination="undefined">
        <template #consumer="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span>{{ row.consumer }}</span>
            <Tooltip v-if="row.lagSeconds > row.thresholdSeconds" content="滞后超过告警阈值：已推送告警并绑定 Runbook">
              <Tag theme="warning" size="small" variant="light-outline">超阈值</Tag>
            </Tooltip>
          </div>
        </template>
        <template #offset="{ row }"><span class="oc-mono">{{ row.offset }}</span></template>
        <template #lag="{ row }">
          <span :style="{ color: row.lagSeconds > row.thresholdSeconds ? 'var(--oc-sev-warn)' : undefined }">
            {{ row.lagSeconds }}s
          </span>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="detail = row as ConsumerLag">查看</Button>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
