<script setup lang="ts">
/**
 * 路由规则页（M-07 / 卷 02 D-MDL-6）：
 * 条件（任务类型 / 复杂度 / 成本上限 / 租户策略）→ 目标模型 + 显式回退链，可排序、可启停；
 * dry-run 命中模拟展示规则命中、候选评估与被跳过的原因（不静默跳过）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtCost, fmtToken, type PageState } from '@/components/gateway/types';
import { PROVIDER_STATUS_META, TASK_TYPE_META, modelData } from '@/mock/data/model';
import type { DryRunScenarioData, ProviderStatus, RouteRuleData } from '@/mock/data/model';
import { downloadText } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const rules = ref<RouteRuleData[]>(JSON.parse(JSON.stringify(data.routeRules)) as RouteRuleData[]);

/** 新增规则：对话框表单 + 提交（写入本地规则集，表格 / 统计卡 / dry-run 推演即时重算） */
const createOpen = ref(false);
const createForm = ref({ name: '', targetModel: '', fallbackRaw: '' });
const modelOptions = data.models.map((m) => ({ label: `${m.modelId} · ${m.displayName}`, value: m.modelId }));

/** 打开新增规则对话框：每次打开重置表单（取消不留痕） */
function openCreateRule() {
  createForm.value = { name: '', targetModel: '', fallbackRaw: '' };
  createOpen.value = true;
}

/** 新增规则：校验必填与重名后以既有规则为基线克隆并改写，追加到顺序末位 */
function submitRule() {
  const name = createForm.value.name.trim();
  const base = rules.value[0];
  if (!base) {
    MessagePlugin.error('规则集为空，无法以现有规则为基线新增');
    return;
  }
  if (!name) {
    MessagePlugin.error('规则名必填：命中事件与审计按名称定位规则');
    return;
  }
  if (rules.value.some((r) => r.name === name)) {
    MessagePlugin.error(`规则名「${name}」已存在，请换一个名称`);
    return;
  }
  if (!createForm.value.targetModel) {
    MessagePlugin.error('目标模型必填：命中后按该目标发起调用（从已登记模型中选择）');
    return;
  }
  const fallbackChain = createForm.value.fallbackRaw
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && x !== createForm.value.targetModel);
  const rule: RouteRuleData = {
    ...base,
    id: `route-local-${Date.now().toString(36)}`,
    name,
    targetModel: createForm.value.targetModel,
    fallbackChain,
    order: rules.value.length + 1,
    enabled: true,
    hitCountToday: 0,
    lastHitAt: new Date().toISOString(),
    note: '由「新增规则」对话框创建：条件与回退链显式声明；命中统计自启用起累计',
  };
  rules.value = [...rules.value, rule];
  createOpen.value = false;
  MessagePlugin.success(`已新增规则「${rule.name}」（顺序 ${rule.order}，启用）：目标 ${rule.targetModel}，回退 ${fallbackChain.join(' → ') || '无（单目标）'}；下表 dry-run 已按新规则重算`);
}
const scenarioId = ref(data.dryRunScenarios[0].id);

const scenario = computed<DryRunScenarioData>(() => data.dryRunScenarios.find((s) => s.id === scenarioId.value) ?? data.dryRunScenarios[0]);
const enabledCount = computed(() => rules.value.filter((r) => r.enabled).length);
const hitTotal = computed(() => rules.value.reduce((a, b) => a + b.hitCountToday, 0));
const costCeilingRules = computed(() => rules.value.filter((r) => r.condition.costCeilingUsd !== null).length);

const columns: PrimaryTableCol[] = [
  { colKey: 'order', title: '序', width: 60 },
  { colKey: 'name', title: '规则', width: 220 },
  { colKey: 'condition', title: '条件（任务类型 / 复杂度 / 成本上限 / 租户策略）', width: 330 },
  { colKey: 'target', title: '目标模型 + 回退链', width: 340 },
  { colKey: 'hit', title: '今日命中', width: 100 },
  { colKey: 'enabled', title: '启用', width: 90 },
  { colKey: 'move', title: '排序', width: 130 },
];

/** 规则特异性打分：更具体的规则优先（租户策略匹配 > 复杂度匹配 > 成本上限） */
function specificity(r: RouteRuleData, input: DryRunScenarioData['input']): number {
  let s = 0;
  s += r.condition.complexity !== 'any' ? 2 : 0;
  s += r.condition.tenantPolicy === input.tenantPolicy ? 3 : r.condition.tenantPolicy === 'default' ? 1 : 0;
  s += r.condition.costCeilingUsd !== null ? 1 : 0;
  return s;
}

function matchRule(r: RouteRuleData, input: DryRunScenarioData['input']): boolean {
  if (r.condition.taskType !== input.taskType) return false;
  if (r.condition.complexity !== 'any' && r.condition.complexity !== input.complexity) return false;
  if (r.condition.tenantPolicy !== 'default' && r.condition.tenantPolicy !== input.tenantPolicy) return false;
  if (input.costCeilingUsd !== null) {
    if (r.condition.costCeilingUsd === null || r.condition.costCeilingUsd > input.costCeilingUsd) return false;
  }
  return true;
}

/** dry-run：命中规则 + 逐候选校验（连通性 / 驻留 / 能力 / 窗口），跳过原因必须显式展示 */
const dryRun = computed(() => {
  const input = scenario.value.input;
  const matched = rules.value
    .filter((r) => r.enabled && matchRule(r, input))
    .sort((a, b) => specificity(b, input) - specificity(a, input) || a.order - b.order);
  const rule = matched[0];
  const chain = rule ? [rule.targetModel, ...rule.fallbackChain] : ['claude-sonnet-4.5'];
  const candidates = chain.map((modelId, idx) => {
    const m = data.models.find((x) => x.modelId === modelId);
    const prov = data.providers.find((p) => p.id === m?.providerId);
    const reasons: string[] = [];
    if (!m) reasons.push('模型不在目录（需先导入或登记）');
    if (prov && !prov.enabled) reasons.push('Provider 已被禁用（禁用非降级，不会静默换源）');
    if (prov && prov.status !== 'reachable') reasons.push(`Provider 状态：${PROVIDER_STATUS_META[prov.status].label}（不参与路由）`);
    if (m && (input.tenantPolicy === 'private-only' || input.tenantPolicy === 'regulated')
      && !['境内驻留', '本地设备（零外发）'].includes(m.dataResidency)) reasons.push(`驻留约束不满足：${m.dataResidency}`);
    if (m && input.taskType === 'vision' && m.capabilities.vision === 'unsupported') reasons.push('vision 能力位 unsupported → 能力校验直接拒绝');
    if (m && input.taskType === 'embedding' && m.capabilities.embeddings !== 'supported') reasons.push('embeddings 能力位不支持');
    if (m && input.estimatedInputTokens > m.contextWindow) reasons.push(`输入 ${fmtToken(input.estimatedInputTokens)} 超窗口 ${fmtToken(m.contextWindow)}（会触发上下文压缩）`);
    const est = m ? (input.estimatedInputTokens * 0.3 / 1_000_000) * m.pricing.input + (input.estimatedInputTokens * 0.05 / 1_000_000) * m.pricing.output : 0;
    return { idx, modelId, model: m, provider: prov, reasons, ok: reasons.length === 0, est };
  });
  return { input, matched, rule, candidates, selected: candidates.find((c) => c.ok) };
});

function move(row: TableRowData, dir: -1 | 1) {
  const idx = rules.value.findIndex((r) => r.id === row.id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= rules.value.length) return;
  const list = [...rules.value];
  [list[idx], list[target]] = [list[target], list[idx]];
  rules.value = list.map((r, i) => ({ ...r, order: i + 1 }));
  ui.track('model.route.reordered', { id: String(row.id), dir });
}

function toggle(r: RouteRuleData, v: boolean) {
  r.enabled = v;
  MessagePlugin[v ? 'success' : 'warning'](v ? `已启用规则「${r.name}」` : `已停用规则「${r.name}」：命中该条件的请求将落到下一条匹配规则或会话默认模型`);
}

/** YAML 标量渲染：字符串一律双引号包裹并转义，避免中文/特殊字符破坏 YAML 结构 */
function yamlScalar(v: string | number | boolean | null): string {
  if (typeof v === 'string') return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return String(v);
}

/** 导出规则集（routing.rules.yaml）：按当前内存顺序生成 YAML，并附 dry-run 命中推演（不含任何密钥） */
function exportRules() {
  const dry = dryRun.value;
  const lines: string[] = [
    '# OpenCoding 路由规则集 · routing.rules.yaml',
    `# 导出时间：${new Date().toLocaleString('zh-CN')}；顺序即生效优先级（页面「上移/下移」后的当前内存顺序）`,
    '# 脱敏说明：仅规则条件、目标模型与回退链，不含任何密钥；回退链只在目标不可用时逐级尝试',
    'rules:',
  ];

  rules.value.forEach((r) => {
    lines.push(`  - id: ${yamlScalar(r.id)}`);
    lines.push(`    name: ${yamlScalar(r.name)}`);
    lines.push(`    order: ${r.order}`);
    lines.push(`    enabled: ${r.enabled}`);
    lines.push('    condition:');
    lines.push(`      taskType: ${yamlScalar(r.condition.taskType)}`);
    lines.push(`      complexity: ${yamlScalar(r.condition.complexity)}`);
    lines.push(`      costCeilingUsd: ${r.condition.costCeilingUsd === null ? 'null' : r.condition.costCeilingUsd}`);
    lines.push(`      tenantPolicy: ${yamlScalar(r.condition.tenantPolicy)}`);
    lines.push(`    targetModel: ${yamlScalar(r.targetModel)}`);
    lines.push(`    fallbackChain: [${r.fallbackChain.map((m) => yamlScalar(m)).join(', ')}]`);
    lines.push(`    hitCountToday: ${r.hitCountToday}`);
    lines.push(`    note: ${yamlScalar(r.note)}`);
  });

  lines.push('dryRun:');
  lines.push(`  scenario: ${yamlScalar(scenario.value.label)}`);
  lines.push('  input:');
  lines.push(`    taskType: ${yamlScalar(dry.input.taskType)}`);
  lines.push(`    complexity: ${yamlScalar(dry.input.complexity)}`);
  lines.push(`    estimatedInputTokens: ${dry.input.estimatedInputTokens}`);
  lines.push(`    costCeilingUsd: ${dry.input.costCeilingUsd === null ? 'null' : dry.input.costCeilingUsd}`);
  lines.push(`    tenantPolicy: ${yamlScalar(dry.input.tenantPolicy)}`);
  lines.push(`    containsPrivateData: ${dry.input.containsPrivateData}`);
  lines.push(`  matchedRule: ${yamlScalar(dry.rule ? `${dry.rule.id} · ${dry.rule.name}` : '无匹配规则（落到会话默认模型）')}`);
  lines.push(`  selectedModel: ${yamlScalar(dry.selected?.modelId ?? '会话默认模型（静态基线）')}`);
  lines.push('  candidates:');
  dry.candidates.forEach((c) => {
    lines.push(`    - modelId: ${yamlScalar(c.modelId)}`);
    lines.push(`      selectable: ${c.ok}`);
    lines.push(`      estCostUsd: ${Number(c.est.toFixed(6))}`);
    // 被跳过原因必须显式落盘：与界面一致，不允许静默跳过
    lines.push(`      skippedReasons: [${c.reasons.map((x) => yamlScalar(x)).join(', ')}]`);
  });

  const file = downloadText(`${lines.join('\n')}\n`, `oc-model-routing-rules-${new Date().toISOString().slice(0, 10)}.yaml`);
  MessagePlugin.success(`已导出规则集：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = rules.value.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="路由规则"
      desc="规则路由 + 显式回退链：条件命中后按「特异性 + 顺序」选择目标；回退链只在目标不可用时逐级尝试，且每一级跳过都会留下显式原因。"
      volume="卷 02"
      manifest="M-07"
      cli="oc model route list | oc model route dry-run --task-type coding --complexity medium --ceiling 0.5"
      :status="[{ label: `${enabledCount}/${rules.length} 启用`, theme: 'default' }, { label: `${costCeilingRules} 条带成本上限`, theme: 'primary' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="exportRules">导出规则集</Button>
        <Button size="small" theme="primary" @click="openCreateRule">新增规则</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="规则总数 / 启用" :value="`${enabledCount} / ${rules.length}`" format="raw" icon="filter" />
      <StatCard label="今日命中总次数" :value="hitTotal" icon="chart" :delta="9.4" :lower-is-better="false" hint="命中会生成 model.route.selected 事件（含候选与回退链）" />
      <StatCard label="回退链平均长度" :value="(rules.reduce((a, b) => a + b.fallbackChain.length, 0) / rules.length).toFixed(1)" format="raw" icon="sitemap" :target="3" target-kind="max" />
      <StatCard label="私有数据强制本地" :value="rules.filter((r) => r.condition.tenantPolicy === 'private-only' || r.condition.tenantPolicy === 'regulated').length" icon="lock" hint="命中后禁止跨境端点，回退链同样过滤（硬约束）" />
    </div>

    <StateShell
      :state="state"
      empty-title="还没有路由规则"
      empty-desc="没有规则时等价于会话内静态选择模型（基线行为），不会报错。"
      empty-action="新增规则"
      example-task="为「编码 · 中等复杂度」配置 route → claude-sonnet-4.5，回退 gpt-5.1"
      what="路由规则加载失败"
      why="规则服务返回错误；当前生效的可能是上一次成功下发的快照。"
      how="可重试；规则不可读时不影响既有会话的静态模型选择。"
      trace-id="trace-route-6b42"
      missing-permission="model.manage"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage（R3：影响全局模型选择，需管理员确认）"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('新增规则需要指定条件与回退链；保存前会做 dry-run 校验')"
    >
      <Table :data="rules" :columns="columns" row-key="id" size="small" :pagination="{ pageSize: 12, total: rules.length }">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <b>{{ row.name }}</b>
            <span class="oc-muted" style="font-size: 12px">{{ row.note }}</span>
            <span class="oc-muted" style="font-size: 12px">最近命中 {{ new Date(row.lastHitAt).toLocaleTimeString('zh-CN') }}</span>
          </div>
        </template>
        <template #condition="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag size="small" variant="light-outline">{{ TASK_TYPE_META[row.condition.taskType] ?? row.condition.taskType }}</Tag>
            <Tag size="small" variant="outline">复杂度 {{ row.condition.complexity }}</Tag>
            <Tag size="small" variant="outline">{{ row.condition.costCeilingUsd !== null ? `成本 ≤ $${row.condition.costCeilingUsd}` : '无成本上限' }}</Tag>
            <Tag :theme="row.condition.tenantPolicy === 'default' ? 'default' : 'warning'" size="small" variant="light-outline">策略 {{ row.condition.tenantPolicy }}</Tag>
          </div>
        </template>
        <template #target="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px"><b>{{ row.targetModel }}</b></span>
            <span class="oc-muted" style="font-size: 12px">回退：{{ row.fallbackChain.join(' → ') || '无（单目标）' }}</span>
          </div>
        </template>
        <template #enabled="{ row }">
          <Switch :value="row.enabled" size="small" @change="(v) => toggle(row as RouteRuleData, Boolean(v))" />
        </template>
        <template #move="{ row }">
          <Button size="small" variant="text" @click="move(row, -1)">上移</Button>
          <Button size="small" variant="text" @click="move(row, 1)">下移</Button>
        </template>
      </Table>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>dry-run 命中模拟</span>
          <span class="oc-flex" style="gap: 6px">
            <Select v-model="scenarioId" :options="data.dryRunScenarios.map((s) => ({ label: s.label, value: s.id }))" size="small" style="width: 320px" />
            <Tooltip content="模拟不使用真实调用，仅按规则与能力校验推演，不产生 token 成本">
              <Tag size="small" variant="outline">零成本模拟</Tag>
            </Tooltip>
          </span>
        </div>

        <div class="oc-grid oc-grid--3" style="margin-bottom: 10px">
          <div class="oc-kv">
            <span class="oc-kv__k">任务类型</span><span>{{ TASK_TYPE_META[dryRun.input.taskType] ?? dryRun.input.taskType }}</span>
            <span class="oc-kv__k">复杂度</span><span>{{ dryRun.input.complexity }}</span>
            <span class="oc-kv__k">预估输入</span><span>{{ fmtToken(dryRun.input.estimatedInputTokens) }} token</span>
          </div>
          <div class="oc-kv">
            <span class="oc-kv__k">成本上限</span><span>{{ dryRun.input.costCeilingUsd !== null ? `$${dryRun.input.costCeilingUsd}` : '无' }}</span>
            <span class="oc-kv__k">租户策略</span><span>{{ dryRun.input.tenantPolicy }}</span>
            <span class="oc-kv__k">含私有数据</span><span>{{ dryRun.input.containsPrivateData ? '是' : '否' }}</span>
          </div>
          <div class="oc-kv">
            <span class="oc-kv__k">命中规则</span><span>{{ dryRun.rule ? `${dryRun.rule.id} · ${dryRun.rule.name}` : '无匹配规则' }}</span>
            <span class="oc-kv__k">选中模型</span><span class="oc-mono">{{ dryRun.selected?.modelId ?? '会话默认模型（静态基线）' }}</span>
            <span class="oc-kv__k">预估成本</span><span>{{ dryRun.selected ? fmtCost(dryRun.selected.est) : '—' }}</span>
          </div>
        </div>

        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 8px">
          <Tag v-if="!dryRun.rule" theme="warning" size="small" variant="light-outline">无匹配规则 → 落到会话默认模型</Tag>
          <Tag v-else theme="primary" size="small" variant="light-outline">匹配 {{ dryRun.matched.length }} 条，取特异性最高者（同分按顺序）</Tag>
          <Tag v-if="dryRun.candidates.some((c) => !c.ok)" theme="warning" size="small" variant="light-outline">
            {{ dryRun.candidates.filter((c) => !c.ok).length }} 个候选被跳过（原因见下表）
          </Tag>
          <Tag v-if="dryRun.rule && dryRun.candidates.filter((c) => !c.ok).length" size="small" variant="outline">首目标不可用 → 回退链生效</Tag>
        </div>

        <Table :data="dryRun.candidates" row-key="modelId" size="small" :pagination="{ pageSize: 6, total: dryRun.candidates.length }"
          :columns="[
            { colKey: 'idx', title: '链位', width: 70 },
            { colKey: 'modelId', title: '候选模型', width: 200 },
            { colKey: 'provider', title: 'Provider / 状态', width: 240 },
            { colKey: 'est', title: '预估成本', width: 110 },
            { colKey: 'verdict', title: '评估结论' },
          ]"
        >
          <template #idx="{ row }"><Tag size="small" variant="outline">{{ row.idx === 0 ? '主目标' : `回退 ${row.idx}` }}</Tag></template>
          <template #modelId="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.modelId }}</span></template>
          <template #provider="{ row }">
            <span class="oc-flex" style="gap: 6px">
              <span class="oc-mono" style="font-size: 12px">{{ row.provider?.id ?? '—' }}</span>
              <Tag v-if="row.provider" :theme="PROVIDER_STATUS_META[row.provider.status as ProviderStatus].theme" size="small" variant="light-outline">{{ PROVIDER_STATUS_META[row.provider.status as ProviderStatus].label }}</Tag>
            </span>
          </template>
          <template #est="{ row }">{{ row.model ? fmtCost(row.est) : '—' }}</template>
          <template #verdict="{ row }">
            <Tag v-if="row.ok" theme="success" size="small" variant="light-outline">可选中</Tag>
            <span v-else class="oc-flex oc-flex--wrap" style="gap: 4px">
              <Tag theme="danger" size="small" variant="light-outline">跳过</Tag>
              <span v-for="r in row.reasons" :key="r" class="oc-muted" style="font-size: 12px">{{ r }}</span>
            </span>
          </template>
        </Table>
      </div>
    </StateShell>
    <Dialog v-model:visible="createOpen" header="新增路由规则（条件 + 目标 + 回退链）" width="640px" :confirm-btn="{ content: '新增规则', theme: 'primary' }" cancel-btn="取消" @confirm="submitRule">
      <div class="oc-stack">
        <Input v-model="createForm.name" size="small" placeholder="规则名（必填），如「编码 · 中等复杂度 · 主力档」" />
        <Select v-model="createForm.targetModel" size="small" filterable aria-label="目标模型" placeholder="目标模型（必填）" :options="modelOptions" />
        <Input v-model="createForm.fallbackRaw" size="small" class="oc-mono" placeholder="回退链（可选，逗号分隔模型 id，如 gpt-5.1, qwen3-max）" />
        <div class="oc-muted" style="font-size: 12px">
          新增后追加到顺序末位（优先级按「特异性 + 顺序」判定）；启用后立即参与下方 dry-run 推演，今日命中从 0 累计。
        </div>
      </div>
    </Dialog>
  </div>
</template>
