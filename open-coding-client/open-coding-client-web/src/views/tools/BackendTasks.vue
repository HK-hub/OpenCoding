<script setup lang="ts">
/** 后台任务句柄（T-11）：句柄 / 状态 / 等待模式 / 输出分页。溯源：卷 05 D-TOOL-3（混合执行模型） */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { BackendTask } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { backendTasks } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const statusFilter = ref('');
const pageSize = ref(10);
const current = ref<BackendTask | null>(null);
const outputOpen = ref(false);
const chunkIdx = ref(0);
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '后台任务通道连接中断（句柄查询超时）'));

const rows = computed(() => backendTasks.filter((t) => !statusFilter.value || t.status === statusFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));

const columns = [
  { colKey: 'handle', title: '句柄', width: 130 },
  { colKey: 'toolName', title: '工具', width: 130 },
  { colKey: 'command', title: '命令 / 任务', ellipsis: true },
  { colKey: 'workspace', title: '工作区', width: 130 },
  { colKey: 'waitMode', title: '等待模式', width: 140 },
  { colKey: 'durationMs', title: '已运行', width: 100 },
  { colKey: 'exitCode', title: '退出码', width: 90 },
  { colKey: 'outputBytes', title: '输出', width: 120 },
  { colKey: 'status', title: '状态', width: 110 },
];

const outputChunks = computed(() => current.value?.outputChunks ?? []);

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function openOutput(ctx: { row: Record<string, unknown> }) {
  current.value = backendTasks.find((t) => t.handle === ctx.row.handle) ?? null;
  chunkIdx.value = 0;
  outputOpen.value = true;
}

function kill(t: BackendTask | null) {
  if (!t) return;
  MessagePlugin.warning(`已向 ${t.handle} 发送 SIGTERM（5s 后 SIGKILL）；已产出输出保留为工件`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="后台任务句柄"
      desc="超过阈值的任务转后台化：默认「不等待」返回句柄，可配置等待至阈值时间或轮询；输出按游标分页读取，纳入工作对象模型。"
      volume="卷 05"
      manifest="T-11"
      cli="oc tools tasks list --running --json"
      :status="[{ label: `运行中 ${backendTasks.filter((t) => t.status === 'RUNNING').length}`, theme: 'primary' }, { label: '超时/终止保留部分输出', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="refresh">刷新句柄</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="后台任务" :value="backendTasks.length" format="raw" icon="api" />
      <StatCard label="运行中" :value="backendTasks.filter((t) => t.status === 'RUNNING').length" format="raw" icon="loading" />
      <StatCard label="失败 / 被终止" :value="backendTasks.filter((t) => t.status === 'FAILED' || t.status === 'KILLED').length" format="raw" icon="error" />
      <StatCard label="输出总量" :value="backendTasks.reduce((a, t) => a + t.outputBytes, 0)" unit="B" format="raw" icon="file" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="statusFilter" size="small" clearable placeholder="状态" style="width: 160px" :options="['RUNNING', 'COMPLETED', 'FAILED', 'KILLED'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc tools tasks wait BT-51c0 --threshold 30s" label="等待至阈值" />
      <span class="oc-muted" style="font-size: 12px">长任务默认不阻塞 Agent 循环（返回句柄，可轮询或通知）</span>
    </div>

    <StateShell
      :state="state"
      empty-title="没有后台任务"
      empty-desc="当前没有超过阈值的任务（短任务已同步完成）。启动 dev server / 长构建 / 大规模测试会产生句柄。"
      empty-action="清空筛选"
      example-task="启动 dev server 并跟踪其输出"
      :what="'后台任务列表加载失败'"
      :why="err.message"
      how="句柄存储于内核（进程重启后仍可查询）；重试即可恢复列表。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 个句柄，已折叠展示前 ${pageSize} 个`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="statusFilter = ''; refresh()"
    >
      <Table row-key="handle" size="small" :data="shown" :columns="columns" :hover="true" @row-click="openOutput">
        <template #handle="{ row }"><CopyableId :id="row.handle" label="复制句柄" /></template>
        <template #command="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.command }}</span></template>
        <template #waitMode="{ row }">
          <Tag size="small" variant="light-outline" :theme="row.waitMode === '不等待' ? 'default' : row.waitMode === '轮询' ? 'primary' : 'warning'">{{ row.waitMode }}</Tag>
        </template>
        <template #durationMs="{ row }">{{ Math.round(row.durationMs / 1000) }} s</template>
        <template #exitCode="{ row }">
          <span v-if="row.exitCode === null" class="oc-muted">—</span>
          <Tag v-else size="small" variant="light-outline" :theme="row.exitCode === 0 ? 'success' : 'danger'">{{ row.exitCode }}</Tag>
        </template>
        <template #outputBytes="{ row }">
          {{ (row.outputBytes / 1024).toFixed(1) }} KB
          <Tag v-if="row.truncated" size="small" theme="warning" variant="light-outline" style="margin-left: 4px">已截断</Tag>
        </template>
        <template #status="{ row }">
          <Tag size="small" variant="light-outline" :theme="row.status === 'RUNNING' ? 'primary' : row.status === 'COMPLETED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'default'">{{ row.status }}</Tag>
        </template>
      </Table>
    </StateShell>

    <Drawer v-model:visible="outputOpen" :header="`输出分页：${current?.handle ?? ''}`" size="620px" :footer="false">
      <div v-if="current" class="oc-stack">
        <InfoGrid :columns="2" :items="[
          { key: 'handle', label: '句柄', value: current.handle, copyable: true, mono: true },
          { key: 'cmd', label: '命令', value: current.command, mono: true, span: 2 },
          { key: 'wait', label: '等待模式', value: current.waitMode },
          { key: 'status', label: '状态', value: current.status },
          { key: 'dur', label: '已运行', value: `${Math.round(current.durationMs / 1000)} s` },
          { key: 'exit', label: '退出码', value: current.exitCode === null ? '仍在运行' : String(current.exitCode) },
          { key: 'trunc', label: '截断', value: current.truncated ? '输出超过硬限，已截断并保留尾部 4 KB + 错误摘录' : '未截断' },
        ]" />
        <div class="oc-flex" style="gap: 6px">
          <Button size="small" variant="outline" :disabled="chunkIdx === 0" @click="chunkIdx -= 1">上一分片</Button>
          <Button size="small" variant="outline" :disabled="chunkIdx >= outputChunks.length - 1" @click="chunkIdx += 1">下一分片</Button>
          <CliHint :command="`oc tools tasks output ${current.handle} --cursor ${outputChunks[chunkIdx]?.cursor ?? '0'}`" label="等价读取命令" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">分片 {{ chunkIdx + 1 }} / {{ Math.max(1, outputChunks.length) }}（游标 {{ outputChunks[chunkIdx]?.cursor ?? '0' }}）</h3>
          <pre class="oc-pre">{{ outputChunks[chunkIdx]?.text ?? '（无输出）' }}</pre>
        </div>
        <Popconfirm theme="danger" content="终止将向进程组发送 SIGTERM（5s 后 SIGKILL）；已产出输出会保留为工件，不会丢失。确认终止？" @confirm="kill(current); outputOpen = false">
          <Button v-if="current.status === 'RUNNING'" variant="outline" theme="danger">终止任务</Button>
        </Popconfirm>
      </div>
    </Drawer>
  </div>
</template>
