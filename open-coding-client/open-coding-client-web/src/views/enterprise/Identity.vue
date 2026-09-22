<script setup lang="ts">
/**
 * 身份源（N-02）：OIDC / SAML / LDAP / SCIM + 同步日志 + 离职回收。
 * 溯源：卷 24 D-ENT-2 / §4.10
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { IdentitySource } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 身份源清单用 ref 渲染：同步/新增后表格与统计卡即时刷新（同时写回领域数据） */
const identities = ref(d.identities);
const selectedId = ref(identities.value[1].id);
const selected = computed(() => identities.value.find((i) => i.id === selectedId.value) ?? identities.value[0]);
const failed = computed(() => selected.value.syncRecords.filter((r) => r.failed > 0));
const offboarded = computed(() => d.members.filter((m) => m.state === 'DEPROVISIONED'));
const syncing = ref(false);
const createOpen = ref(false);
const createForm = ref({ kind: 'OIDC', name: '', endpoint: '', offboardPolicy: '会话立即失效 + 授权记忆撤销 + 席位释放', mfaRequired: true });
const kindOptions = ['OIDC', 'SAML', 'LDAP', 'SCIM'].map((k) => ({ label: k, value: k }));

/** 立即同步：向选中身份源发起增量同步，落一条同步记录并更新最近同步时间 */
function syncNow() {
  const s = selected.value;
  syncing.value = true;
  MessagePlugin.info(`正在向 ${s.name} 发起增量同步…`);
  window.setTimeout(() => {
    // 降级源同步仍会失败（元数据/断言配置未修复），失败记录显式落库，不静默成功
    const bad = s.status !== 'HEALTHY';
    const rec = bad
      ? { at: new Date().toISOString(), direction: '入站', created: 0, updated: 4, deactivated: 0, failed: 3, note: `手动触发同步失败：${s.endpoint} 校验未通过（需修复 IdP 元数据后重试）` }
      : { at: new Date().toISOString(), direction: '入站', created: 2, updated: 6, deactivated: 0, failed: 0, note: '手动触发增量同步：管理员操作' };
    s.syncRecords.unshift(rec);
    s.lastSyncAt = rec.at;
    syncing.value = false;
    if (bad) {
      MessagePlugin.warning(`同步「${s.name}」完成：新增 ${rec.created} / 更新 ${rec.updated} / 失败 ${rec.failed}（失败写审计，修复后自动补同步）`);
    } else {
      MessagePlugin.success(`同步「${s.name}」完成：新增 ${rec.created} / 更新 ${rec.updated} / 失败 0`);
    }
  }, 600);
}

/** 新增身份源：校验必填与端点格式后落库，等待首次同步导入用户与组 */
function submitSource() {
  const f = createForm.value;
  if (!f.name.trim()) { MessagePlugin.error('请填写身份源名称'); return; }
  if (!f.endpoint.trim()) { MessagePlugin.error('请填写端点（如 https://idp.example.com/.well-known/openid-configuration）'); return; }
  if (!/^(https?|ldaps?):\/\//.test(f.endpoint.trim())) { MessagePlugin.error('端点需以 https:// 、http:// 或 ldaps:// 开头'); return; }
  if (identities.value.some((i) => i.name === f.name.trim())) { MessagePlugin.error(`身份源「${f.name.trim()}」已存在，请换一个名称`); return; }
  const src: IdentitySource = {
    id: `idp-${f.kind.toLowerCase()}-${identities.value.length + 1}`,
    kind: f.kind,
    name: f.name.trim(),
    endpoint: f.endpoint.trim(),
    status: 'HEALTHY',
    lastSyncAt: new Date().toISOString(),
    users: 0,
    groups: 0,
    offboardPolicy: f.offboardPolicy,
    mfaRequired: f.mfaRequired,
    syncRecords: [{ at: new Date().toISOString(), direction: '入站', created: 0, updated: 0, deactivated: 0, failed: 0, note: '新建身份源：端点元数据校验通过，等待首次定时同步导入用户与组' }],
  };
  identities.value.unshift(src);
  selectedId.value = src.id;
  MessagePlugin.success(`已新增身份源「${src.name}」（${src.kind}）：MFA ${src.mfaRequired ? '强制' : '可选'}，待首次同步后导入用户与组`);
  createForm.value = { kind: 'OIDC', name: '', endpoint: '', offboardPolicy: '会话立即失效 + 授权记忆撤销 + 席位释放', mfaRequired: true };
  createOpen.value = false;
}

onMounted(() => {
  setTimeout(() => { state.value = d.identities.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="身份源（SSO / SCIM）"
      desc="OIDC / SAML / LDAP 登录 + SCIM 出站供给；离职回收按事件驱动（停用 → 会话失效 → 记忆撤销 → 席位释放）。"
      volume="卷 24"
      manifest="N-02"
      cli="oc identity source list --with-sync-log"
      :status="[{ label: 'MFA 强制：Owner/Admin', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="syncing" @click="syncNow">立即同步</Button>
        <Button size="small" theme="primary" @click="createOpen = true">新增身份源</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未对接身份源"
      empty-desc="当前仅本地账号可用；企业场景建议至少对接一个 SSO 并开启 SCIM，否则离职回收需人工执行。"
      empty-action="配置 OIDC"
      example-task="对接企业 IdP（OIDC）并开启 Admin 强制 MFA"
      what="身份源列表加载失败"
      why="IdP 元数据端点不可达（SAML 断言签名算法不匹配或网络策略阻断）"
      how="可重试；已有会话不受影响，但新登录会失败，可临时使用本地应急账号"
      trace-id="trace-idp-7712ab"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="身份源" :value="identities.length" unit="个" :target="3" target-kind="min" icon="secured" />
        <StatCard label="覆盖用户" :value="identities[0].users" unit="人" :target="84" target-kind="min" />
        <StatCard label="降级 / 失败源" :value="identities.filter((i) => i.status !== 'HEALTHY').length" unit="个" :target="0" target-kind="max" icon="error" />
        <StatCard label="待回收（离职）" :value="offboarded.length" unit="人" icon="user" hint="SCIM 事件驱动：30 秒内完成" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">身份源清单</div>
          <Table :data="identities" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
            <template #name="{ row }">
              <div class="oc-flex" style="gap: 6px">
                <Tag size="small" theme="primary" variant="light-outline">{{ row.kind }}</Tag>
                <span>{{ row.name }}</span>
              </div>
            </template>
            <template #status="{ row }">
              <Tag size="small" :theme="row.status === 'HEALTHY' ? 'success' : row.status === 'DEGRADED' ? 'warning' : 'danger'" variant="light-outline">{{ row.status }}</Tag>
            </template>
            <template #mfaRequired="{ row }">
              <Tag size="small" :theme="row.mfaRequired ? 'success' : 'default'" variant="light-outline">{{ row.mfaRequired ? 'MFA 强制' : 'MFA 可选' }}</Tag>
            </template>
            <template #lastSyncAt="{ row }">{{ new Date(row.lastSyncAt).toLocaleString('zh-CN') }}</template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">选中：{{ selected.name }}</div>
          <InfoGrid
            :items="[
              { key: 'endpoint', label: '端点', value: selected.endpoint, mono: true, span: 2 },
              { key: 'users', label: '用户数', value: selected.users },
              { key: 'groups', label: '组数', value: selected.groups },
              { key: 'offboard', label: '离职回收策略', value: selected.offboardPolicy, span: 2 },
            ]"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" variant="outline">失败尝试进入审计（身份类别）</Tag>
            <Tag size="small" theme="warning" variant="light-outline">连续 5 次失败暂停账号</Tag>
          </div>
          <CopyableId id="trace-idp-sync-0912" label="复制 traceId" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">同步日志（入站 / 出站）</div>
        <Table :data="selected.syncRecords" row-key="at" size="small">
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #direction="{ row }"><Tag size="small" variant="outline">{{ row.direction }}</Tag></template>
          <template #failed="{ row }">
            <Tooltip v-if="row.failed" :content="row.note"><Tag size="small" theme="danger" variant="light-outline">{{ row.failed }} 失败</Tag></Tooltip>
            <span v-else class="oc-muted">0</span>
          </template>
          <template #note="{ row }">
            <span :class="{ 'oc-muted': row.failed === 0 }">{{ row.note }}</span>
          </template>
        </Table>
        <div v-if="failed.length" class="oc-state__hint" style="margin-top: 6px">
          负样本：{{ failed[0].note }}；失败不清空本地账号（保留数据可导出），修复后自动补同步。
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">离职回收记录</div>
        <div v-for="m in offboarded" :key="m.id" class="oc-flex oc-flex--wrap" style="gap: 8px">
          <span>{{ m.name }}</span>
          <Tag size="small" variant="outline">{{ m.scimId }}</Tag>
          <span class="oc-muted" style="font-size: 12px">{{ m.note }}</span>
        </div>
        <div v-if="!offboarded.length" class="oc-muted" style="font-size: 12px">无离职回收记录。</div>
      </div>
    </StateShell>

    <Dialog v-model:visible="createOpen" header="新增身份源" width="560px" :confirm-btn="{ content: '新增并提供同步', theme: 'primary' }" cancel-btn="取消" @confirm="submitSource">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <Select v-model="createForm.kind" size="small" style="width: 130px" aria-label="身份源类型" :options="kindOptions" />
          <Input v-model="createForm.name" size="small" style="width: 240px" placeholder="名称（必填），如 企业 IdP（OIDC）" />
          <span class="oc-flex" style="gap: 6px; align-items: center">
            <span class="oc-muted" style="font-size: 12px">MFA 强制</span>
            <Switch v-model="createForm.mfaRequired" size="small" />
          </span>
        </div>
        <Input v-model="createForm.endpoint" size="small" placeholder="端点（必填），如 https://idp.example.com/.well-known/openid-configuration" />
        <Input v-model="createForm.offboardPolicy" size="small" placeholder="离职回收策略（会话失效 → 记忆撤销 → 席位释放）" />
        <div class="oc-muted" style="font-size: 12px">
          新增后状态为「已校验、待首次同步」：用户与组在首次同步后导入；失败尝试进入审计（身份类别），连续 5 次失败暂停账号。
        </div>
      </div>
    </Dialog>
  </div>
</template>
