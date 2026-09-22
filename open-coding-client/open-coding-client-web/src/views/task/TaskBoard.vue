<script setup lang="ts">
/**
 * 任务看板（J-01）：七态列 + 拖拽改状态（非法迁移拒绝并给理由）+ 证据驱动验收进度环 + 阻塞原因内联。
 * 溯源：卷 14 §4.2 状态机 / §4.6 看板视图。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import {
  LEGAL_TRANSITIONS, PRIORITY_META, STATUS_META, STATUS_ORDER, TRANSITION_DENY_REASON, taskData,
} from '@/mock/data/task';
import type { WorkItem, WorkItemStatus } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const limit = ref(12);
const dragging = ref<WorkItem | null>(null);
const lastReject = ref<{ from: WorkItemStatus; to: WorkItemStatus; item: WorkItem; reason: string } | null>(null);
const traceId = 'trace-9f31c0ad';

/** 本页从模板新建的任务（页内状态）：与领域数据合并渲染，列头计数与统计卡即时反映 */
const localItems = ref<WorkItem[]>([]);

/** 看板只承载 Task 层（Goal/Plan 在树视图与时间线呈现）；本页新建项置顶展示 */
const cards = computed(() => [...localItems.value, ...taskData.workItems].filter((i) => i.level === 'task'));
const visible = computed(() => cards.value.slice(0, limit.value));

const columns = computed(() => STATUS_ORDER.map((code) => ({
  code,
  meta: STATUS_META[code],
  items: visible.value.filter((i) => i.status === code),
})));

const stats = computed(() => {
  const byStatus = (s: WorkItemStatus) => cards.value.filter((i) => i.status === s).length;
  const doneItems = cards.value.filter((i) => i.status === 'done' && i.cycleHours);
  const avgCycle = doneItems.length ? doneItems.reduce((a, b) => a + (b.cycleHours ?? 0), 0) / doneItems.length : 0;
  return {
    total: cards.value.length,
    inProgress: byStatus('in_progress'),
    blocked: byStatus('blocked'),
    review: byStatus('in_review'),
    doneRatio: Math.round((byStatus('done') / Math.max(1, cards.value.length)) * 100),
    avgCycleHours: Number(avgCycle.toFixed(1)),
  };
});

function budgetWaterline(item: WorkItem): number {
  return Math.min(100, Math.round((item.budget.usedCost / Math.max(0.01, item.budget.cost)) * 100));
}

/** 拖拽改状态：非法迁移必须拒绝并解释（卷 14 DoD：非法迁移拒绝与理由记录） */
function onDrop(to: WorkItemStatus) {
  const item = dragging.value;
  dragging.value = null;
  if (!item || item.status === to) return;
  if (!LEGAL_TRANSITIONS[item.status].includes(to)) {
    const reason = TRANSITION_DENY_REASON[to] ?? '该迁移不在七态状态机允许范围内。';
    lastReject.value = { from: item.status, to, item, reason };
    MessagePlugin.error(`${item.shortId}：${STATUS_META[item.status].label} → ${STATUS_META[to].label} 被拒绝`);
    ui.track('workitem.transition.rejected', { from: item.status, to, item: item.shortId });
    return;
  }
  item.stateHistory.push({
    from: item.status, to, actor: '沈亦舟', reason: '看板拖拽变更（人工）', at: new Date().toISOString(),
  });
  item.status = to;
  if (to === 'done' && item.evidence.length === 0) {
    item.status = 'in_review';
    MessagePlugin.warning('已完成必须附证据：本次拖拽已回退为「待验收」并生成缺失证据清单');
    return;
  }
  MessagePlugin.success(`${item.shortId} 已迁移为「${STATUS_META[to].label}」，事件已写入主事件流`);
}

function claim(item: WorkItem) {
  item.assignee = { type: 'agent', id: 'agent-impl-01', name: '实现者 · 落霞' };
  MessagePlugin.success(`已认领 ${item.shortId}（认领登记在黑板，防重复认领）`);
}

function openDetail(item: WorkItem) {
  window.location.hash = `#/task/detail?workItem=${item.shortId}`;
}

function reload() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = 'NORMAL'; }, 260);
}

function loadMore() {
  limit.value = cards.value.length;
  state.value = 'NORMAL';
}

/** 导出看板快照：任务卡（含阻塞原因与验收证据）与统计全部与页面同源 */
function exportSnapshot() {
  const file = downloadJson({
    stats: stats.value,
    criticalPath: taskData.criticalPath,
    tasks: cards.value,
  }, `oc-task-board-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`看板快照已导出：${file}`);
}

/** 模板实例化序号：生成不与既有短号冲突的编号（T-BF01、T-BF02…） */
let templateSeq = 0;

/** 从模板 TPL-BUGFIX 新建任务：以任务域现有条目为基线克隆并改写，落入「待规划」列等待归入计划与指派 */
function createFromTemplate() {
  const base = taskData.workItems.find((i) => i.level === 'task');
  if (!base) {
    MessagePlugin.error('任务域暂无 Task 层条目，无法从模板新建');
    return;
  }
  templateSeq += 1;
  const shortId = `T-BF${String(templateSeq).padStart(2, '0')}`;
  const now = new Date().toISOString();
  const item: WorkItem = {
    ...base,
    itemId: `wi-${shortId.toLowerCase()}`,
    shortId,
    parentId: null,
    title: `修 Bug：待补充缺陷现象（模板 TPL-BUGFIX）`,
    description: '由模板 TPL-BUGFIX 实例化：复现 → 定位 → 最小修复 → 回归。尚未归入计划与指派，确认后再进入可执行。',
    acceptance: base.acceptance.slice(0, 3).map((a, i) => ({ ...a, id: `${shortId}-A${i + 1}`, verdict: 'pending', evidenceRefs: [] })),
    evidence: [],
    progress: 0,
    dependsOn: [],
    criticalPath: [],
    assignee: { type: 'human', id: 'u-unassigned', name: '未指派' },
    priority: 'NORMAL',
    specRef: null,
    status: 'backlog',
    stateHistory: [{ from: '—', to: 'backlog', actor: '沈亦舟', reason: '从模板 TPL-BUGFIX 创建（待归入计划并指派）', at: now }],
    children: [],
    tags: [...(base.tags ?? []), 'template', 'TPL-BUGFIX'],
  };
  // 新建项置顶并放开折叠阈值：保证新卡片在「待规划」列可见（不因 limit 截断被隐藏）
  localItems.value.unshift(item);
  limit.value = Math.max(limit.value, cards.value.length);
  MessagePlugin.success(`已从模板 TPL-BUGFIX 创建 ${shortId}：落入「待规划」列（${item.acceptance.length} 条验收清单，未指派），任务总数 ${stats.value.total} 项`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = cards.value.length === 0 ? 'EMPTY' : cards.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
  }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="任务看板" volume="卷 14" manifest="J-01" cli="oc task board --assignee me --level task"
      desc="七态列（优先级/指派/预算可见）；拖拽改状态走七态状态机，非法迁移拒绝并给出理由；进度由验收证据驱动，done 无证据即非法。"
      :status="[{ label: '证据驱动进度', theme: 'primary' }, { label: '非法迁移拒绝', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportSnapshot">导出快照</Button>
        <Button size="small" theme="primary" @click="createFromTemplate">新建任务</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="任务总数" :value="stats.total" unit="项" icon="task" hint="仅 Task 层，Goal/Plan 见工作对象树" />
      <StatCard label="进行中" :value="stats.inProgress" unit="项" icon="loading" />
      <StatCard label="阻塞" :value="stats.blocked" unit="项" icon="error" :lower-is-better="true" hint="阻塞必须内联原因与等待对象" />
      <StatCard label="平均周期" :value="stats.avgCycleHours" unit="小时" icon="time" :target="24" target-kind="max" />
    </div>

    <StateShell
      :state="state" :page-size="limit"
      collapsed-summary="任务数超过看板渲染阈值（12 项），已按状态列折叠展示；折叠不丢数据，可加载更多。"
      empty-title="当前项目没有任务" empty-desc="任务尚未分解，或过滤条件下没有命中项。" empty-action="从模板创建任务"
      example-task="为 handleRetry 增加幂等校验（模板：修 Bug）"
      :what="'看板投影构建失败'" :why="'任务快照与事件流校验不一致（快照 12 项 / 事件重建 13 项）'" :how="'可重试；若持续失败请导出诊断包并附 traceId'"
      :trace-id="traceId" @retry="reload"
      @load-more="loadMore"
      @empty-action="MessagePlugin.info('已打开模板库')"
      @cancel="MessagePlugin.info('已取消看板重建，保留上次快照')"
    >
      <div v-if="lastReject" class="oc-card" style="border-color: var(--oc-sev-error); margin-bottom: 10px">
        <div class="oc-flex" style="gap: 6px">
          <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
          <b>迁移被拒绝：{{ lastReject.item.shortId }}</b>
          <Tag size="small" theme="danger" variant="light-outline">
            {{ STATUS_META[lastReject.from].label }} → {{ STATUS_META[lastReject.to].label }}
          </Tag>
        </div>
        <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ lastReject.reason }}</div>
        <div class="oc-flex" style="gap: 8px; margin-top: 6px">
          <CliHint :command="`oc task transition ${lastReject.item.shortId} --to ${lastReject.to} --force --reason '<理由>'`" label="等价命令（需理由）" />
          <CopyableId id="trace-9f31c0ad" label="复制拒绝记录" />
        </div>
      </div>

      <div class="oc-board">
        <section
          v-for="col in columns" :key="col.code" class="oc-board__col"
          @dragover.prevent @drop="onDrop(col.code)"
        >
          <header class="oc-board__col-head">
            <Tag :theme="col.meta.theme" variant="light-outline" size="small">{{ col.meta.label }}</Tag>
            <span class="oc-muted oc-mono">{{ col.items.length }}</span>
          </header>

          <article
            v-for="item in col.items" :key="item.itemId" class="oc-board__card" draggable="true"
            @dragstart="dragging = item"
          >
            <div class="oc-flex--between" style="align-items: flex-start">
              <span class="oc-mono oc-muted" style="font-size: 11px">{{ item.shortId }}</span>
              <Tag :theme="PRIORITY_META[item.priority].theme" size="small" variant="light-outline">
                {{ PRIORITY_META[item.priority].label }}
              </Tag>
            </div>
            <div style="font-size: 13px; font-weight: 600; margin: 2px 0 6px">{{ item.title }}</div>

            <div class="oc-flex" style="gap: 8px">
              <Progress theme="circle" :percentage="item.progress" :size="34" :stroke-width="4" />
              <div class="oc-grow" style="min-width: 0">
                <div class="oc-flex oc-muted" style="gap: 4px; font-size: 11px">
                  <OcIcon name="user" size="12px" /> {{ item.assignee.name }}
                </div>
                <div class="oc-muted" style="font-size: 11px">预算 ${{ item.budget.usedCost }} / ${{ item.budget.cost }}</div>
                <div class="oc-board__bar"><i :style="{ width: `${budgetWaterline(item)}%` }" /></div>
              </div>
            </div>

            <div v-if="item.blockedReason" class="oc-board__blocked">
              <OcIcon name="error" size="12px" /> {{ item.blockedReason }}
            </div>
            <div v-if="item.acceptance.some((a) => a.verdict === 'unverifiable')" class="oc-flex" style="gap: 4px; margin-top: 6px">
              <Tag size="small" theme="warning" variant="outline">含未验证项</Tag>
              <Tag size="small" variant="outline">未验证项不计入进度</Tag>
            </div>

            <div class="oc-flex" style="gap: 4px; margin-top: 6px; justify-content: flex-end">
              <Tooltip content="推进到下一合法状态（等价 CLI 见页头）">
                <Button size="small" variant="text" @click="claim(item)">认领</Button>
              </Tooltip>
              <Button size="small" variant="text" @click="openDetail(item)">详情</Button>
            </div>
          </article>
        </section>
      </div>

      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
        <Tag size="small" variant="outline">已完成 {{ stats.doneRatio }}%</Tag>
        <Tag size="small" variant="outline">待验收 {{ stats.review }}</Tag>
        <CliHint command="oc task list --tree --show-blocked" label="CLI：树形列表（含阻塞原因内联）" />
      </div>
    </StateShell>
  </div>
</template>

<style scoped>
.oc-board {
  display: grid;
  grid-template-columns: repeat(7, minmax(168px, 1fr));
  gap: 8px;
  overflow-x: auto;
}

.oc-board__col {
  background: var(--td-bg-color-secondarycontainer, #f5f5f5);
  border-radius: 6px;
  padding: 6px;
  min-height: 180px;
}

.oc-board__col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.oc-board__card {
  background: var(--td-bg-color-container, #fff);
  border: 1px solid var(--oc-border);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
  cursor: grab;
}

.oc-board__card:active {
  cursor: grabbing;
}

.oc-board__blocked {
  margin-top: 6px;
  font-size: 11px;
  color: var(--oc-sev-error);
  background: var(--td-error-color-1, #fff0ed);
  border-radius: 4px;
  padding: 4px 6px;
  display: flex;
  gap: 4px;
}

.oc-board__bar {
  height: 3px;
  border-radius: 2px;
  background: var(--td-bg-color-secondarycontainer, #eee);
  overflow: hidden;
}

.oc-board__bar i {
  display: block;
  height: 100%;
  background: var(--td-brand-color, #0052d9);
}
</style>
