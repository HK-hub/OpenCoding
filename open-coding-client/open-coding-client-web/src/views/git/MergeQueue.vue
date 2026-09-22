<script setup lang="ts">
/**
 * I-06 合并队列看板。
 * 队列深度 + 串行化（同目标分支仅一个合并中）+ 租约（含剩余时间与超时回收）+ 预检结果；
 * 冲突与预检失败一律退回并附报告，保证目标分支始终健康。
 * 溯源：卷 21 D-GIT-5/§4.3；BUILD-MANIFEST I-06。
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
import type { MergeQueueEntry } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const statusFilter = ref('');

/** 页面内队列副本（深拷贝行字段）：重新入队真实修改行状态，且不污染其他视图共享的 mock 源 */
const queue = ref<MergeQueueEntry[]>(platformData.git.mergeQueue.map((q) => ({
  ...q, precheck: { ...q.precheck }, conflictFiles: [...q.conflictFiles], suggestions: [...q.suggestions],
})));
const active = ref<MergeQueueEntry>(queue.value[2]);

const rows = computed(() => (statusFilter.value ? queue.value.filter((q) => q.status === statusFilter.value) : queue.value));
const depth = computed(() => queue.value.filter((q) => q.status === 'queued' || q.status === 'started').length);
const limit = ref(20);
const shown = computed(() => rows.value.slice(0, limit.value));
const edge = computed(() => rows.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));

const depthSeries = computed(() => [
  { name: '队列深度', points: [1, 2, 2, 3, 4, 4, 3, 2].map((v, i) => ({ x: `${(7 - i) * 5}分前`, y: v })) },
]);

const columns = [
  { colKey: 'id', title: '队列项', width: 96, cell: 'id' },
  { colKey: 'branch', title: '来源分支', width: 230, cell: 'branch' },
  { colKey: 'target', title: '目标', width: 130, cell: 'target' },
  { colKey: 'status', title: '状态', width: 120, cell: 'status' },
  { colKey: 'leaseOwner', title: '租约持有者', width: 160, cell: 'lease' },
  { colKey: 'precheck', title: '预检', width: 190, cell: 'precheck' },
  { colKey: 'mergeStrategy', title: '合并策略', width: 150, cell: 'strategy' },
  { colKey: 'op', title: '操作', width: 116, cell: 'op' },
];

const STATUS_THEME: Record<string, 'success' | 'primary' | 'warning' | 'danger' | 'default'> = { queued: 'default', started: 'primary', completed: 'success', conflict: 'danger', rejected: 'warning' };
const PRECHECK_THEME: Record<string, 'success' | 'primary' | 'danger' | 'default'> = { passed: 'success', running: 'primary', failed: 'danger', skipped: 'default' };

/** 当前查看日志的队列项（按行打开预检 / 冲突日志） */
const logRow = ref<MergeQueueEntry | null>(null);

/** 该队列项对应的日志内容：按基线重放、预检命令、冲突文件与退回原因逐条重建 */
function logLinesOf(row: MergeQueueEntry): string[] {
  const lines = [
    `[基线] 拉取 ${row.baseRevision}，重放结果：${row.replayResult}`,
    `[预检] 命令：${row.precheck.command}`,
    `[预检] 结果：${row.precheck.result}（耗时 ${(row.durationMs / 1000).toFixed(1)}s）`,
    `[租约] ${row.leaseOwner === '—' ? '未持有（排队中）' : `${row.leaseOwner} · 剩余 ${row.leaseSeconds}s（超时回收并重试）`}`,
    `[策略] 合并策略：${row.mergeStrategy}`,
  ];
  row.conflictFiles.forEach((f) => lines.push(`[冲突] ${f}（需人工确认后重新入队）`));
  row.suggestions.forEach((s) => lines.push(`[建议] ${s}`));
  if (row.rejectionReason) lines.push(`[退回] ${row.rejectionReason}`);
  return lines;
}

/** 最近一次重新入队时间（行内可见，重试真实生效的时间戳） */
const requeuedAt = ref<Record<string, string>>({});

/** 重新入队：拉取最新基线后重放——真实流转行为 queued 并前移到队首（幂等：已在队列中不重复入队） */
function requeue(row: MergeQueueEntry) {
  if (row.status === 'queued') {
    MessagePlugin.info(`${row.id} 已在队列中（幂等：重复入队不产生新队列项）`);
    return;
  }

  // 状态流转：conflict / rejected / completed / started → queued，重置重放、预检与退回字段
  row.status = 'queued';
  row.leaseOwner = '—';
  row.leaseSeconds = 0;
  row.durationMs = 0;
  row.replayResult = '待拉取最新基线后重放';
  row.precheck = { result: 'skipped', logsRef: '—', command: row.precheck.command };
  row.conflictFiles = [];
  row.suggestions = [];
  row.rejectionReason = '';

  // 队列位置前移：重新入队排到队首（先到先服务），深度与冲突计数随之重算
  const idx = queue.value.indexOf(row);
  if (idx > 0) {
    queue.value.splice(idx, 1);
    queue.value.unshift(row);
  }
  requeuedAt.value[row.id] = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  MessagePlugin.success(`已重新入队 ${row.id}（拉取最新基线后重放；幂等可重试）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = queue.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="合并队列"
      desc="串行化保证同一目标分支同时只有一个合并；进行中的合并持租约（超时回收，队列持久化可重启恢复）；预检失败或冲突一律退回并附报告。"
      volume="卷 21" manifest="I-06" cli="oc git merge queue --show-lease --show-precheck"
      :status="[{ label: `队列深度 ${depth}`, theme: depth > 4 ? 'warning' : 'primary' }, { label: '串行化', theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="statusFilter" size="small" style="width: 150px" clearable placeholder="状态" aria-label="状态">
          <Option value="" label="全部状态" />
          <Option value="queued" label="queued" />
          <Option value="started" label="started" />
          <Option value="completed" label="completed" />
          <Option value="conflict" label="conflict" />
          <Option value="rejected" label="rejected" />
        </Select>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="队列深度" :value="depth" icon="git" :target="5" target-kind="max" hint="深度超阈值提示先消费再入队" />
      <StatCard label="合并中" :value="queue.filter((q) => q.status === 'started').length" icon="loading" hint="同目标分支串行：仅一个合并中" />
      <StatCard label="冲突 / 退回" :value="queue.filter((q) => q.status === 'conflict' || q.status === 'rejected').length" icon="bug" hint="退回必须附冲突文件或预检日志引用" />
      <StatCard label="吞吐" :value="11.4" unit="次/分钟" icon="chart" :target="10" hint="目标 ≥10 次/分钟" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">队列深度趋势</h3>
        <OcChart type="area" :height="190" :series="depthSeries" :threshold="{ value: 5, label: '深度告警 5' }" aria-label="合并队列深度" />
        <Tag size="small" variant="outline" style="margin-top: 8px">队列持久化：进程重启后按持久化顺序恢复，租约超时自动回收</Tag>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          队列项详情：{{ active.id }}
          <CliHint :command="`oc git merge show --id ${active.id}`" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'branch', label: '来源分支 → 目标', value: `${active.branch} → ${active.target}`, mono: true },
          { key: 'base', label: '基线', value: active.baseRevision, mono: true },
          { key: 'replay', label: '重放结果', value: active.replayResult },
          { key: 'lease', label: '租约', value: active.leaseOwner === '—' ? '未持有（排队中）' : `${active.leaseOwner} · 剩余 ${active.leaseSeconds}s（超时回收并重试）` },
          { key: 'precheck', label: '预检', value: `${active.precheck.command} → ${active.precheck.result}（日志 ${active.precheck.logsRef}）`, mono: true },
          { key: 'strategy', label: '合并策略', value: `${active.mergeStrategy}（默认 squash 保持目标分支线性）` },
          { key: 'reject', label: '退回原因', value: active.rejectionReason || '无' },
        ]" />
        <div v-if="active.conflictFiles.length" class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag v-for="f in active.conflictFiles" :key="f" theme="danger" size="small" variant="light-outline" class="oc-mono">{{ f }}</Tag>
        </div>
      </div>
    </div>

    <StateShell
      :state="state" stage="正在读取合并队列与租约状态…"
      empty-title="合并队列为空" empty-desc="没有等待合并的分支；任务完成后可自动入队或经 PR/MR 人工审查。"
      empty-action="提交一个任务分支入队" example-task="让 oc/T-7f3a-reconcile 入队并观察重放与预检"
      what="合并队列读取失败" why="队列存储不可达（与事件日志同库，主库切换期间只读）"
      how="可重试；队列写操作在此期间被拒绝（不排队，避免顺序错乱）" trace-id="trace-e55f66dd"
      :collapsed-summary="`已折叠 ${rows.length - shown.length} 项（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="shown" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.id }}</span></template>
        <template #branch="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono oc-truncate">{{ row.branch }}</span>
            <Tag v-if="row.status === 'started'" theme="primary" size="small" variant="light-outline">合并中</Tag>
          </div>
        </template>
        <template #target="{ row }"><span class="oc-mono">{{ row.target }}</span></template>
        <template #status="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 4px; align-items: center">
            <Tag :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
            <span v-if="requeuedAt[row.id]" class="oc-muted" style="font-size: 11px">重新入队 {{ requeuedAt[row.id] }}</span>
          </div>
        </template>
        <template #lease="{ row }">
          <span v-if="row.leaseOwner === '—'" class="oc-muted">—</span>
          <span v-else class="oc-mono">{{ row.leaseOwner }}（{{ row.leaseSeconds }}s）</span>
        </template>
        <template #precheck="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <Tag :theme="PRECHECK_THEME[row.precheck.result] ?? 'default'" size="small" variant="light-outline">{{ row.precheck.result }}</Tag>
            <Button size="small" variant="text" @click="logRow = row as MergeQueueEntry">日志</Button>
          </div>
        </template>
        <template #strategy="{ row }"><span class="oc-mono">{{ row.mergeStrategy }}</span></template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="active = row as MergeQueueEntry">详情</Button>
          <Button size="small" variant="text" @click="requeue(row as MergeQueueEntry)">重试</Button>
        </template>
      </Table>
      <Progress :percentage="Math.round(((queue.length - depth) / Math.max(1, queue.length)) * 100)" theme="line" style="margin-top: 8px" />
    </StateShell>

    <Dialog
      :visible="!!logRow"
      @visible-change="(v: boolean) => { if (!v) logRow = null }"
      :header="`预检日志 · ${logRow?.id ?? ''}（${logRow?.branch ?? ''}）`" width="720px" :footer="false"
    >
      <div v-if="logRow" class="oc-stack" style="gap: 8px">
        <div class="oc-muted" style="font-size: 12px">
          日志引用：<span class="oc-mono">{{ logRow.precheck.logsRef }}</span> · 结果
          <span class="oc-mono">{{ logRow.precheck.result }}</span>（保留 30 天，可导出）
        </div>
        <pre class="oc-mono" style="font-size: 12px; white-space: pre-wrap; margin: 0; line-height: 1.7">{{ logLinesOf(logRow).join('\n') }}</pre>
        <div class="oc-flex" style="gap: 8px">
          <CliHint :command="`oc git merge logs --id ${logRow.id} --precheck`" label="复制日志命令" />
        </div>
      </div>
    </Dialog>
  </div>
</template>
