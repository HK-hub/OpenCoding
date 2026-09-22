<script setup lang="ts">
/** 工具目录（T-01）：12 族分组 + 风险级 + 来源通道 + 资源声明 + 语义检索。溯源：卷 05 §4.3 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { TOOL_FAMILIES, toolData } from '@/mock/data/tool';
import type { SourceChannel } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const router = useRouter();
const { tools, summary } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const keyword = ref('');
const family = ref('');
const risk = ref('');
const source = ref('');
const pageSize = ref(24);
const err = ref(makeError('INTERNAL_ERROR'));

const familyFilter = computed(() => (family.value ? family.value : ''));
const rows = computed(() =>
  tools
    .filter((t) => !familyFilter.value || t.family === familyFilter.value)
    .filter((t) => !risk.value || t.riskLevel === risk.value)
    .filter((t) => !source.value || t.sourceChannel === source.value)
    .filter((t) => !keyword.value || `${t.name}${t.description}${t.tags.join('')}${t.family}`.toLowerCase().includes(keyword.value.toLowerCase())),
);
const shown = computed(() => rows.value.slice(0, pageSize.value));

const columns = [
  { colKey: 'name', title: '工具', width: 190 },
  { colKey: 'family', title: '工具族', width: 104 },
  { colKey: 'riskLevel', title: '风险级', width: 108 },
  { colKey: 'sourceChannel', title: '来源', width: 92 },
  { colKey: 'resourceRequirements', title: '资源声明', width: 220 },
  { colKey: 'concurrencySemantics', title: '并发语义', ellipsis: true },
  { colKey: 'idempotencyPolicy', title: '幂等策略', ellipsis: true },
  { colKey: 'callsTotal', title: '调用 / 错误率', width: 150 },
  { colKey: 'enabled', title: '状态', width: 110 },
];

const familyCounts = computed(() =>
  TOOL_FAMILIES.map((f) => ({ family: f, count: tools.filter((t) => t.family === f).length })),
);

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function openDetail(ctx: { row: Record<string, unknown> }) {
  const name = String(ctx.row.name);
  ui.track('tool.detail.open', { name });
  router.push({ path: '/tools/detail', query: { tool: name } });
}

function exportCatalog() {
  MessagePlugin.success(`已导出 ${rows.value.length} 个工具契约（neutral-export.json，含参数 Schema 与哈希）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工具目录"
      desc="工具契约单一事实源（ToolSpec）：12 族 / 风险级 / 来源通道 / 资源声明 / 并发语义 / 幂等策略 / 按需加载标记。"
      volume="卷 05"
      manifest="T-01"
      cli="oc tools list --family 命令 --risk >=R2 --source 内置"
      :status="[{ label: '只读目录', theme: 'default' }, { label: `${summary.toolCount} 个工具`, theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="exportCatalog">导出目录</Button>
        <Button size="small" theme="primary" @click="router.push('/tools/assembly')">装配工具集</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="工具总数" :value="summary.toolCount" format="raw" icon="tools" hint="含内置 / MCP / 插件 / 脚本 / HTTP 五类来源" />
      <StatCard label="启用中" :value="summary.enabledCount" format="raw" icon="check" hint="禁用工具不会进入任何模式的装配" />
      <StatCard label="按需加载（deferred）" :value="summary.deferredCount" format="raw" icon="layers" hint="需工具组激活或语义检索发现" />
      <StatCard label="24h 调用成功" :value="summary.callSuccessRate" format="percent" icon="task-checked" :delta="-1.4" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有命中任何工具"
      empty-desc="当前筛选条件下无工具。可清空筛选或按族浏览 12 个工具族。"
      empty-action="清空筛选"
      example-task="列出「命令」族中风险级 ≥ R2 且来源为内置的工具"
      :what="`工具目录加载失败`"
      :why="err.message"
      how="可重试；若持续失败请导出诊断包并附上 traceId。"
      :trace-id="err.traceId"
      :collapsed-summary="`目录共 ${rows.length} 条，已折叠展示前 ${pageSize} 条（避免一次性渲染拖慢交互）`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 24; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="keyword = ''; family = ''; risk = ''; source = ''; refresh()"
    >
      <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 10px">
        <Input v-model="keyword" size="small" placeholder="语义检索：工具名 / 描述 / 标签" clearable style="width: 260px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="risk" size="small" clearable placeholder="风险级" style="width: 130px" :options="['R0', 'R1', 'R2', 'R3', 'R4', 'R5'].map((v) => ({ label: v, value: v }))" />
        <Select v-model="source" size="small" clearable placeholder="来源通道" style="width: 150px" :options="(['内置', 'MCP', '插件', '脚本', 'HTTP'] as SourceChannel[]).map((v) => ({ label: v, value: v }))" />
        <Tag v-for="f in familyCounts" :key="f.family" :theme="family === f.family ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="family = family === f.family ? '' : f.family; refresh()">
          {{ f.family }} · {{ f.count }}
        </Tag>
      </div>

      <Table
        row-key="name"
        size="small"
        :data="shown"
        :columns="columns"
        :hover="true"
        @row-click="openDetail"
      >
        <template #name="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono" style="font-weight: 600">{{ row.name }}</span>
            <Tag v-if="row.tags.includes('核心集')" size="small" theme="primary" variant="light-outline">核心集</Tag>
            <Tag v-if="row.deferred" size="small" theme="warning" variant="light-outline">按需加载</Tag>
          </div>
        </template>
        <template #riskLevel="{ row }"><RiskBadge :level="row.riskLevel" /></template>
        <template #sourceChannel="{ row }"><Tag size="small" variant="light-outline">{{ row.sourceChannel }}</Tag></template>
        <template #resourceRequirements="{ row }">
          <span class="oc-mono oc-muted">
            {{ row.resourceRequirements.map((r: { kind: string; mode: string }) => `${r.kind}(${r.mode})`).join(' · ') || '无声明' }}
          </span>
        </template>
        <template #callsTotal="{ row }">
          <span>{{ row.callsTotal.toLocaleString('zh-CN') }}</span>
          <Tooltip :content="`错误率 ${row.errorRate}% · 平均 ${row.avgLatencyMs}ms`">
            <Tag :theme="row.errorRate > 5 ? 'danger' : row.errorRate > 2 ? 'warning' : 'success'" size="small" variant="light-outline" style="margin-left: 6px">
              {{ row.errorRate }}%
            </Tag>
          </Tooltip>
        </template>
        <template #enabled="{ row }">
          <Tag v-if="!row.enabled" size="small" theme="default" variant="light-outline">已禁用</Tag>
          <Tag v-else-if="row.deferred" size="small" theme="warning" variant="light-outline">按需激活</Tag>
          <Tag v-else size="small" theme="success" variant="light-outline">已装配</Tag>
        </template>
      </Table>

      <div class="oc-flex oc-flex--between" style="margin-top: 10px">
        <span class="oc-muted" style="font-size: 12px">
          共 {{ rows.length }} 条（显示 {{ shown.length }}）· 点击行进入工具详情（三件套 + 参数 Schema）
        </span>
        <CopyableId v-if="state === 'ERROR'" :id="err.traceId" label="复制 traceId" />
      </div>
    </StateShell>
  </div>
</template>
