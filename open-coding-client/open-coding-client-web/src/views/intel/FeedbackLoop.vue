<script setup lang="ts">
/**
 * 反馈回灌与规则降权（N3-15）：四类反馈统计 + 回灌队列 + 两段式降权 + 待复核队列 + 积压告警。
 * 溯源：卷 35 §5.5 反馈回灌 / §5.1 质量门禁；BUILD-MANIFEST N3-15。
 * 契约：驳回 / 误报样本回流评测集；规则降权两段式（先降权 → 人工复核后停用）；积压 > 1000 条暂停自动入集。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { intelData } from '@/mock/data/automation';
import type { FeedbackCategory, FeedbackItem } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 入集积压（本地确定性口径）：> 1000 条即暂停自动入集并告警 */
const BACKLOG_LIMIT = 1000;
const backlog = ref(1148);
const autoIngest = ref(true);
const backlogBreach = computed(() => backlog.value > BACKLOG_LIMIT);

const queue = ref<FeedbackItem[]>(intelData.feedbackQueue.map((f) => ({ ...f })));
const catFilter = ref<'全部' | FeedbackCategory>('全部');
const rows = computed(() => (catFilter.value === '全部' ? queue.value : queue.value.filter((f) => f.category === catFilter.value)));
const countOf = (c: FeedbackCategory) => queue.value.filter((f) => f.category === c).length;

const CAT_THEME: Record<FeedbackCategory, 'success' | 'primary' | 'warning' | 'danger'> = { 采纳: 'success', 编辑: 'primary', 驳回: 'warning', 误报: 'danger' };
const columns = [
  { colKey: 'id', title: '反馈 ID', width: 100 },
  { colKey: 'capabilityId', title: '能力', width: 150 },
  { colKey: 'category', title: '类型', width: 90, cell: 'cat' },
  { colKey: 'ingested', title: '入集状态', width: 260, cell: 'ingest' },
  { colKey: 'at', title: '时间', width: 160, cell: 'at' },
];

/** 待复核队列：两段式降权的第二段（人工复核后停用） */
const pendingReview = computed(() => queue.value.filter((f) => f.downweight?.stage === '待复核'));
const downweighted = computed(() => queue.value.filter((f) => f.downweight && f.downweight.stage !== '待复核'));

function review(row: FeedbackItem, pass: boolean) {
  // 复核通过 → 停用规则；复核驳回 → 恢复权重（保留命中记录）
  if (row.downweight) {
    row.downweight.stage = pass ? '已停用' : '已降权';
    row.ingested = true;
    row.ingestedAs = pass
      ? `规则 ${row.downweight.ruleId} 已停用（保留命中 ${row.downweight.hits} 次记录，可追溯）`
      : `规则 ${row.downweight.ruleId} 恢复原权重（复核认为降权不成立，保留证据）`;
  }
  MessagePlugin[pass ? 'success' : 'warning'](
    pass ? `复核通过：规则 ${row.downweight?.ruleId} 已停用（不再产出该规则发现）` : `复核驳回：规则 ${row.downweight?.ruleId} 恢复原权重（撤销降权）`,
  );
}
function resumeIngest() {
  if (backlogBreach.value) {
    MessagePlugin.warning(`积压 ${backlog.value} 条 > ${BACKLOG_LIMIT} 条：自动入集保持暂停，请先清理待复核队列后再恢复。`);
    return;
  }
  autoIngest.value = true;
  MessagePlugin.success('已恢复自动入集（积压回到阈值内）');
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = queue.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="反馈回灌与降权"
      desc="采纳 / 编辑 / 驳回 / 误报四类反馈全部入账；驳回与误报回流评测集，规则按两段式降权处理。"
      volume="卷 35" manifest="N3-15" cli="oc ai feedback queue --ingest-state all"
      :status="[{ label: `待复核 ${pendingReview.length} 条`, theme: pendingReview.length ? 'warning' : 'success' }, { label: `入集积压 ${backlog} 条`, theme: backlogBreach ? 'danger' : 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="catFilter" size="small" style="width: 130px" aria-label="按类型筛选" :options="['全部', '采纳', '编辑', '驳回', '误报'].map((c) => ({ value: c, label: c }))" @change="(v: unknown) => (catFilter = String(v) as '全部' | FeedbackCategory)" />
        <Button size="small" variant="outline" @click="resumeIngest">恢复自动入集</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在汇总反馈与回灌队列…"
      empty-title="还没有反馈记录" empty-desc="对增强产出的采纳 / 编辑 / 驳回 / 误报都会进入本队列；无反馈时队列为空。"
      empty-action="去草稿收件箱" example-task="对一条误报执行「复核通过」，观察规则两段式降权到停用"
      what="反馈队列加载失败" why="反馈存储不可达（入集状态需与评测集联查）"
      how="重试；告警状态下自动入集保持暂停（fail-safe），不会漏审计"
      :collapsed-summary="`反馈 ${rows.length} 条（含 2 条驳回 / 3 条误报），列表已折叠展示（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <Alert v-if="backlogBreach" theme="error" style="margin-bottom: 10px"
        :message="`入集积压告警：${backlog} 条 > 阈值 ${BACKLOG_LIMIT} 条 → 自动入集已暂停（不静默截断）；请清理待复核队列后手动恢复。`" />

      <div class="oc-grid oc-grid--4">
        <StatCard label="采纳" :value="countOf('采纳')" unit="条" icon="thumb-up" :lower-is-better="false" hint="正向样本：仅计入采纳率，不回灌" />
        <StatCard label="编辑" :value="countOf('编辑')" unit="条" icon="edit" :lower-is-better="false" hint="人工校订样本：用于提示词改进" />
        <StatCard label="驳回" :value="countOf('驳回')" unit="条" icon="close" :lower-is-better="true" hint="回流评测集（含来源运行与生成器版本）" />
        <StatCard label="误报" :value="countOf('误报')" unit="条" icon="error" :lower-is-better="true" hint="触发规则两段式降权" />
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined" style="margin-top: 12px">
        <template #cat="{ row }"><Tag size="small" :theme="CAT_THEME[row.category as FeedbackCategory]" variant="light-outline">{{ row.category }}</Tag></template>
        <template #ingest="{ row }">
          <Tag size="small" :theme="row.ingested ? 'primary' : 'default'" variant="light-outline">{{ row.ingested ? '已入集' : '不入集' }}</Tag>
          <span class="oc-muted" style="font-size: 12px; margin-left: 6px">{{ row.ingestedAs }}</span>
        </template>
        <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">规则两段式降权（先降权 → 人工复核后停用）<CliHint command="oc ai rule downweight --stage review" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 's1', label: '① 先降权', value: '误报命中后规则权重立即下调（发现降置信/折叠），但规则仍生效（可回滚）' },
            { key: 's2', label: '② 人工复核', value: '进入待复核队列；复核通过 → 停用规则；复核驳回 → 恢复原权重（保留证据）' },
            { key: 'trace', label: '可追溯', value: `已降权 ${downweighted.filter((f) => f.downweight?.stage === '已降权').length} 条 / 已停用 ${downweighted.filter((f) => f.downweight?.stage === '已停用').length} 条，命中次数与证据随规则保留` },
            { key: 'limit', label: '积压上限', value: `> ${BACKLOG_LIMIT} 条 → 暂停自动入集并告警（人工恢复，不静默丢弃样本）` },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <Tag size="small" theme="danger" variant="light-outline">负样本：{{ countOf('驳回') }} 驳回 / {{ countOf('误报') }} 误报</Tag>
            <CopyableId id="trace-intel-feedback-3e77" label="反馈 traceId" short="12" />
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">待复核队列（两段式第二段）</div>
          <div v-for="f in pendingReview" :key="f.id" class="oc-stack" style="gap: 2px; margin-bottom: 8px">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" theme="warning" variant="light-outline">待复核</Tag>
              <span class="oc-mono" style="font-size: 12px">{{ f.downweight?.ruleId }}</span>
              <span class="oc-muted" style="font-size: 12px">命中 {{ f.downweight?.hits }} 次 · 来源 {{ f.id }}</span>
            </div>
            <div class="oc-flex" style="gap: 4px">
              <Popconfirm content="复核通过将停用该规则：不再产出该规则的发现（历史命中与证据保留，可审计）。是否通过？" @confirm="review(f, true)">
                <Button size="small" variant="text">复核通过（停用）</Button>
              </Popconfirm>
              <Popconfirm content="复核驳回将撤销降权：规则恢复原权重，本次误报证据保留作为后续评估依据。是否驳回？" @confirm="review(f, false)">
                <Button size="small" variant="text">复核驳回（恢复）</Button>
              </Popconfirm>
            </div>
          </div>
          <div v-if="!pendingReview.length" class="oc-muted" style="font-size: 12px">当前没有待复核项；已降权规则在下一轮反馈中继续观察。</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
