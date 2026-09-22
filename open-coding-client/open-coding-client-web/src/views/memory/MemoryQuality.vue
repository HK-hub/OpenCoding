<script setup lang="ts">
/**
 * E-10 记忆质量评测：命中率 / 误用率 / 过期率 / 冲突率 + 一键纠正反哺。
 * 纠正反哺：纠正后同类提议被拦截或降级为「需确认」，并进入规则候选（卷 10 D-MEM-10）。
 * 溯源：卷 10 D-MEM-10 / BUILD-MANIFEST E-10
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.memory;
const q = data.qualityMetrics;

const state = ref<UiStateKind>('LOADING');
const fedBack = ref<string[]>([]);
const target = ref('all');

/** 目标基线（卷 26 定义的质量目标：命中率 ≥ 0.7，误用率 ≤ 0.08） */
const HIT_TARGET = 0.7;
const MISUSE_TARGET = 0.08;

const trendSeries = computed(() => [
  { name: '命中率', points: q.history.map((h) => ({ x: h.week, y: Math.round(h.hitRate * 1000) / 10 })) },
  { name: '误用率', points: q.history.map((h) => ({ x: h.week, y: Math.round(h.misuseRate * 1000) / 10 })) },
]);

const corrections = computed(() => q.corrections.filter((c) => target.value === 'all' || c.memoryId === target.value));

/** 降权名单草案（ref）：生成后渲染在页面；需在治理页确认后才生效 */
const draft = ref<{ id: string; at: string; items: { memoryId: string; reason: string; action: string }[] } | null>(null);
const draftSeq = ref(0);

/**
 * 生成降权名单草案：把纠正记录转成候选降权条目。
 * 草案只是待确认清单，确认前不改变任何召回权重（治理页确认后才生效）。
 */
function buildDowngradeDraft() {
  draftSeq.value += 1;
  const id = `draft-dw-${draftSeq.value}`;
  const items = q.corrections.map((c) => ({
    memoryId: c.memoryId,
    reason: `${c.by} 纠正：${c.text}`,
    action: '召回降权 30%，同类提议需确认',
  }));
  draft.value = { id, at: new Date().toISOString(), items };
  MessagePlugin.info(`已生成降权名单草案 ${id}（${items.length} 条）：需在治理页确认后生效`);
}

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function feedback(memoryId: string) {
  if (!fedBack.value.includes(memoryId)) fedBack.value.push(memoryId);
  MessagePlugin.success('已反哺规则：同类候选默认降级为「需确认」，并在 24h 内观察误用率变化');
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="记忆质量评测"
      desc="用四项指标回答「记忆是否可信」：命中率、误用率（用户纠正次数）、过期率、冲突率；纠正可一键反哺规则。"
      volume="卷 10"
      manifest="E-10"
      cli="oc memory quality --window 8w"
      :status="[{ label: q.hitRate >= HIT_TARGET ? '命中率达标' : '命中率未达标', theme: q.hitRate >= HIT_TARGET ? 'success' : 'danger' }, { label: '指标可下钻', theme: 'primary' }]"
    >
      <template #actions>
        <Select v-model="target" size="small" style="width: 200px" :options="[{ label: '全部条目', value: 'all' }, ...q.corrections.map((c) => ({ label: c.memoryId, value: c.memoryId }))]" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="召回命中率" :value="q.hitRate" :target="HIT_TARGET" unit="" format="percent" icon="check" :delta="2.4" :lower-is-better="false" hint="被真正注入上下文的比例（抽样）" />
      <StatCard label="误用率" :value="q.misuseRate" :target="MISUSE_TARGET" :target-kind="'max'" format="percent" icon="close" :lower-is-better="true" :delta="-0.8" hint="以用户纠正次数 / 召回次数衡量" />
      <StatCard label="过期率" :value="q.expiredRate" :target="0.15" :target-kind="'max'" format="percent" icon="time" :lower-is-better="true" hint="超出 TTL/复审时间仍在召回的条目占比" />
      <StatCard label="冲突率" :value="q.conflictRate" :target="0.05" :target-kind="'max'" format="percent" icon="bug" :lower-is-better="true" hint="同键不同值 + 语义矛盾占比" />
    </div>

    <StateShell
      :state="state"
      stage="计算质量指标…"
      empty-title="窗口内没有评测样本"
      empty-desc="需要至少一次召回与一次用户反馈才能计算质量指标；可先跑一轮检索或完成一次纠正。"
      empty-action="查看召回调试"
      example-task="对一条过期记忆提交纠正，观察误用率变化"
      what="质量指标加载失败"
      why="评测样本聚合失败（recall 事件缺失或抽样任务未完成）。"
      how="可重试；指标缺失时按上一窗口数据展示，并标注「数据缺口」。"
      trace-id="trace-mq-91f0c7"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            近 8 周趋势
            <span class="oc-muted" style="font-size: 12px">命中率（越高越好）· 误用率（越低越好）</span>
          </h3>
          <OcChart type="line" :series="trendSeries" :height="200" format="percent" unit="%" aria-label="记忆质量趋势" :threshold="{ value: HIT_TARGET * 100, label: '命中率目标 70%', kind: 'min' }" />
          <div class="oc-flex oc-flex--wrap" style="gap: 10px; font-size: 12px; margin-top: 6px">
            <span class="oc-secondary">命中率 {{ (q.hitRate * 100).toFixed(1) }}%（目标 ≥ {{ (HIT_TARGET * 100).toFixed(0) }}%）</span>
            <span class="oc-secondary">误用率 {{ (q.misuseRate * 100).toFixed(2) }}%（目标 ≤ {{ (MISUSE_TARGET * 100).toFixed(0) }}%）</span>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">指标口径（可解释）</h3>
          <div class="oc-kv">
            <span class="oc-kv__k">命中率</span><span>注入 S4 且被模型实际引用的条目 / 注入条目（抽样 + 引用核对）</span>
            <span class="oc-kv__k">误用率</span><span>用户纠正次数 / 召回次数；纠正后同类候选降级</span>
            <span class="oc-kv__k">过期率</span><span>TTL 已过或复审逾期仍被召回的条目 / 总管条数</span>
            <span class="oc-kv__k">冲突率</span><span>冲突条目对 / 总管条数；高严重度冲突单列</span>
          </div>
          <div class="oc-divider" />
          <div class="oc-flex" style="gap: 8px">
            <OcIcon name="help" size="14px" />
            <span class="oc-secondary" style="font-size: 12px">
              质量指标只用于治理，不参与权限判定；未达标时优先「降权 + 复审」，而非直接删除条目。
            </span>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          纠正记录与反哺
          <span class="oc-muted" style="font-size: 12px">一键反哺：把纠正转化为规则候选（拦截 / 降级同类提议）</span>
        </h3>
        <Table
          :data="corrections"
          :columns="[
            { colKey: 'at', title: '时间', width: 170, cell: 'cell' },
            { colKey: 'memoryId', title: '条目', width: 110 },
            { colKey: 'by', title: '纠正人', width: 140 },
            { colKey: 'text', title: '纠正内容', cell: 'cell' },
            { colKey: 'feedback', title: '反哺', width: 150, cell: 'cell' },
          ]"
          row-key="text"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'at'">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template v-else-if="col.colKey === 'feedback'">
              <Tag v-if="fedBack.includes(row.memoryId)" size="small" theme="success">已反哺</Tag>
              <Tag v-else-if="row.feedback" size="small" theme="warning" variant="light-outline">可反哺</Tag>
              <Tag v-else size="small" variant="outline">仅归档</Tag>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
          <Popconfirm content="反哺会把该纠正转为规则候选：同类提议默认「需确认」，并纳入召回降权名单。" @confirm="feedback(q.corrections[0]?.memoryId ?? 'mem-p-05')">
            <Button theme="primary"><OcIcon name="refresh" size="12px" /> 一键纠正反哺</Button>
          </Popconfirm>
          <Button variant="outline" @click="buildDowngradeDraft">生成降权名单</Button>
          <span class="oc-muted" style="font-size: 12px">反哺效果在下一个窗口（7 天）内可见，避免即时抖动导致误判。</span>
        </div>
      </div>

      <div v-if="draft" class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          降权名单草案 <span class="oc-mono" style="font-size: 12px">{{ draft.id }}</span>
          <span class="oc-flex" style="gap: 6px">
            <Tag size="small" theme="warning" variant="light-outline">待确认才生效</Tag>
            <span class="oc-muted" style="font-size: 12px">生成于 {{ new Date(draft.at).toLocaleString('zh-CN') }} · 确认入口：组织记忆治理</span>
          </span>
        </h3>
        <Table
          :data="draft.items"
          :columns="[
            { colKey: 'memoryId', title: '条目', width: 110 },
            { colKey: 'reason', title: '降权依据', cell: 'cell' },
            { colKey: 'action', title: '草案动作', width: 240 },
          ]"
          row-key="memoryId"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'reason'">
              <span class="oc-clamp-2" style="display: block; max-width: 420px">{{ row.reason }}</span>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">草案未确认前不改变召回权重；确认后按「降权 + 复审」处理，不做直接删除。</div>
      </div>
    </StateShell>
  </div>
</template>
