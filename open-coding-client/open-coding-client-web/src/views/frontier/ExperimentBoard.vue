<script setup lang="ts">
/**
 * 实验阶梯看板（U-01）：按 lab / internal / beta / ga / dropped / deprecated 六列展示全部实验。
 * 溯源：卷 25 §3 五级阶梯与出口；BUILD-MANIFEST U-01。
 * 契约：活跃实验（lab~ga）上限 ≤ 8；beta 及以上默认可见并强制标注「实验」徽标；无退出条件不得进 beta。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Select, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { frontierData } from '@/mock/data/automation';
import type { Experiment, ExperimentLevel } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

/** 阶梯列定义：前四列为活跃态，后两列为出口（数据策略与可见性见 gates） */
const LEVELS: { level: ExperimentLevel; label: string; hint: string }[] = [
  { level: 'lab', label: 'lab 实验室', hint: '仅开发者 · 不上报' },
  { level: 'internal', label: 'internal 内部', hint: '团队内 · 匿名统计' },
  { level: 'beta', label: 'beta 灰度', hint: '白名单 · 全量指标（默认可见 + 实验徽标）' },
  { level: 'ga', label: 'ga 正式', hint: '全量（可配）· 默认开启' },
  { level: 'dropped', label: 'dropped 已终止', hint: '假设被否 · 归档 + 迁移建议' },
  { level: 'deprecated', label: 'deprecated 已替代', hint: '被更好方案取代 · 指引迁移' },
];
const LEVEL_THEME: Record<ExperimentLevel, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  lab: 'default', internal: 'primary', beta: 'warning', ga: 'success', dropped: 'danger', deprecated: 'danger',
};

const experiments = frontierData.experiments;
const activeCount = frontierData.activeCount;
const activeLimit = frontierData.activeLimit;
const atLimit = activeCount >= activeLimit;
/** 负样本守卫：进入 beta/ga 却缺少退出条件的实验条数（应为 0，非 0 即门禁异常） */
const missingExit = computed(() => experiments.filter((e) => (e.level === 'beta' || e.level === 'ga') && !e.exitCriteria).length);

function byLevel(level: ExperimentLevel): Experiment[] {
  return experiments.filter((e) => e.level === level);
}
function reviewDate(e: Experiment): string {
  return new Date(e.reviewDate).toLocaleDateString('zh-CN');
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function explainBadge() {
  MessagePlugin.info('「实验」徽标：beta 及以上实验在界面默认可见，且必须带该徽标；用户可一键关闭（见「实验开关与灰度」）。');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = experiments.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="实验阶梯看板"
      desc="每个方向都走同一阶梯：lab → internal → beta → ga；假设被否走 dropped，被更好方案取代走 deprecated，出口必须可解释。"
      volume="卷 25" manifest="U-01" cli="oc frontier board --group-by level" experimental
      :status="[
        { label: `活跃 ${activeCount} / 上限 ${activeLimit}`, theme: atLimit ? 'warning' : 'success' },
        { label: missingExit ? `${missingExit} 条缺退出条件` : '退出条件齐备', theme: missingExit ? 'danger' : 'default' },
      ]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="explainBadge">实验徽标说明</Button>
        <Button size="small" theme="primary" @click="router.push('/frontier/registry')">登记新实验</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在按阶梯聚合实验…"
      empty-title="还没有登记任何实验" empty-desc="实验必须先书面化假设与成功判据（lab 入口条件），再进入阶梯。"
      empty-action="去登记实验" example-task="查看 beta 列中一条实验的退出条件与数据策略"
      what="实验看板加载失败" why="实验登记册不可达（阶梯列由登记数据投影生成）"
      how="重试；已登记的实验在「实验登记」页仍可只读查看" 
      :collapsed-summary="`实验较多（${experiments.length} 条），看板已按阶梯折叠展示（边界数据态）。`" :page-size="experiments.length"
      @retry="demo = 'NORMAL'" @empty-action="router.push('/frontier/registry')" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="活跃实验" :value="activeCount" unit="个" icon="flag" :lower-is-better="false" :target="activeLimit" target-kind="max" hint="lab~ga 合计，超过上限须先释放或终止" />
        <StatCard label="beta 灰度中" :value="byLevel('beta').length" unit="个" icon="extension" hint="默认可见 + 「实验」徽标 + 租户级开关" />
        <StatCard label="已终止归档" :value="byLevel('dropped').length + byLevel('deprecated').length" unit="个" icon="history" :lower-is-better="true" hint="退出条件触发 → 归档数据 + 公告迁移建议" />
        <StatCard label="季度评审待办" :value="frontierData.reviews.at(-1)?.items.length ?? 0" unit="条" icon="calendar" hint="每季度评审必须有保留/推进/终止记录" />
      </div>

      <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-top: 12px">
        <div v-for="lv in LEVELS" :key="lv.level" class="oc-card" style="padding: 10px">
          <div class="oc-flex--between" style="align-items: center">
            <Tag size="small" :theme="LEVEL_THEME[lv.level]" variant="light-outline">{{ lv.label }}</Tag>
            <span class="oc-muted" style="font-size: 11px">{{ byLevel(lv.level).length }}</span>
          </div>
          <div class="oc-muted" style="font-size: 11px; margin: 6px 0">{{ lv.hint }}</div>

          <div v-for="e in byLevel(lv.level)" :key="e.id" class="oc-card" style="padding: 8px; margin-bottom: 8px; box-shadow: none; border: 1px solid var(--td-component-stroke)">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
              <span class="oc-mono" style="font-size: 11px">{{ e.id }}</span>
              <Tooltip v-if="lv.level === 'beta' || lv.level === 'ga'" content="beta 及以上默认可见，必须显示「实验」徽标且用户可关闭">
                <Tag size="small" theme="warning" variant="light-outline">实验</Tag>
              </Tooltip>
            </div>
            <div style="font-size: 13px; font-weight: 600; margin: 4px 0">{{ e.title }}</div>
            <div class="oc-clamp-2 oc-muted" style="font-size: 12px">假设：{{ e.hypothesis }}</div>
            <div class="oc-muted" style="font-size: 12px">成功判据：{{ e.successCriteria[0] }}</div>
            <div class="oc-flex oc-flex--wrap oc-muted" style="gap: 8px; margin-top: 6px; font-size: 12px">
              <span>负责人 {{ e.owner }}</span>
              <span>评审 {{ reviewDate(e) }}</span>
            </div>
            <div style="font-size: 12px; margin-top: 2px">
              成本已用 ${{ e.costSpent.toFixed(2) }} / ${{ e.budget.usd }}（独立预算，不占团队配额）
            </div>
            <div v-if="!e.exitCriteria" style="font-size: 12px; color: var(--td-error-color)">缺退出条件：不得进入 beta</div>
          </div>
          <div v-if="!byLevel(lv.level).length" class="oc-muted" style="font-size: 12px">本列暂无实验。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">阶梯门禁说明<CliHint command="oc frontier board explain --level beta" /></div>
        <div class="oc-muted" style="font-size: 13px">
          lab 只需假设与成功判据书面化；internal 需原型可演示；进入 beta 必须通过安全红队与质量基线，且退出条件非空（硬性规则）；
          ga 需指标达标与运维就绪。dropped / deprecated 一律「关闭 + 公告 + 迁移建议」，数据归档保留。
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <Tag size="small" variant="outline">活跃上限 {{ activeLimit }}，当前 {{ activeCount }}</Tag>
          <Tag v-if="atLimit" size="small" theme="warning" variant="light-outline">已达上限：新实验须先释放名额（终止或晋级合并）</Tag>
          <CopyableId id="trace-frontier-board-4a71" label="看板 traceId" short="12" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
