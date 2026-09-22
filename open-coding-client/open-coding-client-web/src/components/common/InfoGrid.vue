<script setup lang="ts">
/**
 * 键值信息栅格：schema 驱动，用于详情抽屉/概要面板。
 * 支持 required 标记、脱敏显示（密钥类永不回显明文）、复制。
 */
import { computed } from 'vue';
import { Tag } from 'tdesign-vue-next';
import CopyableId from './CopyableId.vue';

export interface InfoItem {
  key: string;
  label: string;
  value?: string | number | null;
  /** 状态类取值：按枚举映射色 */
  tag?: { text: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' };
  /** 长文本（命令/diff/JSON） */
  block?: boolean;
  /** 引用式敏感值：只显示引用名 */
  secretRef?: boolean;
  mono?: boolean;
  span?: 1 | 2 | 3;
  copyable?: boolean;
  hint?: string;
}

const props = withDefaults(defineProps<{ items: InfoItem[]; columns?: 1 | 2 | 3 }>(), { columns: 2 });

const shown = computed(() => props.items.filter((i) => i.value !== undefined && i.value !== null && i.value !== ''));
</script>

<template>
  <div class="oc-info" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
    <div v-for="it in shown" :key="it.key" class="oc-info__item" :class="{ 'oc-info__item--block': it.block }" :style="it.span === 2 ? { gridColumn: 'span 2' } : undefined">
      <div class="oc-info__label">
        {{ it.label }}
        <span v-if="it.hint" class="oc-muted" style="font-size: 11px">（{{ it.hint }}）</span>
      </div>
      <div class="oc-info__value" :class="{ 'oc-mono': it.mono }">
        <template v-if="it.tag">
          <Tag :theme="it.tag.theme" size="small" variant="light-outline">{{ it.tag.text }}</Tag>
        </template>
        <template v-else-if="it.secretRef">
          <span class="oc-mono">{{ it.value }}</span>
          <Tag size="small" variant="outline" theme="default" style="margin-left: 6px">引用式 · 不明文</Tag>
        </template>
        <template v-else-if="it.block">
          <pre class="oc-pre">{{ it.value }}</pre>
        </template>
        <template v-else>
          <span>{{ it.value }}</span>
        </template>
        <CopyableId v-if="it.copyable" :id="String(it.value)" label="复制" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.oc-info {
  display: grid;
  gap: 10px 20px;
}

.oc-info__item {
  min-width: 0;
}

.oc-info__label {
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
  margin-bottom: 2px;
}

.oc-info__value {
  font-size: 13px;
  word-break: break-word;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.oc-info__item--block .oc-info__value {
  display: block;
}
</style>
