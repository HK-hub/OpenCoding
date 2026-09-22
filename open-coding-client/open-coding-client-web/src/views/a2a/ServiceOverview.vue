<script setup lang="ts">
/**
 * A2A 服务面总览（Q-01）：九端点健康 + 服务面开关 + 任务水位 + 调用方拒绝计数。
 * 溯源：卷 23 §4.1 / §4.6 / §7
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 服务面只读演示：本次会话以只读视角查看端点 */
const readonly = ref(true);
const endpoints = computed(() => d.a2a.endpoints);
const cols = [
  { colKey: 'path', title: '端点', width: 300 },
  { colKey: 'method', title: '方法', width: 80 },
  { colKey: 'desc', title: '说明' },
  { colKey: 'p95Ms', title: 'P95(ms)', width: 100 },
  { colKey: 'qps', title: 'QPS', width: 80 },
  { colKey: 'healthy', title: '健康', width: 110 },
];
const taskCounts = computed(() => {
  const m: Record<string, number> = {};
  d.a2a.tasks.forEach((t) => { m[t.status] = (m[t.status] ?? 0) + 1; });
  return Object.entries(m).map(([name, value]) => ({ name, value }));
});
const rejected = computed(() => d.a2a.callerQuotas.reduce((a, c) => a + c.rejected24h, 0));
const queued = computed(() => d.a2a.tasks.filter((t) => t.status === 'queued'));

/** 导出 Agent Card：能力 / 约束 / 端点健康 / 服务面开关取自本页真实数据 */
function exportAgentCard() {
  const file = downloadJson(
    {
      card: d.a2a.agentCard,
      endpoints: endpoints.value,
      serviceSwitch: d.a2a.serviceSwitch,
      view: readonly.value ? '只读视图' : '管理视图',
    },
    'agent-card.json',
  );
  MessagePlugin.success('已生成 ' + file);
}

onMounted(() => {
  setTimeout(() => {
    state.value = endpoints.value.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="A2A 服务面"
      desc="外部系统与其他 Agent 驱动本实例的统一入口：九端点、认证授权、任务生命周期与幂等。local 形态默认关闭且仅回环。"
      volume="卷 23"
      manifest="Q-01"
      cli="oc a2a serve --status --json"
      :status="[{ label: readonly ? '只读视图' : '可写', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="readonly = !readonly">{{ readonly ? '切换到管理视图' : '切换到只读视图' }}</Button>
        <Button size="small" variant="outline" @click="exportAgentCard">导出 Agent Card</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="服务面未启用"
      empty-desc="当前形态（local-lite）默认关闭 A2A 服务面；开启后仅绑定 127.0.0.1，无外部可达面。"
      empty-action="启用本地服务面"
      example-task="提交一个只读代码审查任务：oc run '审查本次变更' --budget-usd 1"
      what="服务面端点列表加载失败"
      why="内核连接中断或配置未同步（A2A 菜单未在组织策略中放行）"
      how="可重试；若持续失败请在「诊断包」导出后联系管理员，或检查组织策略中 a2a.server 开关"
      trace-id="trace-a2a-9f21c4"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="已声明端点" :value="endpoints.length" unit="个" :target="9" target-kind="min" icon="api" hint="九个端点对齐卷 23 §4.1" />
        <StatCard label="端点健康率" :value="Math.round((endpoints.filter((e) => e.healthy).length / endpoints.length) * 100)" format="percent" :target="99" target-kind="min" />
        <StatCard label="在跑外部任务" :value="d.a2a.tasks.filter((t) => t.status === 'running').length" unit="个" :target="120" target-kind="max" hint="并发配额 120" />
        <StatCard label="24h 限流拒绝" :value="rejected" unit="次" lower-is-better :target="50" target-kind="max" icon="sound" hint="超限返回 429 + Retry-After" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">服务面开关（默认安全）</div>
          <div class="oc-stack">
            <div v-for="s in d.a2a.serviceSwitch" :key="s.key" class="oc-flex--between" style="align-items: flex-start">
              <div class="oc-grow">
                <div class="oc-flex" style="gap: 6px">
                  <b style="font-size: 13px">{{ s.label }}</b>
                  <Tag size="small" :theme="s.enabled ? 'success' : 'default'" variant="light-outline">{{ s.enabled ? '已启用' : '已关闭' }}</Tag>
                  <Tag size="small" variant="outline" class="oc-mono">{{ s.key }}</Tag>
                </div>
                <div class="oc-muted" style="font-size: 12px; margin-top: 2px">{{ s.note }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">任务状态分布（外部可见生命周期）</div>
          <OcChart type="donut" :values="taskCounts" :height="200" aria-label="外部任务状态分布" />
          <div class="oc-muted" style="font-size: 12px">
            映射规则：外部 task ↔ 内部 WorkItem；审批 ↔ permission.approval.*；事件流为内部事件的过滤投影。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">端点清单与健康</div>
          <CopyableId id="corr-a2a-endpoints-7731" label="复制诊断 correlationId" />
        </div>
        <Table :data="endpoints" :columns="cols" row-key="path" size="small" style="margin-top: 8px">
          <template #cell="{ row }">
            <div v-if="row.path === '/a2a/v1/artifacts/{id}'">
              <span class="oc-mono">{{ row.path }}</span>
              <Tag size="small" theme="warning" variant="light-outline" style="margin-left: 6px">产物端点降级</Tag>
            </div>
            <span v-else class="oc-mono">{{ row.path }}</span>
          </template>
        </Table>
        <div v-if="!endpoints[8].healthy" class="oc-state__hint" style="margin-top: 8px">
          不静默失败：产物端点 P95 1500ms 超出 500ms 目标，已标记降级并提供替代路径（结果引用内联摘要 + 稍后重试签名 URL）。
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">排队可见性（位置与 ETA）</div>
        <div v-if="queued.length" class="oc-stack">
          <div v-for="t in queued" :key="t.taskId" class="oc-flex oc-flex--wrap" style="gap: 8px">
            <span class="oc-mono">{{ t.taskId }}</span>
            <Tag size="small" variant="outline">{{ t.title }}</Tag>
            <Tag size="small" theme="primary" variant="light-outline">位置 {{ t.queuePosition }}</Tag>
            <span class="oc-muted">预计 {{ Math.round(t.etaSeconds / 60) }} 分钟后开始 · 调用方 {{ t.caller.name }}</span>
          </div>
        </div>
        <div v-else class="oc-muted" style="font-size: 12px">当前无排队任务；高优先级可插队（受配额与策略约束）。</div>
      </div>
    </StateShell>
  </div>
</template>
