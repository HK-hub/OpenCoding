<script setup lang="ts">
/**
 * E-06 文件化同步：`.oc/memory/*.md` + YAML 头预览 + drift.detected（以文件为准）。
 * 双写冲突处理原则：文件为源，DB 仅作索引；界面编辑写回文件，外部改动以文件为准并重建索引（卷 10 §4.4）。
 * 溯源：卷 10 §4.4 / BUILD-MANIFEST E-06
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import type { MemoryFile } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.memory;

const state = ref<UiStateKind>('LOADING');
const activePath = ref(data.files[1].path);
const active = computed<MemoryFile>(() => data.files.find((f) => f.path === activePath.value) ?? data.files[0]);
const driftFiles = computed(() => data.files.filter((f) => f.drift).length);

/** 漂移差异：DB 索引版本 vs 文件最新版本（以文件为准，索引待重建） */
const driftDiff = computed<DiffFile[]>(() => [
  {
    path: `${active.value.path}（文件 → DB 索引）`,
    additions: 2,
    deletions: 2,
    externalChanged: active.value.drift,
    lines: [
      { type: 'ctx', oldLine: 1, newLine: 1, text: '## 依赖方向' },
      { type: 'del', oldLine: 2, text: '- core-* 允许依赖 domain 的实体（旧索引残留）' },
      { type: 'add', newLine: 2, text: '- core-* 零 Spring、零 domain 依赖（文件最新）' },
      { type: 'del', oldLine: 3, text: '- 适配器注册表允许在调用点 switch（旧索引残留）' },
      { type: 'add', newLine: 3, text: '- 新增协议只注册，不改调用点（文件最新）' },
    ],
  },
]);

/** 文件版本快照（ref，按路径分组）：保留版本时写入，含版本号 / 时间 / 字节大小 */
const versionMap = ref<Record<string, { version: string; at: string; size: number; note: string }[]>>({});
const writebackPaused = ref(false);
const activeVersions = computed(() => versionMap.value[activePath.value] ?? []);
const currentVersion = computed(() => activeVersions.value[0]?.version ?? 'v1（初始导入）');

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function stateTheme(s: string) {
  return s === 'in_sync' ? 'success' : s === 'drift' ? 'danger' : 'warning';
}

function rebuild() {
  // 重建完成后恢复界面写回（漂移期间暂停写回是为了不覆盖外部改动）
  writebackPaused.value = false;
  MessagePlugin.success('已触发索引重建：以文件为准，重建期间检索带「可能过时」标注');
}

/**
 * 保留当前文件版本并暂停界面写回。
 * 漂移期间界面编辑可能覆盖外部改动，先把文件现状固化为版本快照，待索引重建后再恢复写回。
 */
function preserveVersion() {
  const path = activePath.value;
  const list = versionMap.value[path] ?? [];
  // 版本号顺延：v1 为初始导入版本，之后每次保留 +1
  const record = {
    version: `v${list.length + 2}`,
    at: new Date().toISOString(),
    size: new TextEncoder().encode(active.value.content).length,
    note: '暂停界面写回前保留的快照',
  };
  versionMap.value = { ...versionMap.value, [path]: [record, ...list] };
  writebackPaused.value = true;
  MessagePlugin.success(`已保留文件版本 ${record.version}（${record.size} 字节）：界面编辑暂挂起，重建后可用`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="文件化同步"
      desc="项目/组织记忆以 Markdown 文件为真源（随仓库版本化、可评审）；DB 仅为索引与元数据，漂移时一律以文件为准。"
      volume="卷 10"
      manifest="E-06"
      cli="oc memory sync --from-file .oc/memory --rebuild-index"
      :status="[{ label: driftFiles ? `${driftFiles} 个文件漂移` : '索引一致', theme: driftFiles ? 'danger' : 'success' }, { label: '文件为源', theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" theme="primary" @click="rebuild"><OcIcon name="refresh" size="12px" /> 以文件为准重建索引</Button>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="记忆文件" :value="data.files.length" unit="个" icon="file" hint="位于工作区 .oc/memory/*.md，随仓库提交" />
      <StatCard label="索引一致" :value="data.files.filter((f) => f.indexState === 'in_sync').length" unit="个" icon="check" hint="一致性窗口 ≤ 5s（最终一致）" />
      <StatCard label="漂移待处理" :value="driftFiles" unit="个" icon="bug" :lower-is-better="true" hint="外部修改文件 → 索引重建；期间检索标注可能过时" />
      <StatCard label="文件内条目" :value="data.files.reduce((a, f) => a + f.entryCount, 0)" unit="条" icon="bookmark" hint="敏感级条目默认不写入文件（仅本地 DB）" />
    </div>

    <StateShell
      :state="state"
      stage="读取 .oc/memory 目录…"
      empty-title="工作区没有记忆文件"
      empty-desc="项目记忆默认不入库（尊重仓库隐私）；可在项目内启用文件化同步后生成 .oc/memory/*.md。"
      empty-action="启用文件化同步"
      example-task="把项目约定写入 .oc/memory/project-rules.md 并同步索引"
      what="记忆文件读取失败"
      why="工作区文件监听不可用（fs watcher 未就绪）。"
      how="可重试；同步失败不影响已有索引的检索。"
      trace-id="trace-mfile-3b71ce"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">文件清单</h3>
          <Table
            :data="data.files"
            :columns="[
              { colKey: 'path', title: '路径', cell: 'cell' },
              { colKey: 'indexState', title: '索引状态', width: 110, cell: 'cell' },
              { colKey: 'entryCount', title: '条目', width: 70 },
              { colKey: 'op', title: '预览', width: 76, cell: 'cell' },
            ]"
            row-key="path"
            size="small"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'path'">
                <span class="oc-mono oc-truncate" style="display: block; max-width: 260px">{{ row.path }}</span>
                <div class="oc-muted" style="font-size: 11px">最近同步 {{ new Date(row.lastSyncedAt).toLocaleString('zh-CN') }}</div>
              </template>
              <template v-else-if="col.colKey === 'indexState'">
                <Tooltip :content="row.drift ? '文件被外部修改，索引落后：以文件为准重建' : row.indexState === 'pending' ? '索引重建排队中' : '索引与文件一致'">
                  <Tag size="small" :theme="stateTheme(row.indexState)" variant="light-outline">
                    {{ row.indexState === 'in_sync' ? '一致' : row.indexState === 'drift' ? '漂移' : '待重建' }}
                  </Tag>
                </Tooltip>
              </template>
              <template v-else-if="col.colKey === 'op'">
                <Button size="small" variant="text" @click="activePath = row.path">查看</Button>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            {{ active.path }}
            <span class="oc-flex" style="gap: 6px">
              <Tag size="small" :theme="stateTheme(active.indexState)" variant="light-outline">{{ active.indexState === 'in_sync' ? '索引一致' : '索引漂移' }}</Tag>
              <Tag size="small" theme="primary" variant="outline">真源：文件</Tag>
            </span>
          </h3>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 6px">YAML 头（key/scope/tags/ttl/status，用于重建索引）</div>
          <pre class="oc-pre" style="max-height: 160px">{{ active.yamlHeader }}</pre>
          <div class="oc-muted" style="font-size: 12px; margin: 10px 0 6px">Markdown 正文（可评审、随仓库版本化）</div>
          <pre class="oc-pre">{{ active.content }}</pre>
          <div class="oc-flex" style="margin-top: 10px; gap: 8px">
            <CliHint command="oc memory edit --file .oc/memory/project-rules.md" label="oc memory edit" />
            <Button size="small" variant="outline" @click="rebuild">重建该文件索引</Button>
          </div>
          <div class="oc-divider" style="margin: 10px 0 8px" />
          <div class="oc-flex" style="gap: 6px; align-items: center">
            <span class="oc-muted" style="font-size: 12px">版本历史（文件快照）· 当前版本 <b class="oc-mono">{{ currentVersion }}</b></span>
            <Tag v-if="writebackPaused" size="small" theme="warning" variant="light-outline">界面写回已暂停</Tag>
          </div>
          <div v-if="!activeVersions.length" class="oc-muted" style="font-size: 12px; margin-top: 4px">尚未保留任何快照；点击「暂停界面写回」可把当前文件固化为版本。</div>
          <div v-for="v in activeVersions" :key="v.version" class="oc-flex" style="gap: 8px; font-size: 12px; padding: 3px 0">
            <Tag size="small" :theme="v.version === currentVersion ? 'primary' : 'default'" variant="light-outline">{{ v.version }}</Tag>
            <span class="oc-muted">{{ new Date(v.at).toLocaleString('zh-CN') }}</span>
            <span class="oc-secondary">{{ v.size }} 字节</span>
            <span class="oc-muted">{{ v.note }}</span>
          </div>
        </div>
      </div>

      <div v-if="active.drift" class="oc-card" style="border-color: var(--oc-sev-warn)">
        <h3 class="oc-card__title">
          检测到漂移（memory.drift.detected）
          <Tag size="small" theme="warning">以文件为准</Tag>
        </h3>
        <p class="oc-secondary" style="font-size: 13px; margin: 0 0 10px">
          文件在界面之外被修改（例如 git pull 或人工编辑）。处理顺序：① 索引标记待重建 ② 检索结果带「可能过时」标注 ③ 重建完成前界面不写回文件，避免覆盖外部改动。
        </p>
        <DiffView :files="driftDiff" :collapse-over="20" />
        <div class="oc-flex" style="gap: 8px; margin-top: 10px">
          <Button theme="primary" @click="rebuild">以文件为准重建索引</Button>
          <Button variant="outline" @click="preserveVersion">暂停界面写回</Button>
        </div>
      </div>
      <div v-else class="oc-card">
        <div class="oc-flex" style="gap: 8px">
          <OcIcon name="check" size="14px" color="var(--oc-sev-ok)" />
          <span style="font-size: 13px">当前文件与索引一致；敏感级条目仅存本地 DB，不写入文件。</span>
        </div>
      </div>
    </StateShell>
  </div>
</template>
