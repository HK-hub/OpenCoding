<script setup lang="ts">
/**
 * A-05 循环策略与状态机：轻计划 / 严格计划 / 纯 ReAct 三档切换 + 共享状态机与安全点说明。
 * 三种策略共享同一状态机：任一策略下都可中断、暂停、恢复与检查点回滚（卷 12 D-AG-1 / D-AG-3）。
 * 溯源：卷 12 D-AG-1 / §4.2 / BUILD-MANIFEST A-05
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, StepItem, Steps, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.agent;

const state = ref<UiStateKind>('LOADING');
const strategy = ref<'light' | 'strict' | 'react'>('strict');
const changeReason = ref('任务涉及 3 个域与 26 个页面，复杂度评估建议严格计划（含阶段反思与验证）');

const STRATEGIES = [
  {
    key: 'light' as const,
    title: '轻计划 + 执行 + 周期反思',
    when: '中小任务（单文件/单模块，验收明确）',
    cost: '前期开销低，长任务易漂移',
    reflect: '每 8 次工具调用或阶段切换时反思；失败立即反思',
  },
  {
    key: 'strict' as const,
    title: '严格计划（先计划后执行）',
    when: '跨模块、含不可逆动作、验收标准需先确认',
    cost: '前期开销较高，可控性最强',
    reflect: '每阶段结束强制反思；计划变更需记录理由',
  },
  {
    key: 'react' as const,
    title: '纯 ReAct（思考-行动-观察）',
    when: '探索性调试、信息高度不确定',
    cost: '灵活；长任务需依赖三重上限兜底',
    reflect: '仅失败时反思；无显式计划阶段',
  },
];

/** 共享状态机阶段（任一策略都走同一状态机） */
const PHASES = [
  { name: '意图解析', out: '意图与验收清单（必要时 ask_user 澄清）' },
  { name: '复杂度评估', out: '计划深度 + 初始自主度建议' },
  { name: '规划', out: '计划条目（目标 → 步骤 → 任务，可编辑）' },
  { name: '执行', out: 'Item 事件流（模型调用 / 工具调用 / 观察）' },
  { name: '反思', out: '反思摘要 + 计划增量更新（含理由）' },
  { name: '验证', out: '三级验证证据清单（L1/L2/L3）' },
  { name: '收尾', out: 'Turn 报告 + 记忆候选 + 资源清理' },
];

const SAFE_POINTS = [
  { point: '一次模型调用结束', effect: '插话（steer）在此生效' },
  { point: '一次工具调用前后', effect: '停止/暂停在此生效（工具结果保留）' },
  { point: '检查点写入完成后', effect: '可从此点恢复（依据副作用账本避免重复动作）' },
];

const currentPhase = computed(() => (strategy.value === 'react' ? 4 : 5));

/** 强制反思生效范围（下一阶段名）与策略决策记录：页面可见状态，不以提示代替 */
const forceReflectUntil = ref('');
const decisions = ref<{ seq: number; action: string; detail: string; at: string }[]>([]);
let decisionSeq = 0;
function recordDecision(action: string, detail: string) {
  decisionSeq += 1;
  decisions.value.push({ seq: decisionSeq, action, detail, at: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
}
const reflectBadge = computed(() => (forceReflectUntil.value ? [{ label: `强制反思：下一阶段「${forceReflectUntil.value}」强制执行`, theme: 'warning' as const }] : []));

/** 要求立即反思：写入「下一阶段强制反思」并登记决策记录（页头徽标 + 记录列表可见） */
function requestForceReflect() {
  if (forceReflectUntil.value) return;
  const until = PHASES[(currentPhase.value + 1) % PHASES.length].name;
  forceReflectUntil.value = until;
  recordDecision('要求立即反思', `下一阶段「${until}」结束前必须产出反思摘要（含理由），并写入 Turn 检查器`);
  MessagePlugin.info(`已要求下一阶段强制反思：生效范围「${until}」（已写入决策记录，反思摘要将写入 Turn 检查器）`);
}

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function switchStrategy(next: 'light' | 'strict' | 'react') {
  strategy.value = next;
  const meta = STRATEGIES.find((s) => s.key === next);
  changeReason.value = `策略切换为「${meta?.title}」：${next === 'react' ? '探索性场景，放弃显式计划以换取灵活度；仍受三重上限保护' : next === 'strict' ? '跨模块与不可逆动作较多，采用严格计划以增强可控性' : '任务收敛，降格为轻计划以降低前期开销'}`;
  recordDecision('切换策略', `切到「${meta?.title ?? next}」；安全点生效，状态机与恢复能力不变`);
  MessagePlugin.success(`循环策略已切换（安全点生效）：AI 状态机与恢复能力不变`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="循环策略与状态机"
      desc="轻计划 / 严格计划 / 纯 ReAct 三档可切换，共享同一状态机；无论哪档都能中断、暂停、恢复与检查点回滚。"
      volume="卷 12"
      manifest="A-05"
      cli="oc agent loop strategy set strict"
      :status="[{ label: `当前：${STRATEGIES.find((s) => s.key === strategy)?.title}`, theme: 'primary' }, { label: '安全点中断', theme: 'success' }, ...reflectBadge]"
    >
      <template #actions>
        <Select :model-value="strategy" size="small" style="width: 200px" :options="STRATEGIES.map((s) => ({ label: s.title, value: s.key }))" @change="(v) => switchStrategy(v as 'light' | 'strict' | 'react')" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="当前策略" :value="STRATEGIES.find((s) => s.key === strategy)?.title.split('（')[0] ?? ''" format="raw" icon="refresh" hint="可在会话中随时切换（安全点生效）" />
      <StatCard label="当前阶段" :value="PHASES[currentPhase]?.name ?? '—'" format="raw" icon="chart" hint="阶段切换开销 ≤ 5ms" />
      <StatCard label="检查点" :value="data.checkpoints.length" unit="个" icon="history" hint="可恢复到任一检查点（副作用账本保证幂等）" />
      <StatCard label="插话生效延迟" :value="1" unit="秒" format="raw" icon="time" :lower-is-better="true" hint="插话在下一个安全点生效，保证事件序列一致" />
    </div>

    <StateShell
      :state="state"
      stage="加载循环策略与状态机…"
      empty-title="尚无循环上下文"
      empty-desc="循环策略在会话首次 Turn 开始时确定；无活跃 Turn 时仅展示默认策略。"
      empty-action="查看会话工作台"
      example-task="在会话中要求「先出计划，我确认后再改代码」"
      what="循环策略加载失败"
      why="循环策略 SPI 未装配或状态机快照不可读。"
      how="可重试；失败时回退到默认策略（轻计划 + 周期反思），不会无策略裸跑。"
      trace-id="trace-loop-2a90fd"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--3">
        <div v-for="s in STRATEGIES" :key="s.key" class="oc-card" :style="s.key === strategy ? 'border-color: var(--td-brand-color, #0052d9)' : ''">
          <h3 class="oc-card__title">
            {{ s.title }}
            <Tag v-if="s.key === strategy" size="small" theme="primary">生效中</Tag>
          </h3>
          <div class="oc-kv" style="font-size: 12px">
            <span class="oc-kv__k">适用</span><span>{{ s.when }}</span>
            <span class="oc-kv__k">代价</span><span>{{ s.cost }}</span>
            <span class="oc-kv__k">反思频率</span><span>{{ s.reflect }}</span>
          </div>
          <Popconfirm content="切换在安全点生效：正在执行的动作会先完成，不丢失已有进展。" @confirm="switchStrategy(s.key)">
            <Button size="small" variant="outline" style="margin-top: 10px" :disabled="s.key === strategy">切到该策略</Button>
          </Popconfirm>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          共享状态机（当前阶段高亮）
          <span class="oc-muted" style="font-size: 12px">可中断 / 可暂停 / 可恢复 / 可回滚到检查点</span>
        </h3>
        <Steps :current="currentPhase" layout="horizontal" size="small">
          <StepItem v-for="(p, i) in PHASES" :key="p.name" :title="`${i + 1}. ${p.name}`" />
        </Steps>
        <Table
          :data="PHASES"
          :columns="[
            { colKey: 'name', title: '阶段', width: 140, cell: 'cell' },
            { colKey: 'out', title: '产出', cell: 'cell' },
          ]"
          row-key="name"
          size="small"
          style="margin-top: 10px"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'name'">
              <Tag size="small" :theme="PHASES[currentPhase]?.name === row.name ? 'primary' : 'default'" variant="light-outline">{{ row.name }}</Tag>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">安全点语义（为什么插话不是「立刻」生效）</h3>
          <div v-for="sp in SAFE_POINTS" :key="sp.point" class="oc-flex" style="gap: 8px; margin-bottom: 6px">
            <OcIcon name="flag" size="13px" />
            <span style="font-size: 13px">{{ sp.point }}</span>
            <span class="oc-muted" style="font-size: 12px">{{ sp.effect }}</span>
          </div>
          <div class="oc-muted" style="font-size: 12px">
            硬中断会破坏事件序列一致性，因此插话统一在安全点注入；停止（Stop）同样在安全点停止并保留已完成工具结果。
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            本轮策略变更理由
            <Tag size="small" theme="primary" variant="outline">agent.plan.updated</Tag>
          </h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'reason', label: '变更理由（为什么这么做）', value: changeReason, block: true },
              { key: 'complexity', label: '复杂度评估依据', value: '涉及文件数 40+ / 跨 3 模块 / 含 1 处不可逆动作（迁移脚本）/ 验收标准明确' },
              { key: 'replan', label: '增量重规划触发条件', value: '新信息、失败、用户变更、偏离检测（漂移分 > 0.3）' },
              { key: 'budget', label: '反思与验证计费', value: '计入本轮预算并单列（不占用执行步数上限）' },
            ]"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px; align-items: center">
            <CliHint command="oc agent loop strategy get" />
            <Button size="small" variant="outline" :disabled="!!forceReflectUntil" @click="requestForceReflect">{{ forceReflectUntil ? '强制反思已生效' : '要求立即反思' }}</Button>
            <Tag v-if="forceReflectUntil" size="small" theme="warning" variant="light-outline">强制反思生效中（至「{{ forceReflectUntil }}」阶段）</Tag>
          </div>
          <div v-if="decisions.length" class="oc-divider" />
          <div v-if="decisions.length" class="oc-muted" style="font-size: 12px">
            <div style="margin-bottom: 2px">策略决策记录（{{ decisions.length }} 条）：</div>
            <div v-for="d in decisions" :key="d.seq" class="oc-mono" style="font-size: 11px">#{{ d.seq }} {{ d.action }} · {{ d.detail }}（{{ d.at }}）</div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
