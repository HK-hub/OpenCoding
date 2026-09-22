<script setup lang="ts">
/**
 * 提示词资产库（M-16 / 卷 04 D-PRM-1）：
 * 五类资产（片段/模板/策略/角色/模式）+ 搜索过滤 + 引用数 + 启用状态；
 * 不可覆盖资产显式标注（L0 安全护栏 / L1 组织强制项），预览抽屉展示正文与变量契约。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Drawer, Input, MessagePlugin, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import type { InfoItem } from '@/components/common/InfoGrid.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { type PageState } from '@/components/gateway/types';
import { OVERRIDE_LAYER_META, PROMPT_ASSET_TYPE_META, modelData } from '@/mock/data/model';
import type { OverrideLayerId, PromptAssetData, PromptAssetType } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const data = modelData;
const state = ref<PageState>('LOADING');
const typeFilter = ref<'ALL' | PromptAssetType>('ALL');
const scopeFilter = ref<'ALL' | OverrideLayerId>('ALL');
const langFilter = ref<'ALL' | 'zh-CN' | 'en-US' | '默认'>('ALL');
const keyword = ref('');
const pageSize = ref(8);
const preview = ref<PromptAssetData | null>(null);
const drawerOpen = ref(false);

/** 页内新建草稿：写入本地列表（不污染共享 mock）；发布前必须通过评测门禁 */
const drafts = ref<PromptAssetData[]>([]);
const allAssets = computed(() => [...data.promptAssets, ...drafts.value]);
const createOpen = ref(false);
const draftName = ref('');
const draftType = ref<PromptAssetType>('fragment');
const draftScope = ref<OverrideLayerId>('L2');
const draftLang = ref<'zh-CN' | 'en-US' | '默认'>('zh-CN');

/** 资产 id 前缀：按类型缩写，与既有 id 风格一致 */
const TYPE_PREFIX: Record<PromptAssetType, string> = { fragment: 'frag', template: 'tpl', policy: 'policy', role: 'role', mode: 'mode' };

/** 生成 Markdown + YAML 头正文（id/type/scope/language 与当前表单一致） */
function draftBody(id: string): string {
  return [
    '---',
    `id: ${id}`,
    `type: ${draftType.value}`,
    `scope: ${draftScope.value}`,
    `language: ${draftLang.value}`,
    'version: 0.1.0',
    '---',
    '',
    `# ${draftName.value.trim() || '未命名资产'}`,
    '',
    '草稿由资产库创建：编辑正文与变量契约、补齐验收用例后，提交评测门禁通过方可发布。',
  ].join('\n');
}
const draftPreview = computed(() => draftBody(`${TYPE_PREFIX[draftType.value]}-draft-${drafts.value.length + 1}`));

/** 新建资产：打开创建抽屉 */
function openCreate() {
  draftName.value = '';
  createOpen.value = true;
}

/** 保存草稿：生成 Markdown + YAML 头资产并写入本地列表（停用态，评测门禁通过前不可发布） */
function saveDraft() {
  const name = draftName.value.trim();
  if (!name) {
    MessagePlugin.warning('资产名称不能为空（字段级校验：必填）');
    return;
  }
  const id = `${TYPE_PREFIX[draftType.value]}-draft-${drafts.value.length + 1}`;
  const asset: PromptAssetData = {
    id, name, type: draftType.value, scope: draftScope.value, language: draftLang.value, version: '0.1.0',
    tags: ['草稿', PROMPT_ASSET_TYPE_META[draftType.value].label], refCount: 0,
    nonOverridable: draftScope.value === 'L0' || draftScope.value === 'L1',
    enabled: false, owner: '当前用户', updatedAt: new Date().toISOString(),
    description: `页内新建草稿（${PROMPT_ASSET_TYPE_META[draftType.value].label}），待过评测门禁`,
    body: draftBody(id), variables: [], conditions: [], fragments: [],
    evalSummary: { passRatePct: 0, prevPassRatePct: 0, cases: 0 },
  };
  drafts.value = [asset, ...drafts.value];
  createOpen.value = false;
  MessagePlugin.success(`已新建资产 ${id}（草稿，停用）：通过评测门禁后方可发布`);
}

const typeOptions = [{ label: '全部类型', value: 'ALL' }, ...(Object.keys(PROMPT_ASSET_TYPE_META) as PromptAssetType[]).map((k) => ({ label: PROMPT_ASSET_TYPE_META[k].label, value: k }))];
const scopeOptions = [{ label: '全部层级', value: 'ALL' }, ...(Object.keys(OVERRIDE_LAYER_META) as OverrideLayerId[]).map((k) => ({ label: `${k} ${OVERRIDE_LAYER_META[k].name}`, value: k }))];
const langOptions = [{ label: '全部语言', value: 'ALL' }, { label: 'zh-CN', value: 'zh-CN' }, { label: 'en-US', value: 'en-US' }, { label: '默认', value: '默认' }];

const filtered = computed(() =>
  allAssets.value.filter((a) => {
    if (typeFilter.value !== 'ALL' && a.type !== typeFilter.value) return false;
    if (scopeFilter.value !== 'ALL' && a.scope !== scopeFilter.value) return false;
    if (langFilter.value !== 'ALL' && a.language !== langFilter.value) return false;
    if (keyword.value && !`${a.id}${a.name}${a.tags.join('')}${a.description}`.toLowerCase().includes(keyword.value.toLowerCase())) return false;
    return true;
  }),
);
const rows = computed(() => (state.value === 'EDGE_DATA' ? filtered.value.slice(0, pageSize.value) : filtered.value));

const byType = computed(() => (Object.keys(PROMPT_ASSET_TYPE_META) as PromptAssetType[]).map((k) => ({ key: k, count: allAssets.value.filter((a) => a.type === k).length })));
const totalRefs = computed(() => allAssets.value.reduce((a, b) => a + b.refCount, 0));
const nonOverridable = computed(() => allAssets.value.filter((a) => a.nonOverridable));
const avgPass = computed(() => data.promptAssets.reduce((a, b) => a + b.evalSummary.passRatePct, 0) / data.promptAssets.length);

const columns: PrimaryTableCol[] = [
  { colKey: 'name', title: '资产（id / 名称）', width: 280 },
  { colKey: 'type', title: '类型', width: 110 },
  { colKey: 'scope', title: '作用域', width: 150 },
  { colKey: 'lang', title: '语言 / 版本', width: 150 },
  { colKey: 'tags', title: '标签', width: 220 },
  { colKey: 'refCount', title: '引用数', width: 100 },
  { colKey: 'eval', title: '评测（vs 上一版）', width: 170 },
  { colKey: 'enabled', title: '启用', width: 90 },
  { colKey: 'actions', title: '操作', width: 150 },
];

const previewItems = computed<InfoItem[]>(() => {
  const a = preview.value;
  if (!a) return [];
  return [
    { key: 'id', label: '资产 id', value: a.id, mono: true, copyable: true },
    { key: 'type', label: '类型 / 作用域', value: `${PROMPT_ASSET_TYPE_META[a.type].label} · ${a.scope} ${OVERRIDE_LAYER_META[a.scope].name}` },
    { key: 'lang', label: '语言 / 版本', value: `${a.language} · v${a.version}` },
    { key: 'owner', label: '维护者 / 更新时间', value: `${a.owner} · ${new Date(a.updatedAt).toLocaleDateString('zh-CN')}` },
    { key: 'refs', label: '被引用次数', value: String(a.refCount) },
    { key: 'nonOver', label: '不可覆盖', value: a.nonOverridable ? '是（L0/L1 强制项）' : '否', tag: { text: a.nonOverridable ? '不可覆盖' : '可覆盖', theme: a.nonOverridable ? 'danger' : 'default' } },
    { key: 'desc', label: '职责说明', value: a.description, span: 2 },
    { key: 'eval', label: '评测通过率', value: `${a.evalSummary.passRatePct}%（上一版 ${a.evalSummary.prevPassRatePct}%，用例 ${a.evalSummary.cases} 条）`, span: 2 },
  ];
});

function loadMore() {
  pageSize.value += 8;
  if (pageSize.value >= filtered.value.length) state.value = 'NORMAL';
}

/** 打开资产预览抽屉（正文 + 变量契约，不做编辑） */
function openPreview(a: PromptAssetData) {
  preview.value = a;
  drawerOpen.value = true;
}

function toggle(a: PromptAssetData, v: boolean) {
  a.enabled = v;
  MessagePlugin[v ? 'success' : 'warning'](
    v ? `已启用「${a.name}」` : `已停用「${a.name}」：引用它的模板会改用回退片段，并生成 prompt.drift 提示（不静默）`,
  );
}

onMounted(() => {
  window.setTimeout(() => (state.value = data.promptAssets.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="提示词资产库"
      desc="五类资产：片段（可跨模板复用）/ 模板（结构化组装）/ 策略（谓词 + 动作）/ 角色（人格与能力边界）/ 模式（任务类型装配）。资产可版本化、可灰度、可回滚。"
      volume="卷 04"
      manifest="M-16"
      cli="oc prompt asset list --type fragment --scope L2 | oc prompt asset show frag-verify-before-done"
      :status="[{ label: `${allAssets.length} 个资产`, theme: 'default' }, { label: `${nonOverridable.length} 个不可覆盖`, theme: nonOverridable.length ? 'warning' : 'success' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="router.push('/prompt/override')">覆盖关系</Button>
        <Button size="small" theme="primary" @click="openCreate">新建资产</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="资产总数" :value="allAssets.length" icon="file" />
      <StatCard label="类型分布" :value="byType.map((t) => `${PROMPT_ASSET_TYPE_META[t.key].label} ${t.count}`).join(' / ')" format="raw" icon="layers" hint="片段可跨模板复用（示例：安全边界被 12 处引用）" />
      <StatCard label="引用总数" :value="totalRefs" icon="link" :hint="'引用数为 0 的模式资产是装配入口（由会话模式解析选中）'" />
      <StatCard label="评测平均通过率" :value="avgPass" format="percent" icon="task-checked" :target="90" target-kind="min" hint="发布门禁：通过率不得低于上一版本" />
    </div>

    <StateShell
      :state="state"
      empty-title="资产库为空"
      empty-desc="没有资产时无法组装提示词；请从内置模板导入或新建片段。"
      empty-action="新建资产"
      example-task="从内置库导入「完成前验证」片段，并在编码模式模板中引用"
      what="资产库加载失败"
      why="运行时资产库（PostgreSQL / 本地文件库）不可达；当前会话继续使用上次成功装载的版本集。"
      how="可重试；资产不可读不会导致空提示词（沿用已装载版本集，且会话记录版本集哈希）。"
      trace-id="trace-assets-4c19"
      missing-permission="prompt.manage"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 prompt.manage（提示词影响 Agent 行为，属 R3）"
      :collapsed-summary="`共 ${filtered.length} 个资产，超出单屏渲染阈值，已折叠展示。`"
      :page-size="pageSize"
      @retry="state = 'LOADING'"
      @load-more="loadMore"
      @empty-action="openCreate"
    >
      <div class="oc-flex oc-flex--wrap" style="margin-bottom: 8px">
        <Input v-model="keyword" placeholder="搜索 id / 名称 / 标签" clearable size="small" style="width: 240px" />
        <Select v-model="typeFilter" :options="typeOptions" size="small" style="width: 140px" />
        <Select v-model="scopeFilter" :options="scopeOptions" size="small" style="width: 180px" />
        <Select v-model="langFilter" :options="langOptions" size="small" style="width: 130px" />
        <span class="oc-muted" style="font-size: 12px">{{ filtered.length }} 条命中</span>
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="{ pageSize: 10, total: rows.length }">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-flex" style="gap: 6px">
              <b>{{ row.name }}</b>
              <Tooltip v-if="row.nonOverridable" content="L0/L1 强制项：下级覆盖会被拒绝并生成 prompt.override.denied 事件">
                <Tag theme="danger" size="small" variant="light-outline">不可覆盖</Tag>
              </Tooltip>
            </span>
            <span class="oc-mono oc-muted" style="font-size: 12px">{{ row.id }}</span>
          </div>
        </template>
        <template #type="{ row }">
          <Tooltip :content="PROMPT_ASSET_TYPE_META[row.type as PromptAssetType].note">
            <Tag :theme="PROMPT_ASSET_TYPE_META[row.type as PromptAssetType].theme" size="small" variant="light-outline">
              {{ PROMPT_ASSET_TYPE_META[row.type as PromptAssetType].label }}
            </Tag>
          </Tooltip>
        </template>
        <template #scope="{ row }">
          <span style="font-size: 12px">{{ row.scope }} · {{ OVERRIDE_LAYER_META[row.scope as OverrideLayerId].name }}</span>
        </template>
        <template #lang="{ row }">
          <span style="font-size: 12px">{{ row.language }} · v{{ row.version }}</span>
        </template>
        <template #tags="{ row }">
          <span class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag v-for="t in row.tags" :key="t" size="small" variant="outline">{{ t }}</Tag>
          </span>
        </template>
        <template #refCount="{ row }"><b>{{ row.refCount }}</b></template>
        <template #eval="{ row }">
          <span class="oc-flex" style="gap: 4px">
            <Tag :theme="row.evalSummary.passRatePct >= row.evalSummary.prevPassRatePct ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.evalSummary.passRatePct }}%</Tag>
            <span class="oc-muted" style="font-size: 12px">上一版 {{ row.evalSummary.prevPassRatePct }}% · {{ row.evalSummary.cases }} 用例</span>
          </span>
        </template>
        <template #enabled="{ row }">
          <Switch :value="row.enabled" size="small" @change="(v) => toggle(row as PromptAssetData, Boolean(v))" />
        </template>
        <template #actions="{ row }">
          <Button size="small" variant="text" @click="openPreview(row as unknown as PromptAssetData)">预览</Button>
          <Button size="small" variant="text" @click="router.push(`/prompt/assets/${row.id}`)">编辑</Button>
        </template>
      </Table>

      <Drawer v-model:visible="drawerOpen" :header="`资产预览 · ${preview?.name ?? ''}`" size="640px" :footer="false">
        <InfoGrid :items="previewItems" :columns="2" />
        <div class="oc-divider" />
        <div class="oc-card__title">变量契约</div>
        <Table
          v-if="preview?.variables.length"
          :data="preview.variables"
          row-key="name"
          size="small"
          :pagination="{ pageSize: 10, total: preview?.variables.length ?? 0 }"
          :columns="[
            { colKey: 'name', title: '变量', width: 140 },
            { colKey: 'type', title: '类型', width: 90 },
            { colKey: 'required', title: '必填', width: 80 },
            { colKey: 'defaultValue', title: '默认值', width: 160 },
            { colKey: 'constraints', title: '约束' },
          ]"
        >
          <template #required="{ row }">
            <Tag :theme="row.required ? 'danger' : 'default'" size="small" variant="light-outline">{{ row.required ? '必填' : '可选' }}</Tag>
          </template>
        </Table>
        <div v-else class="oc-muted" style="font-size: 13px">该资产无变量契约（纯文本片段）。</div>
        <div class="oc-divider" />
        <div class="oc-card__title">正文（Markdown + YAML 头）</div>
        <pre class="oc-pre" style="max-height: 300px">{{ preview?.body }}</pre>
      </Drawer>
    </StateShell>

    <!-- 新建资产抽屉（页级挂载，空态可达）：Markdown + YAML 头草稿，保存后需过评测门禁才能发布 -->
    <Drawer v-model:visible="createOpen" header="新建资产（Markdown + YAML 头）" size="520px" :footer="false">
      <div class="oc-stack">
        <div>
          <div class="oc-muted" style="font-size: 12px">资产名称（必填）</div>
          <Input v-model="draftName" size="small" placeholder="例：完成前验证片段" />
        </div>
        <div class="oc-grid oc-grid--2">
          <div>
            <div class="oc-muted" style="font-size: 12px">类型</div>
            <Select v-model="draftType" size="small" :options="(Object.keys(PROMPT_ASSET_TYPE_META) as PromptAssetType[]).map((k) => ({ label: PROMPT_ASSET_TYPE_META[k].label, value: k }))" />
          </div>
          <div>
            <div class="oc-muted" style="font-size: 12px">作用域</div>
            <Select v-model="draftScope" size="small" :options="(Object.keys(OVERRIDE_LAYER_META) as OverrideLayerId[]).map((k) => ({ label: `${k} ${OVERRIDE_LAYER_META[k].name}`, value: k }))" />
          </div>
        </div>
        <div>
          <div class="oc-muted" style="font-size: 12px">语言</div>
          <Select v-model="draftLang" size="small" :options="[{ label: 'zh-CN', value: 'zh-CN' }, { label: 'en-US', value: 'en-US' }, { label: '默认', value: '默认' }]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">将生成的正文（Markdown + YAML 头）</div>
          <pre class="oc-pre" style="max-height: 200px; font-size: 12px">{{ draftPreview }}</pre>
        </div>
        <div class="oc-secondary" style="font-size: 12px">保存后为「停用」草稿：需先通过评测门禁（通过率不低于上一版本）才能发布。</div>
        <div class="oc-flex" style="gap: 8px">
          <Button size="small" theme="primary" @click="saveDraft">保存草稿</Button>
          <Button size="small" variant="outline" @click="createOpen = false">取消</Button>
        </div>
      </div>
    </Drawer>
  </div>
</template>
