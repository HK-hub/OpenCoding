<script setup lang="ts">
/**
 * 审批通道与 SLA（P-08 / 卷 06 D-PERM-5、D-PERM-8、§10）：
 * 四通道（CLI 内联 / 桌面卡片 / 远程 A2A 回调 / IM 机器人）+ 投递记录 + 三级升级链 SLA
 * + 超时动作（deny/escalate，默认 deny，企业可配 escalate）+ 30s 去重窗口 + 静默穿透说明。
 * 通道不可用时按 fail-closed：不因「投递失败」被视为已通知。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, InputNumber, MessagePlugin, RadioGroup, RadioButton, Switch, Table, Tag, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { approvalData } from '@/mock/data/approval';
import type { ApprovalChannel } from '@/mock/data/approval';
import { makeError, type MockError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = approvalData;

const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);
const channelState = ref<Record<ApprovalChannel['id'], ApprovalChannel['state']>>({
  cli: 'READY',
  desktop: 'READY',
  a2a: 'DEGRADED',
  im: 'UNAVAILABLE',
});
const enabled = ref<Record<ApprovalChannel['id'], boolean>>({ cli: true, desktop: true, a2a: true, im: false });
const dedupeSeconds = ref(30);
const quietPenetrate = ref(true);
/** 超时动作：默认 deny（安全默认），仅高风险/长时执行可配 escalate */
const timeoutAction = ref<'deny' | 'escalate'>('deny');
const highRiskEscalate = ref(true);
const slaDraft = ref(data.escalationTemplate.map((l) => l.slaMinutes));

const channelMeta: Record<ApprovalChannel['id'], { icon: string; client: string }> = {
  cli: { icon: 'terminal', client: 'CLI / TUI（进程内联渲染）' },
  desktop: { icon: 'platform', client: '桌面 / Web 工作台卡片' },
  a2a: { icon: 'link', client: '远程实例回调（A2A 协议）' },
  im: { icon: 'mail', client: 'IM 机器人卡片' },
};

const stateTag = (s: ApprovalChannel['state']) =>
  s === 'READY' ? { theme: 'success' as const, text: '可达' } : s === 'DEGRADED' ? { theme: 'warning' as const, text: '降级（重试中）' } : { theme: 'danger' as const, text: '不可用（熔断）' };

const columns: PrimaryTableCol[] = [
  { colKey: 'at', title: '时间', width: 148 },
  { colKey: 'channel', title: '通道', width: 110 },
  { colKey: 'approvalId', title: '审批号', width: 120 },
  { colKey: 'result', title: '结果', width: 120 },
  { colKey: 'latency', title: '时延 / 重试', width: 130 },
  { colKey: 'detail', title: '明细' },
];

const reachable = computed(() => Object.values(channelState.value).filter((s) => s === 'READY').length);
const shellState = computed(() => {
  if (ui.connection !== 'CONNECTED') return 'OFFLINE' as const;
  if (failure.value) return 'ERROR' as const;
  if (phase.value === 'LOADING') return 'LOADING' as const;
  return data.deliveries.length > 10 ? ('EDGE_DATA' as const) : ('NORMAL' as const);
});

function saveConfig() {
  MessagePlugin.success(`超时动作已保存：默认 ${timeoutAction.value === 'deny' ? 'deny（按策略拒绝）' : 'escalate（升级）'}，去重窗口 ${dedupeSeconds.value}s（写入配置后立即对新请求生效）`);
}

function toggleChannel(id: ApprovalChannel['id'], v: unknown) {
  enabled.value = { ...enabled.value, [id]: Boolean(v) };
}

function retryDelivery(id: ApprovalChannel['id']) {
  const ch = data.channels.find((c) => c.id === id)!;
  ch.failureRetries += 1;
  ch.lastDelivery = { at: new Date().toISOString(), approvalId: ch.lastDelivery.approvalId, result: '重试已发起（等待 ACK）' };
  MessagePlugin.warning(`${ch.name}：已发起一次投递重试；失败按「指数退避 5s/15s/45s」继续，仍失败则降级通道并显式标注`);
}

function verifyChannel(id: ApprovalChannel['id']) {
  channelState.value = { ...channelState.value, [id]: id === 'im' ? 'UNAVAILABLE' : 'READY' };
  MessagePlugin[id === 'im' ? 'warning' : 'success'](
    id === 'im' ? 'IM 通道校验失败：Webhook 签名不匹配，仍保持熔断（不静默失败）' : '通道校验通过：可达且签名有效',
  );
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="审批通道与 SLA"
      desc="一处编排、多端呈现：四通道投递与失败重试可见；三级升级链带 SLA；超时动作默认 deny，企业可配 escalate；同动作 30s 去重合并。"
      volume="卷 06"
      manifest="P-08"
      cli="oc approval channels --enable desktop,a2a --timeout-action deny --dedupe 30s"
      :status="[{ label: `可达通道 ${reachable}/4`, theme: reachable >= 2 ? 'success' : 'warning' }, { label: '通道不可用按 fail-closed', theme: 'default' }]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次通道配置读取失败">
          <Button size="small" variant="text" @click="failure = makeError('DEPENDENCY_UNAVAILABLE', 'channel registry')">模拟异常</Button>
        </Tooltip>
        <Button size="small" theme="primary" @click="saveConfig">保存配置</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="可达通道" :value="reachable" unit="/ 4" format="raw" icon="link" :target="4" />
      <StatCard label="投递失败（近 7 天）" :value="data.deliveries.filter((d) => d.result === 'FAILED').length" unit="次" format="raw" icon="error" />
      <StatCard label="去重合并" :value="data.deliveries.filter((d) => d.result === 'MERGED').length" unit="次" format="raw" icon="filter" hint="同 actor+动作+资源，窗口内合并为一张卡并标注「同动作 ×N」" />
      <StatCard label="升级中的请求" :value="data.escalations.filter((e) => !e.resolved).length" unit="条" format="raw" icon="secured" />
    </div>

    <StateShell
      :state="shellState"
      stage="正在读取通道健康与投递记录…"
      cancellable
      empty-title="尚未配置任何审批通道"
      empty-desc="至少启用一个通道，否则审批请求将按 fail-closed 直接拒绝（不静默通过）。"
      empty-action="启用桌面通道"
      what="通道配置读取失败"
      :why="failure?.message ?? ''"
      how="可重试；若通道服务持续不可用，请先用桌面通道兜底并导出诊断包。"
      :trace-id="failure?.traceId ?? ''"
      :collapsed-summary="`投递记录 ${data.deliveries.length} 条，已折叠展示前 10 条`"
      :page-size="10"
      :disabled-capabilities="['通道开关', '超时动作保存', '投递重试']"
      @retry="failure = null; ui.simulateReconnect()"
    >
      <div class="oc-grid oc-grid--2">
        <div v-for="ch in data.channels" :key="ch.id" class="oc-card">
          <div class="oc-flex--between oc-flex--wrap">
            <div class="oc-flex" style="gap: 6px">
              <OcIcon :name="channelMeta[ch.id].icon" size="15px" />
              <b style="font-size: 13px">{{ ch.name }}</b>
              <Tag :theme="stateTag(channelState[ch.id]).theme" size="small" variant="light-outline">{{ stateTag(channelState[ch.id]).text }}</Tag>
            </div>
            <div class="oc-flex" style="gap: 8px">
              <Switch :value="enabled[ch.id]" size="small" @change="(v) => toggleChannel(ch.id, v)" />
              <Button size="small" variant="outline" @click="verifyChannel(ch.id)">校验</Button>
              <Button size="small" variant="text" @click="retryDelivery(ch.id)">重试投递</Button>
            </div>
          </div>
          <InfoGrid
            :columns="1"
            style="margin-top: 8px"
            :items="[
              { key: 'client', label: '呈现形态', value: channelMeta[ch.id].client },
              { key: 'target', label: '投递目标', value: ch.deliveryTarget, mono: true },
              { key: 'last', label: '最近投递', value: `${new Date(ch.lastDelivery.at).toLocaleString('zh-CN')} · ${ch.lastDelivery.approvalId} · ${ch.lastDelivery.result}` },
              { key: 'retry', label: `失败重试（累计 ${ch.failureRetries} 次）`, value: ch.retryPolicy, block: true },
              { key: 'note', label: '约束', value: ch.note, block: true },
            ]"
          />
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">三级升级链与 SLA</h3>
          <Timeline>
            <TimelineItem v-for="(l, i) in data.escalationTemplate" :key="l.level" :dot-color="data.escalations.some((e) => !e.resolved && e.currentLevel === l.level) ? 'var(--oc-sev-warn)' : 'var(--td-brand-color)'">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag size="small" variant="outline">第 {{ l.level }} 级</Tag>
                <b style="font-size: 13px">{{ l.role }}</b>
                <Tag size="small" theme="primary" variant="light-outline">SLA {{ l.slaMinutes }} 分钟</Tag>
                <InputNumber v-model="slaDraft[i]" theme="normal" size="small" :min="1" :max="240" style="width: 96px" />
                <span class="oc-muted" style="font-size: 11px">分钟（修改后保存生效）</span>
              </div>
              <div class="oc-secondary" style="font-size: 12px">{{ l.note }}</div>
            </TimelineItem>
          </Timeline>
          <div class="oc-stack" style="margin-top: 8px">
            <div v-for="e in data.escalations" :key="e.approvalId" class="oc-card" style="padding: 8px 10px">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <CopyableId :id="e.approvalId" label="复制审批号" />
                <Tag :theme="e.resolved ? 'success' : 'warning'" size="small" variant="light-outline">{{ e.resolved ? '已裁决' : `升级中 · 第 ${e.currentLevel} 级` }}</Tag>
                <span class="oc-muted" style="font-size: 11px">SLA 剩余 {{ Math.round(e.slaRemainingMs / 60_000) }} 分钟 · 起始 {{ new Date(e.startedAt).toLocaleString('zh-CN') }}</span>
              </div>
              <div style="font-size: 12px; margin-top: 4px">{{ e.outcome }}</div>
            </div>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">超时动作（默认 deny，企业可配 escalate）</h3>
            <div class="oc-stack" style="gap: 8px">
              <RadioGroup v-model="timeoutAction">
                <RadioButton value="deny">deny：按策略拒绝（不计入用户主动拒绝）</RadioButton>
                <RadioButton value="escalate">escalate：升级至上级审批人（等待态）</RadioButton>
              </RadioGroup>
              <div class="oc-flex" style="gap: 8px">
                <Switch v-model="highRiskEscalate" size="small" />
                <span style="font-size: 13px">高风险（R4/R5）与长时执行请求单独使用 escalate</span>
              </div>
              <div class="oc-muted" style="font-size: 12px">
                端上不判定超时结果：倒计时仅展示（300s 兜底），终态由服务端按本配置收口并写入审计事件。
              </div>
            </div>
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">去重窗口与静默穿透</h3>
            <div class="oc-stack" style="gap: 8px">
              <div class="oc-flex oc-flex--wrap" style="gap: 8px">
                <span style="font-size: 13px">同 actor / 同动作 / 同资源去重窗口</span>
                <InputNumber v-model="dedupeSeconds" theme="normal" size="small" :min="5" :max="300" style="width: 96px" />
                <span class="oc-muted" style="font-size: 12px">秒（窗口内合并为一张卡并标注「同动作 ×N」，展开可见每次目标）</span>
              </div>
              <div class="oc-flex" style="gap: 8px">
                <Switch v-model="quietPenetrate" size="small" />
                <span style="font-size: 13px">静默时段穿透：安全事件 / 基线阻断 / 审批升级为 P0，穿透静默</span>
              </div>
              <div class="oc-flex" style="gap: 6px">
                <OcIcon name="secured" size="13px" />
                <span class="oc-secondary" style="font-size: 12px">
                  一般审批在静默时段折叠为摘要并保留角标（不丢内容）；fail-closed：所有通道不可达时按安全默认拒绝，并显式提示「无人应答」。
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          投递记录
          <Tag size="small" variant="outline">重复投递按 approvalId 幂等去重；降级不丢请求（降级到桌面通道并标注「远程不可达」）</Tag>
        </h3>
        <Table :data="data.deliveries" :columns="columns" row-key="id" size="small" :pagination="{ pageSize: 10, total: data.deliveries.length }">
          <template #at="{ row }">
            <span class="oc-mono" style="font-size: 11px">{{ new Date(row.at as string).toLocaleString('zh-CN') }}</span>
          </template>
          <template #channel="{ row }">
            <Tag size="small" variant="outline">{{ row.channel }}</Tag>
          </template>
          <template #approvalId="{ row }">
            <CopyableId :id="String(row.approvalId)" label="复制审批号" />
          </template>
          <template #result="{ row }">
            <Tag
              size="small"
              :theme="row.result === 'DELIVERED' ? 'success' : row.result === 'MERGED' ? 'primary' : row.result === 'RETRYING' ? 'warning' : 'danger'"
              variant="light-outline"
            >
              {{ row.result }}
            </Tag>
          </template>
          <template #latency="{ row }">
            <span class="oc-mono" style="font-size: 11px">{{ row.latencyMs }}ms · 重试 {{ row.retries }} 次</span>
          </template>
          <template #detail="{ row }">
            <span style="font-size: 12px">{{ row.detail }}</span>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
