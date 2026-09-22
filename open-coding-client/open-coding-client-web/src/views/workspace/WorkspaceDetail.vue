<script setup lang="ts">
/**
 * O-03 工作区详情（多 Tab）。
 * 概览 / 能力矩阵（4 后端 × 9 能力，标出当前后端缺失与替代）/ 环境档案 / 命令终端 / 文件树。
 * 能力缺失始终显式提示替代路径（禁止静默降级）。
 * 溯源：卷 20 §4.1/§4.2/§4.3；BUILD-MANIFEST O-03。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Option, Progress, Select, Table, Tabs, TabPanel, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const wsId = ref('ws-0003');
const tab = ref('overview');

const ws = computed(() => platformData.workspaces.find((w) => w.workspaceId === wsId.value) ?? platformData.workspaces[0]);
const matrix = computed(() => platformData.capabilityMatrix);
const currentTypeColumn = computed(() => ws.value.type);

const STATUS_THEME: Record<string, 'success' | 'warning' | 'primary' | 'danger' | 'default'> = {
  created: 'default', provisioning: 'primary', ready: 'success', degraded: 'warning', suspended: 'warning', destroyed: 'danger',
};

const capabilityColumns = computed(() => [
  { colKey: 'capability', title: '能力', width: 220 },
  { colKey: 'local', title: 'LocalFS', width: 150, cell: 'local' },
  { colKey: 'ssh', title: 'SSH', width: 190, cell: 'ssh' },
  { colKey: 'container', title: 'Container', width: 160, cell: 'container' },
  { colKey: 'cloud', title: 'CloudSandbox', width: 170, cell: 'cloud' },
  { colKey: 'current', title: `当前（${currentTypeColumn.value}）`, width: 180, cell: 'current' },
]);

const commandColumns = [
  { colKey: 'mode', title: '模式', width: 110, cell: 'mode' },
  { colKey: 'command', title: '命令', ellipsis: true, cell: 'cmd' },
  { colKey: 'exitCode', title: '退出码', width: 90, cell: 'code' },
  { colKey: 'durationMs', title: '耗时', width: 100, cell: 'dur' },
  { colKey: 'resourcePeak', title: '资源峰值', width: 190 },
  { colKey: 'at', title: '时间', width: 160, cell: 'at' },
];

const FILE_TREE = [
  { path: 'src/', kind: '目录', ignored: false },
  { path: 'src/reconcile/ledger.ts', kind: '文件 · 8.4KB · UTF-8', ignored: false },
  { path: 'src/reconcile/index.ts', kind: '文件 · 2.1KB · UTF-8', ignored: false },
  { path: 'node_modules/', kind: '目录（忽略规则命中，不列出）', ignored: true },
  { path: 'fixtures/ledger-2026-08.csv', kind: '文件 · 118MB（超阈值，仅按范围读）', ignored: false },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.workspaces.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});

/** 打开命令终端（O-05）：跳转命令终端页（当前工作区可在该页选择） */
function openTerminal() {
  router.push('/workspace/terminal');
}

/** 打开文件浏览器（O-06）：跳转文件树与编辑器页（分页目录 + 范围读 + 原子写） */
function openFileBrowser() {
  router.push('/workspace/files');
}
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工作区详情"
      desc="同一后端在四类实现下的能力差异一目了然；缺失能力给出替代方案与「非实时」等语义提示，环境档案注入上下文以减少试错。"
      volume="卷 20" manifest="O-03" :cli="`oc workspace describe --id ${ws.workspaceId} --tab ${tab}`"
      :status="[{ label: ws.status, theme: STATUS_THEME[ws.status] ?? 'default' }, { label: ws.type, theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="wsId" size="small" style="width: 220px" aria-label="选择工作区">
          <Option v-for="w in platformData.workspaces" :key="w.workspaceId" :value="w.workspaceId" :label="`${w.name}（${w.status}）`" />
        </Select>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取工作区能力矩阵与环境档案…"
      empty-title="工作区不存在或已销毁" empty-desc="workspaceId 未命中；销毁后的工作区仅保留快照与审计记录。"
      empty-action="从列表重选工作区" example-task="查看 SSH 后端为何缺少目录监听并确认替代方案"
      what="工作区详情读取失败" why="环境探测结果读取超时（远程主机探测正在重试）"
      how="可重试；能力矩阵来自本地声明，不依赖远程探测" trace-id="trace-f55c2d18"
      :reconnect-in-ms="5000" :disabled-capabilities="['环境档案实时刷新']"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @dismiss-offline="demo = 'NORMAL'"
    >
      <Tabs v-model="tab">
        <TabPanel value="overview" label="概览">
          <div class="oc-grid oc-grid--2" style="margin-top: 10px">
            <div class="oc-card">
              <h3 class="oc-card__title">基本信息</h3>
              <InfoGrid :columns="1" :items="[
                { key: 'id', label: 'workspaceId', value: ws.workspaceId, mono: true, copyable: true },
                { key: 'name', label: '名称', value: ws.name },
                { key: 'type', label: '类型 / 隔离档', value: `${ws.type} · ${ws.capabilities.isolationTier}` },
                { key: 'proj', label: '绑定项目', value: ws.projectId, mono: true },
                { key: 'conn', label: '端点 / 镜像', value: `${ws.connectionProfile.endpoint} · ${ws.connectionProfile.image}` },
                { key: 'cred', label: '凭证引用', value: ws.connectionProfile.credentialRef, secretRef: true },
                { key: 'health', label: '健康', value: `心跳 ${ws.health.heartbeatIntervalMs / 1000}s；退避上限 ${ws.health.reconnectBackoff}；最近探测 ${new Date(ws.health.lastProbeAt).toLocaleTimeString('zh-CN', { hour12: false })}` },
              ]" />
            </div>
            <div class="oc-card">
              <h3 class="oc-card__title">配额水位</h3>
              <div class="oc-stack">
                <div>
                  <div class="oc-flex oc-flex--between"><span>磁盘</span><span>{{ (ws.quota.diskUsedRatio * 100).toFixed(0) }}%</span></div>
                  <Progress :percentage="Math.round(ws.quota.diskUsedRatio * 100)" theme="line" :status="ws.quota.diskUsedRatio > 0.85 ? 'error' : 'active'" size="small" />
                </div>
                <div>
                  <div class="oc-flex oc-flex--between"><span>CPU</span><span>{{ ws.quota.cpu }}%</span></div>
                  <Progress :percentage="ws.quota.cpu" theme="line" :status="ws.quota.cpu > 85 ? 'error' : 'active'" size="small" />
                </div>
                <div>
                  <div class="oc-flex oc-flex--between"><span>内存</span><span>{{ (ws.quota.memory * 100).toFixed(0) }}%</span></div>
                  <Progress :percentage="Math.round(ws.quota.memory * 100)" theme="line" :status="ws.quota.memory > 0.85 ? 'error' : 'active'" size="small" />
                </div>
                <div class="oc-flex oc-flex--wrap">
                  <Tag size="small" variant="light-outline">网络 {{ ws.quota.networkTraffic }}</Tag>
                  <Tag size="small" variant="light-outline">inode {{ ws.quota.inodeCount.toLocaleString('zh-CN') }}</Tag>
                  <Tag v-if="ws.quota.paused" theme="warning" size="small" variant="light-outline">已暂停执行（超阈值）</Tag>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="capability" label="能力矩阵（4 后端 × 9 能力）">
          <Table :data="matrix" :columns="capabilityColumns" row-key="capability" size="small" :pagination="undefined" style="margin-top: 10px">
            <template #local="{ row }"><span :style="{ color: row.local.startsWith('✖') ? 'var(--oc-sev-warn)' : undefined }">{{ row.local }}</span></template>
            <template #ssh="{ row }"><span :style="{ color: row.ssh.startsWith('✖') ? 'var(--oc-sev-warn)' : undefined }">{{ row.ssh }}</span></template>
            <template #container="{ row }">{{ row.container }}</template>
            <template #cloud="{ row }">{{ row.cloud }}</template>
            <template #current="{ row }">
              <span class="oc-mono">{{ row[currentTypeColumn] }}</span>
            </template>
          </Table>
          <div class="oc-card" style="margin-top: 10px">
            <h3 class="oc-card__title">当前后端的缺失能力与替代方案</h3>
            <div v-if="ws.capabilities.fallbacks.length" class="oc-stack">
              <div v-for="f in ws.capabilities.fallbacks" :key="f.capability" class="oc-flex oc-flex--wrap">
                <Tag theme="warning" size="small" variant="light-outline">{{ f.capability }}</Tag>
                <span style="font-size: 12px">替代：{{ f.fallback }} —— {{ f.note }}</span>
              </div>
            </div>
            <Tag v-else theme="success" size="small" variant="light-outline">无缺失能力</Tag>
          </div>
        </TabPanel>

        <TabPanel value="env" label="环境档案">
          <div class="oc-grid oc-grid--2" style="margin-top: 10px">
            <div class="oc-card">
              <h3 class="oc-card__title">探测结果（注入上下文 S2 区段）</h3>
              <InfoGrid :columns="1" :items="[
                { key: 'lang', label: '语言与版本', value: ws.envProfile.languages.join('、') },
                { key: 'tool', label: '工具链', value: ws.envProfile.toolchain.join('、') },
                { key: 'pm', label: '包管理器', value: ws.envProfile.packageManagers.join('、') },
                { key: 'git', label: 'Git 状态', value: `${ws.envProfile.git.branch} · 脏文件 ${ws.envProfile.git.dirtyFiles} · ahead ${ws.envProfile.git.ahead} / behind ${ws.envProfile.git.behind}` },
                { key: 'gitcfg', label: 'Git 维护', value: `gc ${ws.envProfile.git.gc}；prune ${ws.envProfile.git.prune}` },
                { key: 'res', label: '资源', value: `${ws.envProfile.resources.cpuCores} 核 / ${ws.envProfile.resources.memoryGb}GB / 剩余磁盘 ${ws.envProfile.resources.diskFreeGb}GB` },
                { key: 'probed', label: '探测时间', value: new Date(ws.envProfile.probedAt).toLocaleString('zh-CN') },
              ]" />
            </div>
            <div class="oc-card">
              <h3 class="oc-card__title">
                环境差异（vs .oc/env.yaml）
                <CliHint command="oc workspace env diff --id ws-0003" />
              </h3>
              <Table
                :data="ws.envProfile.diffFromManifest" size="small" :pagination="undefined" row-key="tool"
                :columns="[{ colKey: 'tool', title: '工具', width: 120 }, { colKey: 'expected', title: '期望', width: 120 }, { colKey: 'actual', title: '实际', width: 120 }, { colKey: 'severity', title: '等级', width: 100, cell: 'sev' }, { colKey: 'action', title: '建议动作', ellipsis: true }]"
              >
                <template #sev="{ row }">
                  <Tag :theme="row.severity === 'major' ? 'danger' : row.severity === 'minor' ? 'warning' : 'success'" size="small" variant="light-outline">{{ row.severity }}</Tag>
                </template>
              </Table>
              <div class="oc-flex" style="margin-top: 8px">
                <CopyableId :id="`env-${ws.workspaceId}`" label="复制环境档案 ID" />
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="terminal" label="命令终端">
          <Table :data="ws.commands" :columns="commandColumns" row-key="commandId" size="small" :pagination="undefined" style="margin-top: 10px">
            <template #mode="{ row }">
              <Tag :theme="row.mode === 'oneshot' ? 'primary' : row.mode === 'pty' ? 'success' : 'warning'" size="small" variant="light-outline">{{ row.mode }}</Tag>
            </template>
            <template #cmd="{ row }"><span class="oc-mono oc-truncate">{{ row.command }}</span></template>
            <template #code="{ row }">
              <span :style="{ color: row.exitCode && row.exitCode !== 0 ? 'var(--oc-sev-error)' : undefined }">{{ row.exitCode ?? '运行中' }}</span>
            </template>
            <template #dur="{ row }">{{ row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '—' }}</template>
            <template #at="{ row }"><span class="oc-muted">{{ new Date(row.at).toLocaleTimeString('zh-CN', { hour12: false }) }}</span></template>
          </Table>
          <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
            <CliHint :command="`oc workspace exec --id ${ws.workspaceId} --mode oneshot -- 'pnpm test --run'`" />
            <Button size="small" variant="outline" @click="openTerminal">打开命令终端（O-05）</Button>
          </div>
        </TabPanel>

        <TabPanel value="files" label="文件树">
          <div class="oc-card" style="margin-top: 10px">
            <h3 class="oc-card__title">
              目录（分页 + 忽略规则）
              <CliHint command="oc workspace ls --id ws-0003 --page 1 --size 200 --respect-ignore" />
            </h3>
            <Table
              :data="FILE_TREE" size="small" :pagination="undefined" row-key="path"
              :columns="[{ colKey: 'path', title: '路径', width: 320, cell: 'path' }, { colKey: 'kind', title: '说明', ellipsis: true }, { colKey: 'ignored', title: '忽略', width: 100, cell: 'ign' }]"
            >
              <template #path="{ row }"><span class="oc-mono">{{ row.path }}</span></template>
              <template #ign="{ row }">
                <Tag v-if="row.ignored" size="small" variant="light-outline" theme="default">命中忽略</Tag>
                <span v-else class="oc-muted">—</span>
              </template>
            </Table>
            <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
              <Tag size="small" variant="outline">行范围 / 字节范围读，禁止全量载入；大文件只给范围读取</Tag>
              <Button size="small" variant="outline" @click="openFileBrowser">打开文件浏览器（O-06）</Button>
            </div>
          </div>
        </TabPanel>
      </Tabs>
    </StateShell>
  </div>
</template>
