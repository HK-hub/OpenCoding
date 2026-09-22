<script setup lang="ts">
/**
 * I-02 Worktree 创建与编排。
 * 写范围重叠判断 → 原地工作（单任务且不重叠）或创建 worktree（重叠/多任务）→ 绑定分支 oc/<task-id>-slug。
 * 判断过程与结论可见可解释，不静默决定隔离策略。
 * 溯源：卷 21 D-GIT-2/§4.1；BUILD-MANIFEST I-02。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, MessagePlugin, Option, Select, Steps, StepItem, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const step = ref(0);
const form = ref({ taskId: 'T-7f3a', repo: 'payment-core', slug: 'reconcile', base: 'main@9f21ab4', scope: 'src/reconcile/**' });

/** 与现有活跃任务的写范围重叠检测（重叠 → 必须隔离） */
const overlap = computed(() => {
  const others = platformData.git.worktrees.filter((t) => t.repo === form.value.repo && t.status === 'ACTIVE' && t.taskId !== form.value.taskId);
  const rows = others.map((t) => {
    const hit = t.writeScope.some((s) => form.value.scope.startsWith(s.replace('/**', '')) || s.startsWith(form.value.scope.replace('/**', '')));
    return { taskId: t.taskId, branch: t.branch, scope: t.writeScope.join('、'), overlap: hit };
  });
  const anyOverlap = rows.some((r) => r.overlap);
  return { rows, anyOverlap };
});

const decision = computed(() => (overlap.value.anyOverlap || overlap.value.rows.length > 0 ? 'create' : 'inplace'));
const branchName = computed(() => `oc/${form.value.taskId}-${form.value.slug}`);

const totalBytes = computed(() => platformData.git.worktrees.filter((t) => t.repo === form.value.repo).reduce((a, t) => a + t.sizeBytes, 0));
const diskBudgetMb = 2048;

function submit() {
  MessagePlugin.success(
    decision.value === 'create'
      ? `已创建 worktree：${branchName.value}（基线 ${form.value.base}，位置 ${'${OPENCODING_HOME}'}/worktrees/${form.value.repo}/${form.value.taskId}）`
      : '已在用户工作区原地工作（未创建 worktree）：无写范围重叠且为单任务，只读任务共享',
  );
  step.value = 0;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.git.repos.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Worktree 创建编排"
      desc="先判断写范围重叠：不重叠且单任务 → 原地工作；重叠或并行多任务 → 创建 worktree 并绑定 oc/<task-id>-slug 分支。判断结论与理由始终可见。"
      volume="卷 21" manifest="I-02" cli="oc git worktree create --task T-7f3a --repo payment-core --base main --branch oc/T-7f3a-reconcile"
      :status="[{ label: decision === 'create' ? '需要隔离' : '原地工作', theme: decision === 'create' ? 'warning' : 'success' }, { label: `分支 ${branchName}`, theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在计算写范围重叠与磁盘预算…"
      empty-title="没有可用的仓库或任务" empty-desc="尚未打开任何 Git 仓库，或没有处于可隔离状态的任务。"
      empty-action="打开仓库" example-task="两个任务都要改 src/reconcile/ledger.ts：重叠检测应判定必须隔离"
      what="Worktree 编排失败" why="基线拉取失败（远端不可达或部分克隆 blob 获取超时）"
      how="可重试；失败即报告，不静默降级为原地工作（避免并行互相覆盖）" trace-id="trace-a11b2299"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-card">
        <Steps :current="step" size="small">
          <StepItem title="任务与仓库" />
          <StepItem title="写范围重叠判断" />
          <StepItem title="基线选择" />
          <StepItem title="确认创建" />
        </Steps>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">步骤 {{ step + 1 }}</h3>
          <div v-if="step === 0" class="oc-stack">
            <Input v-model="form.taskId" size="small" placeholder="任务编号，例如 T-7f3a" />
            <Input v-model="form.slug" size="small" placeholder="分支 slug（小写短横线），例如 reconcile" />
            <Select v-model="form.repo" size="small" aria-label="仓库">
              <Option v-for="r in platformData.git.repos" :key="r.repo" :value="r.repo" :label="`${r.repo}（${r.platform}）`" />
            </Select>
            <Input v-model="form.scope" size="small" placeholder="本任务写范围（glob），例如 src/reconcile/**" />
          </div>
          <div v-else-if="step === 1">
            <Table
              :data="overlap.rows" size="small" :pagination="undefined" row-key="taskId"
              :columns="[{ colKey: 'taskId', title: '并行任务', width: 110 }, { colKey: 'branch', title: '分支', width: 210 }, { colKey: 'scope', title: '写范围', ellipsis: true }, { colKey: 'overlap', title: '是否重叠', width: 110, cell: 'ov' }]"
            >
              <template #ov="{ row }">
                <Tag :theme="row.overlap ? 'danger' : 'success'" size="small" variant="light-outline">{{ row.overlap ? '重叠' : '不重叠' }}</Tag>
              </template>
            </Table>
            <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
              <Tag :theme="decision === 'create' ? 'warning' : 'success'" size="small" variant="light-outline">
                判定：{{ decision === 'create' ? '重叠或并行 → 创建 worktree（隔离索引与工作树）' : '无重叠且单任务 → 原地工作' }}
              </Tag>
            </div>
          </div>
          <div v-else-if="step === 2" class="oc-stack">
            <Input v-model="form.base" size="small" placeholder="基线（分支@提交），例如 main@9f21ab4" />
            <Tag size="small" variant="outline">基线选择影响重放结果：合并队列会再次拉取最新基线</Tag>
          </div>
          <div v-else class="oc-stack">
            <InfoGrid :columns="1" :items="[
              { key: 'branch', label: '分支命名', value: branchName, mono: true },
              { key: 'path', label: '位置', value: '${OPENCODING_HOME}/worktrees/' + form.repo + '/' + form.taskId, mono: true },
              { key: 'base', label: '基线', value: form.base, mono: true },
              { key: 'disk', label: '磁盘治理', value: `当前仓库 worktree 占用 ${(totalBytes / 1024 / 1024).toFixed(0)}MB / 预算 ${diskBudgetMb}MB；超限将拒绝新建并提示批量清理` },
              { key: 'cleanup', label: '清理策略', value: '合并后 24h 清理；未合并保留至放弃或 14 天' },
            ]" />
            <JsonBlock :mask="false" label="创建计划" :value="{ decision, branch: branchName, base: form.base, writeScope: [form.scope], separateFromUserWorkspace: true }" />
          </div>
          <div class="oc-flex" style="margin-top: 12px">
            <Button size="small" variant="outline" :disabled="step === 0" @click="step -= 1">上一步</Button>
            <Button v-if="step < 3" size="small" theme="primary" @click="step += 1">下一步</Button>
            <Button v-else size="small" theme="primary" @click="submit">确认创建</Button>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">决策说明（可解释）</h3>
            <InfoGrid :columns="1" :items="[
              { key: 'rule1', label: '判定规则 1', value: '写范围重叠 → 必须隔离（否则并行改动互相覆盖）' },
              { key: 'rule2', label: '判定规则 2', value: '多任务/团队并行 → 按任务或按成员隔离' },
              { key: 'rule3', label: '判定规则 3', value: '只读型任务 → 共享（只读不需要隔离）' },
              { key: 'rule4', label: '判定规则 4', value: 'worktree 与用户工作区分离存放，避免误删用户文件' },
            ]" />
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">等价命令</h3>
            <CliHint :command="`oc git worktree create --task ${form.taskId} --repo ${form.repo} --base ${form.base} --branch ${branchName}`" />
            <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
              <Tag size="small" variant="outline">创建 ≤2s（部分克隆下更慢，异步化并显示进度）</Tag>
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
