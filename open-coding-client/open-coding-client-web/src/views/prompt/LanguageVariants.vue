<script setup lang="ts">
/**
 * 多语言变体（M-23 / 卷 04 D-PRM-6）：资产 × 语言矩阵（zh-CN / en-US / 默认）；回退链 zh-CN → en-US → 默认，
 * 缺失即回退并显式标注「已回退」；模型回答语言由会话设置决定，与 UI 语言解耦；
 * 附新增变体表单（缺必填变量时报字段级中文错误）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Table, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import type { PageState } from '@/components/gateway/types';
import { modelData } from '@/mock/data/model';
import type { LanguageVariantData } from '@/mock/data/model';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { languageVariants } = modelData;
const state = ref<PageState>('LOADING');
const sessionLang = ref('zh-CN');
const pageSize = ref(3);
const err = ref(makeError('NOT_FOUND', '变体索引缺失（语言索引分片未加载）'));
const LANG_OPTIONS = ['zh-CN', 'en-US', '默认'];
const langOpts = LANG_OPTIONS.map((l) => ({ label: l, value: l }));
type Variant = LanguageVariantData['variants'][number];
const STATUS_META: Record<Variant['status'], { label: string; theme: 'success' | 'warning' | 'danger' }> = {
  published: { label: '已发布', theme: 'success' }, stale: { label: '过时（待更新）', theme: 'warning' }, missing: { label: '缺失', theme: 'danger' },
};

/** 回退链求值：请求语言 → zh-CN → en-US → 默认；仅跳过「缺失」，过时变体照常命中并标注待更新 */
function resolveChain(v: LanguageVariantData, lang: string) {
  for (const l of [lang, ...v.fallbackChain.filter((x) => x !== lang)]) {
    if (v.variants.some((x) => x.lang === l && x.status !== 'missing')) {
      return { source: l, fallback: l !== lang, reason: l !== lang ? `请求语言 ${lang} 变体缺失 → 沿回退链取值（已显式标注）` : `请求语言 ${lang} 直接命中，无回退` };
    }
  }
  return { source: '无可用变体', fallback: false, reason: '回退链全部缺失：发布被阻断，需补齐默认变体' };
}
const cellOf = (v: LanguageVariantData, lang: string) => {
  const item = v.variants.find((x) => x.lang === lang); const meta = STATUS_META[item?.status ?? 'missing'];
  return { version: item?.version ?? '—', statusLabel: meta.label, theme: meta.theme };
};
const matrixRows = computed(() =>
  languageVariants.map((v) => {
    const r = resolveChain(v, sessionLang.value);
    return { id: v.assetId, assetName: v.assetName, assetId: v.assetId, zh: cellOf(v, 'zh-CN'), en: cellOf(v, 'en-US'), def: cellOf(v, '默认'), source: r.source, fallback: r.fallback, reason: r.reason, note: v.note };
  }),
);
const missingCount = computed(() => languageVariants.reduce((a, v) => a + v.variants.filter((x) => x.status === 'missing').length, 0));
const staleCount = computed(() => languageVariants.reduce((a, v) => a + v.variants.filter((x) => x.status === 'stale').length, 0));
const fallbackCount = computed(() => matrixRows.value.filter((r) => r.fallback).length);
const shownRows = computed(() => matrixRows.value.slice(0, pageSize.value));
/** 矩阵列：三列语言 + 一列「本次解析」（列标题随会话语言变化） */
const matrixColumns = computed(() => [
  { colKey: 'assetName', title: '资产', width: 220 }, { colKey: 'zh', title: 'zh-CN', width: 190 },
  { colKey: 'en', title: 'en-US', width: 190 }, { colKey: 'def', title: '默认', width: 190 }, { colKey: 'source', title: `本次解析（${sessionLang.value}）`, ellipsis: true },
]);

/** 新增变体：必填变量契约（缺失时保存被拒绝，错误定位到内容字段） */
const REQUIRED_VARS: Record<string, string[]> = {
  'frag-zh-tone': ['{{tone}}'], 'tpl-coding-default': ['{{repo}}', '{{acceptance}}'], 'frag-en-tone': ['{{tone}}'], 'frag-commit-convention': ['{{ticket}}'],
};
const draftAsset = ref('tpl-coding-default'); const draftLang = ref('en-US');
const draftContent = ref(''); const fieldError = ref('');
const requiredVars = computed(() => REQUIRED_VARS[draftAsset.value] ?? []);

function saveVariant() {
  const missing = requiredVars.value.filter((x) => !draftContent.value.includes(x));
  if (!draftContent.value.trim()) { fieldError.value = '内容不能为空：空变体会让该语言在回退链上失效'; return; }
  if (missing.length) { fieldError.value = `缺少必填变量：${missing.join('、')}（保存被拒绝，补齐后可重试）`; return; }
  fieldError.value = '';
  MessagePlugin.success(`已保存 ${draftAsset.value} 的 ${draftLang.value} 变体（草稿态，发布前需通过评测）`);
}

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = languageVariants.length === 0 ? 'EMPTY' : matrixRows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL'; }, 240);
}
onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="多语言变体"
      desc="回退链 zh-CN → en-US → 默认：请求语言缺失即回退并在界面显式标注「已回退」，不做静默跨语言替换。模型回答语言由会话设置决定，与 UI 语言解耦。"
      volume="卷 04" manifest="M-23" cli="oc prompt variants matrix --session-lang zh-CN --show-fallback"
      :status="[{ label: `缺失 ${missingCount} 个变体`, theme: missingCount ? 'danger' : 'success' }, { label: `过时 ${staleCount} 个`, theme: staleCount ? 'warning' : 'success' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <CliHint command="oc prompt variants resolve --asset frag-en-tone --session-lang zh-CN" label="试算回退结果" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="变体资产" :value="languageVariants.length" format="raw" icon="browse" hint="每个资产独立维护三份语言变体" />
      <StatCard label="当前会话语言回退" :value="fallbackCount" format="raw" icon="refresh" :hint="`会话语言 ${sessionLang}：回退在命中单元格显式标注`" />
      <StatCard label="缺失变体" :value="missingCount" format="raw" icon="close" hint="缺失即沿回退链取值；默认语言不得缺失" />
      <StatCard label="过时变体" :value="staleCount" format="raw" icon="time" hint="过时仍命中但标注「变体过时」，并列入更新队列" />
    </div>

    <StateShell
      :state="state" empty-title="没有多语言变体资产" empty-desc="变体矩阵为空（异常态：默认语言变体缺失会阻断全部会话装配）。"
      empty-action="重新加载变体索引" example-task="为 frag-en-tone 补齐 zh-CN 变体，验证回退链恢复"
      :what="'变体索引加载失败'" :why="err.message" how="失败时保留上次成功矩阵（fail-safe）：装配继续使用缓存变体，回退结论按缓存版本标注。"
      :trace-id="err.traceId" :collapsed-summary="`矩阵共 ${matrixRows.length} 行，已折叠展示前 ${pageSize} 行`" :page-size="pageSize"
      @retry="refresh" @load-more="pageSize = matrixRows.length" @empty-action="refresh()"
    >
      <div class="oc-flex oc-flex--wrap">
        <Select v-model="sessionLang" size="small" style="width: 160px" :options="LANG_OPTIONS.map((l) => ({ label: `会话语言：${l}`, value: l }))" aria-label="选择会话语言" />
        <span class="oc-secondary" style="font-size: 12px">会话语言决定模型回答语言（与界面 UI 语言无关）；「本次解析」列按该语言求值。</span>
      </div>

      <div class="oc-card" style="margin-top: 8px">
        <div class="oc-card__title">资产 × 语言矩阵（版本 / 状态 / 回退）</div>
        <Table row-key="id" size="small" :data="shownRows" :columns="matrixColumns">
          <template #assetName="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <span>{{ row.assetName }}</span>
              <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.assetId }}</span>
            </div>
          </template>
          <template #zh="{ row }">
            <span class="oc-mono" style="font-size: 12px">{{ row.zh.version }}</span><Tag size="small" variant="light-outline" :theme="row.zh.theme" style="margin-left: 4px">{{ row.zh.statusLabel }}</Tag>
          </template>
          <template #en="{ row }">
            <span class="oc-mono" style="font-size: 12px">{{ row.en.version }}</span><Tag size="small" variant="light-outline" :theme="row.en.theme" style="margin-left: 4px">{{ row.en.statusLabel }}</Tag>
          </template>
          <template #def="{ row }">
            <span class="oc-mono" style="font-size: 12px">{{ row.def.version }}</span><Tag size="small" variant="light-outline" :theme="row.def.theme" style="margin-left: 4px">{{ row.def.statusLabel }}</Tag>
          </template>
          <template #source="{ row }">
            <Tooltip :content="row.note">
              <span class="oc-flex oc-flex--wrap" style="gap: 4px">
                <span class="oc-mono" style="font-size: 12px">{{ row.source }}</span>
                <Tag size="small" variant="light-outline" :theme="row.fallback ? 'warning' : 'success'">{{ row.fallback ? '已回退' : '直接命中' }}</Tag>
                <span class="oc-secondary" style="font-size: 12px">{{ row.reason }}</span>
              </span>
            </Tooltip>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">回退链与「已回退」语义</div>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'chain', label: '回退链', value: 'zh-CN → en-US → 默认', mono: true }, { key: 'rule', label: '触发条件', value: '仅当变体「缺失」时回退；「过时」变体照常命中并标注待更新' },
              { key: 'decouple', label: '与 UI 语言解耦', value: '模型回答语言由会话设置决定；界面语言只影响界面文案，不改变变体求值' },
              { key: 'label', label: '显式标注', value: '回退结果带「已回退」标签与命中来源语言，审计可追溯回退链每一步' }, { key: 'default', label: '默认变体约束', value: '默认变体缺失时发布被阻断（回退链末端不可为空）' },
            ]"
          />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">新增变体（缺必填变量时字段级报错）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Select v-model="draftAsset" size="small" style="width: 200px" :options="languageVariants.map((v) => ({ label: v.assetName, value: v.assetId }))" aria-label="选择资产" />
            <Select v-model="draftLang" size="small" style="width: 140px" :options="langOpts" aria-label="选择语言" />
          </div>
          <div class="oc-muted" style="font-size: 12px; margin: 6px 0 4px">必填变量：<span class="oc-mono">{{ requiredVars.join('、') || '无' }}</span></div>
          <Textarea v-model="draftContent" :status="fieldError ? 'error' : 'default'" :tips="fieldError" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="粘贴变体内容（必须包含全部必填变量占位符）" aria-label="变体内容" />
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <Button size="small" theme="primary" @click="saveVariant">保存变体</Button>
            <span class="oc-secondary" style="font-size: 12px">保存后为草稿态；发布需通过评测门控（覆盖率 ≥ 90% 且必填变量齐全）。</span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
