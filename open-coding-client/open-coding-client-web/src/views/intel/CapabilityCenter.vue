<script setup lang="ts">
/**
 * 增强能力中心（N3-01）：8 项能力卡（类别徽标 / 触发面 / 启用开关）+ 四指标 KPI。
 * 溯源：卷 35 §1.3/§5.3；BUILD-MANIFEST N3-01。
 * 共性约束 C1–C8 对 8 项全部生效：标注归属、可校订、不自动合并、强制引用、成本可见、默认只读。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Select, Switch, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import { intelData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

const caps = ref(intelData.capabilities.map((c) => ({ ...c })));
const catFilter = ref<'全部' | '生成' | '审查' | '检测' | '汇总'>('全部');

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onCat(v: unknown) {
  catFilter.value = String(v) as typeof catFilter.value;
}

const rows = computed(() => (catFilter.value === '全部' ? caps.value : caps.value.filter((c) => c.category === catFilter.value)));
const enabled = computed(() => caps.value.filter((c) => c.enabled).length);
const avgAdopt = computed(() => (caps.value.reduce((a, c) => a + c.adoptionRatio, 0) / caps.value.length) * 100);
const avgFp = computed(() => (caps.value.reduce((a, c) => a + c.falsePositiveRatio, 0) / caps.value.length) * 100);
const savedHours = computed(() => Math.round(caps.value.reduce((a, c) => a + c.timeSavedMinutes, 0) / 60));
const avgCost = computed(() => caps.value.reduce((a, c) => a + c.costPerRun, 0) / caps.value.length);

const CAT_THEME: Record<string, 'primary' | 'success' | 'warning' | 'default'> = { 生成: 'primary', 审查: 'success', 检测: 'warning', 汇总: 'default' };

function toggle(row: { id: string; name: string; enabled: boolean }) {
  row.enabled = !row.enabled;
  MessagePlugin.success(row.enabled ? `已启用「${row.name}」：默认只读，写入按能力声明与预授权` : `已停用「${row.name}」：不再触发，已有草稿保留`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = caps.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="增强能力中心"
      desc="8 项能力（生成 / 审查 / 检测 / 汇总）共用共性约束：产出标注「AI 生成 + 模型 + 提示词版本」、可校订、不自动合并、强制引用、成本可见。"
      volume="卷 35" manifest="N3-01" cli="oc ai capability list --show-metrics"
      :status="[{ label: `${enabled}/${caps.length} 已启用`, theme: enabled ? 'success' : 'default' }, { label: '能力 ID 为稳定键', theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="catFilter" size="small" style="width: 150px" aria-label="按类别筛选" :options="['全部', '生成', '审查', '检测', '汇总'].map((c) => ({ value: c, label: c }))" @change="onCat" />
        <Button size="small" variant="outline" @click="router.push('/intel/budget')">预算与熔断</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在装载能力描述符（缺字段即注册失败）…"
      empty-title="没有已注册能力" empty-desc="能力包未注册或企业强制关闭（open-coding.intel.enabled=false）；可用能力清单可在此查看。"
      empty-action="重新装载能力包" example-task="启用「仓库知识问答」，提出一个无依据问题观察明确拒答"
      what="能力注册表加载失败" why="能力描述符缺任一必填字段（触发面 / 输出契约 / 门禁档 / 写范围）"
      how="修正描述符后重新装载；注册失败即 Fail-Fast（不静默降级到内置能力）" trace-id="trace-31ab7d95"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="启用能力" :value="`${enabled} / ${caps.length}`" format="raw" icon="robot" hint="企业可强制关闭单能力（open-coding.intel.*）" />
        <StatCard label="平均采纳率" :value="avgAdopt" format="percent" icon="thumb-up" :delta="4.1" :lower-is-better="false" :target="60" hint="四指标之一：可查（卷 26 在线指标面）" />
        <StatCard label="平均误报率" :value="avgFp" format="percent" icon="bug" :delta="-2.3" hint="误报回流评测集并触发规则降权（C8）" />
        <StatCard label="周节省时长" :value="savedHours" unit="h" icon="time" :delta="9.4" :lower-is-better="false" hint="按能力加总（含检测类收益）" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">共性约束（对 8 项全部生效，逐条可校验）</div>
          <div class="oc-stack" style="gap: 4px; font-size: 12px">
            <div><b>C1</b> 产出必须标注「AI 生成 + 模型 + 提示词版本」——缺失即被质量门禁拦截</div>
            <div><b>C2</b> 产出为草稿，人工可校订；不得覆盖人类既有内容（冲突并排展示）</div>
            <div><b>C3</b> 不自动合并：只提 PR / 评论 / 隔离标记，合并权始终在人</div>
            <div><b>C4</b> 结论类输出必须带引用（文件 + 行 / 文档 + 版本 / 事件 ID），无引用标注「推断」</div>
            <div><b>C5</b> 每次运行上报成本；超预算即停并保留已完成部分</div>
            <div><b>C6</b> 默认只读；写入按能力声明与预授权（决策链照常裁决）</div>
            <div><b>C7</b> 四项质量度量可查（采纳率 / 误报率 / 节省时长 / 单位成本）</div>
            <div><b>C8</b> 误报与驳回样本回流评测集，命中阈值的规则自动降级（两段式）</div>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">四指标口径与目标</div>
          <div class="oc-grid oc-grid--2">
            <StatCard label="平均单次成本" :value="avgCost" format="cost" icon="discount" :target="1.2" :lower-is-better="true" hint="模型分级路由 + 上下文缓存" />
            <StatCard label="误报回流" :value="intelData.feedbackQueue.filter((f) => f.category === '误报').length" icon="refresh" hint="回灌 → 评测用例 → 规则降权" />
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            指标缺失即视为能力未交付（REQ-INTEL-18）；数据源不可用时显式标注缺口，不推断。
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--3">
        <div v-for="c in rows" :key="c.id" class="oc-card" style="cursor: pointer" @click="router.push(`/intel/capabilities/${c.id}`)">
          <div class="oc-flex--between">
            <b>{{ c.name }}</b>
            <Tag size="small" :theme="CAT_THEME[c.category]" variant="light-outline">{{ c.category }}</Tag>
          </div>
          <div class="oc-mono oc-muted" style="font-size: 11px; margin: 4px 0">{{ c.id }}</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag v-for="t in c.triggers" :key="t" size="small" variant="outline">{{ t }}</Tag>
          </div>
          <div class="oc-divider" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px">
            <Tag size="small" variant="outline">采纳 {{ (c.adoptionRatio * 100).toFixed(0) }}%</Tag>
            <Tag size="small" variant="outline">误报 {{ (c.falsePositiveRatio * 100).toFixed(0) }}%</Tag>
            <Tag size="small" variant="outline">节省 {{ c.timeSavedMinutes }}min/次</Tag>
            <Tag size="small" variant="outline">${{ c.costPerRun.toFixed(2) }}/次</Tag>
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Switch :value="c.enabled" size="small" @click.stop @change="() => toggle(c)" />
            <span class="oc-muted" style="font-size: 12px">{{ c.enabled ? '已启用' : '已停用' }}</span>
            <span class="oc-grow" />
            <Tag size="small" variant="outline">预算 ${{ c.budget.runUsd }}/次</Tag>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
