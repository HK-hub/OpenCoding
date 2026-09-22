<script setup lang="ts">
/**
 * MCP 服务器列表（C-01）：传输/状态徽标 + 延迟/错误率/外发字节 + 熔断与隔离可见。
 * 溯源：卷 09 §4.2 生命周期状态机 / §4.4 安全模型 / D-MCP-8 故障隔离。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { MCP_STATE_LABEL, MCP_STATE_THEME, TRANSPORT_LABEL, fmtBytes, useExtList, type TagTheme } from '@/components/extension/useExtList';

const router = useRouter();
const servers = extensionData.mcpServers;

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(servers, {
  persistKey: 'mcp-servers',
  pageSize: 8,
  match: (s, kw, f) => (f === 'all' || s.state === f) && (!kw || `${s.serverId}${s.name}${s.stateReason}`.toLowerCase().includes(kw)),
});

const stateOptions = [
  { label: '全部状态', value: 'all' },
  { label: 'Ready 就绪', value: 'Ready' },
  { label: 'Degraded 降级', value: 'Degraded' },
  { label: 'Failed 失败', value: 'Failed' },
  { label: 'Configured 已配置', value: 'Configured' },
  { label: 'Stopped 已停止', value: 'Stopped' },
];

const stats = computed(() => ({
  total: servers.length,
  ready: servers.filter((s) => s.state === 'Ready').length,
  degraded: servers.filter((s) => s.state === 'Degraded').length,
  failed: servers.filter((s) => s.state === 'Failed').length,
  circuitOpen: servers.filter((s) => s.circuitBreaker.state === 'open').length,
  egress: servers.reduce((a, s) => a + s.metrics.egressBytes, 0),
  tools: servers.reduce((a, s) => a + s.tools.length, 0),
}));

const stopped = ref<string[]>([]);

function stTheme(v: string): TagTheme {
  return (MCP_STATE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

function toggle(serverId: string, v: boolean) {
  if (!v) stopped.value.push(serverId);
  else stopped.value = stopped.value.filter((s) => s !== serverId);
  MessagePlugin.info(
    v
      ? `已启用 ${serverId}：进入 Starting → Ready（并行启动，不阻塞内核）`
      : `已停用 ${serverId}：工具从后续轮次上下文移除（当前轮次保持稳定）`,
  );
}

const columns = [
  { colKey: 'name', title: '服务器', width: 260 },
  { colKey: 'transport', title: '传输', width: 130 },
  { colKey: 'lifecycle', title: '生命周期', width: 110 },
  { colKey: 'state', title: '状态', width: 150 },
  { colKey: 'tools', title: '工具', width: 90 },
  { colKey: 'perf', title: '延迟 / 错误率', width: 160 },
  { colKey: 'egress', title: '外发字节', width: 120 },
  { colKey: 'ops', title: '操作', width: 190 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="MCP 服务器"
      desc="四种传输（stdio/http/sse/ws）与六态生命周期；每服务器独立执行域：超时、并发、熔断与退避重启。"
      volume="卷 09" manifest="C-01" cli="oc mcp list --json"
      :status="[{ label: `熔断 ${stats.circuitOpen}`, theme: stats.circuitOpen ? 'danger' : 'success' }, { label: '默认零服务器', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/mcp/diagnose')">一键诊断</Button>
        <Button size="small" variant="outline" @click="router.push('/extension/mcp/isolation')">隔离与熔断</Button>
        <Button size="small" theme="primary" @click="router.push('/extension/mcp/add')">
          <OcIcon name="add" size="12px" /> 添加服务器
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="服务器总数" :value="stats.total" unit="个" icon="server" :trend="[4, 5, 6, 7, 8, 8, stats.total]" />
      <StatCard label="就绪 / 降级" :value="`${stats.ready}`" :unit="`/ ${stats.degraded}`" format="raw" icon="check" />
      <StatCard label="失败 / 熔断" :value="`${stats.failed}`" :unit="`/ ${stats.circuitOpen}`" format="raw" icon="error" :lower-is-better="true" />
      <StatCard label="累计外发字节" :value="fmtBytes(stats.egress)" format="raw" icon="upload" hint="含 DLP 拦截前字节数" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索服务器 / 状态原因" clearable style="width: 280px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="stateOptions" style="width: 180px" />
        <span class="oc-muted" style="font-size: 12px">过滤记忆已开启 · 匹配 {{ matched.length }} 条 · 工具合计 {{ stats.tools }}</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="8"
      empty-title="还没有配置任何 MCP 服务器"
      empty-desc="默认无服务器（需显式配置或经企业网关白名单），接入后工具与内置工具同构、同管线、同权限治理。"
      empty-action="添加服务器"
      example-task="接入 filesystem（stdio，沙箱 L1）后读取工作区文件"
      what="MCP 注册表加载失败"
      why="本地 MCP 配置解析错误（.oc/mcp.json 第 12 行 schema 校验失败）；已隔离该配置，不影响其它服务器。"
      how="可重试；或修复 .oc/mcp.json 后重新加载。"
      trace-id="trace-mcp-reg-44ab"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="router.push('/extension/mcp/add')"
    >
      <Table row-key="serverId" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <div class="oc-flex" style="gap: 6px">
              <Button size="small" variant="text" @click="router.push({ path: '/extension/mcp/detail', query: { id: row.serverId } })">
                {{ row.name }}
              </Button>
              <Tag v-if="row.gateway" size="small" theme="primary" variant="light-outline">经企业网关</Tag>
            </div>
            <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.serverId }} · 沙箱 {{ row.sandboxTier }}</span>
          </div>
        </template>

        <template #transport="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <Tag size="small" variant="outline">{{ TRANSPORT_LABEL[row.transport] }}</Tag>
            <span class="oc-muted" style="font-size: 11px">优先级：{{ row.transportPriority.join(' → ') }}</span>
          </div>
        </template>

        <template #lifecycle="{ row }">
          <Tag size="small" variant="outline">{{ row.lifecycleMode }}</Tag>
        </template>

        <template #state="{ row }">
          <div class="oc-stack" style="gap: 3px">
            <Tag size="small" :theme="stTheme(row.state)" variant="light-outline">{{ MCP_STATE_LABEL[row.state] }}</Tag>
            <Tooltip :content="row.stateReason">
              <span class="oc-muted oc-clamp-2" style="font-size: 11px; max-width: 140px">{{ row.stateReason }}</span>
            </Tooltip>
            <Tag v-if="row.circuitBreaker.state === 'open'" size="small" theme="danger" variant="light-outline">
              熔断 open（{{ row.circuitBreaker.failures }}/{{ row.circuitBreaker.windowSec }}s）
            </Tag>
          </div>
        </template>

        <template #tools="{ row }">
          <span class="oc-mono">{{ row.tools.length }}</span>
          <Tag v-if="row.tools.some((t: { conflictWithBuiltin: boolean }) => t.conflictWithBuiltin)" size="small" theme="warning" variant="light-outline" style="margin-left: 4px">冲突</Tag>
        </template>

        <template #perf="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.metrics.latencyMs }}ms / P95 {{ row.metrics.p95Ms }}ms</span>
            <span class="oc-mono oc-muted" style="font-size: 11px">错误 {{ row.metrics.errorTotal }} · 重启 {{ row.metrics.restartTotal }}</span>
          </div>
        </template>

        <template #egress="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtBytes(row.metrics.egressBytes) }}</span></template>

        <template #ops="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Button size="small" variant="text" @click="router.push({ path: '/extension/mcp/detail', query: { id: row.serverId } })">详情</Button>
            <Button size="small" variant="text" @click="router.push({ path: '/extension/mcp/diagnose', query: { id: row.serverId } })">诊断</Button>
            <Popconfirm
              :content="stopped.includes(row.serverId) ? '启用后进入 Starting → Ready，工具将在后续轮次可用。' : '停用后该服务器工具从后续轮次上下文移除（运行中轮次保持稳定）。'"
              @confirm="toggle(row.serverId, stopped.includes(row.serverId))"
            >
              <Button size="small" variant="text">{{ stopped.includes(row.serverId) ? '启用' : '停用' }}</Button>
            </Popconfirm>
          </div>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
