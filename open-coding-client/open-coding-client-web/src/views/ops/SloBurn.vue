<script setup lang="ts">
/**
 * SLO 与燃尽（G5-01）：5 项 SLO 卡（目标 / 当前值 / 快慢燃尽率 / 违反处置）
 * + 错误预算燃尽曲线 + 「SLO 违反即冻结发布」状态条。
 * 溯源：卷 32 / BUILD-MANIFEST G5-01
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Select, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const picked = ref(d.slo[0]?.id ?? 'slo-01');
/** 冻结发布会话：初始取数据中已违反的 SLO（负样本：SLO-05 任务完成率低于基线） */
const frozen = ref<string[]>(d.slo.filter((s) => s.frozen).map((s) => s.id));

const burning = computed(() => d.slo.filter((s) => s.burnFast.alerting || s.burnSlow.alerting));
const frozenNames = computed(() => d.slo.filter((s) => frozen.value.includes(s.id)).map((s) => s.name));

/** 燃尽曲线：按所选 SLO 的错误预算消耗速度外推 14 天剩余量（确定性） */
const burnCurve = computed(() => {
  const s = d.slo.find((x) => x.id === picked.value) ?? d.slo[0];
  const step = s.budgetUsedPct / 13;
  return [
    {
      name: `${s.name} · 错误预算剩余（%）`,
      points: Array.from({ length: 14 }, (_, i) => ({ x: `第 ${i + 1} 天`, y: Number((100 - step * i).toFixed(1)) })),
    },
  ];
});

const pickedSlo = computed(() => d.slo.find((x) => x.id === picked.value) ?? d.slo[0]);

function exportSnapshot(): void {
  const file = downloadJson({ slo: d.slo, frozen: frozen.value, exportedBy: 'ops-console' }, 'oc-slo-burn-snapshot.json');
  MessagePlugin.success(`已导出 SLO 快照：${file}`);
}

/** 解除冻结：影响全部生产发布通道，需二次确认（可随时重新冻结） */
function unfreeze(): void {
  frozen.value = [];
  MessagePlugin.warning('已解除发布冻结：发布通道恢复；若 24h 内再次违反将自动重新冻结');
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = d.slo.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="SLO 与燃尽"
      desc="5 项 SLO：协议面可用性 ≥99.9%/30d、首 token P95 ≤1.5s/7d、事件写入 P95 ≤10ms/7d、会话恢复成功率 ≥99.5%/30d、任务完成率 ≥基线/7d；违反即冻结发布。"
      volume="卷 32"
      manifest="G5-01"
      cli="oc slo status --all --window 30d"
      :status="[{ label: frozen.length ? '违反 · 冻结发布' : '全部达标', theme: frozen.length ? 'danger' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportSnapshot">导出快照</Button>
        <Popconfirm
          theme="danger"
          content="解除发布冻结：立即恢复全部生产发布通道（含灰度扩大）。影响面：违反项可能继续劣化；可逆：再次违反将自动重新冻结。"
          @confirm="unfreeze"
        >
          <Button size="small" theme="danger" variant="outline" :disabled="!frozen.length">解除冻结</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未声明任何 SLO"
      empty-desc="SLO 是冻结发布的唯一依据，未声明 SLO 时不允许开启生产发布。"
      empty-action="声明首批 SLO"
      example-task="为协议面声明「可用性 ≥99.9%/30d」并绑定违反处置"
      what="SLO 状态加载失败"
      why="指标后端（指标服务）连接超时，端上不推导达标结论，一律显示未知"
      how="可重试；若持续失败请导出诊断包并附 traceId 联系 SRE"
      trace-id="trace-slo-91f4c0"
      @retry="state = 'LOADING'"
    >
      <Alert v-if="frozen.length" theme="error" style="margin-bottom: 12px">
        <template #title>SLO 违反即冻结发布：{{ frozenNames.join('、') }}</template>
        冻结范围：全部生产发布（含灰度扩大与热修）；解除条件：连续 24h 达标 + 质量负责人复核留痕。当前阻断中，不得以「业务紧急」为由绕过。
      </Alert>

      <div class="oc-grid oc-grid--4">
        <StatCard label="SLO 总数" :value="d.slo.length" unit="项" format="raw" icon="flag" />
        <StatCard label="燃尽告警中" :value="burning.length" unit="项" format="raw" icon="sound" :lower-is-better="true" hint="快/慢燃尽率任一越线即计入" />
        <StatCard label="冻结发布中" :value="frozen.length" unit="项" format="raw" icon="lock" :lower-is-better="true" hint="违反项清零后自动解除" />
        <StatCard label="最低预算余量" :value="100 - Math.max(...d.slo.map((s) => s.budgetUsedPct))" unit="%" format="raw" icon="time" target-kind="min" :target="20" hint="低于 20% 视为燃尽预警" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">错误预算燃尽曲线</div>
            <Select v-model="picked" size="small" style="width: 200px" :options="d.slo.map((s) => ({ label: s.name, value: s.id }))" />
          </div>
          <OcChart
            type="line"
            :series="burnCurve"
            :height="200"
            format="percent"
            :threshold="{ value: 20, label: '预警线 20%', kind: 'min' }"
            aria-label="错误预算燃尽曲线"
          />
          <div class="oc-muted" style="font-size: 12px">
            目标 {{ pickedSlo?.target }}（窗口 {{ pickedSlo?.window }}）；当前 {{ pickedSlo?.current }}{{ pickedSlo?.unit }}，预算已用 {{ pickedSlo?.budgetUsedPct }}%。
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">燃尽率与违反处置</div>
          <div class="oc-stack" style="font-size: 12px">
            <div v-for="s in d.slo" :key="s.id" class="oc-flex oc-flex--wrap" style="gap: 6px">
              <span class="oc-grow">{{ s.name }}</span>
              <Tag size="small" :theme="s.burnFast.alerting ? 'danger' : 'default'" variant="light-outline">快 {{ s.burnFast.window }} · {{ s.burnFast.consumedPct }}%</Tag>
              <Tag size="small" :theme="s.burnSlow.alerting ? 'warning' : 'default'" variant="light-outline">慢 {{ s.burnSlow.window }} · {{ s.burnSlow.consumedPct }}%</Tag>
              <Tag size="small" theme="primary" variant="light-outline">{{ s.breachAction }}</Tag>
            </div>
          </div>
          <div class="oc-state__hint">燃尽率口径：窗口内错误预算消耗速度 ÷ 预算允许速度；快窗口先于慢窗口告警，避免「慢慢烧穿」无人响应。</div>
        </div>
      </div>

      <div class="oc-grid oc-grid--3" style="margin-top: 12px">
        <div v-for="s in d.slo" :key="s.id" class="oc-card" :style="frozen.includes(s.id) ? { borderColor: 'var(--td-error-color, #d54941)' } : undefined">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">{{ s.name }}</div>
            <Tag v-if="frozen.includes(s.id)" size="small" theme="danger" variant="light-outline">违反 · 已冻结发布</Tag>
            <Tag v-else size="small" theme="success" variant="light-outline">达标</Tag>
          </div>
          <div class="oc-flex" style="gap: 12px; margin-top: 6px">
            <span>目标 <b>{{ s.target }}</b></span>
            <span>当前 <b>{{ s.current }}{{ s.unit }}</b></span>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
            窗口 {{ s.window }} · 预算已用 {{ s.budgetUsedPct }}% · 负责人 {{ s.owner }}
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 6px">
            <Tag size="small" :theme="s.burnFast.alerting ? 'danger' : 'default'" variant="outline">快燃尽 {{ s.burnFast.consumedPct }}%</Tag>
            <Tag size="small" :theme="s.burnSlow.alerting ? 'warning' : 'default'" variant="outline">慢燃尽 {{ s.burnSlow.consumedPct }}%</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">违反处置：{{ s.breachAction }}</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
