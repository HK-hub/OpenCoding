<script setup lang="ts">
/**
 * 配额管理（N-05）：七维度配额 + 继承链 + 超限策略（拒绝/排队/降级）+ 使用率。
 * 溯源：卷 24 §4.4 / 卷 31 §4.5
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, InputNumber, MessagePlugin, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const policyTheme: Record<string, 'default' | 'primary' | 'warning' | 'danger'> = { 拒绝: 'danger', 排队: 'primary', 降级: 'warning' };
/** 配额明细用 ref 渲染：临时额度与调整后表格、图表、统计卡即时刷新（同时写回领域数据） */
const quotaRows = ref(d.quotas);
const usage = computed(() => quotaRows.value.map((q) => ({ x: q.label, y: Math.round((q.used / q.limit) * 100) })));
const over80 = computed(() => quotaRows.value.filter((q) => q.used / q.limit >= 0.8 && q.used / q.limit < 1));
const over100 = computed(() => quotaRows.value.filter((q) => q.used >= q.limit));
const dimOptions = computed(() => quotaRows.value.map((q) => ({ label: `${q.label}（已用 ${q.used.toLocaleString('zh-CN')} / 上限 ${q.limit.toLocaleString('zh-CN')}）`, value: q.key })));
const ttlOptions = ['1 小时', '24 小时', '7 天'].map((t) => ({ label: t, value: t }));
const tempOpen = ref(false);
const tempForm = ref({ key: quotaRows.value[0].key, delta: 10, ttl: '24 小时' });
const adjustOpen = ref(false);
const adjustForm = ref({ key: quotaRows.value[0].key, limit: quotaRows.value[0].limit });
/** 临时额度授予记录：授予后即时在页面可见（到期自动回收） */
const tempGrants = ref<{ at: string; label: string; delta: number; unit: string; ttl: string }[]>([]);

/** 打开临时额度弹窗，默认额度取当前上限的 5% 作为建议值 */
function openTemp() {
  const q = quotaRows.value[0];
  tempForm.value = { key: q.key, delta: Math.max(1, Math.round(q.limit * 0.05)), ttl: '24 小时' };
  tempOpen.value = true;
}

/** 申请临时额度：校验后追加到上限并登记授予记录（到期自动回收） */
function submitTemp() {
  const f = tempForm.value;
  const q = quotaRows.value.find((x) => x.key === f.key);
  if (!q) { MessagePlugin.error('请选择配额维度'); return; }
  const delta = Number(f.delta);
  if (!Number.isFinite(delta) || delta <= 0) { MessagePlugin.error('临时额度必须为大于 0 的数字'); return; }
  // 单次临时额度上限 50%：避免绕过预算与容量基线
  if (delta > q.limit * 0.5) { MessagePlugin.error(`单次临时额度不得超过当前上限的 50%（最多 ${Math.round(q.limit * 0.5).toLocaleString('zh-CN')} ${q.unit}）`); return; }
  q.limit += delta;
  q.note = `临时额度 +${delta.toLocaleString('zh-CN')} ${q.unit}（有效期 ${f.ttl}，到期自动回收；审批：Owner）`;
  tempGrants.value.unshift({ at: new Date().toISOString(), label: q.label, delta, unit: q.unit, ttl: f.ttl });
  MessagePlugin.success(`已为「${q.label}」追加临时额度 +${delta.toLocaleString('zh-CN')} ${q.unit}（有效期 ${f.ttl}）：当前上限 ${q.limit.toLocaleString('zh-CN')}，到期自动回收，可再次申请`);
  tempOpen.value = false;
}

/** 打开调整配额弹窗，带出所选维度的当前上限 */
function openAdjust() {
  const q = quotaRows.value[0];
  adjustForm.value = { key: q.key, limit: q.limit };
  adjustOpen.value = true;
}

/** 调整配额：切换维度时带出其当前上限，避免误改他项 */
function onAdjustDim(v: unknown) {
  const q = quotaRows.value.find((x) => x.key === String(v));
  if (q) adjustForm.value = { key: q.key, limit: q.limit };
}

/** 调整配额：新上限不得低于已用量，调整写审计 */
function submitAdjust() {
  const f = adjustForm.value;
  const q = quotaRows.value.find((x) => x.key === f.key);
  if (!q) { MessagePlugin.error('请选择配额维度'); return; }
  const limit = Number(f.limit);
  if (!Number.isFinite(limit) || limit <= 0) { MessagePlugin.error('配额上限必须为大于 0 的数字'); return; }
  if (limit < q.used) { MessagePlugin.error(`调整后的上限不得低于已用量 ${q.used.toLocaleString('zh-CN')} ${q.unit}（否则将立即触发准入拒绝）`); return; }
  const old = q.limit;
  q.limit = limit;
  q.note = `管理员调整上限：${old.toLocaleString('zh-CN')} → ${limit.toLocaleString('zh-CN')} ${q.unit}（写审计，可再次调整）`;
  MessagePlugin.success(`已将「${q.label}」上限由 ${old.toLocaleString('zh-CN')} 调整为 ${limit.toLocaleString('zh-CN')} ${q.unit}（已用量 ${q.used.toLocaleString('zh-CN')}，水位 ${Math.round((q.used / limit) * 100)}%）`);
  adjustOpen.value = false;
}

onMounted(() => {
  setTimeout(() => { state.value = d.quotas.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="配额管理"
      desc="七个维度（并发会话/并发任务/token/成本/存储/工具调用/外部任务）实时准入；超限策略可选拒绝、排队或降级到低价模型。"
      volume="卷 24"
      manifest="N-05"
      cli="oc quota list --with-usage --json"
      :status="[{ label: '实时计数准入', theme: 'default' }, { label: '计费口径异步聚合（误差 ≤0.5%）', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="openTemp">申请临时额度</Button>
        <Button size="small" theme="primary" @click="openAdjust">调整配额</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未配置配额"
      empty-desc="无限制会导致成本与容量失控；请至少配置成本与并发两个维度。"
      empty-action="应用推荐基线"
      example-task="按角色应用静态基线配额（Developer：并发 8 / 日成本 $40）"
      what="配额列表加载失败"
      why="实时计数服务不可用（Redis）——准入依赖实时计数，故新请求按拒绝处理（安全默认）"
      how="可重试；已排队任务保留，恢复后按原位置继续；人工会话不受影响"
      trace-id="trace-quota-77b2c1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="配额维度" :value="quotaRows.length" unit="项" :target="7" target-kind="min" icon="chart" />
        <StatCard label="≥80% 告警" :value="over80.length" unit="项" icon="notification" hint="80% 告警 + 排队策略生效" />
        <StatCard label="已超限" :value="over100.length" unit="项" :target="0" target-kind="max" icon="error" />
        <StatCard label="成本水位" :value="Math.round((quotaRows[3].used / quotaRows[3].limit) * 100)" format="percent" :target="80" target-kind="max" hint="80% 降级到低价模型；100% 熔断自治任务" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">七维度使用率（%）</div>
          <OcChart type="bar" :series="[{ name: '使用率', points: usage }]" :height="200" format="percent" :threshold="{ value: 80, label: '80% 告警线' }" aria-label="配额使用率" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">超限动作语义（不静默失败）</div>
          <div class="oc-stack">
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="danger" variant="light-outline">拒绝</Tag><span class="oc-muted">立即失败并给出业务错误码（QUOTA_EXCEEDED / BUDGET_EXCEEDED），可申请临时额度</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="primary" variant="light-outline">排队</Tag><span class="oc-muted">保留请求并按位置可见（位置 + ETA），不丢请求</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="warning" variant="light-outline">降级</Tag><span class="oc-muted">改路由到低价模型，界面显式标注「降级」与原因（可回切）</span></div>
          </div>
          <div class="oc-state__hint">反作弊：不允许通过降低质量/跳过验证达成成本下降（评测门禁强制）。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">配额明细（含继承链与策略）</div>
          <CopyableId id="trace-quota-7721" label="复制 traceId" />
        </div>
        <Table :data="quotaRows" row-key="key" size="small" style="margin-top: 8px">
          <template #label="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <b style="font-size: 12px">{{ row.label }}</b>
              <span class="oc-muted">{{ row.unit }}</span>
            </div>
          </template>
          <template #used="{ row }">
            <div style="min-width: 150px">
              <Progress :percentage="Math.min(100, Math.round((row.used / row.limit) * 100))" :status="row.used >= row.limit ? 'error' : row.used / row.limit >= 0.8 ? 'warning' : 'success'" :label="false" size="small" />
              <span class="oc-muted" style="font-size: 11px">{{ row.used.toLocaleString('zh-CN') }} / {{ row.limit.toLocaleString('zh-CN') }}（{{ Math.round((row.used / row.limit) * 100) }}%）</span>
            </div>
          </template>
          <template #inheritedFrom="{ row }">
            <span class="oc-mono" style="font-size: 11px">{{ row.scope }} ← {{ row.inheritedFrom }}</span>
          </template>
          <template #overagePolicy="{ row }">
            <Tooltip :content="`${row.note ?? ''} 重置周期：${row.resetCycle}`">
              <Tag size="small" :theme="policyTheme[row.overagePolicy]" variant="light-outline">{{ row.overagePolicy }}</Tag>
            </Tooltip>
          </template>
        </Table>
        <div class="oc-state__hint" style="margin-top: 6px">
          负样本：data-pipeline 项目已 BREACHED（$1,560 / $1,500），自治任务已暂停、人工会话保留；超支说明已自动生成待确认。
        </div>
        <div v-for="g in tempGrants" :key="g.at" class="oc-state__hint" style="margin-top: 4px">
          临时额度：{{ g.label }} +{{ g.delta.toLocaleString('zh-CN') }} {{ g.unit }}（有效期 {{ g.ttl }}，到期自动回收），授予时间 {{ new Date(g.at).toLocaleString('zh-CN') }}。
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="tempOpen" header="申请临时额度" width="560px" :confirm-btn="{ content: '提交申请（Owner 审批）', theme: 'primary' }" cancel-btn="取消" @confirm="submitTemp">
      <div class="oc-stack">
        <Select v-model="tempForm.key" size="small" aria-label="配额维度" :options="dimOptions" />
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <InputNumber v-model="tempForm.delta" :min="1" size="small" theme="normal" style="width: 170px" aria-label="临时额度增量" />
          <Select v-model="tempForm.ttl" size="small" style="width: 150px" aria-label="有效期" :options="ttlOptions" />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          临时额度到期自动回收（不改变基线配额）；单次不得超过当前上限的 50%，授予与回收均写审计。
        </div>
      </div>
    </Dialog>

    <Dialog v-model:visible="adjustOpen" header="调整配额" width="560px" :confirm-btn="{ content: '确认调整', theme: 'primary' }" cancel-btn="取消" @confirm="submitAdjust">
      <div class="oc-stack">
        <Select :value="adjustForm.key" size="small" aria-label="配额维度" :options="dimOptions" @change="onAdjustDim" />
        <InputNumber v-model="adjustForm.limit" :min="1" size="small" theme="normal" style="width: 200px" aria-label="新的配额上限" />
        <div class="oc-muted" style="font-size: 12px">
          新上限不得低于已用量（否则立即触发拒绝）；调整为基线变更，写审计且可再次调整。
        </div>
      </div>
    </Dialog>
  </div>
</template>
