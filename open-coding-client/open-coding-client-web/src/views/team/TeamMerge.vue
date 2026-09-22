<script setup lang="ts">
/**
 * 隔离与合并（R-07）：成员 worktree 列表 + 写范围声明 + 重叠串行化提示 + 合并队列深度 + 冲突 + 回滚。
 * 溯源：卷 13 §4.3 隔离与合并（隔离优先 + 前声明 + 主管裁决；任务级/团队级回滚）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { MergeEntry } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref('TEAM-checkout-01');
const conflict = ref<MergeEntry | null>(null);

const team = computed(() => taskData.teams.find((t) => t.teamId === selected.value) ?? taskData.teams[0]);

/** 成员 worktree：成员 + 其当前任务的写范围声明 */
const worktrees = computed(() => team.value.members.map((m) => {
  const task = taskData.workItems.find((i) => i.itemId === m.currentTaskId);
  return {
    memberId: m.memberId, member: m.name, type: m.type, worktree: m.worktreeRef, state: m.state,
    taskShort: task?.shortId ?? '—', taskTitle: task?.title ?? '（无进行中任务）',
    scope: task?.writeScope ?? [], branch: task ? `oc/${task.shortId.toLowerCase()}-slug` : '—',
  };
}));

/** 写范围重叠检测：两两比对路径模式（前缀/通配匹配） */
const overlaps = computed(() => {
  const out: { a: string; b: string; files: string[]; action: string }[] = [];
  const list = worktrees.value.filter((w) => w.scope.length);
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const norm = (p: string) => p.replace(/\*\*/g, '').replace(/\*$/g, '');
      const files = list[i].scope.filter((sa) => list[j].scope.some((sb) => norm(sa).startsWith(norm(sb).slice(0, 12)) || sa === sb));
      if (files.length) out.push({ a: list[i].member, b: list[j].member, files, action: '调度器串行化（避免同文件并发写）' });
    }
  }
  return out;
});

const queue = computed(() => team.value.mergeQueue);
const queueDepth = computed(() => queue.value.filter((x) => x.status === 'queued' || x.status === 'started').length);

const queueColumns = [
  { colKey: 'branch', title: '分支', width: 260 },
  { colKey: 'target', title: '目标', width: 90 },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'owner', title: '提交者', width: 160 },
  { colKey: 'precheck', title: '预检结果' },
  { colKey: 'op', title: '操作', width: 130 },
];

const wtColumns = [
  { colKey: 'member', title: '成员', width: 170 },
  { colKey: 'worktree', title: 'worktree', width: 190 , cell: 'worktreeCell' },
  { colKey: 'branch', title: '分支', width: 220 },
  { colKey: 'task', title: '当前任务' },
  { colKey: 'scope', title: '写范围声明', width: 260 },
  { colKey: 'state', title: '状态', width: 100 },
];

/** 冲突处置请求记录：合并记录 id → 请求列表（重放/裁决请求，真实登记而非只弹提示） */
const conflictRequests = ref<Record<string, { label: string; at: string }[]>>({});

/** 在合并记录上登记一次处置请求（重放到最新基线 / 审查者裁决） */
function requestConflictAction(entry: MergeEntry, label: string) {
  const list = conflictRequests.value[entry.id] ?? [];
  list.push({ label, at: new Date().toISOString() });
  conflictRequests.value[entry.id] = list;
  MessagePlugin.success(`已请求${label}（${entry.id}）：已登记到合并队列该行，等待处理结果`);
}

/** 该合并记录最近一次处置请求的展示文本（表格行内展示） */
function lastConflictRequest(id: string): string {
  const list = conflictRequests.value[id];
  if (!list?.length) return '';
  const last = list[list.length - 1];
  return `${last.label} · ${new Date(last.at).toLocaleTimeString('zh-CN')}`;
}

function dropWorktree(memberName: string, worktree: string) {
  MessagePlugin.warning(`已丢弃 ${memberName} 的 worktree（${worktree}）：未合并改动一并丢弃，任务回到可执行并重新分配`);
}

function teamRollback() {
  MessagePlugin.warning('团队级回滚：全部成员回退至最近团队检查点 ckp_team_p3；已合并提交按 Git 策略回滚（需审批）');
}

/** 导出隔离矩阵：worktree×写范围、重叠检测与合并队列全部与页面同源，供离线核对串行化依据 */
function exportMatrix() {
  const file = downloadJson({
    teamId: selected.value,
    teamName: team.value.name,
    worktrees: worktrees.value,
    scopeOverlaps: overlaps.value,
    mergeQueue: queue.value,
  }, `oc-team-merge-matrix-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`隔离矩阵已导出：${file}`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = team.value ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="隔离与合并" volume="卷 13" manifest="R-07" cli="oc team merge TEAM-checkout-01 --queue --conflicts"
      desc="隔离优先：每成员独立 worktree + 写范围前声明；范围重叠由调度器串行化（消灭冲突于执行前）；合并由队列串行执行，冲突需人工或审查者裁决，禁止强行覆盖。"
      :status="[{ label: `队列深度 ${queueDepth}`, theme: queueDepth > 3 ? 'warning' : 'primary' }, { label: `${overlaps.length} 组写范围重叠`, theme: overlaps.length ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportMatrix">导出隔离矩阵</Button>
        <Popconfirm content="团队级回滚会把全部成员回退到最近团队检查点，并撤销未合并的 worktree 改动；已合并提交需走 Git 回滚审批。" theme="danger" @confirm="teamRollback">
          <Button size="small" theme="danger" variant="outline">团队级回滚</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">团队：</span>
        <Select v-model="selected" size="small" style="width: 300px" :options="taskData.teams.map((t) => ({ label: `${t.name}（${t.mergeQueue.length} 条合并记录）`, value: t.teamId }))" />
        <Tag size="small" variant="outline">分支命名：oc/&lt;task-id&gt;-slug</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="成员 worktree" :value="worktrees.length" unit="个" icon="git" />
      <StatCard label="合并队列深度" :value="queueDepth" unit="条" icon="layers" :lower-is-better="true" />
      <StatCard label="冲突" :value="queue.filter((q) => q.status === 'conflict').length" unit="条" icon="error" :lower-is-better="true" />
      <StatCard label="写范围重叠" :value="overlaps.length" unit="组" icon="link" :lower-is-better="true" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有 worktree" empty-desc="团队尚未创建隔离工作区；并行任务才需要创建 worktree（写范围不重叠可共享）。" empty-action="为成员创建 worktree"
      example-task="为批量重构的批次 4 创建 oc-wt/T-9c40-b4"
      what="隔离视图加载失败" why="worktree 元数据与 Git 实际状态不一致（有游离分支）"
      how="可重试；系统会列出游离分支并提供清理建议（不自动删除）" trace-id="trace-8c13f7e5"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已创建 3 个成员 worktree')"
    >
      <div class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">成员 worktree 与写范围声明</div>
          <Table :data="worktrees" row-key="memberId" size="small" :pagination="undefined" :columns="wtColumns">
            <template #member="{ row }">
              <OcIcon :name="row.type === 'human' ? 'user-circle' : 'robot'" size="12px" />
              <span style="font-size: 12px"> {{ row.member }}</span>
            </template>
            <template #worktreeCell="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.worktree }}</span></template>
            <template #branch="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.branch }}</span></template>
            <template #task="{ row }">
              <span style="font-size: 12px">{{ row.taskShort }} {{ row.taskTitle.slice(0, 16) }}</span>
            </template>
            <template #scope="{ row }">
              <Tag v-for="s in row.scope" :key="s" size="small" variant="outline" class="oc-mono" style="margin-right: 4px; font-size: 10px">{{ s }}</Tag>
              <span v-if="!row.scope.length" class="oc-muted" style="font-size: 11px">未声明（只读或已完成）</span>
            </template>
            <template #state="{ row }"><Tag size="small" variant="light-outline">{{ row.state }}</Tag></template>
          </Table>
        </div>

        <div v-if="overlaps.length" class="oc-card" style="border-color: var(--oc-sev-warn)">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon name="link" size="14px" color="var(--oc-sev-warn)" />
            <b>写范围重叠检测</b>
            <Tag size="small" theme="warning" variant="light-outline">前置拦截：串行化而非事后合并</Tag>
          </div>
          <div v-for="o in overlaps" :key="`${o.a}-${o.b}`" class="oc-secondary" style="font-size: 12px; margin-top: 4px">
            {{ o.a }} ↔ {{ o.b }}：重叠路径 {{ o.files.join('、') }} → 处置：{{ o.action }}
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 6px">
            <RiskBadge level="R1" />
            <span class="oc-muted" style="font-size: 12px">同文件并发写被禁止；允许「对拍」等只读阶段并行。</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">合并队列（串行执行 + 预检门禁）</div>
          <Table :data="queue" row-key="id" size="small" :pagination="undefined" :columns="queueColumns">
            <template #branch="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.branch }}</span></template>
            <template #status="{ row }">
              <Tag size="small" :theme="row.status === 'completed' ? 'success' : row.status === 'conflict' ? 'danger' : row.status === 'rejected' ? 'warning' : 'primary'" variant="light-outline">
                {{ row.status }}
              </Tag>
              <div v-if="lastConflictRequest(row.id)" class="oc-muted" style="font-size: 11px">{{ lastConflictRequest(row.id) }}</div>
            </template>
            <template #op="{ row }">
              <div class="oc-flex" style="gap: 4px">
                <Button v-if="row.status === 'conflict'" size="small" variant="text" theme="danger" @click="conflict = row">处理冲突</Button>
                <Tooltip content="任务级回滚：丢弃该 worktree（未合并改动一并丢弃）">
                  <Popconfirm content="丢弃 worktree 会删除其中的未合并改动（不可恢复）；任务回到可执行并重新分配。" theme="danger" @confirm="dropWorktree(row.owner, row.branch)">
                    <Button size="small" variant="text">丢弃</Button>
                  </Popconfirm>
                </Tooltip>
              </div>
            </template>
          </Table>
        </div>

        <div class="oc-flex" style="gap: 8px">
          <CliHint command="oc team merge queue TEAM-checkout-01 --depth --leases" />
          <CopyableId id="trace-8c13f7e5" label="复制 traceId" />
        </div>
      </div>

      <Drawer :visible="!!conflict" header="合并冲突处理" size="560px" :footer="false" @close="conflict = null">
        <div v-if="conflict" class="oc-stack">
          <div class="oc-card">
            <InfoGrid :columns="1" :items="[
              { key: 'branch', label: '源分支', value: conflict.branch, mono: true },
              { key: 'target', label: '目标分支', value: conflict.target, mono: true },
              { key: 'owner', label: '提交者', value: conflict.owner },
              { key: 'pre', label: '预检结果', value: conflict.precheckResult },
              { key: 'at', label: '入队时间', value: new Date(conflict.enqueuedAt).toLocaleString('zh-CN') },
            ]" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">冲突文件（{{ conflict.conflictFiles.length }}）</div>
            <div v-for="f in conflict.conflictFiles" :key="f" class="oc-mono" style="font-size: 12px">{{ f }}</div>
            <div class="oc-secondary" style="font-size: 12px; margin-top: 6px">
              处置顺序：先「重放变更到最新基线」→ 语义冲突交审查者/人类裁决 → 结论入库；禁止强行覆盖目标分支。
            </div>
          </div>
          <div v-if="conflictRequests[conflict.id]?.length" class="oc-card" style="border-color: var(--oc-sev-warn)">
            <div class="oc-card__title">处置请求记录（{{ conflictRequests[conflict.id].length }} 条）</div>
            <div v-for="(q, i) in conflictRequests[conflict.id]" :key="i" class="oc-secondary" style="font-size: 12px">
              · {{ q.label }} · {{ new Date(q.at).toLocaleString('zh-CN') }}
            </div>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Button size="small" theme="primary" @click="requestConflictAction(conflict, '重新基线重放')">重放到最新基线</Button>
            <Button size="small" variant="outline" @click="requestConflictAction(conflict, '审查者裁决')">请求裁决</Button>
            <Button size="small" variant="outline" @click="conflict = null">关闭</Button>
          </div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
