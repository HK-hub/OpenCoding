<script setup lang="ts">
/**
 * 风险登记册（Y-05）：Top 15 风险（影响/概率/缓解措施/状态/复评时间），按风险值降序；
 * 影响与概率使用 5 级 Tag（极高/高/中高/中/低）；季度复评按钮更新复评时间并提示责任人。
 * 溯源：卷 26 / BUILD-MANIFEST Y-05。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

type Level = '极高' | '高' | '中高' | '中' | '低';
type RiskStatus = '缓解中' | '监控中' | '待缓解' | '已缓解';
const LEVEL_SCORE: Record<Level, number> = { 极高: 5, 高: 4, 中高: 3, 中: 2, 低: 1 };
const LEVEL_THEME: Record<Level, 'danger' | 'warning' | 'primary' | 'default' | 'success'> = { 极高: 'danger', 高: 'warning', 中高: 'primary', 中: 'default', 低: 'success' };

interface Risk { name: string; impact: Level; probability: Level; mitigation: string; status: RiskStatus; reviewAt: string; owner: string }

const RISKS_SEED: Risk[] = [
  { name: '内核契约膨胀', impact: '高', probability: '中高', mitigation: '破坏性变更必走评审；每季度契约瘦身评审；只增不改原则', status: '缓解中', reviewAt: '2026-10-15', owner: '内核组' },
  { name: '长任务质量', impact: '极高', probability: '中高', mitigation: '检查点续跑 + 长任务子集独立评测权重 + 阶段化验收', status: '缓解中', reviewAt: '2026-10-15', owner: '内核组' },
  { name: '沙箱绕过', impact: '极高', probability: '低', mitigation: '五档隔离 + 逃逸零容忍红队 + 平台能力矩阵显式降级标注', status: '监控中', reviewAt: '2026-11-01', owner: '安全组' },
  { name: '成本失控', impact: '高', probability: '中', mitigation: '预算水位告警 + 超支前拦截 + 缓存折扣单列 + 单位经济性看板', status: '缓解中', reviewAt: '2026-09-01', owner: '成本治理组' },
  { name: '多端状态不一致', impact: '中高', probability: '高', mitigation: '事件增量推送 + 冲突可重放 + J7 旅程每日执行', status: '缓解中', reviewAt: '2026-10-20', owner: '平台工程组' },
  { name: '插件生态安全', impact: '极高', probability: '中', mitigation: '扩展点隔离 + 装载前权限校验；C10 未闭环前禁止第三方插件进入生产', status: '待缓解', reviewAt: '2026-11-15', owner: '生态组' },
  { name: '迁移事故', impact: '高', probability: '中', mitigation: '迁移演练门禁 + 双写校验 + 回滚快照与限时回滚演练', status: '缓解中', reviewAt: '2026-10-30', owner: '数据组' },
  { name: '模型供应商变更', impact: '中高', probability: '中高', mitigation: '四协议适配层 + 契约测试；端点切换需灰度并重立基线', status: '监控中', reviewAt: '2026-10-10', owner: '模型平台组' },
  { name: '团队 ROI', impact: '中', probability: '中高', mitigation: '单位经济性看板；采纳率与回退率联动评审，低 ROI 能力可下线', status: '监控中', reviewAt: '2026-10-25', owner: '产品组' },
  { name: '上下文压缩', impact: '中高', probability: '中', mitigation: '压缩后引用保留断言 + 未决项不丢失 + J10 每日执行', status: '缓解中', reviewAt: '2026-10-18', owner: '内核组' },
  { name: '合规超出', impact: '中高', probability: '中', mitigation: '审计链只追加 + DLP 脱敏预览 + 驻留策略与跨租户留痕', status: '监控中', reviewAt: '2026-11-20', owner: '合规组' },
  { name: '生态冷启动', impact: '中', probability: '高', mitigation: '插件 SDK + 示例模板 + 分发通道（P4 前只开放内部插件）', status: '监控中', reviewAt: '2026-12-01', owner: '生态组' },
  { name: '性能退化', impact: '高', probability: '中高', mitigation: '8 场景基准定期重跑；未达标标红并阻断容量类发布', status: '缓解中', reviewAt: '2026-10-05', owner: 'SRE' },
  { name: '双端漂移', impact: '中', probability: '中高', mitigation: 'CLI 等价命令 + 双端能力对照自审 + 三端旅程断言', status: '缓解中', reviewAt: '2026-10-22', owner: '前端组' },
  { name: '知识集中', impact: '中高', probability: '中', mitigation: '决策日志 + Runbook + 轮岗演练（关键路径至少两人可执行）', status: '缓解中', reviewAt: '2026-11-10', owner: '质量与运维组' },
];

const risks = ref<Risk[]>(RISKS_SEED.map((r) => ({ ...r })));
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(10);
const lastReviewAt = ref('2026-07-01');
const err = ref(makeError('NOT_FOUND', '风险登记册索引未命中（风险库快照缺页）'));

const columns = [
  { colKey: 'name', title: '风险', width: 170 },
  { colKey: 'score', title: '风险值', width: 90 },
  { colKey: 'impact', title: '影响', width: 90 },
  { colKey: 'probability', title: '概率', width: 90 },
  { colKey: 'mitigation', title: '缓解措施', width: 360 },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'reviewAt', title: '复评时间', width: 130 },
];
const score = (r: Risk) => LEVEL_SCORE[r.impact] * LEVEL_SCORE[r.probability];
const sorted = computed(() => [...risks.value].sort((a, b) => score(b) - score(a)));
const shown = computed(() => sorted.value.slice(0, pageSize.value));
const extreme = computed(() => risks.value.filter((r) => r.impact === '极高' || r.probability === '极高').length);
const overdue = computed(() => risks.value.filter((r) => r.reviewAt < '2026-09-12').length);
const pending = computed(() => risks.value.filter((r) => r.status === '待缓解' || r.status === '监控中').length);

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = risks.value.length > pageSize.value ? 'EDGE_DATA' : risks.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
}

/** 季度复评：统一推进复评时间到下一季度并通知责任人；未缓解项不因复评而转绿 */
function quarterReview() {
  risks.value = risks.value.map((r) => ({ ...r, reviewAt: '2026-12-15' }));
  lastReviewAt.value = '2026-09-12';
  MessagePlugin.success('季度复评完成：15 项复评时间已更新至 2026-12-15；待缓解项（插件生态安全）保持标红直到 C10 闭环');
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="风险登记册"
      desc="Top 15 风险按风险值（影响 × 概率）排序：每条必须有缓解措施、责任组与复评时间；复评只更新时间，不自动降低等级。"
      volume="卷 26"
      manifest="Y-05"
      cli="oc quality risks list --top 15 --with-mitigation && oc quality risks review --quarter Q4"
      :status="[{ label: `极高影响 ${extreme} 项`, theme: extreme ? 'danger' : 'success' }, { label: `复评逾期 ${overdue} 项`, theme: overdue ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="季度复评将把 15 项复评时间统一推进到 2026-12-15 并通知责任组；未缓解项保持标红（复评不等于降级）。" @confirm="quarterReview">
          <Button size="small" theme="primary">季度复评</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="在册风险" :value="risks.length" format="number" icon="error" hint="Top 15 与季度评审范围一致" />
      <StatCard label="极高影响 / 极高概率" :value="extreme" format="number" icon="flag" :lower-is-better="true" hint="长任务质量 / 沙箱绕过 / 插件生态安全" />
      <StatCard label="需持续关注" :value="pending" format="number" icon="time" hint="监控中 + 待缓解" />
      <StatCard label="复评逾期" :value="overdue" format="number" icon="calendar" :lower-is-better="true" :hint="`最近复评：${lastReviewAt}`" />
    </div>

    <StateShell
      :state="state"
      empty-title="风险登记册为空"
      empty-desc="未读取到风险条目（风险库可能未初始化）。空册不等于无风险，发布检查单将记为未通过。"
      empty-action="重新拉取风险册"
      example-task="查看「插件生态安全」的缓解路径与复评时间"
      what="风险登记册加载失败"
      :why="err.message"
      how="可重试；读取失败时以最近一次季度评审归档为准，页面标注数据可能滞后。"
      :trace-id="err.traceId"
      :collapsed-summary="`共 ${risks.length} 项风险，已折叠展示风险值前 ${pageSize} 项`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize = risks.length"
      @empty-action="refresh"
    >
      <div class="oc-card">
        <div class="oc-card__title">Top 15 风险（按风险值降序）</div>
        <Table row-key="name" size="small" :data="shown" :columns="columns">
          <template #name="{ row }">
            <b style="font-size: 12px">{{ row.name }}</b>
            <div class="oc-muted" style="font-size: 11px">责任组：{{ row.owner }}</div>
          </template>
          <template #score="{ row }"><span class="oc-mono">{{ score(row) }}</span></template>
          <template #impact="{ row }"><Tag size="small" variant="light-outline" :theme="LEVEL_THEME[row.impact as Level]">{{ row.impact }}</Tag></template>
          <template #probability="{ row }"><Tag size="small" variant="light-outline" :theme="LEVEL_THEME[row.probability as Level]">{{ row.probability }}</Tag></template>
          <template #mitigation="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.mitigation }}</span></template>
          <template #status="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.status === '待缓解' ? 'danger' : row.status === '监控中' ? 'warning' : 'success'">{{ row.status }}</Tag>
          </template>
          <template #reviewAt="{ row }">
            <div class="oc-flex" style="gap: 4px">
              <span class="oc-mono">{{ row.reviewAt }}</span>
              <Tag v-if="row.reviewAt < '2026-09-12'" size="small" variant="light-outline" theme="danger">逾期</Tag>
            </div>
          </template>
        </Table>
        <CliHint command="oc quality risks show --name 插件生态安全 --explain" label="查看单项风险详情" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">复评纪律</div>
          <InfoGrid
            :columns="2"
            :items="[
              { key: 'cadence', label: '复评节奏', value: '季度全量复评 + 触发式复评（严重事故 / 门禁红灯 / 供应商变更）' },
              { key: 'rule', label: '降级规则', value: '降级需给出证据（缓解措施生效 + 观测窗口无复发），禁止因「复评到期」自动降级' },
              { key: 'escalate', label: '升级规则', value: '逾期未复评自动升级到质量周会；连续两季度未缓解的风险升级为发布阻断项' },
              { key: 'owner', label: '责任到组', value: '每条风险必须绑定责任组，禁止只写「平台团队」' },
            ]"
          />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">待缓解 / 逾期明细（不静默）</div>
          <div v-for="r in risks.filter((x) => x.status === '待缓解' || x.reviewAt < '2026-09-12')" :key="r.name" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
            <Tag size="small" variant="light-outline" :theme="r.status === '待缓解' ? 'danger' : 'warning'">{{ r.status }}</Tag>
            <b style="font-size: 12px">{{ r.name }}</b>
            <span class="oc-secondary" style="font-size: 12px">复评 {{ r.reviewAt }}（责任组：{{ r.owner }}）</span>
          </div>
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <CopyableId id="trace-risk-q3-88f2" label="复制风险快照 traceId" />
            <span class="oc-muted" style="font-size: 12px">风险值 = 影响分值 × 概率分值（5 级制，满分 25）。</span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
