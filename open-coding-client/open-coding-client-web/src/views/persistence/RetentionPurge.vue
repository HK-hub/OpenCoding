<script setup lang="ts">
/**
 * Z-09 保留与合规删除。
 * 分级保留（按域与租户策略）+ 六层贯通（在线表/投影/索引/归档/备份/证明）+
 * 删除证明查看器；合规删除是不可撤销操作，需后果与丢失清单确认 + 双人复核。
 * 溯源：卷 19 D-PERS-9/§4.6；BUILD-MANIFEST Z-09。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { DeletionProof } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const proofId = ref(platformData.persistence.deletionProofs[0].proofId);
const deleteOpen = ref(false);
const ackWord = ref('');
const reviewer = ref('');
const reason = ref('');

const proofs = computed(() => platformData.persistence.deletionProofs);
const active = computed<DeletionProof>(() => proofs.value.find((p) => p.proofId === proofId.value) ?? proofs.value[0]);
const pendingLayers = computed(() => active.value.layers.filter((l) => l.status === 'PENDING').length);

const LAYER_THEME: Record<string, 'success' | 'warning' | 'primary' | 'default'> = { DONE: 'success', PENDING: 'warning', FILTERED_ON_READ: 'primary', NOT_APPLICABLE: 'default' };

const layerColumns = [
  { colKey: 'layer', title: '层（六层贯通）', width: 200, cell: 'layer' },
  { colKey: 'status', title: '处理结果', width: 160, cell: 'status' },
  { colKey: 'detail', title: '说明', ellipsis: true },
];

function confirmDelete() {
  if (ackWord.value !== 'DELETE' || !reviewer.value || !reason.value) {
    MessagePlugin.error('缺少必要确认：输入 DELETE、填写复核人与合规依据（双人复核硬性要求）');
    return;
  }
  MessagePlugin.success('合规删除已提交：六层贯通执行，完成后生成删除证明并写入不可变审计链');
  deleteOpen.value = false;
  ackWord.value = '';
}

onMounted(() => {
  window.setTimeout(() => (demo.value = proofs.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="保留与合规删除"
      desc="合规删除必须贯通六层并生成可验证的删除证明；删除不可撤销、恢复时按备份标记过滤。分级保留避免「一刀切」导致成本与合规双输。"
      volume="卷 19" manifest="Z-09" cli="oc persistence retention show && oc persistence purge --scope <scope> --proof"
      :status="[{ label: '需 compliance.delete', theme: 'warning' }, { label: '删除不可撤销', theme: 'danger' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 170px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'PERMISSION_DENIED', label: '无权限' },
        ]" />
        <Button size="small" theme="danger" variant="outline" @click="deleteOpen = true">执行合规删除</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="删除证明" :value="proofs.length" icon="secured" hint="每次删除一份，写入审计链" />
      <StatCard label="待完成层" :value="pendingLayers" icon="time" hint="归档层重写可能排队（如 del-3a02）" />
      <StatCard label="在线表清理行数（30 天）" :value="184320" format="number" icon="delete" hint="逻辑删除标记 + 后台物理清理" />
      <StatCard label="备份标记过滤" :value="proofs.filter((p) => p.layers.some((l) => l.status === 'FILTERED_ON_READ')).length" icon="database" hint="恢复时按标记过滤，不还原已删数据" />
    </div>

    <StateShell
      :state="demo" stage="正在读取保留策略与删除证明…"
      empty-title="没有删除证明" empty-desc="尚未执行过合规删除；常规 TTL 清理不生成证明（仅记录系统事件）。"
      empty-action="查看留存策略" example-task="用户行使删除权：删除某记忆条目并贯通六层生成证明"
      what="删除证明读取失败" why="证明存储（不可变存储）鉴权失败，无法验证证明完整性"
      how="重试；证明不可验证时禁止执行新的合规删除（避免无证操作）" trace-id="trace-a99c5d07"
      missing-permission="compliance.delete" risk-level="R5" apply-path="在「企业治理 → 合规 → 权限申请」提交双人复核申请（需合规官 + 数据保护官）"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @apply="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">保留策略（分级）</h3>
          <Table
            :data="platformData.eventJobs.retentionPolicies" size="small" :pagination="undefined" row-key="eventClass"
            :columns="[{ colKey: 'eventClass', title: '类别', width: 220 }, { colKey: 'onlineDays', title: '在线保留', width: 110, cell: 'days' }, { colKey: 'archiveTier', title: '归档', width: 180 }, { colKey: 'deleteRule', title: '删除规则', ellipsis: true }]"
          >
            <template #days="{ row }">{{ row.onlineDays }} 天</template>
          </Table>
          <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
            <Tag size="small" variant="outline">删除标记贯通：在线表 → 投影 → 索引 → 归档 → 备份 → 证明</Tag>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">删除证明查看器</h3>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Select v-model="proofId" size="small" style="width: 240px" aria-label="选择证明">
              <Option v-for="p in proofs" :key="p.proofId" :value="p.proofId" :label="`${p.proofId} · ${p.executor}`" />
            </Select>
            <CliHint :command="`oc persistence purge proof --id ${proofId}`" />
          </div>
          <InfoGrid :columns="1" style="margin-top: 8px" :items="[
            { key: 'scope', label: '范围', value: active.scope },
            { key: 'executor', label: '执行者', value: active.executor },
            { key: 'at', label: '执行时间', value: new Date(active.executedAt).toLocaleString('zh-CN') },
            { key: 'rev', label: '可撤销', value: '不可撤销（已贯通多层）', tag: { text: '不可撤销', theme: 'danger' } },
            { key: 'ref', label: '证据引用', value: active.evidenceRef, mono: true },
          ]" />
          <Table :data="active.layers" :columns="layerColumns" row-key="layer" size="small" :pagination="undefined" style="margin-top: 10px">
            <template #layer="{ row }"><span class="oc-mono">{{ row.layer }}</span></template>
            <template #status="{ row }">
              <Tag :theme="LAYER_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
            </template>
          </Table>
          <Progress :percentage="Math.round((active.layers.filter((l) => l.status === 'DONE').length / active.layers.length) * 100)" theme="line" style="margin-top: 10px" />
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="deleteOpen" header="执行合规删除（危险操作 · 不可撤销）" width="660px" :confirm-btn="{ content: '确认删除', theme: 'danger' }" cancel-btn="取消" @confirm="confirmDelete">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <RiskBadge level="R5" show-desc />
          <Tag theme="danger" variant="light-outline" size="small">不可撤销 · 穿透备份 · 生成证明</Tag>
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'effect', label: '后果', value: '在线表物理清理、投影同步删除、索引删除向量与块、归档重写受影响分区、备份打标记（恢复时过滤）、生成删除证明' },
          { key: 'lost', label: '丢失清单', value: '该主体全部记忆条目 + 关联向量 + 文档块 + 会话条目索引（不可恢复）' },
          { key: 'undo', label: '是否可撤销', value: '否。技术层面无法还原；如需纠正只能通过法律流程说明' },
          { key: 'basis', label: '合规依据', value: '个保法第 47 条 / GDPR Art.17 + 租户策略 CP-07' },
          { key: 'rule', label: '复核要求', value: '双人复核（合规官 + 数据保护官）；单人不允许执行' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Input v-model="reviewer" size="small" style="width: 220px" placeholder="复核人（第二签署人）" />
          <Input v-model="reason" size="small" style="width: 320px" placeholder="合规依据与理由（写入证明）" />
        </div>
        <Input v-model="ackWord" size="small" style="width: 220px" placeholder="输入 DELETE 以确认" />
        <CliHint command="oc persistence purge --scope <scope> --dual-approval --proof --reason <reason>" />
      </div>
    </Dialog>
  </div>
</template>
