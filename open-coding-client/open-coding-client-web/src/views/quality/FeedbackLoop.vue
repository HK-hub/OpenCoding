<script setup lang="ts">
/**
 * 反馈闭环（Y-04）：来源 → 归因 → 处理 → 验证 全链路追踪（含证据与优先级）；未闭环反馈高亮并计数；
 * 满意度回访标记；「输出月度复盘」真实下载 Markdown（含统计、明细、未闭环清单与结论）。
 * 溯源：卷 26 / BUILD-MANIFEST Y-04。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { downloadText } from '@/utils/download';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

type FbStatus = '待归因' | '处理中' | '已闭环' | '已关闭（不修复）';
interface Feedback {
  feedbackId: string; source: string; domain: string; evidence: string; priority: 'P0' | 'P1' | 'P2';
  status: FbStatus; verify: string; revisit: boolean; score?: number; closeReason?: string;
}

const FEEDBACKS: Feedback[] = [
  { feedbackId: 'FB-2041', source: '用户反馈', domain: '上下文压缩', evidence: '压缩后引用跳转 404（复现 3/3）', priority: 'P1', status: '已闭环', verify: 'W36 起 J10 旅程全绿（引用可跳转）', revisit: true, score: 4.6 },
  { feedbackId: 'FB-2042', source: '支持工单', domain: '沙箱 · 隔离', evidence: '子进程写 /tmp 被拒绝但未给出替代路径', priority: 'P2', status: '已闭环', verify: '拒绝文案附带替代路径（截图复核）', revisit: true, score: 4.2 },
  { feedbackId: 'FB-2043', source: '遥测异常', domain: '平台 · 事件', evidence: '事件消费滞后 5 分钟告警（W35 两次）', priority: 'P1', status: '处理中', verify: '—', revisit: false },
  { feedbackId: 'FB-2044', source: '满意度回访', domain: '模型 · 路由', evidence: '回访原话：长提示词首 token 明显变慢', priority: 'P1', status: '处理中', verify: '前缀缓存已上线，观察 2 个窗口后验证', revisit: true, score: 3.8 },
  { feedbackId: 'FB-2045', source: '内部红队', domain: '提示词', evidence: '注入样本绕过输出过滤（1/9）', priority: 'P0', status: '已闭环', verify: '红队增量 9/9 通过（R-2321 附带结果）', revisit: true, score: 4.0 },
  { feedbackId: 'FB-2046', source: '社区', domain: '文档', evidence: '插件开发指南示例代码无法编译', priority: 'P2', status: '已闭环', verify: '示例代码纳入编译检查（CI 断言）', revisit: true, score: 4.4 },
  { feedbackId: 'FB-2047', source: '客户成功', domain: '权限 · 沙箱', evidence: '企业客户要求 L2 默认网络白名单为空集', priority: 'P2', status: '待归因', verify: '—', revisit: false },
  { feedbackId: 'FB-2048', source: '用户反馈', domain: '工具', evidence: '检索工具在 10 万文件工作区超时（P95 62s）', priority: 'P1', status: '处理中', verify: '索引优化已合并，待观察一个窗口', revisit: false },
  { feedbackId: 'FB-2049', source: '支持工单', domain: '前端', evidence: 'Web 端会话列表不刷新（同 J7 断言差异）', priority: 'P1', status: '处理中', verify: '—', revisit: false },
  { feedbackId: 'FB-2050', source: '满意度回访', domain: '成本 · 配额', evidence: '回访原话：长任务成本不可预期', priority: 'P2', status: '已闭环', verify: '成本预估卡片上线（含预算水位）', revisit: true, score: 4.1 },
  { feedbackId: 'FB-2051', source: '遥测异常', domain: '内核（循环·上下文）', evidence: '循环防护误报 2 次（阈值对相同参数过敏感）', priority: 'P1', status: '已闭环', verify: 'W36 起误报 0 次（阈值按工具族细分）', revisit: true, score: 4.3 },
  { feedbackId: 'FB-2052', source: '内部红队', domain: '平台 · 事件', evidence: '本地审计日志可被删除（红队发现）', priority: 'P0', status: '已关闭（不修复）', verify: '改为只追加 + 链式哈希校验，删除可发现（设计替代修复）', revisit: true, score: 4.5, closeReason: '「云端全量审计同步」超出客户数据驻留要求，以本地链式校验替代' },
];

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const statusFilter = ref('全部');
const pageSize = ref(8);
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '反馈存储只读副本不可达（replica 未追上主库）'));

const columns = [
  { colKey: 'feedbackId', title: 'feedbackId', width: 110 , cell: 'feedbackIdCell' },
  { colKey: 'source', title: '来源', width: 110 },
  { colKey: 'domain', title: '归因域', width: 160 },
  { colKey: 'evidence', title: '证据', width: 280 },
  { colKey: 'priority', title: '优先级', width: 90 },
  { colKey: 'status', title: '状态', width: 140 },
  { colKey: 'verify', title: '验证结果', width: 260 },
  { colKey: 'revisit', title: '满意度回访', width: 120 },
];
const isOpen = (f: Feedback) => f.status !== '已闭环' && f.status !== '已关闭（不修复）';
const filtered = computed(() => FEEDBACKS.filter((f) => statusFilter.value === '全部' || (statusFilter.value === '未闭环' ? isOpen(f) : f.status === statusFilter.value)));
const shown = computed(() => filtered.value.slice(0, pageSize.value));
const stats = computed(() => ({
  total: FEEDBACKS.length,
  closed: FEEDBACKS.filter((f) => f.status === '已闭环').length,
  open: FEEDBACKS.filter(isOpen).length,
  revisited: FEEDBACKS.filter((f) => f.revisit).length,
  avgScore: Number((FEEDBACKS.filter((f) => f.score).reduce((a, f) => a + (f.score ?? 0), 0) / FEEDBACKS.filter((f) => f.score).length).toFixed(2)),
}));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = filtered.value.length > pageSize.value ? 'EDGE_DATA' : filtered.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
}

/** 待回访条数（Markdown 与页面共用同一口径） */
function pendingRevisitCount(): number {
  return FEEDBACKS.length - stats.value.revisited;
}

/** 输出月度复盘：真实生成 Markdown 并触发下载（含未闭环清单与回访情况） */
function exportReview() {
  const openList = FEEDBACKS.filter(isOpen);
  const lines = [
    '# 反馈闭环月度复盘（2026-08）', '',
    `- 反馈总数：${stats.value.total}；已闭环：${stats.value.closed}；未闭环：${stats.value.open}；已关闭（不修复）：${FEEDBACKS.length - stats.value.closed - stats.value.open}`,
    `- 满意度回访：已回访 ${stats.value.revisited} 条，均分 ${stats.value.avgScore}（5 分制）；待回访 ${pendingRevisitCount()} 条`, '',
    '## 明细（来源 → 归因 → 处理 → 验证）', '',
    '| feedbackId | 来源 | 归因域 | 优先级 | 状态 | 验证结果 |', '| --- | --- | --- | --- | --- | --- |',
    ...FEEDBACKS.map((f) => `| ${f.feedbackId} | ${f.source} | ${f.domain} | ${f.priority} | ${f.status} | ${f.verify} |`), '',
    '## 未闭环反馈（必须逐条给出下一步与预期时间）', '',
    ...(openList.length ? openList.map((f) => `- ${f.feedbackId}（${f.domain}，${f.priority}）：${f.evidence} → 下一步：补充归因/验证，责任域已确认`) : ['- （无未闭环反馈）']), '',
    '## 结论', '',
    '- 未闭环反馈禁止在复盘中「口头关闭」，必须见到验证证据；P0 类允许升级为质量门禁项。',
    '- 回访未完成不影响闭环判定，但需在下一月度复盘前补齐。',
  ].join('\n');
  const file = downloadText(lines, 'oc-feedback-review-2026-08.md');
  MessagePlugin.success(`月度复盘已下载：${file}（含 ${openList.length} 条未闭环清单）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader title="反馈闭环" desc="所有反馈走同一条链路：来源 → 归因域 → 处理 → 验证；未闭环高亮且不得口头关闭；满意度回访作为闭环后的独立标记。" volume="卷 26" manifest="Y-04" cli="oc quality feedback list --status open && oc quality feedback review --month 2026-08 --out review.md" :status="[{ label: `未闭环 ${stats.open}`, theme: stats.open ? 'warning' : 'success' }, { label: `回访 ${stats.revisited} / ${stats.total}`, theme: 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="exportReview">输出月度复盘</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="反馈总数" :value="stats.total" format="number" icon="chat-bubble" hint="六个来源统一归口" />
      <StatCard label="未闭环" :value="stats.open" format="number" icon="error" :lower-is-better="true" hint="处理中 / 待归因：列表高亮" />
      <StatCard label="已回访" :value="stats.revisited" format="number" icon="smile" hint="回访是标记而非闭环前置条件" />
      <StatCard label="回访均分" :value="stats.avgScore" format="raw" unit="分" :target="4" target-kind="min" icon="star" hint="5 分制；低于 4 分进入质量周会" />
    </div>

    <div class="oc-flex oc-flex--wrap" style="gap: 8px">
      <Select v-model="statusFilter" :options="['全部', '未闭环', '已闭环', '已关闭（不修复）'].map((v) => ({ label: v, value: v }))" style="width: 200px" aria-label="状态过滤" />
      <CliHint command="oc quality feedback list --status open --with-evidence" label="等价命令" />
      <span class="oc-muted" style="font-size: 12px">当前过滤：{{ filtered.length }} 条 / 共 {{ FEEDBACKS.length }} 条</span>
    </div>

    <StateShell :state="state" empty-title="没有匹配的反馈" empty-desc="当前状态过滤下没有记录；可切换为「未闭环」查看待处理项。" empty-action="切换为未闭环" example-task="查看 FB-2044 的归因与验证进展（首 token 变慢）" :what="'反馈列表加载失败'" :why="err.message" how="可重试；失败期间反馈采集不受影响（写入侧有本地队列），恢复后自动追平。" :trace-id="err.traceId" :collapsed-summary="`共 ${filtered.length} 条反馈，已折叠展示前 ${pageSize} 条`" :page-size="pageSize" @retry="refresh" @load-more="pageSize = filtered.length" @empty-action="statusFilter = '未闭环'">
      <div class="oc-card">
        <div class="oc-card__title">闭环追踪表（未闭环行高亮；已关闭需给出不修复理由）</div>
        <Table row-key="feedbackId" size="small" :data="shown" :columns="columns">
          <template #feedbackIdCell="{ row }"><span class="oc-mono" :style="isOpen(row) ? 'color: var(--td-warning-color)' : ''">{{ row.feedbackId }}</span></template>
          <template #source="{ row }"><Tag size="small" variant="light-outline">{{ row.source }}</Tag></template>
          <template #priority="{ row }"><Tag size="small" variant="light-outline" :theme="row.priority === 'P0' ? 'danger' : row.priority === 'P1' ? 'warning' : 'default'">{{ row.priority }}</Tag></template>
          <template #status="{ row }">
            <Tooltip :content="row.closeReason ?? (isOpen(row) ? '未闭环：必须见到验证证据才能关闭' : '已闭环：验证证据已归档')">
              <Tag size="small" variant="light-outline" :theme="isOpen(row) ? 'warning' : row.status === '已闭环' ? 'success' : 'default'">{{ isOpen(row) ? `${row.status} · 未闭环` : row.status }}</Tag>
            </Tooltip>
          </template>
          <template #revisit="{ row }"><Tag size="small" variant="light-outline" :theme="row.revisit ? 'success' : 'default'">{{ row.revisit ? `已回访${row.score ? ` ${row.score}` : ''}` : '待回访' }}</Tag></template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">未闭环清单（{{ stats.open }} 条，不得口头关闭）</div>
        <div v-for="f in FEEDBACKS.filter(isOpen)" :key="f.feedbackId" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
          <Tag size="small" variant="light-outline" :theme="f.priority === 'P0' ? 'danger' : 'warning'">{{ f.feedbackId }} · {{ f.priority }}</Tag>
          <span style="font-size: 12px">{{ f.domain }}：{{ f.evidence }}</span>
        </div>
        <div class="oc-divider" />
        <InfoGrid :columns="2" :items="[
          { key: 'rule', label: '关闭规则', value: '必须附验证证据（回归用例 / 截图 / 指标）；无证据只能标注「不修复」并给出理由' }, { key: 'sla', label: '时限', value: 'P0 ≤3 天、P1 ≤7 天、P2 ≤30 天；超时自动升级到质量周会' },
        ]" />
        <div class="oc-flex" style="margin-top: 8px; gap: 6px">
          <CopyableId id="trace-feedback-2026-08-a71c" label="复制复盘快照 traceId" />
          <span class="oc-muted" style="font-size: 12px">月度复盘输出为 Markdown 下载（真实生成文件）；导出内容含本表全部口径。</span>
        </div>
      </div>
    </StateShell>
  </div>
</template>
