<script setup lang="ts">
/**
 * Z-04 备份与 PITR。
 * 物理备份 + WAL 归档（连续归档支撑 PITR）+ 逻辑导出；展示备份年龄与 WAL 归档滞后，
 * 未验证/未加密的备份显式标红，不允许静默降级。
 * 溯源：卷 19 D-PERS-4/§4.3；BUILD-MANIFEST Z-04。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData, humanBytes, humanDuration } from '@/mock/data/platform';
import type { BackupEntry } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const typeFilter = ref('');
const pitrOpen = ref(false);
const pitrTarget = ref('2026-09-21T06:55:00Z');
const pitrScope = ref('全量实例');

const backups = computed(() => platformData.persistence.backups);
const rows = computed(() => (typeFilter.value ? backups.value.filter((b) => b.type === typeFilter.value) : backups.value));
const physical = computed(() => backups.value.find((b) => b.type === 'physical')!);
const walLag = computed(() => Math.min(...backups.value.filter((b) => b.type === 'wal').map((b) => b.walArchiveLagSeconds)));

/** 备份年龄趋势（小时粒度，观察备份任务是否按节奏） */
const ageSeries = computed(() => [
  {
    name: '备份年龄（分钟）',
    points: [30, 62, 118, 175, 240, 305, 366, 425, 480].map((v, i) => ({ x: `${(8 - i) * 4}h`, y: v })),
  },
]);

const columns = [
  { colKey: 'id', title: '备份', width: 90, cell: 'id' },
  { colKey: 'type', title: '类型', width: 120, cell: 'type' },
  { colKey: 'ageSeconds', title: '备份年龄', width: 140, cell: 'age' },
  { colKey: 'sizeBytes', title: '大小', width: 110, cell: 'size' },
  { colKey: 'walArchiveLagSeconds', title: 'WAL 滞后', width: 120, cell: 'lag' },
  { colKey: 'verified', title: '已验证', width: 110, cell: 'verified' },
  { colKey: 'encrypted', title: '加密', width: 110, cell: 'encrypted' },
  { colKey: 'location', title: '位置', ellipsis: true },
];

const TYPE_THEME: Record<string, 'primary' | 'warning' | 'default'> = { physical: 'primary', wal: 'warning', logical: 'default' };

function startPitr() {
  MessagePlugin.success(`PITR 任务已提交：恢复至 ${pitrTarget.value}（范围：${pitrScope.value}），先恢复到独立实例供校验，不覆盖生产`);
  pitrOpen.value = false;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = backups.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="备份与 PITR"
      desc="三层备份：物理全量 + WAL 连续归档（支撑任意时间点恢复）+ 逻辑导出（跨版本/跨厂商迁移）；RPO ≤ 1min，WAL 滞后即告警。"
      volume="卷 19" manifest="Z-04" cli="oc persistence backup status --show-wal-lag && oc persistence pitr start --to <ts>"
      :status="[{ label: `WAL 滞后 ${walLag}s`, theme: walLag <= 60 ? 'success' : 'warning' }, { label: '备份默认加密', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="typeFilter" size="small" style="width: 140px" clearable placeholder="备份类型" aria-label="类型">
          <Option value="" label="全部类型" />
          <Option value="physical" label="physical" />
          <Option value="wal" label="wal" />
          <Option value="logical" label="logical" />
        </Select>
        <Button size="small" theme="primary" @click="pitrOpen = true">时间点恢复（PITR）</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="最近物理备份年龄" :value="Math.round(physical.ageSeconds / 60)" unit="分钟" icon="database" :target="60" target-kind="max" hint="超 6 小时告警" />
      <StatCard label="WAL 归档滞后" :value="walLag" unit="秒" icon="time" :target="60" target-kind="max" hint="RPO ≤ 1min 的判定依据" />
      <StatCard label="备份总量" :value="backups.reduce((a, b) => a + b.sizeBytes, 0)" format="token" unit="B" icon="cloud" hint="对象存储 + 跨区复制" />
      <StatCard label="未验证备份" :value="backups.filter((b) => !b.verified).length" icon="bug" hint="校验和 + 抽样恢复双重验证" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">备份年龄趋势（近 32 小时）</h3>
        <OcChart type="area" :height="200" unit="分钟" :series="ageSeries" :threshold="{ value: 360, label: '告警阈值 6h' }" aria-label="备份年龄趋势" />
        <Tag size="small" variant="outline" style="margin-top: 8px">备份任务失败会显式告警并保留上一次可用备份的年龄</Tag>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          时间点恢复（PITR）能力
          <CliHint command="oc persistence pitr list --window 7d" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'window', label: '可恢复窗口', value: '最近 35 天（物理全量 + WAL 连续归档）' },
          { key: 'target', label: '恢复粒度', value: '任意时间点（秒级）；先恢复到独立实例校验，不直接覆盖生产' },
          { key: 'cross', label: '跨区可用', value: '跨区副本可独立承担恢复（对象存储跨区复制，当前状态：追赶中）' },
          { key: 'verify', label: '恢复后校验', value: '行数 + 校验和 + 六类一致性校验，任一失败则中止切换' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">未验证备份（bk-04）不可作为恢复起点</Tag>
        </div>
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在读取备份清单与 WAL 归档位点…"
      empty-title="没有可用备份" empty-desc="该实例尚未完成首次物理备份，或备份清单被保留策略清理。"
      empty-action="立即触发一次物理备份" example-task="备份并抽样恢复到临时库验证 RTO"
      what="备份清单读取失败" why="对象存储清单接口超时（跨区复制正在追赶），无法确认备份完整性"
      how="重试；失败期间禁止执行 PITR（避免从不完整备份恢复）" trace-id="trace-b44d1a37"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.id }}</span></template>
        <template #type="{ row }">
          <Tag :theme="TYPE_THEME[row.type] ?? 'default'" size="small" variant="light-outline">{{ row.type }}</Tag>
        </template>
        <template #age="{ row }">
          <span :style="{ color: row.ageSeconds > 21600 ? 'var(--oc-sev-warn)' : undefined }">{{ humanDuration(row.ageSeconds) }}</span>
        </template>
        <template #size="{ row }">{{ humanBytes(row.sizeBytes) }}</template>
        <template #lag="{ row }">
          <span :style="{ color: row.walArchiveLagSeconds > 60 ? 'var(--oc-sev-warn)' : undefined }">{{ row.walArchiveLagSeconds }}s</span>
        </template>
        <template #verified="{ row }">
          <Tag :theme="row.verified ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.verified ? '已验证' : '未验证' }}</Tag>
        </template>
        <template #encrypted="{ row }">
          <Tag :theme="row.encrypted ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.encrypted ? '加密' : '未加密' }}</Tag>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="pitrOpen" header="时间点恢复（PITR）" width="620px" :confirm-btn="{ content: '开始恢复到独立实例', theme: 'primary' }" cancel-btn="取消" @confirm="startPitr">
      <div class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'semantics', label: '语义', value: '恢复到新实例（不覆盖生产）；校验通过后由人工决定切换，切换本身是独立变更' },
          { key: 'rpo', label: 'RPO 目标', value: '≤ 1 分钟（WAL 连续归档，当前滞后 ' + walLag + 's）' },
          { key: 'rto', label: 'RTO 目标', value: '≤ 15 分钟（脚本化恢复 + 演练验证）' },
          { key: 'source', label: '恢复起点', value: 'bk-02（WAL）+ bk-01（物理全量）' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Input v-model="pitrTarget" size="small" style="width: 300px" placeholder="目标时间点（ISO 8601）" />
          <Select v-model="pitrScope" size="small" style="width: 200px" aria-label="恢复范围">
            <Option value="全量实例" label="全量实例" />
            <Option value="单租户" label="单租户" />
            <Option value="单分域（事件日志）" label="单分域（事件日志）" />
          </Select>
        </div>
        <CliHint :command="`oc persistence pitr start --to ${pitrTarget} --scope ${pitrScope} --target-instance dr-temp`" />
        <Tag theme="warning" variant="light-outline" size="small">恢复期间目标实例只读；校验失败即中止，不影响生产</Tag>
      </div>
    </Dialog>
  </div>
</template>
