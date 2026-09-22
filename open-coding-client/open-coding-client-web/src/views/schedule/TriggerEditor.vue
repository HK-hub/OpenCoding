<script setup lang="ts">
/**
 * 触发器编辑器（X-08）：五类触发器（时间/事件/条件/手动/组合 AND-OR）+ 时区 + 去抖节流 + 幂等键规则预览。
 * 溯源：卷 15 D-SCH-1 五类触发器统一模型 / D-SCH-3 并发与幂等。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, RadioGroup, RadioButton, Select, Switch, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { TriggerKind } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const preview = ref('');

const KIND_META: Record<TriggerKind, { label: string; placeholder: string; why: string }> = {
  time: { label: '时间', placeholder: '0 2 * * 1-5', why: '按固定节奏运行（巡检、报表、夜跑回归），时区必须显式声明。' },
  event: { label: '事件', placeholder: 'git.push:branch=main', why: '由外部事实驱动（提交、PR 更新、工单变更），避免空跑。' },
  condition: { label: '条件', placeholder: 'dependency.new_version_available == true', why: '状态满足才触发（如「依赖有新版」「失败率超阈值」），需定义求值频率。' },
  manual: { label: '手动', placeholder: 'oc schedule run <id>', why: '一键/命令触发，用于演练与补救；仍走预授权校验。' },
  composite: { label: '组合', placeholder: 'AND(时间窗口, 事件)', why: '把多个条件组合成精确触发（AND 收敛、OR 放宽），并统一去抖。' },
};

const t = reactive({
  kind: 'composite' as TriggerKind,
  spec: 'AND(时间窗口, 事件)',
  timezone: 'Asia/Shanghai',
  debounceMs: 60_000,
  throttleMs: 900_000,
  idempotencyKeyRule: '{scheduleId}:{eventId}',
  combinator: 'AND' as 'AND' | 'OR',
  children: [
    { id: 'c1', kind: 'time' as TriggerKind, spec: '0 20 * * *' },
    { id: 'c2', kind: 'event' as TriggerKind, spec: 'ci.pipeline.failed' },
  ],
});

const triggers = computed<{ id: string; kind: TriggerKind; spec: string; enabled: boolean }[]>(() => [
  { id: 'TR-1', kind: 'time', spec: '0 2 * * 1-5', enabled: true },
  { id: 'TR-2', kind: 'event', spec: 'git.push:branch=main', enabled: true },
  { id: 'TR-4', kind: 'manual', spec: 'oc schedule run <id>', enabled: true },
  { id: 'TR-5', kind: 'composite', spec: 'AND(0 20 * * *, ci.pipeline.failed)', enabled: true },
]);

const keyPreview = computed(() => t.idempotencyKeyRule
  .replace('{scheduleId}', 'SCH-04')
  .replace('{eventId}', 'evt-88213')
  .replace('{cronWindow}', '2026-09-22T20:00')
  .replace('{commitSha}', 'a3f19c2')
  .replace('{workspace}', 'refactor-batch')
  .replace('{prNumber}', '4127'));

/**
 * 近 30 天触发历史（只读聚合）：按触发器给出触发与幂等去重次数。
 * 说明：演示环境按稳定分布给出计数；本面板只读，不会触发任何运行。
 */
const historyOpen = ref(false);
const historyLoadedAt = ref('');
const historyRows = computed(() =>
  triggers.value.map((x, i) => ({
    id: x.id,
    spec: x.spec,
    label: KIND_META[x.kind].label,
    fired: 8 + i * 13,
    deduped: i % 2 === 0 ? 0 : 3 + i,
    lastAt: new Date(Date.now() - (i + 1) * 3 * 3600_000).toLocaleString('zh-CN'),
  })),
);
const historyTotals = computed(() => historyRows.value.reduce((a, b) => ({ fired: a.fired + b.fired, deduped: a.deduped + b.deduped }), { fired: 0, deduped: 0 }));

/** 打开触发历史：记录加载时间并就地展示各触发器的触发 / 去重次数（只读，不产生触发） */
function openHistory() {
  historyLoadedAt.value = new Date().toLocaleString('zh-CN');
  historyOpen.value = true;
}

function addChild() {
  t.children.push({ id: `c${t.children.length + 1}`, kind: 'event' as TriggerKind, spec: '' });
}

function check() {
  if (t.kind === 'composite' && t.children.length < 2) {
    MessagePlugin.error('组合触发器至少需要 2 个子触发器（AND/OR 才有意义）');
    return;
  }
  if (t.kind !== 'manual' && !t.spec.trim() && t.kind !== 'composite') {
    MessagePlugin.error(`${KIND_META[t.kind].label}触发器必须填写表达式（不允许空表达式静默不触发）`);
    return;
  }
  if (t.throttleMs < t.debounceMs) {
    MessagePlugin.error('节流窗口必须 ≥ 去抖窗口：否则去抖后的重复仍会被放行');
    return;
  }
  preview.value = keyPreview.value;
  MessagePlugin.success(`触发器校验通过；幂等键预览：${keyPreview.value}`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = 'NORMAL'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="触发器编辑器" volume="卷 15" manifest="X-08" cli="oc schedule trigger edit SCH-04 --preview-key"
      desc="五类触发器：时间（cron/间隔）、事件（提交/PR/工单/Webhook）、条件（表达式）、手动（一键）、组合（AND/OR + 去抖节流）。幂等键规则实时预览。"
      :status="[{ label: `当前：${KIND_META[t.kind].label}`, theme: 'primary' }, { label: '幂等去重', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="openHistory">触发历史</Button>
        <Popconfirm content="保存触发器会替换计划当前触发器集合；进行中的运行不受影响，但下次排期按新规则执行。" theme="warning" @confirm="check">
          <Button size="small" theme="primary">校验并保存</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未配置触发器" empty-desc="没有触发器的计划永远不会运行（不会隐式默认 cron）。" empty-action="添加时间触发器"
      example-task="每工作日 02:00 触发依赖巡检"
      what="触发器加载失败" why="cron 解析器版本与计划保存的表达式方言不一致"
      how="可重试；或改用「事件」触发器绕开方言差异" trace-id="trace-1f6b09d3"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已添加时间触发器默认值 0 2 * * *')"
    >
      <div class="oc-grid" style="grid-template-columns: minmax(0, 1fr) 320px; gap: 10px">
        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">触发器类型</div>
            <RadioGroup v-model="t.kind" variant="default-filled" size="small">
              <RadioButton v-for="k in (['time', 'event', 'condition', 'manual', 'composite'] as TriggerKind[])" :key="k" :value="k">{{ KIND_META[k].label }}</RadioButton>
            </RadioGroup>
            <div class="oc-card" style="margin-top: 8px; border-left: 3px solid var(--td-brand-color)">
              <div class="oc-flex" style="gap: 6px">
                <Tag size="small" theme="primary" variant="light-outline">为什么需要</Tag>
                <span class="oc-secondary" style="font-size: 12px">{{ KIND_META[t.kind].why }}</span>
              </div>
            </div>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">表达式与时区</div>
            <div class="oc-flex oc-flex--wrap" style="gap: 8px">
              <Input v-model="t.spec" size="small" class="oc-mono" style="flex: 1; min-width: 240px" :placeholder="KIND_META[t.kind].placeholder" />
              <Select v-model="t.timezone" size="small" style="width: 180px" :options="[
                { label: 'Asia/Shanghai（默认用户时区）', value: 'Asia/Shanghai' },
                { label: 'UTC', value: 'UTC' }, { label: 'Asia/Tokyo', value: 'Asia/Tokyo' }, { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
              ]" />
            </div>
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
              时区影响 cron 求值；跨时区团队务必显式声明，避免「夜里跑成白天」。
            </div>
          </div>

          <!-- 组合触发器：AND / OR 子触发器 -->
          <div v-if="t.kind === 'composite'" class="oc-card">
            <div class="oc-flex--between">
              <div class="oc-card__title">组合逻辑（至少 2 个子触发器）</div>
              <RadioGroup v-model="t.combinator" variant="default-filled" size="small">
                <RadioButton value="AND">AND（全部满足）</RadioButton>
                <RadioButton value="OR">OR（任一满足）</RadioButton>
              </RadioGroup>
            </div>
            <div v-for="c in t.children" :key="c.id" class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 6px">
              <Tag size="small" variant="outline" class="oc-mono">{{ c.id }}</Tag>
              <Select v-model="c.kind" size="small" style="width: 130px" :options="[
                { label: '时间', value: 'time' }, { label: '事件', value: 'event' }, { label: '条件', value: 'condition' },
              ]" />
              <Input v-model="c.spec" size="small" class="oc-mono" style="flex: 1; min-width: 200px" :placeholder="KIND_META[c.kind].placeholder" />
              <Button size="small" variant="text" theme="danger" @click="t.children.splice(t.children.indexOf(c), 1)">删除</Button>
            </div>
            <Button size="small" variant="outline" style="margin-top: 6px" @click="addChild">新增子触发器</Button>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">去抖与节流</div>
            <div class="oc-grid oc-grid--2">
              <div>
                <div class="oc-muted" style="font-size: 11px">去抖（debounce，ms）：窗口内多次触发只保留最后一次</div>
                <Input v-model.number="t.debounceMs" size="small" type="number" />
              </div>
              <div>
                <div class="oc-muted" style="font-size: 11px">节流（throttle，ms）：窗口内最多触发一次</div>
                <Input v-model.number="t.throttleMs" size="small" type="number" />
              </div>
            </div>
            <div class="oc-secondary" style="font-size: 12px; margin-top: 6px">
              当前组合：去抖 {{ t.debounceMs }}ms → 节流 {{ t.throttleMs }}ms。事件风暴场景（如批量推送）靠这两层保护调度器。
            </div>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">幂等键规则</div>
            <Input v-model="t.idempotencyKeyRule" size="small" class="oc-mono" />
            <div class="oc-muted" style="font-size: 11px; margin-top: 6px">
              可用占位符：{scheduleId} {eventId} {cronWindow} {commitSha} {workspace} {prNumber} {manualNonce}
            </div>
            <div class="oc-card" style="margin-top: 8px">
              <div class="oc-muted" style="font-size: 11px">预览（以 SCH-04 为例）</div>
              <pre class="oc-pre">{{ keyPreview }}</pre>
              <div class="oc-secondary" style="font-size: 12px">相同幂等键的重复触发会被去重（事件 schedule.deduplicated）。</div>
            </div>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">当前计划已配置的触发器</div>
            <div v-for="x in triggers" :key="x.id" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
              <OcIcon name="time" size="12px" />
              <Tag size="small" variant="light-outline">{{ KIND_META[x.kind].label }}</Tag>
              <span class="oc-mono" style="font-size: 11px">{{ x.spec }}</span>
              <Switch size="small" :value="x.enabled" disabled />
            </div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">预览结果</div>
            <InfoGrid :columns="1" :items="[
              { key: 'kind', label: '类型', value: KIND_META[t.kind].label },
              { key: 'spec', label: '表达式', value: t.spec, mono: true },
              { key: 'tz', label: '时区', value: t.timezone },
              { key: 'deb', label: '去抖 / 节流', value: `${t.debounceMs} / ${t.throttleMs} ms` },
              { key: 'key', label: '幂等键（预览）', value: preview || keyPreview, mono: true },
              { key: 'comp', label: '组合逻辑', value: t.kind === 'composite' ? `${t.combinator} × ${t.children.length}` : '—' },
            ]" />
            <div class="oc-flex" style="gap: 8px; margin-top: 6px">
              <CliHint command="oc schedule trigger preview SCH-04 --at '<ISO 时间>'" />
              <CopyableId id="trace-1f6b09d3" label="复制 traceId" />
            </div>
          </div>
        </div>
      </div>
    </StateShell>
    <Dialog v-model:visible="historyOpen" header="触发历史（近 30 天 · 只读聚合）" width="700px" :footer="false">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag size="small" variant="outline">加载于 {{ historyLoadedAt }}</Tag>
          <Tag size="small" theme="primary" variant="light-outline">触发 {{ historyTotals.fired }} 次</Tag>
          <Tag size="small" theme="warning" variant="light-outline">幂等去重 {{ historyTotals.deduped }} 次</Tag>
        </div>
        <div v-for="x in historyRows" :key="x.id" class="oc-flex oc-flex--wrap" style="gap: 6px">
          <span class="oc-mono" style="font-size: 12px">{{ x.id }}</span>
          <Tag size="small" variant="light-outline">{{ x.label }}</Tag>
          <span class="oc-mono" style="font-size: 11px">{{ x.spec }}</span>
          <span class="oc-muted" style="font-size: 12px">触发 {{ x.fired }} 次 · 去重 {{ x.deduped }} 次 · 最近 {{ x.lastAt }}</span>
        </div>
        <div class="oc-muted" style="font-size: 12px">
          去重 = 相同幂等键的重复触发被拦截（事件 schedule.deduplicated）；本面板为只读聚合，不会触发任何运行。
        </div>
      </div>
    </Dialog>
  </div>
</template>
