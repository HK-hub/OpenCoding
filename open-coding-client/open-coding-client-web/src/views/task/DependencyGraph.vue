<script setup lang="ts">
/**
 * 依赖图（J-03）：DAG 分层布局（SVG）+ 关键路径高亮 + 环检测拒绝（给出环路径文案）。
 * 溯源：卷 14 §4.3 依赖与并行（循环依赖建立时检测并拒绝，给出环路径）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { DEP_META, LEVEL_META, STATUS_META, taskData } from '@/mock/data/task';
import type { WorkItem } from '@/mock/data/task';
import { downloadText } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const fromShort = ref('T-0e15');
const toShort = ref('T-9c40');
const rejection = ref<{ path: string[]; reason: string } | null>(null);

const NODE_W = 158;
const NODE_H = 44;
const GAP_X = 62;
const GAP_Y = 18;

/** 图节点：Goal/Plan/Task（Step 归入所属任务，不单独成图） */
const nodes = computed(() => taskData.workItems.filter((i) => i.level !== 'step'));

/** 分层：depth = 从根节点起的最长路径（buildStart 语义，与调度器一致） */
const layout = computed(() => {
  const depth = new Map<string, number>();
  const calc = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id) as number;
    if (seen.has(id)) return 0;
    seen.add(id);
    const item = nodes.value.find((n) => n.itemId === id);
    if (!item || item.dependsOn.length === 0) { depth.set(id, 0); return 0; }
    const d = 1 + Math.max(...item.dependsOn.map((x) => calc(x.targetId, seen)));
    depth.set(id, d);
    return d;
  };
  nodes.value.forEach((n) => calc(n.itemId, new Set()));
  const layers = new Map<number, WorkItem[]>();
  nodes.value.forEach((n) => {
    const d = depth.get(n.itemId) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(n);
  });
  const pos = new Map<string, { x: number; y: number; layer: number }>();
  [...layers.entries()].forEach(([d, arr]) => {
    arr.forEach((n, i) => pos.set(n.itemId, { x: 24 + d * (NODE_W + GAP_X), y: 20 + i * (NODE_H + GAP_Y), layer: d }));
  });
  const maxLayer = Math.max(0, ...[...layers.keys()]);
  const maxRows = Math.max(1, ...[...layers.values()].map((a) => a.length));
  return { pos, width: 24 + (maxLayer + 1) * (NODE_W + GAP_X), height: 40 + maxRows * (NODE_H + GAP_Y) };
});

const edges = computed(() => {
  const out: { id: string; d: string; critical: boolean; kind: string; label: string }[] = [];
  nodes.value.forEach((n) => {
    const to = layout.value.pos.get(n.itemId);
    if (!to) return;
    n.dependsOn.forEach((dep) => {
      const from = layout.value.pos.get(dep.targetId);
      if (!from) return;
      const x1 = from.x + NODE_W;
      const y1 = from.y + NODE_H / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_H / 2;
      const mid = (x1 + x2) / 2;
      out.push({
        id: `${n.shortId}<-${dep.targetShort}`,
        d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`,
        critical: taskData.criticalPath.includes(n.shortId) && taskData.criticalPath.includes(dep.targetShort),
        kind: dep.type,
        label: `${DEP_META[dep.type].label}：${dep.targetShort} → ${n.shortId}`,
      });
    });
  });
  return out;
});

const stats = computed(() => ({
  nodes: nodes.value.length,
  edges: edges.value.length,
  critical: taskData.criticalPath.length,
  rejected: taskData.cycleAttempts.filter((c) => c.rejected).length,
}));

function color(item: WorkItem): string {
  if (taskData.criticalPath.includes(item.shortId)) return 'var(--oc-sev-error, #d54941)';
  if (item.status === 'done') return 'var(--td-success-color, #2ba471)';
  if (item.status === 'blocked') return 'var(--oc-sev-warn, #e37318)';
  return 'var(--td-brand-color, #0052d9)';
}

/** 添加依赖：若目标已是本项的祖先，则构成环，必须拒绝并给出环路径 */
function addDependency() {
  const from = nodes.value.find((n) => n.shortId === fromShort.value);
  const to = nodes.value.find((n) => n.shortId === toShort.value);
  if (!from || !to) return;
  if (from.shortId === to.shortId) {
    rejection.value = { path: [from.shortId, from.shortId], reason: '自依赖非法：任务不能依赖自身。' };
    MessagePlugin.error('自依赖被拒绝');
    return;
  }
  const chain: string[] = [];
  const walk = (cur: WorkItem, seen: Set<string>): boolean => {
    if (cur.shortId === from.shortId) { chain.push(cur.shortId); return true; }
    if (seen.has(cur.shortId)) return false;
    seen.add(cur.shortId);
    for (const d of cur.dependsOn) {
      const next = nodes.value.find((n) => n.shortId === d.targetShort);
      if (next && walk(next, seen)) { chain.unshift(cur.shortId); return true; }
    }
    return false;
  };
  if (walk(to, new Set())) {
    const cycle = [from.shortId, ...chain];
    rejection.value = { path: cycle, reason: `环检测命中：${cycle.join(' → ')}；依赖图必须保持无环，建立被拒绝。` };
    MessagePlugin.error(`依赖被拒绝：检测到环 ${cycle.join(' → ')}`);
    return;
  }
  to.dependsOn.push({ type: 'finish_to_start', targetId: from.itemId, targetShort: from.shortId });
  rejection.value = null;
  MessagePlugin.success(`已建立依赖 ${from.shortId} → ${to.shortId}，关键路径已重算`);
}

/** 导出 DAG：mermaid 源码 + 邻接表，与页面图形同源（nodes / dependsOn / 关键路径） */
function exportDag() {
  // mermaid 节点 ID 只允许字母数字下划线，短号中的连字符需替换（标签仍展示原始短号）
  const mermaidId = (shortId: string) => shortId.replace(/-/g, '_');
  const lines: string[] = ['# 任务依赖 DAG（依赖图导出）', '', '```mermaid', 'graph LR'];
  nodes.value.forEach((n) => lines.push(`  ${mermaidId(n.shortId)}["${n.shortId} ${n.title}"]`));
  nodes.value.forEach((n) => n.dependsOn.forEach((d) => {
    lines.push(`  ${mermaidId(d.targetShort)} -->|${DEP_META[d.type].label}| ${mermaidId(n.shortId)}`);
  }));
  lines.push('```', '', '## 邻接表（前置依赖 → 依赖方）');
  nodes.value.forEach((n) => lines.push(`- ${n.shortId} ${n.title} → ${
    n.dependsOn.length ? n.dependsOn.map((d) => `${d.targetShort}（${DEP_META[d.type].label}）`).join('、') : '无前置依赖'}`));
  lines.push('', `关键路径：${taskData.criticalPath.join(' → ')}`);
  const file = downloadText(lines.join('\n'), `oc-task-dag-${new Date().toISOString().slice(0, 10)}.md`);
  MessagePlugin.success(`DAG 已导出：${file}`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = nodes.value.length ? 'NORMAL' : 'EMPTY'; }, 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="依赖图" volume="卷 14" manifest="J-03" cli="oc task graph --critical-path --check-cycles"
      desc="DAG 分层布局：列=依赖深度、行=同层并行项；红线为关键路径。建立依赖前执行环检测，命中环必须拒绝并给出完整环路径。"
      :status="[{ label: '环检测强制', theme: 'warning' }, { label: '关键路径已高亮', theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportDag">导出 DAG</Button>
        <Button size="small" theme="primary" @click="addDependency">建立依赖</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="节点" :value="stats.nodes" unit="项" icon="sitemap" />
      <StatCard label="依赖边" :value="stats.edges" unit="条" icon="link" />
      <StatCard label="关键路径" :value="stats.critical" unit="项" icon="flag" hint="关键路径决定最短交付时间" />
      <StatCard label="被拒环" :value="stats.rejected" unit="次" icon="error" :lower-is-better="true" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有可绘制的依赖" empty-desc="任务尚未建立依赖关系，或全部为孤立节点。" empty-action="从模板创建任务"
      example-task="回执幂等校验（依赖：持久层唯一约束迁移）"
      what="依赖图构建失败" why="依赖目标引用了不存在的任务 ID（1 条悬空边）"
      how="可重试；或先修复悬空依赖再重算关键路径" trace-id="trace-3a91be07"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('已打开模板库')"
    >
      <div class="oc-card" style="margin-bottom: 10px">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <span class="oc-secondary">新建依赖：</span>
          <Select v-model="fromShort" size="small" style="width: 220px" :options="nodes.map((n) => ({ label: `${n.shortId} ${n.title}`, value: n.shortId }))" />
          <OcIcon name="link" size="14px" />
          <Select v-model="toShort" size="small" style="width: 220px" :options="nodes.map((n) => ({ label: `${n.shortId} ${n.title}`, value: n.shortId }))" />
          <Button size="small" theme="primary" variant="outline" @click="addDependency">环检测并建立</Button>
          <CliHint command="oc task dep add --from T-1b02 --to T-7f3a --type finish_to_start" />
        </div>

        <div v-if="rejection" style="margin-top: 8px" class="oc-card">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
            <b>环检测拒绝</b>
            <Tag size="small" theme="danger" variant="light-outline">依赖图必须无环</Tag>
          </div>
          <pre class="oc-pre" style="margin-top: 6px">{{ rejection.path.join(' → ') }}</pre>
          <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ rejection.reason }}</div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CliHint command="oc task graph --check-cycles --explain" />
            <CopyableId id="trace-3a91be07" label="复制拒绝记录" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="overflow: auto">
        <svg :viewBox="`0 0 ${layout.width} ${layout.height}`" :style="{ minWidth: `${layout.width}px`, height: `${layout.height}px` }" role="img" aria-label="任务依赖 DAG">
          <defs>
            <marker id="dep-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--td-text-color-secondary, #999)" />
            </marker>
            <marker id="dep-arrow-crit" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--oc-sev-error, #d54941)" />
            </marker>
          </defs>

          <path
            v-for="e in edges" :key="e.id" :d="e.d" fill="none"
            :stroke="e.critical ? 'var(--oc-sev-error, #d54941)' : 'var(--oc-border-strong, #bbb)'"
            :stroke-width="e.critical ? 2 : 1.2"
            :stroke-dasharray="e.kind === 'finish_to_start' ? undefined : '5 3'"
            :marker-end="e.critical ? 'url(#dep-arrow-crit)' : 'url(#dep-arrow)'"
          >
            <title>{{ e.label }}</title>
          </path>

          <g v-for="n in nodes" :key="n.itemId">
            <rect
              :x="layout.pos.get(n.itemId)?.x" :y="layout.pos.get(n.itemId)?.y" :width="NODE_W" :height="NODE_H" rx="6"
              :fill="taskData.criticalPath.includes(n.shortId) ? 'rgba(213,73,65,0.08)' : 'var(--td-bg-color-container,#fff)'"
              :stroke="color(n)" :stroke-width="taskData.criticalPath.includes(n.shortId) ? 2 : 1"
            >
              <title>{{ `${n.shortId} ${n.title}\n状态：${STATUS_META[n.status].label}\n层级：${LEVEL_META[n.level].label}\n指派：${n.assignee.name}` }}</title>
            </rect>
            <text :x="(layout.pos.get(n.itemId)?.x ?? 0) + 8" :y="(layout.pos.get(n.itemId)?.y ?? 0) + 17" font-size="11" fill="var(--td-text-color-primary,#181818)">
              {{ n.shortId }} · {{ n.title.slice(0, 12) }}
            </text>
            <text :x="(layout.pos.get(n.itemId)?.x ?? 0) + 8" :y="(layout.pos.get(n.itemId)?.y ?? 0) + 33" font-size="10" fill="var(--td-text-color-secondary,#666)">
              {{ LEVEL_META[n.level].label }} · {{ STATUS_META[n.status].label }} · {{ n.progress }}%
            </text>
          </g>
        </svg>
      </div>

      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
        <Tag size="small" theme="danger" variant="light-outline">红边 = 关键路径</Tag>
        <Tag size="small" variant="light-outline">实线 = 完成后开始</Tag>
        <Tag size="small" variant="light-outline">虚线 = 产物/裁决依赖</Tag>
        <Tooltip v-for="c in taskData.cycleAttempts" :key="c.at" :content="`${c.by} · ${new Date(c.at).toLocaleString('zh-CN')}`">
          <Tag size="small" theme="warning" variant="outline">曾拒绝环：{{ c.path.join(' → ') }}</Tag>
        </Tooltip>
      </div>
    </StateShell>
  </div>
</template>
