<script setup lang="ts">
/**
 * E-08 组织记忆治理：提案-评审-发布 + 版本回滚 + 过期复审。
 * 组织记忆影响面大：必须署名、给理由与影响范围，经评审后版本化发布，且可回滚（卷 10 D-MEM-8）。
 * 溯源：卷 10 D-MEM-8 / BUILD-MANIFEST E-08
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Popconfirm, Select, StepItem, Steps, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import type { OrgMemoryGovernance } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.memory;

const state = ref<UiStateKind>('LOADING');
const stateFilter = ref('all');
const activeId = ref(data.orgGovernance[0].governanceId);
const diffOpen = ref(false);
const active = computed<OrgMemoryGovernance>(() => data.orgGovernance.find((g) => g.governanceId === activeId.value) ?? data.orgGovernance[0]);

const rows = computed(() => data.orgGovernance.filter((g) => stateFilter.value === 'all' || g.state === stateFilter.value));
const published = computed(() => data.orgGovernance.filter((g) => g.state === '已发布').length);

/** 发布定版：流程四段，任一段未完成不得发布 */
const steps = ['提案（署名 + 理由 + 影响范围）', '策略过滤（敏感/重复/冲突）', '评审（评审人不得为提案人）', '发布（版本化 + 生效）'];
const currentStep = computed(() => (active.value.state === '评审中' ? 1 : active.value.state === '已驳回' ? 2 : 4));

const versionDiff = computed<DiffFile[]>(() => [
  {
    path: `${active.value.version}（回滚对比）`,
    additions: 1,
    deletions: 2,
    lines: [
      { type: 'ctx', oldLine: 1, newLine: 1, text: '# 组织策略' },
      { type: 'del', oldLine: 2, text: 'v2｜凭证只存引用，明文仅存密钥代理内存' },
      { type: 'del', oldLine: 3, text: 'v2｜日志输出不做统一处理' },
      { type: 'add', newLine: 2, text: 'v3｜凭证引用 + 短期令牌注入；日志/导出/遥测强制脱敏' },
      { type: 'ctx', oldLine: 4, newLine: 3, text: '# 回滚说明：v3 例外范围过宽，回滚至 v2 并保留审计' },
    ],
  },
]);

const REVIEW_REMINDERS = [
  { id: 'mem-o-01', label: 'policy:release-dual-review', due: '2027-01-15', owner: '组织管理员', left: '剩余 108 天' },
  { id: 'mem-o-02', label: 'policy:model-call-audit', due: '2026-12-10', owner: '合规负责人', left: '剩余 72 天' },
  { id: 'mem-o-05', label: 'policy:secret-handling', due: '2026-12-10', owner: '安全负责人', left: '剩余 72 天' },
  { id: 'mem-o-06', label: 'policy:data-residency', due: '2026-12-28', owner: '合规负责人', left: '剩余 90 天' },
];

/** 复审请求（ref）：governanceId → 请求时间；用于提案行标注与复审队列计数 */
const reviewRequests = ref<Record<string, string>>({});

/** 复审队列 = 内置过期提醒 + 本次请求复审新入队的条目 */
const reminders = computed(() => [
  ...REVIEW_REMINDERS,
  ...Object.entries(reviewRequests.value).map(([id, at]) => ({
    id,
    label: `复审请求：${id}`,
    due: '待排期（已入队）',
    owner: '组织管理员',
    left: `已请求 ${new Date(at).toLocaleString('zh-CN')}`,
  })),
]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '权限受限', value: 'PERMISSION_DENIED' },
];

function stateTheme(s: string) {
  return s === '已发布' ? 'success' : s === '评审中' ? 'warning' : s === '已回滚' ? 'primary' : 'default';
}

function rollback() {
  MessagePlugin.success(`已回滚 ${active.value.governanceId}：保留回滚记录，受影响条目重新进入评审队列`);
}

/** 请求复审：把该提案加入复审队列并打时间戳（不直接改变发布状态，由组织管理员排期） */
function requestReview() {
  const govId = active.value.governanceId;
  const requestedAt = reviewRequests.value[govId];
  if (requestedAt) {
    MessagePlugin.info(`「${govId}」已在复审队列中（请求于 ${new Date(requestedAt).toLocaleString('zh-CN')}），无需重复请求`);
    return;
  }
  reviewRequests.value = { ...reviewRequests.value, [govId]: new Date().toISOString() };
  MessagePlugin.success(`已标记复审请求：${govId} 已加入复审队列并通知提案人与评审人`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="组织记忆治理"
      desc="组织记忆不是「随手记」：提案-评审-发布全流程留痕，版本可回滚，过期自动提示复审。"
      volume="卷 10"
      manifest="E-08"
      cli="oc memory org propose --file policy.yaml"
      :status="[{ label: `${published} 项已发布`, theme: 'success' }, { label: '提案须署名', theme: 'primary' }]"
    >
      <template #actions>
        <Select v-model="stateFilter" size="small" style="width: 140px" :options="[{ label: '全部状态', value: 'all' }, { label: '评审中', value: '评审中' }, { label: '已发布', value: '已发布' }, { label: '已驳回', value: '已驳回' }, { label: '已回滚', value: '已回滚' }]" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="治理提案" :value="data.orgGovernance.length" unit="项" icon="secured" hint="组织层专属：需评审后发布" />
      <StatCard label="已发布" :value="published" unit="项" icon="check" hint="发布即版本化，全部可回滚" />
      <StatCard label="待复审" :value="reminders.length" unit="项" icon="time" hint="过期复审提醒；逾期未复审将降权" />
      <StatCard label="已回滚" :value="data.orgGovernance.filter((g) => g.state === '已回滚').length" unit="项" icon="history" hint="回滚记录不可删除（审计要求）" />
    </div>

    <StateShell
      :state="state"
      stage="加载治理提案…"
      empty-title="暂无组织记忆提案"
      empty-desc="组织记忆由成员提案、评审人评审后发布；可在提案中附理由与影响范围评估。"
      empty-action="发起提案"
      example-task="提案「外部嵌入服务需登记白名单」并附影响面评估"
      what="治理提案加载失败"
      why="组织记忆库不可达（跨租户读被拒绝或服务不可用）。"
      how="可重试；缺失权限时请申请「记忆治理只读」后再查看。"
      trace-id="trace-gov-72ba10"
      missing-permission="memory.org.govern"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」提交组织记忆治理权限申请（需评审人背书）"
      @retry="state = 'NORMAL'"
      @apply="MessagePlugin.info('已跳转申请路径：需要组织管理员角色背书')"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">发布流程（以「{{ active.governanceId }}」为例）</h3>
        <Steps :current="currentStep" layout="horizontal" size="small">
          <StepItem v-for="(s, i) in steps" :key="s" :title="`${i + 1}. ${s}`" />
        </Steps>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
          当前状态：<b>{{ active.state }}</b> · 版本 {{ active.version }} · 评审人 {{ active.reviewer }}
          （评审人不得为提案人；已发布版本可由组织管理员回滚到上一版本）。
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">提案与版本</h3>
          <Table
            :data="rows"
            :columns="[
              { colKey: 'governanceId', title: '提案', width: 88 },
              { colKey: 'proposal', title: '内容', cell: 'cell' },
              { colKey: 'version', title: '版本', width: 130, cell: 'cell' },
              { colKey: 'state', title: '状态', width: 96, cell: 'cell' },
            ]"
            row-key="governanceId"
            size="small"
            @row-click="(ctx) => (activeId = String(ctx.row.governanceId))"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'proposal'">
                <span class="oc-clamp-2" style="display: block; max-width: 320px">{{ row.proposal }}</span>
              </template>
              <template v-else-if="col.colKey === 'version'"><span class="oc-mono">{{ row.version }}</span></template>
              <template v-else-if="col.colKey === 'state'">
                <div class="oc-stack" style="gap: 2px">
                  <Tag size="small" :theme="stateTheme(row.state)" variant="light-outline">{{ row.state }}</Tag>
                  <Tag v-if="reviewRequests[row.governanceId]" size="small" theme="warning" variant="light-outline">已请求复审</Tag>
                </div>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            评审详情
            <span class="oc-flex" style="gap: 6px">
              <Tag size="small" :theme="stateTheme(active.state)" variant="light-outline">{{ active.state }}</Tag>
              <Tag v-if="reviewRequests[active.governanceId]" size="small" theme="warning" variant="light-outline">
                已请求复审 {{ new Date(reviewRequests[active.governanceId]).toLocaleString('zh-CN') }}
              </Tag>
              <Button size="small" variant="text" @click="diffOpen = true">版本对比</Button>
            </span>
          </h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'proposal', label: '提案内容', value: active.proposal },
              { key: 'reviewer', label: '评审人', value: active.reviewer },
              { key: 'rationale', label: '理由', value: active.rationale, block: true },
              { key: 'impact', label: '影响范围', value: active.impact },
              { key: 'version', label: '版本', value: active.version },
              { key: 'at', label: '最近变更', value: new Date(active.at).toLocaleString('zh-CN') },
            ]"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
            <template v-if="active.state === '已发布'">
              <Popconfirm theme="danger" content="回滚会把组织记忆退到上一版本；受影响条目重新进入评审队列，且回滚记录不可删除。" @confirm="rollback">
                <Button theme="danger" variant="outline"><OcIcon name="history" size="12px" /> 回滚到上一版本</Button>
              </Popconfirm>
              <Button variant="outline" @click="requestReview">请求复审</Button>
            </template>
            <template v-else-if="active.state === '评审中'">
              <Popconfirm content="评审通过后发布并在全组织生效（版本 +1）。" @confirm="MessagePlugin.success('已发布：版本 +1，事件 memory.org.published 留痕')">
                <Button theme="primary">评审通过并发布</Button>
              </Popconfirm>
              <Popconfirm theme="warning" content="驳回需填写理由（已预填：影响面评估不足）。" @confirm="MessagePlugin.warning('已驳回：理由已留痕')">
                <Button variant="outline">驳回</Button>
              </Popconfirm>
            </template>
            <template v-else>
              <Tag size="small" variant="light-outline">{{ active.state }}（无可用动作）</Tag>
            </template>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          过期复审提醒
          <span class="oc-muted" style="font-size: 12px">组织记忆默认纳入定期复审；逾期未复审将降权并在召回中标注</span>
        </h3>
        <Table
          :data="reminders"
          :columns="[
            { colKey: 'id', title: '条目', width: 110 },
            { colKey: 'label', title: 'Key', width: 260 },
            { colKey: 'due', title: '复审截止', width: 130 },
            { colKey: 'owner', title: '责任人', width: 140 },
            { colKey: 'left', title: '剩余', width: 110, cell: 'cell' },
          ]"
          row-key="id"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'left'">
              <Tag size="small" :theme="row.left.includes('72') ? 'warning' : 'default'" variant="light-outline">{{ row.left }}</Tag>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <Dialog v-model:visible="diffOpen" header="版本对比（当前版本 vs 回滚目标）" :width="720" :footer="false">
        <DiffView :files="versionDiff" :collapse-over="30" />
      </Dialog>
    </StateShell>
  </div>
</template>
