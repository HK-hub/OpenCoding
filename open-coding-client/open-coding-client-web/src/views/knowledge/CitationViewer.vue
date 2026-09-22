<script setup lang="ts">
/**
 * W-04 引用溯源：五类引用（repo:// doc:// url:// ticket:// wiki://）打开 + 已变更差异提示 + 网页快照 + 打开审计。
 * 规则：引用不可达时必须标注并降低置信度，不得当作事实继续引用（卷 11 D-KB-9 / §4.6）。
 * 溯源：卷 11 §4.3 / BUILD-MANIFEST W-04
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const data = knowledgeData.knowledge;

const state = ref<UiStateKind>('LOADING');
const refInput = ref(String(route.query.ref ?? data.searchResults[0].citation));
const kind = computed(() => refInput.value.split('://')[0] ?? 'repo');
const reachable = ref(true);
const openedAt = ref(new Date());

/** 来源打开审计与引用反馈队列：点击后本页可见的真实副作用（不连接真实来源系统） */
const openAudit = ref<{ ref: string; at: string }[]>([]);
const feedbackQueue = ref<{ ref: string; at: string }[]>([]);

/** 在来源中打开：写入本地打开审计（页面可见），并说明受权限约束 */
function openInSource() {
  openAudit.value = [{ ref: refInput.value, at: new Date().toLocaleTimeString() }, ...openAudit.value].slice(0, 5);
  MessagePlugin.success(`已在来源系统中打开：${refInput.value}（本次打开已写入审计，累计 ${openAudit.value.length} 条）`);
}

/** 反馈引用有误：进入 W-06 反馈队列（页面可见，按引用去重） */
function reportWrongRef() {
  if (feedbackQueue.value.some((x) => x.ref === refInput.value)) {
    MessagePlugin.info('该引用已在反馈队列中，无需重复提交');
    return;
  }
  feedbackQueue.value = [{ ref: refInput.value, at: new Date().toLocaleTimeString() }, ...feedbackQueue.value];
  MessagePlugin.success(`已反馈「引用有误」：进入 W-06 反馈队列（队列 ${feedbackQueue.value.length} 条）`);
}

const currentResult = computed(() => data.searchResults.find((r) => r.citation === refInput.value) ?? data.searchResults[0]);

const KIND_META: Record<string, { label: string; open: string; extra: string }> = {
  repo: { label: '代码引用', open: '打开文件并高亮行；若已变更提示差异', extra: '版本绑定：提交哈希' },
  doc: { label: '文档引用', open: '打开文档并定位块（chunk）', extra: '版本绑定：文档版本号' },
  url: { label: '网页引用', open: '打开链接 + 显示抓取快照', extra: '抓取时间戳（captured）' },
  ticket: { label: '工单/聊天引用', open: '打开原始条目（受权限约束）', extra: '定位到评论序号' },
  wiki: { label: '知识页引用', open: '打开知识页（含生成元数据）', extra: '版本绑定：页面版本' },
};

/** 已变更差异提示：引用指向旧提交，工作区已前进 */
const changedDiff = computed<DiffFile[]>(() => [
  {
    path: 'src/main/java/com/hk/opencoding/application/ContextSnapshotService.java',
    additions: 3,
    deletions: 2,
    externalChanged: true,
    lines: [
      { type: 'ctx', oldLine: 120, newLine: 120, text: 'public Snapshot build(Session session) {' },
      { type: 'del', oldLine: 121, text: '    int s4Budget = 600;   // 固定 5%（引用提交 a91f3c2）' },
      { type: 'add', newLine: 121, text: '    int s4Budget = budget.section(S4);  // 引用当前 main（已变更）' },
      { type: 'del', oldLine: 122, text: '    return snapshotWith(s4Budget);' },
      { type: 'add', newLine: 122, text: '    return snapshotWith(s4Budget, budget.waterline());' },
      { type: 'ctx', oldLine: 123, newLine: 123, text: '}' },
    ],
  },
]);

const snapshot = computed(() => ({
  url: 'https://docs.spring.io/spring-framework/reference/core/expressions.html',
  capturedAt: '2026-09-12T09:20:00Z',
  httpStatus: 200,
  title: 'Spring Expression Language (SpEL)',
  textHash: 'sha256:9f31ac…',
  excerpt: 'SpEL 求值上下文与安全边界；模板变量注入需白名单化，禁止直接拼接用户输入。',
}));

const auditRows = [
  { at: '2026-09-21T09:12:04Z', actor: '沈亦舟', action: '打开引用', result: '允许' },
  { at: '2026-09-21T08:41:37Z', actor: 'Agent（sess-2f81）', action: '注入上下文并打开', result: '允许' },
  { at: '2026-09-20T22:19:11Z', actor: 'Agent（sess-3a55）', action: '打开引用', result: '降置信标注' },
  { at: '2026-09-20T17:02:55Z', actor: '外部协作者（只读）', action: '打开引用', result: '拒绝（跨租户）' },
];

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '权限受限', value: 'PERMISSION_DENIED' },
];

function markUnreachable() {
  reachable.value = false;
  MessagePlugin.warning('引用不可达：已标注「不可达」并降低置信度，禁止当作事实继续引用');
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 200);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="引用溯源"
      desc="每条知识都尽量可点开：代码 / 文档 / 网页 / 工单 / 知识页五类引用统一打开，并提供变更差异、网页快照与打开审计。"
      volume="卷 11"
      manifest="W-04"
      :cli="`oc kb citation open '${refInput.slice(0, 48)}…'`"
      :status="[{ label: KIND_META[kind]?.label ?? '引用', theme: 'primary' }, { label: reachable ? '引用可达' : '引用不可达', theme: reachable ? 'success' : 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/knowledge/search')"><OcIcon name="search" size="12px" /> 返回检索</Button>
        <Button size="small" variant="outline" @click="markUnreachable">演示不可达</Button>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="打开次数（30 天）" :value="auditRows.length" unit="次" icon="link" hint="每次打开都记录：谁、何时、结果" />
      <StatCard label="已变更引用" :value="data.searchResults.filter((r) => r.stale).length" unit="条" icon="refresh" :lower-is-better="true" hint="指向旧版本：提示差异并降权" />
      <StatCard label="最后验证" :value="new Date(currentResult.lastVerifiedAt).toLocaleDateString('zh-CN')" format="raw" icon="time" hint="超过 90 天未访问将进入陈旧检测" />
      <StatCard label="置信调整" :value="reachable ? '保持' : '降置信'" format="raw" icon="flag" hint="不可达引用一律降置信并显式标注" />
    </div>

    <StateShell
      :state="state"
      stage="解析引用并校验可达性…"
      empty-title="没有可打开的引用"
      empty-desc="引用来自检索结果或会话中的知识注入；请先从检索工作台发起查询。"
      empty-action="去检索"
      example-task="打开 repo:// 引用并查看已变更差异"
      what="引用解析失败"
      why="引用格式非法或来源系统不可达（仓库/门户/工单系统）。"
      how="可重试；若来源系统长期不可用，该引用会被标注「不可达」并降置信。"
      trace-id="trace-cit-0a71fe"
      missing-permission="kb.citation.open"
      risk-level="R1"
      apply-path="在「权限与审批 → 申请授权」申请对应来源的只读权限"
      @retry="state = 'NORMAL'"
      @empty-action="router.push('/knowledge/search')"
    >
      <div class="oc-card">
        <div class="oc-flex" style="gap: 8px">
          <span class="oc-muted" style="font-size: 12px; flex: none">引用</span>
          <span class="oc-mono oc-truncate oc-grow" :title="refInput">{{ refInput }}</span>
          <Tag size="small" variant="light-outline">{{ KIND_META[kind]?.label ?? '未知类型' }}</Tag>
          <Tag v-if="!reachable" size="small" theme="danger">不可达 · 已降置信</Tag>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          {{ KIND_META[kind]?.open }} · {{ KIND_META[kind]?.extra }}
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            打开行为
            <span class="oc-flex" style="gap: 6px">
              <Tag size="small" theme="primary" variant="outline">{{ kind }}:// 协议</Tag>
              <Tag size="small" variant="outline">打开时间 {{ openedAt.toLocaleTimeString('zh-CN') }}</Tag>
            </span>
          </h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'target', label: '目标', value: refInput, block: true, mono: true },
              { key: 'reachable', label: '可达性', value: reachable ? '可达（来源系统响应正常）' : '不可达（来源已删除或权限被回收）', tag: { text: reachable ? '可达' : '不可达', theme: reachable ? 'success' as const : 'danger' as const } },
              { key: 'perm', label: '权限标签', value: `${currentResult.permissionTags.tenant} / ${currentResult.permissionTags.project} / ${currentResult.permissionTags.visibility} / ${currentResult.permissionTags.acl}` },
              { key: 'stale', label: '陈旧标注', value: currentResult.stale ? '可能过时（索引落后，排序降权）' : '未标记陈旧' },
            ]"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
            <Button size="small" theme="primary" variant="outline" @click="openInSource">在来源中打开</Button>
            <Button size="small" variant="outline" @click="reportWrongRef">反馈引用有误</Button>
            <Button size="small" variant="text" @click="refInput = data.searchResults[2].citation">切换为网页引用</Button>
          </div>

          <div v-if="openAudit.length || feedbackQueue.length" class="oc-stack" style="gap: 4px; margin-top: 8px">
            <div class="oc-secondary" style="font-size: 12px">
              打开审计 {{ openAudit.length }} 条 · 反馈队列 {{ feedbackQueue.length }} 条（本页本地记录，用于演示审计与 W-06 流转）
            </div>
            <div v-for="a in openAudit" :key="'o' + a.at" class="oc-muted" style="font-size: 12px">
              · 打开 {{ a.ref }} @ {{ a.at }}
            </div>
            <div v-for="f in feedbackQueue" :key="'f' + f.at" class="oc-muted" style="font-size: 12px">
              · 反馈「引用有误」{{ f.ref }} @ {{ f.at }}（W-06 待处理）
            </div>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            {{ kind === 'url' ? '网页快照' : kind === 'repo' ? '已变更差异提示' : '引用内容摘要' }}
            <Tag v-if="kind === 'url'" size="small" variant="light-outline">captured 快照</Tag>
          </h3>
          <JsonBlock v-if="kind === 'url'" :value="snapshot" label="抓取快照（原文哈希可校验）" :collapse-over="220" />
          <DiffView v-else-if="kind === 'repo'" :files="changedDiff" :collapse-over="40" />
          <div v-else class="oc-stack">
            <div class="oc-secondary" style="font-size: 13px">{{ currentResult.snippet }}</div>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" variant="outline">来源块：{{ data.chunks[0]?.chunkId }}</Tag>
              <Tag size="small" variant="outline">策略：{{ data.chunks[0]?.strategy }}</Tag>
              <Tag size="small" variant="outline">tokens：{{ data.chunks[0]?.tokens }}</Tag>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          打开审计
          <span class="oc-muted" style="font-size: 12px">谁、何时、打开哪个引用、结果如何（拒绝也留痕）</span>
        </h3>
        <Table
          :data="auditRows"
          :columns="[
            { colKey: 'at', title: '时间', width: 190, cell: 'cell' },
            { colKey: 'actor', title: '执行者', width: 220 },
            { colKey: 'action', title: '动作', width: 200 },
            { colKey: 'result', title: '结果', width: 140, cell: 'cell' },
          ]"
          row-key="at"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'at'">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template v-else-if="col.colKey === 'result'">
              <Tag size="small" :theme="row.result === '允许' ? 'success' : row.result === '拒绝（跨租户）' ? 'danger' : 'warning'" variant="light-outline">
                {{ row.result }}
              </Tag>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
