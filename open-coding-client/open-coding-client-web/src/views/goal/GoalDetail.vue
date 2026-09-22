<script setup lang="ts">
/**
 * 目标详情（X-03）：六 Tab（概览/验收标准与证据/Tick 时间线/汇报/预算与成本/介入点）+ 暂停恢复撤销 + 介入点等待态。
 * 溯源：卷 15 §4.2 自治循环（Tick 模型）/ §4.3 达成判定 / §4.5 无人值守安全。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Progress, Select, Switch, Table, Tabs, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { AUTONOMY_META, GOAL_STATUS_META, taskData } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const router = useRouter();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const tab = ref('overview');
const selected = ref(taskData.goals[1]?.shortId ?? taskData.goals[0].shortId);
const nodeReportOn = ref(true);

const tabs = [
  { value: 'overview', label: '概览' },
  { value: 'criteria', label: '验收标准与证据' },
  { value: 'ticks', label: 'Tick 时间线' },
  { value: 'report', label: '汇报' },
  { value: 'budget', label: '预算与成本' },
  { value: 'intervention', label: '介入点' },
];

const goal = computed(() => taskData.goals.find((g) => g.shortId === selected.value) ?? taskData.goals[0]);
const waiting = computed(() => goal.value.interventionPoints.find((p) => p.state === 'waiting'));
const costSeries = computed(() => [{
  name: '累计成本（USD）',
  points: goal.value.ticks.map((t) => ({ x: `T${t.tickNo}`, y: t.cost })),
}]);
const budgetPct = computed(() => Math.min(100, Math.round((goal.value.costTotal / Math.max(0.01, goal.value.budget.cost)) * 100)));

function togglePause() {
  goal.value.status = goal.value.status === 'paused' ? 'started' : 'paused';
  MessagePlugin.success(goal.value.status === 'paused' ? '目标已暂停：Tick 停止，检查点与证据保留' : '目标已恢复：下一 Tick 将重算关键路径');
}

function revoke() {
  goal.value.status = 'cancelled';
  MessagePlugin.warning('目标已撤销（终止条件 revoke）：生成终止报告并通知相关成员');
}

function resolveWaiting(ok: boolean) {
  const p = waiting.value;
  if (!p) return;
  p.state = ok ? 'passed' : 'pending';
  MessagePlugin.success(ok ? `介入点「${p.name}」已确认，Tick 恢复推进` : `介入点「${p.name}」已驳回：Tick 保持暂停并生成待办`);
}

/** 手动生成的周期汇报记录（生成后进入「最近汇报」时间线，并落盘为可下载文件） */
const manualReports = ref<{ id: string; goalId: string; at: string; channels: string; filename: string; summary: string }[]>([]);
let reportSeq = 0;

/** 当前目标的手动汇报（按目标隔离，切换目标后各自展示） */
const currentReports = computed(() => manualReports.value.filter((r) => r.goalId === goal.value.shortId));

/** 生成周期汇报并推送：真实生成汇报文件下载，同时写入「最近汇报」时间线（页面可见） */
function generateReport() {
  const at = new Date();
  const goalId = goal.value.shortId;
  const filename = `oc-goal-report-${goalId}-${at.toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson(
    {
      goalId,
      objective: goal.value.objective,
      progressRatio: goal.value.progressRatio,
      ticksTotal: goal.value.ticksTotal,
      costTotal: goal.value.costTotal,
      budgetCost: goal.value.budget.cost,
      acceptanceCriteria: goal.value.acceptanceCriteria,
      interventionPoints: goal.value.interventionPoints,
      reportingPolicy: goal.value.reportingPolicy,
      generatedAt: at.toISOString(),
    },
    filename,
  );
  reportSeq += 1;
  manualReports.value.unshift({
    id: `rep-${reportSeq}`,
    goalId,
    at: at.toLocaleString('zh-CN'),
    channels: goal.value.reportingPolicy.channels.join('、'),
    filename,
    summary: `进度 ${Math.round(goal.value.progressRatio * 100)}%（较上次 +0%）；成本 $${goal.value.costTotal} / $${goal.value.budget.cost}；Tick ${goal.value.ticksTotal} 次；阻塞 1 项（设备池排期）。`,
  });
  MessagePlugin.info(`已生成周期汇报并推送至配置渠道（${filename}）`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = goal.value ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`目标详情 · ${goal.shortId}`" volume="卷 15" manifest="X-03"
      :cli="`oc goal show ${goal.shortId} --with-ticks --with-budget`"
      :desc="goal.objective"
      :status="[
        { label: GOAL_STATUS_META[goal.status].label, theme: GOAL_STATUS_META[goal.status].theme },
        { label: AUTONOMY_META[goal.autonomyLevel].label, theme: 'primary' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="togglePause">{{ goal.status === 'paused' ? '恢复' : '暂停' }}</Button>
        <Button size="small" variant="outline" @click="generateReport">生成汇报</Button>
        <Popconfirm content="撤销会触发终止条件 revoke：Tick 停止、成员预算回收、生成终止报告；已产出证据保留但目标不可再推进。" theme="danger" @confirm="revoke">
          <Button size="small" theme="danger" variant="outline">撤销目标</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">切换目标：</span>
        <Select v-model="selected" size="small" style="width: 360px" :options="taskData.goals.map((g) => ({ label: `${g.shortId} ${g.objective.slice(0, 18)}…`, value: g.shortId }))" />
        <Tag v-if="goal.driftFlag" size="small" theme="danger" variant="light-outline">漂移告警中</Tag>
        <Tag size="small" variant="outline">{{ goal.ticksTotal }} ticks · {{ goal.owner }}</Tag>
        <Progress :percentage="Math.round(goal.progressRatio * 100)" theme="circle" :size="30" :stroke-width="4" />
      </div>
    </div>

    <!-- 介入点等待态：阻塞式横幅（不确认不放行） -->
    <div v-if="waiting" class="oc-card" style="border-color: var(--oc-sev-warn); margin-bottom: 10px">
      <div class="oc-flex" style="gap: 6px">
        <OcIcon name="secured" size="14px" color="var(--oc-sev-warn)" />
        <b>等待人工确认：{{ waiting.name }}</b>
        <Tag size="small" theme="warning" variant="light-outline">mode=block · Tick 已暂停</Tag>
      </div>
      <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
        触发时机：{{ waiting.when }}；请求于 {{ waiting.requestedAt ? new Date(waiting.requestedAt).toLocaleString('zh-CN') : '刚刚' }} 发起。
        无人确认时 Tick 不会自行放行（无人值守安全模型：越界即停）。
      </div>
      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 6px">
        <Button size="small" theme="primary" @click="resolveWaiting(true)">确认并继续</Button>
        <Popconfirm content="驳回会让目标保持暂停并生成待办；不会自动改走其他路径（避免静默降级）。" theme="warning" @confirm="resolveWaiting(false)">
          <Button size="small" variant="outline">驳回</Button>
        </Popconfirm>
        <CliHint :command="`oc goal intervene ${goal.shortId} --point ${waiting.id} --confirm`" />
      </div>
    </div>

    <StateShell
      :state="state"
      empty-title="目标不存在或已归档" empty-desc="目标编号未命中；已完成目标保留 90 天后归档。" empty-action="返回目标列表"
      example-task="选择任一目标查看 Tick 与证据"
      what="目标详情加载失败" why="Tick 事件序列存在空洞（事件保留期外），无法完整重建"
      how="可重试；或降级为快照视图（标注数据缺口）" trace-id="trace-8e12bc44"
      @retry="state = 'LOADING'" @empty-action="router.push('/goal/list')"
    >
      <Tabs v-model="tab" :options="tabs" style="margin-bottom: 10px" />

      <!-- 概览 -->
      <div v-if="tab === 'overview'" class="oc-stack">
        <div class="oc-grid oc-grid--4">
          <StatCard label="进度（验收驱动）" :value="Math.round(goal.progressRatio * 100)" unit="%" icon="chart" />
          <StatCard label="累计成本" :value="goal.costTotal" format="cost" icon="discount" :target="goal.budget.cost" target-kind="max" />
          <StatCard label="Tick 次数" :value="goal.ticksTotal" unit="次" icon="refresh" />
          <StatCard label="漂移" :value="goal.driftFlag ? '命中' : '正常'" icon="error" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">目标契约</div>
          <InfoGrid :columns="2" :items="[
            { key: 'obj', label: '目标陈述', value: goal.objective, span: 2 },
            { key: 'metric', label: '结构化指标', value: goal.acceptanceCriteria.length + ' 条验收标准' },
            { key: 'plan', label: '当前计划', value: goal.planRef.title },
            { key: 'auto', label: '自治级别', value: AUTONOMY_META[goal.autonomyLevel].label, hint: AUTONOMY_META[goal.autonomyLevel].desc },
            { key: 'ws', label: '工作区', value: goal.workspace, mono: true },
            { key: 'next', label: '下次 Tick', value: new Date(goal.nextTickAt).toLocaleString('zh-CN') },
            { key: 'last', label: '上次 Tick', value: new Date(goal.lastTickAt).toLocaleString('zh-CN') },
            { key: 'cons', label: '约束', value: goal.constraints.join('；'), span: 2 },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">成本累计</div>
          <OcChart type="area" :series="costSeries" :height="180" format="cost" :threshold="{ value: goal.budget.cost, label: `预算上限 $${goal.budget.cost}`, kind: 'max' }" aria-label="目标累计成本曲线" />
        </div>
      </div>

      <!-- 验收标准与证据 -->
      <div v-else-if="tab === 'criteria'" class="oc-stack">
        <div v-for="c in goal.acceptanceCriteria" :key="c.id" class="oc-card">
          <div class="oc-flex--between">
            <b style="font-size: 13px">{{ c.text }}</b>
            <Tag size="small" :theme="c.verdict === 'pass' ? 'success' : c.verdict === 'fail' ? 'danger' : c.verdict === 'unverifiable' ? 'warning' : 'default'" variant="light-outline">
              {{ c.verdict === 'pass' ? '已满足' : c.verdict === 'fail' ? '未满足' : c.verdict === 'unverifiable' ? '无法验证' : '待验证' }}
            </Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">验证方式：{{ c.verifyMethod }}</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 4px">
            <Tag v-for="e in c.evidenceRefs" :key="e" size="small" variant="outline" class="oc-mono">{{ e }}</Tag>
            <Tag v-if="!c.evidenceRefs.length" size="small" theme="warning" variant="light-outline">无证据：不可判定为达成</Tag>
          </div>
        </div>
      </div>

      <!-- Tick 时间线 -->
      <div v-else-if="tab === 'ticks'" class="oc-card">
        <div class="oc-card__title">Tick 时间线（定时 / 事件 / 手动唤醒）</div>
        <Timeline>
          <TimelineItem v-for="t in [...goal.ticks].reverse()" :key="t.tickNo" :label="`#${t.tickNo} · ${new Date(t.at).toLocaleString('zh-CN')}`">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" variant="outline">{{ t.wake }}唤醒</Tag>
              <span style="font-size: 12px">{{ t.action }}</span>
              <Tag size="small" variant="outline">进度 {{ t.progress }}%</Tag>
              <Tag size="small" variant="outline">${{ t.cost }}</Tag>
            </div>
            <div class="oc-secondary" style="font-size: 12px">{{ t.note }}</div>
          </TimelineItem>
        </Timeline>
      </div>

      <!-- 汇报 -->
      <div v-else-if="tab === 'report'" class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">汇报策略</div>
          <InfoGrid :columns="2" :items="[
            { key: 'node', label: '节点汇报触发', value: goal.reportingPolicy.nodeChannel.join('、') },
            { key: 'period', label: '周期汇报', value: goal.reportingPolicy.periodicInterval },
            { key: 'end', label: '结束汇报', value: goal.reportingPolicy.endReport, span: 2 },
            { key: 'ch', label: '渠道', value: goal.reportingPolicy.channels.join('、'), span: 2 },
          ]" />
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <span class="oc-secondary" style="font-size: 12px">节点汇报开关</span>
            <Switch v-model="nodeReportOn" size="small" />
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">最近汇报</div>
          <Timeline>
            <!-- 手动生成的周期汇报：生成即出现在时间线，并附可下载文件名与推送渠道 -->
            <TimelineItem v-for="r in currentReports" :key="r.id" :label="r.at">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
                <b style="font-size: 12px">周期汇报（手动触发）</b>
                <Tag size="small" theme="primary" variant="light-outline">已推送：{{ r.channels }}</Tag>
              </div>
              <div class="oc-secondary" style="font-size: 12px">{{ r.summary }}</div>
              <div class="oc-muted oc-mono" style="font-size: 11px">文件：{{ r.filename }}</div>
            </TimelineItem>
            <TimelineItem :label="new Date(goal.lastTickAt).toLocaleString('zh-CN')">
              <b style="font-size: 12px">周期汇报（自动）</b>
              <div class="oc-secondary" style="font-size: 12px">
                进度 {{ Math.round(goal.progressRatio * 100) }}%（较上次 +4%）；成本 ${{ goal.costTotal }}；阻塞 1 项（设备池排期）；无风险事件。
              </div>
            </TimelineItem>
            <TimelineItem :label="new Date(goal.createdAt).toLocaleString('zh-CN')">
              <b style="font-size: 12px">启动汇报</b>
              <div class="oc-secondary" style="font-size: 12px">目标契约已确认，Tick 循环启动；预算 ${{ goal.budget.cost }}（硬上限）。</div>
            </TimelineItem>
          </Timeline>
        </div>
      </div>

      <!-- 预算与成本 -->
      <div v-else-if="tab === 'budget'" class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">预算与成本</div>
          <div style="font-size: 22px; font-weight: 600">${{ goal.costTotal }}<span class="oc-muted" style="font-size: 13px"> / ${{ goal.budget.cost }}</span></div>
          <Progress :percentage="budgetPct" :status="budgetPct > 80 ? 'warning' : 'success'" />
          <InfoGrid :columns="2" :items="[
            { key: 'tk', label: 'Token 上限', value: goal.budget.tokens.toLocaleString('zh-CN') },
            { key: 'tc', label: '工具调用上限', value: goal.budget.toolCalls.toLocaleString('zh-CN') },
            { key: 'dur', label: '时长上限', value: `${Math.round(goal.budget.durationMs / 86_400_000)} 天` },
            { key: 'iter', label: '最多迭代步数', value: String(goal.budget.maxIterations) },
          ]" />
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <Tag size="small" theme="warning" variant="light-outline">周期汇报本身计入预算</Tag>
            <CliHint :command="`oc goal budget ${goal.shortId} --extend 10 --reason '<理由>'`" />
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">消耗率预警</div>
          <OcChart type="line" :series="costSeries" :height="160" format="cost" :threshold="{ value: goal.budget.cost * 0.8, label: '80% 预警线', kind: 'max' }" aria-label="目标成本消耗率" />
        </div>
      </div>

      <!-- 介入点 -->
      <div v-else class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">介入点（必须人工确认的节点）</div>
          <div v-for="p in goal.interventionPoints" :key="p.id" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 8px">
            <OcIcon :name="p.state === 'passed' ? 'check' : p.state === 'waiting' ? 'time' : 'flag'" size="13px"
              :color="p.state === 'waiting' ? 'var(--oc-sev-warn)' : undefined" />
            <b style="font-size: 13px">{{ p.name }}</b>
            <Tag size="small" variant="outline">{{ p.mode === 'block' ? '阻塞式（不放行）' : '仅通知' }}</Tag>
            <Tag size="small" :theme="p.state === 'passed' ? 'success' : p.state === 'waiting' ? 'warning' : 'default'" variant="light-outline">
              {{ p.state === 'passed' ? '已确认' : p.state === 'waiting' ? '等待人工确认' : '未到达' }}
            </Tag>
            <span class="oc-muted" style="font-size: 12px">{{ p.when }}</span>
          </div>
          <div class="oc-secondary" style="font-size: 12px">
            介入点是「计划性的找人」；随时插话/接管能力不受此限制（卷 12 介入控制条）。
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">终止条件</div>
          <div v-for="t in goal.termination" :key="t.kind" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 6px">
            <Tag size="small" :theme="t.triggered ? 'danger' : 'default'" variant="light-outline">{{ t.triggered ? '已触发' : '未触发' }}</Tag>
            <span style="font-size: 12px">{{ t.condition }}</span>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CliHint :command="`oc goal termination ${goal.shortId} --list`" />
            <CopyableId id="trace-8e12bc44" label="复制 traceId" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
