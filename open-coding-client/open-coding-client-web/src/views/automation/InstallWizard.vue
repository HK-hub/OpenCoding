<script setup lang="ts">
/**
 * 安装配置向导（N2-03）：装（来源 + 签名）→ 配（inputs 动态表单 + target + 触发器）→ 启（门禁 + 授权快照 + 预算信封）。
 * 溯源：卷 34 §5.2/§5.4/§5.7；BUILD-MANIFEST N2-03。
 * 契约：不自我提权（模板只能在授予集内行动）；Fail-Fast（缺 steps/verification/permissions/budget 即拒绝装载）。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, InputNumber, MessagePlugin, Popconfirm, Select, StepItem, Steps, Switch, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

const STEPS = [
  { id: 'S1', title: '装 · 来源与签名', why: '确认来源（内置/私仓/市场）与签名结论；未签名在强制模式下直接拒绝，不静默降格。' },
  { id: 'S2', title: '配 · 参数与目标', why: '输入契约影响幂等键（inputsDigest 只对影响行为的参数取哈希），目标绑定决定作用范围。' },
  { id: 'S3', title: '启 · 门禁与授权', why: '授权快照与预算信封在启用时冻结；此后模板无法提升权限或修改自身。' },
];

const step = ref(0);
const templateId = ref('builtin.repo-health');
const tpl = computed(() => automationData.templates.find((t) => t.id === templateId.value)!);
const bindings = ref<Record<string, string>>({});
const targetKind = ref(tpl.value.target);
const targetRef = ref('task-template/repo-health');
const triggerPick = ref<string[]>(tpl.value.triggers.map((tr) => tr.kind));
const gate = ref({ dryRun: true, sandbox: true, artifact: true });

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

function reset() {
  bindings.value = Object.fromEntries(tpl.value.inputs.map((i) => [i.name, String(i.default)]));
  targetKind.value = tpl.value.target;
  targetRef.value = `${tpl.value.target}/auto`;
  triggerPick.value = tpl.value.triggers.map((tr) => tr.kind);
}

function onTemplate(v: unknown) {
  templateId.value = String(v);
  reset();
}

/** 参数联动：改动 inputs 后刷新 binding（占位符在参数校验之后才展开） */
function onInput(name: string, v: unknown) {
  bindings.value = { ...bindings.value, [name]: String(v) };
}

/** 门禁开关：三件套缺一不可启用 */
function onGate(key: 'dryRun' | 'sandbox' | 'artifact', v: unknown) {
  gate.value = { ...gate.value, [key]: Boolean(v) };
}

const gatePass = computed(() => gate.value.dryRun && gate.value.sandbox && gate.value.artifact);
const state = computed<Demo>(() => (demo.value === 'NORMAL' && !tpl.value ? 'EMPTY' : demo.value));

onMounted(() => {
  reset();
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});

function enable() {
  MessagePlugin.success(`实例已启用：${tpl.value.name} v${tpl.value.version}（授权快照与预算信封已冻结）`);
  ui.pushNotification({
    kind: 'task_done', level: 'P1', title: '模板实例已启用',
    body: `${tpl.value.name} 已绑定 ${targetRef.value}；首次运行将走干跑 + 沙箱试运行门禁。`,
    actions: [{ label: '查看实例', path: '/automation/instances' }], aggregateKey: 'automation-install', penetrateQuiet: false, channel: 'inapp',
  });
  router.push('/automation/instances');
}
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="安装配置向导"
      desc="三步完成：装（来源 + 签名）→ 配（inputs 动态表单 + 目标 + 触发器）→ 启（门禁 + 授权快照 + 预算信封）。"
      volume="卷 34" manifest="N2-03" cli="oc automation install --template builtin.repo-health --target task-template/repo-health"
      :status="[{ label: '权限不自我提升', theme: 'success' }, { label: '默认只提 PR', theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="router.push('/automation/templates')">返回市场</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state" stage="正在校验模板装载前置条件…"
      empty-title="未选择模板" empty-desc="请先在模板市场选择一个模板，再回到本向导完成安装。"
      empty-action="去模板市场" example-task="安装「仓库健康巡检」并先跑一次干跑"
      what="装载校验失败" why="模板缺少 steps / verification / permissions / budget 任一必填项（Fail-Fast）"
      how="联系模板作者补齐声明后重试；已给出中文原因与缺失字段" trace-id="trace-77d1e09a"
      @retry="demo = 'NORMAL'" @empty-action="router.push('/automation/templates')"
    >
      <Steps v-model="step" style="margin-bottom: 12px">
        <StepItem v-for="(s, i) in STEPS" :key="s.id" :value="i" :title="s.title" :status="i < step ? 'finish' : i === step ? 'process' : 'default'" />
      </Steps>

      <Alert theme="info" :message="`为什么需要这一步：${STEPS[step].why}`" style="margin-bottom: 10px" />

      <!-- S1 装 -->
      <div v-if="step === 0" class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">选择模板与来源</div>
          <Select
            :value="templateId" style="width: 100%" aria-label="模板"
            :options="automationData.templates.map((t) => ({ value: t.id, label: `${t.name} v${t.version}（${t.category} · ${t.riskLevel}）` }))"
            @change="onTemplate"
          />
          <div class="oc-divider" />
          <InfoGrid :columns="1" :items="[
            { key: 'cat', label: '分类', value: tpl.category },
            { key: 'prov', label: '来源', value: tpl.provenance, tag: { text: tpl.provenance, theme: tpl.provenance === 'builtin' ? 'primary' : 'success' } },
            { key: 'sign', label: '签名', value: tpl.signature, mono: true, copyable: true },
            { key: 'signer', label: '签名主体', value: tpl.signedBy },
            { key: 'contract', label: '兼容区间', value: tpl.compat.contractVersion },
            { key: 'tier', label: '沙箱档位', value: tpl.sandboxTier },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">装载前交叉校验</div>
          <div class="oc-stack" style="gap: 6px">
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="success" variant="light-outline">签名有效</Tag><span style="font-size: 13px">ed25519 校验通过，未过期</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="success" variant="light-outline">声明与实际一致</Tag><span style="font-size: 13px">风险级 {{ tpl.riskLevel }} 与 permissions 交叉校验通过</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="success" variant="light-outline">无自修改能力</Tag><span style="font-size: 13px">模板无法修改自身、无法提升上限、无法安装其它模板</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="warning" variant="light-outline">上限清单锁定</Tag><span style="font-size: 13px">禁 force-push / 删他分支 / 生产写 / 密钥读取 / 审计改写 / 策略修改</span></div>
          </div>
          <div class="oc-divider" />
          <div class="oc-flex" style="gap: 6px"><RiskBadge :level="tpl.riskLevel" show-desc /></div>
        </div>
      </div>

      <!-- S2 配 -->
      <div v-else-if="step === 1" class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">inputs 动态表单（来自参数契约）</div>
          <div v-for="inp in tpl.inputs" :key="inp.name" class="oc-flex" style="gap: 8px; margin-bottom: 8px; align-items: center">
            <span class="oc-mono" style="width: 130px; font-size: 12px">{{ inp.name }}</span>
            <Select v-if="inp.type === 'enum'" :value="bindings[inp.name]" style="width: 220px" :options="(inp.enum ?? []).map((e) => ({ value: e, label: e }))" @change="(v: unknown) => onInput(inp.name, v)" />
            <InputNumber v-else-if="inp.type === 'integer'" :value="Number(bindings[inp.name])" style="width: 220px" @change="(v: unknown) => onInput(inp.name, v)" />
            <Switch v-else-if="inp.type === 'boolean'" :value="bindings[inp.name] === 'true'" @change="(v: unknown) => onInput(inp.name, v)" />
            <Input v-else :value="bindings[inp.name]" style="width: 220px" @change="(v: unknown) => onInput(inp.name, v)" />
            <Tag size="small" variant="outline">{{ inp.source }}</Tag>
            <Tag v-if="inp.required" size="small" theme="warning" variant="light-outline">必填</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px">
            inputsDigest 只对影响行为的参数取哈希（展示类参数不参与），避免仅改格式即绕过去重窗口。
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">目标与触发器</div>
          <InfoGrid :columns="1" :items="[
            { key: 'kind', label: '触发对象类型', value: targetKind, tag: { text: targetKind, theme: 'primary' } },
            { key: 'ref', label: '目标引用', value: targetRef, mono: true, copyable: true },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin: 8px 0">
            <Tag v-for="tr in tpl.triggers" :key="tr.kind" size="small" :theme="triggerPick.includes(tr.kind) ? 'success' : 'default'" variant="light-outline">
              {{ tr.kind }} · {{ tr.spec }}
            </Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px">
            幂等键 = hash(templateId, version, targetRef, inputsDigest)；去重窗口内重复触发落 DEDUPLICATED（解释「为什么没跑」）。
          </div>
        </div>
      </div>

      <!-- S3 启 -->
      <div v-else class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">三件套门禁（缺一不可启用）</div>
          <div class="oc-stack" style="gap: 8px">
            <div class="oc-flex" style="gap: 8px"><Switch :value="gate.dryRun" size="small" @change="onGate('dryRun', $event)" /><span style="font-size: 13px">① 干跑通过（「预期动作 + 权限清单」，零副作用 ≤60s）</span></div>
            <div class="oc-flex" style="gap: 8px"><Switch :value="gate.sandbox" size="small" @change="onGate('sandbox', $event)" /><span style="font-size: 13px">② 沙箱试运行通过（步骤账本 + 断言结果）</span></div>
            <div class="oc-flex" style="gap: 8px"><Switch :value="gate.artifact" size="small" @change="onGate('artifact', $event)" /><span style="font-size: 13px">③ 产出断言通过（verification 全部机械判定）</span></div>
          </div>
          <div class="oc-divider" />
          <InfoGrid :columns="1" :items="[
            { key: 'ceil', label: '授权上限', value: tpl.permissions.ceiling, tag: { text: '实例化时授予，不可提升', theme: 'warning' } },
            { key: 'acts', label: '授予动作', value: tpl.permissions.allow.join('、'), block: true },
            { key: 'deny', label: '拒绝（含决策链 deny 不可被模板覆盖）', value: tpl.permissions.denied.join('、'), block: true },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">授权快照预览与预算信封<CliHint command="oc automation instance create --from-snapshot" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'by', label: '授予人', value: '当前登录用户（你）' },
            { key: 'at', label: '授予时间', value: new Date().toLocaleString('zh-CN') },
            { key: 'base', label: '企业基线版本', value: 'enterprise-baseline@2026.07' },
            { key: 'budget', label: '预算信封', value: `$${tpl.budget.costUsd} / ${tpl.budget.durationMin}min / ${tpl.budget.toolCalls} 次调用 / 扇出 ${tpl.budget.fanout}` },
            { key: 'audit', label: '审计', value: '授权快照为「强制」审计项，不可关闭' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" :theme="gatePass ? 'success' : 'warning'" variant="light-outline">{{ gatePass ? '门禁已就绪' : '门禁未通过，无法启用' }}</Tag>
            <Tag size="small" variant="outline">首次运行仍走决策链逐动作裁决</Tag>
          </div>
        </div>
      </div>

      <footer class="oc-flex--between" style="margin-top: 12px">
        <div class="oc-flex" style="gap: 8px">
          <Button v-if="step > 0" variant="outline" @click="step -= 1">上一步</Button>
          <span class="oc-muted" style="font-size: 12px">枚举覆盖：{{ automationData.templates.length }} 个模板族可选</span>
        </div>
        <div class="oc-flex" style="gap: 8px">
          <Button variant="text" @click="router.push('/automation/dry-run')">先干跑</Button>
          <Button v-if="step < 2" theme="primary" @click="step += 1">下一步</Button>
          <Popconfirm v-else content="启用后实例获得声明的预授权动作（不含上限清单）；运行仍逐动作过决策链。是否启用？" @confirm="enable">
            <Button theme="primary" :disabled="!gatePass">启用实例</Button>
          </Popconfirm>
        </div>
      </footer>
    </StateShell>
  </div>
</template>
