<script setup lang="ts">
/** 策略管理（P-03）：六层级树 + 规则编辑器（谓词 + 动作 + 优先级）+ 拒绝优先 + 基线锁定只读。溯源：卷 06 D-PERM-2/10 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { Policy, ScopeLevel } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { policies } = toolData;

const SCOPE_LABEL: Record<ScopeLevel, string> = {
  org: '组织', tenant: '租户', project: '项目', workspace: '工作区', session: '会话', user: '用户',
};
const SCOPE_ORDER: ScopeLevel[] = ['org', 'tenant', 'project', 'workspace', 'session', 'user'];

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'PERMISSION_DENIED'>('LOADING');
const currentId = ref(policies.find((p) => p.scopeLevel === 'project')?.policyId ?? policies[0].policyId);
const editorOpen = ref(false);
const denied = ref(false);
const err = ref(makeError('PERMISSION_DENIED', '策略已被组织基线锁定，下级不可放宽'));

const draft = ref({ predicate: '', action: 'ALLOW', priority: 50, description: '' });

const grouped = computed(() =>
  SCOPE_ORDER.map((level) => ({
    level,
    label: SCOPE_LABEL[level],
    items: policies.filter((p) => p.scopeLevel === level),
  })),
);
const current = computed(() => policies.find((p) => p.policyId === currentId.value) ?? policies[0]);
const locked = computed(() => current.value.locked);
const allowCount = computed(() => policies.flatMap((p) => p.rules).filter((r) => r.action === 'ALLOW').length);
const denyCount = computed(() => policies.flatMap((p) => p.rules).filter((r) => r.action === 'DENY').length);
const askCount = computed(() => policies.flatMap((p) => p.rules).filter((r) => r.action === 'ASK').length);

const ruleColumns = [
  { colKey: 'ruleId', title: '规则', width: 110 },
  { colKey: 'predicate', title: '谓词（DSL）', width: 400 },
  { colKey: 'action', title: '动作', width: 92 },
  { colKey: 'priority', title: '优先级', width: 86 },
  { colKey: 'description', title: '说明', ellipsis: true },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    if (denied.value) state.value = 'PERMISSION_DENIED';
    else state.value = policies.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

function pick(p: Policy) {
  currentId.value = p.policyId;
  denied.value = false;
  refresh();
}

function openEditor() {
  if (locked.value) {
    MessagePlugin.error('基线锁定：该层级策略不可被下级编辑（技术强制，非约定）');
    return;
  }
  draft.value = { predicate: 'tool == "run_command" && command.matches("^pnpm ")', action: 'ASK', priority: 60, description: '' };
  editorOpen.value = true;
}

function saveRule() {
  if (!draft.value.predicate.trim() || !draft.value.description.trim()) {
    MessagePlugin.warning('谓词与说明为必填：说明将进入审计，便于事后解释');
    return;
  }
  editorOpen.value = false;
  MessagePlugin.success('规则已保存（版本 +1，生成 permission.policy.changed 事件并记录操作者）');
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="策略管理"
      desc="六层级策略树（组织 → 租户 → 项目 → 工作区 → 会话 → 用户）：求值由高到低、拒绝优先、更具体覆盖更宽泛、强制项不可被下级放宽。"
      volume="卷 06"
      manifest="P-03"
      cli="oc permission policy show --scope project:billing-ledger --explain"
      :status="[{ label: `组织 / 租户已锁定`, theme: 'danger' }, { label: `策略 ${policies.length} 条`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="denied = true; refresh()">演示锁定越权</Button>
        <Button size="small" theme="primary" @click="openEditor">新增规则</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="策略条数" :value="policies.length" format="raw" icon="lock" :hint="`层级 ${grouped.filter((g) => g.items.length).length} / 6`" />
      <StatCard label="ALLOW 规则" :value="allowCount" format="raw" icon="check" hint="仅用于预授权自动放行" />
      <StatCard label="DENY 规则" :value="denyCount" format="raw" icon="close" hint="拒绝优先：任一命中即拒绝" />
      <StatCard label="ASK 规则" :value="askCount" format="raw" icon="help" hint="强制人工审批，不写入长期授权记忆" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有策略"
      empty-desc="所有层级策略为空（异常态，将退化为按风险默认档位映射）。"
      empty-action="重新加载"
      example-task="为 migrations/** 写操作新增 ASK 规则"
      :what="`策略「${current.name}」不可编辑`"
      :why="err.message"
      how="组织 / 租户基线的放宽请求会被拒绝并生成 override.denied 安全事件；如需变更请走基线变更审批流程。"
      :trace-id="err.traceId"
      :missing-permission="'policy.write@org'"
      risk-level="R4"
      apply-path="在「企业治理 → 组织身份」提交基线变更申请（需安全组审批，变更版本化）"
      @retry="refresh"
      @apply="denied = false; refresh()"
      @empty-action="refresh"
    >
      <div class="oc-grid" style="grid-template-columns: 300px 1fr">
        <div class="oc-card">
          <h3 class="oc-card__title">
            六层级树
            <span class="oc-muted" style="font-size: 12px">由高到低</span>
          </h3>
          <div class="oc-stack" style="gap: 10px">
            <div v-for="g in grouped" :key="g.level">
              <div class="oc-flex" style="gap: 6px; margin-bottom: 4px">
                <Tag size="small" variant="outline" theme="default">{{ g.label }}</Tag>
                <span class="oc-muted" style="font-size: 11px">{{ g.items.length }} 条</span>
              </div>
              <div
                v-for="p in g.items"
                :key="p.policyId"
                class="oc-flex oc-flex--between"
                :style="{ padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', background: p.policyId === currentId ? 'var(--td-bg-color-container-hover, #f3f3f3)' : 'transparent' }"
                @click="pick(p)"
              >
                <div class="oc-grow">
                  <div style="font-size: 12px">{{ p.name }}</div>
                  <div class="oc-muted oc-mono" style="font-size: 11px">{{ p.scopeRef }} · v{{ p.version }}</div>
                </div>
                <Tag v-if="p.locked" size="small" theme="danger" variant="light-outline">锁定</Tag>
                <Tag v-else size="small" variant="light-outline">可编辑</Tag>
              </div>
            </div>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">
              {{ current.name }}（{{ SCOPE_LABEL[current.scopeLevel] }} / {{ current.scopeRef }}）
              <span class="oc-flex" style="gap: 6px">
                <Tag v-if="current.locked" size="small" theme="danger" variant="light-outline">基线锁定 · 只读</Tag>
                <Tag v-else size="small" theme="success" variant="light-outline">可编辑</Tag>
                <CliHint :command="`oc permission policy show ${current.policyId}`" />
              </span>
            </h3>
            <InfoGrid :columns="3" :items="[
              { key: 'id', label: '策略 ID', value: current.policyId, mono: true, copyable: true },
              { key: 'version', label: '版本', value: `v${current.version}` },
              { key: 'enforced', label: '强制', value: current.enforced ? '已启用（求值参与）' : '已停用' },
              { key: 'updatedAt', label: '最近变更', value: new Date(current.updatedAt).toLocaleString('zh-CN') },
              { key: 'updatedBy', label: '操作者', value: current.updatedBy },
              { key: 'lockedNote', label: '锁定语义', value: current.locked ? '组织级强制：下级覆盖尝试会被阻断并记为安全事件' : '可被下级收窄覆盖（不可被下级放宽）' },
            ]" />
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">
              规则清单（{{ current.rules.length }} 条）
              <span class="oc-muted" style="font-size: 12px">谓词字段：tool / resource / path / command / time / env / risk</span>
            </h3>
            <Table row-key="ruleId" size="small" :data="current.rules" :columns="ruleColumns">
              <template #ruleId="{ row }"><span class="oc-mono">{{ row.ruleId }}</span></template>
              <template #predicate="{ row }">
                <span class="oc-mono" style="font-size: 11px">{{ row.predicate }}</span>
              </template>
              <template #action="{ row }">
                <Tooltip :content="row.action === 'DENY' ? '拒绝优先：任一命中即拒绝（不可被下级放宽）' : row.action === 'ASK' ? '强制人工审批：不可自动放行、不可记忆为 ALLOW' : '预授权放行：仍需沙箱与审计'">
                  <Tag size="small" variant="light-outline" :theme="row.action === 'DENY' ? 'danger' : row.action === 'ASK' ? 'warning' : 'success'">{{ row.action }}</Tag>
                </Tooltip>
              </template>
              <template #priority="{ row }"><span class="oc-mono">{{ row.priority }}</span></template>
              <template #description="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.description }}</span></template>
            </Table>
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">求值语义（可解释）</h3>
            <InfoGrid :columns="2" :items="[
              { key: 'o1', label: '① 拒绝优先', value: '所有层级求值结果聚合：任一 DENY 即拒绝（不因存在 ALLOW 而放行）' },
              { key: 'o2', label: '② 具体覆盖宽泛', value: '同层级内更具体的谓词（路径更深 / 条件更多）覆盖更宽泛者' },
              { key: 'o3', label: '③ 强制项不可放宽', value: '组织 / 租户锁定项不可被下级 ALLOW 覆盖；尝试即 override.denied' },
              { key: 'o4', label: '④ 全轨迹记录', value: '每次求值记录命中规则与顺序，供决策回放与回归用例固化' },
            ]" />
            <div class="oc-flex" style="margin-top: 8px">
              <CopyableId :id="`policy://${current.policyId}@v${current.version}`" label="复制策略引用" />
            </div>
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="editorOpen" header="新增策略规则" width="620px" :on-confirm="saveRule" :on-cancel="() => (editorOpen = false)">
      <div class="oc-stack">
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">谓词（DSL，白名单函数：matches / under / within / notIn）</div>
          <Textarea v-model="draft.predicate" :autosize="{ minRows: 2, maxRows: 5 }" placeholder='tool == "run_command" && command.matches("^rm ") && risk >= R4' />
        </div>
        <div class="oc-flex" style="gap: 10px">
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">动作</div>
            <Select v-model="draft.action" size="small" style="width: 140px" :options="[{ label: 'ALLOW 放行', value: 'ALLOW' }, { label: 'DENY 拒绝', value: 'DENY' }, { label: 'ASK 强制审批', value: 'ASK' }]" />
          </div>
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">优先级（0–100，越大越先求值）</div>
            <Input v-model="draft.priority" size="small" type="number" style="width: 160px" />
          </div>
        </div>
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">说明（必填：进入审计，供事后解释与回放）</div>
          <Input v-model="draft.description" size="small" placeholder="例如：生产环境破坏性命令强制人工审批" />
        </div>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：保存即版本 +1 并生成 <span class="oc-mono">permission.policy.changed</span> 事件（含差异与操作者）。
          可逆：可删除该规则或回滚到上一版本；<b>已被该规则拒绝过的动作不会自动重放</b>。
        </p>
      </div>
    </Dialog>
  </div>
</template>
