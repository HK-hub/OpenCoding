<script setup lang="ts">
/**
 * 审批卡预览区（字段 ② 动作摘要 / ③ 预览 / ④ 目标资源，impl/30 §6.1 字段序）：
 * ③ 始终按纯文本渲染（不做富文本解释，避免隐藏控制字符）；展开时才把 diff 结构化给 DiffView。
 * ④ 的「同动作 ×N」可展开看到每次目标资源（去重合并不隐藏信息）。
 */
import { computed, ref } from 'vue';
import { Button, Tag } from 'tdesign-vue-next';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile, DiffLine } from '@/components/common/DiffView.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import type { ApprovalRequest } from '@/mock/data/approval';

const props = defineProps<{
  approval: ApprovalRequest;
  /** 键盘焦点卡 */
  focused: boolean;
  /** 当前 Tab 命中的字段序号（0=①…6=⑦），本组件负责 1/2/3 */
  activeIndex: number;
  showDiff: boolean;
}>();

const emit = defineEmits<{ (e: 'update:showDiff', v: boolean): void }>();

const showDedupe = ref(false);
const tab = (n: number) => props.focused && props.activeIndex === n;

const kindText = computed(() => {
  switch (props.approval.preview.kind) {
    case 'diff':
      return '文件 diff（hunk 折叠，纯文本渲染）';
    case 'command':
      return '命令全文（纯文本渲染，已清洗控制字符）';
    case 'network':
      return '网络目标（出网审计）';
    default:
      return '无文件/命令预览（见影响面估计）';
  }
});

const previewLines = computed(() => {
  const p = props.approval.preview;
  if (p.kind === 'command' && p.commandFullText) return p.commandFullText;
  if (p.kind === 'diff' && p.diff) return p.diff;
  if (p.kind === 'network' && p.networkTarget) return `网络目标：${p.networkTarget}`;
  return '（该动作无文件/命令预览；以下为影响面估计）';
});

/** 统一 diff 文本 → DiffView 结构化（仅展开时使用） */
const diffFiles = computed<DiffFile[]>(() => {
  const text = props.approval.preview.diff;
  if (!text) return [];
  const lines: DiffLine[] = [];
  let path = props.approval.actionSummary.targetResource;
  let additions = 0;
  let deletions = 0;
  let oldNo = 0;
  let newNo = 0;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('--- ')) {
      path = raw.slice(4).replace(/^[ab]\//, '');
      continue;
    }
    if (raw.startsWith('+++ ')) continue;
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(raw);
    if (hunk) {
      oldNo = Number(hunk[1]);
      newNo = Number(hunk[2]);
      lines.push({ type: 'ctx', text: raw });
    } else if (raw.startsWith('+')) {
      lines.push({ type: 'add', newLine: newNo, text: raw.slice(1) });
      additions += 1;
      newNo += 1;
    } else if (raw.startsWith('-')) {
      lines.push({ type: 'del', oldLine: oldNo, text: raw.slice(1) });
      deletions += 1;
      oldNo += 1;
    } else {
      lines.push({ type: 'ctx', oldLine: oldNo, newLine: newNo, text: raw.startsWith(' ') ? raw.slice(1) : raw });
      oldNo += 1;
      newNo += 1;
    }
  }
  return [{ path, additions, deletions, lines }];
});
</script>

<template>
  <div class="oc-acard__row" :class="{ 'oc-acard__row--tab': tab(1) }">
    <div style="font-weight: 600; font-size: 13px">{{ approval.actionSummary.humanReadableDesc }}</div>
    <div class="oc-muted" style="font-size: 11px">
      ② 动作摘要 · 工具 <span class="oc-mono">{{ approval.actionSummary.tool }}</span> · 责任记录：
      {{ approval.requesterIdentity.name }}（{{ approval.requesterIdentity.kind }}）
    </div>
  </div>

  <div class="oc-acard__row" :class="{ 'oc-acard__row--tab': tab(2) }">
    <div class="oc-flex--between" style="margin-bottom: 4px">
      <span class="oc-secondary" style="font-size: 12px">③ 预览 · {{ kindText }}</span>
      <Button v-if="approval.preview.diff" size="small" variant="text" @click.stop="emit('update:showDiff', !showDiff)">
        {{ showDiff ? '收起 diff（D）' : '查看 diff（D）' }}
      </Button>
    </div>
    <pre class="oc-pre" style="max-height: 190px">{{ previewLines }}</pre>
    <div v-if="approval.preview.blastRadiusEstimate" class="oc-muted" style="font-size: 11px; margin-top: 4px">
      影响面估计：{{ approval.preview.blastRadiusEstimate }}
    </div>
    <DiffView v-if="showDiff && diffFiles.length" :files="diffFiles" style="margin-top: 8px" />
  </div>

  <div class="oc-acard__row" :class="{ 'oc-acard__row--tab': tab(3) }">
    <div class="oc-flex oc-flex--wrap" style="gap: 6px">
      <OcIcon name="folder" size="13px" />
      <span class="oc-secondary" style="font-size: 12px">④ 目标资源</span>
      <span class="oc-mono">{{ approval.actionSummary.targetResource }}</span>
      <Tag v-if="approval.dedupeWindowCount > 1" size="small" theme="warning" variant="light-outline">
        同动作 ×{{ approval.dedupeWindowCount }}（展开可见每次目标）
      </Tag>
      <Button v-if="approval.dedupeWindowCount > 1" size="small" variant="text" @click.stop="showDedupe = !showDedupe">
        {{ showDedupe ? '收起每次目标' : '展开每次目标' }}
      </Button>
    </div>
    <div v-if="showDedupe && approval.dedupeWindowCount > 1" class="oc-stack" style="margin-top: 4px">
      <div v-for="t in approval.dedupeTargets" :key="t" class="oc-mono oc-muted" style="font-size: 11px">· {{ t }}</div>
    </div>
  </div>
</template>
