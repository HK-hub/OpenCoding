<script setup lang="ts">
/**
 * MCP 调用审计（C-04）：server / method / 参数摘要 / 外发字节 / 决策引用 / 耗时 / 状态 / 重试。
 * 溯源：卷 09 §8 DoD「任一 MCP 调用可回溯」+ §4.4 数据外发审计。
 */
import { computed } from 'vue';
import { Input, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { fmtBytes, fmtMs, useExtList } from '@/components/extension/useExtList';

/** 展平：调用日志 × 服务器（跨服务器统一审计视图） */
const rows = computed(() =>
  extensionData.mcpServers.flatMap((s) =>
    s.callLogs.map((c) => ({ ...c, server: s.name, serverId: s.serverId, gateway: s.gateway })),
  ),
);

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(rows.value, {
  persistKey: 'mcp-call-logs',
  pageSize: 14,
  match: (c, kw, f) => (f === 'all' || c.status === f) && (!kw || `${c.server}${c.method}${c.tool}${c.decisionRef}`.toLowerCase().includes(kw)),
});

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: 'ok 成功', value: 'ok' },
  { label: 'error 失败', value: 'error' },
  { label: 'timeout 超时', value: 'timeout' },
  { label: 'circuit-open 熔断拦截', value: 'circuit-open' },
];

const stats = computed(() => ({
  total: rows.value.length,
  errors: rows.value.filter((c) => c.status !== 'ok').length,
  egress: rows.value.reduce((a, c) => a + c.egressBytes, 0),
  retries: rows.value.reduce((a, c) => a + c.retries, 0),
  timeouts: rows.value.filter((c) => c.status === 'timeout').length,
}));

const columns = [
  { colKey: 'at', title: '时间', width: 175 },
  { colKey: 'server', title: '服务器', width: 170 },
  { colKey: 'method', title: '方法 / 工具', width: 220 },
  { colKey: 'digest', title: '参数摘要', width: 180 },
  { colKey: 'egress', title: '外发字节', width: 120 },
  { colKey: 'decision', title: '决策引用', width: 175 },
  { colKey: 'duration', title: '耗时', width: 110 },
  { colKey: 'status', title: '状态 / 重试', width: 150 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="MCP 调用审计"
      desc="每次调用的服务器、方法、参数摘要（脱敏）、外发字节与决策引用都可回溯；熔断拦截同样留痕。"
      volume="卷 09" manifest="C-04" cli="oc mcp audit --tail 200 --json"
      :status="[{ label: '参数摘要已脱敏', theme: 'success' }, { label: `异常 ${stats.errors}`, theme: stats.errors ? 'warning' : 'success' }]"
    />
    <div class="oc-grid oc-grid--4">
      <StatCard label="调用样本" :value="stats.total" unit="条" icon="api" :trend="[8, 12, 15, 18, 22, 26, stats.total]" />
      <StatCard label="异常（含熔断拦截）" :value="stats.errors" unit="条" icon="error" :lower-is-better="true" />
      <StatCard label="累计外发字节" :value="fmtBytes(stats.egress)" format="raw" icon="upload" />
      <StatCard label="重试次数" :value="stats.retries" unit="次" icon="refresh" :lower-is-better="true" hint="幂等只读可重试；写方法按幂等键" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索服务器 / 方法 / 决策引用" clearable style="width: 320px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="statusOptions" style="width: 200px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启 · 留存 TTL 30 天</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="14"
      empty-title="没有匹配的调用记录"
      empty-desc="所选时间窗内无调用（或过滤条件过窄）；首次接入服务器后产生调用即出现记录。"
      empty-action="清除过滤"
      example-task="调用 mcp-postgres-ro.query 执行只读 SQL"
      what="审计流水加载失败"
      why="审计存储查询超时（分区裁剪未命中，回溯窗口过大）。"
      how="可重试；或缩小时间窗后重查（等价命令 oc mcp audit --since 1h）。"
      trace-id="trace-mcp-audit-90ce"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="keyword = ''; filter = 'all'; reload()"
    >
      <Table row-key="id" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #at="{ row }"><span class="oc-muted oc-mono" style="font-size: 12px">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #server="{ row }">
          <div class="oc-flex" style="gap: 4px">
            <span class="oc-mono" style="font-size: 12px">{{ row.server }}</span>
            <Tag v-if="row.gateway" size="small" theme="primary" variant="light-outline">网关</Tag>
          </div>
        </template>
        <template #method="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.method }}</span>
            <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.tool }}</span>
          </div>
        </template>
        <template #digest="{ row }">
          <Tooltip content="参数仅存摘要哈希，正文不入审计存储（防二次泄露）">
            <span class="oc-mono" style="font-size: 12px">{{ row.paramsDigest }}</span>
          </Tooltip>
        </template>
        <template #egress="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtBytes(row.egressBytes) }}</span></template>
        <template #decision="{ row }"><CopyableId :id="row.decisionRef" label="决策引用" :short="16" /></template>
        <template #duration="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtMs(row.durationMs) }}</span></template>
        <template #status="{ row }">
          <Tag size="small" :theme="row.status === 'ok' ? 'success' : row.status === 'circuit-open' ? 'danger' : 'warning'" variant="light-outline">
            {{ row.status }}{{ row.retries ? ` · 重试 ${row.retries}` : '' }}
          </Tag>
        </template>
      </Table>
    </StateShell>

    <div class="oc-card">
      <h3 class="oc-card__title">审计口径</h3>
      <div class="oc-kv">
        <span class="oc-kv__k">外发判定</span><span>调用参数可能含工作区内容 → 按 R3 风险判定；企业 DLP 规则可拦截或脱敏后外发</span>
        <span class="oc-kv__k">熔断留痕</span><span>熔断打开期间的调用以 circuit-open 记录（外发字节 0，未真实外发）</span>
        <span class="oc-kv__k">决策引用</span><span>指向权限决策卡（可展开求值轨迹），与审批中心互联</span>
        <span class="oc-kv__k">留存</span><span>默认 30 天，企业可延长；导出走审计导出任务（含完整性校验）</span>
      </div>
    </div>
  </div>
</template>
