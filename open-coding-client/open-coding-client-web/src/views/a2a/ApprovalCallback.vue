<script setup lang="ts">
/**
 * 远程审批回调（Q-07）：审批转发给调用方 + 超时默认拒绝（10 分钟）+ 范围决策。
 * 溯源：卷 23 §4.1 / D-A2A-7
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 回调记录局部投影：ref 包装后即可在就地修改领域数据的同时触发界面刷新 */
const callbacks = ref(d.a2a.approvalCallbacks);
const selectedId = ref(d.a2a.approvalCallbacks[0].id);
const selected = computed(() => callbacks.value.find((c) => c.id === selectedId.value) ?? callbacks.value[0]);
const pending = computed(() => callbacks.value.filter((c) => c.decision === 'pending'));
const expired = computed(() => callbacks.value.filter((c) => c.decision === 'expired'));

const resending = ref(false);

/** 重发回调：重新向调用方投递审批请求并重置超时窗口（已处置的回调不可重发） */
function resendCallback() {
  const c = selected.value;
  if (c.decision === 'approved' || c.decision === 'denied') {
    MessagePlugin.warning(`回调 ${c.id} 已处置（${c.decision}），重发会重复投递；请先撤销该决策后再重新发起审批`);
    return;
  }
  resending.value = true;
  MessagePlugin.info(`正在重发回调：taskId=${c.taskId}，渠道 Webhook（重试 1/5）…`);
  window.setTimeout(() => {
    // 重发后回到等待应答：刷新转发时间并重新计时，便于观察超时默认拒绝
    c.forwardedAt = new Date().toISOString();
    c.decision = 'pending';
    c.decider = '等待调用方应答';
    c.note = `重发后重新计时：超时 ${c.timeoutMinutes} 分钟按策略默认拒绝（不计入用户拒绝，可再次重发）`;
    resending.value = false;
    MessagePlugin.success(`重发回调完成：taskId=${c.taskId} 已重新投递，超时窗口重置为 ${c.timeoutMinutes} 分钟（当前等待应答 ${pending.value.length} 条）`);
  }, 600);
}

/** 代调用方批准：写入处置状态与处置人（记录代理身份），批准范围立即生效可撤销 */
function approveAsProxy() {
  const c = selected.value;
  if (c.decision === 'approved') {
    MessagePlugin.warning(`回调 ${c.id} 已批准（范围 ${c.scope}），无需重复批准；如需变更请先在「授权记忆」撤销`);
    return;
  }
  c.decision = 'approved';
  c.decider = '沈亦舟（本端代理 · 代调用方应答，代理身份已记录）';
  c.note = `代调用方批准：范围 ${c.scope} 已写回授权记忆并于 ${new Date().toLocaleString('zh-CN')} 生效；撤销后立即失效、可重新发起`;
  MessagePlugin.success(`已代调用方批准：taskId=${c.taskId} 处置状态=approved，代理身份已写入审计；范围 ${c.scope} 立即生效`);
}

/** 强制拒绝：在记录上落下拒绝原因与时间（拒绝优先，不可放宽项不受影响） */
function forceDeny() {
  const c = selected.value;
  if (c.decision === 'denied') {
    MessagePlugin.warning(`回调 ${c.id} 已被强制拒绝，无需重复操作；任务需重新发起审批`);
    return;
  }
  c.decision = 'denied';
  c.decider = '沈亦舟（本端代理 · 强制拒绝）';
  c.note = `强制拒绝：目标超出授权范围（拒绝时间 ${new Date().toLocaleString('zh-CN')}）；拒绝写回授权记忆、不计入用户拒绝次数，可重新发起但本次记录不可撤销`;
  MessagePlugin.warning(`已强制拒绝：taskId=${c.taskId} 处置状态=denied，拒绝原因与时间已写入记录；调用方将按其策略终止本次执行`);
}

onMounted(() => {
  setTimeout(() => { state.value = d.a2a.approvalCallbacks.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="远程审批回调"
      desc="审批请求推送到调用方（webhook 或事件流），调用方返回决定（批准 / 拒绝 / 授权范围）；超时按策略默认拒绝，不阻塞内核。"
      volume="卷 23"
      manifest="Q-07"
      cli="oc a2a approval list --pending --with-callback"
      :status="[{ label: '超时默认拒绝（10 分钟）', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="resending" @click="resendCallback">重发回调</Button>
        <Button size="small" variant="outline" @click="router.push('/approval/channels')">查看通道设置</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="暂无远程审批"
      empty-desc="当前没有需要调用方参与的审批请求。审批通道未配置时，审批仅在本端进行（不影响内核执行）。"
      empty-action="配置审批通道"
      example-task="提交一个 R2 级任务，观察 approval.requested 事件与回调"
      what="审批回调列表加载失败"
      why="回调投递队列不可用（Webhook 目标 5xx 连续失败，已进入重试）"
      how="可重试；重试上限 5 次后进入死信，可在「通知路由」中重放"
      trace-id="trace-a2a-approval-77c1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="等待应答" :value="pending.length" unit="条" icon="secured" hint="超时即按默认拒绝" />
        <StatCard label="超时拒绝" :value="expired.length" unit="条" hint="不计入用户拒绝，可重新发起" />
        <StatCard label="已批准" :value="callbacks.filter((c) => c.decision === 'approved').length" unit="条" />
        <StatCard label="超时阈值" :value="10" unit="分钟" :target="10" target-kind="max" hint="企业可配 escalate（升级）" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">回调记录</div>
          <Table
            :data="callbacks"
            row-key="id"
            size="small"
            @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)"
          >
            <template #taskId="{ row }"><span class="oc-mono">{{ row.taskId }}</span></template>
            <template #forwardedAt="{ row }">{{ new Date(row.forwardedAt).toLocaleString('zh-CN') }}</template>
            <template #decision="{ row }">
              <Tag size="small" :theme="row.decision === 'approved' ? 'success' : row.decision === 'denied' || row.decision === 'expired' ? 'danger' : 'warning'" variant="light-outline">
                {{ row.decision }}
              </Tag>
            </template>
            <template #scope="{ row }"><Tag size="small" variant="outline">{{ row.scope }}</Tag></template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            范围语义：once（单次）/ session / project / workspace / pattern / dir 六级；批准范围写回授权记忆，可随时撤销（立即生效）。
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">选中回调（{{ selected.taskId }}）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 8px">
            <RiskBadge level="R3" show-desc />
            <Tag size="small" variant="light-outline">超时 {{ selected.timeoutMinutes }} 分钟</Tag>
            <Tag size="small" variant="outline">任务 {{ selected.taskId }}</Tag>
          </div>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'fwd', label: '转发时间', value: new Date(selected.forwardedAt).toLocaleString('zh-CN') },
              { key: 'decider', label: '决策人 / 来源', value: selected.decider },
              { key: 'scope', label: '授权范围', value: selected.scope },
              { key: 'note', label: '说明', value: selected.note, span: 1 },
            ]"
          />
          <Tooltip content="危险操作：批准后写操作将按范围立即生效；拒绝与超时不允许放行（强制项不可放宽）">
            <div class="oc-flex" style="gap: 6px; margin-top: 8px">
              <Button size="small" theme="primary" variant="outline" @click="approveAsProxy">代调用方批准（记录代理身份）</Button>
              <Popconfirm
                theme="danger"
                :content="`强制拒绝 taskId=${selected.taskId} 的远程审批（范围 ${selected.scope}）：拒绝原因与时间将写入该条记录，调用方按策略终止本次执行；拒绝不可撤销（可重新发起审批）。`"
                @confirm="forceDeny"
              >
                <Button size="small" variant="outline">强制拒绝</Button>
              </Popconfirm>
            </div>
          </Tooltip>
          <CopyableId id="corr-approve-a2a-31" label="复制 correlationId" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">不可放宽项（拒绝优先）</div>
        <div class="oc-stack">
          <div class="oc-muted" style="font-size: 12px">① 组织策略锁定的权限点（如 dlp.override / credential.manage）不可通过远程审批放宽。</div>
          <div class="oc-muted" style="font-size: 12px">② 沙箱档位下限（外部调用方 ≥ L1）不接受回调参数覆盖。</div>
          <div class="oc-muted" style="font-size: 12px">③ 回调请求必须携带签名 body 与幂等键，伪造或重放一律拒绝并生成安全事件。</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
