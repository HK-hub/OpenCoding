<script setup lang="ts">
/**
 * 审批中心（G-06 / 卷 06 §4.3-§4.4）：
 * 待审批按会话分组、倒计时升序；内联完整审批卡（字段序 ①–⑦）；键盘 A/S/R/Shift+R/D/Tab；
 * 批量选择与批量批准（批量仅授予「仅本次」）；30s 去重合并标注「同动作 ×N」；
 * 三终态分离呈现（按策略拒绝 / 已升级 / 无人应答），端上不判定超时结果。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, RadioGroup, RadioButton, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import ApprovalCard from '@/components/approval/ApprovalCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { approvalData, SCOPE_CATALOG, TERMINAL_META } from '@/mock/data/approval';
import type { ApprovalRequest, GrantScope, TerminalKind } from '@/mock/data/approval';
import { makeError, mutate, type MockError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = approvalData;
const stats = data.approvalStats;

/** 审批清单本地副本：决策后「待审批/终态」计数与列表即时刷新（mock 为普通对象，需 ref 代理驱动重渲染） */
const approvals = ref<ApprovalRequest[]>(data.approvals.map((a) => ({ ...a })));

type View = 'pending' | 'policy' | 'escalated' | 'unavailable' | 'halted';
const view = ref<View>('pending');
const focusedId = ref('AR-4f21');
const selected = ref<string[]>([]);
const batchOpen = ref(false);
const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);

const sortKey = (a: ApprovalRequest) => new Date(a.expiresAt).getTime();
const pending = computed(() => approvals.value.filter((a) => a.state === 'Requested').sort((a, b) => sortKey(a) - sortKey(b)));

/** 按会话分组（组内倒计时升序，最紧急的会话排在最前） */
const groups = computed(() => {
  const map = new Map<string, { sessionId: string; sessionTitle: string; items: ApprovalRequest[] }>();
  pending.value.forEach((a) => {
    if (!map.has(a.sessionId)) map.set(a.sessionId, { sessionId: a.sessionId, sessionTitle: a.sessionTitle, items: [] });
    map.get(a.sessionId)!.items.push(a);
  });
  return [...map.values()].sort((x, y) => sortKey(x.items[0]) - sortKey(y.items[0]));
});

const terminalBuckets: { key: View; kind: TerminalKind; theme: 'danger' | 'primary' | 'default' }[] = [
  { key: 'policy', kind: 'POLICY_DENY', theme: 'danger' },
  { key: 'escalated', kind: 'ESCALATED', theme: 'primary' },
  { key: 'unavailable', kind: 'UNAVAILABLE', theme: 'default' },
];
const terminalList = computed(() => {
  const kind = terminalBuckets.find((b) => b.key === view.value)?.kind;
  if (view.value === 'halted') return approvals.value.filter((a) => a.terminal === 'HALTED');
  return approvals.value.filter((a) => a.terminal === kind);
});

const shellState = computed(() => {
  if (ui.connection !== 'CONNECTED') return 'OFFLINE' as const;
  if (failure.value) return 'ERROR' as const;
  if (phase.value === 'LOADING') return 'LOADING' as const;
  const empty = view.value === 'pending' ? pending.value.length === 0 : terminalList.value.length === 0;
  if (empty) return 'EMPTY' as const;
  return view.value !== 'pending' && terminalList.value.length > listCap.value ? ('EDGE_DATA' as const) : ('NORMAL' as const);
});

const selectedPending = computed(() => pending.value.filter((a) => selected.value.includes(a.approvalId)));
const lockedSelected = computed(() => selectedPending.value.filter((a) => a.scopeOptions.length === 1));
/** EDGE_DATA：终态列表超过渲染阈值时先折叠（阈值由内核配置下发，端上不硬编码业务语义） */
const listCap = ref(8);
const visibleTerminal = computed(() => terminalList.value.slice(0, listCap.value));

function toggleSelect(a: ApprovalRequest) {
  selected.value = selected.value.includes(a.approvalId)
    ? selected.value.filter((id) => id !== a.approvalId)
    : [...selected.value, a.approvalId];
}

/** 提交在途的审批单：同一审批单在提交完成前重复触发直接忽略（防连击 / 重复提交） */
const submitting = new Set<string>();

/** 单卡决策：经 mock 写边界提交（失败不改数据、保留原状并可重试），成功后再落终态与通知 */
async function respond(a: ApprovalRequest, decision: 'grant' | 'deny', scope: GrantScope = 'once', reason = ''): Promise<boolean> {
  // 防重：同一审批单已有提交在途时忽略重复触发（连击、快捷键长按、批量与单卡并发）
  if (submitting.has(a.approvalId)) return false;
  // 防重：已落终态的审批单不再受理决策（终态不可逆，避免重复回执与重复通知）
  if (a.terminal !== 'PENDING') return false;
  submitting.add(a.approvalId);
  try {
    await mutate(`/api/v1/approvals/${a.approvalId}/decision`, () => {
      a.state = decision === 'grant' ? 'Granted' : 'Denied';
      a.terminal = decision === 'grant' ? 'GRANTED' : 'DENIED';
      a.respondedBy = '沈亦舟（会话所有者）';
      a.respondedAt = new Date().toISOString();
      a.grantScope = decision === 'grant' ? scope : undefined;
      a.reason = reason || a.reason;
      ui.pendingApprovals = Math.max(0, ui.pendingApprovals - 1);
      return a.approvalId;
    });
  } catch (e) {
    // 写失败不改数据：卡片保持待审批原状，给出明确错误并允许原样重试
    MessagePlugin.error(`决策未提交：${(e as MockError).message}（数据未变更，可重试）`);
    return false;
  } finally {
    // 无论成功或失败都释放在途标记：失败后仍可原样重试
    submitting.delete(a.approvalId);
  }

  ui.pushNotification({
    kind: decision === 'grant' ? 'task_done' : 'task_failed',
    level: decision === 'grant' ? 'P2' : 'P1',
    title: decision === 'grant' ? '审批已批准' : '审批已拒绝',
    body: `${a.actionSummary.humanReadableDesc}（范围：${SCOPE_CATALOG.find((c) => c.scope === scope)?.chip ?? scope}）`,
    actions: [{ label: '查看审批历史', path: '/approval/history' }],
    aggregateKey: `approval-${a.approvalId}`,
    penetrateQuiet: false,
    channel: 'inapp',
  });
  MessagePlugin.success(`${a.approvalId} 已提交决策（等待服务端确认事件）`);
  return true;
}

async function batchApprove() {
  batchOpen.value = false;
  const targets = [...selectedPending.value];
  selected.value = [];
  const results = await Promise.all(targets.map((a) => respond(a, 'grant', 'once')));
  const ok = results.filter(Boolean).length;
  if (ok === targets.length) MessagePlugin.success(`已批量批准 ${ok} 条（统一授予「仅本次」，不写入授权记忆）`);
  else MessagePlugin.error(`批量批准部分失败：成功 ${ok}/${targets.length}，失败项保持待审批，可重试`);
}

async function denyCascade(a: ApprovalRequest, payload: { reason: string; cascade: boolean }) {
  const ok = await respond(a, 'deny', 'once', payload.reason);
  if (!ok) return;
  if (payload.cascade) {
    const siblings = pending.value.filter((x) => x.sessionId === a.sessionId);
    const rs = await Promise.all(siblings.map((x) => respond(x, 'deny', 'once', '级联拒绝：同会话 pending 全部终结')));
    if (rs.every(Boolean)) MessagePlugin.warning('已拒绝并终止：同会话全部待审批已终结，工具调用中断');
    else MessagePlugin.error('级联拒绝部分失败：失败项保持待审批，可重试');
  }
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="审批中心"
      desc="待审批按会话分组与倒计时排序；审批卡严格按 ①风险 ②摘要 ③预览 ④目标资源 ⑤范围 ⑥倒计时 ⑦digest 渲染；三终态分离统计。"
      volume="卷 06"
      manifest="G-06"
      cli="oc approval list --pending --group-by session"
      :status="[
        { label: `待审批 ${pending.length}`, theme: 'warning' },
        { label: '端上不判定超时结果', theme: 'default' },
      ]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次审批链路失败">
          <Button size="small" variant="text" @click="failure = makeError('APPROVAL_UNAVAILABLE')">模拟异常</Button>
        </Tooltip>
        <Button size="small" variant="outline" :disabled="!selectedPending.length" @click="batchOpen = true">
          批量批准（{{ selectedPending.length }}）
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="待审批" :value="pending.length" unit="条" format="raw" icon="secured" target-kind="max" />
      <StatCard label="平均人工时延" :value="Math.round(stats.avgHumanLatencyMs / 1000)" unit="s" format="raw" icon="time" lower-is-better />
      <StatCard label="决策 ask 比例" :value="stats.askRatio * 100" format="percent" icon="filter" />
      <StatCard label="超时数（含升级）" :value="stats.timeoutCount" unit="次" format="raw" icon="help" />
    </div>

    <div class="oc-grid oc-grid--4">
      <StatCard v-for="b in terminalBuckets" :key="b.key" :label="TERMINAL_META[b.kind].label" :value="approvals.filter((a) => a.terminal === b.kind).length" unit="条" format="raw" :hint="TERMINAL_META[b.kind].hint" />
      <StatCard label="基线挂起（单列）" :value="stats.haltedCount" unit="条" format="raw" hint="企业基线阻断并挂起会话，与三终态分开统计" />
    </div>

    <RadioGroup v-model="view" variant="default-filled">
      <RadioButton value="pending">待审批（{{ pending.length }}）</RadioButton>
      <RadioButton v-for="b in terminalBuckets" :key="b.key" :value="b.key">
        {{ TERMINAL_META[b.kind].label }}（{{ approvals.filter((a) => a.terminal === b.kind).length }}）
      </RadioButton>
      <RadioButton value="halted">基线挂起（{{ stats.haltedCount }}）</RadioButton>
    </RadioGroup>

    <StateShell
      :state="shellState"
      :stage="'正在拉取审批请求与去重窗口状态…'"
      :cancellable="true"
      empty-title="当前没有待审批请求"
      empty-desc="所有动作都在预授权边界内完成，或已由策略/记忆直接放行。"
      empty-action="查看授权记忆"
      what="审批请求加载失败"
      :why="failure?.message ?? ''"
      how="可重试；若持续失败请检查审批通道健康（桌面/CLI/A2A/IM）并导出诊断包。"
      :trace-id="failure?.traceId ?? ''"
      :collapsed-summary="`终态审批 ${terminalList.length} 条，已折叠展示前 ${listCap} 条（按终态分桶，统计不混合）`"
      :page-size="listCap"
      :disabled-capabilities="['审批决策提交', '批量批准', '范围授予']"
      @retry="failure = null; ui.simulateReconnect()"
      @load-more="listCap += 8"
    >
      <!-- 待审批：按会话分组 -->
      <div v-if="view === 'pending'" class="oc-stack" style="gap: 16px">
        <section v-for="g in groups" :key="g.sessionId" class="oc-stack">
          <div class="oc-flex oc-flex--wrap">
            <OcIcon name="chat" size="14px" />
            <b style="font-size: 13px">{{ g.sessionTitle }}</b>
            <Tag size="small" variant="outline" class="oc-mono">{{ g.sessionId }}</Tag>
            <Tag size="small" theme="warning" variant="light-outline">{{ g.items.length }} 条待审批</Tag>
            <span class="oc-muted" style="font-size: 11px">组内按倒计时升序（最紧急在前）</span>
          </div>
          <ApprovalCard
            v-for="a in g.items"
            :key="a.approvalId"
            :approval="a"
            :focused="focusedId === a.approvalId"
            selectable
            :selected="selected.includes(a.approvalId)"
            @focus="focusedId = a.approvalId"
            @toggle-select="toggleSelect(a)"
            @approve="(scope: GrantScope) => respond(a, 'grant', scope)"
            @deny="(payload: { reason: string; cascade: boolean }) => denyCascade(a, payload)"
          />
        </section>
      </div>

      <!-- 终态分离列表 -->
      <div v-else class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <Tag :theme="terminalBuckets.find((b) => b.key === view)?.theme ?? 'default'" size="small">
            {{ view === 'halted' ? TERMINAL_META.HALTED.label : TERMINAL_META[terminalBuckets.find((b) => b.key === view)!.kind].label }}
          </Tag>
          <span class="oc-muted" style="font-size: 12px">
            {{ view === 'halted' ? TERMINAL_META.HALTED.hint : TERMINAL_META[terminalBuckets.find((b) => b.key === view)!.kind].hint }}
          </span>
        </div>
        <ApprovalCard v-for="a in visibleTerminal" :key="a.approvalId" :approval="a" readonly :focused="focusedId === a.approvalId" @focus="focusedId = a.approvalId" />
      </div>
    </StateShell>

    <Dialog v-model:visible="batchOpen" header="批量批准（统一「仅本次」）" theme="warning" width="560px" @confirm="batchApprove">
      <div class="oc-stack">
        <div>将批准 {{ selectedPending.length }} 条待审批请求，全部授予「仅本次」，不写入任何授权记忆。</div>
        <div v-if="lockedSelected.length" class="oc-secondary" style="font-size: 12px">
          其中 {{ lockedSelected.length }} 条为 R4/R5 或无法解析命令：本就只允许「仅本次」，批量不会放宽其范围。
        </div>
        <div class="oc-stack" style="gap: 4px">
          <div v-for="a in selectedPending" :key="a.approvalId" class="oc-flex" style="gap: 6px">
            <Tag size="small" variant="outline">{{ a.riskClass }}</Tag>
            <span class="oc-mono" style="font-size: 12px">{{ a.approvalId }}</span>
            <span class="oc-truncate" style="font-size: 12px">{{ a.actionSummary.humanReadableDesc }}</span>
          </div>
        </div>
        <div class="oc-muted" style="font-size: 12px">批量决策以服务端首达为准；并发冲突将提示刷新（端上不自行裁定）。</div>
      </div>
    </Dialog>
  </div>
</template>
