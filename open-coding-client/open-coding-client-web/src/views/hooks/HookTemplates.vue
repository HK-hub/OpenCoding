<script setup lang="ts">
/**
 * 钩子模板库（H-08）：格式化 / 敏感扫描 / 提交规范 / 通知集成 / 审计上报 + 签名与安装。
 * 溯源：卷 17 D-HOOK-9（模板 + 组织分发 + 签名）；安装后默认「不自动启用」，需显式确认。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { HOOK_CAP_LABEL, HOOK_IMPL_LABEL, SIGNATURE_LABEL, SIGNATURE_THEME, useExtList, type TagTheme } from '@/components/extension/useExtList';

const router = useRouter();
const templates = extensionData.hookTemplates;
const installed = ref<string[]>(templates.filter((t) => t.installed).map((t) => t.id));

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(templates, {
  persistKey: 'hook-templates',
  pageSize: 12,
  match: (t, kw, f) => (f === 'all' || t.category === f) && (!kw || `${t.name}${t.desc}${t.point}`.toLowerCase().includes(kw)),
});

const categoryOptions = [
  { label: '全部分类', value: 'all' },
  { label: '格式化', value: '格式化' },
  { label: '敏感扫描', value: '敏感扫描' },
  { label: '提交规范', value: '提交规范' },
  { label: '通知集成', value: '通知集成' },
  { label: '审计上报', value: '审计上报' },
];

const stats = computed(() => ({
  total: templates.length,
  installed: installed.value.length,
  unsigned: templates.filter((t) => t.signature.state !== 'verified').length,
  usage: templates.reduce((a, t) => a + t.usageCount, 0),
}));

function stTheme(v: string): TagTheme {
  return (SIGNATURE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

function stLabel(v: string): string {
  return (SIGNATURE_LABEL as Record<string, string>)[v] ?? v;
}

function install(t: { id: string; name: string; signature: { state: string } }) {
  if (t.signature.state !== 'verified') {
    MessagePlugin.error(`已拒绝安装 ${t.name}：模板未签名（企业策略要求签名），可改用组织私仓的已签名版本`);
    return;
  }
  installed.value.push(t.id);
  MessagePlugin.success(`已安装 ${t.name}：默认处于「未启用」状态，确认生效范围后再启用（模板不自动启用）`);
}

/** 私仓索引同步状态：完成后更新「最近同步时间 / 索引模板数」等可见数据 */
const syncing = ref(false);
const lastSync = ref<{ at: string; count: number } | null>(null);

/** 同步组织私仓模板索引（增量）：短异步拉取后刷新同步时间与索引计数 */
function syncPrivateIndex() {
  if (syncing.value) return;
  syncing.value = true;
  window.setTimeout(() => {
    // 真实更新同步水位：记录完成时间与本次索引到的模板数（页内可见）
    lastSync.value = { at: new Date().toLocaleTimeString('zh-CN', { hour12: false }), count: templates.length };
    syncing.value = false;
    MessagePlugin.info(`已同步组织私仓模板索引（增量）：索引 ${templates.length} 个模板`);
  }, 480);
}

/** 生成模板 YAML（字段与列表同源，供粘贴到本地 hook 配置） */
function templateYaml(t: (typeof templates)[number]): string {
  return [
    `id: ${t.id}`,
    `name: ${t.name}`,
    `category: ${t.category}`,
    `hook_point: ${t.point}`,
    `capability: ${t.capability}`,
    `implementation: ${t.impl}`,
    `signature_state: ${t.signature.state}`,
    `signer: ${t.signature.signer}`,
    `description: ${t.desc}`,
  ].join('\n');
}

/** 复制模板 YAML 到剪贴板：写入成功才提示，失败引导手动复制（不谎报已复制） */
async function copyYaml(t: (typeof templates)[number]) {
  try {
    await navigator.clipboard.writeText(templateYaml(t));
    MessagePlugin.success(`已复制模板 YAML：${t.name}（可直接粘贴到编辑器）`);
  } catch {
    MessagePlugin.info('复制失败，请手动复制');
  }
}

const columns = [
  { colKey: 'name', title: '模板', width: 260 },
  { colKey: 'category', title: '分类', width: 110 },
  { colKey: 'point', title: '钩子点', width: 210 },
  { colKey: 'cap', title: '能力 / 实现', width: 200 },
  { colKey: 'desc', title: '说明' },
  { colKey: 'sig', title: '签名', width: 110 },
  { colKey: 'ops', title: '操作', width: 150 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="钩子模板库"
      desc="常见治理场景开箱即用；模板安装不等于启用（避免一键植入风险），签名与审核是安装前提。"
      volume="卷 17" manifest="H-08" cli="oc hooks templates list"
      :status="[{ label: `已安装 ${stats.installed}/${stats.total}`, theme: 'primary' }, { label: `未签名 ${stats.unsigned}`, theme: stats.unsigned ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/hooks')">返回钩子列表</Button>
        <Button size="small" variant="outline" :loading="syncing" @click="syncPrivateIndex">同步私仓</Button>
      </template>
    </PageHeader>

    <Alert
      theme="warning"
      message="一键植入风险：模板不自动启用"
      description="安装后为「未启用」状态，需在钩子列表中确认 match 与作用域后再启用；组织级安全模板由策略强制（不可被下级长期禁用）。"
    />

    <div class="oc-grid oc-grid--4">
      <StatCard label="模板总数" :value="stats.total" unit="个" icon="file-copy" />
      <StatCard label="已安装" :value="stats.installed" unit="个" icon="check" />
      <StatCard label="未签名（禁止安装）" :value="stats.unsigned" unit="个" icon="flag" :lower-is-better="true" hint="企业策略：签名后方可安装" />
      <StatCard label="累计使用次数" :value="stats.usage" unit="次" icon="refresh" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索模板名 / 说明" clearable style="width: 280px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="categoryOptions" style="width: 170px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
        <Tag size="small" variant="outline">
          {{ lastSync ? `私仓索引已同步 ${lastSync.at} · ${lastSync.count} 个模板` : '私仓索引待同步（增量更新）' }}
        </Tag>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="12"
      empty-title="没有匹配的模板"
      empty-desc="分类过滤过窄或私仓未同步；模板来源包括官方、组织私仓与已审核市场投稿。"
      empty-action="清晰过滤条件"
      example-task="安装「敏感信息扫描」模板并在提交前阻断密钥入库"
      what="模板索引加载失败"
      why="组织私仓不可达（TLS 证书链校验失败）。"
      how="可重试；或切换来源为本地缓存索引（可能缺少最新模板）。"
      trace-id="trace-hook-tpl-5ba1"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="keyword = ''; filter = 'all'; reload()"
    >
      <Table row-key="id" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #name="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.id }}</span>
            <span style="font-size: 13px">{{ row.name }}</span>
            <Tag v-if="installed.includes(row.id)" size="small" theme="success" variant="light-outline">已安装</Tag>
          </div>
        </template>
        <template #category="{ row }"><Tag size="small" variant="outline">{{ row.category }}</Tag></template>
        <template #point="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.point }}</span></template>
        <template #cap="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag size="small" :theme="row.capability === 'block' ? 'danger' : row.capability === 'rewrite' ? 'warning' : 'primary'" variant="light-outline">
              {{ HOOK_CAP_LABEL[row.capability] }}
            </Tag>
            <span class="oc-muted" style="font-size: 11px">{{ HOOK_IMPL_LABEL[row.impl] }}</span>
          </div>
        </template>
        <template #desc="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.desc }}</span></template>
        <template #sig="{ row }">
          <Tooltip :content="row.signature.signer">
            <Tag size="small" :theme="stTheme(row.signature.state)" variant="light-outline">{{ stLabel(row.signature.state) }}</Tag>
          </Tooltip>
        </template>
        <template #ops="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Popconfirm
              v-if="!installed.includes(row.id)"
              :content="row.signature.state === 'verified' ? '安装后处于「未启用」状态，需确认 match 与作用域后手动启用。' : '该模板未签名，安装将被拒绝。'"
              :theme="row.signature.state === 'verified' ? 'default' : 'danger'"
              @confirm="install(row)"
            >
              <Button size="small" variant="text">安装</Button>
            </Popconfirm>
            <Button v-else size="small" variant="text" @click="router.push('/extension/hooks')">去启用</Button>
            <Button size="small" variant="text" @click="copyYaml(row)">查看 YAML</Button>
          </div>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
