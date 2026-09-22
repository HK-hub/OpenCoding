<script setup lang="ts">
/**
 * 为什么这么贵（S-13）：把成本归因到上下文区段（token 占比 × 混合单价）与具体调用（工具/模型序列），
 * 每条给出「多花的钱从哪来 + 可采取的动作」；附 10 项优化清单与 ROI，可逐项采用。溯源：卷 31 §4.2。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { db } from '@/mock/db';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const cost = db.sessionCost;
/** 混合单价（USD/token）：按入/出/缓存加权后的会话均值，口径与账本一致 */
const BLEND_UNIT_PRICE = 0.0000042;

const SECTION_HINT: Record<string, { driver: string; action: string }> = {
  S1: { driver: '组织策略与 DLP 长文本每轮全量携带', action: '稳定前缀已命中缓存；如需继续压缩需申请策略裁剪' },
  S2: { driver: '模式/角色/护栏三层提示词重复装载', action: '资产版本化已启用；避免中途改版本击穿缓存' },
  S3: { driver: '项目指令按目录全量装载', action: '启用目录级裁剪（仅装载命中路径的规则）' },
  S4: { driver: '记忆召回带置信与来源，条目偏多', action: '下调召回条数或提高相关度阈值（可调区段）' },
  S5: { driver: '知识检索三路召回 + 重排结果入上下文', action: '改为引用化（仅保留引用与摘要，按需再读）' },
  S6: { driver: '计划与验收清单结构化必保', action: '固定区段；可抑制重复计划快照写入' },
  S7: { driver: '对话历史最长、已发生 L2 摘要', action: '压缩已生效；可再触发一次 L2 摘要（需校验保真）' },
  S8: { driver: '工具结果外置后仍保留摘要与首尾片段', action: '扩大外置阈值命中面（>4k 默认外置已开启）' },
  S9: { driver: '当前指令尾部区段，随插话追加', action: '固定区段；合并碎片插话可减少重复携带' },
};

const sectionRows = computed(() => {
  const totalTokens = db.contextSections.reduce((a, s) => a + s.tokens, 0);
  return db.contextSections
    .map((s) => {
      const sectionCost = Number((s.tokens * BLEND_UNIT_PRICE).toFixed(4));
      return {
        code: s.code,
        name: s.name,
        tokens: s.tokens,
        sharePct: Number(((s.tokens / Math.max(1, totalTokens)) * 100).toFixed(1)),
        cost: sectionCost,
        ...SECTION_HINT[s.code],
      };
    })
    .sort((a, b) => b.cost - a.cost);
});

const callRows = computed(() => [
  ...cost.byTool.map((t) => ({ kind: '工具', label: t.name, cost: t.value, note: '工具调用的模型轮次成本（含重试）' })),
  ...cost.byModelSeries.map((m) => ({ kind: '模型序列', label: m.name, cost: m.points[m.points.length - 1]?.y ?? 0, note: '该序列累计成本（最后采样点）' })),
]);

interface Optimization { rank: number; measure: string; savingPct: string; effort: string; risk: string; adopted: boolean }

const optimizations = ref<Optimization[]>([
  { rank: 1, measure: '提示词缓存（稳定前缀 + 断点标记）', savingPct: '18%–24%', effort: '低（已基本启用）', risk: '低：前缀变更会击穿命中', adopted: true },
  { rank: 2, measure: '规则路由（简单任务走廉价模型）', savingPct: '12%–20%', effort: '中：需维护路由规则', risk: '中：误路由影响质量，可 A/B 灰度', adopted: false },
  { rank: 3, measure: '上下文压缩（L1 外置 + L2 摘要）', savingPct: '14%–22%', effort: '低：阈值已内建', risk: '低：保真断言兜底', adopted: true },
  { rank: 4, measure: '工具结果外置（>4k token）', savingPct: '8%–15%', effort: '低', risk: '低：再读需重新鉴权', adopted: true },
  { rank: 5, measure: '端侧小模型（分类/摘要类前置）', savingPct: '6%–12%', effort: '高：需部署与评测', risk: '中：能力上限低，需回退路径', adopted: false },
  { rank: 6, measure: '嵌入批处理（知识索引合并请求）', savingPct: '4%–9%', effort: '低', risk: '低：批量失败需分片重试', adopted: false },
  { rank: 7, measure: '内容寻址去重（相同工件只存引用）', savingPct: '3%–8%', effort: '中：需存储改造', risk: '低：哈希碰撞概率可忽略', adopted: false },
  { rank: 8, measure: '遥测采样（性能类降采样）', savingPct: '1%–3%', effort: '低', risk: '低：仅影响观测精度', adopted: true },
  { rank: 9, measure: '预算动态回收（闲置子 Agent 回收）', savingPct: '5%–10%', effort: '中：需团队配额联动', risk: '中：回收时机误判影响长任务', adopted: false },
  { rank: 10, measure: '缓存亲和重排（同前缀请求就近路由）', savingPct: '6%–11%', effort: '高：路由层改造', risk: '中：跨区域延迟上升', adopted: false },
]);

const adoptedCount = computed(() => optimizations.value.filter((o) => o.adopted).length);
const estSaving = computed(() => Number((cost.total * 0.68).toFixed(4)));

function adopt(o: Optimization) {
  o.adopted = true;
  ui.track('cost.optimization.adopted', { rank: o.rank });
  MessagePlugin.success(`已采用「${o.measure}」：将进入试点（预计节省 ${o.savingPct}），可在成本总览对比前后成效`);
}

const sectionColumns = [
  { colKey: 'name', title: '区段', width: 200 }, { colKey: 'share', title: 'token 占比', width: 130 }, { colKey: 'cost', title: '估算成本', width: 120 },
  { colKey: 'driver', title: '多花的钱从哪来', width: 300 }, { colKey: 'action', title: '可采取的动作', ellipsis: true },
];
const optColumns = [
  { colKey: 'rank', title: '#', width: 50 }, { colKey: 'measure', title: '优化项', width: 240 }, { colKey: 'savingPct', title: '节省比例', width: 110 },
  { colKey: 'effort', title: '实施成本', width: 150 }, { colKey: 'risk', title: '风险', ellipsis: true }, { colKey: 'adopted', title: '状态', width: 110 },
];

onMounted(() => {
  window.setTimeout(() => { state.value = sectionRows.value.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="为什么这么贵" volume="卷 31" manifest="S-13"
      desc="成本解释投影：先归因到上下文区段，再归因到具体调用；每条给出可执行动作，并附 10 项优化清单与 ROI。"
      cli="oc cost explain --session S-4001 --attribute sections,tools --with-actions"
      :status="[{ label: `混合单价 $${BLEND_UNIT_PRICE}/token`, theme: 'default' }, { label: `可省约 $${estSaving}`, theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">重新归因</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state" trace-id="trace-why-4d18" :page-size="6"
      empty-title="没有可归因的成本" empty-desc="本会话没有产生调用记录，无法解释成本来源（先用会话工作台发起一次任务）。"
      empty-action="返回会话工作台" example-task="查看 S7 对话历史的历史累计归因，并采用「规则路由」优化项"
      what="成本归因失败" why="区段 token 归因与计量账本版本不一致（差量 >1%）"
      how="可重试；失败时只展示已对账部分，不给出不可信的估算"
      collapsed-summary="归因行超过单页阈值，仅展开 Top 6（长尾合并为「其它」）。"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已返回会话工作台（只读跳转）')"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="本会话成本" :value="cost.total" format="cost" icon="discount" />
        <StatCard label="可优化空间" :value="estSaving" format="cost" icon="chart" hint="按已采用项叠加估算（上界）" :lower-is-better="true" />
        <StatCard label="优化项已采用" :value="adoptedCount" unit="/ 10" icon="check" />
        <StatCard label="缓存已省" :value="cost.cacheReadTokens * BLEND_UNIT_PRICE * 0.9" format="cost" icon="refresh" hint="缓存折扣单列，不混入净成本" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">归因一：上下文区段（token 占比 × 混合单价）</div>
        <Table :data="sectionRows" row-key="code" size="small" :columns="sectionColumns" :pagination="undefined">
          <template #name="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.code }}</span> <span style="font-size: 12px">{{ row.name }}</span></template>
          <template #share="{ row }">
            <div class="oc-flex" style="gap: 6px; align-items: center">
              <span class="oc-mono" style="font-size: 11px">{{ row.sharePct }}%</span>
              <span class="oc-muted" style="font-size: 11px">{{ (row.tokens / 1000).toFixed(1) }}k</span>
            </div>
          </template>
          <template #cost="{ row }"><span class="oc-mono" style="font-size: 11px">${{ row.cost.toFixed(4) }}</span></template>
          <template #driver="{ row }"><span style="font-size: 12px">{{ row.driver }}</span></template>
          <template #action="{ row }"><span style="font-size: 12px">{{ row.action }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">归因二：具体调用</div>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="c in callRows" :key="`${c.kind}-${c.label}`" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <Tag size="small" variant="outline">{{ c.kind }}</Tag>
              <span class="oc-mono" style="font-size: 11px; min-width: 140px">{{ c.label }}</span>
              <span class="oc-mono" style="font-size: 11px">${{ c.cost.toFixed(4) }}</span>
              <span class="oc-muted" style="font-size: 11px">{{ c.note }}</span>
            </div>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">口径与边界</div>
          <InfoGrid :columns="1" :items="[
            { key: 'unit', label: '混合单价', value: `$${BLEND_UNIT_PRICE}/token（入/出/缓存加权均值）` }, { key: 'err', label: '归因误差', value: '区段归因与账本误差 ≤1%；超差时禁用归因表' },
            { key: 'cache', label: '缓存折扣', value: '折扣单列展示，避免把「已省」当作「已花」' }, { key: 'advice', label: '建议性质', value: '所有优化均为建议：采用前先看 ROI 与风险，不自动改配置' },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">十项优化清单（ROI + 采用）</div>
        <Table :data="optimizations" row-key="rank" size="small" :columns="optColumns" :pagination="undefined">
          <template #adopted="{ row }">
            <Tag v-if="row.adopted" size="small" theme="success" variant="light-outline">已采用</Tag>
            <Button v-else size="small" theme="primary" variant="outline" @click="adopt(row as Optimization)">采用</Button>
          </template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc cost explain --adopt 'prompt-cache,context-compaction' --dry-run" />
          <CopyableId id="trace-why-4d18" label="复制 traceId" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
