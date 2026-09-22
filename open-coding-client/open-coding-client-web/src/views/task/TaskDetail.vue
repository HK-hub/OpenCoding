<script setup lang="ts">
/**
 * 任务详情（J-04）：十区 Tab（概览/Step/验收/证据/依赖/规格/写范围/指派/预算/迁移历史）+ 抽屉式操作。
 * 溯源：卷 14 §4.1 统一模型字段、§4.2 状态机、§4.4 规格绑定。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Popconfirm, Progress, RadioButton, RadioGroup, Select, Table, Tabs, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { DEP_META, LEVEL_META, PRIORITY_META, STATUS_META, taskData } from '@/mock/data/task';
import type { Priority, WorkItem } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const tab = ref('overview');
const selected = ref('T-7f3a');
const opsOpen = ref(false);
const preemptReason = ref('发布窗口提前 24 小时，回归批次需独占设备池与合并队列。');
const newPriority = ref<Priority>('URGENT');
const specPath = ref('.oc/tasks/T-7f3a.md');

const tabs = [
  { value: 'overview', label: '概览' },
  { value: 'steps', label: 'Step 列表' },
  { value: 'acceptance', label: '验收标准' },
  { value: 'evidence', label: '证据' },
  { value: 'deps', label: '依赖' },
  { value: 'spec', label: '规格' },
  { value: 'scope', label: '工作区写范围' },
  { value: 'assign', label: '指派' },
  { value: 'budget', label: '预算' },
  { value: 'history', label: '状态迁移历史' },
];

const item = computed<WorkItem>(() => taskData.workItems.find((i) => i.shortId === selected.value) ?? taskData.workItems[0]);
const steps = computed(() => taskData.workItems.filter((i) => i.parentId === item.value.itemId));
/** Step 表格行（扁平化，避免 children 字段与表格行类型冲突） */
const stepRows = computed(() => steps.value.map((s) => ({
  itemId: s.itemId, shortId: s.shortId, title: s.title, status: s.status, progress: s.progress,
})));
const spec = computed(() => taskData.specDocs.find((s) => s.taskId === item.value.itemId));

const evidenceColumns = [
  { colKey: 'level', title: '级别', width: 70 },
  { colKey: 'summary', title: '证据摘要' },
  { colKey: 'by', title: '采集者', width: 150 },
  { colKey: 'at', title: '时间', width: 160 },
  { colKey: 'ref', title: '引用', width: 210 },
];

const budgetPct = computed(() => Math.round((item.value.budget.usedCost / Math.max(0.01, item.value.budget.cost)) * 100));

function applyPriority() {
  item.value.priority = newPriority.value;
  MessagePlugin.success(`优先级已改为「${PRIORITY_META[newPriority.value].label}」，抢占排序已重算`);
}

function preempt() {
  item.value.stateHistory.push({
    from: item.value.status, to: item.value.status, actor: '沈亦舟',
    reason: `抢占请求：${preemptReason.value}`, at: new Date().toISOString(),
  });
  MessagePlugin.success('抢占已登记：将在最近安全点生效，被抢占任务保留检查点');
  opsOpen.value = false;
}

function linkSpec() {
  item.value.specRef = { path: specPath.value, version: 'v1' };
  MessagePlugin.success(`已关联规格 ${specPath.value}（旧版本保留于审计）`);
}

function back() {
  window.location.hash = '#/task/board';
}

function gotoSpec() {
  window.location.hash = '#/task/spec';
}

onMounted(() => {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  selected.value = q.get('workItem') ?? 'T-7f3a';
  window.setTimeout(() => { state.value = 'NORMAL'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`任务详情 · ${item.shortId}`" volume="卷 14" manifest="J-04"
      :cli="`oc task show ${item.shortId} --with-evidence --with-spec --with-history`"
      :desc="item.title"
      :status="[{ label: STATUS_META[item.status].label, theme: STATUS_META[item.status].theme }, { label: LEVEL_META[item.level].label, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="back">返回看板</Button>
        <Button size="small" variant="outline" @click="opsOpen = true">操作</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">切换任务：</span>
        <Select v-model="selected" size="small" style="width: 340px" :options="taskData.workItems.map((i) => ({ label: `${i.shortId} · ${i.title}`, value: i.shortId }))" />
        <Tag size="small" variant="outline">{{ item.assignee.name }}（{{ item.assignee.type }}）</Tag>
        <Tag :theme="PRIORITY_META[item.priority].theme" size="small" variant="light-outline">优先级 {{ PRIORITY_META[item.priority].label }}</Tag>
        <Progress :percentage="item.progress" theme="circle" :size="30" :stroke-width="4" />
      </div>
    </div>

    <StateShell
      :state="state"
      empty-title="任务不存在或已归档" empty-desc="短 ID 未命中，可能已被归档（完成后 90 天）。" empty-action="返回看板"
      example-task="从看板选择任一卡片进入详情"
      what="任务详情加载失败" why="快照与事件重建不一致（状态快照 in_review / 事件重建 in_progress）"
      how="可重试；系统将以事件为准重建并在报告中标注" trace-id="trace-5e70c913"
      @retry="state = 'LOADING'" @empty-action="back"
    >
      <Tabs v-model="tab" :options="tabs" style="margin-bottom: 10px" />

      <!-- 概览 -->
      <div v-if="tab === 'overview'" class="oc-stack">
        <div class="oc-card">
          <div class="oc-card__title">任务陈述与验收摘要</div>
          <p class="oc-secondary" style="font-size: 13px">{{ item.description }}</p>
          <InfoGrid :columns="2" :items="[
            { key: 'status', label: '状态', value: STATUS_META[item.status].label, tag: { text: STATUS_META[item.status].label, theme: STATUS_META[item.status].theme } },
            { key: 'progress', label: '证据驱动进度', value: `${item.progress}%（由已通过验收的子项比例 + 证据完整度推导）` },
            { key: 'ws', label: '工作区', value: item.workspace, mono: true },
            { key: 'est', label: '预估工时', value: `${item.estimateHours} h` },
            { key: 'milestone', label: '里程碑', value: item.milestoneId ?? '未归属' },
            { key: 'blocked', label: '阻塞原因', value: item.blockedReason ?? '无', span: 2 },
          ]" />
        </div>
        <div class="oc-grid oc-grid--3">
          <div class="oc-card">
            <div class="oc-card__title">验收进度环</div>
            <Progress theme="circle" :percentage="item.progress" :size="90" />
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">未验证项不计入：{{ item.acceptance.filter((a) => a.verdict === 'unverifiable').length }} 条</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">证据完整度</div>
            <div v-for="lv in ['L1', 'L2', 'L3']" :key="lv" class="oc-flex--between" style="font-size: 12px">
              <span>{{ lv }}</span>
              <span>{{ item.evidence.filter((e) => e.level === lv).length }} 条</span>
            </div>
            <Tag v-if="item.evidence.length === 0" theme="warning" variant="light-outline" size="small" style="margin-top: 6px">done 无证据即非法</Tag>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">预算水位</div>
            <div style="font-size: 20px; font-weight: 600">${{ item.budget.usedCost }}<span class="oc-muted" style="font-size: 12px"> / ${{ item.budget.cost }}</span></div>
            <Progress :percentage="budgetPct" :status="budgetPct > 80 ? 'warning' : 'success'" size="small" />
            <div class="oc-muted" style="font-size: 12px">tool calls {{ item.budget.usedToolCalls }} / {{ item.budget.toolCalls }}</div>
          </div>
        </div>
      </div>

      <!-- Step 列表 -->
      <div v-else-if="tab === 'steps'" class="oc-card">
        <div class="oc-card__title">Step（任务内最小执行单元）</div>
        <Table :data="stepRows" row-key="itemId" size="small" :pagination="undefined" :columns="[
          { colKey: 'shortId', title: 'ID', width: 100 },
          { colKey: 'title', title: '步骤' },
          { colKey: 'status', title: '状态', width: 100 },
          { colKey: 'progress', title: '进度', width: 90 },
        ]">
          <template #shortId="{ row }"><span class="oc-mono">{{ row.shortId }}</span></template>
          <template #status="{ row }"><Tag size="small" :theme="STATUS_META[row.status as keyof typeof STATUS_META].theme" variant="light-outline">{{ STATUS_META[row.status as keyof typeof STATUS_META].label }}</Tag></template>
          <template #progress="{ row }"><Progress :percentage="row.progress" size="small" /></template>
        </Table>
        <div v-if="!steps.length" class="oc-muted" style="font-size: 12px; margin-top: 6px">该任务尚未细化 Step（可由 Agent 在执行中动态细化）。</div>
      </div>

      <!-- 验收标准 -->
      <div v-else-if="tab === 'acceptance'" class="oc-stack">
        <div v-for="a in item.acceptance" :key="a.id" class="oc-card">
          <div class="oc-flex--between">
            <b style="font-size: 13px">{{ a.id }} · {{ a.text }}</b>
            <Tag size="small" :theme="a.verdict === 'pass' ? 'success' : a.verdict === 'fail' ? 'danger' : a.verdict === 'unverifiable' ? 'warning' : 'default'" variant="light-outline">
              {{ a.verdict === 'pass' ? '通过' : a.verdict === 'fail' ? '未通过' : a.verdict === 'unverifiable' ? '无法验证' : '待验证' }}
            </Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">验证方式：{{ a.verifyMethod }}</div>
          <div v-if="a.evidenceRefs.length" class="oc-flex" style="gap: 6px; margin-top: 4px">
            <Tag v-for="ref in a.evidenceRefs" :key="ref" size="small" variant="outline" class="oc-mono">{{ ref }}</Tag>
          </div>
        </div>
      </div>

      <!-- 证据 -->
      <div v-else-if="tab === 'evidence'" class="oc-card">
        <div class="oc-card__title">证据链（三级验证：L1 静态 / L2 可执行 / L3 语义）</div>
        <Table :data="item.evidence" row-key="id" size="small" :pagination="undefined" :columns="evidenceColumns">
          <template #level="{ row }"><Tag size="small" variant="light-outline" class="oc-mono">{{ row.level }}</Tag></template>
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #ref="{ row }"><span class="oc-mono oc-muted" style="font-size: 11px">{{ row.ref }}</span></template>
        </Table>
        <div v-if="!item.evidence.length" class="oc-card" style="margin-top: 8px; border-color: var(--oc-sev-warn)">
          <b>缺失证据清单</b>
          <div class="oc-secondary" style="font-size: 12px">该任务无任何证据：不可迁移为 done（系统已阻止并将状态回退为待验收）。</div>
        </div>
      </div>

      <!-- 依赖 -->
      <div v-else-if="tab === 'deps'" class="oc-card">
        <div class="oc-card__title">依赖（DAG 前置）</div>
        <div v-for="d in item.dependsOn" :key="d.targetId" class="oc-flex" style="gap: 8px; margin-bottom: 6px">
          <Tag size="small" variant="light-outline" class="oc-mono">{{ d.targetShort }}</Tag>
          <span style="font-size: 13px">{{ DEP_META[d.type].label }}</span>
          <span class="oc-muted" style="font-size: 12px">{{ DEP_META[d.type].desc }}</span>
        </div>
        <div v-if="!item.dependsOn.length" class="oc-muted" style="font-size: 12px">无前置依赖（可并行启动）。</div>
        <div class="oc-flex" style="gap: 8px; margin-top: 8px">
          <Tag v-if="taskData.criticalPath.includes(item.shortId)" size="small" theme="danger" variant="light-outline">位于关键路径</Tag>
          <CliHint command="oc task graph --check-cycles" />
        </div>
      </div>

      <!-- 规格 -->
      <div v-else-if="tab === 'spec'" class="oc-stack">
        <div class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title">规格引用</div>
            <Button size="small" variant="outline" @click="linkSpec">关联 / 更新规格</Button>
          </div>
          <InfoGrid :columns="2" :items="[
            { key: 'path', label: '规格文件', value: item.specRef?.path ?? '未关联', mono: true, copyable: !!item.specRef },
            { key: 'ver', label: '版本', value: item.specRef?.version ?? '—', hint: '提交哈希冻结，旧版本保留审计' },
          ]" />
        </div>
        <div v-if="spec" class="oc-card">
          <div class="oc-card__title">八段摘要（{{ spec.path }}）</div>
          <div v-for="s in spec.sections" :key="s.key" style="font-size: 12px; margin-bottom: 4px">
            <b>{{ s.title }}</b>：{{ s.body }}
          </div>
          <div v-if="spec.replanRequired" class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Tag size="small" theme="warning" variant="light-outline">规格已变更（{{ spec.changedSections.join('、') }}）</Tag>
            <Button size="small" variant="outline" @click="gotoSpec">进入评审与重规划</Button>
          </div>
        </div>
      </div>

      <!-- 写范围 -->
      <div v-else-if="tab === 'scope'" class="oc-card">
        <div class="oc-card__title">工作区与写范围声明</div>
        <InfoGrid :columns="1" :items="[{ key: 'ws', label: '工作区', value: item.workspace, mono: true }]" />
        <div class="oc-stack" style="margin-top: 8px">
          <div v-for="s in item.writeScope" :key="s" class="oc-flex" style="gap: 6px">
            <OcIcon name="folder" size="13px" />
            <span class="oc-mono" style="font-size: 12px">{{ s }}</span>
          </div>
        </div>
        <div class="oc-flex" style="gap: 6px; margin-top: 8px">
          <RiskBadge level="R1" />
          <span class="oc-muted" style="font-size: 12px">写范围参与权限判定（任务级授权）：范围外写入需审批；范围重叠任务被串行化。</span>
        </div>
      </div>

      <!-- 指派 -->
      <div v-else-if="tab === 'assign'" class="oc-card">
        <div class="oc-card__title">指派</div>
        <InfoGrid :columns="2" :items="[
          { key: 'type', label: '类型', value: item.assignee.type },
          { key: 'id', label: '标识', value: item.assignee.id, mono: true, copyable: true },
          { key: 'name', label: '名称', value: item.assignee.name },
          { key: 'team', label: '所属团队', value: item.teamId ?? '—' },
        ]" />
        <div class="oc-flex" style="gap: 8px; margin-top: 8px">
          <CliHint :command="`oc task assign ${item.shortId} --to agent:impl-01 --reason '<理由>'`" />
          <Button size="small" variant="outline" @click="opsOpen = true">打开操作抽屉</Button>
        </div>
      </div>

      <!-- 预算 -->
      <div v-else-if="tab === 'budget'" class="oc-card">
        <div class="oc-card__title">预算信封</div>
        <InfoGrid :columns="2" :items="[
          { key: 'tk', label: 'Token 预算', value: `${item.budget.usedTokens} / ${item.budget.tokens}` },
          { key: 'cost', label: '成本预算（USD）', value: `${item.budget.usedCost} / ${item.budget.cost}` },
          { key: 'tools', label: '工具调用', value: `${item.budget.usedToolCalls} / ${item.budget.toolCalls}` },
          { key: 'water', label: '水位', value: `${budgetPct}%`, hint: '≥ 80% 触发预警；≥ 100% 熔断' },
        ]" />
        <Progress :percentage="budgetPct" :status="budgetPct > 80 ? 'warning' : 'success'" style="margin-top: 8px" />
      </div>

      <!-- 迁移历史 -->
      <div v-else class="oc-card">
        <div class="oc-card__title">状态迁移历史（全部产出事件，含操作者与理由）</div>
        <Timeline>
          <TimelineItem v-for="(h, i) in item.stateHistory" :key="i" :label="new Date(h.at).toLocaleString('zh-CN')">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" variant="light-outline">{{ h.from === '—' ? '创建' : STATUS_META[h.from].label }}</Tag>
              <OcIcon name="link" size="12px" />
              <Tag size="small" theme="primary" variant="light-outline">{{ STATUS_META[h.to].label }}</Tag>
              <span class="oc-muted" style="font-size: 12px">{{ h.actor }}</span>
            </div>
            <div class="oc-secondary" style="font-size: 12px">{{ h.reason }}</div>
          </TimelineItem>
        </Timeline>
        <div class="oc-flex" style="gap: 8px; margin-top: 6px">
          <CopyableId :id="item.itemId" label="复制任务全局 UUID" />
          <CliHint :command="`oc task history ${item.shortId} --from-events`" />
        </div>
      </div>

      <!-- 操作抽屉 -->
      <Drawer v-model:visible="opsOpen" header="任务操作（抽屉）" size="440px" :footer="false">
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">指派</div>
            <Select v-model="item.assignee.id" size="small" :options="[
              { label: '实现者 · 落霞（Agent）', value: 'agent-impl-01' },
              { label: '测试者 · 清尘（Agent）', value: 'agent-test-03' },
              { label: '沈亦舟（人类）', value: 'u-shenyz' },
              { label: '结算攻坚队（团队）', value: 'TEAM-checkout-01' },
            ]" />
            <div class="oc-muted" style="font-size: 12px; margin-top: 4px">指派变更写入黑板与事件流（含理由）。</div>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">优先级</div>
            <RadioGroup v-model="newPriority" variant="default-filled" size="small">
              <RadioButton v-for="p in (['URGENT', 'HIGH', 'NORMAL', 'LOW'] as Priority[])" :key="p" :value="p">{{ PRIORITY_META[p].label }}</RadioButton>
            </RadioGroup>
            <Button size="small" theme="primary" style="margin-top: 6px" @click="applyPriority">应用优先级</Button>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">抢占（仅在安全点生效）</div>
            <textarea v-model="preemptReason" class="oc-pre" style="width: 100%; min-height: 60px; font-size: 12px" />
            <div class="oc-flex" style="gap: 8px; margin-top: 6px">
              <RiskBadge level="R2" />
              <Popconfirm content="抢占会暂停其他任务并在安全点落检查点；被抢占任务保留已完成部分，可从检查点恢复。" theme="warning" @confirm="preempt">
                <Button size="small" theme="danger" variant="outline">确认抢占</Button>
              </Popconfirm>
            </div>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">关联规格</div>
            <input v-model="specPath" class="oc-pre" style="width: 100%; font-size: 12px" />
            <Button size="small" variant="outline" style="margin-top: 6px" @click="linkSpec">关联并冻结版本</Button>
            <div class="oc-muted" style="font-size: 12px; margin-top: 4px">关联后 spec 变更将触发「重规划」提示。</div>
          </div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
