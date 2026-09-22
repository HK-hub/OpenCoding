<script setup lang="ts">
/**
 * 混沌实验 C1–C10（Y-01）：每项实验声明注入方式、期望行为、假设、观测指标与结论；
 * 「记录结论」必须填写假设与观测指标，否则保存被拒绝（无假设的实验没有可判定结论的基准）。
 * 溯源：卷 26 / BUILD-MANIFEST Y-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Dialog, MessagePlugin, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

type Verdict = '通过' | '部分通过' | '未通过' | '待记录';
interface ChaosCase {
  id: string; name: string; inject: string; expect: string; hypothesis: string; metric: string; verdict: Verdict; improvement?: string;
}

const CASES_SEED: ChaosCase[] = [
  { id: 'C1', name: '模型端点延迟注入', inject: '在模型网关注入 200–800ms 抖动，P99 拉至 2s', expect: '超时前重试/降级，不重复副作用；用户可见阶段文案', hypothesis: '重试装饰器在 P99 抖动下仍可完成任务，成本上升 ≤15%', metric: '任务成功率、重试次数、成本变化', verdict: '通过' },
  { id: 'C2', name: '模型返回畸形流', inject: '在 SSE 流中插入非法 JSON 帧与截断帧', expect: '解析失败即恢复/重试，不写入半截产物', hypothesis: '恢复后不产生重复写入（幂等键生效）', metric: '失败任务数、重复副作用检出数', verdict: '通过' },
  { id: 'C3', name: '事件写入失败', inject: '对事件存储注入 30% 写失败并持续 15 分钟', expect: '有界重试 + 死信队列；关键事件不丢', hypothesis: '恢复后自动追平，不出现重复消费', metric: '死信数量、追平耗时、重复消费数', verdict: '通过' },
  { id: 'C4', name: '消费者滞后', inject: '人为放慢消费者至 0.2x 速度并持续 30 分钟', expect: '背压生效、内存水位受控、滞后触发告警', hypothesis: '滞后恢复后无需人工干预，水位不超 80%', metric: '滞后秒数、内存水位峰值', verdict: '通过' },
  { id: 'C5', name: '沙箱不可用', inject: '关闭沙箱执行器（模拟镜像拉取失败）', expect: '任务安全暂停并给替代路径，禁止裸跑', hypothesis: '恢复后续跑不重复副作用', metric: '暂停任务数、越界执行次数（应为 0）', verdict: '通过' },
  { id: 'C6', name: '缓存全部失效', inject: '清空 Redis 全部键并禁止预热', expect: '降级读 DB，性能下降但不故障；成本惩罚被量化', hypothesis: '关键路径延迟 ≤2x 基线，不触发熔断', metric: 'P95 延迟倍数、DB 负载、成本变化', verdict: '部分通过', improvement: 'P95 达 2.4x 超假设：补充本地二级缓存（W38）' },
  { id: 'C7', name: '时钟漂移', inject: '将节点时钟向前偏移 90 秒', expect: '令牌过期/签名校验不误判；审计时间线可解释', hypothesis: '漂移 ≤2 分钟时认证可用且审计可回溯', metric: '认证失败率、审计链连续性', verdict: '通过' },
  { id: 'C8', name: '磁盘写入受阻', inject: '临时回收工作区磁盘写权限 10 分钟', expect: '显式失败并保留草稿，不静默丢内容', hypothesis: '失败可恢复且草稿零丢失', metric: '数据丢失量（应 0）、恢复耗时', verdict: '通过' },
  { id: 'C9', name: '并发风暴', inject: '同一租户 5 分钟提交 10x 常规并发', expect: '排队与公平调度；配额与成本双保护', hypothesis: '无任务被静默丢弃，等待 P95 ≤3 分钟', metric: '排队时长 P95、拒绝率、公平性', verdict: '部分通过', improvement: '等待 P95 达 4.2 分钟：调整调度权重并增加公平队列（W39）' },
  { id: 'C10', name: '插件恶意行为', inject: '装载带越权/外联/超时行为的插件', expect: '权限校验拦截、扩展点隔离与熔断', hypothesis: '', metric: '', verdict: '待记录', improvement: '隔离缺失（同 J11），修复前禁止第三方插件进入生产' },
];

const cases = ref<ChaosCase[]>(CASES_SEED.map((c) => ({ ...c })));
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(8);
const dialogOpen = ref(false);
const activeId = ref('C10');
const draftHypothesis = ref('');
const draftMetric = ref('');
const draftVerdict = ref<Verdict>('待记录');
const fieldErrors = ref<Record<string, string>>({});
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '混沌注入器不可达（chaos-agent 未注册到当前集群）'));

const verdictTheme: Record<Verdict, 'success' | 'warning' | 'danger' | 'default'> = { 通过: 'success', 部分通过: 'warning', 未通过: 'danger', 待记录: 'default' };
const columns = [
  { colKey: 'id', title: '编号', width: 70 }, { colKey: 'name', title: '名称', width: 150 },
  { colKey: 'inject', title: '注入方式', width: 260 }, { colKey: 'expect', title: '期望行为', width: 260 },
  { colKey: 'hypothesis', title: '假设', width: 240 }, { colKey: 'metric', title: '观测指标', width: 220 },
  { colKey: 'verdict', title: '结论', width: 100 }, { colKey: 'ops', title: '记录', width: 90 },
];
const shown = computed(() => cases.value.slice(0, pageSize.value));
const countBy = (v: Verdict) => cases.value.filter((c) => c.verdict === v).length;
const stats = computed(() => ({ passed: countBy('通过'), partial: countBy('部分通过'), failed: countBy('未通过'), pending: countBy('待记录'), improvements: cases.value.filter((c) => c.improvement).length }));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = cases.value.length > pageSize.value ? 'EDGE_DATA' : cases.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
}
function openRecord(c: ChaosCase) {
  activeId.value = c.id; draftHypothesis.value = c.hypothesis; draftMetric.value = c.metric;
  draftVerdict.value = c.verdict === '待记录' ? '通过' : c.verdict;
  fieldErrors.value = {}; dialogOpen.value = true;
}

/** 记录结论：缺假设或缺观测指标即拒绝保存（没有判定基准的结论不可归档） */
function saveVerdict() {
  const errors: Record<string, string> = {};
  if (!draftHypothesis.value.trim()) errors.hypothesis = '假设必填：没有假设就无法判定实验通过或推翻什么';
  if (!draftMetric.value.trim()) errors.metric = '观测指标必填：没有指标就无法复核结论（禁止主观「看起来正常」）';
  fieldErrors.value = errors;
  if (Object.keys(errors).length) return;
  cases.value = cases.value.map((c) => (c.id === activeId.value ? { ...c, hypothesis: draftHypothesis.value, metric: draftMetric.value, verdict: draftVerdict.value } : c));
  dialogOpen.value = false;
  MessagePlugin.success(`${activeId.value} 结论已记录：${draftVerdict.value}（假设与观测指标已归档）`);
}
onMounted(() => { refresh(); ui.setViewState({ state: 'NORMAL' }); });
</script>

<template>
  <div class="oc-page">
    <PageHeader title="混沌实验" desc="C1–C10 常态化注入：先写假设与观测指标，再跑实验；结论只能由数据判定，未记录假设的实验不允许归档。" volume="卷 26" manifest="Y-01" cli="oc quality chaos list && oc quality chaos record C10 --hypothesis ... --metric ..." :status="[{ label: `通过 ${stats.passed} / ${CASES_SEED.length}`, theme: 'success' }, { label: `待记录 ${stats.pending}`, theme: stats.pending ? 'warning' : 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="openRecord(cases.find((c) => c.id === 'C10')!)">记录结论（C10）</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="实验数" :value="cases.length" format="number" icon="bug" hint="C1–C10 与发布前演练共用清单" />
      <StatCard label="部分通过 / 未通过" :value="stats.partial + stats.failed" format="number" icon="discount" :lower-is-better="true" hint="缓存失效 / 并发风暴 / 插件隔离" />
      <StatCard label="改进项" :value="stats.improvements" format="number" icon="lightbulb" hint="每项绑定落地版本（W38–W39）" />
      <StatCard label="待记录" :value="stats.pending" format="number" icon="edit" :lower-is-better="true" hint="C10 未记录假设与指标，禁止归档" />
    </div>

    <StateShell :state="state" empty-title="混沌实验清单为空" empty-desc="未读取到实验定义。混沌清单缺失时发布前演练记为未完成，禁止口头放行。" empty-action="重新拉取实验清单" example-task="记录 C10 的结论：验证插件越权调用是否被隔离" :what="'混沌实验加载失败'" :why="err.message" how="可重试；注入器不可用不影响正在执行的实验，页面恢复后自动同步结论。" :trace-id="err.traceId" :collapsed-summary="`共 ${cases.length} 项实验，已折叠展示前 ${pageSize} 项`" :page-size="pageSize" @retry="refresh" @load-more="pageSize = cases.length" @empty-action="refresh">
      <div class="oc-card">
        <div class="oc-card__title">实验清单（注入方式 / 期望行为 / 假设 / 观测指标 / 结论）</div>
        <Table row-key="id" size="small" :data="shown" :columns="columns">
          <template #id="{ row }"><b class="oc-mono">{{ row.id }}</b></template>
          <template #inject="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.inject }}</span></template>
          <template #expect="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.expect }}</span></template>
          <template #hypothesis="{ row }"><span v-if="row.hypothesis" class="oc-secondary" style="font-size: 12px">{{ row.hypothesis }}</span><Tag v-else size="small" variant="light-outline" theme="warning">未填写（不可归档）</Tag></template>
          <template #metric="{ row }"><span v-if="row.metric" class="oc-secondary" style="font-size: 12px">{{ row.metric }}</span><Tag v-else size="small" variant="light-outline" theme="warning">未填写（不可归档）</Tag></template>
          <template #verdict="{ row }"><Tag size="small" variant="light-outline" :theme="verdictTheme[row.verdict as Verdict]">{{ row.verdict }}</Tag></template>
          <template #ops="{ row }"><Button size="small" variant="text" @click="openRecord(row)">记录结论</Button></template>
        </Table>
        <CliHint command="oc quality chaos run C10 --isolate --report" label="重跑单项实验" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">结论分布（数据判定，不靠主观感觉）</div>
          <InfoGrid :columns="2" :items="[
            { key: 'pass', label: '通过', value: `${stats.passed} 项：假设成立且观测指标达标` }, { key: 'partial', label: '部分通过', value: `${stats.partial} 项：主流程可控，但指标超出假设` },
            { key: 'fail', label: '未通过', value: `${stats.failed} 项：存在未隔离的放大风险` }, { key: 'pending', label: '待记录', value: `${stats.pending} 项：假设/指标未填，禁止归档` },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">改进项（未通过 / 部分通过必须绑定落地）</div>
          <div v-for="c in cases.filter((x) => x.improvement)" :key="c.id" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
            <Tag size="small" variant="light-outline" :theme="verdictTheme[c.verdict]">{{ c.id }} · {{ c.verdict }}</Tag>
            <span class="oc-secondary" style="font-size: 12px">{{ c.improvement }}</span>
          </div>
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <CopyableId id="trace-chaos-q3-5b0e" label="复制实验批次 traceId" />
            <span class="oc-muted" style="font-size: 12px">季度全量重跑；未修复项禁止提升沙箱默认档位。</span>
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="dialogOpen" header="记录结论（必须填写假设与观测指标）" width="620px" :confirm-btn="{ content: '保存结论', theme: 'primary' }" cancel-btn="取消" @confirm="saveVerdict">
      <div class="oc-stack">
        <Alert v-if="Object.keys(fieldErrors).length" theme="error" message="保存被拒绝：假设与观测指标是结论的判定基准，缺一不可。" />
        <div><div class="oc-card__title" style="margin-bottom: 4px">实验</div><Select :value="activeId" :options="cases.map((c) => ({ label: `${c.id} · ${c.name}`, value: c.id }))" disabled aria-label="实验编号" /></div>
        <div>
          <div class="oc-card__title" style="margin-bottom: 4px">假设 <span style="color: var(--td-error-color)">*</span></div>
          <Textarea v-model="draftHypothesis" placeholder="例如：插件越权调用会被权限校验拦截，主流程不受影响" :autosize="{ minRows: 2, maxRows: 4 }" />
          <div v-if="fieldErrors.hypothesis" style="color: var(--td-error-color); font-size: 12px; margin-top: 2px">{{ fieldErrors.hypothesis }}</div>
        </div>
        <div>
          <div class="oc-card__title" style="margin-bottom: 4px">观测指标 <span style="color: var(--td-error-color)">*</span></div>
          <Textarea v-model="draftMetric" placeholder="例如：拦截次数、主流程影响时长（应为 0）、熔断触发时间" :autosize="{ minRows: 2, maxRows: 4 }" />
          <div v-if="fieldErrors.metric" style="color: var(--td-error-color); font-size: 12px; margin-top: 2px">{{ fieldErrors.metric }}</div>
        </div>
        <div><div class="oc-card__title" style="margin-bottom: 4px">结论</div><Select v-model="draftVerdict" :options="(['通过', '部分通过', '未通过'] as Verdict[]).map((v) => ({ label: v, value: v }))" aria-label="结论" /></div>
        <div class="oc-muted" style="font-size: 12px">「未通过」与「部分通过」必须在改进项中绑定落地版本；结论一旦归档即进入季度对比基线。</div>
      </div>
    </Dialog>
  </div>
</template>
