<script setup lang="ts">
/**
 * 草稿收件箱（N3-03）：草稿卡（生成器标注 / 引用覆盖率 / 成本 / 状态）+ 采纳 / 编辑 / 驳回 / 误报。
 * 溯源：卷 35 §5.2 产出状态机 / C1–C8；BUILD-MANIFEST N3-03。
 * 铁律：产出是草稿（人工可校订、不自动合并）；驳回与误报回流评测集并触发两段式降权。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import type { IntelOutput, OutputStatus } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

const outputs = ref<IntelOutput[]>(intelData.outputs.map((o) => ({ ...o })));
const statusFilter = ref<'全部' | OutputStatus>('全部');
const capFilter = ref('全部');

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onStatus(v: unknown) {
  statusFilter.value = String(v) as '全部' | OutputStatus;
}
function onCap(v: unknown) {
  capFilter.value = String(v);
}

const rows = computed(() =>
  outputs.value.filter((o) => {
    if (statusFilter.value !== '全部' && o.status !== statusFilter.value) return false;
    if (capFilter.value !== '全部' && o.capabilityId !== capFilter.value) return false;
    return true;
  }),
);
const draftCount = computed(() => outputs.value.filter((o) => o.status === 'DRAFT').length);
const adoptedCount = computed(() => outputs.value.filter((o) => o.status === 'ADOPTED' || o.status === 'EDITED').length);
const lowCitation = computed(() => outputs.value.filter((o) => o.citationCoverage < 0.9).length);

const columns = [
  { colKey: 'title', title: '草稿', ellipsis: true },
  { colKey: 'capabilityName', title: '能力', width: 150 },
  { colKey: 'generator', title: '生成器（C1 归属标注）', width: 210, cell: 'gen' },
  { colKey: 'citationCoverage', title: '引用覆盖率', width: 130, cell: 'cov' },
  { colKey: 'costUsd', title: '成本', width: 90, cell: 'cost' },
  { colKey: 'status', title: '状态', width: 120, cell: 'status' },
  { colKey: 'op', title: '操作', width: 240, cell: 'op' },
];

const STATUS_THEME: Record<OutputStatus, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  DRAFT: 'primary', ADOPTED: 'success', EDITED: 'success', REJECTED: 'danger', SUPERSEDED: 'default', INGESTED: 'warning',
};

function act(row: IntelOutput, kind: '采纳' | '驳回' | '误报') {
  if (kind === '采纳') {
    row.status = 'ADOPTED';
    row.adoptedBy = '当前用户';
    MessagePlugin.success(`已采纳草稿「${row.title}」：仅登记采纳，不自动合并（合并权在人）`);
    return;
  }
  row.status = 'REJECTED';
  if (kind === '误报') {
    row.status = 'INGESTED';
    MessagePlugin.warning(`已标记误报：进入回灌队列 → 评测集用例 → 规则两段式降权（先降权，人工复核后停用）`);
    return;
  }
  MessagePlugin.warning(`已驳回草稿「${row.title}」：样本回流评测集（来源运行与生成器一并记录）`);
}

function edit(row: IntelOutput) {
  row.status = 'EDITED';
  MessagePlugin.success('已进入校订：人工修改优先，重生成不覆盖人工内容（冲突并排展示）');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = outputs.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="草稿收件箱"
      desc="所有增强产出都是草稿：标注生成器、带引用、人工可校订；采纳只登记不合并（不自动合并是硬约束）。"
      volume="卷 35" manifest="N3-03" cli="oc ai output list --status draft --with-citations"
      :status="[{ label: `${draftCount} 条待处理`, theme: draftCount ? 'warning' : 'success' }, { label: `${lowCitation} 条引用不足`, theme: lowCitation ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="statusFilter" size="small" style="width: 160px" aria-label="按状态筛选" :options="['全部', 'DRAFT', 'ADOPTED', 'EDITED', 'REJECTED', 'SUPERSEDED', 'INGESTED'].map((s) => ({ value: s, label: s }))" @change="onStatus" />
        <Select :value="capFilter" size="small" style="width: 190px" aria-label="按能力筛选" :options="[{ value: '全部', label: '全部能力' }, ...intelData.capabilities.map((c) => ({ value: c.id, label: c.name }))]" @change="onCap" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在拉取草稿与门禁结论…"
      empty-title="收件箱为空" empty-desc="该筛选下没有草稿；门禁拦截的产出不会出现在这里（见「门禁拦截报告」）。"
      empty-action="查看门禁拦截报告" example-task="对一条 PR 描述草稿执行「采纳」，并确认不会自动合并"
      what="草稿加载失败" why="产出载荷在对象存储中不可达（表内仅保留引用）"
      how="重试；拦截报告与门禁结论仍可查看（不输出半成品给人类）" trace-id="trace-0c93be44"
      :collapsed-summary="`草稿较多（${rows.length} 条），已折叠展示（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="router.push('/intel/gate-reports')" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="待处理草稿" :value="draftCount" icon="mail" :lower-is-better="true" hint="DRAFT 状态；低置信默认折叠" />
        <StatCard label="已采纳 / 校订" :value="adoptedCount" icon="check" :delta="5.6" :lower-is-better="false" hint="采纳率是四指标之一" />
        <StatCard label="引用覆盖率达标" :value="((outputs.length - lowCitation) / outputs.length) * 100" format="percent" icon="link" :target="90" hint="结论类输出必须带引用（C4）" />
        <StatCard label="草稿成本合计" :value="outputs.reduce((a, o) => a + o.costUsd, 0)" format="cost" icon="discount" :delta="-4.2" hint="每次运行上报成本（C5）" />
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined" style="margin-top: 12px">
        <template #gen="{ row }">
          <div class="oc-stack" style="gap: 0">
            <span class="oc-mono" style="font-size: 11px">{{ row.generator.model }}</span>
            <span class="oc-muted" style="font-size: 11px">{{ row.generator.promptVersion }}</span>
          </div>
        </template>
        <template #cov="{ row }">
          <span :style="{ color: row.citationCoverage < 0.9 ? 'var(--oc-sev-warn)' : undefined }">{{ (row.citationCoverage * 100).toFixed(0) }}%</span>
        </template>
        <template #cost="{ row }">${{ row.costUsd.toFixed(2) }}</template>
        <template #status="{ row }"><Tag size="small" :theme="STATUS_THEME[row.status as OutputStatus]" variant="light-outline">{{ row.status }}</Tag></template>
        <template #op="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Button size="small" variant="text" @click="router.push(`/intel/outputs/${row.id}`)">查看</Button>
            <Button size="small" variant="text" @click="edit(row)">编辑</Button>
            <Popconfirm content="采纳只登记结果，不会自动合并到主干（合并由人或 CI 门禁执行）。是否采纳？" @confirm="act(row, '采纳')">
              <Button size="small" variant="text">采纳</Button>
            </Popconfirm>
            <Popconfirm content="驳回样本将回流评测集（含来源运行与生成器版本），用于后续提示词与规则改进。是否驳回？" @confirm="act(row, '驳回')">
              <Button size="small" variant="text">驳回</Button>
            </Popconfirm>
            <Popconfirm content="标记误报会触发规则两段式降权：先降权，人工复核后停用。是否标记？" @confirm="act(row, '误报')">
              <Button size="small" variant="text">误报</Button>
            </Popconfirm>
          </div>
        </template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">冲突提示（C2：不得覆盖人类既有内容）<CliHint command="oc ai output conflicts --unresolved" /></div>
        <div v-for="o in outputs.filter((x) => x.conflictsWithHuman)" :key="o.id" class="oc-stack" style="gap: 2px; margin-bottom: 8px">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag size="small" theme="warning" variant="light-outline">与人工内容冲突</Tag>
            <span style="font-size: 13px">{{ o.title }}</span>
          </div>
          <span class="oc-muted" style="font-size: 12px">{{ o.conflictsWithHuman?.note }}</span>
        </div>
        <div v-if="!outputs.some((x) => x.conflictsWithHuman)" class="oc-muted">当前无未裁决冲突。</div>
      </div>
    </StateShell>
  </div>
</template>
