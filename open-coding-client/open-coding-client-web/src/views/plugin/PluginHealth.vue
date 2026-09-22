<script setup lang="ts">
/**
 * 插件健康与熔断（L-05）：健康四态 + 隔离日志 + 指标 + 熔断 open/closed。
 * 溯源：卷 18 D-PLG-10（健康 + 隔离日志 + 指标 + 熔断：错误率超阈值停用扩展点并告警）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import StateShell from '@/components/common/StateShell.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { PLUGIN_HEALTH_THEME, fmtBytes, fmtMs, useExtList, type TagTheme } from '@/components/extension/useExtList';

const router = useRouter();
const plugins = extensionData.plugins;

const { keyword, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(plugins, {
  persistKey: 'plugin-health',
  pageSize: 10,
  match: (p, kw) => !kw || `${p.id}${p.name}${p.health}`.toLowerCase().includes(kw),
});

const circuits = ref<Record<string, string>>(Object.fromEntries(plugins.map((p) => [p.id, p.circuitState])));
const hunts = computed(() => plugins.filter((p) => circuits.value[p.id] === 'open' || p.health !== '就绪'));

const stats = computed(() => ({
  ready: plugins.filter((p) => p.health === '就绪').length,
  degraded: plugins.filter((p) => p.health === '降级').length,
  fault: plugins.filter((p) => p.health === '故障').length,
  circuit: Object.values(circuits.value).filter((c) => c === 'open').length,
}));

/** 隔离日志：装载失败 + 越权拒绝 + 熔断事件 */
const isolationLog = computed(() => [
  ...plugins
    .filter((p) => p.loadLog.some((s) => !s.ok))
    .map((p) => ({ id: `ISO-${p.id}`, kind: '装载失败', subject: p.id, detail: p.loadLog.find((s) => !s.ok)?.detail ?? '', at: '' })),
  ...plugins.flatMap((p) =>
    p.deniedPermissions.map((d) => ({ id: `DENY-${p.id}-${d.permission}`, kind: '越权拒绝', subject: p.id, detail: `${d.permission}：${d.reason}`, at: d.at })),
  ),
  ...plugins
    .filter((p) => p.circuitState !== 'closed')
    .map((p) => ({ id: `CB-${p.id}`, kind: '熔断', subject: p.id, detail: p.circuitReason, at: '' })),
]);

function resetCircuit(id: string, name: string) {
  circuits.value[id] = 'half-open';
  MessagePlugin.warning(`${name} 熔断重置为 half-open：放行探测调用，成功闭合 / 失败立即重开（避免风暴）`);
}

function forceOff(id: string, name: string) {
  circuits.value[id] = 'open';
  MessagePlugin.warning(`已停用 ${name} 的扩展点（其它插件与内置实现不受影响）；恢复需显式启用并验证`);
}

const columns = [
  { colKey: 'name', title: '插件', width: 260 },
  { colKey: 'health', title: '健康四态', width: 180 },
  { colKey: 'circuit', title: '熔断', width: 150 },
  { colKey: 'metrics', title: '指标（调用/错误/初始化/内存）', width: 300 },
  { colKey: 'ops', title: '操作', width: 200 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="插件健康与熔断"
      desc="健康四态（初始化 / 就绪 / 降级 / 故障）与熔断（open/half-open/closed）；插件故障不影响内核，扩展点自动回退内置实现。"
      volume="卷 18" manifest="L-05" cli="oc plugin health --all --json"
      :status="[
        { label: `熔断 ${stats.circuit}`, theme: stats.circuit ? 'danger' : 'success' },
        { label: '隔离与回退', theme: 'primary' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/plugins/load-log')">装载日志</Button>
        <Button size="small" variant="text" @click="reload">刷新</Button>
      </template>
    </PageHeader>

    <Alert
      v-if="stats.circuit || stats.fault"
      theme="error"
      :message="`${stats.circuit} 个插件熔断、${stats.fault} 个插件故障`"
      description="熔断原因：错误率超阈值（默认 5% / 窗口 60s）；故障插件不注册扩展点。恢复路径：半开探测 → 闭合，或手动重置后验证。"
    />

    <div class="oc-grid oc-grid--4">
      <StatCard label="就绪" :value="stats.ready" unit="个" icon="check" />
      <StatCard label="降级" :value="stats.degraded" unit="个" icon="error" :lower-is-better="true" hint="扩展点回退内置实现" />
      <StatCard label="故障（已隔离）" :value="stats.fault" unit="个" icon="close" :lower-is-better="true" />
      <StatCard label="熔断 open" :value="stats.circuit" unit="个" icon="secured" :lower-is-better="true" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="过滤插件名 / 健康态" clearable style="width: 280px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="10"
      empty-title="没有插件健康数据"
      empty-desc="尚未安装任何插件（或插件均未装载）；装载后自动上报健康与指标。"
      empty-action="打开插件市场"
      example-task="查看 DLP 扫描插件熔断原因并决定恢复或停用"
      what="健康数据加载失败"
      why="插件健康上报通道中断（进程外宿主 IPC 断连）。"
      how="可重试；插件本身仍按最后一次已知状态运行（显式标注「健康未知」）。"
      trace-id="trace-plugin-health-4f0b"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="router.push('/extension/plugins')"
    >
      <Table row-key="id" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span style="font-size: 13px">{{ row.name }}</span>
            <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.id }} · {{ row.kernel.hostMode }}</span>
          </div>
        </template>
        <template #health="{ row }">
          <div class="oc-stack" style="gap: 3px">
            <Tag size="small" :theme="(PLUGIN_HEALTH_THEME as Record<string, TagTheme>)[row.health] ?? 'default'" variant="light-outline">{{ row.health }}</Tag>
            <Tooltip :content="row.healthReason">
              <span class="oc-muted oc-clamp-2" style="font-size: 11px; max-width: 160px">{{ row.healthReason }}</span>
            </Tooltip>
          </div>
        </template>
        <template #circuit="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <Tag size="small" :theme="circuits[row.id] === 'open' ? 'danger' : circuits[row.id] === 'half-open' ? 'warning' : 'success'" variant="light-outline">
              {{ circuits[row.id] }}
            </Tag>
            <span class="oc-muted" style="font-size: 11px">错误 {{ row.metrics.errorTotal }} / 调用 {{ row.metrics.callTotal }}</span>
          </div>
        </template>
        <template #metrics="{ row }">
          <span class="oc-mono" style="font-size: 12px">
            {{ row.metrics.callTotal }} / {{ row.metrics.errorTotal }} / {{ fmtMs(row.metrics.initLatencyMs) }} / {{ fmtBytes(row.metrics.memoryBytes) }}
          </span>
        </template>
        <template #ops="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Popconfirm content="重置为 half-open：放行探测调用，成功则闭合；失败立即重新打开。" @confirm="resetCircuit(row.id, row.name)">
              <Button size="small" variant="text" :disabled="circuits[row.id] !== 'open'">重置熔断</Button>
            </Popconfirm>
            <Popconfirm
              content="停用该插件：卸载其扩展点装配（内核回退内置实现），保留配置；恢复需显式启用并重跑验证。"
              theme="warning"
              @confirm="forceOff(row.id, row.name)"
            >
              <Button size="small" variant="text">停用插件</Button>
            </Popconfirm>
          </div>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">错误率趋势（熔断判定依据）</h3>
        <OcChart
          type="line"
          :series="plugins.filter((p) => p.circuitState === 'open').map((p, i) => ({
            name: p.name,
            points: p.metrics.trend.map((y, j) => ({ x: `#${j + 1}`, y: Math.round(y) })),
            color: i === 0 ? '#d54941' : undefined,
          }))"
          :height="200"
          :threshold="{ value: 60, label: '错误率阈值参考', kind: 'max' }"
          aria-label="插件错误趋势与熔断阈值"
        />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">隔离日志（装载失败 / 越权 / 熔断）</h3>
        <div v-for="e in isolationLog" :key="e.id" class="oc-flex oc-flex--wrap" style="gap: 6px; padding: 5px 0; font-size: 12px; border-bottom: 1px dashed var(--oc-border)">
          <Tag size="small" :theme="e.kind === '熔断' ? 'danger' : e.kind === '越权拒绝' ? 'warning' : 'default'" variant="light-outline">{{ e.kind }}</Tag>
          <span class="oc-mono oc-muted">{{ e.subject }}</span>
          <span class="oc-grow oc-secondary oc-clamp-2">{{ e.detail }}</span>
          <CopyableId :id="`trace-iso-${e.id.slice(-6)}`" label="traceId" :short="12" />
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
          <OcIcon name="help" size="12px" /> 隔离语义：插件故障不拖垮内核；受影响扩展点失效并在界面显式标注（不静默失败）。
        </div>
      </div>
    </div>
  </div>
</template>
