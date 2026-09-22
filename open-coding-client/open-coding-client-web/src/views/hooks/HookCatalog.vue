<script setup lang="ts">
/**
 * 钩子点目录（H-02）：8 类 40 点目录树 + 每点语义与可用能力（observe / block / rewrite）。
 * 溯源：卷 17 §4.1 钩子点目录与 §4.3 执行管线顺序（权限决策之后只允许观察类）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { HOOK_CAP_LABEL, HOOK_DOMAIN_LABEL, useExtList } from '@/components/extension/useExtList';

const router = useRouter();
const points = extensionData.hookPoints;

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(points, {
  persistKey: 'hook-points',
  pageSize: 16,
  match: (p, kw, f) => {
    const byDomain = f === 'all' || p.domain === f;
    const byCap = !kw.startsWith('cap:') || p.capabilities.includes(kw.slice(4) as 'observe' | 'block' | 'rewrite');
    const textOk = !kw || kw.startsWith('cap:') || `${p.point}${p.semantics}`.toLowerCase().includes(kw);
    return byDomain && byCap && textOk;
  },
});

const domainOptions = [
  { label: '全部分组（8 类）', value: 'all' },
  ...Object.entries(HOOK_DOMAIN_LABEL).map(([value, label]) => ({ label, value })),
];

const domainSummary = computed(() =>
  Object.entries(HOOK_DOMAIN_LABEL).map(([key, label]) => {
    const items = points.filter((p) => p.domain === key);
    return {
      key,
      label,
      count: items.length,
      block: items.filter((p) => p.capabilities.includes('block')).length,
      rewrite: items.filter((p) => p.capabilities.includes('rewrite')).length,
      observeOnly: items.filter((p) => p.capabilities.length === 1).length,
    };
  }),
);

const stageMap: Record<string, string> = {
  'tool.call.before': '执行管线：参数校验后、权限决策前（可阻断/改写）',
  'permission.decision.after': '执行管线：权限决策后（仅观察）',
  'tool.result.before': '执行管线：脱敏后、回喂前（可改写）',
  'tool.call.after': '执行管线：后置（观察/通知）',
};

const columns = [
  { colKey: 'point', title: '钩子点', width: 260 },
  { colKey: 'domain', title: '分组', width: 150 },
  { colKey: 'semantics', title: '语义与典型用途' },
  { colKey: 'caps', title: '可用能力', width: 260 },
  { colKey: 'since', title: '起始版本', width: 110 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="钩子点目录"
      desc="全生命周期 8 类 40 个稳定命名点；能力分级（观察 / 阻断 / 改写）由点本身的语义决定，越界即拒绝。"
      volume="卷 17" manifest="H-02" cli="oc hooks points --all --json"
      :status="[{ label: `${points.length} 个钩子点`, theme: 'primary' }, { label: '命名稳定并版本化', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/hooks')">返回钩子列表</Button>
        <Button size="small" theme="primary" @click="router.push('/extension/hooks/editor')">基于该目录新建钩子</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="钩子点总数" :value="points.length" unit="个" icon="sitemap" />
      <StatCard label="支持阻断" :value="points.filter((p) => p.capabilities.includes('block')).length" unit="个" icon="lock" hint="任一阻断即终止后续钩子" />
      <StatCard label="支持改写" :value="points.filter((p) => p.capabilities.includes('rewrite')).length" unit="个" icon="edit" hint="改写仅限白名单字段，需 Schema 校验" />
      <StatCard label="仅观察" :value="points.filter((p) => p.capabilities.length === 1).length" unit="个" icon="browse" hint="权限决策之后仅允许观察类" />
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">
        8 类分组概览
        <span class="oc-muted" style="font-size: 12px">点击分组卡片过滤下方目录</span>
      </h3>
      <div class="oc-grid oc-grid--4">
        <button
          v-for="d in domainSummary"
          :key="d.key"
          type="button"
          class="oc-card"
          style="text-align: left; cursor: pointer; padding: 10px 12px"
          :style="filter === d.key ? { borderColor: 'var(--td-brand-color)' } : undefined"
          @click="filter = d.key"
        >
          <div class="oc-flex--between">
            <b style="font-size: 13px">{{ d.label }}</b>
            <Tag size="small" variant="outline">{{ d.count }} 点</Tag>
          </div>
          <div class="oc-muted" style="font-size: 11px; margin-top: 4px">
            阻断 {{ d.block }} · 改写 {{ d.rewrite }} · 仅观察 {{ d.observeOnly }}
          </div>
        </button>
      </div>
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索钩子点 / 语义；输入 cap:block 过滤能力" clearable style="width: 340px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="domainOptions" style="width: 220px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
        <span class="oc-grow" />
        <span class="oc-secondary" style="font-size: 12px">
          <OcIcon name="help" size="12px" /> 钩子点新增需版本化（HookPointSPI），弃用需兼容期 ≥2 小版本
        </span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="16"
      empty-title="没有匹配的钩子点"
      empty-desc="钩子点目录为静态声明（不可运行时删减）；放宽过滤条件即可看到全部 40 点。"
      empty-action="清除过滤"
      example-task="在 tool.call.before 上挂一个参数收窄钩子"
      what="目录加载失败"
      why="钩子点清单版本与内核不匹配（内核报告 1.3，清单为 1.0）。"
      how="可重试；或升级内核后自动同步目录。"
      trace-id="trace-hook-points-2f90"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="keyword = ''; filter = 'all'; reload()"
    >
      <Table row-key="point" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #point="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.point }}</span>
            <span v-if="stageMap[row.point]" class="oc-muted" style="font-size: 11px">{{ stageMap[row.point] }}</span>
          </div>
        </template>
        <template #domain="{ row }"><Tag size="small" variant="outline">{{ HOOK_DOMAIN_LABEL[row.domain] }}</Tag></template>
        <template #semantics="{ row }"><span style="font-size: 12px">{{ row.semantics }}</span></template>
        <template #caps="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag
              v-for="c in row.capabilities"
              :key="c"
              size="small"
              :theme="c === 'block' ? 'danger' : c === 'rewrite' ? 'warning' : 'primary'"
              variant="light-outline"
            >{{ HOOK_CAP_LABEL[c] }}</Tag>
          </div>
        </template>
        <template #since="{ row }">
          <Tooltip content="点命名稳定并版本化；弃用走 evolving → deprecated → 移除（≥2 小版本兼容期）">
            <span class="oc-mono" style="font-size: 12px">≥ {{ row.since }}</span>
          </Tooltip>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
