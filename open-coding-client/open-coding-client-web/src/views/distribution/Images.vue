<script setup lang="ts">
/**
 * D-03 沙箱镜像管理：预置镜像表（tag / 来源 / 签名校验 / 缓存字节 / 最近使用 / 可清理）+ 拉取并校验 + 清理缓存 + 私仓优先。
 * 硬约束：签名校验失败的镜像拒绝拉取（供应链阻断）；引用计数 > 0 的镜像禁止清理；清理后需重新拉取（不可恢复）。
 * 溯源：卷 28 §4.3 / BUILD-MANIFEST D-03
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import type { SandboxImage } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const pageSize = ref(8);
const images = ref<SandboxImage[]>(d.images.map((i) => ({ ...i })));
const pulling = ref('');
const pullPct = ref(0);
const timer = ref<number | null>(null);
/** 引用计数（确定性本地数据）：> 0 表示被运行中沙箱 / 任务引用，清理受保护 */
const refCounts: Record<string, number> = { 'img-01': 3, 'img-02': 1, 'img-06': 0, 'img-07': 0, 'img-08': 0, 'img-10': 1, 'img-11': 0 };
const privateRegistry = computed(() => d.registries.find((r) => r.kind === '组织私仓'));
const visible = computed(() => images.value.slice(0, pageSize.value));
const isEdge = computed(() => images.value.length > pageSize.value);
const totalCacheMb = computed(() => Math.round(images.value.reduce((s, i) => s + (i.cachedLocally ? i.cacheBytesMb : 0), 0)));
const purgeableMb = computed(() => Math.round(images.value.filter((i) => i.purgeable && (refCounts[i.id] ?? 0) === 0).reduce((s, i) => s + i.cacheBytesMb, 0)));
/** 缓存趋势（近 7 天 MB，末端为当前总计） */
const cacheTrend = computed(() => [1180, 1310, 1490, 1620, 1740, 1810, totalCacheMb.value]);
const trendSeries = computed(() => [{ name: '缓存占用', points: cacheTrend.value.map((v, i) => ({ x: i === cacheTrend.value.length - 1 ? '今日' : `-${cacheTrend.value.length - 1 - i}天`, y: v })) }]);
const refOf = (id: string) => refCounts[id] ?? 0;
const canPurge = (row: SandboxImage) => row.purgeable && refOf(row.id) === 0 && row.cachedLocally;

/** 拉取并校验：下载 → 验签 → 落盘缓存；验签失败不落盘（拒绝写入，记录来源与哈希） */
function pullImage(row: SandboxImage) {
  if (pulling.value) return;
  pulling.value = row.id;
  pullPct.value = 0;
  timer.value = window.setInterval(() => {
    pullPct.value = Math.min(100, pullPct.value + 25);
    if (pullPct.value < 100) return;
    if (timer.value !== null) window.clearInterval(timer.value);
    timer.value = null;
    pulling.value = '';
    if (!row.signatureValid) {
      pullPct.value = 0;
      MessagePlugin.error(`拉取被拒绝：${row.name}:${row.tag} 签名校验失败（不落盘、不缓存；来源与哈希已记录并告警）`);
      return;
    }
    row.cachedLocally = true;
    row.cacheBytesMb = row.sizeMb;
    row.lastPulledAt = new Date().toISOString();
    row.lastVerifiedAt = new Date().toISOString();
    MessagePlugin.success(`拉取并校验完成：${row.name}:${row.tag}（签名有效，缓存 ${row.sizeMb} MB，来源：${privateRegistry.value?.name ?? '组织私仓'}优先生效）`);
  }, 320);
}
/** 清理缓存：引用计数保护 + 不可恢复（需重新拉取） */
function purgeCache(row: SandboxImage) {
  row.cachedLocally = false;
  row.cacheBytesMb = 0;
  MessagePlugin.success(`已清理 ${row.name}:${row.tag} 的本地缓存 ${row.sizeMb} MB（不可恢复，下次使用需重新拉取）`);
}
function exportImages() {
  downloadJson({ totalCacheMb: totalCacheMb.value, images: images.value, refCounts, registry: privateRegistry.value?.name }, 'sandbox-images.json');
  MessagePlugin.success('镜像清单与缓存占用已导出（JSON）');
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = images.value.length ? (isEdge.value ? 'EDGE_DATA' : 'NORMAL') : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}
onMounted(load);
onUnmounted(() => {
  // 离开页面时清理拉取进度定时器：避免残留无归属定时器
  if (timer.value !== null) window.clearInterval(timer.value);
  timer.value = null;
});
</script>

<template>
  <div class="oc-page">
    <PageHeader title="沙箱镜像" volume="卷 28" manifest="D-03" cli="oc image pull oc-sandbox-l1:2.9.1 --verify-signature"
      desc="预置镜像（tag / 来源 / 签名校验 / 缓存字节 / 最近使用 / 可清理）+ 拉取并校验 + 缓存清理（引用计数保护）；默认私仓优先。"
      :status="[{ label: '私仓优先', theme: 'primary' }, { label: '验签失败拒绝拉取', theme: 'danger' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportImages"><OcIcon name="download" size="12px" /> 导出清单</Button>
        <Button size="small" variant="outline" @click="load"><OcIcon name="refresh" size="12px" /> 刷新</Button>
      </template>
    </PageHeader>
    <StateShell :state="state" :page-size="pageSize" trace-id="trace-images-3a95f0" empty-title="没有预置镜像" empty-action="刷新列表"
      :collapsed-summary="`共 ${images.length} 个镜像，已折叠展示前 ${pageSize} 条（加载更多不静默截断）`"
      empty-desc="沙箱启动需要镜像；air-gapped 环境请先在「离线分发」导入介质包，再执行拉取并校验。"
      example-task="拉取 oc-sandbox-l1:2.9.1 并校验签名（含 L0+ 备用）"
      what="镜像清单加载失败" why="私仓索引不可达且本地镜像缓存目录不可读（无法确认缓存与签名状态）"
      how="可重试；不可达时已缓存镜像仍可使用，未缓存镜像的拉取会显式失败（不静默降级）"
      @retry="load" @load-more="pageSize = images.length; state = 'NORMAL'" @empty-action="load">
      <div class="oc-grid oc-grid--4">
        <StatCard label="缓存总计" :value="totalCacheMb" unit="MB" :lower-is-better="true" icon="database" :trend="cacheTrend" hint="近 7 天趋势（末端为当前）" />
        <StatCard label="可清理" :value="purgeableMb" unit="MB" :lower-is-better="true" icon="delete" hint="引用计数为 0 且可清理的镜像" />
        <StatCard label="验签失败" :value="images.filter((i) => !i.signatureValid).length" unit="个" :target="0" target-kind="max" icon="error" hint="拒绝拉取（供应链阻断）" />
        <StatCard label="未缓存" :value="images.filter((i) => !i.cachedLocally).length" unit="个" icon="cloud" hint="首次使用需拉取（L3 按需不落盘）" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">预置镜像（缓存字节 / 最近使用 / 可清理）</div>
        <Table :data="visible" row-key="id" size="small" style="margin-top: 8px" :columns="[
          { colKey: 'name', title: '镜像', width: 260 }, { colKey: 'tier', title: '沙箱档', width: 90 },
          { colKey: 'signatureValid', title: '签名校验', width: 120 }, { colKey: 'cacheBytesMb', title: '缓存字节', width: 120 },
          { colKey: 'lastPulledAt', title: '最近使用', width: 150 }, { colKey: 'purgeable', title: '可清理', width: 150 },
          { colKey: 'action', title: '操作', width: 210 }]">
          <template #name="{ row }">
            <span class="oc-mono">{{ row.name }}:{{ row.tag }}</span>
            <div class="oc-muted" style="font-size: 11px">来源：{{ privateRegistry?.name ?? '组织私仓' }}优先 · digest {{ String(row.digest).slice(0, 18) }}…</div>
          </template>
          <template #tier="{ row }"><Tag size="small" variant="light-outline">{{ row.tier }}</Tag></template>
          <template #signatureValid="{ row }">
            <Tag size="small" :theme="row.signatureValid ? 'success' : 'danger'" variant="light-outline">{{ row.signatureValid ? '有效' : '失败' }}</Tag>
            <div v-if="!row.signatureValid" class="oc-muted" style="font-size: 11px">{{ row.note }}</div>
          </template>
          <template #cacheBytesMb="{ row }"><span class="oc-mono">{{ row.cachedLocally ? `${row.cacheBytesMb} MB` : '未缓存' }}</span></template>
          <template #lastPulledAt="{ row }">{{ new Date(row.lastPulledAt).toLocaleDateString('zh-CN') }}</template>
          <template #purgeable="{ row }">
            <Tag v-if="refOf(row.id) > 0" size="small" theme="warning" variant="light-outline">引用中（{{ refOf(row.id) }}）</Tag>
            <Tag v-else-if="!row.purgeable" size="small" theme="default" variant="light-outline">不可清理</Tag>
            <Tag v-else size="small" theme="success" variant="light-outline">可清理</Tag>
          </template>
          <template #action="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <Button size="small" variant="outline" :loading="pulling === row.id" @click="pullImage(row)">
                {{ pulling === row.id ? `校验中 ${pullPct}%` : '拉取并校验' }}
              </Button>
              <Popconfirm v-if="canPurge(row)" @confirm="purgeCache(row)"
                :content="`清理 ${row.name}:${row.tag} 的本地缓存 ${row.cacheBytesMb} MB：清理后不可恢复，下次使用需重新拉取（约 ${Math.max(1, Math.round(row.sizeMb / 120))} 分钟）。引用计数保护：被运行中沙箱 / 任务引用的镜像不可清理。是否继续？`">
                <Button size="small" theme="danger" variant="text">清理缓存</Button>
              </Popconfirm>
              <Tooltip v-else :content="row.cachedLocally ? `引用计数 ${refOf(row.id)}（运行中沙箱 / 任务在用）：清理受保护` : row.note || '未缓存，无需清理'">
                <Button size="small" theme="danger" variant="text" disabled>清理缓存</Button>
              </Tooltip>
            </div>
          </template>
        </Table>
        <div v-if="isEdge" class="oc-state__hint">EDGE_DATA：共 {{ images.length }} 条，仅渲染前 {{ pageSize }} 条；「加载更多」不静默截断。</div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">缓存字节趋势（近 7 天）</div>
          <OcChart type="area" :series="trendSeries" :height="170" format="number" unit="MB" aria-label="沙箱镜像缓存占用趋势" />
          <div class="oc-muted" style="font-size: 12px">清理仅释放本地缓存，不回写私仓；私仓镜像与离线介质包不受影响。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">私仓优先与来源说明</div>
          <div class="oc-stack" style="font-size: 12px">
            <div>① 拉取顺序：组织私仓（{{ privateRegistry?.name }}，{{ privateRegistry?.syncStatus }}，{{ privateRegistry?.itemCount }} 个制品）→ 公共源 → 离线介质包。</div>
            <div>② 私仓命中即用，公共源仅回退；回退时标注「降级拉取」来源，不静默替换。</div>
            <div>③ 策略禁用公共源（publicDisabled）时，私仓不可用将显式报错 REGISTRY_UNAVAILABLE，拒绝静默回退。</div>
            <div>④ 所有镜像必须验签后才落盘；L3 微虚拟机镜像按需拉取且不保留本地缓存。</div>
          </div>
          <CliHint command="oc image pull oc-sandbox-l2:2.9.0 --registry internal --verify-signature" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
