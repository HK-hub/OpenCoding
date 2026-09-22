<script setup lang="ts">
/**
 * boot 页：两阶段启动的逐条可见状态（模块系统 → 客户端插件 → 首屏数据）。
 * 失败 bundle 可见且可复制详情；单条可重试（不白屏）。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Progress, Tag } from 'tdesign-vue-next';
import OcIcon from '@/components/common/OcIcon.vue';
import CopyableId from '@/components/common/CopyableId.vue';

const router = useRouter();

/** 启动项：retrying 为重试过程中的「进行中」中间态 */
type BootStage = { stage: string; ok: boolean; detail: string; ms: number; retrying?: boolean };

const stages = ref<BootStage[]>([
  { stage: '模块系统', ok: true, detail: '内核 sidecar 已连接 · protocolVersion 3.2 · 能力协商完成', ms: 412 },
  { stage: '客户端插件', ok: false, detail: '插件 k8s-ops 初始化失败：连接 api.acme.internal 超时（已隔离，不影响内核）', ms: 1_100 },
  { stage: '首屏数据', ok: true, detail: '会话列表 12 条 · 待审批 3 条 · 通知 5 条', ms: 320 },
  { stage: '能力门控', ok: true, detail: '多模态输入：可用（vision 能力已探测）· 网络工具：受策略限制', ms: 90 },
]);

const progress = ref(0);

/** 就绪 / 待重试统计：随重试结果更新（顶栏可见） */
const readyCount = computed(() => stages.value.filter((s) => s.ok && !s.retrying).length);
const failedCount = computed(() => stages.value.filter((s) => !s.ok && !s.retrying).length);

/** 重试单个启动项：先置「进行中」，成功后置「就绪」并刷新整体进度与统计（不白屏） */
function retryStage(s: BootStage) {
  if (s.retrying) return;

  // 1. 置为进行中，避免重复触发
  s.retrying = true;
  s.detail = `正在重试「${s.stage}」：重新建立连接并做能力探测…`;
  stages.value = [...stages.value];

  // 2. 模拟重试完成：该项转为就绪，整体进度按就绪比例推进
  window.setTimeout(() => {
    s.retrying = false;
    s.ok = true;
    s.ms = 640;
    s.detail = `重试成功：${s.stage} 已就绪（连接恢复，能力已重新探测）`;
    progress.value = Math.max(progress.value, Math.round((readyCount.value / stages.value.length) * 100));
    stages.value = [...stages.value];
    MessagePlugin.success(`「${s.stage}」重试完成，已置为就绪`);
  }, 600);
}

onMounted(() => {
  const t = window.setInterval(() => {
    progress.value = Math.min(100, progress.value + 12);
    if (progress.value >= 100) window.clearInterval(t);
  }, 60);
});
</script>

<template>
  <div class="boot">
    <div class="boot__panel">
      <div class="oc-flex" style="gap: 8px">
        <span class="boot__logo">OC</span>
        <div>
          <div style="font-weight: 600">OpenCoding Harness 正在启动</div>
          <div class="oc-muted" style="font-size: 12px">首屏可交互目标：≤3.5s（无会话）/ ≤5s（含数据）</div>
          <div class="oc-muted" style="font-size: 12px">
            启动项就绪 {{ readyCount }}/{{ stages.length }}<span v-if="failedCount"> · 待重试 {{ failedCount }} 项</span>
          </div>
        </div>
      </div>

      <Progress :percentage="progress" :stroke-width="4" style="margin: 14px 0" />

      <div class="oc-stack" style="gap: 8px">
        <div v-for="s in stages" :key="s.stage" class="boot__row">
          <OcIcon :name="s.retrying ? 'loading' : s.ok ? 'check' : 'error'" size="16px" :color="s.retrying ? 'var(--oc-sev-info)' : s.ok ? 'var(--oc-sev-ok)' : 'var(--oc-sev-error)'" />
          <div class="oc-grow">
            <div class="oc-flex" style="gap: 6px">
              <b style="font-size: 13px">{{ s.stage }}</b>
              <Tag size="small" :theme="s.retrying ? 'primary' : s.ok ? 'success' : 'danger'" variant="light-outline">
                {{ s.retrying ? '进行中' : s.ok ? '通过' : '失败（已隔离）' }}
              </Tag>
              <span class="oc-muted" style="font-size: 11px">{{ s.ms }}ms</span>
            </div>
            <div class="oc-secondary" style="font-size: 12px">{{ s.detail }}</div>
          </div>
          <Button size="small" variant="text" @click="retryStage(s)">重试此项</Button>
        </div>
      </div>

      <div class="oc-divider" />
      <div class="oc-flex--between">
        <CopyableId id="boot-9f21ab77" label="复制启动详情" />
        <div class="oc-flex" style="gap: 8px">
          <Button variant="outline" @click="router.push('/settings/diagnostics')">打开诊断</Button>
          <Button theme="primary" @click="router.push('/session')">进入工作台</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.boot {
  height: 100%;
  display: grid;
  place-items: center;
  background: var(--oc-bg-page);
}

.boot__panel {
  width: 640px;
  max-width: 92vw;
  background: var(--oc-bg-container);
  border: 1px solid var(--oc-border);
  border-radius: 8px;
  padding: 20px 22px;
}

.boot__logo {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  background: linear-gradient(135deg, #0052d9, #2ba471);
  color: #fff;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.boot__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--oc-border);
  border-radius: 6px;
}
</style>
