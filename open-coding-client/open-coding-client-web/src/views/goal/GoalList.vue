<script setup lang="ts">
/**
 * 目标列表（X-01）：目标陈述 / 自治级别 / 进度 / 预算水位 / 漂移标记 / 状态 + 创建入口。
 * 溯源：卷 15 §4.1 Goal 契约与 §4.2 自治循环。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Progress, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { AUTONOMY_META, GOAL_STATUS_META, taskData } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const limit = ref(4);

const goals = computed(() => taskData.goals.slice(0, limit.value));
const driftGoals = computed(() => taskData.goals.filter((g) => g.driftFlag));

const stats = computed(() => ({
  active: taskData.goals.filter((g) => g.status === 'started').length,
  avgProgress: Math.round((taskData.goals.reduce((a, b) => a + b.progressRatio, 0) / Math.max(1, taskData.goals.length)) * 100),
  cost: Number(taskData.goals.reduce((a, b) => a + b.costTotal, 0).toFixed(2)),
  drift: driftGoals.value.length,
}));

const columns = [
  { colKey: 'objective', title: '目标陈述' },
  { colKey: 'autonomy', title: '自治级别', width: 120 },
  { colKey: 'progress', title: '进度', width: 160 },
  { colKey: 'budget', title: '预算水位', width: 150 },
  { colKey: 'drift', title: '漂移', width: 110 },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'op', title: '操作', width: 190 },
];

function waterline(goalId: string): number {
  const g = taskData.goals.find((x) => x.goalId === goalId);
  if (!g) return 0;
  return Math.min(100, Math.round((g.costTotal / Math.max(0.01, g.budget.cost)) * 100));
}

function toggle(goalId: string) {
  const g = taskData.goals.find((x) => x.goalId === goalId);
  if (!g) return;
  g.status = g.status === 'paused' ? 'started' : 'paused';
  MessagePlugin.success(`目标已${g.status === 'paused' ? '暂停（保留检查点，可在任意 Tick 恢复）' : '恢复'}`);
}

function revoke(goalId: string) {
  const g = taskData.goals.find((x) => x.goalId === goalId);
  if (!g) return;
  g.status = 'cancelled';
  MessagePlugin.warning('目标已撤销：终止条件 revoke 触发，生成终止报告并通知相关成员');
}

function step() {
  limit.value = taskData.goals.length;
  state.value = 'NORMAL';
}

function goto(hash: string) {
  window.location.hash = hash;
}

/** 导出台账：目标全量（含 Tick 与成本）与统计与页面同源，供离线核对预算水位与漂移 */
function exportLedger() {
  const file = downloadJson({
    stats: stats.value,
    goals: taskData.goals,
  }, `oc-goal-ledger-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`目标台账已导出：${file}`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = !taskData.goals.length ? 'EMPTY' : taskData.goals.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
  }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="目标列表" volume="卷 15" manifest="X-01" cli="oc goal list --status started --show-drift"
      desc="Goal 是长期自治单元：以验收标准与证据为达成依据，多重终止条件（达成/预算/时间/失败/撤销/风险）保证不会无限燃烧预算。"
      :status="[{ label: '自治受企业基线钳制', theme: 'primary' }, { label: `${stats.drift} 个漂移告警`, theme: stats.drift ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportLedger">导出台账</Button>
        <Button size="small" theme="primary" @click="goto('#/goal/create')">创建目标</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="进行中目标" :value="stats.active" unit="个" icon="star" />
      <StatCard label="平均进度" :value="stats.avgProgress" unit="%" icon="chart" :target="60" target-kind="min" />
      <StatCard label="累计成本" :value="stats.cost" format="cost" icon="discount" :lower-is-better="true" />
      <StatCard label="漂移告警" :value="stats.drift" unit="个" icon="error" :lower-is-better="true" hint="漂移检测命中即暂停并汇报" />
    </div>

    <StateShell
      :state="state" :page-size="limit"
      collapsed-summary="目标数超过列表渲染阈值（4 个），已折叠展示；折叠不丢数据。"
      empty-title="还没有目标" empty-desc="Goal 用于长周期自治推进；单次任务请直接用任务看板。" empty-action="创建目标"
      example-task="在 3 周内把支付链路回执幂等缺陷降到 0"
      what="目标列表加载失败" why="目标存储（事件重建）与快照不一致，读取被一致性校验阻断"
      how="可重试；系统将以事件为准重建快照后返回" trace-id="trace-91c0ab7e"
      @retry="state = 'LOADING'" @load-more="step" @empty-action="goto('#/goal/create')"
    >
      <div class="oc-card">
        <Table :data="goals" row-key="goalId" size="small" :pagination="undefined" :columns="columns">
          <template #objective="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.shortId }}</span>
              <span style="font-size: 12px">{{ row.objective }}</span>
            </div>
            <div class="oc-muted" style="font-size: 11px">计划：{{ row.planRef.title }} · 负责人 {{ row.owner }}</div>
          </template>
          <template #autonomy="{ row }">
            <Tooltip :content="AUTONOMY_META[row.autonomyLevel as keyof typeof AUTONOMY_META].desc">
              <Tag size="small" variant="light-outline">{{ AUTONOMY_META[row.autonomyLevel as keyof typeof AUTONOMY_META].label }}</Tag>
            </Tooltip>
          </template>
          <template #progress="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <Progress :percentage="Math.round(row.progressRatio * 100)" :size="'small'" style="width: 80px" />
              <span class="oc-muted" style="font-size: 11px">{{ row.ticksTotal }} ticks</span>
            </div>
          </template>
          <template #budget="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span style="font-size: 12px">${{ row.costTotal }} / ${{ row.budget.cost }}</span>
              <Tag size="small" :theme="waterline(row.goalId) > 80 ? 'danger' : 'default'" variant="light-outline">{{ waterline(row.goalId) }}%</Tag>
            </div>
          </template>
          <template #drift="{ row }">
            <Tooltip v-if="row.driftFlag" :content="row.driftDetail">
              <Tag size="small" theme="danger" variant="light-outline"><OcIcon name="error" size="11px" /> 漂移</Tag>
            </Tooltip>
            <Tag v-else size="small" variant="outline">正常</Tag>
          </template>
          <template #status="{ row }">
            <Tag size="small" :theme="GOAL_STATUS_META[row.status as keyof typeof GOAL_STATUS_META].theme" variant="light-outline">
              {{ GOAL_STATUS_META[row.status as keyof typeof GOAL_STATUS_META].label }}
            </Tag>
          </template>
          <template #op="{ row }">
            <div class="oc-flex" style="gap: 4px">
              <Button size="small" variant="text" @click="goto('#/goal/detail')">详情</Button>
              <Button size="small" variant="text" @click="toggle(row.goalId)">{{ row.status === 'paused' ? '恢复' : '暂停' }}</Button>
              <Popconfirm content="撤销会触发终止条件 revoke：生成终止报告、回收成员预算并通知；已产出证据保留但目标不可再推进。" theme="danger" @confirm="revoke(row.goalId)">
                <Button size="small" variant="text" theme="danger">撤销</Button>
              </Popconfirm>
            </div>
          </template>
        </Table>
      </div>

      <div v-if="driftGoals.length" class="oc-card" style="margin-top: 10px; border-color: var(--oc-sev-error)">
        <div class="oc-flex" style="gap: 6px">
          <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
          <b>漂移告警需处置</b>
          <Tag size="small" theme="danger" variant="light-outline">{{ driftGoals.length }} 个目标已自动暂停</Tag>
        </div>
        <div v-for="g in driftGoals" :key="g.goalId" class="oc-secondary" style="font-size: 12px; margin-top: 4px">
          {{ g.shortId }}：{{ g.driftDetail }}
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 6px">
          <Button size="small" variant="outline" @click="goto('#/goal/drift')">进入漂移处置</Button>
          <CliHint command="oc goal drift show G-3a88 --evidence all" />
          <CopyableId id="trace-91c0ab7e" label="复制 traceId" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
