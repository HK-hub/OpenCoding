<script setup lang="ts">
/**
 * 实施路线图 P0–P4（Y-05）：五阶段目标/关键交付/退出条件/状态，阶段可展开子项；
 * 已完成/进行中阶段附验收报告（评测总分 / 指标对比 / 红队结果 / 已知限制 / 遗留项）；当前阶段高亮。
 * 溯源：卷 26 / BUILD-MANIFEST Y-05。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { downloadJson } from '@/utils/download';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

interface Deliverable { text: string; done: boolean }
interface Acceptance { score: string; metrics: string; redteam: string; limits: string[]; backlog: string[]; at: string }
interface Phase { key: string; title: string; goal: string; status: '已完成' | '进行中' | '未开始'; deliverables: Deliverable[]; exit: string[]; acceptance?: Acceptance; inProgressNote?: string }

const PHASES: Phase[] = [
  {
    key: 'P0', title: '内核契约冻结与骨架可跑', goal: '先改设计再改代码：冻结核心 API 契约与模块依赖铁律，让仓库恢复可编译。', status: '已完成',
    deliverables: [{ text: '契约文档与决策日志冻结（含现状问题清单）', done: true }, { text: '五条编码规范落地并纳入评审门禁', done: true }, { text: '五层测试骨架 + CI 编译/类型检查', done: true }, { text: '红队与混沌用例清单登记（≥60 条）', done: true }],
    exit: ['全模块编译通过（0 错误）', '契约评审通过且无未决 P0 异议'],
    acceptance: { score: '评测总分 78.4 / 基线 76.0', metrics: '首 token P95 1.9s → 1.6s；成本 -4.2%（缓存折扣后）', redteam: '红队 58 / 62 通过（沙箱逃逸 4/5、跨租户 6/6）', at: '2026-07-18', limits: ['跨租户增量用例未覆盖（仅存量回归）', '混沌实验仅跑通 C1–C5', '桌面端旅程自动化尚未接入'], backlog: ['补齐跨租户增量用例（已排入 P1）', '插件隔离验证（已排入 P2）'] },
  },
  {
    key: 'P1', title: '质量评测体系与门禁全绿', goal: '把「可评测、可阻断」做成常态：评分报告自动生成，14 类变更门禁矩阵全绿。', status: '进行中',
    deliverables: [{ text: '评测任务集八类登记 + 基线建立', done: true }, { text: '评分报告（六维加权 + 回归双阈值）上线', done: true }, { text: '在线指标 8 项接入目标线与异常高亮', done: true }, { text: '变更门禁矩阵 14 类全绿（当前 2 类阻断）', done: false }, { text: 'J1–J12 旅程每日执行 + 三天稳定', done: false }],
    exit: ['评分报告与门禁矩阵全绿且连续 3 天无回退', '红队通过率 ≥95% 且零容忍项全过', '未闭环反馈 ≤2 条（P0/P1）'],
    inProgressNote: '当前阻断项：模型·路由（评测回归未过）、成本基线（吞吐/成本未达标）；退出条件未满足前不进入 P2。',
  },
  {
    key: 'P2', title: '多端一致与生态加固', goal: '三端状态一致可证明，插件与扩展点在隔离下可安全装载。', status: '未开始',
    deliverables: [{ text: '三端状态一致（延迟 ≤1s，冲突可重放）', done: false }, { text: '插件扩展点隔离与熔断', done: false }, { text: '沙箱五档默认策略收敛 + 逃逸零容忍闭环', done: false }],
    exit: ['J7/J11 连续两周全绿', '混沌实验 C10 通过', '插件生态安全评审通过'],
  },
  {
    key: 'P3', title: '企业治理与合规纵深', goal: '审计、DLP、数据驻留与配额计费达到企业交付标准。', status: '未开始',
    deliverables: [{ text: '审计链可信（只追加 + 链式校验）', done: false }, { text: 'DLP 规则命中可解释 + 脱敏预览', done: false }, { text: '驻留策略与跨租户访问全链路留痕', done: false }],
    exit: ['合规检查项全部通过', '审计演练（篡改检测）通过', '跨租户红队 0 失败'],
  },
  {
    key: 'P4', title: '生态开放与规模化', goal: '在质量与治理达标前提下开放生态，规模化交付而非规模化妥协。', status: '未开始',
    deliverables: [{ text: 'SDK / IDE / CI 集成模板与示例', done: false }, { text: '社区插件评审与分发通道', done: false }, { text: '容量与经济性目标（每席成本 ≤ 基线）', done: false }],
    exit: ['容量基准 8 场景全绿', '单位经济性达标', '回退率 ≤ 基线'],
  },
];

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const expandedKey = ref('P1');
const err = ref(makeError('INTERNAL_ERROR', '路线图事实源不可读（roadmap.yaml 校验失败：阶段状态字段缺失）'));

const doneCount = computed(() => PHASES.flatMap((p) => p.deliverables).filter((d) => d.done).length);
const totalCount = computed(() => PHASES.flatMap((p) => p.deliverables).length);
const current = computed(() => PHASES.find((p) => p.status === '进行中'));
const statusTheme = (s: Phase['status']) => (s === '已完成' ? 'success' : s === '进行中' ? 'primary' : 'default');

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = PHASES.length ? 'NORMAL' : 'EMPTY'; }, 240);
}
function openPhase(key: string) { expandedKey.value = expandedKey.value === key ? '' : key; }
/** 验收报告附件：真实生成 JSON 下载（含已知限制与遗留项，便于评审留档） */
function exportAcceptance(p: Phase) {
  const file = downloadJson({ phase: p.key, title: p.title, status: p.status, acceptance: p.acceptance ?? p.inProgressNote, exitCriteria: p.exit }, `oc-roadmap-${p.key}-acceptance.json`);
  MessagePlugin.success(`验收报告已下载：${file}`);
}
onMounted(() => { refresh(); ui.setViewState({ state: 'NORMAL' }); });
</script>

<template>
  <div class="oc-page">
    <PageHeader title="实施路线图 P0–P4" desc="阶段推进以退出条件为准而非日历：P0 不设固定工期；每个阶段交付物可核查，完成后附验收报告（含已知限制与遗留项）。" volume="卷 26" manifest="Y-05" cli="oc quality roadmap show --phase P1 --with-acceptance && oc quality roadmap export P0 --json" :status="[{ label: `当前阶段 ${current?.key ?? '—'}`, theme: 'primary' }, { label: `交付物 ${doneCount} / ${totalCount}`, theme: doneCount === totalCount ? 'success' : 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="exportAcceptance(PHASES.find((p) => p.key === expandedKey) ?? PHASES[0])">下载验收报告</Button>
        <Button size="small" theme="primary" @click="refresh">重新加载</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="阶段数" :value="PHASES.length" format="number" icon="flag" hint="P0–P4：先质量后生态，顺序不可跳" />
      <StatCard label="交付物完成" :value="doneCount" format="number" unit="项" icon="task-checked" :hint="`共 ${totalCount} 项（跨五阶段）`" />
      <StatCard label="当前阶段" :value="current?.key ?? '—'" format="raw" icon="time" hint="P1：质量评测体系与门禁全绿" />
      <StatCard label="P0 约定" :value="'无固定日历'" format="raw" icon="calendar" hint="以退出条件为准（编译通过 + 契约评审通过）" />
    </div>

    <StateShell :state="state" empty-title="路线图未加载" empty-desc="未读取到阶段定义（roadmap.yaml 缺失或校验失败）。路线图缺失时发布检查单记为未通过。" empty-action="重新加载路线图" example-task="查看 P1 退出条件与当前阻断项（模型·路由 / 成本基线）" :what="'路线图加载失败'" :why="err.message" how="可重试；失败时展示上一次成功快照并标注「可能滞后」，不影响已归档验收报告。" :trace-id="err.traceId" @retry="refresh" @empty-action="refresh">
      <div class="oc-card">
        <div class="oc-card__title">P0 工期说明（冻结约定，不随需调整）</div>
        <InfoGrid :columns="2" :items="[
          { key: 'rule', label: 'P0 不设日历工期', value: 'P0 以退出条件为准：全模块编译通过 + 契约评审通过；不承诺日期，避免为赶日期牺牲契约质量' },
          { key: 'why', label: '原因', value: '契约与依赖方向一旦反复，后续所有阶段的评测与门禁都要重做（返工成本远高于等待成本）' },
          { key: 'gate', label: '进入下一阶段', value: '退出条件全部满足 + 验收报告归档（含已知限制与遗留项），缺一不可' },
          { key: 'change', label: '变更方式', value: '路线图调整须走评审并记录理由；仅允许「追加限制」，不允许「降低退出条件」' },
        ]" />
      </div>

      <div v-for="p in PHASES" :key="p.key" class="oc-card" :style="p.status === '进行中' ? 'margin-top: 12px; border-left: 3px solid var(--td-brand-color)' : 'margin-top: 12px'">
        <div class="oc-flex--between">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <b class="oc-mono">{{ p.key }}</b><b>{{ p.title }}</b>
            <Tag size="small" variant="light-outline" :theme="statusTheme(p.status)">{{ p.status }}</Tag>
            <Tag v-if="p.status === '进行中'" size="small" variant="outline">当前阶段</Tag>
          </div>
          <Button size="small" variant="text" @click="openPhase(p.key)">{{ expandedKey === p.key ? '收起子项' : '展开子项' }}</Button>
        </div>
        <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">目标：{{ p.goal }}</div>

        <div v-if="expandedKey === p.key" style="margin-top: 10px">
          <div class="oc-grid oc-grid--2">
            <div>
              <div class="oc-card__title">关键交付</div>
              <div v-for="d in p.deliverables" :key="d.text" class="oc-flex" style="gap: 6px; margin-bottom: 4px">
                <Tag size="small" variant="light-outline" :theme="d.done ? 'success' : 'default'">{{ d.done ? '已完成' : '未完成' }}</Tag>
                <span style="font-size: 12px">{{ d.text }}</span>
              </div>
            </div>
            <div>
              <div class="oc-card__title">退出条件</div>
              <div v-for="e in p.exit" :key="e" class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">· {{ e }}</div>
            </div>
          </div>
          <div v-if="p.acceptance" class="oc-card" style="margin-top: 10px; box-shadow: none">
            <div class="oc-card__title">验收报告附件（{{ p.acceptance.at }}）</div>
            <InfoGrid :columns="2" :items="[
              { key: 'score', label: '评测总分', value: p.acceptance.score },
              { key: 'metrics', label: '指标对比', value: p.acceptance.metrics },
              { key: 'redteam', label: '红队结果', value: p.acceptance.redteam },
              { key: 'limits', label: '已知限制', value: p.acceptance.limits.join('；') },
              { key: 'backlog', label: '遗留项', value: p.acceptance.backlog.join('；') },
            ]" />
          </div>
          <div v-else-if="p.inProgressNote" class="oc-card" style="margin-top: 10px; box-shadow: none">
            <div class="oc-card__title">进展说明（阶段未完成，验收报告待归档）</div>
            <div class="oc-secondary" style="font-size: 12px">{{ p.inProgressNote }}</div>
          </div>
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <Button size="small" variant="outline" @click="exportAcceptance(p)">下载该阶段验收报告</Button>
            <CopyableId :id="`roadmap-${p.key}-trace`" label="复制阶段 traceId" />
          </div>
        </div>
      </div>

      <CliHint command="oc quality roadmap gate --from P1 --to P2 --explain" label="检查阶段推进条件" />
    </StateShell>
  </div>
</template>
