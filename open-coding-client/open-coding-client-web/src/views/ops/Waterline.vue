<script setup lang="ts">
/**
 * 容量水位（G5-07 / G4-05）：四级水位（<60% 正常 / 60–80% 规划扩容 / 80–90% 告警并冻结非关键新增大对象 /
 * ≥90% 阻断高成本新任务 + 紧急扩容 + 降级）+ 当前水位卡（StatCard + gauge）+ 水位趋势 + 按级执行动作。
 * 溯源：卷 32 / BUILD-MANIFEST G5-07、G4-05
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 当前热存储水位（示例口径 68%）与最近一次动作回执 */
const level = ref(68);
const lastAction = ref('');
const columns = [
  { colKey: 'range', title: '水位区间', width: 110 },
  { colKey: 'action', title: '对应动作', width: 320 },
  { colKey: 'blocked', title: '被阻断对象', width: 220 },
  { colKey: 'owner', title: '责任人', width: 150 },
  { colKey: 'current', title: '当前所处' },
];
/** 水位趋势（14 天，确定性）：近期因快照积压抬升，归档后回落 */
const trend = computed(() => [
  { name: '热存储水位（%）', points: [54, 56, 59, 61, 63, 66, 70, 74, 79, 84, 91, 88, 79, 68].map((y, i) => ({ x: `D${i + 1}`, y })) },
]);
const current = computed(() => d.waterlines.find((w) => w.current) ?? d.waterlines[1]);
/** 当前水位的执行动作（按级映射，不越过本级语义） */
const action = computed(() => {
  if (level.value < 60) return { label: '执行扩容预留', text: '执行扩容预留：提前准备分区与存储配额，不影响在线任务。' };
  if (level.value < 80) return { label: '规划扩容', text: `规划扩容：本季度内扩容，并对 ${current.value.owner} 指派容量工单；不阻断任何任务。` };
  if (level.value < 90) return { label: '冻结新增大对象', text: '冻结非关键新增大对象 + 提前归档：被阻断对象＝新增大对象、非关键索引重建（可逆：水位回落后自动解除）。' };
  return { label: '阻断高成本任务', text: '阻断高成本新任务 + 紧急扩容 + 降级（遥测采样降级、索引延迟更新）：影响面＝自治任务与大产物上传，人工只读会话保留；可逆：需容量负责人复核解除。' };
});

function runAction(): void {
  lastAction.value = `${action.value.label} · ${new Date().toLocaleString('zh-CN')} · 值班：${current.value.owner}`;
  MessagePlugin.success(`已执行「${action.value.label}」；动作与影响面已写入容量审计（可在审计日志核对）`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = d.waterlines.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="容量水位"
      desc="四级水位：<60% 正常；60–80% 规划扩容；80–90% 告警 + 冻结非关键新增大对象 + 提前归档；≥90% 阻断高成本新任务 + 紧急扩容 + 降级。"
      volume="卷 32"
      manifest="G5-07"
      cli="oc ops waterline --json --watch 24h"
      :status="[{ label: `当前 ${level}% · ${current.range}`, theme: level >= 90 ? 'danger' : level >= 80 ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="level = 68">复位示例水位</Button>
        <Popconfirm
          theme="warning"
          :content="`执行「${action.label}」：${action.text} 该动作会立即作用于生产存储与任务准入，请确认当前水位确实处于 ${current.range}。`"
          @confirm="runAction"
        >
          <Button size="small" theme="primary">执行水位操作</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="水位数据缺失"
      empty-desc="没有水位数据时无法判断是否冻结新增大对象；请先接入存储与消费者的水位上报。"
      empty-action="接入水位上报"
      example-task="为热存储接入水位上报并配置 80% / 90% 两级告警"
      what="水位指标加载失败"
      why="指标服务不可达，端上不以最后一次采样值代替当前水位（避免误判未越线）"
      how="可重试；如需紧急判断，请用 CLI 直接查询存储侧水位"
      trace-id="trace-waterline-8c02d1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="当前水位" :value="level" unit="%" icon="database" :target="90" target-kind="max" hint="≥90% 进入阻断级" />
        <StatCard label="所处等级" :value="`L${current.level} · ${current.range}`" format="raw" icon="layers" :hint="current.action" />
        <StatCard label="被阻断对象" :value="current.blocked.length" unit="类" format="raw" icon="lock" :lower-is-better="true" :hint="current.blocked.join('、') || '无阻断（可自由写入）'" />
        <StatCard label="预计到达 90%" :value="level >= 80 ? '≤ 9 天' : '≥ 30 天'" format="raw" icon="time" hint="按线性外推（近 14 天斜率）" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">当前水位（热存储）</div>
          <OcChart type="gauge" :values="[{ name: '热存储水位', value: level }]" :threshold="{ value: 90, label: '阻断线 90%', kind: 'max' }" :height="150" format="percent" aria-label="当前热存储水位" />
          <div class="oc-muted" style="font-size: 12px">口径：热存储已用 ÷ 配额，含索引；采样间隔 1 分钟，告警取 10 分钟持续窗口。</div>
          <InfoGrid :columns="2" :items="[{ key: 'grow', label: '增长源', value: '快照 46% / 事件 32% / 媒体 15% / 日志 7%' }, { key: 'dedupe', label: '去重率', value: '0.25（低于设计值 0.35）' }]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">水位趋势（14 天）</div>
          <OcChart type="line" :series="trend" :height="200" format="percent" :threshold="{ value: 90, label: '阻断线 90%', kind: 'max' }" aria-label="热存储水位趋势" />
          <div class="oc-muted" style="font-size: 12px">
            80% 与 90% 两条线分属「冻结新增大对象」与「阻断高成本任务」；降级动作必须显式标注并留痕，不允许静默降级。
          </div>
          <div v-if="lastAction" class="oc-state__hint">最近动作：{{ lastAction }}</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">四级水位与动作（点击「执行水位操作」按当前等级执行）</div>
        <Table :data="d.waterlines" :columns="columns" row-key="level" size="small">
          <template #range="{ row }"><Tag size="small" :theme="row.current ? 'warning' : 'default'" variant="light-outline">{{ row.range }}</Tag></template>
          <template #blocked="{ row }">
            <span v-if="row.blocked.length" class="oc-muted">{{ row.blocked.join('、') }}</span>
            <span v-else class="oc-muted">—（不阻断）</span>
          </template>
          <template #current="{ row }">
            <Tag size="small" :theme="row.current ? 'danger' : 'default'" variant="outline">{{ row.current ? '当前所处' : '未触及' }}</Tag>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
