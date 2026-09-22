<script setup lang="ts">
/**
 * 九区段占用条（S1–S9）+ 80% / 95% 水位线。
 * 逐段可按可调范围标记（仅 S4/S5/S7/S8 可调），点击段落后由宿主展示来源清单。
 */
import { computed } from 'vue';
import { Tooltip } from 'tdesign-vue-next';
import type { ContextSectionData } from '@/mock/data/model';
import { fmtToken, waterTheme } from './types';

const props = withDefaults(
  defineProps<{
    sections: ContextSectionData[];
    usableTokens: number;
    usedTokens: number;
    warnPct?: number;
    criticalPct?: number;
    /** 当前选中区段 */
    highlight?: string;
  }>(),
  { warnPct: 80, criticalPct: 95, highlight: '' },
);

const emit = defineEmits<{ (e: 'select', id: string): void }>();

const SEG_COLORS = ['#0052d9', '#2ba471', '#0f8b8d', '#8e5ee5', '#e37318', '#b15c00', '#d54941', '#6b7c93', '#a51f1f'];

const bars = computed(() =>
  props.sections.map((s, i) => ({
    id: s.id,
    name: s.name,
    tokens: s.tokens,
    pct: (s.tokens / Math.max(1, props.usableTokens)) * 100,
    color: SEG_COLORS[i % SEG_COLORS.length],
    adjustable: s.adjustable,
  })),
);

const water = computed(() => (props.usedTokens / Math.max(1, props.usableTokens)) * 100);
</script>

<template>
  <div class="oc-seg">
    <div class="oc-flex--between" style="font-size: 12px">
      <span>
        已用 <b>{{ fmtToken(usedTokens) }}</b> / 可用 {{ fmtToken(usableTokens) }} token
      </span>
      <span :style="{ color: waterTheme(water, warnPct, criticalPct) === 'danger' ? 'var(--oc-sev-error)' : waterTheme(water, warnPct, criticalPct) === 'warning' ? 'var(--oc-sev-warn)' : 'var(--oc-sev-ok)' }">
        水位 {{ water.toFixed(1) }}%（告警 {{ warnPct }}% / 触发压缩 {{ criticalPct }}%）
      </span>
    </div>

    <div class="oc-seg__track" role="img" :aria-label="`上下文九区段占用 ${water.toFixed(1)}%`">
      <button
        v-for="b in bars"
        :key="b.id"
        type="button"
        class="oc-seg__seg"
        :class="{ 'oc-seg__seg--active': highlight === b.id }"
        :style="{ width: `${Math.max(0.6, b.pct)}%`, background: b.color }"
        :title="`${b.id} ${b.name} · ${fmtToken(b.tokens)} token · ${b.pct.toFixed(1)}%${b.adjustable ? ' · 可调' : ' · 固定'}`"
        :aria-label="`${b.id} ${b.name} 占 ${b.pct.toFixed(1)}%`"
        @click="emit('select', b.id)"
      />
      <i class="oc-seg__mark" :style="{ left: `${warnPct}%` }" />
      <i class="oc-seg__mark oc-seg__mark--critical" :style="{ left: `${criticalPct}%` }" />
    </div>

    <div class="oc-flex oc-flex--wrap" style="gap: 4px 10px; font-size: 12px">
      <Tooltip v-for="(b, i) in bars" :key="b.id" :content="`${b.name}：${fmtToken(b.tokens)} token（可调范围：${b.adjustable ? '可调' : '固定'}）`">
        <button type="button" class="oc-seg__legend" :class="{ 'oc-seg__legend--active': highlight === b.id }" @click="emit('select', b.id)">
          <i :style="{ background: SEG_COLORS[i % SEG_COLORS.length] }" />
          {{ b.id }} {{ b.name }}
          <span class="oc-muted">{{ fmtToken(b.tokens) }}{{ b.adjustable ? ' · 可调' : '' }}</span>
        </button>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.oc-seg {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oc-seg__track {
  position: relative;
  display: flex;
  height: 22px;
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  overflow: hidden;
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
}

.oc-seg__seg {
  border: none;
  padding: 0;
  cursor: pointer;
  opacity: 0.86;
  transition: opacity var(--oc-motion);
}

.oc-seg__seg:hover,
.oc-seg__seg--active {
  opacity: 1;
  outline: 2px solid var(--td-text-color-primary, #181818);
  outline-offset: -2px;
}

.oc-seg__mark {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--oc-sev-warn);
  pointer-events: none;
}

.oc-seg__mark--critical {
  background: var(--oc-sev-error);
}

.oc-seg__legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 3px;
  padding: 1px 4px;
  cursor: pointer;
  color: var(--td-text-color-secondary, #666);
}

.oc-seg__legend--active {
  border-color: var(--td-brand-color, #0052d9);
  color: var(--td-text-color-primary, #181818);
}

.oc-seg__legend i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}
</style>
