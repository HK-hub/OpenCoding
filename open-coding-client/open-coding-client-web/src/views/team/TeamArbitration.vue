<script setup lang="ts">
/**
 * 仲裁记录与团队权限审计（R-05 + R-09）：争议点/观点/裁决/理由/影响 + 权限上限链（成员 ⊆ 团队 ⊆ 会话）+ 责任链 + 团队级审计。
 * 溯源：卷 13 D-TEAM-5 冲突仲裁 / D-TEAM-10 权限上限单调 + 责任链 + 团队审计。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { Arbitration } from '@/mock/data/task';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref('TEAM-checkout-01');
const detail = ref<Arbitration | null>(null);
/** 本页发起、尚无裁决的仲裁请求（登记在仲裁记录列表顶部，等待双方陈述） */
const requestedRulings = ref<{ id: string; dispute: string; team: string; at: string }[]>([]);
/** 已发起复核的既有仲裁记录：仲裁 id → 发起时间 */
const reviewRequests = ref<Record<string, string>>({});

const team = computed(() => taskData.teams.find((t) => t.teamId === selected.value) ?? taskData.teams[0]);
const arbitrations = computed(() => taskData.teams.flatMap((t) => t.arbitrations.map((a) => ({ ...a, team: t.name }))));

/** 权限上限链：成员 ⊆ 团队 ⊆ 会话（单调，禁止放大） */
const chain = computed(() => [
  { level: '会话上限', items: ['file.read', 'file.write:src/**', 'command.test', 'git.commit', 'git.push:oc-branch'], note: '会话授权上限（不可被团队放大）' },
  { level: '团队上限', items: ['file.read', 'file.write:src/**', 'command.test', 'git.commit'], note: '团队上限 ⊆ 会话上限' },
  { level: '成员实际', items: ['file.read', 'file.write:src/payment/**', 'command.test'], note: '成员权限 ⊆ 团队上限（写范围进一步收窄）' },
]);

/** 团队审计：谁在何时以何权限做了什么 */
const auditRows = computed(() => [
  { id: 'AUD-01', at: team.value.messages[0]?.at ?? new Date().toISOString(), actor: '主管 Agent', action: '分派任务 T-0e15（含写范围声明）', perm: 'task.assign', risk: 'R1', result: '成功' },
  { id: 'AUD-02', at: team.value.messages[1]?.at ?? new Date().toISOString(), actor: '实现者 · 落霞', action: 'git.commit（oc/T-7f3a-idempotent-receipt）', perm: 'git.commit', risk: 'R1', result: '成功' },
  { id: 'AUD-03', at: team.value.messages[2]?.at ?? new Date().toISOString(), actor: '审查者 · 秋水', action: '输出 verdict（通过）', perm: 'review.verdict', risk: 'R0', result: '成功' },
  { id: 'AUD-04', at: team.value.report.publishedAt, actor: '主管 Agent', action: '发布阶段汇报（含成本与未决项）', perm: 'team.report', risk: 'R0', result: '成功' },
  { id: 'AUD-05', at: new Date().toISOString(), actor: '观测（预算守卫）', action: '发送 budget_alert（消耗 70.5%）', perm: 'budget.alert', risk: 'R0', result: '成功' },
]);

const auditColumns = [
  { colKey: 'at', title: '时间', width: 160 },
  { colKey: 'actor', title: '主体', width: 170 },
  { colKey: 'action', title: '动作' },
  { colKey: 'perm', title: '权限点', width: 150 },
  { colKey: 'risk', title: '风险级', width: 100 },
  { colKey: 'result', title: '结果', width: 90 },
];

/** 导出团队审计：仲裁记录、权限上限链与审计条目与页面同源，JSON 供离线核验责任链 */
function exportAudit() {
  const file = downloadJson({
    teamId: selected.value,
    teamName: team.value.name,
    arbitrations: arbitrations.value,
    permissionChain: chain.value,
    auditEntries: auditRows.value,
  }, `oc-team-audit-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`团队审计已导出：${file}`);
}

/** 请求主管裁决：把请求登记为「已请求 · 待双方陈述」的仲裁记录，而非只弹提示 */
function requestRuling() {
  const seq = requestedRulings.value.length + 1;
  const record = {
    id: `ARB-REQ-${String(seq).padStart(2, '0')}`,
    dispute: team.value.board.blockers[0]?.reason ?? `待裁决：${team.value.goal}`,
    team: team.value.name,
    at: new Date().toISOString(),
  };
  requestedRulings.value.unshift(record);
  MessagePlugin.success(`已请求主管裁决（${record.id}）：已在仲裁记录列表登记，等待双方陈述后生成裁决`);
}

/** 发起仲裁复核：在对应仲裁记录上登记复核时间与人数要求（结论未出前不称已复核） */
function requestReview() {
  if (!detail.value) return;
  const id = detail.value.id;
  if (reviewRequests.value[id]) {
    MessagePlugin.warning(`${id} 复核已发起（${new Date(reviewRequests.value[id]).toLocaleString('zh-CN')}），等待评审人处理`);
    return;
  }
  reviewRequests.value[id] = new Date().toISOString();
  MessagePlugin.success(`已发起 ${id} 仲裁复核：需 2 名以上评审人参与，复核结论将回写该记录`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = arbitrations.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="仲裁与权限审计" volume="卷 13" manifest="R-05 / R-09" cli="oc team arbitration TEAM-checkout-01 --audit"
      desc="仲裁记录（争议点/观点/裁决/理由/影响）与团队治理：权限上限单调链（成员 ⊆ 团队 ⊆ 会话）、责任链（任务→成员→人类委托者）、团队级审计全覆盖。"
      :status="[{ label: '权限不可放大', theme: 'warning' }, { label: `${arbitrations.length} 条仲裁`, theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportAudit">导出审计</Button>
        <Button size="small" variant="outline" @click="requestRuling">请求裁决</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">团队：</span>
        <Select v-model="selected" size="small" style="width: 300px" :options="taskData.teams.map((t) => ({ label: `${t.name}（${t.arbitrations.length} 条仲裁）`, value: t.teamId }))" />
        <Tag size="small" variant="outline">责任链：任务 → 成员 → 人类委托者</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="仲裁记录" :value="arbitrations.length + requestedRulings.length" unit="条" icon="secured" hint="含本页待裁决请求" />
      <StatCard label="升级人类" :value="arbitrations.filter((a) => a.ruling.includes('升级人类')).length" unit="条" icon="user" />
      <StatCard label="权限链层级" :value="chain.length" unit="层" icon="lock" hint="成员 ⊆ 团队 ⊆ 会话（单调）" />
      <StatCard label="审计条目" :value="auditRows.length" unit="条" icon="file" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有仲裁记录" empty-desc="团队内未发生语义冲突；设计决策一致的团队无需仲裁。" empty-action="查看团队黑板"
      example-task="就「共享 worktree 并行改写」发起裁决"
      what="仲裁记录加载失败" why="裁决档案读取被权限拦截（当前身份无 team.audit 权限）"
      how="可重试；或申请 team.audit 权限后查看" trace-id="trace-52d0e9f3"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已跳转团队黑板')"
    >
      <div class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">仲裁记录（争议 → 观点 → 裁决 → 理由 → 影响）</div>
          <!-- 本页发起的裁决请求：先登记状态，裁决生成前不伪装为已完成 -->
          <div v-for="q in requestedRulings" :key="q.id" class="oc-card" style="margin-bottom: 8px; border-color: var(--oc-sev-warn)">
            <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <Tag size="small" variant="outline" class="oc-mono">{{ q.id }}</Tag>
              <b style="font-size: 13px">{{ q.dispute }}</b>
              <Tag size="small" variant="outline">{{ q.team }}</Tag>
              <Tag size="small" theme="warning" variant="light-outline">已请求 · 待双方陈述</Tag>
              <span class="oc-muted" style="font-size: 11px">{{ new Date(q.at).toLocaleString('zh-CN') }}</span>
            </div>
          </div>
          <div v-for="a in arbitrations" :key="a.id" class="oc-card" style="margin-bottom: 8px">
            <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <Tag size="small" variant="outline" class="oc-mono">{{ a.id }}</Tag>
              <b style="font-size: 13px">{{ a.dispute }}</b>
              <Tag size="small" variant="outline">{{ a.team }}</Tag>
              <Tag v-if="reviewRequests[a.id]" size="small" theme="warning" variant="light-outline">复核已发起 · {{ new Date(reviewRequests[a.id]).toLocaleTimeString('zh-CN') }}</Tag>
              <span class="oc-muted" style="font-size: 11px">{{ new Date(a.at).toLocaleString('zh-CN') }}</span>
            </div>
            <div class="oc-flex" style="gap: 6px; margin-top: 6px">
              <OcIcon name="secured" size="13px" />
              <span style="font-size: 12px">裁决：{{ a.ruling }}</span>
            </div>
            <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">理由：{{ a.reason }}</div>
            <div class="oc-secondary" style="font-size: 12px">影响：{{ a.impact }}</div>
            <Button size="small" variant="outline" style="margin-top: 6px" @click="detail = a">查看双方观点</Button>
          </div>
          <div v-if="!arbitrations.length" class="oc-muted" style="font-size: 12px">无仲裁记录。</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">权限上限链（单调性有测试：成员无法获得团队未授予的权限）</div>
          <div v-for="c in chain" :key="c.level" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 8px; align-items: center">
            <Tag size="small" theme="primary" variant="light-outline">{{ c.level }}</Tag>
            <Tag v-for="i in c.items" :key="i" size="small" variant="outline" class="oc-mono">{{ i }}</Tag>
            <span class="oc-muted" style="font-size: 11px">{{ c.note }}</span>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <RiskBadge level="R1" />
            <RiskBadge level="R2" />
            <RiskBadge level="R3" />
            <span class="oc-muted" style="font-size: 12px">R3 外发动作仅在会话上限内且需审批；团队与成员均不能放大。</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">团队级审计（谁在何时以何权限做了什么）</div>
          <Table :data="auditRows" row-key="id" size="small" :pagination="undefined" :columns="auditColumns">
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template #perm="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.perm }}</span></template>
            <template #risk="{ row }"><RiskBadge :level="row.risk" /></template>
          </Table>
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <CliHint command="oc team audit TEAM-checkout-01 --since '-7d' --verify-hash-chain" />
            <CopyableId id="trace-52d0e9f3" label="复制 traceId" />
          </div>
        </div>
      </div>

      <Drawer :visible="!!detail" header="仲裁详情" size="520px" :footer="false" @close="detail = null">
        <div v-if="detail" class="oc-stack">
          <div class="oc-card">
            <InfoGrid :columns="1" :items="[
              { key: 'dispute', label: '争议点', value: detail.dispute },
              { key: 'ruling', label: '裁决', value: detail.ruling },
              { key: 'reason', label: '理由', value: detail.reason },
              { key: 'impact', label: '影响', value: detail.impact },
              { key: 'at', label: '裁决时间', value: new Date(detail.at).toLocaleString('zh-CN') },
            ]" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">双方观点</div>
            <div v-for="v in detail.views" :key="v.by" style="margin-bottom: 8px">
              <b style="font-size: 12px">{{ v.by }}</b>
              <div class="oc-secondary" style="font-size: 12px">{{ v.view }}</div>
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px; align-items: center">
            <Button size="small" variant="outline" @click="requestReview">发起复核</Button>
            <Tag v-if="reviewRequests[detail.id]" size="small" theme="warning" variant="light-outline">已发起复核 · 等待 ≥2 名评审人</Tag>
            <CliHint :command="`oc team arbitration show ${detail.id} --explain`" />
          </div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
