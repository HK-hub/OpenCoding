<script setup lang="ts">
/**
 * 调用审计（M-13 / 卷 02 §7 + §4.4 第 4 层）：
 * 请求元数据 + 脱敏正文快照 + 保留 TTL。快照默认关闭正文（企业可按需开启），
 * 开启时写入的是「已脱敏」副本（脱敏装饰器先于审计快照执行）；界面与导出都不回显明文密钥。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import type { InfoItem } from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtToken, type PageState } from '@/components/gateway/types';
import { modelData } from '@/mock/data/model';
import type { CallAuditData, ErrorClassCode } from '@/mock/data/model';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const keyword = ref('');
const statusFilter = ref<'ALL' | CallAuditData['status']>('ALL');
const errorFilter = ref<'ALL' | ErrorClassCode>('ALL');
const pageSize = ref(8);
const detail = ref<CallAuditData | null>(null);
const drawerOpen = ref(false);

const statusOptions = [
  { label: '全部状态', value: 'ALL' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
];
const errorOptions = [{ label: '全部错误分类', value: 'ALL' }, ...data.errorCatalog.map((e) => ({ label: `${e.code} · ${e.name}`, value: e.code }))];

const filtered = computed(() =>
  data.callAuditRecords.filter((c) => {
    if (statusFilter.value !== 'ALL' && c.status !== statusFilter.value) return false;
    if (errorFilter.value !== 'ALL' && c.errorClass !== errorFilter.value) return false;
    if (keyword.value && !`${c.id}${c.traceId}${c.modelId}${c.sessionId}${c.taskId}${c.project}`.toLowerCase().includes(keyword.value.toLowerCase())) return false;
    return true;
  }),
);
const rows = computed(() => (state.value === 'EDGE_DATA' ? filtered.value.slice(0, pageSize.value) : filtered.value));
const snapshotOn = computed(() => data.callAuditRecords.filter((c) => c.snapshotEnabled).length);
const ttlAvg = computed(() => Math.round(data.callAuditRecords.reduce((a, b) => a + b.retentionDays, 0) / data.callAuditRecords.length));

const columns: PrimaryTableCol[] = [
  { colKey: 'at', title: '时间', width: 150 },
  { colKey: 'id', title: '调用 / traceId', width: 220 },
  { colKey: 'model', title: '模型 / Provider', width: 220 },
  { colKey: 'scope', title: '会话 / 任务', width: 180 },
  { colKey: 'usage', title: '用量（入/出 · TTFB/总）', width: 250 },
  { colKey: 'status', title: '状态 / 错误分类', width: 190 },
  { colKey: 'retention', title: '快照 / 保留 TTL', width: 170 },
  { colKey: 'open', title: '详情', width: 90 },
];

const detailItems = computed<InfoItem[]>(() => {
  const c = detail.value;
  if (!c) return [];
  return [
    { key: 'traceId', label: 'traceId', value: c.traceId, mono: true, copyable: true },
    { key: 'at', label: '调用时间', value: new Date(c.at).toLocaleString('zh-CN') },
    { key: 'model', label: '模型 / Provider', value: `${c.modelId}（${c.providerId}）` },
    { key: 'cred', label: '凭证引用（引用式）', value: c.credentialRef, secretRef: true },
    { key: 'tenant', label: '租户 / 项目 / 团队', value: `${c.tenant} · ${c.project} · ${c.team}` },
    { key: 'route', label: '命中路由规则', value: `${c.routeRuleId}（重试 ${c.retryCount} 次）` },
    { key: 'meta', label: '请求元数据', value: `消息 ${c.requestMeta.messageCount} 条 · 工具 ${c.requestMeta.toolCount} 个 · 断点 ${c.requestMeta.cacheBreakpoints} 个 · 附件 ${c.requestMeta.attachments} 个` },
    { key: 'budget', label: '预算信封', value: `$${c.requestMeta.budgetUsd}` },
    { key: 'usage', label: '用量', value: `入 ${fmtToken(c.usage.inputTokens)} / 出 ${fmtToken(c.usage.outputTokens)} / 缓存读 ${fmtToken(c.usage.cacheReadTokens)} / 缓存写 ${fmtToken(c.usage.cacheWriteTokens)}` },
    { key: 'latency', label: '首字节 / 总耗时', value: `TTFB ${c.usage.ttfbMs}ms / 总 ${c.usage.totalMs}ms` },
    { key: 'error', label: '错误分类', value: c.errorClass ?? '无（成功）', tag: { text: c.errorClass ?? '无', theme: c.errorClass ? 'danger' : 'success' } },
    { key: 'snapshot', label: '正文快照', value: c.snapshotEnabled ? `已开启（脱敏后副本，${c.sizeKb} KB）` : '未开启（仅元数据；企业策略可按需开启）', tag: { text: c.snapshotEnabled ? '已开启' : '未开启', theme: c.snapshotEnabled ? 'primary' : 'default' } },
    { key: 'ttl', label: '保留 TTL', value: `${c.retentionDays} 天 · ${new Date(c.expiresAt).toLocaleString('zh-CN')} 到期` },
  ];
});

function loadMore() {
  pageSize.value += 8;
  if (pageSize.value >= filtered.value.length) state.value = 'NORMAL';
}

/** 打开调用详情抽屉（行数据按 id 还原为领域类型） */
function openDetail(row: Record<string, unknown>) {
  detail.value = row as unknown as CallAuditData;
  drawerOpen.value = true;
}

/** 清空筛选（空态主行动） */
function clearFilters() {
  keyword.value = '';
  statusFilter.value = 'ALL';
  errorFilter.value = 'ALL';
}

/** 导出脱敏审计包：导出当前筛选命中的记录（密钥字段为引用式掩码，正文快照仅含脱敏副本） */
function exportAuditPackage() {
  const file = downloadJson(
    {
      filter: { keyword: keyword.value, status: statusFilter.value, errorClass: errorFilter.value },
      matchedCount: filtered.value.length,
      snapshotEnabledCount: snapshotOn.value,
      avgRetentionDays: ttlAvg.value,
      records: filtered.value.map((c) => ({
        id: c.id,
        traceId: c.traceId,
        at: c.at,
        tenant: c.tenant,
        project: c.project,
        team: c.team,
        sessionId: c.sessionId,
        taskId: c.taskId,
        modelId: c.modelId,
        providerId: c.providerId,
        credentialRef: c.credentialRef,
        routeRuleId: c.routeRuleId,
        retryCount: c.retryCount,
        requestMeta: c.requestMeta,
        usage: c.usage,
        status: c.status,
        errorClass: c.errorClass,
        snapshotEnabled: c.snapshotEnabled,
        retentionDays: c.retentionDays,
        expiresAt: c.expiresAt,
        sizeKb: c.sizeKb,
        // 未开启正文快照的调用不导出快照字段，避免出现「有字段无内容」的误读
        maskedBodySnapshot: c.snapshotEnabled ? c.maskedBodySnapshot : null,
      })),
      redactionNote: '密钥字段一律为引用式掩码（cred:// 引用，不含密钥材料）；开启快照的调用导出的是脱敏后副本',
    },
    `oc-model-call-audit-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出脱敏审计包：${file}`);
}

/** 导出删除证明：仅含 TTL 与到期/删除时间，不含正文与密钥材料（合规留档用） */
function exportDeletionProof() {
  const c = detail.value;
  if (!c) return;
  const file = downloadJson(
    {
      callId: c.id,
      traceId: c.traceId,
      credentialRef: c.credentialRef,
      modelId: c.modelId,
      providerId: c.providerId,
      retentionDays: c.retentionDays,
      expiresAt: c.expiresAt,
      snapshotEnabled: c.snapshotEnabled,
      snapshotSizeKb: c.sizeKb,
      proofNote: '删除证明仅含保留 TTL 与到期/删除时间，不含正文与密钥材料（密钥一律为引用式掩码）',
    },
    `oc-model-audit-deletion-proof-${c.id}-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出删除证明：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = data.callAuditRecords.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="调用审计"
      desc="每次调用记录：请求元数据（模型/工具数/断点/预算信封）+ 脱敏正文快照（按策略开关）+ 保留 TTL。快照默认关闭，开启时记录的也是脱敏副本——脱敏装饰器先于审计快照执行。"
      volume="卷 02"
      manifest="M-13"
      cli="oc model audit get --call call-9f2a-08 | oc model audit export --since 24h --redacted"
      :status="[{ label: `${snapshotOn} 条含正文快照`, theme: 'default' }, { label: `平均 TTL ${ttlAvg} 天`, theme: 'primary' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="exportAuditPackage">导出脱敏审计包</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="审计记录数" :value="data.callAuditRecords.length" icon="history" hint="按调用一条；model.delta 不落库（仅实时推送）" />
      <StatCard label="失败调用" :value="data.callAuditRecords.filter((c) => c.status === 'failed').length" icon="error" :hint="data.callAuditRecords.filter((c) => c.status === 'failed').map((c) => c.errorClass).join(' / ')" />
      <StatCard label="重试调用" :value="data.callAuditRecords.filter((c) => c.retryCount > 0).length" icon="refresh" hint="重试不重复计费（幂等键保障）" />
      <StatCard label="正文快照占比" :value="Math.round((snapshotOn / data.callAuditRecords.length) * 100)" format="percent" icon="file" :target="0" target-kind="min" hint="企业合规场景可开启；开启后仍为脱敏副本" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有审计记录"
      empty-desc="观察窗内没有调用；审计记录按 TTL 到期自动删除（删除证明可导出）。"
      empty-action="调整筛选条件"
      what="审计记录读取失败"
      why="审计存储不可达或权限不足；为避免明文外泄，读取失败时不会回退到未脱敏副本。"
      how="可重试；若持续失败请检查审计存储与 DLP 配置。"
      trace-id="trace-audit-5b90"
      missing-permission="audit.read"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 audit.read（审计读取属 R3，需安全管理员确认）"
      :collapsed-summary="`共 ${filtered.length} 条审计记录，超出单屏渲染阈值，已折叠展示。`"
      :page-size="pageSize"
      @retry="state = 'LOADING'"
      @load-more="loadMore"
      @empty-action="clearFilters"
    >
      <div class="oc-flex oc-flex--wrap" style="margin-bottom: 8px">
        <Input v-model="keyword" placeholder="搜索调用号 / traceId / 模型 / 会话 / 任务" clearable size="small" style="width: 280px" />
        <Select v-model="statusFilter" :options="statusOptions" size="small" style="width: 130px" />
        <Select v-model="errorFilter" :options="errorOptions" size="small" style="width: 200px" />
        <span class="oc-muted" style="font-size: 12px">{{ filtered.length }} 条命中</span>
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="{ pageSize: 10, total: rows.length }">
        <template #at="{ row }"><span style="font-size: 12px">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #id="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.id }}</span>
            <CopyableId :id="row.traceId" label="复制 traceId" short="24" />
          </div>
        </template>
        <template #model="{ row }">
          <div class="oc-stack" style="gap: 2px; font-size: 12px">
            <span class="oc-mono">{{ row.modelId }}</span>
            <span class="oc-muted">{{ row.providerId }}</span>
          </div>
        </template>
        <template #scope="{ row }">
          <div class="oc-stack" style="gap: 2px; font-size: 12px">
            <span class="oc-mono">{{ row.sessionId }}</span>
            <span class="oc-muted">{{ row.taskId }} · {{ row.routeRuleId }}</span>
          </div>
        </template>
        <template #usage="{ row }">
          <div class="oc-stack" style="gap: 2px; font-size: 12px">
            <span class="oc-mono">{{ fmtToken(row.usage.inputTokens) }} / {{ fmtToken(row.usage.outputTokens) }}</span>
            <span class="oc-muted">{{ row.usage.ttfbMs }}ms / {{ row.usage.totalMs }}ms</span>
          </div>
        </template>
        <template #status="{ row }">
          <span class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag :theme="row.status === 'succeeded' ? 'success' : row.status === 'cancelled' ? 'default' : 'danger'" size="small" variant="light-outline">{{ row.status }}</Tag>
            <Tag v-if="row.errorClass" theme="danger" size="small" variant="outline">{{ row.errorClass }}</Tag>
            <Tag v-if="row.retryCount" size="small" variant="outline">重试 {{ row.retryCount }}</Tag>
          </span>
        </template>
        <template #retention="{ row }">
          <div class="oc-stack" style="gap: 2px; font-size: 12px">
            <Tag :theme="row.snapshotEnabled ? 'primary' : 'default'" size="small" variant="light-outline">{{ row.snapshotEnabled ? '正文快照已开启' : '仅元数据' }}</Tag>
            <span class="oc-muted">TTL {{ row.retentionDays }} 天 · {{ row.sizeKb }} KB</span>
          </div>
        </template>
        <template #open="{ row }">
          <Button size="small" variant="text" @click="openDetail(row)">查看</Button>
        </template>
      </Table>

      <Drawer v-model:visible="drawerOpen" :header="`调用审计 · ${detail?.id ?? ''}`" size="620px" :footer="false">
        <InfoGrid :items="detailItems" :columns="2" />
        <div class="oc-divider" />
        <div class="oc-card__title">
          <span>脱敏正文快照</span>
          <Tag v-if="detail && !detail.snapshotEnabled" size="small" variant="outline">未开启：仅元数据</Tag>
        </div>
        <JsonBlock v-if="detail?.snapshotEnabled" :value="detail.maskedBodySnapshot" mask label="已脱敏副本（密钥字段自动掩码）" :collapse-over="240" />
        <div v-else class="oc-muted" style="font-size: 13px">
          该调用未保存正文快照（策略默认关闭）。如需复现请开启
          <span class="oc-mono">open-coding.model.audit.request-body</span>，开启后写入的仍是脱敏副本。
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
          <Tooltip content="保留 TTL 到期即删除；导出删除证明可满足合规审计">
            <Button size="small" variant="outline" @click="exportDeletionProof">导出删除证明</Button>
          </Tooltip>
          <Popconfirm content="提前删除该调用的正文快照（不可恢复）；元数据与用量保留至 TTL 到期（保证成本可核对）。" @confirm="MessagePlugin.warning('已提交提前删除（10s 内可在状态栏撤销）')">
            <Button size="small" variant="outline">提前删除正文</Button>
          </Popconfirm>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
