<script setup lang="ts">
/**
 * 统一搜索页（G2-06）：单输入框 + 八类数据源 Tab（会话 / 任务目标 / 知识 / 记忆 / 技能插件 /
 * 工作区文件 / 审计 / 事件）+ 排序（相关度 / 时效 / 类型权重）+ 结果动作（打开 / @ 引用 /
 * 复制深链 / 导出）+ 延迟指标（P95 ≤300ms）+ 前置权限过滤（越权结果不返回）。
 * 溯源：卷 29 / BUILD-MANIFEST G2-06。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin, Select, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { db, type SearchHit } from '@/mock/db';
import { downloadJson } from '@/utils/download';
import { useUiStore, type UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();

/** 八类数据源（与语料 source 字段一致） */
const SOURCES = ['会话', '任务 / 目标', '知识', '记忆', '技能 / 插件', '工作区文件', '审计', '事件'] as const;

/** 本地补充语料（保证每类 ≥3 条；含 1 条受限结果用于演示前置权限过滤） */
const EXTRA: SearchHit[] = [
  { id: 'eco-run-21', source: '会话', title: 'S-4018 为工作区加入 cd 联动提示', snippet: '…进入含 .oc/ 的目录时提示可用指令与绑定…', path: '/session', deepLink: 'open/session/S-4018' },
  { id: 'eco-run-22', source: '任务 / 目标', title: 'T-91c2 统一搜索 P95 达标（≤300ms）', snippet: '验收 5/6；证据：压测报告 p95=246ms；未决：跨租户越权用例', path: '/task/board', deepLink: 'open/task/T-91c2' },
  { id: 'eco-run-23', source: '知识', title: '深链白名单与签名规范', snippet: '…approve 类深链必须签名（5 分钟）+ 二次确认…', path: '/knowledge/wiki', deepLink: 'open/wiki/page-4102' },
  { id: 'eco-run-24', source: '记忆', title: '项目记忆：CI 默认 readonly', snippet: '来源：CI 集成事故复盘（置信 高）· 生效范围：本项目流水线', path: '/memory/list', deepLink: 'open/kb/doc-102' },
  { id: 'eco-run-25', source: '技能 / 插件', title: '技能「导入迁移助手」', snippet: '扫描 AGENTS.md / MCP 配置并生成迁移报告（含替代建议）', path: '/registry/skills', deepLink: 'install/skill/import-helper@1.2.0' },
  { id: 'eco-run-26', source: '工作区文件', title: 'OcRoute 类型定义与路由收集', snippet: '…import.meta.glob 自动收集模块；meta 必填字段校验…', path: '/workspace/files', deepLink: 'open/session/S-4002' },
  { id: 'eco-run-27', source: '审计', title: '私仓凭据引用轮换（reg-02）', snippet: '执行者：系统 · 影响：双向同步短时中断 12s · 结果：成功', path: '/enterprise/audit', deepLink: 'open/kb/doc-133' },
  { id: 'eco-run-28', source: '事件', title: 'approval.requested（R3 删除）', snippet: 'session=S-4001 · 目标：secrets/ 目录 · 倒计时 4:32', path: '/approval/center', deepLink: 'approve/AR-9a02' },
  { id: 'eco-run-29', source: '事件', title: 'quota.exceeded（每日上限）', snippet: '配额：IM /run 每日 20 次 · 处置：拒绝并提示升级路径', path: '/event/live', deepLink: 'open/task/T-91c2', restricted: true },
  { id: 'eco-run-30', source: '会话', title: 'S-4020 首次运行向导断点续接', snippet: '…已记录断点：第 7 步；重进后从断点继续…', path: '/session', deepLink: 'open/session/S-4020' },
];

/** 语料 + 确定性时效权重（ageMin 越小越新，用于「时效」排序） */
const CORPUS = [...db.searchCorpus, ...EXTRA].map((h, i) => ({ ...h, ageMin: ((i * 137) % 2880) + 3 }));

/** 类型权重：会话与任务优先（更接近「正在做的事」），审计/事件靠后 */
const TYPE_WEIGHT: Record<string, number> = { 会话: 1, '任务 / 目标': 2, 知识: 3, 记忆: 4, '技能 / 插件': 5, 工作区文件: 6, 审计: 7, 事件: 8, 自动化: 9, 智能增强: 10 };

const keyword = ref('权限');
const activeTab = ref<string>('全部');
const sort = ref<'relevance' | 'recency' | 'type'>('relevance');
const limit = ref(8);
const loading = ref(true);
const errorMsg = ref('');
const errorTrace = ref('trace-search-0000');
const refs = ref<string[]>([]);
const latencies = ref<number[]>([168, 192, 240, 210, 288, 176, 254, 302, 198, 222]);

/** 前置权限过滤：受限结果直接不返回（只给出被过滤条数，不泄漏内容） */
const scoped = computed(() => CORPUS.filter((h) => activeTab.value === '全部' || h.source === activeTab.value));
const filteredOut = computed(() => scoped.value.filter((h) => h.restricted).length);
const allowed = computed(() => scoped.value.filter((h) => !h.restricted));

const matched = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (errorMsg.value) return [];
  return allowed.value.filter((h) => !kw || `${h.title}${h.snippet}${h.source}`.toLowerCase().includes(kw));
});

/** 相关度：标题命中权重 3、摘要命中 1，叠加类型权重微调 */
function relevance(h: SearchHit & { ageMin: number }): number {
  const kw = keyword.value.trim().toLowerCase();
  const titleHit = kw && h.title.toLowerCase().includes(kw) ? 3 : 0;
  const snipHit = kw && h.snippet.toLowerCase().includes(kw) ? 1 : 0;
  return titleHit + snipHit + (10 - (TYPE_WEIGHT[h.source] ?? 10)) / 10;
}

const sorted = computed(() => {
  const rows = [...matched.value];
  if (sort.value === 'relevance') rows.sort((a, b) => relevance(b) - relevance(a));
  else if (sort.value === 'recency') rows.sort((a, b) => a.ageMin - b.ageMin);
  else rows.sort((a, b) => (TYPE_WEIGHT[a.source] ?? 99) - (TYPE_WEIGHT[b.source] ?? 99));
  return rows;
});
const visible = computed(() => sorted.value.slice(0, limit.value));

const state = computed<UiStateKind>(() => {
  if (loading.value) return 'LOADING';
  if (errorMsg.value) return 'ERROR';
  if (!matched.value.length) return 'EMPTY';
  return sorted.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

const p95 = computed(() => {
  const arr = [...latencies.value].sort((a, b) => a - b);
  return arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))];
});
const latencyPoints = computed(() => latencies.value.map((v, i) => ({ x: `#${i + 1}`, y: v })));

/** 执行搜索：记录端到端延迟（目标 P95 ≤300ms）；超长查询直接拒绝并给原因 */
function runSearch() {
  errorMsg.value = '';
  const kw = keyword.value.trim();
  if (kw.length > 100) {
    errorMsg.value = `查询过长（${kw.length} 字符，上限 100）：请缩短关键词或改用筛选条件。`;
    errorTrace.value = `trace-search-${Math.abs(kw.length * 977).toString(16)}`;
    return;
  }
  loading.value = true;
  const t0 = performance.now();
  window.setTimeout(() => {
    loading.value = false;
    latencies.value = [...latencies.value.slice(-19), Math.max(48, Math.round(performance.now() - t0))];
    ui.track('eco.search.executed', { tab: activeTab.value, sort: sort.value, ms: latencies.value[latencies.value.length - 1] });
  }, 120);
}

function openHit(hit: SearchHit) {
  router.push(hit.path);
}

function toggleRef(hit: SearchHit) {
  refs.value = refs.value.includes(hit.id) ? refs.value.filter((x) => x !== hit.id) : [...refs.value, hit.id];
}

/** 复制深链（oc:// 协议，可直接粘到 IM/工单中跳回） */
async function copyDeepLink(hit: SearchHit) {
  const link = `oc://${hit.deepLink}`;
  try {
    await navigator.clipboard.writeText(link);
    MessagePlugin.success(`已复制深链：${link}`);
  } catch {
    MessagePlugin.warning('浏览器未授权剪贴板，请手动复制');
  }
}

/** 导出当前结果集（真实下载 JSON，便于离线分发与复核） */
function exportResults() {
  const name = downloadJson(
    { keyword: keyword.value, tab: activeTab.value, sort: sort.value, filteredOut: filteredOut.value, count: sorted.value.length, results: sorted.value },
    `oc-search-${activeTab.value === '全部' ? 'all' : 'tab'}.json`,
  );
  MessagePlugin.success(`已导出 ${sorted.value.length} 条结果（${name}）`);
}

onMounted(() => {
  window.setTimeout(() => {
    loading.value = false;
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="统一搜索"
      desc="一个输入框搜八类数据源（会话 / 任务目标 / 知识 / 记忆 / 技能插件 / 工作区文件 / 审计 / 事件），结果可打开、可 @ 引用、可复制深链、可导出；越权结果在检索前被过滤，不返回给前端。"
      volume="卷 29"
      manifest="G2-06"
      cli="oc search --keyword <kw> --source all --json"
      :status="[{ label: `P95 目标 ≤300ms（当前 ${p95}ms）`, theme: p95 <= 300 ? 'success' : 'warning' }, { label: '前置权限过滤', theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportResults">导出结果</Button>
        <Button size="small" theme="primary" @click="runSearch">搜索</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="结果数" :value="sorted.length" unit="条" icon="search" />
      <StatCard label="已 @ 引用" :value="refs.length" unit="条" icon="link" hint="引用会带入下一次会话上下文" />
      <StatCard label="前置过滤" :value="filteredOut" unit="条" icon="lock" :lower-is-better="true" hint="越权结果不返回（不泄漏内容）" />
      <StatCard label="延迟 P95" :value="p95" unit="ms" icon="time" :target="300" target-kind="max" :lower-is-better="true" />
    </div>

    <StateShell
      :state="state"
      :collapsed-summary="`匹配 ${sorted.length} 条，超过单次渲染阈值（8 条）已折叠。`"
      :page-size="8"
      stage="正在按权限过滤并检索八类数据源…"
      empty-title="没有匹配结果"
      empty-desc="换个关键词，或切换到「全部」数据源；被权限过滤的结果不会出现在这里（只统计条数）。"
      empty-action="清空关键词"
      example-task="搜索「深链」并复制 approve 深链到工单中"
      what="搜索请求被拒绝"
      why="查询过长（超过 100 字符上限），为避免全量扫描已直接拒绝。"
      how="缩短关键词或改用筛选条件后重试；也可用 oc search 在终端分页检索。"
      :trace-id="errorTrace"
      @retry="runSearch"
      @load-more="limit += 8"
      @empty-action="keyword = ''; runSearch()"
    >
      <div class="oc-card">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Input v-model="keyword" size="small" placeholder="搜索会话 / 任务 / 知识 / 文件 / 审计 / 事件…" clearable style="width: 380px" @enter="runSearch">
            <template #prefix-icon><OcIcon name="search" size="14px" /></template>
          </Input>
          <Select v-model="activeTab" size="small" style="width: 180px" aria-label="数据源" :options="[{ label: '全部数据源', value: '全部' }, ...SOURCES.map((s) => ({ label: s, value: s }))]" @change="runSearch" />
          <Select v-model="sort" size="small" style="width: 150px" aria-label="排序方式" :options="[
            { label: '相关度', value: 'relevance' },
            { label: '时效', value: 'recency' },
            { label: '类型权重', value: 'type' },
          ]" @change="runSearch" />
          <Button size="small" variant="outline" @click="runSearch">重新搜索</Button>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
          <Tag size="small" variant="outline">八类数据源</Tag>
          <Tag size="small" variant="outline">排序：{{ sort === 'relevance' ? '相关度' : sort === 'recency' ? '时效' : '类型权重' }}</Tag>
          <CliHint :command="`oc search --keyword ${keyword || '<kw>'} --source all --json`" label="等价 CLI" />
        </div>
        <Alert
          theme="info"
          style="margin-top: 8px"
          :message="`前置权限过滤已生效：本次过滤掉 ${filteredOut} 条越权结果（不返回内容，仅统计条数）。`"
          description="过滤发生在服务端检索层：租户 / 项目 / 可见范围三重校验；深链与 @ 引用同样按权限过滤，避免引用不可见内容。"
        />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">
          结果（{{ activeTab === '全部' ? '全部数据源' : activeTab }}）· 展示 {{ visible.length }} / {{ sorted.length }} 条
          <CopyableId :id="`trace-search-tab-${activeTab.length}9f`" label="复制检索 traceId" />
        </div>
        <div class="oc-stack" style="gap: 8px">
          <div v-for="hit in visible" :key="hit.id" class="oc-flex--between" style="gap: 10px; padding: 8px; border: 1px solid var(--oc-border); border-radius: 6px">
            <div class="oc-grow">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag size="small" theme="primary" variant="light-outline">{{ hit.source }}</Tag>
                <b style="font-size: 13px">{{ hit.title }}</b>
                <Tag v-if="refs.includes(hit.id)" size="small" theme="success" variant="light-outline">已引用</Tag>
              </div>
              <div class="oc-secondary oc-clamp-2" style="font-size: 12px; margin-top: 4px">{{ hit.snippet }}</div>
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 4px">
                <span class="oc-muted oc-mono" style="font-size: 11px">oc://{{ hit.deepLink }}</span>
                <span class="oc-muted" style="font-size: 11px">时效：{{ hit.ageMin }} 分钟前</span>
                <span class="oc-muted" style="font-size: 11px">类型权重：#{{ TYPE_WEIGHT[hit.source] ?? 99 }}</span>
              </div>
            </div>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; justify-content: flex-end">
              <Button size="small" variant="outline" @click="openHit(hit)">打开</Button>
              <Button size="small" variant="outline" @click="toggleRef(hit)">{{ refs.includes(hit.id) ? '取消引用' : '@ 引用' }}</Button>
              <Button size="small" variant="outline" @click="copyDeepLink(hit)">复制深链</Button>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">延迟指标（最近 20 次检索，目标 P95 ≤300ms）</div>
          <OcChart type="line" :series="[{ name: '检索延迟', points: latencyPoints }]" :height="180" :threshold="{ value: 300, label: '目标线 300ms', kind: 'max' }" unit="ms" aria-label="统一搜索延迟" />
          <div class="oc-muted" style="font-size: 12px">当前 P95 = {{ p95 }}ms；超线会在状态徽标与告警中显式标注（不静默降级）。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">结果动作说明</div>
          <div class="oc-stack" style="gap: 6px; font-size: 13px">
            <div><b>打开</b>：跳转到结果所在页面（保留检索上下文，可返回继续）。</div>
            <div><b>@ 引用</b>：把结果加入引用集（下一次会话按权限带入上下文，已引用条数 {{ refs.length }}）。</div>
            <div><b>复制深链</b>：复制 <span class="oc-mono">oc://</span> 深链，粘到 IM / 工单即可跳回；审批类深链需签名 + 二次确认。</div>
            <div><b>导出</b>：导出当前结果集 JSON（含被过滤条数），用于离线复核。</div>
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Tooltip content="导出仅包含你有权限查看的结果；被过滤条目不写入文件">
              <Tag size="small" variant="outline">导出不含越权结果</Tag>
            </Tooltip>
            <CliHint command="oc ref add --from-search --tab all" label="批量引用" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
