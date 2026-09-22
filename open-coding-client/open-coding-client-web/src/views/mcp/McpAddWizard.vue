<script setup lang="ts">
/**
 * 添加 MCP 服务器向导（C-05）：来源 → 传输与优先级 → 网络白名单与沙箱档 → 凭证注入 → 预检与启用。
 * 溯源：卷 09 D-MCP-1/2/5/7 + §4.4 安全模型（默认不接受未知服务器；本地 stdio 默认沙箱）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin, RadioButton, RadioGroup, Select, StepItem, Steps, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';

const router = useRouter();
const step = ref(0);
const form = ref({
  name: 'acme-internal-search',
  origin: 'command' as 'command' | 'npm' | 'pip' | 'container',
  transport: 'stdio' as 'stdio' | 'http' | 'sse' | 'ws',
  endpoint: 'npx -y @acme/mcp-search@1.4.0',
  priority: 'stdio',
  whitelist: ['search.internal.acme.com'],
  whitelistDraft: '',
  sandbox: 'L1',
  auth: 'envKey' as 'envKey' | 'oauthCode' | 'deviceCode' | 'serviceCredential',
  tokenRef: 'secret://org/internal-search/apiKey',
  submitForReview: true,
});
const precheck = ref<'idle' | 'running' | 'done'>('idle');
const precheckResult = ref([
  { step: '1 · 来源与版本解析', ok: true, detail: 'npm 包 @acme/mcp-search@1.4.0，来源已记录（供应链可追溯）' },
  { step: '2 · 传输连接', ok: true, detail: 'stdio 进程在沙箱 L1 内启动成功' },
  { step: '3 · 协议握手', ok: true, detail: '协商协议版本 2025-06-18' },
  { step: '4 · 能力发现', ok: true, detail: 'tools: 2 · resources: 1 · prompts: 0' },
  { step: '5 · 网络白名单校验', ok: true, detail: '声明域名均在企业白名单内' },
]);

const originOptions = [
  { value: 'command', label: '已有命令（默认，最安全）' },
  { value: 'npm', label: 'npm 内置安装（记录包名与版本）' },
  { value: 'pip', label: 'pip 内置安装（记录包名与版本）' },
  { value: 'container', label: '容器镜像（企业推荐隔离形态）' },
];

const canNext = computed(() => {
  if (step.value === 0) return Boolean(form.value.name && form.value.origin);
  if (step.value === 1) return Boolean(form.value.transport && form.value.endpoint);
  if (step.value === 2) return form.value.whitelist.length > 0;
  if (step.value === 3) return Boolean(form.value.tokenRef.startsWith('secret://'));
  return precheck.value === 'done';
});

function addWhitelist() {
  const v = form.value.whitelistDraft.trim();
  if (!v) return;
  if (!form.value.whitelist.includes(v)) form.value.whitelist.push(v);
  form.value.whitelistDraft = '';
}

function runPrecheck() {
  precheck.value = 'running';
  window.setTimeout(() => {
    precheck.value = 'done';
    MessagePlugin.success('预检通过：可启用（启用后并行启动，不阻塞内核）');
  }, 900);
}

function enable() {
  MessagePlugin.success(`已添加 ${form.value.name}：状态 Configured → Starting → Ready；工具将进入后续轮次上下文`);
  router.push('/extension/mcp');
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/mcp/add', () => true);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="添加 MCP 服务器"
      desc="默认不接受未知服务器；本地 stdio 服务器一律在沙箱内启动，远程服务器域名必须落入网络白名单。"
      volume="卷 09" manifest="C-05" cli="oc mcp add --transport stdio --sandbox L1"
      :status="[{ label: '需显式配置', theme: 'warning' }, { label: '凭证引用式', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/mcp')">取消</Button>
        <Button size="small" variant="outline" :disabled="step === 0" @click="step -= 1">上一步</Button>
        <Button v-if="step < 4" size="small" theme="primary" :disabled="!canNext" @click="step += 1">下一步</Button>
        <Button v-else size="small" theme="primary" :disabled="precheck !== 'done'" @click="enable">启用服务器</Button>
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


    <Steps :current="step" size="small">
      <StepItem title="来源" content="命令 / 包 / 镜像" />
      <StepItem title="传输与优先级" content="stdio/http/sse/ws" />
      <StepItem title="网络与沙箱" content="白名单 + L0–L3" />
      <StepItem title="凭证注入" content="SecretPort 引用" />
      <StepItem title="预检与启用" content="握手 + 能力发现" />
    </Steps>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">步骤 {{ step + 1 }} / 5</h3>

        <div v-if="step === 0" class="oc-stack" style="gap: 10px">
          <Input v-model="form.name" label="服务器名称（唯一）" size="small" placeholder="如 acme-internal-search" />
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">安装来源（记录来源与版本，供应链可追溯）</div>
            <RadioGroup v-model="form.origin">
              <RadioButton v-for="o in originOptions" :key="o.value" :value="o.value">{{ o.label.split('（')[0] }}</RadioButton>
            </RadioGroup>
            <div class="oc-muted" style="font-size: 12px; margin-top: 4px">{{ originOptions.find((o) => o.value === form.origin)?.label }}</div>
          </div>
        </div>

        <div v-else-if="step === 1" class="oc-stack" style="gap: 10px">
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">传输方式（默认按声明优先级协商，HTTP 优先于 SSE）</div>
            <RadioGroup v-model="form.transport">
              <RadioButton value="stdio">stdio 本地进程</RadioButton>
              <RadioButton value="http">http 流式</RadioButton>
              <RadioButton value="sse">sse 兼容</RadioButton>
              <RadioButton value="ws">ws 长连接</RadioButton>
            </RadioGroup>
          </div>
          <Input v-model="form.endpoint" label="启动命令 / 端点" size="small" placeholder="npx -y <pkg>@<version> 或 https://host/mcp" />
          <Input v-model="form.priority" label="协商优先级" size="small" placeholder="如 http → sse" />
        </div>

        <div v-else-if="step === 2" class="oc-stack" style="gap: 10px">
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">网络白名单（远程服务器必须声明；企业网关模式下强制代理）</div>
            <div class="oc-flex" style="gap: 6px">
              <Input v-model="form.whitelistDraft" size="small" placeholder="如 search.internal.acme.com" style="flex: 1" @enter="addWhitelist" />
              <Button size="small" variant="outline" @click="addWhitelist">添加</Button>
            </div>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
              <Tag v-for="w in form.whitelist" :key="w" size="small" variant="outline">{{ w }}</Tag>
              <span v-if="!form.whitelist.length" class="oc-muted" style="font-size: 12px">至少添加 1 个域名（或标记为本地 stdio 无网络需求）</span>
            </div>
          </div>
          <Select
            v-model="form.sandbox" size="small"
            :options="[
              { label: 'L0 只读（无本地执行）', value: 'L0' },
              { label: 'L1 受控（默认，本地 stdio 服务器）', value: 'L1' },
              { label: 'L2 受限写（需说明用途）', value: 'L2' },
              { label: 'L3 完全（企业默认禁止）', value: 'L3' },
            ]"
            label="沙箱档位"
          />
          <Alert theme="warning" message="本地 stdio 服务器是任意代码" description="必须在沙箱内启动（卷 07），受资源限制与路径围栏；不允许以「用户自管」绕过沙箱。" />
        </div>

        <div v-else-if="step === 3" class="oc-stack" style="gap: 10px">
          <Select
            v-model="form.auth" size="small"
            :options="[
              { label: '环境变量密钥（基线）', value: 'envKey' },
              { label: 'OAuth 授权码 + PKCE（有界面）', value: 'oauthCode' },
              { label: '设备码（无界面形态）', value: 'deviceCode' },
              { label: '服务凭证（企业）', value: 'serviceCredential' },
            ]"
            label="认证模式"
          />
          <Input v-model="form.tokenRef" label="凭证引用（secret:// 前缀）" size="small" placeholder="secret://org/<server>/apiKey" />
          <Alert theme="info" message="凭证经 SecretPort 注入，不进入上下文与日志" description="客户端不持有明文；企业网关模式下由网关换发短期令牌。启动时校验必填项，缺失则 Fail-Fast。" />
        </div>

        <div v-else class="oc-stack" style="gap: 10px">
          <Button size="small" theme="primary" variant="outline" :loading="precheck === 'running'" @click="runPrecheck">
            <OcIcon name="bug" size="12px" /> 运行预检
          </Button>
          <div v-for="p in precheckResult" :key="p.step" class="oc-flex" style="gap: 8px; align-items: flex-start">
            <Tag size="small" :theme="precheck === 'done' ? (p.ok ? 'success' : 'danger') : 'default'" variant="light-outline">
              {{ precheck === 'done' && p.ok ? '通过' : precheck === 'idle' ? '待检' : '检查中' }}
            </Tag>
            <div>
              <div style="font-size: 13px">{{ p.step }}</div>
              <div class="oc-muted" style="font-size: 12px">{{ precheck === 'done' ? p.detail : '等待预检执行' }}</div>
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <CliHint command="oc mcp add --dry-run --transport stdio" />
            <span class="oc-muted" style="font-size: 12px">预检不产生真实调用副作用（能力发现为只读方法）</span>
          </div>
        </div>
      </div>

      <div class="oc-stack" style="gap: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">当前配置摘要</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'name', label: '名称', value: form.name, mono: true },
              { key: 'origin', label: '来源', value: originOptions.find((o) => o.value === form.origin)?.label ?? '' },
              { key: 'transport', label: '传输', value: form.transport, mono: true },
              { key: 'endpoint', label: '命令 / 端点', value: form.endpoint, mono: true },
              { key: 'whitelist', label: '网络白名单', value: form.whitelist.join('、') || '—' },
              { key: 'sandbox', label: '沙箱档位', value: form.sandbox, tag: { text: form.sandbox, theme: form.sandbox === 'L1' ? 'success' : 'warning' } },
              { key: 'auth', label: '认证模式', value: form.auth },
              { key: 'token', label: '凭证引用', value: form.tokenRef, secretRef: true },
            ]"
          />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">安全默认值（不可绕过）</h3>
          <div class="oc-kv">
            <span class="oc-kv__k">默认不接受未知服务器</span><span>需显式配置或企业网关白名单</span>
            <span class="oc-kv__k">本地服务器默认沙箱</span><span>L1 起，受资源限制与路径围栏</span>
            <span class="oc-kv__k">写类工具默认关闭</span><span>对外暴露仅只读；写类需策略 + 每次审批</span>
            <span class="oc-kv__k">凭证不落地</span><span>仅引用名进入配置，明文仅存 SecretPort</span>
          </div>
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
