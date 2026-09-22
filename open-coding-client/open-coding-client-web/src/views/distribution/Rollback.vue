<script setup lang="ts">
/**
 * D-01 一键回滚：保留前 2 个版本列表 + 回滚（≤ 2 分钟，数据快照按可回滚性处理）+ 回滚历史。
 * 硬约束：不可回滚迁移的版本不允许版本回滚，必须转人工（Runbook RB-01）；回滚不可撤销但可再次升级。
 * 溯源：卷 28 §4.2 / BUILD-MANIFEST D-01
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const manualOpen = ref(false);
const rolling = ref(false);
/** 保留版本：前 2 个可回滚版本（应用快照 + 数据快照）；大小含应用与快照 */
const retained = computed(() => [
  { version: '2.9.1', appliedAt: d.updateHistory[0].appliedAt, sizeMb: 486, rollbackable: true, snapshot: '应用快照 + 数据快照，可回退' },
  { version: '2.9.0', appliedAt: d.updateHistory[2].appliedAt, sizeMb: 452, rollbackable: true, snapshot: '应用快照 + 数据快照，可回退' },
]);
/** 更早版本：含不可回滚迁移，只能转人工 */
const manualItem = computed(() => ({ version: '2.8.4', reason: d.updateHistory[3].reason, handler: 'Runbook RB-01（人工回退：恢复备份 + 重建索引）' }));
const rollbackHistory = ref([
  { at: d.updateHistory[1].appliedAt, from: '2.10.0-rc.2', to: '2.9.1', reason: d.updateHistory[1].reason, durationSec: 102, result: 'SUCCEEDED', actor: '更新器（自动）', dataAction: '迁移回退（可回滚，快照已恢复）' },
  { at: d.updateHistory[4].appliedAt, from: '2.8.3', to: '2.8.2', reason: d.updateHistory[4].reason, durationSec: 96, result: 'SUCCEEDED', actor: '更新器（自动）', dataAction: '无数据变更（仅应用版本）' },
  { at: d.updateHistory[3].appliedAt, from: '2.8.4', to: '2.8.4', reason: d.updateHistory[3].reason, durationSec: 0, result: 'BLOCKED', actor: '更新器（自动）', dataAction: '未执行（预检失败已阻断）' },
]);
const snapshotInfo = computed(() => [
  { key: 'policy', label: '数据快照策略', value: '应用前自动生成；回滚时按迁移可回滚性处理', span: 2 as const },
  { key: 'rollbackable', label: '可回滚迁移', value: '版本 + 数据一并回退（快照恢复，≤ 2 分钟）' },
  { key: 'unrollbackable', label: '不可回滚迁移', value: '禁止自动回滚：数据不回退，转人工按 Runbook 恢复', tag: { text: '转人工', theme: 'warning' as const } },
  { key: 'retention', label: '快照保留', value: '保留前 2 个版本的快照；滚动清理，清理前提示导出', span: 2 as const },
]);
const resultTheme: Record<string, 'success' | 'warning' | 'danger'> = { SUCCEEDED: 'success', BLOCKED: 'warning', FAILED: 'danger' };
/** 执行回滚：模拟 ≤ 2 分钟流程（应用回退 + 快照恢复 + 健康检查） */
function doRollback(v: string) {
  rolling.value = true;
  MessagePlugin.info(`开始回滚到 ${v}：应用版本回退 + 快照恢复 + 健康检查（预计 ≤ 2 分钟）`);
  window.setTimeout(() => {
    rolling.value = false;
    rollbackHistory.value.unshift({
      at: new Date().toISOString(),
      from: '2.9.2',
      to: v,
      reason: '人工回滚：升级后关键 SLI 抽样越线（首 token P95 3.2s > 2s）',
      durationSec: 108,
      result: 'SUCCEEDED',
      actor: '沈亦舟（Owner）',
      dataAction: '迁移回退（可回滚，快照已恢复）',
    });
    MessagePlugin.success(`已回滚到 ${v}（108 秒）：应用与数据均已恢复，可再次升级到 2.9.2`);
  }, 900);
}
function submitManual() {
  manualOpen.value = false;
  MessagePlugin.success('已创建人工回退工单（含诊断包与快照位置），Runbook RB-01 负责人将接手处理');
}
function exportHistory() {
  downloadJson({ retained: retained.value, manualItem: manualItem.value, history: rollbackHistory.value }, 'rollback-history.json');
  MessagePlugin.success('回滚历史已导出（JSON，含数据处置说明）');
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = retained.value.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}
onMounted(load);
</script>

<template>
  <div class="oc-page">
    <PageHeader title="版本回滚" volume="卷 28" manifest="D-01" cli="oc rollback --to 2.9.0 --with-snapshot --json"
      desc="保留前 2 个版本；一键回滚预计 ≤ 2 分钟（含健康检查），数据快照按迁移可回滚性处理，不可回滚迁移必须转人工。"
      :status="[{ label: '回滚不可撤销', theme: 'warning' }, { label: '可再次升级', theme: 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportHistory"><OcIcon name="download" size="12px" /> 导出回滚历史</Button>
        <Button size="small" variant="outline" @click="manualOpen = true">转人工回退说明</Button>
      </template>
    </PageHeader>
    <StateShell :state="state" trace-id="trace-rollback-6a3f28" empty-title="没有可回滚的保留版本" empty-action="查看人工恢复流程"
      empty-desc="仅保留前 2 个版本；若快照已被滚动清理，需走人工恢复（Runbook RB-01）。"
      example-task="回滚到 2.9.0（回滚后再次升级到 2.9.2 验证幂等）"
      what="回滚能力加载失败" why="快照索引不可读（快照存储挂载失败或校验和不匹配）"
      how="可重试；快照不可用时不提供自动回滚，避免恢复出损坏数据"
      @retry="load" @empty-action="manualOpen = true">
      <div class="oc-grid oc-grid--4">
        <StatCard label="保留版本" :value="retained.length" unit="个" icon="history" hint="仅保留前 2 个版本（含快照）" />
        <StatCard label="预计回滚耗时" value="≤ 2" unit="分钟" icon="time" hint="应用回退 + 快照恢复 + 健康检查" />
        <StatCard label="回滚历史成功" :value="rollbackHistory.filter((h) => h.result === 'SUCCEEDED').length" unit="次" icon="check" hint="失败/阻断记录同样留痕" />
        <StatCard label="转人工条目" :value="1" unit="个" :lower-is-better="true" icon="error" hint="含不可回滚迁移，禁止自动回滚" />
      </div>
      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">保留版本（前 2 个版本：版本 / 应用时间 / 大小）</div>
          <CopyableId id="trace-rollback-list-2c81d0" label="复制 traceId" />
        </div>
        <Table :data="retained" row-key="version" size="small" style="margin-top: 8px" :columns="[
          { colKey: 'version', title: '版本', width: 140 }, { colKey: 'appliedAt', title: '应用时间', width: 200 },
          { colKey: 'sizeMb', title: '大小（含快照）', width: 140 }, { colKey: 'snapshot', title: '数据处置' },
          { colKey: 'action', title: '操作', width: 150 }]">
          <template #version="{ row }"><span class="oc-mono">{{ row.version }}</span><Tag size="small" theme="success" variant="light-outline" style="margin-left: 6px">可回滚</Tag></template>
          <template #appliedAt="{ row }">{{ new Date(row.appliedAt).toLocaleString('zh-CN') }}</template>
          <template #sizeMb="{ row }"><span class="oc-mono">{{ row.sizeMb }} MB</span></template>
          <template #snapshot="{ row }"><span class="oc-muted">{{ row.snapshot }}</span></template>
          <template #action="{ row }">
            <Popconfirm @confirm="doRollback(row.version)"
              :content="`回滚到 ${row.version}：预计 ≤ 2 分钟（含健康检查）；数据快照按可回滚性处理（可回滚迁移与版本一并回退）。回滚不可撤销，但可再次升级。是否继续？`">
              <Button size="small" theme="danger" variant="outline" :loading="rolling">一键回滚</Button>
            </Popconfirm>
          </template>
        </Table>
        <div class="oc-card" style="margin-top: 10px; border-left: 3px solid var(--td-warning-color-3, #ffb98a)">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Tag size="small" theme="warning" variant="light-outline">不可自动回滚</Tag>
            <span class="oc-mono">{{ manualItem.version }}</span>
            <span class="oc-muted" style="font-size: 12px">{{ manualItem.reason }}</span>
            <span class="oc-grow" />
            <Button size="small" variant="outline" @click="manualOpen = true">转人工处理</Button>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
            {{ manualItem.handler }}。不可回滚时不会执行「假回滚」（应用回退但数据未回退会造成数据错乱）。
          </div>
        </div>
      </div>
      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">数据快照按可回滚性处理</div>
          <InfoGrid :items="snapshotInfo" :columns="2" />
          <div class="oc-state__hint" style="margin-top: 8px">
            回滚前会生成「回滚点快照」，确保回滚可被再次升级覆盖；快照加密存储，导出需权限。
          </div>
          <CliHint command="oc rollback plan --to 2.9.0 --show-snapshot" />
        </div>

        <div class="oc-card">
          <div class="oc-card__title">回滚历史</div>
          <Table :data="rollbackHistory" row-key="at" size="small" :columns="[
            { colKey: 'at', title: '时间', width: 170 }, { colKey: 'to', title: '版本', width: 150 },
            { colKey: 'result', title: '结果', width: 110 }, { colKey: 'reason', title: '原因 / 数据处置' }]">
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template #to="{ row }"><span class="oc-mono">{{ row.from }} → {{ row.to }}</span></template>
            <template #result="{ row }">
              <Tooltip :content="`耗时 ${row.durationSec} 秒 · 操作者：${row.actor}`">
                <Tag size="small" :theme="resultTheme[String(row.result)] ?? 'default'" variant="light-outline">{{ row.result }}</Tag>
              </Tooltip>
            </template>
            <template #reason="{ row }">
              <span>{{ row.reason }}</span>
              <div class="oc-muted" style="font-size: 11px">{{ row.dataAction }}</div>
            </template>
          </Table>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="manualOpen" header="转人工回退（含不可回滚迁移）" width="560px" cancel-btn="取消"
      :confirm-btn="{ content: '创建人工回退工单', theme: 'warning' }" @confirm="submitManual">
      <div class="oc-stack">
        <div>版本 {{ manualItem.version }} 含不可回滚迁移：自动回滚会回退应用但无法回退数据，因此必须转人工。</div>
        <div style="font-size: 12px">
          人工回退步骤（Runbook RB-01）：① 冻结写入（只读模式，可读可导出，不锁死数据）；
          ② 从备份恢复数据到迁移前时间点（RPO ≤ 15 分钟）；③ 回退应用版本并重建索引，校验哈希链；
          ④ 解除只读，记录审计事件（含操作者与理由）。
        </div>
        <CliHint command="oc rollback manual --to 2.8.4 --runbook RB-01 --audit" />
      </div>
    </Dialog>
  </div>
</template>
