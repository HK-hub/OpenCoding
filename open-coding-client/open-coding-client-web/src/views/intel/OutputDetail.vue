<script setup lang="ts">
/**
 * 草稿详情（N3-04）：正文（PR 描述六段）+ 引用列表 + 与人类内容并排冲突（不覆盖）。
 * 溯源：卷 35 §5.3 ①/§5.2；BUILD-MANIFEST N3-04。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, Dialog, MessagePlugin, Popconfirm, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import CliHint from '@/components/common/CliHint.vue';
import { findOutput } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();

const out = computed(() => findOutput(String(route.params.id ?? '')));
const adopted = ref(false);

/** 本次注入会话的引用条目（来源 / 类型 / 版本）与注入时间：注入的真实效果以页面可见清单为准 */
const injectedRefs = ref<{ ref: string; kind: string; loc: string }[]>([]);
const injectedAt = ref('');
const injectedBadge = computed(() => (injectedAt.value ? [{ label: `已注入会话 ${injectedRefs.value.length} 条引用`, theme: 'success' as const }] : []));

/** 作为上下文引用：把本草稿与其引用清单注入会话（页面就地渲染清单，不以提示代替状态） */
function injectContext() {
  const target = out.value;
  if (!target) {
    MessagePlugin.warning('草稿不存在，无法作为上下文引用');
    return;
  }
  injectedRefs.value = target.citations.map((c) => ({ ref: c.ref, kind: c.kind, loc: c.loc }));
  injectedAt.value = new Date().toLocaleString('zh-CN');
  MessagePlugin.success(`已作为上下文引用注入会话：${injectedRefs.value.length} 条引用（清单见下方，注入时间 ${injectedAt.value}）`);
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

/** 冲突并排：人类校订版本 vs AI 生成版本（人类优先，AI 不得覆盖） */
const conflictFiles = computed<DiffFile[]>(() => {
  const c = out.value?.conflictsWithHuman;
  if (!c) return [];
  return [{
    path: c.humanRef,
    additions: 1,
    deletions: 1,
    lines: [
      { type: 'ctx', oldLine: 1, newLine: 1, text: '## 注意事项（人工校订段落，受保护）' },
      { type: 'del', oldLine: 2, text: `人工：${c.humanText}` },
      { type: 'add', newLine: 2, text: `AI：${c.aiText}` },
      { type: 'ctx', oldLine: 3, newLine: 3, text: '（裁决：以人工版本为准；AI 版本仅作为建议展示）' },
    ],
  }];
});

const citColumns = [
  { colKey: 'ref', title: '引用（文件 + 行 / 文档 + 版本 / 事件 ID）', cell: 'ref' },
  { colKey: 'kind', title: '类型', width: 100, cell: 'kind' },
  { colKey: 'loc', title: '位置 / 版本', width: 140 },
];
const gateColumns = [
  { colKey: 'layer', title: '门禁层', width: 100, cell: 'layer' },
  { colKey: 'pass', title: '结论', width: 100, cell: 'pass' },
  { colKey: 'reason', title: '理由', ellipsis: true },
];

const SECTION_LABELS = ['摘要', '动机', '影响面', '验证方式', '风险与回滚', '未覆盖项'];

function adopt() {
  adopted.value = true;
  MessagePlugin.success('已采纳：仅登记采纳（不自动合并）；采纳样本计入采纳率指标');
}

/** 正文编辑：草稿按段落可编辑，保存即写回页面数据（人工修改优先，重生成不覆盖） */
const editOpen = ref(false);
const draft = ref<string[]>([]);
const editedAt = ref('');

function openEdit() {
  draft.value = [...(out.value?.content ?? [])];
  editOpen.value = true;
}

function saveEdit() {
  const target = out.value;
  if (!target) {
    MessagePlugin.warning('草稿不存在，无法保存正文');
    return;
  }
  const next = draft.value.map((p) => p.trim()).filter((p) => p.length > 0);
  if (!next.length) {
    MessagePlugin.error('正文不能全部为空：请至少保留一段内容');
    return;
  }
  // 就地写回领域数据：覆盖正文段落并把生命周期状态置为 EDITED（人工校订标记）
  target.content = next;
  target.status = 'EDITED';
  editedAt.value = new Date().toLocaleString('zh-CN');
  editOpen.value = false;
  MessagePlugin.success(`已保存正文：${next.length} 段（状态置为 EDITED，重生成不覆盖人工修改）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="out ? `草稿详情 · ${out.title}` : '草稿详情'"
      :desc="out ? `${out.capabilityName} · 生成器 ${out.generator.model} · ${out.generator.promptVersion}` : '未找到草稿产出'"
      volume="卷 35" manifest="N3-04" :cli="out ? `oc ai output show ${out.id} --with-citations` : 'oc ai output show'"
      :status="out ? [{ label: out.status, theme: 'primary' }, { label: `引用覆盖 ${(out.citationCoverage * 100).toFixed(0)}%`, theme: out.citationCoverage >= 0.9 ? 'success' : 'warning' }, ...injectedBadge] : []"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="router.push('/intel/outputs')">返回收件箱</Button>
        <Popconfirm content="采纳只登记结果，不会自动合并到主干；后续合并由人或 CI 门禁执行。是否采纳？" @confirm="adopt">
          <Button size="small" theme="primary" :disabled="adopted">采纳草稿</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取草稿正文与引用…"
      empty-title="草稿不存在" empty-desc="该草稿 id 未命中（可能已被 SUPERSEDED 取代或超出保留期）。"
      empty-action="返回收件箱" example-task="查看一条与人工内容冲突的草稿，确认 AI 版本不覆盖人工段落"
      what="草稿加载失败" why="正文载荷位于对象存储，临时不可达（表内仅保留引用）"
      how="重试；或按 output id 从审计视图检索引用" trace-id="trace-c40e13b9"
      @retry="demo = 'NORMAL'" @empty-action="router.push('/intel/outputs')"
    >
      <template v-if="out">
        <Alert v-if="out.conflictsWithHuman" theme="warning" style="margin-bottom: 10px"
          message="该草稿与人类既有内容冲突：人工修订受保护，AI 版本不得覆盖；请并排裁决（默认以人工版本为准）。" />
        <Alert v-else-if="out.citationCoverage < 0.9" theme="warning" style="margin-bottom: 10px"
          message="引用覆盖率低于 90%：结论类输出必须带引用（C4），无引用条目已标注「推断」并被门禁标记。" />

        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <div class="oc-card__title">正文（结构化段落）<CliHint :command="`oc ai output render ${out.id}`" /></div>
            <div v-for="(p, i) in out.content" :key="i" class="oc-stack" style="gap: 2px; margin-bottom: 8px">
              <b style="font-size: 13px">{{ SECTION_LABELS[i] ?? `段落 ${i + 1}` }}</b>
              <span class="oc-secondary" style="font-size: 13px">{{ p }}</span>
            </div>
            <div v-if="editedAt" class="oc-muted" style="font-size: 12px">最近人工校订：{{ editedAt }}（重生成不覆盖）</div>
            <div class="oc-muted" style="font-size: 12px">
              归属标注：AI 生成 · {{ out.generator.model }} · {{ out.generator.promptVersion }}（缺失即被质量门禁拦截）。
            </div>
          </div>
          <div class="oc-stack" style="gap: 12px">
            <div class="oc-card">
              <div class="oc-card__title">产出元数据</div>
              <InfoGrid :columns="1" :items="[
                { key: 'id', label: '草稿 id', value: out.id, mono: true, copyable: true },
                { key: 'subject', label: '主体（diff / 测试运行 / 文档目录）', value: out.subjectRef, mono: true },
                { key: 'status', label: '生命周期状态', value: out.status, tag: { text: out.status, theme: 'primary' } },
                { key: 'cost', label: '成本', value: `$${out.costUsd.toFixed(2)}` },
                { key: 'at', label: '生成时间', value: new Date(out.createdAt).toLocaleString('zh-CN') },
                { key: 'by', label: '采纳人', value: out.adoptedBy ?? '—' },
              ]" />
            </div>
            <div class="oc-card">
              <div class="oc-card__title">引用列表（强制引用，可打开且版本可追溯）</div>
              <Table :data="out.citations" :columns="citColumns" row-key="ref" size="small" :pagination="undefined">
                <template #ref="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.ref }}</span></template>
                <template #kind="{ row }"><Tag size="small" variant="outline">{{ row.kind }}</Tag></template>
              </Table>
              <div v-if="!out.citations.length" class="oc-muted" style="font-size: 12px">无引用 → 已被引用门禁拦截（不得输出无依据结论）。</div>
            </div>
          </div>
        </div>

        <div class="oc-card" style="margin-top: 12px">
          <div class="oc-card__title">与人类内容并排冲突（DiffView：删除线为人工版本，新增为 AI 版本）</div>
          <DiffView v-if="conflictFiles.length" :files="conflictFiles" :collapse-over="60" />
          <div v-else class="oc-muted">该草稿未检测到与人类内容的冲突。</div>
        </div>

        <div class="oc-grid oc-grid--2" style="margin-top: 12px">
          <div class="oc-card">
            <div class="oc-card__title">三层门禁结论</div>
            <Table :data="out.gateLayers" :columns="gateColumns" row-key="layer" size="small" :pagination="undefined">
              <template #layer="{ row }"><Tag size="small" variant="light-outline" theme="primary">{{ row.layer }}</Tag></template>
              <template #pass="{ row }"><Tag size="small" :theme="row.pass ? 'success' : 'danger'" variant="light-outline">{{ row.pass ? 'PASS' : '拦截' }}</Tag></template>
            </Table>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">可校订动作</div>
            <div class="oc-stack" style="gap: 6px; font-size: 13px">
              <span>· 编辑：人工修改优先，重生成不覆盖人工内容</span>
              <span>· 驳回：样本回流评测集（含来源运行与生成器版本）</span>
              <span>· 误报：触发规则两段式降权（先降权，人工复核后停用）</span>
              <span>· 作为上下文引用：把本草稿与引用清单注入会话继续追问</span>
            </div>
            <div class="oc-flex" style="gap: 8px; margin-top: 8px; align-items: center">
              <Button size="small" variant="outline" :disabled="!!injectedAt" @click="injectContext">作为上下文引用</Button>
              <Button size="small" variant="text" @click="openEdit">编辑正文</Button>
              <Tag v-if="injectedAt" size="small" theme="success" variant="light-outline">已注入会话（{{ injectedRefs.length }} 条引用）</Tag>
            </div>
            <div v-if="injectedAt" class="oc-stack" style="gap: 4px; margin-top: 8px">
              <div class="oc-muted" style="font-size: 12px">本次注入的引用清单（注入时间 {{ injectedAt }}）：</div>
              <div v-for="(c, i) in injectedRefs" :key="`inj-${i}`" class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px">
                <Tag size="small" variant="outline">{{ c.kind }}</Tag>
                <span class="oc-mono">{{ c.ref }}</span>
                <span class="oc-muted">版本 / 位置：{{ c.loc }}</span>
              </div>
              <div v-if="!injectedRefs.length" class="oc-muted" style="font-size: 12px">
                本草稿没有引用条目：生成期引用门禁已拦截（无依据内容不得注入会话）。
              </div>
            </div>
          </div>
        </div>
      </template>
    </StateShell>

    <Dialog
      v-model:visible="editOpen" header="编辑正文（人工修改优先，重生成不覆盖）" width="760px"
      :confirm-btn="{ content: '保存正文', theme: 'primary' }" cancel-btn="取消" @confirm="saveEdit"
    >
      <div class="oc-stack" style="gap: 10px">
        <div class="oc-muted" style="font-size: 12px">保存后状态置为 EDITED；AI 归属标注与引用列表保持不变，重生成不会覆盖人工段落。</div>
        <div v-for="(p, i) in draft" :key="i" class="oc-stack" style="gap: 4px">
          <span class="oc-muted" style="font-size: 12px">{{ SECTION_LABELS[i] ?? `段落 ${i + 1}` }}</span>
          <Textarea v-model="draft[i]" :autosize="{ minRows: 2, maxRows: 6 }" />
        </div>
      </div>
    </Dialog>
  </div>
</template>
