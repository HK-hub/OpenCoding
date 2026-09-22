<script setup lang="ts">
/**
 * 命令面板（Ctrl/Cmd+K）：覆盖全部页面与常用动作，显示键位。
 * 对齐卷 22 §4.5：命令与 CLI 同名（双端心智一致），键位冲突可见。
 */
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Drawer, Input, Tag } from 'tdesign-vue-next';
import { buildCommands } from '@/router';
import { useUiStore } from '@/stores/ui';
import OcIcon from '@/components/common/OcIcon.vue';

const ui = useUiStore();
const router = useRouter();
const keyword = ref('');
const commands = buildCommands();

/** 常用动作（与 CLI 子命令一一对应） */
const ACTIONS = [
  { id: 'act:new-session', title: '新建会话', cli: 'oc session new', group: '会话', path: '/session', keys: 'Ctrl+N' },
  { id: 'act:interrupt', title: '中断当前执行（安全点）', cli: 'oc session interrupt', group: '会话', path: '/session', keys: 'Esc' },
  { id: 'act:pause', title: '停止并暂停', cli: 'oc session pause', group: '会话', path: '/session', keys: 'Ctrl+.' },
  { id: 'act:approvals', title: '打开待审批列表', cli: 'oc approval list', group: '审批', path: '/approval/center', keys: 'Ctrl+Shift+A' },
  { id: 'act:diff', title: '打开 Diff 视图', cli: 'oc diff', group: '变更', path: '/git/diff', keys: 'Ctrl+Shift+D' },
  { id: 'act:tasks', title: '打开任务看板', cli: 'oc task board', group: '任务', path: '/task/board', keys: 'Ctrl+Shift+T' },
  { id: 'act:plan', title: '打开计划视图', cli: 'oc plan view', group: '任务', path: '/task/list', keys: 'Ctrl+Shift+P' },
  { id: 'act:cost', title: '打开成本与上下文面板', cli: 'oc cost show', group: '成本', path: '/cost/overview', keys: 'Ctrl+Shift+C' },
  { id: 'act:doctor', title: '运行诊断', cli: 'oc doctor', group: '诊断', path: '/settings/diagnostics' },
  { id: 'act:export', title: '导出会话复现包', cli: 'oc session export', group: '会话', path: '/session/export' },
  { id: 'act:kill-switch', title: '一键禁用全部钩子', cli: 'oc hooks disable --all', group: '钩子', path: '/hooks/list' },
  { id: 'act:freeze', title: '冻结自治任务（成本异常）', cli: 'oc quota freeze --autonomy', group: '成本', path: '/cost/quota' },
];

interface Row {
  id: string;
  title: string;
  group: string;
  keys?: string;
  cli?: string;
  path?: string;
}

const rows = computed<Row[]>(() => [
  ...commands.map((c) => ({ id: c.id, title: c.title, group: c.group, path: c.path } as Row)),
  ...ACTIONS.map((a) => ({ id: a.id, title: a.title, group: a.group, keys: a.keys, cli: a.cli, path: a.path } as Row)),
].filter((r) => !keyword.value || `${r.title}${r.group}${r.cli ?? ''}`.toLowerCase().includes(keyword.value.toLowerCase())));

const active = ref(0);
watch(keyword, () => (active.value = 0));

function run(row: Row) {
  ui.track('ui.command.invoked', { command: row.id });
  if (row.path) router.push(row.path);
  ui.commandPaletteOpen = false;
  keyword.value = '';
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    active.value = Math.min(active.value + 1, rows.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    active.value = Math.max(active.value - 1, 0);
  } else if (e.key === 'Enter' && rows.value[active.value]) {
    e.preventDefault();
    run(rows.value[active.value]);
  }
}
</script>

<template>
  <Drawer
    v-model:visible="ui.commandPaletteOpen"
    mode="overlay"
    placement="top"
    size="440px"
    :footer="false"
    :header="false"
  >
    <div class="oc-cmd">
      <div class="oc-cmd__input">
        <OcIcon name="search" size="16px" />
        <Input
          v-model="keyword"
          borderless
          placeholder="输入命令、页面或 CLI 子命令（与 oc 命令同名）"
          autofocus
          @keydown="(_v: unknown, ctx: { e: KeyboardEvent }) => onKeydown(ctx.e)"
        />
        <Tag size="small" variant="outline">Esc 关闭</Tag>
      </div>
      <div class="oc-cmd__list">
        <button
          v-for="(r, i) in rows"
          :key="r.id"
          type="button"
          class="oc-cmd__row"
          :class="{ 'oc-cmd__row--active': i === active }"
          @mouseenter="active = i"
          @click="run(r)"
        >
          <span class="oc-cmd__group">{{ r.group }}</span>
          <span class="oc-grow oc-truncate">{{ r.title }}</span>
          <span v-if="r.cli" class="oc-cli">{{ r.cli }}</span>
          <kbd v-if="r.keys">{{ r.keys }}</kbd>
        </button>
        <div v-if="!rows.length" class="oc-cmd__empty">没有匹配的命令。试试更短的关键词，或按 ? 查看键位帮助。</div>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.oc-cmd {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.oc-cmd__input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--oc-border);
}

.oc-cmd__list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.oc-cmd__row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--td-text-color-primary, #181818);
}

.oc-cmd__row--active {
  background: var(--td-brand-color-light, #e6f0ff);
}

.oc-cmd__group {
  font-size: 11px;
  color: var(--td-text-color-placeholder, #8f8f8f);
  min-width: 56px;
}

.oc-cmd__empty {
  padding: 24px;
  text-align: center;
  color: var(--td-text-color-placeholder, #8f8f8f);
  font-size: 13px;
}

kbd {
  font-family: var(--oc-mono);
  font-size: 11px;
  border: 1px solid var(--oc-border);
  border-radius: 3px;
  padding: 0 4px;
  color: var(--td-text-color-secondary, #666);
}
</style>
