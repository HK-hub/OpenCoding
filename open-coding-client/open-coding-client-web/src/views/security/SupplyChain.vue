<script setup lang="ts">
/**
 * 供应链安全（G3-04）：四类制品检查 + 失败动作与阻断点。
 * 溯源：卷 30 §4.4 / D-SEC-6
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
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
/** 制品校验数据以响应式代理渲染：重扫判定后计数、通过率与统计卡需立即更新 */
const artifacts = ref(d.supplyChain);
const values = computed(() => artifacts.value.map((s) => ({ name: s.kind, value: s.verified })));
const failedTotal = computed(() => artifacts.value.reduce((a, s) => a + s.failed, 0));
const totals = computed(() => artifacts.value.reduce((a, s) => a + s.total, 0));
const verifiedTotal = computed(() => artifacts.value.reduce((a, s) => a + s.verified, 0));
const passRate = computed(() => {
  const total = artifacts.value.reduce((a, s) => a + s.total, 0);
  const ok = artifacts.value.reduce((a, s) => a + s.verified, 0);
  return (ok / total) * 100;
});
const scanning = ref(false);
const blockOpen = ref(false);
/** 是否已执行过重扫（待复检项只判定一次，避免重复点击虚增计数） */
const rescanned = ref(false);
/** 阻断记录：取自各类制品的失败样本与阻断点（本页真实数据） */
const blockedRecords = computed(() => artifacts.value.map((a) => ({
  kind: a.kind,
  artifact: a.negativeSample.name,
  reason: a.negativeSample.reason,
  blockingPoint: a.blockingPoint,
  onFailure: a.onFailure,
  at: a.negativeSample.at,
})));

/** 重新扫描：判定待复检项并刷新扫描时间；失败制品维持阻断对应阶段（失败安全） */
function rescan() {
  if (scanning.value) return;
  scanning.value = true;
  const at = new Date().toISOString();
  window.setTimeout(() => {
    artifacts.value.forEach((a) => { a.lastScanAt = at; a.pending = 0; });
    if (!rescanned.value) {
      // 待复检项判定：依赖 2 项复检通过；插件/技能 1 项确认违规（新增失败并阻断装载）
      const dep = artifacts.value.find((a) => a.kind === '依赖');
      const plugin = artifacts.value.find((a) => a.kind === '插件/技能');
      if (dep) dep.verified += 2;
      if (plugin) plugin.failed += 1;
      rescanned.value = true;
    }
    scanning.value = false;
    MessagePlugin.success(`重新扫描完成：${artifacts.value.length} 类制品共 ${totals.value} 个，校验通过 ${verifiedTotal.value} 个、失败 ${failedTotal.value} 个，通过率 ${passRate.value.toFixed(1)}%；待复检项已判定（依赖 2 项通过、插件/技能 1 项确认违规并阻断装载）`);
  }, 600);
}

onMounted(() => {
  setTimeout(() => { state.value = d.supplyChain.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="供应链安全"
      desc="四类制品治理：依赖（锁文件 + CVE + 许可证）、镜像（签名 + 基础镜像白名单）、插件技能（签名 + 权限声明扫描）、模型制品（来源白名单 + 摘要校验）。"
      volume="卷 30"
      manifest="G3-04"
      cli="oc supply scan --all-artifacts --fail-on-high"
      :status="[{ label: '阻断即拒绝', theme: 'danger' }, { label: '私有源优先', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="rescan">{{ scanning ? '扫描中…' : '重新扫描' }}</Button>
        <Button size="small" theme="primary" @click="blockOpen = true">查看阻断记录</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有制品记录"
      empty-desc="未登记制品意味着无法校验来源与完整性；请至少配置依赖与镜像来源白名单。"
      empty-action="启用默认白名单"
      example-task="oc supply scan --kind dependency --lockfile package-lock.json"
      what="供应链扫描失败"
      why="扫描器不可用或私有源认证失败（凭据引用未授权）"
      how="可重试；扫描不可用时构建按「拒绝」处理（失败安全），不允许跳过扫描发版"
      trace-id="trace-supply-77a1c0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="制品总量" :value="totals" unit="个" icon="extension" />
        <StatCard label="校验通过率" :value="passRate" format="percent" :target="98" target-kind="min" />
        <StatCard label="失败制品" :value="failedTotal" unit="个" :target="0" target-kind="max" icon="error" hint="失败即阻断对应阶段" />
        <StatCard label="来源白名单" :value="'已启用'" format="raw" hint="官方 / 私有源优先；未知来源拒绝" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">四类制品校验分布</div>
          <OcChart type="donut" :values="values" :height="200" aria-label="制品校验分布" />
          <div class="oc-muted" style="font-size: 12px">统计口径：verified / total；failed 与 pending 单列（不静默计入通过）。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">失败动作与阻断点（逐类）</div>
          <Table :data="artifacts" row-key="kind" size="small" :columns="[
            { colKey: 'kind', title: '制品类型', width: 110 },
            { colKey: 'onFailure', title: '失败动作', width: 170 },
            { colKey: 'blockingPoint', title: '阻断点' },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">检查项清单与负样本</div>
        <Table :data="artifacts" row-key="kind" size="small">
          <template #checks="{ row }">
            <span class="oc-flex oc-flex--wrap" style="gap: 4px">
              <Tag v-for="c in row.checks" :key="c" size="small" variant="outline">{{ c }}</Tag>
            </span>
          </template>
          <template #negativeSample="{ row }">
            <div>
              <div class="oc-flex" style="gap: 6px">
                <Tag size="small" theme="danger" variant="light-outline">阻断</Tag>
                <span class="oc-mono" style="font-size: 11px">{{ row.negativeSample.name }}</span>
              </div>
              <div class="oc-muted" style="font-size: 12px">{{ row.negativeSample.reason }} → {{ row.negativeSample.action }}</div>
            </div>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          air-gapped 形态：私有源 / 离线镜像包为唯一来源；公共源禁用；介质包导入需签名校验。
        </div>
        <div v-if="scanning" class="oc-state__hint" style="margin-top: 6px">扫描中…（解析锁文件、来源白名单与摘要校验，待复检项将在本轮判定）</div>
        <CopyableId id="trace-supply-0912" label="复制 traceId" />
      </div>
    </StateShell>

    <Dialog v-model:visible="blockOpen" header="供应链阻断记录" width="860px" :footer="false">
      <Table
        :data="blockedRecords"
        row-key="kind"
        size="small"
        :columns="[
          { colKey: 'kind', title: '制品类型', width: 100 },
          { colKey: 'artifact', title: '被阻断制品', width: 210, cell: 'artifact' },
          { colKey: 'reason', title: '阻断原因', ellipsis: true },
          { colKey: 'blockingPoint', title: '阻断点', width: 160 },
          { colKey: 'onFailure', title: '失败动作', width: 160 },
        ]"
      >
        <template #artifact="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.artifact }}</span></template>
      </Table>
      <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
        记录来自本页四类制品的失败样本与阻断点：阻断即拒绝（不回退放行），修复后需重新扫描并保留结果制品。
      </div>
    </Dialog>
  </div>
</template>
