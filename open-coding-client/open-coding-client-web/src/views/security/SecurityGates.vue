<script setup lang="ts">
/**
 * 安全测试门禁（G3-10）：六层门禁（SAST / 依赖镜像 / 密钥泄漏 / DAST / 模糊 / 红队）+ 通过率。
 * 溯源：卷 30 D-SEC-7 / §4.4
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 门禁结果以响应式代理渲染：重跑后结果时间戳与统计卡需立即更新 */
const gates = ref(d.securityGates);
const failing = computed(() => gates.value.filter((g) => g.status !== 'PASS'));
const passRates = computed(() => gates.value.map((g) => ({ x: g.layer.slice(0, 6), y: g.passRatePct })));
const blocking = computed(() => gates.value.filter((g) => g.blocking));
const rerunning = ref(false);
const detailOpen = ref(false);

/** 重跑全部门禁：六层依次执行并刷新结果制品时间戳；FAIL 层维持「拒绝放行」（失败安全，不可跳过） */
function rerunGates() {
  if (rerunning.value) return;
  rerunning.value = true;
  const at = new Date().toISOString();
  window.setTimeout(() => {
    gates.value.forEach((g) => { g.lastRunAt = at; });
    rerunning.value = false;
    const pass = gates.value.filter((g) => g.status === 'PASS').length;
    const warn = gates.value.filter((g) => g.status === 'WARN').length;
    const fail = gates.value.filter((g) => g.status === 'FAIL').length;
    MessagePlugin.success(`门禁重跑完成：${gates.value.length} 层全部执行，通过 ${pass} 层 / WARN ${warn} 层 / FAIL ${fail} 层，结果制品时间已刷新为本次重跑；FAIL 层（${failing.value.filter((g) => g.status === 'FAIL').map((g) => g.layer).join('、')}）维持「拒绝放行」`);
  }, 700);
}

onMounted(() => {
  setTimeout(() => { state.value = gates.value.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="安全测试门禁"
      desc="六层门禁：SAST（含密钥扫描）→ 依赖镜像扫描 → 密钥泄漏检测（提交前）→ DAST → 模糊测试 → 红队；任一必过项失败即阻断发布。"
      volume="卷 30"
      manifest="G3-10"
      cli="oc sec gates --run all --fail-on-high"
      :status="[{ label: '阻断即拒绝放行', theme: 'danger' }, { label: '红队季度复核', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="rerunGates">重跑全部门禁</Button>
        <Button size="small" theme="primary" @click="detailOpen = true">查看失败明细</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="门禁未运行"
      empty-desc="未运行门禁不得发布；请在 CI 中接入六层扫描并保留结果制品。"
      empty-action="运行全部门禁"
      example-task="oc sec gates --run sast,secret-scan --fail-on high"
      what="门禁状态加载失败"
      why="扫描器不可用或制品被清理（结果制品保留期过期）"
      how="可重试；扫描不可用时按「拒绝」处理（失败安全），不允许跳过门禁发版"
      trace-id="trace-gates-3c81a0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="门禁层" :value="gates.length" unit="层" :target="6" target-kind="min" icon="secured" />
        <StatCard label="通过" :value="gates.filter((g) => g.status === 'PASS').length" unit="层" />
        <StatCard label="未通过" :value="failing.length" unit="层" :target="0" target-kind="max" icon="error" hint="含 WARN / FAIL" />
        <StatCard label="阻断型门禁" :value="blocking.length" unit="层" icon="lock" hint="必过项失败即阻断发布" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">各层通过率（%）</div>
          <OcChart type="bar" :series="[{ name: '通过率', points: passRates }]" :height="200" format="percent" :threshold="{ value: 95, label: '目标 ≥ 95%' }" aria-label="门禁通过率" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">未通过项（逐项原因）</div>
          <div v-for="g in failing" :key="g.layer" class="oc-card" style="box-shadow: none; margin-bottom: 6px">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" :theme="g.status === 'FAIL' ? 'danger' : 'warning'" variant="light-outline">{{ g.status }}</Tag>
              <b style="font-size: 12px">{{ g.layer }}</b>
              <span class="oc-muted">通过率 {{ g.passRatePct }}% · 发现 {{ g.findings }} 项</span>
            </div>
            <div class="oc-muted" style="font-size: 12px">{{ g.note }}</div>
          </div>
          <div class="oc-state__hint">
            负样本：依赖扫描 FAIL（CVE-2026-31890 高危）已阻断构建；DAST WARN 仅阻断发布（不阻断开发）。阻断级别可配但不可关闭。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">六层门禁明细（阻断点与阈值）</div>
          <div class="oc-flex" style="gap: 6px">
            <Tag v-if="rerunning" size="small" theme="warning" variant="light-outline">重跑中…（六层依次执行）</Tag>
            <CopyableId id="trace-gates-0912" label="复制 traceId" />
          </div>
        </div>
        <Table :data="gates" row-key="layer" size="small">
          <template #layer="{ row }"><b style="font-size: 12px">{{ row.layer }}</b></template>
          <template #tool="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.tool }}</span></template>
          <template #passRatePct="{ row }">
            <Tag size="small" :theme="row.passRatePct >= 95 ? 'success' : row.passRatePct >= 90 ? 'warning' : 'danger'" variant="light-outline">{{ row.passRatePct }}%</Tag>
          </template>
          <template #blocking="{ row }">
            <Tooltip :content="`阈值：${row.blockThreshold}`">
              <Tag size="small" :theme="row.blocking ? 'danger' : 'default'" variant="light-outline">{{ row.blocking ? '阻断发布' : '仅告警' }}</Tag>
            </Tooltip>
          </template>
          <template #lastRunAt="{ row }">{{ new Date(row.lastRunAt).toLocaleString('zh-CN') }}</template>
          <template #status="{ row }">
            <Tag size="small" :theme="row.status === 'PASS' ? 'success' : row.status === 'WARN' ? 'warning' : 'danger'" variant="light-outline">{{ row.status }}</Tag>
          </template>
        </Table>
      </div>
    </StateShell>

    <Dialog v-model:visible="detailOpen" header="未通过门禁失败明细" width="820px" :footer="false">
      <Table
        :data="failing"
        row-key="layer"
        size="small"
        :columns="[
          { colKey: 'layer', title: '门禁层', width: 190, cell: 'layer' },
          { colKey: 'status', title: '结论', width: 90, cell: 'status' },
          { colKey: 'passRatePct', title: '通过率', width: 90, cell: 'rate' },
          { colKey: 'findings', title: '发现', width: 80, cell: 'findings' },
          { colKey: 'blockThreshold', title: '阻断阈值', width: 190 },
          { colKey: 'note', title: '失败原因与处置' },
        ]"
      >
        <template #layer="{ row }"><b style="font-size: 12px">{{ row.layer }}</b></template>
        <template #status="{ row }">
          <Tag size="small" :theme="row.status === 'FAIL' ? 'danger' : 'warning'" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #rate="{ row }">{{ row.passRatePct }}%（最近运行 {{ new Date(row.lastRunAt).toLocaleString('zh-CN') }}）</template>
        <template #findings="{ row }">{{ row.findings }} 项</template>
      </Table>
      <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
        明细来自本页门禁结果：FAIL 层阻断发布（失败安全，不可跳过），WARN 层仅阻断发布不阻断开发；修复后需重跑并保留结果制品。
      </div>
    </Dialog>
  </div>
</template>
