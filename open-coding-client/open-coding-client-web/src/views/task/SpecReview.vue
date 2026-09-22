<script setup lang="ts">
/**
 * 规格评审（J-05）：`.oc/tasks/<id>.md` 八段分栏展示 + 版本 diff（DiffView）+ 变更触发重规划提示。
 * 溯源：卷 14 §4.4 任务规格文件（可评审、可版本化，变更触发重规划）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import DiffView from '@/components/common/DiffView.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { DiffFile } from '@/components/common/DiffView.vue';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selectedId = ref(taskData.specDocs[0]?.path ?? '');
const mode = ref<'sections' | 'diff'>('sections');
const activeSection = ref('background');

const spec = computed(() => taskData.specDocs.find((s) => s.path === selectedId.value) ?? taskData.specDocs[0]);

/** 版本 diff：仅列出变更段（评审人只看了变更段即 approve 的会被标记） */
const diffFiles = computed<DiffFile[]>(() => [{
  path: spec.value.path,
  language: 'markdown',
  additions: 6,
  deletions: 3,
  externalChanged: true,
  lines: [
    { type: 'ctx', oldLine: 1, newLine: 1, text: '# T-7f3a · 回执幂等校验' },
    { type: 'ctx', oldLine: 2, newLine: 2, text: '' },
    { type: 'del', oldLine: 8, text: 'A2 公开签名不变（人工比对）' },
    { type: 'add', newLine: 8, text: 'A2 公开签名不变（L1：japicmp 基线比对，0 处不兼容变更）' },
    { type: 'add', newLine: 9, text: 'A3 移动端弱网并发验证（L3：真机 + 抓包，人工判据，当前未验证）' },
    { type: 'ctx', oldLine: 10, newLine: 11, text: '' },
    { type: 'del', oldLine: 11, text: '测试计划：单测 8 例' },
    { type: 'add', newLine: 12, text: '测试计划：单测 12 例（含跨日重放）+ 迁移前后慢查询对比（SRE 评审意见）' },
    { type: 'add', newLine: 13, text: '风险：R3 存量数据重复值 → 迁移前执行去重预检并生成报告' },
  ],
}]);

/** 重规划候选分解：按本次变更的下游影响推导（人工确认前不写入任务树） */
type ReplanCandidate = { id: string; title: string; reason: string; estimateHours: number };
const REPLAN_CANDIDATES: ReplanCandidate[] = [
  { id: 'R1', title: '按新版验收标准重算条目与依赖顺序', reason: '验收标准变更（新增 L3 条目）→ 需重算关键路径', estimateHours: 3 },
  { id: 'R2', title: '补做迁移前后慢查询对比（SRE 评审意见）', reason: '测试计划变更 → 验证顺序与耗时需重排', estimateHours: 4 },
  { id: 'R3', title: '存量数据重复值去重预检并生成报告', reason: '风险项变更 → 需前置预检，避免迁移阻塞', estimateHours: 2 },
];
let replanSeq = 0;
/** 已发起的重规划请求（页内状态）：渲染请求编号 / 时间 / 候选分解，等待人工确认 */
const replan = ref<{ id: string; at: string; trigger: string; candidates: ReplanCandidate[] } | null>(null);

/** 发起重规划：生成候选分解并列在页内，等待人工确认，不自动写入任务树 */
function requestReplan() {
  if (replan.value) {
    MessagePlugin.info(`重规划 ${replan.value.id} 已发起（等待人工确认），候选分解已列在页内`);
    return;
  }
  replanSeq += 1;
  const now = new Date().toISOString();
  replan.value = {
    id: `RE-PLAN-${String(replanSeq).padStart(2, '0')}`,
    at: now,
    trigger: `依据当前规格「${spec.value?.path ?? '未选择'}」的评审结论重算下游分解`,
    candidates: REPLAN_CANDIDATES.map((c) => ({ ...c })),
  };
  MessagePlugin.success(`已发起重规划 ${replan.value.id}：生成 ${replan.value.candidates.length} 项候选分解（已列在页内「重规划候选」，等待人工确认，不自动写入任务树）`);
}

function approve() {
  MessagePlugin.success('已 approve：版本冻结为 v3（提交哈希随任务绑定，旧版本保留审计）');
}

function requestChanges() {
  MessagePlugin.warning('已请求修改：评审意见回流为任务需求（含评审人与行号），版本号 +1 并触发重规划');
}

onMounted(() => {
  window.setTimeout(() => { state.value = spec.value ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="规格评审" volume="卷 14" manifest="J-05" cli="oc task spec review T-7f3a --diff v2..v3"
      desc="规格文件即执行依据：八段结构（背景→目标→验收→约束→影响范围→技术方案→测试计划→风险）；评审 PR 化，变更段需重新 approve，变更后触发重规划提示。"
      :status="[
        { label: `版本 ${spec.version}`, theme: 'primary' },
        { label: spec.replanRequired ? '需重规划' : '无需重规划', theme: spec.replanRequired ? 'warning' : 'default' },
        { label: replan ? `${replan.id} 已发起（等待确认）` : '未发起重规划', theme: replan ? 'success' : 'default' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="mode = mode === 'sections' ? 'diff' : 'sections'">
          {{ mode === 'sections' ? '查看版本 diff' : '返回八段视图' }}
        </Button>
        <Popconfirm content="请求修改会把评审意见回流为任务需求并重新规划，已产出的证据保留但在新版规格式下重新校验。" theme="warning" @confirm="requestChanges">
          <Button size="small" variant="outline">请求修改</Button>
        </Popconfirm>
        <Button size="small" theme="primary" @click="approve">批准并冻结版本</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">规格文件：</span>
        <Select v-model="selectedId" size="small" style="width: 320px" :options="taskData.specDocs.map((s) => ({ label: `${s.path}（${s.version}）`, value: s.path }))" />
        <Tag size="small" variant="outline">上一版本 {{ spec.prevVersion }}</Tag>
        <Tag v-if="spec.changedSections.length" size="small" theme="warning" variant="light-outline">
          变更段：{{ spec.changedSections.join('、') }}
        </Tag>
      </div>
    </div>

    <StateShell
      :state="state"
      empty-title="该任务没有规格文件" empty-desc="规格为可选但推荐；无规格时任务依据口述描述执行，不可评审。" empty-action="从模板生成规格骨架"
      example-task="为 T-3f72 生成 OpenAPI 契约规格"
      what="规格加载失败" why="工作区路径 .oc/tasks/ 无法读取（工作区离线或路径围栏拒绝）"
      how="可重试；或改为从项目任务库读取规格" trace-id="trace-1d84fa62"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已生成规格骨架（八段）')"
    >
      <div class="oc-grid" style="grid-template-columns: 260px minmax(0, 1fr); gap: 10px">
        <!-- 左：八段导航 + 评审人 -->
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">八段结构</div>
            <button
              v-for="s in spec.sections" :key="s.key" type="button" class="oc-specnav"
              :class="{ 'oc-specnav--active': activeSection === s.key }" @click="activeSection = s.key"
            >
              <OcIcon name="file" size="12px" />
              <span class="oc-truncate">{{ s.title }}</span>
              <Tag v-if="spec.changedSections.includes(s.title)" size="small" theme="warning" variant="outline">变更</Tag>
            </button>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">评审人</div>
            <div v-for="rv in spec.reviewers" :key="rv.name" style="margin-bottom: 6px">
              <div class="oc-flex" style="gap: 6px">
                <OcIcon :name="rv.verdict === 'approve' ? 'check' : rv.verdict === 'request_changes' ? 'error' : 'time'" size="12px" />
                <b style="font-size: 12px">{{ rv.name }}</b>
                <Tag size="small" :theme="rv.verdict === 'approve' ? 'success' : rv.verdict === 'request_changes' ? 'danger' : 'default'" variant="light-outline">
                  {{ rv.verdict === 'approve' ? '同意' : rv.verdict === 'request_changes' ? '请求修改' : '待评审' }}
                </Tag>
              </div>
              <div v-if="rv.comment" class="oc-muted" style="font-size: 11px">{{ rv.comment }}</div>
            </div>
          </div>
        </div>

        <!-- 右：八段内容 或 版本 diff -->
        <div class="oc-stack">
          <template v-if="mode === 'sections'">
            <div v-for="s in spec.sections" v-show="activeSection === s.key" :key="s.key" class="oc-card">
              <div class="oc-flex--between">
                <div class="oc-card__title">{{ s.title }}</div>
                <Tag v-if="spec.changedSections.includes(s.title)" size="small" theme="warning" variant="light-outline">本版本变更</Tag>
              </div>
              <p class="oc-secondary" style="font-size: 13px">{{ s.body }}</p>
            </div>
          </template>
          <template v-else>
            <div class="oc-card">
              <div class="oc-flex--between">
                <div class="oc-card__title">版本 diff（{{ spec.prevVersion }} → {{ spec.version }}）</div>
                <Tag size="small" theme="warning" variant="light-outline">工作区已变更：评审基线可能过期</Tag>
              </div>
              <DiffView :files="diffFiles" @accept="MessagePlugin.success('已接受变更段：验收标准与测试计划')" @reject="MessagePlugin.info('已拒绝变更段：版本维持原样')" />
            </div>
          </template>

          <div class="oc-card" style="border-color: var(--oc-sev-warn)">
            <div class="oc-flex" style="gap: 6px">
              <OcIcon name="refresh" size="14px" />
              <b>变更触发重规划</b>
              <Tag size="small" theme="warning" variant="light-outline">需要重新评估</Tag>
            </div>
            <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
              规格变更影响 3 项下游：验收标准（新增 L3 条目）、测试计划（慢查询对比）、风险项（新增 R3）。
              重规划将重算关键路径并提示逐条重验（已产出证据保留，标记为「按旧版规格产出」）。
            </div>
            <div class="oc-flex" style="gap: 8px; margin-top: 6px">
              <Button size="small" variant="outline" :disabled="!!replan" @click="requestReplan">
                {{ replan ? '重规划已发起（等待确认）' : '发起重规划' }}
              </Button>
              <CliHint command="oc task spec replan T-7f3a --from-diff v2..v3" />
              <CopyableId id="trace-1d84fa62" label="复制评审 traceId" />
            </div>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">版本历史（旧版本保留用于审计）</div>
            <Timeline>
              <TimelineItem v-if="replan" :label="`${spec.version} · ${replan.id}`">
                <div style="font-size: 12px">
                  发起重规划：生成 {{ replan.candidates.length }} 项候选分解（等待人工确认，不自动写入任务树）· {{ new Date(replan.at).toLocaleString('zh-CN') }}
                </div>
              </TimelineItem>
              <TimelineItem :label="`${spec.version}（当前）`">
                <div style="font-size: 12px">新增 L3 验收条目 + 慢查询对比 + R3 风险；{{ spec.reviewers.filter((r) => r.verdict === 'approve').length }} 名评审人同意</div>
              </TimelineItem>
              <TimelineItem :label="spec.prevVersion">
                <div style="font-size: 12px">初始版本：3 条验收标准 + 8 例单测；评审人请求补充慢查询对比</div>
              </TimelineItem>
              <TimelineItem label="v1">
                <div style="font-size: 12px">草稿（Agent 生成候选，人工确认后转为 v2）</div>
              </TimelineItem>
            </Timeline>
          </div>

          <div v-if="replan" class="oc-card" style="margin-top: 8px; background: var(--td-bg-color-secondarycontainer, #f5f5f5)">
            <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <Tag size="small" variant="outline" class="oc-mono">{{ replan.id }}</Tag>
              <Tag size="small" theme="warning" variant="light-outline">等待人工确认（未写入任务树）</Tag>
              <span class="oc-muted" style="font-size: 11px">{{ new Date(replan.at).toLocaleString('zh-CN') }}</span>
              <span class="oc-muted" style="font-size: 11px">{{ replan.trigger }}</span>
            </div>
            <div v-for="c in replan.candidates" :key="c.id" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center; margin-top: 4px; font-size: 12px">
              <Tag size="small" variant="outline" class="oc-mono">{{ c.id }}</Tag>
              <b>{{ c.title }}</b>
              <span class="oc-muted">理由：{{ c.reason }}</span>
              <span class="oc-muted">估时 {{ c.estimateHours }}h</span>
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>

<style scoped>
.oc-specnav {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 5px 6px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: var(--td-text-color-primary, #181818);
}

.oc-specnav:hover {
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
}

.oc-specnav--active {
  background: var(--td-brand-color-light, #e6f0ff);
  color: var(--td-brand-color, #0052d9);
}
</style>
