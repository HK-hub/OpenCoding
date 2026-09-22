<script setup lang="ts">
/**
 * 逃逸处置告警（B-13 / 卷 07 D-SBOX-13 · NFR-S-1 零容忍）：一条逃逸迹象告警（CRITICAL 严重度 / 检测方式 /
 * 时间 / 受影响会话）+ 五步处置时间线；四个处置动作（终止沙箱 / 冻结会话 / 通知安全值班 / 导出取证包）
 * 均以 Popconfirm 说明后果与不可逆性；附最近隔离与逃逸演练记录，并展示「未检测到逃逸」正常态。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { violations, securityEvents, egressRecords } = toolData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(3);
const err = ref(makeError('SANDBOX_DENIED', '逃逸检测服务心跳丢失（监控通道不可达）'));

/** 告警来源：逃逸违规 VIO-6008 + 安全事件 SEC-7024 + 出网拒绝记录 EG-9004 */
const escapeViolation = violations.find((v) => v.kind === '沙箱逃逸迹象');
const escapeEvent = securityEvents.find((e) => e.eventId === 'SEC-7024');
const escapeEgress = egressRecords.find((e) => e.recordId === 'EG-9004');
const lastScan = new Date(Date.now() - 6 * 60_000).toLocaleString('zh-CN');
const alertSeverity = escapeViolation?.severity === 'P0' ? 'CRITICAL' : 'HIGH';
const alertSession = escapeEvent?.actor ?? '（未知来源会话）';

/** 五步处置时间线：检测已完成，其余动作由下方按钮执行并推进进度 */
type Step = { id: string; name: string; desc: string; done: boolean };
const steps = ref<Step[]>([
  { id: 'detect', name: '检测与判定', desc: '访问云元数据端点 169.254.169.254（凭证明文窃取路径）→ 命中 NET-011，触发疑似逃逸链路评估', done: true },
  { id: 'terminate', name: '立即终止沙箱', desc: '销毁当前沙箱实例并断开执行通道；不可逆：未落盘数据、运行中进程与内存态全部丢失', done: false },
  { id: 'freeze', name: '冻结会话', desc: '禁止新指令与新工具调用，执行中动作在安全点停止；上下文与记忆保留（可解冻）', done: false },
  { id: 'notify', name: '告警（P0 安全值班）', desc: '穿透静默时段通知值班人员；通知发出后不可撤回，内容进入审计', done: false },
  { id: 'forensics', name: '取证与人工复核', desc: '打包命令历史、出网记录与沙箱元数据（只读），由安全工程组人工复核', done: false },
]);
const doneCount = computed(() => steps.value.filter((s) => s.done).length);

function execute(id: string, label: string) {
  steps.value = steps.value.map((s) => (s.id === id ? { ...s, done: true } : s));
  MessagePlugin.warning(`${label}已执行：处置动作写入安全事件与审计（处置进度 ${doneCount.value}/${steps.value.length}，不可静默跳过后续步骤）`);
}

/** 隔离与逃逸演练记录（局部确定性数据，含 2 条未达标样本） */
const isoDaysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60_000).toISOString();
const drills = [
  { id: 'DRILL-31', at: isoDaysAgo(3), source: '季度桌面端演练（L0+）', result: '通过', item: '冻结会话 12s 内完成（目标 ≤30s）；上下文保留验证通过' },
  { id: 'DRILL-27', at: isoDaysAgo(10), source: '容器档 L1 演练（云元数据端点）', result: '部分失败', item: '终止沙箱后残留 1 个孤儿进程 → 改进：进程组回收先于容器销毁' },
  { id: 'DRILL-19', at: isoDaysAgo(24), source: '取证包完整性抽查', result: '未通过', item: '取证包缺少出网记录关联 ID → 改进：取证清单将 egress.commandId 列为必填' },
  { id: 'DRILL-11', at: isoDaysAgo(45), source: '逃逸检测规则回归（DR-005 / NET-011）', result: '通过', item: '反弹 Shell 与元数据端点规则均命中，无误报' },
];
const failedDrills = drills.filter((d) => d.result !== '通过').length;
const shownDrills = computed(() => drills.slice(0, pageSize.value));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = !escapeViolation || !escapeEvent ? 'EMPTY' : drills.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 240);
}
onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="逃逸处置告警"
      desc="零容忍（NFR-S-1）：检测到逃逸迹象（哪怕 1 次）即执行五步处置——终止沙箱 → 冻结会话 → 告警 → 取证 → 人工复核；不提供「观察后再处置」的降级路径。"
      volume="卷 07" manifest="B-13" cli="oc sandbox escape handle --alert ESC-0001 --playbook zero-tolerance"
      :status="[{ label: `逃逸告警 ${escapeViolation ? 1 : 0} 条（24h）`, theme: 'danger' }, { label: `处置进度 ${doneCount} / ${steps.length}`, theme: doneCount >= steps.length ? 'success' : 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <CliHint command="oc sandbox escape drill --tier L0+ --assert freeze<=30s" label="复跑处置演练" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="告警严重度" :value="alertSeverity" format="raw" icon="secured" hint="CRITICAL：凭证明文窃取路径，必须人工复核后才可关闭" />
      <StatCard label="当前监控状态" :value="'正常（未检测到逃逸）'" format="raw" icon="check" :hint="`最近全量扫描 ${lastScan}；每 15 分钟增量 + 每日全量`" />
      <StatCard label="处置进度" :value="doneCount" unit="步" format="raw" icon="task" :hint="`共 ${steps.length} 步，零容忍剧本不允许跳过`" />
      <StatCard label="演练记录" :value="drills.length" format="raw" icon="history" :hint="`含 ${failedDrills} 条未达标项（已登记改进）`" />
    </div>

    <StateShell
      :state="state" empty-title="当前没有逃逸告警" empty-desc="未检测到逃逸迹象：零容忍策略下「无告警」即为正常态；检测规则与围栏持续生效。"
      empty-action="重新拉取告警" example-task="在演练环境复跑 NET-011（云元数据端点）验证告警链路"
      :what="'逃逸监控通道不可达'" :why="err.message" how="心跳丢失时按「未知即危险」处理：沙箱路由自动收紧（新执行请求排队待人工确认），不静默放行。"
      :trace-id="err.traceId" :collapsed-summary="`演练记录共 ${drills.length} 条，已折叠展示前 ${pageSize} 条`" :page-size="pageSize"
      @retry="refresh" @load-more="pageSize = drills.length" @empty-action="refresh()"
    >
      <div class="oc-card">
        <div class="oc-card__title">
          <span class="oc-flex oc-flex--wrap" style="gap: 6px">
            <b>逃逸告警示例（{{ escapeViolation?.violationId ?? 'VIO-6008' }}）</b>
            <Tag size="small" variant="light-outline" theme="danger">{{ alertSeverity }}</Tag>
            <Tag size="small" variant="light-outline" theme="warning">疑似逃逸链路评估</Tag>
            <CopyableId :id="escapeViolation?.traceId ?? 'trace-na'" label="复制 traceId" />
          </span>
          <Tag size="small" variant="light-outline" theme="default">来源：{{ escapeEvent?.eventId ?? 'SEC-7024' }} / {{ escapeEgress?.recordId ?? 'EG-9004' }}</Tag>
        </div>
        <InfoGrid
          :columns="2" :items="[
            { key: 'severity', label: '严重度', value: alertSeverity, tag: { text: 'P0 · 立即处置', theme: 'danger' } }, { key: 'detect', label: '检测方式', value: `${escapeEgress?.blockedBy ?? '云元数据端点访问检测'}（策略 ${escapeEgress?.policyRef ?? 'NET-011'}）` },
            { key: 'at', label: '检测时间', value: escapeViolation ? new Date(escapeViolation.at).toLocaleString('zh-CN') : '—' }, { key: 'session', label: '受影响会话', value: alertSession },
            { key: 'cmd', label: '触发命令', value: escapeViolation?.command ?? '—', block: true, mono: true }, { key: 'cmdId', label: '来源命令 ID', value: escapeEgress?.commandId ?? '—', copyable: true },
            { key: 'repeat', label: '重复次数', value: `${escapeViolation?.repeated ?? 0} 次（连续尝试 → 判定为意图性行为，而非误触）` }, { key: 'evidence', label: '判定证据', value: escapeViolation?.evidence ?? '—' },
          ]"
        />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">处置步骤时间线（{{ doneCount }} / {{ steps.length }} 已完成）</div>
          <div v-for="s in steps" :key="s.id" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 8px">
            <Tag size="small" variant="light-outline" :theme="s.done ? 'success' : 'warning'">{{ s.done ? '已执行' : '待执行' }}</Tag>
            <b style="font-size: 13px">{{ s.name }}</b>
            <span class="oc-secondary" style="font-size: 12px">{{ s.desc }}</span>
          </div>
          <div class="oc-muted" style="font-size: 12px">按剧本顺序推进：上一步未确认完成时后续步骤不可跳过（避免「冻结但未终止」的半处置状态）。</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">处置动作（后果与不可逆性需确认）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Popconfirm theme="danger" content="终止沙箱：立即销毁当前沙箱实例并断开执行通道。不可逆——未落盘数据、运行中进程与内存态全部丢失；已生成的快照与产物保留。" @confirm="execute('terminate', '终止沙箱')">
              <Button size="small" theme="danger" variant="outline">终止沙箱</Button>
            </Popconfirm>
            <Popconfirm theme="warning" content="冻结会话：禁止新指令与新工具调用，执行中动作在安全点停止。可解冻（上下文与记忆保留），冻结期间该会话完全不可用。" @confirm="execute('freeze', '冻结会话')">
              <Button size="small" variant="outline">冻结会话</Button>
            </Popconfirm>
            <Popconfirm theme="warning" content="通知安全值班：通过 P0 通道穿透静默时段呼叫值班人员。通知发出后不可撤回，内容与接收人进入审计。" @confirm="execute('notify', '通知安全值班')">
              <Button size="small" variant="outline">通知安全值班</Button>
            </Popconfirm>
            <Popconfirm content="导出取证包：打包命令历史、出网记录、沙箱元数据与哈希清单（只读动作，不改动证据链）。可重复导出；包内仅含密钥引用，不含明文。" @confirm="execute('forensics', '导出取证包')">
              <Button size="small" variant="outline">导出取证包</Button>
            </Popconfirm>
          </div>
          <div class="oc-divider" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Tag size="small" theme="success" variant="light-outline">未检测到逃逸（当前实时）</Tag>
            <span class="oc-secondary" style="font-size: 12px">最近全量扫描 {{ lastScan }}；本次告警为历史回放样本，当前监控通道无逃逸迹象。</span>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">最近的隔离 / 逃逸演练记录</div>
        <Table
          row-key="id" size="small" :data="shownDrills"
          :columns="[
            { colKey: 'at', title: '时间', width: 180 }, { colKey: 'source', title: '来源', width: 260 },
            { colKey: 'result', title: '结果', width: 110 }, { colKey: 'item', title: '改进项', ellipsis: true },
          ]"
        >
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #result="{ row }">
            <Tooltip :content="row.result === '通过' ? '处置链路全部达标' : '存在未达标项，已登记改进并跟踪闭环'">
              <Tag size="small" variant="light-outline" :theme="row.result === '通过' ? 'success' : row.result === '部分失败' ? 'warning' : 'danger'">{{ row.result }}</Tag>
            </Tooltip>
          </template>
          <template #item="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.item }}</span></template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
