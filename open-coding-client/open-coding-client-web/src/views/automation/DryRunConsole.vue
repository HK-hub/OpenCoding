<script setup lang="ts">
/**
 * 干跑控制台（N2-04）：「预期动作 + 权限清单」报告，零副作用、不消耗预算、≤60s。
 * 溯源：卷 34 §5.4 前置校验 / §8 性能；BUILD-MANIFEST N2-04。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

const templateId = ref('builtin.deps-upgrade');
const tpl = computed(() => automationData.templates.find((t) => t.id === templateId.value)!);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const running = ref(false);
const elapsed = ref(0);
const report = ref<{ step: string; action: string; tool: string; resource: string; permission: string; risk: string; ask: string; effect: string }[]>([]);

const RISK_OF_PERM: Record<string, string> = {
  'workspace.read': 'R0', 'repo.comment': 'R1', 'workspace.write': 'R1', 'command.build': 'R2',
  'command.test': 'R2', 'git.branch': 'R1', 'git.commit': 'R1', 'git.push': 'R3', 'pr.create': 'R3',
};

function onTemplate(v: unknown) {
  templateId.value = String(v);
  dryRun();
}

function dryRun() {
  running.value = true;
  elapsed.value = 0;
  report.value = [];
  const t0 = performance.now();
  const timer = window.setInterval(() => {
    elapsed.value = Math.round((performance.now() - t0) / 1000);
  }, 120);
  window.setTimeout(() => {
    window.clearInterval(timer);
    running.value = false;
    // 干跑只读求值：不申请沙箱、不写工作区、不触发任何外部调用（零副作用）
    report.value = tpl.value.steps.map((s, i) => {
      const tool = s.type === 'open-pr' ? 'git push + pr create' : s.type === 'run' ? 'shell（沙箱）' : s.type === 'report' ? 'file write（报告）' : 'git / file-read';
      const perm = s.type === 'open-pr'
        ? 'git.push + pr.create'
        : s.type === 'run'
          ? 'command.build + command.test'
          : s.type === 'apply'
            ? 'workspace.write + git.commit'
            : 'workspace.read';
      return {
        step: `${i + 1}. ${s.type}`,
        action: s.desc,
        tool,
        resource: i === 0 ? '仓库 payment-core@main（只读）' : i === 1 ? '依赖清单（内存）' : '独立 worktree + 分支 oc/deps-upgrade-…',
        permission: perm,
        risk: RISK_OF_PERM[perm.split(' + ')[0]] ?? 'R1',
        ask: perm.includes('git.push') || perm.includes('command.') ? '是（决策链逐动作裁决）' : '否（R0/R1 预授权内）',
        effect: '无（干跑不求值副作用）',
      };
    });
    ui.pushNotification({
      kind: 'task_done', level: 'P2', title: '干跑完成', body: `${tpl.value.name} 干跑报告已生成：${report.value.length} 个预期动作，零副作用，不消耗预算。`,
      actions: [{ label: '查看报告', path: '/automation/dry-run' }], aggregateKey: 'automation-dry-run', penetrateQuiet: false, channel: 'inapp',
    });
    MessagePlugin.success(`干跑完成（${elapsed.value}s）：预期动作 ${report.value.length} 个，未产生任何副作用`);
  }, 1400);
}

const columns = [
  { colKey: 'step', title: '步骤', width: 120, cell: 'step' },
  { colKey: 'action', title: '预期动作', ellipsis: true },
  { colKey: 'tool', title: '使用工具', width: 170 },
  { colKey: 'resource', title: '目标资源', width: 240, ellipsis: true },
  { colKey: 'permission', title: '所需权限', width: 220, cell: 'perm' },
  { colKey: 'risk', title: '风险', width: 80, cell: 'risk' },
  { colKey: 'ask', title: '是否需确认', width: 170 },
  { colKey: 'effect', title: '副作用', width: 130, cell: 'effect' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 220);
  dryRun();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="干跑控制台"
      desc="只读求值：把 steps 展开为「预期动作 + 权限清单」报告，零副作用、不消耗预算、不申请沙箱；用于装载前自审。"
      volume="卷 34" manifest="N2-04" :cli="`oc automation dry-run --template ${tpl.id} --read-only`"
      :status="[{ label: '零副作用', theme: 'success' }, { label: '不消耗预算', theme: 'default' }, { label: `≤60s（本次 ${elapsed}s）`, theme: elapsed > 60 ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="templateId" size="small" style="width: 210px" aria-label="选择模板" :options="automationData.templates.map((t) => ({ value: t.id, label: `${t.name} v${t.version}` }))" @change="onTemplate" />
        <Button size="small" theme="primary" :loading="running" @click="dryRun">重新干跑</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在只读求值，展开 steps 与权限清单…" :cancellable="running"
      empty-title="未选择模板" empty-desc="请先选择一个模板再执行干跑。"
      empty-action="选择模板" example-task="对「依赖升级」干跑并核对权限清单与上限"
      what="干跑失败" why="模板定义解析失败或权限声明与风险级不匹配（校验拒绝）"
      how="修正声明后重试；干跑失败不产生任何副作用，可直接重跑" trace-id="trace-6f8a52d0"
      @retry="dryRun" @cancel="running = false"
    >
      <div class="oc-grid oc-grid--4">
        <div class="oc-card">
          <div class="oc-card__title">结论</div>
          <InfoGrid :columns="1" :items="[
            { key: 'ok', label: '可装载性', value: '通过（预授权静态校验无越界）', tag: { text: 'PASS', theme: 'success' } },
            { key: 'dur', label: '干跑耗时', value: `${elapsed} 秒（上限 60s）` },
            { key: 'cost', label: '预算消耗', value: '$0.00（干跑不调用模型、不落盘）' },
            { key: 'sandbox', label: '沙箱', value: '未申请（只读求值）' },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">权限上限核对</div>
          <InfoGrid :columns="1" :items="[
            { key: 'allow', label: '将请求的动作', value: tpl.permissions.allow.length + ' 项', tag: { text: tpl.permissions.ceiling, theme: 'primary' } },
            { key: 'deny', label: '命中上限清单（直接拒绝）', value: '0 项', tag: { text: '无越界', theme: 'success' } },
            { key: 'merge', label: '合并策略', value: '只提 PR，不自动合并' },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">幂等与预算</div>
          <InfoGrid :columns="1" :items="[
            { key: 'idem', label: '幂等键', value: 'hash(templateId, version, targetRef, inputsDigest)' },
            { key: 'window', label: '去重窗口', value: '30min（命中落 DEDUPLICATED 并附历史 runId）' },
            { key: 'budget', label: '预算信封', value: `$${tpl.budget.costUsd} / ${tpl.budget.durationMin}min / ${tpl.budget.toolCalls} 调用 / 扇出 ${tpl.budget.fanout}` },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">风险与呈现</div>
          <div class="oc-flex" style="gap: 6px; margin-bottom: 6px"><RiskBadge :level="tpl.riskLevel" /><Tag size="small" variant="outline">{{ tpl.sandboxTier }}</Tag></div>
          <div class="oc-secondary" style="font-size: 12px">呈现格式：{{ tpl.presentation.format }}；呈现位：{{ tpl.presentation.slots.join('、') }}。</div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">仅异常格式必须含失败步骤、原因、已采取动作、建议动作与运行链接。</div>
        </div>
      </div>

      <Alert theme="info" style="margin: 12px 0" message="干跑是只读求值：不申请沙箱、不创建分支、不写工作区、不调用外部 API；结论只代表「声明层面的可执行性」。" />

      <div class="oc-card">
        <div class="oc-card__title">预期动作与权限清单<CliHint :command="`oc automation dry-run --template ${tpl.id} --show-permissions`" /></div>
        <Table :data="report" :columns="columns" row-key="step" size="small" :pagination="undefined">
          <template #step="{ row }"><span class="oc-mono">{{ row.step }}</span></template>
          <template #perm="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.permission }}</span></template>
          <template #risk="{ row }"><RiskBadge :level="row.risk" /></template>
          <template #effect="{ row }"><Tag size="small" theme="success" variant="light-outline">{{ row.effect }}</Tag></template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
          <Tag size="small" variant="outline">上限清单锁定：{{ tpl.permissions.denied.slice(0, 4).join('、') }}…</Tag>
          <Tag size="small" variant="outline">动作仍需决策链裁决（预授权只是静态门）</Tag>
          <Button size="small" variant="text" @click="router.push('/automation/sandbox-trial')">下一步：沙箱试运行</Button>
        </div>
      </div>
    </StateShell>
  </div>
</template>
