<script setup lang="ts">
/**
 * 计算机使用实验室（U-03）：GUI / 浏览器操作能力 + 执行强度 FULL/PARTIAL 上报 + 越界零容忍 + 沙箱档要求。
 * 溯源：卷 25 §8 计算机使用；BUILD-MANIFEST U-03。
 * 契约：最小权限 + 沙箱（L2/L3）；任何越界立即终止并记安全事件；PARTIAL 必须显式上报原因（不静默）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import { frontierData } from '@/mock/data/automation';
import type { ComputerUseRun } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const runs = frontierData.computerUseRuns;
const TARGET_PASS = 70;

/** 操作序列示例：每步带执行强度徽标（FULL 完整执行 / PARTIAL 部分执行 + 降级原因） */
const STEPS: { no: number; action: string; target: string; intensity: 'FULL' | 'PARTIAL'; reason?: string; result: string; pass: boolean }[] = [
  { no: 1, action: '打开页面', target: 'https://app.local/signup', intensity: 'FULL', result: '页面加载完成（1.2s）', pass: true },
  { no: 2, action: '输入文本', target: '账号输入框（元素定位）', intensity: 'FULL', result: '已输入（未记录内容）', pass: true },
  { no: 3, action: '点击', target: '「下一步」按钮', intensity: 'FULL', result: '进入下单页', pass: true },
  { no: 4, action: '拖拽', target: '文件上传区', intensity: 'PARTIAL', reason: '沙箱缺少桌面合成器 → 改用路径输入等价步骤，并逐次上报', result: '文件已附加（等价路径）', pass: true },
  { no: 5, action: '选择下拉', target: '支付方式', intensity: 'FULL', result: '已选择「余额」', pass: true },
  { no: 6, action: '截图断言', target: '确认页视觉校验', intensity: 'FULL', result: '断言通过（差异 0.6%）', pass: true },
  { no: 7, action: '提交订单', target: '「确认支付」按钮', intensity: 'FULL', result: '订单创建成功', pass: true },
  { no: 8, action: '边界探测', target: '尝试访问宿主目录', intensity: 'PARTIAL', reason: '越界请求被沙箱拦截 → 立即终止本次运行并记安全事件', result: '已终止 + 事件已上报', pass: false },
];
const fullSteps = STEPS.filter((s) => s.intensity === 'FULL').length;
const partialSteps = STEPS.filter((s) => s.intensity === 'PARTIAL').length;
const passRate = computed(() => (runs.filter((r) => r.result === 'SUCCEEDED').length / runs.length) * 100);

const INTENSITY_THEME: Record<'FULL' | 'PARTIAL', 'success' | 'warning'> = { FULL: 'success', PARTIAL: 'warning' };

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function reportViolation() {
  MessagePlugin.warning('越界零容忍：检测到越界（宿主目录访问）→ 立即终止运行、冻结该实验开关，并生成安全事件交人工处置。');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = runs.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="计算机使用实验室"
      desc="沙箱内 GUI / 浏览器操作：每步上报执行强度，通过率目标 ≥ 70%，越界零容忍（一次即停用）。"
      volume="卷 25" manifest="U-03" cli="oc frontier computer-use runs --with-intensity" experimental
      :status="[{ label: `通过率 ${passRate.toFixed(0)}% / 目标 ≥ ${TARGET_PASS}%`, theme: passRate >= TARGET_PASS ? 'success' : 'warning' }, { label: '越界零容忍', theme: 'danger' }, { label: '沙箱 L2/L3', theme: 'primary' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="reportViolation">演示越界处置</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在汇总 GUI 运行记录与强度上报…"
      empty-title="还没有 GUI 运行记录" empty-desc="计算机使用仅在沙箱（L2/L3）内执行；未启用时入口隐藏并给出原因。"
      empty-action="返回看板" example-task="查看 cu-03 的 PARTIAL 上报原因（桌面合成器缺失）"
      what="运行记录加载失败" why="沙箱运行账本不可达（轨迹与截图序列保存在制品库）"
      how="重试；越界事件仍会单独上报安全通道，不受本页影响"
      :collapsed-summary="`运行 ${runs.length} 次（含 1 次失败 / 2 次 PARTIAL 上报），列表已折叠展示（边界数据态）。`" :page-size="runs.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="端到端通过率" :value="passRate" format="percent" icon="check" :target="TARGET_PASS" :lower-is-better="false" hint="10 个典型 Web 流程口径" />
        <StatCard label="运行次数" :value="runs.length" unit="次" icon="platform" hint="每次运行保存轨迹与截图序列" />
        <StatCard label="PARTIAL 上报" :value="runs.filter((r) => r.intensity === 'PARTIAL').length" unit="次" icon="flag" :lower-is-better="true" hint="部分执行必须显式上报降级原因（不静默）" />
        <StatCard label="越界操作" :value="runs.reduce((a, r) => a + r.boundaryViolations, 0)" unit="次" icon="secured" :lower-is-better="true" hint="目标恒为 0；出现 1 次即停用" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin: 12px 0">
        <div class="oc-card">
          <div class="oc-card__title">能力与约束<CliHint command="oc frontier computer-use explain" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'cap', label: '能力说明', value: '沙箱内操作浏览器与桌面应用：元素定位优先、坐标为兜底；验证用途优先，不做用户桌面操作' },
            { key: 'intensity', label: '执行强度', value: 'FULL 完整执行 / PARTIAL 部分执行（每步带徽标，降级原因随步骤上报）' },
            { key: 'boundary', label: '越界零容忍', value: '任何越界（宿主目录、未授权域名、凭据读取）→ 立即终止 + 生成安全事件 + 冻结开关' },
            { key: 'sandbox', label: '沙箱档要求', value: 'L2（受限网络 + 临时文件系统）或 L3（无网络 + 白名单挂载）；低于 L2 不允许运行' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <RiskBadge level="R3" show-desc />
            <Tag size="small" theme="danger" variant="light-outline">越界 = 立即终止 + 安全事件</Tag>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">运行记录</div>
          <Table :data="runs" row-key="id" size="small" :pagination="undefined" :columns="[
            { colKey: 'scenario', title: '场景', ellipsis: true },
            { colKey: 'runtime', title: '运行环境', width: 150 },
            { colKey: 'intensity', title: '强度', width: 96, cell: 'intensity' },
            { colKey: 'steps', title: '步数', width: 70 },
            { colKey: 'result', title: '结果', width: 100, cell: 'result' },
          ]">
            <template #intensity="{ row }">
              <Tag size="small" :theme="INTENSITY_THEME[row.intensity as 'FULL' | 'PARTIAL']" variant="light-outline">
                {{ row.intensity }}{{ row.intensity === 'PARTIAL' ? '（已上报原因）' : '' }}
              </Tag>
            </template>
            <template #result="{ row }">
              <Tag size="small" :theme="row.result === 'SUCCEEDED' ? 'success' : 'danger'" variant="light-outline">{{ row.result }}</Tag>
            </template>
          </Table>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">操作序列示例（每步带执行强度徽标）</div>
        <Table :data="STEPS" row-key="no" size="small" :pagination="undefined" :columns="[
          { colKey: 'no', title: '步骤', width: 70 },
          { colKey: 'action', title: '动作', width: 110 },
          { colKey: 'target', title: '目标', width: 200 },
          { colKey: 'intensity', title: '强度', width: 150, cell: 'intensity' },
          { colKey: 'result', title: '结果', cell: 'result' },
        ]">
          <template #intensity="{ row }">
            <Tag size="small" :theme="INTENSITY_THEME[row.intensity as 'FULL' | 'PARTIAL']" variant="light-outline">{{ row.intensity }}</Tag>
            <span v-if="row.reason" class="oc-muted" style="font-size: 11px; margin-left: 6px">{{ row.reason }}</span>
          </template>
          <template #result="{ row }">
            <span :style="{ color: row.pass ? undefined : 'var(--td-error-color)' }">{{ row.result }}</span>
          </template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <Tag size="small" variant="outline">FULL {{ fullSteps }} 步 / PARTIAL {{ partialSteps }} 步</Tag>
          <Tag size="small" theme="danger" variant="light-outline">第 8 步越界 → 终止 + 安全事件（零容忍）</Tag>
          <CopyableId id="trace-frontier-cu-5f18" label="计算机使用 traceId" short="12" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
