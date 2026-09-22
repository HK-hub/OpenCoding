<script setup lang="ts">
/**
 * 覆盖与继承（M-21 / 卷 04 D-PRM-3）：L0 安全护栏 / L1 组织策略 / L2 项目资产 / L3 用户偏好 / L4 会话临时 层级树。
 * 每层标注 overridable / enforced，选中节点展示「为什么这条生效」逐层求值链；L0/L1 强制项被下级放宽时
 * 拒绝并生成 prompt.override.denied 事件（强制项不可被下级放宽）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Table, Tag, Tooltip, Tree } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import type { PageState } from '@/components/gateway/types';
import { OVERRIDE_LAYER_META, modelData } from '@/mock/data/model';
import type { OverrideLayerId } from '@/mock/data/model';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { overrideLayers, nonOverridableKeys } = modelData;
const state = ref<PageState>('LOADING');
const pageSize = ref(4);
const deniedOpen = ref(false); const activeKey = ref('cross_tenant_read');
const err = ref(makeError('PERMISSION_DENIED', '层级树读取被拒绝（缺少 prompt.read 权限点）'));

/** 树节点：层级为父节点、策略项为子节点，overridable / enforced 直接标注在节点上 */
type LayerNode = { value: string; label: string; overridable: boolean; enforced: boolean; note: string; children?: LayerNode[] };
/** L0 安全护栏与 L1 组织策略属固定层：下级放宽请求一律拒绝并留痕 */
const FIXED_LAYERS: OverrideLayerId[] = ['L0', 'L1'];

const treeData = computed<LayerNode[]>(() =>
  overrideLayers.map((l) => ({
    value: l.layer, label: `${l.layer} · ${l.name}`, overridable: !FIXED_LAYERS.includes(l.layer), enforced: l.items.some((i) => i.enforced), note: OVERRIDE_LAYER_META[l.layer].overridable,
    children: l.items.map((i) => ({ value: i.key, label: i.label, overridable: !FIXED_LAYERS.includes(l.layer) && !i.enforced, enforced: i.enforced, note: i.requestedValue })),
  })),
);
const allItems = computed(() => overrideLayers.flatMap((l) => l.items));
const activeItem = computed(() => allItems.value.find((i) => i.key === activeKey.value) ?? allItems.value[0]);
const activeMeta = computed(() => OVERRIDE_LAYER_META[activeItem.value?.effectiveLayer ?? 'L0']);
const enforcedCount = computed(() => allItems.value.filter((i) => i.enforced).length);
const deniedCount = computed(() => allItems.value.reduce((a, i) => a + i.resolution.filter((s) => s.action === 'denied').length, 0));
const shownKeys = computed(() => nonOverridableKeys.slice(0, pageSize.value));
/** 点击树节点：层级节点落到该层首个策略项，策略项节点直接定位 */
function selectNode(value: string) {
  const layer = overrideLayers.find((l) => l.layer === value);
  activeKey.value = layer?.items[0]?.key ?? value;
}

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = overrideLayers.length === 0 ? 'EMPTY' : nonOverridableKeys.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL'; }, 240);
}
onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="覆盖与继承"
      desc="五层求值：L0 安全护栏 → L1 组织策略 → L2 项目资产 → L3 用户偏好 → L4 会话临时。冲突时「拒绝优先 + 具体覆盖宽泛」，L0/L1 强制项不可被下级放宽。"
      volume="卷 04"
      manifest="M-21"
      cli="oc prompt override explain --key cross_tenant_read --layer L4"
      :status="[{ label: `不可覆盖 ${nonOverridableKeys.length} 项`, theme: 'danger' }, { label: `拒绝事件 ${deniedCount} 起`, theme: deniedCount ? 'warning' : 'success' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" theme="danger" variant="outline" @click="deniedOpen = true">演示覆盖 L0/L1</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="层级数" :value="overrideLayers.length" format="raw" icon="layers" hint="L0 约束力最高；L4 优先级最高但不越过 L0/L1 强制项" />
      <StatCard label="强制项（enforced）" :value="enforcedCount" format="raw" icon="lock" hint="被覆盖时在求值阶段直接拒绝（先于执行）" />
      <StatCard label="不可覆盖项" :value="nonOverridableKeys.length" format="raw" icon="close" hint="含 L0 三类护栏与 L1 合规项" />
      <StatCard label="覆盖拒绝事件" :value="deniedCount" format="raw" icon="error" hint="拒绝尝试同样写入安全事件（含来源与策略版本）" />
    </div>
    <StateShell
      :state="state"
      empty-title="层级树为空"
      empty-desc="未加载到任何层级（异常态：L0–L4 应始终存在，缺少层级会导致求值无依据）。"
      empty-action="重新加载层级树"
      example-task="解释「数据外发与驻留」为何命中 L1 强制项"
      :what="'层级树读取失败'"
      :why="err.message"
      how="读取失败时保持上次成功的层级快照（fail-safe）：不放宽任何约束，覆盖请求继续被拒绝。"
      :trace-id="err.traceId"
      missing-permission="prompt.read" risk-level="R1"
      apply-path="在「权限与审批 → 申请授权」申请 prompt.read（只读，不含修改层级）"
      :collapsed-summary="`不可覆盖清单共 ${nonOverridableKeys.length} 项，已折叠展示前 ${pageSize} 项`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 1"
      @empty-action="refresh()"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">层级树（点击节点查看求值链）</div>
          <Tree :data="treeData" expand-all hover>
            <template #label="{ node }">
              <span v-if="node.data" class="oc-flex oc-flex--wrap" style="gap: 6px; cursor: pointer" @click="selectNode(node.data.value as string)">
                <b style="font-size: 13px">{{ node.data.label }}</b>
                <Tooltip :content="node.data?.note as string">
                  <Tag size="small" variant="light-outline" :theme="node.data?.overridable ? 'success' : 'danger'">{{ node.data?.overridable ? '可覆盖 overridable' : '不可覆盖' }}</Tag>
                </Tooltip>
                <Tag size="small" variant="light-outline" :theme="node.data?.enforced ? 'warning' : 'default'">{{ node.data?.enforced ? '强制 enforced' : '非强制' }}</Tag>
              </span>
            </template>
          </Tree>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">
            「为什么这条生效」求值链
            <CopyableId v-if="activeItem" :id="`override:${activeItem.key}`" label="复制求值引用" />
          </div>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'target', label: '求值对象', value: `${activeItem?.label ?? '—'}（${activeItem?.key ?? '—'}）` }, { key: 'req', label: '下级请求值', value: activeItem?.requestedValue ?? '—' },
              { key: 'eff', label: '最终生效值', value: activeItem?.effectiveValue ?? '—' },
              { key: 'layer', label: '胜出层', value: `${activeItem?.effectiveLayer ?? '—'} · ${activeMeta.name}`, tag: { text: activeItem?.enforced ? '强制项成立' : '非强制项', theme: activeItem?.enforced ? 'danger' : 'default' } },
            ]"
          />
          <div class="oc-divider" />
          <div v-for="s in activeItem?.resolution ?? []" :key="`${s.layer}-${s.assetId}-${s.action}`" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
            <Tag size="small" variant="light-outline" :theme="s.action === 'applied' ? 'success' : s.action === 'denied' ? 'danger' : 'warning'">{{ s.layer }} · {{ s.action === 'applied' ? '生效' : s.action === 'denied' ? '拒绝' : '被覆盖' }}</Tag>
            <span class="oc-mono oc-muted" style="font-size: 12px">{{ s.assetId }}</span>
            <span style="font-size: 13px">{{ s.note }}</span>
          </div>
          <div class="oc-secondary" style="font-size: 12px">胜出层 {{ activeItem?.effectiveLayer }}（{{ activeMeta.overridable }}）：{{ activeItem?.enforced ? '强制项不可被下级放宽，拒绝优先于一切下级声明。' : '非强制项，上级更具体的声明可收窄本级取值。' }}</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">不可覆盖清单（{{ nonOverridableKeys.length }} 项）</div>
        <Table
          row-key="key"
          size="small"
          :data="shownKeys"
          :columns="[
            { colKey: 'key', title: '策略键', width: 190 },
            { colKey: 'label', title: '项', width: 190 },
            { colKey: 'layer', title: '所属层', width: 100 },
            { colKey: 'reason', title: '不可覆盖原因', ellipsis: true },
          ]"
        >
          <template #key="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.key }}</span></template>
          <template #layer="{ row }"><Tag size="small" variant="light-outline" :theme="row.layer === 'L0' ? 'danger' : 'warning'">{{ row.layer }}</Tag></template>
        </Table>
        <CliHint command="oc prompt override list --non-overridable" label="列出全部不可覆盖项" />
      </div>
    </StateShell>

    <Dialog v-model:visible="deniedOpen" header="覆盖被拒绝：prompt.override.denied" width="640px" :footer="false">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag size="small" theme="danger" variant="light-outline">事件 prompt.override.denied</Tag>
          <Tag size="small" theme="warning" variant="light-outline">原因码 OVERRIDE_DENIED_ENFORCED_LAYER</Tag>
          <CopyableId id="trace-a41c9f2e" label="复制 traceId" />
        </div>
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'attempt', label: '覆盖尝试', value: 'L4 会话临时指令请求放行「跨租户读取」' }, { key: 'layer', label: '命中的强制层', value: 'L0 安全护栏 · 越权防护（enforced: true，不可被任何层级覆盖）' },
            { key: 'code', label: '原因码', value: 'OVERRIDE_DENIED_ENFORCED_LAYER（强制层被下级放宽）', mono: true }, { key: 'action', label: '处置', value: '拒绝覆盖请求 + 生成安全事件 + 保留原始有效值' },
            { key: 'ref', label: '策略引用', value: 'frag-security-boundary@2.4.0 · 越权先拒绝，不做「先执行后请示」' },
          ]"
        />
        <div class="oc-secondary" style="font-size: 12px">演示结论：强制项（enforced）不可被下级放宽——拒绝发生在求值阶段（先于任何执行），不提供旁路；拒绝尝试本身也写入审计（含来源、策略版本与 traceId）。</div>
        <CliHint command="oc prompt override explain --key cross_tenant_read --layer L4" label="查看等价解释命令" />
      </div>
    </Dialog>
  </div>
</template>
