<script setup lang="ts">
/**
 * I-08 冲突解决面板。
 * 三方合并（ours / baseline / theirs）+ 语义分析 + AI 建议 + 人工确认 + 结论入库；
 * 任何一侧的改动都不会被静默丢弃：未采纳的一方必须显式标注并记录理由。
 * 溯源：卷 21 D-GIT-6；BUILD-MANIFEST I-08。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import DiffView from '@/components/common/DiffView.vue';
import CliHint from '@/components/common/CliHint.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const fileKey = ref('src/reconcile/ledger.ts');
const resolution = ref<'ours' | 'theirs' | 'both' | 'manual'>('both');
const reason = ref('两侧语义可叠加：保留我方幂等键去重 + 基线新增的幂等键校验');
const confirmed = ref(false);

const conflict = computed(() => platformData.git.mergeQueue.find((q) => q.status === 'conflict') ?? platformData.git.mergeQueue[2]);
const files = computed(() => conflict.value.conflictFiles);

/** 三方合并视图（简化：我方 vs 基线 vs 对方） */
const diffFiles = computed(() => [
  {
    path: fileKey.value,
    additions: 8,
    deletions: 3,
    externalChanged: true,
    lines: [
      { type: 'ctx' as const, oldLine: 84, newLine: 84, text: 'export function diffLedger(rows: LedgerRow[]): LedgerDiff {' },
      { type: 'del' as const, oldLine: 85, newLine: undefined, text: '  return rows.map(toDiff); // 我方：无去重' },
      { type: 'add' as const, oldLine: undefined, newLine: 85, text: '  const deduped = dedupeByKey(rows); // 我方（ours）' },
      { type: 'del' as const, oldLine: undefined, newLine: undefined, text: '  assertKeys(rows); // 基线（baseline）新增校验' },
      { type: 'add' as const, oldLine: undefined, newLine: 86, text: '  assertKeys(deduped); // 合并结论：两者叠加' },
      { type: 'ctx' as const, oldLine: 87, newLine: 87, text: '  return deduped.map(toDiff);' },
      { type: 'add' as const, oldLine: undefined, newLine: 88, text: '  // 对方（theirs）新增：导出顺序调整见 index.ts' },
    ],
  },
]);

const aiSuggestions = computed(() => conflict.value.suggestions);

const semantic = computed(() => [
  { aspect: '语义冲突', detail: '两侧都修改了差异行的生成逻辑，非纯文本冲突', severity: 'major' },
  { aspect: '可叠加性', detail: '去重与校验互不覆盖，可同时保留（both）', severity: 'ok' },
  { aspect: '副作用', detail: '两侧都新增断言，合并后测试需重跑（预检会校验）', severity: 'minor' },
]);

const columns = [
  { colKey: 'file', title: '冲突文件', width: 300, cell: 'file' },
  { colKey: 'ours', title: '我方（ours）', width: 150 },
  { colKey: 'theirs', title: '对方（theirs）', width: 150 },
  { colKey: 'suggest', title: 'AI 建议', ellipsis: true, cell: 'sug' },
];

function applyResolution() {
  if (!confirmed.value) {
    MessagePlugin.error('请勾选「人工确认」：冲突结论必须由人确认（高风险/语义冲突不允许自动合并）');
    return;
  }
  MessagePlugin.success(`冲突结论已入库：${fileKey.value} → ${resolution.value}（理由与两侧改动清单随结论一起写入审计，可追溯）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.git.mergeQueue.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="冲突解决"
      desc="三方合并 + 语义分析 + AI 建议 + 人工确认；任何一方改动都不静默丢弃——未采纳的部分必须显式列出并记录理由，结论入库可审计。"
      volume="卷 21" manifest="I-08" cli="oc git conflict resolve --merge mq-03 --file src/reconcile/ledger.ts"
      :status="[{ label: `${files.length} 个冲突文件`, theme: 'danger' }, { label: '需人工确认', theme: 'warning' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="fileKey" size="small" style="width: 280px" aria-label="选择文件" :options="files.map((f) => ({ value: f, label: f }))" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="冲突文件" :value="files.length" icon="bug" hint="来自合并队列 mq-03" />
      <StatCard label="语义冲突" :value="semantic.filter((s) => s.severity === 'major').length" icon="secured" hint="语义冲突必须人工确认（禁止自动合并）" />
      <StatCard label="AI 建议" :value="aiSuggestions.length" icon="robot" hint="建议仅供参考，采纳需人工确认" />
      <StatCard label="结论入库" :value="confirmed ? 1 : 0" icon="database" hint="结论 + 理由 + 两侧清单进入审计" />
    </div>

    <StateShell
      :state="demo" stage="正在计算三方合并与语义分析…"
      empty-title="没有待解决的冲突" empty-desc="当前没有 conflict 状态的合并项；冲突解决仅在冲突退回后可用。"
      empty-action="查看合并队列" example-task="解决 ledger.ts 的语义冲突并保留两侧的校验逻辑"
      what="冲突面板加载失败" why="三方基线不可读（部分克隆下按需拉取基线 blob 失败）"
      how="可重试；冲突数据未受影响，标记为「未解决」直到基线可用" trace-id="trace-f77b88ff"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">
          冲突清单
          <CliHint :command="`oc git conflict list --merge ${conflict.id}`" />
        </h3>
        <Table :data="files.map((f, i) => ({ file: f, ours: i === 0 ? '改动 12 行' : '无改动', theirs: i === 0 ? '改动 4 行' : '导出顺序调整', sug: aiSuggestions[i] ?? '取基线导出顺序，避免循环依赖' }))" :columns="columns" row-key="file" size="small" :pagination="undefined">
          <template #file="{ row }"><span class="oc-mono oc-truncate">{{ row.file }}</span></template>
          <template #sug="{ row }"><span class="oc-truncate">{{ row.sug }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            三方合并：{{ fileKey }}
            <RiskBadge level="R1" />
          </h3>
          <DiffView :files="diffFiles" />
          <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
            <Select v-model="resolution" size="small" style="width: 200px" aria-label="解决方式">
              <Option value="ours" label="采用我方（ours）" />
              <Option value="theirs" label="采用对方（theirs）" />
              <Option value="both" label="两侧叠加（推荐）" />
              <Option value="manual" label="手工编辑后提交" />
            </Select>
            <Button size="small" :theme="confirmed ? 'primary' : 'default'" variant="outline" @click="confirmed = !confirmed">
              {{ confirmed ? '已人工确认' : '人工确认' }}
            </Button>
            <Button size="small" theme="primary" @click="applyResolution">提交结论入库</Button>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">语义分析</h3>
            <Table
              :data="semantic" size="small" :pagination="undefined" row-key="aspect"
              :columns="[{ colKey: 'aspect', title: '维度', width: 120 }, { colKey: 'detail', title: '结论', ellipsis: true }, { colKey: 'severity', title: '等级', width: 100, cell: 'sv' }]"
            >
              <template #sv="{ row }">
                <Tag :theme="row.severity === 'major' ? 'danger' : row.severity === 'minor' ? 'warning' : 'success'" size="small" variant="light-outline">{{ row.severity }}</Tag>
              </template>
            </Table>
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">AI 建议与人工确认要求</h3>
            <InfoGrid
              :columns="1"
              :items="aiSuggestions.length
                ? aiSuggestions.map((s, i) => ({ key: `s${i}`, label: `建议 ${i + 1}`, value: s }))
                : [{ key: 'none', label: 'AI 建议', value: '暂无建议（未接入建议模型或冲突过复杂）' }]"
            />
            <JsonBlock
              :mask="false" label="不静默丢改动清单"
              :value="{ oursKept: resolution === 'ours' || resolution === 'both' || resolution === 'manual', theirsKept: resolution === 'theirs' || resolution === 'both' || resolution === 'manual', droppedSide: resolution === 'ours' ? 'theirs（需在结论中记录理由）' : resolution === 'theirs' ? 'ours（需在结论中记录理由）' : '无', reason }"
            />
            <div class="oc-flex" style="margin-top: 8px">
              <CliHint :command="`oc git conflict resolve --merge ${conflict.id} --file ${fileKey} --strategy ${resolution} --reason '<reason>'`" />
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
