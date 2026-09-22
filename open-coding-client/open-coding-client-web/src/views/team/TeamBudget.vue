<script setup lang="ts">
/**
 * 团队预算与熔断（R-06）：总额 / 已用 / 剩余 + 动态回收 + 消耗率预警 + 熔断状态（恢复需人工确认）。
 * 溯源：卷 13 D-TEAM-6（团队预算 + 分配 + 回收 + 熔断）与 §4.5 成本与熔断。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Progress, Select, Slider, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { TeamMember } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const selected = ref('TEAM-migrate-02');
const reallocOpen = ref(false);
const keepForIdle = ref(2);
const breachOpen = ref(false);
const breachReason = ref('已定位 OOM 根因（worktree 内存上限 2Gi → 4Gi），并补跑批次 4 对拍验证。');

const team = computed(() => taskData.teams.find((t) => t.teamId === selected.value) ?? taskData.teams[0]);
const remaining = computed(() => Number((team.value.budget.total - team.value.budget.used).toFixed(2)));
const waterline = computed(() => Math.round((team.value.budget.used / Math.max(0.01, team.value.budget.total)) * 100));

const members = computed<TeamMember[]>(() => team.value.members);
const idleReclaimable = computed(() => Number(members.value.filter((m) => m.state === 'idle' || m.state === 'completed').reduce((a, b) => a + (b.quota - b.used), 0).toFixed(2)));

/** 消耗率趋势（按成员 used 反推的确定性序列） */
const burnSeries = computed(() => [{
  name: '消耗率（%）',
  points: members.value.map((m, i) => ({ x: m.name.split('·')[0], y: Math.round((m.used / Math.max(0.01, m.quota)) * 100) })),
}]);

const columns = [
  { colKey: 'name', title: '成员', width: 180 },
  { colKey: 'quota', title: '配额 / 已用', width: 200 },
  { colKey: 'state', title: '状态', width: 110 },
  { colKey: 'forecast', title: '预计超支', width: 200 },
];

function doReclaim() {
  const idle = members.value.filter((m) => m.state === 'idle' || m.state === 'completed');
  if (!idle.length) {
    MessagePlugin.error('没有可回收的成员配额：全部成员处于忙碌/阻塞状态（不做静默回收）');
    return;
  }
  reallocOpen.value = false;
  MessagePlugin.success(`已回收 $${idleReclaimable.value} 回团队池（保留 $${keepForIdle.value} 给闲置成员的恢复余量）`);
}

function recover() {
  if (!breachReason.value.trim()) {
    MessagePlugin.error('恢复理由必填：熔断恢复必须留痕');
    return;
  }
  team.value.budget.used = Math.max(0, Number((team.value.budget.used - 2).toFixed(2)));
  breachOpen.value = false;
  MessagePlugin.success('团队熔断已人工恢复：追加预算 $2 并清零失败计数，下一步 Tick 恢复推进');
}

onMounted(() => {
  window.setTimeout(() => { state.value = team.value ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="团队预算与熔断" volume="卷 13" manifest="R-06" cli="oc team budget TEAM-migrate-02 --reclaim-idle --show-burn"
      desc="团队预算是硬约束：单成员超限暂停该成员任务，团队超限整体暂停并汇报；耗尽后熔断，恢复必须人工确认。闲置成员配额可动态回收。"
      :status="[{ label: `水位 ${waterline}%`, theme: waterline > 80 ? 'danger' : 'success' }, { label: '硬约束', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="reallocOpen = true">动态回收配额</Button>
        <Popconfirm content="追加预算会修改团队硬上限并记录审批人；追加后仍受企业配额上限约束。" theme="warning" @confirm="MessagePlugin.info('已提交追加预算申请（待审批）')">
          <Button size="small" theme="primary">申请追加预算</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">团队：</span>
        <Select v-model="selected" size="small" style="width: 300px" :options="taskData.teams.map((t) => ({ label: `${t.name}（已用 $${t.budget.used} / $${t.budget.total}）`, value: t.teamId }))" />
        <Tag size="small" variant="outline">归属会话：{{ team.sessionRef }}</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--4" style="margin-bottom: 12px">
      <StatCard label="总预算" :value="team.budget.total" format="cost" icon="discount" />
      <StatCard label="已用" :value="team.budget.used" format="cost" icon="chart" :target="team.budget.total" target-kind="max" :lower-is-better="true" />
      <StatCard label="剩余" :value="remaining" format="cost" icon="check" :lower-is-better="false" />
      <StatCard label="可回收闲置配额" :value="idleReclaimable" format="cost" icon="refresh" hint="闲置/已完成成员未用配额" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有团队预算" empty-desc="团队尚未申请预算信封；无预算团队不可启动。" empty-action="申请预算"
      example-task="为 5 人团队申请 $48 硬上限"
      what="预算面板加载失败" why="预算账本与配额分配不一致（回收后未落账）"
      how="可重试；系统会以账本为准重建配额视图并标注差异" trace-id="trace-4f01ba7c"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已提交预算申请')"
    >
      <div class="oc-stack">
        <div class="oc-card" :style="waterline > 90 ? { borderColor: 'var(--oc-sev-error)' } : undefined">
          <div class="oc-flex--between">
            <div class="oc-card__title">水位与预算信封</div>
            <Tag size="small" :theme="waterline > 90 ? 'danger' : waterline > 80 ? 'warning' : 'success'" variant="light-outline">
              {{ waterline > 90 ? '已熔断' : waterline > 80 ? '预警（≥80%）' : '正常' }}
            </Tag>
          </div>
          <Progress :percentage="Math.min(100, waterline)" :status="waterline > 80 ? 'warning' : 'success'" />
          <InfoGrid :columns="3" :items="[
            { key: 'total', label: '硬上限', value: `$${team.budget.total}` },
            { key: 'used', label: '已用', value: `$${team.budget.used}` },
            { key: 'left', label: '剩余', value: `$${remaining}` },
          ]" />
        </div>

        <div class="oc-card">
          <div class="oc-card__title">消耗率（按成员）</div>
          <OcChart type="bar" :series="burnSeries" :height="200" format="percent" :threshold="{ value: 80, label: '80% 预警线', kind: 'max' }" aria-label="成员消耗率" />
        </div>

        <div class="oc-card">
          <div class="oc-card__title">熔断状态（恢复需人工确认）</div>
          <div v-if="waterline > 90" class="oc-card" style="border-color: var(--oc-sev-error)">
            <div class="oc-flex" style="gap: 6px">
              <OcIcon name="error" size="14px" color="var(--oc-sev-error)" />
              <b>团队预算熔断（open）</b>
              <Tag size="small" theme="danger" variant="light-outline">全部成员已暂停</Tag>
            </div>
            <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">
              触发原因：已用 ${{ team.budget.used }} / ${{ team.budget.total }}，超过 90% 阈值且失败次数达 3 次。恢复方式：追加预算或缩小范围后人工确认。
            </div>
            <Button size="small" theme="primary" variant="outline" style="margin-top: 6px" @click="breachOpen = true">人工确认恢复</Button>
          </div>
          <div v-else class="oc-flex" style="gap: 6px">
            <OcIcon name="check" size="14px" color="var(--td-success-color)" />
            <span style="font-size: 12px">熔断 closed：当前水位 {{ waterline }}%，未触发熔断条件。</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">成员配额</div>
          <Table :data="members" row-key="memberId" size="small" :pagination="undefined" :columns="columns">
            <template #quota="{ row }">
              <div class="oc-flex" style="gap: 6px">
                <span style="font-size: 12px">${{ row.used }} / ${{ row.quota }}</span>
                <Progress :percentage="Math.round((row.used / row.quota) * 100)" size="small" style="width: 60px" :status="row.used / row.quota > 0.9 ? 'warning' : 'success'" />
              </div>
            </template>
            <template #state="{ row }"><Tag size="small" variant="light-outline">{{ row.state }}</Tag></template>
            <template #forecast="{ row }">
              <Tag size="small" :theme="row.used / row.quota > 0.9 ? 'danger' : 'default'" variant="outline">
                {{ row.used / row.quota > 0.9 ? `按历史单位成本预计 +$${(row.quota * 0.25).toFixed(2)} 超支` : '预计不超支' }}
              </Tag>
            </template>
          </Table>
        </div>

        <div class="oc-flex" style="gap: 8px">
          <CliHint command="oc team budget TEAM-migrate-02 --reclaim-idle --keep 2" />
          <CopyableId id="trace-4f01ba7c" label="复制 traceId" />
        </div>
      </div>

      <Dialog v-model:visible="reallocOpen" header="动态回收闲置配额" width="520px" :footer="false">
        <div class="oc-stack">
          <div class="oc-secondary" style="font-size: 12px">
            可回收总额：${{ idleReclaimable }}（idle / completed 成员的未用配额）。回收后成员配额下调，任务完成时仍可回池。
          </div>
          <div class="oc-muted" style="font-size: 12px">为闲置成员保留恢复余量（USD）：${{ keepForIdle }}</div>
          <Slider v-model="keepForIdle" :min="0" :max="6" :step="1" />
          <div class="oc-flex" style="gap: 8px">
            <Popconfirm content="回收会立即下调闲置成员配额；忙碌成员配额不受影响（避免打断进行中的任务）。" theme="warning" @confirm="doReclaim">
              <Button size="small" theme="primary">确认回收</Button>
            </Popconfirm>
            <Button size="small" variant="outline" @click="reallocOpen = false">取消</Button>
          </div>
        </div>
      </Dialog>

      <Dialog v-model:visible="breachOpen" header="人工确认恢复团队熔断" width="540px" :footer="false">
        <div class="oc-stack">
          <Textarea v-model="breachReason" :autosize="{ minRows: 3 }" placeholder="根因与修复证据（必填）" />
          <div class="oc-flex" style="gap: 8px">
            <Popconfirm content="恢复会追加 $2 预算并重新排期；若根因未修复会再次熔断（自动恢复被禁止）。" theme="warning" @confirm="recover">
              <Button size="small" theme="primary">确认恢复</Button>
            </Popconfirm>
            <Button size="small" variant="outline" @click="breachOpen = false">取消</Button>
          </div>
        </div>
      </Dialog>
    </StateShell>
  </div>
</template>
