<script setup lang="ts">
/** 密钥代理（B-08）：凭证引用↔域名匹配 + 短期令牌 + 伪造环境变量 + 「真实值仅存代理内存」。溯源：卷 07 D-SBOX-5 §4.4 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { CredentialInjection } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { credentialInjections } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const currentId = ref(credentialInjections[0]?.injectionId ?? '');
const err = ref(makeError('PERMISSION_DENIED', '密钥代理拒绝：凭证引用未被授权用于该域名（匹配失败）'));

const current = computed(() => credentialInjections.find((c) => c.injectionId === currentId.value) ?? credentialInjections[0]);
const shortLived = computed(() => credentialInjections.filter((c) => c.ttlSeconds <= 900).length);

const fakeEnvSample = computed(() => ({
  env: Object.fromEntries(current.value.fakeEnvVars.map((v) => {
    const [k, v2] = v.split('=');
    return [k, v2];
  })),
  note: '伪造环境变量仅为句柄 / 引用名；真实值由代理在出网瞬间替换，沙箱与日志均不可见',
}));

const columns = [
  { colKey: 'injectionId', title: '注入', width: 100 },
  { colKey: 'credentialRef', title: '凭证引用（引用式，不明文）', width: 280 },
  { colKey: 'matchedDomains', title: '匹配域名', width: 240 },
  { colKey: 'tokenPreview', title: '短期令牌（掩码）', width: 250 },
  { colKey: 'ttlSeconds', title: 'TTL', width: 90 },
  { colKey: 'callId', title: '关联调用', width: 140 },
  { colKey: 'scope', title: '范围', width: 100 },
  { colKey: 'at', title: '时间', width: 170 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = credentialInjections.length ? 'NORMAL' : 'EMPTY';
  }, 220);
}

function reclaim(c: CredentialInjection) {
  MessagePlugin.warning(`已回收 ${c.injectionId} 的短期令牌：后续调用将重新申请（沙箱内已有副本不可用时命令会失败并给出提示）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="密钥代理"
      desc="凭证不以明文进入沙箱：按目标域名匹配凭证引用，注入短期令牌（OAuth / SSH agent 转发 / Git 凭据助手），并提供伪造环境变量（GIT_ASKPASS 等）。真实值仅存代理内存。"
      volume="卷 07"
      manifest="B-08"
      cli="oc sandbox cred list --show-matching --no-plaintext"
      :status="[{ label: '真实值仅存代理内存', theme: 'success' }, { label: '明文永不回显', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="reclaim(current)">回收当前令牌</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="注入记录" :value="credentialInjections.length" format="raw" icon="lock" />
      <StatCard label="短期令牌（≤15min）" :value="shortLived" format="raw" icon="time" hint="短期化降低泄漏窗口" />
      <StatCard label="域名匹配规则" :value="credentialInjections.reduce((a, c) => a + c.matchedDomains.length, 0)" format="raw" icon="link" />
      <StatCard label="明文落地次数" :value="0" format="raw" icon="secured" hint="验收项：日志与沙箱扫描无明文密钥" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有凭证注入记录"
      empty-desc="近期无需要凭证的出网 / 推送操作（如 git push、私有源安装）。"
      empty-action="重新加载"
      example-task="为 git push 注入短期 GitHub 令牌（无需明文落地）"
      :what="'凭证注入被拒绝'"
      :why="err.message"
      how="域名与凭证引用的匹配是白名单制：未在凭证允许域名列表中的目标一律拒绝（防止凭证被诱导外发）。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <Table row-key="injectionId" size="small" :data="credentialInjections" :columns="columns" :hover="true" @row-click="(ctx: { row: Record<string, unknown> }) => (currentId = String(ctx.row.injectionId))">
        <template #injectionId="{ row }"><span class="oc-mono">{{ row.injectionId }}</span></template>
        <template #credentialRef="{ row }"><CopyableId :id="row.credentialRef" label="复制引用" :short="30" /></template>
        <template #matchedDomains="{ row }">
          <Tag v-for="d in row.matchedDomains" :key="d" size="small" variant="light-outline" class="oc-mono" style="margin: 1px">{{ d }}</Tag>
        </template>
        <template #tokenPreview="{ row }">
          <Tooltip content="短期令牌为掩码展示：真实值不经 UI / 日志 / 事件流传输">
            <span class="oc-mono" style="font-size: 11px">{{ row.tokenPreview }}</span>
          </Tooltip>
        </template>
        <template #ttlSeconds="{ row }">
          <Tag size="small" variant="light-outline" :theme="row.ttlSeconds <= 600 ? 'success' : 'default'">{{ Math.round(row.ttlSeconds / 60) }} min</Tag>
        </template>
        <template #callId="{ row }"><CopyableId :id="row.callId" label="复制" :short="8" /></template>
        <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
      </Table>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">
            注入详情（{{ current.injectionId }}）
            <Tag v-if="current.realValueLocation.includes('仅存')" size="small" theme="success" variant="light-outline">真实值仅存代理内存</Tag>
          </h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'ref', label: '凭证引用', value: current.credentialRef, mono: true, copyable: true, secretRef: true },
              { key: 'domains', label: '匹配域名', value: current.matchedDomains.join(' , '), mono: true },
              { key: 'token', label: '短期令牌', value: current.tokenPreview },
              { key: 'location', label: '真实值位置', value: current.realValueLocation },
              { key: 'ttl', label: '有效期', value: `${current.ttlSeconds}s（到期自动回收，命令需重新申请）` },
              { key: 'env', label: '伪造环境变量', value: current.fakeEnvVars.join(' ; '), mono: true, block: true },
              { key: 'audit', label: '审计引用', value: current.auditRef, mono: true, copyable: true },
              { key: 'call', label: '关联调用 / 范围', value: `${current.callId} · ${current.scope}` },
            ]"
          />
          <Popconfirm
            theme="warning"
            content="回收后该短期令牌立即失效：在途命令若尚未使用将失败并提示重新申请（不会明文泄漏）。可逆：下次调用自动重新注入。确认回收？"
            @confirm="reclaim(current)"
          >
            <Button size="small" variant="outline" style="margin-top: 8px">回收令牌</Button>
          </Popconfirm>
          <CliHint :command="`oc sandbox cred reclaim ${current.injectionId}`" label="等价命令" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">沙箱内可见的环境（伪造）</h3>
          <JsonBlock :value="fakeEnvSample" :collapse-over="220" label="fake env（句柄式）" />
          <div class="oc-divider" />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'k1', label: '为什么伪造', value: '避免明文注入环境变量（易被 env 泄漏 / 进日志 / 进快照）' },
              { key: 'k2', label: '如何工作', value: '命令侧只看到句柄；代理在出网瞬间用真实值替换（TLS 连接由代理终结或注入 header）' },
              { key: 'k3', label: '泄密检测', value: '命令尝试批量导出环境变量 / 读取凭证变量值 → 阻断 + 高优安全事件' },
              { key: 'k4', label: '扫描验证', value: '沙箱文件系统、日志、快照三处扫描无明文密钥（DoD 验收项）' },
            ]"
          />
        </div>
      </div>
    </StateShell>
  </div>
</template>
