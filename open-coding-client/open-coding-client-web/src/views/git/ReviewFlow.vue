<script setup lang="ts">
/**
 * I-12 审查流。
 * 三层审查（Agent 自审 / 团队审查 / 人类审查）+ 评论闭环（未处理评论计数）+ 意见回流为任务修订项；
 * 人类审查未通过时不允许合并（verdict 驱动队列状态）。
 * 溯源：卷 21 D-GIT-12；BUILD-MANIFEST I-12。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { GitReview } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const layerFilter = ref('');
const active = ref<GitReview>(platformData.git.reviews[2]);
const reflowed = ref<string[]>(platformData.git.reviews.filter((r) => r.reflowedTaskId).map((r) => r.id));

const reviews = computed(() => platformData.git.reviews);
const rows = computed(() => (layerFilter.value ? reviews.value.filter((r) => r.layer === layerFilter.value) : reviews.value));
const openComments = computed(() => reviews.value.reduce((a, r) => a + r.comments.length, 0));
const changesRequested = computed(() => reviews.value.filter((r) => r.verdict === 'CHANGES_REQUESTED').length);

const columns = [
  { colKey: 'layer', title: '审查层', width: 130, cell: 'layer' },
  { colKey: 'reviewerRole', title: '审查者', width: 260, cell: 'role' },
  { colKey: 'verdict', title: '结论', width: 180, cell: 'verdict' },
  { colKey: 'comments', title: '意见', width: 110, cell: 'cmt' },
  { colKey: 'reflowedTaskId', title: '回流为任务', width: 180, cell: 'reflow' },
  { colKey: 'at', title: '时间', width: 180, cell: 'at' },
  { colKey: 'op', title: '操作', width: 130, cell: 'op' },
];

const VERDICT_THEME: Record<string, 'success' | 'danger' | 'warning' | 'default'> = { APPROVED: 'success', CHANGES_REQUESTED: 'danger', PENDING: 'warning', REJECTED: 'danger' };

function reflow(review: GitReview) {
  reflowed.value = [...reflowed.value, review.id];
  MessagePlugin.success(`意见已回流为任务修订项：${review.reflowedTaskId ?? 'T-7f3a'}（关联 ${review.comments.length} 条评论；任务卡上会显示未处理评论计数）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = reviews.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="审查流"
      desc="三层审查：Agent 自审（对照验收标准与 diff）→ 团队审查（审查者角色）→ 人类审查（PR/MR + 评论闭环）；意见可回流为任务修订项，未处理意见阻止合并。"
      volume="卷 21" manifest="I-12" cli="oc git review list --show-comments && oc git review reflow --id rv-03"
      :status="[{ label: `${reviews.length} 条审查`, theme: 'default' }, { label: `${changesRequested} 条待修改`, theme: changesRequested ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 170px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'PERMISSION_DENIED', label: '无权限' },
        ]" />
        <Select v-model="layerFilter" size="small" style="width: 160px" clearable placeholder="审查层" aria-label="审查层">
          <Option value="" label="全部层" />
          <Option value="自审" label="自审" />
          <Option value="团队审查" label="团队审查" />
          <Option value="人类审查" label="人类审查" />
        </Select>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="审查记录" :value="reviews.length" icon="git" hint="三层审查独立留痕，不互相替代" />
      <StatCard label="待修改" :value="changesRequested" icon="edit" hint="CHANGES_REQUESTED 阻止合并" />
      <StatCard label="意见总数" :value="openComments" icon="chat-bubble" hint="评论闭环：每条意见可回流为任务" />
      <StatCard label="已回流" :value="reflowed.length" icon="task" hint="回流后任务卡显示未处理评论" />
    </div>

    <StateShell
      :state="demo" stage="正在聚合三层审查与评论…"
      empty-title="没有审查记录" empty-desc="该分支尚未进入审查流；任务边界提交后自审会自动生成，团队/人类审查需发起 PR/MR。"
      empty-action="发起人类审查（创建 PR/MR）" example-task="把人类审查的两条意见回流为任务修订项并复验"
      what="审查记录读取失败" why="平台 API 限流（GitHub 403 rate limit），评论与状态无法刷新"
      how="可重试（自动退避）；已缓存的审查结论仍可查看，合并仍受最后一次结论约束" trace-id="trace-dbb1f2dd"
      missing-permission="git.review.read" risk-level="R2" apply-path="在「权限与审批 → 申请授权」提交审查读取权限"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @apply="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #layer="{ row }">
          <Tag :theme="row.layer === '自审' ? 'default' : row.layer === '团队审查' ? 'primary' : 'warning'" size="small" variant="light-outline">{{ row.layer }}</Tag>
        </template>
        <template #role="{ row }"><span class="oc-truncate">{{ row.reviewerRole }}</span></template>
        <template #verdict="{ row }">
          <Tag :theme="VERDICT_THEME[row.verdict] ?? 'default'" size="small" variant="light-outline">{{ row.verdict }}</Tag>
        </template>
        <template #cmt="{ row }">{{ row.comments.length }} 条</template>
        <template #reflow="{ row }">
          <span v-if="row.reflowedTaskId" class="oc-mono">{{ row.reflowedTaskId }}</span>
          <span v-else class="oc-muted">未回流</span>
        </template>
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="active = row as GitReview">查看</Button>
          <Button size="small" variant="text" :disabled="!row.comments.length || reflowed.includes(row.id)" @click="reflow(row as GitReview)">回流</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          审查详情：{{ active.reviewerRole }}
          <Tag :theme="VERDICT_THEME[active.verdict] ?? 'default'" size="small" variant="light-outline">{{ active.verdict }}</Tag>
        </h3>
        <Table
          :data="active.comments" size="small" :pagination="undefined" row-key="file"
          :columns="[{ colKey: 'file', title: '文件', width: 250, cell: 'file' }, { colKey: 'line', title: '行', width: 80 }, { colKey: 'text', title: '意见', ellipsis: true }, { colKey: 'severity', title: '等级', width: 100, cell: 'sev' }]"
        >
          <template #file="{ row }"><span class="oc-mono oc-truncate">{{ row.file }}</span></template>
          <template #sev="{ row }">
            <Tag :theme="row.severity === 'major' ? 'danger' : row.severity === 'minor' ? 'warning' : 'default'" size="small" variant="light-outline">{{ row.severity }}</Tag>
          </template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag v-if="active.verdict === 'CHANGES_REQUESTED'" theme="danger" variant="light-outline" size="small">结论为待修改：合并队列中的该分支保持 conflict/退回状态</Tag>
          <CliHint :command="`oc git review reflow --id ${active.id} --to-task ${active.reflowedTaskId ?? 'T-7f3a'}`" />
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">三层审查职责与闭环规则</h3>
        <InfoGrid :columns="1" :items="[
          { key: 'l1', label: '① Agent 自审', value: '对照验收标准与 diff 自查（缺用例、缺注释、越权改动）' },
          { key: 'l2', label: '② 团队审查', value: '团队审查者角色复核（可并行，多人结论取最严）' },
          { key: 'l3', label: '③ 人类审查', value: 'PR/MR 评论与最终结论；未通过不允许合并' },
          { key: 'closure', label: '评论闭环', value: '每条意见标注严重度与状态；「已处理」需引用修复提交或复验证据' },
          { key: 'reflow', label: '意见回流', value: '意见可回流为任务修订项（生成子任务并关联原 review 与评论）' },
          { key: 'audit', label: '审计', value: '审查结论与回流动作进入事件流（git.merge.* / workitem.state.changed）' },
        ]" />
      </div>
    </div>
  </div>
</template>
