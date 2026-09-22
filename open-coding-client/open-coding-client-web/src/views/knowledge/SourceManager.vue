<script setup lang="ts">
/**
 * W-01 知识源管理：8 类连接器 + 同步状态 + 增量同步 + 凭据隔离 + 同步日志。
 * 凭据一律引用式（SecretPort 注入），界面与日志永不回显明文；每源独立凭证（卷 11 §4.5）。
 * 溯源：卷 11 D-KB-8 / BUILD-MANIFEST W-01
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData, KNOWLEDGE_SOURCE_TYPES } from '@/mock/data/knowledge';
import type { KnowledgeSource } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.knowledge;

const state = ref<UiStateKind>('LOADING');
const typeFilter = ref('all');
const activeId = ref('ksrc-03');
const visible = ref(8);

// 本地 ref 持有连接器清单（与领域数据共享同一批对象），新增后页面立即更新
const sources = ref<KnowledgeSource[]>([...data.sources]);
const rows = computed(() => sources.value.filter((s) => typeFilter.value === 'all' || s.type === typeFilter.value));
const shownRows = computed(() => rows.value.slice(0, visible.value));
const active = computed<KnowledgeSource>(() => sources.value.find((s) => s.sourceId === activeId.value) ?? sources.value[0]);
const maxLag = computed(() => Math.max(...sources.value.map((s) => s.lagSeconds)));

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '边界数据', value: 'EDGE_DATA' },
];

function syncTheme(s: string) {
  return s === 'synced' ? 'success' : s === 'syncing' ? 'primary' : s === 'degraded' ? 'warning' : s === 'failed' ? 'danger' : 'default';
}
function syncLabel(s: string) {
  return { synced: '已同步', syncing: '同步中', degraded: '降级', failed: '失败', paused: '已暂停' }[s] ?? s;
}
function lagText(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}min`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}

function syncNow(s: KnowledgeSource) {
  MessagePlugin.success(`已触发「${s.name}」增量同步：凭据经 SecretPort 注入，界面不回显明文`);
}

/** 暂停该源同步：状态翻转「已暂停」，既有索引保持可检索，可随时恢复（断点续传） */
function pauseSource(s: KnowledgeSource) {
  if (s.syncStatus === 'paused') {
    MessagePlugin.info(`「${s.name}」已处于暂停状态：既有索引保持可检索，点「恢复同步」从断点继续`);
    return;
  }
  s.syncStatus = 'paused';
  s.logs = [{ at: new Date().toISOString(), level: 'warn', text: '已暂停同步：既有索引保持可检索；恢复后从断点继续，不重跑已完成块' }, ...s.logs];
  MessagePlugin.warning(`已暂停「${s.name}」同步：既有索引保持可检索，点「恢复同步」从断点继续`);
}

/** 恢复同步：状态回写为同步中，从上次断点续跑（幂等可重试） */
function resumeSource(s: KnowledgeSource) {
  s.syncStatus = 'syncing';
  s.logs = [{ at: new Date().toISOString(), level: 'ok', text: '已恢复同步：从上次断点继续（不重跑已完成块）' }, ...s.logs];
  MessagePlugin.success(`已恢复「${s.name}」同步：从断点继续，滞后将逐步收敛`);
}

/** 添加连接器表单（凭据只允许引用式，明文不入界面） */
const addOpen = ref(false);
const form = ref({ type: '仓库', name: '', credentialRef: '', syncMode: 'incremental' });

function openAdd() {
  form.value = { type: '仓库', name: '', credentialRef: '', syncMode: 'incremental' };
  addOpen.value = true;
}

/** 登记连接器：写入页面数据与领域数据，并触发首轮增量同步 */
function addConnector() {
  const name = form.value.name.trim();
  if (!name) {
    MessagePlugin.warning('请先填写连接器名称（用于在清单中区分数据来源）');
    return;
  }
  const seq = data.sources.length + 1;
  const src: KnowledgeSource = {
    sourceId: `ksrc-${String(seq).padStart(2, '0')}`,
    name,
    type: form.value.type as KnowledgeSource['type'],
    credentialRef: form.value.credentialRef.trim() || `cred://connector/${seq}`,
    syncMode: form.value.syncMode as KnowledgeSource['syncMode'],
    lastSyncAt: new Date().toISOString(),
    syncStatus: 'syncing',
    chunkCount: 0,
    lagSeconds: 0,
    logs: [{ at: new Date().toISOString(), level: 'ok', text: '连接器已登记：凭据经 SecretPort 校验（界面与日志仅保留引用）' }],
  };

  // 1. 登记连接器：同时写入领域数据与页面列表，并选中新源
  data.sources.push(src);
  sources.value = [...sources.value, src];
  typeFilter.value = 'all';
  activeId.value = src.sourceId;
  addOpen.value = false;
  MessagePlugin.success(`已添加连接器「${src.name}」：类型 ${src.type} · 凭据引用 ${src.credentialRef}（首轮索引排队中）`);

  // 2. 首轮增量同步完成：状态转为已同步并回填块数与日志
  window.setTimeout(() => {
    src.syncStatus = 'synced';
    src.chunkCount = 128;
    src.lastSyncAt = new Date().toISOString();
    src.logs = [{ at: new Date().toISOString(), level: 'ok', text: `首轮增量同步完成：新增 ${src.chunkCount} 块（已可检索）` }, ...src.logs];
    sources.value = [...sources.value];
    MessagePlugin.success(`「${src.name}」首轮同步完成：新增 ${src.chunkCount} 块，已可检索`);
  }, 600);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="知识源管理"
      desc="八类连接器统一接入：本地/仓库/工单/聊天/网页/对象存储/DB Schema/API 文档；凭据隔离，增量同步可见可停。"
      volume="卷 11"
      manifest="W-01"
      cli="oc kb source sync --id ksrc-03 --mode incremental"
      :status="[{ label: `${sources.length} 个连接器`, theme: 'primary' }, { label: '凭据引用式', theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="typeFilter" size="small" style="width: 150px" :options="[{ label: '全部类型', value: 'all' }, ...KNOWLEDGE_SOURCE_TYPES.map((t) => ({ label: t, value: t }))]" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
        <Button size="small" theme="primary" @click="openAdd"><OcIcon name="add" size="12px" /> 添加连接器</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="连接器" :value="sources.length" unit="个" icon="database" hint="覆盖八类来源，类型全覆盖" />
      <StatCard label="同步中" :value="sources.filter((s) => s.syncStatus === 'syncing').length" unit="个" icon="loading" :lower-is-better="true" hint="长任务可取消，取消保留已完成块" />
      <StatCard label="异常源" :value="sources.filter((s) => s.syncStatus === 'failed' || s.syncStatus === 'degraded').length" unit="个" icon="error" :lower-is-better="true" hint="失败保留快照与部分进度，不静默丢弃" />
      <StatCard label="最大滞后" :value="lagText(maxLag)" format="raw" icon="time" :lower-is-better="true" hint="滞后超阈值会在 W-02 与检索结果中标注" />
    </div>

    <StateShell
      :state="state"
      stage="加载连接器清单…"
      empty-title="还没有接入知识源"
      empty-desc="至少接入一个来源（推荐：仓库 + 本地）才能检索；本地源无需凭据。"
      empty-action="接入本地工作区"
      example-task="接入 GitLab 内网仓库并做首次全量索引"
      what="连接器清单加载失败"
      why="连接器注册表不可读（ConnectorSPI 装配失败或凭据服务不可达）。"
      how="可重试；已接入源的既有索引仍可检索。"
      trace-id="trace-ksrc-2d90fb"
      :collapsed-summary="`共 ${rows.length} 个连接器，超出阈值已折叠（避免长列表拖慢首屏）`"
      :page-size="visible"
      @retry="state = 'NORMAL'"
      @load-more="visible += 4"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            连接器清单
            <span class="oc-muted" style="font-size: 12px">点击行查看同步日志（已渲染 {{ shownRows.length }} / {{ rows.length }}）</span>
          </h3>
          <Table
            :data="shownRows"
            :columns="[
              { colKey: 'name', title: '名称 / 类型', cell: 'cell' },
              { colKey: 'credentialRef', title: '凭据引用', width: 190, cell: 'cell' },
              { colKey: 'syncMode', title: '模式', width: 84, cell: 'cell' },
              { colKey: 'syncStatus', title: '状态', width: 92, cell: 'cell' },
              { colKey: 'chunkCount', title: '块数', width: 84, cell: 'cell' },
              { colKey: 'lag', title: '滞后', width: 78, cell: 'cell' },
              { colKey: 'op', title: '操作', width: 84, cell: 'cell' },
            ]"
            row-key="sourceId"
            size="small"
            hover
            @row-click="(ctx) => (activeId = String(ctx.row.sourceId))"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'name'">
                <div class="oc-flex" style="gap: 6px">
                  <Tag size="small" variant="light-outline">{{ row.type }}</Tag>
                  <span class="oc-truncate" style="font-size: 13px; max-width: 200px">{{ row.name }}</span>
                </div>
              </template>
              <template v-else-if="col.colKey === 'credentialRef'">
                <Tooltip :content="`凭据引用：${row.credentialRef}；明文仅存密钥代理内存`">
                  <span class="oc-mono oc-truncate" style="max-width: 180px; display: block">{{ row.credentialRef }}</span>
                </Tooltip>
              </template>
              <template v-else-if="col.colKey === 'syncMode'">
                <Tag size="small" variant="outline">{{ row.syncMode === 'incremental' ? '增量' : '全量' }}</Tag>
              </template>
              <template v-else-if="col.colKey === 'syncStatus'">
                <Tag size="small" :theme="syncTheme(row.syncStatus)" variant="light-outline">{{ syncLabel(row.syncStatus) }}</Tag>
              </template>
              <template v-else-if="col.colKey === 'chunkCount'"><span class="oc-mono">{{ row.chunkCount.toLocaleString('zh-CN') }}</span></template>
              <template v-else-if="col.colKey === 'lag'">
                <Tooltip :content="`滞后 ${row.lagSeconds} 秒（从源变更到可检索）`">
                  <span :class="row.lagSeconds > 3600 ? '' : 'oc-mono'" :style="row.lagSeconds > 3600 ? 'color: var(--oc-sev-warn)' : ''">{{ lagText(row.lagSeconds) }}</span>
                </Tooltip>
              </template>
              <template v-else-if="col.colKey === 'op'">
                <Button size="small" variant="text" @click.stop="syncNow(row)">同步</Button>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
          <div v-if="shownRows.length < rows.length" class="oc-flex" style="justify-content: center; margin-top: 8px">
            <Button size="small" variant="text" @click="visible += 4">加载更多（剩余 {{ rows.length - shownRows.length }} 个）</Button>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            同步日志 · {{ active.name }}
            <Tag size="small" :theme="syncTheme(active.syncStatus)" variant="light-outline">{{ syncLabel(active.syncStatus) }}</Tag>
          </h3>
          <InfoGrid
            :columns="2"
            :items="[
              { key: 'sourceId', label: '源编号', value: active.sourceId, copyable: true },
              { key: 'type', label: '来源类型', value: active.type },
              { key: 'cred', label: '凭据引用', value: active.credentialRef, secretRef: true },
              { key: 'mode', label: '同步模式', value: active.syncMode === 'incremental' ? '增量（变更检测 + 事件驱动）' : '全量（重建）' },
              { key: 'chunks', label: '已索引块', value: `${active.chunkCount.toLocaleString('zh-CN')} 块` },
              { key: 'lag', label: '滞后', value: `${active.lagSeconds} 秒` },
              { key: 'last', label: '最近同步', value: new Date(active.lastSyncAt).toLocaleString('zh-CN') },
              { key: 'isolate', label: '凭据隔离', value: '独立凭证，不与其他源共享' },
            ]"
          />
          <div class="oc-divider" />
          <Timeline>
            <TimelineItem v-for="(l, i) in active.logs" :key="i" :theme="'dot'" :dot-color="l.level === 'error' ? 'var(--oc-sev-error)' : l.level === 'warn' ? 'var(--oc-sev-warn)' : 'var(--oc-sev-ok)'">
              <div style="font-size: 13px">{{ l.text }}</div>
              <div class="oc-muted" style="font-size: 11px">{{ new Date(l.at).toLocaleString('zh-CN') }}</div>
            </TimelineItem>
          </Timeline>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Button size="small" theme="primary" variant="outline" @click="syncNow(active)">立即增量同步</Button>
            <Button v-if="active.syncStatus === 'paused'" size="small" variant="outline" @click="resumeSource(active)">恢复同步</Button>
            <Button v-else size="small" variant="outline" @click="pauseSource(active)">暂停同步</Button>
            <Button size="small" variant="text" @click="MessagePlugin.warning('凭据轮换需在「凭证与密钥」页执行，本页不显示明文')">轮换凭据</Button>
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog
      v-model:visible="addOpen" header="添加连接器（凭据引用式，明文不入界面）" width="640px"
      :confirm-btn="{ content: '登记并同步', theme: 'primary' }" cancel-btn="取消" @confirm="addConnector"
    >
      <div class="oc-stack" style="gap: 10px">
        <InfoGrid :columns="1" :items="[
          { key: 'rule', label: '凭据规则', value: '凭据仅以引用保存（SecretPort 注入）；界面与日志永不回显明文' },
          { key: 'first', label: '首轮索引', value: '登记后立即排队首轮增量同步；失败保留快照与部分进度，不静默丢弃' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <Select v-model="form.type" size="small" style="width: 200px" :options="KNOWLEDGE_SOURCE_TYPES.map((t) => ({ value: t, label: t }))" aria-label="连接器类型" />
          <Select
            v-model="form.syncMode" size="small" style="width: 200px" aria-label="同步模式"
            :options="[{ value: 'incremental', label: '增量（变更检测）' }, { value: 'full', label: '全量（重建索引）' }]"
          />
        </div>
        <Input v-model="form.name" size="small" placeholder="连接器名称，例如：内网 GitLab · payment-core" />
        <Input v-model="form.credentialRef" size="small" placeholder="凭据引用，例如 cred://git/internal-pat（留空自动生成）" />
        <div class="oc-muted" style="font-size: 12px">已支持类型：{{ KNOWLEDGE_SOURCE_TYPES.join(' / ') }}</div>
      </div>
    </Dialog>
  </div>
</template>
