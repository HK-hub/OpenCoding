<script setup lang="ts">
/** 工具包市场 / 私仓（T-09）：版本 / 签名 / 权限与资源声明 / 发布者 + 安装卸载。溯源：卷 05 D-TOOL-12 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { ToolBundle } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { bundles } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const sourceFilter = ref('');
const installedOnly = ref(false);
const pageSize = ref(10);
const detail = ref<ToolBundle | null>(null);
const detailOpen = ref(false);
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '私仓同步失败（registry.npm.yunshu.io 超时）'));

const rows = computed(() =>
  bundles
    .filter((b) => !sourceFilter.value || b.source === sourceFilter.value)
    .filter((b) => !installedOnly.value || b.installed),
);
const shown = computed(() => rows.value.slice(0, pageSize.value));
const unsigned = computed(() => bundles.filter((b) => !b.signatureVerified).length);
const declaredPerms = computed(() => new Set(bundles.flatMap((b) => b.declaredPermissions)).size);

const columns = [
  { colKey: 'name', title: '工具包', width: 210 },
  { colKey: 'version', title: '版本 / 签名', width: 150 },
  { colKey: 'publisher', title: '发布者', width: 140 },
  { colKey: 'declaredPermissions', title: '声明权限', width: 230 },
  { colKey: 'tools', title: '含工具 / 风险上限', width: 170 },
  { colKey: 'source', title: '来源', width: 110 },
  { colKey: 'installed', title: '状态', width: 130 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 240);
}

function openDetail(ctx: { row: Record<string, unknown> }) {
  const b = bundles.find((x) => x.bundleId === ctx.row.bundleId) ?? null;
  detail.value = b;
  detailOpen.value = true;
}

function install(b: ToolBundle | null) {
  if (!b) return;
  MessagePlugin.success(`已安装 ${b.name}@${b.version}：声明权限已按最小集收窄（未声明能力不可用）`);
}

function uninstall(b: ToolBundle | null) {
  if (!b) return;
  MessagePlugin.warning(`已卸载 ${b.name}：引用该工具包的宏与技能将失效（可重新安装恢复）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工具包市场与私仓"
      desc="工具包（bundle）可版本化、可签名、可声明权限与资源需求、可市场分发；支持组织私有仓库。安装即授予声明范围内的能力（不隐式扩权）。"
      volume="卷 05"
      manifest="T-09"
      cli="oc tools bundle list --source 私仓 --verify-signature"
      :status="[{ label: `未签名 ${unsigned} 个`, theme: unsigned ? 'warning' : 'success' }, { label: '安装需确认能力声明', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="installedOnly = !installedOnly; refresh()">
          {{ installedOnly ? '显示全部' : '仅看已安装' }}
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="可用工具包" :value="bundles.length" format="raw" icon="extension" />
      <StatCard label="已安装" :value="bundles.filter((b) => b.installed).length" format="raw" icon="check" />
      <StatCard label="未签名（需人工确认）" :value="unsigned" format="raw" icon="secured" hint="未签名包默认不安装，需逐条确认能力声明" />
      <StatCard label="声明权限种类" :value="declaredPerms" format="raw" icon="lock" hint="安装时按声明收窄（不隐式扩权）" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="sourceFilter" size="small" clearable placeholder="来源" style="width: 170px" :options="[{ label: '公共市场', value: '公共市场' }, { label: '组织私仓', value: '组织私仓' }]" @change="refresh" />
      <CliHint command="oc tools bundle install <name>@<version> --dry-run" label="干跑安装计划" />
      <span class="oc-muted" style="font-size: 12px">安装前展示「能力声明 + 资源需求」清单，逐条同意后才生效</span>
    </div>

    <StateShell
      :state="state"
      empty-title="没有匹配的工具包"
      empty-desc="当前筛选条件下无工具包。可切换来源或关闭「仅看已安装」。"
      empty-action="清空筛选"
      example-task="浏览组织私仓中的安全扫描工具包"
      :what="'工具包列表加载失败'"
      :why="err.message"
      how="私仓同步失败时支持离线缓存清单（最后一次成功同步的版本会标注时间）；可重试同步。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 个工具包，已折叠展示前 ${pageSize} 个`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="sourceFilter = ''; installedOnly = false; refresh()"
    >
      <Table row-key="bundleId" size="small" :data="shown" :columns="columns" :hover="true" @row-click="openDetail">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span style="font-weight: 600">{{ row.name }}</span>
            <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.bundleId }} · {{ row.sizeKb }} KB</span>
          </div>
        </template>
        <template #version="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono">{{ row.version }}</span>
            <Tag size="small" variant="light-outline" :theme="row.signatureVerified ? 'success' : 'danger'">
              {{ row.signatureVerified ? '签名有效' : '未签名' }}
            </Tag>
          </div>
        </template>
        <template #declaredPermissions="{ row }">
          <Tag v-for="p in row.declaredPermissions" :key="p" size="small" variant="light-outline" style="margin: 1px">{{ p }}</Tag>
        </template>
        <template #tools="{ row }">
          <span>{{ row.toolCount }} 个</span>
          <RiskBadge :level="row.riskMax" />
        </template>
        <template #source="{ row }">
          <Tooltip :content="row.source === '组织私仓' ? '私仓优先：来源校验通过（org registry）' : '公共源：需签名校验 + 安装后扫描'">
            <Tag size="small" :theme="row.source === '组织私仓' ? 'primary' : 'default'" variant="light-outline">{{ row.source }}</Tag>
          </Tooltip>
        </template>
        <template #installed="{ row }">
          <Tag v-if="row.installed" size="small" theme="success" variant="light-outline">已安装</Tag>
          <Tag v-else size="small" variant="light-outline">未安装</Tag>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="detailOpen" :header="detail?.name ?? '工具包详情'" width="640px" :footer="false">
      <div v-if="detail" class="oc-stack">
        <InfoGrid :columns="2" :items="[
          { key: 'id', label: '包 ID', value: detail.bundleId, copyable: true, mono: true },
          { key: 'version', label: '版本', value: detail.version },
          { key: 'publisher', label: '发布者', value: detail.publisher },
          { key: 'sig', label: '签名', value: `${detail.signature}（${detail.signatureVerified ? '校验通过' : '未通过 / 未签名'}）`, mono: true },
          { key: 'risk', label: '风险上限', value: detail.riskMax },
          { key: 'updated', label: '最近更新', value: new Date(detail.updatedAt).toLocaleString('zh-CN') },
          { key: 'perms', label: '声明权限（逐条）', value: detail.declaredPermissions.join(' / ') },
          { key: 'res', label: '声明资源', value: detail.declaredResources.join(' / ') },
        ]" />
        <div class="oc-card">
          <h3 class="oc-card__title">含工具</h3>
          <Tag v-for="t in detail.tools" :key="t" size="small" variant="light-outline" style="margin: 2px" class="oc-mono">{{ t }}</Tag>
        </div>
        <div class="oc-muted" style="font-size: 12px">
          安装语义：声明权限按最小集授予（未声明能力一律不可用）；未签名包需逐条确认能力声明后放行，且安装后强制扫描。
        </div>
        <div class="oc-flex" style="justify-content: flex-end; gap: 8px">
          <CliHint :command="`oc tools bundle install ${detail.bundleId}@${detail.version}`" label="等价安装命令" />
          <Button v-if="detail.installed" variant="outline" theme="danger" @click="uninstall(detail); detailOpen = false">卸载</Button>
          <Button v-else theme="primary" @click="install(detail); detailOpen = false">安装（确认能力声明）</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
