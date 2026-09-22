<script setup lang="ts">
/**
 * Z-11 灾备与演练。
 * 主备 / 多副本 + 跨区备份拓扑 + 复制滞后 + 季度演练报告与改进项；
 * 降级状态（跨区副本滞后、对象存储复制降级）显式标注且不可静默。
 * 溯源：卷 19 D-PERS-10；BUILD-MANIFEST Z-11。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData, humanDuration } from '@/mock/data/platform';
import type { DrTopology } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE'>('LOADING');
const active = ref<DrTopology>(platformData.persistence.drTopology[2]);

const topo = computed(() => platformData.persistence.drTopology);
const drills = computed(() => platformData.persistence.drills);
const latestDrill = computed(() => drills.value[0]);
const degraded = computed(() => topo.value.filter((t) => t.status !== 'HEALTHY').length);
const quarterlyPassed = computed(() => drills.value.filter((d) => d.result === 'SUCCEEDED').length);

const lagSeries = computed(() => [
  { name: '复制滞后（秒）', points: topo.value.map((t, i) => ({ x: t.region.slice(0, 4) + (i ? ` (${i})` : ''), y: t.replicationLagSeconds })) },
].filter((s) => s.points.length));

const columns = [
  { colKey: 'role', title: '角色', width: 200, cell: 'role' },
  { colKey: 'region', title: '区域', width: 200 },
  { colKey: 'mode', title: '模式', ellipsis: true },
  { colKey: 'replicationLagSeconds', title: '复制滞后', width: 120, cell: 'lag' },
  { colKey: 'status', title: '状态', width: 120, cell: 'status' },
  { colKey: 'crossRegionBackup', title: '跨区备份', width: 120, cell: 'cross' },
];

const STATUS_THEME: Record<string, 'success' | 'warning' | 'danger'> = { HEALTHY: 'success', LAGGING: 'warning', DEGRADED: 'danger' };

function switchover() {
  MessagePlugin.success('已提交主备切换演练：先冻结写入 → 确认副本位点 → 切换 → 应用重连（全程记录报告）');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = topo.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="灾备与演练"
      desc="主备 + 多副本 + 跨区备份；退化状态（复制滞后、对象存储降级）必须显式标注。季度恢复演练出报告，失败项必须落修复任务。"
      volume="卷 19" manifest="Z-11" cli="oc persistence dr status && oc persistence dr drill --scope switchover"
      :status="[{ label: degraded ? `${degraded} 项降级` : '全部健康', theme: degraded ? 'warning' : 'success' }, { label: `季度演练通过 ${quarterlyPassed}`, theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 150px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'OFFLINE', label: '离线' },
        ]" />
        <Button size="small" theme="primary" variant="outline" @click="switchover">主备切换演练</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="热备复制滞后" :value="topo.find((t) => t.role.includes('热备'))?.replicationLagSeconds ?? 0" unit="秒" icon="refresh" :target="10" target-kind="max" hint="同步复制 + 自动切换" />
      <StatCard label="跨区副本滞后" :value="topo.find((t) => t.role.includes('跨区'))?.replicationLagSeconds ?? 0" unit="秒" icon="cloud" :target="60" target-kind="max" hint="异步复制，RPO ≤ 1min 目标" />
      <StatCard label="最近演练 RTO" :value="latestDrill.rtoSeconds" unit="秒" icon="history" :target="900" target-kind="max" hint="目标 ≤ 15 分钟" />
      <StatCard label="跨区备份覆盖" :value="(topo.filter((t) => t.crossRegionBackup).length / topo.length) * 100" format="percent" icon="secured" hint="三类命名空间双向复制" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">复制滞后对比（秒）</h3>
        <OcChart type="bar" :height="200" unit="秒" :series="lagSeries" :threshold="{ value: 60, label: 'RPO 目标 60s' }" aria-label="跨区复制滞后" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">对象存储跨区复制降级：恢复时可能缺最近 3 分钟对象</Tag>
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          拓扑详情：{{ active.role }}
          <CliHint :command="`oc persistence dr describe --role '${active.role}'`" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'region', label: '区域', value: active.region },
          { key: 'mode', label: '复制模式', value: active.mode },
          { key: 'lag', label: '复制滞后', value: `${active.replicationLagSeconds}s`, tag: { text: active.status, theme: STATUS_THEME[active.status] } },
          { key: 'cross', label: '跨区备份', value: active.crossRegionBackup ? '启用（跨区复制）' : '未启用' },
          { key: 'action', label: '退化处置', value: active.status === 'HEALTHY' ? '无需干预' : '提高复制并发 + 检查带宽；连续 3 次采样未收敛则升级为 SEV3' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag v-if="active.status !== 'HEALTHY'" theme="warning" variant="light-outline" size="small">降级不静默：已进入运维告警并在状态栏显示降级档位</Tag>
        </div>
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在读取灾备拓扑与复制位点…"
      empty-title="未配置灾备拓扑" empty-desc="当前为 local-lite 形态（单实例），灾备能力不可用；server/企业形态建议启用主备与跨区副本。"
      empty-action="查看部署形态说明" example-task="完成一次主备切换演练并归档报告"
      what="灾备状态读取失败" why="跨区副本探活超时（网络分区或区域故障），无法确认复制位点"
      how="重试；恢复期间禁止执行主备切换（避免脑裂）" trace-id="trace-c22f7a90"
      :reconnect-in-ms="8000" :disabled-capabilities="['主备切换', '跨区备份校验']"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @dismiss-offline="demo = 'NORMAL'"
    >
      <Table :data="topo" :columns="columns" row-key="role" size="small" :pagination="undefined">
        <template #role="{ row }"><span>{{ row.role }}</span></template>
        <template #lag="{ row }">
          <span :style="{ color: row.replicationLagSeconds > 60 ? 'var(--oc-sev-warn)' : undefined }">{{ row.replicationLagSeconds }}s</span>
        </template>
        <template #status="{ row }">
          <Tag :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #cross="{ row }">
          <Tag :theme="row.crossRegionBackup ? 'success' : 'default'" size="small" variant="light-outline">{{ row.crossRegionBackup ? '启用' : '未启用' }}</Tag>
        </template>
      </Table>
    </StateShell>

    <div class="oc-card">
      <h3 class="oc-card__title">
        季度演练报告（最近 {{ drills.length }} 次）
        <CliHint command="oc persistence dr drill report --latest --download" />
      </h3>
      <Table
        :data="drills" size="small" :pagination="undefined" row-key="id"
        :columns="[
          { colKey: 'at', title: '时间', width: 150, cell: 'at' },
          { colKey: 'scope', title: '演练范围', ellipsis: true },
          { colKey: 'rpoSeconds', title: 'RPO', width: 100, cell: 'rpo' },
          { colKey: 'rtoSeconds', title: 'RTO', width: 100, cell: 'rto' },
          { colKey: 'result', title: '结论', width: 120, cell: 'result' },
          { colKey: 'reportRef', title: '报告', width: 260, cell: 'ref' },
        ]"
      >
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.at).toLocaleDateString('zh-CN') }}</span></template>
        <template #rpo="{ row }">{{ row.rpoSeconds }}s</template>
        <template #rto="{ row }">{{ row.rtoSeconds }}s</template>
        <template #result="{ row }">
          <Tag :theme="row.result === 'SUCCEEDED' ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.result }}</Tag>
        </template>
        <template #ref="{ row }"><span class="oc-mono">{{ row.reportRef }}</span></template>
      </Table>
      <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
        <Tag theme="warning" variant="light-outline" size="small">
          对象存储故障切换演练失败（RTO {{ humanDuration(drills[2].rtoSeconds) }} > 15min）→ 已生成修复任务：提高跨区复制并发
        </Tag>
      </div>
    </div>
  </div>
</template>
