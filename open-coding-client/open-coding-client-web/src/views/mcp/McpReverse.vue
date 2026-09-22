<script setup lang="ts">
/**
 * 反向请求处理（C-09）：sampling（请求我方模型采样，消耗预算）与 elicitation（请求用户输入）。
 * 溯源：卷 09 D-MCP-9 策略化处理；sampling 计入会话预算并计量，elicitation 需用户在场。
 */
import { computed, ref } from 'vue';
import { Alert, Button, Dialog, MessagePlugin, RadioButton, RadioGroup, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';

const rows = computed(() =>
  extensionData.mcpServers.flatMap((s) => s.reverseRequests.map((r) => ({ ...r, server: s.name, serverId: s.serverId }))),
);

const samplingPolicy = ref('ask-once');
const elicitationPolicy = ref('require-user');

const detailOpen = ref(false);
const picked = ref<(typeof rows.value)[number] | null>(null);
const reason = ref('');

const columns = [
  { colKey: 'type', title: '类型', width: 120 },
  { colKey: 'server', title: '服务器', width: 180 },
  { colKey: 'detail', title: '请求内容' },
  { colKey: 'budget', title: '预算影响', width: 200 },
  { colKey: 'decision', title: '用户决定', width: 120 },
  { colKey: 'ops', title: '操作', width: 130 },
];

function open(r: (typeof rows.value)[number]) {
  picked.value = r;
  reason.value = '';
  detailOpen.value = true;
}

function decide(kind: 'allowed' | 'denied' | 'queued') {
  if (!picked.value) return;
  detailOpen.value = false;
  const label = kind === 'allowed' ? '已允许' : kind === 'denied' ? '已拒绝' : '已排队';
  MessagePlugin[kind === 'allowed' ? 'success' : kind === 'denied' ? 'warning' : 'info'](
    `${label}：${picked.value.type} 来自 ${picked.value.server}（${picked.value.budgetImpact}）；决策写入 mcp.reverse.request 事件`,
  );
}

const queueing = ref(false);
/** 排队队列：登记时间 + 来源，用户回来时按策略批量提示（页面上可见，不静默丢弃） */
const queue = ref<{ id: string; at: string; source: string }[]>([]);

/** 登记排队请求：短异步后写入页面可见的排队队列并更新计数 */
function enqueueRequest() {
  queueing.value = true;
  window.setTimeout(() => {
    queueing.value = false;
    queue.value.push({
      id: `REQ-${String(queue.value.length + 1).padStart(2, '0')}`,
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      source: '本页登记（用户在场）',
    });
    MessagePlugin.info(`已登记排队请求（队列 ${queue.value.length} 条）：将按策略在用户回来时批量提示`);
  }, 320);
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/mcp/reverse', () => rows.value.length > 0);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="反向请求策略"
      desc="反向请求打破「工具单向调用」模型：sampling 会消耗会话预算，elicitation 需要用户在场。"
      volume="卷 09" manifest="C-09" cli="oc mcp reverse list --pending"
      :status="[{ label: 'sampling 计费', theme: 'warning' }, { label: 'elicitation 需在场', theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="queueing" @click="enqueueRequest">登记排队请求</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="pageState"
      :trace-id="pageTraceId"
      empty-title="对象不存在或已被清理"
      empty-desc="按链接标识未命中：可能已被卸载、清理或标识有误；请从列表重新进入。"
      what="页面数据加载失败"
      why="该页依赖的索引 / 配置读取失败（不影响其它模块与已加载数据）。"
      how="可重试；持续失败请导出诊断包并附 traceId 便于定位。"
      @retry="reloadPage"
    >


    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">sampling 策略（请求我方模型采样）</h3>
        <RadioGroup v-model="samplingPolicy" style="margin-bottom: 8px">
          <RadioButton value="ask-always">每次询问</RadioButton>
          <RadioButton value="ask-once">询问一次后按会话记忆</RadioButton>
          <RadioButton value="preauth">无人值守按预授权边界</RadioButton>
          <RadioButton value="deny">全部拒绝</RadioButton>
        </RadioGroup>
        <Alert
          theme="warning"
          message="sampling 视为模型调用：计量与预算约束"
          :description="`当前策略：${samplingPolicy === 'ask-once' ? '首次询问，同意后本会话内同类请求直接放行（可随时撤销）' : samplingPolicy === 'preauth' ? '按会话预授权边界放行，超出即排队' : '按所选策略执行'}；预算计入会话总额。`"
        />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">elicitation 策略（请求用户输入）</h3>
        <RadioGroup v-model="elicitationPolicy" style="margin-bottom: 8px">
          <RadioButton value="require-user">需用户在场</RadioButton>
          <RadioButton value="queue">无人值守排队并通知</RadioButton>
          <RadioButton value="deny">拒绝（服务器应降级）</RadioButton>
        </RadioGroup>
        <Alert
          theme="info"
          message="无人值守时的处理"
          :description="elicitationPolicy === 'require-user' ? '无界面形态下拒绝并告知服务器降级（不猜测用户输入）。' : '排队并在用户回来时提示；超时按拒绝处理（记录原因）。'"
        />
      </div>
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">
        反向请求记录
        <span class="oc-muted" style="font-size: 12px">sampling 附预算影响；elicitation 附交互要求</span>
      </h3>
      <div v-if="queue.length" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 8px; font-size: 12px">
        <Tag size="small" theme="warning" variant="light-outline">排队中 {{ queue.length }}</Tag>
        <span v-for="q in queue" :key="q.id" class="oc-muted oc-mono">{{ q.at }} · {{ q.source }}</span>
      </div>
      <Table row-key="id" size="small" :data="rows" :columns="columns">
        <template #type="{ row }">
          <Tag size="small" :theme="row.type === 'sampling' ? 'warning' : 'primary'" variant="light-outline">{{ row.type }}</Tag>
        </template>
        <template #server="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.server }}</span></template>
        <template #budget="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.budgetImpact }}</span></template>
        <template #decision="{ row }">
          <Tag size="small" :theme="row.userDecision === 'allowed' ? 'success' : row.userDecision === 'denied' ? 'danger' : 'warning'" variant="light-outline">
            {{ row.userDecision }}
          </Tag>
        </template>
        <template #ops="{ row }">
          <Button size="small" variant="text" @click="open(row)">查看 / 决策</Button>
        </template>
      </Table>
    </div>

    <Dialog v-model:visible="detailOpen" header="反向请求决策（消耗预算需显式同意）" width="620px" :footer="false">
      <template v-if="picked">
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'type', label: '类型', value: picked.type },
            { key: 'server', label: '来源服务器', value: picked.server, mono: true },
            { key: 'detail', label: '请求内容', value: picked.detail },
            { key: 'budget', label: '预算影响', value: picked.budgetImpact },
            { key: 'at', label: '时间', value: new Date(picked.at).toLocaleString('zh-CN') },
          ]"
        />
        <Alert
          style="margin-top: 10px"
          :theme="picked.type === 'sampling' ? 'warning' : 'info'"
          :message="picked.type === 'sampling' ? '该请求会消耗会话预算并计入计量' : '该请求需要你的输入才能继续（服务器等待中）'"
          description="拒绝不会导致任务失败：服务器将收到标准错误并按自身降级策略处理；拒绝原因写入审计。"
        />
        <div style="margin-top: 10px">
          <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">决策理由（可选，拒绝时建议填写）</div>
          <Textarea v-model="reason" :autosize="{ minRows: 2 }" placeholder="例如：采样任务与当前会话无关，建议服务器自行完成" />
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 12px">
          <Button size="small" theme="primary" @click="decide('allowed')">允许本次</Button>
          <Button size="small" variant="outline" @click="decide('allowed')">允许并记住（本会话）</Button>
          <Button size="small" variant="outline" @click="decide('queued')">排队（无人值守）</Button>
          <Button size="small" theme="danger" variant="outline" @click="decide('denied')">拒绝</Button>
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 10px">
          <OcIcon name="history" size="13px" />
          <CopyableId id="evt-mcp-reverse-4f21" label="mcp.reverse.request" :short="22" />
        </div>
      </template>
    </Dialog>
    </StateShell>
  </div>
</template>
