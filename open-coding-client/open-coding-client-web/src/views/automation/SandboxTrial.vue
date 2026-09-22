<script setup lang="ts">
/**
 * 沙箱试运行结果（N2-05）：步骤账本 + 断言结果 + 三件套门禁（干跑 / 沙箱试运行 / 产出断言）。
 * 溯源：卷 34 §5.4/§9；BUILD-MANIFEST N2-05。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { automationData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';
import { downloadText } from '@/utils/download';

const ui = useUiStore();

const SUCCEEDED = automationData.runs.filter((r) => r.status === 'SUCCEEDED');
const run = ref(SUCCEEDED[0]);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onRun(v: unknown) {
  const picked = automationData.runs.find((r) => r.runId === String(v));
  if (picked) run.value = picked;
}

const gates = [
  { name: '① 干跑', desc: '「预期动作 + 权限清单」零副作用报告', status: 'PASS', note: '耗时 1.4s，无越界声明' },
  { name: '② 沙箱试运行', desc: '在 L2 沙箱 + 独立 worktree 中执行步骤账本', status: 'PASS', note: '步骤全部完成，账本与断言留档' },
  { name: '③ 产出断言', desc: 'verification 全部机械判定通过后才允许真实运行', status: run.value.verificationResults.every((v) => v.pass) ? 'PASS' : 'FAIL', note: '断言结果见下表（失败即拦截，不进入人类视野）' },
];

const stepColumns = [
  { colKey: 'name', title: '步骤', width: 300, cell: 'name' },
  { colKey: 'status', title: '结果', width: 100, cell: 'status' },
  { colKey: 'durationMs', title: '耗时', width: 110, cell: 'dur' },
  { colKey: 'ledger', title: '账本（动作 / 影响面 / 决策）', cell: 'ledger' },
];
const verifyColumns = [
  { colKey: 'assert', title: '断言', cell: 'assert' },
  { colKey: 'expected', title: '期望', width: 90 },
  { colKey: 'actual', title: '实际', width: 90 },
  { colKey: 'pass', title: '结论', width: 100, cell: 'pass' },
];
const GATE_THEME: Record<string, 'success' | 'danger'> = { PASS: 'success', FAIL: 'danger' };

/** 导出当前试运行报告（Markdown）：门禁结论 + 步骤账本 + 断言结果，内容取自当前运行的真实数据 */
function exportTrialReport() {
  const r = run.value;
  const lines = [
    `# 沙箱试运行报告 ${r.runId}`,
    '',
    `- 模板：${r.templateName} v${r.version}`,
    `- 触发源：${r.triggerSource}`,
    `- 幂等键：${r.idempotencyKey}`,
    `- 试运行成本：$${r.costUsd.toFixed(2)}`,
    '',
    '## 三件套门禁',
    ...gates.map((g) => `- ${g.name}：${g.status}（${g.note}）`),
    '',
    '## 步骤账本',
    ...r.steps.map((s) => `- ${s.name}：${s.status} · 耗时 ${(s.durationMs / 1000).toFixed(1)}s`),
    '',
    '## 断言结果（verification，机械判定）',
    ...r.verificationResults.map((v) => `- ${v.assert}：期望 ${v.expected} / 实际 ${v.actual} → ${v.pass ? '通过' : '未通过'}`),
  ];
  const file = downloadText(lines.join('\n'), `trial-report-${r.runId}.md`);
  MessagePlugin.success('已生成 ' + file);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="沙箱试运行"
      desc="在沙箱与独立 worktree 中执行步骤账本与断言；三件套门禁（干跑 / 沙箱试运行 / 产出断言）全通过才允许真实运行。"
      volume="卷 34" manifest="N2-05" :cli="`oc automation trial show ${run.runId}`"
      :status="[{ label: '沙箱内运行', theme: 'primary' }, { label: '失败丢弃分支', theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="run.runId" size="small" style="width: 200px" aria-label="选择试运行" :options="SUCCEEDED.map((r) => ({ value: r.runId, label: `${r.runId} · ${r.templateName}` }))" @change="onRun" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取沙箱试运行步骤账本…"
      empty-title="暂无试运行记录" empty-desc="该模板尚未做过沙箱试运行；请先在干跑控制台生成报告，再发起试运行。"
      empty-action="去干跑" example-task="对「PR 巡检」做一次沙箱试运行并核对断言结果"
      what="试运行结果加载失败" why="沙箱会话已回收，账本引用指向的对象已过期（TTL 到期）"
      how="重新发起一次试运行；历史账本可在运行详情中按保留期查看" trace-id="trace-5be40277"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--3">
        <div class="oc-card">
          <div class="oc-card__title">运行概要</div>
          <InfoGrid :columns="1" :items="[
            { key: 'run', label: '运行 id', value: run.runId, mono: true, copyable: true },
            { key: 'tpl', label: '模板', value: `${run.templateName} v${run.version}` },
            { key: 'trigger', label: '触发源', value: run.triggerSource },
            { key: 'cost', label: '试运行成本', value: `$${run.costUsd.toFixed(2)}（真实运行计入预算信封）` },
            { key: 'idem', label: '幂等键', value: run.idempotencyKey, mono: true, copyable: true },
          ]" />
          <div class="oc-flex" style="gap: 6px; margin-top: 6px"><CopyableId :id="run.runId" label="复制运行 id" /></div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">三件套门禁</div>
          <div v-for="g in gates" :key="g.name" class="oc-stack" style="gap: 2px; margin-bottom: 8px">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" :theme="GATE_THEME[g.status]" variant="light-outline">{{ g.status }}</Tag>
              <b style="font-size: 13px">{{ g.name }}</b>
            </div>
            <div class="oc-secondary" style="font-size: 12px">{{ g.desc }}</div>
            <div class="oc-muted" style="font-size: 12px">{{ g.note }}</div>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">沙箱与工作区隔离</div>
          <InfoGrid :columns="1" :items="[
            { key: 'sandbox', label: '沙箱档位', value: 'L2 可写（按模板声明）' },
            { key: 'wt', label: '独立 worktree', value: `oc-wt/${run.runId}` , mono: true },
            { key: 'branch', label: '独立分支', value: `oc/${run.runId}-trial`, mono: true },
            { key: 'drop', label: '失败处置', value: '默认丢弃分支与临时产物，仅保留运行日志与报告' },
            { key: 'net', label: '网络', value: '默认不外发；外发须显式配置并经审计代理' },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">步骤账本<CliHint :command="`oc automation run steps ${run.runId} --ledger`" /></div>
        <Table :data="run.steps" :columns="stepColumns" row-key="name" size="small" :pagination="undefined">
          <template #name="{ row }"><span style="font-size: 12px">{{ row.name }}</span></template>
          <template #status="{ row }">
            <Tag size="small" :theme="row.status === 'done' ? 'success' : row.status === 'failed' ? 'danger' : 'default'" variant="light-outline">{{ row.status }}</Tag>
          </template>
          <template #dur="{ row }">{{ (row.durationMs / 1000).toFixed(1) }}s</template>
          <template #ledger="{ row }">
            <div v-for="(l, i) in row.ledger" :key="i" class="oc-stack" style="gap: 0">
              <span style="font-size: 12px">{{ l.action }} · {{ l.effect }}</span>
              <span class="oc-muted" style="font-size: 11px">{{ l.decision }} · {{ new Date(l.at).toLocaleTimeString('zh-CN') }}</span>
            </div>
            <span v-if="!row.ledger.length" class="oc-muted" style="font-size: 12px">未执行（前置步骤未通过）</span>
          </template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">断言结果（verification，必须可机械判定）</div>
        <Table :data="run.verificationResults" :columns="verifyColumns" row-key="assert" size="small" :pagination="undefined">
          <template #assert="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.assert }}</span></template>
          <template #pass="{ row }"><Tag size="small" :theme="row.pass ? 'success' : 'danger'" variant="light-outline">{{ row.pass ? '通过' : '未通过' }}</Tag></template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
          <Tag size="small" variant="outline">断言失败即拦截，不产出半成品</Tag>
          <Tag size="small" variant="outline">连续失败达阈值 → 熔断 + 升级人工</Tag>
          <Button size="small" variant="text" @click="exportTrialReport">导出试运行报告</Button>
        </div>
      </div>
    </StateShell>
  </div>
</template>
