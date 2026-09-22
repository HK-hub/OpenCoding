<script setup lang="ts">
/**
 * 核心旅程 J1–J12（Y-03）：端到端验收清单（编号/名称/关键断言/覆盖端/最近执行结果）；
 * 每日结果热力图（12 行 × 最近 14 天，矩阵在视图内确定性生成）；失败旅程标红并可展开断言差异。
 * 溯源：卷 26 / BUILD-MANIFEST Y-03。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

const DAYS = ['08-30', '08-31', '09-01', '09-02', '09-03', '09-04', '09-05', '09-06', '09-07', '09-08', '09-09', '09-10', '09-11', '09-12'];
/** 周末不执行（矩阵值 0）；失败日（值 3）与最近一次执行结果一致 */
const WEEKEND_IDX = [0, 6, 7, 13];
const FAIL_DAYS: Record<string, number[]> = { J7: [5, 12], J11: [8, 12] };

interface Journey { key: string; name: string; assertions: string[]; surfaces: string[]; failNote: string }

const JOURNEYS: Journey[] = [
  { key: 'J1', name: '会话创建与首轮对话', assertions: ['首 token ≤10s', '会话中断后可恢复'], surfaces: ['CLI', '桌面', 'Web'], failNote: '' },
  { key: 'J2', name: '工具调用与结果回填', assertions: ['调用可审计（含参数摘要）', '失败可重试且不重复副作用'], surfaces: ['CLI', '桌面', 'Web'], failNote: '' },
  { key: 'J3', name: '人工审批链路（等待→批准→继续）', assertions: ['审批等待被记录', 'Agent 不得自行批准'], surfaces: ['桌面', 'Web'], failNote: '' },
  { key: 'J4', name: '长任务中断恢复（检查点续跑）', assertions: ['从最近检查点续跑', '不重复已完成的写入'], surfaces: ['CLI', '桌面'], failNote: '' },
  { key: 'J5', name: '工作区文件编辑与回滚', assertions: ['变更可 diff', '回滚原子且可验证'], surfaces: ['CLI', 'Web'], failNote: '' },
  { key: 'J6', name: 'Git 分支与提交自动化', assertions: ['提交签名有效', '冲突显式提示而非覆盖'], surfaces: ['CLI', '桌面'], failNote: '' },
  { key: 'J7', name: '多端状态一致', assertions: ['三端状态一致延迟 ≤1s', '冲突可解释且可重放'], surfaces: ['CLI', '桌面', 'Web'], failNote: 'Web 端事件延迟 3.2s（>1s），桌面端会话列表未刷新' },
  { key: 'J8', name: '成本估算与超支保护', assertions: ['超支前拦截', '拦截文案含提额路径'], surfaces: ['桌面', 'Web'], failNote: '' },
  { key: 'J9', name: '沙箱内高风险命令拒绝', assertions: ['拒绝并留痕（规范化路径）', '给出替代路径'], surfaces: ['CLI'], failNote: '' },
  { key: 'J10', name: '上下文压缩与引用保留', assertions: ['压缩后引用可跳转', '未决项不丢失'], surfaces: ['CLI', 'Web'], failNote: '' },
  { key: 'J11', name: '插件装载与扩展点调用', assertions: ['装载前权限校验', '扩展点失败必须隔离'], surfaces: ['桌面'], failNote: '钩子调用超时 8000ms（>5000ms 上限），失败未隔离导致面板卡顿 1.4s' },
  { key: 'J12', name: '分发出的更新与回滚', assertions: ['制品签名校验', '回滚 ≤2 分钟'], surfaces: ['桌面', 'Web'], failNote: '' },
];

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(9);
const expandedKey = ref('J7');
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '旅程执行器不可达（journey-runner 三端探针心跳丢失）'));

/** 热力图矩阵：12 行 × 14 天；1=通过 / 3=失败 / 0=未执行（周末） */
const matrix = computed(() => JOURNEYS.map((j) =>
  DAYS.map((_, d) => (WEEKEND_IDX.includes(d) ? 0 : FAIL_DAYS[j.key]?.includes(d) ? 3 : 1)),
));
const columns = [
  { colKey: 'key', title: '编号', width: 70 },
  { colKey: 'name', title: '名称', width: 230 },
  { colKey: 'assertions', title: '关键断言', width: 300 },
  { colKey: 'surfaces', title: '覆盖端', width: 190 },
  { colKey: 'result', title: '最近执行结果', width: 130 },
  { colKey: 'ops', title: '断言差异', width: 100 },
];
const rows = computed(() => JOURNEYS.map((j) => ({ ...j, result: FAIL_DAYS[j.key]?.includes(12) ? '失败' : '通过' })));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const failedJourneys = computed(() => rows.value.filter((r) => r.result === '失败'));
const expanded = computed(() => JOURNEYS.find((j) => j.key === expandedKey.value));
const assertionTotal = computed(() => JOURNEYS.reduce((a, j) => a + j.assertions.length, 0));

/** 已订阅每日结果的旅程（ref）：key → 订阅时间；用于展开项标注与订阅计数 */
const subscriptions = ref<Record<string, string>>({});
const subscribedKeys = computed(() => Object.keys(subscriptions.value));

const headerStatus = computed(() => {
  const chips: { label: string; theme: 'primary' | 'danger' | 'success' }[] = [
    { label: `旅程 ${JOURNEYS.length} 条`, theme: 'primary' },
    { label: `失败 ${failedJourneys.value.length} 条`, theme: failedJourneys.value.length ? 'danger' : 'success' },
  ];
  if (subscribedKeys.value.length) chips.push({ label: `已订阅 ${subscribedKeys.value.length} 条每日结果`, theme: 'success' });
  return chips;
});

/** 订阅当前展开旅程的每日结果：写入订阅列表并打时间戳（失败时通知责任人与值班） */
function subscribeDaily() {
  const j = expanded.value;
  if (!j) return;
  const at = subscriptions.value[j.key];
  if (at) {
    MessagePlugin.info(`「${j.key}」已订阅每日结果（订阅于 ${new Date(at).toLocaleString('zh-CN')}），无需重复订阅`);
    return;
  }
  subscriptions.value = { ...subscriptions.value, [j.key]: new Date().toISOString() };
  MessagePlugin.success(`已订阅 ${j.key} 的每日结果：失败时通知责任人与值班`);
}

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = JOURNEYS.length > pageSize.value ? 'EDGE_DATA' : JOURNEYS.length ? 'NORMAL' : 'EMPTY'; }, 240);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="核心旅程 J1–J12"
      desc="端到端验收以用户旅程为单位：每条旅程在 CLI / 桌面 / Web 声明覆盖端与关键断言；每日全量跑，失败旅程必须展开断言差异并绑定修复。"
      volume="卷 26"
      manifest="Y-03"
      cli="oc quality journeys list --daily && oc quality journeys show J7 --show-assert-diff"
      :status="headerStatus"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="refresh">重新加载</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="旅程数" :value="JOURNEYS.length" format="number" icon="sitemap" hint="覆盖首轮对话/工具/审批/恢复等主干" />
      <StatCard label="断言总数" :value="assertionTotal" format="number" icon="check" hint="每条断言均可自动判定或人工复核" />
      <StatCard label="最近执行通过" :value="JOURNEYS.length - failedJourneys.length" format="number" icon="task-checked" hint="09-11 全量执行（周末不跑）" />
      <StatCard label="失败旅程" :value="failedJourneys.length" format="number" icon="error" :lower-is-better="true" hint="J7 多端一致 / J11 插件隔离：已绑定修复" />
    </div>

    <StateShell
      :state="state"
      empty-title="旅程清单为空"
      empty-desc="未读取到旅程定义（验收清单可能在初始化中）。缺少旅程定义时发布检查单记为未通过。"
      empty-action="重新拉取旅程清单"
      example-task="展开 J7 查看 Web 端事件延迟 3.2s 的断言差异"
      what="旅程结果加载失败"
      :why="err.message"
      how="可重试；三端探针独立重试，单端失败不掩盖其他端的真实结论。"
      :trace-id="err.traceId"
      :collapsed-summary="`共 ${rows.length} 条旅程，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize = rows.length"
      @empty-action="refresh"
    >
      <div class="oc-card">
        <div class="oc-card__title">旅程清单（点击行展开断言差异）</div>
        <Table row-key="key" size="small" :data="shown" :columns="columns" @row-click="(ctx: { row: unknown }) => (expandedKey = (ctx.row as { key: string }).key)">
          <template #key="{ row }">
            <b class="oc-mono" :style="row.result === '失败' ? 'color: var(--td-error-color)' : ''">{{ row.key }}</b>
          </template>
          <template #assertions="{ row }">
            <div v-for="a in row.assertions" :key="a" class="oc-secondary" style="font-size: 12px">· {{ a }}</div>
          </template>
          <template #surfaces="{ row }">
            <div class="oc-flex oc-flex--wrap" style="gap: 4px">
              <Tag v-for="s in row.surfaces" :key="s" size="small" variant="light-outline" :theme="s === 'CLI' ? 'default' : s === '桌面' ? 'primary' : 'success'">{{ s }}</Tag>
            </div>
          </template>
          <template #result="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.result === '通过' ? 'success' : 'danger'">{{ row.result }}</Tag>
          </template>
          <template #ops="{ row }">
            <Button size="small" variant="text" @click.stop="expandedKey = row.key">{{ row.result === '失败' ? '展开差异' : '查看断言' }}</Button>
          </template>
        </Table>
        <CliHint command="oc quality journeys run --id J7 --surfaces cli,desktop,web --trace" label="单旅程重跑" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">每日结果热力图（行 = J1–J12，列 = 08-30 → 09-12；深色 = 当日失败，浅色 = 通过，空白 = 未执行）</div>
        <OcChart type="heatmap" :rows="JOURNEYS.map((j) => j.key)" :columns="DAYS" :matrix="matrix" :height="330" aria-label="旅程每日结果热力图" />
        <div class="oc-muted" style="font-size: 12px">周末（08-30 / 09-05 / 09-06 / 09-12）不执行；失败日与「最近执行结果」列一致，避免图表与表格结论互相打架。</div>
      </div>

      <div v-if="expanded" class="oc-card" :style="expanded.failNote ? 'margin-top: 12px; border-left: 3px solid var(--td-error-color)' : 'margin-top: 12px'">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">断言差异 · {{ expanded.key }} {{ expanded.name }}</div>
          <span class="oc-flex" style="gap: 6px">
            <Tag v-if="subscriptions[expanded.key]" size="small" theme="success" variant="light-outline">已订阅（每日）</Tag>
            <Tag size="small" variant="light-outline" :theme="expanded.failNote ? 'danger' : 'success'">{{ expanded.failNote ? '存在差异' : '全部一致' }}</Tag>
          </span>
        </div>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'expect', label: '期望断言', value: expanded.assertions.join('；') },
            { key: 'actual', label: '实际观测', value: expanded.failNote || '与期望一致（三端探针全部通过）' },
            { key: 'env', label: '执行环境', value: '三端探针 + 内网 mock 端点（不触真实模型配额）' },
            { key: 'owner', label: '归属与修复', value: expanded.failNote ? '已绑定修复项：事件扇出改增量推送 + 扩展点失败强制隔离（W38 复跑验证）' : '无待修复项' },
          ]"
        />
        <div class="oc-flex" style="margin-top: 8px; gap: 6px">
          <CopyableId :id="`trace-journey-${expanded.key}-0911`" label="复制运行 traceId" />
          <Button size="small" variant="outline" @click="subscribeDaily">{{ subscriptions[expanded.key] ? '已订阅（每日）' : '订阅该旅程结果' }}</Button>
        </div>
      </div>

      <div v-if="subscribedKeys.length" class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">每日结果订阅（{{ subscribedKeys.length }} 条）</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Tag v-for="k in subscribedKeys" :key="k" size="small" theme="success" variant="light-outline">
            {{ k }} · 每日 · 订阅于 {{ new Date(subscriptions[k]).toLocaleString('zh-CN') }}
          </Tag>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">订阅后每日全量执行结果推送给责任人与值班；失败时额外通知（含断言差异与 traceId）。</div>
      </div>
    </StateShell>
  </div>
</template>
