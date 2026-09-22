<script setup lang="ts">
/**
 * E-07 遗忘与删除：TTL → archived / 软删 / 合规删除（穿透备份）+ 删除证明导出。
 * 合规删除必须穿透「数据库 / 全文索引 / 向量索引 / 召回缓存 / 备份集 / 事件投影」六层，并生成可导出证明（NFR-S-6）。
 * 溯源：卷 10 §4.5 / BUILD-MANIFEST E-07
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import type { MemoryDeletion } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.memory;

const state = ref<UiStateKind>('LOADING');
const levelFilter = ref('all');
const proofOf = ref<MemoryDeletion | null>(null);
const proofOpen = ref(false);
const reason = ref('');

const rows = computed(() => data.deletions.filter((d) => levelFilter.value === 'all' || d.level === levelFilter.value));
const running = computed(() => data.deletions.filter((d) => d.state === 'RUNNING').length);

const LEVEL_META = {
  ttl: { title: 'L1 · TTL 过期', desc: '转 archived：不再召回，仍可查询；由调度器批量执行。', theme: 'default' as const, irreversible: false },
  soft: { title: 'L2 · 用户删除', desc: '软删 + 索引清理：不可召回，界面可查；可申请恢复（窗口内）。', theme: 'warning' as const, irreversible: false },
  compliance: { title: 'L3 · 合规删除', desc: '穿透备份与全部投影：不可恢复，生成删除证明供审计导出。', theme: 'danger' as const, irreversible: true },
};

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function openProof(d: MemoryDeletion) {
  proofOf.value = d;
  proofOpen.value = true;
}

/** 导出删除证明（含时间、范围、执行者与六层穿透记录） */
function exportProof() {
  if (!proofOf.value) return;
  const p = proofOf.value;
  const text = [
    `删除证明 ${p.deletionId}`,
    `级别：${LEVEL_META[p.level].title}`,
    `作用域：${p.scope}`,
    `范围：${p.proof.range}`,
    `执行者：${p.proof.executor}`,
    `时间：${new Date(p.proof.at).toISOString()}`,
    `穿透层：${p.proof.layers.map((l) => `${l.name}=${l.done ? 'DONE' : 'PENDING'}`).join(', ')}`,
    '不可恢复：是（合规删除）',
  ].join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.deletionId}-proof.txt`;
  a.click();
  URL.revokeObjectURL(url);
  MessagePlugin.success('已导出删除证明（可提交审计）');
}

function doComplianceDelete() {
  if (!reason.value.trim()) {
    MessagePlugin.warning('合规删除必须填写理由（审计要求）');
    return;
  }
  MessagePlugin.success('合规删除已受理：将穿透 6 层并生成删除证明，不可恢复');
  reason.value = '';
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="遗忘与删除"
      desc="三级遗忘：TTL 过期归档、用户删除（软删）、合规删除（穿透备份与投影并出证明）。删除不可静默发生——每级都可查、可导出。"
      volume="卷 10"
      manifest="E-07"
      cli="oc memory delete --compliance --id <memoryId> --reason <text>"
      :status="[{ label: '合规删除不可恢复', theme: 'danger' }, { label: running ? `${running} 项执行中` : '无进行中任务', theme: running ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select v-model="levelFilter" size="small" style="width: 150px" :options="[{ label: '全部级别', value: 'all' }, { label: 'TTL 归档', value: 'ttl' }, { label: '软删除', value: 'soft' }, { label: '合规删除', value: 'compliance' }]" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="删除记录" :value="data.deletions.length" unit="条" icon="delete" hint="全部留痕：事件 + 证明" />
      <StatCard label="合规删除" :value="data.deletions.filter((d) => d.level === 'compliance').length" unit="条" icon="secured" hint="不可恢复；证明可导出审计" />
      <StatCard label="执行中" :value="running" unit="项" icon="loading" :lower-is-better="true" hint="穿透层未全部完成前不得声明完成" />
      <StatCard label="已导出证明" :value="data.deletions.filter((d) => d.exported).length" unit="份" icon="download" hint="证明含时间/范围/执行者/六层穿透" />
    </div>

    <StateShell
      :state="state"
      stage="加载删除记录…"
      empty-title="没有删除记录"
      empty-desc="尚未发生 TTL 归档或删除操作；条目过期时会自动进入归档。"
      empty-action="查看即将过期条目"
      example-task="删除误写入的临时约定记忆"
      what="删除记录加载失败"
      why="生命周期事件投影不可读（memory.deleted 事件缺失）。"
      how="可重试；删除操作本身仍在后台执行，可在事件流 V-01 中核对。"
      trace-id="trace-del-9f02ba"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--3">
        <div v-for="(meta, key) in LEVEL_META" :key="key" class="oc-card">
          <h3 class="oc-card__title">
            {{ meta.title }}
            <Tag size="small" :theme="meta.theme" variant="light-outline">{{ meta.irreversible ? '不可恢复' : '可恢复' }}</Tag>
          </h3>
          <p class="oc-secondary" style="font-size: 13px; margin: 0 0 8px">{{ meta.desc }}</p>
          <div class="oc-kv" style="font-size: 12px">
            <span class="oc-kv__k">穿透层</span>
            <span>{{ key === 'ttl' ? '索引 + 召回缓存' : key === 'soft' ? '数据库 + 索引 + 召回缓存' : '全部 6 层（含备份集与事件投影）' }}</span>
            <span class="oc-kv__k">证明</span><span>{{ key === 'compliance' ? '生成并可导出' : '事件留痕' }}</span>
          </div>
          <Popconfirm
            v-if="key === 'compliance'"
            theme="danger"
            content="合规删除将穿透备份与投影且不可恢复；请确认已完成审批留痕。"
            @confirm="doComplianceDelete"
          >
            <div class="oc-flex" style="gap: 8px; margin-top: 10px">
              <Input v-model="reason" size="small" placeholder="合规删除理由（必填，审计要求）" />
              <Button size="small" theme="danger" variant="outline">发起合规删除</Button>
            </div>
          </Popconfirm>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          删除记录与证明
          <span class="oc-muted" style="font-size: 12px">每条记录可导出删除证明（含六层穿透状态）</span>
        </h3>
        <Table
          :data="rows"
          :columns="[
            { colKey: 'deletionId', title: '记录', width: 100 },
            { colKey: 'level', title: '级别', width: 120, cell: 'cell' },
            { colKey: 'scope', title: '作用域', width: 90 },
            { colKey: 'target', title: '范围', cell: 'cell' },
            { colKey: 'state', title: '状态', width: 100, cell: 'cell' },
            { colKey: 'executor', title: '执行者', width: 160, cell: 'cell' },
            { colKey: 'op', title: '证明', width: 130, cell: 'cell' },
          ]"
          row-key="deletionId"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'level'">
              <Tag size="small" :theme="LEVEL_META[row.level as 'ttl' | 'soft' | 'compliance'].theme" variant="light-outline">
                {{ row.level === 'ttl' ? 'TTL 归档' : row.level === 'soft' ? '软删除' : '合规删除' }}
              </Tag>
            </template>
            <template v-else-if="col.colKey === 'state'">
              <Tag size="small" :theme="row.state === 'DONE' ? 'success' : 'warning'">{{ row.state === 'DONE' ? '已完成' : '执行中' }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'executor'">
              <span class="oc-mono" style="font-size: 12px">{{ row.proof.executor }}</span>
            </template>
            <template v-else-if="col.colKey === 'target'">
              <span>{{ row.target }}</span>
              <div class="oc-muted" style="font-size: 11px">{{ row.proof.range }} · {{ new Date(row.proof.at).toLocaleString('zh-CN') }}</div>
            </template>
            <template v-else-if="col.colKey === 'op'">
              <Button size="small" variant="text" @click="openProof(row)">查看证明</Button>
              <Button v-if="row.exported" size="small" variant="text" @click="openProof(row)">导出</Button>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <Dialog v-model:visible="proofOpen" header="删除证明" :width="560" :footer="false">
        <div v-if="proofOf" class="oc-stack">
          <div class="oc-flex" style="gap: 8px">
            <OcIcon name="secured" size="16px" />
            <b>{{ proofOf.deletionId }} · {{ LEVEL_META[proofOf.level].title }}</b>
            <Tag size="small" :theme="proofOf.level === 'compliance' ? 'danger' : 'warning'" variant="light-outline">
              {{ proofOf.level === 'compliance' ? '不可恢复' : '可恢复' }}
            </Tag>
          </div>
          <div class="oc-kv">
            <span class="oc-kv__k">范围</span><span>{{ proofOf.proof.range }}</span>
            <span class="oc-kv__k">执行者</span><span>{{ proofOf.proof.executor }}</span>
            <span class="oc-kv__k">时间</span><span>{{ new Date(proofOf.proof.at).toLocaleString('zh-CN') }}</span>
            <span class="oc-kv__k">作用域</span><span>{{ proofOf.scope }}</span>
          </div>
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 6px">穿透层（全部完成才可声明删除完成）</div>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag v-for="l in proofOf.proof.layers" :key="l.name" size="small" :theme="l.done ? 'success' : 'warning'" variant="light-outline">
                {{ l.name }} · {{ l.done ? '已穿透' : '待穿透' }}
              </Tag>
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Button theme="primary" variant="outline" @click="exportProof"><OcIcon name="download" size="12px" /> 导出证明</Button>
            <Button variant="text" @click="proofOpen = false">关闭</Button>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
