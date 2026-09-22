<script setup lang="ts">
/**
 * IDE 集成（G2-01）：VS Code / JetBrains / Neovim / Zed 四行 × 7 能力矩阵（支持=绿 / 开发中=黄 /
 * 不支持=灰并给出原因），连接状态（IDE 类型 / 版本 / 最近连接）与「瘦客户端」定位说明。
 * 溯源：卷 29 / BUILD-MANIFEST G2-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData } from '@/mock/data/enterprise';

const d = enterpriseData;
const ides = d.ideIntegrations;

/** 能力支持度：✔=支持（绿）· 渐进/部分=开发中（黄）· ✖=不支持（灰）；灰格必须给原因 */
const SUPPORT_META: Record<string, { label: string; theme: 'success' | 'warning' | 'default' }> = {
  '✔': { label: '支持', theme: 'success' },
  渐进: { label: '开发中', theme: 'warning' },
  部分: { label: '开发中', theme: 'warning' },
  '✖': { label: '不支持', theme: 'default' },
};

/** 不支持/部分 组合的原因（不以「暂无」搪塞，给出替代路径） */
const REASON: Record<string, string> = {
  'Neovim-诊断（装配/插件健康）': 'TUI 无侧栏视图承载诊断面板；替代：终端执行 oc doctor --json',
  'Neovim-建议（LSP 式）': '建议能力由 Neovim 原生 LSP 生态提供，插件不重复实现（避免双实现漂移）',
  'Zed-诊断（装配/插件健康）': 'Zed 扩展协议暂无面板 API；替代：命令面板输出 + 导出诊断包',
  'Zed-建议（LSP 式）': '扩展协议尚未暴露建议注入点，随上游 API 补齐',
  'Neovim-内联 diff 应用': '部分文件类型可用（灰度中）：二进制与大文件仅提供外部 diff 链接',
  'Zed-内联 diff 应用': '部分文件类型可用（灰度中）：随扩展协议版本逐步放量',
  'Neovim-引用跳转（知识/记忆）': '部分可用：知识页可跳转，记忆条目待协议补齐',
  'Zed-引用跳转（知识/记忆）': '部分可用：知识页可跳转，记忆条目待协议补齐',
};

/** 能力矩阵行：能力 × 4 IDE，列值取自各自的 capabilities 顺序（同一能力集合） */
const capRows = computed(() =>
  ides[0].capabilities.map((cap, i) => ({
    key: cap.key,
    label: cap.label,
    cells: ides.map((ide) => ({ ide: ide.ide, support: ide.capabilities[i]?.support ?? '✖', note: ide.capabilities[i]?.note ?? '' })),
  })),
);

/** 汇总「不支持 / 开发中」组合及原因，保证不 hover 也能读到（可访问性） */
const unsupportedNotes = computed(() =>
  capRows.value.flatMap((row) =>
    row.cells
      .filter((c) => SUPPORT_META[c.support]?.label !== '支持')
      .map((c) => ({ key: `${c.ide}-${row.label}`, ide: c.ide, cap: row.label, support: c.support, reason: REASON[`${c.ide}-${row.label}`] ?? c.note ?? '计划随版本补齐' })),
  ),
);

/** 连接状态：IDE 类型 / 版本 / 最近连接（含 2 条离线负样本，可发起重连） */
const connections = ref([
  { id: 'conn-01', ide: 'VS Code', version: '0.9.2', kernel: '2.9.1', lastConnectedAt: '2026-09-21T21:58:00+08:00', state: '在线', note: '会话面板已挂载当前工作区' },
  { id: 'conn-02', ide: 'JetBrains', version: '0.8.2', kernel: '2.9.1', lastConnectedAt: '2026-09-21T19:20:00+08:00', state: '在线', note: '审批卡片（含 diff）可用' },
  { id: 'conn-03', ide: 'Neovim', version: '0.7.2', kernel: '2.9.0', lastConnectedAt: '2026-09-20T23:41:00+08:00', state: '离线', note: '连接断开：本机代理未启动（重连后自动恢复）' },
  { id: 'conn-04', ide: 'Zed', version: '0.6.2', kernel: '2.9.1', lastConnectedAt: '2026-09-21T09:12:00+08:00', state: '在线', note: '仅使用交集能力（协议 v1）' },
  { id: 'conn-05', ide: 'VS Code', version: '0.9.1', kernel: '2.7.9', lastConnectedAt: '2026-09-18T14:05:00+08:00', state: '已升级', note: '低版本插件连高版本内核：仅交集能力' },
  { id: 'conn-06', ide: 'JetBrains', version: '0.8.0', kernel: '2.8.4', lastConnectedAt: '2026-09-15T10:33:00+08:00', state: '离线', note: 'IDE 升级后需重启插件进程' },
]);

const STATE_THEME: Record<string, 'success' | 'warning' | 'default'> = { 在线: 'success', 离线: 'warning', 已升级: 'default' };
const connColumns = [
  { colKey: 'ide', title: 'IDE 类型', width: 130 },
  { colKey: 'version', title: '插件版本', width: 110, cell: 'version' },
  { colKey: 'lastConnectedAt', title: '最近连接', width: 180, cell: 'at' },
  { colKey: 'state', title: '状态', width: 100, cell: 'state' },
  { colKey: 'note', title: '说明', ellipsis: true },
  { colKey: 'ops', title: '操作', width: 90, cell: 'ops' },
];

type ShellState = 'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA';

const PAGE_SIZE = 4;
const loading = ref(true);
const limit = ref(PAGE_SIZE);
const errorMsg = ref('');
const errorTrace = ref('trace-ide-4c81de');
const retryingId = ref('');

const visible = computed(() => connections.value.slice(0, limit.value));
const matched = computed(() => connections.value);
const edgeSummary = computed(() => `连接记录 ${connections.value.length} 条，超过单次渲染阈值（${PAGE_SIZE} 条）已折叠。`);
const state = computed<ShellState>(() => {
  if (loading.value) return 'LOADING';
  if (errorMsg.value) return 'ERROR';
  if (!connections.value.length) return 'EMPTY';
  return connections.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});
const online = computed(() => connections.value.filter((c) => c.state === '在线').length);

function reload() {
  loading.value = true;
  window.setTimeout(() => (loading.value = false), 200);
}

function loadMore() {
  limit.value += PAGE_SIZE;
}

/**
 * 重连：首次失败（本机代理未启动，Fail-Closed 并给出可执行恢复动作），
 * 再次点击视为「已启动代理后重试」→ 恢复为在线；失败不静默吞掉。
 */
function reconnect(row: { id: string; ide: string }) {
  retryingId.value = row.id;
  if (errorMsg.value) {
    errorMsg.value = '';
    connections.value = connections.value.map((c) => (c.id === row.id ? { ...c, state: '在线', note: '重连成功：代理已启动，能力按内核 2.9.1 提供' } : c));
    retryingId.value = '';
    MessagePlugin.success(`${row.ide} 重连成功（协议 v1 握手完成）`);
    return;
  }
  window.setTimeout(() => {
    retryingId.value = '';
    errorMsg.value = `与 ${row.ide} 的协议通道握手超时：本机代理 127.0.0.1:7301 未启动。`;
    errorTrace.value = `trace-ide-${Math.abs(row.id.length * 7919).toString(16)}`;
  }, 300);
}

onMounted(() => {
  // 首次加载：读连接记录（离线记录也保留，便于排障）
  window.setTimeout(() => (loading.value = false), 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="IDE 集成"
      desc="VS Code / JetBrains / Neovim / Zed 四行 × 7 能力矩阵；IDE 插件是瘦客户端（只做 UI 与协议桥），低版本插件连高版本内核时仅使用交集能力。"
      volume="卷 29"
      manifest="G2-01"
      cli="oc ide status --json"
      :status="[{ label: '瘦客户端（不内嵌 Agent 逻辑）', theme: 'default' }, { label: `${ides.length} 个 IDE 适配`, theme: 'primary' }]"
    >
      <template #actions>
        <Tag variant="outline" size="small"><OcIcon name="extension" size="12px" /> 插件版本 0.6–0.9</Tag>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="已接入 IDE" :value="ides.length" unit="个" icon="extension" />
      <StatCard label="在线连接" :value="online" unit="个" icon="check" :hint="`共 ${matched.length} 条连接记录`" />
      <StatCard label="完全支持的能力" :value="21" unit="项" icon="task-checked" hint="4 IDE × 7 能力中 21 项为「支持」" />
      <StatCard label="开发中 / 不支持" :value="unsupportedNotes.length" unit="项" icon="help" hint="灰格与黄格均给出原因与替代路径" />
    </div>

    <StateShell
      :state="state"
      :collapsed-summary="edgeSummary"
      :page-size="4"
      stage="正在读取 IDE 连接与能力矩阵…"
      empty-title="暂无 IDE 连接记录"
      empty-desc="尚未有 IDE 插件连接本内核；安装插件后首次连接会写入一条记录（离线连接也记录，便于排障）。"
      empty-action="查看安装指引"
      example-task="在 VS Code 内打开审批卡片并查看 diff 后批准"
      what="IDE 连接状态读取失败"
      why="协议桥握手失败（插件版本低于 minVersion 或本机代理未启动）。"
      how="可重试；启动本机代理后重连即可（低版本连高版本仅用交集能力，不算错误）。"
      :trace-id="errorTrace"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="reload"
    >
      <Alert
        v-if="errorMsg"
        theme="error"
        :message="`事实：${errorMsg}`"
        description="原因：本机代理未启动或端口被占用（插件版本低于 minVersion 也会出现）。动作：启动代理后点「重连」；仍失败请导出诊断包（oc doctor --json）。"
        style="margin-bottom: 10px"
      />
      <div class="oc-card">
        <div class="oc-card__title">能力矩阵（4 IDE × 7 能力）<CopyableId id="trace-ide-4c81de" label="复制 traceId" /></div>
        <div class="oc-matrix">
          <div class="oc-matrix__row oc-matrix__row--head">
            <span>能力 / IDE</span>
            <span v-for="ide in ides" :key="ide.ide">{{ ide.ide }}</span>
          </div>
          <div v-for="row in capRows" :key="row.key" class="oc-matrix__row">
            <span class="oc-secondary">{{ row.label }}</span>
            <span v-for="cell in row.cells" :key="cell.ide">
              <Tooltip :content="REASON[`${cell.ide}-${row.label}`] ?? cell.note ?? '按交集能力可用'">
                <Tag size="small" :theme="SUPPORT_META[cell.support]?.theme ?? 'default'" variant="light-outline">
                  {{ SUPPORT_META[cell.support]?.label ?? cell.support }}
                </Tag>
              </Tooltip>
            </span>
          </div>
        </div>
        <div class="oc-stack" style="gap: 4px; margin-top: 10px">
          <div v-for="n in unsupportedNotes" :key="n.key" class="oc-flex" style="gap: 6px; font-size: 12px">
            <Tag size="small" :theme="SUPPORT_META[n.support]?.theme ?? 'default'" variant="outline">{{ n.ide }}</Tag>
            <span class="oc-secondary">{{ n.cap }}</span>
            <span class="oc-muted">{{ n.reason }}</span>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--3" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">能力说明（为什么是瘦客户端）</div>
          <Alert
            theme="info"
            message="IDE 插件只是瘦客户端：不内嵌 Agent 逻辑（避免双实现漂移），不落地会话状态。"
            description="插件只做三件事：渲染面板与卡片、把用户动作转成协议请求、把事件流投影成 IDE 原生视图。能力以内核版本为准。"
          />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'ui', label: 'UI 承载', value: '会话面板 / 审批卡片（含 diff）/ 内联 diff 应用' },
              { key: 'bridge', label: '协议桥', value: '本地回环 WS + 企业网关 HTTPS，复用桌面端同一协议' },
              { key: 'limits', label: '能力边界', value: '低版本插件连高版本内核：仅使用交集能力，并显式提示缺失项' },
            ]"
          />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">连接状态（IDE 类型 / 版本 / 最近连接）<CopyableId id="trace-ide-4c81de" label="复制 traceId" /></div>
          <Table :data="visible" row-key="id" size="small" :columns="connColumns" table-layout="fixed">
            <template #version="{ row }">
              <span class="oc-mono" style="font-size: 12px">{{ row.version }}</span>
              <span class="oc-muted" style="font-size: 11px"> · 内核 {{ row.kernel }}</span>
            </template>
            <template #at="{ row }">{{ new Date(row.lastConnectedAt).toLocaleString('zh-CN') }}</template>
            <template #state="{ row }">
              <Tag size="small" :theme="STATE_THEME[row.state] ?? 'default'" variant="light-outline">{{ row.state }}</Tag>
            </template>
            <template #ops="{ row }">
              <Button v-if="row.state !== '在线'" size="small" variant="text" :loading="retryingId === row.id" @click="reconnect(row)">重连</Button>
              <span v-else class="oc-muted" style="font-size: 12px">—</span>
            </template>
          </Table>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">安装与排障</div>
          <div class="oc-stack" style="gap: 6px; font-size: 13px">
            <div v-for="ide in ides" :key="ide.ide">
              <b>{{ ide.ide }}（v{{ ide.version }}）</b>
              <div class="oc-muted" style="font-size: 12px">{{ ide.install }}</div>
            </div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">{{ ides[2].notes }}</div>
          <div class="oc-muted" style="font-size: 12px">{{ ides[3].notes }}</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>

<style scoped>
.oc-matrix {
  border: 1px solid var(--oc-border);
  border-radius: 6px;
  overflow: hidden;
}

.oc-matrix__row {
  display: grid;
  grid-template-columns: 240px repeat(4, minmax(0, 1fr));
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  font-size: 13px;
  border-top: 1px solid var(--oc-border);
}

.oc-matrix__row:first-child {
  border-top: none;
}

.oc-matrix__row--head {
  background: var(--td-bg-color-secondarycontainer, #f3f3f3);
  font-weight: 600;
  font-size: 12px;
}
</style>
