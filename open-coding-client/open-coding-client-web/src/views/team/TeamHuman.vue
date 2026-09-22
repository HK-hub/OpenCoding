<script setup lang="ts">
/**
 * 人机混合（R-10 + R-11）：人类任务卡认领 + 产出提交 + SLA 超时提醒/转派 + 人类作为裁决收件人 + 团队报告（阶段/完成）。
 * 溯源：卷 13 D-TEAM-8 人机混合 / §4.6 人类任务与 SLA / §4.2 团队报告。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { STATUS_META, taskData } from '@/mock/data/task';
import type { WorkItem } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref('TEAM-checkout-01');
const submitOpen = ref(false);
const submitTarget = ref<WorkItem | null>(null);
const submitNote = ref('已完成真机弱网验证：200 次重试仅一次扣减，抓包与服务端日志已归档到 evidence://T-5a31/mobile。');
const claims = ref<string[]>([]);
/** SLA 提醒登记：任务 shortId → 最近一次提醒时间（行内可见，避免「已发送」无痕） */
const reminderLog = ref<Record<string, string>>({});
/** 本页生成的团队完成报告（含证据/未决项/成本，落成对象并渲染） */
const completionReports = ref<{ id: string; at: string; by: string; progress: number; evidence: number; cost: number; openItems: string[] }[]>([]);

const team = computed(() => taskData.teams.find((t) => t.teamId === selected.value) ?? taskData.teams[0]);
/** 人类成员承担的任务（含团队内人类成员与指派给人类的团队任务） */
const humanTasks = computed(() => taskData.workItems
  .filter((i) => (i.level === 'task' || i.level === 'step') && i.assignee.type === 'human')
  .map((i) => {
    const member = team.value.members.find((m) => m.type === 'human');
    const sla = member?.slaMinutes ?? 240;
    const age = Math.round((Date.now() - +new Date(i.startAt ?? Date.now())) / 60_000);
    return { item: i, sla, age, overdue: age > sla };
  }));

const stats = computed(() => ({
  human: team.value.members.filter((m) => m.type === 'human').length,
  tasks: humanTasks.value.length,
  overdue: humanTasks.value.filter((h) => h.overdue).length,
  claimed: claims.value.length,
}));

const columns = [
  { colKey: 'shortId', title: '任务', width: 110 },
  { colKey: 'title', title: '任务' },
  { colKey: 'assignee', title: '承担者', width: 150 },
  { colKey: 'sla', title: 'SLA 状态', width: 200 },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'op', title: '操作', width: 190 },
];

function claim(item: WorkItem) {
  if (claims.value.includes(item.shortId)) {
    MessagePlugin.error(`${item.shortId} 你已认领（认领登记防重复）`);
    return;
  }
  claims.value.push(item.shortId);
  MessagePlugin.success(`已认领 ${item.shortId}：任务状态与 Agent 任务同构（进行中），事件与审计一致`);
}

function submit() {
  const t = submitTarget.value;
  if (!t) return;
  if (!submitNote.value.trim()) {
    MessagePlugin.error('产出说明必填：无说明的提交无法进入验收（证据必须可检验）');
    return;
  }
  t.status = 'in_review';
  submitOpen.value = false;
  MessagePlugin.success(`${t.shortId} 产出已提交：进入待验收，证据挂载到黑板`);
}

function transfer(item: WorkItem) {
  item.assignee = { type: 'agent', id: 'agent-impl-01', name: '实现者 · 落霞' };
  MessagePlugin.success(`${item.shortId} 已转派给 Agent：SLA 超时提醒升级为转派（原人类成员保留观察）`);
}

/** 发送 SLA 提醒：逐条人类任务登记提醒时间（含任务与剩余时间），行内可见 */
function sendReminders() {
  const rows = humanTasks.value;
  if (!rows.length) {
    MessagePlugin.warning('当前没有人类任务，无需发送 SLA 提醒');
    return;
  }

  const at = new Date().toISOString();
  rows.forEach((h) => { reminderLog.value[h.item.shortId] = at; });
  const overdue = rows.filter((h) => h.overdue).length;
  MessagePlugin.success(`已向 ${rows.length} 项人类任务发送 SLA 提醒（含任务与剩余时间，其中超时 ${overdue} 项），提醒时间已登记在任务行`);
}

/** 生成团队完成报告：按当前团队数据落成报告对象（证据/未决项/成本）并追加到报告列表 */
function generateCompletionReport() {
  const rep = team.value.report;
  const seq = completionReports.value.length + 1;
  const report = {
    id: `RPT-${String(seq).padStart(2, '0')}`,
    at: new Date().toISOString(),
    by: '主管 Agent',
    progress: rep.progress,
    evidence: rep.evidence,
    cost: rep.cost,
    openItems: rep.openItems,
  };
  completionReports.value.unshift(report);
  MessagePlugin.success(`已生成团队完成报告 ${report.id}（证据 ${report.evidence} 条 / 未决项 ${report.openItems.length} 项 / 成本 $${report.cost}），见「团队报告」卡片列表`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = humanTasks.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="人机混合" volume="卷 13" manifest="R-10 / R-11" cli="oc team human TEAM-checkout-01 --sla --reports"
      desc="人类可作为团队成员：认领任务、提交产出、作为裁决收件人；人类任务有 SLA，超时提醒或转派 Agent；团队报告分阶段汇报与完成报告两种。"
      :status="[{ label: `人类成员 ${stats.human} 名`, theme: 'primary' }, { label: `${stats.overdue} 项 SLA 超时`, theme: stats.overdue ? 'danger' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="sendReminders">发送提醒</Button>
        <Button size="small" variant="outline" @click="generateCompletionReport">生成完成报告</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">团队：</span>
        <Select v-model="selected" size="small" style="width: 300px" :options="taskData.teams.map((t) => ({ label: `${t.name}（人类 ${t.members.filter((m) => m.type === 'human').length} 名）`, value: t.teamId }))" />
        <Tag size="small" variant="outline">裁决收件人：顾清和（架构评审委员会）</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="人类承担任务" :value="stats.tasks" unit="项" icon="user-circle" />
      <StatCard label="我已认领" :value="stats.claimed" unit="项" icon="check" />
      <StatCard label="SLA 超时" :value="stats.overdue" unit="项" icon="time" :lower-is-better="true" />
      <StatCard label="团队进度" :value="Math.round(team.report.progress * 100)" unit="%" icon="chart" :target="70" target-kind="min" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有人类任务" empty-desc="团队成员全为 Agent；人机混合需要至少一名人类成员（也可由人类担任主管）。" empty-action="添加人类成员"
      example-task="人类承担「移动端真机弱网验证」并提交抓包证据"
      what="人类任务列表加载失败" why="SLA 计时器与任务事件时间不一致（时钟漂移）"
      how="可重试；系统以事件时间为准重算 SLA 并标注漂移量" trace-id="trace-19ce4b88"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已添加人类成员（可认领任务）')"
    >
      <div class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">人类任务卡（认领 → 产出 → 提交）</div>
          <Table :data="humanTasks" row-key="item.itemId" size="small" :pagination="undefined" :columns="columns">
            <template #shortId="{ row }"><span class="oc-mono">{{ row.item.shortId }}</span></template>
            <template #title="{ row }">{{ row.item.title }}</template>
            <template #assignee="{ row }">{{ row.item.assignee.name }}</template>
            <template #sla="{ row }">
              <Tag size="small" :theme="row.overdue ? 'danger' : 'success'" variant="light-outline">
                {{ row.overdue ? `超时 ${row.age - row.sla} 分钟` : `剩余 ${row.sla - row.age} 分钟` }}
              </Tag>
              <span class="oc-muted" style="font-size: 11px"> SLA {{ row.sla }} 分钟</span>
              <div v-if="reminderLog[row.item.shortId]" class="oc-muted" style="font-size: 11px">已提醒 {{ new Date(reminderLog[row.item.shortId]).toLocaleTimeString('zh-CN') }}</div>
            </template>
            <template #status="{ row }">
              <Tag size="small" :theme="STATUS_META[row.item.status as keyof typeof STATUS_META].theme" variant="light-outline">{{ STATUS_META[row.item.status as keyof typeof STATUS_META].label }}</Tag>
            </template>
            <template #op="{ row }">
              <div class="oc-flex" style="gap: 4px">
                <Button size="small" variant="text" @click="claim(row.item)">认领</Button>
                <Button size="small" variant="text" @click="submitTarget = row.item; submitOpen = true">提交产出</Button>
                <Popconfirm v-if="row.overdue" content="转派会把任务交给 Agent 继续执行；人类成员的观察记录保留（不丢协作上下文）。" theme="warning" @confirm="transfer(row.item)">
                  <Button size="small" variant="text" theme="danger">转派</Button>
                </Popconfirm>
              </div>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">团队报告（阶段汇报 + 完成报告）</div>
          <div class="oc-grid oc-grid--2">
            <div>
              <div class="oc-flex" style="gap: 6px">
                <OcIcon name="file" size="13px" />
                <b style="font-size: 12px">阶段汇报</b>
                <Tag size="small" variant="outline">每 N 分钟自动产出</Tag>
              </div>
              <InfoGrid :columns="1" :items="[
                { key: 'p', label: '进度', value: `${Math.round(team.report.progress * 100)}%` },
                { key: 'c', label: '成本', value: `$${team.report.cost} / $${team.budget.total}` },
                { key: 'e', label: '证据', value: `${team.report.evidence} 条` },
                { key: 'o', label: '未决项', value: team.report.openItems.join('；') },
              ]" />
            </div>
            <div>
              <div class="oc-flex" style="gap: 6px">
                <OcIcon name="task-checked" size="13px" />
                <b style="font-size: 12px">完成报告（模板）</b>
                <Tag size="small" variant="outline">团队结束时产出</Tag>
              </div>
              <JsonBlock :value="{
                team: team.name, goal: team.goal, progress: team.report.progress,
                evidence: team.report.evidence, cost: team.report.cost,
                openItems: team.report.openItems, publishedAt: team.report.publishedAt,
              }" label="完成报告 JSON" />
              <!-- 本页生成的完成报告：落成对象并逐份渲染，供核对与导出 -->
              <div v-if="completionReports.length" class="oc-card" style="margin-top: 8px">
                <div class="oc-card__title">已生成的完成报告（{{ completionReports.length }} 份）</div>
                <div v-for="rep in completionReports" :key="rep.id" style="margin-bottom: 6px">
                  <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
                    <Tag size="small" variant="outline" class="oc-mono">{{ rep.id }}</Tag>
                    <span style="font-size: 12px">进度 {{ Math.round(rep.progress * 100) }}% ｜ 证据 {{ rep.evidence }} 条 ｜ 成本 ${{ rep.cost }}</span>
                    <span class="oc-muted" style="font-size: 11px">{{ rep.by }} · {{ new Date(rep.at).toLocaleString('zh-CN') }}</span>
                  </div>
                  <div class="oc-secondary" style="font-size: 12px">未决项：{{ rep.openItems.join('；') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="oc-flex" style="gap: 8px">
          <CliHint command="oc team human claim T-5a31 --as human:chenlm" />
          <CopyableId id="trace-19ce4b88" label="复制 traceId" />
        </div>
      </div>

      <Dialog v-model:visible="submitOpen" header="提交人类产出" width="540px" :footer="false">
        <div class="oc-stack">
          <div class="oc-muted" style="font-size: 12px">任务：{{ submitTarget?.shortId }} {{ submitTarget?.title }}</div>
          <Textarea v-model="submitNote" :autosize="{ minRows: 3 }" placeholder="产出说明（必填）：做了什么、证据在哪、如何验证" />
          <div class="oc-secondary" style="font-size: 12px">
            提交后任务进入「待验收」，产出走与 Agent 同构的事件与审计；验收不通过会带反馈退回进行中。
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Button size="small" theme="primary" @click="submit">提交产出</Button>
            <Button size="small" variant="outline" @click="submitOpen = false">取消</Button>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
