<script setup lang="ts">
/**
 * O-06 文件树与编辑器。
 * 分页目录（忽略规则）+ 行/字节范围读 + 编码探测 + 原子写（校验和）+ 变更监听
 * （SSH/云后端无监听 → 轮询 2s 且显式标注「非实时」）。写入前展示 diff 与后果。
 * 溯源：卷 20 D-WS-4；BUILD-MANIFEST O-06。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Input, InputNumber, MessagePlugin, Option, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import DiffView from '@/components/common/DiffView.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { platformData } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE'>('LOADING');
const wsId = ref('ws-0005');
const page = ref(1);
const lineFrom = ref(1);
const lineTo = ref(40);
const encoding = ref('自动探测');
const watchOn = ref(true);
const editing = ref(false);
const draft = ref('// 原子写：先写临时文件，再 rename 覆盖，落盘后校验和比对');

const ws = computed(() => platformData.workspaces.find((w) => w.workspaceId === wsId.value) ?? platformData.workspaces[0]);
const watchMode = computed(() => (ws.value.capabilities.watch ? '内核事件（实时）' : '轮询 2s（非实时）'));

const files = computed(() => [
  { name: 'src/reconcile/ledger.ts', size: '8.4 KB', encoding: 'UTF-8（无 BOM，置信度 0.99）', lines: 218, dirty: true },
  { name: 'src/reconcile/index.ts', size: '2.1 KB', encoding: 'UTF-8（无 BOM，置信度 0.99）', lines: 64, dirty: false },
  { name: 'fixtures/ledger-2026-08.csv', size: '118 MB', encoding: 'UTF-8（大文件：仅范围读）', lines: 1842032, dirty: false },
  { name: 'config/aliyun.ak.json', size: '0.3 KB', encoding: 'UTF-8', lines: 8, dirty: false },
].slice(0, page.value * 2));

const diffFiles = computed(() => [
  {
    path: 'src/reconcile/ledger.ts',
    additions: 12,
    deletions: 4,
    externalChanged: true,
    lines: [
      { type: 'ctx' as const, oldLine: 86, newLine: 86, text: 'export function diffLedger(rows: LedgerRow[]): LedgerDiff {', },
      { type: 'del' as const, oldLine: 87, newLine: undefined, text: '  return rows.map(toDiff);' },
      { type: 'add' as const, oldLine: undefined, newLine: 87, text: '  // 按幂等键去重：重跑不产生重复差异行' },
      { type: 'add' as const, oldLine: undefined, newLine: 88, text: '  return dedupeByKey(rows).map(toDiff);' },
    ],
  },
]);

function save() {
  editing.value = false;
  MessagePlugin.success('已原子写入：临时文件 + rename + 校验和比对（sha256:7f3a…91c0）；外部已改动时拒绝覆盖以避免丢改动');
}

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.workspaces.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="文件树与编辑器"
      desc="目录分页 + 忽略规则；读支持行/字节范围与编码探测；写为原子替换并校验和比对；变更监听在能力缺失时降级为轮询并标注「非实时」。"
      volume="卷 20" manifest="O-06" :cli="`oc workspace ls --id ${ws.workspaceId} --page ${page} && oc workspace write --id ${ws.workspaceId} --path src/reconcile/ledger.ts`"
      :status="[{ label: watchMode, theme: ws.capabilities.watch ? 'success' : 'warning' }, { label: '写入需工作区内', theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 150px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空目录' },
          { value: 'ERROR', label: '错误' }, { value: 'OFFLINE', label: '离线' },
        ]" />
        <Select v-model="wsId" size="small" style="width: 230px" aria-label="选择工作区">
          <Option v-for="w in platformData.workspaces" :key="w.workspaceId" :value="w.workspaceId" :label="`${w.name}（${w.type}）`" />
        </Select>
      </template>
    </PageHeader>

    <div v-if="!ws.capabilities.watch" class="oc-flex oc-flex--wrap">
      <Tag theme="warning" variant="light-outline" size="small">目录监听不可用</Tag>
      <span style="font-size: 12px">替代：轮询 2s（延迟最多 2s 感知变更，非实时）；需要即时提示请改用本地/容器后端。</span>
    </div>

    <StateShell
      :state="demo" stage="正在读取目录（应用忽略规则，分页 200 条/页）…"
      empty-title="目录为空或全部命中忽略规则" empty-desc="该路径下没有未忽略的文件；忽略规则来自 .gitignore 与企业规则。"
      empty-action="查看忽略规则" example-task="只读打开 118MB CSV 的第 100–140 行，避免全量载入"
      what="文件读取失败" why="路径超出工作区围栏（解析后的绝对路径在工作区之外）"
      how="可重试；请改用工作区内路径，或申请跨区授权" trace-id="trace-c88a5e64"
      :reconnect-in-ms="4000" :disabled-capabilities="['文件写入', '变更监听']"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'" @dismiss-offline="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            目录（第 {{ page }} 页）
            <span class="oc-flex" style="gap: 6px">
              <Switch v-model="watchOn" size="small" :disabled="!ws.capabilities.watch" />
              <span style="font-size: 12px">变更监听 {{ watchMode }}</span>
            </span>
          </h3>
          <Table
            :data="files" size="small" :pagination="undefined" row-key="name"
            :columns="[
              { colKey: 'name', title: '路径', width: 230, cell: 'name' },
              { colKey: 'size', title: '大小', width: 90 },
              { colKey: 'lines', title: '行数', width: 100 },
              { colKey: 'encoding', title: '编码探测', ellipsis: true },
              { colKey: 'dirty', title: '未提交', width: 100, cell: 'dirty' },
            ]"
          >
            <template #name="{ row }"><span class="oc-mono oc-truncate">{{ row.name }}</span></template>
            <template #dirty="{ row }">
              <Tag v-if="row.dirty" theme="warning" size="small" variant="light-outline">脏</Tag>
              <span v-else class="oc-muted">—</span>
            </template>
          </Table>
          <div class="oc-flex" style="margin-top: 8px">
            <Button size="small" variant="outline" @click="page += 1">加载更多（分页）</Button>
            <span class="oc-muted" style="font-size: 12px">忽略规则命中项不列出（node_modules/、dist/、*.log）</span>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">
              读取范围
              <CliHint command="oc workspace read --id ws-0005 --path fixtures/ledger-2026-08.csv --lines 100-140" />
            </h3>
            <div class="oc-flex oc-flex--wrap" style="gap: 8px">
              <InputNumber v-model="lineFrom" size="small" :min="1" style="width: 110px" />
              <span style="font-size: 12px">至</span>
              <InputNumber v-model="lineTo" size="small" :min="1" style="width: 110px" />
              <Select v-model="encoding" size="small" style="width: 160px" aria-label="编码">
                <Option value="自动探测" label="编码：自动探测" />
                <Option value="UTF-8" label="UTF-8" />
                <Option value="GB18030" label="GB18030" />
              </Select>
            </div>
            <pre class="oc-pre" style="margin-top: 8px">ledger_id,currency,amount,status
{{ 'L-2026-08-0001,CNY,18420.00,MATCHED' }}
{{ 'L-2026-08-0002,CNY,932.40,DIFF' }}
… 仅读取第 {{ lineFrom }}–{{ lineTo }} 行（大文件禁止全量载入）</pre>
            <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
              <Tag size="small" variant="outline">字节范围读同样可用（超出阈值自动切换）</Tag>
              <CopyableId id="read-9f21c0" label="复制读取句柄" />
            </div>
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">
              原子写入
              <Button size="small" variant="outline" @click="editing = !editing">{{ editing ? '收起编辑' : '编辑' }}</Button>
            </h3>
            <template v-if="editing">
              <Input v-model="draft" size="small" placeholder="新内容（示例：单行替换）" />
              <DiffView :files="diffFiles" style="margin-top: 8px" />
              <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
                <Tag theme="warning" variant="light-outline" size="small">外部已改动（externalChanged）→ 写入将被拒绝，需先刷新或改用三方合并</Tag>
                <Button size="small" theme="primary" @click="save">原子写入</Button>
              </div>
            </template>
            <InfoGrid
              v-else :columns="1" style="margin-top: 8px"
              :items="[
                { key: 'how', label: '写入语义', value: '临时文件 + rename 原子替换；落盘后校验和比对' },
                { key: 'conflict', label: '冲突保护', value: '检测到外部改动即拒绝覆盖（不丢改动），提示刷新或三方合并' },
                { key: 'scope', label: '写范围', value: ws.bindings[0]?.writeScope.join('、') ?? '未声明（默认只读）' },
                { key: 'undo', label: '撤销', value: '写前快照；可从快照恢复单文件（快照管理 O-07）' },
              ]"
            />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
