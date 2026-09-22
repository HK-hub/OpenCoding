<script setup lang="ts">
/**
 * O-09 连接健康面板。
 * 心跳 30s + 断线重连（指数退避，上限 5）+ 多路复用通道 + 重认证；
 * 连接不健康时状态栏与页面同时降级提示，且给出可执行的恢复动作。
 * 溯源：卷 20 D-WS-9/§4.5；BUILD-MANIFEST O-09。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Option, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { ConnectionHealth } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE'>('LOADING');
const active = ref<ConnectionHealth>(platformData.connectionHealth[0]);
const reauthOpen = ref(false);

const health = computed(() => platformData.connectionHealth);
const unhealthy = computed(() => health.value.filter((h) => h.state !== 'HEALTHY').length);

/** 重连退避序列（1s,2s,4s,8s,16s → 上限 5 次） */
const backoffSeries = computed(() => [
  { name: '退避等待（秒）', points: [1, 2, 4, 8, 16].map((v, i) => ({ x: `第 ${i + 1} 次`, y: v })) },
]);

const columns = [
  { colKey: 'workspaceId', title: '工作区', width: 130, cell: 'id' },
  { colKey: 'state', title: '连接状态', width: 150, cell: 'state' },
  { colKey: 'latencyMs', title: '心跳延迟', width: 120, cell: 'lat' },
  { colKey: 'multiplexedChannels', title: '复用通道', width: 120 },
  { colKey: 'reconnects24h', title: '24h 重连', width: 120, cell: 're' },
  { colKey: 'backoffAttempts', title: '退避进度', width: 190, cell: 'back' },
  { colKey: 'lastProbeAt', title: '最近探测', width: 170, cell: 'at' },
];

const STATE_THEME: Record<string, 'success' | 'warning' | 'danger' | 'primary'> = { HEALTHY: 'success', RECONNECTING: 'warning', AUTH_EXPIRED: 'primary', DOWN: 'danger' };

function reauth() {
  MessagePlugin.success('已发起重认证：刷新 OAuth 型云凭证或重新加载 SSH 密钥（密钥经 SecretPort，明文不落盘）；成功后自动恢复 PTY 会话');
  reauthOpen.value = false;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = health.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="连接健康"
      desc="默认 30s 心跳；断线按指数退避重连（上限 5 次，超限转慢探测）；OAuth 云凭证自动刷新，失败则提示重认证。重连后尽力恢复 PTY，否则标记会话丢失。"
      volume="卷 20" manifest="O-09" cli="oc workspace connection health --all --show-backoff"
      :status="[{ label: unhealthy ? `${unhealthy} 个不健康` : '全部健康', theme: unhealthy ? 'warning' : 'success' }, { label: '心跳 30s', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 150px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'OFFLINE', label: '离线' },
        ]" />
        <Button size="small" theme="primary" variant="outline" @click="reauthOpen = true">重认证</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="健康连接" :value="health.filter((h) => h.state === 'HEALTHY').length" icon="check" hint="心跳正常且延迟在阈值内" />
      <StatCard label="重连中" :value="health.filter((h) => h.state === 'RECONNECTING').length" icon="loading" hint="退避上限 5 次后转慢探测（60s）" />
      <StatCard label="24h 重连次数" :value="health.reduce((a, h) => a + h.reconnects24h, 0)" icon="refresh" hint="频繁重连视为不健康信号" />
      <StatCard label="复用通道总量" :value="health.reduce((a, h) => a + h.multiplexedChannels, 0)" icon="link" hint="复用避免每命令一次握手" />
    </div>

    <StateShell
      :state="demo" stage="正在探测连接（心跳 30s，退避中）…"
      empty-title="没有远程连接" empty-desc="当前仅有本地工作区（无网络连接概念）；连接健康仅对 SSH/容器/云后端有意义。"
      empty-action="查看连接配置" example-task="注入网络分区，观察退避重连与「会话丢失」标记"
      what="连接健康探测失败" why="探活请求全部超时（网络分区或目标主机不可达）"
      how="可重试；重连期间命令被拒绝而非排队，避免长尾堆积" trace-id="trace-fbbc3305"
      :reconnect-in-ms="12000" :disabled-capabilities="['命令执行', 'PTY 恢复', '文件写入']"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @dismiss-offline="demo = 'NORMAL'"
    >
      <Table :data="health" :columns="columns" row-key="workspaceId" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.workspaceId }}</span></template>
        <template #state="{ row }">
          <Tag :theme="STATE_THEME[row.state] ?? 'default'" size="small" variant="light-outline">{{ row.state }}</Tag>
        </template>
        <template #lat="{ row }">
          <span :style="{ color: row.latencyMs > 300 ? 'var(--oc-sev-warn)' : undefined }">{{ row.latencyMs }}ms</span>
        </template>
        <template #re="{ row }">{{ row.reconnects24h }} 次</template>
        <template #back="{ row }">
          <Progress :percentage="Math.round((row.backoffAttempts / row.backoffCap) * 100)" theme="line" :status="row.backoffAttempts >= row.backoffCap ? 'error' : 'active'" size="small" />
        </template>
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.lastProbeAt).toLocaleTimeString('zh-CN', { hour12: false }) }}</span></template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">退避序列（指数退避，上限 5 次）</h3>
        <OcChart type="bar" :height="190" unit="秒" :series="backoffSeries" :threshold="{ value: 16, label: '上限 16s' }" aria-label="重连退避序列" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag size="small" variant="outline">超限后进入 60s 慢探测，并在状态栏显示降级档位（不静默）</Tag>
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          连接详情：{{ active.workspaceId }}
          <CliHint :command="`oc workspace connection health --id ${active.workspaceId}`" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'state', label: '状态', value: active.state, tag: { text: active.state, theme: STATE_THEME[active.state] } },
          { key: 'note', label: '说明', value: active.note },
          { key: 'beat', label: '心跳', value: '30s（失败即标记不健康，连续失败进入退避）' },
          { key: 'backoff', label: '退避进度', value: `${active.backoffAttempts} / ${active.backoffCap} 次` },
          { key: 'mux', label: '多路复用', value: `${active.multiplexedChannels} 条通道（并发上限 8，防打爆目标机）` },
          { key: 'pty', label: 'PTY 恢复', value: '重连成功后尽力恢复 PTY 会话；失败则标记「会话丢失」并要求重启该 PTY' },
        ]" />
      </div>
    </div>

    <Dialog v-model:visible="reauthOpen" header="重认证连接" width="580px" :confirm-btn="{ content: '开始重认证', theme: 'primary' }" cancel-btn="取消" @confirm="reauth">
      <div class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'why', label: '为何需要重认证', value: 'OAuth 型云凭证过期或 SSH 密钥轮换后，连接无法继续使用（心跳失败）' },
          { key: 'how', label: '认证方式', value: '刷新 OAuth 令牌 / 重新加载密钥引用（经 SecretPort 注入，明文不落盘、不入日志）' },
          { key: 'impact', label: '影响面', value: '仅当前连接；重认证期间该工作区命令被拒绝（不排队）' },
          { key: 'after', label: '恢复动作', value: '成功后尽力恢复 PTY 会话；失败则将 PTY 标记为「会话丢失」并提示重启' },
        ]" />
        <Tag theme="warning" variant="light-outline" size="small">重认证不会自动放行受限操作：原权限策略仍然生效</Tag>
      </div>
    </Dialog>
  </div>
</template>
