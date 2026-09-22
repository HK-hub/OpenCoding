<script setup lang="ts">
/**
 * 模型详情（M-06 / 卷 02 §4.1）：上下文窗口、最大输出、定价（入/出/缓存读/缓存写/货币）、
 * 限流参数、区域与数据驻留、能力位明细、熔断状态与命中路由；凭证只显示引用名。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import type { InfoItem } from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CapabilityGrid from '@/components/gateway/CapabilityGrid.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtCost, fmtToken, waterTheme, type PageState } from '@/components/gateway/types';
import { CAPABILITY_META, MODEL_SOURCE_META, PROVIDER_STATUS_META, modelData } from '@/mock/data/model';
import type { CapabilityState } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const data = modelData;
const id = String(route.params.id ?? '');
const model = data.models.find((m) => m.modelId === id);
const state = ref<PageState>('LOADING');
const sampleInput = ref(100000);

const provider = computed(() => data.providers.find((p) => p.id === model?.providerId));
const breaker = computed(() => data.modelBreakers.find((b) => b.modelId === id));
const cacheObs = computed(() => data.cacheObservations.find((c) => c.modelId === id));
const hitRules = computed(() => data.routeRules.filter((r) => r.targetModel === id || r.fallbackChain.includes(id)));

/** 估算单次成本：示例输入 token（按 70% 缓存读）+ 5% 输出 */
const estimate = computed(() => {
  if (!model) return 0;
  const p = model.pricing;
  const input = sampleInput.value;
  const cacheRead = input * 0.7;
  const uncached = input - cacheRead;
  const output = input * 0.05;
  return (uncached / 1_000_000) * p.input + (cacheRead / 1_000_000) * p.cacheRead + (output / 1_000_000) * p.output;
});

const sourceMeta = computed(() => MODEL_SOURCE_META[model?.source ?? 'builtin']);
const statusMeta = computed(() => PROVIDER_STATUS_META[provider.value?.status ?? 'timeout']);

const baseItems = computed<InfoItem[]>(() => [
  { key: 'provider', label: 'Provider / 协议族', value: `${provider.value?.name ?? '—'}（${provider.value?.protocolFamily ?? '—'}）` },
  { key: 'cred', label: '凭证引用（引用式）', value: provider.value?.credentialRef ?? '—', secretRef: true },
  { key: 'status', label: '来源连通状态', value: statusMeta.value.label, tag: { text: statusMeta.value.label, theme: statusMeta.value.theme } },
  { key: 'source', label: '目录来源 / 版本', value: `${sourceMeta.value.label} · ${model?.version ?? '—'}` },
  { key: 'window', label: '上下文窗口 / 最大输出', value: `${fmtToken(model?.contextWindow ?? 0)} / ${model?.maxOutput ? fmtToken(model.maxOutput) : '—'}` },
  { key: 'region', label: '区域 / 数据驻留', value: `${model?.region ?? '—'} · ${model?.dataResidency ?? '—'}` },
  { key: 'limits', label: '限流（并发 / RPM / TPM）', value: model ? `${model.rateLimits.concurrency} / ${model.rateLimits.rpm} / ${model.rateLimits.tpm.toLocaleString('zh-CN')}` : '—' },
  { key: 'conflict', label: '同名冲突', value: model?.conflictWith.length ? `与 ${model.conflictWith.join('、')} 冲突（用户配置优先）` : '无' },
]);

const ruleColumns: PrimaryTableCol[] = [
  { colKey: 'name', title: '路由规则', width: 220 },
  { colKey: 'role', title: '本模型角色', width: 120 },
  { colKey: 'condition', title: '命中条件' },
  { colKey: 'hit', title: '今日命中', width: 100 },
];

const ruleRows = computed(() =>
  hitRules.value.map((r) => ({
    id: r.id, name: r.name,
    role: r.targetModel === id ? '主目标' : `回退链第 ${r.fallbackChain.indexOf(id) + 1} 位`,
    condition: `${r.condition.taskType} · ${r.condition.complexity} · ${r.condition.tenantPolicy}${r.condition.costCeilingUsd !== null ? ` · ≤$${r.condition.costCeilingUsd}` : ''}`,
    hit: r.hitCountToday,
  })),
);

onMounted(() => {
  window.setTimeout(() => (state.value = model ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`模型详情 · ${model?.displayName ?? id}`"
      desc="元数据与定价来自目录（三源合并结果）；定价影响成本估算与路由的成本上限判定。窗口与驻留标记参与路由过滤：不满足驻留要求的模型不会被选中。"
      volume="卷 02"
      manifest="M-06"
      :cli="`oc model describe ${id} --show-pricing --show-residency`"
      :status="[model ? { label: sourceMeta.label, theme: sourceMeta.theme } : { label: '未知模型', theme: 'danger' }, { label: '跨模块只读', theme: 'default' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="router.push('/model/catalog')">返回目录</Button>
        <Button size="small" variant="outline" @click="router.push(`/model/routing`)">查看路由</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="输入定价（/M token）" :value="model?.pricing.input ?? 0" :unit="model?.pricing.currency ?? 'USD'" icon="discount" :hint="'缓存读 %s / 缓存写 %s'.replace('%s', String(model?.pricing.cacheRead)).replace('%s', String(model?.pricing.cacheWrite))" />
      <StatCard label="估算单次成本" :value="estimate" format="cost" icon="discount" :target="0.5" target-kind="max" lower-is-better :hint="`按输入 ${fmtToken(sampleInput)} token（70% 缓存读）+ 5% 输出估算`" />
      <StatCard label="上下文窗口" :value="model?.contextWindow ?? 0" format="token" icon="layers" :target="200000" target-kind="min" />
      <StatCard label="缓存命中率" :value="cacheObs?.hitRatePct ?? 0" format="percent" icon="refresh" :hint="cacheObs?.cacheEnabled ? '断点标记 ' + cacheObs.breakpoints + ' 个' : cacheObs?.missReason || '无缓存观测数据'" />
    </div>

    <StateShell
      :state="state"
      empty-title="未找到该模型"
      empty-desc="modelId 不在目录中；可能已被移除或仅存在于探测快照。"
      empty-action="返回模型目录"
      what="模型详情加载失败"
      why="目录读取异常；定价可能为过期快照，路由会继续使用上次成功的矩阵。"
      how="可重试；连续失败请在「错误诊断」查看目录服务错误分类。"
      trace-id="trace-model-detail-2c88"
      missing-permission="model.manage"
      risk-level="R1"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage（只读详情可申请 R1 临时授权）"
      @retry="state = 'LOADING'"
      @empty-action="router.push('/model/catalog')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">元数据与定价</div>
          <InfoGrid :items="baseItems" :columns="2" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">
            <span>能力位（8+2 × 三态）</span>
            <Tooltip content="不支持的能力位在调用前被校验拦截；降级路径需策略显式允许并生成 capability.degraded 事件">
              <span class="oc-muted" style="font-size: 12px">不静默降级</span>
            </Tooltip>
          </div>
          <CapabilityGrid v-if="model" :capabilities="model.capabilities" />
          <div class="oc-stack" style="margin-top: 8px; font-size: 12px">
            <div v-for="c in CAPABILITY_META.filter((x) => model && model.capabilities[x.key] !== 'supported')" :key="c.key">
              <Tag :theme="model && model.capabilities[c.key] === 'degraded' ? 'warning' : 'default'" size="small" variant="light-outline">{{ c.label }}</Tag>
              <span style="margin-left: 6px">{{ c.unsupportedBehavior }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">成本估算（可调输入规模）</div>
          <div class="oc-flex" style="gap: 6px; margin-bottom: 8px">
            <Button v-for="n in [20000, 100000, 268000]" :key="n" size="small" :variant="sampleInput === n ? 'base' : 'outline'" @click="sampleInput = n">
              {{ fmtToken(n) }} token
            </Button>
            <span class="oc-muted" style="font-size: 12px">估算仅含 token 成本（不含工具/沙箱）</span>
          </div>
          <OcChart
            type="bar"
            format="cost"
            :height="180"
            :series="[{ name: '估算成本（USD）', points: [{ x: '输入(未缓存)', y: (sampleInput * 0.3 / 1_000_000) * (model?.pricing.input ?? 0) }, { x: '缓存读', y: (sampleInput * 0.7 / 1_000_000) * (model?.pricing.cacheRead ?? 0) }, { x: '输出', y: (sampleInput * 0.05 / 1_000_000) * (model?.pricing.output ?? 0) }] }]"
            :aria-label="`${id} 成本构成估算`"
          />
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <Tag :theme="waterTheme((estimate / 0.5) * 100, 80, 100) === 'danger' ? 'danger' : waterTheme((estimate / 0.5) * 100, 80, 100) === 'warning' ? 'warning' : 'success'" size="small" variant="light-outline">
              相对「简单任务 ≤ $0.5」目标：{{ ((estimate / 0.5) * 100).toFixed(1) }}%
            </Tag>
            <span class="oc-muted" style="font-size: 12px">超目标时预算守卫会在<span class="oc-mono"> 预算信封</span> 不足时直接拒绝（业务错误，不静默换模型）</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">限流与熔断</div>
          <div class="oc-stack" style="font-size: 13px">
            <div class="oc-kv">
              <span class="oc-kv__k">并发上限</span><span>{{ model?.rateLimits.concurrency }}</span>
              <span class="oc-kv__k">RPM</span><span>{{ model?.rateLimits.rpm }}</span>
              <span class="oc-kv__k">TPM</span><span>{{ model?.rateLimits.tpm.toLocaleString('zh-CN') }}</span>
              <span class="oc-kv__k">最大输出</span><span>{{ model?.maxOutput ? fmtToken(model.maxOutput) : '不适用（嵌入模型）' }}</span>
            </div>
            <div class="oc-divider" />
            <div class="oc-flex" style="gap: 6px">
              <Tag :theme="breaker?.state === 'open' ? 'danger' : breaker?.state === 'half_open' ? 'warning' : 'success'" size="small" variant="light-outline">
                熔断 {{ breaker?.state === 'open' ? '打开' : breaker?.state === 'half_open' ? '半开' : '闭合' }}
              </Tag>
              <span class="oc-muted" style="font-size: 12px">{{ breaker?.windowNote }} · {{ breaker?.recoverNote }}</span>
            </div>
            <div v-if="model && model.capabilities.cache === 'unsupported'" class="oc-flex" style="gap: 6px">
              <Tag size="small" variant="outline">缓存断点已关闭</Tag>
              <span class="oc-muted" style="font-size: 12px">该模型 cache 能力位为 unsupported：不标记断点，缓存折扣按实测 0 记录</span>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>命中该模型的路由规则</span>
          <span class="oc-muted" style="font-size: 12px">共 {{ hitRules.length }} 条（含回退链位置）</span>
        </div>
        <Table :data="ruleRows" :columns="ruleColumns" row-key="id" size="small" :pagination="{ pageSize: 8, total: ruleRows.length }">
          <template #role="{ row }">
            <Tag :theme="row.role === '主目标' ? 'primary' : 'default'" size="small" variant="light-outline">{{ row.role }}</Tag>
          </template>
          <template #condition="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.condition }}</span></template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
