<script setup lang="ts">
/**
 * A-04 验证与证据面板：三级验证（L1 静态 / L2 可执行 / L3 语义）+ 证据清单 + 未验证项 + 完成报告模板。
 * 硬约束：声称「完成」必须附证据（命令与输出、测试结果、差异摘要）；无法验证的结论必须标注「未验证」（卷 12 D-AG-11）。
 * 溯源：卷 12 D-AG-11 / §4.5 / BUILD-MANIFEST A-04
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const data = knowledgeData.agent;

const state = ref<UiStateKind>('LOADING');
const levelFilter = ref('all');
const declared = ref(false);

/** 人工复核请求发起时间（为空表示尚未发起；发起后未验证项成为复核清单，首项置顶） */
const reviewRequestedAt = ref('');

/** 已加入修复清单的检查项（页面内清单 + 随报告导出） */
const fixList = ref<string[]>([]);

/** 已标注为「已知风险」的检查项（随完成报告披露，不视为已通过） */
const knownRisks = ref<string[]>([]);

/** 展开为行：级别 × 检查项 */
const rows = computed(() =>
  data.verification
    .filter((v) => levelFilter.value === 'all' || v.level === levelFilter.value)
    .flatMap((v) => v.items.map((it) => ({ ...it, level: v.level }))),
);
const failed = computed(() => rows.value.filter((r) => !r.ok));
const passRate = computed(() => Math.round(((rows.value.length - failed.value.length) / Math.max(1, rows.value.length)) * 100));

const report = computed(() => ({
  changeSummary: '记忆/知识/内核三域 mock 数据模块 + 26 个页面 + 3 个路由模块',
  evidence: data.verification.flatMap((v) => v.items.filter((i) => i.ok).map((i) => `${i.name} → ${i.evidence}`)).slice(0, 5),
  unverified: data.verification.flatMap((v) => v.items.filter((i) => !i.ok).map((i) => `[${v.level}] ${i.name}：${i.evidence}`)),
  knownRisks: knownRisks.value.map((n) => `[已知风险] ${n}：人工确认可接受，随报告对外披露（不计入通过）`),
  fixPlan: fixList.value.map((n) => `${n}：修复后重跑该级别验证，通过后移出未验证项`),
  risks: ['索引增量延迟实测 47s > 30s 目标，需优化变更合并去抖', '文档漂移自动修订缺少端到端用例，人工校订段落保护规则待验证'],
  cost: '本次 Turn：$6.42 / 96 步 / 39min（预算上限 $8 / 120 步 / 60min）',
}));

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function levelTheme(l: string) {
  return l.startsWith('L1') ? 'primary' : l.startsWith('L2') ? 'warning' : 'success';
}

function declareDone() {
  if (failed.value.length) {
    declared.value = false;
    MessagePlugin.error('拒绝声明完成：存在未验证项（无证据即非法），请先补齐证据或标注为未验证');
    return;
  }
  declared.value = true;
  MessagePlugin.success('已完成声明：全部检查项附证据，报告已生成（可导出评测）');
}

/** 导出完成报告（含未验证项清单）：数据取自本页 report / rows / failed 计算属性 */
function exportReport() {
  const filename = `oc-agent-verification-report-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson(
    {
      declared: declared.value,
      passRate: passRate.value,
      report: report.value,
      checkRows: rows.value,
      unverified: failed.value,
    },
    filename,
  );
  MessagePlugin.success(`已导出完成报告（${filename}）`);
}

/** 请求人工复核：未验证项成为复核清单（首项置顶），页面内生成可见复核记录 */
function requestReview() {
  if (!failed.value.length) {
    MessagePlugin.warning('当前没有未验证项，无需人工复核');
    return;
  }
  reviewRequestedAt.value = new Date().toLocaleString('zh-CN');
  MessagePlugin.info(`已邀请人类复核：${failed.value.length} 项未验证进入复核清单，首项「${failed.value[0].name}」`);
}

/** 加入修复清单：登记到页面清单并写入完成报告的修复计划，修复后重跑该级别验证 */
function addToFixList(name: string) {
  if (fixList.value.includes(name)) {
    MessagePlugin.warning(`「${name}」已在修复清单中，修复后重跑该级别验证`);
    return;
  }
  fixList.value.push(name);
  MessagePlugin.success(`已加入修复清单：修复后重跑该级别验证（清单共 ${fixList.value.length} 项）`);
}

/** 标注已知风险：登记后随完成报告导出（未验证项仍显式保留，不视为已通过） */
function markKnownRisk(name: string) {
  if (knownRisks.value.includes(name)) {
    MessagePlugin.warning(`「${name}」已标注为已知风险`);
    return;
  }
  knownRisks.value.push(name);
  MessagePlugin.warning(`已标注为「已知风险」：会出现在完成报告的未验证项中（已知风险共 ${knownRisks.value.length} 项）`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="验证与证据"
      desc="以外部客观证据为主、模型自评为辅：L1 静态 / L2 可执行 / L3 语义三级验证，未验证项显式标注，禁止无证据的完成声明。"
      volume="卷 12"
      manifest="A-04"
      cli="oc agent verify --level all --require-evidence"
      :status="[{ label: `通过率 ${passRate}%`, theme: failed.length ? 'warning' : 'success' }, { label: failed.length ? `${failed.length} 项未验证` : '全部附证据', theme: failed.length ? 'danger' : 'success' }]"
    >
      <template #actions>
        <Select v-model="levelFilter" size="small" style="width: 140px" :options="[{ label: '全部级别', value: 'all' }, { label: 'L1 静态', value: 'L1 静态' }, { label: 'L2 可执行', value: 'L2 可执行' }, { label: 'L3 语义', value: 'L3 语义' }]" />
        <Popconfirm content="完成声明会写入 Turn 报告并作为 Goal/任务的验收输入；未验证项会被显式列出。" @confirm="declareDone">
          <Button size="small" theme="primary"><OcIcon name="check" size="12px" /> 声明完成</Button>
        </Popconfirm>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="检查项" :value="rows.length" unit="项" icon="task-checked" hint="三级验证合计；每条必须附证据" />
      <StatCard label="通过" :value="rows.length - failed.length" unit="项" icon="check" hint="证据可复现（命令 + 输出摘要）" />
      <StatCard label="未验证" :value="failed.length" unit="项" icon="error" :lower-is-better="true" hint="显式标注，不得作为已完成内容对外声明" />
      <StatCard label="验收就绪度" :value="passRate" unit="%" icon="chart" hint="未验证项为 0 才可声明完成" />
    </div>

    <StateShell
      :state="state"
      stage="执行三级验证…"
      empty-title="还没有验证记录"
      empty-desc="验证在「认为完成」时自动触发；也可手动要求重跑（重跑计入预算）。"
      empty-action="立即验证"
      example-task="修改迁移脚本后重跑 L2 可执行验证"
      what="验证执行失败"
      why="可执行验证环境不可用（沙箱或测试命令失败导致验证器无法启动）。"
      how="可重试；重试会复用已通过的静态检查结果，不重复消耗预算。"
      trace-id="trace-ver-77c1a4"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">
          证据清单
          <span class="oc-muted" style="font-size: 12px">未通过项会阻断完成声明（无证据即非法）</span>
        </h3>
        <Table
          :data="rows"
          :columns="[
            { colKey: 'level', title: '级别', width: 120, cell: 'cell' },
            { colKey: 'name', title: '检查项', width: 320, cell: 'cell' },
            { colKey: 'ok', title: '结论', width: 110, cell: 'cell' },
            { colKey: 'evidence', title: '证据（命令 / 输出摘要 / 引用）', cell: 'cell' },
          ]"
          row-key="name"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'level'">
              <Tag size="small" :theme="levelTheme(row.level)" variant="light-outline">{{ row.level }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'name'">
              <span :style="row.ok ? '' : 'font-weight: 600'">{{ row.name }}</span>
            </template>
            <template v-else-if="col.colKey === 'ok'">
              <Tag size="small" :theme="row.ok ? 'success' : 'danger'">{{ row.ok ? '通过' : '未验证' }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'evidence'">
              <span class="oc-mono" style="font-size: 12px">{{ row.evidence }}</span>
              <Tag v-if="!row.ok" size="small" theme="warning" variant="light-outline" style="margin-left: 6px">需补齐证据</Tag>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            完成报告模板
            <Tag size="small" :theme="declared ? 'success' : 'warning'" variant="light-outline">{{ declared ? '已生成' : '待生成（先补齐证据）' }}</Tag>
          </h3>
          <JsonBlock :value="report" label="报告字段：变更摘要 / 证据清单 / 未验证项 / 已知风险 / 修复计划 / 风险与建议 / 用量成本" :collapse-over="260" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <Button size="small" variant="outline" @click="exportReport">导出报告</Button>
            <Button size="small" variant="outline" @click="requestReview">请求人工复核</Button>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">未验证项与处置</h3>
          <!-- 人工复核记录：请求后未验证项即成为复核清单（首项置顶，页面可见） -->
          <div v-if="reviewRequestedAt" class="oc-card" style="padding: 8px 10px; margin-bottom: 8px; border-color: var(--oc-sev-warn)">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
              <OcIcon name="secured" size="13px" color="var(--oc-sev-warn)" />
              <b style="font-size: 13px">人工复核请求已发出</b>
              <Tag size="small" theme="warning" variant="light-outline">{{ failed.length }} 项待复核</Tag>
              <span class="oc-muted" style="font-size: 12px">{{ reviewRequestedAt }}</span>
            </div>
            <ol class="oc-secondary" style="font-size: 12px; margin: 6px 0 0; padding-left: 18px">
              <li v-for="(f, i) in failed" :key="f.name">
                {{ f.name }}<span v-if="i === 0" class="oc-muted">（复核清单首项）</span>
              </li>
            </ol>
          </div>
          <div v-for="f in failed" :key="f.name" class="oc-card" style="padding: 8px 10px; margin-bottom: 8px">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" :theme="levelTheme(f.level)" variant="light-outline">{{ f.level }}</Tag>
              <b style="font-size: 13px">{{ f.name }}</b>
              <Tag v-if="fixList.includes(f.name)" size="small" theme="primary" variant="light-outline">已在修复清单</Tag>
              <Tag v-if="knownRisks.includes(f.name)" size="small" theme="warning" variant="light-outline">已知风险</Tag>
            </div>
            <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ f.evidence }}</div>
            <div class="oc-flex" style="gap: 6px; margin-top: 6px">
              <Button size="small" variant="text" :disabled="fixList.includes(f.name)" @click="addToFixList(f.name)">
                {{ fixList.includes(f.name) ? '已加入修复清单' : '加入修复清单' }}
              </Button>
              <Button size="small" variant="text" :disabled="knownRisks.includes(f.name)" @click="markKnownRisk(f.name)">
                {{ knownRisks.includes(f.name) ? '已标注已知风险' : '标注已知风险' }}
              </Button>
            </div>
          </div>
          <div v-if="!failed.length" class="oc-flex" style="gap: 8px">
            <OcIcon name="check" size="14px" color="var(--oc-sev-ok)" />
            <span class="oc-secondary" style="font-size: 12px">全部检查项通过且附证据，可安全声明完成。</span>
          </div>
          <!-- 处置汇总：修复清单与已知风险随完成报告导出（导出可见于 report 字段） -->
          <div v-if="fixList.length" class="oc-secondary" style="font-size: 12px; margin-top: 6px">
            修复清单（{{ fixList.length }}）：{{ fixList.join('、') }}
          </div>
          <div v-if="knownRisks.length" class="oc-secondary" style="font-size: 12px; margin-top: 2px">
            已知风险（{{ knownRisks.length }}）：{{ knownRisks.join('、') }}（随完成报告披露，未验证项仍保留）
          </div>
          <div class="oc-divider" />
          <div class="oc-kv" style="font-size: 12px">
            <span class="oc-kv__k">L1 通过标准</span><span>无编译/类型/格式错误</span>
            <span class="oc-kv__k">L2 通过标准</span><span>目标测试通过、构建成功</span>
            <span class="oc-kv__k">L3 通过标准</span><span>验收清单逐条有证据映射</span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
