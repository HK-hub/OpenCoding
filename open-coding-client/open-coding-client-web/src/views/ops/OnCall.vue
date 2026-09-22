<script setup lang="ts">
/**
 * 值班与升级（G5-06）：周轮次（主班 / 副班）、四级升级路径（15 / 30 / 60 分钟）、
 * 交接单（未闭环告警 / 进行中事件 / 待观察变更）、值班五类直接操作权限与「发起升级」。
 * 溯源：卷 32 / BUILD-MANIFEST G5-06
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 本周值班（取最新一周）；交接单与升级链均以本周为准 */
const current = computed(() => d.onCall[0]);
const escalateOpen = ref(false);
const escalations = ref<{ at: string; level: number; role: string; reason: string }[]>([]);
const form = reactive({ level: 1, reason: '' });
const columns = [
  { colKey: 'week', title: '周次', width: 160 }, { colKey: 'primary', title: '主班', width: 220 },
  { colKey: 'secondary', title: '副班', width: 220 }, { colKey: 'handover', title: '交接摘要' },
];
const permColumns = [
  { colKey: 'name', title: '直接操作权限', width: 120 }, { colKey: 'desc', title: '说明', width: 300 },
  { colKey: 'blast', title: '影响面' }, { colKey: 'reversible', title: '可逆性', width: 150 },
];

/** 值班五类直接操作权限：值班可即时执行，但必须留痕并可回退 */
const PERMISSIONS = [
  { name: '回滚', desc: '回滚到上一个稳定版本（≤2 分钟，含健康检查）', blast: '全部租户的本次发布影响面', reversible: '可再次升级（保留前 2 个版本）' },
  { name: '开关', desc: '关闭非关键能力开关（联邦 / 自治 / 增量索引等）', blast: '被关闭能力的相关会话降级可用', reversible: '可即时恢复，需记录理由' },
  { name: '限流', desc: '对高成本调用限流（工具外发 / 批量嵌入）', blast: '超限请求排队或按策略拒绝', reversible: '可即时放宽，阈值变更留痕' },
  { name: '冻结', desc: '冻结租户 / 会话写操作（安全事件按 SEV 分级）', blast: '冻结对象仅剩只读与导出', reversible: '解冻需安全负责人复核' },
  { name: '扩容', desc: '触发存储 / 消费者滚动扩容', blast: '扩容期间 IO 抖动，非关键任务让路', reversible: '不可缩容至低于水位下限' },
];

/** 四级升级路径：值班 → 领域负责人 15 分钟 → 架构 / 安全负责人 30 分钟 → 管理层 1 小时（P0 专属） */
const path = computed(() => [
  { level: 0, after: '立即', role: '值班（主班）', name: current.value.primary.name, note: '先确认影响面并执行 Runbook 前三步' },
  ...current.value.escalations.map((e) => ({
    level: e.level,
    after: e.afterMinutes >= 60 ? `${e.afterMinutes / 60} 小时` : `${e.afterMinutes} 分钟`,
    role: e.role,
    name: e.name,
    note: e.level === 2 ? '架构负责人；同时并行通知安全负责人（架构 / 安全同级）' : e.level === 4 ? 'P0 专属：管理层介入并指定对外沟通口径' : '未响应自动顺延下一级',
  })),
]);

/** 提交交接单：未闭环告警与待观察变更自动带入下一周值班视图（不允许口头交接） */
function submitHandover(): void {
  MessagePlugin.success(`交接单已提交：${current.value.handover.openAlerts} 条未闭环告警与 ${current.value.handover.watchingChanges.length} 项待观察变更已带入下周`);
}

function submitEscalation(): void {
  const target = path.value.find((p) => p.level === form.level) ?? path.value[1];
  escalations.value = [{ at: new Date().toLocaleString('zh-CN'), level: form.level, role: target.role, reason: form.reason || '（未填写原因，已按默认模板记录）' }, ...escalations.value];
  escalateOpen.value = false;
  MessagePlugin.warning(`已发起升级到「${target.role} · ${target.name}」，响应时限 ${target.after}；升级不中断值班的现场处置`);
  form.reason = '';
}
onMounted(() => {
  window.setTimeout(() => {
    state.value = d.onCall.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="值班与升级"
      desc="周轮次主副班 + 四级升级路径（领域负责人 15 分钟 / 架构·安全负责人 30 分钟 / 管理层 1 小时 P0）+ 交接单与五类直接操作权限。"
      volume="卷 32"
      manifest="G5-06"
      cli="oc oncall escalate --level 2 --reason '模型端点连续失败'"
      :status="[{ label: 'P0 穿透静默时段', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="escalateOpen = true">发起升级</Button>
        <Button size="small" theme="primary" @click="submitHandover">提交交接单</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有值班排班"
      empty-desc="无排班时告警将无人认领，P0 会在 5 分钟内直接升级到管理层；请先排入主副班。"
      empty-action="生成本周排班"
      example-task="为下周排入主班（SRE）+ 副班（DBA），并同步交接单"
      what="值班信息加载失败"
      why="排班服务返回 502，端上不展示过期排班（避免误找已下班的负责人）"
      how="可重试；紧急情况请按页面下方升级路径直接呼叫领域负责人"
      trace-id="trace-oncall-4e0b91"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="本周主班" :value="current.primary.name" format="raw" icon="user" :hint="`${current.primary.role} · ${current.primary.phoneMasked}`" />
        <StatCard label="本周副班" :value="current.secondary.name" format="raw" icon="user-circle" :hint="`${current.secondary.role} · ${current.secondary.phoneMasked}`" />
        <StatCard label="未闭环告警" :value="current.handover.openAlerts" unit="条" format="raw" icon="notification" :lower-is-better="true" hint="交接单必须逐条说明状态" />
        <StatCard label="进行中事件" :value="current.handover.activeIncidents" unit="起" format="raw" icon="bug" :lower-is-better="true" hint="进行中事件需指定事故指挥" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">四级升级路径</div>
          <Timeline>
            <TimelineItem v-for="p in path" :key="p.level" :label="p.after" :dot-color="p.level === 0 ? 'var(--td-brand-color)' : p.level === 4 ? 'var(--oc-sev-error, #d54941)' : 'var(--oc-sev-warn, #e37318)'">
              <b>{{ p.role }} · {{ p.name }}</b>
              <div class="oc-muted" style="font-size: 12px">{{ p.note }}</div>
            </TimelineItem>
          </Timeline>
          <div class="oc-stack" style="font-size: 12px">
            <div v-for="e in escalations" :key="e.at" class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" theme="warning" variant="light-outline">L{{ e.level }}</Tag>
              <span>{{ e.at }} → {{ e.role }}</span>
              <span class="oc-muted oc-grow">{{ e.reason }}</span>
            </div>
            <div v-if="!escalations.length" class="oc-muted">本周尚未发起升级（值班为第一响应人，未响应才顺延升级）。</div>
          </div>
          <CliHint command="oc oncall path --week 2026-W38" label="查看升级链" />
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">交接单（{{ current.week }}）</div>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'alerts', label: '未闭环告警', value: `al-06 消费者滞后（P1，已确认未解决）｜al-15 索引重建阻塞（候选规则，Runbook 缺失已标红）`, tag: { text: `${current.handover.openAlerts} 条`, theme: 'warning' } },
                { key: 'inc', label: '进行中事件', value: current.handover.activeIncidents ? '进行中事件需指定指挥' : '无进行中事件（上一轮 SEV2 已复盘归档）', tag: { text: current.handover.activeIncidents ? '进行中' : '清零', theme: current.handover.activeIncidents ? 'danger' : 'success' } },
                { key: 'watch', label: '待观察变更', value: current.handover.watchingChanges.join('；') },
                { key: 'note', label: '交接备注', value: current.handover.notes, block: true },
                { key: 'quiet', label: '静默策略', value: current.quietPolicy },
              ]"
            />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">周轮次</div>
            <Table :data="d.onCall" :columns="columns" row-key="id" size="small">
              <template #primary="{ row }"><span>{{ row.primary.name }} · {{ row.primary.role }}</span></template>
              <template #secondary="{ row }"><span>{{ row.secondary.name }} · {{ row.secondary.role }}</span></template>
              <template #handover="{ row }">
                <span class="oc-muted">{{ row.handover.activeIncidents ? '有进行中事件' : '无进行中事件' }} / 未闭环 {{ row.handover.openAlerts }} 条</span>
              </template>
            </Table>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">值班五类直接操作权限（可即时执行，但必须留痕 + 可回退）</div>
        <Table :data="PERMISSIONS" :columns="permColumns" row-key="name" size="small">
          <template #name="{ row }"><Tag size="small" theme="primary" variant="light-outline">{{ row.name }}</Tag></template>
          <template #reversible="{ row }"><Tag size="small" theme="success" variant="outline">{{ row.reversible }}</Tag></template>
        </Table>
      </div>

      <Dialog v-model:visible="escalateOpen" header="发起升级（保留现场处置）" :footer="false" width="520px">
        <div class="oc-stack">
          <Select v-model="form.level" :options="path.filter((p) => p.level > 0).map((p) => ({ label: `L${p.level} · ${p.role}（${p.after}）`, value: p.level }))" />
          <Input v-model="form.reason" placeholder="升级原因（现象 + 已尝试动作 + 需要什么支持）" />
          <div class="oc-muted" style="font-size: 12px">
            升级不等于交接：值班仍需继续执行 Runbook，直至被升级人明确接手（接手动作会写入事件时间线）。
          </div>
          <div class="oc-flex" style="gap: 8px; justify-content: flex-end">
            <Button size="small" variant="outline" @click="escalateOpen = false">取消</Button>
            <Button size="small" theme="primary" @click="submitEscalation">确认升级</Button>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
