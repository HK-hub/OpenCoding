<script setup lang="ts">
/**
 * A-02 SubAgent 派生树：可折叠轨迹 + brief + 预算信封 + 结果契约 + parentItemId + 取消级联。
 * 约束：子 Agent 权限只减不增；预算从父预算划拨，超限即暂停并回报；父取消级联取消子并触发清理（卷 12 §4.3）。
 * 溯源：卷 12 D-AG-4/D-AG-5 / §4.3 / BUILD-MANIFEST A-02
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Progress, Select, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import type { SubAgent } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.agent;

const state = ref<UiStateKind>('LOADING');
const expanded = ref<Record<string, boolean>>({ 'sa-01': true });
const activeId = ref('sa-01');
const cancelled = ref<string[]>([]);

const active = computed<SubAgent>(() => data.subagents.find((s) => s.agentId === activeId.value) ?? data.subagents[0]);
const running = computed(() => data.subagents.filter((s) => s.status === 'running' || s.status === 'paused').length);
const totalUsed = computed(() => data.subagents.reduce((a, s) => a + s.budget.usedTokens, 0));
const totalLimit = computed(() => data.subagents.reduce((a, s) => a + s.budget.tokenLimit, 0));

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function statusTheme(s: string) {
  return s === 'succeeded' ? 'success' : s === 'running' ? 'primary' : s === 'failed' ? 'danger' : s === 'cancelled' ? 'default' : 'warning';
}
function statusLabel(s: string) {
  return { succeeded: '已完成', running: '运行中', failed: '失败', cancelled: '已取消', paused: '已暂停' }[s] ?? s;
}

/** 取消级联：取消父会级联取消其所有子（含嵌套），并触发临时资源清理 */
function cascadeCancel(sa: SubAgent) {
  const children = data.subagents.filter((s) => s.depth > sa.depth && s.parentItemId.startsWith(sa.parentItemId.split('-')[0]));
  const ids = [sa.agentId, ...children.map((c) => c.agentId)];
  cancelled.value = [...new Set([...cancelled.value, ...ids])];
  MessagePlugin.warning(`已级联取消 ${ids.length} 个子 Agent（含嵌套），临时资源清理已在安全点触发`);
}

/** 树形缩进：按 depth 呈现父子关系（父 itemId 前缀一致视为同树） */
function indentOf(sa: SubAgent) {
  return `${(sa.depth - 1) * 28}px`;
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="SubAgent 派生树"
      desc="子会话独立上下文与独立预算信封：父 → 子可折叠展开，结果必须按契约返回（结论 + 证据 + 未决问题 + 用量）。"
      volume="卷 12"
      manifest="A-02"
      cli="oc agent subagents --parent item-2f81-042 --tree"
      :status="[{ label: `${data.subagents.length} 个派生实例`, theme: 'primary' }, { label: '权限只减不增', theme: 'success' }]"
    >
      <template #actions>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
        <Popconfirm
          theme="danger"
          content="取消全部运行中的子 Agent：在当前安全点停止，已完成的工具结果保留，临时资源会被清理。"
          @confirm="MessagePlugin.warning('已级联取消全部运行中子 Agent（安全点停止，保留已完成部分）')"
        >
          <Button size="small" theme="danger" variant="outline">全部取消</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="派生实例" :value="data.subagents.length" unit="个" icon="sitemap" hint="单轮并行默认上限 4；嵌套深度默认 ≤ 3" />
      <StatCard label="运行 / 暂停" :value="running" unit="个" icon="loading" :lower-is-better="true" hint="超限即暂停并回报父 Agent（不静默终止）" />
      <StatCard label="预算用量" :value="totalUsed" :target="totalLimit" unit="token" format="token" icon="discount" hint="子预算从父预算划拨，独立结算" />
      <StatCard label="失败 / 取消" :value="data.subagents.filter((s) => s.status === 'failed' || s.status === 'cancelled').length" unit="个" icon="error" :lower-is-better="true" hint="子失败不炸父：父收到结构化失败后决定重试/换路" />
    </div>

    <StateShell
      :state="state"
      stage="加载派生树…"
      empty-title="当前没有子 Agent"
      empty-desc="主 Agent 会在可并行或需强隔离的任务上派生 SubAgent；也可手动在会话中要求派生。"
      empty-action="查看会话工作台"
      example-task="派生「迁移脚本验证」子 Agent 并在后台校验回退脚本"
      what="派生树加载失败"
      why="子会话事件链不可读（agent.subagent.* 事件缺失 parentItemId 关联）。"
      how="可重试；子会话仍在运行，其结果会在事件流 V-01 中补齐。"
      trace-id="trace-sa-1f7d92"
      @retry="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            派生树
            <span class="oc-muted" style="font-size: 12px">按 depth 缩进；点击展开 brief 与预算信封</span>
          </h3>
          <div class="oc-stack">
            <div v-for="sa in data.subagents" :key="sa.agentId" class="oc-card" style="padding: 8px 10px" :style="{ marginLeft: indentOf(sa) }">
              <div class="oc-flex--between" style="align-items: flex-start">
                <button type="button" class="oc-flex oc-grow" style="gap: 6px; text-align: left" @click="expanded[sa.agentId] = !expanded[sa.agentId]; activeId = sa.agentId">
                  <OcIcon :name="expanded[sa.agentId] ? 'folder-open' : 'folder'" size="13px" />
                  <b style="font-size: 13px">{{ sa.name }}</b>
                  <Tag size="small" :theme="statusTheme(sa.status)" variant="light-outline">{{ statusLabel(sa.status) }}</Tag>
                  <Tag size="small" variant="outline">depth {{ sa.depth }}</Tag>
                </button>
                <Popconfirm
                  v-if="sa.status === 'running' || sa.status === 'paused'"
                  theme="danger"
                  content="取消该子 Agent 及其派生的全部下级（级联取消），并清理临时资源；已完成结果保留。"
                  @confirm="cascadeCancel(sa)"
                >
                  <Button size="small" variant="text">取消级联</Button>
                </Popconfirm>
                <Tag v-else-if="cancelled.includes(sa.agentId)" size="small" theme="default">已取消</Tag>
              </div>

              <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 4px">
                <span class="oc-flex" style="gap: 4px; font-size: 11px">
                  <span class="oc-muted">parentItemId</span><CopyableId :id="sa.parentItemId" :short="16" />
                </span>
                <span class="oc-muted" style="font-size: 11px">隔离：{{ sa.isolation.split('：')[0] }}</span>
              </div>

              <div v-if="expanded[sa.agentId]" class="oc-stack" style="margin-top: 6px; gap: 4px">
                <div class="oc-secondary" style="font-size: 12px">目标：{{ sa.brief.goal }}</div>
                <div class="oc-flex oc-flex--wrap" style="gap: 4px">
                  <Tag v-for="t in sa.tools" :key="t" size="small" variant="outline">{{ t }}</Tag>
                </div>
                <div class="oc-flex" style="gap: 6px">
                  <span class="oc-muted" style="font-size: 11px; width: 88px">预算信封</span>
                  <Progress :percentage="Math.round((sa.budget.usedTokens / sa.budget.tokenLimit) * 100)" theme="line" size="small" style="flex: 1" />
                  <span class="oc-mono" style="font-size: 11px">{{ sa.budget.usedTokens }}/{{ sa.budget.tokenLimit }}</span>
                </div>
                <div class="oc-flex" style="gap: 6px">
                  <span class="oc-muted" style="font-size: 11px; width: 88px">步数 / 时长</span>
                  <span class="oc-mono" style="font-size: 11px">{{ sa.budget.usedSteps }}/{{ sa.budget.stepLimit }} 步 · {{ sa.budget.timeLimitMin }}min 上限</span>
                </div>
                <div v-if="sa.returnContract" class="oc-flex" style="gap: 6px">
                  <span class="oc-muted" style="font-size: 11px; width: 88px">结果契约</span>
                  <Tag size="small" theme="success" variant="light-outline">已返回（置信 {{ sa.returnContract.confidence }}）</Tag>
                </div>
                <div v-else class="oc-flex" style="gap: 6px">
                  <span class="oc-muted" style="font-size: 11px; width: 88px">结果契约</span>
                  <Tag size="small" theme="warning" variant="light-outline">待返回（运行中 / 已取消）</Tag>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            {{ active.name }} · 任务简报与结果契约
            <Tag size="small" :theme="statusTheme(active.status)" variant="light-outline">{{ statusLabel(active.status) }}</Tag>
          </h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'goal', label: '目标', value: active.brief.goal },
              { key: 'acceptance', label: '验收标准', value: active.brief.acceptance.join('；'), block: true },
              { key: 'known', label: '已知信息', value: active.brief.known.join('；') },
              { key: 'constraints', label: '约束', value: active.brief.constraints.join('；') },
              { key: 'refs', label: '显式引用（不继承父对话）', value: active.brief.refs.join('｜'), block: true, mono: true },
              { key: 'banned', label: '禁止事项', value: active.brief.banned.join('；') },
              { key: 'isolation', label: '上下文隔离', value: active.isolation },
              { key: 'tools', label: '工具（父 ∩ 自身 allow）', value: active.tools.join(', '), mono: true },
            ]"
          />
          <div class="oc-divider" />
          <template v-if="active.returnContract">
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 6px">结果契约（结构化返回，缺证据即视为未完成）</div>
            <div class="oc-kv" style="font-size: 12px">
              <span class="oc-kv__k">结论</span><span>{{ active.returnContract.conclusion }}</span>
              <span class="oc-kv__k">证据</span>
              <span class="oc-stack" style="gap: 2px">
                <span v-for="ev in active.returnContract.evidence" :key="ev" class="oc-mono" style="font-size: 11px">{{ ev }}</span>
              </span>
              <span class="oc-kv__k">产出物</span>
              <span>{{ active.returnContract.artifacts.length ? active.returnContract.artifacts.join('｜') : '无（未产出可复用工件）' }}</span>
              <span class="oc-kv__k">未决问题</span>
              <span>{{ active.returnContract.openQuestions.length ? active.returnContract.openQuestions.join('；') : '无' }}</span>
              <span class="oc-kv__k">用量</span>
              <span class="oc-mono">${{ active.returnContract.usage.cost.toFixed(3) }} · {{ active.returnContract.usage.tokens }} token · {{ Math.round(active.returnContract.usage.durationMs / 1000) }}s</span>
            </div>
          </template>
          <div v-else class="oc-flex" style="gap: 8px">
            <OcIcon name="time" size="14px" />
            <span class="oc-secondary" style="font-size: 12px">
              结果契约尚未返回：{{ active.status === 'cancelled' ? '该子 Agent 已被级联取消，父 Agent 已收到取消回报并保留已完成部分。' : '运行中；超预算会暂停并回报父 Agent 请求决策。' }}
            </span>
          </div>
          <div class="oc-divider" />
          <JsonBlock label="子会话事件链（parentItemId 关联，可展开完整轨迹）" :value="{
            agentId: active.agentId,
            parentItemId: active.parentItemId,
            depth: active.depth,
            status: active.status,
            budget: active.budget,
            events: ['agent.subagent.started', 'agent.phase.changed', active.returnContract ? 'agent.subagent.completed' : 'agent.subagent.running'],
          }" :collapse-over="180" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
