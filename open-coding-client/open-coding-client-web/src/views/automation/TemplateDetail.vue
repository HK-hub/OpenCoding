<script setup lang="ts">
/**
 * 模板详情（N2-02）：概览 / 触发与目标 / 权限与预算 / 步骤与验收 / 度量 五个 Tab。
 * 溯源：卷 34 §5.1–§5.8；BUILD-MANIFEST N2-02。
 * 关键约束：声明即契约（步骤/验收/权限/预算缺一即装载期 Fail-Fast）；默认不合并。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Select, Table, TabPanel, Tabs, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData, findTemplate } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();

const tpl = computed(() => findTemplate(String(route.params.id ?? '')));
const tab = ref('overview');
const relatedRuns = computed(() => automationData.runs.filter((r) => r.templateId === tpl.value?.id).slice(0, 6));
const metrics = computed(() => automationData.metricsBoard.byTemplate.find((m) => m.templateId === tpl.value?.id));

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const stepColumns = [
  { colKey: 'no', title: '#', width: 60 },
  { colKey: 'type', title: '受限步骤类型', width: 130, cell: 'type' },
  { colKey: 'desc', title: '声明内容', ellipsis: true },
];
const verifyColumns = [
  { colKey: 'assert', title: '验收断言（必须可机械判定）', cell: 'assert' },
  { colKey: 'mechanical', title: '判定方式', width: 150, cell: 'mechanical' },
];
const runColumns = [
  { colKey: 'runId', title: '运行', width: 120, cell: 'id' },
  { colKey: 'status', title: '终态', width: 130, cell: 'status' },
  { colKey: 'costUsd', title: '成本', width: 100, cell: 'cost' },
  { colKey: 'startedAt', title: '开始时间', width: 180 },
];

const state = computed<Demo>(() => (demo.value === 'NORMAL' && !tpl.value ? 'EMPTY' : demo.value));

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});

const STATUS_THEME: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'default'> = {
  SUCCEEDED: 'success', FAILED: 'danger', ESCALATED: 'warning', BLOCKED: 'warning',
  DEDUPLICATED: 'default', RUNNING: 'primary', VERIFYING: 'primary', QUEUED: 'default', CANCELLED: 'default',
};
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="tpl ? `模板详情 · ${tpl.name}` : '模板详情'"
      :desc="tpl ? tpl.summary : '未找到模板定义'"
      volume="卷 34" manifest="N2-02" :cli="tpl ? `oc automation template show ${tpl.id} --version ${tpl.version}` : 'oc automation template show'"
      :status="tpl ? [{ label: `v${tpl.version}`, theme: 'default' }, { label: `来源 ${tpl.provenance}`, theme: 'default' }, { label: tpl.installed ? '已安装' : '未安装', theme: tpl.installed ? 'success' : 'warning' }] : []"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="router.push('/automation/templates')">返回市场</Button>
        <Button size="small" variant="outline" :disabled="!tpl" @click="router.push('/automation/dry-run')">干跑</Button>
        <Button size="small" theme="primary" :disabled="!tpl" @click="router.push('/automation/install')">安装配置</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state" stage="正在解析模板定义与签名…"
      empty-title="模板不存在" empty-desc="该模板 id 未在目录中命中（可能已被移除或版本不再可见）。"
      empty-action="返回模板市场" example-task="从市场选择「PR 巡检」查看其权限与预算声明"
      what="模板解析失败" why="定义版本与当前内核契约不兼容（contractVersion 不匹配）"
      how="重试；或在实例中升级定义版本后再查看" trace-id="trace-31ab7d95"
      @retry="demo = 'NORMAL'" @empty-action="router.push('/automation/templates')"
    >
      <template v-if="tpl">
        <Tabs v-model:value="tab" style="margin-bottom: 4px">
          <TabPanel value="overview" label="概览">
            <div class="oc-grid oc-grid--2">
              <div class="oc-card">
                <div class="oc-card__title">价值主张与定位</div>
                <p class="oc-secondary">{{ tpl.why }}</p>
                <InfoGrid :columns="1" :items="[
                  { key: 'id', label: '模板 id', value: tpl.id, mono: true, copyable: true },
                  { key: 'family', label: '模板族', value: `${tpl.category} · ${tpl.name}` },
                  { key: 'risk', label: '声明风险级（与权限交叉校验）', value: tpl.riskLevel, tag: { text: tpl.riskLevel, theme: tpl.riskLevel === 'R2' ? 'warning' : tpl.riskLevel === 'R3' ? 'danger' : 'primary' } },
                  { key: 'tier', label: '沙箱档位', value: tpl.sandboxTier },
                  { key: 'main', label: '度量主指标', value: tpl.mainMetric },
                  { key: 'tags', label: '检索标签', value: tpl.tags.join(' · ') },
                ]" />
              </div>
              <div class="oc-card">
                <div class="oc-card__title">来源、签名与兼容区间</div>
                <InfoGrid :columns="1" :items="[
                  { key: 'prov', label: '来源', value: tpl.provenance, tag: { text: tpl.provenance, theme: tpl.provenance === 'builtin' ? 'primary' : 'success' } },
                  { key: 'sign', label: '发布签名（市场/私仓分发必填）', value: tpl.signature, mono: true, copyable: true },
                  { key: 'signer', label: '签名主体', value: tpl.signedBy },
                  { key: 'contract', label: '所需内核契约版本', value: tpl.compat.contractVersion },
                  { key: 'tools', label: '所需工具', value: tpl.compat.tools.join('、') },
                  { key: 'skills', label: '所需技能', value: tpl.compat.skills.length ? tpl.compat.skills.join('、') : '无' },
                ]" />
                <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
                  <RiskBadge :level="tpl.riskLevel" show-desc />
                </div>
              </div>
            </div>
            <div class="oc-card" style="margin-top: 12px">
              <div class="oc-card__title">产出契约（五类）<CliHint :command="`oc automation template outputs ${tpl.id}`" /></div>
              <InfoGrid :columns="2" :items="tpl.outputs.map((o, i) => ({
                key: `o${i}`, label: `${o.type} · ${o.schema}`, value: `${o.storage}${o.freeform ? '（正文自由生成，受门禁约束）' : ''}`,
              }))" />
            </div>
          </TabPanel>

          <TabPanel value="triggers" label="触发与目标">
            <div class="oc-grid oc-grid--2">
              <div class="oc-card">
                <div class="oc-card__title">触发器（五类，映射为卷 15 TriggerSpec）</div>
                <div v-for="(tr, i) in tpl.triggers" :key="i" class="oc-stack" style="gap: 2px; margin-bottom: 8px">
                  <div class="oc-flex" style="gap: 6px">
                    <Tag size="small" theme="primary" variant="light-outline">{{ tr.kind }}</Tag>
                    <span style="font-size: 13px">{{ tr.spec }}</span>
                  </div>
                  <div class="oc-muted" style="font-size: 12px">
                    {{ [tr.timezone ? `时区 ${tr.timezone}` : '', tr.debounce ? `防抖 ${tr.debounce}` : '', tr.throttle ? `节流 ${tr.throttle}` : ''].filter(Boolean).join(' · ') || '无时区/防抖/节流声明' }}
                  </div>
                </div>
                <div class="oc-muted" style="font-size: 12px">
                  模板不自建定时器：幂等键、jitter、并发策略、熔断全部由卷 15 调度承担（排队而非拒绝）。
                </div>
              </div>
              <div class="oc-card">
                <div class="oc-card__title">目标绑定</div>
                <InfoGrid :columns="1" :items="[
                  { key: 'target', label: '触发对象', value: tpl.target, tag: { text: tpl.target, theme: 'primary' } },
                  { key: 'inputs', label: '参数契约', value: `${tpl.inputs.length} 个输入（来源用户 / 探测 / 上下文）` },
                  { key: 'ps', label: '占位符展开时机', value: '参数校验之后展开；进入命令行前必须转义（防注入）' },
                  { key: 'steps', label: '步骤 → WorkItem', value: '每步一个 WorkItem；for-each 动态扇出（受 budget.fanout 上限）' },
                ]" />
                <div class="oc-stack" style="gap: 6px; margin-top: 8px">
                  <div v-for="inp in tpl.inputs" :key="inp.name" class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px">
                    <span class="oc-mono">{{ inp.name }}</span>
                    <Tag size="small" variant="outline">{{ inp.type }}</Tag>
                    <Tag v-if="inp.enum" size="small" variant="outline">{{ inp.enum.join(' / ') }}</Tag>
                    <Tag v-if="inp.range" size="small" variant="outline">范围 {{ inp.range }}</Tag>
                    <Tag size="small" variant="outline">默认 {{ String(inp.default) }}</Tag>
                    <Tag size="small" variant="light-outline" :theme="inp.source === 'user' ? 'primary' : 'default'">来源 {{ inp.source }}</Tag>
                    <Tag v-if="inp.required" size="small" theme="warning" variant="light-outline">必填</Tag>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="permissions" label="权限与预算">
            <div class="oc-grid oc-grid--2">
              <div class="oc-card">
                <div class="oc-card__title">预授权动作清单与上限</div>
                <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                  <Tag v-for="a in tpl.permissions.allow" :key="a" size="small" theme="success" variant="light-outline">{{ a }}</Tag>
                </div>
                <div class="oc-divider" />
                <InfoGrid :columns="1" :items="[
                  { key: 'ceiling', label: '权限上限', value: tpl.permissions.ceiling, tag: { text: '不可提升', theme: 'warning' } },
                  { key: 'nomerge', label: '合并策略', value: '默认不合并：自动化只提 PR，合并由人或 CI 门禁执行' },
                  { key: 'deny', label: '上限清单（不可请求）', value: tpl.permissions.denied.join('、'), block: true },
                  { key: 'mono', label: '能力单调收窄', value: '步骤级能力 ⊆ 运行级授权快照 ⊆ 实例化授予集；任一步不得扩大' },
                ]" />
              </div>
              <div class="oc-card">
                <div class="oc-card__title">预算信封（四项硬上限）</div>
                <InfoGrid :columns="2" :items="[
                  { key: 'cost', label: '成本上限', value: `$${tpl.budget.costUsd}` },
                  { key: 'dur', label: '时长上限', value: `${tpl.budget.durationMin} 分钟` },
                  { key: 'tools', label: '工具调用上限', value: tpl.budget.toolCalls },
                  { key: 'fanout', label: '扇出上限', value: tpl.budget.fanout },
                ]" />
                <div class="oc-divider" />
                <div class="oc-card__title">失败四级映射</div>
                <InfoGrid :columns="1" :items="[
                  { key: 'retry', label: '① 重试', value: tpl.failure.retry },
                  { key: 'degrade', label: '② 降级', value: tpl.failure.degrade },
                  { key: 'drop', label: '③ 丢弃产物', value: tpl.failure.dropArtifacts },
                  { key: 'circuit', label: '④ 熔断升级人工', value: tpl.failure.circuitThreshold },
                ]" />
              </div>
            </div>
          </TabPanel>

          <TabPanel value="steps" label="步骤与验收">
            <div class="oc-card">
              <div class="oc-card__title">受限步骤序列（不允许 shell 管道 / 重定向 / 网络下载）</div>
              <Table :data="tpl.steps.map((s, i) => ({ ...s, no: i + 1 }))" :columns="stepColumns" row-key="no" size="small" :pagination="undefined">
                <template #type="{ row }"><Tag size="small" variant="light-outline" theme="primary">{{ row.type }}</Tag></template>
              </Table>
              <div class="oc-divider" />
              <div class="oc-card__title">验收断言（可机械判定）</div>
              <Table :data="tpl.verification" :columns="verifyColumns" row-key="assert" size="small" :pagination="undefined">
                <template #assert="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.assert }}</span></template>
                <template #mechanical="{ row }">
                  <Tag size="small" :theme="row.mechanical ? 'success' : 'warning'" variant="light-outline">{{ row.mechanical ? '机械判定' : '需人工' }}</Tag>
                </template>
              </Table>
            </div>
          </TabPanel>

          <TabPanel value="metrics" label="度量">
            <div class="oc-grid oc-grid--3">
              <div class="oc-card">
                <div class="oc-card__title">声明的度量目标</div>
                <InfoGrid :columns="1" :items="tpl.metrics.map((m) => ({ key: m.key, label: m.key, value: m.target }))" />
              </div>
              <div class="oc-card">
                <div class="oc-card__title">实际采集（近 30 天）</div>
                <InfoGrid v-if="metrics" :columns="1" :items="[
                  { key: 'runs', label: '运行次数', value: metrics.runs },
                  { key: 'saved', label: '节省人力时长', value: `${metrics.savedHours} h${metrics.savedHoursEstimated ? '（估算，缺基准样本）' : ''}` },
                  { key: 'find', label: '发现问题数', value: metrics.findings },
                  { key: 'adopt', label: '产物采纳率', value: `${(metrics.adoptRatio * 100).toFixed(1)}%` },
                  { key: 'unit', label: '单位成本', value: `$${metrics.unitCost.toFixed(2)}/有效产出` },
                ]" />
                <div v-else class="oc-muted">无采集数据（可关闭项：企业可强制关闭遥测，缺口标记仍本地保留）。</div>
              </div>
              <div class="oc-card">
                <div class="oc-card__title">呈现声明</div>
                <InfoGrid :columns="1" :items="[
                  { key: 'format', label: '汇报格式', value: tpl.presentation.format, tag: { text: tpl.presentation.format, theme: 'primary' } },
                  { key: 'slots', label: '呈现位', value: tpl.presentation.slots.join('、') },
                  { key: 'lang', label: '语言', value: tpl.presentation.language },
                ]" />
                <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
                  仅异常格式必须含：失败步骤、原因、已采取动作、建议动作与运行链接。
                </div>
              </div>
            </div>
            <div class="oc-card" style="margin-top: 12px">
              <div class="oc-card__title">该模板的近期运行</div>
              <Table :data="relatedRuns" :columns="runColumns" row-key="runId" size="small" :pagination="undefined">
                <template #id="{ row }"><span class="oc-mono">{{ row.runId }}</span></template>
                <template #status="{ row }"><Tag size="small" :theme="STATUS_THEME[row.status]" variant="light-outline">{{ row.status }}</Tag></template>
                <template #cost="{ row }">${{ row.costUsd.toFixed(2) }}</template>
              </Table>
              <div class="oc-muted" style="font-size: 12px; margin-top: 6px">运行中实例不随模板升级自动迁移：升级须重新兼容检查并刷新授权快照。</div>
            </div>
          </TabPanel>
        </Tabs>
      </template>
    </StateShell>
  </div>
</template>
