<script setup lang="ts">
/**
 * 审计日志（N-04）：六类过滤 + 哈希链校验 + 导出（脱敏预览）+ 时间线。
 * 溯源：卷 24 §4.3 / 卷 16 §4.7
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import { downloadJson } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { AuditEvent } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED' | 'EDGE_DATA'>('LOADING');
const cats = ['身份', '权限', '密钥', '沙箱', '数据', '配置'] as const;
const catFilter = ref<string>('all');
const tierFilter = ref<string>('all');
const pageSize = 12;
const selectedId = ref(d.audits[0].id);
const selected = computed(() => d.audits.find((a) => a.id === selectedId.value) ?? d.audits[0]);
const filtered = computed(() => d.audits.filter((a) => (catFilter.value === 'all' || a.category === catFilter.value) && (tierFilter.value === 'all' || a.tier === tierFilter.value)));
const paged = computed(() => filtered.value.slice(0, pageSize));
const isEdge = computed(() => filtered.value.length > pageSize);
const byCat = computed(() => cats.map((c) => ({ name: c, value: d.audits.filter((a) => a.category === c).length })));
const denied = computed(() => d.audits.filter((a) => a.result === 'DENY').length);
const chainOk = computed(() => d.audits.every((a) => a.chainVerified));
/** 导出记录用 ref 渲染：导出后列表与计数即时刷新（同时写回领域数据） */
const exportRows = ref(d.auditExports);
/** 最近一次哈希链校验结果：校验完成后即时反映到指标卡 */
const chainCheck = ref<{ at: string; verified: number; broken: number } | null>(null);
const chainChecking = ref(false);

function openRow(row: AuditEvent) { selectedId.value = row.id; }

/** 校验哈希链：逐条核对链上校验位并汇总结果（校验类动作，非只弹提示） */
function verifyChain() {
  chainChecking.value = true;
  MessagePlugin.info('正在校验哈希链…');
  window.setTimeout(() => {
    const broken = d.audits.filter((a) => !a.chainVerified).length;
    chainCheck.value = { at: new Date().toISOString(), verified: d.audits.length - broken, broken };
    chainChecking.value = false;
    // 链断裂属 SEV2 安全事件，文案显式给出结论与处置方向
    MessagePlugin.success(`哈希链校验完成：${d.audits.length - broken}/${d.audits.length} 段连续校验通过，${broken} 段异常`);
  }, 520);
}

/** 导出（脱敏预览）：按当前过滤结果生成脱敏 JSON，并登记一条导出记录 */
function exportRedacted() {
  const rows = filtered.value.map((a) => ({ ...a, ip: a.ip.replace(/\.\d+\.\d+$/, '.***.***'), detail: (a.detail ?? '').replace(/workspace ws-\d+/g, 'workspace ws-****') }));
  const categories = [...new Set(filtered.value.map((a) => a.category))];
  const times = filtered.value.map((a) => a.at).sort();
  const range = filtered.value.length ? `${new Date(times[0]).toLocaleDateString('zh-CN')} ~ ${new Date(times[times.length - 1]).toLocaleDateString('zh-CN')}` : '（无匹配事件）';
  const file = downloadJson({ range, categories, rows }, `audit-export-redacted-${Date.now()}.json`);
  exportRows.value.unshift({ id: `ax-${exportRows.value.length + 1}`, at: new Date().toISOString(), range, categories, format: 'JSON', rows: rows.length, redactedFields: ['ip（后两段）', '工作区路径'], status: 'READY', requestedBy: '当前操作者（演示）', downloadUrl: `本地下载：${file}`, note: '导出内容为当前过滤结果，已强制脱敏' });
  MessagePlugin.success('已生成 ' + file);
}

onMounted(() => {
  setTimeout(() => {
    state.value = filtered.value.length ? (isEdge.value ? 'EDGE_DATA' : 'NORMAL') : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="审计日志"
      desc="三级审计（安全 / 业务 / 使用）以安全六类为主：身份、权限、密钥、沙箱、数据、配置；哈希链保证不可篡改，导出强制脱敏。"
      volume="卷 24"
      manifest="N-04"
      cli="oc audit query --category 权限 --verify-chain --json"
      :status="[{ label: '不可篡改（哈希链）', theme: 'success' }, { label: '导出需脱敏', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="chainChecking" @click="verifyChain">校验哈希链</Button>
        <Button size="small" theme="primary" @click="exportRedacted">导出（脱敏预览）</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      :collapsed-summary="`共 ${filtered.length} 条审计事件，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      missing-permission="audit.read"
      risk-level="R2"
      apply-path="审计为受限数据：请在「角色与权限 → 申请授权」提交（审计员角色或临时授权）"
      empty-title="没有匹配的审计事件"
      empty-desc="可放宽类别或级别过滤；审计不可篡改，不会因查询为空而删除任何记录。"
      empty-action="清空过滤"
      example-task="查询最近 24 小时的 DENY 决策并核对哈希链"
      what="审计查询失败"
      why="查询缺少租户条件被持久层强制拦截（跨租户零泄漏红线），或哈希链校验中断"
      how="可重试；如为链断裂请立即按 RB-09 处置（属 SEV2 安全事件）"
      trace-id="trace-audit-9021cc"
      @retry="state = 'LOADING'"
      @load-more="state = 'NORMAL'"
      @empty-action="catFilter = 'all'; tierFilter = 'all'; state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="事件总数" :value="d.audits.length" unit="条" icon="browse" />
        <StatCard label="拒绝决策（DENY）" :value="denied" unit="条" hint="拒绝优先记录：拒绝同样留痕" />
        <StatCard label="哈希链" :value="chainOk ? '完整' : '异常'" format="raw" :target="1" target-kind="min" icon="secured" :hint="chainCheck ? `最近校验：${new Date(chainCheck.at).toLocaleTimeString('zh-CN')} · ${chainCheck.verified}/${d.audits.length} 段通过（异常 ${chainCheck.broken} 段）` : 'hashPrev → hashSelf 连续校验'" />
        <StatCard label="导出记录" :value="exportRows.length" unit="条" hint="导出行为本身记录审计" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">类别分布（六类）</div>
          <OcChart type="donut" :values="byCat" :height="200" aria-label="审计类别分布" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">筛选与导出</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <Tag size="small" :theme="catFilter === 'all' ? 'primary' : 'default'" variant="light-outline" style="cursor: pointer" @click="catFilter = 'all'">全部类别</Tag>
            <Tag v-for="c in cats" :key="c" size="small" :theme="catFilter === c ? 'primary' : 'default'" variant="light-outline" style="cursor: pointer" @click="catFilter = c">{{ c }}</Tag>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 4px; margin-top: 6px">
            <Tag v-for="t in ['all', '安全审计', '业务审计', '使用审计']" :key="t" size="small" :theme="tierFilter === t ? 'primary' : 'default'" variant="light-outline" style="cursor: pointer" @click="tierFilter = t">
              {{ t === 'all' ? '全部级别' : t }}
            </Tag>
          </div>
          <div class="oc-stack" style="margin-top: 8px">
            <div v-for="x in exportRows" :key="x.id" class="oc-flex--between">
              <span class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag size="small" :theme="x.status === 'READY' ? 'success' : x.status === 'RUNNING' ? 'primary' : 'danger'" variant="light-outline">{{ x.status }}</Tag>
                <span>{{ x.range }}</span>
                <span class="oc-muted">{{ x.format }} · {{ x.rows.toLocaleString('zh-CN') }} 行</span>
              </span>
              <Tooltip :content="`脱敏字段：${x.redactedFields.join(' / ') || '—'}`"><Tag size="small" variant="outline">脱敏预览</Tag></Tooltip>
            </div>
          </div>
          <div class="oc-state__hint">负样本：{{ d.auditExports[3].note }}</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">事件时间线（{{ filtered.length }} 条）</div>
          <CopyableId id="trace-audit-list-77a1" label="复制 traceId" />
        </div>
        <Table :data="paged" row-key="id" size="small" style="margin-top: 8px" @row-click="(ctx: { row: unknown }) => openRow(ctx.row as AuditEvent)">
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #category="{ row }"><Tag size="small" variant="outline">{{ row.category }}</Tag></template>
          <template #action="{ row }">{{ row.action }}</template>
          <template #actor="{ row }">
            <span>{{ row.actor }}</span>
            <Tag size="small" variant="outline" style="margin-left: 4px">{{ row.actorType }}</Tag>
          </template>
          <template #result="{ row }">
            <Tag size="small" :theme="row.result === 'ALLOW' ? 'success' : row.result === 'DENY' ? 'danger' : 'warning'" variant="light-outline">{{ row.result }}</Tag>
          </template>
          <template #hashSelf="{ row }">
            <Tooltip :content="`hashPrev=${row.hashPrev} → hashSelf=${row.hashSelf}（连续校验通过）`">
              <span class="oc-mono" style="font-size: 11px">{{ String(row.hashSelf).slice(0, 12) }}…</span>
            </Tooltip>
          </template>
        </Table>
        <div v-if="isEdge" class="oc-state__hint">EDGE_DATA：共 {{ filtered.length }} 条，已渲染前 {{ pageSize }} 条（cursor 分页，不静默截断）。</div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">选中事件（不可篡改证据）</div>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'id', label: '事件 ID', value: selected.id, mono: true, copyable: true },
            { key: 'tier', label: '审计级别', value: selected.tier },
            { key: 'cat', label: '类别', value: selected.category },
            { key: 'target', label: '目标资源', value: selected.target, mono: true },
            { key: 'ip', label: '来源 IP', value: selected.ip, mono: true, hint: '导出时后两段脱敏' },
            { key: 'trace', label: 'traceId', value: selected.traceId, mono: true },
            { key: 'detail', label: '详情', value: selected.detail ?? '—', span: 3 },
          ]"
        />
        <div class="oc-state__hint" style="margin-top: 6px">
          跨租户零泄漏：所有查询由持久层强制注入租户条件；跨租户数据移动仅可经显式导出/导入并留审计。
        </div>
      </div>
    </StateShell>
  </div>
</template>
