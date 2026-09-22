<script setup lang="ts">
/**
 * 评测任务集（Y-01）：八类任务（编码/重构/修Bug/测试补充/文档/设计还原/安全修复/长任务自治）与权重、
 * 基线成功率/成本/时长；支持类别过滤、关键词检索、分页、详情抽屉与新增评测任务（缺验收或基线拒绝创建）。
 * 溯源：卷 26 / BUILD-MANIFEST Y-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Drawer, Input, InputNumber, MessagePlugin, Pagination, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { downloadJson } from '@/utils/download';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

/** 八类评测任务：类别权重合计 100%（页面权重列即类别权重，评分报告按此加权） */
const CATEGORY_WEIGHT: Record<string, number> = { 编码: 20, 重构: 12, 修Bug: 16, 测试补充: 12, 文档: 8, 设计还原: 10, 安全修复: 12, 长任务自治: 10 };
const CATEGORIES = Object.keys(CATEGORY_WEIGHT);

interface EvalTask { taskId: string; name: string; category: string; baselineRatePct: number; baselineCostUsd: number; baselineSeconds: number; repo: string; commit: string; envList: string[]; instruction: string; constraints: string[]; acceptance: string }

const TASKS: EvalTask[] = [
  { taskId: 'EV-001', name: '修复空指针并保持 API 兼容', category: '修Bug', baselineRatePct: 86, baselineCostUsd: 0.42, baselineSeconds: 96, repo: 'oc-core-agent', commit: 'a41f9c2', envList: ['OC_MODEL=claude-sonnet', 'OC_SANDBOX=L2', 'OC_MAX_TOKENS=8192'], instruction: '复现崩溃调用链，修复空指针但不改变公开方法签名与返回语义。', constraints: ['仅修改 src/main/java 下文件', '不得引入新依赖', '保持既有公开 API 不变'], acceptance: 'scripts/accept/EV-001.sh 退出码 0，且回归用例 12/12 通过' },
  { taskId: 'EV-002', name: '按规格实现分页查询接口', category: '编码', baselineRatePct: 82, baselineCostUsd: 0.68, baselineSeconds: 240, repo: 'oc-domain', commit: '7d3e118', envList: ['OC_MODEL=openai-gpt', 'OC_SANDBOX=L2', 'OC_DB=pg-ephemeral'], instruction: '依据接口契约实现游标分页查询，含参数校验与空结果语义。', constraints: ['SQL 必须参数化', '分页上限由配置读取'], acceptance: 'contract/EV-002.yaml 双向校验通过 + 集成用例全绿' },
  { taskId: 'EV-003', name: '抽取重复代码为工具方法', category: '重构', baselineRatePct: 90, baselineCostUsd: 0.35, baselineSeconds: 150, repo: 'oc-infrastructure', commit: 'c90b1de', envList: ['OC_MODEL=gemini-pro', 'OC_SANDBOX=L1'], instruction: '识别 6 处重复的路径规范化逻辑，抽取为单一工具方法并替换调用点。', constraints: ['不得改变行为（快照测试为准）', '保持包依赖方向'], acceptance: '行为快照 100% 一致 + 单测通过率 ≥90%' },
  { taskId: 'EV-004', name: '为覆盖率未达标模块补单测', category: '测试补充', baselineRatePct: 78, baselineCostUsd: 0.51, baselineSeconds: 210, repo: 'oc-core-tool', commit: 'e12ad45', envList: ['OC_MODEL=claude-sonnet', 'OC_SANDBOX=L1', 'OC_COV=on'], instruction: '为 nexec 执行器补充边界用例，将行覆盖率提升至 ≥80%。', constraints: ['不得修改被测代码', '禁止吞异常式断言'], acceptance: '行覆盖率较基线 +6pp 且新增用例全部可独立运行' },
  { taskId: 'EV-005', name: '生成模块 README 与变更说明', category: '文档', baselineRatePct: 93, baselineCostUsd: 0.18, baselineSeconds: 72, repo: 'oc-plugin-sdk', commit: '99b0f31', envList: ['OC_MODEL=ollama-local', 'OC_SANDBOX=L1'], instruction: '基于源码与近期提交生成模块 README，含快速开始与扩展点说明。', constraints: ['不得编造不存在的 API', '示例代码必须可编译'], acceptance: '文档中的示例代码块编译通过 + 链接可达' },
  { taskId: 'EV-006', name: '按设计稿还原设置页组件', category: '设计还原', baselineRatePct: 71, baselineCostUsd: 0.95, baselineSeconds: 420, repo: 'open-coding-client-web', commit: '3f77ac0', envList: ['OC_MODEL=claude-sonnet', 'OC_SANDBOX=L2', 'OC_VISUAL=snapshot'], instruction: '按设计稿还原「通知偏好」设置页，含空/加载/错误三态。', constraints: ['复用既有组件库', '禁止新增 npm 依赖'], acceptance: '视觉快照差异 ≤0.5% + 三态截图人工复核通过' },
  { taskId: 'EV-007', name: '修复依赖漏洞并升级区间', category: '安全修复', baselineRatePct: 84, baselineCostUsd: 0.57, baselineSeconds: 180, repo: 'oc-core-model', commit: 'd10c8ab', envList: ['OC_MODEL=openai-gpt', 'OC_SANDBOX=L3', 'OC_SCAN=trivy'], instruction: '定位高危依赖并升级至安全区间，验证四协议适配器不回归。', constraints: ['禁止大版本跳跃', '锁文件必须同步提交'], acceptance: '漏洞扫描 0 高危 + 契约测试全绿' },
  { taskId: 'EV-008', name: '跨 40 文件的长任务自治重构', category: '长任务自治', baselineRatePct: 62, baselineCostUsd: 3.4, baselineSeconds: 1800, repo: 'oc-core-agent', commit: 'b5de227', envList: ['OC_MODEL=claude-sonnet', 'OC_SANDBOX=L2', 'OC_CHECKPOINT=on'], instruction: '将 AgentLoop 的上下文裁剪策略抽取为可插拔组件，跨模块同步改造。', constraints: ['分段提交，逐步可运行', '每步保持编译通过'], acceptance: '同任务集总分不下降且压缩率提升 ≥5%' },
  { taskId: 'EV-009', name: '修复并发写入竞态', category: '修Bug', baselineRatePct: 74, baselineCostUsd: 0.88, baselineSeconds: 300, repo: 'oc-infrastructure', commit: '88a4d3f', envList: ['OC_MODEL=claude-sonnet', 'OC_SANDBOX=L2'], instruction: '定位事件写入与缓存更新的竞态窗口，采用条件更新消除丢写。', constraints: ['不得加全局锁'], acceptance: '竞态注入用例 20/20 通过 + 无新增慢查询' },
  { taskId: 'EV-010', name: '实现事件重放幂等校验', category: '编码', baselineRatePct: 80, baselineCostUsd: 0.74, baselineSeconds: 260, repo: 'oc-event', commit: '4c2b7e9', envList: ['OC_MODEL=gemini-pro', 'OC_SANDBOX=L2', 'OC_EVENT=replay'], instruction: '为事件重放增加幂等键校验，重复消费必须安全跳过并留痕。', constraints: ['顺序消费语义不变', '幂等键长度上限 128'], acceptance: '重放 3 次结果一致 + 幂等命中可查询' },
  { taskId: 'EV-011', name: '消除循环依赖并统一出口', category: '重构', baselineRatePct: 88, baselineCostUsd: 0.44, baselineSeconds: 168, repo: 'oc-application', commit: 'f60a912', envList: ['OC_MODEL=openai-gpt', 'OC_SANDBOX=L1'], instruction: '消除应用层内部循环依赖，统一经门面（Facade）暴露能力。', constraints: ['对外接口签名不变', '依赖方向单向'], acceptance: '架构守护测试 0 违规 + 单测全绿' },
  { taskId: 'EV-012', name: '补充契约测试用例', category: '测试补充', baselineRatePct: 81, baselineCostUsd: 0.47, baselineSeconds: 195, repo: 'oc-contract', commit: '2d91c05', envList: ['OC_MODEL=claude-sonnet', 'OC_SANDBOX=L1'], instruction: '为消息模型契约补充双向兼容用例（新增字段 / 字段废弃 / 枚举扩展）。', constraints: ['用例必须来自契约变更记录', '禁止只断言 happy path'], acceptance: '契约变更记录覆盖率 100%' },
  { taskId: 'EV-013', name: '提示注入防御与加固', category: '安全修复', baselineRatePct: 76, baselineCostUsd: 0.66, baselineSeconds: 205, repo: 'oc-core-api', commit: 'a30e77b', envList: ['OC_MODEL=claude-sonnet', 'OC_SANDBOX=L3', 'OC_REDTEAM=on'], instruction: '针对提示注入样本加固系统提示与工具输出隔离，红队用例不得回归。', constraints: ['不得降低功能成功率', '加固点写回文档'], acceptance: '提示注入 9 条用例全过 + 功能回归不降' },
  { taskId: 'EV-014', name: '三步以上工具的链式任务', category: '长任务自治', baselineRatePct: 58, baselineCostUsd: 2.85, baselineSeconds: 1500, repo: 'oc-core-agent', commit: '77f1b6c', envList: ['OC_MODEL=claude-sonnet', 'OC_SANDBOX=L2', 'OC_APPROVAL=auto-readonly'], instruction: '完成「检索 → 修改 → 验证 → 提交」四步链式任务，遇审批须等待而非绕过。', constraints: ['遇审批必须停止等待', '不得跳步'], acceptance: '链路完整执行且审批等待被正确记录' },
];

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const keyword = ref(''); const categoryFilter = ref('全部类别'); const page = ref(1); const pageSize = 6;
const drawerOpen = ref(false); const createOpen = ref(false); const activeTask = ref<EvalTask | null>(null);
const err = ref(makeError('NOT_FOUND', '评测任务集索引未命中（task-index 分片重建中）'));

const categoryOptions = computed(() => [{ label: '全部类别', value: '全部类别' }, ...CATEGORIES.map((c) => ({ label: `${c}（权重 ${CATEGORY_WEIGHT[c]}%）`, value: c }))]);
const filtered = computed(() => TASKS.filter((t) => (categoryFilter.value === '全部类别' || t.category === categoryFilter.value) && (!keyword.value.trim() || t.taskId.includes(keyword.value.trim()) || t.name.includes(keyword.value.trim()))));
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const weightSum = computed(() => Object.values(CATEGORY_WEIGHT).reduce((a, b) => a + b, 0));
/** 表格列：权重为派生列（按类别查表），操作为固定动作列 */
const taskColumns = [
  { colKey: 'taskId', title: 'taskId', width: 100 , cell: 'taskIdCell' }, { colKey: 'name', title: '名称', width: 250 },
  { colKey: 'category', title: '类别', width: 110 }, { colKey: 'weightPct', title: '权重', width: 80 },
  { colKey: 'baselineRatePct', title: '基线成功率', width: 110 }, { colKey: 'baselineCostUsd', title: '基线成本', width: 100 },
  { colKey: 'baselineSeconds', title: '基线时长', width: 100 }, { colKey: 'ops', title: '详情', width: 80 },
];

/** 新增任务表单：缺验收或基线即给字段级错误并拒绝创建（无验收不可评分，无基线无法判回归） */
const form = ref({ name: '', category: '编码', weight: CATEGORY_WEIGHT['编码'] });
const fieldErrors = ref<Record<string, string>>({});
const formAcceptance = ref(''); const formBaselineRate = ref<number | undefined>(undefined);
const formBaselineCost = ref<number | undefined>(undefined); const formBaselineSeconds = ref<number | undefined>(undefined);

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = TASKS.length === 0 ? 'EMPTY' : filtered.value.length > pageSize ? 'EDGE_DATA' : 'NORMAL'; }, 240);
}
function openDetail(row: EvalTask) { activeTask.value = row; drawerOpen.value = true; }
function openCreate() {
  form.value = { name: '', category: '编码', weight: CATEGORY_WEIGHT['编码'] }; formAcceptance.value = '';
  formBaselineRate.value = undefined; formBaselineCost.value = undefined; formBaselineSeconds.value = undefined;
  fieldErrors.value = {}; createOpen.value = true;
}
function createTask() {
  const errors: Record<string, string> = {};
  if (!form.value.name.trim()) errors.name = '任务名称必填（将出现在运行报告与得分依据中）';
  if (!formAcceptance.value.trim()) errors.acceptance = '验收未填写：没有可自动判定的验收脚本，评分无法复现';
  if (formBaselineRate.value === undefined || formBaselineCost.value === undefined || formBaselineSeconds.value === undefined) errors.baseline = '基线未填写：缺少基线成功率/成本/时长，无法判定回归';
  fieldErrors.value = errors;
  if (Object.keys(errors).length) return;
  MessagePlugin.success(`评测任务已登记：${form.value.name}（类别 ${form.value.category}，权重 ${form.value.weight}%）`);
  createOpen.value = false;
}
function exportTasks() {
  const file = downloadJson({ total: TASKS.length, weightSum: weightSum.value, tasks: TASKS }, `oc-eval-tasks-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success(`任务集已导出：${file}（含权重合计 ${weightSum.value}% 校验）`);
}
onMounted(() => { refresh(); ui.setViewState({ state: 'NORMAL' }); });
</script>

<template>
  <div class="oc-page">
    <PageHeader title="评测任务集" desc="八类评测任务统一登记：每条任务绑定可复现环境（repo/commit/环境变量）、指令、约束、验收脚本与基线；权重合计必须为 100%。" volume="卷 26" manifest="Y-01" cli="oc eval tasks list --category 编码 --with-baseline && oc eval tasks add --from task.yaml" :status="[{ label: `任务 ${TASKS.length} 条`, theme: 'primary' }, { label: `权重合计 ${weightSum}%`, theme: weightSum === 100 ? 'success' : 'danger' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="exportTasks">导出任务集</Button>
        <Button size="small" theme="primary" @click="openCreate">新增评测任务</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="任务总数" :value="TASKS.length" format="number" icon="task" hint="覆盖八类任务，类别下至少各 1 条" />
      <StatCard label="类别权重合计" :value="weightSum" format="raw" unit="%" :target="100" target-kind="min" icon="chart" hint="权重之和必须恰为 100%" />
      <StatCard label="含长任务自治" :value="TASKS.filter((t) => t.category === '长任务自治').length" format="raw" unit="条" icon="time" hint="单任务 ≥1500s，验证恢复与检查点" />
      <StatCard label="基线已登记" :value="TASKS.length" format="number" icon="flag" hint="基线变更须 ≥2 名评审人批准（见评测运行页）" />
    </div>

    <div class="oc-flex oc-flex--wrap" style="gap: 8px">
      <Input v-model="keyword" placeholder="按 taskId 或名称检索" style="width: 240px" clearable aria-label="关键词检索" />
      <Select v-model="categoryFilter" :options="categoryOptions" style="width: 220px" aria-label="类别过滤" />
      <CliHint command="oc eval tasks list --filter 'category=编码' --json" label="等价命令" />
      <span class="oc-muted" style="font-size: 12px">过滤后 {{ filtered.length }} 条 / 共 {{ TASKS.length }} 条</span>
    </div>

    <StateShell :state="state" empty-title="没有匹配的评测任务" empty-desc="当前过滤条件（类别 + 关键词）未命中任何任务；可清空关键词或切换类别。" empty-action="清空过滤条件" example-task="登记一条「修复并发写入竞态」的修 Bug 任务并挂接基线" :what="'评测任务集加载失败'" :why="err.message" how="可重试；失败期间运行中的评测不受影响（运行使用已快照的任务集版本）。" :trace-id="err.traceId" :collapsed-summary="`共 ${filtered.length} 条任务，已折叠展示当前页 ${pageSize} 条（含基线与验收摘要）`" :page-size="pageSize" @retry="refresh" @load-more="page += 1" @empty-action="keyword = ''; categoryFilter = '全部类别'">
      <div class="oc-card">
        <div class="oc-card__title">任务集（权重列为类别权重，八类合计 {{ weightSum }}%）</div>
        <Table row-key="taskId" size="small" :data="paged" :columns="taskColumns" @row-click="(ctx: { row: unknown }) => openDetail(ctx.row as EvalTask)">
          <template #taskIdCell="{ row }"><span class="oc-mono">{{ row.taskId }}</span></template>
          <template #name="{ row }"><span style="font-size: 12px">{{ row.name }}</span></template>
          <template #category="{ row }"><Tag size="small" variant="light-outline" theme="primary">{{ row.category }}</Tag></template>
          <template #weightPct="{ row }">{{ CATEGORY_WEIGHT[row.category] }}%</template>
          <template #baselineRatePct="{ row }">{{ row.baselineRatePct }}%</template>
          <template #baselineCostUsd="{ row }"><span class="oc-mono">${{ row.baselineCostUsd.toFixed(2) }}</span></template>
          <template #baselineSeconds="{ row }">{{ row.baselineSeconds >= 600 ? `${(row.baselineSeconds / 60).toFixed(0)} 分钟` : `${row.baselineSeconds}s` }}</template>
          <template #ops="{ row }"><Button size="small" variant="text" @click.stop="openDetail(row)">详情</Button></template>
        </Table>
        <Pagination v-model="page" :total="filtered.length" :page-size="pageSize" size="small" :show-jumper="true" style="margin-top: 8px" />
      </div>
    </StateShell>

    <Drawer v-model:visible="drawerOpen" :header="`任务详情 · ${activeTask?.taskId ?? ''}`" size="640px" :footer="false">
      <template v-if="activeTask">
        <InfoGrid :columns="2" :items="[
          { key: 'name', label: '名称', value: activeTask.name },
          { key: 'category', label: '类别', value: `${activeTask.category}（权重 ${CATEGORY_WEIGHT[activeTask.category]}%）` },
          { key: 'repo', label: '仓库', value: activeTask.repo, mono: true },
          { key: 'commit', label: '提交', value: activeTask.commit, mono: true, copyable: true },
          { key: 'instruction', label: '指令', value: activeTask.instruction, block: true, span: 2 },
          { key: 'acceptance', label: '验收', value: activeTask.acceptance, block: true, span: 2 },
          { key: 'constraints', label: '约束', value: activeTask.constraints.map((c) => `· ${c}`).join('\n'), block: true, span: 2 },
          { key: 'rate', label: '基线成功率', value: `${activeTask.baselineRatePct}%` },
          { key: 'cost', label: '基线成本', value: `$${activeTask.baselineCostUsd.toFixed(2)}` },
          { key: 'dur', label: '基线时长', value: `${activeTask.baselineSeconds}s` },
        ]" />
        <div class="oc-divider" />
        <div class="oc-card__title">环境变量清单（envList）</div>
        <JsonBlock :value="activeTask.envList" :collapse-over="160" label="envList（密钥一律引用式，不出现明文）" />
        <div class="oc-flex" style="margin-top: 8px">
          <CopyableId :id="`${activeTask.repo}@${activeTask.commit}`" label="复制环境指纹" />
        </div>
      </template>
    </Drawer>

    <Dialog v-model:visible="createOpen" header="新增评测任务" width="640px" :confirm-btn="{ content: '登记任务', theme: 'primary' }" cancel-btn="取消" @confirm="createTask">
      <div class="oc-stack">
        <div><div class="oc-card__title">任务名称 <span style="color: var(--td-error-color)">*</span></div><Input v-model="form.name" placeholder="例如：修复空指针并保持 API 兼容" aria-label="任务名称" /><div v-if="fieldErrors.name" style="color: var(--td-error-color); font-size: 12px; margin-top: 2px">{{ fieldErrors.name }}</div></div>
        <div class="oc-flex" style="gap: 12px">
          <div class="oc-grow"><div class="oc-card__title">类别（决定权重）</div><Select v-model="form.category" :options="CATEGORIES.map((c) => ({ label: `${c}（${CATEGORY_WEIGHT[c]}%）`, value: c }))" aria-label="任务类别" /></div>
          <div style="width: 140px"><div class="oc-card__title">权重</div><InputNumber v-model="form.weight" :min="0" :max="100" theme="normal" aria-label="权重" /></div>
        </div>
        <div><div class="oc-card__title">验收脚本 / 判据 <span style="color: var(--td-error-color)">*</span></div><Textarea v-model="formAcceptance" placeholder="例如：scripts/accept/EV-0xx.sh 退出码 0 且回归用例全绿" :autosize="{ minRows: 2, maxRows: 4 }" /><div v-if="fieldErrors.acceptance" style="color: var(--td-error-color); font-size: 12px; margin-top: 2px">{{ fieldErrors.acceptance }}</div></div>
        <div>
          <div class="oc-card__title">基线（成功率 / 成本 / 时长）<span style="color: var(--td-error-color)">*</span></div>
          <div class="oc-flex" style="gap: 8px">
            <InputNumber v-model="formBaselineRate" :min="0" :max="100" theme="normal" suffix="%" aria-label="基线成功率" />
            <InputNumber v-model="formBaselineCost" :min="0" :max="50" :step="0.01" theme="normal" suffix="USD" aria-label="基线成本" />
            <InputNumber v-model="formBaselineSeconds" :min="0" :max="3600" theme="normal" suffix="s" aria-label="基线时长" />
          </div>
          <div v-if="fieldErrors.baseline" style="color: var(--td-error-color); font-size: 12px; margin-top: 2px">{{ fieldErrors.baseline }}</div>
        </div>
        <div class="oc-muted" style="font-size: 12px">校验不通过时不会落库：无验收 = 不可评分，无基线 = 无法判定回归（不做静默降级）。</div>
      </div>
    </Dialog>
  </div>
</template>
