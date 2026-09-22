<script setup lang="ts">
/**
 * Z-10 对象存储治理。
 * 三类命名空间（media / artifacts / snapshots）+ 引用计数 + 冷热分层 + 去重率 + 加密；
 * 孤儿候选显式标注（引用计数为 0），不自动删除，需人工确认。
 * 溯源：卷 19 D-PERS-12；BUILD-MANIFEST Z-10。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import { platformData, humanBytes } from '@/mock/data/platform';
import type { ObjectNamespace } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const active = ref<ObjectNamespace>(platformData.persistence.objectStore[1]);
const gcOpen = ref(false);

const namespaces = computed(() => platformData.persistence.objectStore);
const totalBytes = computed(() => namespaces.value.reduce((a, n) => a + n.bytes, 0));
const avgDedup = computed(() => namespaces.value.reduce((a, n) => a + n.dedupRatio, 0) / namespaces.value.length);

const columns = [
  { colKey: 'namespace', title: '命名空间', width: 130, cell: 'ns' },
  { colKey: 'objects', title: '对象数', width: 110, cell: 'num' },
  { colKey: 'bytes', title: '总字节', width: 120, cell: 'bytes' },
  { colKey: 'hotBytes', title: '热层', width: 120, cell: 'hot' },
  { colKey: 'coldBytes', title: '冷层', width: 120, cell: 'cold' },
  { colKey: 'dedupRatio', title: '去重率', width: 170, cell: 'dedup' },
  { colKey: 'refCounted', title: '引用计数', width: 110, cell: 'ref' },
  { colKey: 'encrypted', title: '加密', width: 100, cell: 'enc' },
  { colKey: 'orphanCandidates', title: '孤儿候选', width: 110, cell: 'orphan' },
];

const hotCold = computed(() => [
  { name: '热层', value: Math.round(namespaces.value.reduce((a, n) => a + n.hotBytes, 0) / 1024 ** 3) },
  { name: '冷层', value: Math.round(namespaces.value.reduce((a, n) => a + n.coldBytes, 0) / 1024 ** 3) },
]);

onMounted(() => {
  window.setTimeout(() => (demo.value = namespaces.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="对象存储治理"
      desc="大对象与媒体不与数据库混存：三类命名空间 + 内容寻址 + 引用计数 + 冷热分层 + 去重 + 加密；孤儿对象只标记不自动删除。"
      volume="卷 19" manifest="Z-10" cli="oc persistence object-store stats --namespaces media,artifacts,snapshots"
      :status="[{ label: `去重率 ${(avgDedup * 100).toFixed(0)}%`, theme: 'success' }, { label: '默认加密', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Button size="small" theme="danger" variant="outline" @click="gcOpen = true">清理孤儿对象</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="对象存储总字节" :value="totalBytes" format="token" unit="B" icon="cloud" hint="三类命名空间合计（跨区复制）" />
      <StatCard label="平均去重率" :value="avgDedup * 100" format="percent" icon="layers" hint="内容寻址 + 增量块复用；快照目标 ≥60%" />
      <StatCard label="孤儿候选" :value="namespaces.reduce((a, n) => a + n.orphanCandidates, 0)" icon="bug" hint="引用计数为 0，仅标记，人工确认后清理" />
      <StatCard label="加密覆盖率" :value="(namespaces.filter((n) => n.encrypted).length / namespaces.length) * 100" format="percent" icon="lock" hint="服务端加密 + KMS 托管密钥" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">冷热分层（GB）</h3>
        <OcChart type="donut" :height="200" :values="hotCold" unit="GB" aria-label="冷热分层" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag size="small" variant="outline">生命周期：热层超期自动转冷；冷层读取延迟升高但成本显著下降</Tag>
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          命名空间：{{ active.namespace }}
          <CliHint :command="`oc persistence object-store describe --namespace ${active.namespace}`" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'objects', label: '对象数', value: `${active.objects.toLocaleString('zh-CN')}` },
          { key: 'bytes', label: '总字节', value: humanBytes(active.bytes) },
          { key: 'dedup', label: '去重率', value: `${(active.dedupRatio * 100).toFixed(1)}%` },
          { key: 'ref', label: '引用计数', value: active.refCounted ? '启用（计数为 0 才可清理）' : '未启用', tag: { text: active.refCounted ? '启用' : '未启用', theme: active.refCounted ? 'success' : 'warning' } },
          { key: 'life', label: '生命周期', value: active.lifecycle },
          { key: 'enc', label: '加密', value: active.encrypted ? '服务端加密（KMS 托管密钥，轮换 90 天）' : '未加密' },
        ]" />
        <Progress :percentage="Math.round(active.dedupRatio * 100)" theme="line" style="margin-top: 10px" />
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在统计引用计数与分层字节…"
      empty-title="没有对象存储数据" empty-desc="该实例使用本地文件系统实现（local 形态），对象存储统计不可用。"
      empty-action="查看本地存储路径" example-task="把 snapshots 命名空间超期未引用块回收，观察去重率变化"
      what="对象存储统计读取失败" why="对象存储管理接口超时（跨区复制占用带宽）"
      how="重试；统计为只读，不影响读写主链路" trace-id="trace-b11d6e42"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="namespaces" :columns="columns" row-key="namespace" size="small" :pagination="undefined">
        <template #ns="{ row }">
          <Button size="small" variant="text" @click="active = row as ObjectNamespace">{{ row.namespace }}</Button>
        </template>
        <template #num="{ row }">{{ row.objects.toLocaleString('zh-CN') }}</template>
        <template #bytes="{ row }">{{ humanBytes(row.bytes) }}</template>
        <template #hot="{ row }">{{ humanBytes(row.hotBytes) }}</template>
        <template #cold="{ row }">{{ humanBytes(row.coldBytes) }}</template>
        <template #dedup="{ row }"><Progress :percentage="Math.round(row.dedupRatio * 100)" theme="line" size="small" /></template>
        <template #ref="{ row }">
          <Tag :theme="row.refCounted ? 'success' : 'warning'" size="small" variant="light-outline">{{ row.refCounted ? '启用' : '未启用' }}</Tag>
        </template>
        <template #enc="{ row }">
          <Tag :theme="row.encrypted ? 'success' : 'danger'" size="small" variant="light-outline">{{ row.encrypted ? '加密' : '未加密' }}</Tag>
        </template>
        <template #orphan="{ row }">
          <Tag v-if="row.orphanCandidates" theme="warning" size="small" variant="light-outline">{{ row.orphanCandidates }}</Tag>
          <span v-else class="oc-muted">0</span>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="gcOpen" header="清理孤儿对象（危险操作）" width="600px" :confirm-btn="{ content: '确认清理', theme: 'danger' }" cancel-btn="取消" @confirm="gcOpen = false; MessagePlugin.success('已提交清理：仅删除引用计数为 0 且超过 30 天的对象；清理前生成清单并保留 7 天')">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <RiskBadge level="R4" show-desc />
          <Tag theme="danger" variant="light-outline" size="small">清理后不可恢复</Tag>
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'target', label: '清理目标', value: `孤儿候选 ${namespaces.reduce((a, n) => a + n.orphanCandidates, 0)} 个（引用计数 0 且超 30 天）` },
          { key: 'guard', label: '护栏', value: '清理前生成对象清单并保留 7 天（可从清单恢复引用关系）；快照未引用块单独确认' },
          { key: 'lost', label: '丢失清单', value: '孤儿对象本体（若曾被误删引用则无法还原内容）' },
          { key: 'undo', label: '是否可撤销', value: '7 天内可从清理清单恢复（仅引用关系，若对象已物理删除则不可）' },
        ]" />
      </div>
    </Dialog>
  </div>
</template>
