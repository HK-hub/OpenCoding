<script setup lang="ts">
/**
 * Z-07 导入导出中心。
 * 厂商中立导出包结构（manifest / events / workitems / memory / artifacts / workspace-refs / checksums）+
 * 哈希校验 + 部分导入 + 引用缺失报告（缺失不阻断，但必须显式列出）。
 * 溯源：卷 19 D-PERS-8/§4.4；BUILD-MANIFEST Z-07。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Checkbox, Dialog, MessagePlugin, Option, Progress, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData, humanBytes } from '@/mock/data/platform';
import type { ExportPackage } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const activeId = ref(platformData.persistence.exportPackages[0].packageId);
const importOpen = ref(false);
const partial = ref(true);
const chosenParts = ref<string[]>(['events', 'workitems', 'memory']);

const packs = computed(() => platformData.persistence.exportPackages);
const active = computed<ExportPackage>(() => packs.value.find((p) => p.packageId === activeId.value) ?? packs.value[0]);

const PACK_PARTS = [
  { key: 'manifest', label: 'manifest.json', desc: '版本、内核版本、导出时间、条目计数、哈希清单', required: true },
  { key: 'events', label: 'events.jsonl', desc: '语义事件（分区有序，可重放）', required: false },
  { key: 'workitems', label: 'workitems.json', desc: '任务/计划/目标（含依赖与证据引用）', required: false },
  { key: 'memory', label: 'memory/', desc: '记忆文件（Markdown + YAML 头）', required: false },
  { key: 'artifacts', label: 'artifacts/', desc: '外置内容（内容寻址，按需包含）', required: false },
  { key: 'workspaceRefs', label: 'workspace-refs.json', desc: '工作区引用（仓库地址 + 提交 + 分支，不含代码）', required: false },
  { key: 'checksums', label: 'checksums.txt', desc: '全量校验（导入前必校验）', required: true },
];

const columns = [
  { colKey: 'packageId', title: '导出包', width: 300, cell: 'id' },
  { colKey: 'events', title: '事件', width: 100 },
  { colKey: 'workitems', title: '任务', width: 90 },
  { colKey: 'memory', title: '记忆', width: 90 },
  { colKey: 'artifacts', title: '工件', width: 90 },
  { colKey: 'sizeBytes', title: '大小', width: 110, cell: 'size' },
  { colKey: 'redacted', title: '脱敏', width: 100, cell: 'redacted' },
  { colKey: 'missingRefs', title: '引用缺失', width: 110, cell: 'missing' },
  { colKey: 'op', title: '操作', width: 96, cell: 'op' },
];

function doImport() {
  if (!chosenParts.value.length) {
    MessagePlugin.error('至少选择一个导入部分（manifest 与 checksums 为必选）');
    return;
  }
  MessagePlugin.success(`导入已启动：${chosenParts.value.join('、')}${partial.value ? '（部分导入：缺失引用将跳过并报告）' : ''}`);
  importOpen.value = false;
}

onMounted(() => {
  window.setTimeout(() => (demo.value = packs.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="导入导出中心"
      desc="厂商中立包：可迁移、可审计、可校验。导入前先校验哈希与版本；版本不兼容时先迁移后导入；引用缺失给出明确报告并支持部分导入。"
      volume="卷 19" manifest="Z-07" cli="oc export create --scope session --id S-1b2c && oc import apply --package <path> --partial"
      :status="[{ label: `${packs.length} 个导出包`, theme: 'default' }, { label: '哈希校验强制', theme: 'success' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="activeId" size="small" style="width: 300px" aria-label="选择导出包">
          <Option v-for="p in packs" :key="p.packageId" :value="p.packageId" :label="p.packageId" />
        </Select>
        <Button size="small" theme="primary" @click="importOpen = true">导入包</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="导出包总量" :value="packs.reduce((a, p) => a + p.sizeBytes, 0)" format="token" unit="B" icon="download" hint="工件按内容寻址，重复内容不重复打包" />
      <StatCard label="引用缺失包" :value="packs.filter((p) => p.missingRefs.length).length" icon="error" hint="缺失不阻断，但必须显式报告" />
      <StatCard label="脱敏包占比" :value="(packs.filter((p) => p.redacted).length / packs.length) * 100" format="percent" icon="secured" hint="导出默认脱敏（密钥永不导出）" />
      <StatCard label="最近导入校验" :value="'sha256 通过'" format="raw" icon="check" hint="校验失败即拒绝导入" />
    </div>

    <StateShell
      :state="demo" stage="正在校验导出包哈希清单…"
      empty-title="没有导出包" empty-desc="尚未导出任何会话/项目/团队包；导出为只读操作，不触发副作用。"
      empty-action="导出一个会话包" example-task="导出会话 S-1b2c 复现包，在另一实例导入并续跑"
      what="导出包清单读取失败" why="对象存储签名 URL 过期，无法读取包内 checksums.txt"
      how="重试（将重新签发 URL）；已下载的包可离线用 CLI 校验" trace-id="trace-e77a3d21"
      @retry="demo = 'NORMAL'" @empty-action="importOpen = true"
    >
      <Table :data="packs" :columns="columns" row-key="packageId" size="small" :pagination="undefined">
        <template #id="{ row }"><span class="oc-mono oc-truncate">{{ row.packageId }}</span></template>
        <template #size="{ row }">{{ humanBytes(row.sizeBytes) }}</template>
        <template #redacted="{ row }">
          <Tag :theme="row.redacted ? 'success' : 'warning'" size="small" variant="light-outline">{{ row.redacted ? '已脱敏' : '未脱敏' }}</Tag>
        </template>
        <template #missing="{ row }">
          <Tag v-if="row.missingRefs.length" theme="warning" size="small" variant="light-outline">{{ row.missingRefs.length }} 项</Tag>
          <span v-else class="oc-muted">无</span>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="activeId = row.packageId as string">校验</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          包结构：{{ active.packageId }}
          <CliHint :command="`oc export verify --package ${active.packageId}`" />
        </h3>
        <Table
          :data="PACK_PARTS" size="small" :pagination="undefined" row-key="key"
          :columns="[{ colKey: 'label', title: '条目', width: 180 }, { colKey: 'desc', title: '说明', ellipsis: true }, { colKey: 'required', title: '必选', width: 90, cell: 'req' }]"
        >
          <template #req="{ row }">
            <Tag :theme="row.required ? 'danger' : 'default'" size="small" variant="light-outline">{{ row.required ? '必选' : '可选' }}</Tag>
          </template>
        </Table>
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag size="small" variant="outline">workspace-refs 只含仓库地址 + 提交哈希 + 分支，不含代码</Tag>
          <Tag size="small" variant="outline">artifacts 内容寻址，重复内容不重复打包</Tag>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">哈希校验与引用缺失报告</h3>
        <JsonBlock
          :mask="false" label="checksums"
          :value="{ algorithm: 'sha256', files: active.events + active.workitems + active.artifacts, verified: active.missingRefs.length === 0 ? 'passed' : 'passed-with-warnings', checksums: active.checksums }"
        />
        <div v-if="active.missingRefs.length" class="oc-stack" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">引用缺失（可部分导入，缺失项在报告中列出）</Tag>
          <InfoGrid :columns="1" :items="active.missingRefs.map((m, i) => ({ key: `m${i}`, label: `缺失项 ${i + 1}`, value: m }))" />
        </div>
        <div v-else class="oc-flex" style="margin-top: 8px">
          <Tag theme="success" variant="light-outline" size="small">引用完整：导入后可完整续跑</Tag>
        </div>
        <Progress :percentage="100" theme="line" style="margin-top: 10px" />
      </div>
    </div>

    <Dialog v-model:visible="importOpen" header="导入导出包（部分导入）" width="620px" :confirm-btn="{ content: '开始导入', theme: 'primary' }" cancel-btn="取消" @confirm="doImport">
      <div class="oc-stack">
        <InfoGrid :columns="1" :items="[
          { key: 'rule', label: '导入规则', value: '校验哈希 → 版本不兼容先迁移 → 校验引用完整性 → 部分导入或全量导入' },
          { key: 'provenance', label: 'provenance', value: '导入生成来源事件（来源实例、导出时间、导入者）并进入审计' },
          { key: 'conflict', label: 'ID 冲突', value: '默认不覆盖既有对象；冲突项进入报告由人工决定' },
        ]" />
        <div class="oc-stack">
          <Checkbox v-model="partial" label="允许部分导入（缺失引用跳过并报告）" />
          <div class="oc-flex oc-flex--wrap" style="gap: 10px">
            <Checkbox v-for="p in PACK_PARTS.filter((x) => !x.required)" :key="p.key" :checked="chosenParts.includes(p.key)" :label="p.label" @change="chosenParts = chosenParts.includes(p.key) ? chosenParts.filter((x) => x !== p.key) : [...chosenParts, p.key]" />
          </div>
        </div>
        <CliHint command="oc import apply --package <path> --partial --report refs.json" />
      </div>
    </Dialog>
  </div>
</template>
