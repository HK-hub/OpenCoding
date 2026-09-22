<script setup lang="ts">
/**
 * 模型目录（M-04 / 卷 02 §10）：
 * 三源合并（内置目录 / 用户自定义 / 端点探测）+ 冲突高亮 + 能力位过滤，点击进入模型详情。
 * 冲突时保留用户配置优先，并显式标注「评测未跑 / 定价被改写」。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, RadioGroup, RadioButton, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import type { PageState } from '@/components/gateway/types';
import { CAPABILITY_META, CAPABILITY_STATE_META, MODEL_SOURCE_META, modelData } from '@/mock/data/model';
import type { CapabilityKey, CapabilityState, ModelDescriptorData, ModelSource } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const data = modelData;
const state = ref<PageState>('LOADING');
const keyword = ref('');
const source = ref<'ALL' | ModelSource>('ALL');
const capKey = ref<'ALL' | CapabilityKey>('ALL');
const capState = ref<'ANY' | CapabilityState>('ANY');
const conflictOnly = ref(false);
const pageSize = ref(10);

const sourceOptions = [
  { label: '全部来源', value: 'ALL' },
  ...(Object.keys(MODEL_SOURCE_META) as ModelSource[]).map((k) => ({ label: MODEL_SOURCE_META[k].label, value: k })),
];
const capOptions = [{ label: '全部能力位', value: 'ALL' }, ...CAPABILITY_META.map((c) => ({ label: `${c.label}（${c.group}）`, value: c.key }))];
const capStateOptions = [
  { label: '任意态', value: 'ANY' },
  ...(Object.keys(CAPABILITY_STATE_META) as CapabilityState[]).map((k) => ({ label: CAPABILITY_STATE_META[k].label, value: k })),
];

const filtered = computed(() =>
  data.models.filter((m) => {
    if (source.value !== 'ALL' && m.source !== source.value) return false;
    if (capKey.value !== 'ALL' && capState.value !== 'ANY' && m.capabilities[capKey.value] !== capState.value) return false;
    if (conflictOnly.value && m.conflictWith.length === 0) return false;
    if (keyword.value && !`${m.modelId}${m.displayName}${m.providerId}${m.tags.join('')}`.toLowerCase().includes(keyword.value.toLowerCase())) return false;
    return true;
  }),
);
const rows = computed(() => (state.value === 'EDGE_DATA' ? filtered.value.slice(0, pageSize.value) : filtered.value));

const conflicts = computed(() => data.models.filter((m) => m.conflictWith.length > 0));
const bySource = computed(() => (Object.keys(MODEL_SOURCE_META) as ModelSource[]).map((k) => ({ key: k, count: data.models.filter((m) => m.source === k).length })));

const columns: PrimaryTableCol[] = [
  { colKey: 'modelId', title: '模型（modelId / 显示名）', width: 280 },
  { colKey: 'provider', title: 'Provider', width: 170 },
  { colKey: 'capacity', title: '上下文窗口 / 最大输出', width: 190 },
  { colKey: 'pricing', title: '定价（入/出/缓存读/缓存写）', width: 240 },
  { colKey: 'caps', title: '能力位摘要', width: 200 },
  { colKey: 'source', title: '来源 / 版本', width: 180 },
  { colKey: 'conflict', title: '冲突', width: 150 },
];

/** 能力位摘要：支持 / 降级 / 不支持计数（不隐藏不支持项，避免静默） */
function capSummary(m: ModelDescriptorData) {
  const values = Object.values(m.capabilities);
  return {
    supported: values.filter((v) => v === 'supported').length,
    degraded: values.filter((v) => v === 'degraded').length,
    unsupported: values.filter((v) => v === 'unsupported').length,
  };
}

function loadMore() {
  pageSize.value += 10;
  if (pageSize.value >= filtered.value.length) state.value = 'NORMAL';
}

/** 清空全部过滤条件（空态主行动） */
function clearFilters() {
  keyword.value = '';
  source.value = 'ALL';
  capKey.value = 'ALL';
  capState.value = 'ANY';
  conflictOnly.value = false;
}

onMounted(() => {
  window.setTimeout(() => (state.value = data.models.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="模型目录"
      desc="三源合并：内置目录（随版本）→ 端点探测（source=probed）→ 用户自定义（source=user，优先级最高）。同名冲突保留用户配置并在界面高亮，不静默覆盖。"
      volume="卷 02"
      manifest="M-04"
      cli="oc model catalog list --source user --capability vision=supported"
      :status="[{ label: '目录为进程内缓存', theme: 'default' }, { label: `${conflicts.length} 处冲突`, theme: conflicts.length ? 'warning' : 'success' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="conflictOnly = !conflictOnly">
          {{ conflictOnly ? '查看全部' : `仅看冲突（${conflicts.length}）` }}
        </Button>
        <Button size="small" theme="primary" @click="router.push('/model/providers')">探测新端点</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="目录模型总数" :value="data.models.length" icon="database" :delta="6.2" :lower-is-better="false" />
      <StatCard v-for="s in bySource" :key="s.key" :label="MODEL_SOURCE_META[s.key].label" :value="s.count" icon="layers" :hint="s.key === 'user' ? '用户配置优先：与内置同名时覆盖能力位与定价' : s.key === 'probed' ? '端点探测导入，能力位未探测到的一律标 unsupported' : '随版本内置，可远程覆盖定价（离线形态禁用）'" />
    </div>

    <StateShell
      :state="state"
      empty-title="目录中没有匹配的模型"
      empty-desc="当前过滤条件下没有模型；可放宽能力位或来源过滤。"
      empty-action="清空过滤"
      example-task="接入 Ollama 后按「探测导入」把本地模型纳入目录"
      what="模型目录加载失败"
      why="目录服务返回错误；当前展示的可能是过期缓存（最后更新时间未知）。"
      how="可重试；离线形态下目录沿用内置快照，定价更新会被禁用。"
      trace-id="trace-catalog-91b0"
      missing-permission="model.manage"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage"
      :collapsed-summary="`共 ${filtered.length} 个模型，超出单屏渲染阈值，已折叠展示（虚拟化阈值 10000）。`"
      :page-size="pageSize"
      @retry="state = 'LOADING'"
      @load-more="loadMore"
      @empty-action="clearFilters"
    >
      <div class="oc-flex oc-flex--wrap" style="margin-bottom: 8px">
        <Input v-model="keyword" placeholder="搜索 modelId / 显示名 / 标签" clearable size="small" style="width: 240px" />
        <Select v-model="source" :options="sourceOptions" size="small" style="width: 150px" />
        <Select v-model="capKey" :options="capOptions" size="small" style="width: 190px" />
        <Select v-model="capState" :options="capStateOptions" size="small" style="width: 120px" />
        <RadioGroup v-model="conflictOnly" variant="default-filled" size="small">
          <RadioButton :value="false">全部</RadioButton>
          <RadioButton :value="true">仅冲突</RadioButton>
        </RadioGroup>
        <span class="oc-muted" style="font-size: 12px">{{ filtered.length }} 条命中</span>
      </div>

      <Table :data="rows" :columns="columns" row-key="modelId" size="small" stripe hover :pagination="{ pageSize: 12, total: rows.length }" @row-click="(ctx) => router.push(`/model/catalog/${ctx.row.modelId}`)">
        <template #modelId="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono">{{ row.modelId }}</span>
            <span class="oc-muted" style="font-size: 12px">{{ row.displayName }} · {{ row.tags.join(' / ') }}</span>
          </div>
        </template>
        <template #provider="{ row }">
          <span class="oc-mono" style="font-size: 12px">{{ row.providerId }}</span>
        </template>
        <template #capacity="{ row }">
          {{ (row.contextWindow / 1000).toFixed(0) }}k 窗口 / {{ row.maxOutput ? (row.maxOutput / 1000).toFixed(0) + 'k' : '—' }}
        </template>
        <template #pricing="{ row }">
          <span class="oc-mono" style="font-size: 12px">
            {{ row.pricing.currency }} {{ row.pricing.input }} / {{ row.pricing.output }} / {{ row.pricing.cacheRead }} / {{ row.pricing.cacheWrite }}
          </span>
        </template>
        <template #caps="{ row }">
          <span class="oc-flex" style="gap: 4px">
            <Tag theme="success" size="small" variant="light-outline">{{ capSummary(row as ModelDescriptorData).supported }} 支持</Tag>
            <Tag v-if="capSummary(row as ModelDescriptorData).degraded" theme="warning" size="small" variant="light-outline">{{ capSummary(row as ModelDescriptorData).degraded }} 降级</Tag>
            <Tag v-if="capSummary(row as ModelDescriptorData).unsupported" size="small" variant="outline">{{ capSummary(row as ModelDescriptorData).unsupported }} 不支持</Tag>
          </span>
        </template>
        <template #source="{ row }">
          <span class="oc-flex" style="gap: 4px">
            <Tag :theme="MODEL_SOURCE_META[row.source as ModelSource].theme" size="small" variant="light-outline">{{ MODEL_SOURCE_META[row.source as ModelSource].label }}</Tag>
            <span class="oc-muted" style="font-size: 12px">{{ row.version }}</span>
          </span>
        </template>
        <template #conflict="{ row }">
          <Tooltip v-if="row.conflictWith.length" :content="`与 ${row.conflictWith.join('、')} 同名：保留用户配置优先，能力位/定价被改写，且该来源未跑评测`">
            <Tag theme="warning" size="small" variant="light-outline">同名冲突 {{ row.conflictWith.length }}</Tag>
          </Tooltip>
          <span v-else class="oc-muted">—</span>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
