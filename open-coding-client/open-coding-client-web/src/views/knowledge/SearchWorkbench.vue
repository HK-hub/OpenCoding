<script setup lang="ts">
/**
 * W-03 检索工作台：查询理解 + 三路召回（全文/向量/符号）降级标注 + 结果 + 重排 + 延迟分解 + 强制引用。
 * 铁律：知识问答必须带引用；无依据时明确回答「未找到依据」并给出检索范围；引用不可达则标注并降置信。
 * 溯源：卷 11 D-KB-4 / D-KB-9 / BUILD-MANIFEST W-03
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Progress, Select, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import type { SearchResult } from '@/mock/data/knowledge';

const ui = useUiStore();
const router = useRouter();
const data = knowledgeData.knowledge;
const trace = data.queryTrace;

const state = ref<UiStateKind>('LOADING');
const query = ref(trace.query);
const answered = ref(false);
/** 是否命中证据：false 时按「未找到依据」回答，并给出检索范围（禁止编造） */
const hasEvidence = ref(true);
/** EDGE_DATA：结果超过阈值时折叠展示，加载更多逐段放开 */
const visible = ref(5);
/** 已提交的知识缺口清单（进入 W-06 治理反馈队列）：重复提交按查询幂等 */
const gaps = ref<{ id: string; query: string; at: string; state: string; origin: string }[]>([]);

const results = computed<SearchResult[]>(() => (answered.value && hasEvidence.value ? data.searchResults : data.searchResults));
const shownResults = computed(() => results.value.slice(0, visible.value));
const latencyTotal = computed(() => trace.latencyMs.understand + trace.latencyMs.recall + trace.latencyMs.fusion + trace.latencyMs.filter);
const LATENCY_BUDGET = 300;

const latencySeries = computed(() => [
  {
    name: '阶段耗时（ms）',
    points: [
      { x: '查询理解', y: trace.latencyMs.understand },
      { x: '三路召回', y: trace.latencyMs.recall },
      { x: '融合重排', y: trace.latencyMs.fusion },
      { x: '权限过滤', y: trace.latencyMs.filter },
    ],
  },
]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '边界数据', value: 'EDGE_DATA' },
  { label: '权限受限', value: 'PERMISSION_DENIED' },
];

function runSearch() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = 'NORMAL';
    answered.value = true;
    hasEvidence.value = true;
    MessagePlugin.success(`检索完成：返回 ${data.searchResults.length} 条结果，全部带引用`);
  }, 320);
}

function runNoEvidence() {
  answered.value = true;
  hasEvidence.value = false;
  MessagePlugin.warning('未找到依据：已在检索范围内穷尽三路召回，不编造结论');
}

/** 报告知识缺口：把本次查询落入 W-06 反馈队列，页面缺口清单即时更新 */
function reportGap() {
  const q = query.value.trim() || trace.query;
  const existed = gaps.value.find((g) => g.query === q);
  if (existed) {
    MessagePlugin.info(`知识缺口已提交过：「${q}」仍在 W-06 反馈队列中等待处理`);
    return;
  }
  gaps.value.unshift({
    id: `gap-${gaps.value.length + 1}`,
    query: q,
    at: new Date().toISOString(),
    state: '待处理',
    origin: '无依据检索（W-03 本页）',
  });
  MessagePlugin.info(`已提交知识缺口「${q}」：进入 W-06 反馈队列（共 ${gaps.value.length} 条，可在知识治理页跟踪修复进度）`);
}

function kindLabel(k: string) {
  return { repo: '代码', doc: '文档', url: '网页', ticket: '工单/聊天', wiki: '知识页' }[k] ?? k;
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="检索工作台"
      desc="三路混合检索（全文 + 向量 + 代码符号）与融合重排；每条结果强制携带引用，降级与过滤全部显式标注。"
      volume="卷 11"
      manifest="W-03"
      cli="oc kb query '记忆四层作用域怎么写入' --topk 8"
      :status="[{ label: '强制引用', theme: 'primary' }, { label: '前置权限过滤', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="runNoEvidence">无依据场景演示</Button>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-card">
      <div class="oc-flex" style="gap: 8px">
        <Input v-model="query" placeholder="自然语言提问或符号名（例如 ContextSnapshotService）" clearable @enter="runSearch">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Button theme="primary" @click="runSearch">检索</Button>
        <CliHint :command="`oc kb query '${query}' --topk 8 --explain`" />
      </div>
    </div>

    <StateShell
      :state="state"
      stage="查询理解与三路召回…"
      empty-title="还没有检索记录"
      empty-desc="输入问题或符号名开始检索；也可从会话中的「作为上下文引用」发起。"
      empty-action="用示例问题检索"
      example-task="问「记忆四层作用域怎么写入，冲突怎么裁决」"
      what="检索失败"
      why="三路召回全部不可用（向量服务与全文索引同时不可达）。"
      how="可重试；也可先关闭语义路（显式降级标注）后继续检索。"
      trace-id="trace-kbq-6e24b1"
      missing-permission="kb.search.query"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」申请该知识域检索权限（按项目 + 可见范围粒度）"
      :collapsed-summary="`共 ${results.length} 条结果，超出阈值的部分已折叠（避免一次注入过多上下文）`"
      :page-size="visible"
      :cancellable="true"
      @load-more="visible += 5"
      @retry="runSearch"
      @empty-action="runSearch"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            查询理解
            <span class="oc-muted" style="font-size: 12px">改写与过滤条件解析 ≤ 30ms</span>
          </h3>
          <div class="oc-kv">
            <span class="oc-kv__k">原始查询</span><span>{{ trace.query }}</span>
            <span class="oc-kv__k">改写后</span><span>{{ trace.rewrite }}</span>
            <span class="oc-kv__k">过滤条件</span>
            <span class="oc-stack" style="gap: 4px">
              <Tag v-for="f in trace.filters" :key="f" size="small" variant="outline">{{ f }}</Tag>
            </span>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            三路召回
            <Tooltip content="任一路不可用时降级不报错，但必须在界面显式标注，不得静默降级">
              <Tag size="small" theme="warning" variant="light-outline">降级显式标注</Tag>
            </Tooltip>
          </h3>
          <div class="oc-stack">
            <div v-for="p in trace.paths" :key="p.name" class="oc-flex" style="gap: 8px">
              <Tag size="small" :theme="p.used ? 'success' : 'danger'" variant="light-outline">{{ p.name }}</Tag>
              <span style="font-size: 12px">{{ p.note }}</span>
              <Tag v-if="p.degraded" size="small" theme="warning">已降级</Tag>
            </div>
          </div>
          <div class="oc-divider" />
          <div class="oc-flex" style="gap: 8px">
            <OcIcon name="lock" size="14px" />
            <span style="font-size: 12px">
              前置过滤：本次命中 <b>{{ trace.permissionFiltered }}</b> 条无权结果，已过滤（不回传标题与内容，仅回报数量）。
            </span>
          </div>
        </div>
      </div>

      <div v-if="answered && !hasEvidence" class="oc-card" style="border-color: var(--oc-sev-warn)">
        <h3 class="oc-card__title">
          未找到依据
          <Tag size="small" theme="warning">不编造</Tag>
        </h3>
        <p style="margin: 0 0 8px; font-size: 13px">
          在已接入知识源与当前权限范围内，未检索到可支撑该问题的证据。以下为本次检索范围与已尝试路径：
        </p>
        <div class="oc-kv" style="font-size: 12px">
          <span class="oc-kv__k">检索范围</span><span>{{ data.sources.length }} 个知识源（{{ data.sources.map((s) => s.type).slice(0, 6).join(' / ') }} …）</span>
          <span class="oc-kv__k">已尝试路径</span><span>{{ trace.paths.map((p) => p.name + (p.used ? '（可用）' : '（降级）')).join(' · ') }}</span>
          <span class="oc-kv__k">建议动作</span>
          <span>① 放宽过滤条件 ② 等待符号索引重建完成 ③ 换用更具体的符号名或文件名提问</span>
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 10px">
          <Button size="small" variant="outline" @click="reportGap">报告知识缺口</Button>
          <Button size="small" variant="text" @click="runSearch">放宽条件重试</Button>
        </div>
        <div v-if="gaps.length" style="margin-top: 10px">
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">
            已提交的知识缺口（{{ gaps.length }}）· 进入 W-06 反馈队列，修复后回写索引
          </div>
          <div v-for="g in gaps" :key="g.id" class="oc-flex" style="gap: 6px; font-size: 12px; margin-bottom: 2px">
            <Tag size="small" theme="warning" variant="light-outline">{{ g.state }}</Tag>
            <span class="oc-mono oc-truncate" style="max-width: 360px">{{ g.query }}</span>
            <span class="oc-muted">{{ g.origin }} · {{ new Date(g.at).toLocaleString('zh-CN') }}</span>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">
              延迟分解
              <span class="oc-muted" style="font-size: 12px">总计 {{ latencyTotal }}ms（预算 ≤ {{ LATENCY_BUDGET }}ms，P95）</span>
            </h3>
            <OcChart type="bar" :series="latencySeries" :height="180" unit="ms" aria-label="检索延迟分解" :threshold="{ value: 120, label: '融合重排预算 120ms', kind: 'max' }" />
            <div class="oc-flex oc-flex--wrap" style="gap: 10px; font-size: 12px">
              <span class="oc-secondary">理解 {{ trace.latencyMs.understand }}ms</span>
              <span class="oc-secondary">召回 {{ trace.latencyMs.recall }}ms</span>
              <span class="oc-secondary">融合重排 {{ trace.latencyMs.fusion }}ms</span>
              <span class="oc-secondary">过滤组装 {{ trace.latencyMs.filter }}ms</span>
            </div>
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">质量水位</h3>
            <div class="oc-grid oc-grid--2" style="gap: 8px">
              <StatCard label="返回结果" :value="results.length" unit="条" icon="layers" />
              <StatCard label="强引用覆盖" :value="100" unit="%" format="raw" icon="link" hint="每条结果都带 citation，含版本或抓取时间" />
            </div>
            <div class="oc-divider" />
            <div class="oc-flex" style="gap: 8px">
              <Tag size="small" theme="warning" variant="light-outline">{{ results.filter((r) => r.stale).length }} 条陈旧（降权 + 标注）</Tag>
              <Tag size="small" variant="outline">重排模型：bge-reranker-v2</Tag>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            检索结果（{{ shownResults.length }} / {{ results.length }}）
            <span class="oc-muted" style="font-size: 12px">按融合分排序；点击引用可打开追溯视图</span>
          </h3>
          <div class="oc-stack">
            <div v-for="r in shownResults" :key="r.resultId" class="oc-card" style="padding: 10px 12px">
              <div class="oc-flex--between" style="align-items: flex-start">
                <div class="oc-grow">
                  <div class="oc-flex" style="gap: 6px">
                    <Tag size="small" :theme="r.citationKind === 'repo' ? 'primary' : 'default'" variant="light-outline">{{ kindLabel(r.citationKind) }}</Tag>
                    <b style="font-size: 13px">{{ r.title }}</b>
                    <Tag v-if="r.stale" size="small" theme="warning" variant="light-outline">
                      可能过时（最后验证 {{ new Date(r.lastVerifiedAt).toLocaleDateString('zh-CN') }}）
                    </Tag>
                  </div>
                  <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ r.snippet }}</div>
                  <button type="button" class="oc-cli" style="margin-top: 6px; max-width: 100%" @click="router.push({ path: '/knowledge/citation', query: { ref: r.citation } })">
                    <OcIcon name="link" size="12px" />
                    <span class="oc-mono oc-truncate" style="max-width: 520px">{{ r.citation }}</span>
                  </button>
                </div>
                <div style="width: 150px; flex: none">
                  <div class="oc-flex" style="gap: 6px; margin-bottom: 4px">
                    <span class="oc-muted" style="font-size: 11px">融合</span>
                    <Progress :percentage="Math.round(r.score * 100)" size="small" theme="line" style="width: 60px" />
                    <span class="oc-mono" style="font-size: 11px">{{ r.score.toFixed(2) }}</span>
                  </div>
                  <div class="oc-flex" style="gap: 6px; margin-bottom: 6px">
                    <span class="oc-muted" style="font-size: 11px">重排</span>
                    <Progress :percentage="Math.round(r.rerankScore * 100)" size="small" theme="line" style="width: 60px" />
                    <span class="oc-mono" style="font-size: 11px">{{ r.rerankScore.toFixed(2) }}</span>
                  </div>
                  <div class="oc-muted" style="font-size: 11px">
                    {{ r.permissionTags.tenant }} / {{ r.permissionTags.project }} / {{ r.permissionTags.visibility }} / {{ r.permissionTags.acl }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="shownResults.length < results.length" class="oc-flex" style="justify-content: center; margin-top: 8px">
            <Button size="small" variant="text" @click="visible += 5">加载更多（已渲染 {{ shownResults.length }} / {{ results.length }} 条）</Button>
          </div>
        </div>
      </template>
    </StateShell>
  </div>
</template>
