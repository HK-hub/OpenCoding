<script setup lang="ts">
/**
 * 提交调试台（Q-05）：幂等键 / 预算 / 回调 / 优先级 + 请求预览（不真实提交）。
 * 溯源：卷 23 §4.1（POST /a2a/v1/tasks）§4.8
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, InputNumber, MessagePlugin, Radio, RadioGroup, Select, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'ERROR'>('LOADING');
const dryRun = ref(true);
const form = ref({
  instruction: '修复 payment-core 的 flaky 用例并提 PR',
  idempotencyKey: 'idem-ci-20260921-01',
  budgetUsd: 5,
  priority: 'P1',
  mode: 'default',
  caller: 'cal-ci-01',
  callbackUrl: 'https://caller.example.com/a2a/cb/9f2a1c',
  targetWorkspace: 'ws-142',
});
/** 请求预览（提交前可复制；dry-run 不产生副作用） */
const payload = computed(() => JSON.stringify({
  instruction: form.value.instruction,
  idempotencyKey: form.value.idempotencyKey,
  budgetUsd: form.value.budgetUsd,
  priority: form.value.priority,
  mode: form.value.mode,
  callerId: form.value.caller,
  approvalCallbackUrl: form.value.callbackUrl,
  targetWorkspaceId: form.value.targetWorkspace,
}, null, 2));
const budgetValid = computed(() => form.value.budgetUsd >= 0.1);

function submit() {
  if (!budgetValid.value) {
    MessagePlugin.warning('预算上限必填且 ≥ $0.10（防流水线失控）：请调整预算后重试');
    return;
  }
  MessagePlugin.success(`已提交（${dryRun.value ? '干跑：仅打印请求，无副作用' : '真实提交，返回 taskId'}）`);
}

onMounted(() => {
  setTimeout(() => { state.value = 'NORMAL'; ui.setViewState({ state: 'NORMAL' }); }, 200);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="提交调试台"
      desc="以调用方视角验证服务面：幂等键、预算、审批回调、优先级与目标工作区；默认干跑，不产生副作用。"
      volume="卷 23"
      manifest="Q-05"
      cli="oc a2a submit --dry-run --json"
      :status="[{ label: '干跑默认开启', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="dryRun = !dryRun">{{ dryRun ? '转为真实提交' : '切回干跑' }}</Button>
        <Button size="small" theme="primary" @click="submit">提交</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      what="调试台初始化失败"
      why="服务面未启用（local 形态默认关闭，仅回环）或调用方凭证引用不可用"
      how="可重试；或在「A2A 服务面」启用后返回此页"
      trace-id="trace-a2a-submit-77a1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="提交延迟目标" value="≤ 300ms" format="raw" hint="不含排队时间（SLO）" />
        <StatCard label="当前排队深度" :value="d.a2a.tasks.filter((t) => t.status === 'queued').length" unit="个" />
        <StatCard label="CI 并发配额" :value="2" unit="个" hint="CI-CD 调用方默认并发 2" />
        <StatCard label="CI 日预算" :value="50" format="cost" unit="USD" hint="超限即停并报告" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">请求参数</div>
          <div class="oc-stack">
            <div>
              <div class="oc-muted" style="font-size: 12px">指令（真实口吻，非理想化描述）</div>
              <Textarea v-model="form.instruction" :autosize="{ minRows: 2, maxRows: 4 }" />
            </div>
            <div class="oc-grid oc-grid--2">
              <div>
                <div class="oc-muted" style="font-size: 12px">幂等键（必填）</div>
                <Input v-model="form.idempotencyKey" size="small" />
              </div>
              <div>
                <div class="oc-muted" style="font-size: 12px">预算上限（USD，≥ 0.10）</div>
                <InputNumber v-model="form.budgetUsd" :min="0" :step="0.5" size="small" theme="column" />
              </div>
            </div>
            <div class="oc-grid oc-grid--2">
              <div>
                <div class="oc-muted" style="font-size: 12px">优先级</div>
                <RadioGroup v-model="form.priority" size="small" variant="default-filled">
                  <Radio value="P0">P0</Radio>
                  <Radio value="P1">P1</Radio>
                  <Radio value="P2">P2</Radio>
                </RadioGroup>
              </div>
              <div>
                <div class="oc-muted" style="font-size: 12px">权限模式</div>
                <Select v-model="form.mode" size="small" :options="[{ label: 'readonly（默认最严）', value: 'readonly' }, { label: 'plan', value: 'plan' }, { label: 'default', value: 'default' }, { label: 'autonomous（需额外授权）', value: 'autonomous' }]" />
              </div>
            </div>
            <div>
              <div class="oc-muted" style="font-size: 12px">调用方</div>
              <Select v-model="form.caller" size="small" :options="d.a2a.callerQuotas.map((c) => ({ label: `${c.callerType} · ${c.auth}`, value: c.callerType }))" />
            </div>
            <div>
              <div class="oc-muted" style="font-size: 12px">审批回调地址（超时默认拒绝）</div>
              <Input v-model="form.callbackUrl" size="small" />
            </div>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" variant="outline">目标工作区 {{ form.targetWorkspace }}</Tag>
              <Tag size="small" :theme="budgetValid ? 'success' : 'danger'" variant="light-outline">{{ budgetValid ? '预算合法' : '预算非法：必填且 ≥ $0.10' }}</Tag>
              <Tag size="small" theme="warning" variant="light-outline">沙箱下限 L1（外部调用方）</Tag>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">请求预览（可复制给 CI）</div>
            <CopyableId id="corr-submit-7731" label="复制 correlationId" />
          </div>
          <pre class="oc-pre" style="max-height: 300px; overflow: auto">{{ payload }}</pre>
          <CliHint command="curl -X POST $OC/a2a/v1/tasks -H 'Authorization: Bearer $OC_KEY' -d @payload.json" label="等价 curl" />
          <div class="oc-state__hint" style="margin-top: 6px">
            干跑语义：仅校验参数与权限（不占用配额、不排队、不产生事件）；真实提交后返回 taskId 并开始排队。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">提交前校验（对齐服务面约束）</div>
        <div class="oc-stack">
          <div v-for="c in d.a2a.agentCard.constraints" :key="c.key" class="oc-flex--between">
            <span class="oc-muted">{{ c.label }}</span>
            <span class="oc-flex" style="gap: 6px">
              <span class="oc-mono">{{ c.value }}</span>
              <Tag size="small" :theme="c.enforced ? 'warning' : 'default'" variant="light-outline">{{ c.enforced ? '强制' : '提示' }}</Tag>
            </span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
