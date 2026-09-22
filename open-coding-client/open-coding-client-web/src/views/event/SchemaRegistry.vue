<script setup lang="ts">
/**
 * V-03 事件 Schema 目录（Schema Registry）。
 * 声明式定义 + 版本 + 兼容性策略（新增可选字段兼容；删除/改义需新版本）+ 被拒 Schema 记录。
 * 溯源：卷 16 D-EVT-2/§4.2；BUILD-MANIFEST V-03。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, Input, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { EventEnvelope } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const keyword = ref('');
const compat = ref('');
const detail = ref<EventEnvelope | null>(null);
const rejectedOpen = ref(false);

interface SchemaRow {
  type: string;
  category: string;
  version: number;
  versions: number[];
  events: number;
  keys: string[];
  schemaRef: string;
  compatRule: string;
  status: 'active' | 'deprecated';
  definition: string;
}

/** 由事件流反推 Schema 目录（同一类型的最高版本为当前生效版本） */
const schemas = computed<SchemaRow[]>(() => {
  const map = new Map<string, EventEnvelope[]>();
  platformData.events.forEach((e) => {
    map.set(e.type, [...(map.get(e.type) ?? []), e]);
  });
  return [...map.entries()].map(([type, list]) => {
    const latest = list.reduce((a, b) => (a.version >= b.version ? a : b));
    const versions = [...new Set(list.map((e) => e.version))].sort((a, b) => b - a);
    return {
      type,
      category: latest.category,
      version: latest.version,
      versions,
      events: list.length,
      keys: Object.keys(latest.payload).slice(0, 6),
      schemaRef: latest.schemaRef,
      compatRule: versions.length > 1 ? '向后兼容（新增可选字段）；删除/改义需新版本' : '初始版本（v1）',
      status: type.startsWith('system.eventlog') ? 'active' : latest.sensitivity === 'sensitive' ? 'active' : 'active',
      definition: [
        `# schema://oc/${type.replace(/\./g, '/')}@v${latest.version}`,
        'type: object',
        'required: [eventId, type, version, category, tenantId, projectId, partitionKey, seq, occurredAt, recordedAt, actor, trace, correlationId, payload, sensitivity, schemaRef]',
        'properties:',
        ...Object.keys(latest.payload).map((k) => `  ${k}: { type: ${typeof latest.payload[k] === 'number' ? 'number' : 'string'}, optional: false }`),
        'evolution: { addOptional: allow, remove: newVersion, changeSemantics: newVersion }',
      ].join('\n'),
    };
  });
});

/** 被拒 Schema（CI 兼容性校验未通过，禁止合入） */
const REJECTED = [
  {
    type: 'workitem.state.changed', version: 4, at: '2026-09-20T14:22:00Z', by: '顾清和（工作对象域）',
    reason: '把 acceptance 字段由可选改为必填——对已有消费者是破坏性变更', fix: '保持 v3 兼容读取，新增 v4 并把必填校验推迟一个版本',
  },
  {
    type: 'tool.call.completed', version: 3, at: '2026-09-18T09:40:00Z', by: '秦越人（工具域）',
    reason: '删除 argsDigest 字段（需新版本，且必须保留旧版本可解析）', fix: '保留字段并标记 deprecated，v4 中移除并公告兼容期 90 天',
  },
  {
    type: 'permission.decision', version: 5, at: '2026-09-15T20:10:00Z', by: '贺清尘（合规）',
    reason: 'policyVersion 语义由「策略 ID」改为「策略 ID + 版本号」，改义未升大版本', fix: '新增 policyRevision 字段，保持 policyVersion 语义不变',
  },
];

const rows = computed(() =>
  schemas.value.filter((s) => {
    if (keyword.value && !s.type.toLowerCase().includes(keyword.value.toLowerCase())) return false;
    if (compat.value === 'multi' && s.versions.length < 2) return false;
    if (compat.value === 'v1' && s.versions.length > 1) return false;
    return true;
  }),
);

const limit = ref(20);
const shown = computed(() => rows.value.slice(0, limit.value));
const edge = computed(() => rows.value.length > limit.value);
const state = computed(() => (demo.value === 'NORMAL' && edge.value ? 'EDGE_DATA' : demo.value));

const columns = [
  { colKey: 'type', title: '事件类型', width: 260, cell: 'type' },
  { colKey: 'category', title: '分类', width: 108, cell: 'category' },
  { colKey: 'version', title: '当前版本', width: 108, cell: 'version' },
  { colKey: 'events', title: '事件数', width: 88 },
  { colKey: 'keys', title: '载荷字段（示例）', ellipsis: true, cell: 'keys' },
  { colKey: 'compatRule', title: '兼容性策略', ellipsis: true },
  { colKey: 'op', title: '操作', width: 88, cell: 'op' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = schemas.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="事件 Schema 目录"
      desc="Schema 是声明式契约：新增字段可选即兼容，删除或改义必须升版本并保留旧版本解析能力；CI 拒绝破坏性变更。"
      volume="卷 16" manifest="V-03" cli="oc event schema list --compat backward"
      :status="[{ label: `${schemas.length} 个类型`, theme: 'default' }, { label: `被拒 ${REJECTED.length} 例`, theme: 'warning' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Button size="small" variant="outline" @click="rejectedOpen = true">被拒 Schema（{{ REJECTED.length }}）</Button>
      </template>
    </PageHeader>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap">
        <Input v-model="keyword" size="small" style="width: 260px" placeholder="按事件类型检索" clearable />
        <Select v-model="compat" size="small" style="width: 200px" clearable placeholder="兼容性/版本" aria-label="兼容性">
          <Option value="" label="全部" />
          <Option value="multi" label="多版本演进（≥2 版本）" />
          <Option value="v1" label="初始版本（v1）" />
        </Select>
        <span class="oc-muted" style="font-size: 12px">版本演化只允许「新增可选字段」；删除/改义走新版本 + 兼容期公告</span>
      </div>
    </div>

    <StateShell
      :state="state" stage="正在校验 Schema 兼容性（CI 任务 schema-check）…"
      empty-title="没有匹配的 Schema 定义" empty-desc="关键字或版本过滤过窄；也可能是该域尚未注册任何事件类型。"
      empty-action="清除过滤" example-task="新域接入时先提交 v1 定义（含 payload 字段与必填性）"
      what="Schema 目录读取失败" why="CI 兼容性校验服务不可达，无法确认定义与注册表一致"
      how="可重试；目录展示已回退为只读快照（不含校验结论）" trace-id="trace-c83e2210"
      :collapsed-summary="`已折叠 ${rows.length - shown.length} 个类型（渲染阈值 ${limit}）`" :page-size="shown.length"
      @retry="demo = 'NORMAL'" @load-more="limit += 20" @empty-action="keyword = ''; compat = ''"
    >
      <Table :data="shown" :columns="columns" row-key="type" size="small" :pagination="undefined">
        <template #type="{ row }"><span class="oc-mono">{{ row.type }}</span></template>
        <template #category="{ row }">
          <Tag :theme="row.category === 'domain' ? 'primary' : row.category === 'system' ? 'warning' : 'default'" size="small" variant="light-outline">{{ row.category }}</Tag>
        </template>
        <template #version="{ row }">
          <div class="oc-flex" style="gap: 4px">
            <Tag theme="success" size="small" variant="light-outline">v{{ row.version }}</Tag>
            <Tag v-if="row.versions.length > 1" size="small" variant="outline">{{ row.versions.length }} 个版本</Tag>
          </div>
        </template>
        <template #keys="{ row }"><span class="oc-mono oc-truncate">{{ row.keys.join(', ') }}</span></template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="detail = platformData.events.find((e) => e.type === row.type) ?? null">定义</Button>
        </template>
      </Table>
    </StateShell>

    <Drawer :visible="!!detail" @visible-change="(v: boolean) => { if (!v) detail = null }" :header="detail ? `Schema 声明：${detail.type}` : ''" size="620px" :footer="false">
      <div v-if="detail" class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'ref', label: 'Schema 引用', value: detail.schemaRef, mono: true },
          { key: 'ver', label: '当前版本', value: `v${detail.version}` },
          { key: 'cat', label: '分类', value: detail.category },
          { key: 'sens', label: '敏感度', value: detail.sensitivity, tag: { text: detail.sensitivity, theme: 'warning' } },
        ]" />
        <div>
          <h4 class="oc-card__title">声明式定义</h4>
          <JsonBlock :value="schemas.find((s) => s.type === detail!.type)?.definition ?? ''" :mask="false" label="schema" />
        </div>
        <div>
          <h4 class="oc-card__title">示例载荷（已脱敏）</h4>
          <JsonBlock :value="detail.payload" label="payload" />
        </div>
        <CliHint :command="`oc event schema show --type ${detail.type} --version ${detail.version}`" />
      </div>
    </Drawer>

    <Drawer v-model:visible="rejectedOpen" header="被拒 Schema（CI 兼容性校验未通过）" size="620px" :footer="false">
      <div class="oc-stack">
        <div v-for="rj in REJECTED" :key="`${rj.type}-${rj.version}`" class="oc-card">
          <h4 class="oc-card__title">
            <span class="oc-mono">{{ rj.type }}@v{{ rj.version }}</span>
            <Tag theme="danger" size="small" variant="light-outline">已拒绝</Tag>
          </h4>
          <InfoGrid :columns="1" :items="[
            { key: 'at', label: '提交时间', value: rj.at },
            { key: 'by', label: '提交人', value: rj.by },
            { key: 'why', label: '拒绝原因', value: rj.reason },
            { key: 'fix', label: '修复建议', value: rj.fix },
          ]" />
        </div>
        <Tag theme="warning" variant="light-outline">被拒定义不会进入注册表；已存事件仍按旧版本可解析（不可回溯改写）</Tag>
      </div>
    </Drawer>
  </div>
</template>
