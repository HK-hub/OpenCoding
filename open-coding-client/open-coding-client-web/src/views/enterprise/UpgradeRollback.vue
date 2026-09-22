<script setup lang="ts">
/**
 * 升级与回滚（N-09）：预检 → 灰度 → 观察 → 扩大 → 全量 + 回滚。
 * 溯源：卷 24 §4.6 / 卷 28 §4.2
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, StepItem, Steps, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import DiffView from '@/components/common/DiffView.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const step = ref(3);
/** 灰度控制：比例与暂停状态（暂停后不自动扩大，恢复可从当前阶段继续） */
const rolloutPct = ref(10);
const paused = ref(false);
/** 灰度阶段的 SLI 观察：错误率与延迟双指标 */
const observe = computed(() => Array.from({ length: 12 }, (_, i) => ({ x: `${i * 5}min`, y: 0.4 + i * 0.12 })));
/** 预检项：初始为历史健康检查结果，执行预检后刷新为本次候选版本的检查结论 */
const precheckRows = ref<{ name: string; pass: boolean; detail: string }[]>(d.updateHistory[1].healthChecks);
const precheckAt = ref('');
const prechecking = ref(false);
const diffFiles = computed(() => [{
  path: 'config/application.yml',
  additions: 4,
  deletions: 2,
  lines: [
    { type: 'ctx' as const, oldLine: 18, newLine: 18, text: 'open-coding:' },
    { type: 'del' as const, oldLine: 19, text: '  index:\n    rebuild-parallelism: 2' },
    { type: 'add' as const, newLine: 19, text: '  index:\n    rebuild-parallelism: 4\n    rebuild-timeout: 5m' },
    { type: 'ctx' as const, oldLine: 22, newLine: 23, text: '  a2a:' },
  ],
}]);

/** 预检：按候选版本核对迁移演练 / 兼容性 / 制品验签 / 回滚演练，结果刷新到预检项表 */
function runPrecheck() {
  const cand = d.updateCandidates[1];
  prechecking.value = true;
  MessagePlugin.info('正在执行升级预检（迁移演练 / 兼容性 / 制品验签 / 回滚演练）…');
  window.setTimeout(() => {
    const rows = [
      { name: '迁移演练', pass: cand.migration.expandContract, detail: cand.migration.expandContract ? `expand-contract 两阶段（第 1 阶段已在预发执行，预计 ${cand.migration.estimatedMinutes} 分钟）` : '未走 expand-contract：不可回滚迁移禁止直接升级' },
      { name: '兼容性', pass: true, detail: `内核 ${cand.compatibility.kernel}；协议 ${cand.compatibility.protocol}；插件 SDK ${cand.compatibility.pluginSdk}；最低版本 ${cand.minVersion}` },
      { name: '制品验签', pass: cand.cdnReady, detail: cand.cdnReady ? 'CDN 就绪；哈希与签名校验通过' : 'CDN 未就绪（制品仅内部源）：预检告警' },
      { name: '回滚演练', pass: cand.migration.rollbackable || cand.migration.expandContract, detail: cand.migration.rollbackable ? '可回滚迁移：版本 + 数据一并回退（≤ 2 分钟）' : '不可回滚迁移：依赖 expand-contract，回退需按 Runbook 人工介入' },
      { name: 'SLI 抽样（历史）', pass: d.updateHistory[1].healthChecks[1].pass, detail: `${d.updateHistory[1].healthChecks[1].detail}（历史失败项，本次观察窗口重点核对）` },
    ];
    precheckRows.value = rows;
    precheckAt.value = new Date().toISOString();
    prechecking.value = false;
    const blocked = rows.filter((r) => !r.pass);
    if (blocked.length) {
      MessagePlugin.warning(`升级预检完成：${rows.length - blocked.length} 项通过，${blocked.length} 项阻断（${blocked.map((r) => r.name).join(' / ')}；不通过即阻断，不降级继续）`);
    } else {
      MessagePlugin.success(`升级预检完成：${rows.length} 项全部通过（迁移演练 / 兼容性 / 制品验签 / 回滚演练）`);
    }
  }, 620);
}

/** 暂停 / 恢复灰度：暂停保持当前比例、不自动扩大，已完成部分不丢失 */
function togglePause() {
  paused.value = !paused.value;
  if (paused.value) {
    MessagePlugin.success(`已暂停灰度：保持当前 ${rolloutPct.value}% 比例，观察窗口冻结（不自动扩大）；已完成部分不丢失，可随时恢复`);
  } else {
    MessagePlugin.success(`已恢复灰度：从 ${rolloutPct.value}% 继续观察，窗口余量达标后才可扩大`);
  }
}

/** 扩大灰度：10% → 50% → 100%；暂停期间禁止扩大，全量前需通过变更门禁 */
function expandRollout() {
  if (paused.value) {
    MessagePlugin.warning('灰度已暂停：请先恢复灰度再扩大（暂停期间不自动扩大）');
    return;
  }
  if (rolloutPct.value >= 100) {
    MessagePlugin.warning('当前灰度已是 100%（全量）：无需继续扩大；如需回退请走回滚流程');
    return;
  }
  const from = rolloutPct.value;
  rolloutPct.value = from < 50 ? 50 : 100;
  if (rolloutPct.value === 100) step.value = 4;
  MessagePlugin.success(`已将灰度由 ${from}% 扩大到 ${rolloutPct.value}%：错误率与延迟未越线；${rolloutPct.value === 100 ? '进入全量阶段（写发布事件 + 发布说明）' : '继续观察窗口后再扩大'}`);
}

onMounted(() => {
  setTimeout(() => { state.value = 'NORMAL'; ui.setViewState({ state: 'NORMAL' }); }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="升级与回滚"
      desc="新版发布流程：预检（迁移演练 + 兼容性 + 依赖）→ 灰度 1 实例 / 1 租户 → 观察关键 SLI → 扩大 10%/50%/100% → 全量；异常时自动回滚。"
      volume="卷 24"
      manifest="N-09"
      cli="oc upgrade plan --to 2.10.0-rc.3 --dry-run"
      :status="[{ label: '不可回滚迁移须 expand-contract', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="prechecking" @click="runPrecheck">预检</Button>
        <Button size="small" variant="outline" @click="togglePause">{{ paused ? '恢复灰度' : '暂停灰度' }}</Button>
        <Button size="small" theme="primary" @click="expandRollout">扩大灰度</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有可用的升级候选"
      empty-desc="当前通道（stable）没有更新；可切换 beta 通道体验候选版本，或在「更新中心」检查。"
      empty-action="检查更新"
      example-task="在预发环境演练 2.10 的 expand-contract 两阶段迁移"
      what="升级计划生成失败"
      why="预检未通过（迁移演练或依赖检查失败，被阻断而非降级继续）"
      how="可重试；请先修复预检不通过项（每项给出原因与建议动作）"
      trace-id="trace-upgrade-7712ee"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="候选版本" :value="d.updateCandidates[1].version" format="raw" icon="download" />
        <StatCard label="灰度比例" :value="(paused ? '已暂停 ' : '') + rolloutPct + '%'" format="raw" :hint="paused ? '暂停期间保持当前比例，不自动扩大' : '当前阶段：观察中（1 租户）'" />
        <StatCard label="预估迁移耗时" :value="d.updateCandidates[1].migration.estimatedMinutes" unit="分钟" hint="不可回滚：已走 expand-contract" />
        <StatCard label="观察窗口余量" :value="'38 分钟'" format="raw" hint="可随时暂停灰度（不自动扩大）" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <Steps :current="step" size="small">
          <StepItem title="预检" content="迁移演练 / 兼容性 / 依赖" />
          <StepItem title="灰度 1 实例" content="1 租户流量" />
          <StepItem title="观察 SLI" content="错误率 + 延迟 + 迁移结果" />
          <StepItem title="扩大灰度" content="10% → 50% → 100%" />
          <StepItem title="全量" content="写发布事件 + 发布说明" />
        </Steps>
        <div class="oc-state__hint" style="margin-top: 6px">
          长操作语义：可「暂停灰度」（保持当前比例）或「回滚」（应用版本 + 数据按可回滚性，≤ 2 分钟）；暂停不丢已完成部分。
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">观察指标（灰度期间）</div>
          <OcChart type="line" :series="[{ name: '错误率', points: observe }]" :height="180" format="percent" :threshold="{ value: 2, label: '阻断线 2%' }" aria-label="灰度错误率" />
          <div class="oc-muted" style="font-size: 12px">当前 1.7%（未越线）；若越线将自动回滚并上报摘要。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">预检项（不通过即阻断）</div>
          <Table :data="precheckRows" row-key="name" size="small" :columns="[{ colKey: 'name', title: '检查项', width: 140 }, { colKey: 'detail', title: '结果' }]">
            <template #name="{ row }">
              <span>{{ row.name }}</span>
              <Tag size="small" :theme="row.pass ? 'success' : 'danger'" variant="light-outline" style="margin-left: 4px">{{ row.pass ? '通过' : '失败' }}</Tag>
            </template>
            <template #detail="{ row }">{{ row.detail || '—' }}</template>
          </Table>
          <div v-if="precheckAt" class="oc-state__hint" style="margin-top: 6px">
            最近预检 {{ new Date(precheckAt).toLocaleString('zh-CN') }}：通过 {{ precheckRows.filter((r) => r.pass).length }} / {{ precheckRows.length }}（不通过即阻断，不静默降级继续）。
          </div>
          <div class="oc-state__hint" style="margin-top: 6px">负样本（历史）：{{ d.updateHistory[1].reason }}</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">本次升级的配置差异（可逐块接受 / 拒绝）</div>
          <CopyableId id="trace-upgrade-diff-01" label="复制 traceId" />
        </div>
        <DiffView :files="diffFiles" :collapse-over="8" />
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          拒绝某个 hunk 不影响升级流程，但会在发布说明中标注「本地配置覆盖」。
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">历史升级记录</div>
          <Table :data="d.updateHistory" row-key="appliedAt" size="small">
            <template #version="{ row }"><span class="oc-mono">{{ row.fromVersion }} → {{ row.version }}</span></template>
            <template #result="{ row }">
              <Tooltip :content="row.reason">
                <Tag size="small" :theme="row.result === 'SUCCEEDED' ? 'success' : row.result === 'ROLLED_BACK' ? 'warning' : 'danger'" variant="light-outline">{{ row.result }}</Tag>
              </Tooltip>
            </template>
            <template #appliedAt="{ row }">{{ new Date(row.appliedAt).toLocaleString('zh-CN') }}</template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">回滚能力</div>
          <div class="oc-stack">
            <div class="oc-muted" style="font-size: 12px">① 保留前 2 个版本，回滚 ≤ 2 分钟（含健康检查）。</div>
            <div class="oc-muted" style="font-size: 12px">② 含数据迁移的版本按「可回滚性」判定：可回滚则版本 + 数据一并回退；不可回滚必须先走 expand-contract。</div>
            <div class="oc-muted" style="font-size: 12px">③ 回滚为危险操作：需二次确认并记录操作者与理由（不可撤销，但可再次升级）。</div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
