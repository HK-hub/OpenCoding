<script setup lang="ts">
/**
 * 模型设置（M-01）：默认模型 / 推理强度 / 思考预算 / 结构化输出 / 上下文缓存 / 能力降级行为 / 灰度入口。
 * 原则：能力不支持一律显式失败（UNSUPPORTED_CAPABILITY），不做静默降级。溯源：卷 02 / D33。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { CAPABILITY_META, CAPABILITY_STATE_META, modelData } from '@/mock/data/model';

const ui = useUiStore();
const router = useRouter();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const modelId = ref(ui.currentModel);
const reasoning = ref('medium');
const thinkingBudget = ref(8192);
const structuredOutput = ref(true);
const cacheEnabled = ref(true);

const model = computed(() => modelData.models.find((m) => m.modelId === modelId.value) ?? modelData.models[0]);
const modelOptions = computed(() => modelData.models.map((m) => ({ label: `${m.displayName} · ${m.tags[0] ?? ''}`, value: m.modelId })));
const gray = computed(() => modelData.grayRollouts[0]);

/** 仅展示与推理设置相关的能力位（其余能力在「能力矩阵」页全量核对） */
const capabilityRows = computed(() =>
  CAPABILITY_META.filter((c) => ['thinking', 'structuredOutput', 'cache', 'longContext', 'tools', 'parallelTools'].includes(c.key)).map((c) => ({
    key: c.key,
    label: c.label,
    state: model.value.capabilities[c.key],
    behavior: c.unsupportedBehavior,
  })),
);

const capColumns = [
  { colKey: 'label', title: '能力位', width: 140 },
  { colKey: 'state', title: '该模型状态', width: 120 },
  { colKey: 'behavior', title: '不支持/降级时的行为（显式，不静默）', ellipsis: true },
];

const budgetOptions = [0, 2048, 8192, 16384, 32768].map((v) => ({ label: v === 0 ? '关闭（0 token）' : `${v.toLocaleString('zh-CN')} token`, value: v }));

function save() {
  ui.currentModel = modelId.value;
  ui.track('settings.models.saved', { modelId: modelId.value, reasoning: reasoning.value, thinkingBudget: thinkingBudget.value });
  MessagePlugin.success('模型设置已保存：新会话生效，在途会话保持原参数（不改写在途请求）');
}

onMounted(() => {
  window.setTimeout(() => { state.value = modelData.models.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="模型设置"
      desc="默认模型、推理强度、思考预算与结构化输出/缓存开关；能力缺失时显式报错并给替代路径，不做静默降级。"
      volume="卷 02"
      manifest="M-01"
      cli="oc settings models --default claude-sonnet-4.5 --reasoning high --thinking-budget 8192"
      :status="[{ label: `当前 ${ui.currentModel}`, theme: 'primary' }, { label: '显式失败优先', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/model/gray')">模型灰度</Button>
        <Button size="small" theme="primary" @click="save">保存设置</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有可用模型"
      empty-desc="模型目录为空（Provider 未装配或凭证未配置），无法选择默认模型。"
      empty-action="去配置 Provider"
      example-task="为编码任务选默认模型并开启提示词缓存，观察预估成本变化"
      what="模型目录加载失败"
      why="模型网关探测请求超时（协议握手未在 3s 内完成）"
      how="可重试；失败时保留上次生效的默认模型，不会静默回退到其它模型"
      trace-id="trace-models-7c31"
      collapsed-summary="模型数量超阈值，下拉列表仅展示前 8 个（可在模型目录检索全量）。"
      :page-size="8"
      @retry="state = 'LOADING'"
      @empty-action="router.push('/model/providers')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">默认模型与推理参数</div>
          <div class="oc-stack">
            <div>
              <Select v-model="modelId" size="small" :options="modelOptions" />
              <div class="oc-muted" style="font-size: 12px">影响：单选即预览该模型画像；保存后作为新会话默认（路由规则的强制指定仍优先）。</div>
            </div>
            <div>
              <div class="oc-flex" style="gap: 8px; align-items: center">
                <span style="font-size: 12px">推理强度</span>
                <Select v-model="reasoning" size="small" style="width: 220px" :options="[{ label: 'low · 快（少推理增量）', value: 'low' }, { label: 'medium · 均衡（默认）', value: 'medium' }, { label: 'high · 深（成本更高）', value: 'high' }]" />
              </div>
              <div class="oc-muted" style="font-size: 12px">影响：控制推理增量 token 上限；high 会显著增加输出 token 与 TTFB。</div>
            </div>
            <div>
              <div class="oc-flex" style="gap: 8px; align-items: center">
                <span style="font-size: 12px">思考预算</span>
                <Select v-model="thinkingBudget" size="small" style="width: 220px" :options="budgetOptions" />
              </div>
              <div class="oc-muted" style="font-size: 12px">影响：单轮思考 token 上限；超限时截断思考并继续作答（截断会在会话流标注）。</div>
            </div>
            <div class="oc-flex" style="gap: 8px; align-items: center">
              <Switch v-model="structuredOutput" size="small" />
              <span style="font-size: 13px">结构化输出</span>
              <Tag size="small" variant="outline">不支持时走工具式输出 + 校验修复 ≤2 次</Tag>
            </div>
            <div class="oc-flex" style="gap: 8px; align-items: center">
              <Switch v-model="cacheEnabled" size="small" />
              <span style="font-size: 13px">上下文缓存（提示词缓存）</span>
              <Tag size="small" variant="outline">折扣单独计量，不混入净成本</Tag>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">所选模型画像</div>
          <InfoGrid :columns="2" :items="[
            { key: 'id', label: '模型 ID', value: model.modelId, mono: true, copyable: true },
            { key: 'provider', label: 'Provider', value: model.providerId, mono: true },
            { key: 'window', label: '上下文窗口', value: model.contextWindow.toLocaleString('zh-CN') },
            { key: 'maxOut', label: '最大输出', value: model.maxOutput.toLocaleString('zh-CN') },
            { key: 'in', label: '输入单价（/1M）', value: `$${model.pricing.input}` },
            { key: 'out', label: '输出单价（/1M）', value: `$${model.pricing.output}` },
            { key: 'cache', label: '缓存读单价（/1M）', value: `$${model.pricing.cacheRead}` },
            { key: 'residency', label: '数据驻留', value: model.dataResidency, span: 2 },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag v-for="t in model.tags" :key="t" size="small" variant="light-outline">{{ t }}</Tag>
            <Tag size="small" theme="default" variant="outline">版本 {{ model.version }}</Tag>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">降级行为说明（能力缺失 = 显式失败，不静默降级）</div>
        <Table :data="capabilityRows" row-key="key" size="small" :columns="capColumns" :pagination="undefined">
          <template #state="{ row }">
            <Tag size="small" :theme="CAPABILITY_STATE_META[row.state as 'supported' | 'degraded' | 'unsupported'].theme" variant="light-outline">
              {{ CAPABILITY_STATE_META[row.state as 'supported' | 'degraded' | 'unsupported'].label }}
            </Tag>
          </template>
          <template #behavior="{ row }"><span style="font-size: 12px">{{ row.behavior }}</span></template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          硬约束：装配期即校验能力位；运行期命中缺失能力报 UNSUPPORTED_CAPABILITY 并给出替代建议，禁止把失败包装成「已完成」。
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">模型灰度入口</div>
        <div v-if="gray" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <OcIcon name="filter" size="14px" />
          <span style="font-size: 13px">{{ gray.name }} · 目标 {{ gray.target }}</span>
          <Tag size="small" :theme="gray.status === 'running' ? 'warning' : 'default'" variant="light-outline">
            {{ gray.status === 'running' ? '灰度中' : gray.status }} · B 组 {{ gray.arms[1]?.trafficPct ?? 10 }}%
          </Tag>
          <Tag size="small" variant="outline">门控指标 {{ gray.gates.filter((g) => g.pass).length }}/{{ gray.gates.length }} 通过</Tag>
          <Button size="small" theme="primary" variant="outline" @click="router.push('/model/gray')">查看灰度详情</Button>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc model gray --show claude-sonnet-4.5" />
          <CopyableId id="trace-models-7c31" label="复制 traceId" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
