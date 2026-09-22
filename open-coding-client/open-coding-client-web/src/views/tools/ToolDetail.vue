<script setup lang="ts">
/** 工具详情（T-02）：三件套 + 参数 Schema 表 + 返回 Schema + 并发语义 + 幂等策略 + 能力需求。溯源：卷 05 §4.1/§4.6 */
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import StatCard from '@/components/common/StatCard.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const route = useRoute();
const { tools, decisions, sandboxTiers } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const current = ref(String(route.query.tool ?? 'edit_file'));
const err = ref(makeError('NOT_FOUND', `tool=${String(route.query.tool ?? '')}`));

const tool = computed(() => tools.find((t) => t.name === current.value) ?? tools[0]);
const relatedDecisions = computed(() => decisions.filter((d) => d.toolName === tool.value.name));
const tier = computed(() => sandboxTiers.find((t) => t.tier === tool.value.capabilityRequirements.sandboxTier));

const paramColumns = [
  { colKey: 'name', title: '参数', width: 150 },
  { colKey: 'type', title: '类型', width: 90 },
  { colKey: 'required', title: '必填', width: 74 },
  { colKey: 'range', title: '取值约束 / 默认值', width: 210 },
  { colKey: 'desc', title: '业务含义', ellipsis: true },
];
const retColumns = [
  { colKey: 'name', title: '返回字段', width: 160 },
  { colKey: 'type', title: '类型', width: 100 },
  { colKey: 'desc', title: '说明', ellipsis: true },
];

const schemaSample = computed(() => ({
  tool: tool.value.name,
  parameters: {
    type: 'object',
    properties: Object.fromEntries(tool.value.paramSchema.map((p) => [p.name, { type: p.type, required: p.required, constraint: p.range }])),
    required: tool.value.paramSchema.filter((p) => p.required).map((p) => p.name),
  },
  canonical: { projectedTo: ['anthropic', 'openai', 'gemini', 'ollama'], degraded: tool.value.family === '命令' ? 'gemini 投射时 enum → string（已降级并留痕）' : '' },
}));

function check() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = tools.some((t) => t.name === current.value) ? 'NORMAL' : 'ERROR';
  }, 200);
}

function onPick(v: unknown) {
  current.value = String(v ?? '');
  ui.track('tool.inspect', { tool: current.value });
  check();
}

onMounted(() => {
  check();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工具详情"
      desc="契约三段模型：声明（Spec）/ 绑定（Binding）/ 校验（Validate）——本页展示声明段全量字段与三件套（描述 + 示例 + 常见错误）。"
      volume="卷 05"
      manifest="T-02"
      :cli="`oc tools inspect ${tool.name}`"
      :status="[{ label: tool.enabled ? '启用' : '已禁用', theme: tool.enabled ? 'success' : 'default' }, { label: `来源 ${tool.sourceChannel}`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Popconfirm theme="warning" content="卸载该工具会使引用它的宏与技能失效（可重新启用，不丢配置）。确认卸载？" @confirm="MessagePlugin.warning('已提交卸载请求：本会话结束后生效（可撤销窗口 10s）')">
          <Button size="small" variant="outline">卸载工具</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="调用总量" :value="tool.callsTotal" icon="task" hint="近 30 天累计（含子 Agent 调用）" />
      <StatCard label="错误率" :value="tool.errorRate" format="percent" icon="bug" :delta="0.6" />
      <StatCard label="平均耗时" :value="tool.avgLatencyMs" unit="ms" format="raw" icon="time" />
      <StatCard label="超时上限" :value="tool.timeoutMs" unit="ms" format="raw" icon="secured" hint="超时 → 终止进程组并返回部分结果" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select
        :model-value="current"
        size="small"
        style="width: 260px"
        :options="tools.map((t) => ({ label: `${t.name}（${t.family}）`, value: t.name }))"
        @change="onPick"
      />
      <RiskBadge :level="tool.riskLevel" show-desc />
      <Tag v-for="tag in tool.tags" :key="tag" size="small" variant="light-outline">{{ tag }}</Tag>
    </div>

    <StateShell
      :state="state"
      empty-title="工具不存在"
      empty-desc="该工具名未在注册表中命中，可能已被删除或来自未安装的工具包。"
      empty-action="返回工具目录"
      :what="`工具「${current}」加载失败`"
      :why="err.message"
      how="请从下拉重新选择；若刚安装工具包，请等待包扫描完成（约 2s）。"
      :trace-id="err.traceId"
      @retry="check"
      @empty-action="onPick('edit_file')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">三件套 · 描述（提示词文案）</h3>
          <p class="oc-secondary" style="font-size: 12px; margin: 0 0 10px">{{ tool.description }}</p>
          <InfoGrid :columns="1" :items="[
            { key: 'concurrency', label: '并发语义', value: tool.concurrencySemantics, span: 1 },
            { key: 'idem', label: '幂等策略', value: tool.idempotencyPolicy, span: 1 },
            { key: 'limits', label: '输出 / 调用限额', value: `单次输出 ≤ ${(tool.limits.maxOutputBytes / 1024).toFixed(0)} KB；每回合 ≤ ${tool.limits.maxCallsPerTurn} 次` },
            { key: 'tier', label: '能力需求 · 沙箱档', value: `${tool.capabilityRequirements.sandboxTier}（${tier?.tech.slice(0, 28) ?? '—'}…）`, hint: tier ? `启动开销 ${tier.startupCost}` : undefined },
            { key: 'vision', label: '需要视觉能力', value: tool.capabilityRequirements.vision ? '是（不支持时返回 capability 错误，不静默降级）' : '否' },
            { key: 'network', label: '需要网络', value: tool.capabilityRequirements.network ? '是（受网络策略与审计代理约束）' : '否' },
            { key: 'aliases', label: '兼容别名', value: tool.aliases.length ? tool.aliases.join(' / ') : '无' },
          ]" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">
            三件套 · 示例与常见错误
            <span class="oc-muted" style="font-size: 12px">缺任一项工具视为不合格</span>
          </h3>
          <div class="oc-stack">
            <div v-for="(ex, i) in tool.examples" :key="ex" class="oc-flex" style="gap: 6px; align-items: flex-start">
              <Tag size="small" theme="primary" variant="light-outline">示例 {{ i + 1 }}</Tag>
              <span style="font-size: 12px">{{ ex }}</span>
            </div>
          </div>
          <div class="oc-divider" />
          <div class="oc-stack">
            <div v-for="ce in tool.commonErrors" :key="ce" class="oc-flex" style="gap: 6px; align-items: flex-start">
              <Tag size="small" theme="warning" variant="light-outline">常见错误</Tag>
              <span style="font-size: 12px">{{ ce }}</span>
            </div>
          </div>
          <div class="oc-divider" />
          <div class="oc-flex oc-flex--between">
            <span class="oc-muted" style="font-size: 12px">错误全部回喂为结构化对象（类别 + 人类可读信息 + 修复建议 + 可重试性）</span>
            <CliHint :command="`oc tools errors ${tool.name} --tail 20`" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">参数 Schema（canonical 子集）</h3>
        <Table row-key="name" size="small" :data="tool.paramSchema" :columns="paramColumns">
          <template #name="{ row }">
            <span class="oc-mono">{{ row.name }}</span>
          </template>
          <template #required="{ row }">
            <Tag :theme="row.required ? 'danger' : 'default'" size="small" variant="light-outline">{{ row.required ? '必填' : '可选' }}</Tag>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">返回 Schema</h3>
          <Table row-key="name" size="small" :data="tool.returnSchema" :columns="retColumns">
            <template #name="{ row }"><span class="oc-mono">{{ row.name }}</span></template>
          </Table>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">
            渲染样例与投射
            <CliHint :command="`oc tools schema ${tool.name} --protocol anthropic`" />
          </h3>
          <JsonBlock :value="schemaSample" :collapse-over="200" label="canonical 参数样例" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">权限决策引用（本工具命中过的策略规则）</h3>
        <InfoGrid
          :columns="2"
          :items="relatedDecisions.length
            ? relatedDecisions.slice(0, 4).map((d) => ({ key: d.decisionId, label: `${d.decisionId} · ${d.riskClass}`, value: `${d.decision}｜${d.reason.slice(0, 42)}…`, hint: d.ruleRefs.join(', ') }))
            : [{ key: 'none', label: '决策记录', value: '近 24h 无该工具的决策记录' }]"
        />
      </div>
    </StateShell>
  </div>
</template>
