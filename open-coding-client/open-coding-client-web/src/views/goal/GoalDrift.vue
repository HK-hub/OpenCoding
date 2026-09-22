<script setup lang="ts">
/**
 * 漂移告警（X-05）：三类证据（验收进展变化 / 产出与目标语义相似度 / 约束违反扫描）+ 处置（暂停/继续/调整目标）。
 * 溯源：卷 15 D-GOAL-4（周期对照目标与验收标准，检测到漂移即暂停并汇报）。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';

const ui = useUiStore();
const router = useRouter();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref('G-3a88');
const adjustOpen = ref(false);
const newObjective = ref('把 6 个服务回执处理收敛为单一模板，先完成 3 个低风险服务并对齐其余服务的迁移窗口。');

const goal = computed(() => taskData.goals.find((g) => g.shortId === selected.value) ?? taskData.goals[0]);

/** 证据一：验收进展变化（停滞步数是核心信号） */
const progressRows = computed(() => goal.value.acceptanceCriteria.map((c, i) => ({
  id: c.id,
  text: c.text,
  before: Math.max(0, 60 - i * 12),
  after: Math.max(0, 62 - i * 13),
  stallTicks: c.verdict === 'pass' ? 0 : 6 + i * 4,
  verdict: c.verdict,
})));

/** 证据二：产出与目标语义相似度（阈值 0.70，低于阈值即判定方向偏离） */
const similarity = computed(() => [{
  name: '语义相似度',
  points: ['T-40', 'T-36', 'T-32', 'T-28', 'T-24', 'T-20', 'T-16', 'T-12', 'T-8', 'T-4'].map((x, i) => ({
    x, y: [0.83, 0.82, 0.79, 0.77, 0.74, 0.72, 0.69, 0.65, 0.63, 0.61][i],
  })),
}]);

/** 证据三：约束违反扫描 */
const violations = computed(() => [
  { id: 'V1', severity: '高', constraint: '分批串行合入（同工作区）', finding: '批次 4 与批次 5 在同一 worktree 并行改写 receipt 包（写范围重叠 2 个文件）', at: '09-21 14:20' },
  { id: 'V2', severity: '中', constraint: '单批预算 ≤ $6', finding: '批次 3 实际成本 $7.10（超限 18%）', at: '09-21 09:05' },
  { id: 'V3', severity: '低', constraint: '每批合入前必须通过对拍', finding: '批次 4 合入前对拍报告缺失（仅本地运行记录）', at: '09-20 22:41' },
]);

const columns = [
  { colKey: 'text', title: '验收标准' },
  { colKey: 'before', title: '上轮进展', width: 110 },
  { colKey: 'after', title: '本轮进展', width: 110 },
  { colKey: 'stallTicks', title: '停滞（ticks）', width: 130 },
  { colKey: 'verdict', title: '结论', width: 110 },
];

function resume() {
  goal.value.driftFlag = false;
  goal.value.status = 'started';
  delete heldRecords.value[goal.value.shortId];
  MessagePlugin.success('已确认继续：漂移标记清除，Tick 恢复；本次判定写入审计（含忽略理由）');
}

function adjust() {
  if (!newObjective.value.trim()) {
    MessagePlugin.error('新目标陈述不能为空（目标变更必须可追溯）');
    return;
  }
  goal.value.objective = newObjective.value;
  goal.value.driftFlag = false;
  goal.value.status = 'started';
  delete heldRecords.value[goal.value.shortId];
  adjustOpen.value = false;
  MessagePlugin.success('目标已调整：生成 goal.updated 事件，验收标准需重新评审后生效');
}

/** 保持暂停记录：goalId → 处置时间（按目标隔离，切换目标后各自展示） */
const heldRecords = ref<Record<string, string>>({});

/** 当前目标是否已保持暂停（paused 且 Tick 不推进） */
const heldPaused = computed(() => Boolean(heldRecords.value[goal.value.shortId]));

/** 当前目标的保持暂停时间 */
const heldAt = computed(() => heldRecords.value[goal.value.shortId] ?? '');

/** 保持暂停：目标维持 paused（暂停期间不唤醒 Tick），等待人工修复后再恢复 */
function keepPaused() {
  heldRecords.value[goal.value.shortId] = new Date().toLocaleString('zh-CN');
  goal.value.status = 'paused';
  MessagePlugin.info('已保持暂停：目标待人工修复后恢复（Tick 不推进）');
}

onMounted(() => {
  window.setTimeout(() => { state.value = goal.value ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="漂移告警" volume="卷 15" manifest="X-05" cli="oc goal drift show G-3a88 --evidence all"
      desc="周期对照「目标 + 验收标准 + 约束」：三类证据（验收进展变化 / 产出与目标语义相似度 / 约束违反扫描）任一命中即暂停并汇报，等待人工处置。"
      :status="[{ label: heldPaused ? '已保持暂停（待人工修复）' : '已自动暂停', theme: heldPaused ? 'danger' : 'warning' }, { label: '检测为周期对照', theme: 'primary' }]"
    >
      <template #actions>
        <Popconfirm content="继续会清除漂移标记并恢复 Tick；忽略理由将写入审计（漂移未被修复时可能再次触发）。" theme="warning" @confirm="resume">
          <Button size="small" variant="outline">确认继续</Button>
        </Popconfirm>
        <Button size="small" variant="outline" @click="adjustOpen = true">调整目标</Button>
        <Button size="small" theme="primary" :disabled="heldPaused" @click="keepPaused">{{ heldPaused ? '已保持暂停' : '保持暂停' }}</Button>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">目标：</span>
        <Select v-model="selected" size="small" style="width: 360px" :options="taskData.goals.filter((g) => g.driftFlag).concat(taskData.goals.filter((g) => !g.driftFlag)).map((g) => ({ label: `${g.shortId}${g.driftFlag ? '（漂移）' : ''} ${g.objective.slice(0, 16)}…`, value: g.shortId }))" />
        <Tag size="small" :theme="goal.driftFlag ? 'danger' : 'success'" variant="light-outline">{{ goal.driftFlag ? '漂移中' : '已清除' }}</Tag>
        <Tag size="small" variant="outline">阈值：相似度 ≥ 0.70 · 停滞 ≤ 5 ticks</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="语义相似度" :value="0.61" icon="chart-line" :target="0.7" target-kind="min" hint="产出与目标的语义对照（低于阈值即偏离）" />
      <StatCard label="停滞验收条目" :value="progressRows.filter((r) => r.stallTicks > 5).length" unit="条" icon="time" :lower-is-better="true" />
      <StatCard label="约束违反" :value="violations.length" unit="项" icon="lock" :lower-is-better="true" />
      <StatCard label="已跳过 Tick" :value="18" unit="次" icon="refresh" :lower-is-better="true" hint="暂停期间不唤醒，避免继续烧钱" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有漂移告警" empty-desc="所有目标的方向与约束均正常；漂移检测按周期自动运行。" empty-action="返回目标列表"
      example-task="对 G-3a88（批量重构）检查约束违反"
      what="漂移证据加载失败" why="语义相似度度量服务不可用（嵌入模型未就绪）"
      how="已降级为「仅验收进展 + 约束扫描」两类证据，并在报告中标注缺口" trace-id="trace-0b7fd251"
      @retry="state = 'LOADING'" @empty-action="router.push('/goal/list')"
    >
      <div class="oc-stack">
        <div v-if="goal.driftDetail" class="oc-card" style="border-color: var(--oc-sev-error)">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
            <b>漂移判定</b>
            <Tag size="small" theme="danger" variant="light-outline">已自动暂停（Tick 停止）</Tag>
          </div>
          <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ goal.driftDetail }}</div>
        </div>

        <!-- 证据一 -->
        <div class="oc-card">
          <div class="oc-card__title">证据一 · 验收进展变化</div>
          <Table :data="progressRows" row-key="id" size="small" :pagination="undefined" :columns="columns">
            <template #stallTicks="{ row }">
              <Tag size="small" :theme="row.stallTicks > 5 ? 'danger' : 'default'" variant="light-outline">{{ row.stallTicks }}</Tag>
            </template>
            <template #verdict="{ row }">
              <Tag size="small" :theme="row.verdict === 'pass' ? 'success' : row.verdict === 'unverifiable' ? 'warning' : 'default'" variant="light-outline">
                {{ row.verdict === 'pass' ? '已满足' : row.verdict === 'unverifiable' ? '无法验证' : '待验证' }}
              </Tag>
            </template>
          </Table>
        </div>

        <!-- 证据二 -->
        <div class="oc-card">
          <div class="oc-card__title">证据二 · 产出与目标语义相似度</div>
          <OcChart
            type="line" :series="similarity" :height="200" :threshold="{ value: 0.7, label: '漂移阈值 0.70', kind: 'min' }"
            aria-label="产出与目标语义相似度趋势"
          />
          <div class="oc-secondary" style="font-size: 12px">
            连续 3 个采样点低于阈值（0.69 / 0.65 / 0.63 → 0.61）：说明近期产出（设备池排期、构建 OOM 处置）与目标语义（回执口径收敛）相关度下降。
          </div>
        </div>

        <!-- 证据三 -->
        <div class="oc-card">
          <div class="oc-card__title">证据三 · 约束违反扫描</div>
          <div v-for="v in violations" :key="v.id" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 6px">
            <Tag size="small" :theme="v.severity === '高' ? 'danger' : v.severity === '中' ? 'warning' : 'default'" variant="light-outline">{{ v.severity }}</Tag>
            <span class="oc-mono" style="font-size: 11px">{{ v.id }}</span>
            <b style="font-size: 12px">{{ v.constraint }}</b>
            <span class="oc-secondary" style="font-size: 12px">{{ v.finding }}</span>
            <span class="oc-muted" style="font-size: 11px">{{ v.at }}</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">处置选项（不允许静默继续）</div>
          <div class="oc-secondary" style="font-size: 12px">
            ① 保持暂停（默认）：修复约束违反后由人工恢复；② 确认继续：清除漂移标记并写入忽略理由（漂移未修复会再次触发）；
            ③ 调整目标：修改目标陈述与验收标准（需重新评审，旧版本保留审计）。
          </div>
          <!-- 保持暂停记录：确认后目标维持 paused，Tick 不推进（页面内可见凭证） -->
          <div v-if="heldPaused" class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center; margin-top: 6px">
            <Tag size="small" theme="danger" variant="light-outline">保持暂停 · {{ heldAt }}</Tag>
            <span class="oc-secondary" style="font-size: 12px">目标维持 paused，Tick 保持不推进；修复约束违反后再「确认继续」或「调整目标」恢复。</span>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CliHint command="oc goal drift resolve G-3a88 --action adjust --objective '<新目标>'" />
            <CopyableId id="trace-0b7fd251" label="复制 traceId" />
          </div>
        </div>
      </div>

      <Dialog v-model:visible="adjustOpen" header="调整目标（漂移处置）" width="560px" :footer="false">
        <div class="oc-stack">
          <div class="oc-muted" style="font-size: 12px">新目标陈述（调整后验收标准需重新评审）</div>
          <Textarea v-model="newObjective" :autosize="{ minRows: 3 }" />
          <div class="oc-card">
            <div class="oc-card__title">调整影响</div>
            <div class="oc-secondary" style="font-size: 12px">
              将生成 goal.updated 事件；验收标准版本 +1；已产出证据标记为「按旧版目标产出」，需重新对照；关键路径重算。
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Button size="small" theme="primary" @click="adjust">确认调整</Button>
            <Button size="small" variant="outline" @click="adjustOpen = false">取消</Button>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
