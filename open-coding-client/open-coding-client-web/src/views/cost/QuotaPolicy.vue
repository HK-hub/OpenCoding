<script setup lang="ts">
/**
 * 配额与预算策略（G4-04）：7 维静态基线、预测式临时额度（≤30%）、团队内再分配、超额申请与小额自动批、
 * 异常熔断（相对基线 ×3 暂停自治任务，不影响人工会话）与降级偏好、50/80/100% 阈值动作映射。溯源：卷 31 §4.4。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Progress, RadioButton, RadioGroup, Slider, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const tempPct = ref(20);
const reallocate = ref(true);
const degradePref = ref<'strict' | 'balanced' | 'cheap'>('balanced');

/** 7 维静态基线：used/base 为确定性演示值（含 1 条接近熔断） */
const baselines = [
  { dim: '并发会话', base: 20, used: 13, unit: '个' },
  { dim: '并发任务', base: 8, used: 6, unit: '个' },
  { dim: 'token（日）', base: 5_000_000, used: 3_120_000, unit: 'token' },
  { dim: '成本（日）', base: 120, used: 98.4, unit: 'USD' },
  { dim: '存储', base: 500, used: 214, unit: 'GB' },
  { dim: '工具调用（时）', base: 2_000, used: 1_460, unit: '次' },
  { dim: '外部任务', base: 12, used: 2, unit: '个' },
];
const breakers = computed(() => baselines.map((b) => ({ ...b, ratio: Number((b.used / b.base).toFixed(2)) })));
const tripped = computed(() => breakers.value.filter((b) => b.ratio >= 3));

const THRESHOLDS = [
  { pct: 50, action: '通知：桌面 + IM（成本预警模板「本周 82%」）', tone: 'default' as const },
  { pct: 80, action: '降级到低价模型：路由切到经济档，质量下降在会话流标注', tone: 'warning' as const },
  { pct: 100, action: '暂停自治任务：等待人工确认或提额，人工会话不受影响', tone: 'danger' as const },
];

const columns = [
  { colKey: 'dim', title: '维度', width: 150 },
  { colKey: 'base', title: '静态基线', width: 150 },
  { colKey: 'used', title: '当前使用', width: 150 },
  { colKey: 'usage', title: '使用率（熔断线 ×3）', width: 260 },
  { colKey: 'state', title: '状态', width: 160 },
];

function applyTemp() {
  MessagePlugin.success(`已提交临时额度申请：+${tempPct}%（上限 30%），小额自动批）；有效期至本周期结束，到期自动回收`);
  ui.track('cost.quota.temp-applied', { pct: tempPct.value });
}

function applyOver() {
  MessagePlugin.info('超额申请已提交：先尝试团队内再分配，失败则走审批（附带用量证据与回收计划）');
}

onMounted(() => {
  window.setTimeout(() => { state.value = baselines.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="配额与预算策略" volume="卷 31" manifest="G4-04"
      desc="静态基线 + 预测式临时额度 + 团队内再分配 + 异常熔断（×3）+ 降级偏好；熔断只暂停自治任务，不影响人工会话。"
      cli="oc quota policy --baseline --temp +20% --degrade balanced --thresholds 50,80,100"
      :status="[{ label: `临时额度 ≤30%`, theme: 'primary' }, { label: tripped.length ? `熔断 ${tripped.length} 维` : '未熔断', theme: tripped.length ? 'danger' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">刷新用量</Button>
        <Popconfirm content="小额自动批：申请额度 ≤10% 时自动批准；>10% 需人工审批。临时额度到期自动回收，回收前会通知。" theme="warning" @confirm="applyTemp">
          <Button size="small" theme="primary">一键申请临时额度</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state" trace-id="trace-quota-6b30" :page-size="7"
      empty-title="配额未初始化" empty-desc="组织未下发配额基线（新租户默认无限制），此时所有维度按「不受限」处理。"
      empty-action="应用默认基线" example-task="把临时额度调到 10% 并提交，观察「小额自动批」的即时结果"
      what="配额基线加载失败" why="用量聚合读取失败（跨维度账本未对齐）"
      how="可重试；失败时按基线收紧（fail-safe），不会放宽任何维度"
      collapsed-summary="维度超过单页阈值，低频维度（外部任务/存储）保持折叠视图。"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已应用默认基线（演示）')"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="最高使用率维度" :value="Math.max(...breakers.map((b) => Math.round(b.ratio * 100)))" format="percent" icon="chart" :target="80" target-kind="max" />
        <StatCard label="熔断面（×3）" :value="tripped.length" unit="维" icon="error" :lower-is-better="true" hint="相对基线 ×3 触发暂停自治任务" />
        <StatCard label="临时额度上限" :value="30" format="percent" icon="add" hint="预测式额度：不超过静态基线 30%" />
        <StatCard label="再分配" :value="reallocate ? '已开启' : '已关闭'" format="raw" icon="share" hint="团队内按空闲配额动态回收" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">七维静态基线（含熔断线）</div>
        <Table :data="breakers" row-key="dim" size="small" :columns="columns" :pagination="undefined">
          <template #base="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.base.toLocaleString('zh-CN') }} {{ row.unit }}</span></template>
          <template #used="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.used.toLocaleString('zh-CN') }} {{ row.unit }}</span></template>
          <template #usage="{ row }">
            <div class="oc-flex" style="gap: 6px; align-items: center">
              <Progress :percentage="Math.min(100, Math.round((row.used / (row.base * 3)) * 100))" :status="row.ratio >= 3 ? 'error' : row.ratio >= 1 ? 'warning' : 'success'" :label="false" size="small" style="width: 120px" />
              <span class="oc-muted" style="font-size: 11px">{{ row.ratio }} × 基线</span>
            </div>
          </template>
          <template #state="{ row }">
            <Tag size="small" :theme="row.ratio >= 3 ? 'danger' : row.ratio >= 1 ? 'warning' : 'success'" variant="light-outline">
              {{ row.ratio >= 3 ? '已熔断' : row.ratio >= 1 ? '超基线（临时额度内）' : '正常' }}
            </Tag>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">临时额度与再分配</div>
          <div class="oc-flex" style="gap: 10px; align-items: center">
            <span style="font-size: 12px">预测式临时额度</span>
            <Slider v-model="tempPct" :min="0" :max="30" :step="5" style="width: 200px" />
            <span class="oc-mono" style="font-size: 12px">+{{ tempPct }}%（≤30%）</span>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">基于近 7 日用量斜率预测本周缺口；超过 30% 一律转人工审批（防「先花后批」）。</div>
          <div class="oc-flex" style="gap: 8px; align-items: center; margin-top: 10px">
            <Switch v-model="reallocate" size="small" />
            <span style="font-size: 13px">团队内再分配</span>
            <Tag size="small" variant="outline">闲置成员配额动态回收，成员硬上限不变</Tag>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 10px">
            <Button size="small" variant="outline" @click="applyOver">超额申请</Button>
            <span class="oc-muted" style="font-size: 12px">小额自动批（≤10%）；大额附用量证据走审批。</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">降级偏好（三选一，默认「平衡」）</div>
          <RadioGroup v-model="degradePref">
            <RadioButton value="strict">拒绝：超限直接拒绝新任务</RadioButton>
            <RadioButton value="balanced">平衡：先排队，超时降到低价模型</RadioButton>
            <RadioButton value="cheap">直接降级到低价模型</RadioButton>
          </RadioGroup>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            影响：降级绝不静默 —— 每次降级在会话流与账本中显式标注；质量敏感任务可声明「不接受降级」并转为排队。
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 8px; align-items: center">
            <OcIcon name="flag" size="13px" />
            <span style="font-size: 12px">熔断（×3）只暂停自治任务与子 Agent；人工会话继续可用，提示降级原因。</span>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">预算阈值 → 动作映射</div>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="t in THRESHOLDS" :key="t.pct" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <Tag size="small" :theme="t.tone" variant="light-outline">{{ t.pct }}%</Tag>
              <span style="font-size: 12px">{{ t.action }}</span>
            </div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">动作按阈值递进且可叠加；恢复需人工确认（自动恢复被禁止）。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">策略口径</div>
          <InfoGrid :columns="1" :items="[
            { key: 'base', label: '基线', value: '静态基线是硬上限；临时额度与再分配只调整弹性部分' },
            { key: 'human', label: '人工会话', value: '熔断不影响人工会话与只读导出（保底可用）' },
            { key: 'audit', label: '留痕', value: '提额/回收/熔断恢复全部写入审计事件' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <CliHint command="oc quota policy --temp +20% --degrade balanced --dry-run" />
            <CopyableId id="trace-quota-6b30" label="复制 traceId" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
