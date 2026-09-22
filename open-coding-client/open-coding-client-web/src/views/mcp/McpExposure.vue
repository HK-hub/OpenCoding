<script setup lang="ts">
/**
 * 对外暴露矩阵（C-08）：OpenCoding as MCP Server —— 只读优先、写类默认关闭、任务级走 A2A。
 * 溯源：卷 09 §4.5 对外暴露表；每一项都可开关且变更留痕，越权调用显式拒绝 + 审计。
 */
import { computed, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { fmtTime } from '@/components/extension/useExtList';

interface ExposureRow {
  key: string;
  label: string;
  defaultValue: boolean;
  enabled: boolean;
  scope: string;
  note: string;
}

const rows = ref<ExposureRow[]>([
  { key: 'readonlyTools', label: '只读工具（读文件/检索/知识/记忆召回）', defaultValue: true, enabled: true, scope: 'org', note: '供外部 Agent 复用；需认证（API Key + scope）' },
  { key: 'resources', label: '资源（工作区文件树、知识摘要）', defaultValue: false, enabled: true, scope: 'project', note: '需显式授权；按 scope 授权并可随时撤销' },
  { key: 'prompts', label: '提示词资产（组织级）', defaultValue: false, enabled: false, scope: 'org', note: '默认关闭；企业可开启共享' },
  { key: 'writeTools', label: '写类工具（编辑/命令）', defaultValue: false, enabled: false, scope: 'org', note: '默认关闭；开启需策略 + 每次审批（不批量放行）' },
  { key: 'sessionControl', label: '会话控制（提交任务）', defaultValue: false, enabled: false, scope: 'project', note: '默认关闭；任务级互操作走 A2A（卷 23）' },
]);

const apiKeyScope = ref('readonly:workspace,readonly:kb');
const externalCalls = computed(() =>
  extensionData.mcpServers
    .flatMap((s) => s.callLogs.map((c) => ({ ...c, server: s.name })))
    .filter((c) => c.egressBytes > 0)
    .slice(0, 8),
);

const exposed = computed(() => rows.value.filter((r) => r.enabled));

function toggle(row: ExposureRow, v: boolean) {
  row.enabled = v;
  MessagePlugin[
    v
      ? row.key === 'writeTools' || row.key === 'sessionControl' ? 'warning' : 'success'
      : 'info'
  ](
    v
      ? `已开启暴露：${row.label}（scope=${row.scope}）${row.key === 'writeTools' ? ' —— 写类每次调用仍需审批，不可批量放行' : ''}`
      : `已关闭暴露：${row.label}（外部调用将收到 403 并记入审计）`,
  );
}

function rotateKey() {
  MessagePlugin.success('已轮换对外 API Key：旧 Key 立即失效（引用式更新，明文仅显示一次）');
}

/** 复制对外端点：真正写入剪贴板成功后才提示；剪贴板不可用则降级提示手动复制（不谎报已复制） */
async function copyEndpoint() {
  try {
    await navigator.clipboard.writeText('https://<host>/mcp');
    MessagePlugin.success('已复制对外端点：https://<host>/mcp（需认证）');
  } catch {
    MessagePlugin.info('复制失败，请手动复制');
  }
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/mcp/exposure', () => rows.value.length > 0);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="对外暴露矩阵"
      desc="把 OpenCoding 能力暴露给外部 Agent：只读优先、写类默认关闭；所有外部调用经认证 + 审计 + 配额。"
      volume="卷 09" manifest="C-08" cli="oc mcp serve --expose readonly --scope org"
      :status="[{ label: `已暴露 ${exposed.length} 项`, theme: 'primary' }, { label: '写类默认关闭', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="copyEndpoint">复制端点</Button>
        <Popconfirm content="轮换后旧 Key 立即失效，外部集成需同步更新；是否继续？" @confirm="rotateKey">
          <Button size="small" theme="primary">轮换 API Key</Button>
        </Popconfirm>
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
      theme="info"
      message="默认最小暴露"
      description="只读工具默认开启（需认证）；写类与会话控制默认关闭——开启即扩大攻击面，需策略支持且逐次审批。"
    />

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">暴露项开关矩阵</h3>
        <Table
          row-key="key" size="small"
          :columns="[
            { colKey: 'label', title: '暴露项', width: 300 },
            { colKey: 'scope', title: 'scope', width: 110 , cell: 'scopeCell' },
            { colKey: 'def', title: '默认值', width: 100 },
            { colKey: 'enabled', title: '当前', width: 90 },
          ]"
          :data="rows"
        >
          <template #label="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <span style="font-size: 13px">{{ row.label }}</span>
              <span class="oc-muted" style="font-size: 11px">{{ row.note }}</span>
            </div>
          </template>
          <template #scopeCell="{ row }"><Tag size="small" variant="outline">{{ row.scope }}</Tag></template>
          <template #def="{ row }">
            <Tag size="small" :theme="row.defaultValue ? 'success' : 'default'" variant="light-outline">{{ row.defaultValue ? '开启' : '关闭' }}</Tag>
          </template>
          <template #enabled="{ row }">
            <Tooltip :content="row.key === 'writeTools' ? '写类工具每次调用仍需审批（R1–R4 逐调用决策）' : '变更立即生效并写入审计'">
              <Switch :value="row.enabled" @change="(v) => toggle(row, Boolean(v))" />
            </Tooltip>
          </template>
        </Table>
      </div>

      <div class="oc-stack" style="gap: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">认证与授权</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'mode', label: '认证模式', value: 'API Key + scope（企业可接 OAuth）' },
              { key: 'keyref', label: 'API Key 引用', value: 'secret://exposure/mcp-server/apiKey', secretRef: true },
              { key: 'rotated', label: '最近轮换', value: fmtTime(new Date(Date.now() - 26 * 86400_000).toISOString()) },
              { key: 'endpoint', label: '对外端点', value: 'https://<host>/mcp（TLS 固定 + 证书校验）', mono: true },
            ]"
          />
          <div style="margin-top: 10px">
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">scope（空格/逗号分隔，前置权限过滤）</div>
            <Select
              v-model="apiKeyScope" size="small"
              :options="[
                { label: 'readonly:workspace,readonly:kb', value: 'readonly:workspace,readonly:kb' },
                { label: 'readonly:workspace', value: 'readonly:workspace' },
                { label: 'readonly:kb', value: 'readonly:kb' },
              ]"
            />
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            外部调用审计（最近）
            <Tag size="small" variant="outline">外发字节 &gt; 0</Tag>
          </h3>
          <div v-for="c in externalCalls" :key="c.id" class="oc-flex oc-flex--wrap" style="gap: 6px; padding: 5px 0; font-size: 12px; border-bottom: 1px dashed var(--oc-border)">
            <span class="oc-mono">{{ c.server }}</span>
            <span class="oc-mono oc-muted">{{ c.method }}</span>
            <span class="oc-grow oc-muted">外发 {{ c.egressBytes }} B</span>
            <CopyableId :id="c.decisionRef" label="决策" :short="12" />
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            <OcIcon name="lock" size="12px" /> 外部调用默认拒绝未授权 scope；拒绝返回 403 并记录（含调用方标识与 traceId）。
          </div>
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
