<script setup lang="ts">
/**
 * 限流与重试面板（M-08 / 卷 02 §4.4 + §4.5）：
 * 并发 / RPM / TPM / 最大输出 + 三重试参数（次数 / 退避基数与上限 / 抖动）+ 熔断状态与恢复语义。
 * 熔断与限流都不是静默行为：命中会生成 model.throttled / 熔断事件并在界面可见。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Progress, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtToken, type PageState } from '@/components/gateway/types';
import { modelData } from '@/mock/data/model';
import type { ModelBreakerData } from '@/mock/data/model';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const breakerView = ref(modelData.modelBreakers);

/** 当前并发为观测口径：按近 24h 调用量折算（展示用估算，生产以实时指标为准） */
const rows = computed(() =>
  data.models
    .filter((m) => m.capabilities.tools !== 'unsupported')
    .map((m, i) => {
      const calls = 4000 - i * 180;
      const inUse = Math.min(m.rateLimits.concurrency, Math.max(1, Math.round(calls / 900)));
      return {
        modelId: m.modelId,
        providerId: m.providerId,
        concurrency: m.rateLimits.concurrency,
        inUse,
        rpm: m.rateLimits.rpm,
        rpmUse: Math.round(m.rateLimits.rpm * (0.18 + ((i * 7) % 40) / 100)),
        tpm: m.rateLimits.tpm,
        tpmUse: Math.round(m.rateLimits.tpm * (0.22 + ((i * 5) % 35) / 100)),
        maxOutput: m.maxOutput,
      };
    }),
);

const openBreakers = computed(() => data.modelBreakers.filter((b) => b.state !== 'closed'));
const totalConcurrency = computed(() => rows.value.reduce((a, b) => a + b.concurrency, 0));
const totalInUse = computed(() => rows.value.reduce((a, b) => a + b.inUse, 0));
const rateLimitErrors = computed(() => data.errorCatalog.find((e) => e.code === 'RATE_LIMIT')?.occurrences24h ?? 0);
const retryTotal = computed(() => data.errorCatalog.filter((e) => e.retryable).reduce((a, b) => a + b.occurrences24h, 0));

const columns: PrimaryTableCol[] = [
  { colKey: 'modelId', title: '模型 / Provider', width: 240 },
  { colKey: 'concurrency', title: '并发（当前 / 上限）', width: 200 },
  { colKey: 'rpm', title: 'RPM（当前 / 上限）', width: 200 },
  { colKey: 'tpm', title: 'TPM（当前 / 上限）', width: 210 },
  { colKey: 'maxOutput', title: '单请求最大输出', width: 130 },
  { colKey: 'retry', title: '重试覆盖（继承 Provider）', width: 220 },
];

const retryColumns: PrimaryTableCol[] = [
  { colKey: 'name', title: '错误分类', width: 200 },
  { colKey: 'retryable', title: '可重试', width: 110 },
  { colKey: 'policy', title: '重试策略', width: 300 },
  { colKey: 'handling', title: '处理方式' },
];

const retryRows = computed(() =>
  data.errorCatalog.map((e) => ({
    code: e.code,
    name: e.name,
    retryable: e.retryable,
    policy: e.retryable ? '指数退避 + 抖动；上限 3 次 / 500ms–10s（Provider 可覆盖）' : '不重试，直接上抛（不消耗重试额度）',
    handling: e.handling,
  })),
);

function recover(b: ModelBreakerData) {
  breakerView.value = breakerView.value.map((x) => (x.id === b.id ? { ...x, state: 'half_open' as const, recoverNote: '人工确认后进入 half-open：连续 2 次成功即闭合，再失败立即重开' } : x));
  MessagePlugin.success(`${b.modelId} 已进入 half-open 探测（每次探测都会记录事件与耗时）`);
}

/** 导出限流配置：模型级限流（含当前占用估算）、错误分类重试矩阵与熔断状态；不含密钥 */
function exportLimits() {
  const file = downloadJson(
    {
      totals: {
        concurrency: totalConcurrency.value,
        concurrencyInUse: totalInUse.value,
        rateLimitErrors24h: rateLimitErrors.value,
        retryableErrors24h: retryTotal.value,
      },
      models: rows.value.map((r) => ({
        modelId: r.modelId,
        providerId: r.providerId,
        concurrency: r.concurrency,
        concurrencyInUse: r.inUse,
        rpm: r.rpm,
        rpmInUse: r.rpmUse,
        tpm: r.tpm,
        tpmInUse: r.tpmUse,
        maxOutput: r.maxOutput,
        retryOverride: '继承 Provider：3 次 / 500–10000ms / 抖动开启',
      })),
      retryPolicy: retryRows.value,
      breakers: breakerView.value,
      redactionNote: '限流与重试配置不含任何密钥材料；凭证引用不出现在本清单',
    },
    `oc-model-rate-limit-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出限流与重试配置：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = rows.value.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="限流与重试"
      desc="多维限流（租户 / 凭证 / 模型）与错误分类重试：退避基数 500ms、上限 10s、开启抖动。重试只认 ErrorCode.retryable，不做 fallback 链静默换模型（D14）。"
      volume="卷 02"
      manifest="M-08"
      cli="oc model limits show | oc model retry policy --class RATE_LIMIT | oc model breaker reset --model qwen3-coder-480b"
      :status="[{ label: `${openBreakers.length} 个熔断未闭合`, theme: openBreakers.length ? 'warning' : 'success' }, { label: '限流排队可见', theme: 'primary' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="exportLimits">导出配置</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="并发配额（合计）" :value="totalConcurrency" icon="dashboard" :hint="`当前估算占用 ${totalInUse}（${((totalInUse / totalConcurrency) * 100).toFixed(1)}%）`" :target="totalConcurrency" target-kind="min" />
      <StatCard label="24h 限流错误" :value="rateLimitErrors" icon="error" :delta="-12.4" hint="命中即生成 model.throttled；排队与拒绝策略可配" />
      <StatCard label="24h 可重试错误" :value="retryTotal" icon="refresh" hint="按分类退避重试；不可重试分类不消耗重试额度" />
      <StatCard label="熔断阈值" :value="5" unit="次 / 60s" format="raw" icon="secured" hint="按端点计；half-open 允许少量探测，连续失败立即重开" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有可限流的模型"
      empty-desc="目录中没有对话型模型（仅嵌入模型不会出现在限流面板）。"
      empty-action="前往模型目录"
      what="限流配置加载失败"
      why="限流服务不可达；限流会退回内核默认保守值（并发 1）以避免放大故障。"
      how="可重试；保守值会明显降低吞吐，恢复后自动还原。"
      trace-id="trace-limits-2f80"
      missing-permission="model.manage"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage（限流参数影响全局吞吐）"
      @retry="state = 'LOADING'"
      @empty-action="state = 'EMPTY'"
    >
      <Table :data="rows" :columns="columns" row-key="modelId" size="small" :pagination="{ pageSize: 10, total: rows.length }">
        <template #modelId="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.modelId }}</span>
            <span class="oc-muted" style="font-size: 12px">{{ row.providerId }}</span>
          </div>
        </template>
        <template #concurrency="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <Progress :percentage="Math.round((row.inUse / row.concurrency) * 100)" :status="row.inUse / row.concurrency > 0.8 ? 'warning' : 'success'" size="small" :style="{ width: '90px' }" />
            <span style="font-size: 12px">{{ row.inUse }} / {{ row.concurrency }}</span>
          </div>
        </template>
        <template #rpm="{ row }">
          <span style="font-size: 12px">{{ row.rpmUse }} / {{ row.rpm }}</span>
        </template>
        <template #tpm="{ row }">
          <span style="font-size: 12px">{{ fmtToken(row.tpmUse) }} / {{ fmtToken(row.tpm) }}</span>
        </template>
        <template #maxOutput="{ row }">{{ row.maxOutput ? fmtToken(row.maxOutput) : '不适用' }}</template>
        <template #retry="{ row }">
          <span class="oc-mono" style="font-size: 12px">3 次 · 500–10000ms · 抖动开</span>
        </template>
      </Table>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">
            <span>熔断状态（5 次失败 / 60s）</span>
            <Tooltip content="限流类错误（429）不计入熔断失败数：它是保护而非故障">
              <span class="oc-muted" style="font-size: 12px">按端点统计</span>
            </Tooltip>
          </div>
          <div class="oc-stack">
            <div v-for="b in breakerView" :key="b.id" class="oc-card" style="padding: 8px 10px">
              <div class="oc-flex--between">
                <span class="oc-mono" style="font-size: 12px">{{ b.modelId }}</span>
                <Tag :theme="b.state === 'open' ? 'danger' : b.state === 'half_open' ? 'warning' : 'success'" size="small" variant="light-outline">
                  {{ b.state === 'open' ? '打开' : b.state === 'half_open' ? '半开' : '闭合' }}
                </Tag>
              </div>
              <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
                {{ b.windowNote }} · {{ b.openedAt ? `打开于 ${new Date(b.openedAt).toLocaleTimeString('zh-CN')}` : '未触发' }}
              </div>
              <div style="font-size: 12px; margin-top: 4px">{{ b.recoverNote }}</div>
              <div v-if="b.state !== 'closed'" class="oc-flex" style="margin-top: 6px">
                <Popconfirm content="恢复后进入 half-open：仅放行少量探测请求；若再次失败立即重新打开（不会静默恢复全量流量）。" @confirm="recover(b)">
                  <Button size="small" variant="outline">人工确认恢复</Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">
            <span>重试策略（按错误分类）</span>
            <span class="oc-muted" style="font-size: 12px">重试矩阵与错误目录同源</span>
          </div>
          <Table :data="retryRows" :columns="retryColumns" row-key="code" size="small" :pagination="{ pageSize: 10, total: retryRows.length }">
            <template #retryable="{ row }">
              <Tag :theme="row.retryable ? 'warning' : 'default'" size="small" variant="light-outline">{{ row.retryable ? '可重试' : '不可重试' }}</Tag>
            </template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            注意：限流持续失败且策略允许时才触发「降级路由」；降级会写入 <span class="oc-mono">capability.degraded</span> 或路由事件，绝不静默换模型。
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
