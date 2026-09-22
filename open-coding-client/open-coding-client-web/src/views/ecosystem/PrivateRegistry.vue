<script setup lang="ts">
/**
 * 私仓与镜像（G2-03）：私仓配置（URL / 凭据引用，匿名化显示）、手动同步（进度 + 同步历史：
 * 方向 / 开始时间 / 同步条目数 / 状态）、导出离线镜像包（真实下载）、禁用公共源开关（说明影响：
 * 仅私有源可用）。
 * 溯源：卷 29 / BUILD-MANIFEST G2-03。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Alert, Button, Dialog, MessagePlugin, Popconfirm, Progress, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore, type UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const registries = enterpriseData.registries;
const activeId = ref(registries[1].id);
const active = computed(() => registries.find((r) => r.id === activeId.value) ?? registries[0]);

const loading = ref(true);
const limit = ref(4);
const syncing = ref(false);
const syncPct = ref(0);
const publicDisabled = ref(false);
const confirmPublicOpen = ref(false);

/** 同步历史：汇总全部源的同步记录（含 1 条失败负样本），按时间倒序 */
const syncRows = ref(
  registries
    .flatMap((r) => r.syncHistory.map((h) => ({ ...h, rowId: `${r.id}-${h.at}`, registry: r.name })))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
);

const visibleSync = computed(() => syncRows.value.slice(0, limit.value));
const pageState = computed<UiStateKind>(() => {
  if (loading.value) return 'LOADING';
  if (!syncRows.value.length) return 'EMPTY';
  return syncRows.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

const totalSynced = computed(() => syncRows.value.reduce((a, h) => a + h.added + h.updated, 0));
const failedCount = computed(() => syncRows.value.reduce((a, h) => a + h.failed, 0));

/** 手动同步进度定时器句柄（完成与卸载都要清理） */
let syncTimer: number | null = null;
/** 手动同步：进度可见；失败条目不静默跳过，单列状态与备注 */
function runSync() {
  if (syncing.value) return;
  syncing.value = true;
  syncPct.value = 0;
  syncTimer = window.setInterval(() => {
    syncPct.value = Math.min(100, syncPct.value + 20);
    if (syncPct.value >= 100) {
      if (syncTimer !== null) window.clearInterval(syncTimer);
      syncTimer = null;
      syncing.value = false;
      syncRows.value = [
        { rowId: `manual-${Date.now()}`, registry: active.value.name, at: new Date().toISOString(), direction: '双向同步', added: 2, updated: 5, failed: 0, note: '手动同步（发起人：当前用户）' },
        ...syncRows.value,
      ];
      ui.track('eco.private-registry.synced', { registry: active.value.id });
      MessagePlugin.success(`同步完成：新增 2 · 更新 5 · 失败 0（耗时 ${(syncRows.value.length * 0.4).toFixed(1)}s）`);
    }
  }, 180);
}

/** 导出离线镜像包：真实生成可下载清单（含哈希与签名状态，便于介质校验） */
function exportOfflineImage() {
  const manifest = {
    package: active.value.offlineImage?.name ?? `oc-registry-${active.value.id}-offline.tar.zst`,
    sizeMb: active.value.offlineImage?.sizeMb ?? active.value.itemCount * 12,
    hash: active.value.offlineImage?.hash ?? 'sha256:（由打包流水线生成）',
    registryUrl: active.value.url,
    itemCount: active.value.itemCount,
    signature: '介质包含包签名，导入前必须校验（不通过即拒绝）',
    items: active.value.syncHistory.map((h) => ({ at: h.at, direction: h.direction, added: h.added, updated: h.updated, failed: h.failed })),
  };
  const name = downloadJson(manifest, `oc-registry-offline-${active.value.id}.json`);
  MessagePlugin.success(`已生成离线镜像清单 ${name}（含哈希与签名状态）`);
}

function togglePublic(on: boolean) {
  if (on) {
    confirmPublicOpen.value = true;
    return;
  }
  publicDisabled.value = false;
  MessagePlugin.info('已恢复公共源：需要时仍会按签名与兼容性校验（未签名仅告警）');
}

function confirmDisablePublic() {
  publicDisabled.value = true;
  confirmPublicOpen.value = false;
  MessagePlugin.warning('已禁用公共源：仅私有源（含离线镜像）可用；已安装条目不受影响');
}

onMounted(() => {
  window.setTimeout(() => {
    loading.value = false;
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
onUnmounted(() => {
  // 离开页面时清理进度定时器：避免残留无归属定时器继续推进已卸载组件的状态
  if (syncTimer !== null) window.clearInterval(syncTimer);
  syncTimer = null;
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="私仓与镜像"
      desc="组织私仓优先：凭据以引用注入（界面只显示引用名），支持双向同步与离线镜像介质包；可一键禁用公共源，禁用后仅私有源可用。"
      volume="卷 29"
      manifest="G2-03"
      cli="oc registry sync --id reg-02 --json"
      :status="[{ label: publicDisabled ? '仅私有源可用' : '公共源按签名校验', theme: publicDisabled ? 'warning' : 'default' }, { label: '凭据引用式', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="syncing" @click="runSync">同步</Button>
        <Button size="small" theme="primary" @click="exportOfflineImage">导出离线镜像包</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="仓库源" :value="registries.length" unit="个" icon="server" hint="私仓 / 公共 / 离线镜像" />
      <StatCard label="私仓条目" :value="registries[1].itemCount" unit="个" icon="layers" />
      <StatCard label="本次同步条目" :value="totalSynced" unit="条" icon="refresh" hint="新增 + 更新（不含失败）" />
      <StatCard label="失败条目" :value="failedCount" unit="条" icon="error" :lower-is-better="true" hint="失败即下架并告警，不静默保留" />
    </div>

    <StateShell
      :state="pageState"
      :collapsed-summary="`同步历史 ${syncRows.length} 条，超过单次渲染阈值（4 条）已折叠。`"
      :page-size="4"
      stage="正在读取私仓配置与同步历史…"
      empty-title="尚未配置私仓"
      empty-desc="没有可用的私仓或离线镜像源；企业环境建议至少配置 1 个私仓（签名强制）作为唯一来源。"
      empty-action="配置组织私仓"
      example-task="配置私仓后执行双向同步，并导出离线镜像包用于隔离环境"
      what="私仓同步历史读取失败"
      why="私仓目录服务不可达（凭据引用解析失败或网络策略阻断）。"
      how="可重试；离线环境请改用介质导入（file:// 源），导入前校验包签名与哈希。"
      trace-id="trace-privreg-2f7bd0"
      @retry="loading = false"
      @load-more="limit += 4"
      @empty-action="runSync"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">私仓配置（URL / 凭据引用，匿名化显示）<CopyableId id="trace-privreg-2f7bd0" label="复制 traceId" /></div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 8px">
            <Tag
              v-for="r in registries"
              :key="r.id"
              size="small"
              :theme="r.id === activeId ? 'primary' : 'default'"
              variant="light-outline"
              style="cursor: pointer"
              @click="activeId = r.id"
            >
              {{ r.name }}
            </Tag>
          </div>
          <InfoGrid :columns="1" :items="[
            { key: 'url', label: '仓库 URL', value: active.url, mono: true, copyable: true },
            { key: 'cred', label: '凭据引用', value: 'secret://registry/org-private-token', secretRef: true },
            { key: 'kind', label: '类型', value: active.kind },
            { key: 'signed', label: '签名要求', value: active.signed ? '强制签名（未签名拒绝）' : '不强制（未签名仅告警）' },
            { key: 'sync', label: '同步状态', value: active.syncStatus, tag: { text: active.syncStatus, theme: active.syncStatus === 'IN_SYNC' ? 'success' : 'warning' } },
            { key: 'last', label: '最近同步', value: new Date(active.lastSyncAt).toLocaleString('zh-CN') },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <CliHint :command="`oc registry sync --id ${active.id} --json`" label="等价 CLI" />
            <Button size="small" variant="outline" :loading="syncing" @click="runSync">手动同步</Button>
          </div>
          <Progress v-if="syncing || syncPct > 0" :percentage="syncPct" :status="syncPct >= 100 ? 'success' : 'active'" style="margin-top: 10px" />
        </div>

        <div class="oc-card">
          <div class="oc-card__title">禁用公共源（影响说明）</div>
          <div class="oc-flex" style="gap: 8px; align-items: center">
            <Switch :model-value="publicDisabled" size="small" @change="(v) => togglePublic(Boolean(v))" />
            <span style="font-size: 13px">{{ publicDisabled ? '公共源已禁用：仅私有源（含离线镜像）可用' : '公共源启用中：按签名与兼容性校验' }}</span>
          </div>
          <Alert
            theme="warning"
            style="margin-top: 8px"
            message="禁用公共源后的影响：安装/更新只能来自私有源或离线镜像包。"
            description="已安装条目不中断；依赖公共源的更新会显式失败（不静默回退到缓存）；若同时没有可用私仓，安装入口将被禁用并给出原因。"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" variant="outline">已安装条目：不中断</Tag>
            <Tag size="small" variant="outline">更新：仅私仓</Tag>
            <Tag size="small" variant="outline">离线镜像：可作为唯一来源</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            首次使用前会做可达性检查：若不存在任何可用私有源，禁用操作会被拒绝并提示先配置私仓。
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">同步历史（方向 / 开始时间 / 条目数 / 状态）</div>
          <Table :data="visibleSync" row-key="rowId" size="small" :columns="[
            { colKey: 'registry', title: '来源', width: 130, ellipsis: true },
            { colKey: 'direction', title: '方向', width: 110 },
            { colKey: 'at', title: '开始时间', width: 170, cell: 'at' },
            { colKey: 'count', title: '条目数', width: 110, cell: 'count' },
            { colKey: 'status', title: '状态', width: 110, cell: 'status' },
          ]" table-layout="fixed">
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template #count="{ row }"><span class="oc-mono" style="font-size: 12px">+{{ row.added }} / ~{{ row.updated }}</span></template>
            <template #status="{ row }">
              <Tooltip :content="row.note || '无异常'">
                <Tag size="small" :theme="row.failed ? 'danger' : 'success'" variant="light-outline">{{ row.failed ? `失败 ${row.failed}` : '成功' }}</Tag>
              </Tooltip>
            </template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">展示 {{ visibleSync.length }} / {{ syncRows.length }} 条；失败的制品已下架，需重新签名后同步。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">离线镜像包（air-gapped）</div>
          <InfoGrid :columns="1" :items="[
            { key: 'name', label: '包名', value: active.offlineImage?.name ?? '未生成（点击导出按当前源生成清单）', mono: true },
            { key: 'size', label: '体积', value: `${(active.offlineImage?.sizeMb ?? active.itemCount * 12).toLocaleString('zh-CN')} MB` },
            { key: 'hash', label: '哈希', value: active.offlineImage?.hash ?? 'sha256:（打包流水线生成）', mono: true },
            { key: 'policy', label: '导入策略', value: '导入前校验包签名与哈希；不通过即拒绝（不做跳过的“高级选项”）' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Button size="small" theme="primary" @click="exportOfflineImage">导出离线镜像清单（JSON）</Button>
            <CliHint command="oc registry sync --id reg-03 --from /media/oc-registry-offline-202609.tar.zst" label="介质导入" />
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            离线镜像包含条目本体与索引；导入后本地即可离线安装（同步状态显示 OFFLINE，不报错）。
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog
      v-model:visible="confirmPublicOpen"
      header="确认禁用公共源"
      width="520px"
      :confirm-btn="{ content: '确认禁用', theme: 'danger' }"
      cancel-btn="取消"
      @confirm="confirmDisablePublic"
    >
      <div class="oc-stack">
        <Alert theme="warning" message="禁用公共源会改变安装来源与更新路径，且需要理由。" description="影响：① 未安装条目的公共来源安装入口禁用；② 依赖公共源的更新改为手工介质导入；③ 已安装条目不中断、不影响会话。" />
        <div class="oc-flex" style="gap: 6px; align-items: center">
          <OcIcon name="help" size="14px" />
          <span class="oc-muted" style="font-size: 12px">该操作可随时恢复（非破坏性），恢复后公共源重新参与校验与安装。</span>
        </div>
        <Popconfirm content="提示：此确认仅演示撤销窗口语义，实际操作已记录审计。" @confirm="MessagePlugin.info('已记录审计：操作者 / 时间 / 理由（演示）')">
          <Button size="small" variant="outline">为什么需要理由？</Button>
        </Popconfirm>
      </div>
    </Dialog>
  </div>
</template>
