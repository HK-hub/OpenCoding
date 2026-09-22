<script setup lang="ts">
/**
 * 扩展点目录浏览器（L-04）：22 域 120+ 扩展点 + 稳定性（stable/evolving/experimental）+ 进程内/外。
 * 溯源：卷 18 §4.1 扩展点目录汇总（卷 02–17）+ D-PLG-1 稳定性分级与版本区间。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { STABILITY_LABEL, STABILITY_THEME, useExtList, type TagTheme } from '@/components/extension/useExtList';
import { downloadJson } from '@/utils/download';

const router = useRouter();
const domains = extensionData.extensionCatalog;

/** 展平：扩展点 × 所属域 */
const rows = computed(() =>
  domains.flatMap((d) => d.points.map((p) => ({ ...p, domain: d.domain, volume: d.volume }))),
);

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(rows.value, {
  persistKey: 'extension-catalog',
  pageSize: 20,
  match: (p, kw, f) => (f === 'all' || p.stability === f) && (!kw || `${p.domain}${p.spi}${p.desc}`.toLowerCase().includes(kw)),
});

const stabilityOptions = [
  { label: '全部稳定性', value: 'all' },
  { label: 'stable 跨大版本兼容', value: 'stable' },
  { label: 'evolving 小版本可增删', value: 'evolving' },
  { label: 'experimental 可破坏', value: 'experimental' },
];

const stats = computed(() => ({
  domains: domains.length,
  points: rows.value.length,
  stable: rows.value.filter((p) => p.stability === 'stable').length,
  evolving: rows.value.filter((p) => p.stability === 'evolving').length,
  experimental: rows.value.filter((p) => p.stability === 'experimental').length,
}));

function themeOf(v: string): TagTheme {
  return (STABILITY_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

function labelOf(v: string): string {
  return (STABILITY_LABEL as Record<string, string>)[v] ?? v;
}

/** 导出扩展点目录：目录数据（domains）与稳定性口径取自本页，供离线对照兼容区间 */
function exportCatalog() {
  const filename = `oc-extension-catalog-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson({ stats: stats.value, stabilityLabels: STABILITY_LABEL, domains }, filename);
  MessagePlugin.success(`已导出扩展点目录（${filename}，${stats.value.points} 个扩展点）`);
}
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="扩展点目录"
      desc="22 域 120+ 扩展点，标注稳定性与进程内/外；每点给出兼容区间，弃用走 deprecated → 移除（≥2 小版本兼容期）。"
      volume="卷 18" manifest="L-04" cli="oc extension catalog --all --with-stability"
      :status="[{ label: `${stats.domains} 域 / ${stats.points} 点`, theme: 'primary' }, { label: '版本化 + 兼容期', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/plugins/compatibility')">兼容矩阵</Button>
        <Button size="small" variant="text" @click="exportCatalog">导出目录</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="扩展域" :value="stats.domains" unit="个" icon="layers" />
      <StatCard label="扩展点总数" :value="stats.points" unit="个" icon="sitemap" :trend="[96, 104, 110, 114, 118, 120, stats.points]" />
      <StatCard label="stable" :value="stats.stable" unit="个" icon="secured" hint="跨大版本兼容" />
      <StatCard label="experimental（可破坏）" :value="stats.experimental" unit="个" icon="error" :lower-is-better="true" hint="需实验徽标与可下线设计" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索域 / SPI 名 / 说明" clearable style="width: 320px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="stabilityOptions" style="width: 230px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 点 · 过滤记忆已开启</span>
      </div>
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">22 域分布</h3>
      <div class="oc-flex oc-flex--wrap" style="gap: 6px">
        <Tag
          v-for="d in domains"
          :key="d.domain"
          size="small"
          :theme="themeOf(d.stability)"
          variant="light-outline"
          style="cursor: pointer"
          @click="keyword = d.domain"
        >{{ d.domain }} · {{ d.points.length }}</Tag>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="20"
      empty-title="没有匹配的扩展点"
      empty-desc="过滤条件过窄（稳定性或关键词）；清空过滤可查看全部 22 域。"
      empty-action="清除过滤"
      example-task="查找可替换检索实现的 RetrievalAugmentor 扩展点"
      what="扩展点目录加载失败"
      why="目录版本与内核不匹配（内核 1.3 / 目录 1.0，缺少新增点）。"
      how="可重试；或升级内核后自动同步目录版本。"
      trace-id="trace-ext-catalog-8ac2"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="keyword = ''; filter = 'all'; reload()"
    >
      <Table row-key="spi" size="small" :data="visible" :columns="[
        { colKey: 'domain', title: '扩展域', width: 170 },
        { colKey: 'spi', title: '扩展点（SPI）', width: 250 },
        { colKey: 'desc', title: '说明' },
        { colKey: 'stability', title: '稳定性', width: 180 },
        { colKey: 'locality', title: '进程内 / 外', width: 130 },
        { colKey: 'volume', title: '来源卷', width: 100 },
      ]" table-layout="fixed">
        <template #domain="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span style="font-size: 13px">{{ row.domain }}</span>
            <span class="oc-muted" style="font-size: 11px">{{ row.volume }}</span>
          </div>
        </template>
        <template #spi="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.spi }}</span></template>
        <template #desc="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.desc }}</span></template>
        <template #stability="{ row }">
          <Tooltip :content="labelOf(row.stability)">
            <Tag size="small" :theme="themeOf(row.stability)" variant="light-outline">{{ row.stability }}</Tag>
          </Tooltip>
        </template>
        <template #locality="{ row }"><Tag size="small" variant="outline">{{ row.locality }}</Tag></template>
      </Table>
    </StateShell>
  </div>
</template>
