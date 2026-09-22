<script setup lang="ts">
/**
 * I-09 危险操作护栏。
 * 7 类危险操作：reset --hard / push --force / clean -fd / rebase 已推送 / 删除分支或 tag /
 * 丢弃未提交改动 / amend 已推送。每类给出后果、丢失清单、是否可撤销与自动临时引用 oc/backup/<ts>，
 * 并要求二次确认（输入命令片段）+ 理由。
 * 溯源：卷 21 D-GIT-7/§4.4；BUILD-MANIFEST I-09。
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
import type { DangerOp } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const opFilter = ref('');
const target = ref<DangerOp | null>(null);
const confirmText = ref('');
const reason = ref('');

const ops = computed(() => platformData.git.dangerOps);
const rows = computed(() => (opFilter.value ? ops.value.filter((o) => o.op.includes(opFilter.value)) : ops.value));
const lostTotal = computed(() => ops.value.reduce((a, o) => a + o.lostCommits.length, 0));
const reversibleCount = computed(() => ops.value.filter((o) => o.reversible).length);

const columns = [
  { colKey: 'op', title: '危险操作', width: 190, cell: 'op' },
  { colKey: 'command', title: '命令', ellipsis: true, cell: 'cmd' },
  { colKey: 'lastAt', title: '最近一次', width: 180, cell: 'at' },
  { colKey: 'lostCommits', title: '丢失提交', width: 120, cell: 'lost' },
  { colKey: 'backupRef', title: '临时引用', width: 230, cell: 'ref' },
  { colKey: 'reversible', title: '可撤销', width: 120, cell: 'rev' },
  { colKey: 'op', title: '操作', width: 120, cell: 'action' },
];

function confirmOp() {
  const op = target.value;
  if (!op) return;
  if (confirmText.value !== op.command) {
    MessagePlugin.error('二次确认失败：请输入与命令完全一致的文本（防止误触）');
    return;
  }
  if (!reason.value) {
    MessagePlugin.error('请填写理由：危险操作必须留痕（企业可要求审批）');
    return;
  }
  MessagePlugin.success(`已记录并执行：${op.command}（自动临时引用 ${op.backupRef}；可用 oc git undo 恢复）`);
  target.value = null;
  confirmText.value = '';
  reason.value = '';
}

onMounted(() => {
  window.setTimeout(() => (demo.value = ops.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="危险操作护栏"
      desc="7 类危险操作全部需要权限确认 + 二次确认 + 理由留痕；操作前自动创建临时引用 oc/backup/<ts>，可用 oc git undo 一键恢复（日志保留 30 天）。"
      volume="卷 21" manifest="I-09" cli="oc git danger list --show-lost && oc git undo --ref oc/backup/<ts>"
      :status="[{ label: '强制二次确认', theme: 'danger' }, { label: '自动临时引用', theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 170px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'PERMISSION_DENIED', label: '无权限' },
        ]" />
        <Select v-model="opFilter" size="small" style="width: 190px" clearable placeholder="按操作过滤" aria-label="操作">
          <Option value="" label="全部操作" />
          <Option value="reset" label="reset --hard" />
          <Option value="push" label="push --force" />
          <Option value="clean" label="clean -fd" />
          <Option value="branch" label="删除分支" />
        </Select>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="护栏覆盖操作" :value="ops.length" icon="secured" hint="D-GIT-7 清单 7 类，覆盖全部" />
      <StatCard label="丢失提交累计" :value="lostTotal" icon="warning" hint="均已有备份引用可恢复" />
      <StatCard label="可撤销操作" :value="reversibleCount" icon="history" hint="不可撤销者已在前置提示中明示" />
      <StatCard label="撤销日志保留" :value="30" unit="天" icon="time" hint="oc git undo + reflog 双保险" />
    </div>

    <StateShell
      :state="demo" stage="正在读取危险操作记录与备份引用…"
      empty-title="没有危险操作记录" empty-desc="该仓库尚未发生危险操作；护栏仍在生效（执行时会强制确认）。"
      empty-action="查看护栏清单" example-task="模拟一次 reset --hard 并观察丢失清单与备份引用生成"
      what="危险操作记录读取失败" why="reflog 与备份引用索引不可读（仓库处于 rebase 中间态）"
      how="可重试；中间态期间禁止执行新的危险操作（避免状态叠加）" trace-id="trace-a88c99aa"
      missing-permission="git.dangerous.execute" risk-level="R4" apply-path="在「权限与审批 → 申请授权」提交 R4 操作授权（企业可整体禁用）"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @apply="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #op="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <RiskBadge level="R4" />
            <span>{{ row.op }}</span>
          </div>
        </template>
        <template #cmd="{ row }"><span class="oc-mono oc-truncate">{{ row.command }}</span></template>
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.lastAt).toLocaleString('zh-CN') }}</span></template>
        <template #lost="{ row }">
          <Tag v-if="row.lostCommits.length" theme="danger" size="small" variant="light-outline">{{ row.lostCommits.length }} 个</Tag>
          <span v-else class="oc-muted">无</span>
        </template>
        <template #ref="{ row }"><span class="oc-mono">{{ row.backupRef }}</span></template>
        <template #rev="{ row }">
          <Tag :theme="row.reversible ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.reversible ? '可撤销' : '不可撤销' }}</Tag>
        </template>
        <template #action="{ row }">
          <Button size="small" variant="text" theme="danger" @click="target = row as DangerOp">执行</Button>
        </template>
      </Table>
    </StateShell>

    <Dialog :visible="!!target" @visible-change="(v: boolean) => { if (!v) target = null }" header="危险操作确认（二次确认 + 理由留痕）" width="680px" :confirm-btn="{ content: '确认执行', theme: 'danger' }" cancel-btn="取消" @confirm="confirmOp">
      <div v-if="target" class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <RiskBadge level="R4" show-desc />
          <Tag theme="danger" variant="light-outline" size="small">{{ target.reversible ? '可撤销' : '不可撤销' }}</Tag>
          <Tag theme="warning" variant="light-outline" size="small">自动临时引用 {{ target.backupRef }}</Tag>
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'cmd', label: '命令', value: target.command, mono: true },
          { key: 'effect', label: '后果', value: target.consequence },
          { key: 'undo', label: '是否可撤销', value: target.reversible ? `可撤销：${target.undoCommand}` : target.undoCommand },
          { key: 'protect', label: '保护分支校验', value: '若涉及保护分支（main / release/*）将被拒绝；企业可整体禁用该操作' },
          { key: 'history', label: '上一次执行', value: `${new Date(target.lastAt).toLocaleString('zh-CN')} · ${target.confirmedBy}` },
        ]" />
        <div v-if="target.lostCommits.length" class="oc-card" style="border-color: var(--oc-sev-error)">
          <h4 class="oc-card__title">丢失提交清单</h4>
          <Table
            :data="target.lostCommits" size="small" :pagination="undefined" row-key="hash"
            :columns="[{ colKey: 'hash', title: '提交', width: 120 }, { colKey: 'subject', title: '描述', ellipsis: true }, { colKey: 'author', title: '作者', width: 160 }]"
          >
            <template #hash="{ row }"><span class="oc-mono">{{ row.hash }}</span></template>
          </Table>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Input v-model="confirmText" size="small" style="width: 380px" :placeholder="`输入命令以确认：${target.command}`" />
          <Input v-model="reason" size="small" style="width: 240px" placeholder="理由（必填）" />
        </div>
        <CliHint :command="`${target.command}  # 前置：git update-ref ${target.backupRef} HEAD`" />
      </div>
    </Dialog>
  </div>
</template>
