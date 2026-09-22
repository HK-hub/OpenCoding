<script setup lang="ts">
/**
 * 技能使用度量（K-10）：激活/成功率/成本/时长 + 与「无技能基线」对比 + 劣化降级为建议。
 * 溯源：卷 08 D-SKILL-10；劣化判定成功率 < 基线即降级为建议（不再自动装配），并保留一键恢复。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import StateShell from '@/components/common/StateShell.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { fmtMs, useExtList } from '@/components/extension/useExtList';
import { downloadCsv } from '@/utils/download';

const router = useRouter();
const skills = extensionData.skills;
const degraded = computed(() => skills.filter((s) => s.degraded));

const { keyword, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(skills, {
  persistKey: 'skill-metrics',
  pageSize: 10,
  match: (s, kw) => !kw || `${s.name}${s.description}`.toLowerCase().includes(kw),
});

const aggregate = computed(() => {
  const active = skills.filter((s) => s.stats.activationCount > 0);
  const total = active.reduce((a, s) => a + s.stats.activationCount, 0);
  return {
    total,
    successRate: Number((active.reduce((a, s) => a + s.stats.successRate, 0) / active.length).toFixed(1)),
    baseline: Number((active.reduce((a, s) => a + s.stats.baselineSuccessRate, 0) / active.length).toFixed(1)),
    cost: Number((active.reduce((a, s) => a + s.stats.costPerRun, 0) / active.length).toFixed(4)),
    durationMs: Math.round(active.reduce((a, s) => a + s.stats.durationMs, 0) / active.length),
  };
});

/** 与无技能基线对比：同一任务不带技能跑固定用例集的对照数据 */
const comparison = computed(() => [
  { name: '带技能', value: aggregate.value.successRate },
  { name: '无技能基线', value: aggregate.value.baseline },
]);

const columns = [
  { colKey: 'name', title: '技能', width: 300 },
  { colKey: 'activation', title: '激活次数', width: 110 },
  { colKey: 'success', title: '成功率 vs 基线', width: 190 },
  { colKey: 'cost', title: '单次成本', width: 120 },
  { colKey: 'duration', title: '单次时长', width: 120 },
  { colKey: 'feedback', title: '用户反馈', width: 140 },
  { colKey: 'ops', title: '操作', width: 170 },
];

const demoted = ref<Record<string, boolean>>(Object.fromEntries(degraded.value.map((s) => [s.id, true])));

function recover(sid: string, name: string) {
  demoted.value[sid] = false;
  MessagePlugin.success(`${name} 已恢复自动装配资格；若再次劣化将重新降级为建议（连续 2 个观测窗口）`);
}

/** 打开该技能的评测用例：跳转 K-07 评测门禁页并按技能名定位（修复失败用例后可重跑门禁） */
function openEvalCases(name: string) {
  router.push({ path: '/extension/skills/eval', query: { name } });
  MessagePlugin.info(`已打开「${name}」的评测用例：修复后可重跑门禁，达标后自动恢复装配`);
}

/** 空态动作：真实跳转技能库（K-01），便于启用技能后回来看度量 */
function goSkillLibrary() {
  router.push('/extension/skills');
  MessagePlugin.info('已跳转技能库（等价命令 oc skill list）：启用技能后指标从首次运行开始累计');
}

/** 导出度量：CSV 行与表格同源（含基线与归因字段），导出全量技能集不受页内过滤影响 */
function exportMetrics() {
  const rows: (string | number)[][] = [
    ['技能', '版本', '激活次数', '成功率(%)', '基线成功率(%)', '差值(%)', '单次成本(USD)', '单次时长(ms)', '好评', '差评', '是否劣化'],
    ...skills.map((s) => [
      s.name, s.version, s.stats.activationCount, s.stats.successRate, s.stats.baselineSuccessRate,
      Number((s.stats.successRate - s.stats.baselineSuccessRate).toFixed(1)), s.stats.costPerRun,
      s.stats.durationMs, s.stats.userFeedback.up, s.stats.userFeedback.down, s.degraded ? '是' : '否',
    ]),
  ];
  const file = downloadCsv(rows, `oc-skill-metrics-${new Date().toISOString().slice(0, 10)}.csv`);
  MessagePlugin.success(`技能度量已导出：${file}`);
}
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="技能使用度量"
      desc="用「带技能 vs 无技能基线」衡量收益；成功率低于基线的技能自动降级为建议，避免持续劣化拖累任务。"
      volume="卷 08" manifest="K-10" cli="oc skill metrics --compare-baseline"
      :status="[{ label: '基线对比已启用', theme: 'success' }, { label: `劣化 ${degraded.length} 项`, theme: degraded.length ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="reload">刷新</Button>
        <Button size="small" variant="text" @click="exportMetrics">导出度量</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="激活总次数" :value="aggregate.total" unit="次" icon="refresh" :trend="[120, 180, 240, 320, 410, 520, aggregate.total]" />
      <StatCard
        label="平均成功率（对比基线）"
        :value="aggregate.successRate"
        format="percent"
        :target="aggregate.baseline"
        target-kind="min"
        :delta="Number((aggregate.successRate - aggregate.baseline).toFixed(1))"
        :trend="[84, 86, 88, 87, 89, 90, aggregate.successRate]"
      />
      <StatCard label="平均单次成本" :value="aggregate.cost" format="cost" :target="0.9" target-kind="max" />
      <StatCard label="平均单次时长" :value="aggregate.durationMs" unit="ms" :target="300_000" target-kind="max" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">带技能 vs 无技能基线（同一用例集）</h3>
        <OcChart
          type="bar"
          :values="comparison"
          :height="200"
          format="percent"
          :threshold="{ value: aggregate.baseline, label: '基线', kind: 'min' }"
          aria-label="带技能与无技能基线的成功率对比"
        />
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          对照方法：同任务同输入固定快照，各跑 {{ extensionData.skills[0].eval.baselineMetrics.sampleRuns }} 次；差值 ≥ 3% 才判定为有效收益。
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          劣化降级为建议
          <Tag size="small" theme="warning" variant="light-outline">{{ degraded.length }} 项</Tag>
        </h3>
        <div v-for="s in degraded" :key="s.id" class="oc-card" style="margin-bottom: 8px; padding: 10px 12px">
          <div class="oc-flex--between oc-flex--wrap" style="gap: 6px">
            <span class="oc-mono" style="font-size: 12px">{{ s.name }}@{{ s.version }}</span>
            <Tag size="small" theme="warning" variant="light-outline">
              {{ s.stats.successRate }}% &lt; 基线 {{ s.stats.baselineSuccessRate }}%
            </Tag>
          </div>
          <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
            降级理由：连续 2 个观测窗口成功率低于无技能基线，且差评 {{ s.stats.userFeedback.down }} 条。
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Tag size="small" variant="outline">{{ demoted[s.id] ? '当前：仅建议' : '当前：可自动装配' }}</Tag>
            <Popconfirm
              content="恢复自动装配资格：下个观测窗口若再次劣化将重新降级（不影响已授权能力）。"
              @confirm="recover(s.id, s.name)"
            >
              <Button size="small" variant="text" :disabled="!demoted[s.id]">恢复装配</Button>
            </Popconfirm>
            <Button size="small" variant="text" @click="openEvalCases(s.name)">去修复</Button>
          </div>
        </div>
        <div v-if="!degraded.length" class="oc-muted" style="font-size: 12px">无劣化技能：所有技能成功率均不低于基线。</div>
      </div>
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="按名称 / 描述过滤技能" clearable style="width: 260px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条（过滤记忆已开启）</span>
        <span class="oc-grow" />
        <span class="oc-muted" style="font-size: 12px">成本口径：含缓存折扣；时长口径：端到端（含工具调用）</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="10"
      empty-title="暂无可度量的技能"
      empty-desc="技能未产生激活记录（或均未启用）；启用后指标将在首次运行后开始累计。"
      empty-action="前往技能库启用"
      what="度量数据加载失败"
      why="指标服务不可达；本地缓存显示为上一次成功聚合值。"
      how="可重试；指标不影响技能可用性。"
      trace-id="trace-skill-metrics-3c19"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="goSkillLibrary"
    >
      <Table row-key="id" size="small" :data="visible" :columns="columns">
        <template #name="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono" style="font-size: 12px">{{ row.name }}</span>
            <Tag v-if="row.degraded" size="small" theme="warning" variant="light-outline">劣化</Tag>
          </div>
        </template>
        <template #activation="{ row }"><span class="oc-mono">{{ row.stats.activationCount }}</span></template>
        <template #success="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <Tag size="small" :theme="row.stats.successRate >= row.stats.baselineSuccessRate ? 'success' : 'danger'" variant="light-outline">
              {{ row.stats.successRate }}%
            </Tag>
            <Tooltip :content="`无技能基线 ${row.stats.baselineSuccessRate}%；差值 ${(row.stats.successRate - row.stats.baselineSuccessRate).toFixed(1)}%`">
              <span class="oc-flex" style="gap: 3px">
                <OcIcon :name="row.stats.successRate >= row.stats.baselineSuccessRate ? 'thumb-up' : 'thumb-down'" size="13px" />
                <span class="oc-mono" style="font-size: 12px">{{ (row.stats.successRate - row.stats.baselineSuccessRate).toFixed(1) }}%</span>
              </span>
            </Tooltip>
          </div>
        </template>
        <template #cost="{ row }"><span class="oc-mono" style="font-size: 12px">${{ row.stats.costPerRun.toFixed(4) }}</span></template>
        <template #duration="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtMs(row.stats.durationMs) }}</span></template>
        <template #feedback="{ row }">
          <span class="oc-flex" style="gap: 8px; font-size: 12px">
            <span><OcIcon name="thumb-up" size="12px" /> {{ row.stats.userFeedback.up }}</span>
            <span><OcIcon name="thumb-down" size="12px" /> {{ row.stats.userFeedback.down }}</span>
          </span>
        </template>
        <template #ops="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Button size="small" variant="text" @click="openEvalCases(row.name)">评测</Button>
            <Popconfirm v-if="row.degraded" content="将该技能降级为建议（不再自动装配）？" @confirm="demoted[row.id] = true; MessagePlugin.info('已降级为建议')">
              <Button size="small" variant="text">降级为建议</Button>
            </Popconfirm>
            <Tag v-else size="small" theme="success" variant="light-outline">未劣化</Tag>
          </div>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
