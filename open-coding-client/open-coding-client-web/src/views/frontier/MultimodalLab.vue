<script setup lang="ts">
/**
 * 多模态实验室（U-02）：设计稿→代码 / 截图→修复 / 视频理解 三能力卡 + 差异报告示例 + vision 能力门控。
 * 溯源：卷 25 §8 多模态协作（B2 双向多模态）；BUILD-MANIFEST U-02。
 * 契约：未配置 vision 能力时入口显式隐藏并给出原因（不静默降级）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { frontierData } from '@/mock/data/automation';
import type { MultimodalTask } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const visionReady = ref(true);
const tasks = frontierData.multimodalTasks;

/** 三张能力卡：输入类型 / 输出物 / 成功判据（结构正确率 ≥80%）/ 当前状态 */
const CARDS: { kind: MultimodalTask['kind']; input: string; output: string; criteria: string }[] = [
  { kind: '设计稿→代码', input: '设计稿（Figma 导出，含组件与 token）', output: '前端组件 + 样式 token + 差异报告', criteria: '结构正确率 ≥ 80% 且视觉差异连续 2 轮下降' },
  { kind: '截图→修复', input: '缺陷截图（含视口尺寸）', output: '样式修复 diff（最小改动）+ 验证截图', criteria: '结构正确率 ≥ 80% 且修复后截图差异 ≤ 阈值' },
  { kind: '视频理解', input: '录屏（复现步骤 / 演示）', output: '缺陷复现要点 + 触发条件清单', criteria: '要点召回 ≥ 80%（人工抽检 10 条）' },
];
function taskOf(kind: MultimodalTask['kind']): MultimodalTask | undefined {
  return tasks.find((t) => t.kind === kind);
}
function statusTheme(t?: MultimodalTask): 'success' | 'danger' | 'warning' | 'default' {
  if (!t) return 'default';
  return t.status === 'SUCCEEDED' ? 'success' : t.status === 'FAILED' ? 'danger' : 'warning';
}

/** 差异报告示例：设计稿 vs 渲染截图，逐项差异 + 可复现说明（负样本为 FAILED 任务） */
const DIFF_ITEMS = [
  { id: 'd1', target: 'OrderCard 圆角', design: '8px', rendered: '8px', pass: true, repro: '同 viewport 1280×800 截图比对，diff=0.4%' },
  { id: 'd2', target: '主按钮间距', design: '16px', rendered: '12px', pass: false, repro: '像素差异 3.2%（阈值 5% 内但方向偏差，需人工确认）' },
  { id: 'd3', target: '暗色变体缺失', design: '6 组件含暗色', rendered: '仅 4 组件', pass: false, repro: '任务 mm-02 FAILED：暗色 token 未生成 → 差异率 8.7% 超阈值' },
];
const failedCount = computed(() => tasks.filter((t) => t.status === 'FAILED').length);
const avgAcc = computed(() => tasks.reduce((a, t) => a + t.structureAccuracy, 0) / tasks.length * 100);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function toggleVision(v: unknown) {
  visionReady.value = v === true;
  MessagePlugin.info(visionReady.value ? 'vision 能力已配置：三张能力卡恢复可见' : 'vision 能力未配置：多模态入口已显式隐藏（原因：provider 未声明 vision 模态），不静默降级');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = tasks.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="多模态实验室"
      desc="设计稿→代码 / 截图→修复 / 视频理解：输入类型、输出物与成功判据统一登记，视觉差异可量化并收敛。"
      volume="卷 25" manifest="U-02" cli="oc frontier multimodal run --kind 设计稿→代码" experimental
      :status="[{ label: `结构正确率 ${avgAcc.toFixed(0)}%`, theme: avgAcc >= 80 ? 'success' : 'warning' }, { label: visionReady ? 'vision 已配置' : 'vision 未配置', theme: visionReady ? 'success' : 'danger' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <div class="oc-flex" style="gap: 6px">
          <span style="font-size: 12px">vision 能力</span>
          <Switch :value="visionReady" size="small" aria-label="切换 vision 能力配置" @change="toggleVision" />
        </div>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在加载多模态任务与差异报告…"
      empty-title="还没有多模态任务" empty-desc="先在会话中接入设计稿 / 截图 / 录屏，任务完成后差异报告在此汇总。"
      empty-action="返回看板" example-task="查看 mm-02 的 FAILED 差异报告与 8.7% 像素差异说明"
      what="多模态任务加载失败" why="视觉对比验证器不可达（差异率需与渲染截图联查）"
      how="重试；未配置 vision 能力时本页入口会显式隐藏并给出原因，而非静默返回空列表"
      :collapsed-summary="`任务 ${tasks.length} 条（含 ${failedCount} 条失败），列表已折叠展示（边界数据态）。`" :page-size="tasks.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <div v-if="!visionReady" class="oc-card" style="border-color: var(--td-error-color)">
        <div class="oc-card__title">能力门控：多模态入口已隐藏</div>
        <div class="oc-muted" style="font-size: 13px">
          原因：当前 provider 未声明 vision 模态，多模态协作入口显式隐藏并停止派发（不静默降级为纯文本处理）。
          动作：在「模型与提示词 → Provider」配置支持图像/视频的模型后，本页能力自动恢复。
        </div>
        <Button size="small" theme="primary" variant="outline" style="margin-top: 8px" @click="toggleVision(true)">模拟配置完成</Button>
      </div>

      <template v-else>
        <div class="oc-grid oc-grid--3">
          <div v-for="c in CARDS" :key="c.kind" class="oc-card">
            <div class="oc-card__title">
              {{ c.kind }}
              <Tag size="small" :theme="statusTheme(taskOf(c.kind))" variant="light-outline">{{ taskOf(c.kind)?.status ?? '未运行' }}</Tag>
            </div>
            <InfoGrid :columns="1" :items="[
              { key: 'input', label: '输入类型', value: c.input },
              { key: 'output', label: '输出物', value: c.output },
              { key: 'criteria', label: '成功判据', value: c.criteria },
              { key: 'current', label: '当前状态', value: taskOf(c.kind) ? `${taskOf(c.kind)?.output}（结构正确率 ${((taskOf(c.kind)?.structureAccuracy ?? 0) * 100).toFixed(0)}%）` : '未运行' },
            ]" />
          </div>
        </div>

        <div class="oc-card" style="margin-top: 12px">
          <div class="oc-card__title">差异报告示例（设计稿 vs 渲染截图）<CliHint command="oc frontier multimodal diff --task mm-02" /></div>
          <Table :data="DIFF_ITEMS" row-key="id" size="small" :pagination="undefined" :columns="[
            { colKey: 'target', title: '差异项', width: 160 },
            { colKey: 'design', title: '设计稿值', width: 130 },
            { colKey: 'rendered', title: '渲染截图值', width: 150 },
            { colKey: 'pass', title: '结论', width: 100, cell: 'pass' },
            { colKey: 'repro', title: '可复现说明', ellipsis: true },
          ]">
            <template #pass="{ row }">
              <Tag size="small" :theme="row.pass ? 'success' : 'danger'" variant="light-outline">{{ row.pass ? '一致' : '差异' }}</Tag>
            </template>
          </Table>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <Tag size="small" theme="danger" variant="light-outline">差异 ≠ 失败：超阈值（像素差异率 &gt; 5%）才阻断</Tag>
            <Tag size="small" variant="outline">差异报告可复现：viewport、截图哈希、对比脚本版本随报告保存</Tag>
            <CopyableId id="trace-frontier-mm-31aa" label="多模态 traceId" short="12" />
          </div>
        </div>

        <div class="oc-grid oc-grid--4" style="margin-top: 12px">
          <StatCard label="任务总数" :value="tasks.length" unit="条" icon="image" />
          <StatCard label="失败任务" :value="failedCount" unit="条" icon="error" :lower-is-better="true" hint="失败保留差异报告，用于迭代收敛" />
          <StatCard label="平均结构正确率" :value="avgAcc" format="percent" icon="chart" :target="80" :lower-is-better="false" hint="成功判据 ≥ 80%" />
          <StatCard label="图示生成（附）" :value="taskOf('图示生成')?.status ?? '—'" format="raw" icon="sitemap" hint="与视觉对比共用同一收敛流程" />
        </div>
      </template>
    </StateShell>
  </div>
</template>
