<script setup lang="ts">
/**
 * O-01 工作区列表。
 * 四类后端（local/ssh/container/cloud）× 六态生命周期；能力缺失与配额超限在列表即可见，
 * 销毁前必须做快照与清理检查（不可静默丢弃）。
 * 溯源：卷 20 D-WS-2/§4.1；BUILD-MANIFEST O-01。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Drawer, MessagePlugin, Option, Popconfirm, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { Workspace } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const typeFilter = ref('');
const statusFilter = ref('');
const detail = ref<Workspace | null>(null);

const workspaces = computed(() => platformData.workspaces);
const rows = computed(() =>
  workspaces.value.filter((w) => {
    if (typeFilter.value && w.type !== typeFilter.value) return false;
    if (statusFilter.value && w.status !== statusFilter.value) return false;
    return true;
  }),
);
const limit = ref(20);
const shown = computed(() => rows.value.slice(0, limit.value));
const edge = computed(() => rows.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));

const TYPE_THEME: Record<string, 'primary' | 'warning' | 'success' | 'default'> = { local: 'default', ssh: 'primary', container: 'warning', cloud: 'success' };
const STATUS_THEME: Record<string, 'success' | 'primary' | 'warning' | 'danger' | 'default'> = {
  created: 'default', provisioning: 'primary', ready: 'success', degraded: 'warning', suspended: 'warning', destroyed: 'danger',
};

const columns = [
  { colKey: 'name', title: '工作区', width: 250, cell: 'name' },
  { colKey: 'type', title: '类型', width: 120, cell: 'type' },
  { colKey: 'status', title: '状态', width: 130, cell: 'status' },
  { colKey: 'projectId', title: '绑定项目', width: 200, cell: 'proj' },
  { colKey: 'diskUsedRatio', title: '磁盘水位', width: 170, cell: 'disk' },
  { colKey: 'capability', title: '能力缺失', width: 220, cell: 'cap' },
  { colKey: 'op', title: '操作', width: 130, cell: 'op' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = workspaces.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});

/** 创建工作区：跳转创建工作区向导（O-02：类型 → 后端参数 → 绑定与写范围 → 配额与能力确认） */
function createWorkspace() {
  router.push('/workspace/create');
}
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工作区列表"
      desc="统一 WorkspaceProvider 抽象抹平四类后端差异；能力缺失显式降级（如 SSH 目录监听 → 轮询 2s 且标注非实时），配额超限可暂停执行。"
      volume="卷 20" manifest="O-01" cli="oc workspace list --show-quota --show-capabilities"
      :status="[{ label: `${workspaces.length} 个工作区`, theme: 'default' }, { label: `${workspaces.filter((w) => w.status === 'degraded').length} 个降级`, theme: 'warning' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="typeFilter" size="small" style="width: 130px" clearable placeholder="类型" aria-label="类型">
          <Option value="" label="全部类型" />
          <Option v-for="t in ['local', 'ssh', 'container', 'cloud']" :key="t" :value="t" :label="t" />
        </Select>
        <Select v-model="statusFilter" size="small" style="width: 140px" clearable placeholder="状态" aria-label="状态">
          <Option value="" label="全部状态" />
          <Option value="ready" label="ready" />
          <Option value="degraded" label="degraded" />
          <Option value="suspended" label="suspended" />
        </Select>
        <Button size="small" theme="primary" @click="createWorkspace">创建工作区</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="活跃工作区" :value="workspaces.filter((w) => w.status === 'ready').length" icon="folder" hint="单会话工作区数上限 ≥20" />
      <StatCard label="降级 / 挂起" :value="workspaces.filter((w) => w.status === 'degraded' || w.status === 'suspended').length" icon="secured" hint="降级原因在详情中可查" />
      <StatCard label="最高磁盘水位" :value="Math.max(...workspaces.map((w) => w.quota.diskUsedRatio)) * 100" format="percent" icon="database" :target="85" target-kind="max" hint="超阈值暂停执行" />
      <StatCard label="快照总数" :value="workspaces.reduce((a, w) => a + w.snapshots.length, 0)" icon="layers" hint="内容寻址增量，TTL 14 天" />
    </div>

    <StateShell
      :state="state" stage="正在读取工作区定义与能力矩阵…"
      empty-title="没有工作区" empty-desc="尚未创建工作区；首个工作区可由向导创建（本地目录 / SSH 主机 / 容器 / 云沙箱）。"
      empty-action="创建工作区" example-task="为 payment-core 创建一个本地工作区，探测环境并绑定会话"
      what="工作区列表读取失败" why="工作区元数据服务不可达（与连接池注册表同库）"
      how="重试；已运行的工作区不受影响（本地缓存列表可只读查看）" trace-id="trace-d33a8f51"
      :collapsed-summary="`已折叠 ${rows.length - shown.length} 个工作区（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="shown" :columns="columns" row-key="workspaceId" size="small" :pagination="undefined">
        <template #name="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <Button size="small" variant="text" @click="detail = row as Workspace">{{ row.name }}</Button>
            <span class="oc-mono oc-muted">{{ row.workspaceId }}</span>
          </div>
        </template>
        <template #type="{ row }">
          <Tag :theme="TYPE_THEME[row.type] ?? 'default'" size="small" variant="light-outline">{{ row.type }}</Tag>
        </template>
        <template #status="{ row }">
          <Tag :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #proj="{ row }"><span class="oc-mono">{{ row.projectId }}</span></template>
        <template #disk="{ row }">
          <Progress :percentage="Math.round(row.quota.diskUsedRatio * 100)" theme="line" :status="row.quota.diskUsedRatio > 0.85 ? 'error' : 'active'" size="small" />
        </template>
        <template #cap="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag v-for="f in row.capabilities.fallbacks.slice(0, 2)" :key="f.capability" theme="warning" size="small" variant="light-outline">
              {{ f.capability }} → {{ f.fallback }}
            </Tag>
            <span v-if="!row.capabilities.fallbacks.length" class="oc-muted">无</span>
          </div>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="detail = row as Workspace">详情</Button>
          <Popconfirm
            theme="danger" :confirm-btn="{ content: '销毁工作区', theme: 'danger' }" cancel-btn="取消"
            @confirm="MessagePlugin.success(`销毁 ${row.workspaceId} 前已创建快照并检查未合并分支工作树；销毁不可撤销，快照保留 14 天`)"
          >
            <template #content>
              <div style="max-width: 320px">
                <div>销毁后果：连接与本地缓存清理；未提交改动将随快照保留 14 天。</div>
                <div>是否可撤销：不可撤销（可从快照重建）。</div>
              </div>
            </template>
            <Button size="small" variant="text" theme="danger">销毁</Button>
          </Popconfirm>
        </template>
      </Table>
    </StateShell>

    <Drawer :visible="!!detail" @visible-change="(v: boolean) => { if (!v) detail = null }" :header="detail ? `工作区：${detail.name}` : ''" size="620px" :footer="false">
      <div v-if="detail" class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'id', label: 'workspaceId', value: detail.workspaceId, mono: true, copyable: true },
          { key: 'type', label: '类型 / 隔离档', value: `${detail.type} · ${detail.capabilities.isolationTier}` },
          { key: 'status', label: '状态', value: detail.status, tag: { text: detail.status, theme: STATUS_THEME[detail.status] } },
          { key: 'proj', label: '绑定项目', value: detail.projectId, mono: true },
          { key: 'quota', label: '配额', value: `${detail.quota.limit}；磁盘 ${(detail.quota.diskUsedRatio * 100).toFixed(0)}%${detail.quota.paused ? '（已暂停执行）' : ''}` },
          { key: 'conn', label: '连接', value: `${detail.connectionProfile.endpoint} · 凭证 ${detail.connectionProfile.credentialRef}`, },
          { key: 'health', label: '心跳', value: `每 ${detail.health.heartbeatIntervalMs / 1000}s；退避上限 ${detail.health.reconnectBackoff} 次` },
          { key: 'snap', label: '快照', value: `${detail.snapshots.length} 个（TTL 14 天，去重率 ${(detail.snapshots[0]?.dedupRatio ?? 0) * 100}%）` },
        ]" />
        <div>
          <h4 class="oc-card__title">能力缺失与显式降级</h4>
          <div v-if="detail.capabilities.fallbacks.length" class="oc-stack">
            <div v-for="f in detail.capabilities.fallbacks" :key="f.capability" class="oc-flex oc-flex--wrap">
              <Tag theme="warning" size="small" variant="light-outline">{{ f.capability }}</Tag>
              <span style="font-size: 12px">替代：{{ f.fallback }} —— {{ f.note }}</span>
            </div>
          </div>
          <span v-else class="oc-muted">该后端无能力缺失</span>
        </div>
        <CliHint :command="`oc workspace describe --id ${detail.workspaceId} --with-capabilities`" />
      </div>
    </Drawer>
  </div>
</template>
