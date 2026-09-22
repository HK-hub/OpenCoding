<script setup lang="ts">
/**
 * 安全总览（G3-01）：资产分级 A0–A3 + 10 信任边界拓扑（SVG）+ STRIDE 六列矩阵。
 * 溯源：卷 30 §2.1 / §2.2 / §4.3
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const tm = enterpriseData.threatModel;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const boundary = ref(tm.boundaries[0].id);
const selected = computed(() => tm.boundaries.find((b) => b.id === boundary.value) ?? tm.boundaries[0]);
/** 拓扑布局：内核居中，10 条边界环绕（纯 SVG，无第三方依赖） */
const nodes = computed(() => tm.boundaries.map((b, i) => {
  const angle = (-90 + i * 36) * (Math.PI / 180);
  return { ...b, x: 300 + Math.cos(angle) * 210, y: 170 + Math.sin(angle) * 130 };
}));
const strideRow = computed(() => tm.stride.find((s) => s.boundary.startsWith(selected.value.id)) ?? tm.stride[0]);

/** 威胁建模评审记录：发起后即写入本页（状态标签与评审清单随之变化） */
const reviewOpen = ref(false);
const reviewForm = ref({ scope: '', reviewer: '', dueAt: '' });
const reviews = ref<{ at: string; scope: string; reviewer: string; dueAt: string; status: string }[]>([]);
const pendingReviews = computed(() => reviews.value.filter((r) => r.status === '待评审'));
/** 页面状态徽标：存在待评审项时追加「评审中」（评审期间该范围架构变更冻结） */
const statusTags = computed<{ label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }[]>(() => {
  const tags: { label: string; theme: 'default' | 'primary' | 'success' | 'warning' | 'danger' }[] = [
    { label: 'A0 永不出安全域', theme: 'danger' },
    { label: 'STRIDE + LINDDUN + 滥用 + 攻击树', theme: 'default' },
  ];
  if (pendingReviews.value.length) tags.push({ label: `威胁建模评审中 ${pendingReviews.value.length} 项`, theme: 'warning' });
  return tags;
});

/** 导出威胁模型：资产分级 / 10 条信任边界 / STRIDE 矩阵，标注不含密钥明文 */
function exportThreatModel() {
  const file = downloadJson({
    assets: tm.assets,
    boundaries: tm.boundaries,
    stride: tm.stride,
    marking: 'A0 资产条目仅含分级与保护要求，不含任何密钥 / 凭证 / 客户数据原文；仅用于架构评审与红队映射',
  }, `oc-threat-model-${new Date().toISOString().slice(0, 10)}.json`);
  MessagePlugin.success('已生成 ' + file);
}

function openReview() {
  reviewForm.value = {
    scope: `边界 ${selected.value.id} ${selected.value.name}`,
    reviewer: '',
    dueAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  };
  reviewOpen.value = true;
}

/** 发起威胁建模评审：记录范围 / 评审人 / 截止时间；评审结论需回写 STRIDE 与红队用例后才生效 */
function submitReview() {
  const reviewer = reviewForm.value.reviewer.trim();
  if (!reviewer) {
    MessagePlugin.warning('请先填写评审人：威胁建模评审需明确责任人与结论出处');
    return;
  }
  if (!reviewForm.value.dueAt) {
    MessagePlugin.warning('请填写计划完成日期：未评审变更不得进入生产');
    return;
  }
  reviews.value.unshift({
    at: new Date().toISOString(),
    scope: reviewForm.value.scope,
    reviewer,
    dueAt: reviewForm.value.dueAt,
    status: '待评审',
  });
  reviewOpen.value = false;
  MessagePlugin.success(`已发起威胁建模评审：范围「${reviewForm.value.scope}」，评审人 ${reviewer}，计划 ${reviewForm.value.dueAt} 前完成；评审期间该范围架构变更冻结，结论将回写 STRIDE 矩阵与红队用例（可撤回）`);
}

onMounted(() => {
  setTimeout(() => { state.value = tm.boundaries.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="安全总览"
      desc="资产分级 A0–A3 与保护要求、10 条信任边界及其控制、STRIDE 六列威胁矩阵；每行至少对应一条红队用例。"
      volume="卷 30"
      manifest="G3-01"
      cli="oc sec overview --with-threat-model"
      :status="statusTags"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportThreatModel">导出威胁模型</Button>
        <Button size="small" theme="primary" @click="openReview">发起威胁建模评审</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未建立威胁模型"
      empty-desc="无威胁模型意味着控制点无法映射到风险；请在架构变更后立即补充 STRIDE 矩阵与红队用例映射。"
      empty-action="生成初始威胁模型"
      example-task="为新增的 A2A 外部调用方边界补充 STRIDE 与红队用例"
      what="威胁模型加载失败"
      why="模型版本与当前架构快照不一致（架构变更后未重新评审）"
      how="可重试；未评审的变更不得进入生产（架构变更需威胁建模评审）"
      trace-id="trace-sec-overview-77a1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="资产分级" :value="tm.assets.length" unit="级" :target="4" target-kind="min" icon="secured" />
        <StatCard label="信任边界" :value="tm.boundaries.length" unit="条" :target="10" target-kind="min" icon="api" />
        <StatCard label="STRIDE 覆盖" :value="tm.stride.length * 6" unit="格" icon="check" hint="10 边界 × 6 威胁类型" />
        <StatCard label="红线" :value="'跨租户零泄漏'" format="raw" icon="lock" hint="缓存 / 索引 / 对象存储键含租户前缀" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">10 信任边界拓扑（点击边界查看控制）</div>
          <svg viewBox="0 0 600 340" style="width: 100%; height: 300px" role="img" aria-label="信任边界拓扑">
            <line v-for="n in nodes" :key="`l-${n.id}`" :x1="300" :y1="170" :x2="n.x" :y2="n.y" stroke="var(--oc-border, #ddd)" stroke-dasharray="4 3" />
            <circle cx="300" cy="170" r="46" fill="var(--td-brand-color-light, #ecf2fe)" stroke="var(--td-brand-color, #0052d9)" />
            <text x="300" y="166" text-anchor="middle" font-size="12" font-weight="600" fill="var(--td-text-color-primary, #181818)">内核</text>
            <text x="300" y="182" text-anchor="middle" font-size="10" fill="var(--td-text-color-secondary, #666)">与外壳</text>
            <g v-for="n in nodes" :key="n.id" @click="boundary = n.id" style="cursor: pointer">
              <circle :cx="n.x" :cy="n.y" r="26" :fill="boundary === n.id ? 'var(--td-warning-color-1, #fff1e9)' : 'var(--td-bg-color-container, #fff)'" :stroke="boundary === n.id ? 'var(--td-warning-color, #e37318)' : 'var(--oc-border, #ddd)'" />
              <text :x="n.x" :y="n.y + 4" text-anchor="middle" font-size="11" font-weight="600" fill="var(--td-text-color-primary, #181818)">{{ n.id }}</text>
            </g>
          </svg>
          <div class="oc-muted" style="font-size: 12px">不信任方：{{ selected.untrusted }}</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">资产分级与保护要求</div>
          <Table :data="tm.assets" row-key="level" size="small">
            <template #level="{ row }">
              <Tag size="small" :theme="row.level.startsWith('A0') ? 'danger' : row.level.startsWith('A1') ? 'warning' : 'default'" variant="light-outline">{{ row.level }}</Tag>
            </template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            A0（凭证/密钥/主密钥）：密钥服务托管、永不出服务端安全域、引用式使用、销毁留证明。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">STRIDE 矩阵（选中边界：{{ selected.id }} {{ selected.name }}）</div>
        <Table
          :data="[strideRow]"
          row-key="boundary"
          size="small"
          :columns="[
            { colKey: 'boundary', title: '边界', width: 150 },
            { colKey: 'spoofing', title: 'Spoofing 仿冒', width: 180 },
            { colKey: 'tampering', title: 'Tampering 篡改', width: 180 },
            { colKey: 'repudiation', title: 'Repudiation 抵赖', width: 160 },
            { colKey: 'disclosure', title: 'Info Disclosure 泄露', width: 180 },
            { colKey: 'dos', title: 'DoS 拒绝服务', width: 160 },
            { colKey: 'elevation', title: 'Elevation 提权', width: 180 },
          ]"
        />
        <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
          <Tag size="small" variant="outline">控制点：{{ selected.control }}</Tag>
          <Tag size="small" theme="primary" variant="light-outline">红队映射：{{ selected.redTeamCase }}</Tag>
        </div>
        <CopyableId id="trace-sec-tm-0912" label="复制 traceId" />
      </div>

      <div v-if="reviews.length" class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">威胁建模评审记录（{{ pendingReviews.length }} 项待评审）</div>
        <div v-for="rv in reviews" :key="rv.at" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 4px">
          <Tag size="small" theme="warning" variant="light-outline">{{ rv.status }}</Tag>
          <span class="oc-muted" style="font-size: 12px">{{ new Date(rv.at).toLocaleString('zh-CN') }}</span>
          <span style="font-size: 12px">范围：{{ rv.scope }}</span>
          <span class="oc-muted" style="font-size: 12px">评审人 {{ rv.reviewer }} · 计划 {{ rv.dueAt }} 前完成（结论回写 STRIDE 与红队用例）</span>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="reviewOpen" header="发起威胁建模评审" width="580px" :confirm-btn="{ content: '发起评审', theme: 'primary' }" cancel-btn="取消" @confirm="submitReview">
      <div class="oc-stack">
        <Input v-model="reviewForm.scope" size="small" placeholder="评审范围（必填，如 边界 B3 内核↔模型端点）" />
        <Input v-model="reviewForm.reviewer" size="small" placeholder="评审人（必填）" />
        <Input v-model="reviewForm.dueAt" size="small" placeholder="计划完成日期（YYYY-MM-DD）" />
        <div class="oc-muted" style="font-size: 12px">
          评审期间该范围架构变更冻结；结论需回写 STRIDE 矩阵与红队用例映射后才算完成，未评审变更不得进入生产。
        </div>
      </div>
    </Dialog>
  </div>
</template>
