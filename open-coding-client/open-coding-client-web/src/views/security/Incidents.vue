<script setup lang="ts">
/**
 * 安全事件响应（G3-07）：SEV1–4 + 四角色 + 冻结隔离 + 取证 + 复盘。
 * 溯源：卷 30 §4.7 / 卷 32 RB-09
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const d = enterpriseData;
/** 事件列表以响应式代理渲染：冻结隔离后状态标签、处置动作与统计卡需立即更新 */
const incidents = ref(d.securityIncidents);
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const sevFilter = ref('all');
const selectedId = ref(incidents.value[0].id);
const selected = computed(() => incidents.value.find((i) => i.id === selectedId.value) ?? incidents.value[0]);
const filtered = computed(() => incidents.value.filter((i) => sevFilter.value === 'all' || i.sev === sevFilter.value));
const open = computed(() => incidents.value.filter((i) => i.status !== 'CLOSED'));
const sevTheme: Record<string, 'danger' | 'warning' | 'primary' | 'default'> = { SEV1: 'danger', SEV2: 'danger', SEV3: 'warning', SEV4: 'default' };

/** 打开 RB-09：跳转 Runbook 库（RB-09 安全事件响应：四角色到位 + 冻结/吊销/取证/通告四步留痕） */
function openRunbook() {
  router.push('/ops/runbooks');
}

/** 冻结隔离：冻结写操作与会话、吊销关联凭证（只读与导出保留），追加处置动作并使事件进入已遏制 */
function freezeIsolate() {
  const inc = selected.value;
  const c = inc.containment;
  if (c.tenantFrozen && c.sessionFrozen && c.credentialRevoked) {
    MessagePlugin.warning(`事件 ${inc.id} 已处于冻结隔离状态（租户冻结 / 会话冻结 / 凭证吊销均已生效）：无需重复执行`);
    return;
  }
  c.tenantFrozen = true;
  c.sessionFrozen = true;
  c.credentialRevoked = true;
  const fromStatus = inc.status;
  if (inc.status === 'OPEN') inc.status = 'CONTAINED';
  inc.actions.push({
    at: new Date().toISOString(),
    actor: '控制台（安全值班）',
    action: '冻结隔离：租户写操作与会话冻结 + 关联凭证吊销',
    result: '只读与导出保留（不锁死数据）；解除冻结需安全负责人确认并留审计',
  });
  MessagePlugin.success(`已冻结隔离事件 ${inc.id}（${inc.sev}）：租户写操作 / 会话已冻结、凭证已吊销，状态 ${fromStatus} → ${inc.status}；只读与导出保留，解除需安全负责人确认，操作已留审计`);
}

onMounted(() => {
  setTimeout(() => { state.value = d.securityIncidents.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="安全事件响应"
      desc="SEV1–4 分级响应 + 指挥/处置/沟通/记录四角色；冻结与隔离手段（租户冻结、会话冻结、凭证吊销、插件熔断）+ 取证 + 复盘闭环。"
      volume="卷 30"
      manifest="G3-07"
      cli="oc sec incident list --sev 1,2 --runbook RB-09"
      :status="[{ label: 'Runbook RB-09', theme: 'danger' }, { label: '动作全留审计', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="openRunbook">打开 RB-09</Button>
        <Popconfirm theme="danger" :confirm-btn="{ content: '冻结隔离', theme: 'danger' }" cancel-btn="取消" @confirm="freezeIsolate">
          <template #content>
            <div style="max-width: 320px">
              <div>作用对象：选中事件 {{ selected.id }}（{{ selected.sev }}）所属租户的写操作、相关会话与关联凭证。</div>
              <div>影响：写操作与会话冻结、凭证吊销；只读与导出保留（不锁死数据），业务写入会失败并显式报错。</div>
              <div>是否可撤销：可解除（需安全负责人确认并留审计）。</div>
            </div>
          </template>
          <Button size="small" theme="danger" variant="outline">冻结隔离</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有安全事件"
      empty-desc="无事件可能因为检测未接入；请确认 DLP 阻断、越权检测与滥用检测三类信号均已上报。"
      empty-action="检查检测接入"
      example-task="推演 SEV2 场景：跨租户访问被拒绝 → 冻结 → 取证 → 复盘"
      what="安全事件列表加载失败"
      why="审计存储不可达或事件链校验中断（哈希链断裂属 SEV2）"
      how="可重试；哈希链断裂请立即按 RB-09 处置，不允许静默继续"
      trace-id="trace-incident-77a1c2"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="事件总数" :value="incidents.length" unit="起" icon="error" />
        <StatCard label="未闭环" :value="open.length" unit="起" :target="0" target-kind="max" icon="time" />
        <StatCard label="SEV1/2" :value="incidents.filter((i) => i.sev === 'SEV1' || i.sev === 'SEV2').length" unit="起" icon="secured" hint="客户与监管（如需）已通知" />
        <StatCard label="取证包" :value="incidents.length * 3" unit="件" hint="事件链 + 快照 + 哈希清单" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex oc-flex--wrap" style="gap: 4px">
          <Tag v-for="s in ['all', 'SEV1', 'SEV2', 'SEV3', 'SEV4']" :key="s" size="small" :theme="sevFilter === s ? 'primary' : 'default'" variant="light-outline" style="cursor: pointer" @click="sevFilter = s">
            {{ s === 'all' ? '全部级别' : s }}
          </Tag>
        </div>
        <Table :data="filtered" row-key="id" size="small" style="margin-top: 8px" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
          <template #id="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.id }}</span></template>
          <template #sev="{ row }"><Tag size="small" :theme="sevTheme[row.sev]" variant="light-outline">{{ row.sev }}</Tag></template>
          <template #title="{ row }">{{ row.title }}</template>
          <template #detectedBy="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.detectedBy }}</span></template>
          <template #status="{ row }">
            <Tag size="small" :theme="row.status === 'CLOSED' ? 'success' : row.status === 'CONTAINED' ? 'primary' : 'danger'" variant="light-outline">{{ row.status }}</Tag>
          </template>
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">选中事件：{{ selected.id }}（{{ selected.sev }}）</div>
          <InfoGrid
            :items="[
              { key: 'title', label: '事件', value: selected.title, span: 2 },
              { key: 'cmd', label: '指挥（Commander）', value: selected.roles.commander },
              { key: 'hdl', label: '处置（Handler）', value: selected.roles.handler },
              { key: 'comms', label: '沟通（Comms）', value: selected.roles.comms },
              { key: 'scribe', label: '记录（Scribe）', value: selected.roles.scribe },
              { key: 'pm', label: '复盘', value: selected.postmortemId },
              { key: 'notify', label: '客户通知', value: selected.customerNotified ? '已通知' : '不需要' },
            ]"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" :theme="selected.containment.tenantFrozen ? 'danger' : 'default'" variant="light-outline">租户冻结</Tag>
            <Tag size="small" :theme="selected.containment.sessionFrozen ? 'danger' : 'default'" variant="light-outline">会话冻结</Tag>
            <Tag size="small" :theme="selected.containment.credentialRevoked ? 'danger' : 'default'" variant="light-outline">凭证吊销</Tag>
            <Tag size="small" :theme="selected.containment.pluginTripped ? 'danger' : 'default'" variant="light-outline">插件熔断</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            冻结语义：写操作冻结但只读与导出保留（不锁死数据）；解除冻结需安全负责人确认并留审计。
          </div>
          <CopyableId id="trace-incident-7719" label="复制 traceId" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">处置动作与取证</div>
          <div v-for="a in selected.actions" :key="a.at" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 4px">
            <span class="oc-muted" style="font-size: 12px">{{ new Date(a.at).toLocaleString('zh-CN') }}</span>
            <Tag size="small" variant="outline">{{ a.actor }}</Tag>
            <span style="font-size: 12px">{{ a.action }}</span>
            <span class="oc-muted" style="font-size: 12px">→ {{ a.result }}</span>
          </div>
          <div class="oc-divider" />
          <Table :data="selected.forensics" row-key="artifact" size="small" :columns="[
            { colKey: 'artifact', title: '取证件' },
            { colKey: 'hash', title: '哈希', width: 170 },
          ]">
            <template #hash="{ row }">
              <Tooltip :content="row.note"><span class="oc-mono" style="font-size: 11px">{{ String(row.hash).slice(0, 18) }}…</span></Tooltip>
            </template>
          </Table>
        </div>
      </div>
    </StateShell>
  </div>
</template>
