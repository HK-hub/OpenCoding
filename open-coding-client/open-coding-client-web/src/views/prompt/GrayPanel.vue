<script setup lang="ts">
/**
 * 提示词灰度面板（M-20 / 卷 04 D-PRM-5）：
 * 稳定分桶（租户/项目/会话哈希 + salt 固定，可复现）+ arm 指标 + 门控阈值 + 自动回滚记录。
 * 回滚/暂停均为显式动作，界面标注原因与影响面（不静默切回稳定版）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Progress, Table, Tag, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtCost, type PageState } from '@/components/gateway/types';
import { modelData } from '@/mock/data/model';
import type { GrayGateData, PromptGrayArmData } from '@/mock/data/model';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');

/** 按实验聚合 arms（同一 rolloutId 的 A/B 臂） */
const rollouts = computed(() => {
  const map = new Map<string, PromptGrayArmData[]>();
  data.grayArms.forEach((a) => {
    const list = map.get(a.rolloutId) ?? [];
    list.push(a);
    map.set(a.rolloutId, list);
  });
  return [...map.entries()].map(([id, arms]) => ({
    id,
    assetId: arms[0].assetId,
    assetName: arms[0].assetName,
    status: arms[0].status,
    arms: arms.sort((a, b) => (a.arm < b.arm ? -1 : 1)),
    gates: arms[0].gate,
    failedGates: arms[0].gate.filter((g) => !g.pass).length,
  }));
});

const runningCount = computed(() => rollouts.value.filter((r) => r.status === 'running').length);
const pausedCount = computed(() => rollouts.value.filter((r) => r.status === 'paused').length);
const rolledBackCount = computed(() => rollouts.value.filter((r) => r.status === 'rolled_back').length);
const failedGateTotal = computed(() => rollouts.value.reduce((a, b) => a + b.failedGates, 0));

const armColumns: PrimaryTableCol[] = [
  { colKey: 'arm', title: 'Arm / 版本', width: 220 },
  { colKey: 'traffic', title: '流量 / 样本', width: 160 },
  { colKey: 'quality', title: '质量分', width: 110 },
  { colKey: 'pass', title: '通过率', width: 110 },
  { colKey: 'cost', title: '单次成本', width: 120 },
  { colKey: 'latency', title: 'P95 延迟', width: 110 },
  { colKey: 'error', title: '错误率', width: 100 },
];

function rowsOf(arms: PromptGrayArmData[]) {
  return arms.map((a) => ({
    id: `${a.rolloutId}-${a.arm}`,
    arm: `Arm ${a.arm}`,
    version: a.version,
    traffic: `${a.trafficPct}%`,
    samples: a.sampleSessions.toLocaleString('zh-CN'),
    quality: a.metrics.qualityScore,
    pass: `${a.metrics.passRatePct}%`,
    cost: fmtCost(a.metrics.costPerCallUsd),
    latency: `${a.metrics.p95LatencyMs}ms`,
    error: `${a.metrics.errorRatePct}%`,
  }));
}

function promote(id: string) {
  MessagePlugin.warning(`${id} 已提交放量：门控未通过时会被拒绝（需先修复或显式豁免并记录理由）`);
}

function rollback(id: string) {
  MessagePlugin.warning(`已回滚 ${id}：灰度流量立即切回稳定版本；已产生会话保留原版本集（可复现）；回滚事件写入审计`);
}

/** 导出灰度实验报告：按实验聚合的 arm 指标与门控结论（含阈值/当前值），用于复现与成本回归 */
function exportReport() {
  const file = downloadJson(
    {
      summary: {
        total: rollouts.value.length,
        running: runningCount.value,
        paused: pausedCount.value,
        rolledBack: rolledBackCount.value,
        failedGates: failedGateTotal.value,
      },
      rollouts: rollouts.value.map((r) => ({
        id: r.id,
        assetId: r.assetId,
        assetName: r.assetName,
        status: r.status,
        failedGates: r.failedGates,
        arms: r.arms.map((a) => ({
          arm: a.arm,
          version: a.version,
          trafficPct: a.trafficPct,
          sampleSessions: a.sampleSessions,
          metrics: a.metrics,
        })),
        gates: r.gates,
      })),
      redactionNote: '报告含 arm 指标与门控结论，可用于复现分桶与成本回归；不含任何密钥材料',
    },
    `oc-prompt-gray-report-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出灰度实验报告：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = data.grayArms.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="提示词灰度"
      desc="资产版本按租户 / 项目 / 会话哈希稳定分桶（salt 固定 → 同输入同分桶，可复现）。门控 = 评测集 + 在线指标双门槛；劣化超阈值自动回滚并留痕。"
      volume="卷 04"
      manifest="M-20"
      cli="oc prompt gray list | oc prompt gray promote --rollout gray-prompt-01 --arm B | oc prompt gray rollback --rollout gray-prompt-03"
      :status="[{ label: `${runningCount} 进行中 / ${pausedCount} 已暂停`, theme: 'primary' }, { label: `${failedGateTotal} 项门控未通过`, theme: failedGateTotal ? 'warning' : 'success' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="exportReport">导出实验报告</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="灰度实验数" :value="rollouts.length" icon="flag" :hint="`进行中 ${runningCount} · 已暂停 ${pausedCount} · 已回滚 ${rolledBackCount}`" />
      <StatCard label="自动回滚" :value="rolledBackCount" icon="refresh" hint="由门控触发；回滚记录含触发指标与动作清单" />
      <StatCard label="分桶稳定性" :value="100" format="percent" icon="sitemap" :target="100" target-kind="min" hint="hash(salt + 租户/项目/会话) % buckets；灰度期间禁止改 salt" />
      <StatCard label="评测成本（灰度样本）" :value="data.grayArms.reduce((a, b) => a + b.sampleSessions * b.metrics.costPerCallUsd, 0)" format="cost" icon="discount" hint="灰度样本调用同样计入六维归因（成本可见）" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有提示词灰度实验"
      empty-desc="没有实验时全部流量走稳定版本。"
      empty-action="创建灰度实验"
      what="灰度数据加载失败"
      why="实验服务不可达；为避免误放量，界面不展示过期分桶结果，装载保持现状。"
      how="可重试；实验不可读期间不会自动放量或回滚。"
      trace-id="trace-pgray-1c73"
      missing-permission="prompt.manage"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 prompt.manage（放量/回滚影响全租户提示词行为）"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('创建实验：选择资产版本、目标层级、分桶维度、流量比例与门控指标')"
    >
      <div v-for="r in rollouts" :key="r.id" class="oc-card">
        <div class="oc-card__title">
          <span class="oc-flex oc-flex--wrap" style="gap: 6px">
            <b>{{ r.assetName }}</b>
            <span class="oc-mono oc-muted" style="font-size: 12px">{{ r.assetId }} · {{ r.id }}</span>
            <Tag :theme="r.status === 'running' ? 'primary' : r.status === 'paused' ? 'warning' : r.status === 'rolled_back' ? 'danger' : 'success'" size="small" variant="light-outline">
              {{ r.status === 'running' ? '进行中' : r.status === 'paused' ? '已暂停' : r.status === 'rolled_back' ? '已自动回滚' : '已完成' }}
            </Tag>
          </span>
          <span class="oc-flex" style="gap: 6px">
            <Popconfirm content="放量前复跑门控：关键用例通过率不得低于稳定臂；成本不劣化 >10%。未通过则拒绝放量（可显式豁免并记录理由）。" @confirm="promote(r.id)">
              <Button size="small" theme="primary" :disabled="r.failedGates > 0">放量候选臂</Button>
            </Popconfirm>
            <Popconfirm content="回滚后灰度流量立即切回稳定版本；已产生会话保留原版本集（历史行为可复现）；不影响其它资产。" @confirm="rollback(r.id)">
              <Button size="small" variant="outline">回滚</Button>
            </Popconfirm>
          </span>
        </div>

        <Table :data="rowsOf(r.arms)" :columns="armColumns" row-key="id" size="small" :pagination="{ pageSize: 4, total: r.arms.length }">
          <template #arm="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <Tag :theme="row.arm === 'Arm B' ? 'warning' : 'default'" size="small" variant="light-outline">{{ row.arm }}</Tag>
              <span class="oc-mono oc-muted" style="font-size: 12px">{{ row.version }}</span>
            </div>
          </template>
          <template #traffic="{ row }">
            <div class="oc-stack" style="gap: 2px; font-size: 12px">
              <span>{{ row.traffic }}</span>
              <span class="oc-muted">{{ row.samples }} 会话样本</span>
            </div>
          </template>
        </Table>

        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <span v-for="g in r.gates" :key="g.metric" class="oc-flex" style="gap: 4px; font-size: 12px">
            <Tag :theme="g.pass ? 'success' : 'danger'" size="small" variant="light-outline">{{ g.metric }} {{ g.pass ? '达标' : '未达标' }}</Tag>
            <Tooltip :content="g.note">
              <span class="oc-flex" style="gap: 4px">
                <Progress :percentage="Math.min(100, Math.round((g.current / Math.max(1e-9, g.threshold)) * 100))" :status="g.pass ? 'success' : 'warning'" size="small" :style="{ width: '60px' }" />
                <span class="oc-muted">{{ g.current }} / 阈值 {{ g.threshold }}</span>
              </span>
            </Tooltip>
          </span>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">自动回滚记录（显式留痕）</div>
        <Timeline v-if="data.grayArms.some((a) => a.status === 'rolled_back')">
          <TimelineItem label="gray-prompt-03 · 计划优先模板">
            v1.4.0（B 臂）关键用例通过率 93.2% 低于门控 95.0%（劣化 1.8pp）→ 自动回滚至 v1.3.0；
            动作：冻结 B 臂流量 / 生成降级标记 / 通知作者 / 保留样本用于定位（详见「版本与发布」）。
          </TimelineItem>
          <TimelineItem label="gray-prompt-02 · 编码模式">
            B 臂成本超门控 6.4%（多轮探索）且 P95 延迟超 2.4% → 暂停放量（未回滚，因质量指标为正收益）；
            动作：暂停流量增长 / 提示作者优化工具调用上限（保留 20% 流量观察）。
          </TimelineItem>
        </Timeline>
        <div v-else class="oc-muted" style="font-size: 13px">暂无回滚记录。</div>
      </div>
    </StateShell>
  </div>
</template>
