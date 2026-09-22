<script setup lang="ts">
/**
 * MCP 一键诊断（C-06）：握手 / 能力列表 / 延迟探测 + 可操作的修复建议。
 * 溯源：卷 09 §7 可维护性（一键诊断：握手、能力列表、延迟）+ D-MCP-8 故障隔离建议。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { MCP_STATE_LABEL, MCP_STATE_THEME, fmtMs, type TagTheme } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const servers = extensionData.mcpServers;
const picked = ref(String(route.query.id ?? 'mcp-sentry'));
const server = computed(() => servers.find((s) => s.serverId === picked.value) ?? servers[0]);
const options = servers.map((s) => ({ label: `${s.name}（${s.state}）`, value: s.serverId }));
const running = ref(false);
const done = ref(false);

/** 修复建议：按状态给出可操作动作（禁用/升级/降级/换来源），不静默忽略 */
const advice = computed(() => {
  const s = server.value;
  if (s.state === 'Failed') {
    return {
      theme: 'error' as const,
      title: '握手失败：协议版本不兼容',
      items: [
        '升级服务器到支持 2025-06-18 的版本（推荐）',
        '或在服务器配置中启用兼容层（协议版本矩阵降级，能力子集显式关闭并留痕）',
        '或改用企业网关镜像的兼容版本（来源：oc://org-registry/mcp）',
      ],
    };
  }
  if (s.circuitBreaker.state === 'open') {
    return {
      theme: 'error' as const,
      title: '熔断已打开（5 次失败 / 60s 窗口）',
      items: [
        '检查上游可用性（诊断显示 503，属外部依赖故障）',
        '等待半开探测（每 30s）自动恢复；或手动恢复（需确认，将重置失败计数）',
        '临时降级：将 jira 相关步骤改为离线清单，避免阻塞任务',
      ],
    };
  }
  if (s.state === 'Degraded') {
    return {
      theme: 'warning' as const,
      title: '已降级：健康探测失败但部分能力可用',
      items: [
        '调大连接池或超时（当前 600ms 获取超时）',
        '重启该服务器（退避 30s，指数递增，上限 5 次后告警）',
        '若持续失败：切换为只读模式或停用（工具从后续轮次移除）',
      ],
    };
  }
  return {
    theme: 'success' as const,
    title: '健康：无待处理问题',
    items: ['握手正常、能力列表完整、延迟在阈值内（P95 < 900ms）'],
  };
});

function run() {
  running.value = true;
  done.value = false;
  window.setTimeout(() => {
    running.value = false;
    done.value = true;
    MessagePlugin.info(`诊断完成：${server.value.name} 状态 ${server.value.state}`);
  }, 900);
}

const columns = [
  { colKey: 'step', title: '诊断步骤', width: 200 },
  { colKey: 'result', title: '结果', width: 110 },
  { colKey: 'detail', title: '明细' },
  { colKey: 'ms', title: '耗时', width: 110 },
];

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/mcp/diagnose', () => !route.query.id || servers.some((s) => s.serverId === route.query.id));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="MCP 一键诊断"
      desc="握手、能力列表、延迟三件套；诊断结论直接给出可操作建议（升级 / 兼容层 / 重启退避 / 换来源）。"
      volume="卷 09" manifest="C-06" :cli="`oc mcp doctor ${server.serverId} --verbose`"
      :status="[
        { label: MCP_STATE_LABEL[server.state], theme: (MCP_STATE_THEME as Record<string, TagTheme>)[server.state] ?? 'default' },
        { label: `网关 ${server.gateway ? '开启' : '直连'}`, theme: 'default' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push({ path: '/extension/mcp/detail', query: { id: server.serverId } })">服务器详情</Button>
        <Button size="small" theme="primary" :loading="running" @click="run">
          <OcIcon name="bug" size="12px" /> 开始诊断
        </Button>
      </template>
    </PageHeader>

    <StateShell
      :state="pageState"
      :trace-id="pageTraceId"
      empty-title="对象不存在或已被清理"
      empty-desc="按链接标识未命中：可能已被卸载、清理或标识有误；请从列表重新进入。"
      what="页面数据加载失败"
      why="该页依赖的索引 / 配置读取失败（不影响其它模块与已加载数据）。"
      how="可重试；持续失败请导出诊断包并附 traceId 便于定位。"
      @retry="reloadPage"
    >


    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <span class="oc-secondary" style="font-size: 12px">选择服务器</span>
        <Select v-model="picked" size="small" :options="options" style="width: 300px" @change="done = false" />
        <span class="oc-muted" style="font-size: 12px">诊断只执行只读方法（initialize / tools-list / resources-list），无副作用</span>
        <span class="oc-grow" />
        <CopyableId id="trace-mcp-doctor-3e8f" label="上次诊断 traceId" :short="16" />
      </div>
    </div>

    <Alert :theme="advice.theme" :message="advice.title" :description="advice.items.join('；')">
    </Alert>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          五步诊断结果
          <Tag size="small" :theme="done ? 'success' : 'default'" variant="light-outline">{{ done ? '已完成' : running ? '运行中' : '未运行' }}</Tag>
        </h3>
        <Table row-key="step" size="small" :data="server.diagnose" :columns="columns">
          <template #result="{ row }">
            <Tag size="small" :theme="!done ? 'default' : row.ok ? 'success' : 'danger'" variant="light-outline">
              {{ !done ? '待检' : row.ok ? '通过' : '失败' }}
            </Tag>
          </template>
          <template #detail="{ row }">
            <span class="oc-secondary" style="font-size: 12px">{{ done ? row.detail : '等待诊断执行' }}</span>
          </template>
          <template #ms="{ row }"><span class="oc-mono" style="font-size: 12px">{{ done ? fmtMs(row.ms) : '—' }}</span></template>
        </Table>
      </div>

      <div class="oc-stack" style="gap: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">延迟探测（最近 10 次）</h3>
          <OcChart
            type="line"
            :series="[{ name: `${server.name} 延迟`, points: server.metrics.trend.map((y, i) => ({ x: `#${i + 1}`, y })) }]"
            :height="180"
            unit="ms"
            :threshold="{ value: 900, label: 'P95 阈值', kind: 'max' }"
            aria-label="MCP 服务器调用延迟趋势"
          />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">隔离参数（诊断依据）</h3>
          <div class="oc-kv">
            <span class="oc-kv__k">超时</span><span class="oc-mono">{{ server.limits.timeoutMs }} ms</span>
            <span class="oc-kv__k">并发上限</span><span class="oc-mono">{{ server.limits.concurrencyMax }}</span>
            <span class="oc-kv__k">熔断阈值</span><span class="oc-mono">{{ server.circuitBreaker.failures }} 次 / {{ server.circuitBreaker.windowSec }}s（当前 {{ server.circuitBreaker.state }}）</span>
            <span class="oc-kv__k">重启退避</span><span class="oc-mono">{{ server.restart.backoffSec }}s · 累计 {{ server.restart.total }} 次</span>
            <span class="oc-kv__k">失败原因</span><span>{{ server.circuitBreaker.reason }}</span>
          </div>
          <Tooltip content="诊断建议可直接执行；危险动作（停用/重置熔断）会二次确认">
            <Button size="small" variant="text" style="margin-top: 8px" @click="router.push('/extension/mcp/isolation')">打开熔断与限流</Button>
          </Tooltip>
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
