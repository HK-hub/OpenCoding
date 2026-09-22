<script setup lang="ts">
/**
 * 隐私工程（G3-09）：最小化 / 目的限制 / PII / 可导出可删除 / 跨境 / 遥测本地预览。
 * 溯源：卷 30 D-SEC-10 / §4.1
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const piiKinds = [
  { kind: '身份证号', handling: '识别 + 脱敏（保留前 3 后 4）或拒绝', storage: '加密存储 + 访问审计', enabled: true },
  { kind: '银行卡 / 支付凭证', handling: '识别 + 阻断出站（DLP）', storage: '不落库（仅引用）', enabled: true },
  { kind: '手机号', handling: '识别 + 脱敏（前 3 后 4）', storage: '加密 + 访问审计', enabled: true },
  { kind: '邮箱 / 姓名', handling: '识别 + 按目的限制使用', storage: '常规加密', enabled: true },
  { kind: '生物特征', handling: '默认拒绝采集（最小化）', storage: '—', enabled: false },
];
const telemetryOff = computed(() => d.telemetryConsent.filter((t) => !t.enabled));
/** 数据主体权利以响应式代理渲染：发起删除请求后「可删除」状态需立即更新 */
const rights = ref([
  { right: '可导出', landing: '迁出中心（五类包）+ 审计/计量 CSV/Parquet', evidence: '导出记录 + 校验和', status: '已实现' },
  { right: '可删除', landing: '合规删除（穿透备份）+ 删除证明导出', evidence: '删除证明（含备份穿透）', status: '已实现' },
  { right: '目的限制', landing: '用途声明 + 目的绑定（遥测载荷白名单）', evidence: '遥测本地预览 + 禁止项硬校验', status: '已实现' },
  { right: '最小化', landing: '默认不采集；采样率可配；内容类字段硬禁止', evidence: '禁止项清单 + 拦截记录', status: '已实现' },
  { right: '跨境管控', landing: '跨境清单 + 审批 + 默认拒绝（A1）', evidence: '审批记录 + 驻留策略', status: '已实现' },
]);
/** 删除请求记录：发起后进入本页清单（穿透备份删除不可撤销） */
const deletionRequests = ref<{ at: string; subject: string; scope: string; status: string; dueAt: string }[]>([]);

/** 导出数据处理清单：仅含策略与字段名（遥测载荷明细只导出字段名，不含值），可安全外发 */
function exportInventory() {
  const file = downloadJson({
    pii: piiKinds.map((k) => ({ kind: k.kind, handling: k.handling, storage: k.storage, enabled: k.enabled })),
    rights: rights.value.map((r) => ({ right: r.right, landing: r.landing, evidence: r.evidence, status: r.status })),
    telemetry: d.telemetryConsent.map((t) => ({ level: t.level, enabled: t.enabled, defaultOff: t.defaultOff, samplingRatePct: t.samplingRatePct, forbidden: t.forbidden })),
    telemetryPreview: d.telemetryPreview.slice(0, 8).map((p) => ({ id: p.id, level: p.level, kind: p.kind, fieldNames: Object.keys(p.fields), containsContent: p.containsContent, redacted: p.redacted })),
    redaction: '遥测明细只导出字段名（不导出值与内容）；PII 策略不含任何样例明文；清单自页面当前数据生成',
  }, `oc-privacy-data-inventory-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success('已生成 ' + file);
}

/** 发起删除请求：合规删除穿透备份（不可撤销），完成后仅保留删除证明并回写权利状态 */
function requestDeletion() {
  const req = {
    at: new Date().toISOString(),
    subject: '本租户全部数据主体（云枢科技）',
    scope: '会话 / 任务 / 知识 / 遥测载荷 + 备份副本（穿透）',
    status: '已受理（执行中）',
    dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  };
  deletionRequests.value.unshift(req);
  const row = rights.value.find((r) => r.right === '可删除');
  if (row) row.status = '请求已受理';
  MessagePlugin.success(`已发起删除请求：对象「${req.subject}」，范围 ${req.scope}；穿透备份删除不可撤销，预计 ${req.dueAt} 前完成，完成后仅保留删除证明（可导出核验）`);
}

onMounted(() => {
  setTimeout(() => { state.value = piiKinds.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="隐私工程"
      desc="隐私默认：数据最小化（默认不采集）、目的限制（用途声明）、PII 识别与脱敏、可导出可删除、跨境清单与放行、遥测本地预览。"
      volume="卷 30"
      manifest="G3-09"
      cli="oc privacy posture --with-pii --with-telemetry-preview"
      :status="[{ label: '遥测默认全关', theme: 'success' }, { label: '内容类字段硬禁止', theme: 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportInventory">导出数据处理清单</Button>
        <Popconfirm theme="danger" :confirm-btn="{ content: '发起删除请求', theme: 'danger' }" cancel-btn="取消" @confirm="requestDeletion">
          <template #content>
            <div style="max-width: 320px">
              <div>作用对象：本租户全部数据主体的会话 / 任务 / 知识 / 遥测载荷与备份副本。</div>
              <div>影响：合规删除穿透备份，业务数据不可再读取；仅保留删除证明与审计记录。</div>
              <div>是否可撤销：不可撤销（可按删除证明核验执行结果）。</div>
            </div>
          </template>
          <Button size="small" theme="primary">发起删除请求</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="隐私配置未初始化"
      empty-desc="未声明 PII 处理策略时无法通过合规评审；请至少设置 PII 识别与遥测同意。"
      empty-action="应用隐私默认基线"
      example-task="在本地预览最近 12 条遥测载荷，确认无内容字段后保持关闭"
      what="隐私状态加载失败"
      why="遥测账单/同意记录读取失败（多租户载荷隔离校验未通过）"
      how="可重试；读取失败时遥测保持「关闭」（失败安全，不误采集）"
      trace-id="trace-privacy-77a1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="PII 类别" :value="piiKinds.length" unit="类" icon="lock" />
        <StatCard label="遥测关闭级别" :value="telemetryOff.length" unit="级" :target="3" target-kind="min" hint="三级独立同意，默认全关" />
        <StatCard label="跨境待处理" :value="d.residency.crossBorderRequests.filter((r) => r.status === 'PENDING').length" unit="条" icon="cloud" />
        <StatCard label="删除证明" :value="'可导出'" format="raw" icon="check" hint="删除穿透备份并生成证明" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">PII 识别与处理</div>
          <Table :data="piiKinds" row-key="kind" size="small">
            <template #kind="{ row }"><b style="font-size: 12px">{{ row.kind }}</b></template>
            <template #enabled="{ row }">
              <Tag size="small" :theme="row.enabled ? 'success' : 'default'" variant="light-outline">{{ row.enabled ? '已启用' : '默认拒绝' }}</Tag>
            </template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            最小化：生物特征等高风险类别默认不采集；确需采集须走隐私影响评估（PIA）。
          </div>
          <CopyableId id="trace-privacy-0912" label="复制 traceId" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">数据主体权利（可导出 / 可删除）</div>
          <Table :data="rights" row-key="right" size="small" :columns="[
            { colKey: 'right', title: '权利', width: 100 },
            { colKey: 'landing', title: '设计落点' },
            { colKey: 'status', title: '状态', width: 110 },
          ]">
            <template #status="{ row }"><Tag size="small" theme="success" variant="light-outline">{{ row.status }}</Tag></template>
          </Table>
          <div v-if="deletionRequests.length" class="oc-card" style="box-shadow: none; margin-top: 6px">
            <div class="oc-card__title" style="font-size: 13px">删除请求（穿透备份，不可撤销）</div>
            <div v-for="r in deletionRequests" :key="r.at" class="oc-muted" style="font-size: 12px">
              {{ new Date(r.at).toLocaleString('zh-CN') }} · {{ r.subject }} · {{ r.scope }} · 状态 {{ r.status }} · 预计完成 {{ r.dueAt }}
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">遥测本地预览（默认关闭，开启后可一键清除）</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
          <Tag v-for="t in d.telemetryConsent" :key="t.level" size="small" :theme="t.enabled ? 'warning' : 'success'" variant="light-outline">
            {{ t.level }}：{{ t.enabled ? '已开启' : '关闭' }}
          </Tag>
          <Tag size="small" variant="outline">禁止项：{{ d.telemetryConsent[0].forbidden.join(' / ') }}</Tag>
        </div>
        <Table :data="d.telemetryPreview.slice(0, 8)" row-key="id" size="small">
          <template #level="{ row }"><Tag size="small" variant="outline">{{ row.level }}</Tag></template>
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #fields="{ row }">
            <span class="oc-mono" style="font-size: 11px">{{ Object.entries(row.fields).map(([k, v]) => `${k}=${v}`).join(' · ') }}</span>
          </template>
          <template #containsContent="{ row }">
            <Tag size="small" :theme="row.containsContent ? 'danger' : 'success'" variant="light-outline">{{ row.containsContent ? '含内容（已拦截）' : '不含内容' }}</Tag>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
