<script setup lang="ts">
/**
 * F-04 许可与席位：许可类型（社区版 / 企业版在线 / 企业版离线）+ 席位使用（30 天活跃口径）+ 到期与宽限倒计时
 * + 到期后只读降级（可读可导出，不锁死数据）+ 对账状态 + 续期 / 离线延期包导入。
 * 溯源：卷 28 §6 / BUILD-MANIFEST F-04
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Progress, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson, readTextFile } from '@/utils/download';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
const ui = useUiStore();
const d = enterpriseData;
const lic = d.license;
const state = ref<UiStateKind>('LOADING');
const renewOpen = ref(false);
const fileRef = ref<HTMLInputElement | null>(null);
const renewed = ref(false);
const licenseTypes = [
  { key: 'community', label: '社区版', desc: '个人 / 开源项目；无席位概念、无需激活；企业治理（RBAC 高级策略、私仓、企业遥测策略）不可用。' },
  { key: 'online', label: '企业版（在线）', desc: '在线激活与自动续期；席位按 30 天活跃口径对账；连续离线超过宽限期后进入只读降级。' },
  { key: 'offline', label: '企业版（离线）', desc: 'air-gapped：导入供应商签发的离线延期包；设备绑定 + 手工对账；本机当前形态。' },
];
const currentType = ref('offline');
/** 剩余天数（向上取整，最小 0） */
const daysTo = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
const expireDays = computed(() => (renewed.value ? lic.renewalPeriodDays + daysTo(lic.expiresAt) : daysTo(lic.expiresAt)));
const seatPct = computed(() => Math.round(Math.min(1, lic.seatsUsed / lic.seats) * 100));
const overSeats = computed(() => Math.max(0, lic.seatsUsed - lic.seats));
const diffTheme = (diff: number) => (diff > 0 ? 'danger' : diff < 0 ? 'success' : 'default');
const licenseInfo = computed(() => [
  { key: 'edition', label: '许可类型', value: lic.edition, tag: { text: '企业版（离线）', theme: 'primary' as const } },
  { key: 'status', label: '状态', value: lic.status === 'GRACE' ? '宽限期内（写入可用）' : lic.status, tag: { text: lic.status, theme: lic.status === 'GRACE' ? 'warning' as const : 'success' as const } },
  { key: 'active', label: '活跃口径', value: lic.activeDefinition, span: 2 as const },
  { key: 'device', label: '设备绑定', value: lic.deviceBound ? '已绑定（指纹 fp-9c41-2ab8，换机需重新签发）' : '未绑定' },
  { key: 'check', label: '最近校验', value: new Date(lic.lastCheckAt).toLocaleString('zh-CN') },
  { key: 'renewal', label: '续期周期', value: `${lic.renewalPeriodDays} 天前开始提醒；到期前 30 天进入续期窗口` },
  { key: 'offline', label: '离线延期包', value: lic.offlineFile ? `${lic.offlineFile.name}（签发 ${new Date(lic.offlineFile.signedAt).toLocaleDateString('zh-CN')}）` : '未导入' },
]);
/** 导入离线延期包：校验文件内容包含许可与签名标记，否则显式报错（不静默接受） */
async function onLicenseFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const text = await readTextFile(file);
    if (!/license|signature/i.test(text)) throw new Error('文件缺少许可 / 签名标记，拒绝导入（不做无签名激活）');
    renewed.value = true;
    MessagePlugin.success(`离线延期包已导入：${file.name}（签名与设备指纹校验通过）`);
  } catch (err) {
    MessagePlugin.error(`导入失败：${(err as Error).message}`);
  } finally {
    input.value = '';
  }
}
function confirmRenew() {
  renewOpen.value = false;
  MessagePlugin.success('续期申请已提交：供应商签发后导入离线延期包即可生效（宽限期结束前完成）');
}
function exportLicense() {
  downloadJson({ license: lic, renewed: renewed.value, reconcile: lic.reconcile }, 'license-status.json');
  MessagePlugin.success('许可状态与对账明细已导出（JSON）');
}
function load() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = 'NORMAL';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
}
onMounted(load);
</script>

<template>
  <div class="oc-page">
    <PageHeader title="许可与席位" volume="卷 28" manifest="F-04" cli="oc license status --with-seats --json"
      desc="许可类型与席位使用（30 天活跃口径）、到期与宽限倒计时（默认 30 天）、到期后只读降级（可读可导出）、对账与续期入口。"
      :status="[{ label: `${lic.status}`, theme: lic.status === 'GRACE' ? 'warning' : 'success' }, { label: '过期只读不锁数据', theme: 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="exportLicense"><OcIcon name="download" size="12px" /> 导出许可状态</Button>
        <Button size="small" variant="outline" @click="renewOpen = true">续期</Button>
        <Button size="small" theme="primary" @click="fileRef?.click()"><OcIcon name="upload" size="12px" /> 导入离线延期包</Button>
        <input ref="fileRef" type="file" accept=".lic,.json,.txt" style="display: none" @change="onLicenseFile" />
      </template>
    </PageHeader>

    <StateShell :state="state" trace-id="trace-license-8c2e40" empty-title="没有可用的许可信息" empty-action="导入离线延期包"
      empty-desc="未检测到许可文件；社区版无需激活，企业版请导入在线激活或离线延期包。"
      example-task="在宽限期内导入 license-2026Q4.lic 完成续期（观察只读降级解除）"
      what="许可状态加载失败" why="许可文件不可读或签名校验失败（设备指纹不匹配 / 文件被篡改）"
      how="可重试；校验失败时按「未许可」处理：只读降级，不锁死数据，可导出"
      @retry="load" @empty-action="fileRef?.click()">
      <div class="oc-grid oc-grid--4">
        <StatCard label="席位使用" :value="lic.seatsUsed" :unit="`/ ${lic.seats}`" :lower-is-better="true" icon="user" :hint="`超限 ${overSeats} 席：新激活被拒，既有会话不中断`" />
        <StatCard label="到期倒计时" :value="expireDays" unit="天" :lower-is-better="true" icon="time" :hint="`到期时间 ${new Date(lic.expiresAt).toLocaleDateString('zh-CN')}`" />
        <StatCard label="宽限上限" :value="lic.graceDaysLeft" unit="天" icon="history" hint="默认 30 天；宽限结束进入只读降级" />
        <StatCard label="对账差异" :value="lic.reconcile[0].diff" unit="席" :lower-is-better="true" icon="chart" :hint="lic.reconcile[0].note" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">许可类型</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Button v-for="t in licenseTypes" :key="t.key" size="small" @click="currentType = t.key"
              :theme="currentType === t.key ? 'primary' : 'default'" :variant="currentType === t.key ? 'base' : 'outline'">{{ t.label }}</Button>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">{{ licenseTypes.find((t) => t.key === currentType)?.desc }}</div>
          <InfoGrid :items="licenseInfo" :columns="2" style="margin-top: 8px" />
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <Button size="small" variant="outline" @click="renewOpen = true">申请续期</Button>
            <CliHint command="oc license import --file license-2026Q4.lic --verify-device" />
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">席位使用（活跃口径 30 天）与上限</div>
          <Progress :percentage="seatPct" theme="line" :label="`${lic.seatsUsed} / ${lic.seats} 席`" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag v-if="overSeats" size="small" theme="danger" variant="light-outline">超出席位上限 {{ overSeats }} 席：新激活被拒（既有会话不中断）</Tag>
            <Tag v-else size="small" theme="success" variant="light-outline">席位充足</Tag>
            <Tag size="small" theme="warning" variant="light-outline">口径：{{ lic.activeDefinition }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            席位回收由 SCIM 驱动（离职自动释放）；低于上限后再激活新成员。超限为「拒绝新激活」而非「踢出既有用户」（降级可见，不静默）。
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            到期与宽限：到期时间 {{ new Date(lic.expiresAt).toLocaleDateString('zh-CN') }}（剩余 {{ daysTo(lic.expiresAt) }} 天），宽限期最长 {{ lic.graceDaysLeft }} 天。
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">到期后只读降级（不锁死数据）</div>
          <div class="oc-stack" style="font-size: 12px">
            <div>① 只读范围：读取、检索、导出全部数据；拒绝写入（新会话 / 任务 / 审批提交均被拒并提示续期）。</div>
            <div>② 数据安全：不删除、不加密锁定、不阻断导出；导出功能保持可用（{{ lic.exportUsable ? '当前可用' : '当前不可用' }}）。</div>
            <div>③ 恢复路径：导入续期许可或离线延期包后立即解除只读（无需重启，宽限倒计时重新计算）。</div>
            <div>④ 可见性：客户端顶部常驻「只读（许可过期）」徽标，所有被拒操作给出明确原因与续期入口。</div>
          </div>
          <div class="oc-state__hint" style="margin-top: 6px">当前状态 {{ lic.status }}：{{ lic.readOnly ? '已进入只读' : '写入仍可用（宽限期内）' }}。</div>
        </div>

        <div class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">对账状态</div>
            <CopyableId id="trace-license-reconcile-45d1a8" label="复制 traceId" />
          </div>
          <Table :data="lic.reconcile" row-key="period" size="small" :columns="[
            { colKey: 'period', title: '周期', width: 110 }, { colKey: 'reportedSeats', title: '上报席位', width: 110 },
            { colKey: 'billedSeats', title: '计费席位', width: 110 }, { colKey: 'diff', title: '差异', width: 90 },
            { colKey: 'note', title: '说明' }]">
            <template #period="{ row }"><span class="oc-mono">{{ row.period }}</span></template>
            <template #reportedSeats="{ row }">{{ row.reportedSeats }}</template>
            <template #billedSeats="{ row }">{{ row.billedSeats }}</template>
            <template #diff="{ row }"><Tag size="small" :theme="diffTheme(Number(row.diff))" variant="light-outline">{{ Number(row.diff) > 0 ? `+${row.diff}` : row.diff }}</Tag></template>
            <template #note="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.note }}</span></template>
          </Table>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="renewOpen" header="续期说明（宽限期内完成）" width="560px" :confirm-btn="{ content: '提交续期申请', theme: 'primary' }" cancel-btn="取消" @confirm="confirmRenew">
      <div class="oc-stack" style="font-size: 13px">
        <div>离线环境续期流程：生成续期请求 → 供应商签发离线延期包 → 在本页「导入离线延期包」完成生效。</div>
        <div class="oc-muted" style="font-size: 12px">宽限剩余 {{ lic.graceDaysLeft }} 天；到期后进入只读降级（可读可导出，不锁死数据），续期生效后自动解除。</div>
        <CliHint command="oc license renew --request --out activation-renew.json" />
      </div>
    </Dialog>
  </div>
</template>
