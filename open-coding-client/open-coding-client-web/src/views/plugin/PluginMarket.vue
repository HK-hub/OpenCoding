<script setup lang="ts">
/**
 * 插件市场与已安装（L-01）：三层来源 + 签名 + 版本 + 健康 + 熔断。
 * 溯源：卷 18 D-PLG-8 市场与供应链 / §4.3 装载流水线（签名与兼容校验失败即拒绝并给出建议）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import {
  PLUGIN_HEALTH_THEME, PLUGIN_HOST_LABEL, PLUGIN_SOURCE_LABEL, SIGNATURE_LABEL, SIGNATURE_THEME,
  useExtList, type TagTheme,
} from '@/components/extension/useExtList';

const router = useRouter();
const plugins = extensionData.plugins;

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(plugins, {
  persistKey: 'plugins',
  pageSize: 10,
  match: (p, kw, f) => (f === 'all' || p.source === f) && (!kw || `${p.id}${p.name}${p.author}`.toLowerCase().includes(kw)),
});

const sourceOptions = [
  { label: '全部来源', value: 'all' },
  { label: '本地文件（开发）', value: 'local' },
  { label: '组织私仓（推荐）', value: 'org-registry' },
  { label: '公共市场（企业默认关闭）', value: 'market' },
];

const disabled = ref<string[]>(plugins.filter((p) => p.health === '故障').map((p) => p.id));

const stats = computed(() => ({
  total: plugins.length,
  ready: plugins.filter((p) => p.health === '就绪').length,
  degraded: plugins.filter((p) => p.health === '降级' || p.health === '故障').length,
  circuit: plugins.filter((p) => p.circuitState === 'open').length,
  sigInvalid: plugins.filter((p) => p.signature.state === 'invalid').length,
}));

function stTheme(v: string): TagTheme {
  return (SIGNATURE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

function toggle(id: string, name: string, v: boolean) {
  if (!v) disabled.value.push(id);
  else disabled.value = disabled.value.filter((x) => x !== id);
  MessagePlugin.info(
    v
      ? `已启用 ${name}：装配扩展点并注入配置与密钥引用`
      : `已禁用 ${name}：卸载装配、保留配置；依赖它的技能随之中止（依赖关系显式提示）`,
  );
}

const columns = [
  { colKey: 'name', title: '插件', width: 300 },
  { colKey: 'source', title: '来源', width: 130 },
  { colKey: 'host', title: '宿主形态', width: 220 },
  { colKey: 'version', title: '版本 / 热重载', width: 150 },
  { colKey: 'health', title: '健康', width: 190 },
  { colKey: 'sig', title: '签名', width: 110 },
  { colKey: 'enabled', title: '启用', width: 90 },
  { colKey: 'ops', title: '操作', width: 200 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="插件市场与已安装"
      desc="插件是代码扩展（可执行）：显式清单 + 签名 + 授权 + 隔离；三形态宿主（进程内 / 进程外 / 远程）。"
      volume="卷 18" manifest="L-01" cli="oc plugin list --installed --json"
      :status="[
        { label: '私仓强制签名', theme: 'success' },
        { label: '公共市场已禁用', theme: 'warning' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/plugins/compatibility')">兼容矩阵</Button>
        <Button size="small" variant="outline" @click="router.push('/extension/plugins/ui-host')">UI 扩展宿主</Button>
        <Button size="small" theme="primary" @click="router.push('/extension/plugins/dev-console')">
          <OcIcon name="add" size="12px" /> 新建插件
        </Button>
      </template>
    </PageHeader>

    <Alert
      v-if="stats.sigInvalid"
      theme="error"
      message="存在签名校验失败的插件（已隔离）"
      description="签名失败 = 拒绝装载 + 隔离 + 告警；可操作建议：改用私仓已签名版本 / 联系发布者重新签发 / 从本地来源以开发模式加载（企业策略允许时）。"
    />

    <div class="oc-grid oc-grid--4">
      <StatCard label="插件总数" :value="stats.total" unit="个" icon="extension" :trend="[7, 8, 9, 10, 10, 11, stats.total]" />
      <StatCard label="就绪" :value="stats.ready" unit="个" icon="check" />
      <StatCard label="降级 / 故障" :value="stats.degraded" unit="个" icon="error" :lower-is-better="true" />
      <StatCard label="熔断打开" :value="stats.circuit" unit="个" icon="secured" :lower-is-better="true" hint="错误率超阈值停用扩展点" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索插件 id / 名称 / 作者" clearable style="width: 280px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="sourceOptions" style="width: 220px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="10"
      empty-title="没有安装任何插件"
      empty-desc="插件市场默认关闭（企业与个人均需显式开启），组织私仓默认可用；也可从本地文件以开发模式加载。"
      empty-action="打开开发者控制台"
      example-task="从私仓安装 com.acme.k8s-ops 以获得集群巡检面板与策略规则"
      what="插件清单加载失败"
      why="插件目录中存在清单 schema 校验失败的条目（plugin.json 缺少 kernel.compatible）。"
      how="可重试；或查看「装载日志」定位失败步骤。"
      trace-id="trace-plugin-manifest-2c7a"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="router.push('/extension/plugins/dev-console')"
    >
      <Table row-key="id" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <div class="oc-flex" style="gap: 6px">
              <Button size="small" variant="text" @click="router.push({ path: '/extension/plugins/detail', query: { id: row.id } })">{{ row.name }}</Button>
              <Tag size="small" variant="outline" class="oc-mono">{{ row.version }}</Tag>
              <Tag v-if="row.reloadable" size="small" theme="primary" variant="light-outline">可热重载</Tag>
            </div>
            <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.id }} · {{ row.author }}</span>
          </div>
        </template>
        <template #source="{ row }"><Tag size="small" variant="outline">{{ PLUGIN_SOURCE_LABEL[row.source] }}</Tag></template>
        <template #host="{ row }"><span style="font-size: 12px">{{ PLUGIN_HOST_LABEL[row.kernel.hostMode] }}</span></template>
        <template #version="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">内核 {{ row.kernel.compatible }}</span>
            <span class="oc-muted" style="font-size: 11px">上一版本 {{ row.previousVersion ?? '首次安装' }}</span>
          </div>
        </template>
        <template #health="{ row }">
          <div class="oc-stack" style="gap: 3px">
            <Tag size="small" :theme="(PLUGIN_HEALTH_THEME as Record<string, TagTheme>)[row.health] ?? 'default'" variant="light-outline">{{ row.health }}</Tag>
            <Tooltip :content="row.healthReason">
              <span class="oc-muted oc-clamp-2" style="font-size: 11px; max-width: 160px">{{ row.healthReason }}</span>
            </Tooltip>
            <Tag v-if="row.circuitState === 'open'" size="small" theme="danger" variant="light-outline">熔断 open</Tag>
          </div>
        </template>
        <template #sig="{ row }">
          <Tooltip :content="row.signature.reason ?? row.signature.signer">
            <Tag size="small" :theme="stTheme(row.signature.state)" variant="light-outline">{{ (SIGNATURE_LABEL as Record<string, string>)[row.signature.state] }}</Tag>
          </Tooltip>
        </template>
        <template #enabled="{ row }">
          <Popconfirm
            :content="disabled.includes(row.id) ? '启用将装配扩展点并注入配置与密钥引用（不影响其它插件）。' : '禁用将卸载装配、保留配置；依赖它的技能随之中止。'"
            @confirm="toggle(row.id, row.name, disabled.includes(row.id))"
          >
            <Button size="small" variant="text">{{ disabled.includes(row.id) ? '启用' : '禁用' }}</Button>
          </Popconfirm>
        </template>
        <template #ops="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Button size="small" variant="text" @click="router.push({ path: '/extension/plugins/detail', query: { id: row.id } })">详情</Button>
            <Button size="small" variant="text" @click="router.push({ path: '/extension/plugins/load-log', query: { id: row.id } })">装载日志</Button>
            <Button size="small" variant="text" @click="router.push({ path: '/extension/plugins/upgrade', query: { id: row.id } })">升级</Button>
          </div>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
