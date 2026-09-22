<script setup lang="ts">
/**
 * Z-01 数据分域总览。
 * 14 个数据分域：主要数据 / 存储 / 唯一写入者 / 保留策略；单一写入者原则是架构约束。
 * 溯源：卷 19 D-PERS-1/§4.1；BUILD-MANIFEST Z-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { DataDomain } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const keyword = ref('');
const storage = ref('');
const active = ref<DataDomain>(platformData.persistence.domains[0]);

const domains = computed(() => platformData.persistence.domains);
const rows = computed(() =>
  domains.value.filter((d) => {
    if (keyword.value && !`${d.domain} ${d.mainData}`.includes(keyword.value)) return false;
    if (storage.value && !d.storage.includes(storage.value)) return false;
    return true;
  }),
);

const STORAGE_KINDS = ['PG', 'Redis', '对象存储', 'KMS', '文件'];

const columns = [
  { colKey: 'domain', title: '数据分域', width: 170, cell: 'domain' },
  { colKey: 'mainData', title: '主要数据', ellipsis: true },
  { colKey: 'storage', title: '存储', width: 220 },
  { colKey: 'writer', title: '唯一写入者', width: 150, cell: 'writer' },
  { colKey: 'retention', title: '保留', width: 200 },
  { colKey: 'op', title: '操作', width: 88, cell: 'op' },
];

onMounted(() => {
  window.setTimeout(() => (demo.value = domains.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="数据分域总览"
      desc="分域 + 单一写入者原则：每个域的数据只由其领域服务写入，跨域只读或经事件投影；任何域新增表/字段都必须回写本表。"
      volume="卷 19" manifest="Z-01" cli="oc persistence domains --show-writer --show-retention"
      :status="[{ label: `${domains.length} 个分域`, theme: 'default' }, { label: '单一写入者', theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="分域总数" :value="domains.length" icon="database" hint="PG 事实源 + Redis 运行态 + 对象存储" />
      <StatCard label="PG 承载域" :value="domains.filter((d) => d.storage.includes('PG')).length" icon="server" hint="事件日志为分区表，可冷存归档" />
      <StatCard label="对象存储域" :value="domains.filter((d) => d.storage.includes('对象存储')).length" icon="cloud" hint="内容寻址 + 引用计数 + TTL" />
      <StatCard label="运行态（Redis）" :value="domains.filter((d) => d.storage.includes('Redis')).length" icon="loading" hint="可降级为进程内实现" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap">
        <Input v-model="keyword" size="small" style="width: 240px" placeholder="按域/数据检索" clearable />
        <Select v-model="storage" size="small" style="width: 180px" clearable placeholder="按存储类型" aria-label="存储">
          <Option value="" label="全部存储" />
          <Option v-for="k in STORAGE_KINDS" :key="k" :value="k" :label="k" />
        </Select>
        <span class="oc-muted" style="font-size: 12px">跨域写入视为架构违规（架构测试可校验越界写入）</span>
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在读取数据分域表…"
      empty-title="没有匹配的分域" empty-desc="过滤条件过窄，或该租户启用了自定义分域（企业策略）。"
      empty-action="清除过滤" example-task="新增「工作流草稿」域时同步登记存储、写入者与保留"
      what="数据分域表读取失败" why="架构元数据服务不可达（与迁移记录同库）"
      how="重试；分域表为文档同源数据，可在设计文档中查看最近快照" trace-id="trace-e11f4b62"
      @retry="demo = 'NORMAL'" @empty-action="keyword = ''; storage = ''"
    >
      <Table :data="rows" :columns="columns" row-key="domain" size="small" :pagination="undefined">
        <template #domain="{ row }">
          <Button size="small" variant="text" @click="active = row as DataDomain">{{ row.domain }}</Button>
        </template>
        <template #writer="{ row }">
          <Tag theme="primary" size="small" variant="light-outline">{{ row.writer }}</Tag>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="active = row as DataDomain">详情</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-card">
      <h3 class="oc-card__title">
        分域详情：{{ active.domain }}
        <CliHint :command="`oc persistence domains --show ${active.domain}`" />
      </h3>
      <InfoGrid :columns="2" :items="[
        { key: 'main', label: '主要数据', value: active.mainData },
        { key: 'storage', label: '存储', value: active.storage },
        { key: 'writer', label: '唯一写入者', value: `${active.writer}（其他域只读或经事件投影）` },
        { key: 'retention', label: '保留策略', value: active.retention },
        { key: 'event', label: '变更约定', value: 'Schema 变更须同步更新本表与附录 A（同源文档）' },
        { key: 'boundary', label: '越界写入检测', value: '架构测试在 CI 校验：跨域直接写入即失败' },
      ]" />
    </div>
  </div>
</template>
