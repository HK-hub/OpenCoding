<script setup lang="ts">
/**
 * 凭证管理（M-10 / 卷 02 D-MDL-9）：
 * 三层凭证（平台 / 租户 BYOK / 会话临时）+ 引用名（永不显示明文）+ OAuth 刷新状态 + 异常标记。
 * 内核只见「凭证引用」，真实密钥由 SecretPort 在发起请求前注入；界面不存在明文输入/回显路径。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Dialog, Input, MessagePlugin, Popconfirm, Select, Table, Tabs, TabPanel, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { type PageState } from '@/components/gateway/types';
import { CREDENTIAL_LAYER_META, RESOLVER_META, modelData } from '@/mock/data/model';
import type { CredentialData, CredentialLayer, OauthState } from '@/mock/data/model';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const state = ref<PageState>('LOADING');
const tab = ref<CredentialLayer>('platform');

/** 新增凭证引用：只登记引用名与元数据（界面不接收明文）；登记结果以「待托管引用」列表呈现 */
const createOpen = ref(false);
const createForm = ref({ ref: 'cred://byok/', name: '', owner: '', scope: '' });
const pendingRefs = ref<{ ref: string; name: string; owner: string; at: string }[]>([]);
const providerOptions = data.providers.map((p) => ({ label: `${p.name}（${p.id}）`, value: p.id }));

/** 重新绑定：登记「原绑定 → 新绑定」的变更请求（密钥材料切换由密钥服务执行，本页不接触明文） */
const rebindOpen = ref(false);
const rebindTarget = ref<CredentialData | null>(null);
const rebindPicked = ref<string[]>([]);
const rebindLog = ref<{ ref: string; before: string; after: string; at: string }[]>([]);

/** 打开「新增凭证引用」对话框 */
function openCreate() {
  createOpen.value = true;
}

/** 提交新增：校验引用名格式与唯一性后登记为待托管引用（列表与计数即时可见） */
function submitCredential() {
  const ref = createForm.value.ref.trim();
  if (!ref.startsWith('cred://') || ref.slice('cred://'.length).trim().length === 0) {
    MessagePlugin.error('引用名必填且需为 cred:// 形式（如 cred://byok/azure-eu）；界面不接收明文密钥');
    return;
  }
  if (data.credentials.some((c) => c.ref === ref) || pendingRefs.value.some((c) => c.ref === ref)) {
    MessagePlugin.error(`引用名「${ref}」已存在（含待托管）：引用名全局唯一，避免解析歧义`);
    return;
  }
  if (!createForm.value.name.trim()) {
    MessagePlugin.error('名称必填：用于清单与审计展示（如「Azure OpenAI（租户 BYOK）」）');
    return;
  }
  pendingRefs.value.unshift({ ref, name: createForm.value.name.trim(), owner: createForm.value.owner.trim() || '当前操作者（演示）', at: new Date().toLocaleString('zh-CN') });
  createOpen.value = false;
  createForm.value = { ref: 'cred://byok/', name: '', owner: '', scope: '' };
  MessagePlugin.success(`已登记待托管引用「${ref}」：仅引用名与元数据，密钥材料需由密钥服务托管后启用（不存在明文输入路径）`);
}

/** 打开「重新绑定」对话框：预填当前绑定，便于对比改动前后 */
function openRebind(c: CredentialData) {
  rebindTarget.value = c;
  rebindPicked.value = [...c.providerIds];
  rebindOpen.value = true;
}

/** 提交重新绑定：登记变更请求（原绑定 → 新绑定），列表即时可见 */
function submitRebind() {
  const c = rebindTarget.value;
  if (!c) return;
  const before = c.providerIds.join('、') || '（未绑定）';
  const after = rebindPicked.value.join('、') || '（未绑定）';
  if (before === after) {
    MessagePlugin.info('绑定未变化，无需提交');
    return;
  }
  rebindLog.value.unshift({ ref: c.ref, before, after, at: new Date().toLocaleString('zh-CN') });
  rebindOpen.value = false;
  MessagePlugin.success(`已登记「${c.ref}」的绑定变更：${before} → ${after}；密钥材料切换由密钥服务执行（本页不接收明文）`);
}

const OAUTH_META: Record<OauthState, { label: string; theme: 'success' | 'warning' | 'danger' | 'default' }> = {
  valid: { label: '有效', theme: 'success' },
  refreshing: { label: '刷新中', theme: 'warning' },
  expired: { label: '已过期', theme: 'danger' },
  not_applicable: { label: '不适用（静态密钥）', theme: 'default' },
};

const rows = computed(() => data.credentials.filter((c) => c.layer === tab.value));
const anomalies = computed(() => data.credentials.filter((c) => c.anomalyFlag));
const expiredSoon = computed(() => data.credentials.filter((c) => c.expiresAt && new Date(c.expiresAt).getTime() < Date.now() + 7 * 24 * 3600_000));

const columns: PrimaryTableCol[] = [
  { colKey: 'ref', title: '凭证引用（引用名）', width: 280 },
  { colKey: 'resolver', title: '解析方式', width: 150 },
  { colKey: 'owner', title: '归属 / 作用域', width: 200 },
  { colKey: 'providers', title: '绑定 Provider', width: 200 },
  { colKey: 'oauth', title: 'OAuth / 状态', width: 200 },
  { colKey: 'rotation', title: '轮换与到期', width: 220 },
  { colKey: 'actions', title: '操作', width: 190 },
];

const daysTo = (iso: string) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);

function rotate(c: CredentialData) {
  MessagePlugin.success(`已发起轮换：${c.ref}。真实密钥仅存在于 SecretPort 的短期句柄中，界面与日志不回显`);
}

/** 导出凭证清单：仅引用名与元数据（含轮换/OAuth 状态），密钥材料与句柄不参与导出 */
function exportCredentials() {
  const file = downloadJson(
    {
      activeLayer: tab.value,
      layerSummary: {
        platform: data.credentials.filter((c) => c.layer === 'platform').length,
        byok: data.credentials.filter((c) => c.layer === 'byok').length,
        session: data.credentials.filter((c) => c.layer === 'session').length,
      },
      anomalyRefs: anomalies.value.map((a) => a.ref),
      credentials: data.credentials.map((c) => ({
        id: c.id,
        ref: c.ref,
        name: c.name,
        layer: c.layer,
        resolverType: c.resolverType,
        owner: c.owner,
        scope: c.scope,
        providerIds: c.providerIds,
        oauthState: c.oauthState,
        anomalyFlag: c.anomalyFlag,
        anomalyReason: c.anomalyReason,
        createdAt: c.createdAt,
        rotatedAt: c.rotatedAt,
        expiresAt: c.expiresAt,
        lastUsedAt: c.lastUsedAt,
        usedByCalls: c.usedByCalls,
        rotationDays: c.rotationDays,
      })),
      redactionNote: '仅导出引用名与元数据；真实密钥由 SecretPort 在发起请求前注入，不存在于导出文件（引用式掩码 cred://…）',
    },
    `oc-model-credentials-${new Date().toISOString().slice(0, 10)}.json`,
  );
  MessagePlugin.success(`已导出凭证清单：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = data.credentials.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="凭证管理"
      desc="三层凭证：平台凭证 / 租户 BYOK / 会话临时凭证。所有位置只显示引用名（如 cred://byok/azure-eu），真实密钥由 SecretPort 注入，永不进入上下文、日志与审计正文。"
      volume="卷 02"
      manifest="M-10"
      cli="oc model credential list --layer byok | oc model credential rotate --ref cred://byok/azure-eu"
      :status="[{ label: `${anomalies.length} 个异常凭证`, theme: anomalies.length ? 'warning' : 'success' }, { label: '引用式传递', theme: 'primary' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="exportCredentials">导出清单</Button>
        <Button size="small" theme="primary" @click="openCreate">新增凭证引用</Button>
      </template>
    </PageHeader>

    <Alert theme="info" style="margin-bottom: 4px">
      界面与日志一律不显示密钥明文：只允许出现引用名、解析方式与托管位置。密钥轮换由 SecretPort 完成，轮换期间旧句柄在 30s 宽限后失效。
    </Alert>

    <div class="oc-grid oc-grid--4">
      <StatCard label="凭证总数" :value="data.credentials.length" icon="lock" :hint="`平台 ${data.credentials.filter((c) => c.layer === 'platform').length} / BYOK ${data.credentials.filter((c) => c.layer === 'byok').length} / 会话 ${data.credentials.filter((c) => c.layer === 'session').length}`" />
      <StatCard label="异常凭证" :value="anomalies.length" icon="error" :hint="anomalies.map((a) => a.ref).join('、') || '无'" />
      <StatCard label="7 天内到期" :value="expiredSoon.length" icon="time" :hint="'轮换倒计时按 90 天策略；到期前 14 天开始提醒'" />
      <StatCard label="凭证驱动调用（24h）" :value="data.credentials.reduce((a, b) => a + b.usedByCalls, 0)" icon="api" :delta="5.6" :lower-is-better="false" />
    </div>

    <div v-if="pendingRefs.length || rebindLog.length" class="oc-card" style="margin: 12px 0">
      <div class="oc-card__title">本页登记（本地演示 · 未接触明文密钥）</div>
      <div v-for="r in pendingRefs" :key="r.ref" class="oc-flex oc-flex--wrap" style="gap: 8px; font-size: 12px">
        <Tag size="small" theme="warning" variant="light-outline">待托管</Tag>
        <span class="oc-mono">{{ r.ref }}</span>
        <span>{{ r.name }}</span>
        <span class="oc-muted">归属 {{ r.owner }} · 登记于 {{ r.at }}</span>
      </div>
      <div v-for="r in rebindLog" :key="r.ref + r.at" class="oc-flex oc-flex--wrap" style="gap: 8px; font-size: 12px">
        <Tag size="small" theme="primary" variant="light-outline">绑定变更</Tag>
        <span class="oc-mono">{{ r.ref }}</span>
        <span class="oc-muted">{{ r.before }} → {{ r.after }} · {{ r.at }}</span>
      </div>
      <div class="oc-muted" style="font-size: 12px; margin-top: 4px">真实密钥的生成、托管与吊销由密钥服务执行；本页仅登记引用名与绑定关系。</div>
    </div>


    <StateShell
      :state="state"
      empty-title="该层没有凭证"
      empty-desc="例如「会话临时凭证」只在长任务会话中生成；当前没有活跃会话时为空。"
      empty-action="查看平台凭证"
      what="凭证清单加载失败"
      why="密钥服务（SecretPort 后端）不可达；为避免误用，清单读取失败时不会回退到缓存副本。"
      how="可重试；清单不可读不影响已缓存的短期句柄在有效期内继续工作。"
      trace-id="trace-cred-1d55"
      missing-permission="credential.manage"
      risk-level="R4"
      apply-path="在「权限与审批 → 申请授权」申请 credential.manage（R4：涉及密钥托管，需安全管理员 + 项目管理员双签）"
      @retry="state = 'LOADING'"
      @empty-action="tab = 'platform'"
    >
      <Tabs v-model="tab">
        <TabPanel v-for="(meta, key) in CREDENTIAL_LAYER_META" :key="key" :value="key" :label="`${meta.label}（${data.credentials.filter((c) => c.layer === key).length}）`">
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 8px">{{ meta.note }}</div>
        </TabPanel>
      </Tabs>

      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="{ pageSize: 8, total: rows.length }">
        <template #ref="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-flex" style="gap: 6px">
              <span class="oc-mono">{{ row.ref }}</span>
              <Tag size="small" variant="outline">引用式 · 不明文</Tag>
            </span>
            <span class="oc-muted" style="font-size: 12px">{{ row.name }}</span>
          </div>
        </template>
        <template #resolver="{ row }">
          <Tooltip :content="RESOLVER_META[row.resolverType as keyof typeof RESOLVER_META].note">
            <Tag size="small" variant="light-outline">{{ RESOLVER_META[row.resolverType as keyof typeof RESOLVER_META].label }}</Tag>
          </Tooltip>
        </template>
        <template #owner="{ row }">
          <div class="oc-stack" style="gap: 2px; font-size: 12px">
            <span>{{ row.owner }}</span>
            <span class="oc-muted">{{ row.scope }}</span>
          </div>
        </template>
        <template #providers="{ row }">
          <span class="oc-mono" style="font-size: 12px">{{ row.providerIds.join('、') }}</span>
        </template>
        <template #oauth="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag :theme="OAUTH_META[row.oauthState as OauthState].theme" size="small" variant="light-outline">{{ OAUTH_META[row.oauthState as OauthState].label }}</Tag>
            <Tooltip v-if="row.anomalyFlag" :content="row.anomalyReason">
              <Tag theme="danger" size="small" variant="light-outline">凭证异常</Tag>
            </Tooltip>
          </div>
        </template>
        <template #rotation="{ row }">
          <div class="oc-stack" style="gap: 2px; font-size: 12px">
            <span>上次轮换 {{ new Date(row.rotatedAt).toLocaleDateString('zh-CN') }} · 策略 {{ row.rotationDays }} 天</span>
            <span :class="daysTo(row.expiresAt) !== null && daysTo(row.expiresAt)! < 7 ? '' : 'oc-muted'">
              {{ row.expiresAt ? `到期 ${daysTo(row.expiresAt)} 天后` : '无到期（本地/内网凭证）' }}
            </span>
          </div>
        </template>
        <template #actions="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Popconfirm content="轮换会生成新的密钥材料并让旧句柄在 30s 宽限后失效；进行中的调用会自然完成（无需重放）。" @confirm="rotate(row as CredentialData)">
              <Button size="small" variant="text">轮换</Button>
            </Popconfirm>
            <Button size="small" variant="text" @click="openRebind(row as CredentialData)">重新绑定</Button>
            <Popconfirm content="撤销后使用该引用的 Provider 立即不可用，命中路由会显式提示「无可用目标」；10s 内可撤销本次操作。" @confirm="MessagePlugin.warning('已撤销（10s 撤销窗口）')">
              <Button size="small" variant="text" theme="danger">撤销</Button>
            </Popconfirm>
          </div>
        </template>
      </Table>

      <div v-if="anomalies.length" class="oc-card">
        <div class="oc-card__title">异常凭证明细（显式标注，不静默跳过）</div>
        <div class="oc-stack" style="font-size: 13px">
          <div v-for="a in anomalies" :key="a.id" class="oc-flex--between">
            <span class="oc-flex" style="gap: 6px">
              <span class="oc-mono">{{ a.ref }}</span>
              <Tag theme="danger" size="small" variant="light-outline">{{ CREDENTIAL_LAYER_META[a.layer].label }}</Tag>
            </span>
            <span class="oc-muted" style="font-size: 12px">{{ a.anomalyReason }}</span>
          </div>
        </div>
      </div>
    </StateShell>
    <Dialog v-model:visible="createOpen" header="新增凭证引用（仅引用名与元数据）" width="620px" :confirm-btn="{ content: '登记待托管引用', theme: 'primary' }" cancel-btn="取消" @confirm="submitCredential">
      <div class="oc-stack">
        <div class="oc-muted" style="font-size: 12px">
          界面与日志只保存引用名（cred://…），密钥材料由 SecretPort 在发起请求前注入；本对话框不接受明文密钥。
        </div>
        <Input v-model="createForm.ref" size="small" class="oc-mono" placeholder="引用名（必填），如 cred://byok/azure-eu" />
        <Input v-model="createForm.name" size="small" placeholder="名称（必填），如 Azure OpenAI（租户 BYOK）" />
        <Input v-model="createForm.owner" size="small" placeholder="归属（默认：当前操作者）" />
        <div class="oc-muted" style="font-size: 12px">登记后进入「待托管引用」列表；密钥服务完成托管前该引用不可用于发起调用。</div>
      </div>
    </Dialog>

    <Dialog v-model:visible="rebindOpen" :header="rebindTarget ? `重新绑定 Provider · ${rebindTarget.ref}` : '重新绑定 Provider'" width="600px" :confirm-btn="{ content: '登记绑定变更', theme: 'primary' }" cancel-btn="取消" @confirm="submitRebind">
      <div v-if="rebindTarget" class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px">
          <span class="oc-mono">{{ rebindTarget.ref }}</span>
          <Tag size="small" variant="outline">引用式 · 不明文</Tag>
          <span class="oc-muted">当前绑定：{{ rebindTarget.providerIds.join('、') || '（未绑定）' }}</span>
        </div>
        <Select v-model="rebindPicked" multiple size="small" aria-label="绑定 Provider" placeholder="选择使用该引用发起请求的 Provider" :options="providerOptions" />
        <div class="oc-muted" style="font-size: 12px">
          本操作登记引用与 Provider 的绑定变更（记录留痕）；新密钥材料的托管 / 吊销需在密钥服务完成后由后端执行。
        </div>
      </div>
    </Dialog>
  </div>
</template>
