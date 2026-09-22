<script setup lang="ts">
/** 执行记录与录制（B-04）：命令/退出码/输出摘要/资源峰值 + 全量 IO 录制 + 脱敏标记。溯源：卷 07 D-SBOX-9 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { executionRecords } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const tierFilter = ref('');
const pageSize = ref(10);
const fullRecording = ref(false);
const recordingOpen = ref(false);
const currentId = ref(executionRecords[0]?.recordId ?? '');
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '录制存储写入失败（对象存储限流）'));

const rows = computed(() => executionRecords.filter((r) => !tierFilter.value || r.tier === tierFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const current = computed(() => executionRecords.find((r) => r.recordId === currentId.value) ?? executionRecords[0]);
const maskedCount = computed(() => executionRecords.filter((r) => r.maskedFields.length > 0).length);

const resourceSeries = computed(() => [
  { name: '内存峰值（MB）', points: executionRecords.map((r) => ({ x: r.recordId.slice(3), y: r.peakMemMb })) },
  { name: 'CPU 峰值（%）', points: executionRecords.map((r) => ({ x: r.recordId.slice(3), y: r.peakCpuPercent })) },
]);

const columns = [
  { colKey: 'recordId', title: '记录', width: 100 },
  { colKey: 'command', title: '命令（脱敏后）', width: 320 },
  { colKey: 'tier', title: '沙箱档', width: 90 },
  { colKey: 'exitCode', title: '退出码', width: 84 },
  { colKey: 'resources', title: '资源峰值', width: 160 },
  { colKey: 'stdoutSummary', title: '输出摘要', ellipsis: true },
  { colKey: 'recordingMode', title: '录制', width: 140 },
  { colKey: 'maskedFields', title: '脱敏', width: 120 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function pick(ctx: { row: Record<string, unknown> }) {
  currentId.value = String(ctx.row.recordId);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="执行记录与录制"
      desc="分级录制（默认：命令 + 退出码 + 输出摘要 + 资源峰值；高风险或企业策略开启全量 IO 录制并外置为工件）。录制内容默认脱敏。"
      volume="卷 07"
      manifest="B-04"
      cli="oc sandbox exec records --tier L1 --with-recording"
      :status="[{ label: fullRecording ? '全量录制：开启（会话级）' : '全量录制：关闭', theme: fullRecording ? 'warning' : 'default' }, { label: `脱敏 ${maskedCount} 条`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="recordingOpen = true">全量录制开关</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="执行记录" :value="executionRecords.length" format="raw" icon="terminal" />
      <StatCard label="非零退出" :value="executionRecords.filter((r) => r.exitCode !== null && r.exitCode !== 0).length" format="raw" icon="error" />
      <StatCard label="全量录制记录" :value="executionRecords.filter((r) => r.recordingMode === '全量 IO 录制').length" format="raw" icon="image" hint="全量录制外置为工件（含 TTL 与脱敏）" />
      <StatCard label="内存峰值最高" :value="Math.max(...executionRecords.map((r) => r.peakMemMb))" unit="MB" format="raw" icon="chart" :target="2048" target-kind="max" hint="超硬限将终止进程组" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="tierFilter" size="small" clearable placeholder="沙箱档" style="width: 150px" :options="['L0', 'L0+', 'L1', 'L2', 'L3'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc sandbox exec records --mask --export md" label="导出脱敏报告" />
      <span class="oc-muted" style="font-size: 12px">录制保留期默认 14 天（企业可配）；密钥 / Token / PII 一律掩码</span>
    </div>

    <StateShell
      :state="state"
      empty-title="没有执行记录"
      empty-desc="近 24h 未发生命令类执行（只读工具不产生执行记录，仅有调用事件）。"
      empty-action="清空筛选"
      example-task="运行一次构建并查看资源峰值与录制引用"
      :what="'录制写入失败'"
      :why="err.message"
      how="录制失败不影响执行本身（执行结果已返回）；摘要记录仍完整，全量录制将在重试后补齐。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 条执行记录，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="tierFilter = ''; refresh()"
    >
      <div class="oc-card" style="margin-bottom: 12px">
        <h3 class="oc-card__title">资源峰值分布（内存 / CPU）</h3>
        <OcChart type="line" :series="resourceSeries" :height="170" format="number" aria-label="执行记录资源峰值" />
      </div>

      <Table row-key="recordId" size="small" :data="shown" :columns="columns" :hover="true" @row-click="pick">
        <template #recordId="{ row }"><span class="oc-mono">{{ row.recordId }}</span></template>
        <template #command="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.command }}</span></template>
        <template #tier="{ row }"><Tag size="small" variant="light-outline" class="oc-mono">{{ row.tier }}</Tag></template>
        <template #exitCode="{ row }">
          <span v-if="row.exitCode === null" class="oc-muted">—</span>
          <Tag v-else size="small" variant="light-outline" :theme="row.exitCode === 0 ? 'success' : 'danger'">{{ row.exitCode }}</Tag>
        </template>
        <template #resources="{ row }">
          <span class="oc-mono" style="font-size: 11px">{{ row.peakCpuPercent }}% / {{ row.peakMemMb }}MB</span>
        </template>
        <template #recordingMode="{ row }">
          <Tooltip :content="row.recordingRef ? `全量 IO 工件：${row.recordingRef}` : '仅摘要（命令 + 退出码 + 输出尾部 + 错误摘录）'">
            <Tag size="small" variant="light-outline" :theme="row.recordingMode === '全量 IO 录制' ? 'warning' : 'default'">{{ row.recordingMode }}</Tag>
          </Tooltip>
        </template>
        <template #maskedFields="{ row }">
          <Tag v-if="row.maskedFields.length" size="small" theme="primary" variant="light-outline">已脱敏 {{ row.maskedFields.length }}</Tag>
          <Tag v-else size="small" variant="outline" theme="default">无敏感字段</Tag>
        </template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          记录详情（{{ current.recordId }}）
          <CopyableId :id="`sandbox://exec/${current.recordId}`" label="复制记录引用" />
        </h3>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'cmd', label: '命令（脱敏后）', value: current.command, span: 2, mono: true },
            { key: 'ws', label: '工作区 / 档位', value: `${current.workspace} / ${current.tier}` },
            { key: 'exit', label: '退出码', value: current.exitCode === null ? '运行中' : String(current.exitCode) },
            { key: 'out', label: '输出摘要', value: current.stdoutSummary, span: 2 },
            { key: 'err', label: '错误摘录（尾部）', value: current.stderrExcerpt || '无', span: 2, block: true, mono: true },
            { key: 'peak', label: '资源峰值', value: `CPU ${current.peakCpuPercent}% · 内存 ${current.peakMemMb}MB · 时长 ${Math.round(current.durationMs / 1000)}s` },
            { key: 'rec', label: '录制模式', value: current.recordingMode },
            { key: 'mask', label: '脱敏字段', value: current.maskedFields.length ? current.maskedFields.join(' / ') : '无（未检出敏感字段）', span: 2 },
            { key: 'ref', label: '录制工件', value: current.recordingRef ?? '无（摘要模式，不产生工件）', mono: true, span: 2 },
          ]"
        />
        <div class="oc-flex" style="margin-top: 8px; gap: 8px">
          <CliHint :command="`oc sandbox exec show ${current.recordId} --with-io`" label="查看完整 IO" />
          <Tag v-if="fullRecording" size="small" theme="warning" variant="light-outline">本会话全量录制开启中（界面显式提示）</Tag>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="recordingOpen" header="全量 IO 录制（会话级）" width="560px" :on-confirm="() => { fullRecording = !fullRecording; recordingOpen = false; MessagePlugin.warning(fullRecording ? '已开启全量录制：IO 将外置为工件（默认脱敏，保留 14 天）' : '已关闭全量录制：恢复摘要模式'); }">
      <div class="oc-stack">
        <p style="margin: 0; font-size: 13px">
          开启后：本会话后续执行将录制<b>完整 IO 流</b>（stdout/stderr/stdin）并外置为工件，供审计与复现。
        </p>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：① 存储与隐私成本上升（大输出会被截断为工件并计入配额）；② 录制内容默认脱敏（密钥 / Token / PII 掩码），但仍属敏感数据，按保留期（默认 14 天）清理。
          可逆：会话级开关，可随时关闭；已产生工件按 TTL 独立保留，不随后续关闭而删除。
        </p>
        <InfoGrid :columns="1" :items="[
          { key: 'd1', label: '默认档', value: '摘要：命令 + 退出码 + 输出尾部（保留 4 KB）+ 错误摘录 + 资源峰值' },
          { key: 'd2', label: '触发全量', value: '高风险动作（R4/R5）、企业策略强制、或用户显式开启（本开关）' },
          { key: 'd3', label: '脱敏', value: '录制前完成脱敏，禁止回显明文密钥（扫描验证作为验收项）' },
        ]" />
      </div>
    </Dialog>
  </div>
</template>
