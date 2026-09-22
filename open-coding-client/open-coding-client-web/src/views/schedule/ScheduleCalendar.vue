<script setup lang="ts">
/**
 * 计划日历与资源冲突（X-09）：日历视图 + 冲突检测（同工作区/同分支/同环境/同预算池）+ 错峰建议。
 * 溯源：卷 15 D-SCH-7 日历与资源冲突（冲突可见 + 错峰建议）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();

/** 当月网格：周一起始，6 行 × 7 列 */
const cells = computed(() => {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, i) => {
    const day = i - startOffset + 1;
    const inMonth = day >= 1 && day <= daysInMonth;
    const date = new Date(year, month, day);
    return {
      key: `${year}-${month + 1}-${day}`,
      label: inMonth ? day : '',
      inMonth,
      isToday: inMonth && day === today.getDate(),
      schedules: taskData.schedules.filter((s) => s.enabled && s.nextFireAt && new Date(s.nextFireAt).getDate() === day && inMonth),
    };
  });
});

/** 资源冲突：由计划的 conflictWith 推导，维度来自工作区/分支/环境/预算池的比对 */
const conflicts = computed(() => {
  const rows: { id: string; a: string; b: string; dimension: string; impact: string; suggestion: string }[] = [];
  const seen = new Set<string>();
  taskData.schedules.forEach((s) => {
    s.conflictWith.forEach((otherId) => {
      const key = [s.scheduleId, otherId].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      const other = taskData.schedules.find((x) => x.scheduleId === otherId);
      const sameWs = other && other.workspaceBinding.workspace === s.workspaceBinding.workspace;
      const sameBranch = other && other.workspaceBinding.branch === s.workspaceBinding.branch;
      const sameEnv = other && other.workspaceBinding.env === s.workspaceBinding.env;
      const dimension = sameWs && sameBranch ? '同工作区 + 同分支' : sameWs ? '同工作区' : sameEnv ? '同环境' : '同预算池';
      rows.push({
        id: key, a: s.name, b: other?.name ?? otherId, dimension,
        impact: sameWs && sameBranch
          ? '两者写范围重叠，将触发串行化或合并冲突（历史冲突率 22%）'
          : sameEnv ? '共用 shadow 环境与真机资源，排队等待（平均 +38 分钟）' : '共用团队预算池，可能触发熔断',
        suggestion: sameWs && sameBranch ? '错峰 ≥ 2 小时，或将其中一方改为稀疏检出' : '错开触发窗口（建议间隔 ≥ 1 小时）',
      });
    });
  });
  return rows;
});

const columns = [
  { colKey: 'a', title: '计划 A', width: 200 },
  { colKey: 'b', title: '计划 B', width: 200 },
  { colKey: 'dimension', title: '冲突维度', width: 160 },
  { colKey: 'impact', title: '影响' },
  { colKey: 'suggestion', title: '错峰建议', width: 280 },
];

const staggerOpen = ref(false);
/** 已逐个确认错峰并应用建议的冲突组 id（应用后行内展示「已错峰」） */
const staggered = ref<string[]>([]);

/** 进入「一键错峰」：打开工作台逐个确认（不静默改期） */
function openStagger() {
  staggerOpen.value = true;
  MessagePlugin.info(`已进入「一键错峰」：${conflicts.value.length} 组冲突待逐个确认，不静默改期`);
}

/** 应用单组错峰建议：把计划 B 的下次触发后移 2 小时（仅本组，需逐条确认） */
function applyStagger(row: { id: string; a: string; b: string; suggestion: string }) {
  const target = taskData.schedules.find((s) => s.name === row.b);
  if (target && target.nextFireAt) {
    target.nextFireAt = new Date(new Date(target.nextFireAt).getTime() + 2 * 3_600_000).toISOString();
  }
  if (!staggered.value.includes(row.id)) staggered.value.push(row.id);
  MessagePlugin.success(
    `已对「${row.b}」应用错峰 +2 小时（${row.suggestion}）${target?.nextFireAt ? `，下次触发 ${new Date(target.nextFireAt).toLocaleString('zh-CN')}` : ''}`,
  );
}

/** 导出排期：启用计划（含下次触发与冲突标记）+ 冲突面板与页面同源，供离线排期核对 */
function exportSchedule() {
  const file = downloadJson({
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    schedules: taskData.schedules.filter((s) => s.enabled && s.nextFireAt),
    conflicts: conflicts.value,
  }, `oc-schedule-calendar-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`排期已导出：${file}`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = taskData.schedules.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="计划日历与冲突" volume="卷 15" manifest="X-09" :cli="`oc schedule calendar --month ${month + 1} --detect-conflicts`"
      desc="日历视图呈现已排期的触发；资源冲突面板检测同工作区/同分支/同环境/同预算池的重叠，并给出可执行的错峰建议（不自动改期）。"
      :status="[{ label: `${cells.filter((c) => c.schedules.length).length} 个排期日`, theme: 'primary' }, { label: `${conflicts.length} 组资源冲突`, theme: conflicts.length ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportSchedule">导出排期</Button>
        <Button size="small" theme="primary" @click="openStagger">一键错峰</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--3" style="margin-bottom: 12px">
      <StatCard label="启用计划" :value="taskData.schedules.filter((s) => s.enabled).length" unit="个" icon="calendar" />
      <StatCard label="资源冲突组" :value="conflicts.length" unit="组" icon="link" :lower-is-better="true" hint="冲突不自动改期，必须人工确认错峰" />
      <StatCard label="昨日跳过" :value="3" unit="次" icon="refresh" :lower-is-better="true" hint="skip 策略：同计划重叠时跳过（原因可查）" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有排期" empty-desc="所有计划均已停用，或没有任何下次触发时间。" empty-action="启用计划"
      example-task="启用「夜间依赖巡检」获得第一个排期"
      what="日历加载失败" why="时区求值失败（计划声明了非法时区标识）"
      how="可重试；或修正计划时区后重新排期" trace-id="trace-9d20c7b1"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已启用默认计划 SCH-01')"
    >
      <div class="oc-stack">
        <div class="oc-card">
          <div class="oc-flex--between" style="margin-bottom: 8px">
            <div class="oc-card__title">{{ year }} 年 {{ month + 1 }} 月（周一起）</div>
            <Tag size="small" variant="outline">时区：Asia/Shanghai</Tag>
          </div>
          <div class="oc-cal">
            <div v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="oc-cal__head">{{ w }}</div>
            <div v-for="c in cells" :key="c.key" class="oc-cal__cell" :class="{ 'oc-cal__cell--muted': !c.inMonth, 'oc-cal__cell--today': c.isToday }">
              <span class="oc-cal__day">{{ c.label }}</span>
              <Tooltip v-for="s in c.schedules" :key="s.scheduleId" :content="`${s.name} · 下次触发 ${new Date(s.nextFireAt).toLocaleString('zh-CN')} · 并发策略 ${s.concurrencyPolicy}`">
                <span class="oc-cal__chip" :class="{ 'oc-cal__chip--conflict': s.conflictWith.length > 0 }">
                  <OcIcon name="calendar" size="10px" /> {{ s.scheduleId }}
                </span>
              </Tooltip>
            </div>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <Tag size="small" variant="outline">灰底 = 非本月</Tag>
            <Tag size="small" theme="warning" variant="light-outline">橙色 chip = 存在资源冲突</Tag>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">资源冲突面板</div>
          <Table :data="conflicts" row-key="id" size="small" :pagination="undefined" :columns="columns">
            <template #dimension="{ row }"><Tag size="small" theme="warning" variant="light-outline">{{ row.dimension }}</Tag></template>
          </Table>
          <div v-if="!conflicts.length" class="oc-muted" style="font-size: 12px">未检测到资源冲突。</div>
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <CliHint command="oc schedule conflicts --explain --suggest" />
            <CopyableId id="trace-9d20c7b1" label="复制 traceId" />
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="staggerOpen" header="一键错峰工作台（逐条确认，不静默改期）" width="760px" :footer="false">
      <div class="oc-muted" style="font-size: 12px">
        共 {{ conflicts.length }} 组资源冲突，已确认错峰 {{ staggered.length }} 组；应用建议仅调整对应计划的下次触发时间，不批量改期。
      </div>
      <div v-for="c in conflicts" :key="c.id" class="oc-flex oc-flex--wrap" style="gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--oc-border); font-size: 12px; align-items: center">
        <b>{{ c.a }} ↔ {{ c.b }}</b>
        <Tag size="small" theme="warning" variant="light-outline">{{ c.dimension }}</Tag>
        <span class="oc-grow oc-secondary">{{ c.suggestion }}</span>
        <Tag v-if="staggered.includes(c.id)" size="small" theme="success" variant="light-outline">已错峰</Tag>
        <Button v-else size="small" variant="outline" @click="applyStagger(c)">应用建议（+2h）</Button>
      </div>
      <div v-if="!conflicts.length" class="oc-muted" style="font-size: 12px; margin-top: 8px">未检测到资源冲突，无需错峰。</div>
    </Dialog>
  </div>
</template>

<style scoped>
.oc-cal {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.oc-cal__head {
  text-align: center;
  font-size: 11px;
  color: var(--td-text-color-secondary, #666);
  padding: 2px 0;
}

.oc-cal__cell {
  min-height: 68px;
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--td-bg-color-container, #fff);
}

.oc-cal__cell--muted {
  background: var(--td-bg-color-secondarycontainer, #f5f5f5);
  opacity: 0.6;
}

.oc-cal__cell--today {
  border-color: var(--td-brand-color, #0052d9);
}

.oc-cal__day {
  font-size: 11px;
  color: var(--td-text-color-secondary, #666);
}

.oc-cal__chip {
  font-size: 10px;
  background: var(--td-brand-color-light, #e6f0ff);
  color: var(--td-brand-color, #0052d9);
  border-radius: 3px;
  padding: 1px 3px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: default;
}

.oc-cal__chip--conflict {
  background: var(--td-warning-color-1, #fff1e9);
  color: var(--oc-sev-warn);
}
</style>
