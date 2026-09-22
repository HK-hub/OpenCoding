<script setup lang="ts">
/**
 * 等价 CLI 命令提示（产品铁律 6：双端等价）。
 * 每个 UI 动作展示可复制的等价命令，保证 CLI 与桌面端能力不缺失。
 */
import { ref } from 'vue';
import { MessagePlugin, Tooltip } from 'tdesign-vue-next';
import OcIcon from './OcIcon.vue';

const props = defineProps<{ command: string; label?: string }>();

const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.command);
    copied.value = true;
    MessagePlugin.success('已复制等价命令');
    window.setTimeout(() => (copied.value = false), 1500);
  } catch {
    MessagePlugin.warning('浏览器未授权剪贴板，请手动选择复制');
  }
}
</script>

<template>
  <Tooltip :content="`等价 CLI 命令：${command}`">
    <button type="button" class="oc-cli" @click.stop="copy">
      <OcIcon name="terminal" size="12px" />
      <span>{{ label ?? command }}</span>
      <OcIcon :name="copied ? 'check' : 'copy'" size="12px" />
    </button>
  </Tooltip>
</template>

<style scoped>
.oc-cli {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border: 1px dashed var(--oc-border-strong);
  border-radius: 4px;
  padding: 1px 6px;
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
  font-family: var(--oc-mono);
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oc-cli:hover {
  border-color: var(--td-brand-color, #0052d9);
  color: var(--td-brand-color, #0052d9);
}
</style>
