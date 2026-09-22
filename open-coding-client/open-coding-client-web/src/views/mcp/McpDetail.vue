<script setup lang="ts">
/**
 * MCP 服务器详情（C-02）：六 Tab —— 概览 / 工具发现 / 资源订阅 / 反向请求 / 认证与配置来源 / 审计日志。
 * 溯源：卷 09 §4.3 工具接入与上下文同步 / §4.4 安全模型 / D-MCP-3 能力映射。
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, Table, TabPanel, Tabs, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { AUTH_LABEL, MCP_STATE_LABEL, MCP_STATE_THEME, TRANSPORT_LABEL, fmtBytes, fmtMs, type TagTheme } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const servers = extensionData.mcpServers;
const id = computed(() => String(route.query.id ?? servers[0].serverId));
const server = computed(() => servers.find((s) => s.serverId === id.value) ?? servers[0]);
const tab = computed({
  get: () => String(route.query.tab ?? 'overview'),
  set: (v: string) => router.replace({ query: { ...route.query, tab: v } }),
});

function stTheme(v: string): TagTheme {
  return (MCP_STATE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/mcp/detail', () => !route.query.id || servers.some((s) => s.serverId === route.query.id));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`MCP · ${server.name}`"
      :desc="server.stateReason"
      volume="卷 09" manifest="C-02" :cli="`oc mcp show ${server.serverId}`"
      :status="[
        { label: TRANSPORT_LABEL[server.transport], theme: 'default' },
        { label: MCP_STATE_LABEL[server.state], theme: stTheme(server.state) },
        { label: `sandbox ${server.sandboxTier}`, theme: 'default' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/mcp')">返回列表</Button>
        <Button size="small" variant="outline" @click="router.push({ path: '/extension/mcp/diagnose', query: { id: server.serverId } })">一键诊断</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="pageState"
      :trace-id="pageTraceId"
      empty-title="对象不存在或已被清理"
      empty-desc="按链接标识未命中：可能已被卸载、清理或标识有误；请从列表重新进入。"
      what="页面数据加载失败"
      why="该页依赖的索引 / 配置读取失败（不影响其它模块与已加载数据）。"
      how="可重试；持续失败请导出诊断包并附 traceId 便于定位。"
      @retry="reloadPage"
    >


    <Alert
      v-if="server.state === 'Failed' || server.state === 'Degraded'"
      :theme="server.state === 'Failed' ? 'error' : 'warning'"
      :message="server.state === 'Failed' ? '该服务器已隔离（不阻塞内核与其他服务器）' : '该服务器已降级，部分能力不可用'"
      :description="`${server.stateReason}；修复建议见「一键诊断」。`"
    />

    <Tabs v-model:value="tab">
      <TabPanel value="overview" label="概览">
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">连接与生命周期</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'id', label: '服务器标识', value: server.serverId, mono: true, copyable: true },
                { key: 'tr', label: '传输（协商优先级）', value: `${server.transport}（${server.transportPriority.join(' → ')}）` },
                { key: 'lc', label: '生命周期模式', value: `${server.lifecycleMode} · 内核托管不阻塞启动` },
                { key: 'st', label: '状态', value: MCP_STATE_LABEL[server.state], tag: { text: server.state, theme: stTheme(server.state) } },
                { key: 'cap', label: '已发现能力', value: server.capabilitiesDiscovered.join(' / ') || '未启用，未执行发现' },
                { key: 'cfg', label: '配置来源（三级合并）', value: `${server.configSource} · ${server.configPath}`, mono: true },
              ]"
            />
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">隔离与健康</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'to', label: '调用超时', value: `${server.limits.timeoutMs} ms` },
                { key: 'cc', label: '并发上限', value: `${server.limits.concurrencyMax}` },
                { key: 'quota', label: '输出限额', value: `${server.limits.outputQuotaKb} KB（超出外置为工件）` },
                { key: 'cb', label: '熔断', value: `${server.circuitBreaker.state}（${server.circuitBreaker.failures}/${server.circuitBreaker.windowSec}s）`, hint: '窗口内失败计数' },
                { key: 'hb', label: '健康探测', value: server.health.healthy ? `健康 · ${server.health.probeLatencyMs}ms` : `异常 · 连续失败 ${server.health.consecutiveFailures} 次`, tag: { text: server.health.healthy ? 'healthy' : 'unhealthy', theme: server.health.healthy ? 'success' : 'danger' } },
                { key: 'restart', label: '重启与退避', value: `累计 ${server.restart.total} 次 · 退避 ${server.restart.backoffSec}s` },
              ]"
            />
            <div v-if="server.networkWhitelist.length" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 10px">
              <span class="oc-secondary" style="font-size: 12px">网络白名单：</span>
              <Tag v-for="w in server.networkWhitelist" :key="w" size="small" variant="outline">{{ w }}</Tag>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="tools" label="工具发现">
        <div class="oc-card">
          <h3 class="oc-card__title">
            工具映射（tools → ToolSpec，走统一管线）
            <span class="oc-muted" style="font-size: 12px">变更通知 tools/list_changed 只影响后续轮次</span>
          </h3>
          <Alert
            v-if="server.tools.some((t) => t.conflictWithBuiltin)"
            theme="warning"
            message="存在与内置工具同名项：内置优先 + 命名空间化"
            description="冲突项以 server.tool 命名对外暴露，并生成告警；模型侧使用别名以避免歧义。"
          />
          <Table
            row-key="rawName" size="small"
            :columns="[
              { colKey: 'rawName', title: '原始名', width: 210 },
              { colKey: 'namespace', title: '命名空间', width: 250 },
              { colKey: 'alias', title: '别名', width: 150 },
              { colKey: 'risk', title: '风险提示', width: 110 },
              { colKey: 'conflict', title: '与内置冲突', width: 150 },
              { colKey: 'stat', title: '调用 / 错误率', width: 150 },
            ]"
            :data="server.tools"
            style="margin-top: 10px"
          >
            <template #rawName="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.rawName }}</span></template>
            <template #namespace="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.namespace }}</span></template>
            <template #alias="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.alias }}</span></template>
            <template #risk="{ row }"><RiskBadge :level="row.riskHint" /></template>
            <template #conflict="{ row }">
              <span v-if="row.conflictWithBuiltin" class="oc-secondary" style="font-size: 12px">{{ row.conflictNote }}</span>
              <Tag v-else size="small" variant="outline">无</Tag>
            </template>
            <template #stat="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.callCount }} 次 · {{ row.errorRate }}%</span></template>
          </Table>
          <div v-if="!server.tools.length" class="oc-muted" style="font-size: 12px; padding: 12px">
            该服务器未就绪（{{ server.state }}），未执行能力发现；启用后自动 tools/list。
          </div>
        </div>
      </TabPanel>

      <TabPanel value="resources" label="资源订阅">
        <div class="oc-card">
          <h3 class="oc-card__title">
            资源（mcp:// 虚拟资源，经 read_resource 访问）
            <span class="oc-muted" style="font-size: 12px">roots 路径围栏校验，越界拒绝</span>
          </h3>
          <Table
            row-key="uri" size="small"
            :columns="[
              { colKey: 'uri', title: 'URI', width: 320 },
              { colKey: 'name', title: '名称', width: 240 },
              { colKey: 'subscribed', title: '订阅', width: 100 },
              { colKey: 'scope', title: 'roots 围栏', width: 240 },
              { colKey: 'changed', title: '最近变更', width: 180 },
            ]"
            :data="server.resources"
          >
            <template #uri="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.uri }}</span></template>
            <template #subscribed="{ row }">
              <Tag size="small" :theme="row.subscribed ? 'success' : 'default'" variant="light-outline">{{ row.subscribed ? '已订阅' : '未订阅' }}</Tag>
            </template>
            <template #changed="{ row }"><span class="oc-muted" style="font-size: 12px">{{ new Date(row.lastChangedAt).toLocaleString('zh-CN') }}</span></template>
          </Table>
          <div v-if="!server.resources.length" class="oc-muted" style="font-size: 12px; padding: 12px">当前无资源（该服务器未声明 resources 能力）。</div>
          <Button size="small" variant="text" style="margin-top: 8px" @click="router.push('/extension/mcp/resources')">打开资源订阅总览</Button>
        </div>
      </TabPanel>

      <TabPanel value="reverse" label="反向请求">
        <div class="oc-card">
          <h3 class="oc-card__title">
            反向请求记录（sampling / elicitation）
            <span class="oc-muted" style="font-size: 12px">sampling 计入会话预算；elicitation 需用户在场</span>
          </h3>
          <Table
            row-key="id" size="small"
            :columns="[
              { colKey: 'type', title: '类型', width: 120 },
              { colKey: 'detail', title: '请求内容' },
              { colKey: 'budget', title: '预算影响', width: 190 },
              { colKey: 'decision', title: '用户决定', width: 120 },
              { colKey: 'at', title: '时间', width: 180 },
            ]"
            :data="server.reverseRequests"
          >
            <template #type="{ row }"><Tag size="small" variant="outline">{{ row.type }}</Tag></template>
            <template #decision="{ row }">
              <Tag size="small" :theme="row.userDecision === 'allowed' ? 'success' : row.userDecision === 'denied' ? 'danger' : 'warning'" variant="light-outline">
                {{ row.userDecision }}
              </Tag>
            </template>
            <template #at="{ row }"><span class="oc-muted" style="font-size: 12px">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
          </Table>
          <Button size="small" variant="text" style="margin-top: 8px" @click="router.push('/extension/mcp/reverse')">打开反向请求策略</Button>
        </div>
      </TabPanel>

      <TabPanel value="auth" label="认证与配置来源">
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">认证（凭证经 SecretPort 注入，不落地）</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'mode', label: '认证模式', value: AUTH_LABEL[server.auth.mode] },
                { key: 'ref', label: '凭证引用', value: server.auth.tokenRef, secretRef: true },
                { key: 'scopes', label: '授权范围', value: server.auth.scopes.join(' / ') },
                { key: 'exp', label: '令牌有效期', value: server.auth.expiresAt ? new Date(server.auth.expiresAt).toLocaleString('zh-CN') : '长期（服务凭证，按需轮换）' },
              ]"
            />
            <Alert style="margin-top: 10px" theme="info" message="凭证不进上下文与日志" description="调用参数可能含工作区内容 → 按 R3 外发风险判定与审计；企业可配置「禁止外发源代码」类 DLP 规则。" />
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">配置三级合并（组织可锁定）</h3>
            <div class="oc-stack" style="gap: 8px">
              <div class="oc-flex" style="gap: 8px">
                <Tag size="small" :theme="server.configSource === 'org' ? 'primary' : 'default'" variant="light-outline">组织</Tag>
                <span style="font-size: 12px">oc://org-registry/mcp.json（白名单与凭证策略，可锁定）</span>
              </div>
              <div class="oc-flex" style="gap: 8px">
                <Tag size="small" :theme="server.configSource === 'project' ? 'primary' : 'default'" variant="light-outline">项目</Tag>
                <span style="font-size: 12px">.oc/mcp.json（随仓库版本化，团队共享）</span>
              </div>
              <div class="oc-flex" style="gap: 8px">
                <Tag size="small" :theme="server.configSource === 'user' ? 'primary' : 'default'" variant="light-outline">用户</Tag>
                <span style="font-size: 12px">~/.oc/mcp.json（个人配置，可被组织策略覆盖）</span>
              </div>
              <div class="oc-muted" style="font-size: 12px">生效来源：{{ server.configSource }}；合并顺序 组织 → 项目 → 用户，组织可锁定不可覆盖项。</div>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="audit" label="审计日志">
        <div class="oc-card">
          <h3 class="oc-card__title">
            调用审计（参数摘要脱敏 + 决策引用）
            <span class="oc-muted" style="font-size: 12px">任一调用可回溯服务器、方法、外发字节与决策</span>
          </h3>
          <Table
            row-key="id" size="small"
            :columns="[
              { colKey: 'method', title: '方法 / 工具', width: 230 },
              { colKey: 'digest', title: '参数摘要', width: 200 },
              { colKey: 'egress', title: '外发字节', width: 120 },
              { colKey: 'decision', title: '决策引用', width: 170 },
              { colKey: 'duration', title: '耗时', width: 110 },
              { colKey: 'status', title: '状态', width: 130 },
            ]"
            :data="server.callLogs"
          >
            <template #method="{ row }">
              <div class="oc-stack" style="gap: 2px">
                <span class="oc-mono" style="font-size: 12px">{{ row.method }}</span>
                <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.tool }}</span>
              </div>
            </template>
            <template #digest="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.paramsDigest }}</span></template>
            <template #egress="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtBytes(row.egressBytes) }}</span></template>
            <template #decision="{ row }">
              <CopyableId :id="row.decisionRef" label="决策引用" :short="16" />
              <OcIcon v-if="row.status === 'circuit-open'" name="error" size="13px" color="var(--oc-sev-error)" />
            </template>
            <template #duration="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtMs(row.durationMs) }}</span></template>
            <template #status="{ row }">
              <Tag size="small" :theme="row.status === 'ok' ? 'success' : row.status === 'circuit-open' ? 'danger' : 'warning'" variant="light-outline">
                {{ row.status }}{{ row.retries ? ` · 重试 ${row.retries}` : '' }}
              </Tag>
            </template>
          </Table>
          <Button size="small" variant="text" style="margin-top: 8px" @click="router.push({ path: '/extension/mcp/logs', query: { id: server.serverId } })">打开全量调用审计</Button>
        </div>
      </TabPanel>
    </Tabs>
    </StateShell>
  </div>
</template>
