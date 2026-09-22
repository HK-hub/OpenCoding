<script setup lang="ts">
/**
 * 工作对象树（J-08）：Goal→Plan→Task→Step 递归分解，可折叠 + 懒加载模拟 + 10k 节点提示。
 * 溯源：卷 14 §4.1 统一工作对象模型（同源模型、可递归分解；树 10k 节点分页懒加载）。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Tag, Tree } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { LEVEL_META, STATUS_META, taskData } from '@/mock/data/task';
import type { WorkItem, WorkItemLevel, WorkItemStatus } from '@/mock/data/task';

const ui = useUiStore();
const router = useRouter();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const keyword = ref('');
const expanded = ref<(string | number)[]>(['G-1a20']);
const selected = ref<WorkItem>(taskData.workItems[0]);
const loadingNodeId = ref('');
const archivedLoaded = ref(false);

const totalNodes = 10_284;
const VIRTUALIZE_THRESHOLD = 10_000;

interface TreeNodeData {
  value: string;
  label: string;
  children?: TreeNodeData[];
  shortId: string;
  level: WorkItemLevel;
  status: WorkItemStatus;
  progress: number;
  /** 懒加载占位（展开时才取子节点） */
  lazy?: boolean;
  childCount?: number;
}

function toNode(i: WorkItem, lazyChildren = false): TreeNodeData {
  const kids = taskData.workItems.filter((x) => x.parentId === i.itemId);
  const node: TreeNodeData = {
    value: i.itemId, label: `${i.shortId} ${i.title}`, shortId: i.shortId, level: i.level, status: i.status, progress: i.progress,
  };
  if (kids.length && !lazyChildren) node.children = kids.map((k) => toNode(k, k.children.length > 0));
  if (kids.length && lazyChildren) { node.lazy = true; node.childCount = kids.length; }
  return node;
}

const treeData = ref<TreeNodeData[]>(
  taskData.workItems.filter((i) => !i.parentId).map((i) => toNode(i, false)),
);

/** 懒加载模拟：展开时按需取子节点（避免一次性传输 10k 节点） */
function loadChildren(parentId: string) {
  loadingNodeId.value = parentId;
  window.setTimeout(() => {
    const patch = (nodes: TreeNodeData[]): TreeNodeData[] => nodes.map((n) => {
      if (n.value === parentId) {
        const item = taskData.workItems.find((x) => x.itemId === parentId);
        const kids = taskData.workItems.filter((x) => x.parentId === parentId);
        return { ...n, lazy: false, childCount: undefined, children: kids.map((k) => (item ? toNode(k, taskData.workItems.some((s) => s.parentId === k.itemId)) : toNode(k, false))) };
      }
      return n.children ? { ...n, children: patch(n.children) } : n;
    });
    treeData.value = patch(treeData.value);
    loadingNodeId.value = '';
  }, 320);
}

watch(expanded, (vals) => {
  // 展开集合变化时，把所有新暴露的懒加载节点都排队取回（「展开三层」一次展开多节点时不遗漏）
  const flat: TreeNodeData[] = [];
  const walk = (nodes: TreeNodeData[]) => nodes.forEach((n) => { flat.push(n); if (n.children) walk(n.children); });
  walk(treeData.value);
  vals.map(String).forEach((id) => {
    const hit = flat.find((n) => n.value === id);
    if (hit?.lazy) loadChildren(id);
  });
});

/** 展开三层：Goal / Plan 节点全部展开（Task 层可见），更深层保持懒加载按需取回 */
function expandThreeLevels() {
  const values: string[] = [];
  const walk = (nodes: TreeNodeData[], depth: number) => {
    nodes.forEach((n) => {
      if (n.children?.length || n.lazy) values.push(n.value);
      if (n.children && depth < 2) walk(n.children, depth + 1);
    });
  };
  walk(treeData.value, 1);
  expanded.value = values;
  MessagePlugin.info(`已展开到第 3 层：本次展开 ${values.length} 个节点，更深层按需加载`);
}

/** 打开任务详情：跳转同源对象详情页（真实路由 /task/detail?workItem= 短 ID） */
function openTaskDetail() {
  router.push({ path: '/task/detail', query: { workItem: filteredSelected.value.shortId } });
}

/** 空态引导：跳转目标创建向导（真实路由 /goal/create） */
function openGoalWizard() {
  router.push('/goal/create');
}

const filteredSelected = computed(() => selected.value);
const stats = computed(() => {
  const byLevel = (l: WorkItemLevel) => taskData.workItems.filter((i) => i.level === l).length;
  return { goal: byLevel('goal'), plan: byLevel('plan'), task: byLevel('task'), step: byLevel('step') };
});

function onNodeClick(ctx: { node: { data: Record<string, unknown> }; e?: MouseEvent }) {
  const hit = taskData.workItems.find((i) => i.itemId === String(ctx.node.data?.value));
  if (hit) selected.value = hit;
}

function loadArchived() {
  archivedLoaded.value = true;
  expanded.value = [...expanded.value, 'archive-1'];
  state.value = 'EDGE_DATA';
}

onMounted(() => {
  window.setTimeout(() => { state.value = treeData.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工作对象树" volume="卷 14" manifest="J-08" cli="oc task list --tree --depth 3 --lazy"
      desc="Goal→Plan→Task→Step 四层同源模型：一处建模、多视图呈现。树超过 10,000 节点时启用分页懒加载（虚拟渲染阈值），展开才取子节点。"
      :status="[{ label: `${totalNodes.toLocaleString('zh-CN')} 节点`, theme: 'primary' }, { label: '懒加载开启', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="expanded = ['G-1a20']">收起全部</Button>
        <Button size="small" variant="outline" @click="expandThreeLevels">展开三层</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
        <Input v-model="keyword" size="small" placeholder="过滤工作对象（短 ID / 标题 / 标签）" clearable style="max-width: 300px" />
        <Tag size="small" variant="outline">Goal {{ stats.goal }}</Tag>
        <Tag size="small" variant="outline">Plan {{ stats.plan }}</Tag>
        <Tag size="small" variant="outline">Task {{ stats.task }}</Tag>
        <Tag size="small" variant="outline">Step {{ stats.step }}</Tag>
        <Tag v-if="totalNodes > VIRTUALIZE_THRESHOLD" size="small" theme="warning" variant="light-outline">
          超过虚拟渲染阈值 {{ VIRTUALIZE_THRESHOLD }}，已分页懒加载
        </Tag>
      </div>
    </div>

    <StateShell
      :state="state" :page-size="60"
      collapsed-summary="归档任务（历史 9,000+ 节点）已折叠，展开将按页加载而不是一次渲染。"
      empty-title="工作对象树为空" empty-desc="项目尚未创建 Goal/Plan/Task。" empty-action="创建目标"
      example-task="创建 Goal「支付链路口径统一」后由 AI 分解"
      what="树加载失败" why="节点数超过单次传输上限（10,284 > 10,000），首屏请求被分页保护拒绝"
      how="已回退为前 500 节点 + 懒加载；可点「加载更多」逐页拉取" trace-id="trace-6f2ad813"
      @retry="state = 'LOADING'" @load-more="loadArchived" @empty-action="openGoalWizard"
    >
      <div class="oc-grid" style="grid-template-columns: minmax(0, 1fr) 320px; gap: 10px">
        <div class="oc-card">
          <Tree
            :data="treeData" :expanded="expanded" activable :keys="{ value: 'value', label: 'label', children: 'children' }"
            :transition="false" @click="onNodeClick" @update:expanded="(v: (string | number)[]) => (expanded = v)"
          >
            <template #label="node">
              <span v-if="node.data" class="oc-flex oc-flex--wrap" style="gap: 6px">
                <span class="oc-mono oc-muted" style="font-size: 11px">{{ node.data.shortId }}</span>
                <span style="font-size: 12px">{{ node.data.label }}</span>
                <Tag size="small" variant="outline">{{ LEVEL_META[node.data?.level as WorkItemLevel].label }}</Tag>
                <Tag size="small" :theme="STATUS_META[node.data?.status as WorkItemStatus].theme" variant="light-outline">
                  {{ STATUS_META[node.data?.status as WorkItemStatus].label }}
                </Tag>
                <span class="oc-muted" style="font-size: 11px">{{ node.data?.progress }}%</span>
                <span v-if="node.data?.lazy" class="oc-flex" style="gap: 4px; font-size: 11px">
                  <OcIcon :name="loadingNodeId === node.data?.value ? 'loading' : 'layers'" size="11px" />
                  {{ node.data?.childCount }} 个子节点（懒加载）
                </span>
              </span>
            </template>
          </Tree>

          <div class="oc-divider" />
          <button type="button" class="oc-flex" style="gap: 6px; border: none; background: transparent; cursor: pointer; font-size: 12px" @click="loadArchived">
            <OcIcon name="folder-open" size="13px" />
            <span>{{ archivedLoaded ? '已加载归档页（第 1 页 / 共 180 页）' : '展开归档任务（9,000+ 节点，按页加载）' }}</span>
            <Tag size="small" variant="outline">EDGE_DATA</Tag>
          </button>
        </div>

        <!-- 右侧：选中节点详情（层级导航） -->
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">节点详情</div>
            <InfoGrid :columns="1" :items="[
              { key: 'short', label: '短 ID', value: filteredSelected.shortId, mono: true, copyable: true },
              { key: 'level', label: '层级', value: LEVEL_META[filteredSelected.level].label },
              { key: 'status', label: '状态', value: STATUS_META[filteredSelected.status].label, tag: { text: STATUS_META[filteredSelected.status].label, theme: STATUS_META[filteredSelected.status].theme } },
              { key: 'progress', label: '进度', value: `${filteredSelected.progress}%（证据驱动）` },
              { key: 'assignee', label: '指派', value: filteredSelected.assignee.name },
              { key: 'ws', label: '工作区', value: filteredSelected.workspace, mono: true },
              { key: 'children', label: '直属子节点', value: `${filteredSelected.children.length} 个` },
            ]" />
            <div class="oc-flex" style="gap: 6px; margin-top: 8px">
              <Button size="small" variant="outline" @click="openTaskDetail">打开详情</Button>
              <CliHint :command="`oc task show ${filteredSelected.shortId} --tree`" />
            </div>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">递归分解规则</div>
            <div class="oc-secondary" style="font-size: 12px">
              上级只约束「子项集合 + 依赖 DAG + 里程碑」，不复制子项进度；进度由子项证据聚合。
              Step 由 Agent 在执行中动态细化，无需人工预填。
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
