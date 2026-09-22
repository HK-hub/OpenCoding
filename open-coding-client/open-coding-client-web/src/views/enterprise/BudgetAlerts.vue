<script setup lang="ts">
/**
 * 预算与告警（N-07）：50/80/100% 阈值动作 + 燃尽曲线 + 超支说明。
 * 溯源：卷 24 D-ENT-6 / 卷 31 §4.7
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, InputNumber, MessagePlugin, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import { downloadText } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { Budget } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 预算明细用 ref 渲染：调整预算后表格、统计卡与燃尽曲线即时刷新（同时写回领域数据） */
const budgetRows = ref(d.budgets);
const breached = computed(() => budgetRows.value.filter((b) => b.status === 'BREACHED' || b.status === 'CRITICAL'));
/** 燃尽曲线：按日累计花费 vs 预算均线 */
const burn = computed(() => {
  const b = budgetRows.value[0];
  const days = 20;
  const per = b.spentUsd / days;
  const line = Array.from({ length: days }, (_, i) => ({ x: `${i + 1}日`, y: Math.round(per * (i + 1)) }));
  const ideal = Array.from({ length: days }, (_, i) => ({ x: `${i + 1}日`, y: Math.round((b.amountUsd / 30) * (i + 1)) }));
  return { line, ideal };
});
const actionTheme: Record<string, 'default' | 'primary' | 'warning' | 'danger'> = { 通知: 'default', '降级到低价模型': 'warning', '暂停自治任务': 'danger' };
/** 超支说明草案：按预算条目记录已生成的草案文本 */
const draftMap = ref<Record<string, string>>({});
const adjustOpen = ref(false);
const adjustForm = ref({ id: d.budgets[0].id, amount: d.budgets[0].amountUsd });

/** 生成超支说明草案：按超支/临界预算逐条生成说明并落盘下载 */
function genDraft() {
  if (!breached.value.length) {
    MessagePlugin.warning('当前没有超支或临界预算，无需生成超支说明草案');
    return;
  }
  const draftOf = (b: Budget) =>
    `${b.scope}：预算 $${b.amountUsd.toLocaleString('zh-CN')}/${b.period}，已花费 $${b.spentUsd.toLocaleString('zh-CN')}（${Math.round((b.spentUsd / b.amountUsd) * 100)}%），预测月末 $${b.forecastUsd.toLocaleString('zh-CN')}，已触发 ${b.thresholds.filter((t) => t.fired).map((t) => `${t.pct}% ${t.action}`).join(' / ') || '—'}，责任人 ${b.owner}。`;
  const text = [
    `# 超支说明草案（${new Date().toLocaleString('zh-CN')}）`,
    '> 由「预算与告警」页按当前预算数据自动生成，待责任人确认后提交；减少质量换取成本下降不被接受。',
    ...breached.value.map((b) => `- ${draftOf(b)}`),
  ].join('\n');
  const file = downloadText(text, `overbudget-draft-${Date.now()}.md`);
  breached.value.forEach((b) => { draftMap.value[b.id] = draftOf(b); });
  MessagePlugin.success('已生成 ' + file + `（含 ${breached.value.length} 份超支说明草案）`);
}

/** 打开调整预算弹窗，默认带出第一条预算的当前金额 */
function openAdjust() {
  const first = budgetRows.value[0];
  adjustForm.value = { id: first.id, amount: first.amountUsd };
  adjustOpen.value = true;
}

/** 切换调整对象时带出其当前预算金额，避免误改他条 */
function onAdjustTarget(v: unknown) {
  const b = budgetRows.value.find((x) => x.id === String(v));
  if (b) adjustForm.value = { id: b.id, amount: b.amountUsd };
}

/** 调整预算：校验后即时重算水位状态与 50/80/100% 档位动作 */
function submitAdjust() {
  const b = budgetRows.value.find((x) => x.id === adjustForm.value.id);
  if (!b) {
    MessagePlugin.error('请选择要调整的预算条目');
    return;
  }
  const amount = Number(adjustForm.value.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    MessagePlugin.error('预算金额必须为大于 0 的数字');
    return;
  }
  if (amount < b.spentUsd) {
    MessagePlugin.error(`预算金额不得低于已花费 $${b.spentUsd.toLocaleString('zh-CN')}（否则将立即触发熔断）`);
    return;
  }
  const old = b.amountUsd;
  const ratio = b.spentUsd / amount;
  b.amountUsd = amount;
  b.forecastUsd = Math.round(b.burnRateUsdPerDay * 30);
  // 金额变化后重算水位状态与 80% 降级档位：低于临界即自动解除降级
  b.status = ratio >= 1 ? 'BREACHED' : ratio >= 0.8 ? 'CRITICAL' : ratio >= 0.5 ? 'WARNING' : 'NORMAL';
  b.thresholds[1].fired = ratio >= 0.8;
  MessagePlugin.success(`已将「${b.scope}」预算由 $${old.toLocaleString('zh-CN')} 调整为 $${amount.toLocaleString('zh-CN')}（水位 ${Math.round(ratio * 100)}%，状态 ${b.status}；可再次调整）`);
  adjustOpen.value = false;
}

onMounted(() => {
  setTimeout(() => { state.value = d.budgets.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="预算与告警"
      desc="按团队/项目分配预算；50% 通知、80% 降级到低价模型、100% 暂停自治任务（人工会话保留）；超支需提交说明。"
      volume="卷 24"
      manifest="N-07"
      cli="oc budget list --with-thresholds --forecast"
      :status="[{ label: '阈值动作分级', theme: 'warning' }, { label: '人工会话保留', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="genDraft">生成超支说明草案</Button>
        <Button size="small" theme="primary" @click="openAdjust">调整预算</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未设置预算"
      empty-desc="无预算将无法预警与熔断；建议先按团队设置月度预算并启用 80% 降级动作。"
      empty-action="创建预算"
      example-task="为平台工程组设置月度 $3,600 预算并开启三档阈值"
      what="预算列表加载失败"
      why="聚合任务滞后导致预算对比数据缺失（消费者滞后 > 60s）"
      how="可重试；预算熔断由实时计数驱动，不因展示滞后而失效"
      trace-id="trace-budget-3f81c0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="预算条目" :value="budgetRows.length" unit="条" :target="4" target-kind="min" icon="discount" />
        <StatCard label="预警（50%）" :value="budgetRows.filter((b) => b.thresholds[0].fired).length" unit="条" />
        <StatCard label="降级中（80%）" :value="budgetRows.filter((b) => b.thresholds[1].fired).length" unit="条" icon="sound" />
        <StatCard label="熔断（100%）" :value="budgetRows.filter((b) => b.thresholds[2].fired).length" unit="条" :target="0" target-kind="max" icon="error" hint="熔断自治任务，人工会话保留" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">燃尽曲线（组织预算 ${{ budgetRows[0].amountUsd.toLocaleString('zh-CN') }}）</div>
          <OcChart
            type="area"
            :series="[{ name: '实际累计', points: burn.line }, { name: '均线', points: burn.ideal, color: '#8e5ee5' }]"
            :height="200"
            format="cost"
            :threshold="{ value: 9600, label: '80% 降级线' }"
            unit="USD"
            aria-label="预算燃尽"
          />
          <div class="oc-muted" style="font-size: 12px">预测月末 $13,020（超出 8.5%）：建议提前降级轻任务路由或收紧默认档。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">阈值动作（三档）</div>
          <div class="oc-stack">
            <div v-for="t in d.budgets[0].thresholds" :key="t.pct" class="oc-flex--between">
              <span class="oc-flex" style="gap: 6px">
                <Tag size="small" :theme="t.fired ? 'danger' : 'default'" variant="light-outline">{{ t.pct }}%</Tag>
                <Tag size="small" :theme="actionTheme[t.action]" variant="outline">{{ t.action }}</Tag>
              </span>
              <span class="oc-muted">{{ t.fired ? '已触发' : '未触发' }}</span>
            </div>
          </div>
          <div class="oc-state__hint">
            反作弊：不允许通过降低质量达成成本下降；任何触及上下文/提示词/路由的变更须在同评测集验证成本不劣化 &gt; 10%。
          </div>
          <CopyableId id="trace-budget-7712" label="复制 traceId" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">预算明细</div>
        <Table :data="budgetRows" row-key="id" size="small">
          <template #scope="{ row }"><b style="font-size: 12px">{{ row.scope }}</b></template>
          <template #amountUsd="{ row }">
            <div style="min-width: 160px">
              <Progress :percentage="Math.min(100, Math.round((row.spentUsd / row.amountUsd) * 100))" :status="row.spentUsd >= row.amountUsd ? 'error' : row.spentUsd / row.amountUsd >= 0.8 ? 'warning' : 'success'" :label="false" size="small" />
              <span class="oc-muted" style="font-size: 11px">${{ row.spentUsd.toLocaleString('zh-CN') }} / ${{ row.amountUsd.toLocaleString('zh-CN') }}</span>
            </div>
          </template>
          <template #burnRateUsdPerDay="{ row }"><span class="oc-mono">${{ row.burnRateUsdPerDay }}/天</span></template>
          <template #forecastUsd="{ row }">
            <Tooltip :content="row.forecastUsd > row.amountUsd ? '预测超支：需提交超支说明（自动生成草案）' : '预测在预算内'">
              <span :class="row.forecastUsd > row.amountUsd ? 'oc-stat__delta--bad' : ''">${{ row.forecastUsd.toLocaleString('zh-CN') }}</span>
            </Tooltip>
          </template>
          <template #status="{ row }">
            <Tag size="small" :theme="row.status === 'BREACHED' ? 'danger' : row.status === 'CRITICAL' ? 'warning' : row.status === 'WARNING' ? 'primary' : 'success'" variant="light-outline">{{ row.status }}</Tag>
          </template>
        </Table>
        <div v-for="b in breached" :key="b.id" class="oc-state__hint">
          负样本 {{ b.scope }}：状态 {{ b.status }}，已触发 {{ b.thresholds.filter((t) => t.fired).length }} 档动作（{{ b.owner }}）；超支说明草案{{ draftMap[b.id] ? '已生成待确认' : '未生成' }}。
          <div v-if="draftMap[b.id]" class="oc-muted" style="font-size: 12px">草案内容：{{ draftMap[b.id] }}</div>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="adjustOpen" header="调整预算" width="520px" :confirm-btn="{ content: '确认调整', theme: 'primary' }" cancel-btn="取消" @confirm="submitAdjust">
      <div class="oc-stack">
        <Select :value="adjustForm.id" size="small" aria-label="选择预算条目" :options="budgetRows.map((b) => ({ label: `${b.scope}（当前 $${b.amountUsd.toLocaleString('zh-CN')}）`, value: b.id }))" @change="onAdjustTarget" />
        <InputNumber v-model="adjustForm.amount" :min="1" :step="100" size="small" theme="normal" style="width: 220px" aria-label="预算金额（USD）" />
        <div class="oc-muted" style="font-size: 12px">
          调整后立即按新水位重算 50/80/100% 三档动作；金额低于已花费将被拒绝（避免直接触发熔断），调整写审计。
        </div>
      </div>
    </Dialog>
  </div>
</template>
