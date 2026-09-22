<script setup lang="ts">
/**
 * 技能评测门禁（K-07）：用例列表 + 一键跑 + 通过率/成本/时长 + 门槛达标。
 * 溯源：卷 08 D-SKILL-7；发布到私仓/市场要求评测记录（门禁不达标即拦截）。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Popconfirm, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import StateShell from '@/components/common/StateShell.vue';
import { extensionData, type SkillEvalCase } from '@/mock/data/extension';
import { fmtMs } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const skills = extensionData.skills;
const picked = ref(String(route.query.name ?? 'acme.finance.reconcile-report'));
const skill = computed(() => skills.find((s) => s.name === picked.value) ?? skills[0]);
const options = skills.map((s) => ({ label: `${s.name}@${s.version}`, value: s.name }));

const cases = ref<SkillEvalCase[]>([]);
const running = ref(false);
const progress = ref(0);
const runAt = ref<string | null>(null);

function reset() {
  cases.value = skill.value.eval.cases.map((c) => ({ ...c }));
  progress.value = 0;
}
reset();

const state = ref<'LOADING' | 'NORMAL'>('LOADING');
window.setTimeout(() => (state.value = 'NORMAL'), 220);

const summary = computed(() => {
  const total = cases.value.length;
  const passed = cases.value.filter((c) => c.status === 'passed').length;
  const failed = cases.value.filter((c) => c.status === 'failed').length;
  const skipped = cases.value.filter((c) => c.status === 'skipped' || c.status === 'not-run').length;
  return {
    total, passed, failed, skipped,
    passRate: total ? Number(((passed / total) * 100).toFixed(1)) : 0,
    cost: cases.value.reduce((a, c) => a + c.cost, 0),
    durationMs: cases.value.reduce((a, c) => a + c.durationMs, 0),
  };
});

const gateMet = computed(() => summary.value.passRate / 100 >= skill.value.eval.gate.threshold);

/** 门禁结论文案（三段式：事实 + 原因 + 动作） */
const gateDesc = computed(() => {
  const threshold = (skill.value.eval.gate.threshold * 100).toFixed(0);
  return gateMet.value
    ? `通过率 ${summary.value.passRate}% ≥ 门槛 ${threshold}%；发布制品将携带评测记录与制品哈希。`
    : `通过率 ${summary.value.passRate}% < 门槛 ${threshold}%；失败用例需修复后重跑，本地使用会显式标注劣化。`;
});

let evalTimer: number | null = null;

/** 一键跑：逐用例执行（本地模拟），失败用例保留失败态用于演示劣化 */
function runAll() {
  reset();
  running.value = true;
  let i = 0;
  evalTimer = window.setInterval(() => {
    if (i >= cases.value.length) {
      if (evalTimer !== null) window.clearInterval(evalTimer);
      evalTimer = null;
      running.value = false;
      runAt.value = new Date().toISOString();
      MessagePlugin[gateMet.value ? 'success' : 'warning'](
        gateMet.value
          ? `评测完成：通过率 ${summary.value.passRate}% 达到门槛，可发布`
          : `评测完成：通过率 ${summary.value.passRate}% 低于门槛 ${(skill.value.eval.gate.threshold * 100).toFixed(0)}%，发布将被门禁拦截`,
      );
      return;
    }
    const status: SkillEvalCase['status'] = skill.value.degraded && i === 0 ? 'failed' : i === cases.value.length - 1 ? 'skipped' : 'passed';
    cases.value[i] = { ...cases.value[i], status, lastRun: new Date().toISOString() };
    i += 1;
    progress.value = Math.round((i / cases.value.length) * 100);
  }, 260);
}

/** 取消：安全点停止 —— 已完成用例结果保留，剩余用例保持 not-run，门禁按已完成结果判定 */
function cancelRun() {
  if (!running.value) {
    MessagePlugin.warning('当前没有运行中的评测；「取消」仅在评测运行中可用（安全点停止并保留已完成结果）');
    return;
  }
  if (evalTimer !== null) {
    window.clearInterval(evalTimer);
    evalTimer = null;
  }
  running.value = false;
  runAt.value = new Date().toISOString();
  const done = summary.value.total - summary.value.skipped;
  MessagePlugin.success(`已在安全点停止：保留已完成 ${done}/${summary.value.total} 例结果（未运行用例保持 not-run），本次已产生成本 $${summary.value.cost.toFixed(4)}，门禁按已完成结果判定`);
}

const columns = [
  { colKey: 'name', title: '用例', width: 230 },
  { colKey: 'expect', title: '期望行为', width: 320 },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'cost', title: '成本 / 耗时', width: 170 },
  { colKey: 'lastRun', title: '最近运行', width: 170 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="技能评测门禁"
      desc="技能自带用例可在本地离线运行；发布到私仓/市场要求评测记录（通过率、成本、时长）达标。"
      volume="卷 08" manifest="K-07" :cli="skill.eval.entry"
      :status="[{ label: gateMet ? '门禁达标' : '门禁未达标', theme: gateMet ? 'success' : 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push({ path: '/extension/skills/detail', query: { name: skill.name } })">技能详情</Button>
        <Button size="small" theme="primary" :loading="running" @click="runAll">
          {{ running ? `运行中 ${progress}%` : '一键跑用例' }}
        </Button>
      </template>
    </PageHeader>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Select v-model="picked" size="small" filterable :options="options" style="width: 360px" @change="reset" />
        <Tag size="small" variant="outline">门槛：通过率 ≥ {{ (skill.eval.gate.threshold * 100).toFixed(0) }}%</Tag>
        <Tag v-if="skill.degraded" size="small" theme="warning" variant="light-outline">该技能已劣化（成功率低于基线）</Tag>
        <span class="oc-grow" />
        <span class="oc-muted" style="font-size: 12px">
          基线：通过率 {{ skill.eval.baselineMetrics.passRate }}% · 成本 ${{ skill.eval.baselineMetrics.costPerRun }} · 样本 {{ skill.eval.baselineMetrics.sampleRuns }} 次
        </span>
      </div>
    </div>

    <div class="oc-grid oc-grid--4">
      <StatCard label="通过率" :value="summary.passRate" format="percent" :target="skill.eval.gate.threshold * 100" target-kind="min" :trend="skill.stats.trend" />
      <StatCard label="用例总数（通过/失败/跳过）" :value="`${summary.total}`" :unit="`${summary.passed}/${summary.failed}/${summary.skipped}`" format="raw" icon="task-checked" />
      <StatCard label="本次成本" :value="summary.cost" format="cost" :target="skill.eval.baselineMetrics.costPerRun * 1.1" target-kind="max" />
      <StatCard label="本次时长" :value="summary.durationMs" unit="ms" :target="skill.eval.baselineMetrics.durationMs" target-kind="max" />
    </div>

    <Alert
      :theme="gateMet ? 'success' : 'error'"
      :message="gateMet ? '门禁达标，可发布到组织私仓' : '门禁未达标，发布被拦截'"
      :description="gateDesc"
    />
    <div v-if="running" class="oc-card">
      <div class="oc-flex" style="gap: 10px">
        <Progress :percentage="progress" theme="line" style="flex: 1" />
        <Popconfirm
          content="取消本次评测（安全点停止）：当前用例执行到安全点后停止，已完成用例结果保留（不回滚）；剩余用例标记 not-run，门禁按已完成结果判定，可随后重新一键跑。"
          @confirm="cancelRun"
        >
          <Button size="small" variant="text">取消（安全点停止，保留已完成用例结果）</Button>
        </Popconfirm>
      </div>
    </div>

    <StateShell :state="state" empty-title="该技能未携带用例" empty-desc="发布到市场的技能必须提供 tests/ 用例目录。" empty-action="打开创作器">
      <Table row-key="id" size="small" :data="cases" :columns="columns">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span>{{ row.name }}</span>
            <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.input }}</span>
          </div>
        </template>
        <template #status="{ row }">
          <Tag size="small" :theme="row.status === 'passed' ? 'success' : row.status === 'failed' ? 'danger' : 'default'" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #cost="{ row }"><span class="oc-mono" style="font-size: 12px">${{ row.cost.toFixed(4) }} · {{ fmtMs(row.durationMs) }}</span></template>
        <template #lastRun="{ row }">
          <span class="oc-muted" style="font-size: 12px">{{ row.lastRun ? new Date(row.lastRun).toLocaleTimeString('zh-CN') : '—' }}</span>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">最近 10 次通过的用例数</h3>
        <OcChart
          type="bar"
          :series="[{ name: '通过用例数', points: skill.stats.trend.map((v, i) => ({ x: `#${i + 1}`, y: Math.round((v / 100) * (cases.length || 5)) })) }]"
          :height="180"
          aria-label="最近十次评测通过用例数"
        />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">门禁说明</h3>
        <div class="oc-kv">
          <span class="oc-kv__k">离线可运行</span><span>是（用例不依赖外部网络；需要模型时使用固定快照）</span>
          <span class="oc-kv__k">失败判定</span><span>期望行为不符 / 出现未授权工具调用 / 超时</span>
          <span class="oc-kv__k">门禁位置</span><span>发布前（SkillPublisherSPI）+ 升级前（兼容校验）</span>
          <span class="oc-kv__k">显式标注</span><span>未达标技能在使用统计页标注「劣化 → 建议」，不静默沿用</span>
        </div>
        <Tooltip content="评测记录会随制品一起入库，可离线复现">
          <Tag size="small" variant="outline" style="margin-top: 8px">评测记录：eval-report.json + 制品哈希</Tag>
        </Tooltip>
      </div>
    </div>
  </div>
</template>
