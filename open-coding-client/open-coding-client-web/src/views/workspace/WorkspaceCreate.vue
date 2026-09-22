<script setup lang="ts">
/**
 * O-02 创建工作区向导。
 * 四步：类型 → 后端参数 → 绑定与写范围 → 配额与能力确认（含缺失能力的显式降级说明）。
 * 创建前后端能力差异必须提前告知，禁止「创建后才发现不支持」。
 * 溯源：卷 20 D-WS-1/D-WS-6/§4.2；BUILD-MANIFEST O-02。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, MessagePlugin, Option, Select, Switch, Tag, Steps, StepItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const step = ref(0);
const form = ref({ type: 'local', name: '支付核心 · 本地副本', path: '/srv/oc/payment-core', host: 'build-01.internal', image: 'oc/node:22', project: 'PRJ-payment-core', writeScope: 'src/reconcile/**', disk: 60, cpu: 4, memory: 16, snapshot: true, watch: true });

const TYPES = [
  { key: 'local', label: '本地目录（LocalFS）', tier: 'L0 / L0+', note: '最快；进程级围栏；离线可用' },
  { key: 'ssh', label: 'SSH 远程主机', tier: 'L0（远端围栏有限）', note: '强制更严网络策略：默认全禁出站 + 白名单' },
  { key: 'container', label: '容器（Container）', tier: 'L1', note: '资源强限 + 可挂载监听；依赖镜像源' },
  { key: 'cloud', label: '云沙箱（CloudSandbox）', tier: 'L2 / L3', note: '最强隔离；不可离线；PTY 部分供应商不支持' },
];

/** 当前类型的能力缺失（来自能力矩阵，创建前即告知） */
const fallbacks = computed(() => {
  const ws = platformData.workspaces.find((w) => w.type === form.value.type);
  return ws?.capabilities.fallbacks ?? [];
});

const matrixRow = computed(() => platformData.capabilityMatrix);

const canNext = computed(() => {
  if (step.value === 0) return !!form.value.type;
  if (step.value === 1) return form.value.type === 'local' ? !!form.value.path : form.value.type === 'ssh' ? !!form.value.host : !!form.value.image;
  if (step.value === 2) return !!form.value.project && !!form.value.writeScope;
  return true;
});

function submit() {
  MessagePlugin.success(`工作区创建请求已提交：${form.value.name}（${form.value.type}）；准备流程 ${form.value.type === 'local' ? '探测本地工具链' : '建立连接并探测环境'}，完成后状态转为 ready 或 degraded`);
  step.value = 0;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = TYPES.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="创建工作区向导"
      desc="类型 → 后端参数 → 绑定与写范围 → 配额与能力确认。能力缺失在提交前显式列出替代方案，避免创建后才发现不可用。"
      volume="卷 20" manifest="O-02" cli="oc workspace create --type ssh --host build-01.internal --project PRJ-payment-core"
      :status="[{ label: `第 ${step + 1} / 4 步`, theme: 'primary' }, { label: '创建前校验能力', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '无可用后端' }, { value: 'ERROR', label: '错误' },
        ]" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在加载后端模板与能力矩阵…"
      empty-title="没有可用的工作区后端" empty-desc="当前部署形态未启用任何 WorkspaceProvider（local-lite 形态默认仅本地目录）。"
      empty-action="启用本地目录后端" example-task="启用容器后端需要可用的容器运行时与镜像源"
      what="后端模板加载失败" why="WorkspaceProviderSPI 注册表不可达，无法确认可用后端与能力"
      how="可重试；创建流程被阻塞（不允许盲创建）" trace-id="trace-e44b1c07"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-card">
        <Steps :current="step" size="small">
          <StepItem title="选择类型" />
          <StepItem title="后端参数" />
          <StepItem title="绑定与写范围" />
          <StepItem title="配额与能力确认" />
        </Steps>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">步骤 {{ step + 1 }}：{{ ['选择类型', '后端参数', '绑定与写范围', '配额与能力确认'][step] }}</h3>

          <div v-if="step === 0" class="oc-stack">
            <div v-for="t in TYPES" :key="t.key" class="oc-card" :style="{ borderColor: form.type === t.key ? 'var(--td-brand-color)' : undefined, cursor: 'pointer' }" @click="form.type = t.key">
              <div class="oc-flex oc-flex--between">
                <span class="oc-flex" style="gap: 6px">
                  <OcIcon :name="t.key === 'local' ? 'folder' : t.key === 'ssh' ? 'server' : t.key === 'container' ? 'layers' : 'cloud'" size="14px" />
                  <b>{{ t.label }}</b>
                </span>
                <Tag :theme="form.type === t.key ? 'primary' : 'default'" size="small" variant="light-outline">{{ t.tier }}</Tag>
              </div>
              <div class="oc-muted" style="font-size: 12px; margin-top: 4px">{{ t.note }}</div>
            </div>
          </div>

          <div v-else-if="step === 1" class="oc-stack">
            <Input v-model="form.name" size="small" placeholder="工作区名称" />
            <Input v-if="form.type === 'local'" v-model="form.path" size="small" placeholder="本地绝对路径，例如 /srv/oc/payment-core" />
            <template v-else-if="form.type === 'ssh'">
              <Input v-model="form.host" size="small" placeholder="主机，例如 build-01.internal" />
              <Input v-model="form.image" size="small" placeholder="跳板机（可选）" />
            </template>
            <template v-else>
              <Input v-model="form.image" size="small" placeholder="镜像，例如 registry.internal/oc/pipeline:1.24" />
            </template>
            <div class="oc-flex oc-flex--wrap">
              <Switch v-model="form.snapshot" size="small" /> <span style="font-size: 12px">启用内容寻址快照（TTL 14 天）</span>
              <Switch v-model="form.watch" size="small" /> <span style="font-size: 12px">启用目录变更监听（能力允许时）</span>
            </div>
          </div>

          <div v-else-if="step === 2" class="oc-stack">
            <Select v-model="form.project" size="small" aria-label="绑定项目">
              <Option v-for="p in ['PRJ-payment-core', 'PRJ-identity-gateway', 'PRJ-data-pipeline', 'PRJ-web-console']" :key="p" :value="p" :label="p" />
            </Select>
            <Input v-model="form.writeScope" size="small" placeholder="写范围（glob，例如 src/reconcile/**）" />
            <Tag size="small" variant="outline">写范围外为只读；跨工作区访问需显式授权（O-11）</Tag>
          </div>

          <div v-else class="oc-stack">
            <Select v-model="form.disk" size="small" aria-label="磁盘配额">
              <Option :value="40" label="磁盘 40GB" />
              <Option :value="60" label="磁盘 60GB" />
              <Option :value="80" label="磁盘 80GB" />
            </Select>
            <Select v-model="form.cpu" size="small" aria-label="CPU 配额">
              <Option :value="2" label="CPU 2 核" />
              <Option :value="4" label="CPU 4 核" />
              <Option :value="8" label="CPU 8 核" />
            </Select>
            <Select v-model="form.memory" size="small" aria-label="内存配额">
              <Option :value="8" label="内存 8GB" />
              <Option :value="16" label="内存 16GB" />
              <Option :value="32" label="内存 32GB" />
            </Select>
            <Tag theme="primary" variant="light-outline" size="small">SSH 后端仅观测资源：超阈值暂停新命令，不做硬限</Tag>
          </div>

          <div class="oc-flex" style="margin-top: 12px">
            <Button size="small" variant="outline" :disabled="step === 0" @click="step -= 1">上一步</Button>
            <Button v-if="step < 3" size="small" theme="primary" :disabled="!canNext" @click="step += 1">下一步</Button>
            <Button v-else size="small" theme="primary" @click="submit">提交创建</Button>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">能力缺失预检（当前类型：{{ form.type }}）</h3>
            <div v-if="fallbacks.length" class="oc-stack">
              <div v-for="f in fallbacks" :key="f.capability" class="oc-flex oc-flex--wrap">
                <Tag theme="warning" size="small" variant="light-outline">{{ f.capability }} 缺失</Tag>
                <span style="font-size: 12px">替代：{{ f.fallback }} —— {{ f.note }}</span>
              </div>
            </div>
            <Tag v-else theme="success" size="small" variant="light-outline">该类型无能力缺失（全部能力可用）</Tag>
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">四类后端能力矩阵（4 后端 × 9 能力）</h3>
            <InfoGrid
              :columns="1"
              :items="matrixRow.map((m) => ({ key: m.capability, label: m.capability, value: `${m.local} | ${m.ssh} | ${m.container} | ${m.cloud}` }))"
            />
            <div class="oc-muted" style="font-size: 11px; margin-top: 6px">列顺序：local | ssh | container | cloud</div>
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">等价命令</h3>
            <CliHint :command="`oc workspace create --type ${form.type} --name '${form.name}' --project ${form.project} --write-scope '${form.writeScope}'`" />
            <div class="oc-flex" style="margin-top: 8px">
              <Tag size="small" variant="outline">创建后可一键准备环境（.oc/env.yaml 驱动）</Tag>
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
