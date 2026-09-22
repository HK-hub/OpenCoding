<script setup lang="ts">
/**
 * 首次运行向导 S1–S5（卷 29 §4.6 / impl/30 §6.5）：
 * 环境探测 → 模型来源 → 凭证 → 工作区与权限档 → 只读示例任务。
 * 契约：每步「为什么需要」、可跳过、可续接、失败只重跑当前步、配置最后一步原子提交。
 * 时长预算：自动步骤 ≤20s（P95），用户操作中位数 ≤3 分钟。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, RadioGroup, RadioButton, Select, Steps, StepItem, Switch, Tag } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';
import OcIcon from '@/components/common/OcIcon.vue';

const ui = useUiStore();
const router = useRouter();

const step = ref(0);
const skipped = ref<string[]>([]);
const probing = ref(true);
const probeMs = ref(0);

const probe = ref({
  os: 'Windows 11 · 10.0.28000',
  runtime: 'JDK 21.0.4 · Node v24.18 · Python 3.12',
  containers: 'Docker 27.1（可用）· 容器沙箱 L1 可达',
  network: '内网可达 · 外部模型端点需代理',
  repo: '检测到 1 个仓库 payment-core（2.8k 文件）',
});

const modelSource = ref('gateway');
const credential = ref('env');
const workspaceKind = ref('local');
const permissionMode = ref('default');

const STEPS = [
  { id: 'S1', title: '环境探测', why: '用于选择可达的沙箱档与命令执行能力，避免启动后才发现不可用。', auto: true },
  { id: 'S2', title: '模型来源', why: '决定推理端点与路由策略；未配置时可先用离线只读模式浏览。', auto: false },
  { id: 'S3', title: '凭证', why: '凭证只写入密钥服务（引用式），明文不会进入上下文、事件或日志。', auto: false },
  { id: 'S4', title: '工作区与权限档', why: '决定 Agent 能改哪些目录、能执行哪些命令；默认最小权限。', auto: false },
  { id: 'S5', title: '只读示例任务', why: '用一次安全的只读任务验证链路端到端可用。', auto: true },
];

const elapsed = ref(0);
let timer: number | undefined;

onMounted(() => {
  const t0 = performance.now();
  window.setTimeout(() => {
    probing.value = false;
    probeMs.value = Math.round(performance.now() - t0);
  }, 900);
  timer = window.setInterval(() => (elapsed.value += 1), 1000);
  window.setTimeout(() => {
    if (timer) window.clearInterval(timer);
  }, 600_000);
});

const canNext = computed(() => {
  if (step.value === 2) return true;
  if (step.value === 3) return true;
  return true;
});

function next() {
  if (step.value === STEPS.length - 1) {
    ui.completeOnboarding();
    ui.pushNotification({
      kind: 'task_done',
      level: 'P1',
      title: '向导已完成',
      body: `自动步骤耗时 ${(probeMs.value / 1000).toFixed(1)}s；跳过项 ${skipped.value.length} 个。`,
      actions: [{ label: '进入会话工作台', path: '/session' }],
      aggregateKey: 'wizard',
      penetrateQuiet: false,
      channel: 'inapp',
    });
    router.push('/session');
    return;
  }
  step.value += 1;
}

function skip() {
  skipped.value.push(STEPS[step.value].id);
  next();
}

/**
 * 跳过全部：先落「向导已完成」再进入工作台。
 * 工作台布局以 localStorage['oc.onboarded'] 判定，未落标记会被立即弹回 /onboarding（用户无法真正进入）。
 */
function skipAll() {
  skipped.value = STEPS.map((s) => s.id);
  ui.completeOnboarding();
  router.push('/session');
}
</script>

<template>
  <div class="wiz">
    <div class="wiz__panel">
      <header class="oc-flex--between">
        <div class="oc-flex" style="gap: 10px">
          <span class="wiz__logo">OC</span>
          <div>
            <div style="font-weight: 600">首次运行向导</div>
            <div class="oc-muted" style="font-size: 12px">
              自动步骤预算 ≤20s · 已用时 {{ elapsed }}s · 可跳过、可断点续接
            </div>
          </div>
        </div>
        <Button variant="text" @click="skipAll">跳过全部并进入工作台</Button>
      </header>

      <Steps v-model="step" class="wiz__steps">
        <StepItem v-for="s in STEPS" :key="s.id" :value="STEPS.indexOf(s)" :title="s.title" :status="STEPS.indexOf(s) < step ? 'finish' : STEPS.indexOf(s) === step ? 'process' : 'default'" />
      </Steps>

      <div class="wiz__body">
        <Alert theme="info" :message="`为什么需要这一步：${STEPS[step].why}`" style="margin-bottom: 12px" />

        <!-- S1 环境探测 -->
        <div v-if="step === 0" class="oc-stack">
          <div v-if="probing" class="oc-flex" style="gap: 8px">
            <OcIcon name="loading" size="16px" /> 正在探测环境（OS / 运行时 / 容器 / 网络 / 仓库）…
          </div>
          <template v-else>
            <div class="oc-kv">
              <span class="oc-kv__k">操作系统</span><span>{{ probe.os }}</span>
              <span class="oc-kv__k">运行时</span><span>{{ probe.runtime }}</span>
              <span class="oc-kv__k">沙箱能力</span><span>{{ probe.containers }}</span>
              <span class="oc-kv__k">网络</span><span>{{ probe.network }}</span>
              <span class="oc-kv__k">仓库</span><span>{{ probe.repo }}</span>
            </div>
            <div class="oc-flex" style="gap: 6px">
              <Tag theme="success" variant="light-outline" size="small">探测完成 {{ probeMs }}ms</Tag>
              <Tag theme="warning" variant="light-outline" size="small">外部模型端点需代理：将显式提示，不静默失败</Tag>
            </div>
          </template>
        </div>

        <!-- S2 模型来源 -->
        <div v-else-if="step === 1" class="oc-stack">
          <RadioGroup v-model="modelSource">
            <RadioButton value="gateway">企业模型网关（推荐：统一路由/配额/审计）</RadioButton>
            <RadioButton value="direct">直连厂商端点（Anthropic / OpenAI / Gemini）</RadioButton>
            <RadioButton value="local">本地端点（Ollama / vLLM，内网）</RadioButton>
            <RadioButton value="none">暂不配置（离线只读模式）</RadioButton>
          </RadioGroup>
          <div class="oc-muted" style="font-size: 12px">
            选择「暂不配置」时：会话与文件操作仍可用，模型推理入口置灰并显示原因（可解释性优先于隐藏）。
          </div>
        </div>

        <!-- S3 凭证 -->
        <div v-else-if="step === 2" class="oc-stack">
          <RadioGroup v-model="credential">
            <RadioButton value="env">环境变量（推荐）</RadioButton>
            <RadioButton value="secrets">密钥服务引用</RadioButton>
            <RadioButton value="vault">企业 Vault / KMS</RadioButton>
          </RadioGroup>
          <Alert theme="warning" message="凭证只写入密钥服务，UI 仅显示引用名（如 secret://model/anthropic-prod）；明文永不进入上下文、事件与日志。" />
          <div class="oc-flex" style="gap: 8px">
            <Tag variant="outline" size="small">轮换 SLA：90 天</Tag>
            <Tag variant="outline" size="small">轮换事件触发：泄露/离职立即</Tag>
          </div>
        </div>

        <!-- S4 工作区与权限档 -->
        <div v-else-if="step === 3" class="oc-stack">
          <div class="oc-flex" style="gap: 12px; flex-wrap: wrap">
            <div>
              <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">工作区类型</div>
              <Select
                v-model="workspaceKind"
                style="width: 240px"
                :options="[
                  { value: 'local', label: '本地（LocalFS）' },
                  { value: 'ssh', label: 'SSH 远程主机' },
                  { value: 'container', label: '容器（L1）' },
                  { value: 'cloud', label: '云沙箱（L2/L3）' },
                ]"
              />
            </div>
            <div>
              <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">初始权限档</div>
              <Select
                v-model="permissionMode"
                style="width: 240px"
                :options="[
                  { value: 'readonly', label: '只读（探索/审计）' },
                  { value: 'plan', label: '计划（只分析不落盘）' },
                  { value: 'default', label: '默认（写与执行按风险确认）' },
                  { value: 'acceptEdits', label: '自动接受文件编辑（执行仍确认）' },
                ]"
              />
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Switch :value="true" size="small" />
            <span style="font-size: 13px">启用沙箱（默认开启，最小权限）</span>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Switch :value="false" size="small" />
            <span style="font-size: 13px">允许外发网络（默认关闭；开启后按域名白名单 + 审计代理）</span>
          </div>
          <div class="oc-muted" style="font-size: 12px">配置在最后一步原子提交；失败只重跑当前步，不写半成品配置。</div>
        </div>

        <!-- S5 只读示例任务 -->
        <div v-else class="oc-stack">
          <Alert theme="success" message="示例任务为只读：读取仓库结构并给出架构摘要，不会修改任何文件。" />
          <div class="oc-card">
            <div class="oc-flex" style="gap: 8px">
              <OcIcon name="chat" size="16px" />
              <div>
                <b>示例任务：「解释这个项目的架构」</b>
                <div class="oc-secondary" style="font-size: 12px">
                  预期：读取目录结构与入口文件 → 输出模块地图与依赖关系 → 每条结论附文件引用。
                </div>
              </div>
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Tag variant="outline" size="small">权限：只读（R0）</Tag>
            <Tag variant="outline" size="small">无副作用</Tag>
            <Tag variant="outline" size="small">可随时中断</Tag>
          </div>
        </div>
      </div>

      <footer class="oc-flex--between">
        <div class="oc-flex" style="gap: 8px">
          <Button v-if="step > 0" variant="outline" @click="step -= 1">上一步</Button>
          <span v-if="skipped.length" class="oc-muted" style="font-size: 12px">已跳过：{{ skipped.join(' / ') }}</span>
        </div>
        <div class="oc-flex" style="gap: 8px">
          <Button variant="text" @click="skip">跳过本步</Button>
          <Button theme="primary" :disabled="!canNext" @click="next">
            {{ step === STEPS.length - 1 ? '完成并进入工作台' : '下一步' }}
          </Button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.wiz {
  min-height: 100%;
  display: grid;
  place-items: center;
  background: var(--oc-bg-page);
  padding: 24px;
}

.wiz__panel {
  width: 820px;
  max-width: 96vw;
  background: var(--oc-bg-container);
  border: 1px solid var(--oc-border);
  border-radius: 8px;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wiz__logo {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: linear-gradient(135deg, #0052d9, #2ba471);
  color: #fff;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.wiz__steps {
  padding: 4px 0;
}

.wiz__body {
  min-height: 240px;
}
</style>
