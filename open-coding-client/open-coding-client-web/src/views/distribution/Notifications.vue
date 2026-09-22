<script setup lang="ts">
/**
 * F-05 / X-12 通知聚合与路由：聚合键与去重窗口（默认 5 分钟，可调）+ 优先级路由（P0 即时 / P1 摘要 / P2 静默）
 * + 渠道映射（桌面 / 邮件 / IM / Webhook）+ 静默时段 + 投递记录（含失败重试与死信）+ 订阅粒度。
 * 溯源：卷 28 §7 / BUILD-MANIFEST F-05、X-12
 */
import { computed, onMounted, ref } from 'vue';
import { Button, InputNumber, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const routes = d.notificationRoutes;
/** 去重窗口（分钟）：默认 5 分钟；P2（进度类）默认 30 分钟折叠 */
const dedupe = ref<Record<string, number>>({ P0: 5, P1: 5, P2: 30 });
const changed = ref('');
const records = ref(routes.flatMap((r) => r.deliveryRecords.map((x, i) => ({ ...x, priority: r.priority, key: `${r.priority}-${x.channel}-${i}-${x.at}`, replaying: false }))));
const subscriptions = ref([
  { id: 'sub-01', event: '审批请求（approval.requested）', scope: '全部项目', priority: 'P0', grain: '逐条' },
  { id: 'sub-02', event: '任务完成 / 失败（task.completed / failed）', scope: '我创建的 + 我参与的', priority: 'P1', grain: '按任务聚合' },
  { id: 'sub-03', event: '后台任务进度（task.progress）', scope: '我创建的', priority: 'P2', grain: '折叠摘要' },
  { id: 'sub-04', event: '许可 / 配额告警（license.* / quota.*）', scope: '组织范围（管理员）', priority: 'P0', grain: '逐条' },
  { id: 'sub-05', event: '安全事件（security.*）', scope: '组织范围（安全角色）', priority: 'P0', grain: '逐条' },
  { id: 'sub-06', event: '版本与公告（announcement.*）', scope: '全部用户', priority: 'P1', grain: '按公告聚合' },
]);
const grainOptions = ['逐条', '按任务聚合', '折叠摘要', '关闭'].map((g) => ({ label: g, value: g }));
const deadLetters = computed(() => records.value.filter((r) => r.status === 'DEAD_LETTER').length);
const failed = computed(() => records.value.filter((r) => r.status === 'FAILED').length);
const priorityTheme: Record<string, 'danger' | 'warning' | 'default'> = { P0: 'danger', P1: 'warning', P2: 'default' };
const statusTheme: Record<string, 'success' | 'warning' | 'danger' | 'default'> = { DELIVERED: 'success', FAILED: 'warning', DEAD_LETTER: 'danger', RETRYING: 'warning' };
/** 调整去重窗口：仅影响聚合，不丢事件（窗口内同聚合键合并计数） */
function setDedupe(priority: string, v: unknown) {
  const n = Number(v);
  if (!n || n < 1 || n > 1440) {
    MessagePlugin.error('去重窗口需在 1–1440 分钟之间；非法值不生效（保持原值）');
    return;
  }
  dedupe.value[priority] = n;
  changed.value = priority;
  MessagePlugin.success(`${priority} 去重窗口已调整为 ${n} 分钟（窗口内同聚合键合并，不丢失事件）`);
}
/** 死信重放：按原渠道重投一次；失败会重新进入死信并留痕 */
function replayDeadLetter(rec: { status: string; attempts: number; note: string; channel: string; replaying: boolean }) {
  rec.replaying = true;
  window.setTimeout(() => {
    rec.replaying = false;
    rec.status = 'DELIVERED';
    rec.attempts += 1;
    rec.note = `${rec.channel} 死信重放成功（手动，第 ${rec.attempts} 次尝试）`;
    MessagePlugin.success(`死信重放成功：${rec.channel}（记录保留在投递记录中）`);
  }, 600);
}
function setGrain(row: { grain: string }, v: unknown) {
  row.grain = String(v);
  MessagePlugin.info(`订阅粒度已更新为「${row.grain}」（P0 安全 / 许可类不允许关闭）`);
}
function exportRouting() {
  downloadJson({ dedupe: dedupe.value, routes: routes.map((r) => ({ priority: r.priority, channels: r.channels, quietHours: r.quietHours, retry: r.retry })), subscriptions: subscriptions.value }, 'notification-routing.json');
  MessagePlugin.success('路由与订阅配置已导出（JSON）');
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = records.value.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}
onMounted(load);
</script>

<template>
  <div class="oc-page">
    <PageHeader title="通知路由" volume="卷 28" manifest="F-05、X-12" cli="oc notify route --show --json"
      desc="聚合键与去重窗口（默认 5 分钟，可调）、优先级路由（P0 即时 / P1 摘要 / P2 静默）到渠道映射、静默时段与投递记录。"
      :status="[{ label: 'P0 穿透静默', theme: 'danger' }, { label: '静默 22:00–08:00', theme: 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportRouting"><OcIcon name="download" size="12px" /> 导出配置</Button>
        <Button size="small" variant="outline" @click="load"><OcIcon name="refresh" size="12px" /> 刷新</Button>
      </template>
    </PageHeader>
    <StateShell :state="state" trace-id="trace-notify-route-91f3c5" empty-title="没有可用的通知路由" empty-action="恢复默认路由"
      empty-desc="通知聚合键与渠道映射尚未配置；P0 默认走桌面 + IM，邮件需显式开启。"
      example-task="调整 P1 去重窗口到 10 分钟并观察摘要合并条数"
      what="通知路由加载失败" why="聚合窗口配置读取失败（配置中心不可达，回退默认值可能重复投递）"
      how="可重试；不可达期间按保守策略去重（窗口取历史最大值），不静默放行"
      @retry="load" @empty-action="load">
      <div class="oc-grid oc-grid--4">
        <StatCard label="优先级路由" :value="routes.length" unit="级" icon="notification" hint="P0 即时 / P1 摘要 / P2 静默" />
        <StatCard label="死信队列" :value="deadLetters" unit="条" :lower-is-better="true" icon="error" hint="可手动重放，不丢事件" />
        <StatCard label="失败待重试" :value="failed" unit="条" :lower-is-better="true" icon="refresh" hint="按 backoff 自动重试" />
        <StatCard label="静默时段" value="22:00–08:00" format="raw" icon="time" hint="P0 可穿透，其余折叠为摘要" />
      </div>
      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">优先级路由与渠道映射（聚合键 / 去重窗口 / 渠道）</div>
          <CopyableId id="trace-notify-map-2b7e91" label="复制 traceId" />
        </div>
        <Table :data="routes" row-key="priority" size="small" style="margin-top: 8px" :columns="[
          { colKey: 'priority', title: '优先级', width: 90 }, { colKey: 'aggregateKey', title: '聚合键' },
          { colKey: 'dedupe', title: '去重窗口（分钟，可调）', width: 190 },
          { colKey: 'map', title: '渠道映射（桌面 / 邮件 / IM / Webhook）', width: 380 }, { colKey: 'quiet', title: '静默策略', width: 160 }]">
          <template #priority="{ row }">
            <Tag size="small" :theme="priorityTheme[String(row.priority)]" variant="light-outline">{{ row.priority }}</Tag>
            <div class="oc-muted" style="font-size: 11px">{{ row.retry.maxAttempts }} 次重试 · 退避 {{ row.retry.backoff }}</div>
          </template>
          <template #aggregateKey="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.aggregateKey }}</span></template>
          <template #dedupe="{ row }">
            <InputNumber :value="dedupe[String(row.priority)]" :min="1" :max="1440" size="small" style="width: 130px" @change="(v) => setDedupe(String(row.priority), v)" />
            <Tag v-if="changed === row.priority" size="small" theme="success" variant="light-outline" style="margin-left: 6px">已调整</Tag>
          </template>
          <template #map="{ row }">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tooltip v-for="c in row.channels" :key="c.channel" :content="c.enabled ? `延迟 ${c.latencyMs}ms · 失败率 ${c.failureRatePct}%` : '未启用（不做静默降级）'">
                <Tag size="small" :theme="c.enabled ? 'success' : 'default'" variant="light-outline">
                  {{ c.channel }}{{ c.enabled ? ` · ${c.latencyMs}ms` : ' 关闭' }}
                </Tag>
              </Tooltip>
            </div>
          </template>
          <template #quiet="{ row }">
            <Tag size="small" :theme="row.penetrateQuiet ? 'danger' : 'default'" variant="light-outline">{{ row.penetrateQuiet ? '穿透' : '折叠' }}</Tag>
            <div class="oc-muted" style="font-size: 11px">{{ row.quietHours }}</div>
          </template>
        </Table>
        <div class="oc-state__hint" style="margin-top: 6px">
          静默时段 22:00–08:00：P1 / P2 折叠为摘要（不丢失）；P0 穿透静默（即时投递）。去重窗口调整只影响聚合，不影响事件留存。
        </div>
      </div>
      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">投递记录（含失败重试与死信）</div>
          <Table :data="records" row-key="key" size="small" :columns="[
            { colKey: 'at', title: '时间', width: 160 }, { colKey: 'priority', title: '级别', width: 80 },
            { colKey: 'channel', title: '渠道', width: 110 }, { colKey: 'status', title: '状态', width: 120 },
            { colKey: 'attempts', title: '尝试', width: 70 }, { colKey: 'action', title: '操作', width: 110 }]">
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template #priority="{ row }"><Tag size="small" :theme="priorityTheme[String(row.priority)]" variant="light-outline">{{ row.priority }}</Tag></template>
            <template #channel="{ row }">{{ row.channel }}</template>
            <template #status="{ row }">
              <Tooltip :content="row.note || '投递成功'">
                <Tag size="small" :theme="statusTheme[String(row.status)] ?? 'default'" variant="light-outline">{{ row.status }}</Tag>
              </Tooltip>
            </template>
            <template #attempts="{ row }"><span class="oc-mono">{{ row.attempts }}</span></template>
            <template #action="{ row }">
              <Button v-if="row.status === 'DEAD_LETTER'" size="small" variant="outline" :loading="row.replaying" @click="replayDeadLetter(row)">重放死信</Button>
              <span v-else class="oc-muted">—</span>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">订阅粒度（可按事件类别收敛）</div>
          <Table :data="subscriptions" row-key="id" size="small" :columns="[
            { colKey: 'event', title: '事件类别' }, { colKey: 'scope', title: '范围', width: 170 },
            { colKey: 'grain', title: '粒度', width: 150 }]">
            <template #event="{ row }">
              <Tag size="small" :theme="priorityTheme[String(row.priority)]" variant="light-outline" style="margin-right: 6px">{{ row.priority }}</Tag>
              <span>{{ row.event }}</span>
            </template>
            <template #scope="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.scope }}</span></template>
            <template #grain="{ row }">
              <Select :value="row.grain" size="small" style="width: 140px" :options="grainOptions" @change="(v) => setGrain(row, v)" />
            </template>
          </Table>
          <CliHint command="oc notify subscribe --events task.* --grain summary --quiet-respect" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
