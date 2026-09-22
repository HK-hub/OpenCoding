<script setup lang="ts">
/** 危险命令规则（B-09）：内置 + 企业规则库 + 方言分组 + 命中记录 + 模型二次判定 + 误报控制。溯源：卷 07 D-SBOX-7 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { dangerRules, dangerHits } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const dialectFilter = ref('');
const tab = ref<'rules' | 'hits'>('rules');
const pageSize = ref(12);
const err = ref(makeError('INTERNAL_ERROR', '规则库热加载失败（YAML 解析错误：第 42 行缩进）'));

const ruleRows = computed(() => dangerRules.filter((r) => !dialectFilter.value || r.dialect === dialectFilter.value));
const shownRules = computed(() => ruleRows.value.slice(0, pageSize.value));
const shownHits = computed(() => dangerHits.slice(0, pageSize.value));
const falsePositives = computed(() => dangerHits.filter((h) => h.falsePositive).length);
const builtinCount = computed(() => dangerRules.filter((r) => r.builtin).length);

const categoryStats = computed(() => {
  const map = new Map<string, number>();
  dangerRules.forEach((r) => map.set(r.category, (map.get(r.category) ?? 0) + r.hits));
  return [...map.entries()].map(([name, value]) => ({ name, value }));
});

const ruleColumns = [
  { colKey: 'ruleId', title: '规则', width: 100 },
  { colKey: 'pattern', title: '模式（AST 规则）', width: 340 },
  { colKey: 'dialect', title: 'Shell 方言', width: 120 },
  { colKey: 'category', title: '类别', width: 140 },
  { colKey: 'severity', title: '级别', width: 80 },
  { colKey: 'action', title: '处置', width: 130 },
  { colKey: 'hits', title: '命中', width: 84 },
  { colKey: 'fp', title: '误报率', width: 100 },
  { colKey: 'note', title: '说明', ellipsis: true },
];
const hitColumns = [
  { colKey: 'hitId', title: '命中', width: 100 },
  { colKey: 'ruleId', title: '规则', width: 100 },
  { colKey: 'commandMasked', title: '命令（脱敏）', width: 340 },
  { colKey: 'dialect', title: '方言', width: 100 },
  { colKey: 'verdict', title: '判定', width: 190 },
  { colKey: 'modelSecondOpinion', title: '模型二次判定结论', ellipsis: true },
  { colKey: 'at', title: '时间', width: 170 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = dangerRules.length ? 'NORMAL' : 'EMPTY';
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
      title="危险命令规则"
      desc="拦截分层：① Shell 方言 AST 解析（POSIX sh / bash / PowerShell / cmd）② 规则库（内置 + 企业扩展）③ 高风险模式触发模型二次判定。含误报控制与申诉通道。"
      volume="卷 07"
      manifest="B-09"
      cli="oc sandbox danger rules --dialect bash --show-fp"
      :status="[{ label: `内置 ${builtinCount} 条`, theme: 'default' }, { label: `误报 ${falsePositives} 条（已申诉）`, theme: falsePositives ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="重载规则库会立即生效（含企业扩展规则）；重载期间的命令将按上一版本判定并标注版本差异。确认重载？" @confirm="MessagePlugin.success('规则库已重载：12 条规则（含 1 条企业扩展），版本 v7')">
          <Button size="small" theme="primary">重载规则库</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="规则总数" :value="dangerRules.length" format="raw" icon="bug" />
      <StatCard label="累计命中" :value="dangerRules.reduce((a, r) => a + r.hits, 0)" format="raw" icon="flag" />
      <StatCard label="硬阻断规则" :value="dangerRules.filter((r) => r.action === '阻断').length" format="raw" icon="close" hint="不可通过审批放宽（企业规则库）" />
      <StatCard label="模型二次判定规则" :value="dangerRules.filter((r) => r.action === '模型二次判定').length" format="raw" icon="robot" hint="覆盖未知模式，代价是延迟与成本" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Tag :theme="tab === 'rules' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="tab = 'rules'">规则库 {{ dangerRules.length }}</Tag>
      <Tag :theme="tab === 'hits' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="tab = 'hits'">命中记录 {{ dangerHits.length }}</Tag>
      <Select v-model="dialectFilter" size="small" clearable placeholder="Shell 方言" style="width: 160px" :options="['POSIX sh', 'bash', 'PowerShell', 'cmd', '通用'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc sandbox danger test --command 'rm -rf /' --dialect bash" label="试跑单条命令" />
    </div>

    <StateShell
      :state="state"
      empty-title="规则库为空"
      empty-desc="危险命令规则库未加载（异常态：规则库应始终包含内置规则）。"
      empty-action="重新加载"
      example-task="用 rm -rf $HOME 验证规则命中与模型二次判定"
      :what="'规则库加载失败'"
      :why="err.message"
      how="解析失败时保留上次成功版本（fail-safe）：命令仍按旧规则判定，不会因加载失败而放开拦截。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${tab === 'rules' ? ruleRows.length : dangerHits.length} 条，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 12; state = 'NORMAL'"
      @empty-action="dialectFilter = ''; refresh()"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">命中类别分布</h3>
          <OcChart type="bar" :values="categoryStats" :height="180" format="number" aria-label="危险命令命中类别分布" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">误报控制（可申诉）</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'f1', label: '分级处置', value: '阻断（P0）> 强制审批（P1）> 模型二次判定（疑似）——避免「一律阻断」导致正常命令被误拦' },
              { key: 'f2', label: '模型二次判定', value: '命中但语义可解释时交由模型判定（例：env | grep 排查变量缺失）；结论与分析一并留痕' },
              { key: 'f3', label: '申诉通道', value: '用户可标记误报并提交申诉；通过后进入例外清单（含范围与到期，需复核）' },
              { key: 'f4', label: '误报率观测', value: '按规则统计误报率：>30% 的规则进入复核队列（调优或降级为二次判定）' },
            ]"
          />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">{{ tab === 'rules' ? '规则库（内置 + 企业扩展）' : '命中记录（含模型二次判定结论）' }}</h3>
        <Table v-if="tab === 'rules'" row-key="ruleId" size="small" :data="shownRules" :columns="ruleColumns">
          <template #ruleId="{ row }">
            <span class="oc-mono">{{ row.ruleId }}</span>
            <Tag v-if="!row.builtin" size="small" theme="primary" variant="light-outline" style="margin-left: 4px">企业</Tag>
          </template>
          <template #pattern="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.pattern }}</span></template>
          <template #dialect="{ row }"><Tag size="small" variant="light-outline">{{ row.dialect }}</Tag></template>
          <template #severity="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.severity === 'P0' ? 'danger' : row.severity === 'P1' ? 'warning' : 'default'">{{ row.severity }}</Tag>
          </template>
          <template #action="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.action === '阻断' ? 'danger' : row.action === '强制审批' ? 'warning' : 'primary'">{{ row.action }}</Tag>
          </template>
          <template #fp="{ row }">
            <Tooltip :content="row.lastHitAt ? `最近命中：${new Date(row.lastHitAt).toLocaleString('zh-CN')}` : '尚无命中记录'">
              <Tag size="small" variant="light-outline" :theme="row.falsePositiveRate > 0.3 ? 'warning' : 'default'">{{ (row.falsePositiveRate * 100).toFixed(0) }}%</Tag>
            </Tooltip>
          </template>
          <template #note="{ row }"><span class="oc-secondary" style="font-size: 11px">{{ row.note }}</span></template>
        </Table>

        <Table v-else row-key="hitId" size="small" :data="shownHits" :columns="hitColumns">
          <template #hitId="{ row }"><span class="oc-mono">{{ row.hitId }}</span></template>
          <template #ruleId="{ row }"><span class="oc-mono">{{ row.ruleId }}</span></template>
          <template #commandMasked="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.commandMasked }}</span></template>
          <template #verdict="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.falsePositive ? 'warning' : row.verdict === '阻断' ? 'danger' : row.verdict === '转强制审批' ? 'warning' : 'success'">{{ row.verdict }}</Tag>
            <CopyableId :id="row.callId" label="调用" :short="8" />
          </template>
          <template #modelSecondOpinion="{ row }"><span class="oc-secondary" style="font-size: 11px">{{ row.modelSecondOpinion }}</span></template>
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
