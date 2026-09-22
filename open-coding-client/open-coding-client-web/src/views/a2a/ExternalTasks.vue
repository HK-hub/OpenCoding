<script setup lang="ts">
/**
 * 外部任务列表（Q-03）：状态过滤 + 排队位置/ETA + 幂等命中 + 预算水位。
 * 溯源：卷 23 §4.2 / §4.6
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { A2ATask } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const filter = ref('');
const statusFilter = ref<string>('all');
const pageSize = 10;
const statusTheme: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  queued: 'default', running: 'primary', waiting_approval: 'warning', paused: 'warning', completed: 'success', failed: 'danger', cancelled: 'default',
};
const cols = [
  { colKey: 'taskId', title: '任务', width: 130 },
  { colKey: 'title', title: '指令摘要' },
  { colKey: 'caller', title: '调用方', width: 200 },
  { colKey: 'status', title: '状态', width: 130 },
  { colKey: 'queue', title: '排队 / ETA', width: 140 },
  { colKey: 'budgetUsd', title: '预算水位', width: 170 },
  { colKey: 'priority', title: '优先级', width: 90 },
];
const filtered = computed(() =>
  d.a2a.tasks.filter((t) => (statusFilter.value === 'all' ? true : t.status === statusFilter.value))
    .filter((t) => !filter.value || `${t.taskId}${t.title}${t.caller.name}${t.correlationId}`.toLowerCase().includes(filter.value.toLowerCase())),
);
const paged = computed(() => filtered.value.slice(0, pageSize));
const isEdge = computed(() => filtered.value.length > pageSize);
const idemHits = computed(() => d.a2a.tasks.filter((t) => t.idempotentHit));

function openDetail(row: A2ATask) {
  router.push(`/a2a/tasks/${row.taskId}`);
}

onMounted(() => {
  setTimeout(() => {
    state.value = filtered.value.length ? (isEdge.value ? 'EDGE_DATA' : 'NORMAL') : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="外部任务"
      desc="外部调用方提交的任务统一映射为内部 WorkItem；排队位置与 ETA 可见，重复提交命中幂等键不重复执行。"
      volume="卷 23"
      manifest="Q-03"
      cli="oc a2a tasks --status running --with-eta --json"
      :status="[{ label: '只读语义：取消走安全点', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/a2a/submit')">提交调试台</Button>
        <Button size="small" theme="primary" @click="state = 'LOADING'"><OcIcon name="refresh" size="12px" /> 刷新</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      :collapsed-summary="`共 ${filtered.length} 条，已折叠展示前 ${pageSize} 条（含排队与终态混合）`"
      :page-size="pageSize"
      empty-title="没有匹配的外部任务"
      empty-desc="当前过滤条件下无数据；可清空关键词或切换状态。外部任务需先在组织策略中放行 a2a.server。"
      empty-action="清空过滤"
      example-task="从「提交调试台」发一个预算 $1 的只读审查任务"
      what="外部任务列表加载失败"
      why="服务面配额查询超时（Redis 实时计数不可用）或调用方身份校验失败"
      how="可重试；若为配额服务故障，已排队任务会保留并按原位置继续"
      trace-id="trace-a2a-tasks-3c81d0"
      @retry="state = 'LOADING'"
      @load-more="state = 'NORMAL'"
      @empty-action="filter = ''; statusFilter = 'all'; state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="外部任务总数" :value="d.a2a.tasks.length" unit="个" icon="task" />
        <StatCard label="等待审批" :value="d.a2a.tasks.filter((t) => t.status === 'waiting_approval').length" unit="个" icon="secured" hint="超时（10 分钟）按默认拒绝" />
        <StatCard label="幂等命中" :value="idemHits.length" unit="次" :target="0" target-kind="max" hint="去重窗口 24h，返回既有任务" />
        <StatCard label="不可信调用方" :value="d.a2a.tasks.filter((t) => t.caller.type === '不可信Agent').length" unit="个" :target="20" target-kind="max" hint="沙箱 L1+，产出标记「未验证」" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <Input v-model="filter" size="small" placeholder="搜索 taskId / 指令 / 调用方 / correlationId" clearable style="max-width: 320px">
            <template #prefix-icon><OcIcon name="search" size="14px" /></template>
          </Input>
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag
              v-for="s in ['all', 'queued', 'running', 'waiting_approval', 'paused', 'completed', 'failed', 'cancelled']"
              :key="s"
              size="small"
              :theme="statusFilter === s ? 'primary' : 'default'"
              variant="light-outline"
              style="cursor: pointer"
              @click="statusFilter = s"
            >
              {{ s === 'all' ? '全部' : s }}
            </Tag>
          </div>
          <span class="oc-grow" />
          <CopyableId id="trace-a2a-list-77a2" label="复制 traceId" />
        </div>

        <Table :data="paged" :columns="cols" row-key="taskId" size="small" style="margin-top: 8px" @row-click="(ctx: { row: unknown }) => openDetail(ctx.row as A2ATask)">
          <template #taskId="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-mono">{{ row.taskId }}</span>
              <Tag v-if="row.idempotentHit" size="small" theme="warning" variant="light-outline">幂等命中</Tag>
            </div>
          </template>
          <template #title="{ row }">
            <span>{{ row.title }}</span>
            <Tag v-if="row.caller.type === '不可信Agent'" size="small" theme="danger" variant="light-outline" style="margin-left: 6px">未验证产出</Tag>
          </template>
          <template #caller="{ row }">
            <Tooltip :content="`认证：${row.caller.auth} · 委托用户：${row.delegatedUserId} · 跳数 ${row.hopDepth}/3`">
              <span>{{ row.caller.name }}</span>
            </Tooltip>
          </template>
          <template #status="{ row }">
            <Tag size="small" :theme="statusTheme[String(row.status)] ?? 'default'" variant="light-outline">{{ row.status }}</Tag>
          </template>
          <template #queue="{ row }">
            <span v-if="row.queuePosition > 0" class="oc-mono">#{{ row.queuePosition }} · {{ row.etaSeconds }}s</span>
            <span v-else class="oc-muted">—</span>
          </template>
          <template #budgetUsd="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-mono">${{ Number(row.spentUsd).toFixed(2) }} / ${{ Number(row.budgetUsd).toFixed(2) }}</span>
              <Tag size="small" :theme="Number(row.spentUsd) / Number(row.budgetUsd) >= 0.8 ? 'warning' : 'default'" variant="outline">
                {{ Math.round((Number(row.spentUsd) / Number(row.budgetUsd)) * 100) }}%
              </Tag>
            </div>
          </template>
          <template #priority="{ row }">
            <Tag size="small" :theme="row.priority === 'P0' ? 'danger' : row.priority === 'P1' ? 'warning' : 'default'" variant="light-outline">{{ row.priority }}</Tag>
          </template>
        </Table>

        <div v-if="isEdge" class="oc-state__hint">
          EDGE_DATA：共 {{ filtered.length }} 条，仅渲染前 {{ pageSize }} 条；加载更多以 cursor 分页（不静默截断）。
        </div>
        <div v-for="t in d.a2a.tasks.filter((x) => x.failureReason)" :key="t.taskId" class="oc-state__hint">
          负样本 {{ t.taskId }}：{{ t.failureReason }}
        </div>
      </div>
    </StateShell>
  </div>
</template>
