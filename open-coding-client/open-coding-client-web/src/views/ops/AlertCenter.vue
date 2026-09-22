<script setup lang="ts">
/**
 * 告警中心（G5-02）：P0 页面 / P1 通知 / P2 工单 三级分组列表，
 * 含阈值说明、当前值、持续时间、绑定 Runbook 与执行人角色；「确认 / 解决」更新状态。
 * 硬约束：每条告警必须有 Runbook 链接，缺失即显式标红并禁止确认。
 * 溯源：卷 32 / BUILD-MANIFEST G5-02
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, RadioGroup, RadioButton, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { AlertRule, Runbook } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const level = ref<'ALL' | 'P0' | 'P1' | 'P2'>('ALL');
const cap = ref(10);
const active = ref<AlertRule | null>(null);
const activeRb = ref<Runbook | null>(null);

/** 负样本：尚未绑定 Runbook 的候选规则（缺失 Runbook 时禁止确认并显式标红） */
const draftRules: AlertRule[] = [
  { id: 'al-15', level: 'P1', name: '索引重建阻塞', condition: '重建队列等待时长', threshold: '> 15min', duration: '持续 20min', runbookId: '', executorRole: '平台值班', verifyCommand: 'oc kb index status --queue', successCriteria: '队列等待 < 5min', channel: '桌面 + IM', muted: false, lastFiredAt: '', note: '候选规则：Runbook 未绑定前不得启用' },
];
/** 当前值（演示口径，确定性本地数据；越线即对应告警 firing） */
const CURRENT: Record<string, string> = {
  'al-01': '6.4%', 'al-02': '1.8%', 'al-03': '探活失败 3 次', 'al-04': '93%', 'al-05': 'SEV2 · inc-2026-0914', 'al-06': '82s（P95）',
  'al-07': '14.2%', 'al-08': '26%', 'al-09': '1.9×', 'al-10': '23/小时', 'al-11': '41s', 'al-12': '1 个（plugin-webhook）', 'al-13': '27h', 'al-14': '9 天', 'al-15': '21min',
};
const status = ref<Record<string, 'firing' | 'acked' | 'resolved'>>({});
const rules = computed(() => [...d.alertRules, ...draftRules]);
const runbookOf = (id: string) => d.runbooks.find((rb) => rb.id === id) ?? null;
const stateOf = (r: AlertRule) => status.value[r.id] ?? 'firing';
const filtered = computed(() => rules.value.filter((r) => level.value === 'ALL' || r.level === level.value));
const visible = computed(() => filtered.value.slice(0, cap.value));
/** 阈值说明：唯一清单，不允许各端口径漂移 */
const THRESHOLDS: { level: 'P0' | 'P1' | 'P2'; channel: string; theme: 'danger' | 'warning' | 'primary'; text: string }[] = [
  { level: 'P0', channel: '页面强提醒（穿透静默）', theme: 'danger', text: '协议面错误率 >5% 持续 5min；事件写入失败 >1% 持续 5min；探活失败 ≥3 次；存储水位 ≥90%；SEV1/2 触发即报' },
  { level: 'P1', channel: '通知（桌面 + IM，30s 去重）', theme: 'warning', text: '消费者滞后 >60s（P95）；模型错误率 >10%；沙箱不可用率 >20%；日成本 >基线×1.5；超时审批 >20/小时' },
  { level: 'P2', channel: '工单（工作时段处理）', theme: 'primary', text: '索引滞后 >30s 持续 15min；任一插件熔断' },
];const columns = [
  { colKey: 'level', title: '等级', width: 74 }, { colKey: 'name', title: '规则名', width: 148 },
  { colKey: 'threshold', title: '阈值', width: 92 }, { colKey: 'current', title: '当前值', width: 132 },
  { colKey: 'duration', title: '持续时间', width: 96 }, { colKey: 'runbook', title: '绑定 Runbook', width: 152 },
  { colKey: 'executorRole', title: '执行人角色', width: 118 }, { colKey: 'status', title: '状态', width: 82 },
  { colKey: 'op', title: '操作', width: 124 },
];
const levelTheme = (l: string) => THRESHOLDS.find((t) => t.level === l)?.theme ?? 'primary';
function ack(r: AlertRule): void {
  status.value = { ...status.value, [r.id]: 'acked' };
  MessagePlugin.success(`已确认 ${r.id} ${r.name}（确认不等于解决，仍在观察窗口内）`);
}
function resolve(r: AlertRule): void {
  status.value = { ...status.value, [r.id]: 'resolved' };
  MessagePlugin.success(`已解决 ${r.id}；请按 Runbook 成功判据复核后归档`);
}
/** 打开绑定 Runbook：保留触发告警上下文，避免执行时丢失现场 */
function openRunbook(r: AlertRule): void {
  active.value = r;
  activeRb.value = runbookOf(r.runbookId);
}
function closeRunbook(): void {
  active.value = null; activeRb.value = null;
}
function exportBoard(): void {
  const file = downloadJson({ level: level.value, rules: filtered.value.map((r) => ({ ...r, status: stateOf(r) })) }, 'oc-alert-board.json');
  MessagePlugin.success(`已导出告警清单：${file}`);
}
onMounted(() => {
  window.setTimeout(() => {
    state.value = rules.value.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="告警中心"
      desc="三级告警：P0 页面强提醒 / P1 通知 / P2 工单；每条告警必须绑定 Runbook（缺失即标红并禁止确认），执行人角色与升级路径一致。"
      volume="卷 32"
      manifest="G5-02"
      cli="oc alert list --level P0 --with-runbook"
      :status="[{ label: 'Runbook 强绑定', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportBoard">导出清单</Button>
        <Button size="small" theme="primary" @click="level = 'P0'">只看 P0</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      :collapsed-summary="`当前筛出 ${filtered.length} 条告警，已折叠至 ${cap} 条（超出阈值先渲染高优先级）`"
      :page-size="visible.length"
      empty-title="当前等级没有告警"
      empty-desc="该等级近 30 天无触发记录；阈值说明仍在下方常驻，可据此核对是否漏配规则。"
      empty-action="查看全部等级"
      example-task="复核 P1「沙箱不可用率 >20%」阈值是否与演练结论一致"
      what="告警规则加载失败" why="规则中心返回 503，端上不会用缓存推导「无告警」结论（漏报风险高于误报）"
      how="可重试；如仍失败请携带 traceId 与时间窗导出诊断包"
      trace-id="trace-alert-5c81ab"
      @retry="state = 'LOADING'" @load-more="cap += 10" @empty-action="level = 'ALL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="P0 页面告警" :value="rules.filter((r) => r.level === 'P0').length" unit="条" format="raw" icon="notification" :lower-is-better="true" />
        <StatCard label="P1 通知" :value="rules.filter((r) => r.level === 'P1').length" unit="条" format="raw" icon="sound" :lower-is-better="true" />
        <StatCard label="P2 工单" :value="rules.filter((r) => r.level === 'P2').length" unit="条" format="raw" icon="task" :lower-is-better="true" />
        <StatCard label="Runbook 覆盖率" :value="(rules.filter((r) => runbookOf(r.runbookId)).length / rules.length) * 100" unit="%" format="number" icon="bookmark" target-kind="min" :target="100" hint="缺失项以红色 Tag 暴露" />
      </div>

      <div class="oc-grid oc-grid--3" style="margin-top: 12px">
        <div v-for="t in THRESHOLDS" :key="t.level" class="oc-card">
          <Tag size="small" :theme="t.theme" variant="light-outline">{{ t.level }} · {{ t.channel }}</Tag>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">{{ t.text }}</div>
        </div>
      </div>

      <div class="oc-flex--between" style="margin-top: 12px">
        <RadioGroup v-model="level" size="small" variant="default-filled">
          <RadioButton value="ALL">全部</RadioButton>
          <RadioButton value="P0">P0 页面</RadioButton>
          <RadioButton value="P1">P1 通知</RadioButton>
          <RadioButton value="P2">P2 工单</RadioButton>
        </RadioGroup>
        <span class="oc-muted" style="font-size: 12px">规则数：{{ filtered.length }}（已渲染 {{ visible.length }}）</span>
      </div>

      <Table :data="visible" :columns="columns" row-key="id" size="small" style="margin-top: 8px">
        <template #level="{ row }"><Tag size="small" :theme="levelTheme(row.level)" variant="light-outline">{{ row.level }}</Tag></template>
        <template #name="{ row }">
          <span>{{ row.name }}</span>
          <Tooltip v-if="row.note" :content="row.note"><Tag size="small" variant="outline" theme="warning" style="margin-left: 4px">说明</Tag></Tooltip>
        </template>
        <template #threshold="{ row }"><span class="oc-mono">{{ row.threshold }}</span></template>
        <template #current="{ row }"><span class="oc-mono">{{ CURRENT[row.id] ?? '—' }}</span></template>
        <template #runbook="{ row }">
          <Button v-if="runbookOf(row.runbookId)" size="small" variant="text" @click="openRunbook(row)">{{ row.runbookId }} · 打开</Button>
          <Tag v-else size="small" theme="danger" variant="light-outline">Runbook 缺失 · 禁止确认</Tag>
        </template>
        <template #status="{ row }">
          <Tag size="small" :theme="stateOf(row) === 'firing' ? 'danger' : stateOf(row) === 'acked' ? 'warning' : 'success'" variant="light-outline">
            {{ stateOf(row) === 'firing' ? '告警中' : stateOf(row) === 'acked' ? '已确认' : '已解决' }}
          </Tag>
        </template>
        <template #op="{ row }">
          <div class="oc-flex" style="gap: 4px">
            <Button size="small" variant="outline" :disabled="!runbookOf(row.runbookId) || stateOf(row) !== 'firing'" @click="ack(row)">确认</Button>
            <Button size="small" variant="outline" :disabled="!runbookOf(row.runbookId)" @click="resolve(row)">解决</Button>
          </div>
        </template>
      </Table>
      <div class="oc-state__hint">缺失 Runbook 的规则处于「候选」态：不进入值班通知、不参与自动升级；补齐步骤 / 验证命令 / 成功判据后方可启用。</div>

      <Drawer :visible="Boolean(activeRb)" :header="`${activeRb?.id ?? ''} · ${activeRb?.title ?? ''}`" size="480px" :footer="false" @close="closeRunbook">
        <div v-if="activeRb" class="oc-stack" style="font-size: 13px">
          <div class="oc-flex--between">
            <span>执行人角色：{{ activeRb.executorRole }}</span>
            <CopyableId :id="`trace-${activeRb.id}-runbook`" label="复制 traceId" />
          </div>
          <div class="oc-muted" style="font-size: 12px">触发告警：{{ active?.id }} {{ active?.name }}（阈值 {{ active?.threshold }}，当前 {{ CURRENT[active?.id ?? ''] ?? '—' }}，执行人 {{ active?.executorRole }}，通道 {{ active?.channel }}）</div>
          <div>验证命令：<code class="oc-mono">{{ activeRb.verifyCommand }}</code> ｜ 成功判据：{{ activeRb.successCriteria }}</div>
          <div class="oc-divider" />
          <div v-for="s in activeRb.steps" :key="s.no">
            <b>{{ s.no }}. {{ s.action }}</b>
            <div class="oc-mono oc-muted" style="font-size: 12px">{{ s.command }} ｜ 预期：{{ s.expected }}</div>
          </div>
          <div class="oc-muted" style="font-size: 12px">危险操作（冻结 / 限流 / 降级）在 Runbook 内已标注影响面与可逆性，执行前必须二次确认。</div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
