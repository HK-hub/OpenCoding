<script setup lang="ts">
/**
 * 极端组合场景预案（RB-12）：7 类组合场景（数据库不可用 + 磁盘 ≥90% / 模型全端点不可用 / 断网 24h /
 * 超长任务 >7 天 / 时钟漂移 >5s / 恶意仓库或巨型单文件 / 租户级异常消耗），
 * 每类含首要动作、降级顺序（保命 → 保数据 → 保体验）与恢复判据；一键降级需 Popconfirm 二次确认。
 * 溯源：卷 32 / BUILD-MANIFEST G5-04（RB-12）
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');

interface Step { tier: '保命' | '保数据' | '保体验'; action: string }
interface Scenario { id: string; name: string; primary: string; order: Step[]; recover: string; runbook: string; owner: string }

/** 七类组合场景预案（本地确定性数据，与 RB-12 步骤一一对应） */
const SCENARIOS: Scenario[] = [
  { id: 'db+disk', name: '数据库不可用 + 磁盘 ≥90%', primary: '切主库并只保人工只读会话', runbook: 'RB-03 / RB-04', owner: '事故指挥',
    order: [{ tier: '保命', action: '冻结全部自治与新写入，仅保留人工只读会话（不锁死数据，导出始终可用）' }, { tier: '保数据', action: '归档至冷存 + 校验最近备份可用性；未确认备份前不做破坏性清理' }, { tier: '保体验', action: '展示只读降级横幅与恢复预计时间，关闭索引增量更新' }],
    recover: '主库恢复且主从延迟 <1s、RPO 0，水位 <80% 且 24h 无反弹' },
  { id: 'model-down', name: '模型全端点不可用', primary: '停止新任务受理，长任务保存检查点', runbook: 'RB-06 / RB-11', owner: '模型网关负责人',
    order: [{ tier: '保命', action: '停止受理新模型调用，进行中任务在安全点保存检查点后暂停' }, { tier: '保数据', action: '工具结果与产物落盘并标记未完成，避免重启后重复副作用' }, { tier: '保体验', action: '显式提示「模型不可用（非静默降级）」，给出恢复后自动续跑入口' }],
    recover: '至少 2 个端点错误率 <1% 且能力位校验通过，任务可从检查点续跑' },
  { id: 'offline-24h', name: '断网 24h', primary: '切离线模式并冻结一切外发', runbook: 'RB-01', owner: 'SRE 值班',
    order: [{ tier: '保命', action: '外发（Git 推送 / Webhook / IM 回调）全部冻结并排队' }, { tier: '保数据', action: '本地事件持续写入，导出与备份走本地通路；队列表标记重放顺序' }, { tier: '保体验', action: '仅本地能力开放（检索 / 编辑 / 校验），远端能力置灰并说明原因' }],
    recover: '连通性恢复且外发队列重放无重复副作用，审计链校验通过' },
  { id: 'long-task', name: '超长任务 >7 天', primary: '拆分检查点并强制人工确认继续', runbook: 'RB-05', owner: '平台负责人',
    order: [{ tier: '保命', action: '达 7 天阈值时在安全点暂停，避免无人值守无限自治消耗' }, { tier: '保数据', action: '检查点与产物做内容寻址快照，保证可恢复且可去重' }, { tier: '保体验', action: '提供「继续 / 拆分 / 终止」三选项并展示剩余预算与预计耗时' }],
    recover: '预算与并发回到基线，任务被拆分或显式确认继续（确认记录入审计）' },
  { id: 'clock-drift', name: '时钟漂移 >5s', primary: '停止签发凭证与签名校验', runbook: 'RB-09', owner: '安全值班',
    order: [{ tier: '保命', action: '暂停签发新令牌与签名（漂移会导致验签失败与重放保护失效）' }, { tier: '保数据', action: '审计时间线改用单调时钟序列号标注，避免时间线错乱不可复核' }, { tier: '保体验', action: '已签发凭证在宽限窗口内继续可用，到期前提示重新登录' }],
    recover: 'NTP 校准后漂移 <100ms，验签与重放保护恢复到基线' },
  { id: 'malicious-repo', name: '恶意仓库或巨型单文件', primary: '隔离工作区并阻断外发', runbook: 'RB-07', owner: '沙箱负责人',
    order: [{ tier: '保命', action: '隔离仓库工作区（禁网 + 只读挂载），阻断一切外发与凭证读取' }, { tier: '保数据', action: '保留取证快照与哈希清单，隔离而非删除（便于事后审计）' }, { tier: '保体验', action: '同租户其它会话保持可用，仅对受影响仓库展示隔离原因与申诉路径' }],
    recover: '取证完成且威胁判定为误报或已处置，隔离解除后扫描无残留' },
  { id: 'tenant-burn', name: '租户级异常消耗', primary: '限流并冻结该租户自治任务', runbook: 'RB-08', owner: '成本负责人',
    order: [{ tier: '保命', action: '对该租户限流至预算速率，冻结自治任务（人工会话保留）' }, { tier: '保数据', action: '归因快照留存（六维 + 缓存单列），保证事后可解释与可对账' }, { tier: '保体验', action: '给出「为什么被限流」的可解释提示与临时提额申请入口' }],
    recover: '六维归因定位到具体任务/团队/模型并产出改进项，成本回到基线 ×1.2 内' },
];

const pickedId = ref(SCENARIOS[0].id);
const appliedId = ref('');
const scenario = computed(() => SCENARIOS.find((s) => s.id === pickedId.value) ?? SCENARIOS[0]);
const applied = computed(() => SCENARIOS.find((s) => s.id === appliedId.value) ?? null);
const columns = [
  { colKey: 'name', title: '组合场景', width: 220 },
  { colKey: 'primary', title: '首要动作', width: 280 },
  { colKey: 'runbook', title: '关联 Runbook', width: 130 },
  { colKey: 'owner', title: '指挥角色' },
];

/** 一键降级：按「保命 → 保数据 → 保体验」顺序执行，禁止跳级 */
function applyDegrade(): void {
  appliedId.value = pickedId.value;
  MessagePlugin.warning(`已对「${scenario.value.name}」执行降级：顺序 ${scenario.value.order.map((o) => o.tier).join(' → ')}；解除需按恢复判据复核`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = SCENARIOS.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="极端组合场景"
      desc="7 类组合场景：数据库不可用 + 磁盘 ≥90% / 模型全端点不可用 / 断网 24h / 超长任务 >7 天 / 时钟漂移 >5s / 恶意仓库或巨型单文件 / 租户级异常消耗。"
      volume="卷 32"
      manifest="G5-04"
      cli="oc ops degrade apply --scenario db+disk --order readonly,stop-index,stop-autonomy"
      :status="[{ label: '降级顺序不可跳级', theme: 'danger' }]"
    >
      <template #actions>
        <Popconfirm
          theme="danger"
          :content="`对「${scenario.name}」执行一键降级：按 保命 → 保数据 → 保体验 顺序执行（阻断高成本写入 / 冻结自治任务 / 冻结一切外发）。影响面：该场景下新任务被阻断，人工只读会话保留；可逆：按恢复判据复核后由 ${scenario.owner} 解除，解除动作入审计。`"
          @confirm="applyDegrade"
        >
          <Button size="small" theme="danger" variant="outline">一键降级</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有组合场景预案"
      empty-desc="多故障并发时无法临场决策；请先补 RB-12 的七类预案并演练其中至少两类。"
      empty-action="生成 RB-12 预案骨架"
      example-task="补充「数据库不可用 + 磁盘 ≥90%」的降级顺序与恢复判据"
      what="预案加载失败"
      why="Runbook 服务返回 500，端上不展示不完整预案（避免按残缺顺序执行）"
      how="可重试；紧急情况请直接使用 CLI 与值班手册中的最小降级集"
      trace-id="trace-extreme-2b6ac9"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="组合场景" :value="SCENARIOS.length" unit="类" format="raw" icon="error" />
        <StatCard label="当前选中" :value="scenario.name" format="raw" icon="flag" :hint="`指挥角色：${scenario.owner}`" />
        <StatCard label="降级层级" :value="scenario.order.length" unit="级" format="raw" icon="layers" hint="保命 → 保数据 → 保体验" />
        <StatCard label="已执行降级" :value="applied ? 1 : 0" unit="个场景" format="raw" icon="lock" :lower-is-better="true" hint="解除需满足恢复判据并复核" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">七类组合场景（点击行切换预案）</div>
        <Table :data="SCENARIOS" :columns="columns" row-key="id" size="small" hover @row-click="(ctx: { row: unknown }) => (pickedId = (ctx.row as { id: string }).id)">
          <template #name="{ row }">
            <Tag size="small" :theme="row.id === pickedId ? 'danger' : 'default'" variant="light-outline">{{ row.name }}</Tag>
          </template>
          <template #owner="{ row }"><span class="oc-muted">{{ row.owner }}</span></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">降级顺序（禁止跳级）</div>
          <div class="oc-stack">
            <div v-for="o in scenario.order" :key="o.tier" class="oc-flex oc-flex--wrap" style="gap: 8px">
              <Tag size="small" :theme="o.tier === '保命' ? 'danger' : o.tier === '保数据' ? 'warning' : 'primary'" variant="light-outline">{{ o.tier }}</Tag>
              <span class="oc-grow" style="font-size: 13px">{{ o.action }}</span>
            </div>
          </div>
          <div class="oc-state__hint">跳级（例如先降体验再保数据）会造成数据不可复核，属违规操作，审计会记录实际执行顺序。</div>
        </div>
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">首要动作与恢复判据</div>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'primary', label: '首要动作', value: scenario.primary, tag: { text: '先止损', theme: 'danger' } },
                { key: 'recover', label: '恢复判据', value: scenario.recover },
                { key: 'rb', label: '关联 Runbook', value: `${scenario.runbook}（步骤含验证命令与成功判据）` },
              ]"
            />
            <CliHint :command="`oc ops extreme verify --scenario ${scenario.id}`" label="校验恢复判据" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">执行结果反馈</div>
            <div v-if="applied" class="oc-stack" style="font-size: 13px">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag size="small" theme="danger" variant="light-outline">已降级</Tag>
                <span>{{ applied.name }}</span>
                <span class="oc-muted">{{ new Date().toLocaleString('zh-CN') }}</span>
              </div>
              <div v-for="o in applied.order" :key="o.tier" class="oc-muted" style="font-size: 12px">✔ {{ o.tier }}：{{ o.action }}</div>
              <div class="oc-muted" style="font-size: 12px">下一步：按恢复判据「{{ applied.recover }}」校验，由 {{ applied.owner }} 复核后解除；解除动作不可省审计。</div>
            </div>
            <div v-else class="oc-muted" style="font-size: 12px">尚未执行降级。点击页头「一键降级」按当前场景执行（Popconfirm 会说明影响面与可逆性）。</div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
