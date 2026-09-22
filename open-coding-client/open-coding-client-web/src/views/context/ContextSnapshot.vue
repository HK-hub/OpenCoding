<script setup lang="ts">
/**
 * 上下文快照（S-11）：九区段 S1–S9 的 token/预算、驱逐等级、压缩方式、缓存属性与来源清单；总水位 80%/95% 阈值。
 * 可调范围仅 S4/S5/S7/S8，其余为固定区段（给出固定原因）；压缩为写操作，失败显式返回 traceId。溯源：卷 03 §4.2。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, MessagePlugin, Popconfirm, Progress, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { db } from '@/mock/db';
import type { ContextSectionData } from '@/mock/data/session';
import { request } from '@/mock/runtime';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const active = ref<ContextSectionData | null>(null);
const compressing = ref(false);
const result = ref('');
const errTrace = ref('');

/** 可调区段白名单：仅记忆/知识/历史/工具结果可调，其余为稳定前缀或结构化必保区 */
const ADJUSTABLE = ['S4', 'S5', 'S7', 'S8'];
const FIXED_REASON: Record<string, string> = {
  S1: '组织策略与合规约束：固定装载，不可驱逐',
  S2: '模式/角色/护栏：稳定前缀，改动会击穿提示词缓存',
  S3: '项目指令分层装载：由目录级裁剪控制，不单独调预算',
  S6: '计划与验收清单：结构化必保，压缩会破坏状态机进度',
  S9: '当前指令：尾部区段，仅随用户输入变化',
};

const rows = computed(() => db.contextSections.map((s) => ({
  ...s,
  pct: Math.round((s.tokens / s.budget) * 100),
  adjustable: ADJUSTABLE.includes(s.code),
  reason: ADJUSTABLE.includes(s.code) ? '可调：按相关度截断 / 引用化 / 外置' : FIXED_REASON[s.code],
})));

const totalTokens = computed(() => rows.value.reduce((a, r) => a + r.tokens, 0));
const totalBudget = computed(() => rows.value.reduce((a, r) => a + r.budget, 0));
const waterline = computed(() => Math.round((totalTokens.value / Math.max(1, totalBudget.value)) * 100));

const columns = [
  { colKey: 'name', title: '区段', width: 230 },
  { colKey: 'usage', title: 'token / 预算（占比）', width: 240 },
  { colKey: 'eviction', title: '驱逐等级', width: 110 },
  { colKey: 'compression', title: '压缩方式', width: 160 },
  { colKey: 'cache', title: '缓存属性', width: 110 },
  { colKey: 'adjustable', title: '可调性', width: 190 },
];

/** 手动压缩：写操作走内核；失败时给出可复制的 traceId（不静默回退） */
async function compact() {
  compressing.value = true;
  result.value = '';
  errTrace.value = '';
  try {
    const saved = await request('/api/v1/write', () => 18_400, { write: true });
    result.value = `已压缩：S7 对话历史节省 ${saved.toLocaleString('zh-CN')} token（保留用户约束与未决项），下一轮装配生效`;
    MessagePlugin.success(result.value);
  } catch (e) {
    errTrace.value = (e as { traceId?: string }).traceId ?? 'trace-ctx-8a11';
    MessagePlugin.error('压缩失败：上下文水位未变化，未做任何裁剪（失败不改数据）');
  } finally {
    compressing.value = false;
  }
}

onMounted(() => {
  window.setTimeout(() => { state.value = rows.value.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="上下文快照"
      desc="九区段预算与占用、驱逐等级、压缩方式、缓存属性与来源清单；水位 80% 预警、95% 强制压缩。"
      volume="卷 03"
      manifest="S-11"
      cli="oc context snapshot --session S-4001 --show-sources --compact"
      :status="[{ label: `水位 ${waterline}%`, theme: waterline >= 95 ? 'danger' : waterline >= 80 ? 'warning' : 'success' }, { label: 'S1/S2/S6/S9 固定', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">刷新快照</Button>
        <Popconfirm content="压缩会改写上下文（L1 外置 + L2 摘要，保留约束与未决项）；失败不改变水位，成功后下一轮装配生效。" theme="warning" @confirm="compact">
          <Button size="small" theme="primary" :loading="compressing">手动触发压缩</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="上下文为空"
      empty-desc="当前会话尚未装配任何区段（首轮请求未发出），无法展示占用。"
      empty-action="装配上下文"
      example-task="点击某区段查看来源清单，再手动触发一次压缩对比水位"
      what="上下文快照加载失败"
      why="装配器状态读取失败（token 预估器与最近快照不一致）"
      how="可重试；失败时展示最近一次成功快照并标注时间，不重新装配"
      trace-id="trace-ctx-8a11"
      collapsed-summary="来源清单超过单页阈值，仅展示前 20 条引用。"
      :page-size="20"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('已触发一次装配（只读）')"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="总占用" :value="totalTokens" format="token" icon="layers" :target="totalBudget" target-kind="max" :lower-is-better="true" />
        <StatCard label="总预算" :value="totalBudget" format="token" icon="dashboard" />
        <StatCard label="水位（80/95）" :value="waterline" format="percent" icon="chart" :target="80" target-kind="max" />
        <StatCard label="可调区段" :value="rows.filter((r) => r.adjustable).length" unit="个" icon="filter" hint="S4/S5/S7/S8 之外为固定区段" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">总水位与阈值线</div>
        <div class="oc-flex" style="gap: 8px; align-items: center">
          <Progress :percentage="Math.min(100, waterline)" :status="waterline >= 95 ? 'error' : waterline >= 80 ? 'warning' : 'success'" style="flex: 1" />
          <Tag size="small" theme="warning" variant="light-outline">80% 预警：先尝试引用化与外置</Tag>
          <Tag size="small" theme="danger" variant="light-outline">95% 强制压缩：L2 摘要 + L1 外置</Tag>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">九区段明细（点击行查看来源清单）</div>
        <Table :data="rows" row-key="code" size="small" :columns="columns" :pagination="undefined" @row-click="(ctx: { row: unknown }) => (active = ctx.row as ContextSectionData)">
          <template #name="{ row }">
            <div class="oc-flex" style="gap: 6px; align-items: center">
              <span class="oc-mono" style="font-size: 11px">{{ row.code }}</span>
              <span style="font-size: 12px">{{ row.name }}</span>
            </div>
            <div class="oc-muted" style="font-size: 11px">{{ row.desc }}</div>
          </template>
          <template #usage="{ row }">
            <div class="oc-flex" style="gap: 6px; align-items: center">
              <span class="oc-mono" style="font-size: 11px">{{ (row.tokens / 1000).toFixed(1) }}k / {{ (row.budget / 1000).toFixed(0) }}k</span>
              <Progress :percentage="Math.min(100, row.pct)" :status="row.pct >= 95 ? 'error' : row.pct >= 80 ? 'warning' : 'success'" :label="false" size="small" style="width: 70px" />
              <span class="oc-muted" style="font-size: 11px">{{ row.pct }}%</span>
            </div>
          </template>
          <template #eviction="{ row }">
            <Tag size="small" :theme="row.eviction === '不可驱逐' ? 'danger' : row.eviction === '高' ? 'warning' : 'default'" variant="light-outline">{{ row.eviction }}</Tag>
          </template>
          <template #adjustable="{ row }">
            <Tag v-if="row.adjustable" size="small" theme="success" variant="light-outline">可调</Tag>
            <Tag v-else size="small" variant="outline">固定</Tag>
            <span class="oc-muted" style="font-size: 11px; margin-left: 4px">{{ row.reason }}</span>
          </template>
        </Table>
      </div>

      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
        <CliHint command="oc context snapshot --compact --reason 'manual' --dry-run" />
        <span v-if="result" class="oc-muted" style="font-size: 12px">{{ result }}</span>
        <CopyableId v-if="errTrace" :id="errTrace" label="压缩失败 traceId" />
      </div>

      <Drawer :visible="Boolean(active)" :header="`来源清单 · ${active?.code ?? ''} ${active?.name ?? ''}`" size="440px" :footer="false" @close="active = null">
        <div v-if="active" class="oc-stack">
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag size="small" variant="outline">{{ active.eviction }}</Tag>
            <Tag size="small" variant="outline">{{ active.compression }}</Tag>
            <Tag size="small" variant="outline">{{ active.cache }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px">{{ active.desc }}</div>
          <div class="oc-divider" />
          <div v-for="s in active.sources" :key="s" class="oc-flex" style="gap: 6px; align-items: center">
            <OcIcon name="link" size="12px" />
            <span class="oc-mono" style="font-size: 11px">{{ s }}</span>
          </div>
          <div class="oc-muted" style="font-size: 12px">来源可追溯：每条引用都能定位到知识/记忆/工件条目，压缩后引用关系保留。</div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
