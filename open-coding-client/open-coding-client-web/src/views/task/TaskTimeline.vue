<script setup lang="ts">
/**
 * 任务时间线（J-02）：成员泳道 × 时间甘特视图，里程碑标记 + 依赖箭头（SVG）+ 关键路径高亮。
 * 溯源：卷 14 §4.6 时间线视图（并行泳道 + 里程碑 + 依赖箭头）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Popconfirm, RadioGroup, RadioButton, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { PRIORITY_META, STATUS_META, taskData } from '@/mock/data/task';
import type { WorkItem } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const windowDays = ref(21);
const paused = ref(false);

const ROW_H = 36;
const BAR_H = 14;

/** 泳道 = 指派对象（成员/团队/人类），时间线只画 Task 与 Step */
const lanes = computed(() => {
  const items = taskData.workItems.filter((i) => i.level === 'task' || i.level === 'step');
  const map = new Map<string, WorkItem[]>();
  items.forEach((i) => {
    const key = i.assignee.name;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(i);
  });
  return [...map.entries()].map(([name, bars]) => ({ name, bars }));
});

const span = computed(() => {
  const all = taskData.workItems.filter((i) => i.startAt);
  const t0 = Math.min(...all.map((i) => new Date(i.startAt as string).getTime()));
  const tEnd = Math.max(...all.map((i) => new Date(i.endAt ?? new Date().toISOString()).getTime()));
  return { t0, t1: Math.max(tEnd, t0 + windowDays.value * 86_400_000) };
});

const totalH = computed(() => lanes.value.length * ROW_H + 20);

function pct(t: number): number {
  const { t0, t1 } = span.value;
  return Math.max(0, Math.min(100, ((t - t0) / Math.max(1, t1 - t0)) * 100));
}

function barOf(item: WorkItem) {
  const s = new Date(item.startAt ?? new Date().toISOString()).getTime();
  const e = new Date(item.endAt ?? new Date().toISOString()).getTime();
  const left = pct(s);
  const width = Math.max(1.2, pct(Math.max(e, s + 3_600_000)) - left);
  return { left, width };
}

function isCritical(item: WorkItem): boolean {
  return taskData.criticalPath.includes(item.shortId);
}

function barColor(item: WorkItem): string {
  if (isCritical(item)) return 'var(--td-error-color, #d54941)';
  if (item.status === 'blocked') return 'var(--oc-sev-warn, #e37318)';
  if (item.status === 'done') return 'var(--td-success-color, #2ba471)';
  if (item.status === 'cancelled') return 'var(--td-text-color-placeholder, #b3b3b3)';
  return 'var(--td-brand-color, #0052d9)';
}

interface Arrow { points: string; critical: boolean }

/** 依赖箭头：从前序条形右端折线连到本项条形左端（跨泳道） */
const arrows = computed<Arrow[]>(() => {
  const out: Arrow[] = [];
  const flat: WorkItem[] = lanes.value.flatMap((l) => l.bars);
  lanes.value.forEach((lane, li) => {
    lane.bars.forEach((item) => {
      item.dependsOn.forEach((d) => {
        const src = flat.find((f) => f.shortId === d.targetShort);
        if (!src) return;
        const si = lanes.value.findIndex((l) => l.bars.includes(src));
        const a = barOf(src);
        const b = barOf(item);
        const x1 = (a.left + a.width) * 10;
        const y1 = si * ROW_H + ROW_H / 2 + 10;
        const x2 = b.left * 10;
        const y2 = li * ROW_H + ROW_H / 2 + 10;
        out.push({ points: `${x1},${y1} ${x1 + 6},${y1} ${x1 + 6},${y2} ${x2},${y2}`, critical: isCritical(item) && isCritical(src) });
      });
    });
  });
  return out;
});

const milestones = computed(() => taskData.milestones.map((m) => ({
  ...m, x: pct(new Date(m.dueAt).getTime()),
})));

function togglePause() {
  paused.value = !paused.value;
}

onMounted(() => {
  window.setTimeout(() => { state.value = lanes.value.length ? 'NORMAL' : 'EMPTY'; }, 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="任务时间线" volume="卷 14" manifest="J-02" cli="oc task timeline --group-by assignee --show-milestones"
      desc="成员泳道 × 时间：每行一名执行者，条形为 Task/Step，红框为关键路径；里程碑以菱形标记，依赖以折线箭头表达（跨泳道可见串行点）。"
      :status="[{ label: paused ? '已暂停（安全点停止）' : '调度中', theme: paused ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="togglePause">
          {{ paused ? '恢复调度' : '暂停调度' }}
        </Button>
        <Popconfirm content="取消调度不会删除任务与已产出证据；进行中的工具调用会在安全点结束后停止。" theme="warning" @confirm="togglePause">
          <Button size="small" theme="danger" variant="outline">安全点取消</Button>
        </Popconfirm>
        <RadioGroup v-model="windowDays" variant="default-filled" size="small">
          <RadioButton :value="14">14 天</RadioButton>
          <RadioButton :value="21">21 天</RadioButton>
          <RadioButton :value="42">42 天</RadioButton>
        </RadioGroup>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有可绘制的时间线条目" empty-desc="任务尚未声明开始时间或全部未进入执行态。" empty-action="从看板认领任务"
      example-task="为 handleRetry 增加幂等校验"
      what="时间线投影失败" why="存在 startAt 缺失的任务（3 项），时间轴无法定位"
      how="可重试；或先在任务详情补齐计划窗口" trace-id="trace-7c02e51b"
      @retry="state = 'LOADING'"
    >
      <div v-if="paused" class="oc-card" style="border-color: var(--oc-sev-warn); margin-bottom: 8px">
        <div class="oc-flex" style="gap: 6px">
          <OcIcon name="time" size="14px" />
          <b>调度已暂停（安全点语义）</b>
          <Tag size="small" theme="warning" variant="light-outline">保留已完成部分与检查点</Tag>
        </div>
        <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
          暂停仅阻止新任务启动；进行中的 Turn 会执行到安全点后落检查点，不会丢失已产生的副作用账本。
        </div>
      </div>

      <div class="oc-card" style="overflow-x: auto">
        <div class="oc-tl" :style="{ minWidth: `${Math.max(720, lanes.length * 60)}px` }">
          <!-- 时间轴表头 -->
          <div class="oc-tl__head">
            <div class="oc-tl__label oc-muted">执行者 / 泳道</div>
            <div class="oc-tl__track">
              <span v-for="d in 7" :key="d" class="oc-tl__tick" :style="{ left: `${(d / 7) * 100}%` }">
                {{ new Date(span.t0 + (d / 7) * (span.t1 - span.t0)).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) }}
              </span>
            </div>
          </div>

          <div v-for="(lane, li) in lanes" :key="lane.name" class="oc-tl__row" :style="{ height: `${ROW_H}px` }">
            <div class="oc-tl__label">
              <OcIcon name="user" size="12px" />
              <span class="oc-truncate">{{ lane.name }}</span>
              <Tag size="small" variant="outline">{{ lane.bars.length }}</Tag>
            </div>
            <div class="oc-tl__track">
              <Tooltip
                v-for="item in lane.bars" :key="item.itemId"
                :content="`${item.shortId} ${item.title} · ${STATUS_META[item.status].label} · 进度 ${item.progress}% · ${PRIORITY_META[item.priority].label}`"
              >
                <div
                  class="oc-tl__bar" :class="{ 'oc-tl__bar--critical': isCritical(item) }"
                  :style="{ left: `${barOf(item).left}%`, width: `${barOf(item).width}%`, background: barColor(item), top: `${(ROW_H - BAR_H) / 2}px` }"
                >
                  <span class="oc-tl__bar-text">{{ item.shortId }}</span>
                </div>
              </Tooltip>
            </div>
          </div>

          <!-- 依赖箭头与里程碑：SVG 叠层（x 轴以 0–1000 映射） -->
          <svg class="oc-tl__overlay" :viewBox="`0 0 1000 ${totalH}`" preserveAspectRatio="none" :style="{ height: `${totalH}px` }" aria-label="依赖箭头与里程碑">
            <defs>
              <marker id="oc-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--td-text-color-secondary, #999)" />
              </marker>
            </defs>
            <polyline
              v-for="(a, i) in arrows" :key="i" :points="a.points" fill="none"
              :stroke="a.critical ? 'var(--oc-sev-error, #d54941)' : 'var(--oc-border-strong, #bbb)'"
              :stroke-width="a.critical ? 2 : 1" stroke-dasharray="4 3" marker-end="url(#oc-arrow)"
            />
            <g v-for="m in milestones" :key="m.id">
              <line :x1="m.x * 10" :x2="m.x * 10" y1="0" :y2="totalH" stroke="var(--td-brand-color, #0052d9)" stroke-dasharray="5 4" stroke-width="1" />
              <polygon :points="`${m.x * 10},2 ${m.x * 10 + 6},8 ${m.x * 10},14 ${m.x * 10 - 6},8`" fill="var(--td-brand-color, #0052d9)" />
            </g>
          </svg>
        </div>
      </div>

      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
        <Tag v-for="m in milestones" :key="m.id" size="small" :theme="m.status === '风险' ? 'danger' : m.status === '已达成' ? 'success' : 'primary'" variant="light-outline">
          {{ m.name }} · {{ m.status }} · {{ new Date(m.dueAt).toLocaleDateString('zh-CN') }}
        </Tag>
      </div>
      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 6px">
        <CliHint command="oc task timeline --group-by assignee --critical-path" label="CLI：含关键路径的泳道视图" />
        <CopyableId id="trace-7c02e51b" label="复制时间线快照引用" />
      </div>
    </StateShell>
  </div>
</template>

<style scoped>
.oc-tl {
  position: relative;
  font-size: 12px;
}

.oc-tl__head,
.oc-tl__row {
  display: flex;
  align-items: center;
}

.oc-tl__label {
  width: 190px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
  min-width: 0;
}

.oc-tl__track {
  position: relative;
  flex: 1;
  height: 100%;
  border-left: 1px solid var(--oc-border);
}

.oc-tl__tick {
  position: absolute;
  top: 0;
  font-size: 11px;
  color: var(--td-text-color-placeholder, #8f8f8f);
  transform: translateX(-50%);
  border-left: 1px dashed var(--oc-border);
  padding-left: 2px;
}

.oc-tl__row {
  border-top: 1px solid var(--oc-border);
}

.oc-tl__bar {
  position: absolute;
  height: 14px;
  border-radius: 3px;
  opacity: 0.92;
  display: flex;
  align-items: center;
  overflow: hidden;
  cursor: default;
}

.oc-tl__bar--critical {
  outline: 2px solid var(--td-error-color, #d54941);
  outline-offset: 1px;
}

.oc-tl__bar-text {
  font-size: 10px;
  color: #fff;
  padding-left: 4px;
  white-space: nowrap;
}

.oc-tl__overlay {
  position: absolute;
  left: 190px;
  right: 0;
  top: 26px;
  width: calc(100% - 190px);
  pointer-events: none;
}
</style>
