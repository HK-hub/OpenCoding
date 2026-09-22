<script setup lang="ts">
/**
 * 工作台外壳：左导航 + 多标签主区 + 右侧上下文栏 + 底部状态栏 + 覆盖层。
 * 对应卷 22 D-UI-4 选定分支与 impl/23 §④⑤ 布局模型。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Badge, Popup, RadioGroup, RadioButton, Switch, Tooltip } from 'tdesign-vue-next';
import { buildNav, router } from '@/router';
import { useUiStore } from '@/stores/ui';
import OcIcon from '@/components/common/OcIcon.vue';
import TabBar from './TabBar.vue';
import StatusBar from './StatusBar.vue';
import CommandPalette from './CommandPalette.vue';
import NotificationDrawer from './NotificationDrawer.vue';
import GlobalSearch from './GlobalSearch.vue';
import ShortcutHelp from './ShortcutHelp.vue';
import ContextRail from './ContextRail.vue';
import UndoBar from './UndoBar.vue';
import DemoConsole from '@/components/common/DemoConsole.vue';
import LiveRegion from './LiveRegion.vue';

const ui = useUiStore();
const route = useRoute();
const currentRouter = useRouter();
const nav = buildNav();
const filter = ref('');

onMounted(() => {
  const onboarded = localStorage.getItem('oc.onboarded') === '1';
  ui.onboarded = onboarded;
  if (!onboarded) currentRouter.push('/onboarding');
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => window.removeEventListener('keydown', onKeydown));

// 路由变化 → 同步标签页与导航高亮
watch(
  () => route.path,
  () => {
    const meta = route.meta as Record<string, unknown>;
    if (route.path.startsWith('/session') || !meta?.title) return;
    ui.openView({
      path: route.path,
      title: String(meta.title),
      icon: String(meta.icon ?? 'app'),
      closable: true,
    });
  },
  { immediate: true },
);

const groups = computed(() =>
  nav
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => !filter.value || `${it.title}${it.desc ?? ''}`.toLowerCase().includes(filter.value.toLowerCase())),
    }))
    .filter((g) => g.items.length),
);

/** 深/浅色主题（无障碍：对比度 ≥4.5:1，主题令牌由 TDesign 提供） */
const theme = ref<'light' | 'dark'>((localStorage.getItem('oc.theme') as 'light' | 'dark') ?? 'light');

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  localStorage.setItem('oc.theme', theme.value);
  if (theme.value === 'dark') document.documentElement.setAttribute('theme-mode', 'dark');
  else document.documentElement.removeAttribute('theme-mode');
  ui.announce(`已切换到${theme.value === 'dark' ? '深色' : '浅色'}主题`);
}

/** 键盘全流程（六层键位，卷 33 §6 + 卷 22 §4.5） */
function onKeydown(e: KeyboardEvent) {
  const meta = e.ctrlKey || e.metaKey;
  if (meta && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    ui.commandPaletteOpen = !ui.commandPaletteOpen;
    ui.track('ui.command.invoked', { command: 'command-palette' });
  } else if (meta && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    router.push('/approval/center');
  } else if (meta && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    ui.globalSearchOpen = true;
  } else if (meta && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    router.push('/session');
  } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    const dir = e.key === 'ArrowUp' ? -1 : 1;
    ui.cycleTab(dir as 1 | -1);
    router.push(ui.activeTab);
  } else if (e.key === '?' && !(e.target as HTMLElement)?.closest('input,textarea')) {
    e.preventDefault();
    ui.shortcutHelpOpen = true;
  } else if (e.key === 'Escape') {
    ui.commandPaletteOpen = false;
    ui.globalSearchOpen = false;
    ui.shortcutHelpOpen = false;
  }
}
</script>

<template>
  <div class="oc-shell" :class="[`oc-shell--${ui.degradeTier}`]">
    <LiveRegion />
    <!-- 顶栏 -->
    <header class="oc-shell__header">
      <button type="button" class="oc-shell__brand" @click="router.push('/session')">
        <span class="oc-shell__logo">OC</span>
        <span class="oc-shell__brand-text">OpenCoding Harness</span>
      </button>

      <button type="button" class="oc-shell__search" @click="ui.globalSearchOpen = true">
        <OcIcon name="search" size="14px" />
        <span>搜索会话 / 任务 / 知识 / 记忆 / 文件 / 审计…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div class="oc-flex" style="gap: 6px">
        <Popup trigger="click" placement="bottom-right">
          <span class="oc-shell__tier" :class="{ 'oc-shell__tier--low': ui.degradeTier !== 'normal' }">
            <OcIcon name="layers" size="13px" />
            {{ ui.degradeTier }}
          </span>
          <template #content>
            <div class="oc-stack" style="min-width: 280px">
              <b style="font-size: 12px">渲染档位（自动降档 + 可见可锁）</b>
              <div class="oc-muted" style="font-size: 12px">
                降档只降表现不丢内容；事件到界面 ≤200ms、流式渲染 ≥55fps、标签切换 ≤50ms 为目标门禁。
              </div>
              <RadioGroup v-model="ui.degradeTier" size="small">
                <RadioButton value="normal">normal</RadioButton>
                <RadioButton value="compact">compact</RadioButton>
                <RadioButton value="minimal">minimal</RadioButton>
              </RadioGroup>
              <div class="oc-flex--between">
                <span style="font-size: 12px">锁定当前档位</span>
                <Switch v-model="ui.degradeLocked" size="small" />
              </div>
              <div v-if="ui.degradeReason" class="oc-muted" style="font-size: 11px">触发原因：{{ ui.degradeReason }}</div>
            </div>
          </template>
        </Popup>
        <Tooltip :content="ui.preferences.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'">
          <button type="button" class="oc-shell__icon-btn" @click="toggleTheme">
            <OcIcon :name="ui.preferences.theme === 'dark' ? 'lightbulb' : 'smile'" size="16px" />
          </button>
        </Tooltip>
        <Tooltip content="命令面板（Ctrl+K）">
          <button type="button" class="oc-shell__icon-btn" @click="ui.commandPaletteOpen = true">
            <OcIcon name="root" size="16px" />
          </button>
        </Tooltip>
        <Tooltip content="键位帮助（?）">
          <button type="button" class="oc-shell__icon-btn" @click="ui.shortcutHelpOpen = true">
            <OcIcon name="help" size="16px" />
          </button>
        </Tooltip>
        <Tooltip content="通知中心">
          <button type="button" class="oc-shell__icon-btn" @click="ui.notificationOpen = true">
            <Badge :count="ui.unreadCount" :max-count="99" size="small">
              <OcIcon name="notification" size="16px" />
            </Badge>
          </button>
        </Tooltip>
        <Tooltip content="偏好设置">
          <button type="button" class="oc-shell__icon-btn" @click="router.push('/settings/preferences')">
            <OcIcon name="setting" size="16px" />
          </button>
        </Tooltip>
      </div>
    </header>

    <div class="oc-shell__body">
      <!-- 左导航：9+ 入口，按域分组 -->
      <aside class="oc-shell__sidebar" :class="{ 'oc-shell__sidebar--collapsed': ui.sidebarCollapsed }">
        <div class="oc-shell__sidebar-head">
          <input v-if="!ui.sidebarCollapsed" v-model="filter" class="oc-shell__filter" placeholder="筛选功能…" aria-label="筛选导航" />
          <button type="button" class="oc-shell__icon-btn" :title="ui.sidebarCollapsed ? '展开导航' : '收起导航'" @click="ui.sidebarCollapsed = !ui.sidebarCollapsed">
            <OcIcon :name="ui.sidebarCollapsed ? 'browse' : 'root'" size="16px" />
          </button>
        </div>
        <nav class="oc-shell__nav" aria-label="主导航">
          <div v-for="g in groups" :key="g.name" class="oc-shell__group">
            <div v-if="!ui.sidebarCollapsed" class="oc-shell__group-title">{{ g.name }}</div>
            <router-link
              v-for="it in g.items"
              :key="it.path"
              :to="it.path"
              class="oc-shell__item"
              :class="{ 'oc-shell__item--active': route.path === it.path }"
              :title="it.desc ?? it.title"
            >
              <OcIcon :name="it.icon" size="15px" />
              <span v-if="!ui.sidebarCollapsed" class="oc-shell__item-text">{{ it.title }}</span>
              <span v-if="it.experimental" class="oc-shell__exp" title="实验特性">E</span>
              <Badge
                v-if="!ui.sidebarCollapsed && it.path.includes('/approval')"
                :count="ui.pendingApprovals"
                size="small"
                style="margin-left: auto"
              />
            </router-link>
          </div>
        </nav>
      </aside>

      <!-- 主工作区：标签 + 路由视图 -->
      <main class="oc-shell__main">
        <TabBar />
        <div class="oc-shell__content">
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
        </div>
      </main>

      <!-- 右侧上下文栏 -->
      <ContextRail v-if="ui.railVisible" />
    </div>

    <StatusBar />

    <!-- 覆盖层 -->
    <CommandPalette />
    <NotificationDrawer />
    <GlobalSearch />
    <ShortcutHelp />
    <UndoBar />
    <DemoConsole />
  </div>
</template>

<style scoped>
.oc-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--oc-bg-page);
}

.oc-shell__header {
  height: var(--oc-shell-header-h);
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  background: var(--oc-bg-container);
  border-bottom: 1px solid var(--oc-border);
}

.oc-shell__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0 4px;
}

.oc-shell__logo {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: linear-gradient(135deg, #0052d9, #2ba471);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.oc-shell__brand-text {
  font-weight: 600;
  font-size: 14px;
  color: var(--td-text-color-primary);
  white-space: nowrap;
}

.oc-shell__search {
  flex: 1;
  max-width: 560px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--oc-border);
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
  color: var(--td-text-color-placeholder, #8f8f8f);
  cursor: pointer;
  font-size: 13px;
}

.oc-shell__search kbd {
  margin-left: auto;
  font-family: var(--oc-mono);
  font-size: 11px;
  border: 1px solid var(--oc-border);
  border-radius: 3px;
  padding: 0 4px;
  background: var(--oc-bg-container);
}

.oc-shell__icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 5px 6px;
  border-radius: 4px;
  color: var(--td-text-color-secondary, #666);
  display: inline-flex;
  align-items: center;
}

.oc-shell__icon-btn:hover {
  background: var(--td-bg-color-container-hover, #f3f3f3);
  color: var(--td-brand-color, #0052d9);
}

.oc-shell__tier {
  font-size: 11px;
  font-family: var(--oc-mono);
  border: 1px solid var(--oc-border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--td-text-color-secondary, #666);
}

.oc-shell__tier--low {
  color: var(--td-warning-color, #e37318);
  border-color: var(--td-warning-color-3, #ffb98a);
}

.oc-shell__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.oc-shell__sidebar {
  width: var(--oc-shell-sidebar-w);
  flex: none;
  background: var(--oc-bg-container);
  border-right: 1px solid var(--oc-border);
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: width var(--oc-motion);
}

.oc-shell__sidebar--collapsed {
  width: var(--oc-shell-sidebar-collapsed-w);
}

.oc-shell__sidebar-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--oc-border);
}

.oc-shell__filter {
  flex: 1;
  min-width: 0;
  height: 26px;
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  padding: 0 8px;
  font-size: 12px;
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
}

.oc-shell__nav {
  flex: 1;
  overflow-y: auto;
  padding: 6px 6px 16px;
}

.oc-shell__group-title {
  font-size: 11px;
  color: var(--td-text-color-placeholder, #8f8f8f);
  padding: 10px 8px 4px;
  letter-spacing: 0.4px;
}

.oc-shell__item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  color: var(--td-text-color-primary, #181818);
  text-decoration: none;
  font-size: 13px;
  position: relative;
}

.oc-shell__item:hover {
  background: var(--td-bg-color-container-hover, #f3f3f3);
}

.oc-shell__item--active {
  background: var(--td-brand-color-light, #e6f0ff);
  color: var(--td-brand-color, #0052d9);
  font-weight: 500;
}

.oc-shell__item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oc-shell__exp {
  font-size: 9px;
  border: 1px solid var(--td-warning-color, #e37318);
  color: var(--td-warning-color, #e37318);
  border-radius: 2px;
  padding: 0 2px;
  line-height: 12px;
}

.oc-shell__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.oc-shell__content {
  flex: 1;
  overflow: auto;
  padding: 14px 16px;
  min-height: 0;
}

.oc-shell--compact .oc-shell__content {
  padding: 10px 12px;
}

.oc-shell--minimal .oc-shell__content {
  padding: 6px;
}
</style>
