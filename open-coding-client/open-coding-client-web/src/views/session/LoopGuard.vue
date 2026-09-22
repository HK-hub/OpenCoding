<script setup lang="ts">
/**
 * 循环防护与回滚点（S-20 / 卷 12 循环防护 + impl/30 §6.3）：
 * 步数 / 时长 / 成本三重硬上限 + 重复动作检测（相同工具+参数 N 次告警）+ 目标漂移检测
 * + 越界摘要（做了什么 / 卡在哪 / 建议下一步）+ 触发上限后的决策入口（继续 / 调预算 / 停止，不静默终止）
 * + 安全点回滚列表。安全点数据来自会话域（db.safePoints），不另建真相源。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, InputNumber, MessagePlugin, Popconfirm, Progress, RadioGroup, RadioButton, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { db } from '@/mock/db';
import { useUiStore } from '@/stores/ui';
import { makeError, type MockError } from '@/mock/runtime';

const ui = useUiStore();
const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);
const decisionOpen = ref(false);
const decision = ref<'continue' | 'budget' | 'stop'>('continue');
const extraBudget = ref(2);
const decided = ref<string | null>(null);

/** 循环防护快照：内核 session.guard 投影（会话域 mock 未含该投影，此处为页面级快照） */
const guard = {
  steps: { used: 42, limit: 60 },
  duration: { usedMs: 38 * 60_000, limitMs: 60 * 60_000 },
  cost: { used: 2.84, limit: 5 },
  repeats: [
    { tool: 'read_file', args: 'src/main/java/com/acme/payment/PaymentServiceImpl.java#L88-L126', count: 4, limit: 3, level: 'hit' as const, note: '相同工具 + 相同参数命中 4 次：疑似原地打转（读同一段代码反复确认）' },
    { tool: 'run_tests', args: 'mvn -pl payment-core test', count: 3, limit: 3, level: 'warn' as const, note: '命中阈值：连续运行同一测试命令 3 次，建议改为定点单测' },
    { tool: 'grep_search', args: 'idempotencyKey', count: 2, limit: 3, level: 'ok' as const, note: '未超阈值（2/3）' },
  ],
  drift: [
    { kind: '验收进展', score: 72, note: '5 项验收完成 4 项；剩余「移动端并发验证」12 分钟无进展' },
    { kind: '语义相似度', score: 81, note: '最近 5 步动作与原始目标相似度 0.81（阈值 0.75，未漂移）' },
    { kind: '约束违反', score: 0, note: '未检测到约束违反（「不改公开签名」仍在遵守）' },
  ],
  outOfBounds: {
    did: '已完成持久层唯一约束改造并通过 128 例单测；派生 tester 子 Agent 补齐 12 例用例。',
    stuck: '在「移动端并发场景」缺少真机环境，反复读取同一段代码与测试脚本，未产生新信息。',
    next: '建议：① 用接口级并发脚本（无真机）覆盖该场景；② 或把「移动端验证」拆为独立任务并标注未验证项后收尾。',
  },
};
const hitRepeats = computed(() => guard.repeats.filter((r) => r.level === 'hit'));
const pctStatus = (v: number) => (v >= 90 ? 'error' : v >= 70 ? 'warning' : 'success');

/** 三重硬上限（步数 / 时长 / 成本）：百分比仅用于可视化，判断与收口都在内核 */
const limits = computed(() => [
  { key: 'steps', label: '步数上限', display: `${guard.steps.used}/${guard.steps.limit}`, pct: Math.round((guard.steps.used / guard.steps.limit) * 100), note: '达到上限后不静默终止：进入决策入口（继续 / 调预算 / 停止）。' },
  { key: 'time', label: '时长上限', display: `${Math.round(guard.duration.usedMs / 60_000)}/${Math.round(guard.duration.limitMs / 60_000)} 分钟`, pct: Math.round((guard.duration.usedMs / guard.duration.limitMs) * 100), note: '超过 2 倍预期时长先标记「可能停滞」并给建议动作，不自动中断。' },
  { key: 'cost', label: '成本上限', display: `$${guard.cost.used.toFixed(2)}/$${guard.cost.limit.toFixed(2)}`, pct: Math.round((guard.cost.used / guard.cost.limit) * 100), note: '成本上限与配额熔断叠加：先熔断再询问，避免超支静默发生。' },
]);

const shellState = computed(() => {
  if (ui.connection !== 'CONNECTED') return 'OFFLINE' as const;
  if (failure.value) return 'ERROR' as const;
  if (phase.value === 'LOADING') return 'LOADING' as const;
  return ('NORMAL' as const);
});

/** 触发上限后的决策入口：不静默终止，必须由用户选择继续/调预算/停止 */
function submitDecision() {
  decisionOpen.value = false;
  if (decision.value === 'continue') {
    decided.value = '已选择继续：本轮上限临时上浮 20%（记录理由并生成审计条目）';
  } else if (decision.value === 'budget') {
    decided.value = `已调整预算：追加 $${extraBudget.value.toFixed(2)}（超出部分按配置进入二次确认）`;
  } else {
    decided.value = '已选择停止：在最近安全点停止，已完成工具结果与副作用账本保留';
  }
  MessagePlugin.success(decided.value);
  ui.pushNotification({
    kind: 'task_done',
    level: 'P1',
    title: '循环防护决策已提交',
    body: decided.value,
    actions: [{ label: '查看安全点', path: '/session/guard' }],
    aggregateKey: 'guard-decision',
    penetrateQuiet: false,
    channel: 'inapp',
  });
}

function rewind(stepId: string) {
  MessagePlugin.success(`已请求回滚到 ${stepId}：快照对齐中；副作用账本已登记的重放将跳过`);
  ui.pushNotification({
    kind: 'task_done',
    level: 'P1',
    title: '已请求回滚',
    body: `目标安全点 ${stepId}；回滚后视图按快照对齐刷新（已完成部分保留）。`,
    actions: [],
    aggregateKey: 'rewind',
    penetrateQuiet: false,
    channel: 'inapp',
  });
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="循环防护与回滚点"
      desc="步数 / 时长 / 成本三重硬上限、重复动作与目标漂移检测、越界摘要与决策入口；达到上限后由你决定继续、调预算或停止，内核不静默终止。"
      volume="卷 12"
      manifest="S-20"
      cli="oc session guard --session <id> | oc session rewind --step step-4"
      :status="[
        { label: `重复动作命中 ${hitRepeats.length}`, theme: hitRepeats.length ? 'warning' : 'success' },
        { label: '不静默终止', theme: 'primary' },
      ]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次防护快照读取失败">
          <Button size="small" variant="text" @click="failure = makeError('DEPENDENCY_UNAVAILABLE', 'guard projection')">模拟异常</Button>
        </Tooltip>
        <Button size="small" theme="warning" variant="outline" @click="decisionOpen = true">处理越界（继续 / 调预算 / 停止）</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="步数" :value="guard.steps.used" unit="步" format="raw" icon="sitemap" :target="guard.steps.limit" target-kind="max" />
      <StatCard label="时长" :value="Math.round(guard.duration.usedMs / 60_000)" unit="分钟" format="raw" icon="time" :target="Math.round(guard.duration.limitMs / 60_000)" target-kind="max" />
      <StatCard label="成本" :value="guard.cost.used" format="cost" icon="discount" :target="guard.cost.limit" target-kind="max" />
      <StatCard label="重复动作告警" :value="hitRepeats.length" unit="项" format="raw" icon="refresh" hint="相同工具 + 相同参数达到 N 次即告警" />
    </div>

    <StateShell
      :state="shellState"
      stage="正在计算防护快照（步数 / 时长 / 成本 / 重复动作 / 漂移）…"
      cancellable
      empty-title="当前没有运行中的会话"
      empty-desc="循环防护只在执行中的会话上生效；空闲时这里没有可展示的越界数据。"
      empty-action="回到会话工作台"
      what="循环防护快照读取失败"
      :why="failure?.message ?? ''"
      how="可重试；快照不可用时内核仍按硬上限保护执行，不会因此失去防护。"
      :trace-id="failure?.traceId ?? ''"
      :disabled-capabilities="['决策入口', '安全点回滚']"
      @retry="failure = null; ui.simulateReconnect()"
      @empty-action="decisionOpen = false"
    >
      <div v-if="decided" class="oc-card" style="border-left: 3px solid var(--td-brand-color)">
        <div class="oc-flex" style="gap: 6px">
          <OcIcon name="check" size="14px" color="var(--oc-sev-ok)" />
          <b>{{ decided }}</b>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 4px">决策与理由已写入审计；上限上浮仅对本 Turn 生效。</div>
      </div>

      <div class="oc-grid oc-grid--3">
        <div v-for="l in limits" :key="l.key" class="oc-card">
          <h3 class="oc-card__title">{{ l.label }} <Tag size="small" variant="outline">{{ l.display }}</Tag></h3>
          <Progress :percentage="l.pct" :stroke-width="6" :status="pctStatus(l.pct)" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">{{ l.note }}</div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            重复动作检测（相同工具 + 相同参数）
            <Tag size="small" variant="outline">阈值：{{ guard.repeats[0].limit }} 次</Tag>
          </h3>
          <div class="oc-stack" style="gap: 8px">
            <div v-for="r in guard.repeats" :key="r.tool + r.args" class="oc-card" style="padding: 8px 10px">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag :theme="r.level === 'hit' ? 'danger' : r.level === 'warn' ? 'warning' : 'success'" size="small" variant="light-outline">
                  {{ r.level === 'hit' ? '命中告警' : r.level === 'warn' ? '接近阈值' : '正常' }}
                </Tag>
                <b class="oc-mono" style="font-size: 12px">{{ r.tool }}</b>
                <span class="oc-mono oc-secondary oc-truncate" style="font-size: 12px; max-width: 320px">{{ r.args }}</span>
                <Tag size="small" variant="outline">×{{ r.count }}</Tag>
              </div>
              <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ r.note }}</div>
            </div>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">目标漂移检测（三类证据）</h3>
            <OcChart
              type="radar"
              :values="guard.drift.map((d) => ({ name: d.kind, value: d.score }))"
              :height="200"
              aria-label="漂移证据分数雷达图"
            />
            <div class="oc-stack" style="gap: 4px; margin-top: 6px">
              <div v-for="d in guard.drift" :key="d.kind" class="oc-flex" style="gap: 6px; align-items: flex-start">
                <Tag :theme="d.score >= 75 || d.score === 0 ? 'warning' : 'success'" size="small" variant="light-outline">{{ d.score }}</Tag>
                <span style="font-size: 12px">{{ d.note }}</span>
              </div>
            </div>
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">越界摘要（做了什么 / 卡在哪 / 建议下一步）</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'did', label: '做了什么', value: guard.outOfBounds.did, block: true },
                { key: 'stuck', label: '卡在哪', value: guard.outOfBounds.stuck, block: true },
                { key: 'next', label: '建议下一步', value: guard.outOfBounds.next, block: true },
              ]"
            />
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          安全点回滚列表
          <Tag size="small" variant="outline">回滚按快照对齐；副作用账本已登记的条目重放时跳过</Tag>
        </h3>
        <div class="oc-stack" style="gap: 6px">
          <div v-for="sp in db.safePoints" :key="sp.stepId" class="oc-flex--between oc-flex--wrap" style="gap: 8px">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; min-width: 0">
              <OcIcon name="bookmark" size="13px" />
              <CopyableId :id="sp.stepId" label="复制安全点" />
              <span class="oc-muted" style="font-size: 11px">{{ new Date(sp.at).toLocaleString('zh-CN') }}</span>
              <Tag size="small" variant="outline">{{ sp.affected.length ? `影响 ${sp.affected.length} 个路径` : '只读（无副作用）' }}</Tag>
            </div>
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-secondary oc-truncate" style="font-size: 12px; max-width: 380px">{{ sp.sideEffects }}</span>
              <Popconfirm
                theme="warning"
                content="回滚到该安全点：之后的写入将被丢弃（已登记的副作用在重放时跳过）；此操作不可撤销。"
                @confirm="rewind(sp.stepId)"
              >
                <Button size="small" variant="outline">回滚到此</Button>
              </Popconfirm>
            </div>
          </div>
        </div>
      </div>
    </StateShell>

    <!-- 越界决策入口：三选一，不静默终止 -->
    <Dialog v-model:visible="decisionOpen" header="越界处理（必须显式选择）" theme="warning" width="560px" :footer="false">
      <div class="oc-stack">
        <div style="font-size: 13px">已达硬上限（步数 {{ guard.steps.used }}/{{ guard.steps.limit }}，成本 ${{ guard.cost.used }}/${{ guard.cost.limit }}）。内核不静默终止，请选择后续动作：</div>
        <RadioGroup v-model="decision">
          <RadioButton value="continue">继续：本 Turn 上限上浮 20%（记录理由，纳入审计）</RadioButton>
          <RadioButton value="budget">调预算：追加预算并继续</RadioButton>
          <RadioButton value="stop">停止：在最近安全点停止（保留已完成部分）</RadioButton>
        </RadioGroup>
        <div v-if="decision === 'budget'" class="oc-flex" style="gap: 8px">
          <span style="font-size: 13px">追加预算（USD）</span>
          <InputNumber v-model="extraBudget" theme="normal" size="small" :min="0.5" :max="50" :step="0.5" style="width: 120px" />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          任意选择都会写入事件与理由；「停止」等价于在安全点中断，已完成工具结果与副作用账本保留。
        </div>
        <div class="oc-flex" style="gap: 8px">
          <Button theme="primary" @click="submitDecision">提交决策</Button>
          <Button variant="text" @click="decisionOpen = false">稍后处理（保持当前状态）</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
