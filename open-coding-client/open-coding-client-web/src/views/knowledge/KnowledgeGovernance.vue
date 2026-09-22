<script setup lang="ts">
/**
 * W-06 知识治理：陈旧检测四类 + 降权 + 审核流 + 贡献度量 + 反馈队列。
 * 陈旧项检索降权并在引用中标注「可能过时（最后验证于 X）」；失效反馈进入修复队列，修复后回写索引（卷 11 §4.6）。
 * 溯源：卷 11 D-KB-11 / BUILD-MANIFEST W-06
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, StepItem, Steps, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import type { StaleFinding } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.knowledge;

const state = ref<UiStateKind>('LOADING');
const kindFilter = ref('all');
const applied = ref<string[]>([]);

// 失效反馈队列的就地副本：本页「修复」入队后表格与计数立即刷新（mock 源数据为普通对象，直接 push 不触发渲染）
const queue = ref([...data.governance.feedbackQueue]);

const rows = computed(() => data.staleFindings.filter((f) => kindFilter.value === 'all' || f.kind === kindFilter.value));
const highWeight = computed(() => data.staleFindings.filter((f) => f.weight >= 0.4).length);

const KIND_TYPES = ['引用失效', '版本落后', '长期未访问', '被新版本取代'] as const;

const kindCounts = computed(() =>
  KIND_TYPES.map((k) => ({ x: k, y: data.staleFindings.filter((f) => f.kind === k).length })),
);

const AUDIT_STEPS = ['发现陈旧（自动检测）', '降权 + 引用标注', '修复（补引用 / 重索引 / 归档）', '回写索引并复核'];

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function kindTheme(k: string) {
  return k === '引用失效' ? 'danger' : k === '版本落后' ? 'warning' : k === '长期未访问' ? 'default' : 'primary';
}

function applyDecay(f: { findingId: string; weight: number }) {
  if (!applied.value.includes(f.findingId)) applied.value.push(f.findingId);
  MessagePlugin.success(`已应用降权 ${f.weight}：检索排序下调，引用处显示「可能过时」`);
}

/** 批量降权：对当前过滤下的全部陈旧项应用各自建议权重（可逆，仅排序与标注） */
function applyDecayBatch() {
  const ids = rows.value.map((f) => f.findingId);
  const added = ids.filter((id) => !applied.value.includes(id));
  applied.value = [...applied.value, ...added];
  MessagePlugin.success(`已批量降权 ${added.length} 条（权重 0.25–0.5，可逆）：检索排序下调，引用处标注「可能过时」`);
}

/** 是否已在修复队列（按目标幂等，已回写的不算） */
function queuedInRepair(target: string) {
  return queue.value.some((q) => q.target === target && q.state !== '已回写');
}

/** 修复：把该条陈旧项落入失效反馈队列（待处理），修复后回写索引并复核 */
function sendToRepair(f: StaleFinding) {
  if (queuedInRepair(f.target)) {
    MessagePlugin.info(`「${f.target}」已在修复队列中，等待修复后回写索引`);
    return;
  }
  const rec: (typeof queue.value)[number] = {
    id: `kfb-${String(queue.value.length + 1).padStart(2, '0')}`,
    target: f.target,
    kind: f.kind,
    reporter: '治理工作台（本页修复）',
    at: new Date().toISOString(),
    state: '待处理',
  };
  queue.value = [rec, ...queue.value];
  MessagePlugin.info(`已进入修复队列：「${f.target}」修复后回写索引并复核（队列共 ${queue.value.length} 条）`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="知识治理"
      desc="四类陈旧检测（引用失效 / 版本落后 / 长期未访问 / 被新版本取代）→ 降权与标注 → 审核修复 → 回写索引；贡献度量供团队评估知识资产。"
      volume="卷 11"
      manifest="W-06"
      cli="oc kb stale scan --apply-decay"
      :status="[{ label: `${data.staleFindings.length} 条陈旧`, theme: 'warning' }, { label: '降权可回滚', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="kindFilter" size="small" style="width: 160px" :options="[{ label: '全部类型', value: 'all' }, ...KIND_TYPES.map((k) => ({ label: k, value: k }))]" />
        <Popconfirm content="降权只影响排序与标注，不删除内容；可随时撤销。" @confirm="applyDecayBatch">
          <Button size="small" theme="primary"><OcIcon name="filter" size="12px" /> 批量降权</Button>
        </Popconfirm>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="陈旧条目" :value="data.staleFindings.length" unit="条" icon="bug" :lower-is-better="true" hint="陈旧率纳入知识质量指标（oc_kb_stale_ratio）" />
      <StatCard label="高权重陈旧" :value="highWeight" unit="条" icon="error" :lower-is-better="true" hint="权重 ≥ 0.4：引用失效或版本落后，需优先修复" />
      <StatCard label="反馈队列" :value="queue.length" unit="条" icon="notification" :lower-is-better="true" hint="来自用户与 Agent 的「此知识有误」反馈" />
      <StatCard label="已回写索引" :value="queue.filter((f) => f.state === '已回写').length" unit="条" icon="check" hint="修复后回写索引，引用即时恢复可信" />
    </div>

    <StateShell
      :state="state"
      stage="扫描陈旧知识…"
      empty-title="没有检测到陈旧知识"
      empty-desc="陈旧检测在索引重建与定期任务中运行；无陈旧项说明引用与版本都健康。"
      empty-action="立即扫描"
      example-task="删除被引用文件后观察知识被标记过时"
      what="陈旧检测加载失败"
      why="陈旧扫描任务不可读（kb.stale.detected 事件投影缺失）。"
      how="可重试；降权与审核动作不受影响，可先处理反馈队列。"
      trace-id="trace-kstale-4f19b0"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">陈旧类型分布</h3>
          <OcChart type="bar" :series="[{ name: '条目数', points: kindCounts }]" :height="180" aria-label="陈旧类型分布" />
          <div class="oc-muted" style="font-size: 12px">
            阈值：提交差 &gt; 5 视为版本落后；&gt; 90 天未访问视为长期未访问；被新版本取代默认降权 0.3。
          </div>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">治理与审核流</h3>
          <Steps :current="2" layout="horizontal" size="small">
            <StepItem v-for="(s, i) in AUDIT_STEPS" :key="s" :title="`${i + 1}. ${s}`" />
          </Steps>
          <div class="oc-divider" />
          <div class="oc-kv" style="font-size: 12px">
            <span class="oc-kv__k">审核范围</span><span>组织知识需评审发布；项目知识自动标注但可人工修复</span>
            <span class="oc-kv__k">降权可逆</span><span>降权记录入库，复核后一键恢复原权重</span>
            <span class="oc-kv__k">降权 ≠ 删除</span><span>陈旧内容仍可检索（带标注），仅排序下调</span>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          陈旧清单
          <span class="oc-muted" style="font-size: 12px">每条附修复建议与权重</span>
        </h3>
        <Table
          :data="rows"
          :columns="[
            { colKey: 'findingId', title: '编号', width: 92 },
            { colKey: 'kind', title: '类型', width: 130, cell: 'cell' },
            { colKey: 'target', title: '目标', cell: 'cell' },
            { colKey: 'weight', title: '建议权重', width: 110, cell: 'cell' },
            { colKey: 'op', title: '操作', width: 150, cell: 'cell' },
          ]"
          row-key="findingId"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'kind'">
              <Tag size="small" :theme="kindTheme(row.kind)" variant="light-outline">{{ row.kind }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'target'">
              <span class="oc-mono" style="font-size: 12px">{{ row.target }}</span>
              <div class="oc-secondary" style="font-size: 12px; margin-top: 2px">{{ row.suggestion }}</div>
            </template>
            <template v-else-if="col.colKey === 'weight'">
              <Tag size="small" :theme="row.weight >= 0.4 ? 'danger' : 'warning'" variant="light-outline">降权 {{ row.weight }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'op'">
              <Tag v-if="applied.includes(row.findingId)" size="small" theme="success">已降权</Tag>
              <Button v-else size="small" variant="text" @click="applyDecay(row)">应用降权</Button>
              <Tag v-if="queuedInRepair(row.target)" size="small" theme="primary" variant="light-outline">已入修复队列</Tag>
              <Button v-else size="small" variant="text" @click="sendToRepair(row)">修复</Button>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            贡献度量
            <span class="oc-muted" style="font-size: 12px">使用频次与采纳率（供团队评估知识资产价值）</span>
          </h3>
          <Table
            :data="data.governance.contributions"
            :columns="[
              { colKey: 'contributor', title: '贡献者', width: 150 },
              { colKey: 'source', title: '来源', cell: 'cell' },
              { colKey: 'usageCount', title: '使用次数', width: 110, cell: 'cell' },
              { colKey: 'acceptanceRate', title: '采纳率', width: 130, cell: 'cell' },
            ]"
            row-key="contributor"
            size="small"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'source'">
                <span class="oc-mono oc-truncate" style="max-width: 220px; display: block">{{ row.source }}</span>
              </template>
              <template v-else-if="col.colKey === 'usageCount'">{{ row.usageCount.toLocaleString('zh-CN') }}</template>
              <template v-else-if="col.colKey === 'acceptanceRate'">
                <Tag size="small" :theme="row.acceptanceRate >= 0.7 ? 'success' : row.acceptanceRate >= 0.5 ? 'warning' : 'danger'" variant="light-outline">
                  {{ (row.acceptanceRate * 100).toFixed(0) }}%
                </Tag>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            失效反馈队列
            <span class="oc-muted" style="font-size: 12px">用户 / Agent 标记「此知识有误」后进入修复</span>
          </h3>
          <Table
            :data="queue"
            :columns="[
              { colKey: 'target', title: '目标', cell: 'cell' },
              { colKey: 'kind', title: '类型', width: 160 },
              { colKey: 'reporter', title: '报告人', width: 150 },
              { colKey: 'state', title: '状态', width: 96, cell: 'cell' },
            ]"
            row-key="id"
            size="small"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'target'">
                <span class="oc-mono oc-truncate" style="max-width: 240px; display: block; font-size: 12px">{{ row.target }}</span>
                <div class="oc-muted" style="font-size: 11px">{{ new Date(row.at).toLocaleString('zh-CN') }}</div>
              </template>
              <template v-else-if="col.colKey === 'state'">
                <Tag size="small" :theme="row.state === '已回写' ? 'success' : row.state === '修复中' ? 'primary' : 'warning'" variant="light-outline">
                  {{ row.state }}
                </Tag>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
        </div>
      </div>
    </StateShell>
  </div>
</template>
