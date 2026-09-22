<script setup lang="ts">
/**
 * O-12 命令审计日志。
 * 每条命令记录目标主机/用户/命令/资源/退出码（脱敏后入库）；被阻断的命令同样留痕，
 * 审计数据受权限约束，缺失权限时整页进入 PERMISSION_DENIED。
 * 溯源：卷 20 §4.5 审计 / 卷 16 §4.1；BUILD-MANIFEST O-12。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const keyword = ref('');
const exitFilter = ref('');
const activeId = ref('ca-002');

const audit = computed(() => platformData.commandAudit);
const rows = computed(() =>
  audit.value.filter((a) => {
    if (keyword.value && !`${a.command} ${a.host} ${a.workspaceId}`.toLowerCase().includes(keyword.value.toLowerCase())) return false;
    if (exitFilter.value === 'failed' && a.exitCode !== null && a.exitCode === 0) return false;
    if (exitFilter.value === 'blocked' && a.exitCode !== null) return false;
    return true;
  }),
);
const active = computed(() => audit.value.find((a) => a.id === activeId.value) ?? audit.value[0]);
const limit = ref(20);
const shown = computed(() => rows.value.slice(0, limit.value));
const edge = computed(() => rows.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));

const columns = [
  { colKey: 'at', title: '时间', width: 180, cell: 'at' },
  { colKey: 'host', title: '目标主机', width: 220, cell: 'host' },
  { colKey: 'user', title: '用户', width: 110 },
  { colKey: 'command', title: '命令（脱敏）', ellipsis: true, cell: 'cmd' },
  { colKey: 'resource', title: '资源', width: 230 },
  { colKey: 'exitCode', title: '退出码', width: 100, cell: 'code' },
  { colKey: 'redacted', title: '脱敏', width: 100, cell: 'red' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = audit.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="命令审计日志"
      desc="每条命令（含被阻断的）记录目标主机、用户、命令、资源峰值与退出码；密钥类参数脱敏，明文永不落库。审计数据按权限点约束访问。"
      volume="卷 20" manifest="O-12" cli="oc workspace audit --all --redacted --since 24h"
      :status="[{ label: `${audit.length} 条记录`, theme: 'default' }, { label: '需 audit.read', theme: 'warning' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 170px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'PERMISSION_DENIED', label: '无权限' },
        ]" />
        <Input v-model="keyword" size="small" style="width: 200px" placeholder="按命令/主机检索" clearable />
        <Select v-model="exitFilter" size="small" style="width: 150px" clearable placeholder="结果过滤" aria-label="结果">
          <Option value="" label="全部结果" />
          <Option value="failed" label="仅失败" />
          <Option value="blocked" label="仅被阻断" />
        </Select>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="命令总量（24h）" :value="audit.length" icon="terminal" hint="含一次性/PTY/后台三模式" />
      <StatCard label="失败命令" :value="audit.filter((a) => a.exitCode !== null && a.exitCode !== 0).length" icon="error" hint="失败保留输出尾部供排障" />
      <StatCard label="被阻断命令" :value="audit.filter((a) => a.exitCode === null).length" icon="secured" hint="危险命令/提权/越界：留痕并告警" />
      <StatCard label="脱敏记录" :value="audit.filter((a) => a.redacted).length" icon="lock" hint="密钥类参数与令牌替换为掩码" />
    </div>

    <StateShell
      :state="state" stage="正在读取命令审计（脱敏处理中）…"
      empty-title="没有命令审计记录" empty-desc="该时间窗内没有命令执行，或审计保留策略已将其归档到冷存。"
      empty-action="扩大时间窗" example-task="筛选「仅被阻断」查看 sudo 提权被拒绝的完整留痕"
      what="命令审计读取失败" why="审计存储只读副本延迟（与事件表同库，归档任务占用 IO）"
      how="可重试；审计查询已自动降级为热窗口（最近 24h），全量查询需等待副本追上" trace-id="trace-eeff6638"
      missing-permission="audit.read" risk-level="R2" apply-path="在「企业治理 → 审计 → 权限申请」提交审计读取权限（需说明查询目的）"
      :collapsed-summary="`已折叠 ${rows.length - shown.length} 条（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="keyword = ''; exitFilter = ''" @apply="demo = 'NORMAL'"
    >
      <Table :data="shown" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #host="{ row }"><span class="oc-mono">{{ row.host }}</span></template>
        <template #cmd="{ row }">
          <Button size="small" variant="text" @click="activeId = row.id as string">
            <span class="oc-mono oc-truncate">{{ row.command }}</span>
          </Button>
        </template>
        <template #code="{ row }">
          <Tag v-if="row.exitCode === null" theme="danger" size="small" variant="light-outline">已阻断</Tag>
          <Tag v-else-if="row.exitCode !== 0" theme="warning" size="small" variant="light-outline">{{ row.exitCode }}</Tag>
          <span v-else class="oc-muted">0</span>
        </template>
        <template #red="{ row }">
          <Tag :theme="row.redacted ? 'success' : 'default'" size="small" variant="light-outline">{{ row.redacted ? '已脱敏' : '无敏感参数' }}</Tag>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          记录详情：{{ active.id }}
          <CopyableId :id="`audit-${active.id}`" label="复制审计引用" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'host', label: '目标主机', value: active.host, mono: true },
          { key: 'user', label: '执行用户', value: active.user },
          { key: 'ws', label: '工作区', value: active.workspaceId, mono: true },
          { key: 'cmd', label: '命令', value: active.command, mono: true },
          { key: 'res', label: '资源', value: active.resource },
          { key: 'code', label: '退出码', value: active.exitCode === null ? '已阻断（未执行）' : String(active.exitCode) },
          { key: 'at', label: '执行时间', value: new Date(active.at).toLocaleString('zh-CN') },
          { key: 'trace', label: '关联事件', value: 'workspace.command.completed / tool.call.blocked（事件 ↔ trace 可互查）' },
        ]" />
        <div class="oc-flex" style="margin-top: 8px">
          <CliHint :command="`oc workspace audit show --id ${active.id}`" />
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">脱敏对照（明文永不落库）</h3>
        <JsonBlock
          :mask="true" label="命令参数脱敏"
          :value="{ command: active.command, env: { ALIYUN_AK: '••••••（密钥引用注入）', DB_PASSWORD: '••••••（SecretPort 托管）' }, redactedFields: ['env.ALIYUN_AK', 'env.DB_PASSWORD'], rule: '字段级脱敏 + 模式级高熵串识别（写入前完成）' }"
        />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">审计链偏差仅告警不可自动修复（哈希链完整性）</Tag>
          <Tag size="small" variant="outline">导出审计需走合规审批（产生导出事件）</Tag>
        </div>
      </div>
    </div>
  </div>
</template>
