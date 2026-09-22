<script setup lang="ts">
/**
 * 插件兼容性矩阵（L-07）：插件 × 内核版本支持矩阵 + 升级/降级建议。
 * 溯源：卷 18 D-PLG-1 版本区间 / §4.5 契约测试；不支持即显式标注并给出动作（升级插件 / 保持内核）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import StatCard from '@/components/common/StatCard.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';

const router = useRouter();
const plugins = extensionData.plugins;
const kernels = ['1.0', '1.1', '1.2', '1.3'];
const currentKernel = ref('1.3');

/** 契约测试队列（ref）：记录排队时的目标内核 + 每个插件的预计执行顺序；结果异步回写矩阵 */
const contractQueue = ref<{ kernel: string; at: string; orders: Record<string, number> } | null>(null);

const rows = computed(() =>
  plugins.map((p) => {
    const q = contractQueue.value;
    return {
      id: p.id,
      name: p.name,
      version: p.version,
      source: p.source,
      compatible: p.kernel.compatible,
      queueOrder: q?.orders[p.id] ?? 0,
      cells: kernels.map((k) => {
        const state = p.compat.find((c) => c.kernel === k)?.state ?? 'untested';
        // 排队针对排队时的目标内核：该内核下未验证格转为 queued，避免未验证被误读为已支持
        const order = q && q.kernel === k ? q.orders[p.id] : undefined;
        return { kernel: k, state: order && state === 'untested' ? 'queued' : state, order: order ?? 0 };
      }),
    };
  }),
);

const columns = computed(() => [
  { colKey: 'name', title: '插件', width: 280 },
  { colKey: 'compatible', title: '清单声明区间', width: 150 },
  ...kernels.map((k) => ({ colKey: k, title: `内核 ${k}${k === currentKernel.value ? '（当前）' : ''}`, width: 130 })),
  { colKey: 'ops', title: '建议', width: 200 },
]);

const stats = computed(() => {
  const cells = rows.value.flatMap((r) => r.cells);
  return {
    supported: cells.filter((c) => c.state === 'supported').length,
    deprecated: cells.filter((c) => c.state === 'deprecated').length,
    unsupported: cells.filter((c) => c.state === 'unsupported').length,
    untested: cells.filter((c) => c.state === 'untested').length,
    queued: cells.filter((c) => c.state === 'queued').length,
  };
});

const issues = computed(() =>
  rows.value
    .map((r) => {
      const cur = r.cells.find((c) => c.kernel === currentKernel.value);
      if (!cur || cur.state === 'supported') return null;
      if (cur.state === 'queued') return { id: r.id, name: r.name, level: 'info' as const, text: `契约测试已排队（预计第 ${cur.order} 位）：结果回写前不得在生产启用` };
      if (cur.state === 'untested') return { id: r.id, name: r.name, level: 'warning' as const, text: '未验证：请跑契约测试（oc-plugin test --contract）后再在生产启用' };
      return { id: r.id, name: r.name, level: 'danger' as const, text: '不支持当前内核：升级插件到兼容版本，或保持内核并寻找替代插件（不建议降级内核）' };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null),
);

/** 矩阵格状态（queued 表示契约测试已排队，执行完成后回写 supported / unsupported） */
function cellState(row: { cells: { kernel: string; state: string }[] }, k: string) {
  return row.cells.find((c) => c.kernel === k)?.state ?? 'untested';
}

/** 矩阵格排队位次：用于展示契约测试的预计执行顺序 */
function cellOrder(row: { cells: { kernel: string; state: string; order: number }[] }, k: string) {
  return row.cells.find((c) => c.kernel === k)?.order ?? 0;
}

function cellTheme(state: string): 'success' | 'warning' | 'danger' | 'default' | 'primary' {
  return state === 'supported' ? 'success' : state === 'queued' ? 'primary' : state === 'deprecated' ? 'warning' : state === 'unsupported' ? 'danger' : 'default';
}

/** 批量跑契约测试：为全部插件按当前列表顺序排队，标记矩阵与统计计数（异步执行，结果回写） */
function queueContractTests() {
  const orders: Record<string, number> = {};
  rows.value.forEach((r, i) => (orders[r.id] = i + 1));
  contractQueue.value = { kernel: currentKernel.value, at: new Date().toISOString(), orders };
  MessagePlugin.success(`已为全部 ${rows.value.length} 个插件排队契约测试（内核 ${currentKernel.value}，预计顺序 #1–#${rows.value.length}，异步回写矩阵）`);
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/plugins/compatibility', () => rows.value.length > 0);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="插件兼容矩阵"
      desc="插件 × 内核版本支持矩阵；兼容性在装载期强制校验（不兼容即拒绝装载），未验证项显式标注。"
      volume="卷 18" manifest="L-07" cli="oc plugin compat --kernel 1.3 --matrix"
      :status="[{ label: `当前内核 ${currentKernel}`, theme: 'primary' }, { label: `不支持 ${stats.unsupported} 格`, theme: stats.unsupported ? 'danger' : 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/plugins')">返回市场</Button>
        <Button size="small" variant="outline" @click="queueContractTests">批量跑契约测试</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="pageState"
      :trace-id="pageTraceId"
      empty-title="对象不存在或已被清理"
      empty-desc="按链接标识未命中：可能已被卸载、清理或标识有误；请从列表重新进入。"
      what="页面数据加载失败"
      why="该页依赖的索引 / 配置读取失败（不影响其它模块与已加载数据）。"
      how="可重试；持续失败请导出诊断包并附 traceId 便于定位。"
      @retry="reloadPage"
    >


    <Alert
      v-if="issues.length"
      theme="warning"
      :message="`${issues.length} 个插件在当前内核下存在兼容问题`"
      :description="`${issues.map((i) => i.name).join('、')}；处理动作见矩阵「建议」列，拒绝静默沿用。`"
    />

    <div class="oc-grid oc-grid--4">
      <StatCard label="supported 格" :value="stats.supported" unit="格" icon="check" />
      <StatCard label="deprecated（仍可用）" :value="stats.deprecated" unit="格" icon="time" />
      <StatCard label="unsupported" :value="stats.unsupported" unit="格" icon="close" :lower-is-better="true" />
      <StatCard label="untested（需契约测试）" :value="stats.untested" unit="格" icon="help" :lower-is-better="true" :hint="stats.queued ? `本次已排队 ${stats.queued} 格，执行结果异步回写` : '未验证前禁止在生产启用'" />
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <span class="oc-secondary" style="font-size: 12px">目标内核版本</span>
        <Select
          v-model="currentKernel" size="small" style="width: 140px"
          :options="kernels.map((k) => ({ label: `内核 ${k}`, value: k }))"
        />
        <span class="oc-muted" style="font-size: 12px">
          <OcIcon name="help" size="12px" /> 兼容性检查在装载流水线第 4 步执行：内核版本 + 扩展点版本 + 宿主形态
        </span>
        <span v-if="contractQueue" class="oc-muted" style="font-size: 12px">
          <OcIcon name="time" size="12px" /> 契约测试已排队：{{ Object.keys(contractQueue.orders).length }} 个插件（内核 {{ contractQueue.kernel }}，{{ new Date(contractQueue.at).toLocaleString('zh-CN') }}）
        </span>
      </div>
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">支持矩阵</h3>
      <Table row-key="id" size="small" :data="rows" :columns="columns" table-layout="fixed">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span style="font-size: 13px">{{ row.name }}</span>
            <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.id }} · {{ row.version }}</span>
          </div>
        </template>
        <template #compatible="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.compatible }}</span></template>
        <template v-for="k in kernels" #[k]="{ row }" :key="k">
          <Tooltip :content="cellState(row, k)">
            <Tag
              size="small"
              :theme="cellTheme(cellState(row, k))"
              variant="light-outline"
            >
              {{ cellState(row, k) === 'queued' ? `已排队 #${cellOrder(row, k)}` : cellState(row, k) }}
            </Tag>
          </Tooltip>
        </template>
        <template #ops="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <Tag
              v-if="cellState(row, currentKernel) === 'supported'"
              size="small" theme="success" variant="light-outline"
            >可继续使用</Tag>
            <Tag
              v-else-if="cellState(row, currentKernel) === 'untested'"
              size="small" theme="warning" variant="light-outline"
            >先跑契约测试</Tag>
            <Tag
              v-else-if="cellState(row, currentKernel) !== 'queued'"
              size="small" theme="danger" variant="light-outline"
            >升级或替换</Tag>
            <Tag
              v-if="row.queueOrder"
              size="small" theme="primary" variant="light-outline"
            >已排队 #{{ row.queueOrder }}（预计顺序）</Tag>
            <Button size="small" variant="text" @click="router.push({ path: '/extension/plugins/upgrade', query: { id: row.id } })">升级 / 回滚</Button>
          </div>
        </template>
      </Table>
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">状态语义</h3>
      <div class="oc-kv">
        <span class="oc-kv__k">supported</span><span>与内核版本区间匹配且契约测试通过：可装载并启用</span>
        <span class="oc-kv__k">deprecated</span><span>仍可用但已标记弃用（≥2 小版本兼容期）：给出升级提示与运行时告警</span>
        <span class="oc-kv__k">unsupported</span><span>不兼容：装载期拒绝（不尝试降级运行）；建议升级插件或保持内核</span>
        <span class="oc-kv__k">untested</span><span>未验证：需跑契约测试；未验证前禁止在生产启用（开发环境可显式豁免并留痕）</span>
      </div>
    </div>
    </StateShell>
  </div>
</template>
