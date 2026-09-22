<script setup lang="ts">
/**
 * 自进化实验室（U-04）：失败学习 → 技能草稿队列 + 草稿评审（可编辑指令 / 可运行评测用例）+ 季度产出计数。
 * 溯源：卷 25 §9 受控自进化（B2）；BUILD-MANIFEST U-04。
 * 契约：禁止自动发布（代码层不可达）；草稿必须人工评审后才可发布；季度目标 ≥ 20 条有效改进。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { frontierData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 队列状态四态：草稿 / 评审中 / 已发布 / 已驳回（由数据状态确定性映射） */
type DraftState = '草稿' | '评审中' | '已发布' | '已驳回';
interface DraftRow { id: string; kind: string; session: string; reason: string; name: string; state: DraftState; reviewer?: string; checklist: string[] }

/** 失败原因（每草稿对应真实失败轨迹，负样本含被驳回草稿） */
const REASONS = [
  'Gradle 依赖冲突反复手工定位（4 次失败轨迹）', '受保护段落被重生成覆盖（6 次冲突轨迹）',
  '低置信结论触发自动修复被拒（策略违规）', '模板权限越界未在装载期拦截（含 1 条失败用例）',
  '假测试（恒真断言）被拒收 3 次', '「未覆盖项」段缺失，输出被门禁拦截',
];
const rows = ref<DraftRow[]>(frontierData.evolutionDrafts.map((d, i): DraftRow => ({
  id: d.id, kind: d.kind, session: d.fromRun, reason: REASONS[i % REASONS.length], name: d.summary,
  state: d.status === '已采纳' ? '已发布' : d.status === '已驳回' ? '已驳回' : i % 2 === 0 ? '草稿' : '评审中',
  reviewer: d.reviewedBy, checklist: d.checklist,
})));
const STATE_THEME: Record<DraftState, 'default' | 'primary' | 'success' | 'danger'> = { 草稿: 'default', 评审中: 'primary', 已发布: 'success', 已驳回: 'danger' };
const releasedThisQuarter = computed(() => rows.value.filter((r) => r.state === '已发布').length);
const QUARTER_TARGET = 20;

/** 禁止自动发布策略：卡片与说明弹层共用同一份，避免文案漂移 */
const AUTO_PUBLISH_POLICY = [
  { key: 'rule', label: '规则', value: '任何草稿（技能 / 评测用例 / 提示词建议）只能人工评审后发布，无自动发布通道' },
  { key: 'why', label: '原因', value: '草稿质量参差；自动发布不可控（可能引入越权、假测试、错误提示词）' },
  { key: 'reject', label: '驳回去向', value: '样本回流失败学习库，并在下轮草稿生成时作为反例' },
  { key: 'exit', label: '退出条件', value: '连续 2 个季度有效改进 < 8 条 → 退出并保留人工提炼通道' },
];
/** 说明弹层：点击「禁止自动发布说明」就地展开策略详情（不以提示代替内容） */
const policyOpen = ref(false);
function openAutoPublishPolicy() {
  policyOpen.value = true;
  MessagePlugin.info('已打开「禁止自动发布」说明：硬性规则 / 原因 / 驳回去向 / 退出条件');
}

const open = ref(false); const current = ref<DraftRow | null>(null);
const instruction = ref(''); const evalResult = ref('');
const columns = [
  { colKey: 'session', title: '来源会话', width: 210 }, { colKey: 'reason', title: '失败原因', width: 280, ellipsis: true },
  { colKey: 'name', title: '草稿技能名', ellipsis: true }, { colKey: 'kind', title: '类型', width: 96 },
  { colKey: 'state', title: '状态', width: 100, cell: 'state' }, { colKey: 'op', title: '操作', width: 96, cell: 'op' },
];

function review(row: DraftRow) {
  current.value = row;
  instruction.value = `${row.name}；先读取上下文证据，再执行动作；不得修改受保护内容。`;
  evalResult.value = '';
  open.value = true;
}
/** 运行评测用例：先回归后发布（未过回归不得发布） */
function runEval() {
  if (!current.value) return;
  if (current.value.state === '已驳回') {
    evalResult.value = '评测未通过：该草稿存在策略违规用例（低置信自动修复），不满足发布门禁 → 保持已驳回。';
    return;
  }
  evalResult.value = '评测通过：4/4 用例通过（含 1 条负样本「越界拒绝」）；回归集命中 2 条历史失败轨迹。';
}
function decide(pass: boolean) {
  if (!current.value) return;
  const r = current.value;
  if (pass && !evalResult.value.startsWith('评测通过')) {
    MessagePlugin.warning('发布门禁：必须先运行评测且全部通过（未过回归不得发布），当前未取得通过结论。');
    return;
  }
  r.state = pass ? '已发布' : '已驳回';
  r.reviewer = '当前用户';
  open.value = false;
  MessagePlugin[pass ? 'success' : 'warning'](pass ? `已发布草稿「${r.name}」：进入灰度验证（人工发布，无自动发布通道）` : `已驳回草稿「${r.name}」：样本回流失败学习库，不进入发布队列`);
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = rows.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="自进化实验室"
      desc="从失败轨迹提炼技能草稿 / 评测用例 / 提示词建议，全部经人工评审后发布；自动发布在代码层不可达。"
      volume="卷 25" manifest="U-04" cli="oc frontier evolution queue --state 待评审" experimental
      :status="[{ label: `季度已发布 ${releasedThisQuarter} / 目标 ≥ ${QUARTER_TARGET}`, theme: releasedThisQuarter >= QUARTER_TARGET ? 'success' : 'warning' }, { label: '禁止自动发布', theme: 'danger' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="openAutoPublishPolicy">禁止自动发布说明</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在汇总失败轨迹与草稿队列…"
      empty-title="草稿队列为空" empty-desc="还没有从失败中提炼出草稿；失败轨迹累积到阈值后会自动生成草稿候选（仍需人工评审）。"
      empty-action="返回看板" example-task="评审一条技能草稿：编辑指令 → 运行评测 → 发布"
      what="草稿队列加载失败" why="失败学习管线不可达（草稿由失败轨迹聚类生成，需与评测集联查）"
      how="重试；已发布技能不受影响，队列只读期间不会丢失草稿"
      :collapsed-summary="`草稿 ${rows.length} 条（含 1 条已驳回），列表已折叠展示（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="季度有效产出" :value="releasedThisQuarter" unit="条" icon="lightbulb" :target="QUARTER_TARGET" :lower-is-better="false" hint="目标 ≥ 20 条/季度（被采纳且指标提升）" />
        <StatCard label="待评审草稿" :value="rows.filter((r) => r.state === '草稿' || r.state === '评审中').length" unit="条" icon="mail" :lower-is-better="true" hint="评审队列积压需在季度评审前清空" />
        <StatCard label="已驳回" :value="rows.filter((r) => r.state === '已驳回').length" unit="条" icon="close" :lower-is-better="true" hint="驳回样本回流失败学习库" />
        <StatCard label="自动发布通道" :value="0" unit="条" icon="lock" hint="硬性禁止：代码层不可达，必须人工评审" />
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined" style="margin-top: 12px">
        <template #state="{ row }"><Tag size="small" :theme="STATE_THEME[row.state as DraftState]" variant="light-outline">{{ row.state }}</Tag></template>
        <template #op="{ row }"><Button size="small" variant="text" @click="review(row)">评审</Button></template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">禁止自动发布（硬性）<CliHint command="oc frontier evolution policy --no-auto-publish" /></div>
          <InfoGrid :columns="1" :items="AUTO_PUBLISH_POLICY" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">评审清单（每条草稿必查）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag v-for="c in rows[0]?.checklist ?? []" :key="c" size="small" variant="outline">{{ c }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            负样本：{{ rows.filter((r) => r.state === '已驳回').length }} 条已驳回（含「未覆盖项缺失」提示词建议）；
            发布前必须运行评测用例，未过回归不得发布。
          </div>
          <CopyableId id="trace-frontier-evo-8d42" label="自进化 traceId" short="12" />
        </div>
      </div>

      <Dialog v-model:visible="open" header="草稿评审（可编辑指令 + 可运行评测用例）" width="680px" cancel-btn="关闭">
        <div class="oc-stack" v-if="current">
          <InfoGrid :columns="2" :items="[
            { key: 'id', label: '草稿 ID', value: current.id, mono: true },
            { key: 'kind', label: '类型', value: current.kind },
            { key: 'from', label: '来源会话 / 运行', value: current.session },
            { key: 'reason', label: '失败原因', value: current.reason },
            { key: 'state', label: '当前状态', value: current.state, tag: { text: current.state, theme: STATE_THEME[current.state] } },
            { key: 'auto', label: '自动发布', value: '禁止（不可达）' },
          ]" />
          <div>
            <div class="oc-kv__k">草稿指令（可编辑）</div>
            <Textarea v-model="instruction" :autosize="{ minRows: 3, maxRows: 6 }" />
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Button size="small" variant="outline" @click="runEval">运行评测用例</Button>
            <Tag size="small" variant="outline">回归集：历史失败轨迹 2 条 + 负样本 1 条</Tag>
          </div>
          <div v-if="evalResult" class="oc-card" style="padding: 8px" :style="{ borderColor: evalResult.startsWith('评测通过') ? 'var(--td-success-color)' : 'var(--td-error-color)' }">
            <span style="font-size: 12px">{{ evalResult }}</span>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Button size="small" theme="primary" @click="decide(true)">评审通过并发布</Button>
            <Button size="small" theme="danger" variant="outline" @click="decide(false)">驳回</Button>
            <span class="oc-muted" style="font-size: 12px">发布前必须先「运行评测用例」并取得通过结论（未过回归不得发布）。</span>
          </div>
        </div>
      </Dialog>

      <Dialog v-model:visible="policyOpen" header="禁止自动发布（硬性规则说明）" width="640px" :footer="false">
        <div class="oc-stack">
          <InfoGrid :columns="1" :items="AUTO_PUBLISH_POLICY" />
          <InfoGrid :columns="2" :items="[
            { key: 'channel', label: '自动发布通道', value: '不存在（界面无 publish 入口，草稿 API 不可达）' },
            { key: 'manual', label: '当前队列发布来源', value: `${releasedThisQuarter} 条已发布均为人工评审通过` },
          ]" />
          <div class="oc-muted" style="font-size: 12px">
            发布动作只能在「评审」对话框内完成：先运行评测用例并取得通过结论，未过回归不得发布。
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
