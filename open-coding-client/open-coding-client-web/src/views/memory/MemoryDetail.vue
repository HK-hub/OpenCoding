<script setup lang="ts">
/**
 * E-02 记忆条目详情：内容 + 来源 + 版本链 + reviewAt + 召回记录 + 纠正入口。
 * 纠正会反哺规则：同类候选将被拦截或降级（卷 10 D-MEM-10）。
 * 溯源：卷 10 §4.1 / BUILD-MANIFEST E-02
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Dialog, Input, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData, MEMORY_SCOPE_LABEL } from '@/mock/data/knowledge';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const data = knowledgeData.memory;

const state = ref<UiStateKind>('LOADING');
const correctOpen = ref(false);
const correction = ref('');
const saved = ref(false);

const entry = computed(() => data.entries.find((e) => e.memoryId === String(route.query.id ?? '')) ?? data.entries[6]);

/** 召回记录：从召回调试的三次查询中反查该条目的命中与是否被使用 */
const recallRows = computed(() =>
  data.recallDebug.flatMap((q) =>
    q.hits
      .filter((h) => h.memoryId === entry.value.memoryId)
      .map((h) => ({ query: q.query, at: q.at, score: h.score, used: h.used, sourceType: h.sourceType })),
  ),
);

const chain = computed(() => ({
  supersedes: entry.value.supersedes ?? null,
  self: entry.value.memoryId,
  supersededBy: entry.value.supersededBy ?? null,
}));

const infoItems = computed(() => [
  { key: 'scope', label: '作用域', value: `${MEMORY_SCOPE_LABEL[entry.value.scope]}（${entry.value.scope}）` },
  { key: 'sensitivity', label: '敏感级', value: entry.value.sensitivity, tag: { text: entry.value.sensitivity, theme: entry.value.sensitivity === '敏感' ? 'danger' as const : entry.value.sensitivity === '内部' ? 'warning' as const : 'default' as const } },
  { key: 'confidence', label: '置信度', value: entry.value.confidence },
  { key: 'status', label: '状态', value: entry.value.status, tag: { text: entry.value.status, theme: entry.value.status === 'active' ? 'success' as const : 'warning' as const } },
  { key: 'ttl', label: '时效（TTL）', value: entry.value.ttl },
  { key: 'review', label: '复审时间', value: entry.value.reviewAt },
  { key: 'author', label: '作者', value: entry.value.author },
  { key: 'source', label: '来源', value: `${entry.value.source.type} · ${entry.value.source.ref}` },
  { key: 'affected', label: '影响范围', value: entry.value.affectedScope, span: 2 as const },
  { key: 'reason', label: '写入理由（为什么记住）', value: entry.value.reason, block: true, span: 2 as const },
]);

function submitCorrection() {
  if (!correction.value.trim()) return;
  saved.value = true;
  correctOpen.value = false;
  MessagePlugin.success('已提交纠正：同类候选将被拦截或降级（可撤销）');
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`记忆条目 · ${entry.key}`"
      desc="条目的内容、来源、版本链与召回记录；纠正后会反哺规则（同类写入被拦截或降级）。"
      volume="卷 10"
      manifest="E-02"
      :cli="`oc memory show ${entry.memoryId}`"
      :status="[{ label: MEMORY_SCOPE_LABEL[entry.scope], theme: 'primary' }, { label: entry.status, theme: entry.status === 'active' ? 'success' : 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/memory/center')"><OcIcon name="history" size="12px" /> 返回列表</Button>
        <Button size="small" theme="primary" @click="correctOpen = true">纠正该条目</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      stage="加载条目与召回记录…"
      empty-title="条目不存在"
      empty-desc="编号未命中或已被删除（删除后不可召回）；请从记忆中心重新选择。"
      empty-action="返回记忆中心"
      what="条目加载失败"
      why="检索索引与该条目的元数据不一致（可能刚被合规删除）。"
      how="可重试；若持续失败请在 E-07 删除记录中确认该编号是否已被删除。"
      trace-id="trace-mem-41b8de"
      @retry="state = 'NORMAL'"
      @empty-action="router.push('/memory/center')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            结论内容
            <Tag v-if="entry.status === 'superseded'" size="small" theme="warning" variant="light-outline">已被新版本取代</Tag>
            <Tag v-if="entry.status === 'deleted'" size="small" theme="danger" variant="light-outline">已删除 · 不可召回</Tag>
          </h3>
          <p style="margin: 0 0 10px; font-size: 14px; line-height: 22px">{{ entry.value }}</p>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag v-for="t in entry.tags" :key="t" size="small" variant="outline">{{ t }}</Tag>
          </div>
          <div v-if="entry.paths.length" class="oc-divider" />
          <div v-for="p in entry.paths" :key="p" class="oc-mono oc-secondary">{{ p }}</div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            仅注入上下文 S4 区段，且带「仅供参考，可能过期」标注。
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">定位与来源</h3>
          <InfoGrid :items="infoItems" :columns="2" />
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            版本链
            <span class="oc-muted" style="font-size: 12px">旧 → 新，历史版本仅保留审计用途</span>
          </h3>
          <div class="oc-stack">
            <div class="oc-flex" style="gap: 8px">
              <Tag size="small" variant="outline">{{ chain.supersedes ?? '（无前序）' }}</Tag>
              <OcIcon name="link" size="12px" />
              <span class="oc-mono" style="font-weight: 600">{{ chain.self }}</span>
              <OcIcon name="link" size="12px" />
              <Tag size="small" variant="outline" :theme="chain.supersededBy ? 'warning' : 'default'">{{ chain.supersededBy ?? '（当前版本）' }}</Tag>
            </div>
            <JsonBlock label="版本链结构（供迁移与审计导出）" :value="chain" />
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            召回记录
            <span class="oc-muted" style="font-size: 12px">共 {{ recallRows.length }} 次命中（含未被使用）</span>
          </h3>
          <Table :data="recallRows" :columns="[
            { colKey: 'query', title: '触发查询', cell: 'cell' },
            { colKey: 'score', title: '分数', width: 76, cell: 'cell' },
            { colKey: 'sourceType', title: '来源', width: 76, cell: 'cell' },
            { colKey: 'used', title: '被使用', width: 84, cell: 'cell' },
          ]" row-key="query" size="small">
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'score'"><span class="oc-mono">{{ row.score.toFixed(2) }}</span></template>
              <template v-else-if="col.colKey === 'used'">
                <Tag size="small" :theme="row.used ? 'success' : 'default'">{{ row.used ? '已注入' : '仅命中' }}</Tag>
              </template>
              <template v-else-if="col.colKey === 'sourceType'">
                <Tag size="small" variant="light-outline">{{ row.sourceType }}</Tag>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
          <div v-if="!recallRows.length" class="oc-muted" style="font-size: 12px">
            近 7 天未被任何查询命中；长期未命中条目会在 E-10 质量评测中标记为候选归档。
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          纠正入口
          <span class="oc-muted" style="font-size: 12px">纠正记录进入 E-10 质量评测，并作为「反哺规则」的输入</span>
        </h3>
        <div class="oc-flex" style="gap: 8px">
          <Input v-model="correction" placeholder="描述这条记忆哪里不对（例如：预算应改为 10min）" :disabled="saved" />
          <Button theme="primary" :disabled="saved" @click="correctOpen = true">提交纠正</Button>
        </div>
        <div v-if="saved" class="oc-flex" style="margin-top: 8px; gap: 6px">
          <Tag size="small" theme="success">已提交</Tag>
          <span class="oc-secondary" style="font-size: 12px">同类写入候选将自动降级为「需确认」，10 秒内可撤销。</span>
          <Button size="small" variant="text" @click="saved = false; correction = ''">撤销</Button>
        </div>
        <div class="oc-flex" style="margin-top: 10px">
          <CopyableId id="trace-correct-9d21" label="复制纠正 traceId" />
        </div>
      </div>

      <Dialog v-model:visible="correctOpen" header="确认纠正该记忆条目" :width="480" @confirm="submitCorrection">
        <p style="margin: 0 0 8px">纠正内容：{{ correction || '（未填写，将按「标记为不准确」处理）' }}</p>
        <p class="oc-secondary" style="font-size: 12px; margin: 0">
          纠正后：① 条目置信度降级为「低」；② 同类候选需人工确认；③ 事件写入 memory.corrected（可审计）。
        </p>
      </Dialog>
    </StateShell>
  </div>
</template>
