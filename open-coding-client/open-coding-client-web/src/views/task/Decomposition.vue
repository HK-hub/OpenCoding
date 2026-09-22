<script setup lang="ts">
/**
 * AI 候选分解确认（J-06）：候选树（每条带理由与风险标记）→ 增删改 → 调整依赖 → 设验收 → 原子写入。
 * 溯源：卷 14 D-TASK-2 人机协同分解（AI 候选 + 人类编辑 + 模板加速）。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Checkbox, Input, MessagePlugin, Popconfirm, Select, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { LEVEL_META, taskData } from '@/mock/data/task';
import type { DecompositionCandidate } from '@/mock/data/task';

const ui = useUiStore();
const router = useRouter();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const candidates = ref<DecompositionCandidate[]>(taskData.decomposition.candidates.map((c) => ({ ...c, dependsOn: [...c.dependsOn] })));
const committed = ref(false);
const targetTask = ref('T-3f72');
let counter = candidates.value.length;

/** AI 原始候选基线：重新生成时用于识别被人工修改的字段 */
const aiOriginals = new Map(taskData.decomposition.candidates.map((c) => [c.id, c]));
/** 当前候选列表的生成时间（重新生成后刷新，页面可见） */
const generatedAt = ref(taskData.decomposition.at);
/** 最近一次重新生成时保留的候选 id（页面标注「人工保留」） */
const manualKept = ref<string[]>([]);

const selectedCount = computed(() => candidates.value.filter((c) => c.selected).length);
const riskCount = computed(() => candidates.value.filter((c) => c.risk.startsWith('高')).length);

function addCandidate() {
  counter += 1;
  candidates.value.push({
    id: `C${counter}`, level: 'task', title: '（新增候选）补充说明文档', reason: '人工补充：契约变更需在知识库留痕',
    risk: '低', estimateHours: 2, dependsOn: [], acceptance: '文档与实现一致（L3 人工抽检）', selected: true,
  });
  MessagePlugin.success('已新增候选（人工添加，不计入 AI 生成统计）');
}

function removeCandidate(id: string) {
  candidates.value = candidates.value.filter((c) => c.id !== id);
  candidates.value.forEach((c) => { c.dependsOn = c.dependsOn.filter((d) => d !== id); });
  MessagePlugin.info(`已删除候选 ${id}，其下游依赖已同步清理`);
}

/** 判断候选是否被人工修改（标题 / 验收 / 依赖 / 勾选任一偏离 AI 原始值） */
function isManual(c: DecompositionCandidate): boolean {
  const origin = aiOriginals.get(c.id);
  if (!origin) return true;
  return c.title !== origin.title || c.acceptance !== origin.acceptance
    || c.selected !== origin.selected || c.dependsOn.join('|') !== origin.dependsOn.join('|');
}

/** 深拷贝候选（依赖数组独立，避免污染 mock 源数据） */
function cloneCandidate(c: DecompositionCandidate): DecompositionCandidate {
  return { ...c, dependsOn: [...c.dependsOn] };
}

/** 重新生成候选：按 AI 原始分解重算列表，人工修改项保留原位并标注「人工保留」 */
function regenerate() {
  const currentById = new Map(candidates.value.map((c) => [c.id, c]));
  const aiIds = new Set(taskData.decomposition.candidates.map((c) => c.id));
  const kept: string[] = [];

  // AI 原始项：人工改过的保留人工版本，其余覆盖回 AI 结果
  const next = taskData.decomposition.candidates.map((c) => {
    const cur = currentById.get(c.id);
    if (cur && isManual(cur)) {
      kept.push(c.id);
      return cloneCandidate(cur);
    }
    return cloneCandidate(c);
  });

  // 人工新增的候选（不在 AI 结果内）保留在尾部，不因重新生成被丢弃
  candidates.value.filter((c) => !aiIds.has(c.id)).forEach((c) => {
    kept.push(c.id);
    next.push(cloneCandidate(c));
  });

  candidates.value = next;
  manualKept.value = kept;
  generatedAt.value = new Date().toISOString();
  MessagePlugin.success(`已重新生成候选：AI 原始项 ${next.length - kept.length} 项已覆盖，人工修改项 ${kept.length} 项保留`);
}

/** 空态引导：跳转任务模板库（真实路由 /task/templates） */
function openTemplateLibrary() {
  router.push('/task/templates');
}

/** 原子提交：一次性写入全部选中候选（部分失败则全部不写入） */
function commit() {
  const picked = candidates.value.filter((c) => c.selected);
  if (!picked.length) {
    MessagePlugin.error('未选中任何候选：至少保留 1 项才能写入（不静默跳过）');
    return;
  }
  committed.value = true;
  MessagePlugin.success(`已原子写入 ${picked.length} 项（事件 workitem.created × ${picked.length}），10s 内可撤销`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = candidates.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="分解确认" volume="卷 14" manifest="J-06" cli="oc task decompose T-3f72 --confirm --atomic"
      desc="AI 产出候选分解（含理由与风险标记），人类可增删改、调整依赖、设验收标准；确认后原子写入，部分失败则整体不写入。"
      :status="[{ label: `候选 ${candidates.length} 项`, theme: 'primary' }, { label: `高风险 ${riskCount} 项`, theme: riskCount ? 'warning' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="addCandidate">新增候选</Button>
        <Button size="small" variant="outline" @click="regenerate">重新生成</Button>
        <Popconfirm
          content="写入将创建任务并登记依赖（事件 workitem.created）；10 秒内可撤销；未选中的候选不会写入。"
          theme="warning" @confirm="commit"
        >
          <Button size="small" theme="primary">确认写入</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
        <span class="oc-secondary">目标任务：</span>
        <Select v-model="targetTask" size="small" style="width: 300px" :options="taskData.workItems.filter((i) => i.level === 'task').map((i) => ({ label: `${i.shortId} ${i.title}`, value: i.shortId }))" />
        <Tag size="small" variant="outline">生成器：{{ taskData.decomposition.generatedBy }}</Tag>
        <Tag size="small" variant="outline">{{ new Date(generatedAt).toLocaleString('zh-CN') }}</Tag>
        <Tag v-if="committed" size="small" theme="success" variant="light-outline">已写入（可撤销 10s）</Tag>
      </div>
    </div>

    <StateShell
      :state="state"
      empty-title="没有候选分解" empty-desc="AI 未产出候选（目标描述过短或约束互相矛盾），可改用模板加速。" empty-action="从模板创建"
      example-task="从「新增 API」模板开始，再按需调整"
      what="候选分解生成失败" why="模型返回的结构化输出未通过 Schema 校验（缺失 acceptance 字段）"
      how="可重试；或改用人工分解（模板 + 手动增删）" trace-id="trace-8b14d0c7"
      @retry="state = 'LOADING'" @empty-action="openTemplateLibrary"
    >
      <div class="oc-stack">
        <div v-for="c in candidates" :key="c.id" class="oc-card" :style="c.selected ? undefined : { opacity: 0.6 }">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Checkbox v-model="c.selected" />
            <Tag size="small" variant="outline" class="oc-mono">{{ c.id }}</Tag>
            <Tag size="small" theme="primary" variant="light-outline">{{ LEVEL_META[c.level].label }}</Tag>
            <Input v-model="c.title" size="small" style="max-width: 360px" />
            <Tag size="small" :theme="c.risk.startsWith('高') ? 'danger' : c.risk.startsWith('中') ? 'warning' : 'success'" variant="light-outline">
              风险：{{ c.risk }}
            </Tag>
            <Tag v-if="manualKept.includes(c.id)" size="small" theme="warning" variant="light-outline">人工保留</Tag>
            <Tag size="small" variant="outline">{{ c.estimateHours }} h</Tag>
            <Popconfirm :content="`删除候选 ${c.id} 会同步清理下游依赖引用；写入前不产生任何数据变更。`" theme="danger" @confirm="removeCandidate(c.id)">
              <Button size="small" variant="text" theme="danger">删除</Button>
            </Popconfirm>
          </div>

          <div class="oc-secondary" style="font-size: 12px; margin-top: 6px">
            <OcIcon name="lightbulb" size="12px" /> 理由：{{ c.reason }}
          </div>

          <div class="oc-flex oc-flex--wrap" style="gap: 10px; margin-top: 8px">
            <div style="min-width: 280px; flex: 1">
              <div class="oc-muted" style="font-size: 11px">依赖（finish_to_start）</div>
              <Select
                v-model="c.dependsOn" multiple size="small" placeholder="选择前置候选"
                :options="candidates.filter((x) => x.id !== c.id).map((x) => ({ label: `${x.id} ${x.title}`, value: x.id }))"
              />
            </div>
            <div style="min-width: 280px; flex: 1">
              <div class="oc-muted" style="font-size: 11px">验收标准（可检验条目）</div>
              <Input v-model="c.acceptance" size="small" placeholder="例：OpenAPI 校验通过且 2 名评审人 approve" />
            </div>
          </div>

          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 6px">
            <Tag v-for="d in c.dependsOn" :key="d" size="small" variant="outline">依赖 {{ d }}</Tag>
            <Tag v-if="!c.acceptance" size="small" theme="danger" variant="light-outline">缺验收标准：写入前必须补齐</Tag>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">写入预览（原子）</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag v-for="c in candidates.filter((x) => x.selected)" :key="c.id" size="small" variant="outline">{{ c.id }} {{ c.title }}</Tag>
          </div>
          <div class="oc-secondary" style="font-size: 12px; margin-top: 6px">
            已选 {{ selectedCount }} / {{ candidates.length }}；依赖按拓扑序写入（先写前置），环检测在同一事务内执行。
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CliHint command="oc task decompose T-3f72 --confirm --atomic --select C1,C2,C3,C5" />
            <CopyableId id="trace-8b14d0c7" label="复制 traceId" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
