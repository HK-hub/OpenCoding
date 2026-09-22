<script setup lang="ts">
/**
 * Z-06 崩溃恢复协调器。
 * 启动扫描未完成会话/任务/团队 → 校验最后检查点与事件位点 → 区分「可恢复项」与「需人工确认项」→
 * 依据副作用账本跳过已发生写操作（不重复副作用），由用户/策略决定续跑或放弃。
 * 溯源：卷 19 D-PERS-7/§4.3；BUILD-MANIFEST Z-06。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const scope = ref<'all' | 'recoverable' | 'human'>('all');
const chosen = ref<string[]>([]);
const resumeOpen = ref(false);

const scan = computed(() => platformData.persistence.recoveryScans[0]);

interface Item {
  id: string;
  kind: string;
  title: string;
  checkpoint: string;
  state: string;
  recoverable: boolean;
  reason: string;
}

/** 三类未完成对象统一成恢复项（会话/任务/团队） */
const items = computed<Item[]>(() => [
  ...scan.value.unfinishedSessions.map((s) => ({ id: s.sessionId, kind: '会话', title: s.title, checkpoint: s.lastCheckpoint, state: `seq ${s.lastEventSeq}`, recoverable: s.recoverable, reason: s.recoverable ? '检查点完整，可只读重放后续段' : '检查点早于破坏性迁移，禁止自动续跑' })),
  ...scan.value.unfinishedTasks.map((t) => ({ id: t.taskId, kind: '任务', title: t.title, checkpoint: t.lastCheckpoint, state: t.state, recoverable: t.recoverable, reason: t.reason })),
  ...scan.value.unfinishedTeams.map((t) => ({ id: t.teamId, kind: '团队', title: t.name, checkpoint: t.dispatch, state: `${t.members} 名成员`, recoverable: t.recoverable, reason: '黑板认领登记可恢复，合并队列需重新入队' })),
]);

const rows = computed(() =>
  items.value.filter((i) => (scope.value === 'all' ? true : scope.value === 'recoverable' ? i.recoverable : !i.recoverable)),
);

const columns = [
  { colKey: 'sel', title: '选择', width: 90, cell: 'sel' },
  { colKey: 'kind', title: '类型', width: 80, cell: 'kind' },
  { colKey: 'id', title: '编号', width: 110, cell: 'id' },
  { colKey: 'title', title: '对象', ellipsis: true },
  { colKey: 'checkpoint', title: '最后检查点', width: 220, cell: 'ckpt' },
  { colKey: 'state', title: '状态', width: 120 },
  { colKey: 'verdict', title: '恢复判定', width: 260, cell: 'verdict' },
];

function toggle(id: string) {
  chosen.value = chosen.value.includes(id) ? chosen.value.filter((x) => x !== id) : [...chosen.value, id];
}

function doResume() {
  if (!chosen.value.length) {
    MessagePlugin.error('请先选择要续跑的对象（仅「可恢复」项允许批量续跑）');
    return;
  }
  MessagePlugin.success(`已提交续跑：${chosen.value.join('、')}（只读重放 + 副作用账本跳过已发生写操作）`);
  resumeOpen.value = false;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = scan.value ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="崩溃恢复协调器"
      desc="恢复的正确性优先级高于速度：先扫描未完成对象、校验检查点与事件位点，再按副作用账本跳过已发生的写操作，最后交由人/策略决定续跑。"
      volume="卷 19" manifest="Z-06" cli="oc recovery scan --report && oc recovery resume --id <sessionId>"
      :status="[{ label: `可恢复 ${scan.recoverableItems.length}`, theme: 'success' }, { label: `需人工 ${scan.needsHumanItems.length}`, theme: 'warning' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="scope" size="small" style="width: 170px" aria-label="范围">
          <Option value="all" label="全部未完成项" />
          <Option value="recoverable" label="仅可恢复项" />
          <Option value="human" label="仅需人工确认项" />
        </Select>
        <Button size="small" theme="primary" @click="resumeOpen = true">续跑所选（{{ chosen.length }}）</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="启动恢复扫描" :value="scan.scannedAt.slice(11, 19)" format="raw" icon="refresh" hint="进程被杀死后重启即扫描" />
      <StatCard label="可恢复项" :value="scan.recoverableItems.length" icon="check" hint="检查点完整且无关键副作用冲突" />
      <StatCard label="需人工确认" :value="scan.needsHumanItems.length" icon="user" hint="不可自动续跑（避免假完成）" />
      <StatCard label="副作用账本跳过" :value="scan.sideEffectLedgerSkipped.length" icon="secured" hint="幂等键命中即跳过，不重复副作用" />
    </div>

    <StateShell
      :state="demo" stage="正在扫描未完成会话/任务/团队并校验检查点…"
      empty-title="没有需要恢复的对象" empty-desc="上次退出为正常关闭（检查点全部已提交），或未完成对象已被用户放弃。"
      empty-action="查看历史扫描报告" example-task="模拟进程被杀（kill -9），重启后观察会话从检查点续跑"
      what="恢复扫描失败" why="事件日志位点查询超时，无法确认可重放区间"
      how="可重试；恢复扫描失败期间禁止任何续跑（避免重复副作用）" trace-id="trace-d66f2c10"
      @retry="demo = 'NORMAL'" @empty-action="scope = 'all'"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #sel="{ row }">
          <Button size="small" :variant="chosen.includes(row.id) ? 'base' : 'outline'" :theme="chosen.includes(row.id) ? 'primary' : 'default'" :disabled="!row.recoverable" @click="toggle(row.id as string)">
            {{ chosen.includes(row.id) ? '已选' : '选择' }}
          </Button>
        </template>
        <template #kind="{ row }">
          <Tag size="small" variant="light-outline">{{ row.kind }}</Tag>
        </template>
        <template #id="{ row }"><span class="oc-mono">{{ row.id }}</span></template>
        <template #ckpt="{ row }"><span class="oc-mono oc-truncate">{{ row.checkpoint }}</span></template>
        <template #verdict="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <Tag :theme="row.recoverable ? 'success' : 'warning'" size="small" variant="light-outline">
              {{ row.recoverable ? '可恢复' : '需人工确认' }}
            </Tag>
            <span class="oc-muted oc-truncate" style="font-size: 12px">{{ row.reason }}</span>
          </div>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">续跑决策依据（不重复副作用）</h3>
        <Table
          :data="scan.sideEffectLedgerSkipped" size="small" :pagination="undefined" row-key="idempotencyKey"
          :columns="[{ colKey: 'entry', title: '已发生的副作用', ellipsis: true }, { colKey: 'idempotencyKey', title: '幂等键', width: 220, cell: 'key' }, { colKey: 'reason', title: '处理', width: 220 }]"
        >
          <template #key="{ row }"><span class="oc-mono oc-truncate">{{ row.idempotencyKey }}</span></template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="success" variant="light-outline" size="small">副作用账本命中即跳过：写文件按校验和比对、提交按哈希比对、通知按幂等键比对</Tag>
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          需人工确认项与重放段
          <CopyableId :id="scan.lastCheckpointRef" label="复制检查点引用" />
        </h3>
        <InfoGrid :columns="1" :items="scan.needsHumanItems.map((t, i) => ({ key: `h${i}`, label: `需人工项 ${i + 1}`, value: t }))" />
        <Table
          :data="scan.replaySegments" size="small" :pagination="undefined" row-key="segment" style="margin-top: 8px"
          :columns="[{ colKey: 'segment', title: '重放段（只读）', ellipsis: true }, { colKey: 'events', title: '事件数', width: 100 }, { colKey: 'sideEffects', title: '含副作用', width: 110 }]"
        />
        <div class="oc-flex" style="margin-top: 8px">
          <CliHint command="oc recovery scan --report && oc recovery resume --id S-1b2c --skip-side-effects" />
        </div>
      </div>
    </div>

    <Dialog v-model:visible="resumeOpen" header="续跑所选对象" width="600px" :confirm-btn="{ content: '确认续跑', theme: 'primary' }" cancel-btn="取消" @confirm="doResume">
      <div class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'chosen', label: '已选对象', value: chosen.length ? chosen.join('、') : '未选择' },
          { key: 'semantics', label: '续跑语义', value: '从最后检查点只读重放事件流；命中副作用账本的写操作被跳过，其余写操作在授权范围内执行' },
          { key: 'human', label: '需人工项', value: '不会被续跑（需先补充证据或人工确认放弃）' },
          { key: 'audit', label: '审计', value: '续跑生成 system.recovery.resume 事件并关联原会话/任务' },
        ]" />
        <Tag theme="warning" variant="light-outline" size="small">续跑不重建逐字动画；仅恢复语义状态与最终呈现</Tag>
      </div>
    </Dialog>
  </div>
</template>
