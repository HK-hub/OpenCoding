<script setup lang="ts">
/**
 * 装饰器链（M-11 / 卷 02 §4.4）：8 层固定顺序 + 独立开关 + 失败策略。
 * 顺序铁律：脱敏先于任何出站与留痕；预算守卫先于资源占用；计量结算最后（无论成败都必须结算）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { type PageState } from '@/components/gateway/types';
import { modelData } from '@/mock/data/model';
import type { DecoratorData } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const layers = ref<DecoratorData[]>(JSON.parse(JSON.stringify(data.decorators)) as DecoratorData[]);

const POLICY_META: Record<DecoratorData['failurePolicy'], { label: string; theme: 'danger' | 'warning' | 'default' | 'success' }> = {
  block: { label: '失败阻断（安全优先）', theme: 'danger' },
  queue_or_reject: { label: '排队或拒绝（策略可配）', theme: 'warning' },
  warn_only: { label: '失败仅告警', theme: 'default' },
  settle_always: { label: '无论成败都结算（有意吞异常 + WARN）', theme: 'success' },
};

const enabledCount = computed(() => layers.value.filter((l) => l.enabled).length);
const chainLatency = computed(() => layers.value.reduce((a, b) => a + (b.enabled ? b.avgLatencyMs : 0), 0));
const blocked = computed(() => layers.value.filter((l) => l.failurePolicy === 'block').length);

const columns: PrimaryTableCol[] = [
  { colKey: 'order', title: '顺序', width: 70 },
  { colKey: 'name', title: '装饰器', width: 150 },
  { colKey: 'responsibility', title: '职责', width: 300 },
  { colKey: 'policy', title: '失败策略', width: 240 },
  { colKey: 'stats', title: '命中 / 自身耗时', width: 170 },
  { colKey: 'enabled', title: '开关', width: 90 },
];

const latencySeries = computed(() => [
  { name: '各层自身耗时（ms，P95）', points: layers.value.map((l) => ({ x: l.name, y: l.avgLatencyMs })) },
]);

function toggle(l: DecoratorData, v: boolean) {
  l.enabled = v;
  if (!v && l.failurePolicy === 'block') {
    MessagePlugin.warning(`已关闭「${l.name}」：该层失败策略为阻断，关闭后安全/预算类保护将不再生效（界面显式标注，不静默）`);
  } else {
    MessagePlugin[v ? 'success' : 'info'](v ? `已启用「${l.name}」` : `已停用「${l.name}」（跳过行为会写入审计事件）`);
  }
}

/** 恢复默认：以清单默认（data.decorators）为准重置全部 8 层的开关与失败策略，启用计数 / 延迟估算随之更新 */
function restoreDefaults() {
  const defaults = new Map(data.decorators.map((d) => [d.key, d]));
  let restored = 0;
  layers.value.forEach((l) => {
    const d = defaults.get(l.key);
    if (!d) return;
    if (!l.enabled) restored += 1;
    l.enabled = d.enabled;
    l.failurePolicy = d.failurePolicy;
    l.failurePolicyNote = d.failurePolicyNote;
  });
  const enabled = layers.value.filter((l) => l.enabled).length;
  if (restored === 0) {
    MessagePlugin.info(`当前已是默认配置：全部 ${enabled} 层启用，失败策略按顺序铁律配置`);
    return;
  }
  MessagePlugin.success(`已恢复默认：全部 ${enabled} 层启用（恢复 ${restored} 层），失败策略按顺序铁律配置`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = layers.value.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="装饰器链"
      desc="8 层固定顺序（从外到内）：预算守卫 → 限流 → 脱敏 → 审计快照 → 重试 → 观测 → 适配器 → 计量结算。每层单一职责、可独立开关；关闭阻断型层会在界面与审计中显式标注。"
      volume="卷 02"
      manifest="M-11"
      cli="oc model decorator list | oc model decorator toggle --key audit_snapshot --off"
      :status="[{ label: `${enabledCount}/8 启用`, theme: 'default' }, { label: `链路自身开销 ${chainLatency}ms（P95 目标 ≤15ms）`, theme: chainLatency <= 15 ? 'success' : 'warning' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="restoreDefaults">恢复默认</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="启用层数" :value="enabledCount" icon="layers" :target="8" target-kind="min" />
      <StatCard label="链路自身耗时（P95）" :value="chainLatency" unit="ms" icon="time" :target="15" target-kind="max" lower-is-better hint="不含网络；门面 + 装饰器链开销目标 ≤15ms" />
      <StatCard label="阻断型层" :value="blocked" icon="lock" hint="预算守卫 / 脱敏为阻断型：失败即拒绝（安全优先）" />
      <StatCard label="计量结算" :value="'必执行'" format="raw" icon="discount" hint="无论成败都结算；结算失败仅 WARN（M19：观测上报不阻断主流程）" />
    </div>

    <StateShell
      :state="state"
      empty-title="装饰器链为空"
      empty-desc="没有启用任何横切层时网关退化为直连适配器（不推荐，缺少预算与脱敏保护）。"
      empty-action="恢复默认"
      what="装饰器链配置加载失败"
      why="配置读取异常；为避免保护缺失，网关会以「默认启用 8 层」的保守配置继续运行。"
      how="可重试；保守配置下审计快照可能写不进去（仅告警）。"
      trace-id="trace-chain-3e07"
      missing-permission="model.manage"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage（关闭阻断型层属 R3 变更）"
      @retry="state = 'LOADING'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">链路顺序（固定，不可重排）</div>
          <Table :data="layers" :columns="columns" row-key="key" size="small" :pagination="{ pageSize: 8, total: layers.length }">
            <template #order="{ row }"><Tag size="small" variant="outline">{{ row.order }}</Tag></template>
            <template #name="{ row }">
              <span class="oc-mono" style="font-size: 12px">{{ row.key }}</span>
              <div>{{ row.name }}</div>
            </template>
            <template #responsibility="{ row }">
              <div class="oc-stack" style="gap: 2px">
                <span style="font-size: 13px">{{ row.responsibility }}</span>
                <span v-if="row.lastError" class="oc-muted" style="font-size: 12px">{{ row.lastError }}</span>
              </div>
            </template>
            <template #policy="{ row }">
              <Tooltip :content="row.failurePolicyNote">
                <Tag :theme="POLICY_META[row.failurePolicy as DecoratorData['failurePolicy']].theme" size="small" variant="light-outline">
                  {{ POLICY_META[row.failurePolicy as DecoratorData['failurePolicy']].label }}
                </Tag>
              </Tooltip>
            </template>
            <template #stats="{ row }">{{ row.hitCount.toLocaleString('zh-CN') }} 次 / {{ row.avgLatencyMs }}ms</template>
            <template #enabled="{ row }">
              <Switch :value="row.enabled" size="small" @change="(v) => toggle(row as DecoratorData, Boolean(v))" />
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">各层自身耗时（不含网络）</div>
          <OcChart type="bar" format="number" unit="ms" :height="200" :series="latencySeries" :aria-label="'装饰器各层耗时'" />
          <div class="oc-divider" />
          <div class="oc-stack" style="font-size: 12px">
            <div><b>顺序铁律 ①</b> 脱敏先于任何出站与留痕（审计 / 观测 / 适配器）：审计快照记录的是已脱敏正文。</div>
            <div><b>顺序铁律 ②</b> 预算守卫先于资源占用（限流 / 重试）：预算不足直接拒绝，不占用并发额度。</div>
            <div><b>顺序铁律 ③</b> 计量结算最后：失败调用也要结算（已消耗的 token 不可回收），失败仅 WARN。</div>
            <div class="oc-muted">插件可插入自定义横切层（DecoratorSPI），但不得改变上述相对顺序。</div>
          </div>
          <div class="oc-flex" style="margin-top: 10px; gap: 6px">
            <Tag size="small" variant="outline">8 层全部可独立开关并有单测</Tag>
            <Tag size="small" variant="outline">顺序不可重排</Tag>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
