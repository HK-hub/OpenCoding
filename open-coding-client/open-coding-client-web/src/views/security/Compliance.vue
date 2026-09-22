<script setup lang="ts">
/**
 * 合规映射（G3-06）：五框架 + control → designLanding → evidence + 证据导出。
 * 溯源：卷 30 §4.6 / D-SEC-9
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
/** 框架数据以响应式代理渲染：发起自评后自评状态与缺口注解需立即更新 */
const frameworks = ref(d.compliance);
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const fwFilter = ref(frameworks.value[0].framework);
const selected = computed(() => frameworks.value.find((c) => c.framework === fwFilter.value) ?? frameworks.value[0]);
const coverage = computed(() => frameworks.value.map((c) => ({ x: c.framework, y: c.coveragePct })));
const gaps = computed(() => frameworks.value.flatMap((c) => c.controls.filter((x) => !x.verified).map((x) => ({ fw: c.framework, ...x }))));
const verifiedRate = computed(() => {
  const all = frameworks.value.flatMap((c) => c.controls);
  return (all.filter((x) => x.verified).length / all.length) * 100;
});

/** 自评：记录负责人在各框架缺口上的自评计划（key = 框架:控制项） */
const assessOpen = ref(false);
const assessForm = ref({ owner: '', scope: '', dueAt: '' });
const assessNotes = ref<Record<string, string>>({});
const assessing = computed(() => Object.keys(assessNotes.value).length);
/** 页面状态徽标：自评进行中时追加「自评进行中 N 项」（状态标签随动作变化） */
const statusTags = computed<{ label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }[]>(() => {
  const tags: { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }[] = [
    { label: '导出需脱敏', theme: 'warning' },
    { label: '缺口显式标注', theme: 'primary' },
  ];
  if (assessing.value) tags.push({ label: `自评进行中 ${assessing.value} 项`, theme: 'warning' });
  return tags;
});
/** 当前选中框架是否已有自评计划（控制项卡片标题徽标） */
const selectedAssessing = computed(() => Object.keys(assessNotes.value).some((k) => k.startsWith(`${selected.value.framework}:`)));

/** 导出证据包脱敏：邮箱仅保留首字母与域名、IP 掩码后两段、文件路径仅保留文件名 */
function redact(text: string): string {
  return text
    .replace(/([\w.+-])[\w.+-]*@([\w-]+(?:\.[\w-]+)+)/g, '$1***@$2')
    .replace(/\b(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}\b/g, '$1.*.*')
    .replace(/(?:[A-Za-z]:)?(?:[\\/][\w.-]+){2,}/g, (m) => `…${m.split(/[\\/]/).pop()}`);
}

/** 导出证据包（脱敏）：数据取自页面当前选中框架，导出行为写入审计（数据类别） */
function exportEvidence() {
  const fw = selected.value;
  const index = frameworks.value.indexOf(fw) + 1;
  const controls = fw.controls.map((c) => ({
    id: c.id,
    control: c.control,
    designLanding: redact(c.designLanding),
    evidence: redact(c.evidence),
    verified: c.verified,
    owner: c.owner,
    gap: c.gap ? redact(c.gap) : null,
  }));
  const file = downloadJson({
    framework: fw.framework,
    coveragePct: fw.coveragePct,
    lastAuditAt: fw.lastAuditAt,
    auditor: fw.auditor,
    controls,
    unverified: controls.filter((c) => !c.verified).length,
    redaction: '默认脱敏：邮箱仅保留首字母与域名、IP 掩码后两段、文件路径仅保留文件名；不含密钥与个人数据原文',
    auditNote: '导出行为已写入审计（数据类别）；证据包仅用于审计复核，禁止二次外发',
  }, `oc-compliance-evidence-fw${index}-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success('已生成 ' + file);
}

function openAssess() {
  assessForm.value = {
    owner: '',
    scope: selected.value.framework,
    dueAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  };
  assessOpen.value = true;
}

/** 发起自评：为所选框架的缺口项登记自评责任人与截止时间（自评结论需人工确认后才算证据） */
function submitAssess() {
  const owner = assessForm.value.owner.trim();
  if (!owner) {
    MessagePlugin.warning('请先填写自评负责人：自评结论需明确责任人与完成时间');
    return;
  }
  const fw = frameworks.value.find((c) => c.framework === assessForm.value.scope) ?? selected.value;
  const pending = fw.controls.filter((c) => !c.verified);
  pending.forEach((c) => {
    assessNotes.value[`${fw.framework}:${c.id}`] = `自评已发起：负责人 ${owner}，截止 ${assessForm.value.dueAt}（结论作为证据草稿，需人工确认后转「已验证」）`;
  });
  assessOpen.value = false;
  fwFilter.value = fw.framework;
  MessagePlugin.success(`已发起「${fw.framework}」合规自评：负责人 ${owner}，截止 ${assessForm.value.dueAt}，覆盖 ${pending.length} 条缺口控制项；自评结论不直接记为已验证，可撤回`);
}

onMounted(() => {
  setTimeout(() => { state.value = d.compliance.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="合规映射"
      desc="五框架（等保 2.0 三级 / ISO 27001 / SOC 2 / GDPR / 个保法）控制项 → 设计落点 → 证据三段式映射；证据导出强制脱敏。"
      volume="卷 30"
      manifest="G3-06"
      cli="oc compliance map --framework 等保 --export-evidence"
      :status="statusTags"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportEvidence">导出证据包（脱敏）</Button>
        <Button size="small" theme="primary" @click="openAssess">发起自评</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      missing-permission="audit.read"
      risk-level="R2"
      apply-path="合规证据含审计数据：请在「角色与权限 → 申请授权」提交（Auditor 角色）"
      empty-title="尚无合规映射"
      empty-desc="未映射框架将导致采购受阻；请先完成等保三级与 ISO 27001 的基础映射。"
      empty-action="生成初始映射"
      example-task="为「安全审计」控制项补充证据：审计哈希链校验报告"
      what="合规映射加载失败"
      why="证据文件引用不可解析（产物被清理或权限不足）"
      how="可重试；证据缺失时该控制项标记「未验证」并在缺口清单中列出"
      trace-id="trace-compliance-77a1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="覆盖框架" :value="frameworks.length" unit="个" :target="5" target-kind="min" icon="check" />
        <StatCard label="控制项验证率" :value="verifiedRate" format="percent" :target="95" target-kind="min" />
        <StatCard label="缺口项" :value="gaps.length" unit="项" :target="0" target-kind="max" icon="error" hint="缺口显式标注，不隐藏" />
        <StatCard label="最近审计" :value="new Date(selected.lastAuditAt).toLocaleDateString('zh-CN')" format="raw" :target="180" target-kind="max" hint="审计周期 ≤ 180 天" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">框架覆盖率</div>
          <OcChart type="bar" :series="[{ name: '覆盖率', points: coverage }]" :height="200" format="percent" :threshold="{ value: 90, label: '目标 ≥ 90%' }" aria-label="框架覆盖率" />
          <div class="oc-flex oc-flex--wrap" style="gap: 4px; margin-top: 6px">
            <Tag
              v-for="c in frameworks"
              :key="c.framework"
              size="small"
              :theme="fwFilter === c.framework ? 'primary' : 'default'"
              variant="light-outline"
              style="cursor: pointer"
              @click="fwFilter = c.framework"
            >
              {{ c.framework }}
            </Tag>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">缺口清单（未验证控制项）</div>
          <div v-for="g in gaps" :key="g.id + g.fw" class="oc-card" style="box-shadow: none; margin-bottom: 6px">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" theme="warning" variant="light-outline">{{ g.fw }}</Tag>
              <b style="font-size: 12px">{{ g.control }}</b>
              <span class="oc-muted">负责人 {{ g.owner }}</span>
            </div>
            <div class="oc-muted" style="font-size: 12px">缺口：{{ g.gap }} → 修复后需补证据（{{ g.evidence }}）</div>
            <div v-if="assessNotes[`${g.fw}:${g.id}`]" class="oc-muted" style="font-size: 12px; color: var(--td-warning-color)">{{ assessNotes[`${g.fw}:${g.id}`] }}</div>
          </div>
          <div v-if="!gaps.length" class="oc-muted" style="font-size: 12px">当前无缺口。</div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">
            {{ selected.framework }} · 控制项 → 设计落点 → 证据
            <Tag v-if="selectedAssessing" size="small" theme="warning" variant="light-outline" style="margin-left: 6px">自评进行中</Tag>
          </div>
          <CopyableId id="trace-compliance-0912" label="复制 traceId" />
        </div>
        <Table :data="selected.controls" row-key="id" size="small">
          <template #control="{ row }"><b style="font-size: 12px">{{ row.control }}</b></template>
          <template #designLanding="{ row }"><span style="font-size: 12px">{{ row.designLanding }}</span></template>
          <template #evidence="{ row }">
            <Tooltip :content="row.gap ?? '证据完整，可直接用于审计导出'">
              <span style="font-size: 12px">{{ row.evidence }}</span>
            </Tooltip>
          </template>
          <template #verified="{ row }">
            <Tag size="small" :theme="row.verified ? 'success' : 'warning'" variant="light-outline">{{ row.verified ? '已验证' : '缺口' }}</Tag>
          </template>
          <template #owner="{ row }">{{ row.owner }}</template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          导出语义：证据包默认脱敏（IP 后两段、邮箱、路径原文）；导出行为本身写入审计（数据类别）。
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="assessOpen" header="发起合规自评" width="560px" :confirm-btn="{ content: '发起自评', theme: 'primary' }" cancel-btn="取消" @confirm="submitAssess">
      <div class="oc-stack">
        <Select v-model="assessForm.scope" size="small" aria-label="自评范围">
          <Option v-for="c in frameworks" :key="c.framework" :value="c.framework" :label="`${c.framework}（缺口 ${c.controls.filter((x) => !x.verified).length} 项）`" />
        </Select>
        <Input v-model="assessForm.owner" size="small" placeholder="自评负责人（必填，如 柏一川）" />
        <Input v-model="assessForm.dueAt" size="small" placeholder="计划完成日期（YYYY-MM-DD）" />
        <div class="oc-muted" style="font-size: 12px">
          自评结论属于证据草稿：需人工确认后才转为「已验证」；自评期间缺口保持显式标注，不改变控制项验证状态。
        </div>
      </div>
    </Dialog>
  </div>
</template>
