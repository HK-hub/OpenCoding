<script setup lang="ts">
/**
 * 能力详情（N3-02）：描述符（触发面 / 输入输出契约 / 工具依赖 / 写范围 / 门禁档 / 预算）+ 运行历史 + 度量 + 反馈样本。
 * 溯源：卷 35 §5.1/§5.3；BUILD-MANIFEST N3-02。
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { intelData, findCapability } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const route = useRoute();
const router = useRouter();

const cap = computed(() => findCapability(String(route.params.id ?? '')));
const runs = computed(() => intelData.runs.filter((r) => r.capabilityId === cap.value?.id));
const outputs = computed(() => intelData.outputs.filter((o) => o.capabilityId === cap.value?.id).slice(0, 5));
const feedback = computed(() => intelData.feedbackQueue.filter((f) => f.capabilityId === cap.value?.id));

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const runColumns = [
  { colKey: 'runId', title: '运行', width: 120, cell: 'id' },
  { colKey: 'trigger', title: '触发面', width: 100, cell: 'trigger' },
  { colKey: 'stage', title: '阶段 / 结果', ellipsis: true },
  { colKey: 'costUsd', title: '成本', width: 130, cell: 'cost' },
  { colKey: 'status', title: '状态', width: 100, cell: 'status' },
  { colKey: 'at', title: '时间', width: 170, cell: 'at' },
];
const fbColumns = [
  { colKey: 'category', title: '反馈', width: 90, cell: 'cat' },
  { colKey: 'target', title: '对象', ellipsis: true },
  { colKey: 'ingestedAs', title: '回灌去向', ellipsis: true },
  { colKey: 'downweight', title: '降权阶段', width: 160, cell: 'dw' },
];
const STATUS_THEME: Record<string, 'success' | 'danger' | 'warning'> = { completed: 'success', failed: 'danger', started: 'warning' };
const CAT_THEME: Record<string, 'success' | 'warning' | 'danger' | 'default'> = { 采纳: 'success', 编辑: 'default', 驳回: 'warning', 误报: 'danger' };

/** 已取消的运行（IntelRun.status 无 CANCELLED 取值，用本地状态呈现「已取消」） */
const cancelledRunIds = ref<string[]>([]);

/** 取消运行（安全点停止）：仅停止后续批次，已完成批次与产出保留（状态落本地「已取消」） */
function cancelRun() {
  const target = runs.value.find((r) => r.cancellable);
  if (!target) {
    MessagePlugin.warning('当前没有可取消的运行中任务（仅运行中的能力调用可取消）');
    return;
  }

  // 就地更新领域数据：撤销可取消标记并在阶段上标注安全点停止
  target.cancellable = false;
  target.stage = `${target.stage}｜已在安全点停止（已完成批次与产出保留，不再启动后续批次）`;
  cancelledRunIds.value = [...cancelledRunIds.value, target.runId];
  MessagePlugin.warning(`已取消 ${target.runId}：安全点停止，已完成部分保留；成本按已消耗计（后续批次不再产生费用）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="cap ? `能力详情 · ${cap.name}` : '能力详情'"
      :desc="cap ? `能力 ID（稳定键、禁止配置化）：${cap.id}` : '未找到能力描述符'"
      volume="卷 35" manifest="N3-02" :cli="cap ? cap.verb : 'oc ai capability show'"
      :status="cap ? [{ label: cap.category, theme: 'primary' }, { label: cap.enabled ? '已启用' : '已停用', theme: cap.enabled ? 'success' : 'default' }] : []"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="router.push('/intel/capabilities')">返回中心</Button>
        <Button size="small" theme="primary" :disabled="!cap" @click="router.push('/intel/outputs')">查看草稿</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取能力描述符与历史运行…"
      empty-title="能力不存在" empty-desc="该能力 ID 未注册（能力 ID 为稳定键，不做别名解析）。"
      empty-action="返回能力中心" example-task="查看「审查机器人」的写范围与门禁档，确认默认只评论不写代码"
      what="描述符加载失败" why="能力包与内核契约版本不匹配（Skill 包与代码版本漂移）"
      how="升级能力包或回退内核版本；不静默降级到其它能力" trace-id="trace-8d204731"
      @retry="demo = 'NORMAL'" @empty-action="router.push('/intel/capabilities')"
    >
      <template v-if="cap">
        <div class="oc-grid oc-grid--3">
          <div class="oc-card">
            <div class="oc-card__title">描述符（缺字段即注册失败）</div>
            <InfoGrid :columns="1" :items="[
              { key: 'id', label: '能力 ID', value: cap.id, mono: true, copyable: true },
              { key: 'cat', label: '类别', value: cap.category, tag: { text: cap.category, theme: 'primary' } },
              { key: 'trig', label: '触发面', value: cap.triggers.join(' / ') },
              { key: 'gate', label: '门禁档', value: cap.gateProfile },
              { key: 'write', label: '写范围', value: cap.writeScopes.join('；'), block: true },
              { key: 'tools', label: '工具依赖', value: cap.toolDeps.join('、') },
            ]" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">输入 / 输出契约</div>
            <div class="oc-card__title" style="font-size: 12px">输入</div>
            <div class="oc-stack" style="gap: 2px; font-size: 12px">
              <span v-for="(x, i) in cap.inputContract" :key="i">· {{ x }}</span>
            </div>
            <div class="oc-divider" />
            <div class="oc-card__title" style="font-size: 12px">输出</div>
            <div class="oc-stack" style="gap: 2px; font-size: 12px">
              <span v-for="(x, i) in cap.outputContract" :key="i">· {{ x }}</span>
            </div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">预算与模型</div>
            <InfoGrid :columns="1" :items="[
              { key: 'run', label: '单次预算上限', value: `$${cap.budget.runUsd}` },
              { key: 'day', label: '日预算上限', value: `$${cap.budget.dailyUsd}` },
              { key: 'model', label: '默认模型', value: cap.model },
              { key: 'pv', label: '提示词版本（产出必标）', value: cap.promptVersion, mono: true },
              { key: 'cost', label: '实测单次成本', value: `$${cap.costPerRun.toFixed(2)}` },
            ]" />
            <div class="oc-divider" />
            <div class="oc-card__title" style="font-size: 12px">质量判据</div>
            <div class="oc-stack" style="gap: 2px; font-size: 12px">
              <span v-for="(q, i) in cap.quality" :key="i">· {{ q }}</span>
            </div>
          </div>
        </div>

        <div class="oc-grid oc-grid--2" style="margin-top: 12px">
          <div class="oc-card">
            <div class="oc-card__title">失败与边界处理</div>
            <div class="oc-stack" style="gap: 4px; font-size: 12px">
              <span v-for="(f, i) in cap.failure" :key="i">· {{ f }}</span>
            </div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">度量（四指标）</div>
            <InfoGrid :columns="2" :items="[
              { key: 'adopt', label: '采纳率', value: `${(cap.adoptionRatio * 100).toFixed(1)}%` },
              { key: 'fp', label: '误报率', value: `${(cap.falsePositiveRatio * 100).toFixed(1)}%` },
              { key: 'saved', label: '节省时长', value: `${cap.timeSavedMinutes} 分钟/次` },
              { key: 'unit', label: '单位成本', value: `$${cap.costPerRun.toFixed(2)}/次` },
            ]" />
            <div class="oc-muted" style="font-size: 12px; margin-top: 6px">指标缺失即视为能力未交付；误报与驳回样本回流评测集。</div>
          </div>
        </div>

        <div class="oc-card" style="margin-top: 12px">
          <div class="oc-card__title">历史运行（ai.run.started / completed / failed）<CliHint :command="`oc ai run list --capability ${cap.id}`" /></div>
          <Table :data="runs" :columns="runColumns" row-key="runId" size="small" :pagination="undefined">
            <template #id="{ row }"><CopyableId :id="row.runId" label="复制 runId" /></template>
            <template #trigger="{ row }"><Tag size="small" variant="outline">{{ row.trigger }}</Tag></template>
            <template #cost="{ row }">${{ row.costUsd.toFixed(2) }} / ${{ row.budgetUsd.toFixed(2) }}</template>
            <template #status="{ row }">
              <Tag size="small" :theme="cancelledRunIds.includes(row.runId) ? 'default' : STATUS_THEME[row.status]" variant="light-outline">
                {{ cancelledRunIds.includes(row.runId) ? '已取消' : row.status }}
              </Tag>
            </template>
            <template #at="{ row }"><span style="font-size: 12px">{{ new Date(row.startedAt).toLocaleString('zh-CN') }}</span></template>
          </Table>
          <div v-if="runs.some((r) => r.cancellable)" class="oc-flex" style="gap: 6px; margin-top: 6px">
            <Tag size="small" theme="primary" variant="light-outline">有运行中任务</Tag>
            <Popconfirm
              theme="warning"
              :confirm-btn="{ content: '取消运行', theme: 'warning' }" cancel-btn="返回"
              @confirm="cancelRun"
            >
              <template #content>
                <div style="max-width: 320px">
                  <div>取消在安全点生效：当前批次完成后停止，不再启动后续批次。</div>
                  <div>可保留部分：已完成批次与产出、引用与成本记录保留；未开始的批次不再产生费用。</div>
                  <div>是否可撤销：不可撤销（如需继续请重新发起运行）。</div>
                </div>
              </template>
              <Button size="small" variant="outline">取消运行（安全点停止，保留已完成部分）</Button>
            </Popconfirm>
          </div>
        </div>

        <div class="oc-grid oc-grid--2" style="margin-top: 12px">
          <div class="oc-card">
            <div class="oc-card__title">近期草稿产出</div>
            <div v-for="o in outputs" :key="o.id" class="oc-stack" style="gap: 2px; margin-bottom: 6px">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <span style="font-size: 13px">{{ o.title }}</span>
                <Tag size="small" variant="outline">{{ o.status }}</Tag>
                <Tag size="small" variant="outline">引用覆盖 {{ (o.citationCoverage * 100).toFixed(0) }}%</Tag>
              </div>
              <span class="oc-muted" style="font-size: 11px">生成器：{{ o.generator.model }} · {{ o.generator.promptVersion }} · ${{ o.costUsd.toFixed(2) }}</span>
            </div>
            <div v-if="!outputs.length" class="oc-muted">暂无草稿产出。</div>
          </div>
          <div class="oc-card">
            <div class="oc-card__title">反馈样本（C8：回灌评测集与规则降权）</div>
            <Table :data="feedback" :columns="fbColumns" row-key="id" size="small" :pagination="undefined">
              <template #cat="{ row }"><Tag size="small" :theme="CAT_THEME[row.category]" variant="light-outline">{{ row.category }}</Tag></template>
              <template #dw="{ row }">
                <span v-if="row.downweight">{{ row.downweight.stage }}（{{ row.downweight.ruleId }}，命中 {{ row.downweight.hits }} 次）</span>
                <span v-else class="oc-muted">—</span>
              </template>
            </Table>
            <div v-if="!feedback.length" class="oc-muted">该能力暂无反馈样本。</div>
          </div>
        </div>
      </template>
    </StateShell>
  </div>
</template>
