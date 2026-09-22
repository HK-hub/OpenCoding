<script setup lang="ts">
/** 结果外置工件查看器（T-07）：引用 + 结构化头部 + 分页读取（再读重新鉴权）。溯源：卷 05 §4.6 / 卷 03 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { toolCalls } = toolData;

const artifacts = computed(() => toolCalls.filter((c) => c.externalized && c.artifactRef));
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const currentRef = ref(artifacts.value[0]?.artifactRef ?? '');
const cursor = ref('0');
const pageSizeBytes = 16384;
const err = ref(makeError('NOT_FOUND', '工件引用已过期或被保留策略清理'));
const denied = ref(false);

const call = computed(() => artifacts.value.find((c) => c.artifactRef === currentRef.value));
const totalBytes = computed(() => call.value?.resultSizeBytes ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(totalBytes.value / pageSizeBytes)));
const pageIndex = computed(() => Math.min(totalPages.value - 1, Math.floor(Number(cursor.value) / pageSizeBytes)));

/** 结构化头部：由工具类型推导的关键字段（真实实现由工具结果处理阶段生成） */
const header = computed(() => ({
  ref: currentRef.value,
  producer: { tool: call.value?.toolName, callId: call.value?.callId, at: call.value?.startedAt },
  size: { bytes: totalBytes.value, tokens: call.value?.resultTokens ?? 0, pages: totalPages.value },
  retention: { ttlDays: 14, policy: '随会话生命周期（取长者）；引用计数 > 0 时受保护不被清理' },
  redaction: { masked: true, fields: call.value?.toolName === 'run_command' ? ['API_KEY', 'NPM_TOKEN', 'Authorization'] : [] },
  preview: call.value?.paramSummaryMasked,
}));

const chunkText = computed(() => {
  if (!call.value) return '';
  const idx = pageIndex.value;
  if (call.value.toolName === 'run_tests') {
    return idx === 0
      ? '{\n  "numTotalTests": 318,\n  "numPassedTests": 312,\n  "numFailedTests": 6,\n  "duration": 46800,\n  "failures": [ … 6 项，已脱敏 … ]\n}'
      : 'FAIL core/permission/decision-engine.spec.ts > 拒绝优先：org 基线锁定应阻断下级放宽\n  at DecisionEngine.spec.ts:88:12\n  expected: DENY  received: ALLOW';
  }
  if (call.value.toolName === 'run_build') {
    return idx === 0 ? 'building 14 packages…\n✔ @oc/core-api 1.2s\n✔ @oc/core-agent 8.4s' : '✔ @oc/core-sandbox 12.1s\ndist/index.mjs  412.8 kB │ gzip: 96.4 kB\n（尾部 4 KB 保留）';
  }
  return idx === 0
    ? '（工件首页）结构化摘要 + 关键行；完整内容需分页读取（每次 ≤16 KB）'
    : `（第 ${idx + 1} 页）后续内容分片；游标 ${cursor.value}`;
});

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    if (denied.value) state.value = 'PERMISSION_DENIED';
    else state.value = artifacts.value.length === 0 ? 'EMPTY' : 'NORMAL';
  }, 220);
}

function onPick(v: unknown) {
  currentRef.value = String(v ?? '');
  cursor.value = '0';
  denied.value = false;
  refresh();
}

function move(delta: number) {
  const next = Math.min(Math.max(0, pageIndex.value + delta), totalPages.value - 1);
  cursor.value = String(next * pageSizeBytes);
  ui.track('artifact.page', { ref: currentRef.value, page: next });
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="外置工件查看器"
      desc="结果 ≥4k token 时转外置引用（artifact://）+ 结构化头部（计数 / 范围 / 关键行），按需分页回读；再读必须重新鉴权。"
      volume="卷 03"
      manifest="T-07"
      :cli="`oc artifacts read ${currentRef} --page ${pageIndex + 1} --max-bytes ${pageSizeBytes}`"
      :status="[{ label: `共 ${artifacts.length} 个工件`, theme: 'default' }, { label: '再读需重新鉴权', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="denied = true; refresh()">演示越权再读</Button>
        <Popconfirm theme="danger" content="清理后该引用立即失效（引用计数 > 0 的工件受保护，不会被清理）。清理不可撤销，但可由原工具重新生成。确认清理？" @confirm="MessagePlugin.warning('已清理 1 个工件（可撤销窗口 10s）')">
          <Button size="small" variant="outline">清理工件</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="工件总数" :value="artifacts.length" format="raw" icon="folder-open" hint="本次会话外置结果" />
      <StatCard label="当前工件规模" :value="totalBytes" unit="B" format="raw" icon="file" :hint="`≈ ${call?.resultTokens ?? 0} token`" />
      <StatCard label="分页大小" :value="pageSizeBytes" unit="B" format="raw" icon="layers" hint="单次读取上限 128 KB" />
      <StatCard label="总页数" :value="totalPages" format="raw" icon="browse" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="currentRef" size="small" style="width: 420px" :options="artifacts.map((c) => ({ label: `${c.artifactRef ?? ''}（${c.toolName}）`, value: c.artifactRef ?? '' }))" @change="onPick" />
      <CopyableId :id="currentRef" label="复制引用" />
      <CliHint :command="`oc artifacts info ${currentRef}`" label="查看头部" />
    </div>

    <StateShell
      :state="state"
      empty-title="本次会话没有外置工件"
      empty-desc="所有工具结果均 < 4k token（内联回喂）。大结果（命令输出 / 测试报告 / 构建日志）会自动外置。"
      empty-action="回到调用时间线"
      example-task="运行全量测试并读取外置报告"
      :what="`工件读取失败：${currentRef}`"
      :why="err.message"
      how="工件按 TTL（默认 14 天）清理；如为引用过期请从原调用记录重新生成。"
      :trace-id="err.traceId"
      :missing-permission="'artifact.read'"
      risk-level="R0"
      apply-path="再读鉴权失败：请在「权限与审批 → 策略管理」确认工作区策略未撤销该会话的工件读取权，或申请临时授权"
      @retry="refresh"
      @apply="denied = false; refresh()"
      @empty-action="onPick(artifacts[0]?.artifactRef ?? '')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">结构化头部（不用读取全文即可决策）</h3>
          <JsonBlock :value="header" :collapse-over="300" label="artifact header" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">读取控制</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'ref', label: '工件引用', value: currentRef, copyable: true, mono: true },
            { key: 'producer', label: '生产者', value: `${call?.toolName ?? '—'} · ${call?.callId ?? '—'}` },
            { key: 'cursor', label: '当前游标', value: cursor },
            { key: 'page', label: '页码', value: `${pageIndex + 1} / ${totalPages}` },
            { key: 'redact', label: '脱敏', value: '结果处理阶段已完成脱敏（密钥 / Token / PII 掩码），读取不会回显明文' },
            { key: 'reauth', label: '再读鉴权', value: '每次读取重新校验会话与工件归属；越权访问记 PERMISSION_DENIED 事件' },
          ]" />
          <div class="oc-flex" style="margin-top: 10px; gap: 6px">
            <Button size="small" variant="outline" :disabled="pageIndex === 0" @click="move(-1)">上一页</Button>
            <Button size="small" variant="outline" :disabled="pageIndex >= totalPages - 1" @click="move(1)">下一页</Button>
            <Button size="small" variant="outline" @click="move(totalPages)">跳到末尾（尾部 N 行）</Button>
            <Tooltip content="尾部读取用于快速查看命令失败原因（保留尾部 4 KB + 错误摘录）">
              <Tag size="small" theme="warning" variant="light-outline">大工件</Tag>
            </Tooltip>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          分页读取内容（第 {{ pageIndex + 1 }} / {{ totalPages }} 页，游标 {{ cursor }}）
          <CliHint :command="`oc artifacts read ${currentRef} --cursor ${cursor} --max-bytes ${pageSizeBytes}`" />
        </h3>
        <pre class="oc-pre">{{ chunkText }}</pre>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">同会话工件清单</h3>
        <Table row-key="callId" size="small" :data="artifacts" :columns="[
          { colKey: 'artifactRef', title: '引用', width: 300 },
          { colKey: 'toolName', title: '工具', width: 130 },
          { colKey: 'resultSizeBytes', title: '大小', width: 110 },
          { colKey: 'resultTokens', title: 'token', width: 100 },
          { colKey: 'status', title: '调用状态', width: 120 },
        ]">
          <template #artifactRef="{ row }"><CopyableId :id="row.artifactRef" label="复制" :short="34" /></template>
          <template #resultSizeBytes="{ row }">{{ (row.resultSizeBytes / 1024).toFixed(1) }} KB</template>
          <template #status="{ row }"><Tag size="small" variant="light-outline" :theme="row.status === 'completed' ? 'success' : 'warning'">{{ row.status }}</Tag></template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
