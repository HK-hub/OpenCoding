<script setup lang="ts">
/**
 * 计划编辑器（X-07）：八区编辑器（触发器/目标与输入/工作区绑定/预授权 Allowlist/并发策略/通知路由/熔断/保留）
 * + 保存校验（字段级中文原因，不允许静默降级）。
 * 溯源：卷 15 §4.4 Schedule 模型 / §4.5 无人值守安全模型。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { Button, Checkbox, CheckboxGroup, Dialog, Input, MessagePlugin, Popconfirm, RadioGroup, RadioButton, Select, Slider, Switch, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { ConcurrencyPolicy } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const saved = ref(false);
/** 字段级校验错误（键=字段路径，值=中文原因） */
const errors = reactive<Record<string, string>>({});
const blockedAttempt = ref('');

/** 干跑结果对话框 + 最近一次干跑时间（干跑零副作用：不写库、不发起运行） */
const dryRunOpen = ref(false);
const lastDryRunAt = ref('');

const form = reactive({
  name: '夜间依赖巡检与升级候选',
  desc: '每日 02:00 扫描依赖新版本，生成升级候选任务（不自动合入）。',
  enabled: true,
  triggerKind: 'time',
  cron: '0 2 * * 1-5',
  timezone: 'Asia/Shanghai',
  debounceMs: 0,
  throttleMs: 60_000,
  idempotencyKeyRule: '{scheduleId}:{cronWindow}:{workspace}',
  targetKind: 'task_template',
  targetRef: 'TPL-DEP-UPGRADE',
  inputs: [
    { key: 'scope', value: 'src/**' },
    { key: 'severity', value: 'minor' },
  ],
  workspace: 'local:/worktrees/payment-core',
  branch: 'oc/schedule-batch',
  env: 'shadow',
  allow: ['file.read', 'file.write:src/**', 'command.test'] as string[],
  concurrency: 'skip' as ConcurrencyPolicy,
  notifyP0: ['桌面通知', 'IM 机器人'] as string[],
  notifyP1: ['界面内', '邮件'] as string[],
  failureThreshold: 3,
  alertTargets: 'sre-oncall, team-supervisor',
  recoveryMode: 'manual',
  retention: 90,
});

const zones = computed(() => [
  { key: 'basic', title: '① 基本信息', ok: !!form.name.trim() },
  { key: 'trigger', title: '② 触发器', ok: !!form.cron.trim() || form.triggerKind === 'manual' },
  { key: 'target', title: '③ 目标与输入', ok: !!form.targetRef },
  { key: 'workspace', title: '④ 工作区绑定', ok: !!form.workspace && !!form.branch },
  { key: 'allow', title: '⑤ 预授权 Allowlist', ok: form.allow.length > 0 },
  { key: 'concurrency', title: '⑥ 并发策略', ok: !!form.concurrency },
  { key: 'notify', title: '⑦ 通知路由', ok: form.notifyP0.length > 0 },
  { key: 'breaker', title: '⑧ 熔断与保留', ok: form.failureThreshold >= 1 && !!form.retention },
]);

/** 预授权勾选：命中企业基线禁列即回退并解释（不做静默接受） */
function onAllowChange(v: unknown) {
  const list = (Array.isArray(v) ? v : []).map(String);
  const hit = list.filter((x) => ['git.push', 'production.write', 'secret.read'].includes(x));
  if (hit.length) {
    form.allow = list.filter((x) => !hit.includes(x));
    blockedAttempt.value = `${hit.join('、')} 不在预授权范围：企业基线禁止无人值守计划执行该动作（不可被计划放宽）。`;
    MessagePlugin.error('该动作被企业基线拒绝，未加入 Allowlist');
  }
}

function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k]);
  if (!form.name.trim()) errors.name = '计划名称必填';
  else if (form.name.length > 40) errors.name = '计划名称不超过 40 字（列表与通知展示需要）';
  if (form.triggerKind !== 'manual' && !form.cron.trim()) errors.cron = '时间类触发器必须填写 cron 表达式';
  if (form.triggerKind === 'time' && !/^[\d*,\-/ ]+$/.test(form.cron)) errors.cron = 'cron 表达式含非法字符（允许数字、* , - / 空格）';
  if (!form.targetRef) errors.targetRef = '必须选择触发对象（任务模板/计划模板/Goal/会话模板）';
  if (!form.workspace.trim()) errors.workspace = '工作区必填：决定写范围围栏与资源冲突判定';
  if (!form.allow.length) errors.allow = '预授权 Allowlist 不能为空：无人值守必须显式声明允许的动作类型';
  if (!form.notifyP0.length) errors.notifyP0 = 'P0 通知至少选择一个渠道（越界与熔断必须能触达人）';
  if (form.failureThreshold < 1 || form.failureThreshold > 10) errors.failureThreshold = '熔断阈值需在 1–10 之间';
  if (!form.idempotencyKeyRule.trim()) errors.idempotencyKeyRule = '幂等键规则必填：防重复触发';
  return Object.keys(errors).length === 0;
}

/**
 * 干跑校验（零副作用）：按当前表单推演将执行的动作与预授权清单，就地展示并可回看时间戳。
 * 只读表单：不写库、不发起运行；字段校验失败时把阻塞项一并列出（复用 validate 的字段级原因）。
 */
function dryRun() {
  const passed = validate();
  lastDryRunAt.value = new Date().toLocaleString('zh-CN');
  dryRunOpen.value = true;
  MessagePlugin.success(`干跑完成（零副作用）：${form.allow.length} 项预授权动作 / 目标 ${form.targetRef}；${passed ? '字段校验通过' : `${Object.keys(errors).length} 项字段校验未通过（见右侧面板）`}`);
}

function save() {
  if (!validate()) {
    MessagePlugin.error(`保存失败：${Object.keys(errors).length} 个字段校验未通过（逐项已标注原因）`);
    return;
  }
  saved.value = true;
  MessagePlugin.success('计划已保存并启用：下次触发进入排期，触发前仍会执行预授权校验');
}

onMounted(() => {
  window.setTimeout(() => { state.value = 'NORMAL'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="计划编辑器" volume="卷 15" manifest="X-07" cli="oc schedule edit SCH-01 --validate --save"
      desc="八区编辑器：触发器 / 目标与输入 / 工作区绑定 / 预授权 Allowlist / 并发策略 / 通知路由 / 熔断 / 保留。保存前做字段级校验，失败必须逐项给出中文原因。"
      :status="[{ label: saved ? '已保存' : '草稿', theme: saved ? 'success' : 'default' }, { label: '企业基线优先', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="dryRun">干跑校验</Button>
        <Popconfirm content="保存会覆盖当前版本并写入审计；已触发但未结束的运行不受影响。计划停用需另行操作（不会静默停用）。" theme="warning" @confirm="save">
          <Button size="small" theme="primary">保存并启用</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未创建计划" empty-desc="新建计划后在此编辑触发器、预授权与熔断策略。" empty-action="从模板新建"
      example-task="从「依赖升级」模板创建夜间巡检计划"
      what="计划加载失败" why="计划引用的工作区已被移除（workspace 引用悬空）"
      how="可重试；或改绑其他工作区后保存" trace-id="trace-7ab31e60"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已从模板新建计划草稿')"
    >
      <div class="oc-grid" style="grid-template-columns: minmax(0, 1fr) 320px; gap: 10px">
        <div class="oc-stack">
          <!-- ① 基本信息 -->
          <div class="oc-card">
            <div class="oc-flex--between">
              <div class="oc-card__title">① 基本信息</div>
              <Switch v-model="form.enabled" size="small" />
            </div>
            <Input v-model="form.name" size="small" placeholder="计划名称（必填，≤40 字）" />
            <div v-if="errors.name" class="oc-field-error">{{ errors.name }}</div>
            <Input v-model="form.desc" size="small" style="margin-top: 6px" placeholder="用途说明（将随通知一起发出）" />
          </div>

          <!-- ② 触发器 -->
          <div class="oc-card">
            <div class="oc-card__title">② 触发器（五类统一模型）</div>
            <div class="oc-flex oc-flex--wrap" style="gap: 8px">
              <Select v-model="form.triggerKind" size="small" style="width: 140px" :options="[
                { label: '时间', value: 'time' }, { label: '事件', value: 'event' },
                { label: '条件', value: 'condition' }, { label: '手动', value: 'manual' }, { label: '组合', value: 'composite' },
              ]" />
              <Input v-model="form.cron" size="small" style="flex: 1; min-width: 220px" placeholder="cron / 事件名 / 条件表达式" />
              <Select v-model="form.timezone" size="small" style="width: 180px" :options="[
                { label: 'Asia/Shanghai', value: 'Asia/Shanghai' }, { label: 'UTC', value: 'UTC' }, { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
              ]" />
            </div>
            <div v-if="errors.cron" class="oc-field-error">{{ errors.cron }}</div>
            <div class="oc-grid oc-grid--2" style="margin-top: 8px">
              <div>
                <div class="oc-muted" style="font-size: 11px">去抖（ms）</div>
                <Input v-model.number="form.debounceMs" size="small" type="number" />
              </div>
              <div>
                <div class="oc-muted" style="font-size: 11px">节流（ms）</div>
                <Input v-model.number="form.throttleMs" size="small" type="number" />
              </div>
            </div>
            <div class="oc-muted" style="font-size: 11px; margin-top: 6px">幂等键规则</div>
            <Input v-model="form.idempotencyKeyRule" size="small" class="oc-mono" />
            <div v-if="errors.idempotencyKeyRule" class="oc-field-error">{{ errors.idempotencyKeyRule }}</div>
            <div class="oc-muted oc-mono" style="font-size: 11px; margin-top: 4px">
              预览：{{ form.idempotencyKeyRule.replace('{scheduleId}', 'SCH-01').replace('{cronWindow}', '2026-09-22T02:00').replace('{workspace}', 'payment-core') }}
            </div>
          </div>

          <!-- ③ 目标与输入 -->
          <div class="oc-card">
            <div class="oc-card__title">③ 目标与输入</div>
            <div class="oc-flex oc-flex--wrap" style="gap: 8px">
              <Select v-model="form.targetKind" size="small" style="width: 180px" :options="[
                { label: '任务模板', value: 'task_template' }, { label: '计划模板', value: 'plan_template' },
                { label: 'Goal', value: 'goal' }, { label: '会话模板', value: 'session_template' },
              ]" />
              <Input v-model="form.targetRef" size="small" style="flex: 1; min-width: 200px" placeholder="模板 / Goal 引用" />
            </div>
            <div v-if="errors.targetRef" class="oc-field-error">{{ errors.targetRef }}</div>
            <div v-for="(i, idx) in form.inputs" :key="idx" class="oc-flex" style="gap: 8px; margin-top: 6px">
              <Input v-model="i.key" size="small" style="width: 160px" />
              <Input v-model="i.value" size="small" style="flex: 1" />
              <Button size="small" variant="text" theme="danger" @click="form.inputs.splice(idx, 1)">删除</Button>
            </div>
            <Button size="small" variant="outline" style="margin-top: 6px" @click="form.inputs.push({ key: '', value: '' })">新增输入参数</Button>
          </div>

          <!-- ④ 工作区绑定 -->
          <div class="oc-card">
            <div class="oc-card__title">④ 工作区绑定</div>
            <div class="oc-grid oc-grid--3">
              <div>
                <div class="oc-muted" style="font-size: 11px">工作区</div>
                <Input v-model="form.workspace" size="small" class="oc-mono" />
              </div>
              <div>
                <div class="oc-muted" style="font-size: 11px">分支</div>
                <Input v-model="form.branch" size="small" class="oc-mono" />
              </div>
              <div>
                <div class="oc-muted" style="font-size: 11px">环境</div>
                <Select v-model="form.env" size="small" :options="[{ label: 'shadow', value: 'shadow' }, { label: 'staging', value: 'staging' }, { label: 'prod', value: 'prod' }]" />
              </div>
            </div>
            <div v-if="errors.workspace" class="oc-field-error">{{ errors.workspace }}</div>
            <div v-if="form.env === 'prod'" class="oc-field-error">prod 环境不可作为无人值守目标：需人工触发 + 二次确认，请改绑 shadow/staging。</div>
          </div>

          <!-- ⑤ 预授权 Allowlist -->
          <div class="oc-card">
            <div class="oc-card__title">⑤ 预授权 Allowlist（越界即停）</div>
            <CheckboxGroup v-model="form.allow" @change="onAllowChange">
              <Checkbox v-for="a in ['file.read', 'file.write:src/**', 'command.test', 'git.commit', 'git.push', 'production.write', 'secret.read']" :key="a" :value="a">
                {{ a }}
              </Checkbox>
            </CheckboxGroup>
            <div v-if="errors.allow" class="oc-field-error">{{ errors.allow }}</div>
            <div v-if="blockedAttempt" class="oc-field-error">{{ blockedAttempt }}</div>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 6px">
              <RiskBadge level="R3" />
              <RiskBadge level="R4" />
              <Tag size="small" variant="outline">权限上限：计划 ≤ 会话 ≤ 企业基线（单调，不可放宽）</Tag>
            </div>
          </div>

          <!-- ⑥ 并发策略 -->
          <div class="oc-card">
            <div class="oc-card__title">⑥ 并发策略（重叠处理）</div>
            <RadioGroup v-model="form.concurrency" variant="default-filled" size="small">
              <RadioButton value="skip">skip（跳过本次）</RadioButton>
              <RadioButton value="queue">queue（排队）</RadioButton>
              <RadioButton value="replace">replace（替换）</RadioButton>
              <RadioButton value="parallel">parallel（并行）</RadioButton>
            </RadioGroup>
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
              同计划重叠时按此策略处理；跨计划冲突另见「计划日历」的资源冲突面板。
            </div>
          </div>

          <!-- ⑦ 通知路由 -->
          <div class="oc-card">
            <div class="oc-card__title">⑦ 通知路由（级别 → 渠道）</div>
            <div class="oc-muted" style="font-size: 11px">P0（越界/熔断，穿透静默）</div>
            <CheckboxGroup v-model="form.notifyP0" style="margin-bottom: 6px">
              <Checkbox v-for="ch in ['桌面通知', 'IM 机器人', '邮件', 'Webhook']" :key="ch" :value="ch">{{ ch }}</Checkbox>
            </CheckboxGroup>
            <div v-if="errors.notifyP0" class="oc-field-error">{{ errors.notifyP0 }}</div>
            <div class="oc-muted" style="font-size: 11px">P1（运行失败/取消）</div>
            <CheckboxGroup v-model="form.notifyP1">
              <Checkbox v-for="ch in ['界面内', '邮件', 'IM 机器人']" :key="ch" :value="ch">{{ ch }}</Checkbox>
            </CheckboxGroup>
          </div>

          <!-- ⑧ 熔断与保留 -->
          <div class="oc-card">
            <div class="oc-card__title">⑧ 熔断与保留</div>
            <div class="oc-muted" style="font-size: 12px">连续失败阈值：{{ form.failureThreshold }} 次</div>
            <Slider v-model="form.failureThreshold" :min="1" :max="10" :step="1" />
            <div v-if="errors.failureThreshold" class="oc-field-error">{{ errors.failureThreshold }}</div>
            <Input v-model="form.alertTargets" size="small" style="margin-top: 6px" placeholder="告警对象（逗号分隔）" />
            <div class="oc-flex" style="gap: 8px; margin-top: 6px; align-items: center">
              <OcIcon name="secured" size="13px" />
              <span class="oc-secondary" style="font-size: 12px">恢复方式</span>
              <RadioGroup v-model="form.recoveryMode" variant="default-filled" size="small">
                <RadioButton value="manual">人工确认（默认，不可自动恢复）</RadioButton>
                <RadioButton value="auto_low_risk">低风险自动（仅只读计划）</RadioButton>
              </RadioGroup>
            </div>
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">运行记录保留：{{ form.retention }} 天</div>
            <Slider v-model="form.retention" :min="30" :max="365" :step="30" />
          </div>
        </div>

        <!-- 右侧：校验与摘要 -->
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">八区完成度</div>
            <div v-for="z in zones" :key="z.key" class="oc-flex" style="gap: 6px; font-size: 12px">
              <OcIcon :name="z.ok ? 'check' : 'close'" size="12px" :color="z.ok ? 'var(--td-success-color)' : 'var(--oc-sev-error)'" />
              {{ z.title }}
            </div>
          </div>
          <div v-if="Object.keys(errors).length" class="oc-card" style="border-color: var(--oc-sev-error)">
            <div class="oc-card__title">保存校验失败（{{ Object.keys(errors).length }} 项）</div>
            <div v-for="(msg, key) in errors" :key="key" class="oc-flex" style="gap: 6px; font-size: 12px">
              <Tag size="small" theme="danger" variant="outline" class="oc-mono">{{ key }}</Tag>
              {{ msg }}
            </div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">摘要</div>
            <InfoGrid :columns="1" :items="[
              { key: 'trig', label: '触发器', value: `${form.triggerKind} · ${form.cron}` },
              { key: 'tgt', label: '触发对象', value: `${form.targetKind} / ${form.targetRef}` },
              { key: 'ws', label: '工作区', value: `${form.workspace}@${form.branch}`, mono: true },
              { key: 'allow', label: '预授权', value: form.allow.join('、') },
              { key: 'conc', label: '并发策略', value: form.concurrency },
              { key: 'ret', label: '保留', value: `${form.retention} 天` },
            ]" />
            <div class="oc-flex" style="gap: 8px; margin-top: 6px">
              <CliHint command="oc schedule validate SCH-01 --explain" />
              <div v-if="lastDryRunAt" class="oc-muted" style="font-size: 12px; margin-top: 6px">
                最近干跑 {{ lastDryRunAt }} · 零副作用（未写库、未发起运行）
              </div>
              <CopyableId id="trace-7ab31e60" label="复制 traceId" />
            </div>
          </div>
        </div>
      </div>
    </StateShell>
    <Dialog v-model:visible="dryRunOpen" header="干跑校验结果（零副作用）" width="680px" :footer="false">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag size="small" theme="primary" variant="light-outline">未写库 · 未发起运行</Tag>
          <Tag size="small" variant="outline">干跑时间 {{ lastDryRunAt }}</Tag>
          <Tag v-if="Object.keys(errors).length" size="small" theme="danger" variant="light-outline">字段校验 {{ Object.keys(errors).length }} 项未通过</Tag>
          <Tag v-else size="small" theme="success" variant="light-outline">字段校验通过</Tag>
        </div>
        <div style="font-size: 12px">
          <div>触发器：{{ form.triggerKind }} · {{ form.cron }} · {{ form.timezone }}</div>
          <div>触发对象：{{ form.targetKind }} / {{ form.targetRef }}</div>
          <div>工作区 / 环境（写围栏）：{{ form.workspace }}@{{ form.branch }} · {{ form.env }}</div>
          <div>重叠处理（并发策略）：{{ form.concurrency }}</div>
          <div>P0 通知渠道：{{ form.notifyP0.join('、') }}</div>
          <div>熔断 / 恢复 / 保留：连续失败 {{ form.failureThreshold }} 次熔断 · 恢复 {{ form.recoveryMode }} · 保留 {{ form.retention }} 天</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">将被授权的动作清单（预授权 Allowlist）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag v-for="a in form.allow" :key="a" size="small" variant="light-outline" class="oc-mono">{{ a }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">越界即停：清单外动作在无人值守运行时一律拒绝（企业基线禁止项无法被计划放宽）。</div>
        </div>
        <div class="oc-muted" style="font-size: 12px">干跑只读当前表单：不写入计划、不发起运行、不产生 token 成本；确认无误后用「保存并启用」落库。</div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.oc-field-error {
  font-size: 11px;
  color: var(--oc-sev-error);
  margin-top: 4px;
}
</style>
