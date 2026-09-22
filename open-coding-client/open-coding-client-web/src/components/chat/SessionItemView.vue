<script setup lang="ts">
/**
 * 会话条目渲染器：按 Item 类型分层渲染（卷 22 §4.3 会话流规范）。
 * - 用户 / 助手 / 系统 三类视觉分层
 * - 工具卡：摘要 + 耗时 + 结果引用（可展开原文）
 * - 审批卡：字段顺序 ①–⑦ + 六级范围 chips + 倒计时 + 键盘 A/S/R/D/Shift+R
 * - 计划卡 / 检查点 / 子 Agent / 通知
 */
import { computed, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Progress, RadioGroup, RadioButton, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import type { SessionItem } from '@/mock/data/session';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import OcIcon from '@/components/common/OcIcon.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';

const props = defineProps<{ item: SessionItem; index: number }>();
const store = useSessionStore();

const showThinking = ref(false);
const showToolDetail = ref(false);
const approvalScope = ref('once');
const rejectReason = ref('');
const hideReject = ref(false);
const showReject = ref(false);

/** 结构化提问（ask_user）的本地选择态：回答后写入条目并置灰 */
const askSelection = ref<string[]>([]);
const askFreeText = ref('');

function toggleAskOption(value: string) {
  const ask = props.item.ask;
  if (!ask || ask.answer) return;
  if (ask.multiple) {
    askSelection.value = askSelection.value.includes(value)
      ? askSelection.value.filter((v) => v !== value)
      : [...askSelection.value, value];
  } else {
    askSelection.value = askSelection.value[0] === value ? [] : [value];
  }
}

function submitAsk() {
  const ask = props.item.ask;
  if (!ask || !askSelection.value.length) return;
  ask.answer = { selected: [...askSelection.value], freeText: askFreeText.value || undefined, at: new Date().toISOString() };
  const ui = useUiStore();
  ui.announce('回答已提交，Agent 将在下一个安全点继续执行。');
  ui.pushNotification({
    kind: 'task_done',
    level: 'P2',
    title: '已回答提问',
    body: `${ask.question.slice(0, 40)}… → ${askSelection.value.join(' / ')}`,
    actions: [],
    aggregateKey: `ask-${props.item.itemId}`,
    penetrateQuiet: false,
    channel: 'inapp',
  });
}

const isUser = computed(() => props.item.actor === 'user');
const isSystem = computed(() => props.item.actor === 'system');

/** 审批卡字段顺序：①风险徽标 ②动作摘要 ③预览 ④目标资源 ⑤范围 chips ⑥倒计时 ⑦digest 前缀 */
const approvalInfo = computed(() => {
  const a = props.item.approval;
  if (!a) return [];
  return [
    { key: 'action', label: '② 动作摘要', value: a.actionSummary, mono: true },
    { key: 'target', label: '④ 目标资源', value: a.targetResource, mono: true },
    { key: 'timeout', label: '⑥ 超时', value: `${new Date(a.expiresAt).toLocaleTimeString('zh-CN')} 超时 → 按策略${a.timeoutAction === 'deny' ? '拒绝' : '升级'}` },
  ];
});

const SCOPE_TEXT: Record<string, string> = {
  once: '仅本次',
  session: '本会话',
  project: '本项目',
  workspace: '本工作区',
  pattern: '按模式',
  dir: '按目录',
};

const remaining = computed(() => {
  const a = props.item.approval;
  if (!a) return 0;
  return Math.max(0, Math.round((new Date(a.expiresAt).getTime() - Date.now()) / 1000));
});

/** 复制消息正文（浏览器剪贴板） */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* 剪贴板不可用时静默，不阻塞交互 */
  }
}

/** 反馈：好评 / 点踩写入条目本身，按钮随之置灰；结果进入评测与复核链路 */
function vote(v: 'up' | 'down') {
  const it = props.item;
  if (it.feedback) {
    MessagePlugin.info('已提交过反馈，复核结果会回写会话时间线');
    return;
  }
  it.feedback = { vote: v, at: new Date().toISOString() };
  const ui = useUiStore();
  if (v === 'up') {
    MessagePlugin.success('已记为好评：进入模型路由与提示词评测的正样本');
    ui.announce('已记为好评，用于同类任务的模型路由偏好。');
  } else {
    MessagePlugin.warning('已记为点踩：进入人工复核队列，并标注失败模式');
    ui.pushNotification({
      kind: 'task_done',
      level: 'P2',
      title: '已记录点踩',
      body: '该结论进入人工复核队列；复核与整改结果会回写会话时间线。',
      actions: [{ label: '查看评测任务集', path: '/quality/eval-tasks' }],
      aggregateKey: `fb-${it.itemId}`,
      penetrateQuiet: false,
      channel: 'inapp',
    });
  }
}

/** 外置结果的分页回读：按行窗口翻页，不整包注入上下文 */
const ARTIFACT_PAGES = 4;
const showArtifact = ref(false);
const artifactPage = ref(0);
const artifactPageText = computed(() => {
  const t = props.item.tool;
  const ref = t?.artifactRef ?? 'artifact://unknown';
  const totalLines = 120 + ((t?.resultSummary?.length ?? 20) % 80);
  const per = Math.ceil(totalLines / ARTIFACT_PAGES);
  const from = artifactPage.value * per + 1;
  const to = Math.min(totalLines, from + per - 1);
  return [
    `来源：${ref}`,
    `行窗口 ${from}–${to} / 共 ${totalLines} 行（按需回读，回读内容不写入上下文预算）`,
    '',
    t?.resultSummary ?? '（该次调用未返回摘要）',
    '…（原文已外置到对象存储，翻页继续回读）',
  ].join('\n');
});

function toggleArtifact() {
  showArtifact.value = !showArtifact.value;
  if (showArtifact.value) artifactPage.value = 0;
}

/** 审批卡 diff：从预览文本解析增删行，交给 DiffView 渲染（并排/内联切换） */
const showApprovalDiff = ref(false);
const approvalDiffFiles = computed<DiffFile[]>(() => {
  const a = props.item.approval;
  if (!a) return [];
  let oldLine = 1;
  let newLine = 1;
  const lines = a.preview.split('\n').map((text) => {
    if (text.startsWith('+')) return { type: 'add' as const, newLine: newLine++, text: text.slice(1) };
    if (text.startsWith('-')) return { type: 'del' as const, oldLine: oldLine++, text: text.slice(1) };
    return { type: 'ctx' as const, oldLine: oldLine++, newLine: newLine++, text };
  });
  return [{
    path: a.previewKind === 'diff' ? 'src/main/java/com/acme/payment/PaymentServiceImpl.java' : 'command.preview.sh',
    language: a.previewKind === 'diff' ? 'java' : 'shell',
    additions: lines.filter((l) => l.type === 'add').length,
    deletions: lines.filter((l) => l.type === 'del').length,
    lines,
  }];
});

/** 计划卡：就地编辑步骤（保留既有完成状态），保存后标记为已重规划且可回滚 */
const planEditing = ref(false);
const planDraft = ref('');

function beginPlanEdit() {
  planDraft.value = (props.item.plan?.steps ?? []).map((s) => s.text).join('\n');
  planEditing.value = true;
}

function savePlanEdit() {
  const steps = planDraft.value.split('\n').map((t) => t.trim()).filter(Boolean);
  if (!steps.length) {
    MessagePlugin.warning('计划至少需要一步，已保留原计划');
    return;
  }
  const old = props.item.plan?.steps ?? [];
  if (props.item.plan) {
    props.item.plan.steps = steps.map((text, i) => ({ text, status: old[i]?.status ?? 'todo' }));
    props.item.plan.changeReason = `用户手工编辑计划于 ${new Date().toLocaleTimeString('zh-CN')}：保留原步骤完成状态，旧版计划仍在时间线可回滚`;
  }
  planEditing.value = false;
  MessagePlugin.success(`计划已更新为 ${steps.length} 步（已标记重规划，可回滚）`);
}

/** 检查点恢复：截断到该检查点，重放跳过已登记副作用；追加系统通知留痕 */
function restoreCheckpoint() {
  const cp = props.item.checkpoint;
  if (!cp || cp.restoredAt) return;
  cp.restoredAt = new Date().toISOString();
  const last = store.items[store.items.length - 1];
  const seq = (last?.seq ?? props.item.seq) + 1;
  store.items.push({
    itemId: `it_${seq.toString(36)}`,
    seq,
    turnNo: props.item.turnNo,
    type: 'notice',
    actor: 'system',
    at: new Date().toISOString(),
    notice: {
      level: 'info',
      text: `已恢复到检查点 ${cp.checkpointId}（第 ${cp.stepNo} 步）：重放将跳过 ${cp.sideEffects} 项已登记副作用；可从此处开新分支。`,
    },
  });
  useUiStore().announce('已恢复到该检查点，后续重放会跳过已登记副作用。');
}

/** 子 Agent 完整轨迹：展开派发 → 工具 → 预算 → 结果契约的链路 */
const showTrajectory = ref(false);
const trajectory = computed(() => {
  const sa = props.item.subagent;
  if (!sa) return [];
  return [
    `1. 派发：向子 Agent「${sa.agent}」发送任务简报（深度 ${sa.depth}；权限为父级收窄子集，越界调用会被拒绝并记审计）`,
    `2. 工具子集：${sa.tools.join(' / ')}`,
    `3. 预算信封：${sa.budget}`,
    `4. 结果回传：${sa.result ?? '（尚未回传，回传后写入本轨迹）'}`,
    '5. 收口：结论/证据/未决问题按结果契约回填父会话；本轨迹只读。',
  ];
});

function approve(scope = 'once') {
  store.respond(props.item, scope === 'once' ? 'ALLOW_ONCE' : 'ALLOW', scope);
}

function reject() {
  store.respond(props.item, 'DENY', 'once', rejectReason.value || undefined);
  showReject.value = false;
}

const TOOL_STATUS: Record<string, { text: string; theme: 'success' | 'warning' | 'danger' | 'primary' | 'default' }> = {
  pending: { text: '待执行', theme: 'default' },
  running: { text: '执行中', theme: 'primary' },
  completed: { text: '完成', theme: 'success' },
  failed: { text: '失败', theme: 'danger' },
  blocked: { text: '被阻断', theme: 'danger' },
  awaiting_approval: { text: '等待审批', theme: 'warning' },
};
</script>

<template>
  <div class="oc-item" :class="{ 'oc-item--user': isUser, 'oc-item--system': isSystem }">
    <!-- 用户消息：支持编辑重发 / 分叉 -->
    <template v-if="item.type === 'user_message'">
      <div class="oc-item__bubble">
        <div class="oc-item__text">{{ item.text }}</div>
        <div class="oc-item__meta">
          <span>{{ new Date(item.at).toLocaleTimeString('zh-CN') }}</span>
          <Button size="small" variant="text" @click="store.beginEdit(item.itemId, item.text ?? '')">编辑重发</Button>
          <Button size="small" variant="text" @click="store.fork(item.itemId)">从此分叉</Button>
          <Button size="small" variant="text" @click="store.bookmark(item.itemId, '用户消息书签')">书签</Button>
        </div>
      </div>
    </template>

    <!-- 助手消息：推理折叠 + Markdown 文本 + 操作条 -->
    <template v-else-if="item.type === 'assistant_message'">
      <div class="oc-item__body">
        <button v-if="item.thinking" type="button" class="oc-item__thinking" @click="showThinking = !showThinking">
          <OcIcon name="lightbulb" size="13px" />
          <span>{{ showThinking ? '收起推理链' : '查看推理链（默认折叠）' }}</span>
          <OcIcon :name="showThinking ? 'browse' : 'browse'" size="12px" />
        </button>
        <pre v-if="showThinking && item.thinking" class="oc-pre" style="font-family: inherit">{{ item.thinking }}</pre>
        <div class="oc-item__text oc-item__text--md" :class="{ 'oc-caret': store.streaming && index === 0 }">
          <template v-for="(line, i) in (item.text ?? '').split('\n')" :key="i">
            <div v-if="line.startsWith('| ')" class="oc-md__tr">{{ line }}</div>
            <div v-else-if="line.startsWith('**')" class="oc-md__b">{{ line.replaceAll('**', '') }}</div>
            <div v-else>{{ line.replaceAll('**', '') }}</div>
          </template>
        </div>
        <div class="oc-item__actions">
          <Button size="small" variant="text" @click="store.send('继续，请按计划执行下一步。')">重新生成</Button>
          <Button size="small" variant="text" @click="copyText(item.text ?? '')">复制</Button>
          <Button size="small" variant="text" :disabled="!!item.feedback" @click="vote('up')">好评</Button>
          <Button size="small" variant="text" :disabled="!!item.feedback" @click="vote('down')">点踩</Button>
          <Tag v-if="item.feedback" size="small" :theme="item.feedback.vote === 'up' ? 'success' : 'warning'" variant="light-outline">
            {{ item.feedback.vote === 'up' ? '已好评' : '已点踩' }}
          </Tag>
          <Button size="small" variant="text" @click="store.bookmark(item.itemId, '结论书签')">书签</Button>
          <Button size="small" variant="text" @click="store.fork(item.itemId)">从此分叉</Button>
          <span class="oc-muted" style="font-size: 11px">seq {{ item.seq }} · {{ new Date(item.at).toLocaleTimeString('zh-CN') }}</span>
        </div>
      </div>
    </template>

    <!-- 工具调用卡 -->
    <template v-else-if="item.type === 'tool_call' && item.tool">
      <div class="oc-card oc-tool">
        <div class="oc-flex--between">
          <div class="oc-flex" style="gap: 6px; min-width: 0">
            <OcIcon name="tools" size="14px" />
            <b class="oc-mono" style="font-size: 12px">{{ item.tool.name }}</b>
            <span class="oc-secondary oc-truncate" style="font-size: 12px">{{ item.tool.summary }}</span>
          </div>
          <div class="oc-flex" style="gap: 6px">
            <RiskBadge :level="item.tool.risk" />
            <Tag :theme="TOOL_STATUS[item.tool.status].theme" size="small" variant="light-outline">
              {{ TOOL_STATUS[item.tool.status].text }}
            </Tag>
            <span v-if="item.tool.durationMs" class="oc-muted" style="font-size: 11px">{{ item.tool.durationMs }}ms</span>
            <Button size="small" variant="text" @click="showToolDetail = !showToolDetail">{{ showToolDetail ? '收起' : '展开' }}</Button>
          </div>
        </div>

        <div v-if="showToolDetail" class="oc-stack" style="margin-top: 8px">
          <InfoGrid
            :columns="2"
            :items="[
              { key: 'callId', label: '调用 ID', value: item.tool.callId, mono: true, copyable: true },
              { key: 'cache', label: '缓存', value: item.tool.cacheHit ? '命中（只读缓存，参数+工作区版本为键）' : '未命中' },
              { key: 'result', label: '结果摘要', value: item.tool.resultSummary, block: true },
              { key: 'args', label: '参数（已脱敏）', value: JSON.stringify(item.tool.args, null, 2), block: true },
            ]"
          />
          <div v-if="item.tool.externalized" class="oc-flex" style="gap: 6px">
            <Tag size="small" theme="warning" variant="light-outline">结果已外置</Tag>
            <span class="oc-mono" style="font-size: 11px">{{ item.tool.artifactRef }}</span>
            <Button size="small" variant="text" @click="toggleArtifact()">{{ showArtifact ? '收起回读' : '分页回读' }}</Button>
          </div>
          <div v-if="showArtifact" class="oc-stack" style="gap: 6px">
            <pre class="oc-pre" style="max-height: 150px">{{ artifactPageText }}</pre>
            <div class="oc-flex" style="gap: 6px; align-items: center">
              <Button size="small" variant="outline" :disabled="artifactPage === 0" @click="artifactPage -= 1">上一页</Button>
              <Button size="small" variant="outline" :disabled="artifactPage >= ARTIFACT_PAGES - 1" @click="artifactPage += 1">下一页</Button>
              <span class="oc-muted" style="font-size: 11px">第 {{ artifactPage + 1 }} / {{ ARTIFACT_PAGES }} 页</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 审批卡 -->
    <template v-else-if="item.type === 'approval' && item.approval">
      <div class="oc-card oc-approval" :class="{ 'oc-approval--done': item.approval.decision }">
        <div class="oc-flex--between" style="align-items: flex-start">
          <div class="oc-flex" style="gap: 8px; align-items: flex-start">
            <RiskBadge :level="item.approval.riskLevel" />
            <div>
              <div style="font-weight: 600; font-size: 13px">{{ item.approval.actionSummary }}</div>
              <div class="oc-muted" style="font-size: 11px">
                {{ item.approval.previewKind === 'diff' ? '文件变更预览' : '命令全文预览（纯文本渲染，已清洗控制字符）' }}
              </div>
            </div>
          </div>
          <div class="oc-flex" style="gap: 6px">
            <template v-if="item.approval.decision">
              <Tag :theme="item.approval.decision === 'DENY' ? 'danger' : 'success'" size="small">
                {{ item.approval.decision === 'DENY' ? '已按用户拒绝' : item.approval.decision === 'ALLOW_ONCE' ? '已批准（仅本次）' : '已批准' }}
              </Tag>
            </template>
            <template v-else>
              <Tag size="small" theme="warning" variant="light-outline">剩余 {{ remaining }}s</Tag>
            </template>
          </div>
        </div>

        <pre class="oc-pre" style="margin-top: 8px; max-height: 180px">{{ item.approval.preview }}</pre>

        <InfoGrid :columns="1" :items="approvalInfo" style="margin-top: 8px" />

        <div v-if="!item.approval.decision" class="oc-stack" style="margin-top: 10px">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <span class="oc-secondary" style="font-size: 12px">⑤ 授权范围：</span>
            <Tag
              v-for="s in item.approval.scopeOptions"
              :key="s"
              :theme="approvalScope === s ? 'primary' : 'default'"
              :variant="approvalScope === s ? 'light' : 'outline'"
              size="small"
              style="cursor: pointer"
              @click="approvalScope = s"
            >
              {{ SCOPE_TEXT[s] }}
            </Tag>
            <Tooltip content="R4/R5 与无法解析的命令只提供「仅本次」，不留存授权">
              <Tag size="small" variant="outline" style="border-style: dashed">范围约束</Tag>
            </Tooltip>
          </div>
          <div class="oc-flex" style="gap: 6px">
            <Button size="small" theme="primary" @click="approve(approvalScope)">批准（A）</Button>
            <Button size="small" variant="outline" @click="approve('once')">批准并授范围（S）</Button>
            <Button size="small" variant="outline" @click="showReject = !showReject">拒绝（R）</Button>
            <Button size="small" variant="outline" @click="store.respond(item, 'DENY', 'once', '级联终止')">拒绝并终止（Shift+R）</Button>
            <Button size="small" variant="text" @click="showApprovalDiff = !showApprovalDiff">{{ showApprovalDiff ? '收起 diff' : '查看 diff（D）' }}</Button>
          </div>
          <div v-if="showReject" class="oc-flex" style="gap: 6px">
            <Textarea v-model="rejectReason" placeholder="拒绝理由（可选，会写入不可变审计记录）" :autosize="{ minRows: 1, maxRows: 3 }" style="flex: 1" />
            <Button size="small" theme="danger" @click="reject">确认拒绝</Button>
          </div>
          <div v-if="showApprovalDiff" style="margin-top: 8px">
            <DiffView :files="approvalDiffFiles" :collapse-over="120" />
          </div>
        </div>

        <div class="oc-flex--between" style="margin-top: 8px">
          <span class="oc-muted" style="font-size: 11px">⑦ action_digest：{{ item.approval.actionDigest }}（人工核对用）</span>
          <CopyableId :id="item.approval.approvalId" label="复制审批号" />
        </div>
      </div>
    </template>

    <!-- 计划卡 -->
    <template v-else-if="item.type === 'plan' && item.plan">
      <div class="oc-card">
        <div class="oc-flex--between">
          <b style="font-size: 13px">本轮计划</b>
          <div class="oc-flex" style="gap: 6px">
            <Tag v-if="item.plan.changeReason" size="small" theme="warning" variant="light-outline">已重规划</Tag>
            <Button v-if="!planEditing" size="small" variant="text" @click="beginPlanEdit()">编辑计划</Button>
            <template v-else>
              <Button size="small" variant="text" @click="planEditing = false">取消</Button>
              <Button size="small" theme="primary" @click="savePlanEdit()">保存计划</Button>
            </template>
          </div>
        </div>
        <Textarea
          v-if="planEditing"
          v-model="planDraft"
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="每行一个步骤；保存后保留既有完成状态并标记为已重规划"
          style="margin-top: 8px"
        />
        <div v-if="!planEditing" class="oc-stack" style="gap: 4px; margin-top: 8px">
          <div v-for="(s, i) in item.plan.steps" :key="i" class="oc-flex" style="gap: 8px">
            <OcIcon
              :name="s.status === 'done' ? 'task-checked' : s.status === 'doing' ? 'loading' : 'task'"
              size="14px"
              :color="s.status === 'done' ? 'var(--oc-sev-ok)' : s.status === 'doing' ? 'var(--td-brand-color)' : 'var(--td-text-color-placeholder)'"
            />
            <span :style="s.status === 'done' ? 'text-decoration: line-through; opacity: .7' : ''">{{ s.text }}</span>
          </div>
        </div>
        <div v-if="item.plan.changeReason" class="oc-muted" style="font-size: 11px; margin-top: 6px">
          变更理由：{{ item.plan.changeReason }}
        </div>
      </div>
    </template>

    <!-- 检查点 -->
    <template v-else-if="item.type === 'checkpoint' && item.checkpoint">
      <div class="oc-item__checkpoint">
        <OcIcon name="bookmark" size="13px" />
        <span>检查点 {{ item.checkpoint.checkpointId }} · 第 {{ item.checkpoint.stepNo }} 步</span>
        <span class="oc-muted">副作用 {{ item.checkpoint.sideEffects }} 项（已登记，重放将跳过）</span>
        <Popconfirm content="恢复到该检查点会截断后续分支；已登记的副作用在重放时跳过，操作会写入审计。" @confirm="restoreCheckpoint">
          <Button size="small" variant="text" :disabled="!!item.checkpoint.restoredAt">{{ item.checkpoint.restoredAt ? '已恢复' : '恢复到此检查点' }}</Button>
        </Popconfirm>
      </div>
    </template>

    <!-- 子 Agent -->
    <template v-else-if="item.type === 'subagent' && item.subagent">
      <div class="oc-card" style="border-left: 3px solid var(--td-brand-color)">
        <div class="oc-flex--between">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon name="robot" size="14px" />
            <b style="font-size: 13px">子 Agent：{{ item.subagent.agent }}</b>
            <Tag size="small" variant="outline">深度 {{ item.subagent.depth }}</Tag>
            <Tag size="small" variant="outline">权限为父级收窄子集</Tag>
          </div>
          <Button size="small" variant="text" @click="showTrajectory = !showTrajectory">{{ showTrajectory ? '收起轨迹' : '展开完整轨迹' }}</Button>
        </div>
        <InfoGrid
          :columns="1"
          style="margin-top: 8px"
          :items="[
            { key: 'brief', label: '任务简报（目标/验收/约束/工具）', value: item.subagent.brief, block: true },
            { key: 'budget', label: '预算信封', value: item.subagent.budget },
            { key: 'tools', label: '工具子集', value: item.subagent.tools.join(' / ') },
            { key: 'result', label: '结果契约（结论/证据/未决问题）', value: item.subagent.result, block: true },
          ]"
        />
        <div v-if="showTrajectory" class="oc-stack" style="gap: 4px; margin-top: 8px">
          <div v-for="(t, i) in trajectory" :key="i" class="oc-flex" style="gap: 8px; align-items: flex-start">
            <OcIcon name="task" size="13px" />
            <span style="font-size: 12px">{{ t }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 结构化提问（ask_user）：选项可点选 + 可补充自由文本 + 已回答置灰 -->
    <template v-else-if="item.type === 'ask' && item.ask">
      <div class="oc-card oc-ask">
        <div class="oc-flex--between" style="align-items: flex-start">
          <div class="oc-flex" style="gap: 8px; align-items: flex-start">
            <OcIcon name="help" size="15px" />
            <div>
              <b style="font-size: 13px">{{ item.ask.question }}</b>
              <div class="oc-muted" style="font-size: 11px">
                {{ item.ask.multiple ? '可多选' : '单选' }}{{ item.ask.allowFreeText ? ' · 可补充说明' : '' }}
              </div>
            </div>
          </div>
          <Tag v-if="item.ask.answer" size="small" theme="success">已回答</Tag>
          <Tag v-else size="small" theme="warning" variant="light-outline">等待回答</Tag>
        </div>

        <div class="oc-stack" style="margin-top: 10px; gap: 6px">
          <button
            v-for="o in item.ask.options"
            :key="o.value"
            type="button"
            class="oc-ask__opt"
            :class="{ 'oc-ask__opt--on': askSelection.includes(o.value), 'oc-ask__opt--locked': !!item.ask.answer }"
            :disabled="!!item.ask.answer"
            @click="toggleAskOption(o.value)"
          >
            <OcIcon :name="askSelection.includes(o.value) ? 'check' : 'browse'" size="13px" />
            <span class="oc-grow">
              <b>{{ o.label }}</b>
              <span v-if="o.hint" class="oc-muted" style="font-size: 11px"> · {{ o.hint }}</span>
            </span>
          </button>
        </div>

        <Textarea
          v-if="item.ask.allowFreeText"
          v-model="askFreeText"
          :disabled="!!item.ask.answer"
          :autosize="{ minRows: 1, maxRows: 3 }"
          placeholder="补充说明（可选）：例如「回调侧的约定需要先确认，先只做回执接口」"
          style="margin-top: 8px"
        />

        <div v-if="!item.ask.answer" class="oc-stack" style="margin-top: 8px; gap: 6px">
          <div class="oc-muted" style="font-size: 11px">{{ item.ask.blocking }}</div>
          <div class="oc-flex" style="gap: 6px">
            <Button size="small" theme="primary" :disabled="!askSelection.length" @click="submitAsk()">提交回答</Button>
            <Button size="small" variant="text" @click="askSelection = []">清空选择</Button>
            <span class="oc-muted" style="font-size: 11px">
              等价 CLI：<span class="oc-mono">oc session answer --item {{ item.itemId }} --value {{ askSelection[0] ?? '<value>' }}</span>
            </span>
          </div>
        </div>
        <div v-else class="oc-muted" style="font-size: 12px; margin-top: 8px">
          已选：{{ item.ask.answer.selected.join(' / ') }}
          <template v-if="item.ask.answer.freeText"> · 补充：{{ item.ask.answer.freeText }}</template>
          · {{ new Date(item.ask.answer.at).toLocaleTimeString('zh-CN') }}
        </div>
      </div>
    </template>

    <!-- 系统通知 / 降级留痕 -->
    <template v-else-if="item.type === 'notice' && item.notice">
      <div class="oc-item__notice" :class="`oc-item__notice--${item.notice.level}`">
        <OcIcon :name="item.notice.level === 'error' ? 'error' : item.notice.level === 'warn' ? 'help' : 'system'" size="13px" />
        <span class="oc-grow">{{ item.notice.text }}</span>
        <CopyableId v-if="item.notice.traceId" :id="item.notice.traceId" label="复制 traceId" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.oc-item {
  padding: 2px 0;
}

.oc-item--user {
  display: flex;
  justify-content: flex-end;
}

.oc-item__bubble {
  max-width: 76%;
  background: var(--td-brand-color-light, #e6f0ff);
  border: 1px solid var(--td-brand-color-2, #cce0ff);
  border-radius: 8px 8px 2px 8px;
  padding: 8px 12px;
}

.oc-item__body {
  max-width: 100%;
}

.oc-item__text {
  font-size: 13px;
  line-height: 21px;
  white-space: pre-wrap;
  word-break: break-word;
}

.oc-md__b {
  font-weight: 600;
}

.oc-md__tr {
  font-family: var(--oc-mono);
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
  background: var(--td-bg-color-secondarycontainer, #f6f6f6);
  border-radius: 3px;
  padding: 0 6px;
}

.oc-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--td-text-color-secondary, #666);
}

.oc-item__thinking {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px dashed var(--oc-border-strong);
  background: transparent;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
  cursor: pointer;
  margin-bottom: 6px;
}

.oc-item__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
}

.oc-tool {
  border-left: 3px solid var(--td-brand-color);
  padding: 8px 12px;
}

.oc-approval {
  border-left: 3px solid var(--oc-risk-r2);
  background: var(--td-warning-color-1, #fff9f0);
}

.oc-approval--done {
  border-left-color: var(--oc-sev-ok);
  background: var(--oc-bg-container);
}

.oc-item__checkpoint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
  border-top: 1px dashed var(--oc-border-strong);
  border-bottom: 1px dashed var(--oc-border-strong);
  padding: 4px 2px;
}

.oc-ask {
  border-left: 3px solid var(--td-warning-color, #e37318);
  background: var(--td-warning-color-1, #fff9f0);
}

.oc-ask__opt {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: 1px solid var(--oc-border);
  border-radius: 6px;
  background: var(--oc-bg-container);
  padding: 8px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--td-text-color-primary);
}

.oc-ask__opt:hover:not(:disabled) {
  border-color: var(--td-brand-color, #0052d9);
}

.oc-ask__opt--on {
  border-color: var(--td-brand-color, #0052d9);
  background: var(--td-brand-color-light, #eaf1ff);
}

.oc-ask__opt--locked {
  cursor: default;
  opacity: 0.75;
}

.oc-item__notice {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 4px;
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
}

.oc-item__notice--warn {
  background: var(--td-warning-color-1, #fff1e9);
  color: var(--td-warning-color-7, #8c4a00);
}

.oc-item__notice--error {
  background: var(--td-error-color-1, #fff0ed);
  color: var(--td-error-color-7, #8e2b26);
}
</style>
