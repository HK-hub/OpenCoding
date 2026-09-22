<script setup lang="ts">
/**
 * 创建目标（X-02）：八步向导（目标→验收标准→约束→预算→自治级别→介入点→汇报策略→终止条件）。
 * 每步给出「为什么需要」；非必需步骤可跳过并采用安全默认值；最后一次原子提交。
 * 溯源：卷 15 §4.1 Goal 契约 / §10 默认决策（验收标准必须有，无则由 Agent 生成候选并请用户确认）。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { Button, Checkbox, CheckboxGroup, Input, MessagePlugin, Popconfirm, RadioGroup, RadioButton, Slider, Steps, StepItem, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { AUTONOMY_META } from '@/mock/data/task';
import type { AutonomyLevel } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const current = ref(0);
const skipped = ref<number[]>([]);
const fieldError = ref('');

const STEP_TITLES = ['目标', '验收标准', '约束', '预算', '自治级别', '介入点', '汇报策略', '终止条件'];
const WHY = [
  '没有明确目标陈述，Agent 会在执行中自行猜测方向，导致漂移无法检测。',
  '验收标准是达成判定的唯一依据：模型自评不可信（假完成），必须逐条可检验。',
  '约束是硬边界（不可改的模块、不可外发的数据、时间窗），防止用错误方式达成目标。',
  '预算是硬上限：Goal 会持续 Tick，没有上限会无限消耗 token 与成本。',
  '自治级别决定哪些动作可以自主执行；受企业基线钳制，目标不能放宽基线。',
  '介入点声明「必须人工确认的节点」，把人的注意力放在真正需要判断的位置。',
  '汇报策略决定你多久被打扰一次，以及结束时收到什么。',
  '多重终止条件保证目标不会失控：任一条件命中即停止并生成终止报告。',
];

const form = reactive({
  objective: '把 6 个服务的回执处理收敛为单一模板实现，行为等价且可回归验证。',
  metric: '幂等冲突率 ≤ 0.01%；对拍差异 = 0',
  criteria: [
    { text: '行为等价：旧新实现对拍 10,000 组合 0 差异', verifyMethod: 'L2 可执行：对拍工具' },
    { text: '6 个服务全部接入公共模板', verifyMethod: 'L1 静态：接入清单核对' },
  ],
  constraints: ['每批合入前必须通过对拍', '分批串行合入（同工作区）', '单批预算 ≤ $6'],
  budgetCost: 36,
  budgetTokens: 12_000_000,
  durationHours: 336,
  maxIterations: 600,
  autonomy: 'collaborate' as AutonomyLevel,
  interventions: ['契约发布前确认', '生产数据迁移前确认'],
  reportInterval: '每 30 分钟或每 10 步（先到者为准）',
  reportChannels: ['界面内', 'IM 机器人'],
  nodeReport: true,
  endReport: true,
  terminations: ['达成', '预算', '风险'],
});

const stepOptions = computed(() => STEP_TITLES.map((t, i) => ({
  value: i, title: t, content: skipped.value.includes(i) ? '已跳过（用默认值）' : '必填/可跳过',
})));

function skip() {
  if (!skipped.value.includes(current.value)) skipped.value.push(current.value);
  MessagePlugin.info(`已跳过「${STEP_TITLES[current.value]}」：采用安全默认值（可在提交前返回修改）`);
  if (current.value < 7) current.value += 1;
}

function skipRest() {
  for (let i = current.value; i < 8; i += 1) if (!skipped.value.includes(i)) skipped.value.push(i);
  MessagePlugin.info('已跳过剩余步骤，全部采用安全默认值');
}

function addCriterion() {
  form.criteria.push({ text: '', verifyMethod: '' });
}

function validate(): number {
  if (!form.objective.trim()) return 0;
  if (!form.criteria.length || form.criteria.some((c) => !c.text.trim() || !c.verifyMethod.trim())) return 1;
  if (!form.terminations.length) return 7;
  return -1;
}

function submit() {
  const bad = validate();
  if (bad >= 0) {
    fieldError.value = bad === 0 ? '目标陈述不能为空（必填）'
      : bad === 1 ? '每条验收标准必须同时填写「判据」与「验证方式」，否则无法判定达成'
        : '至少保留一个终止条件，否则目标可能永不停止';
    current.value = bad;
    MessagePlugin.error(fieldError.value);
    return;
  }
  fieldError.value = '';
  MessagePlugin.success('目标已原子创建：goal.created 事件写入，Tick 循环将在 1 分钟内首次唤醒');
}

onMounted(() => {
  window.setTimeout(() => { state.value = 'NORMAL'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="创建目标" volume="卷 15" manifest="X-02" cli="oc goal create --from-wizard --atomic"
      desc="八步契约向导：每步说明「为什么需要」，非必需步骤可跳过并采用安全默认值；提交为原子操作（校验失败不写入任何内容）。"
      :status="[{ label: `第 ${current + 1} / 8 步`, theme: 'primary' }, { label: `已跳过 ${skipped.length} 步`, theme: skipped.length ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="skipRest">跳过剩余</Button>
        <Button size="small" variant="outline" @click="skip">跳过此步</Button>
        <Popconfirm content="提交将原子创建目标与 Tick 循环；校验不通过则不写入任何内容（不会产生半成品目标）。" theme="warning" @confirm="submit">
          <Button size="small" theme="primary">提交创建</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="向导未开始" empty-desc="需要先选择工作区与负责人，向导才能生成默认值。" empty-action="选择工作区"
      example-task="从团队模板创建目标（沿用模板的验收标准与预算）"
      what="向导状态恢复失败" why="上次未提交的草稿与最新企业基线冲突（自治级别被基线钳制）"
      how="已按基线重置草稿；可重试或从模板创建" trace-id="trace-2ab77f90"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已选择默认工作区 local:/worktrees/refactor-batch')"
    >
      <div class="oc-card" style="margin-bottom: 10px">
        <Steps v-model="current" :options="stepOptions" size="small">
          <template #default />
        </Steps>
      </div>

      <div class="oc-grid" style="grid-template-columns: minmax(0, 1fr) 320px; gap: 10px">
        <div class="oc-stack">
          <div class="oc-card" style="border-left: 3px solid var(--td-brand-color)">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" theme="primary" variant="light-outline">为什么需要</Tag>
              <span class="oc-secondary" style="font-size: 12px">{{ WHY[current] }}</span>
            </div>
          </div>

          <!-- 第 1 步：目标 -->
          <div v-if="current === 0" class="oc-card">
            <div class="oc-card__title">目标陈述</div>
            <Textarea v-model="form.objective" :autosize="{ minRows: 3 }" placeholder="自然语言描述要达成的结果（避免写成动作清单）" />
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">可选：结构化指标（用于漂移检测的语义对照）</div>
            <Input v-model="form.metric" size="small" style="margin-top: 4px" />
          </div>

          <!-- 第 2 步：验收标准 -->
          <div v-else-if="current === 1" class="oc-card">
            <div class="oc-flex--between">
              <div class="oc-card__title">验收标准（{{ form.criteria.length }} 条）</div>
              <Button size="small" variant="outline" @click="addCriterion">新增条目</Button>
            </div>
            <div v-for="(c, i) in form.criteria" :key="i" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 6px">
              <Input v-model="c.text" size="small" placeholder="可检验判据" style="min-width: 260px; flex: 1" />
              <Input v-model="c.verifyMethod" size="small" placeholder="验证方式（L1/L2/L3）" style="min-width: 220px; flex: 1" />
              <Button size="small" variant="text" theme="danger" @click="form.criteria.splice(i, 1)">删除</Button>
            </div>
            <div class="oc-muted" style="font-size: 12px">无验收标准时目标不可启动：Agent 会先生成候选请你确认。</div>
          </div>

          <!-- 第 3 步：约束 -->
          <div v-else-if="current === 2" class="oc-card">
            <div class="oc-card__title">约束</div>
            <CheckboxGroup v-model="form.constraints">
              <Checkbox v-for="c in ['每批合入前必须通过对拍', '分批串行合入（同工作区）', '单批预算 ≤ $6', '不得在业务高峰（09:00–21:00）外发']" :key="c" :value="c">{{ c }}</Checkbox>
            </CheckboxGroup>
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">约束参与漂移检测的「约束违反扫描」，命中即暂停。</div>
          </div>

          <!-- 第 4 步：预算 -->
          <div v-else-if="current === 3" class="oc-card">
            <div class="oc-card__title">预算信封</div>
            <div class="oc-muted" style="font-size: 12px">成本上限（USD）：${{ form.budgetCost }}</div>
            <Slider v-model="form.budgetCost" :min="5" :max="120" :step="1" />
            <div class="oc-muted" style="font-size: 12px">Token 上限：{{ (form.budgetTokens / 1_000_000).toFixed(1) }}M</div>
            <Slider v-model="form.budgetTokens" :min="1_000_000" :max="40_000_000" :step="1_000_000" />
            <InfoGrid :columns="2" :items="[
              { key: 'dur', label: '时间上限', value: `${form.durationHours} 小时（${Math.round(form.durationHours / 24)} 天）` },
              { key: 'iter', label: '最多迭代步数', value: String(form.maxIterations) },
            ]" />
          </div>

          <!-- 第 5 步：自治级别 -->
          <div v-else-if="current === 4" class="oc-card">
            <div class="oc-card__title">自治级别</div>
            <RadioGroup v-model="form.autonomy" variant="default-filled" size="small">
              <RadioButton v-for="a in (['propose', 'collaborate', 'autonomous'] as AutonomyLevel[])" :key="a" :value="a">{{ AUTONOMY_META[a].label }}</RadioButton>
            </RadioGroup>
            <div class="oc-secondary" style="font-size: 12px; margin-top: 6px">{{ AUTONOMY_META[form.autonomy].desc }}</div>
            <div class="oc-muted" style="font-size: 12px; margin-top: 4px">企业基线钳制：若目标选择自治但基线为协作，实际以基线为准并提示。</div>
          </div>

          <!-- 第 6 步：介入点 -->
          <div v-else-if="current === 5" class="oc-card">
            <div class="oc-card__title">介入点（必须人工确认的节点）</div>
            <CheckboxGroup v-model="form.interventions">
              <Checkbox v-for="i in ['契约发布前确认', '生产数据迁移前确认', '高风险外发前确认', '预算追加前确认']" :key="i" :value="i">{{ i }}</Checkbox>
            </CheckboxGroup>
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">到达介入点将暂停 Tick 并发起询问，等待人工确认；不确认不会自动放行。</div>
          </div>

          <!-- 第 7 步：汇报策略 -->
          <div v-else-if="current === 6" class="oc-card">
            <div class="oc-card__title">汇报策略</div>
            <Input v-model="form.reportInterval" size="small" />
            <CheckboxGroup v-model="form.reportChannels" style="margin-top: 6px">
              <Checkbox v-for="ch in ['界面内', '桌面通知', 'IM 机器人', '邮件', 'Webhook']" :key="ch" :value="ch">{{ ch }}</Checkbox>
            </CheckboxGroup>
            <div class="oc-flex" style="gap: 8px; margin-top: 6px">
              <Checkbox v-model="form.nodeReport">节点汇报（阶段完成/阻塞/风险，即时）</Checkbox>
              <Checkbox v-model="form.endReport">结束汇报（完整报告）</Checkbox>
            </div>
          </div>

          <!-- 第 8 步：终止条件 -->
          <div v-else class="oc-card">
            <div class="oc-card__title">终止条件（多重，任一命中即停止）</div>
            <CheckboxGroup v-model="form.terminations">
              <Checkbox v-for="t in ['达成', '预算', '时间', '失败', '撤销', '风险']" :key="t" :value="t">{{ t }}</Checkbox>
            </CheckboxGroup>
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">至少保留一项（通常是「达成 + 预算 + 风险」）。</div>
          </div>

          <div v-if="fieldError" class="oc-card" style="border-color: var(--oc-sev-error)">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" theme="danger" variant="light-outline">字段校验失败</Tag>
              <span style="font-size: 12px">{{ fieldError }}</span>
            </div>
          </div>
        </div>

        <!-- 右侧：契约预览 -->
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">契约预览</div>
            <InfoGrid :columns="1" :items="[
              { key: 'obj', label: '目标', value: form.objective || '（未填写）' },
              { key: 'crit', label: '验收标准', value: `${form.criteria.length} 条` },
              { key: 'cons', label: '约束', value: `${form.constraints.length} 项` },
              { key: 'budget', label: '预算', value: `$${form.budgetCost} / ${(form.budgetTokens / 1_000_000).toFixed(1)}M tokens` },
              { key: 'auto', label: '自治级别', value: AUTONOMY_META[form.autonomy].label },
              { key: 'inter', label: '介入点', value: `${form.interventions.length} 处` },
              { key: 'rep', label: '汇报', value: form.reportInterval },
              { key: 'term', label: '终止条件', value: form.terminations.join('、') || '（未选择）' },
            ]" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">原子提交语义</div>
            <div class="oc-secondary" style="font-size: 12px">
              八步内容作为一个事务写入：任一必填项缺失则全部不写入，不会出现「有目标无验收标准」的半成品。
              跳过步骤采用安全默认值，并在目标的审计记录中标注「由默认值生成」。
            </div>
            <div class="oc-flex" style="gap: 8px; margin-top: 6px">
              <CliHint command="oc goal create --objective '<目标>' --criteria criteria.yaml --atomic" />
              <CopyableId id="trace-2ab77f90" label="复制 traceId" />
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
