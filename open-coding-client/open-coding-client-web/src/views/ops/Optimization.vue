<script setup lang="ts">
/**
 * 优化清单（G4-03）：10 项成本优化杠杆（收益区间 / 实施成本 / 风险 / 依赖 / 状态），
 * 采用后进入验证并强制要求「前后对比报告」——必须提供同评测集对比，防止以质量换成本。
 * 溯源：卷 31 / BUILD-MANIFEST G4-03
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { OptimizationItem } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 已放弃的反例单独呈现（负样本：质量不达标一律不采纳） */
const rejected = computed(() => d.optimizations.filter((o) => o.status === '已放弃'));
const levers = computed(() => d.optimizations.filter((o) => o.status !== '已放弃'));
const adopted = ref<Record<number, string>>({});
const target = ref<OptimizationItem | null>(null);
const columns = [
  { colKey: 'rank', title: '#', width: 52 },
  { colKey: 'lever', title: '优化杠杆', width: 260 },
  { colKey: 'gain', title: '预估收益（节省比例区间）', width: 190 },
  { colKey: 'cost', title: '实施成本', width: 96 },
  { colKey: 'risk', title: '风险', width: 78 },
  { colKey: 'dependency', title: '依赖', width: 150 },
  { colKey: 'status', title: '状态', width: 96 },
  { colKey: 'op', title: '操作', width: 96 },
];
const statusOf = (o: OptimizationItem) => adopted.value[o.rank] ?? o.status;
const savedOf = (o: OptimizationItem) => o.beforeUsd - o.afterUsd;
const totalSaved = computed(() => levers.value.reduce((a, b) => a + savedOf(b), 0));
const verifiedSaved = computed(() => levers.value.filter((o) => o.verified).reduce((a, b) => a + savedOf(b), 0));

function openAdopt(o: OptimizationItem): void {
  target.value = o;
}
/** 采用：进入「验证中」，并要求提交同评测集前后对比报告，质量劣化超阈值即回退 */
function adopt(): void {
  const o = target.value;
  if (!o) return;
  adopted.value = { ...adopted.value, [o.rank]: '验证中' };
  MessagePlugin.warning(`「${o.lever}」已采用：需在 14 天内提交同评测集前后对比报告；质量劣化 >1% 将自动回退并冻结该杠杆`);
  target.value = null;
}
function exportList(): void {
  const file = downloadJson({ levers: levers.value.map((o) => ({ ...o, status: statusOf(o) })), rejected: rejected.value }, 'oc-optimization-backlog.json');
  MessagePlugin.success(`已导出优化清单：${file}`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = levers.value.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="优化清单"
      desc="10 项成本杠杆：收益区间 / 实施成本 / 风险 / 依赖 / 状态；采用后必须提交同评测集的前后对比报告，质量劣化 >1% 自动回退。"
      volume="卷 31"
      manifest="G4-03"
      cli="oc cost improvement list --with-report-requirement"
      :status="[{ label: '质量不劣化是前置条件', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportList">导出清单</Button>
        <CliHint command="oc cost improvement verify --lever 1 --same-suite" label="校验对比报告" />
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有优化项"
      empty-desc="没有候选杠杆不代表无成本压力；请先用成本归因定位 Top 维度后再生成清单。"
      empty-action="从归因结果生成清单"
      example-task="为「平台工程组用量异常 +62%」产出可验证的优化项"
      what="优化清单加载失败"
      why="评测服务不可达：没有同评测集基线时无法验证质量不劣化，端上不允许采用"
      how="可重试；已有基线可离线导出对比后再同步"
      trace-id="trace-optimize-3d5f28"
      @retry="state = 'LOADING'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="候选杠杆" :value="levers.length" unit="项" format="raw" icon="lightbulb" hint="含验证中与计划中" />
        <StatCard label="潜在节省（月度）" :value="totalSaved" format="cost" icon="discount" :lower-is-better="false" hint="按各项 before - after 汇总" />
        <StatCard label="已验证节省" :value="verifiedSaved" format="cost" icon="check" :lower-is-better="false" hint="已通过同评测集对比的项" />
        <StatCard label="已放弃（反例）" :value="rejected.length" unit="项" format="raw" icon="close" :hint="rejected[0]?.gain" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">优化杠杆清单（{{ levers.length }} 项）</div>
        <Table :data="levers" :columns="columns" row-key="rank" size="small">
          <template #lever="{ row }">
            <span>{{ row.lever }}</span>
            <Tag v-if="row.qualityDeltaPct < 0" size="small" theme="warning" variant="outline" style="margin-left: 4px">质量 {{ row.qualityDeltaPct }}%</Tag>
          </template>
          <template #cost="{ row }"><Tag size="small" :theme="row.cost === '低' ? 'success' : 'warning'" variant="light-outline">{{ row.cost }}</Tag></template>
          <template #risk="{ row }"><Tag size="small" :theme="row.risk === '低' ? 'success' : row.risk === '中' ? 'warning' : 'danger'" variant="light-outline">{{ row.risk }}</Tag></template>
          <template #status="{ row }">
            <Tag size="small" :theme="statusOf(row) === '已上线' ? 'success' : statusOf(row) === '验证中' ? 'warning' : 'default'" variant="light-outline">{{ statusOf(row) }}</Tag>
          </template>
          <template #op="{ row }">
            <Button size="small" variant="outline" :disabled="statusOf(row) === '已上线' || statusOf(row) === '验证中'" @click="openAdopt(row)">采用</Button>
          </template>
        </Table>
        <div class="oc-state__hint">
          反例（已放弃）：{{ rejected[0]?.lever }} —— {{ rejected[0]?.gain }}，质量 {{ rejected[0]?.qualityDeltaPct }}%，成本下降不能以质量换。
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">采用前必读：前后对比报告要求</div>
          <div class="oc-stack" style="font-size: 13px">
            <div>① 必须提供<strong>同评测集</strong>对比（同一版本、同一模型、同一提示词资产快照）。</div>
            <div>② 报告需含：成功率、成本、耗时三项的前后值与样本量；不接受跨评测集拼接结论。</div>
            <div>③ 质量劣化 >1% 或成功率下降 >0.5pp 即回退，并冻结该杠杆直到原因澄清。</div>
            <div>④ 未提交报告的项在 14 天后自动回退（不静默保留）。</div>
          </div>
          <CliHint command="oc eval run --suite regression --compare-baseline --lever <n>" label="生成同评测集对比" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">当前采纳状态</div>
          <InfoGrid
            :columns="2"
            :items="[
              { key: 'up', label: '已上线', value: `${levers.filter((o) => statusOf(o) === '已上线').length} 项` },
              { key: 'verifying', label: '验证中', value: `${levers.filter((o) => statusOf(o) === '验证中').length} 项`, tag: { text: '需对比报告', theme: 'warning' } },
              { key: 'planned', label: '计划中', value: `${levers.filter((o) => statusOf(o) === '计划中').length} 项` },
              { key: 'quality', label: '质量劣化项', value: `${levers.filter((o) => o.qualityDeltaPct < 0).length} 项（均在 ±1.2% 内且已评测）`, tag: { text: '受监控', theme: 'primary' } },
            ]"
          />
        </div>
      </div>

      <Dialog :visible="Boolean(target)" header="采用优化杠杆（需同评测集对比）" :footer="false" width="560px" @close="target = null">
        <div v-if="target" class="oc-stack" style="font-size: 13px">
          <div><strong>{{ target.lever }}</strong> ｜ 预估收益 {{ target.gain }} ｜ 实施成本 {{ target.cost }} ｜ 风险 {{ target.risk }}</div>
          <div class="oc-muted">依赖：{{ target.dependency }} ｜ 负责人：{{ target.owner }} ｜ 预估节省：${{ savedOf(target) }}/月（{{ target.beforeUsd }} → {{ target.afterUsd }}）</div>
          <div class="oc-muted">
            采用后将进入「验证中」：必须提交同评测集的前后对比报告（成功率 / 成本 / 耗时 + 样本量）。质量劣化 >1% 或成功率下降 >0.5pp 自动回退，不允许以质量换成本。
          </div>
          <div class="oc-flex" style="gap: 8px; justify-content: flex-end">
            <Button size="small" variant="outline" @click="target = null">取消</Button>
            <Button size="small" theme="primary" @click="adopt">确认采用</Button>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
