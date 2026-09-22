<script setup lang="ts">
/**
 * 六态外壳：EMPTY / LOADING / ERROR / OFFLINE / PERMISSION_DENIED / EDGE_DATA。
 * 页面只渲染投影结果，不自行推导状态（impl/30 REQ-UX-02）。
 */
import { computed } from 'vue';
import { Button, Skeleton, Tag } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';
import OcIcon from './OcIcon.vue';
import CopyableId from './CopyableId.vue';

const props = withDefaults(
  defineProps<{
    state: 'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE' | 'PERMISSION_DENIED' | 'EDGE_DATA';
    /** EMPTY */
    emptyTitle?: string;
    emptyDesc?: string;
    emptyAction?: string;
    exampleTask?: string;
    /** LOADING */
    stage?: string | null;
    cancellable?: boolean;
    skeletonRows?: number;
    /** ERROR 三段式 */
    what?: string;
    why?: string;
    how?: string;
    traceId?: string;
    retryable?: boolean;
    /** OFFLINE */
    reconnectInMs?: number;
    disabledCapabilities?: string[];
    /** PERMISSION */
    missingPermission?: string;
    riskLevel?: string;
    applyPath?: string;
    /** EDGE */
    collapsedSummary?: string;
    pageSize?: number;
  }>(),
  {
    emptyTitle: '暂无数据',
    emptyDesc: '当前范围没有可展示的内容。',
    emptyAction: '',
    skeletonRows: 6,
    stage: null,
    cancellable: false,
    traceId: '',
    retryable: true,
    reconnectInMs: 3000,
    disabledCapabilities: () => [],
    missingPermission: '',
    riskLevel: 'R2',
    applyPath: '在「权限与审批 → 申请授权」提交申请',
    collapsedSummary: '数据量超出渲染阈值，已折叠展示。',
    pageSize: 50,
  },
);

const emit = defineEmits<{
  (e: 'retry'): void;
  (e: 'load-more'): void;
  (e: 'cancel'): void;
  (e: 'empty-action'): void;
  (e: 'apply'): void;
  (e: 'dismiss-offline'): void;
}>();

const ui = useUiStore();
/** 演示控制台可全局强制六态（用于确定性演示与自审），未开启时使用页面自身状态 */
const effectiveState = computed(() => ui.demoState ?? props.state);
const isEdge = computed(() => effectiveState.value === 'EDGE_DATA');
const isDemoForced = computed(() => !!ui.demoState && ui.demoState !== props.state && ui.demoState !== 'NORMAL');
</script>

<template>
  <div class="oc-state" :class="{ 'oc-state--edge': isEdge }">
    <div v-if="isDemoForced" class="oc-state__demo-bar">
      <OcIcon name="app" size="12px" />
      演示控制台已强制页面态：{{ effectiveState }}（页面自身态：{{ state }}）
    </div>
    <!-- LOADING：≤1s 骨架，>1s 显示阶段，>5s 显示可取消 -->
    <div v-if="effectiveState === 'LOADING'" class="oc-stack" style="padding: 16px">
      <div v-if="stage" class="oc-flex">
        <OcIcon name="loading" size="16px" />
        <span>{{ stage }}</span>
        <Button v-if="cancellable" size="small" variant="text" @click="emit('cancel')">取消</Button>
      </div>
      <Skeleton :row-col="[{ width: '40%' }, ...Array.from({ length: skeletonRows }, () => ({ width: '100%' }))]" animation="gradient" />
    </div>

    <!-- EMPTY：说明为什么空 + 主行动 + 示例任务 -->
    <div v-else-if="effectiveState === 'EMPTY'" class="oc-state__box">
      <OcIcon name="browse" size="32px" color="var(--td-text-color-placeholder)" />
      <div class="oc-state__title">{{ emptyTitle }}</div>
      <div class="oc-state__desc">{{ emptyDesc }}</div>
      <div v-if="exampleTask" class="oc-state__hint">可从一个示例任务开始：「{{ exampleTask }}」</div>
      <div class="oc-flex" style="gap: 8px; margin-top: 12px">
        <Button v-if="emptyAction" theme="primary" @click="emit('empty-action')">{{ emptyAction }}</Button>
        <slot name="empty-extra" />
      </div>
    </div>

    <!-- ERROR：事实 / 原因 / 动作 三段式 + traceId 可复制 -->
    <div v-else-if="effectiveState === 'ERROR'" class="oc-state__box">
      <OcIcon name="error" size="32px" color="var(--sev-error, #d54941)" />
      <div class="oc-state__title">{{ what || '加载失败' }}</div>
      <div class="oc-state__desc">{{ why || '原因未知。' }}</div>
      <div class="oc-state__desc">{{ how || '可重试，或导出诊断包以便定位。' }}</div>
      <div class="oc-flex" style="gap: 8px; margin-top: 12px">
        <Button v-if="retryable" theme="primary" variant="outline" @click="emit('retry')">重试</Button>
        <Button variant="outline" @click="emit('retry')">导出诊断包</Button>
        <CopyableId v-if="traceId" :id="traceId" label="复制 traceId" />
      </div>
      <div v-if="!retryable" class="oc-state__hint">该错误不可自动恢复，已为你提供替代路径。</div>
    </div>

    <!-- OFFLINE：顶部状态条 + 受影响功能禁用 + 重连倒计时 -->
    <div v-else-if="effectiveState === 'OFFLINE'" class="oc-state__box">
      <OcIcon name="cloud" size="32px" color="var(--td-text-color-placeholder)" />
      <div class="oc-state__title">与内核连接中断</div>
      <div class="oc-state__desc">
        正在重连（{{ Math.max(1, Math.round(reconnectInMs / 1000)) }}s）。当前可编辑草稿，恢复后自动同步。
      </div>
      <div v-if="disabledCapabilities.length" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
        <Tag v-for="c in disabledCapabilities" :key="c" size="small" variant="light-outline">{{ c }} 已禁用</Tag>
      </div>
      <div class="oc-flex" style="gap: 8px; margin-top: 12px">
        <Button theme="primary" variant="outline" @click="emit('retry')">立即重连</Button>
        <Button variant="text" @click="emit('dismiss-offline')">查看离线可用范围</Button>
      </div>
    </div>

    <!-- PERMISSION_DENIED：缺哪个权限 + 风险级 + 申请路径 -->
    <div v-else-if="effectiveState === 'PERMISSION_DENIED'" class="oc-state__box">
      <OcIcon name="lock" size="32px" color="var(--td-text-color-placeholder)" />
      <div class="oc-state__title">你没有权限查看该内容</div>
      <div class="oc-state__desc">
        缺少权限点「{{ missingPermission }}」（风险级 {{ riskLevel }}）。{{ applyPath }}
      </div>
      <div class="oc-flex" style="gap: 8px; margin-top: 12px">
        <Button theme="primary" variant="outline" @click="emit('apply')">申请临时授权</Button>
        <Button variant="text" @click="emit('retry')">重试</Button>
      </div>
    </div>

    <!-- EDGE_DATA：分页/折叠/摘要 -->
    <template v-else-if="isEdge">
      <div class="oc-state__edge-bar">
        <OcIcon name="layers" size="14px" />
        <span>{{ collapsedSummary }}</span>
        <span class="oc-muted" style="margin-left: auto">已渲染 {{ pageSize }} 条</span>
        <Button size="small" variant="text" @click="emit('load-more')">加载更多</Button>
      </div>
      <slot />
    </template>

    <template v-else>
      <slot />
    </template>
  </div>
</template>

<style scoped>
.oc-state {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.oc-state__box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  gap: 6px;
  color: var(--td-text-color-secondary, #666);
}

.oc-state__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--td-text-color-primary, #181818);
}

.oc-state__desc {
  font-size: 13px;
  max-width: 560px;
}

.oc-state__hint {
  font-size: 12px;
  color: var(--td-text-color-placeholder, #8f8f8f);
  margin-top: 4px;
}

.oc-state__demo-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  margin-bottom: 8px;
  font-size: 11px;
  border-radius: 4px;
  background: var(--td-brand-color-light, #eaf1ff);
  color: var(--td-brand-color-8, #0b3f9e);
  border: 1px dashed var(--td-brand-color-2, #cce0ff);
}

.oc-state__edge-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin-bottom: 8px;
  font-size: 12px;
  background: var(--td-warning-color-1, #fff1e9);
  border: 1px solid var(--td-warning-color-3, #ffb98a);
  border-radius: 4px;
}
</style>
