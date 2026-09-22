<script setup lang="ts">
/**
 * 连通性测试（M-03 / 卷 02 §4.6）：
 * 分四段探测（握手 → 协议一致性 → 能力探测 → 枚举目录），失败段落给三段式原因与建议，
 * 发现模型可一键导入目录（source=probed），冲突在目录页高亮。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import type { PageState } from '@/components/gateway/types';
import { PROTOCOL_FAMILY_META, PROVIDER_STATUS_META, modelData } from '@/mock/data/model';
import type { ProviderData } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const data = modelData;
const id = String(route.params.id ?? '');
const provider = data.providers.find((p) => p.id === id) as ProviderData | undefined;
const state = ref<PageState>('LOADING');
const running = ref(false);
const stageIdx = ref(-1);
const doneAt = ref('');
const importedCount = ref(0);
let timer = 0;

const STAGES = ['建立连接与握手', '协议一致性校验（流式终止 / 工具增量 / 用量字段）', '能力探测（tools / parallelTools / vision / thinking / cache）', '枚举 /models 发现目录'];

/** 探测分区结果：按 Provider 状态推演，失败分区给三段式说明（不静默通过） */
const partitions = computed(() => {
  const ok = provider?.status === 'reachable';
  const authFail = provider?.status === 'authFailed';
  const timeout = provider?.status === 'timeout';
  const protocolErr = provider?.status === 'protocolError';
  return [
    {
      key: 'handshake', name: '握手与鉴权', pass: ok, latencyMs: provider?.probeLatencyMs ?? 0,
      detail: ok ? 'TLS 与鉴权握手成功，返回 200' : authFail ? '握手返回 401：凭证无效或已被轮换' : timeout ? '握手阶段超时（未返回首字节）' : '握手返回 200（鉴权通过）',
      suggestion: authFail ? '在「凭证管理」重新绑定密钥；或临时把路由目标切到其它 Provider（不静默降级）' : timeout ? '检查企业代理与网络策略；超时期间该来源不参与路由' : '',
    },
    {
      key: 'protocol', name: '协议一致性', pass: ok || authFail || timeout, latencyMs: Math.round((provider?.probeLatencyMs ?? 0) * 0.4),
      detail: protocolErr ? 'SSE 流缺少终止帧（[DONE]），判定为端点兼容性问题' : ok || authFail || timeout ? '流式终止 / 工具增量 / 用量字段符合协议族预期' : '未执行',
      suggestion: protocolErr ? '联系自建端点维护方修复协议；该 Provider 仅可用于非流式兜底（限次重试 1 次）' : '',
    },
    {
      key: 'capability', name: '能力探测', pass: ok, latencyMs: Math.round((provider?.probeLatencyMs ?? 0) * 0.3),
      detail: ok ? `探测到 ${provider?.discoveredModels.length ?? 0} 个模型的能力位；cache/thinking 按实际响应标注` : '未执行（前置分区未通过）',
      suggestion: ok ? '' : '先修复前置分区；能力位缺失时按 unsupported 处理，不做静默降级',
    },
    {
      key: 'catalog', name: '模型目录枚举', pass: ok && (provider?.discoveredModels.length ?? 0) > 0, latencyMs: Math.round((provider?.probeLatencyMs ?? 0) * 0.3),
      detail: (provider?.discoveredModels.length ?? 0) > 0 ? `发现 ${provider?.discoveredModels.length} 个模型（可导入目录）` : '未发现可导入模型（端点未实现 /models，或探测失败）',
      suggestion: (provider?.discoveredModels.length ?? 0) > 0 ? '' : '手动在模型目录登记；或确认端点是否实现 /models',
    },
  ];
});

const discovered = computed(() =>
  (provider?.discoveredModels ?? []).map((modelId) => {
    const existing = data.models.find((m) => m.modelId === modelId);
    return {
      modelId,
      existing: Boolean(existing),
      source: existing?.source ?? 'probed',
      conflict: existing ? existing.conflictWith.length > 0 : false,
      note: existing ? `已在目录（来源 ${existing.source}），导入将更新能力位与定价` : '新模型：导入后按探测结果填充能力位（未探测到的位标 unsupported）',
    };
  }),
);

const columns: PrimaryTableCol[] = [
  { colKey: 'modelId', title: '发现的模型', width: 260 },
  { colKey: 'existing', title: '目录状态', width: 150 },
  { colKey: 'note', title: '导入说明' },
  { colKey: 'action', title: '操作', width: 110 },
];

const traceId = computed(() => `trace-probe-${provider?.id.slice(-4) ?? 'xxxx'}-${(provider?.probeLatencyMs ?? 0).toString(16)}`);

function runProbe() {
  running.value = true;
  stageIdx.value = 0;
  doneAt.value = '';
  const tick = () => {
    if (stageIdx.value < STAGES.length - 1) {
      stageIdx.value += 1;
      timer = window.setTimeout(tick, 620);
    } else {
      running.value = false;
      doneAt.value = new Date().toISOString();
      MessagePlugin[provider?.status === 'reachable' ? 'success' : 'warning'](
        provider?.status === 'reachable' ? '探测完成：四个分区通过，可导入发现模型' : `探测完成：存在未通过分区（${PROVIDER_STATUS_META[provider?.status ?? 'timeout'].label}），已生成诊断 traceId`,
      );
    }
  };
  timer = window.setTimeout(tick, 620);
}

function cancel() {
  window.clearTimeout(timer);
  running.value = false;
  MessagePlugin.info('探测已取消（安全点：未写入任何配置，已完成的探测结果保留）');
}

function importModel(modelId: string) {
  importedCount.value += 1;
  MessagePlugin.success(`已导入 ${modelId}（source=probed）：能力位按探测结果填充，未探测位标 unsupported`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = provider ? 'NORMAL' : 'ERROR'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
onUnmounted(() => window.clearTimeout(timer));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`连通性测试 · ${provider?.name ?? id}`"
      desc="四段探测：握手与鉴权 → 协议一致性 → 能力探测 → 目录枚举。失败段落显式给出原因与建议，不做静默跳过；探测不消耗 token 成本。"
      volume="卷 02"
      manifest="M-03"
      cli="oc model provider test --id prov-anthropic-main --discover"
      :status="[{ label: provider ? PROTOCOL_FAMILY_META[provider.protocolFamily].label : '未知协议族', theme: 'default' }, { label: '只读探测', theme: 'primary' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="router.push(`/model/providers/${id}`)">编辑配置</Button>
        <Button size="small" theme="primary" :disabled="running" @click="runProbe">重新探测</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="最近探测延迟" :value="provider?.probeLatencyMs ?? 0" unit="ms" icon="time" :target="3000" target-kind="max" lower-is-better />
      <StatCard label="发现模型数" :value="provider?.discoveredModels.length ?? 0" icon="database" :delta="0" />
      <StatCard label="已导入" :value="importedCount" icon="download" :hint="'导入后 source=probed，与内置目录冲突时在模型目录高亮'" />
      <StatCard label="探测成本" :value="0" format="cost" icon="discount" hint="探测不产生 token 计费（不计入成本归因）" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有可探测的 Provider"
      empty-desc="请先在 Provider 列表创建一个来源。"
      empty-action="返回列表"
      what="探测结果加载失败"
      why="探测服务不可达；最近一次结果可能已过期。"
      how="可重试；探测期间不影响既有调用路由。"
      trace-id="trace-probe-load-5c02"
      missing-permission="model.manage"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage"
      @retry="state = 'LOADING'"
      @empty-action="router.push('/model/providers')"
    >
      <div class="oc-card">
        <div class="oc-card__title">
          <span>探测进度</span>
          <span class="oc-flex" style="gap: 6px">
            <Tag v-if="running" theme="primary" size="small" variant="light-outline">探测中（{{ stageIdx + 1 }}/{{ STAGES.length }}）</Tag>
            <Tag v-else-if="doneAt" theme="success" size="small" variant="light-outline">已完成 {{ new Date(doneAt).toLocaleTimeString('zh-CN') }}</Tag>
            <Button v-if="running" size="small" variant="text" @click="cancel">取消（安全点）</Button>
          </span>
        </div>
        <div class="oc-stack">
          <div v-for="(s, i) in STAGES" :key="s" class="oc-flex" style="gap: 8px; font-size: 13px">
            <Tag :theme="stageIdx > i || (!running && stageIdx === i && doneAt) ? 'success' : stageIdx === i ? 'primary' : 'default'" size="small" variant="light-outline">
              {{ stageIdx > i ? '完成' : stageIdx === i ? (running ? '进行中' : '当前') : '待执行' }}
            </Tag>
            <span>{{ s }}</span>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div v-for="p in partitions" :key="p.key" class="oc-card">
          <div class="oc-card__title">
            <span>{{ p.name }}</span>
            <Tag :theme="p.pass ? 'success' : 'danger'" size="small" variant="light-outline">{{ p.pass ? '通过' : '未通过' }}</Tag>
          </div>
          <div class="oc-stack" style="gap: 4px; font-size: 13px">
            <div><span class="oc-muted">事实：</span>{{ p.detail }}</div>
            <div><span class="oc-muted">耗时：</span>{{ p.latencyMs }}ms</div>
            <div v-if="p.suggestion"><span class="oc-muted">动作：</span>{{ p.suggestion }}</div>
          </div>
          <div v-if="!p.pass" class="oc-flex" style="margin-top: 8px; gap: 6px">
            <CopyableId :id="traceId" label="复制 traceId" />
            <CliHint :command="`oc model provider test --id ${provider?.id ?? id} --verbose`" label="等价命令" />
          </div>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>发现模型导入目录</span>
          <Tooltip content="导入只更新能力位与定价；冲突（同名 modelId）在模型目录页高亮并保留用户配置优先">
            <span class="oc-muted" style="font-size: 12px">用户配置优先</span>
          </Tooltip>
        </div>
        <Table v-if="discovered.length" :data="discovered" :columns="columns" row-key="modelId" size="small" :pagination="{ pageSize: 8, total: discovered.length }">
          <template #modelId="{ row }">
            <span class="oc-mono">{{ row.modelId }}</span>
            <Tag v-if="row.conflict" theme="warning" size="small" variant="light-outline" style="margin-left: 6px">目录冲突</Tag>
          </template>
          <template #existing="{ row }">
            <Tag :theme="row.existing ? 'default' : 'primary'" size="small" variant="light-outline">{{ row.existing ? '已在目录' : '新模型' }}</Tag>
            <span class="oc-muted" style="font-size: 12px; margin-left: 6px">source={{ row.source }}</span>
          </template>
          <template #note="{ row }">{{ row.note }}</template>
          <template #action="{ row }">
            <Button size="small" variant="text" @click="importModel(row.modelId)">导入</Button>
          </template>
        </Table>
        <div v-else class="oc-muted" style="font-size: 13px">
          未发现可导入模型：{{ provider?.probeNote || '端点未实现 /models 或探测未通过' }}。可手动在模型目录登记（不会静默跳过）。
        </div>
      </div>
    </StateShell>
  </div>
</template>
