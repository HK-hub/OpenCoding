<script setup lang="ts">
/**
 * I-04 提交记录与追溯。
 * 提交消息为 Conventional Commits + 结构化尾注（会话/任务/团队/模型/角色/审批）；
 * 尾注让每个提交可归因到产生它的会话与 Agent，署名遵循用户 Git 配置。
 * 溯源：卷 21 D-GIT-3/D-GIT-11/§4.2；BUILD-MANIFEST I-04。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, Input, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { GitCommit } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const typeFilter = ref('');
const keyword = ref('');
const detail = ref<GitCommit | null>(null);

const commits = computed(() => platformData.git.commits);
const rows = computed(() =>
  commits.value.filter((c) => {
    if (typeFilter.value && c.type !== typeFilter.value) return false;
    if (keyword.value && !`${c.hash} ${c.scope} ${c.subject}`.toLowerCase().includes(keyword.value.toLowerCase())) return false;
    return true;
  }),
);
const limit = ref(20);
const shown = computed(() => rows.value.slice(0, limit.value));
const edge = computed(() => rows.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));
const trailersComplete = computed(() => commits.value.filter((c) => c.trailers.task && c.trailers.session).length);

const TYPE_THEME: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  feat: 'primary', fix: 'success', refactor: 'default', perf: 'warning', test: 'default', docs: 'default', chore: 'default', build: 'warning', ci: 'default',
};

const columns = [
  { colKey: 'hash', title: '提交', width: 110, cell: 'hash' },
  { colKey: 'type', title: '类型', width: 90, cell: 'type' },
  { colKey: 'scope', title: '范围', width: 110 },
  { colKey: 'subject', title: '描述', ellipsis: true, cell: 'subject' },
  { colKey: 'trailers', title: '尾注', width: 300, cell: 'trailers' },
  { colKey: 'filesChanged', title: '文件', width: 80 },
  { colKey: 'at', title: '时间', width: 170, cell: 'at' },
  { colKey: 'op', title: '操作', width: 88, cell: 'op' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = commits.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="提交记录与追溯"
      desc="任务边界提交 + 规范消息 + 结构化尾注：每个提交可归因到会话、任务、团队、模型、Agent 角色与审批引用；企业可要求尾注强制。"
      volume="卷 21" manifest="I-04" cli="oc git log --with-trailers --show-approval"
      :status="[{ label: `${commits.length} 个提交`, theme: 'default' }, { label: `尾注完整 ${trailersComplete}`, theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="typeFilter" size="small" style="width: 130px" clearable placeholder="提交类型" aria-label="类型">
          <Option value="" label="全部类型" />
          <Option v-for="t in ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore', 'build', 'ci']" :key="t" :value="t" :label="t" />
        </Select>
        <Input v-model="keyword" size="small" style="width: 200px" placeholder="按哈希/范围/描述检索" clearable />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="提交总数" :value="commits.length" icon="git" hint="任务边界提交（非每步自动提交）" />
      <StatCard label="含 Agent 署名" :value="commits.filter((c) => c.coAuthoredBy !== '—').length" icon="robot" hint="Co-authored-by 可选，客户可关" />
      <StatCard label="携带审批引用" :value="commits.filter((c) => c.trailers.approval !== '—').length" icon="secured" hint="高风险动作必须带审批引用" />
      <StatCard label="涉及文件" :value="commits.reduce((a, c) => a + c.filesChanged, 0)" icon="file" hint="大改动走栈式分支评审" />
    </div>

    <StateShell
      :state="state" stage="正在读取提交历史与尾注…"
      empty-title="没有提交记录" empty-desc="该仓库尚无提交，或过滤条件排除了全部记录（可按类型清除过滤）。"
      empty-action="清除过滤" example-task="按审批引用 ar-4f21 追溯触发该提交的审批卡"
      what="提交历史读取失败" why="git log --trailers 超时（部分克隆下尾注需按需拉取 blob）"
      how="可重试；已加载的页面可继续查看（分页游标保留）" trace-id="trace-c33d44bb"
      :collapsed-summary="`已折叠 ${rows.length - shown.length} 个提交（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="typeFilter = ''; keyword = ''"
    >
      <Table :data="shown" :columns="columns" row-key="hash" size="small" :pagination="undefined">
        <template #hash="{ row }">
          <Button size="small" variant="text" @click="detail = row as GitCommit"><span class="oc-mono">{{ row.hash }}</span></Button>
        </template>
        <template #type="{ row }">
          <Tag :theme="TYPE_THEME[row.type] ?? 'default'" size="small" variant="light-outline">{{ row.type }}</Tag>
        </template>
        <template #subject="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-truncate">{{ row.subject }}</span>
            <Tag v-if="row.trailers.approval !== '—'" theme="warning" size="small" variant="light-outline">审批 {{ row.trailers.approval }}</Tag>
          </div>
        </template>
        <template #trailers="{ row }">
          <span class="oc-mono oc-truncate" style="font-size: 11px">
            task={{ row.trailers.task }} · session={{ row.trailers.session }} · team={{ row.trailers.team }} · {{ row.trailers.agent.role }}/{{ row.trailers.agent.model }}
          </span>
        </template>
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="detail = row as GitCommit">详情</Button>
        </template>
      </Table>
    </StateShell>

    <Drawer :visible="!!detail" @visible-change="(v: boolean) => { if (!v) detail = null }" :header="detail ? `提交 ${detail.hash}` : ''" size="640px" :footer="false">
      <div v-if="detail" class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'subject', label: '消息（首行）', value: `${detail.type}(${detail.scope}): ${detail.subject}` },
          { key: 'body', label: '正文（为什么/影响面/如何验证）', value: detail.body, block: true },
          { key: 'task', label: 'Refs: task', value: detail.trailers.task, mono: true },
          { key: 'session', label: 'Refs: session', value: detail.trailers.session, mono: true },
          { key: 'team', label: 'Refs: team', value: detail.trailers.team, mono: true },
          { key: 'agent', label: 'Agent: role / model', value: `${detail.trailers.agent.role} / ${detail.trailers.agent.model}`, mono: true },
          { key: 'approval', label: 'Approval', value: detail.trailers.approval === '—' ? '无（未涉及高风险动作）' : detail.trailers.approval },
          { key: 'files', label: '文件变更', value: `${detail.filesChanged} 个文件（+${detail.additions} / -${detail.deletions}）` },
          { key: 'co', label: '署名', value: detail.coAuthoredBy === '—' ? '仅用户 Git 配置署名' : `Co-authored-by: ${detail.coAuthoredBy}` },
        ]" />
        <JsonBlock :mask="false" label="结构化尾注原文" :value="{
          Refs: `task=${detail.trailers.task} session=${detail.trailers.session} team=${detail.trailers.team}`,
          Agent: `role=${detail.trailers.agent.role} model=${detail.trailers.agent.model}`,
          Approval: detail.trailers.approval,
        }" />
        <CliHint :command="`oc git show ${detail.hash} --with-trailers`" />
      </div>
    </Drawer>
  </div>
</template>
