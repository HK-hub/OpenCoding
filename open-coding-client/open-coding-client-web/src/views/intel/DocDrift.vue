<script setup lang="ts">
/**
 * 文档漂移面板（N3-09）：差异清单（缺失 / 过时 / 多余）+ 受保护段落徽标 + 冲突并排。
 * 溯源：卷 35 §5.3 ⑤；BUILD-MANIFEST N3-09。
 * 契约：修订 PR 仅触及白名单写路径；人工已校订段落受保护（重生成不覆盖，冲突并排展示）。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import type { DocDriftItem } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const all = intelData.docDrift;
const kindFilter = ref<'全部' | '缺失' | '过时' | '多余'>('全部');
const selectedId = ref(all[0].id);
const selected = computed(() => all.find((d) => d.id === selectedId.value)!);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onKind(v: unknown) {
  kindFilter.value = String(v) as typeof kindFilter.value;
}
function onPick(v: unknown) {
  selectedId.value = String(v);
}
function onRowClick(ctx: { row: unknown }) {
  selectedId.value = (ctx.row as DocDriftItem).id;
}

const rows = computed(() => (kindFilter.value === '全部' ? all : all.filter((d) => d.kind === kindFilter.value)));
const missing = computed(() => all.filter((d) => d.kind === '缺失').length);
const outdated = computed(() => all.filter((d) => d.kind === '过时').length);
const protectedCount = computed(() => all.reduce((a, d) => a + d.protectedSegments.length, 0));
const conflictCount = computed(() => all.filter((d) => d.conflict).length);

const columns = [
  { colKey: 'kind', title: '类型', width: 90, cell: 'kind' },
  { colKey: 'doc', title: '文档', width: 260, cell: 'doc' },
  { colKey: 'detail', title: '差异', ellipsis: true },
  { colKey: 'writePathAllowed', title: '写路径', width: 110, cell: 'wp' },
  { colKey: 'protected', title: '受保护段落', width: 120, cell: 'prot' },
  { colKey: 'status', title: '状态', width: 110, cell: 'status' },
];
const KIND_THEME: Record<DocDriftItem['kind'], 'danger' | 'warning' | 'default'> = { 缺失: 'warning', 过时: 'danger', 多余: 'default' };
const STATUS_THEME: Record<string, 'primary' | 'warning' | 'success' | 'default'> = { 待处理: 'warning', '已提 PR': 'primary', 转人工: 'warning', 只报告: 'default' };

/** 冲突并排：AI 修订 vs 人工校订段落 */
const conflictFiles = computed<DiffFile[]>(() => {
  const c = selected.value.conflict;
  if (!c) return [];
  return [{
    path: selected.value.doc,
    additions: 1,
    deletions: 1,
    lines: [
      { type: 'ctx', oldLine: 1, newLine: 1, text: `人工校订段落：${selected.value.protectedSegments[0]?.heading ?? '受保护段落'}` },
      { type: 'del', oldLine: 2, text: `人工：${c.humanText}` },
      { type: 'add', newLine: 2, text: `AI：${c.aiText}` },
      { type: 'ctx', oldLine: 3, newLine: 3, text: '（裁决：以人工版本为准，AI 版本仅建议；重复生成不会覆盖人工内容）' },
    ],
  }];
});

onMounted(() => {
  window.setTimeout(() => (demo.value = all.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="文档漂移"
      desc="结构化提取比对优先、语义检索补充；修订 PR 仅触及白名单写路径；人工已校订段落受保护（冲突并排展示）。"
      volume="卷 35" manifest="N3-09" cli="oc ai doc-drift --path docs/** --report"
      :status="[{ label: `${all.length} 项差异`, theme: all.length ? 'warning' : 'success' }, { label: `${protectedCount} 个受保护段落`, theme: 'primary' }, { label: `${conflictCount} 处冲突`, theme: conflictCount ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="kindFilter" size="small" style="width: 130px" aria-label="按类型筛选" :options="['全部', '缺失', '过时', '多余'].map((k) => ({ value: k, label: k }))" @change="onKind" />
        <Select :value="selectedId" size="small" style="width: 210px" aria-label="选择差异项" :options="all.map((d) => ({ value: d.id, label: d.doc }))" @change="onPick" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在做代码侧提取与文档侧比对…"
      empty-title="文档与代码一致" empty-desc="当前无漂移差异；非结构化文档只报告不修订（不做猜测性改写）。"
      empty-action="重新扫描" example-task="查看一条「过时」差异，确认 AI 与人工段落冲突并排展示"
      what="漂移扫描失败" why="文档侧无法解析（非结构化文档）或写路径越界（整体拒绝并告警）"
      how="缩小扫描范围或补文档结构后重试；越界写路径需修正白名单" trace-id="trace-0c93be44"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="缺失" :value="missing" icon="file-add" :lower-is-better="true" hint="代码有、文档无（如新增参数 / 环境变量）" />
        <StatCard label="过时" :value="outdated" icon="file-copy" :lower-is-better="true" hint="文档描述与现状不一致" />
        <StatCard label="多余" :value="all.length - missing - outdated" icon="delete" :lower-is-better="true" hint="已移除的命令 / 配置仍在文档中" />
        <StatCard label="受保护段落" :value="protectedCount" icon="lock" hint="人工校订优先，重生成不覆盖" />
      </div>

      <Alert v-if="selected.conflict" theme="warning" style="margin: 12px 0"
        message="该文档存在「AI 修订 vs 人工校订」冲突：人工版本受保护（protectedSegments），请并排裁决；冲突未裁决前不合并。" />

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined" @row-click="onRowClick">
        <template #kind="{ row }"><Tag size="small" :theme="KIND_THEME[row.kind as DocDriftItem['kind']]" variant="light-outline">{{ row.kind }}</Tag></template>
        <template #doc="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.doc }}</span><div class="oc-muted" style="font-size: 11px">{{ row.docVersion }}</div></template>
        <template #wp="{ row }">
          <Tag size="small" :theme="row.writePathAllowed ? 'success' : 'danger'" variant="light-outline">{{ row.writePathAllowed ? '白名单内' : '越界（拒绝）' }}</Tag>
        </template>
        <template #prot="{ row }">
          <Tag v-if="row.protectedSegments.length" size="small" theme="primary" variant="light-outline">{{ row.protectedSegments.length }} 段受保护</Tag>
          <span v-else class="oc-muted">—</span>
        </template>
        <template #status="{ row }"><Tag size="small" :theme="STATUS_THEME[row.status]" variant="light-outline">{{ row.status }}</Tag></template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">差异详情与来源真相<CliHint :command="`oc ai doc-drift show ${selected.id}`" /></div>
          <div class="oc-stack" style="gap: 4px; font-size: 13px">
            <span><b>{{ selected.doc }}</b>（{{ selected.docVersion }}）</span>
            <span class="oc-secondary">{{ selected.detail }}</span>
            <span class="oc-muted" style="font-size: 12px">来源真相：{{ selected.sourceOfTruth }}</span>
          </div>
          <div class="oc-divider" />
          <div class="oc-card__title" style="font-size: 12px">受保护段落（人工校订）</div>
          <div v-for="(p, i) in selected.protectedSegments" :key="i" class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px; margin-bottom: 4px">
            <Tag size="small" theme="primary" variant="light-outline">受保护</Tag>
            <span>{{ p.heading }}</span>
            <span class="oc-muted">校订人 {{ p.editedBy }} · {{ new Date(p.editedAt).toLocaleDateString('zh-CN') }}</span>
          </div>
          <div v-if="!selected.protectedSegments.length" class="oc-muted" style="font-size: 12px">该文档无人工校订段落。</div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            同一文档连续 3 次修订被驳回 → 转「只报告」模式（避免反复打扰）。
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">冲突并排（人工 vs AI）</div>
          <DiffView v-if="conflictFiles.length" :files="conflictFiles" :collapse-over="60" />
          <div v-else class="oc-muted">该差异项无冲突（可直接提修订 PR）。</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
