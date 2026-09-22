<script setup lang="ts">
/**
 * 通知设置（F-05）：六类模板（级别 + 渠道 + 开关）+ 静默时段与 P0 穿透 + 聚合去重窗口 + 模板文案预览。
 * 六类模板文案取自 harness 原文，可渲染样例但不可改写模板语义。溯源：卷 33 §5 / X-12。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';

type Level = 'P0' | 'P1' | 'P2';

interface NotifyRow {
  kind: string;
  label: string;
  level: Level;
  channels: string[];
  enabled: boolean;
  /** harness 原文模板（占位符不可改写） */
  template: string;
  sample: string;
}

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const dedupeMinutes = ref(5);
const savedTip = ref('');

const CHANNELS = [
  { label: '桌面', value: 'desktop' },
  { label: '邮件', value: 'email' },
  { label: 'IM', value: 'im' },
  { label: 'Webhook', value: 'webhook' },
];
const LEVELS = [
  { label: 'P0 立即（可穿透静默）', value: 'P0' },
  { label: 'P1 尽快', value: 'P1' },
  { label: 'P2 摘要', value: 'P2' },
];

const rows = ref<NotifyRow[]>([
  { kind: 'need_input', label: '需人工介入', level: 'P0', channels: ['desktop', 'im', 'email'], enabled: true, template: '需要你确认：<动作摘要>', sample: '需要你确认：run_command mvn -pl payment-core test' },
  { kind: 'task_done', label: '任务完成', level: 'P1', channels: ['desktop', 'im'], enabled: true, template: '任务完成：<任务名>', sample: '任务完成：为 payment-core 增加幂等重试' },
  { kind: 'task_failed', label: '任务失败', level: 'P0', channels: ['desktop', 'im', 'webhook'], enabled: true, template: '任务失败：<任务名>', sample: '任务失败：identity-gateway 登录态排查（重试 3 次耗尽）' },
  { kind: 'goal_progress', label: '目标进展', level: 'P2', channels: ['email'], enabled: true, template: '目标进展：<目标名>', sample: '目标进展：季度迁移目标（本周 68%）' },
  { kind: 'cost_warning', label: '成本预警', level: 'P1', channels: ['desktop', 'email'], enabled: true, template: '成本预警：本周 82%', sample: '成本预警：本周 82%（预算 $120 / 已用 $98.4）' },
  { kind: 'security', label: '安全事件', level: 'P0', channels: ['desktop', 'im', 'email', 'webhook'], enabled: true, template: '安全事件：<类型>', sample: '安全事件：危险命令命中（rm -rf ./dist 已阻断）' },
]);

const p0Count = computed(() => rows.value.filter((r) => r.level === 'P0').length);
const enabledCount = computed(() => rows.value.filter((r) => r.enabled).length);

const columns = [
  { colKey: 'label', title: '通知类型', width: 130 },
  { colKey: 'level', title: '级别', width: 190 },
  { colKey: 'channels', title: '渠道', width: 260 },
  { colKey: 'enabled', title: '开关', width: 90 },
  { colKey: 'template', title: '模板（原文）', ellipsis: true },
];

function save() {
  const noChannel = rows.value.find((r) => r.enabled && !r.channels.length);
  if (noChannel) {
    MessagePlugin.error(`「${noChannel.label}」已开启但未选任何渠道：请至少保留一个渠道，或关闭该类型`);
    return;
  }
  savedTip.value = `已保存：${enabledCount.value}/6 类开启 · 聚合窗口 ${dedupeMinutes.value} 分钟`;
  ui.track('settings.notifications.saved', { dedupeMinutes: dedupeMinutes.value });
  MessagePlugin.success(savedTip.value);
}

const quietRange = computed(() => `${ui.quietHours[0]}–${ui.quietHours[1]}`);

onMounted(() => {
  window.setTimeout(() => { state.value = rows.value.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="通知设置" volume="卷 33" manifest="F-05"
      desc="六类通知模板的级别、渠道与开关；静默时段内 P0 可穿透，其余聚合为摘要。模板文案为 harness 原文。"
      cli="oc settings notifications --dedupe 5m --quiet 22:00-08:00 --p0-penetrate"
      :status="[{ label: `P0 类型 ${p0Count}`, theme: 'danger' }, { label: `静默 ${quietRange}`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">重新加载</Button>
        <Button size="small" theme="primary" @click="save">保存通知设置</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state" trace-id="trace-notify-2f81" :page-size="6"
      empty-title="没有可配置的通知类型" empty-desc="通知路由未加载（IM/Webhook 通道均未绑定），无法配置投递策略。"
      empty-action="绑定通知通道" example-task="把「成本预警」保持 P1 + 邮件，观察静默时段内的聚合行为"
      what="通知配置加载失败" why="通知路由表读取失败（IM 通道凭证引用不可解析）"
      how="可重试；失败时保持「仅桌面通道」的安全默认，不会静默丢弃 P0"
      collapsed-summary="通知类型超过单页阈值，低频类型（公告类）已折叠。"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已打开通道绑定向导')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">静默时段与穿透</div>
          <InfoGrid :columns="2" :items="[
            { key: 'range', label: '静默时段', value: `${quietRange}（本地时区）` },
            { key: 'p0', label: 'P0 穿透', value: '强制执行：安全事件与需人工介入不受静默限制' },
            { key: 'sum', label: '静默内 P1/P2', value: '聚合为单条摘要，恢复后一次性投递' },
            { key: 'dedupe', label: '聚合去重窗口', value: `同一 aggregateKey 在 ${dedupeMinutes} 分钟内合并计数` },
          ]" />
          <div class="oc-flex" style="gap: 8px; align-items: center; margin-top: 8px">
            <span style="font-size: 12px">聚合窗口</span>
            <Select v-model="dedupeMinutes" size="small" style="width: 160px" :options="[1, 5, 15, 30].map((m) => ({ label: `默认 ${m} 分钟`, value: m }))" />
            <Switch :model-value="true" disabled size="small" />
            <Tag size="small" theme="danger" variant="light-outline">P0 穿透：不可关闭</Tag>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">投递语义说明</div>
          <InfoGrid :columns="1" :items="[
            { key: 'l0', label: 'P0', value: '立即投递全部启用渠道；失败重试 + 死信 + 回执追踪' },
            { key: 'l1', label: 'P1', value: '优先桌面/IM；静默期折叠进摘要，不逐条打扰' },
            { key: 'l2', label: 'P2', value: '仅邮件/摘要，不产生实时打扰' },
            { key: 'fail', label: '失败语义', value: '通道不可用按 fail-closed：不视为已通知，转入重试与死信' },
          ]" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">提示：通知≠授权。通知只做告知，任何放行仍需走审批链路。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">六类通知模板</div>
        <Table :data="rows" row-key="kind" size="small" :columns="columns" :pagination="undefined">
          <template #level="{ row }"><Select v-model="row.level" size="small" :options="LEVELS" /></template>
          <template #channels="{ row }">
            <Select v-model="row.channels" multiple size="small" :options="CHANNELS" :min-collapsed-num="2" />
          </template>
          <template #enabled="{ row }">
            <Switch v-model="row.enabled" size="small" :aria-label="`${row.label}通知开关`" />
          </template>
          <template #template="{ row }">
            <span class="oc-mono" style="font-size: 11px">{{ row.template }}</span>
            <Tag v-if="row.level === 'P0'" size="small" theme="danger" variant="outline" style="margin-left: 6px">穿透静默</Tag>
          </template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">六类模板文案预览（harness 原文 → 渲染样例）</div>
        <div class="oc-stack" style="gap: 6px">
          <div v-for="r in rows" :key="`p-${r.kind}`" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Tag size="small" :theme="r.level === 'P0' ? 'danger' : r.level === 'P1' ? 'warning' : 'default'" variant="light-outline">{{ r.level }}</Tag>
            <span class="oc-mono" style="font-size: 11px">{{ r.template }}</span>
            <span class="oc-muted" style="font-size: 12px">→ {{ r.sample }}</span>
          </div>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc settings notifications --preview-templates" />
          <Popconfirm content="发送测试通知会给全部启用渠道投递一条样例（含 IM/Webhook），确认发送？" theme="warning" @confirm="MessagePlugin.info('测试通知已入队：P0 立即投递，P2 进入摘要队列')">
            <Button size="small" variant="outline">发送测试通知</Button>
          </Popconfirm>
          <span v-if="savedTip" class="oc-muted" style="font-size: 12px">{{ savedTip }}</span>
          <CopyableId id="trace-notify-2f81" label="复制 traceId" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
