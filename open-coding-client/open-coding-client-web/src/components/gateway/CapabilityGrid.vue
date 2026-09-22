<script setup lang="ts">
/**
 * 能力矩阵：8+2 能力位 × 三态（supported / degraded / unsupported）。
 * 不支持时 tooltip 显式给出「不支持时的显式行为」，禁止静默降级（卷 02 §4.2）。
 */
import { computed } from 'vue';
import { Tag, Tooltip } from 'tdesign-vue-next';
import { CAPABILITY_META, CAPABILITY_STATE_META, type CapabilityMatrix } from '@/mock/data/model';
import OcIcon from '@/components/common/OcIcon.vue';

const props = withDefaults(
  defineProps<{
    /** 单模型能力矩阵；多模型对比时传 models 使用 compact 模式 */
    capabilities?: CapabilityMatrix;
    /** 紧密模式（列表内联） */
    compact?: boolean;
  }>(),
  { capabilities: undefined, compact: false },
);

const cells = computed(() =>
  CAPABILITY_META.map((meta) => {
    const state = props.capabilities ? props.capabilities[meta.key] : 'unsupported';
    const stateMeta = CAPABILITY_STATE_META[state];
    return {
      key: meta.key,
      label: meta.label,
      group: meta.group,
      state,
      stateLabel: stateMeta.label,
      theme: stateMeta.theme,
      tip: state === 'unsupported'
        ? `不支持时的显式行为：${meta.unsupportedBehavior}`
        : state === 'degraded'
          ? `降级：${meta.unsupportedBehavior}`
          : '原生支持',
    };
  }),
);
</script>

<template>
  <div class="oc-caps" :class="{ 'oc-caps--compact': compact }">
    <Tooltip v-for="c in cells" :key="c.key" :content="`${c.label}（${c.group}）：${c.tip}`">
      <div class="oc-caps__cell" :class="{ 'oc-caps__cell--off': c.state === 'unsupported' }">
        <div class="oc-caps__label">
          {{ compact ? c.label : `${c.label}` }}
        </div>
        <Tag :theme="c.theme" size="small" variant="light-outline">
          <OcIcon v-if="c.state === 'supported'" name="check" size="12px" />
          <OcIcon v-else-if="c.state === 'degraded'" name="loading" size="12px" />
          <OcIcon v-else name="close" size="12px" />
          {{ c.stateLabel }}
        </Tag>
      </div>
    </Tooltip>
  </div>
</template>

<style scoped>
.oc-caps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
  gap: 8px;
}

.oc-caps--compact {
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
  gap: 4px;
}

.oc-caps__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  background: var(--oc-bg-container);
}

.oc-caps__cell--off {
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
  border-style: dashed;
}

.oc-caps__label {
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
