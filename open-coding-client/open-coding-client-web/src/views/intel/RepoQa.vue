<script setup lang="ts">
/**
 * 仓库知识问答（N3-11）：问答流 + 引用列表 + 无依据拒答 + 权限不足拒答 + 作为上下文引用。
 * 溯源：卷 35 §5.3 ⑦；BUILD-MANIFEST N3-11。
 * 契约：强制引用；无依据时明确回答「未找到依据」并给出检索范围；权限不足明确拒绝（不静默降级）。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Input, MessagePlugin, Select, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import type { QaThread } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const threads = ref<QaThread[]>(intelData.qaThreads);
const question = ref('');
const scope = ref('仓库 + docs');
const asking = ref(false);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onScope(v: unknown) {
  scope.value = String(v);
}

const refused = computed(() => threads.value.filter((t) => t.answerKind !== '有依据').length);
const withCitation = computed(() => threads.value.filter((t) => t.citations.length > 0).length);

/** 注入时间（按问答 id）与已注入条数：驱动「已注入会话」徽标与注入清单渲染 */
const injectedAt = ref<Record<string, string>>({});
const injectedCount = computed(() => threads.value.filter((t) => t.asContext).length);
const injectedBadge = computed(() => (injectedCount.value ? [{ label: `已注入会话上下文 ${injectedCount.value} 条`, theme: 'primary' as const }] : []));

/** 作为上下文引用：写回该问答的 asContext 标记并渲染引用清单（含版本与注入时间） */
function injectAsContext(t: (typeof threads.value)[number]) {
  if (!t.citations.length) {
    MessagePlugin.warning('该回答没有引用条目：引用门禁拦截，不得作为上下文注入');
    return;
  }
  t.asContext = true;
  injectedAt.value = { ...injectedAt.value, [t.id]: new Date().toLocaleString('zh-CN') };
  MessagePlugin.success(`已作为上下文引用注入会话：${t.citations.length} 条引用（含引用清单与版本，注入时间 ${injectedAt.value[t.id]}）`);
}

function ask() {
  if (!question.value.trim()) return;
  asking.value = true;
  window.setTimeout(() => {
    asking.value = false;
    threads.value.unshift({
      id: `qa-${threads.value.length + 1}`,
      question: question.value,
      askedBy: '当前用户',
      at: new Date().toISOString(),
      answer: '未找到依据：检索范围内未命中可引用来源，已明确拒答而不编造；可扩大检索范围或改问更具体的问题。',
      answerKind: '无依据拒答',
      citations: [],
      refuseReason: '强制引用门禁：无可引用来源即拒答（无依据回答率目标 0）。',
      asContext: false,
    });
    question.value = '';
    MessagePlugin.warning('未找到依据：已明确拒答（不编造），并给出建议检索范围');
  }, 900);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = threads.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="仓库知识问答"
      desc="混合检索 + 强制引用；无依据时明确拒答，权限不足时明确拒绝（不静默降级为公共知识）；回答可注入会话作为上下文。"
      volume="卷 35" manifest="N3-11" cli="oc ai ask --scope repo,docs &quot;审批链在哪实现&quot;"
      :status="[{ label: `${withCitation}/${threads.length} 带引用`, theme: 'success' }, { label: `${refused} 次拒答`, theme: refused ? 'warning' : 'default' }, ...injectedBadge]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="scope" size="small" style="width: 190px" aria-label="检索范围" :options="[{ value: '仓库 + docs', label: '仓库 + docs' }, { value: '仅当前仓库', label: '仅当前仓库' }, { value: '仓库 + 历史会话', label: '仓库 + 历史会话' }]" @change="onScope" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在做混合检索（全文 / 向量 / 符号）与重排…"
      empty-title="还没有提问" empty-desc="输入一个关于本仓库的问题；回答必须带引用，无依据会明确拒答。"
      empty-action="提一个示例问题" :example-task="'审批链的决策顺序在哪里实现？'"
      what="问答失败" why="检索服务不可用（向量索引或符号索引降级）"
      how="重试；降级时只提示「仅关键词检索」，不假装完整检索" trace-id="trace-c41f7720"
      @retry="demo = 'NORMAL'" @empty-action="question = '审批链的决策顺序在哪里实现？'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="问答次数" :value="threads.length" icon="help" hint="含拒答记录（拒答不视为失败）" />
        <StatCard label="引用覆盖率" :value="(withCitation / threads.length) * 100" format="percent" icon="link" :target="100" hint="强制引用：无依据即拒答" />
        <StatCard label="无依据拒答" :value="threads.filter((t) => t.answerKind === '无依据拒答').length" icon="close" :lower-is-better="false" hint="目标：无依据回答率 0" />
        <StatCard label="权限不足拒答" :value="threads.filter((t) => t.answerKind === '权限不足拒答').length" icon="lock" :lower-is-better="false" hint="不返回无权内容（含引用）" />
      </div>

      <div class="oc-card" style="margin: 12px 0">
        <div class="oc-card__title">提问<CliHint command="oc ai ask --scope repo,docs --require-citation" /></div>
        <div class="oc-flex" style="gap: 8px">
          <Input v-model="question" style="flex: 1" placeholder="例如：审批链的决策顺序在哪里实现？" @enter="ask" />
          <Button theme="primary" :loading="asking" @click="ask">提问</Button>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          检索范围：{{ scope }} · 缓存命中必须校验权限指纹（防越权复用）。
        </div>
      </div>

      <Alert v-if="threads.some((t) => t.answerKind === '权限不足拒答')" theme="warning" style="margin-bottom: 10px"
        message="存在权限不足拒答：系统不静默降级为公共知识，会明确说明缺失权限并记录安全审计。" />

      <div class="oc-stack" style="gap: 12px">
        <div v-for="t in threads" :key="t.id" class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" variant="outline">{{ t.askedBy }}</Tag>
              <span class="oc-muted" style="font-size: 12px">{{ new Date(t.at).toLocaleString('zh-CN') }}</span>
            </div>
            <Tag size="small" :theme="t.answerKind === '有依据' ? 'success' : t.answerKind === '无依据拒答' ? 'warning' : 'danger'" variant="light-outline">{{ t.answerKind }}</Tag>
          </div>
          <div style="font-weight: 600; margin: 6px 0">{{ t.question }}</div>
          <div class="oc-secondary" style="font-size: 13px">{{ t.answer }}</div>

          <div v-if="t.refuseReason" class="oc-muted" style="font-size: 12px; margin-top: 4px">拒答依据：{{ t.refuseReason }}</div>
          <div v-if="t.missingPermission" class="oc-flex" style="gap: 6px; margin-top: 4px">
            <Tag size="small" theme="danger" variant="light-outline">缺少权限 {{ t.missingPermission }}</Tag>
            <span class="oc-muted" style="font-size: 12px">可在「权限与审批 → 申请授权」提交申请</span>
          </div>

          <div v-if="t.citations.length" class="oc-stack" style="gap: 4px; margin-top: 8px">
            <div v-for="(c, i) in t.citations" :key="i" class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px">
              <Tag size="small" variant="outline">{{ c.kind }}</Tag>
              <span class="oc-mono">{{ c.ref }}</span>
              <span class="oc-muted">{{ c.loc }}</span>
            </div>
          </div>
          <InfoGrid v-if="t.missingPermission" :columns="1" :items="[{ key: 'scope', label: '权限不足时的行为', value: '明确拒绝 + 说明缺失权限；不返回无权内容（含引用）' }]" />

          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <Button size="small" variant="outline" :disabled="!t.citations.length" @click="injectAsContext(t)">作为上下文引用</Button>
            <Tag v-if="t.asContext" size="small" theme="primary" variant="light-outline">已注入会话</Tag>
            <Tag size="small" variant="outline">引用可打开且版本可追溯</Tag>
          </div>
          <div v-if="t.asContext" class="oc-stack" style="gap: 4px; margin-top: 6px">
            <div class="oc-muted" style="font-size: 12px">
              已注入会话上下文：{{ t.citations.length }} 条引用 · 注入时间 {{ injectedAt[t.id] ?? '本页加载前注入' }}
            </div>
            <div v-for="(c, i) in t.citations" :key="`inj-${t.id}-${i}`" class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px">
              <Tag size="small" theme="primary" variant="outline">{{ c.kind }}</Tag>
              <span class="oc-mono">{{ c.ref }}</span>
              <span class="oc-muted">版本 / 位置：{{ c.loc }}</span>
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
