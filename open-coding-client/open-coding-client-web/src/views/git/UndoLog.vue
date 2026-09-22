<script setup lang="ts">
/**
 * I-10 操作日志与撤销。
 * `oc git undo` 基于操作日志与临时引用（oc/backup/<ts>）恢复；日志默认保留 30 天，
 * 过期条目显式标注（不可再恢复）。恢复本身是可撤销动作（恢复前再次建引用）。
 * 溯源：卷 21 D-GIT-7/§4.4；BUILD-MANIFEST I-10。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Option, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { platformData } from '@/mock/data/platform';
import type { UndoLogEntry } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const statusFilter = ref('');
const active = ref<UndoLogEntry>(platformData.git.undoLog[0]);

const log = computed(() => platformData.git.undoLog);
const rows = computed(() => (statusFilter.value ? log.value.filter((l) => l.status === statusFilter.value) : log.value));
const available = computed(() => log.value.filter((l) => l.status === 'AVAILABLE').length);

const columns = [
  { colKey: 'id', title: '记录', width: 100, cell: 'id' },
  { colKey: 'performedAt', title: '执行时间', width: 180, cell: 'at' },
  { colKey: 'restoredFrom', title: '恢复来源（临时引用）', width: 260, cell: 'ref' },
  { colKey: 'affected', title: '恢复内容', ellipsis: true },
  { colKey: 'ttlDays', title: '保留期', width: 110, cell: 'ttl' },
  { colKey: 'status', title: '状态', width: 120, cell: 'status' },
  { colKey: 'op', title: '操作', width: 120, cell: 'op' },
];

function undo(entry: UndoLogEntry) {
  MessagePlugin.success(`已执行 oc git undo --ref ${entry.restoredFrom}：${entry.affected}（恢复前已为当前 HEAD 再建引用，可再次回退）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = log.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="操作日志与撤销"
      desc="每次危险操作自动建临时引用 oc/backup/<ts>，oc git undo 按引用恢复；日志保留 30 天，过期条目标注为不可恢复（不静默失效）。"
      volume="卷 21" manifest="I-10" cli="oc git undo --list && oc git undo --ref oc/backup/20260921T0602"
      :status="[{ label: `可恢复 ${available}`, theme: available ? 'success' : 'default' }, { label: '保留 30 天', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="statusFilter" size="small" style="width: 140px" clearable placeholder="状态" aria-label="状态">
          <Option value="" label="全部状态" />
          <Option value="AVAILABLE" label="AVAILABLE" />
          <Option value="EXPIRED" label="EXPIRED" />
        </Select>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="操作记录" :value="log.length" icon="history" hint="危险操作 + 撤销动作都留痕" />
      <StatCard label="可恢复" :value="available" icon="refresh" hint="临时引用仍在保留期内" />
      <StatCard label="已过期" :value="log.filter((l) => l.status === 'EXPIRED').length" icon="time" hint="过期后仅能从打包备份恢复" />
      <StatCard label="保留期" :value="30" unit="天" icon="calendar" hint="可配置（企业可延长）" />
    </div>

    <StateShell
      :state="demo" stage="正在读取操作日志与临时引用…"
      empty-title="没有撤销记录" empty-desc="尚未执行过 oc git undo；危险操作本身也会记录在此（含其备份引用）。"
      empty-action="查看危险操作护栏" example-task="执行 reset --hard 后用 oc git undo 恢复两个丢失提交"
      what="操作日志读取失败" why="reflog 索引不可读（仓库正在进行 gc，packed 引用重建）"
      how="可重试；gc 完成后自动恢复可读（gc 期间不执行撤销以免状态错位）" trace-id="trace-b99d00bb"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.id }}</span></template>
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.performedAt).toLocaleString('zh-CN') }}</span></template>
        <template #ref="{ row }"><span class="oc-mono oc-truncate">{{ row.restoredFrom }}</span></template>
        <template #ttl="{ row }">{{ row.ttlDays }} 天</template>
        <template #status="{ row }">
          <Tag :theme="row.status === 'AVAILABLE' ? 'success' : 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" :disabled="row.status === 'EXPIRED'" @click="active = row as UndoLogEntry">查看</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          撤销详情：{{ active.id }}
          <CopyableId :id="active.restoredFrom" label="复制引用" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'cmd', label: '撤销命令', value: active.command, mono: true },
          { key: 'performed', label: '执行时间', value: new Date(active.performedAt).toLocaleString('zh-CN') },
          { key: 'ref', label: '恢复来源', value: active.restoredFrom, mono: true },
          { key: 'affect', label: '恢复内容', value: active.affected },
          { key: 'ttl', label: '保留期', value: `${active.ttlDays} 天（过期后不再可从引用恢复）` },
          { key: 'semantics', label: '撤销语义', value: '恢复引用指向的提交与文件；不重写历史（远端已推送的提交需另行强推，走 I-09 护栏）' },
        ]" />
        <div class="oc-flex" style="margin-top: 8px">
          <Popconfirm theme="warning" :confirm-btn="{ content: '执行撤销', theme: 'primary' }" cancel-btn="取消" @confirm="undo(active)">
            <template #content>
              <div style="max-width: 340px">
                <div>后果：工作区与该引用指向的状态同步；当前未提交改动会保留在 stash 中。</div>
                <div>是否可撤销：可再次回退（撤销前会为当前 HEAD 再建一个引用）。</div>
              </div>
            </template>
            <Button size="small" theme="primary" :disabled="active.status === 'EXPIRED'">执行 oc git undo</Button>
          </Popconfirm>
          <CliHint :command="active.command" />
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">撤销能力边界</h3>
        <InfoGrid :columns="1" :items="[
          { key: 'scope', label: '可撤销范围', value: 'reset --hard / 强推 / 删除分支或 tag / 丢弃未提交改动 / amend / rebase 已推送' },
          { key: 'limit', label: '不可撤销', value: 'clean -fd 删除的未跟踪文件（未纳入备份引用）；已物理删除的远端对象' },
          { key: 'remote', label: '远端影响', value: '本地可恢复；远端需再次推送（如已强推且远端 gc，可能无法恢复）' },
          { key: 'audit', label: '审计', value: '撤销动作本身写入 git.undo.performed 事件并关联原操作' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">过期条目仍可尝试从打包备份恢复（需人工审批）</Tag>
        </div>
      </div>
    </div>
  </div>
</template>
