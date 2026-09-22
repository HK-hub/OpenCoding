<script setup lang="ts">
/** 风险分级矩阵（P-01）：R0–R5 表 + 参数级 AST 解析说明 + 沙箱档映射。溯源：卷 06 §4.1 */
import { computed, onMounted, ref } from 'vue';
import { Button, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { riskMatrix, astParsing, summary, decisions } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const probe = ref('rm -rf $HOME');
const err = ref(makeError('INVALID_ARGUMENT', 'AST 解析器不可用（方言插件缺失）'));

const probeResult = computed(() => astParsing.examples.find((e) => e.command.includes(probe.value.trim())) ?? astParsing.examples[2]);

const riskColumns = [
  { colKey: 'risk', title: '风险类', width: 170 },
  { colKey: 'basis', title: '判定依据（示例）', width: 320 },
  { colKey: 'defaultDecision', title: '默认决策', width: 230 },
  { colKey: 'sandbox', title: '沙箱档映射', width: 130 },
  { colKey: 'note', title: '说明', ellipsis: true },
];
const astColumns = [
  { colKey: 'command', title: '命令', width: 300 },
  { colKey: 'dialect', title: '方言', width: 96 },
  { colKey: 'nodes', title: 'AST 节点（节选）', width: 320 },
  { colKey: 'mapped', title: '映射风险级', width: 110 },
  { colKey: 'reason', title: '判定理由', ellipsis: true },
];

const highRisk = computed(() => decisions.filter((d) => d.riskClass === 'R4' || d.riskClass === 'R5').length);

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = riskMatrix.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="风险分级矩阵"
      desc="静态工具级标注不足以防住 rm -rf /：风险必须参数级判定 —— 命令经 Shell 方言 AST 解析后按节点语义映射 R0–R5，无法解析时按 R2/R4 取高。"
      volume="卷 06"
      manifest="P-01"
      cli="oc permission risk explain 'rm -rf $HOME' --dialect bash"
      :status="[{ label: '参数级判定', theme: 'primary' }, { label: '不静默降级', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="refresh">重新载入矩阵</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="风险类" :value="riskMatrix.length" format="raw" icon="secured" hint="R0 只读 → R5 敏感" />
      <StatCard label="近 24h 高风险决策" :value="highRisk" format="raw" icon="flag" hint="R4 破坏性 / R5 敏感" />
      <StatCard label="ASK 占比" :value="summary.askRatio" format="percent" icon="help" hint="打扰与风险成正比（高风险才打断）" />
      <StatCard label="AST 解析样例" :value="astParsing.examples.length" format="raw" icon="code" hint="含 POSIX sh / bash / PowerShell" />
    </div>

    <StateShell
      :state="state"
      empty-title="风险矩阵未加载"
      empty-desc="矩阵来自内核静态定义（不可配置化），未加载说明内核版本不匹配。"
      empty-action="重新载入"
      example-task="解释 git push --force origin main 的风险判定"
      :what="'风险矩阵加载失败'"
      :why="err.message"
      how="解析器不可用不影响既有决策（矩阵为静态表）；重试或检查内核版本。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">
          六档矩阵（判定依据 / 默认决策 / 沙箱档映射）
          <CliHint command="oc permission risk matrix --json" label="导出矩阵" />
        </h3>
        <Table row-key="risk" size="small" :data="riskMatrix" :columns="riskColumns">
          <template #risk="{ row }">
            <div class="oc-stack" style="gap: 2px">
              <RiskBadge :level="row.risk" />
              <span class="oc-muted" style="font-size: 11px">{{ row.label }}</span>
            </div>
          </template>
          <template #basis="{ row }">
            <ul style="margin: 0; padding-left: 16px; font-size: 12px">
              <li v-for="b in row.basis" :key="b">{{ b }}</li>
            </ul>
          </template>
          <template #defaultDecision="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.risk === 'R0' ? 'success' : row.risk === 'R5' ? 'danger' : row.risk === 'R4' ? 'warning' : 'primary'">
              {{ row.defaultDecision }}
            </Tag>
          </template>
          <template #sandbox="{ row }">
            <Tooltip :content="row.sandboxNote">
              <Tag size="small" variant="light-outline" class="oc-mono">{{ row.sandboxTier }}</Tag>
            </Tooltip>
          </template>
          <template #note="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.note }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">沙箱档映射（风险 → 隔离强度）</h3>
          <InfoGrid :columns="1" :items="riskMatrix.map((r) => ({ key: r.risk, label: `${r.risk} ${r.label}`, value: `${r.sandboxTier} · ${r.sandboxNote}` }))" />
          <div class="oc-divider" />
          <p class="oc-muted" style="font-size: 12px; margin: 0">
            选档算法：<span class="oc-mono">档位 = clamp(策略下限, 风险映射(风险类, 平台能力, 工作区类型), 策略上限)</span>；不满足下限 → 拒绝执行（不降级）；可达但达不到映射 → 取可达档 + 生成 sandbox.degraded 事件（界面显式提示）。
          </p>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">参数级 AST 解析（交互解释）</h3>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 8px">
            <Select v-model="probe" size="small" style="width: 330px" :options="astParsing.examples.map((e) => ({ label: e.command, value: e.command }))" />
            <RiskBadge :level="probeResult.mapped" show-desc />
          </div>
          <JsonBlock :value="{ command: probeResult.command, dialect: probeResult.dialect, nodes: probeResult.nodes, mapped: probeResult.mapped, reason: probeResult.reason }" :collapse-over="200" label="解析结果" />
          <p class="oc-muted" style="font-size: 12px; margin: 8px 0 0">{{ astParsing.note }}</p>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">AST 解析样例集（判定用例）</h3>
        <Table row-key="command" size="small" :data="astParsing.examples" :columns="astColumns">
          <template #command="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.command }}</span></template>
          <template #dialect="{ row }"><Tag size="small" variant="light-outline">{{ row.dialect }}</Tag></template>
          <template #nodes="{ row }">
            <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.nodes.join(' → ') }}</span>
          </template>
          <template #mapped="{ row }"><RiskBadge :level="row.mapped" /></template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
