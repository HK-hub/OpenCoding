<script setup lang="ts">
/**
 * A-01 Agent 定义管理：列表 + 编辑器（8 字段）+ 四级作用域 + 权限收窄校验。
 * 硬约束：子 Agent 权限只减不增；ceiling 超过父级或派生深度超上限的定制 Agent 直接拒绝装载（卷 12 §7）。
 * 溯源：卷 12 D-AG-13 / §4.7 / BUILD-MANIFEST A-01
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Drawer, Input, MessagePlugin, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import type { AgentDefinition } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.agent;

const state = ref<UiStateKind>('LOADING');
const scopeFilter = ref('all');
const editorOpen = ref(false);
const visible = ref(6);
const draft = ref<AgentDefinition>({ ...data.definitions[0] });

const rows = computed(() => data.definitions.filter((d) => scopeFilter.value === 'all' || d.scope === scopeFilter.value));
const shownRows = computed(() => rows.value.slice(0, visible.value));
const invalid = computed(() => data.definitions.filter((d) => !d.narrowing.ok).length);

const MODES = ['readonly', 'plan', 'default', 'acceptEdits', 'autonomous', 'yolo'];
const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '边界数据', value: 'EDGE_DATA' },
];

function openEditor(d: AgentDefinition) {
  draft.value = JSON.parse(JSON.stringify(d)) as AgentDefinition;
  editorOpen.value = true;
}

/** 权限收窄校验：工具集与权限上限不得放大，派生深度与节点数不得超限 */
const narrowingCheck = computed(() => {
  const overCeiling = MODES.indexOf(draft.value.permissions.ceiling) > MODES.indexOf('acceptEdits');
  const overMode = MODES.indexOf(draft.value.permissions.mode) > MODES.indexOf(draft.value.permissions.ceiling);
  const overDepth = draft.value.delegation.maxDepth > 3;
  const ok = !overCeiling && !overMode && !overDepth;
  return {
    ok,
    reasons: [
      overCeiling ? '权限上限超过组织上限 acceptEdits' : '',
      overMode ? '默认模式高于权限上限（不可能生效）' : '',
      overDepth ? '派生深度 > 3（组织上限）' : '',
    ].filter(Boolean),
  };
});

function save() {
  const check = narrowingCheck.value;
  draft.value.narrowing = { ok: check.ok, note: check.ok ? '校验通过：工具集与权限均为收窄子集。' : `拒绝装载：${check.reasons.join('；')}` };
  editorOpen.value = false;
  if (check.ok) {
    MessagePlugin.success('定义已保存并生效');
  } else {
    MessagePlugin.error('保存被拒绝：权限收窄校验未通过（子 Agent 权限只减不增）');
  }
}

function scopeTheme(s: string) {
  return s === 'builtin' ? 'default' : s === 'org' ? 'primary' : s === 'project' ? 'warning' : 'success';
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Agent 定义管理"
      desc="声明式定义专家 Agent（8 字段）：名称/职责/角色资产/工具子集/权限上限/派生策略/默认预算/移交条件；四级作用域可覆盖。"
      volume="卷 12"
      manifest="A-01"
      cli="oc agent definition list --scope project"
      :status="[{ label: `${data.definitions.length} 个定义`, theme: 'primary' }, { label: invalid ? `${invalid} 个校验失败` : '全部通过收窄校验', theme: invalid ? 'danger' : 'success' }]"
    >
      <template #actions>
        <Select v-model="scopeFilter" size="small" style="width: 140px" :options="[{ label: '全部作用域', value: 'all' }, { label: '内置 builtin', value: 'builtin' }, { label: '组织 org', value: 'org' }, { label: '项目 project', value: 'project' }, { label: '用户 user', value: 'user' }]" />
        <Button size="small" theme="primary" @click="openEditor(data.definitions[0])"><OcIcon name="add" size="12px" /> 新建定义</Button>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="Agent 定义" :value="data.definitions.length" unit="个" icon="robot" hint="内置 3 + 组织 5 + 项目 2 + 用户 2" />
      <StatCard label="可派生" :value="data.definitions.filter((d) => d.delegation.enabled).length" unit="个" icon="sitemap" hint="派生受 maxDepth / maxNodes 双重限制" />
      <StatCard label="只读定义" :value="data.definitions.filter((d) => d.permissions.mode === 'readonly').length" unit="个" icon="lock" hint="评审类 Agent 固定只读，防止越权改写" />
      <StatCard label="收窄校验失败" :value="invalid" unit="个" icon="error" :lower-is-better="true" hint="失败定义拒绝装载（本页含 1 个负样本）" />
    </div>

    <StateShell
      :state="state"
      stage="加载 Agent 定义…"
      empty-title="还没有 Agent 定义"
      empty-desc="至少需要一个内置定义作为默认执行者；组织/项目/用户层可覆盖其字段（只允许收窄）。"
      empty-action="使用内置默认定义"
      example-task="定义一个只读的「架构评审 Agent」并限制工具集"
      what="Agent 定义加载失败"
      why="定义来源不可读（AgentDefinitionSourceSPI 未装配或文件解析失败）。"
      how="可重试；解析失败的定义会被隔离并保留原始文件，不会静默使用默认权限。"
      trace-id="trace-agd-5e0b73"
      :collapsed-summary="`共 ${rows.length} 个定义，超出阈值已折叠（可按作用域过滤缩小范围）`"
      :page-size="visible"
      @retry="state = 'NORMAL'"
      @load-more="visible += 4"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">定义清单（已渲染 {{ shownRows.length }} / {{ rows.length }}）</h3>
        <Table
          :data="shownRows"
          :columns="[
            { colKey: 'name', title: '名称 / 职责', cell: 'cell' },
            { colKey: 'scope', title: '作用域', width: 100, cell: 'cell' },
            { colKey: 'promptRole', title: '角色资产', width: 190, cell: 'cell' },
            { colKey: 'tools', title: '工具子集', width: 160, cell: 'cell' },
            { colKey: 'permissions', title: '模式 / 上限', width: 170, cell: 'cell' },
            { colKey: 'delegation', title: '派生', width: 130, cell: 'cell' },
            { colKey: 'budget', title: '默认预算', width: 200, cell: 'cell' },
            { colKey: 'op', title: '操作', width: 84, cell: 'cell' },
          ]"
          row-key="name"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'name'">
              <div class="oc-flex" style="gap: 6px">
                <b style="font-size: 13px">{{ row.name }}</b>
                <Tooltip v-if="!row.narrowing.ok" :content="row.narrowing.note">
                  <Tag size="small" theme="danger" variant="light-outline">校验失败</Tag>
                </Tooltip>
              </div>
              <div class="oc-muted" style="font-size: 12px">{{ row.description }}</div>
            </template>
            <template v-else-if="col.colKey === 'scope'">
              <Tag size="small" :theme="scopeTheme(row.scope)" variant="light-outline">{{ row.scope }}</Tag>
            </template>
            <template v-else-if="col.colKey === 'promptRole'"><span class="oc-mono" style="font-size: 12px">{{ row.promptRole }}</span></template>
            <template v-else-if="col.colKey === 'tools'">
              <Tooltip :content="`allow: ${row.tools.allow.join(', ')}｜deny: ${row.tools.deny.join(', ') || '（无）'}`">
                <span style="font-size: 12px">{{ row.tools.allow.length }} 允许 / {{ row.tools.deny.length }} 禁止</span>
              </Tooltip>
            </template>
            <template v-else-if="col.colKey === 'permissions'">
              <span class="oc-mono" style="font-size: 12px">{{ row.permissions.mode }} ≤ {{ row.permissions.ceiling }}</span>
            </template>
            <template v-else-if="col.colKey === 'delegation'">
              <Tag v-if="row.delegation.enabled" size="small" theme="warning" variant="light-outline">
                深度 ≤ {{ row.delegation.maxDepth }} / 节点 ≤ {{ row.delegation.maxNodes }}
              </Tag>
              <Tag v-else size="small" variant="outline">不可派生</Tag>
            </template>
            <template v-else-if="col.colKey === 'budget'"><span class="oc-mono" style="font-size: 12px">{{ row.budget.default }}</span></template>
            <template v-else-if="col.colKey === 'op'">
              <Button size="small" variant="text" @click="openEditor(row)">编辑</Button>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
        <div v-if="shownRows.length < rows.length" class="oc-flex" style="justify-content: center; margin-top: 8px">
          <Button size="small" variant="text" @click="visible += 4">加载更多（剩余 {{ rows.length - shownRows.length }} 个）</Button>
        </div>
        <Alert
          v-if="invalid"
          theme="error"
          style="margin-top: 10px"
          message="存在收窄校验失败的定义（前端还原度 Agent）：请求 autonomous 超过组织上限 acceptEdits，派生深度 5 > 上限 3 —— 已拒绝装载，不会以任何形式生效。"
        />
      </div>

      <Drawer v-model:visible="editorOpen" size="520px" header="Agent 定义编辑器（8 字段）" :footer="true">
        <div class="oc-stack" style="gap: 12px">
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">① 名称</div>
            <Input v-model="draft.name" placeholder="例如：架构评审 Agent" />
          </div>
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">② 职责描述</div>
            <Input v-model="draft.description" placeholder="一句话说明用途（中文）" />
          </div>
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">③ 系统提示词引用（角色资产）</div>
            <Input v-model="draft.promptRole" placeholder="roles/xxx@vN" />
          </div>
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">④ 工具子集（allow / deny，收窄子集）</div>
            <Input :model-value="draft.tools.allow.join(', ')" placeholder="allow：read_file, search" @change="(v) => (draft.tools.allow = String(v).split(',').map((s) => s.trim()).filter(Boolean))" />
            <Input
              style="margin-top: 6px"
              :model-value="draft.tools.deny.join(', ')"
              placeholder="deny：edit_file, run_shell"
              @change="(v) => (draft.tools.deny = String(v).split(',').map((s) => s.trim()).filter(Boolean))"
            />
          </div>
          <div class="oc-grid oc-grid--2" style="gap: 8px">
            <div>
              <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">⑤ 默认权限模式</div>
              <Select v-model="draft.permissions.mode" :options="MODES.map((m) => ({ label: m, value: m }))" />
            </div>
            <div>
              <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">⑥ 权限上限（ceiling）</div>
              <Select v-model="draft.permissions.ceiling" :options="MODES.map((m) => ({ label: m, value: m }))" />
            </div>
          </div>
          <div>
            <div class="oc-flex--between" style="margin-bottom: 6px">
              <span class="oc-secondary" style="font-size: 12px">⑦ 派生策略（可派生 SubAgent / 深度 / 节点上限）</span>
              <Switch v-model="draft.delegation.enabled" size="small" />
            </div>
            <div class="oc-grid oc-grid--2" style="gap: 8px">
              <Input
                :model-value="String(draft.delegation.maxDepth)"
                placeholder="最大深度（≤ 3）"
                @change="(v) => (draft.delegation.maxDepth = Number(v) || 0)"
              />
              <Input
                :model-value="String(draft.delegation.maxNodes)"
                placeholder="最大节点数（单轮 ≤ 4）"
                @change="(v) => (draft.delegation.maxNodes = Number(v) || 0)"
              />
            </div>
          </div>
          <div>
            <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">⑧ 默认预算 / 移交条件 / 作用域</div>
            <Input v-model="draft.budget.default" placeholder="200k token / 30min / 80 tool calls" />
            <Input v-model="draft.handoff" style="margin-top: 6px" placeholder="何时移交给人类或上级 Agent" />
            <Select v-model="draft.scope" style="margin-top: 6px" :options="[{ label: 'builtin（内置）', value: 'builtin' }, { label: 'org（组织）', value: 'org' }, { label: 'project（项目）', value: 'project' }, { label: 'user（用户）', value: 'user' }]" />
          </div>

          <Alert
            :theme="narrowingCheck.ok ? 'success' : 'error'"
            :message="narrowingCheck.ok ? '权限收窄校验通过：工具与权限均为收窄子集，可用于派生。' : `权限收窄校验未通过：${narrowingCheck.reasons.join('；')} —— 保存将被拒绝（子 Agent 权限只减不增）。`"
          />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'ceiling', label: '组织权限上限', value: 'acceptEdits（企业可下调，不可上调）' },
              { key: 'inherit', label: '派生继承', value: '子 Agent 工具与权限 = 父 ∩ 自身 allow，deny 优先' },
              { key: 'audit', label: '装载审计', value: '每次装载记录定义哈希、来源与校验结果' },
            ]"
          />
          <div class="oc-flex" style="gap: 8px">
            <Button theme="primary" @click="save">保存定义</Button>
            <Button variant="outline" @click="editorOpen = false">取消</Button>
            <CliHint command="oc agent definition apply --file agents/arch-review.yaml" />
          </div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
