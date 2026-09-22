<script setup lang="ts">
/**
 * 灰度 / A-B 面板（M-14 / 卷 02 D-MDL-13）：
 * 稳定分桶（租户/项目/会话哈希，可复现）+ arm A/B 指标 + 门控阈值 + 自动回滚历史。
 * 门控未达标时不允许放量；自动回滚是显式事件（Tag + 原因 + 动作清单），不是静默切回。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, MessagePlugin, Popconfirm, Progress, Table, Tag, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtCost, type PageState } from '@/components/gateway/types';
import { bucketOf } from '@/mock/rng';
import { modelData } from '@/mock/data/model';
import type { GrayMetrics, GrayRolloutData } from '@/mock/data/model';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const selected = ref(data.grayRollouts[0].id);
const recalcSalt = ref(data.grayRollouts[0].bucketSalt);

const rollout = computed<GrayRolloutData>(() => data.grayRollouts.find((g) => g.id === selected.value) ?? data.grayRollouts[0]);
const rolledBack = computed(() => data.grayRollouts.filter((g) => g.status === 'rolled_back').length);
const running = computed(() => data.grayRollouts.filter((g) => g.status === 'running').length);

const METRIC_LABEL: Record<keyof GrayMetrics, string> = {
  qualityScore: '质量分',
  passRatePct: '关键用例通过率',
  costPerCallUsd: '单次成本',
  p95LatencyMs: 'P95 延迟',
  errorRatePct: '错误率',
};

/** 分桶复现：同 (salt, key) 必得同桶（FNV-1a），与运行时算法一致 */
const buckets = computed(() =>
  rollout.value.bucketSamples.map((s) => {
    const recomputed = bucketOf(`${recalcSalt.value}:${s.key}`, rollout.value.bucketCount);
    const armByBucket = recomputed < Math.round((rollout.value.arms[0].trafficPct / 100) * rollout.value.bucketCount) ? 'A' : 'B';
    return { key: s.key, bucket: recomputed, arm: armByBucket, same: recomputed === s.bucket && armByBucket === s.arm };
  }),
);

const bucketColumns: PrimaryTableCol[] = [
  { colKey: 'key', title: '分桶键', width: 260 },
  { colKey: 'bucket', title: '桶号', width: 110 },
  { colKey: 'arm', title: '命中 arm', width: 120 },
  { colKey: 'same', title: '复现一致性' },
];

const armColumns: PrimaryTableCol[] = [
  { colKey: 'arm', title: 'Arm', width: 200 },
  { colKey: 'traffic', title: '流量 / 样本', width: 170 },
  { colKey: 'quality', title: '质量分', width: 110 },
  { colKey: 'pass', title: '通过率', width: 110 },
  { colKey: 'cost', title: '单次成本', width: 120 },
  { colKey: 'latency', title: 'P95 延迟', width: 120 },
  { colKey: 'error', title: '错误率', width: 110 },
];

const armRows = computed(() =>
  rollout.value.arms.map((a) => ({
    id: `${a.arm}-${a.version}`,
    arm: `Arm ${a.arm} · ${a.label}`,
    version: a.version,
    traffic: `${a.trafficPct}%`,
    sample: a.sampleCount.toLocaleString('zh-CN'),
    quality: a.metrics.qualityScore,
    pass: `${a.metrics.passRatePct}%`,
    cost: fmtCost(a.metrics.costPerCallUsd),
    latency: `${a.metrics.p95LatencyMs}ms`,
    error: `${a.metrics.errorRatePct}%`,
  })),
);

const gateColumns: PrimaryTableCol[] = [
  { colKey: 'metric', title: '门控指标', width: 200 },
  { colKey: 'threshold', title: '阈值', width: 120 },
  { colKey: 'current', title: '当前值', width: 120 },
  { colKey: 'verdict', title: '结论', width: 130 },
  { colKey: 'note', title: '说明' },
];

function promote(a: 'A' | 'B') {
  MessagePlugin[a === 'B' ? 'success' : 'info'](a === 'B' ? '已提交放量申请：需通过门控（质量 ≥ 稳定版 且 成本不劣化 > 10%）后生效' : '已选择稳定臂为主流量');
}

/** 切换查看的实验（同时同步该实验的 salt，保证分桶复现口径一致） */
function pick(row: GrayRolloutData) {
  selected.value = row.id;
  recalcSalt.value = row.bucketSalt;
}

/** 导出实验报告：当前实验的 arm 指标 / 门控结论 / 回滚历史 + 分桶复现结果（salt 记录在案，可复现） */
function exportReport() {
  const r = rollout.value;
  const file = downloadJson(
    {
      rollout: {
        id: r.id,
        name: r.name,
        kind: r.kind,
        target: r.target,
        bucketBy: r.bucketBy,
        bucketSalt: r.bucketSalt,
        bucketCount: r.bucketCount,
        status: r.status,
        startedAt: r.startedAt,
        arms: r.arms,
        gates: r.gates,
        rollbackHistory: r.rollbackHistory,
      },
      // 分桶复现口径：同一 (salt, key) 必得同桶，与运行时 FNV-1a 算法一致
      bucketReproduction: { salt: recalcSalt.value, samples: buckets.value },
      allRollouts: data.grayRollouts.map((g) => ({ id: g.id, name: g.name, target: g.target, status: g.status })),
      redactionNote: '实验报告仅含分桶/指标/门控数据，不含任何密钥材料',
    },
    `oc-model-gray-report-${r.id}-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出实验报告：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = data.grayRollouts.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="灰度与 A/B"
      desc="按租户 / 项目 / 会话哈希稳定分桶（同输入同分桶，可复现）+ 评测门控 + 在线指标。指标劣化超阈值时自动回滚，并留下原因与动作清单（不静默切回）。"
      volume="卷 02"
      manifest="M-14"
      cli="oc model gray list | oc model gray assign --rollout gray-model-01 --key payment-core | oc model gray rollback --id gray-model-03"
      :status="[{ label: `${running} 个进行中`, theme: 'primary' }, { label: `${rolledBack} 个已回滚`, theme: rolledBack ? 'warning' : 'default' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="exportReport">导出实验报告</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="实验总数" :value="data.grayRollouts.length" icon="flag" :hint="`进行中 ${running} · 已回滚 ${rolledBack}`" />
      <StatCard label="自动回滚次数" :value="data.grayRollouts.reduce((a, b) => a + b.rollbackHistory.length, 0)" icon="refresh" hint="回滚由门控触发，带原因与动作清单" />
      <StatCard label="分桶可复现性" :value="100" format="percent" icon="sitemap" :target="100" target-kind="min" hint="FNV-1a(salt + key) % buckets；与运行时算法一致" />
      <StatCard label="门控未通过项" :value="data.grayRollouts.reduce((a, b) => a + b.gates.filter((g) => !g.pass).length, 0)" icon="error" hint="未通过项不允许放量（可显式豁免并记录理由）" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有灰度实验"
      empty-desc="没有实验时全部流量走稳定版本（安全默认）。"
      empty-action="创建灰度实验"
      what="灰度数据加载失败"
      why="实验配置读取异常；当前分桶结果可能已过期，流量分配仍按最近一次成功配置执行。"
      how="可重试；实验不可读时不会自动放量（保持现状，安全优先）。"
      trace-id="trace-gray-2b64"
      missing-permission="model.manage"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage（放量/回滚属 R3 变更）"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('创建实验需要：目标模型/提示词、分桶维度、流量比例与门控指标')"
    >
      <div class="oc-flex oc-flex--wrap" style="margin-bottom: 8px">
        <Table :data="data.grayRollouts" :columns="[
          { colKey: 'name', title: '实验', width: 280 },
          { colKey: 'kind', title: '类型 / 目标', width: 260 },
          { colKey: 'bucket', title: '分桶', width: 220 },
          { colKey: 'arms', title: '流量 A / B', width: 150 },
          { colKey: 'status', title: '状态', width: 130 },
          { colKey: 'pick', title: '选择', width: 90 },
        ]" row-key="id" size="small" :pagination="{ pageSize: 6, total: data.grayRollouts.length }">
          <template #kind="{ row }">
            <div class="oc-stack" style="gap: 2px; font-size: 12px">
              <span>{{ row.kind === 'model' ? '模型灰度' : '路由实验' }}</span>
              <span class="oc-mono oc-muted">{{ row.target }}</span>
            </div>
          </template>
          <template #bucket="{ row }">
            <span style="font-size: 12px">按 {{ row.bucketBy }} · {{ row.bucketCount }} 桶 · salt={{ row.bucketSalt }}</span>
          </template>
          <template #arms="{ row }">
            <span class="oc-flex" style="gap: 4px">
              <Tag size="small" variant="light-outline">A {{ row.arms[0].trafficPct }}%</Tag>
              <Tag size="small" variant="outline">B {{ row.arms[1].trafficPct }}%</Tag>
            </span>
          </template>
          <template #status="{ row }">
            <Tag :theme="row.status === 'running' ? 'primary' : row.status === 'rolled_back' ? 'danger' : row.status === 'paused' ? 'warning' : 'success'" size="small" variant="light-outline">
              {{ row.status === 'running' ? '进行中' : row.status === 'rolled_back' ? '已自动回滚' : row.status === 'paused' ? '已暂停' : '已完成' }}
            </Tag>
          </template>
          <template #pick="{ row }">
            <Button size="small" variant="text" @click="pick(row as unknown as GrayRolloutData)">查看</Button>
          </template>
        </Table>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>{{ rollout.name }} · arm 对比</span>
          <span class="oc-flex" style="gap: 6px">
            <Tag v-if="rollout.status === 'rolled_back'" theme="danger" size="small" variant="light-outline">已自动回滚（历史见下方时间线）</Tag>
            <Popconfirm content="放量前会复跑门控：质量不低于稳定臂、关键用例通过率不下降、成本不劣化 >10%；未通过则拒绝放量。" @confirm="promote('B')">
              <Button size="small" theme="primary" :disabled="rollout.gates.some((g) => !g.pass)">放量候选臂</Button>
            </Popconfirm>
            <Button size="small" variant="outline" @click="promote('A')">切回稳定臂</Button>
          </span>
        </div>
        <Table :data="armRows" :columns="armColumns" row-key="id" size="small" :pagination="{ pageSize: 4, total: armRows.length }">
          <template #arm="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <Tag :theme="row.arm.includes('Arm B') ? 'warning' : 'default'" size="small" variant="light-outline">{{ row.arm }}</Tag>
              <span class="oc-mono oc-muted" style="font-size: 12px">{{ row.version }}</span>
            </div>
          </template>
          <template #traffic="{ row }">
            <div class="oc-stack" style="gap: 2px; font-size: 12px">
              <span>{{ row.traffic }}</span>
              <span class="oc-muted">{{ row.sample }} 样本</span>
            </div>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">
            <span>门控阈值（未通过不允许放量）</span>
            <Tooltip content="门控与评测集（卷 26）绑定：评测 + 在线指标双门槛">
              <span class="oc-muted" style="font-size: 12px">双门槛</span>
            </Tooltip>
          </div>
          <Table :data="rollout.gates" row-key="metric" size="small" :pagination="{ pageSize: 6, total: rollout.gates.length }" :columns="gateColumns">
            <template #threshold="{ row }">{{ row.threshold }}</template>
            <template #current="{ row }">
              <span>{{ row.current }}</span>
              <Progress :percentage="Math.min(100, Math.round((row.current / Math.max(1e-9, row.threshold)) * 100))" :status="row.pass ? 'success' : 'warning'" size="small" :style="{ width: '70px', marginLeft: '6px' }" />
            </template>
            <template #verdict="{ row }">
              <Tag :theme="row.pass ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.pass ? '通过' : '未通过' }}</Tag>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">
            <span>分桶复现（同 key 同桶）</span>
            <span class="oc-flex" style="gap: 6px">
              <span class="oc-muted" style="font-size: 12px">salt</span>
              <Input v-model="recalcSalt" size="small" style="width: 170px" />
            </span>
          </div>
          <Table :data="buckets" row-key="key" size="small" :pagination="{ pageSize: 6, total: buckets.length }" :columns="bucketColumns">
            <template #arm="{ row }">
              <Tag :theme="row.arm === 'B' ? 'warning' : 'default'" size="small" variant="light-outline">Arm {{ row.arm }}</Tag>
            </template>
            <template #same="{ row }">
              <Tag :theme="row.same ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.same ? '一致（可复现）' : '不一致（salt 已变更）' }}</Tag>
            </template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            更改 salt 会重新分桶：这正是「灰度期间不得改 salt」的原因；实验报告中会记录 salt 以保证可复现。
          </div>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>自动回滚历史</span>
          <span class="oc-muted" style="font-size: 12px">回滚动作全部留痕（含触发指标与动作清单）</span>
        </div>
        <Timeline v-if="rollout.rollbackHistory.length">
          <TimelineItem v-for="h in rollout.rollbackHistory" :key="h.at" :label="new Date(h.at).toLocaleString('zh-CN')">
            <div class="oc-stack" style="gap: 2px; font-size: 13px">
              <span>
                <Tag theme="danger" size="small" variant="light-outline">自动回滚</Tag>
                {{ h.fromArm }} → {{ h.toArm }}（触发指标：{{ METRIC_LABEL[h.triggerMetric as keyof GrayMetrics] ?? h.triggerMetric }}）
              </span>
              <span>{{ h.reason }}</span>
              <span class="oc-flex oc-flex--wrap" style="gap: 4px">
                <Tag v-for="a in h.actions" :key="a" size="small" variant="outline">{{ a }}</Tag>
              </span>
            </div>
          </TimelineItem>
        </Timeline>
        <div v-else class="oc-muted" style="font-size: 13px">该实验尚无回滚记录（门控全部通过或实验刚开始）。</div>
      </div>
    </StateShell>
  </div>
</template>
