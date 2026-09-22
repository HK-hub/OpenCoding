<script setup lang="ts">
/**
 * V-08 回放控制台。
 * 四类回放：投影重建（只读）/ 会话重放（变速跳转，不重建逐字动画）/
 * 环境重放（沙箱隔离、可丢弃、写操作按副作用账本模拟）/ 审计重放（决策链一致性）。
 * 溯源：卷 16 §4.6/§5 ReplayPolicySPI；BUILD-MANIFEST V-08。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, MessagePlugin, Option, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { platformData } from '@/mock/data/platform';
import type { ReplayJob } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const activeId = ref('rp-02');
const speed = ref('8×');
const jumpSeq = ref('128300');
const replayStarted = ref(false);

const replays = computed(() => platformData.replays);
const active = computed<ReplayJob>(() => replays.value.find((r) => r.replayId === activeId.value) ?? replays.value[1]);
const isSession = computed(() => active.value.kind === '会话重放');
const isEnv = computed(() => active.value.kind === '环境重放');

/** 环境重放策略（ReplayPolicySPI）：哪些工具可在沙箱中真实执行 */
const POLICY = [
  { kind: '读操作（fs.read / repo.search / kb.query）', mode: '真实执行', note: '读操作无副作用，允许在沙箱真实执行以复现问题' },
  { kind: '写操作（fs.write / fs.delete）', mode: '按副作用账本模拟', note: '命中账本的写操作跳过；未命中的重定向到临时工作区（可丢弃）' },
  { kind: '外部调用（HTTP / webhook / git push）', mode: '默认禁止', note: '环境重放默认不出网；需显式策略放行并进入审计' },
  { kind: '命令执行（shell.exec 一次性）', mode: '沙箱内真实执行', note: '隔离档位不低于 L1；资源上限沿用工作区配额' },
];

const columns = [
  { colKey: 'kind', title: '回放类型', width: 120, cell: 'kind' },
  { colKey: 'scope', title: '范围', ellipsis: true },
  { colKey: 'status', title: '状态', width: 110, cell: 'status' },
  { colKey: 'progress', title: '进度', width: 160, cell: 'progress' },
  { colKey: 'sideEffectsSkipped', title: '跳过副作用', width: 110 },
  { colKey: 'op', title: '操作', width: 88, cell: 'op' },
];

const STATUS_THEME: Record<string, 'success' | 'primary' | 'danger' | 'warning'> = { SUCCEEDED: 'success', RUNNING: 'primary', FAILED: 'danger', PAUSED: 'warning' };

function startReplay() {
  replayStarted.value = true;
  MessagePlugin.success(
    isEnv.value
      ? `环境重放已启动：沙箱 ${active.value.sandboxId ?? 'ws-0004'}（可丢弃，结束后自动回收；跳过 ${active.value.sideEffectsSkipped} 个已发生写操作）`
      : `${active.value.kind} 已启动：只读回放，不触发任何副作用`,
  );
}

onMounted(() => {
  window.setTimeout(() => (demo.value = replays.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="回放控制台"
      desc="回放分四类且互不混用：投影重建与会话/审计回放只读无副作用；环境重放在隔离沙箱中执行且可丢弃，写操作按副作用账本模拟。"
      volume="卷 16" manifest="V-08" cli="oc event replay start --kind session --session S-1b2c --speed 8x"
      :status="[{ label: '只读回放默认', theme: 'success' }, { label: '环境重放可丢弃', theme: 'warning' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Button size="small" theme="primary" :disabled="active.status === 'RUNNING' && replayStarted" @click="startReplay">
          {{ replayStarted ? '回放中' : '启动回放' }}
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="进行中回放" :value="replays.filter((r) => r.status === 'RUNNING').length" icon="loading" hint="读回放不占执行预算，环境重放占用沙箱配额" />
      <StatCard label="跳过副作用" :value="replays.reduce((a, r) => a + r.sideEffectsSkipped, 0)" icon="secured" hint="副作用账本命中（幂等键），避免重复动作" />
      <StatCard label="回放一致性" :value="'一致'" format="raw" icon="check" hint="审计重放决策与历史一致（D-PERM-12）" />
      <StatCard label="可丢弃沙箱" :value="replays.filter((r) => r.discardable).length" icon="cloud" hint="环境重放结束即回收，不污染真实工作区" />
    </div>

    <StateShell
      :state="demo" stage="正在构建回放序列（读取检查点与事件位点）…"
      empty-title="没有可回放的记录" empty-desc="所选范围没有事件、检查点或快照；请先在会话或任务中产生语义事件。"
      empty-action="回到事件流确认已有事件" example-task="对会话 S-1b2c 做 8× 会话重放，定位第 18 步的错误决策"
      what="回放启动失败" why="快照引用缺失（对象存储跨区复制尚未完成），无可信起点"
      how="重试；或先由投影重建修复读模型，再启动会话重放" trace-id="trace-b22e7d40"
      @retry="demo = 'NORMAL'" @empty-action="activeId = 'rp-01'"
    >
      <Table :data="replays" :columns="columns" row-key="replayId" size="small" :pagination="undefined">
        <template #kind="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon :name="row.kind === '环境重放' ? 'cloud' : row.kind === '审计重放' ? 'secured' : 'history'" size="12px" />
            <span>{{ row.kind }}</span>
          </div>
        </template>
        <template #status="{ row }">
          <Tag :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #progress="{ row }">
          <Progress :percentage="row.progress" theme="line" :status="row.status === 'FAILED' ? 'error' : 'active'" size="small" />
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="activeId = row.replayId as string">打开</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          {{ active.kind }} · {{ active.replayId }}
          <Tag :theme="active.discardable ? 'warning' : 'success'" size="small" variant="light-outline">
            {{ active.discardable ? '沙箱可丢弃' : '只读 · 无副作用' }}
          </Tag>
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'scope', label: '范围', value: active.scope },
          { key: 'cursor', label: '当前位置', value: active.cursor, mono: true },
          { key: 'skipped', label: '跳过副作用', value: `${active.sideEffectsSkipped} 项（副作用账本命中即跳过）` },
          { key: 'sandbox', label: '沙箱', value: active.sandboxId ?? '不适用（只读回放不创建沙箱）', mono: true },
          { key: 'note', label: '说明', value: active.note },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 10px; gap: 8px">
          <Select v-model="speed" size="small" style="width: 110px" :disabled="!isSession" aria-label="回放速度">
            <Option value="1×" label="1×" />
            <Option value="4×" label="4×" />
            <Option value="8×" label="8×" />
            <Option value="最大" label="最大（跳步）" />
          </Select>
          <Input v-model="jumpSeq" size="small" style="width: 180px" :disabled="!isSession" placeholder="跳转到 seq" />
          <Tag v-if="isSession" size="small" variant="outline">会话重放不重建逐字动画（仅语义事件重建最终呈现）</Tag>
          <Tag v-else size="small" variant="outline">变速与跳转仅适用于会话重放</Tag>
        </div>
        <div class="oc-flex" style="margin-top: 8px">
          <CliHint :command="`oc event replay start --kind ${active.kind} --speed ${speed}`" />
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">环境重放策略（哪些工具可在沙箱真实执行）</h3>
        <Table
          :data="POLICY" size="small" :pagination="undefined" row-key="kind"
          :columns="[{ colKey: 'kind', title: '工具类别', width: 250 }, { colKey: 'mode', title: '策略', width: 160, cell: 'mode' }, { colKey: 'note', title: '说明', ellipsis: true }]"
        >
          <template #mode="{ row }">
            <Tag :theme="row.mode === '真实执行' || row.mode === '沙箱内真实执行' ? 'success' : row.mode === '默认禁止' ? 'danger' : 'warning'" size="small" variant="light-outline">
              {{ row.mode }}
            </Tag>
          </template>
        </Table>
        <div v-if="isEnv" class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">环境重放不污染真实工作区：所有写入落在沙箱或按账本模拟</Tag>
          <Tag variant="outline" size="small">沙箱结束即回收（可丢弃）</Tag>
        </div>
      </div>
    </div>
  </div>
</template>
