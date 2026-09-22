<script setup lang="ts">
/**
 * 达成判定（X-04）：逐条验收结论 + 证据清单 → 确认 / 驳回；演示「假完成被拦截」（自评完成但证据不足）。
 * 溯源：卷 15 §4.3 达成判定流程（证据优先 + 人工确认；假完成用例必须被拦截）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { GoalCriterion } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref('G-3a88');
const rejectOpen = ref(false);
const rejectReason = ref('第 4 条验收标准缺少 L3 语义证据；另外对拍批次 5-6 尚未执行。');
const rejection = ref<{ missing: string[]; traceId: string; selfClaim: string } | null>(null);

const goal = computed(() => taskData.goals.find((g) => g.shortId === selected.value) ?? taskData.goals[0]);

/** Agent 自评结论（不等同于达成判定：自评仅作为输入） */
const selfClaim = computed(() => ({
  claimedAt: goal.value.lastTickAt,
  isClaimed: goal.value.progressRatio >= 0.9 || goal.value.status === 'achieved',
  claimer: 'Agent（主管）',
}));

const verdictRows = computed(() => goal.value.acceptanceCriteria.map((c) => ({
  ...c,
  evidenceCount: c.evidenceRefs.length,
  selfVerdict: c.verdict === 'pass' ? '自评：已满足' : c.verdict === 'pending' ? '自评：待验证' : c.verdict === 'unverifiable' ? '自评：无法验证' : '自评：未满足',
})));

const stats = computed(() => ({
  total: goal.value.acceptanceCriteria.length,
  withEvidence: goal.value.acceptanceCriteria.filter((c) => c.evidenceRefs.length > 0).length,
  unverifiable: goal.value.acceptanceCriteria.filter((c) => c.verdict === 'unverifiable').length,
  budgetPct: Math.round((goal.value.costTotal / Math.max(0.01, goal.value.budget.cost)) * 100),
}));

const columns = [
  { colKey: 'text', title: '验收标准' },
  { colKey: 'verifyMethod', title: '验证方式', width: 260 },
  { colKey: 'selfVerdict', title: '自评', width: 130 },
  { colKey: 'evidenceCount', title: '证据', width: 90 },
];

function confirmAchieved() {
  const missing: string[] = [];
  goal.value.acceptanceCriteria.forEach((c: GoalCriterion) => {
    if (c.verdict !== 'pass') missing.push(`${c.text}（结论：${c.verdict === 'unverifiable' ? '无法验证' : c.verdict === 'fail' ? '未满足' : '待验证'}）`);
    else if (c.evidenceRefs.length === 0) missing.push(`${c.text}（结论为通过但无证据引用）`);
  });
  if (missing.length) {
    rejection.value = { missing, traceId: 'trace-44c1e0a9', selfClaim: 'Agent 汇报「目标已达成（含 1 项无法验证条目）」，申请人工确认。' };
    MessagePlugin.error(`假完成被拦截：${missing.length} 条验收标准证据不足，达成判定不成立`);
    return;
  }
  goal.value.status = 'achieved';
  MessagePlugin.success('达成判定通过：目标标记为已达成，生成结束汇报（证据清单 + 成本账 + 未决项）');
}

function reject() {
  if (!rejectReason.value.trim()) {
    MessagePlugin.error('驳回理由必填：驳回必须给出可执行的返工依据');
    return;
  }
  goal.value.status = 'started';
  rejectOpen.value = false;
  MessagePlugin.warning('已驳回：目标回到进行中，驳回理由回流为返工任务（含验收标准编号）');
}

onMounted(() => {
  window.setTimeout(() => { state.value = goal.value ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="达成判定" volume="卷 15" manifest="X-04" cli="oc goal achieve G-3a88 --require-evidence"
      desc="以证据为主的达成判定：逐条验收标准给出结论 + 证据清单；全部满足才可标记「已达成（待确认）」；自评完成但证据不足将被拦截。"
      :status="[{ label: '证据优先', theme: 'primary' }, { label: '低风险目标可自动确认', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="rejectOpen = true">驳回</Button>
        <Popconfirm content="确认后目标进入「已达成」并生成结束汇报；若存在证据不足条目，系统会拒绝确认（不允许带病通过）。" theme="warning" @confirm="confirmAchieved">
          <Button size="small" theme="primary">确认达成</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">目标：</span>
        <Select v-model="selected" size="small" style="width: 380px" :options="taskData.goals.map((g) => ({ label: `${g.shortId} ${g.objective.slice(0, 20)}…`, value: g.shortId }))" />
        <Tag size="small" variant="outline">自评状态：{{ selfClaim.isClaimed ? 'Agent 汇报已达成' : '仍在推进' }}</Tag>
        <Tag size="small" variant="outline">{{ new Date(selfClaim.claimedAt).toLocaleString('zh-CN') }}</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="验收条目" :value="stats.total" unit="条" icon="check" />
      <StatCard label="有证据条目" :value="stats.withEvidence" unit="条" icon="file" :target="stats.total" target-kind="min" />
      <StatCard label="无法验证" :value="stats.unverifiable" unit="条" icon="help" :lower-is-better="true" />
      <StatCard label="预算水位" :value="stats.budgetPct" unit="%" icon="discount" :target="90" target-kind="max" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有待判定的目标" empty-desc="当前没有处于「已达成（待确认）」的目标。" empty-action="返回目标列表"
      example-task="对 G-4c19（依赖升级）做达成判定"
      what="达成判定加载失败" why="验收标准与证据引用不一致（1 条引用指向已清理的证据）"
      how="可重试；系统会重新解析证据引用并在报告中标注缺口" trace-id="trace-44c1e0a9"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已返回目标列表')"
    >
      <div class="oc-stack">
        <!-- 假完成拦截演示 -->
        <div v-if="rejection" class="oc-card" style="border-color: var(--oc-sev-error)">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
            <b>假完成被拦截</b>
            <Tag size="small" theme="danger" variant="light-outline">self-report ≠ evidence</Tag>
          </div>
          <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
            事实：{{ rejection.selfClaim }} 原因：模型自评不能作为达成依据，{{ rejection.missing.length }} 条验收标准缺少可检验证据。动作：补齐证据后重新提交判定。
          </div>
          <div v-for="m in rejection.missing" :key="m" class="oc-flex" style="gap: 6px; font-size: 12px; margin-top: 4px">
            <OcIcon name="close" size="12px" color="var(--oc-sev-error)" /> {{ m }}
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CopyableId :id="rejection.traceId" label="复制 traceId" />
            <CliHint command="oc goal achieve G-3a88 --require-evidence --explain" />
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">逐条验收结论（人工判定，不允许一键通过）</div>
          <Table :data="verdictRows" row-key="id" size="small" :pagination="undefined" :columns="columns">
            <template #selfVerdict="{ row }">
              <Tag size="small" :theme="row.verdict === 'pass' ? 'success' : row.verdict === 'unverifiable' ? 'warning' : 'default'" variant="light-outline">{{ row.selfVerdict }}</Tag>
            </template>
            <template #evidenceCount="{ row }">
              <Tag size="small" :theme="row.evidenceCount ? 'success' : 'danger'" variant="light-outline">{{ row.evidenceCount }} 条</Tag>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">证据清单</div>
          <div v-for="c in goal.acceptanceCriteria" :key="c.id" style="margin-bottom: 6px">
            <div class="oc-flex" style="gap: 6px">
              <OcIcon name="link" size="12px" />
              <span style="font-size: 12px">{{ c.id }} · {{ c.text }}</span>
            </div>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-left: 18px">
              <Tag v-for="e in c.evidenceRefs" :key="e" size="small" variant="outline" class="oc-mono">{{ e }}</Tag>
              <Tag v-if="!c.evidenceRefs.length" size="small" theme="danger" variant="light-outline">无证据引用：不可确认</Tag>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">自动确认策略（无人值守场景）</div>
          <div class="oc-secondary" style="font-size: 12px">
            仅当三者同时满足才允许自动确认：① 低风险目标（无生产写入/外发）② 全部验收条目均有证据 ③ 预算未逼近上限（水位 &lt; 80%）。
            当前目标：风险=中、水位={{ stats.budgetPct }}% → <b>不满足自动确认条件，必须人工确认</b>。
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 6px">
            <RiskBadge level="R2" />
            <RiskBadge level="R3" />
            <span class="oc-muted" style="font-size: 12px">含 R3 外发动作的目标永不自动确认。</span>
          </div>
        </div>
      </div>

      <Dialog v-model:visible="rejectOpen" header="驳回达成判定" width="520px" :footer="false">
        <div class="oc-stack">
          <div class="oc-muted" style="font-size: 12px">驳回理由（必填，将回流为返工任务的验收依据）</div>
          <Textarea v-model="rejectReason" :autosize="{ minRows: 3 }" />
          <div class="oc-flex" style="gap: 8px">
            <Button size="small" theme="danger" @click="reject">确认驳回</Button>
            <Button size="small" variant="outline" @click="rejectOpen = false">取消</Button>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
