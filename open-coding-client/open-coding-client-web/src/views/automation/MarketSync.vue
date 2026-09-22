<script setup lang="ts">
/**
 * 市场同步面板（N2-15）：synced / sync.failed + 离线标记。
 * 溯源：卷 34 §8 降级策略；BUILD-MANIFEST N2-15。
 * 契约：市场不可用 → 用本地缓存模板集并标记「离线」（功能不静默降级）。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const sync = automationData.marketSync;
const syncing = ref(false);

/** 离线镜像导入记录（页面可见：文件名 / 模板数 / 签名链 / 导入时间） */
type MirrorImport = { fileName: string; templates: number; chain: string; at: string };
const recentImports = ref<MirrorImport[]>([
  { fileName: 'oc-mirror-2026.35.1.ocpkg', templates: 12, chain: '签名链验证通过（publisher → org-registry → 本机信任根）', at: sync.lastSyncAt },
]);

/** 内置 mock 离线镜像包序号：重复导入时用于生成不同的包名 */
let mirrorSeq = 0;

/** 导入离线镜像：解析并校验 mock 包（模板定义 + 签名链）后写入「最近导入」清单 */
function importOfflineMirror() {
  mirrorSeq += 1;
  // 解析包清单：真实实现为 .ocpkg 解包并校验 manifest（此处用内置 mock 包等价结构）
  const manifest = JSON.parse(JSON.stringify({
    fileName: `oc-mirror-2026.35.${2 + mirrorSeq}.ocpkg`,
    templates: automationData.templates.map((t) => `${t.id}@${t.version}`),
    signatureChain: ['publisher Ed25519', 'org-registry 反签名', '本机信任根'],
  })) as { fileName: string; templates: string[]; signatureChain: string[] };

  // 校验：模板定义非空且签名链完整；缺一即拒绝导入（不做静默跳过）
  if (!manifest.templates.length || manifest.signatureChain.length < 3) {
    MessagePlugin.error(`离线镜像 ${manifest.fileName} 校验失败：模板定义缺失或签名链不完整，已拒绝导入`);
    return;
  }

  recentImports.value = [
    {
      fileName: manifest.fileName,
      templates: manifest.templates.length,
      chain: `签名链验证通过（${manifest.signatureChain.length} 段：publisher → org-registry → 本机信任根）`,
      at: new Date().toISOString(),
    },
    ...recentImports.value,
  ];
  MessagePlugin.success(`已导入离线镜像 ${manifest.fileName}：解析出 ${manifest.templates.length} 个模板定义，签名链 ${manifest.signatureChain.length} 段全部校验通过（最近导入 +1）`);
}


const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'OFFLINE', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const columns = [
  { colKey: 'name', title: '来源', width: 240 },
  { colKey: 'kind', title: '类型', width: 120, cell: 'kind' },
  { colKey: 'version', title: '目录版本', width: 170 },
  { colKey: 'syncedAt', title: '最近同步', width: 180, cell: 'at' },
  { colKey: 'status', title: '状态', width: 130, cell: 'status' },
  { colKey: 'note', title: '说明', ellipsis: true },
];
const STATUS_THEME: Record<string, 'success' | 'danger' | 'default'> = { synced: 'success', 'sync.failed': 'danger', offline: 'default' };

const failed = computed(() => sync.sources.filter((s) => s.status === 'sync.failed').length);

function retrySync() {
  syncing.value = true;
  window.setTimeout(() => {
    syncing.value = false;
    MessagePlugin.warning('同步仍失败：签名校验通过但索引分片下载中断（保留上次目录并维持离线标记）');
  }, 1200);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="市场同步"
      desc="公共市场 / 组织私仓 / 本地缓存三源目录同步；同步失败保留上次目录并显式标记「离线」，不静默降级。"
      volume="卷 34" manifest="N2-15" cli="oc automation market sync --source all --report-offline"
      :status="[{ label: sync.status, theme: sync.status === 'synced' ? 'success' : 'danger' }, { label: sync.offline ? '离线（缓存可用）' : '在线', theme: sync.offline ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" :loading="syncing" @click="retrySync">立即同步</Button>
        <Button size="small" theme="primary" @click="importOfflineMirror">导入离线镜像</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在比对三源目录版本与签名…"
      empty-title="没有配置市场来源" empty-desc="可在企业设置中配置公共市场 / 组织私仓地址；无来源时仅本地包可用。"
      empty-action="配置来源" example-task="查看离线标记下的可用模板范围，并验证缓存目录版本"
      :disabled-capabilities="['市场目录刷新', '模板安装']" what="市场同步失败"
      why="索引分片下载超时（网络中断 3 次），已保留上次目录并标记离线"
      how="重试同步，或导入离线镜像包；离线期间以缓存与本地包继续可用" trace-id="trace-2ba47131"
      @retry="retrySync" @empty-action="demo = 'NORMAL'"
    >
      <Alert v-if="sync.offline" theme="warning" style="margin-bottom: 10px"
        :message="`离线标记：市场目录停留在 ${sync.catalogVersion}（最近同步 ${new Date(sync.lastSyncAt).toLocaleString('zh-CN')}）；离线期间安装不受阻，但新上架模板不可见。`" />

      <div class="oc-grid oc-grid--3">
        <div class="oc-card">
          <div class="oc-card__title">同步概要</div>
          <InfoGrid :columns="1" :items="[
            { key: 'status', label: '同步状态', value: sync.status, tag: { text: sync.status, theme: sync.status === 'synced' ? 'success' : 'danger' } },
            { key: 'catalog', label: '目录版本', value: sync.catalogVersion, mono: true },
            { key: 'last', label: '最近同步', value: new Date(sync.lastSyncAt).toLocaleString('zh-CN') },
            { key: 'next', label: '下次计划同步', value: new Date(sync.nextSyncAt).toLocaleString('zh-CN') },
            { key: 'fail', label: '失败来源', value: `${failed} 个` },
            { key: 'imports', label: '最近导入', value: `${recentImports.length} 个离线镜像包` },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">失败与恢复路径<CliHint command="oc automation market sync --source public --verbose" /></div>
          <div v-for="f in sync.failures" :key="f.source" class="oc-stack" style="gap: 2px">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" theme="danger" variant="light-outline">{{ f.code }}</Tag>
              <b style="font-size: 13px">{{ f.source }}</b>
            </div>
            <div class="oc-secondary" style="font-size: 12px">{{ f.reason }}</div>
            <div class="oc-muted" style="font-size: 12px">{{ f.recovery }}</div>
          </div>
          <div v-if="!sync.failures.length" class="oc-muted">无失败项。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">缓存策略</div>
          <InfoGrid :columns="1" :items="[
            { key: 'def', label: '模板定义缓存', value: '(tenantId, templateId, version, digest) 二级缓存，TTL 10 分钟' },
            { key: 'list', label: '模板仓列表', value: '按租户短 TTL（60s），模板变更主动失效' },
            { key: 'market', label: '市场目录', value: '缓存 1 小时；离线时以缓存与本地包继续可用' },
            { key: 'key', label: '缓存键红线', value: '必须含租户（跨租户缓存复用属安全红线）' },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">同步来源明细</div>
        <Table :data="sync.sources" :columns="columns" row-key="name" size="small" :pagination="undefined">
          <template #kind="{ row }"><Tag size="small" variant="outline">{{ row.kind }}</Tag></template>
          <template #at="{ row }"><span style="font-size: 12px">{{ new Date(row.syncedAt).toLocaleString('zh-CN') }}</span></template>
          <template #status="{ row }"><Tag size="small" :theme="STATUS_THEME[row.status]" variant="light-outline">{{ row.status }}</Tag></template>
        </Table>
        <div class="oc-divider" />
        <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">
          最近导入的离线镜像包（{{ recentImports.length }}）· 导入时校验模板定义与签名链，失败项拒绝导入不静默跳过
        </div>
        <div v-for="im in recentImports" :key="im.at + im.fileName" class="oc-flex oc-flex--wrap" style="gap: 8px; font-size: 12px; margin-bottom: 4px">
          <Tag size="small" theme="success" variant="light-outline">签名链通过</Tag>
          <span class="oc-mono">{{ im.fileName }}</span>
          <span class="oc-secondary">模板 {{ im.templates }} 个</span>
          <span class="oc-muted">{{ new Date(im.at).toLocaleString('zh-CN') }}</span>
        </div>

        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
          <Tag size="small" variant="outline">事件：automation.market.synced / market.sync.failed</Tag>
          <Tag size="small" variant="outline">私仓可镜像公共内容（企业白名单）</Tag>
          <Tag size="small" theme="warning" variant="light-outline">未签名模板在强制模式下直接拒绝</Tag>
        </div>
      </div>
    </StateShell>
  </div>
</template>
