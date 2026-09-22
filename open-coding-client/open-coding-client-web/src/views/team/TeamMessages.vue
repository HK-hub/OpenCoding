<script setup lang="ts">
/**
 * 结构化消息（R-04）：七类消息（handoff / question / blocker / proposal / review_request / verdict / budget_alert）按类型过滤渲染。
 * 溯源：卷 13 D-TEAM-4 三层通信模型（板 + 定向消息 + 公告），禁止自由文本泛滥。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, RadioGroup, RadioButton, Select, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { MESSAGE_META, taskData } from '@/mock/data/task';
import type { MessageType, TeamMessage } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const selected = ref('TEAM-checkout-01');
const filter = ref<'ALL' | MessageType>('ALL');
const limit = ref(6);

/** 本页动作产生的结构化消息（按团队分组）与动作回执：消息流、类型计数与按钮态随之更新 */
const localMessages = ref<{ teamId: string; msg: TeamMessage }[]>([]);
const receipts = ref<Record<string, { msgId: string; at: string; summary: string }>>({ });
const replyOpen = ref(false);
const replyTarget = ref<TeamMessage | null>(null);
const replyText = ref('');

const team = computed(() => taskData.teams.find((t) => t.teamId === selected.value) ?? taskData.teams[0]);
/** 当前团队的页内消息与消息 ID 集合：合并进消息流并驱动「本页生成」标记与按钮态 */
const teamLocalMessages = computed(() => localMessages.value.filter((x) => x.teamId === team.value.teamId).map((x) => x.msg));
const localMsgIds = computed(() => new Set(teamLocalMessages.value.map((x) => x.msgId)));
const allMessages = computed(() => [...teamLocalMessages.value, ...team.value.messages].sort((a, b) => +new Date(b.at) - +new Date(a.at)));
const messages = computed(() => allMessages.value
  .filter((m) => filter.value === 'ALL' || m.type === filter.value)
  .slice(0, limit.value));

const counts = computed(() => (Object.keys(MESSAGE_META) as MessageType[]).map((t) => ({
  type: t, label: MESSAGE_META[t].label, count: allMessages.value.filter((m) => m.type === t).length,
})));

function taskShort(id: string): string {
  return taskData.workItems.find((i) => i.itemId === id)?.shortId ?? id;
}

/** 导出消息：结构化载荷导出为 JSON（离线分析），范围与当前团队选择一致，不受页内过滤折叠影响 */
function exportMessages() {
  const file = downloadJson({
    teamId: selected.value,
    teamName: team.value.name,
    total: allMessages.value.length,
    filter: filter.value,
    messages: allMessages.value,
  }, `oc-team-messages-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`结构化消息已导出：${file}`);
}

/** 本页消息序号：生成可读的消息编号（按当前团队页内消息计数） */
function nextSeq(): number {
  return localMessages.value.filter((x) => x.teamId === team.value.teamId).length + 1;
}

/** 记录动作回执：原消息转「已处理」（按钮转态 + 内联回执），避免对同一动作二次处理 */
function recordReceipt(sourceId: string, receipt: { msgId: string; at: string; summary: string }): void {
  receipts.value = { ...receipts.value, [sourceId]: receipt };
}

/** 发布公告：生成结构化公告消息写入当前团队消息流（发布人 / 范围 / 时间） */
function publishAnnouncement() {
  const now = new Date().toISOString();
  const seq = nextSeq();
  const msg: TeamMessage = {
    msgId: `MSG-ANN-${String(seq).padStart(2, '0')}`,
    // 七类消息无独立「公告」类型：复用 proposal 并在载荷标注 kind（卷 13 板/定向/公告三层）
    type: 'proposal',
    dir: { from: '主管 Agent', to: '团队' },
    payload: {
      kind: '公告（broadcast）',
      subject: '团队公告：合并队列限批 2 并行（即日起生效）',
      publisher: '主管 Agent（仅主管与人类成员可发）',
      scope: '团队全体成员',
      publishedAt: now,
    },
    at: now,
    taskRef: '团队级',
  };
  localMessages.value.unshift({ teamId: team.value.teamId, msg });
  filter.value = 'ALL';
  MessagePlugin.success(`已发布公告 ${msg.msgId}（发布人 ${String(msg.payload.publisher)} / 范围 ${String(msg.payload.scope)}）：已写入消息流首位`);
}

/** 受理审查请求：按团队黑板阻塞输出 verdict（结论 + 必改项）并入流，原请求转「已受理」 */
function acceptReviewRequest(m: TeamMessage) {
  if (receipts.value[m.msgId]) {
    MessagePlugin.info(`审查请求 ${m.msgId} 已受理（回执 ${receipts.value[m.msgId].msgId}），无需重复提交`);
    return;
  }
  const now = new Date().toISOString();
  // 必改项取自黑板阻塞清单：阻塞未解除时不给「无条件通过」，避免裁决与事实源不一致
  const mustFix = team.value.board.blockers
    .filter((b) => b.taskId === m.taskRef)
    .map((b) => `解除阻塞：${b.reason}（等待 ${b.waitingOn}）`);
  const verdict: TeamMessage = {
    msgId: `MSG-VD-${String(nextSeq()).padStart(2, '0')}`,
    type: 'verdict',
    dir: { from: '审查者 · 秋水', to: '团队' },
    payload: {
      requestMsgId: m.msgId,
      task: m.taskRef,
      result: mustFix.length ? '有条件通过（必改项未清零）' : '通过',
      mustFix: mustFix.length ? mustFix : ['无'],
      acceptance: Array.isArray(m.payload.acceptance) ? `逐条核对：${m.payload.acceptance.join('、')}` : '按请求载荷核对',
      reviewedAt: now,
    },
    at: now,
    taskRef: m.taskRef,
  };
  localMessages.value.unshift({ teamId: team.value.teamId, msg: verdict });
  recordReceipt(m.msgId, { msgId: verdict.msgId, at: now, summary: `裁决：${String(verdict.payload.result)}（必改项 ${mustFix.length} 条）` });
  MessagePlugin.success(`已受理审查请求 ${m.msgId} 并输出裁决 ${verdict.msgId}（结果：${String(verdict.payload.result)}）：已写入消息流首位`);
}

/** 升级至人类：按 blocker 生成升级消息（阻塞原因 / 等待对象 / 证据引用）并入流 */
function escalateToHuman(m: TeamMessage) {
  if (receipts.value[m.msgId]) {
    MessagePlugin.info(`blocker ${m.msgId} 已升级（回执 ${receipts.value[m.msgId].msgId}），无需重复升级`);
    return;
  }
  const now = new Date().toISOString();
  const boardBlocker = team.value.board.blockers.find((b) => b.taskId === m.taskRef);
  const evidence = team.value.board.evidence.filter((e) => e.taskId === m.taskRef).map((e) => `${e.level} ${e.id} ${e.summary}`);
  if (!evidence.length) evidence.push('暂无已挂载证据（升级时显式标注，不虚构证据）');
  const waitingOn = boardBlocker?.waitingOn ?? '人类委托者响应（blocker 超过 SLA 未解决）';
  const esc: TeamMessage = {
    msgId: `MSG-ESC-${String(nextSeq()).padStart(2, '0')}`,
    type: 'blocker',
    dir: { from: '主管 Agent', to: '人类委托者' },
    payload: {
      task: m.taskRef,
      blocker: String(m.payload.reason ?? boardBlocker?.reason ?? '未标注阻塞原因'),
      waitingOn,
      owner: boardBlocker?.owner ?? '主管 Agent',
      evidence,
      openItems: team.value.report.openItems,
      escalatedAt: now,
    },
    at: now,
    taskRef: m.taskRef,
  };
  localMessages.value.unshift({ teamId: team.value.teamId, msg: esc });
  recordReceipt(m.msgId, { msgId: esc.msgId, at: now, summary: `升级至人类（等待 ${waitingOn}）` });
  MessagePlugin.success(`已升级 blocker ${m.msgId} 至人类（回执 ${esc.msgId}）：等待对象「${waitingOn}」，附 ${evidence.length} 条证据引用`);
}

/** 打开回复对话框：就地编辑答案（确认前不产生消息，也不写黑板引用） */
function openReply(m: TeamMessage) {
  if (receipts.value[m.msgId]) {
    MessagePlugin.info(`求助 ${m.msgId} 已回复（回执 ${receipts.value[m.msgId].msgId}），答案已写入黑板`);
    return;
  }
  replyTarget.value = m;
  replyText.value = '契约弃用字段需在文档中标注迁移窗口（90 天）：随 v2 契约发布说明给出迁移指引，并链接弃用告警条目。';
  replyOpen.value = true;
}

/** 确认回复：答案写入黑板引用并生成 handoff 消息入流；空回复被拒绝 */
function confirmReply() {
  const m = replyTarget.value;
  if (!m) return;
  const answer = replyText.value.trim();
  if (!answer) {
    MessagePlugin.warning('回复内容不能为空：空回复被拒绝（避免产生无信息量的结构化消息）');
    return;
  }
  const now = new Date().toISOString();
  const seq = nextSeq();
  const boardRef = `board://${team.value.teamId}/decisions/BD-ANS-${String(seq).padStart(2, '0')}`;
  const replyMsg: TeamMessage = {
    msgId: `MSG-ANS-${String(seq).padStart(2, '0')}`,
    type: 'handoff',
    dir: { from: '主管 Agent', to: m.dir.from },
    payload: { question: String(m.payload.question ?? '（未标注问题）'), answer, boardRef, answeredAt: now },
    at: now,
    taskRef: m.taskRef,
  };
  localMessages.value.unshift({ teamId: team.value.teamId, msg: replyMsg });
  recordReceipt(m.msgId, { msgId: replyMsg.msgId, at: now, summary: `已回复并写入黑板 ${boardRef}` });
  replyOpen.value = false;
  replyTarget.value = null;
  MessagePlugin.success(`已回复 ${m.msgId}：答案写入黑板 ${boardRef} 并作为 ${replyMsg.msgId} 置顶，可复用避免重复求助`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = !allMessages.value.length ? 'EMPTY' : allMessages.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
  }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="结构化消息" volume="卷 13" manifest="R-04" cli="oc team messages TEAM-checkout-01 --type all"
      desc="七类结构化消息：交接 / 求助 / 阻塞 / 方案提议 / 请求审查 / 裁决 / 预算告警。载荷为结构化字段（非自由文本），便于限流、审计与自动处置。"
      :status="[{ label: `共 ${allMessages.length} 条`, theme: 'primary' }, { label: '消息风暴防护：限流 + 结构校验', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportMessages">导出消息</Button>
        <Button size="small" variant="outline" @click="publishAnnouncement">发布公告</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">团队：</span>
        <Select v-model="selected" size="small" style="width: 280px" :options="taskData.teams.map((t) => ({ label: `${t.name}（${t.messages.length} 条）`, value: t.teamId }))" />
        <RadioGroup v-model="filter" variant="default-filled" size="small">
          <RadioButton value="ALL">全部</RadioButton>
          <RadioButton v-for="c in counts" :key="c.type" :value="c.type">{{ c.label }}（{{ c.count }}）</RadioButton>
        </RadioGroup>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="交接 / 求助" :value="`${counts[0].count} / ${counts[1].count}`" icon="link" />
      <StatCard label="阻塞" :value="counts[2].count" unit="条" icon="error" :lower-is-better="true" />
      <StatCard label="裁决" :value="counts[5].count" unit="条" icon="secured" />
      <StatCard label="预算告警" :value="counts[6].count" unit="条" icon="discount" :lower-is-better="true" />
    </div>

    <StateShell
      :state="state" :page-size="limit"
      collapsed-summary="消息数超过渲染阈值（6 条），已折叠；过滤条件不丢数据。"
      empty-title="没有消息" empty-desc="该团队尚未产生结构化消息；团队协作以黑板为主，消息按需产生。" empty-action="发送求助消息"
      example-task="向主管发送 blocker：设备池不可用"
      what="消息加载失败" why="消息通道限流触发（同类型消息在 1 秒内超过阈值）"
      how="已按限流策略排队；可重试或等待窗口结束" trace-id="trace-6e2af0b4"
      @retry="state = 'LOADING'" @load-more="limit = allMessages.length; state = 'NORMAL'" @empty-action="MessagePlugin.info('已打开消息编辑器（结构校验）')"
    >
      <div class="oc-stack">
        <div v-for="m in messages" :key="m.msgId" class="oc-card">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Tag size="small" :theme="MESSAGE_META[m.type].theme" variant="light-outline">{{ MESSAGE_META[m.type].label }}</Tag>
            <OcIcon name="link" size="12px" />
            <span style="font-size: 12px">{{ m.dir.from }} → {{ m.dir.to }}</span>
            <Tag size="small" variant="outline" class="oc-mono">{{ taskShort(m.taskRef) }}</Tag>
            <span class="oc-muted" style="font-size: 11px">{{ new Date(m.at).toLocaleString('zh-CN') }}</span>
          </div>
          <JsonBlock :value="m.payload" :label="`结构化载荷（${m.msgId}）`" :collapse-over="6" />
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <Button v-if="m.type === 'review_request' && !localMsgIds.has(m.msgId)" size="small" variant="outline" :disabled="!!receipts[m.msgId]" @click="acceptReviewRequest(m)">
              {{ receipts[m.msgId] ? '已输出裁决' : '受理并输出裁决' }}
            </Button>
            <Button v-if="m.type === 'blocker' && !localMsgIds.has(m.msgId)" size="small" variant="outline" :disabled="!!receipts[m.msgId]" @click="escalateToHuman(m)">
              {{ receipts[m.msgId] ? '已升级人类' : '升级人类' }}
            </Button>
            <Button v-if="m.type === 'question' && !localMsgIds.has(m.msgId)" size="small" variant="outline" :disabled="!!receipts[m.msgId]" @click="openReply(m)">
              {{ receipts[m.msgId] ? '已回复' : '回复' }}
            </Button>
            <CopyableId :id="m.msgId" label="复制消息 ID" />
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">通信模型（为什么不是聊天室）</div>
          <div class="oc-secondary" style="font-size: 12px">
            ① 结构化工件（黑板）是唯一事实源；② 定向消息用于协商/求助；③ 公告用于团队级通知。
            所有消息都携带类型 + 方向 + 关联任务，便于限流、审计与自动处置；自由文本无法被自动消费。
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CliHint command="oc team send --type blocker --to supervisor --task T-5a31 --payload payload.yaml" />
            <CopyableId id="trace-6e2af0b4" label="复制 traceId" />
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="replyOpen" header="回复求助（答案写入黑板）" width="560px" :footer="false">
      <div class="oc-stack">
        <div class="oc-muted" style="font-size: 12px">
          求助：{{ replyTarget ? String(replyTarget.payload.question ?? '') : '' }}（来自 {{ replyTarget?.dir.from }}，{{ replyTarget?.msgId }}）
        </div>
        <Textarea v-model="replyText" :autosize="{ minRows: 3 }" placeholder="填写可复用的答案：结论 + 依据 + 适用边界" />
        <div class="oc-flex" style="gap: 8px">
          <Button size="small" theme="primary" @click="confirmReply">确认回复</Button>
          <Button size="small" variant="outline" @click="replyOpen = false">取消</Button>
          <span class="oc-muted" style="font-size: 12px">确认后答案落黑板并生成 handoff 消息，后续同类求助直接引用。</span>
        </div>
      </div>
    </Dialog>
  </div>
</template>
