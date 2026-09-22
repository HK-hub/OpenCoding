<script setup lang="ts">
/**
 * Z-05 恢复演练。
 * RPO ≤ 1min / RTO ≤ 15min 的达标证据（每次演练的实测值 + 报告引用）+ 未达标项的修复项。
 * 溯源：卷 19 D-PERS-5/§4.3；BUILD-MANIFEST Z-05。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import { platformData } from '@/mock/data/platform';
import type { RestoreDrill } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const resultFilter = ref('');
const active = ref<RestoreDrill>(platformData.persistence.drills[0]);
const releaseOpen = ref(false);

const drills = computed(() => platformData.persistence.drills);
const rows = computed(() => (resultFilter.value ? drills.value.filter((d) => d.result === resultFilter.value) : drills.value));
const latest = computed(() => drills.value[0]);
const passRate = computed(() => drills.value.filter((d) => d.result === 'SUCCEEDED').length / drills.value.length);

/** RTO/RPO 达标趋势（秒，越低越好；阈值线 60s / 900s） */
const rtoSeries = computed(() => [
  { name: 'RTO（秒）', points: drills.value.slice().reverse().map((d) => ({ x: d.at.slice(5, 10), y: d.rtoSeconds })) },
  { name: 'RPO（秒）', points: drills.value.slice().reverse().map((d) => ({ x: d.at.slice(5, 10), y: d.rpoSeconds })) },
]);

const columns = [
  { colKey: 'id', title: '演练', width: 90, cell: 'id' },
  { colKey: 'at', title: '时间', width: 160, cell: 'at' },
  { colKey: 'scope', title: '范围', ellipsis: true },
  { colKey: 'rpoSeconds', title: '实测 RPO', width: 120, cell: 'rpo' },
  { colKey: 'rtoSeconds', title: '实测 RTO', width: 120, cell: 'rto' },
  { colKey: 'result', title: '结论', width: 110, cell: 'result' },
  { colKey: 'reportRef', title: '报告', width: 200, cell: 'report' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = drills.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="恢复演练"
      desc="RPO ≤ 1 分钟、RTO ≤ 15 分钟必须由演练实测证明；未达标项必须给出修复项与复审时间，不允许「纸面达标」。"
      volume="卷 19" manifest="Z-05" cli="oc persistence drill run --scope full --verify-rpo-rto"
      :status="[{ label: `通过率 ${(passRate * 100).toFixed(0)}%`, theme: passRate >= 0.75 ? 'success' : 'warning' }, { label: '季度至少一次', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="resultFilter" size="small" style="width: 130px" clearable placeholder="按结论" aria-label="结论">
          <Option value="" label="全部结论" />
          <Option value="SUCCEEDED" label="SUCCEEDED" />
          <Option value="FAILED" label="FAILED" />
        </Select>
        <Button size="small" theme="primary" @click="releaseOpen = true">触发演练</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="最近 RPO 实测" :value="latest.rpoSeconds" unit="秒" icon="time" :target="60" target-kind="max" hint="目标 ≤ 60s（WAL 连续归档）" />
      <StatCard label="最近 RTO 实测" :value="latest.rtoSeconds" unit="秒" icon="history" :target="900" target-kind="max" hint="目标 ≤ 900s（15 分钟）" />
      <StatCard label="演练通过率" :value="passRate * 100" format="percent" icon="check" :target="75" hint="未通过项必有修复任务" />
      <StatCard label="对象存储故障切换" :value="drills.filter((d) => d.scope.includes('对象存储') && d.result === 'FAILED').length" icon="cloud" hint="该类演练 RTO 放宽至小时级，不阻塞核心" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">RPO / RTO 趋势（越接近 0 越好）</h3>
        <OcChart type="line" :height="220" unit="秒" :series="rtoSeries" :threshold="{ value: 900, label: 'RTO 上限 900s' }" aria-label="RPO RTO 趋势" />
        <Tag size="small" variant="outline" style="margin-top: 8px">RPO 以 WAL 归档位点与目标时间点之差计算</Tag>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          演练报告：{{ active.id }}
          <CliHint :command="`oc persistence drill report --id ${active.id}`" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'scope', label: '范围', value: active.scope },
          { key: 'operator', label: '执行人', value: active.operator },
          { key: 'at', label: '执行时间', value: new Date(active.at).toLocaleString('zh-CN') },
          { key: 'rpo', label: 'RPO', value: `${active.rpoSeconds}s`, tag: { text: active.rpoSeconds <= 60 ? '达标' : '超目标', theme: active.rpoSeconds <= 60 ? 'success' : 'warning' } },
          { key: 'rto', label: 'RTO', value: `${active.rtoSeconds}s`, tag: { text: active.rtoSeconds <= 900 ? '达标' : '超目标', theme: active.rtoSeconds <= 900 ? 'success' : 'warning' } },
          { key: 'ref', label: '报告引用', value: active.reportRef, mono: true },
        ]" />
        <JsonBlock
          :mask="false" label="演练证据摘要"
          :value="{
            rpoEvidence: 'WAL 归档位点 2026-09-21T06:58:12Z，恢复目标 2026-09-21T06:55:00Z，差值 ' + active.rpoSeconds + 's',
            rtoEvidence: ['故障注入 02:00:00', '检测与决策 02:00:' + (active.rtoSeconds > 600 ? '46' : '18'), '恢复执行与校验 ' + new Date(active.rtoSeconds * 1000).toISOString().slice(14, 19)],
            rollbackPath: active.result === 'SUCCEEDED' ? '恢复失败时可回退原实例（演练期间生产未停写）' : '对象存储跨区复制仍在追赶，需先完成复制再演练',
          }"
        />
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在读取演练记录与报告…"
      empty-title="没有演练记录" empty-desc="尚未执行恢复演练；RPO/RTO 未经实测前不得对外声明达标。"
      empty-action="立即安排一次演练" example-task="模拟误删后 PITR 恢复到 23:14 并校验行数"
      what="演练记录读取失败" why="报告存储（对象存储）不可达，报告引用暂时无法解析"
      how="重试；演练记录已快照到本地，可用 CLI 导出最近一次摘要" trace-id="trace-c55e0b49"
      @retry="demo = 'NORMAL'" @empty-action="releaseOpen = true"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.id }}</span></template>
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #rpo="{ row }">
          <span :style="{ color: row.rpoSeconds > 60 ? 'var(--oc-sev-warn)' : 'var(--oc-sev-ok)' }">{{ row.rpoSeconds }}s</span>
        </template>
        <template #rto="{ row }">
          <span :style="{ color: row.rtoSeconds > 900 ? 'var(--oc-sev-warn)' : 'var(--oc-sev-ok)' }">{{ row.rtoSeconds }}s</span>
        </template>
        <template #result="{ row }">
          <Tag :theme="row.result === 'SUCCEEDED' ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.result }}</Tag>
        </template>
        <template #report="{ row }">
          <Button size="small" variant="text" @click="active = row as RestoreDrill">{{ row.reportRef }}</Button>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="releaseOpen" header="触发恢复演练" width="560px" :confirm-btn="{ content: '排入演练', theme: 'primary' }" cancel-btn="取消" @confirm="releaseOpen = false; MessagePlugin.success('演练已排入计划：02:00 执行，报告自动归档并写入演练通过率')">
      <InfoGrid :columns="1" :items="[
        { key: 'scope', label: '演练范围', value: '全量恢复至独立实例 + 应用重连 + 六类一致性校验' },
        { key: 'impact', label: '对生产影响', value: '无：演练在独立实例执行；仅对象存储跨区复制会占用带宽' },
        { key: 'window', label: '时间窗', value: '低峰 02:00–03:00（与备份任务错峰 30 分钟）' },
        { key: 'fail', label: '失败处理', value: '失败不阻断发布，但必须生成修复项并安排复审（不静默）' },
      ]" />
    </Dialog>
  </div>
</template>
