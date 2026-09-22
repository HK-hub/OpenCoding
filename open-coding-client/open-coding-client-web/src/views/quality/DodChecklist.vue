<script setup lang="ts">
/**
 * DoD 总表（Y-05）：26 域完成定义汇总（域/通过项/总项/状态）+ 逐项勾选交互；
 * 发布前置门禁全绿指示灯：任一域未通过即红灯并逐条列出阻断项；「导出检查单」真实下载 JSON。
 * 溯源：卷 26 / BUILD-MANIFEST Y-05。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Checkbox, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
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

interface DomainDef { name: string; done: number; items: string[] }

/** 26 域 DoD：items 顺序即勾选顺序，未完成项放最后（与阻断项列表一致） */
const DOMAINS: DomainDef[] = [
  { name: '会话与循环', done: 4, items: ['会话可恢复且元数据完整', '循环防护阈值可配置且误报 ≤1%', 'Turn 重放可复现', '取消/安全点停止语义明确'] },
  { name: '任务与计划', done: 4, items: ['计划可编辑且变更留痕', '任务依赖无环校验', '失败可重试且不重复副作用', '长任务检查点可用'] },
  { name: 'Goal 与验收', done: 4, items: ['Goal 陈述含可判定条件', '验收证据必须可查', '漂移检测覆盖三类证据', '完成声明需证据（禁止口头完成）'] },
  { name: '团队与人机混合', done: 3, items: ['角色与权限边界清晰', '仲裁记录可审计', '交接与接管可追溯'] },
  { name: '技能与自动化模板', done: 4, items: ['模板含权限声明与预算', '装载前校验 Fail-Fast', '版本可回滚', '示例可运行'] },
  { name: '插件与扩展点', done: 3, items: ['装载前权限校验', '失败不影响主流程', '分发前安全评审', '扩展点隔离与熔断（C10 未闭环）'] },
  { name: 'MCP 与工具生态', done: 4, items: ['工具声明资源与风险级', '调用可审计（含参数摘要）', '失败可重试', '结果语义检索可用'] },
  { name: '钩子', done: 3, items: ['钩子可开关且有超时', '失败不阻塞主流程（可配置）', '执行记录可查'] },
  { name: '审批与授权记忆', done: 4, items: ['审批等待被记录', '授权记忆可撤销与过期', '不得自动批准', '通道不可用时安全默认拒绝'] },
  { name: '权限策略与默认值', done: 4, items: ['默认拒绝', '策略变更留痕可回滚', '越权尝试有告警', '权限点与风险级映射完整'] },
  { name: '沙箱与隔离', done: 3, items: ['五档隔离可用', '平台能力缺失显式降级', '危险命令先拒绝后说明', '逃逸检测零容忍（增量用例未过）'] },
  { name: '凭证与密钥', done: 3, items: ['引用式注入不明文回显', '轮换与双读窗口可用', '泄露检测可告警'] },
  { name: '上下文与压缩', done: 4, items: ['压缩后引用可跳转', '未决项不丢失', '压缩率与耗时可见', '人工可复核压缩结果'] },
  { name: '引用与记忆', done: 3, items: ['记忆≠知识边界清晰', '冲突可仲裁', '删除可证明'] },
  { name: '成本与配额', done: 4, items: ['预算水位与超支拦截', '缓存折扣单列', '对账误差 ≤0.5%', '超支文案含提额路径'] },
  { name: '模型与路由', done: 4, items: ['四协议契约测试通过', '能力不支持显式报错（不静默降级）', '凭证引用式注入', '路由变更评测回归通过'] },
  { name: '提示词资产', done: 3, items: ['版本化与发布评审', '变量缺失即拒绝', '语言变体回退链可解释'] },
  { name: '工作区与 Git', done: 4, items: ['变更可 diff', '冲突显式提示而非覆盖', '提交签名有效', '回滚原子且可验证'] },
  { name: '事件与持久化', done: 4, items: ['事件信封完整（含 trace）', '只追加不可篡改', '死信可重放', 'Schema 双向兼容校验'] },
  { name: '可观测与日志', done: 3, items: ['关键路径打点齐全', '敏感信息脱敏', '告警含 Runbook 与验证命令'] },
  { name: '组织身份与 RBAC', done: 4, items: ['SSO/SCIM 同步可审计', '离岗即回收', '权限矩阵可导出', '最小权限默认'] },
  { name: '审计与合规', done: 4, items: ['审计链完整可验证', '导出含脱敏说明', '合规框架映射到控制项', '篡改可发现'] },
  { name: 'DLP 与数据驻留', done: 3, items: ['命中可解释含建议', '驻留策略硬校验', '跨区请求留痕'] },
  { name: '智能增强与前沿探索', done: 3, items: ['实验特性带徽标', '隔离运行不污染生产', '结论回填决策日志'] },
  { name: '质量与运维（评测·门禁·SLO）', done: 3, items: ['评分报告可自动生成', 'SLO 燃尽与冻结发布可用', 'Runbook 可执行演练', '门禁 14 类全绿', '混沌 C1–C10 全部归档'] },
  { name: '分发·遥测·许可', done: 4, items: ['制品签名校验', '回滚 ≤2 分钟', '遥测三级独立同意（默认全关）', '席位口径与宽限期一致'] },
];

const checked = ref<Record<string, boolean[]>>(Object.fromEntries(DOMAINS.map((d) => [d.name, d.items.map((_, i) => i < d.done)])));
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(12);
const expandedName = ref('质量与运维（评测·门禁·SLO）');
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', 'DoD 事实源不可达（dod-registry 校验超时）'));

interface DomainRow { name: string; passed: number; total: number; missing: string[] }
const rows = computed<DomainRow[]>(() => DOMAINS.map((d) => {
  const flags = checked.value[d.name] ?? [];
  const missing = d.items.filter((_, i) => !flags[i]);
  return { name: d.name, passed: d.items.length - missing.length, total: d.items.length, missing };
}));
const columns = [
  { colKey: 'name', title: '域', width: 260 },
  { colKey: 'passed', title: '通过项', width: 100 },
  { colKey: 'total', title: '总项', width: 90 },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'ops', title: '勾选', width: 90 },
];
const shown = computed(() => rows.value.slice(0, pageSize.value));
const passedDomains = computed(() => rows.value.filter((r) => r.passed === r.total).length);
const blockers = computed(() => rows.value.filter((r) => r.passed < r.total));
const releaseReady = computed(() => blockers.value.length === 0);
const expanded = computed(() => DOMAINS.find((d) => d.name === expandedName.value) ?? DOMAINS[0]);
const totals = computed(() => ({
  passed: rows.value.reduce((a, r) => a + r.passed, 0),
  total: rows.value.reduce((a, r) => a + r.total, 0),
}));

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = rows.value.length > pageSize.value ? 'EDGE_DATA' : rows.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
}

/** 勾选即更新本地状态；未勾满的域保持阻断（不允许「先发布后补勾」） */
function toggle(domain: string, index: number, value: boolean) {
  const flags = checked.value[domain];
  if (flags) flags[index] = value;
}

function exportChecklist() {
  const file = downloadJson(
    { generatedAt: '2026-09-12', releaseReady: releaseReady.value, passedDomains: passedDomains.value, domains: rows.value.map((r) => ({ ...r, items: (checked.value[r.name] ?? []).map((v, i) => ({ text: DOMAINS.find((d) => d.name === r.name)!.items[i], done: v })) })) },
    'oc-dod-checklist-2026-09-12.json',
  );
  MessagePlugin.success(`检查单已导出：${file}（${blockers.value.length ? `含 ${blockers.value.length} 个阻断域` : '全绿'}）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader title="DoD 总表" desc="26 域完成定义逐项勾选核查：任一域未勾满即视为发布阻断项；指示灯全绿才可进入发布流程，勾选过程不改变已归档证据。" volume="卷 26" manifest="Y-05" cli="oc quality dod list --domains 26 --blockers-only && oc quality dod export --out checklist.json" :status="[{ label: releaseReady ? '门禁全绿' : `阻断域 ${blockers.length}`, theme: releaseReady ? 'success' : 'danger' }, { label: `通过项 ${totals.passed} / ${totals.total}`, theme: 'default' }]">
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="exportChecklist">导出检查单</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="域数" :value="rows.length" format="number" icon="layers" hint="26 域与工程范围一一对应" />
      <StatCard label="全绿域" :value="passedDomains" format="number" :target="rows.length" target-kind="min" icon="check" hint="其余域存在未勾选项" />
      <StatCard label="通过项" :value="totals.passed" format="number" :target="totals.total" target-kind="min" icon="task-checked" :hint="`共 ${totals.total} 项（含强证据要求）`" />
      <StatCard label="阻断域" :value="blockers.length" format="number" icon="error" :lower-is-better="true" hint="插件隔离 · 沙箱逃逸 · 质量运维" />
    </div>

    <div class="oc-card" style="margin-top: 12px">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <span aria-hidden="true" :style="{ width: '12px', height: '12px', borderRadius: '50%', display: 'inline-block', background: releaseReady ? 'var(--td-success-color)' : 'var(--td-error-color)' }" />
        <b>{{ releaseReady ? '发布前置门禁全绿：可进入发布流程' : '发布前置门禁未全绿：发布被阻断' }}</b>
        <Tag v-for="b in blockers" :key="b.name" size="small" theme="danger" variant="light-outline">{{ b.name }}（缺 {{ b.total - b.passed }} 项）</Tag>
      </div>
      <div class="oc-muted" style="font-size: 12px; margin-top: 4px">阻断项必须逐条补齐并附证据（用例 / 截图 / 指标），不接受「已知悉」作为关闭理由；补齐后由质量负责人在本页勾选复核。</div>
    </div>

    <StateShell :state="state" empty-title="DoD 清单为空" empty-desc="未读取到 26 域定义（事实源未初始化）。清单缺失时发布检查单直接判未通过。" empty-action="重新拉取 DoD 清单" example-task="勾选「质量与运维」尚未完成的 2 项，观察门禁指示灯变化" :what="'DoD 清单加载失败'" :why="err.message" how="可重试；失败期间勾选状态保留在本地（未提交），恢复后可继续，不会静默丢弃已勾选项。" :trace-id="err.traceId" :collapsed-summary="`共 ${rows.length} 个域，已折叠展示前 ${pageSize} 个`" :page-size="pageSize" @retry="refresh" @load-more="pageSize = rows.length" @empty-action="refresh">
      <div class="oc-card">
        <div class="oc-card__title">26 域 DoD 汇总（点击行展开逐项勾选）</div>
        <Table row-key="name" size="small" :data="shown" :columns="columns" @row-click="(ctx: { row: unknown }) => (expandedName = (ctx.row as DomainRow).name)">
          <template #name="{ row }"><b style="font-size: 12px">{{ row.name }}</b><Tag v-if="row.passed < row.total" size="small" variant="light-outline" theme="danger" style="margin-left: 6px">阻断</Tag></template>
          <template #passed="{ row }"><span class="oc-mono">{{ row.passed }}</span></template>
          <template #total="{ row }"><span class="oc-mono">{{ row.total }}</span></template>
          <template #status="{ row }"><Tag size="small" variant="light-outline" :theme="row.passed === row.total ? 'success' : 'danger'">{{ row.passed === row.total ? '通过' : '未通过' }}</Tag></template>
          <template #ops="{ row }"><Button size="small" variant="text" @click.stop="expandedName = row.name">勾选</Button></template>
        </Table>
        <CliHint command="oc quality dod show --domain 质量与运维 --missing-only" label="仅看缺项" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">逐项勾选 · {{ expanded.name }}</div>
          <Tag size="small" variant="light-outline" :theme="rows.find((r) => r.name === expanded.name)?.passed === expanded.items.length ? 'success' : 'danger'">{{ rows.find((r) => r.name === expanded.name)?.passed }} / {{ expanded.items.length }}</Tag>
        </div>
        <div class="oc-stack" style="gap: 6px; margin-top: 6px">
          <div v-for="(item, i) in expanded.items" :key="item" class="oc-flex" style="gap: 8px; align-items: flex-start">
            <Checkbox :checked="(checked[expanded.name] ?? [])[i] === true" @change="(v: unknown) => toggle(expanded.name, i, Boolean(v))" />
            <span style="font-size: 12px" :class="{ 'oc-muted': !(checked[expanded.name] ?? [])[i] }">{{ item }}</span>
          </div>
        </div>
        <div class="oc-divider" />
        <InfoGrid :columns="2" :items="[
          { key: 'evidence', label: '勾选依据', value: '每项须能指向证据（用例 / 截图 / 指标看板 / 审计记录），否则不得勾选' }, { key: 'lock', label: '归档后冻结', value: '发布后本轮检查单转为只读；补充只在下一轮进行（禁止事后修改历史）' },
        ]" />
        <div class="oc-flex" style="margin-top: 8px; gap: 6px">
          <CopyableId id="trace-dod-2026-09-12-6ad3" label="复制检查单 traceId" />
          <span class="oc-muted" style="font-size: 12px">导出为 JSON（真实下载），可直接作为发布评审附件。</span>
        </div>
      </div>
    </StateShell>
  </div>
</template>
