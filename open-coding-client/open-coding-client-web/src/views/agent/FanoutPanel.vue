<script setup lang="ts">
/**
 * A-03 并行扇出面板：子任务集合 + 预算分配 + 同文件写冲突前置拦截 + 汇总/去重。
 * 关键：冲突检测（同文件写）前置拦截——冲突子任务不并行启动，避免互相覆盖；汇总器去重并合并证据（卷 12 §4.4）。
 * 溯源：卷 12 D-AG-6 / §4.4 / BUILD-MANIFEST A-03
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.agent;

const state = ref<UiStateKind>('LOADING');
const activeBatch = ref(data.fanout[0].batchId);
/** 数据版本号：mock 为普通对象，就地变更后手动失效派生计算（避免 computed 缓存旧状态） */
const dataVersion = ref(0);
const batch = computed(() => data.fanout.find((f) => f.batchId === activeBatch.value) ?? data.fanout[0]);
const blocked = computed(() => {
  dataVersion.value;
  return batch.value.subtasks.filter((s) => s.status === 'blocked');
});

const budgetChart = computed(() => [
  { name: '已分配', value: batch.value.budgetAllocation.allocated },
  { name: '预留', value: batch.value.budgetAllocation.reserved },
]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function statusTheme(s: string) {
  return s === 'succeeded' ? 'success' : s === 'running' ? 'primary' : s === 'blocked' ? 'danger' : s === 'queued' ? 'warning' : 'default';
}
function statusLabel(s: string) {
  return { succeeded: '已完成', running: '运行中', blocked: '已拦截', queued: '排队中' }[s] ?? s;
}

function merge() {
  // 汇总前置条件：不允许存在被拦截（写冲突）子任务；被拦截时按钮禁用且此处兜底解释原因
  if (blocked.value.length) {
    MessagePlugin.warning('存在同文件写冲突，已阻止汇总：请先串行化冲突子任务或调整写范围');
    return;
  }
  batch.value.merged = true;
  dataVersion.value += 1;
  MessagePlugin.success(`已汇总：去重 ${batch.value.dedupedCount} 处，冲突清单为空，证据已合并`);
}

/** 串行化后的写锁顺序：taskId → 序号（供冲突卡与状态列展示） */
const serialOrder = ref<Record<string, number>>({});

/** 串行化执行时间（为空表示该批次尚未串行化） */
const serializedAt = ref('');

/** 写锁顺序清单文本（冲突卡展示用） */
const serialOrderText = computed(() =>
  Object.entries(serialOrder.value)
    .sort((a, b) => a[1] - b[1])
    .map(([taskId, no]) => `${no}. ${taskId}`)
    .join(' → '),
);

/** 串行化冲突子任务：被拦截项按写锁顺序重排为「排队中」并登记顺序，随后由调度器重新调度 */
function serializeConflicts() {
  if (!batch.value.conflicts.length) {
    MessagePlugin.warning('当前批次没有同文件写冲突，无需串行化');
    return;
  }
  let order = 0;
  const next: Record<string, number> = {};
  for (const c of batch.value.conflicts) {
    // 同一文件只允许一个写者：被拦截项按「前者释放写锁后依次执行」的顺序排队
    for (const s of batch.value.subtasks) {
      if (s.status === 'blocked' && s.files.includes(c.file)) {
        s.status = 'queued';
        order += 1;
        next[s.taskId] = order;
      }
    }
  }
  serialOrder.value = next;
  serializedAt.value = new Date().toLocaleString('zh-CN');
  dataVersion.value += 1;
  if (!order) {
    MessagePlugin.warning('冲突涉及的子任务均已不处于拦截状态，无需重排');
    return;
  }
  MessagePlugin.info(`已请求串行化冲突子任务：${order} 项拦截已重排为排队中（按写锁顺序重新调度）`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="并行扇出面板"
      desc="声明式子任务集合 → 调度器按资源与预算并行 → 汇总器结构化合并且去重；同文件写冲突在启动前拦截，避免互相覆盖。"
      volume="卷 12"
      manifest="A-03"
      cli="oc agent fanout plan --batch fan-01 --dry-run"
      :status="[{ label: batch.merged ? '已汇总' : '待汇总', theme: batch.merged ? 'success' : 'primary' }, { label: batch.conflicts.length ? `${batch.conflicts.length} 处写冲突` : '无写冲突', theme: batch.conflicts.length ? 'danger' : 'success' }]"
    >
      <template #actions>
        <Select v-model="activeBatch" size="small" style="width: 260px" :options="data.fanout.map((f) => ({ label: `${f.batchId} · ${f.goal}`, value: f.batchId }))" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="子任务" :value="batch.subtasks.length" unit="个" icon="layers" hint="单轮并行默认上限 4（可配）" />
      <StatCard label="已拦截" :value="blocked.length" unit="个" icon="lock" :lower-is-better="true" hint="同文件写冲突：前置拦截而非事后解决" />
      <StatCard label="去重条数" :value="batch.dedupedCount" unit="条" icon="filter" hint="汇总器按内容哈希去重，保留最早证据" />
      <StatCard label="预算分配率" :value="Math.round((batch.budgetAllocation.allocated / batch.budgetAllocation.total) * 100)" unit="%" icon="discount" hint="预留部分用于汇总、验证与重试开销" />
    </div>

    <StateShell
      :state="state"
      stage="计算扇出计划与冲突…"
      empty-title="没有扇出批次"
      empty-desc="扇出用于可并行的独立子任务；串行依赖的任务不会被扇出，以保证顺序正确。"
      empty-action="查看子 Agent 树"
      example-task="把 4 个独立页面拆成并行子任务并做写冲突检测"
      what="扇出计划加载失败"
      why="调度器不可达或预算池校验失败（父预算不足）。"
      how="可重试；预算不足时可降低并发度或缩小范围后重试。"
      trace-id="trace-fan-6b30ac"
      @retry="state = 'NORMAL'"
    >
      <div v-if="batch.conflicts.length" class="oc-card" style="border-color: var(--oc-sev-error)">
        <h3 class="oc-card__title">
          同文件写冲突（前置拦截）
          <Tag size="small" theme="danger">已阻止并行启动</Tag>
        </h3>
        <div v-for="c in batch.conflicts" :key="c.file" class="oc-flex" style="gap: 8px">
          <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
          <span class="oc-mono" style="font-size: 12px">{{ c.file }}</span>
          <span class="oc-secondary" style="font-size: 12px">涉及：{{ c.agents.join('、') }} → {{ serializedAt ? '已串行化（后启动者等待前者的写锁释放）' : '待串行化（点击「串行化冲突项」后按写锁顺序重排）' }}</span>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          拦截语义：冲突子任务不会被并行启动，也不会静默跳过；被拦截项在列表中显式标记为 blocked，等待人工调整写范围或改为串行。
        </div>
        <!-- 串行化记录：重排后拦截项转为排队中，此处展示写锁顺序与重排时间 -->
        <div v-if="serializedAt" class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center; margin-top: 6px">
          <Tag size="small" theme="success" variant="light-outline">已重排为排队中</Tag>
          <span class="oc-muted" style="font-size: 12px">写锁顺序：{{ serialOrderText }}；重排时间：{{ serializedAt }}</span>
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            子任务集合
            <span class="oc-muted" style="font-size: 12px">{{ batch.goal }}</span>
          </h3>
          <Table
            :data="batch.subtasks"
            :columns="[
              { colKey: 'title', title: '子任务', cell: 'cell' },
              { colKey: 'agent', title: '执行子 Agent', width: 110, cell: 'cell' },
              { colKey: 'budgetTokens', title: '预算 token', width: 120, cell: 'cell' },
              { colKey: 'files', title: '写范围', width: 260, cell: 'cell' },
              { colKey: 'status', title: '状态', width: 96, cell: 'cell' },
            ]"
            row-key="taskId"
            size="small"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'title'">
                <div style="font-size: 13px">{{ row.title }}</div>
                <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.taskId }}</span>
              </template>
              <template v-else-if="col.colKey === 'agent'"><span class="oc-mono" style="font-size: 12px">{{ row.agent }}</span></template>
              <template v-else-if="col.colKey === 'budgetTokens'"><span class="oc-mono">{{ row.budgetTokens.toLocaleString('zh-CN') }}</span></template>
              <template v-else-if="col.colKey === 'files'">
                <span v-for="f in row.files" :key="f" class="oc-mono" style="display: block; font-size: 11px">{{ f }}</span>
              </template>
              <template v-else-if="col.colKey === 'status'">
                <Tag size="small" :theme="statusTheme(row.status)" variant="light-outline">{{ statusLabel(row.status) }}</Tag>
                <Tag v-if="serialOrder[row.taskId]" size="small" variant="outline" style="margin-left: 4px">写锁序 #{{ serialOrder[row.taskId] }}</Tag>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">预算分配与汇总</h3>
          <OcChart type="donut" :values="budgetChart" :height="180" format="token" aria-label="预算分配" />
          <div class="oc-kv" style="font-size: 12px; margin-top: 8px">
            <span class="oc-kv__k">总额</span><span class="oc-mono">{{ batch.budgetAllocation.total.toLocaleString('zh-CN') }} token</span>
            <span class="oc-kv__k">已分配</span><span class="oc-mono">{{ batch.budgetAllocation.allocated.toLocaleString('zh-CN') }} token</span>
            <span class="oc-kv__k">预留</span><span class="oc-mono">{{ batch.budgetAllocation.reserved.toLocaleString('zh-CN') }} token（汇总 + 验证 + 重试）</span>
            <span class="oc-kv__k">汇总状态</span><span>{{ batch.merged ? `已汇总，去重 ${batch.dedupedCount} 条` : '未汇总（存在未完成/被拦截子任务）' }}</span>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
            <Button theme="primary" :disabled="blocked.length > 0" @click="merge">汇总 / 去重</Button>
            <Button variant="outline" @click="serializeConflicts">串行化冲突项</Button>
            <CliHint command="oc agent fanout merge --batch fan-01 --dedup" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
