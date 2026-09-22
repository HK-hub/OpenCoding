<script setup lang="ts">
/**
 * D-03 离线 / 私仓分发：介质包（全量 / 增量）下载与导入、私仓镜像同步状态、离线激活说明、私仓不可用时的降级提示。
 * 硬约束：私仓不可用时若策略允许则降级到官方源并显式标注来源；策略禁止时显式报错（不静默降级）。
 * 溯源：卷 28 §4.3 / BUILD-MANIFEST D-03
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson, downloadText, readTextFile } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const fileRef = ref<HTMLInputElement | null>(null);
const imported = ref('');
const syncing = ref('');
/** 介质包：全量用于 air-gapped 首次部署与跨大版本，增量用于已达标环境的窄带升级 */
const mediaPackages = [
  { id: 'pkg-full', kind: '全量包', name: 'oc-offline-full-2.9.2.tar.zst', sizeMb: 4120, platforms: 'linux-x64 / darwin-arm64 / 任意(CLI)', hash: d.updateCandidates[0].artifacts[0].hash, suit: 'air-gapped 首次部署、跨大版本升级' },
  { id: 'pkg-inc', kind: '增量包', name: 'oc-offline-inc-2.9.1-to-2.9.2.tar.zst', sizeMb: 268, platforms: 'linux-x64（当前架构）', hash: d.updateCandidates[0].artifacts[2].hash, suit: '已运行 ≥ 2.9.0 的环境窄带升级' },
];
/** 私仓降级判定：不可用时按 publicDisabled 决定「降级官方源并标注」或「显式报错」 */
const regDegrades = computed(() => d.registries.filter((r) => r.syncStatus !== 'IN_SYNC').map((r) => ({
  name: r.name,
  fact: `同步状态 ${r.syncStatus}（最近同步 ${new Date(r.lastSyncAt).toLocaleString('zh-CN')}）`,
  action: r.publicDisabled ? '组织策略禁用公共源 → 显式报错 REGISTRY_UNAVAILABLE，拒绝静默回退' : '组织策略允许 → 降级到官方公共源，并在来源处标注「降级拉取」',
  theme: (r.publicDisabled ? 'danger' : 'warning') as 'danger' | 'warning',
})));
const activationInfo = computed(() => [
  { key: 'step1', label: '① 生成请求', value: '本机生成设备指纹与席位声明（含租户），导出 activation-request.json' },
  { key: 'step2', label: '② 供应商签发', value: '供应商离线签发许可文件（含签名与有效期），经内网介质回传' },
  { key: 'step3', label: '③ 本地导入', value: '导入后校验签名与设备指纹；失败显式报错，不降级为「无许可运行」' },
  { key: 'step4', label: '④ 对账留痕', value: '导入动作记入审计；席位口径与在线版一致（30 天活跃）' },
]);
const syncTheme: Record<string, 'success' | 'warning' | 'danger'> = { IN_SYNC: 'success', OUT_OF_SYNC: 'warning', OFFLINE: 'warning', FAILED: 'danger' };
/** 导出介质包清单（演示环境导出清单与校验和；真实环境为对象存储直链） */
function downloadManifest(pkg: (typeof mediaPackages)[number]) {
  const text = [`# ${pkg.name}`, `# 类型：${pkg.kind} · 大小：${pkg.sizeMb} MB · 平台：${pkg.platforms}`,
    '# 演示环境导出「清单 + 校验和」；真实环境返回对象存储分片直链（带签名，短时效）',
    `${pkg.hash}  ${pkg.name}`, `${pkg.hash}  ${pkg.name}.asc`].join('\n');
  downloadText(text, `${pkg.name}.sha256.txt`);
  MessagePlugin.success(`已导出 ${pkg.name} 的校验清单（.sha256.txt）`);
}
function exportRegistryStatus() {
  downloadJson({ registries: d.registries, degrades: regDegrades.value, imported: imported.value }, 'registry-status.json');
  MessagePlugin.success('私仓同步状态已导出（JSON）');
}
function pickFile() { fileRef.value?.click(); }
/** 导入介质包校验清单：必须含 sha256 行，否则显式拒绝（不静默跳过校验） */
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const hashLines = (await readTextFile(file)).split('\n').filter((l) => l.includes('sha256:'));
    if (!hashLines.length) throw new Error('校验清单中找不到 sha256 行，拒绝导入（不做无校验安装）');
    imported.value = `${file.name}（${hashLines.length} 个制品校验通过）`;
    MessagePlugin.success(`介质包已导入并校验：${file.name}`);
  } catch (err) {
    MessagePlugin.error(`导入失败：${(err as Error).message}`);
  } finally { input.value = ''; }
}
/** 触发私仓同步：离线镜像源不支持在线同步，显式报错并给出替代动作 */
function syncRegistry(id: string, kind: string) {
  const reg = d.registries.find((r) => r.id === id);
  if (reg?.syncStatus === 'OFFLINE' || kind === '离线镜像') {
    MessagePlugin.error('该源为离线镜像包（air-gapped）：不支持在线同步，请使用「导入介质包」更新');
    return;
  }
  syncing.value = id;
  window.setTimeout(() => {
    syncing.value = '';
    MessagePlugin.success(`同步完成：${reg?.name}（新增 2 / 更新 5 / 失败 0）`);
  }, 700);
}
/** 生成离线激活请求文件（air-gapped 环境：请求 → 供应商签发 → 导入许可） */
function generateActivationRequest() {
  downloadJson({
    requestId: 'act-req-20260921-7f3a', tenant: d.tenantName, deviceFingerprint: 'fp-9c41-2ab8（设备绑定）', edition: '企业版（离线）', seats: d.license.seats,
    note: '演示环境生成请求文件；真实流程：提交至供应商 → 获取离线许可 → 在「许可与席位」导入',
  }, 'activation-request.json');
  MessagePlugin.success('离线激活请求已生成（JSON），可提交至供应商换取离线许可');
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = d.registries.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 240);
}
onMounted(load);
</script>
<template>
  <div class="oc-page">
    <PageHeader title="离线分发" volume="卷 28" manifest="D-03" cli="oc offline import --file oc-offline-inc-2.9.1-to-2.9.2.tar.zst --verify"
      desc="介质包（全量 / 增量）下载与导入、私仓镜像同步状态、离线激活说明；私仓不可用时的降级必须显式标注，策略禁止则显式报错。"
      :status="[{ label: 'air-gapped 可用', theme: 'default' }, { label: '禁止静默降级', theme: 'danger' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportRegistryStatus"><OcIcon name="download" size="12px" /> 导出私仓状态</Button>
        <Button size="small" variant="outline" @click="generateActivationRequest"><OcIcon name="secured" size="12px" /> 生成激活请求</Button>
        <Button size="small" theme="primary" @click="pickFile"><OcIcon name="upload" size="12px" /> 导入介质包</Button>
        <input ref="fileRef" type="file" accept=".txt,.json,.sha256" style="display: none" @change="onFile" />
      </template>
    </PageHeader>
    <StateShell :state="state" trace-id="trace-offline-dist-3b71c9" empty-title="没有可用的分发源" empty-action="导入离线介质包"
      empty-desc="未配置公共源、组织私仓或离线镜像包；请在组织策略中配置至少一个来源后重试。"
      example-task="在 air-gapped 环境导入增量包 2.9.1 → 2.9.2 并完成离线激活"
      what="分发源状态加载失败" why="私仓索引不可达且本地离线镜像清单不可读（网络与介质同时不可用）"
      how="可重试；也可先用「导入介质包」以离线方式恢复分发能力（无需网络）"
      @retry="load" @empty-action="pickFile">
      <div class="oc-grid oc-grid--4">
        <StatCard label="分发来源" :value="d.registries.length" unit="个" icon="layers" hint="公共源 + 组织私仓 + 离线镜像" />
        <StatCard label="介质包" :value="mediaPackages.length" unit="个" icon="download" hint="全量 4.02 GB / 增量 268 MB" />
        <StatCard label="私仓制品" :value="d.registries[1].itemCount" unit="项" icon="folder" hint="组织私仓优先于公共源" />
        <StatCard label="异常来源" :value="regDegrades.length" unit="个" :lower-is-better="true" icon="error" hint="不可用时按策略降级或显式报错" />
      </div>
      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">介质包（下载与导入）<CopyableId id="trace-offline-pkg-77a2e1" label="复制 traceId" /></div>
          <Table :data="mediaPackages" row-key="id" size="small" style="margin-top: 8px" :columns="[
            { colKey: 'kind', title: '类型', width: 100 }, { colKey: 'name', title: '介质包', width: 260 },
            { colKey: 'sizeMb', title: '大小', width: 110 }, { colKey: 'action', title: '操作', width: 130 }]">
            <template #kind="{ row }"><Tag size="small" :theme="row.kind === '全量包' ? 'primary' : 'success'" variant="light-outline">{{ row.kind }}</Tag></template>
            <template #name="{ row }">
              <span class="oc-mono">{{ row.name }}</span>
              <div class="oc-muted" style="font-size: 11px">{{ row.suit }} · 平台：{{ row.platforms }}</div>
            </template>
            <template #sizeMb="{ row }"><span class="oc-mono">{{ row.sizeMb }} MB</span></template>
            <template #action="{ row }"><Button size="small" variant="outline" @click="downloadManifest(row)">下载清单</Button></template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            <Tag size="small" theme="warning" variant="light-outline">演示环境</Tag>
            导出内容为清单与校验和；真实环境返回对象存储分片直链（签名、短时效）。导入状态：{{ imported || '未导入（待选择校验清单文件）' }}
          </div>
          <CliHint command="oc offline export --full --out /media/oc-offline" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">私仓镜像同步状态</div>
          <Table :data="d.registries" row-key="id" size="small" :columns="[
            { colKey: 'name', title: '来源', width: 170 }, { colKey: 'syncStatus', title: '同步状态', width: 120 },
            { colKey: 'itemCount', title: '制品', width: 90 }, { colKey: 'action', title: '操作', width: 110 }]">
            <template #name="{ row }">
              <span>{{ row.name }}</span>
              <div class="oc-muted" style="font-size: 11px">{{ row.kind }} · {{ row.publicDisabled ? '禁用公共源' : '允许公共源' }} · 签名校验{{ row.signed ? '开启' : '关闭' }}</div>
            </template>
            <template #syncStatus="{ row }">
              <Tooltip :content="`最近同步：${new Date(row.lastSyncAt).toLocaleString('zh-CN')}`">
                <Tag size="small" :theme="syncTheme[String(row.syncStatus)] ?? 'default'" variant="light-outline">{{ row.syncStatus }}</Tag>
              </Tooltip>
            </template>
            <template #itemCount="{ row }"><span class="oc-mono">{{ row.itemCount }}</span></template>
            <template #action="{ row }">
              <Button size="small" variant="outline" :loading="syncing === row.id" @click="syncRegistry(row.id, row.kind)">同步</Button>
            </template>
          </Table>
          <div v-for="g in regDegrades" :key="g.name" class="oc-state__hint" style="margin-top: 6px">
            <Tag size="small" :theme="g.theme" variant="light-outline">{{ g.name }} 不可用</Tag>
            {{ g.fact }}；处置：{{ g.action }}
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            私仓优先：拉取先查组织私仓，命中即用；未命中回退公共源（受策略约束）。离线镜像包内制品带哈希，导入时逐个校验。
          </div>
        </div>
      </div>
      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">离线激活说明（请求 → 签发 → 导入 → 对账）</div>
        <InfoGrid :items="activationInfo" :columns="2" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <Button size="small" variant="outline" @click="generateActivationRequest">生成激活请求（JSON）</Button><CliHint command="oc license activate --offline --file license-2026Q4.lic --verify-device" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
