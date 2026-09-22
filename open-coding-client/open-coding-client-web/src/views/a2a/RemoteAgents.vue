<script setup lang="ts">
/**
 * 远程 Agent（Q-08）：注册与调用 + 出站 DLP 提示 + 「未验证」产出标记。
 * 溯源：卷 23 §4.3（RemoteAgent）/ D-A2A-6
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 注册清单局部投影：ref 包装后同步 / 注册 / 干跑可即时刷新表格、统计卡与详情 */
const agents = ref(d.a2a.remoteAgents);
const selectedId = ref(d.a2a.remoteAgents[0].id);
const selected = computed(() => agents.value.find((a) => a.id === selectedId.value) ?? agents.value[0]);
const trustTheme: Record<string, 'success' | 'warning' | 'danger'> = { 可信: 'success', 需审批: 'warning', 不可信: 'danger' };
const blocked = computed(() => agents.value.filter((a) => a.dlpStatus === 'BLOCKED'));
const avgFailureRate = computed(() => Number((agents.value.reduce((a, b) => a + b.failureRatePct, 0) / agents.value.length).toFixed(1)));

const syncing = ref(false);
/** 同步目录：从联邦目录刷新注册元数据（可信 Agent 的观测失败率按最近窗口收敛；信任与 DLP 状态不由同步改写） */
function syncDirectory() {
  syncing.value = true;
  MessagePlugin.info('正在从联邦目录同步远程 Agent 注册元数据…');
  window.setTimeout(() => {
    const before = avgFailureRate.value;
    agents.value.forEach((a) => {
      // 目录返回最近 24h 观测失败率：可信 Agent 按窗口收敛重算（演示用确定性映射）
      if (a.trust === '可信') a.failureRatePct = Number((a.failureRatePct * 0.6).toFixed(1));
    });
    const after = avgFailureRate.value;
    syncing.value = false;
    MessagePlugin.success(`同步目录完成：${agents.value.length} 个远程 Agent 元数据已刷新，平均失败率 ${before}% → ${after}%；DLP 阻断与「未验证」产出标记保持不变`);
  }, 500);
}

const registering = ref(false);
/** 注册远程 Agent：以最小权限模板登记新端点并加入清单（产出默认未验证，可移除） */
function registerAgent() {
  if (agents.value.some((a) => a.id === 'ra-12')) {
    MessagePlugin.warning('合规扫描 Agent（ra-12）已在注册清单中，请勿重复注册；如需重登记请先移除原条目');
    return;
  }
  registering.value = true;
  MessagePlugin.info('正在注册远程 Agent：校验端点可达性与出站白名单…');
  window.setTimeout(() => {
    agents.value.push({
      id: 'ra-12',
      name: '合规扫描 Agent（新注册）',
      endpoint: 'https://compliance.internal/a2a',
      protocol: 'A2A 风格',
      authRef: 'cred://compliance/mtls',
      capabilities: ['合规扫描'],
      trust: '需审批',
      budgetUsd: 10,
      dlpStatus: 'PASS',
      lastInvokedAt: new Date().toISOString(),
      invokeCount: 0,
      outputVerified: false,
      failureRatePct: 0,
      note: '新注册：待首次调用验证；产出默认标记「未验证」',
    });
    selectedId.value = 'ra-12';
    registering.value = false;
    MessagePlugin.success('已注册远程 Agent：合规扫描 Agent（A2A 风格 + mTLS，预算 $10）已加入清单并选中；产出默认标记「未验证」，复核后可调整信任级别（可移除）');
  }, 500);
}

const dryRunning = ref(false);
const dryResult = ref<string | null>(null);
/** 试调用（干跑）：出站白名单 + DLP 预检 + 能力协商，不产生真实调用；结论写回该记录备注并在页面上给出结果行 */
function dryRun() {
  const a = selected.value;
  if (a.dlpStatus === 'BLOCKED') {
    dryResult.value = `被拒绝：${a.name} 出站请求命中 DLP「数据外发」规则（干跑不豁免，需先完成复核）`;
    MessagePlugin.warning(`试调用（干跑）被拒绝：${a.name} 出站请求命中 DLP「数据外发」规则；请先完成 DLP 复核或收窄数据范围`);
    return;
  }
  dryRunning.value = true;
  MessagePlugin.info(`正在干跑 ${a.name}：校验出站白名单、DLP 预检与能力协商…`);
  window.setTimeout(() => {
    const trusted = a.trust === '可信';
    // 干跑不产生真实调用与计费：只刷新预检结论；不可信调用方的产出保持「未验证」（不因干跑而升级）
    if (!trusted) a.outputVerified = false;
    a.note = trusted
      ? `干跑通过：出站白名单匹配、DLP 0 命中、能力协商（${a.capabilities.join(' / ')}）`
      : `干跑通过但产出标记「未验证」（信任级别：${a.trust}），写入主分支前需人工确认`;
    dryResult.value = `干跑通过：${a.name}（${a.protocol}，信任=${a.trust}）出站白名单匹配、DLP 0 命中、能力协商 ${a.capabilities.join(' / ')}；未产生真实调用与计费`;
    dryRunning.value = false;
    MessagePlugin.success(`试调用（干跑）完成：${a.name} 预检通过，DLP 结论未变更（${a.dlpStatus}）${trusted ? '' : '，产出保持「未验证」'}；未产生真实调用与计费（invokeCount 保持 ${a.invokeCount}）`);
  }, 500);
}

onMounted(() => {
  setTimeout(() => { state.value = d.a2a.remoteAgents.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="远程 Agent"
      desc="反向集成：注册外部端点（协议 + 认证 + 能力）并以工具 / 子 Agent 形态暴露；出站受 DLP 与网络策略约束。"
      volume="卷 23"
      manifest="Q-08"
      cli="oc a2a remote list --with-dlp --json"
      :status="[{ label: '不可信产出标记「未验证」', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="syncing" @click="syncDirectory">同步目录</Button>
        <Button size="small" theme="primary" :loading="registering" @click="registerAgent">注册远程 Agent</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未注册远程 Agent"
      empty-desc="没有外部 Agent 可用；注册后将以 remote_agent.invoke 工具形式参与计划，并计入预算与审计。"
      empty-action="注册第一个远程 Agent"
      example-task="注册内部审计 Agent（mTLS + 只读能力）并跑一次代码审查"
      what="远程 Agent 列表加载失败"
      why="出站网络策略校验失败（目标域名不在白名单内）"
      how="可重试；或先在「沙箱 → 网络策略」申请加白（需说明用途）"
      trace-id="trace-a2a-remote-51b7"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="已注册" :value="agents.length" unit="个" :target="8" target-kind="min" icon="robot" />
        <StatCard label="出站被阻断" :value="blocked.length" unit="个" hint="命中 DLP「数据外发」规则" />
        <StatCard label="未验证产出" :value="agents.filter((a) => !a.outputVerified).length" unit="个" icon="error" />
        <StatCard label="平均失败率" :value="avgFailureRate" format="percent" :target="5" target-kind="max" icon="chart" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">注册清单（点击查看详情）</div>
        <Table :data="agents" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
          <template #name="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <span>{{ row.name }}</span>
              <Tag size="small" :theme="trustTheme[row.trust]" variant="light-outline">{{ row.trust }}</Tag>
            </div>
          </template>
          <template #protocol="{ row }"><Tag size="small" variant="outline">{{ row.protocol }}</Tag></template>
          <template #dlpStatus="{ row }">
            <Tag size="small" :theme="row.dlpStatus === 'PASS' ? 'success' : row.dlpStatus === 'WARN' ? 'warning' : 'danger'" variant="light-outline">{{ row.dlpStatus }}</Tag>
          </template>
          <template #outputVerified="{ row }">
            <Tag size="small" :theme="row.outputVerified ? 'success' : 'warning'" variant="light-outline">{{ row.outputVerified ? '已验证' : '未验证' }}</Tag>
          </template>
          <template #failureRatePct="{ row }">{{ row.failureRatePct.toFixed(1) }}%</template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">选中：{{ selected.name }}</div>
          <InfoGrid
            :items="[
              { key: 'endpoint', label: '端点', value: selected.endpoint, mono: true, span: 2 },
              { key: 'protocol', label: '协议类型', value: selected.protocol },
              { key: 'auth', label: '认证引用', value: selected.authRef, mono: true, secretRef: true },
              { key: 'budget', label: '预算上限', value: `$${selected.budgetUsd}`, hint: '参与本地预算信封' },
              { key: 'invoke', label: '调用次数', value: selected.invokeCount },
              { key: 'last', label: '最近调用', value: new Date(selected.lastInvokedAt).toLocaleString('zh-CN') },
              { key: 'failure', label: '失败率', value: `${selected.failureRatePct}%` },
              { key: 'note', label: '备注', value: selected.note ?? '—', span: 2 },
            ]"
          />
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Button size="small" variant="outline" :loading="dryRunning" @click="dryRun">试调用（干跑）</Button>
            <Tooltip content="调用外部 Agent 时，出站数据先过 DLP 与网络策略；不可信 Agent 的产出默认标记「未验证」，禁止直接写入主分支">
              <Button size="small" variant="outline" @click="router.push('/sandbox/network')">查看出站策略</Button>
            </Tooltip>
            <CopyableId id="corr-remote-9f31" label="复制 correlationId" />
          </div>
          <div v-if="dryResult" class="oc-state__hint" style="margin-top: 8px">干跑结论：{{ dryResult }}</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">出站 DLP 提示与阻断记录</div>
          <div class="oc-stack">
            <div v-for="r in d.dlpRules.filter((x) => x.kind === '数据外发' || x.kind === '工具限制')" :key="r.id" style="border-left: 3px solid var(--td-warning-color, #e37318); padding-left: 8px">
              <div class="oc-flex" style="gap: 6px">
                <Tag size="small" variant="outline">{{ r.kind }}</Tag>
                <b style="font-size: 12px">{{ r.name }}</b>
                <span class="oc-muted">命中 {{ r.hitCount }} 次</span>
              </div>
              <div v-for="b in r.blocked.slice(0, 1)" :key="b.at" class="oc-muted" style="font-size: 12px">
                {{ b.actor }} → {{ b.target }}：{{ b.sample }}（建议：{{ b.suggestion }}）
              </div>
            </div>
            <div class="oc-state__hint">
              负样本：{{ blocked[0].name }} 出站请求命中数据外发规则，已阻断并告警；产出不完整时按「部分成功」标记（不静默）。
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
