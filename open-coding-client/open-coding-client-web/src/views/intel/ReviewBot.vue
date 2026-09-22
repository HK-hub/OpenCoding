<script setup lang="ts">
/**
 * 审查机器人（N3-05）：发现列表（ruleId / 位置 / 严重度 / 置信度 / 依据 / 修复建议）+ SARIF 导出 + 置信度折叠。
 * 溯源：卷 35 §5.3 ②；BUILD-MANIFEST N3-05。
 * 契约：规则通道确定性优先；模型通道必须给依据（引用行 + 规则名）；低置信默认折叠，不阻塞合并。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import type { IntelFinding } from '@/mock/data/automation';
import { downloadText } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const findings = ref<IntelFinding[]>(intelData.findings.filter((f) => f.capabilityId === 'review.bot'));
const sevFilter = ref<'全部' | 'error' | 'warn' | 'info'>('全部');
const foldLow = ref(true);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onSev(v: unknown) {
  sevFilter.value = String(v) as typeof sevFilter.value;
}
function onFold(v: unknown) {
  foldLow.value = Boolean(v);
}

const rows = computed(() =>
  findings.value.filter((f) => {
    if (sevFilter.value !== '全部' && f.severity !== sevFilter.value) return false;
    if (foldLow.value && f.confidence === '低') return false;
    return true;
  }),
);
const errorCount = computed(() => findings.value.filter((f) => f.severity === 'error').length);
const fpCount = computed(() => findings.value.filter((f) => f.falsePositive).length);
const foldedCount = computed(() => (foldLow.value ? findings.value.filter((f) => f.confidence === '低').length : 0));
const confValues = computed(() => ['高', '中', '低'].map((c) => ({ name: `${c}置信`, value: findings.value.filter((f) => f.confidence === c).length })));

const columns = [
  { colKey: 'severity', title: '严重度', width: 90, cell: 'sev' },
  { colKey: 'ruleId', title: 'ruleId / 通道', width: 250, cell: 'rule' },
  { colKey: 'location', title: '位置', width: 230, cell: 'loc' },
  { colKey: 'confidence', title: '置信度', width: 100, cell: 'conf' },
  { colKey: 'basis', title: '依据（引用行 + 规则名）', ellipsis: true },
  { colKey: 'suggestion', title: '修复建议', ellipsis: true },
  { colKey: 'op', title: '处置', width: 90, cell: 'op' },
];

const SEV_THEME: Record<string, 'danger' | 'warning' | 'default'> = { error: 'danger', warn: 'warning', info: 'default' };
const CONF_THEME: Record<string, 'success' | 'warning' | 'default'> = { 高: 'success', 中: 'warning', 低: 'default' };

function markFp(row: IntelFinding) {
  row.falsePositive = true;
  MessagePlugin.warning(`已标记误报：${row.ruleId} → 两段式降权（先降权，人工复核后停用）`);
}

/** 严重度 → SARIF level 映射（CI 消费口径：error / warning / note） */
const SARIF_LEVEL: Record<string, 'error' | 'warning' | 'note'> = { error: 'error', warn: 'warning', info: 'note' };

/** 导出 SARIF 2.1.0：CI 可直接消费；导出当前视图（严重度筛选 + 低置信折叠后的可见发现） */
function exportSarif() {
  const exported = rows.value;
  const ruleIds = [...new Set(exported.map((f) => f.ruleId))];
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'OpenCoding ReviewBot',
            informationUri: 'https://opencoding.local/docs/review-bot',
            rules: ruleIds.map((id) => ({ id, name: id })),
          },
        },
        // 导出即当前视图：筛选与折叠口径随报告落盘，避免 CI 侧误判「已全量检查」
        properties: {
          severityFilter: sevFilter.value,
          lowConfidenceFolded: foldLow.value,
          foldedCount: foldedCount.value,
          exportedResults: exported.length,
          channelNote: '规则通道确定性优先；模型通道发现必须给依据（引用行 + 规则名），无依据发现被引用门禁拦截',
        },
        results: exported.map((f) => ({
          ruleId: f.ruleId,
          level: SARIF_LEVEL[f.severity],
          message: { text: `[${f.channel}] ${f.basis}｜修复建议：${f.suggestion}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.location.file },
                region: { startLine: f.location.line },
              },
            },
          ],
          properties: {
            confidence: f.confidence,
            channel: f.channel,
            falsePositive: f.falsePositive,
            suggestion: f.suggestion,
            threadId: f.threadId ?? null,
          },
        })),
      },
    ],
  };
  const file = downloadText(JSON.stringify(sarif, null, 2), `oc-intel-review-sarif-${new Date().toISOString().slice(0, 10)}.sarif`);
  MessagePlugin.success(`已导出 SARIF：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = findings.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="审查机器人"
      desc="规则通道（确定性清单）+ 模型通道（必须给依据）；低置信默认折叠，不阻塞合并；高置信安全问题可请求变更但需人工确认。"
      volume="卷 35" manifest="N3-05" cli="oc ai review --pr 4815 --export sarif"
      :status="[{ label: `${errorCount} 个 error`, theme: errorCount ? 'danger' : 'success' }, { label: `${foldedCount} 条低置信已折叠`, theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="sevFilter" size="small" style="width: 130px" aria-label="按严重度筛选" :options="['全部', 'error', 'warn', 'info'].map((s) => ({ value: s, label: s }))" @change="onSev" />
        <Button size="small" variant="outline" @click="exportSarif">导出 SARIF</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在运行规则通道与模型通道…"
      empty-title="暂无发现" empty-desc="该 PR 尚无审查发现；分析失败时会产出「未完成分析」标注，不会给出错误结论。"
      empty-action="对最近 PR 触发审查" example-task="查看高置信 secret-in-diff 发现，并用「请修复」驱动一次真实修复"
      what="审查结果加载失败" why="单轮分析超时（已保留已产出发现，线程可续）"
      how="重试或继续该线程；不会用「分析失败」冒充「无问题」" trace-id="trace-77be1044"
      :collapsed-summary="`发现较多（${rows.length} 条），低置信已折叠（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="foldLow = false"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="发现总数" :value="findings.length" icon="bug" hint="规则通道 + 模型通道合计" />
        <StatCard label="error 级" :value="errorCount" icon="error" :lower-is-better="true" hint="高置信安全问题可请求变更（需人工确认）" />
        <StatCard label="已标记误报" :value="fpCount" icon="close" :lower-is-better="true" hint="回流评测集并触发规则降权" />
        <StatCard label="置信度分布" :value="`${findings.filter((f) => f.confidence === '高').length} 高 / ${findings.filter((f) => f.confidence === '中').length} 中 / ${findings.filter((f) => f.confidence === '低').length} 低`" format="raw" icon="chart-pie" hint="低置信默认折叠（不打扰）" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">置信度分布与折叠策略</div>
          <OcChart type="donut" :values="confValues" :height="190" aria-label="置信度分布" />
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <Switch :value="foldLow" size="small" @change="onFold" />
            <span style="font-size: 12px">折叠低置信发现（默认开启；折叠不等于丢弃，可展开查看）</span>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">通道说明与 SARIF<CliHint command="oc ai review rules --pack org-default@3" /></div>
          <div class="oc-stack" style="gap: 6px; font-size: 13px">
            <span>· 规则通道：确定性规则清单（可枚举），发现可直接定位到规则与行号</span>
            <span>· 模型通道：必须给依据（引用行 + 规则名），无依据发现被引用门禁拦截</span>
            <span>· 合并策略：不自动合并；低置信不阻塞合并，高置信安全问题请求变更需人工确认</span>
            <span>· 误报：两段式降权（先降权 → 人工复核后停用），降权记录可查</span>
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Tag size="small" variant="outline">SARIF 2.1.0</Tag>
            <Tag size="small" variant="outline">内联评论（单条更新，不重复创建）</Tag>
          </div>
        </div>
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #sev="{ row }"><Tag size="small" :theme="SEV_THEME[row.severity]" variant="light-outline">{{ row.severity }}</Tag></template>
        <template #rule="{ row }">
          <div class="oc-stack" style="gap: 0">
            <span class="oc-mono" style="font-size: 11px">{{ row.ruleId }}</span>
            <span class="oc-muted" style="font-size: 11px">{{ row.channel }}</span>
          </div>
        </template>
        <template #loc="{ row }">
          <span class="oc-mono" style="font-size: 11px">{{ row.location.file }}:{{ row.location.line }}</span>
        </template>
        <template #conf="{ row }"><Tag size="small" :theme="CONF_THEME[row.confidence]" variant="light-outline">{{ row.confidence }}</Tag></template>
        <template #op="{ row }">
          <Button v-if="!row.falsePositive" size="small" variant="text" @click="markFp(row)">标记误报</Button>
          <Tag v-else size="small" theme="default" variant="outline">已误报</Tag>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
