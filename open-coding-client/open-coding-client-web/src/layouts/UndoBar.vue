<script setup lang="ts">
/**
 * 撤销条：危险操作四级确认中的「低风险 + 撤销窗口」形态（默认 10s，可配 5–30s）。
 * 窗口内可撤销；过期自动消失，并提示「不可撤销」原因（由发起方在 consequence 中说明）。
 */
import { computed, onUnmounted, ref, watch } from 'vue';
import { Button, MessagePlugin } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const remain = ref(ui.undoWindowSeconds);
let timer: number | undefined;

function stop() {
  if (timer) window.clearInterval(timer);
  timer = undefined;
}

function start() {
  stop();
  remain.value = ui.undoWindowSeconds;
  timer = window.setInterval(() => {
    remain.value -= 1;
    if (remain.value <= 0) {
      stop();
      ui.expireUndo();
    }
  }, 1000);
}

watch(
  () => ui.undo,
  (v) => {
    if (v) start();
    else stop();
  },
);

onUnmounted(stop);

const pct = computed(() => (remain.value / ui.undoWindowSeconds) * 100);

function undo() {
  const snapshot = ui.confirmUndo();
  MessagePlugin.success(`已撤销：${snapshot?.text ?? ''}`);
  stop();
}
</script>

<template>
  <transition name="oc-undo">
    <div v-if="ui.undo" class="oc-undo" role="status" aria-live="polite">
      <span class="oc-grow">
        {{ ui.undo.text }}
        <span class="oc-muted" style="font-size: 11px"> · {{ ui.undo.consequence }}</span>
      </span>
      <span class="oc-muted">{{ Math.max(0, remain) }}s</span>
      <Button size="small" theme="primary" variant="outline" @click="undo">撤销</Button>
      <div class="oc-undo__bar" :style="{ width: `${pct}%` }" />
    </div>
  </transition>
</template>

<style scoped>
.oc-undo {
  position: fixed;
  left: 50%;
  bottom: calc(var(--oc-shell-statusbar-h) + 16px);
  transform: translateX(-50%);
  min-width: 320px;
  max-width: 720px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--oc-bg-container);
  border: 1px solid var(--oc-border-strong);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
  border-radius: 6px;
  font-size: 13px;
  z-index: 60;
  overflow: hidden;
}

.oc-undo__bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background: var(--td-brand-color, #0052d9);
  transition: width 1s linear;
}

.oc-undo-enter-active,
.oc-undo-leave-active {
  transition: opacity var(--oc-motion), transform var(--oc-motion);
}

.oc-undo-enter-from,
.oc-undo-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
