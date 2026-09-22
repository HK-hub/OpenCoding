<script setup lang="ts">
/**
 * W-05 项目知识页（Repo Wiki）：七段结构 + 逐条溯源 + 待确认标注 + 可编辑 + 版本对比。
 * 关键约束：无法溯源的结论必须标「待确认」，不得进入事实层；人工编辑后不再被自动覆盖（卷 11 §4.4）。
 * 溯源：卷 11 D-KB-10 / BUILD-MANIFEST W-05
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Select, Tag, Textarea, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.knowledge;

const state = ref<UiStateKind>('LOADING');
const activeId = ref(data.wikiPages[2].pageId);
const editOpen = ref(false);
const diffOpen = ref(false);
const draft = ref('');

const active = computed(() => data.wikiPages.find((p) => p.pageId === activeId.value) ?? data.wikiPages[0]);
const totalPending = computed(() => data.wikiPages.reduce((a, p) => a + p.pendingConfirm.length, 0));
const editedCount = computed(() => data.wikiPages.filter((p) => p.editedByHuman).length);

const versionDiff = computed<DiffFile[]>(() => [
  {
    path: `${active.value.repo} · 知识页 v1 → v${active.value.version}`,
    additions: 2,
    deletions: 2,
    lines: [
      { type: 'ctx', oldLine: 1, newLine: 1, text: '## 模块地图' },
      { type: 'del', oldLine: 2, text: '- 编排层：application-service（v1 旧命名）' },
      { type: 'add', newLine: 2, text: '- 编排层：application（用例编排；interfaces 只做协议适配）' },
      { type: 'ctx', oldLine: 3, newLine: 3, text: '## 测试与构建（人工校订段落，自动生成不覆盖）' },
      { type: 'del', oldLine: 4, text: '- 构建：mvn package' },
      { type: 'add', newLine: 4, text: '- 构建：mvn clean install（Java 21 + Maven 3.9+）' },
    ],
  },
]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function startEdit(section: string, content: string) {
  draft.value = content;
  editOpen.value = true;
  MessagePlugin.info(`编辑「${section}」：保存后该段落标记为人工校订，自动生成不再覆盖`);
}

function saveEdit() {
  editOpen.value = false;
  MessagePlugin.success('已保存人工校订；章节标记「人工校订」，仅提示可能过时，不自动覆写');
}

/** 重新生成队列（本页可见）：人工校订段落保留，生成后仅标注「可能过时」 */
const regenQueue = ref<{ pageId: string; repo: string; at: string; note: string; origin: string }[]>([]);

/** 是否已排队重新生成（按页面幂等） */
function queued(pageId: string) {
  return regenQueue.value.some((q) => q.pageId === pageId);
}

/** 请求重新生成：把当前知识页排入队列，人工校订段落不静默覆盖 */
function requestRegenerate() {
  const p = active.value;
  if (queued(p.pageId)) {
    MessagePlugin.info(`「${p.repo}」知识页已在重新生成队列中：人工校订段落保留并标注可能过时`);
    return;
  }
  regenQueue.value = [
    { pageId: p.pageId, repo: p.repo, at: new Date().toISOString(), note: '人工校订段落保留并标注可能过时', origin: '项目知识页（本页手动请求）' },
    ...regenQueue.value,
  ];
  MessagePlugin.success(`已请求重新生成「${p.repo}」：进入队列（共 ${regenQueue.value.length} 个），人工校订段落保留并标注可能过时`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="项目知识页"
      desc="由检索 + 符号图 + 模型总结生成的结构化知识页：七段固定结构、逐条溯源、待确认标注，可人工编辑并做版本对比。"
      volume="卷 11"
      manifest="W-05"
      cli="oc kb wiki show <repo> --version latest"
      :status="[{ label: `${data.wikiPages.length} 个项目`, theme: 'primary' }, { label: totalPending ? `${totalPending} 处待确认` : '无待确认', theme: totalPending ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="diffOpen = true"><OcIcon name="history" size="12px" /> 版本对比</Button>
        <Button size="small" theme="primary" @click="requestRegenerate">重新生成</Button>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="知识页" :value="data.wikiPages.length" unit="个" icon="file" hint="首次索引完成、重大提交或定期触发生成" />
      <StatCard label="待确认段落" :value="totalPending" unit="处" icon="help" :lower-is-better="true" hint="无法溯源的结论一律标「待确认」，不进事实层" />
      <StatCard label="人工校订" :value="editedCount" unit="个" icon="edit" hint="人工编辑后自动生成不再覆盖，仅提示可能过时" />
      <StatCard label="七段结构" :value="active.sections.length" unit="段" icon="layers" hint="架构/模块/依赖/流程/术语/变更点/测试构建" />
    </div>

    <StateShell
      :state="state"
      stage="生成知识页视图…"
      empty-title="该项目还没有知识页"
      empty-desc="知识页在首次索引完成后生成；也可手动请求生成（需索引就绪）。"
      empty-action="请求生成知识页"
      example-task="为 open-coding-client-web 生成架构概览与模块地图"
      what="知识页加载失败"
      why="生成器或索引不可达（kb.wiki.generated 事件缺失）。"
      how="可重试；索引正常时可基于检索结果临时生成只读视图。"
      trace-id="trace-wiki-8c02e1"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <button
          v-for="p in data.wikiPages"
          :key="p.pageId"
          type="button"
          class="oc-wiki"
          :class="{ 'oc-wiki--active': p.pageId === activeId }"
          @click="activeId = p.pageId"
        >
          <div class="oc-flex--between">
            <span class="oc-mono" style="font-size: 12px; font-weight: 600">{{ p.repo }}</span>
            <Tag size="small" variant="light-outline">{{ p.version }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 11px; margin-top: 3px">
            生成于 {{ new Date(p.generatedAt).toLocaleString('zh-CN') }}
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 4px; margin-top: 4px">
            <Tag v-if="p.editedByHuman" size="small" theme="primary" variant="light-outline">人工校订</Tag>
            <Tag v-if="p.pendingConfirm.length" size="small" theme="warning" variant="light-outline">{{ p.pendingConfirm.length }} 待确认</Tag>
            <Tag v-if="queued(p.pageId)" size="small" variant="light-outline">重新生成已排队</Tag>
          </div>
        </button>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          {{ active.title }}
          <span class="oc-flex" style="gap: 6px">
            <Tag size="small" variant="outline">版本 {{ active.version }}</Tag>
            <Tag v-if="active.editedByHuman" size="small" theme="primary" variant="light-outline">含人工校订段落</Tag>
            <Tag size="small" variant="outline">生成时间 {{ new Date(active.generatedAt).toLocaleString('zh-CN') }}</Tag>
          </span>
        </h3>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 10px">
          <span class="oc-muted" style="font-size: 12px">来源：</span>
          <Tag v-for="s in active.sourcedFrom" :key="s" size="small" variant="outline">
            <span class="oc-mono">{{ s }}</span>
          </Tag>
        </div>

        <Timeline>
          <TimelineItem v-for="s in active.sections" :key="s.name" theme="dot" :dot-color="s.pendingConfirm ? 'var(--oc-sev-warn)' : '#0052d9'">
            <div class="oc-flex--between" style="align-items: flex-start">
              <div class="oc-grow">
                <div class="oc-flex" style="gap: 6px">
                  <b style="font-size: 13px">{{ s.name }}</b>
                  <Tag v-if="s.pendingConfirm" size="small" theme="warning" variant="light-outline">待确认（无充分溯源）</Tag>
                </div>
                <div style="font-size: 13px; margin-top: 3px">{{ s.content }}</div>
                <div class="oc-flex oc-flex--wrap" style="gap: 4px; margin-top: 4px">
                  <span class="oc-muted" style="font-size: 11px">溯源：</span>
                  <span v-for="src in s.sources" :key="src" class="oc-mono oc-secondary" style="font-size: 11px">{{ src }}</span>
                </div>
              </div>
              <Button size="small" variant="text" @click="startEdit(s.name, s.content)">编辑</Button>
            </div>
          </TimelineItem>
        </Timeline>

        <div v-if="active.pendingConfirm.length" class="oc-card" style="border-color: var(--oc-sev-warn); margin-top: 6px">
          <div class="oc-flex" style="gap: 8px">
            <OcIcon name="help" size="14px" color="var(--oc-sev-warn)" />
            <span style="font-size: 13px">待确认项：{{ active.pendingConfirm.join('；') }}</span>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
            待确认段落不会被当作事实注入上下文；如被引用会显式标注「待确认」并降置信。
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          重新生成队列（{{ regenQueue.length }}）
          <span class="oc-muted" style="font-size: 12px">生成后保留人工校订段落，仅对其标注「可能过时」</span>
        </h3>
        <div v-if="!regenQueue.length" class="oc-muted" style="font-size: 12px">
          暂无排队请求：点右上「重新生成」把当前项目知识页排入队列，生成完成后可在此核对。
        </div>
        <div v-for="q in regenQueue" :key="q.pageId" class="oc-flex oc-flex--wrap" style="gap: 8px; font-size: 12px; margin-bottom: 4px">
          <Tag size="small" theme="primary" variant="light-outline">排队中</Tag>
          <span class="oc-mono">{{ q.repo }}</span>
          <span class="oc-secondary">{{ q.note }}</span>
          <span class="oc-muted">{{ q.origin }} · {{ new Date(q.at).toLocaleString('zh-CN') }}</span>
        </div>
      </div>

      <Dialog v-model:visible="editOpen" header="编辑知识页段落（保存后标记人工校订）" :width="560" @confirm="saveEdit">
        <Textarea v-model="draft" :autosize="{ minRows: 6, maxRows: 14 }" placeholder="用中文描述该段结论；无法溯源的判断请保留「待确认」标注" />
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          保存后：① 段落标记「人工校订」；② 自动生成不再覆写该段；③ 版本 +1，可用于版本对比。
        </div>
      </Dialog>

      <Dialog v-model:visible="diffOpen" header="版本对比" :width="740" :footer="false">
        <DiffView :files="versionDiff" :collapse-over="40" />
      </Dialog>
    </StateShell>
  </div>
</template>

<style scoped>
.oc-wiki {
  text-align: left;
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  padding: 8px 10px;
  background: var(--oc-bg-container);
  cursor: pointer;
}

.oc-wiki--active {
  border-color: var(--td-brand-color, #0052d9);
  background: var(--td-brand-color-light, #f2f3ff);
}
</style>
