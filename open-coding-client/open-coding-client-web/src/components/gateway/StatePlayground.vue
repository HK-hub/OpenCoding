<script setup lang="ts">
/**
 * 演示态切换（自审用）：把页面六态切换做成显式控件，
 * 便于逐页验收 EMPTY / LOADING / ERROR / EDGE_DATA / PERMISSION_DENIED。
 */
import { Select } from 'tdesign-vue-next';
import { PAGE_STATE_OPTIONS, type PageState } from './types';

defineProps<{ modelValue: PageState }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: PageState): void }>();

const options = PAGE_STATE_OPTIONS.map((o) => ({ label: `态:${o.label}`, value: o.value }));
</script>

<template>
  <Select
    :value="modelValue"
    :options="options"
    size="small"
    style="width: 132px"
    aria-label="切换页面演示态"
    @change="(v) => emit('update:modelValue', v as PageState)"
  />
</template>
