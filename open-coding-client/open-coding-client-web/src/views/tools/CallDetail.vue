<script setup lang="ts">
/** 调用详情（T-05）：结构化结果 + 错误类别与修复建议 + 前后哈希 + 决策引用 + 审计回放。溯源：卷 05 §4.5/§7 */
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Button, Drawer, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import StatCard from '@/components/common/StatCard.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const route = useRoute();
const { toolCalls, tools, decisions } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const current = ref(String(route.query.call ?? ''));
const traceOpen = ref(false);
const err = ref(makeError('NOT_FOUND', `call=${String(route.query.call ?? '')}`));

const call = computed(() => toolCalls.find((c) => c.callId === current.value) ?? toolCalls[0]);
const tool = computed(() => tools.find((t) => t.name === call.value.toolName));
const decision = computed(() => decisions.find((d) => d.decisionId === call.value.decisionRef));
const decisionMode = computed(() => (decision.value ? decision.value.mode : '—'));

const structuredResult = computed(() => {
  const base: Record<string, unknown> = {
    callId: call.value.callId,
    tool: call.value.toolName,
    status: call.value.status,
    exitCode: call.value.exitCode,
    durationMs: call.value.durationMs,
    resultSizeBytes: call.value.resultSizeBytes,
    resultTokens: call.value.resultTokens,
    externalized: call.value.externalized,
    artifactRef: call.value.artifactRef,
    cacheHit: call.value.cacheHit,
  };
  if (call.value.toolName === 'grep_search') {
    base.matches = [
      { file: 'core/permission/decision-engine.ts', line: 88, text: 'const d = this.decide(action);' },
      { file: 'core/permission/action-gateway.ts', line: 41, text: 'return engine.decide(descriptor);' },
    ];
    base.degraded = false;
  }
  if (call.value.toolName === 'edit_file') {
    base.replaced = 1;
    base.sha256Before = call.value.beforeHash;
    base.sha256After = call.value.afterHash;
    base.diffPreview = '- if (risk >= R3)\n+ if (isAtLeast(risk, R3))';
  }
  if (call.value.errorCategory) {
    base.error = { category: call.value.errorCategory, repair: call.value.repairSuggestion, retryable: call.value.errorCategory !== 'DANGER_COMMAND_BLOCKED' };
  }
  return base;
});

const traceColumns = [
  { colKey: 'step', title: '步', width: 60 },
  { colKey: 'rule', title: '求值对象 / 规则', width: 220 },
  { colKey: 'result', title: '结果', width: 92 },
  { colKey: 'note', title: '说明', ellipsis: true },
];

function check() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = toolCalls.some((c) => c.callId === current.value) ? 'NORMAL' : 'ERROR';
  }, 200);
}

function onPick(v: unknown) {
  current.value = String(v ?? '');
  check();
}

onMounted(() => {
  check();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="调用详情"
      desc="单次调用的事实包：结构化结果、错误类别与修复建议、写操作前后哈希、权限决策引用（含求值轨迹）、以及审计回放入口。"
      volume="卷 05"
      manifest="T-05"
      :cli="`oc tools call inspect ${call.callId} --with-decision --with-hashes`"
      :status="[{ label: call.status, theme: call.status === 'completed' ? 'success' : call.status === 'failed' ? 'danger' : 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button v-if="decision" size="small" variant="outline" @click="traceOpen = true">查看求值轨迹</Button>
        <Popconfirm content="审计回放为只读重建：不产生任何副作用（写工具按副作用账本跳过已发生条目）。确认回放？" @confirm="MessagePlugin.success('回放完成：决策与结果摘要与原记录一致（差异 0 项）')">
          <Button size="small" theme="primary">审计回放</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="耗时" :value="call.durationMs" unit="ms" format="raw" icon="time" />
      <StatCard label="结果规模" :value="call.resultSizeBytes" unit="B" format="raw" icon="file" :hint="`≈ ${call.resultTokens} token`" />
      <StatCard label="退出码" :value="call.exitCode === null ? '—' : call.exitCode" format="raw" icon="terminal" />
      <StatCard label="预算影响" :value="Number((call.resultTokens * 0.000003).toFixed(4))" format="cost" icon="discount" hint="含缓存折扣（命中 ×0.25）" />
    </div>

    <StateShell
      :state="state"
      empty-title="调用记录不存在"
      empty-desc="该 callId 未在事件流中命中（可能已超过留存期或被保留策略清理）。"
      empty-action="回到时间线"
      :what="`调用记录加载失败：${current}`"
      :why="err.message"
      how="请从下拉重新选择；若为历史调用，请确认事件留存期（默认 30 天）。"
      :trace-id="err.traceId"
      @retry="check"
      @empty-action="onPick(toolCalls[0].callId)"
    >
      <div class="oc-flex oc-flex--wrap" style="margin-bottom: 10px">
        <Select :model-value="current" size="small" style="width: 340px" :options="toolCalls.map((c) => ({ label: `${c.callId} · ${c.toolName}`, value: c.callId }))" @change="onPick" />
        <RiskBadge :level="tool ? tool.riskLevel : 'R0'" />
        <Tag size="small" variant="light-outline">{{ call.status }}</Tag>
        <CliHint :command="`oc events show --call ${call.callId}`" label="查看原始事件" />
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">调用概要</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'callId', label: '调用 ID', value: call.callId, copyable: true, mono: true },
            { key: 'tool', label: '工具', value: `${call.toolName}（${tool?.family ?? '—'}）` },
            { key: 'params', label: '参数摘要（脱敏）', value: call.paramSummaryMasked, block: true, mono: true },
            { key: 'res', label: '资源声明', value: call.resourceDecls.join(' · ') || '无' },
            { key: 'serial', label: '串行原因', value: call.serializedReason ?? '并行执行（无资源冲突）' },
            { key: 'cache', label: '缓存', value: call.cacheHit ? '命中（只读缓存，按参数 + 工作区版本键）' : '未命中' },
            { key: 'artifact', label: '外置工件', value: call.artifactRef ?? '无（结果内联）' },
          ]" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">写操作前后哈希</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'before', label: '写前哈希（sha256）', value: call.beforeHash ?? '不适用（只读或新建）', mono: true, copyable: Boolean(call.beforeHash) },
            { key: 'after', label: '写后哈希（sha256）', value: call.afterHash ?? '不适用', mono: true, copyable: Boolean(call.afterHash) },
            { key: 'use', label: '用途', value: '审计与回滚建议；重放时比对写后哈希决定是否跳过' },
          ]" />
          <div class="oc-divider" />
          <h3 class="oc-card__title">决策引用</h3>
          <InfoGrid :columns="1" :items="decision ? [
            { key: 'decisionId', label: '决策 ID', value: decision.decisionId, copyable: true, mono: true },
            { key: 'mode', label: '当时模式', value: decisionMode },
            { key: 'decision', label: '决策结果', value: `${decision.decision}（${decision.riskClass}）`, tag: { text: decision.decision, theme: decision.decision === 'DENY' ? 'danger' : decision.decision === 'ASK' ? 'warning' : 'success' } },
            { key: 'reason', label: '理由', value: decision.reason },
            { key: 'refs', label: '命中规则', value: decision.ruleRefs.join(' , ') || '无（按默认档位映射）', mono: true },
            { key: 'replay', label: '重放一致性', value: decision.replayMatch ? '一致（给定决策 ID 重放结果相同）' : '不一致（原工件已清理，属预期差异）', tag: { text: decision.replayMatch ? '一致' : '不一致', theme: decision.replayMatch ? 'success' : 'warning' } },
          ] : [{ key: 'none', label: '决策', value: '该调用未产生权限决策（如 Hooks 前置阻断）' }]" />
        </div>
      </div>

      <div v-if="call.errorCategory" class="oc-card" style="margin-top: 12px; border-color: var(--oc-sev-error)">
        <h3 class="oc-card__title">
          错误处理（三段式）
          <CopyableId :id="`trace-${call.callId}`" label="复制 traceId" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'what', label: '事实', value: `${call.toolName} 调用未成功（status=${call.status}）` },
          { key: 'why', label: '原因', value: `${call.errorCategory}｜${call.repairSuggestion ?? ''}` },
          { key: 'how', label: '动作', value: call.status === 'blocked' ? '已阻断且不会重试；如确需放行请调整策略或提交加白/授权申请' : '可修正参数后重试；同一工具同一错误连续 3 次将提示换路或求援' },
        ]" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">结构化结果（回喂模型的形态）</h3>
          <JsonBlock :value="structuredResult" :collapse-over="260" label="tool result payload" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">结果处理顺序（顺序铁律）</h3>
          <InfoGrid :columns="1" :items="[
            { key: 's1', label: '① Hooks 结果改写', value: 'tool.result.before（字段白名单），可追加标注' },
            { key: 's2', label: '② 结构校验', value: '与返回 Schema 比对；不符则回喂结构化错误' },
            { key: 's3', label: '③ 脱敏', value: '密钥/Token/手机号等掩码（必须先于裁剪与外置）' },
            { key: 's4', label: '④ 裁剪与外置', value: call.externalized ? `≥4k token → 外置为 ${call.artifactRef}` : '<4k token → 内联回喂' },
          ]" />
        </div>
      </div>

      <Drawer v-model:visible="traceOpen" header="权限求值轨迹（为什么是这个决策）" size="560px" :footer="false">
        <div v-if="decision" class="oc-stack">
          <InfoGrid :columns="1" :items="[
            { key: 'scope', label: '策略层级链', value: decision.scopeChain.join(' → ') },
            { key: 'version', label: '策略版本', value: decision.policyVersion },
            { key: 'latency', label: '决策耗时', value: `${decision.latencyMs} ms（P95 ≤ 10ms）` },
          ]" />
          <Table row-key="step" size="small" :data="decision.evaluationTrace" :columns="traceColumns">
            <template #step="{ row }"><span class="oc-mono">{{ row.step }}</span></template>
            <template #rule="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.rule }}</span></template>
            <template #result="{ row }">
              <Tag size="small" variant="light-outline" :theme="row.result === 'DENY' ? 'danger' : row.result === 'ASK' ? 'warning' : row.result === 'HIT' ? 'primary' : row.result === 'SKIP' ? 'default' : 'success'">{{ row.result }}</Tag>
            </template>
          </Table>
          <CliHint :command="`oc permission replay ${decision.decisionId}`" label="重放该决策" />
        </div>
        <StateShell v-else state="EMPTY" empty-title="无决策轨迹" empty-desc="该调用在权限决策前即被阻断或跳过（如参数校验失败）。" />
      </Drawer>
    </StateShell>
  </div>
</template>
