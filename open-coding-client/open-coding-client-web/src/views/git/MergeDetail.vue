<script setup lang="ts">
/**
 * I-07 合并详情与预检报告。
 * 拉取基线 → 重放变更 → 预检（构建/测试/扫描）→ 合并或退回；每步留下证据，
 * 退回必须给出原因与报告引用（目标分支保持健康优先于合并速度）。
 * 溯源：卷 21 §4.3；BUILD-MANIFEST I-07。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Select, Steps, StepItem, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { MergeQueueEntry } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const entryId = ref('mq-03');
const rejectOpen = ref(false);
const rejectReason = ref('');

const entry = computed<MergeQueueEntry>(() => platformData.git.mergeQueue.find((q) => q.id === entryId.value) ?? platformData.git.mergeQueue[2]);
const currentStep = computed(() => (entry.value.status === 'completed' ? 4 : entry.value.status === 'rejected' || entry.value.status === 'conflict' ? 2 : entry.value.status === 'started' ? 1 : 0));

const steps = computed(() => [
  { title: '拉取基线', detail: `目标 ${entry.value.target} 最新基线（当前记录 ${entry.value.baseRevision}）`, done: currentStep.value >= 1 },
  { title: '重放变更', detail: entry.value.replayResult, done: currentStep.value >= 2 },
  { title: '预检（构建/测试/扫描）', detail: `${entry.value.precheck.command} → ${entry.value.precheck.result}`, done: entry.value.precheck.result === 'passed' },
  { title: entry.value.status === 'rejected' || entry.value.status === 'conflict' ? '退回任务' : '合并提交', detail: entry.value.rejectionReason || `按 ${entry.value.mergeStrategy} 合并并记录事件`, done: entry.value.status === 'completed' },
]);

const precheckItems = computed(() => [
  { name: '构建', result: entry.value.precheck.result === 'passed' ? 'SUCCEEDED' : 'FAILED', detail: 'mvn -q verify / pnpm build 退出码与耗时' },
  { name: '测试', result: entry.value.precheck.result === 'passed' ? 'SUCCEEDED' : 'FAILED', detail: '单测 + 集成测试（失败即退回）' },
  { name: '提交前扫描', result: entry.value.precheck.result === 'passed' ? 'SUCCEEDED' : 'SKIPPED', detail: '密钥/大文件/敏感路径（增量，按 blob 缓存）' },
]);

const state = computed(() => (demo.value === 'NORMAL' && !platformData.git.mergeQueue.length ? 'EMPTY' : demo.value));

function doReject() {
  if (!rejectReason.value) {
    MessagePlugin.error('请填写退回原因（写入队列记录与事件 git.merge.rejected）');
    return;
  }
  MessagePlugin.success(`已退回 ${entry.value.branch}：${rejectReason.value}（附预检日志 ${entry.value.precheck.logsRef}；任务侧可修复后重新入队）`);
  rejectOpen.value = false;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.git.mergeQueue.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="合并详情与预检报告"
      desc="合并四步：拉最新基线 → 重放 → 预检 → 合并或退回。预检失败与冲突都不会「带病合并」，退回附日志引用，任务可修复后重试。"
      volume="卷 21" manifest="I-07" :cli="`oc git merge show --id ${entry.id} --with-precheck-log`"
      :status="[{ label: `策略 ${entry.mergeStrategy}`, theme: 'default' }, { label: entry.precheck.result, theme: entry.precheck.result === 'passed' ? 'success' : entry.precheck.result === 'failed' ? 'danger' : 'primary' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="entryId" size="small" style="width: 280px" aria-label="选择队列项" :options="platformData.git.mergeQueue.map((q) => ({ value: q.id, label: `${q.id} · ${q.branch} · ${q.status}` }))" />
        <Button size="small" theme="danger" variant="outline" :disabled="entry.status === 'completed'" @click="rejectOpen = true">退回任务</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="重放耗时" :value="(entry.durationMs / 1000).toFixed(1)" unit="秒" icon="history" hint="含基线拉取与重放" />
      <StatCard label="冲突文件" :value="entry.conflictFiles.length" icon="bug" :hint="entry.conflictFiles.length ? '冲突需人工确认后重新入队' : '无冲突'" />
      <StatCard label="预检结果" :value="entry.precheck.result" format="raw" icon="check" hint="通过才允许合并" />
      <StatCard label="队列串行占用" :value="entry.leaseSeconds" unit="秒" icon="time" hint="租约剩余；超时自动回收" />
    </div>

    <StateShell
      :state="state" stage="正在执行合并流程（拉取基线 → 重放 → 预检）…"
      empty-title="没有合并队列项" empty-desc="队列为空；可从任务完成卡或分支管理发起合并。"
      empty-action="入队一个任务分支" example-task="观察预检失败被退回并附日志引用的完整链路"
      what="合并详情读取失败" why="预检日志工件不可读（对象存储签名 URL 过期）"
      how="可重试（将重新签发日志 URL）；合并结论不受影响" trace-id="trace-f66a77ee"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-card">
        <Steps :current="currentStep" size="small">
          <StepItem v-for="s in steps" :key="s.title" :title="s.title" :status="s.done ? undefined : 'process'">
            <span style="font-size: 12px">{{ s.detail }}</span>
          </StepItem>
        </Steps>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">预检报告</h3>
          <Table
            :data="precheckItems" size="small" :pagination="undefined" row-key="name"
            :columns="[{ colKey: 'name', title: '检查项', width: 140 }, { colKey: 'result', title: '结果', width: 130, cell: 'res' }, { colKey: 'detail', title: '说明', ellipsis: true }]"
          >
            <template #res="{ row }">
              <Tag :theme="row.result === 'SUCCEEDED' ? 'success' : row.result === 'FAILED' ? 'danger' : 'default'" size="small" variant="light-outline">{{ row.result }}</Tag>
            </template>
          </Table>
          <JsonBlock
            :mask="false" label="预检命令与日志引用"
            :value="{ command: entry.precheck.command, logsRef: entry.precheck.logsRef, config: '.oc/ci.yaml（单一来源，本地与 CI 共用）', result: entry.precheck.result }"
          />
          <div class="oc-flex" style="margin-top: 8px">
            <CliHint :command="`oc git merge precheck --id ${entry.id} --logs`" />
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">重放与冲突</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'base', label: '基线', value: entry.baseRevision, mono: true },
            { key: 'replay', label: '重放结果', value: entry.replayResult },
            { key: 'conflict', label: '冲突文件', value: entry.conflictFiles.length ? entry.conflictFiles.join('、') : '无' },
            { key: 'suggest', label: '处理建议', value: entry.suggestions.length ? entry.suggestions.join('；') : '无' },
            { key: 'strategy', label: '合并策略', value: entry.mergeStrategy },
            { key: 'reject', label: '退回原因', value: entry.rejectionReason || '无' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
            <Tag v-if="entry.conflictFiles.length" theme="danger" variant="light-outline" size="small">冲突：不静默取一方，必须人工确认（I-08）</Tag>
            <Tag v-else theme="success" variant="light-outline" size="small">无冲突：可直接进入预检</Tag>
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="rejectOpen" header="退回合并请求" width="580px" :confirm-btn="{ content: '确认退回', theme: 'danger' }" cancel-btn="取消" @confirm="doReject">
      <div class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'branch', label: '来源分支', value: entry.branch, mono: true },
          { key: 'effect', label: '后果', value: '目标分支保持健康（不带病合并）；任务状态回到可修复状态，可修复后重新入队' },
          { key: 'attach', label: '附带材料', value: `预检日志 ${entry.precheck.logsRef} + 冲突文件与建议` },
          { key: 'undo', label: '是否可撤销', value: '退回不改变仓库状态，可再次入队（幂等）' },
        ]" />
        <Input v-model="rejectReason" size="small" placeholder="退回原因（必填，写入事件与任务评论）" />
        <CliHint :command="`oc git merge reject --id ${entry.id} --reason '<reason>'`" />
      </div>
    </Dialog>
  </div>
</template>
