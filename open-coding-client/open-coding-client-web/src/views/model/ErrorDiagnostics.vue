<script setup lang="ts">
/**
 * 错误诊断（M-15 / 卷 02 §4.5）：
 * 10 类错误 + 可重试标记 + 厂商原始码（脱敏）+ 建议动作；样本区展示真实失败链路
 * （认证失败 / 限流 / 能力不支持 / 上下文超限 / 协议错误 / 超时 / 取消），每条都可复制 traceId。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, RadioGroup, RadioButton, Tag, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import ErrorClassCard from '@/components/gateway/ErrorClassCard.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { type PageState } from '@/components/gateway/types';
import { modelData } from '@/mock/data/model';
import type { ErrorClassCode } from '@/mock/data/model';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const filter = ref<'ALL' | 'RETRYABLE' | 'ERROR_LEVEL'>('ALL');

const catalog = computed(() =>
  data.errorCatalog.filter((e) => {
    if (filter.value === 'RETRYABLE') return e.retryable;
    if (filter.value === 'ERROR_LEVEL') return e.severity === 'error';
    return true;
  }),
);
const retryableCount = computed(() => data.errorCatalog.filter((e) => e.retryable).length);
const totalOccurrences = computed(() => data.errorCatalog.reduce((a, b) => a + b.occurrences24h, 0));
const negSamples = computed(() => data.errorSamples);

/** 导出诊断包：当前筛选下的错误分类目录 + 失败样本链路（厂商原始码一律为脱敏留档） */
function exportDiagnostics() {
  const file = downloadJson(
    {
      filter: filter.value,
      catalogCount: catalog.value.length,
      retryableCount: retryableCount.value,
      totalOccurrences24h: totalOccurrences.value,
      catalog: catalog.value.map((e) => ({
        code: e.code,
        name: e.name,
        retryable: e.retryable,
        severity: e.severity,
        vendorCodeMasked: e.vendorCodeMasked,
        handling: e.handling,
        suggestion: e.suggestion,
        occurrences24h: e.occurrences24h,
        lastSeenAt: e.lastSeenAt,
        affectedModels: e.affectedModels,
      })),
      samples: negSamples.value.map((s) => ({
        id: s.id,
        sampleKind: s.sampleKind,
        errorClass: s.errorClass,
        at: s.at,
        providerId: s.providerId,
        modelId: s.modelId,
        sessionId: s.sessionId,
        traceId: s.traceId,
        retryable: s.retryable,
        vendorCodeMasked: s.vendorCodeMasked,
        message: s.message,
        suggestion: s.suggestion,
        resolution: s.resolution,
        requestNote: s.requestNote,
      })),
      redactionNote: '厂商原始码一律为脱敏留档（masked）；诊断包不含任何密钥材料',
    },
    `oc-model-error-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出诊断包：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = data.errorCatalog.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="错误诊断"
      desc="统一错误分类（10 类）：认证 / 配额 / 限流 / 内容策略 / 上下文超限 / 网络 / 服务端 / 协议 / 能力不支持 / 取消。可重试标记驱动重试矩阵，厂商原始码一律脱敏留档。"
      volume="卷 02"
      manifest="M-15"
      cli="oc model error list --class RATE_LIMIT | oc model error explain --trace trace-err-7b20"
      :status="[{ label: `${totalOccurrences} 次 / 24h`, theme: 'default' }, { label: `${retryableCount} 类可重试`, theme: 'warning' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="exportDiagnostics">导出诊断包</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="错误分类数" :value="data.errorCatalog.length" icon="bug" :target="10" target-kind="min" hint="分类封闭集，新增分类需内核版本升级" />
      <StatCard label="24h 发生总数" :value="totalOccurrences" icon="chart" :delta="-8.2" hint="限流类占比最高（保护性错误，非故障）" />
      <StatCard label="不可重试分类" :value="data.errorCatalog.filter((e) => !e.retryable).length" icon="close" hint="直接上抛，不消耗重试额度；必须给替代路径" />
      <StatCard label="能力不支持（拦截于调用前）" :value="data.errorCatalog.find((e) => e.code === 'UNSUPPORTED_CAPABILITY')?.occurrences24h ?? 0" icon="secured" hint="零额度消耗：在发出请求前被能力校验拦截" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有错误记录"
      empty-desc="观察窗内没有失败调用；这是理想状态，但仍建议保留诊断入口以便随时排查。"
      empty-action="查看全部分类"
      what="错误目录加载失败"
      why="错误目录不可达；为避免误判，界面不展示过期分类（可能缺少新分类）。"
      how="可重试；内核错误翻译不依赖界面目录，调用仍会返回正确分类。"
      trace-id="trace-err-catalog-9f31"
      missing-permission="model.manage"
      risk-level="R1"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage"
      @retry="state = 'LOADING'"
      @empty-action="filter = 'ALL'"
    >
      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 6px">
        <RadioGroup v-model="filter" variant="default-filled" size="small">
          <RadioButton value="ALL">全部 10 类</RadioButton>
          <RadioButton value="RETRYABLE">可重试</RadioButton>
          <RadioButton value="ERROR_LEVEL">ERROR 级</RadioButton>
        </RadioGroup>
        <span class="oc-muted" style="font-size: 12px">展示 {{ catalog.length }} 类；每类含处理方式与建议动作</span>
      </div>

      <div class="oc-grid oc-grid--2">
        <ErrorClassCard v-for="e in catalog" :key="e.code" :item="e" :trace-id="negSamples.find((s) => s.errorClass === e.code)?.traceId ?? `trace-err-${e.code.toLowerCase()}`" />
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>失败样本链路（含负样本：认证失败 / 限流 / 能力不支持 / 上下文超限）</span>
          <Tooltip content="每条样本都可复制 traceId；不可重试样本必须给出替代路径（禁止只报错）">
            <span class="oc-muted" style="font-size: 12px">{{ negSamples.length }} 条</span>
          </Tooltip>
        </div>
        <Timeline>
          <TimelineItem v-for="s in negSamples" :key="s.id" :label="new Date(s.at).toLocaleString('zh-CN')">
            <div class="oc-card" style="padding: 10px 12px">
              <div class="oc-flex--between">
                <span class="oc-flex oc-flex--wrap" style="gap: 6px">
                  <Tag :theme="s.retryable ? 'warning' : 'danger'" size="small" variant="light-outline">{{ s.errorClass }}</Tag>
                  <Tag size="small" variant="outline">{{ s.retryable ? '可重试' : '不可重试' }}</Tag>
                  <span class="oc-mono" style="font-size: 12px">{{ s.modelId }}</span>
                  <span class="oc-muted" style="font-size: 12px">@ {{ s.providerId }}</span>
                </span>
                <CopyableId :id="s.traceId" label="复制 traceId" />
              </div>
              <div class="oc-stack" style="gap: 3px; margin-top: 6px; font-size: 13px">
                <div><span class="oc-muted">事实：</span>{{ s.message }}</div>
                <div><span class="oc-muted">厂商码（脱敏）：</span><span class="oc-mono">{{ s.vendorCodeMasked }}</span></div>
                <div><span class="oc-muted">建议：</span>{{ s.suggestion }}</div>
                <div><span class="oc-muted">处置结果：</span>{{ s.resolution }}</div>
                <div class="oc-muted" style="font-size: 12px">{{ s.requestNote }}</div>
              </div>
            </div>
          </TimelineItem>
        </Timeline>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">分类原则（内核翻译，不向上暴露厂商异常）</div>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 22px">
          <li>所有 SDK / HTTP 异常必须翻译为 <span class="oc-mono">ModelError</span>（含分类 + 可重试 + 脱敏厂商码），原始异常不得外溢。</li>
          <li>重试只认 <span class="oc-mono">ErrorCode.retryable</span>；不做 fallback 链静默换模型（D14）。</li>
          <li>能力不支持在调用前拦截（零额度消耗），并给出可切换模型建议。</li>
          <li>取消（用户中断）不重试、不重复计费；从检查点恢复而不是重跑整轮。</li>
        </ul>
      </div>
    </StateShell>
  </div>
</template>
