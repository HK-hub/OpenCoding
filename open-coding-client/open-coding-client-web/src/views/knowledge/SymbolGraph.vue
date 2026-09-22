<script setup lang="ts">
/**
 * W-08 符号与结构图：符号级信息 + 导入/调用/继承/依赖边 SVG + 模块摘要。
 * 用途：回答「谁调用我、改这里会影响谁」；符号级信息来自 AST 切分，边来自结构图索引（卷 11 D-KB-5）。
 * 溯源：卷 11 D-KB-5 / BUILD-MANIFEST W-08
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.knowledge;

const state = ref<UiStateKind>('LOADING');
const keyword = ref('');
const edgeFilter = ref('all');
const selected = ref('AgentLoop');
const visible = ref(12);

/** 符号清单：从块的结构化信息展开（同一块可含多个符号） */
const symbols = computed(() =>
  data.chunks
    .flatMap((c) => c.symbols.map((s) => ({ ...s, chunkId: c.chunkId, docPath: c.docPath, strategy: c.strategy, tokens: c.tokens })))
    .filter((s) => !keyword.value || `${s.name}${s.docPath}`.toLowerCase().includes(keyword.value.toLowerCase())),
);

const EDGE_TYPES = ['调用', '导入', '继承', '依赖'] as const;

/** 结构边（mock 结构图）：from → to，附类型与依据 */
const EDGES = [
  { from: 'AgentLoop', to: 'LoopStrategy', type: '依赖', note: '构造注入策略（strategy 可插拔）' },
  { from: 'AgentLoop', to: 'SubAgentPolicy', type: '调用', note: '派生前校验权限收窄' },
  { from: 'SubAgentPolicy', to: 'PermissionCeiling', type: '依赖', note: '读取父权限上限' },
  { from: 'ModelAdapterRegistry', to: 'ModelAdapter', type: '导入', note: 'SPI 接口实现注册' },
  { from: 'ContextSnapshotService', to: 'MemoryRecallService', type: '调用', note: '装配 S4 区段' },
  { from: 'MemoryRecallService', to: 'MemoryStoreSPI', type: '依赖', note: '召回后端可替换' },
  { from: 'KnowledgeQueryService', to: 'IndexStore', type: '调用', note: '三路召回统一入口' },
  { from: 'SymbolGraphIndex', to: 'IndexStore', type: '继承', note: '图索引继承边表实现' },
  { from: 'SessionService', to: 'AgentLoop', type: '调用', note: 'Turn 生命周期驱动' },
  { from: 'OcMemoryEntry', to: 'MemoryStoreSPI', type: '依赖', note: '实体由 store 持久化' },
];

const edges = computed(() => EDGES.filter((e) => edgeFilter.value === 'all' || e.type === edgeFilter.value));
const focusEdges = computed(() => EDGES.filter((e) => e.from === selected.value || e.to === selected.value));

/** 环形布局：把与焦点符号相关的节点摆到圆周上（零依赖 SVG） */
const graph = computed(() => {
  const nodes = new Set<string>([selected.value]);
  focusEdges.value.forEach((e) => {
    nodes.add(e.from);
    nodes.add(e.to);
  });
  const list = [...nodes];
  const cx = 320;
  const cy = 150;
  const r = 108;
  const placed = list.map((n, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, list.length)) * Math.PI * 2;
    return { name: n, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), focus: n === selected.value };
  });
  const links = focusEdges.value.map((e) => {
    const a = placed.find((p) => p.name === e.from);
    const b = placed.find((p) => p.name === e.to);
    return { ...e, x1: a?.x ?? cx, y1: a?.y ?? cy, x2: b?.x ?? cx, y2: b?.y ?? cy };
  });
  return { placed, links, cx, cy };
});

const EDGE_COLOR: Record<string, string> = { 调用: '#0052d9', 导入: '#2ba471', 继承: '#8e5ee5', 依赖: '#e37318' };

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '边界数据', value: 'EDGE_DATA' },
];

function symbolKindTheme(k: string) {
  return k === '类' ? 'primary' : k === '接口' ? 'success' : k === '方法' || k === '函数' ? 'warning' : 'default';
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="符号与结构图"
      desc="符号级检索与结构边（导入/调用/继承/依赖）：回答「谁调用我、改这里会影响谁」，并给出模块摘要。"
      volume="卷 11"
      manifest="W-08"
      cli="oc kb symbol graph --focus AgentLoop --depth 1"
      :status="[{ label: 'AST 切分', theme: 'primary' }, { label: '符号图索引', theme: 'success' }]"
    >
      <template #actions>
        <Input v-model="keyword" size="small" style="width: 220px" placeholder="搜索符号名 / 文件" clearable>
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="edgeFilter" size="small" style="width: 120px" :options="[{ label: '全部边', value: 'all' }, ...EDGE_TYPES.map((t) => ({ label: t, value: t }))]" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="符号总数" :value="symbols.length" unit="个" icon="code" hint="来自 AST 切分（类/接口/方法/常量/枚举）" />
      <StatCard label="结构边" :value="EDGES.length" unit="条" icon="sitemap" hint="导入 / 调用 / 继承 / 依赖四类" />
      <StatCard label="图索引就绪度" :value="62" unit="%" icon="layers" hint="重建中：符号路召回暂按降级标注" />
      <StatCard label="焦点符号" :value="selected" format="raw" icon="lightbulb" hint="点击节点或表格行切换焦点" />
    </div>

    <StateShell
      :state="state"
      stage="构建符号与结构图…"
      empty-title="没有符号信息"
      empty-desc="符号级信息需索引完成后生成；未索引的仓库只能做文件级检索。"
      empty-action="触发索引"
      example-task="查询 AgentLoop 的调用方与依赖"
      what="符号图加载失败"
      why="符号图索引重建中或图存储不可读（边表缺失）。"
      how="可重试；重建期间检索会自动标注「符号路降级」，不影响全文与向量路。"
      trace-id="trace-sym-1c74f3"
      :collapsed-summary="`共 ${symbols.length} 个符号，超出渲染阈值已折叠（按符号名过滤可缩小范围）`"
      :page-size="visible"
      @retry="state = 'NORMAL'"
      @load-more="visible += 8"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            结构图（焦点：{{ selected }}）
            <span class="oc-muted" style="font-size: 12px">点击节点切换焦点</span>
          </h3>
          <svg viewBox="0 0 640 300" style="width: 100%; height: 300px" role="img" aria-label="符号结构图">
            <line
              v-for="(l, i) in graph.links"
              :key="i"
              :x1="l.x1"
              :y1="l.y1"
              :x2="l.x2"
              :y2="l.y2"
              :stroke="EDGE_COLOR[l.type]"
              stroke-width="1.6"
              stroke-dasharray="4 3"
            />
            <text
              v-for="(l, i) in graph.links"
              :key="`t${i}`"
              :x="(l.x1 + l.x2) / 2"
              :y="(l.y1 + l.y2) / 2 - 3"
              font-size="10"
              text-anchor="middle"
              :fill="EDGE_COLOR[l.type]"
            >
              {{ l.type }}
            </text>
            <g v-for="p in graph.placed" :key="p.name" style="cursor: pointer" @click="selected = p.name">
              <circle :cx="p.x" :cy="p.y" :r="p.focus ? 26 : 20" :fill="p.focus ? '#0052d9' : '#eef3ff'" :stroke="p.focus ? '#0052d9' : '#9db8e8'" />
              <text :x="p.x" :y="p.y + 3" font-size="8" text-anchor="middle" :fill="p.focus ? '#fff' : '#2b3a55'">
                {{ p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name }}
              </text>
            </g>
          </svg>
          <div class="oc-flex oc-flex--wrap" style="gap: 10px; font-size: 12px">
            <span v-for="(c, t) in EDGE_COLOR" :key="t" class="oc-flex" style="gap: 4px">
              <i :style="{ background: c, width: '10px', height: '2px', display: 'inline-block' }" />{{ t }}
            </span>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">模块摘要</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'focus', label: '焦点符号', value: selected, mono: true },
              { key: 'in', label: '入边（谁依赖我）', value: `${focusEdges.filter((e) => e.to === selected).length} 条`, hint: '改动前的影响面' },
              { key: 'out', label: '出边（我依赖谁）', value: `${focusEdges.filter((e) => e.from === selected).length} 条`, hint: '改动时需同步核对的被依赖方' },
              { key: 'module', label: '所属模块', value: 'core-agent（纯 Java，零 Spring 依赖）' },
              { key: 'risk', label: '变更风险', value: '入边 ≥ 3 且跨模块 → 建议先跑 L1/L2 验证并通知入边负责人' },
            ]"
          />
          <div class="oc-divider" />
          <div class="oc-stack">
            <div v-for="e in focusEdges" :key="`${e.from}-${e.to}`" class="oc-flex" style="gap: 6px; font-size: 12px">
              <Tag size="small" :theme="e.type === '调用' ? 'primary' : e.type === '导入' ? 'success' : e.type === '继承' ? 'warning' : 'default'" variant="light-outline">{{ e.type }}</Tag>
              <span class="oc-mono">{{ e.from }} → {{ e.to }}</span>
              <span class="oc-muted">{{ e.note }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          符号清单（已渲染 {{ Math.min(visible, symbols.length) }} / {{ symbols.length }}）
          <span class="oc-muted" style="font-size: 12px">点击行可将该符号设为图焦点</span>
        </h3>
        <Table
          :data="symbols.slice(0, visible)"
          :columns="[
            { colKey: 'name', title: '符号', width: 240, cell: 'cell' },
            { colKey: 'kind', title: '类型', width: 90, cell: 'cell' },
            { colKey: 'docPath', title: '所在文件', cell: 'cell' },
            { colKey: 'strategy', title: '切分策略', width: 110, cell: 'cell' },
            { colKey: 'tokens', title: '块 token', width: 100, cell: 'cell' },
          ]"
          row-key="name"
          size="small"
          hover
          @row-click="(ctx) => (selected = String(ctx.row.name))"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'name'"><span class="oc-mono">{{ row.name }}</span></template>
            <template v-else-if="col.colKey === 'kind'">
              <Tag size="small" :theme="symbolKindTheme(row.kind)" variant="light-outline">{{ row.kind }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'docPath'">
              <span class="oc-mono oc-truncate" style="max-width: 420px; display: block; font-size: 12px">{{ row.docPath }}</span>
            </template>
            <template v-else-if="col.colKey === 'strategy'">
              <Tag size="small" variant="outline">{{ row.strategy }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'tokens'"><span class="oc-mono">{{ row.tokens }}</span></template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
        <div class="oc-flex" style="justify-content: center; margin-top: 8px">
          <Button v-if="symbols.length > visible" size="small" variant="text" @click="visible += 8">
            加载更多（剩余 {{ symbols.length - visible }} 个）
          </Button>
          <Button size="small" variant="text" @click="keyword = ''">清空过滤（共 {{ symbols.length }} 个符号）</Button>
        </div>
      </div>
    </StateShell>
  </div>
</template>
