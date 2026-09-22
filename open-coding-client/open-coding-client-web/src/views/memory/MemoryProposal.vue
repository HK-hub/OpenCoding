<script setup lang="ts">
/**
 * E-03 写入确认卡：key/value/scope/理由/影响范围 → 同意 / 拒绝 / 改范围。
 * 铁律：记忆写入必须体现「候选 → 确认」，并在撤销窗口内可撤回（卷 10 §4.2 / 产品铁律 15）。
 * 溯源：卷 10 §4.2 / BUILD-MANIFEST E-03
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, RadioGroup, RadioButton, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData, MEMORY_SCOPE_LABEL } from '@/mock/data/knowledge';
import type { MemoryProposal, MemoryScope } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.memory;
const items = ref<MemoryProposal[]>(data.proposals.map((p) => ({ ...p })));

const state = ref<UiStateKind>('LOADING');
const scopeFilter = ref('all');
const selectedId = ref(items.value.find((p) => p.state === 'pending')?.proposalId ?? '');
const scopeDialog = ref(false);
const newScope = ref<MemoryScope>('project');
/** EDGE_DATA：候选超过阈值折叠展示 */
const visible = ref(6);
/** 撤销窗口（5–30s 可配，默认 10s）：窗口内可撤回写入 */
const undoLeft = ref<Record<string, number>>({});
let timer = 0;

const filtered = computed(() => items.value.filter((p) => scopeFilter.value === 'all' || p.scope === scopeFilter.value));
const shownProposals = computed(() => filtered.value.slice(0, visible.value));
const pending = computed(() => items.value.filter((p) => p.state === 'pending'));
const accepted = computed(() => items.value.filter((p) => p.state === 'accepted'));
const rejected = computed(() => items.value.filter((p) => p.state === 'rejected'));
const selected = computed(() => items.value.find((p) => p.proposalId === selectedId.value) ?? pending.value[0] ?? items.value[0]);

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '边界数据', value: 'EDGE_DATA' },
];

function decide(p: MemoryProposal, action: 'accepted' | 'rejected') {
  p.state = action;
  if (action === 'accepted') {
    // 高置信低风险可自动写入，但必须可追溯、可撤销 —— 撤销窗口内允许撤回
    undoLeft.value[p.proposalId] = ui.undoWindowSeconds;
    MessagePlugin.success(`已同意写入 ${p.key}，${ui.undoWindowSeconds}s 内可撤销`);
  } else {
    MessagePlugin.warning(`已拒绝 ${p.key}：本次不写入，事件 memory.rejected 留痕`);
  }
}

function undoSelfAccept(p: MemoryProposal) {
  p.state = 'pending';
  delete undoLeft.value[p.proposalId];
  MessagePlugin.info(`已撤回 ${p.key} 的写入（回到候选队列）`);
}

function changeScope() {
  if (selected.value) {
    selected.value.scope = newScope.value;
    MessagePlugin.success(`已改范围为 ${MEMORY_SCOPE_LABEL[newScope.value]}，等待再次确认`);
  }
  scopeDialog.value = false;
}

function scopeTheme(s: string) {
  return s === 'org' ? 'danger' : s === 'project' ? 'warning' : 'default';
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
  timer = window.setInterval(() => {
    Object.keys(undoLeft.value).forEach((k) => {
      undoLeft.value[k] -= 1;
      if (undoLeft.value[k] <= 0) delete undoLeft.value[k];
    });
  }, 1000);
});
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="写入候选确认"
      desc="Agent 提议 → 策略过滤（敏感/重复/低置信）→ 用户确认或按策略自动写入；每次写入可追溯到来源，并可撤销。"
      volume="卷 10"
      manifest="E-03"
      cli="oc memory proposals --state pending"
      :status="[{ label: '默认全候选确认', theme: 'primary' }, { label: '写入可撤销', theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="scopeFilter" size="small" style="width: 140px" :options="[{ label: '全部作用域', value: 'all' }, { label: '工作记忆', value: 'work' }, { label: '会话记忆', value: 'session' }, { label: '项目记忆', value: 'project' }, { label: '组织记忆', value: 'org' }]" />
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="待确认候选" :value="pending.length" unit="条" icon="help" hint="默认策略：全部候选确认（自动写入默认关闭）" />
      <StatCard label="自动写入" :value="accepted.filter((p) => p.how === 'auto').length" unit="条" icon="check" hint="仅高置信 + 低风险，且必须可追溯可撤销" />
      <StatCard label="已拒绝" :value="rejected.length" unit="条" icon="close" :lower-is-better="true" hint="含命中密钥类 PII 的直接拒绝" />
      <StatCard label="撤销窗口" :value="ui.undoWindowSeconds" unit="秒" format="raw" icon="time" hint="写入后窗口内可撤回（5–30s 可配）" />
    </div>

    <StateShell
      :state="state"
      stage="加载候选队列…"
      empty-title="没有待确认的候选"
      empty-desc="Agent 尚未提议新的记忆，或候选已被全部处理；可先去记忆中心查看已生效条目。"
      empty-action="查看记忆中心"
      example-task="把「发布必须双人评审」提升到组织记忆"
      what="候选队列加载失败"
      why="记忆写入器不可用（依赖 Redis 与文件索引）。"
      how="可重试；写入失败不会阻塞对话，重试期间 Agent 仍可正常工作。"
      trace-id="trace-mpr-2c90af"
      :collapsed-summary="`共 ${filtered.length} 条候选，超出阈值已折叠（避免一次决策过多）`"
      :page-size="visible"
      @retry="state = 'NORMAL'"
      @load-more="visible += 6"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            候选队列
            <span class="oc-muted" style="font-size: 12px">点击候选查看确认卡（已渲染 {{ shownProposals.length }} / {{ filtered.length }}）</span>
          </h3>
          <div class="oc-stack">
            <button
              v-for="p in shownProposals"
              :key="p.proposalId"
              type="button"
              class="oc-prop"
              :class="{ 'oc-prop--active': p.proposalId === selectedId }"
              @click="selectedId = p.proposalId"
            >
              <div class="oc-flex--between">
                <span class="oc-mono oc-truncate" style="font-weight: 600">{{ p.key }}</span>
                <Tag size="small" :theme="p.state === 'pending' ? 'warning' : p.state === 'accepted' ? 'success' : 'default'">
                  {{ p.state === 'pending' ? '待确认' : p.state === 'accepted' ? '已同意' : '已拒绝' }}
                </Tag>
              </div>
              <div class="oc-clamp-2 oc-secondary" style="font-size: 12px">{{ p.value }}</div>
              <div class="oc-flex" style="gap: 6px; margin-top: 4px">
                <Tag size="small" :theme="scopeTheme(p.scope)" variant="light-outline">{{ MEMORY_SCOPE_LABEL[p.scope] }}</Tag>
                <Tag size="small" variant="outline">{{ p.how === 'auto' ? '自动写入' : '需确认' }}</Tag>
                <span class="oc-muted" style="font-size: 11px">{{ p.author }} · {{ new Date(p.at).toLocaleString('zh-CN') }}</span>
              </div>
            </button>
            <div v-if="!filtered.length" class="oc-muted" style="font-size: 12px">该作用域下没有候选。</div>
            <Button v-else-if="shownProposals.length < filtered.length" size="small" variant="text" @click="visible += 6">
              加载更多（剩余 {{ filtered.length - shownProposals.length }} 条）
            </Button>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">确认卡（{{ selected?.key }}）</h3>
          <div class="oc-kv">
            <span class="oc-kv__k">key</span><span class="oc-mono">{{ selected?.key }}</span>
            <span class="oc-kv__k">value</span><span>{{ selected?.value }}</span>
            <span class="oc-kv__k">作用域</span>
            <span>
              <Tag size="small" :theme="scopeTheme(String(selected?.scope))" variant="light-outline">{{ MEMORY_SCOPE_LABEL[selected?.scope ?? 'project'] }}</Tag>
            </span>
            <span class="oc-kv__k">理由</span><span>{{ selected?.reason }}</span>
            <span class="oc-kv__k">影响范围</span><span>{{ selected?.impact }}</span>
          </div>

          <div class="oc-divider" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <template v-if="selected?.state === 'pending'">
              <Button theme="primary" @click="selected && decide(selected, 'accepted')"><OcIcon name="check" size="12px" /> 同意写入</Button>
              <Button variant="outline" @click="selected && decide(selected, 'rejected')">拒绝</Button>
              <Button variant="outline" @click="scopeDialog = true">改范围</Button>
              <CliHint command="oc memory proposals accept mpr-01 --scope project" />
            </template>
            <template v-else-if="selected?.state === 'accepted'">
              <Tag size="small" theme="success">已写入</Tag>
              <Tag v-if="undoLeft[selected?.proposalId ?? '']" size="small" theme="warning">
                撤销窗口剩余 {{ undoLeft[selected?.proposalId ?? ''] }}s
              </Tag>
              <Button v-if="undoLeft[selected?.proposalId ?? '']" size="small" variant="outline" @click="selected && undoSelfAccept(selected)">撤回写入</Button>
              <span v-else class="oc-muted" style="font-size: 12px">窗口已过，需在记忆中心删除或修正。</span>
            </template>
            <template v-else>
              <Tag size="small" theme="default">已拒绝（不写入）</Tag>
              <span class="oc-muted" style="font-size: 12px">拒绝原因已留痕，同类提议会被降级处理。</span>
            </template>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">已处理候选（审计视图）</h3>
        <Table
          :data="items.filter((p) => p.state !== 'pending')"
          :columns="[
            { colKey: 'proposalId', title: '候选', width: 100 },
            { colKey: 'key', title: 'Key', width: 220 },
            { colKey: 'scope', title: '作用域', width: 110, cell: 'cell' },
            { colKey: 'how', title: '通道', width: 100, cell: 'cell' },
            { colKey: 'state', title: '结果', width: 100, cell: 'cell' },
            { colKey: 'at', title: '时间', cell: 'cell' },
          ]"
          row-key="proposalId"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'scope'">{{ MEMORY_SCOPE_LABEL[row.scope as MemoryScope] }}</template>
            <template v-else-if="col.colKey === 'how'">
              <Tag size="small" variant="light-outline">{{ row.how === 'auto' ? '自动' : '确认' }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'state'">
              <Tag size="small" :theme="row.state === 'accepted' ? 'success' : 'default'">{{ row.state === 'accepted' ? '已同意' : '已拒绝' }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'at'">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>

      <Dialog v-model:visible="scopeDialog" header="修改写入作用域" :width="440" @confirm="changeScope">
        <p class="oc-secondary" style="font-size: 12px; margin: 0 0 10px">
          作用域决定生命周期与可见范围：工作记忆任务结束释放；组织记忆需评审发布。
        </p>
        <RadioGroup v-model="newScope">
          <RadioButton value="work">工作记忆</RadioButton>
          <RadioButton value="session">会话记忆</RadioButton>
          <RadioButton value="project">项目记忆</RadioButton>
          <RadioButton value="org">组织记忆（需评审）</RadioButton>
        </RadioGroup>
      </Dialog>
    </StateShell>
  </div>
</template>

<style scoped>
.oc-prop {
  text-align: left;
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  padding: 8px 10px;
  background: var(--oc-bg-container);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.oc-prop--active {
  border-color: var(--td-brand-color, #0052d9);
  background: var(--td-brand-color-light, #f2f3ff);
}
</style>
