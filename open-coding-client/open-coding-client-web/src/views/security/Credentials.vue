<script setup lang="ts">
/**
 * 凭证与密钥（G3-02）：六类密钥 + 六态时间线 + 90 天轮换倒计时。
 * 溯源：卷 30 §4.2
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Popconfirm, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { SecretKind, SecretRecord } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
/** 密钥清单以响应式代理渲染：轮换 / 吊销 / 新建后行状态、统计卡与生命周期时间线需立即更新 */
const secrets = ref(d.secrets);
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const selectedId = ref(secrets.value[4].id);
const selected = computed(() => secrets.value.find((s) => s.id === selectedId.value) ?? secrets.value[0]);
const states = ['Generated', 'Active', 'Rotating', 'DualRead', 'Retired', 'Destroyed'] as const;
const stateIndex = computed(() => states.indexOf(selected.value.state));
const stateTheme: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  Generated: 'primary', Active: 'success', Rotating: 'warning', DualRead: 'warning', Retired: 'default', Destroyed: 'danger',
};
const overdue = computed(() => secrets.value.filter((s) => s.rotationDueDays <= 7 && s.state !== 'Destroyed' && s.state !== 'Retired'));
const leaked = computed(() => secrets.value.filter((s) => s.leakSuspected));
const SECRET_KINDS: SecretKind[] = ['主密钥', '数据密钥', '模型凭证', 'Git/SSH 凭证', '签名密钥', '会话令牌'];

/** 新建凭证引用弹窗（只登记引用，明文永不进入内核） */
const createOpen = ref(false);
const createForm = ref<{ name: string; kind: SecretKind; refName: string }>({ name: '', kind: '模型凭证', refName: 'cred://' });

/** 批量轮换到期项：进入 DualRead 双读期并重置 SLA 倒计时（旧版本双读期后退役，可回退） */
function rotateOverdue() {
  const items = overdue.value.slice();
  if (!items.length) {
    MessagePlugin.warning('当前没有轮换到期项（剩余 ≤7 天）：无需批量轮换，可对单条凭证执行「立即轮换」');
    return;
  }
  items.forEach((s) => {
    s.state = 'DualRead';
    s.lastRotatedAt = new Date().toISOString();
    s.ageDays = 0;
    s.rotationDueDays = s.rotationSlaDays;
  });
  MessagePlugin.success(`已批量轮换 ${items.length} 条到期凭证（${items.map((s) => s.refName).join('、')}）：状态进入 DualRead 新旧并存双读期，SLA 倒计时重置为 ${items[0].rotationSlaDays} 天；双读期后可退役旧版本，可回退`);
}

function openCreate() {
  createForm.value = { name: '', kind: '模型凭证', refName: 'cred://' };
  createOpen.value = true;
}

/** 新建凭证引用：插入清单顶部并选中；引用生效前需在 Provider / Git 配置中绑定 */
function createSecret() {
  const name = createForm.value.name.trim();
  const refName = createForm.value.refName.trim();
  if (!name) {
    MessagePlugin.warning('请先填写凭证名称：用于在清单与审计中识别该密钥');
    return;
  }
  // 引用式硬约束：仅接受 cred:// 引用名，禁止录入明文密钥
  if (!/^cred:\/\/[\w./-]+$/.test(refName)) {
    MessagePlugin.warning('凭证引用名需为 cred:// 形式（如 cred://kms/prod-01）：明文密钥禁止登记');
    return;
  }
  const slaDays = createForm.value.kind === '主密钥' || createForm.value.kind === '签名密钥' ? 365 : 90;
  const record: SecretRecord = {
    id: `sec-${Date.now()}`,
    name,
    kind: createForm.value.kind,
    state: 'Generated',
    refName,
    store: createForm.value.kind === '主密钥' || createForm.value.kind === '签名密钥' ? 'HSM / KMS（私钥不可导出）' : 'KMS（引用式注入）',
    ageDays: 0,
    rotationDueDays: slaDays,
    rotationSlaDays: slaDays,
    lastUsedAt: '',
    lastRotatedAt: '',
    usageCount: 0,
    leakSuspected: false,
    note: '控制台登记（仅引用；明文不入内核、不入日志、不入事件）',
  };
  secrets.value.unshift(record);
  selectedId.value = record.id;
  createOpen.value = false;
  MessagePlugin.success(`已创建凭证引用「${name}」（${record.kind}，${refName}）：状态 Generated，${slaDays} 天内需轮换；引用需在 Provider / Git 远端绑定后生效（可吊销）`);
}

/** 立即轮换（新旧并存双读）：当前凭证进入 DualRead，SLA 倒计时重置 */
function rotateNow() {
  const s = selected.value;
  if (s.state === 'Destroyed') {
    MessagePlugin.warning('已销毁的凭证不可轮换：请新建凭证引用后重新绑定');
    return;
  }
  s.state = 'DualRead';
  s.lastRotatedAt = new Date().toISOString();
  s.ageDays = 0;
  s.rotationDueDays = s.rotationSlaDays;
  MessagePlugin.success(`已轮换 ${s.name}（${s.refName}）：进入新旧并存双读期，SLA 倒计时重置为 ${s.rotationSlaDays} 天；双读期内可回退到旧版本，结束后旧版本退役`);
}

/** 吊销：引用即刻失效（不可撤销），关联 Provider / Git 远端需重新签发 */
function revoke() {
  const s = selected.value;
  if (s.state === 'Retired' || s.state === 'Destroyed') {
    MessagePlugin.warning('该凭证已退役 / 销毁：无需重复吊销，可新建引用重新签发');
    return;
  }
  s.state = 'Retired';
  s.note = '已吊销（不可撤销）：引用即刻失效，关联 Provider / Git 远端需重新签发';
  MessagePlugin.success(`已吊销 ${s.name}（${s.refName}）：引用即刻失效，关联 Provider / Git 远端需重新签发；不可撤销，操作已写入审计（安全类别）`);
}

onMounted(() => {
  setTimeout(() => { state.value = d.secrets.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="凭证与密钥"
      desc="六类密钥（主密钥/数据密钥/模型凭证/Git-SSH/签名密钥/会话令牌）全生命周期留痕；默认 90 天轮换，泄露或离职事件立即轮换。"
      volume="卷 30"
      manifest="G3-02"
      cli="oc credential list --with-rotation --with-state"
      :status="[{ label: '引用式使用（内核不见明文）', theme: 'success' }, { label: '明文禁止入日志', theme: 'danger' }]"
    >
      <template #actions>
        <Popconfirm :confirm-btn="{ content: '批量轮换', theme: 'primary' }" cancel-btn="取消" @confirm="rotateOverdue">
          <template #content>
            <div style="max-width: 320px">
              <div>作用对象：轮换剩余 ≤7 天的 {{ overdue.length }} 条凭证（销毁 / 退役态除外）。</div>
              <div>影响：进入新旧并存双读期，业务不中断，SLA 倒计时重置；双读期内可回退到旧版本。</div>
            </div>
          </template>
          <Button size="small" variant="outline">批量轮换到期项</Button>
        </Popconfirm>
        <Button size="small" theme="primary" @click="openCreate">新建凭证引用</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      missing-permission="credential.manage"
      risk-level="R5"
      apply-path="密钥管理为最高风险操作：仅 Owner/Admin 可申请，且需双人复核（记录后果与回滚方式）"
      empty-title="没有密钥记录"
      empty-desc="未登记密钥时无法轮换与审计；请以「引用」方式登记（明文永不进入内核）。"
      empty-action="导入凭证引用"
      example-task="oc credential add --kind model --ref cred://vllm-internal/prod"
      what="密钥列表加载失败"
      why="密钥服务（KMS/HSM）不可达，或引用解析失败"
      how="可重试；密钥服务不可用时相关模型/Git 调用会失败并显式报错（不使用缓存明文）"
      trace-id="trace-sec-cred-31a0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="密钥记录" :value="secrets.length" unit="条" icon="lock" />
        <StatCard label="轮换到期（≤7 天）" :value="overdue.length" unit="条" :target="0" target-kind="max" icon="time" hint="默认 SLA 90 天" />
        <StatCard label="疑似泄漏" :value="leaked.length" unit="条" :target="0" target-kind="max" icon="error" hint="命中扫描即轮换 + 取证" />
        <StatCard label="已在 HSM" :value="secrets.filter((s) => s.store.includes('HSM')).length" unit="条" hint="私钥不可导出" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">密钥清单</div>
        <Table :data="secrets" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
          <template #name="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" variant="outline">{{ row.kind }}</Tag>
              <span>{{ row.name }}</span>
              <Tag v-if="row.leakSuspected" size="small" theme="danger" variant="light-outline">疑似泄漏</Tag>
            </div>
          </template>
          <template #state="{ row }">
            <Tag size="small" :theme="stateTheme[row.state]" variant="light-outline">{{ row.state }}</Tag>
          </template>
          <template #rotationDueDays="{ row }">
            <div style="min-width: 130px">
              <Progress
                :percentage="Math.max(0, Math.min(100, Math.round((row.rotationDueDays / row.rotationSlaDays) * 100)))"
                :status="row.rotationDueDays <= 7 ? 'error' : row.rotationDueDays <= 21 ? 'warning' : 'success'"
                :label="false"
                size="small"
              />
              <span class="oc-muted" style="font-size: 11px">剩余 {{ row.rotationDueDays }} / {{ row.rotationSlaDays }} 天</span>
            </div>
          </template>
          <template #refName="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.refName }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">选中：{{ selected.name }}</div>
          <InfoGrid
            :items="[
              { key: 'kind', label: '类型', value: selected.kind },
              { key: 'store', label: '存储位置', value: selected.store, span: 2 },
              { key: 'age', label: '已使用', value: `${selected.ageDays} 天` },
              { key: 'usage', label: '使用次数', value: selected.usageCount.toLocaleString('zh-CN') },
              { key: 'lastUsed', label: '最近使用', value: selected.lastUsedAt ? new Date(selected.lastUsedAt).toLocaleString('zh-CN') : '—' },
              { key: 'lastRot', label: '最近轮换', value: selected.lastRotatedAt ? new Date(selected.lastRotatedAt).toLocaleString('zh-CN') : '—' },
              { key: 'note', label: '备注', value: selected.note ?? '—', span: 2 },
            ]"
          />
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Button size="small" variant="outline" @click="rotateNow">立即轮换（新旧并存双读）</Button>
            <Popconfirm theme="danger" :confirm-btn="{ content: '吊销该凭证', theme: 'danger' }" cancel-btn="取消" @confirm="revoke">
              <template #content>
                <div style="max-width: 320px">
                  <div>作用对象：选中凭证 {{ selected.name }}（{{ selected.refName }}）。</div>
                  <div>影响：引用即刻失效，关联 Provider / Git 远端全部中断，需重新签发并重新绑定。</div>
                  <div>是否可撤销：不可撤销（操作写入审计，可改用新引用恢复服务）。</div>
                </div>
              </template>
              <Button size="small" theme="danger" variant="outline">吊销</Button>
            </Popconfirm>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            危险操作：吊销不可撤销（需重新签发）；影响面为该引用关联的全部 Provider / Git 远端，操作留审计。
          </div>
          <CopyableId id="trace-sec-cred-7712" label="复制 traceId" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">生命周期六态时间线</div>
          <div class="oc-stack">
            <div v-for="(s, i) in states" :key="s" class="oc-flex oc-flex--between">
              <span class="oc-flex" style="gap: 6px">
                <Tag size="small" :theme="i === stateIndex ? stateTheme[s] : 'default'" variant="light-outline">{{ i + 1 }}. {{ s }}</Tag>
                <span v-if="i === stateIndex" class="oc-muted" style="font-size: 12px">当前状态</span>
              </span>
              <span class="oc-muted" style="font-size: 11px">
                {{ s === 'Generated' ? '生成（密钥服务）' : s === 'Active' ? '激活（引用发布）' : s === 'Rotating' ? '轮换触发（到期/事件/手动）' : s === 'DualRead' ? '新旧并存（双读期）' : s === 'Retired' ? '退役（停止签发）' : '销毁（宽限期后 + 销毁证明）' }}
              </span>
            </div>
          </div>
          <Tooltip content="硬约束：内核不见明文；日志/事件/诊断包中的凭据一律脱敏或改为引用名">
            <Tag size="small" theme="danger" variant="light-outline" style="margin-top: 8px">明文零容忍</Tag>
          </Tooltip>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="createOpen" header="新建凭证引用" width="560px" :confirm-btn="{ content: '登记引用', theme: 'primary' }" cancel-btn="取消" @confirm="createSecret">
      <div class="oc-stack">
        <Input v-model="createForm.name" size="small" placeholder="凭证名称（必填，如 模型凭证 · prod-19）" />
        <Select v-model="createForm.kind" size="small" aria-label="凭证类型">
          <Option v-for="k in SECRET_KINDS" :key="k" :value="k" :label="k" />
        </Select>
        <Input v-model="createForm.refName" size="small" placeholder="凭证引用名（必填，cred:// 形式）" />
        <div class="oc-muted" style="font-size: 12px">
          只登记引用（cred://）：明文密钥禁止录入；主密钥 / 签名密钥默认 SLA 365 天，其余 90 天。
        </div>
      </div>
    </Dialog>
  </div>
</template>
