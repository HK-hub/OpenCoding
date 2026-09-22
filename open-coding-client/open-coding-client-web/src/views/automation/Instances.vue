<script setup lang="ts">
/**
 * 模板实例列表（N2-06）：定义版本冻结 + 参数 + 目标 + 授权快照 + 预算信封。
 * 操作：暂停 / 恢复 / 升级（重新兼容检查 + 快照刷新）/ 复制。
 * 溯源：卷 34 §5.2/§5.3；BUILD-MANIFEST N2-06。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData } from '@/mock/data/automation';
import type { InstanceState, TemplateInstance } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

const instances = ref<TemplateInstance[]>(automationData.instances.map((i) => ({ ...i })));
const selected = ref<TemplateInstance>(instances.value[0]);
const stateFilter = ref<'全部' | InstanceState>('全部');

const rows = computed(() => (stateFilter.value === '全部' ? instances.value : instances.value.filter((i) => i.state === stateFilter.value)));
const enabledCount = computed(() => instances.value.filter((i) => i.state === 'ENABLED').length);

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

function onStateFilter(v: unknown) {
  stateFilter.value = String(v) as '全部' | InstanceState;
}

const columns = [
  { colKey: 'templateName', title: '模板（定义版本冻结）', width: 250, cell: 'tpl' },
  { colKey: 'state', title: '实例状态', width: 120, cell: 'state' },
  { colKey: 'targetBinding', title: '目标绑定', width: 220, cell: 'target' },
  { colKey: 'budgetEnvelope', title: '预算信封使用', width: 200, cell: 'budget' },
  { colKey: 'successRatio', title: '成功率', width: 100, cell: 'ratio' },
  { colKey: 'lastRunAt', title: '最近运行', width: 150, cell: 'at' },
  { colKey: 'op', title: '操作', width: 220, cell: 'op' },
];

const STATE_THEME: Record<InstanceState, 'success' | 'default' | 'warning'> = { ENABLED: 'success', DISABLED: 'default', PAUSED: 'warning' };

function onRowClick(ctx: { row: unknown }) {
  selected.value = ctx.row as TemplateInstance;
}

function togglePause(row: TemplateInstance) {
  row.state = row.state === 'PAUSED' ? 'ENABLED' : 'PAUSED';
  MessagePlugin.success(row.state === 'PAUSED' ? `已暂停：${row.templateName}（运行中实例等待安全点退出）` : `已恢复：${row.templateName}`);
}

function upgrade(row: TemplateInstance) {
  row.definitionVersion = row.latestVersion;
  MessagePlugin.success(`已升级到 v${row.latestVersion}：完成兼容检查并刷新授权快照（旧快照留档）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="模板实例"
      desc="实例 = 定义版本 + 参数绑定 + 目标绑定 + 授权快照 + 预算信封的冻结体；升级须重新兼容检查并刷新快照。"
      volume="卷 34" manifest="N2-06" cli="oc automation instance list --state enabled"
      :status="[{ label: `${instances.length} 个实例`, theme: 'default' }, { label: `${enabledCount} 个启用中`, theme: 'success' }, { label: '同实例串行', theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="stateFilter" size="small" style="width: 130px" aria-label="按状态筛选" :options="[{ value: '全部', label: '全部状态' }, { value: 'ENABLED', label: 'ENABLED' }, { value: 'PAUSED', label: 'PAUSED' }, { value: 'DISABLED', label: 'DISABLED' }]" @change="onStateFilter" />
        <Button size="small" theme="primary" @click="router.push('/automation/install')">新建实例</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在载入实例与授权快照摘要…"
      empty-title="没有实例" empty-desc="当前筛选下没有模板实例；从模板市场安装一个模板即可创建实例。"
      empty-action="去模板市场" example-task="安装「PR 巡检」并绑定 payment-core 的 PR 事件"
      what="实例列表加载失败" why="实例存储不可达（授权快照需与基线版本比对，暂不可离线创建）"
      how="重试；已启用实例的最近运行仍可在运行历史中查看" trace-id="trace-2a71f908"
      :collapsed-summary="`实例较多（${rows.length} 个），已折叠展示（边界数据态）。`" :page-size="rows.length"
      @retry="demo = 'NORMAL'" @empty-action="stateFilter = '全部'" @load-more="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined" @row-click="onRowClick">
        <template #tpl="{ row }">
          <div class="oc-stack" style="gap: 0">
            <span>{{ row.templateName }}</span>
            <span class="oc-muted" style="font-size: 11px">冻结 v{{ row.definitionVersion }}<template v-if="row.definitionVersion !== row.latestVersion">（可升级到 v{{ row.latestVersion }}）</template> · {{ row.id }}</span>
          </div>
        </template>
        <template #state="{ row }">
          <Tag size="small" :theme="STATE_THEME[row.state as InstanceState]" variant="light-outline">{{ row.state }}</Tag>
        </template>
        <template #target="{ row }">
          <div class="oc-stack" style="gap: 0">
            <span class="oc-mono" style="font-size: 11px">{{ row.targetBinding.ref }}</span>
            <span class="oc-muted" style="font-size: 11px">{{ row.targetBinding.kind }}</span>
          </div>
        </template>
        <template #budget="{ row }">
          <div class="oc-stack" style="gap: 0; font-size: 12px">
            <span>${{ row.budgetEnvelope.usedCostUsd.toFixed(2) }} / ${{ row.budgetEnvelope.costUsd.toFixed(2) }}</span>
            <span class="oc-muted" style="font-size: 11px">调用 {{ row.budgetEnvelope.usedToolCalls }} / {{ row.budgetEnvelope.toolCalls }} · 扇出上限 {{ row.budgetEnvelope.fanout }}</span>
          </div>
        </template>
        <template #ratio="{ row }">
          <span :style="{ color: row.successRatio < 0.8 ? 'var(--oc-sev-warn)' : undefined }">{{ (row.successRatio * 100).toFixed(0) }}%</span>
        </template>
        <template #at="{ row }"><span style="font-size: 12px">{{ new Date(row.lastRunAt).toLocaleString('zh-CN') }}</span></template>
        <template #op="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Button size="small" variant="text" @click.stop="togglePause(row)">{{ row.state === 'PAUSED' ? '恢复' : '暂停' }}</Button>
            <Popconfirm content="升级到最新定义版本会重新做兼容检查并刷新授权快照；运行中实例的旧运行不受影响。是否升级？" @confirm="upgrade(row)">
              <Button size="small" variant="text" :disabled="row.definitionVersion === row.latestVersion">升级</Button>
            </Popconfirm>
            <Button size="small" variant="text" @click.stop="router.push('/automation/runs')">运行</Button>
          </div>
        </template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">参数绑定（inputsDigest 参与幂等）<CliHint :command="`oc automation instance show ${selected.id}`" /></div>
          <div class="oc-kv">
            <template v-for="b in selected.inputsBinding" :key="b.name">
              <span class="oc-kv__k">{{ b.name }}</span>
              <span><span class="oc-mono">{{ b.value }}</span> <Tag size="small" variant="outline" style="margin-left: 6px">来源 {{ b.source }}</Tag></span>
            </template>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">展示类参数（语言、汇报格式）不参与 inputsDigest，避免仅改格式绕过去重。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">授权快照（强制审计项，不可关闭）</div>
          <InfoGrid :columns="1" :items="[
            { key: 'by', label: '授予人', value: selected.authorizationSnapshot.grantedBy },
            { key: 'at', label: '授予时间', value: new Date(selected.authorizationSnapshot.at).toLocaleString('zh-CN') },
            { key: 'ceil', label: '上限', value: selected.authorizationSnapshot.ceiling, tag: { text: '不可提升', theme: 'warning' } },
            { key: 'base', label: '企业基线版本', value: selected.authorizationSnapshot.baselineVersion },
            { key: 'acts', label: '动作清单', value: selected.authorizationSnapshot.actions.join('、'), block: true },
          ]" />
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <Tag size="small" variant="outline">实例所有者：{{ selected.owner }}</Tag>
            <Switch :value="selected.state === 'ENABLED'" size="small" @change="() => togglePause(selected)" />
            <span style="font-size: 12px">启用 / 暂停</span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
