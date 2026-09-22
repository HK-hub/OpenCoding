<script setup lang="ts">
/**
 * 导入迁移向导（G2-02）：六类来源分步选择（AGENTS.md/CLAUDE.md/.cursorrules、MCP 配置、模型端点、
 * IDE 设置、插件与技能清单、会话导出包）→ dry-run 预演生成迁移报告（成功项 / 需人工确认项 /
 * 不支持项 + 替代建议）→ 导入前快照与失败回滚说明 → 确认导入。
 * 溯源：卷 29 / BUILD-MANIFEST G2-02。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Popconfirm, MessagePlugin, Progress, StepItem, Steps, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { importJsonFile } from '@/utils/download';
import type { UiStateKind } from '@/stores/ui';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const sources = enterpriseData.importSources;

/** 不支持项的替代建议：逐条给出原生能力 / 市场技能 / 后续版本，禁止「无建议」 */
const ALTERNATIVES: Record<string, string> = {
  'legacy-sse-server（传输不在白名单）': '改用 stdio 或 http（流式）传输，或经企业网关统一代理',
  '私有协议端点（v0 内部协议）': '改用 OpenAI 兼容层（企业网关提供 /v1/chat/completions 适配）',
  '已下线模型 gpt-4-legacy': '在模型目录中映射到等效模型（如 gpt-4.1）后重试',
  'IDE 专有扩展键位 5 条（无等价动作）': '用命令面板等价动作替代，或在键位设置中手工绑定',
  'IDE 专有重构插件（无等价能力）': '改用内置重构工具（rename / extract）或市场技能 refactor-kit',
  'bash-heavy 插件（沙箱策略冲突）': '申请 L2 沙箱并声明命令白名单，或改写为脚本技能',
  '闭源编译器插件': '暂不支持：编译在本地环境外执行，导出产物后人工接入（已登记需求）',
  '其他厂商私有会话格式（仅提取标题与时间线）': '先用原工具导出 Markdown/JSONL，再按通用会话格式导入',
};

const FIDELITY_THEME: Record<string, 'success' | 'warning' | 'default'> = { 高: 'success', 中: 'warning', 低: 'default' };

const step = ref(0);
const loading = ref(true);
const selected = ref<string[]>(sources.map((s) => s.id));
const dryRun = ref(false);
const running = ref(false);
const limit = ref(6);
const importError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const confirmed = ref(false);

/** 步骤：六类来源 → 预演 → 确认导入（共 8 步；预演前可随时回退修改选择） */
const steps = computed(() => [
  ...sources.map((s) => ({ key: s.id, title: s.source.split('·')[0].trim(), content: `保真度：${s.fidelity}` })),
  { key: 'dry-run', title: 'dry-run 预演', content: '生成迁移报告' },
  { key: 'confirm', title: '确认导入', content: '快照 + 原子写入' },
]);

const current = computed(() => sources[step.value] ?? null);

/** 迁移报告行：成功项 / 需人工确认项 / 不支持项（每行含处置建议） */
const reportRows = computed(() => {
  const rows: { id: string; source: string; kind: string; detail: string; suggestion: string }[] = [];
  sources
    .filter((s) => selected.value.includes(s.id))
    .forEach((s) => {
      rows.push({ id: `${s.id}-ok`, source: s.source, kind: '成功项', detail: `${s.report.succeeded} 项自动映射完成（${s.mapping.split('；')[0]}）`, suggestion: '' });
      s.manualItems.forEach((m, i) => rows.push({ id: `${s.id}-m${i}`, source: s.source, kind: '需人工确认', detail: m, suggestion: '确认可见范围与顺序后继续（不会自动决定）' }));
      s.unsupportedItems.forEach((u, i) => rows.push({ id: `${s.id}-u${i}`, source: s.source, kind: '不支持', detail: u, suggestion: ALTERNATIVES[u] ?? '保留原工具运行；已登记需求并给出跟踪编号' }));
    });
  return rows;
});

const visibleRows = computed(() => reportRows.value.slice(0, limit.value));
const manualCount = computed(() => reportRows.value.filter((r) => r.kind === '需人工确认').length);
const unsupportedCount = computed(() => reportRows.value.filter((r) => r.kind === '不支持').length);

const pageState = computed<UiStateKind>(() => {
  if (loading.value) return 'LOADING';
  if (importError.value) return 'ERROR';
  if (!dryRun.value) return 'NORMAL';
  if (!reportRows.value.length) return 'EMPTY';
  return reportRows.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

/** 预演：模拟解析与映射（真实场景由服务端 dry-run），产出迁移报告不落任何数据 */
function runDryRun() {
  running.value = true;
  dryRun.value = false;
  window.setTimeout(() => {
    running.value = false;
    dryRun.value = true;
    step.value = sources.length;
    MessagePlugin.success(`预演完成：成功 ${reportRows.value.filter((r) => r.kind === '成功项').length} 组 · 需人工 ${manualCount.value} 项 · 不支持 ${unsupportedCount.value} 项`);
  }, 600);
}

/** 导入迁移清单（真实解析 JSON）：命中的来源自动勾选；结构不合法时显式报错不静默 */
async function onPickFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  importError.value = '';
  try {
    const pkg = await importJsonFile<{ sources?: string[] }>(file);
    if (!Array.isArray(pkg.sources)) {
      throw new Error(`导入包缺少 sources 数组：${file.name}`);
    }
    const hit = pkg.sources.filter((id) => sources.some((s) => s.id === id));
    if (!hit.length) {
      throw new Error(`导入包未命中任何已知来源（${pkg.sources.join(', ')}）`);
    }
    selected.value = hit;
    MessagePlugin.success(`已解析迁移清单：勾选 ${hit.length} 类来源（dry-run 后才会写入）`);
  } catch (err) {
    importError.value = err instanceof Error ? err.message : '导入包解析失败';
    MessagePlugin.error(importError.value);
  } finally {
    input.value = '';
  }
}

function confirmImport() {
  confirmed.value = true;
  MessagePlugin.success('导入已受理：先写快照再原子写入；任一步失败自动回滚到快照');
}

/** 勾选/取消某一类来源（迁移范围由用户显式决定，不默认全量写入） */
function toggleSource(id: string) {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id];
}

onMounted(() => {
  window.setTimeout(() => {
    loading.value = false;
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="导入迁移向导"
      desc="把已有的指令文件、MCP 配置、模型端点、IDE 设置、插件清单与会话包迁进来：先 dry-run 预演生成迁移报告（成功 / 需人工 / 不支持+建议），再写入；导入前有快照，失败可回滚。"
      volume="卷 29"
      manifest="G2-02"
      cli="oc import --dry-run --from . --json"
      :status="[{ label: '凭证只导入引用', theme: 'default' }, { label: '先预演后写入', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="fileInput?.click()">载入迁移清单</Button>
        <Button size="small" variant="outline" :loading="running" @click="runDryRun">dry-run 预演</Button>
        <Popconfirm
          content="确认导入将先写入快照（snap-20260921-0142），再按选中的 6 类来源原子写入；任一步失败自动回滚到快照，已存在条目按「保留本地」处理，不覆盖。"
          @confirm="confirmImport"
        >
          <Button size="small" theme="primary" :disabled="!dryRun">确认导入</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <input ref="fileInput" type="file" accept=".json,application/json" class="oc-sr-only" aria-label="载入迁移清单" @change="onPickFile" />

    <div class="oc-grid oc-grid--4">
      <StatCard label="来源类别" :value="sources.length" unit="类" icon="upload" hint="可逐类选择，也可全部跳过" />
      <StatCard label="已勾选" :value="selected.length" unit="类" icon="check" />
      <StatCard label="需人工确认" :value="manualCount" unit="项" icon="user" :lower-is-better="true" hint="需你决策，系统不代为选择" />
      <StatCard label="不支持" :value="unsupportedCount" unit="项" icon="help" :lower-is-better="true" hint="逐条给出替代建议" />
    </div>

    <StateShell
      :state="pageState"
      :collapsed-summary="`迁移报告 ${reportRows.length} 行，超过单次渲染阈值（6 行）已折叠。`"
      :page-size="6"
      stage="正在解析来源与生成映射…"
      empty-title="没有可导入的内容"
      empty-desc="未勾选任何来源，或来源中没有可迁移条目；可先载入迁移清单（JSON）再预演。"
      empty-action="载入迁移清单"
      example-task="把 AGENTS.md 与 MCP 配置迁入，观察 dry-run 对不支持的传输给出替代建议"
      what="导入包解析失败"
      why="导入包结构不合法（缺少 sources 数组，或来源 id 均未命中）。"
      how="修正后重试；也可逐类手工勾选来源（不依赖导入包）。"
      trace-id="trace-import-3ad0f7"
      @retry="importError = ''; dryRun = false"
      @load-more="limit += 6"
      @empty-action="fileInput?.click()"
    >
      <div class="oc-card">
        <div class="oc-card__title">迁移范围（六类来源，可逐类勾选）<CopyableId id="trace-import-3ad0f7" label="复制 traceId" /></div>
        <Steps :current="step" size="small" style="margin-bottom: 10px">
          <StepItem v-for="(s, i) in steps" :key="s.key" :title="s.title" :content="s.content" :status="i < step ? 'finish' : i === step ? 'process' : 'default'" />
        </Steps>
        <div v-if="!dryRun" class="oc-stack" style="gap: 8px">
          <div v-if="current" class="oc-card" style="border-style: dashed">
            <div class="oc-flex--between">
              <div class="oc-card__title" style="margin: 0">{{ current.source }}</div>
              <div class="oc-flex" style="gap: 6px">
                <Tag size="small" :theme="FIDELITY_THEME[current.fidelity] ?? 'default'" variant="light-outline">保真度：{{ current.fidelity }}</Tag>
                <Tag size="small" variant="outline">{{ current.content }}</Tag>
              </div>
            </div>
            <InfoGrid :columns="2" :items="[
              { key: 'map', label: '映射规则', value: current.mapping },
              { key: 'cred', label: '凭证处理', value: current.credentialNote },
              { key: 'count', label: '预演计数', value: `成功 ${current.report.succeeded} · 需人工 ${current.report.manual} · 不支持 ${current.report.unsupported}` },
              { key: 'ok', label: 'dry-run 就绪', value: current.dryRunOk ? '是' : '否（预演会跳过并说明原因）' },
            ]" />
            <div class="oc-flex" style="gap: 8px; margin: 8px 0">
              <Button
                size="small"
                :theme="selected.includes(current.id) ? 'primary' : 'default'"
                variant="outline"
                @click="toggleSource(current.id)"
              >
                {{ selected.includes(current.id) ? '已纳入本次导入（点击移除）' : '纳入本次导入' }}
              </Button>
              <CliHint :command="`oc import --source ${current.id} --dry-run`" label="单独预演该类" />
            </div>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag v-for="s in sources" :key="s.id" size="small" :theme="selected.includes(s.id) ? 'primary' : 'default'" variant="light-outline">
              {{ selected.includes(s.id) ? '✓ ' : '' }}{{ s.source.split('（')[0] }}
              <Button size="small" variant="text" @click="toggleSource(s.id)">切换</Button>
            </Tag>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <Button size="small" variant="outline" :disabled="step === 0" @click="step -= 1">上一步</Button>
            <Button size="small" variant="outline" :disabled="step >= sources.length - 1" @click="step += 1">下一步</Button>
            <Button size="small" theme="primary" :loading="running" @click="runDryRun">dry-run 预演</Button>
          </div>
        </div>
        <Alert
          v-else
          theme="info"
          message="预演完成：以下报告不落任何数据；确认导入前可继续调整来源选择后重新预演。"
          description="预演与正式导入使用同一解析器与映射规则（保证「所见即将写入」）；差异只在于是否写库。"
        />
      </div>

      <div v-if="importError" class="oc-card" style="margin-top: 12px">
        <Alert theme="error" :message="`导入包解析失败：${importError}`" description="事实：文件已读取但未被接受。原因：结构校验未通过。动作：修正 JSON 后重试，或手工勾选来源。" />
      </div>

      <div v-if="dryRun" class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">迁移报告（成功项 / 需人工确认项 / 不支持项 + 建议）</div>
        <Table :data="visibleRows" row-key="id" size="small" :columns="[
          { colKey: 'kind', title: '类型', width: 120, cell: 'kind' },
          { colKey: 'source', title: '来源', width: 210, ellipsis: true },
          { colKey: 'detail', title: '条目', ellipsis: true },
          { colKey: 'suggestion', title: '处置建议', width: 300, cell: 'suggestion' },
        ]" table-layout="fixed">
          <template #kind="{ row }">
            <Tag size="small" :theme="row.kind === '成功项' ? 'success' : row.kind === '需人工确认' ? 'warning' : 'default'" variant="light-outline">{{ row.kind }}</Tag>
          </template>
          <template #suggestion="{ row }">
            <span v-if="row.suggestion" style="font-size: 12px">{{ row.suggestion }}</span>
            <span v-else class="oc-muted" style="font-size: 12px">无需处置</span>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          当前展示 {{ visibleRows.length }} / {{ reportRows.length }} 行；折叠不改变结论，可「加载更多」查看全部。
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">导入前快照与失败回滚</div>
          <div class="oc-stack" style="gap: 6px; font-size: 13px">
            <div class="oc-flex" style="gap: 6px"><OcIcon name="secured" size="14px" /><span>① 写入前生成快照 <span class="oc-mono">snap-20260921-0142</span>（含指令、MCP、路由、偏好与技能清单）。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="layers" size="14px" /><span>② 按来源逐类原子写入；单类失败即中止，已写入部分按快照回滚（不出现半成品）。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="history" size="14px" /><span>③ 回滚命令：<span class="oc-mono">oc import --rollback snap-20260921-0142</span>（保留快照 7 天）。</span></div>
          </div>
          <Progress v-if="confirmed" :percentage="100" status="success" style="margin-top: 10px" />
          <div v-if="confirmed" class="oc-muted" style="font-size: 12px">最近一次导入：6 类来源 · 快照快照可用于回滚；凭证仅写入引用名。</div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">不支持项与建议（逐条）</div>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="row in reportRows.filter((r) => r.kind === '不支持')" :key="row.id" class="oc-flex" style="gap: 6px; font-size: 12px">
              <Tag size="small" theme="default" variant="outline">不支持</Tag>
              <span>{{ row.detail }} → {{ row.suggestion }}</span>
            </div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
