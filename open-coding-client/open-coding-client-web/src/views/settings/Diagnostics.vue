<script setup lang="ts">
/**
 * 诊断（N-12）：装配计划树（含降级说明）/ 能力门控 / 插件健康 / 连接状态 / 最近错误 / 一键导出脱敏诊断包 / 治理与隐私开关。
 * 原则：降级必须显式可见；诊断包按白名单脱敏（密钥与内容类字段硬过滤）。溯源：卷 29 §4.8 / 卷 24 §4.9。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Switch, Table, Tag, Tree, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { extensionData } from '@/mock/data/extension';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const expanded = ref<(string | number)[]>(['kernel', 'model']);
const exporting = ref(false);
const bundleRef = ref('');
const telemetryL1 = ref(false);
const telemetryL2 = ref(false);
const telemetryL3 = ref(false);

/** 装配计划树：八段装配单元，每段带运行态与降级说明（降级不隐藏） */
const planNodes = [
  { value: 'kernel', label: '内核', status: '正常', tone: 'success', degrade: '插件进程外宿主可用；无降级' },
  { value: 'model', label: '模型网关', status: '降级', tone: 'warning', degrade: 'gemini-3-pro 熔断 open：端点已摘除，路由到备用模型并标注' },
  { value: 'context', label: '上下文', status: '正常', tone: 'success', degrade: '预估漂移 2.1%（≤5% 阈值），无降级' },
  { value: 'tools', label: '工具', status: '正常', tone: 'success', degrade: '12 族全部注册；网络工具受策略收窄' },
  { value: 'permission', label: '权限', status: '正常', tone: 'success', degrade: '决策链完整；yolo 档企业禁用' },
  { value: 'sandbox', label: '沙箱', status: '降级', tone: 'warning', degrade: '容器运行时不可用：L1 → L0+，网络与路径限制仍生效' },
  { value: 'events', label: '事件', status: '正常', tone: 'success', degrade: '消费者滞后 42s（阈值 120s）' },
  { value: 'persistence', label: '持久化', status: '正常', tone: 'success', degrade: '最近备份校验通过；无降级' },
];

const gates = [
  { key: 'vision', label: '多模态视觉输入', state: '可用', tone: 'success', note: '已探测；图片条目可直读' }, { key: 'network', label: '网络工具（web_fetch）', state: '受策略限制', tone: 'warning', note: '仅白名单域名；越界拒绝并审计' },
  { key: 'shell', label: '终端执行（pty）', state: '可用（L0+）', tone: 'warning', note: '沙箱降档后仍禁止写系统路径' }, { key: 'subagent', label: '子 Agent 派生', state: '可用', tone: 'success', note: '并发上限 4，预算信封独立计量' },
];

const pluginRows = computed(() => extensionData.plugins.slice(0, 5).map((p) => ({ id: p.id, name: p.name, health: p.health, circuit: p.circuitState, errors: p.metrics.errorTotal, reason: p.healthReason })));

const connections = computed(() => [
  { name: '内核', target: '127.0.0.1:8787', status: ui.connection === 'CONNECTED' ? '已连接' : ui.connection === 'RECONNECTING' ? '重连中' : '已断开', tone: ui.connection === 'CONNECTED' ? 'success' : ui.connection === 'RECONNECTING' ? 'warning' : 'danger' },
  { name: '工作区', target: 'local:/worktrees/payment-core/T-7f3a', status: '就绪', tone: 'success' },
  { name: '模型端点', target: 'anthropic / claude-sonnet-4.5', status: '可达（TTFB 612ms）', tone: 'success' },
  { name: '模型端点（备用）', target: 'vertex / gemini-3-pro', status: '熔断 open', tone: 'danger' },
]);

const errors = [
  { code: 'MODEL_RATE_LIMITED', detail: 'gpt-5.1 触发限流，已按指数退避重试（第 2/3 次）', at: '10:42:07', traceId: 'trace-9f21ab77' },
  { code: 'SANDBOX_TIER_DOWNGRADED', detail: '容器运行时不可用，沙箱 L1 → L0+（权限收窄，非放宽）', at: '10:36:51', traceId: 'trace-4f01ba7c' },
  { code: 'WORKSPACE_QUOTA_WARN', detail: '磁盘使用率 86%，超过 85% 预警线（未阻断）', at: '10:12:19', traceId: 'trace-ws-51d0' },
];

const columns = {
  plugin: [{ colKey: 'name', title: '插件', width: 180 }, { colKey: 'health', title: '健康', width: 90 }, { colKey: 'circuit', title: '熔断', width: 100 }, { colKey: 'reason', title: '原因 / 错误统计', ellipsis: true }],
  conn: [{ colKey: 'name', title: '通道', width: 140 }, { colKey: 'target', title: '目标', ellipsis: true }, { colKey: 'status', title: '状态', width: 170 }],
};

function exportBundle() { exporting.value = true;
  window.setTimeout(() => { exporting.value = false; bundleRef.value = 'bundle://diag/2026-09-21-51c1af';
    ui.track('settings.diagnostics.exported', { bundleRef: bundleRef.value });
    MessagePlugin.success('脱敏诊断包已生成：明文密钥与提示词正文已过滤，可安全外发'); }, 900);
}

onMounted(() => {
  window.setTimeout(() => { state.value = planNodes.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="诊断" volume="卷 29" manifest="N-12"
      desc="装配计划与降级、能力门控、插件健康、连接状态、最近错误与脱敏诊断包；遥测三级独立同意，默认全关。"
      cli="oc doctor --tree --capabilities --plugins --bundle --redact"
      :status="[{ label: `连接 ${ui.connection}`, theme: ui.connection === 'CONNECTED' ? 'success' : 'warning' }, { label: '遥测默认全关', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">重新采集</Button>
        <Popconfirm content="白名单保留：事件 ID、错误码、版本、装配计划、插件健康、连接状态；硬过滤：提示词正文、代码内容、密钥、路径原文（仅哈希）、用户标识。导出后仍可手动删除。" theme="warning" @confirm="exportBundle">
          <Button size="small" theme="primary" :loading="exporting">一键导出脱敏诊断包</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state" trace-id="trace-diag-51c1" :page-size="8"
      empty-title="装配计划为空" empty-desc="内核未上报任何装配单元（引导未完成或装配被中止），诊断不可用。"
      empty-action="重新装配" example-task="导出一次脱敏诊断包，确认 zip 内不含密钥与提示词正文"
      what="装配计划读取失败" why="内核装配状态上报通道中断（进程外宿主 IPC 断连）"
      how="可重试；失败时保留上一次成功采集的计划快照并标注时间"
      collapsed-summary="装配节点超过渲染阈值，深层子节点（工具族明细）已折叠。"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已触发重新装配（只读探测，不改业务数据）')"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="装配单元" :value="planNodes.length" unit="个" icon="layers" />
        <StatCard label="降级项" :value="planNodes.filter((n) => n.tone === 'warning').length" unit="项" icon="flag" hint="降级必须显式可见" />
        <StatCard label="插件异常" :value="pluginRows.filter((p) => p.health !== '就绪').length" unit="个" icon="extension" />
        <StatCard label="最近错误" :value="errors.length" unit="条" icon="bug" hint="每条可复制 traceId" />
      </div>

      <div class="oc-grid" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">装配计划与降级说明</div>
          <Tree :data="planNodes" :expanded="expanded" activable :transition="false" :keys="{ value: 'value', label: 'label' }" @update:expanded="(v: (string | number)[]) => (expanded = v)">
            <template #label="node">
              <span v-if="node.data" class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
                <span style="font-size: 12px">{{ node.data.label }}</span>
                <Tag size="small" :theme="node.data.tone as 'success' | 'warning'" variant="light-outline">{{ node.data.status }}</Tag>
                <span class="oc-muted" style="font-size: 11px">{{ node.data.degrade }}</span>
              </span>
              <span v-else class="oc-muted" style="font-size: 12px">{{ node.label }}</span>
            </template>
          </Tree>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">能力门控</div>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="g in gates" :key="g.key" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <Tag size="small" :theme="g.tone as 'success' | 'warning'" variant="light-outline">{{ g.state }}</Tag>
              <span style="font-size: 12px">{{ g.label }}</span><span class="oc-muted" style="font-size: 11px">{{ g.note }}</span>
            </div>
          </div>
          <div class="oc-divider" />
          <div class="oc-card__title">连接状态</div>
          <Table :data="connections" row-key="name" size="small" :columns="columns.conn" :pagination="undefined">
            <template #target="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.target }}</span></template>
            <template #status="{ row }"><Tag size="small" :theme="row.tone" variant="light-outline">{{ row.status }}</Tag></template>
          </Table>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">插件健康</div>
          <Table :data="pluginRows" row-key="id" size="small" :columns="columns.plugin" :pagination="undefined">
            <template #health="{ row }"><Tag size="small" :theme="row.health === '就绪' ? 'success' : row.health === '降级' ? 'warning' : 'danger'" variant="light-outline">{{ row.health }}</Tag></template>
            <template #circuit="{ row }"><Tag size="small" :theme="row.circuit === 'closed' ? 'success' : row.circuit === 'half-open' ? 'warning' : 'danger'" variant="light-outline">{{ row.circuit }}</Tag></template>
            <template #reason="{ row }"><Tooltip :content="row.reason"><span class="oc-muted" style="font-size: 12px">错误 {{ row.errors }} 次 · {{ row.reason }}</span></Tooltip></template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">最近错误（可复制 traceId）</div>
          <div class="oc-stack" style="gap: 8px">
            <div v-for="e in errors" :key="e.traceId" class="oc-stack" style="gap: 2px">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
                <OcIcon name="error" size="13px" color="var(--td-error-color)" />
                <span class="oc-mono" style="font-size: 11px">{{ e.code }}</span>
                <span class="oc-muted" style="font-size: 11px">{{ e.at }}</span><CopyableId :id="e.traceId" label="复制" />
              </div>
              <span style="font-size: 12px">{{ e.detail }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">治理与隐私开关（三级独立同意，默认全关）</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 16px">
          <div class="oc-flex" style="gap: 8px; align-items: center"><Switch v-model="telemetryL1" size="small" /><span style="font-size: 13px">L1 使用统计</span></div>
          <div class="oc-flex" style="gap: 8px; align-items: center"><Switch v-model="telemetryL2" size="small" /><span style="font-size: 13px">L2 性能采样（10%）</span></div>
          <div class="oc-flex" style="gap: 8px; align-items: center"><Switch v-model="telemetryL3" size="small" /><span style="font-size: 13px">L3 崩溃与错误（仅摘要）</span></div>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">开启后仍禁止：代码内容、提示词正文、密钥、路径原文与用户标识明文；企业基线可强制覆盖。</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc doctor bundle --redact --out diag.zip" />
          <CopyableId v-if="bundleRef" :id="bundleRef" label="复制诊断包引用" />
          <Tag v-if="bundleRef" size="small" theme="success" variant="light-outline">诊断包已生成（14 天后自动删除）</Tag>
        </div>
      </div>
    </StateShell>
  </div>
</template>
