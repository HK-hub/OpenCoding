<script setup lang="ts">
/**
 * I-03 分支管理。
 * 每任务一分支（oc/<task-id>-slug）+ 主分支保护（禁止直推与强推）+ 栈式分支（可选，企业/大改动场景）。
 * 删除分支属危险操作：需列出未合并提交并二次确认。
 * 溯源：卷 21 D-GIT-4/§4.4；BUILD-MANIFEST I-03。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { GitWorktree } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const stacked = ref(platformData.git.branchPolicy.stacked);
const deleteTarget = ref<GitWorktree | null>(null);
const reason = ref('');

const trees = computed(() => platformData.git.worktrees);
const policy = computed(() => platformData.git.branchPolicy);
const taskBranches = computed(() => trees.value.filter((t) => t.branch.startsWith('oc/') && t.status !== 'CLEANED'));
const unmerged = computed(() => trees.value.filter((t) => !t.mergedAt && t.status !== 'CLEANED'));
const limit = ref(20);
const shown = computed(() => taskBranches.value.slice(0, limit.value));
const edge = computed(() => taskBranches.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));

const columns = [
  { colKey: 'branch', title: '分支', width: 280, cell: 'branch' },
  { colKey: 'taskId', title: '关联任务', width: 110, cell: 'task' },
  { colKey: 'repo', title: '仓库', width: 150 },
  { colKey: 'role', title: '角色', width: 130, cell: 'role' },
  { colKey: 'mergedAt', title: '合并状态', width: 180, cell: 'merged' },
  { colKey: 'dirty', title: '工作树', width: 110, cell: 'dirty' },
  { colKey: 'op', title: '操作', width: 140, cell: 'op' },
];

function confirmDelete() {
  const t = deleteTarget.value;
  if (!t) return;
  if (!t.mergedAt && !reason.value) {
    MessagePlugin.error('该分支存在未合并提交：请填写删除理由（写入审计）后再确认');
    return;
  }
  MessagePlugin.success(`已删除分支 ${t.branch}（自动临时引用 oc/backup/${Date.now()} 已创建，可用 oc git undo 恢复）`);
  deleteTarget.value = null;
  reason.value = '';
}

onMounted(() => {
  window.setTimeout(() => (demo.value = trees.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="分支管理"
      desc="默认每任务一分支；main 与 release/* 为保护分支，禁止直接推送与强推。栈式分支为可选能力（企业/大改动场景），开启后需按栈顺序合并。"
      volume="卷 21" manifest="I-03" cli="oc git branch list --protect-main --show-stacked"
      :status="[{ label: `保护分支 ${policy.protected.length}`, theme: 'warning' }, { label: stacked ? '栈式分支已启用' : '栈式分支关闭', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Switch v-model="stacked" size="small" /> <span style="font-size: 12px">栈式分支（大改动）</span>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="任务分支" :value="taskBranches.length" icon="git" hint="命名规范 oc/<task-id>-<slug>" />
      <StatCard label="未合并分支" :value="unmerged.length" icon="warning" hint="删除需理由并自动建备份引用" />
      <StatCard label="保护分支" :value="policy.protected.length" icon="secured" hint="禁止直推与强推（企业可禁用更多操作）" />
      <StatCard label="栈式深度" :value="stacked ? 3 : 0" icon="layers" hint="栈式需按顺序合并，禁止跳栈" />
    </div>

    <StateShell
      :state="state" stage="正在读取分支与保护策略…"
      empty-title="没有任务分支" empty-desc="尚不存在 oc/* 任务分支；首次提交时按规范自动创建。"
      empty-action="查看分支规范" example-task="为 T-7f3a 创建 oc/T-7f3a-reconcile 并验证主分支保护"
      what="分支列表读取失败" why="git branch --list 超时（大仓 ref 数量过多，packed-refs 重建中）"
      how="可重试；保护策略来自本地配置，不受远端影响" trace-id="trace-b22c33aa"
      :collapsed-summary="`已折叠 ${taskBranches.length - shown.length} 个分支（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="shown" :columns="columns" row-key="worktreeId" size="small" :pagination="undefined">
        <template #branch="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono oc-truncate">{{ row.branch }}</span>
            <Tag v-if="!row.mergedAt && row.status !== 'CLEANED'" theme="warning" size="small" variant="light-outline">未合并</Tag>
          </div>
        </template>
        <template #task="{ row }"><span class="oc-mono">{{ row.taskId }}</span></template>
        <template #role="{ row }">
          <Tag size="small" variant="light-outline">{{ row.baseRevision.split('@')[0] === 'main' ? '基线 main' : '基线分支' }}</Tag>
        </template>
        <template #merged="{ row }">
          <span v-if="row.mergedAt" class="oc-muted">{{ new Date(row.mergedAt).toLocaleString('zh-CN') }}</span>
          <Tag v-else theme="warning" size="small" variant="light-outline">待合并 / 待放弃</Tag>
        </template>
        <template #dirty="{ row }">
          <Tag :theme="row.dirty ? 'warning' : 'success'" size="small" variant="light-outline">{{ row.dirty ? '有未提交' : '干净' }}</Tag>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" theme="danger" @click="deleteTarget = row as GitWorktree">删除</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">分支策略</h3>
        <InfoGrid :columns="1" :items="[
          { key: 'protect', label: '保护分支', value: policy.protected.join('、'), mono: true },
          { key: 'rule', label: '保护规则', value: policy.protectedRule },
          { key: 'naming', label: '命名规范', value: policy.naming, mono: true },
          { key: 'stack', label: '栈式分支', value: stacked ? '已启用：按栈顺序合并（禁止跳栈），失败即退回栈顶' : '未启用（默认每任务一分支）' },
          { key: 'assoc', label: '任务关联', value: '分支与提交都携带任务尾注（Refs: task=…），用于追溯与合并队列聚合' },
        ]" />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">等价命令</h3>
        <CliHint command="oc git branch create --task T-7f3a --slug reconcile --base main" />
        <CliHint command="oc git branch delete --name oc/T-7f3a-reconcile --reason '<reason>'" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag size="small" variant="outline">删除分支持久化到 reflog + 自动临时引用 oc/backup/&lt;ts&gt;</Tag>
        </div>
      </div>
    </div>

    <Dialog :visible="!!deleteTarget" @visible-change="(v: boolean) => { if (!v) deleteTarget = null }" header="删除分支（危险操作）" width="620px" :confirm-btn="{ content: '确认删除', theme: 'danger' }" cancel-btn="取消" @confirm="confirmDelete">
      <div v-if="deleteTarget" class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <RiskBadge level="R4" show-desc />
          <Tag theme="danger" variant="light-outline" size="small">自动创建临时引用 oc/backup/&lt;ts&gt;</Tag>
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'branch', label: '分支', value: deleteTarget.branch, mono: true },
          { key: 'merged', label: '合并状态', value: deleteTarget.mergedAt ? '已合并（安全删除）' : '未合并 —— 存在丢失提交风险' },
          { key: 'lost', label: '丢失清单', value: deleteTarget.mergedAt ? '无（已合并）' : `${deleteTarget.taskId} 分支上的未合并提交（可从 oc/backup 引用恢复）` },
          { key: 'undo', label: '是否可撤销', value: '可撤销：oc git undo --ref <backupRef>（操作日志保留 30 天）' },
          { key: 'protect', label: '保护分支校验', value: `若分支在保护列表（${policy.protected.join('、')}）内，删除将被拒绝` },
        ]" />
        <Input v-model="reason" size="small" placeholder="删除理由（未合并分支必填，写入审计）" />
        <CliHint :command="`oc git branch delete --name ${deleteTarget.branch} --reason '<reason>'`" />
      </div>
    </Dialog>
  </div>
</template>
