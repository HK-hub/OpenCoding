<script setup lang="ts">
/**
 * 资产编辑器（M-17 / 卷 04 D-PRM-2 + D-PRM-6）：
 * Markdown + YAML 头编辑 + 变量契约（类型化、缺失 Fail-Fast）+ 条件块（声明式谓词）+ 片段引用；
 * 无表达式执行（结构化组装器），保存草稿后需过评测门禁才能发布。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Popconfirm, Select, Switch, Table, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import CliHint from '@/components/common/CliHint.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { type PageState } from '@/components/gateway/types';
import { OVERRIDE_LAYER_META, PROMPT_ASSET_TYPE_META, modelData } from '@/mock/data/model';
import type { OverrideLayerId, PromptAssetConditionData, PromptAssetData, PromptAssetVariableData } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const data = modelData;
const id = String(route.params.id ?? '');
/** Vue 模板中的插值会与双大括号字面量冲突，片段示例统一在此定义 */
const FRAGMENT_SNIPPET = '{{> fragment-id }}';
const CONDITION_SNIPPET = '{{#if expr}} … {{/if}}';

const asset = data.promptAssets.find((a) => a.id === id);
const state = ref<PageState>('LOADING');
const dirty = ref(false);
const activeTab = ref<'body' | 'vars' | 'cond' | 'diff'>('body');

const found = computed(() => Boolean(asset));

/** 空白模板：id 不存在时编辑器仍可渲染（页面进入 EMPTY 态，不写任何内容） */
const blank: PromptAssetData = {
  id, name: '未命名资产', type: 'fragment', scope: 'L2', language: 'zh-CN', version: '0.1.0', tags: [], refCount: 0,
  nonOverridable: false, enabled: true, owner: '当前用户', updatedAt: new Date().toISOString(), description: '',
  body: '---\nid: \ntype: fragment\nscope: L2\n---\n', variables: [], conditions: [], fragments: [],
  evalSummary: { passRatePct: 0, prevPassRatePct: 0, cases: 0 },
};

const form = ref<PromptAssetData>(asset ? (JSON.parse(JSON.stringify(asset)) as PromptAssetData) : blank);
const version = computed(() => form.value.version);
const bodyLines = computed(() => form.value.body.split('\n'));
const published = computed(() => data.assetVersions.find((v) => v.assetId === id));

const scopeOptions = (Object.keys(OVERRIDE_LAYER_META) as OverrideLayerId[]).map((k) => ({ label: `${k} ${OVERRIDE_LAYER_META[k].name}（${OVERRIDE_LAYER_META[k].overridable}）`, value: k }));

const varColumns: PrimaryTableCol[] = [
  { colKey: 'name', title: '变量名', width: 150 },
  { colKey: 'type', title: '类型', width: 110 },
  { colKey: 'required', title: '必填', width: 90 },
  { colKey: 'defaultValue', title: '默认值', width: 200 },
  { colKey: 'source', title: '来源白名单', width: 150 },
  { colKey: 'constraints', title: '约束' },
];

const condColumns: PrimaryTableCol[] = [
  { colKey: 'expr', title: '条件表达式（声明式谓词）', width: 260 },
  { colKey: 'desc', title: '含义', width: 320 },
  { colKey: 'value', title: '当前求值', width: 150 },
];

/** 与已发布版本的正文 diff（保存后需过评测门禁才能发布） */
const diffFiles = computed<DiffFile[]>(() => {
  const publishedBody = (data.promptAssets.find((a) => a.id === id)?.body ?? '').split('\n');
  const editedBody = form.value.body.split('\n');
  const lines = editedBody.map((text, i) => {
    const old = publishedBody[i];
    if (old === undefined) return { type: 'add' as const, newLine: i + 1, text };
    if (old !== text) return { type: 'add' as const, oldLine: i + 1, newLine: i + 1, text };
    return { type: 'ctx' as const, oldLine: i + 1, newLine: i + 1, text };
  });
  const additions = lines.filter((l) => l.type === 'add').length;
  const deletions = Math.max(0, publishedBody.length - editedBody.length);
  return [{ path: `assets/${id}/body.md`, additions, deletions, lines, externalChanged: false }];
});

const impact = computed(() => [
  { key: 'refs', label: '被引用位置', value: form.value.fragments.length ? form.value.fragments.join('、') : `${form.value.refCount} 处（模板 / 模式）` },
  { key: 'scope', label: '生效层级', value: `${form.value.scope} ${OVERRIDE_LAYER_META[form.value.scope].name}` },
  { key: 'nonOver', label: '覆盖限制', value: form.value.nonOverridable ? '不可被下级覆盖（强制项）' : '下级可覆盖' },
  { key: 'force', label: '缺失变量行为', value: 'Fail-Fast：缺失必填变量时组装失败（不使用空串兜底）' },
  { key: 'esc', label: '变量转义', value: '变量值一律转义；来源限定内核上下文 / 环境 / 配置（禁止取自工具输出原文）' },
]);

function mark() {
  dirty.value = true;
}

function saveDraft() {
  dirty.value = false;
  MessagePlugin.success('草稿已保存（未发布）：发布前需先跑评测门禁（核心用例集）');
}

function runEval() {
  MessagePlugin.info(`已提交评测：${published.value?.evalReport.cases.length ?? 12} 条用例；通过率不得低于上一版本 ${published.value?.evalReport.prevPassRatePct ?? '—'}%`);
}

function publish() {
  MessagePlugin.success(`已发布 ${id} v${version.value}：生成制品哈希并进入灰度分桶（可回滚）`);
}

function addVar() {
  form.value.variables.push({ name: 'new_var', type: 'string', required: false, defaultValue: '', source: 'kernel_context', constraints: '待补充' });
  mark();
}

function toggleCond(c: PromptAssetConditionData) {
  c.value = !c.value;
  mark();
}

onMounted(() => {
  window.setTimeout(() => (state.value = found.value ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`资产编辑器 · ${form.name}`"
      desc="Markdown + YAML 头（人可读、可 diff）+ 变量契约 + 条件块 + 片段引用。组装器无表达式执行，变量值一律转义；缺失必填变量 Fail-Fast。"
      volume="卷 04"
      manifest="M-17"
      :cli="`oc prompt asset edit ${id} --set-version ${version}`"
      :status="[found ? { label: `${PROMPT_ASSET_TYPE_META[form.type].label} · ${form.scope}`, theme: 'default' } : { label: '未知资产', theme: 'danger' }, { label: dirty ? '有未保存修改' : '已同步', theme: dirty ? 'warning' : 'success' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="router.push('/prompt/assets')">返回资产库</Button>
        <Button size="small" variant="outline" @click="runEval">提交评测</Button>
        <Button size="small" variant="outline" :disabled="!dirty" @click="saveDraft">保存草稿</Button>
        <Popconfirm content="发布后生成新版本与制品哈希，并进入灰度分桶；通过率低于上一版本时禁止发布（可申请豁免并记录理由）。" @confirm="publish">
          <Button size="small" theme="primary">发布版本</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="未找到该资产"
      empty-desc="id 不在运行时资产库中；可能尚未发布（草稿只在文件真源中）。"
      empty-action="返回资产库"
      what="资产编辑加载失败"
      why="文件真源与运行时资产库均不可读；为避免覆盖，编辑器不展示任何可提交内容。"
      how="可重试；若确认存在，请检查资产来源（文件 / 数据库 / 远程库）配置。"
      trace-id="trace-asset-edit-77a3"
      missing-permission="prompt.manage"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 prompt.manage（提示词影响全租户 Agent 行为）"
      @retry="state = 'LOADING'"
      @empty-action="router.push('/prompt/assets')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">元数据</div>
          <div class="oc-stack">
            <label>名称 <Input v-model="form.name" size="small" @change="mark" /></label>
            <div class="oc-grid oc-grid--2">
              <label>版本（semver）<Input v-model="form.version" size="small" @change="mark" /></label>
              <label>语言
                <Select v-model="form.language" :options="[{ label: 'zh-CN', value: 'zh-CN' }, { label: 'en-US', value: 'en-US' }, { label: '默认', value: '默认' }]" size="small" style="width: 100%" @change="mark" />
              </label>
            </div>
            <label>作用域
              <Select v-model="form.scope" :options="scopeOptions" size="small" style="width: 100%" @change="mark" />
            </label>
            <div class="oc-flex" style="gap: 8px">
              <span>不可覆盖（enforced）</span>
              <Tooltip :content="form.scope === 'L0' ? 'L0 护栏恒为强制项，不可关闭' : '开启后下级覆盖会被拒绝并生成 prompt.override.denied 事件'">
                <Switch v-model="form.nonOverridable" size="small" :disabled="form.scope === 'L0'" @change="mark" />
              </Tooltip>
              <Tag v-if="form.nonOverridable" theme="danger" size="small" variant="light-outline">强制项</Tag>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">影响面与一致性约束</div>
          <InfoGrid :items="impact" :columns="1" />
          <div class="oc-flex" style="margin-top: 8px">
            <CliHint :command="`oc prompt assemble --asset ${id} --preview --hash`" label="预览组装结果" />
          </div>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>内容</span>
          <span class="oc-flex" style="gap: 4px">
            <Button size="small" :variant="activeTab === 'body' ? 'base' : 'outline'" @click="activeTab = 'body'">正文（Markdown + YAML 头）</Button>
            <Button size="small" :variant="activeTab === 'vars' ? 'base' : 'outline'" @click="activeTab = 'vars'">变量契约（{{ form.variables.length }}）</Button>
            <Button size="small" :variant="activeTab === 'cond' ? 'base' : 'outline'" @click="activeTab = 'cond'">条件块（{{ form.conditions.length }}）</Button>
            <Button size="small" :variant="activeTab === 'diff' ? 'base' : 'outline'" @click="activeTab = 'diff'">与已发布版本 diff</Button>
          </span>
        </div>

        <template v-if="activeTab === 'body'">
          <Textarea v-model="form.body" :autosize="{ minRows: 12, maxRows: 26 }" style="font-family: var(--oc-mono); font-size: 12px" @change="mark" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            共 {{ bodyLines.length }} 行；YAML 头声明 type/scope/lang/version/fragments；片段用 <span class="oc-mono">{{ FRAGMENT_SNIPPET }}</span> 引用，条件块用 <span class="oc-mono">{{ CONDITION_SNIPPET }}</span>（声明式谓词，无表达式执行）。
          </div>
        </template>

        <template v-else-if="activeTab === 'vars'">
          <Table :data="form.variables" :columns="varColumns" row-key="name" size="small" :pagination="{ pageSize: 10, total: form.variables.length }">
            <template #required="{ row }">
              <Tag :theme="row.required ? 'danger' : 'default'" size="small" variant="light-outline">{{ row.required ? '必填' : '可选' }}</Tag>
            </template>
            <template #source="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.source }}</span></template>
          </Table>
          <div class="oc-flex" style="margin-top: 8px; gap: 8px">
            <Button size="small" variant="outline" @click="addVar">新增变量</Button>
            <span class="oc-muted" style="font-size: 12px">变量来源白名单：kernel_context / env / config；不允许来自工具输出原文（防注入）</span>
          </div>
        </template>

        <template v-else-if="activeTab === 'cond'">
          <Table :data="form.conditions" :columns="condColumns" row-key="expr" size="small" :pagination="{ pageSize: 10, total: form.conditions.length }">
            <template #expr="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.expr }}</span></template>
            <template #value="{ row }">
              <span class="oc-flex" style="gap: 6px">
                <Tag :theme="row.value ? 'success' : 'default'" size="small" variant="light-outline">{{ row.value ? 'true（命中）' : 'false（跳过）' }}</Tag>
                <Button size="small" variant="text" @click="toggleCond(row as PromptAssetConditionData)">取反（预览）</Button>
              </span>
            </template>
          </Table>
        </template>

        <template v-else>
          <DiffView v-if="diffFiles[0].additions + diffFiles[0].deletions > 0" :files="diffFiles" :collapse-over="420" />
          <div v-else class="oc-muted" style="font-size: 13px">正文与已发布版本一致（无未发布改动）。</div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            发布前门禁：核心用例集通过率 ≥ 上一版本（{{ published?.evalReport.prevPassRatePct ?? '—' }}%）；不通过需显式豁免并记录理由与恢复计划。
          </div>
        </template>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">片段引用（展开顺序即渲染顺序）</div>
        <div v-if="form.fragments.length" class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag v-for="f in form.fragments" :key="f" size="small" variant="light-outline">
            {{ f }} · v{{ data.promptAssets.find((a) => a.id === f)?.version ?? 'external' }}
          </Tag>
        </div>
        <div v-else class="oc-muted" style="font-size: 13px">该资产未引用其它片段。</div>
      </div>
    </StateShell>
  </div>
</template>
