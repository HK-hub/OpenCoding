<script setup lang="ts">
/**
 * Flaky 检测面板（N3-08）：观察清单 + 六类归因 + 隔离建议 + 修复 PR。
 * 溯源：卷 35 §5.3 ④；BUILD-MANIFEST N3-08。
 * 契约：三法交叉（重跑 / 统计 / 隔离）后给置信度；单次失败不得标记 flaky；无法判定进观察清单（不误改）。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import type { FlakyFinding } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';
import { downloadCsv } from '@/utils/download';

const ui = useUiStore();
const all = intelData.flakyFindings;
const onlyObservation = ref(false);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onObs(v: unknown) {
  onlyObservation.value = Boolean(v);
}

const rows = computed(() => (onlyObservation.value ? all.filter((f) => f.observation) : all));
const observationCount = computed(() => all.filter((f) => f.observation).length);
const highConf = computed(() => all.filter((f) => f.confidence === '高').length);
const attributionValues = computed(() => [...new Set(all.map((f) => f.attribution))].map((a) => ({ name: a, value: all.filter((f) => f.attribution === a).length })));

const columns = [
  { colKey: 'name', title: '用例', ellipsis: true },
  { colKey: 'attribution', title: '归因（六类）', width: 130, cell: 'attr' },
  { colKey: 'confidence', title: '置信度', width: 100, cell: 'conf' },
  { colKey: 'evidence', title: '证据（三法交叉）', ellipsis: true },
  { colKey: 'isolationSuggestion', title: '隔离建议', ellipsis: true },
  { colKey: 'fixPr', title: '修复 PR', width: 200, cell: 'pr' },
];

const ATTR_THEME: Record<string, 'primary' | 'warning' | 'danger' | 'default' | 'success'> = {
  时序: 'warning', 网络: 'default', 共享状态: 'danger', 随机: 'warning', 资源竞争: 'danger', 顺序依赖: 'primary',
};
const CONF_THEME: Record<string, 'success' | 'warning' | 'default'> = { 高: 'success', 中: 'warning', 低: 'default' };

/** 修复 PR 生成记录：生成中 → 已完成（结果列表可见，统计随之更新） */
type FixPrJob = { id: string; name: string; prRef: string; state: '生成中' | '已完成' };
const prJobs = ref<FixPrJob[]>([]);

/** 导出观察清单（CSV）：内容取自页面真实判定结果（低置信、不误改） */
function exportObservationList() {
  const header = ['用例', '归因', '置信度', '证据（三法交叉）', '隔离建议'];
  const list = all.filter((f) => f.observation);
  const rows = list.map((f) => [f.name, f.attribution, f.confidence, f.evidence.join('；'), f.isolationSuggestion]);
  const file = downloadCsv([header, ...rows], 'flaky-observation-list.csv');
  MessagePlugin.success('已生成 ' + file);
}

/** 对高置信项生成修复 PR：逐项插入生成记录，完成后回写修复 PR 引用并更新统计 */
function generateFixPrs() {
  const targets = all.filter((f) => f.confidence === '高');
  if (!targets.length) {
    MessagePlugin.warning('当前没有高置信归因项：低置信项只进观察清单，不自动修改');
    return;
  }
  if (prJobs.value.some((j) => j.state === '生成中')) {
    MessagePlugin.warning('上一批修复 PR 仍在生成中，请稍候');
    return;
  }

  // 1. 插入生成中记录（结果列表 + 统计）
  const repos = ['order-suite', 'payment-core', 'identity-gateway', 'data-pipeline'];
  const jobs: FixPrJob[] = targets.map((f, i) => ({
    id: f.id,
    name: f.name,
    prRef: `pr://${repos[i % repos.length]}/${4830 + prJobs.value.length + i}`,
    state: '生成中',
  }));
  prJobs.value = [...prJobs.value, ...jobs];
  MessagePlugin.info(`已发起 ${jobs.length} 个修复 PR 生成（低风险修复，生成即运行断言）…`);

  // 2. 模拟生成完成：回写每项的修复 PR 引用，并推进记录状态
  window.setTimeout(() => {
    jobs.forEach((j) => {
      j.state = '已完成';
      const finding = all.find((f) => f.id === j.id);
      if (finding) finding.fixPr = j.prRef;
    });
    prJobs.value = [...prJobs.value];
    MessagePlugin.success(
      `已生成 ${jobs.length} 个修复 PR：${jobs.map((j) => j.prRef).join('、')} → 去向：修复 PR 队列（仅提 PR 不合并；连续 2 次失败将转观察清单）`,
    );
  }, 600);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = all.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Flaky 检测"
      desc="三法交叉判定（同提交重跑不一致 / 跨运行方差超阈值 / 隔离运行后稳定）；单次失败不得标记 flaky，无法判定进观察清单。"
      volume="卷 35" manifest="N3-08" cli="oc ai flaky --suite order-suite --rerun 3 --report"
      :status="[{ label: `${observationCount} 条观察中`, theme: observationCount ? 'warning' : 'success' }, { label: '隔离默认只建议', theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="exportObservationList">导出观察清单</Button>
        <Button size="small" theme="primary" @click="generateFixPrs">对高置信项生成修复 PR</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在做三法交叉判定（重跑 / 统计 / 隔离）…"
      empty-title="暂无 Flaky 发现" empty-desc="最近测试运行无不稳定迹象；单次失败不会被标记 flaky。"
      empty-action="查看测试运行历史" example-task="查看「共享状态」归因的高置信项，并生成低风险修复 PR"
      what="Flaky 判定失败" why="重跑环境不可用 → 已退化为统计法并降置信度（不假装三法交叉）"
      how="恢复重跑环境后重跑判定；降置信结论仍会标注证据来源" trace-id="trace-5be40277"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Alert theme="info" style="margin-bottom: 10px"
        message="单次失败不得标记 flaky；隔离默认只建议（企业可开自动标记）；修复 PR 连续 2 次失败 → 停止自动修复，转观察清单。" />

      <div class="oc-grid oc-grid--4">
        <StatCard label="候选用例" :value="all.length" icon="bug" hint="来自测试事件（含重跑）" />
        <StatCard label="高置信归因" :value="highConf" icon="check" :lower-is-better="false" hint="可生成低风险修复 PR" />
        <StatCard label="观察清单" :value="observationCount" icon="browse" :lower-is-better="true" hint="证据不足 → 不自动修改" />
        <StatCard label="重跑次数" :value="3" icon="refresh" hint="open-coding.intel.flaky.rerun-count 默认 3" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">六类归因分布</div>
          <OcChart type="donut" :values="attributionValues" :height="210" aria-label="Flaky 归因分布" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">判定说明<CliHint command="oc ai flaky evidence --test-suite order-suite" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'm1', label: '① 重跑判定', value: '同一提交重跑不一致 → 强证据（3 次）' },
            { key: 'm2', label: '② 统计判定', value: '跨运行方差超阈值（默认 2.0×）' },
            { key: 'm3', label: '③ 隔离判定', value: '隔离运行后稳定 → 指向顺序依赖 / 共享状态' },
            { key: 'rule', label: '红线', value: '单次失败不得标记 flaky；置信度必须与证据一并输出' },
          ]" />
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <Switch :value="onlyObservation" size="small" @change="onObs" />
            <span style="font-size: 12px">只看观察清单（低置信、不误改）</span>
          </div>
        </div>
      </div>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #attr="{ row }"><Tag size="small" :theme="ATTR_THEME[row.attribution]" variant="light-outline">{{ row.attribution }}</Tag></template>
        <template #conf="{ row }"><Tag size="small" :theme="CONF_THEME[row.confidence]" variant="light-outline">{{ row.confidence }}</Tag></template>
        <template #evidence="{ row }">
          <div v-for="(e, i) in row.evidence" :key="i" class="oc-muted" style="font-size: 11px">· {{ e }}</div>
        </template>
        <template #pr="{ row }">
          <span v-if="row.fixPr" class="oc-mono" style="font-size: 11px">{{ row.fixPr }}</span>
          <Tag v-else size="small" variant="outline">仅观察（不修改）</Tag>
        </template>
      </Table>

      <div v-if="prJobs.length" class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">修复 PR 生成结果（{{ prJobs.filter((j) => j.state === '已完成').length }}/{{ prJobs.length }} 已完成）</div>
        <div class="oc-stack" style="gap: 4px">
          <div v-for="j in prJobs" :key="j.prRef" class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag size="small" :theme="j.state === '已完成' ? 'success' : 'primary'" variant="light-outline">{{ j.state }}</Tag>
            <span style="font-size: 13px">{{ j.name }}</span>
            <span class="oc-mono" style="font-size: 12px">{{ j.prRef }}</span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
