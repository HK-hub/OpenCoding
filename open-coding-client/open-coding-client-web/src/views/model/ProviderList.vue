<script setup lang="ts">
/**
 * Provider 列表（M-01 / 卷 02 §4.6）：
 * 协议族 / 端点 / 凭证引用（引用式，永不回显明文）/ 连通状态 / 模型数 / 最近探测，
 * 并提供启用禁用、连通性测试与编辑入口；不静默：非连通状态显式标注原因且不参与路由。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Popconfirm, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtUsd, type PageState } from '@/components/gateway/types';
import { PROVIDER_STATUS_META, PROTOCOL_FAMILY_META, modelData } from '@/mock/data/model';
import type { ProtocolFamily, ProviderData, ProviderStatus } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const data = modelData;
const state = ref<PageState>('LOADING');
const keyword = ref('');
const family = ref<'ALL' | ProtocolFamily>('ALL');
const statusFilter = ref<'ALL' | ProviderStatus>('ALL');
const pageSize = ref(8);

const familyOptions = [
  { label: '全部协议族', value: 'ALL' },
  ...(Object.keys(PROTOCOL_FAMILY_META) as ProtocolFamily[]).map((k) => ({ label: PROTOCOL_FAMILY_META[k].label, value: k })),
];
const statusOptions = [
  { label: '全部状态', value: 'ALL' },
  ...(Object.keys(PROVIDER_STATUS_META) as ProviderStatus[]).map((k) => ({ label: PROVIDER_STATUS_META[k].label, value: k })),
];

const filtered = computed(() =>
  data.providers.filter((p) => {
    if (family.value !== 'ALL' && p.protocolFamily !== family.value) return false;
    if (statusFilter.value !== 'ALL' && p.status !== statusFilter.value) return false;
    if (keyword.value && !`${p.name}${p.baseUrl}${p.credentialRef}`.toLowerCase().includes(keyword.value.toLowerCase())) return false;
    return true;
  }),
);
const rows = computed(() => (state.value === 'EDGE_DATA' ? filtered.value.slice(0, pageSize.value) : filtered.value));

const abnormal = computed(() => data.providers.filter((p) => p.status !== 'reachable'));
const reachablePct = computed(() => Math.round(((data.providers.length - abnormal.value.length) / data.providers.length) * 100));
const totalModels = computed(() => data.providers.reduce((a, b) => a + b.modelCount, 0));

const columns: PrimaryTableCol[] = [
  { colKey: 'name', title: 'Provider / 协议族', width: 250 },
  { colKey: 'baseUrl', title: '端点', width: 250 },
  { colKey: 'credentialRef', title: '凭证引用（引用式）', width: 230 },
  { colKey: 'status', title: '连通状态', width: 200 },
  { colKey: 'modelCount', title: '模型数', width: 84 },
  { colKey: 'probe', title: '最近探测 / 覆盖参数', width: 230 },
  { colKey: 'actions', title: '操作', width: 190 },
];

const fmtTime = (iso: string) => (iso ? new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

function toggle(p: ProviderData, v: boolean) {
  p.enabled = v;
  MessagePlugin[v ? 'success' : 'warning'](
    v ? `已启用 ${p.name}` : `已禁用 ${p.name}：其 ${p.modelCount} 个模型不再参与路由，命中该 Provider 的路由会显式提示「无可用目标」`,
  );
}

function loadMore() {
  pageSize.value += 8;
  if (pageSize.value >= filtered.value.length) state.value = 'NORMAL';
  ui.track('model.provider.load_more', { pageSize: pageSize.value });
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = data.providers.length ? 'NORMAL' : 'EMPTY';
  }, 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Provider 列表"
      desc="一个 Provider = 一个可调用的模型来源：协议族、端点、凭证引用与超时/重试覆盖。凭证只见引用名，真实密钥由 SecretPort 在发起请求前注入。"
      volume="卷 02"
      manifest="M-01"
      cli="oc model provider list | oc model provider test --id prov-anthropic-main"
      :status="[{ label: `${data.providers.length} 个来源`, theme: 'default' }, { label: '凭证引用式', theme: 'primary' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="router.push('/model/credentials')">凭证管理</Button>
        <Button size="small" theme="primary" @click="router.push('/model/providers/new')">
          <OcIcon name="add" size="14px" /> 新建 Provider
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="Provider 总数" :value="data.providers.length" icon="server" :delta="4.0" :lower-is-better="false" />
      <StatCard label="连通率" :value="reachablePct" format="percent" icon="check" :target="95" target-kind="min" />
      <StatCard label="异常来源" :value="abnormal.length" icon="error" :hint="abnormal.map((p) => `${p.name}：${PROVIDER_STATUS_META[p.status].label}`).join('；')" />
      <StatCard label="本月模型成本" :value="data.usageTotals.costUsd" format="cost" icon="discount" :target="data.usageTotals.budgetUsd" target-kind="max" :hint="`预算水位 ${((data.usageTotals.costUsd / data.usageTotals.budgetUsd) * 100).toFixed(1)}%（¥/USD 口径同目录定价）`" />
    </div>

    <StateShell
      :state="state"
      empty-title="还没有配置 Provider"
      empty-desc="没有任何模型来源时，Agent 无法发起调用；可先接入平台默认来源或本地 Ollama。"
      empty-action="新建 Provider"
      example-task="接入本地 Ollama：http://127.0.0.1:11434（无需密钥，零外发）"
      what="Provider 列表加载失败"
      why="配置服务返回 503，当前展示的是最近一次成功快照可能有缺口。"
      how="可重试；若持续失败请检查开放配置服务与内核连接状态。"
      trace-id="trace-prov-list-7f21"
      missing-permission="model.manage"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage（写入型权限，需项目管理员确认）"
      :collapsed-summary="`共 ${filtered.length} 个 Provider，超出单屏渲染阈值，已折叠展示。`"
      :page-size="pageSize"
      @retry="state = 'LOADING'"
      @load-more="loadMore"
      @empty-action="router.push('/model/providers/new')"
    >
      <div class="oc-flex oc-flex--wrap" style="margin-bottom: 8px">
        <Input v-model="keyword" placeholder="搜索名称 / 端点 / 凭证引用" clearable style="width: 260px" size="small" />
        <Select v-model="family" :options="familyOptions" size="small" style="width: 160px" />
        <Select v-model="statusFilter" :options="statusOptions" size="small" style="width: 150px" />
        <span class="oc-muted" style="font-size: 12px">共 {{ filtered.length }} 条（模型合计 {{ totalModels }} 个）</span>
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" stripe hover :pagination="{ pageSize: 12, total: rows.length }">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-flex" style="gap: 6px">
              <b>{{ row.name }}</b>
              <Tag size="small" variant="outline">{{ PROTOCOL_FAMILY_META[row.protocolFamily as ProtocolFamily].label }}</Tag>
              <Tag v-if="!row.enabled" size="small" theme="default" variant="light-outline">已禁用</Tag>
            </span>
            <span class="oc-muted" style="font-size: 12px">{{ PROTOCOL_FAMILY_META[row.protocolFamily as ProtocolFamily].note }}</span>
          </div>
        </template>
        <template #baseUrl="{ row }">
          <span class="oc-mono">{{ row.baseUrl }}</span>
        </template>
        <template #credentialRef="{ row }">
          <span class="oc-flex" style="gap: 6px">
            <span class="oc-mono">{{ row.credentialRef }}</span>
            <Tag size="small" variant="outline">引用式 · 不明文</Tag>
          </span>
        </template>
        <template #status="{ row }">
          <Tooltip :content="PROVIDER_STATUS_META[row.status as ProviderStatus].hint">
            <span class="oc-flex" style="gap: 6px">
              <Tag :theme="PROVIDER_STATUS_META[row.status as ProviderStatus].theme" size="small" variant="light-outline">
                {{ PROVIDER_STATUS_META[row.status as ProviderStatus].label }}
              </Tag>
              <span v-if="row.status !== 'reachable'" class="oc-muted" style="font-size: 12px">不参与路由</span>
            </span>
          </Tooltip>
        </template>
        <template #modelCount="{ row }">
          <b>{{ row.modelCount }}</b>
        </template>
        <template #probe="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span style="font-size: 12px">{{ fmtTime(row.lastProbeAt) }} · {{ row.probeLatencyMs }}ms</span>
            <span class="oc-muted oc-clamp-2" style="font-size: 12px">
              超时 {{ row.timeoutOverrideMs }}ms · 重试 {{ row.retryOverride.maxRetries }} 次（{{ row.retryOverride.backoffBaseMs }}–{{ row.retryOverride.backoffCapMs }}ms，抖动{{ row.retryOverride.jitter ? '开' : '关' }}）
            </span>
          </div>
        </template>
        <template #actions="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Button size="small" variant="text" @click="router.push(`/model/providers/${row.id}/test`)">测试</Button>
            <Button size="small" variant="text" @click="router.push(`/model/providers/${row.id}`)">编辑</Button>
            <Switch :value="row.enabled" size="small" @change="(v) => toggle(row as ProviderData, Boolean(v))" />
            <Popconfirm
              content="删除后该 Provider 的模型不再参与路由，命中它的规则会回退到回退链或显式报「无可用目标」；不可自动撤销（可重新添加）。"
              @confirm="MessagePlugin.warning('已进入删除确认队列，10s 内可在状态栏撤销')"
            >
              <Button size="small" variant="text" theme="danger">删除</Button>
            </Popconfirm>
          </div>
        </template>
      </Table>

      <div v-if="abnormal.length" class="oc-card" style="margin-top: 10px">
        <div class="oc-card__title">非连通来源（显式标注，不静默跳过）</div>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 22px">
          <li v-for="p in abnormal" :key="p.id">
            <b>{{ p.name }}</b>（{{ PROVIDER_STATUS_META[p.status].label }}）：{{ p.probeNote }}
          </li>
        </ul>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          路由在选中这些来源时会发出「首目标不可用 → 回退到链上下一模型」的显式事件（当前估算影响：{{ abnormal.length }} 个来源 / 约 {{ abnormal.length * 3 }} 条路由链）。
        </div>
      </div>
    </StateShell>
  </div>
</template>
