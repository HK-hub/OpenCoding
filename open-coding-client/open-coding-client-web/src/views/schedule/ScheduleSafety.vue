<script setup lang="ts">
/**
 * 预授权越界与熔断中心（X-11）：安全事件列表 + 熔断 open/closed + 人工确认恢复。
 * 溯源：卷 15 D-SCH-4 无人值守安全 / D-SCH-6 熔断（恢复需人工确认，不允许自动恢复）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { Schedule } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const recoverOpen = ref(false);
const recoverTarget = ref<Schedule | null>(null);
const recoverReason = ref('已修复失败根因（worktree 内存上限调整），并补跑了对拍验证。');

/** 安全事件：预授权越界（schedule.preauth.denied）+ 相关拒绝记录 */
const events = computed(() => taskData.schedules.flatMap((s) => s.runs
  .filter((r) => r.outcome === 'PRECHECK_DENIED')
  .map((r) => ({
    id: r.runId,
    at: r.at,
    scheduleName: s.name,
    type: 'schedule.preauth.denied',
    detail: `${r.decision}；触发源=${r.triggerSource}`,
    action: '拒绝触发 + 生成安全事件 + 通知 P0 渠道',
    traceId: 'trace-c31a09fe',
  }))));

const breakers = computed(() => taskData.schedules.map((s) => ({
  id: s.scheduleId, name: s.name, open: s.circuitBreaker.open,
  failures: s.circuitBreaker.consecutiveFailures, threshold: s.circuitBreaker.failureThreshold,
  recovery: s.circuitBreaker.recoveryMode, targets: s.circuitBreaker.alertTargets,
})));

const stats = computed(() => ({
  denied: events.value.length,
  open: breakers.value.filter((b) => b.open).length,
  closed: breakers.value.filter((b) => !b.open).length,
  escalated: taskData.schedules.flatMap((s) => s.runs).filter((r) => r.outcome === 'ESCALATED').length,
}));

const columns = [
  { colKey: 'at', title: '时间', width: 160 },
  { colKey: 'scheduleName', title: '计划', width: 220 },
  { colKey: 'type', title: '事件类型', width: 200 },
  { colKey: 'detail', title: '详情' },
  { colKey: 'action', title: '处置', width: 240 },
];

function openRecover(s: Schedule) {
  recoverTarget.value = s;
  recoverOpen.value = true;
}

const snapshotOpen = ref(false);
/** 企业基线 Allowlist（与计划编辑器校验口径一致）：越界动作永不在预授权范围 */
const BASELINE_ALLOWLIST = ['file.read', 'file.write:src/**', 'command.test', 'git.commit'];

/** 授权快照：逐计划对比声明动作与基线 Allowlist，并标注运行期越界拦截次数 */
const snapshotRows = computed(() => taskData.schedules.map((s) => {
  const outside = s.permissions.allow.filter((a) => !BASELINE_ALLOWLIST.includes(a));
  const denied = s.runs.filter((r) => r.outcome === 'PRECHECK_DENIED').length;
  return {
    id: s.scheduleId,
    name: s.name,
    declared: s.permissions.allow.join('、'),
    outside: outside.length ? outside.join('、') : '—',
    denied: denied ? `${denied} 次（git.push 越界）` : '—',
    verdict: denied ? '越界已拦截' : outside.length ? '越界（需一次性授权）' : '在预授权内',
  };
}));

/** 授权快照：就地打开声明动作 vs Allowlist 的差异视图（不跳转外部页面） */
function openSnapshot() {
  snapshotOpen.value = true;
  MessagePlugin.info(`已进入授权快照：${snapshotRows.value.length} 个计划的声明动作已与 Allowlist 逐项比对`);
}

const snapshotColumns = [
  { colKey: 'name', title: '计划', width: 200 },
  { colKey: 'declared', title: '声明动作（Allowlist）' },
  { colKey: 'outside', title: '基线差异', width: 150 },
  { colKey: 'denied', title: '越界拦截', width: 150 },
  { colKey: 'verdict', title: '结论', width: 140 },
];

function confirmRecover() {
  const s = recoverTarget.value;
  if (!s) return;
  if (!recoverReason.value.trim()) {
    MessagePlugin.error('恢复理由必填：熔断恢复必须留痕（用于复盘与审计）');
    return;
  }
  s.circuitBreaker.open = false;
  s.circuitBreaker.consecutiveFailures = 0;
  recoverOpen.value = false;
  MessagePlugin.success(`${s.name}：熔断已人工恢复，失败计数清零并重新排期`);
}

/** 导出安全事件：预授权越界事件 + 熔断状态与页面同源（含 traceId，供审计对账） */
function exportEvents() {
  const file = downloadJson({
    stats: stats.value,
    events: events.value,
    circuitBreakers: breakers.value,
  }, `oc-schedule-safety-events-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`安全事件已导出：${file}`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = breakers.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="预授权与熔断" volume="卷 15" manifest="X-11" cli="oc schedule safety --events --breaker --recover"
      desc="无人值守安全中心：预授权越界事件（schedule.preauth.denied）逐条可查；熔断 open 后计划停跑，恢复必须人工确认并留理由，不允许自动恢复。"
      :status="[{ label: `${stats.open} 个熔断中`, theme: stats.open ? 'danger' : 'success' }, { label: '企业基线不可放宽', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportEvents">导出事件</Button>
        <Button size="small" variant="outline" @click="openSnapshot">授权快照</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="预授权越界" :value="stats.denied" unit="次" icon="lock" :lower-is-better="true" hint="越界即停，不静默跳过" />
      <StatCard label="熔断（open）" :value="stats.open" unit="个" icon="secured" :lower-is-better="true" />
      <StatCard label="正常（closed）" :value="stats.closed" unit="个" icon="check" />
      <StatCard label="已升级人工" :value="stats.escalated" unit="次" icon="user" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有安全事件" empty-desc="近 30 天没有预授权越界或熔断记录。" empty-action="查看计划列表"
      example-task="为 SCH-08 迁移演练配置最小预授权"
      what="安全事件加载失败" why="审计通道不可用（事件总线消费者滞后超阈值）"
      how="可重试；恢复后自动补齐滞后事件，不会丢事件（有 offset 保障）" trace-id="trace-a5e07f31"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已跳转计划列表')"
    >
      <div class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">熔断状态</div>
          <div v-for="b in breakers" :key="b.id" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center; margin-bottom: 8px">
            <OcIcon :name="b.open ? 'error' : 'check'" size="14px" :color="b.open ? 'var(--oc-sev-error)' : 'var(--td-success-color)'" />
            <b style="font-size: 12px">{{ b.name }}</b>
            <Tag size="small" :theme="b.open ? 'danger' : 'success'" variant="light-outline">{{ b.open ? 'open（已暂停）' : 'closed' }}</Tag>
            <Tag size="small" variant="outline">连续失败 {{ b.failures }} / {{ b.threshold }}</Tag>
            <span class="oc-muted" style="font-size: 11px">告警对象：{{ b.targets.join('、') }}｜恢复：{{ b.recovery }}</span>
            <Button v-if="b.open" size="small" variant="outline" @click="openRecover(taskData.schedules.find((s) => s.scheduleId === b.id) as Schedule)">人工确认恢复</Button>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">预授权越界与安全事件</div>
          <Table :data="events" row-key="id" size="small" :pagination="undefined" :columns="columns">
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template #type="{ row }"><Tag size="small" theme="danger" variant="light-outline" class="oc-mono">{{ row.type }}</Tag></template>
          </Table>
          <div v-if="!events.length" class="oc-muted" style="font-size: 12px">无越界事件。</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">无人值守安全模型（为什么越界就停）</div>
          <InfoGrid :columns="2" :items="[
            { key: 'pre', label: '触发前', value: '计划必须声明所需操作类型，策略校验是否在 Allowlist 内（企业基线优先）' },
            { key: 'run', label: '执行中', value: '权限链路照常；越界动作 → 暂停 + 通知（不静默跳过）' },
            { key: 'res', label: '资源', value: '预算硬上限 + 并发上限 + 熔断（失败阈值 / 失败率 / 预算异常）' },
            { key: 'post', label: '事后', value: '完整审计（触发源/决策/动作/结果）+ 可一键回滚（涉及提交按 Git 回滚策略）' },
          ]" />
          <div class="oc-flex" style="gap: 6px; margin-top: 6px">
            <RiskBadge level="R3" />
            <RiskBadge level="R4" />
            <RiskBadge level="R5" />
            <span class="oc-muted" style="font-size: 12px">R3 外发 / R4 破坏性 / R5 敏感动作默认不在预授权范围。</span>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CliHint command="oc schedule safety explain SCH-08 --action git.push" />
            <CopyableId id="trace-a5e07f31" label="复制 traceId" />
          </div>
        </div>
      </div>

      <Dialog v-model:visible="recoverOpen" header="人工确认恢复熔断" width="520px" :footer="false">
        <div class="oc-stack">
          <div class="oc-muted" style="font-size: 12px">
            计划：{{ recoverTarget?.name }}（连续失败 {{ recoverTarget?.circuitBreaker.consecutiveFailures }} 次）
          </div>
          <Textarea v-model="recoverReason" :autosize="{ minRows: 3 }" placeholder="说明根因与修复证据（必填）" />
          <div class="oc-secondary" style="font-size: 12px">
            恢复后失败计数清零并重新排期；若根因未修复会再次熔断（自动恢复被禁止，避免无限烧钱）。
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Popconfirm content="确认恢复会立即解除熔断并重新排期下一次触发。" theme="warning" @confirm="confirmRecover">
              <Button size="small" theme="primary">确认恢复</Button>
            </Popconfirm>
            <Button size="small" variant="outline" @click="recoverOpen = false">取消</Button>
          </div>
        </div>
      </Dialog>
      <Dialog v-model:visible="snapshotOpen" header="授权快照：声明动作 vs Allowlist" width="860px" :footer="false">
        <div class="oc-muted" style="font-size: 12px; margin-bottom: 8px">
          企业基线不可被计划放宽：Allowlist 之外的动作（如 git.push / 生产写入 / 密钥读取）触发即拒绝并生成安全事件。
        </div>
        <Table :data="snapshotRows" row-key="id" size="small" :pagination="undefined" :columns="snapshotColumns">
          <template #verdict="{ row }">
            <Tag size="small" :theme="row.verdict === '在预授权内' ? 'success' : row.verdict === '越界已拦截' ? 'danger' : 'warning'" variant="light-outline">
              {{ row.verdict }}
            </Tag>
          </template>
        </Table>
      </Dialog>
    </StateShell>
  </div>
</template>
