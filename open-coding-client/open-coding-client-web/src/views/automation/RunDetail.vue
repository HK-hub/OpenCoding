<script setup lang="ts">
/**
 * 运行详情（N2-08）：步骤账本 + 状态机时间线 + 门禁断言 + 产物 + 成本账。
 * 溯源：卷 34 §5.4/§5.5/§7；BUILD-MANIFEST N2-08。
 * 关键：DEDUPLICATED 解释「为什么没跑」；BLOCKED 不消耗预算；ESCALATED 说明熔断与升级对象。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Popconfirm, Select, Table, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData, findRun } from '@/mock/data/automation';
import type { RunStatus } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();

const run = computed(() => findRun(String(route.params.id ?? '')));
const tpl = computed(() => automationData.templates.find((t) => t.id === run.value?.templateId));
const cancelled = ref(false);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const stepColumns = [
  { colKey: 'name', title: '步骤', width: 300, cell: 'name' },
  { colKey: 'status', title: '状态', width: 90, cell: 'status' },
  { colKey: 'durationMs', title: '耗时', width: 100, cell: 'dur' },
  { colKey: 'ledger', title: '账本（动作 / 影响面 / 决策）', cell: 'ledger' },
];
const verifyColumns = [
  { colKey: 'assert', title: '断言', cell: 'assert' },
  { colKey: 'expected', title: '期望', width: 80 },
  { colKey: 'actual', title: '实际', width: 80 },
  { colKey: 'pass', title: '结论', width: 100, cell: 'pass' },
];
const artColumns = [
  { colKey: 'type', title: '类型', width: 110, cell: 'type' },
  { colKey: 'ref', title: '产物引用（幂等定位 (模板, 目标, 幂等键)）', cell: 'ref' },
];

const STATUS_THEME: Record<RunStatus, 'success' | 'warning' | 'danger' | 'primary' | 'default'> = {
  SUCCEEDED: 'success', FAILED: 'danger', ESCALATED: 'warning', BLOCKED: 'warning',
  DEDUPLICATED: 'default', RUNNING: 'primary', VERIFYING: 'primary', QUEUED: 'default', CANCELLED: 'default',
};

/** 状态机时间线：按步骤账本时间升序还原（含终态说明） */
const timeline = computed(() => {
  if (!run.value) return [];
  const items = run.value.steps
    .flatMap((s) => s.ledger.map((l) => ({ at: l.at, text: `${s.name.split(' — ')[0]} · ${l.action}`, decision: l.decision })))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  items.push({ at: run.value.endedAt ?? new Date().toISOString(), text: `终态：${run.value.status}${cancelled.value ? '（人工取消）' : ''}`, decision: run.value.blockedReason ?? run.value.failureStage ?? '验收断言全部通过' });
  return items;
});

function cancelRun() {
  cancelled.value = true;
  MessagePlugin.warning('已在安全点请求取消：等待当前步骤退出，默认丢弃分支并保留报告（不强杀）');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="run ? `运行详情 · ${run.runId}` : '运行详情'"
      :desc="run ? `${run.templateName} v${run.version} · ${run.triggerSource}` : '未找到运行记录'"
      volume="卷 34" manifest="N2-08" :cli="run ? `oc automation run show ${run.runId} --with-ledger` : 'oc automation run show'"
      :status="run ? [{ label: run.status, theme: STATUS_THEME[run.status] }, { label: `成本 $${run.costUsd.toFixed(2)}`, theme: 'default' }] : []"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="router.push('/automation/runs')">返回历史</Button>
        <Popconfirm content="取消将在安全点退出（不强杀）；默认丢弃分支与临时产物，仅保留报告。是否取消？" @confirm="cancelRun">
          <Button size="small" theme="danger" variant="outline" :disabled="!run?.cancellable || cancelled">取消运行</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="run ? demo : 'EMPTY'" stage="正在读取步骤账本与事件回放…" :cancellable="!!run?.cancellable"
      empty-title="运行不存在" empty-desc="该 runId 未命中（可能已超出 90 天保留期或属于其它租户）。"
      empty-action="返回运行历史" example-task="打开一条 ESCALATED 运行，查看熔断与升级对象"
      what="运行详情加载失败" why="账本分区读取失败或事件回放引用已归档" how="重试；或从审计视图按运行 id 检索留档" trace-id="trace-8d204731"
      @retry="demo = 'NORMAL'" @empty-action="router.push('/automation/runs')" @cancel="cancelRun"
    >
      <template v-if="run">
        <!-- 状态特别说明：解释「为什么没跑」/「为什么停」 -->
        <Alert v-if="run.status === 'DEDUPLICATED'" theme="info" style="margin-bottom: 10px"
          :message="`为什么没跑：幂等键 ${run.idempotencyKey} 命中 ${run.dedupWindow}，本次触发直接落 DEDUPLICATED（复用 ${run.deduplicatedOf} 的产物，不启动沙箱、不消耗预算）。`" />
        <Alert v-else-if="run.status === 'BLOCKED'" theme="warning" style="margin-bottom: 10px"
          :message="`为什么被拦：${run.blockedReason}。BLOCKED 不消耗预算；通知级别为「需处理」并给出一键修正入口。`" />
        <Alert v-else-if="run.status === 'ESCALATED'" theme="error" style="margin-bottom: 10px"
          :message="`为什么升级人工：${run.failureStage}；熔断阈值「${run.escalation?.threshold}」，连续失败 ${run.escalation?.consecutiveFailures} 次，已升级至 ${run.escalation?.escalatedTo}。`" />
        <Alert v-else-if="run.status === 'FAILED'" theme="error" style="margin-bottom: 10px"
          :message="`失败阶段：${run.failureStage}；已采取动作：${run.takenAction}`" />

        <div class="oc-grid oc-grid--3">
          <div class="oc-card">
            <div class="oc-card__title">运行概要</div>
            <InfoGrid :columns="1" :items="[
              { key: 'id', label: 'runId', value: run.runId, mono: true, copyable: true },
              { key: 'idem', label: '幂等键', value: run.idempotencyKey, mono: true, copyable: true },
              { key: 'start', label: '开始时间', value: new Date(run.startedAt).toLocaleString('zh-CN') },
              { key: 'end', label: '结束时间', value: run.endedAt ? new Date(run.endedAt).toLocaleString('zh-CN') : '进行中' },
              { key: 'actor', label: '触发主体', value: run.actor },
            ]" />
            <div class="oc-flex" style="gap: 6px; margin-top: 6px"><CopyableId :id="run.runId" label="复制 runId" /></div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">成本账（四项硬上限）</div>
            <InfoGrid :columns="1" :items="[
              { key: 'cost', label: '本次成本', value: `$${run.costUsd.toFixed(2)}${run.costUsd === 0 ? '（未执行/去重，预算未消耗）' : ''}` },
              { key: 'cap', label: '成本上限', value: tpl ? `$${tpl.budget.costUsd}` : '—' },
              { key: 'dur', label: '时长上限', value: tpl ? `${tpl.budget.durationMin} 分钟` : '—' },
              { key: 'tools', label: '工具调用上限', value: tpl ? tpl.budget.toolCalls : '—' },
              { key: 'fan', label: '扇出上限', value: tpl ? tpl.budget.fanout : '—' },
            ]" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">沙箱与隔离</div>
            <InfoGrid :columns="1" :items="[
              { key: 'tier', label: '沙箱档位', value: tpl?.sandboxTier ?? '—' },
              { key: 'wt', label: 'worktree', value: `oc-wt/${run.runId}`, mono: true },
              { key: 'br', label: '分支', value: `oc/${run.runId}-run`, mono: true },
              { key: 'drop', label: '失败丢弃', value: '默认丢弃分支与临时产物，仅保留运行日志与报告' },
              { key: 'replay', label: '事件回放', value: '运行事件链可完整回放（触发源 → 步骤 → 决策 → 产物 → 成本）' },
            ]" />
          </div>
        </div>

        <div class="oc-card" style="margin-top: 12px">
          <div class="oc-card__title">步骤账本<CliHint :command="`oc automation run steps ${run.runId}`" /></div>
          <Table :data="run.steps" :columns="stepColumns" row-key="name" size="small" :pagination="undefined">
            <template #name="{ row }"><span style="font-size: 12px">{{ row.name }}</span></template>
            <template #status="{ row }">
              <Tag size="small" :theme="row.status === 'done' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'primary' : 'default'" variant="light-outline">{{ row.status }}</Tag>
            </template>
            <template #dur="{ row }">{{ row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '—' }}</template>
            <template #ledger="{ row }">
              <div v-for="(l, i) in row.ledger" :key="i" class="oc-stack" style="gap: 0">
                <span style="font-size: 12px">{{ l.action }} · {{ l.effect }}</span>
                <span class="oc-muted" style="font-size: 11px">{{ l.decision }} · {{ new Date(l.at).toLocaleTimeString('zh-CN') }}</span>
              </div>
              <span v-if="!row.ledger.length" class="oc-muted" style="font-size: 12px">未执行（前置校验未通过 / 未开始）</span>
            </template>
          </Table>
        </div>

        <div class="oc-grid oc-grid--2" style="margin-top: 12px">
          <div class="oc-card">
            <div class="oc-card__title">状态机时间线</div>
            <Timeline>
              <TimelineItem v-for="(t, i) in timeline" :key="i" :label="new Date(t.at).toLocaleTimeString('zh-CN')" :content="t.text" />
            </Timeline>
            <div class="oc-muted" style="font-size: 12px">状态机：QUEUED → (DEDUPLICATED / BLOCKED / RUNNING) → VERIFYING → SUCCEEDED / FAILED → ESCALATED / CANCELLED。</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">门禁断言结果</div>
            <Table :data="run.verificationResults" :columns="verifyColumns" row-key="assert" size="small" :pagination="undefined">
              <template #assert="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.assert }}</span></template>
              <template #pass="{ row }"><Tag size="small" :theme="row.pass ? 'success' : 'danger'" variant="light-outline">{{ row.pass ? '通过' : '未通过' }}</Tag></template>
            </Table>
            <div v-if="!run.verificationResults.length" class="oc-muted" style="font-size: 12px">未进入验收阶段（前置步骤未通过或未执行）。</div>
          </div>
        </div>

        <div class="oc-card" style="margin-top: 12px">
          <div class="oc-card__title">产物（按 (模板, 目标, 幂等键) 唯一定位；已存在则更新）</div>
          <Table :data="run.artifacts" :columns="artColumns" row-key="id" size="small" :pagination="undefined">
            <template #type="{ row }"><Tag size="small" variant="light-outline" theme="primary">{{ row.type }}</Tag></template>
            <template #ref="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.ref }}</span></template>
          </Table>
          <div v-if="!run.artifacts.length" class="oc-muted" style="font-size: 12px">无产物（去重/拦截/取消的运行不产生新产物；丢弃分支后仅保留报告）。</div>
        </div>
      </template>
    </StateShell>
  </div>
</template>
