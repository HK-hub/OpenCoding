<script setup lang="ts">
/**
 * 证书与企业代理（G3-03）：自定义 CA / 代理 / 证书固定与例外 + TLS 握手诊断。
 * 溯源：卷 30 D-SEC-5
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selectedHost = ref('api.azure-openai-cn.example.com');
/** 固定主机清单以响应式代理渲染：导入企业 CA / 诊断握手后结果列与统计卡需立即更新 */
const fixedHosts = ref([
  { host: 'api.azure-openai-cn.example.com', pinning: '固定（SHA256 公钥固定）', exception: false, certIssuer: '企业 CA（内部）', expiresAt: '2027-03-01', handshakeMs: 42, result: 'OK' },
  { host: 'oc-bj.internal', pinning: '固定（证书固定）', exception: false, certIssuer: '企业 CA（内部）', expiresAt: '2027-01-15', handshakeMs: 12, result: 'OK' },
  { host: 'partner.example.com', pinning: '不固定（出站被 DLP 阻断）', exception: true, certIssuer: 'DigiCert（公网）', expiresAt: '2026-12-01', handshakeMs: 188, result: 'WARN' },
  { host: 'community.example.org', pinning: '不固定', exception: true, certIssuer: 'Let\'s Encrypt', expiresAt: '2026-11-20', handshakeMs: 246, result: 'OK' },
  { host: 'legacy.internal.yunshu', pinning: '固定', exception: false, certIssuer: '自签（未入信任链）', expiresAt: '2026-10-01', handshakeMs: 0, result: 'FAIL' },
]);
const proxies = [
  { env: 'HTTP_PROXY', value: 'http://proxy.internal:3128', auth: 'cred://proxy/basic', scope: '模型出站', status: 'ACTIVE' },
  { env: 'HTTPS_PROXY', value: 'http://proxy.internal:3128', auth: 'cred://proxy/basic', scope: '模型出站 + 更新', status: 'ACTIVE' },
  { env: 'NO_PROXY', value: '.internal,127.0.0.1,localhost', auth: '—', scope: '内网直连', status: 'ACTIVE' },
  { env: 'SOCKS_PROXY', value: 'socks5://socks.internal:1080', auth: '—', scope: '（未启用）', status: 'DISABLED' },
];
const selected = computed(() => fixedHosts.value.find((h) => h.host === selectedHost.value) ?? fixedHosts.value[0]);
const handshake = computed(() => ({
  host: selected.value.host,
  tlsVersion: 'TLSv1.3',
  cipher: 'TLS_AES_256_GCM_SHA384',
  alpn: 'h2',
  certChain: ['leaf（企业 CA 签发）', 'intermediate（企业 CA）', 'root（企业根 CA，已入系统信任链 + 显式配置）'],
  pinning: selected.value.pinning,
  verify: selected.value.result === 'OK' ? '校验通过（含主机名与有效期）' : selected.value.result === 'WARN' ? '校验通过但为固定例外（策略标记）' : '校验失败：证书不在信任链（已阻断）',
  handshakeMs: selected.value.handshakeMs,
}));

/** 导入企业 CA 弹窗（导入需指定证书文件与信任方式） */
const caOpen = ref(false);
const caFile = ref('enterprise-root-ca.pem');
const caTrust = ref('系统信任 + 显式配置');
const diagnosing = ref(false);

/** 导入企业 CA：把「自签未入信任链」的主机重新纳入信任链（负样本修复路径），握手失败数随之清零 */
function importCa() {
  const file = caFile.value.trim();
  if (!file) {
    MessagePlugin.warning('请先填写 CA 证书文件（如 enterprise-root-ca.pem）：导入需可追溯的证书来源');
    return;
  }
  const candidates = fixedHosts.value.filter((h) => h.certIssuer.includes('自签'));
  if (!candidates.length) {
    MessagePlugin.warning('当前没有「自签未入信任链」的主机：导入未产生变更，请确认该 CA 是否用于新增的固定主机');
    return;
  }
  candidates.forEach((h) => {
    h.certIssuer = '企业 CA（内部）';
    h.result = 'OK';
    h.handshakeMs = 18;
  });
  caOpen.value = false;
  MessagePlugin.success(`已导入企业 CA（${file}，信任方式：${caTrust.value}）：${candidates.map((h) => h.host).join('、')} 重新校验通过（FAIL → OK，握手 0 → 18ms），握手失败归零；吊销该 CA 可回退`);
}

/** 诊断握手：对选中主机做一次 TLS 探测，刷新握手耗时与校验结论（失败主机维持阻断，不静默加例外） */
function diagnose() {
  if (diagnosing.value) return;
  diagnosing.value = true;
  window.setTimeout(() => {
    diagnosing.value = false;
    const host = selected.value;
    const measured = Math.round(20 + Math.random() * 40);
    // 自签证书未入信任链时诊断必然失败：不放行、不自动加例外
    if (host.certIssuer.includes('自签')) {
      host.result = 'FAIL';
      host.handshakeMs = measured;
      MessagePlugin.warning(`诊断完成：${host.host} 校验失败（自签证书不在信任链，出站已阻断），探测耗时 ${measured}ms；请先导入企业 CA 或改用固定证书端点`);
      return;
    }
    host.result = 'OK';
    host.handshakeMs = measured;
    MessagePlugin.success(`诊断完成：${host.host} 握手成功（TLSv1.3 / h2），耗时 ${measured}ms，证书链校验通过，固定策略：${host.pinning}`);
  }, 600);
}

onMounted(() => {
  setTimeout(() => { state.value = fixedHosts.value.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="证书与企业代理"
      desc="支持自定义 CA（系统信任 + 显式配置）、HTTP/HTTPS/SOCKS 代理与认证、模型端点证书固定与例外清单；TLS 握手信息可查。"
      volume="卷 30"
      manifest="G3-03"
      cli="oc cert doctor --host <host> --show-pin"
      :status="[{ label: '证书固定优先', theme: 'success' }, { label: '例外需记录', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="caOpen = true">导入企业 CA</Button>
        <Button size="small" theme="primary" @click="diagnose">{{ diagnosing ? '诊断中…' : '诊断握手' }}</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚无证书与代理配置"
      empty-desc="企业 MITM 代理环境若未导入自定义 CA，模型与更新出站会失败；请先导入企业根 CA。"
      empty-action="导入企业根 CA"
      example-task="oc cert import --ca enterprise-root.pem --trust system+explicit"
      what="证书诊断失败"
      why="TLS 握手失败：证书不在信任链（自签证书未导入）或证书固定不匹配（可能被中间人替换）"
      how="可重试；固定不匹配属安全事件，请勿直接加例外，先按 RB-09 复核"
      trace-id="trace-cert-2f81c0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="固定主机" :value="fixedHosts.filter((h) => h.pinning.includes('固定') && !h.pinning.includes('不固定')).length" unit="个" icon="secured" />
        <StatCard label="固定例外" :value="fixedHosts.filter((h) => h.exception).length" unit="个" :target="2" target-kind="max" hint="例外需理由与到期复核" />
        <StatCard label="握手失败" :value="fixedHosts.filter((h) => h.result === 'FAIL').length" unit="个" :target="0" target-kind="max" icon="error" />
        <StatCard label="代理配置" :value="proxies.filter((p) => p.status === 'ACTIVE').length" unit="条" hint="凭证一律引用名注入" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">证书固定与例外清单</div>
          <Table :data="fixedHosts" row-key="host" size="small" @row-click="(ctx: { row: unknown }) => (selectedHost = (ctx.row as { host: string }).host)">
            <template #host="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.host }}</span></template>
            <template #pinning="{ row }">
              <Tag size="small" :theme="row.exception ? 'warning' : 'success'" variant="light-outline">{{ row.exception ? '存在例外' : '固定' }}</Tag>
            </template>
            <template #expiresAt="{ row }">{{ row.expiresAt }}</template>
            <template #result="{ row }">
              <Tag size="small" :theme="row.result === 'OK' ? 'success' : row.result === 'WARN' ? 'warning' : 'danger'" variant="light-outline">{{ row.result }}</Tag>
            </template>
          </Table>
          <div class="oc-state__hint" style="margin-top: 6px">
            负样本：legacy.internal.yunshu 自签证书未入信任链 → 出站被阻断（不放行）。修复：导入企业 CA 或改用固定证书端点。
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">TLS 握手诊断（{{ selected.host }}）</div>
          <div v-if="diagnosing" class="oc-muted" style="font-size: 12px; margin-bottom: 6px">正在发起 TLS 探测（读取证书链与固定摘要）…</div>
          <InfoGrid
            :items="[
              { key: 'tls', label: 'TLS 版本', value: handshake.tlsVersion, mono: true },
              { key: 'cipher', label: '密码套件', value: handshake.cipher, mono: true },
              { key: 'alpn', label: 'ALPN', value: handshake.alpn, mono: true },
              { key: 'ms', label: '握手耗时', value: `${handshake.handshakeMs} ms` },
              { key: 'pin', label: '固定策略', value: handshake.pinning, span: 2 },
              { key: 'verify', label: '校验结论', value: handshake.verify, span: 2 },
            ]"
          />
          <JsonBlock label="证书链" :value="handshake.certChain" :collapse-over="6" />
          <CopyableId id="trace-cert-7712" label="复制 traceId" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">代理配置（按服务集中化，凭证引用式）</div>
        <Table :data="proxies" row-key="env" size="small">
          <template #env="{ row }"><span class="oc-mono">{{ row.env }}</span></template>
          <template #value="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.value }}</span></template>
          <template #auth="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.auth }}</span></template>
          <template #status="{ row }">
            <Tag size="small" :theme="row.status === 'ACTIVE' ? 'success' : 'default'" variant="light-outline">{{ row.status }}</Tag>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          代理认证不落明文：使用凭证引用（cred://）在运行时注入；代理日志中的 Authorization 头强制脱敏。
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="caOpen" header="导入企业 CA" width="560px" :confirm-btn="{ content: '导入并重新校验', theme: 'primary' }" cancel-btn="取消" @confirm="importCa">
      <div class="oc-stack">
        <Input v-model="caFile" size="small" placeholder="CA 证书文件，如 enterprise-root-ca.pem" />
        <Select v-model="caTrust" size="small" aria-label="信任方式">
          <Option value="系统信任 + 显式配置" label="系统信任 + 显式配置（推荐：兼顾系统与内核校验）" />
          <Option value="仅显式配置（不改系统信任链）" label="仅显式配置（不改系统信任链）" />
        </Select>
        <div class="oc-muted" style="font-size: 12px">
          导入会立即对「自签未入信任链」的固定主机重新校验证书链；证书文件与导入动作写入审计（安全类别），吊销该 CA 可回退。
        </div>
      </div>
    </Dialog>
  </div>
</template>
