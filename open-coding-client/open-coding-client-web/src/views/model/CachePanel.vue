<script setup lang="ts">
/**
 * 缓存面板（M-09 / 卷 02 D-MDL-8 + 卷 03 D-CTX-6）：
 * cache.enabled 开关 + 缓存断点标记 + 命中率观测；无缓存能力的模型显式标注「已关闭断点标记」与原因，
 * 不静默：缓存未命中时给出可执行建议（调整稳定前缀 / 减少前缀漂移）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtCost, fmtToken, waterTheme, type PageState } from '@/components/gateway/types';
import { CAPABILITY_STATE_META, modelData } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const cacheEnabled = ref(true);
const externalizeThreshold = ref(4096);
const selected = ref(data.cacheObservations[0]?.modelId ?? '');

const observations = computed(() => data.cacheObservations);
const current = computed(() => observations.value.find((o) => o.modelId === selected.value) ?? observations.value[0]);
const breakpoints = computed(() => data.contextSnapshot.cacheBreakpoints);
const driftCount = computed(() => breakpoints.value.filter((b) => b.drift).length);
const totalSaved = computed(() => observations.value.reduce((a, b) => a + b.savedUsd, 0));
const disabledModels = computed(() => observations.value.filter((o) => !o.cacheEnabled));

const columns: PrimaryTableCol[] = [
  { colKey: 'modelId', title: '模型', width: 200 },
  { colKey: 'capability', title: 'cache 能力位', width: 130 },
  { colKey: 'enabled', title: '断点标记', width: 110 },
  { colKey: 'hitRate', title: '命中率', width: 170 },
  { colKey: 'saved', title: '节省（token / 成本）', width: 210 },
  { colKey: 'miss', title: '未命中原因（显式）' },
];

function recompute() {
  MessagePlugin.success(`已按当前配置重算观测：断点 ${cacheEnabled.value ? '开启' : '关闭'}，外置阈值 ${externalizeThreshold.value} token`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = observations.value.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="缓存面板"
      desc="提示词缓存：稳定前缀编排 + 缓存断点标记 + 命中率观测。断点由上下文层声明（卷 03），本层负责投射与统计；缓存未命中会提示「前缀漂移」而非静默降级。"
      volume="卷 02"
      manifest="M-09"
      cli="oc model cache show | oc model cache stats --model claude-sonnet-4.5 --window 14d"
      :status="[{ label: cacheEnabled ? 'cache.enabled=true' : 'cache.enabled=false', theme: cacheEnabled ? 'success' : 'warning' }, { label: `${driftCount} 处前缀漂移`, theme: driftCount ? 'warning' : 'success' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="recompute">重算观测</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="缓存节省（观察窗）" :value="totalSaved" format="cost" icon="discount" :delta="-3.2" hint="缓存折扣单列计量的汇总（净节省已扣除缓存写溢价）" />
      <StatCard label="当前模型命中率" :value="current?.hitRatePct ?? 0" format="percent" icon="refresh" :target="70" target-kind="min" />
      <StatCard label="缓存断点" :value="breakpoints.length" icon="layers" :hint="`漂移 ${driftCount} 处：断点被破坏时命中率会显著下降`" />
      <StatCard label="已关闭断点的模型" :value="disabledModels.length" icon="close" :hint="disabledModels.map((d) => d.modelId).join('、') || '无'" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有缓存观测数据"
      empty-desc="尚未产生带缓存断点的调用；完成一次带稳定前缀的调用后即可观测。"
      empty-action="查看上下文快照"
      what="缓存观测加载失败"
      why="观测数据源不可达；当前显示的可能是最近一次快照（缓存节省金额可能偏低）。"
      how="可重试；观测失败不影响缓存本身生效（断点标记仍按配置投射）。"
      trace-id="trace-cache-8c31"
      missing-permission="cost.read"
      risk-level="R1"
      apply-path="在「权限与审批 → 申请授权」申请 cost.read（金额类字段需该权限；无权限时金额显示为掩码）"
      @retry="state = 'LOADING'"
      @empty-action="state = 'EMPTY'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">缓存配置</div>
          <div class="oc-stack" style="font-size: 13px">
            <div class="oc-flex--between">
              <span>全局 cache.enabled（open-coding.model.cache.enabled）</span>
              <Switch v-model="cacheEnabled" size="small" />
            </div>
            <div class="oc-flex--between">
              <span>工具结果外置阈值（token，超过则外置为引用）</span>
              <Switch :value="externalizeThreshold > 0" size="small" @change="(v) => (externalizeThreshold = v ? 4096 : 0)" />
            </div>
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" variant="outline">阈值 {{ externalizeThreshold }} token</Tag>
              <Button size="small" variant="text" @click="externalizeThreshold = 2048">收紧至 2048</Button>
              <Button size="small" variant="text" @click="externalizeThreshold = 8192">放宽至 8192</Button>
            </div>
            <div class="oc-muted" style="font-size: 12px">
              关闭断点标记后：仍会记录用量与成本，但缓存折扣列固定为 0（不估算、不猜测命中），并在成本看板显式标注「缓存已关闭」。
            </div>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">
            <span>命中率趋势</span>
            <Select :value="selected" :options="observations.map((o) => ({ label: o.modelId, value: o.modelId }))" size="small" style="width: 220px" @change="(v) => (selected = String(v))" />
          </div>
          <OcChart
            type="line"
            format="percent"
            :height="180"
            :series="[{ name: `${current?.modelId ?? ''} 命中率`, points: current?.trend ?? [] }]"
            :threshold="{ value: 70, label: '目标 ≥70%', kind: 'min' }"
            :aria-label="`${current?.modelId ?? ''} 缓存命中率趋势`"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 6px">
            <Tag :theme="waterTheme(current?.hitRatePct ?? 0, 70, 40) === 'success' ? 'success' : 'warning'" size="small" variant="light-outline">
              当前 {{ current?.hitRatePct }}%
            </Tag>
            <Tag size="small" variant="outline">断点 {{ current?.breakpoints ?? 0 }} 个</Tag>
            <Tag size="small" variant="outline">节省 {{ fmtToken(current?.savedTokens ?? 0) }} token / {{ fmtCost(current?.savedUsd ?? 0) }}</Tag>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>逐模型缓存观测与未命中原因</span>
          <Tooltip content="不支持缓存的模型不静默：显示「已关闭断点标记」并给出原因；命中率列展示实测值">
            <span class="oc-muted" style="font-size: 12px">不做估算</span>
          </Tooltip>
        </div>
        <Table :data="observations" :columns="columns" row-key="modelId" size="small" :pagination="{ pageSize: 8, total: observations.length }">
          <template #capability="{ row }">
            <Tag :theme="CAPABILITY_STATE_META[row.cacheEnabled ? 'supported' : 'unsupported'].theme" size="small" variant="light-outline">
              {{ row.cacheEnabled ? CAPABILITY_STATE_META.supported.label : CAPABILITY_STATE_META.unsupported.label }}
            </Tag>
          </template>
          <template #enabled="{ row }">
            <Tag :theme="row.breakpoints > 0 ? 'success' : 'default'" size="small" variant="light-outline">{{ row.breakpoints > 0 ? `已标记 ${row.breakpoints} 个` : '已关闭' }}</Tag>
          </template>
          <template #hitRate="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <Progress :percentage="row.hitRatePct" :status="row.hitRatePct >= 70 ? 'success' : 'warning'" size="small" :style="{ width: '70px' }" />
              <span style="font-size: 12px">{{ row.hitRatePct }}%</span>
            </div>
          </template>
          <template #saved="{ row }">
            <span style="font-size: 12px">{{ fmtToken(row.savedTokens) }} / {{ fmtCost(row.savedUsd) }}</span>
          </template>
          <template #miss="{ row }">
            <span v-if="row.missReason" class="oc-flex" style="gap: 4px">
              <Tag theme="warning" size="small" variant="light-outline">显式标注</Tag>
              <span class="oc-muted" style="font-size: 12px">{{ row.missReason }}</span>
            </span>
            <span v-else class="oc-muted" style="font-size: 12px">{{ row.note }}</span>
          </template>
        </Table>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">缓存断点（来自上下文快照）</div>
        <div class="oc-stack">
          <div v-for="b in breakpoints" :key="b.id" class="oc-flex--between" style="font-size: 13px">
            <span class="oc-flex" style="gap: 6px">
              <b>{{ b.label }}</b>
              <Tag v-if="b.drift" theme="warning" size="small" variant="light-outline">前缀漂移</Tag>
              <span class="oc-muted">{{ b.note }}</span>
            </span>
            <span class="oc-flex" style="gap: 8px">
              <span style="font-size: 12px">覆盖 {{ fmtToken(b.coveredTokens) }} token</span>
              <span style="font-size: 12px">命中 {{ b.hitRatePct }}%</span>
              <span class="oc-muted" style="font-size: 12px">稳定 {{ b.stableTurns }} 轮</span>
            </span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
