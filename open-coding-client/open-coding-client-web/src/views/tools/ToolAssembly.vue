<script setup lang="ts">
/** 工具集装配（T-03）：模式驱动子集 + 按需加载（deferred）+ token 占用估算。溯源：卷 05 D-TOOL-6 */
import { computed, onMounted, ref } from 'vue';
import { Button, Popconfirm, RadioButton, RadioGroup, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { ToolFamily } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { tools, summary } = toolData;

/** 模式驱动的核心族集合（编码核心 18–24 个，其余族按需激活） */
const MODE_FAMILIES: Record<string, ToolFamily[]> = {
  coding: ['文件读取', '文件写入', '搜索', '命令', '版本控制', '代码质量', '任务与计划'],
  plan: ['文件读取', '搜索', '任务与计划', '诊断'],
  review: ['文件读取', '搜索', '版本控制', '诊断'],
  debug: ['文件读取', '搜索', '命令', '代码质量', '诊断'],
  research: ['文件读取', '搜索', '检索与记忆', '网络'],
  design: ['文件读取', '文件写入', '搜索', '多模态', '任务与计划'],
};

const mode = ref('coding');
const deferredOn = ref(true);
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const err = ref(makeError('INVALID_ARGUMENT', 'mode=coding 时核心集为空'));

const coreFamilies = computed(() => MODE_FAMILIES[mode.value] ?? []);
const core = computed(() => tools.filter((t) => t.enabled && coreFamilies.value.includes(t.family) && !t.deferred));
const deferredList = computed(() => tools.filter((t) => t.enabled && t.deferred));
const assembled = computed(() => (deferredOn.value ? [...core.value, ...deferredList.value] : core.value));

/** token 估算：参数 Schema + 描述 + 示例文案的字符数换算（≈3.6 字符/token） */
function tokensOf(name: string): number {
  const t = tools.find((x) => x.name === name);
  if (!t) return 0;
  const chars = t.description.length + t.paramSchema.reduce((a, p) => a + p.name.length + p.type.length + p.desc.length + p.range.length, 0) + t.examples.join('').length;
  return Math.round(chars / 3.6) + 42;
}
const tokenTotal = computed(() => assembled.value.reduce((a, t) => a + tokensOf(t.name), 0));
const budget = 2400;
const byFamily = computed(() => coreFamilies.value.map((f) => ({ name: f, value: assembled.value.filter((t) => t.family === f).reduce((a, t) => a + tokensOf(t.name), 0) })));

const columns = [
  { colKey: 'name', title: '工具', width: 180 },
  { colKey: 'family', title: '族', width: 100 },
  { colKey: 'riskLevel', title: '风险级', width: 106 },
  { colKey: 'tokens', title: 'token 占用', width: 110 },
  { colKey: 'modeState', title: '装配状态', width: 130 },
  { colKey: 'desc', title: '描述（提示词文案节选）', ellipsis: true },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = assembled.value.length === 0 ? 'EMPTY' : 'NORMAL';
  }, 220);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工具集装配"
      desc="全量暴露会吃掉上下文并降低工具选择准确率：按模式暴露核心集（18–24 个），长尾工具通过工具组激活或语义检索发现。"
      volume="卷 05"
      manifest="T-03"
      :cli="`oc tools assemble --mode ${mode} --deferred ${deferredOn ? 'on' : 'off'} --dry-run`"
      :status="[{ label: `当前模式 ${mode}`, theme: 'primary' }, { label: `核心集 ${core.length} 个`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="装配结果在下一轮生效；已在进行中的 Turn 不受影响（可随时切回）。确认应用？" @confirm="refresh()">
          <Button size="small" theme="primary">应用到下一轮</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="核心集工具数" :value="core.length" format="raw" icon="tools" hint="目标区间 18–24" :target="18" />
      <StatCard label="工具列表 token 占用" :value="tokenTotal" format="token" icon="layers" :target="budget" target-kind="max" hint="上限 2400 token（超出将裁剪非核心集）" />
      <StatCard label="按需加载工具" :value="deferredList.length" format="raw" icon="extension" hint="需激活或检索命中后才进入列表" />
      <StatCard label="上下文占比" :value="Number(((tokenTotal / 180000) * 100).toFixed(2))" format="percent" icon="chart" hint="相对 180k 上下文窗口" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <RadioGroup v-model="mode" size="small" @change="refresh">
        <RadioButton v-for="m in Object.keys(MODE_FAMILIES)" :key="m" :value="m">{{ m }}</RadioButton>
      </RadioGroup>
      <div class="oc-flex" style="gap: 6px">
        <Switch v-model="deferredOn" size="small" @change="refresh" />
        <span style="font-size: 12px">启用按需加载（deferred 工具随检索命中激活）</span>
      </div>
      <CliHint command="oc tools assemble --mode coding --explain" label="解释装配依据" />
    </div>

    <StateShell
      :state="state"
      empty-title="该模式没有可用工具"
      empty-desc="核心族集合为空（可能所有工具被禁用）。请切换模式或启用工具后重试。"
      empty-action="切换为 coding 模式"
      :what="`装配失败：模式 ${mode}`"
      :why="err.message"
      how="可切换模式重试；若持续失败请检查工具注册表状态（oc tools status）。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="mode = 'coding'; refresh()"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">token 占用分解（按族）</h3>
          <OcChart type="bar" :values="byFamily" :height="200" format="token" unit="token" aria-label="工具集 token 占用按族分解" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">装配说明（可解释）</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'mode', label: '模式驱动', value: `模式 ${mode} → 核心族：${coreFamilies.join('、')}` },
            { key: 'deferred', label: '按需加载', value: deferredOn ? '开启：deferred 工具进入列表但标记为「需激活」，仅命中检索时展开完整 Schema' : '关闭：长尾工具完全不可用（模型需显式请求激活）' },
            { key: 'budget', label: '预算守卫', value: `列表 ${tokenTotal} / ${budget} token；超限时按族优先级裁剪（保留核心集，裁剪多模态与诊断族）` },
            { key: 'alias', label: '别名收敛', value: '同一工具的多协议别名在装配期收敛为单一 name（避免重复占用）' },
            { key: 'fallback', label: '能力不满足', value: '所需能力（视觉/网络/沙箱档）不满足时工具不装配，且不静默降级' },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          装配清单（{{ assembled.length }} 个）
          <span class="oc-muted" style="font-size: 12px">核心集标记 + 按需加载标记 + token 占用</span>
        </h3>
        <Table row-key="name" size="small" :data="assembled" :columns="columns">
          <template #name="{ row }">
            <span class="oc-mono" style="font-weight: 600">{{ row.name }}</span>
          </template>
          <template #riskLevel="{ row }"><RiskBadge :level="row.riskLevel" /></template>
          <template #tokens="{ row }">
            <Tooltip :content="`描述 + 参数 Schema + 示例 ≈ ${tokensOf(row.name)} token`">
              <Tag size="small" variant="light-outline">{{ tokensOf(row.name) }}</Tag>
            </Tooltip>
          </template>
          <template #modeState="{ row }">
            <Tag v-if="!deferredOn && row.deferred" size="small" theme="default" variant="light-outline">未装配</Tag>
            <Tag v-else-if="row.deferred" size="small" theme="warning" variant="light-outline">按需激活</Tag>
            <Tag v-else size="small" theme="success" variant="light-outline">核心集</Tag>
          </template>
          <template #desc="{ row }"><span class="oc-secondary">{{ row.description }}</span></template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
