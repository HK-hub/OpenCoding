<script setup lang="ts">
/**
 * 能力发现（Q-02）：Agent Card 的能力 / 约束 / 认证 / 端点 / 限速 + 签名状态。
 * 溯源：卷 23 §4.1（manifest 端点，D-A2A-5）
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const card = enterpriseData.a2a.agentCard;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const capCols = [
  { colKey: 'label', title: '能力', width: 200 },
  { colKey: 'supported', title: '支持', width: 110 },
  { colKey: 'note', title: '说明' },
];
const unsupported = computed(() => card.capabilities.filter((c) => !c.supported));
const cardJson = computed(() => JSON.stringify({
  name: card.name, version: card.version, capabilities: card.capabilities.map((c) => ({ key: c.key, supported: c.supported })),
  constraints: card.constraints.map((c) => ({ key: c.key, value: c.value })), endpoints: card.endpoints.map((e) => e.path),
  rateLimits: card.rateLimits,
}, null, 2));

const signing = ref(false);
/** 签名局部投影：card 为普通对象，用 ref 保证签名值 / 时间刷新后界面即时重渲染 */
const signature = ref({ value: card.signature, at: card.signedAt, valid: card.signatureValid });

/** 复制 manifest URL（外部平台拉取并校验 Agent Card 的入口地址） */
async function copyManifestUrl() {
  const url = `${window.location.origin}/a2a/v1/manifest`;
  try {
    await navigator.clipboard.writeText(url);
    MessagePlugin.success(`已复制 manifest URL：${url}`);
  } catch {
    MessagePlugin.info('复制失败，请手动复制');
  }
}

/** 重新签名：刷新签名值与签名时间（HSM 签发，私钥不可导出） */
function resign() {
  signing.value = true;
  MessagePlugin.info('正在重新签名：由 HSM 签发新的签名元数据（私钥不出硬件）…');
  window.setTimeout(() => {
    const at = new Date().toISOString();
    const next = `cardsig-${Date.now().toString(16)}`;
    // 就地更新领域数据与本地投影，保证概要卡片与页头签名状态同步刷新
    card.signature = next;
    card.signedAt = at;
    card.signatureValid = true;
    signature.value = { value: next, at, valid: true };
    signing.value = false;
    const expiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000).toLocaleDateString('zh-CN');
    MessagePlugin.success(`重新签名完成：签名者 ${card.signer}，新签名有效期 90 天（至 ${expiresAt}）`);
  }, 600);
}

onMounted(() => {
  setTimeout(() => { state.value = 'NORMAL'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="能力发现（Agent Card）"
      desc="对外声明本实例能做什么、有什么约束、如何认证、限速多少；可签名以便平台自动发现与校验。"
      volume="卷 23"
      manifest="Q-02"
      cli="oc a2a card --show --verify-signature"
      :status="[{ label: signature.valid ? '签名有效' : '签名失效', theme: signature.valid ? 'success' : 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="copyManifestUrl">复制 manifest URL</Button>
        <Button size="small" theme="primary" :loading="signing" @click="resign">重新签名</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未发布 Agent Card"
      empty-desc="未声明能力时，外部平台无法自动编排；请先配置能力与约束再发布。"
      empty-action="生成默认 Card"
      example-task="oc a2a card --generate --sign --publish"
      what="Agent Card 拉取失败"
      why="签名校验未通过或 manifest 端点不可达（端点健康检查失败）"
      how="可重试；确认 /a2a/v1/manifest 可达后再试，签名异常请联系安全负责人"
      trace-id="trace-card-5b7d19"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="能力位" :value="card.capabilities.length" unit="项" :target="6" target-kind="min" />
        <StatCard label="不支持能力" :value="unsupported.length" unit="项" :target="0" target-kind="max" hint="不支持时必须显式报错，不做静默降级" />
        <StatCard label="强制约束" :value="card.constraints.filter((c) => c.enforced).length" unit="项" :target="5" target-kind="min" icon="lock" />
        <StatCard label="签名有效期" :value="'90 天'" format="raw" hint="签名元数据带 signedAt/expiresAt，防重放" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">Card 概要</div>
          <InfoGrid
            :items="[
              { key: 'name', label: '名称', value: card.name },
              { key: 'version', label: '版本', value: card.version, mono: true },
              { key: 'desc', label: '描述', value: card.description, span: 2 },
              { key: 'signer', label: '签名者', value: card.signer, span: 2, hint: '私钥不可导出（HSM）' },
              { key: 'sig', label: '签名', value: signature.value, mono: true, secretRef: true, span: 2 },
              { key: 'signedAt', label: '签名时间', value: new Date(signature.at).toLocaleString('zh-CN') },
              { key: 'valid', label: '校验结果', value: signature.valid ? '有效' : '无效', tag: { text: signature.valid ? '有效' : '无效', theme: signature.valid ? 'success' : 'danger' } },
            ]"
          />
          <CliHint command="oc a2a card --verify-signature --json" label="校验签名" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">约束（企业不可放宽）</div>
          <div class="oc-stack">
            <div v-for="c in card.constraints" :key="c.key" class="oc-kv">
              <span class="oc-kv__k">{{ c.label }}</span>
              <span class="oc-mono">{{ c.value }}</span>
              <Tag size="small" variant="light-outline" :theme="c.enforced ? 'warning' : 'default'">{{ c.enforced ? '强制生效' : '提示' }}</Tag>
            </div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            拒绝优先：不满足约束的调用直接拒绝并记录审计，不进入排队。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">能力位（含不支持项的显式行为）</div>
        <Table :data="card.capabilities" :columns="capCols" row-key="key" size="small">
          <template #cell="{ row }">
            <template v-if="'supported' in row">
              <Tag size="small" :theme="row.supported ? 'success' : 'warning'" variant="light-outline">
                {{ row.supported ? '支持' : '不支持（UNSUPPORTED_CAPABILITY）' }}
              </Tag>
            </template>
            <template v-else-if="'note' in row">{{ row.note }}</template>
            <template v-else>{{ row.label }}</template>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">认证方式与 scope</div>
          <div class="oc-stack">
            <div v-for="a in card.auth" :key="a.kind" class="oc-card" style="box-shadow: none">
              <div class="oc-flex" style="gap: 6px">
                <Tag size="small" theme="primary" variant="light-outline">{{ a.kind }}</Tag>
                <span class="oc-mono" style="font-size: 11px">{{ a.scope }}</span>
              </div>
              <div class="oc-muted" style="font-size: 12px">{{ a.note }}</div>
            </div>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">限速（按调用方）</div>
          <Table :data="card.rateLimits" row-key="caller" size="small" :columns="[
            { colKey: 'caller', title: '调用方', width: 120 },
            { colKey: 'rpm', title: 'RPM', width: 80 },
            { colKey: 'concurrency', title: '并发', width: 80 },
            { colKey: 'dailyBudgetUsd', title: '日预算(USD)', width: 120 },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">manifest 载荷（可复制给外部平台）</div>
          <CopyableId id="corr-card-77310" label="复制 correlationId" />
        </div>
        <pre class="oc-pre" style="max-height: 220px; overflow: auto">{{ cardJson }}</pre>
      </div>
    </StateShell>
  </div>
</template>
