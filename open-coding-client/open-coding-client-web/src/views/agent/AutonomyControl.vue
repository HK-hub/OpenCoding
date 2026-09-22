<script setup lang="ts">
/**
 * A-06 自主度控制：建议 / 协作 / 自治三档 + 可随时收回 + 与权限模式对齐。
 * 语义分离：权限模式决定「能不能做」，自主度决定「做之前问不问」——两者独立，收回自主度不改变已有权限。
 * 溯源：卷 12 D-AG-10 / BUILD-MANIFEST A-06
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const data = knowledgeData.agent;

const state = ref<UiStateKind>('LOADING');
const tier = ref<'propose' | 'collaborate' | 'autonomous'>(ui.autonomy);
const revokeReason = ref('');

const TIERS = [
  {
    key: 'propose' as const,
    title: '建议（每步确认）',
    desc: 'Agent 只提出动作与理由，所有写操作与执行都需人类确认后才执行。',
    fit: '首次使用、不可逆操作、生产环境变更',
    confirm: '每个写/执行动作都确认',
  },
  {
    key: 'collaborate' as const,
    title: '协作（风险动作确认）',
    desc: '默认档：低风险读操作自动执行；写文件、执行命令、外发等风险动作按风险级确认。',
    fit: '日常编码、受控工作区',
    confirm: 'R1 及以上风险确认；R0 自动',
  },
  {
    key: 'autonomous' as const,
    title: '自治（预授权边界内自动）',
    desc: '在预授权边界（工具白名单 + 路径围栏 + 风险上限）内自动执行；越界一律请求确认。',
    fit: '长任务、批量重构、离线批处理',
    confirm: '仅越界动作确认',
  },
];

/** 与权限模式对齐：自主度不提升权限，只改变交互前置确认 */
const ALIGNMENT = [
  { mode: 'readonly', ceiling: '仅 R0 只读', tierFit: '建议 / 协作', note: '自主度无法突破只读，写操作一律被拒绝' },
  { mode: 'plan', ceiling: '规划 + 只读', tierFit: '建议', note: '先出方案；执行需人类切换模式' },
  { mode: 'default', ceiling: 'R0–R2', tierFit: '协作 / 自治（白名单内）', note: '当前会话模式：风险动作确认，白名单内自动' },
  { mode: 'acceptEdits', ceiling: 'R0–R2 + 工作区写', tierFit: '协作 / 自治', note: '工作区内编辑免确认，工作区外仍确认' },
  { mode: 'autonomous', ceiling: 'R0–R3（白名单）', tierFit: '自治', note: '需预授权边界；出网仍受域名白名单约束' },
  { mode: 'yolo', ceiling: 'R0–R4', tierFit: '自治', note: '企业可禁用；破坏性动作仍有强制确认（不可关闭）' },
];

const INTERVENTIONS = [
  { kind: '即时插话（steer）', point: '下一个安全点', effect: '注入新指令，不丢失已有进展' },
  { kind: '暂停 / 接管', point: '安全点', effect: '暂停后可编辑计划或手动执行；继续时从该点恢复' },
  { kind: '审批（工具/动作级）', point: '动作执行前', effect: '按风险级与范围记忆决定是否再次询问' },
  { kind: '收回自主度', point: '立即', effect: '降档立即生效（进行中动作先走完安全点），权限不受影响' },
];

const autonomyRows = computed(() =>
  TIERS.map((t) => ({
    ...t,
    current: t.key === tier.value,
  })),
);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function setTier(next: 'propose' | 'collaborate' | 'autonomous') {
  tier.value = next;
  ui.autonomy = next;
  MessagePlugin.success(`自主度已切换为「${TIERS.find((t) => t.key === next)?.title}」（立即生效；权限模式不变）`);
}

function revoke() {
  tier.value = 'collaborate';
  ui.autonomy = 'collaborate';
  revokeReason.value = '用户收回自主：立即降为协作档，进行中的动作在当前安全点收尾，不再自动执行新的风险动作。';
  MessagePlugin.warning('已收回自主度：立即降为协作档（进行中动作安全点收尾）');
}

/** 导出自主度与权限模式快照（供审计）：档位、权限对齐与护栏上限取自本页状态与 Mock 数据 */
function exportSnapshot() {
  const filename = `oc-autonomy-snapshot-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  const current = TIERS.find((t) => t.key === tier.value);
  downloadJson(
    {
      autonomy: { tier: tier.value, title: current?.title, confirmPolicy: current?.confirm },
      permissionMode: ui.currentMode,
      alignment: ALIGNMENT,
      guard: {
        limits: data.guard.limits,
        used: data.guard.used,
        repeatedActions: data.guard.repeatedActions,
      },
    },
    filename,
  );
  MessagePlugin.success(`已导出自主度快照（${filename}）`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="自主度控制"
      desc="建议 / 协作 / 自治三档，按信任曲线渐进放开；任何时刻都能收回——收回只改交互前置确认，不改已有权限。"
      volume="卷 12"
      manifest="A-06"
      cli="oc agent autonomy set collaborate"
      :status="[{ label: `当前：${TIERS.find((t) => t.key === tier)?.title}`, theme: tier === 'autonomous' ? 'warning' : 'primary' }, { label: '可随时收回', theme: 'success' }]"
    >
      <template #actions>
        <Button
          v-for="t in TIERS"
          :key="t.key"
          size="small"
          :theme="tier === t.key ? 'primary' : 'default'"
          :variant="tier === t.key ? 'base' : 'outline'"
          @click="setTier(t.key)"
        >
          {{ t.title.split('（')[0] }}
        </Button>
        <Popconfirm theme="warning" content="收回自主度：立即降为协作档，进行中动作在当前安全点收尾。" @confirm="revoke">
          <Button size="small" theme="danger" variant="outline"><OcIcon name="logout" size="12px" /> 收回自主</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="当前档位" :value="TIERS.find((t) => t.key === tier)?.title.split('（')[0] ?? ''" format="raw" icon="user-circle" hint="与权限模式独立：自主度 ≠ 权限" />
      <StatCard label="需确认动作" :value="tier === 'propose' ? 100 : tier === 'collaborate' ? 42 : 8" unit="%" format="raw" icon="secured" hint="自治档仅越界动作需确认（预授权边界内自动）" />
      <StatCard label="越界请求（本轮）" :value="data.guard.repeatedActions.length" unit="次" icon="flag" :lower-is-better="true" hint="越界一律请求确认，不静默放宽" />
      <StatCard label="三重上限" :value="data.guard.limits.steps" unit="步" format="raw" icon="time" hint="上限与自主度叠加保护：自治不等于无限" />
    </div>

    <StateShell
      :state="state"
      stage="加载自主度设置…"
      empty-title="尚未设置自主度"
      empty-desc="未显式设置时使用默认档「协作」；可在会话中随时切换。"
      empty-action="使用默认（协作）"
      example-task="把长任务切到自治档并限定预授权边界"
      what="自主度设置加载失败"
      why="会话配置不可读（策略服务超时），无法确认预授权边界是否完整。"
      how="已按安全默认降为「建议」档；可重试恢复。"
      trace-id="trace-aut-40f1b7"
      @retry="state = 'NORMAL'"
      @empty-action="setTier('collaborate')"
    >
      <div class="oc-grid oc-grid--3">
        <div v-for="t in autonomyRows" :key="t.key" class="oc-card" :style="t.current ? 'border-color: var(--td-brand-color, #0052d9)' : ''">
          <h3 class="oc-card__title">
            {{ t.title }}
            <Tag v-if="t.current" size="small" theme="primary">当前档</Tag>
          </h3>
          <p class="oc-secondary" style="font-size: 13px; margin: 0 0 8px">{{ t.desc }}</p>
          <div class="oc-kv" style="font-size: 12px">
            <span class="oc-kv__k">适用</span><span>{{ t.fit }}</span>
            <span class="oc-kv__k">确认策略</span><span>{{ t.confirm }}</span>
          </div>
          <Button size="small" variant="outline" style="margin-top: 10px" :disabled="t.current" @click="setTier(t.key)">切换到该档</Button>
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            与权限模式对齐（自主度 ≠ 权限）
            <Tag size="small" variant="outline">术语：权限 ≠ 自主度</Tag>
          </h3>
          <Table
            :data="ALIGNMENT"
            :columns="[
              { colKey: 'mode', title: '权限模式', width: 120, cell: 'cell' },
              { colKey: 'ceiling', title: '可做范围（上限）', width: 170 },
              { colKey: 'tierFit', title: '适配自主度', width: 180 },
              { colKey: 'note', title: '说明', cell: 'cell' },
            ]"
            row-key="mode"
            size="small"
          >
            <template #cell="{ col, row }">
              <template v-if="col.colKey === 'mode'">
                <Tag size="small" :theme="row.mode === ui.currentMode ? 'primary' : 'default'" variant="light-outline">{{ row.mode }}</Tag>
              </template>
              <span v-else>{{ row[col.colKey] }}</span>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">介入点与收回语义</h3>
          <div v-for="i in INTERVENTIONS" :key="i.kind" class="oc-kv" style="font-size: 12px; margin-bottom: 6px">
            <span class="oc-kv__k">{{ i.kind }}</span>
            <span>生效点：{{ i.point }} · {{ i.effect }}</span>
          </div>
          <div v-if="revokeReason" class="oc-card" style="border-color: var(--oc-sev-warn); padding: 8px 10px">
            <div class="oc-flex" style="gap: 6px">
              <OcIcon name="flag" size="13px" color="var(--oc-sev-warn)" />
              <span style="font-size: 12px">{{ revokeReason }}</span>
            </div>
          </div>
          <div class="oc-divider" />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'principle', label: '产品原则', value: '渐进自主：建议 → 协作 → 自治，可随时收回（铁律 9）' },
              { key: 'irreversible', label: '不可关闭的确认', value: '破坏性动作（R4）与密钥访问（R5）即使自治档也强制确认' },
            ]"
          />
          <div class="oc-flex" style="gap: 8px; margin-top: 10px">
            <CliHint command="oc agent autonomy set autonomous --scope item-2f81-042" />
            <Button size="small" variant="text" @click="exportSnapshot">导出快照</Button>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
