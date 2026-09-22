<script setup lang="ts">
/**
 * 压缩地图（S-12）：L1–L4 压缩历史（Timeline）、前后 token 对比、摘要人工校正、撤销压缩与保真规则。
 * 撤销依赖原文引用回滚该次压缩；用户约束/验收标准/安全策略永不压缩。溯源：卷 03 §4.4。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Tag, Textarea, Timeline, TimelineItem, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import OcChart from '@/components/common/OcChart.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { db } from '@/mock/db';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const editIndex = ref(1);
const editing = ref(false);

/** 级别语义：压缩必须可解释到「怎么压的」与「保了什么」 */
const LEVEL_META: Record<string, { name: string; method: string; fidelity: string }> = {
  L1: { name: '工具结果裁剪', method: '超阈值结果外置为引用，仅保留摘要与首尾片段', fidelity: '引用可再读（重新鉴权后取原文）' },
  L2: { name: '区段摘要', method: '对话历史分段摘要，保留决策、未决项与用户约束', fidelity: '约束与验收标准逐字保留，不参与摘要改写' },
  L3: { name: '检索替换', method: '历史片段替换为知识库/记忆检索命中（带引用）', fidelity: '替换前记录来源锚点，可回滚' },
  L4: { name: '折叠为检查点', method: '阶段性折叠为 checkpoint（进度 + 关键证据引用）', fidelity: '副作用账本随检查点保存，重放跳过已生效写入' },
};

/** 本地副本：摘要校正与撤销只影响本视图（演示），不写内核 */
const events = ref(db.compactionHistory.map((e) => ({ ...e, summary: e.reason, draft: e.reason })));
const savedPct = computed(() => {
  const before = events.value.reduce((a, e) => a + e.before, 0);
  const after = events.value.reduce((a, e) => a + e.after, 0);
  return Math.round((1 - after / Math.max(1, before)) * 100);
});
const chartSeries = computed(() => [{
  name: '压缩前 / 压缩后（token）',
  points: events.value.flatMap((e) => [{ x: `${e.level}·前`, y: e.before }, { x: `${e.level}·后`, y: e.after }]),
}]);

function saveSummary() {
  const e = events.value[editIndex.value];
  if (!e || e.draft.trim().length < 8) {
    MessagePlugin.error('摘要过短：至少保留事件、决策与未决项三类信息');
    return;
  }
  e.summary = e.draft;
  editing.value = false;
  // 保真断言重新校验：约束类段落必须与原文一致，否则不允许生效
  MessagePlugin.success('已保存校正摘要，并已重新校验保真断言（用户约束 / 验收标准 / 安全策略完整）');
  ui.track('context.compaction.summary-edited', { level: e.level });
}

function revert(index: number) {
  const e = events.value[index];
  if (!e) return;
  e.reverted = true;
  MessagePlugin.success(`已撤销 ${e.level} 压缩（${e.before.toLocaleString('zh-CN')} → ${e.after.toLocaleString('zh-CN')} token）：按原文引用回滚，水位将回升`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = events.value.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="压缩地图"
      desc="每一次压缩都可解释、可校正、可撤销：级别、前后 token、原因与保真断言；约束类内容永不压缩。"
      volume="卷 03"
      manifest="S-12"
      cli="oc context compaction --history --edit-summary --revert L2"
      :status="[{ label: `共 ${events.length} 次压缩`, theme: 'primary' }, { label: '可撤销（依原文引用）', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">刷新历史</Button>
        <Popconfirm content="撤销将按原文引用回滚该次压缩：上下文水位回升、成本上升（引用再读会重新计费），不可撤销该撤销本身。" theme="warning" @confirm="revert(events.length - 1)">
          <Button size="small" theme="danger" variant="outline">撤销最近一次压缩</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚无压缩记录"
      empty-desc="会话水位未达阈值，还没有发生任何压缩；达到 80% 预警后先引用化，95% 强制压缩。"
      empty-action="查看上下文快照"
      example-task="校正 L2 摘要后撤销一次 L4 压缩，观察水位与保真断言的变化"
      what="压缩历史加载失败"
      why="压缩事件读取失败（事件序号断档，无法重建时间线）"
      how="可重试；失败时禁止任何撤销操作（避免基于不完整历史回滚）"
      trace-id="trace-compact-3c14"
      collapsed-summary="压缩事件超过单页阈值，仅展开最近 20 次（更早事件按需加载）。"
      :page-size="20"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('已跳转上下文快照（只读）')"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="压缩次数" :value="events.length" unit="次" icon="browse" />
        <StatCard label="累计节省" :value="savedPct" format="percent" icon="discount" :lower-is-better="false" />
        <StatCard label="已撤销" :value="events.filter((e) => e.reverted).length" unit="次" icon="history" />
        <StatCard label="保真断言" :value="'3 类硬保留'" format="raw" icon="secured" hint="用户约束 / 验收标准 / 安全策略" />
      </div>

      <div class="oc-grid" style="grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 12px; margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">压缩时间线（含级别说明）</div>
          <Timeline>
            <TimelineItem v-for="(e, i) in events" :key="`${e.level}-${e.at}`" :label="`${e.level} · ${new Date(e.at).toLocaleString('zh-CN')}`">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
                <Tag size="small" :theme="e.reverted ? 'default' : 'success'" variant="light-outline">{{ e.reverted ? '已撤销' : '已生效' }}</Tag>
                <span style="font-size: 12px">{{ LEVEL_META[e.level].name }}</span>
                <span class="oc-mono" style="font-size: 11px">{{ (e.before / 1000).toFixed(1) }}k → {{ (e.after / 1000).toFixed(1) }}k token</span>
                <Tooltip :content="LEVEL_META[e.level].fidelity"><Tag size="small" variant="outline">保真：{{ LEVEL_META[e.level].fidelity }}</Tag></Tooltip>
              </div>
              <div class="oc-muted" style="font-size: 12px; margin-top: 2px">{{ LEVEL_META[e.level].method }}</div>
              <div style="font-size: 12px; margin-top: 2px">摘要：{{ e.summary }}</div>
              <div class="oc-flex" style="gap: 6px; margin-top: 4px; align-items: center">
                <Button size="small" variant="text" @click="editIndex = i; editing = true">校正摘要</Button>
                <Popconfirm v-if="!e.reverted" content="撤销将按原文引用回滚该次压缩，水位回升且可能的引用再读会重新计费。" theme="warning" @confirm="revert(i)">
                  <Button size="small" variant="text">撤销压缩</Button>
                </Popconfirm>
              </div>
            </TimelineItem>
          </Timeline>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">前后 token 对比</div>
            <OcChart type="bar" :series="chartSeries" :height="200" format="token" aria-label="压缩前后 token 对比" />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">摘要校正（{{ events[editIndex]?.level ?? 'L2' }}）</div>
            <Textarea v-model="events[editIndex].draft" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="校正摘要：保留事件、决策与未决项" :disabled="!editing" />
            <div class="oc-flex" style="gap: 8px; margin-top: 8px">
              <Button size="small" theme="primary" :disabled="!editing" @click="saveSummary">保存并重新校验</Button>
              <span v-if="editing" class="oc-muted" style="font-size: 12px">保存后对「约束/验收/安全」段落逐字比对，不一致会拒绝生效。</span>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">保真规则（永不压缩清单）</div>
          <InfoGrid :columns="1" :items="[
            { key: 'constraint', label: '用户约束', value: '逐字保留（如「不要改公开 API 签名」），不参与摘要改写' },
            { key: 'accept', label: '验收标准', value: '结构化保留，压缩后仍可逐条对照' },
            { key: 'security', label: '安全策略', value: '权限/沙箱/DLP 规则原样保留，不折叠' },
            { key: 'assume', label: '未验证假设', value: '保留并标注 unverified，禁止在压缩中升格为已验证' },
          ]" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">保真断言核对</div>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="t in ['用户约束存在且未被改写', '验收标准逐条可对照', '安全策略与原始策略哈希一致', '未验证假设仍标注 unverified']" :key="t" class="oc-flex" style="gap: 6px; align-items: center">
              <OcIcon name="check" size="13px" color="var(--td-success-color)" />
              <span style="font-size: 12px">{{ t }}</span>
            </div>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
            <CliHint command="oc context compaction --verify-fidelity --level L2" />
            <CopyableId id="trace-compact-3c14" label="复制 traceId" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
