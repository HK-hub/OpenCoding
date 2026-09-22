<script setup lang="ts">
/**
 * I-11 代码平台集成。
 * GitHub / GitLab / Gitea / 内网自建：能力矩阵（PR/MR、评论审查、CI 状态、Webhook 事件）+ 凭据引用 +
 * 企业禁用（禁用态显式标注，能力缺失不静默）。
 * 溯源：卷 21 D-GIT-9/§4.5；BUILD-MANIFEST I-11。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Option, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { GitRepo } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const selected = ref('github');
const events = ref<string[]>(['pr.updated', 'pr.reviewed', 'ci.status.changed']);
const webhookEnabled = ref(true);

const repos = computed(() => platformData.git.repos);
const byPlatform = computed(() => repos.value.filter((r) => r.platform === selected.value));
const disabled = computed(() => repos.value.filter((r) => r.disabledByEnterprise));

const PLATFORM_CAPS = [
  { platform: 'github', pr: '✔ 创建 PR', review: '✔ 评论与审查', ci: '✔ 检查状态', hook: '✔ PR 更新/评论', cred: 'Token / GitHub App' },
  { platform: 'gitlab', pr: '✔ 创建 MR', review: '✔ 评论与审查', ci: '✔ Pipeline 状态', hook: '✔ MR 更新/评论', cred: 'Token / OAuth' },
  { platform: 'gitea', pr: '✔ 创建 PR', review: '✔ 评论与审查', ci: '✔ 状态检查', hook: '✔ PR 更新/评论', cred: 'Token' },
  { platform: 'internal', pr: '视实现（当前支持）', review: '视实现（当前支持）', ci: '视实现（部分）', hook: '视实现（自建回调）', cred: '自定义（企业 CA + 双向 TLS）' },
];

const columns = [
  { colKey: 'repo', title: '仓库', width: 200, cell: 'repo' },
  { colKey: 'platform', title: '平台', width: 130, cell: 'plat' },
  { colKey: 'defaultBranch', title: '默认分支', width: 130 },
  { colKey: 'sizeMb', title: '体积', width: 110, cell: 'size' },
  { colKey: 'status', title: '集成状态', width: 200, cell: 'status' },
  { colKey: 'lfs', title: 'LFS', width: 90, cell: 'lfs' },
];

function toggleEnterprise(repo: GitRepo) {
  MessagePlugin.warning(`已切换 ${repo.repo} 的企业禁用（禁用后推送与 PR 创建被拒绝，本地提交仍可用）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = repos.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="代码平台集成"
      desc="多平台适配器：GitHub / GitLab / Gitea / 内网自建；凭据一律引用式（Token/OAuth/App），企业可禁用某平台；能力差异显式标注（内网自建为「视实现」）。"
      volume="卷 21" manifest="I-11" cli="oc git platform list --show-capabilities && oc git platform disable --platform legacy"
      :status="[{ label: `${repos.length} 个仓库`, theme: 'default' }, { label: disabled.length ? `${disabled.length} 个被企业禁用` : '无企业禁用', theme: disabled.length ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 170px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'PERMISSION_DENIED', label: '无权限' },
        ]" />
        <Switch v-model="webhookEnabled" size="small" /> <span style="font-size: 12px">接收 Webhook 事件</span>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="接入平台" :value="new Set(repos.map((r) => r.platform)).size" icon="platform" hint="≥2 家可用即满足 DoD" />
      <StatCard label="PR/MR 能力" :value="'4 / 4'" format="raw" icon="git" hint="内网自建为「视实现」，当前可用" />
      <StatCard label="企业禁用" :value="disabled.length" icon="lock" hint="禁用后推送与 PR 被拒绝（显式报错）" />
      <StatCard label="Webhook 事件源" :value="events.length" icon="notification" hint="PR 更新 / 评论 / CI 状态" />
    </div>

    <StateShell
      :state="demo" stage="正在校验平台凭据引用与能力…"
      empty-title="没有接入代码平台" empty-desc="仅本地 Git 可用；接入平台后才能创建 PR/MR、接收评论与 CI 状态。"
      empty-action="接入 GitHub（Token 或 App）" example-task="接入 GitLab 并把 MR 评论回流为任务修订项"
      what="平台集成读取失败" why="凭据引用解析失败（企业 OAuth 应用密钥轮换中，Token 已失效）"
      how="可重试；凭据失效期间 CI 状态与评论同步暂停（不静默丢弃，恢复后补拉）" trace-id="trace-caa0e1cc"
      missing-permission="git.platform.manage" risk-level="R3" apply-path="在「权限与审批 → 申请授权」提交平台集成管理权限（需说明目标平台与用途）"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @apply="demo = 'NORMAL'"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">能力矩阵（四平台）</h3>
        <Table
          :data="PLATFORM_CAPS" size="small" :pagination="undefined" row-key="platform"
          :columns="[
            { colKey: 'platform', title: '平台', width: 130, cell: 'plat' },
            { colKey: 'pr', title: 'PR / MR', width: 180 },
            { colKey: 'review', title: '评论与审查', width: 160 },
            { colKey: 'ci', title: 'CI 状态', width: 160 },
            { colKey: 'hook', title: 'Webhook', ellipsis: true },
            { colKey: 'cred', title: '凭据类型', width: 220 },
          ]"
        >
          <template #plat="{ row }">
            <Button size="small" variant="text" @click="selected = row.platform as string">{{ row.platform }}</Button>
          </template>
        </Table>
      </div>

      <Table :data="repos" :columns="columns" row-key="repo" size="small" :pagination="undefined" style="margin-top: 12px">
        <template #repo="{ row }"><span class="oc-mono">{{ row.repo }}</span></template>
        <template #plat="{ row }">
          <Tag :theme="row.platform === selected ? 'primary' : 'default'" size="small" variant="light-outline">{{ row.platform }}</Tag>
        </template>
        <template #size="{ row }">{{ (row.sizeMb / 1024).toFixed(1) }} GB</template>
        <template #status="{ row }">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag :theme="row.disabledByEnterprise ? 'danger' : 'success'" size="small" variant="light-outline">
              {{ row.disabledByEnterprise ? '企业禁用' : '集成正常' }}
            </Tag>
            <Tag v-if="row.partialClone" size="small" variant="outline">部分克隆</Tag>
            <Tag v-if="row.commitGraph" size="small" variant="outline">commit-graph</Tag>
            <Tooltip v-if="row.platform === 'internal'" content="内网自建能力视实现：CI 状态可能不完整，缺失能力不静默（显示为不可用）">
              <Tag size="small" variant="light-outline">能力视实现</Tag>
            </Tooltip>
          </div>
        </template>
        <template #lfs="{ row }">
          <Tag :theme="row.lfs ? 'success' : 'default'" size="small" variant="light-outline">{{ row.lfs ? '启用' : '未启用' }}</Tag>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">平台详情：{{ selected }}（{{ byPlatform.length }} 个仓库）</h3>
        <InfoGrid :columns="1" :items="[
          { key: 'cred', label: '凭据', value: 'secret://git/' + selected + '-token（引用式，明文永不回显）' },
          { key: 'cap', label: '能力', value: selected === 'internal' ? 'PR/MR：视实现（当前支持）；CI：部分' : 'PR/MR、评论审查、CI 状态、Webhook 全可用' },
          { key: 'hook', label: 'Webhook 端点', value: webhookEnabled ? '已启用（PR 更新 / 评论 / CI 状态 → 进入事件流）' : '已停用（不接收平台事件，需手动同步）' },
          { key: 'disable', label: '企业开关', value: '可整体禁用某平台（禁用后推送与 PR 创建被拒绝并给出明确错误）' },
          { key: 'audit', label: '审计', value: '推送凭证经密钥代理注入；每次平台调用记审计（含目标平台与结果）' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Button size="small" variant="outline" @click="toggleEnterprise(byPlatform[0] ?? repos[0])">切换企业禁用</Button>
          <CliHint :command="`oc git platform test --platform ${selected}`" />
        </div>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">Webhook 事件与回流</h3>
        <InfoGrid :columns="1" :items="[
          { key: 'e1', label: 'pr.updated', value: 'PR 状态变化 → 更新任务进度与合并队列状态' },
          { key: 'e2', label: 'pr.reviewed', value: '审查意见 → 可回流为任务修订项（I-12）' },
          { key: 'e3', label: 'ci.status.changed', value: 'CI 结果 → 预检证据补充（与本地预检相互印证）' },
          { key: 'e4', label: 'comment.created', value: '评论进入评论闭环（未处理评论会在任务卡上标记）' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">Webhook 停用时：不静默——页面顶部显示「事件同步已停用」，并给出手动同步入口</Tag>
        </div>
      </div>
    </div>
  </div>
</template>
