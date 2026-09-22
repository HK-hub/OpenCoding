<script setup lang="ts">
/**
 * 钩子列表（H-01）：id / point / scope / capability / impl / enabled / 签名 / 熔断。
 * 溯源：卷 17 §4.2 钩子定义与 §4.5 安全模型（连续失败 5 次自动禁用）；一键禁用全部需确认。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin, Popconfirm, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import {
  HOOK_CAP_LABEL, HOOK_IMPL_LABEL, SCOPE_LABEL, SIGNATURE_LABEL, SIGNATURE_THEME, fmtMs,
  useExtList, type TagTheme,
} from '@/components/extension/useExtList';

const router = useRouter();
const hooks = extensionData.hooks;

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(hooks, {
  persistKey: 'hooks',
  pageSize: 12,
  match: (h, kw, f) => (f === 'all' || h.scope === f) && (!kw || `${h.id}${h.name}${h.point}${h.impl}`.toLowerCase().includes(kw)),
});

const scopeOptions = [
  { label: '全部作用域', value: 'all' },
  { label: '组织（先求值，安全类不可禁用）', value: 'org' },
  { label: '项目', value: 'project' },
  { label: '用户', value: 'user' },
  { label: '会话（后求值）', value: 'session' },
];

const enabledMap = ref<Record<string, boolean>>(Object.fromEntries(hooks.map((h) => [h.id, h.enabled])));

const stats = computed(() => ({
  total: hooks.length,
  enabled: hooks.filter((h) => enabledMap.value[h.id]).length,
  circuit: hooks.filter((h) => h.stats.circuitDisabled).length,
  blockers: hooks.filter((h) => h.capability === 'block').length,
}));

function stTheme(v: string): TagTheme {
  return (SIGNATURE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

function stLabel(v: string): string {
  return (SIGNATURE_LABEL as Record<string, string>)[v] ?? v;
}

function toggle(h: { id: string; name: string }, v: boolean) {
  enabledMap.value[h.id] = v;
  MessagePlugin.info(
    v
      ? `已启用 ${h.name}：仅可收窄权限、不可放宽（改写后重新走权限决策）`
      : `已禁用 ${h.name}：禁用记录写入审计（hook.disabled）`,
  );
}

function disableAll() {
  hooks.forEach((h) => {
    enabledMap.value[h.id] = false;
  });
  MessagePlugin.warning('已禁用全部钩子：无任何干预生效；安全类组织钩子会由组织策略重新强制启用（不可被下级长期禁用）');
}

const columns = [
  { colKey: 'name', title: '钩子', width: 250 },
  { colKey: 'point', title: '钩子点', width: 210 },
  { colKey: 'scope', title: '作用域', width: 130 },
  { colKey: 'cap', title: '能力', width: 130 },
  { colKey: 'impl', title: '实现 / 失败策略', width: 180 },
  { colKey: 'stats', title: '执行 / 阻断率 / 平均耗时', width: 220 },
  { colKey: 'sig', title: '签名', width: 100 },
  { colKey: 'enabled', title: '启用', width: 90 },
  { colKey: 'ops', title: '操作', width: 170 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="钩子列表"
      desc="四层作用域（组织 → 项目 → 用户 → 会话）按序求值；阻断即终止后续钩子，改写仅限白名单字段且不可放宽权限。"
      volume="卷 17" manifest="H-01" cli="oc hooks list --scope all"
      :status="[{ label: `启用 ${stats.enabled}/${stats.total}`, theme: 'primary' }, { label: `熔断禁用 ${stats.circuit}`, theme: stats.circuit ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/hooks/catalog')">钩子点目录</Button>
        <Button size="small" variant="outline" @click="router.push('/extension/hooks/templates')">模板库</Button>
        <Popconfirm
          content="将禁用全部钩子（含安全类）：安全类组织钩子会被组织策略重新强制启用；禁用记录写入审计。"
          theme="warning"
          @confirm="disableAll"
        >
          <Button size="small" theme="danger" variant="outline">禁用全部</Button>
        </Popconfirm>
        <Button size="small" theme="primary" @click="router.push('/extension/hooks/editor')">
          <OcIcon name="add" size="12px" /> 新建钩子
        </Button>
      </template>
    </PageHeader>

    <Alert
      v-if="stats.circuit"
      theme="warning"
      message="存在被熔断自动禁用的钩子"
      description="连续失败 5 次自动禁用并通知（避免坏钩子拖垮流程）；修复后需手动启用，禁用期间该点无干预且显式标注。"
    />

    <div class="oc-grid oc-grid--4">
      <StatCard label="钩子总数" :value="stats.total" unit="个" icon="link" :trend="[12, 14, 15, 16, 17, 18, stats.total]" />
      <StatCard label="启用中" :value="stats.enabled" unit="个" icon="check" />
      <StatCard label="阻断类（安全默认 fail-closed）" :value="stats.blockers" unit="个" icon="lock" />
      <StatCard label="熔断禁用" :value="stats.circuit" unit="个" icon="error" :lower-is-better="true" hint="连续失败 5 次自动禁用" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索 id / 名称 / 钩子点" clearable style="width: 280px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="scopeOptions" style="width: 250px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="12"
      empty-title="没有匹配的钩子"
      empty-desc="默认零钩子（不干预）；可从模板库安装首个钩子，或在编辑器中从零编写。"
      empty-action="打开模板库"
      example-task="安装「敏感信息扫描」模板以在提交前阻断密钥入库"
      what="钩子配置加载失败"
      why=".oc/hooks/ 下某 YAML 解析失败（第 7 行缩进错误）；已隔离该文件，其余钩子仍加载。"
      how="可重试；或修复 YAML 后重新加载（坏文件不影响其它钩子）。"
      trace-id="trace-hook-cfg-1a77"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="router.push('/extension/hooks/templates')"
    >
      <Table row-key="id" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.id }}</span>
              <Button size="small" variant="text" @click="router.push({ path: '/extension/hooks/test', query: { id: row.id } })">{{ row.name }}</Button>
              <Tag v-if="row.stats.circuitDisabled" size="small" theme="danger" variant="light-outline">熔断禁用</Tag>
            </div>
            <span class="oc-muted" style="font-size: 11px">{{ row.match.toolName || row.match.pathPattern || row.match.commandPattern || row.match.eventType || '匹配全部' }}</span>
          </div>
        </template>
        <template #point="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.point }}</span></template>
        <template #scope="{ row }"><Tag size="small" variant="outline">{{ SCOPE_LABEL[row.scope] }}</Tag></template>
        <template #cap="{ row }">
          <Tag size="small" :theme="row.capability === 'block' ? 'danger' : row.capability === 'rewrite' ? 'warning' : 'primary'" variant="light-outline">
            {{ HOOK_CAP_LABEL[row.capability] }}
          </Tag>
        </template>
        <template #impl="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span style="font-size: 12px">{{ HOOK_IMPL_LABEL[row.impl] }}</span>
            <div class="oc-flex" style="gap: 4px">
              <Tag size="small" :theme="row.failurePolicy === 'fail-closed' ? 'danger' : 'default'" variant="light-outline">{{ row.failurePolicy }}</Tag>
              <Tag v-if="row.async" size="small" variant="outline">async</Tag>
            </div>
          </div>
        </template>
        <template #stats="{ row }">
          <span class="oc-mono" style="font-size: 12px">
            {{ row.stats.executions }} 次 · 阻断 {{ row.stats.blockRate }}% · {{ fmtMs(row.stats.avgLatencyMs) }}
          </span>
          <Tooltip v-if="row.stats.failureStreak" :content="`连续失败 ${row.stats.failureStreak} 次（阈值 5）`">
            <Tag size="small" theme="warning" variant="light-outline" style="margin-left: 4px">失败 {{ row.stats.failureStreak }}</Tag>
          </Tooltip>
        </template>
        <template #sig="{ row }">
          <Tag size="small" :theme="stTheme(row.signature.state)" variant="light-outline">{{ stLabel(row.signature.state) }}</Tag>
        </template>
        <template #enabled="{ row }">
          <Switch size="small" :value="enabledMap[row.id]" @change="(v) => toggle(row, Boolean(v))" />
        </template>
        <template #ops="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Button size="small" variant="text" @click="router.push({ path: '/extension/hooks/test', query: { id: row.id } })">试跑</Button>
            <Button size="small" variant="text" @click="router.push({ path: '/extension/hooks/editor', query: { id: row.id } })">编辑</Button>
            <Button size="small" variant="text" @click="router.push({ path: '/extension/hooks/logs', query: { id: row.id } })">日志</Button>
          </div>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
