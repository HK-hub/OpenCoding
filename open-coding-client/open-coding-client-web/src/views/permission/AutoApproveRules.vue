<script setup lang="ts">
/** 自动批准规则（P-04）：规则即代码（谓词 + 动作 + 到期 + 记录人）+ 审计。溯源：卷 06 D-PERM-7 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Popconfirm, Select, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import type { AutoApproveRule } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { autoApproveRules } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const statusFilter = ref('');
const pageSize = ref(10);
const editorOpen = ref(false);
const revoking = ref<AutoApproveRule | null>(null);
const err = ref(makeError('PERMISSION_DENIED', '规则含 DENY 动作，仅安全组可维护'));

const draft = ref({ predicate: '', action: 'ALLOW', scope: 'project', hours: 72, description: '' });

const rows = computed(() => autoApproveRules.filter((r) => !statusFilter.value || r.status === statusFilter.value));
const shown = computed(() => rows.value.slice(0, pageSize.value));
const expiring = computed(() => autoApproveRules.filter((r) => r.status !== '生效中').length);

const columns = [
  { colKey: 'ruleId', title: '规则', width: 100 },
  { colKey: 'predicate', title: '谓词（规则即代码）', width: 420 },
  { colKey: 'action', title: '动作', width: 84 },
  { colKey: 'scope', title: '范围', width: 100 },
  { colKey: 'recordedBy', title: '记录人', width: 120 },
  { colKey: 'expiry', title: '到期', width: 200 },
  { colKey: 'hitCount', title: '命中', width: 84 },
  { colKey: 'auditRefs', title: '审计引用', width: 240 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = rows.value.length === 0 ? 'EMPTY' : rows.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL';
  }, 220);
}

function save() {
  if (!draft.value.predicate.trim() || !draft.value.description.trim()) {
    MessagePlugin.warning('谓词与说明必填：说明进入审计，用于事后解释该规则为何存在');
    return;
  }
  editorOpen.value = false;
  MessagePlugin.success(`规则已创建（到期 ${draft.value.hours}h 后自动失效并生成审计记录）`);
}

function revoke(rule: AutoApproveRule) {
  MessagePlugin.warning(`已撤销 ${rule.ruleId}：立即生效（下一次求值不再命中），历史命中记录保留在审计中`);
  revoking.value = null;
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="自动批准规则"
      desc="规则即代码：谓词（tool / resource / path / command / time / env / risk）+ 动作（ALLOW / DENY / ASK）+ 到期时间 + 记录人。可评审、可过期、可审计；企业可下发。"
      volume="卷 06"
      manifest="P-04"
      cli="oc permission auto-approve list --expiring 48h --with-audit"
      :status="[{ label: `即将到期 / 已过期 ${expiring}`, theme: expiring ? 'warning' : 'success' }, { label: '默认收紧', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" variant="outline" @click="statusFilter = '即将到期'; refresh()">查看即将到期</Button>
        <Button size="small" theme="primary" @click="editorOpen = true">新增规则</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="规则总数" :value="autoApproveRules.length" format="raw" icon="task-checked" />
      <StatCard label="生效中" :value="autoApproveRules.filter((r) => r.status === '生效中').length" format="raw" icon="check" />
      <StatCard label="即将到期（≤24h）" :value="autoApproveRules.filter((r) => r.status === '即将到期').length" format="raw" icon="time" hint="到期后自动失效（不静默续期）" />
      <StatCard label="累计命中" :value="autoApproveRules.reduce((a, r) => a + r.hitCount, 0)" icon="task" hint="命中即放行，全部留痕可回溯" />
    </div>

    <div class="oc-flex oc-flex--wrap">
      <Select v-model="statusFilter" size="small" clearable placeholder="状态" style="width: 160px" :options="['生效中', '即将到期', '已过期'].map((v) => ({ label: v, value: v }))" @change="refresh" />
      <CliHint command="oc permission auto-approve review --older-than 30d" label="规则复核清单" />
      <span class="oc-muted" style="font-size: 12px">禁止隐式学习：不从历史批准自动推断规则（仅可作 P3 建议器，不自动生效）</span>
    </div>

    <StateShell
      :state="state"
      empty-title="没有自动批准规则"
      empty-desc="全部动作都需人工确认（安全但打扰多）。建议为高频低风险动作建立带到期时间的规则。"
      empty-action="清空筛选"
      example-task="为 core/** 的测试命令建立 7 天有效的自动放行规则"
      :what="'自动批准规则加载失败'"
      :why="err.message"
      how="含 DENY 动作的规则由安全组维护：可在「策略管理」查看对应组织基线，或提交变更申请。"
      :trace-id="err.traceId"
      :collapsed-summary="`命中 ${rows.length} 条规则，已折叠展示前 ${pageSize} 条`"
      :page-size="pageSize"
      @retry="refresh"
      @load-more="pageSize += 10; state = pageSize >= rows.length ? 'NORMAL' : 'EDGE_DATA'"
      @empty-action="statusFilter = ''; refresh()"
    >
      <Table row-key="ruleId" size="small" :data="shown" :columns="columns">
        <template #ruleId="{ row }"><span class="oc-mono">{{ row.ruleId }}</span></template>
        <template #predicate="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.predicate }}</span></template>
        <template #action="{ row }">
          <Tag size="small" variant="light-outline" :theme="row.action === 'DENY' ? 'danger' : 'success'">{{ row.action }}</Tag>
        </template>
        <template #scope="{ row }"><Tag size="small" variant="light-outline">{{ row.scope }}</Tag></template>
        <template #expiry="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <Tag size="small" variant="light-outline" :theme="row.status === '已过期' ? 'danger' : row.status === '即将到期' ? 'warning' : 'success'">
              {{ row.remainingHours > 0 ? `剩余 ${row.remainingHours}h` : `已过期 ${Math.abs(row.remainingHours)}h` }}
            </Tag>
            <span class="oc-muted" style="font-size: 11px">{{ new Date(row.expiresAt).toLocaleString('zh-CN') }}</span>
          </div>
        </template>
        <template #hitCount="{ row }"><Tag size="small" variant="outline" theme="default">{{ row.hitCount }}</Tag></template>
        <template #auditRefs="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span v-for="a in row.auditRefs" :key="a" class="oc-muted oc-mono" style="font-size: 11px">{{ a }}</span>
          </div>
        </template>
      </Table>

      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">
          撤销规则
          <span class="oc-muted" style="font-size: 12px">撤销立即生效（下一次求值不再命中）</span>
        </h3>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <div v-for="r in shown" :key="r.ruleId" class="oc-flex" style="gap: 6px">
            <span class="oc-mono" style="font-size: 12px">{{ r.ruleId }}</span>
            <Popconfirm
              theme="danger"
              :content="`撤销 ${r.ruleId}：撤销后该动作恢复为按风险 ASK（立即生效）。可逆：可重新创建等价规则（历史命中记录保留）。确认撤销？`"
              @confirm="revoke(r)"
            >
              <Button size="small" variant="text" theme="danger">撤销</Button>
            </Popconfirm>
          </div>
        </div>
        <div class="oc-divider" />
        <InfoGrid :columns="2" :items="[
          { key: 'a1', label: '创建即审计', value: '创建 / 修改 / 撤销均写入审计（操作者 + 理由 + 差异），不可静默变更' },
          { key: 'a2', label: '到期语义', value: '到期自动失效并把命中统计归档；不静默续期（续期需再次确认）' },
          { key: 'a3', label: '范围收窄', value: '规则范围受策略约束：企业可禁用某些范围（如禁止 workspace 级放行）' },
          { key: 'a4', label: 'DENY 例外', value: 'DENY 规则仅安全组可维护，且优先级高于同级 ALLOW（拒绝优先）' },
        ]" />
      </div>
    </StateShell>

    <Dialog v-model:visible="editorOpen" header="新增自动批准规则" width="620px" :on-confirm="save" :on-cancel="() => (editorOpen = false)">
      <div class="oc-stack">
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">谓词（DSL）</div>
          <Textarea v-model="draft.predicate" :autosize="{ minRows: 2, maxRows: 5 }" placeholder='tool == "run_tests" && path.under("core/**") && risk == R2' />
        </div>
        <div class="oc-flex" style="gap: 10px; flex-wrap: wrap">
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">动作</div>
            <Select v-model="draft.action" size="small" style="width: 150px" :options="[{ label: 'ALLOW 自动放行', value: 'ALLOW' }, { label: 'DENY 直接拒绝', value: 'DENY' }]" />
          </div>
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">范围</div>
            <Select v-model="draft.scope" size="small" style="width: 150px" :options="['user', 'session', 'project', 'workspace', 'tenant'].map((v) => ({ label: v, value: v }))" />
          </div>
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">有效期（小时，到期自动失效）</div>
            <Input v-model="draft.hours" size="small" type="number" style="width: 180px" />
          </div>
        </div>
        <div>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">说明（必填，进入审计）</div>
          <Input v-model="draft.description" size="small" placeholder="例如：核心目录单测高频执行，7 天内自动放行" />
        </div>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：规则生效期内匹配动作将<b>跳过人工确认</b>（仍走沙箱与审计）。可逆：可随时撤销（立即生效）或等待到期。
          允许范围受企业策略约束（被禁用的范围将保存失败并提示）。
        </p>
      </div>
    </Dialog>
  </div>
</template>
