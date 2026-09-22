<script setup lang="ts">
/**
 * F-02 崩溃上报：本地转储列表（14 天保留 / 大小 / 上传状态）+ 摘要自动上报 + 完整转储需确认 + 删除本地转储。
 * 硬约束：完整转储默认不上报，必须逐次确认（或显式「总是允许」）；删除本地转储不可恢复。
 * 溯源：卷 28 §5.2 / BUILD-MANIFEST F-02
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Checkbox, Dialog, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import type { CrashRecord } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const pageSize = ref(5);
const records = ref<CrashRecord[]>(d.crashRecords.map((c) => ({ ...c })));
const uploadOpen = ref(false);
const target = ref<CrashRecord | null>(null);
const alwaysAllow = ref(false);
const uploading = ref(false);
const uploadLink = ref('');
const linkExpiresAt = ref('');

const summaryConsent = computed(() => d.telemetryConsent.find((c) => c.level === 'L3 崩溃与错误'));
const visible = computed(() => records.value.slice(0, pageSize.value));
const isEdge = computed(() => records.value.length > pageSize.value);
const pendingFull = computed(() => records.value.filter((r) => r.requiresConfirmation && r.uploaded !== '已上报完整转储').length);
const uploadTheme = (u: string) => (u.includes('完整') ? 'success' : u === '未上报' ? 'warning' : u === '已过期删除' ? 'default' : 'primary');
function openUpload(row: CrashRecord) {
  target.value = row;
  alwaysAllow.value = false;
  uploadLink.value = '';
  linkExpiresAt.value = '';
  uploadOpen.value = true;
}
/** 上传完整转储：仅上传本地预览确认后的内容，生成一次性链接（72 小时有效，仅可使用一次） */
function confirmUpload() {
  if (!target.value) return;
  uploading.value = true;
  window.setTimeout(() => {
    uploading.value = false;
    if (target.value) target.value.uploaded = '已上报完整转储';
    // 链接签名由本地演示哈希生成（真实实现由服务端签发，短时效 + 单次使用）
    const sig = `sig-${(target.value?.hash ?? 'sig').slice(-8)}-${target.value?.dumpSizeMb ?? 0}`.replace(/[^a-z0-9-]/gi, '');
    uploadLink.value = `https://oc.local/crash/upload/${target.value?.id ?? 'cr'}?sig=${sig}&one-time=1`;
    linkExpiresAt.value = new Date(Date.now() + 72 * 3600 * 1000).toLocaleString('zh-CN');
    MessagePlugin.success(`完整转储已上传（${target.value?.dumpSizeMb} MB）；一次性链接 72 小时内有效`);
    if (alwaysAllow.value) MessagePlugin.info('已记住「总是允许」：后续 L3 完整转储将直接上报（可随时在「遥测与隐私」撤销）');
  }, 800);
}

/** 删除本地转储：不可恢复（已上报的摘要不影响服务端） */
function deleteLocal(row: CrashRecord) {
  records.value = records.value.filter((r) => r.id !== row.id);
  MessagePlugin.success(`本地转储 ${row.id} 已删除（不可恢复）；服务端已上报的脱敏摘要保留`);
  if (!records.value.length) state.value = 'EMPTY';
}

function exportList() {
  downloadJson({ retentionDays: 14, records: records.value }, 'crash-dumps.json');
  MessagePlugin.success('本地转储清单已导出（JSON，含哈希与保留到期时间）');
}

function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = records.value.length ? (isEdge.value ? 'EDGE_DATA' : 'NORMAL') : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}

onMounted(load);
</script>

<template>
  <div class="oc-page">
    <PageHeader title="崩溃上报" volume="卷 28" manifest="F-02" cli="oc crash list --with-retention --json"
      desc="本地转储保留 14 天（含大小与上传状态）；脱敏摘要按 L3 同意自动上报，完整转储必须逐次确认后上传并生成一次性链接。"
      :status="[{ label: '摘要自动 / 完整需确认', theme: 'warning' }, { label: '14 天保留', theme: 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportList"><OcIcon name="download" size="12px" /> 导出清单</Button>
        <Button size="small" variant="outline" @click="load"><OcIcon name="refresh" size="12px" /> 刷新</Button>
      </template>
    </PageHeader>

    <StateShell :state="state" :page-size="pageSize" trace-id="trace-crash-reports-7d14ab" empty-title="没有本地崩溃转储" empty-action="刷新列表"
      :collapsed-summary="`共 ${records.length} 条本地转储，已折叠展示前 ${pageSize} 条（加载更多不静默截断）`"
      empty-desc="近 14 天内没有崩溃记录；转储按 14 天滚动清理，到期自动删除并在列表留痕。"
      example-task="确认并上传 cr-01 的完整转储（先在本地预览堆栈脱敏结果）"
      what="崩溃转储列表加载失败" why="本地转储目录不可读（挂载失败或权限不足），无法确认转储与保留期限。"
      how="可重试；转储不会因列表失败而丢失，恢复后自动重新索引。"
      @retry="load" @load-more="pageSize = records.length; state = 'NORMAL'" @empty-action="load">
      <div class="oc-grid oc-grid--4">
        <StatCard label="本地转储" :value="records.length" unit="条" icon="bug" hint="保留 14 天，到期自动删除" />
        <StatCard label="占用空间" :value="Math.round(records.reduce((s, r) => s + r.dumpSizeMb, 0) * 10) / 10" unit="MB" :lower-is-better="true" icon="folder" hint="完整转储较大，按需上传后清理" />
        <StatCard label="待确认完整转储" :value="pendingFull" unit="条" :lower-is-better="true" icon="upload" hint="未经确认不会上传" />
        <StatCard label="摘要自动上报" :value="summaryConsent?.enabled ? '已开启' : '未开启'" format="raw" icon="chart-bubble" :hint="summaryConsent?.enabled ? '仅脱敏摘要（L3 同意）' : '需在遥测设置开启 L3'" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">本地转储（14 天保留 · 大小 · 是否已上传）</div>
          <CopyableId id="trace-crash-list-3f8a21" label="复制 traceId" />
        </div>
        <Table :data="visible" row-key="id" size="small" style="margin-top: 8px" :columns="[
          { colKey: 'summary', title: '崩溃摘要', width: 320 }, { colKey: 'component', title: '组件', width: 90 },
          { colKey: 'dumpSizeMb', title: '大小', width: 100 }, { colKey: 'retention', title: '保留到期', width: 170 },
          { colKey: 'uploaded', title: '上传状态', width: 150 }, { colKey: 'action', title: '操作', width: 220 }]">
          <template #summary="{ row }">
            <span>{{ row.summary }}</span>
            <div class="oc-muted oc-mono" style="font-size: 11px">{{ row.fingerprint }} · {{ new Date(row.at).toLocaleString('zh-CN') }}</div>
          </template>
          <template #component="{ row }"><Tag size="small" variant="light-outline">{{ row.component }}</Tag></template>
          <template #dumpSizeMb="{ row }"><span class="oc-mono">{{ row.dumpSizeMb }} MB</span></template>
          <template #retention="{ row }">
            <Tooltip :content="`本地保留 ${row.localRetentionDays} 天；到期自动删除（可在到期前手动删除）`">
              <span>{{ new Date(row.expiresAt).toLocaleDateString('zh-CN') }}</span>
            </Tooltip>
          </template>
          <template #uploaded="{ row }"><Tag size="small" :theme="uploadTheme(String(row.uploaded))" variant="light-outline">{{ row.uploaded }}</Tag></template>
          <template #action="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <Button size="small" variant="outline" @click="openUpload(row)">上传完整转储</Button>
              <Popconfirm content="删除本地转储：转储文件将从本机移除且不可恢复（服务端已上报的脱敏摘要不受影响）。是否继续？" @confirm="deleteLocal(row)">
                <Button size="small" theme="danger" variant="text">删除</Button>
              </Popconfirm>
            </div>
          </template>
        </Table>
        <div v-if="isEdge" class="oc-state__hint">EDGE_DATA：共 {{ records.length }} 条，仅渲染前 {{ pageSize }} 条；「加载更多」不静默截断。</div>
      </div>
    </StateShell>

    <Dialog v-model:visible="uploadOpen" header="上传完整转储（需确认）" width="640px" cancel-btn="取消"
      :confirm-btn="{ content: uploading ? '上传中…' : '确认上传', theme: 'primary' }" @confirm="confirmUpload">
      <div v-if="target" class="oc-stack">
        <InfoGrid :columns="2" :items="[
          { key: 'id', label: '转储编号', value: target.id, mono: true, copyable: true },
          { key: 'component', label: '组件', value: target.component },
          { key: 'size', label: '大小', value: `${target.dumpSizeMb} MB` },
          { key: 'hash', label: 'SHA-256', value: target.hash, mono: true, hint: '上传后服务端比对' },
          { key: 'retention', label: '本地保留', value: `14 天（${new Date(target.expiresAt).toLocaleDateString('zh-CN')} 到期）` }]" />
        <div style="font-size: 12px">本地预览（堆栈已脱敏：路径替换为 &lt;path&gt;，密钥 / 标识掩码）：</div>
        <pre class="oc-pre" style="font-size: 12px">{{ target.stack }}</pre>
        <Checkbox v-model="alwaysAllow">总是允许（后续 L3 完整转储直接上报，可在「遥测与隐私」撤销）</Checkbox>
        <div v-if="uploadLink" class="oc-card" style="margin: 0">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
            <Tag size="small" theme="success" variant="light-outline">上传完成</Tag>
            <CopyableId :id="uploadLink" label="复制一次性链接" short="48" />
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
            一次性链接：仅可使用一次，过期时间 {{ linkExpiresAt }}（72 小时）；过期后需重新生成，服务端不接受重放。
          </div>
        </div>
        <CliHint command="oc crash upload --id cr-01 --full --one-time --expires 72h" />
      </div>
    </Dialog>
  </div>
</template>
