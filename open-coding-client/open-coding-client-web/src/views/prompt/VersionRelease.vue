<script setup lang="ts">
/**
 * 版本与发布（M-19 / 卷 04 §4.3）：
 * 版本历史 + 制品哈希 + 评测记录 + 发布/回滚。门禁：核心用例集通过率不得低于上一版本；
 * 回滚语义显式说明（灰度流量立即切回、已产生会话保留原版本集以便复现）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Popconfirm, Progress, Table, Tag, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import type { InfoItem } from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtCost, type PageState } from '@/components/gateway/types';
import { PROMPT_ASSET_TYPE_META, modelData } from '@/mock/data/model';
import type { AssetVersionData, PromptAssetType } from '@/mock/data/model';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const filter = ref<'ALL' | 'canary' | 'rolled_back'>('ALL');
const detail = ref<AssetVersionData | null>(null);
const drawerOpen = ref(false);

const GRAY_META: Record<AssetVersionData['grayState'], { label: string; theme: 'success' | 'primary' | 'danger' | 'warning' }> = {
  stable: { label: '稳定', theme: 'success' },
  canary: { label: '灰度中', theme: 'primary' },
  rolling_back: { label: '回滚中', theme: 'warning' },
  rolled_back: { label: '已回滚', theme: 'danger' },
};

const versions = computed(() =>
  data.assetVersions.filter((v) => (filter.value === 'ALL' ? true : v.grayState === filter.value)),
);
const canaryCount = computed(() => data.assetVersions.filter((v) => v.grayState === 'canary').length);
const rollbackCount = computed(() => data.assetVersions.filter((v) => v.grayState === 'rolled_back' || v.grayState === 'rolling_back').length);
const gatePassRate = computed(() => {
  const passed = data.assetVersions.filter((v) => v.evalReport.passRatePct >= v.evalReport.prevPassRatePct).length;
  return Math.round((passed / data.assetVersions.length) * 100);
});

const columns: PrimaryTableCol[] = [
  { colKey: 'asset', title: '资产', width: 240 },
  { colKey: 'version', title: '版本 / 制品哈希', width: 250 },
  { colKey: 'eval', title: '评测（通过率 vs 上一版）', width: 230 },
  { colKey: 'gray', title: '灰度状态', width: 130 },
  { colKey: 'change', title: '变更说明' },
  { colKey: 'actions', title: '操作', width: 170 },
];

const detailItems = computed<InfoItem[]>(() => {
  const v = detail.value;
  if (!v) return [];
  return [
    { key: 'asset', label: '资产', value: `${v.assetName}（${v.assetId}）` },
    { key: 'type', label: '类型', value: PROMPT_ASSET_TYPE_META[v.type].label },
    { key: 'version', label: '版本', value: `v${v.version}` },
    { key: 'hash', label: '制品哈希', value: v.artifactHash, mono: true, copyable: true },
    { key: 'publisher', label: '发布者 / 时间', value: `${v.publishedBy} · ${new Date(v.publishedAt).toLocaleString('zh-CN')}` },
    { key: 'gray', label: '灰度状态', value: GRAY_META[v.grayState].label, tag: { text: GRAY_META[v.grayState].label, theme: GRAY_META[v.grayState].theme } },
    { key: 'rollback', label: '可回滚至', value: `v${v.rollbackTo}` },
    { key: 'gate', label: '门禁结论', value: v.evalReport.passRatePct >= v.evalReport.prevPassRatePct ? '通过（通过率不低于上一版本）' : '未通过（需显式豁免 + 恢复计划）' },
    { key: 'change', label: '变更说明', value: v.changeNote, span: 2 },
  ];
});

function rollback(v: AssetVersionData) {
  MessagePlugin.warning(`已回滚 ${v.assetId} → v${v.rollbackTo}：灰度流量立即切回；已产生会话保留原版本集（可复现历史行为）`);
}

function openDetail(v: AssetVersionData) {
  detail.value = v;
  drawerOpen.value = true;
}

/** 导出评测报告：当前查看版本的用例级成本 / 耗时与门禁结论（可用于成本回归门禁） */
function exportEvalReport() {
  const v = detail.value;
  if (!v) return;
  const cases = v.evalReport.cases;
  const gatePass = v.evalReport.passRatePct >= v.evalReport.prevPassRatePct;
  const file = downloadJson(
    {
      assetId: v.assetId,
      assetName: v.assetName,
      type: v.type,
      version: v.version,
      artifactHash: v.artifactHash,
      publishedBy: v.publishedBy,
      publishedAt: v.publishedAt,
      grayState: v.grayState,
      rollbackTo: v.rollbackTo,
      gate: {
        passRatePct: v.evalReport.passRatePct,
        prevPassRatePct: v.evalReport.prevPassRatePct,
        // 门禁语义：通过率不得低于上一版本，未通过需显式豁免 + 恢复计划
        verdict: gatePass ? '通过（通过率不低于上一版本）' : '未通过（需显式豁免 + 恢复计划）',
      },
      caseCount: cases.length,
      cases,
      totalCostUsd: Number(cases.reduce((a, c) => a + c.costUsd, 0).toFixed(4)),
      totalDurationMs: cases.reduce((a, c) => a + c.durationMs, 0),
      overallGatePassRatePct: gatePassRate.value,
      redactionNote: '评测报告含用例级成本与耗时；不含任何密钥材料',
    },
    `oc-prompt-eval-report-${v.assetId}-v${v.version}-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出评测报告：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = data.assetVersions.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="版本与发布"
      desc="双源模型：文件为开发真源（PR 评审），发布到运行时资产库（带版本号与制品哈希）。会话记录使用的版本集，任意历史会话可查「当时用的是哪套提示词」。"
      volume="卷 04"
      manifest="M-19"
      cli="oc prompt publish --asset tpl-coding-default --version 3.2.0 | oc prompt rollback --asset mode-coding --to 3.3.0"
      :status="[{ label: `${canaryCount} 个灰度中`, theme: 'primary' }, { label: `${rollbackCount} 个已回滚`, theme: rollbackCount ? 'warning' : 'default' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="filter = filter === 'canary' ? 'ALL' : 'canary'">
          {{ filter === 'canary' ? '查看全部版本' : '仅看灰度中' }}
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="版本总数" :value="data.assetVersions.length" icon="history" hint="每个资产一条版本记录；草稿不计入" />
      <StatCard label="门禁通过率" :value="gatePassRate" format="percent" icon="task-checked" :target="100" target-kind="min" hint="门禁：核心用例集通过率 ≥ 上一版本" />
      <StatCard label="灰度中版本" :value="canaryCount" icon="flag" hint="灰度按租户/项目/会话哈希分桶，可复现" />
      <StatCard label="评测成本（本轮）" :value="data.assetVersions.reduce((a, b) => a + b.evalReport.cases.reduce((x, y) => x + y.costUsd, 0), 0)" format="cost" icon="discount" hint="评测调用同样计量（走低成本档，单列到成本看板）" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有版本记录"
      empty-desc="资产尚未发布过任何版本；草稿保存在文件真源中。"
      empty-action="查看资产库"
      what="版本历史加载失败"
      why="运行时资产库不可达；当前会话继续使用已装载版本集（不会回退到未评测版本）。"
      how="可重试；发布与回滚在资产库恢复前均被拒绝（安全优先）。"
      trace-id="trace-version-9d04"
      missing-permission="prompt.manage"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 prompt.manage（发布/回滚影响全租户行为）"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('先保存草稿并跑通评测门禁，再发布版本')"
    >
      <Table :data="versions" :columns="columns" row-key="assetId" size="small" :pagination="{ pageSize: 8, total: versions.length }">
        <template #asset="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-flex" style="gap: 6px">
              <b>{{ row.assetName }}</b>
              <Tag size="small" variant="outline">{{ PROMPT_ASSET_TYPE_META[row.type as PromptAssetType].label }}</Tag>
            </span>
            <span class="oc-mono oc-muted" style="font-size: 12px">{{ row.assetId }}</span>
          </div>
        </template>
        <template #version="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span>v{{ row.version }}</span>
            <CopyableId :id="row.artifactHash" label="复制制品哈希" short="22" />
          </div>
        </template>
        <template #eval="{ row }">
          <div class="oc-stack" style="gap: 2px; font-size: 12px">
            <span class="oc-flex" style="gap: 6px">
              <Progress :percentage="row.evalReport.passRatePct" :status="row.evalReport.passRatePct >= row.evalReport.prevPassRatePct ? 'success' : 'warning'" size="small" :style="{ width: '80px' }" />
              <span>{{ row.evalReport.passRatePct }}%</span>
            </span>
            <span class="oc-muted">上一版 {{ row.evalReport.prevPassRatePct }}% · {{ row.evalReport.cases.length }} 用例</span>
          </div>
        </template>
        <template #gray="{ row }">
          <Tag :theme="GRAY_META[row.grayState as AssetVersionData['grayState']].theme" size="small" variant="light-outline">
            {{ GRAY_META[row.grayState as AssetVersionData['grayState']].label }}
          </Tag>
        </template>
        <template #change="{ row }">
          <span style="font-size: 12px">{{ row.changeNote }}</span>
        </template>
        <template #actions="{ row }">
          <Button size="small" variant="text" @click="openDetail(row as unknown as AssetVersionData)">评测详情</Button>
          <Popconfirm
            :content="`回滚到 v${row.rollbackTo}：灰度流量立即切回；已产生会话保留原版本集（历史行为可复现）；不影响已发布的其它资产。`"
            @confirm="rollback(row as unknown as AssetVersionData)"
          >
            <Button size="small" variant="text" theme="danger">回滚</Button>
          </Popconfirm>
        </template>
      </Table>

      <div class="oc-card">
        <div class="oc-card__title">发布流程（文件真源 → 评测门禁 → 运行时资产库 → 灰度）</div>
        <Timeline>
          <TimelineItem label="1 提交 PR">资产变更走文件真源评审（Git），CI 校验组装确定性 + 变量契约。</TimelineItem>
          <TimelineItem label="2 评测门禁">
            跑核心用例集；通过率低于上一版本则阻断发布（需显式豁免并记录理由与恢复计划）。
          </TimelineItem>
          <TimelineItem label="3 发布版本">写入运行时资产库，生成制品哈希与版本记录（会话记录版本集）。</TimelineItem>
          <TimelineItem label="4 灰度装载">按租户/项目/会话哈希分桶装载（salt 记录在实验报告中，可复现）。</TimelineItem>
          <TimelineItem label="5 指标回传与自动回滚">在线指标劣化超阈值 → 自动回滚上一版本并留痕（不静默切回）。</TimelineItem>
        </Timeline>
      </div>

      <Drawer v-model:visible="drawerOpen" :header="`评测记录 · ${detail?.assetName ?? ''} v${detail?.version ?? ''}`" size="640px" :footer="false">
        <InfoGrid :items="detailItems" :columns="2" />
        <div class="oc-divider" />
        <div class="oc-card__title">用例结果（{{ detail?.evalReport.cases.length }} 条）</div>
        <Table
          :data="detail?.evalReport.cases ?? []"
          row-key="name"
          size="small"
          :pagination="{ pageSize: 12, total: detail?.evalReport.cases.length ?? 0 }"
          :columns="[
            { colKey: 'name', title: '用例', width: 260 },
            { colKey: 'result', title: '结果', width: 110 },
            { colKey: 'costUsd', title: '成本', width: 110 },
            { colKey: 'durationMs', title: '耗时', width: 110 },
          ]"
        >
          <template #result="{ row }">
            <Tag :theme="row.result === 'pass' ? 'success' : row.result === 'flaky' ? 'warning' : 'danger'" size="small" variant="light-outline">
              {{ row.result === 'pass' ? '通过' : row.result === 'flaky' ? '不稳定' : '失败' }}
            </Tag>
          </template>
          <template #costUsd="{ row }">{{ fmtCost(row.costUsd) }}</template>
          <template #durationMs="{ row }">{{ row.durationMs }}ms</template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
          <Tooltip content="回滚不改写历史版本：仅把「当前装载版本」指回上一版本">
            <Button size="small" variant="outline" @click="detail && rollback(detail)">回滚到 v{{ detail?.rollbackTo }}</Button>
          </Tooltip>
          <Button size="small" variant="outline" @click="exportEvalReport">导出评测报告</Button>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
