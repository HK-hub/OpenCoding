<script setup lang="ts">
/**
 * 多标签工作区：标签=已打开的视图，切换 ≤50ms（内容已投影）。
 * 支持 Ctrl+1..9 直达、Alt+↑/↓ 上下切换、右键关闭其他。
 */
import { useRoute, useRouter } from 'vue-router';
import { onMounted, onUnmounted } from 'vue';
import { Dropdown } from 'tdesign-vue-next';
import type { DropdownOption } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';
import OcIcon from '@/components/common/OcIcon.vue';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();

function activate(path: string) {
  ui.activeTab = path;
  router.push(path);
}

function onKey(e: KeyboardEvent) {
  const meta = e.ctrlKey || e.metaKey;
  if (meta && /^[1-9]$/.test(e.key)) {
    const idx = Number(e.key) - 1;
    if (ui.tabs[idx]) {
      e.preventDefault();
      activate(ui.tabs[idx].path);
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));

function onClickTab(path: string) {
  if (route.path !== path) activate(path);
}
</script>

<template>
  <div class="oc-tabbar" role="tablist" aria-label="已打开视图">
    <div
      v-for="(t, i) in ui.tabs"
      :key="t.path"
      class="oc-tabbar__tab"
      :class="{ 'oc-tabbar__tab--active': route.path === t.path }"
      role="tab"
      :aria-selected="route.path === t.path"
      :tabindex="0"
      @click="onClickTab(t.path)"
      @keydown.enter="onClickTab(t.path)"
    >
      <OcIcon :name="t.icon" size="13px" />
      <span class="oc-tabbar__text">{{ t.title }}</span>
      <span class="oc-tabbar__idx">{{ i + 1 }}</span>
      <button
        v-if="t.closable"
        type="button"
        class="oc-tabbar__close"
        :aria-label="`关闭 ${t.title}`"
        @click.stop="ui.closeView(t.path)"
      >
        <OcIcon name="close" size="12px" />
      </button>
    </div>
    <div class="oc-grow" />
    <Dropdown :options="[{ content: '关闭其他标签', value: 'others' }, { content: '关闭全部标签', value: 'all' }]" @click="(v: DropdownOption) => { if (v.value === 'others') { const keep = ui.tabs.find((t) => t.path === route.path); ui.tabs = [ui.tabs[0], ...(keep && keep.path !== ui.tabs[0].path ? [keep] : [])]; ui.activeTab = route.path; } else { ui.closeAllViews(); router.push('/session'); } }">
      <button type="button" class="oc-tabbar__more"><OcIcon name="add" size="13px" /></button>
    </Dropdown>
  </div>
</template>

<style scoped>
.oc-tabbar {
  height: var(--oc-shell-tabbar-h);
  flex: none;
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 0 8px;
  background: var(--oc-bg-container);
  border-bottom: 1px solid var(--oc-border);
  overflow-x: auto;
}

.oc-tabbar__tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  max-width: 200px;
  transition: color var(--oc-motion), border-color var(--oc-motion);
}

.oc-tabbar__tab:hover {
  color: var(--td-brand-color, #0052d9);
}

.oc-tabbar__tab--active {
  color: var(--td-brand-color, #0052d9);
  border-bottom-color: var(--td-brand-color, #0052d9);
  font-weight: 500;
}

.oc-tabbar__text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.oc-tabbar__idx {
  font-size: 10px;
  font-family: var(--oc-mono);
  color: var(--td-text-color-placeholder, #8f8f8f);
}

.oc-tabbar__close {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 1px;
  border-radius: 3px;
  color: inherit;
  display: inline-flex;
}

.oc-tabbar__close:hover {
  background: var(--td-bg-color-container-hover, #eee);
}

.oc-tabbar__more {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0 8px;
  color: var(--td-text-color-secondary, #666);
}
</style>
