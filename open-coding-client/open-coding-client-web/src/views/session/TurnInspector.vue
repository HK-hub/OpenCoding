<script setup lang="ts">
/**
 * Turn 检查器（S-19 / 卷 12 §Turn 阶段 + 卷 31 用量归因）：
 * 阶段时间线（解析→评估→规划→执行→反思→验证→收尾）+ 用量汇总（token/成本/时长/工具数）
 * + 计划引用 + 会话状态。数据来自会话域（store + buildSessionData），不另建真相源。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, Progress, Select, Tag, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { db } from '@/mock/db';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import type { TurnPhase } from '@/mock/data/session';
import { makeError, type MockError } from '@/mock/runtime';

const store = useSessionStore();
const ui = useUiStore();
const flagshipId = db.sessions[0].id;

const selectedId = ref(flagshipId);
const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);
const recomputing = ref(false);
const recomputeProgress = ref(0);

const PHASE_TEXT: Record<TurnPhase, { label: string; icon: string }> = {
  PARSE: { label: '意图解析', icon: 'chat-bubble' },
  ASSESS: { label: '复杂度评估', icon: 'filter' },
  PLAN: { label: '规划', icon: 'sitemap' },
  EXECUTE: { label: '执行', icon: 'tools' },
  REFLECT: { label: '反思', icon: 'lightbulb' },
  VERIFY: { label: '验证', icon: 'check' },
  WRAP: { label: '收尾', icon: 'flag' },
};

const session = computed(() => store.sessions.find((s) => s.id === selectedId.value));
const isFlagship = computed(() => selectedId.value === flagshipId);
const toolCalls = computed(() => store.items.filter((i) => i.type === 'tool_call'));
const subagents = computed(() => store.items.filter((i) => i.type === 'subagent'));
const planItem = computed(() => store.items.find((i) => i.type === 'plan' && i.plan));
const cost = db.sessionCost;

const options = computed(() => store.sessions.map((s) => ({ value: s.id, label: `${s.title}（${s.shortId}）` })));
const shellState = computed(() => {
  if (ui.connection !== 'CONNECTED') return 'OFFLINE' as const;
  if (failure.value) return 'ERROR' as const;
  if (phase.value === 'LOADING') return 'LOADING' as const;
  return isFlagship.value ? ('NORMAL' as const) : ('EMPTY' as const);
});

const costSeries = computed(() => cost.byModelSeries.map((s) => ({ name: s.name, points: s.points })));
const cacheHitRate = computed(() => Math.round((cost.cacheReadTokens / Math.max(1, cost.cacheReadTokens + cost.inputTokens)) * 100));

/** 重算进度定时器句柄（完成 / 取消 / 卸载都要清理） */
let recomputeTimer: number | null = null;
/** 长时操作：L1 重算用量归因；可取消，取消后回到最近安全点（不丢已完成的分段结果） */
function recompute() {
  recomputing.value = true;
  recomputeProgress.value = 0;
  recomputeTimer = window.setInterval(() => {
    recomputeProgress.value = Math.min(100, recomputeProgress.value + 12);
    if (recomputeProgress.value >= 100) {
      if (recomputeTimer !== null) window.clearInterval(recomputeTimer);
      recomputeTimer = null;
      recomputing.value = false;
    }
  }, 200);
}

function cancelRecompute() {
  recomputing.value = false;
  recomputeProgress.value = 0;
  // 取消即停表：回到最近安全点，不让定时器在后台继续推进
  if (recomputeTimer !== null) window.clearInterval(recomputeTimer);
  recomputeTimer = null;
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
onUnmounted(() => {
  // 离开页面时清理进度定时器：避免残留无归属定时器继续推进已卸载组件的状态
  if (recomputeTimer !== null) window.clearInterval(recomputeTimer);
  recomputeTimer = null;
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Turn 检查器"
      desc="单轮阶段时间线（解析→评估→规划→执行→反思→验证→收尾）与用量汇总：token、成本、时长、工具数，并给计划引用。"
      volume="卷 12"
      manifest="S-19"
      cli="oc session turns --session <id> --with-cost"
      :status="[{ label: '只读诊断', theme: 'default' }, { label: '成本来自计量结算', theme: 'primary' }]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次用量读取失败">
          <Button size="small" variant="text" @click="failure = makeError('INTERNAL_ERROR', 'cost ledger 分片未就绪')">模拟异常</Button>
        </Tooltip>
        <Button size="small" variant="outline" :disabled="!isFlagship" :loading="recomputing" @click="recompute">重算用量归因</Button>
        <Button v-if="recomputing" size="small" variant="text" @click="cancelRecompute">取消（回到安全点）</Button>
      </template>
    </PageHeader>

    <div class="oc-flex oc-flex--wrap" style="gap: 8px">
      <Select v-model="selectedId" :options="options" size="small" style="width: 380px" placeholder="选择会话" />
      <Tag v-if="session" size="small" variant="outline">{{ session.state }} · 阶段 {{ PHASE_TEXT[session.phase].label }}</Tag>
      <Tag size="small" variant="outline" class="oc-mono">{{ session?.model }}</Tag>
      <span v-if="!isFlagship" class="oc-muted" style="font-size: 12px">仅旗舰示例会话携带完整 Turn 明细（其余会话的投影由内核按需生成）</span>
    </div>

    <Progress v-if="recomputing" :percentage="recomputeProgress" :stroke-width="4" :label="`正在重算用量归因… ${recomputeProgress}%（可取消：取消后回到最近安全点，已完成分段结果保留）`" />

    <StateShell
      :state="shellState"
      stage="正在装配 Turn 投影与用量归因…"
      cancellable
      empty-title="该会话暂无 Turn 明细投影"
      empty-desc="Turn 检查器需要 durable 事件投影；此会话尚未产生逐轮明细（或明细已按留存策略回收）。"
      empty-action="切换到旗舰会话"
      what="Turn 明细读取失败"
      :why="failure?.message ?? ''"
      how="可重试；若结算账本分片尚未就绪，可先用「成本与用量」页的上次快照查看（标注数据滞后）。"
      :trace-id="failure?.traceId ?? ''"
      :disabled-capabilities="['用量归因重算', '计划引用展开']"
      @retry="failure = null; ui.simulateReconnect()"
      @empty-action="selectedId = flagshipId"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="输入 token" :value="cost.inputTokens" format="token" icon="layers" />
        <StatCard label="输出 token（含推理）" :value="cost.outputTokens + cost.reasoningTokens" format="token" icon="chat" />
        <StatCard label="本轮成本" :value="cost.total" format="cost" icon="discount" :target="cost.budget" target-kind="max" />
        <StatCard label="总时长" :value="Math.round(cost.totalMs / 1000)" unit="s" format="raw" icon="time" :delta="-12.4" lower-is-better />
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            阶段时间线
            <Tag size="small" variant="outline">单轮 7 阶段（可回跳到任一阶段重看）</Tag>
          </h3>
          <Timeline>
            <TimelineItem
              v-for="(p, i) in db.turnPhases"
              :key="p.phase"
              :dot-color="i === db.turnPhases.length - 1 ? 'var(--td-brand-color)' : 'var(--oc-sev-ok)'"
            >
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <OcIcon :name="PHASE_TEXT[p.phase].icon" size="13px" />
                <b style="font-size: 13px">{{ PHASE_TEXT[p.phase].label }}</b>
                <Tag size="small" variant="outline" class="oc-mono">{{ p.phase }}</Tag>
                <span class="oc-muted" style="font-size: 11px">{{ new Date(p.at).toLocaleString('zh-CN') }}</span>
              </div>
              <div class="oc-secondary" style="font-size: 12px">{{ p.note }}</div>
            </TimelineItem>
          </Timeline>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">用量汇总</h3>
            <InfoGrid
              :columns="2"
              :items="[
                { key: 'session', label: '会话', value: session?.title },
                { key: 'state', label: '状态', value: session?.state, tag: { text: session?.state ?? '', theme: session?.state === 'COMPLETED' ? 'success' : 'primary' } },
                { key: 'model', label: '模型', value: session?.model, mono: true },
                { key: 'workspace', label: '工作区', value: session?.workspace, mono: true },
                { key: 'tools', label: '工具调用', value: `${toolCalls.length} 次（R2 执行 ${toolCalls.filter((t) => t.tool?.risk === 'R2').length} 次）` },
                { key: 'subagent', label: '子 Agent 派生', value: `${subagents.length} 个（预算信封独立计量）` },
                { key: 'ttfb', label: '首字节（TTFB）', value: `${cost.ttfbMs} ms` },
                { key: 'cache', label: '缓存读命中占比', value: `${cacheHitRate}%（缓存折扣已单列）` },
                { key: 'budget', label: '预算水位', value: `$${cost.total.toFixed(4)} / $${cost.budget.toFixed(2)}` },
                { key: 'phase', label: '当前阶段', value: session ? PHASE_TEXT[session.phase].label : '' },
              ]"
            />
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">计划引用</h3>
            <div v-if="planItem?.plan" class="oc-stack" style="gap: 6px">
              <div v-for="(s, i) in planItem.plan.steps" :key="i" class="oc-flex" style="gap: 6px; align-items: flex-start">
                <OcIcon
                  :name="s.status === 'done' ? 'task-checked' : s.status === 'doing' ? 'loading' : 'task'"
                  size="13px"
                  :color="s.status === 'done' ? 'var(--oc-sev-ok)' : s.status === 'doing' ? 'var(--td-brand-color)' : 'var(--td-text-color-placeholder)'"
                />
                <span style="font-size: 12px">{{ s.text }}</span>
              </div>
              <div v-if="planItem.plan.changeReason" class="oc-muted" style="font-size: 11px">
                重规划理由：{{ planItem.plan.changeReason }}
              </div>
            </div>
            <div v-else class="oc-muted" style="font-size: 12px">该会话未产生计划卡（轻计划策略下计划只存在于推理链）。</div>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">成本归因（按模型序列，缓存折扣单列）</h3>
        <OcChart type="area" :series="costSeries" :height="220" format="cost" unit="USD" aria-label="按模型序列的成本累计" />
      </div>
    </StateShell>
  </div>
</template>
