<script setup lang="ts">
/**
 * SDK 指南（G2-01）：TS / Java 两版 SDK 的版本、协议兼容区间、内核兼容矩阵、安装命令、
 * 示例代码与弃用告警（弃用期 ≥ 2 个小版本，旧版本调用返回明确提示，不静默失败）。
 * 溯源：卷 29 / BUILD-MANIFEST G2-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';

const d = enterpriseData;

/** 兼容矩阵结果 → 标签主题（兼容 / 部分兼容 / 不兼容） */
const COMPAT_THEME: Record<string, 'success' | 'warning' | 'danger'> = {
  兼容: 'success',
  部分兼容: 'warning',
  不兼容: 'danger',
};

/** 协议兼容区间：v1 全系向后兼容，字段只增不删（破坏性变更进 v2 并给迁移期） */
const PROTOCOL_RANGE = '协议 v1（向后兼容；字段只增不删，破坏性变更需走 v2 + 迁移期）';

/** 弃用示例：弃用期 ≥ 2 个小版本（此处 2.7.0 → 2.10.0，共 3 个小版本） */
const DEPRECATIONS = [
  {
    language: 'TypeScript',
    api: 'client.session.open()',
    replacedBy: 'client.sessions.create()',
    deprecatedIn: '2.7.0',
    sunsetIn: '2.10.0',
    remaining: 3,
    notice: 'HTTP 400 + body.code=sdk.deprecated.api（调用被拒但给出替代指引）',
  },
  {
    language: 'Java',
    api: 'OcClient.session(...)',
    replacedBy: 'client.sessions().open(...)',
    deprecatedIn: '2.7.0',
    sunsetIn: '2.10.0',
    remaining: 3,
    notice: '响应头 x-oc-deprecated: sdk.deprecated.api（成功返回但持续告警）',
  },
];

const depColumns = [
  { colKey: 'language', title: '语言', width: 110 },
  { colKey: 'api', title: '已弃用调用', width: 210 },
  { colKey: 'replacedBy', title: '替代调用', width: 230 },
  { colKey: 'window', title: '弃用期（≥2 小版本）', width: 200, cell: 'window' },
  { colKey: 'notice', title: '旧版本调用的提示', ellipsis: true },
];

const compatColumns = [
  { colKey: 'kernel', title: '内核版本', width: 110 },
  { colKey: 'protocol', title: '协议', width: 90 },
  { colKey: 'result', title: '结论', width: 110, cell: 'result' },
];

/** 安装命令复制：写剪贴板；剪贴板不可用时显式提示（不静默失败） */
async function copyCommand(cmd: string, label: string) {
  try {
    await navigator.clipboard.writeText(cmd);
    MessagePlugin.success(`${label} 安装命令已复制`);
  } catch {
    MessagePlugin.warning('浏览器未授权剪贴板，请手动选择复制');
  }
}

// 语言筛选 + 折叠：匹配数超阈值折叠（EDGE_DATA）
type ShellState = 'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA';
const PAGE_SIZE = 2;
const langFilter = ref('all');
const limit = ref(PAGE_SIZE);
const loading = ref(true);
const errorMsg = ref('');
const errorTrace = ref('trace-sdk-9f21ac');
/** 离线私仓元数据（旧 schema）开关：用于演示「元数据不一致」的显式失败与恢复 */
const legacyMeta = ref(false);

const matched = computed(() => d.sdks.filter((s) => langFilter.value === 'all' || s.language === langFilter.value));
const visible = computed(() => matched.value.slice(0, limit.value));
const edgeSummary = computed(() => `匹配 ${matched.value.length} 条，超过单次渲染阈值（${PAGE_SIZE} 条）已折叠。`);
const state = computed<ShellState>(() => {
  if (loading.value) return 'LOADING';
  if (errorMsg.value) return 'ERROR';
  if (!matched.value.length) return 'EMPTY';
  return matched.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

/** 重新加载元数据：离线私仓的旧 schema 会导致解析失败（Fail-Fast，不静默用缺失矩阵） */
function reload() {
  if (legacyMeta.value) {
    errorMsg.value = 'SDK 元数据解析失败：离线私仓元数据 schema 版本（v0）与本地内核（v1）不一致，兼容矩阵无法解析。';
    errorTrace.value = `trace-sdk-${Math.abs(d.sdks.length * 7919).toString(16)}`;
    loading.value = false;
    return;
  }
  errorMsg.value = '';
  loading.value = true;
  window.setTimeout(() => (loading.value = false), 200);
}

function loadMore() {
  limit.value += PAGE_SIZE;
}

onMounted(() => {
  // 首次加载：读 registry 元数据（离线环境走私仓镜像元数据）
  window.setTimeout(() => (loading.value = false), 240);
});

/** 兼容矩阵的机器可读形态（CI 可断言，避免人工核对矩阵漂移） */
const compatJson = computed(() => ({
  protocol: PROTOCOL_RANGE,
  sdkCount: matched.value.length,
  matrix: visible.value.map((s) => ({ language: s.language, version: s.version, kernels: s.compatibleMatrix })),
}));

/** 弃用通知载荷示例（旧版本调用可解析原因码与日落版本） */
const deprecationNotice = computed(() => ({
  code: 'sdk.deprecated.api',
  severity: 'warning',
  api: DEPRECATIONS[1].api,
  sunsetVersion: DEPRECATIONS[1].sunsetIn,
  remainingMinorVersions: DEPRECATIONS[1].remaining,
  replacement: DEPRECATIONS[1].replacedBy,
  policy: '弃用期 ≥ 2 个小版本；弃用期内给出明确提示（失败或告警），不做静默行为变更',
}));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="SDK 指南"
      desc="TypeScript / Java 两版 SDK：契约生成的类型与错误码、内核兼容矩阵、可复制的安装命令与最小示例；弃用走「先告警、后移除」，弃用期 ≥ 2 个小版本。"
      volume="卷 29"
      manifest="G2-01"
      cli="oc sdk info --lang ts --json"
      :status="[{ label: '契约生成（不手写双份）', theme: 'default' }, { label: '弃用期 ≥ 2 小版本', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="copyCommand(d.sdks[0].installCommand, 'TypeScript')">复制 TS 安装命令</Button>
        <Button size="small" variant="outline" @click="copyCommand(d.sdks[1].installCommand, 'Java')">复制 Java 安装命令</Button>
        <Button size="small" theme="primary" @click="copyCommand('oc sdk gen --out ./src/generated --lang ts', '契约生成')">生成类型</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="TypeScript SDK" :value="d.sdks[0].version" format="raw" icon="code" :hint="d.sdks[0].package" />
      <StatCard label="Java SDK" :value="d.sdks[1].version" format="raw" icon="code" :hint="d.sdks[1].package" />
      <StatCard label="近 30 天下载" :value="d.sdks[0].downloads30d + d.sdks[1].downloads30d" unit="次" icon="download" />
      <StatCard label="弃用窗口" :value="3" unit="个小版本" icon="history" hint="旧调用有明确原因码，不静默失败" />
    </div>

    <StateShell
      :state="state"
      :collapsed-summary="edgeSummary"
      :page-size="2"
      stage="正在读取 SDK 元数据与兼容矩阵…"
      empty-title="没有匹配的 SDK 版本"
      empty-desc="当前筛选条件下没有可展示的语言版本；SDK 通常与内核同版本发布，可从私仓镜像获取。"
      empty-action="清除筛选"
      example-task="用 TS SDK 提交一个带预算的任务并订阅事件流"
      what="SDK 元数据读取失败"
      why="兼容矩阵不可解析（registry 元数据 schema 与本地版本不一致）。"
      how="可重试；或改用私仓镜像的离线元数据（离线环境）。"
      trace-id="trace-sdk-9f21ac"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="langFilter = 'all'"
    >
      <Alert
        v-if="errorMsg"
        theme="error"
        :message="`事实：${errorMsg}`"
        description="原因：离线镜像元数据由旧版本流水线导出。动作：改用在线 registry 元数据重试，或更新离线镜像包后重新导入。"
        style="margin-bottom: 10px"
      />
      <div class="oc-card" style="margin-bottom: 12px">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Select v-model="langFilter" size="small" style="width: 170px" aria-label="语言筛选" :options="[
            { label: '全部语言', value: 'all' },
            { label: 'TypeScript', value: 'TypeScript' },
            { label: 'Java', value: 'Java' },
          ]" />
          <Button size="small" variant="outline" @click="reload">刷新元数据</Button>
          <div class="oc-flex" style="gap: 6px; align-items: center">
            <Switch v-model="legacyMeta" size="small" />
            <span style="font-size: 12px">使用离线私仓元数据（旧 schema，用于观察解析失败）</span>
          </div>
          <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 元数据来源：registry.opencoding.dev（在线）</span>
        </div>
      </div>
      <div class="oc-grid oc-grid--2">
        <div v-for="sdk in visible" :key="sdk.language" class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">{{ sdk.language }} SDK</div>
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" theme="primary" variant="light-outline" class="oc-mono">{{ sdk.version }}</Tag>
              <Tag size="small" variant="outline">{{ sdk.registry }}</Tag>
            </div>
          </div>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'pkg', label: '包名', value: sdk.package, mono: true, copyable: true },
              { key: 'proto', label: '协议兼容区间', value: PROTOCOL_RANGE },
              { key: 'days', label: '近 30 天下载', value: `${sdk.downloads30d.toLocaleString('zh-CN')} 次` },
              { key: 'at', label: '最近发布', value: new Date(sdk.publishedAt).toLocaleString('zh-CN') },
            ]"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin: 8px 0">
            <CliHint :command="sdk.installCommand" label="安装命令（可复制）" />
            <Button size="small" variant="outline" @click="copyCommand(sdk.installCommand, sdk.language)">复制</Button>
          </div>
          <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">内核兼容矩阵</div>
          <Table :data="sdk.compatibleMatrix" row-key="kernel" size="small" :columns="compatColumns" :pagination="undefined" table-layout="fixed">
            <template #result="{ row }">
              <Tag size="small" :theme="COMPAT_THEME[row.result] ?? 'default'" variant="light-outline">{{ row.result }}</Tag>
            </template>
          </Table>
          <div class="oc-secondary" style="font-size: 12px; margin: 8px 0 4px">最小示例（{{ sdk.language }}）</div>
          <pre class="oc-pre">{{ sdk.example }}</pre>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">兼容矩阵（机器可读）<CopyableId id="trace-sdk-9f21ac" label="复制 traceId" /></div>
          <JsonBlock :value="compatJson" label="sdk-compat.json" :collapse-over="170" />
          <div class="oc-muted" style="font-size: 12px">矩阵由发布流水线生成并随包签名，禁止手写；CI 直接断言语义版本区间。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">弃用告警示例（先告警、后移除）</div>
          <Alert
            theme="warning"
            message="旧版本调用会产生明确的弃用提示（含原因码与日落版本），并给出替代调用与剩余迁移窗口。"
            description="弃用期 ≥ 2 个小版本；弃用期内行为保持兼容，不做静默语义变更。"
          />
          <Table :data="DEPRECATIONS" row-key="language" size="small" :columns="depColumns" :pagination="undefined" style="margin-top: 8px">
            <template #window="{ row }">
              <span class="oc-mono" style="font-size: 12px">{{ row.deprecatedIn }} → {{ row.sunsetIn }}</span>
              <Tag size="small" theme="warning" variant="light-outline" style="margin-left: 6px">剩 {{ row.remaining }} 个小版本</Tag>
            </template>
            <template #notice="{ row }">
              <Tooltip :content="row.notice"><span class="oc-truncate" style="display: block; max-width: 260px">{{ row.notice }}</span></Tooltip>
            </template>
          </Table>
          <div class="oc-secondary" style="font-size: 12px; margin: 8px 0 4px">旧版本调用将收到的通知载荷</div>
          <JsonBlock :value="deprecationNotice" label="deprecation-notice.json" :collapse-over="150" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
