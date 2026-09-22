<script setup lang="ts">
/**
 * 团队成员（R-02）：成员表（角色/类型/工作区/预算配额与已用/当前任务/状态）+ 暂停 / 移除。
 * 溯源：卷 13 §4.1 团队领域模型（Member 关键字段）/ D-TEAM-6 预算与配额。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { Button, Dialog, Drawer, MessagePlugin, Popconfirm, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
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
import type { TeamMember } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref('TEAM-checkout-01');
const detail = ref<TeamMember | null>(null);

const team = computed(() => taskData.teams.find((t) => t.teamId === selected.value) ?? taskData.teams[0]);
/** 成员清单用 ref 包裹响应式：装配/配额重算/暂停后表格与统计卡即时刷新（写回同一份领域数据） */
const members = ref<TeamMember[]>(team.value.members);
// 切换团队时重新指向该团队的成员清单
watch(team, (t) => { members.value = t.members; });

const stats = computed(() => ({
  total: members.value.length,
  agents: members.value.filter((m) => m.type === 'agent').length,
  humans: members.value.filter((m) => m.type === 'human').length,
  used: Number(members.value.reduce((a, b) => a + b.used, 0).toFixed(2)),
  quota: members.value.reduce((a, b) => a + b.quota, 0),
}));

const columns = [
  { colKey: 'name', title: '成员', width: 190 },
  { colKey: 'roleRef', title: '角色', width: 170 },
  { colKey: 'type', title: '类型', width: 90 },
  { colKey: 'worktreeRef', title: '工作区（worktree）', width: 190 },
  { colKey: 'quota', title: '预算配额 / 已用', width: 210 },
  { colKey: 'currentTaskId', title: '当前任务', width: 160 },
  { colKey: 'state', title: '状态', width: 110 },
  { colKey: 'op', title: '操作', width: 160 },
];

function taskTitle(id: string | null): string {
  if (!id) return '—';
  return taskData.workItems.find((i) => i.itemId === id)?.shortId ?? id;
}

/** 重新分配配额时的团队机动预留比例（10%）：避免全员配额吃满导致无余量 */
const QUOTA_RESERVE_RATIO = 0.1;

/** 角色库（就地装配用）：本工程无独立角色库路由，用 Dialog 就地展示可选角色与建议配额 */
const roleLibrary = [
  { role: '实现者', desc: '受控写：按写范围声明提交改动', quota: 8 },
  { role: '测试者', desc: '执行用例与挂载证据（可只读）', quota: 6 },
  { role: '审查者', desc: '只读 + verdict，把关质量门禁', quota: 6 },
  { role: '文档者', desc: '维护知识与变更记录', quota: 4 },
  { role: '观测者', desc: '预算与风险观测（只读）', quota: 4 },
];
const roleLibOpen = ref(false);
const pickedRole = ref(roleLibrary[0].role);

/** 打开角色库：就地弹出装配对话框，避免「已打开」成为无痕提示 */
function openRoleLibrary() {
  roleLibOpen.value = true;
  MessagePlugin.info(`已打开角色库：${roleLibrary.length} 个可选角色，选中后可装配到「${team.value.name}」`);
}

/** 从角色库装配成员：配额从团队额度扣减，成员表与配额合计即时更新 */
function assembleMember() {
  const role = roleLibrary.find((r) => r.role === pickedRole.value) ?? roleLibrary[0];
  const restPool = Number((team.value.budget.total - stats.value.quota).toFixed(2));
  if (restPool < role.quota) {
    MessagePlugin.warning(`团队配额余量 $${restPool.toFixed(2)} 不足以装配「${role.role}」（需 $${role.quota}）；可先移除成员或重新分配配额`);
    return;
  }

  const seq = members.value.length + 1;
  // 就地追加（同一份领域数据）：经响应式代理写入，表格与统计卡即时刷新
  members.value.push({
    memberId: `${team.value.teamId}-M${seq}`,
    name: role.role,
    roleRef: role.role,
    type: 'agent',
    worktreeRef: `${team.value.teamId.toLowerCase()}-m${seq}`,
    quota: role.quota,
    used: 0,
    currentTaskId: null,
    state: 'idle',
  });
  roleLibOpen.value = false;
  MessagePlugin.success(`已从角色库装配「${role.role}」：配额 $${role.quota} 已占用，成员表与配额合计已更新`);
}

/** 重新分配配额：按角色权重与当前负载重算，结果直接落到成员行与统计卡 */
function reallocateQuota() {
  const list = members.value;
  if (!list.length) {
    MessagePlugin.warning('团队没有成员，无法重新分配配额');
    return;
  }

  // 可分配额度 = 团队预算总额 − 机动预留；成员按「已用 + 权重份额」分配，避免刚分配即超限
  const total = Number((team.value.budget.total * (1 - QUOTA_RESERVE_RATIO)).toFixed(2));
  const pool = Number(Math.max(total - list.reduce((a, b) => a + b.used, 0), 0).toFixed(2));
  const weightOf = (m: TeamMember) => (m.memberId === team.value.leadMemberId ? 2 : m.roleRef.includes('审查者') ? 1.5 : 1);
  const weightSum = list.reduce((a, b) => a + weightOf(b), 0);
  let assigned = 0;
  list.forEach((m, idx) => {
    // 最后一名成员吸收四舍五入尾差，保证配额合计与可分配额度一致
    const share = idx === list.length - 1
      ? Number((total - assigned).toFixed(2))
      : Number((m.used + (pool * weightOf(m)) / weightSum).toFixed(2));
    m.quota = Math.max(share, m.used);
    assigned = Number((assigned + m.quota).toFixed(2));
  });
  MessagePlugin.success(`已重新分配配额（合计 $${assigned.toFixed(2)}，预留 $${(team.value.budget.total - assigned).toFixed(2)} 团队机动）：${list.map((m) => `${m.name.split('·')[0]} $${m.quota}`).join('、')}`);
}

function pause(m: TeamMember) {
  m.state = m.state === 'idle' ? 'idle' : 'blocked';
  MessagePlugin.warning(`${m.name} 已暂停：其任务在安全点停止并落检查点，配额暂不回收（保留恢复能力）`);
}

function remove(m: TeamMember) {
  // 就地删除（同一份领域数据）：保住响应式代理，成员表与统计卡即时刷新
  const idx = members.value.findIndex((x) => x.memberId === m.memberId);
  if (idx >= 0) members.value.splice(idx, 1);
  MessagePlugin.success(`${m.name} 已移除：剩余配额 $${m.quota - m.used} 回收至团队池；其任务转回任务池供认领`);
  detail.value = null;
}

onMounted(() => {
  window.setTimeout(() => { state.value = members.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="团队成员" volume="卷 13" manifest="R-02" cli="oc team members TEAM-checkout-01 --show-quota"
      desc="成员配额与状态可见：暂停在安全点生效且不回收配额（保留恢复能力），移除会回收剩余配额并把任务转回任务池（供他人认领）。"
      :status="[{ label: `Agent ${stats.agents} / 人类 ${stats.humans}`, theme: 'primary' }, { label: '权限上限单调', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="openRoleLibrary">添加成员</Button>
        <Button size="small" variant="outline" @click="reallocateQuota">重新分配配额</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">团队：</span>
        <Select v-model="selected" size="small" style="width: 300px" :options="taskData.teams.map((t) => ({ label: `${t.name}（${t.members.length} 名）`, value: t.teamId }))" />
        <Tag size="small" variant="outline">配额合计 ${{ stats.quota.toFixed(2) }} ｜ 已用 ${{ stats.used }}</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="成员总数" :value="stats.total" unit="名" icon="user" />
      <StatCard label="Agent" :value="stats.agents" unit="名" icon="robot" />
      <StatCard label="人类成员" :value="stats.humans" unit="名" icon="user-circle" hint="人类任务与 Agent 任务同构（同事件与审计）" />
      <StatCard label="配额已用" :value="stats.used" format="cost" icon="discount" :target="stats.quota" target-kind="max" />
    </div>

    <StateShell
      :state="state"
      empty-title="团队没有成员" empty-desc="团队编制为空；请从角色库装配成员或从模板组建。" empty-action="从角色库装配"
      example-task="装配「实现者 / 测试者 / 审查者」三名成员"
      what="成员列表加载失败" why="成员工作区（worktree）引用失效，配额无法校验"
      how="可重试；或先修复 worktree 引用再刷新" trace-id="trace-bd6e3f18"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已从角色库装配 3 名成员')"
    >
      <div class="oc-card">
        <Table :data="members" row-key="memberId" size="small" :pagination="undefined" :columns="columns">
          <template #name="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <OcIcon :name="row.type === 'human' ? 'user-circle' : 'robot'" size="13px" />
              <span style="font-size: 12px">{{ row.name }}</span>
              <Tag v-if="row.memberId === team.leadMemberId" size="small" theme="primary" variant="light-outline">主管</Tag>
            </div>
            <div class="oc-muted oc-mono" style="font-size: 11px">{{ row.memberId }}</div>
          </template>
          <template #quota="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span style="font-size: 12px">${{ row.used }} / ${{ row.quota }}</span>
              <Progress :percentage="Math.round((row.used / row.quota) * 100)" size="small" style="width: 70px" :status="row.used / row.quota > 0.9 ? 'warning' : 'success'" />
            </div>
          </template>
          <template #currentTaskId="{ row }">
            <span class="oc-mono" style="font-size: 11px">{{ taskTitle(row.currentTaskId) }}</span>
          </template>
          <template #state="{ row }">
            <Tooltip :content="row.state === 'blocked' ? '阻塞：需要人工介入或等待依赖' : row.state === 'failed' ? '失败：可由主管重新分配任务' : '正常'">
              <Tag size="small" :theme="row.state === 'busy' ? 'primary' : row.state === 'completed' ? 'success' : row.state === 'blocked' ? 'danger' : row.state === 'failed' ? 'warning' : 'default'" variant="light-outline">
                {{ row.state }}
              </Tag>
            </Tooltip>
          </template>
          <template #op="{ row }">
            <div class="oc-flex" style="gap: 4px">
              <Button size="small" variant="text" @click="detail = row">详情</Button>
              <Button size="small" variant="text" @click="pause(row)">暂停</Button>
              <Popconfirm
                content="移除成员会回收其剩余配额并把任务转回任务池（供认领）；已产出证据保留在黑板。"
                theme="danger" @confirm="remove(row)"
              >
                <Button size="small" variant="text" theme="danger">移除</Button>
              </Popconfirm>
            </div>
          </template>
        </Table>
      </div>

      <Drawer :visible="!!detail" :header="detail ? `成员详情 · ${detail.name}` : ''" size="440px" :footer="false" @close="detail = null">
        <div v-if="detail" class="oc-stack">
          <div class="oc-card">
            <InfoGrid :columns="1" :items="[
              { key: 'id', label: '成员 ID', value: detail.memberId, mono: true, copyable: true },
              { key: 'role', label: '角色引用', value: detail.roleRef },
              { key: 'type', label: '类型', value: detail.type === 'agent' ? 'Agent' : '人类成员' },
              { key: 'wt', label: 'worktree', value: detail.worktreeRef, mono: true },
              { key: 'quota', label: '配额 / 已用', value: `$${detail.quota} / $${detail.used}` },
              { key: 'task', label: '当前任务', value: taskTitle(detail.currentTaskId) },
              { key: 'sla', label: 'SLA（人类）', value: detail.slaMinutes ? `${detail.slaMinutes} 分钟` : '—' },
              { key: 'claim', label: '可认领', value: detail.claimable ? '是（人类任务卡）' : '—' },
            ]" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">权限上限（责任链）</div>
            <div class="oc-secondary" style="font-size: 12px">
              成员权限 ⊆ 团队上限 ⊆ 会话上限；成员不能获得团队未授予的权限（单调性有测试）。
              责任链：任务 → 成员 → 人类委托者。
            </div>
            <div class="oc-flex" style="gap: 6px; margin-top: 6px">
              <RiskBadge level="R1" />
              <Tag size="small" variant="outline">R1 受控写</Tag>
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <CliHint :command="`oc team member pause ${detail.memberId} --at-safe-point`" />
            <CopyableId id="trace-bd6e3f18" label="复制 traceId" />
          </div>
        </div>
      </Drawer>

      <Dialog v-model:visible="roleLibOpen" header="角色库（装配成员）" width="560px" :footer="false">
        <div class="oc-stack">
          <div class="oc-muted" style="font-size: 12px">
            团队额度余量 ${{ (team.budget.total - stats.quota).toFixed(2) }}（团队额度 ${{ team.budget.total }} − 成员配额合计 ${{ stats.quota.toFixed(2) }}）
          </div>
          <Select v-model="pickedRole" size="small" :options="roleLibrary.map((r) => ({ label: `${r.role}（建议配额 $${r.quota}）`, value: r.role }))" />
          <div v-for="r in roleLibrary" :key="r.role" class="oc-secondary" style="font-size: 12px">
            {{ r.role }}：{{ r.desc }}（建议配额 ${{ r.quota }}）
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Button size="small" theme="primary" @click="assembleMember">装配到团队</Button>
            <Button size="small" variant="outline" @click="roleLibOpen = false">取消</Button>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
