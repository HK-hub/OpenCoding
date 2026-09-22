<script setup lang="ts">
/** 升级链与 SLA（P-08）：三级升级链 + SLA + 超时动作（deny/escalate）+ 留痕。溯源：卷 06 D-PERM-8 §4.4 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, RadioButton, RadioGroup, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { approvalEscalation } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const timeoutAction = ref<'deny' | 'escalate'>(approvalEscalation.defaultTimeoutAction);
const editorOpen = ref(false);
const err = ref(makeError('APPROVAL_UNAVAILABLE', '第 3 级审批人通道不可用（IM 回调失败）'));

const records = approvalEscalation.records;
const granted = computed(() => records.filter((r) => r.outcome === 'granted').length);
const denied = computed(() => records.filter((r) => r.outcome === 'denied').length);
const escalated = computed(() => records.filter((r) => r.toLevel > r.fromLevel).length);

const outcomeStats = computed(() => [
  { name: '批准', value: granted.value },
  { name: '拒绝', value: denied.value },
  { name: '超时（按策略动作）', value: records.filter((r) => r.outcome === 'expired').length },
  { name: '等待中', value: records.filter((r) => r.outcome === 'pending').length },
]);

const columns = [
  { colKey: 'recordId', title: '升级记录', width: 120 },
  { colKey: 'decisionRef', title: '决策引用', width: 170 },
  { colKey: 'chain', title: '升级路径', width: 130 },
  { colKey: 'reason', title: '理由（留痕）', ellipsis: true },
  { colKey: 'slaMinutes', title: 'SLA', width: 90 },
  { colKey: 'outcome', title: '结果', width: 110 },
  { colKey: 'actor', title: '处理人', width: 130 },
  { colKey: 'at', title: '时间', width: 170 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = records.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

function savePolicy() {
  editorOpen.value = false;
  MessagePlugin.success(`超时动作已设为 ${timeoutAction.value}：对后续超时生效（历史记录不变，变更写入审计）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="升级链与 SLA"
      desc="无人应答时的确定性路径：会话所有者 → 团队管理员 → 平台管理员，每级带 SLA 与超时动作（deny 安全默认 / escalate 继续升级），全程留痕。"
      volume="卷 06"
      manifest="P-08"
      :cli="`oc permission escalation show --default-action ${timeoutAction}`"
      :status="[{ label: `默认超时动作 ${timeoutAction}`, theme: timeoutAction === 'deny' ? 'success' : 'warning' }, { label: `去重合并 ${approvalEscalation.notifyDedupSeconds}s`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="editorOpen = true">调整超时动作</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="升级链层级" :value="approvalEscalation.levels.length" format="raw" icon="notification" />
      <StatCard label="批准" :value="granted" format="raw" icon="check" />
      <StatCard label="升级发生" :value="escalated" format="raw" icon="upload" hint="超时或越权触发的升级次数" />
      <StatCard label="审批平均时长" :value="4.8" unit="min" format="raw" icon="time" :target="5" target-kind="max" hint="SLA：第 1 级 5 分钟内响应" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有升级记录"
      empty-desc="全部审批都在 SLA 内由第 1 级完成（健康信号）。升级链配置仅在超时或越权时启用。"
      empty-action="重新加载"
      example-task="模拟第 1 级 5 分钟未响应，观察自动升级"
      :what="'升级链加载失败'"
      :why="err.message"
      how="审批通道不可用时遵循 fail-closed（默认拒绝）并显式提示；通道恢复后可按原决策重新发起。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-grid oc-grid--3">
        <div v-for="l in approvalEscalation.levels" :key="l.level" class="oc-card">
          <div class="oc-flex oc-flex--between">
            <span style="font-weight: 600">第 {{ l.level }} 级 · {{ l.role }}</span>
            <Tag size="small" variant="light-outline" :theme="l.timeoutAction === 'deny' ? 'success' : 'warning'">
              {{ l.timeoutAction }}
            </Tag>
          </div>
          <InfoGrid
            :columns="1"
            style="margin-top: 8px"
            :items="[
              { key: 'scope', label: '对象 / 范围', value: l.scopeRef },
              { key: 'sla', label: 'SLA', value: `${l.slaMinutes} 分钟（超时执行 ${l.timeoutAction}）` },
              { key: 'channels', label: '通道', value: l.channels.join(' / ') },
              { key: 'contact', label: '联系人', value: l.contact, mono: true },
            ]"
          />
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">审批结果分布</h3>
          <OcChart type="donut" :values="outcomeStats" :height="190" format="number" aria-label="审批结果分布" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">SLA 与超时语义</h3>
          <InfoGrid :columns="1" :items="[
            { key: 's1', label: '默认超时动作', value: `${approvalEscalation.defaultTimeoutAction}（安全默认：无人应答即拒绝，不静默放行）` },
            { key: 's2', label: '企业可选 escalate', value: '升级到上级审批人继续等待（适用于有值班制度的企业）' },
            { key: 's3', label: '失败关闭', value: '审批通道不可用时按 fail-closed 处理并显式提示，恢复后可重新发起（不计入用户拒绝）' },
            { key: 's4', label: '通知去重', value: `同一动作 ${approvalEscalation.notifyDedupSeconds}s 内合并为一条（避免刷屏导致习惯性批准）` },
          ]" />
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <CliHint command="oc permission escalation simulate --level 1 --timeout" label="模拟超时" />
            <CopyableId id="escalation://default-chain@v3" label="复制升级链引用" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">升级与审批记录（仅追加）</h3>
        <Table row-key="recordId" size="small" :data="records" :columns="columns">
          <template #recordId="{ row }"><span class="oc-mono">{{ row.recordId }}</span></template>
          <template #decisionRef="{ row }"><CopyableId :id="row.decisionRef" label="复制" :short="12" /></template>
          <template #chain="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.toLevel > row.fromLevel ? 'warning' : 'default'">L{{ row.fromLevel }} → L{{ row.toLevel }}</Tag>
          </template>
          <template #slaMinutes="{ row }">{{ row.slaMinutes }} min</template>
          <template #outcome="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.outcome === 'granted' ? 'success' : row.outcome === 'denied' ? 'danger' : row.outcome === 'pending' ? 'primary' : 'warning'">{{ row.outcome }}</Tag>
          </template>
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
        </Table>
      </div>
    </StateShell>

    <Dialog v-model:visible="editorOpen" header="调整超时动作" width="540px" :on-confirm="savePolicy" :on-cancel="() => (editorOpen = false)">
      <div class="oc-stack">
        <RadioGroup v-model="timeoutAction" size="small">
          <RadioButton value="deny">deny（安全默认：超时即拒绝）</RadioButton>
          <RadioButton value="escalate">escalate（超时继续升级）</RadioButton>
        </RadioGroup>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：仅对<b>后续</b>超时生效（在途审批沿用发起时的策略）；<code>deny</code> 更安全但可能阻塞无人值守任务，<code>escalate</code> 需要上级有值班响应能力，否则会各级超时。
        </p>
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">变更理由（必填，进入审计）</div>
          <Input model-value="" size="small" placeholder="例如：长任务无人值守，改 escalate 由团队管理员兜底" />
        </div>
        <p class="oc-muted" style="font-size: 12px; margin: 0">可逆：可随时改回；变更记录以事件形式追加，不可修改历史。</p>
      </div>
    </Dialog>
  </div>
</template>
