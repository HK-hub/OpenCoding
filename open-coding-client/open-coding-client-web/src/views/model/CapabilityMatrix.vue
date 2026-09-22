<script setup lang="ts">
/**
 * 能力矩阵（M-05 / 卷 02 §4.2）：
 * 8+2 能力位 × 三态（supported/degraded/unsupported）+ 不支持时显式行为 tooltip。
 * 不支持一律「显式失败 + 替代建议」，禁止静默丢弃（除策略显式允许 downgrade.to-text）。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, RadioGroup, RadioButton, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CapabilityGrid from '@/components/gateway/CapabilityGrid.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import type { PageState } from '@/components/gateway/types';
import { CAPABILITY_META, CAPABILITY_STATE_META, modelData } from '@/mock/data/model';
import type { CapabilityKey, CapabilityState, ModelDescriptorData } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const data = modelData;
const state = ref<PageState>('LOADING');
const filterKey = ref<'ALL' | CapabilityKey>('ALL');
const filterState = ref<'ANY' | CapabilityState>('ANY');
const view = ref<'matrix' | 'detail'>('matrix');
const detailModel = ref<ModelDescriptorData>(data.models[0]);

const keyOptions = [{ label: '全部能力位', value: 'ALL' }, ...CAPABILITY_META.map((c) => ({ label: `${c.label}（${c.group}）`, value: c.key }))];
const stateOptions = [
  { label: '任意态', value: 'ANY' },
  ...(Object.keys(CAPABILITY_STATE_META) as CapabilityState[]).map((k) => ({ label: CAPABILITY_STATE_META[k].label, value: k })),
];

const filtered = computed(() =>
  data.models.filter((m) => {
    if (filterKey.value !== 'ALL' && filterState.value !== 'ANY' && m.capabilities[filterKey.value] !== filterState.value) return false;
    return true;
  }),
);

/** 每个能力位的三态分布（用于顶部「缺口概览」，显式暴露能力缺口） */
const gaps = computed(() =>
  CAPABILITY_META.map((c) => {
    const states = data.models.map((m) => m.capabilities[c.key]);
    return {
      key: c.key, label: c.label, group: c.group,
      supported: states.filter((s) => s === 'supported').length,
      degraded: states.filter((s) => s === 'degraded').length,
      unsupported: states.filter((s) => s === 'unsupported').length,
      behavior: c.unsupportedBehavior,
    };
  }),
);

const totalUnsupported = computed(() => gaps.value.reduce((a, b) => a + b.unsupported, 0));
const totalDegraded = computed(() => gaps.value.reduce((a, b) => a + b.degraded, 0));

const columns: PrimaryTableCol[] = [
  { colKey: 'model', title: '模型', width: 220 },
  ...CAPABILITY_META.map((c) => ({ colKey: c.key, title: c.label, width: 92, align: 'center' as const })),
];

onMounted(() => {
  window.setTimeout(() => (state.value = data.models.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="能力矩阵"
      desc="8+2 能力位 × 三态：调用前做能力校验（本地矩阵，内存缓存），不支持则报 UNSUPPORTED_CAPABILITY 并给出可切换模型建议；只有策略显式允许才降级，且生成 capability.degraded 事件。"
      volume="卷 02"
      manifest="M-05"
      cli="oc model capability matrix --state unsupported | oc model capability check --model llama-4-scout --need vision"
      :status="[{ label: `${totalUnsupported} 处不支持`, theme: totalUnsupported ? 'warning' : 'success' }, { label: `${totalDegraded} 处降级`, theme: 'default' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <RadioGroup v-model="view" variant="default-filled" size="small">
          <RadioButton value="matrix">矩阵</RadioButton>
          <RadioButton value="detail">单模型</RadioButton>
        </RadioGroup>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="能力位数量" :value="CAPABILITY_META.length" icon="sitemap" hint="8 个基础位 + 2 个扩展位（longContext / embeddings）" />
      <StatCard label="不支持项（全部模型）" :value="totalUnsupported" icon="close" :hint="'每项均有「不支持时的显式行为」，不存在静默丢弃路径'" />
      <StatCard label="降级项" :value="totalDegraded" icon="loading" hint="降级会生成 capability.degraded 事件并在会话流标注" />
      <StatCard label="矩阵模型数" :value="data.models.length" icon="database" :target="16" target-kind="min" />
    </div>

    <StateShell
      :state="state"
      empty-title="能力矩阵为空"
      empty-desc="目录中没有模型，无法计算能力位。"
      empty-action="前往模型目录"
      what="能力矩阵加载失败"
      why="目录缓存读取异常；能力校验会退回「按请求声明」的保守模式并放慢探测。"
      how="可重试；能力校验失败时内核不会猜测能力，会显式报错。"
      trace-id="trace-caps-4d17"
      missing-permission="model.manage"
      risk-level="R1"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage（只读查看可申请临时 R1 授权）"
      @retry="state = 'LOADING'"
      @empty-action="router.push('/model/catalog')"
    >
      <div class="oc-flex oc-flex--wrap" style="margin-bottom: 8px">
        <Select v-model="filterKey" :options="keyOptions" size="small" style="width: 200px" />
        <Select v-model="filterState" :options="stateOptions" size="small" style="width: 130px" />
        <span class="oc-muted" style="font-size: 12px">命中 {{ filtered.length }} 个模型（过滤仅在「能力位 + 状态」同时指定时生效）</span>
      </div>

      <div v-if="view === 'matrix'" class="oc-card">
        <div class="oc-card__title">
          <span>矩阵视图（列头 tooltip = 能力位语义；单元格 tooltip = 不支持时的显式行为）</span>
          <span class="oc-muted" style="font-size: 12px">点击行进入模型详情</span>
        </div>
        <Table :data="filtered" :columns="columns" row-key="modelId" size="small" table-layout="fixed" :pagination="{ pageSize: 12, total: filtered.length }" @row-click="(ctx) => router.push(`/model/catalog/${ctx.row.modelId}`)">
          <template #model="{ row }">
            <span class="oc-mono" style="font-size: 12px">{{ row.modelId }}</span>
          </template>
          <template v-for="c in CAPABILITY_META" :key="c.key" #[c.key]="{ row }">
            <Tooltip :content="row.capabilities[c.key] === 'unsupported' ? `不支持 → ${c.unsupportedBehavior}` : CAPABILITY_STATE_META[row.capabilities[c.key] as CapabilityState].hint">
              <Tag :theme="CAPABILITY_STATE_META[row.capabilities[c.key] as CapabilityState].theme" size="small" variant="light-outline">
                {{ CAPABILITY_STATE_META[row.capabilities[c.key] as CapabilityState].label }}
              </Tag>
            </Tooltip>
          </template>
        </Table>
      </div>

      <div v-else class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">
            <span>单模型能力位</span>
            <Select
              :value="detailModel.modelId"
              :options="data.models.map((m) => ({ label: m.modelId, value: m.modelId }))"
              size="small"
              style="width: 220px"
              @change="(v) => (detailModel = data.models.find((m) => m.modelId === String(v)) ?? detailModel)"
            />
          </div>
          <CapabilityGrid :capabilities="detailModel.capabilities" />
          <div class="oc-divider" />
          <div class="oc-stack" style="font-size: 13px">
            <div v-for="c in CAPABILITY_META.filter((x) => detailModel.capabilities[x.key] !== 'supported')" :key="c.key">
              <Tag :theme="detailModel.capabilities[c.key] === 'degraded' ? 'warning' : 'default'" size="small" variant="light-outline">{{ c.label }}</Tag>
              <span style="margin-left: 6px">{{ c.unsupportedBehavior }}</span>
            </div>
            <div v-if="CAPABILITY_META.every((x) => detailModel.capabilities[x.key] === 'supported')" class="oc-muted">全部 10 个能力位原生支持，无缺口。</div>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">能力缺口概览（全部模型）</div>
          <div class="oc-stack" style="font-size: 13px">
            <div v-for="g in gaps" :key="g.key" class="oc-flex oc-flex--wrap" style="gap: 6px">
              <b style="width: 104px">{{ g.label }}</b>
              <Tag theme="success" size="small" variant="light-outline">{{ g.supported }} 支持</Tag>
              <Tag v-if="g.degraded" theme="warning" size="small" variant="light-outline">{{ g.degraded }} 降级</Tag>
              <Tag v-if="g.unsupported" size="small" variant="outline">{{ g.unsupported }} 不支持</Tag>
              <Tooltip :content="`不支持时：${g.behavior}`">
                <span class="oc-muted" style="font-size: 12px">{{ g.group }}</span>
              </Tooltip>
            </div>
          </div>
          <div class="oc-divider" />
          <div class="oc-muted" style="font-size: 12px">
            典型缺口：<span class="oc-mono">text-embedding-4</span> 的 tools 不支持 → 装配期拒绝用于编码模式；<span class="oc-mono">llama-4-scout</span> 的 vision 不支持 → 含图片请求直接报错并建议切换。
          </div>
          <div class="oc-flex" style="margin-top: 10px">
            <Button size="small" variant="outline" @click="router.push('/model/errors')">查看 UNSUPPORTED_CAPABILITY 样本</Button>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
