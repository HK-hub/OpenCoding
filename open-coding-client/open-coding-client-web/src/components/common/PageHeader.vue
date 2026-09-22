<script setup lang="ts">
/**
 * 页面头：标题 + 说明 + 操作区 + 溯源信息（卷号/清单编号）+ 等价 CLI 命令。
 * 统一承载产品铁律「双端等价」与「状态可解释」的最小可视面。
 */
import { computed } from 'vue';
import { Tag, Tooltip } from 'tdesign-vue-next';
import CliHint from './CliHint.vue';

const props = defineProps<{
  title: string;
  desc?: string;
  /** harness 卷号，例如 "卷 06" */
  volume?: string;
  /** BUILD-MANIFEST 编号，例如 "P-02" */
  manifest?: string;
  /** 对应 CLI 命令（双端等价） */
  cli?: string;
  /** 实验特性徽标 */
  experimental?: boolean;
  /** 页面级状态徽标（如「离线」/「只读」） */
  status?: { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }[];
}>();

const tags = computed(() => props.status ?? []);
</script>

<template>
  <header class="oc-page__head">
    <div class="oc-grow">
      <h1 class="oc-page__title">
        {{ title }}
        <Tag v-if="experimental" theme="warning" variant="light-outline" size="small" style="margin-left: 8px">
          实验
        </Tag>
      </h1>
      <p v-if="desc" class="oc-page__desc">{{ desc }}</p>
      <div class="oc-flex oc-flex--wrap" style="margin-top: 6px; gap: 6px">
        <Tag v-for="t in tags" :key="t.label" :theme="t.theme" variant="light-outline" size="small">
          {{ t.label }}
        </Tag>
        <CliHint v-if="cli" :command="cli" />
        <Tooltip v-if="volume || manifest" :content="`溯源：${volume ?? ''} ${manifest ?? ''}`">
          <Tag variant="outline" size="small" style="color: var(--td-text-color-placeholder)">
            {{ [volume, manifest].filter(Boolean).join(' · ') }}
          </Tag>
        </Tooltip>
      </div>
    </div>
    <div class="oc-flex oc-flex--wrap">
      <slot name="actions" />
    </div>
  </header>
</template>
