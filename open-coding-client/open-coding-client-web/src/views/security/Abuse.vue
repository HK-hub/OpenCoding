<script setup lang="ts">
/**
 * 防滥用（G3-08）：五类检测 × 信号 × 处置 + 误报控制。
 * 溯源：卷 30 §4.8 / D-SEC-12
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, InputNumber, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadCsv } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
/** 检测类别以响应式代理渲染：调整阈值后命中数、误报率与统计卡需立即更新 */
const patterns = ref(d.abusePatterns);
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selectedId = ref(patterns.value[0].id);
const selected = computed(() => patterns.value.find((a) => a.id === selectedId.value) ?? patterns.value[0]);
const hits = computed(() => patterns.value.map((a) => ({ x: a.pattern.slice(0, 8), y: a.hits30d })));
const totalHits = computed(() => patterns.value.reduce((a, b) => a + b.hits30d, 0));
const avgFp = computed(() => patterns.value.reduce((a, b) => a + b.falsePositivePct, 0) / patterns.value.length);

/** 阈值调整弹窗：以「基线 + Nσ」为口径，σ 越小越敏感 */
const thresholdOpen = ref(false);
const thresholdTargetId = ref(patterns.value[0].id);
const thresholdSigma = ref(3);

/** 解析检测口径中的 σ 阈值（如「基线 + 3σ 偏离」→ 3），作为命中数换算基线 */
function parseSigma(detection: string): number {
  const m = detection.match(/(\d+(?:\.\d+)?)\s*σ/);
  return m ? Number(m[1]) : 3;
}

/** 命中样本范围脱敏：仅对「用户 · 姓名」保留姓氏，其余以 ** 替代；团队/项目名保留便于复核 */
function maskScope(scope: string): string {
  return scope.replace(/^(用户 · )([\u4e00-\u9fa5])[\u4e00-\u9fa5]{1,3}$/, '$1$2**');
}

/** 导出命中样本（当前选中类别）：真实样本 + 姓名脱敏 + 演示环境标注 */
function exportSamples() {
  const p = selected.value;
  const rows: (string | number)[][] = [
    ['检测类别', '时间', '范围（已脱敏）', '详情', '判定'],
    ...p.samples.map((s) => [
      p.pattern,
      new Date(s.at).toLocaleString('zh-CN'),
      maskScope(s.scope),
      s.detail,
      s.hit ? '确认为滥用' : '误报（已收敛）',
    ]),
    ['说明', `导出范围为「${p.pattern}」，共 ${p.samples.length} 条；范围字段中的用户姓名已脱敏（保留姓氏）；含误报样本用于特征收敛复核`, '', p.treatment, `30 天命中 ${p.hits30d} 次`],
  ];
  const file = downloadCsv(rows, `oc-abuse-hits-${p.id}-${new Date().toISOString().slice(0, 10)}.csv`);
  MessagePlugin.success('已生成 ' + file);
}

function openThreshold() {
  thresholdTargetId.value = selectedId.value;
  thresholdSigma.value = parseSigma(selected.value.detection);
  thresholdOpen.value = true;
}

/** 应用阈值：按 σ 比例换算 30 天命中数与误报率（更敏感即更多命中，可再次调整回退） */
function applyThreshold() {
  const p = patterns.value.find((x) => x.id === thresholdTargetId.value);
  if (!p) return;
  const oldSigma = parseSigma(p.detection);
  const oldHits = p.hits30d;
  const factor = oldSigma / thresholdSigma.value;
  p.detection = `基线 + ${thresholdSigma.value}σ 偏离，连续 2 个窗口`;
  p.hits30d = Math.max(0, Math.round(oldHits * factor));
  p.falsePositivePct = Math.round(Math.min(60, Math.max(0.5, p.falsePositivePct * factor)) * 10) / 10;
  thresholdOpen.value = false;
  MessagePlugin.success(`已调整「${p.pattern}」检测阈值：${oldSigma}σ → ${thresholdSigma.value}σ，30 天命中 ${oldHits} → ${p.hits30d} 次、误报率 ${p.falsePositivePct}%（更敏感即更多命中，误报同步上升需人工复核，阈值可再次调整回退）`);
}

onMounted(() => {
  setTimeout(() => { state.value = d.abusePatterns.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="防滥用"
      desc="五类检测：用量异常 / 外发异常 / 计算滥用 / 账号共享 / 市场滥用；处置为限流、阻断、终止、二次验证与降权，全部留审计。"
      volume="卷 30"
      manifest="G3-08"
      cli="oc abuse patterns --with-hits --with-fp"
      :status="[{ label: '人工复核优先', theme: 'default' }, { label: '误报可控', theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportSamples">导出命中样本</Button>
        <Button size="small" theme="primary" @click="openThreshold">调整检测阈值</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未配置滥用检测"
      empty-desc="无检测意味着刷量、挖矿与账号共享不可见；建议先启用用量异常与外发异常两类。"
      empty-action="启用推荐检测集"
      example-task="观察「用量异常」命中：夜间持续 ×3.4 → 限流 + 人工复核"
      what="滥用检测数据加载失败"
      why="行为基线计算任务失败（历史窗口数据不足或特征库不可用）"
      how="可重试；基线缺失时检测降级为「仅阈值规则」并在页面标注（不静默）"
      trace-id="trace-abuse-51c0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="检测类别" :value="patterns.length" unit="类" :target="5" target-kind="min" icon="secured" />
        <StatCard label="30 天命中" :value="totalHits" unit="次" icon="sound" />
        <StatCard label="自动处置" :value="patterns.filter((a) => a.autoAction).length" unit="类" hint="其余需人工确认后处置" />
        <StatCard label="平均误报率" :value="avgFp" format="percent" :target="20" target-kind="max" icon="chart" hint="误报进入特征收敛流程" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">命中分布（30 天）</div>
          <OcChart type="bar" :series="[{ name: '命中', points: hits }]" :height="200" aria-label="滥用命中分布" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">处置语义（不静默）</div>
          <div class="oc-stack">
            <div class="oc-muted" style="font-size: 12px">① 自动处置后立即通告受影响租户管理员，并给出申诉入口。</div>
            <div class="oc-muted" style="font-size: 12px">② 账号共享检测不直接封禁：先二次验证，失败再冻结（避免 VPN 误伤）。</div>
            <div class="oc-muted" style="font-size: 12px">③ 所有处置动作写入审计（安全类别）并可导出复核。</div>
          </div>
          <CopyableId id="trace-abuse-0912" label="复制 traceId" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">五类检测（点击查看样本）</div>
        <Table :data="patterns" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
          <template #pattern="{ row }"><b style="font-size: 12px">{{ row.pattern }}</b></template>
          <template #signal="{ row }"><span style="font-size: 12px">{{ row.signal }}</span></template>
          <template #detection="{ row }"><span style="font-size: 12px">{{ row.detection }}</span></template>
          <template #treatment="{ row }"><span style="font-size: 12px">{{ row.treatment }}</span></template>
          <template #hits30d="{ row }"><span class="oc-mono">{{ row.hits30d }}</span></template>
          <template #autoAction="{ row }">
            <Tag size="small" :theme="row.autoAction ? 'warning' : 'default'" variant="light-outline">{{ row.autoAction ? '自动处置' : '人工确认' }}</Tag>
          </template>
          <template #falsePositivePct="{ row }">
            <Tag size="small" :theme="row.falsePositivePct >= 20 ? 'warning' : 'success'" variant="light-outline">{{ row.falsePositivePct }}%</Tag>
          </template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">样本（{{ selected.pattern }}）</div>
        <Table :data="selected.samples" row-key="at" size="small" :columns="[
          { colKey: 'at', title: '时间', width: 190 },
          { colKey: 'scope', title: '范围', width: 200 },
          { colKey: 'detail', title: '详情' },
          { colKey: 'hit', title: '判定', width: 120 },
        ]">
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #hit="{ row }">
            <Tag size="small" :theme="row.hit ? 'danger' : 'default'" variant="light-outline">{{ row.hit ? '确认为滥用' : '误报（已收敛）' }}</Tag>
          </template>
        </Table>
      </div>
    </StateShell>

    <Dialog v-model:visible="thresholdOpen" header="调整检测阈值" width="520px" :confirm-btn="{ content: '应用阈值', theme: 'primary' }" cancel-btn="取消" @confirm="applyThreshold">
      <div class="oc-stack">
        <Select v-model="thresholdTargetId" size="small" aria-label="检测类别">
          <Option v-for="p in patterns" :key="p.id" :value="p.id" :label="p.pattern" />
        </Select>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <InputNumber v-model="thresholdSigma" :min="1.5" :max="6" :step="0.5" size="small" style="width: 150px" />
          <span class="oc-muted" style="font-size: 12px">偏离阈值（σ）：数值越小越敏感 → 命中与误报同步上升；调整立即生效，可再次调整回退</span>
        </div>
      </div>
    </Dialog>
  </div>
</template>
