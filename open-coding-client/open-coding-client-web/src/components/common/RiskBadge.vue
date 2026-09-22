<script setup lang="ts">
/**
 * 风险徽标：R0 只读 / R1 受控写 / R2 执行 / R3 外发 / R4 破坏性 / R5 敏感。
 * 审批卡、工具卡、策略页统一使用，颜色与默认决策口径来自卷 06 §4.1。
 */
import { computed } from 'vue';
import { Tooltip } from 'tdesign-vue-next';

const RISK: Record<string, { label: string; desc: string; decision: string; color: string }> = {
  R0: { label: 'R0 只读', desc: '读文件 / 检索 / 查看状态', decision: 'ALLOW（审计留痕）', color: 'var(--oc-risk-r0)' },
  R1: { label: 'R1 受控写', desc: '工作区内文件写 / 格式化 / 建目录', decision: 'ALLOW 或 ASK（按模式，附 diff 预览）', color: 'var(--oc-risk-r1)' },
  R2: { label: 'R2 执行', desc: '运行命令 / 测试 / 构建', decision: 'ASK；autonomous 白名单内 ALLOW（沙箱 + 资源限制）', color: 'var(--oc-risk-r2)' },
  R3: { label: 'R3 外发', desc: '网络请求 / 上传 / 推送 / 发消息', decision: 'ASK；域名白名单内可 ALLOW（出网审计）', color: 'var(--oc-risk-r3)' },
  R4: { label: 'R4 破坏性', desc: '删除 / reset --hard / push --force / 生产资源', decision: '强 ASK；企业可 DENY', color: 'var(--oc-risk-r4)' },
  R5: { label: 'R5 敏感', desc: '密钥读取 / 凭证使用 / 跨租户数据访问', decision: 'DENY 或令牌制（默认禁止）', color: 'var(--oc-risk-r5)' },
};

const props = defineProps<{ level: string; showDesc?: boolean }>();

const meta = computed(() => RISK[props.level] ?? RISK.R2);
</script>

<template>
  <Tooltip :content="`${meta.desc} · 默认决策：${meta.decision}`">
    <span class="oc-risk" :style="{ borderColor: meta.color, color: meta.color }">
      {{ meta.label }}<template v-if="showDesc"> · {{ meta.desc }}</template>
    </span>
  </Tooltip>
</template>

<style scoped>
.oc-risk {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid;
  border-radius: 3px;
  padding: 0 5px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
}
</style>
