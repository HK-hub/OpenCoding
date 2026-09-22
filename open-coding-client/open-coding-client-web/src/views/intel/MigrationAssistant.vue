<script setup lang="ts">
/**
 * 迁移助手工作台（N3-12）：规格卡 + 影响面 + 批次（≤50 文件）+ 每批验证 + 续跑点 + 迁移报告。
 * 溯源：卷 35 §5.3 ⑧；BUILD-MANIFEST N3-12。
 * 契约：批次失败 → 回滚该批并停止后续批次（保留已完成批次）；规格歧义 → 暂停并列出待澄清项（不猜测）。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import type { MigrationPlan } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const plans = intelData.migrations;
const pickedId = ref(plans[0].id);
const plan = computed(() => plans.find((p) => p.id === pickedId.value)!);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onPick(v: unknown) {
  pickedId.value = String(v);
}

const columns = [
  { colKey: 'no', title: '批次', width: 80, cell: 'no' },
  { colKey: 'status', title: '状态', width: 120, cell: 'status' },
  { colKey: 'files', title: '文件数（≤50）', width: 130, cell: 'files' },
  { colKey: 'verification', title: '每批验证（规格声明的验收命令）', ellipsis: true },
  { colKey: 'report', title: '诊断 / 报告', width: 260, cell: 'report' },
];
const BATCH_THEME: Record<MigrationPlan['batches'][number]['status'], 'success' | 'danger' | 'default'> = { SUCCEEDED: 'success', FAILED: 'danger', PENDING: 'default' };

const doneFiles = computed(() => plan.value.batches.filter((b) => b.status === 'SUCCEEDED').reduce((a, b) => a + b.files, 0));
const autoRatio = computed(() => (doneFiles.value / plan.value.impact.files) * 100);

function resume() {
  MessagePlugin.success(`已从续跑点继续：${plan.value.resumePoint}（失败批次重建分支，已完成批次不受影响）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = plans.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="迁移助手"
      desc="规格驱动（规则 + 正反例 + 验收命令）+ 影响面分析 + 小批（≤50 文件）+ 每批验证 + 断点续跑。"
      volume="卷 35" manifest="N3-12" :cli="`oc ai migrate --spec ${plan.id} --batch-size ${plan.batchSize} --resume`"
      :status="[{ label: plan.status, theme: plan.status === 'RUNNING' ? 'primary' : 'warning' }, { label: `批次大小 ${plan.batchSize}`, theme: 'default' }, { label: '只提 PR 不合并', theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="pickedId" size="small" style="width: 260px" aria-label="选择迁移计划" :options="plans.map((p) => ({ value: p.id, label: p.title }))" @change="onPick" />
        <Popconfirm content="续跑从失败批次重建分支开始；已完成批次与其 PR 不受影响。是否续跑？" @confirm="resume">
          <Button size="small" theme="primary">从续跑点继续</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在做影响面分析与批次规划…"
      empty-title="没有迁移计划" empty-desc="迁移需要先给出规格（规则 + 正反例 + 验收命令）；无规格不启动（禁止猜测）。"
      empty-action="新建迁移规格" example-task="查看 H2 → Testcontainers 迁移的批次状态与续跑点"
      what="迁移计划加载失败" why="规格存在歧义（待澄清项未解决）→ 已暂停，不猜测执行"
      how="先澄清规格中的歧义项，再续跑；已完成批次保留" trace-id="trace-ab55312f"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="影响面文件" :value="plan.impact.files" icon="file-copy" :hint="`跨模块：${plan.impact.modules.join(' / ')}`" />
        <StatCard label="已完成文件" :value="doneFiles" icon="check" :lower-is-better="false" hint="每批须通过规格验收命令" />
        <StatCard label="自动迁移比例" :value="autoRatio" format="percent" icon="robot" hint="其余为人工干预点（报告列出）" />
        <StatCard label="批次大小上限" :value="plan.batchSize" icon="layers" hint="默认 50（可配 10–200）" />
      </div>

      <Alert v-if="plan.status === 'PAUSED'" theme="warning" style="margin: 12px 0"
        :message="`已暂停：${plan.resumePoint}；失败批次已回滚并生成诊断（保留已完成批次，不猜测规格歧义）。`" />

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">规格卡（规则 + 正反例 + 验收命令）<CliHint :command="`oc ai migrate spec show ${plan.id}`" /></div>
          <div class="oc-stack" style="gap: 4px; font-size: 13px">
            <span v-for="(r, i) in plan.spec.rules" :key="i">· {{ r }}</span>
          </div>
          <div class="oc-divider" />
          <InfoGrid :columns="1" :items="[
            { key: 'good', label: '正例（迁移样板）', value: plan.spec.good, mono: true },
            { key: 'bad', label: '反例（显式豁免）', value: plan.spec.bad, mono: true },
            { key: 'acc', label: '验收命令', value: plan.spec.acceptance.join('；'), block: true },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">影响面与风险</div>
          <InfoGrid :columns="1" :items="[
            { key: 'files', label: '涉及文件', value: plan.impact.files },
            { key: 'mods', label: '涉及模块', value: plan.impact.modules.join('、') },
            { key: 'risk', label: '风险', value: plan.impact.risk },
            { key: 'behav', label: '行为约束', value: '不改变公开行为（除规格要求）；每批独立分支与提交' },
            { key: 'fail', label: '失败处置', value: '回滚该批 + 生成诊断 + 停止后续批次（保留已完成批次）' },
          ]" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            报告口径：自动迁移比例 = 已完成文件 / 影响面文件；人工干预点在报告中逐条列出。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">批次列表（每批验证结果与诊断）</div>
        <Table :data="plan.batches" :columns="columns" row-key="no" size="small" :pagination="undefined">
          <template #no="{ row }"><span class="oc-mono">#{{ row.no }}</span></template>
          <template #status="{ row }"><Tag size="small" :theme="BATCH_THEME[row.status as MigrationPlan['batches'][number]['status']]" variant="light-outline">{{ row.status }}</Tag></template>
          <template #files="{ row }">
            <span :style="{ color: row.files > plan.batchSize ? 'var(--oc-sev-error)' : undefined }">{{ row.files }} / {{ plan.batchSize }}</span>
          </template>
          <template #report="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.report }}</span></template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">{{ plan.report }}</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
          <Tag size="small" theme="warning" variant="light-outline">{{ plan.resumePoint }}</Tag>
          <Tag size="small" variant="outline">失败批次诊断：{{ plans.filter((p) => p.batches.some((b) => b.status === 'FAILED')).length }} 项</Tag>
        </div>
      </div>
    </StateShell>
  </div>
</template>
