<script setup lang="ts">
/**
 * 企业联邦（Q-09）：联邦目录 + 驻留约束路由 + 路由日志。
 * 溯源：卷 23 §4.10（D-A2A-10）/ §7（数据驻留）
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const fed = d.a2a.federation;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
/** 联邦目录 / 路由日志局部投影：ref 包装后校验与手动指定可即时刷新页面 */
const instances = ref(fed.instances);
const routingLog = ref(fed.routingLog);
const rejected = computed(() => routingLog.value.filter((l) => !l.residencyOk));
const unsignedDir = computed(() => instances.value.filter((i) => !i.directorySigned));
const latency = computed(() => instances.value.map((i) => ({ x: i.region, y: i.latencyMs })));

const verifyingDir = ref(false);
/** 目录签名校验结论（结果行，供页面即时展示） */
const dirCheck = ref<{ at: string; signed: number; total: number } | null>(null);
/** 最近一次手动指定路由的结论（结果行，供页面即时展示） */
const lastRoute = ref<{ taskId: string; to: string; ok: boolean; reason: string } | null>(null);

/** 校验收件目录签名：逐实例校验目录签名与哈希链，结论写回目录条目备注 */
function verifyDirectories() {
  verifyingDir.value = true;
  MessagePlugin.info('正在校验各实例的联邦目录签名与哈希链…');
  window.setTimeout(() => {
    const at = new Date().toLocaleString('zh-CN');
    let signed = 0;
    instances.value.forEach((i) => {
      if (i.directorySigned) {
        i.note = `目录签名校验通过（${at}）：哈希链一致，可承接生产路由`;
        signed += 1;
      } else {
        // 未签名目录校验不通过：仅允许预发租户使用，生产路由一律拒绝（不降级）
        i.note = `目录签名校验未通过（${at}）：目录未签名，仅允许预发租户使用`;
      }
    });
    dirCheck.value = { at, signed, total: instances.value.length };
    verifyingDir.value = false;
    MessagePlugin.success(`校验收件目录签名完成：${signed}/${instances.value.length} 个实例目录签名有效（哈希链一致）；${instances.value.length - signed} 个未签名仅限预发租户，生产路由一律拒绝`);
  }, 600);
}

const routeOpen = ref(false);
const routeTarget = ref(instances.value[0].id);
const routeTaskId = ref(routingLog.value[0].taskId);

/** 打开手动指定路由弹窗（任务号默认取最近一条路由日志，便于对照） */
function openRouteDialog() {
  routeOpen.value = true;
}

/** 应用手动指定路由：驻留约束与目录签名不可绕过，不满足即拒绝并写入路由日志 */
function applyManualRoute() {
  const target = instances.value.find((i) => i.id === routeTarget.value);
  if (!target) return;
  const taskId = routeTaskId.value.trim() || routingLog.value[0].taskId;
  const denials: string[] = [];
  if (!target.directorySigned) denials.push('目标目录未签名');
  if (target.routingPolicy === '仅灾备切换') denials.push('非灾备期不允许承接');
  if (target.routingPolicy === '禁止承接国内 A1 数据') denials.push('驻留约束不允许');
  const ok = denials.length === 0;
  const reason = ok ? '驻留与目录签名校验通过，已生效' : `拒绝：${denials.join(' / ')}（不降级路由）`;
  routingLog.value.unshift({
    at: new Date().toISOString(),
    taskId,
    from: 'fed-hz',
    to: target.id,
    reason: ok ? '手动指定路由（运维显式指定，驻留与目录签名校验通过）' : `拒绝：${denials.join(' / ')}（不降级路由）`,
    residencyOk: ok,
  });
  lastRoute.value = { taskId, to: `${target.name}（${target.region}）`, ok, reason };
  routeOpen.value = false;
  MessagePlugin[ok ? 'success' : 'warning'](
    ok
      ? `已手动指定路由：${taskId} → ${target.name}（${target.region}），驻留约束校验通过，已写入路由日志`
      : `手动指定路由被拒绝：${taskId} → ${target.name} —— ${denials.join(' / ')}；已记入路由日志（驻留拒绝不降级）`,
  );
}

onMounted(() => {
  setTimeout(() => { state.value = fed.instances.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="企业联邦"
      desc="多实例注册到联邦目录（能力 / 租户 / 区域）；请求按策略路由，数据驻留约束优先；跨实例任务可追踪（correlationId 贯穿）。"
      volume="卷 23"
      manifest="Q-09"
      cli="oc a2a federation list --with-residency --json"
      :status="[{ label: d.a2a.serviceSwitch[3].enabled ? '联邦已启用' : '联邦未启用（需企业许可）', theme: d.a2a.serviceSwitch[3].enabled ? 'success' : 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="openRouteDialog">手动指定路由</Button>
        <Button size="small" variant="outline" :loading="verifyingDir" @click="verifyDirectories">校验收件目录签名</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      missing-permission="a2a.federation.read"
      risk-level="R3"
      apply-path="联邦为实验能力：需企业许可 + 组织策略放行后申请 a2a.federation.read"
      empty-title="联邦未启用"
      empty-desc="当前实例为单实例模式；联邦需企业许可，且开启前必须完成驻留策略与路由规则评审。"
      empty-action="申请启用联邦"
      example-task="在预发启用联邦并演示一次跨实例任务（仅 A2/A3 级数据）"
      what="联邦目录加载失败"
      why="目录签名校验失败（预发节点目录未签名）或跨区网络不可达（深圳灾备实例 DEGRADED）"
      how="可重试；未签名目录仅允许预发租户使用，生产路由一律拒绝"
      trace-id="trace-a2a-fed-7c19"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="联邦实例" :value="instances.length" unit="个" :target="3" target-kind="min" icon="cloud" />
        <StatCard label="在线" :value="instances.filter((i) => i.status === 'ONLINE').length" unit="个" />
        <StatCard label="驻留拒绝" :value="rejected.length" unit="次" hint="不满足驻留约束直接拒绝，不降级路由" />
        <StatCard label="未签名目录" :value="unsignedDir.length" unit="个" icon="error" hint="未签名仅允许预发租户" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">联邦目录</div>
            <Tag v-if="dirCheck" size="small" :theme="dirCheck.signed === dirCheck.total ? 'success' : 'warning'" variant="light-outline">
              签名校验 {{ dirCheck.signed }}/{{ dirCheck.total }}（{{ dirCheck.at }}）
            </Tag>
          </div>
          <Table :data="instances" row-key="id" size="small">
            <template #name="{ row }">
              <div class="oc-flex" style="gap: 6px">
                <span>{{ row.name }}</span>
                <Tag size="small" :theme="row.directorySigned ? 'success' : 'warning'" variant="light-outline">{{ row.directorySigned ? '已签名' : '未签名' }}</Tag>
              </div>
            </template>
            <template #status="{ row }">
              <Tag size="small" :theme="row.status === 'ONLINE' ? 'success' : row.status === 'DEGRADED' ? 'warning' : 'danger'" variant="light-outline">{{ row.status }}</Tag>
            </template>
            <template #residencyConstraint="{ row }">
              <Tooltip :content="`路由策略：${row.routingPolicy}`"><span>{{ row.residencyConstraint }}</span></Tooltip>
            </template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">跨区延迟（按区域）</div>
          <OcChart type="bar" :series="[{ name: '延迟', points: latency }]" :height="180" unit="ms" :threshold="{ value: 150, label: '可接受上限 150ms' }" aria-label="跨区延迟" />
          <div class="oc-muted" style="font-size: 12px">
            驻留优先：A1 级数据仅允许 cn-hangzhou / cn-beijing；不满足时拒绝并告警（不允许降级到其他区域）。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-flex--between">
          <div class="oc-card__title" style="margin: 0">路由日志（含拒绝）</div>
          <CopyableId id="corr-fed-7731" label="复制 correlationId" />
        </div>
        <div v-if="lastRoute" class="oc-muted" style="font-size: 12px; margin-top: 6px">
          最近手动指定：{{ lastRoute.taskId }} → {{ lastRoute.to }}（{{ lastRoute.ok ? '驻留与目录签名校验通过，已生效' : lastRoute.reason }}）
        </div>
        <Table :data="routingLog" row-key="at" size="small">
          <template #from="{ row }"><span class="oc-mono">{{ row.from }} → {{ row.to }}</span></template>
          <template #residencyOk="{ row }">
            <Tag size="small" :theme="row.residencyOk ? 'success' : 'danger'" variant="light-outline">{{ row.residencyOk ? '驻留满足' : '驻留拒绝' }}</Tag>
          </template>
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
        </Table>
      </div>
    </StateShell>

    <Dialog
      v-model:visible="routeOpen"
      header="手动指定路由"
      width="540px"
      cancel-btn="取消"
      :confirm-btn="{ content: '应用路由', theme: 'primary' }"
      @confirm="applyManualRoute"
    >
      <div class="oc-stack" style="gap: 10px">
        <div class="oc-flex" style="gap: 8px; align-items: center">
          <span style="font-size: 13px; width: 76px">任务号</span>
          <Input v-model="routeTaskId" size="small" style="width: 220px" placeholder="a2a-1002" />
        </div>
        <div class="oc-flex" style="gap: 8px; align-items: center">
          <span style="font-size: 13px; width: 76px">目标实例</span>
          <Select
            v-model="routeTarget"
            size="small"
            style="width: 280px"
            :options="instances.map((i) => ({ label: `${i.name}（${i.region}）`, value: i.id }))"
          />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          手动指定受驻留约束与目录签名限制：不满足时直接拒绝并写入路由日志（不允许降级到其他区域）；来源实例为杭州主实例。
        </div>
      </div>
    </Dialog>
  </div>
</template>
