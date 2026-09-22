<script setup lang="ts">
/**
 * 诊断包（N-14）：项清单 + 脱敏预览 + 导出（可选上传 + 过期删除）。
 * 溯源：卷 24 §4.9 / 卷 30 §4.1（A0 永不出安全域）
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Checkbox, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 诊断包用 ref 渲染：取消上传后包的上传状态即时刷新（同时写回领域数据） */
const packages = ref(d.diagnosticPackages);
const selectedId = ref(packages.value[0].id);
const selected = computed(() => packages.value.find((p) => p.id === selectedId.value) ?? packages.value[0]);
const includeEvent = ref(false);
const uploading = ref(false);
const collectedMb = computed(() => selected.value.items.filter((i) => i.included).reduce((a, i) => a + i.sizeKb, 0) / 1024);
const sensitiveCount = computed(() => selected.value.items.filter((i) => i.included && i.sensitive).length);

/** 取消上传：终止上传流程并保留本地包（过期时间不变），上传状态显式标注在包信息上 */
function cancelUpload() {
  const p = selected.value;
  uploading.value = false;
  p.uploadTarget = '未上传（已取消，本地保留）';
  MessagePlugin.success(`已取消上传：诊断包 ${p.id} 保留在本地，${new Date(p.expiresAt).toLocaleDateString('zh-CN')} 后自动删除（含上传副本），可重新导出或上传`);
}

onMounted(() => {
  setTimeout(() => { state.value = d.diagnosticPackages.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="诊断包"
      desc="一键收集（默认脱敏）+ 逐项预览可排除；凭证明文永不包含（A0 资产不出安全域），上传为可选项且有明确过期时间。"
      volume="卷 24"
      manifest="N-14"
      cli="oc doctor bundle --preview --redact"
      :status="[{ label: '明文密钥硬过滤', theme: 'danger' }, { label: '上传可选', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'LOADING'">重新收集</Button>
        <Button size="small" theme="primary" @click="uploading = true">导出 / 上传</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚无可导出的诊断包"
      empty-desc="先执行一次收集；收集过程只读导出，不修改任何业务数据。"
      empty-action="收集诊断包"
      example-task="oc doctor bundle --include env,errors --redact --out diag.zip"
      what="诊断包收集失败"
      why="收集过程被中断（Redis 探活超时导致连接状态项不可用）"
      how="可重试；失败包不含明文凭证（硬过滤在导出前执行），可安全删除后重试"
      trace-id="trace-diag-51c1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="诊断包" :value="d.diagnosticPackages.length" unit="个" icon="file-copy" />
        <StatCard label="预计体积" :value="collectedMb" format="number" unit="MB" hint="含最近错误与指标快照" />
        <StatCard label="敏感性项" :value="sensitiveCount" unit="项" icon="lock" hint="命中项仍会脱敏后才打包" />
        <StatCard label="保留期" :value="'14 天'" format="raw" hint="到期自动删除（含上传副本）" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">诊断包清单</div>
          <Table :data="packages" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
            <template #id="{ row }"><span class="oc-mono">{{ row.id }}</span></template>
            <template #createdAt="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
            <template #status="{ row }">
              <Tag size="small" :theme="row.status === 'READY' ? 'success' : row.status === 'COLLECTING' ? 'primary' : 'danger'" variant="light-outline">{{ row.status }}</Tag>
            </template>
            <template #sizeMb="{ row }">{{ row.sizeMb }} MB</template>
          </Table>
          <div v-if="d.diagnosticPackages[1].status === 'FAILED'" class="oc-state__hint" style="margin-top: 6px">
            负样本：{{ d.diagnosticPackages[1].items[1].note }}；不完整包已标记失败（不静默交付残缺包）。
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">导出选项（{{ selected.id }}）</div>
          <div class="oc-stack">
            <Checkbox v-for="i in selected.items" :key="i.key" :checked="i.included" :disabled="i.key === 'secrets'" :label="i.label" />
            <Checkbox v-model="includeEvent" label="包含事件片段（按时间与类型过滤，强制脱敏）" />
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" theme="danger" variant="light-outline">凭证明文：永不包含（扫描校验阻断）</Tag>
            <Tag size="small" variant="outline">上传目标：{{ selected.uploadTarget }}</Tag>
            <Tag size="small" variant="outline">过期时间：{{ new Date(selected.expiresAt).toLocaleDateString('zh-CN') }}</Tag>
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Button size="small" theme="primary" variant="outline" @click="uploading = true">导出 ZIP</Button>
            <Button v-if="uploading" size="small" variant="outline" @click="cancelUpload">取消上传（保留本地包）</Button>
          </div>
          <CopyableId id="trace-diag-7712" label="复制 traceId" />
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">脱敏预览（导出前逐项确认）</div>
        <Table :data="selected.redactionPreview" row-key="path" size="small">
          <template #path="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.path }}</span></template>
          <template #before="{ row }">
            <Tooltip content="原始值仅用于本地预览，不写入诊断包"><span class="oc-mono" style="font-size: 11px; color: var(--td-error-color, #d54941)">{{ row.before }}</span></Tooltip>
          </template>
          <template #after="{ row }"><span class="oc-mono" style="font-size: 11px; color: var(--td-success-color, #2ba471)">{{ row.after }}</span></template>
          <template #reason="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.reason }}</span></template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
          规则：路径→哈希（可定位不泄漏目录结构）；密钥→引用名；提示词正文与代码内容直接剔除。
        </div>
      </div>
    </StateShell>
  </div>
</template>
