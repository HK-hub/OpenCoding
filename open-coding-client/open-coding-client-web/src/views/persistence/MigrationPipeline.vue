<script setup lang="ts">
/**
 * Z-03 迁移流水线看板。
 * CI 六阶段：静态校验 → 空库迁移 → 样本库迁移 → 迁移后回归 → 回滚演练 → 合入与部署；
 * 每阶段给证据与状态；不可回滚迁移在此显式标注「需审批」。
 * 溯源：卷 19 D-PERS-13/§4.2；BUILD-MANIFEST Z-03。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, Select, Steps, StepItem, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { platformData } from '@/mock/data/platform';
import type { PipelineStage } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const version = ref('V2026.09.24');
const activeStage = ref<PipelineStage>(platformData.persistence.pipeline[3]);

const stages = computed(() => platformData.persistence.pipeline);
const current = computed(() => {
  const idx = stages.value.findIndex((s) => s.status === 'RUNNING' || s.status === 'FAILED');
  return idx < 0 ? stages.value.length : idx;
});
const gatePassed = computed(() => stages.value.every((s) => s.status === 'SUCCEEDED'));
const pendingApproval = computed(() => version.value === 'V2026.09.12');

const columns = [
  { colKey: 'stage', title: '阶段', width: 170, cell: 'stage' },
  { colKey: 'status', title: '状态', width: 120, cell: 'status' },
  { colKey: 'durationMs', title: '耗时', width: 110, cell: 'duration' },
  { colKey: 'evidence', title: '证据', ellipsis: true },
  { colKey: 'note', title: '规则说明', ellipsis: true },
];

const STATUS_THEME: Record<string, 'success' | 'primary' | 'danger' | 'default' | 'warning'> = {
  SUCCEEDED: 'success', RUNNING: 'primary', FAILED: 'danger', SKIPPED: 'default', PENDING: 'warning',
};

function approveDestructive() {
  MessagePlugin.success(`已提交破坏性迁移审批：${version.value}（需变更委员会双人批准，且必须在 expand-contract 流程下执行）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = stages.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="迁移流水线看板"
      desc="每次迁移必须通过六阶段门禁：静态校验、空库迁移、样本库迁移（脱敏副本）、迁移后回归、回滚演练、合入与部署；任一门禁失败即阻断合入。"
      volume="卷 19" manifest="Z-03" cli="oc persistence pipeline --version V2026.09.24 --watch"
      :status="[{ label: gatePassed ? '六阶段全通过' : '门禁未通过', theme: gatePassed ? 'success' : 'warning' }, { label: `当前 ${version}`, theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="version" size="small" style="width: 180px" aria-label="迁移版本" :options="[
          { value: 'V2026.09.24', label: 'V2026.09.24（可回滚）' },
          { value: 'V2026.09.12', label: 'V2026.09.12（破坏性）' },
        ]" />
        <Button v-if="pendingApproval" size="small" theme="danger" variant="outline" @click="approveDestructive">提交破坏性审批</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="门禁通过阶段" :value="stages.filter((s) => s.status === 'SUCCEEDED').length" unit="/ 6" icon="check" hint="全部通过才允许合入" />
      <StatCard label="空库迁移耗时" :value="18.4" unit="秒" icon="database" hint="从零重建全量迁移链" />
      <StatCard label="样本库迁移规模" :value="200000" format="number" unit="行" icon="server" hint="脱敏生产样本，限速 500 行/秒" />
      <StatCard label="回滚演练" :value="stages[4]?.status === 'SUCCEEDED' ? 1 : 0" icon="history" hint="不可回滚迁移改为审批（必填理由）" />
    </div>

    <StateShell
      :state="demo" stage="正在读取 CI 流水线执行记录…"
      empty-title="该迁移没有流水线记录" empty-desc="迁移包尚未推送 CI，或记录被保留策略清理。"
      empty-action="推送迁移包到 CI" example-task="提交 V2026.09.26 迁移并观察空库迁移阶段产物 Schema 比对"
      what="流水线看板加载失败" why="CI 状态接口 429（并发查询过多），已回退为最后一次快照"
      how="重试；或稍后查看，快照可能滞后一个阶段" trace-id="trace-a33c9e08"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">
          六阶段门禁
          <CliHint :command="`oc persistence pipeline --version ${version}`" />
        </h3>
        <Steps :current="current" layout="vertical" size="small">
          <StepItem v-for="s in stages" :key="s.stage" :title="s.stage" :status="s.status === 'FAILED' ? 'error' : s.status === 'RUNNING' ? 'process' : undefined">
            <div class="oc-flex oc-flex--wrap" style="gap: 8px">
              <Tag :theme="STATUS_THEME[s.status] ?? 'default'" size="small" variant="light-outline">{{ s.status }}</Tag>
              <span style="font-size: 12px">{{ s.evidence }}</span>
            </div>
          </StepItem>
        </Steps>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">阶段明细与证据</h3>
          <Table :data="stages" :columns="columns" row-key="stage" size="small" :pagination="undefined">
            <template #stage="{ row }">
              <div class="oc-flex" style="gap: 6px">
                <OcIcon :name="row.status === 'SUCCEEDED' ? 'check' : row.status === 'FAILED' ? 'error' : 'loading'" size="12px" />
                <span>{{ row.stage }}</span>
              </div>
            </template>
            <template #status="{ row }">
              <Tag :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
            </template>
            <template #duration="{ row }">{{ row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '—' }}</template>
            <template #op="{ row }">
              <Button size="small" variant="text" @click="activeStage = row as PipelineStage">证据</Button>
            </template>
          </Table>
          <Progress :percentage="Math.round((stages.filter((s) => s.status === 'SUCCEEDED').length / stages.length) * 100)" theme="line" style="margin-top: 10px" />
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">阶段证据：{{ activeStage.stage }}</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'status', label: '状态', value: activeStage.status, tag: { text: activeStage.status, theme: STATUS_THEME[activeStage.status] ?? 'default' } },
            { key: 'evidence', label: '证据', value: activeStage.evidence },
            { key: 'note', label: '规则说明', value: activeStage.note },
            { key: 'gate', label: '门禁语义', value: '失败即阻断合入（不允许「先合入后修复」）' },
            { key: 'rollback', label: '不可回滚时', value: pendingApproval ? '标记为不可回滚 → 需变更委员会审批（当前版本命中）' : '声明可回滚 → 必须完成回滚演练' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
            <Tag v-if="pendingApproval" theme="danger" variant="light-outline" size="small">该版本为破坏性迁移：缺少回滚演练将被拒绝合入</Tag>
            <Tag v-else theme="success" variant="light-outline" size="small">无破坏性操作声明</Tag>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
