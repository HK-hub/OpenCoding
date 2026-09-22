<script setup lang="ts">
/**
 * CI 集成（G2-01）：容器镜像卡、三套流水线片段（GitHub Actions / GitLab CI / Jenkins，可复制可下载）、
 * headless 命令表、输出格式（JSON / SARIF / Markdown）、退出码语义（0 成功 / 1 需人工 / 2 失败）、
 * 权限与预算必填，以及一次 CI 运行记录（runId / 模式 / 退出码 / 花费 / 产物）。
 * 溯源：卷 29 / BUILD-MANIFEST G2-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Switch, Table, TabPanel, Tabs, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadText } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const d = enterpriseData;

/** CI 使用的官方 CLI 镜像（签名可验证；以 digest 固定，禁止浮动 tag） */
const CI_IMAGE = {
  name: 'ghcr.io/opencoding/oc-cli',
  tag: '2.9.1',
  digest: 'sha256:9c1f4ab7e2d0（多架构 manifest）',
  signature: 'Sigstore（cosign）签名有效 · 发布流水线签发',
  sizeMb: 412,
  platforms: 'linux/amd64, linux/arm64（Windows 走 WSL2 镜像）',
  pull: 'docker pull ghcr.io/opencoding/oc-cli:2.9.1@sha256:9c1f4ab7e2d0',
};

/** headless 命令：全部支持 --json 便于机器消费；预算与权限为必填项 */
const HEADLESS_CMDS = [
  { cmd: 'oc run "<指令>" --json --budget-usd 5 --permission readonly', use: '执行一次任务并输出步骤账本', exits: '0 / 1 / 2' },
  { cmd: 'oc review --diff <base>..<head> --json --budget-usd 3', use: '审查变更（PR/MR 门禁）', exits: '0 / 1 / 2' },
  { cmd: 'oc task run --plan <plan.json> --json', use: '按计划文件执行（可重复、可幂等键）', exits: '0 / 1 / 2' },
  { cmd: 'oc doctor --json', use: '环境与装配诊断（不产生写操作）', exits: '0 / 1' },
  { cmd: 'oc import --package <pkg> --verify --json', use: '导入校验（CI 预检迁移包）', exits: '0 / 2' },
];

const EXIT_SEMANTICS = [
  { code: 0, meaning: '成功（验收全部通过）', behavior: '流水线继续；产物可归档' },
  { code: 1, meaning: '需人工介入（审批未决 / 部分成功）', behavior: '标记 warning，不自动失败（人工放行）' },
  { code: 2, meaning: '失败（验收不通过 / 预算耗尽 / 越权）', behavior: '失败并阻断合并' },
];

/** 一次 CI 运行记录（含 2 条负样本：退出码 1 与 2） */
const RUNS = [
  { runId: 'ci-8842', platform: 'GitHub Actions', mode: 'review', exitCode: 0, costUsd: 2.14, artifacts: 'step-ledger.json, report.sarif, pr-comment.md', at: '2026-09-21T20:41:00+08:00' },
  { runId: 'ci-8841', platform: 'GitLab CI', mode: 'run（修复 flaky 用例）', exitCode: 1, costUsd: 4.86, artifacts: 'step-ledger.json, report.sarif', at: '2026-09-21T19:12:00+08:00' },
  { runId: 'ci-8840', platform: 'Jenkins', mode: 'review', exitCode: 2, costUsd: 5.0, artifacts: 'step-ledger.json', at: '2026-09-21T17:55:00+08:00' },
  { runId: 'ci-8839', platform: 'GitHub Actions', mode: 'review', exitCode: 0, costUsd: 1.92, artifacts: 'step-ledger.json, report.sarif, pr-comment.md', at: '2026-09-21T15:06:00+08:00' },
  { runId: 'ci-8838', platform: 'GitLab CI', mode: 'plan-only', exitCode: 0, costUsd: 0.42, artifacts: 'plan.json', at: '2026-09-21T11:30:00+08:00' },
  { runId: 'ci-8837', platform: 'Jenkins', mode: 'run（依赖升级）', exitCode: 1, costUsd: 3.68, artifacts: 'step-ledger.json, build-note.md', at: '2026-09-20T22:14:00+08:00' },
];

const EXIT_THEME: Record<number, 'success' | 'warning' | 'danger'> = { 0: 'success', 1: 'warning', 2: 'danger' };
const runColumns = [
  { colKey: 'runId', title: 'runId', width: 110, cell: 'runIdCell' },
  { colKey: 'platform', title: '平台', width: 140 },
  { colKey: 'mode', title: '模式', ellipsis: true },
  { colKey: 'exitCode', title: '退出码', width: 100, cell: 'exit' },
  { colKey: 'costUsd', title: '花费', width: 100, cell: 'cost' },
  { colKey: 'artifacts', title: '产物', ellipsis: true },
  { colKey: 'ops', title: '操作', width: 110, cell: 'ops' },
];

const tab = ref(d.ciIntegrations[0].platform);
const active = computed(() => d.ciIntegrations.find((c) => c.platform === tab.value) ?? d.ciIntegrations[0]);

type ShellState = 'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA';

const ui = useUiStore();
const PAGE_SIZE = 4;
const loading = ref(true);
const limit = ref(PAGE_SIZE);
const errorMsg = ref('');
const errorTrace = ref('trace-ci-77b1c9');
const unsignedImage = ref(false);
const released = ref<string[]>([]);

const visible = computed(() => RUNS.slice(0, limit.value));
const matched = computed(() => RUNS);
const edgeSummary = computed(() => `运行记录 ${RUNS.length} 条，超过单次渲染阈值（${PAGE_SIZE} 条）已折叠。`);
const state = computed<ShellState>(() => {
  if (loading.value) return 'LOADING';
  if (errorMsg.value) return 'ERROR';
  if (!RUNS.length) return 'EMPTY';
  return RUNS.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

function reload() {
  loading.value = true;
  errorMsg.value = '';
  window.setTimeout(() => (loading.value = false), 200);
}

function loadMore() {
  limit.value += PAGE_SIZE;
}

/** 校验镜像签名：未签名（本地构建）镜像直接阻断——供应链策略不做静默降级 */
function verifyImage() {
  if (unsignedImage.value) {
    errorMsg.value = '镜像签名校验失败：本地构建镜像未签名（无 Sigstore 签名），CI 拒绝执行。';
    errorTrace.value = `trace-ci-${Math.abs(RUNS.length * 15485863).toString(16)}`;
    return;
  }
  errorMsg.value = '';
  MessagePlugin.success('镜像签名有效（Sigstore / cosign），digest 与签名者已记录到步骤账本');
}

/** 人工放行退出码 1 的运行：只改变该次门禁结论，不重跑；写入审计 */
function releaseRun(runId: string) {
  released.value = [...released.value, runId];
  ui.track('eco.ci.run.released', { runId });
  MessagePlugin.warning(`已人工放行 ${runId}：门禁标记为「已确认」，不会自动合并；放行动作已写入审计`);
}

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(active.value.snippet);
    MessagePlugin.success(`已复制 ${active.value.platform} 片段`);
  } catch {
    MessagePlugin.warning('浏览器未授权剪贴板，请手动选择复制');
  }
}

/** 片段下载：真实生成 .yml / .jenkins 文件（便于直接入库） */
function downloadSnippet() {
  const ext = active.value.platform === 'Jenkins' ? 'Jenkinsfile' : 'yml';
  const name = downloadText(`# ${active.value.platform} 片段（OpenCoding Harness ${CI_IMAGE.tag}）\n${active.value.snippet}\n`, `oc-ci-${tab.value.replace(/\s+/g, '-').toLowerCase()}.${ext}`);
  MessagePlugin.success(`已下载 ${name}`);
}

onMounted(() => {
  // 首次加载：读运行账本（退出码语义固定，不随平台变化）
  window.setTimeout(() => (loading.value = false), 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="CI 集成"
      desc="headless 容器 + 三套流水线片段（GitHub Actions / GitLab CI / Jenkins）：输出 JSON / SARIF / Markdown，退出码 0/1/2 表达「成功 / 需人工 / 失败」；权限与预算是必填项。"
      volume="卷 29"
      manifest="G2-01"
      cli="oc run --json --budget-usd 5 --permission readonly"
      :status="[{ label: '预算必填', theme: 'warning' }, { label: '默认 readonly', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="copySnippet">复制当前片段</Button>
        <Button size="small" theme="primary" @click="downloadSnippet">下载当前片段</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="CLI 镜像" :value="CI_IMAGE.tag" format="raw" icon="server" :hint="CI_IMAGE.name" />
      <StatCard label="流水线模板" :value="d.ciIntegrations.length" unit="套" icon="git" hint="官方 Action / include 模板 / 共享库片段" />
      <StatCard label="本次运行花费" :value="RUNS[0].costUsd" format="cost" unit="$" icon="chart" hint="预算水位由 --budget-usd 控制" />
      <StatCard label="需人工介入" :value="RUNS.filter((r) => r.exitCode === 1).length" unit="次" icon="user" :lower-is-better="true" hint="退出码 1：不自动失败，等待人工放行" />
    </div>

    <StateShell
      :state="state"
      :collapsed-summary="edgeSummary"
      :page-size="4"
      stage="正在读取 CI 运行记录…"
      empty-title="暂无 CI 运行记录"
      empty-desc="还没有流水线调用过 headless 容器；可从模板片段开始（GitHub Actions 官方 Action 最小 4 行）。"
      empty-action="复制默认片段"
      example-task="在 PR 门禁中运行 oc review --diff 并将 SARIF 上传到代码扫描"
      what="CI 运行记录读取失败"
      why="运行账本不可读（步骤账本 JSON 与当前内核 schema 版本不一致）。"
      how="可重试；或直接查看流水线内归档的 step-ledger.json。"
      :trace-id="errorTrace"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="copySnippet"
    >
      <Alert
        v-if="errorMsg"
        theme="error"
        :message="`事实：${errorMsg}`"
        description="原因：镜像未经发布流水线签名（本地构建或来源不明）。动作：改用已签名镜像（digest 固定），或按企业流程提交镜像签名后重试。"
        style="margin-bottom: 10px"
      />
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">容器镜像（headless 运行环境）</div>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'name', label: '镜像', value: `${CI_IMAGE.name}:${CI_IMAGE.tag}`, mono: true, copyable: true },
              { key: 'digest', label: 'digest（固定，禁止浮动 tag）', value: CI_IMAGE.digest, mono: true },
              { key: 'sig', label: '签名', value: CI_IMAGE.signature, tag: { text: '签名有效', theme: 'success' } },
              { key: 'plat', label: '平台', value: CI_IMAGE.platforms },
              { key: 'size', label: '镜像大小', value: `${CI_IMAGE.sizeMb} MB` },
            ]"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <CliHint :command="CI_IMAGE.pull" label="拉取命令（可复制）" />
            <CopyableId :id="CI_IMAGE.digest" label="复制 digest" />
            <Button size="small" variant="outline" @click="verifyImage">校验镜像签名</Button>
          </div>
          <div class="oc-flex" style="gap: 8px; align-items: center; margin-top: 8px">
            <Switch v-model="unsignedImage" size="small" />
            <span style="font-size: 12px">改用未签名的本地构建镜像（用于观察 Fail-Closed 阻断；企业形态不允许）</span>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">权限与预算（必填，缺一即拒绝执行）</div>
          <Alert
            theme="warning"
            message="CI 中必须显式声明权限与预算，任何缺省都按最严禁方案处理。"
            description="未声明 permission → 以 readonly 运行；未声明 budget-usd → 拒绝启动（不静默使用无限预算）。受限写必须列出分支与路径白名单。"
          />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'perm', label: '默认权限', value: active.permissionDefault },
              { key: 'budget', label: '预算声明', value: active.budgetRequired ? '必填（--budget-usd 或模板 with.budget-usd）' : '可选' },
              { key: 'ctr', label: '产物入口', value: active.entry, mono: true },
              { key: 'install', label: '接入方式', value: active.install, mono: true },
            ]"
          />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            预算耗尽的退出码是 2（失败并阻断），不降级为「部分成功」——成本与结论都必须显式。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">流水线片段（可复制 / 可下载）</div>
        <Tabs v-model:value="tab">
          <TabPanel v-for="ci in d.ciIntegrations" :key="ci.platform" :value="ci.platform" :label="ci.platform">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
              <Tag size="small" variant="outline">{{ ci.artifact }}</Tag>
              <Tag size="small" variant="outline">{{ ci.install }}</Tag>
              <CliHint :command="ci.entry" label="等价命令" />
            </div>
            <pre class="oc-pre">{{ ci.snippet }}</pre>
            <div class="oc-flex" style="gap: 6px; margin-top: 6px">
              <Button size="small" variant="outline" @click="copySnippet">复制片段</Button>
              <Button size="small" variant="outline" @click="downloadSnippet">下载片段</Button>
              <OcIcon name="lightbulb" size="14px" />
              <span class="oc-muted" style="font-size: 12px">片段含预算与权限声明，缺项会被流水线前置检查拒绝（Fail-Fast）。</span>
            </div>
          </TabPanel>
        </Tabs>
      </div>

      <div class="oc-grid oc-grid--3" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">headless 命令</div>
          <Table :data="HEADLESS_CMDS" row-key="cmd" size="small" :columns="[
            { colKey: 'cmd', title: '命令', cell: 'cmd' },
            { colKey: 'use', title: '用途', ellipsis: true },
            { colKey: 'exits', title: '退出码', width: 100 },
          ]" :pagination="undefined">
            <template #cmd="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.cmd }}</span></template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">输出格式</div>
          <div class="oc-stack" style="gap: 8px">
            <div v-for="o in d.ciIntegrations[0].outputs" :key="o.format" class="oc-flex" style="gap: 6px; align-items: center">
              <Tag size="small" :theme="o.available ? 'success' : 'default'" variant="light-outline">{{ o.format }}</Tag>
              <span style="font-size: 13px">{{ o.usage }}</span>
              <Tag v-if="!o.available" size="small" theme="default" variant="outline">该平台未默认开启</Tag>
            </div>
          </div>
          <Alert theme="info" style="margin-top: 8px" message="SARIF 用于代码问题展示；JSON 是权威账本（含证据与成本），Markdown 仅用于评论摘要。" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            示例：Jenkins 需额外插件才支持 SARIF；不支持时显式标注并回退 JSON（不静默丢产物）。
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">退出码语义</div>
          <Table :data="EXIT_SEMANTICS" row-key="code" size="small" :columns="[
            { colKey: 'code', title: '码', width: 60, cell: 'code' },
            { colKey: 'meaning', title: '含义' },
            { colKey: 'behavior', title: '流水线行为', ellipsis: true },
          ]" :pagination="undefined">
            <template #code="{ row }"><Tag size="small" :theme="EXIT_THEME[row.code]" variant="light-outline">{{ row.code }}</Tag></template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">0 = 成功 / 1 = 需人工 / 2 = 失败；语义固定，不被平台差异改写。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">CI 运行记录（runId / 模式 / 退出码 / 花费 / 产物）· 匹配 {{ matched.length }} 条</div>
        <Table :data="visible" row-key="runId" size="small" :columns="runColumns" table-layout="fixed">
          <template #runIdCell="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.runId }}</span></template>
          <template #exit="{ row }">
            <Tooltip :content="EXIT_SEMANTICS[row.exitCode]?.meaning ?? ''">
              <Tag size="small" :theme="EXIT_THEME[row.exitCode] ?? 'default'" variant="light-outline">{{ row.exitCode }}</Tag>
            </Tooltip>
          </template>
          <template #cost="{ row }"><span class="oc-mono" style="font-size: 12px">${{ row.costUsd.toFixed(2) }}</span></template>
          <template #ops="{ row }">
            <Popconfirm
              v-if="row.exitCode === 1 && !released.includes(row.runId)"
              content="人工放行只把该次门禁结论标记为「已确认」，不会重跑任务、也不会自动合并；放行动作写入审计（操作者 / 时间 / 理由），不可撤销。是否继续？"
              @confirm="releaseRun(row.runId)"
            >
              <Button size="small" variant="text">人工放行</Button>
            </Popconfirm>
            <Tag v-else-if="released.includes(row.runId)" size="small" theme="warning" variant="light-outline">已放行</Tag>
            <span v-else class="oc-muted" style="font-size: 12px">—</span>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
