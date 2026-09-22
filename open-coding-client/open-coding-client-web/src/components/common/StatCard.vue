<script setup lang="ts">
/**
 * 指标卡：数值 + 环比 + 迷你趋势 + 目标水位。
 * 用于成本/容量/SLO/质量等看板，统一口径（千分位、成本 4 位小数、token k/M）。
 */
import { computed } from 'vue';
import OcIcon from './OcIcon.vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: number | string;
    unit?: string;
    /** 数值格式化：number=千分位 / cost=4 位小数 / token=k|M / percent */
    format?: 'number' | 'cost' | 'token' | 'percent' | 'raw';
    /** 环比（百分比，正为上升） */
    delta?: number;
    /** 越低越好（用于决定环比颜色） */
    lowerIsBetter?: boolean;
    /** 目标值，用于水位显示 */
    target?: number;
    /** 水位方向：>=target 达标 或 <=target 达标 */
    targetKind?: 'min' | 'max';
    icon?: string;
    hint?: string;
    trend?: number[];
  }>(),
  {
    unit: '',
    format: 'number',
    delta: undefined,
    lowerIsBetter: true,
    target: undefined,
    targetKind: 'min',
    icon: undefined,
    hint: undefined,
    trend: () => [],
  },
);

function fmt(v: number | string): string {
  if (typeof v === 'string') return v;
  switch (props.format) {
    case 'cost':
      return v < 0.01 && v > 0 ? '<$0.01' : v.toFixed(4);
    case 'token':
      return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
    case 'percent':
      return `${v.toFixed(1)}%`;
    case 'raw':
      return String(v);
    default:
      return v.toLocaleString('zh-CN');
  }
}

const deltaClass = computed(() => {
  if (props.delta === undefined) return '';
  const good = props.lowerIsBetter ? props.delta <= 0 : props.delta >= 0;
  return good ? 'oc-stat__delta--good' : 'oc-stat__delta--bad';
});

const waterline = computed(() => {
  if (props.target === undefined || typeof props.value !== 'number') return null;
  const pct = props.targetKind === 'min'
    ? Math.min(100, (props.value / props.target) * 100)
    : Math.min(100, (props.target / Math.max(props.value, 1e-9)) * 100);
  const ok = props.targetKind === 'min' ? props.value >= props.target : props.value <= props.target;
  return { pct, ok };
});

const points = computed(() => {
  if (!props.trend.length) return '';
  const max = Math.max(...props.trend);
  const min = Math.min(...props.trend);
  const span = max - min || 1;
  return props.trend
    .map((v, i) => `${(i / (props.trend.length - 1)) * 100},${28 - ((v - min) / span) * 26}`)
    .join(' ');
});
</script>

<template>
  <div class="oc-stat oc-card">
    <div class="oc-flex--between" style="align-items: flex-start">
      <div class="oc-stat__label">
        <OcIcon v-if="icon" :name="icon" size="14px" />
        {{ label }}
      </div>
      <OcIcon v-if="hint" name="help" size="14px" color="var(--td-text-color-placeholder)" />
    </div>
    <div class="oc-stat__value">
      {{ fmt(value) }}<span v-if="unit" class="oc-stat__unit">{{ unit }}</span>
    </div>
    <div class="oc-flex" style="gap: 8px">
      <span v-if="delta !== undefined" class="oc-stat__delta" :class="deltaClass">
        {{ delta >= 0 ? '▲' : '▼' }} {{ Math.abs(delta).toFixed(1) }}%
      </span>
      <span v-if="waterline" class="oc-stat__target" :class="{ 'oc-stat__target--bad': !waterline.ok }">
        目标 {{ targetKind === 'min' ? '≥' : '≤' }}{{ target !== undefined ? fmt(target) : '' }}
      </span>
    </div>
    <div v-if="waterline" class="oc-stat__bar">
      <div class="oc-stat__bar-fill" :style="{ width: `${waterline.pct}%`, background: waterline.ok ? 'var(--td-success-color, #2ba471)' : 'var(--td-error-color, #d54941)' }" />
    </div>
    <svg v-else-if="points" class="oc-stat__spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <polyline :points="points" fill="none" stroke="var(--td-brand-color, #0052d9)" stroke-width="1.5" />
    </svg>
  </div>
</template>

<style scoped>
.oc-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.oc-stat__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
}

.oc-stat__value {
  font-size: 22px;
  font-weight: 600;
  line-height: 28px;
  font-variant-numeric: tabular-nums;
}

.oc-stat__unit {
  font-size: 12px;
  font-weight: 400;
  margin-left: 2px;
  color: var(--td-text-color-secondary, #666);
}

.oc-stat__delta {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.oc-stat__delta--good {
  color: var(--td-success-color, #2ba471);
}

.oc-stat__delta--bad {
  color: var(--td-error-color, #d54941);
}

.oc-stat__target {
  font-size: 12px;
  color: var(--td-text-color-placeholder, #8f8f8f);
}

.oc-stat__target--bad {
  color: var(--td-error-color, #d54941);
}

.oc-stat__bar {
  height: 4px;
  border-radius: 2px;
  background: var(--td-bg-color-secondarycontainer, #eee);
  overflow: hidden;
}

.oc-stat__bar-fill {
  height: 100%;
  transition: width var(--oc-motion);
}

.oc-stat__spark {
  width: 100%;
  height: 28px;
}
</style>
