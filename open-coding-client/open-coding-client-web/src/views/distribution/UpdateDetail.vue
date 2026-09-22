<script setup lang="ts">
/**
 * D-01 更新详情：候选版本元数据（制品哈希 / 签名 / 兼容性 / 迁移 / 公告）+ 签名与防降级说明 + 跨大版本提示。
 * 硬约束：签名不符即拒绝安装；低于 minVersion 或低于已安装版本的制品被拒（防降级）。
 * 溯源：卷 28 §4.1 / BUILD-MANIFEST D-01
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import type { InfoItem } from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const version = ref(d.updateCandidates[0].version);
/** 演示开关：以 3.0 候选视角预览跨主版本策略（真实实现按候选版本自动判定） */
const previewCrossMajor = ref(false);
const currentVersion = '2.9.1';
const candidate = computed(() => d.updateCandidates.find((c) => c.version === version.value) ?? d.updateCandidates[0]);
const artifactRows = computed(() => candidate.value.artifacts.map((a) => ({ ...a, name: `${a.platform} · ${a.kind}` })));
const failedSample = computed(() => d.updateHistory.find((h) => h.result === 'FAILED'));
const mg = computed(() => candidate.value.migration);
/** 取主版本号（第一段数字） */
function majorOf(v: string): number {
  return Number.parseInt(v.split('.')[0] ?? '0', 10) || 0;
}
const isCrossMajor = computed(() => previewCrossMajor.value || majorOf(candidate.value.version) > majorOf(currentVersion));
const meta = computed<InfoItem[]>(() => [
  { key: 'version', label: '候选版本', value: candidate.value.version, mono: true, copyable: true },
  { key: 'channel', label: '通道', value: candidate.value.channel, tag: { text: candidate.value.channel, theme: candidate.value.channel === 'stable' ? 'success' : candidate.value.channel === 'beta' ? 'primary' : 'warning' } },
  { key: 'releasedAt', label: '发布时间', value: new Date(candidate.value.releasedAt).toLocaleString('zh-CN') },
  { key: 'minVersion', label: '最低来源版本（防降级基线）', value: candidate.value.minVersion, mono: true, hint: '低于该版本无法直升' },
  { key: 'kernel', label: '内核兼容', value: candidate.value.compatibility.kernel },
  { key: 'protocol', label: '协议版本', value: candidate.value.compatibility.protocol },
  { key: 'dataSchema', label: '数据结构', value: candidate.value.compatibility.dataSchema, span: 2 },
  { key: 'pluginSdk', label: '插件 SDK 兼容', value: candidate.value.compatibility.pluginSdk },
  { key: 'migration', label: '迁移', value: mg.value.hasMigration ? `需迁移（${mg.value.estimatedMinutes} 分钟，expand-contract ${mg.value.expandContract ? '两阶段' : '单阶段'}）` : '无需迁移' },
  { key: 'rollback', label: '迁移可回滚性', value: mg.value.rollbackable ? '可回滚（数据快照一并回退）' : '不可回滚（须先完成 expand-contract 演练）', tag: { text: mg.value.rollbackable ? '可回滚' : '不可回滚', theme: mg.value.rollbackable ? 'success' : 'danger' } },
  { key: 'announcement', label: '公告', value: `${candidate.value.announcement.title}（${candidate.value.announcement.level}）`, span: 2 },
  { key: 'cdn', label: '分发状态', value: candidate.value.cdnReady ? 'CDN 已就绪（多源冗余）' : 'CDN 未就绪（仅内部源，下载可能降速）', tag: { text: candidate.value.cdnReady ? 'CDN 就绪' : '仅内部源', theme: candidate.value.cdnReady ? 'success' : 'warning' } },
]);
function onVersion(v: unknown) {
  version.value = String(v);
  previewCrossMajor.value = false;
}
function exportMeta() {
  downloadJson({ candidate: candidate.value, generatedFor: currentVersion, note: '更新元数据（含制品哈希与签名引用）；签名私钥不可导出' }, `update-${candidate.value.version}-metadata.json`);
  MessagePlugin.success('更新元数据已导出（JSON，含制品哈希与签名）');
}
function applyUpdate() {
  MessagePlugin.info(`已发起应用 ${candidate.value.version}：先验签 → 防降级 → 预检 → 应用（详见「更新进度」页）`);
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = d.updateCandidates.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}
onMounted(load);
</script>

<template>
  <div class="oc-page">
    <PageHeader title="更新详情" volume="卷 28" manifest="D-01" cli="oc update show --version 2.9.2 --with-artifacts --json"
      desc="候选版本的制品清单（哈希 / 大小 / 签名）、兼容性与迁移信息、公告与分发状态；签名不符即拒绝，跨大版本需中间版本。"
      :status="[{ label: `当前 ${currentVersion}`, theme: 'default' }, { label: '签名不符即拒绝', theme: 'danger' }]">
      <template #actions>
        <Select :value="version" size="small" style="width: 220px" @change="onVersion"
          :options="d.updateCandidates.map((c) => ({ value: c.version, label: `${c.version}（${c.channel}）` }))" />
        <Button size="small" variant="outline" @click="exportMeta"><OcIcon name="download" size="12px" /> 导出元数据</Button>
        <Button size="small" theme="primary" @click="applyUpdate">下载并应用</Button>
      </template>
    </PageHeader>
    <StateShell :state="state" trace-id="trace-upd-detail-2f6a91" empty-title="没有可查看的候选版本" empty-action="返回更新中心"
      empty-desc="当前通道尚未发布候选版本；可返回更新中心检查更新或切换通道。"
      example-task="查看 2.10.0-rc.3 的迁移信息并导出元数据给评审"
      what="更新元数据加载失败" why="元数据签名校验不通过或 CDN 索引不可达（拒绝使用未验签元数据）"
      how="可重试；若为镜像源问题，可在「离线分发」页使用介质包导入" @retry="load" @empty-action="load">
      <div class="oc-card">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">元数据（InfoGrid）</div>
          <CopyableId :id="`trace-upd-meta-${candidate.version}`" label="复制 traceId" short="24" />
        </div>
        <InfoGrid :items="meta" :columns="2" style="margin-top: 8px" />
      </div>
      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">制品清单（artifacts：哈希 / 大小 / 签名 / 有效期）</div>
        <Table :data="artifactRows" row-key="name" size="small" :columns="[
          { colKey: 'name', title: '制品', width: 220 }, { colKey: 'hash', title: 'SHA-256', width: 300 },
          { colKey: 'sizeMb', title: '大小', width: 100 }, { colKey: 'signature', title: '签名', width: 240 },
          { colKey: 'expiresAt', title: '签名有效期' }]">
          <template #name="{ row }"><span>{{ row.name }}</span><Tag size="small" variant="outline" style="margin-left: 6px">{{ row.platform }}</Tag></template>
          <template #hash="{ row }"><CopyableId :id="String(row.hash)" label="复制哈希" short="26" /></template>
          <template #sizeMb="{ row }"><span class="oc-mono">{{ row.sizeMb }} MB</span></template>
          <template #signature="{ row }">
            <span class="oc-mono">{{ row.signature }}</span><Tag size="small" theme="success" variant="light-outline" style="margin-left: 6px">验签通过</Tag>
          </template>
          <template #expiresAt="{ row }">{{ new Date(row.expiresAt).toLocaleDateString('zh-CN') }}（过期后重新签名）</template>
        </Table>
        <div class="oc-state__hint" style="margin-top: 6px">
          验证命令：<CliHint :command="`oc update verify --artifact ${artifactRows[0]?.hash ?? 'sha256:...'} --require-signature`" />
        </div>
      </div>
      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">签名与防降级（硬约束）</div>
          <div class="oc-stack" style="font-size: 12px">
            <div>① 签名不符即拒绝：制品必须通过企业签名公钥验签，失败不落盘、不安装（无「忽略继续」选项）。</div>
            <div>② 防降级：安装前校验候选版本 ≥ 最低来源版本 {{ candidate.minVersion }}，且不得低于已安装版本 {{ currentVersion }}。</div>
            <div>③ 证书固定（pinning）：下载通道强制证书固定，代理/MITM 环境显式报错而非静默降级为明文。</div>
          </div>
          <div class="oc-card" style="margin-top: 8px; border-left: 3px solid var(--td-error-color-3, #d54941)">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
              <Tag size="small" theme="danger" variant="light-outline">负样本</Tag>
              <span class="oc-muted" style="font-size: 12px">{{ failedSample?.version }} 升级失败：{{ failedSample?.reason }}</span>
            </div>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">跨大版本策略</div>
            <Switch v-model="previewCrossMajor" size="small" />
          </div>
          <div class="oc-muted" style="font-size: 12px">开关为演示：以 3.0 候选视角预览跨主版本提示。</div>
          <div v-if="isCrossMajor" class="oc-stack" style="margin-top: 8px; font-size: 12px">
            <Tag size="small" theme="warning" variant="light-outline">跨主版本升级</Tag>
            <div>需先升级到中间版本（当前主版本最新稳定版 {{ currentVersion }} → 2.10 稳定版），再升级到 3.x；不允许跨主版本直跳。</div>
            <div>中间版本会完成数据结构 expand 阶段；contract 阶段由 3.x 迁移脚本执行，失败可按 Runbook RB-01 回滚。</div>
            <CliHint command="oc upgrade --to 2.10.0 --chain --then 3.0.0 --verify" />
          </div>
          <div v-else class="oc-stack" style="margin-top: 8px; font-size: 12px">
            <Tag size="small" theme="success" variant="light-outline">同主版本</Tag>
            <div>候选 {{ candidate.version }} 与当前 {{ currentVersion }} 同主版本，可直接升级，无需中间版本。</div>
            <div>如后续出现跨主版本候选，本页将给出「先升到中间版本」的升级链与演练要求。</div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
