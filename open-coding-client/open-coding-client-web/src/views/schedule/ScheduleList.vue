<script setup lang="ts">
/**
 * 计划列表（X-06）：触发摘要 / 下次触发 / 上次结果 / 熔断状态 + 启停开关 + 一键手动触发（被拒给 preauth.denied 提示）。
 * 溯源：卷 15 §4.4 Schedule 计划模型 / D-SCH-4 无人值守安全。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { Schedule } from '@/mock/data/task';

const ui = useUiStore();
const router = useRouter();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const limit = ref(6);
const denied = ref<{ schedule: Schedule; code: string; traceId: string } | null>(null);

const schedules = computed(() => taskData.schedules.slice(0, limit.value));

const stats = computed(() => ({
  enabled: taskData.schedules.filter((s) => s.enabled).length,
  open: taskData.schedules.filter((s) => s.circuitBreaker.open).length,
  denied: taskData.schedules.filter((s) => s.runs.some((r) => r.outcome === 'PRECHECK_DENIED')).length,
  next: taskData.schedules.filter((s) => s.enabled).length,
}));

const columns = [
  { colKey: 'name', title: '计划' },
  { colKey: 'trigger', title: '触发摘要', width: 250 },
  { colKey: 'target', title: '触发对象', width: 220 },
  { colKey: 'next', title: '下次触发', width: 160 },
  { colKey: 'last', title: '上次结果', width: 150 },
  { colKey: 'breaker', title: '熔断', width: 110 },
  { colKey: 'op', title: '操作', width: 200 },
];

const TRIGGER_LABEL: Record<string, string> = { time: '时间', event: '事件', condition: '条件', manual: '手动', composite: '组合' };

function triggerSummary(s: Schedule): string {
  return s.triggers.map((t) => t.kind === 'composite'
    ? `组合 ${t.combinator}(${t.children?.map((c) => TRIGGER_LABEL[c.kind]).join(' + ')})`
    : `${TRIGGER_LABEL[t.kind]}：${t.spec}`).join(' ｜ ');
}

/** 手动触发：先做预授权校验，越界必须拒绝并生成安全事件（不静默跳过） */
function runNow(s: Schedule) {
  if (s.circuitBreaker.open) {
    denied.value = { schedule: s, code: 'schedule.circuit.open', traceId: 'trace-c31a09fe' };
    MessagePlugin.error(`${s.name}：熔断开启，手动触发被拒绝（需人工确认恢复）`);
    return;
  }
  const preauthRisk = s.runs.some((r) => r.outcome === 'PRECHECK_DENIED');
  if (preauthRisk) {
    denied.value = { schedule: s, code: 'schedule.preauth.denied', traceId: 'trace-c31a09fe' };
    MessagePlugin.error(`${s.name}：预授权越界（动作 git.push 不在 Allowlist），触发被拒绝`);
    return;
  }
  if (!s.enabled) {
    denied.value = { schedule: s, code: 'schedule.disabled', traceId: 'trace-c31a09fe' };
    MessagePlugin.error(`${s.name}：计划已停用，请先启用再手动触发`);
    return;
  }
  denied.value = null;
  MessagePlugin.success(`${s.name}：已手动触发（幂等键含 operatorId，重复点击会去重）`);
}

function toggle(s: Schedule, v: boolean) {
  s.enabled = v;
  s.nextFireAt = v ? new Date(Date.now() + 3_600_000).toISOString() : '';
  MessagePlugin.success(v ? `${s.name} 已启用，下次触发已排期` : `${s.name} 已停用（运行中的实例按并发策略收尾）`);
}

/** 查看日历：跳转计划日历页（资源冲突视图与冲突检测同源） */
function openCalendar() {
  router.push('/schedule/calendar');
}

/** 新建计划：跳转八区计划编辑器（保存后生成草稿，不在列表页空报成功） */
function openEditor() {
  router.push('/schedule/editor');
}

/** 运行历史：跳转运行历史页（触发源 / 决策 / 动作 / 结果） */
function openRuns() {
  router.push('/schedule/runs');
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = !taskData.schedules.length ? 'EMPTY' : taskData.schedules.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
  }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="计划列表" volume="卷 15" manifest="X-06" cli="oc schedule list --show-next-fire --show-breaker"
      desc="无人值守入口：五类触发器可组合，触发前执行预授权校验（越界即停并生成安全事件），连续失败自动熔断且需人工确认恢复。"
      :status="[{ label: '预授权边界', theme: 'primary' }, { label: `${stats.open} 个熔断中`, theme: stats.open ? 'danger' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="openCalendar">查看日历</Button>
        <Button size="small" theme="primary" @click="openEditor">新建计划</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="已启用" :value="stats.enabled" unit="个" icon="calendar" />
      <StatCard label="熔断中" :value="stats.open" unit="个" icon="secured" :lower-is-better="true" hint="熔断后需人工确认恢复，不允许自动恢复" />
      <StatCard label="预授权越界" :value="stats.denied" unit="次" icon="lock" :lower-is-better="true" />
      <StatCard label="上次运行成功率" :value="78.4" unit="%" icon="check" :target="95" target-kind="min" />
    </div>

    <StateShell
      :state="state" :page-size="limit"
      collapsed-summary="计划数超过列表渲染阈值（6 个），已折叠展示。"
      empty-title="还没有计划" empty-desc="Schedule 用于无人值守触发；一次性任务请直接创建任务。" empty-action="新建计划"
      example-task="每工作日 02:00 巡检依赖升级"
      what="计划列表加载失败" why="调度器租约不一致（多实例竞争同一租约）"
      how="可重试；调度器将在租约超时后重新选举，期间手动触发仍可用" trace-id="trace-c31a09fe"
      @retry="state = 'LOADING'" @load-more="limit = taskData.schedules.length; state = 'NORMAL'" @empty-action="MessagePlugin.info('已打开计划编辑器')"
    >
      <div v-if="denied" class="oc-card" style="border-color: var(--oc-sev-error); margin-bottom: 10px">
        <div class="oc-flex" style="gap: 6px">
          <OcIcon name="lock" size="14px" color="var(--oc-sev-error)" />
          <b>触发被拒绝</b>
          <Tag size="small" theme="danger" variant="light-outline">{{ denied.code }}</Tag>
        </div>
        <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
          事实：{{ denied.schedule.name }} 的手动触发未执行。原因：动作超出预授权 Allowlist（企业基线不可被计划放宽）。动作：申请一次性授权，或改用允许范围内的动作。
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 6px">
          <CopyableId :id="denied.traceId" label="复制 traceId" />
          <CliHint command="oc schedule run SCH-08 --dry-run --explain-preauth" />
        </div>
      </div>

      <div class="oc-card">
        <Table :data="schedules" row-key="scheduleId" size="small" :pagination="undefined" :columns="columns">
          <template #name="{ row }">
            <div class="oc-flex" style="gap: 6px; align-items: center">
              <Switch size="small" :value="row.enabled" @change="(v: unknown) => toggle(row as Schedule, Boolean(v))" />
              <div>
                <div style="font-size: 12px">{{ row.name }}</div>
                <div class="oc-muted oc-mono" style="font-size: 11px">{{ row.scheduleId }}</div>
              </div>
            </div>
          </template>
          <template #trigger="{ row }">
            <span style="font-size: 11px">{{ triggerSummary(row as Schedule) }}</span>
            <div class="oc-muted" style="font-size: 11px">去抖 {{ row.triggers[0].debounceMs }}ms · 节流 {{ row.triggers[0].throttleMs }}ms</div>
          </template>
          <template #target="{ row }">
            <Tag size="small" variant="light-outline">{{ row.target.kind }}</Tag>
            <span class="oc-mono oc-muted" style="font-size: 11px"> {{ row.target.ref }}</span>
            <span style="font-size: 11px"> {{ row.target.name }}</span>
          </template>
          <template #next="{ row }">
            <span v-if="row.nextFireAt" style="font-size: 11px">{{ new Date(row.nextFireAt).toLocaleString('zh-CN') }}</span>
            <Tag v-else size="small" variant="outline">已停用</Tag>
          </template>
          <template #last="{ row }">
            <Tag size="small" :theme="row.lastRun.outcome === 'SUCCEEDED' ? 'success' : row.lastRun.outcome === 'FAILED' ? 'danger' : 'warning'" variant="light-outline">
              {{ row.lastRun.outcome }}
            </Tag>
            <div class="oc-muted" style="font-size: 11px">{{ Math.round(row.lastRun.durationMs / 1000) }}s · ${{ row.lastRun.cost }}</div>
          </template>
          <template #breaker="{ row }">
            <Tooltip :content="`连续失败 ${row.circuitBreaker.consecutiveFailures} / 阈值 ${row.circuitBreaker.failureThreshold}；恢复方式：${row.circuitBreaker.recoveryMode}`">
              <Tag size="small" :theme="row.circuitBreaker.open ? 'danger' : 'success'" variant="light-outline">
                {{ row.circuitBreaker.open ? 'open' : 'closed' }}
              </Tag>
            </Tooltip>
          </template>
          <template #op="{ row }">
            <div class="oc-flex" style="gap: 4px">
              <Button size="small" variant="text" @click="runNow(row as Schedule)">手动触发</Button>
              <Button size="small" variant="text" @click="openRuns">运行历史</Button>
            </div>
          </template>
        </Table>
      </div>

      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
        <Tag size="small" variant="outline">并发策略：skip / queue / replace / parallel</Tag>
        <Tag size="small" variant="outline">幂等键：触发源 + 目标 + 输入哈希</Tag>
        <CliHint command="oc schedule pause SCH-04 --reason '<理由>'" label="CLI：暂停计划" />
      </div>
    </StateShell>
  </div>
</template>
