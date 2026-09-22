<script setup lang="ts">
/**
 * 可复制标识：traceId / decisionId / sessionId / action_digest 短前缀。
 * 对齐错误规范：所有错误卡与决策卡必须可一键复制追踪标识。
 */
import { ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import OcIcon from './OcIcon.vue';

const props = withDefaults(defineProps<{ id: string; label?: string; short?: number | string }>(), {
  label: '复制',
  short: 0,
});

const copied = ref(false);
const shortNum = Number(props.short) || 0;
const display = shortNum > 0 ? props.id.slice(0, shortNum) : props.id;

async function copy() {
  try {
    await navigator.clipboard.writeText(props.id);
    copied.value = true;
    MessagePlugin.success(`已复制 ${props.id}`);
    window.setTimeout(() => (copied.value = false), 1500);
  } catch {
    MessagePlugin.warning('剪贴板不可用，已为你选中文本');
  }
}
</script>

<template>
  <button type="button" class="oc-idcopy" :title="`${label}：${id}`" @click.stop="copy">
    <span class="oc-mono">{{ display }}</span>
    <OcIcon :name="copied ? 'check' : 'copy'" size="12px" />
  </button>
</template>

<style scoped>
.oc-idcopy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  padding: 0 2px;
  cursor: pointer;
  color: var(--td-text-color-secondary, #666);
}

.oc-idcopy:hover {
  color: var(--td-brand-color, #0052d9);
}
</style>
