<script setup lang="ts">
/**
 * MCP 资源订阅（C-10）：mcp:// 资源 + 订阅变更 + roots 路径围栏。
 * 溯源：卷 09 §4.3 能力映射（resources 经 read_resource 访问、可订阅变更）+ 卷 07 路径围栏。
 */
import { computed, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { fmtTime, useExtList } from '@/components/extension/useExtList';

const rows = computed(() =>
  extensionData.mcpServers.flatMap((s) =>
    s.resources.map((r) => ({ ...r, server: s.name, serverId: s.serverId, sandbox: s.sandboxTier })),
  ),
);

const { keyword, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(rows.value, {
  persistKey: 'mcp-resources',
  pageSize: 12,
  match: (r, kw) => !kw || `${r.uri}${r.name}${r.server}${r.rootsScope}`.toLowerCase().includes(kw),
});

const subscribed = ref<string[]>(rows.value.filter((r) => r.subscribed).map((r) => r.uri));
const stats = computed(() => ({
  total: rows.value.length,
  sub: subscribed.value.length,
  fenced: rows.value.filter((r) => r.rootsScope.includes('围栏')).length,
  servers: new Set(rows.value.map((r) => r.server)).size,
}));

function toggle(uri: string, name: string, v: boolean) {
  if (v && !subscribed.value.includes(uri)) subscribed.value.push(uri);
  if (!v) subscribed.value = subscribed.value.filter((u) => u !== uri);
  MessagePlugin.info(
    v
      ? `已订阅 ${name}：变更将产生 mcp.resource.changed 事件并注入后续轮次`
      : `已取消订阅 ${name}：不再接收变更通知（资源本身仍可显式读取）`,
  );
}

const refreshing = ref(false);
const lastRefreshAt = ref('');
const refreshDelta = ref<number | null>(null);

/** 刷新资源列表：复用「重载」同一数据源（resources/list.reload），完成后回填最近刷新时间与条目差异 */
function refreshResources() {
  refreshing.value = true;
  const before = matched.value.length;
  reload();
  window.setTimeout(() => {
    refreshing.value = false;
    refreshDelta.value = matched.value.length - before;
    lastRefreshAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    MessagePlugin.success(`已刷新资源列表（resources/list，只读）：${matched.value.length} 条，新增 ${refreshDelta.value} 项`);
  }, 320);
}

const readOpen = ref(false);
const readTarget = ref<(typeof rows.value)[number] | null>(null);
const lastReadAt = ref('');

/** 读取资源：打开弹窗就地展示 read_resource 的元数据与内容摘要，并记录最近读取时间 */
function readResource(row: (typeof rows.value)[number]) {
  readTarget.value = row;
  readOpen.value = true;
  lastReadAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  MessagePlugin.success(`已读取 ${row.name}（read_resource，读权限 + 服务器访问控制双重校验）`);
}

/** 读取弹窗展示的 mock 内容：与元数据同源（uri / 服务器 / 围栏 / 最近变更） */
const readContent = computed(() =>
  readTarget.value
    ? [
        `# ${readTarget.value.name}`,
        '',
        `资源 URI：${readTarget.value.uri}`,
        `读取方式：read_resource（只读；服务器 ${readTarget.value.server} · 沙箱 ${readTarget.value.sandbox}）`,
        `roots 围栏：${readTarget.value.rootsScope}`,
        `最近变更：${fmtTime(readTarget.value.lastChangedAt)}`,
        '',
        '内容摘要（mock）：以 MCP content 结构返回；大资源自动外置为工件引用，仅注入引用与哈希，避免污染上下文。',
      ].join('\n')
    : '',
);

const columns = [
  { colKey: 'uri', title: '资源 URI', width: 340 },
  { colKey: 'name', title: '名称', width: 240 },
  { colKey: 'server', title: '服务器', width: 170 },
  { colKey: 'fence', title: 'roots 围栏', width: 220 },
  { colKey: 'changed', title: '最近变更', width: 180 },
  { colKey: 'sub', title: '订阅', width: 90 },
  { colKey: 'ops', title: '操作', width: 130 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="MCP 资源订阅"
      desc="资源以 mcp://<server>/<uri> 虚拟化，经 read_resource 访问；roots 约定决定服务器可见的工作区路径范围。"
      volume="卷 09" manifest="C-10" cli="oc mcp resources --subscriptions"
      :status="[{ label: `已订阅 ${stats.sub}`, theme: 'success' }, { label: '围栏校验开启', theme: 'primary' }, { label: lastReadAt ? `最近读取 ${lastReadAt}` : '最近读取 —', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="refreshing" @click="refreshResources">刷新资源</Button>
        <Button size="small" variant="text" @click="reload">重载</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="资源总数" :value="stats.total" unit="个" icon="folder-open" :trend="[4, 5, 6, 7, 8, 9, stats.total]" />
      <StatCard label="已订阅" :value="stats.sub" unit="个" icon="notification" hint="变更产生事件并注入后续轮次" />
      <StatCard label="围栏内资源" :value="stats.fenced" unit="个" icon="lock" hint="roots 路径围栏内，越界拒绝" />
      <StatCard label="来源服务器" :value="stats.servers" unit="个" icon="server" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="过滤 URI / 名称 / 服务器，如 k8s-gateway" clearable style="width: 320px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
        <span v-if="lastRefreshAt" class="oc-muted" style="font-size: 12px">最近刷新 {{ lastRefreshAt }}（较上次新增 {{ refreshDelta }} 项）</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="12"
      empty-title="没有 MCP 资源"
      empty-desc="当前接入的服务器均未声明 resources 能力（或未就绪）；工具类服务器不提供资源。"
      empty-action="前往服务器列表"
      example-task="订阅 mcp://k8s-gateway/clusters/prod 以接收命名空间变更"
      what="资源索引加载失败"
      why="resources/list 返回结构不符合 schema（服务器协议版本较旧）。"
      how="可重试；或在「一键诊断」启用兼容层后重新发现。"
      trace-id="trace-mcp-res-51b7"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="MessagePlugin.info('已跳转服务器列表入口（等价命令 oc mcp list）')"
    >
      <Table row-key="uri" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #uri="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.uri }}</span></template>
        <template #server="{ row }">
          <div class="oc-flex" style="gap: 4px">
            <span class="oc-mono" style="font-size: 12px">{{ row.server }}</span>
            <Tag size="small" variant="outline">{{ row.sandbox }}</Tag>
          </div>
        </template>
        <template #fence="{ row }">
          <Tooltip content="服务器声明的 roots 与实际请求路径做围栏校验；越界请求一律拒绝并审计">
            <span class="oc-secondary" style="font-size: 12px">
              <OcIcon name="lock" size="12px" /> {{ row.rootsScope }}
            </span>
          </Tooltip>
        </template>
        <template #changed="{ row }"><span class="oc-muted" style="font-size: 12px">{{ fmtTime(row.lastChangedAt) }}</span></template>
        <template #sub="{ row }">
          <Popconfirm
            :content="subscribed.includes(row.uri) ? '取消订阅后不再接收变更通知（资源仍可显式读取）。' : '订阅后资源变更会注入后续轮次上下文（消耗 token）。'"
            @confirm="toggle(row.uri, row.name, !subscribed.includes(row.uri))"
          >
            <Button size="small" variant="text">{{ subscribed.includes(row.uri) ? '已订阅' : '订阅' }}</Button>
          </Popconfirm>
        </template>
        <template #ops="{ row }">
          <Button size="small" variant="text" @click="readResource(row)">读取</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-card">
      <h3 class="oc-card__title">订阅与围栏规则</h3>
      <div class="oc-kv">
        <span class="oc-kv__k">订阅语义</span><span>服务器注册 URI 变更通知 → 内核生成 mcp.resource.changed 事件 → 注入后续轮次（当前轮次稳定）</span>
        <span class="oc-kv__k">roots 围栏</span><span>服务器仅能看到工作区声明的 roots 路径；越界读取返回拒绝并记录 mcp.policy.denied</span>
        <span class="oc-kv__k">读取权限</span><span>读权限 + 服务器访问控制双校验；敏感路径需 R5 令牌制</span>
        <span class="oc-kv__k">外置</span><span>大资源读取结果外置为工件引用，避免污染上下文</span>
      </div>
      <div class="oc-flex" style="gap: 8px; margin-top: 8px">
        <CopyableId id="evt-mcp-resource-changed-2c19" label="mcp.resource.changed" :short="26" />
        <CopyableId id="trace-mcp-res-fence-7a02" label="越界拒绝 traceId" :short="16" />
      </div>
    </div>

    <Dialog v-model:visible="readOpen" :header="`读取资源：${readTarget?.name ?? ''}（read_resource）`" width="640px" :footer="false">
      <template v-if="readTarget">
        <div class="oc-kv">
          <span class="oc-kv__k">资源 URI</span><span class="oc-mono">{{ readTarget.uri }}</span>
          <span class="oc-kv__k">服务器 / 沙箱</span><span>{{ readTarget.server }} · {{ readTarget.sandbox }}</span>
          <span class="oc-kv__k">roots 围栏</span><span>{{ readTarget.rootsScope }}</span>
          <span class="oc-kv__k">最近变更</span><span>{{ fmtTime(readTarget.lastChangedAt) }}</span>
        </div>
        <pre class="oc-mono" style="margin: 10px 0 0; padding: 8px; background: var(--td-bg-color-secondarycontainer, #f5f5f5); border-radius: 4px; font-size: 12px; white-space: pre-wrap">{{ readContent }}</pre>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">最近读取：{{ lastReadAt }}（读权限 + 服务器访问控制双重校验；越界读取会被拒绝并记入审计）</div>
      </template>
    </Dialog>
  </div>
</template>
