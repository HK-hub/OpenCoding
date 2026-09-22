<script setup lang="ts">
/**
 * 增强预算与熔断（N3-14）：单次 / 日预算（可编辑）+ 当前花费与剩余 + 熔断事件 + 分级路由 + 降级阶梯。
 * 溯源：卷 35 §5.7 预算与熔断；BUILD-MANIFEST N3-14。
 * 契约：成本可见；超预算中断运行并保留已产出部分（发 ai.budget.exhausted）；降级必须显式可见，不静默。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, InputNumber, MessagePlugin, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { intelData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 熔断事件名（契约常量，非配置） */
const BUDGET_EXHAUSTED = 'ai.budget.exhausted';

const runBudget = ref(intelData.budgetPanel.runUsd);
const dailyBudget = ref(intelData.budgetPanel.dailyUsd);
const spentToday = ref(intelData.budgetPanel.spentTodayUsd);
const saved = ref(false);
const todayPct = computed(() => Math.min(100, (spentToday.value / dailyBudget.value) * 100));

/** 熔断事件（负样本）：超预算中断 + 已产出保留说明，保留部分不重复计费 */
const circuitEvents = [
  { id: 'ce-01', at: '2026-09-18T14:22:08Z', capability: 'code.migrate（迁移助手）', spentUsd: 2.0, kept: '批次 1–2 已完成产物保留；批次 3 在安全点中断，可从断点续跑（不重复计费已完成批次）' },
  { id: 'ce-02', at: '2026-09-12T09:41:33Z', capability: 'test.gen（测试生成）', spentUsd: 1.86, kept: '已生成用例草稿保留但未运行验证 → 不产出测试 PR（未过门禁不得输出）' },
  { id: 'ce-03', at: '2026-09-04T20:05:12Z', capability: 'review.bot（审查机器人）', spentUsd: 2.0, kept: '已产出的发现列表与 SARIF 保留；未扫描的 diff 范围显式标注（不静默截断）' },
];

/** 分级路由三档：默认 efficient（节省），均衡 / 完整按能力显式声明 */
const TIERS = intelData.budgetPanel.tiers.map((t) => ({
  ...t,
  cn: t.tier === 'efficient' ? '节省' : t.tier === 'balanced' ? '均衡' : '完整',
}));
/** 修复能力降级阶梯（完整修复 → 只给建议 → 只报告） */
const REPAIR_LADDER = [
  { step: 1, label: '完整修复', behavior: '生成修复 diff + 运行验证 + 提交 PR（仅高置信低风险）', trigger: '预算充足且置信度高' },
  { step: 2, label: '只给建议', behavior: '不自动修改代码，输出修复建议清单 + 引用依据', trigger: '单次预算达 70% 或连续 2 次修复失败' },
  { step: 3, label: '只报告', behavior: '仅报告问题与影响面，不给出可执行动作（人工处置）', trigger: '单次预算耗尽或当日达 100% 预算（熔断）' },
];

function saveBudget() {
  saved.value = true;
  MessagePlugin.success(`已保存预算：单次 $${runBudget.value.toFixed(2)} / 日 $${dailyBudget.value.toFixed(2)}（下一运行周期生效，变更写入审计）`);
}
function showLadder() {
  MessagePlugin.info('降级阶梯：完整修复 → 只给建议 → 只报告；每次降级在运行记录与界面显式标注原因，不静默。');
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="增强预算与熔断"
      desc="单次运行与日预算可编辑；超预算中断运行但保留已产出部分；分级路由默认 efficient，降级阶梯显式可见。"
      volume="卷 35" manifest="N3-14" cli="oc ai budget show --with-circuit-events"
      :status="[{ label: `熔断 ${intelData.budgetPanel.circuit === 'closed' ? '未触发' : '已触发'}`, theme: intelData.budgetPanel.circuit === 'closed' ? 'success' : 'danger' }, { label: `日水位 ${todayPct.toFixed(0)}%`, theme: todayPct >= 80 ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="showLadder">降级阶梯说明</Button>
        <Button size="small" theme="primary" @click="saveBudget">保存预算</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取预算水位与熔断事件…"
      empty-title="没有预算配置" empty-desc="未配置预算时能力按只读 / 报告类默认放行；配置后可编辑单次与日预算。"
      empty-action="创建预算配置" example-task="把单次预算改为 $2.0 并保存，确认下一运行周期生效"
      what="预算数据加载失败" why="计量上报通道不可达（成本与熔断事件在观测存储中）"
      how="重试；计量失败按有意吞异常 + WARN 处理，不影响运行主链路"
      :collapsed-summary="`熔断事件 ${circuitEvents.length} 条（含 1 条当日 100% 熔断），列表已折叠展示（边界数据态）。`" :page-size="circuitEvents.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="单次运行预算" :value="runBudget" format="cost" unit="USD" icon="discount" :target="2" target-kind="max" hint="默认 $2.0；含模型 + 工具调用" />
        <StatCard label="日预算" :value="dailyBudget" format="cost" unit="USD" icon="calendar" :target="50" target-kind="max" hint="默认 $50.0；跨能力共享" />
        <StatCard label="今日已花" :value="spentToday" format="cost" unit="USD" icon="chart" :target="dailyBudget" target-kind="max" :delta="12.4" :lower-is-better="true" :hint="`剩余 $${Math.max(0, dailyBudget - spentToday).toFixed(2)}；达 80% 排队 / 100% 熔断`" />
        <StatCard label="熔断事件" :value="circuitEvents.length" unit="次" icon="error" :lower-is-better="true" hint="超预算中断均留痕，已产出部分保留" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">预算编辑（可编辑 + 保存）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
            <span style="font-size: 12px">单次运行 $</span>
            <InputNumber v-model="runBudget" :min="0.1" :max="20" :step="0.1" size="small" theme="normal" style="width: 110px" aria-label="单次运行预算" />
            <span style="font-size: 12px">日预算 $</span>
            <InputNumber v-model="dailyBudget" :min="1" :max="500" :step="1" size="small" theme="normal" style="width: 110px" aria-label="日预算" />
            <Button size="small" variant="outline" @click="saveBudget">保存</Button>
            <Tag v-if="saved" size="small" theme="success" variant="light-outline">已保存（下一周期生效）</Tag>
          </div>
          <div style="margin-top: 10px">
            <div class="oc-flex--between" style="font-size: 12px; margin-bottom: 4px">
              <span>今日水位 ${{ spentToday.toFixed(2) }} / ${{ dailyBudget.toFixed(2) }}</span>
              <span>剩余 ${{ Math.max(0, dailyBudget - spentToday).toFixed(2) }}</span>
            </div>
            <Progress :percentage="Number(todayPct.toFixed(1))" :status="todayPct >= 80 ? 'error' : 'active'" />
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">{{ intelData.budgetPanel.circuitReason }}</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">分级路由档位（默认 efficient）<CliHint command="oc ai route tiers --default efficient" /></div>
          <Table :data="TIERS" row-key="tier" size="small" :pagination="undefined" :columns="[
            { colKey: 'cn', title: '档位', width: 90, cell: 'cn' },
            { colKey: 'model', title: '模型', width: 170 },
            { colKey: 'useFor', title: '适用', ellipsis: true },
            { colKey: 'share', title: '占比', width: 80, cell: 'share' },
          ]">
            <template #cn="{ row }">
              <Tag size="small" :theme="row.tier === 'efficient' ? 'success' : row.tier === 'balanced' ? 'primary' : 'warning'" variant="light-outline">{{ row.cn }}</Tag>
              <Tag v-if="row.tier === 'efficient'" size="small" variant="outline" style="margin-left: 4px">默认</Tag>
            </template>
            <template #share="{ row }">{{ (row.share * 100).toFixed(0) }}%</template>
          </Table>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">熔断事件（{{ BUDGET_EXHAUSTED }}）</div>
        <Table :data="circuitEvents" row-key="id" size="small" :pagination="undefined" :columns="[
          { colKey: 'at', title: '时间', width: 180, cell: 'at' },
          { colKey: 'capability', title: '能力', width: 220 },
          { colKey: 'spentUsd', title: '已花', width: 90, cell: 'spent' },
          { colKey: 'kept', title: '已产出保留说明', ellipsis: true },
        ]">
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #spent="{ row }">${{ row.spentUsd.toFixed(2) }}</template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">降级阶梯：完整修复 → 只给建议 → 只报告</div>
        <div class="oc-grid oc-grid--3">
          <div v-for="s in REPAIR_LADDER" :key="s.step" class="oc-card" style="padding: 10px">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" :theme="s.step === 1 ? 'success' : s.step === 2 ? 'warning' : 'danger'" variant="light-outline">第 {{ s.step }} 档</Tag>
              <span style="font-size: 13px; font-weight: 600">{{ s.label }}</span>
            </div>
            <div class="oc-muted" style="font-size: 12px; margin-top: 4px">{{ s.behavior }}</div>
            <div class="oc-muted" style="font-size: 12px">触发：{{ s.trigger }}</div>
          </div>
        </div>
        <InfoGrid :columns="2" style="margin-top: 10px" :items="intelData.budgetPanel.degradeLadder.map((d) => ({ key: String(d.step), label: `预算触发 ${d.condition}`, value: d.behavior }))" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <Tag size="small" theme="warning" variant="light-outline">降级必显式：界面标注档位与原因，不静默</Tag>
          <CopyableId id="trace-intel-budget-7c19" label="预算 traceId" short="12" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
