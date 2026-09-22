<script setup lang="ts">
/**
 * 技能库（K-01）：四源发现 + 来源/兼容/状态/签名/评测徽标 + 启用点。
 * 溯源：卷 08 §4.2 manifest 字段 / §4.5 生命周期；安装与卸载走独立确认页（不静默生效）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, MessagePlugin, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import {
  SKILL_SCOPE_LABEL, SKILL_SOURCE_LABEL, SKILL_STATE_THEME, SIGNATURE_LABEL, SIGNATURE_THEME,
  useExtList, type TagTheme,
} from '@/components/extension/useExtList';

const router = useRouter();
const skills = extensionData.skills;

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(skills, {
  persistKey: 'skills',
  pageSize: 12,
  match: (s, kw, f) => (f === 'all' || s.source === f) && (!kw || `${s.name}${s.description}${s.owner}`.toLowerCase().includes(kw)),
});

const sourceOptions = [
  { label: '全部来源（四源）', value: 'all' },
  { label: '内置（随产品）', value: 'builtin' },
  { label: '组织私仓', value: 'org-registry' },
  { label: '项目目录 .oc/skills', value: 'project-dir' },
  { label: '用户目录 ~/.oc/skills', value: 'user-dir' },
];

/** 启用点：本地覆盖表（默认取发现态），切换即写入审计语义 */
const enabledMap = ref<Record<string, boolean>>(Object.fromEntries(skills.map((s) => [s.id, s.enabled])));

function toggle(sid: string, name: string, value: boolean) {
  enabledMap.value[sid] = value;
  MessagePlugin.info(
    value
      ? `已启用 ${name}：运行期仍逐动作走权限决策（安装授权不替代运行期治理）`
      : `已停用 ${name}：已记录禁用事件，会话内不再注入其指令`,
  );
}

const stats = computed(() => ({
  total: skills.length,
  active: skills.filter((s) => s.activationState === 'active').length,
  pending: skills.filter((s) => s.suggestion?.decision === 'pending').length,
  sigIssue: skills.filter((s) => s.signature.state !== 'verified').length,
  gateMet: skills.filter((s) => s.eval.gate.met).length,
}));

const columns = [
  { colKey: 'name', title: '技能（命名空间 @ 版本）', width: 300 },
  { colKey: 'source', title: '来源 / 作用域', width: 190 },
  { colKey: 'compat', title: '兼容性', width: 200 },
  { colKey: 'state', title: '安装 / 激活状态', width: 170 },
  { colKey: 'signature', title: '签名', width: 110 },
  { colKey: 'eval', title: '评测门禁', width: 150 },
  { colKey: 'enabled', title: '启用', width: 90 },
  { colKey: 'ops', title: '操作', width: 150 },
];

function themeOf(v: string): TagTheme {
  return (SKILL_STATE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

function sigTheme(v: string): TagTheme {
  return (SIGNATURE_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

function sigLabel(v: string): string {
  return (SIGNATURE_LABEL as Record<string, string>)[v] ?? v;
}

function openDetail(name: string) {
  router.push({ path: '/extension/skills/detail', query: { name } });
}
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="技能库"
      desc="四源发现（内置 → 组织 → 项目 → 用户），同名按覆盖规则解析；签名与评测徽标直接决定能否安装与分发。"
      volume="卷 08" manifest="K-01" cli="oc skill list --scope all --json"
      :status="[{ label: '四源发现', theme: 'primary' }, { label: `未签名 ${stats.sigIssue} 项`, theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/skills/distribution')">分发与签名</Button>
        <Button size="small" variant="outline" @click="router.push('/extension/skills/eval')">评测门禁</Button>
        <Button size="small" theme="primary" @click="router.push('/extension/skills/creator')">
          <OcIcon name="add" size="12px" /> 创作技能
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="技能总数" :value="stats.total" unit="个" icon="browse" :trend="[9, 11, 12, 13, 14, 15, stats.total]" />
      <StatCard label="激活中" :value="stats.active" unit="个" icon="check" :trend="[3, 4, 4, 6, 6, 7, stats.active]" />
      <StatCard label="建议待处理" :value="stats.pending" unit="项" icon="lightbulb" :trend="[0, 1, 1, 2, 2, 2, stats.pending]" />
      <StatCard label="评测达标" :value="stats.gateMet" :unit="`/ ${stats.total}`" icon="task-checked" :trend="[10, 11, 12, 12, 13, 13, stats.gateMet]" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索技能名 / 描述 / 维护人" clearable style="width: 280px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="sourceOptions" style="width: 200px" />
        <span class="oc-muted" style="font-size: 12px">过滤记忆：刷新后保留（localStorage）</span>
        <span class="oc-grow" />
        <span class="oc-secondary" style="font-size: 12px">匹配 {{ matched.length }} 条</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      empty-title="没有匹配的技能"
      empty-desc="四源目录均为空或过滤条件过窄；可放宽来源过滤，或从私仓/本地目录导入技能。"
      empty-action="导入本地技能"
      example-task="为 payment-core 启用 acme.platform.java-refactor"
      what="技能索引加载失败"
      why="组织私仓 oc://org-registry 不可达（TLS 握手超时）；本地索引仍可用但结果不完整。"
      how="可重试；或在「技能分发与签名」切换为本地目录来源后继续。"
      :trace-id="'trace-skill-idx-77c1'"
      :collapsed-summary="edgeSummary"
      :page-size="12"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="MessagePlugin.info('已打开本地导入向导入口（等价命令 oc skill import <path>）')"
    >
      <Table
        row-key="id"
        size="small"
        :data="visible"
        :columns="columns"
        :hover="true"
        table-layout="fixed"
      >
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <div class="oc-flex" style="gap: 6px">
              <Button size="small" variant="text" @click="openDetail(row.name)">{{ row.name }}</Button>
              <Tag size="small" variant="outline" class="oc-mono">{{ row.version }}</Tag>
              <Tag v-if="row.degraded" size="small" theme="warning" variant="light-outline">劣化 → 建议</Tag>
            </div>
            <span class="oc-muted oc-truncate" style="font-size: 12px; max-width: 280px">{{ row.description }}</span>
            <span v-if="row.blockedReason" class="oc-secondary" style="font-size: 11px">拒绝原因：{{ row.blockedReason }}</span>
          </div>
        </template>

        <template #source="{ row }">
          <div class="oc-stack" style="gap: 3px">
            <span style="font-size: 12px">{{ SKILL_SOURCE_LABEL[row.source] }}</span>
            <Tag size="small" variant="outline">{{ SKILL_SCOPE_LABEL[row.scope] }}级</Tag>
          </div>
        </template>

        <template #compat="{ row }">
          <div class="oc-stack" style="gap: 3px">
            <span class="oc-mono" style="font-size: 12px">内核 {{ row.compatibility.kernelRange }}</span>
            <div class="oc-flex oc-flex--wrap" style="gap: 3px">
              <Tag v-for="c in row.compatibility.modelCapabilities" :key="c" size="small" variant="outline">{{ c }}</Tag>
              <span v-if="!row.compatibility.modelCapabilities.length" class="oc-muted" style="font-size: 11px">无模型能力要求</span>
            </div>
          </div>
        </template>

        <template #state="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag size="small" :theme="themeOf(row.installState)" variant="light-outline">{{ row.installState }}</Tag>
            <Tag size="small" variant="outline">
              {{ row.activationState === 'active' ? '已激活' : row.activationState === 'suggested' ? '建议中' : '未激活' }}
            </Tag>
          </div>
        </template>

        <template #signature="{ row }">
          <Tooltip :content="`${row.signature.signer} · ${row.signature.algorithm} · ${row.signature.fingerprint}`">
            <Tag size="small" :theme="sigTheme(row.signature.state)" variant="light-outline">
              {{ sigLabel(row.signature.state) }}
            </Tag>
          </Tooltip>
        </template>

        <template #eval="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">
              {{ (row.eval.gate.actual * 100).toFixed(0) }}% / 门槛 {{ (row.eval.gate.threshold * 100).toFixed(0) }}%
            </span>
            <Tag size="small" :theme="row.eval.gate.met ? 'success' : 'danger'" variant="light-outline">
              {{ row.eval.gate.met ? '达标' : '未达标' }}
            </Tag>
          </div>
        </template>

        <template #enabled="{ row }">
          <Tooltip content="启用仅代表可被装配；实际执行仍逐动作走权限决策（安装授权 ≠ 运行期放行）">
            <Switch
              size="small"
              :value="enabledMap[row.id]"
              :disabled="row.signature.state === 'invalid'"
              @change="(v) => toggle(row.id, row.name, Boolean(v))"
            />
          </Tooltip>
        </template>

        <template #ops="{ row }">
          <div class="oc-flex" style="gap: 2px">
            <Button size="small" variant="text" @click="openDetail(row.name)">详情</Button>
            <Button
              v-if="row.installState === 'Discovered'"
              size="small"
              variant="text"
              @click="router.push({ path: '/extension/skills/install', query: { name: row.name } })"
            >安装</Button>
            <Button
              v-else
              size="small"
              variant="text"
              @click="router.push({ path: '/extension/skills/uninstall', query: { name: row.name } })"
            >卸载</Button>
          </div>
        </template>
      </Table>
    </StateShell>
  </div>
</template>
