<script setup lang="ts">
/**
 * E-04 召回调试：命中条目 + 分数 + 是否被使用 + 来源标注 + 延迟分解 + 预算裁剪。
 * 召回链：候选生成（规则+全文+向量）→ 打分 → 权限过滤 → 去重合并 → 预算裁剪 → 注入 S4（卷 10 §4.3）。
 * 溯源：卷 10 §4.3 / BUILD-MANIFEST E-04
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.memory;

const state = ref<UiStateKind>('LOADING');
const activeIdx = ref(0);
const query = computed(() => data.recallDebug[activeIdx.value]);

const usedCount = computed(() => query.value.hits.filter((h) => h.used).length);
const latencyTotal = computed(() => {
  const b = query.value.latencyBreakdown;
  return b.ruleMs + b.fulltextMs + b.vectorMs + b.rerankMs;
});
/** 延迟预算：召回管线 P95 ≤ 150ms（卷 10 §7） */
const LATENCY_BUDGET = 150;

const latencySeries = computed(() => [
  {
    name: '本期延迟（ms）',
    points: [
      { x: '规则', y: query.value.latencyBreakdown.ruleMs },
      { x: '全文', y: query.value.latencyBreakdown.fulltextMs },
      { x: '向量', y: query.value.latencyBreakdown.vectorMs },
      { x: '重排', y: query.value.latencyBreakdown.rerankMs },
    ],
  },
]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '权限受限', value: 'PERMISSION_DENIED' },
];

function sourceTheme(s: string) {
  return s === '规则' ? 'primary' : s === '全文' ? 'success' : s === '向量' ? 'warning' : 'default';
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="召回调试"
      desc="逐次召回的可解释视图：命中条目与分数、是否真正被注入上下文、三路来源标注、延迟分解与预算裁剪明细。"
      volume="卷 10"
      manifest="E-04"
      cli="oc memory recall-debug --session sess-2f81 --last 3"
      :status="[{ label: '召回预算 S4 ≤ 5%', theme: 'primary' }, { label: '裁剪可见', theme: 'warning' }]"
    >
      <template #actions>
        <Select v-model="activeIdx" size="small" style="width: 260px" :options="data.recallDebug.map((q, i) => ({ label: q.query, value: i }))" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="命中条目" :value="query.hits.length" unit="条" icon="bookmark" />
      <StatCard label="实际注入" :value="usedCount" unit="条" icon="check" hint="仅被使用（注入 S4 区段）的条目计入命中率" />
      <StatCard label="端到端延迟" :value="latencyTotal" :target="LATENCY_BUDGET" :target-kind="'max'" unit="ms" icon="time" hint="召回 P95 预算 ≤ 150ms（含向量检索）" />
      <StatCard label="预算裁剪" :value="query.budgetTrimmed.trimmed" unit="条" icon="filter" :lower-is-better="true" hint="超出 S4 预算被裁掉的条目，全部可见可追溯" />
    </div>

    <StateShell
      :state="state"
      stage="回放召回管线…"
      empty-title="暂无召回记录"
      empty-desc="本会话尚未触发记忆召回；任务开始或话题切换时会自动触发。"
      empty-action="模拟一次召回"
      example-task="询问「这个项目发布流程有哪些硬约束」"
      what="召回记录加载失败"
      why="召回事件流不可读（memory.recalled 事件投影缺失）。"
      how="可重试；也可切换会话查看其他记录。"
      trace-id="trace-recall-88ac31"
      missing-permission="memory.recall.read"
      risk-level="R1"
      apply-path="在「权限与审批 → 申请授权」申请记忆召回只读权限"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            查询理解
            <span class="oc-muted" style="font-size: 12px">{{ query.sessionRef }}</span>
          </h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'raw', label: '原始查询', value: query.query },
              { key: 'used', label: '实际参与打分', value: `${usedCount} / ${query.hits.length} 条` },
              { key: 'at', label: '触发时间', value: new Date(query.at).toLocaleString('zh-CN') },
              { key: 'reason', label: '触发原因', value: '话题切换：从「迁移脚本」切到「发布约束」' },
            ]"
          />
          <div class="oc-divider" />
          <div class="oc-flex" style="gap: 6px">
            <Tag size="small" theme="primary" variant="light-outline">规则优先</Tag>
            <Tag size="small" theme="success" variant="light-outline">全文</Tag>
            <Tag size="small" theme="warning" variant="light-outline">向量</Tag>
            <Tooltip content="重排后按层级权重微调：组织 > 项目 > 会话 > 工作；再按 S4 预算裁剪">
              <Tag size="small" variant="outline">重排 + 层级权重</Tag>
            </Tooltip>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">延迟分解（ms）</h3>
          <OcChart type="bar" :series="latencySeries" :height="180" format="number" unit="ms" aria-label="召回延迟分解" :threshold="{ value: 60, label: '单路预算 60ms', kind: 'max' }" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; font-size: 12px">
            <span class="oc-secondary">规则 {{ query.latencyBreakdown.ruleMs }}ms</span>
            <span class="oc-secondary">全文 {{ query.latencyBreakdown.fulltextMs }}ms</span>
            <span class="oc-secondary">向量 {{ query.latencyBreakdown.vectorMs }}ms</span>
            <span class="oc-secondary">重排 {{ query.latencyBreakdown.rerankMs }}ms</span>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          命中明细
          <span class="oc-muted" style="font-size: 12px">未被使用的命中同样列出，避免「召回黑箱」</span>
        </h3>
        <Table
          :data="query.hits.map((h) => ({ ...h, value: data.entries.find((e) => e.memoryId === h.memoryId)?.value ?? '（条目已删除）' }))"
          :columns="[
            { colKey: 'memoryId', title: '条目', width: 110 },
            { colKey: 'value', title: '结论摘要', cell: 'cell' },
            { colKey: 'sourceType', title: '来源', width: 88, cell: 'cell' },
            { colKey: 'score', title: '分数', width: 132, cell: 'cell' },
            { colKey: 'used', title: '是否使用', width: 110, cell: 'cell' },
          ]"
          row-key="memoryId"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'sourceType'">
              <Tag size="small" :theme="sourceTheme(row.sourceType)" variant="light-outline">{{ row.sourceType }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'score'">
              <div class="oc-flex" style="gap: 6px">
                <Progress :percentage="Math.round(row.score * 100)" theme="line" size="small" style="width: 64px" />
                <span class="oc-mono">{{ row.score.toFixed(2) }}</span>
              </div>
            </template>
            <template v-else-if="col.colKey === 'used'">
              <Tag size="small" :theme="row.used ? 'success' : 'default'">{{ row.used ? '已注入 S4' : '仅命中' }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'value'">
              <span class="oc-clamp-2" style="display: block; max-width: 460px">{{ row.value }}</span>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            预算裁剪
            <Tag size="small" theme="warning" variant="light-outline">显式告知，不静默失败</Tag>
          </h3>
          <div class="oc-kv">
            <span class="oc-kv__k">S4 预算</span><span>{{ query.budgetTrimmed.budgetTokens }} token</span>
            <span class="oc-kv__k">实际使用</span><span>{{ query.budgetTrimmed.usedTokens }} token</span>
            <span class="oc-kv__k">被裁条目</span><span>{{ query.budgetTrimmed.trimmed }} 条（低层级 + 低置信优先裁）</span>
          </div>
          <Progress
            :percentage="Math.round((query.budgetTrimmed.usedTokens / query.budgetTrimmed.budgetTokens) * 100)"
            theme="line"
            :label="`${query.budgetTrimmed.usedTokens}/${query.budgetTrimmed.budgetTokens} token`"
            style="margin-top: 10px"
          />
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            裁剪只影响注入，不删除条目；被裁条目仍在记忆中心可查，可在下轮召回中重新命中。
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">权限过滤</h3>
          <div class="oc-flex" style="gap: 8px">
            <OcIcon name="lock" size="14px" />
            <span style="font-size: 13px">本域召回命中 <b>7 条</b> 无权内容，已前置过滤</span>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            过滤发生在候选集内（检索条件带权限约束），不返回任何内容，也不暴露标题——仅回报数量，杜绝存在性侧信道。
          </div>
          <div class="oc-flex" style="margin-top: 10px; gap: 8px">
            <Button size="small" variant="outline" disabled>查看被过滤内容（不可用）</Button>
            <Tag size="small" theme="danger" variant="light-outline">PERMISSION_DENIED 演示</Tag>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
