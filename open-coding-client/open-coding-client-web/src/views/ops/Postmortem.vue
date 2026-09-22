<script setup lang="ts">
/**
 * 复盘报告（G5-05）：7 段模板（摘要 / 时间线 / 影响面 / 根因 / 做得好 / 待改进 / 数据）；
 * 改进项必须落「代码 / 配置 / 测试 / 文档」四类之一，未选类型或空话（如「加强意识」）阻止提交并给字段级原因；
 * P0（SEV1/2）需 3 个工作日内出报告。
 * 溯源：卷 32 / BUILD-MANIFEST G5-05
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { Alert, Button, Input, MessagePlugin, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const LANDINGS = ['代码', '配置', '测试', '文档'] as const;
/** 空话黑名单：命中即拒绝，并给出示例改写（改写成「可验证的动作」） */
const EMPTY_TALK = ['加强意识', '提高意识', '加强培训', '提高重视', '引以为戒', '注意规范', '加强管理'];
const REWRITE_DEMO = '示例改写：「加强意识」→「把告警阈值 5→3 次并补充回归用例（落地：测试，验证：演练水位回落 <75%）」';

const form = reactive({
  sev: 'SEV3' as 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4',
  summary: '', timeline: '', impact: '', rootCause: '', wentWell: '', evidence: '',
  improvements: [{ action: '', landing: '' as '' | (typeof LANDINGS)[number] }],
});
const errors = reactive<{ summary: string[]; items: string[]; empty: string[] }>({ summary: [], items: [], empty: [] });
const submitted = ref<{ id: string; sev: string; summary: string; rootCause: string; items: number; closedPct: number }[]>([]);

/** P0（SEV1/2）出报告时限：3 个工作日 */
const deadline = computed(() => new Date(Date.now() + 3 * 86400000).toLocaleDateString('zh-CN'));
const p0 = computed(() => form.sev === 'SEV1' || form.sev === 'SEV2');
const list = computed(() => [...submitted.value, ...d.postmortems.map((p) => ({ id: p.id, sev: p.sev, summary: p.summary, rootCause: p.rootCause.direct, items: p.improvements.length, closedPct: Math.round((p.improvements.filter((i) => i.closed).length / p.improvements.length) * 100) }))]);
const columns = [
  { colKey: 'id', title: '编号', width: 86 }, { colKey: 'sev', title: '级别', width: 78 },
  { colKey: 'summary', title: '摘要', width: 300 }, { colKey: 'rootCause', title: '直接根因', width: 240 },
  { colKey: 'items', title: '改进项', width: 84 }, { colKey: 'closedPct', title: '闭环率' },
];

function addItem(): void {
  form.improvements.push({ action: '', landing: '' });
}
/** 至少保留一条改进项：零改进项的复盘等于没有复盘 */
function removeItem(i: number): void {
  if (form.improvements.length > 1) form.improvements.splice(i, 1);
}

/** 提交前逐项校验：空摘要 / 未选落地类型 / 空话，三类均给字段级原因并阻断提交 */
function submit(): void {
  errors.summary = form.summary.trim() ? [] : ['摘要不能为空：请写「现象 + 影响 + 是否影响数据完整性」'];
  errors.items = form.improvements.map((im, i) => (im.landing ? '' : `改进项 ${i + 1}：未选择落地类型（代码 / 配置 / 测试 / 文档），未选择时禁止提交`)).filter(Boolean);
  errors.empty = form.improvements
    .map((im, i) => (EMPTY_TALK.some((w) => im.action.includes(w)) ? `改进项 ${i + 1}：「${im.action}」是空话，无法验证。${REWRITE_DEMO}` : ''))
    .filter(Boolean);
  if (errors.summary.length || errors.items.length || errors.empty.length) {
    MessagePlugin.error(`提交被阻止：${errors.summary[0] ?? errors.items[0] ?? errors.empty[0]}`);
    return;
  }

  submitted.value = [
    { id: `pm-${String(30 + submitted.value.length).padStart(2, '0')}`, sev: form.sev, summary: form.summary, rootCause: form.rootCause || '（待补充直接根因）', items: form.improvements.length, closedPct: 0 },
    ...submitted.value,
  ];
  MessagePlugin.success('复盘已提交并进入列表：改进项已绑定落地类型，未闭环项将进入值班交接单');
  form.summary = ''; form.timeline = ''; form.impact = ''; form.rootCause = ''; form.wentWell = ''; form.evidence = '';
  form.improvements = [{ action: '', landing: '' }];
  errors.summary = []; errors.items = []; errors.empty = [];
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = d.postmortems.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="复盘"
      desc="7 段模板：摘要 / 时间线 / 影响面 / 根因 / 做得好 / 待改进 / 数据；改进项必须落四类之一（代码 / 配置 / 测试 / 文档），空话与未选类型均阻断提交。"
      volume="卷 32"
      manifest="G5-05"
      cli="oc postmortem new --template 7sections"
      :status="[{ label: 'P0 三工作日内出报告', theme: 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="addItem">新增改进项</Button>
        <Button size="small" theme="primary" @click="submit">提交复盘</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有复盘记录"
      empty-desc="发生 SEV1/2 或 SLO 违反后必须产出复盘，且改进项要能验证是否完成。"
      empty-action="从事故创建复盘草稿"
      example-task="为「磁盘水位 94% 导致事件写入延迟」写一份含四类改进项的复盘"
      what="复盘数据加载失败" why="知识库写入通道不可用，端上不会以本地草稿充当已提交复盘"
      how="可重试；请先导出草稿以免内容丢失，恢复后再提交"
      trace-id="trace-postmortem-1f70d8"
      @retry="state = 'LOADING'"
    >
      <Alert v-if="p0" theme="error" style="margin-bottom: 12px">
        <template #title>P0（{{ form.sev }}）需 3 个工作日内出报告</template>
        报告截止：{{ deadline }}（示例口径）。超期将自动升级到管理层并冻结相关发布；改进项未闭环前，同类变更需增加评审人。
      </Alert>

      <div class="oc-grid oc-grid--4">
        <StatCard label="已归档复盘" :value="list.length" unit="份" format="raw" icon="history" />
        <StatCard label="改进项总计" :value="list.reduce((a, b) => a + b.items, 0)" unit="项" format="raw" icon="task" />
        <StatCard label="平均闭环率" :value="Math.round(list.reduce((a, b) => a + b.closedPct, 0) / Math.max(1, list.length))" unit="%" format="raw" icon="check" target-kind="min" :target="100" />
        <StatCard label="空话拦截" :value="errors.empty.length" unit="条" format="raw" icon="lock" :lower-is-better="true" hint="空话不产生任何工程动作" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card oc-stack">
          <div class="oc-card__title">① 摘要 · ② 时间线 · ③ 影响面</div>
          <div class="oc-flex" style="gap: 8px">
            <span class="oc-muted" style="font-size: 12px; line-height: 32px">事件级别</span>
            <Select v-model="form.sev" size="small" style="width: 120px" :options="['SEV1', 'SEV2', 'SEV3', 'SEV4'].map((s) => ({ label: s, value: s }))" />
            <span class="oc-muted" style="font-size: 12px; line-height: 32px">SEV1/2 即 P0：3 个工作日内出报告</span>
          </div>
          <Input v-model="form.summary" placeholder="摘要：现象 + 影响 + 是否影响数据完整性" :status="errors.summary.length ? 'error' : 'default'" :tips="errors.summary[0] ?? '必填：一句话说清发生了什么'" />
          <Textarea v-model="form.timeline" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="时间线：检测 → 定位 → 缓解 → 恢复（含时间与命令）" />
          <Textarea v-model="form.impact" :autosize="{ minRows: 2, maxRows: 3 }" placeholder="影响面：租户 / 用户 / 任务 / 数据 / 成本" />
        </div>
        <div class="oc-card oc-stack">
          <div class="oc-card__title">④ 根因 · ⑤ 做得好 · ⑦ 数据</div>
          <Textarea v-model="form.rootCause" :autosize="{ minRows: 2, maxRows: 3 }" placeholder="根因：直接原因 + 系统性原因（缺哪个机制导致能发生）" />
          <Textarea v-model="form.wentWell" :autosize="{ minRows: 2, maxRows: 3 }" placeholder="做得好：告警及时性 / Runbook 可用性 / 用户可感知的降级提示" />
          <Textarea v-model="form.evidence" :autosize="{ minRows: 2, maxRows: 3 }" placeholder="数据：关键指标回归值、导出的事件 id、审计链路可核对" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">⑥ 待改进（每条必须落四类之一）</div>
          <Tag size="small" theme="warning" variant="light-outline">{{ REWRITE_DEMO }}</Tag>
        </div>
        <div v-for="(im, i) in form.improvements" :key="i" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px; align-items: flex-start">
          <Input v-model="im.action" class="oc-grow" placeholder="动作必须可验证（含阈值 / 用例 / 判据）" :status="errors.empty.some((e) => e.startsWith(`改进项 ${i + 1}`)) ? 'error' : 'default'" :tips="errors.empty.find((e) => e.startsWith(`改进项 ${i + 1}`)) ?? ''" />
          <Select v-model="im.landing" style="width: 132px" placeholder="落地类型" :options="LANDINGS.map((l) => ({ label: l, value: l }))" :status="errors.items.some((e) => e.startsWith(`改进项 ${i + 1}`)) ? 'error' : 'default'" :tips="errors.items.find((e) => e.startsWith(`改进项 ${i + 1}`)) ?? ''" />
          <Button size="small" variant="outline" :disabled="form.improvements.length === 1" @click="removeItem(i)">删除</Button>
        </div>
        <JsonBlock :value="{ sev: form.sev, improvements: form.improvements, blocked: [...errors.summary, ...errors.items, ...errors.empty] }" label="提交前校验视图（脱敏）" :collapse-over="140" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">复盘列表（提交后进入此处）</div>
        <Table :data="list" :columns="columns" row-key="id" size="small">
          <template #sev="{ row }"><Tag size="small" :theme="row.sev === 'SEV1' || row.sev === 'SEV2' ? 'danger' : 'warning'" variant="light-outline">{{ row.sev }}</Tag></template>
          <template #closedPct="{ row }"><Tag size="small" :theme="row.closedPct === 100 ? 'success' : 'warning'" variant="outline">{{ row.closedPct }}%</Tag></template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
