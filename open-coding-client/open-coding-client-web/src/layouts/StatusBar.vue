<script setup lang="ts">
/**
 * 底部状态栏：连接状态 / 待审批计数 / 当前模型与模式 / 后台任务进度 / 降级徽标。
 * 常驻可见（卷 22 §4.2 B1–B4），并提供一键重连与跳转审批。
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Popup, Progress, Tooltip } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';
import OcIcon from '@/components/common/OcIcon.vue';

const ui = useUiStore();
const router = useRouter();

const conn = computed(() => {
  switch (ui.connection) {
    case 'CONNECTED':
      return { text: '已连接内核', color: 'var(--oc-sev-ok)', icon: 'check' };
    case 'RECONNECTING':
      return { text: '重连中…', color: 'var(--oc-sev-warn)', icon: 'loading' };
    default:
      return { text: '已离线（只读）', color: 'var(--oc-sev-error)', icon: 'cloud' };
  }
});

const MODE_TEXT: Record<string, string> = {
  readonly: '只读',
  plan: '计划',
  default: '默认',
  acceptEdits: '自动接受编辑',
  autonomous: '自治',
  yolo: 'yolo（受限）',
};

const AUTONOMY_TEXT: Record<string, string> = {
  propose: '建议（每步确认）',
  collaborate: '协作（风险动作确认）',
  autonomous: '自治（预授权边界内自动）',
};
</script>

<template>
  <footer class="oc-statusbar">
    <Tooltip :content="`最后事件序号 ${ui.lastEventSeq}（断线后从此处续传）`">
      <button type="button" class="oc-statusbar__item" @click="ui.simulateReconnect()">
        <span class="oc-statusbar__dot" :style="{ background: conn.color }" />
        <OcIcon :name="conn.icon" size="12px" />
        {{ conn.text }}
      </button>
    </Tooltip>

    <button type="button" class="oc-statusbar__item" @click="router.push('/approval/center')">
      <OcIcon name="secured" size="12px" />
      待审批 {{ ui.pendingApprovals }}
    </button>

    <Popup trigger="hover" placement="top">
      <button type="button" class="oc-statusbar__item">
        <OcIcon name="robot" size="12px" />
        {{ ui.currentModel }} · {{ MODE_TEXT[ui.currentMode] }}
      </button>
      <template #content>
        <div class="oc-stack" style="max-width: 320px; font-size: 12px">
          <div>当前模型：<b>{{ ui.currentModel }}</b></div>
          <div>权限模式：<b>{{ MODE_TEXT[ui.currentMode] }}</b>（模式是起点，策略只能收窄）</div>
          <div>自主度：<b>{{ AUTONOMY_TEXT[ui.autonomy] }}</b>（可随时收回）</div>
          <div class="oc-muted">切换入口：/settings/permission 或状态栏点击</div>
        </div>
      </template>
    </Popup>

    <Tooltip content="后台任务进度（不显示虚假百分比：不确定时长时使用阶段文案）">
      <span class="oc-statusbar__item">
        <OcIcon name="loading" size="12px" />
        后台任务 {{ ui.backgroundTasks }}
        <Progress :percentage="62" theme="line" :stroke-width="3" style="width: 60px" />
      </span>
    </Tooltip>

    <div class="oc-grow" />

    <Tooltip content="演示环境：所有数据与功能均为本地 Mock，不连接真实后端与真实资源">
      <span class="oc-statusbar__item oc-statusbar__item--demo">
        <OcIcon name="app" size="12px" />
        演示环境 · 全 Mock
      </span>
    </Tooltip>

    <Tooltip v-if="ui.degradeTier !== 'normal'" :content="`降级原因：${ui.degradeReason || '渲染预算收紧'}`">
      <span class="oc-statusbar__item oc-statusbar__item--warn">
        <OcIcon name="layers" size="12px" />
        渲染档位 {{ ui.degradeTier }}
      </span>
    </Tooltip>
    <Tooltip content="事件到界面 ≤200ms；流式渲染 ≥55fps；超阈值自动降档">
      <span class="oc-statusbar__item oc-muted">seq {{ ui.lastEventSeq }}</span>
    </Tooltip>
  </footer>
</template>

<style scoped>
.oc-statusbar {
  height: var(--oc-shell-statusbar-h);
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  background: var(--oc-bg-container);
  border-top: 1px solid var(--oc-border);
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
}

.oc-statusbar__item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  color: inherit;
  font-size: 12px;
}

.oc-statusbar__item:hover {
  background: var(--td-bg-color-container-hover, #f3f3f3);
  color: var(--td-brand-color, #0052d9);
}

.oc-statusbar__item--demo {
  color: var(--td-warning-color, #e37318);
}

.oc-statusbar__item--warn {
  color: var(--td-warning-color, #e37318);
}

.oc-statusbar__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}
</style>
