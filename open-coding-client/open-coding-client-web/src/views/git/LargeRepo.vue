<script setup lang="ts">
/**
 * I-13 大仓性能面板。
 * 部分克隆（blobless）+ 稀疏检出 + commit-graph + LFS；首次准备后台化并显示进度，
 * status 耗时对齐 SLO（≤500ms）。降级项（未启用 commit-graph 等）显式标注并给启用动作。
 * 溯源：卷 21 D-GIT-8/§7 性能；BUILD-MANIFEST I-13。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Option, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcChart from '@/components/common/OcChart.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { GitRepo } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE'>('LOADING');
const repoName = ref('legacy-billing');
const preparing = ref(false);

const repos = computed(() => platformData.git.repos);
const repo = computed<GitRepo>(() => repos.value.find((r) => r.repo === repoName.value) ?? repos.value[0]);
const prep = computed(() => platformData.git.repoPrep);
const isLarge = computed(() => repo.value.sizeMb > 10000);

const statusSeries = computed(() => [
  { name: 'status 耗时（ms）', points: [1840, 1420, 980, 720, 560, 486].map((v, i) => ({ x: `第 ${i + 1} 次`, y: v })) },
]);

const columns = [
  { colKey: 'repo', title: '仓库', width: 190, cell: 'repo' },
  { colKey: 'sizeMb', title: '体积', width: 120, cell: 'size' },
  { colKey: 'partialClone', title: '部分克隆', width: 120, cell: 'pc' },
  { colKey: 'sparse', title: '稀疏检出', width: 240, cell: 'sparse' },
  { colKey: 'commitGraph', title: 'commit-graph', width: 150, cell: 'cg' },
  { colKey: 'lfs', title: 'LFS', width: 110, cell: 'lfs' },
  { colKey: 'op', title: '操作', width: 110, cell: 'op' },
];

const degraded = computed(() => repos.value.filter((r) => r.sizeMb > 10000 && (!r.commitGraph || !r.partialClone)));

function startPrep() {
  preparing.value = true;
  MessagePlugin.success(`首次准备已后台化：${repo.value.repo}（部分克隆 + 稀疏检出 + commit-graph 构建，显示进度并可在安全点暂停）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = repos.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="大仓性能"
      desc="大仓优化四件套：部分克隆（blobless / treeless）、稀疏检出、索引加速（commit-graph + fsmonitor）、LFS;首次准备后台化并显示进度，status 目标 ≤500ms。"
      volume="卷 21" manifest="I-13" cli="oc git repo prepare --repo legacy-billing --partial --sparse billing/** --commit-graph"
      :status="[{ label: `status ${prep.statusCheckMs}ms`, theme: prep.statusCheckMs <= 500 ? 'success' : 'warning' }, { label: '首次准备可后台化', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 150px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'OFFLINE', label: '离线' },
        ]" />
        <Select v-model="repoName" size="small" style="width: 200px" aria-label="选择仓库" :options="repos.map((r) => ({ value: r.repo, label: r.repo }))" />
        <Button size="small" theme="primary" :disabled="preparing" @click="startPrep">{{ preparing ? '准备中' : '首次准备' }}</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="最大仓库体积" :value="Math.max(...repos.map((r) => r.sizeMb)) / 1024" unit="GB" icon="database" hint="大仓（>10GB）走部分克隆 + 稀疏检出" />
      <StatCard label="status 耗时" :value="prep.statusCheckMs" unit="ms" icon="time" :target="500" target-kind="max" hint="SLO：≤500ms（索引优化后）" />
      <StatCard label="首次准备进度" :value="prep.progress * 100" format="percent" icon="loading" :hint="`预计剩余 ${prep.etaSeconds}s`" />
      <StatCard label="优化未达标仓库" :value="degraded.length" icon="bug" hint="大仓未启用关键优化 → 显式标注并给启用动作" />
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">status 耗时优化曲线（越接近 500ms 越好）</h3>
        <OcChart type="line" :height="200" unit="ms" :series="statusSeries" :threshold="{ value: 500, label: 'SLO 500ms' }" aria-label="status 耗时趋势" />
        <Tag :theme="prep.statusCheckMs <= 500 ? 'success' : 'warning'" variant="light-outline" size="small" style="margin-top: 8px">
          当前 {{ prep.statusCheckMs }}ms（{{ prep.statusCheckMs <= 500 ? '达标' : '未达标：正在构建 commit-graph' }}）
        </Tag>
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">
          首次准备进度：{{ repo.repo }}
          <CliHint :command="`oc git repo prepare --repo ${repo.repo} --partial --sparse '${repo.sparse}'`" />
        </h3>
        <Progress :percentage="Math.round(prep.progress * 100)" :status="preparing ? 'active' : 'success'" theme="line" />
        <Table
          :data="prep.steps" size="small" :pagination="undefined" row-key="step" style="margin-top: 8px"
          :columns="[{ colKey: 'step', title: '步骤', width: 170 }, { colKey: 'status', title: '状态', width: 120, cell: 'st' }, { colKey: 'detail', title: '说明', ellipsis: true }]"
        >
          <template #st="{ row }">
            <Tag :theme="row.status === 'SUCCEEDED' ? 'success' : row.status === 'RUNNING' ? 'primary' : 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
          </template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag v-if="!repo.lfs" theme="warning" variant="light-outline" size="small">未启用 LFS：>100MB 文件提交将被阻断（可配置为 LFS）</Tag>
          <Tag size="small" variant="outline">准备过程可在安全点暂停，不丢已完成阶段（阶段结果可复用）</Tag>
        </div>
      </div>
    </div>

    <StateShell
      :state="demo" stage="正在读取仓库优化状态与准备进度…"
      empty-title="没有仓库" empty-desc="尚未打开任何仓库；大仓优化仅在打开仓库后生效。"
      empty-action="打开仓库" example-task="对 46GB 的 legacy-billing 启用部分克隆与稀疏检出，观察 status 耗时下降"
      what="仓库优化状态读取失败" why="远端不可达（部分克隆下按需拉取 blob 失败），准备流程无法继续"
      how="可重试；已完成阶段的结果会被复用，无需从头准备" trace-id="trace-ecc0f3ee"
      :reconnect-in-ms="7000" :disabled-capabilities="['按需 blob 拉取', 'commit-graph 构建']"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @dismiss-offline="demo = 'NORMAL'"
    >
      <Table :data="repos" :columns="columns" row-key="repo" size="small" :pagination="undefined">
        <template #repo="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <span class="oc-mono">{{ row.repo }}</span>
            <Tag v-if="row.sizeMb > 10000" theme="warning" size="small" variant="light-outline">大仓</Tag>
          </div>
        </template>
        <template #size="{ row }">{{ (row.sizeMb / 1024).toFixed(1) }} GB</template>
        <template #pc="{ row }">
          <Tag :theme="row.partialClone ? 'success' : (row.sizeMb > 10000 ? 'warning' : 'default')" size="small" variant="light-outline">
            {{ row.partialClone ? '已启用' : row.sizeMb > 10000 ? '未启用（大仓建议启用）' : '未启用' }}
          </Tag>
        </template>
        <template #sparse="{ row }"><span class="oc-mono oc-truncate">{{ row.sparse }}</span></template>
        <template #cg="{ row }">
          <Tag :theme="row.commitGraph ? 'success' : 'warning'" size="small" variant="light-outline">{{ row.commitGraph ? '已构建' : '未构建' }}</Tag>
        </template>
        <template #lfs="{ row }">
          <Tag :theme="row.lfs ? 'success' : 'default'" size="small" variant="light-outline">{{ row.lfs ? '启用' : '未启用' }}</Tag>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="repoName = row.repo as string; preparing = true">准备</Button>
        </template>
      </Table>
      <div class="oc-card" style="margin-top: 12px">
        <h3 class="oc-card__title">优化建议（针对未达标项）</h3>
        <InfoGrid
          :columns="1"
          :items="degraded.length
            ? degraded.map((r) => ({ key: r.repo, label: r.repo, value: `${r.partialClone ? '' : '启用部分克隆（blobless）；'}${r.commitGraph ? '' : '构建 commit-graph（加速 log/merge-base）；'}${r.lfs ? '' : '大文件改走 LFS'}` }))
            : [{ key: 'ok', label: '全部达标', value: '所有大仓均已启用部分克隆与 commit-graph，status 在 SLO 内' }]"
        />
      </div>
    </StateShell>

    <div class="oc-card">
      <h3 class="oc-card__title">性能目标与降级说明</h3>
      <InfoGrid :columns="2" :items="[
        { key: 'p1', label: 'status / diff（大仓）', value: '≤ 500ms（索引优化后）' },
        { key: 'p2', label: 'worktree 创建', value: '≤ 2s（部分克隆下更慢，异步化并显示进度）' },
        { key: 'p3', label: '合并队列吞吐', value: '≥ 10 次/分钟（串行化不牺牲健康度）' },
        { key: 'p4', label: '降级提示', value: '未启用 LFS / commit-graph 时在列表与详情显式标注，并给出启用入口（不静默）' },
      ]" />
    </div>
  </div>
</template>
