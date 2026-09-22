<script setup lang="ts">
/**
 * 实验数据隔离与清理（U-05）：命名空间清单 + 一键清理（确认词 + 不可恢复）+ 下线迁移 + 实验预算池。
 * 溯源：卷 25 §7 数据隔离与清理；BUILD-MANIFEST U-05。
 * 契约：实验数据独立命名空间且可整体清理；预算池独立不占团队配额；超预算自动降级或暂停，不静默超支。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import { frontierData } from '@/mock/data/automation';
import type { Experiment, IsolationItem } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const items = ref<IsolationItem[]>(frontierData.isolation.items.map((i) => ({ ...i })));
const experiments = computed(() => frontierData.experiments);
const cleanupOpen = ref(false);
const targetNs = ref(items.value[0]?.namespace ?? '');
const confirmWord = ref('');
const cleared = ref<string[]>([]);

const columns = [
  { colKey: 'experimentId', title: '实验', width: 130, cell: 'exp' },
  { colKey: 'namespace', title: '数据命名空间', width: 230, cell: 'ns' },
  { colKey: 'method', title: '清理方式', width: 200, cell: 'method' },
  { colKey: 'retainDays', title: '保留', width: 90, cell: 'retain' },
  { colKey: 'export', title: '导出范围', width: 160, cell: 'export' },
  { colKey: 'migration', title: '下线迁移说明', ellipsis: true },
];

function expOf(id: string): Experiment | undefined {
  return experiments.value.find((e) => e.id === id);
}
function openCleanup(ns?: string) {
  targetNs.value = ns ?? items.value[0]?.namespace ?? '';
  confirmWord.value = '';
  cleanupOpen.value = true;
}
function doCleanup() {
  // 不可恢复操作：确认词必须与命名空间完全一致，避免误清
  if (confirmWord.value.trim() !== targetNs.value) {
    MessagePlugin.error(`确认词不匹配：请输入完整命名空间「${targetNs.value}」以确认清理（不可恢复）。`);
    return;
  }
  cleared.value.push(targetNs.value);
  items.value = items.value.filter((i) => i.namespace !== targetNs.value);
  cleanupOpen.value = false;
  MessagePlugin.warning(`已清理命名空间 ${targetNs.value}：数据不可恢复；清理记录已写入审计。`);
}

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = items.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="实验数据隔离与清理"
      desc="实验数据进独立命名空间，可整体清理、可导出；下线实验给出归档路径与迁移建议；实验预算独立于团队配额。"
      volume="卷 25" manifest="U-05" cli="oc frontier isolation list --with-namespace" experimental
      :status="[{ label: `${items.length} 个命名空间`, theme: 'default' }, { label: '实验不得绕过权限/沙箱/审计', theme: 'danger' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 130px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" theme="danger" variant="outline" @click="openCleanup()">一键清理</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取实验命名空间清单…"
      empty-title="没有实验命名空间" empty-desc="当前没有活跃或归档中的实验数据；清理记录仍保留在审计中。"
      empty-action="返回看板" example-task="对 lab 阶段实验执行一键清理，并确认「不留副本」提示"
      what="命名空间清单加载失败" why="隔离存储元数据不可达（命名空间由实验登记数据派生）"
      how="重试；清理动作默认不可用（fail-closed），不会误删无法核对的命名空间"
      :collapsed-summary="`命名空间 ${items.length} 个（含归档 4 个），表格已折叠展示（边界数据态）。`" :page-size="items.length"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @load-more="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="命名空间" :value="items.length" unit="个" icon="database" hint="命名空间 = exp.{实验}.{租户}，可整体清理" />
        <StatCard label="不留副本（保留 0 天）" :value="items.filter((i) => i.cleanup.retainDays === 0).length" unit="个" icon="delete" :lower-is-better="true" hint="lab 阶段清理不可恢复，审计留痕" />
        <StatCard label="已清理" :value="cleared.length" unit="个" icon="check" :lower-is-better="false" hint="清理后命名空间立即从清单移除" />
        <StatCard label="实验预算池（独立）" :value="experiments.reduce((a, e) => a + e.budget.usd, 0)" format="cost" unit="USD" icon="discount" hint="不占团队配额；超预算自动降级或暂停" />
      </div>

      <Table :data="items" :columns="columns" row-key="namespace" size="small" :pagination="undefined" style="margin-top: 12px">
        <template #exp="{ row }">
          <span class="oc-mono" style="font-size: 12px">{{ row.experimentId }}</span>
          <Tag v-if="expOf(row.experimentId)" size="small" variant="outline" style="margin-left: 6px">{{ expOf(row.experimentId)?.level }}</Tag>
        </template>
        <template #ns="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.namespace }}</span></template>
        <template #method="{ row }">
          <Tag size="small" :theme="row.cleanup.retainDays === 0 ? 'danger' : 'warning'" variant="light-outline">{{ row.cleanup.method }}</Tag>
        </template>
        <template #retain="{ row }">{{ row.cleanup.retainDays === 0 ? '不留副本' : `${row.cleanup.retainDays} 天` }}</template>
        <template #export="{ row }">
          <span style="font-size: 12px">{{ row.cleanup.exportable ? '可导出（摘要 + 指标）' : '不可导出' }}</span>
        </template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">下线迁移说明<CliHint command="oc frontier isolation migrate --experiment D-FR-6" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'path', label: '归档路径', value: 'archive://frontier/{实验编号}/（只读包，含摘要与指标；可导出 / 可删除）' },
            { key: 'scope', label: '导出范围', value: '实验摘要 + 指标序列 + 评审记录；不回填团队配额，不进入主线表族' },
            { key: 'ga', label: 'GA 情形', value: '命名空间数据迁移到主线表族（保留 90 天双写窗口），旧命名空间 30 天后清理' },
            { key: 'exit', label: '终止情形', value: '开关与索引全量移除，公告给出迁移建议（如 D-FR-6 指引并入 A2A 统一通道）' },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">实验预算池</div>
          <InfoGrid :columns="1" :items="[
            { key: 'pool', label: '独立性', value: '实验预算独立于团队配额（不占团队额度，单独结算与审计）' },
            { key: 'over', label: '超预算', value: '达 80%：非事件触发任务排队；达 100%：自动降级（只读能力）或暂停实验，不静默超支' },
            { key: 'cap', label: '总额度', value: `$${experiments.reduce((a, e) => a + e.budget.usd, 0)}（12 方向合计；lab 阶段单实验 ≤ $40）` },
            { key: 'audit', label: '审计', value: '每次实验运行的成本进入实验台账，可在指标引用 metricsRef 中核对' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <Tag size="small" theme="warning" variant="light-outline">不占团队配额</Tag>
            <CopyableId id="trace-frontier-iso-6c31" label="隔离 traceId" short="12" />
          </div>
        </div>
      </div>

      <Dialog v-model:visible="cleanupOpen" header="一键清理实验命名空间（不可恢复）" width="620px" :confirm-btn="{ content: '确认清理', theme: 'danger' }" cancel-btn="取消" @confirm="doCleanup">
        <div class="oc-stack">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <RiskBadge level="R4" show-desc />
            <Tag theme="danger" variant="light-outline" size="small">不可恢复 / 立即生效 / 审计留痕</Tag>
          </div>
          <InfoGrid :columns="1" :items="[
            { key: 'target', label: '目标命名空间', value: targetNs, mono: true },
            { key: 'loss', label: '丢失内容', value: '该命名空间下全部实验数据（表/索引/临时产物）；保留策略为「不留副本」时无任何副本可恢复' },
            { key: 'keep', label: '保留内容', value: '实验摘要与指标归档包（如该实验登记为可导出）；清理动作本身写入审计' },
            { key: 'undo', label: '是否可撤销', value: '否：清理立即生效且不可回滚；如需重新采集须重新运行实验' },
          ]" />
          <div>
            <div class="oc-kv__k" style="margin-bottom: 4px">输入命名空间全名以确认</div>
            <Input v-model="confirmWord" size="small" :placeholder="targetNs" />
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
