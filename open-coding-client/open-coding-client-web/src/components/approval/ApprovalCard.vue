<script setup lang="ts">
/**
 * 审批卡（唯一权威字段序 ①–⑦，impl/30 §6.1）：
 * ① 风险徽标 → ② 动作摘要 → ③ 预览（纯文本）→ ④ 目标资源 → ⑤ 授权范围 chips
 * → ⑥ 倒计时与超时动作 → ⑦ action_digest 短前缀（人工核对）。
 * 键盘：A 批准本次 / S 批准并授予范围 / R 拒绝本次 / Shift+R 拒绝并终止 / D 查看 diff / Tab 字段移动 / Esc 收起。
 * 硬约束：R4/R5 与无法解析命令仅「仅本次」（scopeOptions 只含 once）；倒计时仅展示（300s 兜底），终态以服务端为准。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Button, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import type { ApprovalRequest, GrantScope } from '@/mock/data/approval';
import { SCOPE_CATALOG, STATE_META } from '@/mock/data/approval';
import RiskBadge from '@/components/common/RiskBadge.vue';
import ApprovalPreview from './ApprovalPreview.vue';
import OcIcon from '@/components/common/OcIcon.vue';

const props = withDefaults(
  defineProps<{
    approval: ApprovalRequest;
    /** 键盘焦点卡（仅焦点卡响应 A/S/R/D/Tab，避免全局误触） */
    focused?: boolean;
    /** 历史只读模式：不出现决策按钮 */
    readonly?: boolean;
    selectable?: boolean;
    selected?: boolean;
  }>(),
  { focused: false, readonly: false, selectable: false, selected: false },
);

const emit = defineEmits<{
  (e: 'approve', scope: GrantScope): void;
  (e: 'deny', payload: { reason: string; cascade: boolean }): void;
  (e: 'focus'): void;
  (e: 'toggle-select'): void;
}>();

const stateMeta = computed(() => STATE_META[props.approval.state]);
const pending = computed(() => props.approval.state === 'Requested');
const selectedScope = ref<GrantScope>(props.approval.scopeOptions[0]);
const showDiff = ref(false);
const showReject = ref(false);
const rejectReason = ref('');
const fieldIndex = ref(0);
const FIELD_COUNT = 7;

/** 倒计时仅展示：端上不判定超时终态（以服务端事件为准） */
const now = ref(Date.now());
let tick: number | undefined;
onMounted(() => {
  tick = window.setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => {
  if (tick) window.clearInterval(tick);
});

const remainingSec = computed(() => Math.round((new Date(props.approval.expiresAt).getTime() - now.value) / 1000));
const shownSec = computed(() => Math.max(0, Math.min(remainingSec.value, props.approval.displayCapSeconds)));
const displayExhausted = computed(() => remainingSec.value <= 0);

const scopeChip = (s: GrantScope) => SCOPE_CATALOG.find((c) => c.scope === s)?.chip ?? s;
const scopeSemantic = (s: GrantScope) => SCOPE_CATALOG.find((c) => c.scope === s)?.semantic ?? '';
const scopeLocked = computed(() => props.approval.scopeOptions.length === 1 && props.approval.scopeOptions[0] === 'once');

/** 范围展开预览（禁止盲授）：确认前必须能看到该范围将覆盖什么、什么不会被覆盖 */
function scopePreview(s: GrantScope): string[] {
  const target = props.approval.actionSummary.targetResource;
  const tool = props.approval.actionSummary.tool;
  switch (s) {
    case 'pattern':
      return [
        `匹配模式：${tool === 'run_command' ? 'mvn * test*' : `${tool}(${target})`}`,
        '模式在确认前可见；不匹配的命令仍会重新询问（模式覆盖不了的行为不留存）',
      ];
    case 'dir':
      return [`目录：${target}`, '仅该目录下的同类写操作生效，目录外仍需单独确认'];
    case 'workspace':
      return [`工作区：${target}`, '工作区内同类动作生效；跨工作区不继承'];
    case 'project':
      return ['本项目内同类动作生效；换项目后需重新确认'];
    case 'session':
      return ['本会话内同类动作生效；会话结束后记忆失效'];
    default:
      return ['仅本次调用，不写入任何授权记忆'];
  }
}

function approve(scope: GrantScope) {
  emit('approve', scope);
}

function submitReject(cascade: boolean) {
  emit('deny', { reason: rejectReason.value || (cascade ? '拒绝并终止（级联）' : '拒绝本次'), cascade });
  showReject.value = false;
}

/** 键盘语义：A/S/R/Shift+R/D/Tab（输入框内不拦截，避免误触决策） */
function onKey(e: KeyboardEvent) {
  if (!props.focused || props.readonly || !pending.value) return;
  const target = e.target as HTMLElement | null;
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
  const key = e.key.toUpperCase();
  if (key === 'A') {
    e.preventDefault();
    approve('once');
  } else if (key === 'S') {
    e.preventDefault();
    approve(selectedScope.value);
  } else if (key === 'R') {
    e.preventDefault();
    if (e.shiftKey) submitReject(true);
    else showReject.value = true;
  } else if (key === 'D') {
    e.preventDefault();
    showDiff.value = !showDiff.value;
  } else if (e.key === 'Tab') {
    e.preventDefault();
    fieldIndex.value = (fieldIndex.value + (e.shiftKey ? FIELD_COUNT - 1 : 1)) % FIELD_COUNT;
  }
}

onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div
    class="oc-acard"
    :class="{ 'oc-acard--focused': focused, 'oc-acard--done': !pending, 'oc-acard--locked': scopeLocked }"
    tabindex="0"
    @click="emit('focus')"
  >
    <!-- ① 风险徽标与状态 -->
    <div class="oc-flex--between oc-acard__row" :class="{ 'oc-acard__row--tab': focused && fieldIndex === 0 }">
      <div class="oc-flex oc-flex--wrap" style="gap: 6px">
        <RiskBadge :level="approval.riskClass" />
        <Tag :theme="stateMeta.theme" size="small" variant="light-outline">{{ stateMeta.label }}</Tag>
        <Tag v-if="scopeLocked" size="small" variant="outline">范围锁定：仅本次</Tag>
        <Tag v-if="approval.requesterIdentity.kind === 'external'" size="small" theme="warning" variant="light-outline">
          外部调用方请求
        </Tag>
      </div>
      <div class="oc-flex" style="gap: 6px">
        <Button v-if="selectable" size="small" variant="text" @click.stop="emit('toggle-select')">
          <OcIcon :name="selected ? 'task-checked' : 'task'" size="13px" />
          {{ selected ? '已选入批量' : '选入批量' }}
        </Button>
        <Tooltip content="用于自审的异常注入：审批链路不可用时的错误态">
          <span class="oc-muted" style="font-size: 11px">审批号 {{ approval.approvalId }}</span>
        </Tooltip>
      </div>
    </div>

    <!-- ②③④ 预览区 -->
    <ApprovalPreview
      :approval="approval"
      :focused="focused"
      :active-index="fieldIndex"
      :show-diff="showDiff"
      @update:show-diff="(v: boolean) => (showDiff = v)"
    />

    <!-- ⑤ 授权范围 chips（与六级授权记忆一一对应） -->
    <div class="oc-acard__row" :class="{ 'oc-acard__row--tab': focused && fieldIndex === 4 }">
      <div class="oc-flex oc-flex--wrap" style="gap: 6px">
        <span class="oc-secondary" style="font-size: 12px">⑤ 授权范围</span>
        <Tooltip
          v-for="s in approval.scopeOptions"
          :key="s"
          :content="`${scopeSemantic(s)}｜${SCOPE_CATALOG.find((c) => c.scope === s)?.availability ?? ''}`"
        >
          <Tag
            :theme="selectedScope === s ? 'primary' : 'default'"
            :variant="selectedScope === s ? 'light' : 'outline'"
            size="small"
            style="cursor: pointer"
            @click.stop="selectedScope = s"
          >
            {{ scopeChip(s) }}
          </Tag>
        </Tooltip>
        <Tooltip :content="approval.scopeLockedReason ?? 'R4/R5 与无法解析的命令只提供「仅本次」，不留存授权'">
          <Tag size="small" variant="outline" style="border-style: dashed">
            {{ scopeLocked ? '为何只有仅本次' : '范围约束' }}
          </Tag>
        </Tooltip>
      </div>
      <div v-if="!scopeLocked || selectedScope !== 'once'" class="oc-acard__scopepreview">
        <div class="oc-muted" style="font-size: 11px">范围展开预览（禁止盲授，确认前可见）：</div>
        <div v-for="p in scopePreview(selectedScope)" :key="p" class="oc-secondary" style="font-size: 11px">· {{ p }}</div>
      </div>
    </div>

    <!-- ⑥ 倒计时与超时动作（端上仅展示，不裁定结果） -->
    <div class="oc-flex oc-flex--wrap oc-acard__row" :class="{ 'oc-acard__row--tab': focused && fieldIndex === 5 }" style="gap: 6px">
      <span class="oc-secondary" style="font-size: 12px">⑥ 倒计时</span>
      <Tag v-if="pending && !displayExhausted" size="small" theme="warning" variant="light-outline">
        剩余 {{ shownSec }}s（展示上限 {{ approval.displayCapSeconds }}s）
      </Tag>
      <Tag v-else-if="pending" size="small" theme="default" variant="light-outline">展示时限已到 · 等待内核裁定</Tag>
      <span class="oc-muted" style="font-size: 11px">
        超时动作：{{ approval.timeout.timeoutAction === 'deny' ? '按策略拒绝（deny，不计入用户主动拒绝）' : '升级至上级审批人（escalate）' }}
      </span>
      <Tooltip content="端上不得本地判定超时结果：终态由服务端事件裁定；仅通道全断/应答者缺失才是「无人应答」。">
        <span class="oc-muted" style="font-size: 11px; text-decoration: underline dotted; cursor: help">为什么不在这里判定结果</span>
      </Tooltip>
    </div>

    <!-- ⑦ action_digest 短前缀（人工核对） -->
    <div class="oc-flex oc-flex--wrap oc-acard__row" :class="{ 'oc-acard__row--tab': focused && fieldIndex === 6 }" style="gap: 6px">
      <span class="oc-secondary" style="font-size: 12px">⑦ action_digest</span>
      <span class="oc-mono">{{ approval.actionDigest }}</span>
      <span class="oc-muted" style="font-size: 11px">（服务端计算，端上不重算；供人工核对预览与摘要一致）</span>
    </div>

    <!-- 决策动作条（仅待审批且非只读） -->
    <div v-if="pending && !readonly" class="oc-acard__row oc-flex oc-flex--wrap" style="gap: 6px">
      <Button size="small" theme="primary" @click.stop="approve('once')">批准本次（A）</Button>
      <Button size="small" variant="outline" @click.stop="approve(selectedScope)">批准并授予「{{ scopeChip(selectedScope) }}」（S）</Button>
      <Button size="small" variant="outline" @click.stop="showReject = !showReject">拒绝本次（R）</Button>
      <Button size="small" variant="outline" @click.stop="submitReject(true)">拒绝并终止（Shift+R）</Button>
      <span class="oc-muted" style="font-size: 11px">Tab 在 ①–⑦ 字段间移动；Esc 收起不产生决策</span>
    </div>

    <div v-if="showReject" class="oc-flex" style="gap: 6px">
      <Textarea v-model="rejectReason" placeholder="拒绝理由（可选，会写入不可变审计记录）" :autosize="{ minRows: 1, maxRows: 3 }" style="flex: 1" />
      <Button size="small" theme="danger" @click.stop="submitReject(false)">确认拒绝</Button>
    </div>

    <!-- 终态留痕（历史只读） -->
    <div v-if="!pending" class="oc-acard__row">
      <div class="oc-muted" style="font-size: 11px">
        应答人：{{ approval.respondedBy ?? '—' }} ·
        {{ approval.respondedAt ? new Date(approval.respondedAt).toLocaleString('zh-CN') : '—' }}
        <template v-if="approval.grantScope"> · 授予范围：{{ scopeChip(approval.grantScope) }}</template>
        <template v-if="approval.reason"> · 理由：{{ approval.reason }}</template>
      </div>
      <div class="oc-muted" style="font-size: 11px">风险理由：{{ approval.riskReason }}</div>
    </div>
  </div>
</template>

<style scoped>
.oc-acard {
  border: 1px solid var(--oc-border);
  border-left: 3px solid var(--oc-risk-r2);
  border-radius: 6px;
  background: var(--oc-bg-container);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
}

.oc-acard--focused {
  border-color: var(--td-brand-color, #0052d9);
  box-shadow: 0 0 0 2px var(--td-brand-color-light, #eaf1ff);
}

.oc-acard--done {
  border-left-color: var(--oc-sev-ok);
  background: var(--oc-bg-elevated);
  cursor: default;
}

.oc-acard--locked {
  border-left-color: var(--oc-risk-r4);
}

.oc-acard__row {
  position: relative;
}

.oc-acard__row--tab::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 2px;
  bottom: 2px;
  width: 3px;
  border-radius: 2px;
  background: var(--td-brand-color, #0052d9);
}

.oc-acard__scopepreview {
  margin-top: 6px;
  padding: 6px 8px;
  background: var(--td-bg-color-secondarycontainer, #f6f6f6);
  border-radius: 4px;
}
</style>
