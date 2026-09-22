<script setup lang="ts">
/**
 * 任务模板库（J-07）：六类常见任务的标准步骤、验收清单与风险提示；详情抽屉 + 从此模板创建。
 * 溯源：卷 14 D-TASK-12 模板库（组织可共享，模板加速常见任务）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Drawer, Input, MessagePlugin, Select, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { taskData } from '@/mock/data/task';
import type { TaskTemplate, WorkItem } from '@/mock/data/task';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const keyword = ref('');
const kindFilter = ref('');
const detail = ref<TaskTemplate | null>(null);
const createOpen = ref(false);
const newTitle = ref('');
const newWorkspace = ref('local:/worktrees/payment-core');

/** 页面模板集合（本地副本）：提炼出的模板真实写入该列表，计数与过滤随之更新 */
const templates = ref<TaskTemplate[]>([...taskData.templateLibrary]);
const extractOpen = ref(false);
const sourceTaskId = ref('');

const kinds = computed(() => [...new Set(templates.value.map((t) => t.kind))]);
const list = computed(() => templates.value.filter((t) =>
  (!kindFilter.value || t.kind === kindFilter.value)
  && (!keyword.value || `${t.name}${t.desc}${t.steps.join('')}`.toLowerCase().includes(keyword.value.toLowerCase())),
));

function openCreate(t: TaskTemplate) {
  detail.value = t;
  createOpen.value = true;
  newTitle.value = `${t.name}：幂等校验补齐`;
}

function create() {
  if (!newTitle.value.trim()) {
    MessagePlugin.error('任务标题不能为空（字段级校验：必填）');
    return;
  }
  createOpen.value = false;
  MessagePlugin.success(`已从模板 ${detail.value?.id} 创建任务「${newTitle.value}」：步骤与验收清单已注入`);
}

/** 可提炼的成功任务：已完成的任务级 WorkItem（最近完成优先） */
const doneTasks = computed(() => taskData.workItems
  .filter((i) => i.level === 'task' && i.status === 'done')
  .sort((a, b) => String(b.endAt ?? '').localeCompare(String(a.endAt ?? ''))));
const sourceTask = computed<WorkItem | undefined>(() => doneTasks.value.find((t) => t.itemId === sourceTaskId.value) ?? doneTasks.value[0]);

/** 从成功任务的实体字段提炼模板草案：步骤取子 Step、验收取 acceptance、风险取阻塞与未闭环项 */
function extractDraft(t: WorkItem | undefined) {
  if (!t) return { steps: [] as string[], acceptance: [] as string[], risks: [] as string[] };
  const childSteps = taskData.workItems.filter((s) => s.parentId === t.itemId).map((s) => s.title);
  const steps = childSteps.length
    ? childSteps
    : ['读取现状与根因（对齐本任务证据）', `实现：${t.title}`, '按验收标准逐条取证', '生成完成报告'];
  const acceptance = t.acceptance.map((a) => a.text);
  const risks = [
    ...(t.blockedReason ? [t.blockedReason] : []),
    ...t.acceptance.filter((a) => a.verdict !== 'pass').map((a) => `未闭环验收需人工确认：${a.text}`),
  ];
  return { steps, acceptance, risks };
}
const draft = computed(() => extractDraft(sourceTask.value));

/** 进入模板创作：打开提炼抽屉（保存前不产生数据变更） */
function openExtract() {
  sourceTaskId.value = doneTasks.value[0]?.itemId ?? '';
  extractOpen.value = true;
  MessagePlugin.info('已进入模板创作：可从最近一次成功任务提炼');
}

/** 保存提炼结果：写入模板库列表并同步「模板总数 / 累计复用 / 共享模板」计数 */
function saveExtracted() {
  const t = sourceTask.value;
  if (!t) {
    MessagePlugin.warning('没有可提炼的成功任务（需先有已完成任务）');
    return;
  }
  const id = `TPL-EXTRACT-${t.shortId.replace(/[^A-Za-z0-9]/g, '')}`;
  if (templates.value.some((x) => x.id === id)) {
    MessagePlugin.warning(`${id} 已存在（同一任务只提炼一次，避免模板重复）`);
    return;
  }
  const d = draft.value;
  // 真实写入：新模板进入列表头部，计数随 templates 派生更新
  templates.value = [{ id, name: `${t.title}（提炼）`, kind: '提炼', desc: `从成功任务 ${t.shortId} 提炼：${d.steps.length} 步 / ${d.acceptance.length} 条验收`, steps: d.steps, acceptance: d.acceptance, risks: d.risks, usedCount: 0, shared: false }, ...templates.value];
  extractOpen.value = false;
  MessagePlugin.success(`已提炼模板 ${id}：${d.steps.length} 步 / ${d.acceptance.length} 条验收已写入模板库（当前共 ${templates.value.length} 个模板）`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = list.value.length ? 'NORMAL' : 'EMPTY'; }, 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="任务模板库" volume="卷 14" manifest="J-07" cli="oc task template list --shared"
      desc="六类常见任务的标准步骤 + 验收清单 + 风险提示；模板可组织共享与版本化，从成功运行中提炼。"
      :status="[{ label: `${templates.length} 个模板`, theme: 'primary' }, { label: '组织共享', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="openExtract">提炼模板</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--3" style="margin-bottom: 12px">
      <StatCard label="模板总数" :value="templates.length" unit="个" icon="file-copy" />
      <StatCard label="累计复用" :value="templates.reduce((a, b) => a + b.usedCount, 0)" unit="次" icon="refresh" />
      <StatCard label="共享模板" :value="templates.filter((t) => t.shared).length" unit="个" icon="share" hint="共享模板需管理员签名方可发布" />
    </div>

    <div class="oc-card" style="margin-bottom: 10px">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索模板（名称/步骤/风险）" clearable style="max-width: 280px" />
        <Select v-model="kindFilter" size="small" clearable placeholder="全部类型" style="width: 160px" :options="kinds.map((k) => ({ label: k, value: k }))" />
        <CliHint command="oc task template show TPL-BUGFIX --steps --acceptance --risks" />
      </div>
    </div>

    <StateShell
      :state="state"
      empty-title="没有匹配的模板" empty-desc="关键词与类型过滤下无命中；可清空过滤或提炼新模板。" empty-action="清空过滤"
      example-task="修 Bug（模板：最小用例 → 根因 → 回归用例）"
      what="模板库加载失败" why="组织私仓不可达（离线网络策略阻断）" how="已回退为内置模板；私仓恢复后自动合并"
      trace-id="trace-2c6f9a41" @retry="state = 'LOADING'" @empty-action="keyword = ''; kindFilter = ''"
    >
      <div class="oc-grid oc-grid--3">
        <article v-for="t in list" :key="t.id" class="oc-card" style="cursor: pointer" @click="detail = t">
          <div class="oc-flex--between">
            <Tag size="small" theme="primary" variant="light-outline">{{ t.kind }}</Tag>
            <Tag size="small" variant="outline">{{ t.usedCount }} 次复用</Tag>
          </div>
          <div style="font-size: 14px; font-weight: 600; margin: 6px 0 4px">{{ t.name }}</div>
          <div class="oc-secondary oc-clamp-2" style="font-size: 12px">{{ t.desc }}</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 4px; margin-top: 8px">
            <Tag size="small" variant="outline">{{ t.steps.length }} 步</Tag>
            <Tag size="small" variant="outline">{{ t.acceptance.length }} 条验收</Tag>
            <Tag size="small" :theme="t.risks.length > 1 ? 'warning' : 'default'" variant="light-outline">{{ t.risks.length }} 项风险</Tag>
            <Tag v-if="t.shared" size="small" theme="success" variant="light-outline">组织共享</Tag>
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Button size="small" variant="outline" @click.stop="openCreate(t)">从此模板创建</Button>
            <Button size="small" variant="text" @click.stop="detail = t">详情</Button>
          </div>
        </article>
      </div>

      <!-- 详情抽屉 -->
      <Drawer :visible="!!detail" :header="detail ? `${detail.name}（${detail.id}）` : ''" size="520px" :footer="false" @close="detail = null">
        <div v-if="detail" class="oc-stack">
          <div class="oc-card">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" theme="primary" variant="light-outline">{{ detail.kind }}</Tag>
              <Tag v-if="detail.shared" size="small" theme="success" variant="light-outline">组织共享（版本化）</Tag>
              <Tag size="small" variant="outline">复用 {{ detail.usedCount }} 次</Tag>
            </div>
            <p class="oc-secondary" style="font-size: 12px; margin-top: 6px">{{ detail.desc }}</p>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">标准步骤</div>
            <Timeline>
              <TimelineItem v-for="(s, i) in detail.steps" :key="s" :label="`步骤 ${i + 1}`">
                <div style="font-size: 12px">{{ s }}</div>
              </TimelineItem>
            </Timeline>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">验收清单（写入任务时成为 acceptance 初值）</div>
            <div v-for="a in detail.acceptance" :key="a" class="oc-flex" style="gap: 6px; font-size: 12px">
              <OcIcon name="check" size="12px" color="var(--td-success-color)" /> {{ a }}
            </div>
          </div>

          <div class="oc-card">
            <div class="oc-card__title">风险提示</div>
            <div v-for="rk in detail.risks" :key="rk" class="oc-flex" style="gap: 6px; font-size: 12px">
              <OcIcon name="error" size="12px" color="var(--oc-sev-warn)" /> {{ rk }}
            </div>
          </div>

          <div class="oc-flex" style="gap: 8px">
            <Button theme="primary" size="small" @click="openCreate(detail)">从此模板创建</Button>
            <CliHint :command="`oc task create --template ${detail.id} --title '<标题>' --workspace <path>`" />
          </div>
        </div>
      </Drawer>

      <!-- 创建抽屉 -->
      <Drawer v-model:visible="createOpen" header="从此模板创建任务" size="420px" :footer="false">
        <div class="oc-stack">
          <div>
            <div class="oc-muted" style="font-size: 12px">任务标题（必填）</div>
            <Input v-model="newTitle" size="small" />
          </div>
          <div>
            <div class="oc-muted" style="font-size: 12px">工作区（必填，决定写范围围栏）</div>
            <Input v-model="newWorkspace" size="small" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">将注入</div>
            <div class="oc-secondary" style="font-size: 12px">
              {{ detail?.steps.length ?? 0 }} 个 Step 定义、{{ detail?.acceptance.length ?? 0 }} 条验收标准、{{ detail?.risks.length ?? 0 }} 条风险提示（风险提示进入 spec 的「风险」段）。
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Button theme="primary" size="small" @click="create">创建任务</Button>
            <Button size="small" variant="outline" @click="createOpen = false">取消</Button>
            <CopyableId id="trace-2c6f9a41" label="复制 traceId" />
          </div>
        </div>
      </Drawer>

      <!-- 提炼模板抽屉：从成功任务的真实字段提炼，保存前不写入 -->
      <Drawer v-model:visible="extractOpen" header="提炼模板（从成功任务）" size="520px" :footer="false">
        <div class="oc-stack">
          <div>
            <div class="oc-muted" style="font-size: 12px">成功任务（最近完成优先）</div>
            <Select v-model="sourceTaskId" size="small" style="width: 100%" :options="doneTasks.map((t) => ({ label: `${t.shortId} ${t.title}`, value: t.itemId }))" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">标准步骤（{{ draft.steps.length }}）</div>
            <div v-for="s in draft.steps" :key="s" class="oc-secondary" style="font-size: 12px">{{ s }}</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">验收清单（{{ draft.acceptance.length }}）</div>
            <div v-for="a in draft.acceptance" :key="a" class="oc-secondary" style="font-size: 12px">{{ a }}</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">风险提示（{{ draft.risks.length }}）</div>
            <div v-for="rk in draft.risks" :key="rk" class="oc-secondary" style="font-size: 12px">{{ rk }}</div>
            <div v-if="!draft.risks.length" class="oc-muted" style="font-size: 12px">该任务无阻塞与未闭环项。</div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Button theme="primary" size="small" @click="saveExtracted">保存到模板库</Button>
            <Button size="small" variant="outline" @click="extractOpen = false">取消</Button>
          </div>
        </div>
      </Drawer>
    </StateShell>
  </div>
</template>
