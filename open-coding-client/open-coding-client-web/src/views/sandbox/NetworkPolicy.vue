<script setup lang="ts">
/** 网络策略（B-06）：白名单/黑名单 + 工具族候选确认 + 审计代理开关。溯源：卷 07 D-SBOX-4 §4.4 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Table, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { NetworkDomain, ToolFamilyCandidate } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { networkPolicy, egressRecords } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const tab = ref<'allow' | 'deny' | 'candidates'>('allow');
const pageSize = ref(8);
const addOpen = ref(false);
const addTarget = ref<NetworkDomain | null>(null);
const pendingCandidate = ref<ToolFamilyCandidate | null>(null);
const denyDialog = ref(false);
const err = ref(makeError('SANDBOX_DENIED', '加白申请被组织基线拒绝（黑名单站点不可加白）'));

const allowRows = computed(() => networkPolicy.allowlist);
const denyRows = computed(() => networkPolicy.denylist);
const candidateRows = computed(() => networkPolicy.toolFamilyCandidates);
const activeRows = computed(() => (tab.value === 'allow' ? allowRows.value : tab.value === 'deny' ? denyRows.value : candidateRows.value));
const shown = computed(() => activeRows.value.slice(0, pageSize.value));
const blocked = computed(() => egressRecords.filter((e) => e.verdict === '拒绝').length);

const domainColumns = [
  { colKey: 'domain', title: '域名', width: 230 },
  { colKey: 'reason', title: '原因', ellipsis: true },
  { colKey: 'source', title: '来源', width: 150 },
  { colKey: 'requestCount', title: '请求数', width: 100 },
  { colKey: 'bytes', title: '流量', width: 110 },
  { colKey: 'addedAt', title: '加入时间', width: 170 },
];
const candidateColumns = [
  { colKey: 'family', title: '工具族', width: 200 },
  { colKey: 'domains', title: '候选域名', width: 340 },
  { colKey: 'status', title: '确认状态', width: 110 },
  { colKey: 'requestCount', title: '请求数', width: 100 },
  { colKey: 'note', title: '说明', ellipsis: true },
  { colKey: 'ops', title: '操作', width: 150 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = activeRows.value.length === 0 ? 'EMPTY' : activeRows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function switchTab(t: 'allow' | 'deny' | 'candidates') {
  tab.value = t;
  refresh();
}

function confirmCandidate(c: ToolFamilyCandidate, accept: boolean) {
  if (accept && c.status === '已拒绝') {
    denyDialog.value = true;
    return;
  }
  pendingCandidate.value = null;
  MessagePlugin.success(accept ? `已确认「${c.family}」候选域名：加入白名单（受组织基线约束，出网仍全量审计）` : `已拒绝「${c.family}」候选：保持默认拒绝（可重新提交申请）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="网络策略"
      desc="默认拒绝 + 白名单（包管理器 / Git 平台 / 模型端点）+ 审计代理叠加：出网请求全量记录（域名、方法、字节），可对响应做敏感信息扫描。"
      volume="卷 07"
      manifest="B-06"
      cli="oc sandbox network list --allowlist --pending-candidates"
      :status="[{ label: `默认 ${networkPolicy.defaultAction}`, theme: networkPolicy.defaultAction === 'deny' ? 'success' : 'warning' }, { label: `审计代理 ${networkPolicy.proxyAuditEnabled ? '开启' : '关闭'}`, theme: networkPolicy.proxyAuditEnabled ? 'primary' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="switchTab('allow'); addOpen = true">申请加白</Button>
        <Popconfirm theme="warning" content="关闭审计代理将停止记录出网元数据（仍执行白名单判定）。企业档建议保持开启，关闭需理由。确认关闭？" @confirm="MessagePlugin.warning('审计代理已关闭：出网判定仍生效，但不再记录域名/字节明细（已记录历史保留）')">
          <Button size="small" variant="outline">切换审计代理</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="白名单域名" :value="allowRows.length" format="raw" icon="link" />
      <StatCard label="黑名单域名" :value="denyRows.length" format="raw" icon="close" hint="黑名单优先级高于白名单（拒绝优先）" />
      <StatCard label="待确认工具族候选" :value="candidateRows.filter((c) => c.status === '待确认').length" format="raw" icon="help" hint="未确认一律拒绝（不静默放行）" />
      <StatCard label="24h 出网" :value="Number((networkPolicy.egressBytes24h / 1024 / 1024).toFixed(1))" unit="MB" format="raw" icon="cloud" :hint="`被拒绝 ${blocked} 次`" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Tag :theme="tab === 'allow' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="switchTab('allow')">白名单 {{ allowRows.length }}</Tag>
      <Tag :theme="tab === 'deny' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="switchTab('deny')">黑名单 {{ denyRows.length }}</Tag>
      <Tag :theme="tab === 'candidates' ? 'primary' : 'default'" variant="light-outline" size="small" style="cursor: pointer" @click="switchTab('candidates')">工具族候选 {{ candidateRows.length }}</Tag>
      <CliHint command="oc sandbox network candidates --accept '包管理器'" label="批量确认候选" />
    </div>

    <StateShell
      :state="state"
      empty-title="该列表为空"
      empty-desc="当前分类下没有域名记录（白名单为空意味着所有出网被拒绝）。"
      empty-action="切换到白名单"
      example-task="为 pypi.org 申请加白（附用途说明）"
      :what="'加白申请被拒绝'"
      :why="err.message"
      how="黑名单域名（数据外泄高风险站点）不可加白：组织基线强制；如需访问请改用内部镜像或提交例外评审（安全组审批）。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${activeRows.length} 条记录，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 8; state = pageSize >= activeRows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="switchTab('allow')"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">
          {{ tab === 'allow' ? '白名单（默认拒绝，仅这些域可出网）' : tab === 'deny' ? '黑名单（优先级最高，不可加白）' : '工具族候选（自动生成，需人工确认）' }}
        </h3>

        <Table v-if="tab !== 'candidates'" row-key="domain" size="small" :data="shown" :columns="domainColumns">
          <template #domain="{ row }"><span class="oc-mono" style="font-weight: 600">{{ row.domain }}</span></template>
          <template #source="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.source === '策略基线' ? 'danger' : row.source === '用户确认' ? 'success' : 'primary'">{{ row.source }}</Tag>
          </template>
          <template #bytes="{ row }">{{ (row.bytes / 1024 / 1024).toFixed(1) }} MB</template>
          <template #addedAt="{ row }">{{ new Date(row.addedAt).toLocaleDateString('zh-CN') }}</template>
        </Table>

        <Table v-else row-key="family" size="small" :data="shown" :columns="candidateColumns">
          <template #family="{ row }"><span style="font-weight: 600">{{ row.family }}</span></template>
          <template #domains="{ row }">
            <span v-for="d in row.domains" :key="d" class="oc-mono" style="font-size: 11px; margin-right: 6px">{{ d }}</span>
          </template>
          <template #status="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.status === '已确认' ? 'success' : row.status === '已拒绝' ? 'danger' : 'warning'">{{ row.status }}</Tag>
          </template>
          <template #ops="{ row }">
            <Popconfirm
              theme="warning"
              :content="`确认「${row.family}」：其候选域名将加入白名单，出网仍全量审计。可逆：可随时移出白名单（立即生效，在途连接不断开）。确认加入？`"
              @confirm="confirmCandidate(row, true)"
            >
              <Button size="small" variant="text">确认加入</Button>
            </Popconfirm>
            <Popconfirm theme="danger" :content="`拒绝「${row.family}」：保持默认拒绝（不静默放行）。可逆：可重新提交申请。确认拒绝？`" @confirm="confirmCandidate(row, false)">
              <Button size="small" variant="text" theme="danger">拒绝</Button>
            </Popconfirm>
          </template>
        </Table>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">策略语义（默认安全）</h3>
        <InfoGrid
          :columns="2"
          :items="[
            { key: 'n1', label: '默认动作', value: `defaultAction = ${networkPolicy.defaultAction}：未命中白名单一律拒绝（默认不外发）` },
            { key: 'n2', label: '审计代理', value: networkPolicy.proxyAuditEnabled ? '开启：记录域名/方法/大小/时间/发起命令 ID；可扫描响应敏感信息' : '关闭：仅判定不记录（企业档不推荐）' },
            { key: 'n3', label: '候选生成', value: '按工具族自动生成候选（包管理器 / 模型端点 / Git 平台 / 漏洞库 / 浏览器下载），需用户或策略确认' },
            { key: 'n4', label: '外泄检测', value: '出站内容与敏感模式匹配，命中即阻断并生成高优安全事件' },
            { key: 'n5', label: '黑名单优先级', value: '黑名单（含云元数据端点、匿名分享站点）优先级最高：即使被加白请求也直接拒绝' },
            { key: 'n6', label: '并发约束', value: '外发受并发上限约束（默认 4），排队显式标注「已排队」' },
          ]"
        />
      </div>
    </StateShell>

    <Dialog v-model:visible="addOpen" header="申请加白" width="560px" :on-confirm="() => { addOpen = false; MessagePlugin.success('加白申请已提交：需策略审批（含用途说明），审批通过后立即生效'); }" :on-cancel="() => (addOpen = false)">
      <div class="oc-stack">
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">域名（精确或通配，如 registry.npmjs.org / *.npmjs.org）</div>
          <Input model-value="" size="small" placeholder="registry.npmjs.org" />
        </div>
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">用途说明（必填，进入审计）</div>
          <Textarea model-value="" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="例如：依赖安装需要访问官方 npm 源（受锁文件强制策略约束）" />
        </div>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：加白后该域名请求被放行（仍受审计代理记录与出网并发约束）。
          可逆：可随时移出白名单（立即生效）。黑名单站点不可加白（申请将被组织基线直接拒绝并记安全事件）。
        </p>
      </div>
    </Dialog>

    <Dialog v-model:visible="denyDialog" theme="danger" header="该候选不可加白" width="480px" :footer="false">
      <div class="oc-stack">
        <p style="margin: 0; font-size: 13px">
          「{{ pendingCandidate?.family }}」的候选域名被组织策略标记为高风险（或已被拒绝），加白请求会被基线直接拒绝。
        </p>
        <InfoGrid :columns="1" :items="[
          { key: 'why', label: '原因', value: pendingCandidate?.note ?? '组织策略禁止该来源' },
          { key: 'alt', label: '替代路径', value: '改用内部镜像源 / 私仓（npm.yunshu.io）或提交安全组例外评审' },
        ]" />
        <div class="oc-flex" style="justify-content: flex-end">
          <Button size="small" variant="outline" @click="denyDialog = false">我知道了</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
