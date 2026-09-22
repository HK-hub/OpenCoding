<script setup lang="ts">
/**
 * 组装预览 / 调试（M-18 / 卷 04 D-PRM-2 + D-PRM-7）：
 * 渲染预览逐段来源 + 变量注入值 + 制品哈希与确定性说明（同输入 → 字节级一致）；
 * 溯源锚点 <!--seg:id@version--> 用于定位「这条规则来自哪个资产」。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import type { InfoItem } from '@/components/common/InfoGrid.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import StatePlayground from '@/components/gateway/StatePlayground.vue';
import { fmtToken, type PageState } from '@/components/gateway/types';
import { PROMPT_ASSET_TYPE_META, modelData } from '@/mock/data/model';
import type { AssemblySegmentData, PromptAssetType } from '@/mock/data/model';
import { downloadText } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const data = modelData;
const assembly = data.promptAssembly;
const state = ref<PageState>('LOADING');
const active = ref<AssemblySegmentData>(assembly.segments[0]);
const zoneFilter = ref<'ALL' | 'S1' | 'S2' | 'S9'>('ALL');

const segments = computed(() => (zoneFilter.value === 'ALL' ? assembly.segments : assembly.segments.filter((s) => s.zone === zoneFilter.value)));
const zoneTotals = computed(() =>
  (['S1', 'S2', 'S9'] as const).map((z) => {
    const segs = assembly.segments.filter((s) => s.zone === z);
    const section = data.contextSnapshot.sections.find((s) => s.id === z);
    return { zone: z, tokens: segs.reduce((a, b) => a + b.tokens, 0), sectionTokens: section?.tokens ?? 0, name: section?.name ?? '', cacheAttr: section?.cacheAttr ?? '' };
  }),
);

const columns: PrimaryTableCol[] = [
  { colKey: 'seq', title: '#', width: 60 },
  { colKey: 'zone', title: '区段', width: 90 },
  { colKey: 'source', title: '来源资产（逐段可溯源）', width: 300 },
  { colKey: 'layer', title: '层级', width: 140 },
  { colKey: 'tokens', title: 'token', width: 90 },
  { colKey: 'reason', title: '入选理由（为什么这段在这里）' },
];

const detailItems = computed<InfoItem[]>(() => [
  { key: 'asset', label: '来源资产', value: `${active.value.assetName}（${active.value.assetId}@${active.value.version}）`, mono: true },
  { key: 'type', label: '资产类型', value: active.value.sourceType === 'guardrail' ? '内建护栏' : active.value.sourceType === 'session' ? '会话临时指令' : PROMPT_ASSET_TYPE_META[active.value.sourceType as PromptAssetType].label },
  { key: 'layer', label: '生效层级', value: active.value.layer },
  { key: 'zone', label: '注入区段', value: `${active.value.zone}（${zoneTotals.value.find((z) => z.zone === active.value.zone)?.name ?? ''}）` },
  { key: 'tokens', label: 'token 占用', value: fmtToken(active.value.tokens) },
  { key: 'anchor', label: '溯源锚点', value: `<!--seg:${active.value.assetId}@${active.value.version}-->`, mono: true },
  { key: 'reason', label: '入选理由', value: active.value.reason, span: 2 },
]);

const diffFiles = computed<DiffFile[]>(() =>
  assembly.diffWithPrev.map((d) => ({
    path: `assets/${d.assetId} (${d.from} → ${d.to})`,
    additions: d.lines.filter((l) => l.type === 'add').length,
    deletions: d.lines.filter((l) => l.type === 'del').length,
    lines: d.lines.map((l, i) => ({ type: l.type, oldLine: i + 1, newLine: i + 1, text: l.text })),
    externalChanged: false,
  })),
);

const variables = computed(() => assembly.variables);
const missingVars = computed(() => variables.value.filter((v) => !v.injected));

function copyArtifact() {
  MessagePlugin.success('已复制制品哈希与版本集（可用于复现会话行为）');
}

/** 导出渲染文本：按段拼接并注入溯源锚点注释（<!--seg:id@version-->），便于按段定位劣化来源 */
function exportRendered() {
  // 头部说明写在注释里：先剔除被插入值中的注释定界符，避免提前闭合外层注释
  const note = (s: string) => s.replace(/<!--|-->/g, '');
  // 变量注入值与本页变量表同源；未注入变量显式标注，不静默省略
  const varLine = variables.value
    .map((v) => `${v.name}=${v.value || '（空）'}${v.injected ? '' : '（未注入）'}`)
    .join('；');
  const headerLines = [
    `<!-- OpenCoding 组装渲染导出 · ${note(assembly.assemblyId)} -->`,
    `<!-- 导出时间：${new Date().toLocaleString('zh-CN')}（区段筛选：${zoneFilter.value}） -->`,
    `<!-- 制品哈希：${note(assembly.artifactHash)}（上一版 ${note(assembly.previousHash)}） · 模式/模型：${note(assembly.mode)} → ${note(assembly.modelId)} -->`,
    `<!-- 总 token：${assembly.totalTokens} · 确定性：${note(assembly.determinismNote)}（${assembly.deterministicRuns} 组重复渲染哈希一致） -->`,
    `<!-- 变量注入：${note(varLine)} -->`,
    '',
  ];
  // 逐段渲染文本 + 锚点注释：评测时可按锚点定位「这条规则来自哪个资产」
  const body = assembly.segments
    .map((s) => [`<!--seg:${s.assetId}@${s.version} zone=${s.zone} layer=${s.layer} tokens=${s.tokens}-->`, s.rendered, ''].join('\n'))
    .join('\n');
  const file = downloadText([...headerLines, body].join('\n'), `oc-prompt-assembly-${assembly.assemblyId}-${new Date().toISOString().slice(0, 10)}.md`);
  MessagePlugin.success(`已导出渲染文本：${file}`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = assembly.segments.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="组装预览"
      desc="结构化组装器输出：逐段来源 + 变量注入值 + 制品哈希。确定性：同一 (版本集, 变量集, 作用域链) 必须产生字节级一致产物（100 组重复渲染校验）。"
      volume="卷 04"
      manifest="M-18"
      cli="oc prompt assemble --mode coding --session sess-9f2a --preview --hash"
      :status="[{ label: `制品哈希 ${assembly.artifactHash.slice(0, 18)}…`, theme: 'primary' }, { label: `${assembly.segments.length} 段 / ${fmtToken(assembly.totalTokens)} token`, theme: 'default' }]"
    >
      <template #actions>
        <StatePlayground v-model="state" />
        <Button size="small" variant="outline" @click="copyArtifact">复制制品哈希</Button>
        <Button size="small" variant="outline" @click="exportRendered">导出渲染文本</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="组装耗时" :value="24" unit="ms" icon="time" :target="30" target-kind="max" lower-is-better hint="组装 ≤30ms（P95，含缓存）" />
      <StatCard label="制品哈希一致性" :value="100" format="percent" icon="check" :target="100" target-kind="min" :hint="`${assembly.deterministicRuns} 组随机输入重复渲染，哈希全部一致`" />
      <StatCard label="哈希缓存命中率" :value="96.4" format="percent" icon="refresh" :target="95" target-kind="min" hint="相同输入同输出 → 可直接缓存产物" />
      <StatCard label="未注入变量" :value="missingVars.length" icon="help" :hint="missingVars.length ? missingVars.map((m) => m.name).join('、') : '全部已注入（必填缺失会 Fail-Fast）'" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有可预览的组装结果"
      empty-desc="选中会话尚未触发提示词组装；发起一次对话即可生成产物。"
      empty-action="查看资产库"
      what="组装预览加载失败"
      why="组装服务异常；为避免误导，界面不展示不完整产物（缺段的预览比没有预览更危险）。"
      how="可重试；组装失败时内核会显式报错而不是用空提示词继续。"
      trace-id="trace-asm-3f28"
      missing-permission="prompt.manage"
      risk-level="R1"
      apply-path="在「权限与审批 → 申请授权」申请 prompt.manage（只读预览可申请 R1 临时授权）"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('提示词资产页可直接预览单个资产的渲染结果')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">制品信息与确定性</div>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'hash', label: '制品哈希（artifactHash）', value: assembly.artifactHash, mono: true, copyable: true },
              { key: 'prev', label: '上一版哈希（对比用）', value: assembly.previousHash, mono: true },
              { key: 'mode', label: '模式 / 模型', value: `${assembly.mode} → ${assembly.modelId}` },
              { key: 'total', label: '总 token', value: `${fmtToken(assembly.totalTokens)}（S1 护栏 + S2 模式/角色 + S9 当前指令）` },
              { key: 'det', label: '确定性说明', value: assembly.determinismNote, block: true, span: 2 },
              { key: 'time', label: '生成时间', value: new Date(assembly.createdAt).toLocaleString('zh-CN') },
              { key: 'runs', label: '重复渲染校验', value: `${assembly.deterministicRuns} 组输入 / 100% 一致` },
            ]"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" variant="outline">无表达式执行</Tag>
            <Tag size="small" variant="outline">变量值一律转义</Tag>
            <Tag size="small" variant="outline">缺失必填变量 Fail-Fast</Tag>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">
            <span>区段对齐（与上下文快照 S1/S2/S9）</span>
            <span class="oc-muted" style="font-size: 12px">稳定前缀 = 缓存断点 1/2</span>
          </div>
          <div class="oc-stack">
            <div v-for="z in zoneTotals" :key="z.zone" class="oc-card" style="padding: 8px 10px">
              <div class="oc-flex--between">
                <span><b>{{ z.zone }}</b> {{ z.name }}</span>
                <Tag size="small" variant="light-outline">{{ z.cacheAttr }}</Tag>
              </div>
              <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
                提示词贡献 {{ fmtToken(z.tokens) }} token；该区段快照总占用 {{ fmtToken(z.sectionTokens) }} token（差额来自工具定义 / 上下文注入）
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>渲染预览（逐段来源）</span>
          <span class="oc-flex" style="gap: 4px">
            <Button size="small" :variant="zoneFilter === 'ALL' ? 'base' : 'outline'" @click="zoneFilter = 'ALL'">全部</Button>
            <Button v-for="z in ['S1', 'S2', 'S9'] as const" :key="z" size="small" :variant="zoneFilter === z ? 'base' : 'outline'" @click="zoneFilter = z">{{ z }}</Button>
          </span>
        </div>
        <Table :data="segments" :columns="columns" row-key="seq" size="small" :pagination="{ pageSize: 12, total: segments.length }" @row-click="(ctx) => (active = ctx.row as unknown as AssemblySegmentData)">
          <template #seq="{ row }"><Tag size="small" variant="outline">{{ row.seq }}</Tag></template>
          <template #zone="{ row }"><Tag size="small" variant="light-outline">{{ row.zone }}</Tag></template>
          <template #source="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <span>{{ row.assetName }}</span>
              <span class="oc-mono oc-muted" style="font-size: 12px">{{ row.assetId }}@{{ row.version }}</span>
            </div>
          </template>
          <template #layer="{ row }">
            <Tag :theme="row.layer === 'L0' ? 'danger' : row.layer === 'L1' ? 'warning' : 'default'" size="small" variant="light-outline">{{ row.layer }}</Tag>
            <Tooltip v-if="row.overridden" :content="`被 ${row.overriddenBy} 覆盖（非强制项）`">
              <Tag size="small" variant="outline" style="margin-left: 4px">已覆盖</Tag>
            </Tooltip>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">
            <span>选中段落（{{ active.assetId }}）</span>
            <Tooltip content="溯源锚点让「这条规则来自哪个资产」可被逐段回答，也用于评测时按片段定位劣化来源">
              <span class="oc-muted" style="font-size: 12px">可溯源</span>
            </Tooltip>
          </div>
          <InfoGrid :items="detailItems" :columns="1" />
          <div class="oc-divider" />
          <div class="oc-card__title">渲染文本</div>
          <pre class="oc-pre" style="max-height: 200px">{{ active.rendered }}</pre>
          <div class="oc-flex" style="margin-top: 6px">
            <CopyableId :id="active.assetId" label="复制资产 id" />
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">
            <span>变量注入值（{{ variables.length }}）</span>
            <span class="oc-muted" style="font-size: 12px">来源白名单：内核上下文 / 环境 / 配置</span>
          </div>
          <Table
            :data="variables"
            row-key="name"
            size="small"
            :pagination="{ pageSize: 8, total: variables.length }"
            :columns="[
              { colKey: 'name', title: '变量', width: 150 },
              { colKey: 'typeLabel', title: '类型', width: 90 },
              { colKey: 'value', title: '注入值', width: 200 },
              { colKey: 'source', title: '来源', width: 130 },
              { colKey: 'state', title: '状态' },
            ]"
          >
            <template #value="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.value || '（空）' }}</span></template>
            <template #state="{ row }">
              <Tooltip :content="row.note">
                <Tag :theme="row.injected ? 'success' : 'warning'" size="small" variant="light-outline">{{ row.injected ? '已注入' : '未注入' }}</Tag>
              </Tooltip>
            </template>
          </Table>
        </div>
      </div>

      <div class="oc-card">
        <div class="oc-card__title">
          <span>与上一版本 diff（{{ assembly.diffWithPrev.length }} 个资产有变化）</span>
          <span class="oc-muted" style="font-size: 12px">{{ assembly.diffWithPrev[0]?.summary }}</span>
        </div>
        <DiffView :files="diffFiles" :collapse-over="200" />
      </div>
    </StateShell>
  </div>
</template>
