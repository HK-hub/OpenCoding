<script setup lang="ts">
/**
 * 导出导入面板（N2-14）：剥离凭证 / 绝对路径 / 内部地址 + 跨租户校验。
 * 溯源：卷 34 §8 多租户；BUILD-MANIFEST N2-14。
 * 契约：跨租户共享以「导出包 + 导入」显式进行；导入必须显式解绑或申请共享。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Select, Table, TabPanel, Tabs, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const pkg = automationData.exportedPackage;
const tab = ref('export');

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const importMode = ref<'mount' | 'bind' | 'reject'>('bind');
function onMode(v: unknown) {
  importMode.value = String(v) as typeof importMode.value;
}

const columns = [
  { colKey: 'path', title: '包内路径', width: 300, cell: 'path' },
  { colKey: 'kind', title: '内容类型', ellipsis: true },
  { colKey: 'hash', title: '哈希', width: 200, cell: 'hash' },
];
const checkColumns = [
  { colKey: 'item', title: '校验项', width: 180 },
  { colKey: 'result', title: '结论', width: 120, cell: 'result' },
  { colKey: 'detail', title: '详情', ellipsis: true },
];
const RESULT_THEME: Record<string, 'success' | 'warning' | 'danger'> = { PASS: 'success', WARN: 'warning', BLOCKED: 'danger' };

const blocked = computed(() => pkg.tenantCheck.checks.filter((c) => c.result === 'BLOCKED').length);

function runImport() {
  MessagePlugin.warning('导入已阻断：存在跨租户引用，需先解绑或申请共享（不做静默降级）');
}

/** 生成导出包（真实下载）：内容取自本页导出包数据 pkg，凭证均已为引用名、无明文 */
function exportPackage() {
  const filename = `oc-export-package-${pkg.id}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson({ package: pkg, blockedCount: blocked.value }, filename);
  MessagePlugin.success(`已生成导出包（${filename}）`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="导出导入"
      desc="导出包剥离凭证、绝对路径与内部地址；导入做跨租户校验，跨租户引用必须显式解绑或申请共享。"
      volume="卷 34" manifest="N2-14" cli="oc automation package export --scope payment-core --strip-secrets"
      :status="[{ label: blocked ? '跨租户校验未通过' : '校验通过', theme: blocked ? 'danger' : 'success' }, { label: '凭证引用式导出', theme: 'default' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="exportPackage">生成导出包</Button>
        <Popconfirm content="导入会创建模板实例（不覆盖既有实例）；跨租户引用必须解绑，无法解绑时整体拒绝。是否继续？" @confirm="runImport">
          <Button size="small" theme="primary">导入包</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在生成导出包并执行剥离扫描…"
      empty-title="没有可导出的内容" empty-desc="当前范围没有模板实例或度量数据；先安装实例再导出。"
      empty-action="去模板市场" example-task="导出 payment-core 的实例与度量，并在另一租户导入（观察跨租户拦截）"
      what="导出失败" why="剥离扫描发现未脱敏项（内部地址未能替换）" how="修正来源数据或扩展剥离规则后重试；包不会带敏感项出网" trace-id="trace-9f2c4a71"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Tabs v-model:value="tab">
        <TabPanel value="export" label="导出">
          <div class="oc-grid oc-grid--3">
            <div class="oc-card">
              <div class="oc-card__title">导出包</div>
              <InfoGrid :columns="1" :items="[
                { key: 'name', label: '包名', value: pkg.name, mono: true },
                { key: 'id', label: '包 id', value: pkg.id, mono: true, copyable: true },
                { key: 'files', label: '文件数', value: pkg.fileCount },
                { key: 'size', label: '大小', value: `${pkg.sizeKb.toFixed(1)} KB` },
                { key: 'at', label: '生成时间', value: new Date(pkg.createdAt).toLocaleString('zh-CN') },
              ]" />
            </div>
            <div class="oc-card">
              <div class="oc-card__title">剥离清单（强制）</div>
              <div class="oc-stack" style="gap: 6px; font-size: 13px">
                <div v-for="(s, i) in pkg.stripped" :key="i" class="oc-flex" style="gap: 6px">
                  <Tag size="small" theme="success" variant="light-outline">已剥离</Tag><span>{{ s }}</span>
                </div>
              </div>
            </div>
            <div class="oc-card">
              <div class="oc-card__title">跨租户校验</div>
              <InfoGrid :columns="1" :items="[
                { key: 'result', label: '总体结论', value: pkg.tenantCheck.result, tag: { text: pkg.tenantCheck.result, theme: blocked ? 'danger' : 'success' } },
                { key: 'blocked', label: '阻断项', value: `${blocked} 项` },
                { key: 'note', label: '处置', value: '解绑目标绑定，或由对方租户管理员申请共享；不做静默降级' },
              ]" />
            </div>
          </div>

          <div class="oc-grid oc-grid--2" style="margin-top: 12px">
            <div class="oc-card">
              <div class="oc-card__title">包结构<CliHint command="oc automation package inspect pkg-482913 --manifest" /></div>
              <Table :data="pkg.entries" :columns="columns" row-key="path" size="small" :pagination="undefined">
                <template #path="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.path }}</span></template>
                <template #hash="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.hash }}</span></template>
              </Table>
            </div>
            <div class="oc-card">
              <div class="oc-card__title">校验明细</div>
              <Table :data="pkg.tenantCheck.checks" :columns="checkColumns" row-key="item" size="small" :pagination="undefined">
                <template #result="{ row }"><Tag size="small" :theme="RESULT_THEME[row.result]" variant="light-outline">{{ row.result }}</Tag></template>
              </Table>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="import" label="导入">
          <Alert theme="warning" style="margin-bottom: 10px"
            message="导入仅创建实例（不覆盖既有实例、不自动启用）；启用仍需门禁检查与授权快照刷新。" />
          <div class="oc-grid oc-grid--2">
            <div class="oc-card">
              <div class="oc-card__title">导入策略</div>
              <Select :value="importMode" style="width: 100%" aria-label="导入策略" :options="[
                { value: 'mount', label: '挂载为只读参考（不创建实例）' },
                { value: 'bind', label: '创建实例并绑定本租户目标（需解绑原目标）' },
                { value: 'reject', label: '拒绝导入（保留包与校验报告）' },
              ]" @change="onMode" />
              <div class="oc-divider" />
              <InfoGrid :columns="1" :items="[
                { key: 'cross', label: '跨租户引用处理', value: importMode === 'bind' ? '解绑原目标引用后绑定本租户目标' : importMode === 'mount' ? '只读挂载，不解析目标绑定' : '整体拒绝（不落任何数据）' },
                { key: 'secret', label: '凭证', value: '包内仅有引用名；导入后需在本租户重新授权（引用不跨租户复用）' },
                { key: 'audit', label: '审计', value: '导入动作记入审计（导入人 / 包哈希 / 策略）' },
              ]" />
            </div>
            <div class="oc-card">
              <div class="oc-card__title">导入预检结果</div>
              <div class="oc-stack" style="gap: 6px; font-size: 13px">
                <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="success" variant="light-outline">PASS</Tag><span>包完整性哈希校验通过（48 个文件）</span></div>
                <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="success" variant="light-outline">PASS</Tag><span>模板定义签名可验证（内置签名链）</span></div>
                <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="danger" variant="light-outline">BLOCKED</Tag><span>1 项跨租户引用（inst-03 → 云枢科技-测试 仓库）</span></div>
                <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="warning" variant="light-outline">WARN</Tag><span>2 处内网域名已替换为占位符，导入后需补配置</span></div>
              </div>
              <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
                处置建议：将 inst-03 的目标改为本租户仓库（或由原租户申请共享）后再导入。
              </div>
            </div>
          </div>
        </TabPanel>
      </Tabs>
    </StateShell>
  </div>
</template>
