<script setup lang="ts">
/**
 * F-06 公告与门槛：四级公告（信息 / 重要 / 强制 / 迁移引导）+ 已读确认 + 强制门槛阻断态 + 一键迁移。
 * 硬约束：低于最低兼容版本时拒绝连接服务端（给出升级路径）；一键迁移执行 oc upgrade --migrate，失败可回滚应用。
 * 溯源：卷 28 §8 / BUILD-MANIFEST F-06
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadText } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import type { Announcement } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const confirmed = ref<Set<string>>(new Set(d.announcements.filter((a) => a.readConfirmed).map((a) => a.id)));
const viewingVersion = ref('2.9.1');
const migrating = ref(false);
const versions = ['2.9.1（本机）', '2.8.4（旧版客户端）'].map((v) => ({ label: v, value: v.split('（')[0] }));
const currentVersion = computed(() => viewingVersion.value);
const levelTheme: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = { 信息: 'default', 重要: 'warning', 强制: 'danger', 迁移引导: 'primary' };
const audienceByLevel: Record<string, string> = {
  信息: '全部用户（站内）',
  重要: '全部用户（站内 + 邮件摘要）',
  强制: '全部租户（阻断门槛，升级后恢复）',
  迁移引导: '管理员 + 平台团队',
};
const rows = computed(() => d.announcements.map((a) => ({ ...a, read: confirmed.value.has(a.id), audience: audienceByLevel[a.level] ?? '全部用户' })));
const blockingAnnouncements = computed(() => d.announcements.filter((a) => a.blocking));
const blockedBy = computed(() => blockingAnnouncements.value.filter((a) => compareVersion(currentVersion.value, a.minVersion) < 0));
const migrateTarget = computed(() => d.announcements.find((a) => a.level === '迁移引导'));
/** 版本比较：仅比较数字段，负数表示 a 低于 b */
function compareVersion(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((s) => Number.parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  const pb = b.split(/[.-]/).map((s) => Number.parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 已读确认：更新本地状态并记录确认人（真实实现写回服务端并进入审计） */
function confirmRead(a: Announcement) {
  if (confirmed.value.has(a.id)) {
    MessagePlugin.info(`「${a.title}」已确认过（确认人：${a.confirmedBy.join('、') || '当前用户'}）`);
    return;
  }
  confirmed.value.add(a.id);
  MessagePlugin.success(`已确认已读：${a.title}（记录确认人 = 当前用户）`);
}

/** 一键迁移：执行 oc upgrade --migrate；失败自动回滚应用版本（数据迁移不回退，需人工评估） */
function runMigrate() {
  migrating.value = true;
  MessagePlugin.info('开始执行 oc upgrade --migrate --verify：先备份 → expand → contract → 校验');
  window.setTimeout(() => {
    migrating.value = false;
    MessagePlugin.success('迁移完成（expand-contract 两阶段通过，校验全部通过）；如失败将自动回滚应用版本');
  }, 1100);
}

function exportMarkdown() {
  const md = [
    '# 公告与门槛清单（OpenCoding Harness 演示环境）',
    '',
    ...d.announcements.map((a) => `## [${a.level}] ${a.title}\n- 人群：${audienceByLevel[a.level] ?? '全部用户'}\n- 已读确认：${confirmed.value.has(a.id) ? '已确认' : '待确认'}\n- 最低版本：${a.minVersion}\n- 正文：${a.body}\n`),
  ].join('\n');
  downloadText(md, 'announcements.md');
  MessagePlugin.success('公告清单已导出（Markdown）');
}

/** 切换门槛判定视角：以不同客户端版本查看是否被强制门槛阻断 */
function onViewVersion(v: unknown) {
  viewingVersion.value = String(v);
}

function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}

onMounted(load);
</script>

<template>
  <div class="oc-page">
    <PageHeader title="公告与门槛" volume="卷 28" manifest="F-06" cli="oc announce list --with-read-state --json"
      desc="四级公告（信息 / 重要 / 强制 / 迁移引导）含人群与已读确认；强制门槛低于最低兼容版本时拒绝连接服务端；迁移含回滚保障。"
      :status="[{ label: `${blockedBy.length ? '低于门槛（阻断）' : '版本达标'}`, theme: blockedBy.length ? 'danger' : 'success' }, { label: '迁移失败可回滚应用', theme: 'default' }]">
      <template #actions>
        <Select :value="currentVersion" size="small" style="width: 190px" :options="versions" @change="onViewVersion" />
        <Button size="small" variant="outline" @click="exportMarkdown"><OcIcon name="download" size="12px" /> 导出公告</Button>
        <Popconfirm @confirm="runMigrate"
          content="执行 oc upgrade --migrate：含不可回滚迁移（expand-contract 两阶段），执行期间只读；失败自动回滚应用版本（数据迁移不回退，需人工评估）。操作不可撤销。是否继续？">
          <Button size="small" theme="danger" variant="outline" :loading="migrating">一键迁移</Button>
        </Popconfirm>
      </template>
    </PageHeader>
    <StateShell :state="state" trace-id="trace-announce-4e7c19" empty-title="当前没有公告" empty-action="刷新公告"
      empty-desc="无公告时客户端静默运行；强制门槛公告会在连接服务端前强制展示。"
      example-task="以 2.8.4 客户端视角查看强制门槛阻断与升级路径"
      what="公告加载失败" why="公告签名校验失败或公告服务不可达（拒绝展示未验签公告）"
      how="可重试；不可达时保留上次已验签公告缓存，强制门槛判定仍按本地缓存执行"
      @retry="load" @empty-action="load">
      <div v-if="blockedBy.length" class="oc-card" style="border-left: 3px solid var(--td-error-color-3, #d54941)">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <Tag size="small" theme="danger" variant="light-outline">强制门槛：拒绝连接服务端</Tag>
          <span class="oc-mono">客户端 {{ currentVersion }} &lt; 最低兼容版本 {{ blockedBy[0].minVersion }}</span>
          <span class="oc-grow" />
          <CliHint command="oc upgrade --to 2.9.2 --migrate --verify" />
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
          {{ blockedBy[0].title }}。升级路径：① 更新中心检查更新 → ② 下载并应用 2.9.2（含安全修复）→ ③ 重连服务端自动解除阻断。
          阻断期间本地只读可用（可查看与导出，不锁死数据）。
        </div>
      </div>
      <div v-else class="oc-card">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <Tag size="small" theme="success" variant="light-outline">版本达标</Tag>
          <span class="oc-muted" style="font-size: 12px">客户端 {{ currentVersion }} 满足全部强制门槛（{{ blockingAnnouncements.map((b) => b.minVersion).join(' / ') }}），服务端连接正常。</span>
        </div>
      </div>

      <div class="oc-grid oc-grid--4" style="margin-top: 12px">
        <StatCard label="公告总数" :value="d.announcements.length" unit="条" icon="sound" hint="四级：信息 / 重要 / 强制 / 迁移引导" />
        <StatCard label="强制级别" :value="blockingAnnouncements.length" unit="条" icon="flag" hint="不升级将阻断连接（可见且可解释）" />
        <StatCard label="待确认已读" :value="rows.filter((r) => !r.read).length" unit="条" :lower-is-better="true" icon="task-checked" hint="强制 / 重要级别需确认" />
        <StatCard label="待确认迁移" :value="migrateTarget ? 1 : 0" unit="条" icon="refresh" hint="含回滚保障（应用版本可回滚）" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">公告列表（级别徽标 / 人群 / 已读确认）</div>
          <CopyableId id="trace-announce-list-6b2f83" label="复制 traceId" />
        </div>
        <Table :data="rows" row-key="id" size="small" style="margin-top: 8px" :columns="[
          { colKey: 'level', title: '级别', width: 110 }, { colKey: 'title', title: '公告', width: 420 },
          { colKey: 'audience', title: '人群', width: 200 }, { colKey: 'read', title: '已读确认', width: 150 },
          { colKey: 'action', title: '操作', width: 190 }]">
          <template #level="{ row }">
            <Tag size="small" :theme="levelTheme[String(row.level)] ?? 'default'" variant="light-outline">{{ row.level }}</Tag>
            <Tag v-if="row.blocking" size="small" theme="danger" variant="outline" style="margin-left: 4px">门槛</Tag>
          </template>
          <template #title="{ row }">
            <span>{{ row.title }}</span>
            <div class="oc-muted" style="font-size: 11px">{{ new Date(row.publishedAt).toLocaleString('zh-CN') }} · {{ row.body }}</div>
          </template>
          <template #audience="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.audience }}</span></template>
          <template #read="{ row }">
            <Tag size="small" :theme="row.read ? 'success' : 'warning'" variant="light-outline">{{ row.read ? '已确认' : '待确认' }}</Tag>
            <div v-if="row.confirmedBy.length" class="oc-muted" style="font-size: 11px">确认人：{{ row.confirmedBy.join('、') }}</div>
          </template>
          <template #action="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <Button size="small" variant="outline" :disabled="row.read" @click="confirmRead(row)">确认已读</Button>
              <Popconfirm v-if="row.migrationCommand" content="执行迁移（含展开 / 收缩两阶段，期间只读）；失败自动回滚应用版本、数据迁移不回退。是否继续？" @confirm="runMigrate">
                <Button size="small" theme="primary" variant="text">一键迁移</Button>
              </Popconfirm>
              <span v-else class="oc-muted">—</span>
            </div>
          </template>
        </Table>
        <div class="oc-state__hint" style="margin-top: 6px">
          迁移引导公告：{{ migrateTarget?.migrationCommand || '—' }}；迁移前建议先在预发执行 <span class="oc-mono">--dry-run</span> 演练。公告为签名校验通过后才展示（未验签一律拒绝）。
        </div>
      </div>
    </StateShell>
  </div>
</template>
