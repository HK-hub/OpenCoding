<script setup lang="ts">
/** 快照管理（B-05）：触发源/范围/大小/去重率/TTL/引用计数 + 创建 + 四种恢复粒度。溯源：卷 07 D-SBOX-10 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Popconfirm, RadioButton, RadioGroup, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { Snapshot } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { snapshots } = toolData;

type Granularity = '会话级' | '任务级' | '单文件' | '单工具调用';

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const triggerFilter = ref('');
const pageSize = ref(10);
const restoreTarget = ref<Snapshot | null>(null);
const granularity = ref<Granularity>('任务级');
const restoreOpen = ref(false);
const err = ref(makeError('CONFLICT', '恢复被拒绝：工作区存在未提交的写入（需先建立当前快照）'));

const rows = computed(() => snapshots.filter((s) => !triggerFilter.value || s.trigger === triggerFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const protectedCount = computed(() => snapshots.filter((s) => s.protectedByRef).length);
const totalBytes = computed(() => snapshots.reduce((a, s) => a + s.sizeBytes, 0));
const avgDedup = computed(() => Number(((snapshots.reduce((a, s) => a + s.dedupRatio, 0) / snapshots.length) * 100).toFixed(1)));

const columns = [
  { colKey: 'snapshotId', title: '快照', width: 120 },
  { colKey: 'trigger', title: '触发源', width: 160 },
  { colKey: 'scope', title: '范围', width: 120 },
  { colKey: 'files', title: '文件数', width: 90 },
  { colKey: 'sizeBytes', title: '大小', width: 110 },
  { colKey: 'dedupRatio', title: '去重率', width: 100 },
  { colKey: 'refCount', title: '引用计数', width: 120 },
  { colKey: 'ttlDays', title: 'TTL', width: 86 },
  { colKey: 'createdAt', title: '创建时间', width: 170 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function openRestore(s: Snapshot) {
  restoreTarget.value = s;
  granularity.value = s.restoreGranularities.includes('任务级') ? '任务级' : s.restoreGranularities[0];
  restoreOpen.value = true;
}

function doRestore() {
  if (!restoreTarget.value) return;
  MessagePlugin.success(`已按「${granularity.value}」粒度恢复（恢复前已自动建立当前状态快照，可再次回滚）`);
  restoreOpen.value = false;
}

function createSnapshot() {
  MessagePlugin.success('已创建快照（会话级，增量去重）：内容寻址 + 忽略构建产物');
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="快照管理"
      desc="内容寻址增量快照（仅变更文件 + 元数据，大对象去重）：触发源为轮次结束 / 高风险动作前 / 进入计划模式前 / 用户显式请求；恢复粒度四级。"
      volume="卷 07"
      manifest="B-05"
      cli="oc sandbox snapshot list --protect --with-refcount"
      :status="[{ label: `受保护 ${protectedCount}`, theme: 'success' }, { label: `总量 ${(totalBytes / 1024 / 1024).toFixed(1)} MB`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="createSnapshot">创建快照</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="快照数" :value="snapshots.length" format="raw" icon="file-copy" />
      <StatCard label="存储占用" :value="Number((totalBytes / 1024 / 1024).toFixed(1))" unit="MB" format="raw" icon="layers" hint="增量去重后实际占用" />
      <StatCard label="平均去重率" :value="avgDedup" format="percent" icon="discount" :target="60" target-kind="min" />
      <StatCard label="引用计数保护" :value="protectedCount" format="raw" icon="secured" hint="被会话 / 任务引用的快照不会被 TTL 清理" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <RadioGroup v-model="triggerFilter" size="small" @change="refresh">
        <RadioButton value="">全部</RadioButton>
        <RadioButton value="每轮次结束">每轮次结束</RadioButton>
        <RadioButton value="执行高风险动作前">高风险动作前</RadioButton>
        <RadioButton value="进入计划模式前">进入计划模式前</RadioButton>
        <RadioButton value="用户显式请求">用户显式请求</RadioButton>
      </RadioGroup>
      <CliHint command="oc sandbox snapshot restore SNAP-4412 --granularity file --dry-run" label="干跑恢复" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有快照"
      empty-desc="近期未创建快照。建议在进入计划模式或执行高风险动作前启用自动快照（默认开启）。"
      empty-action="清空筛选"
      example-task="在高风险删除前创建快照并验证可恢复"
      :what="'恢复失败：工作区状态冲突'"
      :why="err.message"
      how="恢复前请先提交或建立当前状态快照（避免丢失未提交改动）；恢复本身可再次回滚。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 个快照，已折叠展示前 ${pageSize} 个`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="triggerFilter = ''; refresh()"
    >
      <Table row-key="snapshotId" size="small" :data="shown" :columns="columns">
        <template #snapshotId="{ row }"><CopyableId :id="row.snapshotId" label="复制" :short="12" /></template>
        <template #trigger="{ row }"><Tag size="small" variant="light-outline" :theme="row.trigger.includes('高风险') ? 'warning' : 'default'">{{ row.trigger }}</Tag></template>
        <template #scope="{ row }"><Tag size="small" variant="light-outline">{{ row.scope }}</Tag></template>
        <template #sizeBytes="{ row }">{{ (row.sizeBytes / 1024 / 1024).toFixed(2) }} MB</template>
        <template #dedupRatio="{ row }">
          <Tooltip content="去重率 = 1 - 实际存储 / 原始内容；大对象按内容寻址共享">
            <Tag size="small" variant="light-outline" :theme="row.dedupRatio > 0.7 ? 'success' : 'default'">{{ (row.dedupRatio * 100).toFixed(0) }}%</Tag>
          </Tooltip>
        </template>
        <template #refCount="{ row }">
          <div class="oc-flex" style="gap: 4px">
            <Tag size="small" variant="outline" theme="default">{{ row.refCount }}</Tag>
            <Tooltip v-if="row.protectedByRef" content="引用计数 > 0：受保护，不随 TTL 清理（防止恢复能力被误删）">
              <Tag size="small" theme="success" variant="light-outline">受保护</Tag>
            </Tooltip>
          </div>
        </template>
        <template #createdAt="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">恢复与保护操作</h3>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <div v-for="s in shown" :key="s.snapshotId" class="oc-flex" style="gap: 6px">
            <span class="oc-mono" style="font-size: 12px">{{ s.snapshotId }}</span>
            <Button size="small" variant="text" @click="openRestore(s)">恢复</Button>
            <Popconfirm
              v-if="s.refCount === 0"
              theme="danger"
              :content="`清理 ${s.snapshotId}：不可撤销（该快照引用计数为 0）。恢复能力将丢失，需重新执行以重建。确认清理？`"
              @confirm="MessagePlugin.warning(`已清理 ${s.snapshotId}（引用计数为 0，无引用方受影响）`)"
            >
              <Button size="small" variant="text" theme="danger">清理</Button>
            </Popconfirm>
            <Tooltip v-else content="引用计数 > 0（被会话/任务引用）：禁止清理，需先解除引用（这是保护机制，不是缺陷）">
              <Tag size="small" variant="light-outline" theme="success">受保护</Tag>
            </Tooltip>
          </div>
        </div>
        <div class="oc-divider" />
        <InfoGrid :columns="2" :items="[
          { key: 'g1', label: '会话级', value: '恢复整个会话范围内的工作区内容（重放基础）' },
          { key: 'g2', label: '任务级', value: '仅恢复当前任务涉及的文件集合' },
          { key: 'g3', label: '单文件', value: '精确恢复某一文件（用于修错）' },
          { key: 'g4', label: '单工具调用', value: '恢复某次工具调用的前状态（含前后哈希比对）' },
          { key: 't1', label: '与 Git 关系', value: '快照独立于 Git（可覆盖未提交状态）；Git 提交作为语义化检查点补充' },
          { key: 't2', label: 'TTL 与保护', value: '默认 14 天或随会话生命周期（取长者）；引用计数 > 0 时受保护' },
        ]" />
      </div>
    </StateShell>

    <Dialog v-model:visible="restoreOpen" :header="`恢复快照 ${restoreTarget?.snapshotId ?? ''}`" width="580px" :on-confirm="doRestore" :on-cancel="() => (restoreOpen = false)">
      <div class="oc-stack">
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 6px">恢复粒度（受该快照支持范围限制）</div>
          <RadioGroup v-model="granularity" size="small">
            <RadioButton v-for="g in (restoreTarget?.restoreGranularities ?? [])" :key="g" :value="g">{{ g }}</RadioButton>
          </RadioGroup>
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'scope', label: '快照范围 / 文件数', value: `${restoreTarget?.scope ?? ''} · ${restoreTarget?.files ?? 0} 个文件` },
          { key: 'size', label: '恢复数据量', value: `${((restoreTarget?.sizeBytes ?? 0) / 1024 / 1024).toFixed(2)} MB（去重后）` },
          { key: 'protect', label: '保护状态', value: restoreTarget?.protectedByRef ? '受引用保护（不会被 TTL 清理）' : '未受保护（按 TTL 清理）' },
        ]" />
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：恢复会<b>覆盖</b>目标范围内的工作区文件（未包含在快照中的文件保持现状）。
          可逆：恢复前会自动建立「当前状态快照」，可再次回滚；恢复动作写入审计（含粒度与文件清单）。
        </p>
      </div>
    </Dialog>
  </div>
</template>
