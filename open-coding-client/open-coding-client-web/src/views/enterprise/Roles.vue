<script setup lang="ts">
/**
 * 角色与权限（N-03）：内置 7 角色 + 自定义角色 + 资源级覆盖（追加 / 收窄）。
 * 溯源：卷 24 §4.2
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
import type { MemberRole, RoleDef } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
/** 角色清单用 ref 渲染：新建自定义角色后清单与统计卡即时刷新（同时写回领域数据） */
const roleRows = ref(d.roles);
const selectedId = ref('role-custom-01');
const selected = computed(() => roleRows.value.find((r) => r.id === selectedId.value) ?? roleRows.value[0]);
const roles: MemberRole[] = ['Owner', 'Admin', 'Developer', 'Reviewer', 'Auditor', 'Viewer', 'ServiceAccount'];
const matrixCols = computed(() => [
  { colKey: 'label', title: '权限点', width: 260 },
  { colKey: 'riskLevel', title: '风险', width: 80 },
  { colKey: 'locked', title: '组织锁定', width: 110 },
  ...roles.map((r) => ({ colKey: r, title: r, cell: `role-${r}`, width: 110 })),
]);
const createOpen = ref(false);
const createForm = ref({ name: '', desc: '', permissions: [] as string[] });
const pointOptions = d.permissionPoints.map((p) => ({ label: `${p.key}（${p.group} · ${p.riskLevel}${p.orgPolicyLocked ? ' · 组织锁定' : ''}）`, value: p.key }));

function mark(v: boolean | 'limited') {
  return v === true ? '✔' : v === 'limited' ? '受限' : '✖';
}

/** 导出角色矩阵：权限点 × 内置角色的授权快照（✔ / 受限 / ✖） */
function exportMatrix() {
  const rows: (string | number)[][] = [
    ['权限点', '说明', '风险级', '组织锁定', ...roles],
    ...d.permissionPoints.map((p) => [p.key, p.label, p.riskLevel, p.orgPolicyLocked ? '锁定' : '可覆盖', ...roles.map((r) => mark(p.matrix[r]))] as (string | number)[]),
  ];
  const file = downloadCsv(rows, `role-matrix-${Date.now()}.csv`);
  MessagePlugin.success('已生成 ' + file);
}

/** 新建自定义角色：名称必填且唯一；组织锁定权限点不可授予（强制项不可放宽） */
function submitRole() {
  const f = createForm.value;
  const name = f.name.trim();
  if (!name) { MessagePlugin.error('请填写角色名称'); return; }
  if (roleRows.value.some((r) => r.name === name)) { MessagePlugin.error(`角色名「${name}」已存在，请换一个名称`); return; }
  if (!f.permissions.length) { MessagePlugin.error('请至少选择一个授予权限点'); return; }
  const locked = d.permissionPoints.filter((p) => f.permissions.includes(p.key) && p.orgPolicyLocked).map((p) => p.key);
  if (locked.length) { MessagePlugin.error(`以下权限点为组织锁定项，不可授予自定义角色：${locked.join(' / ')}`); return; }
  const role: RoleDef = {
    id: `role-custom-${String(roleRows.value.length).padStart(2, '0')}`,
    name,
    builtin: false,
    desc: f.desc.trim() || '自定义角色：仅追加所选权限点；资源级覆盖仅可收窄，不可突破组织策略',
    memberCount: 0,
    permissions: [...f.permissions],
    denied: [],
    overrides: [],
  };
  roleRows.value.unshift(role);
  selectedId.value = role.id;
  MessagePlugin.success(`已创建自定义角色「${role.name}」：授予 ${role.permissions.length} 个权限点（组织锁定项已拦截）；分配成员后生效`);
  createForm.value = { name: '', desc: '', permissions: [] };
  createOpen.value = false;
}

onMounted(() => {
  setTimeout(() => { state.value = d.roles.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="角色与权限"
      desc="内置角色模板 + 自定义角色 + 项目/工作区粒度的资源级覆盖；覆盖仅可「追加」或「收窄」，不可突破组织策略。"
      volume="卷 24"
      manifest="N-03"
      cli="oc rbac matrix --with-overrides"
      :status="[{ label: '拒绝优先', theme: 'warning' }, { label: '强制项不可放宽', theme: 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportMatrix">导出角色矩阵</Button>
        <Button size="small" theme="primary" @click="createOpen = true">新建自定义角色</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      missing-permission="rbac.role.manage"
      risk-level="R4"
      apply-path="在「角色与权限 → 申请授权」提交（Owner 审批；强制项不可放宽）"
      empty-title="没有角色"
      empty-desc="角色用于绑定权限点集合；至少保留 Owner 一个可管理角色，否则组织将失去管理入口。"
      empty-action="恢复内置角色模板"
      example-task="为发布管理员创建自定义角色：仅追加 deploy.execute 与 rollback.execute"
      what="角色矩阵加载失败"
      why="权限点定义版本与角色绑定版本不一致（策略缓存未刷新）"
      how="可重试；策略缓存刷新不影响正在执行的会话（按旧版本继续，写审计）"
      trace-id="trace-rbac-3381f0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="角色总数" :value="roleRows.length" unit="个" :target="7" target-kind="min" icon="lock" />
        <StatCard label="自定义角色" :value="roleRows.filter((r) => !r.builtin).length" unit="个" />
        <StatCard label="权限点" :value="d.permissionPoints.length" unit="项" />
        <StatCard label="强制锁定项" :value="d.permissionPoints.filter((p) => p.orgPolicyLocked).length" unit="项" icon="secured" hint="组织锁定：任何角色与覆盖都不可放宽" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">角色矩阵（内置 7 角色 × 权限点）</div>
        <Table :data="d.permissionPoints" :columns="matrixCols" row-key="key" size="small">
          <template #label="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-mono" style="font-size: 11px">{{ row.key }}</span>
              <span class="oc-muted">{{ row.label }}</span>
            </div>
          </template>
          <template #riskLevel="{ row }">
            <Tooltip :content="`风险级 ${row.riskLevel}：高风险管理操作默认需审批`"><Tag size="small" variant="outline">{{ row.riskLevel }}</Tag></Tooltip>
          </template>
          <template #locked="{ row }">
            <Tag size="small" :theme="row.orgPolicyLocked ? 'danger' : 'default'" variant="light-outline">{{ row.orgPolicyLocked ? '锁定' : '可覆盖' }}</Tag>
          </template>
          <template #role-Owner="{ row }">{{ mark(row.matrix.Owner) }}</template>
          <template #role-Admin="{ row }">{{ mark(row.matrix.Admin) }}</template>
          <template #role-Developer="{ row }">{{ mark(row.matrix.Developer) }}</template>
          <template #role-Reviewer="{ row }">{{ mark(row.matrix.Reviewer) }}</template>
          <template #role-Auditor="{ row }">{{ mark(row.matrix.Auditor) }}</template>
          <template #role-Viewer="{ row }">{{ mark(row.matrix.Viewer) }}</template>
          <template #role-ServiceAccount="{ row }">{{ mark(row.matrix.ServiceAccount) }}</template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">角色清单（点击查看）</div>
          <Table :data="roleRows" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
            <template #name="{ row }">
              <div class="oc-flex" style="gap: 6px">
                <b style="font-size: 12px">{{ row.name }}</b>
                <Tag size="small" :theme="row.builtin ? 'default' : 'primary'" variant="light-outline">{{ row.builtin ? '内置' : '自定义' }}</Tag>
              </div>
            </template>
            <template #memberCount="{ row }">{{ row.memberCount }} 人</template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">选中：{{ selected.name }}</div>
          <InfoGrid
            :items="[
              { key: 'desc', label: '说明', value: selected.desc, span: 2 },
              { key: 'allow', label: '授予权限点', value: selected.permissions.join(' / ') || '—', span: 2 },
              { key: 'deny', label: '显式拒绝', value: selected.denied.join(' / ') || '—', span: 2 },
            ]"
          />
          <div v-if="selected.overrides.length" class="oc-stack" style="margin-top: 8px">
            <div v-for="o in selected.overrides" :key="o.point" class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" :theme="o.effect === '追加' ? 'success' : 'warning'" variant="light-outline">{{ o.effect }}</Tag>
              <span class="oc-mono">{{ o.point }}</span>
              <span class="oc-muted">@ {{ o.scope }} · {{ o.note }}</span>
            </div>
          </div>
          <div v-else class="oc-muted" style="font-size: 12px; margin-top: 6px">无资源级覆盖。</div>
          <CopyableId id="corr-rbac-7719" label="复制 correlationId" />
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="createOpen" header="新建自定义角色" width="600px" :confirm-btn="{ content: '创建角色', theme: 'primary' }" cancel-btn="取消" @confirm="submitRole">
      <div class="oc-stack">
        <Input v-model="createForm.name" size="small" placeholder="角色名称（必填），如 发布管理员（自定义）" />
        <Input v-model="createForm.desc" size="small" placeholder="说明（可选）：该角色的边界与风险提示" />
        <Select v-model="createForm.permissions" multiple size="small" placeholder="授予权限点（必填，可多选）" :options="pointOptions" :min-collapsed-num="3" />
        <div class="oc-muted" style="font-size: 12px">
          仅可「追加」权限点；组织锁定项（如 plugin.install / credential.manage / dlp.override）不可授予，资源级覆盖仅可收窄。
        </div>
      </div>
    </Dialog>
  </div>
</template>
