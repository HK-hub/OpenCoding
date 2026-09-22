<script setup lang="ts">
/**
 * 首次运行向导（G2-07）：9 步（环境探测 → 模型来源 → 凭证 → 导入迁移 → 工作区 →
 * 权限与沙箱建议 → 预置技能 → 示例任务 → 完成），每步给出「为什么需要」，可跳过（不可跳过项说明原因），
 * 支持断点续接（记录已完成步骤），结束时输出可复制命令与耗时统计（自动步骤 ≤20s 预算）。
 * 溯源：卷 29 / BUILD-MANIFEST G2-07。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Select, StepItem, Steps, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore, type UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const steps = enterpriseData.wizardSteps;

const RESUME_KEY = 'oc.eco.firstrun';
const step = ref(0);
const done = ref<number[]>([]);
const skipped = ref<number[]>([]);
const stepMs = ref<Record<number, number>>({});
const loading = ref(true);
const finished = ref(false);

/** 各步选择（演示值来自数据页的推荐结论，可修改） */
const modelSource = ref('vllm-internal');
const sampleState = ref<'IDLE' | 'RUNNING' | 'FAILED' | 'SUCCESS'>('IDLE');
const sampleAttempts = ref(0);
/** 示例任务结果文案：失败原因必须显式（不把失败伪装成通过） */
const sampleMessage = computed(() => {
  if (sampleState.value === 'FAILED') return '示例任务失败：沙箱 L1 镜像未缓存（拉取超时）——可重试或跳过，失败不伪装成通过。';
  if (sampleState.value === 'SUCCESS') return '示例任务成功：全链路闭环验证通过（成本 $0.18）。';
  return '示例任务为真实闭环验证：读取仓库结构并运行一次只读命令，用于确认模型/沙箱/审批链路都通。';
});

const current = computed(() => steps[Math.min(step.value, steps.length - 1)]);
const autoSteps = computed(() => [1, 9]);
const totalAutoMs = computed(() => Object.entries(stepMs.value).filter(([k]) => autoSteps.value.includes(Number(k))).reduce((a, [, v]) => a + v, 0));
const skippedCount = computed(() => skipped.value.length);

/** 断点存档错误与列表折叠（步骤明细超过 6 行时折叠，避免一屏过长） */
const resumeError = ref('');
const PAGE_SIZE = 6;
const limit = ref(PAGE_SIZE);
const stepRows = computed(() =>
  steps.map((s) => ({
    key: s.key,
    no: s.no,
    title: s.title,
    state: done.value.includes(s.no) ? '已完成' : skipped.value.includes(s.no) ? '已跳过（可回访）' : s.no === current.value.no ? '进行中' : '待执行',
    action: s.action,
  })),
);
const visibleSteps = computed(() => stepRows.value.slice(0, limit.value));

/** 完成页可复制的下一步命令（避免在模板内拼接含引号的命令） */
const NEXT_COMMANDS = [
  { label: '诊断摘要', command: 'oc doctor --summary' },
  { label: '示例任务（只读）', command: 'oc run "解释本项目架构" --budget-usd 1 --permission readonly' },
  { label: '从断点续接向导', command: 'oc first-run --resume --json' },
];

const pageState = computed<UiStateKind>(() => {
  if (loading.value) return 'LOADING';
  if (resumeError.value) return 'ERROR';
  if (!steps.length) return 'EMPTY';
  return stepRows.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

/** 重置向导断点：清空本地已完成步骤（破坏性：会丢失续接位置），需二次确认 */
function resetResume() {
  done.value = [];
  skipped.value = [];
  stepMs.value = {};
  step.value = 0;
  finished.value = false;
  resumeError.value = '';
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    /* 存储不可用时仅重置内存态 */
  }
  MessagePlugin.warning('已重置向导断点：已完成/已跳过记录被清空（业务数据与凭证不受影响）');
}

/** 断点续接：已完成/已跳过步骤写入本地，下次进入直接回到中断位置 */
function persist() {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ step: step.value, done: done.value, skipped: skipped.value }));
  } catch {
    /* 隐私模式不可用：退化为会话内记忆，不阻断向导 */
  }
}

/** 推进到下一步（记录耗时；最后一步触发收尾与通知） */
function advance() {
  const no = current.value.no;
  if (!done.value.includes(no) && !skipped.value.includes(no)) {
    done.value = [...done.value, no];
  }
  stepMs.value = { ...stepMs.value, [no]: stepMs.value[no] ?? 420 };
  if (step.value >= steps.length - 1) {
    finished.value = true;
    ui.completeOnboarding();
    ui.pushNotification({
      kind: 'task_done',
      level: 'P1',
      title: '首次运行向导已完成',
      body: `已完成 ${done.value.length} 步 / 跳过 ${skippedCount.value} 步；自动步骤耗时 ${(totalAutoMs.value / 1000).toFixed(1)}s（预算 ≤20s）。`,
      actions: [{ label: '进入会话工作台', path: '/session' }, { label: '查看诊断摘要', command: 'oc doctor --summary' }],
      aggregateKey: 'eco-first-run',
      penetrateQuiet: false,
      channel: 'inapp',
    });
    persist();
    return;
  }
  step.value += 1;
  persist();
}

/** 跳过：不可跳过的步骤给出原因（安全/合规相关默认不可跳过） */
function skipStep() {
  if (!current.value.skippable) {
    MessagePlugin.warning(`该步骤不可跳过：${current.value.why}`);
    return;
  }
  skipped.value = [...skipped.value, current.value.no];
  stepMs.value = { ...stepMs.value, [current.value.no]: stepMs.value[current.value.no] ?? 120 };
  MessagePlugin.info(`已跳过「${current.value.title}」，可在后续随时回访（记录已完成步骤，支持断点续接）`);
  advance();
}

/** 示例任务：首次按数据页真实结论失败（镜像未缓存），重试可成功——不伪装一次通过 */
function runSample() {
  sampleState.value = 'RUNNING';
  sampleAttempts.value += 1;
  window.setTimeout(() => {
    if (sampleAttempts.value === 1) {
      sampleState.value = 'FAILED';
      MessagePlugin.warning('示例任务失败：沙箱 L1 镜像未缓存（拉取超时）——失败原因已给出，可重试或跳过');
      return;
    }
    sampleState.value = 'SUCCESS';
    MessagePlugin.success('示例任务成功：读 → 改 → 跑 → 测闭环验证通过（成本 $0.18）');
  }, 700);
}

onMounted(() => {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { step?: number; done?: number[]; skipped?: number[] };
      if (!Number.isFinite(saved.step ?? 0) || (saved.done !== undefined && !Array.isArray(saved.done))) {
        throw new Error('断点字段类型不合法（step 非数字或 done 非数组）');
      }
      step.value = Math.min(Math.max(saved.step ?? 0, 0), steps.length - 1);
      done.value = saved.done ?? [];
      skipped.value = saved.skipped ?? [];
    }
  } catch (err) {
    // 存档损坏：显式报错并提供「重置断点」恢复路径，不静默从头开始
    resumeError.value = err instanceof Error ? err.message : '断点存档解析失败';
  }
  window.setTimeout(() => {
    loading.value = false;
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="首次运行向导"
      desc="9 步完成可用闭环：环境探测 → 模型来源 → 凭证 → 导入迁移 → 工作区 → 权限与沙箱建议 → 预置技能 → 示例任务 → 完成；每步说明「为什么需要」，可跳过、可断点续接。"
      volume="卷 29"
      manifest="G2-07"
      cli="oc first-run --resume --json"
      :status="[{ label: '自动步骤 ≤20s', theme: 'success' }, { label: '可跳过 / 可续接', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="step = Math.min(step + 1, steps.length - 1)">下一步</Button>
        <Button size="small" theme="primary" @click="advance">完成当前步</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="步骤总数" :value="steps.length" unit="步" icon="task" hint="覆盖开箱到可用闭环" />
      <StatCard label="已完成" :value="done.length" unit="步" icon="check" />
      <StatCard label="已跳过" :value="skippedCount" unit="步" icon="history" hint="可随时回访，不阻塞完成" />
      <StatCard label="自动步骤耗时" :value="totalAutoMs" unit="ms" icon="time" :target="20000" target-kind="max" hint="探测与摘要在预算内完成" />
    </div>

    <StateShell
      :state="pageState"
      :collapsed-summary="`步骤明细 ${stepRows.length} 行，超过单次渲染阈值（${PAGE_SIZE} 行）已折叠。`"
      :page-size="PAGE_SIZE"
      stage="正在读取向导步骤与断点…"
      empty-title="向导步骤缺失"
      empty-desc="没有可执行的向导步骤（步骤定义未加载）；可直接进入工作台，功能不依赖向导完成。"
      empty-action="直接进入工作台"
      example-task="用示例任务验证「读 → 改 → 跑 → 测 → 提」全链路"
      what="向导断点读取失败"
      why="本地存档损坏（JSON 结构不合法或字段类型不匹配），已完成步骤无法恢复。"
      how="可重试；或点「重置断点」从第 1 步开始（不影响业务数据与凭证）。"
      trace-id="trace-firstrun-6d13ba"
      @retry="loading = false; resumeError = ''"
      @load-more="limit += PAGE_SIZE"
      @empty-action="step = 0"
    >
      <Alert v-if="resumeError" theme="error" style="margin-bottom: 10px" :message="`事实：断点存档解析失败（${resumeError}）`" description="原因：本地存档被外部改写或写入中断。动作：重置断点后从第 1 步开始；也可跳过向导直接使用。" />
      <div class="oc-card">
        <div class="oc-card__title">向导进度（9 步）<CopyableId id="trace-firstrun-6d13ba" label="复制 traceId" /></div>
        <Steps :current="step" size="small">
          <StepItem
            v-for="(s, i) in steps"
            :key="s.key"
            :title="s.title"
            :content="done.includes(s.no) ? '已完成' : skipped.includes(s.no) ? '已跳过' : i === step ? '进行中' : '待执行'"
            :status="done.includes(s.no) ? 'finish' : i === step ? 'process' : 'default'"
          />
        </Steps>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <Button size="small" variant="outline" :disabled="step === 0" @click="step = Math.max(step - 1, 0)">上一步</Button>
          <Button size="small" variant="outline" @click="skipStep">跳过本步</Button>
          <Button size="small" theme="primary" @click="advance">{{ step === steps.length - 1 ? '完成向导' : '完成并继续' }}</Button>
          <Tag v-if="current.skippable" size="small" theme="default" variant="outline">本步可跳过</Tag>
          <Tag v-else size="small" theme="danger" variant="light-outline">本步不可跳过</Tag>
          <Tag v-if="current.resumePoint" size="small" theme="primary" variant="light-outline">支持断点续接</Tag>
          <Popconfirm content="重置断点会清空本地记录的「已完成 / 已跳过 / 耗时」并回到第 1 步；业务数据、工作区绑定与凭证均不受影响。重置后无法恢复原断点，是否继续？" @confirm="resetResume">
            <Button size="small" variant="outline">重置断点</Button>
          </Popconfirm>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">步骤明细（断点续接依据：已完成 / 已跳过 / 进行中 / 待执行）</div>
        <Table :data="visibleSteps" row-key="key" size="small" :columns="[
          { colKey: 'no', title: '步', width: 60 },
          { colKey: 'title', title: '步骤', width: 220 },
          { colKey: 'state', title: '状态', width: 130, cell: 'state' },
          { colKey: 'action', title: '等价 CLI', cell: 'action' },
        ]" :pagination="undefined" table-layout="fixed">
          <template #state="{ row }">
            <Tag size="small" :theme="row.state === '已完成' ? 'success' : row.state === '进行中' ? 'primary' : row.state === '已跳过（可回访）' ? 'warning' : 'default'" variant="light-outline">{{ row.state }}</Tag>
          </template>
          <template #action="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.action }}</span></template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">展示 {{ visibleSteps.length }} / {{ stepRows.length }} 行；续接只依赖本地记录，重进页面自动回到中断位置。</div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">第 {{ current.no }} 步 · {{ current.title }}</div>
        <Alert theme="info" :message="`为什么需要这一步：${current.why}`" style="margin-bottom: 10px" />

        <!-- 通用面板：每步统一展示现状、可跳过性与续接语义（避免 Wizard 变表单墙） -->
        <div v-if="current.key === 'model-source'" class="oc-stack">
          <Select v-model="modelSource" style="width: 320px" :options="[
            { value: 'vllm-internal', label: '内网 vLLM（数据不出网，推荐）' },
            { value: 'gateway', label: '企业模型网关（统一路由/配额/审计）' },
            { value: 'vendor', label: '直连厂商端点（需代理）' },
            { value: 'none', label: '暂不配置（离线只读）' },
          ]" />
          <div class="oc-muted" style="font-size: 12px">选择决定成本口径与数据出境边界；企业策略可能只允许内网端点（白名单强制）。</div>
        </div>

        <div v-else-if="current.key === 'credential'" class="oc-stack">
          <Alert theme="warning" message="凭证只创建引用名（如 cred://vllm-internal/prod），明文永不进入上下文、事件与日志。" />
          <div class="oc-muted" style="font-size: 12px">连通性测试在下一步之前完成；引用失效会导致模型调用显式失败（不静默回退到其它凭证）。</div>
        </div>

        <div v-else-if="current.key === 'sample'" class="oc-stack">
          <Alert :theme="sampleState === 'FAILED' ? 'warning' : sampleState === 'SUCCESS' ? 'success' : 'info'" :message="sampleMessage" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Button size="small" theme="primary" :loading="sampleState === 'RUNNING'" @click="runSample">
              {{ sampleState === 'FAILED' ? '重试示例任务' : '运行示例任务' }}
            </Button>
            <CliHint :command="current.action" label="等价 CLI" />
            <span class="oc-muted" style="font-size: 12px">尝试次数：{{ sampleAttempts }}（首次失败原因：L1 镜像未缓存）</span>
          </div>
        </div>

        <div v-else-if="current.key === 'summary'" class="oc-stack">
          <InfoGrid :columns="1" :items="[
            { key: 'state', label: '向导状态', value: finished ? '已完成（可随时回访任意步骤）' : '进行中（断点已记录）' },
            { key: 'done', label: '已完成步骤', value: done.length ? done.map((n) => `第 ${n} 步`).join('、') : '（未记录）' },
            { key: 'skip', label: '已跳过步骤', value: skippedCount ? skipped.map((n) => `第 ${n} 步`).join('、') : '无' },
            { key: 'budget', label: '自动步骤耗时', value: `${totalAutoMs} ms（预算 20000 ms）` },
            { key: 'next', label: '下一步建议', value: '在会话工作台跑一个真实任务；或先查看诊断摘要' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <CliHint v-for="c in NEXT_COMMANDS" :key="c.command" :command="c.command" :label="`复制${c.label}`" />
          </div>
        </div>

        <InfoGrid v-else :columns="2" :items="[
          { key: 'detail', label: '当前状态 / 结果', value: current.detail, span: 2 },
          { key: 'skip', label: '可跳过', value: current.skippable ? '是（跳过会记录，并可随时回访）' : '否（安全与合规相关步骤不可跳过）' },
          { key: 'resume', label: '断点续接', value: current.resumePoint ? '支持：已完成步骤本地记录，重进从此处继续' : '不支持' },
        ]" />

        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 10px">
          <CliHint :command="current.action" label="本步等价 CLI" />
          <span v-if="current.resumePoint" class="oc-muted" style="font-size: 12px">已记录断点：中途离开后回到本页会从第 {{ step + 1 }} 步继续。</span>
        </div>
      </div>
    </StateShell>
  </div>
</template>
