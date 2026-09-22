<script setup lang="ts">
/**
 * 漏洞管理（G3-05）：生命周期 + SLA 倒计时（24h/7d/30d/90d）+ 私密报告入口。
 * 溯源：卷 30 §4.5 / D-SEC-8
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, InputNumber, MessagePlugin, Option, Popconfirm, Progress, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { VulnRecord } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 漏洞清单以响应式代理渲染：登记 / 私密报告后表格行与统计卡需立即更新 */
const vulns = ref(d.vulns);
const stageFilter = ref('all');
const stages = ['接收', '分级', '缓解', '修复', '公告', '复盘'];
const filtered = computed(() => vulns.value.filter((v) => stageFilter.value === 'all' || v.stage === stageFilter.value));
const atRisk = computed(() => vulns.value.filter((v) => v.remainingHours <= 24 && !v.announced));
const slaTheme: Record<string, 'danger' | 'warning' | 'primary' | 'default'> = { 严重: 'danger', 高: 'warning', 中: 'primary', 低: 'default' };
/** 严重度 → SLA（h）：严重 24h / 高 7d / 中 30d / 低 90d */
const SLA_HOURS: Record<string, number> = { 严重: 24, 高: 168, 中: 720, 低: 2160 };
/** 私密报告 / 登记漏洞使用：组件候选与报告序号 */
const COMPONENTS = ['kernel/model-gateway', 'web/console', 'dependency/axios', 'plugin/sdk', 'sandbox/runtime'];
const privateSeq = ref(0);

const registerOpen = ref(false);
const registerForm = ref({ title: '', component: COMPONENTS[0], severity: '高', owner: '', cvss: 7.5 });

/** 提交私密报告：启动确认回执 SLA 并登记为「接收」阶段（分级前不公开细节，可撤回） */
function submitPrivateReport() {
  privateSeq.value += 1;
  const record: VulnRecord = {
    id: `vul-priv-${9000 + privateSeq.value}`,
    cve: '私密报告（未分配 CVE）',
    title: '（私密报告）依赖链疑似被投毒（外部报告者提交，待分级）',
    severity: '中',
    cvss: 0,
    component: COMPONENTS[0],
    stage: '接收',
    slaHours: 48,
    elapsedHours: 0,
    remainingHours: 48,
    owner: '安全值班 柏一川',
    mitigation: '未缓解（待分级）',
    fixVersion: '待定',
    announced: false,
    privateReport: true,
    note: 'PGP 加密提交（公钥指纹 9F2A 1C04…）；确认回执 ≤ 24h、分级结论 ≤ 48h，修复前不与公众披露细节',
  };
  vulns.value.unshift(record);
  // 清空阶段筛选，保证新记录在列表中可见（阶段为「接收」）
  stageFilter.value = 'all';
  MessagePlugin.success(`已提交私密报告 ${record.id}：进入「接收」阶段（确认回执 ≤ 24h、分级 ≤ 48h），在跟踪漏洞 ${vulns.value.length} 个；报告细节仅安全团队可见，分级前可撤回`);
}

function openRegister() {
  registerForm.value = { title: '', component: COMPONENTS[0], severity: '高', owner: '', cvss: 7.5 };
  registerOpen.value = true;
}

/** 登记漏洞：插入列表顶部并按严重度启动 SLA 倒计时（超时自动升级） */
function registerVuln() {
  const f = registerForm.value;
  const title = f.title.trim();
  const owner = f.owner.trim();
  if (!title) {
    MessagePlugin.warning('请先填写漏洞标题：用于分级与追溯');
    return;
  }
  if (!owner) {
    MessagePlugin.warning('请先填写负责人：SLA 到期需有人跟进并升级');
    return;
  }
  const slaHours = SLA_HOURS[f.severity] ?? 720;
  const record: VulnRecord = {
    id: `vul-${3000 + vulns.value.length}`,
    cve: `CVE-2026-${Math.floor(40000 + Math.random() * 9999)}`,
    title,
    severity: f.severity,
    cvss: f.cvss,
    component: f.component,
    stage: '接收',
    slaHours,
    elapsedHours: 0,
    remainingHours: slaHours,
    owner,
    mitigation: '未缓解（评估中）',
    fixVersion: '待定',
    announced: false,
    privateReport: false,
    note: `控制台登记（${new Date().toLocaleString('zh-CN')}）；SLA ${slaHours}h 倒计时已启动`,
  };
  vulns.value.unshift(record);
  // 清空阶段筛选，保证新登记记录在列表中可见（阶段为「接收」）
  stageFilter.value = 'all';
  registerOpen.value = false;
  MessagePlugin.success(`已登记漏洞「${title}」（${f.severity}，CVSS ${f.cvss}，负责人 ${owner}）：进入「接收」阶段并启动 SLA ${slaHours}h 倒计时，超时自动升级；可补充缓解措施后进入分级`);
}

onMounted(() => {
  setTimeout(() => { state.value = d.vulns.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="漏洞管理"
      desc="生命周期六阶段（接收→分级→缓解→修复→公告→复盘）与分级 SLA：严重 24h 缓解 / 高 7 天 / 中 30 天 / 低 90 天；提供私密报告入口。"
      volume="卷 30"
      manifest="G3-05"
      cli="oc vuln list --with-sla --json"
      :status="[{ label: '私密报告（PGP）', theme: 'default' }, { label: 'SLA 超时即升级', theme: 'warning' }]"
    >
      <template #actions>
        <Popconfirm theme="danger" :confirm-btn="{ content: '提交私密报告', theme: 'danger' }" cancel-btn="取消" @confirm="submitPrivateReport">
          <template #content>
            <div style="max-width: 320px">
              <div>作用对象：以 PGP 加密通道提交一份外部漏洞线索（组件 kernel/model-gateway）。</div>
              <div>影响：立即进入「接收」阶段并通告安全团队（确认回执 ≤ 24h、分级 ≤ 48h），报告细节不与公众披露。</div>
              <div>是否可撤销：分级前可撤回（撤回后记录标注为已撤回）。</div>
            </div>
          </template>
          <Button size="small" variant="outline">私密报告入口</Button>
        </Popconfirm>
        <Button size="small" theme="primary" @click="openRegister">登记漏洞</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="暂无漏洞记录"
      empty-desc="无记录不代表无漏洞；请确认扫描器与情报源已接入（VulnFeedSPI）。"
      empty-action="接入漏洞情报源"
      example-task="oc vuln report --private --pgp --component kernel/model-gateway"
      what="漏洞列表加载失败"
      why="漏洞情报源不可达或私密报告通道（PGP）密钥缺失"
      how="可重试；情报源不可用时按「未知风险」保守处理（不允许因此跳过发布门禁）"
      trace-id="trace-vuln-3c81a2"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="在跟踪漏洞" :value="vulns.length" unit="个" icon="bug" />
        <StatCard label="SLA 风险（≤24h）" :value="atRisk.length" unit="个" :target="0" target-kind="max" icon="time" />
        <StatCard label="严重级" :value="vulns.filter((v) => v.severity === '严重').length" unit="个" :target="0" target-kind="max" icon="error" hint="严重：24h 内缓解" />
        <StatCard label="已公告" :value="vulns.filter((v) => v.announced).length" unit="个" hint="公告与修复同步（含 CVE）" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex oc-flex--wrap" style="gap: 4px">
          <Tag size="small" :theme="stageFilter === 'all' ? 'primary' : 'default'" variant="light-outline" style="cursor: pointer" @click="stageFilter = 'all'">全部阶段</Tag>
          <Tag v-for="s in stages" :key="s" size="small" :theme="stageFilter === s ? 'primary' : 'default'" variant="light-outline" style="cursor: pointer" @click="stageFilter = s">{{ s }}</Tag>
        </div>
        <Table :data="filtered" row-key="id" size="small" style="margin-top: 8px">
          <template #cve="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span class="oc-mono" style="font-size: 11px">{{ row.cve }}</span>
              <Tag size="small" :theme="slaTheme[row.severity]" variant="light-outline">{{ row.severity }} {{ row.cvss }}</Tag>
            </div>
          </template>
          <template #title="{ row }">{{ row.title }}</template>
          <template #stage="{ row }"><Tag size="small" variant="outline">{{ row.stage }}</Tag></template>
          <template #remainingHours="{ row }">
            <div style="min-width: 140px">
              <Progress
                :percentage="Math.max(0, Math.min(100, Math.round((row.remainingHours / row.slaHours) * 100)))"
                :status="row.remainingHours === 0 ? 'error' : row.remainingHours <= 24 ? 'warning' : 'success'"
                :label="false"
                size="small"
              />
              <span class="oc-muted" style="font-size: 11px">
                {{ row.remainingHours === 0 ? 'SLA 已超时' : `剩余 ${row.remainingHours}h / ${row.slaHours}h` }}
              </span>
            </div>
          </template>
          <template #mitigation="{ row }">
            <Tooltip :content="`修复版本：${row.fixVersion} · 负责人：${row.owner}`"><span class="oc-clamp-2" style="font-size: 12px">{{ row.mitigation }}</span></Tooltip>
          </template>
        </Table>
        <div v-for="v in atRisk" :key="v.id" class="oc-state__hint" style="margin-top: 4px">
          风险 {{ v.cve }}：{{ v.note ?? `剩余 ${v.remainingHours}h，已按流程升级` }}
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">SLA 与阶段时限（严重级）</div>
          <Table
            :data="[
              { stage: '接收', action: '私密报告通道（邮件/PGP）+ 确认回执', limit: '≤ 24h' },
              { stage: '分级', action: 'CVSS + 影响面（是否可远程、是否需交互）', limit: '≤ 48h' },
              { stage: '缓解', action: '临时对策（配置/策略/禁用开关）+ 用户通告', limit: '≤ 24h（缓解）' },
              { stage: '修复', action: '补丁 + 回归 + 红队复测', limit: '7d / 30d / 90d' },
              { stage: '公告', action: '安全公告（影响版本/缓解/修复）+ CVE', limit: '与修复同步' },
              { stage: '复盘', action: '根因 + 改进项（进入反馈闭环）', limit: '≤ 14d' },
            ]"
            row-key="stage"
            size="small"
            :columns="[
              { colKey: 'stage', title: '阶段', width: 90 },
              { colKey: 'action', title: '动作' },
              { colKey: 'limit', title: '时限', width: 140 },
            ]"
          />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">私密报告入口</div>
          <div class="oc-stack">
            <div class="oc-muted" style="font-size: 12px">① 邮箱：security@yunshu.example.com（PGP 公钥指纹 9F2A 1C04 …）。</div>
            <div class="oc-muted" style="font-size: 12px">② 确认回执 ≤ 24h；分级结论 ≤ 48h；修复前不与公众披露细节。</div>
            <div class="oc-muted" style="font-size: 12px">③ 报告者可在公告中致谢（可选匿名）；不接受无复现步骤的提交。</div>
          </div>
          <CopyableId id="trace-vuln-pgp-0912" label="复制 PGP 指纹" />
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="registerOpen" header="登记漏洞" width="580px" :confirm-btn="{ content: '登记并启动 SLA', theme: 'primary' }" cancel-btn="取消" @confirm="registerVuln">
      <div class="oc-stack">
        <Input v-model="registerForm.title" size="small" placeholder="漏洞标题（必填，如 路径穿越读取任意文件）" />
        <Select v-model="registerForm.component" size="small" aria-label="受影响组件">
          <Option v-for="c in COMPONENTS" :key="c" :value="c" :label="c" />
        </Select>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Select v-model="registerForm.severity" size="small" style="width: 140px" aria-label="严重度">
            <Option v-for="s in ['严重', '高', '中', '低']" :key="s" :value="s" :label="`严重度 ${s}（SLA ${SLA_HOURS[s]}h）`" />
          </Select>
          <InputNumber v-model="registerForm.cvss" :min="0" :max="10" :step="0.1" size="small" style="width: 140px" />
          <Input v-model="registerForm.owner" size="small" style="width: 180px" placeholder="负责人（必填）" />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          登记后进入「接收」阶段并启动 SLA 倒计时（严重 24h / 高 7d / 中 30d / 低 90d）；超时自动升级。
        </div>
      </div>
    </Dialog>
  </div>
</template>
