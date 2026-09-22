<script setup lang="ts">
/**
 * A-07 能力自省：可用工具 / 权限上限 / 预算信封 / 环境探测（模型、沙箱、连接、知识源）。
 * 用途：让 Agent 与用户都能在动作前知道「我现在能做什么、还剩多少预算」，避免盲目尝试与越界（卷 12 §7）。
 * 溯源：卷 12 D-AG-9 / D-AG-10 / BUILD-MANIFEST A-07
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.agent;

const state = ref<UiStateKind>('LOADING');
const probed = ref(false);

/** 可用工具（当前会话内生效的工具子集 = 模式子集 ∩ Agent 定义 allow − deny） */
const TOOLS = [
  { name: 'read_file', family: '文件', risk: 'R0', enabled: true, note: '工作区内只读，支持行/字节范围' },
  { name: 'search', family: '检索', risk: 'R0', enabled: true, note: '三路混合检索（符号路降级中）' },
  { name: 'symbol_graph', family: '检索', risk: 'R0', enabled: true, note: '符号与结构边查询' },
  { name: 'edit_file', family: '文件', risk: 'R1', enabled: true, note: '工作区内原子写 + 校验和' },
  { name: 'run_tests', family: '执行', risk: 'R2', enabled: true, note: '沙箱 L1，资源限制 2C4G' },
  { name: 'run_migration_dryrun', family: '执行', risk: 'R2', enabled: true, note: '仅 dry-run；apply 需审批' },
  { name: 'network_egress', family: '网络', risk: 'R3', enabled: false, note: '当前会话未授权出网（域名白名单为空）' },
  { name: 'git_push', family: 'git', risk: 'R4', enabled: false, note: 'deny 列表命中：需人类执行并双人评审' },
  { name: 'deploy_prod', family: '发布', risk: 'R4', enabled: false, note: '企业策略禁止；仅发布负责人可执行' },
  { name: 'sandbox_probe', family: '安全', risk: 'R1', enabled: true, note: '只读探测；不允许出网' },
];

/** 环境探测结果 */
const ENV = [
  { item: '模型', value: 'claude-sonnet-4.5（Anthropic 协议，缓存启用）', status: 'ok' },
  { item: '备用模型', value: '未配置（不做 fallback 链，按 retryable 重试）', status: 'info' },
  { item: '沙箱档位', value: 'L1（容器 + 只读挂载 + 无出网）', status: 'ok' },
  { item: '平台能力', value: 'Linux：进程/网络/快照 全部可用', status: 'ok' },
  { item: '工作区', value: 'local · /repo/opencoding（写范围：src/**、docs/**）', status: 'ok' },
  { item: '知识源', value: `${data ? 12 : 0} 个连接器；符号图索引重建中（62%）`, status: 'warn' },
  { item: '连接状态', value: 'CONNECTED（事件 seq 128432，无丢帧）', status: 'ok' },
  { item: '待审批', value: '3 项（审批通道：桌面 + IM）', status: 'warn' },
];

const guard = data.guard;
const toolRows = computed(() => TOOLS);
const enabledTools = computed(() => TOOLS.filter((t) => t.enabled).length);

const budgetUsage = computed(() => ({
  step: Math.round((guard.used.steps / guard.limits.steps) * 100),
  time: Math.round((guard.used.durationMs / guard.limits.durationMs) * 100),
  cost: Math.round((guard.used.cost / guard.limits.cost) * 100),
}));

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function riskTheme(r: string) {
  return r === 'R0' ? 'success' : r === 'R1' ? 'primary' : r === 'R2' ? 'warning' : r === 'R3' ? 'warning' : 'danger';
}

function runProbe() {
  probed.value = true;
  MessagePlugin.success('环境探测完成：模型 / 沙箱 / 工作区 / 知识源 / 连接 五项已刷新（探测只读，无副作用）');
}

/** 越界处置决策记录：每次点击落一条页面可见记录（序号 / 决策 / 生效范围 / 时间），不以提示代替状态 */
const decisions = ref<{ seq: number; action: string; detail: string; at: string }[]>([]);
let decisionSeq = 0;

/** 重复阈值放宽标记（仅本次任务生效，体现在「重复动作检测」的阈值说明中） */
const relaxed = ref(false);

/** 严格计划模式标记（先出计划再执行，体现在页头状态徽标） */
const strictPlan = ref(false);

/** 停止并保留标记（保留已完成部分与检查点，同一按钮可恢复运行） */
const stopped = ref(false);

/** 登记一条越界处置决策 */
function recordDecision(action: string, detail: string) {
  decisionSeq += 1;
  decisions.value.push({ seq: decisionSeq, action, detail, at: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
}

/** 继续并放宽重复阈值：放宽仅本次任务生效，放宽后恢复运行并登记决策 */
function continueAndRelax() {
  relaxed.value = true;
  stopped.value = false;
  recordDecision('继续并放宽', '重复动作阈值 5 → 8（仅本次任务生效）');
  MessagePlugin.info('已请求继续并放宽重复阈值（本次仅对当前任务生效）');
}

/** 切严格计划：后续步骤先出计划再执行，计划外动作需确认，并登记决策 */
function switchStrictPlan() {
  strictPlan.value = true;
  stopped.value = false;
  recordDecision('切严格计划', '先出计划再执行；计划外动作需人工确认');
  MessagePlugin.info('已切换为严格计划模式：先出计划再执行');
}

/** 停止并保留 / 恢复运行：翻转停止标记并登记决策，停止期间保留检查点与已完成部分 */
function stopAndKeep() {
  if (stopped.value) {
    stopped.value = false;
    recordDecision('恢复运行', '从检查点 ckpt-04 恢复，按当前模式继续执行');
    MessagePlugin.success('已恢复运行：从检查点 ckpt-04 继续（停止期间未消耗预算）');
    return;
  }
  stopped.value = true;
  recordDecision('停止并保留', '保留已完成部分与检查点 ckpt-04，可随时恢复');
  MessagePlugin.warning('已停止：保留已完成部分与检查点，可随时恢复');
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="能力自省"
      desc="动作前先自省：当前可用工具、权限上限、剩余预算与环境能力一目了然；不可用的能力显式标注原因，不靠试错。"
      volume="卷 12"
      manifest="A-07"
      cli="oc agent introspect --tools --budget --env"
      :status="[
        { label: `${enabledTools}/${toolRows.length} 工具可用`, theme: 'primary' },
        { label: `预算剩余 ${100 - budgetUsage.cost}%`, theme: budgetUsage.cost > 80 ? 'danger' : 'success' },
        { label: stopped ? '已停止（保留检查点 ckpt-04）' : strictPlan ? '严格计划模式' : '标准执行模式', theme: stopped ? 'danger' : strictPlan ? 'warning' : 'default' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="state === 'LOADING'" @click="runProbe"><OcIcon name="refresh" size="12px" /> 重新探测环境</Button>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="可用工具" :value="enabledTools" :target="toolRows.length" unit="/ 项" format="raw" icon="tools" hint="模式子集 ∩ 定义 allow − deny" />
      <StatCard label="权限上限" :value="ui.currentMode" format="raw" icon="lock" hint="R4/R5 动作即使自治档也强制确认或拒绝" />
      <StatCard label="步数用量" :value="budgetUsage.step" unit="%" icon="time" :lower-is-better="true" hint="三重上限：步数 / 时长 / 成本同时生效" />
      <StatCard label="成本用量" :value="guard.used.cost" :target="guard.limits.cost" format="cost" icon="discount" hint="预算信封由父任务划拨，子 Agent 独立结算" />
    </div>

    <StateShell
      :state="state"
      stage="探测模型 / 沙箱 / 工作区…"
      empty-title="尚无会话上下文"
      empty-desc="能力自省绑定当前会话（模式、工作区、预算）；无活跃会话时只能展示全局能力。"
      empty-action="打开会话工作台"
      example-task="在动手前确认「能否出网、能否跑测试、剩余预算多少」"
      what="能力自省失败"
      why="探测链路部分不可用（沙箱服务或工作区连接超时）。"
      how="可重试；失败的能力项会标注「未知」而非默认「可用」，避免盲目执行。"
      trace-id="trace-intro-1d8be4"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            可用工具（{{ enabledTools }} / {{ toolRows.length }}）
            <Tooltip content="不可用工具会显式给出原因（deny 命中 / 未授权 / 企业禁止），不静默隐藏">
              <Tag size="small" variant="light-outline">显式原因</Tag>
            </Tooltip>
          </h3>
          <Table
            :data="toolRows"
            :columns="[
              { colKey: 'name', title: '工具', width: 190, cell: 'cell' },
              { colKey: 'family', title: '族', width: 78 },
              { colKey: 'risk', title: '风险', width: 78, cell: 'cell' },
              { colKey: 'enabled', title: '可用', width: 90, cell: 'cell' },
              { colKey: 'note', title: '说明 / 不可用原因', cell: 'cell' },
            ]"
            row-key="name"
            size="small"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'name'"><span class="oc-mono" style="font-size: 12px">{{ row.name }}</span></template>
              <template v-else-if="col.colKey === 'risk'">
                <Tag size="small" :theme="riskTheme(row.risk)" variant="light-outline">{{ row.risk }}</Tag>
              </template>
              <template v-else-if="col.colKey === 'enabled'">
                <Tag size="small" :theme="row.enabled ? 'success' : 'default'">{{ row.enabled ? '可用' : '不可用' }}</Tag>
              </template>
              <template v-else-if="col.colKey === 'note'">
                <span :class="row.enabled ? 'oc-secondary' : ''" style="font-size: 12px">{{ row.note }}</span>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            环境探测
            <Tag size="small" :theme="probed ? 'success' : 'default'" variant="light-outline">{{ probed ? '刚刚探测' : '首屏缓存' }}</Tag>
          </h3>
          <div v-for="e in ENV" :key="e.item" class="oc-flex" style="gap: 8px; align-items: flex-start; margin-bottom: 6px">
            <OcIcon
              :name="e.status === 'ok' ? 'check' : e.status === 'warn' ? 'error' : 'help'"
              size="13px"
              :color="e.status === 'ok' ? 'var(--oc-sev-ok)' : e.status === 'warn' ? 'var(--oc-sev-warn)' : 'var(--td-text-color-placeholder)'"
            />
            <div>
              <div style="font-size: 13px">{{ e.item }}</div>
              <div class="oc-secondary" style="font-size: 12px">{{ e.value }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            预算信封
            <Tag size="small" variant="outline">步数 / 时长 / 成本三重上限</Tag>
          </h3>
          <div class="oc-stack">
            <div>
              <div class="oc-flex--between" style="font-size: 12px">
                <span>步数 {{ guard.used.steps }} / {{ guard.limits.steps }}</span>
                <span class="oc-muted">{{ budgetUsage.step }}%</span>
              </div>
              <Progress :percentage="budgetUsage.step" theme="line" :status="budgetUsage.step > 80 ? 'error' : 'active'" />
            </div>
            <div>
              <div class="oc-flex--between" style="font-size: 12px">
                <span>时长 {{ Math.round(guard.used.durationMs / 60000) }}min / {{ Math.round(guard.limits.durationMs / 60000) }}min</span>
                <span class="oc-muted">{{ budgetUsage.time }}%</span>
              </div>
              <Progress :percentage="budgetUsage.time" theme="line" :status="budgetUsage.time > 80 ? 'error' : 'active'" />
            </div>
            <div>
              <div class="oc-flex--between" style="font-size: 12px">
                <span>成本 ${{ guard.used.cost.toFixed(2) }} / ${{ guard.limits.cost.toFixed(2) }}</span>
                <span class="oc-muted">{{ budgetUsage.cost }}%</span>
              </div>
              <Progress :percentage="budgetUsage.cost" theme="line" :status="budgetUsage.cost > 80 ? 'error' : 'active'" />
            </div>
          </div>
          <div class="oc-divider" />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'progress', label: '进展度量', value: `${(guard.progress * 100).toFixed(0)}%（新增信息量 + 完成度变化）` },
              { key: 'drift', label: '漂移分', value: `${guard.driftScore}（阈值 0.3；超阈值暂停并请求决策）` },
              { key: 'repeat', label: '重复动作检测', value: guard.repeatedActions.map((r) => `${r.tool}×${r.count}`).join('、') + (relaxed ? '（阈值已放宽：5 → 8，仅本次任务）' : '（阈值 5）') },
            ]"
          />
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            越界摘要（触发上限时的标准输出）
            <Tag size="small" theme="warning" variant="light-outline">不静默终止</Tag>
          </h3>
          <div class="oc-kv" style="font-size: 12px">
            <span class="oc-kv__k">做了什么</span><span>{{ guard.outOfBoundsSummary.what }}</span>
            <span class="oc-kv__k">卡在哪</span><span>{{ guard.outOfBoundsSummary.blockedAt }}</span>
            <span class="oc-kv__k">建议下一步</span><span>{{ guard.outOfBoundsSummary.nextStep }}</span>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
            <Button size="small" theme="primary" variant="outline" @click="continueAndRelax">继续并放宽</Button>
            <Button size="small" variant="outline" @click="switchStrictPlan">切严格计划</Button>
            <Button size="small" variant="outline" @click="stopAndKeep">{{ stopped ? '恢复运行' : '停止并保留' }}</Button>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag v-if="relaxed" size="small" theme="warning" variant="light-outline">重复阈值已放宽（仅本次任务）</Tag>
            <Tag v-if="strictPlan" size="small" theme="primary" variant="light-outline">严格计划模式已生效</Tag>
            <Tag v-if="stopped" size="small" theme="danger" variant="light-outline">已停止 · 检查点 ckpt-04 可恢复</Tag>
          </div>
          <!-- 决策记录：越界处置的「已请求」以页面可见记录为准（含生效范围与时间） -->
          <div v-if="decisions.length" class="oc-divider" />
          <div v-if="decisions.length" class="oc-muted" style="font-size: 12px">
            <div style="margin-bottom: 2px">处置决策记录（{{ decisions.length }} 条）：</div>
            <div v-for="d in decisions" :key="d.seq" class="oc-mono" style="font-size: 11px">#{{ d.seq }} {{ d.action }} · {{ d.detail }}（{{ d.at }}）</div>
          </div>
          <div class="oc-divider" />
          <div class="oc-muted" style="font-size: 12px">
            能力自省用于「动作前」判断：不可用能力会给出替代路径（例如无出网 → 使用本地嵌入；无 apply 权限 → 生成脚本交人类执行）。
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
