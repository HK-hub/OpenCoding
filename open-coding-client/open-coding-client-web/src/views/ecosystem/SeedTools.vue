<script setup lang="ts">
/**
 * 种子数据工具（G2-01）：示例租户 / 项目 / 仓库 / 任务 / 知识源 / 团队清单表、「灌入种子数据」
 * （进度 + 结果计数）、脱敏样本流程说明、「一键重置（保留凭证）」二次确认、种子版本与更新时间。
 * 溯源：卷 29 / BUILD-MANIFEST G2-01。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { useUiStore, type UiStateKind } from '@/stores/ui';

const ui = useUiStore();

/** 种子版本与时间（可追溯：每次灌入都记录版本号与校验和） */
const SEED_VERSION = 'seed-2026.09.3';
const SEED_UPDATED_AT = '2026-09-19T18:20:00+08:00';
const SEED_CHECKSUM = 'sha256:5c1e9b7f（清单签名可验证）';

interface SeedRow {
  id: string;
  category: string;
  name: string;
  scope: string;
  items: number;
  updatedAt: string;
  note: string;
}

/** 六类示例清单（含 2 条负样本：已软删任务、越界知识源待人工确认） */
const SEEDS: SeedRow[] = [
  { id: 'sd-te-1', category: '租户', name: '云枢科技（企业租户）', scope: 'ten-yunshu-01', items: 1, updatedAt: '2026-09-19T18:20:00+08:00', note: '含 SSO / SCIM / 预算策略样例' },
  { id: 'sd-te-2', category: '租户', name: '演示租户（单人）', scope: 'ten-demo-02', items: 1, updatedAt: '2026-09-19T18:20:00+08:00', note: '离线演示用，默认只读策略' },
  { id: 'sd-te-3', category: '租户', name: '沙箱租户（评测）', scope: 'ten-labs-03', items: 1, updatedAt: '2026-09-19T18:20:00+08:00', note: '实验特性与破坏性用例专用' },
  { id: 'sd-pr-1', category: '项目', name: 'payment-core', scope: 'proj-01', items: 1, updatedAt: '2026-09-19T18:20:00+08:00', note: '主演示项目：Java + 幂等重试用例' },
  { id: 'sd-pr-2', category: '项目', name: 'identity-gateway', scope: 'proj-02', items: 1, updatedAt: '2026-09-19T18:20:00+08:00', note: '登录态与令牌续期用例' },
  { id: 'sd-pr-3', category: '项目', name: 'console-web', scope: 'proj-03', items: 1, updatedAt: '2026-09-19T18:20:00+08:00', note: '前端工程与组件库用例' },
  { id: 'sd-pr-4', category: '项目', name: 'data-pipeline', scope: 'proj-04', items: 1, updatedAt: '2026-09-19T18:20:00+08:00', note: '批处理与容量模型用例' },
  { id: 'sd-re-1', category: '仓库', name: 'payment-core（主仓）', scope: 'repo-101', items: 2841, updatedAt: '2026-09-20T09:12:00+08:00', note: '2.8k 文件；含 flaky 测试样本' },
  { id: 'sd-re-2', category: '仓库', name: 'identity-gateway', scope: 'repo-102', items: 1260, updatedAt: '2026-09-20T09:12:00+08:00', note: '含安全扫描基线' },
  { id: 'sd-re-3', category: '仓库', name: 'console-web', scope: 'repo-103', items: 3410, updatedAt: '2026-09-20T09:12:00+08:00', note: '含无障碍检查样本' },
  { id: 'sd-re-4', category: '仓库', name: 'infra-terraform', scope: 'repo-104', items: 512, updatedAt: '2026-09-20T09:12:00+08:00', note: '含越权修改用例（策略阻断）' },
  { id: 'sd-re-5', category: '仓库', name: 'legacy-monolith（只读）', scope: 'repo-105', items: 8620, updatedAt: '2026-09-20T09:12:00+08:00', note: '遗留分析样本；标记只读' },
  { id: 'sd-ta-1', category: '任务', name: 'T-7f3a 幂等重试改造', scope: 'proj-01', items: 1, updatedAt: '2026-09-21T20:12:00+08:00', note: 'in_review；验收 6/8，等待人工确认 PR' },
  { id: 'sd-ta-2', category: '任务', name: 'T-8842 CI 集成接线', scope: 'proj-01', items: 1, updatedAt: '2026-09-21T19:40:00+08:00', note: 'running；预算水位 62%' },
  { id: 'sd-ta-3', category: '任务', name: 'T-8831 依赖升级 PR', scope: 'proj-04', items: 1, updatedAt: '2026-09-21T16:22:00+08:00', note: 'succeeded；成本 $4.12' },
  { id: 'sd-ta-4', category: '任务', name: 'T-8815 登录态竞态修复', scope: 'proj-02', items: 1, updatedAt: '2026-09-20T22:02:00+08:00', note: '失败样本：复现脚本超时（已重试）' },
  { id: 'sd-ta-5', category: '任务', name: 'T-8802 历史归档任务', scope: 'proj-03', items: 1, updatedAt: '2026-09-18T11:05:00+08:00', note: '已软删（保留 30 天可恢复）——负样本' },
  { id: 'sd-kb-1', category: '知识源', name: '支付链路设计文档集', scope: 'proj-01', items: 42, updatedAt: '2026-09-20T15:30:00+08:00', note: '含 ADR 与接口契约' },
  { id: 'sd-kb-2', category: '知识源', name: '安全与合规手册', scope: 'org-01', items: 88, updatedAt: '2026-09-20T15:30:00+08:00', note: '含 DLP 规则说明（只读）' },
  { id: 'sd-kb-3', category: '知识源', name: '运维 Runbook 集', scope: 'org-01', items: 26, updatedAt: '2026-09-20T15:30:00+08:00', note: '含演练脚本与验收标准' },
  { id: 'sd-kb-4', category: '知识源', name: '外部参考（待确认范围）', scope: 'repo-105', items: 12, updatedAt: '2026-09-20T15:30:00+08:00', note: '越界内容：需人工确认可见范围——负样本' },
  { id: 'sd-tm-1', category: '团队', name: '平台工程组', scope: 'team-01', items: 12, updatedAt: '2026-09-19T18:20:00+08:00', note: 'Owner：沈亦舟；预算 $4,000/月' },
  { id: 'sd-tm-2', category: '团队', name: '数据平台组', scope: 'team-02', items: 8, updatedAt: '2026-09-19T18:20:00+08:00', note: 'Owner：秦越人；预算 $2,400/月' },
  { id: 'sd-tm-3', category: '团队', name: '安全与合规组', scope: 'team-03', items: 5, updatedAt: '2026-09-19T18:20:00+08:00', note: 'Owner：柏一川；只读审计权限' },
];

const CATEGORIES = ['全部', '租户', '项目', '仓库', '任务', '知识源', '团队'];

/** 灌入结果（分阶段计数：创建 / 更新 / 跳过 / 失败） */
const applying = ref(false);
const pct = ref(0);
const result = ref<{ created: number; updated: number; skipped: number; failed: number } | null>(null);
const resetDone = ref(false);
const loading = ref(true);
const category = ref('全部');
const limit = ref(8);

const filtered = computed(() => (category.value === '全部' ? SEEDS : SEEDS.filter((s) => s.category === category.value)));
const visible = computed(() => filtered.value.slice(0, limit.value));
const totalItems = computed(() => SEEDS.reduce((a, s) => a + s.items, 0));

const pageState = computed<UiStateKind>(() => {
  if (loading.value) return 'LOADING';
  if (!filtered.value.length) return 'EMPTY';
  return filtered.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

/** 灌入进度定时器句柄（完成与卸载都要清理） */
let seedTimer: number | null = null;
/** 灌入种子数据：进度可见 + 结果计数（重复条目按「更新」而非重复创建） */
function applySeed() {
  if (applying.value) return;
  applying.value = true;
  pct.value = 0;
  seedTimer = window.setInterval(() => {
    pct.value = Math.min(100, pct.value + 25);
    if (pct.value >= 100) {
      if (seedTimer !== null) window.clearInterval(seedTimer);
      seedTimer = null;
      applying.value = false;
      result.value = { created: 18, updated: 4, skipped: 2, failed: 0 };
      ui.track('eco.seed.applied', { version: SEED_VERSION });
      MessagePlugin.success(`种子灌入完成：创建 18 · 更新 4 · 跳过 2（已存在）· 失败 0（${SEED_VERSION}）`);
    }
  }, 160);
}

/** 一键重置（保留凭证）：清空业务数据，凭据引用与许可保留（避免重置后无法登录） */
function resetBusinessData() {
  result.value = null;
  pct.value = 0;
  resetDone.value = true;
  MessagePlugin.warning('已重置业务数据：会话 / 任务 / 知识 / 审计清空；凭据引用、许可与团队绑定保留');
}

/** 导出种子清单（真实下载）：含版本、条目与校验和，便于评审与复现 */
function exportSeedManifest() {
  const name = downloadJson(
    { version: SEED_VERSION, updatedAt: SEED_UPDATED_AT, checksum: SEED_CHECKSUM, categories: CATEGORIES.slice(1), entries: SEEDS },
    `${SEED_VERSION}-manifest.json`,
  );
  MessagePlugin.success(`已导出种子清单 ${name}`);
}

onMounted(() => {
  window.setTimeout(() => {
    loading.value = false;
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
onUnmounted(() => {
  // 离开页面时清理进度定时器：避免残留无归属定时器继续推进已卸载组件的状态
  if (seedTimer !== null) window.clearInterval(seedTimer);
  seedTimer = null;
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="种子数据工具"
      desc="演示与评测用的确定性种子数据（租户 / 项目 / 仓库 / 任务 / 知识源 / 团队），支持灌入、脱敏样本说明与「一键重置（保留凭证）」；种子版本与更新时间始终可见。"
      volume="卷 29"
      manifest="G2-01"
      cli="oc seed apply --profile demo --json"
      :status="[{ label: SEED_VERSION, theme: 'primary' }, { label: '脱敏样本 100%', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportSeedManifest">导出种子清单</Button>
        <Button size="small" theme="primary" :loading="applying" @click="applySeed">灌入种子数据</Button>
        <Popconfirm
          content="「一键重置」将清空业务数据（会话 / 任务 / 知识与索引 / 审计投影 / 成本明细），保留凭据引用、许可与团队绑定。重置不可撤销（可重新灌入种子数据），重置动作写入审计。是否继续？"
          @confirm="resetBusinessData"
        >
          <Button size="small" theme="danger" variant="outline">一键重置（保留凭证）</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="种子版本" :value="SEED_VERSION" format="raw" icon="database" :hint="`更新于 ${new Date(SEED_UPDATED_AT).toLocaleDateString('zh-CN')}`" />
      <StatCard label="清单条目" :value="SEEDS.length" unit="条" icon="layers" hint="六类示例对象" />
      <StatCard label="展开对象数" :value="totalItems" unit="个" icon="folder" hint="仓库文件数按 1 条目计" />
      <StatCard label="重置状态" :value="resetDone ? '已重置' : '未重置'" format="raw" icon="history" hint="重置保留凭证与许可" />
    </div>

    <StateShell
      :state="pageState"
      :collapsed-summary="`清单 ${filtered.length} 条，超过单次渲染阈值（8 条）已折叠。`"
      :page-size="8"
      stage="正在读取种子清单与版本信息…"
      empty-title="该分类下没有种子数据"
      empty-desc="当前分类没有示例对象；可切换到「全部」查看六类清单，或重新灌入种子数据。"
      empty-action="查看全部清单"
      example-task="灌入种子数据后在会话工作台跑一次示例任务，观察证据与成本"
      what="种子清单读取失败"
      why="清单签名校验失败（本地缓存的种子包与版本元数据不一致）。"
      how="可重试；校验失败时禁止灌入（Fail-Closed），避免写入不完整或来源不明的数据。"
      trace-id="trace-seed-6b20f4"
      @retry="loading = false"
      @load-more="limit += 8"
      @empty-action="category = '全部'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">种子数据版本与更新时间<CopyableId id="trace-seed-6b20f4" label="复制 traceId" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'ver', label: '版本', value: SEED_VERSION, mono: true, copyable: true },
            { key: 'at', label: '更新时间', value: new Date(SEED_UPDATED_AT).toLocaleString('zh-CN') },
            { key: 'sum', label: '校验和', value: SEED_CHECKSUM, mono: true },
            { key: 'scope', label: '覆盖范围', value: '六类示例对象 + 2 条负样本（软删任务 / 越界知识源）' },
            { key: 'reset', label: '重置策略', value: '清空业务数据，保留凭据引用 / 许可 / 团队绑定（可再次灌入）' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <CliHint command="oc seed apply --profile demo --dry-run" label="先预演" />
            <CliHint command="oc seed verify --checksum sha256:5c1e9b7f" label="校验签名" />
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">灌入进度与结果计数</div>
          <Progress :percentage="pct" :status="pct >= 100 ? 'success' : 'active'" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag v-if="result" size="small" theme="success" variant="light-outline">创建 {{ result.created }}</Tag>
            <Tag v-if="result" size="small" theme="primary" variant="light-outline">更新 {{ result.updated }}</Tag>
            <Tag v-if="result" size="small" theme="default" variant="light-outline">跳过（已存在）{{ result.skipped }}</Tag>
            <Tag v-if="result" size="small" :theme="result.failed ? 'danger' : 'success'" variant="light-outline">失败 {{ result.failed }}</Tag>
            <span v-if="!result" class="oc-muted" style="font-size: 12px">尚未灌入：点击「灌入种子数据」开始（幂等：重复条目按更新处理）。</span>
          </div>
          <Alert
            theme="info"
            style="margin-top: 8px"
            message="灌入是幂等的：以对象 id 为键，已存在则更新、内容一致则跳过；失败条目逐条列出，不静默忽略。"
            description="种子数据全部为合成内容（人名 / 邮箱 / 手机号均为虚构），不含真实凭证与个人数据。"
          />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">示例清单（六类：租户 / 项目 / 仓库 / 任务 / 知识源 / 团队）</div>
          <Select v-model="category" size="small" style="width: 150px" aria-label="分类过滤" :options="CATEGORIES.map((c) => ({ label: c, value: c }))" />
        </div>
        <Table :data="visible" row-key="id" size="small" :columns="[
          { colKey: 'category', title: '类别', width: 100, cell: 'category' },
          { colKey: 'name', title: '名称', width: 260 },
          { colKey: 'scope', title: '归属 / 标识', width: 140, cell: 'scope' },
          { colKey: 'items', title: '对象数', width: 100, cell: 'items' },
          { colKey: 'updatedAt', title: '更新时间', width: 170, cell: 'at' },
          { colKey: 'note', title: '说明', ellipsis: true },
        ]" table-layout="fixed">
          <template #category="{ row }"><Tag size="small" theme="primary" variant="light-outline">{{ row.category }}</Tag></template>
          <template #scope="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.scope }}</span></template>
          <template #items="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.items.toLocaleString('zh-CN') }}</span></template>
          <template #at="{ row }">{{ new Date(row.updatedAt).toLocaleString('zh-CN') }}</template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">展示 {{ visible.length }} / {{ filtered.length }} 条（EDGE_DATA 折叠，可加载更多）；负样本已在说明列标注。</div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">脱敏样本流程说明</div>
          <div class="oc-stack" style="gap: 6px; font-size: 13px">
            <div class="oc-flex" style="gap: 6px"><OcIcon name="search" size="14px" /><span>① 识别：对种子生成阶段的所有字符串跑敏感模式扫描（人名 / 邮箱 / 手机号 / 身份证 / 密钥形态）。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="edit" size="14px" /><span>② 替换：姓名与邮箱替换为固定词表值（确定性：同一输入永远同一替换），密钥类字段直接替换为引用名。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="check" size="14px" /><span>③ 校验：正则 + 校验位双重校验，任何未脱敏命中即阻断打包（Fail-Closed）。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="file" size="14px" /><span>④ 记录：脱敏规则与命中统计写入清单（可导出），供评审复现。</span></div>
          </div>
          <Alert theme="success" style="margin-top: 8px" message="当前种子包脱敏覆盖 100%：0 条未脱敏命中；凭证字段一律为引用名（secret://…）。" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">一键重置（保留凭证）说明</div>
          <Alert
            theme="warning"
            message="重置将清空业务数据，但保留凭据引用、许可与团队绑定。"
            description="清空范围：会话与事件流、任务与计划、知识与索引、审计投影、成本明细；保留范围：凭据引用（secret://…）、许可与席位、团队与角色绑定、偏好设置。"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" theme="danger" variant="light-outline">不可撤销</Tag>
            <Tag size="small" variant="outline">跳过二次确认的机会：无（必须显式确认）</Tag>
            <Tag v-if="resetDone" size="small" theme="warning" variant="light-outline">最近已重置</Tag>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <CliHint command="oc seed reset --keep-credentials --yes" label="等价 CLI" />
            <Button size="small" variant="outline" @click="exportSeedManifest">重置前导出清单</Button>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
