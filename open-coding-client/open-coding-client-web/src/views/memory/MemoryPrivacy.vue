<script setup lang="ts">
/**
 * E-09 隐私与脱敏：PII 四类开关 + 脱敏或拒绝 + 加密存储 + 访问审计。
 * 写入前检测：脱敏类替换掩码入库；拒绝类直接丢弃并留事件；敏感级条目加密存储（卷 10 D-MEM-7）。
 * 溯源：卷 10 D-MEM-7 / BUILD-MANIFEST E-09
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import { downloadCsv, downloadJson } from '@/utils/download';

const ui = useUiStore();
const data = knowledgeData.memory;
const pii = ref(data.privacy.piiTypes.map((p) => ({ ...p })));

const state = ref<UiStateKind>('LOADING');
const auditKeyword = ref('');

const auditRows = computed(() =>
  data.privacy.auditLog.filter((a) => !auditKeyword.value || `${a.actor}${a.target}${a.action}`.includes(auditKeyword.value)),
);
const rejected = computed(() => data.privacy.auditLog.filter((a) => a.result === '拒绝').length);
const masked = computed(() => data.privacy.auditLog.filter((a) => a.result === '脱敏返回').length);

/** 脱敏预览：写入前 / 写入后（手机号保留前 3 后 4） */
const maskDiff = computed<DiffFile[]>(() => [
  {
    path: '写入前 → 写入后（脱敏示例）',
    additions: 2,
    deletions: 2,
    lines: [
      { type: 'ctx', oldLine: 1, newLine: 1, text: 'key: contact:oncall' },
      { type: 'del', oldLine: 2, text: 'value: 值班联系 13812345678，邮箱 ops@yunshu.dev' },
      { type: 'add', newLine: 2, text: 'value: 值班联系 138****5678，邮箱 o**@yunshu.dev' },
      { type: 'del', oldLine: 3, text: 'value: 身份证 310101199001011234 / 令牌 sk-live-9f31ac' },
      { type: 'add', newLine: 3, text: '写入被拒绝（证件与密钥类命中「拒绝写入」策略，事件已留痕）' },
    ],
  },
]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function toggle(type: string, enabled: boolean) {
  const item = pii.value.find((p) => p.type === type);
  if (item) item.enabled = enabled;
  MessagePlugin.success(`已${enabled ? '开启' : '关闭'}「${type}」检测（写入前链路，立即生效）`);
}

/** 导出隐私策略（不含任何 PII 明文）：内容取自本页 PII 开关状态与策略配置 */
function exportPolicy() {
  const filename = `oc-memory-privacy-policy-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson({ piiTypes: pii.value, policy: data.privacy.policy, encrypted: data.privacy.encrypted }, filename);
  MessagePlugin.success(`已导出隐私策略（${filename}）`);
}

/** 导出访问审计（CSV）：数据取自本页当前过滤结果 auditRows，字段与表格列一致 */
function exportAudit() {
  const filename = `oc-memory-privacy-audit-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
  const rows = auditRows.value.map((a) => [new Date(a.at).toLocaleString('zh-CN'), a.actor, a.target, a.action, a.result]);
  downloadCsv([['时间', '执行者', '目标', '动作', '结果'], ...rows], filename);
  MessagePlugin.success(`已导出审计记录（${filename}，${rows.length} 条）`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="隐私与脱敏"
      desc="四类 PII 在写入前检测：手机号/邮箱脱敏后入库，证件/密钥直接拒绝；敏感级条目加密存储，访问全程审计。"
      volume="卷 10"
      manifest="E-09"
      cli="oc memory privacy show --pii"
      :status="[{ label: data.privacy.encrypted ? '加密存储已开启' : '加密未开启', theme: data.privacy.encrypted ? 'success' : 'danger' }, { label: '写入前检测', theme: 'primary' }]"
    >
      <template #actions>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
        <Button size="small" variant="outline" @click="exportPolicy">导出策略</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="启用检测类型" :value="pii.filter((p) => p.enabled).length" unit="/ 4 类" format="raw" icon="lock" hint="关闭类型会显著提高违规风险，需安全负责人确认" />
      <StatCard label="拒绝写入" :value="rejected" unit="次" icon="close" :lower-is-better="true" hint="证件/密钥命中后丢弃并留事件（不可绕过）" />
      <StatCard label="脱敏返回" :value="masked" unit="次" icon="filter" hint="手机号保留前 3 后 4；邮箱本地部分掩码" />
      <StatCard label="加密覆盖" :value="data.entries.filter((e) => e.sensitivity === '敏感').length" unit="条" icon="secured" hint="敏感级条目 AES-GCM 加密，密钥经密钥代理" />
    </div>

    <StateShell
      :state="state"
      stage="加载隐私策略…"
      empty-title="尚未配置隐私策略"
      empty-desc="未配置时按最严格默认执行：证件与密钥拒绝写入，手机号与邮箱强制脱敏。"
      empty-action="使用推荐策略"
      example-task="开启「密钥」检测并验证写入被拒绝"
      what="隐私策略加载失败"
      why="策略服务不可达（PiiDetectorSPI 未装配或超时）。"
      how="可重试；失败期间写入链路保持「拒绝敏感类」的保守默认，不会写入未检测内容。"
      trace-id="trace-priv-3ac71f"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            PII 四类检测开关
            <span class="oc-muted" style="font-size: 12px">写入前链路；不可被 Agent 绕过</span>
          </h3>
          <Table
            :data="pii"
            :columns="[
              { colKey: 'type', title: '类型', width: 110 },
              { colKey: 'enabled', title: '检测开关', width: 130, cell: 'cell' },
              { colKey: 'action', title: '命中处置', width: 130, cell: 'cell' },
              { colKey: 'note', title: '说明', cell: 'cell' },
            ]"
            row-key="type"
            size="small"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'enabled'">
                <Switch :value="row.enabled" size="small" @change="(v) => toggle(row.type, Boolean(v))" />
              </template>
              <template v-else-if="col.colKey === 'action'">
                <Tag size="small" :theme="row.action === '拒绝写入' ? 'danger' : 'warning'" variant="light-outline">{{ row.action }}</Tag>
              </template>
              <template v-else-if="col.colKey === 'note'">
                <span style="font-size: 12px">
                  {{ row.type === '手机号' ? '保留前 3 后 4，中间替换为 ****' : null }}
                  {{ row.type === '邮箱' ? '本地部分首字母保留，域名保留' : null }}
                  {{ row.type === '证件' ? '身份证/护照等一律拒绝写入（不可脱敏后入库）' : null }}
                  {{ row.type === '密钥' ? 'AppSecret/Token/口令类一律拒绝并留事件' : null }}
                </span>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
          <div class="oc-divider" />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'policy', label: '当前策略', value: data.privacy.policy, block: true },
              { key: 'encrypted', label: '敏感级加密', value: data.privacy.encrypted ? '已开启（AES-GCM，密钥代理持有）' : '未开启', tag: { text: data.privacy.encrypted ? '已加密' : '未加密', theme: data.privacy.encrypted ? 'success' : 'danger' } },
            ]"
          />
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            脱敏预览（写入前 → 写入后）
            <Tag size="small" theme="warning" variant="light-outline">拒绝类不可脱敏放行</Tag>
          </h3>
          <DiffView :files="maskDiff" :collapse-over="30" />
          <div class="oc-flex" style="gap: 8px; margin-top: 10px">
            <OcIcon name="help" size="14px" />
            <span class="oc-secondary" style="font-size: 12px">
              为什么证件不能脱敏入库？脱敏后仍可被用于身份关联（准标识符），因此策略选择「拒绝」而非「掩码」。
            </span>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          访问审计
          <span class="oc-muted" style="font-size: 12px">谁、何时、访问了什么、结果如何（拒绝与脱敏均留痕）</span>
        </h3>
        <div class="oc-flex" style="margin-bottom: 8px; gap: 8px">
          <Select
            v-model="auditKeyword"
            size="small"
            style="width: 220px"
            clearable
            placeholder="按执行者/目标过滤"
            :options="[
              { label: '全部记录', value: '' },
              { label: '仅敏感级条目', value: '敏感' },
              { label: '仅 Agent 访问', value: 'Agent' },
              { label: '合规删除', value: '合规删除' },
            ]"
          />
          <Button size="small" variant="outline" @click="exportAudit">导出审计</Button>
        </div>
        <Table
          :data="auditRows"
          :columns="[
            { colKey: 'at', title: '时间', width: 180, cell: 'cell' },
            { colKey: 'actor', title: '执行者', width: 200 },
            { colKey: 'target', title: '目标', cell: 'cell' },
            { colKey: 'action', title: '动作', width: 120 },
            { colKey: 'result', title: '结果', width: 110, cell: 'cell' },
          ]"
          row-key="at"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'at'">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template v-else-if="col.colKey === 'result'">
              <Tag size="small" :theme="row.result === '允许' ? 'success' : row.result === '脱敏返回' ? 'warning' : 'danger'" variant="light-outline">
                {{ row.result }}
              </Tag>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
