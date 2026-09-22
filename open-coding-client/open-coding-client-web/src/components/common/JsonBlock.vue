<script setup lang="ts">
/**
 * JSON / 文本块：可折叠、可复制、可选脱敏（密钥字段一律掩码）。
 */
import { computed, ref } from 'vue';
import { Button, MessagePlugin } from 'tdesign-vue-next';
import OcIcon from './OcIcon.vue';

const SENSITIVE_KEYS = ['apikey', 'api_key', 'secret', 'token', 'password', 'credential', 'signature', 'authorization'];

const props = withDefaults(
  defineProps<{
    value: unknown;
    /** 最大展示高度（px），超出折叠 */
    collapseOver?: number;
    /** 强制脱敏（默认按字段名自动识别） */
    mask?: boolean;
    label?: string;
  }>(),
  { collapseOver: 260, mask: true, label: '' },
);

const expanded = ref(false);

/** 深度脱敏：密钥类字段替换为引用式掩码 */
function redact(input: unknown): unknown {
  if (!props.mask) return input;
  if (Array.isArray(input)) return input.map(redact);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(input as Record<string, unknown>).forEach(([k, v]) => {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
        out[k] = '••••••（引用式，明文永不回显）';
      } else {
        out[k] = redact(v);
      }
    });
    return out;
  }
  return input;
}

const text = computed(() => {
  const v = redact(props.value);
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
});

const tooLong = computed(() => text.value.split('\n').length > 12);

const shown = computed(() => {
  if (!tooLong.value || expanded.value) return text.value;
  return `${text.value.split('\n').slice(0, 12).join('\n')}\n…`;
});

async function copy() {
  await navigator.clipboard.writeText(text.value);
  MessagePlugin.success('已复制');
}
</script>

<template>
  <div class="oc-json">
    <div v-if="label || tooLong" class="oc-flex--between" style="margin-bottom: 4px">
      <span class="oc-secondary" style="font-size: 12px">{{ label }}</span>
      <div class="oc-flex" style="gap: 4px">
        <Button v-if="tooLong" size="small" variant="text" @click="expanded = !expanded">
          {{ expanded ? '折叠' : '展开全部' }}
        </Button>
        <Button size="small" variant="text" @click="copy"><OcIcon name="copy" size="12px" /> 复制</Button>
      </div>
    </div>
    <pre class="oc-pre" :style="{ maxHeight: expanded ? '60vh' : `${collapseOver}px` }">{{ shown }}</pre>
  </div>
</template>
