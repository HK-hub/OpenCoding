<script setup lang="ts">
/**
 * 错误分类卡：10 类错误之一的可视化（可重试标记 + 厂商原始码脱敏 + 建议动作）。
 * 用于错误诊断页与连通性测试结果分区；不静默：不可重试也必须给出替代路径。
 */
import { Tag, Tooltip } from 'tdesign-vue-next';
import type { ErrorClassData } from '@/mock/data/model';
import InfoGrid from '@/components/common/InfoGrid.vue';
import type { InfoItem } from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';

const props = defineProps<{ item: ErrorClassData; traceId?: string }>();

function items(): InfoItem[] {
  return [
    { key: 'code', label: '内核错误码', value: props.item.code, mono: true },
    { key: 'retryable', label: '可重试', value: props.item.retryable ? '是（按分类退避重试）' : '否（直接上抛，不消耗重试额度）', tag: { text: props.item.retryable ? '可重试' : '不可重试', theme: props.item.retryable ? 'warning' : 'danger' } },
    { key: 'vendor', label: '厂商原始码（脱敏）', value: props.item.vendorCodeMasked, secretRef: false },
    { key: 'handling', label: '处理方式', value: props.item.handling, span: 2 },
    { key: 'suggestion', label: '建议动作', value: props.item.suggestion, span: 2 },
    { key: 'occurrences', label: '24 小时发生次数', value: String(props.item.occurrences24h) },
    { key: 'models', label: '受影响模型', value: props.item.affectedModels.join('、') || '—' },
  ];
}
</script>

<template>
  <div class="oc-card">
    <div class="oc-card__title">
      <span class="oc-flex" style="gap: 6px">
        {{ item.name }}
        <Tag :theme="item.severity === 'error' ? 'danger' : 'warning'" size="small" variant="light-outline">
          {{ item.severity === 'error' ? 'ERROR 级' : 'WARN 级' }}
        </Tag>
        <Tag :theme="item.retryable ? 'warning' : 'default'" size="small" variant="outline">
          {{ item.retryable ? '可重试' : '不可重试' }}
        </Tag>
      </span>
      <Tooltip content="分类矩阵与重试策略同源（卷 02 §4.5）；重试只认 ErrorCode.retryable，不做 fallback 链静默切换">
        <span class="oc-muted" style="font-size: 12px">共 10 类</span>
      </Tooltip>
    </div>
    <InfoGrid :items="items()" :columns="2" />
    <div v-if="traceId" class="oc-flex" style="margin-top: 8px">
      <span class="oc-muted" style="font-size: 12px">最近一次样本 traceId：</span>
      <CopyableId :id="traceId" label="复制 traceId" />
    </div>
  </div>
</template>
