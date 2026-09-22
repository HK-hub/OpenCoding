<script setup lang="ts">
/**
 * 团队总览（R-01）：三视图切换（拓扑 SVG / 时间线泳道 / 成本瀑布 OcChart）+ 主管摘要卡。
 * 溯源：卷 13 D-TEAM-7 观测三视图（拓扑/时间线/成本瀑布 + 主管摘要）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, RadioGroup, RadioButton, Select, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { TOPOLOGY_META, taskData } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const view = ref<'topology' | 'timeline' | 'cost'>('topology');
const selected = ref('TEAM-checkout-01');
/** 本页立即生成的阶段摘要（落成对象并渲染，不伪装为周期汇报） */
const stageSummaries = ref<{ id: string; at: string; by: string; progress: number; cost: number; evidence: number; blockers: number; openItems: string[] }[]>([]);

const team = computed(() => taskData.teams.find((t) => t.teamId === selected.value) ?? taskData.teams[0]);
const lead = computed(() => team.value.members.find((m) => m.memberId === team.value.leadMemberId));

const stats = computed(() => ({
  members: team.value.members.length,
  busy: team.value.members.filter((m) => m.state === 'busy').length,
  blocked: team.value.members.filter((m) => m.state === 'blocked').length,
  used: team.value.budget.used,
  total: team.value.budget.total,
}));

/** 拓扑布局：主管居中上方，成员等距排列下方 */
const topo = computed(() => {
  const w = 900;
  const gap = w / (team.value.members.length + 1);
  const nodes = team.value.members.map((m, i) => ({
    ...m, x: gap * (i + 1), y: 190,
    color: m.state === 'busy' ? 'var(--td-brand-color,#0052d9)' : m.state === 'blocked' ? 'var(--oc-sev-error,#d54941)' : m.state === 'failed' ? 'var(--oc-sev-warn,#e37318)' : m.state === 'completed' ? 'var(--td-success-color,#2ba471)' : 'var(--td-text-color-placeholder,#b3b3b3)',
  }));
  return { w, nodes, leadX: w / 2, leadY: 40 };
});

/** 时间线泳道：成员 → 当前任务条（数据来自 WorkItem 的起止时间） */
const lanes = computed(() => team.value.members.map((m) => {
  const task = taskData.workItems.find((i) => i.itemId === m.currentTaskId)
    ?? taskData.workItems.find((i) => i.level === 'task' && i.teamId === team.value.teamId && i.status === 'in_progress');
  return { member: m, task };
}));

const costValues = computed(() => [
  ...team.value.members.slice(0, 6).map((m) => ({ name: m.name.split('·')[0], value: m.used })),
  { name: '合计', value: Number(team.value.members.reduce((a, b) => a + b.used, 0).toFixed(2)) },
]);

/** 请求主管立即生成阶段摘要：按当前团队数据落成摘要对象并插入「主管摘要」卡片 */
function requestStageSummary() {
  const rep = team.value.report;
  const seq = stageSummaries.value.length + 1;
  const summary = {
    id: `SUM-${String(seq).padStart(2, '0')}`,
    at: new Date().toISOString(),
    by: '主管 Agent',
    progress: rep.progress,
    cost: rep.cost,
    evidence: rep.evidence,
    blockers: team.value.board.blockers.length,
    openItems: rep.openItems,
  };
  stageSummaries.value.unshift(summary);
  MessagePlugin.success(`已生成阶段摘要 ${summary.id}（进度 ${Math.round(summary.progress * 100)}% / 证据 ${summary.evidence} 条 / 未决项 ${summary.openItems.length} 项），见主管摘要卡片`);
}

function pauseAll() {
  team.value.state = 'aborted';
  MessagePlugin.warning('团队已中止：成员任务在安全点停止并落检查点，预算回收至团队池（可恢复）');
}

onMounted(() => {
  window.setTimeout(() => { state.value = team.value ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="团队总览" volume="卷 13" manifest="R-01" cli="oc team show TEAM-checkout-01 --view topology"
      desc="三视图观测：拓扑（成员状态与依赖）/ 时间线（并行泳道）/ 成本瀑布（按成员）；主管摘要给出进度、成本、阻塞与未决项。"
      :status="[{ label: TOPOLOGY_META[team.topology].label, theme: 'primary' }, { label: team.state === 'running' ? '运行中' : team.state === 'completed' ? '已完成' : '已中止', theme: team.state === 'running' ? 'success' : 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="requestStageSummary">请求摘要</Button>
        <Popconfirm content="中止团队会在安全点停止全部成员任务并保留检查点；已合并的产出不回滚（如需回滚请到「隔离与合并」）。" theme="danger" @confirm="pauseAll">
          <Button size="small" theme="danger" variant="outline">中止团队</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">团队：</span>
        <Select v-model="selected" size="small" style="width: 300px" :options="taskData.teams.map((t) => ({ label: `${t.name}（${t.teamId}）`, value: t.teamId }))" />
        <RadioGroup v-model="view" variant="default-filled" size="small">
          <RadioButton value="topology">拓扑视图</RadioButton>
          <RadioButton value="timeline">时间线泳道</RadioButton>
          <RadioButton value="cost">成本瀑布</RadioButton>
        </RadioGroup>
        <Tag size="small" variant="outline">模板 {{ team.templateRef }}</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="成员" :value="stats.members" unit="名" icon="user" />
      <StatCard label="忙碌 / 阻塞" :value="`${stats.busy} / ${stats.blocked}`" icon="robot" :lower-is-better="true" />
      <StatCard label="预算已用" :value="stats.used" format="cost" icon="discount" :target="stats.total" target-kind="max" />
      <StatCard label="团队进度" :value="Math.round(team.report.progress * 100)" unit="%" icon="chart" :target="70" target-kind="min" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有团队" empty-desc="尚未组建团队；单 Agent 任务请使用任务看板。" empty-action="从团队模板组建"
      example-task="从「payment-hardening」模板组建 5 人团队"
      what="团队视图加载失败" why="黑板（事实源）读取失败，主管摘要无法生成"
      how="可重试；黑板恢复前仍可从事件流查看成员状态" trace-id="trace-71e8c0aa"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已打开团队模板')"
    >
      <div class="oc-stack">
        <!-- 拓扑视图 -->
        <div v-if="view === 'topology'" class="oc-card" style="overflow-x: auto">
          <div class="oc-flex--between" style="margin-bottom: 6px">
            <div class="oc-card__title">编排拓扑（{{ TOPOLOGY_META[team.topology].label }}）</div>
            <span class="oc-muted" style="font-size: 12px">{{ TOPOLOGY_META[team.topology].desc }}</span>
          </div>
          <svg :viewBox="`0 0 ${topo.w} 240`" style="min-width: 720px; width: 100%; height: 240px" role="img" aria-label="团队拓扑">
            <rect :x="topo.leadX - 90" :y="topo.leadY" width="180" height="46" rx="8" fill="var(--td-brand-color-light,#e6f0ff)" stroke="var(--td-brand-color,#0052d9)" />
            <text :x="topo.leadX" :y="topo.leadY + 20" text-anchor="middle" font-size="12" fill="var(--td-text-color-primary,#181818)">
              主管 · {{ lead?.name ?? '—' }}
            </text>
            <text :x="topo.leadX" :y="topo.leadY + 36" text-anchor="middle" font-size="10" fill="var(--td-text-color-secondary,#666)">
              分派 / 汇总 / 增量重规划
            </text>

            <line v-for="n in topo.nodes" :key="`e-${n.memberId}`" :x1="topo.leadX" :y1="topo.leadY + 46" :x2="n.x" :y2="n.y" stroke="var(--oc-border-strong,#bbb)" stroke-dasharray="4 3" />

            <g v-for="n in topo.nodes" :key="n.memberId">
              <rect :x="n.x - 70" :y="n.y" width="140" height="42" rx="6" fill="var(--td-bg-color-container,#fff)" :stroke="n.color" stroke-width="1.5" />
              <text :x="n.x" :y="n.y + 18" text-anchor="middle" font-size="11" fill="var(--td-text-color-primary,#181818)">{{ n.name }}</text>
              <text :x="n.x" :y="n.y + 33" text-anchor="middle" font-size="10" fill="var(--td-text-color-secondary,#666)">
                {{ n.type === 'human' ? '人类成员' : 'Agent' }} · {{ n.state }}
              </text>
            </g>
          </svg>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Tag size="small" style="color: var(--td-brand-color)">busy</Tag>
            <Tag size="small" style="color: var(--td-success-color)">completed</Tag>
            <Tag size="small" style="color: var(--oc-sev-warn)">failed</Tag>
            <Tag size="small" style="color: var(--oc-sev-error)">blocked</Tag>
            <Tag size="small" variant="outline">idle</Tag>
          </div>
        </div>

        <!-- 时间线泳道 -->
        <div v-else-if="view === 'timeline'" class="oc-card">
          <div class="oc-card__title">并行泳道（成员 × 当前任务）</div>
          <div v-for="l in lanes" :key="l.member.memberId" class="oc-flex" style="gap: 8px; align-items: center; margin-bottom: 8px">
            <span style="width: 160px; font-size: 12px" class="oc-truncate">{{ l.member.name }}</span>
            <Tag size="small" :theme="l.member.state === 'busy' ? 'primary' : l.member.state === 'blocked' ? 'danger' : 'default'" variant="light-outline">{{ l.member.state }}</Tag>
            <div class="oc-lane">
              <div v-if="l.task" class="oc-lane__bar" :style="{ width: `${Math.max(8, l.task.progress)}%` }">
                {{ l.task.shortId }} {{ l.task.title.slice(0, 14) }}
              </div>
              <span v-else class="oc-muted" style="font-size: 11px">无进行中任务（等待认领或已完成）</span>
            </div>
            <span class="oc-muted" style="font-size: 11px">${{ l.member.used }} / ${{ l.member.quota }}</span>
          </div>
        </div>

        <!-- 成本瀑布 -->
        <div v-else class="oc-card">
          <div class="oc-card__title">成本瀑布（按成员，末项为合计）</div>
          <OcChart type="waterfall" :values="costValues" :height="240" format="cost" aria-label="团队成本瀑布" />
          <div class="oc-secondary" style="font-size: 12px">
            每次模型/工具调用都绑定 teamId/memberId/taskId，因此成本可归因到成员与任务，并可下钻到单次调用。
          </div>
        </div>

        <!-- 主管摘要 -->
        <div class="oc-card">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon name="robot" size="14px" />
            <b>主管摘要（{{ new Date(team.report.publishedAt).toLocaleString('zh-CN') }}）</b>
            <Tag size="small" variant="outline">每 N 分钟自动产出</Tag>
          </div>
          <InfoGrid :columns="2" :items="[
            { key: 'p', label: '进度', value: `${Math.round(team.report.progress * 100)}%（按任务与证据加权）` },
            { key: 'c', label: '成本', value: `$${team.report.cost} / $${team.budget.total}` },
            { key: 'e', label: '证据条目', value: String(team.report.evidence) },
            { key: 'g', label: '团队目标', value: team.goal, span: 2 },
            { key: 'o', label: '未决项', value: team.report.openItems.join('；'), span: 2 },
            { key: 'b', label: '阻塞清单', value: team.board.blockers.map((b) => b.reason).join('；') || '无', span: 2 },
          ]" />
          <!-- 本页立即生成的阶段摘要：落成对象并渲染，不等待周期汇报 -->
          <div v-if="stageSummaries.length" style="margin-top: 8px">
            <div class="oc-card__title">本次生成的阶段摘要（{{ stageSummaries.length }} 份）</div>
            <div v-for="s in stageSummaries" :key="s.id" style="margin-bottom: 6px">
              <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
                <Tag size="small" variant="outline" class="oc-mono">{{ s.id }}</Tag>
                <span style="font-size: 12px">进度 {{ Math.round(s.progress * 100) }}% ｜ 成本 ${{ s.cost }} ｜ 证据 {{ s.evidence }} 条 ｜ 阻塞 {{ s.blockers }} 项</span>
                <span class="oc-muted" style="font-size: 11px">{{ s.by }} · {{ new Date(s.at).toLocaleString('zh-CN') }}</span>
              </div>
              <div class="oc-secondary" style="font-size: 12px">未决项：{{ s.openItems.join('；') }}</div>
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CliHint command="oc team report TEAM-checkout-01 --stage --with-open-items" />
            <CopyableId id="trace-71e8c0aa" label="复制 traceId" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>

<style scoped>
.oc-lane {
  flex: 1;
  height: 22px;
  background: var(--td-bg-color-secondarycontainer, #f5f5f5);
  border-radius: 4px;
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 6px;
}

.oc-lane__bar {
  height: 18px;
  background: var(--td-brand-color, #0052d9);
  color: #fff;
  border-radius: 3px;
  font-size: 11px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
}
</style>
