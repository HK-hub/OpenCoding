<script setup lang="ts">
/**
 * 验收与证据（J-10）：三级验证（L1 静态 / L2 可执行 / L3 语义）+ 证据链 + done 无证据即非法的拒绝演示 + 完成报告模板。
 * 溯源：卷 14 D-TASK-7 证据驱动进度；卷 12 三级验证。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Popconfirm, Progress, RadioGroup, RadioButton, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { STATUS_META, taskData } from '@/mock/data/task';
import type { AcceptanceCheck, WorkItem } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const level = ref<'ALL' | 'L1' | 'L2' | 'L3'>('ALL');
const selectedTask = ref('T-7f3a');
const reportOpen = ref(false);
const rejectDemo = ref<{ task: WorkItem; missing: string[]; traceId: string } | null>(null);

const checks = computed<AcceptanceCheck[]>(() => taskData.acceptanceChecks
  .filter((c) => level.value === 'ALL' || c.level === level.value)
  .filter((c) => c.taskId === selectedTask.value || level.value !== 'ALL'));

const task = computed<WorkItem>(() => taskData.workItems.find((i) => i.shortId === selectedTask.value) ?? taskData.workItems[0]);

const stats = computed(() => ({
  pass: taskData.acceptanceChecks.filter((c) => c.result === 'pass').length,
  fail: taskData.acceptanceChecks.filter((c) => c.result === 'fail').length,
  pending: taskData.acceptanceChecks.filter((c) => c.result === 'pending').length,
  unverifiable: taskData.acceptanceChecks.filter((c) => c.result === 'unverifiable').length,
  evidence: taskData.workItems.reduce((a, b) => a + b.evidence.length, 0),
}));

const columns = [
  { colKey: 'level', title: '级别', width: 70 },
  { colKey: 'name', title: '验证项', width: 150 },
  { colKey: 'method', title: '验证方式（可复现）' },
  { colKey: 'result', title: '结论', width: 110 },
  { colKey: 'note', title: '说明', width: 300 },
];

const report = computed(() => ({
  task: task.value.shortId,
  title: task.value.title,
  status: STATUS_META[task.value.status].label,
  durationHours: task.value.cycleHours ?? task.value.estimateHours,
  cost: task.value.budget.usedCost,
  tokens: task.value.budget.usedTokens,
  evidence: task.value.evidence.map((e) => ({ level: e.level, ref: e.ref })),
  changes: ['src/payment/service/PaymentServiceImpl.java（+38 / -6）', 'src/payment/mapper/PaymentMapper.xml（+12 / -0）', 'migrations/V2026_09__uk_trade_no.sql（新增）'],
  openItems: task.value.acceptance.filter((a) => a.verdict !== 'pass').map((a) => `${a.id} ${a.text}`),
}));

/** done 无证据即非法：演示系统拒绝「无证据完成」并给出缺失清单 */
function markDone() {
  const missing = task.value.evidence.length === 0
    ? ['无任何 L1/L2/L3 证据', ...task.value.acceptance.filter((a) => a.verdict !== 'pass').map((a) => `${a.id}：${a.text}`)]
    : [];
  if (missing.length) {
    rejectDemo.value = { task: task.value, missing, traceId: 'trace-77able03' };
    MessagePlugin.error(`拒绝完成：${task.value.shortId} 存在 ${missing.length} 项未满足（验收标准缺证据）`);
    return;
  }
  task.value.status = 'done';
  MessagePlugin.success(`${task.value.shortId} 已验收通过；证据完整，事件 workitem.acceptance.evaluated 已写入`);
}

function acceptAll() {
  MessagePlugin.success('已确认逐条结论并生成完成报告（含证据清单、成本、时长与变更摘要）');
  reportOpen.value = true;
}

onMounted(() => {
  window.setTimeout(() => { state.value = taskData.acceptanceChecks.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="验收与证据" volume="卷 14" manifest="J-10" cli="oc task accept T-7f3a --require-evidence"
      desc="三级验证：L1 静态（签名/依赖/格式）、L2 可执行（测试/构建/扫描）、L3 语义（人工判据）。进度由已通过验收的子项比例与证据完整度推导；done 无证据即非法。"
      :status="[{ label: '证据驱动', theme: 'primary' }, { label: '未验证项显式标注', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="reportOpen = true">完成报告</Button>
        <Popconfirm content="标记完成会写入验收事件；若存在未验证项或缺失证据，系统将拒绝并给出清单。" theme="warning" @confirm="markDone">
          <Button size="small" theme="primary">标记完成</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="通过" :value="stats.pass" unit="项" icon="check" />
      <StatCard label="未通过" :value="stats.fail" unit="项" icon="error" :lower-is-better="true" />
      <StatCard label="待验证" :value="stats.pending" unit="项" icon="time" />
      <StatCard label="证据总数" :value="stats.evidence" unit="条" icon="file" hint="含 L1/L2/L3 三级" />
    </div>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">任务：</span>
        <Select v-model="selectedTask" size="small" style="width: 340px" :options="taskData.workItems.filter((i) => i.level === 'task').map((i) => ({ label: `${i.shortId} · ${i.title}`, value: i.shortId }))" />
        <RadioGroup v-model="level" variant="default-filled" size="small">
          <RadioButton value="ALL">全部级别</RadioButton>
          <RadioButton value="L1">L1 静态</RadioButton>
          <RadioButton value="L2">L2 可执行</RadioButton>
          <RadioButton value="L3">L3 语义</RadioButton>
        </RadioGroup>
        <Tag size="small" variant="outline">验收进度 {{ task.progress }}%</Tag>
      </div>
    </div>

    <StateShell
      :state="state"
      empty-title="没有验收记录" empty-desc="该任务尚未提交验收，或尚未定义可检验的验收标准。" empty-action="生成候选验收标准"
      example-task="并发重放仅扣减一次（L2 可执行验证）"
      what="验收记录加载失败" why="证据库（对象存储）连接超时，证据引用无法解析"
      how="可重试；已产出证据不会丢失，恢复后自动重新解析引用" trace-id="trace-3f5b9c14"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已生成候选验收标准（需人工确认）')"
    >
      <div class="oc-stack">
        <div v-if="rejectDemo" class="oc-card" style="border-color: var(--oc-sev-error)">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
            <b>完成被拒绝：done 无证据即非法</b>
            <Tag size="small" theme="danger" variant="light-outline">{{ rejectDemo.task.shortId }}</Tag>
          </div>
          <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
            事实：任务被标记为完成但证据链为空。原因：验收标准缺少可检验证据（进度由证据推导，人工百分比无效）。动作：补齐证据或改回 in_review 继续执行。
          </div>
          <div class="oc-stack" style="margin-top: 6px">
            <div v-for="m in rejectDemo.missing" :key="m" class="oc-flex" style="gap: 6px; font-size: 12px">
              <OcIcon name="close" size="12px" color="var(--oc-sev-error)" /> {{ m }}
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CopyableId :id="rejectDemo.traceId" label="复制 traceId" />
            <CliHint command="oc task accept T-7f3a --require-evidence --explain" />
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">三级验证结论</div>
          <Table :data="checks" row-key="id" size="small" :pagination="undefined" :columns="columns">
            <template #level="{ row }"><Tag size="small" variant="light-outline" class="oc-mono">{{ row.level }}</Tag></template>
            <template #result="{ row }">
              <Tag size="small" :theme="row.result === 'pass' ? 'success' : row.result === 'fail' ? 'danger' : row.result === 'unverifiable' ? 'warning' : 'default'" variant="light-outline">
                {{ row.result === 'pass' ? '通过' : row.result === 'fail' ? '未通过' : row.result === 'unverifiable' ? '无法验证' : '待验证' }}
              </Tag>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">证据链（{{ task.shortId }}）</div>
          <div v-for="e in task.evidence" :key="e.id" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 6px">
            <Tag size="small" variant="outline" class="oc-mono">{{ e.level }}</Tag>
            <span style="font-size: 12px">{{ e.summary }}</span>
            <span class="oc-muted oc-mono" style="font-size: 11px">{{ e.ref }}</span>
            <span class="oc-muted" style="font-size: 11px">{{ e.by }} · {{ new Date(e.at).toLocaleString('zh-CN') }}</span>
          </div>
          <div v-if="!task.evidence.length" class="oc-muted" style="font-size: 12px">该任务暂无证据（不可标记完成）。</div>
          <Progress :percentage="task.progress" theme="circle" :size="60" style="margin-top: 6px" />
        </div>

        <div class="oc-card">
          <div class="oc-card__title">完成报告模板（导出/评审用）</div>
          <div class="oc-secondary" style="font-size: 12px">
            六段：① 任务与状态 ② 验收结论（逐条）③ 证据清单（分级 + 引用）④ 成本与时长 ⑤ 变更摘要（文件/行数）⑥ 未决项与后续建议。
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <Button size="small" theme="primary" variant="outline" @click="acceptAll">确认并生成报告</Button>
            <CliHint command="oc task report T-7f3a --format md --with-evidence" />
          </div>
        </div>
      </div>

      <Drawer v-model:visible="reportOpen" header="任务完成报告" size="560px" :footer="false">
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" theme="primary" variant="light-outline">{{ report.task }}</Tag>
              <b>{{ report.title }}</b>
              <Tag size="small" variant="outline">{{ report.status }}</Tag>
            </div>
            <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
              时长 {{ report.durationHours }} 小时 · 成本 ${{ report.cost }} · token {{ report.tokens }}
            </div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">变更摘要</div>
            <div v-for="c in report.changes" :key="c" class="oc-mono" style="font-size: 12px">{{ c }}</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">未决项与后续建议</div>
            <div v-for="o in report.openItems" :key="o" class="oc-flex" style="gap: 6px; font-size: 12px">
              <OcIcon name="flag" size="12px" /> {{ o }}
            </div>
            <div v-if="!report.openItems.length" class="oc-muted" style="font-size: 12px">无未决项。</div>
          </div>
          <JsonBlock :value="report" label="报告 JSON（可直接附于 PR 描述）" />
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
