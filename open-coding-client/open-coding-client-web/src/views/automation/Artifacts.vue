<script setup lang="ts">
/**
 * 产物页（N2-10）：五类产物（pr / comment / report / notification / file）+ 幂等更新标记。
 * 溯源：卷 34 §5.8；BUILD-MANIFEST N2-10。
 * 契约：产物按 (模板, 目标, 幂等键) 唯一定位；已存在则更新（评论复用同一条、PR 追加提交、报告覆盖版本）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData } from '@/mock/data/automation';
import type { AutomationArtifact, OutputType } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';
import { downloadCsv } from '@/utils/download';

const ui = useUiStore();
const artifacts = automationData.artifacts;
const typeFilter = ref<'全部' | OutputType>('全部');
const selected = ref<AutomationArtifact>(artifacts[0]);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onType(v: unknown) {
  typeFilter.value = String(v) as '全部' | OutputType;
}

const rows = computed(() => (typeFilter.value === '全部' ? artifacts : artifacts.filter((a) => a.type === typeFilter.value)));
const adopted = computed(() => artifacts.filter((a) => a.adopted).length);
const reused = computed(() => artifacts.filter((a) => a.idempotentUpdate === 'reused').length);

const columns = [
  { colKey: 'type', title: '类型', width: 120, cell: 'type' },
  { colKey: 'title', title: '产物', ellipsis: true },
  { colKey: 'templateName', title: '来源模板', width: 130 },
  { colKey: 'runId', title: '运行', width: 110, cell: 'run' },
  { colKey: 'idempotentUpdate', title: '幂等更新', width: 120, cell: 'idem' },
  { colKey: 'adopt', title: '采纳', width: 130, cell: 'adopt' },
  { colKey: 'sizeKb', title: '大小', width: 90, cell: 'size' },
  { colKey: 'op', title: '操作', width: 90, cell: 'op' },
];

const TYPE_THEME: Record<OutputType, 'primary' | 'success' | 'warning' | 'default'> = {
  pr: 'primary', comment: 'success', report: 'warning', notification: 'default', file: 'default',
};
const IDEM_THEME: Record<string, 'success' | 'warning' | 'default'> = { created: 'success', updated: 'warning', reused: 'default' };

/** 导出当前筛选下的产物清单：内容取自页面真实产物数据（CSV，含幂等更新与采纳信息） */
function exportArtifacts() {
  const header = ['产物 id', '类型', '产物', '来源模板', '运行', '幂等更新', '采纳状态', '采纳率', '大小 KB'];
  const body = rows.value.map((a) => [
    a.id, a.type, a.title, a.templateName, a.runId, a.idempotentUpdate,
    a.adopted ? '已采纳' : '待处理', `${(a.adoptRatio * 100).toFixed(0)}%`, a.sizeKb.toFixed(1),
  ]);
  const file = downloadCsv([header, ...body], `automation-artifacts-${typeFilter.value}.csv`);
  MessagePlugin.success('已生成 ' + file);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = artifacts.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="产物"
      desc="五类产物（pr / comment / report / notification / file）；按 (模板, 目标, 幂等键) 唯一定位，重复运行只更新不新建。"
      volume="卷 34" manifest="N2-10" cli="oc automation artifact list --type all --show-idempotency"
      :status="[{ label: `${artifacts.length} 个产物`, theme: 'default' }, { label: `${reused} 个幂等复用`, theme: 'primary' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="typeFilter" size="small" style="width: 150px" aria-label="按类型筛选" :options="['全部', 'pr', 'comment', 'report', 'notification', 'file'].map((t) => ({ value: t, label: t }))" @change="onType" />
        <Button size="small" variant="outline" @click="exportArtifacts">导出产物清单</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在载入产物索引与采纳率…"
      empty-title="暂无产物" empty-desc="该类型下还没有产物；产物在运行验收通过后落位（失败/去重运行不产生新产物）。"
      empty-action="查看全部类型" example-task="查看「评论」类产物，确认同一条评论被更新而非新建"
      what="产物索引加载失败" why="对象存储引用不可达（大载荷在对象存储，表内仅保留引用）"
      how="重试；引用的历史产物仍在保留期内，可按 runId 检索" trace-id="trace-ab55312f"
      :collapsed-summary="`产物较多（${rows.length} 个），已折叠展示（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="typeFilter = '全部'" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="产物总数" :value="artifacts.length" icon="file-copy" hint="五类产物合计" />
        <StatCard label="已采纳" :value="adopted" icon="check" :delta="6.2" :lower-is-better="false" hint="PR 合并 / 报告被引用" />
        <StatCard label="幂等复用" :value="reused" icon="refresh" hint="更新同一条评论 / 追加 PR 提交 / 覆盖报告版本" />
        <StatCard label="平均采纳率" :value="(artifacts.reduce((a, x) => a + x.adoptRatio, 0) / artifacts.length) * 100" format="percent" icon="thumb-up" :target="60" hint="目标 ≥ 60%" />
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined" style="margin-top: 12px">
        <template #type="{ row }"><Tag size="small" :theme="TYPE_THEME[row.type as OutputType]" variant="light-outline">{{ row.type }}</Tag></template>
        <template #run="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.runId }}</span></template>
        <template #idem="{ row }">
          <Tag size="small" :theme="IDEM_THEME[row.idempotentUpdate]" variant="light-outline">{{ row.idempotentUpdate }}</Tag>
        </template>
        <template #adopt="{ row }">
          <span style="font-size: 12px">{{ row.adopted ? '已采纳' : '待处理' }} · {{ (row.adoptRatio * 100).toFixed(0) }}%</span>
        </template>
        <template #size="{ row }">{{ row.sizeKb.toFixed(1) }} KB</template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="selected = row as AutomationArtifact">查看</Button>
        </template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">产物详情<CliHint :command="`oc automation artifact show ${selected.id}`" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'id', label: '产物 id', value: selected.id, mono: true, copyable: true },
            { key: 'type', label: '类型', value: selected.type, tag: { text: selected.type, theme: 'primary' } },
            { key: 'title', label: '标题', value: selected.title },
            { key: 'loc', label: '位置（幂等定位）', value: selected.location, mono: true, copyable: true },
            { key: 'schema', label: 'schema 引用', value: selected.schema, mono: true },
            { key: 'free', label: '正文生成', value: selected.freeform ? '模型自由生成（受门禁约束：结构 + 引用 + 安全）' : '结构化（机械校验）' },
            { key: 'at', label: '落位时间', value: new Date(selected.at).toLocaleString('zh-CN') },
            { key: 'size', label: '大小', value: `${selected.sizeKb.toFixed(1)} KB` },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">幂等更新语义</div>
          <div class="oc-stack" style="gap: 8px">
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="success" variant="light-outline">created</Tag><span style="font-size: 13px">首次产出，产物按幂等键登记</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="warning" variant="light-outline">updated</Tag><span style="font-size: 13px">同键再次运行 → 更新既有产物（评论更新 / PR 追加提交 / 报告覆盖版本）</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" variant="light-outline">reused</Tag><span style="font-size: 13px">触发被去重（DEDUPLICATED）→ 直接复用首次产物，不新建</span></div>
          </div>
          <div class="oc-divider" />
          <div class="oc-muted" style="font-size: 12px">
            产物外发受管控：模板不得外发代码内容（除声明的模型调用与 PR 通道）；报告外发须显式配置并经审计。
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
