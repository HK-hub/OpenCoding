<script setup lang="ts">
/**
 * 审批历史与回放（P-06 / 卷 06 §4.4 + D-PERM-12）：
 * 不可变事件列表（仅追加，含审批者身份与理由）+ 详情抽屉（求值轨迹 + 策略版本 + 重放一致性）。
 * 重放口径：给定 decisionId 重放求值轨迹并与原结果比对，分歧时给出首个分歧点（REPLAY_DIVERGED）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, RadioGroup, RadioButton, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { approvalData, STATE_META, TERMINAL_META } from '@/mock/data/approval';
import type { ApprovalEvent, ApprovalState, ReplayRecord } from '@/mock/data/approval';
import { makeError, type MockError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = approvalData;

const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);
const permissionGranted = ref(true);
const filter = ref<'ALL' | ApprovalState>('ALL');
const detail = ref<ReplayRecord | null>(null);
const eventDetail = ref<ApprovalEvent | null>(null);
const drawerOpen = ref(false);
const replaying = ref(false);
const replayResult = ref<{ decisionId: string; match: boolean; at: string } | null>(null);
const tableSize = ref(12);

const events = computed(() => data.approvalEvents.filter((e) => filter.value === 'ALL' || e.toState === filter.value));
const approvalOf = (id: string) => data.approvals.find((a) => a.approvalId === id);
const edge = computed(() => events.value.length > tableSize.value);
const matchRate = computed(() => Math.round((data.replayRecords.filter((r) => r.replayMatch).length / (data.replayRecords.length || 1)) * 100));

const columns: PrimaryTableCol[] = [
  { colKey: 'at', title: '时间', width: 148 },
  { colKey: 'approvalId', title: '审批号', width: 110 },
  { colKey: 'transition', title: '状态迁移（仅追加）', width: 210 },
  { colKey: 'actorIdentity', title: '审批者身份', width: 210 },
  { colKey: 'reason', title: '理由 / 触发规则' },
];

const shellState = computed(() => {
  if (ui.connection !== 'CONNECTED') return 'OFFLINE' as const;
  if (!permissionGranted.value) return 'PERMISSION_DENIED' as const;
  if (failure.value) return 'ERROR' as const;
  if (phase.value === 'LOADING') return 'LOADING' as const;
  if (!events.value.length) return 'EMPTY' as const;
  return edge.value ? ('EDGE_DATA' as const) : ('NORMAL' as const);
});

/** 表格行即事件本体（表格泛型按 TableRowData 收敛，按 eventId 还原领域类型） */
function onRowClick(ctx: { row: TableRowData }) {
  const hit = data.approvalEvents.find((e) => e.eventId === String(ctx.row.eventId));
  if (hit) openEvent(hit);
}

function openEvent(row: ApprovalEvent) {
  eventDetail.value = row;
  detail.value = data.replayRecords.find((r) => r.approvalId === row.approvalId) ?? null;
  replayResult.value = null;
  drawerOpen.value = true;
}

function openReplay(rec: ReplayRecord) {
  eventDetail.value = null;
  detail.value = rec;
  replayResult.value = null;
  drawerOpen.value = true;
}

/** 重放：以相同输入（动作描述 + 策略版本 + 上下文摘要）重跑求值轨迹并比对（只读，不写状态） */
function replay() {
  const rec = detail.value;
  if (!rec) return;
  replaying.value = true;
  window.setTimeout(() => {
    replaying.value = false;
    replayResult.value = { decisionId: rec.decisionId, match: rec.replayMatch, at: new Date().toISOString() };
    MessagePlugin[rec.replayMatch ? 'success' : 'warning'](rec.replayMatch ? '重放一致：求值轨迹与原决策相同' : '重放分歧：已标出首个分歧字段（REPLAY_DIVERGED）');
  }, 700);
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="审批历史与回放"
      desc="不可变审计事件（仅追加、不可修改）+ 决策回放：动作描述、策略版本、求值轨迹、上下文摘要引用与一致性结果。"
      volume="卷 06"
      manifest="P-06"
      cli="oc approval history --since 7d | oc approval replay --decision DEC-9f21a3"
      :status="[{ label: '审计只读', theme: 'default' }, { label: '求值轨迹含策略版本', theme: 'primary' }]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次审计读取失败">
          <Button size="small" variant="text" @click="failure = makeError('NOT_FOUND', 'audit slice 未命中')">模拟异常</Button>
        </Tooltip>
        <Button size="small" variant="outline" @click="permissionGranted = !permissionGranted">{{ permissionGranted ? '模拟权限缺失' : '恢复权限' }}</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="审计事件" :value="data.approvalEvents.length" unit="条" format="raw" icon="history" hint="仅追加、不可修改" />
      <StatCard label="重放一致性" :value="matchRate" format="percent" icon="check" :target="90" />
      <StatCard label="重放分歧" :value="data.replayRecords.filter((r) => !r.replayMatch).length" unit="条" format="raw" icon="help" />
      <StatCard label="审批请求（全量）" :value="data.approvalStats.totalRequests" unit="条" format="raw" icon="secured" />
    </div>

    <RadioGroup v-model="filter" variant="default-filled">
      <RadioButton value="ALL">全部（{{ data.approvalEvents.length }}）</RadioButton>
      <RadioButton v-for="s in (Object.keys(STATE_META) as ApprovalState[])" :key="s" :value="s">{{ STATE_META[s].label }}</RadioButton>
    </RadioGroup>

    <StateShell
      :state="shellState"
      stage="正在读取事件日志分区（按 seq 升序，先订阅后重放）…"
      cancellable
      empty-title="该状态暂无审计事件"
      empty-desc="事件日志按审批生命周期追加；切换筛选可查看其他状态分支。"
      empty-action="查看全部事件"
      what="审计事件读取失败"
      :why="failure?.message ?? ''"
      how="可重试；审计链完整性校验失败时只告警不阻塞，请在「企业治理 → 审计」查看完整性报告。"
      :trace-id="failure?.traceId ?? ''"
      missing-permission="audit.read"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」提交申请，或由团队管理员授予 audit.read（读操作，仍留审计痕迹）"
      :collapsed-summary="`审计事件 ${events.length} 条，当前页 ${tableSize} 条（翻页或加载更多继续）`"
      :page-size="tableSize"
      :disabled-capabilities="['事件列表', '重放执行', '导出审计切片']"
      @retry="failure = null; ui.simulateReconnect()"
      @apply="permissionGranted = true"
      @load-more="tableSize += 6"
    >
      <Table :data="events" :columns="columns" row-key="eventId" size="small" hover :pagination="{ pageSize: tableSize, total: events.length }" @row-click="onRowClick">
        <template #at="{ row }"><span class="oc-mono" style="font-size: 11px">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #approvalId="{ row }"><CopyableId :id="String(row.approvalId)" label="复制审批号" /></template>
        <template #transition="{ row }">
          <span class="oc-mono" style="font-size: 11px">
            {{ row.fromState === 'None' ? '—' : STATE_META[row.fromState as ApprovalState].label }} → {{ STATE_META[row.toState as ApprovalState].label }}
          </span>
        </template>
        <template #actorIdentity="{ row }">
          <div class="oc-flex" style="gap: 4px">
            <OcIcon :name="row.actorKind === 'user' ? 'user' : row.actorKind === 'agent' ? 'robot' : 'system'" size="12px" />
            <span style="font-size: 12px">{{ row.actorIdentity }}</span>
          </div>
        </template>
        <template #reason="{ row }"><span style="font-size: 12px">{{ row.reason }}</span></template>
      </Table>

      <div class="oc-card" style="margin-top: 10px">
        <h3 class="oc-card__title">
          决策回放记录
          <Tag size="small" variant="outline">重放只读：不写任何状态；同分区回放由租约互斥</Tag>
        </h3>
        <div class="oc-stack" style="gap: 6px">
          <div v-for="rec in data.replayRecords" :key="rec.decisionId" class="oc-flex--between oc-flex--wrap" style="gap: 8px">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; min-width: 0">
              <CopyableId :id="rec.decisionId" label="复制 decisionId" />
              <Tag :theme="rec.replayMatch ? 'success' : 'warning'" size="small" variant="light-outline">
                {{ rec.replayMatch ? '重放一致' : '重放分歧 REPLAY_DIVERGED' }}
              </Tag>
              <span class="oc-muted oc-truncate" style="font-size: 11px; max-width: 420px">{{ rec.policyVersion }}</span>
            </div>
            <Button size="small" variant="outline" @click="openReplay(rec)">重放</Button>
          </div>
        </div>
      </div>
    </StateShell>

    <Drawer v-model:visible="drawerOpen" header="决策详情与回放" size="560px" :footer="false">
      <div v-if="eventDetail" class="oc-stack">
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'eventId', label: '事件号（不可变）', value: eventDetail.eventId, mono: true, copyable: true },
            { key: 'approvalId', label: '关联审批', value: eventDetail.approvalId, mono: true, copyable: true },
            { key: 'actor', label: '审批者身份', value: `${eventDetail.actorIdentity}（${eventDetail.actorKind}）` },
            { key: 'at', label: '发生时间', value: new Date(eventDetail.at).toLocaleString('zh-CN') },
            { key: 'reason', label: '事件理由（仅追加）', value: eventDetail.reason, block: true },
          ]"
        />
        <div v-if="approvalOf(eventDetail.approvalId)" class="oc-card">
          <h3 class="oc-card__title">关联审批摘要</h3>
          <div style="font-size: 13px">{{ approvalOf(eventDetail.approvalId)?.actionSummary.humanReadableDesc }}</div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
            终态：{{ TERMINAL_META[approvalOf(eventDetail.approvalId)!.terminal].label }} · 风险 {{ approvalOf(eventDetail.approvalId)!.riskClass }} ·
            {{ TERMINAL_META[approvalOf(eventDetail.approvalId)!.terminal].hint }}
          </div>
        </div>
      </div>

      <div v-if="detail" class="oc-stack" style="margin-top: 12px">
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'decision', label: '决策 ID', value: detail.decisionId, mono: true, copyable: true },
            { key: 'action', label: '动作描述（重放入参）', value: detail.actionDescriptor, mono: true, block: true },
            { key: 'policy', label: '策略版本', value: detail.policyVersion, mono: true },
            { key: 'ctx', label: '上下文摘要引用', value: detail.contextSummaryRef, mono: true },
          ]"
        />
        <div class="oc-card">
          <h3 class="oc-card__title">求值轨迹（策略由高到低，拒绝优先）</h3>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="s in detail.evaluationTrace" :key="s.step" class="oc-flex" style="gap: 8px; align-items: flex-start">
              <Tag size="small" variant="outline">{{ s.step }}</Tag>
              <Tag :theme="s.result === 'DENY' ? 'danger' : s.result === 'ASK' ? 'warning' : s.result === 'ALLOW' ? 'success' : 'default'" size="small">{{ s.result }}</Tag>
              <div class="oc-grow">
                <div class="oc-mono" style="font-size: 12px">{{ s.rule }}</div>
                <div class="oc-secondary" style="font-size: 12px">{{ s.note }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="detail.divergence" class="oc-card" style="border-left: 3px solid var(--oc-sev-warn)">
          <h3 class="oc-card__title">分歧说明</h3>
          <div style="font-size: 13px">{{ detail.divergence }}</div>
        </div>
        <div class="oc-flex" style="gap: 8px">
          <Button theme="primary" :loading="replaying" @click="replay">重放并比对（只读）</Button>
          <span class="oc-muted" style="font-size: 12px">重放需运维权限点；已完成部分由投影自愈（重建幂等，可重跑）。</span>
        </div>
        <div v-if="replayResult" class="oc-card" :style="{ borderLeft: `3px solid ${replayResult.match ? 'var(--oc-sev-ok)' : 'var(--oc-sev-warn)'}` }">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon :name="replayResult.match ? 'check' : 'help'" :color="replayResult.match ? 'var(--oc-sev-ok)' : 'var(--oc-sev-warn)'" size="14px" />
            <b>{{ replayResult.match ? '重放一致：求值轨迹与原决策完全相同' : '重放分歧：REPLAY_DIVERGED' }}</b>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">比对时间 {{ new Date(replayResult.at).toLocaleString('zh-CN') }}；分歧已含 aggregate/seq 与首个分歧字段。</div>
        </div>
      </div>
    </Drawer>
  </div>
</template>
