<script setup lang="ts">
/**
 * D-01 更新进度：断点续传下载 → 校验（验签 / 防降级 / 证书固定）→ 预检清单 → 应用。
 * 硬约束：预检未通过时「应用」按钮禁用并显式给出原因与建议动作；预检失败阻断而非跳过。
 * 溯源：卷 28 §4.1 / BUILD-MANIFEST D-01
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Progress, Steps, StepItem, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
type CheckState = 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL';
interface Precheck { key: string; name: string; pass: boolean; detail: string; suggestion: string }
const ui = useUiStore();
const d = enterpriseData;
const target = d.updateCandidates[0];
const state = ref<UiStateKind>('LOADING');
const phase = ref(0);
const receivedMb = ref(261.4);
const totalMb = ref(target.artifacts[0].sizeMb);
const downloading = ref(false);
const blockOpen = ref(false);
const timer = ref<number | null>(null);
const pct = computed(() => Math.round(Math.min(1, receivedMb.value / totalMb.value) * 1000) / 10);
const resumeShards = computed(() => `已确认分片 ${Math.floor((receivedMb.value / totalMb.value) * 96)}/96（断点续传：中断后从已确认分片恢复，不重下）`);
const verifySteps = ref<{ name: string; state: CheckState; detail: string }[]>([
  { name: '制品验签（企业签名公钥）', state: 'PENDING', detail: '下载完成后执行；签名不符即拒绝' },
  { name: '防降级校验（≥ minVersion 且 ≥ 已安装版本）', state: 'PENDING', detail: `基线：minVersion ${target.minVersion}，已安装 2.9.1` },
  { name: '证书固定校验（pinning）', state: 'PENDING', detail: '代理 / MITM 环境显式报错，不静默降级' },
]);
/** 预检清单：磁盘项为负样本（未通过 → 应用禁用 + 阻断弹窗给出建议动作） */
const prechecks = ref<Precheck[]>([
  { key: 'disk', name: '磁盘可用空间', pass: false, detail: '可用 12%（需 ≥ 20%）', suggestion: '清理下载缓存与旧版本包（≥ 34 GB），或扩容后重新预检' },
  { key: 'deps', name: '依赖与运行时', pass: true, detail: 'Node 22 / JDK 21 / Docker 27 满足要求', suggestion: '' },
  { key: 'migration', name: '迁移演练（expand-contract）', pass: true, detail: '预发演练通过，耗时 3 分 42 秒（预算 6 分钟）', suggestion: '' },
  { key: 'plugin', name: '插件 / 技能兼容', pass: true, detail: '12 个插件兼容；1 个需同步升级（已提示，不阻断）', suggestion: '' },
  { key: 'tasks', name: '运行中任务', pass: true, detail: '无运行中任务（安全窗口，可立即应用）', suggestion: '' },
]);
const blocked = computed(() => prechecks.value.filter((p) => !p.pass));
function clearTimer() {
  if (timer.value !== null) window.clearInterval(timer.value);
  timer.value = null;
}
/** 继续下载：断点续传（从已确认分片恢复），完成后顺序执行校验步骤 */
function resumeDownload() {
  if (downloading.value || receivedMb.value >= totalMb.value) return;
  downloading.value = true;
  phase.value = 0;
  timer.value = window.setInterval(() => {
    receivedMb.value = Math.min(totalMb.value, Math.round((receivedMb.value + 37.7) * 10) / 10);
    if (receivedMb.value < totalMb.value) return;
    clearTimer();
    downloading.value = false;
    phase.value = 1;
    runVerify(0);
  }, 260);
}
/** 顺序执行三步校验：任一步失败将阻断应用（不会跳过） */
function runVerify(i: number) {
  if (i >= verifySteps.value.length) {
    phase.value = 2;
    MessagePlugin.success('校验全部通过：制品已落盘并验签，进入预检阶段');
    return;
  }
  verifySteps.value[i].state = 'RUNNING';
  window.setTimeout(() => {
    verifySteps.value[i].state = 'PASS';
    verifySteps.value[i].detail = ['签名与公钥匹配，制品完整', '候选 2.9.2 ≥ 基线 2.9.0，未触发防降级', '证书链固定校验通过（指纹已比对）'][i];
    runVerify(i + 1);
  }, 380);
}
/** 重新预检：模拟用户清理缓存后磁盘项通过（若仍失败会继续阻断） */
function rerunPrecheck() {
  MessagePlugin.info('重新预检开始：磁盘 / 依赖 / 迁移演练 / 插件兼容 / 运行中任务');
  window.setTimeout(() => {
    const disk = prechecks.value.find((p) => p.key === 'disk');
    if (disk) { disk.pass = true; disk.detail = '已清理 18.4 GB 缓存，可用 24%'; disk.suggestion = ''; }
    MessagePlugin.success(`预检完成：${blocked.value.length === 0 ? '全部通过，可应用' : '仍有未通过项，应用保持禁用'}`);
  }, 800);
}
function applyUpdate() {
  if (blocked.value.length) { blockOpen.value = true; return; }
  MessagePlugin.success('已应用 2.9.2：应用后自动执行启动自检与 SLI 抽样，异常将自动回滚（≤ 2 分钟）');
}
function exportLog() {
  downloadJson({ target: target.version, receivedMb: receivedMb.value, totalMb: totalMb.value, verifySteps: verifySteps.value, prechecks: prechecks.value }, 'update-progress-log.json');
  MessagePlugin.success('进度与预检日志已导出（JSON）');
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = 'NORMAL'; ui.setViewState({ state: 'NORMAL' }); }, 240);
}
onMounted(load);
onUnmounted(() => {
  // 离开页面时停止下载进度定时器：避免残留无归属定时器
  clearTimer();
});
</script>

<template>
  <div class="oc-page">
    <PageHeader title="更新进度" volume="卷 28" manifest="D-01" cli="oc update apply --to 2.9.2 --on-precheck-fail abort"
      desc="下载（断点续传字节数）→ 校验（验签 / 防降级 / 证书固定）→ 预检（磁盘 / 依赖 / 迁移演练 / 插件 / 运行中任务）→ 应用。"
      :status="[{ label: `目标 ${target.version}`, theme: 'primary' }, { label: '预检失败即阻断', theme: 'warning' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportLog"><OcIcon name="download" size="12px" /> 导出日志</Button>
        <Button size="small" variant="outline" :disabled="downloading || receivedMb >= totalMb" @click="resumeDownload">断点续传</Button>
        <Button size="small" theme="primary" :disabled="blocked.length > 0" @click="applyUpdate">应用更新</Button>
      </template>
    </PageHeader>
    <StateShell :state="state" trace-id="trace-upd-progress-9d2f14" empty-title="没有进行中的更新" empty-action="前往更新中心"
      empty-desc="当前没有下载或应用任务；可在「更新中心」检查更新后从「更新详情」发起下载。"
      example-task="断点续传下载 2.9.2（412 MB）并在预检通过后应用"
      what="更新进度加载失败" why="下载任务状态库不可读（更新器进程重启或分片索引损坏）"
      how="可重试；分片索引损坏时将从最后一个已确认分片继续，不重下已完成部分"
      @retry="load" @empty-action="load">
      <div class="oc-grid oc-grid--4">
        <StatCard label="下载进度" :value="pct" unit="%" icon="download" :hint="`${receivedMb} MB / ${totalMb} MB（断点续传可用）`" />
        <StatCard label="已确认分片" :value="Math.floor((receivedMb / totalMb) * 96)" unit="/ 96" icon="layers" hint="分片校验通过后才计入进度" />
        <StatCard label="校验步骤" :value="verifySteps.filter((s) => s.state === 'PASS').length" unit="/ 3" icon="secured" hint="验签 / 防降级 / 证书固定" />
        <StatCard label="预检未通过项" :value="blocked.length" unit="项" :lower-is-better="true" icon="error" hint="未通过时「应用」保持禁用" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">下载进度（断点续传字节数）</div>
        <Progress :percentage="pct" theme="line" :label="`${receivedMb} MB / ${totalMb} MB`" style="margin-top: 8px" />
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">{{ resumeShards }}；目标版本 {{ target.version }}（{{ target.channel }}），制品 {{ target.artifacts[0].platform }}。</div>
        <Steps :current="phase" size="small" style="margin-top: 10px">
          <StepItem title="下载" :content="`${totalMb} MB（多源）`" /><StepItem title="校验" content="验签 → 防降级 → 证书固定" />
          <StepItem title="预检" content="5 项；不通过即阻断" /><StepItem title="应用" content="自检 + SLI 抽样 + 可回滚" />
        </Steps>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">校验步骤（逐步状态，任一失败即阻断）</div>
          <Table :data="verifySteps" row-key="name" size="small" :columns="[{ colKey: 'name', title: '校验项' }, { colKey: 'state', title: '状态', width: 110 }]">
            <template #name="{ row }"><span>{{ row.name }}</span><div class="oc-muted" style="font-size: 11px">{{ row.detail }}</div></template>
            <template #state="{ row }">
              <Tag size="small" variant="light-outline" :theme="row.state === 'PASS' ? 'success' : row.state === 'RUNNING' ? 'primary' : row.state === 'FAIL' ? 'danger' : 'default'">{{ row.state }}</Tag>
            </template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">预检清单（逐项结果）<Button size="small" variant="outline" @click="rerunPrecheck">重新预检</Button></div>
          <Table :data="prechecks" row-key="key" size="small" :columns="[
            { colKey: 'name', title: '预检项', width: 170 }, { colKey: 'pass', title: '结果', width: 100 }, { colKey: 'detail', title: '详情与建议动作' }]">
            <template #pass="{ row }"><Tag size="small" variant="light-outline" :theme="row.pass ? 'success' : 'danger'">{{ row.pass ? '通过' : '未通过' }}</Tag></template>
            <template #detail="{ row }">
              <span>{{ row.detail }}</span>
              <div v-if="!row.pass" class="oc-muted" style="font-size: 11px">建议动作：{{ row.suggestion }}</div>
            </template>
          </Table>
          <div class="oc-state__hint" style="margin-top: 6px">预检失败即阻断（不跳过、不降级继续）；「应用更新」按钮在未通过时禁用，原因见下表。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <Tag size="small" :theme="blocked.length ? 'danger' : 'success'" variant="light-outline">
            {{ blocked.length ? `应用已禁用：${blocked.map((b) => b.name).join('、')} 未通过` : '预检通过，可应用' }}
          </Tag>
          <Button v-if="blocked.length" size="small" theme="warning" variant="outline" @click="blockOpen = true">查看阻断原因</Button>
          <span class="oc-grow" /><CliHint command="oc update precheck --report --json" />
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="blockOpen" header="预检失败：应用被阻断" width="560px" cancel-btn="关闭"
      :confirm-btn="{ content: '按建议处理后重试', theme: 'primary' }" @confirm="rerunPrecheck(); blockOpen = false">
      <div class="oc-stack">
        <div>未通过项：{{ blocked.map((b) => b.name).join('、') }}（共 {{ blocked.length }} 项）。</div>
        <div v-for="b in blocked" :key="b.key" class="oc-state__hint">
          <Tag size="small" theme="danger" variant="light-outline">{{ b.name }}</Tag>
          {{ b.detail }}；建议动作：{{ b.suggestion }}
        </div>
        <div class="oc-muted" style="font-size: 12px">处理完成后点击「重新预检」；通过前「应用更新」保持禁用（不会静默跳过预检项）。</div>
      </div>
    </Dialog>
  </div>
</template>
