<script setup lang="ts">
/**
 * 安全违规与事件（B-11 / 卷 07 D-SBOX-9）：六类违规（路径越界 / 网络拒绝 / 资源超限 / 危险命令 / 密钥异常 /
 * 逃逸迹象）逐类汇总；明细抽屉展示规范化路径、来源命令、处置结果、模型二次判定与误报控制建议；
 * 重复违规自动升级（可见可审），并支持导出审计摘要 JSON（真实触发下载）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { toolData } from '@/mock/data/tool';
import type { Violation } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { violations, dangerHits, executionRecords } = toolData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(4); const drawerOpen = ref(false);
const detailKind = ref<Violation['kind'] | null>(null);
const err = ref(makeError('SANDBOX_DENIED', '违规流水读取被拒绝（审计索引分片不可达）'));

const KIND_ORDER: Violation['kind'][] = ['路径越界尝试', '网络策略拒绝', '资源超限', '危险命令命中', '密钥使用异常', '沙箱逃逸迹象'];
/** 每类违规的边界来源与误报控制建议（抽屉内呈现） */
const KIND_META: Record<Violation['kind'], { guard: string; advice: string }> = {
  路径越界尝试: { guard: '文件系统围栏 SBOX-PATH-01', advice: '对高频跨区路径开放「候选加白」入口，并对符号链接目标做规范化提示，减少「盲试 → 拒绝」循环' },
  网络策略拒绝: { guard: '出网策略 NET-007 / NET-011', advice: '拒绝文案内附「申请加白」入口与本次依据条目；重复域名自动生成候选评审单' },
  资源超限: { guard: '资源限制 RL-MEM-01 / RL-CPU-02', advice: '执行前预检声明参数（如 -Xmx）与硬限比对，给出建议参数而非事后终止' },
  危险命令命中: { guard: '危险命令规则 DR-004 / DR-009', advice: '语义可解释的命令转「模型二次判定」并与判定理由一起留痕，避免一律硬阻断' },
  密钥使用异常: { guard: '凭证代理 CIN-5003', advice: '批量读取环境变量类命令默认脱敏值输出；同一会话重复枚举直接回收注入令牌' },
  沙箱逃逸迹象: { guard: '逃逸检测 NET-011 + 逃逸链路评估', advice: '零容忍：不适用误报豁免；仅允许在演练环境复盘检测规则（见逃逸处置页）' },
};

const kindRows = computed(() =>
  KIND_ORDER.map((kind) => {
    const rows = violations.filter((v) => v.kind === kind);
    const latest = [...rows].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return {
      kind, guard: KIND_META[kind].guard, count: rows.length, lastAt: latest?.at ?? '', handling: latest?.handling ?? '—',
      repeated: rows.reduce((a, r) => a + r.repeated, 0), escalated: rows.some((r) => r.escalated),
      severity: rows.some((r) => r.severity === 'P0') ? 'P0' : rows.some((r) => r.severity === 'P1') ? 'P1' : 'P2',
    };
  }),
);
const shown = computed(() => kindRows.value.slice(0, pageSize.value));
const escalatedCount = computed(() => violations.filter((v) => v.escalated).length);

/** 抽屉取该类最近一条违规实例，并关联执行记录与模型二次判定 */
const activeViolation = computed(() => (detailKind.value ? [...violations].filter((v) => v.kind === detailKind.value).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0] : null));
const activeCommand = computed(() => executionRecords.find((e) => e.callId === activeViolation.value?.callId)?.command ?? '（无关联执行记录）');
const activeOpinion = computed(() => dangerHits.find((h) => h.callId === activeViolation.value?.callId)?.modelSecondOpinion ?? '（未触发模型二次判定：命中硬处置规则）');
const sameKind = computed(() => (detailKind.value ? violations.filter((v) => v.kind === detailKind.value) : []));

function openDetail(kind: Violation['kind']) {
  detailKind.value = kind; drawerOpen.value = true;
}

/** 导出审计摘要：真实生成 JSON 文件并触发下载（Blob + objectURL + a.download） */
function exportAudit() {
  const payload = {
    exportedAt: new Date().toISOString(), window: '近 24h', total: violations.length, escalated: escalatedCount.value, kinds: kindRows.value,
    records: violations.map((v) => ({ id: v.violationId, kind: v.kind, severity: v.severity, at: v.at, callId: v.callId, normalizedPath: v.normalizedPath, handling: v.handling, repeated: v.repeated, escalated: v.escalated, traceId: v.traceId })),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `oc-sandbox-violations-${Date.now()}.json`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  MessagePlugin.success(`审计摘要已下载：${violations.length} 条违规 / ${escalatedCount.value} 条已升级（含 traceId）`);
}

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = kindRows.value.length === 0 ? 'EMPTY' : kindRows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL'; }, 240);
}
onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="安全违规与处置"
      desc="六类边界违规统一记账：每次拒绝都带规范化路径 / 命令 ID / 处置结果与 traceId；同一主体同类重复违规自动升级通知，升级不改变原始处置结论。"
      volume="卷 07" manifest="B-11" cli="oc sandbox violations list --since 24h && oc sandbox violations export --out audit.json"
      :status="[{ label: `六类覆盖 ${KIND_ORDER.length} / 6`, theme: 'primary' }, { label: `已升级 ${escalatedCount} 条`, theme: escalatedCount ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="exportAudit">导出审计摘要</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="违规总数（24h）" :value="violations.length" format="raw" icon="error" hint="全部为「先拒绝后说明」，不存在静默放行" />
      <StatCard label="P0 违规" :value="violations.filter((v) => v.severity === 'P0').length" format="raw" icon="secured" hint="含密钥异常与逃逸迹象，处置后逐条人工复核" />
      <StatCard label="重复违规升级" :value="escalatedCount" format="raw" icon="notification" hint="同类重复 ≥2 次 → 自动升级并通知安全值班" />
      <StatCard label="关联危险命令命中" :value="dangerHits.length" format="raw" icon="bug" hint="其中 3 条经模型二次判定（含 1 条误报申诉）" />
    </div>

    <StateShell
      :state="state" empty-title="没有违规记录" empty-desc="近 24h 未产生违规（空列表不代表无边界：围栏与策略仍在生效）。"
      empty-action="重新拉取违规流水" example-task="用 cat ../../.ssh/id_rsa 验证路径越界拒绝与规范化路径记录"
      :what="'违规流水加载失败'" :why="err.message" how="读取失败时保持上次快照（fail-safe）；运行中的围栏不受影响，页面标注数据可能滞后。"
      :trace-id="err.traceId" :collapsed-summary="`六类汇总共 ${kindRows.length} 行，已折叠展示前 ${pageSize} 行`" :page-size="pageSize"
      @retry="refresh" @load-more="pageSize = kindRows.length" @empty-action="refresh()"
    >
      <div class="oc-card">
        <div class="oc-card__title">六类违规汇总（每类一行）</div>
        <Table
          row-key="kind" size="small" :data="shown"
          :columns="[
            { colKey: 'kind', title: '违规类型', width: 150 }, { colKey: 'guard', title: '边界来源', width: 240 },
            { colKey: 'count', title: '次数', width: 80 }, { colKey: 'lastAt', title: '最近时间', width: 180 },
            { colKey: 'handling', title: '处置', ellipsis: true }, { colKey: 'repeated', title: '重复次数', width: 100 },
            { colKey: 'escalated', title: '升级通知', width: 110 }, { colKey: 'ops', title: '明细', width: 90 },
          ]"
        >
          <template #kind="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <span>{{ row.kind }}</span>
              <Tag size="small" variant="light-outline" :theme="row.severity === 'P0' ? 'danger' : row.severity === 'P1' ? 'warning' : 'default'">最高 {{ row.severity }}</Tag>
            </div>
          </template>
          <template #guard="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.guard }}</span></template>
          <template #lastAt="{ row }">{{ row.lastAt ? new Date(row.lastAt).toLocaleString('zh-CN') : '—' }}</template>
          <template #handling="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.handling }}</span></template>
          <template #repeated="{ row }">{{ row.repeated }} 次</template>
          <template #escalated="{ row }"><Tag size="small" variant="light-outline" :theme="row.escalated ? 'warning' : 'default'">{{ row.escalated ? '已升级通知' : '未升级' }}</Tag></template>
          <template #ops="{ row }"><Button size="small" variant="text" @click="openDetail(row.kind)">详情</Button></template>
        </Table>
        <CliHint command="oc sandbox violations list --kind 路径越界尝试 --show-normalized-path" label="查看该类原始流水" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">重复违规自动升级</div>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'trigger', label: '触发条件', value: '同一主体 + 同一违规类型，24h 内重复 ≥2 次' }, { key: 'action', label: '升级动作', value: '生成高优安全事件 + P0 通知安全值班 + 强制人工复核（未见复核不关闭）' },
            { key: 'keep', label: '原始结论', value: '升级只增加处置层级，不改变原始「拒绝 / 降级」结论（不静默放宽）' }, { key: 'evidence', label: '升级证据', value: '重复计数、首次与最近时间、规范化路径与命令 ID 一并写入事件' },
          ]"
        />
      </div>
    </StateShell>

    <Drawer v-model:visible="drawerOpen" :header="`违规明细 · ${detailKind ?? ''}`" size="620px" :footer="false">
      <InfoGrid
        :columns="1"
        :items="[
          { key: 'path', label: '规范化路径', value: activeViolation?.normalizedPath ?? '（不涉及路径：非文件系统类违规）' },
          { key: 'cmd', label: '来源命令 ID', value: activeViolation?.callId ?? '—', copyable: true },
          { key: 'cmdText', label: '来源命令', value: activeCommand, block: true, mono: true },
          { key: 'tier', label: '沙箱档位', value: activeViolation?.tier ?? '—' },
          { key: 'handling', label: '处置结果', value: activeViolation?.handling ?? '—' },
          { key: 'opinion', label: '模型二次判定结论', value: activeOpinion },
          { key: 'advice', label: '误报控制建议', value: detailKind ? KIND_META[detailKind].advice : '—' },
          { key: 'evidence', label: '判定证据', value: activeViolation?.evidence ?? '—' },
        ]"
      />
      <div class="oc-divider" />
      <div class="oc-card__title">同类明细（{{ sameKind.length }} 条）</div>
      <div v-for="v in sameKind" :key="v.violationId" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
        <span class="oc-mono" style="font-size: 12px">{{ v.violationId }}</span>
        <Tag size="small" variant="light-outline" :theme="v.severity === 'P0' ? 'danger' : v.severity === 'P1' ? 'warning' : 'default'">{{ v.severity }}</Tag>
        <span class="oc-muted" style="font-size: 12px">{{ new Date(v.at).toLocaleString('zh-CN') }}</span>
        <Tag size="small" variant="light-outline" :theme="v.escalated ? 'warning' : 'default'">{{ v.escalated ? `重复 ${v.repeated} 次 · 已升级` : `重复 ${v.repeated} 次` }}</Tag>
        <CopyableId :id="v.traceId" label="复制 traceId" />
      </div>
    </Drawer>
  </div>
</template>
