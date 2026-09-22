<script setup lang="ts">
/**
 * 组织与成员（N-01）：三级组织模型（组织/团队/项目 + 服务账号）+ 成员管理 + 策略徽标。
 * 溯源：卷 24 §4.1
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import { downloadCsv } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { TableRowData } from 'tdesign-vue-next';
import type { Member, MemberRole, OrgNode } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 组织节点与成员用 ref 渲染：邀请后成员表、节点成员数与统计卡即时刷新（同时写回领域数据） */
const orgRows = ref(d.orgs);
const memberRows = ref(d.members);
const selected = ref<OrgNode>(orgRows.value[0]);
const inviteOpen = ref(false);
const inviteForm = ref({ name: '', email: '', role: 'Developer' as MemberRole, teamId: orgRows.value.find((o) => o.kind === 'team')!.id });
const teamOptions = computed(() => orgRows.value.filter((o) => o.kind === 'team').map((o) => ({ label: o.name, value: o.id })));
const inviteRoleOptions = ['Admin', 'Developer', 'Reviewer', 'Auditor', 'Viewer'].map((r) => ({ label: r, value: r }));
const roleTheme: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  Owner: 'danger', Admin: 'warning', Developer: 'primary', Reviewer: 'success', Auditor: 'primary', Viewer: 'default', ServiceAccount: 'default',
};
const orgCols = [
  { colKey: 'name', title: '组织 / 团队 / 项目', width: 220 },
  { colKey: 'kind', title: '类型', width: 110 },
  { colKey: 'memberCount', title: '成员数', width: 90 },
  { colKey: 'budgetUsdMonth', title: '月度预算(USD)', width: 140 },
  { colKey: 'policyBadges', title: '策略徽标' },
];
const memberCols = [
  { colKey: 'name', title: '成员', width: 150 },
  { colKey: 'role', title: '角色', width: 130 },
  { colKey: 'state', title: '状态', width: 120 },
  { colKey: 'mfa', title: 'MFA', width: 90 },
  { colKey: 'ssoBound', title: 'SSO', width: 90 },
  { colKey: 'lastActiveAt', title: '最近活跃' },
];
const tree = computed(() => {
  const rows: OrgNode[] = [];
  const push = (id: string | null) => orgRows.value.filter((o) => o.parentId === id).forEach((o) => { rows.push(o); push(o.id); });
  push(null);
  return rows;
});
const members = computed(() => memberRows.value.filter((m) => m.teamId === selected.value.id || selected.value.kind === 'org'));
/** 表格行点击：TDesign 传入 RowEventContext，仅取 row 并收窄为组织节点 */
function onRowClick(ctx: { row: TableRowData }) {
  selected.value = ctx.row as unknown as OrgNode;
}

/** 导出成员表：当前节点可见成员（角色 / 状态 / MFA / SSO / 最近活跃） */
function exportMembers() {
  const rows: (string | number)[][] = [
    ['成员', '邮箱', '角色', '状态', 'MFA', 'SSO', '最近活跃', 'SCIM ID'],
    ...members.value.map((m) => [m.name, m.email, m.role, m.state, m.mfa ? '已启用' : '缺失', m.ssoBound ? '已绑定' : '本地账号', new Date(m.lastActiveAt).toLocaleString('zh-CN'), m.scimId] as (string | number)[]),
  ];
  const file = downloadCsv(rows, `members-${selected.value.id}-${Date.now()}.csv`);
  MessagePlugin.success('已生成 ' + file);
}

/** 邀请成员：校验姓名与邮箱后新增（未激活不占席位），团队节点成员数同步 +1 */
function submitInvite() {
  const f = inviteForm.value;
  if (!f.name.trim()) { MessagePlugin.error('请填写成员姓名'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { MessagePlugin.error('请填写合法邮箱（邀请链接将发送至该邮箱）'); return; }
  if (memberRows.value.some((m) => m.email === f.email.trim())) { MessagePlugin.error(`邮箱 ${f.email.trim()} 已在组织内，无需重复邀请`); return; }
  const team = orgRows.value.find((o) => o.id === f.teamId);
  if (!team) { MessagePlugin.error('请选择要加入的团队'); return; }
  const m: Member = {
    id: `u-${1001 + memberRows.value.length}`,
    name: f.name.trim(),
    email: f.email.trim(),
    role: f.role,
    teamId: team.id,
    mfa: false,
    ssoBound: false,
    scimId: '待绑定',
    lastActiveAt: new Date().toISOString(),
    state: 'INVITED',
    seatActive: false,
    note: `邀请已发送（${f.role}）：接受后激活席位，未激活不占席位`,
  };
  memberRows.value.unshift(m);
  // 节点成员数同步 +1，避免层级树与成员表口径不一致
  team.memberCount += 1;
  MessagePlugin.success(`已邀请 ${m.name}（${m.email}）以 ${m.role} 加入「${team.name}」：邀请 7 天内有效，接受后激活席位（未激活不占席位）`);
  inviteForm.value = { name: '', email: '', role: 'Developer', teamId: orgRows.value.find((o) => o.kind === 'team')!.id };
  inviteOpen.value = false;
}

const kindLabel: Record<OrgNode['kind'], string> = { org: '组织', team: '团队', user: '用户', project: '项目', serviceAccount: '服务账号' };
const selectedInfo = computed(() => [
  { key: 'id', label: '标识', value: selected.value.id, mono: true, copyable: true },
  { key: 'kind', label: '层级类型', value: kindLabel[selected.value.kind] },
  { key: 'budget', label: '月度预算', value: `$${selected.value.budgetUsdMonth.toLocaleString('zh-CN')}`, hint: '继承自上级，可收窄不可突破' },
  { key: 'members', label: '成员数', value: selected.value.memberCount },
  { key: 'policy', label: '策略徽标', value: selected.value.policyBadges.join(' / ') },
  { key: 'note', label: '说明', value: selected.value.note ?? '—', span: 2 as const },
]);

onMounted(() => {
  setTimeout(() => {
    state.value = tree.value.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="组织与成员"
      desc="组织（计费与合规单元）→ 团队（协作单元）→ 项目（代码与工作边界）；用户与服务账号属组织，可属多个团队。"
      volume="卷 24"
      manifest="N-01"
      cli="oc org tree --with-budget --json"
      :status="[{ label: '组织策略不可被下级覆盖', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportMembers">导出成员表</Button>
        <Button size="small" theme="primary" @click="inviteOpen = true">邀请成员</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="组织树为空"
      empty-desc="尚未创建任何团队或项目；组织策略与配额需先有团队才能继承。"
      empty-action="创建第一个团队"
      example-task="从「首次运行向导」导入 AGENTS.md 并绑定当前目录为工作区"
      what="组织树加载失败"
      why="查询缺少租户条件被持久层拦截（跨租户红线：无租户条件的查询即失败）"
      how="可重试；若反复失败请检查会话租户上下文是否丢失"
      trace-id="trace-org-41c8e0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="组织" :value="1" unit="个" icon="sitemap" hint="计费与合规单元" />
        <StatCard label="团队" :value="orgRows.filter((o) => o.kind === 'team').length" unit="个" :target="4" target-kind="min" />
        <StatCard label="项目" :value="orgRows.filter((o) => o.kind === 'project').length" unit="个" :target="5" target-kind="min" />
        <StatCard label="服务账号" :value="orgRows.filter((o) => o.kind === 'serviceAccount').length" unit="个" hint="权限等同受限写，无审批权" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">层级树（点击选择）</div>
          <div class="oc-stack" style="gap: 2px">
            <button
              v-for="n in tree"
              :key="n.id"
              type="button"
              class="oc-org-row"
              :style="{ paddingLeft: `${8 + (n.parentId ? (n.kind === 'project' ? 36 : 18) : 0)}px` }"
              :class="{ 'oc-org-row--on': n.id === selected.id }"
              @click="selected = n"
            >
              <span class="oc-flex" style="gap: 6px; min-width: 0">
                <span>{{ n.kind === 'org' ? '◉' : n.kind === 'team' ? '▸' : n.kind === 'project' ? '·' : '◆' }}</span>
                <b class="oc-truncate" style="font-size: 12px">{{ n.name }}</b>
                <Tag size="small" variant="outline">{{ kindLabel[n.kind] }}</Tag>
              </span>
              <span class="oc-muted" style="font-size: 11px">{{ n.memberCount }} 人 · ${{ n.budgetUsdMonth }}</span>
            </button>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">节点详情</div>
          <InfoGrid :items="selectedInfo" :columns="2" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tooltip v-for="b in selected.policyBadges" :key="b" content="策略由上级继承；下级仅可收窄，不可突破（拒绝优先）">
              <Tag size="small" theme="warning" variant="light-outline">{{ b }}</Tag>
            </Tooltip>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            红线：任何查询不得缺少租户条件；跨租户数据移动必须走显式导出/导入并留审计。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">节点清单（扁平视图）</div>
        <Table :data="tree" :columns="orgCols" row-key="id" size="small" @row-click="onRowClick">
          <template #cell="{ row }">
            <template v-if="'policyBadges' in row">
              <span class="oc-flex oc-flex--wrap" style="gap: 4px">
                <Tag v-for="b in (row.policyBadges as string[])" :key="b" size="small" variant="outline">{{ b }}</Tag>
              </span>
            </template>
            <span v-else>{{ row }}</span>
          </template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">成员（{{ selected.name }}）· {{ members.length }} 人</div>
          <CopyableId id="trace-org-members-08a1" label="复制 traceId" />
        </div>
        <Table :data="members" :columns="memberCols" row-key="id" size="small">
          <template #cell="{ row }">
            <template v-if="'role' in row">
              <Tag size="small" :theme="roleTheme[(row as Member).role]" variant="light-outline">{{ (row as Member).role }}</Tag>
            </template>
            <template v-else-if="'mfa' in row">
              <Tag size="small" :theme="(row as Member).mfa ? 'success' : 'danger'" variant="light-outline">{{ (row as Member).mfa ? '已启用' : '缺失' }}</Tag>
            </template>
            <template v-else-if="'ssoBound' in row">
              <Tag size="small" :theme="(row as Member).ssoBound ? 'success' : 'warning'" variant="light-outline">{{ (row as Member).ssoBound ? '已绑定' : '本地账号' }}</Tag>
            </template>
            <template v-else>
              <span>{{ new Date(String((row as Member).lastActiveAt)).toLocaleString('zh-CN') }}</span>
            </template>
          </template>
        </Table>
        <div class="oc-state__hint" style="margin-top: 6px">
          负样本：{{ d.members.find((m) => m.state === 'SUSPENDED')?.note }}
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="inviteOpen" header="邀请成员" width="560px" :confirm-btn="{ content: '发送邀请', theme: 'primary' }" cancel-btn="取消" @confirm="submitInvite">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <Input v-model="inviteForm.name" size="small" style="width: 190px" placeholder="姓名（必填），如 温如故" />
          <Input v-model="inviteForm.email" size="small" style="width: 260px" placeholder="邮箱（必填），如 user@yunshu.example.com" />
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <Select v-model="inviteForm.role" size="small" style="width: 170px" aria-label="角色" :options="inviteRoleOptions" />
          <Select v-model="inviteForm.teamId" size="small" style="width: 220px" aria-label="加入团队" :options="teamOptions" />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          角色继承组织策略（拒绝优先，强制项不可放宽）；邀请 7 天内有效，接受并绑定 SSO 后激活席位。
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.oc-org-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
}

.oc-org-row:hover {
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
}

.oc-org-row--on {
  background: var(--td-brand-color-light, #ecf2fe);
}
</style>
