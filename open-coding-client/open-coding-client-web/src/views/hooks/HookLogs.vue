<script setup lang="ts">
/**
 * 钩子执行日志（H-06）：executed / blocked / rewritten 明细 + 改写 diff + 阻断理由。
 * 溯源：卷 17 §6 事件（hook.executed / blocked / rewritten / failed / disabled）。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { HOOK_RESULT_LABEL, HOOK_RESULT_THEME, fmtMs, useExtList, type TagTheme } from '@/components/extension/useExtList';
import { downloadText } from '@/utils/download';

const route = useRoute();
const router = useRouter();

/** 展平：执行记录 × 钩子（点 / 结果 / 耗时 / diff / 理由） */
const rows = computed(() =>
  extensionData.hooks.flatMap((h) =>
    h.executions.map((e) => ({ ...e, hookId: h.id, hookName: h.name, scope: h.scope, capability: h.capability })),
  ),
);

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(rows.value, {
  persistKey: 'hook-logs',
  pageSize: 14,
  match: (e, kw, f) => {
    const byResult = f === 'all' || e.result === f;
    const byHook = !String(route.query.id ?? '') || e.hookId === String(route.query.id);
    return byResult && byHook && (!kw || `${e.hookId}${e.hookName}${e.point}${e.reason}`.toLowerCase().includes(kw));
  },
});

const resultOptions = [
  { label: '全部结果', value: 'all' },
  { label: 'pass 通过', value: 'pass' },
  { label: 'block 阻断', value: 'block' },
  { label: 'rewrite 改写', value: 'rewrite' },
  { label: 'crash 崩溃', value: 'crash' },
];

const stats = computed(() => ({
  total: rows.value.length,
  blocked: rows.value.filter((r) => r.result === 'block').length,
  rewritten: rows.value.filter((r) => r.result === 'rewrite').length,
  crashed: rows.value.filter((r) => r.result === 'crash').length,
}));

const detailOpen = ref(false);
const picked = ref<(typeof rows.value)[number] | null>(null);

function rTheme(v: string): TagTheme {
  return (HOOK_RESULT_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

function open(row: (typeof rows.value)[number]) {
  picked.value = row;
  detailOpen.value = true;
}

/** 脱敏：将 Bearer 凭据样本替换为引用式掩码，避免密钥明文随导出文件外流 */
function redactSecret(text: string): string {
  return text.replace(/Bearer\s+\S+/g, 'Bearer sk-****');
}

/** 导出日志（JSONL，含 diff 字段）：数据取自本页当前过滤结果 matched，导出前统一脱敏 */
function exportLogs() {
  const filename = `oc-hooks-logs-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.jsonl`;
  const lines = matched.value.map((r) =>
    JSON.stringify({
      ...r,
      diff: r.diff ? { ...r.diff, before: redactSecret(r.diff.before) } : undefined,
    }),
  );
  downloadText(lines.join('\n'), filename);
  MessagePlugin.success(`已导出日志（${filename}，${lines.length} 条）`);
}

const columns = [
  { colKey: 'at', title: '时间', width: 175 },
  { colKey: 'hook', title: '钩子', width: 230 },
  { colKey: 'point', title: '钩子点', width: 210 },
  { colKey: 'result', title: '结果', width: 130 },
  { colKey: 'duration', title: '耗时', width: 110 },
  { colKey: 'reason', title: '判定理由' },
  { colKey: 'ops', title: '明细', width: 100 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="钩子执行日志"
      desc="executed / blocked / rewritten 全量留痕；阻断附理由，改写附 diff（含字段与校验结果）。"
      volume="卷 17" manifest="H-06" cli="oc hooks logs --result blocked --tail 200"
      :status="[{ label: `阻断 ${stats.blocked} · 改写 ${stats.rewritten}`, theme: 'warning' }, { label: '全量审计', theme: 'success' }]"
    >
      <template #actions>
        <Button v-if="route.query.id" size="small" variant="text" @click="router.push('/extension/hooks/logs')">清除钩子过滤</Button>
        <Button size="small" variant="outline" @click="exportLogs">导出日志</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="记录样本" :value="stats.total" unit="条" icon="history" :trend="[10, 12, 14, 15, 16, 18, stats.total]" />
      <StatCard label="阻断" :value="stats.blocked" unit="条" icon="lock" :lower-is-better="true" hint="阻断即终止该点后续钩子" />
      <StatCard label="改写" :value="stats.rewritten" unit="条" icon="edit" hint="改写通过 Schema 校验后重新鉴权" />
      <StatCard label="崩溃（按失败策略处置）" :value="stats.crashed" unit="条" icon="error" :lower-is-better="true" hint="默认 closed：阻断；观察类 open：放行" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索钩子 / 点 / 理由" clearable style="width: 300px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="resultOptions" style="width: 180px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启 · 留存 30 天</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="14"
      empty-title="没有匹配的执行记录"
      empty-desc="默认零钩子或过滤条件过窄；钩子启用后每次触发都会产生 hook.executed 记录。"
      empty-action="清除过滤"
      example-task="查看「敏感信息扫描」最近的阻断记录与理由"
      what="执行日志加载失败"
      why="事件查询排队超时（消费者滞后 > 阈值）。"
      how="可重试；或缩短时间窗（等价命令 oc hooks logs --since 1h）。"
      trace-id="trace-hook-logs-3d18"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="keyword = ''; filter = 'all'; router.push('/extension/hooks/logs'); reload()"
    >
      <Table row-key="id" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #at="{ row }"><span class="oc-muted oc-mono" style="font-size: 12px">{{ new Date(row.at).toLocaleString('zh-CN') }}</span></template>
        <template #hook="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.hookId }}</span>
            <span style="font-size: 13px">{{ row.hookName }}</span>
          </div>
        </template>
        <template #point="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.point }}</span></template>
        <template #result="{ row }">
          <Tag size="small" :theme="rTheme(row.result)" variant="light-outline">{{ HOOK_RESULT_LABEL[row.result] }}</Tag>
        </template>
        <template #duration="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtMs(row.durationMs) }}</span></template>
        <template #reason="{ row }">
          <Tooltip :content="row.reason">
            <span class="oc-secondary oc-truncate" style="font-size: 12px; max-width: 320px; display: inline-block">{{ row.reason }}</span>
          </Tooltip>
        </template>
        <template #ops="{ row }">
          <Button size="small" variant="text" @click="open(row)">查看</Button>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="detailOpen" header="执行明细（含改写 diff）" width="680px" :footer="false">
      <template v-if="picked">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 10px">
          <Tag size="small" :theme="rTheme(picked.result)" variant="light-outline">{{ HOOK_RESULT_LABEL[picked.result] }}</Tag>
          <span class="oc-mono" style="font-size: 12px">{{ picked.point }} · {{ picked.hookId }}</span>
          <span class="oc-muted" style="font-size: 12px">耗时 {{ fmtMs(picked.durationMs) }}</span>
          <CopyableId id="trace-hook-exec-9f21" label="traceId" :short="16" />
        </div>
        <div class="oc-secondary" style="font-size: 13px; margin-bottom: 10px">{{ picked.reason }}</div>
        <div v-if="picked.diff">
          <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">改写 diff（字段 {{ picked.diff.field }}）</div>
          <div class="oc-diff">
            <div class="oc-diff__row oc-diff__row--del"><span class="oc-diff__ln">-</span><span class="oc-mono">{{ picked.diff.before }}</span></div>
            <div class="oc-diff__row oc-diff__row--add"><span class="oc-diff__ln">+</span><span class="oc-mono">{{ picked.diff.after }}</span></div>
          </div>
          <Alert
            style="margin-top: 10px"
            theme="info"
            message="改写约束"
            description="改写仅限白名单字段且必须通过 Schema 校验；校验失败则拒绝该改写并记录（不会部分生效）。"
          />
        </div>
        <div v-else>
          <JsonBlock :value="picked" label="执行记录（原始）" :collapse-over="200" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
