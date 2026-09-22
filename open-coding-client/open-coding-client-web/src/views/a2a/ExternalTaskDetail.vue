<script setup lang="ts">
/**
 * 外部任务详情（Q-04）：四 Tab — 事件流 / 结果与产物 / 审批 / 审计链。
 * 溯源：卷 23 §4.1 / §4.5
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Table, TabPanel, Tabs, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcChart from '@/components/common/OcChart.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const d = enterpriseData;
const tab = ref('events');
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
/** 任务 / 事件流 / 审计链局部投影：ref 包装后取消动作可即时反映到页头状态、事件表与责任链 */
const tasks = ref(d.a2a.tasks);
const externalEvents = ref(d.a2a.externalEvents);
const auditChain = ref(d.a2a.auditChain);
const task = computed(() => tasks.value.find((t) => t.taskId === String(route.params.id)) ?? tasks.value[0]);
const events = computed(() => externalEvents.value.filter((e) => e.taskId === task.value.taskId));
const chain = computed(() => auditChain.value.filter((h) => h.correlationId === task.value.correlationId));
const callback = computed(() => d.a2a.approvalCallbacks.find((c) => c.taskId === task.value.taskId));
const cancelling = ref(false);
/** 产物签名 URL 续签：默认 30 分钟，过期需重新签发（不内联进事件） */
function renewArtifact(id: string) {
  ui.track('a2a.artifact.renew', { id });
}

/** 取消（安全点）：不中断已开始的阶段，在阶段边界停止并保留已完成产物 */
function cancelTask() {
  const t = task.value;
  if (t.status === 'cancelled' || t.status === 'completed' || t.status === 'failed') {
    MessagePlugin.warning(`任务已处于终态（${t.status}），无需取消；如需重跑请重新提交（幂等键变更）`);
    return;
  }
  cancelling.value = true;
  MessagePlugin.info(`取消请求已受理（安全点语义）：taskId=${t.taskId}，将在当前阶段边界停止…`);
  window.setTimeout(() => {
    t.status = 'cancelled';
    // 事件流与责任链同步追加取消记录：状态不可逆，已完成阶段产物保留
    const nextSeq = Math.max(...externalEvents.value.map((e) => e.seq)) + 7;
    externalEvents.value.push({
      seq: nextSeq, type: 'task.cancelled', taskId: t.taskId, at: new Date().toISOString(),
      payloadSummary: '安全点取消：已完成阶段产物保留，未开始阶段不再进入', sensitive: false, deliveredSubscribers: 2, latencyMs: 120,
    });
    const nextHop = Math.max(...auditChain.value.map((h) => h.hop)) + 1;
    auditChain.value.push({
      hop: nextHop, actor: '沈亦舟（本端操作者）', actorKind: '调用方', action: 'POST /a2a/v1/tasks/{id}/cancel（安全点取消）', decision: 'ALLOW',
      at: new Date().toISOString(), correlationId: t.correlationId, evidenceRef: 'evt-a2a-cancel-01',
    });
    cancelling.value = false;
    MessagePlugin.success(`取消完成：taskId=${t.taskId} 已在安全点停止（状态 → cancelled），已完成阶段产物保留；事件流追加 task.cancelled（seq=${nextSeq}），审计链新增第 ${nextHop} 跳`);
  }, 700);
}

onMounted(() => {
  setTimeout(() => {
    state.value = task.value ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`外部任务 ${task.taskId}`"
      :desc="`${task.title} · 调用方 ${task.caller.name}（${task.caller.type}）· 委托用户 ${task.delegatedUserId}`"
      volume="卷 23"
      manifest="Q-04"
      cli="oc a2a task show --id <taskId> --with-events --with-chain"
      :status="[{ label: task.status, theme: task.status === 'failed' ? 'danger' : task.status === 'completed' ? 'success' : 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/a2a/tasks')">返回列表</Button>
        <Popconfirm
          theme="warning"
          :content="`取消 ${task.taskId}（安全点语义）：将在当前阶段边界停止，已完成阶段产物保留，未开始阶段不再进入；状态变为 cancelled 后不可回退，需要重跑请以新幂等键重新提交。`"
          @confirm="cancelTask"
        >
          <Button size="small" variant="outline" :loading="cancelling">取消（安全点）</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      missing-permission="a2a.task.read"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」请求 a2a.task.read（仅限本项目）"
      empty-title="任务不存在"
      :empty-desc="`未找到 ${String(route.params.id)}；可能已超出保留窗口（7 天）或被调用方撤回。`"
      empty-action="返回任务列表"
      what="任务详情加载失败"
      why="事件流读取超时（该任务事件量较大，需分页拉取）"
      how="可重试；也可仅查看结果与产物（事件流非必需）"
      trace-id="trace-a2a-detail-18c204"
      @retry="state = 'LOADING'"
      @empty-action="router.push('/a2a/tasks')"
    >
      <div class="oc-card">
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'taskId', label: '任务号', value: task.taskId, mono: true, copyable: true },
            { key: 'idem', label: '幂等键', value: task.idempotencyKey, mono: true, copyable: true, hint: task.idempotentHit ? '已命中（返回既有任务）' : '首次提交' },
            { key: 'corr', label: 'correlationId', value: task.correlationId, mono: true, copyable: true },
            { key: 'mode', label: '模式 / 沙箱', value: `${task.mode} / ${task.sandboxTier}` },
            { key: 'ws', label: '目标工作区', value: task.targetWorkspaceId, mono: true },
            { key: 'budget', label: '预算水位', value: `$${task.spentUsd.toFixed(2)} / $${task.budgetUsd.toFixed(2)}`, hint: '超限即停并报告' },
            { key: 'cb', label: '审批回调地址', value: task.approvalCallbackUrl, block: true, span: 2 },
            { key: 'hop', label: '跳数', value: `${task.hopDepth} / 3` },
          ]"
        />
        <div v-if="task.integrityNote" class="oc-state__hint" style="margin-top: 6px">{{ task.integrityNote }}</div>
        <div v-if="task.failureReason" class="oc-state__hint" style="margin-top: 6px; color: var(--td-error-color, #d54941)">
          事实：任务失败（{{ task.failureReason }}）。原因：不可重试错误已按策略终止。动作：修正后可重新提交（幂等键变更）。
        </div>
      </div>

      <Tabs v-model="tab" style="margin-top: 12px">
        <TabPanel value="events" label="事件流">
          <div class="oc-flex--between">
            <span class="oc-muted" style="font-size: 12px">外部可见事件为内部事件的过滤投影（11 类稳定契约）</span>
            <CopyableId id="trace-a2a-events-9021" label="复制 traceId" />
          </div>
          <Table
            :data="events"
            row-key="seq"
            size="small"
            :columns="[
              { colKey: 'seq', title: 'seq', width: 100 },
              { colKey: 'type', title: '事件类型', width: 180 },
              { colKey: 'payloadSummary', title: '载荷摘要' },
              { colKey: 'latencyMs', title: '投递延迟(ms)', width: 130 },
            ]"
          >
            <template #type="{ row }">
              <Tag size="small" :theme="row.sensitive ? 'warning' : 'default'" variant="light-outline">{{ row.type }}</Tag>
            </template>
          </Table>
          <OcChart
            v-if="events.length"
            type="bar"
            :series="[{ name: '投递延迟', points: events.map((e) => ({ x: String(e.seq), y: e.latencyMs })) }]"
            :height="180"
            unit="ms"
            aria-label="事件投递延迟"
            style="margin-top: 8px"
          />
        </TabPanel>

        <TabPanel value="result" label="结果与产物">
          <div class="oc-grid oc-grid--2">
            <div class="oc-card" style="box-shadow: none">
              <div class="oc-card__title">证据（三级验证）</div>
              <div class="oc-stack">
                <div v-for="e in task.evidence" :key="e.kind" class="oc-flex--between">
                  <span><Tag size="small" variant="outline">{{ e.kind }}</Tag> {{ e.text }}</span>
                  <Tag size="small" :theme="e.pass ? 'success' : 'danger'" variant="light-outline">{{ e.pass ? '通过' : '未通过' }}</Tag>
                </div>
              </div>
            </div>
            <div class="oc-card" style="box-shadow: none">
              <div class="oc-card__title">产物（签名 URL，有效期默认 30 分钟）</div>
              <div v-if="task.artifacts.length" class="oc-stack">
                <div v-for="a in task.artifacts" :key="a.id" class="oc-flex--between">
                  <span>
                    <Tag size="small" variant="outline">{{ a.kind }}</Tag>
                    <span class="oc-mono" style="font-size: 11px">{{ a.id }}</span>
                    <span class="oc-muted"> · {{ a.sizeKb }} KB</span>
                  </span>
                  <span class="oc-flex" style="gap: 6px">
                    <Tooltip :content="`过期时间 ${new Date(a.expiresAt).toLocaleString('zh-CN')}；过期后需重新签发（不内联大产物）`">
                      <Tag size="small" variant="outline">签名 {{ a.signature.slice(0, 8) }}</Tag>
                    </Tooltip>
                    <Button size="small" variant="text" @click="renewArtifact(a.id)">续签</Button>
                  </span>
                </div>
              </div>
              <div v-else class="oc-muted" style="font-size: 12px">尚无产物；任务完成后生成并推 artifact.created 事件。</div>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="approval" label="审批">
          <div v-if="callback" class="oc-card" style="box-shadow: none">
            <div class="oc-flex oc-flex--wrap" style="gap: 8px">
              <RiskBadge level="R2" show-desc />
              <Tag size="small" variant="light-outline">超时 {{ callback.timeoutMinutes }} 分钟</Tag>
              <Tag size="small" :theme="callback.decision === 'approved' ? 'success' : callback.decision === 'denied' || callback.decision === 'expired' ? 'danger' : 'warning'" variant="light-outline">
                {{ callback.decision === 'pending' ? '等待调用方应答' : callback.decision }}
              </Tag>
              <Tag size="small" variant="outline">范围 {{ callback.scope }}</Tag>
            </div>
            <InfoGrid
              style="margin-top: 8px"
              :items="[
                { key: 'fwd', label: '转发时间', value: new Date(callback.forwardedAt).toLocaleString('zh-CN') },
                { key: 'decider', label: '决策人', value: callback.decider },
                { key: 'note', label: '说明', value: callback.note, span: 2 },
              ]"
            />
            <div class="oc-state__hint" style="margin-top: 6px">
              超时默认拒绝（企业可配 escalate）：拒绝不计入用户拒绝次数，可重新发起；批准范围写回授权记忆并按范围生效。
            </div>
          </div>
          <div v-else class="oc-muted" style="font-size: 12px">该任务未触发远程审批（无需等待外部决策）。</div>
        </TabPanel>

        <TabPanel value="chain" label="审计链">
          <div class="oc-flex--between">
            <span class="oc-muted" style="font-size: 12px">责任链跨系统保留：谁（调用方/委托用户）在何时以何权限触发、谁批准</span>
            <Tag size="small" theme="success" variant="light-outline">不可篡改（哈希链校验通过）</Tag>
          </div>
          <Table
            :data="chain"
            row-key="hop"
            size="small"
            :columns="[
              { colKey: 'hop', title: '#', width: 60 },
              { colKey: 'actor', title: '主体', width: 200 },
              { colKey: 'action', title: '动作' },
              { colKey: 'decision', title: '决策', width: 110 },
              { colKey: 'at', title: '时间', width: 190 },
            ]"
          >
            <template #actor="{ row }">
              <span>{{ row.actor }}</span>
              <Tag size="small" variant="outline" style="margin-left: 4px">{{ row.actorKind }}</Tag>
            </template>
            <template #decision="{ row }">
              <Tag size="small" :theme="row.decision === 'ALLOW' ? 'success' : 'danger'" variant="light-outline">{{ row.decision }}</Tag>
            </template>
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          </Table>
        </TabPanel>
      </Tabs>
    </StateShell>
  </div>
</template>
