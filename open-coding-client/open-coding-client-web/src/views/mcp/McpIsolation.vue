<script setup lang="ts">
/**
 * MCP 故障隔离与熔断（C-11）：超时 / 并发 / 熔断（5 次 / 60s）/ 输出限额 / 重启退避。
 * 溯源：卷 09 D-MCP-8；熔断打开后该服务器扩展点停用（工具不可用），可半开探测或手动恢复。
 */
import { computed, ref } from 'vue';
import { Alert, Button, Input, InputNumber, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { MCP_STATE_THEME, fmtTime, useExtList, type TagTheme } from '@/components/extension/useExtList';

const servers = extensionData.mcpServers;
const { keyword, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(servers, {
  persistKey: 'mcp-isolation',
  pageSize: 8,
  match: (s, kw) => !kw || `${s.serverId}${s.name}${s.state}`.toLowerCase().includes(kw),
});

/** 每服务器隔离参数（本地可调；影响后续调用，热生效无需重启内核） */
const overrides = ref<Record<string, { timeoutMs: number; concurrencyMax: number; outputQuotaKb: number }>>(
  Object.fromEntries(servers.map((s) => [s.serverId, { ...s.limits }])),
);
const circuitStates = ref<Record<string, string>>(Object.fromEntries(servers.map((s) => [s.serverId, s.circuitBreaker.state])));

const openCircuits = computed(() => servers.filter((s) => circuitStates.value[s.serverId] === 'open'));

/** 自动重启总开关：暂停后全部服务器仅保留手动重试入口（已打开熔断的手动重置不受影响） */
const autoRestartPaused = ref(false);

/** 手动重试记录：不等待退避窗口的即时重试逐条留痕（含服务器与时间） */
const retryRecords = ref<{ serverId: string; name: string; at: string }[]>([]);

/** 停止 / 恢复全部自动重启：翻转页面状态与按钮文案，并提示影响面 */
function toggleAutoRestart() {
  autoRestartPaused.value = !autoRestartPaused.value;
  if (autoRestartPaused.value) {
    MessagePlugin.warning(`已停止全部重启重试：${servers.length} 个服务器的自动重启已暂停（仅保留手动重试入口）`);
  } else {
    MessagePlugin.success('已恢复自动重启：按指数退避继续重试（上限 5 次后告警）');
  }
}

/** 手动重试：不等待退避窗口立即触发一次，就地累加该服务器重试次数并写入重试记录 */
function manualRetry(serverId: string, name: string) {
  const s = servers.find((x) => x.serverId === serverId);
  if (!s) return;
  s.restart.total += 1;
  retryRecords.value.unshift({ serverId, name, at: new Date().toLocaleString('zh-CN') });
  MessagePlugin.success(`已触发 ${name} 手动重试：不等待退避窗口，累计 ${s.restart.total} 次（已记入重试记录）`);
}

function resetCircuit(serverId: string, name: string) {
  circuitStates.value[serverId] = 'half-open';
  MessagePlugin.warning(`${name} 熔断已重置为 half-open：将放行 1 次探测调用，成功则闭合，失败则再次打开（避免风暴）`);
}

function applyLimits(serverId: string) {
  const o = overrides.value[serverId];
  MessagePlugin.success(`已应用隔离参数：${serverId} 超时 ${o.timeoutMs}ms · 并发 ${o.concurrencyMax} · 输出限额 ${o.outputQuotaKb}KB`);
}

function stTheme(v: string): TagTheme {
  return (MCP_STATE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

const columns = [
  { colKey: 'server', title: '服务器', width: 220 },
  { colKey: 'state', title: '状态', width: 120 },
  { colKey: 'limits', title: '超时 / 并发 / 输出限额', width: 300 },
  { colKey: 'circuit', title: '熔断（5 次 / 60s）', width: 220 },
  { colKey: 'restart', title: '重启与退避', width: 180 },
  { colKey: 'ops', title: '操作', width: 170 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="故障隔离与熔断"
      desc="每服务器独立执行域：单点故障不拖垮内核；熔断打开后该服务器能力停用并显式标注（不静默失败）。"
      volume="卷 09" manifest="C-11" cli="oc mcp isolation --set <server>.timeoutMs=30000"
      :status="[
        { label: `熔断打开 ${openCircuits.length}`, theme: openCircuits.length ? 'danger' : 'success' },
        { label: autoRestartPaused ? '自动重启已暂停' : '参数热生效', theme: autoRestartPaused ? 'warning' : 'primary' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="toggleAutoRestart">{{ autoRestartPaused ? '恢复重试' : '停止自动重启' }}</Button>
        <Button size="small" variant="text" @click="reload">重载</Button>
      </template>
    </PageHeader>

    <Alert
      v-if="openCircuits.length"
      theme="error"
      :message="`${openCircuits.map((s) => s.name).join('、')} 熔断已打开：其工具从后续轮次上下文移除`"
      description="原因见下表；探测半开后自动恢复，或手动重置为 half-open（放行单次探测）。注意：熔断期间调用记录为 circuit-open，外发字节 0。"
    />

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="过滤服务器名 / 状态" clearable style="width: 260px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="8"
      empty-title="没有可配置的服务器"
      empty-desc="隔离参数仅对已配置的 MCP 服务器生效；先添加服务器再调整超时与并发。"
      empty-action="添加服务器"
      example-task="为 stdio 服务器设置 30s 超时与并发 4"
      what="隔离参数加载失败"
      why="本地隔离配置 schema 校验失败（timeoutMs 非法）；已回退为默认参数。"
      how="可重试；或重置该服务器参数为默认值。"
      trace-id="trace-mcp-iso-66d0"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="MessagePlugin.info('已跳转添加服务器向导（等价命令 oc mcp add）')"
    >
      <Table row-key="serverId" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #server="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.name }}</span>
            <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.serverId }} · {{ row.transport }}</span>
          </div>
        </template>
        <template #state="{ row }">
          <Tag size="small" :theme="stTheme(row.state)" variant="light-outline">{{ row.state }}</Tag>
        </template>
        <template #limits="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <InputNumber v-model="overrides[row.serverId].timeoutMs" size="small" :min="1000" :max="120000" :step="1000" style="width: 120px" />
            <InputNumber v-model="overrides[row.serverId].concurrencyMax" size="small" :min="1" :max="16" style="width: 90px" />
            <InputNumber v-model="overrides[row.serverId].outputQuotaKb" size="small" :min="16" :max="4096" :step="16" style="width: 100px" />
            <Button size="small" variant="text" @click="applyLimits(row.serverId)">应用</Button>
          </div>
          <span class="oc-muted" style="font-size: 11px">单位：ms / 并发数 / KB（超出外置为工件）</span>
        </template>
        <template #circuit="{ row }">
          <div class="oc-stack" style="gap: 3px">
            <Tag
              size="small"
              :theme="circuitStates[row.serverId] === 'open' ? 'danger' : circuitStates[row.serverId] === 'half-open' ? 'warning' : 'success'"
              variant="light-outline"
            >
              {{ circuitStates[row.serverId] }}（失败 {{ row.circuitBreaker.failures }} / 窗口 {{ row.circuitBreaker.windowSec }}s）
            </Tag>
            <Tooltip :content="row.circuitBreaker.reason">
              <span class="oc-muted oc-clamp-2" style="font-size: 11px; max-width: 190px">{{ row.circuitBreaker.reason }}</span>
            </Tooltip>
          </div>
        </template>
        <template #restart="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">累计 {{ row.restart.total }} 次 · 退避 {{ row.restart.backoffSec }}s</span>
            <span v-if="autoRestartPaused" class="oc-muted" style="font-size: 11px">自动重启已暂停（仅手动重试）</span>
            <span v-else class="oc-muted" style="font-size: 11px">下次重试：{{ fmtTime(row.restart.nextRetryAt) }}（指数递增，上限 5 次后告警）</span>
          </div>
        </template>
        <template #ops="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Popconfirm
              content="重置为 half-open：放行 1 次探测调用，成功则闭合；失败则立即重新打开（避免请求风暴）。"
              @confirm="resetCircuit(row.serverId, row.name)"
            >
              <Button size="small" variant="text" :disabled="circuitStates[row.serverId] !== 'open'">重置熔断</Button>
            </Popconfirm>
            <Button size="small" variant="text" @click="manualRetry(row.serverId, row.name)">手动重试</Button>
          </div>
        </template>
      </Table>
    </StateShell>

    <div class="oc-card">
      <h3 class="oc-card__title">
        隔离日志
        <span class="oc-muted" style="font-size: 12px">熔断 / 隔离 / 重启均留痕，可回溯到诊断建议</span>
      </h3>
      <div v-for="s in servers.filter((x) => x.circuitBreaker.state !== 'closed' || x.state === 'Failed')" :key="s.serverId" class="oc-flex oc-flex--wrap" style="gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--oc-border)">
        <Tag size="small" :theme="s.state === 'Failed' ? 'danger' : 'warning'" variant="light-outline">
          {{ s.state === 'Failed' ? 'isolated' : 'circuit' }}
        </Tag>
        <span class="oc-mono" style="font-size: 12px">{{ s.name }}</span>
        <span class="oc-grow oc-secondary" style="font-size: 12px">{{ s.circuitBreaker.reason }}</span>
        <CopyableId :id="`trace-mcp-iso-${s.serverId.slice(-4)}`" label="traceId" :short="14" />
      </div>
      <div v-if="retryRecords.length" style="margin-top: 8px">
        <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">手动重试记录（{{ retryRecords.length }}）</div>
        <div v-for="(r, i) in retryRecords" :key="i" class="oc-flex oc-flex--wrap" style="gap: 8px; padding: 4px 0; font-size: 12px">
          <Tag size="small" variant="outline">手动</Tag>
          <span class="oc-mono">{{ r.name }}</span>
          <span class="oc-muted oc-grow">{{ r.at }} · 不等待退避窗口（{{ r.serverId }}）</span>
        </div>
      </div>
      <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
        <OcIcon name="secured" size="12px" /> 隔离后内核不受影响：其它服务器与内置工具照常工作；受影响步骤在计划中显式标注「能力缺失」。
      </div>
    </div>
  </div>
</template>
