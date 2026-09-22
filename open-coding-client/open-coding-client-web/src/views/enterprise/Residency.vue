<script setup lang="ts">
/**
 * 数据驻留与加密（N-13）：驻留声明 + 字段级加密 + BYOK + 跨区审批。
 * 溯源：卷 24 D-ENT-10 / §4.10
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import { downloadJson } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { ResidencyPolicy } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 驻留策略用 ref 渲染：新增后表格与统计卡即时刷新（同时写回领域数据） */
const policies = ref(d.residency.policies);
const selectedId = ref(policies.value[0].id);
const selected = computed(() => policies.value.find((p) => p.id === selectedId.value) ?? policies.value[0]);
const requests = computed(() => d.residency.crossBorderRequests);
const pending = computed(() => requests.value.filter((r) => r.status === 'PENDING'));
const rejected = computed(() => requests.value.filter((r) => r.status === 'REJECTED'));
const createOpen = ref(false);
const regionOptions = ['cn-hangzhou', 'cn-beijing', 'ap-southeast-1'].map((r) => ({ label: r, value: r }));
const createForm = ref({ scope: '', region: 'cn-beijing', allowed: 'cn-beijing', fieldLevel: true, byok: false, inbound: true, note: '' });

/** 导出驻留声明：策略与加密配置 + 跨境审批记录（合规留档） */
function exportDeclaration() {
  const file = downloadJson({ tenant: d.tenantName, policies: policies.value, crossBorderRequests: requests.value }, `residency-declaration-${Date.now()}.json`);
  MessagePlugin.success('已生成 ' + file);
}

/** 新增驻留策略：校验作用域唯一与允许区域自洽后落库 */
function submitPolicy() {
  const f = createForm.value;
  if (!f.scope.trim()) { MessagePlugin.error('请填写作用域（如 合规专区团队 / 子公司 B）'); return; }
  const allowed = f.allowed.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
  if (!allowed.includes(f.region)) { MessagePlugin.error(`允许区域必须包含主区域 ${f.region}（否则策略自相矛盾）`); return; }
  if (policies.value.some((p) => p.scope === f.scope.trim())) { MessagePlugin.error(`作用域「${f.scope.trim()}」已有驻留策略，请换一个作用域`); return; }
  const policy: ResidencyPolicy = {
    id: `res-${String(policies.value.length + 1).padStart(2, '0')}`,
    scope: f.scope.trim(),
    region: f.region,
    allowedRegions: allowed,
    encryption: { fieldLevel: f.fieldLevel, byok: f.byok, kms: f.byok ? '企业 KMS（BYOK 自持密钥）' : '云厂商托管密钥', keyRotationDays: f.byok ? 90 : 365 },
    inboundAllowed: f.inbound,
    note: f.note.trim() || `A1 级数据禁止出 ${allowed.join(' / ')}`,
  };
  policies.value.unshift(policy);
  selectedId.value = policy.id;
  MessagePlugin.success(`已新增驻留策略「${policy.scope}」：主区域 ${policy.region}，允许区域 ${policy.allowedRegions.join(' / ')}；跨境传输仍需审批（A1 默认拒绝）`);
  createForm.value = { scope: '', region: 'cn-beijing', allowed: 'cn-beijing', fieldLevel: true, byok: false, inbound: true, note: '' };
  createOpen.value = false;
}

onMounted(() => {
  setTimeout(() => { state.value = d.residency.policies.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="数据驻留与加密"
      desc="驻留声明（区域白名单）+ 全链路加密 + 字段级加密 + BYOK；跨境传输必须审批并遵循最小化原则，A1 级数据默认拒绝。"
      volume="卷 24"
      manifest="N-13"
      cli="oc residency show --with-cross-border --json"
      :status="[{ label: '跨境需审批', theme: 'warning' }, { label: 'A1 默认拒绝', theme: 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportDeclaration">导出驻留声明</Button>
        <Button size="small" theme="primary" @click="createOpen = true">新增驻留策略</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未声明数据驻留"
      empty-desc="未声明驻留意味着数据可能被路由到任意区域（合规风险）；至少声明主区域与允许区域列表。"
      empty-action="声明主区域"
      example-task="为合规专区团队声明 cn-beijing 驻留并启用 BYOK"
      what="驻留策略加载失败"
      why="KMS 密钥元数据不可达（BYOK 密钥引用无法解析）"
      how="可重试；驻留校验失败时跨区路由一律拒绝（失败安全）"
      trace-id="trace-residency-66a1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="驻留策略" :value="policies.length" unit="条" :target="2" target-kind="min" icon="cloud" />
        <StatCard label="字段级加密" :value="policies.filter((p) => p.encryption.fieldLevel).length" unit="条" icon="lock" />
        <StatCard label="BYOK 启用" :value="policies.filter((p) => p.encryption.byok).length" unit="条" hint="客户自持密钥" />
        <StatCard label="跨境被拒" :value="rejected.length" unit="次" :target="0" target-kind="max" icon="error" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">驻留策略</div>
          <Table :data="policies" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
            <template #scope="{ row }"><b style="font-size: 12px">{{ row.scope }}</b></template>
            <template #allowedRegions="{ row }">
              <Tooltip :content="`入向允许：${row.inboundAllowed ? '是' : '否'}`">
                <span class="oc-mono" style="font-size: 11px">{{ row.allowedRegions.join(' / ') }}</span>
              </Tooltip>
            </template>
            <template #encryption="{ row }">
              <div class="oc-flex oc-flex--wrap" style="gap: 4px">
                <Tag size="small" :theme="row.encryption.fieldLevel ? 'success' : 'default'" variant="light-outline">字段级</Tag>
                <Tag size="small" :theme="row.encryption.byok ? 'success' : 'default'" variant="light-outline">BYOK</Tag>
                <Tag size="small" variant="outline">KMS {{ row.encryption.keyRotationDays }} 天轮换</Tag>
              </div>
            </template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">选中策略：{{ selected.scope }}</div>
          <InfoGrid
            :items="[
              { key: 'region', label: '主区域', value: selected.region, mono: true },
              { key: 'allowed', label: '允许区域', value: selected.allowedRegions.join(' / '), mono: true },
              { key: 'kms', label: 'KMS 后端', value: selected.encryption.kms },
              { key: 'rot', label: '密钥轮换', value: `${selected.encryption.keyRotationDays} 天` },
              { key: 'note', label: '说明', value: selected.note, span: 2 },
            ]"
          />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            硬约束：缓存 / 索引 / 对象存储键必须含租户前缀；跨租户命中视为安全事件（SEV2）。
          </div>
          <CopyableId id="trace-res-0912" label="复制 traceId" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">跨境传输审批（待处理 {{ pending.length }} 条）</div>
        <Table :data="requests" row-key="id" size="small">
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #route="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.fromRegion }} → {{ row.toRegion }}</span></template>
          <template #dataClass="{ row }">
            <Tag size="small" :theme="row.dataClass === 'A1' || row.dataClass === 'A0' ? 'danger' : 'default'" variant="light-outline">{{ row.dataClass }}</Tag>
          </template>
          <template #status="{ row }">
            <Tag size="small" :theme="row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : row.status === 'EXPIRED' ? 'warning' : 'primary'" variant="light-outline">{{ row.status }}</Tag>
          </template>
          <template #note="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.note ?? '—' }}</span></template>
        </Table>
        <div v-if="rejected.length" class="oc-state__hint" style="margin-top: 6px">负样本：{{ rejected[0].note }}</div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          审批语义：超时按默认拒绝（不放行）；A1 级跨境需安全负责人审批并说明最小化措施；批准记录写入审计（数据类别）。
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="createOpen" header="新增驻留策略" width="580px" :confirm-btn="{ content: '创建策略', theme: 'primary' }" cancel-btn="取消" @confirm="submitPolicy">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <Input v-model="createForm.scope" size="small" style="width: 240px" placeholder="作用域（必填），如 合规专区团队" />
          <Select v-model="createForm.region" size="small" style="width: 170px" aria-label="主区域" :options="regionOptions" />
        </div>
        <Input v-model="createForm.allowed" size="small" placeholder="允许区域（逗号分隔，必须包含主区域），如 cn-beijing, cn-hangzhou" />
        <div class="oc-flex oc-flex--wrap" style="gap: 12px; align-items: center">
          <span class="oc-flex" style="gap: 6px; align-items: center"><span class="oc-muted" style="font-size: 12px">字段级加密</span><Switch v-model="createForm.fieldLevel" size="small" /></span>
          <span class="oc-flex" style="gap: 6px; align-items: center"><span class="oc-muted" style="font-size: 12px">BYOK（自持密钥）</span><Switch v-model="createForm.byok" size="small" /></span>
          <span class="oc-flex" style="gap: 6px; align-items: center"><span class="oc-muted" style="font-size: 12px">入向允许</span><Switch v-model="createForm.inbound" size="small" /></span>
        </div>
        <Input v-model="createForm.note" size="small" placeholder="说明（可选），如 A1 级数据禁止出 cn-beijing" />
        <div class="oc-muted" style="font-size: 12px">
          硬约束：缓存 / 索引 / 对象存储键必须含租户前缀；跨租户命中视为安全事件（SEV2）；跨境传输一律走审批（A1 默认拒绝）。
        </div>
      </div>
    </Dialog>
  </div>
</template>
