<script setup lang="ts">
/**
 * I-01 Worktree 列表。
 * 任务 / 分支 / 状态 / 大小 / 创建与清理时间；打开与清理（引用未合并分支的 worktree 不自动删）。
 * 路径固定在 ${OPENCODING_HOME}/worktrees 下，与用户工作区分离以避免误删。
 * 溯源：卷 21 D-GIT-2/§4.1；BUILD-MANIFEST I-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Option, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData, humanBytes } from '@/mock/data/platform';
import type { GitWorktree } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const repoFilter = ref('');
const statusFilter = ref('');
const detail = ref<GitWorktree | null>(null);
/** 当前打开的 worktree（「打开」动作的就地详情） */
const openRow = ref<GitWorktree | null>(null);

// 本地 ref 持有清单（与领域数据共享同一批对象），保证新建后页面立即重渲染
const trees = ref<GitWorktree[]>([...platformData.git.worktrees]);
const rows = computed(() =>
  trees.value.filter((t) => {
    if (repoFilter.value && t.repo !== repoFilter.value) return false;
    if (statusFilter.value && t.status !== statusFilter.value) return false;
    return true;
  }),
);
const limit = ref(20);
const shown = computed(() => rows.value.slice(0, limit.value));
const edge = computed(() => rows.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));
const totalBytes = computed(() => trees.value.reduce((a, t) => a + t.sizeBytes, 0));

const STATUS_THEME: Record<string, 'success' | 'primary' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'primary', MERGED_PENDING_CLEANUP: 'success', CLEANED: 'default', ORPHAN: 'warning', BLOCKED: 'danger',
};

const STATUS_LABEL: Record<GitWorktree['status'], string> = {
  ACTIVE: '活跃', MERGED_PENDING_CLEANUP: '已合并待清理', CLEANED: '已清理', ORPHAN: '孤儿', BLOCKED: '阻塞',
};

/** 创建 Worktree：生成独立分支与路径并登记到清单（同时写入页面数据与领域数据） */
function createWorktree() {
  const seq = platformData.git.worktrees.length + 1;
  const repo = platformData.git.repos.find((r) => r.repo === (repoFilter.value || platformData.git.repos[0].repo)) ?? platformData.git.repos[0];
  const taskId = `T-${Date.now().toString(16).slice(-4)}`;
  const home = '${OPENCODING_HOME}';
  const wt: GitWorktree = {
    worktreeId: `wt-${String(seq).padStart(4, '0')}`,
    taskId,
    repo: repo.repo,
    branch: `oc/${taskId}-create`,
    path: `${home}/worktrees/${repo.repo}/${taskId}`,
    status: 'ACTIVE',
    sizeBytes: 0,
    baseRevision: `${repo.defaultBranch}@9f21ab4`,
    mergedAt: null,
    cleanupAt: null,
    dirty: false,
    writeScope: ['（待任务声明写范围）'],
  };
  platformData.git.worktrees.push(wt);
  trees.value = [wt, ...trees.value];
  // 清空筛选，确保新记录在清单中可见
  repoFilter.value = '';
  statusFilter.value = '';
  MessagePlugin.success(`已创建 ${wt.worktreeId}：分支 ${wt.branch} → 路径 ${wt.path}（状态 ACTIVE）`);
}

/** 打开 worktree：就地展示该工作树的路径 / 分支 / 写范围与生命周期 */
function openWorktree(row: GitWorktree) {
  openRow.value = row;
}

const columns = [
  { colKey: 'worktreeId', title: 'Worktree', width: 120, cell: 'id' },
  { colKey: 'taskId', title: '任务', width: 110, cell: 'task' },
  { colKey: 'repo', title: '仓库', width: 150 },
  { colKey: 'branch', title: '分支', width: 230, cell: 'branch' },
  { colKey: 'status', title: '状态', width: 180, cell: 'status' },
  { colKey: 'sizeBytes', title: '大小', width: 110, cell: 'size' },
  { colKey: 'mergedAt', title: '合并 / 清理时间', width: 220, cell: 'time' },
  { colKey: 'op', title: '操作', width: 150, cell: 'op' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = trees.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Worktree 列表"
      desc="按需分层隔离：单任务在原地工作，多任务/团队并行按任务创建 worktree；只读任务共享。引用未合并分支的 worktree 不会被自动清理。"
      volume="卷 21" manifest="I-01" cli="oc git worktree list --show-disk && oc git worktree clean --id wt-0006"
      :status="[{ label: `${trees.length} 个 worktree`, theme: 'default' }, { label: '单仓上限 20', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="repoFilter" size="small" style="width: 170px" clearable placeholder="仓库" aria-label="仓库">
          <Option value="" label="全部仓库" />
          <Option v-for="r in platformData.git.repos" :key="r.repo" :value="r.repo" :label="r.repo" />
        </Select>
        <Select v-model="statusFilter" size="small" style="width: 180px" clearable placeholder="状态" aria-label="状态">
          <Option value="" label="全部状态" />
          <Option value="ACTIVE" label="ACTIVE" />
          <Option value="MERGED_PENDING_CLEANUP" label="已合并待清理" />
          <Option value="ORPHAN" label="ORPHAN" />
          <Option value="BLOCKED" label="BLOCKED" />
        </Select>
        <Button size="small" theme="primary" @click="createWorktree">创建 Worktree</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="活跃 worktree" :value="trees.filter((t) => t.status === 'ACTIVE').length" icon="git" hint="独立索引与工作树，互不干扰" />
      <StatCard label="磁盘占用" :value="totalBytes" format="token" unit="B" icon="database" hint="超盘配额时拒绝新建并提示清理" />
      <StatCard label="脏工作树" :value="trees.filter((t) => t.dirty).length" icon="edit" hint="清理前先检查未提交改动" />
      <StatCard label="孤儿 / 阻塞" :value="trees.filter((t) => t.status === 'ORPHAN' || t.status === 'BLOCKED').length" icon="bug" hint="引用未合并分支：不自动删" />
    </div>

    <StateShell
      :state="state" stage="正在读取 worktree 清单与磁盘占用…"
      empty-title="没有 worktree" empty-desc="当前没有并行任务需要隔离；单任务默认直接在用户工作区工作（不创建 worktree）。"
      empty-action="查看写范围重叠判断" example-task="两个任务改同一文件时创建独立 worktree 避免互相覆盖"
      what="Worktree 清单读取失败" why="git worktree list 超时（大仓索引正在重建，status 耗时超过 500ms 预算）"
      how="可重试；创建立即失败并给报告（异步化更慢，不静默排队）" trace-id="trace-ff001177"
      :collapsed-summary="`已折叠 ${rows.length - shown.length} 个 worktree（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="shown" :columns="columns" row-key="worktreeId" size="small" :pagination="undefined">
        <template #id="{ row }">
          <Button size="small" variant="text" @click="detail = row as GitWorktree">{{ row.worktreeId }}</Button>
        </template>
        <template #task="{ row }"><span class="oc-mono">{{ row.taskId }}</span></template>
        <template #branch="{ row }"><span class="oc-mono oc-truncate">{{ row.branch }}</span></template>
        <template #status="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <Tag :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
            <Tag v-if="row.dirty" theme="warning" size="small" variant="light-outline">脏</Tag>
          </div>
        </template>
        <template #size="{ row }">{{ row.sizeBytes ? humanBytes(row.sizeBytes) : '已清理' }}</template>
        <template #time="{ row }">
          <span class="oc-muted">
            {{ row.mergedAt ? `合并 ${new Date(row.mergedAt).toLocaleString('zh-CN')}` : '未合并' }}
            {{ row.cleanupAt ? ` · 清理 ${new Date(row.cleanupAt).toLocaleString('zh-CN')}` : '' }}
          </span>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="openWorktree(row as GitWorktree)">打开</Button>
          <Popconfirm
            :theme="row.dirty || row.status === 'BLOCKED' ? 'danger' : 'warning'"
            :confirm-btn="{ content: '清理 worktree', theme: 'danger' }" cancel-btn="取消"
            @confirm="MessagePlugin.success(`已清理 ${row.worktreeId}（未合并分支的 worktree 需先合并或显式放弃；本次已确认）`)"
          >
            <template #content>
              <div style="max-width: 320px">
                <div v-if="row.dirty">该 worktree 有未提交改动：清理会丢弃它们（建议先提交或创建快照）。</div>
                <div v-if="row.status === 'BLOCKED'">引用未合并分支 → 默认不自动清理，本次为人工强制。</div>
                <div>后果：删除工作树目录（分支引用保留在仓库中）。是否可撤销：不可撤销（分支引用可再创建 worktree）。</div>
              </div>
            </template>
            <Button size="small" variant="text" theme="danger">清理</Button>
          </Popconfirm>
        </template>
      </Table>
    </StateShell>

    <div v-if="detail" class="oc-card">
      <h3 class="oc-card__title">
        Worktree 详情：{{ detail.worktreeId }}
        <CliHint :command="`oc git worktree show --id ${detail.worktreeId}`" />
      </h3>
      <InfoGrid :columns="2" :items="[
        { key: 'path', label: '路径', value: detail.path, mono: true },
        { key: 'branch', label: '分支', value: detail.branch, mono: true },
        { key: 'base', label: '基线', value: detail.baseRevision, mono: true },
        { key: 'scope', label: '写范围', value: detail.writeScope.join('、'), mono: true },
        { key: 'dirty', label: '工作树状态', value: detail.dirty ? '有未提交改动（清理会丢失，建议先提交）' : '干净' },
        { key: 'policy', label: '生命周期', value: '合并后 24h 清理；未合并保留至放弃或 14 天；引用未合并分支不自动删' },
      ]" />
    </div>

    <Dialog
      :visible="!!openRow"
      @visible-change="(v: boolean) => { if (!v) openRow = null }"
      :header="`打开 Worktree · ${openRow?.worktreeId ?? ''}`" width="680px" :footer="false"
    >
      <div v-if="openRow" class="oc-stack" style="gap: 10px">
        <InfoGrid :columns="1" :items="[
          { key: 'path', label: '路径（独立工作树，与用户工作区分离）', value: openRow.path, mono: true, copyable: true },
          { key: 'branch', label: '分支', value: openRow.branch, mono: true },
          { key: 'repo', label: '仓库 / 任务', value: `${openRow.repo} · ${openRow.taskId}`, mono: true },
          { key: 'base', label: '基线', value: openRow.baseRevision, mono: true },
          { key: 'status', label: '状态', value: `${openRow.status}（${STATUS_LABEL[openRow.status]}）` },
          { key: 'size', label: '磁盘占用', value: openRow.sizeBytes ? humanBytes(openRow.sizeBytes) : '已清理' },
          { key: 'dirty', label: '工作树状态', value: openRow.dirty ? '有未提交改动（清理会丢失，建议先提交）' : '干净' },
          { key: 'scope', label: '写范围', value: openRow.writeScope.join('、'), mono: true },
        ]" />
        <div class="oc-flex" style="gap: 8px">
          <CliHint :command="`oc git worktree open --id ${openRow.worktreeId}`" label="复制打开命令" />
          <Tag size="small" variant="outline">打开即在独立工作树中继续该任务，不影响其它 worktree</Tag>
        </div>
      </div>
    </Dialog>
  </div>
</template>
