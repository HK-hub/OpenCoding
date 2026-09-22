<script setup lang="ts">
/** 宏（组合工具）（T-13）：内置宏逐步展开 + 权限透明。溯源：卷 05 D-TOOL-7 §10 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { macros } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const currentId = ref(macros[0]?.macroId ?? '');
const err = ref(makeError('PERMISSION_DENIED', '宏所需权限超出当前模式上限'));

const current = computed(() => macros.find((m) => m.macroId === currentId.value) ?? macros[0]);
const stepColumns = [
  { colKey: 'order', title: '步', width: 56 },
  { colKey: 'tool', title: '原子工具调用', width: 200 },
  { colKey: 'argsSummary', title: '参数摘要', ellipsis: true },
  { colKey: 'riskLevel', title: '风险级', width: 110 },
  { colKey: 'permission', title: '权限判定（原子粒度）', width: 180 },
];

/** 权限透明：宏不改变权限判定粒度——逐步展开为原子调用，逐条鉴权 */
const steps = computed(() =>
  current.value.steps.map((s) => ({
    ...s,
    permission: s.riskLevel === 'R0' ? 'ALLOW（只读，留痕）' : s.riskLevel === 'R1' ? 'ASK / ALLOW（按模式 + diff 预览）' : 'ASK（执行类，沙箱 + 资源限制）',
  })),
);

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = macros.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

function onPick(v: unknown) {
  currentId.value = String(v ?? '');
  refresh();
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="宏（组合工具）"
      desc="单一职责工具 + 显式组合宏：宏对权限透明（逐步展开为原子调用，逐条鉴权），不做「大而全的复合工具」，保证权限与审计按原子粒度。"
      volume="卷 05"
      manifest="T-13"
      cli="oc tools macro show 提交前检查 --expand"
      :status="[{ label: `内置 ${macros.filter((m) => m.builtin).length} 个`, theme: 'default' }, { label: '权限透明', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="展开执行会按原子调用逐条鉴权（可能出现多次 ASK）；任一步 DENY 将中止后续步骤并保留已完成部分的副作用账本。确认展开执行？" @confirm="MessagePlugin.success('宏已展开：共 4 次原子调用，其中 1 次待审批（其余已按模式自动放行）')">
          <Button size="small" theme="primary">展开并执行</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="宏总数" :value="macros.length" format="raw" icon="flag" />
      <StatCard label="可展开原子调用" :value="macros.reduce((a, m) => a + m.expandedCalls, 0)" format="raw" icon="tools" />
      <StatCard label="预计 token" :value="macros.reduce((a, m) => a + m.tokenEstimate, 0)" format="token" icon="chart" hint="宏整体预算（含中间结果回喂）" />
      <StatCard label="用户自定义宏" :value="macros.filter((m) => !m.builtin).length" format="raw" icon="user" hint="P2 能力：v1 仅内置少量宏" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Tag
        v-for="m in macros"
        :key="m.macroId"
        :theme="m.macroId === currentId ? 'primary' : 'default'"
        variant="light-outline"
        size="small"
        style="cursor: pointer"
        @click="onPick(m.macroId)"
      >
        {{ m.name }}
      </Tag>
      <CliHint :command="`oc tools macro show ${current.name} --expand --dry-run`" label="干跑展开" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有可用宏"
      empty-desc="宏库为空或用户自定义宏尚未发布（v1 仅内置少量宏）。"
      empty-action="重新加载"
      example-task="展开「提交前检查」宏并查看逐步鉴权"
      :what="`宏「${current.name}」加载失败`"
      :why="err.message"
      how="该宏所需权限超出当前模式上限（模式只能收窄不能放宽）：可提高模式或改用低权限宏。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">宏定义</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'id', label: '宏 ID', value: current.macroId, copyable: true, mono: true },
            { key: 'desc', label: '说明', value: current.desc },
            { key: 'risk', label: '最大风险级', value: current.riskMax },
            { key: 'calls', label: '展开调用数', value: `${current.expandedCalls} 次原子调用` },
            { key: 'tokens', label: '预计 token', value: `${current.tokenEstimate}（含中间结果回喂）` },
            { key: 'modes', label: '允许模式', value: current.allowedModes.join(' / ') },
            { key: 'transparent', label: '权限透明', value: current.permissionTransparent ? '是：逐步展开为原子调用，逐条鉴权与审计' : '否（不允许存在）' },
            { key: 'builtin', label: '来源', value: current.builtin ? '内置（随核心集发布）' : '用户自定义（P2，需人工评审后发布）' },
          ]" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">权限透明说明</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'p1', label: '原子粒度', value: '宏不产生新的权限语义：每一步都是标准工具调用，走同一条 11 步管线' },
            { key: 'p2', label: '拒绝传播', value: '任一原子调用被 DENY / 阻断 → 中止后续步骤（已完成步骤的副作用保留在账本）' },
            { key: 'p3', label: '审计', value: '审计记录逐步可见：宏 ID + 步骤序号 + 原子 callId 三元组可回溯' },
            { key: 'p4', label: '不可放宽', value: '宏不能携带「批量放行」语义；每一步仍按模式与策略逐条求值' },
          ]" />
          <div class="oc-divider" />
          <div class="oc-flex oc-flex--between">
            <span class="oc-muted" style="font-size: 12px">逐步展开结果可由 <span class="oc-mono">oc tools macro audit</span> 复算</span>
            <CopyableId :id="`macro://${current.macroId}`" label="复制宏引用" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">逐步展开（{{ steps.length }} 步 · 最大风险 <RiskBadge :level="current.riskMax" />）</h3>
        <Table row-key="order" size="small" :data="steps" :columns="stepColumns">
          <template #order="{ row }"><span class="oc-mono">{{ row.order }}</span></template>
          <template #tool="{ row }"><span class="oc-mono">{{ row.tool }}</span></template>
          <template #argsSummary="{ row }"><span class="oc-mono oc-muted" style="font-size: 11px">{{ row.argsSummary }}</span></template>
          <template #riskLevel="{ row }"><RiskBadge :level="row.riskLevel" /></template>
          <template #permission="{ row }">
            <Tooltip content="宏不改变鉴权粒度：该步骤按原子调用逐条求值（拒绝优先）">
              <Tag size="small" variant="light-outline" :theme="row.riskLevel === 'R0' ? 'success' : row.riskLevel === 'R1' ? 'warning' : 'danger'">{{ row.permission }}</Tag>
            </Tooltip>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
