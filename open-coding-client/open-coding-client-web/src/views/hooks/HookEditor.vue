<script setup lang="ts">
/**
 * 钩子编辑器（H-03）：表单 / YAML 双模；match + rewritableFields 白名单 + failurePolicy + timeout + env + 签名。
 * 溯源：卷 17 §4.2 定义字段 / §4.4 多层合并与冲突检测 / §4.5 环境清洗（仅注入声明的变量）。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, Checkbox, CheckboxGroup, Input, InputNumber, MessagePlugin, RadioButton, RadioGroup, Select, Switch, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { HOOK_CAP_LABEL, HOOK_DOMAIN_LABEL, SCOPE_LABEL } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const hooks = extensionData.hooks;
const points = extensionData.hookPoints;
const editing = computed(() => hooks.find((h) => h.id === String(route.query.id)));

const mode = ref<'form' | 'yaml'>('form');
const form = ref({
  name: editing.value?.name ?? '',
  point: editing.value?.point ?? 'tool.call.before',
  scope: editing.value?.scope ?? 'project',
  toolName: editing.value?.match.toolName ?? 'write_file,edit_file',
  pathPattern: editing.value?.match.pathPattern ?? '',
  commandPattern: editing.value?.match.commandPattern ?? '',
  eventType: editing.value?.match.eventType ?? '',
  model: editing.value?.match.model ?? '',
  capability: editing.value?.capability ?? ('rewrite' as 'observe' | 'block' | 'rewrite'),
  fields: [...(editing.value?.rewritableFields ?? ['args.path'])],
  impl: editing.value?.impl ?? ('rule' as 'rule' | 'script' | 'plugin' | 'http'),
  failurePolicy: editing.value?.failurePolicy ?? ('fail-open' as 'fail-open' | 'fail-closed'),
  timeoutMs: editing.value?.timeoutMs ?? 2000,
  async: editing.value?.async ?? false,
  env: [...(editing.value?.env ?? [])],
  envDraft: '',
});

const pointOptions = points.map((p) => ({ label: `${p.point}（${HOOK_DOMAIN_LABEL[p.domain]}）`, value: p.point }));
const fieldOptions = ['args.path', 'args.command', 'args.content', 'result.content', 'result.summary', 'sections.S2.content', 'decision.scope'];

/** 静态冲突检测：同点同 match 的多个 rewrite 钩子给出潜在冲突提示 */
const conflicts = computed(() =>
  hooks.filter((h) => h.point === form.value.point && h.capability === 'rewrite' && h.id !== editing.value?.id && h.match.toolName === form.value.toolName),
);

const rewriteOk = computed(() => form.value.capability !== 'rewrite' || form.value.fields.length > 0);

const yaml = computed(() => [
  `id: ${editing.value?.id ?? 'HK-NEW'}`,
  `name: ${form.value.name || '<未命名>'}`,
  `point: ${form.value.point}`,
  `scope: ${form.value.scope}`,
  'match:',
  `  toolName: "${form.value.toolName}"`,
  `  pathPattern: "${form.value.pathPattern}"`,
  `  commandPattern: "${form.value.commandPattern}"`,
  `  eventType: "${form.value.eventType}"`,
  `  model: "${form.value.model}"`,
  `capability: ${form.value.capability}`,
  form.value.capability === 'rewrite' ? `rewritableFields: [${form.value.fields.join(', ')}]` : 'rewritableFields: []',
  `impl: ${form.value.impl}`,
  `failurePolicy: ${form.value.failurePolicy}`,
  `timeoutMs: ${form.value.timeoutMs}`,
  `async: ${form.value.async}`,
  `env: [${form.value.env.join(', ')}]`,
  'signature: <保存时由 oc hooks sign 生成>',
].join('\n'));

function addEnv() {
  const v = form.value.envDraft.trim();
  if (v && !form.value.env.includes(v)) form.value.env.push(v);
  form.value.envDraft = '';
}

function save() {
  if (!rewriteOk.value) {
    MessagePlugin.error('改写能力必须声明可改写字段白名单（否则拒绝保存）');
    return;
  }
  if (conflicts.value.length) {
    MessagePlugin.warning(`已保存，但检测到同点同 match 的改写钩子 ${conflicts.value.length} 个：按 组织→项目→用户→会话 顺序应用，后者看到前者结果`);
  } else {
    MessagePlugin.success(`已保存 ${form.value.name || '未命名钩子'}：配置可 diff、可评审，执行结果全量审计`);
  }
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/hooks/editor', () => points.length > 0);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="editing ? `编辑钩子 · ${editing.name}` : '新建钩子'"
      desc="改写类钩子必须在权限决策之前执行（改写后重新鉴权）；权限决策之后仅允许观察类。"
      volume="卷 17" manifest="H-03" cli="oc hooks upsert --file .oc/hooks/<id>.yaml"
      :status="[{ label: mode === 'form' ? '表单模式' : 'YAML 模式', theme: 'primary' }, { label: '沙箱执行 + 环境清洗', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/hooks')">返回列表</Button>
        <Button size="small" variant="outline" @click="router.push({ path: '/extension/hooks/test', query: { id: editing?.id ?? '' } })">试跑</Button>
        <Button size="small" theme="primary" :disabled="!rewriteOk" @click="save">保存钩子</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="pageState"
      :trace-id="pageTraceId"
      empty-title="对象不存在或已被清理"
      empty-desc="按链接标识未命中：可能已被卸载、清理或标识有误；请从列表重新进入。"
      what="页面数据加载失败"
      why="该页依赖的索引 / 配置读取失败（不影响其它模块与已加载数据）。"
      how="可重试；持续失败请导出诊断包并附 traceId 便于定位。"
      @retry="reloadPage"
    >


    <Alert
      v-if="!rewriteOk"
      theme="error"
      message="缺少可改写字段白名单"
      description="rewrite 能力必须声明 rewritableFields（如 args.path / result.content）；未声明时保存被拒绝，避免无边界改写。"
    />
    <Alert
      v-else-if="conflicts.length"
      theme="warning"
      message="潜在改写冲突"
      :description="`同点同 match 已有 ${conflicts.map((c) => c.id).join('、')}；多个改写按作用域顺序应用（后者见前者结果），需 Schema 校验，失败则拒绝该改写并记录。`"
    />

    <div class="oc-card">
      <div class="oc-flex--between oc-flex--wrap" style="gap: 8px">
        <RadioGroup v-model="mode">
          <RadioButton value="form">表单模式</RadioButton>
          <RadioButton value="yaml">YAML 模式</RadioButton>
        </RadioGroup>
        <span class="oc-muted" style="font-size: 12px">
          <OcIcon name="secured" size="12px" /> 钩子不能放宽权限：改写只可收窄或脱敏，DENY 不可改 ALLOW
        </span>
      </div>
    </div>

    <div v-if="mode === 'form'" class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">基础与匹配</h3>
        <div class="oc-stack" style="gap: 8px">
          <Input v-model="form.name" label="名称" size="small" placeholder="如 路径参数收窄到工作区" />
          <Select v-model="form.point" label="钩子点" size="small" :options="pointOptions" filterable />
          <Select
            v-model="form.scope" label="作用域（求值顺序 组织→项目→用户→会话）" size="small"
            :options="Object.entries(SCOPE_LABEL).map(([value, label]) => ({ label, value }))"
          />
          <div class="oc-grid oc-grid--2" style="gap: 8px">
            <Input v-model="form.toolName" size="small" label="match.toolName" placeholder="逗号分隔" />
            <Input v-model="form.pathPattern" size="small" label="match.pathPattern" placeholder="**/*.java" />
            <Input v-model="form.commandPattern" size="small" label="match.commandPattern" placeholder="git commit*" />
            <Input v-model="form.eventType" size="small" label="match.eventType" placeholder="git.commit.before" />
          </div>
          <Input v-model="form.model" size="small" label="match.model（可选）" placeholder="claude-*" />
        </div>
      </div>

      <div class="oc-stack" style="gap: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">能力与实现</h3>
          <div class="oc-stack" style="gap: 8px">
            <div>
              <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">干预能力</div>
              <RadioGroup v-model="form.capability">
                <RadioButton value="observe">observe 观察</RadioButton>
                <RadioButton value="block">block 阻断</RadioButton>
                <RadioButton value="rewrite">rewrite 改写</RadioButton>
              </RadioGroup>
            </div>
            <div v-if="form.capability === 'rewrite'">
              <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">可改写字段白名单（必选）</div>
              <CheckboxGroup v-model="form.fields">
                <div v-for="f in fieldOptions" :key="f"><Checkbox :value="f"><span class="oc-mono" style="font-size: 12px">{{ f }}</span></Checkbox></div>
              </CheckboxGroup>
            </div>
            <Select
              v-model="form.impl" label="实现形态" size="small"
              :options="[
                { label: 'rule 声明式规则（YAML）', value: 'rule' },
                { label: 'script 沙箱脚本（Shell/Python/Node）', value: 'script' },
                { label: 'plugin 插件回调（进程内，性能好）', value: 'plugin' },
                { label: 'http 企业服务（转发）', value: 'http' },
              ]"
            />
            <Select
              v-model="form.failurePolicy" label="失败策略（安全类默认 closed）" size="small"
              :options="[
                { label: 'fail-closed 失败即阻断（安全/合规类）', value: 'fail-closed' },
                { label: 'fail-open 失败继续（体验/通知类）', value: 'fail-open' },
              ]"
            />
            <div class="oc-flex oc-flex--wrap" style="gap: 10px">
              <div>
                <div class="oc-secondary" style="font-size: 12px">超时（单钩子 ≤2000ms，总预算 5s）</div>
                <InputNumber v-model="form.timeoutMs" size="small" :min="50" :max="5000" :step="50" style="width: 130px" />
              </div>
              <div>
                <div class="oc-secondary" style="font-size: 12px">异步（观察类可异步，不阻塞）</div>
                <Switch v-model="form.async" size="small" />
              </div>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">环境变量（仅白名单注入）</h3>
          <div class="oc-flex" style="gap: 6px">
            <Input v-model="form.envDraft" size="small" placeholder="KEY=secret://org/xxx 或 KEY=value" style="flex: 1" @enter="addEnv" />
            <Button size="small" variant="outline" @click="addEnv">添加</Button>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag v-for="e in form.env" :key="e" size="small" variant="outline" class="oc-mono">{{ e }}</Tag>
            <span v-if="!form.env.length" class="oc-muted" style="font-size: 12px">未声明环境变量：执行环境将被清洗（仅保留系统最小集）</span>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 10px">
            <CliHint command="oc hooks test <id> --input case.json" />
            <span class="oc-muted" style="font-size: 12px">保存后可在「试跑」中验证判定与改写 diff</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">YAML 编辑（人可读 + 可 diff 评审）</h3>
        <Textarea :model-value="yaml" :autosize="{ minRows: 18 }" readonly />
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          双模等价：表单字段与 YAML 一一对应；保存时按 Schema 校验（能力与字段白名单一致性）。
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">当前定义（脱敏预览）</h3>
        <JsonBlock :value="{ ...form, envDraft: undefined }" label="hook definition（密钥引用已脱敏）" :collapse-over="280" />
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          组织钩子需签名（企业可强制）；市场模板安装时提示但不自动启用。
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
