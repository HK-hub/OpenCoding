<script setup lang="ts">
/** 平台能力矩阵（B-02）：7 类能力 × Linux/macOS/Windows + 不可用格降级标注。溯源：卷 07 §4.2 / D-SBOX-11 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { PlatformCell } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { platformMatrix, sandboxPlans } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const platform = ref('Windows');
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '能力探测失败（WSL2 状态查询超时）'));

const cellsOf = (row: (typeof platformMatrix)[number], p: string): PlatformCell =>
  p === 'Linux' ? row.linux : p === 'macOS' ? row.macos : row.windows;

const counts = computed(() => {
  const all = platformMatrix.flatMap((r) => [r.linux, r.macos, r.windows]);
  return {
    available: all.filter((c) => c.status === 'available').length,
    degraded: all.filter((c) => c.status === 'degraded').length,
    unavailable: all.filter((c) => c.status === 'unavailable').length,
  };
});
const statusDist = computed(() => [
  { name: 'available', value: counts.value.available },
  { name: 'degraded', value: counts.value.degraded },
  { name: 'unavailable', value: counts.value.unavailable },
]);
const currentIssues = computed(() =>
  platformMatrix
    .map((r) => ({ capability: r.capability, cell: cellsOf(r, platform.value) }))
    .filter((x) => x.cell.status !== 'available'),
);
const platformDegrades = computed(() => sandboxPlans.filter((p) => p.platform === platform.value && p.degraded));

const cellTag = (c: PlatformCell) => (c.status === 'available' ? 'success' : c.status === 'degraded' ? 'warning' : 'danger');
const cellLabel = (c: PlatformCell) => (c.status === 'available' ? '可用' : c.status === 'degraded' ? '降级' : '不可用');

const columns = [
  { colKey: 'capability', title: '能力', width: 170 },
  { colKey: 'linux', title: 'Linux', width: 220 },
  { colKey: 'macos', title: 'macOS', width: 220 },
  { colKey: 'windows', title: 'Windows', width: 220 },
  { colKey: 'impact', title: '缺失影响', ellipsis: true },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = platformMatrix.length ? 'NORMAL' : 'EMPTY';
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
      title="平台能力矩阵"
      desc="跨平台不静默：每平台声明可用隔离能力，不可用档位降级到可用档并生成 sandbox.degraded 事件（界面显式提示）。企业可配置「不达标即拒绝执行」。"
      volume="卷 07"
      manifest="B-02"
      cli="oc sandbox capabilities --platform windows --explain"
      :status="[{ label: `${platform} 探测`, theme: 'primary' }, { label: `降级格 ${counts.degraded}`, theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="重新探测会重启能力检测（约 2s，只读探测，不影响在途执行）。确认重新探测？" @confirm="MessagePlugin.success('能力探测完成：Windows 新增可用能力 0 项，降级项 3 项')">
          <Button size="small" theme="primary">重新探测</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="能力项" :value="platformMatrix.length" format="raw" icon="platform" hint="7 类隔离与执行能力" />
      <StatCard label="可用格" :value="counts.available" format="raw" icon="check" :hint="`/ 21 格（3 平台 × 7 能力）`" />
      <StatCard label="降级格" :value="counts.degraded" format="raw" icon="discount" hint="可用但能力受限（已标注降级目标档）" />
      <StatCard label="不可用格" :value="counts.unavailable" format="raw" icon="close" hint="无等价能力（如 Windows 无 seccomp 等价物）" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Tag :theme="platform === 'Linux' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="platform = 'Linux'">Linux</Tag>
      <Tag :theme="platform === 'macOS' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="platform = 'macOS'">macOS</Tag>
      <Tag :theme="platform === 'Windows' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="platform = 'Windows'">Windows</Tag>
      <CliHint command="oc sandbox capabilities --matrix --json" label="导出矩阵" />
    </div>

    <StateShell
      :state="state"
      empty-title="能力矩阵不可用"
      empty-desc="无法读取平台能力表（探测失败）。矩阵为内核静态表，缺失说明内核未就绪。"
      empty-action="重新探测"
      example-task="对比三个平台的微虚拟机可用性（R4 动作强制档）"
      :what="'能力探测失败'"
      :why="err.message"
      how="探测失败不影响已缓存结论（最后一次成功探测的结果会标注时间）；可重试。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">7 能力 × 3 平台矩阵</h3>
        <Table row-key="capability" size="small" :data="platformMatrix" :columns="columns">
          <template #capability="{ row }">
            <span style="font-weight: 600; font-size: 12px">{{ row.capability }}</span>
          </template>
          <template #linux="{ row }">
            <Tooltip :content="row.linux.detail">
              <Tag size="small" variant="light-outline" :theme="cellTag(row.linux)">{{ cellLabel(row.linux) }}</Tag>
            </Tooltip>
          </template>
          <template #macos="{ row }">
            <Tooltip :content="row.macos.detail">
              <Tag size="small" variant="light-outline" :theme="cellTag(row.macos)">{{ cellLabel(row.macos) }}</Tag>
            </Tooltip>
          </template>
          <template #windows="{ row }">
            <Tooltip :content="`${row.windows.detail}${row.windows.degradeTo ? `（降级至 ${row.windows.degradeTo}）` : ''}`">
              <Tag size="small" variant="light-outline" :theme="cellTag(row.windows)">
                {{ cellLabel(row.windows) }}<template v-if="row.windows.degradeTo"> → {{ row.windows.degradeTo }}</template>
              </Tag>
            </Tooltip>
          </template>
          <template #impact="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.impact }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">能力状态分布（21 格）</h3>
          <OcChart type="donut" :values="statusDist" :height="180" format="number" aria-label="平台能力状态分布" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">
            {{ platform }} 降级与不可用项（{{ currentIssues.length }}）
            <CliHint :command="`oc sandbox capabilities --platform ${platform} --degraded`" />
          </h3>
          <div v-if="currentIssues.length" class="oc-stack">
            <div v-for="i in currentIssues" :key="i.capability" class="oc-stack" style="gap: 2px">
              <div class="oc-flex" style="gap: 6px">
                <Tag size="small" variant="light-outline" :theme="cellTag(i.cell)">{{ cellLabel(i.cell) }}</Tag>
                <span style="font-size: 12px; font-weight: 600">{{ i.capability }}</span>
                <Tag v-if="i.cell.degradeTo" size="small" variant="outline" theme="default" class="oc-mono">降级 → {{ i.cell.degradeTo }}</Tag>
              </div>
              <div class="oc-muted" style="font-size: 11px">{{ i.cell.detail }}</div>
            </div>
          </div>
          <div v-else class="oc-muted" style="font-size: 12px">该平台全部能力可用，无降级项。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">降级留痕要求（不可静默）</h3>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'd1', label: '显式提示', value: '每次降级生成 sandbox.degraded 事件（含目标档 / 实际档 / 原因），界面以 Tag + tooltip 展示' },
            { key: 'd2', label: '企业可强制拒绝', value: '策略开启「不达标即拒绝执行」时，降级不再发生（直接拒绝并给出替代路径：远程 L3 / 降低风险）' },
            { key: 'd3', label: '本平台近期降级', value: platformDegrades.length ? platformDegrades.map((p) => `${p.toolName}:${p.targetTier}→${p.actualTier}`).join('；') : '无（近 24h）' },
            { key: 'd4', label: '审计', value: '降级原因随计划写入事件流，可按 planId 回放选档依据' },
          ]"
        />
      </div>
    </StateShell>
  </div>
</template>
