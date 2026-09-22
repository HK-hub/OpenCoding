<script setup lang="ts">
/**
 * 深链处理（G2-04）：oc:// 六类动作白名单表、签名校验面板（有效期 5 分钟一次性）、
 * 「将被拦截」示例（签名过期 → 拒绝并给原因码 eco.deeplink.blocked）与受理按钮（二次确认 Dialog）。
 * 溯源：卷 29 / BUILD-MANIFEST G2-04。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore, type UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const actions = enterpriseData.deepLinks;
const loading = ref(true);
const limit = ref(4);

/** 白名单动作前缀：仅这些前缀可被受理，其余一律拒绝（默认拒绝，非默认放行） */
const WHITELIST = ['open/session/', 'open/task/', 'open/goal/', 'open/kb/', 'open/wiki/', 'approve/', 'new', 'install/'];
const TTL_MINUTES = 5;

const nowSec = Math.floor(Date.now() / 1000);
/** 示例链接：① 有效（剩余 2 分钟）② 将被拦截（已过期 12 分钟） */
const SAMPLES = [
  { label: '有效链接（approve，剩余约 2 分钟）', url: `oc://approve/AR-9a02?sig=sig-8f21c4a0&exp=${nowSec + 120}` },
  { label: '将被拦截（approve，签名已过期 12 分钟）', url: `oc://approve/AR-9a02?sig=sig-8f21c4a0&exp=${nowSec - 720}` },
  { label: '无签名（open/kb，可直开）', url: 'oc://open/kb/doc-88' },
];

type VerifyResult = {
  at: string;
  action: string;
  ok: boolean;
  code: string;
  reason: string;
  fingerprint: string;
  expiresInSec: number;
  oneTime: string;
  next: string;
};

const linkInput = ref(SAMPLES[0].url);
const result = ref<VerifyResult | null>(null);
const usedSigs = ref<string[]>([]);
const acceptOpen = ref(false);
const acceptReason = ref('');

/** 校验深链：协议 → 白名单 → 签名 → 有效期 → 一次性使用（顺序固定，任一失败即阻断） */
function verify() {
  const url = linkInput.value.trim();
  const at = new Date().toLocaleString('zh-CN');
  if (!url.startsWith('oc://')) {
    result.value = { at, action: '未知', ok: false, code: 'eco.deeplink.blocked', reason: '协议不在白名单（仅接受 oc:// 深链）', fingerprint: '—', expiresInSec: 0, oneTime: '未消费', next: '请从客户端或官方文档复制链接' };
    return;
  }
  const [path, query = ''] = url.slice(5).split('?');
  const prefix = WHITELIST.find((p) => `${path}`.startsWith(p));
  if (!prefix) {
    result.value = { at, action: path, ok: false, code: 'eco.deeplink.blocked', reason: `动作不在白名单（${path.split('/')[0]} 未注册）`, fingerprint: '—', expiresInSec: 0, oneTime: '未消费', next: '仅支持白名单内的六类动作；如需新动作请走产品流程登记' };
    return;
  }
  const needsSig = prefix.startsWith('approve');
  const sig = /[?&]sig=([^&]+)/.exec(query)?.[1] ?? '';
  if (needsSig && !sig) {
    result.value = { at, action: path, ok: false, code: 'eco.deeplink.blocked', reason: '缺少签名参数：审批类深链必须携带短时效签名', fingerprint: '—', expiresInSec: 0, oneTime: '未消费', next: '请在通知/IM 卡片中点击原始链接（会自动附带签名）' };
    return;
  }
  if (needsSig) {
    const exp = Number(/[?&]exp=(\d+)/.exec(query)?.[1] ?? 0);
    const remaining = exp - Math.floor(Date.now() / 1000);
    const fingerprint = `sig-${sig.slice(4, 8)}…${sig.slice(-2)}`;
    if (usedSigs.value.includes(sig)) {
      result.value = { at, action: path, ok: false, code: 'eco.deeplink.blocked', reason: '签名已被使用过（一次性签名不可重放）', fingerprint, expiresInSec: 0, oneTime: '已消费', next: '重新发起审批会生成新签名；重放请求已记入安全审计' };
      return;
    }
    if (remaining <= 0) {
      result.value = { at, action: path, ok: false, code: 'eco.deeplink.blocked', reason: `签名已过期 ${Math.abs(remaining)} 秒（有效期 ${TTL_MINUTES} 分钟，过期即拒绝）`, fingerprint, expiresInSec: 0, oneTime: '未消费', next: '请在 IM/通知中重新获取卡片，或到审批中心人工处理' };
      return;
    }
    result.value = { at, action: path, ok: true, code: 'ALLOWED', reason: '签名有效且未使用；仍需二次确认后才会受理', fingerprint, expiresInSec: remaining, oneTime: '未消费（受理后置为已消费）', next: '点击「受理」并二次确认；受理动作写入审计' };
    return;
  }
  result.value = { at, action: path, ok: true, code: 'ALLOWED', reason: '只读动作（打开类）：无需签名，但仍做权限校验与归属过滤', fingerprint: '—', expiresInSec: 0, oneTime: '不适用', next: '打开目标视图；若目标不可见则提示无权限（不泄漏对象是否存在）' };
}

/** 受理：二次确认后消费签名（一次性），并记录审计 */
function accept() {
  const r = result.value;
  if (!r?.ok) return;
  const sig = /[?&]sig=([^&]+)/.exec(linkInput.value)?.[1] ?? '';
  if (sig) usedSigs.value = [...usedSigs.value, sig];
  acceptOpen.value = false;
  ui.pushNotification({
    kind: 'security',
    level: 'P0',
    title: '深链受理已执行',
    body: `动作 ${r.action} 已受理（签名一次性已消费）；理由：${acceptReason.value || '（未填写）'}。`,
    actions: [{ label: '查看审批中心', path: '/approval/center' }],
    aggregateKey: `eco-deeplink-${r.action}`,
    penetrateQuiet: true,
    channel: 'inapp',
  });
  MessagePlugin.success('已受理深链动作：签名置为已消费，审计已记录');
  acceptReason.value = '';
}

/** 选择示例链接后立即校验（演示三种典型结果） */
function pickSample(v: unknown) {
  linkInput.value = String(v);
  verify();
}

const recent = computed(() => actions.map((a, i) => ({ id: `dl-${i + 1}`, action: a.action, at: a.lastHandledAt, state: a.lastResult, reason: a.blockedReason || '—' })));
const visibleRecent = computed(() => recent.value.slice(0, limit.value));
const blockedCount = computed(() => recent.value.filter((r) => r.state === 'BLOCKED').length);
const pageState = computed<UiStateKind>(() => {
  if (loading.value) return 'LOADING';
  if (!recent.value.length) return 'EMPTY';
  return recent.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

const columns = [
  { colKey: 'action', title: '动作（白名单）', width: 260, cell: 'action' },
  { colKey: 'params', title: '参数', width: 200, ellipsis: true },
  { colKey: 'sig', title: '签名 / 有效期', width: 150, cell: 'sig' },
  { colKey: 'confirm', title: '二次确认', width: 100, cell: 'confirm' },
  { colKey: 'check', title: '权限校验', ellipsis: true },
];

onMounted(() => {
  verify();
  window.setTimeout(() => {
    loading.value = false;
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="深链处理"
      desc="oc:// 深链默认拒绝、白名单放行：六类动作逐条声明签名要求与二次确认；审批类签名有效期 5 分钟且一次性，任何阻断都给出原因码 eco.deeplink.blocked。"
      volume="卷 29"
      manifest="G2-04"
      cli="oc deeplink inspect <url> --dry-run --json"
      :status="[{ label: `签名有效期 ${TTL_MINUTES} 分钟`, theme: 'warning' }, { label: '默认拒绝', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="verify">校验链接</Button>
        <Button size="small" theme="primary" :disabled="!result?.ok" @click="acceptOpen = true">受理</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="白名单动作" :value="actions.length" unit="类" icon="link" hint="未登记动作一律阻断" />
      <StatCard label="需签名动作" :value="actions.filter((a) => a.signatureRequired).length" unit="类" icon="secured" hint="审批类：签名 + 二次确认" />
      <StatCard label="最近被拦截" :value="blockedCount" unit="次" icon="lock" :lower-is-better="true" hint="拦截不静默：给出原因码与恢复建议" />
      <StatCard label="已消费签名" :value="usedSigs.length" unit="个" icon="check" hint="一次性：受理后不可重放" />
    </div>

    <StateShell
      :state="pageState"
      :collapsed-summary="`最近处理记录 ${recent.length} 条，超过单次渲染阈值（4 条）已折叠。`"
      :page-size="4"
      stage="正在读取深链白名单与最近处理记录…"
      empty-title="暂无深链处理记录"
      empty-desc="还没有收到任何 oc:// 深链；未注册的协议与动作会被直接拒绝并记入安全审计。"
      empty-action="校验一个示例链接"
      example-task="用「已过期」示例链接观察 eco.deeplink.blocked 的拒绝原因"
      what="深链处理记录读取失败"
      why="签名校验器不可用（本地时间漂移或校验服务不可达），无法判定有效期。"
      how="可重试；校验器不可用时审批类深链一律拒绝（Fail-Closed），只读动作不受影响。"
      trace-id="trace-deeplink-31c8fa"
      @retry="verify(); loading = false"
      @load-more="limit += 4"
      @empty-action="linkInput = SAMPLES[1].url; verify()"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">动作白名单表（六类动作）<CopyableId id="trace-deeplink-31c8fa" label="复制 traceId" /></div>
          <Table :data="actions" row-key="action" size="small" :columns="columns" table-layout="fixed">
            <template #action="{ row }">
              <span class="oc-mono" style="font-size: 12px">{{ row.action }}</span>
              <Tag v-if="row.whitelist" size="small" theme="success" variant="light-outline" style="margin-left: 4px">白名单</Tag>
            </template>
            <template #sig="{ row }">
              <Tag v-if="!row.signatureRequired" size="small" variant="outline">无需签名</Tag>
              <Tooltip v-else :content="`签名有效期 ${row.signatureTtlMinutes} 分钟；过期或重放即拒绝`">
                <Tag size="small" theme="warning" variant="light-outline">签名 {{ row.signatureTtlMinutes }} 分钟</Tag>
              </Tooltip>
            </template>
            <template #confirm="{ row }">
              <Tag size="small" :theme="row.secondConfirm ? 'danger' : 'default'" variant="light-outline">{{ row.secondConfirm ? '需二次确认' : '无需' }}</Tag>
            </template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            放行顺序：协议 → 白名单 → 签名有效期 → 一次性 → 权限与归属；任一失败即阻断（Fail-Closed）。
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">签名校验结果面板（有效期 {{ TTL_MINUTES }} 分钟 · 一次性）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Select :model-value="linkInput" size="small" style="width: 300px" aria-label="示例链接" :options="SAMPLES.map((s) => ({ label: s.label, value: s.url }))" @change="pickSample" />
            <Button size="small" variant="outline" @click="verify">校验</Button>
          </div>
          <Input v-model="linkInput" size="small" style="margin-top: 6px" placeholder="粘贴 oc:// 深链后点击校验" @enter="verify" />
          <div v-if="result" class="oc-stack" style="gap: 6px; margin-top: 8px">
            <Alert
              :theme="result.ok ? 'success' : 'error'"
              :message="result.ok ? `校验通过：${result.action}` : `已拦截：${result.reason}`"
              :description="result.ok ? `原因码 ${result.code} · ${result.next}` : `原因码 ${result.code} · 处置建议：${result.next}`"
            />
            <InfoGrid :columns="2" :items="[
              { key: 'at', label: '校验时间', value: result.at },
              { key: 'act', label: '动作', value: result.action, mono: true },
              { key: 'code', label: '原因码', value: result.code, tag: { text: result.code, theme: result.ok ? 'success' : 'danger' } },
              { key: 'fp', label: '签名指纹', value: result.fingerprint, mono: true },
              { key: 'ttl', label: '剩余有效期', value: result.expiresInSec ? `${result.expiresInSec} 秒` : '不适用 / 已失效' },
              { key: 'once', label: '一次性使用', value: result.oneTime },
            ]" />
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <CliHint :command="`oc deeplink inspect ${linkInput}`" label="等价 CLI" />
              <Button size="small" theme="primary" :disabled="!result.ok" @click="acceptOpen = true">受理（需二次确认）</Button>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">「将被拦截」示例（签名过期 → 拒绝）</div>
          <pre class="oc-pre">{{ SAMPLES[1].url }}</pre>
          <Alert
            theme="error"
            message="拒绝并返回原因码 eco.deeplink.blocked"
            description="原因：签名已过期（有效期 5 分钟，过期即拒绝，不做宽限）；处置：回到 IM/通知中的原始卡片重取，或到审批中心人工处理。"
          />
          <div class="oc-flex" style="gap: 6px; margin-top: 6px">
            <OcIcon name="lightbulb" size="14px" />
            <span class="oc-muted" style="font-size: 12px">同一签名的第二次请求会被判「已使用」——审批类签名一次性，防止一键批准被钓鱼重放。</span>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">最近处理的深链（动作 / 时间 / 结果 / 拦截原因）</div>
          <Table :data="visibleRecent" row-key="id" size="small" :columns="[
            { colKey: 'action', title: '动作', ellipsis: true },
            { colKey: 'at', title: '时间', width: 170, cell: 'at' },
            { colKey: 'state', title: '结果', width: 110, cell: 'state' },
          ]" table-layout="fixed">
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template #state="{ row }">
              <Tooltip :content="row.reason">
                <Tag size="small" :theme="row.state === 'ALLOWED' ? 'success' : 'danger'" variant="light-outline">{{ row.state }}</Tag>
              </Tooltip>
            </template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">展示 {{ visibleRecent.length }} / {{ recent.length }} 条；拦截记录会同步写入安全审计。</div>
        </div>
      </div>
    </StateShell>

    <Dialog
      v-model:visible="acceptOpen"
      header="受理深链动作（二次确认）"
      width="560px"
      :confirm-btn="{ content: '确认受理', theme: 'danger' }"
      cancel-btn="取消"
      @confirm="accept"
    >
      <div class="oc-stack">
        <Alert theme="warning" message="审批类深链受理即放行对应操作，且签名一次性消费后不可重放。" description="受理会写入审计（操作者 / 动作 / 签名指纹 / 理由）；如需撤销请在审批中心发起撤回（不是所有动作都可撤回）。" />
        <InfoGrid :columns="1" :items="[
          { key: 'act', label: '动作', value: result?.action ?? '—', mono: true },
          { key: 'risk', label: '风险级', value: 'R3（删除类操作）· 范围：单次' },
          { key: 'ttl', label: '签名剩余有效期', value: result?.expiresInSec ? `${result.expiresInSec} 秒` : '已失效' },
          { key: 'impact', label: '影响面', value: '本次操作只作用于声明的目标（secrets/ 目录），不含其它资源' },
        ]" />
        <Textarea v-model="acceptReason" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="填写受理理由（写入审计，可空）" />
      </div>
    </Dialog>
  </div>
</template>
