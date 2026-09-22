<script setup lang="ts">
/**
 * O-04 环境差异面板。
 * 探测结果 vs `.oc/env.yaml` 声明：差异分级（major/minor）与建议动作；
 * 「一键准备」是写操作（安装/升级依赖），必须说明后果与可撤销性。
 * 溯源：卷 20 D-WS-12/§4.3；BUILD-MANIFEST O-04。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, MessagePlugin, Option, Popconfirm, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE'>('LOADING');
const wsId = ref('ws-0003');
const preparing = ref(false);
const progress = ref(0);
/** 准备进度模拟的定时器句柄（完成时与组件卸载时都要清理） */
let prepareTimer: number | null = null;

const ws = computed(() => platformData.workspaces.find((w) => w.workspaceId === wsId.value) ?? platformData.workspaces[2]);
const diffs = computed(() => ws.value.envProfile.diffFromManifest);
const majorCount = computed(() => diffs.value.filter((d) => d.severity === 'major').length);
const minorCount = computed(() => diffs.value.filter((d) => d.severity === 'minor').length);

const columns = [
  { colKey: 'tool', title: '工具 / 依赖', width: 160, cell: 'tool' },
  { colKey: 'expected', title: '清单期望（.oc/env.yaml）', width: 200 },
  { colKey: 'actual', title: '实际探测', width: 200 },
  { colKey: 'severity', title: '差异等级', width: 120, cell: 'sev' },
  { colKey: 'action', title: '建议动作', ellipsis: true },
];

const state = computed(() => (demo.value === 'NORMAL' && !diffs.value.length ? 'EMPTY' : demo.value));

function prepare() {
  // 防重：准备进行中重复确认直接忽略，避免叠加多个定时器
  if (preparing.value) return;
  preparing.value = true;
  progress.value = 10;
  prepareTimer = window.setInterval(() => {
    progress.value = Math.min(100, progress.value + 22);
    if (progress.value < 100) return;
    // 到达 100% 即收敛：停表并复位准备态（否则进度条永久 active、统计口径卡在「准备中」）
    if (prepareTimer !== null) window.clearInterval(prepareTimer);
    prepareTimer = null;
    preparing.value = false;
    MessagePlugin.success('环境准备完成：差异已按清单收敛，准备前快照已保留（可全量/单文件恢复）');
  }, 600);
  MessagePlugin.info('环境准备已启动：按清单安装/升级依赖并预热缓存（首次准备结果会被缓存复用）');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.workspaces.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
onUnmounted(() => {
  // 离开页面时清理进度定时器：避免残留无归属定时器继续推进已卸载组件的状态
  if (prepareTimer !== null) window.clearInterval(prepareTimer);
  prepareTimer = null;
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="环境差异"
      desc="清单（.oc/env.yaml）声明期望版本与工具，探测结果与之对比得到差异报告；CI 与本地共用同一清单，减少「在我机器上能跑」。"
      volume="卷 20" manifest="O-04" :cli="`oc workspace env diff --id ${ws.workspaceId} && oc workspace env prepare --id ${ws.workspaceId}`"
      :status="[{ label: `major ${majorCount}`, theme: majorCount ? 'danger' : 'success' }, { label: `minor ${minorCount}`, theme: minorCount ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 150px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '无差异' },
          { value: 'ERROR', label: '错误' }, { value: 'OFFLINE', label: '离线' },
        ]" />
        <Select v-model="wsId" size="small" style="width: 230px" aria-label="选择工作区">
          <Option v-for="w in platformData.workspaces" :key="w.workspaceId" :value="w.workspaceId" :label="`${w.name}（${w.status}）`" />
        </Select>
        <Popconfirm theme="warning" :confirm-btn="{ content: '一键准备', theme: 'primary' }" cancel-btn="取消" @confirm="prepare">
          <template #content>
            <div style="max-width: 340px">
              <div>后果：按清单安装/升级依赖、预热缓存；可能需要数分钟并占用网络带宽。</div>
              <div>影响面：仅当前工作区；不影响其他工作区与宿主机全局环境。</div>
              <div>是否可撤销：可撤销（准备前自动生成工作区快照，支持单文件/全量恢复）。</div>
            </div>
          </template>
          <Button size="small" theme="primary" :disabled="preparing">{{ preparing ? '准备中…' : '一键准备' }}</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="差异总数" :value="diffs.length" icon="bug" hint="major 阻断准备建议先行修复" />
      <StatCard label="major 差异" :value="majorCount" icon="error" :hint="majorCount ? '可能导致构建行为不一致' : '无'" />
      <StatCard label="清单来源" :value="'.oc/env.yaml'" format="raw" icon="file" hint="CI 与本地共用（单一事实源）" />
      <StatCard label="准备缓存命中" :value="preparing ? 0 : 62" format="percent" icon="loading" hint="首次准备结果缓存复用，后续更快" />
    </div>

    <StateShell
      :state="state" stage="正在探测语言/工具链/包管理器并对比清单…"
      empty-title="环境与清单一致" empty-desc="无需准备；清单与探测结果完全匹配（含版本号与包管理器）。"
      empty-action="重新探测" example-task="在 CI 上复跑同一清单，验证本地与 CI 环境一致"
      what="环境探测失败" why="目标主机不可达（SSH 连接被拒绝或容器未就绪）"
      how="可重试；恢复连接后自动重探。差异报告不可用时不建议盲目准备环境" trace-id="trace-a66e3f29"
      :reconnect-in-ms="6000" :disabled-capabilities="['一键准备', '自动重探']"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @dismiss-offline="demo = 'NORMAL'"
    >
      <Table :data="diffs" :columns="columns" row-key="tool" size="small" :pagination="undefined">
        <template #tool="{ row }"><span class="oc-mono">{{ row.tool }}</span></template>
        <template #expected="{ row }"><span class="oc-mono">{{ row.expected }}</span></template>
        <template #actual="{ row }"><span class="oc-mono">{{ row.actual }}</span></template>
        <template #sev="{ row }">
          <Tag :theme="row.severity === 'major' ? 'danger' : row.severity === 'minor' ? 'warning' : 'success'" size="small" variant="light-outline">{{ row.severity }}</Tag>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          一键准备进度
          <CliHint :command="`oc workspace env prepare --id ${ws.workspaceId} --dry-run`" />
        </h3>
        <Progress :percentage="progress" :status="preparing ? 'active' : 'success'" theme="line" />
        <InfoGrid :columns="1" style="margin-top: 8px" :items="[
          { key: 'dry', label: 'dry-run 预览', value: '可先 dry-run：只输出将执行的动作与权限清单，零副作用' },
          { key: 'snapshot', label: '撤销', value: '准备前自动快照；可从快照恢复（全量/单文件/目录）' },
          { key: 'cache', label: '缓存', value: '准备结果按清单哈希缓存；清单不变时复用，不重复执行' },
          { key: 'scope', label: '影响面', value: '仅当前工作区；SSH 后端需目标主机允许写（受远端围栏约束）' },
        ]" />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">清单片段（.oc/env.yaml）</h3>
        <JsonBlock
          :mask="false" label=".oc/env.yaml"
          :value="{
            version: 1,
            languages: [ws.envProfile.languages[0], 'node 22.11.0'],
            packageManagers: ws.envProfile.packageManagers,
            tools: ws.envProfile.toolchain,
            init: ['pnpm install --frozen-lockfile', 'pnpm run build:types'],
            cache: { key: 'env-${hash(manifest)}', paths: ['.pnpm-store', 'node_modules/.cache'] },
          }"
        />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag size="small" variant="outline">清单变更即触发重探与差异报告</Tag>
          <Tag v-if="majorCount" theme="danger" size="small" variant="light-outline">存在 major 差异：准备前建议先确认版本要求</Tag>
        </div>
      </div>
    </div>
  </div>
</template>
