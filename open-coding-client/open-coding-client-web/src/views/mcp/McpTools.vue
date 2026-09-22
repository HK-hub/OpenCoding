<script setup lang="ts">
/**
 * MCP 工具发现（C-03）：原始名 / 命名空间 / 别名 / 风险提示 + 与内置冲突告警。
 * 溯源：卷 09 D-MCP-4 命名与冲突（内置优先 + 命名空间化 + 别名表）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { MCP_STATE_THEME, fmtMs, useExtList, type TagTheme } from '@/components/extension/useExtList';

const router = useRouter();

/** 展平：工具 × 服务器（模型侧看到的是命名空间化后的名字） */
const rows = computed(() =>
  extensionData.mcpServers.flatMap((s) =>
    s.tools.map((t) => ({ ...t, server: s.name, serverId: s.serverId, serverState: s.state })),
  ),
);

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(rows.value, {
  persistKey: 'mcp-tools',
  pageSize: 14,
  match: (t, kw, f) => {
    const byServer = f === 'all' || t.server === f;
    const byRisk = !kw.startsWith('r:') || t.riskHint === kw.slice(2).toUpperCase();
    const textOk = !kw || kw.startsWith('r:') || `${t.rawName}${t.namespace}${t.alias}${t.desc}${t.server}`.toLowerCase().includes(kw);
    return byServer && byRisk && textOk;
  },
});

const serverOptions = [
  { label: '全部服务器', value: 'all' },
  ...extensionData.mcpServers.map((s) => ({ label: `${s.name}（${s.state}）`, value: s.name })),
];

const conflicts = computed(() => rows.value.filter((t) => t.conflictWithBuiltin));
const stats = computed(() => ({
  total: rows.value.length,
  conflicts: conflicts.value.length,
  writeCapable: rows.value.filter((t) => ['R1', 'R2', 'R3', 'R4', 'R5'].includes(t.riskHint)).length,
  degraded: new Set(rows.value.filter((t) => t.serverState !== 'Ready').map((t) => t.server)).size,
}));

function stTheme(v: string): TagTheme {
  return (MCP_STATE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

const refreshing = ref(false);
const lastRefreshMs = ref(184);
const lastRefreshAt = ref('');

/** 刷新能力列表（tools/list）：四服务器并行短异步，完成后更新刷新耗时与时间（变更仅影响后续轮次） */
function refreshTools() {
  refreshing.value = true;
  window.setTimeout(() => {
    refreshing.value = false;
    // 与工具条目数关联的确定性耗时（mock），体现本次刷新的真实结果
    lastRefreshMs.value = 160 + Math.min(stats.value.total, 60);
    lastRefreshAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    MessagePlugin.info(`已刷新能力列表（tools/list）：${stats.value.total} 个工具，耗时 ${fmtMs(lastRefreshMs.value)}，变更仅影响后续轮次`);
  }, 620);
}

const columns = [
  { colKey: 'rawName', title: '原始名', width: 200 },
  { colKey: 'namespace', title: '命名空间（模型侧）', width: 250 },
  { colKey: 'alias', title: '别名', width: 140 },
  { colKey: 'risk', title: '风险提示', width: 110 },
  { colKey: 'server', title: '服务器 / 状态', width: 170 },
  { colKey: 'conflict', title: '与内置冲突', width: 160 },
  { colKey: 'stat', title: '调用 / 错误率', width: 140 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="MCP 工具发现"
      desc="MCP 工具与内置工具完全同构（同一 ToolSpec、同一执行管线、同一权限治理）；冲突时内置优先并命名空间化。"
      volume="卷 09" manifest="C-03" cli="oc mcp tools --all --show-conflicts"
      :status="[{ label: `冲突 ${stats.conflicts}`, theme: stats.conflicts ? 'warning' : 'success' }, { label: '别名表已生效', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/mcp')">返回服务器列表</Button>
        <Button size="small" variant="text" :loading="refreshing" @click="refreshTools">刷新能力列表</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="发现工具总数" :value="stats.total" unit="个" icon="tools" :trend="[18, 20, 22, 23, 24, 25, stats.total]" />
      <StatCard label="与内置冲突" :value="stats.conflicts" unit="个" icon="flag" :lower-is-better="true" hint="冲突项已命名空间化" />
      <StatCard label="写/执行/外发能力" :value="stats.writeCapable" unit="个" icon="secured" :lower-is-better="true" hint="R1–R5，逐调用决策" />
      <StatCard label="受影响服务器（非就绪）" :value="stats.degraded" unit="个" icon="server" :lower-is-better="true" />
    </div>

    <Alert
      v-if="conflicts.length"
      theme="warning"
      message="检测到与内置工具同名的 MCP 工具"
      :description="`${conflicts.map((c) => `${c.rawName}（${c.server}）`).join('、')} —— 内置优先；MCP 版本以 server.tool 暴露并生成告警，模型侧使用别名避免歧义。`"
    />

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索原始名 / 命名空间 / 别名；输入 r:R3 过滤风险级" clearable style="width: 340px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="serverOptions" style="width: 240px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="14"
      empty-title="没有匹配的工具"
      empty-desc="服务器未就绪（未执行 tools/list）或过滤条件过窄；可放宽过滤或先启用服务器。"
      empty-action="清除过滤"
      example-task="接入 postgres-ro 后使用 db_query_ro 执行只读 SQL"
      what="工具索引加载失败"
      why="能力刷新时上游服务器返回 tools/list 解析错误；已保留上次成功的工具清单。"
      how="可重试；或用「一键诊断」定位该服务器握手问题。"
      trace-id="trace-mcp-tools-7d31"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="keyword = ''; filter = 'all'; reload()"
    >
      <Table row-key="namespace" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #rawName="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.rawName }}</span>
            <span class="oc-muted oc-clamp-2" style="font-size: 11px">{{ row.desc }}</span>
          </div>
        </template>
        <template #namespace="{ row }">
          <span class="oc-mono" style="font-size: 12px">{{ row.namespace }}</span>
          <Tag v-if="row.conflictWithBuiltin" size="small" theme="warning" variant="light-outline" style="margin-left: 4px">内置优先</Tag>
        </template>
        <template #alias="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.alias }}</span></template>
        <template #risk="{ row }"><RiskBadge :level="row.riskHint" /></template>
        <template #server="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.server }}</span>
            <Tag size="small" :theme="stTheme(row.serverState)" variant="light-outline">{{ row.serverState }}</Tag>
          </div>
        </template>
        <template #conflict="{ row }">
          <span v-if="row.conflictWithBuiltin" class="oc-secondary" style="font-size: 12px">{{ row.conflictNote }}</span>
          <span v-else class="oc-muted" style="font-size: 12px">—</span>
        </template>
        <template #stat="{ row }">
          <span class="oc-mono" style="font-size: 12px">{{ row.callCount }} 次 · 错误 {{ row.errorRate }}%</span>
        </template>
      </Table>
    </StateShell>

    <div class="oc-card">
      <h3 class="oc-card__title">命名与别名规则</h3>
      <div class="oc-kv">
        <span class="oc-kv__k">命名空间</span><span class="oc-mono">server.tool（如 {{ rows[0]?.namespace }}）</span>
        <span class="oc-kv__k">内置优先</span><span>同名时内置工具保留原名，MCP 版本命名空间化并告警</span>
        <span class="oc-kv__k">别名表</span><span>为模型友好名维护别名（ToolAlias 扩展点），变更产生事件</span>
        <span class="oc-kv__k">上下文同步</span><span>tools/list_changed 刷新仅影响后续轮次；当前轮次保持稳定（避免中途变更）</span>
      </div>
      <div class="oc-muted" style="font-size: 12px; margin-top: 6px">最近一次能力刷新耗时 {{ fmtMs(lastRefreshMs) }}（四服务器并行）{{ lastRefreshAt ? `｜刷新于 ${lastRefreshAt}` : '' }}</div>
    </div>
  </div>
</template>
