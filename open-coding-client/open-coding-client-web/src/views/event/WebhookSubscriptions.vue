<script setup lang="ts">
/**
 * V-06 Webhook 订阅管理。
 * 事件过滤 + HMAC 签名（密钥引用，明文永不回显）+ 重试（退避，上限可配）+ 死信 + 投递记录。
 * 溯源：卷 16 §4.5/D-EVT-11；BUILD-MANIFEST V-06。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Option, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { WebhookSubscription } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const activeId = ref(platformData.eventJobs.webhookSubscriptions[0].id);
const filter = ref('');
const testOpen = ref(false);

const subs = computed(() => platformData.eventJobs.webhookSubscriptions);
const rows = computed(() => subs.value.filter((s) => (filter.value ? s.status === filter.value : true)));
const active = computed(() => subs.value.find((s) => s.id === activeId.value) ?? subs.value[0]);
const deadTotal = computed(() => subs.value.reduce((a, s) => a + s.deadLetterCount, 0));

const columns = [
  { colKey: 'name', title: '订阅名', width: 220, cell: 'name' },
  { colKey: 'url', title: '投递地址', ellipsis: true },
  { colKey: 'eventFilter', title: '事件过滤', width: 220, cell: 'filter' },
  { colKey: 'signature', title: '签名', width: 130 },
  { colKey: 'maxRetries', title: '最大重试', width: 96 },
  { colKey: 'status', title: '状态', width: 100, cell: 'status' },
  { colKey: 'deadLetterCount', title: '死信', width: 80, cell: 'dl' },
];

const deliveryColumns = [
  { colKey: 'at', title: '投递时间', width: 180 },
  { colKey: 'attempt', title: '第 N 次', width: 90, cell: 'attempt' },
  { colKey: 'statusCode', title: 'HTTP 状态', width: 110, cell: 'code' },
  { colKey: 'durationMs', title: '耗时', width: 100 },
  { colKey: 'result', title: '结果', width: 140, cell: 'result' },
];

const STATUS_THEME: Record<string, 'success' | 'warning' | 'default'> = { enabled: 'success', degraded: 'warning', disabled: 'default' };
const RESULT_THEME: Record<string, 'success' | 'warning' | 'danger'> = { succeeded: 'success', retrying: 'warning', dead_letter: 'danger' };

function sendTest() {
  MessagePlugin.success(`已发送测试投递（签名 ${active.value.signature}，密钥引用 ${active.value.secretRef}）`);
  testOpen.value = false;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = subs.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Webhook 订阅"
      desc="外部集成出口：按事件类型过滤、HMAC 签名（密钥经引用注入，明文不落库不入日志）、失败重试与死信兜底。"
      volume="卷 16" manifest="V-06" cli="oc event webhook list --show-deliveries"
      :status="[{ label: `${subs.length} 个订阅`, theme: 'default' }, { label: deadTotal ? `死信 ${deadTotal}` : '无死信', theme: deadTotal ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="filter" size="small" style="width: 130px" clearable placeholder="按状态" aria-label="状态过滤">
          <Option value="" label="全部状态" />
          <Option value="enabled" label="enabled" />
          <Option value="degraded" label="degraded" />
          <Option value="disabled" label="disabled" />
        </Select>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--3">
      <StatCard label="投递成功率（24h）" :value="99.2" format="percent" icon="check" hint="含重试后最终成功" />
      <StatCard label="重试中投递" :value="subs.reduce((a, s) => a + s.deliveries.filter((d) => d.result === 'retrying').length, 0)" icon="refresh" hint="指数退避；上限由订阅配置" />
      <StatCard label="死信" :value="deadTotal" icon="mail" :hint="deadTotal ? '需人工重放或修正接收端' : '无死信'" />
    </div>

    <StateShell
      :state="demo" stage="正在读取订阅与投递记录…"
      empty-title="没有 Webhook 订阅" empty-desc="尚未配置外部集成出口；事件仍可由内部消费者与批量导出使用。"
      empty-action="新增订阅（事件过滤 + 签名密钥引用）" example-task="把 sec.* 与 audit.* 投递到企业 SIEM"
      what="订阅列表读取失败" why="签名密钥引用解析失败（KMS 暂不可达），无法验证订阅完整性"
      how="重试；密钥不可用时禁止新增/修改订阅（Fail-Fast）" trace-id="trace-f63a0b71"
      @retry="demo = 'NORMAL'" @empty-action="filter = ''"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #name="{ row }">
          <Button size="small" variant="text" @click="activeId = row.id as string">{{ row.name }}</Button>
        </template>
        <template #filter="{ row }">
          <span class="oc-mono oc-truncate">{{ (row.eventFilter as string[]).join(', ') }}</span>
        </template>
        <template #status="{ row }">
          <Tag :theme="STATUS_THEME[row.status as string] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #dl="{ row }">
          <Tag v-if="row.deadLetterCount" theme="danger" size="small" variant="light-outline">{{ row.deadLetterCount }}</Tag>
          <span v-else class="oc-muted">0</span>
        </template>
      </Table>
    </StateShell>

    <div v-if="active" class="oc-card">
      <h3 class="oc-card__title">
        订阅详情：{{ active.name }}
        <span class="oc-flex" style="gap: 6px">
          <CliHint :command="`oc event webhook test --id ${active.id}`" label="测试投递" />
          <Button size="small" variant="outline" @click="testOpen = true">发送测试投递</Button>
        </span>
      </h3>
      <div class="oc-grid oc-grid--2">
        <InfoGrid :columns="1" :items="[
          { key: 'url', label: '投递地址', value: active.url, mono: true },
          { key: 'sig', label: '签名算法', value: active.signature },
          { key: 'secret', label: '签名密钥', value: active.secretRef, secretRef: true },
          { key: 'retry', label: '重试策略', value: `最多 ${active.maxRetries} 次，指数退避；超限进入死信` },
          { key: 'filter', label: '事件过滤', value: active.eventFilter.join('、'), mono: true },
          { key: 'status', label: '状态', value: active.status, tag: { text: active.status, theme: STATUS_THEME[active.status] } },
        ]" />
        <div>
          <h4 class="oc-card__title">投递记录（最近）</h4>
          <Table :data="active.deliveries" :columns="deliveryColumns" row-key="at" size="small" :pagination="undefined">
            <template #attempt="{ row }">第 {{ row.attempt }} 次</template>
            <template #code="{ row }">
              <span :style="{ color: row.statusCode >= 400 || row.statusCode === 0 ? 'var(--oc-sev-error)' : undefined }">
                {{ row.statusCode === 0 ? '连接失败' : row.statusCode }}
              </span>
            </template>
            <template #result="{ row }">
              <Tag :theme="RESULT_THEME[row.result as string] ?? 'default'" size="small" variant="light-outline">{{ row.result }}</Tag>
            </template>
          </Table>
        </div>
      </div>
      <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
        <Tag v-if="active.deadLetterCount" theme="warning" variant="light-outline" size="small">
          {{ active.deadLetterCount }} 条投递进入死信：接收端连续 5xx，可在死信队列重放
        </Tag>
        <Switch size="small" :value="active.status === 'enabled'" disabled>启用（演示为只读）</Switch>
        <CopyableId :id="active.id" label="复制订阅 ID" />
      </div>
    </div>

    <Dialog v-model:visible="testOpen" header="发送测试投递" width="560px" :confirm-btn="{ content: '发送', theme: 'primary' }" cancel-btn="取消" @confirm="sendTest">
      <div v-if="active" class="oc-stack">
        <span style="font-size: 13px">
          将向 <span class="oc-mono">{{ active.url }}</span> 投递一条 <span class="oc-mono">system.test.ping</span> 事件，
          使用 {{ active.signature }} 签名（密钥经 {{ active.secretRef }} 引用注入，明文永不回显）。
        </span>
        <Tag theme="primary" variant="light-outline" size="small">测试投递计入投递记录，失败同样进入重试与死信</Tag>
      </div>
    </Dialog>
  </div>
</template>
