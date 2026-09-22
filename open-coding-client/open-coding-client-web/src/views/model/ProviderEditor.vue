<script setup lang="ts">
/**
 * Provider 编辑（M-02 / 卷 02 §4.6，抽屉形态的独立路由便于深链）：
 * 协议族 / baseUrl / 凭证引用 / 超时与重试覆盖 + 影响面预览 + 配置脱敏预览。
 * 凭证只允许选择引用名，表单中不存在密钥输入框（明文永不经手界面）。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Dialog, Input, InputNumber, MessagePlugin, Popconfirm, Select, Switch, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import type { PageState } from '@/components/gateway/types';
import { PROTOCOL_FAMILY_META, RESOLVER_META, modelData } from '@/mock/data/model';
import type { ProtocolFamily, ProviderData } from '@/mock/data/model';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();
const data = modelData;
const id = String(route.params.id ?? 'new');
const isNew = id === 'new';
const state = ref<PageState>('LOADING');
const saved = ref(false);

/** 凭证轮换：对话框 + 本地轮换请求记录（演示只登记请求与时间戳，不调用 SecretPort） */
const rotateOpen = ref(false);
const rotationLog = ref<{ at: string; ref: string }[]>([]);

/** 打开凭证轮换对话框：先校验已选引用，再就地展示将被执行的动作清单（本页不接触明文） */
function openRotate() {
  if (!form.value.credentialRef) {
    MessagePlugin.error('请先选择凭证引用：轮换以引用名为单位执行（界面不接收明文密钥）');
    return;
  }
  rotateOpen.value = true;
}

/** 登记轮换请求：写入本地记录并显示时间戳（真实轮换由 SecretPort 执行） */
function submitRotate() {
  const at = new Date().toLocaleString('zh-CN');
  rotationLog.value.unshift({ at, ref: form.value.credentialRef });
  rotateOpen.value = false;
  MessagePlugin.success(`已登记轮换请求（${at}，引用 ${form.value.credentialRef}）：真实轮换由 SecretPort 执行，本页不产生密钥写操作`);
}

const blank: ProviderData = {
  id: 'prov-new', name: '', protocolFamily: 'openai', baseUrl: '', credentialRef: '', timeoutOverrideMs: 60000,
  retryOverride: { maxRetries: 3, backoffBaseMs: 500, backoffCapMs: 10000, jitter: true }, enabled: true,
  status: 'reachable', modelCount: 0, lastProbeAt: '', probeLatencyMs: 0, probeNote: '未探测', discoveredModels: [],
  region: 'us-east-1', owner: '平台架构组',
};
const source = data.providers.find((p) => p.id === id);
const form = ref<ProviderData>(JSON.parse(JSON.stringify(source ?? blank)) as ProviderData);
const origin = ref<ProviderData>(JSON.parse(JSON.stringify(source ?? blank)) as ProviderData);

const familyOptions = (Object.keys(PROTOCOL_FAMILY_META) as ProtocolFamily[]).map((k) => ({
  label: `${PROTOCOL_FAMILY_META[k].label} — ${PROTOCOL_FAMILY_META[k].note}`, value: k,
}));
const credentialOptions = data.credentials.map((c) => ({
  label: `${c.ref}（${RESOLVER_META[c.resolverType].label} · ${c.layer === 'platform' ? '平台' : c.layer === 'byok' ? '租户 BYOK' : '会话临时'}）`, value: c.ref,
}));

const boundModels = computed(() => data.models.filter((m) => m.providerId === (isNew ? '' : id)));
const hitRules = computed(() => data.routeRules.filter((rl) => rl.targetModel && boundModels.value.some((m) => m.modelId === rl.targetModel)));
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(origin.value));

const impact = computed(() => [
  { key: 'models', label: '绑定模型数', value: String(boundModels.value.length) },
  { key: 'rules', label: '命中路由规则', value: String(hitRules.value.length) },
  { key: 'calls', label: '近 24h 调用数', value: isNew ? '0' : String(data.usageRows.find((u) => u.dimension === 'model')?.calls ?? 0) },
  { key: 'cred', label: '凭证状态', value: form.value.credentialRef, secretRef: true as const },
  { key: 'timeout', label: '超时覆盖影响', value: `> ${form.value.timeoutOverrideMs}ms 的调用将判定为 NETWORK 超时并发起重试` },
  { key: 'retry', label: '重试上限影响', value: `最多 ${form.value.retryOverride.maxRetries} 次，退避上限 ${form.value.retryOverride.backoffCapMs}ms` },
]);

function save() {
  if (!form.value.name.trim() || !form.value.baseUrl.trim() || !form.value.credentialRef) {
    MessagePlugin.error('保存失败：名称 / 端点 / 凭证引用均为必填（凭证只能选择引用名，不输入明文）');
    return;
  }
  saved.value = true;
  origin.value = JSON.parse(JSON.stringify(form.value)) as ProviderData;
  MessagePlugin.success('已保存并生成配置版本（等价 CLI 已同步）');
}

onMounted(() => {
  window.setTimeout(() => (state.value = isNew || source ? 'NORMAL' : 'ERROR'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="isNew ? '新建 Provider' : `Provider 编辑 · ${form.name || id}`"
      desc="协议族决定编解码内核与能力投射方式；超时/重试覆盖只影响该来源，不改变全局默认。保存即生成配置版本，可回滚。"
      volume="卷 02"
      manifest="M-02"
      cli="oc model provider apply -f providers.yaml"
      :status="[isNew ? { label: '新建', theme: 'primary' } : { label: '配置版本化', theme: 'default' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="router.push('/model/providers')">返回列表</Button>
        <Button size="small" theme="primary" :disabled="!dirty && !isNew" @click="save">保存</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="未找到该 Provider"
      empty-desc="编号可能已被删除或从未创建。"
      empty-action="返回列表"
      what="Provider 详情加载失败"
      why="配置读取返回 NOT_FOUND：该 id 不在当前租户的 Provider 清单中（可能已被其他端删除）。"
      how="返回列表重新选择；若确认应存在，请检查租户上下文与配置同步状态。"
      trace-id="trace-prov-edit-3a91"
      missing-permission="model.manage"
      risk-level="R3"
      apply-path="在「权限与审批 → 申请授权」申请 model.manage（写入型权限，R3 需项目管理员确认）"
      @retry="state = 'LOADING'"
      @empty-action="router.push('/model/providers')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">连接配置</div>
          <div class="oc-stack">
            <label>名称 <Input v-model="form.name" placeholder="例如：Anthropic 直连" size="small" /></label>
            <label>协议族
              <Select v-model="form.protocolFamily" :options="familyOptions" size="small" style="width: 100%" />
            </label>
            <label>端点 baseUrl <Input v-model="form.baseUrl" placeholder="https://api.example.com/v1" size="small" /></label>
            <label>凭证引用（引用名，永不在界面输入明文）
              <Select v-model="form.credentialRef" :options="credentialOptions" size="small" filterable style="width: 100%" placeholder="选择已有凭证引用" />
            </label>
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" variant="outline">引用式传递</Tag>
              <Tag size="small" variant="light-outline">SecretPort 请求前注入</Tag>
              <Tag size="small" variant="light-outline">密钥不进上下文/日志</Tag>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">超时与重试覆盖</div>
          <div class="oc-grid oc-grid--2">
            <label>超时覆盖（ms）
              <InputNumber v-model="form.timeoutOverrideMs" :min="5000" :max="300000" :step="1000" size="small" style="width: 100%" />
            </label>
            <label>最大重试次数
              <InputNumber v-model="form.retryOverride.maxRetries" :min="0" :max="5" size="small" style="width: 100%" />
            </label>
            <label>退避基数（ms）
              <InputNumber v-model="form.retryOverride.backoffBaseMs" :min="100" :max="5000" :step="100" size="small" style="width: 100%" />
            </label>
            <label>退避上限（ms）
              <InputNumber v-model="form.retryOverride.backoffCapMs" :min="1000" :max="30000" :step="500" size="small" style="width: 100%" />
            </label>
            <div class="oc-flex">抖动 <Switch v-model="form.retryOverride.jitter" size="small" /> <span class="oc-muted" style="font-size: 12px">避免重试风暴</span></div>
            <div class="oc-flex">启用 <Switch v-model="form.enabled" size="small" /> <span class="oc-muted" style="font-size: 12px">禁用后不参与路由（非降级）</span></div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            限制：重试次数 ≤ 5（企业策略可再收窄）；退避上限不得超过超时覆盖的 1/2，避免单次调用长时间占连接。
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">影响面（保存前预览）</div>
          <InfoGrid :items="impact" :columns="1" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">配置预览（密钥字段自动脱敏）</div>
          <JsonBlock :value="form" label="等价配置片段" :collapse-over="200" />
          <div class="oc-flex" style="margin-top: 8px">
            <CliHint command="oc model provider diff --id prov-anthropic-main" label="预览变更" />
          </div>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">危险操作</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Button size="small" variant="outline" @click="router.push(`/model/providers/${id}/test`)">连通性测试</Button>
          <Button size="small" variant="outline" @click="openRotate">轮换凭证</Button>
          <Popconfirm content="删除该 Provider 后，其模型与命中路由会立即失效（回退链继续生效）；10s 内可在状态栏撤销。" @confirm="MessagePlugin.warning('已删除（10s 撤销窗口）')">
            <Button size="small" theme="danger" variant="outline">删除 Provider</Button>
          </Popconfirm>
          <span v-if="saved" class="oc-muted" style="font-size: 12px">最近一次保存已生成配置版本 v{{ (boundModels.length % 9) + 1 }}（可回滚）</span>
        </div>
      </div>
    </StateShell>
      <div v-if="rotationLog.length" class="oc-card">
        <div class="oc-card__title">轮换请求记录（本地演示 · 未调用 SecretPort）</div>
        <div v-for="(r, i) in rotationLog" :key="i" class="oc-flex oc-flex--wrap" style="gap: 8px; font-size: 12px">
          <span class="oc-muted">{{ r.at }}</span>
          <span class="oc-mono">{{ r.ref }}</span>
          <Tag size="small" theme="warning" variant="light-outline">待密钥服务执行</Tag>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 4px">记录仅展示请求时间戳；真实轮换由 SecretPort 生成新密钥材料，旧句柄 30s 宽限后失效。</div>
      </div>

      <Dialog v-model:visible="rotateOpen" header="发起凭证轮换（引用式，不接触明文）" width="640px" :confirm-btn="{ content: '登记轮换请求', theme: 'primary' }" cancel-btn="取消" @confirm="submitRotate">
        <div class="oc-stack">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <span class="oc-muted" style="font-size: 12px">轮换目标引用</span>
            <span class="oc-mono">{{ form.credentialRef }}</span>
            <Tag size="small" variant="outline">引用式 · 不明文</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px">将被执行的动作清单（由 SecretPort 执行，本页只登记请求）：</div>
          <div class="oc-stack" style="font-size: 12px">
            <div>① SecretPort 生成新密钥材料，旧句柄 30s 宽限后失效（进行中的调用自然完成，无需重放）；</div>
            <div>② 引用名保持不变：Provider 配置与命中路由无需改动；</div>
            <div>③ 仅引用名、操作者与时间写入审计；密钥明文不进入日志与上下文。</div>
          </div>
          <div class="oc-muted" style="font-size: 12px">演示环境说明：确认后只在本页登记请求与时间戳，不调用密钥服务、不产生密钥写操作。</div>
        </div>
      </Dialog>
  </div>
</template>
