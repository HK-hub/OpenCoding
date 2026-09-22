<script setup lang="ts">
/**
 * 失败接管工作台（N2-09）：ESCALATED / BLOCKED 队列 + 接管放行 / 放弃归档 / 一键修正 + backlog。
 * 溯源：卷 34 §5.4 异常分支 / §5.8 通知路由；BUILD-MANIFEST N2-09。
 * 铁律：接管请求固定「需处理」且不可静默（穿透静默时段）。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { automationData } from '@/mock/data/automation';
import type { TakeoverItem } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

const queue = ref<TakeoverItem[]>(automationData.takeovers.queue.map((q) => ({ ...q })));
const kindFilter = ref<'全部' | 'ESCALATED' | 'BLOCKED'>('全部');
const backlog = automationData.takeovers.backlog;
const routing = automationData.notificationRouting;

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onKind(v: unknown) {
  kindFilter.value = String(v) as '全部' | 'ESCALATED' | 'BLOCKED';
}

const rows = computed(() => (kindFilter.value === '全部' ? queue.value : queue.value.filter((q) => q.kind === kindFilter.value)));
const escalated = computed(() => queue.value.filter((q) => q.kind === 'ESCALATED').length);
const oldest = computed(() => Math.max(...queue.value.map((q) => Math.round((Date.now() - new Date(q.since).getTime()) / 60000)), 0));

const backlogSeries = computed(() => [
  { name: 'ESCALATED', points: backlog.map((b) => ({ x: b.week, y: b.escalatedCount })) },
  { name: 'BLOCKED', points: backlog.map((b) => ({ x: b.week, y: b.blockedCount })) },
]);

const columns = [
  { colKey: 'id', title: '接管项', width: 90, cell: 'id' },
  { colKey: 'runId', title: '运行', width: 120, cell: 'run' },
  { colKey: 'templateName', title: '模板', width: 130 },
  { colKey: 'kind', title: '类型', width: 120, cell: 'kind' },
  { colKey: 'reason', title: '原因（失败阶段 / 拦截原因）', ellipsis: true },
  { colKey: 'attempts', title: '尝试', width: 70 },
  { colKey: 'since', title: '待处理时长', width: 130, cell: 'since' },
  { colKey: 'op', title: '操作', width: 250, cell: 'op' },
];

function resume(row: TakeoverItem) {
  queue.value = queue.value.filter((q) => q.id !== row.id);
  MessagePlugin.success(`已放行 ${row.runId}：重新校验预算后恢复 RUNNING；接管人已记入审计（运行动作项）`);
}

function archive(row: TakeoverItem) {
  queue.value = queue.value.filter((q) => q.id !== row.id);
  ui.pushNotification({
    kind: 'task_failed', level: 'P1', title: '接管项已放弃归档',
    body: `${row.runId} 已落 CANCELLED，产物按策略归档（运行日志与报告保留，分支已丢弃）。`,
    actions: [{ label: '查看归档', path: '/automation/artifacts' }], aggregateKey: `takeover-${row.id}`, penetrateQuiet: false, channel: 'inapp',
  });
  MessagePlugin.warning(`已放弃并归档 ${row.runId}：状态落 CANCELLED，分支与临时产物丢弃（报告保留）`);
}

function fix(row: TakeoverItem) {
  MessagePlugin.success(`已生成一键修正：${row.oneClickFix}（执行前会再次展示影响面）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = queue.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="失败接管"
      desc="ESCALATED（连续失败熔断）与 BLOCKED（预授权越界 / 兼容不符 / 配额不足）队列；接管请求固定「需处理」且不可静默。"
      volume="卷 34" manifest="N2-09" cli="oc automation takeover list --state escalated,blocked"
      :status="[{ label: `${rows.length} 项待接管`, theme: rows.length ? 'warning' : 'success' }, { label: `最久 ${oldest} 分钟`, theme: oldest > 1440 ? 'danger' : 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="kindFilter" size="small" style="width: 150px" aria-label="按类型筛选" :options="[{ value: '全部', label: '全部类型' }, { value: 'ESCALATED', label: 'ESCALATED' }, { value: 'BLOCKED', label: 'BLOCKED' }]" @change="onKind" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在载入接管队列与 backlog…"
      empty-title="没有待接管项" empty-desc="所有 ESCALATED / BLOCKED 运行均已处置；新的接管请求会以「需处理」级别通知（不可静默）。"
      empty-action="查看运行历史" example-task="查看 backlog 中超过 SLA 的接管项并一键修正"
      what="接管队列加载失败" why="自动化运行存储不可达（接管队列依赖运行终态事件）"
      how="重试；队列数据已由通知通道保留，不会因加载失败而丢失" trace-id="trace-c40e13b9"
      :collapsed-summary="`接管项较多（${rows.length} 项），已折叠展示（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <Alert theme="warning" style="margin-bottom: 10px"
        message="接管请求不静默：级别固定「需处理」，渠道含 IM + 邮件 + Webhook，且穿透静默时段（22:00–08:00）。" />

      <div class="oc-grid oc-grid--4">
        <StatCard label="ESCALATED" :value="escalated" icon="error" :lower-is-better="true" hint="连续失败熔断，需人工放行或归档" />
        <StatCard label="BLOCKED" :value="queue.length - escalated" icon="lock" :lower-is-better="true" hint="预授权越界 / 兼容不符 / 配额不足（不消耗预算）" />
        <StatCard label="backlog 平均处置" :value="backlog[backlog.length - 1].avgHandleMinutes" unit="分钟" icon="time" :delta="-14.2" hint="近 4 周趋势" />
        <StatCard label="SLA 违约" :value="backlog.reduce((a, b) => a + b.slaBreach, 0)" icon="flag" :lower-is-better="true" hint="超过 24h 未处置即计入违约" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">backlog 趋势（近 4 周）</div>
          <OcChart type="stacked-bar" :series="backlogSeries" :height="200" aria-label="接管 backlog 趋势" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">通知路由（三级 → 渠道 / 合并 / 静默）</div>
          <div v-for="lv in routing.levels" :key="lv.level" class="oc-stack" style="gap: 2px; margin-bottom: 6px">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" :theme="lv.level === '需处理' ? 'danger' : lv.level === '需关注' ? 'warning' : 'default'" variant="light-outline">{{ lv.level }}</Tag>
              <span style="font-size: 12px">{{ lv.channels.join(' / ') }}</span>
            </div>
            <div class="oc-muted" style="font-size: 11px">合并：{{ lv.merge }} · 静默：{{ lv.quiet }}</div>
          </div>
          <div class="oc-muted" style="font-size: 12px">{{ routing.takeoverRule }}</div>
        </div>
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.id }}</span></template>
        <template #run="{ row }"><CopyableId :id="row.runId" label="复制 runId" /></template>
        <template #kind="{ row }">
          <Tag size="small" :theme="row.kind === 'ESCALATED' ? 'warning' : 'danger'" variant="light-outline">{{ row.kind }}</Tag>
        </template>
        <template #since="{ row }">
          <span :style="{ color: Math.round((Date.now() - new Date(row.since).getTime()) / 60000) > 1440 ? 'var(--oc-sev-error)' : undefined }">
            {{ Math.round((Date.now() - new Date(row.since).getTime()) / 60000) }} 分钟
          </span>
        </template>
        <template #op="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Popconfirm content="放行将重新校验预算信封；通过后运行从 ESCALATED 恢复 RUNNING，接管人记入审计。是否放行？" @confirm="resume(row)">
              <Button size="small" theme="primary" variant="outline">接管放行</Button>
            </Popconfirm>
            <Popconfirm content="放弃归档不可撤销：运行落 CANCELLED，分支与临时产物丢弃，仅保留运行日志与报告（已归档产物可导出）。" @confirm="archive(row)">
              <Button size="small" theme="danger" variant="outline">放弃归档</Button>
            </Popconfirm>
            <Button size="small" variant="text" @click="fix(row)">一键修正</Button>
          </div>
        </template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">建议修复与等价命令（一键修正）</div>
        <div v-for="row in rows.slice(0, 4)" :key="row.id" class="oc-stack" style="gap: 2px; margin-bottom: 8px">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag size="small" variant="outline">{{ row.id }}</Tag>
            <span style="font-size: 12px">{{ row.suggestedFix }}</span>
          </div>
          <CliHint :command="row.oneClickFix" />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          一键修正只生成建议与命令；执行前会再次展示影响面（不直接改动生产资源）。
        </div>
      </div>
    </StateShell>
  </div>
</template>
