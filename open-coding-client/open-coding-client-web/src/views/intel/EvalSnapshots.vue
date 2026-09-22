<script setup lang="ts">
/**
 * 评测快照回归（N3-16）：期望输出快照 + 运行回归（逐条结果更新）+ 提示词改版门禁说明。
 * 溯源：卷 35 §5.4 评测与快照回归；BUILD-MANIFEST N3-16。
 * 契约：同一输入 → 期望输出（快照）；未过回归不得发布提示词改版；失败项显式标红并给出差异。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { intelData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

interface SnapRow { id: string; capabilityId: string; input: string; expected: string; prompt: string; result: 'PASS' | 'FAIL' | 'PENDING'; diff?: string; stale?: boolean }

/** 输入摘要与期望输出（快照口径：同一输入 → 期望输出） */
const INPUTS: Record<string, string> = {
  'snap-01': 'diff:payment-core@4821（47 文件）',
  'snap-02': 'diff:identity-gateway@2210（12 文件）',
  'snap-03': 'diff:search-index@3320（含重定向处理）',
  'snap-04': 'window:2026-W35（任务/提交/事故事件）',
  'snap-05': 'docs/api/upgrade.md 结构化提取',
};
const rows = ref<SnapRow[]>(intelData.evalSnapshots.map((s): SnapRow => ({
  id: s.id,
  capabilityId: s.capabilityId,
  input: INPUTS[s.id] ?? s.caseRef,
  expected: `期望摘要 ${s.expectedDigest}（六段结构 / 引用覆盖率达标 / 无越权写）`,
  prompt: s.promptVersion,
  result: s.pass ? 'PASS' : 'FAIL',
  diff: s.pass ? undefined : s.regressionOf ? `与基线 ${s.regressionOf} 不一致：实际 ${s.actualDigest} ≠ 期望 ${s.expectedDigest}（引用覆盖率下降 / 段落缺失）` : undefined,
  stale: !!s.regressionOf,
})));

const running = ref(false);
const progress = ref(100);
const done = ref(rows.value.filter((r) => r.result !== 'PENDING').length);
const failed = computed(() => rows.value.filter((r) => r.result === 'FAIL').length);
const passRate = computed(() => ((rows.value.length - failed.value) / rows.value.length) * 100);
let timer: number | undefined;

/** 失败项差异（DiffView：期望 vs 实际） */
const failDiff = computed<DiffFile[]>(() => rows.value.filter((r) => r.result === 'FAIL').map((r) => ({
  path: `${r.capabilityId}/${r.id}.snap`,
  additions: 1,
  deletions: 1,
  lines: [
    { type: 'del', oldLine: 1, text: `- 期望：${r.expected}` },
    { type: 'add', newLine: 1, text: `+ 实际：与期望不一致（${r.diff ?? '差异待人工确认'}）` },
  ],
})));

/** 运行回归：模拟进度 + 逐条结果更新（失败项显式标红并给差异） */
function runRegression() {
  if (running.value) return;
  running.value = true;
  progress.value = 0;
  rows.value.forEach((r) => (r.result = 'PENDING'));
  let i = 0;
  timer = window.setInterval(() => {
    const row = rows.value[i];
    if (row) {
      row.result = row.stale ? 'FAIL' : 'PASS';
      if (row.result === 'FAIL') row.diff = `与基线不一致：实际 sha256 与期望 ${row.id} 摘要不符（引用覆盖率下降 6%）`;
      i += 1;
    }
    progress.value = Math.round((i / rows.value.length) * 100);
    done.value = i;
    if (i >= rows.value.length) {
      window.clearInterval(timer);
      running.value = false;
      MessagePlugin[failed.value ? 'warning' : 'success'](`回归完成：${rows.value.length - failed.value}/${rows.value.length} 通过；${failed.value} 项失败（已标红并给出差异，未过回归不得发布）`);
    }
  }, 420);
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = rows.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="评测快照回归"
      desc="期望输出快照是提示词改版的门禁：同一输入 → 期望输出；未过回归不得发布，失败项给出可复现差异。"
      volume="卷 35" manifest="N3-16" cli="oc ai eval snapshot run --suite all"
      :status="[{ label: `通过率 ${passRate.toFixed(0)}%`, theme: failed ? 'warning' : 'success' }, { label: `${failed} 项失败待修复`, theme: failed ? 'danger' : 'success' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" theme="primary" :loading="running" @click="runRegression">运行回归</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在加载期望输出快照…"
      empty-title="没有快照用例" empty-desc="快照由历史正确输出固化而来；没有用例时无法验证提示词改版，发布门禁保持关闭。"
      empty-action="从历史运行创建快照" example-task="运行一次回归，观察失败项标红与差异说明"
      what="快照加载失败" why="快照存储不可达（期望输出需与提示词版本绑定）"
      how="重试；门禁关闭期间任何提示词改版都无法发布（fail-closed）"
      :collapsed-summary="`快照 ${rows.length} 条（含 2 条失败 / 2 条新提示词版本），列表已折叠展示（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="通过率" :value="passRate" format="percent" icon="check" :target="100" :lower-is-better="false" hint="未过回归不得发布提示词改版" />
        <StatCard label="失败用例" :value="failed" unit="条" icon="error" :lower-is-better="true" hint="失败项显式标红并给出差异" />
        <StatCard label="本次已执行" :value="done" unit="条" icon="refresh" :lower-is-better="false" :hint="running ? '回归进行中（逐条更新）' : '上次回归已结束'" />
        <StatCard label="待发布提示词" :value="rows.filter((r) => r.prompt.includes('rc')).length" unit="个" icon="flag" :lower-is-better="true" hint="rc 版本在回归通过前保持未发布" />
      </div>

      <div v-if="running || progress < 100" class="oc-card" style="margin: 12px 0 0">
        <div class="oc-flex--between" style="font-size: 12px; margin-bottom: 4px">
          <span>回归进度：{{ done }} / {{ rows.length }} 条</span>
          <span>{{ progress }}%</span>
        </div>
        <Progress :percentage="progress" :status="failed ? 'error' : 'active'" />
      </div>

      <Table :data="rows" row-key="id" size="small" :pagination="undefined" style="margin-top: 12px" :columns="[
        { colKey: 'capabilityId', title: '能力', width: 140 },
        { colKey: 'input', title: '输入摘要', width: 220, ellipsis: true },
        { colKey: 'expected', title: '期望输出', ellipsis: true },
        { colKey: 'result', title: '最近回归结果', width: 120, cell: 'result' },
        { colKey: 'prompt', title: '提示词版本', width: 150, cell: 'prompt' },
      ]">
        <template #result="{ row }">
          <Tag size="small" :theme="row.result === 'PASS' ? 'success' : row.result === 'FAIL' ? 'danger' : 'default'" variant="light-outline">{{ row.result === 'PENDING' ? '执行中' : row.result }}</Tag>
          <span v-if="row.result === 'FAIL'" style="color: var(--td-error-color); font-size: 12px; margin-left: 6px">差异：{{ row.diff }}</span>
        </template>
        <template #prompt="{ row }">
          <span>{{ row.prompt }}</span>
          <Tag v-if="row.prompt.includes('rc')" size="small" theme="warning" variant="light-outline" style="margin-left: 6px">未发布（待回归）</Tag>
        </template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">失败差异（期望 vs 实际）<CliHint command="oc ai eval snapshot diff --failed" /></div>
          <DiffView v-if="failDiff.length" :files="failDiff" :collapse-over="40" />
          <div v-else class="oc-muted" style="font-size: 12px">当前无失败项；回归通过后方可发布提示词改版。</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <Tag size="small" theme="danger" variant="light-outline">失败项标红 + 差异可复现（同输入同环境）</Tag>
            <CopyableId id="trace-intel-eval-1b90" label="评测 traceId" short="12" />
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">提示词改版门禁</div>
          <InfoGrid :columns="1" :items="[
            { key: 'rule', label: '门禁规则', value: '同一输入 → 期望输出：改版提示词必须对全部快照回归通过，否则不得发布' },
            { key: 'fail', label: '失败处置', value: '失败项保留期望/实际摘要差异，修复提示词后重跑；不通过不合并' },
            { key: 'baseline', label: '基线评审', value: '快照变更（新增/修订期望输出）需人工评审并记录理由，防止「改期望」绕过门禁' },
            { key: 'scope', label: '适用范围', value: '全部 8 项能力；rc 版本（如 review@v13-rc1）在通过前保持未发布' },
          ]" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
