<script setup lang="ts">
/**
 * Diff 视图：并排 / 内联切换，块级接受/拒绝，超长折叠。
 * 对齐卷 22 界面规范与 impl/30 EDGE_DATA 要求（>2000 行按 hunk 折叠）。
 */
import { computed, ref } from 'vue';
import { Button, RadioGroup, RadioButton, Tag } from 'tdesign-vue-next';
import OcIcon from './OcIcon.vue';

export interface DiffLine {
  type: 'add' | 'del' | 'ctx';
  oldLine?: number;
  newLine?: number;
  text: string;
}

export interface DiffFile {
  path: string;
  language?: string;
  additions: number;
  deletions: number;
  lines: DiffLine[];
  /** 是否已被外部修改（提示与工作区实时同步冲突） */
  externalChanged?: boolean;
}

const props = withDefaults(
  defineProps<{
    files: DiffFile[];
    /** 超过该行数进入折叠态 */
    collapseOver?: number;
  }>(),
  { collapseOver: 240 },
);

const emit = defineEmits<{
  (e: 'accept', payload: { path: string }): void;
  (e: 'reject', payload: { path: string }): void;
  (e: 'accept-hunk', payload: { path: string; start: number }): void;
}>();

const mode = ref<'inline' | 'side'>('inline');
const expanded = ref<Record<string, boolean>>({});
const decided = ref<Record<string, 'accepted' | 'rejected'>>({});

const summary = computed(() => ({
  files: props.files.length,
  additions: props.files.reduce((a, f) => a + f.additions, 0),
  deletions: props.files.reduce((a, f) => a + f.deletions, 0),
}));

function linesOf(f: DiffFile): DiffLine[] {
  const over = f.lines.length > props.collapseOver;
  if (!over || expanded.value[f.path]) return f.lines;
  return f.lines.slice(0, props.collapseOver);
}

function isCollapsed(f: DiffFile): boolean {
  return f.lines.length > props.collapseOver && !expanded.value[f.path];
}

function decide(path: string, kind: 'accepted' | 'rejected') {
  decided.value[path] = kind;
  if (kind === 'accepted') emit('accept', { path });
  else emit('reject', { path });
}

/** 按 hunk 分组（以 @@ 语义近似：遇到第一行 ctx 且前一行非 ctx 视为新块） */
function hunks(f: DiffFile) {
  const out: { start: number; lines: DiffLine[] }[] = [];
  let cur: DiffLine[] = [];
  f.lines.forEach((l, i) => {
    if (i > 0 && l.type === 'ctx' && f.lines[i - 1].type !== 'ctx' && cur.length) {
      out.push({ start: i - cur.length, lines: cur });
      cur = [];
    }
    cur.push(l);
  });
  if (cur.length) out.push({ start: f.lines.length - cur.length, lines: cur });
  return out;
}
</script>

<template>
  <div class="oc-diffview oc-stack">
    <div class="oc-flex--between">
      <div class="oc-flex" style="gap: 10px">
        <span class="oc-secondary">{{ summary.files }} 个文件</span>
        <span style="color: var(--oc-risk-r0)">+{{ summary.additions }}</span>
        <span style="color: var(--oc-risk-r4)">-{{ summary.deletions }}</span>
      </div>
      <RadioGroup v-model="mode" variant="default-filled" size="small">
        <RadioButton value="inline">内联</RadioButton>
        <RadioButton value="side">并排</RadioButton>
      </RadioGroup>
    </div>

    <div v-for="f in files" :key="f.path" class="oc-card" style="padding: 10px 12px">
      <div class="oc-flex--between" style="margin-bottom: 8px">
        <div class="oc-flex" style="gap: 6px; min-width: 0">
          <OcIcon name="file-copy" size="14px" />
          <span class="oc-mono oc-truncate">{{ f.path }}</span>
          <Tag size="small" variant="light-outline" v-if="f.language">{{ f.language }}</Tag>
          <Tag v-if="f.externalChanged" size="small" theme="warning" variant="light-outline">工作区已变更</Tag>
        </div>
        <div class="oc-flex" style="gap: 6px">
          <template v-if="decided[f.path]">
            <Tag :theme="decided[f.path] === 'accepted' ? 'success' : 'danger'" size="small">
              {{ decided[f.path] === 'accepted' ? '已接受变更' : '已拒绝变更' }}
            </Tag>
          </template>
          <template v-else>
            <Button size="small" theme="primary" variant="outline" @click="decide(f.path, 'accepted')">接受</Button>
            <Button size="small" variant="outline" @click="decide(f.path, 'rejected')">拒绝</Button>
          </template>
        </div>
      </div>

      <div v-if="mode === 'inline'" class="oc-diff">
        <div v-for="(l, i) in linesOf(f)" :key="i" class="oc-diff__row" :class="`oc-diff__row--${l.type}`">
          <span class="oc-diff__ln">{{ l.oldLine ?? '' }}</span>
          <span class="oc-diff__ln">{{ l.newLine ?? '' }}</span>
          <span>{{ (l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ') + l.text }}</span>
        </div>
      </div>

      <div v-else class="oc-diff">
        <div class="oc-diff__side">
          <div
            v-for="(l, i) in linesOf(f).filter((x) => x.type !== 'add')"
            :key="`o${i}`"
            class="oc-diff__row"
            :class="l.type === 'del' ? 'oc-diff__row--del' : 'oc-diff__row--ctx'"
          >
            <span class="oc-diff__ln">{{ l.oldLine ?? '' }}</span>
            <span>{{ (l.type === 'del' ? '-' : ' ') + l.text }}</span>
          </div>
        </div>
        <div class="oc-diff__side">
          <div
            v-for="(l, i) in linesOf(f).filter((x) => x.type !== 'del')"
            :key="`n${i}`"
            class="oc-diff__row"
            :class="l.type === 'add' ? 'oc-diff__row--add' : 'oc-diff__row--ctx'"
          >
            <span class="oc-diff__ln">{{ l.newLine ?? '' }}</span>
            <span>{{ (l.type === 'add' ? '+' : ' ') + l.text }}</span>
          </div>
        </div>
      </div>

      <div v-if="isCollapsed(f)" class="oc-flex" style="justify-content: center; margin-top: 6px">
        <Button size="small" variant="text" @click="expanded[f.path] = true">
          展开全部 {{ f.lines.length }} 行（已折叠 {{ f.lines.length - collapseOver }} 行）
        </Button>
      </div>
      <div v-else class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
        <Button
          v-for="h in hunks(f).slice(0, 8)"
          :key="h.start"
          size="small"
          variant="outline"
          @click="emit('accept-hunk', { path: f.path, start: h.start })"
        >
          接受块 @{{ h.start + 1 }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oc-diffview .oc-diff__side {
  min-width: 0;
}

.oc-diff {
  display: flex;
  flex-direction: column;
  max-height: 520px;
}

.oc-diff__side {
  flex: 1;
}
</style>
