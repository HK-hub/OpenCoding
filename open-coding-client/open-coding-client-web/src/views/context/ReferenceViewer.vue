<script setup lang="ts">
/**
 * 引用与工件（S-12）：artifact:// file:// kb:// checkpoint:// 四类引用分组列表，逐条展示大小/token/敏感性，
 * 「再读」走重新鉴权（越权拒绝并审计）；单工具结果 >4k token 默认外置。溯源：卷 03 §4.5。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Tabs, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { useSessionStore } from '@/stores/session';

type Scheme = 'artifact' | 'file' | 'kb' | 'checkpoint';

interface RefItem {
  uri: string;
  scheme: Scheme;
  label: string;
  tokens: number;
  size: string;
  sensitivity: 'internal' | 'confidential' | 'restricted';
  /** 模拟重新鉴权失败（越权被拒并审计） */
  deny?: boolean;
}

const ui = useUiStore();
// 引用视图跟随当前会话：切换会话后外置引用同步替换
const session = useSessionStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const tab = ref<Scheme>('artifact');
const readingUri = ref('');
const readState = ref<Record<string, { ok: boolean; page: number; traceId?: string }>>({});
const PAGE_LINES = 15;

/** 外置引用（来自工具结果）+ 四类静态样例，保证每类都有可演示项 */
const items: RefItem[] = [
  ...session.items.filter((i) => i.tool?.artifactRef).map<RefItem>((i) => ({
    uri: i.tool?.artifactRef ?? '',
    scheme: 'artifact',
    label: i.tool?.summary ?? '工具结果外置',
    tokens: i.tool?.name === 'run_command' ? 12_400 : 5_180,
    size: i.tool?.name === 'run_command' ? '218 KB' : '46 KB',
    sensitivity: 'internal',
  })),
  { uri: 'file://src/main/java/com/acme/payment/PaymentServiceImpl.java#L88-L126', scheme: 'file', label: 'PaymentServiceImpl 幂等校验段', tokens: 2_140, size: '8.2 KB', sensitivity: 'internal' },
  { uri: 'file://.oc/env.yaml', scheme: 'file', label: '环境清单（工作区围栏内）', tokens: 320, size: '1.1 KB', sensitivity: 'internal' },
  { uri: 'kb://payment-idempotency#chunk=4', scheme: 'kb', label: '知识页「支付链路幂等设计」片段', tokens: 1_860, size: '6.4 KB', sensitivity: 'internal' },
  { uri: 'kb://adr/ADR-014#section=decision', scheme: 'kb', label: 'ADR-014 决策记录（受限知识域）', tokens: 2_400, size: '9.8 KB', sensitivity: 'restricted', deny: true },
  { uri: 'checkpoint://ckp_7f31', scheme: 'checkpoint', label: '检查点 ckp_7f31（步骤 4）', tokens: 3_600, size: '14 KB', sensitivity: 'confidential' },
  { uri: 'checkpoint://ckp_7f2a', scheme: 'checkpoint', label: '检查点 ckp_7f2a（步骤 2，只读检索）', tokens: 900, size: '3.2 KB', sensitivity: 'internal' },
];

const groups = computed(() => ({
  artifact: items.filter((i) => i.scheme === 'artifact'),
  file: items.filter((i) => i.scheme === 'file'),
  kb: items.filter((i) => i.scheme === 'kb'),
  checkpoint: items.filter((i) => i.scheme === 'checkpoint'),
}));
const shown = computed(() => groups.value[tab.value]);
const SENS_META = { internal: { text: '内部', theme: 'default' }, confidential: { text: '机密', theme: 'warning' }, restricted: { text: '受限', theme: 'danger' } } as const;

/** 分段内容：按引用确定性生成，再读后分页展示 */
function contentOf(it: RefItem): string[] {
  if (it.scheme === 'checkpoint') return ['step 4 · 已提交写入 2 个文件', '副作用账本：2 条（重放将跳过）', '关键证据：BUILD SUCCESS · 128 tests passed'];
  if (it.scheme === 'kb') return ['…幂等键由调用方生成，服务端只校验唯一性…', '…重复提交返回首次结果，不做二次扣减…', '…退避间隔 1s/2s/4s，仅对可重试错误…'];
  return Array.from({ length: 37 }, (_, i) => `${String(i + 1).padStart(3, '0')}  ${it.scheme === 'artifact' ? '[artifact]' : 'public boolean handleRetry(...) { }'} · 行 ${i + 1} 示例内容`);
}

/** 再读 = 重新鉴权（引用不豁免权限）；失败必须显式报告并留审计 */
function reread(it: RefItem) {
  readingUri.value = it.uri;
  readState.value[it.uri] = { ok: false, page: 0 };
  window.setTimeout(() => {
    readingUri.value = '';
    if (it.deny) {
      readState.value[it.uri] = { ok: false, page: 0, traceId: 'trace-ref-7f20' };
      MessagePlugin.error(`越权被拒，已审计：${it.label}（受限知识域需重新申请授权）`);
      return;
    }
    readState.value[it.uri] = { ok: true, page: 0 };
    MessagePlugin.success(`再读成功：${it.uri}（前 ${PAGE_LINES} 行，可继续分页）`);
  }, 800);
}

function nextPage(it: RefItem) {
  const st = readState.value[it.uri];
  if (st) st.page += 1;
}

onMounted(() => {
  window.setTimeout(() => { state.value = items.length ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="引用与工件"
      desc="四类引用分组：artifact / file / kb / checkpoint。再读一律重新鉴权，越权拒绝并审计；大结果默认外置。"
      volume="卷 03"
      manifest="S-12"
      cli="oc context refs --list --reread 'kb://payment-idempotency#chunk=4'"
      :status="[{ label: `共 ${items.length} 条引用`, theme: 'primary' }, { label: '再读需重新鉴权', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">刷新引用</Button>
        <Button size="small" theme="primary" @click="reread(shown[0])">再读当前组首条</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有外置引用"
      empty-desc="当前会话没有产生需要外置的工件；命中 >4k token 的单工具结果时会自动外置。"
      empty-action="查看外置阈值"
      example-task="对受限知识引用执行「再读」，确认越权被拒并生成审计记录"
      what="引用清单加载失败"
      why="工件索引读取失败（对象存储命名空间不可达）"
      how="可重试；失败时禁用全部「再读」按钮（避免基于不完整索引误读）"
      trace-id="trace-ref-7f20"
      collapsed-summary="引用超过单页阈值，仅渲染当前分组的前 20 条（其余按需加载）。"
      :page-size="20"
      @retry="state = 'LOADING'"
      @empty-action="MessagePlugin.info('外置阈值：单工具结果 >4k token 默认外置为引用')"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="引用总数" :value="items.length" unit="条" icon="link" />
        <StatCard label="外置工件" :value="groups.artifact.length" unit="条" icon="file-copy" hint="单结果 >4k token 默认外置" />
        <StatCard label="受限引用" :value="items.filter((i) => i.sensitivity === 'restricted').length" unit="条" icon="lock" hint="再读需重新申请授权" />
        <StatCard label="分页行数" :value="PAGE_LINES" unit="行/页" icon="browse" />
      </div>

      <Tabs v-model="tab" :options="[ { value: 'artifact', label: `artifact://（${groups.artifact.length}）` }, { value: 'file', label: `file://（${groups.file.length}）` }, { value: 'kb', label: `kb://（${groups.kb.length}）` }, { value: 'checkpoint', label: `checkpoint://（${groups.checkpoint.length}）` } ]" />

      <div class="oc-card">
        <div v-if="!shown.length" class="oc-muted" style="font-size: 12px">该协议暂无引用：命中外置阈值或产生检查点后会自动出现。</div>
        <div v-else class="oc-stack" style="gap: 10px">
          <div v-for="it in shown" :key="it.uri" class="oc-stack" style="gap: 4px">
            <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <OcIcon :name="it.scheme === 'kb' ? 'database' : it.scheme === 'checkpoint' ? 'flag' : it.scheme === 'file' ? 'file' : 'file-copy'" size="14px" />
              <span style="font-size: 12px">{{ it.label }}</span>
              <Tag size="small" :theme="SENS_META[it.sensitivity].theme" variant="light-outline">{{ SENS_META[it.sensitivity].text }}</Tag>
              <span class="oc-muted" style="font-size: 11px">{{ it.size }} · {{ it.tokens.toLocaleString('zh-CN') }} token</span>
              <Button size="small" variant="outline" :loading="readingUri === it.uri" @click="reread(it)">再读</Button>
              <Tag v-if="readState[it.uri]?.traceId" size="small" theme="danger" variant="light-outline">越权被拒，已审计</Tag>
            </div>
            <CopyableId :id="it.uri" label="复制引用" />
            <div v-if="readState[it.uri]?.ok" class="oc-card" style="background: var(--td-bg-color-secondarycontainer)">
              <div class="oc-flex oc-flex--between" style="font-size: 11px">
                <span class="oc-muted">第 {{ readState[it.uri].page + 1 }} 页（每页 {{ PAGE_LINES }} 行）</span>
                <span class="oc-muted">重新鉴权通过 · 读取计入计量</span>
              </div>
              <pre class="oc-pre" style="font-size: 11px; max-height: 180px">{{ contentOf(it).slice(readState[it.uri].page * PAGE_LINES, (readState[it.uri].page + 1) * PAGE_LINES).join('\n') }}</pre>
              <div class="oc-flex" style="gap: 8px">
                <Button size="small" variant="outline" :disabled="(readState[it.uri].page + 1) * PAGE_LINES >= contentOf(it).length" @click="nextPage(it)">下一页</Button>
                <span v-if="(readState[it.uri].page + 1) * PAGE_LINES >= contentOf(it).length" class="oc-muted" style="font-size: 12px">已到末尾，未展示部分可按需继续拉取</span>
              </div>
            </div>
            <div v-else-if="readState[it.uri]?.traceId" class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
              <span class="oc-muted" style="font-size: 12px">事实：读取被拒绝；原因：引用超出当前授权范围；动作：申请临时授权或改用摘要引用。</span>
              <CopyableId :id="readState[it.uri].traceId ?? ''" label="复制 traceId" />
            </div>
          </div>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
          <Tooltip content="单工具结果超过 4k token 默认外置为引用，仅保留摘要；可对单条引用申请内联（会占用预算）">
            <Tag size="small" variant="outline">外部化阈值：4k token</Tag>
          </Tooltip>
          <CliHint command="oc context refs --reread 'artifact://tool-call/TC-8f24#section=output'" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
