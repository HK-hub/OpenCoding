<script setup lang="ts">
/**
 * E-01 记忆中心：四层 Tab（工作/会话/项目/组织）+ 条目列表 + 容量提示。
 * 记忆 ≠ 知识：本页只展示「跨会话可复用的偏好、约定与结论」，文档索引见知识库 W-01…W-09。
 * 溯源：卷 10 §4.1 / BUILD-MANIFEST E-01
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData, MEMORY_SCOPE_LABEL } from '@/mock/data/knowledge';
import type { MemoryEntry, MemoryScope } from '@/mock/data/knowledge';

const ui = useUiStore();
const router = useRouter();
const data = knowledgeData.memory;

const tab = ref<MemoryScope>('project');
const keyword = ref('');
const stateFilter = ref('all');
const pageSize = ref(8);
const state = ref<UiStateKind>('LOADING');

/** 容量上限（卷 10 §7：单项目默认 5k，超限提示归档） */
const CAPACITY = 5000;

const scoped = computed(() => data.entries.filter((e) => e.scope === tab.value));
const filtered = computed(() =>
  scoped.value.filter((e) => {
    const hitKeyword = !keyword.value || `${e.key}${e.value}${e.tags.join('')}`.toLowerCase().includes(keyword.value.toLowerCase());
    const hitState = stateFilter.value === 'all' || e.status === stateFilter.value;
    return hitKeyword && hitState;
  }),
);
const rows = computed<MemoryEntry[]>(() => filtered.value.slice(0, pageSize.value));
const isEdge = computed(() => filtered.value.length > pageSize.value && state.value === 'NORMAL');

const counts = computed(() => ({
  work: data.entries.filter((e) => e.scope === 'work').length,
  session: data.entries.filter((e) => e.scope === 'session').length,
  project: data.entries.filter((e) => e.scope === 'project').length,
  org: data.entries.filter((e) => e.scope === 'org').length,
}));
const pendingProposals = computed(() => data.proposals.filter((p) => p.state === 'pending').length);
const unresolvedConflicts = computed(() => data.conflicts.filter((c) => c.resolution.startsWith('未决')).length);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '边界数据', value: 'EDGE_DATA' },
];

const columns = [
  { colKey: 'memoryId', title: '编号', width: 132, cell: 'cell' },
  { colKey: 'key', title: 'Key', width: 200, cell: 'cell' },
  { colKey: 'value', title: '结论（可执行）', cell: 'cell' },
  { colKey: 'tags', title: '标签 / 路径', width: 210, cell: 'cell' },
  { colKey: 'confidence', title: '置信', width: 72, cell: 'cell' },
  { colKey: 'status', title: '状态', width: 96, cell: 'cell' },
  { colKey: 'sensitivity', title: '敏感级', width: 80, cell: 'cell' },
  { colKey: 'ttl', title: '时效 / 复审', width: 150, cell: 'cell' },
  { colKey: 'op', title: '操作', width: 76, cell: 'cell' },
];

function confidenceTheme(c: string) {
  return c === '高' ? 'success' : c === '中' ? 'warning' : 'danger';
}
function statusTheme(s: string) {
  return s === 'active' ? 'success' : s === 'superseded' ? 'warning' : 'default';
}
function sensitivityTheme(s: string) {
  return s === '敏感' ? 'danger' : s === '内部' ? 'warning' : 'default';
}

function openDetail(row: MemoryEntry) {
  router.push({ path: '/memory/detail', query: { id: row.memoryId } });
}

function switchState(v: string) {
  const next = v as UiStateKind;
  state.value = next;
  ui.setViewState({
    state: next,
    what: '记忆条目加载失败',
    why: '记忆索引服务不可达（io.netty 连接被拒绝）。',
    how: '可重试；若持续失败请检查索引服务与 Redis 连接后再次加载。',
    traceId: 'trace-mem-7f31c2',
    retryable: true,
  });
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="记忆中心"
      desc="四层记忆（工作/会话/项目/组织）统一视图：置信度、时效、敏感级与版本链一目了然；写入一律先候选、后确认。"
      volume="卷 10"
      manifest="E-01"
      cli="oc memory list --scope project --status active"
      :status="[{ label: '记忆 ≠ 知识', theme: 'warning' }, { label: '四层作用域', theme: 'primary' }]"
    >
      <template #actions>
        <Select v-model="stateFilter" size="small" style="width: 132px" :options="[{ label: '全部状态', value: 'all' }, { label: 'active', value: 'active' }, { label: 'superseded', value: 'superseded' }, { label: 'archived', value: 'archived' }, { label: 'deleted', value: 'deleted' }]" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => switchState(String(v))" />
        <Button size="small" variant="outline" @click="router.push('/memory/proposals')">
          <OcIcon name="check" size="12px" /> 候选确认（{{ pendingProposals }}）
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="记忆条目" :value="data.entries.length" unit="条" icon="bookmark" hint="四层合计" />
      <StatCard label="项目层容量" :value="counts.project" :target="CAPACITY" unit="条" icon="database" hint="单项目默认上限 5000 条，超限提示归档" />
      <StatCard label="待确认候选" :value="pendingProposals" unit="条" icon="check" :lower-is-better="true" hint="候选 → 确认后才落库，全部可撤销" />
      <StatCard label="未决冲突" :value="unresolvedConflicts" unit="条" icon="bug" :lower-is-better="true" hint="高严重度冲突裁决前执行最严格策略" />
    </div>

    <StateShell
      :state="state"
      :stage="'加载记忆条目…'"
      :cancellable="true"
      empty-title="该层还没有记忆条目"
      empty-desc="工作记忆随任务结束时释放；项目/组织层需先通过写入候选确认。"
      empty-action="去确认写入候选"
      example-task="把「发布必须双人评审」记到组织记忆"
      what="记忆条目加载失败"
      why="记忆索引服务不可达（连接被拒绝或索引重建中）。"
      how="可重试；也可先查看候选队列与文件化同步状态定位原因。"
      trace-id="trace-mem-7f31c2"
      :retryable="true"
      :collapsed-summary="`共 ${filtered.length} 条，超出阈值的部分已折叠`"
      :page-size="pageSize"
      @retry="switchState('NORMAL')"
      @cancel="switchState('NORMAL')"
      @empty-action="router.push('/memory/proposals')"
      @load-more="pageSize += 8"
    >
      <div class="oc-card">
        <div class="oc-flex--between" style="margin-bottom: 10px">
          <div class="oc-flex" style="gap: 6px">
            <Button
              v-for="s in (['work', 'session', 'project', 'org'] as MemoryScope[])"
              :key="s"
              size="small"
              :theme="tab === s ? 'primary' : 'default'"
              :variant="tab === s ? 'base' : 'outline'"
              @click="tab = s; pageSize = 8"
            >
              {{ MEMORY_SCOPE_LABEL[s] }}（{{ counts[s] }}）
            </Button>
          </div>
          <Input v-model="keyword" size="small" style="width: 240px" placeholder="搜索 key / 结论 / 标签" clearable>
            <template #prefix-icon><OcIcon name="search" size="14px" /></template>
          </Input>
        </div>

        <div class="oc-muted" style="font-size: 12px; margin-bottom: 8px">
          {{ tab === 'work' ? '工作记忆：当前任务的中间结论与假设，任务结束即释放（不持久化为记忆）。' : null }}
          {{ tab === 'session' ? '会话记忆：跨轮摘要与用户偏好，随会话存活期；归档后自动转 archived。' : null }}
          {{ tab === 'project' ? '项目记忆：仓库约定与架构决策，文件为源（.oc/memory/*.md），DB 仅作索引。' : null }}
          {{ tab === 'org' ? '组织记忆：跨项目规范，需提案-评审-发布；敏感级按角色可见。' : null }}
          {{ tab === 'project' && counts.project > CAPACITY * 0.8 ? '· 容量已达 80%，建议归档过期条目。' : null }}
        </div>

        <Table :data="rows" :columns="columns" row-key="memoryId" size="small" hover stripe @row-click="(ctx) => openDetail(ctx.row as MemoryEntry)">
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'memoryId'">
              <CopyableId :id="row.memoryId" label="复制记忆编号" />
            </template>
            <template v-else-if="col.colKey === 'key'">
              <span class="oc-mono">{{ row.key }}</span>
              <Tooltip v-if="row.supersededBy || row.supersedes" :content="`版本链：${row.supersedes ?? '—'} → ${row.memoryId} → ${row.supersededBy ?? '—'}`">
                <Tag size="small" variant="light-outline" theme="warning" style="margin-left: 4px">版本链</Tag>
              </Tooltip>
            </template>
            <template v-else-if="col.colKey === 'value'">
              <span class="oc-clamp-2" style="display: block; max-width: 420px">{{ row.value }}</span>
            </template>
            <template v-else-if="col.colKey === 'tags'">
              <Tag v-for="t in row.tags" :key="t" size="small" variant="outline">{{ t }}</Tag>
              <div v-if="row.paths.length" class="oc-mono oc-muted oc-truncate" style="max-width: 200px">📄 {{ row.paths[0] }}</div>
            </template>
            <template v-else-if="col.colKey === 'confidence'">
              <Tag size="small" :theme="confidenceTheme(row.confidence)" variant="light-outline">置信{{ row.confidence }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'status'">
              <Tag size="small" :theme="statusTheme(row.status)">{{ row.status }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'sensitivity'">
              <Tag size="small" :theme="sensitivityTheme(row.sensitivity)" variant="light-outline">{{ row.sensitivity }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'ttl'">
              <div style="font-size: 12px">{{ row.ttl }}</div>
              <div class="oc-muted" style="font-size: 11px">复审：{{ row.reviewAt }}</div>
            </template>
            <template v-else-if="col.colKey === 'op'">
              <Button size="small" variant="text" @click.stop="openDetail(row)">详情</Button>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>

        <div v-if="isEdge" class="oc-flex" style="justify-content: center; margin-top: 8px">
          <Button size="small" variant="text" @click="pageSize += 8">
            加载更多（已渲染 {{ rows.length }} / {{ filtered.length }} 条）
          </Button>
        </div>
      </div>
    </StateShell>
  </div>
</template>
