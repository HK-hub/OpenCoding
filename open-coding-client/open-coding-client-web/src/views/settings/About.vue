<script setup lang="ts">
/**
 * 关于（D-01）：版本 / 通道 / 构建号 / 许可状态（宽限与只读降级）/ 席位使用 / 更新检查入口 / 开源许可 / 演示声明。
 * 许可进入宽限期后系统降级为只读：仍可读取与导出，但禁止一切写操作与自治任务。溯源：卷 28 §4.1 / 卷 30。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, Select, Tag, Table } from 'tdesign-vue-next';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { enterpriseData } from '@/mock/data/enterprise';

const ui = useUiStore();
const router = useRouter();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const channel = ref<'stable' | 'beta' | 'nightly'>('stable');
const checkedTip = ref('');

const license = enterpriseData.license;
const BUILD_NO = 'b20260921.5';
const seatPct = computed(() => Math.round((license.seatsUsed / Math.max(1, license.seats)) * 100));

const CHANNEL_META = {
  stable: '稳定通道：只接收经灰度全量验证的版本（默认）',
  beta: 'Beta 通道：提前 2 周获得新能力，可能有回归风险',
  nightly: 'Nightly 通道：每日构建，仅建议在一次性环境验证',
} as const;

const ossList = [
  { name: 'TDesign Vue Next', license: 'MIT', role: 'UI 组件库' },
  { name: 'Vue 3', license: 'MIT', role: '视图框架' },
  { name: 'Vite', license: 'MIT', role: '构建工具' },
  { name: 'Pinia', license: 'MIT', role: '状态管理' },
  { name: 'Vue Router', license: 'MIT', role: '路由' },
  { name: 'TypeScript', license: 'Apache-2.0', role: '类型系统' },
];

const columns = [
  { colKey: 'name', title: '组件', width: 200 },
  { colKey: 'license', title: '许可', width: 120 },
  { colKey: 'role', title: '用途', ellipsis: true },
];

function checkUpdate() {
  checkedTip.value = `已检查更新：当前 ${channel.value} 通道为最新（构建 ${BUILD_NO}）`;
  ui.track('settings.about.update-checked', { channel: channel.value });
  MessagePlugin.info(checkedTip.value);
}

onMounted(() => {
  window.setTimeout(() => { state.value = 'NORMAL'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="关于"
      desc="版本与更新通道、许可与席位状态、开源许可与演示环境声明。演示环境全 Mock，不连接任何真实系统。"
      volume="卷 28"
      manifest="D-01"
      cli="oc about --version --license --check-update"
      :status="[{ label: `v2.9.1 · ${channel}`, theme: 'primary' }, { label: '演示环境（全 Mock）', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="checkUpdate">检查更新</Button>
        <Button size="small" theme="primary" @click="router.push('/distribution/updates')">打开更新中心</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="版本信息不可用"
      empty-desc="装配元数据缺失（构建产物被裁剪），无法展示版本与许可状态。"
      empty-action="重新读取元数据"
      example-task="切换更新通道到 beta 并检查一次更新，观察通道说明"
      what="版本元数据加载失败"
      why="构建元数据文件读取失败（签名校验未通过）"
      how="可重试；失败时以只读方式展示上次已知版本，不触发任何更新动作"
      trace-id="trace-about-1d09"
      collapsed-summary="开源许可清单超过单页阈值，低频依赖已折叠（仅展示直接依赖）。"
      :page-size="6"
      @retry="state = 'LOADING'"
      @empty-action="checkUpdate"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">版本与通道</div>
          <InfoGrid :columns="2" :items="[
            { key: 'ver', label: '产品版本', value: 'v2.9.1', mono: true },
            { key: 'build', label: '构建号', value: BUILD_NO, mono: true, copyable: true },
            { key: 'kernel', label: '内核版本', value: 'kernel 2.9.1+8f3c', mono: true },
            { key: 'proto', label: '协议族', value: 'anthropic / openai / gemini / ollama' },
          ]" />
          <div class="oc-flex" style="gap: 8px; align-items: center; margin-top: 8px">
            <span style="font-size: 12px">更新通道</span>
            <Select v-model="channel" size="small" style="width: 160px" :options="[{ label: 'stable', value: 'stable' }, { label: 'beta', value: 'beta' }, { label: 'nightly', value: 'nightly' }]" />
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">影响：{{ CHANNEL_META[channel] }}</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">许可状态</div>
          <InfoGrid :columns="2" :items="[
            { key: 'edition', label: '版本类型', value: license.edition },
            { key: 'status', label: '许可状态', value: license.status },
            { key: 'expires', label: '到期时间', value: license.expiresAt.slice(0, 10) },
            { key: 'grace', label: '宽限剩余', value: `${license.graceDaysLeft} 天`, tag: { text: license.graceDaysLeft <= 30 ? '接近只读' : '正常', theme: license.graceDaysLeft <= 30 ? 'warning' : 'success' } },
            { key: 'readonly', label: '只读降级', value: license.readOnly ? '已进入只读（可导出）' : '宽限期内读写正常' },
            { key: 'export', label: '导出可用', value: license.exportUsable ? '始终可用（含只读期）' : '不可用', tag: { text: license.exportUsable ? '可用' : '不可用', theme: license.exportUsable ? 'success' : 'danger' } },
          ]" />
          <div class="oc-flex" style="gap: 6px; margin-top: 8px; align-items: center">
            <OcIcon name="lock" size="13px" />
            <span class="oc-muted" style="font-size: 12px">宽限期结束 → 只读模式：读取与导出保留，写操作与自治任务暂停（不删数据）。</span>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">席位使用（30 天活跃口径）</div>
          <div class="oc-flex oc-flex--between" style="font-size: 12px">
            <span>{{ license.seatsUsed }} / {{ license.seats }} 席位</span>
            <span class="oc-mono">{{ seatPct }}%</span>
          </div>
          <Progress :percentage="seatPct" :status="seatPct > 90 ? 'warning' : 'success'" :label="false" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            对账差异：上报 {{ license.reconcile[0]?.reportedSeats ?? 0 }} / 计费 {{ license.reconcile[0]?.billedSeats ?? 0 }}（口径：30 天内有活动的席位）。
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <CliHint command="oc license status --seats --reconcile" />
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">演示环境声明</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag size="small" theme="danger" variant="light-outline">全 Mock 数据</Tag>
            <Tag size="small" variant="outline">不连接真实系统</Tag>
            <Tag size="small" variant="outline">不产生真实费用</Tag>
            <Tag size="small" variant="outline">不读写真实仓库</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            本客户端为交互原型：审批、成本、遥测与更新均为确定性模拟数据；演示控制台可强制六态与故障注入，用于自审与走查。
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <span v-if="checkedTip" class="oc-muted" style="font-size: 12px">{{ checkedTip }}</span>
            <CopyableId id="trace-about-1d09" label="复制 traceId" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">开源许可</div>
        <Table :data="ossList" row-key="name" size="small" :columns="columns" :pagination="undefined">
          <template #name="{ row }"><Tag size="small" variant="light-outline">{{ row.name }}</Tag></template>
          <template #license="{ row }"><Tag size="small" variant="light-outline">{{ row.license }}</Tag></template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">完整清单（含传递依赖）随分发介质提供，可在「更新中心 → 制品详情」导出。</div>
      </div>
    </StateShell>
  </div>
</template>
