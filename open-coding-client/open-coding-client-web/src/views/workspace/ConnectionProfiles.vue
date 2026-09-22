<script setup lang="ts">
/**
 * O-08 连接配置管理。
 * 主机 / 镜像 / 端点 + 跳板 + 凭证引用（永不回显明文）+ 超时重试 + 标签；
 * 企业可禁用某类后端与某些连接参数（禁用态显式标注原因）。
 * 溯源：卷 20 D-WS-9/§4.5；BUILD-MANIFEST O-08。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Drawer, Input, InputNumber, MessagePlugin, Option, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { Workspace, WorkspaceType } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const typeFilter = ref('');
const editing = ref<Workspace | null>(null);
const form = ref({ timeout: 30000, retries: 3, tags: '内网,构建机' });
const timeout = ref(30000);
const testing = ref(false);
/** 工作区（含连接配置）以响应式代理渲染：新增连接后列表与统计卡需立即更新 */
const workspaces = ref(platformData.workspaces);
const createOpen = ref(false);
const createForm = ref({ name: '', type: 'ssh' as WorkspaceType, host: '', endpoint: '', credentialRef: 'secret://', timeoutMs: 30000, retries: 3, tags: '' });

const remote = computed(() => workspaces.value.filter((w) => w.type !== 'local'));
const rows = computed(() => (typeFilter.value ? remote.value.filter((w) => w.type === typeFilter.value) : remote.value));

const columns = [
  { colKey: 'name', title: '工作区', width: 210, cell: 'name' },
  { colKey: 'type', title: '类型', width: 110, cell: 'type' },
  { colKey: 'host', title: '主机', width: 200, cell: 'host' },
  { colKey: 'endpoint', title: '端点 / 镜像', ellipsis: true, cell: 'endpoint' },
  { colKey: 'jumpHost', title: '跳板', width: 200, cell: 'jump' },
  { colKey: 'credentialRef', title: '凭证引用', width: 230, cell: 'cred' },
  { colKey: 'timeoutMs', title: '超时 / 重试', width: 150, cell: 'to' },
  { colKey: 'op', title: '操作', width: 120, cell: 'op' },
];

const health = computed(() => platformData.connectionHealth);

function test(ws: Workspace) {
  testing.value = true;
  window.setTimeout(() => {
    testing.value = false;
    const h = health.value.find((x) => x.workspaceId === ws.workspaceId);
    MessagePlugin.info(`连通性测试：${ws.workspaceId} → 延迟 ${h?.latencyMs ?? '—'}ms，多路复用通道 ${h?.multiplexedChannels ?? 0}，状态 ${h?.state ?? 'UNKNOWN'}`);
  }, 700);
}

function openCreate() {
  createForm.value = { name: '', type: 'ssh', host: '', endpoint: '', credentialRef: 'secret://', timeoutMs: 30000, retries: 3, tags: '' };
  createOpen.value = true;
}

/** 新增连接配置：凭证只接受引用式（secret://），插入列表顶部并进入 provisioning 等待连通性测试 */
function createProfile() {
  const f = createForm.value;
  const name = f.name.trim();
  const host = f.host.trim();
  const credentialRef = f.credentialRef.trim();
  if (!name) {
    MessagePlugin.warning('请先填写连接名称：用于在列表中识别该后端');
    return;
  }
  if (!host) {
    MessagePlugin.warning('请先填写主机：远程后端（SSH / 容器 / 云）必须指定可连接的主机');
    return;
  }
  // 凭证明文零容忍：只允许 secret:// 引用，运行时经 SecretPort 注入
  if (!/^secret:\/\/[\w./-]+$/.test(credentialRef)) {
    MessagePlugin.warning('凭证引用名需为 secret:// 形式（如 secret://ssh/ci-builder）：明文凭证禁止入库');
    return;
  }
  const tags = f.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
  const record: Workspace = {
    workspaceId: `ws-9${String(workspaces.value.length).padStart(3, '0')}`,
    name,
    type: f.type,
    status: 'provisioning',
    projectId: 'proj-unassigned',
    quota: { diskUsedRatio: 0, cpu: 0, memory: 0, networkTraffic: '未开始', inodeCount: 0, limit: '默认配额（可在配额页调整）', paused: false },
    capabilities: {
      fileOps: true,
      watch: f.type !== 'ssh',
      oneshot: true,
      pty: f.type !== 'cloud',
      isolationTier: f.type === 'ssh' ? 'L0（远端围栏有限）' : f.type === 'container' ? 'L1' : 'L2 / L3',
      snapshot: true,
      resourceLimit: f.type !== 'ssh',
      offline: false,
      multiplex: true,
      fallbacks: f.type === 'ssh'
        ? [{ capability: '目录监听', fallback: '轮询（2s，可配）', note: '非实时：变更最多延迟 2s 被感知' }]
        : [],
    },
    envProfile: {
      languages: [], toolchain: [], packageManagers: [],
      git: { branch: '待探测', dirtyFiles: 0, ahead: 0, behind: 0, gc: '待探测', prune: '待探测' },
      resources: { cpuCores: 0, memoryGb: 0, diskFreeGb: 0 },
      probedAt: new Date().toISOString(), diffFromManifest: [],
    },
    bindings: [],
    connectionProfile: {
      host,
      image: f.type === 'container' ? 'oc/base-node:22' : '—',
      endpoint: f.endpoint.trim() || `https://${host}`,
      jumpHost: '—',
      credentialRef,
      timeoutMs: f.timeoutMs,
      retries: f.retries,
      tags,
    },
    health: { heartbeatIntervalMs: 30000, reconnectBackoff: 5, lastProbeAt: new Date().toISOString() },
    commands: [],
    snapshots: [],
  };
  workspaces.value.unshift(record);
  // 清空类型筛选，保证新增行在列表中可见
  typeFilter.value = '';
  createOpen.value = false;
  MessagePlugin.success(`已新增连接配置「${name}」（${f.type}，${host}）：状态 provisioning，凭证以引用 ${credentialRef} 注入（明文不回显），超时 ${f.timeoutMs / 1000}s / 重试 ${f.retries} 次；建议先执行连通性测试（可删除回退）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = remote.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="连接配置管理"
      desc="远程后端的连接配置集中管理：主机/镜像/端点、跳板、凭证引用（经 SecretPort，明文永不回显）、超时与重试、标签；连接持久复用避免每命令一次握手。"
      volume="卷 20" manifest="O-08" cli="oc workspace connection list --show-credentials-ref && oc workspace connection test --id ws-0002"
      :status="[{ label: `${remote.length} 个远程连接`, theme: 'default' }, { label: '凭证引用式', theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 170px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'PERMISSION_DENIED', label: '无权限' },
        ]" />
        <Select v-model="typeFilter" size="small" style="width: 140px" clearable placeholder="类型" aria-label="类型">
          <Option value="" label="全部类型" />
          <Option value="ssh" label="ssh" />
          <Option value="container" label="container" />
          <Option value="cloud" label="cloud" />
        </Select>
        <Button size="small" theme="primary" @click="openCreate">新增连接配置</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="连接池复用率" :value="92.4" format="percent" icon="link" hint="每目标主机一个连接池（SSH 复用 + 隧道）" />
      <StatCard label="平均握手延迟" :value="86" unit="ms" icon="time" hint="SSH ≤ 300ms（复用后）" />
      <StatCard label="心跳间隔" :value="30" unit="秒" icon="refresh" hint="失败即标记连接不健康" />
      <StatCard label="凭证引用" :value="remote.filter((w) => w.connectionProfile.credentialRef.startsWith('secret://')).length" icon="lock" hint="经 SecretPort 注入，不落盘" />
    </div>

    <StateShell
      :state="demo" stage="正在读取连接配置（凭证引用解析中）…"
      empty-title="没有远程连接配置" empty-desc="当前仅有本地工作区；远程后端（SSH/容器/云）需配置连接参数与凭证引用。"
      empty-action="新增 SSH 连接配置" example-task="为构建机配置跳板 + 密钥引用，并做一次连通性测试"
      what="连接配置读取失败" why="凭证引用解析失败（KMS 暂不可达），无法确认引用有效性"
      how="重试；引用不可解析期间禁止测试连接与新建配置（Fail-Fast）" trace-id="trace-eaac2214"
      missing-permission="workspace.connection.manage" risk-level="R3" apply-path="在「权限与审批 → 申请授权」提交工作区连接管理权限申请"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @apply="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="workspaceId" size="small" :pagination="undefined">
        <template #name="{ row }">
          <Button size="small" variant="text" @click="editing = row as Workspace">{{ row.name }}</Button>
        </template>
        <template #type="{ row }">
          <Tag theme="primary" size="small" variant="light-outline">{{ row.type }}</Tag>
        </template>
        <template #host="{ row }"><span class="oc-mono">{{ row.connectionProfile.host }}</span></template>
        <template #endpoint="{ row }"><span class="oc-mono oc-truncate">{{ row.connectionProfile.endpoint }} · {{ row.connectionProfile.image }}</span></template>
        <template #jump="{ row }">
          <span v-if="row.connectionProfile.jumpHost !== '—'" class="oc-mono">{{ row.connectionProfile.jumpHost }}</span>
          <span v-else class="oc-muted">直连</span>
        </template>
        <template #cred="{ row }"><span class="oc-mono oc-truncate">{{ row.connectionProfile.credentialRef }}</span></template>
        <template #to="{ row }">{{ row.connectionProfile.timeoutMs / 1000 }}s / {{ row.connectionProfile.retries }} 次</template>
        <template #op="{ row }">
          <Button size="small" variant="text" :disabled="testing" @click="test(row as Workspace)">测试</Button>
        </template>
      </Table>
    </StateShell>

    <Drawer :visible="!!editing" @visible-change="(v: boolean) => { if (!v) editing = null }" :header="editing ? `连接配置：${editing.name}` : ''" size="620px" :footer="false">
      <div v-if="editing" class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'type', label: '后端类型', value: editing.type },
          { key: 'host', label: '主机', value: editing.connectionProfile.host, mono: true },
          { key: 'image', label: '镜像', value: editing.connectionProfile.image, mono: true },
          { key: 'endpoint', label: '端点', value: editing.connectionProfile.endpoint, mono: true },
          { key: 'jump', label: '跳板', value: editing.connectionProfile.jumpHost, mono: true },
          { key: 'cred', label: '凭证引用', value: editing.connectionProfile.credentialRef, secretRef: true },
          { key: 'tier', label: '隔离档', value: editing.capabilities.isolationTier },
          { key: 'mux', label: '多路复用', value: editing.capabilities.multiplex ? '支持（ControlMaster 风格 / 运行时句柄）' : '不适用' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Select v-model="timeout" size="small" style="width: 150px" aria-label="超时">
            <Option :value="15000" label="超时 15s" />
            <Option :value="30000" label="超时 30s" />
            <Option :value="60000" label="超时 60s" />
          </Select>
          <InputNumber v-model="form.retries" size="small" :min="0" :max="5" style="width: 120px" />
          <Input v-model="form.tags" size="small" style="width: 200px" placeholder="标签（逗号分隔）" />
        </div>
        <div class="oc-flex oc-flex--wrap">
          <Switch size="small" disabled checked /> <span style="font-size: 12px">并发命令上限（防打爆目标机）：8</span>
          <Tag size="small" variant="outline">SSH 默认限制出站（仅白名单），禁止提权命令</Tag>
        </div>
        <CliHint :command="`oc workspace connection update --id ${editing.workspaceId} --timeout ${timeout} --retries ${form.retries}`" />
      </div>
    </Drawer>

    <Dialog v-model:visible="createOpen" header="新增连接配置" width="620px" :confirm-btn="{ content: '创建连接', theme: 'primary' }" cancel-btn="取消" @confirm="createProfile">
      <div class="oc-stack">
        <Input v-model="createForm.name" size="small" placeholder="连接名称（必填，如 构建机 ci-builder）" />
        <Select v-model="createForm.type" size="small" aria-label="后端类型">
          <Option value="ssh" label="ssh（远端主机，跳板可选）" />
          <Option value="container" label="container（容器运行时）" />
          <Option value="cloud" label="cloud（云沙箱）" />
        </Select>
        <Input v-model="createForm.host" size="small" placeholder="主机（必填，如 ci-builder.internal）" />
        <Input v-model="createForm.endpoint" size="small" placeholder="端点（可选，留空按主机推导）" />
        <Input v-model="createForm.credentialRef" size="small" placeholder="凭证引用（必填，secret:// 形式，明文不回显）" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Select v-model="createForm.timeoutMs" size="small" style="width: 150px" aria-label="超时">
            <Option :value="15000" label="超时 15s" />
            <Option :value="30000" label="超时 30s" />
            <Option :value="60000" label="超时 60s" />
          </Select>
          <InputNumber v-model="createForm.retries" size="small" :min="0" :max="5" style="width: 130px" />
          <Input v-model="createForm.tags" size="small" style="width: 200px" placeholder="标签（逗号分隔）" />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          凭证一律引用式（经 SecretPort 注入，明文不落盘）；创建后可先做连通性测试，连接参数不支持时按失败安全处理。
        </div>
      </div>
    </Dialog>
  </div>
</template>
