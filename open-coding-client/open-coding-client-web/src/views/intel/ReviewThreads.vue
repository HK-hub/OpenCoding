<script setup lang="ts">
/**
 * 多轮修复线程（N3-06）：轮次（发现 / 修复 / 复验）+「请修复」+ 上限 6 轮 + BLOCKED。
 * 溯源：卷 35 §5.3 ② 失败处理；BUILD-MANIFEST N3-06。
 * 契约：修复后必须复验同一发现；复验失败回滚该修复并标记线程 BLOCKED（交人工，不自动重试）。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Select, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import { intelData } from '@/mock/data/automation';
import type { ReviewThread } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const threads = ref<ReviewThread[]>(intelData.reviewThreads.map((t) => ({ ...t })));
const selectedId = ref(threads.value[0].id);
const selected = computed(() => threads.value.find((t) => t.id === selectedId.value)!);
const selectedFindings = computed(() => intelData.findings.filter((f) => f.threadId === selectedId.value));

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onPick(v: unknown) {
  selectedId.value = String(v);
}

const STATUS_THEME: Record<ReviewThread['status'], 'success' | 'warning' | 'danger' | 'primary'> = {
  REVERIFIED: 'success', FIXED: 'primary', OPEN: 'warning', BLOCKED: 'danger',
};

const blocked = computed(() => threads.value.filter((t) => t.status === 'BLOCKED').length);
const stale = computed(() => threads.value.filter((t) => t.staleOnHead).length);

function askFix() {
  const t = selected.value;
  if (t.rounds.length >= t.maxRounds) {
    MessagePlugin.warning(`已达轮次上限（${t.maxRounds} 轮）：转人工处理，避免无限循环`);
    return;
  }
  t.rounds.push({ round: t.rounds.length + 1, kind: '修复', summary: '人工点「请修复」：按发现依据生成修复提交', at: new Date().toISOString(), result: 'pending' });
  MessagePlugin.success('已发起修复：修复后会自动复验同一发现（复验失败则回滚并标记 BLOCKED）');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = threads.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="多轮修复线程"
      desc="审查发现可对话追问与「请修复」；修复后复验同一发现，最多 6 轮；复验连续失败回滚修复并标记 BLOCKED。"
      volume="卷 35" manifest="N3-06" :cli="`oc ai review thread show ${selected.id} --rounds`"
      :status="[{ label: `${threads.length} 个线程`, theme: 'default' }, { label: `${blocked} 个 BLOCKED`, theme: blocked ? 'danger' : 'success' }, { label: `${stale} 个基于旧版本`, theme: stale ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="selectedId" size="small" style="width: 250px" aria-label="选择线程" :options="threads.map((t) => ({ value: t.id, label: `${t.id} · ${t.prRef}` }))" @change="onPick" />
        <Button size="small" theme="primary" @click="askFix">请修复</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在载入修复线程与轮次记录…"
      empty-title="暂无修复线程" empty-desc="当审查发现被要求修复时会创建线程；低置信发现不进入修复流程。"
      empty-action="去审查机器人" example-task="打开一个 BLOCKED 线程，查看回滚记录与人工接管建议"
      what="线程加载失败" why="线程与工作区 HEAD 关联校验失败（HEAD 漂移导致线程过期）"
      how="刷新线程或基于新 HEAD 重建；过期线程不会被误当作有效结论" trace-id="trace-6f8a52d0"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Alert v-if="selected.staleOnHead" theme="warning" style="margin-bottom: 10px"
        message="该线程基于旧版本（HEAD 已漂移）：结论可能不再适用，请基于新 HEAD 重建线程后再修复。" />

      <div class="oc-grid oc-grid--3">
        <div class="oc-card">
          <div class="oc-card__title">线程概要</div>
          <InfoGrid :columns="1" :items="[
            { key: 'id', label: '线程 id', value: selected.id, mono: true, copyable: true },
            { key: 'pr', label: 'PR / 提交', value: `${selected.prRef} @ ${selected.headSha}`, mono: true },
            { key: 'status', label: '状态', value: selected.status, tag: { text: selected.status, theme: STATUS_THEME[selected.status] } },
            { key: 'rounds', label: '轮次', value: `${selected.rounds.length} / ${selected.maxRounds}（上限 6 轮）` },
          ]" />
          <div class="oc-flex" style="gap: 6px; margin-top: 6px"><CopyableId :id="selected.id" label="复制线程 id" /></div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">关联发现（复验同一发现）</div>
          <div v-for="f in selectedFindings" :key="f.id" class="oc-stack" style="gap: 2px; margin-bottom: 6px">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" :theme="f.severity === 'error' ? 'danger' : 'warning'" variant="light-outline">{{ f.severity }}</Tag>
              <span class="oc-mono" style="font-size: 11px">{{ f.ruleId }}</span>
            </div>
            <span class="oc-muted" style="font-size: 11px">{{ f.location.file }}:{{ f.location.line }} · {{ f.basis }}</span>
          </div>
          <div v-if="!selectedFindings.length" class="oc-muted">该线程无关联发现记录。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">BLOCKED 处置</div>
          <div v-if="selected.status === 'BLOCKED'" class="oc-stack" style="gap: 4px">
            <span class="oc-secondary" style="font-size: 13px">{{ selected.blockedReason }}</span>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" theme="danger" variant="light-outline">已回滚修复</Tag>
              <Tag size="small" variant="outline">不再自动重试</Tag>
              <Tag size="small" variant="outline">转人工</Tag>
            </div>
            <CliHint command="oc ai review thread handoff thread-02 --to human" />
          </div>
          <div v-else class="oc-muted">当前线程未 BLOCKED；复验失败会先回滚修复再标记 BLOCKED。</div>
          <div class="oc-divider" />
          <div class="oc-muted" style="font-size: 12px">线程轮次上限 6（open-coding.intel.review.max-turns）；超限转人工。</div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">轮次时间线<CliHint :command="`oc ai review thread rounds ${selected.id}`" /></div>
          <Timeline>
            <TimelineItem v-for="r in selected.rounds" :key="r.round" :label="`第 ${r.round} 轮 · ${r.kind}`" :content="r.summary" />
          </Timeline>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">轮次明细</div>
          <div v-for="r in selected.rounds" :key="r.round" class="oc-flex--between" style="padding: 4px 0; border-bottom: 1px dashed var(--oc-border)">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" :theme="r.kind === '发现' ? 'primary' : r.kind === '修复' ? 'default' : 'success'" variant="light-outline">第 {{ r.round }} 轮 · {{ r.kind }}</Tag>
              <span style="font-size: 12px; max-width: 340px">{{ r.summary }}</span>
            </div>
            <Tag size="small" :theme="r.result === 'pass' ? 'success' : r.result === 'fail' ? 'danger' : 'warning'" variant="light-outline">{{ r.result }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            低置信发现默认折叠，不进入修复线程；高置信安全问题请求变更仍需人工确认（合并权在人）。
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
