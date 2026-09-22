<script setup lang="ts">
/**
 * 读屏公告区（aria-live="polite"）。
 * 节流 500ms 合并、不逐 token 播报、只播报阶段与关键状态。
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { bus } from '@/mock/bus';

const message = ref('');
let buffer: string[] = [];
let timer: number | undefined;

/** 节流合并：窗口内取最后一条，超出窗口丢弃中间态 */
function announce(text: string) {
  buffer.push(text);
  if (timer) return;
  timer = window.setTimeout(() => {
    message.value = buffer[buffer.length - 1];
    buffer = [];
    timer = undefined;
  }, 500);
}

onMounted(() => {
  bus.subscribe('a11y', (frame) => announce(String((frame.payload as { text?: string })?.text ?? '')));
});
onUnmounted(() => {
  if (timer) window.clearTimeout(timer);
});
</script>

<template>
  <div class="oc-sr-only" role="status" aria-live="polite" aria-atomic="true" id="oc-live-region">
    {{ message }}
  </div>
</template>
