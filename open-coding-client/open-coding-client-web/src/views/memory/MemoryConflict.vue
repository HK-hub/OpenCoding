<script setup lang="ts">
/**
 * E-05 冲突处理：sameKeyDifferentValue / semanticContradiction + 合并确认。
 * 原则：不做「后写覆盖」，也不允许矛盾长期共存；低风险提示、高风险进入合并确认，历史版本保留（卷 10 D-MEM-5）。
 * 溯源：卷 10 D-MEM-5 / BUILD-MANIFEST E-05
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Popconfirm, RadioGroup, RadioButton, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import DiffView from '@/components/common/DiffView.vue';
import type { DiffFile } from '@/components/common/DiffView.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData, MEMORY_SCOPE_LABEL } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.memory;

const state = ref<UiStateKind>('LOADING');
const kindFilter = ref('all');
const activeId = ref(data.conflicts[1].conflictId);
const merged = ref<Record<string, string>>({});
const mergeDialog = ref(false);
const mergeChoice = ref<'a' | 'b' | 'both'>('a');

const conflicts = computed(() => data.conflicts.filter((c) => kindFilter.value === 'all' || c.kind === kindFilter.value));
const active = computed(() => data.conflicts.find((c) => c.conflictId === activeId.value) ?? data.conflicts[0]);
const sideA = computed(() => data.entries.find((e) => e.memoryId === active.value.a));
const sideB = computed(() => data.entries.find((e) => e.memoryId === active.value.b));
const unresolved = computed(() => data.conflicts.filter((c) => !merged.value[c.conflictId] && c.resolution.startsWith('未决')).length);

/** 合并预览 diff：左侧为 A 的结论，右侧为 B 的结论 + 合并说明（供人工确认） */
const mergeDiff = computed<DiffFile[]>(() => [
  {
    path: `${sideA.value?.memoryId ?? 'a'} → 合并草案`,
    additions: 2,
    deletions: 1,
    lines: [
      { type: 'ctx', oldLine: 1, newLine: 1, text: `key: ${sideA.value?.key ?? ''}` },
      { type: 'del', oldLine: 2, text: `A｜${sideA.value?.value ?? ''}` },
      { type: 'del', oldLine: 3, text: `B｜${sideB.value?.value ?? ''}` },
      { type: 'add', newLine: 2, text: `合并｜${mergeChoice.value === 'a' ? sideA.value?.value : mergeChoice.value === 'b' ? sideB.value?.value : `${sideA.value?.value}（并以 B 为例外条件）`}` },
      { type: 'add', newLine: 3, text: `附注｜冲突 ${active.value.conflictId} 已裁决，历史版本保留可审计` },
    ],
  },
]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '权限受限', value: 'PERMISSION_DENIED' },
];

function confirmMerge() {
  merged.value[activeId.value] = mergeChoice.value;
  mergeDialog.value = false;
  MessagePlugin.success('合并已确认：新版本生效，冲突双方保留在版本链中（可回滚）');
}

function severityTheme(s: string) {
  return s === '高' ? 'danger' : s === '中' ? 'warning' : 'default';
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="冲突处理"
      desc="同键不同值与语义矛盾的统一裁决入口；高严重度冲突在裁决前执行最严格策略，绝不静默覆盖历史结论。"
      volume="卷 10"
      manifest="E-05"
      cli="oc memory conflicts --unresolved"
      :status="[{ label: `${unresolved} 条未决`, theme: unresolved ? 'warning' : 'success' }, { label: '历史版本保留', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="kindFilter" size="small" style="width: 210px" :options="[{ label: '全部冲突类型', value: 'all' }, { label: '同键不同值', value: 'sameKeyDifferentValue' }, { label: '语义矛盾', value: 'semanticContradiction' }]" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="冲突总数" :value="data.conflicts.length" unit="条" icon="bug" :lower-is-better="true" hint="冲突率纳入 E-10 质量评测" />
      <StatCard label="未决（高严重度）" :value="unresolved" unit="条" icon="error" :lower-is-better="true" hint="未决期间执行更严格策略（如禁止直连生产库）" />
      <StatCard label="已合并" :value="Object.keys(merged).length" unit="条" icon="check" hint="合并后写入 memory.conflict.resolved 事件" />
      <StatCard label="版本链保留" :value="data.entries.filter((e) => e.supersededBy).length" unit="条" icon="history" hint="被取代条目保留可查，不物理删除" />
    </div>

    <StateShell
      :state="state"
      empty-title="当前没有冲突"
      empty-desc="冲突检测在写入与召回两条链路上持续运行；没有冲突说明记忆一致。"
      empty-action="查看记忆中心"
      example-task="把「临时允许直连生产库」写入项目记忆触发冲突检测"
      what="冲突列表加载失败"
      why="冲突检测事件流不可读（memory.conflict.detected 投影缺失）。"
      how="可重试；写入链路不受影响，冲突会在服务恢复后补检。"
      trace-id="trace-cft-51de02"
      missing-permission="memory.conflict.read"
      apply-path="在「权限与审批 → 申请授权」申请记忆治理只读权限"
      @retry="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">冲突列表</h3>
          <div class="oc-stack">
            <button
              v-for="c in conflicts"
              :key="c.conflictId"
              type="button"
              class="oc-cft"
              :class="{ 'oc-cft--active': c.conflictId === activeId }"
              @click="activeId = c.conflictId"
            >
              <div class="oc-flex--between">
                <span class="oc-mono" style="font-weight: 600">{{ c.conflictId }}</span>
                <Tag size="small" :theme="severityTheme(c.severity)" variant="light-outline">严重度 {{ c.severity }}</Tag>
              </div>
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 4px">
                <Tag size="small" :theme="c.kind === 'sameKeyDifferentValue' ? 'warning' : 'danger'">
                  {{ c.kind === 'sameKeyDifferentValue' ? '同键不同值' : '语义矛盾' }}
                </Tag>
                <span class="oc-mono oc-muted">{{ c.a }} ↔ {{ c.b }}</span>
              </div>
              <div class="oc-muted" style="font-size: 12px; margin-top: 4px">{{ c.resolution }}</div>
            </button>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            裁决视图
            <Tag v-if="merged[activeId]" size="small" theme="success">已合并</Tag>
          </h3>
          <div class="oc-grid oc-grid--2" style="gap: 8px">
            <div class="oc-card" style="padding: 10px">
              <div class="oc-flex" style="gap: 6px; margin-bottom: 4px">
                <Tag size="small" variant="light-outline">A</Tag>
                <span class="oc-mono" style="font-size: 12px">{{ sideA?.memoryId }}</span>
              </div>
              <div style="font-size: 13px">{{ sideA?.value }}</div>
              <div class="oc-muted" style="font-size: 11px; margin-top: 4px">
                {{ MEMORY_SCOPE_LABEL[sideA?.scope ?? 'project'] }} · 置信{{ sideA?.confidence }} · {{ sideA?.author }}
              </div>
            </div>
            <div class="oc-card" style="padding: 10px">
              <div class="oc-flex" style="gap: 6px; margin-bottom: 4px">
                <Tag size="small" variant="light-outline">B</Tag>
                <span class="oc-mono" style="font-size: 12px">{{ sideB?.memoryId }}</span>
              </div>
              <div style="font-size: 13px">{{ sideB?.value }}</div>
              <div class="oc-muted" style="font-size: 11px; margin-top: 4px">
                {{ MEMORY_SCOPE_LABEL[sideB?.scope ?? 'project'] }} · 置信{{ sideB?.confidence }} · {{ sideB?.author }}
              </div>
            </div>
          </div>

          <div class="oc-divider" />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'kind', label: '冲突类型', value: active.kind === 'sameKeyDifferentValue' ? '同键不同值（同名 key 两条结论）' : '语义矛盾（不同 key，语义互斥）' },
              { key: 'detected', label: '检测时间', value: new Date(active.detectedAt).toLocaleString('zh-CN') },
              { key: 'resolution', label: '当前处置', value: active.resolution, block: true },
            ]"
          />

          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
            <template v-if="!merged[activeId]">
              <Button theme="primary" @click="mergeDialog = true"><OcIcon name="check" size="12px" /> 合并确认</Button>
              <Popconfirm theme="warning" content="标记为「按更严格策略执行」：本次不改写记忆，仅记录裁决待组织评审。" @confirm="MessagePlugin.info('已记录：按更严格策略执行，等待组织评审')">
                <Button variant="outline">按严格策略执行</Button>
              </Popconfirm>
              <Tag v-if="active.resolution.startsWith('未决')" size="small" theme="danger" variant="light-outline">未决：影响面涉及合规</Tag>
            </template>
            <template v-else>
              <Tag size="small" theme="success">合并结果：以 {{ merged[activeId] === 'a' ? 'A' : merged[activeId] === 'b' ? 'B' : '双方合并' }} 为准</Tag>
              <Button size="small" variant="text" @click="delete merged[activeId]">撤销合并（回滚到冲突态）</Button>
            </template>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          历史裁决记录
          <span class="oc-muted" style="font-size: 12px">裁决不可改写，仅可追加（审计要求）</span>
        </h3>
        <Table
          :data="data.conflicts"
          :columns="[
            { colKey: 'conflictId', title: '冲突', width: 100 },
            { colKey: 'kind', title: '类型', width: 160, cell: 'cell' },
            { colKey: 'pair', title: '双方', width: 180, cell: 'cell' },
            { colKey: 'severity', title: '严重度', width: 90, cell: 'cell' },
            { colKey: 'resolution', title: '处置结论', cell: 'cell' },
          ]"
          row-key="conflictId"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'kind'">
              <Tag size="small" :theme="row.kind === 'sameKeyDifferentValue' ? 'warning' : 'danger'" variant="light-outline">
                {{ row.kind === 'sameKeyDifferentValue' ? '同键不同值' : '语义矛盾' }}
              </Tag>
            </template>
            <template v-else-if="col.colKey === 'pair'"><span class="oc-mono">{{ row.a }} ↔ {{ row.b }}</span></template>
            <template v-else-if="col.colKey === 'severity'">
              <Tag size="small" :theme="severityTheme(row.severity)">{{ row.severity }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'resolution'">
              <span :class="row.resolution.startsWith('未决') ? '' : 'oc-secondary'">{{ row.resolution }}</span>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <Dialog v-model:visible="mergeDialog" header="合并确认（写入新版本，保留历史）" :width="720" @confirm="confirmMerge">
        <p class="oc-secondary" style="font-size: 12px; margin: 0 0 8px">
          合并会生成新版本条目：冲突双方标记 superseded，版本链可审计、可回滚；语义矛盾（涉及合规）需上级复核。
        </p>
        <RadioGroup v-model="mergeChoice" style="margin-bottom: 10px">
          <RadioButton value="a">以 A 为准</RadioButton>
          <RadioButton value="b">以 B 为准</RadioButton>
          <RadioButton value="both">合并表述（B 作为例外条件）</RadioButton>
        </RadioGroup>
        <DiffView :files="mergeDiff" :collapse-over="20" />
      </Dialog>
    </StateShell>
  </div>
</template>

<style scoped>
.oc-cft {
  text-align: left;
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  padding: 8px 10px;
  background: var(--oc-bg-container);
  cursor: pointer;
}

.oc-cft--active {
  border-color: var(--td-brand-color, #0052d9);
  background: var(--td-brand-color-light, #f2f3ff);
}
</style>
