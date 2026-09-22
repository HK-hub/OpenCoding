<script setup lang="ts">
/** 副作用账本（T-12）：幂等键 + 已发生副作用 + 重放跳过记录。溯源：卷 05 D-TOOL-10 §7 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { sideEffectLedger } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const typeFilter = ref('');
const pageSize = ref(10);
const err = ref(makeError('CONFLICT', '副作用账本与事件流不一致（发现未登记副作用，见 bypass.detected）'));

const rows = computed(() => sideEffectLedger.filter((e) => !typeFilter.value || e.effectType === typeFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const irreversible = computed(() => sideEffectLedger.filter((e) => !e.reversible).length);
const skipped = computed(() => sideEffectLedger.filter((e) => e.replayBehavior === '跳过（已发生）').length);

const columns = [
  { colKey: 'effectId', title: '副作用', width: 110 },
  { colKey: 'idempotencyKey', title: '幂等键', width: 300 },
  { colKey: 'toolName', title: '工具', width: 130 },
  { colKey: 'effectType', title: '类型', width: 130 },
  { colKey: 'target', title: '目标', width: 240 },
  { colKey: 'occurredAt', title: '发生时间', width: 170 },
  { colKey: 'reversible', title: '可逆 / 补偿', width: 250 },
  { colKey: 'replayBehavior', title: '重放行为', width: 140 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="副作用账本"
      desc="写工具登记不可逆/可逆副作用与幂等键：重放时跳过已发生条目，保证「会话中断重放不重复执行写操作」。先落账再回喂。"
      volume="卷 05"
      manifest="T-12"
      cli="oc tools ledger list --call TC-8f21 --explain"
      :status="[{ label: `不可逆 ${irreversible} 项`, theme: irreversible ? 'warning' : 'success' }, { label: `重放跳过 ${skipped} 项`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="重放会按账本逐条判定：已发生条目跳过、需确认条目再次询问、可重放条目重新执行。不会重复已发生副作用。确认重放？" @confirm="MessagePlugin.success('重放完成：跳过 7 项已发生副作用，重放 1 项只读条目，0 项新增副作用')">
          <Button size="small" theme="primary">按账本重放</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="副作用条目" :value="sideEffectLedger.length" format="raw" icon="history" />
      <StatCard label="不可逆条目" :value="irreversible" format="raw" icon="secured" hint="不可逆条目依赖快照或人工补偿" />
      <StatCard label="重放跳过" :value="skipped" format="raw" icon="check" hint="重放安全的核心保证" />
      <StatCard label="需确认条目" :value="sideEffectLedger.filter((e) => e.replayBehavior === '需确认').length" format="raw" icon="help" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="typeFilter" size="small" clearable placeholder="副作用类型" style="width: 190px" :options="['file_write', 'file_delete', 'process_start', 'network_post', 'git_commit'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc replay --session sess-7f21 --ledger-first" label="带账本重放会话" />
      <span class="oc-muted" style="font-size: 12px">幂等键构成：工具 + 关键参数哈希（写后哈希一致即视为已发生）</span>
    </div>

    <StateShell
      :state="state"
      empty-title="账本为空"
      empty-desc="本会话尚未发生写类副作用（只读调用不登记账本，仅写缓存）。"
      empty-action="清空筛选"
      example-task="执行一次文件编辑后查看副作用登记"
      :what="'副作用账本加载失败'"
      :why="err.message"
      how="检测到未登记副作用（旁路写入）时会置为不一致：请到「安全事件」查看 bypass.detected 并确认处置。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 项副作用，已折叠展示前 ${pageSize} 项`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="typeFilter = ''; refresh()"
    >
      <Table row-key="effectId" size="small" :data="shown" :columns="columns">
        <template #effectId="{ row }"><span class="oc-mono">{{ row.effectId }}</span></template>
        <template #idempotencyKey="{ row }"><CopyableId :id="row.idempotencyKey" label="复制幂等键" :short="34" /></template>
        <template #effectType="{ row }">
          <Tag size="small" variant="light-outline" :theme="row.effectType === 'file_delete' ? 'danger' : row.effectType === 'git_commit' ? 'primary' : 'default'">{{ row.effectType }}</Tag>
        </template>
        <template #target="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.target }}</span></template>
        <template #occurredAt="{ row }">{{ new Date(row.occurredAt).toLocaleString('zh-CN') }}</template>
        <template #reversible="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <Tag size="small" variant="light-outline" :theme="row.reversible ? 'success' : 'danger'">{{ row.reversible ? '可逆' : '不可逆' }}</Tag>
            <span class="oc-muted" style="font-size: 11px">{{ row.compensation }}</span>
          </div>
        </template>
        <template #replayBehavior="{ row }">
          <Tooltip :content="row.replayBehavior === '跳过（已发生）' ? '重放时检测到写后哈希/幂等键已存在 → 跳过，不产生重复副作用' : row.replayBehavior === '需确认' ? '重放时需再次人工确认（进程启动 / 网络写入）' : '只读语义，可安全重放'">
            <Tag size="small" variant="light-outline" :theme="row.replayBehavior === '跳过（已发生）' ? 'success' : row.replayBehavior === '需确认' ? 'warning' : 'default'">{{ row.replayBehavior }}</Tag>
          </Tooltip>
        </template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">重放语义说明（审计可回放）</h3>
        <InfoGrid :columns="2" :items="[
          { key: 'order', label: '落账时机', value: '第 9 步（幂等与缓存）先落账，再进入第 10 步事件与审计、第 11 步回喂 —— 先落账后回喂' },
          { key: 'key', label: '幂等键', value: 'callId + 规范化目标 + 内容/锚点哈希；写后哈希一致即判定「已发生」' },
          { key: 'irrev', label: '不可逆处置', value: '删除类副作用标不可逆：依赖删除前快照（SNAP-4409）作为补偿，重放默认跳过' },
          { key: 'conflict', label: '一致性检查', value: '账本与事件流双向比对（每 15 分钟增量）；差异将生成 bypass.detected 安全事件' },
        ]" />
      </div>
    </StateShell>
  </div>
</template>
