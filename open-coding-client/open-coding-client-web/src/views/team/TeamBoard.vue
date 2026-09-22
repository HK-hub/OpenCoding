<script setup lang="ts">
/**
 * 团队黑板（R-03）：任务列表 + 证据库 + 决策记录 + 阻塞清单 + 认领登记（防重复）。
 * 溯源：卷 13 D-TEAM-3 中心分配 + 任务池认领（认领需登记防重复）/ §4.1 Board 共享黑板为事实源。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tabs, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { STATUS_META, taskData } from '@/mock/data/task';
import type { BoardBlocker, TeamMessage, WorkItem } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref('TEAM-checkout-01');
const tab = ref('tasks');
const claimError = ref<{ task: WorkItem; holder: string } | null>(null);

/** 结构化消息条数随本页发布/升级动作变化，计数需响应式更新 */
const tabs = computed(() => [
  { value: 'tasks', label: '任务列表' },
  { value: 'evidence', label: '证据库' },
  { value: 'decisions', label: '决策记录' },
  { value: 'blockers', label: '阻塞清单' },
  { value: 'claims', label: '认领登记' },
  { value: 'messages', label: `结构化消息（${teamMessages.value.length}）` },
]);

const team = computed(() => taskData.teams.find((t) => t.teamId === selected.value) ?? taskData.teams[0]);
/** 本页发布/生成的团队消息（公告与升级消息，置顶渲染，计入「结构化消息」条数） */
const localMessages = ref<TeamMessage[]>([]);
/** 结构化消息（本页新增置顶 + 团队既有消息，最新在前） */
const teamMessages = computed(() => [...localMessages.value, ...team.value.messages].sort((a, b) => +new Date(b.at) - +new Date(a.at)));
/** 黑板任务 = 团队参与的任务（按 teamId 或写范围归属） */
const boardTasks = computed(() => taskData.workItems.filter((i) => i.level === 'task').slice(0, 10));
/** 表格行（扁平化，避免 children 字段与表格行类型冲突） */
const boardRows = computed(() => boardTasks.value.map((i) => ({
  itemId: i.itemId, shortId: i.shortId, title: i.title, status: i.status,
  assignee: `${i.assignee.name}（${i.assignee.type}）`, scope: i.writeScope.join(' , '), raw: i,
})));

const columns = [
  { colKey: 'shortId', title: '任务', width: 110 },
  { colKey: 'title', title: '标题' },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'assignee', title: '指派 / 认领', width: 180 },
  { colKey: 'scope', title: '写范围声明', width: 260 },
  { colKey: 'op', title: '操作', width: 120 },
];

function claim(item: WorkItem) {
  if (item.assignee.id.startsWith('agent') || item.assignee.type === 'team') {
    claimError.value = { task: item, holder: item.assignee.name };
    MessagePlugin.error(`认领冲突：${item.shortId} 已被「${item.assignee.name}」持有（认领登记防重复）`);
    return;
  }
  claimError.value = null;
  item.assignee = { type: 'human', id: 'u-chenlm', name: '陈鹿鸣' };
  MessagePlugin.success(`已认领 ${item.shortId}：登记写入黑板（含时间与成员），重复认领会被拒绝`);
}

/** 发布团队公告：生成公告消息（含发起人与时间）并置顶到「结构化消息」 */
function publishAnnouncement() {
  const seq = localMessages.value.length + 1;
  const msg: TeamMessage = {
    msgId: `MSG-ANN-${String(seq).padStart(2, '0')}`,
    type: 'proposal',
    dir: { from: '主管 Agent', to: '团队' },
    payload: {
      kind: '公告',
      subject: '团队公告：合并队列限批 2 并行（即日起生效）',
      publisher: '主管 Agent',
      scope: '团队全体成员',
    },
    at: new Date().toISOString(),
    taskRef: '团队级',
  };
  localMessages.value.unshift(msg);
  tab.value = 'messages';
  MessagePlugin.success(`已发布团队公告 ${msg.msgId}：已置顶到「结构化消息」（共 ${teamMessages.value.length} 条），含发起人与时间`);
}

/** 升级到人类：按阻塞项生成升级消息（blocker → 主管 → 人类，含证据与未决项）并置顶到「结构化消息」 */
function escalateToHuman(b: BoardBlocker) {
  const evidenceRefs = team.value.board.evidence
    .filter((e) => e.taskId === b.taskId)
    .map((e) => `${e.level} ${e.id} ${e.summary}`);
  if (!evidenceRefs.length) evidenceRefs.push('暂无已挂载证据（升级时显式标注）');
  const seq = localMessages.value.length + 1;
  const msg: TeamMessage = {
    msgId: `MSG-ESC-${String(seq).padStart(2, '0')}`,
    type: 'blocker',
    dir: { from: '主管 Agent', to: '人类委托者' },
    payload: {
      task: b.taskId,
      blocker: b.reason,
      waitingOn: b.waitingOn,
      owner: b.owner,
      evidence: evidenceRefs,
      openItems: team.value.report.openItems,
      suggestion: '请人类裁决或授权转派；超时未响应升级至架构评审委员会',
    },
    at: new Date().toISOString(),
    taskRef: b.taskId,
  };
  localMessages.value.unshift(msg);
  tab.value = 'messages';
  MessagePlugin.success(`已生成升级消息 ${msg.msgId}（blocker → 主管 → 人类，含 ${evidenceRefs.length} 条证据），已在「结构化消息」置顶`);
}

/** 结构化消息 payload 值的渲染文本（数组以「、」连接） */
function payloadText(v: string | number | string[]): string {
  return Array.isArray(v) ? v.join('、') : String(v);
}

/** 导出黑板快照：任务/证据/决策/阻塞与页面当前渲染同源，JSON 便于离线核对唯一事实源 */
function exportBoard() {
  const file = downloadJson({
    teamId: selected.value,
    teamName: team.value.name,
    goal: team.value.goal,
    tasks: boardRows.value.map((r) => ({
      itemId: r.itemId, shortId: r.shortId, title: r.title, status: r.status, assignee: r.assignee, scope: r.scope,
    })),
    evidence: team.value.board.evidence,
    decisions: team.value.board.decisions,
    blockers: team.value.board.blockers,
  }, `oc-team-board-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`黑板快照已导出：${file}`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = team.value ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="团队黑板" volume="卷 13" manifest="R-03" cli="oc team board TEAM-checkout-01 --all-sections"
      desc="黑板是团队唯一事实源：任务、证据、决策、阻塞、认领登记全部落在此处（结构化优先，消息按需）。认领需登记，重复认领被拒绝并显示当前持有者。"
      :status="[{ label: '唯一事实源', theme: 'primary' }, { label: `${team.board.blockers.length} 项阻塞`, theme: team.board.blockers.length ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportBoard">导出黑板</Button>
        <Button size="small" theme="primary" @click="publishAnnouncement">发布公告</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">团队：</span>
        <Select v-model="selected" size="small" style="width: 300px" :options="taskData.teams.map((t) => ({ label: `${t.name}（${t.teamId}）`, value: t.teamId }))" />
        <Tag size="small" variant="outline">目标：{{ team.goal }}</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="任务" :value="boardTasks.length" unit="项" icon="task" />
      <StatCard label="证据" :value="team.board.evidence.length" unit="条" icon="file" />
      <StatCard label="决策记录" :value="team.board.decisions.length" unit="条" icon="lightbulb" />
      <StatCard label="阻塞" :value="team.board.blockers.length" unit="项" icon="error" :lower-is-better="true" />
    </div>

    <StateShell
      :state="state"
      empty-title="黑板为空" empty-desc="团队尚未建立计划；主管会先产出任务 DAG 再进入认领。" empty-action="生成计划"
      example-task="由主管分解「统一支付链路口径」为 6 项任务"
      what="黑板读取失败" why="黑板为事实源但存储不可达（Redisson 连接中断）"
      how="可重试；团队运行不受影响（成员继续执行并在恢复后补写）" trace-id="trace-2f90da5b"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已请求主管生成计划')"
    >
      <Tabs v-model="tab" :options="tabs" style="margin-bottom: 10px" />

      <div v-if="claimError" class="oc-card" style="border-color: var(--oc-sev-error); margin-bottom: 10px">
        <div class="oc-flex" style="gap: 6px">
          <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
          <b>认领被拒绝（防重复）</b>
        </div>
        <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
          事实：{{ claimError.task.shortId }} 认领未生效。原因：该任务已由「{{ claimError.holder }}」持有（认领登记时间早于本次请求）。
          动作：与持有者协商转交（handoff 消息），或从任务池挑选其他未认领任务。
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 6px">
          <CopyableId id="trace-2f90da5b" label="复制 traceId" />
          <CliHint command="oc team board claim T-5a31 --as human:chenlm" />
        </div>
      </div>

      <!-- 任务列表 -->
      <div v-if="tab === 'tasks'" class="oc-card">
        <Table :data="boardRows" row-key="itemId" size="small" :pagination="undefined" :columns="columns">
          <template #shortId="{ row }"><span class="oc-mono">{{ row.shortId }}</span></template>
          <template #status="{ row }">
            <Tag size="small" :theme="STATUS_META[row.status as keyof typeof STATUS_META].theme" variant="light-outline">{{ STATUS_META[row.status as keyof typeof STATUS_META].label }}</Tag>
          </template>
          <template #assignee="{ row }"><span style="font-size: 12px">{{ row.assignee }}</span></template>
          <template #scope="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.scope }}</span></template>
          <template #op="{ row }">
            <Button size="small" variant="text" @click="claim(row.raw as WorkItem)">认领</Button>
          </template>
        </Table>
      </div>

      <!-- 证据库 -->
      <div v-else-if="tab === 'evidence'" class="oc-card">
        <div v-for="e in team.board.evidence" :key="e.id" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 8px">
          <Tag size="small" variant="outline" class="oc-mono">{{ e.level }}</Tag>
          <Tag size="small" variant="light-outline" class="oc-mono">{{ e.taskId }}</Tag>
          <span style="font-size: 12px">{{ e.summary }}</span>
          <span class="oc-muted" style="font-size: 11px">{{ e.by }} · {{ new Date(e.at).toLocaleString('zh-CN') }}</span>
        </div>
        <div v-if="!team.board.evidence.length" class="oc-muted" style="font-size: 12px">暂无证据（成员产出后自动挂载）。</div>
      </div>

      <!-- 决策记录 -->
      <div v-else-if="tab === 'decisions'" class="oc-card">
        <div v-for="d in team.board.decisions" :key="d.id" style="margin-bottom: 10px">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Tag size="small" variant="outline" class="oc-mono">{{ d.id }}</Tag>
            <b style="font-size: 12px">{{ d.text }}</b>
            <span class="oc-muted" style="font-size: 11px">{{ d.by }} · {{ new Date(d.at).toLocaleString('zh-CN') }}</span>
          </div>
          <div class="oc-secondary" style="font-size: 12px">影响：{{ d.impact }}</div>
        </div>
      </div>

      <!-- 阻塞清单 -->
      <div v-else-if="tab === 'blockers'" class="oc-card">
        <div v-for="b in team.board.blockers" :key="b.id" class="oc-card" style="margin-bottom: 8px; border-color: var(--oc-sev-warn)">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <OcIcon name="error" size="13px" color="var(--oc-sev-warn)" />
            <Tag size="small" variant="outline" class="oc-mono">{{ b.taskId }}</Tag>
            <b style="font-size: 12px">{{ b.reason }}</b>
          </div>
          <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
            负责人 {{ b.owner }}｜等待对象：{{ b.waitingOn }}｜持续 {{ Math.round((Date.now() - +new Date(b.since)) / 3_600_000) }} 小时
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <Button size="small" variant="outline" @click="escalateToHuman(b)">升级到人类</Button>
            <Popconfirm content="解除阻塞需记录解除证据（如设备池释放、权限获批）；无证据的解除会被拒绝。" theme="warning" @confirm="MessagePlugin.success(`已解除阻塞 ${b.id}（附解除证据）`)">
              <Button size="small" variant="outline">解除并附证据</Button>
            </Popconfirm>
          </div>
        </div>
        <div v-if="!team.board.blockers.length" class="oc-muted" style="font-size: 12px">无阻塞项。</div>
      </div>

      <!-- 认领登记 -->
      <div v-else-if="tab === 'claims'" class="oc-card">
        <div class="oc-card__title">认领登记（防重复的事实记录）</div>
        <InfoGrid :columns="1" :items="boardTasks.slice(0, 6).map((t) => ({
          key: `${t.shortId}-claim`,
          label: `${t.shortId} ${t.title}`,
          value: `${t.assignee.name}（${t.assignee.type}）· ${t.stateHistory[1] ? new Date(t.stateHistory[1].at).toLocaleString('zh-CN') : '未认领'}`,
        }))" />
        <div class="oc-flex" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc team board claims --explain-duplicates" />
          <CopyableId id="trace-2f90da5b" label="复制 traceId" />
        </div>
      </div>

      <!-- 结构化消息 -->
      <div v-else class="oc-card">
        <div class="oc-card__title">结构化消息（{{ teamMessages.length }} 条，最新在前）</div>
        <div v-for="m in teamMessages" :key="m.msgId" class="oc-card" style="margin-bottom: 8px">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Tag size="small" variant="outline" class="oc-mono">{{ m.msgId }}</Tag>
            <Tag size="small" variant="light-outline">{{ m.type }}</Tag>
            <b style="font-size: 12px">{{ m.dir.from }} → {{ m.dir.to }}</b>
            <Tag size="small" variant="outline" class="oc-mono">{{ m.taskRef }}</Tag>
            <span class="oc-muted" style="font-size: 11px">{{ new Date(m.at).toLocaleString('zh-CN') }}</span>
          </div>
          <div v-for="(v, k) in m.payload" :key="`${m.msgId}-${k}`" class="oc-secondary" style="font-size: 12px; margin-top: 2px">
            {{ k }}：{{ payloadText(v) }}
          </div>
        </div>
        <div v-if="!teamMessages.length" class="oc-muted" style="font-size: 12px">暂无结构化消息。</div>
      </div>
    </StateShell>
  </div>
</template>
