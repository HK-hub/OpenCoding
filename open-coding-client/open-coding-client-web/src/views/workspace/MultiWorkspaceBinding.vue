<script setup lang="ts">
/**
 * O-11 多工作区绑定。
 * 主体（会话/任务/团队）× 工作区 × 角色（主/关联）× 写范围 + 跨区授权；
 * 跨工作区访问必须显式授权，未授权访问被拒绝并留审计。
 * 溯源：卷 20 D-WS-8/§4.1；BUILD-MANIFEST O-11。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { WorkspaceBinding } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const wsFilter = ref('');
const grantOpen = ref(false);
const grant = ref({ subject: 'S-7f3a', workspace: 'ws-0002', role: 'related', scope: 'src/identity/**', ttl: '本次会话' });

interface BindingRow extends WorkspaceBinding { key: string; workspaceId: string; wsName: string; wsType: string }

const bindings = computed<BindingRow[]>(
  () => platformData.workspaces.flatMap((w) => w.bindings.map((b) => ({ ...b, key: `${b.subjectId}:${w.workspaceId}`, workspaceId: w.workspaceId, wsName: w.name, wsType: w.type }))),
);
const rows = computed(() => (wsFilter.value ? bindings.value.filter((b) => b.workspaceId === wsFilter.value) : bindings.value));
const crossGrants = computed(() => bindings.value.filter((b) => b.crossGrant !== '无' && b.crossGrant !== '无（主工作区）'));

const columns = [
  { colKey: 'subjectId', title: '主体编号', width: 170, cell: 'sid' },
  { colKey: 'subjectKind', title: '主体类型', width: 110, cell: 'kind' },
  { colKey: 'wsName', title: '工作区', width: 250, cell: 'ws' },
  { colKey: 'role', title: '角色', width: 120, cell: 'role' },
  { colKey: 'writeScope', title: '写范围', ellipsis: true, cell: 'scope' },
  { colKey: 'crossGrant', title: '跨区授权', width: 280, cell: 'cross' },
];

function submitGrant() {
  MessagePlugin.success(`跨区授权已提交：${grant.value.subject} → ${grant.value.workspace}（${grant.value.role}，范围 ${grant.value.scope}，有效期 ${grant.value.ttl}）；写入审计并通知工作区所有者`);
  grantOpen.value = false;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = bindings.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="多工作区绑定"
      desc="会话/任务/团队可绑定多个工作区（主 + 关联）；跨工作区读写需显式授权并限定写范围，未授权访问被拒绝并记审计。"
      volume="卷 20" manifest="O-11" cli="oc workspace bindings list --subject S-1b2c && oc workspace bindings grant --subject S-7f3a --workspace ws-0002"
      :status="[{ label: `${bindings.length} 条绑定`, theme: 'default' }, { label: `${crossGrants.length} 条跨区授权`, theme: 'warning' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 170px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'PERMISSION_DENIED', label: '无权限' },
        ]" />
        <Select v-model="wsFilter" size="small" style="width: 230px" clearable placeholder="按工作区过滤" aria-label="工作区">
          <Option value="" label="全部工作区" />
          <Option v-for="w in platformData.workspaces" :key="w.workspaceId" :value="w.workspaceId" :label="w.name" />
        </Select>
        <Button size="small" theme="primary" @click="grantOpen = true">授予跨区访问</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="绑定总数" :value="bindings.length" icon="link" hint="主工作区写作范围最宽，关联工作区默认只读" />
      <StatCard label="主绑定" :value="bindings.filter((b) => b.role === 'primary').length" icon="flag" hint="每个主体一个主工作区" />
      <StatCard label="跨区授权" :value="crossGrants.length" icon="secured" hint="需显式授权，默认只读，可限 TTL" />
      <StatCard label="写范围条目" :value="bindings.reduce((a, b) => a + b.writeScope.length, 0)" icon="edit" hint="范围外为只读（路径围栏）" />
    </div>

    <StateShell
      :state="demo" stage="正在读取主体-工作区绑定与写范围…"
      empty-title="没有工作区绑定" empty-desc="主体尚未绑定工作区；未绑定工作区的会话无法执行文件与命令工具。"
      empty-action="绑定主工作区" example-task="让团队 TM-9d 的两个成员各自绑定独立工作区以并行开发"
      what="绑定关系读取失败" why="绑定表读取超时（与工作区元数据同库，主库切换期间）"
      how="可重试；只读列表可先看快照（可能滞后一个写入周期）" trace-id="trace-ddee5527"
      missing-permission="workspace.bindings.read" risk-level="R2" apply-path="在「权限与审批 → 申请授权」提交工作区绑定读取权限"
      @retry="demo = 'NORMAL'" @empty-action="grantOpen = true" @apply="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="key" size="small" :pagination="undefined">
        <template #sid="{ row }"><span class="oc-mono">{{ row.subjectId }}</span></template>
        <template #kind="{ row }">
          <Tag size="small" variant="light-outline">{{ row.subjectKind }}</Tag>
        </template>
        <template #ws="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span>{{ row.wsName }}</span>
            <span class="oc-mono oc-muted">{{ row.wsType }}</span>
          </div>
        </template>
        <template #role="{ row }">
          <Tag :theme="row.role === 'primary' ? 'primary' : 'default'" size="small" variant="light-outline">
            {{ row.role === 'primary' ? '主工作区' : '关联' }}
          </Tag>
        </template>
        <template #scope="{ row }">
          <span v-if="row.writeScope.length" class="oc-mono oc-truncate">{{ row.writeScope.join('、') }}</span>
          <span v-else class="oc-muted">只读（无写范围）</span>
        </template>
        <template #cross="{ row }">
          <span v-if="row.crossGrant === '无' || row.crossGrant === '无（主工作区）'" class="oc-muted">{{ row.crossGrant }}</span>
          <Tag v-else theme="warning" size="small" variant="light-outline">{{ row.crossGrant }}</Tag>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="grantOpen" header="授予跨区工作区访问" width="620px" :confirm-btn="{ content: '提交授权', theme: 'primary' }" cancel-btn="取消" @confirm="submitGrant">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap">
          <RiskBadge level="R3" show-desc />
          <Tag theme="warning" variant="light-outline" size="small">跨区访问默认只读；写入需显式写范围 + TTL</Tag>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Select v-model="grant.subject" size="small" style="width: 180px" aria-label="主体">
            <Option value="S-1b2c" label="会话 S-1b2c" />
            <Option value="S-7f3a" label="会话 S-7f3a" />
            <Option value="T-7f3a" label="任务 T-7f3a" />
            <Option value="TM-9d" label="团队 TM-9d" />
          </Select>
          <Select v-model="grant.workspace" size="small" style="width: 220px" aria-label="工作区">
            <Option v-for="w in platformData.workspaces" :key="w.workspaceId" :value="w.workspaceId" :label="w.name" />
          </Select>
          <Select v-model="grant.role" size="small" style="width: 130px" aria-label="角色">
            <Option value="related" label="关联（只读优先）" />
            <Option value="primary" label="主工作区" />
          </Select>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Select v-model="grant.ttl" size="small" style="width: 160px" aria-label="有效期">
            <Option value="本次会话" label="本次会话" />
            <Option value="本项目" label="本项目" />
            <Option value="24h" label="24 小时" />
          </Select>
        </div>
        <div>
          <div class="oc-kv__k" style="margin-bottom: 4px">写范围（glob，留空则只读）</div>
          <Select v-model="grant.scope" size="small" aria-label="写范围" :options="[
            { value: '', label: '只读（不授予写范围）' },
            { value: 'src/identity/**', label: 'src/identity/**' },
            { value: 'tmp/replay/**', label: 'tmp/replay/**' },
          ]" />
        </div>
        <InfoGrid :columns="1" :items="[
          { key: 'why', label: '为什么需要显式授权', value: '跨工作区访问属于跨边界数据流动：默认 DENY，需主体所有者与工作区所有者双向确认' },
          { key: 'audit', label: '审计', value: '授权与每次跨区访问都记录（含目标主机/路径/写范围判定结果）' },
          { key: 'revoke', label: '撤销', value: '立即生效（撤销后正在进行的写入在安全点停止）' },
        ]" />
        <CliHint :command="`oc workspace bindings grant --subject ${grant.subject} --workspace ${grant.workspace} --role ${grant.role} --write-scope '${grant.scope}' --ttl '${grant.ttl}'`" />
      </div>
    </Dialog>
  </div>
</template>
