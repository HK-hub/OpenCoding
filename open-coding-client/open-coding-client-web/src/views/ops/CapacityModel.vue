<script setup lang="ts">
/**
 * 容量模型与测算（G4-01）：系数表（U / T / E_r / S_e / K_r / O_r / F_c / N_file / C_chunk / D_vec 的含义、取值、来源、校准时间）
 * + 示例测算结果卡（日事件数 / 日字节 / 热存储 / 冷存储 / 索引规模）+ 并发与吞吐趋势 + 系数校准。
 * 溯源：卷 31 / BUILD-MANIFEST G4-01
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const c = enterpriseData.capacity;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 校准时间：初始取最近一次实测校准；点击「重新校准」后更新为本次时间 */
const calibratedAt = ref(new Date(c.calibration[0].at).toLocaleString('zh-CN'));
const recalibrated = ref(false);

const columns = [
  { colKey: 'symbol', title: '系数', width: 88 },
  { colKey: 'meaning', title: '含义', width: 200 },
  { colKey: 'value', title: '取值', width: 150 },
  { colKey: 'source', title: '来源', width: 220 },
  { colKey: 'calibratedAt', title: '校准时间' },
];

/** 系数表：符号与测算公式一一对应（与 derived[].formula 常量项一致） */
const coefficients = computed(() => [
  { symbol: 'U', meaning: '用户数（活跃口径）', value: c.users.toLocaleString('zh-CN'), source: '许可席位与月度活跃交集', calibratedAt: new Date(c.calibration[1].at).toLocaleDateString('zh-CN') },
  { symbol: 'T', meaning: '每用户每日任务数', value: `${c.tasksPerUserPerDay} /天`, source: '生产统计（P50，剔除重试）', calibratedAt: new Date(c.calibration[1].at).toLocaleDateString('zh-CN') },
  { symbol: 'E_r', meaning: '每任务事件数', value: `${c.eventsPerTask} /任务`, source: '内核事件采样（含工具与检查点事件）', calibratedAt: new Date(c.calibration[1].at).toLocaleDateString('zh-CN') },
  { symbol: 'S_e', meaning: '单事件字节', value: `${c.eventBytes} B`, source: '事件 Schema 实测均值（含元数据）', calibratedAt: new Date(c.calibration[1].at).toLocaleDateString('zh-CN') },
  { symbol: 'K_r', meaning: '每任务检查点率', value: `${c.checkpointRateMb} MB`, source: '检查点与快照体积（压缩后）', calibratedAt: new Date(c.calibration[0].at).toLocaleDateString('zh-CN') },
  { symbol: 'O_r', meaning: '去重率', value: String(c.dedupeRatio), source: '内容寻址实测（设计值 0.35，当前偏低）', calibratedAt: new Date(c.calibration[2].at).toLocaleDateString('zh-CN') },
  { symbol: 'F_c', meaning: '峰值系数', value: `${c.peakFactor}×`, source: '压测（对齐演练「容量水位演练」）', calibratedAt: new Date(c.calibration[0].at).toLocaleDateString('zh-CN') },
  { symbol: 'N_file', meaning: '单仓文件数', value: '20,000', source: '代码仓抽样（P90 大仓）', calibratedAt: new Date(c.calibration[2].at).toLocaleDateString('zh-CN') },
  { symbol: 'C_chunk', meaning: '每文件分块数', value: '40（合计 80 万块）', source: '分块策略（按 2KB 窗口）', calibratedAt: new Date(c.calibration[2].at).toLocaleDateString('zh-CN') },
  { symbol: 'D_vec', meaning: '向量维度', value: '1024（≈4 KB/块）', source: '嵌入模型规格 + 源文本索引', calibratedAt: new Date(c.calibration[2].at).toLocaleDateString('zh-CN') },
]);

/** 示例测算结果（取自容量模型派生项，key 与 derived[].key 一致） */
const resultOf = (key: string) => c.derived.find((x) => x.key === key)?.value ?? '—';
const resultCards = computed(() => [
  { key: 'eventsPerDay', label: '日事件数', value: resultOf('eventsPerDay'), hint: c.derived.find((x) => x.key === 'eventsPerDay')?.note },
  { key: 'rawBytesPerDay', label: '日事件字节（原始）', value: resultOf('rawBytesPerDay'), hint: `单事件 ${c.eventBytes} B × 日事件数` },
  { key: 'hotOnline', label: '在线热存储（30 天）', value: resultOf('hotOnline'), hint: '含索引；分区滚动' },
  { key: 'coldBytesPerDay', label: '冷存储（压缩归档）', value: resultOf('coldBytesPerDay'), hint: '压缩比 0.23，冷存成本约 $38/月' },
  { key: 'indexPerRepo', label: '索引规模（单仓）', value: resultOf('indexPerRepo'), hint: 'N_file × C_chunk × (D_vec + 源文本)' },
]);
/** 并发与吞吐趋势：以「相对峰值（%）」对齐三条量纲不同的曲线 */
const series = computed(() => {
  const factor = recalibrated.value ? 1.02 : 1;
  const scale = (base: number[]) => base.map((v, i) => ({ x: `M${i + 1}`, y: Number((v * factor).toFixed(1)) }));
  return [
    { name: '活跃会话（相对峰值 %）', points: scale([42, 45, 48, 52, 58, 63, 67, 71, 76, 82, 88, 94]) },
    { name: '模型 QPS（相对峰值 %）', points: scale([38, 41, 45, 50, 55, 60, 64, 69, 73, 79, 85, 91]) },
    { name: '事件 EPS（相对峰值 %）', points: scale([50, 52, 55, 58, 62, 66, 70, 74, 78, 83, 88, 92]) },
  ];
});

/** 系数校准：重新计算派生值并更新时间（校准偏差 >20% 的项必须复核） */
function calibrate(): void {
  recalibrated.value = true;
  calibratedAt.value = new Date().toLocaleString('zh-CN');
  const worst = c.calibration.reduce((a, b) => (Math.abs(b.deviationPct) > Math.abs(a.deviationPct) ? b : a));
  MessagePlugin.success(`已重新校准：派生值按最新系数重算并更新时间；最大偏差项「${worst.scenario}」${worst.deviationPct}% 需复核`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = c.derived.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="容量模型与测算"
      desc="10 个系数（U / T / E_r / S_e / K_r / O_r / F_c / N_file / C_chunk / D_vec）+ 10k 用户示例测算 + 并发与吞吐趋势；系数偏差 >20% 必须复核。"
      volume="卷 31"
      manifest="G4-01"
      cli="oc capacity model --show-coefficients --calibrate"
      :status="[{ label: `最近校准 ${calibratedAt}`, theme: recalibrated ? 'primary' : 'default' }]"
    >
      <template #actions>
        <CliHint command="oc capacity recalc --json" label="复制测算命令" />
        <Button size="small" theme="primary" @click="calibrate">系数校准</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="容量模型未建立"
      empty-desc="没有系数模型时无法做容量规划与水位预判；请先补齐 U / T / E_r / S_e 四个基础系数。"
      empty-action="从默认模型初始化"
      example-task="按 10k 用户、每用户 50 任务/天 建立基线并校准并发峰值"
      what="容量测算失败"
      why="系数来源（生产统计与压测）数据缺失，端上不使用经验值兜底（避免规划失真）"
      how="可重试；请先补齐缺失系数的来源与校准时间再执行校准"
      trace-id="trace-capacity-6a31de"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard v-for="r in resultCards.slice(0, 4)" :key="r.key" :label="r.label" :value="r.value" format="raw" icon="database" :hint="r.hint" />
      </div>
      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <StatCard label="索引规模（单仓）" :value="resultOf('indexPerRepo')" format="raw" icon="layers" hint="大仓实测偏差 +27.1%：以实测值规划" />
        <StatCard label="并发活跃会话峰值" :value="resultOf('concurrentSessions')" format="raw" icon="user-circle" hint="对齐 NFR：集群 ≥500 并发" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">系数表（含义 / 取值 / 来源 / 校准时间）</div>
        <Table :data="coefficients" :columns="columns" row-key="symbol" size="small">
          <template #symbol="{ row }"><Tag size="small" theme="primary" variant="light-outline">{{ row.symbol }}</Tag></template>
          <template #value="{ row }"><span class="oc-mono">{{ row.value }}</span></template>
          <template #source="{ row }"><span class="oc-muted">{{ row.source }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">并发与吞吐趋势（相对峰值）</div>
          <OcChart type="line" :series="series" :height="220" format="percent" :threshold="{ value: 80, label: '扩容线 80%', kind: 'max' }" aria-label="并发与吞吐趋势" />
          <div class="oc-muted" style="font-size: 12px">
            三条曲线量纲不同（会话数 / QPS / EPS），统一以相对峰值呈现；越线即触发「规划扩容」并进入水位四级判定。
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">校准偏差记录</div>
          <Table :data="c.calibration" row-key="at" size="small" :columns="[{ colKey: 'scenario', title: '校准场景', width: 210 }, { colKey: 'predicted', title: '预测' }, { colKey: 'actual', title: '实测' }, { colKey: 'deviationPct', title: '偏差' }, { colKey: 'pass', title: '结论', width: 84 }]">
            <template #deviationPct="{ row }">
              <Tag size="small" :theme="Math.abs(row.deviationPct) > 20 ? 'danger' : 'success'" variant="outline">{{ row.deviationPct }}%</Tag>
            </template>
            <template #pass="{ row }">
              <Tag size="small" :theme="row.pass ? 'success' : 'danger'" variant="light-outline">{{ row.pass ? '通过' : '需复核' }}</Tag>
            </template>
          </Table>
          <div class="oc-state__hint">校准时间已更新为 {{ calibratedAt }}；偏差 >20% 的系数（当前：索引容量）必须重新取样，不得直接用于预算承诺。</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
