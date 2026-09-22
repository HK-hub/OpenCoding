<script setup lang="ts">
/** 权限模式切换（P-02）：六档语义 / 适用场景 / 切换事件；yolo 企业禁用置灰。溯源：卷 06 D-PERM-9 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { PermissionMode } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { decisions } = toolData;

interface ModeMeta {
  mode: PermissionMode;
  semantics: string;
  applicable: string;
  riskCeiling: string;
  disabled?: string;
}

const MODES: ModeMeta[] = [
  { mode: 'readonly', semantics: '只读：仅允许读类工具（R0），拒绝一切写与执行', applicable: '探索、审计、新人熟悉代码', riskCeiling: 'R0' },
  { mode: 'plan', semantics: '计划：只允许分析与计划工具，禁止副作用；提交计划需批准', applicable: '大改动前置规划', riskCeiling: 'R0' },
  { mode: 'default', semantics: '默认：写与执行按风险 ASK（R1 可能自动放行、R2+ 需确认）', applicable: '日常开发', riskCeiling: 'R5（按策略）' },
  { mode: 'acceptEdits', semantics: '自动接受文件编辑（R1），执行类仍 ASK（R2+）', applicable: '高频编辑场景', riskCeiling: 'R4（按策略）' },
  { mode: 'autonomous', semantics: '自治：预授权边界内自动执行，越界 ASK / DENY', applicable: '长任务、无人值守', riskCeiling: 'R3（边界内）' },
  { mode: 'yolo', semantics: '全部放行（仅限沙箱内/一次性容器）', applicable: '极端场景（本地临时容器）', riskCeiling: 'R5', disabled: '企业租户强制禁用（技术强制，不可被下级放宽）' },
];

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const current = ref<PermissionMode>('default');
const pending = ref<PermissionMode | null>(null);
const err = ref(makeError('PERMISSION_DENIED', '模式切换被组织基线阻断（yolo 已禁用）'));

const modes = computed(() => MODES.map((m) => ({ ...m, active: m.mode === current.value })));
const switchEvents = computed(() =>
  decisions.slice(0, 10).map((d, i) => ({
    eventId: `mode.switched#${2600 + i}`,
    from: MODES[(i + 1) % 5].mode,
    to: d.mode,
    at: d.at,
    actor: i % 3 === 0 ? '沈亦舟' : i % 3 === 1 ? '林晚照' : '系统（会话模板）',
    reason: i % 2 === 0 ? '任务进入规划阶段' : '长任务无人值守（预授权边界 OK）',
  })),
);

const eventColumns = [
  { colKey: 'eventId', title: '事件', width: 180 },
  { colKey: 'from', title: '原模式', width: 120 },
  { colKey: 'to', title: '新模式', width: 120 },
  { colKey: 'actor', title: '操作者', width: 150 },
  { colKey: 'reason', title: '理由（审计留痕）', ellipsis: true },
  { colKey: 'at', title: '时间', width: 170 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = 'NORMAL';
  }, 200);
}

function pick(m: ModeMeta) {
  if (m.disabled) {
    MessagePlugin.error('该模式被组织基线禁用：yolo 在企业租户不可用（技术强制，不可被下级放宽）');
    return;
  }
  pending.value = m.mode;
}

function applySwitch() {
  if (!pending.value) return;
  current.value = pending.value;
  ui.currentMode = pending.value;
  MessagePlugin.success(`已切换为 ${pending.value}：模式是起点，策略仍可收窄（收窄立即生效，生成切换事件）`);
  pending.value = null;
  ui.track('permission.mode.switched', { mode: current.value });
}

onMounted(() => {
  current.value = ui.currentMode;
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="权限模式切换"
      desc="六档预置档位是「默认起点」：策略可收窄模式权限（不可放宽）。每次切换生成事件并记录操作者与理由 —— 审计关心「当时是什么模式」。"
      volume="卷 06"
      manifest="P-02"
      :cli="`oc permission mode set ${current} --reason '任务进入规划阶段'`"
      :status="[{ label: `当前 ${current}`, theme: 'primary' }, { label: 'yolo 企业禁用', theme: 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="refresh">刷新</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="当前模式" :value="current" format="raw" icon="platform" />
      <StatCard label="ASK 占比（24h）" :value="18.4" format="percent" icon="help" hint="打扰与风险成正比：高风险才打断" />
      <StatCard label="模式切换次数（7d）" :value="switchEvents.length" format="raw" icon="history" />
      <StatCard label="企业禁用档" :value="modes.filter((m) => m.disabled).length" format="raw" icon="lock" hint="技术强制：不可被下级放宽" />
    </div>

    <StateShell
      :state="state"
      empty-title="无可用模式"
      empty-desc="租户策略未下发任何可用模式（异常态，请联系平台管理员恢复基线）。"
      empty-action="重试"
      example-task="以 readonly 模式探索代码库（零副作用）"
      :what="'模式列表加载失败'"
      :why="err.message"
      how="yolo 切换请求被组织基线阻断；如需在一次性容器内使用请联系平台管理员（存在审计例外流程）。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-grid oc-grid--3">
        <div
          v-for="m in modes"
          :key="m.mode"
          class="oc-card"
          :style="{ borderColor: m.active ? 'var(--td-brand-color, #0052d9)' : m.disabled ? 'var(--oc-border-strong)' : undefined, opacity: m.disabled ? 0.6 : 1, cursor: 'pointer' }"
          @click="pick(m)"
        >
          <div class="oc-flex oc-flex--between">
            <span class="oc-mono" style="font-weight: 600">{{ m.mode }}</span>
            <Tag v-if="m.active" size="small" theme="primary" variant="light-outline">当前</Tag>
            <Tag v-else-if="m.disabled" size="small" theme="danger" variant="light-outline">企业禁用</Tag>
          </div>
          <p style="font-size: 12px; margin: 8px 0 4px">{{ m.semantics }}</p>
          <div class="oc-muted" style="font-size: 12px">适用：{{ m.applicable }}</div>
          <div class="oc-muted" style="font-size: 12px">风险上限：<span class="oc-mono">{{ m.riskCeiling }}</span></div>
          <Tooltip v-if="m.disabled" :content="m.disabled">
            <Tag size="small" variant="light-outline" theme="danger" style="margin-top: 6px">置灰不可选</Tag>
          </Tooltip>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">切换语义（后果与可逆性）</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'c1', label: '即时性', value: '切换对下一次动作求值即时生效；在途动作不受影响（不回溯撤销）' },
            { key: 'c2', label: '可逆性', value: '任意时刻可切回（无冷却）；切换历史全程留痕，可在审计中按模式过滤' },
            { key: 'c3', label: '收窄 vs 放宽', value: '策略只能收窄模式（例如 readonly 下禁止网络工具）；放宽模式本身不绕过策略' },
            { key: 'c4', label: '自动档位', value: '会话模板 / 长任务可自动切档（autonomous），但必须落在预授权边界内，越界转 ASK' },
          ]" />
          <div class="oc-flex" style="margin-top: 8px">
            <CliHint command="oc permission mode explain --mode autonomous" label="解释自治边界" />
          </div>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">切换事件（最近 10 次）</h3>
          <Table row-key="eventId" size="small" :data="switchEvents" :columns="eventColumns">
            <template #eventId="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.eventId }}</span></template>
            <template #from="{ row }"><span class="oc-mono" style="opacity: 0.7">{{ row.from }}</span></template>
            <template #to="{ row }"><span class="oc-mono" style="font-weight: 600">{{ row.to }}</span></template>
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          </Table>
        </div>
      </div>

      <Dialog
        :visible="Boolean(pending)"
        theme="warning"
        :header="`切换到 ${pending ?? ''} 模式？`"
        width="480px"
        :on-confirm="applySwitch"
        :on-cancel="() => (pending = null)"
        :on-close="() => (pending = null)"
      >
        <div class="oc-stack">
          <p style="margin: 0; font-size: 13px">
            切换后<b>下一次动作</b>立即按新模式求值；<b>在途动作不受影响</b>（不回溯撤销）。
          </p>
          <p class="oc-muted" style="margin: 0; font-size: 12px">
            可逆性：任意时刻可切回，无冷却；切换事件全程留痕（操作者 + 理由），审计可按模式过滤。
            注意：模式只是起点，策略仍会收窄权限（放宽模式不等于放开策略）。
          </p>
          <CliHint :command="`oc permission mode set ${pending ?? ''} --reason '手动切换（UI）'`" label="等价命令" />
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
