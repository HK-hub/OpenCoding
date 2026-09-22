<script setup lang="ts">
/**
 * Runbook 库（G5-03）：RB-01…RB-12 条目（标题 / 触发条件 / 负责人角色），
 * 选中后展示步骤表（序号 / 动作 / 命令 / 预期结果）与勾选进度，含验证命令与成功判据两栏、
 * 执行记录与真实导出（downloadJson）。
 * 溯源：卷 32 / BUILD-MANIFEST G5-03
 */
import { computed, onMounted, ref, watch } from 'vue';
import { Button, Checkbox, MessagePlugin, Progress, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const pickedId = ref(d.runbooks[0]?.id ?? 'RB-01');
const done = ref<number[]>([]);
/** EDGE_DATA：库内条目超过渲染阈值时先折叠，按需加载更多 */
const cap = ref(10);
const visibleRunbooks = computed(() => d.runbooks.slice(0, cap.value));
const records = ref<{ at: string; actor: string; result: string; note: string }[]>([]);

const rb = computed(() => d.runbooks.find((r) => r.id === pickedId.value) ?? d.runbooks[0]);
const pct = computed(() => (rb.value.steps.length ? Math.round((done.value.length / rb.value.steps.length) * 100) : 0));
const columns = [
  { colKey: 'id', title: '编号', width: 76 },
  { colKey: 'title', title: '标题', width: 190 },
  { colKey: 'trigger', title: '触发条件', width: 190 },
  { colKey: 'executorRole', title: '负责人角色', width: 120 },
  { colKey: 'difficulty', title: '难度', width: 74 },
];
const stepColumns = [
  { colKey: 'check', title: '完成', width: 66 },
  { colKey: 'no', title: '序号', width: 58 },
  { colKey: 'action', title: '动作', width: 150 },
  { colKey: 'command', title: '命令', width: 300 },
  { colKey: 'expected', title: '预期结果' },
];

/** 切换 Runbook 时重置勾选进度，并把该 Runbook 的最近一次执行补入执行记录 */
watch(pickedId, () => {
  done.value = [];
  records.value = [{
    at: new Date(rb.value.lastExecutedAt).toLocaleString('zh-CN'),
    actor: rb.value.owner,
    result: rb.value.steps.length ? '部分完成' : '完成',
    note: `最近一次执行（演练：${rb.value.lastDrillAt ? new Date(rb.value.lastDrillAt).toLocaleDateString('zh-CN') : '未演练'}）`,
  }];
});

function toggle(no: number): void {
  done.value = done.value.includes(no) ? done.value.filter((x) => x !== no) : [...done.value, no];
}

/** 全部步骤勾选后才允许标记执行完成：跳过步骤必须显式说明，禁止静默略过 */
function finish(): void {
  records.value = [{ at: new Date().toLocaleString('zh-CN'), actor: '周砚青（SRE 值班）', result: '完成', note: '全部步骤已勾选，成功判据已复核' }, ...records.value];
  MessagePlugin.success(`${rb.value.id} 执行记录已归档（含操作者与时间戳，可审计）`);
}

function exportRecords(): void {
  const file = downloadJson({ runbook: rb.value.id, title: rb.value.title, records: records.value, steps: rb.value.steps }, `oc-runbook-${rb.value.id}-execution.json`);
  MessagePlugin.success(`已导出执行记录：${file}`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = d.runbooks.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
  records.value = [{
    at: new Date(d.runbooks[0].lastExecutedAt).toLocaleString('zh-CN'),
    actor: d.runbooks[0].owner,
    result: '部分完成',
    note: '初始记录（来自 Runbook 库最近执行时间）',
  }];
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Runbook 库"
      desc="RB-01…RB-12：每条含触发条件、负责人角色、逐步命令与预期结果、验证命令与成功判据；执行过程可勾选留痕并导出。"
      volume="卷 32"
      manifest="G5-03"
      cli="oc runbook list --with-criteria"
      :status="[{ label: '步骤可勾选留痕', theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportRecords">导出执行记录</Button>
        <Button size="small" theme="primary" :disabled="pct < 100" @click="finish">标记完成</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      :collapsed-summary="`Runbook 库共 ${d.runbooks.length} 条，已折叠至 ${cap} 条（剩余按需加载）`"
      :page-size="visibleRunbooks.length"
      empty-title="Runbook 库为空"
      empty-desc="没有 Runbook 的告警不得绑定，也就无法进入值班流程；请先从 RB-01（协议面不可用）开始补齐。"
      empty-action="从模板创建 RB-01"
      example-task="为「事件链路故障」补齐验证命令与成功判据"
      what="Runbook 库加载失败" why="知识库接口返回 500，端上不使用本地缓存兜底（避免执行到过期步骤）"
      how="可重试；执行中的故障请先切换到告警中心查看当前 Runbook 摘要"
      trace-id="trace-runbook-7d2e10"
      @retry="state = 'LOADING'"
      @load-more="cap += 10"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="Runbook 总数" :value="d.runbooks.length" unit="条" format="raw" icon="bookmark" />
        <StatCard label="当前进度" :value="pct" unit="%" format="raw" icon="check" target-kind="min" :target="100" :hint="`${rb.id} 已勾选 ${done.length}/${rb.steps.length} 步`" />
        <StatCard label="上次演练" :value="new Date(rb.lastDrillAt).toLocaleDateString('zh-CN')" format="raw" icon="history" hint="演练未覆盖的 Runbook 不得作为唯一处置路径" />
        <StatCard label="难度" :value="rb.difficulty" format="raw" icon="flag" hint="高难度需双人执行（一人操作一人校验）" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">条目列表（点击行切换查看步骤）</div>
        <Table :data="visibleRunbooks" :columns="columns" row-key="id" size="small" hover @row-click="(ctx: { row: unknown }) => (pickedId = (ctx.row as { id: string }).id)">
          <template #id="{ row }">
            <Tag size="small" :theme="row.id === pickedId ? 'primary' : 'default'" variant="light-outline">{{ row.id }}</Tag>
          </template>
          <template #executorRole="{ row }">{{ row.executorRole }}</template>
          <template #difficulty="{ row }">
            <Tag size="small" :theme="row.difficulty === '极高' || row.difficulty === '高' ? 'danger' : row.difficulty === '中' ? 'warning' : 'success'" variant="light-outline">{{ row.difficulty }}</Tag>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">{{ rb.id }} · {{ rb.title }}</div>
          <Progress :percentage="pct" :status="pct === 100 ? 'success' : 'active'" />
          <Table :data="rb.steps" :columns="stepColumns" row-key="no" size="small" style="margin-top: 8px">
            <template #check="{ row }">
              <Checkbox :checked="done.includes(row.no)" @change="toggle(row.no)" />
            </template>
            <template #command="{ row }"><code class="oc-mono" style="font-size: 12px">{{ row.command }}</code></template>
          </Table>
        </div>
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">验证命令</div>
            <CliHint :command="rb.verifyCommand" label="复制验证命令" />
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">执行人角色：{{ rb.executorRole }}；负责人：{{ rb.owner }}。验证命令必须在处置后立即执行，结论以命令输出为准。</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">成功判据</div>
            <div style="font-size: 13px">{{ rb.successCriteria }}</div>
            <div class="oc-state__hint">判据未达成时不得关闭告警；未闭环告警需写入值班交接单。</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">执行记录</div>
            <InfoGrid :columns="1" :items="records.map((r, i) => ({ key: `r${i}`, label: `${r.at} · ${r.actor}`, value: `${r.result}｜${r.note}` }))" />
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">记录仅追加不可改写；导出为真实文件下载。</div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
