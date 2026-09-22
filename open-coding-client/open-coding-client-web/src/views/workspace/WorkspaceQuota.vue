<script setup lang="ts">
/**
 * O-10 配额与资源监控。
 * 磁盘 / CPU / 内存 / 网络 / inode 五维监控 + 超阈值告警 + 暂停执行（防止磁盘打满等事故）。
 * 暂停执行是会影响主流程的动作，必须说明影响面与恢复方式。
 * 溯源：卷 20 D-WS-10；BUILD-MANIFEST O-10。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Option, Popconfirm, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { Workspace } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const active = ref<Workspace>(platformData.workspaces[2]);
const paused = ref(false);

const workspaces = computed(() => platformData.workspaces);
const overThreshold = computed(() => workspaces.value.filter((w) => w.quota.diskUsedRatio > 0.85 || w.quota.memory > 0.85));
const diskSeries = computed(() => [
  { name: 'ws-0003 磁盘水位', points: [78, 82, 85, 88, 90, 91, 92].map((v, i) => ({ x: `${(6 - i) * 10}分前`, y: v })) },
  { name: 'ws-0006 磁盘水位', points: [66, 67, 69, 70, 71, 71, 71].map((v, i) => ({ x: `${(6 - i) * 10}分前`, y: v })) },
]);

const columns = [
  { colKey: 'name', title: '工作区', width: 230, cell: 'name' },
  { colKey: 'disk', title: '磁盘', width: 180, cell: 'disk' },
  { colKey: 'cpu', title: 'CPU', width: 160, cell: 'cpu' },
  { colKey: 'mem', title: '内存', width: 160, cell: 'mem' },
  { colKey: 'net', title: '网络（24h）', width: 160, cell: 'net' },
  { colKey: 'inode', title: 'inode', width: 140, cell: 'inodeCell' },
  { colKey: 'state', title: '执行状态', width: 140, cell: 'state' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = workspaces.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="配额与资源监控"
      desc="五维监控与阈值告警；磁盘/内存超阈值时暂停执行（防事故），容器与云可硬限，SSH 仅观测。暂停只停新命令，不杀正在运行的进程。"
      volume="卷 20" manifest="O-10" cli="oc workspace quota show --all --threshold 85 && oc workspace quota pause --id ws-0003"
      :status="[{ label: `${overThreshold.length} 个超阈值`, theme: overThreshold.length ? 'warning' : 'success' }, { label: '阈值 85%', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="active" size="small" style="width: 230px" aria-label="选择工作区" :options="workspaces.map((w) => ({ value: w, label: w.name }))" />
        <Popconfirm theme="warning" :confirm-btn="{ content: paused ? '恢复执行' : '暂停执行', theme: paused ? 'primary' : 'warning' }" cancel-btn="取消" @confirm="paused = !paused; MessagePlugin.success(paused ? '已暂停该工作区的新命令（正在运行的进程不受影响）' : '已恢复执行（配额水位已回落）')">
          <template #content>
            <div style="max-width: 340px">
              <div>后果：暂停后新的命令/工具调用被拒绝（不排队），正在运行的进程继续。</div>
              <div>是否可撤销：可随时恢复执行（无需重新准备环境）。</div>
            </div>
          </template>
          <Button size="small" :theme="paused ? 'primary' : 'warning'" variant="outline">{{ paused ? '恢复执行' : '暂停执行' }}</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="最高磁盘水位" :value="Math.max(...workspaces.map((w) => w.quota.diskUsedRatio)) * 100" format="percent" icon="database" :target="85" target-kind="max" hint="超阈值自动暂停新命令" />
      <StatCard label="最高 CPU" :value="Math.max(...workspaces.map((w) => w.quota.cpu))" format="percent" icon="loading" hint="容器/云可强限，SSH 仅观测" />
      <StatCard label="超阈值工作区" :value="overThreshold.length" icon="secured" hint="告警同时推送通知中心与 Runbook" />
      <StatCard label="已暂停执行" :value="workspaces.filter((w) => w.quota.paused).length + (paused ? 1 : 0)" icon="close" hint="暂停仅停新命令，不杀进程" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">磁盘水位趋势（近 60 分钟）</h3>
        <OcChart type="line" :height="200" format="percent" :series="diskSeries" :threshold="{ value: 85, label: '告警阈值 85%' }" aria-label="磁盘水位" />
        <Tag theme="warning" variant="light-outline" size="small" style="margin-top: 8px">ws-0003 已超阈值：暂停新命令并提示清理（可选批量清理）</Tag>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          配额详情：{{ active.name }}
          <CliHint :command="`oc workspace quota show --id ${active.workspaceId}`" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'limit', label: '配额上限', value: active.quota.limit },
          { key: 'net', label: '网络（24h）', value: active.quota.networkTraffic },
          { key: 'inode', label: 'inode / 文件数', value: active.quota.inodeCount.toLocaleString('zh-CN') },
          { key: 'enforce', label: '限制方式', value: active.type === 'ssh' ? '仅观测 + 超阈值暂停（远端主机不可硬限）' : '容器/云可硬限（CPU 与内存强限）' },
          { key: 'pause', label: '暂停语义', value: '拒绝新命令与新工具调用；正在运行的进程继续跑完（可单独终止）' },
          { key: 'clean', label: '清理建议', value: active.quota.diskUsedRatio > 0.85 ? '清理未引用快照块（O-07）与构建缓存；清理不可撤销但可从快照恢复文件' : '无需清理' },
        ]" />
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在采集五维资源指标…"
      empty-title="没有可监控的工作区" empty-desc="尚无工作区接入监控；本地工作区仅采集软指标（磁盘与进程数）。"
      empty-action="创建工作区" example-task="把容器工作区磁盘水位压到 95%，观察自动暂停生效"
      what="资源指标采集失败" why="指标采集代理不可达（目标主机负载过高导致探针超时）"
      how="可重试；指标缺失时不做自动暂停（避免误判），改用上一次采样值" trace-id="trace-ccdd4416"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="workspaces" :columns="columns" row-key="workspaceId" size="small" :pagination="undefined">
        <template #name="{ row }"><span>{{ row.name }}</span></template>
        <template #disk="{ row }">
          <Progress :percentage="Math.round(row.quota.diskUsedRatio * 100)" theme="line" :status="row.quota.diskUsedRatio > 0.85 ? 'error' : 'active'" size="small" />
        </template>
        <template #cpu="{ row }">
          <Progress :percentage="row.quota.cpu" theme="line" :status="row.quota.cpu > 85 ? 'error' : 'active'" size="small" />
        </template>
        <template #mem="{ row }">
          <Progress :percentage="Math.round(row.quota.memory * 100)" theme="line" :status="row.quota.memory > 0.85 ? 'error' : 'active'" size="small" />
        </template>
        <template #net="{ row }">{{ row.quota.networkTraffic }}</template>
        <template #inodeCell="{ row }">{{ row.quota.inodeCount.toLocaleString('zh-CN') }}</template>
        <template #state="{ row }">
          <Tag :theme="row.quota.paused ? 'warning' : 'success'" size="small" variant="light-outline">{{ row.quota.paused ? '已暂停执行' : '正常运行' }}</Tag>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
