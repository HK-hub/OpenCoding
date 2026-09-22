<script setup lang="ts">
/** 沙箱档位配置（B-01）：五档卡 + 策略下限/上限 + clamp 选档算法。溯源：卷 07 D-SBOX-1/2 §4.1 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { sandboxTiers, sandboxPlans } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const minTier = ref('L0+');
const maxTier = ref('L2');
const strictNoDegrade = ref(false);
const editorOpen = ref(false);
const err = ref(makeError('INVALID_ARGUMENT', '策略下限高于平台最大可达档（Windows 无微虚拟机）'));

const TIERS = sandboxTiers.map((t) => t.tier);
const degraded = computed(() => sandboxPlans.filter((p) => p.degraded));

/** clamp 说明：档位 = clamp(策略下限, 风险映射(风险类, 平台能力, 工作区类型), 策略上限) */
const clampDemo = computed(() => [
  '风险类 R0/R1 → 映射 L0 / L0+',
  '风险类 R2 → 映射 L1（容器不可达时退 L0+ 并留痕）',
  '风险类 R3 → 映射 L1（网络策略 + 审计代理叠加）',
  '风险类 R4 → 映射 L2（微虚拟机；不可达则按上限降级并二次确认）',
  '风险类 R5 → 映射 L3（远程隔离节点 + 密钥代理）',
  `策略下限 = ${minTier.value}（不满足 → 拒绝执行，不降级）`,
  `策略上限 = ${maxTier.value}（超出开销上限 → 钳制到上限）`,
]);

const columns = [
  { colKey: 'planId', title: '计划', width: 100 },
  { colKey: 'toolName', title: '工具', width: 130 },
  { colKey: 'riskClass', title: '风险', width: 100 },
  { colKey: 'tier', title: '目标 → 实际', width: 160 },
  { colKey: 'degrade', title: '降级标注', width: 140 },
  { colKey: 'platform', title: '平台 / 工作区', width: 170 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = sandboxTiers.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

function save() {
  if (TIERS.indexOf(minTier.value) > TIERS.indexOf(maxTier.value)) {
    MessagePlugin.error('下限不能高于上限：请调整为「下限 ≤ 上限」后重试');
    return;
  }
  editorOpen.value = false;
  MessagePlugin.success(`档位上下限已更新：下限 ${minTier.value} / 上限 ${maxTier.value}（下一次动作生效，历史计划不变）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="沙箱档位配置"
      desc="五档隔离（L0 / L0+ / L1 / L2 / L3）：风险驱动自动选档 + 策略上下限。下限不满足一律拒绝执行（不降级）；可达但达不到风险映射则取可达档并生成 sandbox.degraded。"
      volume="卷 07"
      manifest="B-01"
      cli="oc sandbox tiers config --min L0+ --max L2 --explain"
      :status="[{ label: `下限 ${minTier}`, theme: 'primary' }, { label: `上限 ${maxTier}`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="editorOpen = true">调整上下限</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="隔离档位数" :value="sandboxTiers.length" format="raw" icon="server" />
      <StatCard label="近 24h 降级" :value="degraded.length" format="raw" icon="discount" hint="降级必须显式标注原因（不静默）" />
      <StatCard label="近 24h 拒绝执行" :value="sandboxPlans.filter((p) => p.rejected).length" format="raw" icon="close" hint="下限不满足 → 拒绝执行" />
      <StatCard label="当前强制不降级" :value="strictNoDegrade ? '开启' : '关闭'" format="raw" icon="secured" hint="开启后：达不到风险映射即拒绝（企业档推荐）" />
    </div>

    <StateShell
      :state="state"
      empty-title="档位定义缺失"
      empty-desc="沙箱档位来自内核静态定义（不可配置化）；缺失说明内核版本不匹配。"
      empty-action="重新加载"
      example-task="查看 R4 破坏性动作在 macOS 上的目标档与降级原因"
      :what="'档位配置保存失败'"
      :why="err.message"
      how="下限高于平台最大可达档时：本机将无法执行该类动作（可改用远程 L3 节点或降低下限）。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-grid oc-grid--3">
        <div v-for="t in sandboxTiers" :key="t.tier" class="oc-card">
          <div class="oc-flex oc-flex--between">
            <span class="oc-mono" style="font-size: 16px; font-weight: 700">{{ t.tier }}</span>
            <Tag size="small" variant="light-outline" :theme="t.tier === 'L0+' ? 'primary' : t.tier === 'L3' ? 'danger' : 'default'">{{ t.defaultFor }}</Tag>
          </div>
          <p style="font-size: 12px; margin: 8px 0 6px">{{ t.tech }}</p>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
            <Tag size="small" variant="light-outline">隔离强度 {{ t.isolation }}</Tag>
            <Tag size="small" variant="light-outline">启动 {{ t.startupCost }}</Tag>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 4px">
            <RiskBadge v-for="rk in t.applicableRisks" :key="rk" :level="rk" />
          </div>
          <div class="oc-muted" style="font-size: 11px; margin-top: 6px">{{ t.notes }}</div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">
            clamp 选档算法
            <CliHint command="oc sandbox select --risk R4 --platform windows --explain" />
          </h3>
          <pre class="oc-pre">档位 = clamp(策略下限, 风险映射(风险类, 平台能力, 工作区类型), 策略上限)

if 可达档 < 策略下限: 拒绝执行（不降级），返回结构化错误 + 替代路径
elif 可达档 < 风险映射: 取可达档 + 生成 sandbox.degraded（含原因，界面显式提示）
else: 使用映射档</pre>
          <div class="oc-stack" style="margin-top: 8px">
            <div v-for="line in clampDemo" :key="line" class="oc-flex" style="gap: 6px; align-items: flex-start">
              <Tag size="small" variant="outline" theme="default">规则</Tag>
              <span class="oc-mono" style="font-size: 11px">{{ line }}</span>
            </div>
          </div>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">策略上下限</h3>
          <InfoGrid :columns="1" :items="[
            { key: 'min', label: '策略下限（最少要求）', value: `${minTier}：低于该档的动作一律拒绝执行（不降级）` },
            { key: 'max', label: '策略上限（最大开销）', value: `${maxTier}：超过该档的隔离开销不采用（钳制到上限）` },
            { key: 'strict', label: '强制不降级', value: strictNoDegrade ? '开启：达不到风险映射即拒绝（NFR-S-1 零容忍档）' : '关闭：允许降级但必须留痕并提示' },
            { key: 'who', label: '配置来源', value: '租户策略 POL-TEN-02（TEN-B1 / TEN-B2）' },
          ]" />
          <div class="oc-divider" />
          <h3 class="oc-card__title">近期降级（不静默）</h3>
          <div class="oc-stack">
            <div v-for="p in degraded" :key="p.planId" class="oc-flex" style="gap: 6px; align-items: flex-start">
              <Tag size="small" variant="light-outline" theme="warning">{{ p.targetTier }} → {{ p.actualTier }}</Tag>
              <span style="font-size: 12px">{{ p.toolName }}（{{ p.platform }}）：{{ p.degradeReason }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">计划中的档位映射（样例）</h3>
        <Table row-key="planId" size="small" :data="sandboxPlans.slice(0, 6)" :columns="columns">
          <template #planId="{ row }"><span class="oc-mono">{{ row.planId }}</span></template>
          <template #riskClass="{ row }"><RiskBadge :level="row.riskClass" /></template>
          <template #tier="{ row }">
            <span class="oc-mono">{{ row.targetTier }}</span>
            <span class="oc-muted"> → </span>
            <Tooltip v-if="row.degraded" :content="row.degradeReason">
              <Tag size="small" variant="light-outline" theme="warning">{{ row.actualTier }}</Tag>
            </Tooltip>
            <Tag v-else size="small" variant="light-outline" theme="success">{{ row.actualTier }}</Tag>
          </template>
          <template #degrade="{ row }">
            <Tag v-if="row.rejected" size="small" theme="danger" variant="light-outline">拒绝执行</Tag>
            <Tag v-else-if="row.degraded" size="small" theme="warning" variant="light-outline">已降级</Tag>
            <Tag v-else size="small" theme="success" variant="light-outline">达标</Tag>
          </template>
          <template #platform="{ row }">{{ row.platform }} / {{ row.workspaceType }}</template>
        </Table>
      </div>
    </StateShell>

    <Dialog v-model:visible="editorOpen" header="调整档位上下限" width="560px" :on-confirm="save" :on-cancel="() => (editorOpen = false)">
      <div class="oc-stack">
        <div class="oc-flex" style="gap: 10px">
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">策略下限（低于此档拒绝执行）</div>
            <Select v-model="minTier" size="small" style="width: 150px" :options="TIERS.map((t) => ({ label: t, value: t }))" />
          </div>
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">策略上限（超过此档不采用）</div>
            <Select v-model="maxTier" size="small" style="width: 150px" :options="TIERS.map((t) => ({ label: t, value: t }))" />
          </div>
        </div>
        <div class="oc-flex" style="gap: 6px">
          <Tag size="small" variant="outline" theme="default" style="cursor: pointer" @click="strictNoDegrade = !strictNoDegrade">
            {{ strictNoDegrade ? '已开启' : '已关闭' }}：强制不降级
          </Tag>
          <span class="oc-muted" style="font-size: 12px">开启后：达不到风险映射即拒绝执行（更安全，可能降低可用性）</span>
        </div>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：仅对<b>后续动作</b>生效（在途执行不受影响）；提高下限可能使本机无法执行 R2+ 动作（需改远程节点）。
          可逆：可随时改回（变更记录写入审计，含操作者与理由）。
        </p>
      </div>
    </Dialog>
  </div>
</template>
