<script setup lang="ts">
/**
 * 抢占与恢复（J-09）：优先级排序列表 + 安全点抢占 + 检查点恢复 + 理由记录（全部留痕）。
 * 溯源：卷 14 D-TASK-11 优先级 + 可中断点抢占（抢占仅发生在安全点，保留检查点与理由）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Table, Tag, Timeline, TimelineItem, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { PRIORITY_META, STATUS_META, taskData } from '@/mock/data/task';
import type { PreemptionRecord, Priority, WorkItem } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const records = ref<PreemptionRecord[]>(taskData.preemptions.map((p) => ({ ...p })));
const reasonOpen = ref(false);
const reason = ref('发布窗口提前 24 小时，回归批次需独占设备池与合并队列。');
const pendingRecord = ref<PreemptionRecord | null>(null);
const paused = ref(false);

const priorityRank: Record<Priority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

/** 可被抢占的排序视图：优先级（升序）→ 进度（升序，避免浪费已完成工作） */
const queue = computed<WorkItem[]>(() => taskData.workItems
  .filter((i) => i.status === 'in_progress' || i.status === 'ready' || i.status === 'blocked')
  .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.progress - b.progress));

/** 表格行（扁平化，避免 WorkItem.children 与表格行类型冲突） */
const queueRows = computed(() => queue.value.map((i) => ({
  itemId: i.itemId, shortId: i.shortId, title: i.title, priority: i.priority,
  status: i.status, progress: i.progress, assignee: i.assignee.name, raw: i,
})));

const stats = computed(() => ({
  preempted: records.value.filter((r) => r.state === 'preempted').length,
  waiting: records.value.filter((r) => r.state === 'waiting_safe_point').length,
  resumed: records.value.filter((r) => r.state === 'resumed').length,
  rejected: records.value.filter((r) => r.state === 'rejected').length,
}));

const columns = [
  { colKey: 'shortId', title: '任务', width: 110 },
  { colKey: 'title', title: '标题' },
  { colKey: 'priority', title: '优先级', width: 100 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'progress', title: '进度', width: 90 },
  { colKey: 'assignee', title: '指派', width: 150 },
  { colKey: 'op', title: '操作', width: 170 },
];

function openReason(item: WorkItem) {
  pendingRecord.value = {
    id: `PM-${records.value.length + 1}`, victimTaskId: item.itemId, victimTitle: item.title,
    byTaskId: taskData.workItems.find((i) => i.priority === 'URGENT' && i.shortId !== item.shortId)?.itemId ?? '',
    priorityFrom: item.priority, priorityTo: 'URGENT', safePoint: '等待最近安全点（无进行中的工具调用时立即生效）',
    checkpointRef: `ckp_${item.shortId.toLowerCase().replace(/\W/g, '')}`, state: 'waiting_safe_point',
    reason: reason.value, at: new Date().toISOString(),
  };
  reasonOpen.value = true;
}

/** 检查点快照（页内状态）：安全点停止后生成，记录任务进度与生成时间 */
type CheckpointSnapshot = { id: string; itemId: string; shortId: string; title: string; at: string; progress: number; safePoint: string };
const checkpoints = ref<CheckpointSnapshot[]>([]);

/** 某任务已生成的检查点（已生成则按钮转态，避免对同一安全点重复生成快照） */
function latestCheckpointOf(itemId: string): CheckpointSnapshot | undefined {
  return checkpoints.value.find((c) => c.itemId === itemId);
}

/** 生成检查点：按安全点语义生成快照（含任务进度与时间戳）并列入「检查点快照」 */
function createCheckpoint(item: WorkItem) {
  const exist = latestCheckpointOf(item.itemId);
  if (exist) {
    MessagePlugin.info(`${item.shortId} 已有检查点 ${exist.id}，可直接用于恢复`);
    return;
  }
  const now = new Date().toISOString();
  const id = `ckp_${item.shortId.toLowerCase()}_s1`;
  checkpoints.value.unshift({
    id, itemId: item.itemId, shortId: item.shortId, title: item.title, at: now, progress: item.progress,
    // 安全点语义：无进行中的工具调用 + 工作区已提交 → 无未落盘副作用，恢复时不重复写入
    safePoint: '等待最近安全点生成；工作区已提交，无未落盘副作用',
  });
  MessagePlugin.success(`已生成检查点 ${id}（${item.shortId} 进度 ${item.progress}%，无未落盘副作用）：已列入「检查点快照」，可据此恢复`);
}

function confirmPreempt() {
  if (!pendingRecord.value) return;
  if (!reason.value.trim()) {
    MessagePlugin.error('抢占理由必填：无理由的抢占会被拒绝（审计要求）');
    return;
  }
  pendingRecord.value.reason = reason.value;
  records.value.unshift(pendingRecord.value);
  MessagePlugin.success('抢占已登记：将在安全点生效，被抢占任务保留检查点可恢复');
  reasonOpen.value = false;
  pendingRecord.value = null;
}

function resume(r: PreemptionRecord) {
  r.state = 'resumed';
  MessagePlugin.success(`已从检查点 ${r.checkpointRef} 恢复 ${r.victimTitle}`);
}

/** 导出抢占审计：候选队列 + 抢占/恢复记录（含理由与检查点引用）与页面同源 */
function exportAudit() {
  const file = downloadJson({
    candidates: queueRows.value.map((r) => ({
      itemId: r.itemId, shortId: r.shortId, title: r.title, priority: r.priority,
      status: r.status, progress: r.progress, assignee: r.assignee,
    })),
    records: records.value,
    stats: stats.value,
  }, `oc-task-preemption-audit-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`抢占审计已导出：${file}`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = queue.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="抢占与恢复" volume="卷 14" manifest="J-09" cli="oc task preempt T-9c40 --by T-0e15 --reason '<理由>'"
      desc="优先级 + 可中断点抢占：抢占只在安全点发生，被抢占任务落检查点并可恢复；每次抢占必须记录理由并写入事件流。"
      :status="[
        { label: paused ? '调度已暂停' : '调度中', theme: paused ? 'warning' : 'success' },
        { label: '安全点抢占', theme: 'primary' },
        { label: `检查点 ${checkpoints.length} 个`, theme: checkpoints.length ? 'success' : 'default' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="paused = !paused">{{ paused ? '恢复调度' : '暂停调度' }}</Button>
        <Button size="small" variant="outline" @click="exportAudit">导出审计</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="已抢占" :value="stats.preempted" unit="项" icon="flag" />
      <StatCard label="等待安全点" :value="stats.waiting" unit="项" icon="time" />
      <StatCard label="已恢复" :value="stats.resumed" unit="项" icon="refresh" />
      <StatCard label="被拒抢占" :value="stats.rejected" unit="项" icon="error" :lower-is-better="true" hint="无检查点的工作区拒绝抢占（安全优先）" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有可抢占的任务" empty-desc="当前没有 ready/进行中/阻塞任务，抢占队列为空。" empty-action="返回看板"
      example-task="抢占「批量重构」以让发布回归先跑"
      what="抢占队列加载失败" why="优先级策略求值失败（企业策略 baseline 未加载）"
      how="可重试；系统将回退为「不允许抢占」的安全默认" trace-id="trace-4a90ff21"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已返回任务看板')"
    >
      <div class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">优先级排序（抢占候选）</div>
          <Table :data="queueRows" row-key="itemId" size="small" :pagination="undefined" :columns="columns">
            <template #shortId="{ row }"><span class="oc-mono">{{ row.shortId }}</span></template>
            <template #priority="{ row }">
              <Tag size="small" :theme="PRIORITY_META[row.priority as Priority].theme" variant="light-outline">{{ PRIORITY_META[row.priority as Priority].label }}</Tag>
            </template>
            <template #status="{ row }">
              <Tag size="small" :theme="STATUS_META[row.status as keyof typeof STATUS_META].theme" variant="light-outline">{{ STATUS_META[row.status as keyof typeof STATUS_META].label }}</Tag>
            </template>
            <template #progress="{ row }">{{ row.progress }}%</template>
            <template #assignee="{ row }">{{ row.assignee }}</template>
            <template #op="{ row }">
              <div class="oc-flex" style="gap: 4px">
                <Button size="small" variant="text" @click="openReason(row.raw as WorkItem)">抢占</Button>
                <Button
                  size="small" variant="text" :disabled="!!latestCheckpointOf(row.itemId)"
                  @click="createCheckpoint(row.raw as WorkItem)"
                >
                  {{ latestCheckpointOf(row.itemId) ? '已生成' : '检查点' }}
                </Button>
              </div>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">检查点快照（{{ checkpoints.length }}）</div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 6px">
            安全点停止后生成：无进行中的工具调用、工作区已提交；无检查点的任务拒绝抢占（安全优先），有检查点即可恢复。
          </div>
          <div v-if="!checkpoints.length" class="oc-muted" style="font-size: 12px">
            本页尚未生成检查点：在候选表点「检查点」生成快照后再执行抢占或恢复。
          </div>
          <div v-for="c in checkpoints" :key="c.id" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center; margin-bottom: 6px">
            <Tag size="small" variant="outline" class="oc-mono">{{ c.id }}</Tag>
            <b style="font-size: 12px">{{ c.title }}</b>
            <Tag size="small" theme="primary" variant="light-outline">{{ c.shortId }} · 进度 {{ c.progress }}%</Tag>
            <Tag size="small" theme="success" variant="light-outline">可恢复</Tag>
            <span class="oc-muted" style="font-size: 11px">{{ new Date(c.at).toLocaleString('zh-CN') }}</span>
            <span class="oc-muted" style="font-size: 11px">安全点：{{ c.safePoint }}</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">抢占与恢复记录</div>
          <Timeline>
            <TimelineItem v-for="r in records" :key="r.id" :label="new Date(r.at).toLocaleString('zh-CN')">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
                <Tag size="small" variant="outline" class="oc-mono">{{ r.id }}</Tag>
                <b style="font-size: 12px">{{ r.victimTitle }}</b>
                <Tag size="small" :theme="r.state === 'preempted' ? 'warning' : r.state === 'resumed' ? 'success' : r.state === 'rejected' ? 'danger' : 'primary'" variant="light-outline">
                  {{ r.state === 'preempted' ? '已抢占' : r.state === 'resumed' ? '已恢复' : r.state === 'rejected' ? '抢占被拒' : '等待安全点' }}
                </Tag>
                <span class="oc-muted" style="font-size: 11px">安全点：{{ r.safePoint }}</span>
              </div>
              <div class="oc-secondary" style="font-size: 12px">理由：{{ r.reason }}</div>
              <div class="oc-flex" style="gap: 6px; margin-top: 4px">
                <Tag size="small" variant="outline" class="oc-mono">{{ r.checkpointRef }}</Tag>
                <Popconfirm
                  v-if="r.state === 'preempted' || r.state === 'waiting_safe_point'"
                  content="从检查点恢复会重放该任务的安全点之后步骤；已登记的副作用不会重复执行（副作用账本跳过）。"
                  theme="warning" @confirm="resume(r)"
                >
                  <Button size="small" variant="outline">从检查点恢复</Button>
                </Popconfirm>
              </div>
            </TimelineItem>
          </Timeline>
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <CliHint command="oc task resume T-9c40 --from ckp_9c40_p3 --explain" />
            <CopyableId id="trace-4a90ff21" label="复制 traceId" />
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">安全点语义（为什么不能在任意时刻打断）</div>
          <div class="oc-secondary" style="font-size: 12px">
            抢占只能在「无进行中的工具调用、且工作区已提交」的时刻生效；强制打断会留下未落盘副作用，恢复时可能重复写入。
            无检查点能力的工作区（如文档工作区未启用快照）直接拒绝抢占，并给出替代路径（排队或改期）。
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 6px">
            <RiskBadge level="R2" />
            <span class="oc-muted" style="font-size: 12px">安全点停止等价于 R2 受控动作：需理由 + 审计留痕。</span>
          </div>
        </div>
      </div>

      <Dialog v-model:visible="reasonOpen" header="抢占理由（必填）" width="520px" :footer="false">
        <div class="oc-stack">
          <div class="oc-muted" style="font-size: 12px">被抢占任务：{{ pendingRecord?.victimTitle }}（{{ pendingRecord?.checkpointRef }}）</div>
          <Textarea v-model="reason" :autosize="{ minRows: 3 }" placeholder="说明为什么必须抢占：紧急程度 + 不抢占的后果" />
          <div class="oc-flex" style="gap: 8px">
            <Button size="small" theme="primary" @click="confirmPreempt">确认抢占</Button>
            <Button size="small" variant="outline" @click="reasonOpen = false">取消</Button>
            <OcIcon name="help" size="14px" />
            <span class="oc-muted" style="font-size: 12px">理由将进入事件流与团队黑板，可在审计中检索。</span>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
