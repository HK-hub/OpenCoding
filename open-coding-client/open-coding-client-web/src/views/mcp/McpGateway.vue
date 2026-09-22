<script setup lang="ts">
/**
 * 企业 MCP 网关（C-07）：白名单 / 审计 / DLP 规则 / 配额 / 统一凭证。
 * 溯源：卷 09 D-MCP-6（企业默认经网关）+ §4.4 网络与凭证要求。
 */
import { computed, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Progress, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { fmtBytes } from '@/components/extension/useExtList';
import { downloadJson } from '@/utils/download';

const gw = extensionData.mcpGateway;
const enabled = ref(gw.enabled);
const proxyMode = ref(gw.mode);
const rules = ref(gw.dlpRules.map((r) => ({ ...r })));
const deniedEvents = computed(() => extensionData.auditEvents.filter((e) => e.type === 'mcp.policy.denied'));

const egressPct = computed(() => Number(((gw.quota.usedEgressMb / gw.quota.dailyEgressMb) * 100).toFixed(1)));

function toggleRule(id: string, v: boolean) {
  const r = rules.value.find((x) => x.id === id);
  if (!r) return;
  MessagePlugin.info(`${r.rule} 已${v ? '启用' : '改为仅审计'}（策略变更写入审计，含操作人与时间）`);
}

function toggleGateway(v: boolean) {
  enabled.value = v;
  MessagePlugin[v ? 'success' : 'warning'](
    v
      ? '网关已启用：所有 MCP 流量经白名单 + 审计 + DLP + 统一凭证'
      : '网关已关闭：将退化为客户端直连（企业合规风险，需管理员二次确认）',
  );
}

const whitelist = ref([...gw.whitelist]);
const syncing = ref(false);
const lastSyncAt = ref('');
const syncDelta = ref<number | null>(null);

/** 同步网关白名单（增量）：短异步对齐网关侧条目，完成后刷新「最近同步」与条目数并提示差异 */
function syncWhitelist() {
  syncing.value = true;
  const before = whitelist.value.length;
  window.setTimeout(() => {
    syncing.value = false;
    syncDelta.value = whitelist.value.length - before;
    lastSyncAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    MessagePlugin.success(`已同步网关白名单（增量）：当前 ${whitelist.value.length} 条，新增 ${syncDelta.value} 条，变更写入审计`);
  }, 600);
}

/** 导出网关审计报告：网关开关 / DLP 规则启停取自本页状态，拒绝事件来自审计数据 */
function exportAudit() {
  const filename = `oc-mcp-gateway-audit-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson(
    {
      gateway: {
        enabled: enabled.value,
        mode: proxyMode.value,
        endpoint: gw.endpoint,
        credentialPolicy: gw.credentialPolicy,
      },
      quota: gw.quota,
      egressPercent: egressPct.value,
      whitelist: gw.whitelist,
      dlpRules: rules.value,
      deniedEvents: deniedEvents.value,
    },
    filename,
  );
  MessagePlugin.success(`已导出网关审计报告（${filename}）`);
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/mcp/gateway', () => true);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="企业 MCP 网关"
      desc="集中治理：白名单、审计、DLP 规则、配额与统一凭证；企业默认开启，个人形态可关闭（关闭即显式降级）。"
      volume="卷 09" manifest="C-07" cli="oc mcp gateway status --json"
      :status="[
        { label: enabled ? '网关已启用（代理模式）' : '网关已关闭：直连', theme: enabled ? 'success' : 'danger' },
        { label: '统一凭证', theme: 'primary' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="syncing" @click="syncWhitelist">同步白名单</Button>
        <Button size="small" variant="outline" @click="exportAudit">导出审计</Button>
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


    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          网关开关与模式
          <Switch :value="enabled" @change="(v) => toggleGateway(Boolean(v))" />
        </h3>
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'ep', label: '网关端点', value: gw.endpoint, mono: true, copyable: true },
            { key: 'mode', label: '代理模式', value: `${proxyMode}（客户端不持有服务器原始密钥）` },
            { key: 'cred', label: '凭证策略', value: gw.credentialPolicy },
            { key: 'qps', label: '配额（QPS）', value: `${gw.quota.qps} QPS（超出按 429 拒绝并计入审计）` },
          ]"
        />
        <Alert
          v-if="!enabled"
          style="margin-top: 10px"
          theme="error"
          message="网关关闭 = 客户端直连：DLP 与统一凭证失效"
          description="此状态为显式降级（页面与状态栏标注），企业策略默认禁止；重新开启需管理员操作并留下审计记录。"
        />
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">当日外发配额</h3>
        <div class="oc-flex" style="gap: 10px">
          <Progress :percentage="egressPct" theme="line" :status="egressPct > 80 ? 'warning' : 'active'" style="flex: 1" />
          <span class="oc-mono" style="font-size: 12px">{{ fmtBytes(gw.quota.usedEgressMb * 1024 * 1024) }} / {{ gw.quota.dailyEgressMb }} MB</span>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          配额按组织/项目/服务器三级分解；超限时按策略拒绝（不静默排队到次日）。
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 10px">
          <span class="oc-secondary" style="font-size: 12px">网络白名单（{{ whitelist.length }}）：</span>
          <Tag v-for="w in whitelist" :key="w" size="small" variant="outline">{{ w }}</Tag>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
          最近同步：{{ lastSyncAt || '尚未同步' }}{{ syncDelta !== null ? `（本次新增 ${syncDelta} 条）` : '' }}
        </div>
      </div>
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">
        DLP 规则（外发内容检查）
        <span class="oc-muted" style="font-size: 12px">block=阻断并审计；redact=脱敏后外发；audit=仅留痕</span>
      </h3>
      <Table
        row-key="id" size="small"
        :columns="[
          { colKey: 'rule', title: '规则', width: 380 },
          { colKey: 'action', title: '动作', width: 120 },
          { colKey: 'hits', title: '命中次数', width: 120 },
          { colKey: 'enabled', title: '启用', width: 90 },
        ]"
        :data="rules"
      >
        <template #action="{ row }">
          <Tag size="small" :theme="row.action === 'block' ? 'danger' : row.action === 'redact' ? 'warning' : 'default'" variant="light-outline">
            {{ row.action }}
          </Tag>
        </template>
        <template #hits="{ row }"><span class="oc-mono">{{ row.hits }}</span></template>
        <template #enabled="{ row }">
          <Switch
            :value="row.action !== 'audit'"
            @change="(v) => { row.action = v ? (row.id === 'DLP-02' ? 'redact' : 'block') : 'audit'; toggleRule(row.id, Boolean(v)); }"
          />
        </template>
      </Table>
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">
        策略拒绝审计（mcp.policy.denied）
        <Tag size="small" theme="danger" variant="light-outline">{{ deniedEvents.length }} 条</Tag>
      </h3>
      <div v-for="e in deniedEvents" :key="e.id" class="oc-flex oc-flex--wrap" style="gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--oc-border)">
        <Tag size="small" theme="danger" variant="light-outline">{{ e.decision }}</Tag>
        <span class="oc-mono" style="font-size: 12px">{{ e.subject }}</span>
        <span class="oc-grow oc-secondary" style="font-size: 12px">{{ e.detail }}</span>
        <CopyableId :id="e.traceId" label="traceId" :short="14" />
      </div>
      <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
        <OcIcon name="secured" size="12px" /> 拒绝即显式呈现：页面可见、审计可查，替代路径在详情中给出（如改动 GitOps 而非直连集群）。
      </div>
    </div>
    </StateShell>
  </div>
</template>
