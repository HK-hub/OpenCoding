<script setup lang="ts">
/**
 * F-01 遥测与隐私：三级独立同意（L1 使用统计 / L2 性能采样 / L3 崩溃与错误，默认全关）+ 采样率 + 本地预览 + 禁止项。
 * 硬约束：企业强制（enforcedByEnterprise）时开关置灰并说明来源；内容类字段（代码 / 提示词 / 路径原文 / 密钥 / 身份明文）永不采集。
 * 溯源：卷 28 §5.1 / BUILD-MANIFEST F-01
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import type { TelemetryConsent, TelemetryPreviewItem } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const consent = ref<TelemetryConsent[]>(d.telemetryConsent.map((c) => ({ ...c })));
/** 演示：模拟企业策略强制（真实实现读取组织策略下发状态） */
const enterpriseEnforced = ref(false);
const previewSize = ref(10);
const cleared = ref(false);
const selectedId = ref(d.telemetryPreview[0]?.id ?? '');
const enterpriseSource = '企业策略 telemetry-policy-2026-09（管理员下发，本机只读）';
const samplingOptions = [1, 10, 25, 50, 100].map((n) => ({ label: `${n}%`, value: n }));
const visiblePreview = computed(() => (cleared.value ? [] : d.telemetryPreview.slice(0, previewSize.value)));
const selected = computed<TelemetryPreviewItem | null>(() => visiblePreview.value.find((p) => p.id === selectedId.value) ?? visiblePreview.value[0] ?? null);
const forbidden = computed(() => consent.value[0]?.forbidden ?? []);
/** 是否被强制：企业全局强制或该等级单独强制 */
const enforced = (c: TelemetryConsent) => enterpriseEnforced.value || c.enforcedByEnterprise;

function toggle(c: TelemetryConsent, v: unknown) {
  if (enforced(c)) { MessagePlugin.error(`${c.level} 由企业策略强制：开关置灰不可更改（来源：${enterpriseSource}）`); return; }
  c.enabled = Boolean(v);
  c.changedBy = '当前用户（本地设置）';
  c.lastChangedAt = new Date().toISOString();
  MessagePlugin.success(`${c.level} 已${c.enabled ? '开启' : '关闭'}：逐级独立同意，可随时变更`);
}
function setSampling(c: TelemetryConsent, v: unknown) {
  if (enforced(c)) { MessagePlugin.error(`${c.level} 采样率由企业策略锁定，客户端不可调整`); return; }
  c.samplingRatePct = Number(v);
  MessagePlugin.info(`${c.level} 采样率调整为 ${c.samplingRatePct}%（仅影响新产生的遥测数据）`);
}
function clearPreview() { cleared.value = true; MessagePlugin.success('本地预览缓冲区已清除（不影响已上报的匿名聚合数据，且不可恢复）'); }
function setPreviewSize(v: unknown) { previewSize.value = Number(v); }
function selectRow(row: TelemetryPreviewItem) { selectedId.value = row.id; }
function exportSettings() {
  downloadJson({
    enterpriseEnforced: enterpriseEnforced.value,
    consent: consent.value.map((c) => ({ level: c.level, enabled: c.enabled, samplingRatePct: c.samplingRatePct, enforcedByEnterprise: enforced(c) })),
    forbidden: forbidden.value,
  }, 'telemetry-consent.json');
  MessagePlugin.success('遥测设置已导出（JSON，含禁止项清单）');
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = consent.value.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}
onMounted(load);
</script>

<template>
  <div class="oc-page">
    <PageHeader title="遥测与隐私" volume="卷 28" manifest="F-01" cli="oc telemetry consent --level L1,L2,L3 --default off"
      desc="三级独立同意（默认全部关闭）、采样率可调、本地预览最近 N 条并一键清除；企业强制范围由策略下发且禁止包含内容字段。"
      :status="[{ label: '默认全关', theme: 'success' }, { label: '内容永不采集', theme: 'danger' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportSettings"><OcIcon name="download" size="12px" /> 导出设置</Button>
        <Select :value="previewSize" size="small" style="width: 130px" @change="setPreviewSize"
          :options="[10, 20, 50].map((n) => ({ label: `最近 ${n} 条`, value: n }))" />
      </template>
    </PageHeader>
    <StateShell :state="state" trace-id="trace-telemetry-5e0a72" empty-title="没有遥测同意记录" empty-action="开启 L1 使用统计（可随时关闭）"
      empty-desc="三级遥测默认全部关闭；未产生同意记录时不会有任何数据离开本机。"
      example-task="仅在 L3 崩溃与错误等级下上报脱敏摘要（完整转储需确认）"
      what="遥测设置加载失败" why="本地同意状态库不可读（策略文件损坏或权限不足）"
      how="可重试；读取失败时按「全部关闭」处理，绝不默认开启（Fail-Safe）" @retry="load" @empty-action="load">
      <div class="oc-grid oc-grid--4">
        <StatCard label="已开启等级" :value="consent.filter((c) => c.enabled).length" unit="/ 3" :lower-is-better="true" icon="chart-bubble" hint="默认全关；逐级独立同意" />
        <StatCard label="本地预览条数" :value="visiblePreview.length" unit="条" icon="browse" hint="预览仅在本机，可一键清除" />
        <StatCard label="禁止项" :value="forbidden.length" unit="类" :target="0" target-kind="max" icon="lock" hint="命中即本地拦截，不上报" />
        <StatCard label="匿名标识轮换" :value="consent.filter((c) => c.rotateAnonId).length ? '开启' : '关闭'" format="raw" icon="secured" hint="轮换后无法跨期关联同一用户" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">三级同意（独立开关，默认全部关闭）</div>
          <div class="oc-flex" style="gap: 8px; align-items: center">
            <span class="oc-muted" style="font-size: 12px">演示：企业策略强制</span><Switch v-model="enterpriseEnforced" size="small" />
          </div>
        </div>
        <Table :data="consent" row-key="level" size="small" style="margin-top: 8px" :columns="[
          { colKey: 'level', title: '等级', width: 150 }, { colKey: 'payload', title: '上报内容（不含内容字段）' },
          { colKey: 'enabled', title: '同意', width: 90 }, { colKey: 'sampling', title: '采样率', width: 130 }]">
          <template #level="{ row }">
            <span>{{ row.level }}</span>
            <Tag v-if="enforced(row)" size="small" theme="warning" variant="light-outline" style="margin-left: 6px">企业强制</Tag>
            <div v-else-if="row.defaultOff" class="oc-muted" style="font-size: 11px">默认关闭</div>
          </template>
          <template #payload="{ row }">
            <span class="oc-muted" style="font-size: 12px">{{ row.payload }}</span>
            <div class="oc-muted" style="font-size: 11px">最近变更：{{ new Date(row.lastChangedAt).toLocaleDateString('zh-CN') }} · {{ row.changedBy }}</div>
          </template>
          <template #enabled="{ row }"><Switch :value="row.enabled" :disabled="enforced(row)" size="small" @change="(v) => toggle(row, v)" /></template>
          <template #sampling="{ row }">
            <Select :value="row.samplingRatePct" size="small" :disabled="enforced(row)" :options="samplingOptions" @change="(v) => setSampling(row, v)" />
          </template>
        </Table>
        <div v-if="enterpriseEnforced" class="oc-state__hint" style="margin-top: 6px">
          企业强制范围由「{{ enterpriseSource }}」下发：开关置灰且不可更改。策略只能锁定等级与采样率，禁止强制开启完整转储或内容字段采集。
        </div>
        <div v-else class="oc-state__hint" style="margin-top: 6px">
          当前由用户自主控制：任一级别可单独开启或关闭；关闭后立即停止采集（已上报的匿名聚合数据无法撤回）。
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">查看将上报内容（本地预览，最近 {{ visiblePreview.length }} 条）</div>
            <Popconfirm content="清除本地预览缓冲区：清除后本机不再保留这些条目，且不可恢复（不影响已上报的匿名聚合数据）。是否继续？" @confirm="clearPreview">
              <Button size="small" theme="danger" variant="outline" :disabled="cleared"><OcIcon name="delete" size="12px" /> 一键清除</Button>
            </Popconfirm>
          </div>
          <Table :data="visiblePreview" row-key="id" size="small" style="margin-top: 8px" :columns="[
            { colKey: 'kind', title: '载荷', width: 170 }, { colKey: 'level', title: '等级', width: 140 }, { colKey: 'flag', title: '标记', width: 150 }]"
            @row-click="(ctx: { row: unknown }) => selectRow(ctx.row as TelemetryPreviewItem)">
            <template #kind="{ row }"><span>{{ row.kind }}</span><div class="oc-muted" style="font-size: 11px">{{ new Date(row.at).toLocaleString('zh-CN') }}</div></template>
            <template #level="{ row }"><Tag size="small" variant="light-outline">{{ row.level }}</Tag></template>
            <template #flag="{ row }">
              <Tag v-if="row.containsContent" size="small" theme="danger" variant="light-outline">含内容字段（已本地拦截）</Tag>
              <Tag v-else size="small" theme="success" variant="light-outline">脱敏</Tag>
            </template>
          </Table>
          <JsonBlock v-if="selected" :value="selected.fields" :label="`预览载荷（${selected.kind}）`" style="margin-top: 8px" />
          <div v-else class="oc-muted" style="font-size: 12px; margin-top: 6px">预览缓冲区已清除；新数据将在下次采集后出现。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">禁止项（永不采集，命中即拦截）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag v-for="f in forbidden" :key="f" size="small" theme="danger" variant="light-outline">{{ f }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 10px">
            代码内容与提示词正文仅采集长度分桶与错误码，正文在本地拦截；文件路径原文一律哈希化（&lt;path:短哈希&gt;）不可还原；
            密钥 / Token 字段名命中即掩码（引用式，明文永不回显）；用户标识明文永不上报，使用可轮换匿名标识；
            完整崩溃转储默认不上报（需在「崩溃上报」页逐次确认或显式「总是允许」）。
          </div>
          <CliHint command="oc telemetry preview --last 10 --redacted" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            负样本：{{ d.telemetryPreview.filter((p) => p.containsContent).length }} 条载荷在本地被拦截并改写为哈希 / 掩码，未离开本机。
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
