<script setup lang="ts">
/**
 * 引导与教学（G-08）：引导五层（L1 首次运行向导 / L2 情境提示 / L3 内联帮助 / L4 深度文档 / L5 示例任务库）
 * + 已关闭提示清单（可恢复）+ 全部关闭引导。L2 每功能至多提示 1 次、最多 3 个并存（ui.maxOpenTips）。溯源：卷 33 §5。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Slider, Switch, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const maxOpenTips = ref(ui.maxOpenTips);

const layers = ref([
  { key: 'L1', name: '首次运行向导', desc: '环境探测 → 工作区授权 → 默认模型 → 首个任务；可跳过后随时重跑', on: true, evidence: '向导完成记录 + 恢复点' },
  { key: 'L2', name: '情境提示', desc: '按功能键首次触达时提示一次；每功能 ≤1 次，最多 3 个并存，关闭即永久记住', on: true, evidence: 'ui.tipsDismissed 永久记忆（可恢复）' },
  { key: 'L3', name: '内联帮助', desc: '字段级说明紧贴控件；解释「为什么」与影响范围，不遮挡操作', on: true, evidence: '每个控件的 aria-describedby' },
  { key: 'L4', name: '深度文档', desc: '跳转 harness 卷册原文（含决策记录与反例），带锚点定位', on: true, evidence: '溯源锚点卷号 + manifest' },
  { key: 'L5', name: '示例任务库', desc: '可一键试跑的示例任务（只读沙箱内执行），用于无风险体验', on: true, evidence: '示例任务来源与预期产物' },
]);

/** 已关闭提示可读名（未知键回退为键名） */
const TIP_LABELS: Record<string, string> = {
  'session.diff-preview': '会话工作台：diff 预览手势',
  'cost.waterline': '成本总览：80%/95% 水位线解读',
  'approval.scope-picker': '审批中心：授权范围选择器',
  'context.compaction': '压缩地图：L1–L4 级别含义',
};

const dismissed = computed(() => Object.entries(ui.tipsDismissed).map(([key, at]) => ({ key, label: TIP_LABELS[key] ?? key, at: at.slice(0, 16).replace('T', ' ') })));
const enabledLayers = computed(() => layers.value.filter((l) => l.on).length);

function restore(key: string) {
  delete ui.tipsDismissed[key];
  MessagePlugin.success(`已恢复「${TIP_LABELS[key] ?? key}」的提示：下次触达该功能时会再次出现（仍只提示 1 次）`);
}

/** Slider 事件值为 number | number[]，归一化后再写 store */
function onMaxOpenTips(v: number | number[]) {
  const n = Array.isArray(v) ? v[0] : v;
  maxOpenTips.value = n;
  ui.maxOpenTips = n;
  MessagePlugin.info(`并存上限已设为 ${n}：同一时刻最多出现 ${n} 个情境提示`);
}

function disableAll() {
  layers.value = layers.value.map((l) => ({ ...l, on: false }));
  ui.dismissTip('all-guides');
  ui.announce('全部引导已关闭：随时可在本页重新开启');
  MessagePlugin.success('已全部关闭引导：五层提示不再出现（示例任务库仍可从导航手动进入）');
}

onMounted(() => {
  // 演示数据播种：已关闭清单为空时补两条，便于演示「恢复显示」闭环
  if (!Object.keys(ui.tipsDismissed).length) {
    ui.dismissTip('session.diff-preview');
    ui.dismissTip('cost.waterline');
  }
  window.setTimeout(() => { state.value = layers.value.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="引导与教学"
      desc="五层引导逐层可控：向导、情境提示、内联帮助、深度文档与示例任务库；关闭即永久记忆，且可随时恢复。"
      volume="卷 33"
      manifest="G-08"
      cli="oc settings tips --layers L1,L2,L3,L4,L5 --max-open 3 --restore"
      :status="[{ label: `开启 ${enabledLayers}/5 层`, theme: 'primary' }, { label: `提示并存上限 ${ui.maxOpenTips}`, theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="ui.dismissTip('session.diff-preview'); MessagePlugin.info('已关闭「diff 预览」提示，可在下方清单恢复')">关闭一条提示</Button>
        <Popconfirm content="全部关闭后五层引导不再出现（含首次运行向导与示例任务入口提示）；示例任务库仍可从导航手动进入，此操作可逆。" theme="warning" @confirm="disableAll">
          <Button size="small" theme="danger" variant="outline">全部关闭引导</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="引导层未定义"
      empty-desc="引导清单为空（知识库锚点缺失），无法展示分层开关。"
      empty-action="恢复默认五层"
      example-task="把情境提示并存上限调到 1，观察提示打扰频率的变化说明"
      what="引导配置加载失败"
      why="提示记忆读取失败（本地存储被浏览器策略清理）"
      how="可重试；失败时按「全部关闭」处理（安全默认：不打扰）"
      trace-id="trace-tips-6e02"
      collapsed-summary="已关闭提示超过单页阈值，低频功能提示已折叠。"
      :page-size="10"
      @retry="state = 'LOADING'"
      @empty-action="layers = layers.map((l) => ({ ...l, on: true }))"
    >
      <div class="oc-card">
        <div class="oc-card__title">引导五层（逐层可开关）</div>
        <div class="oc-stack" style="gap: 8px">
          <div v-for="l in layers" :key="l.key" class="oc-flex oc-flex--wrap" style="gap: 10px; align-items: center">
            <Tag size="small" :theme="l.on ? 'primary' : 'default'" variant="light-outline">{{ l.key }}</Tag>
            <span style="font-size: 13px; min-width: 120px">{{ l.name }}</span>
            <span class="oc-muted" style="font-size: 12px; flex: 1">{{ l.desc }}</span>
            <span class="oc-muted" style="font-size: 11px">证据：{{ l.evidence }}</span>
            <Switch v-model="l.on" size="small" :aria-label="`${l.name}开关`" />
          </div>
        </div>
        <div class="oc-flex" style="gap: 10px; align-items: center; margin-top: 10px">
          <span style="font-size: 12px">L2 并存上限（ui.maxOpenTips）</span>
          <Slider :model-value="maxOpenTips" :min="1" :max="3" :step="1" style="width: 180px" @change="onMaxOpenTips" />
          <span class="oc-mono" style="font-size: 12px">{{ maxOpenTips }}</span>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">已关闭提示清单（读 ui.tipsDismissed）</div>
          <div v-if="dismissed.length" class="oc-stack" style="gap: 6px">
            <div v-for="d in dismissed" :key="d.key" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <span class="oc-mono" style="font-size: 11px">{{ d.key }}</span>
              <span style="font-size: 12px">{{ d.label }}</span>
              <span class="oc-muted" style="font-size: 11px">{{ d.at }}</span>
              <Button size="small" variant="text" @click="restore(d.key)">恢复显示</Button>
            </div>
          </div>
          <div v-else class="oc-muted" style="font-size: 12px">暂无已关闭的提示：所有情境提示均处于可触发状态。</div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">语义：`每功能 ≤1 次` 由 tipsDismissed 永久记忆；恢复显示后仍遵守「只提示一次」。</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">教学边界与关闭语义</div>
          <InfoGrid :columns="1" :items="[
            { key: 'once', label: 'L2 频控', value: '同一功能键只提示一次；并存上限内才展示' },
            { key: 'no-block', label: '不阻塞', value: '任何引导都不遮挡操作，可随时 Esc 关闭' },
            { key: 'restore', label: '可恢复', value: '关闭为永久记忆但非不可逆，本页可逐条恢复' },
            { key: 'mock', label: '示例任务', value: 'L5 示例在只读沙箱执行，不产生真实写入与费用' },
          ]" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">引导触发日志（最近）</div>
        <div class="oc-stack" style="gap: 4px">
          <div v-for="d in dismissed.slice(0, 3)" :key="`log-${d.key}`" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Tag size="small" variant="outline">已关闭</Tag>
            <span class="oc-mono" style="font-size: 11px">{{ d.key }}</span>
            <span class="oc-muted" style="font-size: 11px">{{ d.at }}</span>
          </div>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc settings tips --list-dismissed --restore session.diff-preview" />
          <CopyableId id="trace-tips-6e02" label="复制 traceId" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
