<script setup lang="ts">
/** 沙箱计划预览（B-03）：目标档 / 实际档 / 降级原因 / 策略依据 / 不达标即拒绝。溯源：卷 07 §4.3 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { sandboxPlans } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const platformFilter = ref('');
const pageSize = ref(6);
const currentId = ref(sandboxPlans[0]?.planId ?? '');
const strictOpen = ref(false);
const err = ref(makeError('SANDBOX_DENIED', '目标档低于策略下限，已拒绝执行（不降级）'));

const rows = computed(() => sandboxPlans.filter((p) => !platformFilter.value || p.platform === platformFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const current = computed(() => sandboxPlans.find((p) => p.planId === currentId.value) ?? sandboxPlans[0]);
const degradedCount = computed(() => sandboxPlans.filter((p) => p.degraded).length);

const columns = [
  { colKey: 'planId', title: '计划', width: 100 },
  { colKey: 'toolName', title: '工具', width: 140 },
  { colKey: 'riskClass', title: '风险', width: 96 },
  { colKey: 'tiers', title: '目标 → 实际', width: 170 },
  { colKey: 'degrade', title: '结果标注', width: 130 },
  { colKey: 'platform', title: '平台 / 工作区', width: 170 },
  { colKey: 'policyRefs', title: '策略依据', width: 200 },
  { colKey: 'degradeReason', title: '降级原因（显式）', ellipsis: true },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function pick(ctx: { row: Record<string, unknown> }) {
  currentId.value = String(ctx.row.planId);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="沙箱计划预览"
      desc="每次执行的选档结果：目标档（风险映射）与实际档（平台可达 + 策略钳制）的差异必须显式可见；下限不满足时拒绝执行而不是偷偷降级。"
      volume="卷 07"
      manifest="B-03"
      cli="oc sandbox plan show --call TC-8f21 --explain"
      :status="[{ label: `降级 ${degradedCount}`, theme: degradedCount ? 'warning' : 'success' }, { label: '降级留痕', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="strictOpen = true">强制不降级设置</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="计划总数" :value="sandboxPlans.length" format="raw" icon="task" />
      <StatCard label="已降级" :value="degradedCount" format="raw" icon="discount" hint="目标档不可达 → 取可达档 + 留痕" />
      <StatCard label="拒绝执行" :value="sandboxPlans.filter((p) => p.rejected).length" format="raw" icon="close" hint="低于策略下限一律拒绝（不降级）" />
      <StatCard label="降级率" :value="Number(((degradedCount / sandboxPlans.length) * 100).toFixed(1))" format="percent" icon="chart" :target="20" target-kind="max" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="platformFilter" size="small" clearable placeholder="平台" style="width: 150px" :options="['Linux', 'macOS', 'Windows'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc sandbox plan list --degraded --since 24h" label="仅看降级计划" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有沙箱计划"
      empty-desc="近期无执行请求（计划在权限放行后、执行前生成）。"
      empty-action="清空筛选"
      example-task="查看 R4 强制切换分支的计划与降级原因"
      :what="'目标档低于策略下限，已拒绝执行'"
      :why="err.message"
      how="替代路径：① 改用具备该档能力的远程节点（L3）；② 降低风险级（拆分为多条低风险命令）；③ 由管理员调整策略下限。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 条计划，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 6; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="platformFilter = ''; refresh()"
    >
      <Table row-key="planId" size="small" :data="shown" :columns="columns" :hover="true" @row-click="pick">
        <template #planId="{ row }"><span class="oc-mono">{{ row.planId }}</span></template>
        <template #riskClass="{ row }"><RiskBadge :level="row.riskClass" /></template>
        <template #tiers="{ row }">
          <span class="oc-mono">{{ row.targetTier }}</span>
          <span class="oc-muted"> → </span>
          <Tag size="small" variant="light-outline" :theme="row.rejected ? 'danger' : row.degraded ? 'warning' : 'success'">{{ row.actualTier }}</Tag>
        </template>
        <template #degrade="{ row }">
          <Tag v-if="row.rejected" size="small" theme="danger" variant="light-outline">拒绝执行</Tag>
          <Tooltip v-else-if="row.degraded" :content="row.degradeReason">
            <Tag size="small" theme="warning" variant="light-outline">已降级（原因）</Tag>
          </Tooltip>
          <Tag v-else size="small" theme="success" variant="light-outline">达标</Tag>
        </template>
        <template #platform="{ row }">{{ row.platform }} / {{ row.workspaceType }}</template>
        <template #policyRefs="{ row }">
          <Tag v-for="p in row.policyRefs" :key="p" size="small" variant="outline" theme="default" class="oc-mono" style="margin: 1px">{{ p }}</Tag>
        </template>
        <template #degradeReason="{ row }">
          <span v-if="row.degradeReason" class="oc-secondary" style="font-size: 12px">{{ row.degradeReason }}</span>
          <span v-else class="oc-muted" style="font-size: 12px">—</span>
        </template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          计划详情（{{ current.planId }}）
          <CopyableId :id="`sandbox://plan/${current.planId}`" label="复制计划引用" />
        </h3>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'tool', label: '工具 / 调用', value: `${current.toolName} · ${current.callId}`, span: 2, mono: true },
            { key: 'risk', label: '风险类', value: current.riskClass },
            { key: 'tiers', label: '目标档 → 实际档', value: `${current.targetTier} → ${current.actualTier}` },
            { key: 'degraded', label: '是否降级', value: current.degraded ? '是（已生成 sandbox.degraded 事件）' : '否' },
            { key: 'rejected', label: '是否拒绝', value: current.rejected ? '是（低于策略下限，不降级执行）' : '否' },
            { key: 'platform', label: '平台 / 工作区类型', value: `${current.platform} / ${current.workspaceType}` },
            { key: 'policies', label: '策略依据', value: current.policyRefs.join(' , '), mono: true },
            { key: 'reason', label: '降级原因', value: current.degradeReason ?? '不适用（档位达标）', span: 2 },
            { key: 'at', label: '生成时间', value: new Date(current.createdAt).toLocaleString('zh-CN') },
          ]"
        />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">选档依据（可解释）</h3>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 's1', label: '输入', value: '风险类 + 平台能力表 + 工作区类型 + 策略上下限（四元组）' },
            { key: 's2', label: '输出', value: '目标档（风险映射）与计划档（clamp 结果），差异即降级' },
            { key: 's3', label: '降级处置', value: '取可达档执行 + 生成 sandbox.degraded（含原因），界面以 Tag 显式提示' },
            { key: 's4', label: '下限处置', value: '可达档 < 下限 → 拒绝执行并返回替代路径（远程节点 / 拆分动作 / 调整策略）' },
          ]"
        />
      </div>
    </StateShell>

    <Dialog v-model:visible="strictOpen" header="强制不降级（企业档）" width="540px" :on-confirm="() => { strictOpen = false; MessagePlugin.success('已开启「不达标即拒绝执行」：后续计划将不再降级'); }">
      <div class="oc-stack">
        <p style="margin: 0; font-size: 13px">
          开启后：当平台可达档低于风险映射时，<b>直接拒绝执行</b>（不再取可达档），并生成拒绝事件与替代路径。
        </p>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：更安全但可用性下降（例如 Windows 未启用 WSL2 时无法执行 R2 构建）。
          可逆：可随时关闭；关闭后新计划恢复「降级 + 留痕」策略，历史拒绝记录不受影响。
        </p>
        <CliHint command="oc sandbox policy set --no-degrade true --reason '企业等保三级要求'" label="等价命令" />
      </div>
    </Dialog>
  </div>
</template>
