<script setup lang="ts">
/**
 * Z-02 迁移列表与迁移包。
 * 版本化脚本（迁移即代码）：版本/校验和/前向逆向脚本/回填步骤/破坏性标记/执行记录；
 * 破坏性操作必须显式标记并经审批，回滚同样需要二次确认（可能丢失新数据）。
 * 溯源：卷 19 D-PERS-2/§4.2；BUILD-MANIFEST Z-02。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData, humanDuration } from '@/mock/data/platform';
import type { Migration } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const statusFilter = ref('');
const destructiveOnly = ref(false);
const rollbackTarget = ref<Migration | null>(null);
const rollbackReason = ref('');

const migrations = computed(() => platformData.persistence.migrations);
const rows = computed(() =>
  migrations.value.filter((m) => {
    if (statusFilter.value && m.status !== statusFilter.value) return false;
    if (destructiveOnly.value && !m.destructive) return false;
    return true;
  }),
);
const limit = ref(20);
const shown = computed(() => rows.value.slice(0, limit.value));
const edge = computed(() => rows.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));

const destructiveCount = computed(() => migrations.value.filter((m) => m.destructive).length);
const rollbackableCount = computed(() => migrations.value.filter((m) => m.rollbackable).length);

const columns = [
  { colKey: 'version', title: '版本', width: 140, cell: 'version' },
  { colKey: 'name', title: '迁移内容', ellipsis: true },
  { colKey: 'checksum', title: '校验和', width: 170, cell: 'checksum' },
  { colKey: 'scripts', title: '前向 / 逆向', width: 150, cell: 'scripts' },
  { colKey: 'backfillSteps', title: '回填步骤', width: 110, cell: 'backfill' },
  { colKey: 'status', title: '状态', width: 130, cell: 'status' },
  { colKey: 'durationMs', title: '耗时', width: 110, cell: 'duration' },
  { colKey: 'op', title: '操作', width: 120, cell: 'op' },
];

const STATUS_THEME: Record<string, 'success' | 'warning' | 'danger' | 'default'> = { applied: 'success', draft: 'default', failed: 'danger', rolled_back: 'warning' };

/** 迁移包查看：按选中迁移的真实字段重建 manifest（脚本引用 / 回填步骤 / 破坏性与审批） */
const pkgTarget = ref<Migration | null>(null);
const pkgManifest = computed(() => {
  const m = pkgTarget.value;
  if (!m) return null;
  return {
    package: `oc-migration-${m.version}.tar.zst`,
    version: m.version,
    checksum: m.checksum,
    forward: m.forwardScript,
    reverse: m.reverseScript,
    backfill: m.backfillSteps,
    destructive: m.destructive,
    requiresApproval: m.destructive,
    status: m.status,
    rollbackable: m.rollbackable,
    approvedBy: m.approvedBy,
  };
});

function openPkg(row: Migration) {
  pkgTarget.value = row;
}

/** 下载迁移包清单（JSON）：内容即该迁移的可执行清单，随包校验和一起归档 */
function downloadPkg() {
  if (!pkgManifest.value || !pkgTarget.value) return;
  const file = downloadJson(pkgManifest.value, `${pkgTarget.value.version}-package.json`);
  MessagePlugin.success('已生成 ' + file);
}

function confirmRollback() {
  const target = rollbackTarget.value;
  if (!target) return;
  if (!target.reverseScript || !target.rollbackable) {
    MessagePlugin.error('该迁移未声明可回滚（无逆向脚本）：禁止回滚，只能前向修复');
    return;
  }
  if (!rollbackReason.value) {
    MessagePlugin.error('请填写回滚理由（写入审计并通知变更委员会）');
    return;
  }
  MessagePlugin.success(`已提交回滚：${target.version}（执行 ${target.reverseScript}；注意：回滚不会恢复已被收缩列覆盖的数据）`);
  rollbackTarget.value = null;
  rollbackReason.value = '';
}

onMounted(() => {
  window.setTimeout(() => (demo.value = migrations.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="迁移列表与迁移包"
      desc="迁移即代码：每个迁移带唯一版本、校验和、前向脚本与可选逆向脚本；破坏性操作（删列/改类型/删表）必须显式标记并审批。"
      volume="卷 19" manifest="Z-02" cli="oc persistence migrations list --show-destructive"
      :status="[{ label: `${migrations.length} 个迁移`, theme: 'default' }, { label: `破坏性 ${destructiveCount}`, theme: 'danger' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="statusFilter" size="small" style="width: 140px" clearable placeholder="按状态" aria-label="状态">
          <Option value="" label="全部状态" />
          <Option value="applied" label="applied" />
          <Option value="draft" label="draft" />
          <Option value="failed" label="failed" />
          <Option value="rolled_back" label="rolled_back" />
        </Select>
        <Button size="small" :theme="destructiveOnly ? 'danger' : 'default'" variant="outline" @click="destructiveOnly = !destructiveOnly">
          {{ destructiveOnly ? '显示全部' : '只看破坏性' }}
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="已应用迁移" :value="migrations.filter((m) => m.status === 'applied').length" icon="database" hint="执行记录入库，可重复执行（幂等）" />
      <StatCard label="可回滚迁移" :value="rollbackableCount" icon="history" hint="声明逆向脚本并通过回滚演练" />
      <StatCard label="破坏性迁移" :value="destructiveCount" icon="secured" hint="需 expand-contract 流程 + 审批" />
      <StatCard label="最长迁移耗时" :value="Math.max(...migrations.map((m) => m.durationMs)) / 1000" unit="秒" icon="time" hint="大表回填分批 + 限速 + 可暂停" />
    </div>

    <StateShell
      :state="state" stage="正在读取迁移记录与迁移包…"
      empty-title="没有迁移记录" empty-desc="全新部署尚未执行任何迁移，或过滤条件排除了全部记录。"
      empty-action="清除过滤" example-task="提交 V2026.09.26__deletion_proof.sql，走 CI 六阶段流水线"
      what="迁移记录读取失败" why="迁移记录表查询超时（正在执行大表回填，长事务占用连接）"
      how="重试；大表回填已限速可暂停，可先暂停再查询" trace-id="trace-f22a7c81"
      :collapsed-summary="`已折叠 ${rows.length - shown.length} 个迁移（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="statusFilter = ''; destructiveOnly = false"
    >
      <Table :data="shown" :columns="columns" row-key="version" size="small" :pagination="undefined">
        <template #version="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono">{{ row.version }}</span>
            <Tag v-if="row.destructive" theme="danger" size="small" variant="light-outline">破坏性</Tag>
          </div>
        </template>
        <template #checksum="{ row }"><span class="oc-mono oc-truncate">{{ row.checksum }}</span></template>
        <template #scripts="{ row }">
          <Tag :theme="row.reverseScript ? 'success' : 'default'" size="small" variant="light-outline">
            {{ row.reverseScript ? '前向 + 逆向' : '仅前向' }}
          </Tag>
        </template>
        <template #backfill="{ row }">{{ row.backfillSteps.length }} 步</template>
        <template #status="{ row }">
          <Tag :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #duration="{ row }"><span class="oc-muted">{{ row.durationMs ? humanDuration(Math.round(row.durationMs / 1000)) : '—' }}</span></template>
        <template #op="{ row }">
          <Button size="small" variant="text" :disabled="row.status !== 'applied'" @click="rollbackTarget = row as Migration">回滚</Button>
          <Button size="small" variant="text" @click="openPkg(row as Migration)">迁移包</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-card">
      <h3 class="oc-card__title">
        迁移包（最近一次合入）
        <CliHint command="oc persistence migrations package --version V2026.09.24 --download" />
      </h3>
      <JsonBlock
        :mask="false" label="manifest"
        :value="{
          package: 'oc-migration-V2026.09.24.tar.zst',
          version: 'V2026.09.24',
          checksum: 'sha256:cdf0…b311',
          forward: 'V2026.09.24__snapshot_granularity.sql',
          reverse: null,
          backfill: ['默认回填「会话级」'],
          destructive: false,
          requiresApproval: false,
          ciEvidence: { staticCheck: 'passed', emptyDb: 'passed', sampleDb: 'passed', regression: 'pending', rollbackDrill: 'pending' },
        }"
      />
      <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
        <Tag theme="warning" variant="light-outline" size="small">迁移脚本禁止引用应用代码（保证独立执行）</Tag>
        <Tag variant="outline" size="small">部署顺序：先兼容代码后迁移（expand-contract）</Tag>
      </div>
    </div>

    <Dialog :visible="!!rollbackTarget" @visible-change="(v: boolean) => { if (!v) rollbackTarget = null }" header="回滚迁移（危险操作）" width="620px" :confirm-btn="{ content: '确认回滚', theme: 'danger' }" cancel-btn="取消" @confirm="confirmRollback">
      <div v-if="rollbackTarget" class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <RiskBadge level="R4" show-desc />
          <Tag theme="danger" variant="light-outline" size="small">回滚不恢复被覆盖的数据</Tag>
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'ver', label: '迁移版本', value: rollbackTarget.version, mono: true },
          { key: 'name', label: '迁移内容', value: rollbackTarget.name },
          { key: 'forward', label: '前向脚本', value: rollbackTarget.forwardScript, mono: true },
          { key: 'reverse', label: '逆向脚本', value: rollbackTarget.reverseScript ?? '未声明（不可回滚）', mono: true },
          { key: 'consequence', label: '后果', value: rollbackTarget.destructive ? '逆向脚本会重建被删除的列；列内数据无法恢复（回填需重跑）' : '逆向脚本恢复结构；过程中写入的数据可能丢失' },
          { key: 'undo', label: '是否可撤销回滚', value: '可再次前向应用（幂等），但被覆盖数据不可还原' },
          { key: 'approved', label: '原审批人', value: rollbackTarget.approvedBy },
        ]" />
        <div>
          <div class="oc-kv__k" style="margin-bottom: 4px">回滚理由（必填，写入审计并通知变更委员会）</div>
          <Input v-model="rollbackReason" size="small" placeholder="例如：新列读路径存在空值异常，先回滚止血" />
        </div>
        <CliHint :command="`oc persistence migrations rollback --version ${rollbackTarget.version} --reason <reason>`" />
      </div>
    </Dialog>

    <Dialog
      :visible="!!pkgTarget"
      @visible-change="(v: boolean) => { if (!v) pkgTarget = null }"
      :header="`迁移包 · ${pkgTarget?.version ?? ''}`" width="720px" :footer="false"
    >
      <div v-if="pkgTarget && pkgManifest" class="oc-stack" style="gap: 10px">
        <div class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag size="small" :theme="pkgTarget.destructive ? 'danger' : 'default'" variant="light-outline">{{ pkgTarget.destructive ? '破坏性（需审批）' : '非破坏性' }}</Tag>
          <Tag size="small" :theme="pkgTarget.rollbackable ? 'success' : 'default'" variant="light-outline">{{ pkgTarget.rollbackable ? '声明逆向脚本（可回滚）' : '仅前向脚本' }}</Tag>
          <RiskBadge v-if="pkgTarget.destructive" level="R4" show-desc />
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'pkg', label: '包名', value: pkgManifest.package, mono: true },
          { key: 'forward', label: '前向脚本', value: pkgTarget.forwardScript, mono: true },
          { key: 'reverse', label: '逆向脚本', value: pkgTarget.reverseScript ?? '未声明（不可回滚）', mono: true },
          { key: 'backfill', label: '回填步骤', value: pkgTarget.backfillSteps.join('；') || '无', mono: true },
          { key: 'approve', label: '审批', value: pkgTarget.destructive ? `破坏性操作需审批（已批：${pkgTarget.approvedBy}）` : '无需审批' },
        ]" />
        <JsonBlock :mask="false" label="manifest" :value="pkgManifest" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <CliHint :command="`oc persistence migrations package --version ${pkgTarget.version} --download`" label="复制打包命令" />
          <Button size="small" theme="primary" variant="outline" @click="downloadPkg">下载迁移包清单</Button>
        </div>
        <div class="oc-muted" style="font-size: 12px">迁移脚本禁止引用应用代码（保证独立执行）；部署顺序为先兼容代码后迁移（expand-contract）。</div>
      </div>
    </Dialog>
  </div>
</template>
