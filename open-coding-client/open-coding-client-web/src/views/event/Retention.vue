<script setup lang="ts">
/**
 * V-09 留存与归档。
 * 分类留存（领域 1 年 / 系统 1 年 / 遥测 30 天 / 审计 3 年+）+ 冷归档 +
 * 合规删除穿透六层并生成删除证明；删除不可撤销，需二次确认与复核人。
 * 溯源：卷 16 §4.7 / 卷 19 §4.6；BUILD-MANIFEST V-09。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
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
const confirmWord = ref('');
const reviewer = ref('');
const scopeInput = ref('记忆条目 project.user.email');

const policies = computed(() => platformData.eventJobs.retentionPolicies);
const proofs = computed(() => platformData.persistence.deletionProofs);
const activeProof = computed<DeletionProof>(() => proofs.value.find((p) => p.proofId === proofId.value) ?? proofs.value[0]);

const policyColumns = [
  { colKey: 'eventClass', title: '事件类别', width: 250 },
  { colKey: 'onlineDays', title: '在线保留', width: 120, cell: 'days' },
  { colKey: 'archiveTier', title: '归档层', width: 220 },
  { colKey: 'archiveFormat', title: '归档格式', width: 120 },
  { colKey: 'deleteRule', title: '删除规则', ellipsis: true },
  { colKey: 'legalHold', title: '法务保留', width: 110, cell: 'hold' },
];

const layerColumns = [
  { colKey: 'layer', title: '层', width: 190, cell: 'layer' },
  { colKey: 'status', title: '处理结果', width: 150, cell: 'status' },
  { colKey: 'detail', title: '说明', ellipsis: true },
];

const LAYER_THEME: Record<string, 'success' | 'warning' | 'default' | 'primary'> = { DONE: 'success', PENDING: 'warning', FILTERED_ON_READ: 'primary', NOT_APPLICABLE: 'default' };

/** 合规删除：二次确认（输入 DELETE）+ 复核人 + 明确不可撤销 */
function executeDelete() {
  if (confirmWord.value !== 'DELETE' || !reviewer.value) {
    MessagePlugin.error('请完整输入 DELETE 并填写复核人（双人复核是合规删除的硬性要求）');
    return;
  }
  MessagePlugin.success(`已提交合规删除：${scopeInput.value}（六层贯通执行中，完成后生成删除证明与审计事件）`);
  deleteOpen.value = false;
  confirmWord.value = '';
}

function announceArchived() {
  MessagePlugin.success('归档任务已提交：超期领域事件转冷存（Parquet + zstd，索引保留元数据）');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = policies.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="留存与归档"
      desc="分类留存按事件类别差异化；超期转冷归档；合规删除必须穿透在线表→投影→索引→归档→备份→证明六层，并生成删除证明。"
      volume="卷 16" manifest="V-09" cli="oc event retention show --class audit && oc event delete --scope <scope>"
      :status="[{ label: '合规删除需要 compliance.delete', theme: 'warning' }, { label: '不可撤销', theme: 'danger' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 170px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'PERMISSION_DENIED', label: '无权限' },
        ]" />
        <Button size="small" variant="outline" @click="announceArchived">触发归档</Button>
        <Button size="small" theme="danger" variant="outline" @click="deleteOpen = true">执行合规删除</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="在线事件总量" :value="1843200" format="token" icon="system" hint="分区表 + 冷存归档支撑 ≥10 亿条" />
      <StatCard label="冷归档字节" :value="18432000000" format="token" unit="B" icon="cloud" hint="Parquet + zstd，索引保留元数据" />
      <StatCard label="遥测在线窗口" :value="30" unit="天" icon="time" hint="聚合后丢弃原始（聚合结果保留 3 年）" />
      <StatCard label="删除证明" :value="proofs.length" icon="secured" hint="每次合规删除生成一份，写入审计链" />
    </div>

    <StateShell
      :state="demo" stage="正在读取留存策略与删除证明…"
      empty-title="没有留存策略" empty-desc="租户尚未配置分类留存策略时，系统按默认（领域 1 年 / 审计 3 年 / 遥测 30 天）执行。"
      empty-action="恢复默认策略" example-task="把审计事件在线保留从 3 年调整为 5 年（合规可配）"
      what="留存策略读取失败" why="合规策略来源（RetentionPolicySPI）不可达，拒绝展示可能过期的保留承诺"
      how="重试；策略不可用期间禁止执行合规删除（避免越权删除）" trace-id="trace-c93d0f12"
      missing-permission="compliance.delete" risk-level="R5" apply-path="在「企业治理 → 合规 → 权限申请」提交双人复核申请"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @apply="demo = 'NORMAL'"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">分类留存策略</h3>
        <Table :data="policies" :columns="policyColumns" row-key="eventClass" size="small" :pagination="undefined">
          <template #days="{ row }">{{ row.onlineDays }} 天</template>
          <template #hold="{ row }">
            <Tag :theme="row.legalHold ? 'danger' : 'default'" size="small" variant="light-outline">{{ row.legalHold ? '法务保留' : '常规' }}</Tag>
          </template>
        </Table>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          删除证明查看器
          <span class="oc-flex" style="gap: 6px">
            <Select v-model="proofId" size="small" style="width: 220px" aria-label="选择证明">
              <Option v-for="p in proofs" :key="p.proofId" :value="p.proofId" :label="`${p.proofId} · ${p.executor}`" />
            </Select>
            <CliHint :command="`oc event delete proof --id ${proofId}`" />
          </span>
        </h3>
        <InfoGrid :columns="2" :items="[
          { key: 'scope', label: '删除范围', value: activeProof.scope },
          { key: 'executor', label: '执行者', value: activeProof.executor },
          { key: 'at', label: '执行时间', value: new Date(activeProof.executedAt).toLocaleString('zh-CN') },
          { key: 'rev', label: '可撤销', value: activeProof.reversible ? '可撤销（仅删除申请未执行时）' : '不可撤销（已贯通多层）', tag: { text: activeProof.reversible ? '可撤销' : '不可撤销', theme: activeProof.reversible ? 'warning' : 'danger' } },
          { key: 'ref', label: '证据引用', value: activeProof.evidenceRef, mono: true },
        ]" />
        <Table :data="activeProof.layers" :columns="layerColumns" row-key="layer" size="small" :pagination="undefined" style="margin-top: 10px">
          <template #layer="{ row }"><span class="oc-mono">{{ row.layer }}</span></template>
          <template #status="{ row }">
            <Tag :theme="LAYER_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
          </template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag v-if="activeProof.layers.some((l) => l.status === 'PENDING')" theme="warning" variant="light-outline" size="small">
            归档层尚未完成 → 证明状态为「部分完成」，不可对外声明已彻底删除
          </Tag>
          <Tag v-else theme="success" variant="light-outline" size="small">六层贯通完成，删除证明已写入审计链</Tag>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="deleteOpen" header="执行合规删除（不可撤销）" width="640px" :confirm-btn="{ content: '确认删除', theme: 'danger' }" cancel-btn="取消" @confirm="executeDelete">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <RiskBadge level="R5" show-desc />
          <Tag theme="danger" variant="light-outline" size="small">不可撤销 / 穿透备份 / 生成证明</Tag>
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'scope', label: '删除范围（申请编号）', value: `${scopeInput} · 申请 dp-2026-0918` },
          { key: 'effect', label: '后果', value: '数据在在线表、投影、索引、归档、备份标记五层被清除或过滤；恢复时将按标记过滤，无法还原' },
          { key: 'lost', label: '丢失清单', value: '记忆条目 1 条 + 关联向量 3 个 + 文档块 2 个（归档分区重写 1 个）' },
          { key: 'undo', label: '是否可撤销', value: '否：执行后仅能通过法律流程说明，不可技术还原' },
          { key: 'rule', label: '合规依据', value: '个保法第 47 条（删除权）+ 租户合规策略 CP-07；需双人复核' },
        ]" />
        <div>
          <div class="oc-kv__k" style="margin-bottom: 4px">删除范围确认</div>
          <Input v-model="scopeInput" size="small" />
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Input v-model="reviewer" size="small" style="width: 240px" placeholder="复核人（第二签署人）" />
          <Input v-model="confirmWord" size="small" style="width: 200px" placeholder="输入 DELETE 以确认" />
        </div>
        <CliHint command="oc event delete --scope <scope> --dual-approval --reason <reason>" />
        <Tag theme="warning" variant="light-outline" size="small">审计链偏差仅告警不可自动修复；本操作写入不可变审计记录</Tag>
      </div>
    </Dialog>
  </div>
</template>
