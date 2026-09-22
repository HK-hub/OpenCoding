<script setup lang="ts">
/**
 * 实验登记册（U-02）：12 个方向的统一模板登记 + 级别/负责人过滤 + 登记向导。
 * 溯源：卷 25 §4 统一模板字段；BUILD-MANIFEST U-02。
 * 硬性门禁：level 为 beta/ga 时 exitCriteria 必填，缺失则字段级阻止（无退出条件不得进 beta）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { frontierData } from '@/mock/data/automation';
import type { Experiment, ExperimentLevel } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const rows = ref<Experiment[]>(frontierData.experiments.map((e) => ({ ...e })));
const levelFilter = ref<'全部' | ExperimentLevel>('全部');
const ownerFilter = ref('全部');
const owners = Array.from(new Set(rows.value.map((e) => e.owner)));
const filtered = computed(() =>
  rows.value.filter((e) => (levelFilter.value === '全部' || e.level === levelFilter.value) && (ownerFilter.value === '全部' || e.owner === ownerFilter.value)),
);

const LEVEL_THEME: Record<ExperimentLevel, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  lab: 'default', internal: 'primary', beta: 'warning', ga: 'success', dropped: 'danger', deprecated: 'danger',
};
const columns = [
  { colKey: 'id', title: '编号', width: 96 }, { colKey: 'title', title: '标题', width: 160, ellipsis: true },
  { colKey: 'hypothesis', title: '假设（若 X 则 Y，因为 Z）', ellipsis: true },
  { colKey: 'level', title: '级别', width: 108, cell: 'level' }, { colKey: 'owner', title: '负责人', width: 90 },
  { colKey: 'reviewDate', title: '评审日期', width: 110, cell: 'date' }, { colKey: 'successRatio', title: '成功率', width: 92, cell: 'ratio' },
  { colKey: 'costSpent', title: '成本（已用/预算）', width: 140, cell: 'cost' },
];

/** 登记向导：统一模板 13 字段（scope/successCriteria/risks 以逗号分隔录入为数组） */
const open = ref(false);
const formError = ref('');
const exitError = ref('');
const form = ref({
  id: 'D-FR-13', title: '', hypothesis: '', entry: '', scope: '', success: '', risks: '', exit: '',
  level: 'lab' as ExperimentLevel, owner: '', reviewDate: '', metricsRef: '', budget: 12,
});
const levelOptions = ['lab', 'internal', 'beta', 'ga'].map((l) => ({ value: l, label: l }));
function onLevel(v: unknown) {
  form.value.level = String(v) as ExperimentLevel;
}

function openDialog(presetBeta = false) {
  formError.value = '';
  exitError.value = '';
  form.value = { id: `D-FR-${rows.value.length + 1}`, title: '', hypothesis: '', entry: '', scope: '', success: '', risks: '', exit: '',
    level: presetBeta ? 'beta' : 'lab', owner: owners[0] ?? '沈亦舟', reviewDate: '2026-12-31', metricsRef: 'metrics://frontier/new?board=experiments', budget: 12 };
  open.value = true;
}

function toList(text: string): string[] {
  return text.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
}

function submit() {
  // 1. 必填字段校验（假设与成功判据是 lab 入口条件，缺失不允许登记）
  if (!form.value.title.trim() || !form.value.hypothesis.trim() || !form.value.success.trim()) {
    formError.value = '标题 / 假设 / 成功判据为必填：未书面化假设与判据的方向不允许登记（lab 入口条件）。';
    return;
  }
  // 2. 硬性门禁：beta 及以上必须有退出条件，缺失时字段级阻止并说明原因
  if ((form.value.level === 'beta' || form.value.level === 'ga') && !form.value.exit.trim()) {
    exitError.value = '缺退出条件（exitCriteria）：进入 beta 必须写明「触发条件 + 回退动作」（如：连续 2 个月指标 < 阈值 → 回退基线），否则实验无法退出。';
    return;
  }
  // 3. 写入登记册（实验默认用户可关闭、数据进独立命名空间）
  rows.value.unshift({
    id: form.value.id, title: form.value.title, hypothesis: form.value.hypothesis, entry: form.value.entry, scope: toList(form.value.scope),
    successCriteria: toList(form.value.success), risks: toList(form.value.risks), exitCriteria: form.value.exit, level: form.value.level, owner: form.value.owner,
    reviewDate: form.value.reviewDate, metricsRef: form.value.metricsRef, budget: { usd: form.value.budget, spentUsd: 0 }, costSpent: 0, successRatio: 0,
    startedAt: new Date().toISOString(), decision: 'B2（待评审）', userClosable: form.value.level !== 'internal',
    dataNamespace: `exp.${form.value.id.toLowerCase()}.yunshu`, notes: '登记向导创建，等待季度评审。',
  });
  open.value = false;
  MessagePlugin.success(`已登记实验 ${form.value.id}（${form.value.level}）：评审日期 ${form.value.reviewDate}`);
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = rows.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="实验登记"
      desc="12 个方向全部登记在册：统一模板（id/标题/假设/入口/影响面/判据/风险/退出条件/级别/负责人/评审日期/指标引用/预算）。"
      volume="卷 25" manifest="U-02" cli="oc frontier registry list --level all" experimental
      :status="[{ label: `${rows.length} 个方向`, theme: 'default' }, { label: '退出条件缺失即阻止进 beta', theme: 'danger' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="levelFilter" size="small" style="width: 130px" aria-label="按级别筛选" :options="['全部', 'lab', 'internal', 'beta', 'ga', 'dropped', 'deprecated'].map((l) => ({ value: l, label: l }))" @change="(v: unknown) => (levelFilter = String(v) as '全部' | ExperimentLevel)" />
        <Select :value="ownerFilter" size="small" style="width: 130px" aria-label="按负责人筛选" :options="[{ value: '全部', label: '全部负责人' }, ...owners.map((o) => ({ value: o, label: o }))]" @change="(v: unknown) => (ownerFilter = String(v))" />
        <Button size="small" variant="outline" @click="openDialog(true)">演示门禁</Button><Button size="small" theme="primary" @click="openDialog(false)">登记新实验</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取实验登记册…"
      empty-title="登记册为空" empty-desc="还没有任何方向登记；每个方向必须先写清假设与成功判据再进入阶梯。"
      empty-action="登记新实验" example-task="点击「演示门禁」：级别 beta + 退出条件留空，验证被字段级阻止"
      what="登记册加载失败" why="实验登记存储不可达（模板字段校验需服务端门禁复核）"
      how="重试；已登记实验的只读副本在季度评审记录中保留"
      :collapsed-summary="`登记 ${filtered.length} 条（含 2 条终止 / 2 条已替代），表格已折叠展示（边界数据态）。`" :page-size="filtered.length"
      @retry="demo = 'NORMAL'" @empty-action="openDialog(false)" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="登记方向" :value="rows.length" unit="个" icon="flag" hint="12 方向登记为研究通道的成功判据之一" />
        <StatCard label="活跃（lab~ga）" :value="rows.filter((e) => ['lab', 'internal', 'beta', 'ga'].includes(e.level)).length" unit="个" icon="dashboard" :target="frontierData.activeLimit" target-kind="max" hint="活跃上限 ≤ 8" />
        <StatCard label="平均成功率" :value="(rows.reduce((a, e) => a + e.successRatio, 0) / rows.length) * 100" format="percent" icon="chart" :lower-is-better="false" hint="0% 表示 lab 阶段尚未上报数据" />
        <StatCard label="缺退出条件" :value="rows.filter((e) => !e.exitCriteria).length" unit="条" icon="error" :lower-is-better="true" hint="非 0 时必须阻断 beta 晋级" />
      </div>

      <Table :data="filtered" :columns="columns" row-key="id" size="small" :pagination="undefined" style="margin-top: 12px">
        <template #level="{ row }"><Tag size="small" :theme="LEVEL_THEME[row.level as ExperimentLevel]" variant="light-outline">{{ row.level }}</Tag></template>
        <template #date="{ row }">{{ new Date(row.reviewDate).toLocaleDateString('zh-CN') }}</template>
        <template #ratio="{ row }"><span :style="{ color: row.successRatio < 0.7 ? 'var(--td-error-color)' : undefined }">{{ (row.successRatio * 100).toFixed(0) }}%</span></template>
        <template #cost="{ row }">${{ row.costSpent.toFixed(2) }} / ${{ row.budget.usd }}</template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">统一模板字段（登记新实验时全部落库）</div>
        <div class="oc-muted" style="font-size: 12px">id / title / hypothesis / entry / scope[] / successCriteria[] / risks[] / exitCriteria / level / owner / reviewDate / metricsRef / budget</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <Tag size="small" theme="danger" variant="light-outline">无 exitCriteria → 不得进入 beta（硬性）</Tag>
          <CopyableId id="trace-frontier-registry-9c02" label="登记 traceId" short="12" />
        </div>
      </div>

      <Dialog v-model:visible="open" header="登记新实验（统一模板）" width="720px" :confirm-btn="{ content: '登记并送季度评审' }" cancel-btn="取消" @confirm="submit">
        <div class="oc-stack" style="gap: 8px">
          <div class="oc-grid oc-grid--3" style="gap: 8px">
            <div><div class="oc-kv__k">编号</div><Input v-model="form.id" size="small" /></div>
            <div><div class="oc-kv__k">标题（必填）</div><Input v-model="form.title" size="small" placeholder="如：多模态协作深度" /></div>
            <div><div class="oc-kv__k">级别</div><Select :value="form.level" size="small" :options="levelOptions" @change="onLevel" /></div>
          </div>
          <div><div class="oc-kv__k">假设（若 X 则 Y，因为 Z）</div><Textarea v-model="form.hypothesis" :autosize="{ minRows: 2 }" /></div>
          <div><div class="oc-kv__k">落地入口 entry</div><Input v-model="form.entry" size="small" placeholder="扩展点 / 工具 / 模式 + 卷号引用" /></div>
          <div class="oc-grid oc-grid--3" style="gap: 8px">
            <div><div class="oc-kv__k">影响面 scope（逗号分隔）</div><Input v-model="form.scope" size="small" /></div>
            <div><div class="oc-kv__k">成功判据（逗号分隔）</div><Input v-model="form.success" size="small" /></div>
            <div><div class="oc-kv__k">风险 risks（逗号分隔）</div><Input v-model="form.risks" size="small" /></div>
          </div>
          <div>
            <div class="oc-kv__k">退出条件 exitCriteria（beta 及以上必填）</div>
            <Textarea v-model="form.exit" :autosize="{ minRows: 2 }" placeholder="触发条件 + 回退动作，如：结构正确率连续 2 个月 < 70% → 回退「仅输入」基线" />
            <div v-if="exitError" style="color: var(--td-error-color); font-size: 12px; margin-top: 4px">{{ exitError }}</div>
          </div>
          <div class="oc-grid oc-grid--4" style="gap: 8px">
            <div><div class="oc-kv__k">负责人</div><Input v-model="form.owner" size="small" /></div>
            <div><div class="oc-kv__k">评审日期</div><Input v-model="form.reviewDate" size="small" /></div>
            <div><div class="oc-kv__k">指标引用 metricsRef</div><Input v-model="form.metricsRef" size="small" /></div>
            <div><div class="oc-kv__k">预算 USD</div><Input v-model.number="form.budget" size="small" /></div>
          </div>
          <div v-if="formError" class="oc-card" style="padding: 8px; border-color: var(--td-error-color)">
            <span style="color: var(--td-error-color); font-size: 12px">{{ formError }}</span>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
