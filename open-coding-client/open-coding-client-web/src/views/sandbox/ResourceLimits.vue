<script setup lang="ts">
/** 资源限制（B-10）：CPU/内存/进程/输出/超时/磁盘 + 超限处置预览。溯源：卷 07 D-SBOX-6 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { resourceLimits, executionRecords } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const currentDimension = ref(resourceLimits[1]?.dimension ?? '');
const editorOpen = ref(false);
const err = ref(makeError('RESOURCE_EXCEEDED', '硬限低于平台原生控制能力（cgroups v2 最小内存粒度）'));

const current = computed(() => resourceLimits.find((r) => r.dimension === currentDimension.value) ?? resourceLimits[0]);
const exceeded = computed(() => executionRecords.filter((r) => r.peakMemMb > 2048 || r.peakCpuPercent > 400).length);

const columns = [
  { colKey: 'dimension', title: '维度', width: 130 },
  { colKey: 'softLimit', title: '软限（告警）', width: 200 },
  { colKey: 'hardLimit', title: '硬限（强制）', width: 200 },
  { colKey: 'onExceed', title: '超限处置', ellipsis: true },
];

const peakSeries = computed(() => [
  { name: '内存峰值（MB，硬限 2048）', points: executionRecords.map((r) => ({ x: r.recordId.slice(3), y: r.peakMemMb })) },
]);

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = resourceLimits.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

function save() {
  editorOpen.value = false;
  MessagePlugin.success(`已更新「${current.value.dimension}」限制：软限 ${current.value.softLimit} / 硬限 ${current.value.hardLimit}（下一次执行生效）`);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="资源限制"
      desc="平台原生资源控制（cgroups v2 / Job Objects / rlimit）+ 虚拟层兜底（超时、输出限额、进程数上限）：能力缺失时至少保证超时与输出限额。"
      volume="卷 07"
      manifest="B-10"
      cli="oc sandbox limits show --explain --with-preview"
      :status="[{ label: '兜底：超时 + 输出限额', theme: 'default' }, { label: `近 24h 超限 ${exceeded}`, theme: exceeded ? 'warning' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" @click="editorOpen = true">调整限制</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="限制维度" :value="resourceLimits.length" format="raw" icon="dashboard" />
      <StatCard label="内存硬限" :value="2048" unit="MB" format="raw" icon="layers" hint="超出即 OOM 终止进程组（exit 137）" />
      <StatCard label="输出硬限" :value="16" unit="MB" format="raw" icon="file" hint="超出转外置工件（保留尾部 4 KB）" />
      <StatCard label="执行超时硬限" :value="1800" unit="s" format="raw" icon="time" hint="提高需审批（长任务必须显式声明）" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有资源限制配置"
      empty-desc="限制配置缺失（异常态：资源限制必须始终存在，否则失控进程无边界）。"
      empty-action="重新加载"
      example-task="查看内存超限时的终止处置与部分输出保留"
      :what="'资源限制保存失败'"
      :why="err.message"
      how="硬限不能低于平台原生控制粒度：请适当提高硬限，或按平台能力改用虚拟层兜底（软限告警 + 超时终止）。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">限制维度与处置</h3>
          <Table row-key="dimension" size="small" :data="resourceLimits" :columns="columns" :hover="true" @row-click="(ctx: { row: Record<string, unknown> }) => (currentDimension = String(ctx.row.dimension))">
            <template #dimension="{ row }"><span class="oc-mono" style="font-weight: 600">{{ row.dimension }}</span></template>
            <template #softLimit="{ row }">
              <Tag size="small" variant="light-outline" theme="warning">{{ row.softLimit }}</Tag>
            </template>
            <template #hardLimit="{ row }">
              <Tag size="small" variant="light-outline" theme="danger">{{ row.hardLimit }}</Tag>
            </template>
            <template #onExceed="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.onExceed }}</span></template>
          </Table>
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">超限处置预览</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'dim', label: '维度', value: current.dimension },
              { key: 'soft', label: '软限（触发告警）', value: current.softLimit },
              { key: 'hard', label: '硬限（强制执行）', value: current.hardLimit },
              { key: 'act', label: '超限处置', value: current.onExceed },
              { key: 'prev', label: '预览（会发生什么）', value: current.preview, span: 1 },
            ]"
          />
          <div class="oc-divider" />
          <h3 class="oc-card__title">近 24h 内存峰值（对比硬限）</h3>
          <table class="oc-kv" style="width: 100%">
            <tbody>
              <tr v-for="r in executionRecords.slice(0, 5)" :key="r.recordId">
                <td class="oc-kv__k oc-mono" style="font-size: 11px">{{ r.recordId }}</td>
                <td>
                  <div style="height: 8px; background: var(--td-bg-color-secondarycontainer, #f3f3f3); border-radius: 4px; overflow: hidden">
                    <div
                      :style="{ width: `${Math.min(100, (r.peakMemMb / 2048) * 100)}%`, height: '100%', background: r.peakMemMb > 1800 ? 'var(--oc-sev-error)' : 'var(--oc-sev-ok)' }"
                    />
                  </div>
                </td>
                <td style="white-space: nowrap; font-size: 11px">{{ r.peakMemMb }} MB</td>
              </tr>
            </tbody>
          </table>
          <div class="oc-flex" style="margin-top: 8px; gap: 6px">
            <CliHint :command="`oc sandbox limits preview --dimension ${current.dimension}`" label="预览超限处置" />
            <Tooltip content="超限不静默：终止进程组后返回已产出输出与峰值报告（结构化结果，非异常）">
              <Tag size="small" variant="light-outline" theme="warning">终止后保留部分输出</Tag>
            </Tooltip>
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="editorOpen" :header="`调整限制：${current.dimension}`" width="560px" :on-confirm="save" :on-cancel="() => (editorOpen = false)">
      <div class="oc-stack">
        <div class="oc-flex" style="gap: 10px">
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">软限（告警）</div>
            <Input :model-value="current.softLimit" size="small" style="width: 180px" />
          </div>
          <div>
            <div class="oc-muted" style="font-size: 12px; margin-bottom: 4px">硬限（强制）</div>
            <Input :model-value="current.hardLimit" size="small" style="width: 180px" />
          </div>
        </div>
        <p class="oc-muted" style="font-size: 12px; margin: 0">
          后果：硬限超出将<b>终止进程组</b>（SIGKILL）并保留已产出输出；软限仅告警 + 降优先级。
          可逆：可随时调整（下一次执行生效，在途执行按启动时限制）。
          注意：提高上限会增加宿主风险（OOM / 磁盘打满）；企业档可锁定上限禁止上调。
        </p>
        <InfoGrid :columns="1" :items="[
          { key: 'p1', label: '平台实现', value: 'Linux cgroups v2 / macOS rlimit + 进程组 / Windows Job Objects（缺 IO 权重）' },
          { key: 'p2', label: '虚拟层兜底', value: '超时（SIGTERM → SIGKILL）、输出限额（转外置）、进程数上限（fork 拒绝）' },
        ]" />
      </div>
    </Dialog>
  </div>
</template>
