<script setup lang="ts">
/**
 * 通知中心：六类模板 + 聚合去重 + 静默时段（P0 穿透）+ 跳转动作。
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Drawer, Empty, Switch, Tag } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

const KIND: Record<string, { label: string; theme: 'primary' | 'success' | 'danger' | 'warning' | 'default'; icon: string }> = {
  need_input: { label: '需人工介入', theme: 'warning', icon: 'secured' },
  task_done: { label: '任务完成', theme: 'success', icon: 'task-checked' },
  task_failed: { label: '任务失败', theme: 'danger', icon: 'error' },
  goal_progress: { label: '目标进展', theme: 'primary', icon: 'flag' },
  cost_warning: { label: '成本预警', theme: 'warning', icon: 'discount' },
  security: { label: '安全事件', theme: 'danger', icon: 'lock' },
};

const groups = computed(() => [
  { level: 'P0', title: 'P0 · 即时（需人工介入 / 失败 / 安全）', items: ui.notifications.filter((n) => n.level === 'P0') },
  { level: 'P1', title: 'P1 · 摘要（完成 / 汇报）', items: ui.notifications.filter((n) => n.level === 'P1') },
  { level: 'P2', title: 'P2 · 静默（统计类）', items: ui.notifications.filter((n) => n.level === 'P2') },
]);

function go(n: { actions: { path?: string }[] }) {
  const target = n.actions.find((a) => a.path)?.path;
  if (target) router.push(target);
}
</script>

<template>
  <Drawer v-model:visible="ui.notificationOpen" placement="right" size="400px" header="通知中心">
    <div class="oc-stack">
      <div class="oc-flex--between">
        <span class="oc-secondary" style="font-size: 12px">
          聚合与去重：同源通知在窗口内合并计数；{{ ui.quietHours[0] }}–{{ ui.quietHours[1] }} 静默（P0 可穿透）
        </span>
        <Button size="small" variant="text" @click="ui.markAllRead()">全部已读</Button>
      </div>

      <div v-if="!ui.notifications.length">
        <Empty description="暂无通知。任务完成、需要审批或成本预警时会在这里聚合出现。" />
      </div>

      <template v-for="g in groups" :key="g.level">
        <div v-if="g.items.length" class="oc-stack" style="gap: 6px">
          <div class="oc-muted" style="font-size: 11px">{{ g.title }}</div>
          <button
            v-for="n in g.items"
            :key="n.id"
            type="button"
            class="oc-ntf"
            :class="{ 'oc-ntf--unread': !n.read }"
            @click="go(n)"
          >
            <Tag :theme="KIND[n.kind].theme" size="small" variant="light-outline">{{ KIND[n.kind].label }}</Tag>
            <div class="oc-grow">
              <div class="oc-flex" style="gap: 6px">
                <b>{{ n.title }}</b>
                <Tag v-if="n.count > 1" size="small" theme="default">×{{ n.count }}</Tag>
                <Tag v-if="n.penetrateQuiet" size="small" theme="danger" variant="outline">穿透静默</Tag>
              </div>
              <div class="oc-secondary" style="font-size: 12px; margin-top: 2px">{{ n.body }}</div>
              <div class="oc-muted" style="font-size: 11px; margin-top: 4px">
                {{ new Date(n.createdAt).toLocaleString('zh-CN') }} · 渠道 {{ n.channel }}
              </div>
            </div>
          </button>
        </div>
      </template>

      <div class="oc-divider" />
      <div class="oc-flex--between">
        <span class="oc-secondary" style="font-size: 12px">免打扰（22:00–08:00）</span>
        <Switch :value="true" size="small" />
      </div>
      <div class="oc-flex--between">
        <span class="oc-secondary" style="font-size: 12px">系统级通知（桌面端权限引导）</span>
        <Button size="small" variant="outline" @click="router.push('/settings/notifications')">前往设置</Button>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.oc-ntf {
  display: flex;
  gap: 8px;
  text-align: left;
  border: 1px solid var(--oc-border);
  border-radius: 6px;
  background: var(--oc-bg-container);
  padding: 8px 10px;
  cursor: pointer;
  align-items: flex-start;
}

.oc-ntf--unread {
  border-left: 3px solid var(--td-brand-color, #0052d9);
}

.oc-ntf:hover {
  background: var(--td-bg-color-container-hover, #f9f9f9);
}
</style>
