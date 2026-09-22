<script setup lang="ts">
/**
 * O-07 工作区快照管理。
 * 内容寻址增量快照：来源 / 时间 / 大小 / 去重率 / 引用计数 / TTL 14 天 / 恢复粒度；
 * 恢复是写操作（会覆盖当前文件），删除快照需确认（引用计数 > 0 时禁止删除）。
 * 溯源：卷 20 D-WS-7 / 卷 19 D-PERS-6；BUILD-MANIFEST O-07。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Popconfirm, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData, humanBytes } from '@/mock/data/platform';
import type { WsSnapshot } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const wsId = ref('ws-0001');
const restoreTarget = ref<WsSnapshot | null>(null);
const granularity = ref<'全量' | '单文件' | '目录'>('单文件');
const targetPath = ref('src/reconcile/ledger.ts');

const ws = computed(() => platformData.workspaces.find((w) => w.workspaceId === wsId.value) ?? platformData.workspaces[0]);
/** 快照清单以局部 ref 渲染：立即快照后列表与统计需即时更新（切换工作区时重新指向该工作区快照） */
const snapshots = ref<WsSnapshot[]>(ws.value.snapshots);
watch(wsId, () => { snapshots.value = ws.value.snapshots; });
const totalBytes = computed(() => snapshots.value.reduce((a, s) => a + s.sizeBytes, 0));
const avgDedup = computed(() => (snapshots.value.length ? snapshots.value.reduce((a, s) => a + s.dedupRatio, 0) / snapshots.value.length : 0));

const columns = [
  { colKey: 'snapshotId', title: '快照', width: 120, cell: 'id' },
  { colKey: 'source', title: '来源', ellipsis: true },
  { colKey: 'at', title: '创建时间', width: 160, cell: 'at' },
  { colKey: 'sizeBytes', title: '大小', width: 110, cell: 'size' },
  { colKey: 'dedupRatio', title: '去重率', width: 160, cell: 'dedup' },
  { colKey: 'refCount', title: '引用计数', width: 110 },
  { colKey: 'restoreGranularity', title: '恢复粒度', width: 130, cell: 'gran' },
  { colKey: 'op', title: '操作', width: 140, cell: 'op' },
];

function doRestore() {
  MessagePlugin.success(`已恢复：${restoreTarget.value?.snapshotId} → ${granularity.value}（${targetPath.value}）；恢复前对当前状态再做一次快照，可回滚`);
  restoreTarget.value = null;
}

/** 立即快照：新增一条内容寻址增量快照（时间 / 大小 / 发起人），插入列表顶部并更新统计 */
function takeSnapshot() {
  const list = snapshots.value;
  // 快照编号沿用「sn-工作区序号 + 序号」口径，与既有快照一致
  const wsIndex = platformData.workspaces.indexOf(ws.value) + 1;
  const record: WsSnapshot = {
    snapshotId: `sn-${String(wsIndex).padStart(2, '0')}${String(list.length + 1).padStart(2, '0')}`,
    source: '手动快照（控制台，发起人：顾清和）',
    at: new Date().toISOString(),
    sizeBytes: 74 * 1024 * 1024,
    // 增量快照：本次仅改动块入存储，去重率取上次与 0.8 的较高值（演示用确定性口径）
    dedupRatio: Math.max(list[0]?.dedupRatio ?? 0.6, 0.8),
    refCount: 1,
    ttlDays: 14,
    restoreGranularity: '会话级',
  };
  list.unshift(record);
  MessagePlugin.success(`已创建快照 ${record.snapshotId}（${humanBytes(record.sizeBytes)}，发起人：顾清和，TTL 14 天）：快照总数 ${list.length}、占用 ${humanBytes(totalBytes.value)}；可随时按全量 / 单文件 / 目录恢复`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.workspaces.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工作区快照"
      desc="快照 = 清单（文件 → 内容哈希）+ 去重内容存储；与 Git 状态解耦，可保存未提交状态；恢复支持全量/单文件/目录，粒度可选。"
      volume="卷 20" manifest="O-07" :cli="`oc workspace snapshot list --id ${ws.workspaceId} && oc workspace snapshot restore --id ${ws.workspaceId} --snapshot ${snapshots[0]?.snapshotId ?? ''}`"
      :status="[{ label: `TTL 14 天`, theme: 'default' }, { label: `平均去重 ${(avgDedup * 100).toFixed(0)}%`, theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="wsId" size="small" style="width: 230px" aria-label="选择工作区">
          <Option v-for="w in platformData.workspaces" :key="w.workspaceId" :value="w.workspaceId" :label="w.name" />
        </Select>
        <Button size="small" theme="primary" @click="takeSnapshot">立即快照</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="快照数量" :value="snapshots.length" icon="layers" hint="内容寻址增量，重复内容不重复存储" />
      <StatCard label="占用字节" :value="totalBytes" format="token" unit="B" icon="database" hint="含未引用块（超 TTL 自动回收）" />
      <StatCard label="平均去重率" :value="avgDedup * 100" format="percent" icon="discount" :target="60" hint="DoD 目标 ≥ 60%" />
      <StatCard label="被引用快照" :value="snapshots.filter((s) => s.refCount > 1).length" icon="link" hint="引用计数 > 1 时禁止删除" />
    </div>

    <StateShell
      :state="demo" stage="正在读取快照清单与引用计数…"
      empty-title="该工作区没有快照" empty-desc="尚未创建过快照；检查点与工具调用前会自动快照（可丢弃）。"
      empty-action="立即创建快照" example-task="在破坏性改动前手动快照，出错后单文件恢复"
      what="快照清单读取失败" why="对象存储清单接口超时（去重块索引正在重建）"
      how="可重试；快照本体未受影响，仅列表不可读" trace-id="trace-d99b1f76"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="snapshots" :columns="columns" row-key="snapshotId" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.snapshotId }}</span></template>
        <template #at="{ row }"><span class="oc-muted">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #size="{ row }">{{ humanBytes(row.sizeBytes) }}</template>
        <template #dedup="{ row }"><Progress :percentage="Math.round(row.dedupRatio * 100)" theme="line" size="small" /></template>
        <template #gran="{ row }">
          <Tag theme="primary" size="small" variant="light-outline">{{ row.restoreGranularity }}</Tag>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="restoreTarget = row as WsSnapshot">恢复</Button>
          <Popconfirm
            :theme="row.refCount > 1 ? 'danger' : 'warning'"
            :confirm-btn="{ content: '删除快照', theme: 'danger' }" cancel-btn="取消"
            @confirm="MessagePlugin.success(`已删除 ${row.snapshotId}（未引用块随生命周期回收；不可撤销）`)"
          >
            <template #content>
              <div style="max-width: 320px">
                <div v-if="row.refCount > 1">该快照被 {{ row.refCount }} 处引用（检查点/任务）：删除会导致引用缺失，需先解除引用。</div>
                <div v-else>后果：删除快照元数据，未引用内容块由生命周期回收。</div>
                <div>是否可撤销：不可撤销（需重新创建）。</div>
              </div>
            </template>
            <Button size="small" variant="text" theme="danger" :disabled="row.refCount > 1">删除</Button>
          </Popconfirm>
        </template>
      </Table>
    </StateShell>

    <Dialog :visible="!!restoreTarget" @visible-change="(v: boolean) => { if (!v) restoreTarget = null }" header="恢复快照（写操作）" width="620px" :confirm-btn="{ content: '确认恢复', theme: 'primary' }" cancel-btn="取消" @confirm="doRestore">
      <div v-if="restoreTarget" class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <RiskBadge level="R1" show-desc />
          <Tag theme="warning" variant="light-outline" size="small">恢复前自动对当前状态再快照</Tag>
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'snap', label: '快照', value: `${restoreTarget.snapshotId}（${humanBytes(restoreTarget.sizeBytes)}，去重率 ${(restoreTarget.dedupRatio * 100).toFixed(0)}%）` },
          { key: 'scope', label: '恢复范围', value: '所选粒度内的文件；范围外文件保持不变' },
          { key: 'effect', label: '后果', value: '范围内文件的当前内容被快照内容覆盖（未提交改动会丢失，但已在恢复前快照中保留）' },
          { key: 'undo', label: '是否可撤销', value: '可撤销：用恢复前快照回滚到恢复前状态' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Select v-model="granularity" size="small" style="width: 150px" aria-label="恢复粒度">
            <Option value="全量" label="全量" />
            <Option value="单文件" label="单文件" />
            <Option value="目录" label="目录" />
          </Select>
          <Input v-model="targetPath" size="small" style="width: 320px" placeholder="目标路径（单文件/目录时必填）" />
        </div>
        <CliHint :command="`oc workspace snapshot restore --id ${ws.workspaceId} --snapshot ${restoreTarget.snapshotId} --path ${targetPath}`" />
      </div>
    </Dialog>
  </div>
</template>
