<script setup lang="ts">
/**
 * 变更门禁矩阵（Y-01）：14 类变更 × 必过检查项矩阵（必过 / 未要求）+ CI 当前状态列；
 * 门禁未过即阻断合并/发布（不允许手工跳过，豁免需双人审批并留痕）；发布前置门禁全绿指示灯。
 * 溯源：卷 26 / BUILD-MANIFEST Y-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { downloadJson } from '@/utils/download';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 必过检查项（7 项）：变更类型决定哪些项为「必过」，其余显示「未要求」 */
const CHECKS = [
  { key: 'unit', short: '单测/集成' },
  { key: 'contract', short: '契约' },
  { key: 'eval', short: '评测回归' },
  { key: 'redteam', short: '红队增量' },
  { key: 'perf', short: '性能基准' },
  { key: 'migrate', short: '迁移演练' },
  { key: 'security', short: '安全扫描' },
];

interface ChangeRow {
  key: string; name: string; checks: Record<string, boolean>; ciState: '绿' | '红' | '进行中'; ref: string; blockReason: string; owner: string;
}

const CHANGES: ChangeRow[] = [
  { key: 'prompt', name: '提示词资产', checks: { unit: false, contract: false, eval: true, redteam: true, perf: false, migrate: false, security: false }, ciState: '绿', ref: 'PR-3182', blockReason: '', owner: '提示词组' },
  { key: 'model', name: '模型·路由', checks: { unit: true, contract: true, eval: true, redteam: false, perf: true, migrate: false, security: false }, ciState: '红', ref: 'PR-3188', blockReason: '评测回归未过：R-2321 总分 ↓3.2%、成功率 ↓3.0pp（双阈值触发）', owner: '模型平台组' },
  { key: 'tool', name: '工具（新增·修改）', checks: { unit: true, contract: true, eval: true, redteam: true, perf: true, migrate: false, security: true }, ciState: '进行中', ref: 'PR-3190', blockReason: '性能基准执行中（工具调用 P95，阶段 2/4）', owner: '工具组' },
  { key: 'permission', name: '权限策略·默认值', checks: { unit: true, contract: true, eval: true, redteam: true, perf: false, migrate: false, security: true }, ciState: '绿', ref: 'PR-3175', blockReason: '', owner: '安全组' },
  { key: 'sandbox', name: '沙箱·隔离', checks: { unit: true, contract: false, eval: true, redteam: true, perf: true, migrate: false, security: true }, ciState: '绿', ref: 'PR-3179', blockReason: '', owner: '安全组' },
  { key: 'event', name: '事件 Schema', checks: { unit: true, contract: true, eval: true, redteam: false, perf: true, migrate: false, security: false }, ciState: '绿', ref: 'PR-3181', blockReason: '', owner: '平台工程组' },
  { key: 'kernel', name: '内核（循环·上下文·恢复）', checks: { unit: true, contract: true, eval: true, redteam: true, perf: true, migrate: false, security: true }, ciState: '绿', ref: 'PR-3186', blockReason: '', owner: '内核组' },
  { key: 'plugin', name: '插件·扩展点', checks: { unit: true, contract: true, eval: true, redteam: true, perf: false, migrate: false, security: true }, ciState: '绿', ref: 'PR-3177', blockReason: '', owner: '生态组' },
  { key: 'migration', name: '数据库迁移', checks: { unit: true, contract: false, eval: true, redteam: false, perf: false, migrate: true, security: false }, ciState: '绿', ref: 'PR-3172', blockReason: '', owner: '数据组' },
  { key: 'frontend', name: '前端', checks: { unit: true, contract: false, eval: true, redteam: false, perf: false, migrate: false, security: false }, ciState: '绿', ref: 'PR-3191', blockReason: '', owner: '前端组' },
  { key: 'cost', name: '成本基线', checks: { unit: true, contract: false, eval: true, redteam: false, perf: true, migrate: false, security: false }, ciState: '红', ref: 'PR-3193', blockReason: '性能基准未过：平均任务成本 $0.0842 > 基线 $0.0800（超支 5.3%）→ 阻断发布', owner: '成本治理组' },
  { key: 'license', name: '更新·许可', checks: { unit: true, contract: true, eval: false, redteam: false, perf: false, migrate: true, security: true }, ciState: '绿', ref: 'PR-3168', blockReason: '', owner: '分发组' },
  { key: 'template', name: '自动化模板', checks: { unit: true, contract: false, eval: true, redteam: true, perf: false, migrate: false, security: true }, ciState: '绿', ref: 'PR-3184', blockReason: '', owner: '自动化组' },
  { key: 'intel', name: '智能增强', checks: { unit: true, contract: true, eval: true, redteam: true, perf: true, migrate: false, security: true }, ciState: '绿', ref: 'PR-3189', blockReason: '', owner: '智能增强组' },
];

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const selectedKey = ref('model');
const pageSize = ref(10);
const err = ref(makeError('CONFLICT', '门禁状态与 CI 事实源不一致（webhook 丢失 2 条，矩阵拒绝展示陈旧结论）'));

const columns = [
  { colKey: 'name', title: '变更类型', width: 200 },
  ...CHECKS.map((c) => ({ colKey: c.key, title: c.short, width: 84 })),
  { colKey: 'ciState', title: 'CI 当前状态', width: 120 },
  { colKey: 'ops', title: '操作', width: 90 },
];

const shown = computed(() => CHANGES.slice(0, pageSize.value));
const selected = computed(() => CHANGES.find((c) => c.key === selectedKey.value) ?? CHANGES[0]);
const reds = computed(() => CHANGES.filter((c) => c.ciState === '红'));
const running = computed(() => CHANGES.filter((c) => c.ciState === '进行中'));
const allGreen = computed(() => CHANGES.every((c) => c.ciState === '绿'));
const requiredChecks = computed(() => CHECKS.filter((c) => selected.value.checks[c.key]).map((c) => c.short));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = CHANGES.length > pageSize.value ? 'EDGE_DATA' : CHANGES.length ? 'NORMAL' : 'EMPTY'; }, 240);
}

function exportMatrix() {
  const file = downloadJson({ checks: CHECKS, changes: CHANGES, publishReady: allGreen.value }, `oc-gate-matrix-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`门禁矩阵已导出：${file}`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader title="变更门禁矩阵" desc="14 类变更各自声明必过检查项：改为「未要求」即视为放宽门禁，必须走策略评审；任一必过项未过则阻断合并或发布。" volume="卷 26" manifest="Y-01" cli="oc quality gates matrix --check-ci && oc quality gates explain PR-3188" :status="[{ label: allGreen ? '发布前置门禁：全绿' : `发布前置门禁：阻断（${reds.length} 类未过）`, theme: allGreen ? 'success' : 'danger' }, { label: `进行中 ${running.length} 类`, theme: running.length ? 'warning' : 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="exportMatrix">导出门禁矩阵</Button>
        <Popconfirm theme="warning" content="申请豁免需两名评审人批准，仅对指定 PR 的单次合并有效，并写入审计；阻断中的发布不受影响。" @confirm="MessagePlugin.warning(`豁免申请已提交：${selected.name}（PR ${selected.ref}）需 2 名评审人批准，未批准前仍阻断`)">
          <Button size="small" theme="primary">申请门禁豁免</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="变更类型" :value="CHANGES.length" format="number" icon="layers" hint="14 类与门禁表一一对应" />
      <StatCard label="CI 未过（红）" :value="reds.length" format="number" icon="error" :lower-is-better="true" hint="模型·路由、成本基线：阻断中" />
      <StatCard label="执行中" :value="running.length" format="number" icon="loading" hint="工具类变更：性能基准执行中（阶段 2/4）" />
      <StatCard label="必过项（合计）" :value="CHANGES.reduce((a, c) => a + Object.values(c.checks).filter(Boolean).length, 0)" format="number" icon="check" hint="矩阵中「必过」格总数（14 类 × 7 项）" />
    </div>

    <div class="oc-card" style="margin-top: 12px">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <span aria-hidden="true" :style="{ width: '12px', height: '12px', borderRadius: '50%', display: 'inline-block', background: allGreen ? 'var(--td-success-color)' : 'var(--td-error-color)' }" />
        <b>{{ allGreen ? '发布前置门禁全绿：可进入发布流程' : '发布前置门禁未全绿：发布被阻断' }}</b>
        <Tag v-for="c in reds" :key="c.key" size="small" theme="danger" variant="light-outline">{{ c.name }}：{{ c.blockReason }}</Tag>
      </div>
      <div class="oc-muted" style="font-size: 12px; margin-top: 4px">发布前置条件 = 14 类变更全部为绿 + 红队通过率 ≥95% + J1–J12 旅程全绿；任一不满足即阻断发布（不允许跳过，不允许「先发布后补」）。</div>
    </div>

    <StateShell :state="state" empty-title="门禁矩阵为空" empty-desc="未读取到变更类型定义（策略仓库可能未初始化）。门禁缺失时默认全阻断，而不是默认放行。" empty-action="重新拉取策略仓库" example-task="解释 PR-3188 为什么被阻断，并给出解除路径" :what="'门禁矩阵加载失败'" :why="err.message" how="可重试；矩阵不可用期间 CI 按「最严默认」处理（不依赖本页结论放行）。" :trace-id="err.traceId" :collapsed-summary="`共 ${CHANGES.length} 类变更，已折叠展示前 ${pageSize} 类`" :page-size="pageSize" @retry="refresh" @load-more="pageSize = CHANGES.length" @empty-action="refresh">
      <div class="oc-card">
        <div class="oc-card__title">14 类变更 × 必过检查项（✓ 必过 / — 未要求）</div>
        <Table row-key="key" size="small" :data="shown" :columns="columns" @row-click="(ctx: { row: unknown }) => (selectedKey = (ctx.row as ChangeRow).key)">
          <template #name="{ row }"><b style="font-size: 12px">{{ row.name }}</b><div class="oc-muted oc-mono" style="font-size: 11px">{{ row.ref }} · {{ row.owner }}</div></template>
          <template #unit="{ row }"><span class="oc-mono">{{ row.checks.unit ? '✓' : '—' }}</span></template>
          <template #contract="{ row }"><span class="oc-mono">{{ row.checks.contract ? '✓' : '—' }}</span></template>
          <template #eval="{ row }"><span class="oc-mono">{{ row.checks.eval ? '✓' : '—' }}</span></template>
          <template #redteam="{ row }"><span class="oc-mono">{{ row.checks.redteam ? '✓' : '—' }}</span></template>
          <template #perf="{ row }"><span class="oc-mono">{{ row.checks.perf ? '✓' : '—' }}</span></template>
          <template #migrate="{ row }"><span class="oc-mono">{{ row.checks.migrate ? '✓' : '—' }}</span></template>
          <template #security="{ row }"><span class="oc-mono">{{ row.checks.security ? '✓' : '—' }}</span></template>
          <template #ciState="{ row }"><Tag size="small" variant="light-outline" :theme="row.ciState === '绿' ? 'success' : row.ciState === '红' ? 'danger' : 'warning'">{{ row.ciState }}</Tag></template>
          <template #ops="{ row }"><Tooltip :content="row.blockReason || '当前无阻断项'"><Button size="small" variant="text" @click.stop="selectedKey = row.key">解释</Button></Tooltip></template>
        </Table>
        <CliHint command="oc quality gates matrix --json --only-required" label="仅导出必过项" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">选中变更解释 · {{ selected.name }}（{{ selected.ref }}）</div>
        <InfoGrid :columns="2" :items="[
          { key: 'required', label: '必过检查项', value: requiredChecks.join('、') || '（无：该类型无强制项，但仍需构建通过）' }, { key: 'owner', label: '责任组', value: selected.owner },
          { key: 'ci', label: 'CI 当前状态', value: selected.ciState, tag: { text: selected.ciState, theme: selected.ciState === '绿' ? 'success' : selected.ciState === '红' ? 'danger' : 'warning' } }, { key: 'block', label: '阻断原因', value: selected.blockReason || '无阻断' },
          { key: 'release', label: '发布影响', value: selected.ciState === '绿' ? '不阻塞发布' : '该变更处于阻断态：禁止合并/发布，修复后重跑全部必过项' }, { key: 'exempt', label: '豁免路径', value: '仅限非安全类且影响可回滚；需 2 名评审人 + 记录到期时间，过期自动重新阻断' },
        ]" />
        <div class="oc-flex" style="margin-top: 8px; gap: 6px">
          <CopyableId :id="`gate-${selected.ref}-trace`" label="复制门禁判定 traceId" />
          <span class="oc-muted" style="font-size: 12px">阻断文案含「事实 + 原因 + 路径」，禁止只显示红叉。</span>
        </div>
      </div>
    </StateShell>
  </div>
</template>
