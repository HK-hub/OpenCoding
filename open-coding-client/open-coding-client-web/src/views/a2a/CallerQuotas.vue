<script setup lang="ts">
/**
 * 调用方配额（Q-10）：五类调用方认证矩阵 + 限流 + 拒绝计数。
 * 溯源：卷 23 §4.4 / §4.6
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, InputNumber, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { downloadCsv } from '@/utils/download';
import { enterpriseData, type A2ACallerType } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 配额矩阵局部投影：ref 包装后即可在就地修改领域数据的同时触发统计卡与图表刷新 */
const quotas = ref(d.a2a.callerQuotas);
const totalRejected = computed(() => quotas.value.reduce((a, c) => a + c.rejected24h, 0));
const budgetBars = computed(() => quotas.value.map((c) => ({ x: c.callerType, y: c.dailyBudgetUsd })));
const strictest = computed(() => quotas.value.find((c) => c.callerType === '不可信Agent')!);

/** 导出矩阵：按当前页面数据生成 CSV（含调整后的实时配额） */
function exportMatrix() {
  const rows: (string | number)[][] = [
    ['调用方类型', '认证方式', '默认权限', '并发', 'RPM', '日预算(USD)', '配额粒度', '24h拒绝', '执行说明'],
    ...quotas.value.map((q) => [q.callerType, q.auth, q.defaultPermission, q.concurrency, q.rpm, q.dailyBudgetUsd, q.quotaScope, q.rejected24h, q.enforceNote] as (string | number)[]),
  ];
  const file = downloadCsv(rows, 'caller-quota-matrix.csv');
  MessagePlugin.success('已生成 ' + file);
}

const quotaOpen = ref(false);
const quotaType = ref<A2ACallerType>(strictest.value.callerType);
const draftConcurrency = ref(strictest.value.concurrency);
const draftRpm = ref(strictest.value.rpm);
const draftBudget = ref(strictest.value.dailyBudgetUsd);

/** 切换调用方类型时以该行当前配额预填草稿 */
function syncDraft(t: A2ACallerType) {
  const row = quotas.value.find((q) => q.callerType === t);
  if (!row) return;
  draftConcurrency.value = row.concurrency;
  draftRpm.value = row.rpm;
  draftBudget.value = row.dailyBudgetUsd;
}

/** 打开调整弹窗：默认聚焦最严调用方（不可信 Agent），可切换其他类型 */
function openQuotaDialog() {
  syncDraft(quotaType.value);
  quotaOpen.value = true;
}

/** 应用配额调整：就地更新矩阵行，统计卡与预算图随之变化（可再次调整恢复） */
function applyQuota() {
  const row = quotas.value.find((q) => q.callerType === quotaType.value);
  if (!row) return;
  const before = { concurrency: row.concurrency, rpm: row.rpm, budget: row.dailyBudgetUsd };
  row.concurrency = Math.max(1, Math.round(Number(draftConcurrency.value) || 1));
  row.rpm = Math.max(1, Math.round(Number(draftRpm.value) || 1));
  row.dailyBudgetUsd = Math.max(0, Number(Number(draftBudget.value || 0).toFixed(2)));
  quotaOpen.value = false;
  MessagePlugin.success(
    `配额已调整：${row.callerType} 并发 ${before.concurrency}→${row.concurrency}、RPM ${before.rpm}→${row.rpm}、日预算 $${before.budget}→$${row.dailyBudgetUsd}；立即对新请求生效（超限返回 429 + Retry-After），可再次调整恢复`,
  );
}

onMounted(() => {
  setTimeout(() => { state.value = quotas.value.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="调用方配额"
      desc="按调用方维度的 RPM / 并发 / 日预算与默认权限；认证方式决定权限上限（不可信调用方默认最严）。"
      volume="卷 23"
      manifest="Q-10"
      cli="oc a2a quota list --by-caller --json"
      :status="[{ label: '超限返回 429 + Retry-After', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportMatrix">导出矩阵</Button>
        <Button size="small" theme="primary" @click="openQuotaDialog">调整配额</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="暂无调用方"
      empty-desc="尚未登记任何调用方；未认证请求一律拒绝（默认最严），不会进入排队。"
      empty-action="登记调用方"
      example-task="为 CI 流水线登记项目级 API Key 并设置并发 2 / 日预算 $50"
      what="调用方配额加载失败"
      why="配额服务实时计数不可用（Redis 异常）——准入判定依赖实时计数，故不降级放行"
      how="可重试；恢复前新提交按拒绝处理（安全默认），已排队任务保留"
      trace-id="trace-a2a-quota-2b48"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="调用方类型" :value="quotas.length" unit="类" :target="5" target-kind="min" icon="api" />
        <StatCard label="24h 拒绝" :value="totalRejected" unit="次" lower-is-better :target="30" target-kind="max" icon="sound" />
        <StatCard label="最严并发" :value="strictest.concurrency" unit="个" :target="2" target-kind="max" hint="不可信 Agent 并发 1 / 预算 $5" />
        <StatCard label="日预算合计" :value="quotas.reduce((a, c) => a + c.dailyBudgetUsd, 0)" format="cost" unit="USD" icon="discount" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">五类调用方认证矩阵</div>
        <Table :data="quotas" row-key="callerType" size="small">
          <template #callerType="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <b style="font-size: 12px">{{ row.callerType }}</b>
              <Tag size="small" :theme="row.callerType === '不可信Agent' ? 'danger' : row.callerType === '内部服务' ? 'default' : 'primary'" variant="light-outline">
                {{ row.callerType === '不可信Agent' ? '默认最严' : row.callerType === '内部服务' ? '回环专用' : '标准' }}
              </Tag>
            </div>
          </template>
          <template #auth="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.auth }}</span></template>
          <template #defaultPermission="{ row }">{{ row.defaultPermission }}</template>
          <template #dailyBudgetUsd="{ row }"><span class="oc-mono">${{ row.dailyBudgetUsd }}</span></template>
          <template #rejected24h="{ row }">
            <Tag size="small" :theme="row.rejected24h > 10 ? 'warning' : 'default'" variant="light-outline">{{ row.rejected24h }}</Tag>
          </template>
          <template #enforceNote="{ row }">
            <Tooltip :content="row.enforceNote"><span class="oc-clamp-2">{{ row.enforceNote }}</span></Tooltip>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">日预算（按调用方）</div>
          <OcChart type="bar" :series="[{ name: '日预算', points: budgetBars }]" :height="200" format="cost" unit="USD" aria-label="调用方日预算" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">配额执行语义（不静默失败）</div>
          <div class="oc-stack">
            <div class="oc-muted" style="font-size: 12px">① 超 RPM / 并发：返回 429 并携带 Retry-After，调用方可重试（幂等键保护）。</div>
            <div class="oc-muted" style="font-size: 12px">② 超日预算：任务立即停止并报告（BUDGET_EXCEEDED），不降级、不静默截断。</div>
            <div class="oc-muted" style="font-size: 12px">③ 高优先级插队：仅在不挤占已承诺配额时生效，插队行为写审计。</div>
            <div class="oc-muted" style="font-size: 12px">④ 委托权限只能收窄不能放大：OAuth JWT 委托链全程留痕。</div>
          </div>
          <CopyableId id="corr-quota-31c8" label="复制 correlationId" />
        </div>
      </div>
    </StateShell>

    <Dialog
      v-model:visible="quotaOpen"
      header="调整调用方配额"
      width="560px"
      cancel-btn="取消"
      :confirm-btn="{ content: '应用配额', theme: 'primary' }"
      @confirm="applyQuota"
    >
      <div class="oc-stack" style="gap: 10px">
        <div class="oc-flex" style="gap: 8px; align-items: center">
          <span style="font-size: 13px; width: 76px">调用方类型</span>
          <Select
            v-model="quotaType"
            size="small"
            style="width: 220px"
            :options="quotas.map((q) => ({ label: q.callerType, value: q.callerType }))"
            @change="(v: unknown) => syncDraft(v as A2ACallerType)"
          />
          <Tag size="small" variant="outline">{{ quotaType === '不可信Agent' ? '默认最严' : '标准' }}</Tag>
        </div>
        <div class="oc-flex" style="gap: 8px; align-items: center">
          <span style="font-size: 13px; width: 76px">并发上限</span>
          <InputNumber v-model="draftConcurrency" :min="1" :step="1" size="small" theme="column" style="width: 110px" />
          <span style="font-size: 13px">RPM</span>
          <InputNumber v-model="draftRpm" :min="1" :step="10" size="small" theme="column" style="width: 110px" />
          <span style="font-size: 13px">日预算(USD)</span>
          <InputNumber v-model="draftBudget" :min="0" :step="5" size="small" theme="column" style="width: 120px" />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          调整立即作用于该调用方的新请求（准入判定实时生效）；已排队任务按原配额结算、不追溯，配额变更写入审计。
        </div>
      </div>
    </Dialog>
  </div>
</template>
