<script setup lang="ts">
/**
 * V-07 数据导出任务。
 * Parquet / JSONL → 对象存储 / 数据湖；展示状态、行数、产物校验和，支持重试与取消。
 * 溯源：卷 16 D-EVT-11/§4.7；BUILD-MANIFEST V-07。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData, humanBytes } from '@/mock/data/platform';
import type { ExportJob } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const statusFilter = ref('');
const createOpen = ref(false);
const form = ref({ target: '数据湖', format: 'parquet', range: '2026-09-01..2026-09-21', classes: 'domain' });
const submitted = ref<ExportJob | null>(null);

const jobs = computed(() => platformData.eventJobs.exportJobs);
const rows = computed(() => (statusFilter.value ? jobs.value.filter((j) => j.status === statusFilter.value) : jobs.value));
/** 已取消任务的本地状态：ExportJob.status 联合类型不含 CANCELLED，用本地映射呈现「已取消」并保留部分产物 */
const cancelled = ref<Record<string, { rows: number; sizeBytes: number; at: string }>>({});
const running = computed(() => jobs.value.filter((j) => j.status === 'RUNNING' && !cancelled.value[j.id]).length);
const state = computed(() => (demo.value === 'NORMAL' && !rows.value.length ? 'EMPTY' : demo.value));

const columns = [
  { colKey: 'id', title: '任务', width: 90, cell: 'id' },
  { colKey: 'format', title: '格式', width: 100, cell: 'format' },
  { colKey: 'target', title: '目标', width: 110 },
  { colKey: 'range', title: '范围', width: 260, cell: 'range' },
  { colKey: 'rows', title: '行数', width: 120, cell: 'rows' },
  { colKey: 'sizeBytes', title: '产物大小', width: 110, cell: 'size' },
  { colKey: 'status', title: '状态', width: 120, cell: 'status' },
  { colKey: 'checksum', title: '校验和', width: 160, cell: 'checksum' },
  { colKey: 'op', title: '操作', width: 120, cell: 'op' },
];

const STATUS_THEME: Record<string, 'success' | 'primary' | 'warning' | 'danger'> = { SUCCEEDED: 'success', RUNNING: 'primary', QUEUED: 'warning', FAILED: 'danger' };

function submit() {
  submitted.value = {
    id: `ex-${(jobs.value.length + 1).toString().padStart(2, '0')}`,
    target: form.value.target as ExportJob['target'],
    format: form.value.format as ExportJob['format'],
    range: `${form.value.range}（${form.value.classes} 类事件）`,
    status: 'QUEUED', rows: 0, sizeBytes: 0, startedAt: new Date().toISOString(), finishedAt: null, checksum: '—',
  };
  MessagePlugin.success(`导出任务已入队：${form.value.format} → ${form.value.target}；产物完成后写入校验和并可下载清单`);
  createOpen.value = false;
}

function retry(job: ExportJob) {
  MessagePlugin.success(`已重试 ${job.id}（幂等：相同范围与格式不重复产出）`);
}

/** 取消进行中的导出：安全点停止后续分片写入，已完成的计划部分保留（产物与行数不丢弃） */
function cancelJob(job: ExportJob) {
  if (job.status !== 'RUNNING') {
    MessagePlugin.warning(`仅进行中的任务可取消：${job.id} 当前为 ${job.status}`);
    return;
  }
  if (cancelled.value[job.id]) return;

  // 就地更新领域数据：记录结束时间，已导出行数与产物大小保持为已完成部分
  const finishedAt = new Date().toISOString();
  job.finishedAt = finishedAt;
  cancelled.value = { ...cancelled.value, [job.id]: { rows: job.rows, sizeBytes: job.sizeBytes, at: finishedAt } };
  MessagePlugin.warning(
    `已取消 ${job.id}：停止后续分片写入；已完成的 ${job.rows.toLocaleString('zh-CN')} 行 / ${humanBytes(job.sizeBytes)} 产物保留在${job.target}（可下载部分清单）`,
  );
}

onMounted(() => {
  window.setTimeout(() => (demo.value = jobs.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="事件导出任务"
      desc="批量导出走对象存储或数据湖（Parquet 压缩归档 / JSONL 便于外部消费）；导出前按敏感度脱敏，产物带校验和。"
      volume="卷 16" manifest="V-07" cli="oc event export create --format parquet --target lakehouse"
      :status="[{ label: `${jobs.length} 个任务`, theme: 'default' }, { label: running ? `${running} 个进行中` : '无进行中', theme: running ? 'primary' : 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="statusFilter" size="small" style="width: 130px" clearable placeholder="按状态" aria-label="状态过滤">
          <Option value="" label="全部状态" />
          <Option value="SUCCEEDED" label="SUCCEEDED" />
          <Option value="RUNNING" label="RUNNING" />
          <Option value="FAILED" label="FAILED" />
        </Select>
        <Button size="small" theme="primary" @click="createOpen = true">新建导出</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="今日导出字节" :value="jobs.reduce((a, j) => a + j.sizeBytes, 0)" format="token" unit="B" icon="download" hint="归档压缩（Parquet + zstd）" />
      <StatCard label="成功任务" :value="jobs.filter((j) => j.status === 'SUCCEEDED').length" icon="check" hint="含审计导出与数据湖增量" />
      <StatCard label="失败任务" :value="jobs.filter((j) => j.status === 'FAILED').length" icon="error" hint="失败原因与日志引用保留 7 天" />
      <StatCard label="导出延迟（P95）" :value="22" unit="分钟" icon="time" hint="大批量导出后台化，不阻塞在线查询" />
    </div>

    <StateShell
      :state="state" stage="正在读取导出任务与产物清单…"
      empty-title="没有导出任务" empty-desc="当前过滤条件没有命中任务；可按状态清除过滤或新建一个导出。"
      empty-action="清除过滤" example-task="把近 30 天审计事件导出为 JSONL 到对象存储，供 SIEM 消费"
      what="导出任务列表读取失败" why="对象存储清单接口超时（跨区复制正在追赶，读一致性降级）"
      how="可重试；失败任务可从死信与产物清单重建状态" trace-id="trace-a17c9930"
      @retry="demo = 'NORMAL'" @empty-action="statusFilter = ''"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono">{{ row.id }}</span></template>
        <template #format="{ row }">
          <Tag :theme="row.format === 'parquet' ? 'primary' : 'default'" size="small" variant="light-outline">{{ row.format }}</Tag>
        </template>
        <template #range="{ row }"><span class="oc-truncate">{{ row.range }}</span></template>
        <template #rows="{ row }">{{ row.rows.toLocaleString('zh-CN') }}</template>
        <template #size="{ row }">{{ row.sizeBytes ? humanBytes(row.sizeBytes) : '—' }}</template>
        <template #status="{ row }">
          <Tag v-if="cancelled[row.id]" theme="default" size="small" variant="light-outline">已取消</Tag>
          <Tag v-else :theme="STATUS_THEME[row.status] ?? 'default'" size="small" variant="light-outline">{{ row.status }}</Tag>
        </template>
        <template #checksum="{ row }"><span class="oc-mono oc-truncate">{{ row.checksum }}</span></template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="retry(row as ExportJob)">重试</Button>
          <Popconfirm
            theme="danger"
            :confirm-btn="{ content: '取消导出', theme: 'danger' }" cancel-btn="返回"
            @confirm="cancelJob(row as ExportJob)"
          >
            <template #content>
              <div style="max-width: 320px">
                <div>取消后停止后续分片导出：已完成的 {{ row.rows.toLocaleString('zh-CN') }} 行 / {{ row.sizeBytes ? humanBytes(row.sizeBytes) : '0 B' }} 产物保留在{{ row.target }}，可下载部分清单。</div>
                <div>不可撤销：如需继续请重新入队（相同范围与格式按幂等复用，不重复产出）。</div>
              </div>
            </template>
            <Button size="small" variant="text" theme="danger" :disabled="row.status !== 'RUNNING' || !!cancelled[row.id]">取消</Button>
          </Popconfirm>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="createOpen" header="新建导出任务" width="600px" :confirm-btn="{ content: '入队导出', theme: 'primary' }" cancel-btn="取消" @confirm="submit">
      <div class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'note', label: '导出语义', value: '只读导出，不触发副作用；产物为不可变对象（校验和随清单生成）' },
          { key: 'redact', label: '脱敏', value: 'sensitive 事件仅导出脱敏后的载荷；密钥类字段永不导出' },
        ]" />
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <Select v-model="form.target" size="small" style="width: 180px" aria-label="目标">
            <Option value="数据湖" label="数据湖（Parquet 增量）" />
            <Option value="对象存储" label="对象存储（归档包）" />
          </Select>
          <Select v-model="form.format" size="small" style="width: 160px" aria-label="格式">
            <Option value="parquet" label="Parquet（压缩）" />
            <Option value="jsonl" label="JSONL（逐行）" />
          </Select>
          <Select v-model="form.classes" size="small" style="width: 180px" aria-label="事件类">
            <Option value="domain" label="domain 领域事件" />
            <Option value="system" label="system 系统事件" />
            <Option value="audit" label="audit 审计事件" />
            <Option value="telemetry" label="telemetry 遥测（10% 采样）" />
          </Select>
        </div>
        <Input v-model="form.range" size="small" placeholder="时间范围，例如 2026-09-01..2026-09-21" />
        <CliHint :command="`oc event export create --format ${form.format} --target ${form.target} --range ${form.range}`" />
        <div v-if="submitted" class="oc-card">
          <Tag theme="primary" variant="light-outline" size="small">已入队 {{ submitted.id }}</Tag>
          <div style="font-size: 12px; margin-top: 6px">大批量导出后台执行并显示进度；完成后写入对象存储清单与校验和。</div>
        </div>
      </div>
    </Dialog>
  </div>
</template>
