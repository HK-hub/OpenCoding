<script setup lang="ts">
/**
 * 测试生成面板（N3-07）：测试 PR（单元 / 集成 / 属性三分）+ 覆盖率变化 + 残余说明 + 假测试拒收记录。
 * 溯源：卷 35 §5.3 ③；BUILD-MANIFEST N3-07。
 * 契约：生成即运行（不通过即丢弃并报告）；假测试检测拒收；新增用例不得修改既有测试期望。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const cap = intelData.capabilities.find((c) => c.id === 'test.gen')!;
const outputs = intelData.outputs.filter((o) => o.capabilityId === 'test.gen');
const findingFake = intelData.findings.filter((f) => f.ruleId.includes('hollow-assert'));

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const kindFilter = ref<'全部' | '单元' | '集成' | '属性'>('全部');
function onKind(v: unknown) {
  kindFilter.value = String(v) as typeof kindFilter.value;
}

const cases = [
  { kind: '单元', file: 'tests/deps/resolver.spec.ts', count: 12, pass: 12, covered: '缺口函数 8/8' },
  { kind: '集成', file: 'tests/api/upgrade.it.spec.ts', count: 3, pass: 3, covered: '端到端路径 3/3' },
  { kind: '属性', file: 'tests/prop/version-range.prop.ts', count: 2, pass: 1, covered: '不变量 2 条（1 条待修复）' },
  { kind: '单元', file: 'tests/billing/ledger.gen.spec.ts', count: 6, pass: 0, covered: '拒收（假测试：断言恒真）' },
];
/** 生成结果列表（含本次生成的记录）：列表为普通数组，需局部 ref 驱动重渲染 */
const genRows = ref([...cases]);
const rows = computed(() => (kindFilter.value === '全部' ? genRows.value : genRows.value.filter((c) => c.kind === kindFilter.value)));
const generatedCount = ref(23);
const generating = ref(false);

/** 对当前缺口生成测试：插入「生成中 → 已完成」记录并更新统计（生成即运行，不通过即丢弃） */
function generateForGap() {
  if (generating.value) {
    MessagePlugin.warning('上一批生成仍在运行，请稍候（生成即运行需等断言结果）');
    return;
  }
  generating.value = true;

  // 1. 插入生成中记录（表格立即可见，统计暂不计入）
  const row = { kind: '单元', file: 'tests/coverage-gap.gen.spec.ts', count: 4, pass: 0, covered: '生成中 · 目标：resolver 未覆盖分支 4 处' };
  genRows.value = [...genRows.value, row];
  // 清空策略筛选，确保新记录在表格中可见
  kindFilter.value = '全部';
  MessagePlugin.info('已发起生成：tests/coverage-gap.gen.spec.ts（4 例，生成即运行中…）');

  // 2. 生成即运行完成：通过后并入测试 PR，并更新生成用例统计
  window.setTimeout(() => {
    row.pass = 4;
    row.covered = '缺口函数 4/4（生成即运行全部通过，已并入测试 PR）';
    genRows.value = [...genRows.value];
    generatedCount.value += 4;
    generating.value = false;
    MessagePlugin.success('已生成 tests/coverage-gap.gen.spec.ts（4 例 · 4/4 通过）→ 去向：测试 PR #4831（仅提 PR 不合并）');
  }, 600);
}

const coverageSeries = computed(() => [{
  name: '覆盖率（%）',
  points: ['变更前', '生成后', '验收后'].map((x, i) => ({ x, y: [71.4, 79.2, 78.6][i] })),
}]);

const columns = [
  { colKey: 'kind', title: '策略', width: 90, cell: 'kind' },
  { colKey: 'file', title: '测试文件（PR 内）', width: 300, cell: 'file' },
  { colKey: 'count', title: '用例数', width: 90 },
  { colKey: 'pass', title: '运行结果（生成即运行）', width: 180, cell: 'pass' },
  { colKey: 'covered', title: '覆盖目标 / 拒收原因', ellipsis: true },
];
const KIND_THEME: Record<string, 'primary' | 'success' | 'warning'> = { 单元: 'primary', 集成: 'success', 属性: 'warning' };

onMounted(() => {
  window.setTimeout(() => (demo.value = outputs.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="测试生成"
      desc="变更驱动 + 缺口驱动；生成即运行（不通过即丢弃）；假测试检测（无断言 / 恒真断言 / 只测 getter）拒收。"
      volume="卷 35" manifest="N3-07" cli="oc ai test-gen --scope coverage-gap --open-pr"
      :status="[{ label: `覆盖率目标 ${cap.budget.runUsd >= 0 ? '80%' : ''}`, theme: 'default' }, { label: '只提 PR 不合并', theme: 'primary' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="kindFilter" size="small" style="width: 130px" aria-label="按策略筛选" :options="['全部', '单元', '集成', '属性'].map((k) => ({ value: k, label: k }))" @change="onKind" />
        <Button size="small" theme="primary" @click="generateForGap">对当前缺口生成测试</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在定位覆盖率缺口并生成测试…"
      empty-title="暂无测试生成记录" empty-desc="覆盖率未跌破门禁或最近无新增未测函数；可在覆盖率门禁未过时自动触发。"
      empty-action="手动发起一次生成" example-task="对 risk-engine 的覆盖率缺口生成单元测试并查看覆盖率变化"
      what="测试生成失败" why="运行环境缺失（沙箱内测试运行器不可用）→ 标记 skipped 不产 PR"
      how="修复测试运行环境后重试；拒绝率 > 50% 时自动降级为「只给测试要点清单」" trace-id="trace-2a71f908"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="生成用例" :value="generatedCount" icon="task-checked" hint="单元 18 / 集成 3 / 属性 2（含本次缺口生成）" />
        <StatCard label="覆盖率变化" :value="7.8" format="percent" icon="chart-line" :delta="7.8" :lower-is-better="false" :target="80" unit="pct" hint="71.4% → 79.2%（验收后 78.6%）" />
        <StatCard label="假测试拒收" :value="findingFake.length" icon="close" :lower-is-better="true" hint="恒真断言 / 无断言 / 只测 getter" />
        <StatCard label="单文件上限" :value="20" icon="filter" hint="默认 20 例/文件；超限分文件提交" />
      </div>

      <Alert theme="info" style="margin: 12px 0"
        message="生成即运行：不通过的测试文件直接丢弃并报告；新增用例不得修改既有测试期望（机械断言校验）。" />

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">覆盖率变化（变更前 → 生成后 → 验收后）</div>
          <OcChart type="bar" :series="coverageSeries" :height="200" format="percent" :threshold="{ value: 80, label: '目标 80%' }" unit="%" aria-label="覆盖率变化" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">验收后回落 0.6pt：属性测试 1 条待修复（假测试拒收后不计数）。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">残余说明（未覆盖部分与原因）<CliHint command="oc ai test-gen residual --report" /></div>
          <div class="oc-stack" style="gap: 4px; font-size: 13px">
            <span>· window.resize 分支：与视觉相关，需端到端测试（不在本能力范围）</span>
            <span>· 网络超时降级分支：需要故障注入夹具（建议在集成测试补）</span>
            <span>· 生成的属性测试 1 条不通过 → 已丢弃并记录（不修改生产代码迎合测试）</span>
          </div>
          <div class="oc-divider" />
          <InfoGrid :columns="1" :items="[
            { key: 'batch', label: '本批测试 PR', value: outputs[0]?.title ?? '测试 PR #4830' },
            { key: 'model', label: '生成器', value: `${cap.model} · ${cap.promptVersion}` },
            { key: 'cost', label: '成本', value: `$${outputs.reduce((a, o) => a + o.costUsd, 0).toFixed(2)}` },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">测试 PR 构成与运行结果（三分策略）</div>
        <Table :data="rows" :columns="columns" row-key="file" size="small" :pagination="undefined">
          <template #kind="{ row }"><Tag size="small" :theme="KIND_THEME[row.kind]" variant="light-outline">{{ row.kind }}</Tag></template>
          <template #file="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.file }}</span></template>
          <template #pass="{ row }">
            <Tag size="small" :theme="row.pass === row.count ? 'success' : row.pass === 0 ? 'danger' : 'warning'" variant="light-outline">
              {{ row.pass }} / {{ row.count }} 通过
            </Tag>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          假测试拒收记录：{{ findingFake.map((f) => `${f.location.file}:${f.location.line}`).join('、') }}（拒收样本回流评测集）。
        </div>
      </div>
    </StateShell>
  </div>
</template>
