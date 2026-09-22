<script setup lang="ts">
/**
 * D-01 更新中心：当前版本卡 + 三通道切换（只升不降）+ 检查更新 + 四种更新决策 + 升级历史。
 * 硬约束：通道切换只影响后续更新来源且只升不降；「延后」不影响强制门槛公告的阻断。
 * 溯源：卷 28 §4.1 / BUILD-MANIFEST D-01
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import type { UpdateCandidate, UpdateChannel } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';

interface UpdateDecision { key: string; label: string; desc: string; consequence: string; theme: 'default' | 'primary' | 'warning' | 'danger' }

const ui = useUiStore();
const d = enterpriseData;
const state = ref<UiStateKind>('LOADING');
const channel = ref<UpdateChannel>('stable');
const checking = ref(false);
const found = ref<UpdateCandidate | null>(null);
const decision = ref<UpdateDecision | null>(null);
const decisionOpen = ref(false);
const decided = ref('');
const historySize = ref(4);
/** 当前运行版本与构建号（构建号用于精确定位本机安装的制品） */
const currentVersion = '2.9.1';
const currentBuild = 'build-20260912-2c81';const channelMeta = computed(() => d.channels.find((c) => c.name === channel.value));
const history = computed(() => d.updateHistory.slice(0, historySize.value));
const isEdge = computed(() => d.updateHistory.length > historySize.value);
const resultTheme: Record<string, 'success' | 'warning' | 'danger'> = { SUCCEEDED: 'success', ROLLED_BACK: 'warning', BLOCKED: 'warning', FAILED: 'danger' };
const decisions: UpdateDecision[] = [
  { key: 'force', label: '强制升级', desc: '安全修复或兼容硬门槛：不升级将无法连接服务端。', consequence: '立即进入下载与应用流程；升级期间不可提交新任务，进行中任务保留并在安全点暂停。', theme: 'danger' },
  { key: 'recommended', label: '推荐升级', desc: '稳定性 / 性能改进，建议在空闲窗口应用。', consequence: '加入待办；检测到无运行中任务时自动应用（可随时取消）。', theme: 'primary' },
  { key: 'optional', label: '可忽略', desc: '小改进，跳过不影响后续升级路径。', consequence: '仅记录决策；后续大版本升级会自动包含该变更，无需单独处理。', theme: 'default' },
  { key: 'later', label: '延后提醒', desc: '暂不处理，7 天后再次提醒。', consequence: '7 天后再次提示；「强制」级别公告不受延后影响，届时仍会阻断服务端连接。', theme: 'warning' },
];
/** 版本号比较：仅比较数字段（忽略 rc/nightly 后缀），负数表示 a 低于 b */
function compareVersion(a: string, b: string): number {
  const seg = (v: string) => v.split(/[.-]/).map((s) => Number.parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  const [pa, pb] = [seg(a), seg(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}
/** 通道切换：只升不降 —— 候选低于当前版本时直接拒绝，避免误切旧通道造成版本回退 */
function switchChannel(next: UpdateChannel) {
  const nextCandidate = d.updateCandidates.find((c) => c.channel === next);
  if (nextCandidate && compareVersion(nextCandidate.version, currentVersion) < 0) {
    MessagePlugin.error(`已拒绝切换到 ${next}：候选 ${nextCandidate.version} 低于当前 ${currentVersion}（只升不降）`);
    return;
  }
  channel.value = next;
  found.value = null;
  MessagePlugin.success(`已切换至 ${next} 通道：仅影响后续更新来源，不会降级当前版本`);
}
/** 检查更新：模拟异步拉取通道索引并校验签名（真实实现会同时校验 CDN 就绪） */
function checkUpdate() {
  checking.value = true;
  found.value = null;
  window.setTimeout(() => {
    checking.value = false;
    found.value = d.updateCandidates.find((c) => c.channel === channel.value) ?? null;
    if (!found.value) MessagePlugin.success('当前通道无更新，已是最新版本');
    else MessagePlugin.info(`发现新版本 ${found.value.version}（${channel.value} 通道，CDN ${found.value.cdnReady ? '已就绪' : '未就绪'}）`);
  }, 900);
}
function openDecision(dc: UpdateDecision) { decision.value = dc; decisionOpen.value = true; }
function confirmDecision() {
  if (!decision.value) return;
  decided.value = decision.value.key;
  MessagePlugin.success(`已记录决策「${decision.value.label}」：${decision.value.consequence}`);
  decisionOpen.value = false;
}
function exportHistory() {
  downloadJson({ currentVersion, currentBuild, channel: channel.value, history: d.updateHistory }, 'update-history.json');
  MessagePlugin.success('升级历史已导出（JSON，含结果与回滚原因）');
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = d.updateHistory.length ? (isEdge.value ? 'EDGE_DATA' : 'NORMAL') : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}
onMounted(load);
</script>

<template>
  <div class="oc-page">
    <PageHeader title="更新中心" volume="卷 28" manifest="D-01" cli="oc update check --channel stable"
      desc="当前版本与构建号、三通道（stable / beta / nightly）切换、检查更新与四种更新决策；通道切换只升不降，历史含结果与回滚原因。"
      :status="[{ label: `当前 ${currentVersion}`, theme: 'default' }, { label: '只升不降', theme: 'warning' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportHistory"><OcIcon name="download" size="12px" /> 导出历史</Button>
        <Button size="small" theme="primary" :loading="checking" @click="checkUpdate"><OcIcon name="refresh" size="12px" /> 检查更新</Button>
      </template>
    </PageHeader>
    <StateShell :state="state" :page-size="historySize" trace-id="trace-upd-center-4b90ce" empty-action="检查更新"
      :collapsed-summary="`共 ${d.updateHistory.length} 条升级历史，已折叠展示前 ${historySize} 条（加载更多不静默截断）`"
      empty-title="没有升级记录" example-task="在 beta 通道演练一次 2.10.0-rc.3 升级（预发环境，含迁移演练）"
      empty-desc="本机尚未执行过升级；可先「检查更新」查看当前通道的候选版本与迁移预估。"
      what="升级历史加载失败" why="本地更新状态库不可读（文件被占用或校验和不匹配），无法确认当前版本与保留版本。"
      how="可重试；持续失败请导出诊断包（含更新器日志与状态库快照）后反馈。"
      @retry="load" @load-more="historySize = d.updateHistory.length; state = 'NORMAL'" @empty-action="checkUpdate">
      <div class="oc-grid oc-grid--4">
        <StatCard label="当前版本" :value="currentVersion" format="raw" icon="download" :hint="`构建号 ${currentBuild}`" />
        <StatCard label="当前通道" :value="channel" format="raw" icon="layers" :hint="channelMeta?.audience" />
        <StatCard label="候选版本" :value="found?.version ?? '未检查'" format="raw" icon="file" :hint="found ? `发布 ${new Date(found.releasedAt).toLocaleDateString('zh-CN')}` : '点击「检查更新」'" />
      </div>
      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">更新通道（切换只升不降：候选版本低于当前版本时拒绝切换）</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Button v-for="c in d.channels" :key="c.name" size="small" @click="switchChannel(c.name)"
            :theme="channel === c.name ? 'primary' : 'default'" :variant="channel === c.name ? 'base' : 'outline'">{{ c.label }}</Button>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          {{ channelMeta?.desc }}；适用：{{ channelMeta?.audience }}。切换通道只改变后续更新来源，不会降级当前版本。
        </div>
        <div v-if="found" class="oc-card" style="margin-top: 10px; border-left: 3px solid var(--td-brand-color, #0052d9)">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Tag theme="success" variant="light-outline" size="small">发现新版本</Tag>
            <span class="oc-mono">{{ currentVersion }} → {{ found.version }}</span>
            <Tag :theme="found.mandatory ? 'danger' : 'primary'" variant="light-outline" size="small">{{ found.mandatory ? '强制门槛' : '可选升级' }}</Tag>
            <Tag v-if="!found.cdnReady" theme="warning" variant="light-outline" size="small">CDN 未就绪（仅内部源）</Tag>
            <span class="oc-grow" /><CliHint :command="`oc update apply --to ${found.version} --channel ${channel}`" />
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
            最低来源版本：{{ found.minVersion }}；说明：{{ found.note }}。{{ found.announcement.title }}；迁移：{{ found.migration.hasMigration ? `需迁移（预估 ${found.migration.estimatedMinutes} 分钟，${found.migration.rollbackable ? '可回滚' : '不可回滚'}）` : '无需迁移' }}
          </div>
        </div>
      </div>
      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">更新决策（每种决策的后果与可撤销性）</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
          <Tooltip v-for="dc in decisions" :key="dc.key" :content="dc.desc">
            <Button size="small" :theme="dc.theme" variant="outline" @click="openDecision(dc)">{{ dc.label }}</Button>
          </Tooltip>
          <Tag v-if="decided" size="small" theme="success" variant="light-outline">已记录：{{ decisions.find((x) => x.key === decided)?.label }}</Tag>
        </div>
        <div class="oc-state__hint" style="margin-top: 6px">升级为危险操作：进入应用阶段后不可撤销（可回滚到保留版本）；「延后」不改变强制门槛公告的阻断效果。</div>
      </div>
      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">升级历史（版本 / 通道 / 时间 / 结果 / 回滚原因）</div>
        <Table :data="history" row-key="appliedAt" size="small" style="margin-top: 8px" :columns="[
          { colKey: 'version', title: '版本', width: 170 }, { colKey: 'channel', title: '通道', width: 90 },
          { colKey: 'appliedAt', title: '时间', width: 180 }, { colKey: 'result', title: '结果', width: 120 },
          { colKey: 'reason', title: '结果说明 / 回滚原因' }]">
          <template #version="{ row }"><span class="oc-mono">{{ row.fromVersion }} → {{ row.version }}</span></template>
          <template #channel="{ row }"><Tag size="small" variant="light-outline">{{ row.channel }}</Tag></template>
          <template #appliedAt="{ row }">{{ new Date(row.appliedAt).toLocaleString('zh-CN') }}</template>
          <template #result="{ row }">
            <Tooltip :content="`耗时 ${row.durationMinutes} 分钟 · 操作者：${row.actor}`">
              <Tag size="small" :theme="resultTheme[String(row.result)] ?? 'default'" variant="light-outline">{{ row.result }}</Tag>
            </Tooltip>
          </template>
          <template #reason="{ row }"><span class="oc-muted">{{ row.reason }}</span></template>
        </Table>
        <div v-if="isEdge" class="oc-state__hint">EDGE_DATA：共 {{ d.updateHistory.length }} 条，仅渲染前 {{ historySize }} 条；「加载更多」按游标分页，不静默截断。</div>
      </div>
    </StateShell>

    <Dialog v-model:visible="decisionOpen" :header="`确认「${decision?.label ?? ''}」`" width="560px" cancel-btn="取消"
      :confirm-btn="{ content: '确认', theme: decision?.theme === 'danger' ? 'danger' : 'primary' }" @confirm="confirmDecision">
      <div class="oc-stack">
        <div>{{ decision?.desc }}</div>
        <div class="oc-muted" style="font-size: 12px">后果：{{ decision?.consequence }}</div>
        <div v-if="decision?.key === 'force'" class="oc-state__hint">强制升级期间服务端连接被阻断（公告等级「强制」）；升级路径：设置 → 更新中心 → 检查更新 → 下载并应用。</div>
      </div>
    </Dialog>
  </div>
</template>
